# 架构 Owner：活跃任务台账

> 仅保留**仍活跃或未关账**的 ARCH 条目；**已关闭**任务不堆长篇，见文末索引。  
> **本轮治理**：`ARCH-20260325-02` — architect-owner 文档拆分为 `architect/00-core`～`03-active-tasks`。

## 当前活跃 / 未关账 ARCH 摘要

| 编号 | 状态 | 负责人 | 标题（摘要） |
| ---- | ---- | ------ | ------------ |
| ARCH-20260411-01 | 进行中 | owner | ProblemDetail 工程化打包 / 轻混淆 / Vue 统一专项建档 |
| ARCH-20260410-01 | 进行中 | owner | ProblemDetail 迁移、旧 `frontend` build 产线与 Agent Loop 主记录建档 |
| ARCH-20260407-01 | 进行中 | owner | 用户首次登录个人模型 Key 门禁与自助配置主记录建档 |
| ARCH-20260329-01 | 进行中 | owner | `frontend/main.js` 拆分执行计划与 Phase 0 主记录建档 |
| ARCH-20260327-01 | 待验证 | owner | task11 重启误跳 task10 + 后端重启验证口径收紧（含 AI DNS 失败排查） |
| ARCH-20260325-02 | 进行中 | owner | owner 文档拆分第二阶段（本目录落地） |
| ARCH-20260326-02 | 待验证 | owner | 收紧 owner 角色硬门禁并固定架构/审查导向输出 |
| ARCH-20260326-01 | 待验证 | owner | 前端 Google Fonts 外链清扫与离线字体栈收口 |
| ARCH-20260320-01 | 待验证 | user | ProblemDetail P0 收口与读取契约稳定 |
| ARCH-20260320-02 | 待验证 | user | 前端同步 main 并验证业务新增功能 |
| ARCH-20260320-04 | 进行中 | owner | 线上 confirm 404 根因与排查口径 |
| ARCH-20260320-05 | 待派工 | FE/BE | 前端临时切后端 agent 服务联调 |
| ARCH-20260320-06 | 待派工 | FE/BE | AI 配置与数据库/AppSetting 排查 |
| ARCH-20260320-07 | 待验证 | user | ProblemDetail 路由与案例主键缺陷修复 |
| ARCH-20260321-01 | 待派工 | FE/BE | PUT /messages 400 与整段替换链路 |
| ARCH-20260321-04 | 进行中 | FE/BE | 案例与消息导入导出设计与实现 |
| ARCH-20260321-05 | 待派工 | frontend | local 模式导入导出规划（P2，依赖 online 收口） |
| ARCH-20260321-06 | 进行中 | backend | 导入导出运行时联调（export 404 / PUT 400 等） |
| ARCH-20260321-07 | 进行中 | frontend | import 契约与 PUT /messages 并行收口 |
| ARCH-20260321-08 | 进行中 | frontend | 导入成功后首页列表刷新 |
| ARCH-20260321-09 | 进行中 | backend | start-local-backend.ps1 编码兼容性 |
| ARCH-20260322-01 | 进行中 | frontend | 历史通知崩溃、导入列表、详情刷新闪跳 |
| ARCH-20260322-02 | 进行中 | FE/BE | task11 上下文过大风险与收口 |
| ARCH-20260322-03 | 进行中 | frontend | 导入后首页列表重复失效（须真实运行验收） |
| ARCH-20260322-04 | 进行中 | frontend | task10→task11 流转与 completedTaskIds 一致 |

**说明**：上表为轻量摘要；若与 `architect-owner.md` 历史正文不一致，以**各 agent `03-active-tasks` 与代码现状**为准，并回写本表。

## 当前主任务补记

### ARCH-20260411-01：ProblemDetail 工程化打包 / 轻混淆 / Vue 统一专项建档

- 日期：2026-04-11
- 影响范围：frontend / frontend-vue / docs / owner
- 当前状态：进行中
- 主记录：`docs/plans/problem-detail-build-obfuscation-and-vue-unification/README.md`
- 关联任务：`FE-20260411-01`

**目标**

1. 为 ProblemDetail 双轨专项建立唯一主记录、任务总索引与全量任务卡体系。
2. 冻结 A 线“不迁移详情，只补 build/minify/轻混淆”和 B 线“online-only、统一工程 + Vue 壳层 + legacy/runtime 内核”的边界。
3. 让后续 FE/owner 可以直接按任务卡派工、验收、记录风险与回滚，不再靠聊天补口径。

**当前已完成**

1. 已建立 `docs/plans/problem-detail-build-obfuscation-and-vue-unification/` 专项目录。
2. 已落地 `README.md`、子目录 `AGENTS.md`、`tasks/README.md` 与 `phase-0`～`phase-3` 全量任务卡。
3. 已将每张任务卡统一为 12 个固定章节，并固定“完成结果 / 不算完成的情况”与“结果 + 证据”双口径验收。

**下一步**

1. owner 以专项主记录为唯一入口继续维护 phase gate、风险、回滚与验收记录。
2. frontend 后续按 `phase-1a`～`phase-3` 任务卡推进 build 合同、host 合同、fixture 与 cutover 设计，不再自定义边界。
3. 若后续增删任务卡、改 phase 或改任务编号规则，必须同步回写专项 `AGENTS.md`、`docs/plans/AGENTS.md` 与 agent 台账。

### ARCH-20260410-01：ProblemDetail 迁移、旧 `frontend` build 产线与 Agent Loop 主记录建档

- 日期：2026-04-10
- 影响范围：frontend / frontend-vue / backend / docs / owner / business-product
- 当前状态：进行中
- 主记录：`docs/plans/problem-detail-migration-and-agent-loop/README.md`
- 关联任务：`BP-20260410-01`、`FE-20260410-01`、`BE-20260410-01`

**目标**

1. 为 ProblemDetail 迁移、旧前端构建产线、后端 prompt 托管与 Agent Loop 建立唯一主记录。
2. 在实现前冻结边界：`index.html?caseId=` 不变、生产 `online-only`、详情语义不因框架迁移漂移。
3. 先把长篇计划统一收口到 `docs/plans/`，再逐步拆分到设计文。

**当前已完成**

1. 已确定目录名为 `docs/plans/problem-detail-migration-and-agent-loop/`。
2. 已确定主文档文件名为 `README.md`，不先拆 `01/02/03` 子文档。
3. 已约定同步动作：更新 `docs/plans/AGENTS.md`，并在 owner / BP / FE / BE 四份 `03-active-tasks.md` 各挂一条索引。
4. 已接收评审意见 `docs/plans/problem-detail-migration-and-agent-loop/2026-04-10-review.md`，并将 4 个 Phase 1 阻塞项回写到主记录。

**下一步**

1. owner 继续盯 4 个阻塞项落地：build/deploy contract、双渲染快照合同、prompt registry contract、loop checker/evidence/env contract。
2. BP 冻结“ProblemDetail 迁移为工程层接管，非语义层重构”的产品口径与验收边界。
3. FE / BE 以主记录为入口再拆 Phase 1 的具体产物、检查器入口与证据模板。

### ARCH-20260407-01：用户首次登录个人模型 Key 门禁与自助配置主记录建档

- 日期：2026-04-07
- 影响范围：frontend-vue / frontend / backend / docs / owner
- 当前状态：进行中
- 主记录：`docs/plans/2026-04-07-user-first-login-llm-key-gate.md`
- 关联产品任务：`BP-20260407-01`

**目标**

- 将“用户首次登录必须先完成个人模型 Key 配置并验证”的需求冻结为跨前后端统一主记录。
- 明确这不是单页 UI 需求，而是登录链路、用户级敏感配置存储、业务页门禁、AI 调用真相源的联合改造。
- 在实现前先收敛 Task Contract、兼容策略、FE/BE 直发指令与验收口径。

**当前已冻结**

1. 影响范围为 `multi(frontend-vue + frontend + backend + docs)`，风险级别 `P0`。
2. 本轮只做 `online`、只支持 `DeepSeek`、只面向 `AppUser` 业务入口门禁。
3. `home.html`、`index.html`、`report.html` 与业务深链纳入门禁；`admin.html` 不纳入本轮。
4. `AppUser` 的个人 AI 配置成为 online 主真相源；系统级 `AppSetting` / `/api/ai/config` 仅保留运维 / 管理员兜底。
5. 高风险跨前后端任务先写入 `Task Contract`，再拆前后端。

**下一步**

1. 前端按主记录实施 `model-config.html`、登录首跳门禁、业务页二次门禁。
2. 后端按主记录实施用户级配置表、状态接口、保存并验证接口、`/api/ai/chat` 用户级解析。
3. FE / BE 回报必须分别携带最小复验与差异说明，owner 再签字。

### ARCH-20260329-01：`frontend/main.js` 拆分执行计划与 Phase 0 主记录建档

- 日期：2026-03-29
- 影响范围：frontend / docs / owner
- 当前状态：进行中
- 当前批次：`FE-20260329-07`
- 主记录：`docs/plans/2026-03-29-frontend-mainjs-splitting-execution-plan.md`

**目标**

- 以治理方案 `v10` 为冻结基线，建立 `frontend/main.js` 拆分的唯一执行主记录。
- 将后续 Phase 0～4 的阶段、批次、验收与风险统一收口到主记录，而不是散落在聊天与多份文档里。

**当前已完成**

1. 已建立主记录文档并写入：
   - 阶段总览表
   - 源能力覆盖表
   - 目标反查表
   - 批次卡片
   - 首条验收记录
2. 已确定总控与执行编号：
   - `ARCH-20260329-01`
   - `FE-20260329-07` ～ `FE-20260329-15`
3. 已将当前活跃批次挂回前端台账索引。

**当前未关账项**

1. `.cursor/rules/frontend-mainjs-governance.mdc` 尚未新增。
3. 仅完成 Phase 0 文档建档与覆盖盘点，尚未进入代码迁移。

**验收口径**

- 主记录文档可独立恢复本轮拆分计划、状态、风险与下一批次。
- `ARCH/FE` 台账均能回链到主记录。
- Phase 0 在 `.mdc` 落库前保持“进行中”，不得误记为已关闭。

## 错误记录（本轮补记）

### ARCH-20260327-01：task11 重启误跳 task10 + 后端重启可验证性不足

- 日期：2026-03-27
- 影响范围：frontend / backend / owner
- 当前状态：待验证

**错误现象**

1. 在「核心业务对象推演（task11）」阶段点击“重启当前”，任务切回到「角色与权限模型推演（task10）」。
2. 后端“重启成功”仅凭启动日志判断，未同时完成端口监听、`/health`、`/api/ai/chat` 三重验证。
3. 核心业务对象自动顺序执行过程中出现 `ENOTFOUND api.deepseek.com`（AI 上游域名解析失败）。

**根因判断**

1. 「重启当前」目标任务解析优先使用内存态 `itStrategyPlanViewingSubstep`；当内存子步骤与 UI 高亮短暂不同步时，误判为 task10。
2. 本地重启流程未把“验证闭环”作为强制步骤，且端口占用场景下脚本会自动切换端口，导致“服务已启动”与“目标端口可用”不等价。
3. `ENOTFOUND` 属于运行时网络/DNS异常（后端到上游 AI provider 的域名解析失败），非提示词内容错误。

**处理方法（已执行）**

1. 前端：重启当前任务目标解析增加 UI 高亮优先（以 `.problem-detail-substep-current[data-task-id]` 为准）与大阶段兜底，避免 task11 误跳 task10。
2. 后端重启：执行“可验证重启”流程，强制包含：
   - `lsof -iTCP:3002 -sTCP:LISTEN`
   - `GET /health`
   - 一次最小 `POST /api/ai/chat` 实调用（含登录拿 token）
3. 端口占用处理：发现 `3002` 被旧进程占用时，先释放占用，再重启至指定端口并复验三项证据。

**验证证据（本轮）**

- `3002` 监听进程：`node PID=6224 ... TCP 127.0.0.1:3002 (LISTEN)`
- `/health` 返回：`{"ok":true,...}`
- `/api/ai/chat` 最小实调用返回：`{"content":"ok", ... "finishReason":"stop"}`

**复用口径**

- 涉及“重启当前”/“任务跳转”问题：优先核对“内存状态源 vs UI 状态源”一致性。
- 涉及“服务重启”问题：必须给出端口监听 + 健康检查 + 业务最小实调用三证据，不接受仅启动日志口径。

## 已关闭 ARCH（仅索引）

以下条目已在旧面板中标记完成，**正文不重复**：`ARCH-20260320-03`、`ARCH-20260321-02`、`ARCH-20260321-03`、`ARCH-20260322-05`。历史台账全文见 `docs/agents/architect-owner.md`（迁移参考，非主读路径）。

## 任务编号规则

- `ARCH-YYYYMMDD-序号`；与 `FE-*`、`BE-*` 在各 agent 台账联动。

---

**触发器**：任务状态变化时更新表格与关闭索引；关账后从「活跃」表移除并追加到「已关闭索引」一行。
