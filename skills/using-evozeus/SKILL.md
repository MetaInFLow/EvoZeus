---
name: using-evozeus
description: Use when 用户明确调用 EvoZeus，要求基于已确认的本地 Codex 历史规划或生成 AI 使用画像，为独立 Skillware Repo 接入 CoEvolve Harness，复盘 Agent 工作，捕捉可复用 Lesson，或检查 EvoZeus Stable/UAT 健康状态时使用。将任务路由到一个用户场景，并隐藏内部组件拓扑。
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

## EvoZeus 标签契约

只有在 EvoZeus 本身执行了可识别的生命周期动作时，才使用 EvoZeus 标签：

| 事件 | 格式 |
| --- | --- |
| 明确激活 | `🧙 EvoZeus · 已启动｜<当前任务>` |
| 受管 Skillware 运行 | `👁️ EvoZeus · 受管运行｜<目标 Skillware> · <stable|uat|development>` |
| 发现 Lesson 候选 | `💡 值得记一下：<一句话摘要>。要记下来吗？` |
| 已保存确认的 Lesson | `📝 已记下：<本地记录或 Issue 链接>` |
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

## Lesson 信号

在一个有实质内容的任务结束时，检查会话是否暴露出可复用规则、失败模式、工作流改进、环境修复或产品行为缺口。如果有，添加一行普通对话提示：

```text
💡 值得记一下：<可复用且已脱敏的一句话>。要记下来吗？
```

这只是提案；记录前必须获得用户确认。Claude Code 通过插件的只读 `SessionStart` adapter 加载这项检查。当前插件 manifest 没有暴露等价的 session hook，因此 Codex 通过明确选择或语义选择激活此 Skill。

## 安全边界

- 原始私密会话保留在本地。
- 移除密钥、客户数据、私有路径、未发布代码和不必要的身份信息。
- 只读复盘无需写入确认即可进行。
- 初次安装确认会启用选定频道内的已验证自动更新。切换频道、修改 update policy、修改 GitHub、写入 Harness 或执行外部上传前，先询问用户。
- 只有已验证拥有目标 Repo `ADMIN` 权限的维护者，才可以升级并推送 Harness。

## 完成标准

以结果、证据和一个下一步行动收尾。只有达到所选 Skill 的验证目标，任务才算完成。
