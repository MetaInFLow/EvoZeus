# Scanner Pack Protocol

- Status: draft
- Last updated: 2026-06-17

Scanner pack 是 EvoZeus 读取外部 Agent / tool session 的能力包。它负责 provider-specific 的扫描、标准化、原文定位和操作说明。

Local Analysis Ledger 只保存统一索引和 locator envelope。如何通过 locator 找回 provider 原始数据，由对应 scanner pack 实现。

## 设计原则

1. Scanner pack 是最小安装单元。
2. Core runtime 只定义 scanner / resolver contract。
3. SQLite 不理解 Codex、Claude Code、Cursor、Feishu 等 provider 的私有格式。
4. 原文定位脚本、resolver 和使用说明跟随 scanner pack 一起下载、安装、删除和升级。
5. Agent 需要定位原文时，先读 SQLite 中的 `scanner_id` / `scanner_version`，再读取对应 scanner pack 的 `SKILL.md`。

## 归属边界

| Concern | Owner |
| --- | --- |
| 扫描目录、文件格式、provider 私有字段 | scanner pack |
| `SessionEnvelope`、`SessionRef`、`SessionEvent` 通用结构 | core runtime |
| `source_ref`、fingerprint、locator envelope、redacted preview | SQLite result index |
| `payload` 里的 line、byte、record type、provider 私有定位信息 | scanner pack |
| 根据 locator 读取原始 event 或 normalized artifact | scanner pack resolver |
| 告诉 Agent 怎么定位、校验、处理失败 | scanner pack `SKILL.md` |
| Factor 结果、tag、evidence ref | factor runner + SQLite result index |

因此，新增一个 provider 时，优先新增 scanner pack；不要把 provider 私有解析逻辑写进 SQLite schema、factor 或 browser workspace。

## 目录结构

Runtime-owned bundled scanner packs belong in `evozeus-runtime` after explicit permission and sandbox review. Lab or official review assets belong in the Factor lifecycle repos:

```text
evozeus-runtime/<runtime-pack-location>/<scanner_id>/<version>/
evozeus-factor-lab/submissions/<domain>/<scanner-id>/
evozeus-factors-official/packs/<pack-id>/
```

用户下载的 scanner pack 放在：

```text
.evozeus/runtime/scanners/installed/<scanner_id>/<version>/
```

每个 scanner pack 至少包含：

```text
<scanner_id>/<version>/
  scanner.json
  SCANNER.xml
  SKILL.md
  scanner.py
  resolver.py
  scripts/
    resolve_event_source.py
  tests/
    test_resolver_contract.py
```

## 文件职责

| File | Responsibility |
| --- | --- |
| `scanner.json` | 执行 manifest，声明 scanner id、version、provider、entrypoint、resolver、capabilities |
| `SCANNER.xml` | 给真人和 Agent 读的固定介绍 |
| `SKILL.md` | Agent 操作说明，包含如何扫描、如何定位原文、如何处理异常 |
| `scanner.py` | discover / load / normalize session |
| `resolver.py` | 根据 SQLite locator 找回 provider 原始 event |
| `scripts/resolve_event_source.py` | 调试和人工验证入口 |
| `tests/test_resolver_contract.py` | scanner pack 自带 contract test |

## scanner.json

示例：

```json
{
  "schema_version": "scanner.v0",
  "id": "codex",
  "version": "0.1.0",
  "provider": "codex",
  "name": "Codex Session Scanner",
  "entrypoint": "scanner:CodexScanner",
  "resolver": "resolver:CodexSourceResolver",
  "supports": [
    {
      "target_type": "session",
      "source_format": "codex_jsonl",
      "locator_schema": "locator.codex_jsonl.v0"
    }
  ],
  "permissions": ["read_local_session_files"],
  "default_source_dirs": [
    "~/.codex/sessions",
    "~/.codex/archived_sessions"
  ],
  "privacy": {
    "sqlite_raw_content": false,
    "redacted_preview": true
  }
}
```

## SCANNER.xml

`SCANNER.xml` 提供稳定介绍：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<scanner id="codex" version="0.1.0">
  <name>Codex Session Scanner</name>
  <summary>扫描本地 Codex JSONL session，并生成 SessionEnvelope。</summary>
  <provider>codex</provider>
  <source_format>codex_jsonl</source_format>
  <locator_schema>locator.codex_jsonl.v0</locator_schema>
  <privacy>SQLite 默认只保存 hash、redacted preview 和 locator，不保存完整原文。</privacy>
</scanner>
```

## SKILL.md 必须包含的内容

Scanner pack 的 `SKILL.md` 是 Agent 的操作说明。至少包含：

```text
# Codex Scanner

## When To Use
说明何时使用该 scanner。

## Sources
默认扫描目录和支持的原始文件格式。

## SQLite Locator Fields
说明该 scanner 会写入哪些 locator 字段。

## Resolve Original Event
说明如何通过 event_locator_json 找回原始 event。

## Commands
列出 resolve_event_source.py 的用法。

## Failure Modes
source_missing、hash_mismatch、unsupported_locator、permission_denied 的处理方式。

## Privacy
说明 raw content、redacted preview、hash 的边界。
```

## Scanner Contract

Core runtime 期望 scanner 实现：

```python
class SessionScanner(Protocol):
    provider: str
    scanner_id: str
    scanner_version: str

    def discover(self, request: ScanRequest) -> list[SessionRef]:
        ...

    def load(self, ref: SessionRef) -> SessionEnvelope:
        ...
```

`SessionRef.metadata` 必须包含：

```text
scanner_id
scanner_version
source_ref
source_fingerprint
source_size
source_mtime
```

`SessionEvent.metadata` 必须包含：

```text
event_locator_json
artifact_locator_json
content_hash
content_preview_redacted
```

## Resolver Contract

Core runtime 期望 resolver 实现：

```python
class SourceResolver(Protocol):
    scanner_id: str
    scanner_version: str

    def resolve_event(self, locator: EventLocator) -> ResolvedEvent:
        ...

    def verify_hash(self, resolved: ResolvedEvent, expected_hash: str) -> bool:
        ...
```

`ResolvedEvent` 至少包含：

```text
scanner_id
scanner_version
session_id
event_id
source_ref
content
content_hash
metadata
```

## resolve_event_source.py

脚本接口：

```bash
<runtime command> scanner resolve-event \
  --workspace . \
  --session-id session-alpha \
  --event-id u1
```

输出：

```text
scanner_id: codex
scanner_version: 0.1.0
source_ref: /Users/.../.codex/sessions/...
locator_schema: locator.codex_jsonl.v0
content_hash: sha256:...
hash_verified: true
preview: ...
```

## 错误类型

| Error | Meaning |
| --- | --- |
| `source_missing` | 原始文件不存在或已移动 |
| `artifact_missing` | 标准化 artifact 不存在 |
| `unsupported_locator` | locator schema 与 resolver 不匹配 |
| `hash_mismatch` | 读取到的内容 hash 与 SQLite 记录不一致 |
| `permission_denied` | 当前进程无法读取 source |

## 安装记录

安装 scanner pack 后，Local Analysis Ledger 需要记录：

```text
installed_scanners
scanner_capabilities
```

P0 可以先将 scanner capability 合并到 source layer，后续再拆出独立 capability 表。
