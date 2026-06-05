# localItGap.js（task9）

> 最近更新：2026-04-03。task9 在 `main.js` 仅保留对话区 **任务启动通知** 与确认（进行中）；**门户编排、聊天块下发与点击处理**已下线。本文件保留 `generateRoleTaskCenterPortalDesign` 等函数供历史数据/其它入口潜在复用。

## 职责

- **门户**：`generateRoleTaskCenterPortalDesign`、`parseRoleTaskCenterPortalDesignFromContent`、`buildRoleTaskCenterPortalWorkspaceHtml`、`hasBpmDetailedFlowForRolePortal` 等。
- **历史兼容**：`parseLocalItGapFromContent`、`buildLocalItGapStructuredHtml`、`buildLocalItGapMarkdown` 供聊天区旧 `localItGapAnalysisCard` 只读展示。
- **聊天横幅**：`showLocalItGapExistingBlockBanner` / `scrollChatToBlock`（若主流程仍调用）。

## 主流程（main.js）

- 仅：`taskStartNotification`（task9）用户确认后刷新聊天/工作区并 `focusWorkspaceOnCurrentTask('task9')`（有价值流时）；无 `roleTaskCenterDesignIntentBlock`、无门户 LLM、无 `pushTask9PostPortalContextAndTaskCompleteConfirm`。
- 任务完工仍由 `itGapCompletedStages` 含 `2` 判定（如后端/手工写回）；不再使用 `generateLocalItGapSessions`、按环节分析链等（已删除）。

## 导出（window）

| 符号 | 说明 |
|------|------|
| `ROLE_TASK_CENTER_BPM_SYSTEM_PROMPT` | 门户 system 提示 |
| `generateRoleTaskCenterPortalDesign` 等 | 门户生成与解析 |
| `buildLocalItGapStructuredHtml` 等 | 旧版四维度展示 |
| `LOCAL_ITGAP_STRUCTURED_SECTIONS` | 四维度键与标题 |

**触发器**：本文件或 task9 门户/历史展示逻辑变更时更新本文与相关 `AGENTS.md`。
