# Codex with ChatGPT

[English](README.md) | 简体中文

和 ChatGPT 讨论目标、拆解需求和比较方案；由 Codex 实现、测试和调试。
重点是提高方案质量、减少上下文搬运和返工。

## 当前使用方式

先跑通本地手动交接，再按需配置在线连接。无需为了交接先开启隧道或 OAuth。

1. 和 ChatGPT 讨论，把认可的方案写入项目 Markdown 文件，参照
   [方案模板](examples/c2c-plan.md)。目标、关键假设、方法、权限范围和验收标准
   都应写清，并由人确认这个版本。
2. `c2c plan approve --file plan.md --task task1 --revision 1 --user-confirmation "确认记录" -w <项目>`
   保存不可覆盖的方案版本和代码基线。
3. `c2c plan begin -w <项目>` 核对基线；Codex 随后自主实现和修复普通问题。
4. 在手动请求或约定里程碑时，使用 `plan snapshot`、`record` 保存真实改动、
   测试命令/结果、未验证事项和阻塞，再用 `handoff export` 输出可复制的交接包。
5. ChatGPT 审查并列出实际检查过的证据，由人决定是否调整方案。

完整命令及失败恢复：[协作协议](docs/protocol.md)。

ChatGPT 的建议不是人的授权。涉及目标、关键方法、验收标准或权限变化时，
需确认新版本；普通实现与修复不必每一步回到 ChatGPT 重新规划。

## 它实际能看到什么

可选的本地桥接通过 10 个只读 MCP 工具提供当前文件、目录、搜索、Git 差异
和执行记录。ChatGPT 可以按需读取真实代码，不仅是 Codex 的文字转述。
它不会持续监控本地变化，也不能执行命令或独立重跑测试。
执行日志由 Codex 选择记录；读取日志不等于独立复现测试。

浏览器消息只负责通知；方案、执行证据和投递状态保存在本地。自动发送失败时
可手动复制交接包。状态不明时先核对消息 ID，不能重复执行或盲目重发。

## 安装和连接：每类操作先授权

需要 Node.js >= 20 和项目依赖。安装依赖、安装/替换 Skill、修改 Codex 配置、
创建 OAuth 授权、启动公网隧道、重启服务、账号操作和推送都需事先说明并获得
相应许可。项目不会因一次普通编码请求自动更新、stash、安装或重启。

获得依赖安装许可后，在仓库中使用锁文件安装并构建，例如：

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run typecheck
pnpm run build
pnpm test
```

CLI 可用 `node <仓库>/bin/c2c.js`，无需全局安装。安装 Skill 时应复制整个
`skill/` 目录（含 references），并把 SKILL.md 的 checkout 路径替换为实际路径。
Codex home 使用非空 `CODEX_HOME`，否则为 `~/.codex`。

在线连接另外需要 cloudflared。`c2c setup` 会启动桥接和公网连接，必须先授权；
不要把它当成无副作用的检查命令。`doctor` 默认只诊断，`doctor --fix` 明确请求
连接修复；两者均不自动修改 Codex 配置。`sandbox-allow` 是独立的配置变更。
第一版聚焦 macOS，没有增加后台服务或远程执行工具。

## 安全和局限

`.git`（含 worktree 指针文件）、已知凭据文件和自定义 `.c2cignore` 路径受到
访问限制；Git 元数据经受限接口提供。文件名过滤和日志脱敏不能保证任意文件
都没有敏感内容，分享前仍应查看交接包。快照仅覆盖允许读取的文件，并列出
省略数量；日志可能被截断、限制或过期，不能把缺少证据当作通过。

当前一次只支持一个工作区内一个执行者。审批说明和审查记录是记录机制，
不是身份签名。真实浏览器/OAuth/公网端到端验证需要单独授权和实际环境。

[架构](docs/architecture.md) · [安全](docs/security.md) · [故障排查](docs/troubleshooting.md)

## 撤销

停止使用时不再调用 Skill/CLI；已安装 Skill 可在确认后移除其目录。
只有曾启动桥接时才需要 `c2c stop -w <项目>`；只有曾授权连接时才需 `c2c unpair`
吊销令牌，并按需删除对应 ChatGPT 连接器。不要为了本地手动交接去创建连接。
方案和证据默认保留在 macOS 的 `~/Library/Application Support/codex-with-chatgpt`；
删除前先导出所需记录。源码修改可以按文件审阅并撤销，不需要推送。
