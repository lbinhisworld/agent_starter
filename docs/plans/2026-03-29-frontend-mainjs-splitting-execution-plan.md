# Frontend `main.js` 拆分执行计划

## 1. 文档元数据

| 项 | 内容 |
| ---- | ---- |
| 状态 | `in_progress` |
| 主任务 | `ARCH-20260329-01` |
| 当前活跃批次 | Phase 5 · `local` 废弃独立里程碑（待新建 `ARCH`；Phase 4B 已 `closed`） |
| owner | architect owner |
| 执行方 | frontend agent |
| 冻结基线 | 前端拆分治理方案 `v10` |
| 关联知识卡 | `docs/knowledge/cross-cutting/2026-03-29-frontend-mainjs-governance.md` |
| 关联规则 | `.cursor/rules/frontend-mainjs-governance.mdc` |
| 计划定位 | 本文档是本轮 `main.js` 拆分的唯一主记录，承载计划、进度、验收与延期 |
| 更新规则 | 每次阶段状态变化、批次开关账、覆盖表补项、验收结论新增时，优先回写本文档 |

## 2. 冻结规则摘要

- 本轮统一以治理方案 `v10` 为唯一冻结基线，不再派生 `v10.x` 文本版本。
- 本轮是**结构迁移工程**，不是重构优化工程；online 主路径执行零语义漂移，local 废弃单独立项。
- `frontend/main.js` 进入冻结维护态，仅允许 `bootstrap + bridge + compat + hotfix` 最小补丁。
- 本轮禁止变更：
  - UI 与交互顺序
  - message `type/payload`
  - storage key
  - API path / method / 契约
  - 新增 `MODE === 'local'` 业务分支
  - 新增裸 `window.xxx = fn`
- `renderProblemDetailContent` 只允许在 Phase 3B 迁出；task8 全局 ITGap 只允许在 Phase 4A 迁出；task10/11 编排只允许在 Phase 4B 迁出。
- Phase 5 是单独的 `local` 废弃里程碑，不得混入本轮零漂移拆分任务。

### 2.1 堵不如疏：减少 `main.js` 触碰的默认落点

> **教训来源（2026-03）**：如 `3883b4d` 一类 **feat(task1)**，`main.js` 仍被大量修改，主因不是「禁令无效」，而是 **历史宿主仍在 `main.js`**（尤其详情**全量聊天渲染**、task1 **初步需求/补充链路**、`__appState` 旁路），执行上走最短路径必然撞上巨石。**堵不如疏**：在维持「`main.js` 仅 bootstrap + bridge + compat + hotfix」目标不变的前提下，用**默认可改文件**与**迁出 backlog** 引导实现落在正确模块，从源头减少「顺手改 main」。

**执行原则**

1. **先定落点再写代码**：开工前按下表选定默认模块；仅当改动属于 **bridge / `init*Runtime` 依赖注入 / compat 双挂**，或 **有证据的极小 hotfix**（且尽量随 PR 抽走大段逻辑）时，才把 `main.js` 作为首改文件。
2. **业务逻辑默认不进 `main.js`**：新增 LLM 链、卡片分支、重启/清空语义、聊天空态等，写在 `core/` 或领域脚本（如 `preliminaryRequirement.js`）；`main.js` **最多**保留一行委托或 `deps` 注入，避免在巨石内堆叠函数体。
3. **全量聊天渲染是已知技术债**：`renderProblemDetailChatFromStorage` 等仍驻 `main.js`（见 §9）。凡触碰「仅过程日志时的空态、某类 block 的渲染分支、重绘取错状态变量」：**优先**把判断与构建抽入 `problem-detail-chat.js` 或 `problem-detail-runtime.js`，`main.js` 仅留薄包装；并在 §4/§5 或 §7 留一句**后续迁出**登记意向（不必当批次强制关账）。
4. **状态只经 façade**：详情/聊天/hydration 读写经 `app-state` 与既有 storage 入口；禁止在 `main.js` 新增长串散养的 `__appState` 业务分支（对齐字段语义的 hotfix 除外）。

**场景 → 默认落点（疏导表）**

| 场景 | 默认落点 | `main.js` 允许内容 |
| ---- | ---- | ---- |
| task1 初步需求、补充/跟进、重启清空 | `frontend/js/preliminaryRequirement.js` + `frontend/js/core/problem-detail-runtime.js` | `initProblemDetailRuntime` 注入；必要时单行桥接 |
| 聊天 push/save、块辅助、展开/滚动 | `frontend/js/core/problem-detail-chat.js` | 维持薄代理；大段渲染逻辑不回流 |
| 任务编排、`handleProblemDetailChatSend`、hydration 管道 | `frontend/js/core/problem-detail-runtime.js` | bridge、`__host`、compat |
| 顶栏/步骤条/工作区 DOM、事件绑定 | `frontend/js/legacy/problem-detail-renderer.js`、`problem-detail-events.js` | 转发与 `install` |
| online API / bundle / 动作 | `frontend/js/core/problem-case-api.js` + 既有 adapter | bridge |
| 仅紧急 hotfix 且缺陷行仅在宿主 | 优先在**已承载模块**内修 | `main.js` **仅当**无法迁移时标注 `hotfix`，§7 或 PR 说明 |

**Review 提示（非 CI 强制）**：单 PR 对 `main.js` 变更净增 **约 80 行以上**（去掉纯格式化）时，须在 PR 或主记录 §7 说明：**采用了上表哪一格**，或为何属 **compat/hotfix** 并是否有**后续迁出**跟进项。

### Phase 0 关账状态

- 治理知识卡与 `.cursor` 规则已落库；`ARCH/FE` 台账已挂主记录链接。Phase 0 已 `closed`，后续批次从 Phase 1A 起按表推进。

## 3. 阶段总览表

| Phase | 批次 | 任务编号 | 负责人 | 当前状态 | 前置依赖 | 关账条件 |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| 0 | 治理冻结与覆盖盘点 | `FE-20260329-07` | owner + frontend agent | `closed` | `v10` 定稿 | 主记录建立；两张防漏表填完；`ARCH/FE` 台账挂链接；知识卡与规则落库；未开始代码迁移 |
| 1A | `problem-case-api` | `FE-20260329-08` | frontend agent | `closed` | Phase 0 `closed` | online API、导入/导出/恢复、task action、bundle refresh 经新模块统一收口 |
| 1B | `app-state` façade | `FE-20260329-09` | frontend agent | `closed` | Phase 1A `closed` | 新代码经 façade 读取状态；不再散读详情态、聊天态、hydration 态 |
| 2A | `app-dom` | `FE-20260329-10` | frontend agent | `closed` | Phase 1B `closed` | DOM 查询与壳层 helper 离开 `main.js`，无业务逻辑迁入 |
| 2B | `problem-detail-renderer` / `problem-detail-events` | `FE-20260329-11` | frontend agent | `closed` | Phase 2A `closed` | `renderer` 仅 DOM，`events` 仅绑定；`renderProblemDetailContent` 暂不迁出 |
| 3A | 依赖图 + `problem-detail-chat` | `FE-20260329-12` | frontend agent | `closed` | Phase 2B `closed` | 依赖图补齐；聊天消息模型、持久化入口、渲染入口迁出 |
| 3B | `problem-detail-runtime` | `FE-20260329-13` | frontend agent | `closed` | Phase 3A `closed` | `handleProblemDetailChatSend` 与 `renderProblemDetailContent` 宿主迁出；`main.js` 剩 bootstrap + bridge + compat + `__host` 注入 |
| 4A | task2 / task8 编排回收 | `FE-20260329-14` | frontend agent | `closed` | Phase 3B `closed` | task2 编排进入 companion；新增 `task8-global-itgap.js`；主站与报告页阶段定义一致 |
| 4B | task10 / task11 编排回收 | `FE-20260329-15` | frontend agent | `closed` | Phase 4A `closed` | `task10`/`task11` companion runtime 落地；`main.js` bridge + `init(deps)`；`rolePermission.js`/`coreBusinessObject.js` 不再承担新增编排 |
| 5 | `local` 废弃独立里程碑 | 待新建 `ARCH` 任务 | owner + frontend agent | `planned_later` | Phase 1–4 全部稳定 | 单独声明仅影响 local 用户；影响层覆盖 `local-mode-compat`、存储层、配置层与模式分支 |

### 行数与巨石基线

| 文件 | 当前行数 | 治理口径 |
| ---- | ---- | ---- |
| `frontend/main.js` | `14881`（2026-03-30 Phase 4B 关账后 `wc -l`；较 Phase 4A `16112` **−1231**，较用户口径基线 `16109` **−1228**） | 冻结维护态；Phase 4A 起 task2 / task8 经 companion + bridge；Phase 4B 起 task10 / task11 经 `task10-companion-runtime.js` / `task11-companion-runtime.js` + `main.js` bridge/bootstrap；`renderProblemDetailChatFromStorage` 宿主仍 `main.js`（详见 §9） |
| `frontend/js/core/problem-detail-runtime.js` | `1571` | Phase 3B 新增；`SmartCto.problemDetailRuntime`，无裸 `window` 读取 |
| `frontend/js/rolePermission.js` | `1033` | 已接近 `1200` 评审阈值；Phase 4 默认禁止继续吸收编排 |
| `frontend/js/coreBusinessObject.js` | `900` | 未触线，但同样只允许 companion runtime 承接编排 |

## 4. 源能力覆盖表

> 规则：每一项存量能力必须有去向；允许“暂缓”或“Phase 5 废弃”，但不允许空白。

| 能力 / 现状 | 当前落点 | 类型 | 目标归属 | 所属批次 | 触碰契约 | 验证场景 | 当前状态 |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| online API、导入 / 导出 / 恢复、task action、bundle refresh | `frontend/main.js`（bridge）+ `frontend/js/core/problem-case-api.js` + `frontend/js/storage-http-adapter.js`（bundle 委托） | `api` | `core/problem-case-api.js` + compat bridge | Phase 1A | API path / method / payload / response | 首页、详情、导入导出、恢复、动作确认 | `closed` |
| 设计详情页（Vue）与详情聊天态对齐：任务展示名、待确认摘要、task1 启动后聊天补丁 | `frontend/js/core/design-detail-progress-mirror.js` + `frontend-vue/src/design-detail/designDetailTaskMirror.ts` | `compat`-adjacent | `core/design-detail-progress-mirror.js`；不迁入 `main.js` | 演进 | message `type`/`confirmed`、storage key、`POST .../tasks/:id/start` 与详情一致 | `design-detail.html` 在线/本地 bundle + `saveProblemDetailChat` | `landed` |
| 设计详情页「重启当前」：`applyRestartCurrentTask` 同源 item/聊天截断 + `taskStartNotification` 重发（无 `__appState`） | `frontend-vue/src/design-detail/problemDetailRestartFromCase.ts` + `frontend/js/communication-history.js`（`inferTaskIdFromMessage`）+ `design-detail.html` 脚本序 | `compat`-adjacent | **不**迁入 `main.js`；与 `storage.restoreItemFromSnapshot` / `saveProblemDetailChat` / HTTP `removeTaskSummaryEntriesForRestart` 契约一致 | 演进 | storage key、message `type`、`filterChatMessagesRemoveTask` 归属与主站一致 | 设计顶栏「重启当前」+ 详情 `#btnProblemDetailRestartTask` | `landed` |
| 当前详情项、聊天数组、hydration 标志、canonical task 状态访问 | `frontend/main.js`（`__appState` bridge）+ `frontend/js/core/app-state.js` + `frontend/js/storage.js` | `state` | `core/app-state.js` | Phase 1B | storage key、状态字段、hydration 事件 | 打开详情、刷新恢复、顶部阶段标签、历史侧栏 | `closed` |
| DOM 元素缓存 `el`、壳层元素查询、基础 UI helper | `frontend/main.js`（bridge）+ `frontend/js/legacy/app-dom.js` | `dom` | `legacy/app-dom.js` | Phase 2A | selector、壳层结构、按钮 id/class | 首页打开、详情打开、面板切换 | `closed` |
| 工作区与问题详情渲染宿主 | `frontend/js/core/problem-detail-runtime.js` 中 `renderProblemDetailContent`；顶栏/步骤条等在 `legacy/problem-detail-renderer.js`；`main.js` 仅 bridge | `render` | `core/problem-detail-runtime.js` + `legacy/problem-detail-renderer.js` | Phase 2B / 3B | DOM 结构、按钮文案、卡片结构 | `ProblemDetail` 打开、刷新、任务切换 | `closed`（3B 宿主已入 runtime） |
| 事件绑定与点击转发 | `frontend/main.js` 转发 + `legacy/problem-detail-events.js` 注册 | `events` | `legacy/problem-detail-events.js` | Phase 2B | DOM 事件入口、按钮 data-attr | 任务确认、回退、工具栏操作 | `closed` |
| 聊天消息模型、push/save、聊天渲染与历史联动 | `frontend/main.js` + `frontend/js/communication-history.js` + `frontend/js/storage*.js` | `chat` | `core/problem-detail-chat.js` + compat | Phase 3A | message `type/payload`、storage key、history 归属 | 聊天发送、恢复、过程日志、刷新回放 | `closed` |
| 任务推进、聊天编排、刷新恢复、`handleProblemDetailChatSend` | `frontend/main.js`（bridge）+ `frontend/js/core/problem-detail-runtime.js` | `runtime` | `core/problem-detail-runtime.js` | Phase 3B | 任务状态语义、消息顺序、动作链路 | task1–task15 主链路、刷新恢复、重启当前 | `closed` |
| 全局 ITGap 四阶段定义、生成、压缩、工作区渲染入口 | `frontend/main.js`（bridge）+ `frontend/js/core/task8-global-itgap.js` + `frontend/js/report-global-itgap-render.js` | `task-runtime` | `core/task8-global-itgap.js` + report sync | Phase 4A | task8 消息类型、阶段定义、工作区结构 | task8 生成、压缩、报告页一致性 | `closed` |
| task7 端到端事务流分阶段 LLM、Session 合并、工作区 JSON 解析与业务流程完整性补齐 | `frontend/main.js`（bridge + 薄包装）+ `frontend/js/task7-e2e-transaction-flow.js` | `task-runtime` | `js/task7-e2e-transaction-flow.js` + `main.js` `init(deps)` | 演进 | task7 `type`/payload、`e2eTransactionFlowJson` PUT | task7 自动顺序、刷新 hydrate、`pickRaw` 供 task8 | `landed` |
| task2 BMC 讨论与重生成编排 | `frontend/main.js`（bridge）+ `frontend/js/core/task2-companion-runtime.js` + `frontend/js/task2BusinessCanvas.js` | `task-runtime` | `task2 companion runtime` | Phase 4A | task2 消息类型、完成确认链路 | task2 生成、讨论、确认、失败回滚 | `closed` |
| task9 局部 ITGap 能力 | `frontend/js/localItGap.js` + `frontend/main.js` `getLocalItGapDeps()` | `task-runtime` | 保持现状；仅调整 compat 注入，不混入 task8 | Phase 3B / 4A | task9 消息类型、step session、工作区结构 | task9 分析、压缩、确认、切换 task10 | `planned` |
| task10 角色与权限编排 | `frontend/main.js`（bridge）+ `frontend/js/core/task10-companion-runtime.js` + `frontend/js/rolePermission.js`（协议/数据层） | `task-runtime` | `core/task10-companion-runtime.js` | Phase 4B | task10 消息类型、审计链路、`SmartCto`/既有 compat | task10 生成、审计、修改、确认 | `closed` |
| task11 核心业务对象编排 | `frontend/main.js`（bridge）+ `frontend/js/core/task11-companion-runtime.js` + `frontend/js/coreBusinessObject.js`（严格 prompt 等） | `task-runtime` | `core/task11-companion-runtime.js` | Phase 4B | task11 消息类型、审计链路、PUT checkpoint、`SmartCto`/既有 compat | task11 生成、审计、修改、确认 | `closed` |
| 裸 `window.*` 导出与 compat 入口 | `frontend/main.js` + `frontend/js/*` | `compat` | `window.SmartCto.*` + compat 双挂 | Phase 1–4 持续 | `window` 接口、旧入口函数名 | 旧脚本调用、主站加载顺序 | `planned` |
| `MODE === 'local'` 分支、存储适配器与配置层 | `frontend/main.js` + `frontend/js/storage.js` + `frontend/js/storage-indexeddb-adapter.js` + `frontend/js/storage-http-adapter.js` + `frontend/js/config.js` + `frontend/config.js` + `frontend/config.local.js` | `local` | Phase 5 单独治理 | MODE 分支、storage key、配置读取 | local 启动、IndexedDB hydration、online 切换 | `deferred_to_phase_5` |

## 5. 目标反查表

> 反向校验：每个目标模块都必须写明将承接什么，以及当前来源；若当前阶段不落地，也必须写“暂缓”。

| 目标模块 / 目标位 | 应承接能力 | 当前来源 | compat 保留项 | 完成状态 |
| ---- | ---- | ---- | ---- | ---- |
| `core/problem-case-api.js` | online API、导入导出恢复、动作接口、bundle refresh | `frontend/main.js`、`frontend/js/storage-http-adapter.js` | `SmartCto.problemCaseApi` + `main.js` bridge | `closed` |
| `core/design-detail-progress-mirror.js` | 设计页任务名解析、待确认块摘要、task1 确认后聊天数组补丁、`getProblemDetailChatStorageKey` | 新建；消费 `FOLLOW_TASKS` 等全局配置 | 与 `problem-case-api`、`storage.saveProblemDetailChat` 契约对齐；**不**改 message 协议 | `landed` |
| `frontend-vue/src/design-detail/problemDetailRestartFromCase.ts` | 设计页「重启当前」持久化编排（`buildItemAfterRollbackToTask` / `filterChatMessagesRemoveTask` 同源实现）+ `SmartCto.problemDetailRestart` | `frontend/main.js` `applyRestartCurrentTask`（对齐审查） | 无详情 DOM/内存会话态；若已加载 `main.js` 可消费 canonical 解析 | `landed` |
| `core/app-state.js` | 详情态、聊天态、hydration、canonical task façade | `frontend/main.js`、`frontend/js/storage.js` | `window.getCurrentProblemDetailItem` 等旧读口先双挂 | `closed` |
| `legacy/app-dom.js` | DOM 查询、元素缓存、基础壳层 helper | `frontend/main.js` | `SmartCto.appDom` + `main.js` `const el = appDom.el` bridge | `closed` |
| `legacy/problem-detail-renderer.js` | 工作区渲染、UI setup、只读 state 的 DOM 输出 | `frontend/main.js` | `SmartCto.problemDetailRenderer` + 末尾 `init(deps)`；`renderProblemDetailContent` 在 Phase 3B 前继续由 `main.js` 持有宿主 | `closed` |
| `legacy/problem-detail-events.js` | 事件绑定与回调转发 | `frontend/main.js` | `SmartCto.problemDetailEvents.install`；业务仍在 `main.js` 命名处理函数 | `closed` |
| `core/problem-detail-chat.js` | 消息模型、push/save、展开/Tab/滚动等 DOM 辅助 | `frontend/main.js`（薄代理） | `SmartCto.problemDetailChat` + `window.appendProblemDetailChatMessage` 等三枚 Phase 3A compat | `closed` |
| `core/problem-detail-runtime.js` | 任务推进、聊天编排、刷新恢复、动作链路 | `frontend/main.js` | 宿主外壳仍由 `main.js` bootstrap 调起 | `planned` |
| `core/task8-global-itgap.js` | task8 四阶段定义、生成、压缩、工作区入口 | `frontend/main.js`、`frontend/js/report-global-itgap-render.js` | 报告页共享定义或同步常量 | `planned` |
| `frontend/js/task7-e2e-transaction-flow.js` | task7 端到端事务流分阶段 LLM、Session 合并、hydrate、业务流程完整性补齐 | `frontend/main.js`（bridge + 同名薄包装函数） | `SmartCto.task7E2eTransactionFlow.init(deps)`；`globalThis.pickRawE2eTransactionFlowJsonFromItemAndMessages` 供 `itDesignSupplement.js` | `landed` |
| `task2 companion runtime` | task2 讨论、重生成、确认前后编排 | `frontend/main.js`、`frontend/js/task2BusinessCanvas.js` | `window` 旧入口保留到调用方清零 | `planned` |
| `core/task10-companion-runtime.js` | task10 生成、合规审计、重生成、完成确认与刷新补偿 | `frontend/main.js`（迁移前宿主） | `SmartCto.task10Runtime` + `initTask10CompanionRuntime` | `closed` |
| `core/task11-companion-runtime.js` | task11 环节推演、全局审计、checkpoint、all-done | `frontend/main.js`（迁移前宿主） | `SmartCto.task11Runtime` + `initTask11CompanionRuntime`；审计解析依赖由 `main` 注入 `task10Runtime.parse…` | `closed` |
| `legacy/local-mode-compat.js` + Phase 5 治理 | 页面侧 local fallback；最终与存储 / 配置层一起处置 | `frontend/main.js`、`frontend/js/storage*.js`、配置文件 | Phase 1–4 不新增长逻辑，只保留兼容 | `deferred_to_phase_5` |

## 6. 批次卡片

### `FE-20260329-07` · Phase 0 治理冻结与覆盖盘点

- 目标落点：`docs | governance`
- 触碰文件：
  - `docs/plans/2026-03-29-frontend-mainjs-splitting-execution-plan.md`
  - `docs/agents/architect/03-active-tasks.md`
  - `docs/agents/frontend/03-active-tasks.md`
  - `docs/plans/AGENTS.md`
- 禁止变更：
  - 业务代码
  - 规则文件正文
  - 知识卡正文
- `main.js` 触碰：`no`
- 实施步骤：
  1. 建立唯一主记录文档与状态枚举。
  2. 写完阶段总览、覆盖表、反查表、批次卡片。
  3. 在 `ARCH` 台账挂总控任务，在 `FE` 台账挂当前活跃批次。
  4. 明确知识卡与规则文件待落范围，但不在本批次内改业务代码。
- 验收点：
  - 主记录存在且内容完整
  - 两张防漏表无空白行
  - `ARCH/FE` 台账均可回链到主记录
  - 知识卡与 `.mdc` 规则已落库；Phase 0 状态为 `closed`（见 §7 关账行）
- 回滚点：仅文档回滚，无代码回滚

### `FE-20260329-08` · Phase 1A `problem-case-api`

- 目标落点：`core`
- 触碰文件：
  - `frontend/main.js`
  - `frontend/js/core/problem-case-api.js`
  - `frontend/index.html`
  - `frontend/js/core/AGENTS.md`
  - `frontend/js/AGENTS.md`
- 禁止变更：UI、message 语义、storage key、API 契约
- `main.js` 触碰：`bridge`
- 行数预算：允许短期增长，峰值必须在本批次卡中声明；下一批开始回收
- 验收点：API 调用经新模块统一收口；旧入口仍可通过 compat 工作

### `FE-20260329-09` · Phase 1B `app-state`

- 目标落点：`core`
- 触碰文件：`frontend/main.js`、`frontend/js/core/app-state.js`、对应 `AGENTS.md`
- 禁止变更：状态字段语义、hydration 事件名、storage key
- `main.js` 触碰：`bridge`
- 验收点：新代码经 façade 读写状态；`app-state` 不承担业务规则

### `FE-20260329-10` · Phase 2A `app-dom`

- 目标落点：`legacy`
- 触碰文件：`frontend/main.js`、`frontend/js/legacy/app-dom.js`、对应 `AGENTS.md`
- 禁止变更：selector、壳层 DOM 结构、交互顺序
- `main.js` 触碰：`bridge`
- 验收点：DOM 查询与基础 UI helper 离开 `main.js`

### `FE-20260329-11` · Phase 2B `problem-detail-renderer` / `problem-detail-events`

- 目标落点：`legacy`
- 触碰文件：`frontend/main.js`、`frontend/js/legacy/problem-detail-renderer.js`、`frontend/js/legacy/problem-detail-events.js`
- 禁止变更：`renderProblemDetailContent` 宿主提前迁出、事件回调内联业务
- `main.js` 触碰：`bridge`
- 验收点：`events` 只绑事件与转发；`renderer` 只做 DOM 渲染与 UI setup

### `FE-20260329-12` · Phase 3A 依赖图 + `problem-detail-chat`

- 目标落点：`core`
- 触碰文件：主记录依赖图、`frontend/main.js`、`frontend/js/core/problem-detail-chat.js`
- 禁止变更：消息类型、消息顺序、聊天块 HTML 结构
- `main.js` 触碰：`bridge`
- 验收点：先补依赖图，再迁聊天相关入口；`renderProblemDetailHistory` 行为不变

### `FE-20260329-13` · Phase 3B `problem-detail-runtime`

- 目标落点：`core`
- 触碰文件：`frontend/main.js`、`frontend/js/core/problem-detail-runtime.js`
- 禁止变更：任务推进语义、刷新恢复语义、重启当前与回退链路
- `main.js` 触碰：`bridge`
- 验收点：`handleProblemDetailChatSend` 与 `renderProblemDetailContent` 宿主迁出；`main.js` 只剩外壳

### `FE-20260329-14` · Phase 4A task2 / task8 编排回收

- 目标落点：`core | compat`
- 触碰文件：
  - `frontend/main.js`
  - `frontend/js/task2BusinessCanvas.js` 或 companion runtime
  - `frontend/js/core/task8-global-itgap.js`
  - `frontend/js/report-global-itgap-render.js`
- 禁止变更：task8 阶段定义漂移、task9 混源
- `main.js` 触碰：`compat`
- 验收点：task2 编排离开 `main.js`；task8 新模块落地；报告页与主站阶段定义一致

### `FE-20260329-15` · Phase 4B task10 / task11 编排回收

- 目标落点：`compat`
- 触碰文件：
  - `frontend/main.js`
  - `frontend/js/rolePermission.js` 或 companion runtime
  - `frontend/js/coreBusinessObject.js` 或 companion runtime
- 禁止变更：继续向 `rolePermission.js` / `coreBusinessObject.js` 堆编排
- `main.js` 触碰：`compat`
- 验收点：task10 / task11 编排进入 companion runtime；巨石文件不新增编排职责

## 7. 验收记录

| 日期 | 批次 / 任务 | 验证人 | 结果 | 遗留问题 |
| ---- | ---- | ---- | ---- | ---- |
| 2026-03-29 | `FE-20260329-07` | owner | `passed_partial` | 主记录、`ARCH/FE` 索引、覆盖表已落地；知识卡与 `.mdc` 规则文件仍待新增，故 Phase 0 保持 `in_progress` |
| 2026-03-29 | `FE-20260329-07` · Phase 0 收口 | owner | **`closed`**（`FE-20260329-07 closed`） | 知识卡 `docs/knowledge/cross-cutting/2026-03-29-frontend-mainjs-governance.md` 与规则 `.cursor/rules/frontend-mainjs-governance.mdc` 已补建；前端台账 `FE-20260329-07` 已标已完成；Phase 0 关账 |
| 2026-03-29 | `FE-20260329-08` · Phase 1A | frontend agent | **`closed`**（`FE-20260329-08 closed`） | 新增 `frontend/js/core/problem-case-api.js` + `SmartCto.problemCaseApi`；`index.html` 在 `main.js` 前加载 module；`main.js` bridge；`wc -l` main.js `18783`（峰值较基线 `18961` 略降） |
| 2026-03-29 | `FE-20260329-09` · Phase 1B | frontend agent | **`closed`**（`FE-20260329-09 closed`） | 新增 `frontend/js/core/app-state.js` + `SmartCto.appState`；`index.html` 在 `problem-case-api.js` 后、`main.js` 前加载；`main.js` 经 `__appState` 引用与 window getter 桥接；`el.problemDetailChatMessages` DOM 与 `__appState.problemDetailChatMessages` 数据槽位分离；`wc -l` main.js `18785`（较 Phase 1A `18783` +2） |
| 2026-03-29 | `FE-20260329-10` · Phase 2A | frontend agent | **`closed`**（`FE-20260329-10 closed`） | 新增 `frontend/js/legacy/app-dom.js` + `SmartCto.appDom`（`el`、`setHidden`、`toggleClass`）；`index.html` 在 `app-state.js` 后、`main.js` 前加载；`main.js` `const el = SmartCto.appDom.el` bridge；`wc -l` main.js `18685`（较 Phase 1B `18785` **−100**） |
| 2026-03-29 | `FE-20260329-11` · Phase 2B | frontend agent | **`closed`**（`FE-20260329-11 closed`） | 新增 `frontend/js/legacy/problem-detail-renderer.js` + `problem-detail-events.js`；`main.js` 顶栏/步骤条等 bridge + 详情区事件转发；末尾 `problemDetailRenderer.init` / `problemDetailEvents.install`；`renderProblemDetailContent` 未迁出；`wc -l` main.js `18560`（较 Phase 2A 基线 `18685` **−125**） |
| 2026-03-30 | `FE-20260329-12` · Phase 3A | frontend agent | **`closed`**（`FE-20260329-12 closed`） | 新增 `frontend/js/core/problem-detail-chat.js`（`wc -l` ~184）+ `SmartCto.problemDetailChat`；`main.js` 薄代理 + `getProblemDetailChatMode` 注入 + `window` compat 三枚；`renderProblemDetailChatFromStorage` / `renderProblemDetailHistory` 宿主仍 `main.js`；主记录 §9 依赖图；`wc -l` main.js `18506`（较 Phase 2B `18560` **−54**） |
| 2026-03-30 | `FE-20260329-13` · Phase 3B | frontend agent | **`closed`**（`FE-20260329-13 closed`） | 新增 `frontend/js/core/problem-detail-runtime.js`（`wc -l` `1571`）+ `SmartCto.problemDetailRuntime`；`main.js` 薄 bridge + 末尾 `initProblemDetailRuntime` 注入 `__host`；`initProblemDetailChat` 串联改为 `applyStoredChatPostHydrationPipeline`；`index.html` 于 `problem-detail-chat.js` 后加载 runtime module；`window.renderProblemDetailContent` / `window.handleProblemDetailChatSend` compat；`problemDetailEvents.install` 置于 runtime init 之后；`wc -l` main.js `17099`（较 Phase 3A `18506` **−1407**）；task9 / task8 混源约束未触碰 |
| 2026-03-30 | `FE-20260329-14` · Phase 4A | frontend agent | **`closed`**（`FE-20260329-14 closed`） | 新增 `frontend/js/core/task2-companion-runtime.js`、`frontend/js/core/task8-global-itgap.js`；`main.js` bridge + `task8`/`task2` bootstrap `init(deps)`（先于 `problemDetailRenderer.init`）；`index.html` 于 `problem-detail-runtime.js` 与 `main.js` 之间加载两 module；`report.html` 于 `report-global-itgap-render.js` 前加载 `task8-global-itgap.js`；`report-global-itgap-render.js` 薄委托 `SmartCto.task8GlobalItGap`；`core/AGENTS.md` 登记；`wc -l` main.js `16112`（较 Phase 3B 基线 `17099` **−987**）；task8 与 task9 无交叉引用 |
| 2026-03-30 | `FE-20260329-15` · Phase 4B | frontend agent | **`closed`**（`FE-20260329-15 closed`） | 新增 `frontend/js/core/task10-companion-runtime.js`、`task11-companion-runtime.js`；`main.js` task10/task11 大段改为薄桥 + 末尾 `initTask10CompanionRuntime`/`initTask11CompanionRuntime`（`task11` 注入 `parseRolePermissionAuditDefectItems` → `task10Runtime`，无静态互引）；`index.html` 于 `task8-global-itgap.js` 后、`main.js` 前加载两 module；`core/AGENTS.md`、`.cursor/rules/frontend-mainjs-governance.mdc` Phase 4B 关账硬规则已补；`wc -l` main.js `14881`（较用户基线 `16109` **−1228**）；未改 task10/task11 消息类型、storage key、API 与既有 `window` compat 集合 |
| 2026-04-28 | 演进 · 设计详情「重启当前」 | product-delivery | **`landed`** | 新增 `problemDetailRestartFromCase.ts` 注册 `SmartCto.problemDetailRestart`；`design-detail.html` 增加 `communication-history.js`；§4/§5 覆盖表与 `core/AGENTS.md` 登记；`frontend-vue` `npm run build` 通过；**未**增 `main.js` 净编排行 |

## 8. 风险 / 延期清单与修订记录

### 风险 / 延期清单

| 编号 | 风险 / 延期项 | 影响 | 应对方式 | 当前状态 |
| ---- | ---- | ---- | ---- | ---- |
| R1 | `v10` 方案正文尚未作为仓库内正式文档落库 | Phase 0 无法完全闭环 | 先以本文档引用 `v10` 为聊天定稿基线；知识卡与规则文件落库后补齐闭环 | `open` |
| R2 | `.cursor` 规则文件与治理知识卡尚未建立 | Phase 0 无法关账 | 已补建 `frontend-mainjs-governance.mdc` 与 cross-cutting 知识卡 | `mitigated` |
| R3 | `main.js` 兼容导出较多，双挂关账跨度长 | Phase 1–4 易回收不彻底 | 在覆盖表中持续记录 compat 保留项，并在每批次验收时对账 | `open` |
| R4 | `renderProblemDetailContent`、`handleProblemDetailChatSend` 与任务编排耦合重 | Phase 3 风险高 | Phase 3A 必须先补依赖图；未补图不进入 Phase 3B | `open` |
| R5 | `rolePermission.js` 接近阈值 | Phase 4 易形成新巨石 | 视为“伴生 runtime 硬偏好”；禁止再向原文件堆编排 | `open` |
| R6 | local 下线涉及存储与配置层，不止页面 fallback | Phase 5 风险高 | 单独新建 `ARCH` 任务，不混入本轮拆分 | `open` |

### 修订记录

- 2026-03-29：初稿建立。落地唯一主记录文档、阶段总览、覆盖表、反查表、批次卡片与首条验收记录。
- 2026-03-29：Phase 0 收口——补建治理知识卡与 `frontend-mainjs-governance.mdc`；§7 新增关账验收行；阶段总览 Phase 0 标为 `closed`；当前活跃批次指向 Phase 1A（待开工）。
- 2026-03-29：Phase 1A 关账——`problem-case-api.js` 落地，`main.js` 仅保留 bridge；阶段总览 Phase 1A `closed`；当前活跃批次指向 Phase 1B（`FE-20260329-09`）。
- 2026-03-29：Phase 1B 关账——`app-state.js` 落地，`main.js` 状态经 `SmartCto.appState.getState()` 与 bridge 注释收口；修复误替换 `el.problemDetailChatMessages` 为 `el.__appState.problemDetailChatMessages` 的 DOM 引用错误；阶段总览 Phase 1B `closed`；当前活跃批次指向 Phase 2A（`FE-20260329-10`）。
- 2026-03-29：Phase 2A 关账——`legacy/app-dom.js` 承接壳层 `el` 与纯 DOM helper；`main.js` 仅 bridge；阶段总览 Phase 2A `closed`；当前活跃批次指向 Phase 2B（`FE-20260329-11`）。
- 2026-03-29：Phase 2B 关账——`legacy/problem-detail-renderer.js` / `problem-detail-events.js` 落地；`main.js` bridge + 事件转发；§4/§5 覆盖表与反查表已对齐；阶段总览 Phase 2B `closed`；当前活跃批次指向 Phase 3A（`FE-20260329-12`）。
- 2026-03-30：Phase 3A 关账——新增 §9 依赖图；`core/problem-detail-chat.js` 承接 append/push/setup*/scroll；`main.js` 薄代理 + `window` compat 三枚；§3 Phase 3A `closed`；活跃批次指向 Phase 3B（`FE-20260329-13`）。
- 2026-03-30：Phase 3B 关账——`core/problem-detail-runtime.js` 承接 `renderProblemDetailContent`、`handleProblemDetailChatSend`、hydration 后 `ensure*` 管道；`main.js` `__host` 注入 + bridge；§3 Phase 3B `closed`；活跃批次指向 Phase 4A（`FE-20260329-14`）。
- 2026-03-30：Phase 4A 关账——`core/task2-companion-runtime.js`、`core/task8-global-itgap.js` 落地；`main.js` 仅 bridge + bootstrap `init`；`index.html` / `report.html` 加载序对齐；§3 Phase 4A `closed`；§4 全局 ITGap / task2 覆盖行 `closed`；§7 新增验收行；活跃批次指向 Phase 4B（`FE-20260329-15`）。
- 2026-03-30：Phase 4B 关账——`core/task10-companion-runtime.js`、`core/task11-companion-runtime.js` 落地；`main.js` 薄桥 + `init(deps)`；§3 Phase 4B `closed`；§4 task10/task11 覆盖行 `closed`；§5 反查表 companion 行 `closed`；§7 新增验收行；`.mdc` 增补「禁止再向 `rolePermission.js`/`coreBusinessObject.js` 吸收编排」硬规则；活跃批次指向 Phase 5（待新建 `ARCH`）。
- 2026-03-31：新增 **§2.1 堵不如疏**——结合 feat 仍触碰 `main.js` 的教训，补充默认可改落点表、`renderProblemDetailChatFromStorage` 等技术债上的「先抽后包」流程与轻量 Review 提示；知识卡与 `.mdc` 已对齐。
- 2026-04-28：设计详情「重启当前」——`frontend-vue/src/design-detail/problemDetailRestartFromCase.ts` 注册 `SmartCto.problemDetailRestart`；`design-detail.html` 增补 `communication-history.js`；§4/§5 覆盖表、§7 验收行、`frontend/js/core/AGENTS.md` 登记。

## 9. Phase 3A 依赖图（`FE-20260329-12` · `core/problem-detail-chat.js`）

> 用途：Phase 3B 进场前对齐调用边界；**禁止**在本图未共识前扩展 `problem-detail-chat` 职责至任务编排。

### 9.1 `main.js` → `problem-detail-chat.js`

| 类别 | 符号 / 能力 | 说明 |
| ---- | ---- | ---- |
| **bridge 注入** | `SmartCto.problemDetailChat.init({ el, saveProblemDetailChat, getProblemDetailChats, getTimeStr, escapeHtml, renderMarkdown, getProblemDetailChatMode })` | 文件末尾 bootstrap；`getProblemDetailChatMode` 保证 Agent/Ask 切换后 askMode 标记与原先一致 |
| **薄代理（体内仅转调 SmartCto）** | `appendProblemDetailChatMessage`、`pushAndSaveProblemDetailChat`、`scrollChatToTaskStartNotification` | 主链路仍通过这些同名函数调用，实现迁至模块 |
| **薄代理 · setup*** | `setupProblemDetailChatTextToggle`、`setupProblemDetailChatCardToggle`、`setupProblemDetailBmcCardToggle`、`setupProblemDetailValueStreamTabs`、`setupProblemDetailJsonBlockToggle` | `setupProblemDetailRequirementLogicCardToggle` **保留 main**（含 task3 确认与 `renderProblemDetailContent` 编排，属业务规则） |
| **仍留 main（Phase 3A / 3B）** | `initProblemDetailChat`（hydration 后管道委托 `SmartCto.problemDetailRuntime.applyStoredChatPostHydrationPipeline`）、`renderProblemDetailChatFromStorage`、`rerenderProblemDetailChatFromStorageState`、`renderProblemDetailHistory`、`getProblemDetailChatStorageKey` | 全量聊天渲染与沟通历史侧栏仍在 `main.js`；与 `communication-history.js` 的契约不变；**新增需求触达此处时优先按 §2.1 先抽至 `problem-detail-chat.js` / `problem-detail-runtime.js` 再留薄包装** |
| **Phase 3B（已关账）** | `handleProblemDetailChatSend`、`renderProblemDetailContent` 宿主 | 已迁至 `core/problem-detail-runtime.js`；`main.js` 仅 bridge；`index.html` 在 `main.js` 前加载 runtime module；末尾 `initProblemDetailRuntime({ __host })` |

### 9.2 `problem-detail-chat.js` → `app-state.js`

| 方向 | 字段 / API | 说明 |
| ---- | ---- | ---- |
| 读 | `SmartCto.appState.getState().problemDetailChatMessages`、`currentProblemDetailItem` | 追加/推送前取当前数组与案例项 |
| 写 | `SmartCto.appState.setProblemDetailChatMessages(next)` | 与原先 `__appState.problemDetailChatMessages = …` 数组替换语义一致 |

### 9.3 `problem-detail-chat.js` → `storage.js` / `communication-history.js`

| 依赖 | 说明 |
| ---- | ---- |
| `storage` | 仅通过 **`deps.saveProblemDetailChat(caseKey, msgs)`** 持久化；storage key 口径仍由 `main.js` 的 `getProblemDetailChatStorageKey` 与模块内同名辅助保持一致（createdAt 优先，否则 id） |
| `communication-history.js` | **无直接依赖**；过程日志 / 历史侧栏仍由 `main.renderProblemDetailHistory` → `communication-history` |

### 9.4 `problem-detail-chat.js` → `problem-detail-renderer.js`

| 关系 | 说明 |
| ---- | ---- |
| 无直接调用 | 顶栏/步骤条等由 `SmartCto.problemDetailRenderer` + `main.js` bridge；聊天块结构仍由 `renderProblemDetailChatFromStorage`（main）驱动 |

### 9.5 compat 双挂（旧名 → 新模块）

| 旧全局名 | 新入口 | 备注 |
| ---- | ---- | ---- |
| `window.appendProblemDetailChatMessage` | 同 `main.js` 薄代理 → `SmartCto.problemDetailChat.appendMessage` | 与 `navigation.js` / `task*` 等回调对齐 |
| `window.pushAndSaveProblemDetailChat` | → `…pushAndSave` | 同上 |
| `window.scrollChatToTaskStartNotification` | → `…scrollToTaskStart` | 同上 |

### 9.6 调用关系简图（ASCII）

```text
index.html 加载序 … → problem-detail-chat.js（定义 SmartCto.problemDetailChat）
       → main.js（defer）
              ├─ init(deps)  ───────────────────────────► problem-detail-chat
              ├─ 同名函数 ──────────────────────────────► problem-detail-chat.*
              ├─ renderProblemDetailChatFromStorage ────► （仍 main 内部）
              └─ renderProblemDetailHistory ─────────────► communication-history
```
