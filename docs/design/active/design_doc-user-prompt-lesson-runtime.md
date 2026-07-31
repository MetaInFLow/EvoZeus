# EvoZeus Core UserPromptSubmit Lesson Runtime 设计

状态：对内-未审核；Issue #49 / PR review

## 核心判断

EvoZeus Core 已拥有产品渠道、安装目录、活动渠道状态和本机 dispatcher。普通 Chat 每轮运行所需的渠道解析、组件完整性校验与受限执行应由 Core 统一承担。Session Signal 只提供方法/API；CoEvolve 只管理 Hook 生命周期和项目注册指针。

## 目标

- 在 Core-owned dispatcher 中处理 `UserPromptSubmit`。
- 渠道激活时从该 channel 新安装的 Core root 安装 dispatcher，并做 byte-exact 比较；CoEvolve 版本未变化也不能跳过 Core runtime 更新。
- 只从经过摘要校验的 active Stable/UAT channel 解析 Session Signal。
- 从 `~/.evozeus/.projects` 读取 CoEvolve 注册的 canonical Repo 指针。
- 对 Session Signal 运行固定 version、API、entrypoint 和文件摘要校验。
- 用短 timeout、流式 bounded stdout/stderr、`shell=false` 和 Python isolated mode 执行方法。
- 仅返回 model-only guidance；异常、缺失、损坏与超时全部 fail-open。

## 责任分层

| 层 | 责任 |
| --- | --- |
| Session Signal | correction / durable-rule 判断、目标选择、model guidance API |
| EvoZeus Core | 产品渠道解析、attachment/checksum、target inventory 消费、subprocess transport、隐私与 fail-open |
| CoEvolve | `UserPromptSubmit` Hook 安装、卸载、诊断和 `~/.evozeus/.projects` 指针生命周期 |

## 执行链

```text
UserPromptSubmit
  -> Core-owned installed dispatcher
  -> verified active-channel + channel-state
  -> Core-owned Session Signal attachment contract
  -> fixed ~/.evozeus/.projects inventory
  -> bounded Session Signal subprocess
  -> model-only additionalContext or silent fail-open
```

## 信任与隐私边界

- 活动渠道只接受 `stable` / `uat`，并校验 canonical product-manifest digest。
- Core、Session Signal root 和每个文件都必须处于已验证 install root 内，且路径链不能含 symlink。
- attachment contract 归 Core，并由产品渠道固定；Session Signal repo 不保存 checksum manifest。
- 输入上限为 256 KiB，prompt 上限为 32,000 chars，targets 上限为 256；stdout 与 stderr 在读取期间分别限制为 16 KiB。
- Core 用 `-I -B` 运行摘要固定的纯方法源文件，不把 component 的 scripts/src 目录加入 import path；未列入 attachment 的同名模块无法参与 import。
- 输出不能包含 raw prompt、cwd、canonical path、component path、stderr 或内部诊断。
- `UserPromptSubmit` 不运行 SessionStart 自动更新，不写本地状态，不访问网络。

## 验收

- 自定义 `EVOZEUS_HOME` 与固定用户项目注册目录同时成立。
- correction 可路由到唯一目标；neutral / hypothetical 保持静默。
- stale version、manifest digest mismatch、damaged/symlinked file、import shadow、输出超限、timeout 和 invalid output 均 fail-open。
- Core-only channel 更新会刷新 installed dispatcher；更新失败进入既有 channel transaction rollback。
- 真实 Session Signal companion subprocess smoke 通过，执行前后文件树摘要一致。
- Root `npm test`、Python compile、diff check 和 hosted CI 通过。

## 发布边界

本变更保持 `Unreleased`。本 PR 不下载组件、不切换渠道、不创建 tag 或 Release。后续 Stable release 需要把 Core attachment contract 与 Session Signal `v0.1.1` 文件加入产品清单。

依赖顺序：Core #46 → Core #48 → Core #50。#50 复用 #48 的安装预检、激活与回滚事务。
