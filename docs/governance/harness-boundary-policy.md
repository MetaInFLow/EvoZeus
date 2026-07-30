# EvoZeus Harness 边界策略

- 状态：canonical
- 生效日期：2026-07-30
- Owner：MetaInFlow / EvoZeus maintainers
- 决策依据：[`ADR-0005`](../decisions/ADR-0005-plugin-first-monorepo-and-repo-scoped-harness.md)

## 规则

1. 只有独立 Git Repo 可以拥有进化 Harness。
2. 一个 Repo 最多一个活动 Harness。
3. 活动 Harness 只能位于 Repo 根目录的 `.evozeus-wrapper/`。
4. `.evozeus_evoinfra/` 仅用于旧 Repo 迁移识别，不允许新建。
5. package、pack、Skill、app、example 和 fixture 继承所在 Repo 的根 Harness。
6. 内部模块要获得独立 Harness，必须先拆成独立 Repo，并明确 Owner、版本、Issue、PR、UAT 和 Release 边界。
7. 归档 Repo 不接受自动升级、Lesson 写入或新维护 PR。

## 判定示例

| 路径 | 判定 | 原因 |
| --- | --- | --- |
| `.evozeus-wrapper/wrapper.json` | 允许 | Repo 根 Harness |
| `packages/runtime/.evozeus-wrapper/wrapper.json` | 拒绝 | package 不是独立 Repo |
| `plugin/skills/review/.evozeus-wrapper/` | 拒绝 | Skill 继承主 Repo Harness |
| `packs/session-signal/.evozeus_evoinfra/` | 拒绝 | 内置 pack 且使用旧布局 |
| 独立 `EvoZeus-CoEvolve/.evozeus-wrapper/` | 允许 | 独立 Repo 根 Harness |

## CI 门禁

主仓运行 `npm run test:harness-boundary`：

- 枚举 Git 跟踪与待提交文件。
- 允许根 `.evozeus-wrapper/`。
- 拒绝任何更深层级的 `.evozeus-wrapper/`。
- 拒绝所有 `.evozeus_evoinfra/` 新文件。

该门禁只判断源码布局，不扫描用户目录，不读取 raw session，不修改任何 Repo。

## 管理员权限

Harness 版本升级和向目标 Repo 推送变更属于维护操作。执行者必须同时具备：

- 目标 Repo 的写权限；
- 目标 Repo Harness policy 允许的 maintainer 身份；
- 对应 PR、UAT 和 Release 门禁权限。

普通用户可以运行只读检查、生成升级计划和验证结果；不得直接覆盖或上传 Harness。

