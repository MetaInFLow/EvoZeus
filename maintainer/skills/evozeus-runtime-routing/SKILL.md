---
name: evozeus-runtime-routing
description: Use when 从主 Repo 上下文将已确认的 EvoZeus Runtime 行为、本地 registry、CLI、TUI、browser companion、workspace 状态、scanner 执行、Factor 执行或报告执行路由到 evozeus-runtime 时使用。
---

# EvoZeus Runtime 路由

Runtime 路由保持 local-first 行为和用户确认门禁。`EvoZeus` 主 Repo 只负责 Protocol；Runtime 实现属于 `evozeus-runtime`。此 Skill 负责从主 Repo 上下文向 Runtime 组件交接路由和信任策略。

## Runtime 原则

- 根 `SKILL.md` 和 `/skill` 默认 zero-install。
- Local-first：原始会话和 Runtime 状态保留在 `~/.evozeus/` 下。
- 先使用 Markdown/JSON，再考虑 dashboard 或 chart。
- scanner、Factor 代码、MCP、LLM、browser 或可视化行为均使用 opt-in pack。
- 下载前先查看 manifest：展示依赖、权限、输入、输出和 fallback。
- 上传、GitHub issue、PR 或外部同步前需要用户确认。

## 用户旅程中的角色

Runtime 是完成注册、skeleton 安装和 Skill 安装后的可选组件组装：

```text
Web /skill
  -> EvoZeus 安装与注册
  -> EvoZeus skeleton + Skill 已安装
  -> 用户确认启用 Runtime
  -> 读取 evozeus-runtime/SKILL.md
  -> Runtime 读取 EvoZeus registry pointer
  -> Runtime 验证默认 official Factor
  -> Runtime 执行本地判断
```

不要静默安装、扫描、联网或创建本地状态。启用 Runtime 前展示将读取、写入、安装和验证的内容。

## 交接

Runtime 获得确认后：

1. 读取组件 Repo 根部的 `evozeus-runtime/SKILL.md`。
2. 说明请求的能力：scanner 执行、Factor 执行、本地 registry、报告生成、TUI、browser companion 或 Runtime 开发。
3. 说明要读取的文件、要写入的文件、要运行的命令、依赖、网络行为、回滚路径和隐私影响。
4. Runtime Repo 缺少所需 manifest、checksum、attestation、lockfile schema 或实现时停止。

## 默认 Official Factor

用户要求使用默认 Factor 时，此 Skill 只负责消费路由。Registry 发布或默认集合变更归 `../evozeus-registry-release/SKILL.md` 负责。

1. 读取 `EvoZeus` 主 Repo 的 registry pointer。
2. 只解析 official Release manifest。
3. 验证 checksum、SBOM / attestation、兼容性和复核状态。
4. 只启用用户选定的 Factor。
5. 将原始会话数据保留在本地。

缺少 registry pointer、manifest、checksum 或 attestation 时停止，并报告阻塞原因；不要虚构安装路径。

## Runtime 范围

Runtime PR 应说明变更的表面：

| 表面 | 示例 |
| --- | --- |
| 本地 registry | session ID、Artifact 索引、cache |
| 报告生成 | Markdown/JSON Evidence Report |
| Doctor 实现 | 诊断确认需要 Runtime 变更后的环境检查实现 |
| TUI | 本地复核流程 |
| Browser companion | 可选的本地 UI 检查 |
| 用户 home 状态 | `~/.evozeus/` 结构和清理 |

这些表面的实现 PR 提交到 `evozeus-runtime`。主 Repo 变更应限于协议、schema、信任策略、registry pointer 或路由文档。

## 必要检查

Runtime 工作应包含：

- 复现步骤或真实行为证明
- 补丁后的执行命令
- 修改前后输出或生成的 Artifact
- 隐私影响
- 可选依赖不可用时的 fallback

主 Repo 协议或路由变更使用合适的 `../../../.github/PULL_REQUEST_TEMPLATE/*` 模板，并运行 `python3 scripts/check_pr_ready.py --base <base-ref>`。Runtime 实现应在 `evozeus-runtime` 中创建 PR，并运行该 Repo 的检查。

## 边界

- `/skill` 注册或 skeleton/Skill 安装使用 `../evozeus-install-registration/SKILL.md`，不要使用此 Skill。
- 报告内容撰写使用 `../evozeus-reporting/SKILL.md`；只有需要本地文件生成或 Runtime 执行时才使用此 Skill。
- 首轮诊断使用 `../evozeus-doctor-debugging/SKILL.md`，不要使用此 Skill。
- 不要绕过主 registry pointer，也不要将 lab 的 `reviewed` Artifact 当作默认可安装的用户 Release。
