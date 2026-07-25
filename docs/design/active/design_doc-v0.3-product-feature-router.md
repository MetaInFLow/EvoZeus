# 对内-未审核-EvoZeus Product Feature Router Design Doc v0.3

- Status: implemented in main CLI, infra report contract remains backend-owned
- Owner: MetaInFlow
- Last updated: 2026-07-08
- Scope: EvoZeus 整体 CLI 功能列表、产品生命周期菜单、主 CLI 到 infra / wrapper 的路由、缺口修复计划
- Linked design: [CLI Capability Router v0.2](design_doc-v0.2-cli-capability-router.md)
- Linked positioning: [EvoZeus Product Matrix Positioning](../../../../../00-global/evozeus-product-matrix-positioning.md)
- Linked lifecycle: [EvoZeus Software Lifecycle](../../../../../docs/development-direction/evozeus-software-lifecycle.md)

本文定义 v0.3 的开发目标：把当前偏底层的 `capabilities` 列表升级为用户可理解的 EvoZeus 产品功能列表，同时保留 v0.2 的机器可读 capability manifest。主 CLI 负责产品编排和权限边界，`EvoZeus-infra` 与 `EvoZeus-CoEvolve` 仍是被路由的后端能力，不变成平级用户入口。

## 1. 真问题

当前 CLI 事实入口是：

```bash
evozeus capabilities --json
```

它能列出可执行 operation、risk、permission 和 examples，但它不是用户级产品菜单。结果是：

1. 用户看不到 EvoZeus 生命周期上的完整功能。
2. `wrapper` 被隐藏在 `harness.attachPlan` 里，无法直观看出它属于 `co-evolve`。
3. `EvoZeus-infra` 已经长出 session / project insights 报告能力，但主 `evozeus` CLI 没有把它挂成整体产品能力。
4. `session scan` 目前只是 scan plan，命名容易让用户误以为会直接扫描并出报告。
5. `capabilities` 被迫承担产品菜单职责，导致 agent 需要把实现词翻译成人话。

v0.3 要解决的核心矛盾：

```text
用户需要按产品目标选择功能
agent / runtime 需要按 capability contract 执行能力
```

因此必须分出两层：

```text
evozeus features       # 用户级产品功能列表
evozeus capabilities   # 机器级 capability manifest
```

## 2. 一句话定义

EvoZeus Product Feature Router 是安装后的产品菜单和组件路由层。它按 `discover -> install -> activate -> interact -> decide -> co-evolve -> maintain -> uninstall` 展示用户可选功能，并把每个功能映射到可执行 capability、后端 owner、审批边界和验证命令。

## 3. 设计原则

1. `evozeus` 是整体产品入口和编排核心，不是 infra、wrapper、web 的替代实现仓库。
2. `features` 面向用户和 agent 解释“能做什么”；`capabilities` 面向程序解释“怎么安全执行”。
3. 用户级命令使用产品语义，例如 `review`、`insights`、`coevolve`；实现级命令保留兼容，例如 `session analyze`、`harness attach`。
4. local scan、factor runner、ledger、report execution 属于 `EvoZeus-infra`，主 CLI 只做发现、计划、审批和路由。
5. feedback、issue、design doc、PR、CHANGELOG、release 属于 `EvoZeus-CoEvolve`，主 CLI 只做 `coevolve` 入口和 handoff plan。
6. 所有读取 raw session、写本地 report、打开 HTML、写 repo、创建 GitHub issue / PR / release 的动作都必须有明确审批边界。
7. 先兼容旧命令，再引入新命令；不能破坏已安装用户的 `capabilities` 和 `harness attach` 路径。

## 4. 产品功能列表

### 4.1 用户级功能

| Lifecycle | Feature id | 用户目标 | 主命令 | 当前状态 | Backend owner |
| --- | --- | --- | --- | --- | --- |
| Discover | `discover` | 理解 EvoZeus、获取 install skill | web `/skill` | 已在 web 侧承接 | `EvoZeus-web` |
| Install | `install` | 安装或修复本地 skeleton、CLI、skills | `evozeus install` | 缺主 CLI 命令，已有 install script / skill | `evozeus` |
| Activate | `activate` | 检查本地激活状态和下一步 | `evozeus activate` | 已有 | `evozeus` |
| Choose | `features` | 查看产品功能菜单 | `evozeus features` | 已实现 | `evozeus` |
| Review | `review.session` | 分析一个用户显式输入的 session | `evozeus review session --input <path|->` | 已实现为 `session analyze` 别名 | `evozeus` |
| Insights | `insights.sessions` | 扫描历史 sessions，复用 factor，按项目聚类，生成 HTML 报告 | `evozeus insights plan` / `evozeus insights sessions` | 主 CLI 已实现 plan/approval route，执行由 infra 承接 | `EvoZeus-infra` |
| Decide | `decide.route` | 给出 Verdict 和 Artifact Route | 内嵌在 `review` / `insights` 输出 | 部分已有 | `evozeus` |
| Preserve | `preserve.artifact` | 把结论沉淀成 Case / Factor / Habit / Rule / PR draft | `evozeus preserve draft` | 已实现隐私安全草稿输出 | `evozeus` |
| Co-evolve | `coevolve.target` | 给 Skill / plugin / repo 接入长期演进机制 | `evozeus coevolve attach --target <path|url>` | 已实现 attach/status/audit route | `EvoZeus-CoEvolve` |
| Maintain | `maintain` | doctor、update、component readiness、migration | `evozeus doctor` / `evozeus maintain ...` | doctor 已包含组件 readiness | 各组件 |
| Uninstall | `uninstall` | 卸载、归档、保留报告 | `evozeus uninstall` | 已有 plan，apply 弱 | `evozeus` |

### 4.2 用户级输出示例

无 `--json` 时，`evozeus features` 应输出稳定的人类可读菜单：

```text
EvoZeus Features

1. Activate workspace
   Command: evozeus activate --json
   Reads: EvoZeus local state only

2. Review one explicit session
   Command: evozeus review session --input <path|-> --json
   Reads: user-provided input only

3. Generate session insights report
   Command: evozeus insights plan --source codex --json
   Reads: no raw session during plan; scan requires approval

4. Preserve a Verdict / report as an artifact draft
   Command: evozeus preserve draft --from-report <path> --json
   Reads: explicit report path only

5. Co-evolve a Skill / plugin / repo
   Command: evozeus coevolve attach --target <path|url> --json
   Writes: no target repo writes by default

6. Maintain EvoZeus
   Command: evozeus doctor --json

7. Uninstall or archive EvoZeus
   Command: evozeus uninstall --dry-run --json
```

### 4.3 JSON contract

`evozeus features --json` 输出：

```json
{
  "ok": true,
  "operation": "features.describe",
  "schema_version": 1,
  "data": {
    "product_version": "0.3",
    "features": [
      {
        "id": "insights.sessions",
        "title_zh": "扫描历史 sessions 并生成项目洞察报告",
        "lifecycle_stage": "interact",
        "user_goal": "从历史 session 中发现可复用 insight、重复表达、项目差异和可进化点",
        "command": "evozeus insights plan --source codex --json",
        "backend_owner": "EvoZeus-infra",
        "status": "available",
        "approval_boundary": "scan requires explicit approval",
        "related_capabilities": ["insights.plan", "insights.sessions", "session.scanPlan"],
        "aliases": []
      }
    ]
  }
}
```

字段约束：

| Field | 说明 |
| --- | --- |
| `id` | 稳定 feature id，不随命令重命名改变 |
| `title_zh` | 用户可读中文标题 |
| `lifecycle_stage` | `discover/install/activate/interact/decide/coevolve/maintain/uninstall` |
| `user_goal` | 用户为什么要用这个功能 |
| `command` | 推荐入口命令 |
| `backend_owner` | `evozeus`、`EvoZeus-infra`、`EvoZeus-CoEvolve`、`EvoZeus-web` 等 |
| `status` | `available`、`alias`、`planned_route`、`missing`、`blocked` |
| `approval_boundary` | 读取、写入、网络、GitHub、删除的边界 |
| `related_capabilities` | 对应 v0.2 capability names |
| `aliases` | 旧命令或兼容命令 |

## 5. 命令面调整

### 5.1 P0 必须新增

| Command | Operation | 行为 |
| --- | --- | --- |
| `evozeus features` | `features.describe` | 人类可读产品菜单 |
| `evozeus features --json` | `features.describe` | JSON feature registry |
| `evozeus review session --input <path|-> --json` | `session.analyze` | 兼容别名，调用现有 explicit session analysis |
| `evozeus coevolve attach --target <path|url> --json` | `harness.attachPlan` | 兼容别名，输出 wrapper handoff plan |

### 5.2 P0 应保留

| Existing command | 保留原因 |
| --- | --- |
| `evozeus capabilities --json` | 机器协议真相源 |
| `evozeus session analyze --input <path|-> --json` | 兼容 v0.2 |
| `evozeus harness attach --target <path|url> --json` | 兼容 v0.2 和旧 agent |
| `evozeus session scan --dry-run --json` | 保留为 scan plan，但在 features 中不要叫“生成报告” |
| `evozeus doctor --json` | 维护入口 |
| `evozeus update --dry-run --json` | 维护入口 |
| `evozeus uninstall --dry-run --json` | 卸载入口 |

### 5.3 P1 新增路由

| Command | Operation | Backend | 默认行为 |
| --- | --- | --- | --- |
| `evozeus insights plan --source codex --json` | `insights.plan` | `EvoZeus-infra` | 不读取 raw session，只列 scan plan |
| `evozeus insights sessions --source codex --reuse-factors --html --json` | `insights.sessions` | `EvoZeus-infra` | 需要审批后读取 session、跑缺失 factor、写 report |
| `evozeus insights sessions --project <project-key> --json` | `insights.projectSessions` | `EvoZeus-infra` | 按项目过滤 / 聚类 |
| `evozeus insights open --latest` | `insights.openReport` | `EvoZeus-infra` | 只打开已存在报告，不重新扫描 |
| `evozeus preserve draft --from-report <path> --json` | `preserve.draft` | `evozeus` | 生成本地沉淀草稿，不发 GitHub |
| `evozeus coevolve status --target <path> --json` | `coevolve.status` | `EvoZeus-CoEvolve` | 读取 wrapper manifest 和状态 |
| `evozeus coevolve audit --target <path> --user-input <text> --json` | `coevolve.auditFeedback` | `EvoZeus-CoEvolve` | 只生成 issue draft，不写 GitHub |

## 6. 缺口与修复方案

### 6.1 缺口 A: 没有产品功能列表

现状：

- 只有 `CAPABILITIES`。
- README 和 install skill 要求 agent 把 capabilities 翻译成自然语言。
- 用户问“整体 CLI 有什么功能”时，只能看到 operation names。

修复：

1. 在 `scripts/evozeus-cli.mjs` 中新增 `PRODUCT_FEATURES` 常量。
2. 新增 `features.describe` operation。
3. `printResult` 支持无 `--json` 的人类菜单。
4. 单测覆盖 feature ids、lifecycle stages、backend owners、related capabilities。

验收：

```bash
node scripts/evozeus-cli.mjs features
node scripts/evozeus-cli.mjs features --json
```

输出必须包含 `review.session`、`insights.sessions`、`coevolve.target`、`maintain`、`uninstall`。

### 6.2 缺口 B: wrapper 入口命名错误

现状：

- 当前命令是 `harness attach`。
- 用户感知不到这是 EvoZeus 生命周期里的 `co-evolve`。

修复：

1. 新增 `coevolve attach` 路由，复用 `attachHarness(options)`。
2. 保留 `harness attach` 作为兼容别名。
3. `features` 中主推 `coevolve attach`。
4. `capabilities` 中可以保留 `harness.attachPlan`，但 summary 增加 `Co-evolve` 语义。

验收：

```bash
node scripts/evozeus-cli.mjs coevolve attach --target ./skills/example --json
node scripts/evozeus-cli.mjs harness attach --target ./skills/example --json
```

两者的 `operation` 可以同为 `harness.attachPlan`，`handoff_plan.recommended_route` 必须是 `EvoZeus-CoEvolve`。

### 6.3 缺口 C: insights/report 没挂到主 CLI

现状：

- `EvoZeus-infra` 有 `session-insights`、`project-insights`、`project-insights-site` 等命令。
- 主 `evozeus` CLI 只知道 `session scan --dry-run`。
- 用户要的“扫描所有 session，结合 factor，按项目出报告并打开 HTML”不在整体产品菜单里。

修复：

1. 主 CLI 的 `features` 声明 `insights.sessions`，状态为 `available`，默认入口是 `insights plan`。
2. P1 添加 `evozeus insights plan`，输出和 `session.scanPlan` 一致但使用产品语义。
3. P1 添加 `evozeus insights sessions`，路由到 `EvoZeus-infra`，不在主 repo 重写 scanner / factor runner。
4. 路由前由主 CLI 检查 infra 可用性，并在不可用时给出安装 / 修复建议。
5. 默认只 plan；读取 raw session、写 report、打开 HTML 需要显式参数或 agent-human approval。

验收：

```bash
evozeus insights plan --source codex --json
evozeus insights sessions --source codex --reuse-factors --html --json
```

第一条不得读取 raw session。第二条必须输出 report path、factor reuse summary、scan summary、privacy summary。

### 6.4 缺口 D: project context 没成为一等参数

现状：

- 项目聚类和项目级高频原话分析已经被用户明确要求。
- 该能力不应靠 HTML 页面临时筛选，而应成为 scan/report contract。

修复：

1. `insights.sessions` 支持 `--project <key>` 和 `--project-mode auto|path|repo|keyword`。
2. report contract 增加 `project_key`、`project_label`、`project_evidence`。
3. 高频原话必须区分 `speaker=user` 和 agent / subagent task text。
4. 重复话术的 evidence 必须支持 click-through 到对应 session turn context。

验收：

报告 JSON 至少包含：

```json
{
  "projects": [
    {
      "project_key": "daxing",
      "source_sessions": 12,
      "user_repeated_phrases": [
        {
          "text": "先看全局，不要直接下钻",
          "count": 7,
          "occurrences": [
            {
              "session_id": "redacted",
              "turn_id": "u-12",
              "speaker": "user",
              "context_ref": "report://contexts/..."
            }
          ]
        }
      ]
    }
  ]
}
```

所有 repeated phrases 的 occurrence 必须满足 `speaker=user`。

### 6.5 缺口 E: preserve 路径没有 CLI 化

现状：

- `review` 或 `insights` 之后，如何把结论变成 Case / Factor / Skill / Habit / Rule 主要靠 skill 文档。
- CLI 没有沉淀草稿入口。

修复：

1. P1 新增 `evozeus preserve draft --from-report <path> --json`。
2. 只生成本地 draft，不提交 GitHub。
3. draft 明确 artifact type、evidence refs、privacy note、next route。

验收：

```bash
evozeus preserve draft --from-report .evozeus/runtime/reports/.../analysis.json --json
```

输出必须包含 artifact candidates，且不包含 raw private session。

### 6.6 缺口 F: doctor 没有组件级 readiness

现状：

- `doctor` 主要检查主 repo 文件和安装状态。
- 用户无法知道 infra、wrapper、session-signal skill 是否可用。

修复：

1. `doctor` 增加 component readiness：
   - `evozeus`
   - `EvoZeus-infra`
   - `EvoZeus-CoEvolve`
   - `EvoZeus-session-signal-skill`
2. 每个组件报告：
   - detected path
   - version or commit
   - executable command
   - missing dependency
   - repair hint
3. 组件检查只读，不联网，除非显式传入 `--check-network`。

验收：

```bash
evozeus doctor --json
```

输出必须能解释为什么 `insights.sessions` 或 `coevolve.target` 当前可用 / 不可用。

## 7. 实现位置

### 7.1 `evozeus` 主 repo

触达文件：

```text
scripts/evozeus-cli.mjs
scripts/evozeus-cli.test.mjs
README.md
docs/README.zh-CN.md
docs/reference/install-onboarding-conversation.md
skills/evozeus-install-registration/SKILL.md
```

主 repo 只实现：

- feature registry。
- command alias。
- JSON envelope。
- approval boundary。
- backend availability check。
- handoff / route plan。

主 repo 不实现：

- raw session scanner。
- FactorRunner。
- SQLite ledger。
- HTML report renderer。
- wrapper transform / issue / PR / release 写入。

### 7.2 `EvoZeus-infra`

需要承接：

```text
insights.plan
insights.sessions
insights.projectSessions
insights.openReport
```

要求：

- 跑过的 factor 结果不重跑，除非 stale 或 force。
- 支持 project-scoped clustering。
- 支持 `speaker=user` 的 repeated phrase extraction。
- 支持 occurrence click-through context。
- 输出 HTML 和 JSON contract。

### 7.3 `EvoZeus-CoEvolve`

需要承接：

```text
coevolve.status
coevolve.attach
coevolve.auditFeedback
coevolve.issueToPr
coevolve.upgradeCheck
```

要求：

- 默认 plan-only。
- 不默认写 target repo。
- 不默认创建 GitHub issue / PR。
- 明确 `.evozeus_evoinfra/wrapper.json` 为 target repo-local harness manifest。

## 8. 开发顺序

### Phase 0: 文档和 contract 固定

1. 合并本文。
2. 确认 `features` 与产品矩阵一致。
3. 确认 `insights` 和 `coevolve` 的 owner 边界。

完成标准：

- 本文被用作 v0.3 开发基准。
- 无人再把 `capabilities` 当唯一产品菜单。

### Phase 1: 主 CLI features 和别名

1. 新增 `PRODUCT_FEATURES`。
2. 新增 `features` command。
3. 新增 `review session` alias。
4. 新增 `coevolve attach` alias。
5. 更新 help 输出。
6. 更新 CLI tests。

完成标准：

```bash
npm run test:cli
```

且：

```bash
node scripts/evozeus-cli.mjs features --json
node scripts/evozeus-cli.mjs review session --input - --json
node scripts/evozeus-cli.mjs coevolve attach --target . --json
```

均可运行。

### Phase 2: 主 CLI 到 infra insights 的 plan 路由

1. 新增 `insights plan`。
2. 检测 `EvoZeus-infra` 是否存在和可执行。
3. 不可用时输出 repair hint。
4. 可用时调用 infra plan command 或输出 route plan。

完成标准：

- `insights plan` 不读取 raw session。
- `doctor` 能解释 infra readiness。

### Phase 3: infra report contract 对齐

1. 将 `session-insights` / `project-insights-site` 收敛到 `insights.sessions` 后端 contract。
2. 增加 project scope。
3. 修复 speaker attribution，只统计 user 原话。
4. 增加 occurrence context refs。
5. HTML template 使用 report JSON contract 渲染。

完成标准：

- 同一句重复 7 次时，页面能点开 7 个 occurrence。
- occurrence 不把 agent 给 subagent 的任务误判为用户原话。
- 同一 session 多次出现必须显示为同一 session 下的多个 turn，不误导成多个 session。

### Phase 4: preserve 和 coevolve 深化

1. 新增 `preserve draft`。
2. 新增 `coevolve status`。
3. 新增 `coevolve audit` 到 wrapper audit route。
4. 后续再加 `issue-to-pr`，保持默认 dry-run。

完成标准：

- insights 结果可以生成本地 artifact draft。
- wrapper 只在用户批准后进入 repo write / GitHub write。

## 9. 测试计划

### 9.1 主 CLI tests

新增测试：

| Test | 断言 |
| --- | --- |
| `features --json` | 包含产品生命周期 feature ids |
| `features` | 人类可读输出包含 `Review`、`Insights`、`Co-evolve` |
| `review session` alias | 输出与 `session analyze` 等价 |
| `coevolve attach` alias | 输出与 `harness attach` 等价 |
| help | 展示 features / review / insights / coevolve |
| unknown feature command | 返回结构化错误 |

运行：

```bash
npm run test:cli
```

### 9.2 infra route tests

新增测试：

| Test | 断言 |
| --- | --- |
| `insights plan` | 不读取 raw store |
| missing infra | 输出 `component_missing` 和 repair hint |
| available infra | route plan 包含 backend command |
| `doctor` | 输出 infra / wrapper readiness |

### 9.3 report contract tests

新增测试：

| Test | 断言 |
| --- | --- |
| factor reuse | 已有 fresh factor result 不重跑 |
| project scope | 大兴项目 sessions 被归到同一 project key |
| speaker filter | repeated phrases 全部来自 `speaker=user` |
| context refs | 每个 occurrence 可定位到 session id + turn id |
| duplicate session | 多个 occurrence 在同一 session 时显示正确 |

## 10. 兼容策略

保留旧命令至少一个 minor version：

| Old command | New preferred command | 处理 |
| --- | --- | --- |
| `evozeus capabilities --json` | 保持不变 | 永久保留 |
| `evozeus session analyze` | `evozeus review session` | 旧命令保留 |
| `evozeus session scan --dry-run` | `evozeus insights plan` | 旧命令保留，help 中弱化 |
| `evozeus harness attach` | `evozeus coevolve attach` | 旧命令保留 |

文档和 install onboarding 默认推荐新命令。

## 11. 风险

| Risk | 影响 | 控制 |
| --- | --- | --- |
| 主 repo 重新吸收 runtime 实现 | 职责膨胀，违背产品矩阵 | 主 CLI 只做 route plan，runtime 留在 infra |
| `features` 和 `capabilities` 不一致 | agent 误导用户 | feature registry 必须引用 related capabilities，测试覆盖 |
| insights 默认扫描 raw session | privacy 风险 | 默认 plan-only，scan 需要审批 |
| wrapper 被误解为 session report 功能 | 产品边界混乱 | `coevolve` 只出现在 Decide 之后 |
| 项目聚类误判 | report insight 失真 | report 必须展示 project evidence |
| 高频原话误把 agent/subagent 文本当用户文本 | 结论不可用 | occurrence 必须带 `speaker=user` proof |

## 12. 验收标准

v0.3 完成后必须满足：

1. 用户运行 `evozeus features` 能看到按生命周期组织的产品功能列表。
2. Agent 运行 `evozeus features --json` 能拿到 stable feature registry。
3. `capabilities --json` 继续作为机器协议真相源。
4. `review session` 可用，且兼容 `session analyze`。
5. `coevolve attach` 可用，且兼容 `harness attach`。
6. `insights.sessions` 在产品菜单中出现，并清楚说明由 `EvoZeus-infra` 执行。
7. `doctor` 能报告 infra / wrapper readiness。
8. 所有会读取 raw session、写报告、打开 HTML、写 repo、写 GitHub 的行为都有明确审批边界。
9. 项目洞察报告支持 project scope、user-only repeated phrases 和 occurrence context click-through。
10. 主 repo 不新增 scanner、factor runner、ledger、HTML renderer 的实现。

## 13. 不在本轮做

- 不做 daemon。
- 不做 MCP server。
- 不做 TUI。
- 不做自动 GitHub issue / PR / release。
- 不把 `EvoZeus-CoEvolve` 变成 session analyzer。
- 不把 `EvoZeus-infra` 变成用户第一入口。
- 不把 raw private session 写入 public artifact。

## 14. 结论

v0.3 的关键不是增加更多命令，而是把 EvoZeus 的产品层级理顺：

```text
features = 用户级产品菜单
capabilities = 机器级执行协议
infra = insights / runtime 后端
wrapper = co-evolve 后端
```

完成后，用户问“EvoZeus 整体 CLI 有什么功能”时，答案不再是底层 operation 清单，而是按生命周期组织的产品功能。agent 仍然可以通过 capability manifest 获取严格的权限、风险和 schema，从而把产品可理解性和执行安全性同时保住。
