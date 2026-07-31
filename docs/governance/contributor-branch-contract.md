# EvoZeus Contributor Branch Contract

- Status: active
- Machine contract: [`contracts/v1/contributor-branch-contract.json`](../../contracts/v1/contributor-branch-contract.json)
- Core issue: [MetaInFLow/EvoZeus#44](https://github.com/MetaInFLow/EvoZeus/issues/44)
- Harness consumer issue: [MetaInFLow/EvoZeus-CoEvolve#36](https://github.com/MetaInFLow/EvoZeus-CoEvolve/issues/36)

任何业务文件写入都必须发生在可追踪的贡献分支与隔离 worktree 中。Contributor branch plan 是首次写入前的治理门禁；机器可执行值只由 v1 JSON contract 定义，本文负责解释使用方式。

沿用现有分支格式：

```text
codex/<type>/<yyyymmdd>-<component>-<summary>
```

## Profiles

| Profile | 场景 | Canonical base | 权限路径 | 关键边界 |
| --- | --- | --- | --- | --- |
| `evozeus_core_direct` | EvoZeus 主仓维护者直接贡献 | 主仓默认分支 | direct | 业务修改必须离开默认分支并进入独立 worktree。 |
| `uat_repair_development` | 唯一 UAT 候选的修复开发 | 当前 UAT ref | direct | 产物始终是 development branch；不得把分支名或状态描述成用户 UAT 渠道。 |
| `community_contribution` | 社区 docs、bug、test 或小型维护 | 主仓默认分支 | direct / fork / local | GitHub 一手权限证据确定 direct、fork 或 local patch。 |
| `coevolve_target_skillware_consumer` | CoEvolve 管理的独立 Skillware Repo | 目标 Repo 默认分支 | direct / fork / local | 关联项必须是目标 Repo 中 OPEN 的 Issue，并带 `skill-feedback` 标签或 `[Skill Feedback]` 标题前缀。 |

## 写入前 Preflight

在 canonical checkout 或已知 Repo 根目录执行只读计划：

```bash
node scripts/evozeus-branch-preflight.mjs plan \
  --profile evozeus_core_direct \
  --repo MetaInFLow/EvoZeus \
  --repo-path /absolute/path/to/EvoZeus \
  --base origin/main \
  --issue MetaInFLow/EvoZeus#44 \
  --actor <expected-github-login> \
  --type dev \
  --component governance \
  --summary branch-contract \
  --permission direct \
  --worktree /absolute/path/to/isolated-worktree \
  --json
```

输出固定包含 repo、base ref/commit、目标 branch、Issue 及其 evidence/source/timestamp、actor、permission path 及其 evidence/source/timestamp、worktree、resume/new decision、next write action、blockers 和 `writes=false`。Preflight 不创建或切换 branch/worktree，不修改 Git config，不 commit、push 或创建 PR；存在 blocker 时以非零状态退出。

## Issue Verification

Planner 通过只读 GitHub API 查询声明的 Issue，并核验 Repo、编号、OPEN 状态与实体类型。查询不可用、返回对象不匹配、Issue 已关闭或编号实际指向 Pull Request 时均阻断。`coevolve_target_skillware_consumer` profile 还要求 `skill-feedback` 标签或 `[Skill Feedback]` 标题前缀，用于确认该 Issue 属于 Skill feedback 治理入口。

## Identity 与 Permission Resolution

`--actor` 与 `--permission` 只声明调用方的预期。Planner 使用只读 GitHub API 取得当前 viewer login、目标 Repo `viewerPermission` 和 fork policy，再确定实际路径：

- `ADMIN`、`MAINTAIN`、`WRITE` 解析为 direct。
- `READ`、`TRIAGE` 且目标 Repo 允许 fork 时解析为 fork。
- 无可验证身份、权限证据不完整、Repo 禁止 fork 或无 PR 能力时解析为 local patch。
- 预期 actor/permission 与证据不一致时阻断。`--repo` 还必须匹配本地 `remote.origin`。

GitHub 权限证据不可用时，权限路径解析为 local patch，且固定 `push_allowed=false`、`pull_request_allowed=false`。Issue 证据不可用时整个计划阻断，因此恢复 API 取证前不得开始业务写入。Repo 内容、合同覆盖文件或命令参数均不能授予 direct/fork 权限。

Branch plan 对 Codex 与 Claude 使用完全相同的输入、判定和输出；Host 不参与身份或权限解析，也不产生分支规则分叉。

## New 与 Resume

- `new`：目标分支不存在，当前 checkout clean 且 HEAD 与 canonical base commit 一致，计划指向新的隔离 worktree。目标路径不得位于任何已注册 worktree 内。
- `resume`：调用方提供之前保存的 plan，resume key、owner、base ref/commit、完整 purpose（type/component/summary）和目标 branch 全部匹配，且 ownership 未过期。目标 worktree 已注册且目录可用时输出 `resume_existing_branch_in_isolated_worktree`；分支仍存在、目标路径不存在且未被其他 worktree 占用时输出零写入 `recreate_resume_worktree_for_existing_branch`；Git 仍保留 prunable registration 时输出 `prune_and_recreate_resume_worktree_for_existing_branch`。后续清理或创建仍需独立授权。
- Resume 未显式提供 `--date` 时，仅从 purpose 完全匹配的既有 plan target branch 恢复原 `yyyymmdd`；无法验证时使用当前日期并由完整 ownership/branch identity 检查继续 fail closed。
- 同名 branch 存在但缺少匹配 plan 时视为 collision。
- owner、base、resume key 不匹配时继续阻断。仅 ownership 时间窗超期且其余身份完全匹配时，Owner 可在 `--resume-plan` 基础上显式增加 `--reconfirm-owner` 生成 refreshed resume plan；持久化 refreshed ledger 仍需独立的 `--approve-save-plan`。

## Fail-Closed Handling

| 状态 | 结果 |
| --- | --- |
| dirty tree | 阻断，先由 Owner 处理已有改动。 |
| current checkout status unavailable | 阻断，修复当前 checkout/index 后重新取证。 |
| canonical checkout dirty/unavailable | 即使当前隔离 worktree clean 也阻断，并输出独立 status evidence。 |
| wrong/missing base | 阻断，重新取得 canonical ref 与 commit。 |
| protected checkout direct write | 阻断，改用外部 worktree。 |
| branch/worktree collision | 阻断，禁止复用来源不明的分支。 |
| requested path nested in any registered worktree | 阻断，选择所有 worktree 外部的隔离路径。 |
| stale ownership | 默认阻断；身份完全匹配时由 Owner 使用 `--reconfirm-owner` 刷新，身份不匹配继续阻断。 |
| actor/permission evidence mismatch | 阻断，以 GitHub viewer 与 Repo 权限证据为准。 |
| permission evidence unavailable | 权限路径解析为 local patch；direct/fork 预期会阻断。 |
| Issue evidence unavailable/mismatched | 阻断，重新取得 live GitHub Issue 证据。 |
| Issue closed or resolves to Pull Request | 阻断，关联 OPEN 的 Issue。 |
| CoEvolve Issue classification missing | 阻断，补齐 `skill-feedback` 标签或 `[Skill Feedback]` 标题前缀。 |

## Approval Boundaries

只读 preflight 可直接运行。Issue 的记录或实现授权不包含 branch/worktree、commit、push 或 PR 授权；每个外部或持久化动作继续使用各自明确的批准门。

多参与者对同一 Issue 并行时，每位参与者使用独立 branch/worktree 与独立 resume key，最后通过 PR review 汇合。任何参与者都不得把 canonical checkout 当作共享写入目录。
