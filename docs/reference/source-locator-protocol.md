# Source Locator Protocol

- Status: draft
- Last updated: 2026-06-17

Source Locator Protocol 定义 SQLite 如何记录“到原始数据的路标”。它只定义 provider-neutral envelope；provider-specific payload 由 scanner pack 定义和解析。

## 核心原则

1. SQLite 默认不保存完整原文。
2. SQLite 保存 hash、redacted preview、source locator 和 artifact locator。
3. scanner pack 负责解释 locator payload。
4. resolver 跟随 scanner pack 安装。
5. Agent 定位原文时必须读取对应 scanner pack 的 `SKILL.md`。

## 查询链路

```text
event_factor_tags
  -> session_events(session_id, event_id)
  -> scanner_id / scanner_version
  -> event_locator_json / artifact_locator_json
  -> installed scanner pack
  -> SKILL.md
  -> resolver.py
  -> provider 原始 event 或 normalized artifact
```

## SQLite 字段

`session_events` 应使用轻量字段：

```text
session_id
event_id
event_index
provider
scanner_id
scanner_version
role
tool_name
source_ref
source_fingerprint
event_locator_json
artifact_locator_json
content_hash
content_preview_redacted
tool_result_hash
tool_result_preview_redacted
metadata_json
```

P0 不建议保存：

```text
content
tool_result_json
raw_payload_json
```

如果 debug 需要原文，使用 scanner resolver 从 locator 读取。

## Locator Envelope

`event_locator_json` 格式：

```json
{
  "schema_version": "locator.v0",
  "scanner_id": "codex",
  "scanner_version": "0.1.0",
  "locator_schema": "locator.codex_jsonl.v0",
  "kind": "source_event",
  "payload": {
    "source_path": "/Users/.../.codex/sessions/session.jsonl",
    "line_start": 128,
    "line_end": 128,
    "byte_start": 91234,
    "byte_end": 92018,
    "record_type": "response_item",
    "payload_type": "message"
  }
}
```

`artifact_locator_json` 格式：

```json
{
  "schema_version": "locator.v0",
  "scanner_id": "codex",
  "scanner_version": "0.1.0",
  "locator_schema": "locator.evozeus_artifact_jsonl.v0",
  "kind": "normalized_artifact_event",
  "payload": {
    "artifact_path": ".evozeus/sessions/session-alpha/events.jsonl",
    "line_start": 3,
    "line_end": 3,
    "event_id": "u1"
  }
}
```

Core runtime 只校验 envelope 字段。`payload` 内部结构由 `locator_schema` 对应的 scanner resolver 解释。

## Hash

`content_hash` 使用：

```text
sha256:<hex>
```

hash 的输入由 scanner 定义，但必须稳定。Codex scanner P0 可以使用标准化后的 `SessionEvent.content`。

如果 resolver 读取原文后算出的 hash 不一致，返回 `hash_mismatch`，并提示 source 可能已变化。

## Preview

`content_preview_redacted` 是 UI 默认展示文本：

```text
最多 160 chars
必须经过 redaction
不包含 secret、token、cookie、private key
```

Preview 只用于列表和搜索辅助，不作为 evidence 原文。

## Resolution Policy

默认定位顺序：

1. 使用 `artifact_locator_json` 读取 normalized artifact，适合 UI 展示标准化 event。
2. 使用 `event_locator_json` 读取 provider 原始 event，适合 debug 和 hash 验证。
3. 如果 artifact 缺失但 source 存在，resolver 可以重新 normalize。
4. 如果 source 缺失但 artifact 存在，UI 可以展示 artifact 并标记 `source_missing`。

具体顺序可以由 scanner pack 的 `SKILL.md` 覆盖，但必须说明。

## Failure Result

resolver 失败时返回结构化错误：

```json
{
  "ok": false,
  "error": "source_missing",
  "message": "source file not found",
  "scanner_id": "codex",
  "scanner_version": "0.1.0",
  "session_id": "session-alpha",
  "event_id": "u1"
}
```

## 隐私边界

SQLite 是本地账本，不默认存完整原文。导出、社区贡献、远程分享必须使用 redacted preview 或重新走 redaction pipeline。

Backend API 默认返回 preview 和 locator summary。请求 raw content 必须显式调用 resolver API，并且只能在 localhost token auth 下使用。
