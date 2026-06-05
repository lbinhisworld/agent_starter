# Folder: frontend/js/legacy

## 地位

`frontend/main.js` 拆分过程中承接 **仅 DOM 与壳层** 的 legacy 模块，与 `main.js` 的 bridge 配合；不含业务编排。

## 职责

1. Phase 2A：`app-dom.js` 集中主站壳层 `getElementById` / `querySelector` 缓存（`el`），及纯 DOM helper（`setHidden`、`toggleClass` 等）。**FE-20260406-02**：`index.html` 已移除 legacy `#homeView` 及首页录入/列表相关 id，**`el` 中不再缓存** `homeView`、`digitalProblemInput`、`problemFollowListContent` 等（详情/Task 追踪等壳仍缓存）。**FE-20260413**：主站顶栏已移除「知识库」及 `#toolsView` 相关 id 缓存。**FE-20260408**：主站顶栏新增 `btnModelConfig` 作为个人模型配置永久入口，仍属壳层按钮缓存，不引入业务规则。**FE-20260409**：详情对话顶栏缓存 `btnProblemDetailAddRequirement`（+需求）。
2. Phase 2B：`problem-detail-renderer.js` 承接详情顶栏案例编号、对话标题栏阶段徽章、步骤条等只读状态 DOM 输出；`problem-detail-events.js` 仅绑定详情区事件并转发至 `main.js`（**FE-20260411**：`onProblemDetailBodyClick` 委托「+需求」）；`renderProblemDetailContent` 宿主仍在 `main.js`（Phase 3B）。

## 约束

- 不得修改 selector、壳层 DOM 结构、按钮 id/class（除非主记录批次明确允许）。**FE-20260330-17**：新增详情顶栏 `btnProblemDetailExceptionResume`（异常继续），与 `main.js` 异常快照联动。
- 不向本目录迁入业务规则、任务状态机或 API 契约。

## 成员清单

| 文件路径 | 简述 |
| ---- | --- |
| `frontend/js/legacy/app-dom.js` | Phase 2A：`buildShellElementCache` / `el` / `SmartCto.appDom`；`problemDetailCaseHeadline`、`problemDetailChatMessages` 为 DOM 节点；**FE-20260408**：新增 `btnModelConfig` 顶栏按钮缓存；**FE-20260409**：`btnProblemDetailAddRequirement` |
| `frontend/js/legacy/problem-detail-renderer.js` | Phase 2B：`init(deps)` + `updateArchiveNoBadge` / `updateChatHeaderLabel` / `updateTaskStepBar` 等；`SmartCto.problemDetailRenderer`；不含 `renderProblemDetailContent` 宿主 |
| `frontend/js/legacy/problem-detail-events.js` | Phase 2B：`install(handlers)` 仅注册监听并转发；`SmartCto.problemDetailEvents` |

**触发器**: 一旦本文件夹增删文件或对外 DOM 面变化，请立即重写此文档。
