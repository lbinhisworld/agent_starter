# 初步需求工作区（V2 分区 Tab · 状态逻辑 · 人员组织 · 全屏）

## 元数据

- **适用**：问题详情 task1「初步需求」折叠卡；`preliminaryReq` 深度 V2 结构在工作区的只读展示与全屏阅读。
- **关联实现**：`frontend/js/preliminaryRequirement.js`（HTML 合成、Mermaid 源码生成）、`frontend/main.js`（hydrate / 全屏 / 卡折叠绑定）、`frontend/styles.css`（分区与全屏 flex 链）。
- **关联 FE 口径**：`frontend/AGENTS.md` 中 **FE-20260409-stm-fs**（状态逻辑 Mermaid 与全屏）、**FE-20260409-stakeholders**（人员组织提炼提示词）、**FE-20260409-stm-esc**（标签转义）。
- **状态**：active

---

## 1. 信息架构与 DOM 契约

### 1.1 顶栏与分区

- 工作区卡根节点：`.problem-detail-card-preliminary-tabs`；顶栏含 **view｜JSON｜历史详情** 与整块 **全屏** 按钮（`problem-detail-chat.js` `setupProblemDetailPreliminaryFullscreen`）。
- view 内横向分区 Tab 与面板路径由 `PRELIMINARY_V2_WORKSPACE_VIEW_SECTIONS` 驱动（`buildPreliminaryWorkspaceSectionTabsHtml`），含 **商业背景、核心对象、状态逻辑、需求痛点、IT 现状、人员组织、业务流程、路线图、分析备注** 等；无数据分区不展示或占位以产品为准。

### 1.2 状态逻辑分区

- 数据路径：`preliminaryReq.stateTransitionMatrix`。
- 展示策略：按 **entity** 分组后 **一实体一张图**（`buildPreliminaryStateTransitionMatrixPanelHtml`），单列网格 `.problem-detail-prelim-stm-grid`，每行 `.problem-detail-prelim-stm-row`（左侧序号 + `.problem-detail-prelim-stm-card`）。
- 每张卡：顶栏标题（实体展示名）+ **单卡全屏** 按钮；正文为 Mermaid 挂载点 `.problem-detail-prelim-stm-mermaid-mount`（内藏 `textarea.problem-detail-prelim-stm-mermaid-store` 存源码、`.problem-detail-prelim-stm-mermaid-host` 承接渲染结果）。

### 1.3 人员组织分区

- 数据路径：`preliminaryReq.operationModel.orgAndRoles`（`stakeholders` 字符串数组等）。
- UI：`buildPreliminaryOrgAndRolesPanelHtml`；`stakeholders` 支持「标题：正文」拆卡展示。

---

## 2. 状态逻辑 · Mermaid 与稳定性

### 2.1 源码生成

- `buildStateTransitionMatrixMermaidSourceForEntity` → 单实体 `flowchart TB` + `subgraph` + 状态节点与带标签边。
- **标签清洗**：`prelimStmEscapeMermaidQuotedLabel` 去除易破坏语法的字符，并将 `[]#<>` 等替换为全角，避免子图/注释/HTML 解析误切分；详见文件头 **FE-20260409-stm-esc**。

### 2.2 渲染管线（浏览器）

- 入口：`main.js` `hydratePrelimStateTransitionMatrixIfNeeded` → 内部串行执行体 `runHydratePrelimStateTransitionMatrix`。
- **串行**：模块级 `__prelimStmHydrateChain`（Promise 链），避免切 Tab / 全屏事件重叠触发多次 `mermaid` 调用导致竞态（Syntax error、叠图）。
- **注入方式**：优先 `mermaid.render(id, spec)`，将返回的 SVG 包入 `.problem-detail-prelim-stm-mermaid-graph` 再写入 host；无 `render` 时回退 `mermaid.run`。
- **全局配置**：详情页内 IT 设计 BPM、task9 对象状态机与初步需求共用一次 `mermaid.initialize`；`flowchart.htmlLabels` 为 **false**（SVG 文本标签），降低 `foreignObject` 在多图、全屏、flex 布局下错位叠层的风险。
- 渲染前对 textarea 读出文本再经 `sanitizeItDesignBpmMermaidForRender` + **`sanitizePrelimStmMermaidQuotedPayloads`**（仅处理双引号 **字符串内** 的 `[]#<>`，兼容历史未转义数据）。

### 2.3 全屏行为

| 场景 | 行为要点 |
| ---- | -------- |
| **整块初步需求卡全屏**（`.problem-detail-card-preliminary-tabs:fullscreen`） | `styles.css` 补全 body → 分区面板 → 状态逻辑容器 → `stm-grid` / `stm-row` / 卡内 host 的 **flex + min-height**，使图区有高度；**不对**整块卡内全部子图做批量 `force` 重绘（避免连续 `mermaid` 重入）。 |
| **单张状态卡全屏**（`.problem-detail-prelim-stm-card:fullscreen`） | 进入/退出后 **debounce**（约 180ms）对当前根或退出后的初步需求根执行 **force** 重绘，修正视口变化后的布局。 |
| **绑定** | `fullscreenchange` / `webkitfullscreenchange`：`reflowPrelimStateTransitionMatrixAfterFullscreen`；`ensurePrelimStmFullscreenReflowListener` 在 `main.js` 启动时注册。 |

### 2.4 样式收口

- `.problem-detail-prelim-stm-mermaid-mount`：`position: relative`、`isolation: isolate`。
- `.problem-detail-prelim-stm-mermaid-host`：同上 + `contain: layout style`；`foreignObject` **overflow: hidden**（残余 HTML 标签时收口）。
- 整块全屏下 **勿** 对 `.problem-detail-prelim-stm-row` 使用 `flex: 1`（易与 grid 子项高度测量冲突），以 `align-self: stretch` + `width: 100%` 为主。

---

## 3. 人员组织 · 提炼口径（task1 提示词）

- **目标**：`operationModel.orgAndRoles.stakeholders` 中列举的具体角色须与 **同一份** `preliminaryReq` 中已有叙述一致，并避免重复块、重复角色名。
- **可引用角色池**：`coreBusinessEntities` 全文、`stateTransitionMatrix[].actor`、`operationModel.fullValueStreams[].actor` 中出现的称谓；**禁止**池外臆造。
- **结构**：「总部角色」「分支角色」等组织维度 **各至多一条**；条内角色列表去重；同角色不得在多条 `stakeholders` 中重复。
- **实现位置**：`PRELIMINARY_V2_DEPTH_SYSTEM_PROMPT`、`PRELIMINARY_V2_REFINE_SYSTEM_PROMPT`、`PRELIMINARY_V2_MERGE_SYSTEM_PROMPT`（`frontend/js/preliminaryRequirement.js`）；摘要见 `frontend/PROMPTS.md` §1。

> 说明：task10/task11 角色权限推演另有「可增支撑角色、不得删初步需求已定义角色」等口径，与上述 **task1 提炼子集约束** 环节不同，勿混为一谈。

---

## 4. 代码索引（速查）

| 主题 | 主要位置 |
| ---- | -------- |
| 分区 Tab HTML | `preliminaryRequirement.js` `buildPreliminaryWorkspaceSectionTabsHtml`、`PRELIMINARY_V2_WORKSPACE_VIEW_SECTIONS` |
| Mermaid 源码 | `preliminaryRequirement.js` `buildStateTransitionMatrixMermaidSourceForEntity`、`prelimStmAppendEntitySubgraph`、escape 函数族 |
| Hydrate / 全屏 reflow | `main.js` `runHydratePrelimStateTransitionMatrix`、`hydratePrelimStateTransitionMatrixIfNeeded`、`reflowPrelimStateTransitionMatrixAfterFullscreen`、`sanitizePrelimStmMermaidQuotedPayloads` |
| 卡折叠与 STM 按钮 | `main.js` `setupProblemDetailCardToggle`（初步需求分支） |
| 整块全屏按钮 | `problem-detail-chat.js` `setupProblemDetailPreliminaryFullscreen`、`syncPreliminaryWorkspaceCardFullscreenButtonState` |
| 样式 | `styles.css` `.problem-detail-card-preliminary-tabs:fullscreen` 下 STM 相关规则、`.problem-detail-prelim-stm-*` |

---

## 修订记录

- **2026-04-09**：初稿；收敛状态逻辑 Mermaid（`render`、`htmlLabels: false`、引号内清洗、全屏 reflow 策略、flex/CSS 契约）与人员组织提炼口径；与 `frontend/PROMPTS.md` §1、`frontend/AGENTS.md` 交叉引用。
