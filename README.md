# EvoZeus

**The Judgment Layer for AI Agents**

EvoZeus 是一个面向 Agent Session 的可扩展评价框架，目标是成为 **Agent Session 的 ESLint**。

它不直接评价代码产物，而是评价 Agent 完成任务的行为过程：是否进行了合理规划、是否验证结果、Tool 使用是否高效、是否发生 Recovery、是否存在无意义循环、是否进行了 Reflection。

## 项目状态

当前仓库处于 **Design Draft / Pre-MVP** 阶段。

第一版 MVP 的目标是让用户在 5 分钟内本地跑起来：

- Core Runtime
- Discovery Engine
- Codex Scanner
- Basic Factor
- Coding Pack
- Markdown Report
- GitHub PR 输出

无需 MCP、无需数据库、无需 Web 服务。

## 一句话定义

EvoZeus 是一个面向 Agent Session 的可扩展评价框架，通过 Discovery、Plugin 和 Factor Pack 机制，对 Agent 的执行过程进行标准化分析，并逐步沉淀 Agent 时代的评价标准与判断因子库。

## 核心理念

### Session is Data

Session 本身只是 Agent 的执行轨迹，例如 Prompt、Tool Call、Observation、Retry、Reflection。

### Factor is Knowledge

真正有价值的是判断 Agent 是否优秀的标准，例如 Planning、Verification、Recovery、Reflection、Tool Efficiency。

Factor 才是 EvoZeus 的核心资产。

### Evaluation Should Evolve

评价标准应该持续演进。社区可以持续贡献新的 Factor、Plugin 和 Expert Evaluator，形成 Agent 评价生态。

## 标准流程

EvoZeus 的一次 Review 固定经历四个阶段：

```text
Scan -> Resolve -> Evaluate -> Report
```

即 **SREP**。

## 能力分层

```text
Basic -> Smart -> Expert -> Cloud
```

- Basic Factor：无需模型、无需 MCP，安装即可运行
- Smart Factor：依赖 LLM，用于 Planning Quality、Recovery Strategy、Reflection Quality 等智能判断
- Expert Factor：依赖 MCP 或专用服务，代表社区共享的专家评审能力
- Cloud：面向未来的协作、排行、数据集和托管能力

## 设计文档

完整设计草案见：

- [docs/design-doc-v0.1.md](docs/design-doc-v0.1.md)

## Roadmap

### v0.1

- Core Runtime
- Discovery Engine
- Codex Scanner
- Basic Factor
- Coding Pack
- Markdown Report
- GitHub PR 输出

### v0.2

- Plugin Marketplace
- HTML Dashboard
- Cursor Scanner
- Claude Scanner

### v0.3

- Expert Factor
- MCP Runtime
- Community Factor Repo

### v0.5

- Session Ranking
- Agent Capability Radar
- Reward Dataset Export

### v1.0

打造 Agent 时代统一的 Evaluation Layer，并沉淀可复用的 Judgment Factors。

