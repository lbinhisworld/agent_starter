# Folder: e:\03_do1_workspace\do1_smart_cto\docs\plans\problem-detail-build-obfuscation-and-vue-unification

## 地位

ProblemDetail 工程化打包 / 轻混淆 / Vue 统一专项子目录，用于承载该事项的唯一主记录、任务索引与任务级派工文档。

## 职责

1. 维护该专项的唯一主记录与阶段状态。
2. 将专项拆解为可直接派工的最小任务文档。
3. 让后续接手的 AI 或研发在不依赖聊天历史的前提下恢复边界、依赖、验收与回滚口径。
4. 为本专项内的不同执行角色提供可直接复用的 agent 提示词与角色边界。

## 约束

- `README.md` 是该专项的唯一主记录；状态、延期、风险、回滚与验收结论优先回写 `README.md`。
- `tasks/README.md` 是任务索引入口；`tasks/phase-*/*.md` 是派工与验收的最小单元。
- `agents/README.md` 是本专项 agent 角色入口；`agents/*.md` 负责定义不同角色的职责、必读上下文与启动提示词。
- 每个任务文档必须包含固定章节：任务元数据、任务目标、当前事实、In Scope、Out Of Scope、前置依赖、实施说明、交付物、验收边界、必备证据、失败/停止条件、回写位置。
- 自本专项进入执行态后，新建任务卡必须追加两类可直接转发内容：`执行 Agent 提示词` 与 `验收 Agent 提示词`；至少明确对应角色、必读上下文、输出格式与停止条件。
- 若增删任务文档、调整 phase、修改任务编号规则，必须同步更新本文件、上级 `docs/plans/AGENTS.md` 与相关 agent 活跃台账。

## 轻量闭环执行约定

- AI 在本专项中执行“发现问题 -> 修复问题 -> 记录问题 -> 验证问题”时，默认优先挂当前任务卡，不得先开新卡再判断。
- 没有问题归属，不进入修复；至少先判断是否在当前任务卡范围内、是否涉及合同变化、是否跨 owner。
- 当前任务卡 In Scope 已覆盖的问题，直接回写当前任务卡处理；只有当前卡无法独立关账时，才新增补充任务卡。
- 涉及合同变化时，先改对应真相源文档，再改实现；涉及专项边界、phase gate、风险或回滚口径变化时，先回写 `README.md`。
- 没有验证入口、验证结果与最小证据摘要，不得宣称问题已关闭。
- 当前任务卡至少应能看出：问题是什么、归属怎么判、修了什么、怎么验证、是否还有残余风险；这些信息不得只留在聊天历史里。
- 任务卡若未附对应提示词，视为“可读但不可直接派工”；进入执行阶段前应先补齐。
- `tasks/README.md` 只在新增补充任务卡、状态变化、依赖变化时更新；`AGENTS.md` 与活跃台账只在增删任务、调整 owner 责任或需要交接索引时更新。
- 超出专项冻结边界的问题必须停止当前实现并升级人工，不得擅自扩 scope。

## 真相源约定

- `FE-20260411-16` 是“同 URL 技术切换合同”的唯一真相源，负责定义 bootstrap、flag、fallback 与同 URL 下即时切回语义。
- `FE-20260411-22` 只负责基于 `FE-20260411-16` 定义灰度使用规则、判定责任人与记录口径，不得再新增第二套 bootstrap / flag / fallback 技术定义。
- 若同一问题已在某张任务卡被指定为真相源，其他任务卡只允许引用其结论、依赖其状态，不再平行扩写完整合同。

## 分支与版本管理约定

- 当前文档评审冻结版本使用分支 `liuhaitao-v1-review`；建议同时保留基线标签 `liuhaitao-v1-review-baseline`。
- 后续专项实操统一使用执行主线 `liuhaitao-v1-exec`，默认在该分支推进，不为日常小修滥开 topic 分支。
- 只有高风险试验、需要并行评审或明确隔离的独立改动，才临时创建短分支；完成后尽快合回 `liuhaitao-v1-exec`。
- 本专项优先用小粒度 commit 管理阶段动作，而不是依赖大量分支；推荐按“合同补洞 / 单个任务实现 / 单次验证补证”拆 commit。
- 推荐顺序固定为：先补文档与合同，再做实现，再补验证证据，最后合并回执行主线。
- 若实现过程中发现新的合同缺口：当前卡内可收口的，在当前执行分支先补文档再继续；跨任务或跨 owner 的，先补文档与依赖，再继续实现。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/README.md` | ProblemDetail 工程化打包 / 轻混淆 / Vue 统一专项唯一主记录 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/agents/README.md` | 本专项 agent 角色索引；定义推荐角色、适用范围与使用顺序 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/agents/architect-owner.md` | architect-owner 角色定义与启动提示词 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/agents/frontend-impl.md` | frontend-impl 角色定义与启动提示词 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/agents/backend-contract.md` | backend-contract 角色定义与启动提示词 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/agents/review-verifier.md` | review-verifier 角色定义与启动提示词 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/tasks/README.md` | 专项任务总索引；按 phase 汇总所有任务编号、交付物与验收边界入口 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/tasks/phase-0/` | Phase 0 任务文档：主记录建档、模板、索引与关账门 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/tasks/phase-1a/` | Phase 1A 任务文档：旧 `frontend` build / minify / 轻混淆合同 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/tasks/phase-1b/` | Phase 1B 任务文档：旧 `frontend` deploy / smoke / 运行时证据 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/tasks/phase-1c/` | Phase 1C 任务文档：A 线 Execution 执行落地、smoke 与 go/no-go |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/tasks/phase-2a/` | Phase 2A 任务文档：Vue 统一工程与 host / selector / command 合同 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/tasks/phase-2b/` | Phase 2B 任务文档：fixture、双渲染与对照检查 |
| `docs/plans/problem-detail-build-obfuscation-and-vue-unification/tasks/phase-3/` | Phase 3 任务文档：cutover readiness、切回与延期规则 |

**触发器**: 一旦本目录新增或删除任务文档、调整主记录职责边界、修改 phase 结构或变更任务模板，请立即重写本文件。
