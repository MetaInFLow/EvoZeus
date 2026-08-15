---
name: evozeus-registry-release
description: Use when 处理 EvoZeus registry pointer、默认 official Factor、official Release 引用、manifest 兼容性、checksum、SBOM、attestation、deprecation 或 yank 行为时使用。
---

# EvoZeus Registry Release

主 Repo 负责内置 Factor 内容和 registry pointer。Runtime 从同一产品 Commit 解析内置 Factor，并通过不可变元数据验证独立的第三方 Release。

## Registry 消费流程

```text
EvoZeus registry pointer
  -> official Release manifest
  -> checksum
  -> SBOM / attestation
  -> 选定的 pack
  -> Runtime lockfile
```

## 主 Repo 职责

- 定义 registry schema 和兼容规则
- 指向 allowlist 中的 official Release
- 定义默认 official Factor 集合
- 跟踪频道、版本固定、复核状态、deprecation 和 yank 行为
- 将内置 pack 内容变更路由到 `packs/session-signal/`

## 默认 Official Factor

默认 Factor 必须显式展示：

- default 表示推荐，不表示自动启用
- Runtime 必须展示将要安装或启用的内容
- Runtime 必须验证 manifest、checksum、SBOM / attestation、兼容性和复核状态
- 缺少 Release 元数据时禁止启用

## 边界

- 内置 pack 内容保留在 `packs/session-signal/`。
- 不要引用 lab 的移动分支。
- 不要虚构 manifest、checksum 或 reviewed 状态。
- 不要让 Runtime 绕过 registry pointer。
