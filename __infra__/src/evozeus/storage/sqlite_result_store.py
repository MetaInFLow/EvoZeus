from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from evozeus.core.session import SessionEnvelope
from evozeus.factors.protocol import FactorResult
from evozeus.models import SessionEvent
from evozeus.runtime.paths import RuntimePaths
from evozeus.scanners.base import SessionRef


SCHEMA_VERSION = "result_store.v0"


@dataclass(frozen=True)
class SessionAnalysisStatus:
    session_id: str
    provider: str
    source_ref: str
    event_count: int
    discovered_at: str
    last_analyzed_at: str
    analyzed_factor_count: int
    pending_factor_count: int


@dataclass(frozen=True)
class EventFactorTag:
    session_id: str
    event_id: str
    event_index: int
    role: str
    content: str
    factor_id: str
    tag_type: str
    tag_value: str
    result_run_id: str
    analysis_run_id: str
    last_run_at: str


class SQLiteResultStore:
    def __init__(self, paths: RuntimePaths):
        self.paths = paths
        self.db_path = paths.result_index_db
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    def record_session_refs(self, refs: Iterable[SessionRef]) -> None:
        now = _utc_now()
        with self._connect() as conn:
            for ref in refs:
                conn.execute(
                    """
                    DELETE FROM sessions
                    WHERE provider = ?
                      AND source_ref = ?
                      AND session_id != ?
                    """,
                    (ref.provider, str(ref.source_path), ref.session_id),
                )
                conn.execute(
                    """
                    INSERT INTO sessions (
                        session_id, provider, source_ref, discovered_at, first_seen_at, last_seen_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(session_id) DO UPDATE SET
                        provider = excluded.provider,
                        source_ref = excluded.source_ref,
                        last_seen_at = excluded.last_seen_at
                    """,
                    (ref.session_id, ref.provider, str(ref.source_path), now, now, now),
                )

    def record_factor_run(
        self,
        session: SessionEnvelope,
        results: list[FactorResult],
        *,
        factor_ids: Iterable[str] | None = None,
        errors: Iterable[Any] | None = None,
    ) -> str:
        analysis_run_id = f"arun_{uuid4().hex}"
        now = _utc_now()
        selected_factor_ids = list(factor_ids or [result.factor_id for result in results])
        error_items = list(errors or [])
        status = "error" if error_items else "completed"
        with self._connect() as conn:
            self._upsert_session(conn, session, now)
            self._upsert_events(conn, session)
            conn.execute(
                """
                INSERT INTO analysis_runs (
                    analysis_run_id, session_id, provider, started_at, completed_at,
                    factor_ids_json, result_count, error_count, status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    analysis_run_id,
                    session.session_id,
                    session.provider,
                    now,
                    now,
                    _json(selected_factor_ids),
                    len(results),
                    len(error_items),
                    status,
                ),
            )
            for result in results:
                self._insert_result(conn, analysis_run_id, session.session_id, result, now)
            for error in error_items:
                self._insert_error(conn, analysis_run_id, session.session_id, error, now)
        return analysis_run_id

    def list_session_statuses(self, *, factor_ids: Iterable[str] | None = None) -> list[SessionAnalysisStatus]:
        requested_factor_ids = list(factor_ids or [])
        with self._connect() as conn:
            session_rows = conn.execute(
                """
                SELECT session_id, provider, source_ref, discovered_at, event_count
                FROM sessions
                ORDER BY session_id
                """
            ).fetchall()
            index_rows = self._select_factor_run_index(conn, requested_factor_ids)

        runs_by_session: dict[str, list[sqlite3.Row]] = {}
        for row in index_rows:
            runs_by_session.setdefault(str(row["session_id"]), []).append(row)

        statuses: list[SessionAnalysisStatus] = []
        for row in session_rows:
            session_runs = runs_by_session.get(str(row["session_id"]), [])
            analyzed_factor_ids = {str(run["factor_id"]) for run in session_runs}
            analyzed_count = len(analyzed_factor_ids)
            pending_count = max(len(requested_factor_ids) - analyzed_count, 0) if requested_factor_ids else 0
            last_analyzed_at = max((str(run["last_run_at"]) for run in session_runs), default="")
            statuses.append(
                SessionAnalysisStatus(
                    session_id=str(row["session_id"]),
                    provider=str(row["provider"]),
                    source_ref=str(row["source_ref"]),
                    event_count=int(row["event_count"]),
                    discovered_at=str(row["discovered_at"]),
                    last_analyzed_at=last_analyzed_at,
                    analyzed_factor_count=analyzed_count,
                    pending_factor_count=pending_count,
                )
            )
        return statuses

    def list_event_factor_tags(self, *, session_id: str | None = None) -> list[EventFactorTag]:
        sql = """
            SELECT
                eft.session_id,
                eft.event_id,
                e.event_index,
                e.role,
                e.content,
                eft.factor_id,
                eft.tag_type,
                eft.tag_value,
                eft.result_run_id,
                eft.analysis_run_id,
                eft.last_run_at
            FROM event_factor_tags eft
            JOIN session_events e
              ON e.session_id = eft.session_id
             AND e.event_id = eft.event_id
        """
        params: list[str] = []
        if session_id is not None:
            sql += " WHERE eft.session_id = ?"
            params.append(session_id)
        sql += " ORDER BY eft.session_id, e.event_index, eft.factor_id, eft.tag_type, eft.tag_value"
        with self._connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [
            EventFactorTag(
                session_id=str(row["session_id"]),
                event_id=str(row["event_id"]),
                event_index=int(row["event_index"]),
                role=str(row["role"]),
                content=str(row["content"]),
                factor_id=str(row["factor_id"]),
                tag_type=str(row["tag_type"]),
                tag_value=str(row["tag_value"]),
                result_run_id=str(row["result_run_id"]),
                analysis_run_id=str(row["analysis_run_id"]),
                last_run_at=str(row["last_run_at"]),
            )
            for row in rows
        ]

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _ensure_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS schema_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    provider TEXT NOT NULL,
                    source_ref TEXT NOT NULL,
                    discovered_at TEXT NOT NULL,
                    first_seen_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL,
                    loaded_at TEXT NOT NULL DEFAULT '',
                    event_count INTEGER NOT NULL DEFAULT 0,
                    metadata_json TEXT NOT NULL DEFAULT '{}'
                );

                CREATE TABLE IF NOT EXISTS session_events (
                    session_id TEXT NOT NULL,
                    event_id TEXT NOT NULL,
                    event_index INTEGER NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tool_name TEXT,
                    tool_result_json TEXT NOT NULL DEFAULT '{}',
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    PRIMARY KEY (session_id, event_id),
                    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS analysis_runs (
                    analysis_run_id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    completed_at TEXT NOT NULL,
                    factor_ids_json TEXT NOT NULL,
                    result_count INTEGER NOT NULL,
                    error_count INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS factor_results (
                    result_run_id TEXT PRIMARY KEY,
                    analysis_run_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    factor_id TEXT NOT NULL,
                    factor_version TEXT NOT NULL,
                    framework_id TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    target_type TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    verdict_signals_json TEXT NOT NULL,
                    scores_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(analysis_run_id) ON DELETE CASCADE,
                    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS factor_tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    result_run_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    factor_id TEXT NOT NULL,
                    tag_type TEXT NOT NULL,
                    tag_value TEXT NOT NULL,
                    FOREIGN KEY (result_run_id) REFERENCES factor_results(result_run_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS factor_evidence (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    result_run_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    factor_id TEXT NOT NULL,
                    event_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    evidence_json TEXT NOT NULL,
                    FOREIGN KEY (result_run_id) REFERENCES factor_results(result_run_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS event_factor_tags (
                    session_id TEXT NOT NULL,
                    event_id TEXT NOT NULL,
                    result_run_id TEXT NOT NULL,
                    analysis_run_id TEXT NOT NULL,
                    factor_id TEXT NOT NULL,
                    tag_type TEXT NOT NULL,
                    tag_value TEXT NOT NULL,
                    last_run_at TEXT NOT NULL,
                    PRIMARY KEY (session_id, event_id, factor_id, tag_type, tag_value),
                    FOREIGN KEY (session_id, event_id) REFERENCES session_events(session_id, event_id) ON DELETE CASCADE,
                    FOREIGN KEY (result_run_id) REFERENCES factor_results(result_run_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS factor_run_index (
                    session_id TEXT NOT NULL,
                    factor_id TEXT NOT NULL,
                    factor_version TEXT NOT NULL DEFAULT '',
                    last_run_at TEXT NOT NULL,
                    last_analysis_run_id TEXT NOT NULL,
                    last_result_run_id TEXT NOT NULL DEFAULT '',
                    last_status TEXT NOT NULL,
                    PRIMARY KEY (session_id, factor_id),
                    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS factor_run_errors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    analysis_run_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    factor_id TEXT NOT NULL,
                    error_type TEXT NOT NULL,
                    message TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(analysis_run_id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_event_factor_tags_session
                    ON event_factor_tags(session_id, factor_id);
                CREATE INDEX IF NOT EXISTS idx_factor_results_session
                    ON factor_results(session_id, factor_id, created_at);
                CREATE INDEX IF NOT EXISTS idx_factor_run_index_factor
                    ON factor_run_index(factor_id, last_run_at);
                """
            )
            conn.execute(
                """
                INSERT INTO schema_meta (key, value)
                VALUES ('schema_version', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (SCHEMA_VERSION,),
            )

    def _upsert_session(self, conn: sqlite3.Connection, session: SessionEnvelope, now: str) -> None:
        conn.execute(
            """
            INSERT INTO sessions (
                session_id, provider, source_ref, discovered_at, first_seen_at, last_seen_at,
                loaded_at, event_count, metadata_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                provider = excluded.provider,
                source_ref = excluded.source_ref,
                last_seen_at = excluded.last_seen_at,
                loaded_at = excluded.loaded_at,
                event_count = excluded.event_count,
                metadata_json = excluded.metadata_json
            """,
            (
                session.session_id,
                session.provider,
                session.source_ref,
                now,
                now,
                now,
                now,
                len(session.events),
                _json(session.metadata),
            ),
        )

    def _upsert_events(self, conn: sqlite3.Connection, session: SessionEnvelope) -> None:
        for index, event in enumerate(session.events, start=1):
            conn.execute(
                """
                INSERT INTO session_events (
                    session_id, event_id, event_index, role, content, tool_name, tool_result_json, metadata_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id, event_id) DO UPDATE SET
                    event_index = excluded.event_index,
                    role = excluded.role,
                    content = excluded.content,
                    tool_name = excluded.tool_name,
                    tool_result_json = excluded.tool_result_json,
                    metadata_json = excluded.metadata_json
                """,
                (
                    session.session_id,
                    event.event_id,
                    index,
                    event.role,
                    event.content,
                    event.tool_name,
                    _json(event.tool_result or {}),
                    _json(event.metadata),
                ),
            )

    def _insert_result(
        self,
        conn: sqlite3.Connection,
        analysis_run_id: str,
        session_id: str,
        result: FactorResult,
        now: str,
    ) -> None:
        result_session_id = result.session_id or session_id
        conn.execute(
            """
            INSERT INTO factor_results (
                result_run_id, analysis_run_id, session_id, factor_id, factor_version,
                framework_id, stage, target_type, target_id, status, confidence,
                verdict_signals_json, scores_json, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                result.run_id,
                analysis_run_id,
                result_session_id,
                result.factor_id,
                result.factor_version,
                result.framework_id,
                str(result.stage),
                result.target_type,
                result.target_id,
                result.status,
                result.confidence,
                _json(result.verdict_signals),
                _json(result.scores),
                now,
            ),
        )
        conn.execute(
            """
            INSERT INTO factor_run_index (
                session_id, factor_id, factor_version, last_run_at, last_analysis_run_id,
                last_result_run_id, last_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id, factor_id) DO UPDATE SET
                factor_version = excluded.factor_version,
                last_run_at = excluded.last_run_at,
                last_analysis_run_id = excluded.last_analysis_run_id,
                last_result_run_id = excluded.last_result_run_id,
                last_status = excluded.last_status
            """,
            (
                result_session_id,
                result.factor_id,
                result.factor_version,
                now,
                analysis_run_id,
                result.run_id,
                result.status,
            ),
        )
        conn.execute(
            "DELETE FROM event_factor_tags WHERE session_id = ? AND factor_id = ?",
            (result_session_id, result.factor_id),
        )
        for tag in result.tags:
            tag_type = str(tag.get("type") or "")
            tag_value = str(tag.get("value") or "")
            conn.execute(
                """
                INSERT INTO factor_tags (result_run_id, session_id, factor_id, tag_type, tag_value)
                VALUES (?, ?, ?, ?, ?)
                """,
                (result.run_id, result_session_id, result.factor_id, tag_type, tag_value),
            )
        for evidence in result.evidence_refs:
            event_id = str(evidence.get("ref_id") or evidence.get("event_id") or "")
            if not event_id:
                continue
            kind = str(evidence.get("kind") or evidence.get("source") or "")
            conn.execute(
                """
                INSERT INTO factor_evidence (result_run_id, session_id, factor_id, event_id, kind, evidence_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (result.run_id, result_session_id, result.factor_id, event_id, kind, _json(evidence)),
            )
            if not self._event_exists(conn, result_session_id, event_id):
                continue
            for tag in result.tags:
                tag_type = str(tag.get("type") or "")
                tag_value = str(tag.get("value") or "")
                conn.execute(
                    """
                    INSERT OR REPLACE INTO event_factor_tags (
                        session_id, event_id, result_run_id, analysis_run_id, factor_id,
                        tag_type, tag_value, last_run_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        result_session_id,
                        event_id,
                        result.run_id,
                        analysis_run_id,
                        result.factor_id,
                        tag_type,
                        tag_value,
                        now,
                    ),
                )

    def _insert_error(
        self,
        conn: sqlite3.Connection,
        analysis_run_id: str,
        session_id: str,
        error: Any,
        now: str,
    ) -> None:
        factor_id = _value(error, "factor_id")
        error_type = _value(error, "error_type")
        message = _value(error, "message")
        conn.execute(
            """
            INSERT INTO factor_run_errors (analysis_run_id, session_id, factor_id, error_type, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (analysis_run_id, session_id, factor_id, error_type, message, now),
        )
        conn.execute(
            """
            INSERT INTO factor_run_index (
                session_id, factor_id, last_run_at, last_analysis_run_id, last_status
            )
            VALUES (?, ?, ?, ?, 'error')
            ON CONFLICT(session_id, factor_id) DO UPDATE SET
                last_run_at = excluded.last_run_at,
                last_analysis_run_id = excluded.last_analysis_run_id,
                last_status = excluded.last_status
            """,
            (session_id, factor_id, now, analysis_run_id),
        )

    def _event_exists(self, conn: sqlite3.Connection, session_id: str, event_id: str) -> bool:
        row = conn.execute(
            "SELECT 1 FROM session_events WHERE session_id = ? AND event_id = ?",
            (session_id, event_id),
        ).fetchone()
        return row is not None

    def _select_factor_run_index(
        self,
        conn: sqlite3.Connection,
        factor_ids: list[str],
    ) -> list[sqlite3.Row]:
        if not factor_ids:
            return list(conn.execute("SELECT session_id, factor_id, last_run_at FROM factor_run_index").fetchall())
        placeholders = ", ".join("?" for _ in factor_ids)
        return list(
            conn.execute(
                f"""
                SELECT session_id, factor_id, last_run_at
                FROM factor_run_index
                WHERE factor_id IN ({placeholders})
                """,
                factor_ids,
            ).fetchall()
        )


def _utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _value(value: Any, key: str) -> str:
    if isinstance(value, dict):
        return str(value.get(key) or "")
    return str(getattr(value, key, "") or "")
