---
name: review-agent-session
description: Use when 用户要求 EvoZeus 复盘 Agent 会话、任务、对话、执行轨迹、diff、报告或最终产出，并判断应保存、修复、晋级、拒绝或调查时使用。
---

# 复盘 Agent 会话

## 必要输入

使用用户已经提供的会话、任务、产出、文件、工具轨迹或 diff。只有在完全没有支撑当前判断的证据时，才请求缺失材料。

## 复盘方法

1. 明确预期结果和完成标准。
2. 从输入、动作、错误、变更、验证和最终产出中提取具体证据。
3. 识别最小且有意义的 Case。
4. 为每个 Case 给出一个拟议 Verdict：
   - `Preserve`
   - `Promote to Skill`
   - `Extract Factor`
   - `Keep as Habit`
   - `Fix Environment`
   - `Reject Pattern`
   - `Open Case`
5. 区分产品缺陷、Skill 缺陷、环境缺陷、证据缺口和用户偏好。
6. 说明杠杆最高的下一步行动以及验证方式。

## 输出

先给出核心判断。只包含证明该判断所需的证据。不要给 Agent 打分，也不要倾倒内部 schema。

存在可复用 Lesson 时，以以下提示收尾：

```text
🧙 EvoZeus · 捕捉到一条 Lesson｜<一句话>。要记录下来吗？
```

用户确认前，不要记录 Lesson。

## 验证目标

- 每个结论都指向可观察证据。
- 每个拟议动作都有明确负责人或路由。
- 私密数据已删除或泛化。
- 回复包含一个主要下一步行动。
