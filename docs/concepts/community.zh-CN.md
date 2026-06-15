# 社区关键词

- Status: active
- Last updated: 2026-06-15
- Language: zh-CN

## 总览

社区层负责把个人经验脱敏后沉淀为公共判例和规则图谱。

```text
Private Case
-> Redaction
-> Scenario + Rule Proposal
-> Issue / PR
-> Accepted Rule / Golden Case
```

## 关键词

| Term | 中文解释 | 用途 |
| --- | --- | --- |
| Scenario | 规则适用的场景上下文 | 限定规则边界 |
| Rule | 可执行的判断或操作规则 | 指导下次 Agent 行为 |
| Rule Proposal | 待 review 的规则草稿 | 进入 issue / PR |
| Redacted Case | 脱敏后的 Case | 公开贡献 |
| Golden Case | 高质量、可复核、可复用的 Case | 作为范例和证据 |
| Accepted Rule | 已被接受的公共规则 | 可被 Agent 引用 |
| Disputed Rule | 有争议或证据冲突的规则 | 需要更多 Case |
| Rejected Pattern | 被判定为低价值或高风险的模式 | 避免下次重复 |
| Contribution History | 历史贡献记录 | 帮助新人学习规范 |

## Scenario

Scenario 描述规则适用的上下文。

建议字段：

- task type
- agent type
- skill usage
- tool usage
- failure / success type
- user preference tag
- privacy tag
- boundary

例子：

```text
task type: debug
agent type: Codex
failure type: tool failure
user preference: evidence-first
boundary: only applies when auth check succeeds and push still fails
```

## Rule

Rule 是面向 Agent 的可执行判断。

格式：

```text
When <scenario>,
if <evidence pattern>,
then <recommended behavior>,
unless <boundary>.
```

例子：

```text
When debugging GitHub delivery,
if auth status succeeds but push fails with timeout,
then inspect network / proxy before asking the user to re-authenticate,
unless the token check itself fails.
```

## Contribution States

| State | Meaning |
| --- | --- |
| `candidate` | 有价值，但还在 review |
| `accepted` | 证据支持进入公共库 |
| `disputed` | 存在反例或边界争议 |
| `deprecated` | 被新规则替代或不再推荐 |
| `rejected` | 低价值、高风险或证据不足 |

## Contribution Gates

公开贡献必须通过：

- Evidence Gate：有具体 evidence。
- Privacy Gate：公开内容安全。
- Value Gate：对其他用户或 Agent 有复用价值。
- Operational Gate：推荐动作可执行。

## GitHub Mapping

| GitHub Surface | Meaning |
| --- | --- |
| Issue | candidate graph fragment |
| PR | curated graph fragment |
| main | accepted rule library |

## 相关文档

- [Contributing](../../CONTRIBUTING.md)
- [Privacy and Redaction](../governance/privacy-and-redaction.md)
- [Verdicts](../reference/verdicts.md)
- [Factor Analysis Protocol](../reference/factor-analysis-protocol.md)
