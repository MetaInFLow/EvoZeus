# __infra__

- Status: active
- Last updated: 2026-06-16

`__infra__/` 是 EvoZeus 的 Skill as Software 业务逻辑层，存放 Python runtime、业务模型、factor runner、TUI、companion 和自动化测试。

## Scope

| Path | Responsibility |
| --- | --- |
| `src/evozeus/` | Python package and runtime business logic |
| `tests/` | Python tests for runtime behavior |

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
