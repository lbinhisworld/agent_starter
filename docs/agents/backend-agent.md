# Backend Agent 执行文档

> **文档分层（ARCH-20260325-01）**：执行准则与轻量台账已拆至 `docs/agents/backend/`（`00-core.md`～`03-active-tasks.md`）。**新派工、新准则、新活跃任务索引**优先更新该目录；本文档保留**历史长文**，第二阶段再瘦身或迁入知识库。

## 执行总规则

- 执行本面板前，必须先阅读并遵守以下总规则文件：
  - `project-core.mdc`（项目协作总规则，与根目录 `AGENTS.md` 配套）
- 后续所有任务执行、文档更新、沟通方式、最小化变更原则，都必须按该规则文件执行。
- 如果本面板与该规则文件存在冲突，以该规则文件为准。

## 项目修改边界

- 后端 agent 只允许修改以下项目：
  - `E:\03_do1_workspace\do1_smart_cto\backend`
- 后端 agent 不允许修改：
  - `E:\03_do1_workspace\do1_smart_cto\frontend`
  - `E:\03_do1_workspace\do1_smart_cto\frontend-vue`
- 如需前端配合，不得直接进入前端项目修改，必须按本文档中的“跨 Agent 协同留言方式”发起协同。

## 0. 临时事项：接口鉴权排查

> 优先级：最高。先做这件事，再继续本周其他任务。

- 立即排查当前所有后端接口，确认是否存在“不需要鉴权就可以获取信息/调用”的情况。
- 处理原则：
  - 凡是返回业务数据、配置数据、消息时间线、任务状态、AI 能力的接口，默认必须鉴权。
  - 只有明确约定为公开的接口才允许匿名访问，例如健康检查；如有例外，必须写入“与架构 owner 沟通区”。
- 当前已知重点风险：
  - `backend/src/app.ts` 中 `/api/ai` 存在先未鉴权挂载、后鉴权挂载的情况，需要优先处理。
- 排查范围至少包括：
  - `/api/ai/*`
  - `/api/problem-cases/*`
  - `/api/admin/*`
  - `/openapi.json`
  - `/api-docs`
  - 其他任何会暴露系统结构、配置、业务数据的接口
- 一旦发现问题：
  - 立即修复。
  - 补测试覆盖未登录访问场景。
  - 将修复结果和剩余例外写入本文档“每日更新区”和“与架构 owner 沟通区”。

## 1. 项目背景

- 本周只保 `ProblemDetail` 主链路。
- 后端目标不是补 CRUD，而是开始接管业务裁决。
- 当前系统现状：
  - 已有 `auth`
  - 已有 `ai`
  - 已有 `problem-cases`
  - 但动作接口和消息流模型还不完整

## 2. 本周目标

- `ProblemCaseMessage` 成为唯一消息时间线来源。
- 后端提供消息追加与最小任务动作接口。
- 统一详情页读取结构。
- 鉴权和测试基线恢复可信。

## 3. 冻结边界

### 后端负责

- 鉴权。
- `case` 当前状态。
- `task summaries`。
- `message timeline`。
- `task start / confirm / revise / rollback`。
- AI 调用入口与基础追踪。

### 后端暂不做

- 全量 `company analyses` 后端化。
- `tools` 全量后端化。
- 完整审计系统。

### 本周兼容策略

- 保留旧 `PUT /messages`。
- 但仅用于兼容，不再作为主路径。

## 4. 本周任务清单

### P0

- 完成全量接口未鉴权排查，并修复所有不应匿名访问的接口。
- 收紧 `/api/ai/*` 鉴权。
- 确保 `/api/problem-cases/*` 全部受保护。
- 新增：配合前端完成“案例详情 URL 携带后端标准 `caseId`”改造，确保后端 `ProblemCase.id` 作为唯一外部案例标识稳定可用。
- 修复依赖与测试环境，让 `npm test` 可执行。
- 新增：
  - `POST /api/problem-cases/:caseId/messages`
  - `DELETE /api/problem-cases/:caseId/messages/:messageId`
  - `POST /api/problem-cases/:caseId/tasks/:taskId/start`
  - `POST /api/problem-cases/:caseId/tasks/:taskId/confirm`
  - `POST /api/problem-cases/:caseId/tasks/:taskId/revise`
  - `POST /api/problem-cases/:caseId/tasks/:taskId/rollback`

### P1

- 统一 `GET /api/problem-cases/:caseId` 返回结构。
- 统一 `GET /api/problem-cases/:caseId/tasks`。
- 统一 `GET /api/problem-cases/:caseId/messages`。
- 校准列表/详情/消息/任务读取返回中的 `id` 契约，避免前端继续依赖 `createdAt` 充当详情主路由键。
- `ProblemCase.archiveNo`：按 `(ownerSubjectType, ownerSubjectId)` 单调递增的档案编号，删除其他案例不回收不重排；创建时在事务内 `max+1`；客户端 PUT 不可改。
- 固定 `ProblemCaseMessage` 字段：
  - `id`
  - `caseId`
  - `taskId`
  - `role`
  - `type`
  - `content`
  - `payloadJson`
  - `confirmed`
  - `timestamp`

### P2

- 给 AI 调用补最小 `trace` 字段：
  - `caseId`
  - `taskId`
  - `mode`
  - `model`
  - `durationMs`
- 更新 `backend/README.md`。
- 写清接口样例和错误码。

## 5. 需要前端配合的内容

- 前端是否还有依赖旧 `PUT /messages`。
- 哪些字段必须兼容当前 UI。
- 详情页首次加载需要哪些聚合结果。

## 6. 任务记录区

> 说明：后端 agent 每接到一个新任务，必须先在本区登记，再开始执行；不得只把内容混写进“每日更新区”。

### 记录规则

- 每个任务必须有独立记录。
- “每日更新区”保留给当天进展。
- “任务记录区”保留给任务维度追踪。
- 每次完成一个接口、测试批次、或契约校准阶段，必须同时更新：
  - `任务记录区`
  - `每日更新区`
- 如果需要架构 owner 拍板，还要额外更新：
  - `与架构 owner 沟通区`

### 任务记录模板

- 任务编号：
- 日期：
- 任务标题：
- 来源：
- 优先级：
- 当前状态：
- 涉及模块：`auth / ai / problem-cases / tests / contracts`
- 目标结果：
- 已完成：
- 当前阻塞：
- 需要前端配合：
- 契约/测试结果：
- 关闭条件：

### BE-20260408-01

- 任务编号：`BE-20260408-01`
- 日期：`2026-04-08`
- 任务标题：`用户首次登录个人模型 Key 门禁（后端 Phase 1）`
- 来源：`ARCH-20260407-01` / 用户明确授权按 Phase 1 直接实施
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`prisma / auth / ai / tests / contracts`
- 目标结果：`新增 AppUser 个人 AI 配置表与“保存并验证”接口；/api/ai/chat 对 role=user 只读本人已验证配置；系统级 /api/ai/config 收口为运维/管理员路径`
- 已完成：
  - `Prisma`：新增 `UserAiConfig` 表与 `AppUser.aiConfig` 关系；新增 migration `20260408093000_add_user_ai_config`
  - `AI 配置服务`：新增用户级状态查询、保存并验证、AES-256-GCM 密文存储、`role=user` chat 真相源解析；系统级配置仍保留给管理员
  - `HTTP 路由`：新增 `GET /api/me/ai-config/status`、`PUT /api/me/ai-config`；`/api/ai/config` 收口为 admin-only；`POST /api/ai/chat` 对未配置/未验证业务用户返回 `428 + AI_CONFIG_REQUIRED`
  - `文档`：补 `backend/prisma/AGENTS.md`、`backend/src/modules/ai/AGENTS.md`，并更新轻量台账
  - `测试`：新增 `backend/tests/ai-user-config.test.ts`，覆盖默认状态、保存即验证、验证失败不落库、`AI_CONFIG_REQUIRED`、admin 系统兜底与最小权限收口
- **运行时复验（2026-04-08）**：
  - **build**：`backend` 下执行 `npm run build`，**通过**。
  - **数据库处理**：`start-local-backend.sh` 首次因本地库历史 drift 拦在 `prisma db push`（数据库存在本地专属迁移 `20260403194500_widen_problem_case_customer_name`，仓库未带该 migration，故 Prisma 试图把 `ProblemCase.customerName` 从 `VARCHAR(1024)` 收窄回 `VARCHAR(191)`）；为避免无关数据风险，**未**使用 `--accept-data-loss`，而是仅执行本次新增 migration SQL：`npx prisma db execute --file prisma/migrations/20260408093000_add_user_ai_config/migration.sql`。
  - **重启**：先用 `bash backend/scripts/start-local-backend.sh --skip-db-push` 验证脚本链路可完成 build/start/health；由于当前执行环境不会稳定保留脚本后台进程，最终以提权前台实例方式启动：`HOST=127.0.0.1 PORT=3001 npm run start`。
  - **最新实例确认**：`backend/dist/src/server.js` 文件时间为 **2026-04-08 01:21:39 +0800**，随后在同一轮中拉起 `http://127.0.0.1:3001` 的最新实例，并以 `GET /health` 返回 `{"ok":true,"service":"smart-cto-backend","env":"development"}` 确认可用。
  - **真实接口最小复验**：通过本地一次性脚本直连 DB 创建临时 `AuthSession` 与测试用户，再对最新实例执行：
    - `GET /api/me/ai-config/status`：**200**，初始 `configured=false`、`verified=false`
    - `GET /api/ai/config`（业务用户）：**403**，`code=FORBIDDEN`
    - `PUT /api/me/ai-config`（错误 Key）：**400**，`code=AI_CONFIG_VERIFY_FAILED`
    - `PUT /api/me/ai-config`（正确 Key）：**200**，返回 `configured=true`、`verified=true`
    - `POST /api/ai/chat`（已验证业务用户）：**200**，返回 `content="OK"`、`model="deepseek-chat"`、`finishReason="stop"`、`truncated=false`
- 当前阻塞：`无`
- 需要前端配合：`后续按冻结 contract 接入 GET /api/me/ai-config/status、PUT /api/me/ai-config 与 AI_CONFIG_REQUIRED`
- 契约/测试结果：`已满足：schema+migration、接口、AI chat 门禁、build、重启、最新实例确认、真实接口最小复验均已完成`
- 关闭条件：`已达成`

### BE-20260323-01

- 任务编号：`BE-20260323-01`
- 日期：`2026-03-23`
- 任务标题：`消息持久化增量 PATCH + PUT 整段替换占位消息安全兜底`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`problem-cases / tests / contracts`
- 目标结果：`新增 PATCH 单条消息更新；PUT /messages 在「已有非空历史且请求退化为单条 system 占位」时 no-op，避免覆盖真实历史；POST/DELETE 行为不变`
- 已完成：`PATCH /api/problem-cases/:caseId/messages/:messageId`（Zod 白名单字段 + `.strict()`）；`replaceMessages` 前置占位检测；`problem-cases.test.ts` 4 条用例；`swagger.ts` 补 PATCH 路径；`npm test` / `npm run build` 通过`
- **运行时复验（接口行为，2026-03-23，与代码/单测分离的收尾）**：
  - **build**：已在 `backend` 执行 `npm run build`，**通过**（本次复验前执行）。
  - **重启**：`scripts/stop-local-backend.ps1` 停止旧进程后，`scripts/start-local-backend.ps1 -SkipBuild` 拉起监听（本机 `PORT=3000` 被占用时脚本自动顺延到 **3002**）。
  - **3002 是否为本仓库最新实例**：`backend/.local/run/state.json` 记录 `scriptRoot=E:\03_do1_workspace\do1_smart_cto\backend`、`port=3002`、`pid=23828`、`startedAt=2026-03-23T01:12:01.7286872+08:00`；`dist/src/server.js` 文件时间 **早于** `startedAt`（约 `01:11:06+08:00`），判定为 **先 build 再启动** 的当前工作区产物。
  - **真实接口最小复验**：使用与 `.env` 中 `JWT_SECRET` 一致的 **admin JWT**（`node` 本地签发，避免依赖 DB 管理员密码是否与文档示例一致）。执行 `node scripts/_runtime-verify-messages.cjs http://127.0.0.1:3002`，输出含 `ok:true`：先 `PUT` 写入 2 条历史，再 `PUT` 单条 system 占位「请输入客户基本信息」→ 响应仍为 **2 条** 且内容为「真实历史 A/B」；再 `PATCH .../messages/rt_hist_1` → `content=PATCH运行时`、`confirmed=true`。
- 当前阻塞：`无`
- 需要前端配合：`优先用 PATCH 做字段级更新，减少对 PUT /messages 全量依赖；PUT 仍兼容但受占位保护`
- 契约/测试结果：`PATCH content/confirmed 200；PUT 多消息整段替换 200；非空历史 + 单条默认占位 PUT 返回仍为原 2 条；POST 201 + DELETE 204 + GET 空列表`；**另见上「运行时复验」**
- 关闭条件：`已达成`

### BE-20260324-01

- 任务编号：`BE-20260324-01`
- 日期：`2026-03-24`
- 任务标题：`在线版售前分析报告（v1）聚合接口`
- 来源：`architect-owner` / 用户冻结口径
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`problem-cases / tests / contracts`
- 目标结果：`GET /api/problem-cases/:id/report` 即时聚合报告 DTO（demandInsight / valueStream / globalItGap / businessObjects / reportMeta）；不新建表、不写回 case；缺失数据空态不 500`
- 已完成：
  - 实现：`problem-case-report.aggregator.ts`（`buildProblemCaseReportDto`）；`ProblemCaseService.getReport`；路由 `GET /api/problem-cases/:id/report`（注册于 `GET /:id` 之前）；`swagger.ts` 补路径。
  - 聚合来源：`ProblemCase` 顶层、`requirementLogic`、`valueStream`、`globalItGapAnalysisJson`、`coreBusinessObjectSessions`（与冻结口径一致）。
  - 业务对象：`items` 从各 session 的 `coreBusinessObjectJson` 抽取 `entities` / `business_objects` / `核心骨架清单`，按稳定 `key`（优先 `对象ID`/`object_id` 等 → `cbo:id:…`，否则 `cbo:`+名称 slug）去重；`graph` 从实体 `relations`/`associations` 生成 `nodes`/`edges`（`source`/`target`/`relationType`）；无对象名不编造，无关联不产生边。
  - 测试：`problem-cases.test.ts` 新增 2 条（空态 200 + 完整字段五模块可用）；`npm test` 全通过；`npm run build` 通过。
- **运行时复验（2026-03-24）**：
  - **build**：`backend` 执行 `npm run build`，**通过**。
  - **重启**：`scripts/stop-local-backend.ps1` 后 `scripts/start-local-backend.ps1 -SkipBuild`；本机 `PORT=3000` 占用时监听 **3002**。
  - **3002 是否为本仓库最新实例**：`backend/.local/run/state.json` 记录 `scriptRoot=E:\03_do1_workspace\do1_smart_cto\backend`、`port=3002`、`pid=25112`、`startedAt=2026-03-24T12:01:55+08:00`；与当前工作区一致。
  - **真实接口**：admin JWT 下 `POST /api/problem-cases` 创建案例后 `GET /api/problem-cases/:id/report` **200**，响应含 `reportMeta` 与 `demandInsight` 等模块（控制台编码可能导致中文显示为 `?`，JSON 体以客户端为准）。
- 当前阻塞：`无`
- 需要前端配合：`可开始联调 GET /api/problem-cases/:caseId/report`（需鉴权）
- 契约/测试结果：见上「已完成」与「运行时复验」
- 关闭条件：`已达成`

### BE-20260406-01

- 任务编号：`BE-20260406-01`
- 日期：`2026-04-06`
- 任务标题：`首页迁 Vue 影子页 · problem-cases 字段契约核对（backend no-op）`
- 来源：协同核对 / 接手前置结论登记
- 优先级：`P2`
- 当前状态：`已关闭（无需后端改动）`
- 涉及模块：`problem-cases / contracts`（只读核对，无代码变更）
- 目标结果：确认首页影子页所需数据是否已由现有 `GET /api/problem-cases`、`GET /api/problem-cases/:id`、`GET /api/problem-cases/:id/report`、`POST /api/problem-cases/import`、`DELETE /api/problem-cases/:id` 满足，避免重复派工。
- 已完成（结论）：
  - 列表：`items[]` 含 `id`、`createdAt`、`customerName` 及进度状态字段；**admin** 下列表项含注入字段 `createdBy`；非 admin 无 `createdBy` 键，可用 `ownerUsernameSnapshot` 等。
  - 任务标签：须由前端从 `ProblemCase` 状态字段推导，列表不返回预计算任务摘要数组。
  - 导入：`POST /import` 响应含 `caseId`；详情与报告、删除路径仍按现有路由。
  - **无缺失字段**；本轮 **backend no-op**。
- 当前阻塞：`无`
- 需要前端配合：`无`（前端按既有契约消费即可）
- 契约/测试结果：文档核对结论；未要求本轮 `npm test` / build
- 关闭条件：`结论已写入 docs/agents/backend/03-active-tasks.md 索引与明细`

### BE-20260320-01

- 任务编号：`BE-20260320-01`
- 日期：`2026-03-20`
- 任务标题：`ProblemDetail 读取契约稳定与动作接口基线恢复`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`auth / ai / problem-cases / tests / contracts`
- 目标结果：`完成鉴权收口、动作接口落地、detail/tasks/messages 契约稳定`
- 已完成：`/api/ai` 鉴权收口、动作接口落地、detail/tasks/messages 契约测试通过、npm test/build 通过`
- 当前阻塞：`无`
- 需要前端配合：`无`
- 契约/测试结果：`detail/tasks/messages 契约测试已通过；ProblemCase.id 作为外部案例主键稳定`
- 关闭条件：`已达成`

### BE-20260320-03

- 任务编号：`BE-20260320-03`
- 日期：`2026-03-20`
- 任务标题：`提供后端 agent 服务给前端联调`
- 来源：`architect-owner`
- 优先级：`P0`
- 涉及模块：`problem-cases / auth / ai`
- 当前状态：`已启动并完成临调验证（真实数据库模式）`
- 目标结果：`启动并确认一个可供前端联调的 backend 服务，提供访问地址与最小联调说明`
- 已完成：`真实 MySQL 可用后，后端在 3002 端口启动完成；使用 /api/auth/login(root/root) 获取 token；对 confirm/revise/rollback/messages delete 四类接口做了可用性探测`
- 当前阻塞：`无`
- 需要前端配合：`前端切换 BACKEND_API_URL 指向该可访问地址，先用 detail/tasks/messages 创建/读取 caseId，再验证任务动作与消息删除返回码`
- 契约/测试结果：`POST /api/problem-cases/:caseId/tasks/:taskId/confirm -> 200；POST .../revise -> 200；POST .../rollback -> 200；DELETE /api/problem-cases/:caseId/messages/:messageId -> 204`
- 关闭条件：`前端已成功连到 backend-agent 服务并完成关键动作验证`

- 服务地址：`http://127.0.0.1:3002`
- 是否已启动：`已启动`
- 监听端口：`3002`
- 联调 token（推荐登录获取）：`POST /api/auth/login` 使用 `username=root, password=root`，响应中返回 `token`；随后在请求头携带 `Authorization: Bearer <token>`
- 建议联调 caseId：本轮探测创建了 `caseId=problem_18c56e0f`（真实数据库模式，可持久化）；如需新 case 用“创建步骤”自动创建

- 创建联调 case 的步骤：
  1. 使用 admin token 调用 `POST /api/problem-cases`（body 同之前测试用例：`customerName/customerNeedsOrChallenges/customerItStatus/projectTimeRequirement`）
  2. 用响应 body 的 `id` 作为 `caseId`
  3. 调用以下接口：
     - `POST /api/problem-cases/:caseId/tasks/task1/confirm`
     - `POST /api/problem-cases/:caseId/tasks/task1/revise`
     - `POST /api/problem-cases/:caseId/tasks/task1/rollback`
  4. 调用消息：
     - `POST /api/problem-cases/:caseId/messages` 创建一条消息（拿到 `messageId`）
     - `DELETE /api/problem-cases/:caseId/messages/:messageId`（应返回 204）

### BE-20260322-02

- 任务编号：`BE-20260322-02`
- 日期：`2026-03-22`
- 任务标题：`鉴权改造：默认 8h JWT + 受保护成功响应自动续期（响应头）`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`auth / ai / problem-cases / admin / tests`
- 目标结果：`JWT 默认有效期 8h（`JWT_EXPIRES_IN` 可覆盖）；不做 refresh token；沿用 Bearer；每次 `requireAuth` 成功且响应为 2xx 时重签 8h token，经 `X-Auth-Token`、`X-Auth-Expires-At` 返回；补最小测试`
- 已完成：（见下方「交付摘要」）
- 当前阻塞：`无`
- 需要前端配合：`读取续期响应头并覆盖本地 token（非本轮后端范围，仅契约说明）`
- 契约/测试结果：`npm test` 全量通过（含 `jwt-auth-renewal.test.ts`：登录 8h、`/api/ai/config` 续期头、无 token/非法/过期 token 均 401）`
- 关闭条件：`已达成`

- **交付摘要**：
  - 默认：`JWT_EXPIRES_IN` 未设置时等价于 `8h`；登录响应体 `expiresIn` 与签发一致；`JWT_EXPIRES_IN` 仍可覆盖。
  - 续期头：`X-Auth-Token`（新 JWT 字符串）、`X-Auth-Expires-At`（过期时间毫秒时间戳，与 JWT `exp` 一致）。
  - 生效范围：凡经过 `createJwtAuthMiddleware`（`requireAuth`）且最终 HTTP 状态为 2xx 的响应，包括 `/api/ai/*`、`/api/problem-cases/*`、`/api/admin/*`（在 `requireRole` 之后仍 2xx 时）、`/openapi.json`、`/api-docs` 等；未改变 `Authorization: Bearer` 校验与 `requireRole` 判定顺序。
  - CORS：`Access-Control-Expose-Headers` 已包含上述两头及 **`Content-Disposition`**（跨域 `fetch` 需暴露该头才能解析导出文件名），便于浏览器读取。
  - 实现要点：`signJwtAccessToken` 仅使用 `userId/username/role` 重签，避免 `verify` 结果中的 `exp/iat` 传入 `sign` 与 `expiresIn` 冲突。

### BE-20260322-04

- 任务编号：`BE-20260322-04`
- 日期：`2026-03-22`
- 任务标题：`POST /api/problem-cases/import 单独放宽 JSON body 上限，修复 413 Payload Too Large`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`problem-cases / tests / app 中间件`
- 目标结果：`仅 POST /api/problem-cases/import 使用更高 JSON 上限（32mb）；其余路由仍 8mb；413 语义保持「请求体超出限制」`
- 已完成：`app.ts` 使用单一 `jsonBodyParser`：按 `POST` + `req.path === '/api/problem-cases/import'`（去尾 `/`）在 `express.json({ limit: 32mb })` 与全局 `8mb` 间二选一，避免 `app.use(path, json())` 在部分环境下未命中导致大包仍走 8mb；`problem-case-import-export.test.ts` 覆盖 9mb 导入成功、33mb+ 导入 413、普通创建 9mb 仍 413；`npm test` / `npm run build` 通过
- 当前阻塞：`无`
- 需要前端配合：`无（本轮冻结不改前端）`
- 契约/测试结果：`problem-case-import-export.test.ts` 覆盖小导入、>8mb 且 <32mb 导入成功、超 import 上限 413、其它 JSON 路由仍 8mb
- 关闭条件：`已达成`

### BE-20260323-01

- 任务编号：`BE-20260323-01`
- 日期：`2026-03-23`
- 任务标题：`排查 PUT /api/problem-cases/:id 返回 404 的根因（caseId=problem_26b8ad82）`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已完成（根因已定位）`
- 涉及模块：`problem-cases / Prisma repository`
- 目标结果：`确认 3002 与当前仓库 backend 及 DATABASE_URL 一致；确认该 caseId 在库中是否存在；明确 404 出自路由层还是业务层；给出下一步归责`
- 已完成：
  - **运行实例**：`backend/.local/run/state.json` 记录 `port=3002`、`scriptRoot=E:\\03_do1_workspace\\do1_smart_cto\\backend`；与 `start-local-backend.ps1` 写入规则一致；现场 PID（如 1724）为 `node`，启动时间与 state 一致时可视为本仓库 `node dist/src/server.js`。
  - **数据库**：使用与 `backend/.env` 相同的 `DATABASE_URL`（Prisma + `createPrismaClient` 适配器）查询，`ProblemCase.id = 'problem_26b8ad82'` **存在**（示例字段：`customerName=广东道一信息科技`）。
  - **404 层次**：**非 Express 未匹配路由**。请求进入 `PUT /:id` → `service.update` → `repository.update`；当 `prisma.problemCase.updateMany` 返回 **`count === 0`** 时 repository 返回 `null`，路由返回 **404** + `{ message: '案例不存在' }`。
  - **根因**：**不是「库里无此 case」**。当 `sanitizeProblemCaseUpdates` 得到 **空对象 `{}`**（例如请求体解析后无任何可写字段）时，`updateMany({ where: { id }, data: {} })` 在 MariaDB/MySQL 下 **`count` 为 0**（无 SET 子句，不更新行），实现误将「空更新」当作「案例不存在」。
  - **旁证**：`backend/.local/logs/backend.out.log` 中同一 `problem_26b8ad82` 会话出现 **单次** `PUT /api/problem-cases/problem_26b8ad82` **404**（约 5ms），前后相邻请求为 **PUT 200**，且同 case 的 `GET` 为 200，与「偶发空 body / 无有效字段」一致，而非持久性缺行。
- 当前阻塞：`无（排查阶段结束）`
- 需要前端配合：`可选`——避免对主案例文档发起「无有效字段」的 `PUT`；根因修复应以 **后端 HTTP 语义** 为主（空更新不应返回 404）。
- 契约/测试结果：`Prisma updateMany` + `data: {}` 实测 `count=0`（本地一次性验证，不纳入 `npm test`）
- 关闭条件：`根因已写入本文档；后续若修复语义，另开任务`

### BE-20260323-02

- 任务编号：`BE-20260323-02`
- 日期：`2026-03-23`
- 任务标题：`修复 PUT /api/problem-cases/:id 在「空有效更新」下误返回 404`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`problem-cases`（`PrismaProblemCaseRepository` / `InMemoryProblemCaseRepository`）、`tests`
- 目标结果：`sanitize 后无字段可写时先按 id 判断存在性；存在则 200 返回当前案例（no-op），不存在才 404；非空更新保持原语义`
- 已完成：
  - **区分方式**：`sanitizeProblemCaseUpdates` 得到 **`Object.keys(payload).length === 0`** 视为「空有效更新」。此时 **`findById(id)`**：有记录则返回该案例，无记录则 `null` → 路由 **404**。**非空**时仍走 **`updateMany`**，仅当 **`count === 0`** 时视为 **id 不存在**（与此前一致）。
  - **HTTP 语义**：空有效更新 + 案例存在 → **200**，body 为当前完整案例（不写库、Prisma 下 **`updatedAt` 不变**）；不存在 → **404** `{ message: '案例不存在' }`；含合法字段的更新 → **200**（与修复前一致）。
  - **测试**：`prisma-problem-case.repository.test.ts` 补空更新走 `findUnique`、不调 `updateMany`；空更新缺 id 返回 `null`；`problem-cases.test.ts` 补 **已存在 + `{}` → 200**、**不存在 + `{}` → 404**、**存在 + 字段 → 200**；`npm test` / `npm run build` 通过。
  - **运行时复验（收尾，2026-03-23）**：在 `backend` 执行 `npm run build`；`stop-local-backend.ps1` 后 `start-local-backend.ps1`，**PORT=3002**、`scriptRoot=E:\03_do1_workspace\do1_smart_cto\backend`、`node dist/src/server.js`；`dist` 中含空更新分支。使用与本机 `JWT_SECRET`（`.env`）一致的 **admin JWT** 调用 `PUT http://127.0.0.1:3002/api/problem-cases/problem_26b8ad82`，body `{}` → **HTTP 200**，响应 JSON 含 `id=problem_26b8ad82`（与 BE-20260323-02 语义一致）。**说明**：若用 `POST /api/auth/login` 复验，须使用数据库中真实存在的管理员账号密码（文档中的 `root/root` 仅为示例，本机可能为 `Invalid credentials`）。
- 当前阻塞：`无`
- 需要前端配合：`无`
- 契约/测试结果：见上
- 关闭条件：`已达成`

### BE-20260323-03

- 任务编号：`BE-20260323-03`
- 日期：`2026-03-23`
- 任务标题：`online 启动跟进创建案例时新增初步需求字段丢失修复`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`problem-cases / contracts / tests`
- 目标结果：`补齐 create 契约与持久化链路，确保 operationModel / businessStatus / urgencyAnalysis / requirementDetailHistory（含 requirementDetail）在创建后可被 GET /api/problem-cases/:id 读回`
- 已完成：
  - `CreateProblemCaseInput` 与 `createProblemCaseSchema` 已补齐 5 个字段：`requirementDetail`、`requirementDetailHistory`、`operationModel`、`businessStatus`、`urgencyAnalysis`。
  - `InMemoryProblemCaseRepository.create` 已写入上述字段，保证测试环境与内存模式行为一致。
  - `PrismaProblemCaseRepository.create` 已接住上述字段，并写入 `ProblemCase.basicInfo.__createContractExtras`；`mapProblemCase` 读取并回填为详情顶层字段，确保创建后 GET 返回完整字段。
  - 新增/通过最小测试：`POST` 创建带新增字段成功；创建后 `GET` 同 case 字段仍存在；老字段 create/list/delete 链路保持通过。
- 当前阻塞：`无`
- 需要前端配合：`无（本轮后端止血）`
- 契约/测试结果：
  - `backend/tests/problem-cases.test.ts` 新增 2 条用例（POST 新字段、POST 后 GET 回读新字段）；
  - 老链路用例 `creates, lists, and deletes a problem case` 仍通过；
  - `npm run test -- problem-cases.test.ts` 与 `npm run build` 通过。
- Prisma/数据库字段映射结论：
  - 当前 `ProblemCase` 表**不存在**以下独立列：`requirementDetail`、`requirementDetailHistory`、`operationModel`、`businessStatus`、`urgencyAnalysis`。
  - 本轮采用最小改动：映射到已存在 JSON 列 `basicInfo` 的命名空间 `__createContractExtras` 持久化，避免改动 migration 与既有 update/import/export 语义。
  - 若后续要改为独立列，需要 owner 另开 schema 迁移任务（新增 5 个 JSON/文本列 + Prisma generate + 数据迁移策略）。
- 关闭条件：`已达成`

### BE-20260323-04

- 任务编号：`BE-20260323-04`
- 日期：`2026-03-23`
- 任务标题：`create/get 新增字段运行时核查（3002 实例）`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`problem-cases / runtime / contracts`
- 目标结果：`在 3002 的当前 backend 实例完成真实 POST->GET 闭环，确认 requirementDetail / requirementDetailHistory / operationModel / businessStatus / urgencyAnalysis 在新建 case 与详情读取中均可见`
- 已完成：
  - 已在 `backend` 执行 `npm run build`，通过。
  - 已执行 `scripts/stop-local-backend.ps1` + `scripts/start-local-backend.ps1 -SkipBuild` 重启实例；当前监听 `3002`。
  - 已核验 `backend/.local/run/state.json`：`scriptRoot=E:\03_do1_workspace\do1_smart_cto\backend`、`port=3002`、`pid=16732`、`startedAt=2026-03-23T15:22:46.8151299+08:00`。
  - 已核验 `dist/src/server.js` 修改时间 `2026-03-23T15:21:28.6620887+08:00`，早于 `startedAt`，判定为 **先 build 后启动** 的本仓库最新实例。
  - 已执行真实最小复验（admin JWT，`POST /api/problem-cases` 后立即 `GET /api/problem-cases/:id`）：
    - `POST`：`201`，`caseId=problem_9f5da9fb`；响应体包含并回显 5 字段：
      - `requirementDetail`
      - `requirementDetailHistory`
      - `operationModel`
      - `businessStatus`
      - `urgencyAnalysis`
    - `GET`：`200`，同 `caseId` 详情响应也包含并回显上述 5 字段（值与 POST 一致）。
- 当前阻塞：`无`
- 需要前端配合：`无（本轮以后端真实接口复验为准）`
- 契约/测试结果：`运行时闭环通过：POST/GET 对新增 5 字段均可见；未出现字段丢失`
- 关闭条件：`已达成`
- 结论备注：`若 owner 现场仍出现“GET 详情缺 5 字段”，优先归因为旧 case 历史数据（由旧实例/旧链路创建）而非当前新建链路故障；当前最新实例上的新建 case 已闭环正常`

### BE-20260323-05

- 任务编号：`BE-20260323-05`
- 日期：`2026-03-23`
- 任务标题：`修复 GET /api/problem-cases/:id 的 basicInfo 被 __createContractExtras 壳污染`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`problem-cases / contracts / tests`
- 目标结果：`保持“最小持久化（extras 仍入 basicInfo.__createContractExtras）”不变，但对外返回时若 basicInfo 仅剩 __createContractExtras 壳，则返回空 basicInfo，避免前端误判 task1 完成`
- 已完成：
  - `prisma-problem-case.repository.ts`：`mapProblemCase` 增加 `normalizePublicBasicInfo`，当 `basicInfo` 仅含 `__createContractExtras` 元键时对外返回 `undefined`；存在任意非元键时保持原样返回。
  - `problem-case.service.ts`：`normalizeProblemCase` 增加同口径兜底，保证对外 GET 语义一致（避免不同 repository 实现出现分歧）。
  - 顶层字段保持不变：`requirementDetail / requirementDetailHistory / operationModel / businessStatus / urgencyAnalysis` 继续从 `__createContractExtras` 回填。**BE-20260331**：同持久化命名空间的 `preliminaryReq`、`task1PendingPreliminaryRequirement`、`task1InitialLlmQuery` 已同步由 `mapProblemCase` 抬升到 GET 详情顶层（此前仅写入 `basicInfo.__createContractExtras` 未回传，导致前端刷新后 `hasV2Prelim` 误判）。
  - 新增最小测试（`prisma-problem-case.repository.test.ts`）：
    - **extras-only**：GET 映射后 `basicInfo` 为空，且顶层 extras 字段仍正常返回。
    - **真实 basicInfo**：存在 `company_name` 等真实字段时，`basicInfo` 仍正常返回。
  - 回归验证：`npm run test -- tests/prisma-problem-case.repository.test.ts tests/problem-cases.test.ts` 通过（22/22）。
- 当前阻塞：`无`
- 需要前端配合：`无（后端先修复对外语义）`
- 契约/测试结果：`GET /api/problem-cases/:id 对外不再返回“仅 __createContractExtras 壳子 basicInfo”；真实 basicInfo 与新增字段回填均通过最小测试`
- 关闭条件：`GET 详情在“仅 extras 壳”场景不再返回 truthy basicInfo，且 extras 顶层字段与真实 basicInfo 场景回归通过`

### BE-20260323-07

- 任务编号：`BE-20260323-07`
- 日期：`2026-03-23`
- 任务标题：`ProblemCase 等 5 张业务表字段 COMMENT 治理（Prisma + MariaDB）`
- 来源：`user`
- 优先级：`P0`
- 当前状态：`进行中`
- 涉及模块：`prisma / migrations / contracts`
- 目标结果：`为 ProblemCase、ProblemCaseMessage、AppSetting、AdminUser、AppUser 全字段补齐中文 COMMENT，仅做数据库备注治理，不改变类型/空值/默认值/索引主外键`
- 已完成：`已完成任务登记，待生成 migration SQL 并落库验证`
- 当前阻塞：`无`
- 需要前端配合：`无（本轮后端独立完成）`
- 契约/测试结果：`待执行 migration 与 build 验证后回填`
- 关闭条件：`5 张表全字段 COMMENT 生效并完成最小验证`

### BE-20260324-10

- 任务编号：`BE-20260324-10`
- 日期：`2026-03-24`
- 任务标题：`“可二期或后续(urgencyAnalysis.deferredFeatures)又丢失”高优根因排查`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已完成（止血补丁已落地）`
- 涉及模块：`problem-cases / contracts / runtime`
- 目标结果：`修复 update/import 覆盖导致 operationModel/businessStatus/urgencyAnalysis/requirementDetailHistory/requirementDetail 丢失；确保 create/update/import 契约一致且可回归验证`
- 已完成：
  - `update` 保字段：`PrismaProblemCaseRepository.update` 在本次更新涉及 `basicInfo` 或任一新增字段时，先读旧 `basicInfo.__createContractExtras`，并将未显式覆盖的 extras merge 回写，避免 `PUT /api/problem-cases/:id` 写 `basicInfo` 时静默丢失。
  - `update` 契约补齐：`problem-case.service.ts` 的 `updateProblemCaseSchema` 新增 `requirementDetail/requirementDetailHistory/operationModel/businessStatus/urgencyAnalysis`。
  - `import` 补齐：`importCasePackage` 在创建与后续更新阶段都传递上述 5 字段，确保 `export -> import -> GET` 可回读。
  - 回归测试：
    - `prisma-problem-case.repository.test.ts`：`basicInfo` 更新时保留旧 `urgencyAnalysis.deferredFeatures`。
    - `problem-cases.test.ts`：`create -> GET` 保留新增字段（既有用例覆盖并通过）。
    - `problem-case-import-export.test.ts`：`export -> import -> GET` 保留新增字段。
  - 构建与测试：`npm run test -- tests/prisma-problem-case.repository.test.ts tests/problem-cases.test.ts tests/problem-case-import-export.test.ts` 通过；`npm run build` 通过。
- 当前阻塞：`无`
- 需要前端配合：`无（后端先止血）`
- 契约/测试结果：`33/33 测试通过；build 通过`
- 关闭条件：`新增字段在 create/update/import 不再静默丢失`（已达成）

### BE-20260324-11

- 任务编号：`BE-20260324-11`
- 日期：`2026-03-24`
- 任务标题：`task11 节点级 checkpoint 改造（v1.5 最小方案）`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`problem-cases / tests / contracts / runtime`
- 目标结果：`新增 PUT /api/problem-cases/:id/tasks/task11/steps/:stepIndex，仅更新 coreBusinessObjectSessions 指定节点；支持 stepName/stageName/coreBusinessObjectJson/confirmed/llmMeta；不新建表，GET /api/problem-cases/:id 仍返回完整 sessions`
- 已完成：
  - 新增接口：`PUT /api/problem-cases/:id/tasks/task11/steps/:stepIndex`（鉴权继承 `/api/problem-cases/*`）。
  - 服务层新增 `upsertTask11Step`：仅更新指定 `stepIndex` 节点；不覆盖其它 step；当 `coreBusinessObjectSessions` 不存在时，补最小外壳 `{ valueStream, sessions: [] }` 后写入；若 body 含 `stepIndex`，要求与路径一致。
  - 支持写入字段：`stepIndex`、`stepName`、`stageName`、`coreBusinessObjectJson`、`confirmed`（可单独更新）、`llmMeta`（可选）。
  - `GET /api/problem-cases/:id` 保持原语义，继续返回完整 `coreBusinessObjectSessions`（数组或带 `sessions` 的壳结构均可读）。
  - 测试：`problem-cases.test.ts` 新增 3 条最小回归（step0 不影响其它 step；连续写 step0/step1 后 GET 可见双节点；confirmed 单独更新/随写入更新）。
  - 运行时复验脚本：`backend/scripts/_runtime-verify-task11-step.cjs`。
- 当前阻塞：`无`
- 需要前端配合：`前端 task11 每步完成后直接调用节点接口写 checkpoint，刷新时改读 GET /api/problem-cases/:id 的完整 sessions 恢复`
- 契约/测试结果：
  - `npm run test -- tests/problem-cases.test.ts`：`21/21` 通过（含新增 3 条）。
  - `npm run build`：通过。
  - 重启：`stop-local-backend.ps1` 后 `start-local-backend.ps1 -SkipBuild`，当前 `3002`、`health=true`。
  - 运行时：`node scripts/_runtime-verify-task11-step.cjs http://127.0.0.1:3002` 输出 `ok:true`，3 个场景均通过。
- 关闭条件：`已达成`

### BE-20260321-03

- 任务编号：`BE-20260321-03`
- 日期：`2026-03-21`
- 任务标题：`案例与消息导入导出后端实现`
- 来源：`architect-owner`
- 优先级：`P1`
- 当前状态：`已完成（v1 单案例 JSON 包）`
- 涉及模块：`problem-cases / tests / contracts`
- 目标结果：`提供单案例导出与导入接口，导出 ProblemCase + ProblemCaseMessage 为统一 JSON 包，导入时重生成 caseId/messageId 并完整落库`
- 已完成：
  - 接口：`GET /api/problem-cases/:id/export`（`application/json`，`Content-Disposition: attachment`；文件名为 `{customerName}_{当前任务 label}.json`，含 `filename*=UTF-8''...`，规则与 `getTaskSummaries` 中当前阶段 `current`/`pending` 一致，见 `docs/superpowers/specs/2026-03-24-export-filename-design.md`）
  - 接口：`POST /api/problem-cases/import`（请求体为 JSON 包，**导入为新案例**）
  - 接口：`POST /api/problem-cases/:id/restore`（**同包结构覆盖当前案例**，不新建 id；服务端校验包内 `case.customerName` 与库内一致；消息全量替换）
  - 导出结构：`schemaVersion`（固定 `1`）、`exportedAt`、`case`、`messages`；可选 `clientMeta`（`displayArchiveNo`、`displayCustomerName`，前端写入，导入忽略，恢复时由前端校验编号）
  - 导入：Zod 校验；忽略包内 `case.id` / `message.id` / `message.caseId`；后端生成新 `ProblemCase.id` 与每条 `message.id`；`case.createdAt`/`updatedAt` 以新建为准，不沿用包内时间戳
  - 导入响应：`caseId`、`importedMessageCount`、`schemaVersion`
  - 非法 JSON：`400` + `请求体不是合法 JSON`（`entity.parse.failed`）
  - 参数校验失败：`400` + Zod `issues`（与现有路由一致）
  - 测试：`problem-case-import-export.test.ts`（export / import / 缺字段 / 非法 JSON）
- 当前阻塞：`无`
- 需要前端配合：`下载 export 响应体为 JSON 文件上传至 import；不实现批量导入`
- 契约/测试结果：`npm test` / `npm run build` 通过
- 关闭条件：`后端接口、校验、持久化与最小测试通过，且前端可基于返回结果完成导入导出闭环`（已达成）

### BE-20260321-06

- 任务编号：`BE-20260321-06`
- 日期：`2026-03-21`
- 任务标题：`导入导出运行时路由与消息替换异常排查`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已完成（处理阶段：export 已在本机 3002 回归为 200）`
- 涉及模块：`problem-cases / 运行时 / contracts`
- 目标结果：`解释同 case 下 GET messages 200 但 GET export 404；明确运行实例与仓库 dist 是否一致；PUT /messages 400 是否仍为 schema 问题`
- export **404** 根因（冻结结论）：
  - **主因**：**运行中的 backend 未加载含 `GET /:id/export` 的路由表**——典型为 **合入 export 后未 `npm run build`、或 build 后未重启**；Node **无热重载**，内存中的路由在进程启动时固定。
  - **补充**：若 **3002 无进程监听**，则浏览器表现为连不上或代理层异常，需先 **`PORT=3002` + `node dist/src/server.js`** 拉起服务。
  - **与「直接打开 URL」**：`/api/problem-cases/*` **需鉴权**；**无 `Authorization` 时正确返回为 `401`（未登录）**，**不是** `404`。若曾见 `404`，更可能是 **旧进程无该路由**（Express 未匹配路由）或 **URL 拼错**；见 `401` 则说明路由已存在，只需带 Bearer token。
- 处理阶段（agent 已执行）：
  - 工作区 `E:\03_do1_workspace\do1_smart_cto\backend` 执行 **`npm run build`**
  - **`PORT=3002`** 启动 **`node dist/src/server.js`**（加载当前 `dist`）
  - 回归：`GET /api/problem-cases/problem_18c56e0f/export` + **`Authorization: Bearer <JWT>`** → **`200`**，响应体含 `schemaVersion`、`exportedAt`、`case`、`messages`
  - 无 Token 同 URL → **`401`**（符合 `createJwtAuthMiddleware`）
- 是否已修复：**是**（在「最新 build + 重启后的 3002 实例」上，export 对存在 case 为 **200**）
- 当前 3002 服务是否已是最新版本：**是**（以本次在工作区 **`npm run build` 后立刻启动的进程**为准；若用户本机另有常驻进程，需自行停旧再起，避免占端口）
- PUT `/api/problem-cases/:caseId/messages` **400**（第二优先级，待续）：
  - **仍为 `syncMessagesSchema` 校验失败**（路由会进入 `replaceMessages`）；不是「找不到路由」
  - 每条 `items[]` 必填：`id`（非空字符串）、`content`（string）、`timestamp`（**Zod `z.string().datetime()`**，须为合法 ISO 8601 datetime 字符串）
  - 可选：`taskId`、`taskName`、`role`（仅 `user`/`assistant`/`system`）、`type`、`confirmed`；其它字段可走 `.passthrough()`
  - 另：**若日志为 `401`**，则为 **未带/失效 token**，不是 schema 问题（参见前端对 PUT 补 `Authorization`）
  - 需前端补充证据：**完整响应体**（含 `issues` 数组）、**实际 request body**
- 当前阻塞：`无（export 路径已验证）`
- 需要前端配合：`export/import 请求必须带 Bearer；浏览器直开无 token 会得到 401`
- 契约/测试结果：`本机 build + 重启后 GET .../export 200（带 JWT）；无 JWT 401`
- 关闭条件：`export 运行时 404 已消除（在正确 build+重启+鉴权前提下）`（已达成）；`PUT 400` 仍待前端补证据时继续

### BE-20260321-07

- 任务编号：`BE-20260321-07`
- 日期：`2026-03-21`
- 任务标题：`import 400 与 messages 400 契约错位排查`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已完成（契约结论已冻结）`
- 涉及模块：`problem-cases / contracts`
- 目标结果：`确认 POST /import 实际支持的 Content-Type；解释 import 400 与 PUT /messages 400 是否与前端契约不一致`
- **POST `/api/problem-cases/import` 实际支持什么**：
  - **仅支持 `application/json` 的 raw body**（与 BE-20260321-03 v1 设计一致：JSON 案例包）
  - **不支持** `multipart/form-data` / `file` 字段上传：`backend/src/app.ts` 仅 `express.json({ limit: '2mb' })`，**未**挂载 `multer`、`busboy` 或 `express.raw` 解析文件
  - 路由：`POST /import` 直接 `service.importCasePackage(req.body)`；`multipart` 时 **`req.body` 通常为空或非对象**，`importCasePackageSchema.parse(payload)` **Zod 失败** → **`400` + `请求参数不合法` + `issues`**
- **import 400 根因判断**：
  - **是**：若前端用 **FormData + `file`** 而 **未**把 JSON 包作为 `Content-Type: application/json` 发送，则与后端契约 **不一致**，表现为 **400**（与「后端只收 JSON」一致）
- **修复建议**（冻结 v1 口径）：
  - **优先改前端**：用 `fetch`/`axios` 发送 **`JSON.stringify(包)`**，`Content-Type: application/json`；或先读 file 为 `text` 再 `JSON.parse` 后 POST
  - **改后端**：若产品坚持「multipart 上传文件」为唯一入口，需**另开任务**增加 `multer` 等解析并在 handler 内 `JSON.parse` 文件内容——**不属本轮最小改动**，且与 BE-20260321-03「JSON 包」文档需同步
- **PUT `/api/problem-cases/:caseId/messages` 400**（`syncMessagesSchema`）：
  - 契约：`{ "items": [ { "id", "content", "timestamp", ... } ] }`
  - **最易失败字段**（按经验排序）：
    1. **`timestamp`**：`z.string().datetime()`（Zod 4 ISO 8601），**非** ISO 字符串、或带非标准格式 → 失败
    2. **`items`** 缺失或 **非数组** → 失败
    3. **`id`** 缺失或空字符串 → 失败
    4. **`role`**：若存在则 **必须** 为 `user` | `assistant` | `system`（其它值 → 失败）
  - 待前端提供 **完整 request body + 响应 `issues`** 后，可逐条定位 **第几条 message、哪个 path**（如 `items[3].timestamp`）
- 当前阻塞：`无（契约已写明）`
- 需要前端配合：`import 改为 JSON body；PUT 补全 payload 与 400 响应 issues`
- 契约/测试结果：`代码审阅 app.ts + problem-case.routes.ts + syncMessagesSchema / importCasePackageSchema`
- 关闭条件：`import 与 PUT 契约与真实现象对齐说明已写入`（已达成）

### BE-20260321-08

- 任务编号：`BE-20260321-08`
- 日期：`2026-03-21`
- 任务标题：`本地 backend 标准启动脚本`
- 来源：`architect-owner`
- 优先级：`P1`
- 当前状态：`已完成`
- 涉及模块：`backend / scripts / DX`
- 目标结果：`用固定脚本替代反复 netstat/PID/工作目录排查，一键启动并记录 PID、端口、日志、health`
- 已完成：
  - `backend/scripts/start-local-backend.ps1`：读 `.env`；校验 **`DATABASE_URL`**；**`prisma db execute`（SELECT 1）** 测库；**`prisma db push`**（`-SkipDbPush` 可跳过）；**`npm run build`**（`-SkipBuild` 可跳过）；启动 **`node dist/src/server.js`**；轮询 **`/health`**；写入 **`backend/.local/run/state.json`**；输出 PORT、PID、**`backend/.local/logs/backend.{out,err}.log`**、Health URL
  - `backend/scripts/stop-local-backend.ps1`：按 **state.json** 的 PID 结束进程并删除状态文件
  - `backend/scripts/status-local-backend.ps1`：输出存活、PID、端口、health；退出码 0/1/2
  - `backend/scripts/_local-backend-common.ps1`：共用解析与状态
  - `backend/scripts/README-local.md`：用法、路径、失败排障（≤3 步）
  - `backend/README.md`：增加本地入口说明
  - 根 `.gitignore`：忽略 **`backend/.local/`**
- 当前阻塞：`无`
- 需要前端配合：`无`
- 契约/测试结果：`status-local-backend.ps1` 在无 state 时退出 0；脚本可执行性已验证
- 关闭条件：`三套脚本 + 文档 + gitignore 已落地`（已达成）

### BE-20260321-09

- 任务编号：`BE-20260321-09`
- 日期：`2026-03-21`
- 任务标题：`修复本地 backend 启动脚本的 Windows PowerShell 编码兼容问题`
- 来源：`user`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`backend / scripts / DX`
- 目标结果：`让 start/status/stop 三个本地脚本在当前 Windows PowerShell 环境直接可执行，不再因中文字符串或文件编码报 ParserError`
- 已完成：
  - 将 `backend/scripts/start-local-backend.ps1`
  - `backend/scripts/status-local-backend.ps1`
  - `backend/scripts/stop-local-backend.ps1`
  - `backend/scripts/_local-backend-common.ps1`
    中的注释、提示文案、输出全部收敛为 ASCII
  - 将上述 4 个脚本显式重写为 ASCII 编码，消除 Windows PowerShell 对非 ASCII / 编码的解析歧义
  - 顺手同步 `backend/scripts/README-local.md` 与 `backend/README.md` 的脚本说明为 ASCII 口径
  - 按用户补充要求收口最小运行策略：`start-local-backend.ps1` 现在会优先尝试启动本地 MariaDB；若 `.env` 目标端口被占用，则自动顺延到下一个可用端口
  - 在当前环境完成闭环验证：`.\scripts\start-local-backend.ps1` 成功启动；因 `3000` 与 `3001` 已被占用，backend 自动启动在 `3002`；`.\scripts\status-local-backend.ps1` 返回 `alive=True health=True`；`.\scripts\stop-local-backend.ps1` 成功停止并清理 `state.json`
- 当前阻塞：`无`
- 需要前端配合：`无`
- 契约/测试结果：`Windows PowerShell 下已不再出现 ParserError；start/status/stop 三脚本已在当前环境实跑通过`
- 关闭条件：`start/status/stop 三个脚本在当前环境可直接运行`（已达成）

### BE-20260322-01

- 任务编号：`BE-20260322-01`
- 日期：`2026-03-22`
- 任务标题：`排查 ProblemDetail 的 PUT /messages 与 PUT /case 500`
- 来源：`user`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`problem-cases / contracts / tests`
- 目标结果：`定位并修复 http://127.0.0.1:3002 下 PUT /api/problem-cases/:id/messages 与 PUT /api/problem-cases/:id 的 500 根因`
- 已完成：
  - 已重读 project-core.mdc 与 backend-agent.md
  - 已检查 backend 本地日志并确认本次不是单一根因，而是两条并行问题：
    - `PUT /api/problem-cases/:id`：MariaDB + Prisma `problemCase.update()` 触发 `DriverAdapterError: Record has changed since last read in table 'problemcase'`（MySQL 1020）
    - `PUT /api/problem-cases/:id/messages`：前端仍大量走旧兼容接口全量回写时间线，本地日志已出现 `PayloadTooLargeError`（约 3.1MB > 2MB）
  - 修复：
    - `backend/src/modules/problem-cases/prisma-problem-case.repository.ts`：将 `problemCase.update()` 改为 `updateMany() + findUnique()`，规避 MariaDB 1020 的更新读取冲突
    - `backend/src/app.ts`：将 `express.json` 限制从 `2mb` 提升到 `8mb`
    - `backend/src/app.ts`：对 `entity.too.large` / `413` 增加明确错误映射，避免 body-parser 继续落到通用 500
  - 测试：
    - 新增 `backend/tests/problem-case-large-payload.test.ts`，覆盖大于 2MB 的旧 `PUT /messages` 兼容路径
    - 新增 `backend/tests/prisma-problem-case.repository.test.ts`，锁定 `updateMany + findUnique` 更新路径
  - 真实回归：
    - 已重启本地 backend 到最新代码（`3002`）
    - 使用 admin JWT 直接回归 `PUT /api/problem-cases/problem_1b09d811`，返回 `200`
    - 构造约 `3.2MB` 的 `PUT /api/problem-cases/problem_1b09d811/messages` 请求，返回 `200`
    - `npm test` 通过
    - `npm run build` 通过
- 当前阻塞：`无`
- 需要前端配合：`无，先由后端本地复现和修复`
- 契约/测试结果：`本地问题 case 已回归为 200；新增 2 条最小测试；npm test / npm run build 通过`
- 关闭条件：`PUT /messages 与 PUT /case 在本地问题 case 上恢复为非 500，且补最小回归验证`（已达成）

### BE-20260322-03

- 任务编号：`BE-20260322-03`
- 日期：`2026-03-22`
- 任务标题：`3002 上 /api/ai/chat 运行时版本对齐（finishReason / truncated / maxOutputTokens）`
- 来源：`user`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`ai / runtime`
- 目标结果：`排除旧进程未加载最新 dist，使 chat 响应与 `ai.routes.ts` 契约一致`
- 已完成：`见「追加任务记录 · BE-20260322-03」`
- 当前阻塞：`无`
- 需要前端配合：`无（本轮不动前端）`
- 契约/测试结果：`task11 + maxOutputTokens=8192 运行时复测含三字段`
- 关闭条件：`已达成`

### BE-20260320-04

- 任务编号：`BE-20260320-04`
- 日期：`2026-03-20`
- 任务标题：`启动本地 MariaDB 开发库`
- 来源：`user`
- 优先级：`P0`
- 当前状态：`进行中`
- 涉及模块：`problem-cases / tests`
- 目标结果：`启动本地 MariaDB 实例并确认 3306 监听、项目库可连接`
- 已完成：`已重读工作面板；已核对本地数据库文档；已确认 mariadbd 程序存在、3306 当前未监听、文档中的旧 my.ini 路径已失效，实际配置位于 C:\\Program Files\\MariaDB 12.2\\data\\my.ini`

### BE-20260321-02

- 任务编号：`BE-20260321-02`
- 日期：`2026-03-21`
- 任务标题：`按后端边界完成提交并冻结提交说明`
- 来源：`architect-owner`
- 优先级：`P1`
- 当前状态：`已完成（本地 commit，未 push）`
- 涉及模块：`problem-cases / tests / contracts`
- 目标结果：`将本轮后端相关改动按后端边界完成一次独立提交，用户后续只负责 review 与 push`
- 已完成：
  - owner 已冻结提交边界与 commit message：`fix(backend): stop using timestamp ids for problem cases`
  - 已按指定文件清单完成本地 `git commit`（未 push）；未纳入 `docs/agents/architect-owner.md`
- commit hash：以 `git rev-parse HEAD` 为准（本任务对应 commit message：`fix(backend): stop using timestamp ids for problem cases`；若对本文档再次 `git commit --amend`，hash 会变化，请以 `git log -1` 输出为准）
- 实际提交文件清单：
  - `backend/src/modules/problem-cases/problem-case.service.ts`
  - `backend/tests/problem-cases.test.ts`
  - `docs/agents/backend-agent.md`
- 未提交 backend 相关文件：`无`（提交后工作区中 `backend/` 下无未提交改动）
- 当前阻塞：`无`
- 需要前端配合：`无`
- 契约/测试结果：`本提交对应 BE-20260320-05 主键口径落盘；历史基线曾回报 npm test / npm run build 通过`
- 关闭条件：`后端范围改动完成独立 commit，并回报 commit hash 与提交范围`（已达成）

### BE-20260320-04

- 任务编号：`BE-20260320-04`
- 日期：`2026-03-20`
- 任务标题：`AI 配置与用户表缺失后端排查`
- 来源：`architect-owner`
- 优先级：`P0`
- 涉及模块：`ai / auth / prisma`
- 当前状态：`待派工`
- 目标结果：`确认当前 backend 实际连接的数据库、AppSetting 中 ai.deepseek.apiKey 是否存在，以及 AdminUser/AppUser 表是否存在`
- 已完成：`本地代码已确认 AI 配置只从 AppSetting 读取，且 key 固定为 ai.deepseek.apiKey / ai.deepseek.apiUrl / ai.deepseek.model；migration 中已定义 AppSetting/AdminUser/AppUser`
- 当前阻塞：`等待 backend-agent 核对当前 DATABASE_URL 指向的真实库与 migration 状态`
- 需要前端配合：`提供 /api/ai/config 前端侧返回值与报错复现场景`
- 契约/测试结果：`代码层结论明确，环境层待核实`
- 关闭条件：`明确根因属于 key 不存在、连错库、还是 migration 未执行，并给出处理结果`

### BE-20260320-05

- 任务编号：`BE-20260320-05`
- 日期：`2026-03-20`
- 任务标题：`案例主键生成口径修复`
- 来源：`architect-owner`
- 优先级：`P0`
- 涉及模块：`problem-cases / prisma`
- 当前状态：`已完成（停止时间戳主键链路）`
- 目标结果：`停止 online 创建案例时使用前端时间戳作为主键，改为后端生成独立 caseId，并返回给前端`
- 已完成：
  - `POST /api/problem-cases` 创建时忽略前端传入的 `id`（例如 createdAt 时间戳），由后端生成独立 `caseId`
  - 创建响应、列表响应、详情响应均返回后端生成的 `ProblemCase.id`
  - 新增回归测试：即便 payload 里携带时间戳 id，也不应再成为最终主键（detail 以新 caseId 可读、旧 incomingId 404）
- 当前阻塞：`无`
- 需要前端配合：`前端在收到创建响应后应使用后端返回的 caseId 作为后续详情主键（不要再依赖 createdAt 作为最终主键）`
- 契约/测试结果：`新增用例通过；npm test/build 通过`
- 关闭条件：`新创建案例不再以时间戳作为主键，且详情/列表/刷新链路可用（主键由 caseId 对齐）`
- 备注：`2026-03-20 owner 确认通过；后端保持基线稳定，进入前端联调待命（不新增实现；仅当前端反馈创建/列表/详情 caseId 不一致时再介入）`

### BE-20260321-01

- 任务编号：`BE-20260321-01`
- 日期：`2026-03-21`
- 任务标题：`PUT /messages 400 后端侧排查`
- 来源：`architect-owner`
- 优先级：`P0`
- 涉及模块：`problem-cases / contracts`
- 当前状态：`待派工`
- 目标结果：`定位 syncMessagesSchema 在 PUT /messages 上的具体失败字段，并给出最小修复方案`
- 已完成：`代码层已确认 replaceMessages 会先执行 syncMessagesSchema.parse(payload)，items[].id/content/timestamp 受严格约束，role 若存在必须为 user/assistant/system`
- 当前阻塞：`等待前端提供真实 request body 与触发场景`
- 需要前端配合：`提供 failing request body、触发步骤、响应体`
- 契约/测试结果：`当前 400 更像 schema 校验失败而非路由问题`
- 关闭条件：`明确失败字段并完成修复或增强报错可观测性`

## 7. 每日更新区

### BE-20260320-02

- 任务编号：`BE-20260320-02`
- 日期：`2026-03-20`
- 任务标题：`线上 confirm 404 后端侧排查`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`待派工`
- 涉及模块：`problem-cases / contracts`
- 目标结果：`确认线上 backend 是否已部署 POST /api/problem-cases/:caseId/tasks/:taskId/confirm，且确认 404 是路由不存在还是案例不存在`
- 已完成：`本地代码已确认路由存在，且服务层在 case 不存在时也会返回 404`
- 当前阻塞：`等待线上环境证据或线上部署版本信息`
- 需要前端配合：`提供 Network 面板中的真实请求方法、响应体、Authorization 以及同 caseId 的 detail/tasks 请求结果`
- 契约/测试结果：`本地 POST confirm 路由与相关契约测试正常`
- 关闭条件：`确认线上 404 根因并给出修复路径`

> 说明：每次完成一个接口或一个阶段时，都在本区追加更新，不要覆盖旧记录。

### 2026-05-08 设计详情推理图主键（文档索引）

- **摘要**：新写入 **`DesignDetailTaskToken.tokenId`**＝`tk_{asciiTask}_{caseCompact}_{6位}`；**`DesignFeatureNode.featureId`**＝`ft_`+12 位十进制；**`DesignLogicLink.linkId`**＝`lk_`+12 位；分配器 **`backend/src/modules/problem-cases/design-detail-graph-ids.ts`**；与历史 **cuid** / **`dd:…`** 并存；**`GET …/design-detail/task-graph`** 聚合与任务 2 L1 Evidence 的 **`FeatureID`** 口径见 **`docs/agents/backend/01-context.md`**。
- **分形文档**：根 **`AGENTS.md`**、`docs/agents/backend/00-core.md` 交叉引用、`docs/agents/AGENTS.md` 成员表、`backend/prisma/AGENTS.md`、`frontend-vue/src/design-detail/AGENTS.md`、`design_mode_ux.md`、**`.cursor/agents/product-delivery-orchestrator.md`**、`frontend/js/AGENTS.md`（`task1BusinessInsight` 行）已同步。

### 2026-03-24 追加更新（一）

- 日期：2026-03-24
- 今日完成：`BE-20260324-01` — 新增 `GET /api/problem-cases/:id/report`（鉴权），即时聚合售前报告 DTO；`problem-cases.test.ts` 补 2 条；`npm test`、`npm run build` 通过；本地 `3002` 实调 `POST` 建案 + `GET .../report` 200。
- 当前阻塞：无
- 已交付接口：见任务记录区 `BE-20260324-01`

### 2026-03-24 追加更新（二）

- 日期：2026-03-24
- 今日完成：`BE-20260324-10` — 修复“新增字段寄存 basicInfo.__createContractExtras 在 update/import 链路反复丢失”问题；`PUT /api/problem-cases/:id` 写 `basicInfo` 时改为 merge 旧 extras；`update` 契约补齐 `requirementDetail/requirementDetailHistory/operationModel/businessStatus/urgencyAnalysis`；`import` 同步补齐这 5 字段。
- 今日完成：补 3 个关键回归验证：`prisma-problem-case.repository.test.ts`（PUT basicInfo 不丢 `urgencyAnalysis.deferredFeatures`）、`problem-cases.test.ts`（create->GET 保留新增字段）、`problem-case-import-export.test.ts`（export->import->GET 保留新增字段）。
- 当前阻塞：无
- 已交付接口：`PUT /api/problem-cases/:id`、`POST /api/problem-cases/import`（行为止血，无新增路由）

### 2026-03-24 追加更新（三）

- 日期：2026-03-24
- 今日完成：`BE-20260324-11` — 新增 `PUT /api/problem-cases/:id/tasks/task11/steps/:stepIndex` 节点级 checkpoint 写入；不新建表，仍落在 `ProblemCase.coreBusinessObjectSessions`；仅更新指定 step，不覆盖其它 step；sessions 缺失时补最小 `{ valueStream, sessions: [] }` 外壳。
- 今日完成：`problem-cases.test.ts` 新增 3 条最小回归并通过：`step0` 写入不影响其它 step、连续写 `step0/step1` 后 GET 可见两个节点、`confirmed` 支持单独更新或随写入更新。
- 今日完成：已执行 `npm run test -- tests/problem-cases.test.ts` 与 `npm run build`；已重启本地 backend（`3002` 健康）；运行时脚本 `node scripts/_runtime-verify-task11-step.cjs http://127.0.0.1:3002` 输出 `ok:true`。
- 当前阻塞：无
- 已交付接口：`PUT /api/problem-cases/:id/tasks/task11/steps/:stepIndex`

### 2026-03-23 追加更新（一）

- 日期：2026-03-23
- 今日完成：`BE-20260323-01` — 新增 `PATCH /api/problem-cases/:caseId/messages/:messageId`，请求体仅允许 `content` / `confirmed` / `payloadJson` / `timestamp` / `taskId` / `taskName` / `type` / `role`（至少一项，禁止未知字段）；响应为归一化后的单条消息。
- 今日完成：`PUT /api/problem-cases/:caseId/messages` 增加兜底：若数据库中已有至少一条消息，而请求体为「恰好一条、content 为 `请输入客户基本信息`、role 为空/null/`system`」的整段替换，则 **不执行 delete+insert**，直接 **200** 返回当前消息列表（no-op），防止默认占位初始化覆盖真实历史。
- 当前阻塞：无
- 已交付接口：见任务记录区 `BE-20260323-01`

### 2026-03-23 追加更新（二）

- 日期：2026-03-23
- **回报固定项（backend 接口行为变更后的收尾）**：
  - **是否已 `npm run build`**：是（`backend` 目录执行，通过）。
  - **是否已重启 backend**：是（`stop-local-backend.ps1` → `start-local-backend.ps1 -SkipBuild`）。
  - **当前 3002 是否最新实例**：是——`state.json` 的 `scriptRoot` 指向本仓库 `backend`；`dist/src/server.js` 修改时间早于本次 `startedAt`；进程为 `node dist/src/server.js`（现场记录 `pid=23828`，以实际 `state.json` 为准）。
  - **是否已做真实接口最小复验**：是——`node scripts/_runtime-verify-messages.cjs http://127.0.0.1:3002` 通过；覆盖 **PATCH** `/messages/:messageId` 与 **PUT** `/messages` 占位保护。
- 当前阻塞：无

### 更新模板

- 日期：
- 今日完成：
- 当前阻塞：
- 明日计划：
- 已交付接口：
- 尚未冻结的决策点：

### 2026-03-20

- 日期：2026-03-20
- 今日完成：已阅读本周任务清单、冻结边界、与架构 owner 沟通区；完成 ProblemDetail 后端基线扫描，确认当前实现与本周面板目标的差距。
- 今日完成：完成 P0 鉴权回归修复；收紧 `/api/ai` 挂载（移除无鉴权挂载）；`/openapi.json` 与 `/api-docs` 现均需 `Authorization`；同步更新/新增鉴权用例覆盖未登录 `401`。
- 今日完成：已执行 `npm install` 补齐缺失依赖；更新后 `npm test` 全量通过（Prisma 集成用例默认跳过，需 `RUN_PRISMA_TESTS=true` 才运行）。
- 今日完成：已新增 P0 ProblemDetail 闭环接口并落地鉴权；新增 `POST/DELETE /api/problem-cases/:caseId/messages`，以及 `POST /api/problem-cases/:caseId/tasks/:taskId/{start,confirm,revise,rollback}`；并新增未登录 `401` 用例。
- 今日完成：完成 P1 第一段消息字段归一化（`caseId` 补齐、`payloadJson` 缺失时收拢额外 card 字段），避免破坏前端兼容的同时满足“固定字段”要求。
- 今日完成：强化 P1 固定字段契约：`GET /api/problem-cases/:caseId/messages` 返回的每条消息稳定包含 `caseId/payloadJson(缺失则为 null)/confirmed(boolean)/timestamp/string`，并避免将 `taskName` 等结构字段错误塞入 `payloadJson`；同时更新回归用例。
- 今日完成：已修复 `npm run build` 的 TypeScript 编译错误，`npm run build` 恢复可用。
- 今日完成：新增并通过 `problem-detail-contracts.test.ts` 校准 P1 三读取契约（detail/tasks/messages：主键围绕 `ProblemCase.id`，messages 固定 `payloadJson=null/confirmed=false/timestamp ISO`）；同时把 `tasks/messages` 响应补上顶层 `caseId`。
- 今日完成：提供后端 agent 服务给前端联调（`NODE_ENV=test` 内存模式），并探测 confirm/revise/rollback/messages delete 四类接口成功返回码：`200/200/200/204`
- 今日完成：由于测试环境 MySQL 连接池超时，本轮联调不依赖 login；使用 admin JWT token 直连即可完成关键动作验证
- 今日完成：已启动真实数据库模式后端（3002），MySQL 127.0.0.1:3306 可用；`/api/auth/login(root/root)` 返回 token 后，四类接口探测成功（confirm/revise/rollback 均 200，messages delete 为 204）。
- 今日完成：BE-20260320-05 案例主键生成口径修复：`POST /api/problem-cases` 创建时忽略前端传入的 `id(createdAt)`，始终由后端生成独立 `ProblemCase.id`；新增回归用例通过（`npm test`/`npm run build` 通过）。
- 今日完成：BE-20260320-05 案例主键生成口径修复：`POST /api/problem-cases` 创建时忽略前端传入的 `id(createdAt)`，始终由后端生成独立 `ProblemCase.id`；新增回归测试覆盖“detail/列表/旧incomingId 404”。
- 今日完成：BE-20260320-05 经 owner 确认通过；后端不扩大战线，进入前端联调待命（不新增实现；仅当前端消费新 `caseId` 出现创建/列表/详情不一致时再介入排查）。
- 当前阻塞：无（P0/P1 基线已可 `npm test` 与 `npm run build`；Prisma 集成用例默认跳过，需显式开启 `RUN_PRISMA_TESTS=true`）。
- 明日计划：先按 P0 修复鉴权与测试基线，再进入 ProblemDetail 的消息追加接口和任务动作接口。
- 明日计划：推进 P1 统一详情页读取结构（`GET /api/problem-cases/:caseId` 以及 tasks/messages 响应字段一致性）。
- 已交付接口：无，本次为接手与基线盘点阶段。
- 尚未冻结的决策点：`GET /api/problem-cases/:caseId` 是否需要一次性返回 case、tasks、messages 的聚合结构，还是维持三个读取接口由前端组装。

### 2026-03-21

- 日期：2026-03-21
- 今日完成：BE-20260321-02 按后端边界完成本地提交（未 push）：message `fix(backend): stop using timestamp ids for problem cases`；纳入 `problem-case.service.ts`、`problem-cases.test.ts`、`backend-agent.md`；`backend/` 工作区无未提交改动；未 stage `architect-owner.md`；commit hash 以 `git rev-parse HEAD` 为准（见任务记录区 BE-20260321-02）。
- 今日完成：BE-20260321-03 案例与消息导入导出 v1：`GET /api/problem-cases/:id/export`、`POST /api/problem-cases/import`；JSON 包字段 `schemaVersion/exportedAt/case/messages`；导入为新案例并重生成 `caseId`/`messageId`；`problem-case-import-export.test.ts` + `app` 非法 JSON `400`；`npm test` / `npm run build` 通过。
- 今日完成：BE-20260321-06 运行时排查：本机 `3002` 为 `node dist/src/server.js`（PID 6064，约 2026-03-20 23:07 启动）；工作区 `dist` 已含 `/:id/export`，export **404** 归类为 **未重启/进程内存为旧 dist**；`PUT /messages` **400** 仍为 **`syncMessagesSchema`**（`items[].id`、`content`、`timestamp` ISO datetime 等）；需前端补 **response `issues` + 完整 request body**。
- 今日完成：BE-20260321-06 **处理阶段**：工作区 `backend` 执行 **`npm run build`**，**`PORT=3002`** 重启 **`node dist/src/server.js`**；回归 **`GET /api/problem-cases/problem_18c56e0f/export` + Bearer JWT → 200**；无 Token → **401**（非 404）。明确：**404 主因=旧进程/未重启/未加载最新 dist**；**直开 URL 无鉴权应见 401**。
- 今日完成：BE-20260321-07 **import / PUT messages 契约**：确认 **`POST /import` 仅 `application/json` raw body**，**不支持 multipart/FormData**（无 multer；`req.body` 非 JSON 包则 Zod 400）；**import 400 与「前端 FormData+file」不一致高度吻合**；**PUT /messages** 按 **`syncMessagesSchema`**，**最可疑 `items[].timestamp`（ISO datetime）**，其次 `items`/`id`/`role`；待前端补 payload 与 `issues` 精确定位。
- 今日完成：BE-20260321-08 **本地 backend 标准启动脚本**：`start-local-backend.ps1` / `stop-local-backend.ps1` / `status-local-backend.ps1` + **`backend/.local/`** 状态与日志（已 gitignore）；`scripts/README-local.md` + `backend/README.md` 入口说明。
- 今日完成：BE-20260321-09 **Windows PowerShell 编码兼容修复**：将 start/status/stop/common 四个脚本及相关 README 收敛为 ASCII 文本并显式保存为 ASCII 编码；消除中文字符串触发的 `ParserError`。同时按用户当场冻结要求补最小运行策略：优先尝试启动本地 MariaDB，若 `.env` 指定端口被占用则自动顺延。实跑结果：`start` 成功、`status` 健康、`stop` 成功；当前环境因 `3000`/`3001` 已占用，backend 自动运行在 `3002`。

### 2026-03-22

- 日期：2026-03-22
- 今日完成：BE-20260322-01 排查并修复 `http://127.0.0.1:3002` 下 ProblemDetail 两类 500。确认本次是双根因：`PUT /api/problem-cases/:id` 命中 MariaDB/Prisma `problemcase` 更新冲突（MySQL 1020），`PUT /api/problem-cases/:id/messages` 则命中旧兼容接口全量回写导致的 `PayloadTooLargeError`（约 3.1MB > 2MB）。
- 今日完成：将 `PrismaProblemCaseRepository.update()` 改为 `updateMany + findUnique`，规避 MariaDB 1020；同时把 `express.json` 上限从 `2mb` 提升到 `8mb`，并为 `entity.too.large` 返回明确 `413`，避免继续表现为 500。
- 今日完成：新增 `problem-case-large-payload.test.ts` 与 `prisma-problem-case.repository.test.ts`，并通过 `npm test` / `npm run build`。
- 今日完成：已重启本地 backend 到最新代码并对真实问题 case `problem_1b09d811` 做运行时回归：`PUT /api/problem-cases/problem_1b09d811 -> 200`；构造约 `3.2MB` 的 `PUT /api/problem-cases/problem_1b09d811/messages -> 200`。
- 今日完成：收到用户新反馈：同一路径 `PUT /api/problem-cases/problem_1b09d811/messages` 已从 `500` 收敛为 `400`。当前后端判断的最高优先级根因是“读写契约不对称”：`GET /messages` 返回中允许 `taskId/taskName/role/type = null`，但 `PUT /messages` 的 `syncMessagesSchema` 当前只接受非 null 的可选字符串/枚举，前端若直接把读取结果回写，将被 Zod 以 `400` 拒绝。
- 今日完成：BE-20260322-02 鉴权改造：默认 JWT `8h`（`JWT_EXPIRES_IN` 可覆盖）；`requireAuth` 成功且响应为 2xx 时通过 `X-Auth-Token`、`X-Auth-Expires-At` 返回新令牌；`jwt-auth-renewal.test.ts` + `npm test` / `npm run build` 通过。
- 今日完成：BE-20260322-04 **import 专用 body 上限**：`jsonBodyParser` 对 `POST /api/problem-cases/import` 选用 `32mb`，其余 `8mb`（避免 `app.use(path, json())` 未命中仍走 8mb）；`entity.too.large` 仍映射为 `413` + `{ message: '请求体超出限制' }`；`problem-case-import-export.test.ts` 回归通过；`npm test` / `npm run build` 通过。
- 当前阻塞：无
- 明日计划：继续观察前端是否仍频繁使用旧 `PUT /messages` 兼容路径；如继续放大时间线，再评估是否需要把兼容路径单独收口到更适合的增量接口或压缩策略。
- 已交付接口：无新增接口，本轮为运行时 500 修复与兼容性回归。
- 尚未冻结的决策点：前端何时完全迁移出旧 `PUT /api/problem-cases/:id/messages` 全量回写模式。

### 2026-03-23

- 日期：2026-03-23
- 今日完成：BE-20260323-01 **PUT /api/problem-cases/:id 404 排查**：确认 `problem_26b8ad82` 在当前 `DATABASE_URL` 下 **存在**；404 来自 **problem-case 路由 + repository**（`updateMany` count=0 被当作案例不存在）；实因多为 **`data: {}` 空更新**（与 Prisma `updateMany` 对空 `data` 返回 `count: 0` 一致）。现场 access log 中该 case 曾出现 **单次 PUT 404 且前后为 200**，符合偶发空 payload 而非缺库。
- 今日完成：BE-20260323-02 **空有效更新语义修复**：`sanitize` 后 `payload` 为空时走 **`findById` no-op（200）**，不再用 **`updateMany` count=0** 判不存在；`InMemoryProblemCaseRepository` 对齐（空更新不刷 `updatedAt`）。补 `prisma-problem-case.repository.test.ts` + `problem-cases.test.ts` 最小用例；`npm test` / `npm run build` 通过。
- 今日完成：BE-20260323-02 **收尾**：`build` + 脚本重启 **3002**；`PUT /api/problem-cases/problem_26b8ad82` + `{}` + 有效 admin JWT → **200**（真实接口复验）。
- 今日完成：BE-20260323-03 **online 创建案例新增字段持久化止血**：create 契约补齐 `requirementDetail/requirementDetailHistory/operationModel/businessStatus/urgencyAnalysis`；Prisma create 持久化至 `basicInfo.__createContractExtras`，并在 GET detail 回填为顶层字段；补 2 条回归测试（POST 新字段、POST 后 GET 回读），老字段 create/list/delete 链路保持通过。
- 当前阻塞：无
- 明日计划：owner 可用浏览器/前端或 curl 按同样方式做最终确认（需有效登录或等价 Bearer）。
- 已交付接口：行为变更仅限 **`PUT /api/problem-cases/:id`** 空 body（或解析后无字段）场景。
- 尚未冻结的决策点：无（已采用 **200 + 当前资源** 作为空更新语义）。

### 2026-03-23 追加更新（三）

- 日期：2026-03-23
- 今日完成：`BE-20260323-04` 运行时核查闭环完成：`npm run build` 通过；重启后 `3002` 实例确认来自本仓库最新 `dist`；真实 `POST /api/problem-cases`（含 5 字段）返回 `201` 且字段齐全；紧随 `GET /api/problem-cases/:id` 返回 `200` 且同 5 字段齐全，`caseId=problem_9f5da9fb`。
- 当前阻塞：无
- 结论：当前“新建 -> 详情读取”链路在最新 3002 实例正常；若现场仍缺字段，优先判断为旧 case 历史数据或旧实例创建，不是本轮新建链路问题。

### 2026-03-23 追加更新（四）

- 日期：2026-03-23
- 今日完成：`BE-20260323-05` 完成。`GET /api/problem-cases/:id` 对外语义已收口：`basicInfo` 若仅含 `__createContractExtras` 则返回空；存在任意真实客户基本信息字段则照常返回。`requirementDetail / requirementDetailHistory / operationModel / businessStatus / urgencyAnalysis` 顶层回填保持正常。
- 今日完成：补充最小测试（extras-only / 真实 basicInfo / 新增字段回填回归），并执行 `npm run test -- tests/prisma-problem-case.repository.test.ts tests/problem-cases.test.ts`，结果 `22/22` 通过。
- 当前阻塞：无
- 明日计划：等待前端联调反馈；若有旧 case 历史数据异常，再按证据做最小补丁。

### 2026-03-23 追加更新（五）

- 日期：2026-03-23
- 今日完成：`BE-20260323-06`（AI 代理链路运行时排障经验沉淀）已整理，覆盖“本机 curl 正常但 /api/ai/chat 500”的真实案例。
- 经验总结（可复用）：
  - **先分层验证，不要混查**：按“上游可达（curl 直连 DeepSeek）→ 后端健康（/health）→ 后端代理调用（/api/ai/chat）”三段排查，先定位故障层级再改代码。
  - **对外部网络故障返回 502，不要吞成 500**：`ai.routes.ts` 对 `fetch` 网络异常（如 `ENOTFOUND`）单独捕获，返回带 `code/hostname` 的可读错误，前端可直接判断是 DNS/网络问题。
  - **区分“代码问题”与“进程运行环境问题”**：出现“终端直连 `api.deepseek.com` 正常，但后端报 `ENOTFOUND`”时，优先怀疑后端进程所在环境（沙箱/代理/DNS）而非 API Key。
  - **重启要可验证**：重启后必须同时核验 `lsof -iTCP:3002`、`/health`、一次最小 `/api/ai/chat` 实调用，不仅看“服务已启动”日志。
  - **依赖前置检查纳入重启流程**：本次出现 `Cannot find module '.prisma/client/default'`，说明应将 `prisma generate` 作为启动前检查项（或放入启动脚本）。
  - **日志口径统一**：后端错误文案应可直接供前端展示与定位（例如 `AI provider request failed (ENOTFOUND api.deepseek.com)`），减少跨角色重复沟通成本。
- 当前阻塞：无
- 明日计划：若再次出现同类问题，优先记录“进程环境 + DNS 解析 + 代理变量 + /api/ai/chat 原始响应”四元证据，再做最小修复。

## 8. 与架构 owner 沟通区

> 说明：凡是需要拍板、发现前端越界承担规则、或后端边界不清晰的问题，都写在这里。

### 沟通模板

- 发现的未鉴权接口及处理状态：
- 需要拍板的接口边界：
- 哪些逻辑仍然在前端裁决：
- 当前实现的风险：
- 下一个最值得后移到后端的能力：

### 2026-03-20 首轮沟通

- 需要拍板的接口边界：请确认 ProblemDetail 首屏读取边界。当前面板要求统一详情读取结构，但尚未明确是单一聚合接口还是继续拆分为 `detail/tasks/messages` 三个接口。
- 哪些逻辑仍然在前端裁决：从现有代码和测试看，ProblemDetail 主链路仍由前端决定何时写入消息、何时切换任务状态；后端目前只有兼容性的全量 `PUT /messages`，还不是唯一裁决入口。
- 当前实现的风险：`/api/ai/*` 目前存在重复挂载，实际会绕过鉴权；默认管理员 `root/root` 与 JWT 默认密钥仍可进入生产路径；测试基线与当前受保护接口不一致，无法作为 ProblemDetail 改造的可信回归网。
- 下一个最值得后移到后端的能力：以 `POST /api/problem-cases/:caseId/messages` 与 `task start / confirm / revise / rollback` 为核心，把消息时间线和任务状态流转统一收回后端裁决。
- 当前联调风险（需 owner 知悉）：本机访问测试环境 MySQL 时发生连接池超时，导致使用真实 DB 时 `login` 和 `POST /api/problem-cases` 会返回 `500`；为保证临调验证继续，本轮先以 `NODE_ENV=test` 内存模式提供接口契约验证服务。
- 当前真实 DB 联调状态更新：本机 MySQL 运行正常；已执行 `npx prisma db push` 同步 Prisma schema，使缺失表（如 `adminuser`）创建完成；因此真实模式下 login/关键接口可用。
- 需要拍板的接口边界：请确认任务动作 `start/confirm/revise/rollback` 的语义映射（`taskStartNotification` 的 `confirmed` 切换、`taskCompleteBlock` 写入/删除、`completedStages/workflowAlignCompletedStages/itGapCompletedStages` 与 `currentMajorStage` 推进/回退、回退时应删除哪些消息）。当前实现草案：start=确认 `taskStartNotification`；confirm=写入 `taskCompleteBlock` + 更新阶段完成数组；revise/rollback=删除 `taskCompleteBlock` + 回退阶段数组并将 `taskStartNotification` 重置为未确认。
- 需要拍板的接口边界：新增 P0 事项“案例详情路由标识收口”。请确认后端对外唯一案例主键是否正式冻结为 `ProblemCase.id`；若确认，则后端后续所有列表/详情/消息/任务响应都必须稳定返回该 `id`，前端不再以 `createdAt` 作为详情页主路由键。
- 当前观察到的前端风险（需同步 owner）：现有 `frontend/main.js` 仍大量以 `item.createdAt` 作为问题主键/缓存 key（`openDetail/历史/回退/重启任务` 等路径）；若 owner 仍坚持本周冻结口径改用 `?caseId` + 后端 `ProblemCase.id`，需要前端尽快同步 storage key 与路由主键，否则用户刷新/回退可能出现“详情数据与聊天时间线错位”。
- 当前后端已用契约测试把主键对齐收口：`detail.id === caseId`，`messages.items[].caseId === caseId` 且 tasks/messages 响应顶层也返回 `caseId`。仍需 owner 确认前端是否要用 `caseId` 取代 `createdAt` 做 storage key；否则后端无法保证回退/刷新时的时间线主键一致。
- 关于“纯数字主键”：本轮我们只修复并停止“时间戳即主键”的错误链路，仍保持 `ProblemCase.id` 为后端生成的字符串主键（如 `problem_<uuid>`）。若后续确需“纯数字显示编号”，建议另立 `displayId/caseNo` 并作为非主键字段（单列为后续任务），避免本轮扩大 schema 风险与影响路由/history 修复。
- 2026-03-22 风险补充：前端当前仍在大量依赖兼容接口 `PUT /api/problem-cases/:id/messages` 回写整条消息时间线；本地日志已出现 `PayloadTooLargeError`（约 3.1MB > 2MB 限制）。这说明前端仍承担“整条时间线裁决与全量覆盖写回”的职责，和本周“后端裁决、旧 PUT /messages 仅兼容”的冻结边界不完全一致。后端本轮会先做最小兼容兜底，但后续仍建议前端继续迁移到增量消息接口。

## 9. 跨 Agent 协同留言方式

> 说明：后端 agent 不能修改前端项目。如需前端配合，统一按以下格式在本文件中留言。

### 留言位置

- 先在“每日更新区”说明当前阻塞。
- 再在本区追加正式协同留言。
- 不把跨 agent 协同事项只留在聊天里。

### 协同留言模板

- 日期：
- 协同对象：`frontend-agent`
- 事项标题：
- 背景：
- 当前后端现状：
- 需要前端配合：
- 建议页面或调用调整：
- 阻塞等级：`P0 | P1 | P2`
- 期望回复时间：
- 备注：

## 10. 验收标准

- 未登录访问受保护接口返回 `401/403`。
- `npm test` 可执行。
- 追加消息流可用。
- `task start / confirm / revise / rollback` 可用。
- 详情页刷新可恢复状态。

## 11. 给 Backend Agent 的提示词

你是 Smart CTO 项目的后端执行 agent。

先阅读并以后续唯一工作面板为准：

- `project-core.mdc`（项目协作总规则，与根目录 `AGENTS.md` 配套）
- `E:\03_do1_workspace\do1_smart_cto\docs\agents\backend-agent.md`

你的职责是：

- 负责后端规则入口、消息模型、动作接口、鉴权和测试基线。
- 把 `ProblemDetail` 主链路从“前端裁决”逐步改成“后端裁决”。
- 本周只聚焦 `ProblemDetail` 闭环，不扩大战线。
- 不能修改 `frontend` 和 `frontend-vue` 项目。

你的工作要求：

- 每次开始工作前先阅读该文档中的“本周任务清单”“冻结边界”“与架构 owner 沟通区”。
- 每接到一个新任务，先登记“任务记录区”，再开始执行。
- 每次开始工作前同时确认自己遵守 `project-core.mdc`（项目协作总规则，与根目录 `AGENTS.md` 配套） 中的总规则。
- 每完成一个接口、测试批次、或阶段，同时更新该文档的“任务记录区”和“每日更新区”。
- 如果你发现前端仍在承担不该承担的规则，或需要我拍板接口边界，不要只在聊天中说，要同步写入该文档“与架构 owner 沟通区”。
- 如果需要前端协同，不要直接修改前端项目，而是按本文档“跨 Agent 协同留言方式”留言。
- 所有后续任务更新、阻塞、风险、决策请求，都统一写入该 markdown 中维护。

## 12. 追加任务记录（2026-03-21）

### BE-20260321-06

- 任务编号：`BE-20260321-06`
- 日期：`2026-03-21`
- 任务标题：`导入导出运行时路由与消息替换异常排查`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`待派工`
- 涉及模块：`problem-cases / tests / runtime`
- 目标结果：`确认运行中的 backend 为什么对同一 case 的 messages 返回 200 但 export 返回 404，并定位 PUT /messages 400 的 schema 失败点`
- 已完成：`仓库代码已确认存在 GET /api/problem-cases/:id/export 与 POST /api/problem-cases/import；PUT /messages 仍走 syncMessagesSchema 校验`
- 当前阻塞：`当前用户再次确认 http://127.0.0.1:3002/api/problem-cases/problem_18c56e0f/export 仍为 404；与仓库代码中的 /:id/export 路由不一致，优先怀疑运行进程未重启、未加载最新代码，或当前 3002 进程并非本工作区对应实例`
- 需要前端配合：`如需进一步定位 PUT /messages 400，前端需补 failing request body 与 response body`
- 契约/测试结果：`代码层存在 export/import 路由；runtime 现象为 GET /messages 200、GET /export 404、PUT /messages 400`
- 关闭条件：`明确 export 404 的根因并修复；明确 PUT /messages 400 的具体失败字段与最小修复建议`

### BE-20260321-07

- 任务编号：`BE-20260321-07`
- 日期：`2026-03-21`
- 任务标题：`import 400 与 messages 400 契约错位排查`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`待派工`
- 涉及模块：`problem-cases / runtime / contracts`
- 目标结果：`确认 POST /api/problem-cases/import 400 的根因，并明确 PUT /messages 400 的失败字段`
- 已完成：`仓库代码已确认 problem-case.routes.ts 中 POST /import 直接调用 service.importCasePackage(req.body)；service 以 Zod JSON schema 解析 payload`
- 当前阻塞：`frontend 当前按 multipart/form-data 字段 file 上传，而 backend 当前代码看起来只接受 JSON body，存在明显契约不一致`
- 需要前端配合：`补充 import 请求体/响应体；补充触发 PUT /messages 400 的 request payload`
- 契约/测试结果：`运行日志已出现 POST /api/problem-cases/import 400（两次）与 PUT /messages 400`
- 关闭条件：`明确 import 400 根因并统一前后端契约；明确 PUT /messages 400 的具体字段失败点`

### BE-20260321-09

- 任务编号：`BE-20260321-09`
- 日期：`2026-03-21`
- 任务标题：`本地 backend 启动脚本编码兼容性修复`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`待派工`
- 涉及模块：`scripts / docs`
- 目标结果：`修复 start-local-backend.ps1 在 Windows PowerShell 下的 ParserError，确保 start/status/stop 可直接执行`
- 已完成：`已确认脚本逻辑结构本身存在；用户实际运行在多处中文字符串位置报 ParserError`
- 当前阻塞：`强烈怀疑脚本文件编码或非 ASCII 内容与 Windows PowerShell 兼容性冲突`
- 需要前端配合：`无`
- 契约/测试结果：`当前失败点集中在脚本中文字符串；应优先收敛为 PowerShell 兼容格式，再验证三脚本运行`
- 关闭条件：`start-local-backend.ps1、status-local-backend.ps1、stop-local-backend.ps1 可在用户当前环境直接执行`

### BE-20260322-02

- 任务编号：`BE-20260322-02`
- 日期：`2026-03-22`
- 任务标题：`online 模式 /api/ai/chat 解除 2000 output 截断并透出截断可观测性`
- 来源：`user`
- 优先级：`P0`
- 当前状态：`已完成（可进入联调）`
- 涉及模块：`ai / tests / contracts`
- 目标结果：`止血 task11 等大上下文单步推演不再被固定 max_tokens=2000 顶死；响应中可识别 finishReason、truncated，并保留 usage/model/durationMs`
- 已完成：
  - 已新增 `backend/src/modules/ai/ai-chat-truncation.ts`：默认输出上限 `8192`（可通过环境变量 `AI_CHAT_MAX_OUTPUT_TOKENS` 下调，硬封顶 `8192`）；支持请求体 `taskTag: "task11"` 保底与 `maxOutputTokens` 显式覆盖（256～硬封顶）
  - 已更新 `backend/src/modules/ai/ai.routes.ts`：`POST /api/ai/chat` 使用上述策略计算 `max_tokens`，不再写死 `2000`
  - 响应新增：`finishReason`（来自 provider `choices[0].finish_reason`，无则 `null`）、`truncated`（`finish_reason === "length"` 或 `completion_tokens` 达到/接近本次 `maxOutputTokens` 时置 `true`）、`maxOutputTokens`（本次实际下发给上游的值）
  - 已补充 `backend/tests/ai-chat-truncation.test.ts` 与 `backend/src/modules/ai/AGENTS.md`
  - `npm test`、`npm run build` 已通过
- 当前阻塞：`无`
- 需要前端配合：`可在请求体携带 `taskTag`/`maxOutputTokens`；联调时读取 `truncated`/`finishReason` 做 UI 提示`
- 契约/测试结果：`单元测试覆盖上限解析与截断推断；未在本机对真实 DeepSeek 再跑 task11（需联调环境密钥与耗时）`
- 关闭条件：`止血策略与可观测字段已落地并通过构建与测试`（已达成）
- 备注：`2026-03-22` 另有一条已完成的「PUT /messages nullable 兼容 400」修复，见「每日更新区 · 2026-03-22 追加更新（二）」，不再占用本任务编号。

### BE-20260322-03

- 任务编号：`BE-20260322-03`
- 日期：`2026-03-22`
- 任务标题：`确认 3002 上 /api/ai/chat 运行时版本并对齐到最新 dist`
- 来源：`user`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`ai / runtime / scripts`
- 目标结果：`排除「旧进程 / 未重启 / 非本工作区实例」导致的契约漂移，使 `POST /api/ai/chat` 运行时响应包含 `finishReason`、`truncated`、`maxOutputTokens`（与 `backend/src/modules/ai/ai.routes.ts` 一致）`
- 已完成：
  - 现场证据：`state.json` 中 PID `25432` 启动时间 `2026-03-22T00:29:53`，而工作区 `dist/src/modules/ai/ai.routes.js` 与 `ai-chat-truncation.js` 最后写入时间为同日 `19:00:55` —— **进程早于最新 dist 构建启动，内存中仍为旧版路由（无三字段）**。
  - 已执行 `backend/scripts/stop-local-backend.ps1` + `start-local-backend.ps1`（含 `npm run build`），新进程 PID `1724`，`startedAt` `2026-03-22T19:27:08+08:00`，端口仍为 `3002`，`state.json.scriptRoot` 指向本仓库 `backend`。
  - 已用与联调一致的请求参数复测：`taskTag: task11`、`maxOutputTokens: 8192`（JWT 与测试 `ai-auth.test.ts` 同源 admin 签名）；`POST http://127.0.0.1:3002/api/ai/chat` 返回 `200`，响应体包含 `finishReason`（如 `"stop"`）、`truncated`（如 `false`）、`maxOutputTokens: 8192`，以及既有 `content` / `usage` / `model` / `durationMs`。
- 当前阻塞：`无`
- 需要前端配合：`本轮不要求前端改动；后续若再次看不到三字段，优先核对 backend 是否已 rebuild 且进程是否在 build 之后重启`
- 契约/测试结果：`运行时复测通过；根因归类为「dist 新于进程启动时间，未重启」而非代码缺失`
- 关闭条件：`3002 上 chat 响应已包含 finishReason / truncated / maxOutputTokens`（已达成）

### 2026-03-22 追加更新（三）

- 日期：2026-03-22
- 今日完成：`BE-20260322-02` — `POST /api/ai/chat` 将默认 `max_tokens` 从固定 `2000` 调整为可配置策略（默认 `8192`，环境变量 `AI_CHAT_MAX_OUTPUT_TOKENS`，请求体可选 `taskTag`/`maxOutputTokens`），并返回 `finishReason`、`truncated`、`maxOutputTokens` 与既有 `usage`/`model`/`durationMs`。
- 今日完成：`BE-20260322-03` — 确认 `3002` 上曾长期运行的进程（PID `25432`，`00:29` 启动）早于当日 `19:00` 的 `dist` 重编译，导致 `/api/ai/chat` 仍为旧响应形态；已 stop+start 对齐到最新 `dist`，`taskTag=task11` + `maxOutputTokens=8192` 复测响应已含 `finishReason` / `truncated` / `maxOutputTokens`。
- 当前阻塞：无
- 明日计划：联调真实 task11，确认 `completion_tokens` 不再稳定顶在 `2000`，并验证 `truncated` 与现场 `finish_reason` 一致。

### 2026-03-22 追加更新（二）

- 日期：2026-03-22
- 今日完成：收到用户提供的真实 curl 后，已确认 `PUT /api/problem-cases/problem_1b09d811/messages` 当前 `400` 的直接触发条件不是鉴权，也不是路由缺失，而是旧兼容时间线回写里包含 `taskId/taskName/role/type = null`。
- 今日完成：已对 `syncMessagesSchema` 做最小兼容补丁，使 `PUT /messages` 与当前 `GET /messages` 的 nullable 返回契约保持对称，避免前端读取后原样回写被 Zod 拒绝。
- 今日完成：已在 `problem-cases.test.ts` 增加回归测试，覆盖真实 nullable 可选字段 payload。
- 当前阻塞：无
- 明日计划：继续观察前端是否仍大量依赖旧 `PUT /messages` 全量回写；若频率持续偏高，继续推动回到增量消息接口。
- 已交付接口：无新增接口，本轮为旧兼容接口契约修复。
- 尚未冻结的决策点：前端何时完全退出旧 `PUT /api/problem-cases/:id/messages` 的全量回写模式。

### 2026-03-22 与架构 owner 补充沟通

- 发现的未鉴权接口及处理状态：本次问题与鉴权无关，当前聚焦兼容接口契约修复。
- 需要拍板的接口边界：无新增拍板项，但建议继续维持“旧 PUT /messages 仅兼容，不再作为主链路”的冻结判断。
- 哪些逻辑仍然在前端裁决：前端当前仍在直接回写整条消息时间线，且 payload 中包含后端消息模型的 nullable 字段，这说明时间线拼装与覆盖写回逻辑仍未完全退出前端。
- 当前实现的风险：如果前端持续以“先 GET、再原样 PUT 全量 messages”的模式工作，兼容接口仍会继续承受大 payload、弱约束和回归风险；本轮虽已修掉 nullable 400，但它仍不是本周建议的主链路。
- 下一个最值得后移到后端的能力：继续推动前端迁移到 `POST /messages` 与任务动作接口，减少整条时间线回写。

### 2026-03-22 运行时验收补记

- 日期：2026-03-22
- 今日完成：已在 `backend` 工作区执行 `npm test` 与 `npm run build`，结果均通过。
- 今日完成：已确认本地 backend 当前运行在 `http://127.0.0.1:3002`，`status-local-backend.ps1` 返回 `alive=True health=True`。
- 今日完成：已用 Node 直接复放用户提供的真实 `PUT /api/problem-cases/problem_1b09d811/messages` payload（包含 `taskId/taskName/role/type = null`），运行时返回 `200`，说明本轮 nullable 契约修复已在本机 3002 生效。
- 当前阻塞：无
- 已交付接口：无新增接口，本轮为兼容接口契约修复与运行时验收。

### BE-20260322-01

- 任务编号：`BE-20260322-01`
- 日期：`2026-03-22`
- 任务标题：`task11 在线 AI 调用观测与保护性限制`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`部分由 BE-20260322-02 收敛；其余待观察`
- 涉及模块：`ai / tests / contracts`
- 目标结果：`为 task11 这类大上下文请求补观测、失败诊断和保护性限制，避免 online 模式静默失败`
- 已完成：`输出截断止血与 finishReason/truncated 已由 BE-20260322-02 落地；历史代码级结论（max_tokens=2000）已作废`
- 当前阻塞：`若仍出现上游 4xx/5xx 或上下文窗口不足，需结合 usage 与 provider 报错继续迭代`
- 需要前端配合：`前端可结合 `truncated` 做提示；prompt 收缩策略仍可对齐`
- 契约/测试结果：`见 BE-20260322-02`
- 关闭条件：`online 模式可观测 task11 大上下文请求的输入规模、失败原因与输出截断风险，并给出限制策略`（截断观测子目标已达成；全链路诊断仍可能需后续任务）

<<<<<<< HEAD
### BE-20260323-07 完成补记

- 任务编号：`BE-20260323-07`
- 日期：`2026-03-23`
- 任务标题：`ProblemCase 等 5 张业务表字段 COMMENT 治理（Prisma + MariaDB）`
- 来源：`user`
- 优先级：`P0`
- 当前状态：`已完成`
- 涉及模块：`prisma / migrations / database`
- 目标结果：`为 ProblemCase、ProblemCaseMessage、AppSetting、AdminUser、AppUser 全字段补齐中文 COMMENT，只做数据库备注治理，不改变字段类型、空值、默认值、索引、主键、外键`
- 已完成：
  - 已基于 `backend/prisma/schema.prisma`、真实表结构与当前业务语义整理 5 张表全部字段的中文备注
  - 已重写并落地 migration：`backend/prisma/migrations/20260323193000_add_business_table_comments/migration.sql`
  - `ProblemCase` 共 23 个字段已全部补齐备注，重点 JSON 字段已明确业务语义：
    - `basicInfo`：客户基本信息 JSON
    - `bmc`：商业模式画布 JSON
    - `requirementLogic`：需求逻辑结构 JSON
    - `valueStream`：价值流设计 JSON
    - `globalItGapAnalysisJson`：全局 IT 差距分析结果 JSON
    - `localItGapSessions`：局部 IT 差距分析会话过程 JSON
    - `localItGapAnalyses`：局部 IT 差距分析结果 JSON
    - `rolePermissionSessions`：角色权限设计会话过程 JSON
    - `coreBusinessObjectSessions`：核心业务对象设计会话过程 JSON
  - `ProblemCaseMessage` 共 12 个字段已全部补齐备注
  - `AppSetting` 共 5 个字段已全部补齐备注
  - `AdminUser` 共 5 个字段已全部补齐备注
  - `AppUser` 共 6 个字段已全部补齐备注
  - 已顺手补齐 5 张表的表级 COMMENT
- 当前阻塞：`无`
- 需要前端配合：`无`
- 契约/测试结果：
  - `npm run build` 通过
  - 本地库可连，已执行同一份 migration SQL 并完成落库验证
  - `information_schema.COLUMNS` 校验结果：
    - `problemcase`：23 / 23 字段已带 COMMENT
    - `problemcasemessage`：12 / 12 字段已带 COMMENT
    - `appsetting`：5 / 5 字段已带 COMMENT
    - `adminuser`：5 / 5 字段已带 COMMENT
    - `appuser`：6 / 6 字段已带 COMMENT
  - `information_schema.TABLES` 已确认 5 张表的表级 COMMENT 也已生效
  - 说明：当前本地库不存在 `_prisma_migrations`（历史上以 `db push` 为主），因此本轮采用“新增 migration 文件 + 直接执行同一份 migration SQL 做本地落库验证”的方式收尾，未扩大战线去做 baseline 迁移治理
- 关闭条件：`5 张表全字段 COMMENT 生效且 build 不回归`（已达成）

### 2026-03-23 追加更新（数据库字段备注治理）

- 日期：2026-03-23
- 今日完成：完成 `BE-20260323-07`，为 `ProblemCase`、`ProblemCaseMessage`、`AppSetting`、`AdminUser`、`AppUser` 5 张业务表的所有字段补齐中文 COMMENT，并同步补齐表级 COMMENT。
- 今日完成：新增并落地 `backend/prisma/migrations/20260323193000_add_business_table_comments/migration.sql`，本轮严格只做 COMMENT 治理，未改字段类型、nullability、default、索引、主键或外键。
- 今日完成：本地库连通后已执行同一份 migration SQL，`information_schema.COLUMNS` 校验通过，5 张表字段备注覆盖率分别为 `23/23`、`12/12`、`5/5`、`5/5`、`6/6`。
- 今日完成：`npm run build` 通过；由于本轮仅涉及数据库备注与 migration 文件，未改业务运行逻辑，因此未做服务重启。
- 当前阻塞：无
- 明日计划：如 owner 或用户后续要求，可继续补一轮“数据字典导出”或“SHOW FULL COLUMNS 样例截图/清单”，但不属于本轮硬要求。
- 已交付接口：无新增接口，本轮为数据库元数据治理。
- 尚未冻结的决策点：当前本地库仍无 `_prisma_migrations` 基线表；若后续要全面切换到 Prisma Migrate 管理历史，需要另开任务做基线治理，不在本轮处理范围内。
=======
### 2026-03-24

- 日期：2026-03-24
- 今日完成：**BE-20260324-09**：`ProblemCase` 表新增可选列 `coreBusinessObjectSystemPromptOverride`（LONGTEXT，迁移 `20260324120000_add_core_business_object_system_prompt_override`）；`PUT` 案例体 `updateProblemCaseSchema`、导入回填、`mapProblemCase` 透传；回退 task11 时与 `coreBusinessObjectSessions` 一并清空该字段，保证修改链路状态一致。
>>>>>>> 14d064b62babcfe105f402a3f2ef995227daa925
