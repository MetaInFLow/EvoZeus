---
name: evozeus-redaction
description: Use when 准备公开分享的 EvoZeus 证据、报告、日志、截图、示例、issue、pull request 或会话摘录时使用。
---

# EvoZeus 脱敏

公开的 EvoZeus Artifact 必须保留判断价值，同时移除私密数据。原始会话不能作为公开贡献材料。

## 删除或泛化

始终删除：

- 密钥、token、cookie、凭据、私钥
- 客户名称、用户名称、邮箱、电话、地址、账户 ID
- Case 不需要的私有本地路径
- 未发布代码、专有 prompt、私有配置
- 暴露私密工作的原始截图或日志

细节有用但可能识别个人或组织时，进行泛化：

| 私密细节 | 公开替代内容 |
| --- | --- |
| `/Users/alice/company/client-x/project` | `/private/workspace/project` |
| 真实客户名称 | `Customer A` |
| 完整 token 或 key | `[REDACTED_SECRET]` |
| 内部 URL | `https://internal.example/redacted` |

## 保留判断价值

不要过度脱敏到证据失去意义。保留：

- 失败类型
- 相关命令形态
- Artifact 类型
- 环境类别
- 修改前后行为
- 面向 reviewer 的限制

## 公开门禁

创建 issue、PR 或示例前，检查：

- Artifact 是否只包含必要的最小证据？
- reviewer 是否无需私密上下文即可理解 Case？
- 隐私说明是否写明删除或泛化了什么？
- 贡献是否遵循 `../../../docs/governance/privacy-and-redaction.md`？

如有疑问，将 Artifact 保留在本地并请求 owner review。
