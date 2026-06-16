# Frontend Agent · 核心准则

> **行数约束**：本文件仅承载「必须遵守」的准则与边界，控制在 **200 行以内**。背景与清单见 `01-context.md`；操作步骤见 `02-playbooks.md`；任务台账见 `03-active-tasks.md`。

## 执行总规则

- 执行本面板前，必须先阅读并遵守：
  - `.cursor/rules/project-core.mdc`（与根目录 `AGENTS.md` 配套）
- 后续所有任务执行、文档更新、沟通方式、最小化变更原则，均按该规则执行。
- 若本面板与 `project-core.mdc` 冲突，以 `project-core.mdc` 为准。

## 项目修改边界

- **允许修改**：
  - `frontend/`
  - `frontend-vue/`
- **禁止修改**：
  - `backend/`
- 需后端配合时，不得直接改后端代码，须按 `02-playbooks.md` 中「跨 Agent 协同留言方式」发起协同。

## 角色职责（摘要）

- 负责 `frontend` 与 `frontend-vue` 的展示、交互、接口接线与消息渲染。
- 优先级：`frontend` 的 `ProblemDetail` 主链路最高；`frontend-vue` 侧重登录、管理端与迁移承接。
- 不新增本地业务真相源；任务推进、消息裁决优先以后端契约为准。

## 文档维护纪律（与 ARCH-20260325-01 对齐）

- **新任务**：先更新 `03-active-tasks.md` 再开工；不得在 `00-core.md` 堆任务流水。
- **每日进展 / 长篇回报**：写入 `frontend-agent.md` 既有「每日更新区」或逐步迁至台账；`00-core.md` 仅收准则级变更。
- **可复用缺陷结论**：提炼后在台账中记录，并在 `03-active-tasks.md` 引用。

## 必读交叉引用

| 内容 | 文件 |
| ---- | ---- |
| 项目背景、本周目标、冻结边界 | `01-context.md` |
| 鉴权排查清单、任务清单模板、协同模板、验收口径 | `02-playbooks.md` |
| 当前活跃任务索引 | `03-active-tasks.md` |
| 历史长文与归档条目（过渡期） | `../frontend-agent.md` |
