# 开发工作流场景

- Status: active
- Last updated: 2026-06-15
- Audience: 要实现 TUI、Agent 行为和贡献链路的人

## 场景总览

| Scenario | 真人用户动作 | 用户的 Agent 动作 | 系统动作 | 授权点 |
| --- | --- | --- | --- | --- |
| 第一次使用 | 复制启动语 | 读取 `SKILL.md`，生成 verdict card | 无默认写入 | 保存、打开 TUI |
| 跑不起来 / 需要 debug | 选择是否执行检查 | 收集错误、环境、依赖、上下文 | `doctor` 输出诊断 | 读取本地配置、修复建议 |
| 正常使用后发现规律 | 确认是否沉淀 | 归纳 evidence、草拟 Case / Rule | 生成本地草稿 | 保存、贡献 |
| 查看报告 | 阅读报告并选择下一步 | 解释 report type、evidence、verdict、privacy note | 展示 report view | 保存、贡献、忽略 |
| 安装新因子库 | 查看 manifest 并确认 | 解释用途、依赖、权限、降级策略 | 下载或启用 factor | 安装、启用 |
| 查看最新因子库状态 | 发起 inspect / status | 对比本地 registry 和社区 manifest | 展示版本、变更、风险 | 更新、回滚 |
| 查看历史贡献 | 打开 contribution history | 汇总 accepted / rejected / open cases | 展示贡献列表和详情 | 无或按需登录 |

## 1. 第一次使用

目标：用户不安装工具也能完成一次最短闭环。

```text
用户复制 README 启动语
-> Agent 读取 SKILL.md
-> Agent 基于当前可见 session 生成 verdict card
-> 用户看到建议
-> 用户选择是否保存或继续
```

Agent 必须说明：

- 当前只基于可见上下文判断。
- 默认没有写文件。
- 默认没有上传。
- 后续动作都是 opt-in。

## 2. 跑不起来 / 需要 debug

目标：Agent 在任务失败、延后或环境异常时，能把问题归到可行动的 debug verdict。

```text
Agent 发现失败或阻塞
-> Agent 汇总 error、命令、依赖、环境线索
-> Agent 建议运行 doctor
-> 用户确认
-> doctor 输出诊断和下一步
```

常见输出：

- 缺少依赖
- 本地配置不一致
- 权限不足
- factor manifest 不兼容
- workspace 状态损坏
- 需要人工补充 insight

## 3. 正常使用后发现规律

目标：用户在业务链路中少操作，Agent 负责把规律整理成可审查草稿。

```text
Agent 发现重复纠偏或高质量 adhoc 结果
-> Agent 生成本地 Insight Draft
-> Agent 判断可能落成 Skill / Rule / Factor / Habit
-> 用户确认是否保存
-> 用户确认是否贡献社区
```

用户侧提示应保持具体：

```text
你在「销售方案」场景里多次强调「先判断客户预算和决策链，再写方案」。
这可能值得沉淀成一个销售方案场景下的 Skill 或 Rule。
```

系统不能把“推荐 Skill”做成泛化推荐流。触发条件来自具体场景里的重复纠偏、失败复盘或高质量结果。

## 4. 查看报告

目标：用户拿到报告后，能快速判断这份报告要支持什么决定。

```text
用户打开报告
-> Agent 说明 report type
-> Agent 解释 evidence、judgment signals、verdict、privacy note
-> 用户选择下一步动作
```

报告类型见 [../reports/README.zh-CN.md](../reports/README.zh-CN.md)。

常见动作：

- Save local draft
- Fix environment
- Create redacted Case
- Contribute
- Ignore
- Keep observing

## 5. 安装新因子库

目标：让用户知道因子库会做什么，再决定是否启用。

```text
用户或 Agent 发起 factor inspect
-> 系统展示 manifest
-> Agent 解释用途、依赖、权限、输入输出、降级策略
-> 用户确认安装或启用
-> 系统写入本地 registry
```

manifest 至少展示：

- factor id 和 version
- 绑定的 analysis stage
- 输入和输出格式
- 是否需要外部依赖
- 是否读取本地文件
- 是否调用模型或网络
- fallback 和 rollback

## 6. 查看最新因子库状态

目标：用户和 Agent 能知道本地因子库是否过期、是否有破坏性变更。

```text
用户打开 status 或 inspect
-> Agent 读取本地 registry
-> 系统按需读取社区 manifest
-> Agent 输出差异摘要
-> 用户选择 update / keep / rollback
```

展示重点：

- 当前启用版本
- 最新可用版本
- 变更摘要
- 隐私或权限变化
- 兼容性风险
- rollback 路径

## 7. 查看历史贡献

目标：让用户和社区知道哪些贡献已经被接受、拒绝、搁置或仍在讨论。

```text
用户打开 contribution history
-> Agent 汇总 issue / PR / local accepted cases
-> 系统按状态分组
-> 用户查看详情
```

状态建议：

- Open Case
- Accepted Rule
- Accepted Factor
- Golden Case
- Rejected Pattern
- Needs Redaction
- Needs Evidence

历史贡献页面应优先回答：

1. 这个贡献解决了哪个场景。
2. 它绑定了哪些 rule / factor / persona signal / domain signal。
3. 它为什么被接受或拒绝。
4. 它能否被当前用户或 Agent 复用。
