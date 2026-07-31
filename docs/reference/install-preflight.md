# EvoZeus Stable 安装预检与本机状态路由（正式内部执行版）

- Status: active
- Last updated: 2026-07-31
- Audience: 安装入口维护者、Release 维护者、本地 Agent
- Purpose: 在任何产品下载、解压、注册或 `~/.evozeus` 写入前，形成唯一、可验证的安装决策

## 核心契约

安装入口必须先识别本机状态，再决定后续路径。`scripts/evozeus-install-preflight.mjs` 是依赖与状态判断的可执行真相源，输出遵循 `schemas/install-preflight.schema.json`。

预检只支持不可变 Stable。UAT 必须在 Stable 安装完成后，通过已安装的渠道流程进入。

预检输出唯一环境结论：

- `ready`
- `ready_with_fallbacks`
- `blocked`

本机状态输出唯一决策：

| 本机状态 | 后续动作 |
| --- | --- |
| `not_installed` | 请求 fresh install 批准；只有该状态可进入 bootstrap installer |
| `healthy_current` | 报告 no-op；不下载产品、不写文件、不注册 Plugin |
| `update_available` | 进入已安装产品的 update / align 路径并单独请求批准 |
| `repair_required` | 保留当前可用版本和 rollback 证据，进入 repair 路径 |
| `legacy_migration_required` | 进入 migration 路径，不调用 fresh installer |
| `unknown_or_unverifiable` | 停止，补齐本机版本、Doctor 或渠道证据 |

## Step 0 顺序

1. 检查 `EVOZEUS_HOME`，默认目标为 `~/.evozeus`。
2. 检查 `~/.evozeus/bin/evozeus` 和关键本机状态文件。
3. 已有 CLI 时，先验证 active/channel manifest digest、install root、component root 和 CLI 路径均位于 `EVOZEUS_HOME` 的可信 regular 路径内，再禁用自动更新并直接运行 `version --json`、`doctor --json`；证据失败时禁止执行该 CLI。
4. 用 payload-free Stable HEAD 获取最新正式版本证据。
5. 将本机结果归入六种状态之一。
6. 只有 fresh candidate 才进入预取 gate；已有安装直接走 no-op、update、repair、migration 或停止路径。

## 两阶段预检

### 1. Pre-fetch gate

公共 `/skill` 内联调用 `scripts/evozeus-install-prefetch.sh` 的等价逻辑。它在任何 checker 或产品 asset GET 前运行，只读取本机环境；失败报告必须满足：

- `stage=pre_fetch`
- `writes=false`
- `asset_get_count=0`
- `payloads_saved=0`
- `product_assets_downloaded=0`

通过后只允许获取两个独立的 bootstrap 资产：`evozeus-install-preflight.mjs` 与匹配的 `.sha256`。这两次 GET 属于 checker 下载，必须显式计数，不能记为产品下载。checker 必须在执行前完成 SHA-256 校验。

### 2. Full checker

校验后的 checker 运行方式：

```bash
/bin/sh evozeus-install-preflight.mjs \
  --evozeus-home "${EVOZEUS_HOME:-$HOME/.evozeus}" \
  --channel stable \
  --checker-asset-get-count 2 \
  --json
```

已安装版本或可信本地 Release 直接执行 checker 时，`--checker-asset-get-count` 为 `0`。完整报告始终满足：

- `stage=full`
- `writes=false`
- `target.channel` 与请求渠道绑定
- `target.evozeus_home` 与目标目录绑定
- `local_state.preliminary=false`
- `product_assets_downloaded=0`

## 正式依赖清单

| 依赖或环境 | 最低版本 | fresh / update 要求 | fallback 或条件 | 使用阶段 | 修复建议 |
| --- | --- | --- | --- | --- | --- |
| OS / arch | macOS 或 Linux；x86_64 / arm64 | required | 无 | 产品安装 | 使用支持的系统和架构 |
| Node.js | 18.17.0 | required | 无 | checker 与产品 CLI | 安装或升级 Node.js |
| 下载工具 | 无 | required one-of | `gh` 优先，`curl` fallback | checker / 产品下载 | 安装 GitHub CLI 或 curl |
| SHA-256 工具 | 无 | required one-of | macOS 优先 `shasum`；Linux 优先 `sha256sum` | checker / 产品校验 | 安装任一 SHA-256 工具 |
| `tar` | 无 | required | 无 | 产品解压 | 安装 tar |
| Agent Host | 当前可执行版本 | required one-of | Codex 或 Claude Code | Plugin 注册 | 安装并将 Host CLI 暴露到 PATH |
| Python | 3.11.0 | 当前 Stable 产品 required | schema 中标记 conditional，当前 Runtime、Session Signal、CoEvolve smoke 会使用 | 安装后 Doctor 与组件 smoke | 安装或升级 Python |
| Git | 无 | Stable fresh optional | UAT 与 Git-backed maintenance 才需要 | 后续维护 | 进入相关路径前安装 Git |
| 临时目录权限 | R/W/X | required | 无 | checker / 产品临时工作区 | 恢复目录访问权限 |
| 目标父目录权限 | R/W/X | required | 无 | Stable 安装 | 恢复 `~/.evozeus` 父目录访问权限 |
| 临时与目标空间 | 各 512 MiB | required | 无 | 下载、校验、解压、原子切换 | 释放空间后重跑 |
| GitHub 网络 | HTTPS HEAD 可达 | required | payload-free HEAD | Stable Release 解析 | 恢复 GitHub HTTPS/API 访问 |

`healthy_current` 的产品安装依赖全部标记为 `conditional`、`required=false`、`status=not_run`。该状态只保留直接本机健康证据和 Stable HEAD 证据。

## Installer 消费边界

`scripts/evozeus-install.mjs` 的 dry-run 与 `--approve-write` 都只接受满足以下全部条件的报告：

- 生成时间不超过 1 小时，且未来偏差不超过 5 分钟；
- `target.channel=stable`，`target.evozeus_home` 与本次目标完全一致；
- `local_state.status=not_installed` 且 `preliminary=false`；
- `status` 为 `ready` 或 `ready_with_fallbacks`；
- `blockers=[]`；
- `next_action.action=request_fresh_install_approval`；
- 唯一 `github_network` check 为 `pass`，其 Stable tag 与 Release 安装的 `--release-tag` 完全一致；
- 预检期间没有产品资产下载。

repair、migration、update 和 healthy no-op 报告均不能复用 fresh installer。

Installer 在批准写入前立即重新运行本机状态检查，防止预检后状态发生变化。fresh 目标只允许两种磁盘状态：`EVOZEUS_HOME` 不存在，或已存在且严格为空目录。预先存在的 `skeleton`、`update-policy.json`、未知 entry、dangling link、任意目标 marker symlink、目录组件 symlink 或外部 component root 都必须稳定归入 `unknown_or_unverifiable`，失败时不产生 installer 写入。

## Preflight 与 Doctor 的边界

Preflight 回答“当前能否安全进入下一条安装状态路径”，执行时不修改产品。Doctor 回答“安装后的组件、渠道、Plugin 和 Runtime 是否完整一致”。安装完成仍必须运行 Doctor，`ready` 或 `ready_after_new_session` 才可视为安装链路通过。
