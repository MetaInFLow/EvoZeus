# __infra__

- Status: active
- Last updated: 2026-06-16

`__infra__/` 是 EvoZeus 的 Skill as Software 业务逻辑层，存放 Python runtime、业务模型、scanner framework、factor framework、TUI、companion 和自动化测试。

## Scope

| Path | Responsibility |
| --- | --- |
| `src/evozeus/` | Python package and runtime business logic |
| `src/evozeus/core/` | SessionEnvelope 等核心数据结构 |
| `src/evozeus/scanners/` | 多厂商 session scanner adapter 和 registry |
| `src/evozeus/factors/` | Factor manifest、抽象基类、registry、runner 和 result contract |
| `src/evozeus/runtime/` | `.evozeus/runtime` 下载资产和本地状态路径 |
| `src/evozeus/storage/` | session、event、factor result 的持久化 adapter |
| `tests/` | Python tests for runtime behavior |

## Runtime Asset Layout

用户下载的 scanner 和 factor pack 放在本地 runtime，不进入主代码目录：

```text
.evozeus/
  runtime/
    scanners/
      installed/<provider>/<version>/
    factors/
      installed/<factor_id>/<version>/
    index/
  sessions/<session_id>/
    session-envelope.json
    events.jsonl
    factor-results.jsonl
```

主代码只负责框架、协议、runner 和 storage。下载资产由 manifest 描述，由 registry 选择，由 runner 执行。

## Design Patterns

| Area | Pattern | Reason |
| --- | --- | --- |
| Scanner | Adapter + Registry | Codex、Claude Code、Cursor 等厂商输入格式不同，统一输出 `SessionEnvelope` |
| Factor | Abstract Base Class + Template Method | 每个 factor 只实现 `run()`，通用校验、错误隔离和结果规范由框架处理 |
| Runner | Serial Pipeline | P0 优先可复现和可调试，同一 stage 内并发放到后续版本 |
| Storage | Repository Pattern | P0 用 JSON/JSONL 文件，后续可换 SQLite index |

## Boundary

- 根目录保留 README、SKILL、docs、cases、factors、patterns 和治理入口。
- `__infra__` 不存放公开案例库、文档叙事或社区治理规则。
- 本地运行产物仍写入 `.evozeus/`，不写入 `__infra__`。

## Run

From repository root:

```bash
python -m pytest
evozeus status
```
