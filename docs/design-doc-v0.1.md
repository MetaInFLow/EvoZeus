# EvoZeus Design Doc（Draft v0.1）

## The Judgment Layer for AI Agents

> **EvoZeus：Agent 时代的评价层基础设施（The Judgment Layer for AI Agents）**

---

# 1. 项目背景（Background）

随着 Codex、Claude Code、OpenHands、Cursor 等 Coding Agent 的快速发展，越来越多的软件开发工作由 Agent 完成。

但是目前行业主要关注：

* 最终是否完成任务（Success / Fail）
* Benchmark 得分
* Code Diff

却缺少一个统一的问题：

> **Agent 是如何完成任务的？它的过程是否值得学习？**

例如：

* 是否进行了合理规划？
* 是否进行了验证（Verification）？
* Tool 使用是否高效？
* 是否发生了 Recovery？
* 是否存在无意义循环？
* 是否进行了 Reflection？

目前这些能力没有统一的评价标准。

EvoZeus 希望填补这一空白。

---

# 2. 项目愿景（Vision）

EvoZeus 致力于成为：

> **Agent Session 的 ESLint。**

它不是评价代码，而是评价 Agent 的行为过程（Session）。

长期目标：

建立一套开放、可扩展、可共创的 Agent Evaluation Standard。

让 Agent 的行为能够像代码一样被：

* Review
* Lint
* Compare
* Score
* Optimize
* Train

---

# 3. 核心理念（Core Philosophy）

## Session 是数据（Session is Data）

Session 本身只是 Agent 的执行轨迹。

例如：

* Prompt
* Tool Call
* Observation
* Retry
* Reflection

这些只是原始数据。

---

## Factor 是知识（Factor is Knowledge）

真正有价值的是：

> 判断 Agent 是否优秀的标准。

例如：

* Planning
* Verification
* Recovery
* Reflection
* Tool Efficiency

这些可以跨模型、跨任务复用。

Factor 才是 EvoZeus 的核心资产。

---

## Evaluation Should Evolve

评价标准应该持续演进。

社区不断贡献新的：

* Factor
* Plugin
* Expert Evaluator

形成 Agent 评价生态。

因此命名：

> **Evo（Evolution） + Zeus（Judgment）**

---

# 4. 设计原则（Design Principles）

## 4.1 Lightweight Core（核心极轻）

安装后即可使用。

```bash
pip install evozeus
```

Core 仅包含：

* Discovery Engine
* Runtime
* Report Engine
* 内置基础 Factor

避免首次安装下载大量资源。

---

## 4.2 Discovery First（先发现，再安装）

用户无需提前配置。

运行：

```bash
evozeus review
```

自动扫描当前项目：

```text
Workspace

├── .codex
├── pyproject.toml
├── tests
```

输出：

```text
Detected:

✓ Codex Session

✓ Python Project

Recommendation:

• codex-scanner

• coding-pack
```

用户确认后自动下载。

无需提前安装 Plugin。

---

## 4.3 Progressive Capability（渐进式能力）

评价能力分层：

```text
Basic

↓

Smart

↓

Expert

↓

Cloud
```

用户无需部署 MCP 即可获得基础能力。

高级能力按需升级。

---

## 4.4 Factor First（Factor 优先）

Session 会不断变化。

Agent 会不断变化。

但 Factor 可以长期沉淀。

EvoZeus 的长期生态核心不是 Session，而是：

> **Factor Library（评价因子库）**

---

# 5. 整体架构（Architecture）

```text
                    EvoZeus Core

                           │

      ┌────────────────────┼────────────────────┐

      │                    │                    │

 Discovery          Plugin Manager        Report Engine

      │

      ▼

 Session Scanner

      │

      ▼

 Unified Session Model

      │

      ▼

 Factor Runtime

      │

      ▼

 Factor Packs

      │

      ▼

 Markdown

 GitHub PR

 HTML

 JSON

 Reward Dataset
```

---

# 6. 核心流程（Execution Pipeline）

一次 Review 固定经历四个阶段：

```text
Workspace

↓

Scan

↓

Resolve

↓

Evaluate

↓

Report
```

即：

> **SREP（Scan → Resolve → Evaluate → Report）**

作为 EvoZeus 的标准执行流程。

---

# 7. Discovery Engine

负责扫描本地项目。

例如：

```text
.codex

.cursor

.claude

openhands

browser-use

playwright
```

生成：

> Scan Map（扫描地图）

例如：

```text
Detected:

✓ Codex Session

✓ Python Project

✓ Browser Project

Recommended:

codex-scanner

coding-pack

browser-pack
```

Discovery 不依赖任何 Scanner Plugin。

---

# 8. Plugin System

Plugin 负责解析不同来源的 Session。

例如：

```text
codex-scanner

cursor-scanner

claude-scanner

openhands-scanner
```

Core 自动检测：

```text
Found .codex

Plugin Required:

codex-scanner

Install?

(Y/n)
```

插件按需下载。

保持 Core 极轻。

---

# 9. Unified Session Model

所有 Scanner 最终输出统一结构。

```python
Session

messages

tool_calls

actions

observations

reflections

retries

metadata
```

Factor 不关心 Session 来源。

只依赖统一结构。

保证未来可扩展。

---

# 10. Factor Runtime

Factor 可以运行在不同 Runtime。

支持：

* Python
* Regex
* AST
* Prompt
* MCP
* Docker
* Remote API

Core 自动调度。

用户无需关心实现细节。

---

# 11. Factor 分级（Factor Capability）

## Basic Factor（基础因子）

无需模型。

无需 MCP。

安装即可运行。

例如：

* Tool Count
* Retry Count
* Loop Detection
* Execution Time
* Token Usage
* Parallel Tool Usage

运行速度快。

零成本。

---

## Smart Factor（智能因子）

依赖 LLM。

例如：

* Planning Quality
* Recovery Strategy
* Reflection Quality
* Tool Selection

支持：

* OpenAI
* Anthropic
* Ollama

用户已有模型即可运行。

---

## Expert Factor（专家因子）

依赖 MCP 或专用服务。

例如：

* Architecture Review
* Long Horizon Planning
* Multi-Agent Collaboration
* Research Quality

Expert Factor 代表：

> 社区共享的专家评审能力。

而不是简单 Prompt。

---

# 12. Factor Pack

Factor 按领域组织。

例如：

## Coding Pack

* Planning
* Verification
* Recovery
* Reflection

---

## Browser Pack

* Retry Strategy
* Selector Robustness
* Wait Strategy

---

## Research Pack

* Citation
* Source Diversity
* Contradiction Detection

安装：

```bash
evozeus install coding-pack
```

按需下载。

---

# 13. Factor Marketplace（未来）

所有 Factor 来自官方 Factor Repo。

默认：

```text
evozeus review
```

自动检查：

```text
Latest Release

coding-pack v0.8

Update Available

Install?
```

社区持续贡献：

* 新 Factor
* 新 Rule
* 新 Expert Evaluator

形成开放生态。

---

# 14. Report

支持输出：

* Markdown
* GitHub PR Comment
* HTML Dashboard
* JSON
* Reward Dataset

示例：

```text
Planning         94

Recovery         90

Verification     68

Reflection       91

Overall          86
```

每项评分均附带证据链（Evidence）。

方便 Reviewer 理解评分依据。

---

# 15. 第一版 MVP（v0.1）

目标：

让用户 5 分钟内跑起来。

包含：

✅ Core Runtime

✅ Discovery Engine

✅ Codex Scanner

✅ Basic Factor

✅ Coding Pack

✅ Markdown Report

✅ GitHub PR 输出

无需 MCP。

无需数据库。

无需 Web 服务。

本地即可运行。

---

# 16. 后续规划（Roadmap）

## v0.2

* Plugin Marketplace
* HTML Dashboard
* Cursor Scanner
* Claude Scanner

---

## v0.3

* Expert Factor
* MCP Runtime
* Community Factor Repo

---

## v0.5

* Session Ranking
* Agent Capability Radar
* Reward Dataset Export

---

## v1.0

打造 Agent 时代统一的评价层（Evaluation Layer）。

不仅评价 Agent。

更沉淀：

> **可复用的判断标准（Reusable Judgment Factors）**

让每一次 Agent 执行，都成为未来 Agent 演化的数据资产。

---

# 17. 一句话定义

> **EvoZeus 是一个面向 Agent Session 的可扩展评价框架，通过 Discovery、Plugin 和 Factor Pack 机制，对 Agent 的执行过程进行标准化分析，并逐步沉淀 Agent 时代的评价标准与判断因子库。**

