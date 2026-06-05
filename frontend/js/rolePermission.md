# 角色与权限模型推演模块（rolePermission.js）实现说明

> 最近更新：2026-03-29（**FE-20260329-09**：主流程每环节持久化 `task10LlmQueryBlock` 供沟通历史过程日志 LLM-查询双子卡，主聊天区不展示；**FE-20260329-08**：聊天区仅 `rolePermissionStepProgressBlock`，不推送 `rolePermissionAnalysisCard`；**FE-20260329-07**：Session 块仅「自动顺序执行」。编排见 `main.js`）。与 main.js 中 task10 流程一致：先 **`rolePermissionAuditIntentBlock`**（**确认**=继续跑合规审计 LLM；**无需继续审计**=跳过审计并直接下发 task10「是否视为完成」块，字段 `auditSkippedByUser`）（§4.2）；审计成功后聊天区推送 **`rolePermissionAuditResultBlock`**（按「缺陷清单」渲染可多选子卡：违反准则/涉及角色或环节/问题描述/重构指令，字段纵向排列并带分割线，不展示原始审计 JSON；点击「提炼修改意见」仅提交勾选缺陷）并进入与「修正」同源的修改意图提炼链路；刷新/重入状态 B 且无审计块时补发意图块，不自动调模型。含 **累计角色清单** `rolePermissionRoleRegistry`（`mergeRolePermissionRegistryItem` / `rebuildRolePermissionRegistryFromSessions` / `getRolePermissionRegistryForDisplay` / `serializeRolePermissionRegistryForLlmPrompt`）、`roles[].functional_description`（职能描述）与清单项 `functionalDescription`；工作区顶部 **角色清单** 卡片（`buildRolePermissionRegistryCardHtml`，标题栏 view/json Tab）；单环节 LLM 第 7 参为累计清单 JSON（`main.js` 传入）。含刷新后 `ensureTask10RefreshNotificationIfNeeded` 对 `rolePermissionAllDoneBlock` / `taskCompletionConfirmBlock(task10)` 的补偿（见 §6.7）。价值流环节卡片标题栏为两列 Grid：左侧环节名，右侧为 `problem-detail-card-header-rp-cbo-cluster`（内为 ✅ + 角色名列表见 `buildRolePermissionStepHeaderDeducedHtml`，以及 task11 已推演时 **「生成业务对象N个」**）。用户在 task10 点击「重启当前」时，`buildItemAfterRollbackToTask` 的 task10 分支会清空各 `rolePermissionSessions` 条目的 `rolePermissionJson` 与 `rolePermissionModel`，并清空 `rolePermissionRoleRegistry`。**修改链路**在用户确认新提示词后：先重建 `rolePermissionSessionsBlock` 并逐环节重生成；每个环节除更新 `rolePermissionAnalysisCard` 外，过程日志新增 **`rolePermissionModificationLlmQueryBlock`**（标签 **LLM-修改**，输入/输出 + 修改内容子卡片），聊天区同步推送 `rolePermissionModificationActionBlock`。

## 1. 概述

`rolePermission.js` 负责**角色与权限模型（RBAC）推演**的完整链路：按价值流生成推演会话、针对单环节调用大模型、解析模型输出，以及将解析结果渲染为工作区使用的 HTML。与主流程的编排（如 `runRolePermissionModeling`、聊天消息、DOM 事件）解耦，主流程只负责调用本模块暴露的全局函数。

**职责边界**：

- **本模块**：Session 生成、单环节 LLM 调用、解析、HTML 渲染（纯逻辑 + 字符串拼接）。
- **main.js**：流程编排、UI 状态、聊天容器与消息推送、按钮/折叠等事件绑定。

---

## 2. 依赖与加载

### 2.1 运行时依赖（从 global 读取）

| 依赖 | 来源 | 用途 |
|------|------|------|
| `parseValueStreamGraph` | valueStream.js | 从价值流对象解析出 `stages`，用于生成 session 列表 |
| `fetchDeepSeekChat` | api.js | 调用大模型接口，执行单环节角色与权限推演 |
| `escapeHtml` | utils.js | 对纯文本/JSON 做 HTML 转义，防止 XSS |
| `renderMarkdown` | utils.js | 将 Markdown 字符串渲染为 HTML（用于角色字段、子卡片内容） |

### 2.2 加载顺序

在 `index.html` 中，`rolePermission.js` 置于 `js/navigation.js` 之后、`main.js` 之前，确保上述依赖已加载，且本模块在 main 中可被直接以全局函数形式调用。

### 2.3 模块形式

通过 IIFE 将实现封装，并把需要对外使用的函数挂到 `global`（浏览器下为 `window`），不污染全局命名空间的其他名称。

---

## 3. Session 生成（不调用大模型）

### 3.1 `generateRolePermissionSessions(valueStream)`

**作用**：根据价值流图生成「按环节」的推演会话列表，供 Session 块展示并由 `runRolePermissionModelingAutoSequential` 顺序调用单环节推演（环节卡确认推进仍由 `main.js` 编排）。

**逻辑**：

1. 使用 `parseValueStreamGraph(valueStream)` 得到 `{ stages }`。
2. 顺序遍历每个 `stage` 的 `steps`，为每个 step 生成一条 session：
   - `stepName`：取自 `step.name`，缺省为 `环节${stepIndex + 1}`。
   - `stepIndex`：从 0 递增的环节序号。
   - `stageName`：当前阶段名 `stage.name`。
   - `rolePermissionJson`：初始为 `null`，留给后续 LLM 结果写入。

**返回**：Session 数组，每项形如 `{ stepName, stepIndex, stageName, rolePermissionJson }`。主流程按序跑自动推演或按环节卡「下一步」推进。

---

## 3.2 累计角色清单（`rolePermissionRoleRegistry`）

- **结构**：`Array<{ roleName: string, linkedSteps: string[], functionalDescription?: string, functionalDescriptionItems?: { stepLabel: string, text: string }[] }>`，`linkedSteps` 为环节展示标签（优先「阶段－环节」，否则环节名或 `环节n`）；`functionalDescriptionItems` 按**环节键**合并（同环节覆盖、不同环节追加），`functionalDescription` 为其扁平合成串；角色清单 view 中多条时以**无序列表**分点展示各环节职能描述。
- **持久化**：`storage.js` → `updateDigitalProblemRolePermissionRegistry`；与 `rolePermissionSessions` 同属问题单字段；online 适配器同步字段 `rolePermissionRoleRegistry`。
- **更新时机**：用户**确认**单环节卡片后 `applyRolePermissionRegistryMerge`；自动顺序在每环节写入 session 后同样合并；**全部确认**后 `syncRolePermissionRegistryFromSessions` 全量重建；**重做**某环节后同步重建。新开 task10 并生成 Session 时清单置 `[]`。
- **提示词**：`generateRolePermissionForStep` 第 7 参为清单 JSON（`serializeRolePermissionRegistryForLlmPrompt`：`[{ role_name, linked_steps, functional_description }]`）；System/User 中约定与清单重复的角色须**逐字复用** `role_name`，并输出/更新 `functional_description`；若初步需求「人员组织模式」有明确角色定义，则称谓以之为基准，可增支撑角色，不得删初步需求角色。

---

## 4. 单环节 LLM 推演

### 4.0 `buildPreliminaryOperationModelTextForRolePermission(caseItem)`

**作用**：从初步需求合成「核心业务流程梳理」「人员组织模式」文本块，供单环节与 **`main.js` `runRolePermissionModeling`（整图一次性推演）** 的 user 消息注入。暴露为 `global.buildPreliminaryOperationModelTextForRolePermission`。

### 4.1 `generateRolePermissionForStep(stepName, stageName, valueStream, globalItGap, localItGap, projectName, accumulatedRoleRegistryJson, caseItem?)`

**作用**：针对**一个环节**调用大模型，得到该环节的角色与权限推演结果（期望为单个 JSON 对象）。

**入参**：

- `stepName` / `stageName`：当前环节与阶段名称，用于 prompt 与结果结构。
- `valueStream`：端到端价值流对象，序列化后放入「端到端事务流」上下文。
- `globalItGap`：全局 IT 差距分析结果（可选），有则序列化后放入「全局 ITGap 分析」。
- `localItGap`：局部 IT 差距分析数组（可选），有则序列化后放入「角色汇总设计」。
- `projectName`：项目名称，用于 user prompt。
- `accumulatedRoleRegistryJson`：截至上一环节的累计角色清单 JSON 字符串（`[{ role_name, linked_steps, functional_description }]`），首环节为 `"[]"`；由 `serializeRolePermissionRegistryForLlmPrompt(item)` 生成，`main.js` 在 `runRolePermissionModelingForNextStep` / `runRolePermissionModelingAutoSequential` 中传入。
- `caseItem`（可选）：当前问题单；用于从初步需求卡片注入「核心业务流程梳理」「人员组织模式」（`buildResolvedPreliminaryRequirement` → `operationModel`）。

**Prompt 设计**：

- **System**：角色设定为需求分析专家；任务为针对「单一环节」做 RBAC 推演；要求包含角色画像、现状转换、痛点闭环、SoD；**初步需求参考**；**人员组织模式角色基准**（有明确定义则以类型与称谓为基准，可增支撑角色，不得删初步需求已定义角色）；**角色命名与累计清单**（与清单实质相同则 `role_name` 逐字一致；岗位在人员组织模式中有定义时与初步需求称谓一致并写入清单）；并约定输出为**单个 JSON 对象**，且必须包含 `roles`、`sod_warning` 等字段。
- **User**：拼接「项目 + 环节」说明；若传入 `caseItem` 且初步需求含 `operationModel.businessProcess` / `orgStructure`，则插入 **【初步需求卡片｜经营模式】** 块（**核心业务流程梳理**、**人员组织模式**，与初步需求卡片同源）；再接端到端事务流 JSON、可选的全局/局部 ITGap JSON、**累计角色清单 JSON**，并明确要求「直接输出该环节的 JSON 对象，不要 markdown 代码块或说明文字」。

**返回**：`fetchDeepSeekChat([...])` 的 Promise，即 `{ content, usage, model, durationMs }` 等。主流程拿到 `content` 后，会交给 `parseRolePermissionModel` 解析，再交给 `buildRolePermissionNodeCardsHtml` / `buildRolePermissionStepViewHtml` 渲染。

### 4.2 `generateRolePermissionComplianceAuditWithStrictPrompt(valueStream, rolePermissionSessions, caseItem?)`

**作用**：用户在 **`rolePermissionAuditIntentBlock`** 上点击「确认」后，由 `main.js` 调用 `runRolePermissionComplianceAuditIfNotYetInChat` 内部使用；对比**端到端价值流 JSON**与**各 `rolePermissionSessions` 条目的 `rolePermissionJson` 合并列表**，按审计五项准则输出严格 JSON；system 在「输出格式」前含 **核心重构约束（反压缩）**与 **初步需求人员组织基准**（有「人员组织模式」定义时：类型称谓以初步需求为基准；可增支撑角色；**允许**调整已列出角色的权限与职能描述；**禁止**删除初步需求人员角色）。可选 `caseItem` 时 user 消息前置与推演同源的初步需求经营模式摘录。过程日志写入 `rolePermissionAuditLlmQueryBlock`（标签 **LLM-审计**）。「已全部确认」与刷新补偿仅负责下发意图块，不直接调本函数。

**参数**：`valueStream` 为 item 上价值流对象；`rolePermissionSessions` 为 `item.rolePermissionSessions`（含 `stepIndex` / `stepName` / `stageName` / `rolePermissionJson`）；`caseItem` 可选，用于注入 `buildPreliminaryOperationModelTextForRolePermission`。

---

## 5. 解析逻辑：`parseRolePermissionModel(markdown)`

**作用**：将大模型返回的文本（或历史保存的 markdown）解析为「环节列表」或「旧版表格行」的结构化数据，供渲染使用。兼容**新格式 JSON** 与**旧版 Markdown 表格**。

### 5.1 输入与预处理

- 非字符串或空串直接返回 `[]`。
- 去除首尾空白与 BOM（`\uFEFF`），得到 `raw`。
- 可选调试：`ROLE_PERMISSION_LOG === true` 时在控制台打印解析过程。

### 5.2 新格式 JSON 解析（优先）

1. **直接解析**：`JSON.parse(raw)`；失败则下一步。
2. **代码块提取**：用正则匹配 ` ```json ... ``` ` 或 ` ``` ... ``` `，对块内内容再 `JSON.parse`。
3. **括号匹配**：若仍非数组，在 `raw` 中找第一个 `[`，按括号深度找到匹配的 `]`（跳过字符串内的引号与转义），对截取子串再 `JSON.parse`。

解析得到数组后，做**格式识别**：

- 取首元素 `first`，若为对象且：
  - 同时具备 `roles`（数组）与（`step_name` 或 `step_id` 或 `stage_name` 或 `stage_id`）→ 视为**新格式**，直接返回该数组。
  - 仅有 `step_name` / `step_id` / `stage_name` / `stage_id`（无 `roles` 或格式不全）→ 仍视为按环节结构，返回该数组。

### 5.3 旧版 Markdown 表格解析（兜底）

当无法识别为新格式数组时：

1. 按行切分，只保留包含 `|` 的行；不足 2 行则返回 `[]`。
2. 第一行作为表头，解析列索引：
   - 节点、建议角色、核心职责、权限（通过列名是否包含对应中文确定索引）。
3. 从第 3 行起遍历数据行：
   - 对「建议角色」用正则提取：`执行者：…`、`审批者：…`、`知情者：…`。
   - 对「权限」用正则提取：`企微端：…`、`低代码：…`、`接收通知：…`、`查询数据：…`。
4. 每行输出为：`{ node, roles: { executor, approver, informer }, duty, perms: { wechat, lowcode, notify, query } }`。

**返回值**：新格式为「环节对象数组」（每项含 `stage_name`、`step_name`、`roles` 等）；旧版为「表格行对象数组」（每项含 `node`、`roles`、`duty`、`perms`）。渲染层通过首项结构区分两种格式。

---

## 6. 渲染逻辑

渲染层将解析后的「环节列表」或「表格行列表」转成工作区使用的 HTML，并统一使用 `escapeHtml` / `renderMarkdown` 保证安全与格式。

### 6.1 字段级：`formatRolePermissionField(val)`

- **空值**：返回占位 `—` 的 span。
- **字符串**：用 `renderMarkdown` 渲染后放入 `markdown-body` 的 div。
- **对象**：`JSON.stringify(..., null, 2)` 后放入 `<pre>`，内容经 `escapeHtml`。
- 其他类型：`escapeHtml(String(val))`。

用于「过去操作」「触发逻辑」等单值字段。

### 6.2 新权限子卡片：`buildNewPermissionsSubcardsHtml(obj)`

- 入参为 `new_it_permissions` 这类对象。
- 固定三个键：`data_access`（数据权限）、`function_use`（功能实用）、`system_operation`（系统操作）。
- 每个键对应一张内层卡片：标题 + 内容。内容规则：数组→列表项；字符串→Markdown；其他→JSON pre。
- 空或非对象返回占位 `—`。

### 6.3 痛点解决方案子卡片：`buildPainPointSolutionSubcardsHtml(obj)`

- 入参为 `pain_point_solution` 这类键值对象。
- 使用常量 `PAIN_POINT_SOLUTION_LABELS` 将 key 映射为中文标题（如 `eliminate_manual_collection` → 「消除人工采集」）；无映射时用 `解决方案 ${i+1}` 或 key 的英文 Title Case（`formatKeyToEnglishTitle`）。
- 每个 key 一张内层卡片：中英文标题 + 内容（字符串→Markdown，其他→JSON pre）。

### 6.4 单环节视图：`buildRolePermissionStepViewHtml(match)`

- `match` 为**一个环节**的对象（新格式），含 `roles` 数组。
- 若无 `roles` 或为空，返回占位「该环节暂无角色数据」。
- 否则对每个角色生成一张「角色卡片」：
  - 标题：`role_name` / `roleName`。
  - 区块：**职能描述**（`functional_description` / `functionalDescription`，`formatRolePermissionField`）、过去操作（`formatRolePermissionField(legacy_operation)`）、新的权限（`buildNewPermissionsSubcardsHtml(new_it_permissions)`）、痛点解决方案（`buildPainPointSolutionSubcardsHtml(pain_point_solution)`）、触发逻辑（若有则再 `formatRolePermissionField(trigger_logic)`）。
- 支持 snake_case 与 camelCase 字段名（如 `legacy_operation` / `legacyOperation`）。
- 外层包一层 `problem-detail-role-permission-view-roles`，内部为多张 `problem-detail-role-card`，便于主流程统一做折叠等交互。

### 6.5 节点/环节卡片列表：`buildRolePermissionNodeCardsHtml(model)`

- `model` 为 `parseRolePermissionModel` 的返回值（数组）。
- **新格式**（首项含 `roles` 且含 `step_name`/`step_id`/`stage_name`/`stage_id`）：
  - 每个环节一张「环节卡片」：
    - 标题：`stage_name － step_name` 或 fallback 到 `step_name` / `stage_name` / step_id 等；标题行右侧为 `buildRolePermissionStepHeaderDeducedHtml(item)`（✅ + 角色名以 ` ｜ ` 连接）。
    - 卡片内带 tab：「view」与「json」；view 为 `buildRolePermissionStepViewHtml(item)`，json 为该环节对象的格式化 JSON。
    - 标题区有「角色与权限模型推演」文案与 view/json 切换按钮。
  - 最外层为「环节列表」标题 + 多张 `problem-detail-card-role-permission`。
- **旧版表格格式**（首项为 `node`、`roles`、`perms`、`duty`）：
  - 每个 `node` 一张卡片，展示：环节名称、角色设计（执行者/审批者/知情者）、企微端/低代码/接收通知/查询数据、核心职责（若有）。
  - 使用 `problem-detail-role-permission-grid` 等 class，与现有样式一致。

主流程将 `buildRolePermissionNodeCardsHtml(parsedModel)` 的 HTML 插入工作区，并依赖现有 CSS 与 main.js 中的折叠、tab 切换等事件。

### 6.6 main.js 工作区（新 RBAC × 价值流）与「待推演」误判

- **与左侧「局部 ITGap Session」无关**：沟通历史里 **task9** 的「已分析」只表示局部 ITGap；**task10** 角色权限是否写入 `rolePermissionSessions` / 聊天 `rolePermissionAnalysisCard` 是另一套状态。
- **数据来源优先级**：`getRolePermissionStepJsonForWorkspace(item, stepIndex, matchFromModel)` 为 **session 中 `rolePermissionJson` → 同 `stepIndex` 的 `rolePermissionAnalysisCard` → `matchFromModel`**；会话项的 `s.stepIndex` 与入参 `stepIndex` 比较应使用 **`Number(...)`**，避免字符串下标与数字下标导致 `updateDigitalProblemRolePermissionStep` 未写入、工作区读不到。
- **勿用聚合 model 盖住会话结果**：工作区渲染时 **`effectiveRpMatch` 必须优先 `stepJsonForHeader`**（来自上一步优先级），不能写成 `match || stepJson` 且要求 `roles.length > 0`，否则会出现「过程日志已有 LLM 输出、卡片仍待推演」。
- **环节名匹配**：Prompt 输出字段常为 **`stage_name` = 价值流环节名**；若未填 `step_name`，聚合 model 与价值流环节对齐时应允许 **`stage_name` 参与与 `nodeName` 的匹配**。
- **两个「待推演」不是重复渲染**：`itStrategyPlanViewingSubstep === 1`（**Task11 核心业务对象**）时，环节体内为 **`rolePermissionBlock` + `cboSubCardHtml`** 两段；两段各自无数据时各显示一条占位（文案已区分为「角色与权限模型：待推演」与「核心业务对象推演：待推演」）。刷新进入 IT 策略规划时，`openProblemDetail` 会按 **第一个未完成任务** 设置子步骤（常为 task11），易与仅看 Task10 时的单段占位混淆。

### 6.7 刷新页面后的聊天恢复（main.js）

- **`ensureTask10RefreshNotificationIfNeeded`**（与 `ensureTask4RefreshNotificationIfNeeded` 并列，先于 `showNextTaskStartNotification`）：当**首个未完成任务**为 task10、`rolePermissionSessions` 已全部有 `rolePermissionJson`、且 task10 尚未 `isTaskCompleted` 时介入，**不再**下发「任务通知：我即将开始【角色与权限模型推演】任务」。
  - **状态 A**（仍有未确认 `rolePermissionAnalysisCard`「历史」或 **`rolePermissionAllDoneBlock` 未全部确认**）：补发 `rolePermissionAllDoneBlock`（「全部环节已推演完毕，结果已写入工作区，请点击「全部确认」以继续。」）；**不**发 `taskCompletionConfirmBlock(task10)`。非刷新进入且已有未 `allConfirmed` 的 allDone 块时不重复追加；**浏览器刷新**时先去掉会话块之后未完成的旧 allDone 与 `rolePermissionStepProgressBlock` 再发一条。
  - **状态 B**（环节卡均已确认，等待整任务完工）：若尚无 `rolePermissionAuditLlmQueryBlock`，先 **`pushRolePermissionAuditIntentBlockIfNeeded`**（「我即将对角色与权限推演结果进行审计」）；存在未确认意图块时不重复追加；**不**发 task10 启动通知。非刷新且已有未确认完工块时仅抑制启动通知；**刷新**时先去掉未确认的 task10 完工块，再按上条补意图块（不自动调 LLM）。意图确认并由 `runRolePermissionComplianceAuditIfNotYetInChat` 写入审计结果后，再 `showTaskCompletionConfirm`。
- **`isProblemDetailNavigationReload`**：用于区分刷新与普通重入，避免每次打开详情都重复追加 allDone。
- `initProblemDetailChat` 加载 `storedChat` 后、与 task11 的 `ensureCoreBusinessObjectAllDoneBlockIfNeeded` 类似地调用 `ensureTask10RefreshNotificationIfNeeded` 并重绘；`openProblemDetail` / `refreshProblemDetailBundleFromBackend` 的 rAF 与 bundle 收尾同样串联 task4 + task10 门控后再 `showNextTaskStartNotification`。

---

## 7. 对外暴露的 API（挂载到 global）

| 函数名 | 说明 |
|--------|------|
| `generateRolePermissionSessions(valueStream)` | 根据价值流生成推演 session 数组，不调 LLM |
| `buildPreliminaryOperationModelTextForRolePermission(caseItem)` | 拼接初步需求「核心业务流程梳理」「人员组织模式」供 RBAC user 消息；`runRolePermissionModeling` 与单环节共用 |
| `generateRolePermissionForStep(..., accumulatedRoleRegistryJson, caseItem?)` | 针对单环节调用大模型（含累计角色清单 JSON、可选初步需求经营模式两段），返回 Promise |
| `mergeRolePermissionRegistryItem` / `rebuildRolePermissionRegistryFromSessions` / `getRolePermissionRegistryForDisplay` | 累计角色清单合并、重建、展示用读取 |
| `buildRolePermissionRegistryCardHtml` | 工作区顶部「角色清单」卡片 HTML：标题栏 **view / json** Tab；view 为横向角色子卡片（角色名、**职能描述（n）** 标题中 n 为涉及环节数，取 `max(linkedSteps, functionalDescriptionItems 条数)` 等规则；不展示关联环节），json 为 `rolePermissionRoleRegistry` 数组的格式化 JSON |
| `serializeRolePermissionRegistryForLlmPrompt` | 将 `getRolePermissionRegistryForDisplay` 结果序列化为 LLM 用户消息中的累计清单 JSON 字符串 |
| `parseRolePermissionModel(markdown)` | 解析模型输出或历史文本为新格式/旧版表格结构 |
| `buildRolePermissionNodeCardsHtml(model)` | 将解析后的模型数组渲染为环节/节点卡片列表 HTML |
| `buildRolePermissionStepViewHtml(match)` | 将单个环节对象渲染为「角色卡片」视图 HTML |
| `extractRoleNameLabelsFromStepJson(stepJson)` | 从单环节 JSON 提取 `role_name` 列表（缺名用「角色 N」） |
| `buildRolePermissionStepHeaderDeducedHtml(stepJson)` | 工作区环节标题栏：✅ + 角色名 ` ｜ ` 拼接 |
| `buildLegacyRolePermissionHeaderDeducedHtml(match)` | 旧版表格结构：执行者/审批者/知情者非空时同上 |

主流程（main.js）在需要时直接调用上述全局函数；若存在依赖 `window.parseRolePermissionModel` 的代码，因挂载在 `global`（即 window）上，仍可正常使用。

---

## 8. 数据流简图

```
价值流 (valueStream)
    → generateRolePermissionSessions
    → sessions[{ stepName, stepIndex, stageName, rolePermissionJson }]
    → 主流程按 step 调用 generateRolePermissionForStep(...)
    → LLM 返回 content (markdown/JSON 文本)
    → parseRolePermissionModel(content)
    → model (新格式数组 或 旧版表格行数组)
    → buildRolePermissionNodeCardsHtml(model) 或 buildRolePermissionStepViewHtml(match)
    → HTML 插入工作区，由 main.js 绑定折叠/tab 等事件
```

---

## 9. 调试与扩展

- **解析调试**：将模块内 `ROLE_PERMISSION_LOG` 设为 `true`，可在控制台看到 `parseRolePermissionModel` 的解析步骤与结果类型。
- **新格式扩展**：若 LLM 输出增加新字段，只需在 `buildRolePermissionStepViewHtml`、`buildNewPermissionsSubcardsHtml`、`buildPainPointSolutionSubcardsHtml` 中按需增加展示；解析层已按「具备 roles + step/stage 信息」识别新格式，一般无需改 `parseRolePermissionModel` 的数组分支。
- **旧版表格**：保留表格解析是为了兼容历史数据；新推演均以新格式 JSON 为准。
