# Launch Readiness Criteria

- Status: draft
- Last updated: 2026-06-18

本文定义 EvoZeus 的上线评判标准。这里的“上线”不是单一发布按钮，而是把仓库、协议、贡献流程、自动化门禁或未来 runtime 推到更大使用范围前的准入判断。

EvoZeus 当前首先是 agent-readable protocol repo，不是稳定 CLI 产品。因此上线评估的核心不是功能数量，而是：真实用户能否按文档完成最小闭环，证据是否足够支撑判断，隐私边界是否守住，贡献和回滚路径是否可审查。

## 1. 上线分层

| Level | 名称 | 允许范围 | 核心承诺 |
| --- | --- | --- | --- |
| `L0` | Internal Trial | maintainer / 内部协作者试用 | 可以手工跑通一次审判流程，不承诺外部贡献体验 |
| `L1` | Protocol Preview | 公开 README、SKILL 和基础 docs | 外部用户能理解定位，并用手工方式产出 Session Verdict Card |
| `L2` | Public Contribution Beta | 开放 issue / PR / Candidate 贡献 | 外部贡献者有清晰模板、证据门槛、隐私规则和 dry-run gate |
| `L3` | Core Library Stable | 推广 reviewed/core Candidates、Skills、Factors | 核心资产有 E4 级证据、owner review、回滚或废弃路径 |
| `L4` | Runtime Product Launch | 发布 CLI/TUI/browser companion/cloud 等 runtime | 自动采集、存储、报告、权限、安全和失败降级都稳定可验 |

当前仓库的合理近期目标是 `L2 Public Contribution Beta`。`L3` 只适用于被稳定复用的 core assets；`L4` 需要 runtime 实现后另行评估。

## 2. Go / No-Go 规则

上线判断先看阻断项，再看成熟度分数。任何阻断项未通过，都不能用平均分抵消。

### 2.1 阻断项

| Gate | Go 条件 | No-Go 条件 |
| --- | --- | --- |
| Product Boundary Gate | README 明确说明当前承诺和不承诺内容 | 用户会误以为已有稳定 CLI、云端上传或自动 PR |
| Minimal Loop Gate | 能跑通 `Session Summary -> Evidence Packet -> Draft Case -> Candidate -> Verdict -> Artifact` 的手工闭环 | 只能产出观点，不能形成 evidence-backed Verdict |
| Evidence Gate | Public Case 至少 `E2`，Candidate Review 至少 `E3`，core/high-risk 至少 `E4` | 只有主观判断、回忆或 LLM reasoning |
| Privacy Gate | 不发布 raw session、secret、客户信息、私有路径和未脱敏专有代码 | 公开材料需要依赖 raw private session 才能理解 |
| Governance Gate | 高风险路径有 owner/maintainer review，bot 不 approve、不 merge、不 promote | instruction、schema、workflow、privacy policy 可无审查变更 |
| Automation Gate | 当前上线范围内的本地和 CI 检查可运行、可解释失败 | gate 缺失、不可重复，或 automation 行为和文档承诺不一致 |
| Security Gate | GitHub workflow 权限最小化，`pull_request_target` 不 checkout 不可信 PR head | workflow 可被外部 PR 触发写权限或泄露 secret |
| Rollback Gate | 每个公开承诺都有回滚、废弃或降级路径 | 发布后只能继续扩大承诺，无法撤回错误资产 |

### 2.2 成熟度评分

阻断项全部通过后，再用 100 分衡量上线成熟度。

| 维度 | 权重 | 通过标准 |
| --- | ---: | --- |
| 定位与承诺清晰度 | 15 | 用户能在 5 分钟内理解 EvoZeus 是 judgment layer，不是 agent score 或稳定 runtime |
| 最小闭环可用性 | 20 | 新用户能按文档完成一次 Verdict Card 或最小 Evidence Packet |
| 证据与语义质量 | 20 | Case、Candidate、Verdict、Artifact 边界清楚，证据等级可复核 |
| 隐私与安全 | 15 | public artifact 全部可脱敏复核，贡献前需要用户确认 |
| 贡献与治理流程 | 10 | issue/PR/template/review state/owner review 路径明确 |
| 自动化与验证 | 10 | `check_pr_ready.py`、`git diff --check`、相关 GitHub gate 测试通过 |
| 文档一致性 | 5 | README、docs index、governance docs、reference docs 对同一规则无冲突 |
| 维护可持续性 | 5 | maintainer 能解释失败、限制并处理积压，不依赖隐性人工知识 |

建议阈值：

| 决策 | 分数 | 解释 |
| --- | ---: | --- |
| `Go` | `>= 85` | 可以按目标 level 上线 |
| `Conditional Go` | `70-84` | 可以小范围上线，但必须列出限时修复项 |
| `No-Go` | `< 70` | 不应扩大公开使用范围 |

## 3. 各上线层级的验收标准

### L1 Protocol Preview

必须满足：

- `README.md` 和 `docs/README.zh-CN.md` 说明定位、Use Paths、Safety Defaults 和 Not promised。
- `SKILL.md` 作为 zero-install entry 可读，不要求安装依赖。
- 至少有一条手工路径能输出 Session Verdict Card。
- 文档明确 raw session 默认本地保存，不自动上传。
- `docs/reference/verdict-card.md`、`docs/reference/evidence-grading.md`、`docs/reference/verdicts.md` 能支撑基础审判。

通过信号：

- 首次用户不需要理解全部治理文档，也能完成一次“只输出 Verdict Card”的试用。
- 用户不会把 EvoZeus 误解为自动评分系统或稳定 runtime。

### L2 Public Contribution Beta

必须满足：

- `.github/ISSUE_TEMPLATE/` 和 `.github/PULL_REQUEST_TEMPLATE/` 覆盖 Case、Candidate、schema、skill、governance、docs/example 等常见贡献。
- `docs/governance/pr-guidelines.md` 明确 PR unit、evidence proof、AI-assisted PR、pre-PR checks。
- `docs/governance/privacy-and-redaction.md` 和 privacy scan 能阻止明显敏感信息进入公开贡献。
- `docs/governance/candidate-lifecycle.md` 定义 `community -> reviewed -> core -> deprecated`。
- `ZEUS_STATUS.yml` 明确 automation 仍是 dry-run，`auto_approve`、`auto_merge`、`auto_close` 都为 false。
- 本地至少通过：

```bash
python3 scripts/check_pr_ready.py
git diff --check
```

如果改动 GitHub governance automation，还必须通过：

```bash
npm ci
npm run test:github-gates
node scripts/github/candidate-schema-check.mjs
```

通过信号：

- 外部贡献者知道“该提交什么、证据怎么写、什么不能公开、为什么被拒绝”。
- bot 只做 label/comment/status，不做 approve/merge/promote/auto-close。

### L3 Core Library Stable

必须满足：

- core asset 有 `E4 Reproducible Proof`，或至少两次独立 session 的可复核证据。
- owner/maintainer review 已完成，并记录 residual risk。
- `when to use`、`when NOT to use`、counterexamples、rollback/deprecation path 全部存在。
- asset 没有未解决 privacy risk、prompt injection risk 或高风险 instruction ambiguity。
- 修改 `SKILL.md`、`skills/`、`schemas/`、`docs/reference/ontology.md`、`docs/reference/evidence-grading.md` 等高风险路径时，必须经过显式 owner review。

通过信号：

- 该资产可以被其他 agent 或 maintainer 复用，而不需要原作者口头解释。
- 如果未来发现错误，可以定位证据、撤回推荐或迁移到 `deprecated`。

### L4 Runtime Product Launch

`L4` 当前不是仓库现状目标。未来 runtime 上线必须额外满足：

- session event schema、local registry、report generation、权限模型和失败降级稳定。
- 默认 local-first，不默认上传 raw session。
- 用户能清楚控制哪些内容进入本地、GitHub 或未来 cloud。
- runtime 输出和 Markdown/JSON schema 兼容。
- 有针对 CLI/TUI/browser companion 的安装、升级、回滚、日志、错误处理和兼容性测试。
- 有 security review，覆盖 secret handling、filesystem boundary、network contribution、dependency supply chain。

## 4. 上线决策包

每次准备上线或扩大使用范围时，maintainer 应形成一个最小决策包：

```text
Target level:
Release scope:
Public promises:
Out of scope:
Changed surfaces:
High-risk paths:
Evidence packet:
Highest evidence grade:
Validation commands:
Validation result:
Privacy note:
Owner review:
Rollback / deprecation path:
Known residual risk:
Decision: Go | Conditional Go | No-Go
Decision owner:
Decision date:
```

决策包可以放在 release issue、PR 描述、RFC 或 release notes 中。高风险上线不应只靠聊天结论。

## 5. 当前项目建议评估方式

对当前 EvoZeus 仓库，建议把上线评估拆成三次判断：

1. `L1 Protocol Preview`：确认 README、SKILL、Verdict Card、Evidence Grading 和 Minimal Loop 是否足够让新用户完成第一次手工审判。
2. `L2 Public Contribution Beta`：确认 GitHub templates、privacy/redaction、PR guidelines、candidate lifecycle、dry-run gates 和本地检查是否闭环。
3. `L3 Core Library Stable`：只针对少数 promoted assets 单独评估，不对整个仓库一次性宣布 stable。

默认结论建议：

- 若所有本地检查通过，当前仓库可以按 `L2 Public Contribution Beta` 准备发布。
- 不建议声明 `L3 Core Library Stable`，除非已有 core assets 达到 `E4` 并完成 owner review。
- 不建议声明 `L4 Runtime Product Launch`，因为 README 已明确 CLI/TUI/browser companion 和 local runtime 仍是 planned but not stable。

## 6. Maintainer 复核清单

上线前逐项确认：

```text
[ ] 目标 level 明确，且没有偷换成更高承诺。
[ ] 用户能从 README 找到最短使用路径。
[ ] 最小闭环有手工样例或模板支撑。
[ ] Evidence grade 和目标 level 匹配。
[ ] public evidence 已脱敏，且不依赖 raw private session。
[ ] 高风险路径有 owner/maintainer review。
[ ] automation 仍符合 dry-run 承诺。
[ ] 本地检查和相关 GitHub gate 测试已运行。
[ ] docs index 能找到上线相关政策。
[ ] rollback、deprecation 或 downgrade path 已写清楚。
[ ] residual risk 被记录，而不是隐藏在口头讨论中。
```

上线决策输出应优先使用 `Go / Conditional Go / No-Go`，不要只写“基本可以”。
