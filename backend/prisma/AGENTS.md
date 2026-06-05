# Folder: backend/prisma

## 地位

后端 Prisma 数据模型与迁移定义目录，是 `AppUser` / AI 配置 / 业务对象持久化结构的唯一 schema 入口。

## 职责

1. 维护 `schema.prisma` 中的数据库模型、关系与字段契约。
2. 维护 `migrations/` 中与 schema 对齐的可追溯变更脚本。
3. 为后端服务层提供稳定的数据结构真相源。

## 约束

- 每次修改 `schema.prisma` 后，必须同步补齐对应 migration，并保证 `prisma generate` / `npm run build` 可通过。
- **本地 `npm run dev`**：已通过 `predev` 在启动前执行 `prisma generate`，避免 schema 已增字段而运行时 Client 未刷新时出现 `Unknown argument designDetailRequirementSyncGen` 等校验错误；**数据库**仍须 `prisma migrate deploy`（或联调脚本中的 DB 同步）使表结构与 migration 一致。
- 涉及敏感信息（如用户 AI Key）时，schema 只能存密文或等价安全载体，不得设计为明文字段。
- 若调整关系或公开接口依赖的字段语义，必须同步更新相关模块文档与契约说明。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `backend/prisma/schema.prisma` | Prisma 数据模型定义；设计详情三表 **`DesignDetailTaskToken` / `DesignFeatureNode` / `DesignLogicLink`**（**`DesignLogicLink.linkKind`** MySQL ENUM **「正向归纳」/「反向验证」** 与 Prisma `@map`；**`validationConsistency`**）字段注释与 **`tk_`/`ft_`/`lk_`** 新主键形态对齐（分配逻辑在 **`backend/src/modules/problem-cases/design-detail-graph-ids.ts`**，非本目录） |
| `backend/prisma/migrations/` | 按时间序列保存的数据库迁移脚本（含案例级 LLM 审计 `ProblemCaseLlmLog` `20260507120000_add_problem_case_llm_log`；设计详情推理修订审计 `DesignDetailInferenceRevisionRecord` `20260519120000_add_design_detail_inference_revision_record`、修订表对齐问卷/用户回复列 `20260519140000_add_inference_revision_alignment_fields`、修订表 Diagnostic_Pain_Points 四列与 `recordKind` 诊断痛点 `20260519160000_add_inference_revision_diagnostic_pain_point_fields`；task8 `itDesignSupplementSessions` 列 `20260408120000_add_it_design_supplement_sessions`；档案编号 `20260409120000_add_problem_case_archive_no`；task7 端到端 JSON `20260412130000_add_problem_case_e2e_json_columns`；工具经验知识树 `20260413180000_add_tool_experience_knowledge_tree`；工具经验对话区 `20260413190000_add_tool_experience_chat_state`；历史曾含设计详情任务推理表 `20260430120000_add_design_detail_task_reasoning`（已由 `20260507180000_drop_design_detail_task_reasoning` 删除表）；设计详情任务进展工作区 `20260506120000_add_design_detail_progress_workspace`；设计详情任务关键词多形态表 `20260508120000_add_design_detail_task_tokens`；设计详情特征取值节点 `20260508140000_add_design_feature_node`；设计详情特征间逻辑边 `20260509120000_add_design_logic_link`；`DesignFeatureNode` 主键改为 `featureId` 并为 `DesignLogicLink` 增加外键 `20260509140000_design_feature_node_pk_feature_id`；`DesignFeatureNode` 冗余列先 `tokens` 后更名为 `TokenStr` `20260510120000_add_design_feature_node_tokens` / `20260510140000_rename_design_feature_node_tokens_to_tokenstr`；Task1 需求提炼轮次计数与 token 列 `20260511100000_add_requirement_sync_generation`；**`DesignLogicLink.linkKind`** `20260514190000_add_design_logic_link_kind`；**`DesignLogicLink.validationConsistency`** `20260515120000_add_design_logic_link_validation_consistency`；**`linkKind` ENUM 中文取值** `20260516120000_design_logic_link_kind_zh_enum`） |
| `backend/prisma/migrations/migration_lock.toml` | Prisma migration lock 文件 |

**触发器**: 一旦本文件夹增删文件或架构逻辑调整，请立即重写此文档。
