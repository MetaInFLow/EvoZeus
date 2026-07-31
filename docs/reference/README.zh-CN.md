# Reference（参考）

- Status: active
- Last updated: 2026-07-31
- Audience: 需要稳定协议、schema、模板和 contract 的人

## 这里放什么

`reference/` 只放稳定契约。普通读者优先看 [README](../../README.md)、[SKILL](../../SKILL.md) 和 [Docs](../README.md)。

## 当前 Reference

| Reference | 用途 |
| --- | --- |
| [Verdicts](verdicts.md) | Verdict 类型、中文名和含义 |
| [Session Verdict Card](verdict-card.md) | Manual Session Review 默认输出结构 |
| [Report Templates](report-templates.md) | 报告模板和字段结构 |
| [Factor Analysis Protocol](factor-analysis-protocol.md) | Factor 与 analysis framework 的绑定协议 |
| [Scanner Pack Protocol](scanner-pack-protocol.md) | Scanner pack 的结构、resolver、SKILL 和脚本规范 |
| [Source Locator Protocol](source-locator-protocol.md) | SQLite locator envelope 与原文定位协议 |
| [Install Onboarding Conversation](install-onboarding-conversation.md) | `/skill` 安装路径的注册引导、CLI help 调用和能力介绍话术 |
| [Install Preflight](install-preflight.md) | Stable 安装预检、依赖清单、本机状态决策表与 installer 消费边界 |

## 边界

- 概念解释放在 `docs/README.md` 或后续 `concepts/`。
- 稳定 schema、模板和机器可执行契约放在本目录。
