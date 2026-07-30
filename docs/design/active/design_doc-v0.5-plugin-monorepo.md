# EvoZeus v0.5 插件化主仓架构与迁移设计

- 状态：active / 对内-已通过
- 受众：EvoZeus 维护者、CoEvolve 维护者、发布管理员
- 决策：[`ADR-0005`](../../decisions/ADR-0005-plugin-first-monorepo-and-repo-scoped-harness.md)
- 目标：将 EvoZeus 收敛为一个用户产品、一个插件入口、一个主仓发布单元和一个可选独立进化扩展

## 1. 完成定义

本次修改只有同时满足以下结果才算完成：

1. 新用户通过 EvoZeus plugin 直接表达任务，无需先运行 feature/capability 查询。
2. 默认安装的用户 Skill 数量收敛，维护类 Skill 不进入默认用户入口。
3. Runtime 与 Session Signal 随 EvoZeus 主仓和主版本原子发布。
4. CoEvolve 继续作为独立 Repo 和可选扩展发布。
5. CI 能阻止 monorepo 子目录创建独立 Harness。
6. Stable 与唯一 UAT 的覆盖更新、隔离和回滚语义保持不变。
7. README 让首次访问者在一分钟内理解价值、开始方法和隐私边界。

## 2. 目标架构

```text
EvoZeus plugin
├── using-evozeus          用户意图入口
├── review-session         复盘一次或一组会话
├── preserve-learning      保存经确认的 Lesson/Artifact
├── evolve-repository      为独立 Repo 接入 CoEvolve
└── maintain-evozeus       管理 stable / uat / doctor / update
        │
        ▼
EvoZeus main repo
├── scripts/               产品 CLI、频道、安装和治理
├── packages/runtime/      内置执行引擎
├── packs/session-signal/  内置官方判断包
├── plugin/skills/         默认用户 Skill
└── docs/                  ADR、契约与维护文档
        │
        └── optional contract ──> EvoZeus-CoEvolve 独立 Repo

EvoZeus-web                独立前端部署；不属于本地产品矩阵
```

## 3. 交互职责

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| Plugin | 能力发现、自然语言路由、审批提示 | 执行复杂运行时逻辑 |
| User Skill | 单一用户任务的步骤、输入和结果解释 | 组件版本编排 |
| CLI | 可重复执行、机器可读结果、频道、Doctor、回滚 | 让用户理解内部 Repo 拓扑 |
| Runtime package | 本地证据处理、判断与报告 | 独立产品发布 |
| Session Signal pack | 官方判断规则与 Factor tools | 独立安装频道 |
| CoEvolve | 独立 Repo 的 Lesson、Harness 和进化生命周期 | EvoZeus 主产品内部包管理 |

## 4. Harness 约束

治理单位固定为 Git Repo：

```text
repo root
├── .git/
├── .evozeus-wrapper/      允许：该 Repo 唯一活动 Harness
├── packages/runtime/
│   └── .evozeus-wrapper/  禁止：嵌套 Harness
└── packs/example/
    └── .evozeus_evoinfra/ 禁止：嵌套旧 Harness
```

CI 读取 Git 跟踪和待提交文件路径；发现 Harness 目录位于 Repo 根目录之外即失败。文档示例、临时测试目录和用户本地运行状态不得进入产品源码。

## 5. 插件入口

### 5.1 默认提示

插件最多提供三个起始提示：

- “复盘这次 Agent 执行，告诉我值得保留、修复或进化的内容。”
- “把这条已确认 Lesson 保存为可追踪的 Artifact。”
- “检查 EvoZeus 当前 stable/UAT 状态并给出唯一下一步。”

### 5.2 Lesson 捕捉

普通聊天中的捕捉依赖宿主的会话级 watcher。插件内 Skill 负责定义识别和交互契约：

```text
🧙 EvoZeus · 捕捉到一条可能值得记录的 Lesson：<一句话摘要>。要记录下来吗？
```

用户确认前不创建 Issue、不修改目标 Repo。Codex 当前插件 manifest 不声明 session hook，因此全局 watcher 作为显式启用的宿主适配层交付，不能伪装成插件天然自动能力。

## 6. 版本模型

| 发布单元 | 版本来源 | 用户是否单独选择 |
| --- | --- | --- |
| EvoZeus | 主仓 Release / 唯一 UAT Commit | 是，选择 stable 或 uat |
| Runtime | EvoZeus Commit 内嵌路径 | 否 |
| Session Signal | EvoZeus Commit 内嵌路径 | 否 |
| CoEvolve | 独立 Release / 合同版本 | 按需安装或升级 |
| Web | 独立部署 Commit | 否，不进入本地版本 |

UAT 永远只有一个活动候选。UAT 修复覆盖 `uat/current`，不得创建第二个用户可见 UAT。

## 7. 迁移切片

### 切片 A：架构与守卫

- 接受 ADR-0005。
- 建立 Harness boundary CI。
- 更新 canonical Repo topology。

### 切片 B：插件入口

- 新增 Codex 和 Claude plugin manifest。
- 新增精简用户 Skill。
- 根 Skill 改为兼容路由。

### 切片 C：主仓内聚

- 导入 Runtime 和 Session Signal 源码及历史来源说明。
- 改造路径解析、安装器、频道清单和 Doctor。
- 删除独立下载依赖。

### 切片 D：产品表达

- 重写 README。
- 将维护细节移入 docs。
- 修正 CoEvolve、旧 Infra、旧 Session Signal 的 README 与归档指向。

### 切片 E：发布与退役

- 完成开发分支验证。
- 覆盖唯一 UAT 并做真实用户旅程验证。
- 将同一已验证 Commit 晋升 Stable。
- 归档旧 Infra 与 Session Signal Repo。

## 8. 验证矩阵

| 范围 | 必须证明 |
| --- | --- |
| Plugin | manifest validator 通过；默认 Skill 可被发现 |
| Harness | 根 Harness 允许；任意嵌套 Harness 被 CI 拒绝 |
| Install | 新装、旧版升级、重复对齐均成功 |
| Channel | stable 与 uat 隔离；UAT 修复覆盖同一候选 |
| Runtime | 内嵌路径可运行，不要求外部 Infra Repo |
| Signal pack | 内嵌 Factor 可发现、校验、执行 |
| CoEvolve | 独立合同可解析；无权限时只给计划 |
| README | 首屏说明价值、安装、示例和隐私；不出现 Web 产品组件 |
| Regression | 全量自动测试通过；旧正式版仍可回滚 |

## 9. 退役门禁

旧 Repo 只有满足全部条件后才能归档：

- 主仓包含对应源码和来源 Commit。
- 唯一 UAT 已完成真实安装、升级、复盘和报告验证。
- Stable Release 使用相同已验证代码。
- 旧 Repo README 指向新路径。
- GitHub issue、release 和 archive 状态已记录。

