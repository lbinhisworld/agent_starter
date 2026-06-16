# Frontend Agent · 轻量活跃任务台账

> **任务号**：`ARCH-20260325-01`（docs/agents 文档治理第一阶段）  
> **原则**：本文件只保留**短条目 + 状态 + 指向**；长叙述、回归表、日志样例仍可在过渡期查阅 `docs/agents/frontend-agent.md`「任务记录区」，第二阶段再迁入知识库或归档。

## 台账条目模板（复制使用）

- 任务编号：`FE-YYYYMMDD-序号`
- 日期：
- 标题：
- 优先级：`P0|P1|P2`
- 状态：`待派工|进行中|待验证|已完成|已关闭`
- 涉及：`frontend` / `frontend-vue`
- 一句话目标：
- 阻塞：
- 详述与证据：→ `frontend-agent.md` 对应节

---

## 当前活跃索引（首批迁入 · 2026-03-25）

> 下列为从 `frontend-agent.md` 抽取的**索引行**；完整字段、回归表与日志见原文件对应 `FE-*` 条目。

| 任务编号 | 标题（摘要） | 状态 |
| -------- | ------------ | ---- |
| FE-20260411-01 | ProblemDetail build/minify/轻混淆与 Vue 统一专项 Phase 0-1 文档建档 | 进行中 |
| FE-20260410-01 | ProblemDetail 迁移主记录与前端 Phase 0-1 建档 | 待派工 |
| FE-20260329-15 | `frontend/main.js` 拆分：Phase 4B task10 / task11 编排回收 | 已完成 |
| FE-20260329-14 | `frontend/main.js` 拆分：Phase 4A task2 / task8 编排回收 | 已完成 |
| FE-20260329-13 | `frontend/main.js` 拆分：Phase 3B `problem-detail-runtime` | 已完成 |
| FE-20260329-12 | `frontend/main.js` 拆分：Phase 3A 依赖图 + `problem-detail-chat` | 已完成 |
| FE-20260329-10 | `frontend/main.js` 拆分：Phase 2A `legacy/app-dom.js` | 已完成 |
| FE-20260329-09 | `frontend/main.js` 拆分：Phase 1B `core/app-state.js` | 已完成 |
| FE-20260329-08 | `frontend/main.js` 拆分：Phase 1A `core/problem-case-api.js` | 已完成 |
| FE-20260329-07 | `frontend/main.js` 拆分：Phase 0 治理冻结与覆盖盘点 | 已完成 |
| FE-20260325-01 | task2 商业画布：完成确认块三态与在线 confirm 失败回滚 | 已完成（代码），待 owner 现场验证 task2 |
| FE-20260325-02 | task3：完成确认卡与 `requirementLogic` 误判解耦 | 同上 task3 |
| FE-20260325-03 | task4/5/6 工作流：`workflowAlignCompletedStages` 与输出确认解耦 | 同上 task4–6 |
| FE-20260325-04 | task5：重复 IT 卡 + 流转 task6 | 同上 task5 |
| FE-20260325-06 | online 模式案例 owner 隔离（前端配合） | 进行中 |
| FE-20260326-04 | Google Fonts 外链清扫与离线字体栈收口 | 待验证 |
| FE-20260406-01 | 首页正式入口切换（`home.html` cutover）与迁移对照表 | 已完成（待 owner 抽检） |
| FE-20260406-02 | 清理 `index.html` legacy 首页壳；`legacyHome=1` 收口为 `home.html` 别名 | 待验证 |
| FE-20260406-03 | 首页 shared contract：`problem-follow-shared.js` 收口案例键与高亮 session；`main.js` / Vue 首页消费 | 待验证 |
| FE-20260406-04A | 首页 JS 去遗留化 v1：`home-follow-card-bridge.js` → `src/home/problem-follow-home.ts`；`home.html` 移除 bridge 引用 | 已关闭 |
| FE-20260408-01 | 首次登录个人模型 Key 门禁 Phase 1：登录首跳、共享二次门禁与模型配置页 | 待验证 |
| FE-20260408-02 | 个人模型配置永久入口 Phase 2：首页 / 业务页顶栏挂载 | 待验证 |

## 待办说明

- **历史任务全文**（含 2026-03-24 及更早的大量 `FE-*`）：仍位于 `frontend-agent.md`，本阶段不要求一次性搬迁。
- 新任务：**先写本文件索引行**，再同步 `frontend-agent.md`（过渡期）直至第二阶段停用单文件长文。

---

## 条目（本周新增）

- 任务编号：`FE-20260411-01`
- 日期：2026-04-11
- 标题：ProblemDetail build/minify/轻混淆与 Vue 统一专项 Phase 0-1 文档建档
- 优先级：`P0`
- 状态：`进行中`
- 涉及：`frontend`、`frontend-vue`、`docs/plans`
- 一句话目标：以 `docs/plans/problem-detail-build-obfuscation-and-vue-unification/README.md` 为唯一前端专项入口，一次性建全 A 线 build/minify/轻混淆合同与 B 线 online-only 统一工程任务体系，确保后续实现按任务卡直接派工和验收。
- 阻塞：当前专项主记录与全量任务卡已建全；后续实施前仍需以 `phase-1a`～`phase-3` 任务卡继续冻结 build、host、fixture 与 cutover 细节，不允许脱离主记录另起口径。
- 详述与证据：→ `docs/plans/problem-detail-build-obfuscation-and-vue-unification/README.md`

- 任务编号：`FE-20260410-01`
- 日期：2026-04-10
- 标题：ProblemDetail 迁移主记录与前端 Phase 0-1 建档
- 优先级：`P0`
- 状态：`待派工`
- 涉及：`frontend`、`frontend-vue`、`docs/plans`
- 一句话目标：以 `docs/plans/problem-detail-migration-and-agent-loop/README.md` 为唯一前端主入口，优先补齐 build/deploy contract、fixture manifest、前端最小 contract/snapshot/smoke 检查器与双渲染快照合同，再进入 Vue shell 与 host 实施。
- 阻塞：Phase 1 关账前需先落地产物级入口，例如 `frontend/test-fixtures/problem-detail/manifest.json` 与前端运行时证据模板；当前仅完成主记录与台账挂载。
- 详述与证据：→ `docs/plans/problem-detail-migration-and-agent-loop/README.md`

- 任务编号：`FE-20260408-01`
- 日期：2026-04-08
- 标题：首次登录个人模型 Key 门禁 Phase 1：登录首跳、共享二次门禁与模型配置页
- 优先级：`P0`
- 状态：`待验证`
- 涉及：`frontend`、`frontend-vue`
- 一句话目标：按 `docs/plans/2026-04-07-user-first-login-llm-key-gate.md` 的 Phase 1 冻结口径，补齐 `model-config.html`、`LoginPage.vue` 首跳检查、`auth-runtime.js` 业务页二次门禁，以及前端对后端 `AI_CONFIG_REQUIRED` 兜底错误码的统一跳转接线。
- 阻塞：需与当前工作区内同步推进的后端用户级 AI 配置改动联调验收，重点确认 `/api/me/ai-config/status`、`PUT /api/me/ai-config` 与 `/api/ai/chat` 的 `AI_CONFIG_REQUIRED`（428）口径在真实部署上与前端接线一致。
- 详述与证据：→ `docs/plans/2026-04-07-user-first-login-llm-key-gate.md` · `frontend-vue/AGENTS.md`

- 任务编号：`FE-20260406-04A`
- 日期：2026-04-06
- 标题：frontend 首页 JS 去遗留化 v1：`home-follow-card-bridge.js` 迁入 `frontend-vue/src/home/problem-follow-home.ts`
- 优先级：`P1`
- 状态：`已关闭`
- 涉及：`frontend`、`frontend-vue`、`docs/design`
- 一句话目标：删除 `frontend/js/home-follow-card-bridge.js` 与 `home.html` 外链；`HomePage.vue` 直接 `import` `problem-follow-home.ts`；保留 `problem-follow-shared.js` 与 caseKey/高亮契约；不改 DOM / ProblemDetail。
- 验收口径（收尾）：**本轮以业务迁移为主**；**自动化 smoke 不保留入库**；**验收以真实浏览器人工联调为准**（创建/删除/导入/详情往返与阶段文案等，在已配置后端与登录环境下点验）。
- 阻塞：无
- 详述与证据：→ `docs/design/home-shadow-migration-map.md` · `frontend-vue/src/home/AGENTS.md`

- 任务编号：`FE-20260408-02`
- 日期：2026-04-08
- 标题：个人模型配置永久入口 Phase 2：首页 / 业务页顶栏挂载
- 优先级：`P1`
- 状态：`待验证`
- 涉及：`frontend`、`frontend-vue`
- 一句话目标：在登录进入系统后，为用户补一个稳定可见的“模型配置”永久入口，指向同一份 `model-config.html`，并保留 `redirect` 以便验证后回原页。
- 阻塞：无
- 详述与证据：→ `docs/plans/2026-04-07-user-first-login-llm-key-gate.md` §5 · `frontend-vue/src/home/AGENTS.md`

- 任务编号：`FE-20260406-03`
- 日期：2026-04-06
- 标题：首页 shared contract：`problem-follow-shared.js` 收口案例键与高亮 session
- 优先级：`P1`
- 状态：`待验证`
- 涉及：`frontend`、`frontend-vue`（`HomePage.vue` 退出登录经 bridge 清高亮）、`docs/design`
- 一句话目标：`js/core/problem-follow-shared.js` 为唯一实现；`main.js` 与 Vue 首页 `problem-follow-home.ts` 委托消费；`index.html` 先于 `main.js` 加载该脚本；不改 UI 与业务行为。
- 阻塞：无
- 详述与证据：→ `docs/design/home-shadow-migration-map.md`（真相源行）· `frontend/js/core/AGENTS.md` · `frontend/index.html`（`problem-follow-shared.js` 在 `main.js` 之前）

- 任务编号：`FE-20260329-07`
- 日期：2026-03-29
- 标题：`frontend/main.js` 拆分：Phase 0 治理冻结与覆盖盘点
- 优先级：`P0`
- 状态：`已完成`
- 涉及：`frontend`、`docs`
- 一句话目标：建立 `frontend/main.js` 拆分的唯一执行主记录，完成阶段总览、源能力覆盖表、目标反查表，并将 `ARCH/FE` 台账回链到该主记录。
- 阻塞：无（治理 `.cursor` 规则已落库，Phase 0 已关账）。
- 详述与证据：→ `docs/plans/2026-03-29-frontend-mainjs-splitting-execution-plan.md` · 规则 `.cursor/rules/frontend-mainjs-governance.mdc`

- 任务编号：`FE-20260329-08`
- 日期：2026-03-29
- 标题：`frontend/main.js` 拆分：Phase 1A — `core/problem-case-api.js`（online API / 导入导出恢复 / task action / bundle refresh）
- 优先级：`P0`
- 状态：`已完成`
- 涉及：`frontend`
- 一句话目标：新建 `frontend/js/core/problem-case-api.js`，将 online 案例相关 HTTP 从 `main.js` 收口到新模块，`main.js` 仅保留带注释的 bridge；`index.html` 在 `main.js` 前加载该模块；`SmartCto.problemCaseApi` 双挂。
- 阻塞：无
- 详述与证据：→ `docs/plans/2026-03-29-frontend-mainjs-splitting-execution-plan.md` §7 · `frontend/js/core/AGENTS.md`

- 任务编号：`FE-20260329-09`
- 日期：2026-03-29
- 标题：`frontend/main.js` 拆分：Phase 1B — `core/app-state.js`（详情/聊天/hydration façade）
- 优先级：`P0`
- 状态：`已完成`
- 涉及：`frontend`
- 一句话目标：新建 `frontend/js/core/app-state.js`，集中状态槽位与 `isProblemDetailStorageHydrated` / `getCanonicalActiveTaskId`；`main.js` 经 `__appState` 与带注释的 bridge 转发；`index.html` 在 `problem-case-api.js` 之后加载；DOM `el.problemDetailChatMessages` 与数据数组语义分离，避免与 `__appState.problemDetailChatMessages` 混替换。
- 阻塞：无
- 详述与证据：→ `docs/plans/2026-03-29-frontend-mainjs-splitting-execution-plan.md` §7 · `frontend/js/core/app-state.js`

- 任务编号：`FE-20260329-10`
- 日期：2026-03-29
- 标题：`frontend/main.js` 拆分：Phase 2A — `legacy/app-dom.js`（壳层 `el` + DOM helper）
- 优先级：`P0`
- 状态：`已完成`
- 涉及：`frontend`
- 一句话目标：新建 `frontend/js/legacy/app-dom.js`，集中 `buildShellElementCache` / `SmartCto.appDom`；`main.js` 仅 `const el = appDom.el` bridge；`index.html` 在 `app-state.js` 后加载；不改动 selector；`el.problemDetailChatMessages` 保持为 DOM 节点。
- 阻塞：无
- 详述与证据：→ `docs/plans/2026-03-29-frontend-mainjs-splitting-execution-plan.md` §7 · `frontend/js/legacy/AGENTS.md`

- 任务编号：`FE-20260329-11`
- 日期：2026-03-29
- 标题：`frontend/main.js` 拆分：Phase 2B — `legacy/problem-detail-renderer.js` / `legacy/problem-detail-events.js`
- 优先级：`P0`
- 状态：`已完成`
- 涉及：`frontend`
- 一句话目标：新建 `problem-detail-renderer.js`（顶栏/步骤条等只读 DOM）与 `problem-detail-events.js`（仅绑定与转发）；`renderProblemDetailContent` 仍留在 `main.js`；`index.html` 在 `app-dom.js` 后、`main.js` 前加载两模块；末尾 `SmartCto.problemDetailRenderer.init` / `problemDetailEvents.install`。
- 阻塞：无
- 详述与证据：→ `docs/plans/2026-03-29-frontend-mainjs-splitting-execution-plan.md` §7 · `frontend/js/legacy/AGENTS.md`

- 任务编号：`FE-20260325-06`
- 日期：2026-03-25
- 标题：online 模式案例 owner 隔离（前端配合）
- 优先级：`P0`
- 状态：`进行中`
- 涉及：`frontend`、`frontend-vue`
- 一句话目标：**前端不做伪权限/不做 owner 推断**；只消费后端返回；对 404/403 统一安全态收口；切换账号/退出登录必须清理在线案例相关缓存与视图态，避免残留上一账号数据。
- 阻塞：无（等待联调环境做最小回归签字）
- 详述与证据：→ `docs/agents/frontend-agent.md`（后续补最小回归结果与关键改动点）

- 任务编号：`FE-20260325-07`
- 日期：2026-03-25
- 标题：管理员案例列表显示创建用户
- 优先级：`P1`
- 状态：`进行中`
- 涉及：`frontend`
- 一句话目标：仅在 admin 角色的首页案例卡片追加“创建用户：xxx”；值只消费后端返回的 `createdBy`，不做用户名/localStorage/owner 推断；非 admin 完全不显示该行。
- 阻塞：无（等待联调环境做最小回归签字）
- 详述与证据：→ `docs/agents/frontend-agent.md`（后续补最小回归结果与关键改动点）

- 任务编号：`FE-20260326-04`
- 日期：2026-03-26
- 标题：Google Fonts 外链清扫与离线字体栈收口
- 优先级：`P1`
- 状态：`待验证`
- 涉及：`frontend`
- 一句话目标：移除 `frontend` 入口页对 `fonts.googleapis.com` / `fonts.gstatic.com` 的依赖，并将样式与 Mermaid 渲染统一切到可离线工作的本地中文系统字体栈。
- 阻塞：无
- 详述与证据：→ `docs/agents/frontend-agent.md`（已补充变更点与 `git grep` 复查结果）

- 任务编号：`FE-20260406-01`
- 日期：2026-04-06
- 标题：首页正式入口切换（`home.html`）+ Vue 首页与 legacy DOM 对照
- 优先级：`P1`
- 状态：`已完成（待 owner 抽检）`
- 涉及：`frontend`、`frontend-vue`
- 一句话目标：默认入口由 `index.html` 切至 `home.html`（`index.html` 内联脚本 + `main.js` 返回首页/知识库旁路）；保留 `?legacyHome=1`、详情 `?caseId=`、知识库 `?view=tools`；不删 legacy 首页 DOM/逻辑；构建产物进 `frontend/vue-auth-assets/`。
- 阻塞：无
- 详述与证据：→ `docs/design/home-shadow-migration-map.md`（正式入口已切换说明）· `frontend-vue/AGENTS.md` · 本轮触碰 `frontend/index.html`、`frontend/main.js`（导航到 `home.html` / URL `view=tools`）、`HomePage.vue` / `LoginPage.vue` / `AdminPage.vue`

- 任务编号：`FE-20260406-02`
- 日期：2026-04-06
- 标题：删除 `index.html` legacy 首页 DOM；`main.js` 收口回首页/导入高亮；`legacyHome=1` → `home.html`
- 优先级：`P1`
- 状态：`待验证`
- 涉及：`frontend`、`frontend-vue`（文档）、`docs/design`
- 一句话目标：正式首页已验收后移除 `index.html` 内 `#homeView` 等旧壳，避免双首页；共享 session 高亮与详情链路保留；不改 `home.html` 结构、不重构 ProblemDetail。
- 阻塞：无
- 详述与证据：→ `docs/design/home-shadow-migration-map.md`（§入口与真相源已更新）· 删除矩阵与验证见本轮 frontend-agent 回报
