# Design Doc: EvoZeus Agent Session Judgment Layer v0.1

- Status: active
- Owner: MetaInFlow
- Last updated: 2026-06-14
- Linked ADR(s): [ADR-0001](../../decisions/ADR-0001-static-skill-entry-and-zero-install.md)

## Agent Session Judgment Layer

> **EvoZeus（宙斯）：把 Agent Session 放上审判台。**

什么该沉淀，什么该修正，什么该淘汰，由证据决定。

---

## 1. Background

Codex、Claude Code、Cursor、OpenHands、Gemini CLI 等 Agent 正在接管越来越多严肃任务：写代码、读仓库、查 bug、做研究、写 PRD、整理数据、生成报告。

但今天大多数系统只保留结果：

- 最终任务是否完成
- code diff
- benchmark 分数
- 最终回答

真正影响下一次 Agent 质量的东西，经常藏在 session 过程里：

- 某个 Skill 是否真的提高质量
- 某个小习惯是否应该沉淀
- 某个工具失败是否其实是路径问题
- GitHub 失败是否其实是网络问题
- 反复 prompt 前调是否说明需要新流程
- 某个漂亮方法论是否实际浪费 token

这些东西现在没有被审判。它们要么丢失，要么被误归因，要么变成用户下一次继续手动纠偏。

---

## 2. Positioning

EvoZeus 不做 Agent 打分、benchmark 或普通报告。

EvoZeus 是：

> **Agent Session Judgment Layer**

它审判一次真实 Agent Session 中发生的行为、证据、失败、环境和产出，然后给出 Verdict。

Skill 只是 Verdict 之一，不能代表全部边界。

---

## 3. Core Loop

```text
Session -> Evidence -> Case -> Verdict -> Library
```

| 阶段 | 含义 |
| --- | --- |
| Session | 一次真实 Agent 执行 |
| Evidence | 可追溯证据：对话、tool call、diff、错误、环境、产物 |
| Case | 一个等待审判的发现 |
| Verdict | 对 Case 的裁决 |
| Library | 被接受的 Skill、Factor、Pattern、Fix 或 Rejection |

这个闭环让社区共创从灵感提交升级为有证据的判例提交。

---

## 4. Core Objects

## 4.1 Session

Session 是原始事实来源。

包含：

- user prompt
- agent message
- tool call
- observation
- error
- retry
- file diff
- final answer
- environment signal

Session 默认本地保存，不自动上传。

## 4.2 Evidence

Evidence 是支持判断的最小证据。

可以是：

- 一段脱敏对话
- 一条命令输出
- 一个错误类型
- 一个 retry pattern
- 一个 diff 摘要
- 一个 tool call 顺序
- 一个环境探测结果

没有 Evidence，就不能形成 Verdict。

## 4.3 Case

Case 是等待审判的发现。

例子：

- CLI 不在默认 PATH，Agent 错判为未安装
- GitHub push 失败，Agent 错判为 auth failure
- 反复提示“先别下钻”，说明需要规划型流程
- 某个 Skill 看似有方法论，实际拉低产出质量

## 4.4 Verdict

Verdict 是裁决，不按分数表达。

| Verdict | 含义 |
| --- | --- |
| `Preserve` | 保留为参考判例 |
| `Promote to Skill` | 升格为 Skill |
| `Extract Factor` | 抽成判断因子 |
| `Keep as Habit` | 保持为轻量习惯 |
| `Fix Environment` | 归因到路径、网络、认证、权限或版本 |
| `Reject Pattern` | 淘汰低价值或有害模式 |
| `Open Case` | 证据不足，继续收集 |

---

## 5. User Journey

## 5.1 加入

用户复制一句话：

```text
请读取 https://evozeus-metainflow.vercel.app/skill.md，并按 EvoZeus 审判当前 Agent Session。
```

Agent 读取 `SKILL.md` 后理解：

- 不给 session 打分
- 本地记录 session
- 收集 evidence
- 生成 evidence report
- 识别 Case
- 提出 Verdict
- 用户同意后再使用 `gh` 贡献

## 5.2 第一次报告

第一次使用应生成：

```text
.evozeus/
  evozeus.sqlite
  sessions/
    ezs_20260614_xxxxxxxx/
      session.json
      evidence.json
      report.md
      report.html
      cases/
        <slug>.case.md
```

报告不打分，只回答：

- 这次 session 发生了什么
- 证据是什么
- 产生了哪些 Case
- 建议 Verdict 是什么
- 下次应该怎么修正

## 5.3 社区共创

如果用户认为某个 Case 有共创价值，Agent 应询问是否提交。

提交前检查：

- Value Gate
- Evidence Gate
- Privacy Gate
- Operational Gate

如果用户同意，再检查：

```bash
gh --version
gh auth status
```

没有 `gh` 或未认证时，保留本地 Case 文件，不自动继续。

---

## 6. Isolation Model

| 阶段 | 机制 | 默认权限 |
| --- | --- | --- |
| Join | 读取 `SKILL.md` | 无安装 |
| Local Review | 本地 SQLite、Markdown report | 本地文件 |
| Evidence Report | HTML / JSON / Markdown | 本地渲染 |
| Case Draft | `.case.md` 文件 | 本地写入 |
| Contribution | GitHub issue / PR | 用户同意后联网 |
| Future Cloud | 社区判例页 / dashboard | 显式 opt-in |

原则：

- 本地优先
- 不自动上传 raw session
- 失败可降级
- 贡献必须显式确认
- 单个 Factor 或模板失败不影响主流程

---

## 7. Report Templates

## 7.1 Session Verdict Report

用于单次 session 审判。

包含：

- Session ID
- Task context
- Evidence summary
- Triggered tags
- Cases
- Proposed verdicts
- Suggestions
- Privacy note

## 7.2 Evidence Graph

用于追溯：

```text
Tag -> Factor -> Evidence -> Case -> Verdict
```

适合 Ant Design Charts：

- NetworkGraph
- Sankey
- MindMap
- FlowGraph

## 7.3 Workspace Case Dashboard

用于多 session 聚合：

- 高频 Case
- 环境问题聚类
- 被淘汰模式
- 已接受 Factor
- 待审 Open Case

---

## 8. Repository Structure

```text
EvoZeus/
  SKILL.md
  README.md
  CONTRIBUTING.md
  SECURITY.md
  LICENSE
  cases/
  factors/
  patterns/
  examples/
  docs/
  .github/
```

这个结构对齐 openLifeOS 的“协议 + schema + scripts + output”思路，宙斯的核心资产聚焦 Agent Session 判例。

---

## 9. v0.1 Scope

包含：

- `SKILL.md`
- README 首屏与 Start Here
- Case / Factor issue templates
- PR template
- Privacy / Security docs
- Verdict docs
- Report template docs
- 示例 Case
- 示例 Report
- 本地文件结构约定

不包含：

- Cloud runtime
- 自动上传
- 自动 PR
- 完整 CLI
- Marketplace
- 大规模 benchmark

---

## 10. Engineering Tracks

### Track A - Judgment Protocol

定义 `Session -> Evidence -> Case -> Verdict -> Library`。

### Track B - Report Templates

补 HTML 报告、Ant Design Charts 示例、Evidence Graph、Workspace Case Dashboard。

### Track C - Local Runtime

实现 `evozeus review`、SQLite registry、Codex scanner、基础 Factor、脱敏检查。

### Track D - Community Library

沉淀 Cases、Factors、Patterns、Rejected Patterns 的社区治理和判例页。

### Long Horizon - Global Agent Session Judgment Layer

让每一次高价值 Agent Session 都能进入全球判例循环。

---

## 11. One-line Definition

> **EvoZeus（宙斯）把 Agent Session 放上审判台：什么该沉淀，什么该修正，什么该淘汰，由证据决定。**
