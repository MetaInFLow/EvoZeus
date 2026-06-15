<h1 align="center">
  <img src="assets/icons/evozeus-gold-128.png" alt="EvoZeus gold icon" width="38" align="absmiddle">&nbsp;&nbsp;EvoZeus（宙斯）&nbsp;&nbsp;<img src="assets/icons/evozeus-silver-128.png" alt="EvoZeus silver icon" width="38" align="absmiddle">
</h1>

<p align="center">
  <img src="assets/evozeus-banner.png" alt="EvoZeus banner: put agent sessions on the judgment bench" width="100%">
</p>

<p align="center">
  <a href="#start-here">Start Here</a> ·
  <a href="#what-evozeus-manages">Managed Assets</a> ·
  <a href="#current-repository-surface">Current Surface</a> ·
  <a href="#contribution-loop">Contribution Loop</a> ·
  <a href="docs/README.md">Docs</a>
</p>

## <img src="assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> 把 Agent Session 放上审判台。

**什么该沉淀，什么该修正，什么该淘汰，由证据决定。**

EvoZeus（宙斯）是 Agent Session 的审判层。它不做 Agent 打分，也不把 Skill 当作唯一目标；它管理真实 session 里产生的证据、Case、Verdict 和最终沉淀资产。

EvoZeus 也定义一种新的软件范式：**Skill Driven Software（SDS）**。在 SDS 中，软件行为由 code、scenario skill、factor、rule、report 和 runtime 共同驱动。

> Origin：宙斯的概念诞生于一次不太成功的黑客松之后，[Anthony](https://github.com/HaodiFan) 和 [Neil](https://github.com/orgs/MetaInFLow/people/Neillan96) 两个人的一次复盘。

## <img src="assets/icons/evozeus-silver-128.png" alt="" width="24" align="absmiddle"> Start Here

把这句话复制给你的 Agent：

```text
请读取本仓库的 SKILL.md，并按 EvoZeus 审判当前 Agent Session。先只输出 Session Verdict Card，不写本地文件，不提交 GitHub。
```

## <img src="assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> What EvoZeus Manages

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

## <img src="assets/icons/evozeus-silver-128.png" alt="" width="24" align="absmiddle"> Current Repository Surface

这个仓库当前提供协议、共创面和文档架构；CLI release 尚未进入稳定承诺。开发期 runtime 或 CLI 实现需要在对应 issue / PR 中单独评审，README 只承诺稳定入口。

| Surface | File |
| --- | --- |
| Agent 入口 | [SKILL.md](SKILL.md) |
| 场景 Skill 路由 | [skills/index/SKILL.md](skills/index/SKILL.md) |
| 开发场景 Skill | [skills/evozeus-development/SKILL.md](skills/evozeus-development/SKILL.md) |
| 共创规则 | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 隐私边界 | [docs/governance/privacy-and-redaction.md](docs/governance/privacy-and-redaction.md) |
| PR 规范 | [docs/governance/pr-guidelines.md](docs/governance/pr-guidelines.md) |
| PR 分流状态机 | [docs/governance/pr-routing-policy.md](docs/governance/pr-routing-policy.md) |
| Labels | [docs/governance/labels.md](docs/governance/labels.md) |
| Protected Paths | [docs/governance/protected-paths.md](docs/governance/protected-paths.md) |
| PR Ready 检查 | [scripts/check_pr_ready.py](scripts/check_pr_ready.py) |
| GitHub 自动化脚本 | [scripts/github/](scripts/github/) |
| Candidate Schema | [schemas/candidate.schema.json](schemas/candidate.schema.json) |
| Ontology Layer | [docs/reference/ontology.md](docs/reference/ontology.md) |
| Evidence Grading | [docs/reference/evidence-grading.md](docs/reference/evidence-grading.md) |
| Review Contract | [docs/reference/review-contract.md](docs/reference/review-contract.md) |
| Verdict 类型 | [docs/reference/verdicts.md](docs/reference/verdicts.md) |
| Verdict Card | [docs/reference/verdict-card.md](docs/reference/verdict-card.md) |
| 报告模板 | [docs/reference/report-templates.md](docs/reference/report-templates.md) |
| GitHub Case 模板 | [.github/ISSUE_TEMPLATE/case.yml](.github/ISSUE_TEMPLATE/case.yml) |
| 示例 Case | [examples/cases/tool-resolution-rule/case.md](examples/cases/tool-resolution-rule/case.md) |
| 示例 Report | [examples/reports/session-verdict-report.md](examples/reports/session-verdict-report.md) |

## <img src="assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> Runtime Principles

- **Zero-install by default**：读取 `/skill.md` 不应安装任何包。
- **Local-first**：raw session 默认只留在本地。
- **Markdown/JSON first**：基础报告不依赖 HTML dashboard 或图表包。
- **Opt-in packs**：scanner、factor code、MCP、LLM、可视化包必须按需启用。
- **Manifest before download**：任何 pack 下载前必须展示依赖、权限、输入输出和降级策略。
- **User-approved contribution**：只有用户确认后，才检查 `gh` 并创建 issue / PR。

更多文档入口见 [docs/README.md](docs/README.md)。

## <img src="assets/icons/evozeus-silver-128.png" alt="" width="24" align="absmiddle"> Contribution Loop

主路径是 Agent-assisted PR：

```text
Local Evidence Report -> Agent Review -> Case Draft -> User Approval -> gh PR
```

手动 issue 是 fallback。模板在 `.github/ISSUE_TEMPLATE/`：

- `case.yml`
- `factor.yml`

开发或 PR 前先读取 [skills/evozeus-development/SKILL.md](skills/evozeus-development/SKILL.md)，并运行：

```bash
python3 scripts/check_pr_ready.py
git diff --check
```

GitHub 侧的 labeler、proof gate、privacy scan、dirty PR check、queue guard 和 Candidate schema check 默认以 dry-run 方式运行：它们可以打 label 和更新 marker comment，但不会 approve、merge、promote core Candidate 或自动关闭 PR。

最小 Case 应包含：

```text
session_id
agent_runtime
case_type
evidence
proposed_verdict
privacy_note
```

## <img src="assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> Documentation

README 只保留项目用途、启动语、资产范围、运行原则和贡献入口。完整文档见 [docs/README.md](docs/README.md)。

## <img src="assets/icons/evozeus-silver-128.png" alt="" width="24" align="absmiddle"> Project Tracks

当前架构规划这些工程轨道：

| Track | Outcome |
| --- | --- |
| Protocol Surface | `SKILL.md`、Case 模板、Verdict、隐私门禁 |
| Ontology Layer | Candidate taxonomy、evidence grading、negative patterns、review contract |
| Local Runtime | `.evozeus/` 本地状态、SQLite registry、Markdown/JSON report |
| Developer Workflow | issue、branch、PR、review、pre-submit checks |
| Community Library | Cases、Factors、Habits、Environment Rules、Rejected Patterns |

不在当前轨道内：

- 自动上传 raw session
- 默认安装 scanner / chart / MCP / cloud client
- 自动创建 PR
- 大规模 benchmark

## <img src="assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> License

MIT. See [LICENSE](LICENSE).
