# Folder: e:\03_do1_workspace\do1_smart_cto\docs\plans

## 地位

项目级长篇计划与实施主记录目录，用于承载跨阶段、跨任务的正式执行计划，不与 `docs/agents/*/03-active-tasks.md` 的轻量台账混写。

## 职责

1. 沉淀需要跨多阶段持续维护的设计与实施计划。
2. 为执行中的大型治理或迁移事项提供唯一主记录文档。
3. 让后续 AI 或研发在不依赖聊天历史的前提下恢复阶段计划、当前状态与验收口径。

## 约束

- 本目录文档优先承载**计划、阶段、依赖、进度、验收**，不替代 `docs/knowledge/` 的知识卡沉淀。
- `docs/agents/*/03-active-tasks.md` 只保留轻量索引、状态与链接；长篇执行过程统一链接到本目录主记录。
- 若某计划文档被指定为“唯一主记录”，后续阶段状态、验收结论、延期与风险应优先回写该文档，而不是散落在聊天里。
- 新增或调整本目录下的正式计划文档后，需同步更新本文件成员清单。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `docs/plans/2025-03-19-user-login-admin-backend-design.md` | 用户登录与管理员后台的设计与实施计划 |
| `docs/plans/2026-04-07-user-first-login-llm-key-gate.md` | 用户首次登录个人模型 Key 门禁与自助配置主记录；冻结“未配自己的 key 不得进入系统”的产品口径，并补充 owner Task Contract、前后端派工与验收口径 |
| `docs/plans/2026-03-29-frontend-mainjs-splitting-execution-plan.md` | `frontend/main.js` 拆分执行主记录；承载 Phase、批次、进度与验收；**§2.1** 为「堵不如疏」默认可改落点与 `main.js` Review 提示 |
| `docs/plans/problem-detail-migration-and-agent-loop/AGENTS.md` | ProblemDetail 迁移专项子目录说明；定义该目录内主记录与评审文档的职责边界 |
| `docs/plans/problem-detail-migration-and-agent-loop/README.md` | ProblemDetail 迁移、旧 `frontend` build 产线、后端 prompt 托管与 Agent Loop 协议的唯一主记录；先统一收口，后续再按稳定度拆到 `docs/design/` / `docs/knowledge/` |
| `docs/plans/problem-detail-migration-and-agent-loop/2026-04-10-review.md` | 对 ProblemDetail 迁移主记录初稿的架构评审；指出 build/deploy 合同、双渲染快照、prompt registry 与 Agent Loop 验收缺口 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/AGENTS.md` | ProblemDetail 工程化打包 / 轻混淆 / Vue 统一专项子目录说明；定义主记录、任务索引与任务级派工文档的职责边界 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/README.md` | ProblemDetail 双轨专项唯一主记录；冻结 A 线 build/minify/轻混淆 与 B 线 online-only Vue 壳层统一工程边界、phase gate、风险与回滚口径 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/agents/README.md` | ProblemDetail 双轨专项 agent 角色索引；汇总 architect-owner、frontend-impl、backend-contract、review-verifier 的职责与启动提示词入口 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/tasks/README.md` | ProblemDetail 双轨专项任务总索引；按 phase 汇总 39 张任务卡、依赖、交付物与验收边界入口 |

**触发器**: 一旦本文件夹增删计划文档、调整主记录策略或改变计划文档职责边界，请立即重写本文件。
