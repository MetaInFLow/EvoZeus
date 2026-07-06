# 对内-未审核-EvoZeus CLI Capability Router Design Doc v0.2

- Status: draft
- Owner: MetaInFlow
- Last updated: 2026-07-04
- Scope: `evozeus` 本地 CLI、capability router、session 分析、协同进化 harness 路由、维护类能力
- Linked design: [Design Doc v0.1 Agent Session Judgment Layer](design_doc-v0.1-agent-session-judgment-layer.md)
- Linked positioning: [EvoZeus Product Matrix Positioning](../../../../../00-global/evozeus-product-matrix-positioning.md)
- Linked closeout: [EvoZeus Implementation Closeout 与真实测试准入](../../../../../docs/development-direction/evozeus-implementation-closeout-real-testing.md)

本文是 EvoZeus 从 install skill handoff 进入真实本地使用的 CLI 设计文档。它不是对外营销文案，也不是 wrapper、infra 或 web 的替代设计。

## 1. 背景

v0.1 的主入口仍偏向一句 agent prompt:

```text
Read this repository's SKILL.md and judge the current Agent Session with EvoZeus.
```

这个入口适合解释 judgment layer，但不够支撑真实测试。原因是：

1. 用户安装后不知道 EvoZeus 当前能做哪些功能。
2. agent 缺少稳定、结构化、可测试的本地操作面。
3. session 分析、协同进化 harness、更新、卸载等动作风险等级不同，不应该混成一个自然语言指令。
4. `evozeus` 已被定义为本地 skeleton、主入口和编排核心，需要有一个实际的 `main()` 承接能力选择。

因此 v0.2 的核心改动是引入本地 CLI:

```text
web /skill
  -> local agent installs .evozeus skeleton
  -> .evozeus/bin/evozeus becomes the local operation surface
  -> agent describes capabilities first
  -> user selects a capability
  -> CLI routes to session / harness / doctor / update / uninstall
```

## 2. 一句话定义

EvoZeus CLI 是 install skill 落地后的本地 Agent Surface。它用结构化 capability manifest 告诉 agent 当前能做什么、需要什么权限、会写什么文件，并把用户选择路由到 session 分析、协同进化 harness 或维护动作。

## 3. 设计原则

1. CLI 是本地主入口，不是传统全局安装软件。
2. install skill 仍是首次进入方式，CLI 承接安装后的日常操作。
3. CLI 默认 dry-run 和 read-only，写入、扫描、网络发布必须显式批准。
4. agent 必须先 describe capabilities，再选择具体 operation。
5. 所有 agent 可用输出必须支持 JSON envelope，不能依赖自然语言 stdout。
6. `evozeus` 负责编排和权限边界，`evozeus-infra`、`EvoZeus-wrapper`、signal skill 只在明确场景下被调用。
7. P0 不引入 daemon、MCP server、TUI、cloud sync 或全局 npm publish。

## 4. 目标与非目标

### 4.1 P0 目标

| 目标 | 说明 | 验收 |
| --- | --- | --- |
| 本地 CLI 入口 | 安装后生成 `~/.evozeus/bin/evozeus` | fresh user home 可执行 `~/.evozeus/bin/evozeus capabilities --json` |
| Capability manifest | 列出可用能力、风险、权限、输入输出 | agent 能基于 JSON 选择下一步 |
| Session 分析入口 | 支持用户显式提供 session 文本或文件 | 输出 Session Verdict Card JSON/Markdown，不默认扫描 runtime |
| Harness attach 入口 | 支持指定 Skill / plugin / repo 进入协同进化 handoff | 输出 wrapper handoff plan，不默认发 issue/PR |
| Doctor / update / uninstall | 支持检查、更新计划、卸载计划 | 默认 dry-run，approved write 才写本地状态 |
| 审计与权限 | 高风险动作明确 approval gate | 测试覆盖无批准不写入、不扫描、不发布 |

### 4.2 P0 非目标

- 不实现完整 TUI。
- 不实现 daemon / background service。
- 不实现 MCP server。
- 不自动读取 `~/.codex/sessions` 或其它 agent raw store。
- 不自动 clone、checkout、push、创建 GitHub issue / PR / release。
- 不把 `evozeus-infra` 变成默认第一入口。
- 不把 `EvoZeus-wrapper` 变成 session 分析器。
- 不发布 npm global package 作为第一版安装前提。

## 5. 用户旅程

### 5.1 首次安装

```text
User
  -> copies install skill from evozeus-web /skill
  -> local agent runs install flow
  -> EvoZeus writes .evozeus skeleton after approval
  -> install report points to .evozeus/bin/evozeus
  -> agent runs evozeus capabilities --json
  -> user chooses a capability
```

### 5.2 安装后的功能选择

CLI 展示的第一屏能力不是营销菜单，而是可执行 capability manifest:

```text
1. Analyze Agent Session
2. Attach Co-evolution Harness
3. Check / Repair EvoZeus
4. Update EvoZeus
5. Uninstall / Archive EvoZeus
```

agent 应基于 manifest 向用户确认：

- 本次要做什么。
- 需要读取什么输入。
- 是否会写本地文件。
- 是否需要网络或 GitHub。
- 是否需要调用 infra / wrapper。

## 6. CLI 命令设计

### 6.1 P0 命令

| 命令 | Operation | 默认写入 | 风险等级 | 说明 |
| --- | --- | --- | --- | --- |
| `evozeus capabilities --json` | `capabilities.describe` | no | low | 返回 capability manifest |
| `evozeus activate --json` | `workspace.activate` | no | low | 汇总本地状态和推荐下一步 |
| `evozeus session analyze --input <path|-> --json` | `session.analyze` | no | medium | 分析用户显式输入的 session |
| `evozeus session scan --dry-run --json` | `session.scanPlan` | no | high | 仅输出本地扫描计划，不读取 raw store |
| `evozeus harness attach --target <path|url> --json` | `harness.attachPlan` | no | medium | 输出协同进化 harness handoff plan |
| `evozeus doctor --json` | `system.doctor` | no | low | 检查安装、组件和 optional path |
| `evozeus update --dry-run --json` | `system.updatePlan` | no | medium | 输出更新计划 |
| `evozeus update --approve-write --json` | `system.updateApply` | yes | high | 执行已批准的本地更新 |
| `evozeus uninstall --dry-run --json` | `system.uninstallPlan` | no | high | 输出删除、保留、归档清单 |
| `evozeus uninstall --approve-write --json` | `system.uninstallApply` | yes | high | 执行已批准的本地清理 |

### 6.2 P1 命令

| 命令 | 说明 |
| --- | --- |
| `evozeus op describe --json` | generic describe，等价于 capabilities 的协议化版本 |
| `evozeus op call <operation> --input-json '{}' --context-json '{}'` | generic operation escape hatch |
| `evozeus audit list --json` | 查看本地审计日志 |
| `evozeus approvals list --json` | 查看待批准动作 |
| `evozeus approvals respond --input-json '{}' --json` | 响应待批准动作 |

P0 可以先不实现 generic `op call`，但 capability manifest 的数据结构必须按 operation 思路设计，避免后续返工。

## 7. Capability Manifest

`capabilities.describe` 是 agent 操作 EvoZeus 前的真相源。README、help 文案和官网都不能替代 manifest。

每个 capability 至少包含：

```json
{
  "name": "session.analyze",
  "domain": "session",
  "summary": "Analyze an explicit Agent Session input and produce a Session Verdict Card.",
  "input_schema": {
    "type": "object",
    "required": ["input"],
    "properties": {
      "input": { "type": "string" },
      "input_kind": { "enum": ["stdin", "file", "inline_text"] }
    }
  },
  "output_schema": {
    "type": "object",
    "required": ["verdict_card", "privacy", "artifact_route"]
  },
  "write_mode": "read_only",
  "risk_level": "medium",
  "required_permissions": ["session.readExplicitInput"],
  "requires_approval": false,
  "examples": [
    "evozeus session analyze --input session.md --json"
  ]
}
```

### 7.1 Risk level

| Risk | 含义 | 示例 |
| --- | --- | --- |
| `low` | 只读本地 EvoZeus 状态，不读用户私有材料 | capabilities、doctor |
| `medium` | 读取用户显式指定输入，默认不写入 | session analyze、harness attach plan |
| `high` | 可能扫描本地 raw store、写文件、改 repo、联网或删除 | scan、update apply、uninstall apply、GitHub publish |

### 7.2 Write mode

| Mode | 含义 |
| --- | --- |
| `read_only` | 不写任何文件 |
| `plan_only` | 只输出计划，不执行 |
| `approved_local_write` | 用户批准后写本地 `.evozeus` |
| `approved_external_write` | 用户批准后写外部系统，例如 GitHub |
| `forbidden_in_p0` | P0 禁止执行，只能解释为什么 |

## 8. JSON Envelope

所有 `--json` 输出使用统一 envelope:

```json
{
  "ok": true,
  "operation": "capabilities.describe",
  "schema_version": 1,
  "actor": {
    "type": "agent",
    "id": "unknown"
  },
  "workspace": {
    "root": "/path/to/workspace",
    "evozeus_root": "/path/to/workspace/.evozeus"
  },
  "approval": {
    "required": false,
    "reason": null
  },
  "data": {}
}
```

错误输出:

```json
{
  "ok": false,
  "operation": "session.analyze",
  "schema_version": 1,
  "error": {
    "code": "MISSING_EXPLICIT_INPUT",
    "message": "session.analyze requires --input <path|->.",
    "recoverable": true
  }
}
```

规则：

1. secret、raw session、private path 不进入错误 message。
2. `--json` 输出必须可被 `JSON.parse` 解析。
3. 人类可读输出只用于无 `--json` 场景。
4. 执行失败时 process exit code 非 0。

## 9. 权限与审批模型

P0 不做复杂 RBAC，但要保留清晰的 permission gate。

| Permission | 说明 | 默认 |
| --- | --- | --- |
| `system.read` | 读取 `.evozeus` manifest、registration、version | allowed |
| `session.readExplicitInput` | 读取用户显式传入的 session 文件或 stdin | allowed |
| `session.scanLocalStore` | 扫描本地 agent runtime/session store | approval required |
| `system.writeLocal` | 写 `.evozeus` skeleton、manifest、audit | approval required |
| `repo.inspectTarget` | 读取用户指定 repo/skill/plugin 的基本结构 | approval required if outside workspace |
| `repo.writeDraft` | 生成 wrapper handoff draft | approval required |
| `external.githubWrite` | 创建 issue、PR、release 或 comment | forbidden in P0 |
| `system.deleteLocal` | 删除或归档 `.evozeus` | approval required |

审批不是 CLI 交互弹窗，而是 agent-human protocol：

```text
CLI returns approval.required = true
  -> agent explains requested permission and affected paths
  -> user approves
  -> agent reruns command with --approve-write or approved flag
```

## 10. 业务能力边界

### 10.1 Session 分析

P0 支持：

- `--input -` 从 stdin 读取用户粘贴内容。
- `--input <file>` 读取用户显式指定文件。
- 输出 Session Verdict Card。
- 输出 artifact route 建议。
- 输出 privacy note。

P0 不支持：

- 默认读取 `~/.codex/sessions`。
- 默认运行 scanner / FactorRunner。
- 默认保存 raw session。
- 自动提交到 GitHub。

后续如果要进入 local scan，必须通过 `session.scan --dry-run` 先产出计划：

```text
what path will be read
what file type will be parsed
what redaction will be applied
what artifact will be written
how to abort
```

### 10.2 协同进化 Harness

P0 支持：

- 用户显式指定 Skill / plugin / repo path 或 GitHub URL。
- 检查 target 类型。
- 生成 wrapper handoff plan。
- 说明需要的后续 approval。

P0 不支持：

- 默认 clone repo。
- 默认写入 target repo。
- 默认创建 issue / PR。
- 默认发布 release。

handoff plan 至少包含：

```json
{
  "target": {
    "kind": "skill",
    "ref": "/path/to/skill"
  },
  "recommended_route": "EvoZeus-wrapper",
  "next_actions": [
    "confirm target owner",
    "redact private examples",
    "generate feedback issue draft",
    "prepare design doc / PR plan"
  ],
  "approval_required_for": [
    "repo write",
    "github issue",
    "pull request",
    "release"
  ]
}
```

### 10.3 维护类能力

维护能力不是主业务功能，但必须支撑真实软件生命周期。

| 能力 | 输出 |
| --- | --- |
| `doctor` | 当前安装状态、组件状态、optional path warnings |
| `update --dry-run` | source ref、待更新文件、风险、回滚建议 |
| `update --approve-write` | update report、audit record |
| `uninstall --dry-run` | 删除、保留、归档清单 |
| `uninstall --approve-write` | uninstall report、保留路径提示 |

## 11. 本地文件结构

安装后的推荐结构：

```text
.evozeus/
  bin/
    evozeus
  skeleton/
    SKILL.md
    README.md
    skills/
    docs/
    scripts/
      evozeus-cli.mjs
      evozeus-install.mjs
      evozeus-doctor.mjs
      lib/
        capabilities.mjs
        envelope.mjs
        permissions.mjs
        operations/
          session-analyze.mjs
          harness-attach.mjs
          update.mjs
          uninstall.mjs
  registration.json
  install-manifest.json
  audit.ndjson
```

说明：

- `.evozeus/bin/evozeus` 是本地 shim，避免全局安装。
- `skeleton/scripts/evozeus-cli.mjs` 是 CLI 主实现。
- `capabilities.mjs` 是 capability manifest 真相源。
- `audit.ndjson` 只记录批准后的写入动作，不记录 raw session。

## 12. 安装器改动

`scripts/evozeus-install.mjs` 需要从“复制 skeleton + 输出下一句 judgment command”改成：

1. 复制 CLI 所需文件。
2. 创建 `~/.evozeus/bin/evozeus` shim。
3. 写入 install manifest 中的 CLI 版本和 capabilities hash。
4. `next_command` 改为：

```text
Run ~/.evozeus/bin/evozeus capabilities --json, show the available EvoZeus capabilities, then ask the user which path to take. Do not scan local sessions, write files, or submit to GitHub unless the user explicitly approves the specific action.
```

## 13. 与组件的关系

| 组件 | CLI 中的位置 | 边界 |
| --- | --- | --- |
| `evozeus` | CLI、capability router、install skeleton、permission gate | 产品主入口 |
| `evozeus-infra` | `session.scan`、future runtime/factor path 的 optional executor | 不默认扫描，不定义产品语义 |
| `EvoZeus-wrapper` | `harness.attach` 的 recommended route | 不做 session judgment |
| `evozeus-session-signal-skill` | `session.analyze` 的 optional signal method | 不做最终 verdict |
| `evozeus-web` | `/skill` 分发 install skill | 不执行 CLI，不扫描本地 |

## 14. 测试计划

P0 最小测试：

```bash
npm run test:cli
npm run test:install
npm run test:doctor
npm run test:github-gates
```

新增测试覆盖：

| 测试 | 断言 |
| --- | --- |
| CLI help | 不 crash，不输出 raw secret |
| capabilities JSON | 可 parse，包含 P0 operations、risk、permission、examples |
| install creates shim | dry-run 不写，approve-write 后生成 `.evozeus/bin/evozeus` |
| session analyze explicit input | 只读取指定输入，输出 verdict envelope |
| session analyze missing input | 返回结构化错误 |
| session scan dry-run | 不读取 raw store，只输出计划 |
| harness attach plan | 不写 target repo，不创建 issue/PR |
| update dry-run | 不写文件，只列计划 |
| uninstall dry-run | 不删除文件，只列清单 |
| approval gate | 无 `--approve-write` 时 high-risk operation 不执行 |

真实测试对应 closeout 的 T01、T02、T03、T04、T06、T09、T10。

## 15. 实施顺序

1. 新增 `scripts/evozeus-cli.mjs` 和 capability registry。
2. 新增 CLI 单元测试，先覆盖 `capabilities --json`、错误 envelope、help。
3. 改 installer，安装 `.evozeus/bin/evozeus` shim。
4. 实现 `activate`、`doctor` 路由，复用现有 doctor 语义。
5. 实现 `session analyze` 的 explicit input P0。
6. 实现 `harness attach` 的 plan-only P0。
7. 实现 `update/uninstall` 的 dry-run P0。
8. 更新 install skill、README 和 web `/skill` 文案中的 next command。

## 16. 验收标准

P0 完成必须满足：

1. fresh workspace 安装后可以运行 `.evozeus/bin/evozeus capabilities --json`。
2. capability manifest 能解释两个业务功能方向：session 分析、协同进化 harness。
3. 维护能力包含 doctor、update dry-run、uninstall dry-run。
4. 所有 high-risk operation 默认不执行，只输出 plan 或 approval-required。
5. `session analyze` 不会在用户未指定输入时读取本地 session。
6. `harness attach` 不会在 P0 默认写目标 repo 或发 GitHub。
7. `npm run test:cli && npm run test:install && npm run test:doctor` 通过。
8. closeout 真实测试 T01、T03、T04、T06、T09、T10 有对应 CLI 路径。

## 17. 待确认问题

以下问题不阻塞 P0 design，但会影响后续实现深度：

1. CLI 名称是否直接占用 `evozeus`，还是 P0 使用本地路径 `.evozeus/bin/evozeus`，后续再考虑全局命令。
2. `session analyze` 的 P0 输出是只给 JSON，还是同时生成 Markdown Verdict Card。
3. `harness attach` 是否需要在 P0 写入 `.evozeus/handoffs/*.json`，还是只输出 stdout plan。
4. update 的 source of truth 是本地 install source、GitHub release，还是 web `/skill` 提供的 pinned ref。
5. 是否需要为 CLI 单独建立 ADR，记录“不引入 daemon/global install/MCP”的架构决策。

## 18. 结论

EvoZeus v0.2 应采用 CLI-first 的本地 Agent Surface。install skill 负责把用户带到本地，CLI 负责能力发现、权限边界、结构化输出和功能路由。

P0 的正确收敛不是做一个完整运行时，而是先把这三件事做稳：

```text
capabilities describe
  -> user-approved capability selection
  -> plan-only or explicit-input execution
```

这能支撑真实测试，同时避免把 infra、wrapper、web 都误做成平级产品入口。
