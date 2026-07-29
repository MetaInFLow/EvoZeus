# EvoZeus 管理员批量 Harness 升级入口

## 状态

- 状态：开发中
- 日期：2026-07-29
- 后端：EvoZeus-CoEvolve

## 用户目标

管理员只需执行一条 EvoZeus 命令，即可检查全部已注册 Skill，并把可升级目标发布成逐 repo Pull Request。

## CLI 契约

```text
evozeus harness upgrade-all
evozeus harness upgrade-all --publish
```

第一条命令运行只读计划；第二条命令代表明确的本次 GitHub 发布授权。

执行器与发布源分开解析：

- 执行器跟随当前激活频道，使 UAT 可以验证新的批量编排能力。
- Harness 发布源固定为本机已验证 Stable CoEvolve，目标版本与 Stable Product Manifest 一致。
- Stable 已安装但来源缺失、版本不一致时立即阻断，禁止回退到 UAT。
- 仅在无频道状态的本地开发环境中，允许使用显式开发源完成测试。

## Feature 与 Capability

- Feature：`maintain.harness-upgrade-all`
- Capability：`harness.upgradeAllPlan`
- Capability：`harness.upgradeAllPublish`

`harness.upgradeAllPublish` 标记为 high risk，要求 `repo.admin` 和显式 `--publish`。

## 输出

统一返回 EvoZeus envelope，包含：

- 目标数量
- 可发布数量
- 已创建或复用PR
- 权限不足目标
- 验证失败目标
- Run ID和本地审计路径
- 执行器频道、Harness 发布源频道与版本

## 非目标

- 不直接合并PR。
- 不自动发布Skill Release。
- 不修改Skill业务规则。
- 不把UAT Harness发布到目标默认分支。
