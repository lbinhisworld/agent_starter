# ProblemDetail 工程化打包 / 轻混淆 / Vue 统一专项主记录

## 1. 文档元数据


| 项     | 内容                                                                                   |
| ----- | ------------------------------------------------------------------------------------ |
| 状态    | `in_progress`                                                                      |
| 当前阶段  | `A 线已关账；B 线待实施`                                                             |
| owner | architect owner                                                                      |
| 主记录定位 | 本文档是 ProblemDetail 工程化打包 / 轻混淆 / Vue 统一事项的唯一主记录                                      |
| 任务索引  | `docs/plans/problem-detail-build-obfuscation-and-vue-unification/tasks/README.md`    |
| 关联台账  | `docs/agents/architect/03-active-tasks.md`、`docs/agents/frontend/03-active-tasks.md` |
| 更新规则  | 后续状态、延期、验收、风险与回滚优先回写本文件，不散落在聊天中                                                      |


## 2. 背景与目标

本专项当前按“执行优先、统一并行”的方式处理两条彼此相关、但节奏不同的线路：

1. 旧 `frontend/` 仍承担 `index.html?caseId=` 的案例详情主链路，但当前没有正式 build 产线，生产侧缺少稳定的打包、压缩、轻混淆与运行时证据口径。
2. `frontend-vue/` 已有成熟的 Vite 多入口构建链，但案例详情尚未统一到同一构建工程；若直接“Vue 重写详情页”，会把工程化与语义迁移风险绑死。

本主记录的目标不是直接重写 ProblemDetail，而是先建立：

- A 线：旧 `frontend` 的 build / minify / 轻混淆 / deploy / smoke 合同与生产执行闭环
- B 线：仅面向 `online` 的统一构建工程、Vue 壳层与 legacy/runtime 内核合同

## 3. 冻结边界

以下口径在本专项存续期间冻结，除非 owner 明确回写本文件后再调整：

1. 对外详情入口继续保持 `index.html?caseId=`，不新增第二个公开详情 URL。
2. A 线不迁移案例详情，只补 build / minify / 轻混淆 / deploy / smoke 合同。
3. B 线只考虑 `online`；`local` 不纳入迁移实施与首批 cutover 验收。
4. `ProblemDetail` 的 message `type/payload`、storage key、API path/method、任务语义、关键用户文案不得因 build 或 Vue 接管而漂移。
   白名单基线至少覆盖 `SmartCto.*`、`window.APP_CONFIG`、storage key、`caseId` / `view` 参数、DOM / `data-*` 约定与聊天 `message.type` 字面量。
5. 轻混淆只提高逆向成本，不承诺前端源码保密；不得以“混淆”为理由破坏可回归性与可运维性。
6. B 线不是“Vue 重写详情页”，而是“统一构建工程 + Vue 壳层 + legacy/runtime 内核”；首批不重写高编排节点业务语义。

## 4. 当前现状与判断

### 4.1 当前事实

1. `frontend/` 当前仍以静态 HTML + 顺序脚本加载为主，仓库内没有与其对应的正式 build 工程或 `package.json` 产线。
2. `frontend-vue/` 已具备 Vite 多入口构建能力，产物写入 `frontend/vue-auth-assets/`，适合承接统一构建工程。
3. ProblemDetail 当前详情真相源已经分层明确：`frontend/js/core/app-state.js` 负责当前案例与聊天内存槽位，`frontend/js/core/problem-detail-runtime.js` 负责任务输入路由与工作区编排，`frontend/js/preliminaryRequirement.js` 负责 task1 V2 初步需求语义，`frontend/main.js` 负责 host 注入、hydrate 与 bundle refresh 协调，`frontend/js/core/problem-detail-chat.js` 负责消息持久化入口；`problem-detail-renderer.js`、`communication-history.js` 与 `problem-detail-events.js` 只消费状态做展示或转发。
4. 旧 `frontend/dist` 的部署口径已有文档骨架，但当前专项要把它补到可直接派工、可直接验收的粒度。
5. `frontend` 当前公开发布拓扑至少包含 `index.html`、`home.html`、`login.html`、`admin.html`、`model-config.html`、`report.html` 与共享 `vue-auth-assets/`；A 线不能只盯 `?caseId=` 深链而漏掉默认入口和门禁跳转链。
6. 最新同步到 `origin/main-v1` 的 task1 真相源进一步确认：状态逻辑 merge 已拆成“新 entity 直写 + 既有 entity 分桶分步合并 + merge session 子任务状态显示”，同时工作区 entity 折叠子卡改为 `details` lazy hydrate；A 线 smoke 与运行时留证必须把这条最新链路当成直接发布风险面。
7. 2026-04-12 再次合并 `origin/main-v1` 后，task7 新增“业务流程完整性补齐”自动顺序执行链，前端引入 `e2ePrelimFvsCompletenessSessionsBlock`、`e2ePrelimFvsCompletenessAllDoneConfirmBlock` 与工作区 `e2eRequirementScenarioSupplementJson` 补齐卡；A 线 build 合同本身未变，但 smoke / 运行时证据必须同步扩面。

### 4.2 当前判断

1. 若只追求最快见效，A 线应先落 build / minify / 轻混淆，不把详情迁移风险一起引入。
2. 若要最终统一到 `frontend-vue`，最稳方案是“统一构建工程和壳层”，而不是先复制一套 Vue 版详情业务逻辑。
3. 浏览器端混淆收益有限；真正需要冻结的是输入输出合同、保留名、回归面、部署证据和切回门。
4. 当前生产发布判断优先看 A 线 Phase 1C 执行闭环；B 线 Phase 2/3 的完成结论保留，但不作为本轮旧详情发布的直接阻断项。

## 5. 双轨路线图


| Phase | 线路  | 名称                     | 目标                                              | 关账条件                         |
| ----- | --- | ---------------------- | ----------------------------------------------- | ---------------------------- |
| 0     | A+B | 主记录与任务体系落地             | 建立唯一主记录、任务索引、全量任务 md                            | 主记录、任务索引、phase 子目录与任务模板全部落地  |
| 1A    | A   | build / minify / 轻混淆合同 | 冻结旧 `frontend` 的 build 输入输出、脚本顺序、混淆白名单与禁止项      | 实现者不需要自行判断哪些文件打包、哪些名字必须保留    |
| 1B    | A   | deploy / smoke / 运行时证据 | 冻结 `frontend/dist` 的部署、缓存、回滚与最小 smoke 口径        | 可明确回答如何部署、如何验证、何时回滚          |
| 1C    | A   | Execution              | 将 A 线合同落成真实 build / minify / obfuscation / smoke / go-no-go 执行闭环 | 生产发布是否可发有书面结论，不再停留在合同层    |
| 2A    | B   | 统一工程与 host 合同          | 冻结 online-only、host / selector / command、首批接管范围 | Vue 壳层接入不需要读取 legacy 内核细节    |
| 2B    | B   | fixture 与双渲染合同         | 冻结快照命名、对照输入、selector / DOM 对照清单                 | 双渲染验收可复现、可追溯                 |
| 3     | B   | cutover readiness      | 定义 Vue shell 切换门、切回条件与延期规则                      | 有 go/no-go 门，且任何漂移可切回 legacy |


## 6. 当前挂账任务总表

### 6.1 Phase 0


| 任务编号               | owner | 状态            | 目标                                                       | 任务文档                                                    |
| ------------------ | ----- | ------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| `ARCH-20260411-01` | owner | `completed`   | 建立专项目录、主记录、子目录 `AGENTS.md`、任务索引文件                        | [ARCH-20260411-01](./tasks/phase-0/phase-0ARCH-20260411-01.md) |
| `ARCH-20260411-02` | owner | `completed`   | 冻结专项名称、目标、适用范围、双轨策略和非目标                                  | [ARCH-20260411-02](./tasks/phase-0/phase-0ARCH-20260411-02.md) |
| `ARCH-20260411-03` | owner | `completed`   | 把专项索引挂到 `docs/plans/AGENTS.md` 与 architect/frontend 活跃台账 | [ARCH-20260411-03](./tasks/phase-0/phase-0ARCH-20260411-03.md) |
| `ARCH-20260411-04` | owner | `completed`   | 建立统一任务模板与任务编号规则                                          | [ARCH-20260411-04](./tasks/phase-0/phase-0ARCH-20260411-04.md) |
| `ARCH-20260411-05` | owner | `completed`   | 建立 phase 关账门、总风险表、总回滚表                                   | [ARCH-20260411-05](./tasks/phase-0/phase-0ARCH-20260411-05.md) |


### 6.2 Phase 1A


| 任务编号             | owner    | 状态        | 目标                                       | 任务文档                                                 |
| ---------------- | -------- | --------- | ---------------------------------------- | ---------------------------------------------------- |
| `FE-20260411-01` | frontend | `completed` | 盘点旧 `frontend` 入口、页面、脚本、外链依赖、模块脚本、全局桥接对象 | [FE-20260411-01](./tasks/phase-1a/phase-1aFE-20260411-01.md) |
| `FE-20260411-02` | frontend | `completed` | 冻结旧 `frontend` 的 build 输入/输出合同           | [FE-20260411-02](./tasks/phase-1a/phase-1aFE-20260411-02.md) |
| `FE-20260411-03` | frontend | `completed` | 冻结脚本顺序、模块依赖、全局桥接保留规则                     | [FE-20260411-03](./tasks/phase-1a/phase-1aFE-20260411-03.md) |
| `FE-20260411-04` | frontend | `completed` | 冻结轻混淆策略与禁止项                              | [FE-20260411-04](./tasks/phase-1a/phase-1aFE-20260411-04.md) |
| `FE-20260411-05` | frontend | `completed` | 建立混淆白名单 / 保留名合同                          | [FE-20260411-05](./tasks/phase-1a/phase-1aFE-20260411-05.md) |
| `FE-20260411-06` | frontend | `completed` | 冻结第三方依赖和配置外置策略                           | [FE-20260411-06](./tasks/phase-1a/phase-1aFE-20260411-06.md) |
| `FE-20260411-07` | frontend | `completed` | 冻结 `frontend/dist` 目录结构和拷贝清单             | [FE-20260411-07](./tasks/phase-1a/phase-1aFE-20260411-07.md) |


### 6.3 Phase 1B


| 任务编号               | owner    | 状态        | 目标                                  | 任务文档                                                     |
| ------------------ | -------- | --------- | ----------------------------------- | -------------------------------------------------------- |
| `ARCH-20260411-06` | owner    | `completed` | 冻结 A 线 deploy / cache / rollback 合同 | [ARCH-20260411-06](./tasks/phase-1b/phase-1bARCH-20260411-06.md) |
| `FE-20260411-08`   | frontend | `completed` | 建立前端运行时证据模板                         | [FE-20260411-08](./tasks/phase-1b/phase-1bFE-20260411-08.md)     |
| `FE-20260411-09`   | frontend | `completed` | 建立 A 线最小 smoke 矩阵                   | [FE-20260411-09](./tasks/phase-1b/phase-1bFE-20260411-09.md)     |
| `FE-20260411-10`   | frontend | `completed` | 定义 A 线失败分级和回滚动作                     | [FE-20260411-10](./tasks/phase-1b/phase-1bFE-20260411-10.md)     |
| `FE-20260411-11`   | frontend | `completed` | 建立 A 线验收记录模板                        | [FE-20260411-11](./tasks/phase-1b/phase-1bFE-20260411-11.md)     |


### 6.4 Phase 1C · Execution

| 任务编号               | owner    | 状态        | 目标                                         | 任务文档                                                     |
| ------------------ | -------- | --------- | ------------------------------------------ | -------------------------------------------------------- |
| `FE-20260412-01`   | frontend | `completed` | 实现旧 `frontend` 的 dist build runner         | [FE-20260412-01](./tasks/phase-1c/phase-1cFE-20260412-01.md)     |
| `FE-20260412-02`   | frontend | `completed` | 接入 js/html/css minify                     | [FE-20260412-02](./tasks/phase-1c/phase-1cFE-20260412-02.md)     |
| `FE-20260412-03`   | frontend | `completed` | 接入 light obfuscation with keep list      | [FE-20260412-03](./tasks/phase-1c/phase-1cFE-20260412-03.md)     |
| `FE-20260412-04`   | frontend | `completed` | 固化 dist copy and external assets          | [FE-20260412-04](./tasks/phase-1c/phase-1cFE-20260412-04.md)     |
| `FE-20260412-05`   | frontend | `completed` | 执行 a-line smoke and runtime verification  | [FE-20260412-05](./tasks/phase-1c/phase-1cFE-20260412-05.md)     |
| `ARCH-20260412-01` | owner    | `completed` | 执行 a-line go / no-go review               | [ARCH-20260412-01](./tasks/phase-1c/phase-1cARCH-20260412-01.md) |

### 6.5 Phase 2A

详见 [tasks/README.md](./tasks/README.md) 与 `tasks/phase-2a/`。

### 6.6 Phase 2B

详见 [tasks/README.md](./tasks/README.md) 与 `tasks/phase-2b/`。

### 6.7 Phase 3

详见 [tasks/README.md](./tasks/README.md) 与 `tasks/phase-3/`。

## 7. Phase 关账门


| Phase | 必须完成的结果                                         | 最低证据                                 |
| ----- | ----------------------------------------------- | ------------------------------------ |
| 0     | 主记录、AGENTS、任务索引、全量任务 md 结构齐全                    | 目录树、索引回链、主记录与任务文档一致性                 |
| 1A    | build / minify / 轻混淆合同冻结到可直接派工                  | 资产清单、build 合同、保留名与禁止项清单              |
| 1B    | deploy、cache、rollback、smoke、运行时证据冻结             | deploy 合同、证据模板、smoke 矩阵、失败分级         |
| 1C    | A 线真实 build / minify / obfuscation / copy / smoke / go-no-go 执行闭环落地 | build runner、dist 产物、运行时证据、go/no-go 结论 |
| 2A    | online-only、host / selector / command、同 URL 技术切换与后端访问合同冻结 | host 合同、首批接管范围、统一工程承接方案、后端 online 契约（401/403/404/428、owner isolation、AI gate、deep link）、同 URL 技术切换合同 |
| 2B    | fixture、selector、DOM、双渲染对照合同冻结                  | fixture 目录规则、对照清单、验证流程               |
| 3     | cutover readiness、切回门、延期规则冻结                    | go/no-go 门、灰度规则、切回条件、残余风险模板               |


## 8. A 线实施合同

### 8.1 build / minify 基础合同

1. 旧 `frontend` 的构建输出固定为 `frontend/dist`。
2. 对外详情深链仍由 `frontend/dist/index.html` 提供，公开 URL 保持 `index.html?caseId=`。
3. 当前默认入口拓扑也要一并收口：无 `caseId` 时跳转的 `home.html`、鉴权与管理链路涉及的 `login.html` / `admin.html` / `model-config.html`，以及共享 `vue-auth-assets/` 资源都必须纳入 dist 合同，不能只保证详情深链可开。
4. `config.js` / `config.local.js` 保持外置，不打进业务 bundle。
5. 先做 bundle + minify，再进入轻混淆；不允许一上来直接做重混淆。
6. `frontend-vue` 源码与其 Vite 多入口构建不属于 A 线首批 build 职责；A 线只消费其已产出到 `frontend/` 的页面与 `vue-auth-assets/` 资源，并将其纳入 `frontend/dist` 发布集合。

### 8.2 脚本顺序与全局桥接合同

1. 现有 HTML 中依赖顺序的脚本、module 和 `main.js` / runtime 注入关系必须被显式盘点并冻结。
2. `SmartCto.*`、HTML 直连脚本引用的全局名、storage key、message type、URL 参数、`data-*` / 反射约定一律视为保留项。
3. 任何会破坏 DOM id/class/data-*、API path、任务语义、关键文案的打包与混淆配置都视为越界。
4. 现状盘点已确认 `index.html` 为“同步脚本 -> `type=\"module\"` 核心模块 -> `defer main.js`”三段式主链，且 `problem-follow-shared.js`、`problemDetailRuntime` 与 `main.js` 的先后关系必须保留。
5. 白名单合同已确认 `message.type` 字面量、session key 前缀与 `caseId` / `view` 参数同样属于绝对保留面，不得通过别名映射或压缩间接改写。

### 8.3 轻混淆策略

1. 本专项只允许轻混淆，目标是提高阅读与逆向成本，而不是前端源码保密。
2. 禁止直接启用高风险手段，例如 control-flow flattening、self-defending、dead-code injection、debug protection 或会影响调试、回归、回滚的等价配置。
3. 第三方外链库与配置文件默认不纳入混淆范围，除非后续单独补充合同。
4. 轻混淆必须以前述保留名 / 白名单合同为前提；不得改写 `SmartCto.*`、storage key、URL 参数、DOM / `data-*` 契约与 `message.type` 字面量。

### 8.4 deploy / smoke

1. A 线必须补齐 `frontend/dist` 的部署映射、缓存失效、整包回滚与最小 smoke 矩阵。
2. A 线 smoke 不只检查 `?caseId=` 深链，还必须覆盖默认入口、`home.html`、`login.html`、`model-config.html`、登录后首页与详情往返所依赖的静态资源命中。
3. 后续验收不接受“本地 build 成功”作为唯一证据，必须提供运行时证据。
4. 当前生产发布判断以前端 A 线的 Phase 1C 执行为准；B 线 Phase 2/3 继续推进，但不作为本轮旧详情发布的直接阻断项。
5. Phase 1C 任务卡默认必须自带执行与验收 prompt，确保 agent 团队可直接派工与独立复核，不再依赖聊天补口径。
6. 2026-04-12 同步 `origin/main-v1` 后，`task1` 最新高风险链明确包含 merge session 子任务状态块、新 entity 直写、既有 entity 分桶分步合并与 entity `details` lazy hydrate；A 线 smoke 与运行时证据至少要覆盖其中 1 条真实行为并留证。
7. 2026-04-12 再次合并 `origin/main-v1` 后，`task7` 又新增“业务流程完整性补齐 Session 计划 -> 自动顺序执行 -> 需求场景事务流补齐卡 -> 全部完成确认”链；A 线无需改 build / minify / 轻混淆 / dist copy 合同，但最小 smoke 与运行时证据必须把该链路纳入当前发布风险面。

## 9. B 线实施合同

### 9.1 online-only

1. B 线首批只面向 `online`；`local` 不纳入迁移实施。
2. B 线不清理 local 存储方案，不将 local 兼容作为 cutover 阻塞项。
3. 本专项里的 `local` 指 `APP_CONFIG.MODE === 'local'` 下的 IndexedDB / localStorage / 本地登录 / 直连模型链路，不是 task9 的业务命名 `local-itgap`；task9 仍属于 online 详情语义的一部分。
4. online-only 不是纯前端口径；后端必须同步冻结鉴权、401/403/404、428 / `AI_CONFIG_REQUIRED`、拒绝访问、深链恢复与 bundle 刷新相关语义，其中 detail owner isolation 对 user 统一走 `404`，AI 配置门禁需明确跳转 `model-config.html` 的 redirect 合同，且不得改动既有 API path/method。
5. 当前所谓 bundle refresh 本质是前端按既有 path 顺序拉取 detail / messages / tasks 三段数据后组装；首批不得为 Vue shell 新增第二套 detail-bundle API 作为前提。
6. host、fixture、双渲染、灰度与 cutover 的首批验收对象均固定为 online 输入与 online 访问链，不接受把 local 模式作为前置验收条件。

### 9.2 统一工程，但不重写详情语义

1. B 线的目标是统一构建工程、统一入口组织、统一壳层承接，而不是复制一套 Vue 版 ProblemDetail 业务逻辑。
2. ProblemDetail 当前任务、聊天与工作区语义继续以 legacy/runtime 真相源为准；其中 `app-state + runtime + preliminaryRequirement + main bridge` 是后续 host 合同必须围绕的最小内核，不得改成“Vue 自己重新解释一遍任务语义”。
3. task1 的 V2 初步需求 schema、深度提炼、补充切片、字段并集合并、view/json 构造继续以 `frontend/js/preliminaryRequirement.js` 为准；runtime 与 main 只负责调度、落库、hydrate 与重绘。

### 9.3 host / selector / command 合同

1. Vue 壳层只消费 host 暴露的 selector 与 command。
2. selector 负责只读状态与展示输入；其上游必须来自 `SmartCto.appState` 当前 item / messages、canonical task 结果与 task1 resolved preliminary requirement，而不是 renderer DOM、history 投影结果或散落局部变量。
3. command 负责复用原动作链，不新增第二套“Vue 版任务执行逻辑”；task1 相关 command 继续复用 `runtime + main + preliminaryRequirement` 现有链路。
4. host 必须以单一 `snapshotVersion` 为核心：selector 只返回同一版本下的只读快照，command 只返回受理回执，不直接返回权威状态。
5. host 合同必须明确异步 command 之后 UI 如何得到新快照；唯一合法机制是“事件通知 + 重新取 selector”，不得靠命令返回值、DOM diff 或 legacy 私有状态补洞。
6. `problem-detail-chat.js` 仍是消息 push/save 与 caseKey 绑定的唯一入口；`problem-detail-renderer.js`、`problem-detail-events.js`、`communication-history.js` 只能作为消费层或转发层。
7. 首批 host command 只覆盖开案、刷新、步骤聚焦、历史侧栏开关与 retry；高编排 task 动作继续留在 legacy 内核。
8. 若 Vue shell 仍需直接读取 legacy 内核私有状态，或反向把 renderer / history 结果当成真相源，视为合同未完成。

### 9.4 首批接管范围

首批仅允许：

- 顶部壳层与导航，但只承接布局、badge、导航高亮与受控跳转，不顺带重写登录态、鉴权或模型配置语义
- 步骤条，但只承接状态展示与 `focusTask(taskId)` 聚焦，不替换 task 执行语义
- 历史侧栏，且必须按结构级接管冻结：至少覆盖汇总指标、任务树、`任务详情 / 过程日志 / 任务Skill / 审计Skill` 四类 tab / panel，而不是只保留入口按钮
- loading / error / empty state

首批默认不进入：

- 主工作区业务渲染
- 聊天消息列表、输入框、Ask/Agent 模式与发送链
- 高编排节点 task1 / task4 / task8 / task10 / task11 的业务实现替换
- `rollback / restart current / exception resume`
- 售前方案 / 导出 / 恢复等详情工具条动作

首批允许采用 `Vue shell + legacy island` 混合形态，不要求整页一次性完全改成 Vue。

### 9.5 同 URL 灰度技术合同

1. `index.html?caseId=` 仍是唯一公开详情 URL；Phase 3 灰度与切回必须在同一 URL 下完成，不新增第二条外部入口。
2. `frontend-vue` 里的详情壳层不是新的公开 HTML，而是由 `index.html` 消费的同源静态资产入口，产物固定落在 `frontend/vue-auth-assets/`，与 `home/login/admin/model-config` 共用版本链。
3. 在真正灰度前，必须冻结 legacy / Vue shell 选择发生在什么层、由谁读取什么 flag、flag 的优先级与默认值是什么；唯一合法来源是 `?pdShell=` 临时覆盖、`window.APP_CONFIG.PROBLEM_DETAIL_SHELL` 部署开关和缺省回 `legacy` 的三层合同。
4. 同 URL 下的切回必须能即时生效，不能依赖人工改入口地址或临时换页面路径；Vue 壳层资源加载失败、mount 失败或 host 能力检查失败时，必须在当前 `index.html?caseId=` 即时 fallback 到 legacy。
5. 若 bootstrap、flag、缓存或资源装载链未冻结，同 URL 灰度不得宣称 ready。

## 10. fixture / 双渲染合同

1. `legacy` / `vue-shell` 对照必须基于同一 `fixture_id` + `fixture_version`。
2. fixture 根目录固定为 `docs/plans/problem-detail-build-obfuscation-and-vue-unification/fixtures/problem-detail/<fixture_id>/<fixture_version>/`。
3. `fixture_id` 固定采用 `pd-online-` 前缀的小写 kebab-case，`fixture_version` 固定采用三位序号 `v001`、`v002`…，且不允许覆盖旧版本目录。
4. fixture 目录最小命名固定为：
  - `case.json`
  - `messages.json`
  - `meta.json`
5. `meta.json`、`case.json`、`messages.json` 是正式验收的最小三件套；可选扩展文件只能补充证据，不能替代三件套，也不允许在线回源补数据。
6. 正式验收不允许直接拿在线活案例做无保护对照。
7. 首批 fixture 集合固定为 9 张 P0 场景：新建案例空态、三张 task1、工作流对齐中段、task8 IT 设计补齐、富历史侧栏、task10 修改链、task11 修改链。
8. selector 对照与 DOM 对照都要先有检查清单，再谈 cutover readiness。
9. 若首批接管包含历史侧栏，对照清单必须覆盖任务树、汇总指标、四个 tab 与对应 panel 的结构，而不只是入口是否可点。

## 11. 风险、回滚与升级人工条件


| 风险                      | 触发信号                                     | 默认动作                 |
| ----------------------- | ---------------------------------------- | -------------------- |
| 旧 `frontend` build 合同不清 | 无法回答哪些文件打包、哪些外置                          | 停止实现，先补 build 输入输出合同 |
| 混淆破坏全局桥接                | `SmartCto.`*、storage key、message type 漂移 | 回滚混淆配置，保留 minify     |
| deploy 证据不足             | 只能证明“本地构建成功”                             | 不允许宣称关账              |
| Vue shell 误入业务重写        | selector / command 不足，开始直接读内部状态          | 停止 B 线实现，回补 host 合同  |
| online 后端合同漂移          | owner isolation、401/403/404/428、AI gate 或 deep link 语义与前端约定不一致 | 停止切换评估，先补后端合同并复核 |
| 对照输入不稳定                 | 未绑定 `fixture_id` / `fixture_version`     | 对照结果无效，回到未验收         |
| cutover 决策不清            | 无 go/no-go 门或切回条件                        | 不允许切流量，保持 legacy     |


升级人工条件：

1. build、deploy、混淆、host、fixture 合同之间出现冲突口径。
2. 同一事项既影响公开入口、又影响语义真相源，但责任主位不清。
3. 对照 diff 无法判断是渲染漂移还是输入快照变化。

## 12. 任务文档索引入口

任务索引入口：`[tasks/README.md](./tasks/README.md)`

phase 子目录：

- `[tasks/phase-0/](./tasks/phase-0/)`
- `[tasks/phase-1a/](./tasks/phase-1a/)`
- `[tasks/phase-1b/](./tasks/phase-1b/)`
- `[tasks/phase-1c/](./tasks/phase-1c/)`
- `[tasks/phase-2a/](./tasks/phase-2a/)`
- `[tasks/phase-2b/](./tasks/phase-2b/)`
- `[tasks/phase-3/](./tasks/phase-3/)`

## 13. 验收记录表


| 日期         | Phase   | 结论            | 备注                                              |
| ---------- | ------- | ------------- | ----------------------------------------------- |
| 2026-04-11 | Phase 0 | `completed`   | 已建立专项目录、主记录、任务索引、全量任务卡、索引回链与角色提示词入口；Phase 0 正式关账并切入 Phase 1A |
| 2026-04-12 | Phase 1A | `completed` | 已完成 `FE-20260411-01` 至 `FE-20260411-07`，冻结 A 线资产盘点、build 输入输出、顺序与桥接、轻混淆、白名单、vendor / 配置外置与 `frontend/dist` 目录结构；Phase 1A 正式关账并切入 Phase 1B |
| 2026-04-12 | Phase 1B | `completed` | 已完成 `ARCH-20260411-06`、`FE-20260411-08`、`FE-20260411-09`、`FE-20260411-10`、`FE-20260411-11`，冻结 deploy / cache / rollback 合同、运行时证据模板、最小 smoke、失败分级与验收记录模板；Phase 1B 正式关账并进入 Phase 1C 执行筹备 |
| 2026-04-12 | Phase 1C | `completed` | 已完成 `FE-20260412-01` 至 `FE-20260412-05` 与 `ARCH-20260412-01`，A 线已落地旧 `frontend` 的 dist build runner、js/html/css minify、light obfuscation、copy / external 资产固化、最小 smoke 与 owner 级 go/no-go 结论；当前可作为 legacy 详情 A 线稳定基线回并 `main-v1` |
| 2026-04-12 | Phase 2A | `completed` | 已完成 `ARCH-20260411-07`、`FE-20260411-12`、`FE-20260411-13`、`FE-20260411-14`、`BE-20260411-01`、`FE-20260411-15`、`FE-20260411-16`，冻结 B 线不是 Vue 业务重写，补齐真相源、host 合同、online-only、后端 online 访问合同、首批接管范围与同 URL 技术切换合同；其中详情壳层明确为 `frontend-vue` 的资产入口而非第二个公开 HTML，首批允许 `Vue shell + legacy island`，历史侧栏提升为结构级接管，聊天链、主工作区与高编排 task 仍留在 legacy；Phase 2A 正式关账并切入 Phase 2B |
| 2026-04-12 | Phase 2B | `completed` | 已完成 `FE-20260411-17`、`FE-20260411-18`、`FE-20260411-19`、`FE-20260411-20`、`FE-20260411-21`，冻结 fixture 根目录、`pd-online-` 命名规则、`v001` 版本规则与 `meta.json` / `case.json` / `messages.json` 最小三件套，收口 9 张 P0 fixture，固定 selector / DOM 检查组与同 URL 双渲染验证流程；Phase 2B 正式关账并切入 Phase 3 |
| 2026-04-12 | Phase 3 | `completed` | 已完成 `ARCH-20260411-08`、`FE-20260411-22`、`FE-20260411-23`、`ARCH-20260411-09`，把 readiness 结论拆成 `not_ready` / `ready_for_preparation` / `ready_for_gray` 三层，冻结 G1-G6 六类 go/no-go 前置门、L0-L3 灰度规则、切回与残余风险模板以及双轨拆批 / 延期规则；Phase 3 正式关账，文档专项整体完成 |


## 14. 修订记录

- 2026-04-11：初稿建立；落地专项主记录、任务索引、phase 目录与任务文档模板。
- 2026-04-12：补记 `FE-20260411-01` 盘点结论，冻结公开入口拓扑与详情主链关键顺序事实。
- 2026-04-12：补记 `FE-20260411-02` 合同结论，冻结 A 线 bundle / copy / external 输入边界与 `frontend/dist` 输出原则。
- 2026-04-12：补记 `FE-20260411-03` 顺序结论，冻结 `index.html` 三段式加载链与 `main.js` bootstrap 内部硬顺序。
- 2026-04-12：补记 `FE-20260411-04` 轻混淆结论，冻结允许项、默认不做项与显式禁止项。
- 2026-04-12：补记 `FE-20260411-05` 白名单结论，冻结全局桥接、storage key、URL 参数、DOM / `data-*` 与 `message.type` 保留面。
- 2026-04-12：补记 `FE-20260411-06` 依赖结论与 `FE-20260411-07` dist 结构结论，Phase 1A 关账并切入 Phase 1B。
- 2026-04-12：补记 `ARCH-20260411-06`、`FE-20260411-08`、`FE-20260411-09` 结论，冻结 A 线 deploy / cache / rollback、运行时证据模板与最小 smoke 矩阵。
- 2026-04-12：补记 `FE-20260411-10`、`FE-20260411-11` 结论，冻结 A 线失败分级、回滚动作与验收记录模板，Phase 1B 关账并转入 Phase 1C 执行筹备。
- 2026-04-12：新增 `FE-20260412-01` 至 `FE-20260412-05` 与 `ARCH-20260412-01`，把 A 线从“合同冻结”补成“Execution 执行落地”闭环；当前生产 go/no-go 以 Phase 1C 为直接签字面，B 线继续并行推进。
- 2026-04-12：完成 `FE-20260412-01`，新增 `frontend/scripts/build-dist.mjs` 并生成可重复验证的 `frontend/dist` 基线；Phase 1C 从“待执行”进入“执行中”。
- 2026-04-12：完成 `FE-20260412-02`，在 `frontend/scripts/build-dist.mjs` 接入保守型 js/html/css minify，并保留 `--no-minify` 对照入口；当前 Phase 1C 已形成“build runner + minify”双层执行基线。
- 2026-04-12：完成 `FE-20260412-03`，在 `frontend/scripts/build-dist.mjs` 接入可独立关闭的 light obfuscation，并把 `terser` 固化到 `frontend-vue` 工具链；当前 Phase 1C 默认产物已进入“build runner + minify + light obfuscation”状态，可通过 `--no-obfuscation` 单独降级回 minify-only。
- 2026-04-12：完成 `FE-20260412-04`，把 copy / external 资产链、关键文件存在性检查与入口 HTML 本地引用完整性检查固化进 `frontend/scripts/build-dist.mjs`；当前 dist 已具备“可直接发布、缺件即失败”的基本属性。
- 2026-04-12：完成 `FE-20260412-05` 与 `ARCH-20260412-01`，以“服务级预检 + owner 手工 smoke”收口 A 线执行闭环，并把 go/no-go 结论固定为 `go`；当前 legacy 详情工程化产物可作为 A 线稳定基线回并 `main-v1`，正式发布批次继续沿用运行时证据模板补截图与 Network/Console 留证。
- 2026-04-12：补记 `ARCH-20260411-07` 结论，再次冻结 B 线定位不是详情业务重写，而是工程统一与壳层承接。
- 2026-04-12：补记 `FE-20260411-12`、`FE-20260411-13`、`FE-20260411-14`、`BE-20260411-01`、`FE-20260411-15` 结论，冻结真相源、host 更新机制、online-only、后端 online 访问合同与首批接管范围，并把历史侧栏提升为结构级接管对象。
- 2026-04-12：补记 `FE-20260411-16` 结论，冻结 `frontend-vue` 详情壳层作为 asset entry 接入、`?pdShell=` / `APP_CONFIG.PROBLEM_DETAIL_SHELL` / default `legacy` 的同 URL 选择优先级，以及同 URL 下即时 fallback 到 legacy 的技术合同；Phase 2A 关账并切入 Phase 2B。
- 2026-04-12：补记 `FE-20260411-17` 结论，冻结 fixture 根目录、`pd-online-` 场景命名、`v001+` 版本规则与 `meta.json` / `case.json` / `messages.json` 最小三件套，不允许在线回源补数据。
- 2026-04-12：补记 `FE-20260411-18` 结论，冻结首批 fixture 覆盖矩阵为 9 张 P0 场景，包含新建案例空态、三张 task1、高风险中段工作流、task8、富历史侧栏、task10 修改链与 task11 修改链。
- 2026-04-12：补记 `FE-20260411-19` 结论，把 selector 对照固定为壳层/导航、历史侧栏、task1 专项、修改链专项四组检查清单，并绑定到 9 张首批 fixture。
- 2026-04-12：补记 `FE-20260411-20` 结论，把 DOM 对照固定为壳层/导航、步骤条、历史侧栏、task1 工作区、修改链五组检查清单，并绑定到 9 张首批 fixture。
- 2026-04-12：补记 `FE-20260411-21` 结论，冻结“同一 fixture + 同一 URL + 先 selector 后 DOM”的双渲染流程、差异归类规则与最小记录模板；Phase 2B 关账并切入 Phase 3。
- 2026-04-12：补记 `ARCH-20260411-08` 结论，把 readiness 拆成三层状态，固定 G1-G6 六类 go/no-go 前置门与直接 No-Go 条件。
- 2026-04-12：补记 `FE-20260411-22` 结论，把灰度切换拆成 L0-L3 四层，并明确本卡只负责使用 `FE-20260411-16` 的同 URL 技术合同，不重写第二套技术定义。
- 2026-04-12：补记 `FE-20260411-23` 结论，冻结切回触发器、阻塞项、未验收项、残余风险的统一记录模板。
- 2026-04-12：补记 `ARCH-20260411-09` 结论，冻结双轨拆批 / 延期规则，明确 A 线可先关账、B 线继续存续；本专项文档整体关账。
- 2026-04-12：同步 `origin/main-v1` 到执行分支，确认 task1 最新风险面已扩展到 merge session 子任务状态显示、新 entity 直写、既有 entity 分桶分步合并与 entity `details` lazy hydrate；A 线 smoke / execution 口径已按此补强。
- 2026-04-12：再次合并最新 `origin/main-v1` 后，确认 A 线 build / minify / 轻混淆 / dist copy 合同无需调整，但 smoke / execution 风险面需新增 task7 “业务流程完整性补齐”链路；已把最小 smoke 与执行记录同步补强到 `task7` 专项。
