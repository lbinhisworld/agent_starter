# Folder: frontend-vue/src/home

## 地位

Vue 正式首页（`home.html`）源码目录，与 `frontend/js/core/problem-follow-shared.js`（案例键 / 高亮）及全局 `storage` 链配合。

## 职责

1. `HomePage.vue`：与 legacy `#homeView` DOM 对照（见 `docs/design/home-shadow-migration-map.md`），并承载首页顶栏「模型配置」永久入口；案例列表工具栏右侧「工具经验」跳转 `tool-experience.html`（**FE-20260422**）；客户档案卡「设计」跳转 `design-detail.html?caseId=&customerName=&archiveNo=`（**FE-20260428**）。
2. `problem-follow-home.ts`：首页卡阶段文案、列表高亮排序、图标与时间格式（**FE-20260406-04A**：自 `frontend/js/home-follow-card-bridge.js` 迁入，不依赖 `main.js`）。
3. `main.ts`：挂载应用；打包 `problem-case-api`。

## 约束

- 不改 `problem-follow-shared.js` 与 session 键名；高亮须经 `SmartCto.problemFollowShared`。
- 阶段推导与 `main.js` 中 canonical 规则对齐；task1 以持久化聊天为准（与详情内存路径可能不同，见 FE-20260406-04 调研）。
- **FE-20260407-home**：首页首屏不再依赖全量 message 预拉；`HomePage.vue` 需在 `problemCasesChanged` 后先渲染案例列表，复制案例时若本地无源聊天缓存则按需调用 `problemCaseApi.refreshProblemDetailBundle(caseId)` 补拉。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `HomePage.vue` | 首页根组件；列表先于全量聊天渲染，复制案例按需补拉源聊天；**FE-20260428**：档案卡「设计」→ 亮色设计详情页；**FE-20260413**：顶栏已移除「知识库」；「模型配置」指向同一份 `model-config.html` |
| `problem-follow-home.ts` | 首页卡 canonical / 阶段标签 / 列表排序（`createdAt`/`updatedAt` 新→旧；高亮仅样式）/ 图标；阶段标签读持久化聊天 helper（含 `id`/`createdAt` 双键兜底） |
| `main.ts` | 入口挂载 |

**触发器**: 本目录增删文件或首页卡行为变更时更新本文档。
