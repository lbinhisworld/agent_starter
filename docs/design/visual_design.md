# 价值流图、端到端事务流与 IT 设计补齐中的「流程图」逻辑总览

本文档概括三处**用户可见的流程/价值流可视化**在数据从哪来、如何归一、如何绘制、与哪些模块挂钩。实现细节以代码与专题目录为准。

---

## 1. 价值流图（task4 工作区）

### 1.1 定位

- **任务**：价值流建模（VSM），展示**阶段 → 环节**的纵向链与阶段间的横向串联。
- **形态**：HTML + CSS（**非** BPM 细流 JSON；**非** task8 泳道 SVG）。
- **主入口**：`frontend/js/valueStream.js` 的 `renderValueStreamViewHTML`；解析入口 `parseValueStreamGraph`。

### 1.2 数据与门控

- 工作区从案例上的 **`valueStream`**（或等价的 `vsm_data`）读取；门控与回填见 `problem-detail-runtime.js`（如 `resolveValueStreamForWorkflowAlignWorkspace`、`buildWorkflowAlignDisplayValueStream`）。
- 阶段内含 `steps[]`；环节可带 **L2 子卡**（`vsmL2`、`logic_meta` 等），由 `buildVsmL2SubcardHtml` 等拼装。
- 阶段级 **`clustering_reason`** 单独以「聚合逻辑」子卡展示，不挤在阶段标题里。

### 1.3 绘制逻辑（布局语义）

- **横向**：多列 **阶段**（`.vs-graph-stage`），列与列之间用 **→**（`.vs-arrow-outer`）。
- **纵向**：单列内多 **环节**（`.vs-step-node`），环节间用 **↓**（`.vs-arrow-inner`）。
- **滚动**：外层 `.vs-graph-scroll` 承载横向溢出。
- **主题**：L2 类型 Original / Enhanced 等对应不同节点主题色（与端到端事务流卡配色体系有呼应，但 DOM 类名独立）。
- **导出**：`problem-detail-chat.js` 中可对 `.vs-graph-scroll` 区域做 PNG 导出（依赖 html-to-image）。

### 1.4 与「流程图」一词的边界

此处「图」指 **价值流拓扑**（阶段-环节-角色-耗时等），**不**读取 `bpm_detailed_flow`，也**不**输出 task8 泳道 JSON。

---

## 2. 端到端事务流（task7 工作区 + 成图预览）

### 2.1 定位

- **任务**：端到端业务事务流（多事务节点），每个节点含 **`bpm_detailed_flow`** 细粒度 BPM 步骤列表。
- **两种视图**：
  1. **工作区主视图**：事务列表 + 每条事务下「BPM 流程设计」**横条**（圆角卡 + **→** 箭头），固定卡宽、可换行。
  2. **成图预览（抽屉）**：按 `bpm_detailed_flow` 绘制的**更接近流程图**的 HTML + SVG 连线（含开始/结束、核验/决策分叉等）。

### 2.2 工作区列表视图

- **渲染**：`valueStream.js` 的 `renderE2eBpmTransactionFlowHTML`。
- **数据**：合并后的 `e2eTransactionFlowJson`（含 `transaction_nodes` / 事务数组，依 schema 而定）。
- **逻辑**：按事务折叠卡展示；条带内为 `bpm_detailed_flow` 节点卡 + 箭头；样式类名以 `.e2e-bpm-tx-*` 为主，与 task8 泳道节点主题色对齐的是**视觉规范**而非同一套渲染函数。

### 2.3 `core_object_state_changes`（决策 / 执行步）

- **字段**：`bpm_detailed_flow[]` 在 `type` 为 **决策** 或 **执行** 时由 LLM 输出 **`core_object_state_changes`**（字符串数组，每项描述一条核心对象的状态迁移）；**输入 / 核验 / 留痕** 可省略或 `null`。
- **落库口径（推荐）**：每项为 **`对象名称｜状态 A → 状态 B`**（全角竖线 `｜`、Unicode 箭头 `→`）。解析端仍兼容旧式长句「**对象，从 A 改为 B**」。
- **工作区与预览展示**：
  - 子卡标题：**「核心对象状态变更」**；列表项经 **`buildCoreObjectStateChangeLineHtml`** 统一渲染为 **对象｜A → B**。
  - **分色**（`frontend/styles.css` `.e2e-bpm-core-state-*`）：对象名 **绿**、状态 A **橙**、状态 B **蓝**；分隔符 `｜` 与 ` → ` 为 **灰**（`.e2e-bpm-core-state-conn`）。
  - **展示清洗**：**`stripE2eCoreStateDisplayStatusPrefix`** 去掉 A/B 文案前缀「**状态**」+ 后续空白（如「状态 待签署」→「待签署」）；要求「状态」后须有空格/全角空格，避免误删「状态机」等词。
- **提示词与示例**：`frontend/js/task7-e2e-transaction-flow.js`（`buildE2ePerStageTransactionFlowSystemPrompt`、类目补齐 `buildE2ePrelimFvsCompletenessSystemPrompt`）；全文索引见 **`frontend/PROMPTS.md`** §6.1。

### 2.4 成图预览（抽屉）

- **生成 HTML**：`valueStream.js` 的 `buildE2eBpmTransactionFlowPreviewDiagramHTML`。
- **打开抽屉**：`problem-detail-chat.js` 的 `openE2eBpmPreviewDrawer` 等。
- **动态连线**：`syncE2eBpmPreviewDiagramWires`（`ResizeObserver`、端口、网关 T 型分叉等）。
- **专文**：更细的交互与线段规则见 **`docs/design/e2e-bpm-transaction-flow-preview.md`**（与 **FE-20260402-06** 等说明一致）。

### 2.5 与 task8 的差异

- task7 预览/条带直接消费 **`bpm_detailed_flow`** 的**事务内**数组形态。
- task8 泳道图消费的是 LLM 输出的 **`departments` + `stages` + `steps`** 矩阵 JSON（见第 3 节），二者 **Schema 与布局算法均不同**。

---

## 3. IT 设计补齐中的「流程图绘制」（task8）

### 3.1 定位

- **任务**：在每个事务的 IT 设计产出之后，由 LLM 生成 **BPM 泳道**可视化数据；展示在事务子折叠 **「流程图绘制」** 中。
- **形态**：**view｜json** 双 Tab；主路径为 **内联 SVG**（`renderItDesignBpmSwimlaneSvg`），历史或异常路径可兼容 **Markdown / Mermaid / 内联 SVG 块**。

### 3.2 数据链路

1. **LLM 输出**写入会话字段 **`bpmFlowDrawMarkdown`**（或聚合中的 `bpm_flow_diagram_markdown` 等回填路径，见 `problem-detail-runtime.js` 注释）。
2. **拆分**：`itDesignSupplement.js` 的 `splitItDesignBpmDrawMarkdownChunks` 等，得到多段 chunk（`flowJson` / `svg` / `mermaid` / `md`）。
3. **严格 JSON 归一**：`tryParseBpmFlowSwimlaneModel` → **`normalizeBpmFlowSwimlaneModel`**（部门/阶段/步骤校验、字段列表归一、**逻辑字段多键抽取** `extractBpmSwimlaneStepLogicString` 写入 `logic_text`）。
4. **挂载**：`buildItDesignSupplementTransactionViewHtml` 生成带 **`data-chunks-b64`** 的挂载点；**`main.js`** 的 **`hydrateItDesignBpmFlowViewIfNeeded`** 解码后按 chunk 类型渲染。

### 3.3 泳道 SVG 绘制逻辑（主路径）

- **实现文件**：`frontend/js/it-design-bpm-flow-render.js`。
- **入口**：`renderItDesignBpmSwimlaneSvg(container, model)`。
- **语义模型**：`format_version` **1.4.0**；`departments[]` 为**竖直泳道列**；`stages[]` 为 BPM 阶段语义；`steps[]` 每条含 `dept`、`stage`、`sentence` 等，且 `dept`/`stage` 必须落在上述数组中才能参与布局。
- **布局要点**（与文件头 FE 注释一致）：
  - 同列步骤**自上而下**顺序连接；跨列从当前节点**底边中点**到目标列下一节点**顶边中点**，竖向位置取 **max(目标列已有底部, 当前节点底) + 下一节点高度比例因子** 等规则，边线可用贝塞尔。
  - **决策**在泳道图中与普通过程一致为**单出口**（底边中点），**不**在图中展开网关分支（与 task7 预览分叉 UI 不同）。
  - 节点样式对齐 **`.e2e-bpm-tx-bpm-step-card--*`** 色系（输入/核验/决策/执行/留痕等）。
- **表头**：粘性 **流程标题 + 角色行**；主体区域可纵向滚动（`.it-design-bpm-swimlane-viewport` 等，见 `frontend/styles.css`）。
- **单泳道版式**：当 **`departments.length === 1`** 时，视口增加修饰类 **`it-design-bpm-swimlane-viewport--single-lane`**：宽度为**父级内容区的 50%**，**水平居中**（`margin-left/right: auto`），避免单列泳道被 CSS `width:100%` 拉满整行；多列泳道不加该类，仍占满可用宽度。
- **节点文案**：`pickLogicBodyText` 与归一化侧 **`extractBpmSwimlaneStepLogicString`** 同口径，避免仅认 `logic` 丢 `logic_text` 等问题。

### 3.4 兼容路径

- **flowJson** 解析失败或模型不完整时：view 可能回退为 **Mermaid**（需初始化）或 **净化后的 SVG**（`sanitizeItDesignBpmSvgHtml`），详见 `hydrateItDesignBpmFlowViewIfNeeded` 分支。

### 3.5 提示词与 Schema

- **IT 设计补齐（三位一体）**：**`IT_DESIGN_SUPPLEMENT_SYSTEM_PROMPT`** 要求 `role_and_permission.role_name` 落在 **可引用角色池**：已识别角色 ∪ 初步需求 **`operationModel.orgAndRoles.stakeholders` 摘录** ∪ {「系统」}；**系统处理节点**统一使用 **「系统」**，禁止编造无关角色。用户消息由 **`buildPreliminaryOrgStakeholdersExcerpt`** 等组装。
- **BPM 泳道**：**`IT_DESIGN_BPM_SWIMLANE_SYSTEM_PROMPT`** 与用户消息中的 **角色边界摘录** 约束 **`departments` / `steps[].dept`** 同上合并池；系统步 **`dept` 一律「系统」**。输出**严格 JSON** 作为**唯一结构化数据源**，由前端固定算法绘制，**不要求**模型输出 SVG/Mermaid 正文（主路径）。

---

## 4. 三处对照简表

| 维度 | 价值流图 | 端到端事务流 | IT 设计补齐·流程图绘制 |
| ---- | -------- | ------------ | ---------------------- |
| **主要任务** | task4 | task7 | task8 |
| **主数据** | `valueStream` / VSM JSON | `e2eTransactionFlowJson` + `bpm_detailed_flow` | 泳道 JSON（`departments`/`stages`/`steps`）或历史 md/svg |
| **主渲染** | `renderValueStreamViewHTML` | `renderE2eBpmTransactionFlowHTML` + 预览 `buildE2eBpmTransactionFlowPreviewDiagramHTML` | `renderItDesignBpmSwimlaneSvg` |
| **DOM/技术** | HTML + CSS，横向阶段 + 纵向环节 | HTML + CSS（条带）；预览 + SVG 连线 | SVG（泳道），hydrate 分块 |
| **角色/泳道** | 环节上展示角色等元数据 | 条带不按角色分栏；预览按 BPM 类型分叉 | **按 `dept` 分竖列泳道** |
| **状态迁移 UI** | — | **决策/执行** 步子卡「核心对象状态变更」；短格式 **对象｜A → B** 与分色（见 §2.3） | — |
| **与 BPM 细流关系** | 无 | 直接绑定 `bpm_detailed_flow`（含 `core_object_state_changes`） | LLM 重排为矩阵 steps，需归一化 |
| **单列表布局** | — | — | 仅 **1** 列泳道时视口 **50% 宽居中**（§3.3） |

---

## 5. 相关文档与代码索引

| 说明 | 路径 |
| ---- | ---- |
| 价值流解析与主图 | `frontend/js/valueStream.js`（`parseValueStreamGraph`、`renderValueStreamViewHTML`） |
| 端到端事务流 HTML | `frontend/js/valueStream.js`（`renderE2eBpmTransactionFlowHTML`、`buildE2eBpmTransactionFlowPreviewDiagramHTML`、`buildCoreObjectStateChangeLineHtml`） |
| task7 事务流 LLM 与合并 | `frontend/js/task7-e2e-transaction-flow.js`；提示词摘录 `frontend/PROMPTS.md` §6.1 |
| 预览抽屉与连线 | `frontend/js/core/problem-detail-chat.js`；设计文档 `docs/design/e2e-bpm-transaction-flow-preview.md` |
| IT 设计工作区与流程图 Tab | `frontend/js/itDesignSupplement.js`；`docs/design/it-design-supplement-workspace.md` |
| 泳道 SVG 与导出 | `frontend/js/it-design-bpm-flow-render.js` |
| view 挂载与 hydrate | `frontend/main.js`（`hydrateItDesignBpmFlowViewIfNeeded`） |
| 工作区门控与 valueStream / task8 回填 | `frontend/js/core/problem-detail-runtime.js` |
| 前端模块清单（单行 FE 索引） | `frontend/js/AGENTS.md` |

---

**维护**：若三处之一的数据结构、入口函数、BPM 字段（如 `core_object_state_changes`）、泳道视口版式或 Tab/hydrate 契约变更，请同步更新本文、`docs/design/e2e-bpm-transaction-flow-preview.md`（预览侧）与 `docs/design/AGENTS.md` 成员表。
