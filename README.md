<h1>
  <img src="assets/icons/evozeus-gold-128.png" alt="EvoZeus gold icon" width="38" align="absmiddle">
  EvoZeus（宙斯）
  <img src="assets/icons/evozeus-silver-128.png" alt="EvoZeus silver icon" width="38" align="absmiddle">
</h1>

<p align="center">
  <img src="assets/evozeus-banner.png" alt="EvoZeus banner: put agent sessions on the judgment bench" width="100%">
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="docs/design/active/design_doc-v0.1-agent-session-judgment-layer.md"><img alt="Status: Protocol Bootstrap" src="https://img.shields.io/badge/status-protocol%20bootstrap-555555.svg"></a>
  <a href="docs/governance/privacy-and-redaction.md"><img alt="Privacy: Local First" src="https://img.shields.io/badge/privacy-local%20first-2E7D32.svg"></a>
  <a href="CONTRIBUTING.md"><img alt="Contributions: Cases Welcome" src="https://img.shields.io/badge/contributions-cases%20welcome-C2410C.svg"></a>
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

> Origin：宙斯的概念诞生于一次不太成功的黑客松之后，[Anthony](https://github.com/HaodiFan) 和 [Neil](https://github.com/orgs/MetaInFLow/people/Neillan96) 两个人的一次复盘。

## <img src="assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> Start Here

把这句话复制给 Codex、Claude Code、Cursor、OpenHands、Gemini CLI 或类似 Agent：

```text
请读取 https://evozeus-metainflow.vercel.app/skill.md，并按 EvoZeus 审判当前 Agent Session。
```

## <img src="assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> What EvoZeus Manages

软件开发管理 `code -> issue -> PR -> review -> merge`。

宙斯管理：

```text
Session -> Evidence -> Case -> Verdict -> Artifact -> Library
```

| Asset | Meaning |
| --- | --- |
| Session | 一次真实 Agent 执行 |
| Evidence | 支撑判断的最小证据 |
| Case | 等待审判的发现 |
| Verdict | 审判结果 |
| Artifact | Verdict 落成的资产 |
| Library | 可复用的公共资产库 |

Verdict 不停在观点层。它必须落成 Artifact：

| Verdict | Artifact |
| --- | --- |
| `Promote to Skill` | Skill |
| `Extract Factor` | Factor |
| `Keep as Habit` | Habit |
| `Fix Environment` | Environment Rule |
| `Reject Pattern` | Rejected Pattern |
| `Preserve` | Accepted Case |
| `Open Case` | Pending Case |

## <img src="assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> Current Repository Surface

这个仓库当前提供的是协议和共创面，不是 CLI release。

| Surface | File |
| --- | --- |
| Agent 入口 | [https://evozeus-metainflow.vercel.app/skill.md](https://evozeus-metainflow.vercel.app/skill.md) |
| Skill 源文件 | [SKILL.md](SKILL.md) |
| 共创规则 | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 隐私边界 | [docs/governance/privacy-and-redaction.md](docs/governance/privacy-and-redaction.md) |
| Verdict 类型 | [docs/reference/verdicts.md](docs/reference/verdicts.md) |
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

详细本地状态与 pack 分层见设计文档：
[docs/design/active/design_doc-v0.1-agent-session-judgment-layer.md](docs/design/active/design_doc-v0.1-agent-session-judgment-layer.md)

## <img src="assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> Contribution Loop

主路径是 Agent-assisted PR：

```text
Local Evidence Report -> Agent Review -> Case Draft -> User Approval -> gh PR
```

手动 issue 是 fallback：

- [Submit a Case](https://github.com/MetaInFLow/EvoZeus/issues/new?template=case.yml)
- [Propose a Factor](https://github.com/MetaInFLow/EvoZeus/issues/new?template=factor.yml)

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

Engineering Everything 文档规范：

- Design Doc 放在 `docs/design/{backlog,active,done}/`，用目录表达生命周期。
- ADR 使用连续编号：`docs/decisions/ADR-0001-*.md`。
- 治理文档放在 `docs/governance/`。
- 稳定参考资料放在 `docs/reference/`。

入口见 [docs/README.md](docs/README.md)。

## <img src="assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> Project Tracks

当前只承诺三个工程轨道：

| Track | Outcome |
| --- | --- |
| Protocol Surface | `SKILL.md`、Case 模板、Verdict、隐私门禁 |
| Local Runtime | `.evozeus/` 本地状态、SQLite registry、Markdown/JSON report |
| Community Library | Cases、Factors、Habits、Environment Rules、Rejected Patterns |

不在当前轨道内：

- 自动上传 raw session
- 默认安装 scanner / chart / MCP / cloud client
- 自动创建 PR
- 大规模 benchmark

## <img src="assets/icons/evozeus-gold-128.png" alt="" width="24" align="absmiddle"> License

MIT. See [LICENSE](LICENSE).
