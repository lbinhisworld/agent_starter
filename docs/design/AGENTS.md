# Folder: docs/design

## 地位

补充「产品/交互/视图」层面的设计说明，与代码内 `AGENTS.md`（约束与 FE 编号）配合使用；篇幅较长的单一功能可独立成文，避免 `frontend/js/AGENTS.md` 单行过长。

## 职责

- 描述用户可见流程、布局意图、技术实现要点与关键 DOM/CSS 契约。
- 变更对应前端实现时，同步更新本文档目录表与具体设计文内章节。

## 约束

- 不重复粘贴大段代码；以路径、函数名、类名为索引。
- 与 **FE-20260402-06** 等约束编号交叉引用时，以 `frontend/js/AGENTS.md` 为准。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `docs/design/e2e-bpm-transaction-flow-preview.md` | task7 事务流程图预览：抽屉、节点、端口、两段式绘线、`ResizeObserver`；§6 含决策/执行步「核心对象状态变更」子卡与 `visual_design.md` §2.3 交叉引用 |
| `docs/design/it-design-supplement-workspace.md` | ITGap 子步 1「IT设计补齐」工作区：三子屏分页、主卡 DOM/全屏、`itDesignFsBtnHtml` 作用域（FE-20260409-it-fs-scope）、Session 对齐与流程图 view｜code |
| `docs/design/problem-detail-multi-case-and-task1-json.md` | 多案例切换时聊天/canonical 内存隔离；task1 初步需求 `json_object` 与 JSON 解析兜底（FE-20260403 / FE-20260403-28） |
| `docs/design/preliminary-requirement-workspace.md` | 初步需求 V2 工作区分区 Tab、状态逻辑 Mermaid（render/串行/全屏）、人员组织 stakeholders 提炼口径与 DOM/CSS 契约（FE-20260409-stm-fs / FE-20260409-stakeholders） |
| `docs/design/home-shadow-migration-map.md` | 首页 Vue 正式入口（`home.html`）与历史 legacy `#homeView` 的 DOM 对照表与差异说明（FE-20260406 / FE-20260406-02 删除 index 内旧壳；原文件名 `home-vue-shadow-migration-map.md`） |
| `docs/design/visual_design.md` | 价值流图（task4）、端到端事务流 BPM 展示与预览（task7，含 §2.3 `core_object_state_changes` / 对象｜A→B 分色）、IT 设计补齐泳道（task8，含单泳道 50% 居中）三者的数据与绘制逻辑对照总览 |
| `frontend-vue/src/design-detail/design_mode_promts.md` | 设计详情「简洁交互模式」：**提示词**台账（与 `frontend/PROMPTS.md` 交叉引用） |
| `frontend-vue/src/design-detail/design_mode_ux.md` | 设计详情「简洁交互模式」：**交互/沟通协议/卡片**台账（非提示词）；含推理图 **`tk_`/`ft_`/`lk_`** 主键与 **`GET …/design-detail/task-graph`** 数据真源摘要 |

**触发器**: 本目录增删文档或预览交互/视觉有重大变更时，更新本文件。
