# EvoZeus（宙斯）

**全球 Agent 工作模式进化基础设施 / Global Agent Work Pattern Evolution Infrastructure**

> 审判全球一切 Skill，也审判每一个让 Agent 变强或变弱的工作模式。

宙斯从真实 Agent Session 中发现反复出现的高价值做法、低效习惯、环境故障和工具约束，把它们炼成可审阅、可复用、可贡献、可进化的 **Evolution Candidate**。

它不是 Agent 打分器，不是 benchmark，也不只是一次 session 的报告工具。Skill 只是宙斯可能产出的结果之一。宙斯真正关心的是：一个 Agent 在真实工作中暴露出来的哪些模式值得被保留、修正、传播，甚至贡献给全球 Agent 生态。

> 当前状态：Design Draft / Pre-MVP。这个仓库正在定义产品方向和 v0.1 的最小可用体验。

> Origin：宙斯的概念诞生于一次不太成功的黑客松之后，[Anthony](https://github.com/HaodiFan) 和 [Neil](https://github.com/orgs/MetaInFLow/people/Neillan96) 两个人的一次复盘。

---

## 一句话加入

目标交互是一句话：

```text
请加入宙斯 Agent Evolution Layer：https://evozeus.dev/skill.md
```

你把这句话复制给 Codex、Claude Code、Cursor、OpenHands、Gemini CLI 或其他类似 Agent。Agent 读取 `skill.md` 后，会知道如何记录本次 session、生成本地报告、发现可复用模式，并在你同意后把候选模式贡献出去。

v0.1 的目标不是让你学习一套评测系统，而是让 Agent 自己读懂说明书，把宙斯接入它正在做的工作。

---

## 为什么叫宙斯

最初的一句话是：

> 审判全球一切 Skill。

但真实 session 里值得审判的不止 Skill。

有些是一个稳定的操作习惯；有些是一个验证门禁；有些是一个工具路径解析规则；有些是一个网络故障模式；有些是一个看似很有方法论、实际却在浪费 token 甚至拉低产出质量的 Skill。

所以宙斯的审判对象被扩大为：

> **Agent 工作中的一切可复用操作单元。**

审判不是打分。审判是把一个模式放到证据台上，判断它该被保留、修正、合并、废弃，还是贡献给更多人。

---

## 你会经历什么

1. 复制一句话给 Agent。
2. Agent 读取宙斯说明书，开始在本地生成 `.evozeus/evozeus.sqlite` 和唯一 `session_id`。
3. 本次任务结束后，宙斯生成 Markdown / HTML / JSON 报告。
4. 你先看到 HTML 报告，大概知道这次 session 发生了什么。
5. 如果报告看不懂，可以让 Agent review 报告，指出真正有价值或真正危险的模式。
6. 如果某个发现击中了你，宙斯会把它整理成 Evolution Candidate。
7. Agent 询问你是否安装或认证 `gh`，在你同意后以 draft PR 的形式贡献到候选库。
8. 被接受的 candidate 未来可以生成可传播页面，成为全球 Agent 工作模式库的一部分。

---

## 宙斯到底在找什么

宙斯寻找的是 Evolution Unit：能让 Agent 变强、变稳、变省，或能指出 Agent 为什么变弱的最小可复用单元。

候选类型包含但不限于：

| Candidate Type | 它是什么 | 例子 |
| --- | --- | --- |
| `skill_candidate` | 可直接沉淀成 Skill 的操作说明 | 每次交付前检查实际生成的文件、链接和命令输出 |
| `factor_candidate` | 用来给 session 打标签的判断因子 | 是否把结论绑定到可追溯证据，而不是凭感觉总结 |
| `micro_habit` | 很小但高频影响质量的习惯 | 最终回复前跑一次 `git diff --check` 或确认文件存在 |
| `tool_resolution_rule` | 工具路径、安装位置、版本解析规则 | 某些 CLI 不在默认 PATH，Skill 应先全局扫描再判断缺失 |
| `environment_fix` | 本地环境修复模式 | Node/Python/gh/larkcli 的常见路径与 fallback |
| `network_failure_pattern` | 外部服务失败的根因模式 | GitHub 掉线可能不是 gh auth，而是网络不稳定或代理问题 |
| `workflow_template` | 可复用的任务流程 | 从模糊想法到 README、设计文档、候选 PR 的闭环 |
| `prompt_pattern` | 反复前调后沉淀出的提示结构 | 多次要求“先别下钻，先想总方案”后形成产品规划 Skill |
| `negative_pattern` | 应避免或废弃的模式 | 看似方法论很强的 Skill 实际浪费 token、拖慢任务、降低质量 |
| `review_gate` | 贡献、发布或最终回复前的门禁 | Value Gate、Evidence Gate、Privacy Gate、Operational Gate |

这些维度不是封闭列表。宙斯会持续寻求新的 Factor、Candidate Type 和贡献规则。

---

## 报告不打分

宙斯报告不输出总分，不做排行榜，也不把复杂 session 压成一个数字。

一次报告应该包含：

| 内容 | 作用 |
| --- | --- |
| `session_id` | 本次 session 的唯一标识 |
| Tags | 本次 session 的关键标签 |
| Factor | 每个标签背后的判断因子 |
| Evidence | 支撑标签的证据、tool call、文件、diff 或对话片段 |
| 综合评价 | 这次 session 为什么有价值，或者哪里明显有风险 |
| 优化意见 | 下次如何减少浪费、提高稳定性、沉淀可复用模式 |
| Candidates | 可贡献的 Evolution Candidate |

核心原则：

```text
No Score -> Tag -> Evidence -> Review -> Candidate -> Contribution
```

---

## 本地产物

一次 `evozeus review` 不应该只生成 Markdown。

目标产物：

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
        tool_resolution_rule.candidate.md
        github_network_failure_pattern.candidate.md
        final_artifact_review_gate.candidate.md
```

默认本地优先。session 先进入本地 SQLite，不自动上传。任何联网贡献都必须经过用户确认。

---

## 报告模板与可视化

HTML 报告应该服务于复盘和贡献，不是 Markdown 套壳。

宙斯会优先使用 [Ant Design Charts](https://ant-design-charts.antgroup.com/components/overview) 生态生成本地 HTML 报告。图表选择先看数据和问题，再选组件。

| 模板 | 用途 | 适合的可视化 |
| --- | --- | --- |
| Session Pattern Report | 单次 session 的标签、证据、综合评价和优化意见 | Bar / Heatmap / FlowGraph |
| Evidence Graph | 从标签追溯到 Factor、证据、tool call、diff | NetworkGraph / MindMap / Sankey |
| Candidate Report | 把一次发现整理成可贡献的 candidate | Funnel / Treemap / Bar |
| Workspace Evolution Dashboard | 多个 session 的高频模式、候选趋势、环境问题 | Line / Area / Heatmap / Treemap |
| Tool & Environment Map | CLI、网络、认证、路径问题的聚类 | Graph / Chord / Column |

---

## 隔离和交互机制

宙斯不应该一上来就安装大包、跑复杂服务或上传 session。能力按阶段打开。

| 阶段 | 包大小 | 机制 | 交互形式 |
| --- | --- | --- | --- |
| Inline Join | Zero Pack | Agent 只读取远端 `skill.md`，理解宙斯流程 | 用户复制一句话 |
| Local Review | Core Pack | 本地 SQLite、session id、基础 scanner、基础 Factor | 用户运行或让 Agent 运行 `evozeus review` |
| Domain Pack | Optional Pack | Codex/Cursor/Claude/Research/Coding 等专用 scanner 和 Factor | Agent 发现需要后询问安装 |
| Report Pack | Optional UI Pack | HTML 模板、Ant Design Charts、可视化数据 JSON | 本地生成 `report.html` |
| Contribution Pack | GitHub Pack | `gh` 检查、脱敏、draft PR、candidate schema | 用户明确同意后执行 |
| Future Cloud | Opt-in Service | 团队面板、跨设备同步、公共 candidate 页面 | 默认关闭，必须显式开启 |

每个阶段都要能降级。某个 Factor timeout、某个 scanner crash、某个 CLI 缺失，都不应该中断整体 session 记录。

---

## 贡献闭环

```text
session -> report -> insight -> evolution candidate -> review -> PR -> global library
```

当报告里出现可复用模式，Agent 应该先 review 报告，再询问用户是否贡献。

贡献前必须经过四道门：

| Gate | 问题 |
| --- | --- |
| Value Gate | 这个发现是否能泛化到其他 session |
| Evidence Gate | 是否有足够证据支撑，不只是主观判断 |
| Privacy Gate | 是否已脱敏，不泄露代码、客户信息、私有路径、token |
| Operational Gate | 是否真的可执行，不只是漂亮话 |

用户同意后，宙斯可以检查：

```bash
gh --version
gh auth status
```

如果未安装 GitHub CLI，Agent 应提示用户安装 `gh`。如果已安装并通过认证，Agent 可以创建 draft PR，把 candidate 贡献到库里。

---

## 适合谁

宙斯适合经常把复杂工作交给 Agent 的用户和团队。

- 你每天用 Codex 类工具改代码、读仓库、查 bug、写文档、整理 PR。
- 你让 Agent 做产品方案、研究报告、数据分析、客户材料、运营流程。
- 你不一定写代码，但你经常让 Agent 处理严肃任务。
- 你发现自己一直在反复“前调”Agent，但这些调整从未沉淀。
- 你怀疑某些 Skill 只是看起来高级，实际在浪费 token。
- 你希望把自己的高价值工作方式贡献给其他 Agent 用户。

---

## 规划中的仓库结构

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

当前仓库先把定位、用户旅程、报告形态和 v0.1 边界收拢清楚，再进入 CLI、模板和 schema 实现。

---

## v0.1 范围

第一版要完成“一句话接入 -> 本地记录 session -> 打标签 -> 生成报告 -> 发现 candidate”的闭环。

包含：

- `skill.md`
- 本地 CLI review
- 本地 SQLite session registry
- Session 唯一标识
- Codex Session Scanner
- Basic Factors
- Tagging：标签、对应 Factor、证据和原因
- Markdown / HTML / JSON 报告
- 高价值 session 报告
- 分析后的优化意见
- Evolution Candidate
- `gh` contribution prompt
- timeout / failure degradation

不包含：

- Cloud Runtime
- 完整 Marketplace
- 自动上传 session
- 自动创建 PR
- Docker Sandbox
- MCP Runtime
- 大规模 Benchmark

---

## Roadmap

### v0.1 - Agent-readable MVP

一个 URL，一条本地 session 记录，一组标签，一份 HTML 报告，一个候选模式。

### v0.2 - Report Templates & Candidate Schema

Ant Design Charts HTML 模板、candidate schema、Codex / Cursor / Claude scanner、早期社区治理。

### v0.3 - Contribution Workflow

`gh` draft PR、脱敏检查、candidate review checklist、官方 / 社区候选库分层。

### v0.5 - Team Evolution

Lockfile、CI Mode、GitHub PR Comment、Team Policy、Workspace Dashboard、团队 Agent 工作模式图谱。

### v1.0 - Global Agent Work Pattern Evolution Infrastructure

面向全球 Agent 用户的开放 Evolution Library，让高价值 Agent 工作模式从真实 session 中持续进化。

---

## Docs

- [Design Doc v0.1](docs/design-doc-v0.1.md)

下一步计划：

- `SKILL.md`
- `docs/report-templates.md`
- `docs/candidate-contribution.md`
- v0.1 CLI 行为
