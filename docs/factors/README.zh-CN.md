# Factors

- Status: active
- Last updated: 2026-06-15
- Audience: 想查看、安装、实现或贡献因子库的人

## 因子库负责什么

Factor 是绑定到 analysis framework stage 的判断逻辑。它帮助 Agent 从 session 中识别失败、延后、误判、重复纠偏、高质量结果、隐私风险和环境异常。

## 你可能在找

| Need | Read |
| --- | --- |
| 因子相关概念 | [Runtime Concepts](../concepts/runtime.zh-CN.md) |
| 因子协议 | [Factor Analysis Protocol](../reference/factor-analysis-protocol.md) |
| 查看因子报告 | [Reports](../reports/README.zh-CN.md) |
| 开发工作流里的 factor inspect | [Development Workflows](../development/workflows.zh-CN.md) |

## 常见动作

| Action | Purpose |
| --- | --- |
| Inspect | 查看 factor manifest、输入输出、权限、依赖和 fallback |
| Enable | 启用某个本地或社区 factor |
| Update | 升级到新版本 |
| Rollback | 回到旧版本或禁用有问题的 factor |
| Contribute | 提交新的 factor 或 factor 改进 |

## 默认原则

- 默认 factor 应该轻、可解释、可禁用。
- 重依赖、模型调用、网络调用和第三方下载必须 opt-in。
- Factor Result 必须稳定，便于 reports 和 community review 使用。
