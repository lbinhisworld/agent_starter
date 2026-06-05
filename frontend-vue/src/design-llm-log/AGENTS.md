# Folder: frontend-vue/src/design-llm-log

## 地位

设计详情配套页：只读展示当前案例在后端 `ProblemCaseLlmLog` 中的累计指标与调用列表。

## 职责

1. `DesignLlmLogPage.vue`：读 URL `caseId`（及可选 `customerName`、`archiveNo`），调用 `backendApi.fetchCaseLlmLogs`。
2. `main.ts`：挂载 `#design-llm-log-app`。

## 约束

- 不加载 `task1BusinessInsight.js` / `storage.js`；与 `design-detail` 解耦，仅依赖鉴权与 `client.ts`。
- 入口 HTML 见仓库 `frontend-vue/design-llm-log.html`；生产构建产出 `frontend/design-llm-log.html` + `vue-auth-assets/design-llm-log.*`。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `DesignLlmLogPage.vue` | 指标卡 + 表格（taskId、调用目标经 `formatCallTargetForStatsDisplay` 展示如「客户需求提炼#n」、输入/输出 token、耗时 hh:mm:ss） |
| `main.ts` | Vue 挂载 |

**触发器**: 本文件夹增删文件或 API 契约变化时更新本文档。
