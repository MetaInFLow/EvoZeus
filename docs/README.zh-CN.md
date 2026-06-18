<h1 align="center">
  <img src="../assets/icons/evozeus-gold-128.png" alt="EvoZeus gold icon" width="38" align="absmiddle">&nbsp;&nbsp;EvoZeus（宙斯）&nbsp;&nbsp;<img src="../assets/icons/evozeus-silver-128.png" alt="EvoZeus silver icon" width="38" align="absmiddle">
</h1>

<p align="center">
  <a href="../README.md">English</a> · <strong>简体中文</strong>
</p>

<p align="center">
  <img src="../assets/evozeus-banner.png" alt="EvoZeus banner: put agent sessions on the judgment bench" width="100%">
</p>

<p align="center">
  <a href="#start-here">Start Here</a> ·
  <a href="#what-evozeus-manages">Managed Assets</a> ·
  <a href="#use-paths">Use Paths</a> ·
  <a href="#contribution-quick-path">Contribution</a> ·
  <a href="#docs-by-goal">Docs by Goal</a> ·
  <a href="README.md">Full Docs</a>
</p>

## <img src="../assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> 把 Agent Session 放上审判台。

**什么该沉淀，什么该修正，什么该淘汰，由证据决定。**

EvoZeus（宙斯）是 Agent Session 的审判层。它不做 Agent 打分，也不把 Skill 当作唯一目标；它管理真实 session 里产生的证据、Case、Verdict 和最终沉淀资产。

EvoZeus 也定义一种新的软件范式：**Skill Driven Software（SDS）**。在 SDS 中，软件行为由 code、scenario skill、factor、rule、report 和 runtime 共同驱动。

> Origin：宙斯的概念诞生于一次不太成功的黑客松之后，[Anthony](https://github.com/HaodiFan) 和 [Neil](https://github.com/orgs/MetaInFLow/people/Neillan96) 两个人的一次复盘。

## <img src="../assets/icons/evozeus-silver-128.png" alt="" width="24" align="absmiddle"> Start Here

把这句话复制给你的 Agent：

```text
请读取本仓库的 SKILL.md，并按 EvoZeus 审判当前 Agent Session。先只输出 Session Verdict Card，不写本地文件，不提交 GitHub。
```

如果你来自 `https://evozeus-community.vercel.app/skill`，那一步只负责注册和安装：先读 [EvoZeus-Install Registration](../skills/evozeus-install-registration/SKILL.md)，检查 `.evozeus` 是否已注册，安装 EvoZeus skeleton 和 EvoZeus skills。runtime、默认 official factors、本地扫描、报告文件和 GitHub 贡献都必须等用户明确批准。

## <img src="../assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> Registration / Install Sequence

Community `/skill` 只指导注册和安装，不直接运行 judgment 或 runtime。安装必须同时安装协议 skeleton 和 EvoZeus skills。

```mermaid
sequenceDiagram
  autonumber
  participant User
  participant Community as evozeus-community /skill
  participant Installer as Agent / installer
  participant Local as Local workspace
  participant Main as EvoZeus repo
  participant Skills as EvoZeus skills
  participant Runtime as evozeus-runtime

  User->>Community: Open /skill
  Community-->>User: Registration and install guide
  User->>Installer: Start install / setup
  Installer->>Local: Check .evozeus registration state

  alt .evozeus exists and registered
    Installer->>Main: Check EvoZeus skeleton version
    Installer->>Skills: Check installed EvoZeus skills
    Installer-->>User: Report current install / update plan
  else no .evozeus or not registered
    Installer->>Local: Create .evozeus registration state
    Installer->>Main: Install EvoZeus skeleton
    Installer->>Skills: Install EvoZeus skills
    Installer-->>User: Report installed skeleton and skills
  end

  Installer-->>User: Ready for protocol-only judgment
  User->>Installer: Run EvoZeus judgment
  Installer->>Main: Read SKILL.md
  Installer-->>User: Session Verdict Card

  opt User approves local runtime
    Installer->>Runtime: Handoff through EvoZeus-Runtime Routing
  end
```

| Step | 当前状态 |
| --- | --- |
| Community `/skill` | 只路由到注册和安装 |
| `.evozeus` registration | 已存在时先检查是否已注册 |
| EvoZeus install | 安装 protocol skeleton 和 EvoZeus skills |
| Protocol-only judgment | 安装后、用户确认后输出 Session Verdict Card |
| Runtime approval | 本地扫描、runner、report execution 都必须另行批准 |

## <img src="../assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> What EvoZeus Manages

软件开发管理 `code -> issue -> PR -> review -> merge`。

宙斯管理：

```text
Session -> Evidence -> Case -> Verdict -> Artifact -> Library
```

| Term | 中文名 | Meaning |
| --- | --- | --- |
| Session | 会话 | 一次真实 Agent 执行 |
| Evidence | 证据 | 支撑判断的最小证据 |
| Case | 案件 | 等待审判的发现 |
| Verdict | 裁决 | 基于 Evidence 对 Case 给出的结果 |
| Artifact | 沉淀资产 | Verdict 落成后的可执行或可复用资产 |
| Library | 资产库 | 可复用的公共资产集合 |

Verdict（裁决）需要落成 Artifact：

| Verdict | Artifact |
| --- | --- |
| `Promote to Skill` | Skill |
| `Extract Factor` | Factor |
| `Keep as Habit` | Habit |
| `Fix Environment` | Environment Rule |
| `Reject Pattern` | Rejected Pattern |
| `Preserve` | Accepted Case |
| `Open Case` | Pending Case |

## <img src="../assets/icons/evozeus-silver-128.png" alt="" width="24" align="absmiddle"> Use Paths

EvoZeus 现在首先是一个 **agent-readable protocol repo**，不是稳定 CLI 产品。README 只给最短路径；完整规则在 docs 和 skills 里。

| Goal | Start here | Output |
| --- | --- | --- |
| 注册并安装 EvoZeus | [EvoZeus-Install Registration](../skills/evozeus-install-registration/SKILL.md) | `.evozeus` 注册状态、skeleton、skills inventory |
| 审判一次 Agent Session | [SKILL.md](../SKILL.md) | Session Verdict Card |
| 选择具体工作场景 | [EvoZeus-Skill Index](../skills/index/SKILL.md) | `EvoZeus-Development` / `EvoZeus-Community Contribution` / `EvoZeus-Reporting` / `EvoZeus-Runtime Routing` |
| 开发 EvoZeus 本身 | [EvoZeus-Development](../skills/evozeus-development/SKILL.md) | 小范围 issue/branch/PR |
| 贡献 Case 或 Candidate | [CONTRIBUTING.md](../CONTRIBUTING.md) | redacted Case / Candidate PR |
| 审查 PR 规范 | [docs/governance/pr-guidelines.md](governance/pr-guidelines.md) | proof-backed PR |
| 理解核心语义 | [docs/reference/ontology.md](reference/ontology.md) | Candidate / Evidence / Verdict 边界 |

## <img src="../assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> Safety Defaults

EvoZeus 的默认路径是低权限、可审查、可撤回的。

- **Zero-install entry**：读取 `SKILL.md` 不应安装任何包。
- **Skeleton first**：第一轮 judgment 只在回复里输出 Session Verdict Card，不写 `.evozeus/` runtime state。
- **Local-first evidence**：raw session 默认只留在本地，不进入公共 PR。
- **Redacted public artifacts**：公开 Case、Candidate、Report 必须先脱敏。
- **Markdown/JSON first**：基础报告和 schema 不依赖 dashboard、scanner 或云服务。
- **Opt-in runtime packs**：scanner、factor code、MCP、LLM、可视化包必须按需启用。
- **User-approved contribution**：只有用户确认后，才检查 `gh` 并创建 issue / PR。

## <img src="../assets/icons/evozeus-silver-128.png" alt="" width="24" align="absmiddle"> Contribution Quick Path

主路径是 agent-assisted，但合并权仍归 maintainer：

```text
Local Evidence Report -> Agent Review -> Case Draft -> User Approval -> PR -> Maintainer Review
```

开发或 PR 前先运行：

```bash
python3 scripts/check_pr_ready.py
git diff --check
```

最小 Case：

```yaml
session_id: redacted-session-id
agent_runtime: codex | claude | cursor | other
case_type: preserve | promote | fix | reject | open
evidence: redacted command output, diff, tool trace, or report excerpt
proposed_verdict: Preserve | Promote to Skill | Extract Factor | Keep as Habit | Fix Environment | Reject Pattern | Open Case
privacy_note: what was removed or generalized
```

GitHub automation is dry-run by default: labeler、proof gate、privacy scan、dirty PR check、queue guard 和 Candidate schema check 可以打 label 和更新 marker comment，但不会 approve、merge、promote core Candidate 或自动关闭 PR。

## <img src="../assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> Docs by Goal

| Need | Read |
| --- | --- |
| 文档总入口 | [docs/README.md](README.md) |
| Evidence 等级 | [docs/reference/evidence-grading.md](reference/evidence-grading.md) |
| Review contract | [docs/reference/review-contract.md](reference/review-contract.md) |
| Verdict 类型 | [docs/reference/verdicts.md](reference/verdicts.md) |
| Verdict Card | [docs/reference/verdict-card.md](reference/verdict-card.md) |
| 报告模板 | [docs/reference/report-templates.md](reference/report-templates.md) |
| Candidate Schema | [schemas/candidate.schema.json](../schemas/candidate.schema.json) |
| 隐私与脱敏 | [docs/governance/privacy-and-redaction.md](governance/privacy-and-redaction.md) |
| PR 分流状态机 | [docs/governance/pr-routing-policy.md](governance/pr-routing-policy.md) |
| Factor registry 治理 | [docs/governance/factor-registry-governance.md](governance/factor-registry-governance.md) |
| 上线评判标准 | [docs/governance/launch-readiness-criteria.md](governance/launch-readiness-criteria.md) |
| Labels 与 protected paths | [docs/governance/labels.md](governance/labels.md), [docs/governance/protected-paths.md](governance/protected-paths.md) |

## <img src="../assets/icons/evozeus-silver-128.png" alt="" width="24" align="absmiddle"> What Exists Today

| Area | Status |
| --- | --- |
| Protocol Surface | `SKILL.md`、场景 skills、Verdict、Case 模板、隐私门禁 |
| Ontology Layer | Candidate taxonomy、evidence grading、negative patterns、review contract |
| Developer Workflow | branch 规范、PR 模板、dry-run governance gates、pre-submit checks |
| Public Examples | redacted Case、Evidence Report、valid/invalid Candidate examples |
| Factor Surface | 公开 Factor Candidate 入口和 registry pointer；可执行 packs 不放在本 repo |

Planned but not stable yet:

- Local Runtime：`.evozeus/` 本地状态、SQLite registry、Markdown/JSON report
- Community Library：Cases、Factor references、Habits、Environment Rules、Rejected Patterns
- CLI / TUI / browser companion

Not promised:

- 自动上传 raw session
- 默认安装 scanner / chart / MCP / cloud client
- 自动创建 PR
- 大规模 benchmark

## <img src="../assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> License

MIT. See [LICENSE](../LICENSE).
