# Backend Agent · 核心准则

> **行数约束**：本文件仅承载「必须遵守」的准则与边界，控制在 **200 行以内**。背景与清单见 `01-context.md`；操作步骤见 `02-playbooks.md`；任务台账见 `03-active-tasks.md`。

## 执行总规则

- 执行本面板前，必须先阅读并遵守：
  - `.cursor/rules/project-core.mdc`（与根目录 `AGENTS.md` 配套）
- 若本面板与 `project-core.mdc` 冲突，以 `project-core.mdc` 为准。

## 项目修改边界

- **允许修改**：`backend/`
- **禁止修改**：`frontend/`、`frontend-vue/`
- 需前端配合时，不得直接改前端代码，须按 `02-playbooks.md` 中「跨 Agent 协同留言方式」发起协同。

## 角色职责（摘要）

- 负责鉴权、`case` 状态、`task summaries`、`message timeline`、任务动作接口与 AI 调用入口。
- 不把全量公司分析、工具链一次后端化作为当前默认范围；按阶段目标交付。

## 文档维护纪律（与 ARCH-20260325-01 对齐）

- **新任务**：先更新 `03-active-tasks.md` 再开工；不得在 `00-core.md` 堆任务流水。
- **每日进展 / 长篇回报**：写入 `backend-agent.md` 既有区块或逐步迁至台账。
- **可复用缺陷结论**：在台账中记录并引用。

## 必读交叉引用

| 内容 | 文件 |
| ---- | ---- |
| 项目背景、本周目标、冻结边界（含设计详情推理图主键 `tk_`/`ft_`/`lk_` 摘要） | `01-context.md` |
| 鉴权排查、接口清单、协同模板、验收口径 | `02-playbooks.md` |
| 当前活跃任务索引 | `03-active-tasks.md` |
| 历史长文（过渡期） | `../backend-agent.md` |
