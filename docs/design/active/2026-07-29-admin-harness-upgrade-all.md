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

第一条命令运行只读计划；第二条命令代表明确的本次 GitHub 发布授权。EvoZeus 将当前 Product Manifest 中的 CoEvolve 版本与路径传给后端，禁止从临时目录或未绑定通道的实现执行。

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

## 非目标

- 不直接合并PR。
- 不自动发布Skill Release。
- 不修改Skill业务规则。
- 不把UAT Harness发布到目标默认分支。

