# 开发架构

- Status: active
- Last updated: 2026-06-15
- Audience: 要实现或审查 EvoZeus 基础建设的人

## 架构目标

首期架构要支撑一个很短的闭环：

```text
Agent Session
-> Local Judgment
-> Verdict Card
-> Optional Local Save / TUI / Contribution / Factor Action
```

系统默认 local-first、manual-first、opt-in-first。任何安装、写入、上传、贡献、hook、cron、因子启用动作都需要明确确认。

## 分层

| Layer | Responsibility | Main Consumer |
| --- | --- | --- |
| Protocol Surface | 给 Agent 和人读取的稳定入口 | 用户、用户的 Agent |
| Scenario Skills | 场景化 Agent 行动方式、路由和下载授权 | 用户的 Agent、开发者 |
| Local Runtime | 本地状态、报告、registry、缓存 | 用户的 Agent、TUI |
| Judgment Engine | evidence 抽取、case 生成、verdict 判断 | 用户的 Agent |
| Factor Runtime | factor manifest、stage binding、result contract | Judgment Engine |
| TUI | 本地主交互、状态检查、授权确认 | 用户 |
| Browser Companion | 高信息量人工确认和贡献预览 | 用户 |
| Community Surface | issue、PR、公共 library、贡献历史 | 社区 |

## 核心数据流

```text
1. Agent 读取 SKILL.md
2. Agent 根据场景决定是否建议 scenario skill
3. Agent 从当前 session 抽取 evidence
4. Judgment Engine 生成 Case Draft
5. Factor Runtime 按 stage 执行轻量 factor
6. Agent 输出 Verdict Card
7. 用户选择是否保存到 .evozeus/
8. 用户选择是否打开 TUI 或 Browser Companion
9. 用户确认后才进入 issue / PR 贡献
```

## 本地工作区

计划中的本地工作区：

```text
.evozeus/
  registry.sqlite
  reports/
  cases/
  artifacts/
  cache/
```

约束：

- `.evozeus/` 默认不进入 git。
- raw session 默认只留在本地可见上下文。
- public example 必须经过 redaction。
- report 优先输出 Markdown / JSON。

## Factor Runtime 边界

Factor 必须绑定到 analysis framework 的 stage。每个 factor 至少声明：

```text
id
version
stage
input_contract
output_contract
privacy_level
dependencies
fallback
```

轻量 factor 可以默认可用。重因子、外部依赖、模型调用、第三方库下载都走 opt-in。

## TUI 和 Browser Companion

TUI 是首期主界面，负责：

- onboard
- doctor
- status
- review
- factor inspect
- contribution preview

Browser Companion 只处理 TUI 不适合承载的高信息量确认：

- 人类 insight 输入
- PII redaction review
- 贡献预览
- 因子安装授权

## Community Surface

社区贡献以 issue / PR 为主：

```text
Local Report
-> Redacted Case Draft
-> User Approval
-> Issue or PR
-> Review
-> Accepted Artifact
```

主线只接受脱敏后的结构化贡献。常见 artifact 包括 Rule、Factor、Golden Case、Environment Rule、Rejected Pattern。
