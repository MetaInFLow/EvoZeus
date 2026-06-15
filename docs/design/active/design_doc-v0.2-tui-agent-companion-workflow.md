# Design Doc: EvoZeus TUI + Agent Companion Workflow v0.2

- Status: active
- Owner: MetaInFlow
- Last updated: 2026-06-15
- Started: 2026-06-15
- Linked Vision: [../../../VISION.md](../../../VISION.md)
- Linked Design Doc(s): [design_doc-v0.1-agent-session-judgment-layer.md](design_doc-v0.1-agent-session-judgment-layer.md)
- Linked ADR(s): [ADR-0001](../../decisions/ADR-0001-static-skill-entry-and-zero-install.md)

## 0. Design Summary

v0.2 的核心设计是 TUI-first user-agent workflow。

EvoZeus 首期不把真人用户拉进复杂表单。真人用户主要复制启动语、查看 TUI、在高风险节点确认；用户的 Agent 负责读取、归因、脱敏、草拟和提交前检查；社区接收脱敏后的 Case、Rule、Factor 和历史贡献。

默认使用模式是手动、零安装、零上传。用户复制一句话后，Agent 在当前 session 内完成一次轻量审判并返回 verdict card。写入 `.evozeus/`、打开 TUI、启动浏览器 companion、贡献社区、安装因子库、启用 hook 或 cron 都必须作为后续 opt-in 动作。

核心链路：

```text
用户让 Agent 工作
-> Agent 产生 session evidence
-> EvoZeus 进行本地审判
-> 用户得到 debug / config / rule / skill proposal
-> 用户确认可公开内容
-> 社区沉淀 Case / Rule / Factor / Golden Case
-> Agent 下次引用本地或社区资产
```

首期只需要抓住五个大作用域：

| Scope | Role | Meaning |
| --- | --- | --- |
| Infra | 用户 + Agent | TUI、browser companion、`.evozeus/`、onboard、doctor、status |
| Judgment | Agent + 用户 | Evidence、Case、Verdict、Scenario、Rule、debug verdict、value function signal |
| Scenario Skills | Agent + 用户 | Skill Matrix、scenario skill package、skill proposal、download gate、rollback |
| Factor Runtime + Library | Agent + 社区 | analysis framework、default factors、factor result、heavy factor、community factor、inspect、enable、update、rollback |
| Community | 用户 + 社区 | redacted Case、Rule proposal、Golden Case、Accepted Rule、contribution history |

复盘时机分三层：

| Timing | Purpose | v0 Behavior |
| --- | --- | --- |
| Hook-time Capture | 轻量记录失败、纠偏、重试、环境异常 | 记录 signal，不做完整审判 |
| End-of-task Judgment | 对一次 session 做主审判 | 生成 private report、Case draft、Verdict |
| Incremental Insight | 跨 session 找重复纠偏和长期规律 | 首期手动触发，后续可 cron |

## 1. Background

EvoZeus 当前已经有 protocol bootstrap：

- `README.md` 提供项目入口、审判闭环和贡献入口。
- `SKILL.md` 提供 Agent 可读取的静态入口。
- `VISION.md` 承载 AI 自进化、value function 和 community graph 的理念。
- `CONTRIBUTING.md`、Issue template、PR template 提供基础贡献规则。

v0.2 要解决的核心问题是首期交互方式。

首期体验以 TUI 为主。真人用户在业务过程中尽量少操作，只在必要节点复制、点击或确认。用户的 Agent 负责读取、分析、归因、脱敏、草拟和提交前检查。浏览器 companion 只在需要真人 insight、redaction review、贡献预览或安装授权时打开。

## 2. Goal

v0.2 定义 EvoZeus 的最小可实现交互架构：

```text
README copy prompt
-> User's Agent / Codex thread
-> EvoZeus TUI
-> Browser Companion when human insight is needed
-> Local files
-> GitHub issue / PR after explicit approval
```

必须回答：

1. 真人用户在哪些节点出现。
2. 用户的 Agent 自动做什么。
3. TUI 承担哪些主流程。
4. 浏览器 companion 什么时候打开。
5. 哪些动作必须经过授权。
6. onboard、doctor、inspect 模式如何进入 EvoZeus 的首期交互。

## 3. Scope

首期包含：

- README 中的复制式入口 prompt。
- `evozeus tui` 作为主本地交互入口。
- `evozeus onboard` / `evozeus doctor` / `evozeus status` 作为少量直达命令。
- 本地 `.evozeus/` 工作区。
- 浏览器 companion 用于高信息量人工确认。
- GitHub issue / PR 作为社区贡献沉淀面。

首期排除：

- Web dashboard
- 长期在线服务
- hook auto-start
- cron auto-start
- 自动上传 raw session
- 自动公开贡献
- 完整 factor marketplace
- 多用户权限系统
- 大规模 graph database

## 4. Default Usage Mode

默认模式名称：

```text
Manual Session Review
```

默认承诺：

- 不安装 CLI。
- 不创建本地文件。
- 不启用 hook。
- 不启用 cron。
- 不访问社区 registry。
- 不上传 raw session。
- 不创建 GitHub issue / PR。

默认入口：

```text
请读取 https://evozeus-metainflow.vercel.app/skill.md，并按 EvoZeus 审判当前 Agent Session。
```

默认输出是一张轻量 verdict card：

```text
Session Verdict Card
- Task context
- Key evidence
- Judgment signals
- Proposed verdict
- Suggested next action
- Privacy note
- Optional next steps
```

默认闭环完成条件：

```text
用户复制启动语
-> Agent 读取 SKILL.md
-> Agent 基于当前可见 session 收集 evidence
-> Agent 输出 Session Verdict Card
-> 用户获得一个本地改进建议或 Open Case
```

这条链路不要求用户安装工具、打开 TUI、授权写文件或贡献社区。

## 5. Shortest Interaction Loop

最短闭环只服务一个问题：

```text
这次 Agent session 里，什么值得保留、修正、忽略或继续观察？
```

最短链路：

| Step | Actor | Action | User Burden |
| --- | --- | --- | --- |
| 1 | 用户 | 复制启动语给 Agent | copy |
| 2 | Agent | 读取 `SKILL.md` | none |
| 3 | Agent | 汇总当前 session evidence | none |
| 4 | Agent | 生成 verdict card | none |
| 5 | 用户 | 选择是否继续：保存、打开 TUI、贡献、忽略 | optional confirm |

verdict card 中的后续动作必须是 opt-in：

- `Save local draft`
- `Open TUI`
- `Open browser review`
- `Create redacted Case`
- `Contribute to community`
- `Inspect / enable factor`
- `Enable hooks`
- `Schedule insights`

首期 README 应优先展示这条最短链路。TUI、browser companion、factor inspect 和 community contribution 放在“下一步动作”里。

## 6. Roles, Chain, and Scopes

### 6.1 Roles

| Role | What They Care About | Main Surface |
| --- | --- | --- |
| 用户 | 少操作，让 AI 越来越懂自己 | README prompt、TUI、browser confirmation |
| 用户的 Agent | 按协议执行、收集 evidence、生成草稿 | `SKILL.md`、TUI actions、local files |
| 社区 | 接收脱敏贡献，沉淀公共判例和因子 | GitHub issue / PR、Golden Cases、Factor registry |

### 6.2 Role Chain

```text
用户
  -> 让 Agent 工作
  -> Agent 执行 / 失败 / 纠偏 / 总结规律
  -> EvoZeus 审判 session
  -> 给用户本地建议
  -> 用户确认是否沉淀 / 贡献
  -> 社区接收脱敏 Case / Rule
  -> 社区沉淀 Factor / Rule / Golden Case
  -> 用户和 Agent 再安装 / 引用 / 学习
```

### 6.3 Scope Map

| Scope | Serves | Includes |
| --- | --- | --- |
| Infra | 用户 + Agent | TUI、browser companion、`.evozeus/`、onboard、doctor、status |
| Judgment | Agent + 用户 | Evidence、Case、Verdict、Scenario、Rule、debug verdict、personal value function signal |
| Scenario Skills | Agent + 用户 | Skill Matrix、scenario skill package、skill proposal、manifest、download gate、rollback |
| Factor Runtime + Library | Agent + 社区 | analysis framework、default factor、heavy factor、community factor、manifest、inspect、enable、update、rollback |
| Community | 用户 + 社区 | Case issue、Rule proposal、Golden Cases、Accepted Rules、Rejected Patterns、contribution history |

## 7. Review Timing

EvoZeus 的复盘时机分三层。

### 7.1 Hook-time Capture

用于业务过程中的轻量 signal 捕捉。

触发：

- tool call 失败
- 命令连续失败
- 用户纠偏
- Agent 重试多次
- 权限、网络、路径、认证错误
- Agent 明显跑偏或卡住

行为：

- 记录 judgment signal。
- 标记 possible Case。
- 必要时进入 `doctor`。
- 默认少打断业务。

产物：

```text
signal event
debug hint
possible case marker
```

默认状态：关闭。首期 hook-time capture 可以先由 Agent 在当前会话内按 `SKILL.md` 规则执行；本地事件 collector 属于后续 opt-in 能力。

### 7.2 End-of-task Judgment

用于一次 session 的主审判。

触发：

- Agent 完成任务。
- 用户说“结束 / 复盘 / 总结”。
- session 达到阶段性完成点。
- 出现失败后无法继续。

行为：

- 汇总 evidence。
- 识别 Case。
- 给出 Verdict。
- 生成 private report。
- 提醒是否保留、忽略、贡献。

产物：

```text
Session Verdict Report
Private Case Draft
Observed Pattern
Recommended Local Rule
Skill Proposal Signal
```

默认状态：开启在手动模式中。用户复制启动语或明确要求复盘时触发。

### 7.3 Incremental Insight

用于跨 session 的长期规律发现。

触发：

- 用户打开 TUI 的 History / Insights。
- 用户请求“看看最近我一直在教 AI 什么”。
- 本地 `.evozeus/` 新增多个 session。
- 后续版本可支持每日 / 每周 cron。

行为：

- 聚合多个 session。
- 找重复纠偏。
- 找高频 failure。
- 找同类 scenario。
- 识别 skill gap。
- 推荐 factor 或 skill update。

产物：

```text
Repeated Correction Report
Skill Proposal
Factor Recommendation
Personal Value Function Delta
Community Contribution Candidate
```

默认状态：关闭。首期只支持用户手动触发；cron 属于后续 opt-in 能力。

首期策略：

```text
hook = capture signal
end-of-task = judge session
cron = manual insights first
```

## 8. Product Principles

1. **真人用户低负担**
   真人用户默认只做复制、点击、确认。

2. **Agent 主动承担流程**
   Agent 负责收集 evidence、归因、脱敏、生成草稿、比较版本、提出下一步。

3. **业务流中少打断**
   日常工作过程只记录 judgment signal。复盘、贡献、安装和公开动作放到明确确认节点。

4. **TUI 为主体验**
   TUI 承担本地状态、session、debug、case draft、factor runtime、history 的日常操作。

5. **浏览器只处理人类 insight**
   当内容需要更清晰的预览、对比、选择、redaction diff 或授权时，打开本地 browser companion。

6. **高风险动作显式确认**
   写文件、改配置、安装依赖、启用 factor、联网提交、公开内容前必须确认。

7. **本地优先**
   raw session、完整个人偏好、私有 evidence 默认留在 `.evozeus/`。

8. **所有持续能力 opt-in**
   hook、cron、registry fetch、factor install、community submit 都需要用户显式开启。

## 9. PSPS-Derived Surface

| Persona | Scenario | Pain | Solution Surface |
| --- | --- | --- | --- |
| 真人用户 | 想第一次接入 EvoZeus | 不想学习复杂概念，只想复制后可用 | README prompt、onboard、TUI setup summary |
| 真人用户的 Agent | 需要按 EvoZeus 审判 session | 缺少稳定步骤、输出格式和停止条件 | `SKILL.md`、agent protocol、local report |
| 日常使用者 | Agent 跑不起来或卡住 | 不知道是环境、工具、权限、网络、Skill 还是流程问题 | `doctor`、Debug Verdict、修复建议 |
| 日常使用者 | 工作结束后出现可沉淀规律 | 不想填表，也担心泄露隐私 | 自动草拟 Case、redaction preview、保存 / 忽略 / 贡献 |
| 社区贡献者 | 想贡献规律 | 不知道如何把个人经验变成公共 Scenario + Rule | Rule proposal draft、PII gate、GitHub issue / PR |
| 长期用户 | 多次强调同类规则 | 反复教 AI 同一件事，缺少沉淀机制 | 重复纠偏识别、Skill proposal 草稿 |
| Factor 使用者 | 想检查、启用或升级因子 | 不知道 factor 属于哪套分析框架、依赖、权限、风险和可信度 | factor inspect、runtime status、enable、update / rollback |
| 新贡献者 | 想看历史优秀贡献 | 不知道什么样的 Case / Rule 合格 | Golden Cases、Accepted Rules、贡献规范索引 |

## 10. Interaction Surfaces

| Surface | Primary User | Responsibility |
| --- | --- | --- |
| README copy blocks | 真人用户 | 给出最小启动语和常见动作语 |
| User's Agent / Codex thread | 真人用户的 Agent | 执行读取、归因、草拟、确认前说明 |
| TUI | 真人用户 + Agent 辅助 | 本地状态、session、draft、factor runtime、history 主操作面 |
| Browser Companion | 真人用户 | 人类 insight、redaction review、贡献预览、安装授权 |
| Local Markdown / JSON / SQLite | Agent / TUI | 本地真相源和草稿 |
| GitHub Issue / PR | 社区贡献者 / Maintainer | 公共 Case、Rule、Factor、贡献记录 |

## 11. Scenario Catalog

### 11.1 First-time Onboard

用户看到：

```text
请读取 https://evozeus-metainflow.vercel.app/skill.md，并按 EvoZeus 审判当前 Agent Session。
```

Agent 自动执行：

- 读取 `SKILL.md`。
- 检查 repo 和本地环境。
- 判断是否已有 `.evozeus/`。
- 说明 local-first 和 privacy 默认值。
- 在需要写入本地文件前请求确认。

TUI：

```text
EvoZeus Onboard
- Workspace: detected / missing
- Local state: initialized / not initialized
- Privacy: local-first
- GitHub: available / unavailable
- Next action: initialize / skip / open docs
```

交互模式要求：

- onboard 应逐步设置 local workspace、privacy defaults、GitHub capability。
- 每一步都要显示当前状态、下一步动作和可跳过选项。

### 11.2 Doctor / Debug a Failing Agent Session

触发：

- Agent 工具调用失败。
- CLI 找不到。
- 权限、网络、认证、路径异常。
- Skill 执行卡住。
- Agent 对错误归因不清。

用户看到：

```text
当前失败更像是网络 / 权限 / 工具路径 / Skill 使用问题。
我已整理 evidence。是否查看修复建议？
```

Agent 自动执行：

- 收集命令输出、错误、环境、路径、认证状态、重试记录。
- 区分工具、环境、权限、网络、Skill、流程问题。
- 生成 Debug Verdict。
- 需要改配置、安装依赖、联网重试时请求确认。

TUI：

```text
Debug Verdicts
- Latest failure
- Evidence
- Diagnosis
- Suggested action
- Confirm / Ignore / Save Case
```

交互模式要求：

- doctor 应覆盖 health check、repair 建议、migration 提示。
- EvoZeus doctor 负责归因和证据化 debug，不默认改环境。

### 11.3 Passive Session Review

触发：

- 正常业务 session 结束。
- Agent 发现失败、延后、误判、纠偏、意外成功。
- Agent 发现用户反复强调某种操作方式。

用户看到：

```text
这次 session 有 2 个可沉淀信号：
1. 一个环境误判
2. 一个可能适合保留的操作规则

要查看复盘卡片吗？
```

Agent 自动执行：

- 提炼 evidence summary。
- 识别 observed pattern。
- 给出 proposed verdict。
- 生成 private Case draft。
- 默认不公开。

TUI：

```text
Current Session
- Summary
- Evidence
- Observed Patterns
- Proposed Verdicts
- Draft Case
```

Browser Companion：

- 当 evidence 很长、需要对比、需要 redaction review 时打开。

### 11.4 Contribute Scenario + Rule

触发：

- 用户决定把某个 private Case 贡献给社区。
- Agent 判断某个 pattern 具备公共价值，并询问是否生成草稿。

用户看到：

```text
我可以把这个 Case 转成公开的 Scenario + Rule proposal。
会先脱敏，并在提交 GitHub 前让你确认。
```

Agent 自动执行：

- 抽取 scenario、observed pattern、recommended rule、boundary。
- 做 PII redaction。
- 生成 Rule Proposal issue / PR 草稿。
- 检查 evidence、privacy、operational gates。

TUI：

```text
Community Contributions
- Private draft
- Redacted preview
- Rule proposal
- GitHub readiness
```

Browser Companion：

- Redaction diff
- Evidence preview
- Issue / PR preview
- Confirm submit

交互模式要求：

- PR template proof gate
- evidence-heavy issue forms
- maintainer approval before sensitive actions

### 11.5 Repeated Correction -> Skill Proposal

触发：

- 用户在同一类场景反复强调同一规则。
- 多个 session 暴露相同操作缺口。
- 规则已经具备场景化、可执行、可复用特征。

用户看到：

```text
你在「existing repo 规划」场景里多次强调：
Agent 先读 repo 和 docs，再提方案。

这可能值得沉淀成一个场景 Skill。
要不要我整理 Skill proposal 草稿？
```

Agent 自动执行：

- 聚合重复纠偏 evidence。
- 抽取共同 scenario。
- 提炼用户反复强调的操作规则。
- 生成 Skill proposal 草稿。
- 等用户确认后保存或贡献。

TUI：

```text
Skill Proposals
- Repeated instruction
- Supporting sessions
- Candidate scenario skill
- Save / Ignore / Contribute
```

产品约束：

- EvoZeus 不泛泛推荐现成 Skill。
- 只有用户反复教 AI 同一类场景规则时，才提示沉淀为场景 Skill。

### 11.6 Inspect / Enable Factor

触发：

- 用户主动查看当前审判用了哪些 factor。
- Agent 发现某个 factor 需要额外依赖、较高成本或社区来源。
- 用户决定启用 heavy factor 或 community factor。

用户看到：

```text
这个 factor 绑定到 agent_session_review.v0：
- stage: signal_extraction
- runtime: heavy
- inputs: user_turn, task_span
- outputs: tag, score, evidence_ref, verdict_signal

默认不会上传 raw session。
是否启用？
```

Agent 自动执行：

- 读取 factor manifest。
- 校验 `framework_id`、`stage`、input contract、output contract。
- 展示 runtime profile、依赖、权限、输入、输出、风险、版本。
- 说明 factor result 如何进入 Evidence、Case 和 Verdict。
- 检查本地冲突和回滚路径。
- heavy factor 和 community factor 启用前请求确认。

TUI：

```text
Factor Runtime
- Framework: agent_session_review.v0
- Default factors: enabled
- Heavy factors: disabled
- Community factors: disabled
- Inspect / Enable / Disable / Rollback
```

Browser Companion：

- 当 manifest、权限、风险或 changelog 较复杂时打开。

交互模式要求：

- inspect 应在启用前展示 metadata、source、versions、changelog、scan status。

### 11.7 Check Factor Runtime Status

触发：

- 用户主动检查。
- Agent 发现本地 factor result 异常、缺少 evidence ref 或 framework 版本不匹配。
- Agent 发现本地 community factor 与 registry 存在差异。

用户看到：

```text
当前 factor runtime 状态：
- default.tool_failure: enabled, healthy
- default.same_target_rework: enabled, low evidence
- heavy.semantic_cluster: disabled
- community.github_network_debug: candidate update available

建议先检查 low evidence 的输出，再决定是否启用 heavy factor。
```

Agent 自动执行：

- 列出 framework、stage、factor、runtime profile 和启用状态。
- 检查 Factor Result 是否包含 `factor_id`、target、evidence refs 和 confidence。
- 标注 healthy、low evidence、disabled、candidate、disputed、deprecated。
- 对 community factor 总结 changelog 和 breaking changes。
- 升级、回滚、启用新 factor 前请求确认。

TUI：

```text
Factor Runtime Status
- Framework
- Stage
- Factor
- Runtime profile
- Result health
- Recommended action
```

交互模式要求：

- status 应覆盖 update、inspect、registry health 和本地启用状态。

### 11.8 Review Historical Contributions

触发：

- 用户想看类似优秀 Case。
- 新贡献者想学习规范。
- Maintainer review 新贡献。
- Agent 需要引用历史 Case 支撑建议。

用户看到：

```text
我找到 3 个类似 accepted Case。
它们共同支持这条 rule：
在 repo 规划场景中，先读结构和关键 docs，再提方案。
```

Agent 自动执行：

- 按 scenario、outcome、rule、confidence 检索历史贡献。
- 展示 Golden Cases、Accepted Rules、Rejected Patterns。
- 链接 issue / PR / evidence summary。

TUI：

```text
History
- Golden Cases
- Accepted Rules
- Disputed Rules
- Rejected Patterns
- Similar Cases
```

Browser Companion：

- 当需要横向对比多个 Case、查看 evidence graph 或贡献规范时打开。

## 12. TUI Information Architecture

首期入口：

```bash
evozeus tui
```

少量直达命令：

```bash
evozeus onboard
evozeus doctor
evozeus status
```

主菜单：

```text
EvoZeus
1. Current Session
2. Debug Verdicts
3. Case Drafts
4. Skill Proposals
5. Factor Runtime
6. Community Contributions
7. History
8. Settings / Privacy
```

TUI layout:

```text
┌──────────────────────┬────────────────────────────────────┐
│ Sessions / Drafts    │ Detail Preview                      │
│ Factors / History    │ Evidence / Verdict / Rule           │
├──────────────────────┴────────────────────────────────────┤
│ Actions: View  Save  Redact  Open Browser  Submit  Ignore  │
└────────────────────────────────────────────────────────────┘
```

参考：

- lazygit：列表、diff、预览、确认。
- K9s：资源状态、详情、动作。
- Posting / Harlequin：本地文件、manifest、adapter / plugin 思路。

## 13. Browser Companion

Browser companion 由 TUI 或 Agent 在需要人类 insight 时打开。

```text
http://127.0.0.1:<port>/?token=<one-time-token>
```

首期页面：

| Page | Use |
| --- | --- |
| Setup Review | 隐私默认值、本地目录、能力状态 |
| Debug Verdict | evidence、归因、修复建议 |
| Case Preview | private Case、redacted Case、保存 / 忽略 |
| Rule Proposal | scenario、pattern、rule、boundary、confidence |
| Redaction Diff | 原始摘录与脱敏结果对照 |
| Factor Inspect | framework、stage、runtime profile、输入输出、风险、changelog |
| History Compare | 类似 accepted Cases、Rules、PR 链接 |
| Skill Proposal | 重复纠偏 evidence 和候选场景 Skill |

安全规则：

- localhost only
- one-time token
- no raw session upload
- explicit submit confirmation
- browser action writes back to local state first

## 14. Authorization Gates

| Action | Requires Human Confirmation |
| --- | --- |
| Create `.evozeus/` | yes |
| Write local case / rule / skill proposal | yes when first time or outside workspace |
| Modify user config | yes |
| Install dependency for heavy factor | yes |
| Enable / disable heavy or community factor | yes |
| Install community factor | yes |
| Network request to community registry | yes when not previously allowed |
| Create GitHub issue / PR | yes |
| Publish redacted evidence | yes |
| Delete / overwrite local evidence | yes |
| Enable hooks | yes |
| Enable cron / scheduled insights | yes |

Low-risk read-only actions can run without interruption:

- read local report
- list drafts
- compare versions after registry permission exists
- show history
- summarize evidence

## 15. Local State Contract

首期本地状态建议：

```text
.evozeus/
  config.json
  sessions/
    ezs_<date>_<id>/
      report.md
      evidence.json
      cases/
        <slug>.case.md
  drafts/
    rule-proposals/
    skill-proposals/
  factors/
    frameworks/
      agent_session_review.v0.json
    results/
    registry.json
    installed/
  history/
    contribution-index.json
```

原则：

- raw session 默认不进入 git。
- public contribution 从 redacted draft 生成。
- 所有 browser confirmation 写回本地 state。

## 16. Interaction Pattern Mapping

| Pattern | EvoZeus Mapping | Why |
| --- | --- | --- |
| Onboard | `evozeus onboard` | 首次设置 local workspace、privacy、GitHub capability |
| Doctor | `evozeus doctor` | 跑不起来时归因并给修复建议 |
| Inspect | Factor inspect | 启用前看 framework、stage、metadata、权限、版本、changelog、trust status |
| Install / update | Community factor install / update | 社区 factor 安装、启用、回滚 |
| Publish rules | Community factor publish rules | public repo、docs、owner、维护状态 |
| Curated index | Golden Cases / Rules index | 历史优秀贡献和发现入口 |

## 17. Milestones

| Milestone | Behavior Loop | Impact Files | Validation Gate |
| --- | --- | --- | --- |
| M1 Manual session review | User can complete shortest loop with one copied prompt | `README.md`, `SKILL.md` | Agent returns verdict card without local writes |
| M2 Interaction spec | Team agrees on TUI + browser companion flow | this design doc | Scenario table covers 8 flows |
| M3 README copy prompts | User can start / debug / draft Case by copy prompt | `README.md` | Copy prompts map to Agent actions |
| M4 TUI skeleton | User can open local workbench | future CLI package | `evozeus tui` opens main menu |
| M5 Onboard + doctor | First setup and debug have direct flows | TUI + docs | sample repo runs through onboard / doctor |
| M6 Case / Rule draft preview | Session produces local draft | `.evozeus/` contract | draft saved locally, no upload |
| M7 Browser companion | Redaction and proposal can be reviewed visually | local companion app | one-time token, confirmation writes local state |
| M8 Factor runtime | Factor can be inspected before enablement | factor protocol / TUI | framework / stage / dependency / permission / risk fields visible |
| M9 Contribution path | Redacted Case can become GitHub issue / PR | issue / PR templates | submit requires explicit confirmation |

## 18. Acceptance Criteria

v0.2 is ready when:

- Default mode is manual, zero-install and zero-upload.
- The shortest interaction loop is documented and does not require TUI, hook, cron or GitHub.
- README provides copy blocks for first setup, debug, draft Case and contribution.
- Role chain and scope map are visible near the top of this design doc.
- Review timing covers hook-time capture, end-of-task judgment and incremental insight.
- Hook-time capture and cron are explicitly opt-in.
- TUI menu and local state contract are documented.
- Browser companion trigger rules are documented.
- Onboard, doctor, factor inspect and contribution flows have separate specs.
- Factor Analysis Protocol defines framework, stage, factor result and runtime profile.
- Authorization gates are explicit.
- Community contribution path starts from redacted local draft.
- Repeated correction produces Skill proposal draft only after evidence exists.

## 19. Open Questions

- Should `evozeus tui` be implemented with Textual first?
- Should browser companion use NiceGUI for speed or FastAPI + HTMX for stronger protocol control?
- Should community factor registry be a plain JSON index in repo during v0?
- Should history / Golden Cases live in this repo or a later curated companion repo?
- Should first setup create `.evozeus/` automatically after one confirmation, or require explicit path selection?
- Should hook-time capture live inside Agent prompts first, or should it require a real local event collector in v0?
