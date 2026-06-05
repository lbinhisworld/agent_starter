# 问题详情：多案例切换隔离与 Task1 初步需求 JSON 管线

## 元数据

- 适用：`frontend` 主站问题详情（`problemDetail`）、task1 初步需求深度提炼与补充链路
- 关联 FE 编号：FE-20260403（换案隔离）、FE-20260403-28（初步需求 JSON）
- 状态：active

---

## 1. 多案例切换隔离

### 1.1 现象与根因（已修复前）

在案例 A 处于「工作流对齐 / 价值流」等大阶段或持有较长聊天数组时，直接打开案例 B，首帧 `__appState.problemDetailChatMessages` 仍为 A 的数据，而 `getProblemDetailChatMessagesForCanonical` 若「内存非空即用」，会把 **A 的 messages** 用于推导 **B** 的 `getCanonicalCurrentProblemFollowTaskState`，导致 B 的顶栏阶段、步骤条与真实进度不一致。

### 1.2 设计要点

| 机制 | 说明 |
| ---- | ---- |
| `problemDetailChatMessagesCaseKey` | 与 `SmartCto.appState.problemDetailChatMessages` 绑定，值为 `getProblemDetailChatStorageKey(item)`（`createdAt` 优先，否则 `id`）。 |
| 换案首帧 | `openProblemDetail` 在设置 `currentProblemDetailItem` 后将 `problemDetailChatMessagesCaseKey = null`，直至 `initProblemDetailChat` 按本案从存储加载后再写入键。 |
| Canonical 读取 | `getProblemDetailChatMessagesForCanonical(item)` 仅当 `memKey === itemKey` 且内存非空时返回内存；否则读 `getProblemDetailChats()[itemKey]`。 |
| Bundle 刷新 | `refreshProblemDetailBundleFromBackend` 在调用 `getProblemDetailChatMessagesForCanonical` 前失效键，避免「已更新 item、尚未重载聊天」窗口期串数据。 |
| 等待反馈 | `problemDetailWaitingForFeedback` 与当前案例存储键不一致时清空。 |
| 子步骤 | 新案 `majorStage` 非 2 时重置 ITGap 默认子步；非 3 时 `itStrategyPlanViewingSubstep = 0`。 |

### 1.3 代码索引

- `frontend/js/core/app-state.js`：`problemDetailChatMessagesCaseKey`、`setProblemDetailChatMessages(msgs, caseKey)`
- `frontend/js/core/problem-detail-chat.js`：`append` / `pushAndSave` 传入存储键
- `frontend/main.js`：`openProblemDetail`、`refreshProblemDetailBundleFromBackend`、`getProblemDetailChatMessagesForCanonical`、`initProblemDetailChat`、回滚/重启/重置等整段替换 messages 的路径

---

## 2. Task1 初步需求 JSON 管线

### 2.1 目标

补充长文档（如访谈记录）时，模型易在 JSON 字符串内使用未转义的 `"`、或用中文顿号代替英文逗号，导致 `JSON.parse` 失败。通过 **提示词约束 + 上游 json 模式 + 前端多策略解析** 降低失败率。

### 2.2 调用约定

| `taskTag` | 用途 |
| --------- | ---- |
| `task1-prelim-depth-v2` | 深度提炼 `parsePreliminaryRequirementDepthV2` |
| `task1-prelim-refine` | 按用户意见修订 `refinePreliminaryRequirementV2WithFeedback` |
| `task1-prelim-merge` | 字段融合 `mergePreliminaryRequirementV2ByLlm` |

均建议传 `maxOutputTokens: 8192`（与后端硬封顶对齐）。

### 2.3 上游 JSON 模式

- **Online**：`POST /api/ai/chat` 在上述 `taskTag` 时于上游 body 增加 `response_format: { type: 'json_object' }`（`backend/src/modules/ai/ai.routes.ts`）。
- **Local**：`frontend/js/api.js` 对相同 `taskTag` 走 **非流式** 请求并带 `response_format` 与 `max_tokens`，避免流式拼接与非法尾部混杂。

### 2.4 前端解析兜底

`frontend/js/preliminaryRequirement.js` 内 `parsePreliminaryLlmJsonObject`：

- 多 `{` 起点括号配对截取候选，按长度降序尝试（优先最外层大对象）
- 可选 Markdown 围栏剥离
- 变体：弯引号 → 「」、常见 `"，"` / `}，"` 等分隔符归一后再 `JSON.parse`

系统提示词约束见 `PRELIMINARY_V2_DEPTH_SYSTEM_PROMPT` 及修订/合并 prompt；文档副本见 `frontend/PROMPTS.md` §1。

### 2.5 工作区展示与人员组织口径（交叉文档）

- **状态逻辑**（`stateTransitionMatrix` → 按实体 Mermaid）、**全屏**、**hydrate 串行 / `mermaid.render` / `htmlLabels: false`** 等交互与样式契约，见 **[初步需求工作区](./preliminary-requirement-workspace.md)** §1～§2。
- **人员组织** `stakeholders` 与核心对象/状态/价值流 **可引用角色池**、去重与结构约束，见同文档 §3，及 `PROMPTS.md` §1 约束摘要。

---

## 修订记录

- 2026-04-03：初稿；与 `frontend/数字化问题跟进阶段设计.md` §0.8、`PROMPTS.md` §1 对齐。
- 2026-04-09：增 §2.5，指向 `preliminary-requirement-workspace.md`（工作区 UI + 状态逻辑 Mermaid + 人员组织提炼口径）。
