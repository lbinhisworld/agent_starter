# Folder: e:\03_do1_workspace\do1_smart_cto

## 地位

本仓库的全局协作约定与架构入口文档。用于让后续在任意子目录工作的 AI 能重建局部上下文并理解顶层边界。

## 职责

1. 约定技术栈与模块划分（`frontend-vue` / `backend`；原 `frontend/` 已废弃并入 `frontend-vue/`）。
2. 定义“代码修改后必须同步文档”的触发链（参考 `.cursor/rules/project-core.mdc`）。

## 约束

- **Git 提交与推送（强制）**：每次 `git commit` 之后、`git push` 之前，**必须先向用户展示将要推送的 commit 内容（commit message + 涉及文件）并等待用户确认**，未获明确同意不得 push。涉及数据通路/存储/鉴权/配置的改动，commit 前还须验证数据回填（如列表能加载出真实数据），不能只看页面无报错就提交。
- **Cursor / VS Code 工作区主题**：本仓库采用 **暗黑蓝** 定制深色主题，配置见 `.vscode/settings.json`（说明见 `.cursor/AGENTS.md`）。
- 若新增顶层模块或调整通信边界（前后端接口形态），需要更新本文件的描述。
- 若以 `docs/agents/architect/00-core.md` 初始化为 **architect owner**，默认聚焦**架构判断、拆工派工、审查与验收口径**；未获明确授权前，不直接修改 `frontend-vue/`、`backend/` 业务代码。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `docs/agents/` | 多角色 agent 面板；架构 owner 主读 `docs/agents/architect/`；业务产品主读 `docs/agents/business-product/` |
| `docs/design/` | 交互与视图补充设计说明（索引见 `docs/design/AGENTS.md`；如 task7 事务流程图预览、task1 初步需求工作区、`visual_design.md` 价值流/端到端（含核心对象状态变更展示）/task8 泳道（含单泳道版式）逻辑总览） |
| `.vscode/settings.json` | 工作区 **暗黑蓝** 编辑器主题与 `liveServer` 等本地偏好 |
| `.cursor/AGENTS.md` | Cursor 规则/agent 目录索引；主题约定指向 `.vscode/settings.json` |
| `frontend-vue/` | **唯一自包含前端工程**（Vue 3 + Vite）。登录/管理端、首页影子页（`home.html` / `src/home/`）与 `src/api/client.ts` 统一鉴权与续期头；共享运行时资源在 `public/static/`、被 import 的 legacy JS 在 `src/legacy/`；产物输出 `dist/`，发布包 `release/`（`npm run build:dist`）。原 sibling `frontend/` 已废弃（改名 `frontend.bak/`） |
| `backend/` | 后端代理与业务服务模块。**本地 Windows 联调**：拉代码后先核对 `backend/.env`，再统一执行 `backend/scripts/start-local-backend.ps1`（勿跳过整条脚本；说明见 `backend/scripts/README-local.md`）。设计详情推理图 **`DesignDetailTaskToken` / `DesignFeatureNode` / `DesignLogicLink`** 新主键形态与分配器见 **`backend/src/modules/problem-cases/design-detail-graph-ids.ts`**，背景摘要见 **`docs/agents/backend/01-context.md`**。 |

