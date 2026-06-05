# Folder: frontend-vue/src/tool-detail

## 地位

工具详情独立页（`tool-detail.html`）：首页「工具集」入口的目标页，布局借鉴设计详情（顶栏工具标题 + 左对话 + 右工作画布）。

## 职责

1. 顶栏仅「返回首页」；当前工具名见左侧聊天区蓝标（无独立案例标题条）。
2. 左侧聊天标题栏：**「选择或新增工具」** 打开 `ToolDetailToolPickerModal`；当前工具以**蓝底白字**标签展示；工具名录持久化于 localStorage（`tool-suite-registry.ts`）；首页「工具集」仅为入口文案（`tool-detail.html` 无 `?tool=`），**不会**写入名录；历史误写入的「工具集」项在加载名录时自动剔除。
3. 左侧：须先选定工具（顶部蓝标）；未选工具时「添加」不可用；工具介绍输入后点击「添加」推送「→ 接收到…」「→ 正在提取…」；提炼走马字结束后推送 **「→ 是否将内容整合到工具知识集？」**（`tool-integrate-prompt`，是/否）；选「是」调用 `mergeParsedIntoToolKnowledge` 按工具/特征键合并三级 value；聊天记录按 `activeToolId` 分桶（`tool-detail-chat-persist.ts`）；LLM 使用 `tool-detail-l05-prompt.ts`。
4. 右侧：**工作画布**子 Tab **工具** / **特征**（同源工具知识集）；三级 value 支持**编辑/删除**（`ToolDetailValueLeafRow`）；持久化：localStorage 缓存 + online `GET|PUT /api/me/tool-detail/workspace`（`api.js` `fetchToolDetailWorkspace` / `saveToolDetailWorkspace`）；未整合前画布为空。

## 约束

- 构建产物：`vue-auth-assets/tool-detail.js`、`tool-detail.css`；变更后执行 `frontend-vue` 下 `npm run build`。
- 鉴权：`auth-runtime.js` 将 `tool-detail.html` 纳入业务页门禁。

## 成员清单

| 文件路径 | 简述 |
| ---- | --- |
| `main.ts` | Vue 入口，挂载 `#tool-detail-app` |
| `ToolDetailPage.vue` | 页面根组件（`td-*` 亮色布局） |
| `useToolDetailSession.ts` | 对话、L0.5 提炼组合式逻辑 |
| `tool-detail-l05-prompt.ts` | L0.5 工具原语特征 system 提示词真源 |
| `toolDetailChatReveal.ts` | 聊天子区逐字揭示与三行预览 |
| `toolDetailL05Format.ts` | 矩阵 JSON 格式化 |
| `ToolDetailFeatureTreePanel.vue` | 工作画布「工具」子 Tab 目录树 |
| `ToolDetailFeatureAxisTreePanel.vue` | 工作画布「特征」子 Tab 目录树 |
| `ToolDetailL05MatrixPanel.vue` | 旧版表格（已不用，可保留备查） |
| `tool-detail-chat-types.ts` | 聊天消息类型 |
| `tool-detail-chat-persist.ts` | 按工具 id 分桶聊天与 lastResult 持久化 |
| `tool-detail-knowledge-persist.ts` | 工具知识集读写、入库防抖、value 增删改 |
| `ToolDetailValueLeafRow.vue` | 三级 value 编辑/删除行 |
| `tool-suite-registry.ts` | 工具集名称 localStorage 读写 |
| `useToolSuiteSelection.ts` | 当前工具与选择器状态 |
| `ToolDetailToolPickerModal.vue` | 选择/新增工具弹层 |

**触发器**: 一旦本文件夹增删文件或架构逻辑调整，请立即重写此文档。
