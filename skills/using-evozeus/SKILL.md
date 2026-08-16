---
name: using-evozeus
description: Use when 用户明确调用 EvoZeus，要求基于已确认的本地 Codex 历史规划或生成 AI 使用画像，为独立 Skillware Repo 接入 CoEvolve Harness，复盘 Agent 工作，捕捉可复用 Lesson，或检查 EvoZeus Stable/UAT 健康状态时使用；也用于在业务 Skill 开始前或执行中识别可复用知识、流程纠偏和 Skill/Harness 缺陷，并先暂停任务请求记录 Issue。
---

# 使用 EvoZeus

## 目标

优先完成 EvoZeus 的两个主要结果之一：经确认的本地 AI 使用画像，或面向独立 Skillware Repo 的受治理 CoEvolve Harness。会话复盘、Lesson 捕捉和产品维护作为辅助路由保留。

## 入口行为

路由用户任务前，如果已安装 `~/.evozeus/bin/evozeus version --json`，先运行它。这个只读入口也会根据本地 `update-policy.json` 检查用户选定的 Stable 或 UAT 订阅。只转达用户可见的 `EvoZeus ·` 更新行；检查失败时保留当前已验证版本，然后继续处理用户任务。

被明确调用时，先输出一行简短提示：

```text
🧙 EvoZeus · 已启动｜<当前任务>
```

其余回复保持正常对话形式。除非用户要求，不要打印内部 JSON、版本矩阵、Repo 列表或大段维护横幅。

## 路由一个任务

| 用户意图 | 下一步路由 |
| --- | --- |
| 基于本地 Codex 历史规划或生成 AI 使用画像 | 请用户确认一个精确的 Codex 历史目录，然后运行 `~/.evozeus/bin/evozeus insights plan --source codex --source-path <approved-path> --json`。当前 Release 只支持 Codex。展示精确源目录、脱敏策略、报告位置和确认边界。明确确认前不要读取 Codex 历史、运行 Factor 或写入报告。历史读取仅限已确认目录，后续遵循返回的内置 Runtime 路由，并保留 `--source-path`。 |
| 为 Skillware Repo 接入或检查 CoEvolve Harness | `../evolve-skillware-repo/SKILL.md` |
| 复盘一次会话、任务、产出、diff 或执行 | `../review-agent-session/SKILL.md` |
| 记录已确认的 Lesson 或保存改进 | `../capture-evozeus-lesson/SKILL.md` |
| 安装、对齐版本、切换 stable/UAT、运行 Doctor、更新或回滚 | `../maintain-evozeus/SKILL.md` |

如果意图不清，先检查已有上下文；最多提出一个会实质改变路由的简短问题。

## 指定场景激活示例

以下是语义路由样例，不是关键词清单。表达方式可以变化；先判断用户要达成的结果，再激活对应路径。只要消息同时包含可复用知识、纠偏或行为缺陷，优先进入“学习与纠偏激活协议”，暂停其他路径。

| 指定场景 | 用户示例 | 激活路径 | 首步动作 |
| --- | --- | --- | --- |
| 生成 AI 使用画像 | “请基于我确认的 Codex 历史，生成 AI 使用画像。” | `evozeus insights plan` | 先让用户确认一个精确历史目录；确认前不读取历史、不运行 Factor、不写报告。 |
| 接入或检查 Harness | “把这个独立 Skillware Repo 接入 EvoZeus Harness，并检查是否合规。” | `../evolve-skillware-repo/SKILL.md` | 先确认 canonical Repo、Harness 边界和当前版本，再进入只读检查。 |
| 复盘 Agent 会话 | “复盘刚才这个任务，判断哪里应该沉淀成 Lesson。” | `../review-agent-session/SKILL.md` | 使用已提供的任务、轨迹、diff 和产出提取证据；发现 Lesson 时立即暂停并询问是否记录。 |
| 记录已确认 Lesson | “把刚才确认的经验沉淀成 EvoZeus Issue。” | `../capture-evozeus-lesson/SKILL.md` | 先展示脱敏的待记录内容并确认记录范围；记录授权不包含修复或发布。 |
| 检查或维护 Stable/UAT | “检查当前 UAT 是否健康，并告诉我是否需要对齐。” | `../maintain-evozeus/SKILL.md` | 先运行只读版本、Doctor 或对齐计划；写入、切换、更新和回滚分别确认。 |
| 激活 UAT 候选 | “把已验证的候选版本激活到 UAT，供本地 Harness 试用。” | `../maintain-evozeus/SKILL.md` | 先核对候选 Commit、manifest、Smoke 证据和新会话要求，再请求写入确认。 |
| 发布 Stable | “把已通过 UAT 的 EvoZeus 版本发布为 Stable。” | `../maintain-evozeus/SKILL.md` | 先检查版本、tag、Release Notes 和验收证据；未获发布授权不得上传或发布。 |
| 业务运行中出现纠偏 | “以后周日只收敛上周进度、本周重点和风险；这条先记下来，不要开始执行。” | 学习与纠偏激活协议 | 立即展示 `EvoZeus · Lesson` 待记录提示；确认前不进入业务 Skill、不读取业务数据。 |
| 仅运行普通业务 Skill | “运行源子开发任务管理，整理今天的任务。” | 目标业务 Skill 的入口门禁 | 先执行目标 Skill 自己的捕获优先门禁；没有 Lesson 候选时才进入业务流程。 |

### 激活后的统一边界

- 先输出 `🧙 EvoZeus · 已启动｜<当前任务>`，再输出该场景允许的首步动作。
- 场景激活只代表选择了路由，不代表获得写入、修复、建分支、PR、发布或外部上传授权。
- 任何候选 Lesson 都优先于场景路由；必须先停机、询问是否记录 Issue，得到确认后才执行记录动作。

## EvoZeus 标签契约

只有在 EvoZeus 本身执行了可识别的生命周期动作时，才使用 EvoZeus 标签：

| 事件 | 格式 |
| --- | --- |
| 明确激活 | `🧙 EvoZeus · 已启动｜<当前任务>` |
| 受管 Skillware 运行 | `👁️ EvoZeus · 受管运行｜<目标 Skillware> · <stable|uat|development>` |
| 发现 Lesson 候选 | `🧙 EvoZeus · 捕捉到一条 Lesson｜<一句话摘要>。要先记录为 Issue 吗？` |
| 已保存确认的 Lesson | `📝 EvoZeus · Lesson 已记录｜<本地记录或 Issue 链接>` |
| 需要权限 | `🔐 EvoZeus · 等待确认｜<具体写入或外部动作>` |
| Stable/UAT 决策 | `🧭 EvoZeus · 版本状态｜<频道及明确下一步>` |
| 发现已订阅的新版本 | `🧭 EvoZeus · 发现更新｜<当前频道/版本> → <目标版本>` |
| 产品自动更新进行中 | `🛠️ EvoZeus · 自动更新中｜<受管表面>` |
| 产品自动更新完成 | `✅ EvoZeus · 自动更新完成｜<频道/版本> · <重新加载提示>` |
| 产品自动更新失败 | `🛡️ EvoZeus · 自动更新失败｜<保留的版本及原因>`；产品、bootstrap 或 Plugin 恢复未验证时使用 `恢复未完成` |
| 已批准的进化执行中 | `🛠️ EvoZeus · 进化中｜<Repo> · <已批准的变更>` |
| 单一 UAT 候选已验证 | `🧪 EvoZeus · UAT 就绪｜<Repo> · <候选 Commit>` |
| Stable Release 已发布 | `🚀 EvoZeus · 已发布｜<Repo> · <Release>` |
| 已验证回滚完成 | `↩️ EvoZeus · 已回滚｜<恢复的频道/版本>` |
| 隐私或证据阻塞 | `🛡️ EvoZeus · 暂停｜<缺失或脱敏原因>` |
| 已验证完成 | `✅ EvoZeus · 已验证｜<通过的内容>` |

普通领域分析、每次工具调用或每个段落都不要显示标签。永远不要向用户输出原始捕捉 JSON 块。
规范触发条件和措辞契约见 `../../docs/reference/user-visible-events.md`。

## 学习与纠偏激活协议

这条协议优先于用户意图路由、业务 Skill 路由、工具调用和外部写入。它必须在每次明确调用 EvoZeus 时执行，也必须作为所有受管 Skill 的入口约束被读取。

### 先判断是否出现可复用候选

根据用户消息的场景和意图判断是否出现以下任一情况：用户要求记住、记录、沉淀或写入 Issue；用户纠正当前结果或流程；用户提出以后应重复执行的规则；用户发现 Skill、Harness 或 EvoZeus 行为缺陷；模型判断当前信息对未来运行具有复用价值，即使用户没有明确说“记住”。禁止使用固定关键词、正则或词面命中替代语义判断；示例表达只用于说明场景。

### 捕获优先停机

一旦发现可复用候选，立即暂停原任务：

1. 不进入业务 Skill，不读取业务数据，不调用业务工具，不改文件，不写本地记录，不发消息。
2. 读取目标 Skill 的 `audit-rule.md`，形成一条脱敏、可复用的 Lesson 候选。
3. 独立展示 `EvoZeus · Lesson`“待记录”提示，询问用户是否先记录为 Issue。
4. 用户确认前保持等待；不继续原任务，不创建 Issue，不启动修复。

标准提示：

```text
🧙 EvoZeus · 捕捉到一条 Lesson｜<一句话脱敏摘要>。要先记录为 Issue 吗？
```

### 确认后的边界

- 用户确认后，路由到 `capture-evozeus-lesson`，只执行已确认的记录动作。
- 记录完成后原任务仍保持暂停，等待用户明确要求继续；记录授权不自动包含修复、建分支、改代码、PR、发布或 Harness 变更授权。
- 用户拒绝后丢弃候选；只有用户随后明确要求继续，才恢复原任务。
- 纠偏发生在业务流程已经开始之后，必须在下一次实质性工具调用前暂停并执行同一门禁。
- 只有候选在业务结果收敛阶段才出现时，才使用结束审计兜底；兜底提示仍不得自动持久化。

### 无 Hook 时的行为

Codex 当前没有可靠的原生 `SkillInvoke` 事件；部分宿主也没有 `UserPromptSubmit` Hook。没有 Hook 只会降低自动注入能力，不会取消本协议。每个受管 Skill 必须在自己的入口 `SKILL.md` 中保留这条捕获优先门禁，EvoZeus 只提供公共契约、Notice 渲染和记录路由。

## 安全边界

- 原始私密会话保留在本地。
- 移除密钥、客户数据、私有路径、未发布代码和不必要的身份信息。
- 只读复盘无需写入确认即可进行。
- 初次安装确认会启用选定频道内的已验证自动更新。切换频道、修改 update policy、修改 GitHub、写入 Harness 或执行外部上传前，先询问用户。
- 只有已验证拥有目标 Repo `ADMIN` 权限的维护者，才可以升级并推送 Harness。

## 完成标准

以结果、证据和一个下一步行动收尾。只有达到所选 Skill 的验证目标，任务才算完成。
