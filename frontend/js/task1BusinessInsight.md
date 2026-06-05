# 企业背景洞察模块（task1BusinessInsight.js）设计说明

> 最近更新：2026-04-15。与 `main.js` 中 task1（企业背景洞察）流程保持一致；设计详情页 task1 经营信息提炼见下文 `extractDesignDetailBusinessInfoFromUserFeedback`；客户需求提炼输出为 DDD/状态机底座 JSON（`businessContext`、`coreBusinessEntities`、`stateTransitionMatrix` 等，见 `DESIGN_DETAIL_CUSTOMER_REQUIREMENT_SYSTEM_PROMPT`）。沟通历史侧滑中过程日志（含 `LLM-查询` 等）标签字号由 `styles.css` `.problem-detail-history-panel` 统一控制，见 [数字化问题跟进阶段设计.md](../数字化问题跟进阶段设计.md) §0.6。

## 1. 模块定位

`task1BusinessInsight.js` 负责企业背景洞察（Task1）的核心可复用逻辑，目标是把 task1 的大模型调用与时间线消息构建从 `main.js` 解耦。

当前模块职责：

- 工商信息提炼的大模型调用与 JSON 解析（主站等：`parseCompanyBasicInfoInput`）；
- 设计详情页 task1 **经营信息提炼**：`extractDesignDetailBusinessInfoFromUserFeedback`（`DESIGN_DETAIL_BUSINESS_EXTRACT_SYSTEM_PROMPT`），备注名 `设计详情经营信息提炼` 写入 `task1LlmQueryBlock`；**与用户返回工商同一步内不**调用 BMC；
- 设计详情页 task1 **客户需求提炼**（画布已展示客户基本信息之后）：`extractDesignDetailCustomerRequirementFromUserFeedback(userText, basicInfoJsonStr)`（`DESIGN_DETAIL_CUSTOMER_REQUIREMENT_SYSTEM_PROMPT`），备注名 `设计详情客户需求提炼` 写入 `task1LlmQueryBlock`；
- 设计详情页 **BMC**：`generateDesignDetailBmcFromContext`（`DESIGN_DETAIL_BMC_SYSTEM_PROMPT`），备注名 `设计详情 BMC 生成` 写入 `task1LlmQueryBlock`（由后续编排触发，非上述经营信息提炼的立即后继）；
- Task1 `LLM-查询` 时间线消息的标准化构建（统一字段结构）。

非职责（仍由 `main.js` 负责）：

- **初步需求提取**：首页「解析」由 `js/preliminaryRequirement.js` 的 `parseDigitalProblemInput(text)` 完成，输出多维度结构化 JSON（customerName、customerNeedsOrChallenges、customerItStatus、projectTimeRequirement、operationModel、businessStatus、urgencyAnalysis）；**requirementDetail**（用户原始输入）由 main 在「启动跟进」时写入。解析结果在打开详情或确认 task1 启动后由 `main.js` 的 `pushTask1PreliminaryLlmQueryFromCaseIfNeeded` 写入时间线 `task1LlmQueryBlock`（备注「初步需求提取」），供沟通历史与聊天区展示。
- 聊天区卡片 DOM 渲染与按钮事件；
- 问题单状态推进、存储回写、页面切换；
- 历史时间线聚合与 UI 展示。

---

## 2. 依赖与加载

### 2.1 运行时依赖

| 依赖 | 来源 | 用途 |
|------|------|------|
| `fetchDeepSeekChat` | `js/api.js` | 调用大模型提炼工商信息 |

### 2.2 加载顺序

在 `index.html` 中，该模块位于：

- `js/api.js` 之后（保证大模型调用函数已挂载）；
- `main.js` 之前（保证主流程可直接调用）。

---

## 3. 对外方法

## 3.1 `parseCompanyBasicInfoInput(text)`

**作用**：将用户输入的工商信息文本提交给大模型并解析为结构化 JSON。

**入参**：

- `text: string`：用户输入内容（自由文本或粘贴信息）。

**返回**（`Task1BasicInfoLlmResult`）：

- `parsed`：解析后的工商信息 JSON；
- `usage`：token 使用统计；
- `model`：模型名称；
- `durationMs`：耗时（毫秒）；
- `fullPrompt`：完整提示词（system + user）；
- `rawOutput`：模型原始 JSON 文本（兜底展示）。

**异常**：

- 当 `fetchDeepSeekChat` 不可用时抛错；
- 当模型返回内容无法解析为 JSON 时抛错（由调用方捕获并展示失败信息）。

---

## 3.1a `extractDesignDetailBusinessInfoFromUserFeedback(text)`

**作用**：设计详情页 task1：用户返回工商及经营范围后，按**专用** system 提示词（`DESIGN_DETAIL_BUSINESS_EXTRACT_SYSTEM_PROMPT`）提炼固定字段 JSON；与主站 `parseCompanyBasicInfoInput` 的提示词分离。

**入参 / 返回 / 异常**：与 `parseCompanyBasicInfoInput` 同形态（`Task1BasicInfoLlmResult`）；`rawOutput` 为从模型回复中提取的 JSON 子串。

**全局**：`DESIGN_DETAIL_BUSINESS_EXTRACT_NOTE_NAME`（`设计详情经营信息提炼`）须与 Vue 侧 `buildTask1LlmQueryMessage({ noteName })` 一致。

---

## 3.1b `extractDesignDetailCustomerRequirementFromUserFeedback(userText, basicInfoJsonStr)`

**作用**：设计详情页 task1：在客户基础信息 JSON 已就绪后，根据用户自然语言「客户需求」按 `DESIGN_DETAIL_CUSTOMER_REQUIREMENT_SYSTEM_PROMPT` 提炼为**结构化需求底座** JSON（顶层含 `businessContext`、`coreBusinessEntities`、`stateTransitionMatrix`、`painPointRadar`、`itLandscape`、`operationModel`、`managementResources`、`roadmap`、`analystNotes` 等；真源与 `design_mode_promts.md` §3.0b 及源码常量逐字一致）。

**入参**：`userText`（需求原文）、`basicInfoJsonStr`（已提炼客户基础信息 JSON 字符串，可为 `"{}"`）。

**返回**：与 3.1a 同形态（`parsed` / `usage` / `model` / `durationMs` / `fullPrompt` / `rawOutput`）。

**全局**：`DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE_NAME`（`设计详情客户需求提炼`）须与 Vue 侧 `buildTask1LlmQueryMessage({ noteName })` 及 `designDetailLlmStats.ts` 一致。

---

## 3.2 `buildTask1LlmQueryMessage(args)`

**作用**：统一构建可入库的 task1 时间线消息对象（`task1LlmQueryBlock`）。

**入参**（`Task1LlmQueryMessageArgs`）：

- `noteName`：备注名（如「初步需求提取」「工商信息提炼」「设计详情经营信息提炼」「设计详情 BMC 生成」）；
- `fullPrompt`：完整提示词；
- `parsed`：结构化输出；
- `rawOutput`：原始输出（可选）；
- `timestamp`：时间戳；
- `usage/model/durationMs`：模型元数据（可选）。

**返回**：

- 标准消息对象，可直接传给 `pushAndSaveProblemDetailChat(...)`。

**默认行为**：

- `noteName` 缺省值为 `工商信息提炼`；
- 若传入 `usage/model/durationMs` 任一字段，则自动生成 `llmMeta`。

---

## 3.3 `generateDesignDetailBmcFromContext(ctx)`

**作用**：设计详情页基于案例 `basicInfo`、`preliminaryReq` 与用户补充文本调用大模型生成 **BMC JSON**（与主站 task2 `generateBmcFromBasicInfo` 的 system 提示词分离）。**不再**作为用户返回工商消息后的同一步自动调用（该步见 `extractDesignDetailBusinessInfoFromUserFeedback`）。

**入参**（`ctx`）：

- `basicInfo`：对象，缺省 `{}`；
- `preliminaryReq`：对象或 `null`，缺省按「无」拼装；
- `userSupplementText`：用户在任务进展中输入的正文。

**返回**：与 `parseCompanyBasicInfoInput` 相同形态（`parsed` / `usage` / `model` / `durationMs` / `fullPrompt` / `rawOutput`）。

**全局**：`DESIGN_DETAIL_BMC_NOTE_NAME` 供 Vue 侧 `buildTask1LlmQueryMessage({ noteName })` 与之一致。

---

## 4. 与主流程的关系

`main.js` 在 task1 的三个路径中复用该模块：

- 企业背景洞察首次提炼；
- 企业背景洞察重做提炼；
- task1 阶段输入后直接提炼。

同时，首页「解析」得到的**初步需求多维度提炼**结果（`preliminaryRequirement.js` 的 `parseDigitalProblemInput`，含 operationModel、businessStatus、urgencyAnalysis 等）会随档案 `task1InitialLlmQuery` 持久化；打开详情或确认 task1 启动后由 `main.js` 写入 `task1LlmQueryBlock`（备注「初步需求提取」），沟通历史与问题详情聊天区均按 `LLM-查询` + 输入/输出双子卡片展示。

**工作区「初步需求」卡片**（需求理解阶段企业背景洞察页）：顶栏含 **view（总结提炼分区）/ JSON / 历史详情**；**历史详情**按时间线展示历次提交的需求详情，每条为可折叠块，标题行依次为 **RQ-001** 样式编号、**绿色**提炼标题（≤30 字）、时间，点击展开后见该次全文。逻辑与 HTML 生成见 `js/preliminaryRequirement.md` 与 `../数字化问题跟进阶段设计.md` 文首 **FE-20260330-23**；展开/收起由 `main.js` 的 `setupPreliminaryHistoryItemToggle` 在卡片上事件委托实现。
