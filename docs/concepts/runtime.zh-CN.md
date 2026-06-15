# 运行时关键词

- Status: active
- Last updated: 2026-06-15
- Language: zh-CN

## 总览

运行时层负责把 session 输入转成判断信号。

```text
Analysis Framework
-> Stage
-> Factor
-> Factor Result
-> Evidence / Case / Verdict
```

## 关键词

| Term | 中文解释 | 用途 |
| --- | --- | --- |
| Analysis Framework | 一套分析任务的上下文、阶段和输出约束 | 规定 factor 在哪里运行 |
| Stage | framework 里的运行阶段 | 控制 factor 顺序和责任 |
| Factor Runtime | 执行 factor 并收集结果的本地层 | 跑默认因子、检查结果健康度 |
| Factor | 绑定到某个 stage 的可复用判断算法 | 产出 tag、score、evidence ref、verdict signal |
| Factor Result | factor 的稳定输出 | 输入 Evidence、Case、Verdict |
| runtime_profile | factor 的运行档位 | 区分 default、heavy、community |
| Heavy Factor | 需要额外模型、较高资源或外部服务的 factor | 用户显式开启 |
| Community Factor | 来自社区 registry 的 factor | inspect 后启用 |

## Analysis Framework

默认 framework：

```text
agent_session_review.v0
```

它定义 EvoZeus 如何审判 Agent Session。

默认 stages：

```text
ingest
-> normalize
-> signal_extraction
-> evidence_building
-> case_building
-> verdict_building
-> insight_aggregation
```

## Factor

Factor 的最小声明：

```yaml
id: default.tool_failure
framework_id: agent_session_review.v0
stage: signal_extraction
runtime_profile: default
default_enabled: true
inputs:
  - tool_event
  - command_output
outputs:
  - tag
  - score
  - evidence_ref
  - verdict_signal
```

## Factor Result

Factor Result 必须包含：

- `factor_id`
- `framework_id`
- `stage`
- `target_type`
- `target_id`
- `tags`
- `scores`
- `evidence_refs`
- `verdict_signals`
- `confidence`

Factor 只能提供 verdict signal。最终 Verdict 由 Judgment layer 汇总决定。

## Runtime Profiles

| Profile | 默认状态 | 说明 |
| --- | --- | --- |
| `default` | enabled | 轻量、本地、低依赖 |
| `heavy` | disabled | 额外模型、较高耗时、较高资源或外部服务 |
| `community` | disabled | 社区来源，需要 inspect 和确认 |

## 默认因子

首期默认因子：

- `default.tool_failure`
- `default.open_loop`
- `default.same_target_rework`
- `default.correction_loop`
- `default.negative_signal`
- `default.usage_sentence`
- `default.key_sentence`
- `default.skill_tool_source_activity`
- `default.success_factor`

## 用户确认边界

需要确认：

- 启用 heavy factor
- 安装 heavy factor 依赖
- 启用 community factor
- 访问 community registry
- 修改 factor 配置
- 删除或覆盖 factor result

低风险动作：

- 查看本地 factor status
- 查看 default factor result
- 汇总 evidence refs
- 生成本地 debug hint

## 相关文档

- [Factor Analysis Protocol](../reference/factor-analysis-protocol.md)
- [TUI + Agent Companion Workflow](../design/active/design_doc-v0.2-tui-agent-companion-workflow.md)
- [Privacy and Redaction](../governance/privacy-and-redaction.md)
