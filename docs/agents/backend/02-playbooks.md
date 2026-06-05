# Backend Agent · 操作手册

## 0. 临时事项：接口鉴权排查

- 全量排查：业务数据、配置、消息时间线、任务状态、AI 能力相关接口默认须鉴权。
- 仅健康检查等明确公开接口可匿名；例外须记入 `backend-agent.md`「与架构 owner 沟通区」。
- 历史风险点曾包括：`/api/ai` 挂载顺序、`/openapi.json`、`/api-docs` 等；以当前代码与台账为准持续收口。

## 1. 本周任务清单（可勾选 · 摘要）

### P0

- [ ] 全量接口未鉴权排查与修复。
- [ ] 收紧 `/api/ai/*`；确保 `/api/problem-cases/*` 等受保护。
- [ ] 配合前端：`ProblemCase.id` 作为外部案例主键稳定可用。
- [ ] 恢复可信测试：`npm test`、`npm run build`。
- [ ] 消息与动作接口基线：`POST/DELETE messages`、`POST .../tasks/:taskId/{start|confirm|revise|rollback}`（以仓库路由为准）。

### P1

- 统一 `GET` detail / tasks / messages 结构与 `id` 契约。
- 固定 `ProblemCaseMessage` 字段集合（`id`、`caseId`、`taskId`、`role`、`type`、`content`、`payloadJson`、`confirmed`、`timestamp` 等）。

### P2

- AI 调用最小 `trace` 字段、文档与错误码说明。

## 2. 任务记录规则与模板

新任务须先在 **`03-active-tasks.md`**（及过渡期 `backend-agent.md`「任务记录区」）登记。

**模板字段**：

- 任务编号、日期、标题、来源、优先级、状态
- 涉及模块：`auth` / `ai` / `problem-cases` / `tests` / `contracts`
- 目标结果、已完成、阻塞、需前端配合、契约/测试结果、关闭条件

## 3. 跨 Agent 协同留言方式

需前端配合时，在 `backend-agent.md`「跨 Agent 协同留言方式」按模板追加。

## 4. 验收标准（摘要）

- 未登录访问受保护接口应拒绝；关键路径有测试或明确运行时复验记录。
- 消息与动作契约与 OpenAPI/测试一致。

## 5. 本地后端一键启动（Windows / macOS）

- 权威步骤与参数说明见 **`backend/scripts/README-local.md`**。
- **Windows**：`backend/scripts/start-local-backend.ps1`（可选用 `-SkipBuild`、`-SkipDbPush`）；可尝试自动拉起本机 MariaDB（路径见 `_local-backend-common.ps1`）。
- **macOS / Linux**：`backend/scripts/start-local-backend.sh`（对应 `--skip-build`、`--skip-db-push`）；**不**自动启动数据库，仅通过 `npx prisma db execute`（`SELECT 1`）检查可达；失败时明确报错。
- 状态文件与日志目录统一为 `backend/.local/run/state.json` 与 `backend/.local/logs/`（git 忽略）。

### 5.1 核心业务场景经验：在线模式 `/api/ai/chat` 上游 `ENOTFOUND` 与本地单实例

**场景**：前端 `MODE=online` 时，大模型经 `POST /api/ai/chat` 由后端再请求 DeepSeek。若响应 **502** 且含 **`getaddrinfo ENOTFOUND api.deepseek.com`**，表示**当前处理请求的后端 Node 进程**无法解析上游域名；宿主机或浏览器里 `curl`/`nslookup` 正常**不能**单独证明后端进程所在环境 DNS 正常（多实例占错端口、Docker 内 DNS 与宿主机不一致等）。

**处置顺序（经验收口）**：

1. **只保留一个后端**：`bash backend/scripts/stop-local-backend.sh`，若有残留 `node dist/src/server.js` 仍占端口，再 `kill` 对应 PID，确认目标端口空闲。
2. **标准拉起**：仓库根目录执行 `bash backend/scripts/start-local-backend.sh`；读 `backend/.local/run/state.json` 的 `port`。
3. **前端对齐**：`frontend/config.local.js` 中 `BACKEND_API_URL` 必须为 `http://127.0.0.1:<state.json.port>/api`（注意末尾 `/api`）。
4. **仍 ENOTFOUND**：在本机刷新 DNS / 检查 DNS 设置（如 `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder`）、`networksetup -setdnsservers`（需替换网络服务名）；若后端在 Docker，在 Docker 层单独配 DNS，与 macOS 宿主机的 `curl` 成功不矛盾。

## 6. 给 Backend Agent 的提示词（入口更新）

除 `project-core.mdc` 与根目录 `AGENTS.md` 外，**以本目录分层为准**：

- `backend/00-core.md` · `01-context.md` · 本文件 · `03-active-tasks.md`
- 历史全文：`docs/agents/backend-agent.md`

职责不变：仅 `backend/`；不改前端项目。
