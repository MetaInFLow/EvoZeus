---
name: evozeus-session-signal-internal
description: Use when 使用 EvoZeus Session Signal Factor 分析 Codex 或 Agent 对话会话，生成有证据支撑的复核信号，将已复核会话路由到正确 Artifact 类型，诊断不满意、重复请求、工具失败、任务完成、资源使用和语义短语模式，综合 MBTI/人格画像，或生成/复核 High-Quality Session Review Page 时使用。
---

# EvoZeus Session Signal（内部）

使用此内部方法，寻找值得总结、保存或转化为可复用改进的 AI 协作历史。此 pack 继承 EvoZeus Git Repo 根目录的产品版本、UAT、Release、Issue、PR 和 Harness 治理。

核心模型：

```text
对话记录 -> scanner 标准化 -> Factor 信号 -> ledger 读取模型 -> 拟议 Verdict -> Artifact 路由 -> 展示
```

`factor.py` 是对话记录的分析组件。`FACTOR.xml` 声明每个 Factor 的输入、输出、证据策略、质量说明和展示方式。此 `SKILL.md` 只说明如何将这些输出组合为可复核结论。

方法层用于寻找值得人工复核的会话，并确定正确的 Artifact 路由。它不承担最终评分、原始 transcript 归档、默认 Skill 生成或替代人工复核的职责。

## 运行规则

1. 当前结果请求使用真实 scanner、runner、ledger 或源会话数据；除非用户明确要求示例，否则不要使用 fixture 或 mock Factor 输出。
2. 按角色区分七个 official Factor：
   - 活动门：`official.task-completion`、`official.user-input-sentiment`、`official.repeated-request`。
   - 诊断项：`official.tool-failure-frequency`、`official.session-resource-usage`、`official.key-sentence-trends`、`official.semantic-phrase-clusters`。
   - MBTI/人格画像是由多个信号综合得到的 Skill 级画像。它不是 official Factor，也不是 `OfficialFactorResult`。
3. 诊断项不能单独产生高价值结论。资源数量、关键句密度、语义簇出现率、会话时长或工具数量可以解释 Case，但不能证明质量。
4. 优先采用以下证据支撑的结论：一个强直接门加具体事件证据，或两个指向同一 Lesson 的较弱直接门。
5. 明确记录覆盖范围。已扫描但未分析的会话没有质量判断。
6. 存储和展示紧凑证据：`session_id`、`event_id`、source locator、短预览、Factor 统计、evidence refs 和派生标签。不要将原始对话正文作为 Factor 数据集存储。
7. 将 Factor 标签视为拟议信号。由人工复核决定 Case 是否成为 Case、Factor、Pattern、Habit、Environment Rule、Skill、Rejected Pattern，或继续保持 Open。

## 信号复核量规门禁

将量规作为复核门禁，不要把它产品化为 Agent 分数。

| 评级 | 使用时机 | 默认路由 |
| --- | --- | --- |
| `Strong` | 至少一个直接门由 `E3` 或更高等级证据支持，路由明确，Lesson 能改变下一次会话 | Candidate Review 或已接受的 Artifact 提案 |
| `Medium` | 证据有用，但路由、边界、可重复性或反例仍需完善 | `Open Case` 或 `Preserve` |
| `Weak` | 信号主要是观察、偏好或低等级证据 | 仅 Draft Case |
| `Blocked` | 缺少证据定位、隐私未解决，或主张与证据不匹配 | 公开复核前先修复证据 |

不要仅因为会话信号强就将其晋级为 Skill。优先选择能改变下一次使用路径的最小 Artifact。

## SKILL Candidate 综合方法

从中性状态开始，再应用直接门。诊断项只用于解释或降级。这些标签是既有复核页面的兼容标签；最终 Artifact 路由可以不是 Skill。

对于单轮普通 Chat 的 Lesson 发现，使用只读的 `evozeus.session-signal.lesson-candidate.v1` 方法。Session Signal 负责高精度纠偏/持久规则识别、通过 cwd 包含关系或调用方提供的唯一 alias 选择已注册目标，以及仅由模型提供的指导。Core 负责可信组件发现、目标清单和有边界的执行；没有后续用户确认，不持久化任何候选。

| 标签 | 使用时机 |
| --- | --- |
| `success_skill_candidate` | 任务已完成，证据显示存在可复用工作流、验收模式或实现过程。 |
| `problem_skill_candidate` | 用户表达不满意、纠偏、问题报告或范围不匹配，且可以转化为护栏或交互规则。 |
| `failure_skill_candidate` | 最终状态确实为 `blocked` / `not_completed`，或工具失败明确导致未恢复的任务失败。 |
| `repeat_skill_candidate` | Agent 回复后用户重复同一未解决意图；展示首次/重复事件对。 |
| `workflow_skill_candidate` | 谨慎使用：只有完成的工作包含可迁移步骤和具体输出证据时才使用。不能仅依据关键句/资源数量赋予此标签。 |
| `review_needed` | 信号混合、不完整，或虽有用但不足以判为高价值。 |
| `not_skill_candidate` | 正常完成、信号低、没有用户纠偏、没有未解决重复、没有有意义失败，也没有可迁移过程。 |

裁剪规则：

- 没有其他直接门的 `completed` 通常变为 `not_skill_candidate`。
- `blocked` 或 `not_completed` 必须来自明确的最终失败/阻塞语义，不能来自过程中的进度文本。
- 已恢复的工具失败属于诊断项，除非它暴露出可复用的 Environment Rule。
- Skill 级 MBTI/人格画像只作为上下文，不能单独创建或升级高价值结论。
- `high_quality_session` 是复核候选，不是已接受的 SKILL Artifact。
- 纠偏或不满意事件应保持可检索，但没有足够上下文可供学习时，不能自动判为高价值。
- `workflow_skill_candidate` 应当很少出现；它需要具体的“改变了什么 / 产出了什么 / 哪个模式可迁移”证据。

## 必要输出：High-Quality Session Review Page

用户要求查看结果时，生成可视化的 High-Quality Session Review Page，不要只给文字结论。

页面必须展示：

- `scanned_sessions_total`
- `analysis_scope`
- `analyzed_sessions_total`
- `not_analyzed_sessions_total`
- `high_quality_sessions` 和 `low_quality_sessions`，只在 `analyzed_sessions_total` 范围内计数

如果 `not_analyzed_sessions_total > 0`，说明这些会话尚未获得质量判断。

每个已分析会话必须获得以下标签之一：

| 页面标签 | 含义 |
| --- | --- |
| `high_quality_session` | 强直接门证据表明存在可复用工作流、纠偏、失败、返工或排障 Lesson。 |
| `low_quality_session` | 正常、低信号、证据不足、仅有诊断信号或仍需复核。 |

每一条高质量记录都必须让 reviewer 可以验证判断。包含：

- 可读标题、原始 `session_id`、`source_ref` 和 Factor 结果源路径
- 内部标签的本地化显示名
- “用户要求了什么”“Agent 做了什么”“使用了哪些工具/资源”的真实短摘录
- 当前判为高质量的原因
- 支持该判断的 Factor 结果
- `factor_result_reasons`：Factor id、信号摘要、分数/统计、置信度、evidence refs
- 支持和反驳该判断的 Factor 结果
- `human_quality_review`：`unreviewed`、`accepted`、`rejected` 或 `needs_more_evidence`

较长的复核界面必须使用分页复核队列。分页控件必须展示当前页、总页数和可见记录数。

只有确有帮助时才使用 native static component，尤其是使用 `ui.native-static.table.v1` 展示证据表。Factor 专属组件建议应写在各自的 `FACTOR.xml` 中，不写在此文件。

## Factor 读取说明

- `official.user-input-sentiment`：在事件层保留后期不满意、纠偏和问题报告。
- `official.task-completion`：作为收束证据处理。最终 `task_complete` 或已验证完成可以覆盖较早失败；之后出现的明确阻塞可以覆盖较早进度。
- `official.repeated-request`：忽略“ok”“继续”“开始”等填充语，除非它们附着在稳定的未解决请求上。
- `official.tool-failure-frequency`：不要把 wrapper 文本计为工具名称。Wrapper 成功不等于命令成功；使用结构化 status、exit code、stderr 以及 call/result 配对。
- `official.session-resource-usage`：已验证 Skill 必须来自显式字段或 Agent 的清楚声明。环境变量和 placeholder 只能作为诊断项。
- `official.key-sentence-trends`：按角色解释。用户意图和 Agent 输出属于不同证据类型。
- `official.semantic-phrase-clusters`：只使用用户直接表达的短语。将 cluster 视为稳定意图证据，不视为质量证明；保留代表性短语、变体、数量和 event refs。

## MBTI 画像综合说明

MBTI/人格画像是根据多个 official Factor 信号综合得到的 Skill 级画像。它不是 official Factor、认证 MBTI 结果或稳定身份标签。必须要求多维证据；信号集薄弱时返回证据不足状态。

## 更新 Session Signal Factor

新增或修改 Factor 时：

1. 先更新 `factors/<factor-slug>/FACTOR.xml`。
2. 保持 `factor.py`、`spec.json` 和测试与契约一致。
3. 只有 Candidate 解释或必要展示发生变化时，才更新此 `SKILL.md`。
4. 运行契约测试和 spec 校验。

<!-- 兼容既有契约测试的规范标记；实际说明以上方中文规则为准。
MBTI/personality profile is a Skill-level composite profile
It is not an official Factor
a certified MBTI result
chat records -> scanner normalization -> factor signals -> ledger read model
proposed verdict -> artifact route -> presentation
finding AI collaboration history
factor.py` is the analysis component for chat records
SKILL Candidate Synthesis Method
every analyzed session must receive one of these labels
why this session is currently judged high-quality
which factor results support that judgment
paginated review queue
Pagination controls must show current page
do not use fixture or mock factor outputs
what the user asked
what the assistant did
which tools/resources were used
-->
