---
name: evozeus-doctor-debugging
description: Use when EvoZeus 会话、Runtime、报告、贡献或 Agent 工作流失败、阻塞、缓慢、不稳定或依赖环境时使用。
---

# EvoZeus Doctor 诊断

Doctor 工作要区分环境失败和推理失败。不要把每次失败会话都转化为 Skill 或 Factor。

## 先诊断

对问题分类：

| 信号 | 可能的 Verdict |
| --- | --- |
| 缺少路径、命令、认证、权限、网络、package、shell 或平台能力 | `Fix Environment` |
| 证据不足或相互矛盾 | `Open Case` |
| 已有证据但 Agent 仍重复错误工作流 | `Reject Pattern` 或 `Promote to Skill` |
| Runtime 输出格式错误或不确定 | Execution bug |
| 公开证据包含密钥或私密数据 | 脱敏失败 |

## 收集证据

- 调用的命令或工具
- 完整错误文本
- 变更的文件或 Runtime 状态
- 环境假设
- 预期行为
- 实际行为
- 失败是否可以复现

原始日志保留在本地。如果需要公开 issue 或 PR，应用 `../evozeus-redaction/SKILL.md`。

## 边界

- 没有用户确认，不要安装 package、修改 shell profile、上传日志、编辑密钥或创建 GitHub issue。
- 除非多次会话证明存在通用模式，不要把路径/认证/网络问题归类为可复用 Agent Skill。
- 不要隐藏不确定性。证据薄弱时使用 `Open Case`。

## 输出结构

使用以下顺序：

```text
Symptom -> Evidence -> Classification -> Smallest next check -> Proposed Verdict
```
