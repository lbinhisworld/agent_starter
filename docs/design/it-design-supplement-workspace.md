# IT 设计补齐工作区（ITGap 子步 1）— 设计说明

## 1. 目标

在问题详情 **ITGap 大阶段** 中，将「IT设计补齐」与「端到端事务流」「对象状态机构建（task9）」**分页展示**，避免单屏堆叠；工作区以一张主卡承载 **按事务拆分的结构化产出**、**json / 压缩 json（旧形态）** Tab，并与聊天区 Session 计划、落库聚合字段 **同源对齐**。支持主卡 **全屏** 阅读，事务内 **流程图绘制** 支持 **view｜code** 切换（含历史 Mermaid 兼容路径）。

## 2. 在详情中的位置

| 概念 | 说明 |
| ---- | ---- |
| 大阶段 | `problemDetailViewingMajorStage >= 2` 且已具备价值流工作区前置条件时，进入 ITGap 工作区逻辑（见 `frontend/js/core/problem-detail-runtime.js` `renderProblemDetailContent`） |
| 子步骤 | `itGapViewingSubstep`（`main.js` 状态，`__host.getItGapViewingSubstep` 注入 runtime）：**0** 仅「端到端事务流」、**1** 仅「IT设计补齐」、**2** 仅「对象状态机构建」（占位工作区） |
| 顶栏切换 | 用户通过顶栏步骤条在三个子步间切换；确认 `globalItGapStartBlock` 后，产品流会将子步切至 **1** 并刷新工作区（与 **FE-20260403-18** 一致） |
| 滚动容器标记 | `.problem-detail-workspace-scroll` 上 `data-itgap-workspace-sub="0|1|2"`，便于样式或调试区分当前子屏 |

## 3. 主卡 DOM 与交互契约

| 元素 | 类名 / 约定 | 说明 |
| ---- | ----------- | ---- |
| 主卡根节点 | `.problem-detail-card-it-design-supplement`，`data-task-id="global-itgap"` | 与折叠、Tab 逻辑共用「问题详情卡」模式 |
| 标题栏 | `.problem-detail-it-design-supplement-header`，`role="button"` 可折叠整块卡 | 三列区域：左标题「IT设计补齐」、中 Tab 区、右 **全屏** + 折叠箭头 |
| 全屏按钮 | `.problem-detail-it-design-supplement-fs-btn`（与端到端全屏钮共用基础样式类 `problem-detail-e2e-flow-fs-btn`） | **全屏目标**为整块 `.problem-detail-card-it-design-supplement`；绑定 `setupProblemDetailItDesignSupplementFullscreen`（`problem-detail-chat.js` / `main.js` 代理）；`setupProblemDetailCardToggle` 对该钮 **`stopPropagation`**，避免误触标题栏折叠 |
| V1 正文 | `.problem-detail-it-design-supplement-tx-list` 内多枚 `.problem-detail-it-design-supplement-tx-card` | 每事务一枚子卡；无产出时为「待执行」类占位文案 |
| Tab | `detail` / `json`；旧聚合形态另可有 **压缩 json** Tab | 与 `setupProblemDetailCardToggle` 的 `data-tab` 约定一致 |

## 4. 占位卡 vs 有内容卡

当子步为 **1** 但尚无可渲染的 `globalItGapCardHtml` 时，工作区展示 **占位说明**（引导用户在聊天区确认 IT 设计补齐并执行 Session 计划），HTML 片段标识为 **`itDesignWorkspacePlaceholder`**（runtime 内模板字符串）。

**实现约束（FE-20260409-it-fs-scope）**：占位卡标题栏同样包含全屏按钮，其 HTML 字符串 **`itDesignFsBtnHtml`** 必须与占位模板处于 **同一作用域**（在 `if (igSub === 1)` 块 **外** 预先声明）。若仅在有正文分支内声明，占位路径会在运行时抛出 `ReferenceError: itDesignFsBtnHtml is not defined`，导致整页工作区无法打开。

## 5. 数据与聊天对齐

| 能力 | 索引 |
| ---- | ---- |
| 事务行列表 | `__host.resolveItDesignSupplementSessionsForTask8(item, msgs)`，与聊天 `itDesignSupplementSessionsBlock` / 列表缓存同源（**FE-20260408-it-design-workspace-resolve**） |
| 是否按 V1 展示子卡 | `isItDesignV1`：含 `itDesignSupplementV1`、**或** 已有 `itDesignSupplementSessions`、**或** 已有任一会话 `designOutputJson` 等（**FE-20260408-it-design-workspace**：已下发 Session 计划即可列出事务行，无产出显示「待执行」） |
| 端到端 BPM 与 ITGap 表列 | `resolveE2eTransactionFlowJsonForWorkspace` + `getBpmDetailedFlowForItDesignSession` 注入事务子卡内 ITGap 表「节点描述」「逻辑」等（**FE-20260408-itgap-bpm-cols**） |
| 仅有聚合无 session 时流程图文案 | 从 `globalItGapAnalysisJson.transactions[].bpm_flow_diagram_markdown` 回填 `bpmFlowDrawMarkdown`（**FE-20260407-bpm**） |

## 6. 流程图绘制：view｜code

子步 **1** 渲染完成后，runtime 在 `igSubSetup === 1` 时调用 **`setupItDesignBpmFlowDrawTabs(container)`**（`main.js` 实现，经 `__host` 注入），为各事务折叠区「流程图绘制」绑定 **view｜code**；view 主路径为 **SVG**（`sanitizeItDesignBpmSvgHtml`），并兼容历史 **Mermaid** 挂载（**FE-20260408-bpm-flow-tabs**）。

## 7. 与代码文档的交叉引用

细粒度 FE 编号与历史变更以 **`frontend/js/core/problem-detail-runtime.js`** 文件头 **`[PROTOCOL]`** 与 **`frontend/js/core/AGENTS.md`** 中 `problem-detail-runtime.js`、`problem-detail-chat.js` 行为准；本文仅固化 **用户可见结构、DOM 契约与易错实现点**。
