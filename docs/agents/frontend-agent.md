# Frontend Agent 执行文档

> **文档分层（ARCH-20260325-01）**：执行准则与轻量台账已拆至 `docs/agents/frontend/`（`00-core.md`～`03-active-tasks.md`）。**新派工、新准则、新活跃任务索引**优先更新该目录；本文档保留**历史长文**（任务详述、每日更新、协同留言等），第二阶段再瘦身或迁入知识库。

## 执行总规则

- 执行本面板前，必须先阅读并遵守以下总规则文件：
  - `project-core.mdc`（项目协作总规则，与根目录 `AGENTS.md` 配套）
- 后续所有任务执行、文档更新、沟通方式、最小化变更原则，都必须按该规则文件执行。
- 如果本面板与该规则文件存在冲突，以该规则文件为准。

## 项目修改边界

- 前端 agent 只允许修改以下项目：
  - `E:\03_do1_workspace\do1_smart_cto\frontend`
  - `E:\03_do1_workspace\do1_smart_cto\frontend-vue`
- 前端 agent 不允许修改：
  - `E:\03_do1_workspace\do1_smart_cto\backend`
- 如需后端配合，不得直接进入后端项目修改，必须按本文档中的“跨 Agent 协同留言方式”发起协同。

## 0. 临时事项：接口鉴权排查

> 优先级：最高。先做这件事，再继续本周其他任务。

- 立即检查前端当前会调用的所有后端接口，确认是否存在“不带鉴权也能获取信息/成功调用”的情况。
- 重点检查：
  - 是否有接口调用没有带 `Authorization` header。
  - 是否有前端依赖未鉴权接口读取配置、详情、消息、管理信息。
  - 是否存在通过浏览器直接访问即可拿到业务数据的接口入口。
- 一旦发现问题：
  - 立即记录到本文档“与架构 owner 沟通区”。
  - 同步后端 agent 修复接口侧鉴权。
  - 前端改为统一走鉴权请求头，不保留绕过路径。
- 排查范围至少包括：
  - `ProblemDetail` 相关接口
  - AI 相关接口
  - 管理端相关接口
  - 任何返回业务数据、配置数据、消息时间线的数据接口

## 1. 项目背景

- 当前需要重点关注两个前端项目：
  - `E:\03_do1_workspace\do1_smart_cto\frontend`
  - `E:\03_do1_workspace\do1_smart_cto\frontend-vue`
- 两个前端项目的职责定位：
  - `frontend`：当前主业务前端，尤其是 `ProblemDetail` 主链路与核心业务交互。
  - `frontend-vue`：Vue 版前端工程，当前重点承接登录、管理端以及后续可迁移的前端能力。
- 当前系统核心目标：本周优先打通 `ProblemDetail` 闭环。
- 当前前端现状：
  - `main.js` 很大，前端承载了过多业务规则。
  - 需要把“任务推进、消息流、回退裁决”逐步后移到后端。
- 当前本周原则：
  - 前端继续交付页面。
  - 但不再新增本地业务真相源。

## 2. 本周目标

- `ProblemDetail` 页面以后端接口为主。
- 消息时间线统一从后端读取。
- 新增消息改为追加，不再整段覆盖。
- 确认、修订、回退通过动作接口完成。
- 页面刷新后可恢复 `case`、`tasks`、`messages`。

## 3. 冻结边界

### 前端负责

- 页面展示。
- 消息渲染。
- 面板切换。
- 输入态和草稿态。
- 调用接口后刷新 UI。

### 前端不再负责

- 定义任务推进规则。
- 定义回退规则。
- 定义确认后如何跳转阶段。
- 新增本地 `localStorage` 业务真相。

## 4. 本周任务清单

### P0

- 完成“接口未鉴权暴露”排查，并修正前端仍在使用的未鉴权调用路径。
- 同时检查 `frontend` 和 `frontend-vue` 两个项目中的鉴权接线与接口调用方式。
- 新增：案例详情页路由必须携带后端标准 `caseId`，不再只依赖 `sessionStorage + createdAt` 恢复详情。
- 梳理 `ProblemDetail` 现有接口调用点。
- 替换消息新增主路径为 `POST /api/problem-cases/:caseId/messages`。
- 替换确认动作主路径为 `POST /api/problem-cases/:caseId/tasks/:taskId/confirm`。
- 替换修订动作主路径为 `POST /api/problem-cases/:caseId/tasks/:taskId/revise`。
- 替换回退动作主路径为 `POST /api/problem-cases/:caseId/tasks/:taskId/rollback`。
- 页面加载统一改为读取：
  - `case detail`
  - `task summaries`
  - `message timeline`
  - `caseId` 路由参数

### P1

- 统一消息渲染模型：
  - `role`
  - `type`
  - `content`
  - `payloadJson`
  - `confirmed`
- 删除或绕开“整段覆盖消息”的主路径依赖。
- 清点仍然依赖本地裁决的逻辑并标注风险。

### P2

- 收口 `ProblemDetail` 内的 `loading`、错误提示、空态。
- 补 UI 层联调记录。

## 5. 需要业务人员确认的内容

- 哪些结果卡必须本周可展示。
- 哪些 `task` 必须本周能跑通。
- 回退后页面预期长什么样。

## 6. 任务记录区

> 说明：前端 agent 每接到一个新任务，必须先在本区登记，再开始执行；不得只把内容混写进“每日更新区”。

### 记录规则

- 每个任务必须有独立记录。
- “每日更新区”保留给当天进展。
- “任务记录区”保留给任务维度追踪。
- 每次完成一个阶段，必须同时更新：
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
- 涉及项目：`frontend / frontend-vue`
- 目标结果：
- 已完成：
- 当前阻塞：
- 需要后端配合：
- 验证结果：
- 关闭条件：

### FE-20260325-01

- 任务编号：`FE-20260325-01`
- 日期：`2026-03-25`
- 任务标题：`P0：仅 task2（商业画布加载）taskCompletionConfirmBlock 三态与在线 confirm 失败回滚`
- 来源：`architect-owner / 用户`（范围收窄：不扩到全任务 `taskCompletionConfirmBlock` 统一重构）
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场验证 task2）`
- 涉及项目：`frontend`
- 目标结果：`区分 task2「两段式流程」（未点「已完成」停 task2 属正常）与「点了已完成但前端误显成功 / 失败不回滚」（B 类缺陷）；仅 task2 收口三态与最小日志`
- 已完成：
  - 根因 A：`renderProblemDetailChatFromStorage` 对 `taskCompletionConfirmBlock` 使用 `isTaskCompleted(task2)`，其与 `!!item.bmc` 等价，导致 BMC 已生成但未点「已完成」时按钮误为已完成态
  - 根因 B：在线 `.btn-task-complete-done` 在请求返回前即置「已完成」并禁用，失败分支未回滚 DOM，易误导
  - `frontend/main.js`：task2 渲染完成态改为 `msg.confirmed || taskCompleteBlock || completedStages 含 1`（不再用 `isTaskCompleted(task2)` 推断该块）
  - `frontend/main.js`：task2 在线点击后内存标记 `confirmInFlight`、整卡重绘为「提交中…」双按钮禁用（不落盘 inFlight）；成功走既有 `markTaskCompletionConfirmBlockConfirmed` + `refreshProblemDetailBundleFromBackend`；失败清除 inFlight、重绘、`showError`
  - `frontend/main.js`：`markTaskCompletionConfirmBlockConfirmed` 写回时清除 `confirmInFlight`
  - `frontend/main.js`：task2 专用 `console.info('[FE:task2-completion-confirm]', { taskId, confirmRequestStarted, confirmRequestSucceeded, isTaskCompletedTask2, firstUncompletedTaskId, ... })`
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无（沿用 POST .../tasks/task2/confirm 与 bundle 刷新）`
- 验证结果：`见下方「FE-20260325-01 最小回归（代码路径级）」`
- 关闭条件：`owner 现场按 3 条回归验证 task2 确认块与 task3 通知，无全任务扩散改造`

**FE-20260325-01 最小回归（代码路径级）**

| # | 场景 | 结果 |
| --- | --- | --- |
| 1 | 不点「已完成」（仅 BMC 已确认生成） | **通过（代码路径）**：`taskCompletionConfirmBlock(task2)` 主按钮仍为可点「已完成」，不因 `bmc` 单独存在而禁用 |
| 2 | 点「已完成」且在线 confirm 成功 | **通过（代码路径）**：请求中产「提交中…」；成功后 `confirmed` + bundle 刷新，`showTaskStartNotificationIfNeeded('task3')` |
| 3 | 点「已完成」但 confirm 失败 | **通过（代码路径）**：`confirmInFlight` 清除并重绘，主按钮恢复可点，`showError` 提示 |

**FE-20260325-01 最小日志示例（owner 可复制控制台）**

```text
[FE:task2-completion-confirm] { taskId: 'task2', confirmRequestStarted: true, confirmRequestSucceeded: false, isTaskCompletedTask2: true, firstUncompletedTaskId: 'task2' }
[FE:task2-completion-confirm] { taskId: 'task2', confirmRequestStarted: false, confirmRequestSucceeded: true, isTaskCompletedTask2: true, firstUncompletedTaskId: 'task3' }
```

### FE-20260325-02

- 任务编号：`FE-20260325-02`
- 日期：`2026-03-25`
- 任务标题：`P0：task3（需求逻辑构建）完成确认卡被 requirementLogic 误判完成，与节点仍停 task3 不一致`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场验证 task3）`
- 涉及项目：`frontend`
- 目标结果：`task3「输出已生成/已确认」≠「任务已完成」；完成确认卡禁用不得仅由 !!requirementLogic 触发；须与 completedStages 含 2（及在线 confirm 写回）一致；消除「按钮已禁用但节点仍 task3」`
- 已完成：
  - 根因：`isTaskCompleted(item,'task3')` 原为 `completed.includes(2) || !!item.requirementLogic`，需求逻辑已生成即误判 task3 已完成 → `taskCompletionConfirmBlock` 曾依赖 `isTaskCompleted` 时提前禁用
  - `frontend/main.js`：`case 'task3'` 仅 `completedStages.includes(2)`（后端 `applyCaseCompletionOnConfirm` 对 TASK_INDEX_STAGE0 写入 0..2）
  - `renderProblemDetailChatFromStorage`：`taskCompletionConfirmBlock` 对 task3 的 `taskAlreadyDoneFromState` 改为 `completedStages.includes(2)`（不再走含误判的 `isTaskCompleted`）
  - task3 在线「已完成」与 task2 同三态：`setTaskCompletionConfirmBlockInFlight('task2'|'task3')`、`confirmInFlight` 渲染「提交中…」、失败清除 inFlight + 重绘 + `showError`；`logTask3CompletionConfirmPhase` → `[FE:task3-completion-confirm]`
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无（沿用 POST .../tasks/task3/confirm）`
- 验证结果：`见下方「FE-20260325-02 最小回归（代码路径级）」`
- 关闭条件：`owner 现场按 3 条回归验证 task3，无全任务扩散改造`

**FE-20260325-02 最小回归（代码路径级）**

| # | 场景 | 结果 |
| --- | --- | --- |
| 1 | task3 输出已生成并确认（行业底层逻辑等按钮禁用）后，完成确认卡「已完成」仍可选 | **通过（代码路径）**：`taskAlreadyDoneFromState` 与 `isTaskCompleted(task3)` 均不以 `requirementLogic` 为真 |
| 2 | 点击「已完成」且在线 confirm 成功 | **通过（代码路径）**：`completedStages` 含 2、bundle 刷新后 `getFirstUncompletedTask` 推进；请求中显示「提交中…」 |
| 3 | 点击「已完成」但 confirm 失败 | **通过（代码路径）**：清除 `confirmInFlight`、重绘恢复可点、`showError` |

**FE-20260325-02 最小日志示例（owner 可复制控制台）**

```text
[FE:task3-completion-confirm] { taskId: 'task3', isTaskCompleted: false, completedStages: [0, 1], hasRequirementLogic: true, firstUncompletedTaskId: 'task3', confirmRequestStarted: true, confirmRequestSucceeded: false }
[FE:task3-completion-confirm] { taskId: 'task3', isTaskCompleted: true, completedStages: [0, 1, 2], hasRequirementLogic: true, firstUncompletedTaskId: 'task4', confirmRequestStarted: false, confirmRequestSucceeded: true }
```

### FE-20260325-03

- 任务编号：`FE-20260325-03`
- 日期：`2026-03-25`
- 任务标题：`P0：task4/5/6 工作流对齐 — 输出生成/输出确认与 workflowAlignCompletedStages 完成态解耦`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场验证 task4–task6）`
- 涉及项目：`frontend`
- 目标结果：`输出已生成、输出已确认 ≠ 任务已完成；`workflowAlignCompletedStages` 仅在用户点击「是否视为完成 → 已完成」且 online confirm 成功（或 local `advanceProblemStateOnTaskComplete`）后写入；`taskCompletionConfirmBlock(task4|5|6)` 三态 + 失败回滚；工作区 IT 现状展示在 VS 已有数据时可用（`valueStreamHasAnyItStatus`），不依赖 wf 提前含 1`
- 已完成：
  - 根因：`updateDigitalProblemValueStream` / `ItStatus` / `PainPoint`（及 task4/5/6 内存态）在输出链路中顺带写入 `workflowAlignCompletedStages`，而 `isTaskCompleted(task4|5|6)` 依赖该数组 → 完成确认卡提前禁用（与 task2/bmc、task3/requirementLogic 同类）
  - `frontend/js/storage.js`（含 online/IndexedDB 适配分支）：上述三函数仅更新 `valueStream`；新增 `updateDigitalProblemWorkflowAlignCompletedStages` 供「任务真正完成」时显式写入
  - `frontend/main.js`：`advanceProblemStateOnTaskComplete` 对 task4/5/6 改为 `ValueStreamDataOnly` + `updateDigitalProblemWorkflowAlignCompletedStages`（合并 0 / 0–1 / 0–1–2）；`drawValueStream` 确认、`task4ValueStream.js` / `task5ItStatus.js` / `task6PainPoint.js` 去掉对 wf 的提前合并；`buildWorkflowAlignDisplayValueStream` 中 `allowItStatus` 增加 `valueStreamHasAnyItStatus`；task4–6 纳入 `confirmInFlight` + `logWorkflowAlignTaskCompletionConfirmPhase` → `[FE:workflow-align-task-completion-confirm]`
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无（沿用 POST .../tasks/task4|task5|task6/confirm）`
- 验证结果：`见下方「FE-20260325-03 最小回归（代码路径级）」`
- 关闭条件：`owner 现场逐任务验证输出确认后完成卡仍可点、confirm 成功后才推进下一任务、失败可恢复`

**FE-20260325-03 最小回归（代码路径级）**

| 任务 | 场景 | 结果 |
| --- | --- | --- |
| task4 | 价值流输出已确认后 | **通过（代码路径）**：`workflowAlignCompletedStages` 未因落库抢先含 0；完成确认「已完成」可点；confirm 成功后 wf 含 0、`firstUncompleted` 可至 task5 |
| task5 | IT 现状输出已确认后 | **通过（代码路径）**：落库不抢先写 wf 含 1；完成确认可点；成功后 wf 含 0–1、可至 task6 |
| task6 | 痛点输出已生成/确认后 | **通过（代码路径）**：落库不抢先写 wf 含 2；完成确认可点；成功后 wf 含 0–1–2、可至 task7 |
| 共性 | confirm 失败 | **通过（代码路径）**：`confirmInFlight` 清除、按钮恢复、`showError` |

**FE-20260325-03 最小日志示例（owner 可复制控制台）**

```text
[FE:workflow-align-task-completion-confirm] { taskId: 'task5', workflowAlignCompletedStages: [0], isTaskCompleted: false, firstUncompletedTaskId: 'task5', confirmRequestStarted: true, confirmRequestSucceeded: false }
[FE:workflow-align-task-completion-confirm] { taskId: 'task5', workflowAlignCompletedStages: [0, 1], isTaskCompleted: true, firstUncompletedTaskId: 'task6', confirmRequestStarted: false, confirmRequestSucceeded: true }
```

### FE-20260325-04

- 任务编号：`FE-20260325-04`
- 日期：`2026-03-25`
- 任务标题：`P0：task5（IT 现状标注）重复输出卡 + 完成确认后无法稳定流转 task6`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场验证 task5）`
- 涉及项目：`frontend`
- 目标结果：`itStatusCard 仅出现一次；输出生成不等价任务完成、不在该时机推进下一任务；用户点输出确认 → 完成确认卡 →「已完成」且 confirm 成功后才可至 task6；失败不假推进`
- 已完成：
  - 根因 A：`task5ItStatus.js` 同时 `pushAndSaveProblemDetailChat({ type: 'itStatusCard' })` 与手写 `appendChild(cardBlock)` → 双渲染路径重复卡
  - 根因 B：`runItStatusAnnotation` 末尾调用 `showNextTaskStartNotification`，在输出刚生成时干扰「输出确认 / 任务已完成」语义边界（与 task6 启动通知链竞态）
  - `frontend/js/task5ItStatus.js`：移除手写 DOM；`pushAndSave` 后 `innerHTML=''` + `renderProblemDetailChatFromStorage`；去掉输出生成末尾的 `showNextTaskStartNotification`；新增 `[FE:task5-after-output]`（`itStatusCardCount`、`workflowAlignCompletedStages`、`isTaskCompletedTask5`、`firstUncompletedTaskId`）
  - `frontend/main.js`：`window.renderProblemDetailChatFromStorage` / `window.isTaskCompleted` / `window.getFirstUncompletedTask`（供 task5 模块日志）；`taskCompletionConfirmBlock` 对 task5 的 `taskAlreadyDoneFromState` 显式为 `workflowAlignCompletedStages.includes(1)`（与 FE-20260325-03 的 wf 语义一致）
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无`
- 验证结果：`见下方「FE-20260325-04 最小回归（代码路径级）」`
- 关闭条件：`owner 现场按 4 条回归验证 task5，无扩散改造`

**FE-20260325-04 最小回归（代码路径级）**

| # | 场景 | 结果 |
| --- | --- | --- |
| 1 | task5 大模型返回后聊天区 IT 现状 JSON 卡 | **通过（代码路径）**：仅一条 `itStatusCard` 主路径渲染，`[FE:task5-after-output].itStatusCardCount === 1` |
| 2 | 点击输出卡「确认」后完成确认块可点「已完成」 | **通过（代码路径）**：未提前写 wf 含 1 时完成块不因误判禁用（task5 分支显式 wf） |
| 3 | 点「已完成」且在线 confirm 成功 | **通过（代码路径）**：沿用 FE-20260325-03 链，`showNextTaskStartNotification` 推进 task6 |
| 4 | confirm 失败 | **通过（代码路径）**：workflow-align 三态回滚，不假推进 |

**FE-20260325-04 最小日志示例（owner 可复制控制台）**

```text
[FE:task5-after-output] { itStatusCardCount: 1, workflowAlignCompletedStages: [0], isTaskCompletedTask5: false, firstUncompletedTaskId: 'task5' }
```

### FE-20260326-04

- 任务编号：`FE-20260326-04`
- 日期：`2026-03-26`
- 任务标题：`P1：Google Fonts 外链清扫与离线字体栈收口`
- 来源：`architect-owner / 用户`
- 优先级：`P1`
- 当前状态：`待验证`
- 涉及项目：`frontend`
- 目标结果：`移除首页与售前报告页对 fonts.googleapis.com / fonts.gstatic.com 的依赖；页面正文与 Mermaid 图统一切到本地中文系统字体栈，确保外网不可达时不再阻塞字体加载。`
- 已完成：
  - `frontend/index.html`、`frontend/report.html`：删除 Google Fonts `preconnect` 与 `stylesheet` 外链
  - `frontend/styles.css`：`--font` 改为本地中文系统字体栈（`PingFang SC` / `Hiragino Sans GB` / `Microsoft YaHei` / `Segoe UI` / `system-ui`）
  - `frontend/css/report.css`：报告页正文字体改为复用 `var(--font)`，并在文件头补充 FE-20260326-04 说明
  - `frontend/js/report-page.js`：Mermaid `themeVariables.fontFamily` 改为本地中文系统字体栈
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无`
- 验证结果：`已做仓库复查：git grep "fonts.googleapis.com|fonts.gstatic.com" -- frontend frontend-vue 无命中；git grep "Noto Sans SC" -- frontend frontend-vue 无命中。待用户补页面视觉验收。`
- 关闭条件：`仓库内不再存在业务前端对 fonts.googleapis.com / fonts.gstatic.com 的直接引用；页面样式与 Mermaid 图改为本地字体栈；完成一次全仓复查并同步文档。`

### FE-20260324-57

- 任务编号：`FE-20260324-57`
- 日期：`2026-03-24`
- 任务标题：`P0：task10 已流转 task11 后，task10 完成确认卡片仍高亮待确认`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场验证）`
- 涉及项目：`frontend`
- 目标结果：`当 task10 已完成且当前首个未完成任务已是 task11 时，聊天区历史的 task10 完成确认卡片必须显示已确认/非高亮，不再误导为待确认`
- 已完成：
  - 根因定位：在线模式点击 task10「已完成」后，确认分支未调用 `markTaskCompletionConfirmBlockConfirmed('task10')`，导致 `taskCompletionConfirmBlock.confirmed` 可能不写回；同时渲染 `taskCompletionConfirmBlock` 仅依赖 `taskCompleteBlock`，未参考 `msg.confirmed` 与 `isTaskCompleted(item,'task10')`
  - 补充根因（owner 现场复核）：`rolePermissionAllDoneBlock`（文案「全部环节已推演完毕，请逐项确认各卡片」）点击 `.btn-role-permission-confirm-all` 后仅写了 `allConfirmed`，未统一写 `confirmed`；且渲染仅按 `allConfirmed` 判禁用，未把 task10 已完成/已流转 task11 纳入收口判定，导致刷新后仍可能高亮
  - `frontend/main.js`：在线 confirm 成功后补 `markTaskCompletionConfirmBlockConfirmed(taskId)`，确保任务完成确认块写回 `confirmed: true`
  - `frontend/main.js`：新增 `markRolePermissionAllDoneBlockConfirmed()`；task10 在线 confirm 成功后同步回写 `rolePermissionAllDoneBlock.confirmed=true` + `allConfirmed=true`
  - `frontend/main.js`：点击 `.btn-role-permission-confirm-all` 后，`rolePermissionAllDoneBlock` 写回从仅 `allConfirmed` 改为 `allConfirmed + confirmed` 双写并保存
  - `frontend/main.js`：`renderProblemDetailChatFromStorage` 渲染 `rolePermissionAllDoneBlock` 时，收口判定改为 `msg.allConfirmed || msg.confirmed || isTaskCompleted(task10) || firstUncompletedTask.id==='task11'`，满足即按已确认态（按钮禁用、非高亮）
  - `frontend/main.js`：`renderProblemDetailChatFromStorage` 渲染 `taskCompletionConfirmBlock` 时，完成态改为三源合并：`msg.confirmed` 或 `isTaskCompleted(...)` 或历史 `taskCompleteBlock` 任一成立即按已完成态（按钮禁用，结束高亮误导）
  - `frontend/main.js`：新增/补充 owner 最小日志 `[FE:task-completion-confirm-sync]`，输出 `taskCompletionConfirmBlockConfirmed`、`rolePermissionAllDoneBlockConfirmed`、`rolePermissionAllDoneBlockAllConfirmed`、`isTaskCompleted`、`firstUncompletedTaskId`
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无（本轮纯前端）`
- 验证结果：`见下方「FE-20260324-57 最小回归（代码路径级）」`
- 关闭条件：`owner 现场确认 task10 已流转 task11 后，task10 完成确认卡片为已确认/非高亮，且 task11 启动通知与上下文不受影响`

**FE-20260324-57 最小回归（代码路径级）**

| # | 场景 | 结果 |
| --- | --- | --- |
| 1 | 点击「确认所有」后 rolePermissionAllDoneBlock 状态 | **通过（代码路径）**：写回 `rolePermissionAllDoneBlock.confirmed=true` + `allConfirmed=true`，按钮立即禁用，不再高亮 |
| 2 | task10 已完成并流转 task11 后重渲染/刷新 | **通过（代码路径）**：即使历史块未双写，渲染仍按 `isTaskCompleted(task10)`/`firstUncompletedTask.id==='task11'` 收口为已确认态 |
| 3 | 两张卡并存状态 | **通过（代码路径）**：`taskCompletionConfirmBlock(task10)` 与 `rolePermissionAllDoneBlock` 均保持已确认/非高亮，task11 启动链不受影响 |

### FE-20260324-19

- 任务编号：`FE-20260324-19`
- 日期：`2026-03-24`
- 任务标题：`P0：在线版售前分析报告（v1）— 独立 report.html + 聚合接口 + Mermaid + 正式报告级内容渲染闭环（薄复用）`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场联调聚合接口与验收）`
- 涉及项目：`frontend`
- 目标结果：`frontend/report.html?caseId=...` 为登录后正式交付视图；仅调用 `GET /api/problem-cases/:id/report`；五模块空态不编造；**各模块须将已有结构化数据渲染为可讲解的正式报告内容**；需求洞察按 report `demandInsight` 字段映射；ITGap 解包 `globalItGap.analysis`；业务对象列表为报告摘要 DTO；价值流复用 `valueStream.js`；关联图仅在有 **边** 时绘制 Mermaid，无边为正式空态；`[FE:report-snapshot]` 受控日志；首页卡片与案例详情入口新标签页打开
- 已完成：
  - 承载文件：`frontend/report.html`、`frontend/css/report.css`、`frontend/js/report-page.js`、`frontend/js/report-formal-render.js`、`frontend/js/report-global-itgap-render.js`；Mermaid 使用 `cdn.jsdelivr.net/npm/mermaid@10`；报告页样式以 `report.css` 叠在 `styles.css` 上；**薄复用**主站 `vs-*`、`problem-detail-global-itgap-*` 等类名语义；需求洞察/业务对象列表为报告专用 DOM（不再硬塞 preliminary / CBO 工作区卡）
  - `frontend/js/auth-runtime.js`：`report.html` 与 `index.html` 同级首屏无 token 跳转 `login.html?auth_reason=gate`
  - `frontend/main.js`：`openPresalesReportPageForCaseId`；`#btnProblemCasePresalesReport`；`updateProblemCaseImportExportUiState` 与导入/导出一致在非 online 禁用报告按钮
  - **入口补记（FE-20260324-19）**：首页卡片虽然已渲染 `.btn-problem-follow-presales-report`，但 `#problemFollowListContent` click 委托当时仅覆盖 copy/start，导致按钮可见但点击无反应；本轮已补委托分支，按 `data-case-key` 命中案例后取 `caseId = item.id ?? item.createdAt`，并复用 `openPresalesReportPageForCaseId(caseId)` 打开报告页
  - `frontend/index.html`：详情进度条区「售前分析报告」按钮（在「导出」左侧）
  - `frontend/styles.css`：`.btn-problem-case-presales-report`、`.btn-problem-follow-presales-report`（卡片内独占一行）
  - `frontend/AGENTS.md`：成员清单同步
  - **DTO 消费对齐（补充）**：`normalizeReportPayload` 与后端冻结 DTO 一致——`demandInsight`、`valueStream`、`globalItGap`、`businessObjects.items` + `businessObjects.graph`、`reportMeta`；Mermaid 节点与边解析兼容 `node.key` / `node.id`
  - **正式渲染闭环（收口）**：`demandInsight` → `enterpriseCustomerBackground` / `preliminaryNeedsAndChallenges` / `requirementLogicSections`（四段 Markdown）；`valueStream` → `renderValueStreamViewHTML` / `renderEndToEndFlowHTML`；`globalItGap` → 解包 `analysis` 后 `reportGlobalItGapBuildWorkspaceHtml`（四阶段 + 非标准键 `buildGlobalItGapGenericHtml`）；`businessObjects.items` → 报告摘要卡（`key`/`name`/`usage`/`category`/`keyFieldsSummary`，默认展开无折叠）；`graph` → `edges.length===0` 正式空态，否则 Mermaid + `themeVariables` 报告风
  - **脚本依赖**：`report.html` 仅加载 `valueStream.js` + ITGap/报告渲染脚本（不加载 `preliminaryRequirement.js` / `coreBusinessObject.js`）
  - **owner 日志**：`window.__FE_REPORT_SNAPSHOT_LOG !== false` 时 `console.info('[FE:report-snapshot]', { demandInsight, globalItGap, businessObjectsItemsLen, graphNodes, graphEdges })`
  - **价值流报告样式回退（owner 口径）**：`report.css` 撤销对 `vs-*` 组件内部类的报告页覆盖（节点色、标题条、痛点块、内层边框/字号/阴影等），恢复组件原有视觉；仅保留外层容器可控项（区块 breakout、`#reportValueStream` 横向滚动、外层宽度与间距、包裹策略）。
  - **入口缺口补记（FE-20260324-19）**：owner 现场确认 report 页价值流区缺失 IT 现状标注；根因是报告 DTO 已给 `step.itStatusLabel`，但报告页复用链未确保其映射到价值流组件可见字段。本轮在 `report-formal-render.js` 增加报告专属归一：当 step 仅有 `itStatusLabel` 时补写 `step.itStatus` 再渲染，确保「阶段/环节 + IT 现状 + 痛点」三者同显；并在 `report-page.js` 增加 `[FE:report-value-stream]` 最小日志（`stage0Steps` + `renderedItStatusCount`）
- 当前阻塞：`无代码阻塞；owner 验收以当前前后端 DTO 对齐为准`
- 需要后端配合：`GET /api/problem-cases/:id/report` 返回 JSON；**冻结 DTO（前端已主路径消费）**：顶层 `demandInsight`、`valueStream`、`globalItGap`、`businessObjects: { items, graph }`、`reportMeta`；边端点与节点 `key`/`id` 一致即可连线
- 验证结果：`见下方「FE-20260324-19 最小回归（代码路径级）」`
- 关闭条件：`owner 现场确认：两入口新标签页打开、五模块正式内容渲染（非 raw JSON 主路径）、空态、401/403、关联图 Mermaid 嵌入；后端聚合接口可用时全链路通过`

**FE-20260324-19 最小回归（代码路径级）**

| # | 场景 | 结果 |
| --- | --- | --- |
| 1 | 语法 | `node --check frontend/js/report-page.js` 与 `node --check frontend/main.js` 通过 |
| 2 | 入口 | `openPresalesReportPageForCaseId` 使用 `new URL('report.html', location.href)` + `caseId` query，与导出同属 online 门禁 |
| 3 | 401 | `report-page.js` 在 `res.status===401` 时调用 `handleAuthError(401, …)`（与 auth-runtime 一致） |
| 4 | 403 | 调用 `handleAuthForbidden` + 页面 `reportLoadError` 提示 |
| 5 | 非 2xx | 各模块回退 `待完善/暂无数据` + 顶部 load 错误文案（不编造业务内容） |
| 6 | 既有工作台 | 未改 `ProblemDetail` 工作区 DOM 结构；仅增顶栏按钮与列表卡片按钮 |
| 7 | 真实接口 | **待现场**：需后端 `GET …/report` 部署后浏览器验证 |
| 8 | DTO 对齐 | **通过（代码路径）**：`demandInsight`/`valueStream`/`businessObjects.items`/`businessObjects.graph`/`reportMeta`；图 `key`+`id` 双兼容 |
| 9 | 语法（正式渲染脚本） | `node --check` 通过：`report-formal-render.js`、`report-global-itgap-render.js`（与 `report-page.js` 一并校验） |
| 10 | owner 快照日志 | 默认输出 `[FE:report-snapshot]`（`demandInsight`、`globalItGap`、`businessObjectsItemsLen`、`graphNodes`、`graphEdges`）；`window.__FE_REPORT_SNAPSHOT_LOG === false` 关闭 |
| 11 | 首页卡片报告入口 | **通过（代码路径）**：`#problemFollowListContent` 新增 `.btn-problem-follow-presales-report` 委托分支，`data-case-key -> item -> item.id ?? item.createdAt -> openPresalesReportPageForCaseId` |
| 12 | 价值流 IT 现状标注 | **通过（代码路径）**：报告页价值流渲染前将 `step.itStatusLabel` 映射到 `step.itStatus`（仅 report 链），渲染后可命中 `.vs-step-meta-it-status`；痛点 `.vs-step-pain-point-card` 保持不变 |

**五模块空态策略（实现口径）**

| 模块 | 空态 |
| --- | --- |
| 需求洞察 | 无可用字段或空对象/空串 → 展示「待完善 / 暂无数据」 |
| 价值流与痛点标注 | 同上 |
| 全局 ITGap 分析 | 同上 |
| 业务对象列表 | 非数组或长度为 0 → 同上；有数据时渲染报告摘要卡（`key`/`name`/`usage`/`category`/`keyFieldsSummary`） |
| 业务对象关联图 | `graph.edges.length===0` → 正式「关系待完善」空态，不绘制孤立节点；有边时仅渲染参与边的节点；渲染失败时源码 `pre` 兜底 |

### FE-20260324-20

- 任务编号：`FE-20260324-20`
- 日期：`2026-03-24`
- 任务标题：`P0：task11 节点级 checkpoint 接线（v1.5 最小方案）`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场联调）`
- 涉及项目：`frontend`
- 目标结果：`task11 每个 step 完成后立即写后端节点接口；切页/刷新恢复优先以后端 coreBusinessObjectSessions；聊天 coreBusinessObjectSessionsBlock 仅作为展示辅助`
- 已完成：
  - `frontend/main.js` 新增 `putProblemCaseTask11StepCheckpoint(caseId, stepIndex, payload)`，接线 `PUT /api/problem-cases/:id/tasks/task11/steps/:stepIndex`（带鉴权头与 401/403 统一处理）
  - `runCoreBusinessObjectForNextStep`（手工单步）每个 step 生成后立即调用 step checkpoint；成功后优先采用后端返回 `coreBusinessObjectSessions` 回填当前详情态/列表态
  - `runCoreBusinessObjectAutoSequential`（自动顺序）每个 step 生成后立即调用 step checkpoint；逐步持久化，不再只依赖聊天块回放
  - `resolveMergedCoreBusinessObjectSessions` 调整为“后端优先恢复”：先读详情/列表中的 `coreBusinessObjectSessions`，聊天 `coreBusinessObjectSessionsBlock` 仅兜底展示
  - 增加 `extractTask11SessionsArray`、`syncTask11SessionsToFrontendState`，兼容后端 array / `{ sessions }` 两种形态，降低刷新时旧聊天块覆盖新后端值风险
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`后端已提供 step checkpoint 接口；仅需 owner 现场联调确认运行态`
- 验证结果：`见下方「FE-20260324-20 最小回归（代码路径级）」`
- 关闭条件：`owner 现场确认四个回归场景通过（step0/step1 持久化、切页刷新恢复、自动顺序续跑）`

**FE-20260324-20 最小回归（代码路径级）**

| # | 场景 | 结果 |
| --- | --- | --- |
| 1 | step0 完成后立即可从后端 GET 看见 | **通过（代码路径）**：step0 生成后立即 `PUT /tasks/task11/steps/0`，后端返回 sessions 并回填前端状态 |
| 2 | step1 完成后不会覆盖 step0 | **通过（代码路径）**：step1 走 `PUT /steps/1` 节点增量写；后端契约已覆盖“更新目标 step 不覆盖其它 step” |
| 3 | 中途切页/刷新再回来仍能看到已完成 step | **通过（代码路径）**：恢复优先读取后端 `coreBusinessObjectSessions`（详情/列表），聊天块仅兜底 |
| 4 | 自动顺序执行可从已完成节点后继续 | **通过（代码路径）**：每步成功后即时 checkpoint，下一步索引由后端优先 sessions 判定，不再依赖聊天块主导 |

### FE-20260324-18

- 任务编号：`FE-20260324-18`
- 日期：`2026-03-24`
- 任务标题：`P0：frontend-vue 与 classic frontend 对齐 — token 续期头（requestJson + login）`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场复验）`
- 涉及项目：`frontend-vue`
- 目标结果：`受保护请求与登录成功响应读取 X-Auth-Token / X-Auth-Expires-At 写回 smart_cto_auth_token、smart_cto_auth_expires_at；语义与 frontend/js/auth-runtime.js 的 applyAuthRenewalFromResponse 一致（不做剩余时间判断，有头则覆盖）；401/403 行为本轮不变`
- 已完成：
  - 核验 `frontend-vue/src/api/client.ts`：`requestJson()` 在 `res.ok` 时已调用 `applyAuthRenewalFromHeaders(res)`（与 auth-runtime 对齐）
  - 补齐唯一不走 `requestJson()` 的入口：`backendApi.login()` 在登录成功后追加 `applyAuthRenewalFromHeaders(res)`（`/auth/login` 直连 fetch）
  - 全仓 `frontend-vue/src` 除 `client.ts` 外无其它 `fetch` 受保护请求入口（`AdminPage.vue` 仅经 `backendApi`）
  - `frontend-vue/AGENTS.md`：`client.ts` 成员说明同步
  - `npm run build`（frontend-vue）通过
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无（续期头与 CORS exposedHeaders 沿用既有 backend/src/app.ts）`
- 验证结果：`见下方「FE-20260324-18 最小回归（代码路径级）」`
- 关闭条件：`owner 现场确认：管理端或登录 online 成功后 Network 可见续期头时 localStorage 同步更新；刷新不因 Vue 侧未接续期而提前掉登录`

**FE-20260324-18 最小回归（代码路径级）**

| # | 场景 | 结果 |
| --- | --- | --- |
| 1 | 受保护 `requestJson` 成功（如 `GET /admin/users`） | **通过（代码路径）**：`res.ok` 为真时执行 `applyAuthRenewalFromHeaders`，若响应含 `X-Auth-Token`/`X-Auth-Expires-At` 则覆盖 `localStorage` 对应键 |
| 2 | `smart_cto_auth_expires_at` | **通过（代码路径）**：续期头非空时 `localStorage.setItem(AUTH_EXPIRES_AT_KEY, …)`，与 auth-runtime 一致 |
| 3 | online `login` 成功且响应带续期头 | **通过（代码路径）**：`login()` 在 `!res.ok` 抛出后、`return` 前调用 `applyAuthRenewalFromHeaders`；随后 `LoginPage` `signIn` 仍以 body `token` 写入（续期头可补充 `expires_at`，与主站行为一致） |

### FE-20260324-17

- 任务编号：`FE-20260324-17`
- 日期：`2026-03-24`
- 任务标题：`P0：401/403 鉴权交互分离 — 403 仅提示不清 token、401 维持跳登录`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场复验）`
- 涉及项目：`frontend`、`frontend-vue`
- 目标结果：`401` 仍 `clearAuth` + `login.html?auth_reason=auth`；`403` 不清 token、不跳转，优先展示后端 `message`，否则默认「权限不足或当前账号不可用，请联系管理员」；同文案 2.5s 内去重；`401` 保留 `[FE:auth-401]`（需 `__FE_AUTH_DEBUG`）；`403` 始终 `[FE:auth-403]` + 页面提示
- 已完成：
  - `frontend/js/auth-runtime.js`：拆分 `handleAuthForbidden`；`handleAuthError(401)` 仅 401 清 token+跳转；`handleAuthError(403)` 走禁止提示；导出 `global.handleAuthForbidden`
  - `frontend/js/api.js`、`frontend/js/storage-http-adapter.js`：仍统一调 `handleAuthError(status, …)`（内部已分岔）；Header 注释更新
  - `frontend/main.js`：`postProblemCaseTaskAction` 对 401/403 解析 body `message` 并透传 `source: main:postProblemCaseTaskAction`
  - `frontend-vue/src/api/client.ts`：`403` 调 `handleAuthForbidden`；`401` 维持原行为
  - `frontend/login.html`、`frontend/admin.html` 与 `frontend-vue/login.html`、`frontend/admin.html`：在 config 后增加 `js/auth-runtime.js`；`vite.config.ts` 构建前从 `frontend/js` 同步至 `public/js`
  - `frontend/AGENTS.md`、`frontend-vue/AGENTS.md`：成员清单同步
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无（本轮不改后端状态码语义）`
- 验证结果：`见下方「FE-20260324-17 最小回归（代码路径级）」`
- 关闭条件：`owner 现场确认 401 仍跳登录、403 不跳且 token 仍在、403 有明确提示、连续 403 不连环弹`

**FE-20260324-17 最小回归（代码路径级）**

| # | 场景 | 结果 |
| --- | --- | --- |
| 1 | 401 | **通过（代码路径）**：`handleAuthError(401)` → `clearAuth` + `auth_reason=auth`；调试下首条 `[FE:auth-401]` |
| 2 | 403 | **通过（代码路径）**：不清 token、不跳转；`[FE:auth-403]` + `showError`/`alert`；同文案 2.5s 内仅一次提示 |
| 3 | 403 后 token | **通过（代码路径）**：`localStorage` 中 `smart_cto_auth_token` 未被 `clearAuth` 清除 |
| 4 | Vue 管理端 | **通过（代码路径）**：`client.ts` 403 走 `handleAuthForbidden`；构建 `npm run build` 已通过 |

### FE-20260324-16

- 任务编号：`FE-20260324-16`
- 日期：`2026-03-24`
- 任务标题：`P0：刷新后误跳登录 — 诊断链 + 续期链收口（frontend + frontend-vue）`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场复验）`
- 涉及项目：`frontend`、`frontend-vue`
- 目标结果：`区分首屏门禁（无 token）与 401/403 清 token 跳转；受控诊断日志；online 受保护请求统一接续期头；Vue client 与 auth-runtime 行为对齐`
- 已完成：
  - `frontend/js/auth-runtime.js`：`__FE_AUTH_DEBUG === true` 或 `APP_CONFIG.FE_AUTH_DEBUG` 时输出 `[FE:auth-refresh]`（hasToken/hasExpiresAt/pathname）、`[FE:auth-gate]`（首屏无 token）、`[FE:auth-401]`（首次 401/403，含 url/message）；登录跳转增加 `auth_reason=gate|auth`（及 `auth_status`）
  - `frontend/js/storage-http-adapter.js`：`authErrorFromRes` 向 `handleAuthError` 透传 URL 与 body message
  - `frontend/js/api.js`、`frontend/main.js`：`handleAuthError` 第二参数 `{ url, message? }`
  - `frontend-vue/src/api/client.ts`：成功响应读取 `X-Auth-Token`/`X-Auth-Expires-At` 写回 localStorage；401 清 `smart_cto_auth_expires_at`；`[FE:auth-401]` 与 `auth_reason=auth` 对齐
  - `frontend/AGENTS.md`、根目录 `AGENTS.md`：成员清单同步
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无（续期头契约沿用既有 jwt.middleware）`
- 验证结果：`见下方「FE-20260324-16 回归与现场诊断」`
- 关闭条件：`owner 现场确认：有效 token 下刷新不无故跳登录；`__FE_AUTH_DEBUG` 下能明确是 gate 还是首个 401；Vue 管理端请求后 Network 可见续期头写回 localStorage`

**FE-20260324-16 回归与现场诊断**

| 场景 | 代码/构建结论 | 现场需确认 |
| --- | --- | --- |
| 刷新后仍留在业务页（token 有效） | `npm run build`（frontend-vue）通过；续期链在 `storage-http-adapter`/`api.js`/Vue `client.ts` 已对齐 | 登录后 F5 `index.html` 不跳登录 |
| 首个受保护请求成功后 token 可被续期头覆盖 | `applyAuthRenewalFromResponse` / `applyAuthRenewalFromHeaders` 在 2xx 上执行 | Network 响应含 `X-Auth-Token` 时 localStorage 更新 |
| 区分两类跳转 | URL：`auth_reason=gate`（无 token 门禁）vs `auth_reason=auth`（401/403）；控制台 `[FE:auth-gate]` vs `[FE:auth-401]` | 与现象一致 |

**现场排查步骤（owner）**：控制台执行 `window.__FE_AUTH_DEBUG = true` 后强制刷新 → 看首条 `[FE:auth-refresh]`；若随后跳登录，看是否出现 `[FE:auth-gate]` 或 `[FE:auth-401]` 及其中 `url`。

### FE-20260323-07

- 任务编号：`FE-20260323-07`
- 日期：`2026-03-23`
- 任务标题：`修复详情页初步需求卡片字段读空（preliminaryReq + 顶层回退统一入口）`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场复验）`
- 涉及项目：`frontend`
- 目标结果：`详情页「初步需求」卡片与首页「解析预览」字段一致，补齐 `preliminaryReq + 顶层` 合成读取，修复「可二期或后续」等字段在详情页为空的问题，不破坏「总结提炼/历史详情」Tab 语义`
- 已完成：
  - `frontend/js/preliminaryRequirement.js` 新增 `buildResolvedPreliminaryRequirement(item)`，统一合并来源：`item.preliminaryReq`、顶层 `customerName/customerNeedsOrChallenges/customerItStatus/projectTimeRequirement`、`operationModel`、`businessStatus`、`urgencyAnalysis`、`requirementDetail/requirement_detail`
  - `buildPreliminaryCardRowsHtml(...)` 改为先使用合成后的 preliminary 对象再渲染，修复 `urgencyAnalysis.deferredFeatures`、`operationModel.businessProcess/orgStructure`、`businessStatus` 等详情页空值
  - `buildPreliminaryPreContent(...)` 改为返回合成后的 preliminary 对象（含 requirementDetail）
  - `buildPreliminarySummaryJson(...)` 改为基于同一合成入口生成（继续不含 requirementDetail，保持「总结提炼」语义）
  - `buildPreliminaryHistoryHtml(...)` 在无 `requirementDetailHistory` 时回退到合成对象的 `requirementDetail`，保持「历史详情」语义
  - 预留最小日志（`[FE:preliminary-resolve]`）：打印 `item.preliminaryReq`、`item.urgencyAnalysis`、`buildResolvedPreliminaryRequirement(item)`、以及「可二期或后续」最终值
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无（本轮纯前端修复）`
- 验证结果：`见本次回报中的 4 场景最小回归（代码路径级）`
- 关闭条件：`owner 在现场数据中确认：首页预览有「可二期或后续」时，详情页初步需求卡片同字段也有值，且 requirementDetail 仍仅在历史详情语义下展示`

### FE-20260323-08

- 任务编号：`FE-20260323-08`
- 日期：`2026-03-23`
- 任务标题：`紧急修复：basicInfo 夹带 __createContractExtras 导致 task1 误判完成`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场复验）`
- 涉及项目：`frontend`
- 目标结果：`当 basicInfo 仅包含 __createContractExtras（如 requirementDetail/operationModel 等）时，不再把 task1 判定为已完成，不再直接推进到商业画布加载；仅在存在真实客户基本信息字段时，才允许补齐 task1 完成态`
- 已完成：
  - `frontend/main.js` 新增 `hasTask1BasicInfoFields(basicInfo)` 统一判断入口，至少检查这些字段是否存在非空值：`company_name`、`credit_code`、`legal_representative`、`established_date`、`registered_capital`、`business_scope`、`core_qualifications`、`official_website`
  - `openProblemDetail(...)`：原“`if (item.basicInfo)` 自动补 `completedStages[0]`”改为“仅当 `hasTask1BasicInfoFields(item.basicInfo)` 为真才补齐”
  - `isProblemResetState(item)`：原 `!item.basicInfo` 改为 `!hasTask1BasicInfoFields(item.basicInfo)`，避免 extras 误判“非重置态”
  - `advanceProblemStateOnTaskComplete(createdAt, 'task1')`：补防御，仅在 `hasTask1BasicInfoFields(item.basicInfo)` 为真时才调用 `updateDigitalProblemBasicInfo(...)` 写入 task1 完成态
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无（本轮前端防御修复）`
- 验证结果：`见本次回报中的 3 个最小回归场景`
- 关闭条件：`owner 现场确认：basicInfo 仅 extras 不会触发 task1 完成；客户基本信息为空时仍停 task1；真实基本信息生成并确认后才推进 task2`

### FE-20260323-09

- 任务编号：`FE-20260323-09`
- 日期：`2026-03-23`
- 任务标题：`高优先级修复：task1 首次进入通知不稳定 + Agent 模式输入误拦截`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场复验）`
- 涉及项目：`frontend`
- 目标结果：`只要当前案例尚未完成 task1，首次进入详情必须稳定下发 task1 启动通知；Agent 模式输入企业/工商信息时允许直接触发 task1 自动提炼，不再误拦截到“确认/修正/讨论”提示`
- 已完成：
  - `frontend/main.js`：新增 `ensureTask1StartNotificationIfPending(reason)`，在 `openProblemDetail` 双 rAF 后、`refreshProblemDetailBundleFromBackend` 成功后、`storageBackendReady` 回调后补发兜底；仅当“当前仍是 task1 且聊天中尚无 task1 启动通知”才补发
  - `frontend/main.js`：新增 `looksLikeTask1BasicInfoInput(text)`，在 Agent 模式输入门禁中给 task1 增加“可直接输入推进”的白名单入口（关键词/结构化输入命中）
  - `frontend/main.js`：`isTask1Stage` 从“`!problemDetailConfirmedBasicInfo` 对象真值”改为“`task1 未完成` + `真实 basicInfo 字段判定` + `task1 白名单输入`”
  - `frontend/main.js`：意图提炼分支 `isBasicInfoProvide` 由 `!problemDetailConfirmedBasicInfo` 改为 `!hasTask1BasicInfoFields(...)`，避免仅有 extras 时误判“已有 basicInfo”
  - 预留最小日志：`[FE:task1-entry]`（进入详情）与 `[FE:task1-input]`（用户输入前）
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无（本轮纯前端修复）`
- 验证结果：`见本次回报中的 4 场景最小回归（代码路径级）`
- 关闭条件：`owner 现场确认：首次进入即有 task1 启动通知；输入工商信息直接走 task1 提炼；不再误提示 Agent 模式拦截；仅 task1 真完成后才推进 task2`

### FE-20260323-10

- 任务编号：`FE-20260323-10`
- 日期：`2026-03-23`
- 任务标题：`并行修复：首次新增案例后首页“详情”按钮不可点（caseKey 切换）`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：`已完成（代码，待 owner 现场复验）`
- 涉及项目：`frontend`
- 目标结果：`online 新增案例后，不刷新页面即可点击首页“详情”；caseKey 查找兼容 `id`/`createdAt`；后端创建成功回包后首页及时重渲染，`data-case-key` 尽快切为正式 `id``
- 已完成：
  - `frontend/main.js`：新增 `getProblemFollowCompatibleCaseKeys(item)` 与 `isProblemFollowCaseKeyMatched(item, caseKey)`，把 `findProblemFollowItemByCaseKey` / `findProblemFollowIndexByCaseKey` 从“单 key 严格匹配”改为兼容匹配 `item.id` + `item.createdAt`
  - `frontend/main.js`：新增 `window.addEventListener('problemCasesChanged', ...)`；online 下收到案例缓存变更事件立即 `renderProblemFollowList()`
  - `frontend/js/storage-http-adapter.js`：`saveDigitalProblem` 的 POST 成功回包、缓存从 optimistic 切到正式案例后，派发 `problemCasesChanged`（detail 含 `caseId/createdAt/clientCreatedAt`）
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无（本轮纯前端修复）`
- 验证结果：`见本次回报中的新增案例详情点击回归`
- 关闭条件：`owner 现场确认：首次新增案例后不刷新即可点“详情”进入；首页卡片 key 从 optimistic createdAt 及时刷新为正式 id`

### FE-20260323-06

- 任务编号：`FE-20260323-06`
- 日期：`2026-03-23`
- 任务标题：`online 深链 ProblemDetail 聊天区 __STORAGE_HTTP_HYDRATED 置位与 storageBackendReady 同序`
- 来源：`architect-owner` / 用户
- 优先级：`P0`
- 当前状态：`已完成（代码）`
- 涉及项目：`frontend`
- 目标结果：`online 模式下 `loadProblemCases`+`loadAllChats` 完成后置 `window.__STORAGE_HTTP_HYDRATED=true`，再派发 `storageBackendReady`；`reloadCachesFromBackend` 对称复位；`?caseId=` 深链不再永久停在「正在加载聊天记录…」；local/IndexedDB 不受影响`
- 已完成：
  - `frontend/js/storage-http-adapter.js`：`init` 开头 `__STORAGE_HTTP_HYDRATED=false`，`migrate`+列表+全量聊天加载完成后 `=true`，再 `dispatchEvent(storageBackendReady)`；`reloadCachesFromBackend` 同样 false→拉取→true→事件
  - `main.js`：`storageBackendReady` 回调内 `console.debug('[FE:http-hydration]', { phase: 'storageBackendReady-handler', caseId, chatKey, storedChatLen, __STORAGE_HTTP_HYDRATED })`（仅 `MODE===online`）
  - `frontend/AGENTS.md` 成员行同步 FE-20260323-06
- 当前阻塞：`待浏览器端人工回归（需本地 online + 后端可用）`
- 需要后端配合：`无`
- 验证结果（代码级 / 预期）：
  1. 直接打开 `?caseId=...`：`isProblemDetailStorageHydrated()` 在首包加载完成后为真，`initProblemDetailChat` 走真实消息或空占位，不停留在加载文案
  2. `storageBackendReady` 到达后：`refreshProblemDetailChatIfOpen` → `initProblemDetailChat` 与列表重渲染一致
  3. 刷新详情页：`restoreRouteState` / 轮询与 `storageBackendReady` 仍能在缓存就绪后打开详情并刷新聊天
  4. local + `__STORAGE_INDEXEDDB_HYDRATED`：未改分支逻辑
- 关闭条件：`用户完成 online 深链与导入重拉缓存的人工确认`

### FE-20260320-01

- 任务编号：`FE-20260320-01`
- 日期：`2026-03-20`
- 任务标题：`ProblemDetail P0 在线接线与回归验证`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`待验证`
- 涉及项目：`frontend`
- 目标结果：`ProblemDetail 在线模式以 caseId、后端动作接口、细粒度消息写入为主路径完成收口`
- 已完成：`?caseId` 详情深链、bundle 刷新、done/not-yet/rollback 在线动作接线、消息新增/删除细粒度接线、origin/main 同步后代码路径级回归核对`
- 当前阻塞：`仅剩最终人工 UI 兜底验证，重点确认三按钮动作后一致性与单条消息删除稳定命中 DELETE`
- 需要后端配合：`当前无阻塞型后端依赖`
- 验证结果：`代码路径级验证通过，未发现失败项；剩余 createdAt cache key 与多条删除回退 PUT 风险需人工确认`
- 关闭条件：`用户完成人工验证并确认三按钮与普通单条消息删除在 online 模式下均与后端一致`

### FE-20260320-02

- 任务编号：`FE-20260320-02`
- 日期：`2026-03-20`
- 任务标题：`同步 origin/main 并验证业务新增功能`
- 来源：`用户`
- 优先级：`P0`
- 当前状态：`待验证`
- 涉及项目：`frontend`
- 目标结果：`同步最新前端代码后，保留本轮 P0 优化并验证新增业务功能`
- 已完成：`git pull --rebase origin main fast-forward、stash pop 恢复本地改动、frontend/frontend-vue 范围内无实际冲突、本轮 P0 优化全部保留、新业务功能完成构建级验证`
- 当前阻塞：`等待最终人工功能验证，重点确认新增业务功能在真实页面流程中的表现`
- 需要后端配合：`当前无新增配合要求`
- 验证结果：`同步成功且无 conflict markers；ProblemDetail P0 代码路径级验证通过；frontend-vue 构建通过，新增业务功能构建级验证通过`
- 关闭条件：`用户确认 ProblemDetail P0 与新增业务功能的人工功能验收均通过`

### FE-20260320-04

- 任务编号：`FE-20260320-04`
- 日期：`2026-03-20`
- 任务标题：`临时切换到后端 agent 服务进行联调`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`已切换到后端 agent 并完成 confirm/revise/rollback 与消息删除验证`
- 涉及项目：`frontend`
- 目标结果：`仅通过前端配置切换 BACKEND_API_URL 到后端 agent 提供的服务地址，并验证 ProblemDetail 关键动作链路`
- 已完成：
  - 已临时切换 `frontend/config.local.js` 的 `BACKEND_API_URL` 到 `http://127.0.0.1:3002/api`
  - 如需恢复原测试环境，请把 `BACKEND_API_URL` 回滚为 `http://192.168.83.106/api`
  - 使用 admin JWT（已由 `dev_jwt_secret` 生成，role=admin）验证 4 类动作链路均返回成功码
- 已记录请求证据（均带 `Authorization: Bearer ...`）：
  - `POST /api/problem-cases/problem_d9d00b9a/tasks/task1/confirm` -> `200`，响应体包含 `case.id=problem_d9d00b9a` 与 `tasks[]`（task1 状态变更可见）
  - `POST /api/problem-cases/problem_d9d00b9a/tasks/task1/revise` -> `200`，响应体包含 `case.id=problem_d9d00b9a` 与 `tasks[]`
  - `POST /api/problem-cases/problem_d9d00b9a/tasks/task1/rollback` -> `200`，响应体包含 `case.id=problem_d9d00b9a` 与 `tasks[]`
  - `POST /api/problem-cases/problem_d9d00b9a/messages` -> `201`，返回 `message.id=msg_e7cc6f83`
  - `DELETE /api/problem-cases/problem_d9d00b9a/messages/msg_e7cc6f83` -> `204`（body=null）
- 当前阻塞：`无`
- 需要后端配合：`无`
- 验证结果：`confirm/revise/rollback 与单条消息删除验证通过；若测试环境出现 404 更可能是环境路由/版本问题而非前端调用方式问题`
- 关闭条件：`切换地址后完成 confirm/revise/rollback 与消息删除验证，并将结果写回文档`

### FE-20260320-05

- 任务编号：`FE-20260320-05`
- 日期：`2026-03-20`
- 任务标题：`AI 配置报错前端侧复现与证据补充`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`待派工`
- 涉及项目：`frontend`
- 目标结果：`补充“客户基本信息提炼失败”相关前端请求证据，确认是否命中 /api/ai/config 与 /api/ai/chat，以及前端当前连接的 backend 地址`
- 已完成：`已确认 online 模式下 BACKEND_API_URL 由 config.local.js 控制，且当前不是走本地 DeepSeek key`
- 当前阻塞：`等待后端确认实际连接数据库与 AI 配置读取结果`
- 需要后端配合：`提供 /api/ai/config 当前返回值、数据库 AppSetting 命中情况与最终根因`
- 验证结果：`待执行`
- 关闭条件：`前端错误复现证据和后端数据库结论能对齐`

### FE-20260320-06

- 任务编号：`FE-20260320-06`
- 日期：`2026-03-20`
- 任务标题：`ProblemDetail 路由与返回行为缺陷修复`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`history 闭环已落地，待 online 回归验证`
- 涉及项目：`frontend / frontend-vue`
- 目标结果：`修复 4 个前端侧缺陷：登录后 URL/视图不一致、详情返回不清理 caseId、浏览器返回误回登录页，并配合后端新 caseId 收口`
- 已完成：
  - `main.js`：`restoreRouteState` 在 `?caseId` 无法打开时轮询并在超时后 `replaceState` 清理 stale `caseId`；详情「返回」在 `history.state.pushed===true` 时走 `history.back()`，否则 `clearUrlCaseIdParam()` + 回首页。
  - `main.js` **history 闭环**：从首页/切换案例进入详情时对 URL 使用 `history.pushState({ appView, caseId, pushed:true })`；刷新或深链首屏且 URL 已含目标 `caseId` 时用 `replaceState({ pushed:false })`；注册 `popstate`（`handleAppPopState`）按 URL 同步首页或 `openProblemDetailByCaseId`，使浏览器后退稳定回到首页。
  - `LoginPage.vue`：登录成功使用 `location.replace(getRedirect())`，避免登录页留在 history 栈顶。
  - `storage-http-adapter.js`：`POST /problem-cases` 使用 `toCreatePayload`（不传客户端时间戳作 `id`）；`saveDigitalProblem` 在响应后用后端 `id` 合并缓存并迁移 chat/task 缓存键；迁移 `migrateLocalToBackendIfNeeded` 创建后读取响应 `id` 再 PUT/消息同步。
- 当前阻塞：`无（待 online 回归确认）`
- 需要后端配合：`无（创建案例由后端生成独立 id，前端已停止 POST 传时间戳 id）`
- 验证结果：`待执行（含：首页→详情→浏览器返回应回首页；深链 pushed:false 时应用内返回仍走 replace 清参）`
- 关闭条件：`4 个缺陷在 online 模式下人工验证通过`

### FE-20260321-01

- 任务编号：`FE-20260321-01`
- 日期：`2026-03-21`
- 任务标题：`PUT /messages 400 前端侧排查`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`待派工`
- 涉及项目：`frontend`
- 目标结果：`确认哪个 UI 场景触发 saveProblemDetailChat 回退到 PUT /messages，并抓出导致 400 的 request body`
- 已完成：`代码层已确认 saveProblemDetailChat 在“非追加/非单条删除”的场景会回退到 PUT /messages`
- 当前阻塞：`等待拿到真实触发场景、请求体和失败响应`
- 需要后端配合：`协助判断 request body 中哪条 message/哪个字段不满足 syncMessagesSchema`
- 验证结果：`待执行`
- 关闭条件：`明确触发场景与 offending message 字段，并完成修复或规避`

### FE-20260321-02

- 任务编号：`FE-20260321-02`
- 日期：`2026-03-21`
- 任务标题：`按前端边界完成提交并冻结提交说明`
- 来源：`architect-owner`
- 优先级：`P1`
- 当前状态：`已完成`
- 涉及项目：`frontend / frontend-vue`
- 目标结果：`将本轮前端相关改动按前端边界完成一次独立提交，用户后续只负责 review 与 push`
- 已完成：`owner 已冻结提交边界与 commit message 规范；前端已按指定文件清单完成统一提交（见下方 Git commit）`
- 当前阻塞：`无`
- 需要后端配合：`无`
- 验证结果：`已完成`
- 关闭条件：`在同一仓库内将 frontend + frontend-vue + docs/agents/frontend-agent.md + docs/agents/architect-owner.md 完成一次独立前端 commit，并回报 commit hash 与提交范围`
- 前端统一提交 Git commit：以本分支当前 `git rev-parse HEAD` 为准（FE-20260321-02 收尾时由执行者在对话回报完整 SHA；勿在文档内嵌会因 amend/squash 而过期的 40 位 SHA）
- FE-20260321-02 写回 commit hash：见本对话「commit hash」栏（单笔 `fix(problem-detail): close routing history loop and use server case ids` 已含下列 6 个文件）
- 提交说明：`fix(problem-detail): close routing history loop and use server case ids`

### FE-20260321-03

- 任务编号：`FE-20260321-03`
- 日期：`2026-03-21`
- 任务标题：`案例与消息导入导出前端实现`
- 来源：`architect-owner`
- 优先级：`P1`
- 当前状态：`联调收口完成（代码与后端冻结契约对齐；建议用户环境做一次冒烟后关账）`
- 涉及项目：`frontend`
- 目标结果：`在案例列表或相关操作区提供导入/导出入口，支持导出单个案例包、上传导入案例包，并展示导入结果反馈`
- 已完成（v1 冻结口径）：
  - 单案例、JSON 案例包、导入语义「导入为新案例」、不批量、不扩本地数据模型、前端不拼装包/不重写 id。
  - UI：`index.html` 首页案例列表区工具栏「导入」+ 隐藏 `input[type=file]`；详情进度条右侧「导出」（在「沟通历史」左侧）。
  - **后端冻结契约（已对齐前端）**：
    - 导出：`GET /api/problem-cases/:id/export`，鉴权，`application/json`，`Content-Disposition: attachment`（文件名为 `{customerName}_{当前任务 label}.json`，含 `filename*` UTF-8）；前端用 `blob` + `<a download>`，文件名优先 `parseContentDispositionFilename`。
    - 导入：`POST /api/problem-cases/import`，鉴权，**`application/json` 案例包 body**（与后端 `req.body` 一致；**FE-20260321-06** 已从 multipart 修正）；成功 **201**（兼容 **200**）；响应 **`caseId`（优先解析）**、`importedMessageCount`、`schemaVersion`；失败体优先 **`message` / `error`**，其次 Zod **`issues[0]`**。
  - 成功后：`reloadCachesFromBackend` → `renderProblemFollowList` → `GET` 详情 → `openProblemDetail`；提示中展示消息条数与 schema 版本。
  - 实现落点：`frontend/main.js`（`exportCurrentProblemCasePackage` / `importProblemCasePackageFile` / `parseContentDispositionFilename`）、`frontend/js/storage-http-adapter.js`（`reloadCachesFromBackend`）。
- 当前阻塞：`无`
- 需要后端配合：`无（字段已对齐）；若生产网关将 201 改为仅 200，前端已兼容 200`
- 验证结果：`见下方「联调与回归记录」`
- 关闭条件：`前端可完成单案例导出下载、JSON 文件导入、结果反馈，并能在成功后跳转到新案例详情`（**已满足**）

**联调与回归记录（FE-20260321-03 收口）**

| 项 | 结果 |
| --- | --- |
| 导出成功 | **通过（代码路径）**：GET + 鉴权 + blob 下载 + Content-Disposition 文件名 |
| 导入成功 | **通过（代码路径）**：POST **`application/json` body** + 解析 `caseId` + 201/200 + 刷新缓存 + 详情跳转（**FE-20260321-06**） |
| 非法文件失败提示 | **通过（代码路径）**：客户端非法 JSON → `showError`；服务端非 2xx 走 `parseBackendErrorMessageForProblemCaseIo` |
| 导入后消息时间线 | **通过（代码路径）**：`reloadCachesFromBackend` + `openProblemDetail` → `refreshProblemDetailBundleFromBackend` |
| 真实环境冒烟 | **待用户**在已部署后端上点验（本仓库未自动跑 E2E） |

**与 BE-20260321-03 契约（已冻结）**

| 方向 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 导出 | GET | `/api/problem-cases/:id/export` | `application/json` + `Content-Disposition` |
| 导入 | POST | `/api/problem-cases/import` | **`application/json` body**（案例包）；201；`caseId` / `importedMessageCount` / `schemaVersion` |
| 错误 | — | — | `message` / `error` / `issues` |

## 7. 每日更新区

### FE-20260320-03

- 任务编号：`FE-20260320-03`
- 日期：`2026-03-20`
- 任务标题：`线上 confirm 404 前端侧排查`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`待派工`
- 涉及项目：`frontend`
- 目标结果：`确认前端在线模式发起的到底是 POST 还是其他方法，并补充线上 Network 证据`
- 已完成：`本地代码已确认 online 模式通过 postProblemCaseTaskAction(...) 发起 POST /problem-cases/:caseId/tasks/:taskId/confirm；frontend/config.local.js 已确认 BACKEND_API_URL=http://192.168.83.106/api，且 index.html 会在 config.js 之后加载 config.local.js 覆盖默认配置`
- 当前阻塞：`等待用户补充线上真实请求证据（浏览器直访 or Network 面板实际请求）`
- 需要后端配合：`若确认前端发起的是 POST 仍 404，则需后端确认线上部署版本与路由可用性`
- 验证结果：`已确认当前前端实际连接测试环境而非本地 backend；线上环境待证实`
- 关闭条件：`拿到线上真实请求方法、响应体和请求头后完成归因`

> 说明：每次开始或结束一个阶段时，都在本区追加更新，不要覆盖旧记录。

### 更新模板

- 日期：
- 今日完成：
- 当前阻塞：
- 明日计划：
- 需要后端配合的接口或字段：
- 是否存在越界到前端本地规则的风险：

### 2026-03-25

- 日期：2026-03-25
- 今日完成：登记并完成 **FE-20260325-01**（仅 task2 `taskCompletionConfirmBlock`：三态、`completedStages` 收口完成态、在线 confirm 失败回滚与 `[FE:task2-completion-confirm]` 日志）；登记并完成 **FE-20260325-02**（task3：`isTaskCompleted` 去掉 `requirementLogic` 误判、`taskCompletionConfirmBlock(task3)` 以 `completedStages` 含 2 收口、在线三态+`[FE:task3-completion-confirm]`）；登记并完成 **FE-20260325-03**（task4/5/6：`workflowAlignCompletedStages` 与输出写入解耦、`updateDigitalProblemWorkflowAlignCompletedStages`、advance 收口、工作区 IT 展示 `valueStreamHasAnyItStatus`、在线三态+`[FE:workflow-align-task-completion-confirm]`）；登记并完成 **FE-20260325-04**（task5：单路径渲染去重卡、去掉输出生成末尾 `showNextTaskStartNotification`、`taskCompletionConfirmBlock(task5)` wf 显式收口、`[FE:task5-after-output]`）；`node --check`：`frontend/main.js`、`frontend/js/storage.js`、`task4ValueStream.js`、`task5ItStatus.js`、`task6PainPoint.js` 通过。
- 当前阻塞：无（待 owner 现场验证 task2–task6，含 **FE-20260325-04** task5）
- 明日计划：owner 按 FE-20260325-01–03 验收；不扩面至全任务统一重构。
- 需要后端配合：`无`
- 是否存在越界到前端本地规则的风险：`无（仅 task2 块与在线 confirm 交互）`

### 2026-03-24

- 日期：2026-03-24
- 今日完成：
  - **FE-20260324-57（补充）**：继续收口 task10 角色与权限 allDone 卡高亮残留：`rolePermissionAllDoneBlock` 点击「全部确认」改为双写 `confirmed + allConfirmed`；task10 在线 confirm 成功后同步补写 allDone 卡确认态；渲染侧新增 task10 完成/已流转 task11 兜底判定，避免刷新后再次高亮；日志补 `rolePermissionAllDoneBlockConfirmed` 与 `rolePermissionAllDoneBlockAllConfirmed`。
  - **FE-20260324-57**：修复 task10 已流转 task11 后聊天确认卡片仍高亮问题：在线 confirm 成功后补写 `taskCompletionConfirmBlock.confirmed`；聊天渲染改为已完成三源判定（`msg.confirmed` / `isTaskCompleted(task10)` / `taskCompleteBlock`）；新增 `[FE:task-completion-confirm-sync]` 最小日志（`taskCompletionConfirmBlockConfirmed`、`isTaskCompleted`、`firstUncompletedTaskId`）。
  - **FE-20260324-20**：task11 节点级 checkpoint 接线（v1.5 最小方案）— 新增 `PUT /api/problem-cases/:id/tasks/task11/steps/:stepIndex` 前端调用；自动顺序与手工单步两条路径都改为“每个 step 完成后立即写后端”；恢复优先 `coreBusinessObjectSessions`（后端详情/列表），聊天 `coreBusinessObjectSessionsBlock` 下调为展示辅助与兜底。
  - **FE-20260324-19**：在线版售前分析报告 v1：`report.html` + `css/report.css` + `js/report-page.js`；聚合接口 `GET /problem-cases/:id/report`；Mermaid 关联图；`auth-runtime` 门禁 `report.html`；首页卡片 + 详情顶栏入口新标签页；`frontend/AGENTS.md` 与本文档任务区已回填。
  - **FE-20260324-19 补充**：`report-page.js` 消费契约与后端 report DTO 对齐；`demandInsight` 专用渲染、`globalItGap.analysis` 解包、业务对象摘要卡、`graph.edges` 为空正式空态、`[FE:report-snapshot]` 日志（见任务区 FE-20260324-19）。
  - **FE-20260324-19 追加（价值流报告样式回退）**：按 owner 口径回退 `report.css` 中对 `vs-*` 内层类（节点、标题条、痛点块、颜色、边框、字号等）的覆盖；仅保留报告页外层容器控制（价值流区块 breakout、`#reportValueStream` 横向滚动、外层宽度/间距、包裹策略），不再修改组件内部视觉语言。
  - **FE-20260324-19 追加（IT 现状标注补显）**：report 价值流区补 `itStatusLabel` 映射与渲染日志；`report-formal-render.js` 在报告链将 step 的 `itStatusLabel -> itStatus`（仅当原 itStatus 缺失），`report-page.js` 输出 `[FE:report-value-stream]`（`stage0Steps` + `renderedItStatusCount`），确保「阶段/环节 + IT现状 + 痛点」同显。
  - **FE-20260324-18**：核验并收口 Vue 续期链：`requestJson` 已接续期头；`backendApi.login()` 成功路径补充 `applyAuthRenewalFromHeaders`；`frontend-vue` `npm run build` 通过。
  - **FE-20260324-17**：401/403 分离；403 仅 `handleAuthForbidden`（不清 token、不跳登录、默认提示文案、2.5s 同文案去重、`[FE:auth-403]`）；401 维持清 token + `auth_reason=auth`；收口 `api.js` / `storage-http-adapter.js` / `main.js` 任务动作 / Vue `client.ts`；login/admin 与 vite `public/js` 同步 `auth-runtime.js`；`frontend-vue` `npm run build` 通过。
  - **FE-20260324-16**：刷新跳登录诊断链（`__FE_AUTH_DEBUG`）、`auth_reason` 区分 gate/auth、storage-http-adapter / api.js / main.js 透传 401 URL+message、Vue `client.ts` 接续期头与清 `expires_at`；`frontend-vue` `npm run build` 通过。
- 当前阻塞：`无`
- 明日计划：`owner` 现场按任务条「现场排查步骤」复验刷新与续期头。
- 需要后端配合的接口或字段：`无`
- 是否存在越界到前端本地规则的风险：`无`

### 2026-03-21

- 日期：2026-03-21
- 今日完成：
  - FE-20260321-03：首页案例列表工具栏「导入」+ 详情进度条「导出」；online 下对接 `GET /problem-cases/:caseId/export`、`POST /problem-cases/import`；`storage-http-adapter.reloadCachesFromBackend`；导入成功提示后 `openProblemDetail`。
  - FE-20260321-03 **联调收口**：与后端冻结契约对齐——导入成功体 **优先 `caseId`**；导出 **`Content-Disposition`** 用专用解析（`filename="..."` / `filename*`）；错误体 **`message` / `error` / `issues[0]`**；成功提示附带 **`importedMessageCount`、`schemaVersion`**；导入 HTTP **201** 为主、**兼容 200**。
  - FE-20260321-05：**import 400 / PUT messages 400 证据补充**——静态结论：前端 **multipart + `file`** vs 后端 **`importCasePackage(req.body)` JSON** 错配；PUT 走 `saveProblemDetailChat` 非 POST/DELETE 分支时整包 `items`；详见任务条「证据与结论」。
  - **FE-20260321-06**：`importProblemCasePackageFile` 改为 **读文件文本 → `JSON.parse` → `POST` 带 `Content-Type: application/json`**，与后端只解析 **raw JSON body** 对齐；非法 JSON 客户端提示；成功/失败后续逻辑不变。**可申请关账**（用户环境冒烟 Network 确认后最终签字）。
  - **FE-20260321-07**：导入成功后首页列表刷新闭环——`loadProblemCases` **`no-store`**；导入成功 **`upsertCaseFromDetailPayload(item)`** 再 **`renderProblemFollowList`**，修复兜底 `fetch` 详情未进 `problemCasesCache` 的根因。**可申请关账**（用户环境冒烟）。
- 当前阻塞：`无`
- 明日计划：用户在有后端的环境做一次导入冒烟（JSON body + 首页列表含新案例）后可最终关闭 FE-20260321-03 / FE-20260321-06 / FE-20260321-07。
- 需要后端配合的接口或字段：`无（已与 BE-20260321-03 对齐）`
- 是否存在越界到前端本地规则的风险：无（未扩本地模型；不拼装 JSON 包）。

### 2026-03-20

- 日期：2026-03-20
- 今日完成：
  - FE-20260320-06：详情进入用 `pushState` + `popstate` 闭环浏览器返回；`restoreRouteState` 轮询清理 stale `caseId`；详情返回优先 `history.back()`；`LoginPage` 用 `location.replace`；`storage-http-adapter` 创建不传时间戳 `id`。
  - 完成“临时事项：接口鉴权排查”第一轮。
  - 确认 `ProblemDetail` 的 `problem-cases` 前端适配层当前会统一带 `Authorization` 请求头。
  - 发现后端 `/api/ai` 存在未鉴权公开挂载风险，旧首页仍保留 `API_URL` / `VALUE_STREAM_API_URL` 外部直连入口。
  - 已在前端实现 `ProblemDetail` 读取侧收口：打开详情页时会通过适配层刷新 `case detail`、`task summaries`、`message timeline`，不再只依赖本地缓存展示。
 - 已推进 `ProblemDetail` 详情深链口径：打开详情时写入 `?caseId=<item.id>`，刷新恢复优先从 URL 取 `caseId`（`createdAt` 仅兼容 fallback）。
 - 已完成写侧动作接线（online 模式）：任务 `done/not-yet/rollback` 分别直调后端 `confirm/revise/rollback`，并在成功后刷新 `case detail + task summaries + message timeline`。
 - 已完成消息新增/删除的细粒度接线（online 模式）：新增走 `POST`，删除走 `DELETE`。
  - 完成第二轮前端侧鉴权核验细化：`frontend/main.js` 的首页公司分析（`API_URL`）与价值流列表（`VALUE_STREAM_API_URL`）外部直连 `fetch(...)` 仅带 `Content-Type`，不带 `Authorization`；当前依赖外部 Base44 接口可匿名读取。
  - 完成 `frontend-vue` 在线模式绕权风险核验：在线模式下所有后端请求均集中在 `src/api/client.ts` 的 `requestJson`，token 存在时会附带 `Authorization: Bearer ...`；`AdminPage` 在缺 token 或非 `admin` 时会直接跳转登录/不加载，未发现业务数据读取绕过统一鉴权头的请求路径。
  - 已临时切换 `BACKEND_API_URL` 到后端 agent `http://127.0.0.1:3002/api`，并完成关键动作验证（均带 `Authorization: Bearer ...`）：
    - `done -> confirm`：`POST /api/problem-cases/problem_d9d00b9a/tasks/task1/confirm` -> `200`
    - `not-yet -> revise`：`POST /api/problem-cases/problem_d9d00b9a/tasks/task1/revise` -> `200`
    - `rollback -> rollback`：`POST /api/problem-cases/problem_d9d00b9a/tasks/task1/rollback` -> `200`
    - 单条消息删除：`DELETE /api/problem-cases/problem_d9d00b9a/messages/:messageId` -> `204`
- 当前阻塞：
  - P0 已进入回归验证阶段：基于代码路径确认 online 的 `done/not-yet/rollback` 会直调后端并刷新首屏；以及消息删除在“单条删除”场景会走 `DELETE /api/problem-cases/:caseId/messages/:messageId`。
  - 已同步 `origin/main`：rebase fast-forward + `stash pop` 恢复，无冲突；本轮仅处理 `frontend` / `frontend-vue` / `docs/agents/frontend-agent.md` 范围内的前端优化，关键保留项包括：
    - `ProblemDetail` 深链写入并恢复 `?caseId=<item.id>`（`createdAt` 仅兼容 fallback）
    - 打开详情后刷新 `case detail + task summaries + message timeline`，刷新/恢复优先走 URL 的 `caseId`
    - online 模式 done/not-yet/rollback：分别直调 `confirm/revise/rollback`
    - online 模式消息新增：`POST /api/problem-cases/:caseId/messages`
    - online 模式消息单条删除：`DELETE /api/problem-cases/:caseId/messages/:messageId`
- 回归验证结果（代码路径级核对）：
  - 通过项：
    - `done`：命中在线分支后直调 `POST /api/problem-cases/:caseId/tasks/:taskId/confirm`，成功后刷新 `case detail + task summaries + message timeline`。
    - `not-yet`：命中在线分支后直调 `POST /api/problem-cases/:caseId/tasks/:taskId/revise`，成功后刷新首屏并同步更新标题。
    - `rollback`：命中在线分支后直调 `POST /api/problem-cases/:caseId/tasks/:taskId/rollback`，成功后刷新首屏并触发任务通知。
    - 消息删除：UI 删除触发 `saveProblemDetailChat(...)` 后，适配层在“仅删除 1 条且消息 `id` 可匹配”时走 `DELETE /messages/:messageId`，刷新后时间线一致。
  - 失败项：未发现明确会导致在线分支走错接口或无法刷新首屏的代码路径。
  - 剩余风险：
    - `createdAt` 历史残留：online 模式主要通过 URL 的 `caseId` 与 `resolveCaseId()` 映射到后端标准 `id`；若 `caseId` 缺失才走 `createdAt` fallback，不应影响在线接口参数。但消息删除的 `saveProblemDetailChat(createdAt, ...)` 仍以 `createdAt` 作为适配层 cache key，极端情况下若消息对象缺失 `id` 可能导致删除匹配不到后端 messageId（进而可能回退到 `PUT` 或删除失败）。
    - 部分 UI“删除”可能会一次性清理多条消息（例如特殊卡片清理），此时适配层会因为长度变化不满足 `-1` 条件而回退到 `PUT /messages`，不一定命中单条 `DELETE`。
- 明日计划：
  - 新业务功能验证：已完成 `frontend-vue` 的 `npm -C frontend-vue run build`（vite build 成功），仅出现 `login.html/admin.html` 中 config.js/config.local.js 无 `type="module"` 的构建提示，以及 `styles.css` 运行时解析提示（不影响构建成功）。
  - 最终人工验证：你端确认 3 个按钮分支确实刷新到与后端一致；并补测一条普通聊天消息的删除是否稳定命中 `DELETE /messages/:messageId`。
- 需要后端配合的接口或字段：
  - `POST /api/problem-cases/:caseId/messages`
  - `POST /api/problem-cases/:caseId/tasks/:taskId/confirm`
  - `POST /api/problem-cases/:caseId/tasks/:taskId/revise`
  - `POST /api/problem-cases/:caseId/tasks/:taskId/rollback`
  - `/api/ai` 仅保留鉴权路由，移除未鉴权公开挂载。
  - （鉴权收口选项）提供受鉴权的公司分析/价值流列表代理接口（示例：`/api/company-analysis`、`/api/company-value-streams`），供前端替换外部 `API_URL` / `VALUE_STREAM_API_URL` 直连。
- 是否存在越界到前端本地规则的风险：
  - 低。online 模式下任务动作与消息删除/新增均走后端/适配层；本地状态机仅作为非在线回归兜底保留。

## 8. 与架构 owner 沟通区

> 说明：凡是需要拍板、阻塞推进、发现边界冲突的问题，都先写在这里，再同步沟通。

### 沟通模板

- 发现的未鉴权接口或调用路径：
- 待确认决策：
- 当前实现与边界冲突点：
- 建议后端补充的接口：
- 需要架构 owner 拍板的取舍：

### 2026-03-20 接口鉴权排查第一轮

- 发现的未鉴权接口或调用路径：
  - 后端 [app.ts](E:\03_do1_workspace\do1_smart_cto\backend\src\app.ts) 同时挂载了两次 `/api/ai`，其中一条是未加 `requireAuth` 的公开路由：`app.use('/api/ai', createAiRouter(aiConfigService));`。这意味着 `/api/ai/config` 与 `/api/ai/chat` 存在被未鉴权命中的风险。
  - 旧前端 [main.js](E:\03_do1_workspace\do1_smart_cto\frontend\main.js) 仍保留外部直连调用：`API_URL` 与 `VALUE_STREAM_API_URL`，对应公司分析与价值流列表查询，不走统一鉴权头。
- 待确认决策：
  - 是否本周将首页公司分析/价值流外部直连能力一并纳入鉴权收口；从边界上看它们属于业务数据入口，建议一并处理。
- 当前实现与边界冲突点：
  - 前端在线模式的 AI 请求已通过 [api.js](E:\03_do1_workspace\do1_smart_cto\frontend\js\api.js) 带 `Authorization`，但后端仍保留未鉴权 AI 路由，导致“前端已鉴权、后端仍可绕过”的边界不一致。
  - `ProblemDetail` 的 `problem-cases` 读写当前主要经 [storage-http-adapter.js](E:\03_do1_workspace\do1_smart_cto\frontend\js\storage-http-adapter.js) 发起，已统一构建鉴权头；但首页旧直连接口没有纳入同一策略。
- 建议后端补充的接口：
  - 建议后端移除未鉴权的 `/api/ai` 挂载，仅保留 `requireAuth` 后的 AI 路由。
  - 若首页公司分析/价值流查询后续也要纳入统一鉴权，建议后端补正式受控接口，避免前端继续直接请求外部入口。
- 需要架构 owner 拍板的取舍：
  - 是否允许暂时保留首页外部直连查询，还是要求本周一并收口到受鉴权后端接口。

### 2026-03-20 P0 写侧接线切换（后端动作接口已到位）

- 当前实现与边界冲突点：
 - 在线模式下：任务 `done/not-yet/rollback` 已改为直调后端动作接口并在成功后刷新首屏 bundle（本地状态机仅保留非在线模式回归）。
 - 消息新增/删除的细粒度接线已在 `storage-http-adapter.js` 内完成：新增走 `POST`，删除走 `DELETE`，其它变更回退 `PUT`。
- 当前计划：
 - 继续巩固路由恢复口径：详情打开写入 `?caseId=<item.id>`，刷新恢复优先从 URL 取 `caseId`（`createdAt` 仅兼容 fallback）。
 - 做一次回归确认：UI 上“消息删除”按钮路径在在线模式是否稳定触发适配层的 `DELETE /messages/:messageId` 分支，并验证动作后 `detail + tasks + messages` 与后端一致。

### 2026-03-20 接口鉴权排查第二轮补齐

- 发现的未鉴权接口或调用路径：
  - `frontend` 首页公司分析：`frontend/js/config.js` 的 `API_URL` 在 `frontend/main.js` 中被直接 `fetch(target, ...)` 调用；该请求仅设置 `Content-Type`，未设置 `Authorization`。
  - `frontend` 首页价值流列表：`frontend/js/config.js` 的 `VALUE_STREAM_API_URL` 在 `frontend/main.js` 中被直接 `fetch(VALUE_STREAM_API_URL, ...)` 调用；该请求仅设置 `Content-Type`，未设置 `Authorization`。
  - `frontend-vue`：未发现在线模式下绕过鉴权头的后端请求路径（业务请求均经 `src/api/client.ts` 的 `requestJson`，token 存在时会带 `Authorization`；且 `AdminPage` 在无 token/非 admin 时直接跳转或拒绝加载）。
- 待确认决策：
  - `API_URL` / `VALUE_STREAM_API_URL` 的外部直连是否需要与后端统一鉴权策略一致（即由后端提供受鉴权代理入口，前端不再直连匿名外部 Base44）。
- 当前实现与边界冲突点：
  - 若架构要求“业务数据入口必须统一由后端鉴权”，则当前 `frontend` 这两条外部直连属于需要整改的边界点；否则可视为“前端业务只读外部公开数据”的例外。
- 建议后端补充的接口：
  - 提供受鉴权代理接口给前端使用（由后端 agent 定义具体路径与返回结构），以便前端替换直连的 `API_URL` / `VALUE_STREAM_API_URL`。
- 需要架构 owner 拍板的取舍：
  - 是否在本周将上述外部直连入口纳入“受鉴权后端代理收口”范围。

### 2026-03-20 新增 P0：案例详情路由标识收口

- 发现的未鉴权接口或调用路径：
  - 无新增未鉴权接口发现；本事项不属于鉴权问题，而是详情定位方式问题。
- 待确认决策：
  - 前端详情页最终采用查询参数 `?caseId=...` 还是路径参数 `/problem-cases/:id`。
- 当前实现与边界冲突点：
  - 当前 `ProblemDetail` 打开详情后，前端通过 `saveRouteState('problemDetail', { createdAt })` 保存会话态，并在恢复时依赖 `sessionStorage + createdAt` 找回详情对象。
  - 这意味着站内跳转通常可恢复，但详情页 URL 本身不具备可深链、可分享、可跨设备恢复的能力。
  - 当前详情接口读取虽可通过适配层将 `createdAt` 映射到后端 `id`，但这属于兼容桥接，不应继续作为长期主路径。
- 建议后端补充的接口：
  - 本事项优先不要求新增详情接口，优先要求保持 `list/detail/messages/tasks` 均稳定返回后端标准 `id`，供前端路由改造直接使用。
- 需要架构 owner 拍板的取舍：
  - 是否本周直接要求 `frontend` 详情页改为携带 `caseId` 的 URL，并以此作为刷新恢复主路径。

## 9. 跨 Agent 协同留言方式

> 说明：前端 agent 不能修改后端项目。如需后端配合，统一按以下格式在本文件中留言。

### 留言位置

- 先在“每日更新区”说明当前阻塞。
- 再在本区追加正式协同留言。
- 不把跨 agent 协同事项只留在聊天里。

### 协同留言模板

- 日期：
- 协同对象：`backend-agent`
- 事项标题：
- 背景：
- 当前前端现状：
- 需要后端提供：
- 建议接口或字段：
- 阻塞等级：`P0 | P1 | P2`
- 期望回复时间：
- 备注：

### 2026-03-20

- 日期：2026-03-20
- 协同对象：`backend-agent`
- 事项标题：P0 所需动作接口与 AI 鉴权收口
- 背景：
  - 本周前端任务要求先完成接口鉴权排查，再按 P0 推进 `ProblemDetail` 的后端接线收口。
- 当前前端现状：
  - 已确认 `problem-cases` 读取侧可统一走鉴权头，并已接入详情页打开时刷新 `case detail`、`task summaries`、`message timeline`。
  - 前端在线模式 AI 请求会带 `Authorization`，但后端仍存在未鉴权 `/api/ai` 挂载。
  - 前端仍被 P0 动作接口缺失阻塞，无法替换掉旧的本地确认/修订/回退路径。
- 需要后端提供：
  - 移除未鉴权的 `/api/ai` 路由挂载，仅保留鉴权后的 AI 路由。
  - 提供以下动作接口：
    - `POST /api/problem-cases/:caseId/messages`
    - `POST /api/problem-cases/:caseId/tasks/:taskId/confirm`
    - `POST /api/problem-cases/:caseId/tasks/:taskId/revise`
    - `POST /api/problem-cases/:caseId/tasks/:taskId/rollback`
- 建议接口或字段：
  - `messages` 追加接口返回最新追加后的标准 message item，字段至少包含：`id`、`role`、`type`、`content`、`payloadJson`、`confirmed`、`timestamp`。
  - 动作接口返回最新 `case detail`、`task summaries`、`message timeline` 之一或其组合，便于前端动作后直接刷新 UI。
- 阻塞等级：`P0`
- 期望回复时间：2026-03-20 当日
- 备注：
  - 在动作接口到位前，前端不会新增本地业务状态机或新的本地推进/回退规则。

## 10. 验收标准

- 刷新后详情页状态可恢复。
- 新增消息走追加接口。
- 确认/修订/回退不靠本地裁决完成。
- 不再新增本地状态机逻辑。

## 11. 给 Frontend Agent 的提示词

你是 Smart CTO 项目的前端执行 agent。

先阅读并以后续唯一工作面板为准：

- `project-core.mdc`（项目协作总规则，与根目录 `AGENTS.md` 配套）
- `E:\03_do1_workspace\do1_smart_cto\docs\agents\frontend-agent.md`

你的职责是：

- 负责 `frontend` 与 `frontend-vue` 两个前端项目的展示、交互、接口接线和消息渲染。
- 其中优先级以 `frontend` 的 `ProblemDetail` 主链路为最高，`frontend-vue` 重点关注登录、管理端以及未来迁移承接能力。
- 不能修改 `backend` 项目。
- 不新增本地业务状态机。
- 不新增本地任务推进和回退规则。
- 所有涉及消息、确认、修订、回退、阶段推进的逻辑，优先走后端接口。

你的工作要求：

- 每次开始工作前先阅读该文档中的“本周任务清单”“冻结边界”“与架构 owner 沟通区”。
- 每接到一个新任务，先登记“任务记录区”，再开始执行。
- 每次开始工作前同时确认自己遵守 `project-core.mdc`（项目协作总规则，与根目录 `AGENTS.md` 配套） 中的总规则。
- 每完成一个阶段，同时更新该文档的“任务记录区”和“每日更新区”。
- 如果你遇到阻塞、发现接口不合理、或需要我拍板的内容，不要只放在聊天里，要同步写入该文档“与架构 owner 沟通区”。
- 如果需要后端协同，不要直接修改 `backend`，而是按本文档“跨 Agent 协同留言方式”留言。
- 所有后续任务更新、风险、待确认事项，都只放在该 markdown 中维护。

## 12. 追加任务记录（2026-03-21）

### FE-20260321-04

- 任务编号：`FE-20260321-04`
- 日期：`2026-03-21`
- 任务标题：`local 模式导入导出能力补充`
- 来源：`architect-owner`
- 优先级：`P2`
- 当前状态：`待派工`
- 涉及项目：`frontend`
- 目标结果：`在 local 模式下补齐问题案例与 message 的导入导出能力，支持从 localStorage 导出 JSON 案例包，并从 JSON 案例包导入为本地案例`
- 已完成：`已确认当前 local 模式下导入/导出按钮禁用，且提示仅支持 online 模式；现有前端实现完全依赖后端 import/export 接口`
- 当前阻塞：`当前正在收口 FE-20260321-03 的 online 联调与验收，不应在本轮混入 local 模式扩展`
- 需要后端配合：`无；local v1 预期由前端本地存储自行完成`
- 验证结果：`待实现`
- 关闭条件：`local 模式下可完成单案例导出下载、JSON 导入、导入后本地案例与消息时间线可读取`

### FE-20260321-05

- 任务编号：`FE-20260321-05`
- 日期：`2026-03-21`
- 任务标题：`import 400 与 messages 400 前端证据补充`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`前端证据已补充（源码 + 后端路由对照）；运行时 Response Body 原文建议用户从 Network 复制归档`
- 涉及项目：`frontend`（证据含 `frontend/main.js`、`frontend/js/storage-http-adapter.js`；对照 `backend` 路由仅作归因，本轮不改后端）
- 目标结果：`补齐 POST /api/problem-cases/import 400 与 PUT /messages 400 的真实 request/response 证据，并确认前端当前上传格式与后端实际契约是否一致`
- 已完成：`见下方「证据与结论」`
- 当前阻塞：`无（待 owner 决定是否改前端为 JSON body 或改后端接 multipart）`
- 需要后端配合：`若坚持 import 仅 JSON body：需与前端对齐；PUT 400 需对照 `issues[]` 修 payload 或放宽 schema`
- 验证结果：`见下方`
- 关闭条件：`明确 import 400 是否由上传格式不匹配导致；明确 PUT /messages 400 的触发场景与 failing payload`（**已达成**）

**证据与结论（FE-20260321-05）**

#### 1）POST /api/problem-cases/import → 400

| 项目 | 内容（源码可复现） |
| --- | --- |
| Request URL | `APP_CONFIG.BACKEND_API_URL` + `/problem-cases/import`（与现象中 **`POST /api/problem-cases/import`** 一致） |
| Request Method | `POST`（`frontend/main.js` → `importProblemCasePackageFile`） |
| Request Headers | **继承 `getAuthHeaders()`**（如 `Authorization: Bearer ...`）；**显式删除 `Content-Type`**，由浏览器为 `FormData` 自动设置 **`multipart/form-data; boundary=...`** |
| Request Payload 形态 | **`multipart/form-data`**，字段名 **`file`**：`fd.append('file', file, file.name \|\| 'case-import.json')` |
| **后端实际处理**（仓库对照） | `backend/src/modules/problem-cases/problem-case.routes.ts`：`router.post('/import', ...)` → `service.importCasePackage(**req.body**)`，即 **Express JSON body**，**未**使用 `multer`/`multipart` 解析文件 |
| Response Body（典型 400） | 路由层 Zod 中间件：`{ message: '请求参数不合法', issues: [...] }`；**运行时原文**请以浏览器 Network 响应为准 |

**结论（import）**：**import 当前实现是 multipart + 字段 `file`**；**后端当前实现期望 JSON 案例包在 `req.body`**。二者 **不一致**，**400 更像契约/格式错配（上传形态 ≠ 服务端解析入口）**，而非「字段名 file 拼错」单点问题。

> **（已修复）**：见 **FE-20260321-06**，前端已改为 **`Content-Type: application/json` + 案例包 JSON body**，与后端一致。

### FE-20260321-06

- 任务编号：`FE-20260321-06`
- 日期：`2026-03-21`
- 任务标题：`修复导入接口契约错位（前端改为 application/json body）`
- 来源：`architect-owner` / 冻结结论
- 优先级：`P0`
- 当前状态：`已收口（前端）`
- 涉及项目：`frontend`（`frontend/main.js` → `importProblemCasePackageFile`）
- 目标结果：`POST /problem-cases/import` 与后端一致：请求体为 **raw JSON**（`Content-Type: application/json`），不再使用 `multipart/form-data` + `file` 字段
- 已完成：
  - 本地读取所选文件为文本 → `JSON.parse` → `JSON.stringify` 作为 body；非法 JSON 在客户端提示「文件不是合法 JSON」。
  - 成功路径不变：`extractImportedProblemCaseId` 优先 `caseId` → `reloadCachesFromBackend` → `renderProblemFollowList` → `GET` 详情 → `openProblemDetail`；错误仍走 `parseBackendErrorMessageForProblemCaseIo`（`message` / `error` / `issues`）。
- 当前阻塞：`无`
- 需要后端配合：`本轮不改后端；PUT /messages 400 单列第二优先级（本任务不扩战线）`
- 验证结果：`见下方「FE-20260321-06 回归」`
- 关闭条件：`合法包可导入；非法 JSON 有提示；导入成功可打开新案例详情`（**可申请关账**）

**FE-20260321-06 回归**

| 项 | 结果 |
| --- | --- |
| 合法 JSON 案例包导入成功 | **通过（代码路径 + 后端 `problem-case-import-export` 契约一致）**：需用户环境冒烟确认 Network 为 `application/json` |
| 非法 JSON | **通过（代码路径）**：`JSON.parse` 失败 → `showError`「文件不是合法 JSON」 |
| 导入后打开新案例详情 | **通过（代码路径）**：与 FE-20260321-03 成功分支一致 |

#### 2）PUT /api/problem-cases/:caseId/messages → 400

| 项目 | 内容 |
| --- | --- |
| 触发路径（代码） | `frontend/js/storage-http-adapter.js` → `saveProblemDetailChat`：在 **非**「单条 POST 追加」且 **非**「单条 DELETE 删除」时，走 **`PUT .../messages`**，body 为 `JSON.stringify({ items: nextMessages.map(toMessagePayload) })` |
| **为何未走 POST/DELETE** | POST：仅当 `prev.length+1===next.length` 且 **前缀 id 完全一致**；DELETE：仅当 `prev.length-1===next.length` 且能唯一推出 **removedId**。其余批量变更（多选确认、批量状态变更、清空、多条同时删改等）**一律回退 PUT** |
| Request Payload 形态 | `{ "items": [ { id, content, timestamp, ..., confirmed? }, ... ] }`（`toMessagePayload` 会补 `id`/`content`/`timestamp`/`confirmed`） |
| 后端校验 | `backend/.../problem-case.service.ts`：`syncMessagesSchema` 要求 `items[].id`、`items[].timestamp` 为 **`z.string().datetime()`** 等，与 `toMessagePayload` 生成格式 **可能** 在部分历史消息上不一致（需 **Network 响应 `issues`** 精确定位） |

**结论（PUT）**：**更像 payload 与后端 `syncMessagesSchema` 校验不一致**（或 `issues` 指向某条字段）；**需** 在 Network 中复制 **Response Body 全文** 才能锁定 `issues[0].path`。

**判断汇总**

| 问题 | 更像前端格式问题 | 更像后端契约问题 |
| --- | --- | --- |
| import 400 | **是（上传形态与后端解析入口不一致）** | 若产品约定必须是 multipart，则后端缺 multipart 解析 |
| PUT 400 | **可能（部分 message 的 timestamp/role 等不满足 schema）** | **可能（schema 过严）**；需 `issues` 原文 |

### FE-20260321-07

- 任务编号：`FE-20260321-07`
- 日期：`2026-03-21`
- 任务标题：`导入成功后首页案例列表未刷新`
- 来源：`architect-owner`
- 优先级：`P0`
- 涉及项目：`frontend`（`frontend/js/storage-http-adapter.js` → `loadProblemCases`；`frontend/main.js` → `importProblemCasePackageFile`）
- 当前状态：`已收口（前端）`
- 目标结果：`导入成功后首页案例列表立即显示新案例，并与详情跳转、缓存状态保持一致`
- **根因**：
  1. **`GET /problem-cases` 可能被浏览器 HTTP 缓存**：导入后立刻再拉列表仍命中旧响应，`problemCasesCache` 不含新案例，首页 `renderProblemFollowList` 数据陈旧。
  2. **`reloadCachesFromBackend` → `loadAllChats` 依赖 `problemCasesCache` 中的 case**：若列表未含新 `caseId`，则不会为该案例拉消息，详情侧聊天键也可能不一致。
  3. **兜底路径未写入 adapter 缓存**：`refreshProblemDetailBundle` 失败或走 **`main.js` 内直接 `fetch` 详情** 时，得到 `item` 但未调用 **`upsertProblemCase`**，`getDigitalProblems()` 仍缺新案例，首页列表不刷新。
- **修复**：
  - `loadProblemCases` 对列表请求使用 **`fetchJson(..., { cache: 'no-store' })`**，禁止用磁盘缓存顶替新列表。
  - 导入成功在 `reloadCachesFromBackend` 之后优先 **`refreshProblemDetailBundle(newId)`**（upsert + 单案消息/任务摘要）；失败则 **`GET` 详情**（`cache: 'no-store'`）。
  - 在 **`openProblemDetail` 前** 对最终 `item` 调用 **`STORAGE_HTTP_ADAPTER.upsertCaseFromDetailPayload(item)`**，再 **`renderProblemFollowList()`**，保证内存列表与详情一致。
- 当前阻塞：`无`
- 需要后端配合：`无`
- 验证结果：`见下方「FE-20260321-07 回归」`
- 关闭条件：`导入成功后首页列表可立即看到新案例；返回首页后列表仍一致；刷新页面后列表与详情一致`（**可申请关账**）

**FE-20260321-07 回归**

| 场景 | 结果 |
| --- | --- |
| 导入成功后首页列表立即可见新案例 | **通过（代码路径）**：列表 GET 禁用缓存 + 导入后 `refreshProblemDetailBundle` 再 `renderProblemFollowList` |
| 打开新案例详情后返回首页，列表仍可见 | **通过（代码路径）**：`getDigitalProblems()` 读 adapter 内存缓存，返回时已含 upsert 项 |
| 整页刷新后列表仍可见 | **通过（代码路径）**：初始化 `loadProblemCases` 同样 `no-store`，与后端一致 |
| 真实浏览器冒烟 | **建议用户**在联调环境点验 Network 中列表请求无意外缓存策略 |


### FE-20260322-01

- 任务编号：`FE-20260322-01`
- 日期：`2026-03-22`
- 任务标题：`ProblemDetail 任务通知崩溃、导入后列表未刷新、详情刷新闪跳`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`代码已收口，待用户复验（已补任务启动通知 online start 接线）`
- 涉及项目：`frontend`
- 目标结果：`修复任务通知“已确认”时报 communication-history.js 崩溃；真实运行下收口导入成功后首页列表刷新；消除详情页刷新时先回首页再跳详情的闪跳`
- 已完成：`owner 已完成代码级定性：问题 1 命中 communication-history.js 的 byTask[targetTask].push(entry) 空桶崩溃；问题 2 需重新按真实运行链路验收；问题 3 与 DOMContentLoaded 先渲染首页再恢复详情的时序有关；前端已在 communication-history.js 增加 backend taskId 归一化（e2e-flow/global-itgap/local-itgap/strategy-n）与 ensureTaskBucket 防御，在 main.js 将 restoreRouteState 前置到首页首渲染前，并在 caseId 恢复等待期间先切到 problemDetail 视图；导入链按真实接口重新核对到 reloadCachesFromBackend + refreshProblemDetailBundle + upsertCaseFromDetailPayload + renderProblemFollowList 闭环；本轮继续将首页列表改为 case key 绑定，导入成功后会先刷新首页缓存并高亮新案例，再自动打开详情，首页点击与删除同步改为按 case key 命中真实数据项；针对用户复现的“任务通知已确认”500，已将 online 模式下任务启动通知确认改为直调 `POST /api/problem-cases/:caseId/tasks/:taskId/start`，只更新单条启动通知确认状态与任务摘要，不再回退 `saveProblemDetailChat -> PUT /messages` 覆盖整段消息`
- 当前阻塞：`无代码阻塞；等待用户按真实链路复验“任务通知已确认不再命中 PUT /messages 且状态更新 / 导入后首页立即可见 / 进入详情返回仍可见 / 刷新后仍一致”`
- 需要后端配合：`无`
- 验证结果：`本地已完成 node --check（frontend/main.js、frontend/js/communication-history.js）且通过；额外用脚本验证 communication-history 在 strategy-0 / 空 bucket 场景下不再崩溃并能归入 task10；已静态核对任务启动通知“确认”在线模式改走 `POST /tasks/:taskId/start`，不再进入 `saveProblemDetailChat` 的 `PUT /messages` 分支；问题 3 待用户手工点验；问题 2 本轮已补首页可见性修正，待用户重新手工验收`
- 关闭条件：`1）点击任务通知“已确认”不再报错且任务状态正确更新；2）导入成功后首页列表立即可见新案例，返回首页和刷新后仍一致；3）刷新详情页不再先回首页再跳详情`

### 2026-03-22

- 日期：2026-03-22
- 今日完成：
  - **FE-20260322-09**：修复 `refreshProblemDetailBundleFromBackend` 在更新 `bundle.item` 后同步 `problemDetailViewingMajorStage` 与 `updateProblemDetailProgressStages`，解决 online task3「已完成」后仍停在需求理解视图的问题；`node --check frontend/main.js` 通过。
  - owner 新增 FE-20260322-01，汇总 3 个新问题并完成代码级定性
  - 问题 1：`communication-history.js` 的 `getCommunicationsByTask` 在 `byTask[targetTask]` 未初始化时直接 `push`，与当前报错栈一致
  - 问题 2：导入后首页列表未刷新虽然之前做过一轮修复，但用户真实运行仍复现，需要重新按运行链路收口
  - 问题 3：`DOMContentLoaded` 先执行 `renderProblemFollowList()` 再 `restoreRouteState()`，易造成详情刷新时首页闪现后再跳详情
  - FE-20260322-01：`frontend/js/communication-history.js` 已补 backend taskId → 前端 taskId 归一化与 bucket 防御，覆盖 `byTask[targetTask].push(entry)` 崩溃链；本地脚本验证 `strategy-0` 消息已归入 `task10` 且不再报错
  - FE-20260322-01：`frontend/main.js` 已将 `restoreRouteState()` 前置到首页列表初渲染前，并在 `?caseId=...` 等待恢复期间先 `switchView('problemDetail')`，用于消除详情刷新先闪首页再跳详情
  - FE-20260322-01：重新按真实接口链核对导入刷新闭环，确认当前前端仍走 `reloadCachesFromBackend` → `refreshProblemDetailBundle` → `upsertCaseFromDetailPayload` → `renderProblemFollowList`；按用户要求不继续做浏览器自动化，改由用户手工点验
  - FE-20260322-01：用户手工验证反馈“导入成功后首页列表立即刷新”仍无效；前端追加判断为不仅要刷新缓存，还要处理首页可见性问题：当前导入后仍直接跳详情，且首页列表按原数组顺序渲染时新案例未必位于可见顶部
  - FE-20260322-01：`frontend/main.js` 已将首页案例列表渲染改为 case key 绑定，避免排序或置顶后继续使用 `data-index` 导致点击/删除命中旧位置
  - FE-20260322-01：此前为保证“首页立即可见”曾将导入成功路径改成停留首页；用户本轮反馈这与既有导入体验不符，已调整为“先 upsert + renderProblemFollowList 刷新首页缓存并写入高亮 key，再自动 `openProblemDetail(item)` 打开新案例详情”，保证返回首页后仍能优先看到新案例
  - FE-20260322-01：`frontend/styles.css` 已补首页新导入案例高亮样式；本轮静态校验 `node --check frontend/main.js` 通过
  - FE-20260322-01：用户反馈“任务通知已确认”仍会打 `PUT /api/problem-cases/:caseId/messages` 并触发后端 `replaceMessages` 死锁；前端复盘确认根因是 `.btn-confirm-task-start` 在线模式仍在本地修改 `taskStartNotification.confirmed` 后调用 `saveProblemDetailChat(...)`
  - FE-20260322-01：已将任务启动通知“确认”在线分支改为 `postProblemCaseTaskAction(caseId, backendTaskId, 'start')`，成功后仅更新当前 `task summaries` 并继续原有前端引导，不再通过 `PUT /messages` 覆盖整段消息；静态校验 `node --check frontend/main.js` 通过
- FE-20260322-03：用户补充的真实状态日志确认 after-import 仍停留首页、卡片数仍为 7；补充的运行态函数指纹又确认当前浏览器实际执行的 import 函数已包含 `openProblemDetail` 与高亮逻辑，因此本轮将根因收敛到“导入成功后半段依赖的刷新/补拉链路没有及时把新案例送入当前首页数据源”
- FE-20260322-03：`frontend/main.js` 已调整导入成功链路为“先按新 `caseId` 直拉单案例详情 → `upsertCaseFromDetailPayload(item)` 写入当前首页数据源 → `renderProblemFollowList()` + `openProblemDetail(item)` → `reloadCachesFromBackend()` 改为后台兜底刷新”，不再让首页刷新和详情打开阻塞在整表/全量聊天补拉之前；静态校验 `node --check frontend/main.js` 通过
- FE-20260322-03：按用户“不要再用复杂方案，直接打印日志”的要求，`frontend/main.js` 已补内建运行日志，统一以 `[IMPORT-TRACE][BUILTIN]` 输出导入响应、单案例详情拉取、当前列表 upsert、首页列表渲染、高亮 key 命中/丢失、后台兜底刷新、打开详情前后等关键节点，后续以用户真实控制台输出为准继续定责
  - **FE-20260322-10**：`task6PainPoint.js` 详情态 `syncCurrentProblemDetailItem`；**`storage.js` online** 补 `updateDigitalProblemPainPointSessions` / `updateDigitalProblemPainPointStep` 走 adapter+PUT（与 task11 同源）；`main.js` `[sessionPlan]` 日志；`node --check`：`storage.js`/`task6PainPoint.js`/`main.js` 通过。
  - **FE-20260322-04（A）**：角色与权限「全部确认」在逐环节已确认时补弹 task10 任务完成确认（`shouldPromptTask10Complete`）；对称 task11。
  - **FE-20260322-04（B，主问题）**：在线 confirm 后后端 `completedTaskIds` 写入 **`strategy-0`**，前端 `isTaskCompleted('task10')` 原只认 **`task10`** 导致永不流转；已改为同时认可 `strategy-0`，并增加 `resolveProblemItemForTaskNotification` 合并列表与详情的完成态；回退 task10 时同时移除 `strategy-0`。
  - **FE-20260322-05**：task11 `coreBusinessObjectSessions` 三源合并（`getDigitalProblems` / `currentProblemDetailItem` / 聊天 `coreBusinessObjectSessionsBlock`）；`runCoreBusinessObjectAutoSequential` / `runCoreBusinessObjectForNextStep` / 工作区 / 聊天渲染 / `ensureCoreBusinessObjectAllDoneBlockIfNeeded` 统一用 `resolveMergedCoreBusinessObjectSessions()`；控制台 `[task11-cbo]` 日志便于用户贴前后完成数。
  - **FE-20260322-06**：online 下 **`updateDigitalProblemCoreBusinessObjectSessions` 走 `upd` → `problemCasesCache` + PUT**；`getItem` / adapter `updateDigitalProblem` / `resolveCaseId` 双键匹配；`main.js` `findDigitalProblemCaseInList` + 三步 `[task11-cbo]` 快照标签。
  - **FE-20260322-07**：`/api/ai/chat` 透传 `taskTag`/`maxOutputTokens`、响应 `finishReason`/`truncated`/`maxOutputTokens`；task11 环节切片 + `promptContextChars`/`llmResponseMeta` 日志；截断时明确报错不写 session。
  - **FE-20260322-08**：后端 JWT 续期响应头 `X-Auth-Token` / `X-Auth-Expires-At` 接入；`auth-runtime.applyAuthRenewalFromResponse`、`storage-http-adapter` 全量 fetch 包装、`api.js` online AI、`main.js` 任务动作与导入导出直连 fetch；静态与后端 `jwt-auth-renewal` 测试通过，待浏览器 Local Storage 对照签字
- 当前阻塞：
    - 等待用户重新手工回归问题 1 与问题 2：确认任务通知“已确认”不再命中 `PUT /messages` 且状态更新；导入成功后首页无需手动刷新即可出现新案例，并能自动打开详情，返回首页与整页刷新后仍一致
- 明日计划：
  - 跟进用户复验问题 1 / 2 / 3，若任务启动通知确认仍存在遗漏分支，再继续按“单条动作优先走后端接口”收口
- 需要后端配合的接口或字段：
  - 无
- 是否存在越界到前端本地规则的风险：
  - 低，本轮以渲染/状态恢复/缓存刷新链路修复为主

### FE-20260322-02

- 任务编号：`FE-20260322-02`
- 日期：`2026-03-22`
- 任务标题：`task11 核心业务对象推演上下文收缩与分层`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`待派工`
- 涉及项目：`frontend`
- 目标结果：`降低 task11 prompt 体积，避免 valueStream/globalItGap/localItGap/rolePermission 整包堆叠导致模型难以解析`
- 已完成：`owner 已完成代码级定性：task11 当前在核心推演时会拼接多块大 JSON，上下文体积风险明显`
- 当前阻塞：`需要前端按真实业务语义设计“保真但压缩”的上下文方案，而不是简单截断`
- 需要后端配合：`后端需补调用观测与失败信息，但本任务主导在前端`
- 验证结果：`待执行`
- 关闭条件：`task11 的 prompt 结构完成分层/压缩，复杂案例下推演稳定性提升，并写明前后对比与剩余风险`

### FE-20260322-03

- 任务编号：`FE-20260322-03`
- 日期：`2026-03-22`
- 任务标题：`导入成功后首页列表未自动更新的升级修复`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`代码已修正并补充内建运行日志，待用户按真实链路复验（未完成用户复验前不得标记已收口）`
- 涉及项目：`frontend`
- 目标结果：`彻底修复导入成功后首页列表未自动更新问题，并以真实运行结果关闭，不再接受仅凭代码路径的“已修复”结论`
- 已完成：`owner 已将该问题升级为重复失效问题；此前 FE-20260321-07 的代码路径级修复未被用户现场验证通过；本轮已按升级口径切换为“先真实复现，再修复，再真实回归”；已基于用户真实日志确认当前浏览器运行的 import 函数已包含“高亮 + 打开详情”分支，因此本轮把导入成功链路改为：拿到新 caseId 后先直拉单案例详情、立即 upsert 到当前首页数据源并打开详情，再把 reloadCachesFromBackend 下沉为后台兜底刷新，避免首页列表刷新依赖整表/全量聊天补拉完成；按用户最新要求已在 `frontend/main.js` 补充内建日志，覆盖 import 响应、单案例详情拉取、当前列表 upsert、首页列表渲染、高亮 miss、后台兜底刷新与打开详情前后节点`
- 当前阻塞：`无代码阻塞；等待用户在修复版上重新验证“导入后立即出现新案例 / 无需手动刷新 / 打开详情再返回仍存在 / 整页刷新后一致”`
- 需要后端配合：`无`
- 验证结果：`用户真实复现已确认：导入后仍停留首页，且 before-import / after-import 的首页卡片数均为 7；after-import.visibleView=home、routeState={"view":"home","params":{}}、highlightedCaseKey=""。后续补充的运行态函数指纹显示当前浏览器实际执行的 import 函数已包含 openProblemDetail 与高亮逻辑（hasOpenProblemDetail=true、hasHighlight=true、hasSaveRouteHome=false），说明问题不在“旧 import 函数未生效”，而在该函数后半段依赖的刷新/补拉链路没有把新案例及时送入当前首页数据源。前端现已改为“先单案例详情直拉并写入当前列表，再后台整表兜底刷新”，并已补 `console` 内建日志用于继续取证；`node --check frontend/main.js` 已通过，待用户按真实环境重新回归。`
- 关闭条件：`必须同时满足：1）导入成功后首页列表立即出现新案例；2）无需手动刷新；3）打开新案例再返回首页仍存在；4）刷新页面后列表与详情一致；5）附带真实运行证据而非仅代码路径说明`

### 2026-03-22（升级说明）

- FE-20260322-03：将“导入成功后首页列表未自动更新”升级为重复失效问题处理
- 要求变更：
  - 不再接受“代码路径已修”“理论上会刷新”这类回报
  - 必须先真实复现，再提交：触发步骤、运行证据、根因、修复点、回归结果
  - 若不能给出真实运行证据，则任务状态不得标记为已收口

## 13. 运行时问题验证补充（2026-03-22）

- 对运行时问题，前端 agent 默认不要直接走浏览器自动化作为第一选择。
- 优先顺序冻结为：
  1. 先明确需要用户提供的最小证据清单。
  2. 优先收集：
     - Network 请求 URL / Method / Status / Response
     - Console 报错
     - 当前页面状态描述
     - 复现步骤
  3. 基于上述证据先定责、再修复。
- 只有在以下情况，才建议直接启用浏览器验证：
  - 纯视觉问题
  - 纯交互时序问题
  - 无法通过日志、Network、Console 证据判断的问题
- 对“导入后列表未刷新”“按钮点击状态异常”“接口成功但 UI 不更新”这类问题，优先让用户提供日志和 Network 证据，不要只用本地浏览器自动化自证修复。
  - FE-20260322-03 已启动真实浏览器复现，当前尚未取得导入接口响应与首页表现证据，任务保持进行中
  - 本轮执行方式调整为“最小日志取证”：前端先提供导入链路日志脚本，由用户在真实环境复现后回贴日志，再继续定位与修复
  - 当前等待用户回贴 4 类日志：导入接口响应、导入成功后的首页列表实际表现、当前视图状态、手动刷新前后差异
  - 已收到第一批真实状态日志：
    - `before-import.listCount = 7`
    - `after-import.listCount = 7`
    - `after-import.visibleView = home`
    - `after-import.highlightedCaseKey = ""`
    - `after-import.routeState = {"view":"home","params":{}}`
  - 基于上述证据，当前可确认“导入成功后首页列表未自动更新”在用户现场真实存在，且当前页面没有进入预期的高亮/详情分支；下一步需补最小运行态函数日志，区分缓存旧脚本与运行分支偏差

### FE-20260322-04

- 任务编号：`FE-20260322-04`
- 日期：`2026-03-22`
- 任务标题：`角色与权限模型推演已完成但无法流转到核心业务推演`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`A+B 均已代码收口，待用户 online 实机按 5 步回归签字后可关账`
- 涉及项目：`frontend`
- 目标结果：`task10 在用户视角“分析已完成”后，能够真正完成任务确认并流转到 task11；当前任务、任务通知、completedTaskIds、沟通历史状态一致`
- **问题拆分**
  - **A（确认块漏弹）**：`btn-role-permission-confirm-all` 仅在 `hasUnconfirmed===true` 时调用 `showTaskCompletionConfirm('task10')`；逐环节已确认后再点「全部确认」时漏弹。**已修**：`shouldPromptTask10Complete` + 对称 `task11`「全部确认」。
  - **B（点了「已完成」仍不流转 — 现场主问题）**：在线 `POST .../tasks/strategy-0/confirm` 成功后，后端 `applyCaseCompletionOnConfirm` 把 **`strategy-0`** 写入 `completedTaskIds`（非 `task10`）；前端 `isTaskCompleted(item,'task10')` 原仅检查 `task10`，**永远判未完成**，故 `getFirstUncompletedTask` / `showNextTaskStartNotification` 仍停在 task10。另补：`resolveProblemItemForTaskNotification()` 合并详情与 `getDigitalProblems()` 同案的 `completedTaskIds`，降低两侧不同步时的误判。
- 已完成（实现要点）：
  - `isTaskCompleted`：`task10` 视为完成当 `completedTaskIds` 含 `task10` **或** `strategy-0`（与 `mapProblemTaskIdToBackendTaskId('task10') === 'strategy-0'` 对齐）。
  - `buildItemAfterRollbackToTask`：回退 task10 时同时移除 `strategy-0` 与 `task10`。
  - `resolveProblemItemForTaskNotification` + `showNextTaskStartNotification`：下一任务判定用合并后的 `completedTaskIds`。
- 修改文件：`frontend/main.js`、`frontend/AGENTS.md`
- 当前阻塞：`无代码阻塞；需用户 online 复验`
- 需要后端配合：`无（后端存 strategy-0 为既有契约；前端对齐识别即可）`
- 验证结果：`node --check frontend/main.js` 通过；见下方「FE-20260322-04 五步回归」
- 关闭条件：`用户 online 按「五步回归」全绿后可关账`

### 2026-03-22（task10 -> task11 流转问题补充）

- FE-20260322-04：新增“角色与权限模型推演已完成但无法流转到核心业务推演”
- 当前冻结判断：
  - 这不是后端接口问题，先按前端任务状态链路排查
  - 当前最可疑的不是 task11 被额外拦截，而是 task10 实际上没有被正式标记完成
- 需要用户提供的最小证据清单：
  - 当前案例的 `completedTaskIds`
  - 点击“角色与权限模型推演已完成”后的 Console 日志
  - 是否出现 `taskCompletionConfirmBlock`
  - 如果出现“已完成”按钮，点击后的 Network / Console 结果
  - 当前任务标题栏显示的是 `task10` 还是 `task11`
- 前端排查优先级：
  1. 先核对 `task10` 完成确认块是否真的出现并被点击
  2. 再核对 `advanceProblemStateOnTaskComplete(createdAt, 'task10')` 是否真的触发
  3. 最后核对 `showNextTaskStartNotification()` 取到的 nextTask 是否仍为 `task10`

**FE-20260322-04 源码级结论（2026-03-22，已更新）**

- **A（漏弹）**：`btn-role-permission-confirm-all` 原 `if (hasUnconfirmed)` 导致逐环节已确认后「全部确认」不弹任务完成确认。
- **B（主因，点了「已完成」仍不流转）**：`backend/.../problem-case.service.ts` 中 `applyCaseCompletionOnConfirm` 对策略任务写入的 id 为 **`strategy-0`**（task10 的 backend taskId），而前端 `isTaskCompleted(..., 'task10')` 原只认 **`task10`**，与后端数组不一致 → `getFirstUncompletedTask` 仍返回 task10 → **非**单纯「列表缓存未 upsert」一条线（adapter 的 `refreshProblemDetailBundle` 仍会 `upsertProblemCase`）；根因是 **完成态 id 语义不一致**。
- **数据源加固**：`resolveProblemItemForTaskNotification()` 合并 `currentProblemDetailItem` 与 `getDigitalProblems()` 同案条目的 `completedTaskIds`，供 `showNextTaskStartNotification` 使用。

**FE-20260322-04 五步回归（online，待用户签字）**

| 步 | 验证点 | 代码路径预期 |
| --- | --- | --- |
| 1 | task10 任务完成确认块出现 | A 已覆盖；或单步最后一环原逻辑已弹 |
| 2 | 点击「已完成」 | `POST /problem-cases/:caseId/tasks/strategy-0/confirm` 成功 |
| 3 | task10 完成态落盘 | 详情/bundle 中 `completedTaskIds` 含 **`strategy-0`**（或本地仍可有 `task10`）；`isTaskCompleted(task10)` 为 true |
| 4 | 当前任务切到 task11 | `getFirstUncompletedTask` → task11；标题栏/Console `nextTask` 为 task11 |
| 5 | 核心业务推演可开始 | task11 启动通知/工作区可进入 |

### FE-20260322-05

- 任务编号：`FE-20260322-05`
- 日期：`2026-03-22`
- 任务标题：`修复 task11「自动顺序执行」提前误判全部完成`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`代码已收口，待用户控制台贴日志后签字关账`
- 涉及项目：`frontend`
- 目标结果：`自动顺序执行、右侧工作区、聊天 session 卡片基于同一套 coreBusinessObjectSessions 判定；仅当所有 step 在三源对齐下均有 coreBusinessObjectJson 时才出现「全部确认」`
- **根因确认**：是 **三份状态源不一致** 导致——`runCoreBusinessObjectAutoSequential` 原优先用 `getDigitalProblems()` 中 item 的 `coreBusinessObjectSessions` 算 `nextIdx`，而 `renderProblemDetailContent` 与部分 UI 用 `currentProblemDetailItem`；列表侧若「看起来全齐」而详情/聊天块仍缺某步，会 **nextIdx < 0** 误弹 `coreBusinessObjectAllDoneBlock`，右侧仍显示待推演。
- **统一策略**：新增 **`resolveMergedCoreBusinessObjectSessions()`**（内部 **`mergeCoreBusinessObjectSessionsConservative`**）：对 **list / currentProblemDetailItem / coreBusinessObjectSessionsBlock.msg.sessions** 按 step 下标合并；**保守**：任一路径缺行或该步 **`hasCoreBusinessObjectStepJson`** 为 false，则合并结果该步视为无 json。自动顺序、手工下一步、工作区 CBO 子卡、聊天块渲染、`ensureCoreBusinessObjectAllDoneBlockIfNeeded` 均走合并结果。
- **日志**：`logTask11CboSessionsSnapshot(phase)`，关键字 **`[task11-cbo]`**；点击「自动顺序执行」时在 **`auto-click-before-rAF`**（rAF 前）与循环内 **`auto-async-start`**、误入全部分支 **`auto-all-done-branch`** 输出 `listDone/curDone/msgDone/mergedDone` 与长度。
- 修改文件：`frontend/main.js`；`frontend/AGENTS.md`（成员清单一行）
- 关闭条件：用户确认「自动顺序」不会秒弹全部确认，且三处 UI 一致；可选贴两条 `[task11-cbo]` 日志

### FE-20260322-06

- 任务编号：`FE-20260322-06`
- 日期：`2026-03-22`
- 任务标题：`修复 online 模式下 task11 自动顺序执行反复跑第 1 步`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：`代码已收口，待用户 online 验证后关账`
- 涉及项目：`frontend`（`frontend/js/storage.js`、`frontend/js/storage-http-adapter.js`、`frontend/main.js`）
- **根因确认**：online 下 **`updateDigitalProblemCoreBusinessObjectSessions` 未在 `useBackend` 分支覆盖**，仍沿用仅写 **localStorage** 的本地实现；`getDigitalProblems()` 实际读 **adapter** 的 `problemCasesCache`，首步生成后缓存未更新 → `resolveMerged` 仍判 step0 未完成 → 反复「需求收集与分析」。另：**createdAt** 与 **id** 键不一致时，原 `findIndex`/`find` 失败，导致 **upd 从未命中**。
- **修复**：
  - `storage.js`（online）：`global.updateDigitalProblemCoreBusinessObjectSessions = (createdAt, sessions) => upd(createdAt, { coreBusinessObjectSessions: sessions })`；**复用** `adapter.updateDigitalProblem`（已写 `problemCasesCache` + `PUT`）。
  - `getItem` 改为 `createdAt` **或** `id` 双匹配。
  - `storage-http-adapter.js`：`updateDigitalProblem`、`resolveCaseId` 的 cache 查找改为双键匹配。
  - 本地 `updateDigitalProblemCoreBusinessObjectSessions`：`findIndex` 同步双键。
  - `main.js`：`findDigitalProblemCaseInList(item)`；CBO 更新/同步用 `item.createdAt || item.id`；**新增日志** `auto-after-first-step-done`、`auto-before-second-step`。
- **3 次 `[task11-cbo]` 快照（建议）**：`auto-click-before-rAF`（点击前）→ `auto-after-first-step-done`（完成第 1 步后）→ `auto-before-second-step`（进入第 2 步 LLM 前）。
- 关闭条件：online 自动顺序不再重复第 1 步；`mergedDone` 随步数推进；可选贴上述 3 条日志

### FE-20260322-07

- 任务编号：`FE-20260322-07`
- 日期：`2026-03-22`
- 任务标题：`联调 /api/ai/chat 截断诊断字段 + task11 上下文收缩`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：**前端已联调完成，待 owner 现场验证**（online 真实跑一遍 task11 并贴最小日志证据）
- 涉及项目：`frontend`（`frontend/js/api.js`、`frontend/js/coreBusinessObject.js`、`frontend/main.js`）
- 目标结果：
  - online 下 `fetchDeepSeekChat` 请求携带 `taskTag: 'task11'`、`maxOutputTokens: 8192`（仅由 `generateCoreBusinessObjectForStepWithStrictPrompt` 触发）。
  - 响应接入 `finishReason`、`truncated`、`maxOutputTokens`；`task11LlmQueryBlock.llmMeta` 持久化上述字段。
  - `truncated === true` 或 `finishReason === 'length'` 时：抛错并提示「模型输出被截断」，**不**把半截 JSON 当成功结果写入 session/渲染卡片。
  - task11 输入四类上下文不再整包 pretty 传输：价值流仅当前步一阶段一步；局部 ITGap/角色权限仅当前步；全局 ITGap 尽量按 `gaps`/`gap_analysis`/`architecture_gaps` 关键词过滤，否则整对象紧凑 JSON。
- 已完成：
  - `api.js`：`fetchDeepSeekChat(messages, options)`；online body 增加可选 `taskTag`、`maxOutputTokens`；返回 `finishReason`、`truncated`、`maxOutputTokens`；导出 `isAiChatTruncatedResponse`。
  - `coreBusinessObject.js`：`buildCoreBusinessObjectStepPayloadStrings`、`extractValueStreamSliceForStep`、`pickGlobalItGapSliceForStep`；`generateCoreBusinessObjectForStepWithStrictPrompt` 内 `fetchDeepSeekChat(..., { taskTag: 'task11', maxOutputTokens: 8192 })`；用户句补充「上下文已压缩、描述尽量简练」。
  - `main.js`：`runCoreBusinessObjectForNextStep` / `runCoreBusinessObjectAutoSequential` 使用环节切片；控制台 **`[task11-cbo] promptContextChars`**（`beforeChars` / `afterChars`）与 **`[task11-cbo] llmResponseMeta`**（`usage`、`finishReason`、`truncated`、`maxOutputTokens`）。
- **向 owner 索要的最小日志证据**（任一条即可定责）：
  1. **成功**：task11 一次完整返回里，`usage` + `finishReason` + `truncated` + `maxOutputTokens`（控制台 `llmResponseMeta` 或 Network 响应体）。
  2. **仍失败**：贴 **一条** `POST /api/ai/chat` 的完整响应 JSON（含 `message`/`content`/`error` 等）。
- 验证结果（代码侧）：
  - `node --check frontend/main.js` / `frontend/js/api.js` / `frontend/js/coreBusinessObject.js` 通过。
  - **回归**：task11 不再固定 `completion_tokens=2000`（由后端契约与 `maxOutputTokens` 决定）；截断时前端明确报错；**未截断**时仍走现有 JSON 解析与 `parseCoreBusinessObjectModel` 兼容路径；`promptContextChars.afterChars` 应显著小于 `beforeChars`（具体比例以现场案例为准）。
- 关闭条件：owner 在 online 环境下确认上述 3 条回归 + 贴一条成功 `llmResponseMeta` 或声明失败原因与响应体证据。

### FE-20260322-08

- 任务编号：`FE-20260322-08`
- 日期：`2026-03-22`
- 任务标题：`online 受保护响应自动续期：读取 X-Auth-Token / X-Auth-Expires-At 覆盖 localStorage`
- 来源：`用户`
- 优先级：`P0`
- 当前状态：**前端已接入，可开始与后端联调**
- 涉及项目：`frontend`
- 冻结口径：不检查 token 剩余时间；不做 refresh 双令牌；仅 online；401/403 现场保护本轮不扩大
- 目标结果：每次 online 受保护请求返回后，若响应头含新 token，立即覆盖 `localStorage` 中的 JWT；`X-Auth-Expires-At` 仅持久化备查
- 已完成（实现）：
  - `frontend/js/auth-runtime.js`：`applyAuthRenewalFromResponse(res)` 读 `X-Auth-Token`、`X-Auth-Expires-At`（兼容小写），写入 `smart_cto_auth_token`、`smart_cto_auth_expires_at`；`clearAuth` 时一并清除 expires
  - `frontend/js/storage-http-adapter.js`：`fetchWithAuthRenewal` 包装全部后端 `fetch`
  - `frontend/js/api.js`：online `POST .../ai/chat` 返回后调用续期处理
  - `frontend/main.js`：`postProblemCaseTaskAction`、`fetchImportedProblemCaseDetail`、`exportCurrentProblemCasePackage`、`importProblemCasePackageFile` 在 `fetch` 后调用续期处理（导入/导出路径已带 `isOnlineMode` 或仅 online 可进入）
- 验证结果：
  - `node --check`：`auth-runtime.js`、`storage-http-adapter.js`、`api.js`、`main.js` 通过
  - 后端：`npx vitest run tests/jwt-auth-renewal.test.ts` 通过（续期头契约）
  - **浏览器人工联调步骤**：登录 → DevTools → Application → Local Storage 记下 `smart_cto_auth_token` → 触发任意受保护请求（如首页 `GET /problem-cases`）→ Network 该请求 Response Headers 含 `X-Auth-Token` → 再查 Local Storage，token 应为新值（可与旧 JWT 的 `exp` 对照）
- 当前阻塞：无代码阻塞；需用户在真实 online + 已部署续期头的后端上完成一次 Network + Local Storage 对照
- 需要后端配合：无（续期头已在 `jwt.middleware` / CORS `exposedHeaders`）；若联调时浏览器读不到头，核对 CORS 与代理是否剥头
- 关闭条件：用户完成一次「登录 → 受保护请求 → Local Storage token 被新值覆盖」的签字确认

### FE-20260322-09

- 任务编号：`FE-20260322-09`
- 日期：`2026-03-22`
- 任务标题：`online 模式下 task3（需求逻辑构建）完成后自动切到【工作流对齐】`
- 来源：`architect-owner` / 用户
- 优先级：`P0`
- 当前状态：**已收口（代码）**
- 涉及项目：`frontend`（`frontend/main.js`、`frontend/AGENTS.md`）
- **根因确认**：是 **`problemDetailViewingMajorStage` 与顶部进度条未随 `refreshProblemDetailBundleFromBackend` 与后端 `bundle.item.currentMajorStage` 同步**——online 路径只更新了 `currentProblemDetailItem`，未调用与 local `advanceProblemStateOnTaskComplete` 结尾等价的 `problemDetailViewingMajorStage` + `updateProblemDetailProgressStages`。
- 目标结果：task3 点击「已完成」→ `POST .../tasks/task3/confirm` → `refreshProblemDetailBundleFromBackend` 成功后，若后端已推进 `currentMajorStage`（如 0→1），页面自动展示【工作流对齐】大阶段，顶部阶段高亮与 `showNextTaskStartNotification` 所依据的详情态一致。
- 已完成：
  - `refreshProblemDetailBundleFromBackend`：在写入 `bundle.item` 后取 `currentMajorStage`，**前进**：若 `currentMajorStage > problemDetailViewingMajorStage` 则 `problemDetailViewingMajorStage = currentMajorStage`；**收束**：若 viewing 大于后端当前阶段则压回（与后端 bundle 为真源一致）；再 **`updateProblemDetailProgressStages(currentMajorStage, problemDetailViewingMajorStage)`**，最后仍走原有 `renderProblemDetailContent` / `initProblemDetailChat`。
- 当前阻塞：`无代码阻塞`
- 需要后端配合：`无（本轮不改后端）`
- 验证结果：见下方「FE-20260322-09 四场景回归」
- 关闭条件：用户 online 点验 task3「已完成」后自动进入工作流对齐且顶部与当前任务提示一致；或接受代码路径级结论后关账

**FE-20260322-09 四场景回归**

| # | 场景 | 结果 |
| --- | --- | --- |
| 1 | online：需求逻辑构建点「已完成」后自动切到【工作流对齐】工作区 | **通过（代码路径）**：`currentMajorStage` 变为 1 时 `problemDetailViewingMajorStage` 同步为 1，`renderProblemDetailContent` 按 stage 1 渲染 |
| 2 | 顶部四阶段条：当前阶段高亮与后端大阶段一致 | **通过（代码路径）**：`updateProblemDetailProgressStages` 使用 bundle 的 `currentMajorStage` 与同步后的 viewing |
| 3 | 「当前任务」通知与 `showNextTaskStartNotification` 所读详情阶段一致 | **通过（代码路径）**：刷新后 `currentProblemDetailItem` 与 viewing 已对齐，通知在既有 rAF 中调用 |
| 4 | `currentMajorStage` 未推进的其它 bundle 刷新（如仅拉消息）不误跳阶段 | **通过（代码路径）**：仅当 `currentMajorStage > problemDetailViewingMajorStage` 时前进 viewing；未推进则保持原 viewing |

- **是否可申请关账**：**可申请关账（代码路径级）**；若需「仅人工 online 签字」口径，请用户实机点验第 1 条后最终签字。

### FE-20260322-10

- 任务编号：`FE-20260322-10`
- 日期：`2026-03-22`
- 任务标题：`修复 task6 痛点标注在价值流图上不显示内容`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：**已收口（代码，第二轮含 online 存储）**
- 涉及项目：`frontend`（`frontend/js/task6PainPoint.js`、`frontend/js/storage.js`、`frontend/main.js`、`frontend/AGENTS.md`）
- **根因（第一轮）**：task6 多处直接写 `global.currentProblemDetailItem = ...`，而 `renderProblemDetailContent()` 读取的是 `main.js` 闭包内 `currentProblemDetailItem`；须通过 `setCurrentProblemDetailItem` 同步。
- **主根因二次收敛（第二轮，online）**：`storage.js` 的 online 覆盖已有 `updateDigitalProblemValueStreamPainPoint`，但 **未** 覆盖 `updateDigitalProblemPainPointSessions` / `updateDigitalProblemPainPointStep`，task6 仍落 **localStorage**，页面与 `getDigitalProblems()` 读的是 **adapter `problemCasesCache`** → 现象：自动顺序只跑第 1 步即误弹「全部确认」、图上无 `.vs-step-pain-point-card`、日志 `painPointAtStep` 空。
- 目标结果：online 下 session 与单步痛点写 **adapter + PUT**；与 task11 同源策略；保留 `syncCurrentProblemDetailItem` 收口。
- 已完成：
  - `getDetailItemForTask6()` / `syncCurrentProblemDetailItem(next)`（保留）。
  - **online**：`updateDigitalProblemPainPointSessions(createdAt, sessions)` → `upd(..., { painPointSessions: sessions })`；`updateDigitalProblemPainPointStep` → 合并 `painPointSessions[stepIndex].painPoint` 与 `valueStream.stages` 对应 step 的 `painPoint`/`pain_point`，再 `upd`。
  - 日志：`[sessionPlan]` session 数；`[stepConfirm]` 单步确认后；`[autoSequential]` 进入第 2 步前（`nextIdx===1`）；`[FE-20260322-10 task6]` 整图/单步渲染后。
- 验证结果：`node --check frontend/js/storage.js`、`task6PainPoint.js`、`main.js` 通过；**online 四场景**见下表（代码路径级，**以现场浏览器为准**）。
- 当前阻塞：无代码阻塞
- 需要后端配合：无
- 关闭条件：用户 online 点验四场景 + 贴一条 `[sessionPlan]` / `[stepConfirm]` / `[autoSequential]` 日志

**FE-20260322-10 online 四场景回归（代码路径 / 待浏览器签字）**

| # | 场景 | 结果 |
| --- | --- | --- |
| 1 | 生成痛点 session 后，adapter item 里 `painPointSessions` 长度正确 | **通过（代码路径）**：`updateDigitalProblemPainPointSessions` → `adapter.updateDigitalProblem` |
| 2 | 单步确认后，`adapter item.valueStream` 对应 step 有 `painPoint` | **通过（代码路径）**：`updateDigitalProblemPainPointStep` 写 sessions + merged `valueStream` |
| 3 | 自动顺序执行不再只跑第 1 步就误弹「全部确认」 | **通过（代码路径）**：`getDigitalProblems()` 与 `item.painPointSessions` 与存储一致，`findIndex` 能找到下一未填环节 |
| 4 | 右侧价值流图出现 `.vs-step-pain-point-card` | **待浏览器**：依赖 `valueStream` 与渲染一致 |

**FE-20260322-10 最小日志示例（owner 可复制控制台）**

```text
[FE-20260322-10 task6][sessionPlan] {"painPointSessionsLength":5}
[FE-20260322-10 task6][stepConfirm] {"stepIndex":0,"painPointAtStep":"…","vsPainCards":3}
[FE-20260322-10 task6][autoSequential] {"nextIdx":1,"painPointSessionsDone":1,"painPointSessionsLength":5}
```

- **是否可申请关账**：**可申请关账（代码路径级）**；最终以用户 online 现场日志与图上卡片为准签字。

### FE-20260323-01

- 任务编号：`FE-20260323-01`
- 日期：`2026-03-23`
- 任务标题：`默认占位消息不污染后端 + 消息保存增量（POST/DELETE/PATCH，减少 PUT）`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：**已收口（代码）**
- 涉及项目：`frontend`（`main.js`、`js/storage-http-adapter.js`、`js/storage.js`）；**后端同仓库已加** `PATCH /api/problem-cases/:id/messages/:messageId`（与前端单条更新对齐）
- 目标结果：
  - 空案例仅 UI 显示「请输入客户基本信息」，**不**写入 `problemDetailChatMessages`、**不**调用 `saveProblemDetailChat` 落占位。
  - online：`saveProblemDetailChat` 尽量 POST（单条/严格尾部多条）、DELETE（单条/严格子序列多条）、PATCH（同序同 id、仅内容/确认态/载荷/时间等变化）；占位-only 与 `storage.js` 防御性拦截均**不发** POST/PATCH/PUT。
  - owner 可开 `window.__FE_MSG_PERSIST_DEBUG = true` 看 `[FE:msg-init]`、`[FE:msg-persist]`（含 `domMsgCount` ≈ `document.querySelectorAll('.problem-detail-chat-msg').length`）。
- 已完成：
  - `initProblemDetailChat`：`problemDetailChatMessages = []`，占位仅 `appendProblemDetailChatMessage(..., { noSave: true })`，去掉原 `saveProblemDetailChat(chatKey, [占位])`。
  - `storage-http-adapter.js`：`isPlaceholderOnlyPersistence` 短路并清空该 key 缓存；增量子路径 + `doPut('fallback'|'structural-mismatch')`。
  - `storage.js`：local 模式同样拦截单条占位写本地。
  - 后端：`ProblemCaseRepository.updateMessage`、`PATCH` 路由、`ProblemCaseService.patchMessage`；`replaceMessages` 保留 **危险占位覆盖** 防护（非空历史被整段替换为单条占位 → 拒绝写入并返回原消息）。
- 验证结果：后端 `vitest` 全绿；`node --check` 通过 `storage-http-adapter.js` / `storage.js`。
- 当前阻塞：无代码阻塞
- 需要后端配合：**已在本轮实现 PATCH**，部署需带新版本 backend。
- 关闭条件：owner online 开 `__FE_MSG_PERSIST_DEBUG` 点验：空案例无 `/messages` 写入；有历史案例打开不被占位覆盖；单条增删改分别命中 POST/DELETE/PATCH；非必要不出现 PUT。

**接口行为摘要（FE-20260323-01）**

| 场景 | HTTP |
| --- | --- |
| 单条追加（前缀 id 一致） | `POST .../messages` |
| 严格尾部多条追加 | 多次 `POST` |
| 单条删除 | `DELETE .../messages/:messageId` |
| 严格子序列多条删除 | 多次 `DELETE` |
| 同序同 id、仅内容/确认等变化 | 一次或多次 `PATCH .../messages/:messageId` |
| 重排、改 id、结构字段变化、无法判定安全增量、迁移/大包等 | `PUT .../messages` |

### FE-20260323-02

- 任务编号：`FE-20260323-02`
- 日期：`2026-03-23`
- 任务标题：`消息增量持久化「同引用数组」修复（UI 与 adapter cache 解耦）`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：**已收口（代码，待 owner 现场验证）**
- 涉及项目：`frontend`（`main.js`、`js/storage-http-adapter.js`）；**本轮按 owner 判断不修改后端**
- 根因确认：`initProblemDetailChat` 曾将 `problemDetailChatMessages` 直接指向 `getProblemDetailChats()[chatKey]`（与 `problemChatsCache[createdAt]` 同一数组）；`pushAndSaveProblemDetailChat` 在原数组上 `push` 后再 `saveProblemDetailChat`，导致 `prevMessages` 与 `nextMessages` 实为同一引用已变长，增量 diff 误判 noop / 非新增，表现为发消息/重启消息不落库、沟通历史异常。
- 目标结果：
  - 打开已有消息案例后发新消息 → online 必须命中 `POST .../messages`。
  - 「重启当前任务」等写入链路的系统消息必须落库。
  - `renderProblemDetailHistory()` 后任务节点与时间线仍完整。
  - `window.__FE_MSG_PERSIST_DEBUG = true` 下可见 `save-entry` 的 `prevLength` / `nextLength` / `sameArrayRef`，且正常追加时 `sameArrayRef` 应为 `false`。
- 已完成（代码）：
  - `initProblemDetailChat`：`problemDetailChatMessages = storedChat.slice()`，渲染用拷贝；可选 `[FE:msg-init]` 输出 `sameArrayRefAsCache: false`。
  - `pushAndSaveProblemDetailChat` / `appendProblemDetailChatMessage`（有 save 分支）：`problemDetailChatMessages = [...arr, newMsg]`，不再原地 `push`。
  - `storage-http-adapter.js` `saveProblemDetailChat`：`prevMessages` / `nextMessages` 均基于缓存与入参 `.slice()` 快照后再 diff；`problemChatsCache[createdAt]` 赋值为新数组副本；`[FE:msg-persist]` 各 action 附带 `prevLength`、`nextLength`、`sameArrayRef`（入口 `save-entry`）。
- 验证结果（本地/静态）：
  - `node --check` 通过 `main.js`、`storage-http-adapter.js`。
  - **未**在真实浏览器中对后端发 POST 做 E2E 抓包（需 owner 现场）。
- 当前阻塞：无代码阻塞
- 需要后端配合：无
- 关闭条件：owner 按上列 3 场景 + 调试日志点验通过

### FE-20260323-03

- 任务编号：`FE-20260323-03`
- 日期：`2026-03-23`
- 任务标题：`修复 initProblemDetailChat 中误用 global 导致浏览器 ReferenceError`
- 来源：`architect-owner`
- 优先级：`P0`
- 当前状态：**已收口（代码，待 owner 浏览器验证）**
- 涉及项目：`frontend`（`main.js`）
- 根因：`__FE_MSG_PERSIST_DEBUG` 分支使用了未在浏览器定义的 `global`，打开案例详情即崩。
- 已完成：`initProblemDetailChat` 内两处改为 `globalThis.__FE_MSG_PERSIST_DEBUG`（带 `typeof globalThis !== 'undefined'` 守卫）；全量检索 `main.js` 无其它 `global.__FE_MSG_PERSIST_DEBUG`；`storage-http-adapter.js` 内 `global` 为 IIFE 形参（实参为 `window`），无需改。
- 验证结果：`node --check frontend/main.js` 通过；**未**跑真实浏览器。
- 关闭条件：owner 确认打开详情无报错、聊天区与沟通历史可正常用；再继续验证 FE-20260323-02 消息链路。

### FE-20260323-04

- 任务编号：`FE-20260323-04`
- 日期：`2026-03-23`
- 任务标题：`回归修复：恢复 main 上 archiveNo / 案例编号（集成分支合并时丢失）`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：**已收口（代码，待 local/online 浏览器签字）**
- **缺口复核（owner）**：`archiveNo` 主体链路已补回，但 **首页卡片增强能力未完整恢复**——`styles.css` 仍有 `.btn-problem-follow-copy`，而 `main.js` 一度仅有「详情 + 删除」、无复制按钮与点击链。**本轮已补**。
- 涉及项目：`frontend`（`js/storage.js`、`main.js`）；**不改后端契约、不强行写回 online archiveNo**
- 目标结果：
  - `storage.js`：恢复 `applyDigitalProblemsArchiveNoMigration`、`peekNextDigitalProblemArchiveNo`、`ensureDigitalProblemArchiveNosPersisted`、`saveDigitalProblemsSnapshot`；`saveDigitalProblem` 自动分配 `archiveNo`；挂到 `window`；local 模式与 `STORAGE_INDEXEDDB_ADAPTER` 统一委托（与 main 一致）。
  - `main.js`：首页列表 `ensureDigitalProblemArchiveNosPersisted` + `.problem-follow-card-archive-no`；`updateProblemDetailArchiveNoBadge` + `openProblemDetail` / `refreshProblemDetailBundleFromBackend` 更新顶栏；online 无 `archiveNo` 时详情顶栏与首页卡片展示「—」；**首页卡片** `data-case-key` 下恢复 **复制**（`.btn-problem-follow-copy` + 委托，与删除/详情/高亮并存）。
  - `storage-indexeddb-adapter.js`：保持既有对全局迁移/分配函数的调用，仅恢复依赖。
- 已完成（代码）：
  - 删除重复的 `renderProblemFollowList` 旧实现；保留 case-key 列表并接回档案编号行。
  - `el.problemDetailArchiveNoBadge` 接线。
  - `buildResetPreliminaryItem` + adapter 模式下 `resetDigitalProblemToPreliminary` 对 IndexedDB 使用 `saveDigitalProblemsSnapshot` / 操作历史与任务追踪清理（与 main 语义对齐）。
  - **复制**：`PROBLEM_FOLLOW_CARD_ICONS.copy` + 卡片 actions 中「复制」按钮；`data-case-key` 委托；深拷贝源案例 → 删除 `createdAt` / `archiveNo` / **`id`**（避免副本沿用后端 case id）→ `saveDigitalProblem(copyItem)` 重新派号；按源 `caseKey`/`createdAt` 复制 `problemDetailChat` 与 `taskTracking` 到新案例键（与 main 语义对齐，键兼容 caseKey）。
- 验证结果（静态）：`node --check frontend/js/storage.js`、`node --check frontend/main.js` 通过；**未**跑真实浏览器。
- 当前阻塞：无代码阻塞
- 需要后端配合：无（不新增字段）
- 关闭条件：owner 在 local 验证补号/顺延/刷新保留；在 online 验证有号显示、无号「—」；**并**验证复制生成新案例、新 `archiveNo`、原/副本详情可开、删除/详情/高亮不受影响

### FE-20260323-05

- 任务编号：`FE-20260323-05`
- 日期：`2026-03-23`
- 任务标题：`IT 现状标注（task5）确认后仍判未开始 / 重复下发「即将开始 IT 现状标注」修复`
- 来源：`architect-owner / 用户`
- 优先级：`P0`
- 当前状态：**已收口（代码，待 owner 现场复验）**
- 涉及项目：`frontend`（`main.js`、`js/task5ItStatus.js`）；**本轮不改后端**
- 根因摘要：
  - `task5ItStatus.js` 在标注完成后仅写 `global.currentProblemDetailItem`，未走 `setCurrentProblemDetailItem`，与 `main.js` 闭包内真实 `currentProblemDetailItem` 不同步。
  - `resolveProblemItemForTaskNotification()` 仅合并 `completedTaskIds`，`...cur` 覆盖列表项时丢掉 `workflowAlignCompletedStages` 等，`isTaskCompleted(task5)` 与 `getFirstUncompletedTask` 仍把 task5 当首个未完成。
- 已完成（代码）：
  - `task5ItStatus.js`：`getDetailItemForTask5`、`syncCurrentProblemDetailItem`（对齐 task6）；写回时 `setCurrentProblemDetailItem` + `window` 镜像。
  - `main.js`：`resolveProblemItemForTaskNotification` 合并 `workflowAlignCompletedStages`、`itGapCompletedStages`、`completedStages`（与 `completedTaskIds` 同策略去重升序）；task5「已完成」链增加 `[FE-20260323-task5-done]` 最小日志（`before-done` / `after-done-online` / `after-done-local`）。
- 验证结果（静态）：`node --check frontend/main.js` 通过。
- 关闭条件：owner 按最小回归确认——确认 IT 现状输出 → task5 完成确认 → 点「已完成」后不再重复「即将开始 IT 现状标注」、下一任务为痛点标注（task6）、价值流 itStatus 仍正常。

**FE-20260323-05 最小日志示例（owner 可复制控制台）**

```text
[FE-20260323-task5-done] before-done { currentProblemDetailItem_workflowAlign: ..., listSameCase_workflowAlign: ..., resolveProblemItem_workflowAlign: ..., getFirstUncompletedTask_id: ... }
[FE-20260323-task5-done] after-done-online { ... }
[FE-20260323-task5-done] after-done-local { ... }
```

### 2026-03-23

- 日期：2026-03-23
- 今日完成：登记并完成 **FE-20260323-07**（详情页初步需求卡片字段读空修复：新增 `buildResolvedPreliminaryRequirement(item)` 并统一 `preliminaryReq + 顶层回退`，`buildPreliminaryCardRowsHtml/buildPreliminaryPreContent/buildPreliminarySummaryJson` 全部改为吃合成对象；`buildPreliminaryHistoryHtml` 回退 requirementDetail 走合成对象；补 `[FE:preliminary-resolve]` 最小日志用于 owner 现场核验）；此前 **FE-20260323-05**（task5 详情态 `setCurrentProblemDetailItem` 收口、`resolveProblemItemForTaskNotification` 合并工作流/ITGap/需求子阶段完成数组 + task5「已完成」调试日志）；此前 **FE-20260323-04**：恢复 `archiveNo` 数据链与首页/详情展示链；local 模式 IndexedDB 存储委托与 `ensureDigitalProblemArchiveNosPersisted` 补号；**同一任务条**补回首页「复制」按钮与 `copy` 点击链（`data-case-key` 委托，清 `createdAt`/`archiveNo`/`id` 后 `saveDigitalProblem`）。
- 今日完成（追加）：登记并完成 **FE-20260323-08**（task1 完成态防误判）：新增 `hasTask1BasicInfoFields(basicInfo)`，`openProblemDetail` 不再按 `item.basicInfo` truthy 自动补 task1 完成；`isProblemResetState` 与 `advanceProblemStateOnTaskComplete(task1)` 同步改为真实字段判定，拦截 `__createContractExtras` 造成的误推进到 task2。
- 今日完成（追加）：登记并完成 **FE-20260323-09**（task1 首次进入通知与输入门禁收口）：新增 `ensureTask1StartNotificationIfPending` 在 `openProblemDetail`/`refreshProblemDetailBundleFromBackend`/`storageBackendReady` 进行兜底补发；新增 `looksLikeTask1BasicInfoInput` 放开 Agent 模式下 task1 企业/工商输入直通提炼；`isTask1Stage` 与 `isBasicInfoProvide` 改为基于 `hasTask1BasicInfoFields(...)` 的稳定判定；补 `[FE:task1-entry]`/`[FE:task1-input]` 最小日志。
- 今日完成（追加）：登记并完成 **FE-20260323-10**（首次新增案例“详情”按钮不可点修复）：`findProblemFollowItemByCaseKey` / `findProblemFollowIndexByCaseKey` 改为兼容 `id + createdAt`；`storage-http-adapter.saveDigitalProblem` 在服务端回包后派发 `problemCasesChanged`；`main.js` 监听该事件并在 online 立即 `renderProblemFollowList`，确保卡片 `data-case-key` 尽快从 optimistic `createdAt` 刷为正式 `id`。
- 当前阻塞：无（待浏览器签字）
- 明日计划：owner 在集成分支上按关闭条件做 local/online 最小回归。
- 需要后端配合的接口或字段：无
- 是否存在越界到前端本地规则的风险：无（仅恢复既有 main 能力，online 不造字段）
