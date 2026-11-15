---
name: capture-evozeus-lesson
description: Use when 用户确认应记录一条 EvoZeus Lesson，或要求把已验证的改进保存为 Case、Skill 变更、规则、习惯、环境修复或其他可复用 Artifact 时使用。
---

# 捕捉 EvoZeus Lesson

Lesson 只有一个去处：它所属 Repo 的 GitHub Issue。不写本地记录，不在 `~/.evozeus/local-records/` 或其他本地目录留副本。

## 确认记录内容

整理一条简洁且已脱敏的 Lesson，包含：

- 观察到的上下文；
- 证据；
- 可复用判断；
- 受影响的 Repo 或产品边界；
- 拟创建的 Artifact；
- 验证目标。

如果用户尚未确认，只询问一次，并在问句里写明要提到哪个 Repo（用 Repo 短名）：

```text
💡 值得记一下：<一句大白话：这次发现了什么，以后会怎么做>。要提到 <repo 短名> 的问题列表吗？
```

无法确定 Repo 时改问：

```text
💡 值得记一下：<一句大白话>。要提到哪个项目的问题列表？
```

## 确定 Repo

| Lesson 结果 | Repo |
| --- | --- |
| EvoZeus 产品行为、协议、CLI、Runtime、内置 pack | `MetaInFLow/EvoZeus` |
| 通用 Harness 契约或独立 Repo 进化生命周期 | `MetaInFLow/EvoZeus-CoEvolve` |
| 目标 Skillware 行为 | 目标 Skill 自己的 Repo |
| 不属于任何 Repo 的个人习惯 | 不记录；告诉用户这条没有合适的项目可提 |

目标 Skill 的 Repo 按以下顺序确定，任何一步对不上就停下来问用户，不猜：

1. `~/.evozeus/.projects/<owner>/<repo>` 登记指向的目录；
2. 该目录 `git remote get-url origin` 解析出的 `owner/repo` 必须与登记一致；
3. `gh repo view <owner>/<repo> --json nameWithOwner,visibility,hasIssuesEnabled` 可访问且开启了 Issue。

将 Lesson 路由到所属 Git Repo 根目录；不要为 package、pack、Skill 目录或其他子目录单独建 Repo。

## 提交 Issue

用户对写明了 Repo 的问句回答"要/好/提吧"等明确同意，即授权在该 Repo 创建**一个** Issue。这不授权代码变更、PR、修复、安装或发布；这些仍要单独询问。若问句里没有写明 Repo，先问清 Repo，再提交。

1. 预检：`gh auth status` 通过，且对目标 Repo 有创建 Issue 的权限。
2. 查重：`gh issue list -R <owner>/<repo> --state all --search "<关键词>"`。已有同类 Issue 时不新建，给出链接，并问是否在原 Issue 下补一条评论。
3. 脱敏：去掉密钥、个人身份、私有路径、未发布代码。Repo 为 **public** 时，还要去掉公司名、客户名、私有项目名、金额和内部系统名，用通用描述代替；如果去掉后读不懂，先把草稿给用户看，确认后再提交，或建议改提到私有 Repo。
4. 提交：`gh issue create -R <owner>/<repo> --title "<一句话结论>" --body-file <临时文件>`；Repo 有 `lesson` label 时加上。正文按"确认记录内容"的六项写。临时文件用完即删。
5. 回报：`📝 已提交：<Issue 链接>`。

提交失败（未安装或未登录 `gh`、无权限、Repo 关闭了 Issue、网络错误）时，不要改写到本地。用一句话说明原因，并把整理好的标题和正文直接贴给用户，方便手动提交。

## 验证目标

- 不依赖原始私密上下文也能理解 Lesson。
- 证据与拟议行为清楚区分。
- 路由明确指向一个 GitHub Repo，且该 Repo 已通过上面的三步核对。
- 公开 Repo 中不出现公司、客户或私有项目信息。
- Artifact 具有可衡量的验证目标。
