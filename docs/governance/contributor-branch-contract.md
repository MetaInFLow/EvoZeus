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
| `coevolve_target_skillware_consumer` | CoEvolve 管理的独立 Skillware Repo | 目标 Repo 默认分支 | direct / fork / local | 由 CoEvolve #36 消费本合同并保持目标 Repo 的 Owner、Issue、PR 与 Release 边界。 |

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

输出固定包含 repo、base ref/commit、目标 branch、Issue、actor、permission path 及其 evidence/source/timestamp、worktree、resume/new decision、next write action、blockers 和 `writes=false`。Preflight 不创建或切换 branch/worktree，不修改 Git config，不 commit、push 或创建 PR；存在 blocker 时以非零状态退出。

## Identity 与 Permission Resolution

`--actor` 与 `--permission` 只声明调用方的预期。Planner 使用只读 GitHub API 取得当前 viewer login、目标 Repo `viewerPermission` 和 fork policy，再确定实际路径：

- `ADMIN`、`MAINTAIN`、`WRITE` 解析为 direct。
- `READ`、`TRIAGE` 且目标 Repo 允许 fork 时解析为 fork。
- 无可验证身份、权限证据不完整、Repo 禁止 fork 或无 PR 能力时解析为 local patch。
- 预期 actor/permission 与证据不一致时阻断。`--repo` 还必须匹配本地 `remote.origin`。

GitHub 不可用时，输出保留 `source=unavailable` 与检查时间，只允许显式预期为 `local` 的 local patch 计划继续；该路径固定 `push_allowed=false`、`pull_request_allowed=false`。Repo 内容、合同覆盖文件或命令参数均不能授予 direct/fork 权限。

## New 与 Resume

- `new`：目标分支不存在，当前 checkout clean 且 HEAD 与 canonical base commit 一致，计划指向新的隔离 worktree。
- `resume`：调用方提供之前保存的 plan，resume key、owner、base ref/commit 和目标 branch 全部匹配，且 ownership 未过期。
- 同名 branch 存在但缺少匹配 plan 时视为 collision。
- owner、base、resume key 不匹配或 ownership 超期时视为 stale ownership，需要 Owner 重新确认。

## Fail-Closed Handling

| 状态 | 结果 |
| --- | --- |
| dirty tree | 阻断，先由 Owner 处理已有改动。 |
| wrong/missing base | 阻断，重新取得 canonical ref 与 commit。 |
| protected checkout direct write | 阻断，改用外部 worktree。 |
| branch/worktree collision | 阻断，禁止复用来源不明的分支。 |
| stale ownership | 阻断，重新确认 owner 与 base 后生成新 plan。 |
| actor/permission evidence mismatch | 阻断，以 GitHub viewer 与 Repo 权限证据为准。 |
| GitHub evidence unavailable | 解析为 local patch；direct/fork 预期会阻断。 |

## Approval Boundaries

只读 preflight 可直接运行。Issue 的记录或实现授权不包含 branch/worktree、commit、push 或 PR 授权；每个外部或持久化动作继续使用各自明确的批准门。

多参与者对同一 Issue 并行时，每位参与者使用独立 branch/worktree 与独立 resume key，最后通过 PR review 汇合。任何参与者都不得把 canonical checkout 当作共享写入目录。
