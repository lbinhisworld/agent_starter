# Folder: .cursor

## 地位

本目录存放 Cursor 协作规则、子 agent 定义与项目级 Cursor 插件配置。

## 职责

1. `rules/`：面向 AI 的持久化规则（`.mdc`）。
2. `agents/`：可派生的角色 agent 说明。
3. `settings.json`：Cursor 插件等项目级配置（非编辑器配色；配色见仓库 `.vscode/settings.json`）。

## 约束

- **编辑器主题（暗黑蓝）**：本仓库工作区统一采用 **Default Dark Modern + 深蓝定制色**，定义在 [`.vscode/settings.json`](../.vscode/settings.json)（侧栏 `#111827`、编辑区 `#0F1419`、强调色 Material Blue `#1976D2` / `#2196F3` / `#64B5F6` 等）。克隆仓库后用 Cursor/VS Code 打开本目录即可自动生效；若全局 `window.autoDetectColorScheme` 与之为冲突，工作区已关闭自动随系统切换，以保持暗黑蓝观感。
- 修改主题配色时仅改 `.vscode/settings.json`，并在本文件「成员清单」中注明变更日期（可选一行摘要）。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `.cursor/rules/project-core.mdc` | 全局核心协作规则（始终应用） |
| `.cursor/rules/project-core-mdc.mdc` | 引用 project-core 的桥接规则 |
| `.cursor/settings.json` | Cursor 插件开关（如 superpowers） |
| `.vscode/settings.json` | **工作区暗黑蓝主题**（2026-06-05 由淡蓝浅色切换）与 `liveServer` 端口等 |

**触发器**: 本文件夹增删规则/agent 或调整项目级 Cursor 配置时，请立即重写此文档。
