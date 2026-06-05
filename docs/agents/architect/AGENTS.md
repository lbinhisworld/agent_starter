# Folder: docs/agents/architect

## 地位

架构 owner **分层文档的短索引**。本目录提供「核心准则 → 上下文 → 操作方法 → 台账」闭环；长篇历史见 `docs/agents/architect-owner.md`（迁移参考，非主读路径）。

**任务号**：`ARCH-20260325-02`（补充收口）。

## 使用顺序（建议）

1. **`00-core.md`** — 执行规则、角色定位、**owner 硬门禁**、总控任务制度与分工边界  
2. **`01-context.md`** — 当前项目结构、已知背景与架构判断摘要  
3. **`02-playbooks.md`** — 派工模板、**Task Contract v1**（高风险先写合同）、**owner 默认输出与动手前四问**、验证与接手清单  
4. **`03-active-tasks.md`** — ARCH 活跃/未关账轻量台账与编号规则  

## 成员文件

| 文件 | 职责 |
| ---- | ---- |
| `00-core.md` | 核心准则（≤200 行）：`project-core` 对齐、角色、owner 硬门禁、总控记录制度、分工与代码修改边界 |
| `01-context.md` | 当前上下文：目录与双前端重点、本周主线、系统现状与方向结论 |
| `02-playbooks.md` | Playbooks：台账条目模板、Task Contract v1、owner 默认输出、动手前四问、运行时验证与可转发提示词习惯 |
| `03-active-tasks.md` | 轻量 ARCH 台账（活跃摘要 + 已关闭索引）；**不承载**长篇过程或每日更新 |

## 交叉引用

- 上级索引与治理规则：`docs/agents/AGENTS.md`  
- 根协作约定：根目录 `AGENTS.md`、`.cursor/rules/project-core.mdc`  

**触发器**：本目录四层文件增删、职责或阅读顺序变化时，同步更新本短索引。
