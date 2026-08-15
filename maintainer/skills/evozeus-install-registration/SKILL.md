---
name: evozeus-install-registration
description: Use when 注册用户级 EvoZeus home、为 Codex 或 Claude Code 安装唯一活动 EvoZeus 插件、对齐 Stable/UAT，或校准既有安装时使用。
---

# EvoZeus 安装与注册

此 Skill 负责从 `https://evozeus-community.vercel.app/skill` 开始的安装优先路径。本地 Agent 在写入前询问用户，安装或恢复 `~/.evozeus`，然后将已验证的产品频道与 Codex、Claude Code 或两者中的一个活动 `evozeus` 插件对齐。完成这些动作后即停止，不进入判断、会话访问、目标 Repo 写入或 GitHub 发布。

## 触发场景

用户出现以下情况时使用此 Skill：

- 打开或复制社区 `/skill` 指令
- 要求加入、安装、注册、恢复或检查 EvoZeus
- 已有 `~/.evozeus`，希望确认 EvoZeus 是否已注册
- 在运行判断前，需要安装 EvoZeus skeleton 和场景 Skill

## 安装流程

```text
community /skill
  -> 读取此 Skill
  -> 读取 ../../../docs/reference/install-onboarding-conversation.md
  -> 步骤 0：解析 Release 前检查本地 CLI 和状态
  -> 已安装 CLI 存在时，直接运行 version、Doctor 和 Stable HEAD 检查
  -> 只选择一个本地状态；证据未知时停止
  -> 为全新候选运行只读 pre-fetch gate
  -> 获取并验证最小 checker，然后运行完整 Stable preflight
  -> 仅当状态为 not_installed 时解析最新不可变 EvoZeus Stable Release 资源和 checksum
  -> 解释注册价值、隐私边界和确认选项
  -> 在身份写入、网络注册、源文件写入或用户 home 写入前询问
  -> 使用已验证的 Release tag、commit 和 archive SHA-256 运行 installer
  -> 安装 bootstrap skeleton 和 ~/.evozeus/bin/evozeus
  -> 创建启用 Stable/UAT 自动检查的 update-policy.json
  -> 检测 Codex / Claude Code host
  -> 使用 Stable product manifest 运行 evozeus align --channel stable --host auto --approve-write
  -> 验证 Runtime 与唯一活动插件使用同一频道和 Commit
  -> 输出安装报告
  -> 运行 ~/.evozeus/bin/evozeus --help
  -> 运行 ~/.evozeus/bin/evozeus features --json
  -> 运行 ~/.evozeus/bin/evozeus capabilities --json
  -> 将相关产品能力翻译成贴合用户目标的自然语言
  -> 询问用户下一步要走哪条具体 EvoZeus 路径
```

## 状态校准

| 状态 | 动作 |
| --- | --- |
| `not_installed` | 全新 Stable 安装前先询问；bootstrap installer 只接受此状态 |
| `healthy_current` | 报告严格 no-op，不下载产品、不写入、不注册 Plugin |
| `update_available` | 使用已安装的 update / align 路由，并单独请求确认 |
| `repair_required` | 保留当前根目录和回滚证据；先 dry-run `align`，确认后在新根目录重新物化同一已验证 manifest |
| `legacy_migration_required` | 使用迁移路由；不要调用全新 installer |
| `unknown_or_unverifiable` | 停止并指出缺少的本地版本、Doctor、manifest 或频道证据 |

## 强制步骤 0 与 Preflight

开始安装工作前，完整读取 `../../../docs/reference/install-preflight.md`。

任何 Release 解析或资源 GET 前，检查 `EVOZEUS_HOME`（默认 `~/.evozeus`）、`bin/evozeus`、`active-channel.json`、`channel-state.json` 和旧版安装标记。

当 `~/.evozeus/bin/evozeus` 存在时，收集直接本地证据期间关闭自动刷新和活动反馈：

```bash
EVOZEUS_AUTO_UPDATE=0 EVOZEUS_AUTO_UPDATE_CHILD=1 ~/.evozeus/bin/evozeus version --json
EVOZEUS_AUTO_UPDATE=0 EVOZEUS_AUTO_UPDATE_CHILD=1 ~/.evozeus/bin/evozeus doctor --json
```

使用无 payload 的 HEAD 解析最新 Stable tag，并比较 semantic version。健康且当前的结果到此结束。缺少安装或更新依赖时，仍保持 no-op，不要转为修复或安装尝试。

对于 `repair_required`，先不带确认运行已安装的频道命令：

```bash
~/.evozeus/bin/evozeus align --channel <stable|uat> --host auto --manifest <verified-channel-manifest> --json
```

计划必须报告 `decision=repair` 和 `writes_now=false`。获得明确确认后，使用 `--approve-write` 重跑。修复会将同一组已验证组件版本下载或 checkout 到新的隔离根目录，验证必要路径、固定 smoke check、内嵌组件、兼容性、current link 绑定和 dispatcher 状态，然后原子切换频道状态。获取 manifest 前，计划会拒绝频道存储、UAT Git cache、skeleton 脚本、hooks、Plugin host marketplace、频道 Runtime 状态和迁移备份中的符号链接或非目录写入前缀。Bootstrap 刷新会准备完整 scripts 目录，保留非 bootstrap 文件并原子替换。产品切换后若 Plugin 对齐失败，先恢复此前的频道状态、current link、dispatcher、bootstrap 脚本和 Plugin 对齐，再报告 `failed_continuing_previous`；任何未验证的恢复都报告 `failed_recovery_required`。此前的根目录保留为回滚证据。切换后运行 Doctor。

`decision=unsafe_stop` 对本次尝试是终态。持久化 JSON/schema 无效、根目录位于 home 外、此前根目录不安全，或控制/组件证据是符号链接时，必须在获取 manifest 或写入前停止。重试前先收集可信的本地证据。

对于全新候选，在任何 checker 或产品资源 GET 前运行公开的 inline pre-fetch gate。被阻止的 gate 必须报告零 GET 和零写入。通过的 gate 只允许以下 bootstrap 下载：

- `evozeus-install-preflight.mjs`
- `evozeus-install-preflight.mjs.sha256`

将两次传输都称为 checker 下载，在完整报告中计数，并在执行前验证 checker SHA-256。然后运行：

```bash
/bin/sh evozeus-install-preflight.mjs --evozeus-home "${EVOZEUS_HOME:-$HOME/.evozeus}" --channel stable --checker-asset-get-count 2 --json
```

Preflight v1 只支持 Stable。Stable 健康后，UAT 仍通过已安装的频道工作流使用。不要用 Stable Release HEAD 替代 UAT manifest 源。

## 源材料

bootstrap installer 必须从已验证的自定义 EvoZeus Release archive 运行。公开路径需要匹配的 `.sha256` Artifact 和 `evozeus-product-stable.json`。不要回退到 `main`、移动分支、未发布 commit 或 GitHub 自动生成的 source archive。

明确报告安装材料：

- `release_archive`：用于 bootstrap 和 Stable Core 安装的已验证自定义 Release asset。
- `product_manifest`：包含精确 commit 和 SHA-256 值的不可变 Stable 组件映射。

已有 checkout 可以帮助维护者检查代码，但不能作为 Stable 用户安装源。

## 允许写入的本地文件

只有获得用户确认后，安装路径才可以写入：

| 文件 | 用途 |
| --- | --- |
| `~/.evozeus/registration.json` | 用户级注册状态、注册 id、Agent 身份 pointer |
| `~/.evozeus/install-manifest.json` | skeleton 源、解析出的 commit、已安装 Skill 清单、最近检查时间 |
| `~/.evozeus/update-policy.json` | 自动更新开关、一小时间隔、各频道订阅 |
| `~/.evozeus/skeleton/` | EvoZeus 根 `SKILL.md`、场景 Skill、参考文档以及 install / doctor 脚本的本地副本 |
| `~/.evozeus/bin/evozeus` | 用于能力发现和已确认 P0 操作的本地 CLI shim |
| `~/.evozeus/releases/stable/` | 由 product manifest 选择的不可变 Stable 组件 archive |
| `~/.evozeus/channel-state.json` | Stable/UAT 已安装 manifest 和回滚 pointer |
| `~/.evozeus/active-channel.json` | 活动 Stable 或唯一 UAT 选择 |
| `~/.evozeus/hosts/` | 生成的 Codex/Claude marketplace、唯一活动插件 bundle 和对齐证据 |

已确认的对齐也可能要求检测到的 host CLI 注册本地 EvoZeus marketplace，并重新安装 plugin id `evozeus`。不要创建 `evozeus-uat`、`evozeus-stable` 或第二个用户可见的 UAT 插件。

首次确认安装也会启用活动频道内未来的已验证自动更新。确认前解释这一点。Stable 跟随最新不可变 Release；UAT 跟随唯一可变的 `uat/current`。自动更新不会切换频道、发布 Repo 或上传用户数据。用户可以在 `~/.evozeus/update-policy.json` 中关闭或配置此行为。

只有获得用户确认后，安装路径才可以创建或复用 `~/.evozeus/agent-identity.json` 并调用 EvoZeus Web registration API。注册只传 hash，不得上传原始会话、私有路径、token、workspace 内容、客户数据或未发布代码。

只有获得单独的用户确认后，本地能力才可以向 EvoZeus Web activity API 发送安全活动反馈。活动反馈可以包含 Runtime hash、Agent handle、能力名称、事件类型、明确标记为公开时的 GitHub 目标 URL 和脱敏摘要。不得上传原始会话、私有路径、token、workspace 内容、客户数据或未发布代码。

安装期间不要创建 `~/.evozeus/runtime/`、Runtime lockfile、本地扫描输出、Factor 结果、报告文件、GitHub issue 或 PR。

## 注册对话参考

请求注册或安装确认前，读取：

```text
../../../docs/reference/install-onboarding-conversation.md
```

使用它解释：

- 加入 EvoZeus 会创建本地用户级身份和能力条目，不会上传原始会话
- 注册只涉及 hash 和安全元数据
- 本地写入目标是 `~/.evozeus/`
- 网络注册、活动反馈、扫描、报告和 GitHub 动作分别需要明确确认
- 用户可以选择 dry-run、已确认安装或状态检查

面向用户的第一段说明不要倾倒内部能力名称。先解释业务功能，确有必要时再给出精确命令。

公开复制提示必须保持为这一句简短交接文本：

```text
加入 EvoZeus: https://evozeus-community.vercel.app/skill
```

不要要求用户复制确认清单、隐私清单、命令清单或能力描述。这些细节属于此 Skill 和对话参考文件。

## 本地 Installer

用户确认本地写入后，从已解析的 EvoZeus Repo 运行 installer：

```bash
printf '%s\n' "<fresh-full-preflight-json>" | node scripts/evozeus-install.mjs --workspace "<target-workspace>" --source-root "<verified-release>/EvoZeus-vX.Y.Z" --release-tag "vX.Y.Z" --release-commit "<40-hex-release-commit>" --release-archive-sha256 "<verified-archive-sha256>" --preflight-stdin --approve-write
~/.evozeus/bin/evozeus align --channel stable --host auto --manifest "<verified-release>/evozeus-product-stable.json" --approve-write --json
```

没有确认时，先运行 dry-run：

```bash
printf '%s\n' "<fresh-full-preflight-json>" | node scripts/evozeus-install.mjs --workspace "<target-workspace>" --source-root "<verified-release>/EvoZeus-vX.Y.Z" --release-tag "vX.Y.Z" --release-commit "<40-hex-release-commit>" --release-archive-sha256 "<verified-archive-sha256>" --preflight-stdin
```

dry-run 不得写入 `~/.evozeus/`，只报告计划写入的文件和所需确认。它仍然需要同一份完整的全新 preflight，并且不得为既有安装规划校准。

已确认的 installer 会拒绝 preliminary、stale、blocked、wrong-target、wrong-channel、non-fresh 或 wrong-next-action 的 preflight 报告。报告超过一小时或目标发生变化时，重新运行完整 checker。

## 安装报告

安装或校准后，输出：

```text
注册状态 -> Skeleton 源 -> Skill 清单 -> 已写入文件 -> 下一条命令 -> 所需确认
```

installer 会以 JSON 输出此报告，Agent 可以据此总结，不要自行猜测。

安装后，在请求下一项确认前运行本地 help 和产品能力路由：

```bash
~/.evozeus/bin/evozeus --help
~/.evozeus/bin/evozeus version --json
~/.evozeus/bin/evozeus doctor --json
```

Doctor 必须报告 `ready` 或 `ready_after_new_session`。需要新会话时，告诉用户先打开新会话再测试 EvoZeus 发现能力；不要声称当前对话已经重新加载插件。

以 CLI help 作为已安装命令表面。然后运行：

```bash
~/.evozeus/bin/evozeus features --json
```

使用 `features --json` 作为产品菜单。然后运行：

```bash
~/.evozeus/bin/evozeus capabilities --json
```

使用 `capabilities --json` 作为写入模式、风险等级、确认要求和示例的来源。询问用户下一步前，使用 `../../../docs/reference/install-onboarding-conversation.md` 中固定的 `Post-Install Capability Template` 展示自然语言能力摘要：

| 产品能力 | 健康检查通过后的状态 |
| --- | --- |
| 复盘 Agent 会话 | 通过 `evozeus review session --input <path|-> --json` 接收用户明确提供的输入；默认不扫描本地存储 |
| 生成 Session Insights Report | 通过 `evozeus insights plan --source codex --json` 规划；单独确认后，从 Runtime checkout 执行 `evozeus-runtime session-insights --workspace "$HOME" --official-repo-root <EvoZeus-session-signal-skill>`，生成 `.evozeus/runtime/reports/ai-usage-profile/index.html` |
| 保存 Artifact 草稿 | 通过 `evozeus preserve draft --from-report <path> --json` 可用；不会上传或发布 |
| 接入 Co-evolution Harness | 通过 `evozeus coevolve attach --target <path|url> --json` 提供计划；默认不写入 Repo 或 GitHub |
| 检查/修复 EvoZeus | 通过 `evozeus doctor --json` 可用 |
| 对齐或更新 EvoZeus | 通过 `evozeus align --channel <stable|uat> --host auto --json` 提供 dry-run 计划；一次已确认事务会对齐 Runtime 和活动插件 |
| 卸载/归档 EvoZeus | 通过 `evozeus uninstall --dry-run --json` 提供 dry-run 计划；删除需要确认 |
| Workspace 扫描、Runtime 执行、对用户数据执行 Factor、报告文件、Artifact 保存、GitHub issue/PR/公开 Artifact | 安装不会启用；先请求用户明确确认，再路由到匹配的场景 Skill |

下一条命令应以产品能力为先：

```text
运行 ~/.evozeus/bin/evozeus --help，然后运行 ~/.evozeus/bin/evozeus features --json 和 ~/.evozeus/bin/evozeus capabilities --json。使用固定模板，将可用的 EvoZeus 产品能力转译为贴合用户当前业务目标的说明，推荐一条安全的下一步路径，并请用户选择。除非用户明确确认具体动作，否则不要扫描本地会话、写入文件或提交到 GitHub。
```

## 边界

- 不要从 `/skill` 直接运行判断；先询问用户。
- 不要安装或启用 Runtime、scanner、Factor runner、默认 official Factor、MCP、browser companion 或报告执行。
- 不要上传原始会话、私有路径、token、客户数据或 workspace 内容。
- 没有用户明确确认，不要创建 GitHub Issue、PR、branch、commit 或 push。
- 用户之后确认启用 Runtime 时，通过 `../evozeus-runtime-routing/SKILL.md` 路由。
