# Folder: docs/plans/agent-starter

## 地位

**agent-starter** 模板项目的前期设计与实施计划子目录。用于在从 smart-cto 复制并裁剪出通用 Agent 样板之前，冻结目标、边界、环境与裁剪策略；不替代具体 Agent 产品内的 `docs/agent-spec/` 真源。

## 职责

1. 维护 agent-starter 的**唯一主记录**（`README.md`）。
2. 说明 smart-cto 与 agent-starter、各衍生 Agent 仓库之间的关系与隔离方式。
3. 为后续复制、建库、裁剪、验收提供可独立阅读的口径。

## 约束

- 本目录描述**模板与流程**；Smart CTO 产品行为仍以 `frontend-vue/src/design-detail/` 及后端 `problem-cases` 为准。
- 实施进度、阶段结论应回写 `README.md`，不在聊天中散落。
- 增删本目录文件时同步更新 `docs/plans/AGENTS.md`。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `docs/plans/agent-starter/README.md` | agent-starter 前期设计说明（目标、架构、复制方式、数据库、裁剪清单、验收） |
| `docs/plans/agent-starter/AGENTS.md` | 本目录索引 |

**触发器**: 一旦本文件夹增删文件或 agent-starter 边界/阶段变化，请立即重写本文件。
