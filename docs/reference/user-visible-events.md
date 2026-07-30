# EvoZeus 用户可见生命周期标记

状态：正式产品合同  
受众：EvoZeus 用户、Skillware 维护者与集成开发者

EvoZeus 使用普通聊天中的一行短标记说明关键生命周期事件。标记用于回答三个问题：EvoZeus 何时介入、正在改变什么、当前是否可验证。它不是调试日志，也不得输出内部 JSON。

| 事件 | 标准格式 | 触发条件 |
| --- | --- | --- |
| 启动 | `🧙 EvoZeus · 已启动｜<当前任务>` | 用户显式调用 EvoZeus |
| 受管运行 | `👁️ EvoZeus · 受管运行｜<目标 Skillware> · <stable/uat/development>` | 当前业务任务由已接入 EvoZeus 的独立 Repo 承载 |
| Lesson 候选 | `🧙 EvoZeus · 捕捉到一条 Lesson｜<脱敏摘要>。要记录下来吗？` | 业务结果完成后发现可复用改进 |
| Lesson 已记录 | `📝 EvoZeus · Lesson 已记录｜<本地记录或 Issue 链接>` | 用户确认且记录动作成功 |
| 等待确认 | `🔐 EvoZeus · 等待确认｜<具体写入或外部动作>` | 下一动作需要新的授权 |
| 版本状态 | `🧭 EvoZeus · 版本状态｜<当前渠道/版本 → 目标渠道/版本>` | 安装、对齐、切换或升级前 |
| 发现更新 | `🧭 EvoZeus · 发现更新｜<Stable/UAT> <当前版本> → <目标版本>` | 自动检查发现当前订阅渠道有新候选 |
| 自动更新中 | `🛠️ EvoZeus · 自动更新中｜正在对齐Plugin、Runtime、Session Signal与CoEvolve` | 产品级事务已开始 |
| 自动更新完成 | `✅ EvoZeus · 自动更新完成｜<Stable/UAT> <版本> · 新会话加载Plugin` | 新产品通过验证并已切换 |
| 自动更新失败 | `🛡️ EvoZeus · 自动更新失败｜继续使用<渠道/版本> · <原因>` | 下载、验证、Plugin对齐或切换失败并已保留上一验证版本 |
| 进化执行 | `🛠️ EvoZeus · 进化中｜<Repo> · <已批准改动>` | 已取得修改授权并开始实施 |
| UAT 就绪 | `🧪 EvoZeus · UAT 就绪｜<Repo> · <唯一候选 Commit>` | 验证通过且唯一 UAT 候选已更新 |
| 正式发布 | `🚀 EvoZeus · 已发布｜<Repo> · <Release>` | Stable Release 已实际发布 |
| 回滚 | `↩️ EvoZeus · 已回滚｜<恢复的渠道/版本>` | 回滚完成且恢复版本通过 Doctor |
| 暂停 | `🛡️ EvoZeus · 暂停｜<证据、隐私或权限阻塞>` | 缺少继续执行所需的安全条件 |
| 验证完成 | `✅ EvoZeus · 已验证｜<通过的检查>` | 声明完成前的验收证据已通过 |

## 显示规则

1. 每次真实状态变化最多显示一条标记，普通分析和工具调用不显示。
2. 标记必须与当前动作一致，计划不能写成已完成，UAT 不能写成 Stable。
3. Lesson 提示永远出现在用户任务结果之后；用户确认前不持久化。
4. `受管运行` 只在目标 Repo 已识别且 Harness/Plugin 身份可核验时显示。
5. Stable、UAT、Development 必须明确区分；用户宿主中只安装一个活动 EvoZeus Plugin。
6. 不显示 signal id、capture state、内部 schema、私有路径、客户资料或 raw session。
7. 当前版本无变化时保持安静；自动更新只显示状态变化和最终结果。
