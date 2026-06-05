# Folder: frontend-vue/src/tool-experience

## 地位

Vue 独立页「工具经验」：多产品能力画像提炼，与 `home.html` 同源鉴权与 `api.js`，不加载 `main.js`。

## 职责

1. `ToolExperiencePage.vue`：左侧对话（解析动效、提炼完成/知识树整合通知卡）；右侧 **知识工作区** Tab：**解析工作区** → **沉淀知识树** → **上传历史**；标题栏 **导出/导入** 知识树 + 上传历史 JSON（`tool-experience-workspace-backup.ts`）；进入页拉取知识树与对话区（`fetchToolExpChatState`），变更防抖 `saveToolExpChatState`；第二步通知「确定」后合并当前 `result` 并 `saveToolExpKnowledgeTree`。
2. `ToolExpKnowledgeTreePanel.vue`：三级主题目录树（产品工具 / 工具对比 / 典型场景）；产品「核心功能」树形 +「能力画像」下按 `capability_fingerprint` 键展开为维度子节点（与 `ToolExpResultCard` 十大维度中文名一致）；工具对比逻辑同前；典型场景二级=行业、三级=场景内容（场景描述正文内 `products_used` 绿底白字；`products_used` 全量展示在「功能实现」标题栏「｜」后；功能正文纯文本）。
3. `knowledge-tree-payload.ts`：知识树 JSON 类型与 `mergeExtractIntoKnowledgeTree`；工具对比正文展示用 `groupComparisonEntriesForTree`、`formatComparisonDetailLines`（按工具拆行 + ✅/❌）。
4. `tool-experience-workspace-backup.ts`：知识工作区备份 `format`/`version`、导出对象与导入校验（知识树 + `uploadHistory`）。
5. `capability-prompt.ts`：system 提示词 V3（单一真源）。
6. `ToolExpResultCard.vue`：解析卡 view/json。
7. `upload-history-storage.ts`：上传历史 localStorage。
8. `main.ts`：挂载 `#tool-exp-app`。

## 约束

- LLM 调用须 `taskTag: 'tool-experience-capability'`。
- 知识树：**online 且已登录** PUT/GET `BACKEND_API_URL/me/tool-experience/knowledge-tree`；否则仅用 `localStorage`（`toolExperience.knowledgeTree.v1`）。
- 对话区：同上路径 `.../chat-state`，本地键 `toolExperience.chatState.v1`；持久化不含 `parsing` 占位。
- 导入备份后会调用 `saveToolExpKnowledgeTree` 与 `saveUploadHistory`；仅接受 `format=smart-cto-tool-experience-knowledge-workspace` 且 `version=1` 的本页导出文件。
- 布局间隔见 `ToolExperiencePage.vue` scoped 样式。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `ToolExperiencePage.vue` | 页面根组件 |
| `ToolExpKnowledgeTreePanel.vue` | 知识树目录 UI |
| `knowledge-tree-payload.ts` | 载荷类型与合并 |
| `tool-experience-workspace-backup.ts` | 知识工作区导出/导入 JSON |
| `ToolExpResultCard.vue` | 解析卡片 |
| `capability-prompt.ts` | 提示词 |
| `upload-history-storage.ts` | 上传历史 |
| `main.ts` | 入口 |

**触发器**: 本目录行为或契约变更时更新本文档。
