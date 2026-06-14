# EvoZeus（宙斯）Design Doc（Draft v0.1）

## Global Agent Work Pattern Evolution Infrastructure

> **EvoZeus（宙斯）：全球 Agent 工作模式进化基础设施（Global Agent Work Pattern Evolution Infrastructure）**

宙斯的目标不是给 Agent 打分，而是从真实 Agent Session 中发现、审判、沉淀一切可复用的工作模式：Skill、Factor、微习惯、环境修复、工具解析规则、网络故障模式、review gate 和 workflow template。

---

# 1. 项目背景（Background）

随着 Codex、Claude Code、OpenHands、Cursor、Gemini CLI 等 Agent 快速进入日常工作，越来越多的软件开发、研究、产品、文档、运营和客户材料由 Agent 完成。

行业当前主要记录：

- 最终是否完成任务（Success / Fail）
- Benchmark 得分
- Code Diff
- 最终输出物

但真实价值经常藏在过程中：

- Agent 如何规划任务？
- 它在哪一步做了验证？
- 它为什么卡住又恢复？
- 它是否反复做无效前调？
- 它是否因为 CLI 路径、网络、认证、环境差异而误判？
- 它有没有形成一个下次可以复用的工作模式？

例如：

- 某个 CLI 没有安装在默认路径，Skill 直接判断“未安装”，但正确做法应该是全局扫描、识别 Homebrew/自定义路径，再决定 fallback。
- GitHub 操作经常失败，表面看像 `gh` 掉线，实际可能是网络或代理不稳定。
- 用户反复提醒“先别下钻，先想总方案”，说明这可能不是一次 prompt 修正，而是一个应该沉淀的规划型 Skill。
- 一个看似很有方法论的 Skill 可能占用大量 token，反而拉低最终产出质量。

这些发现现在没有统一的记录、审阅、贡献机制。宙斯要让它们从一次性经验变成可复用资产。

---

# 2. 项目愿景（Vision）

EvoZeus 致力于成为：

> **全球 Agent 工作模式进化基础设施。**

长期目标：

建立一套开放、可扩展、可共创的 Evolution Standard，让 Agent 工作过程中的高价值模式能够像代码一样被：

- Review
- Tag
- Trace
- Judge
- Improve
- Contribute
- Reuse

宙斯不是基础设施运维工具，也不是单纯的 Skill 仓库。它面向的是全球 Agent 使用者在真实 session 中不断涌现的工作模式，并把这些模式推进到可贡献、可演化的公共循环中。

---

# 3. 为什么叫宙斯（Why Zeus）

最初的定位是：

> 审判全球一切 Skill。

但进一步看，真实 session 里值得审判的不止 Skill。

审判对象包括：

- 一个 Skill 是否真的提高质量
- 一个 Factor 是否能解释高价值 session
- 一个小习惯是否应该被默认执行
- 一个工具路径规则是否应该进入 scanner
- 一个网络故障模式是否应该成为诊断项
- 一个反复出现的用户修正是否应该沉淀成 workflow
- 一个漂亮但低效的流程是否应该被淘汰

因此宙斯中的 Zeus 不是“打分神”，而是“证据审判层”：把一个候选模式放到证据台上，判断它应该保留、修正、合并、废弃，还是贡献给更多 Agent 用户。

---

# 4. 核心对象（Core Objects）

## 4.1 Session 是原始数据

Session 是 Agent 的执行轨迹，包括：

- User Prompt
- Agent Message
- Tool Call
- Observation
- File Diff
- Error
- Retry
- Reflection
- Final Answer

Session 本身不是最终资产，但它提供证据。

## 4.2 Tag 是观察结果

Tag 描述一次 session 中发生了什么：

- `high_value_session`
- `verification_gap`
- `tool_resolution_failure`
- `network_instability_pattern`
- `repeated_prompt_tuning`
- `token_wasting_skill`
- `candidate_detected`

Tag 不打分。Tag 必须绑定 Factor、证据和原因。

## 4.3 Factor 是判断因子

Factor 是产生 Tag 的判断规则。

例如：

- `evidence_backed_judgment`
- `final_artifact_verification`
- `tool_path_resolution`
- `network_failure_diagnosis`
- `workflow_repetition_detection`
- `token_efficiency_review`

内置 Factor 只是初始种子。Factor 包含但不限于这些维度，并持续寻求社区贡献。

## 4.4 Evolution Candidate 是可贡献候选

Evolution Candidate 是宙斯最重要的产物之一。

候选类型包括：

- `skill_candidate`
- `factor_candidate`
- `micro_habit`
- `tool_resolution_rule`
- `environment_fix`
- `network_failure_pattern`
- `workflow_template`
- `prompt_pattern`
- `negative_pattern`
- `review_gate`

Skill 和 Factor 都只是 Candidate 的子类型。

---

# 5. 用户旅程（User Journey）

## 5.1 加入

用户只需要复制一句话：

```text
请加入宙斯 Agent Evolution Layer：https://evozeus.dev/skill.md
```

Agent 读取 `skill.md` 后，理解：

- 如何记录 session
- 如何生成唯一 `session_id`
- 如何写入本地 SQLite
- 如何打标签
- 如何生成报告
- 如何发现 candidate
- 如何在用户同意后贡献 PR

## 5.2 第一次报告

第一次使用时，用户应该快速看到：

- 本地生成的 `.evozeus/evozeus.sqlite`
- 本次 session 的 `session_id`
- Markdown 报告
- HTML 报告
- JSON 数据文件
- 初步 tags 和 suggestions

用户不需要先理解 Factor 体系。

## 5.3 Review 报告

报告生成后，Agent 应主动提供 review：

- 哪些地方有价值
- 哪些地方浪费 token
- 哪些地方是环境问题，不是 Agent 能力问题
- 哪些地方应该沉淀成 candidate
- 哪些地方不能贡献，因为证据不足或隐私风险高

## 5.4 贡献

当用户觉得某个发现“被击中”，Agent 应询问是否贡献。

贡献前检查：

```bash
gh --version
gh auth status
```

如果 `gh` 不存在，先提示安装。如果 `gh` 存在但未认证，提示认证。只有用户明确同意后，才创建 draft PR。

---

# 6. 执行流程（Execution Pipeline）

标准流程：

```text
Scan -> Register -> Resolve -> Tag -> Report -> Review -> Propose -> Contribute
```

解释：

| 阶段 | 作用 |
| --- | --- |
| Scan | 扫描当前 workspace、Agent session、相关日志和项目上下文 |
| Register | 写入本地 SQLite，生成唯一 `session_id` |
| Resolve | 识别工具、环境、路径、网络、认证等外部条件 |
| Tag | 基于 Factor 给 session 打标签，绑定证据和原因 |
| Report | 输出 Markdown / HTML / JSON |
| Review | Agent 解读报告，指出高价值模式与风险 |
| Propose | 生成 Evolution Candidate |
| Contribute | 用户同意后通过 PR 贡献 |

任何阶段失败都应降级，而不是中断整体流程。

---

# 7. 隔离机制（Isolation Model）

宙斯按阶段打开能力，避免一开始就安装大包、联网或上传 session。

| 阶段 | 包大小 | 默认权限 | 失败策略 |
| --- | --- | --- | --- |
| Inline Join | Zero Pack | 只读取 `skill.md` | 继续当前 session |
| Local Review | Core Pack | 本地文件、本地 SQLite | 缺少数据也生成部分报告 |
| Domain Pack | Optional Pack | 用户同意后安装 scanner / Factor | 单个 pack timeout 不影响主流程 |
| Report Pack | Optional UI Pack | 本地渲染 HTML / JSON | HTML 失败时保留 Markdown / JSON |
| Contribution Pack | GitHub Pack | 用户同意后使用 `gh` | `gh` 不可用则输出 candidate 文件 |
| Future Cloud | Opt-in Service | 用户显式开启后联网同步 | 默认关闭，不自动上传 |

隔离原则：

- 本地优先
- 显式联网
- 显式贡献
- 可降级
- 可审计

---

# 8. 数据模型（Data Model）

目标本地结构：

```text
.evozeus/
  evozeus.sqlite
  sessions/
    ezs_20260614_7f3a91c2/
      session.json
      tags.json
      report.md
      report.html
      data/
        tag-matrix.json
        evidence-graph.json
        timeline.json
        suggestions.json
      candidates/
        *.candidate.md
```

核心表：

| Table | 作用 |
| --- | --- |
| `sessions` | session 元数据、来源、时间、workspace |
| `events` | message、tool call、error、diff、observation |
| `tags` | 标签、对应 Factor、原因、置信说明 |
| `evidence` | 标签对应的证据引用 |
| `candidates` | candidate 类型、状态、review 结果 |
| `contributions` | PR、review、merge、reject 记录 |

---

# 9. 报告原则（Report Principles）

v0.1 报告不输出分数。

报告必须回答：

- 这次 session 的唯一标识是什么？
- 哪些标签被触发？
- 每个标签背后的 Factor 是什么？
- 证据在哪里？
- 这次 session 的综合评价是什么？
- 下次应该怎么优化？
- 有没有值得贡献的 Evolution Candidate？

示例：

```text
Session ID:
ezs_20260614_7f3a91c2

Tags:
- high_value_session
  Factor: evidence_backed_judgment
  Evidence: Agent converted repeated user corrections into a reusable product-positioning pattern.

- tool_resolution_gap
  Factor: tool_path_resolution
  Evidence: Agent initially assumed a CLI was missing before checking non-default installation paths.

High-value Session Report:
This session is valuable because it broadened the product from a Skill-only library into an Agent work-pattern evolution layer.

Optimization Suggestions:
- Detect environment and network issues before blaming authentication.
- Convert repeated prompt tuning into candidate workflow patterns.
- Mark token-wasting skills as negative patterns instead of treating every Skill as positive.
```

---

# 10. HTML 模板与可视化

HTML 报告不是 Markdown 套壳，而是复盘界面。

优先模板：

| Template | Data | Ant Design Charts |
| --- | --- | --- |
| Session Pattern Report | tags、suggestions、candidate summary | Bar / Heatmap / FlowGraph |
| Evidence Graph | tag -> factor -> evidence -> tool call / diff | NetworkGraph / MindMap / Sankey |
| Candidate Report | value、evidence、privacy、operational gates | Funnel / Treemap / Bar |
| Workspace Evolution Dashboard | 多 session 趋势、高频问题、候选增长 | Line / Area / Heatmap / Treemap |
| Tool & Environment Map | CLI 路径、认证、网络、fallback | Graph / Chord / Column |

图表选择原则：

> 先问数据和复盘问题，再选择组件。

---

# 11. 架构（Architecture）

```text
EvoZeus Core
  |
  |-- Discovery Engine
  |-- Session Scanner
  |-- Local Registry
  |-- Resolver
  |-- Factor Runtime
  |-- Report Engine
  |-- Candidate Engine
  |-- Contribution Adapter
```

## 11.1 Discovery Engine

扫描当前 workspace：

- `.codex`
- `.cursor`
- `.claude`
- OpenHands traces
- Browser / Playwright traces
- Git metadata
- project manifest

生成 Scan Map。

## 11.2 Resolver

Resolver 专门处理“不是 Agent 能力，但会影响 Agent 判断”的外部条件：

- CLI 是否安装
- CLI 是否在非默认路径
- 版本是否兼容
- GitHub 是否认证
- 网络是否稳定
- 代理是否影响外部服务
- 文件是否真实存在

## 11.3 Factor Runtime

Factor 可由多种机制实现：

- Regex
- AST
- Python
- Shell probe
- Prompt
- MCP
- Remote API（未来）

v0.1 优先 Basic Factor，避免把早期系统做重。

## 11.4 Candidate Engine

Candidate Engine 把高价值发现整理成候选文件：

```text
candidates/
  <slug>.candidate.md
```

每个 candidate 至少包含：

- 类型
- 问题
- 触发条件
- 证据
- 建议沉淀形式
- 隐私检查
- 贡献状态

---

# 12. v0.1 MVP

目标：

让用户 5 分钟内完成第一次本地 review。

包含：

- `SKILL.md`
- Core Runtime
- Codex Scanner
- Local SQLite Session Registry
- Session ID
- Basic Factors
- Resolver 基础能力
- Tagging：标签、Factor、证据和原因
- Markdown / HTML / JSON 报告
- 高价值 Session Report
- 优化意见
- Evolution Candidate
- `gh` contribution prompt
- timeout / failure degradation

不包含：

- Cloud Runtime
- 自动上传
- 自动创建 PR
- 完整 Marketplace
- Docker Sandbox
- MCP Runtime
- 大规模 Benchmark

---

# 13. 规划中的仓库结构

```text
EvoZeus/
  README.md
  SKILL.md
  ZEUS_STATUS.yml
  schemas/
    session.schema.yml
    tag.schema.yml
    candidate.schema.yml
    report.schema.yml
  scripts/
    init_zeus_workspace.py
    review_session.py
    render_report.py
    propose_candidate.py
    doctor_zeus_repo.py
  templates/
    reports/
    candidates/
    skill/
  factors/
  patterns/
  examples/
  docs/
```

这个结构参考 openLifeOS 的“协议 + schema + scripts + output”思路，但宙斯的核心对象不是人格资产，而是 Agent 工作模式和候选贡献。

---

# 14. Roadmap

## v0.1 - Agent-readable MVP

一个 URL，一条本地 session 记录，一组标签，一份 HTML 报告，一个候选模式。

## v0.2 - Report Templates & Candidate Schema

Ant Design Charts HTML 模板、candidate schema、Codex / Cursor / Claude scanner、早期社区治理。

## v0.3 - Contribution Workflow

`gh` draft PR、脱敏检查、candidate review checklist、官方 / 社区候选库分层。

## v0.5 - Team Evolution

Lockfile、CI Mode、GitHub PR Comment、Team Policy、Workspace Dashboard、团队 Agent 工作模式图谱。

## v1.0 - Global Agent Work Pattern Evolution Infrastructure

面向全球 Agent 用户的开放 Evolution Library，让高价值 Agent 工作模式从真实 session 中持续进化。

---

# 15. 一句话定义

> **EvoZeus 是一个面向真实 Agent Session 的工作模式进化基础设施：它通过本地记录、标签、证据、报告、candidate 和 PR 贡献闭环，把 Skill、Factor、微习惯、环境修复、工具规则、网络故障模式和 workflow template 变成可审阅、可复用、可贡献、可进化的公共资产。**
