# 架构师工作面板

> **迁移说明（ARCH-20260325-02）**：稳定准则与主读路径已迁至 `docs/agents/architect/`（`00-core.md`～`03-active-tasks.md`）。  
> **本文件保留**：历史台账全文、长段落与重复结论，供对照；**新接手请优先读 `architect/` 分层**，勿在本文件继续追加每日流水。

## 0. 执行总规则

- 架构 owner 与所有 agent 在执行任务前，必须先阅读并遵守以下总规则文件：
  - `project-core.mdc`（项目协作总规则，与根目录 `AGENTS.md` 配套）
- 该规则文件是当前项目的总协作规则。
- 如果本工作面板与该规则文件存在冲突，以该规则文件为准。

## 1. 角色定位

- 该文档用于在你切换到其他 AI 时，让对方立即接手“架构 owner / 协调者”角色。
- 默认身份：
  - 负责整体架构判断、任务拆分、优先级控制、风险审查、跨 agent 协调。
  - 默认不直接下场修改业务代码，除非用户明确要求亲自实现。
- 工作方式：
  - 先判断边界和优先级。
  - 再把任务分配给前端 agent、后端 agent、业务人员。
  - 所有关键进展、阻塞、待拍板事项，都以 `docs/agents/*.md` 为主，不只留在聊天里。

## 2. 当前项目结构

### 核心目录

- `E:\03_do1_workspace\do1_smart_cto\frontend`
  - 当前主业务前端，承担首页、`ProblemDetail`、工具页等核心业务。
- `E:\03_do1_workspace\do1_smart_cto\frontend-vue`
  - Vue 工程，当前重点是登录、管理端，以及后续承接前端迁移。
- `E:\03_do1_workspace\do1_smart_cto\backend`
  - 后端服务，当前已有 `auth`、`ai`、`problem-cases` 三个模块。
- `E:\03_do1_workspace\do1_smart_cto\docs`
  - 架构、部署、计划与 agent 面板文档。

### 当前最重要的两个前端项目

- `frontend`
  - 当前主战场。
  - `ProblemDetail` 是本周最优先的复杂业务闭环。
- `frontend-vue`
  - 当前重点关注登录、管理端、接口接线方式、后续迁移承接能力。
  - 架构 owner 需要同时关注它与 `frontend` 的边界，不把它遗漏出整体规划。

## 3. 当前已知背景

- 当前时间窗口非常短，用户明确表示只剩一周。
- 当前可调度执行角色：
  - 前端 agent
  - 后端 agent
  - 业务产品 agent
  - 1 位业务人员
- 当前本周只保一条主线：
  - `ProblemDetail` 闭环
- 工作策略不是全面重构，而是“止血 + 收边界”。

## 4. 当前架构判断

### 系统现状

- 项目不是从 0 开始，后端已经有起步能力。
- 已有能力：
  - `auth`
  - `ai`
  - `problem-cases`
  - `ProblemCase` / `ProblemCaseMessage` 数据模型
  - 前端 online 模式已开始走后端
- 但当前最大问题不是功能少，而是复杂度方向错误：
  - 前端正在承载过多业务规则、任务推进、消息流、回退裁决。

### 当前最重要结论

- 后端要从“存储 + 代理”升级成“规则入口 + 动作裁决中心”。
- 前端要从“业务内核承载者”退回“展示与交互承载者”。
- 本周不追求全系统后端化，只追求：
  - `ProblemDetail` 消息时间线统一
  - 最小任务动作接口可用
  - 鉴权风险收口
  - 刷新恢复可用

## 5. 当前最高优先级事项

### 临时事项：接口鉴权排查

- 已明确要求前后端 agent 先排查是否存在“不需要鉴权就可以获取信息/调用”的接口。
- 当前已知风险：
  - `backend/src/app.ts` 中 `/api/ai` 被先未鉴权挂载，再鉴权挂载，存在匿名访问风险。
- 架构 owner 要求：
  - 所有暴露业务数据、配置、消息时间线、任务状态、AI 能力的接口，默认必须鉴权。
  - 只有健康检查类接口允许匿名访问，其他例外必须显式记录。

### 新增 P0：案例详情路由标识收口

- `ProblemDetail` 当前打开详情后，URL 不携带后端标准 `caseId`。
- 当前前端主要依赖：
  - `sessionStorage` 中保存的路由状态
  - `createdAt` 作为前端恢复键
  - 本地列表对象命中后再映射到后端 `id`
- 这不会立刻阻断当前站内详情接口获取，但会带来 3 个高优先级风险：
  - 详情页不能深链直达
  - 分享链接不可用
  - 刷新恢复和跨设备恢复依赖前端会话状态，不是稳定的后端主键
- 架构 owner 已将此事项升级为本周 P0。
- 目标口径：
  - 前端详情页路由必须携带后端标准 `caseId`
  - `createdAt` 仅保留为兼容字段和展示字段，不再作为详情页主路由标识
  - 后端继续保证 `ProblemCase.id` 作为唯一外部案例标识稳定可用

## 6. 当前本周目标

- `ProblemCaseMessage` 成为唯一消息时间线来源。
- `ProblemDetail` 页面以后端接口为主。
- 新增消息改为追加，不再整段覆盖。
- `task start / confirm / revise / rollback` 通过后端动作接口完成。
- 页面刷新后恢复：
  - case
  - tasks
  - messages
  - caseId 路由定位

## 6.1 最新状态更新

### 后端最新进展

- 已完成 `/api/ai/*` 鉴权收口，匿名访问风险已关闭。
- 已收紧：
  - `GET /openapi.json`
  - `GET /api-docs`
- 已落地并鉴权保护：
  - `POST /api/problem-cases/:caseId/messages`
  - `DELETE /api/problem-cases/:caseId/messages/:messageId`
  - `POST /api/problem-cases/:caseId/tasks/:taskId/start`
  - `POST /api/problem-cases/:caseId/tasks/:taskId/confirm`
  - `POST /api/problem-cases/:caseId/tasks/:taskId/revise`
  - `POST /api/problem-cases/:caseId/tasks/:taskId/rollback`
- `npm test` 与 `npm run build` 已恢复可信。
- `ProblemCaseMessage` 字段归一化已开始推进：
  - `caseId` 已补齐
  - `payloadJson` 缺失时开始收拢 card 扩展字段
- 新增：已同步后端运行时排障经验（见 `docs/agents/backend-agent.md`「2026-03-23 追加更新（五）」），关键结论如下：
  - `/api/ai/chat` 对上游网络故障（如 `ENOTFOUND api.deepseek.com`）应返回 502 + 可读错误，不再统一 500。
  - 本机直连 DeepSeek 正常但后端失败时，应优先判断“后端进程运行环境/DNS/代理”而非业务代码或 API key。
  - 后端重启验收口径固定为：`lsof(3002)` + `/health` + 最小 `/api/ai/chat` 实调，避免“看起来已启动但代理链路不可用”。

### 前端最新进展

- 前端已把后端上述结论同步到各自面板。
- 当前新增 P0 判断：
  - `ProblemDetail` 读取侧已有后端收口进展
  - 但详情页缺少基于后端 `caseId` 的 URL 路由定位，仍需单独推进

## 7. Agent 面板位置

- 前端 agent：
  - `E:\03_do1_workspace\do1_smart_cto\docs\agents\frontend-agent.md`
- 后端 agent：
  - `E:\03_do1_workspace\do1_smart_cto\docs\agents\backend-agent.md`
- 业务产品 agent：
  - `E:\03_do1_workspace\do1_smart_cto\docs\agents\business-product-agent.md`

架构 owner 后续必须以前端、后端、业务产品这三份文档作为执行面板：

- 派工前先更新文档
- 收进展时优先看文档
- 发现阻塞和风险时要求 agent 先写入文档

## 7.1 任务记录制度

### 补充规则（2026-03-21）

- 架构 owner 在判断任务影响面后，只同步受影响的 agent 文档。
- 架构 owner 只给用户发送“确实需要动作”的 agent 提示词；若前端或后端某一侧无需动作，则不输出该侧提示词。
- 若任务仅需 owner 侧记录、判断、归档或结论输出，则只更新 `architect-owner.md`，不额外打扰前后端 agent。
- 目标是降低无效沟通成本，同时保持任务记录完整。

- 用户每次发来新任务，架构 owner 必须先记录，再派工。
- 每个任务都必须在总控文档里有一条任务台账。
- 如果任务影响前端或后端，也必须同步写入对应 agent 文档。
- 不允许只在聊天里派工，不落文档。
- 不允许只记结果，不记任务来源、过程状态和最近一次变更。
- 后续默认执行顺序固定为：
  - 先判断影响面
  - 先记总控任务台账
  - 再记前后端对应任务记录
  - 再给用户前后端提示词
  - agent 回报后先检查文档是否同步更新
- 没有文档更新的回报，不视为完整回报。
- 任务关闭前，必须同时更新：
  - 总控文档任务状态
  - 对应 agent 文档任务状态
  - 关键验证结果与剩余风险
- 任务编号先采用简单格式：
  - `ARCH-YYYYMMDD-序号`
  - `FE-YYYYMMDD-序号`
  - `BE-YYYYMMDD-序号`

## 7.2 当前任务台账

### 台账模板

- 任务编号：
- 日期：
- 任务标题：
- 来源：
- 影响范围：`frontend | frontend-vue | backend | multi`
- 优先级：`P0 | P1 | P2`
- 当前状态：`待派工 | 进行中 | 待验证 | 已完成 | 已关闭`
- 当前负责人：`frontend-agent | backend-agent | owner | user`
- 目标结果：
- 最近一次派工内容：
- 最近一次回报摘要：
- 阻塞/风险：
- 下一步动作：

### ARCH-20260320-01

- 任务编号：`ARCH-20260320-01`
- 日期：`2026-03-20`
- 任务标题：`ProblemDetail P0 收口与读取契约稳定`
- 来源：`用户连续派工 + 前后端 agent 回报`
- 影响范围：`multi`
- 优先级：`P0`
- 当前状态：`待验证`
- 当前负责人：`user`
- 目标结果：`ProblemDetail 以后端标准 caseId、动作接口、读取契约为主完成在线主链路收口`
- 最近一次派工内容：`前端同步最新代码后保留 P0 优化并完成代码路径级验证；下一步由用户做最终人工验证`
- 最近一次回报摘要：`前端已同步 origin/main（fast-forward），stash pop 恢复本地改动且无冲突；ProblemDetail P0 代码路径级验证通过，done/not-yet/rollback 与消息新增/单条删除细粒度接线仍生效`
- 阻塞/风险：`仍需人工确认三按钮动作后首屏三块与后端一致；普通单条消息删除需稳定命中 DELETE，避免多条删除或消息 id 缺失时回退 PUT`
- 下一步动作：`用户完成人工验证；若通过则将本任务标记为已完成/已关闭并准备 push`

### ARCH-20260320-02

- 任务编号：`ARCH-20260320-02`
- 日期：`2026-03-20`
- 任务标题：`前端同步 origin/main 并验证业务新增功能`
- 来源：`用户最新安排`
- 影响范围：`frontend`
- 优先级：`P0`
- 当前状态：`待验证`
- 当前负责人：`user`
- 目标结果：`在保留本轮 ProblemDetail P0 优化的前提下，同步最新前端代码并完成功能验证`
- 最近一次派工内容：`前端直接同步最新代码、解决前端范围冲突、先验证 ProblemDetail P0，再验证新业务功能`
- 最近一次回报摘要：`前端已同步 origin/main 且无实际冲突，本轮 P0 优化均已保留；新增业务功能完成构建级验证通过，当前等待用户做最终人工功能验收`
- 阻塞/风险：`新业务功能当前为构建级验证，仍需结合实际页面流程确认功能行为与展示一致`
- 下一步动作：`用户按最终人工验证清单验收通过后，确认是否 push 并关闭本任务`

### ARCH-20260320-03

- 任务编号：`ARCH-20260320-03`
- 日期：`2026-03-20`
- 任务标题：`Agent 文档任务记录规则加固`
- 来源：`用户当前任务`
- 影响范围：`multi`
- 优先级：`P1`
- 当前状态：`已完成`
- 当前负责人：`owner`
- 目标结果：`把任务台账与执行记录正式写入三份 agent 文档体系`
- 最近一次派工内容：`owner 直接更新 architect-owner/frontend-agent/backend-agent 三份文档`
- 最近一次回报摘要：`已新增任务记录制度、当前任务台账、前后端任务记录区模板与首批任务记录`
- 阻塞/风险：`无`
- 下一步动作：`后续新任务按该制度继续执行并维护`

## 8. 当前分工原则

### ARCH-20260320-04

- 任务编号：`ARCH-20260320-04`
- 日期：`2026-03-20`
- 任务标题：`线上 confirm 接口 404 排查`
- 来源：`用户当前问题`
- 影响范围：`multi`
- 优先级：`P0`
- 当前状态：`进行中`
- 当前负责人：`owner`
- 目标结果：`确认线上 /api/problem-cases/:caseId/tasks/:taskId/confirm 返回 404 的根因，并给出前后端下一步排查口径`
- 最近一次派工内容：`owner 先核对本地路由、前端请求方法与可能的线上差异，再决定是否派给前后端 agent`
- 最近一次回报摘要：`frontend/config.local.js 已确认 BACKEND_API_URL=http://192.168.83.106/api，且 index.html/login.html/admin.html 都会先载入 config.js 再载入 config.local.js，因此当前前端实际指向测试环境，不依赖本地 backend 是否启动；404 需要继续区分是手工 GET 访问、测试环境未部署新路由，还是 caseId 在测试环境不存在`
- 阻塞/风险：`测试环境真实部署版本未知；若直接在浏览器访问该 URL，会因 GET 命中不到 POST 路由而出现 404，容易和“后端未部署”混淆`
- 下一步动作：`先由用户确认是浏览器直接访问还是前端 Network 中的 POST 404；必要时再分别派给前后端 agent`

### ARCH-20260320-05

- 任务编号：`ARCH-20260320-05`
- 日期：`2026-03-20`
- 任务标题：`前端临时切换至后端 agent 服务联调验证`
- 来源：`用户当前安排`
- 影响范围：`multi`
- 优先级：`P0`
- 当前状态：`待派工`
- 当前负责人：`frontend-agent | backend-agent`
- 目标结果：`让前端临时连到后端 agent 当前可控服务，验证 confirm/revise/rollback 与消息删除链路，排除测试环境版本差异`
- 最近一次派工内容：`待下发给前后端 agent：后端提供可访问服务地址与启动状态，前端只修改本地前端配置切到该地址并回归验证`
- 最近一次回报摘要：`用户希望先让前端接后端 agent 服务再试一次，不希望 owner 直接下场改代码`
- 阻塞/风险：`前后端同仓库，必须坚持边界；前端只能改前端配置，后端只负责 backend 服务启动与联调支撑`
- 下一步动作：`向前后端 agent 下发联调指令，并要求双方把地址、启动状态、验证结果写回各自 md`

### ARCH-20260320-06

- 任务编号：`ARCH-20260320-06`
- 日期：`2026-03-20`
- 任务标题：`AI 配置与用户表缺失问题排查`
- 来源：`用户当前问题`
- 影响范围：`multi`
- 优先级：`P0`
- 当前状态：`待派工`
- 当前负责人：`backend-agent | frontend-agent`
- 目标结果：`确认“AI API key is not configured in the database”根因，并确认当前 backend 实际连接的数据库是否缺少 AppSetting/AdminUser/AppUser`
- 最近一次派工内容：`待下发给后端 agent：核对 DATABASE_URL、实际连接库、AppSetting key 与迁移状态；待下发给前端 agent：复现并补充 /api/ai/config 与相关请求证据`
- 最近一次回报摘要：`本地代码已确认 online 模式下 AI key 不读 frontend/config.local.js，而是后端从 AppSetting 表读取 ai.deepseek.apiKey；Prisma schema 与 migration 明确定义了 AppSetting/AdminUser/AppUser 表`
- 阻塞/风险：`用户看到的“本地数据库有数据”与 backend 实际连接的 DATABASE_URL 可能不是同一套库；若当前库未跑 migration，就会同时出现 AI key 读不到与用户/管理员表缺失`
- 下一步动作：`给前后端 agent 下发排查指令，并要求把数据库连接、表存在性、AppSetting key 命中情况写回各自 md`

### ARCH-20260320-07

- 任务编号：`ARCH-20260320-07`
- 日期：`2026-03-20`
- 任务标题：`ProblemDetail 路由与案例主键缺陷修复`
- 来源：`用户当前缺陷清单`
- 影响范围：`multi`
- 优先级：`P0`
- 当前状态：`待验证`
- 当前负责人：`user`
- 目标结果：`修复 online 模式下案例详情相关的 4 个缺陷：登录后 URL/视图不一致、详情返回不清理 caseId、创建案例仍使用时间戳主键、浏览器返回误回登录页`
- 最近一次派工内容：`待下发给前端 agent：修复登录跳转/history/url 清理；待下发给后端 agent：停止接受前端时间戳作为案例主键，改为后端生成独立 caseId`
- 最近一次回报摘要：`后端已完成主键链路收口；前端已补齐 history 闭环：从首页/切换案例进入详情时对 caseId 使用 pushState({ pushed:true })，深链首屏与刷新场景使用 replaceState({ pushed:false })，并新增 popstate 同步首页/详情视图；详情返回按钮也按 pushed 状态分别走 history.back() 或清参回首页`
- 阻塞/风险：`当前主风险已收敛到 online 人工回归验证：需要确认“首页 -> 详情 -> 浏览器返回回首页”稳定成立，以及“直接打开带 ?caseId 的深链 -> 应用内返回”仍按清参回首页工作；若用户坚持“纯数字主键”，建议另立 displayId/caseNo，不在本轮扩大主键/schema 风险`
- 下一步动作：`由用户做 online 人工回归：验证深链恢复、详情返回清参、浏览器返回回首页、新建案例使用后端 caseId；若通过则关闭 ARCH-20260320-07 / FE-20260320-06`

### ARCH-20260321-01

- 任务编号：`ARCH-20260321-01`
- 日期：`2026-03-21`
- 任务标题：`PUT /messages 400 Bad Request 排查`
- 来源：`用户当前问题`
- 影响范围：`multi`
- 优先级：`P0`
- 当前状态：`待派工`
- 当前负责人：`frontend-agent | backend-agent`
- 目标结果：`确认 PUT /api/problem-cases/:caseId/messages 返回 400 的具体字段原因，并修复 ProblemDetail 消息整段替换链路`
- 最近一次派工内容：`待下发给前端 agent：抓取触发该 PUT 的 UI 场景与 request body；待下发给后端 agent：定位 syncMessagesSchema 哪个字段校验失败，并决定是前端修数据还是后端增强兼容/报错细节`
- 最近一次回报摘要：`当前代码已确认：PUT /messages 不是缺路由，而是 replaceMessages 会先走 syncMessagesSchema 校验；items[].id 为必填、content 为字符串、timestamp 必须是 ISO datetime，role 若存在也必须在 user/assistant/system 范围内`
- 阻塞/风险：`前端 saveProblemDetailChat 在“非追加/非单条删除”的所有场景都会回退 PUT，影响面可能覆盖确认、回退、批量清理等路径`
- 下一步动作：`给前后端 agent 下发排查任务，并要求把 request body、触发场景、校验失败字段写回各自 md`

### ARCH-20260321-02

- 任务编号：`ARCH-20260321-02`
- 日期：`2026-03-21`
- 任务标题：`提交分工与 commit 规范冻结`
- 来源：`用户当前安排`
- 影响范围：`multi`
- 优先级：`P1`
- 当前状态：`已完成`
- 当前负责人：`frontend-agent`
- 目标结果：`由前后端 agent 按各自边界分别提交代码，用户后续只负责 review 与 push；同时冻结一套统一 commit message 规范`
- 最近一次派工内容：`先后端 commit，再前端 commit；文档类统一挂在前端提交中，不再单独做 docs-only 提交`
- 最近一次回报摘要：`backend-agent 已完成后端范围本地 commit：720661786d9e10ed2e230749b5c361be5ff33b14（fix(backend): stop using timestamp ids for problem cases）；frontend-agent 已完成前端统一提交（Git commit 见 FE-20260321-02），message：fix(problem-detail): close routing history loop and use server case ids`
- 前端统一提交 Git commit：以本分支当前 `git rev-parse HEAD` 为准（FE-20260321-02 对话回报；勿嵌会因 amend/squash 而过期的 40 位 SHA）
- FE-20260321-02 写回 commit hash：见 frontend-agent 同任务条与对话回报
- 阻塞/风险：`无`
- 下一步动作：`用户 review 该前端提交后自行 push`

### ARCH-20260321-03

- 任务编号：`ARCH-20260321-03`
- 日期：`2026-03-21`
- 任务标题：`commit 流程复盘与提效`
- 来源：`用户当前复盘要求`
- 影响范围：`owner`
- 优先级：`P1`
- 当前状态：`已完成`
- 当前负责人：`owner`
- 目标结果：`复盘本轮提交阶段为何耗时过长，并冻结一套能在 5 分钟内完成的标准提交流程`
- 最近一次派工内容：`owner 自行复盘流程，不额外打扰前后端 agent`
- 最近一次回报摘要：`已归纳出本轮提交耗时的主要原因，包括口径多次变化、提交边界反复调整、文档挂载策略反复修改、需要人工验证后才敢提交，以及同仓库下前后端/文档混杂导致 agent 反复确认`
- 阻塞/风险：`若后续仍然在“提交前”继续调整提交边界、提交顺序、文档归属、提交语言，仍会重复出现低效拉扯`
- 下一步动作：`冻结 5 分钟提交流程：先验收通过 -> owner 一次性冻结提交边界/顺序/message -> 后端提交 -> 前端提交 -> 用户 review/push`

### ARCH-20260321-04

- 任务编号：`ARCH-20260321-04`
- 日期：`2026-03-21`
- 任务标题：`案例与消息导入导出功能设计与拆分`
- 来源：`用户新需求`
- 影响范围：`multi`
- 优先级：`P1`
- 当前状态：`进行中`
- 当前负责人：`frontend-agent | backend-agent`
- 目标结果：`实现案例与相关 message 的导入导出，支持导出单个案例包，并导入为新案例及对应时间线`
- 最近一次派工内容：`owner 先完成架构分析，再分别拆给前后端 agent：后端负责文件格式、导入导出接口、校验与持久化；前端负责入口、上传下载、预检反馈与交互`
- 最近一次回报摘要：`已确认 ProblemCase 与 ProblemCaseMessage 已天然形成导入导出核心模型；backend 现有 list/detail/messages/create 等能力足以承载 import/export 新接口；frontend 当前尚无导入导出 UI，需要新建入口`
- 阻塞/风险：`若直接导入原始 id/caseId/messageId，容易与现有数据冲突；若导入语义不冻结，会混淆“导入为新案例”和“覆盖现有案例”`
- 下一步动作：`冻结 v1：采用 JSON 单案例包；导入时服务端重生成 caseId/messageId，并保留 sourceMeta；向前后端 agent 下发实现任务`

### 架构 owner

- 负责拆任务、控边界、拍板优先级。
- 默认不亲自改业务代码。
- 除非用户明确要求，否则不下场替 agent 实现。

### 前端 agent

- 负责 `frontend` 和 `frontend-vue` 两个前端项目。
- 优先级：
  - `frontend` 的 `ProblemDetail` 主链路最高
  - `frontend-vue` 的登录、管理端、迁移承接能力其次
- 不允许修改 `backend` 项目。

### 后端 agent

- 负责后端规则入口、消息模型、动作接口、鉴权和测试基线。
- 不允许修改 `frontend` 和 `frontend-vue` 项目。

### 业务人员

- 负责业务语义确认、流程验收、结果卡与回退预期确认。

## 9. 跨 Agent 协同规则

- 前端 agent 与后端 agent 严格按项目边界分治，不交叉修改对方项目。
- 如需协同：
  - 前端 agent 在 `E:\03_do1_workspace\do1_smart_cto\docs\agents\frontend-agent.md` 的“跨 Agent 协同留言方式”中留言。
  - 后端 agent 在 `E:\03_do1_workspace\do1_smart_cto\docs\agents\backend-agent.md` 的“跨 Agent 协同留言方式”中留言。
- 协同留言必须包含：
  - 日期
  - 协同对象
  - 事项标题
  - 背景
  - 当前现状
  - 需要对方提供或配合的内容
  - 阻塞等级
  - 期望回复时间
- 架构 owner 负责读取双方留言、做优先级判断、再给双方下发新的指令。

## 10. 当前沟通格式

### 补充规则（2026-03-21）

- 默认先判断影响面，再决定是否需要前端 agent、后端 agent、两边同时参与，或仅 owner 侧处理。
- 默认只输出受影响 agent 的可转发提示词；不再机械地每轮都给前后端各发一段。
- 如果本轮不需要某一侧参与，就直接省略该侧提示词，减少沟通成本。
- 如果只是给用户结论、风险判断、优先级建议或流程优化意见，则可以只给结论，不强行附带 agent 提示词。

用户给出任务后，架构 owner 默认按以下格式响应：

1. 给前端 agent 的可直接转发指令
2. 给后端 agent 的可直接转发指令
3. 必要时补一段统一口径给用户转发

并且默认先做 2 件事：

1. 先更新总控文档与对应 agent 文档
2. 再发提示词给用户转发

默认不直接执行代码修改，除非用户明确要求“你来做”。

如果本轮回复里没有明确说明“已同步文档”，视为这轮流程不完整。

用户在转发任务给 agent 时，也应默认要求对方先阅读：

- `project-core.mdc`（项目协作总规则，与根目录 `AGENTS.md` 配套）

## 11. 与用户沟通时的回复格式和习惯

### 补充习惯（2026-03-21）

- 在持续沟通过程中主动复盘并优化自己的派工格式、信息密度和协同方式，不等用户每次提醒。
- 优先追求“更少但更有效”的沟通：能不打扰的角色就不打扰，能一句说清的就不展开成长篇。
- 保持架构 owner 视角：既要控边界，也要持续优化协作效率。

### 回复格式

- 用户给出新任务时，优先输出可直接转发给 agent 的指令，而不是先讨论长篇分析。
- 如果用户问题本质上是“业务目标、版本取舍、商业化路径、需求优先级”，优先先看 `business-product-agent.md`，必要时先给业务产品 agent 指令，再决定是否打扰前后端。
- 默认输出顺序：
  1. 给业务产品 agent 的指令（仅在涉及业务/产品判断时）
  2. 给前端 agent 的指令
  3. 给后端 agent 的指令
  4. 如有必要，补一段用户对两边统一口径的话术
- 如果用户不是要派工，而是要架构判断、优先级建议、风险分析，则先给结论，再给建议，不展开无关实现细节。
- 如果用户明确要求我亲自实现，才进入执行模式；否则保持分派和协调视角。

### 沟通习惯

- 始终记住自己是“架构 owner / 协调者”，不是默认执行工程师。
- 非用户明确要求，不直接下场改业务代码。
- 任何需要 agent 持续跟进的事项，都优先落到 `docs/agents/*.md` 中，而不是只留在聊天里。
- 任何新任务默认先记文档，再派工；如果我没有显式说明“已同步文档”，这轮响应视为未完成。
- 回答尽量短、直接、可转发、可执行。
- 优先帮助用户“安排人推进”，而不是替用户展开过多细节推演。
- 如果发现任务需要同步前后端，就默认同时给前端 agent 和后端 agent 各自一段指令。
- 如果发现事项需要上升到整体上下文，也要同步更新 `architect-owner.md`，方便后续其他 AI 接手。

### Commit 规范（2026-03-21）

- 默认采用：`<type>(<scope>): <summary>`
- `type` 只使用：`feat`、`fix`、`refactor`、`test`、`docs`、`chore`
- `scope` 优先使用：`backend`、`frontend`、`frontend-vue`、`problem-detail`、`agents`
- `summary` 用一句话说明“这次提交解决了什么”，避免写成流水账，建议控制在 50 个字符以内
- 一个提交只解决一个清晰主题；不要把前后端改动混在同一个 commit
- 若包含文档同步，优先跟随对应主题提交；若是纯文档收口，使用 `docs(agents): ...`
- 推荐示例：
  - `fix(backend): stop using timestamp ids for problem cases`
  - `fix(problem-detail): close history loop for case detail routing`
  - `docs(agents): sync task records for problem-detail rollout`

## 11.1 后续提交补充约定

- 后续 commit message 统一使用中文。
- 提交粒度统一保持：前端 1 个 commit、后端 1 个 commit。
- 不再把同一个主题拆成多个零散提交。
- 若本轮文档需要同步，默认挂在对应责任侧的主题提交中。
- 推荐格式：`<type>(<scope>): 中文摘要`

## 12. 后续接手要求

如果你是新切入的 AI，需要立即做到：

1. 阅读本文件。
2. 阅读：
   - `docs/agents/frontend-agent.md`
   - `docs/agents/backend-agent.md`
   - `docs/agents/business-product-agent.md`（当任务涉及业务定位、版本取舍、商业化判断时优先一起阅读）
3. 保持“架构 owner / 协调者”身份。
4. 后续用户新任务，优先判断是否需要先经过业务产品 agent，再拆给前端 agent / 后端 agent。
5. 非用户明确要求，不直接下场改业务代码。

## 13. 追加任务台账（2026-03-21）

### ARCH-20260321-05

- 任务编号：`ARCH-20260321-05`
- 日期：`2026-03-21`
- 任务标题：`local 模式导入导出能力补充规划`
- 来源：`用户当前追问`
- 影响范围：`frontend`
- 优先级：`P2`
- 当前状态：`待派工`
- 当前负责人：`frontend-agent`
- 目标结果：`补齐 local 模式下的问题案例与 message 导入导出能力，支持 localStorage -> JSON 案例包 -> localStorage 的最小闭环`
- 最近一次派工内容：`当前不打断 FE-20260321-03 的 online 联调收口；先将 local 模式导入导出登记为独立后续任务`
- 最近一次回报摘要：`已确认当前实现中 local 模式下导入/导出按钮会被禁用，并提示仅支持 online 模式；现有导入导出实现完全依赖后端接口`
- 阻塞/风险：`若直接在本轮扩展 local 模式，容易与正在收口的 online 导入导出联调、后端契约和前端缓存刷新逻辑混在一起，增加回归范围`
- 下一步动作：`待 FE-20260321-03 关账后，单独拆前端 local 版导入导出任务，冻结本地 JSON 包格式与 localStorage 迁移口径`

### ARCH-20260321-06

- 任务编号：`ARCH-20260321-06`
- 日期：`2026-03-21`
- 任务标题：`导入导出运行时联调异常排查`
- 来源：`用户提供后端日志`
- 影响范围：`multi`
- 优先级：`P0`
- 当前状态：`进行中`
- 当前负责人：`backend-agent`
- 目标结果：`确认为什么运行中的 backend 对同一 case 的 messages 返回 200，但 export 返回 404；同时定位 PUT /messages 返回 400 的真实 payload/schema 原因`
- 最近一次派工内容：`优先检查运行中的 backend 进程是否已加载最新 problem-case.routes.ts（含 /:id/export 与 /import），并核对 PUT /messages 的校验失败细节`
- 最近一次回报摘要：`用户再次确认 http://127.0.0.1:3002/api/problem-cases/problem_18c56e0f/export 直接访问仍为 404；当前仓库代码已确认存在 GET /:id/export 路由，因此优先判断为运行中的 backend 版本/进程问题`
- 阻塞/风险：`若运行进程未重启或仍是旧版本，将导致前端导入导出联调结果与代码现状不一致；PUT /messages 400 会继续干扰消息删除/批量变更路径`
- 下一步动作：`仅给 backend-agent 下发处理：确认当前 3002 进程是否为最新代码、必要时重启服务并重新验证 /export；随后再补 PUT /messages 400 的失败字段结论`

### ARCH-20260321-07

- 任务编号：`ARCH-20260321-07`
- 日期：`2026-03-21`
- 任务标题：`导入导出联调 400 契约错位排查`
- 来源：`用户提供后端日志`
- 影响范围：`multi`
- 优先级：`P0`
- 当前状态：`进行中`
- 当前负责人：`frontend-agent`
- 目标结果：`确认 PUT /messages 400 的具体失败字段，并修复 POST /api/problem-cases/import 400 的前后端契约错位`
- 最近一次派工内容：`优先按运行时现象排查 /export 404；当前新增 import 400 与 messages 400 的联调问题需并行收口`
- 最近一次回报摘要：`前后端双方已收敛到同一结论：backend 当前只接受 raw JSON body，frontend 当前按 multipart/form-data + file 上传，因此 /import 400 的主根因已明确为契约错位；PUT /messages 400 仍需依赖真实 response issues 与 request body 精确定位`
- 阻塞/风险：`若前端继续按 FormData/file 上传，而后端只接受 JSON body，则 /import 必然 400；若 PUT /messages 的 payload 未定位清楚，会继续干扰消息删除和整段替换路径`
- 下一步动作：`仅给 frontend-agent 下发修复：将 import 从 FormData/file 调整为读取文件内容后以 application/json 直传；PUT /messages 400 保持第二优先级，待拿到 response issues 后再定责`

### ARCH-20260321-08

- 任务编号：`ARCH-20260321-08`
- 日期：`2026-03-21`
- 任务标题：`导入成功后首页案例列表未刷新`
- 来源：`用户当前缺陷反馈`
- 影响范围：`frontend`
- 优先级：`P0`
- 当前状态：`进行中`
- 当前负责人：`frontend-agent`
- 目标结果：`导入成功后首页案例列表立即可见新案例，并与详情跳转、缓存状态保持一致`
- 最近一次派工内容：`下发给前端 agent：排查导入成功后的 reloadCachesFromBackend / renderProblemFollowList / 当前视图刷新链路，并确保即使直接跳详情，返回首页也能看到新案例`
- 最近一次回报摘要：`当前用户反馈导入数据后首页数据列表没有更新，说明前端虽然导入成功，但首页列表视图没有及时消费最新缓存或刷新时机不对`
- 阻塞/风险：`若首页列表不刷新，用户会误以为导入失败；同时详情页与首页列表状态可能出现短暂不一致`
- 下一步动作：`仅给 frontend-agent 下发修复：首页列表刷新链路与导入后的视图状态联动`

### ARCH-20260321-09

- 任务编号：`ARCH-20260321-09`
- 日期：`2026-03-21`
- 任务标题：`本地 backend 启动脚本编码兼容性修复`
- 来源：`用户当前运行报错`
- 影响范围：`backend`
- 优先级：`P0`
- 当前状态：`进行中`
- 当前负责人：`backend-agent`
- 目标结果：`修复 start-local-backend.ps1 在 Windows PowerShell 下的 ParserError，确保脚本可直接执行`
- 最近一次派工内容：`待下发给 backend-agent：优先按编码兼容性修复，不扩大战线`
- 最近一次回报摘要：`用户运行 .\\scripts\\start-local-backend.ps1 时在多处中文字符串处出现 ParserError；当前仓库源码显示脚本本身逻辑结构正常，强烈怀疑为 Windows PowerShell 5 对 UTF-8 无 BOM/非 ASCII 脚本内容的兼容问题`
- 阻塞/风险：`若脚本继续包含非 ASCII 文本且编码不稳定，本地启动入口将无法作为标准工具推广`
- 下一步动作：`仅给 backend-agent 下发修复：将脚本收敛为 ASCII 文案或确保 PowerShell 兼容编码，并验证 start/status/stop 三个脚本可执行`

### ARCH-20260322-01

- 任务编号：`ARCH-20260322-01`
- 日期：`2026-03-22`
- 任务标题：`ProblemDetail 历史通知崩溃、导入后列表未刷新、详情刷新闪跳`
- 来源：`用户当前缺陷反馈`
- 影响范围：`frontend`
- 优先级：`P0`
- 当前状态：`进行中`
- 当前负责人：`frontend-agent`
- 目标结果：`修复任务通知“已确认”时报 communication-history.js 崩溃、再次收口导入成功后首页列表刷新、消除详情页刷新时先回首页再跳详情的闪跳`
- 最近一次派工内容：`owner 先完成代码级定性：3 个问题均属于前端侧，再下发前端 agent 修复与回归任务`
- 最近一次回报摘要：`owner 代码级确认：1）communication-history.js 的 getCommunicationsByTask 在 byTask[targetTask] 未初始化时直接 push，符合当前报错栈；2）导入后列表未刷新虽已有一次修复记录，但用户真实运行仍复现，需要以前端真实运行链路重新收口；3）DOMContentLoaded 先 renderProblemFollowList 再 restoreRouteState，容易造成详情刷新时先出现首页再跳详情的闪跳`
- 阻塞/风险：`如果继续只做代码路径推断而不做真实运行回归，这类“已修过但仍复现”的前端状态/时序问题会反复出现`
- 下一步动作：`仅给 frontend-agent 下发修复：补 task bucket 防御/归一化、重收导入后首页列表刷新链路、消除深链恢复前的首页闪跳，并写回 frontend-agent.md`

### 2026-03-22

- 新增任务：`ARCH-20260322-01`
- 当前判断：`本轮 3 个问题都属于前端侧，不需要打扰后端`
- 代码级根因：
  - `communication-history.js` 中 `byTask[targetTask].push(entry)` 缺少目标任务桶兜底，任务通知/重启路径可能命中未初始化 taskId
  - 导入后首页列表未刷新需要以前端真实运行链路重新验收，不能只依据上轮代码路径收口
  - 详情刷新闪跳来自首页列表先渲染、深链恢复后再切到详情的时序问题
- 下一步：`只向 frontend-agent 派工，等待其写回任务记录与回归结果`

### ARCH-20260322-02

- 任务编号：`ARCH-20260322-02`
- 日期：`2026-03-22`
- 任务标题：`task11 核心业务对象推演上下文过大风险评估`
- 来源：`用户当前需求`
- 影响范围：`multi`
- 优先级：`P0`
- 当前状态：`进行中`
- 当前负责人：`frontend-agent | backend-agent`
- 目标结果：`确认 task11 是否因上下文堆叠导致模型难以解析，并给出前后端收口方案`
- 最近一次派工内容：`owner 先完成代码级分析，再分别下发前后端任务`
- 最近一次回报摘要：`owner 已确认 task11 当前会把 valueStream、globalItGap、localItGap、rolePermission 四类 JSON 一起拼入 prompt；online 路由仍为 stream:false 且 max_tokens=2000，存在输出截断、JSON 不完整、解析失败风险`
- 阻塞/风险：`如果继续无限制整包拼上下文，task11 在复杂案例下会出现性能不稳定、输出丢字段、JSON 解析失败、在线模式体验劣化`
- 下一步动作：`给 frontend-agent 下发 prompt 收缩与分层上下文任务；给 backend-agent 下发 AI 调用观测与保护性限制任务`

### 2026-03-22（task11 风险分析）

- 新增任务：`ARCH-20260322-02`
- 当前判断：`task11 存在明显的上下文过大风险，尤其在 online 模式`
- 代码级依据：
  - `frontend/js/coreBusinessObject.js` 的 task11 推演会将 `valueStream`、`globalItGap`、`localItGap` 直接 `JSON.stringify(..., null, 2)` 拼入 user prompt
  - `frontend/main.js` 的严格推演路径还会额外引入 `rolePermissionJson`
  - `frontend/js/api.js` 的 online 模式只做一次性 `POST /ai/chat`，不走流式
  - `backend/src/modules/ai/ai.routes.ts` 当前为 `stream: false` 且 `max_tokens: 2000`
- 初步结论：`更像“上下文堆叠 + 输出上限偏紧 + 非流式整包返回”叠加导致的不稳定，而不只是单一解析 bug`
- 下一步：`前端优先收 prompt 体积与上下文层级；后端补调用观测、token 保护与更清晰的失败信息`

## 14. 运行时验证协作补充（2026-03-22）

- 对运行时问题的默认验收方式，优先采用“日志/Network/Console 证据驱动”，不默认要求 agent 直接启用浏览器反复验证。
- 原因：
  - 浏览器自动化 token 成本高。
  - 真实问题往往发生在用户自己的环境、数据、登录态和缓存状态里，agent 本地复现不一定等价。
  - 很多问题用明确的请求日志、响应体、控制台报错、页面状态描述就能更快定责。
- 默认顺序冻结为：
  1. owner 先判断是否属于前端、后端或两边。
  2. agent 先给出“需要用户提供的最小证据清单”。
  3. 用户按清单提供日志、Network、Console 或页面行为结果。
  4. agent 再基于证据修复与回归。
- 只有当问题本质上属于纯 UI/交互/视觉状态，且无法通过日志或 Network 证据判断时，才考虑让 agent 直接走浏览器验证。
- 后续派工提示词中，默认优先要求：
  - 先列出需要采集的日志项
  - 再列出最小复现场景
  - 最后才是浏览器自动化或 UI 录屏式验证

### ARCH-20260322-03

- 任务编号：`ARCH-20260322-03`
- 日期：`2026-03-22`
- 任务标题：`导入成功后首页列表未自动更新的重复失效问题`
- 来源：`用户当前反馈`
- 影响范围：`frontend`
- 优先级：`P0`
- 当前状态：`进行中`
- 当前负责人：`frontend-agent`
- 目标结果：`彻底解决导入成功后首页列表未自动更新的问题，且不再以代码路径推断代替真实运行验收`
- 最近一次派工内容：`owner 将本问题从一般缺陷升级为重复失效问题，要求前端以真实运行复现、证据、根因、修复、回归闭环，不再接受“代码路径已修”式回报`
- 最近一次回报摘要：`此前 FE-20260321-07 曾多次声称已修，但用户真实运行仍复现，说明前端现有验收标准失效，问题没有真正关闭`
- 阻塞/风险：`如果继续只做静态推断或局部代码修补，会持续出现“说修好了但用户现场仍复现”的失信问题`
- 下一步动作：`只给 frontend-agent 下发升级任务，要求其先真实复现，再给证据、根因、修复点和回归结果；关闭前必须以用户场景验收为准`

### ARCH-20260322-04

- 任务编号：`ARCH-20260322-04`
- 日期：`2026-03-22`
- 任务标题：`角色与权限模型推演已完成但无法流转到核心业务推演`
- 来源：`用户当前缺陷反馈`
- 影响范围：`frontend`
- 优先级：`P0`
- 当前状态：`进行中`
- 当前负责人：`frontend-agent`
- 目标结果：`task10（角色与权限模型推演）在用户视角已完成分析后，能够稳定流转到 task11（核心业务推演），并且当前任务、任务通知、completedTaskIds 与沟通历史保持一致`
- 最近一次派工内容：`owner 先做代码级分析，再只给 frontend-agent 派发排查与修复任务`
- 最近一次回报摘要：`owner 已确认：task10 -> task11 的流转依赖 completedTaskIds 与任务完成确认块，而不是“角色与权限分析卡已经生成”就算完成；showNextTaskStartNotification 通过 getFirstUncompletedTask(item) 取下一任务，getFirstUncompletedTask 又直接依赖 isTaskCompleted(item, taskId)。advanceProblemStateOnTaskComplete(createdAt, 'task10') 只有在真正点击任务完成确认后才会写入 completedTaskIds。若 rolePermissionAnalysisCard / rolePermissionAllDoneBlock / taskCompletionConfirmBlock 未走完，task10 仍会被视为未完成，自然无法流转到 task11。`
- 阻塞/风险：`如果继续把“工作区里已经有角色与权限分析结果”误当成“task10 已正式完成”，就会持续出现用户以为完成、系统却仍停在 task10 的假完成问题`
- 下一步动作：`只给 frontend-agent 派工：先按真实运行证据核对 task10 完成链路，再修 completedTaskIds / 确认块 / 下一任务通知之间的断链问题，并把 Console/Network/当前 item 状态写回 frontend-agent.md`

### ARCH-20260322-05

- 任务编号：`ARCH-20260322-05`
- 日期：`2026-03-22`
- 任务标题：`补齐业务产品 agent 角色并接入现有协作体系`
- 来源：`用户当前需求`
- 影响范围：`docs`
- 优先级：`P0`
- 当前状态：`已完成`
- 当前负责人：`owner`
- 目标结果：`让项目内新增一个专门负责全局业务、产品方向、版本优先级与商业化路径判断的角色，并接入现有 agent 文档体系`
- 最近一次派工内容：`owner 直接补齐 docs/agents 目录结构、新增 business-product-agent 工作面板，并在 architect-owner 中增加协同入口`
- 最近一次回报摘要：`已新增 business-product-agent.md，冻结产品北极星、阶段目标、版本优先级、商业化路径与标准输出格式；同时新增 docs/agents/AGENTS.md 并把业务产品 agent 接入 owner 协作口径`
- 阻塞/风险：`无`
- 下一步动作：`后续遇到业务定位、产品取舍、商业化判断类任务，优先先过 business-product-agent 面板，再决定是否派给前后端`

### 2026-03-22（task10 -> task11 流转分析）

- 新增任务：`ARCH-20260322-04`
- 当前判断：`这是前端侧任务状态机/确认链路问题，不需要后端介入`
- 代码级依据：
  - `frontend/main.js` 中 `getFirstUncompletedTask(item)` 直接通过 `isTaskCompleted(item, taskId)` 判定当前第一个未完成任务
  - `showNextTaskStartNotification()` 依赖 `getFirstUncompletedTask(dataItem)`，因此只要 task10 没真正写入 completedTaskIds，系统就不会把 task11 视为下一任务
  - `advanceProblemStateOnTaskComplete(createdAt, 'task10')` 只会在任务完成确认链路触发时调用，并通过 `updateDigitalProblemCompletedTaskId(createdAt, taskId)` 写入 `completedTaskIds`
  - `rolePermissionAnalysisCard` 的单步确认与 `rolePermissionAllDoneBlock` 的全部确认，最终都会走到 `showTaskCompletionConfirm('task10', ...)`；分析卡生成完不等于 task10 已完成，必须继续经过“任务完成确认块”
  - `hasUnconfirmedOutputCardBeforeTask()` 对 task10 之前有特殊拦截，但对 task11 没有额外拦截规则；因此当前更像 task10 根本没有完成，而不是 task11 被额外拦住
- 下一步：`让 frontend-agent 按真实运行链路补最小证据：当前 case 的 completedTaskIds、当前任务通知/确认块状态、点击路径、Console/Network，再定责修复`
