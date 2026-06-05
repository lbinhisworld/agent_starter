# Backend Agent · 背景与上下文

> 相对稳定的全局背景与边界；任务状态以 `03-active-tasks.md` 为准。

## 1. 项目背景

- 阶段目标：优先保障 `ProblemDetail` 主链路。
- 后端方向：从「存储 + 代理」演进为「规则入口 + 动作裁决」能力，而非仅补 CRUD。
- 当前已有模块：`auth`、`ai`、`problem-cases`；动作接口与消息模型曾不完整，需按阶段补齐。

## 2. 本周 / 阶段目标（摘要）

- `ProblemCaseMessage` 作为消息时间线主来源（与前端协同）。
- task7 端到端 BPM / FVS 补齐：`ProblemCase` 表 `e2eTransactionFlowJson`、`e2eRequirementScenarioSupplementJson`、`e2eFlowLandscapeJson`（及既有 `e2eFlowWorkspaceSuppressed`）经 `PUT` / 导入恢复落库；迁移 `20260412130000_add_problem_case_e2e_json_columns`。
- 提供消息追加与最小任务动作接口；统一详情读取结构。
- 设计详情 Task1：`POST /api/problem-cases/:id/design-detail/sync-task1-basic-info-graph` 将经营信息提炼 JSON 同步为 **`DesignDetailTaskToken.taskId` =「任务 1：客户基本情况了解」** 的 `DesignDetailTaskToken` / `DesignFeatureNode`（**不写**任务 1 推导用 `DesignLogicLink`；空值不写特征行；`design-detail-task1-basic-graph.ts`；**工商字段** `DesignDetailTaskToken.tokens` 为 **单元素中文标题**（`FIELD_LABEL_ZH`），**不**再写入英文 snake_case；取值只在 `DesignFeatureNode.value`；`DesignFeatureNode.surfaceTokens`（DB 列 `TokenStr`）与 token 行 `tokens` 一致）；`POST …/design-detail/sync-customer-req-section-graph` 将客户需求提炼 JSON 的某一顶层分域同步为 **`DesignDetailTaskToken.taskId` =「任务 1：客户基本情况了解」** 的 token / 特征（**不写**段内 `DesignLogicLink`；`design-detail-customer-req-section-graph.ts`：`businessContext` 下 `tokens` **仅单元素** `["业务背景/现状与核心矛盾"]` 等二级中文路径；`coreBusinessEntities` 为数组时 **仅单元素** `["核心业务对象/事/客户所有权"]` 等三级中文路径，整段实体入 `value`；`stateTransitionMatrix` / `painPointRadar` 为 **仅单元素** `["状态转移矩阵/…"]`、`["痛点雷达/…"]`（`stateTransitionMatrix`：**同一 `entity` 仅一条 token**，多行转移合并入 `value`；第二段为实体展示名；**不**生成 `（1）` 等后缀；`painPointRadar` 第二段为痛点维度名等）；`itLandscape` 为 **至多三条固定** `["IT 集成与现状/现有系统"]`、`["IT 集成与现状/待集成系统"]`、`["IT 集成与现状/部署形态"]`，各子块列表/部署文案入 `value`；`operationModel` 为 `["运营模式/人员组织/{角色标题}"]`、`["运营模式/业务流程/{流程名}"]`（同角色/流程合并）；`managementResources` 为 `["管理资源/人力资源"]` 等四键之一；**多轮需求提炼**时 `replaceCustomerRequirementSectionGraph` **合并追加**：同分域下同 `tokens` 路径（`customerRequirementTokenSurfacesKey`）复用既有 `DesignDetailTaskToken`，不整批删旧行；同 `featureId` 则 `UPDATE` `DesignFeatureNode`；分域归属仍见 `customerRequirementTokenRowBelongsToSection`（含历史 `IT 现状与集成/`）；tokens 不含子字段取值）；`GET …/design-detail/task-graph` 中 **`tasks[].features[].name` 为 `DesignFeatureNode.value` 的可读摘要**（`prisma-problem-case.repository.ts` 内格式化），无法提炼时回退 **`surfaceTokens` 路径**；`tasks[].tokens[]` / `features[]` / `links[]` 含 **`themeKey`**（工商 `customer_basic` 与需求分域键）与 **`pillBatchKey`**（工商 `cb-0`；需求向 token 优先按 `DesignDetailTaskToken.requirementSyncGeneration` 与案例 `designDetailRequirementSyncGen` 对齐为多档 `cr-*`，旧行未写轮次时回退 `createdAt` 间隔启发式），供逻辑弹层任务 1 三 Tab **按批次同色 pill**；`GET` 聚合任务 id 仍为 `customer_basic`；**任务 2**（`scale_org_mode_extract`）：`POST …/design-detail/sync-task2-l1-target-kv-tokens`（及同逻辑 `sync-task2-l1-inference-graph`）将 L1 `Target_KV` 各行写 **`DesignDetailTaskToken`** + **`DesignFeatureNode`**（`taskId`=`scale_org_mode_extract`）；写 **`DesignDetailTaskToken` + `DesignFeatureNode`**，并按 **`Evidence_Support_Chain`** 写跨任务 **`DesignLogicLink`**（源 `featureId` 须已存在于本案例特征表），**及按 `Token_Validation_Mapping` 写任务 2→任务 1 的「反向验证」边**（`validationConsistency` 列见迁移 **`20260515120000_add_design_logic_link_validation_consistency`**）；`GET …/design-detail/task-graph` 仍可按库返回任务 2 图（**含历史**旧版全链路 `links[]`：每条仍含 **`sourceFeatureId`/`targetFeatureId`、完整 `logic`、`weight`（[0,1]）及 `source`/`target`**，端点 **`tokenDisplay`/`operator`** 规则同上；未命中时占位）；逻辑弹层对任务 1 卡片 **不展示**逻辑链（见 `DesignDetailLogicModal.vue`）；`DELETE …/design-detail/task-graph/:taskId`：`DELETE …/customer_basic` 仅删**工商**向 token（`tokens` 非需求分域路径）；`DELETE …/customer_requirement` 删**需求**向 token 并重置 `designDetailRequirementSyncGen`（级联特征与边）。
- 设计详情推理图主键（新写入）：`DesignDetailTaskToken.tokenId` 为 `tk_{asciiTask}_{caseCompact}_{6位}`；`DesignFeatureNode.featureId` 为 `ft_`+12 位十进制全局序号；`DesignLogicLink.linkId` 为 `lk_`+12 位；**`DesignLogicLink.linkKind`**（MySQL ENUM，仅 **「正向归纳」** / **「反向验证」**；`GET …/design-detail/task-graph` 下发同；Prisma 代码侧成员名 `FORWARD_INDUCTION` / `REVERSE_VALIDATION` 经 `@map` 对齐 DB；非任务 1 端 → 任务 1 端为「反向验证」，推断见 `design-detail-logic-link-kind.ts`）（分配逻辑见 `backend/src/modules/problem-cases/design-detail-graph-ids.ts`）；与历史 **cuid** / **`dd:…`** 主键共存，`GET …/design-detail/task-graph` 仍兼容旧形态。
- **Task1 工商 `tokens` 仍见英文排查**：后端 `npm run dev` 控制台过滤 **`[problem-case:task1-basic-graph]`**（`syncDesignDetailTask1BasicInfoGraph ingress` → `buildTask1BasicGraphPlan` 各行 `tokenSurfaces` → `replaceDesignDetailTask1BasicInfoGraph tx` 的 `insertTokensPreview`）。若日志已为单元素中文而库里仍 `["中文","snake_case"]`，多为历史行、未触发同步或请求未打到当前进程。
- 设计详情 `DesignFeatureNode.operator`：规范取值为 **等于、不等于、小于、大于、小于等于、大于等于、包含、属于**（`backend/src/modules/problem-cases/design-detail-feature-operator.ts` 的 `normalizeDesignDetailFeatureOperator`）；写库与 `GET …/design-detail/task-graph` 链路端点子卡均归一；兼容历史 `eq`、`!=`、`=`、`CONTAINS` 等别名。
- **任务 2 L1**：**`DesignDetailTaskToken.taskId`** 落库为 **「任务 2：规模与组织模式推理」**（历史行可能仍为 `scale_org_mode_extract` 或更名前中文「任务 2：行业与业务属性推理」，读/删双兼容）；`Target_KV` 落库的 `DesignFeatureNode.value` 可为 `{ Feature_Value, value_ref_domain }`（**N/A** 不写 `value_ref_domain`）；`GET …/design-detail/task-graph` 的 **`features[].valueRefDomain`** 供逻辑弹层 Feature 卡「备注」行；**`DesignDetailTaskToken.tokens`** / **`TokenStr`** 对 `Feature_Key` 取 **`·` 前中文**（单元素，与工商 token 展示口径一致）；`POST …/sync-task2-l1-target-kv-tokens`（及别名）在写入 **`DesignDetailTaskToken` + `DesignFeatureNode`** 后，按 **`Evidence_Support_Chain`** 写 **`DesignLogicLink`**（含 **`linkKind`**：非任务 1→任务 1 为 **「反向验证」**）；`sourceFeatureId`＝链上 **`SourceFeature.FeatureID`**，**须与任务 2 输入 TSV 第一列逐字一致**，且等于本案例已存在特征之 **`DesignFeatureNode.featureId`**——与 **`GET …/design-detail/task-graph`** 下发之 **`features[].featureId`** 同源，兼容历史 **`dd:`** / **`cuid`** 与新版 **`ft_`+12 位**，**禁止**编造占位 id；`targetFeatureId`＝本行新插入之任务 2 特征；`logic`/`weight`＝链上 **`logic`**/**`contribution`**；未知源则跳过）；**另**按 **`Token_Validation_Mapping`** 追加 **`linkKind`＝「反向验证」** 边（源=任务 2 L1 新特征，由 **`Mapped_L1_Feature`** 与当次 **`Target_KV.Feature_Key`** 对齐；目标=任务 1 **`Target_FeatureID`**；`logic`/`weight`/`validationConsistency` 分别取自 **`Validation_Logic`**/**`Validation_Weight`**/**`Consistency`**；Prisma 列见迁移 **`20260515120000_add_design_logic_link_validation_consistency`**）；`GET` 聚合 **`links[]`**；响应体 **`linkCount`** 为本次新建逻辑边条数；排查见控制台 **`[problem-case:task2-l1-target-kv]`**（解析后每行 `evidenceLinkPlanCount`、落库后 `linkCount`）与 **`[problem-case:task2-l1-graph]`**（链形态异常、`replace_task2_l1_tx_summary`、逐条 `skip_logic_link_unknown_source`）。
- **任务 2 L1 模型扩展 JSON**：**`Diagnostic_Pain_Points`**、**`Extended_Features`**、**`Token_Validation_Mapping.interview_question`**、**`Causality_Analysis`**（**`Logic_Gap_Report`**、**`Insight_Resolution_Summary`**）与 user **第 5 段深访** 对齐产品提示词；**不单独落表**，持久化仍以 **Target_KV** + **Evidence_Support_Chain** + **Token_Validation_Mapping**（反向边）为准。
- **任务 3 L2**：**`DesignDetailTaskToken.taskId`** 落库为 **「任务 3：行业与业务属性推理」**（与线步 **`industry_business_profile_extract`** 读/删双兼容，见 `design-detail-task-graph-catalog.ts`）；**`L2_Business_Inference_Matrix`**（兼容 **`L2_Inference_Matrix`**）**`.Target_KV`** 解析与落库口径同任务 2 L1；**`Token_Validation_Mapping`**（**`Mapped_L2_Feature`** 对齐本批 `Target_KV.Feature_Key`）经 **`parseTokenValidationMappingFromL2InferenceRaw`** 写 **任务 3 L2 → 任务 1** 的 **`DesignLogicLink`**（**`linkKind`＝「反向验证」**、`validationConsistency`；**`Consistency`** 可为「逻辑一致」「已通过洞察修正」「潜在冲突」）；**`POST …/sync-task3-l2-target-kv-tokens`**（body `l2InferenceRaw`）经 `parseTask3L2TargetKvSyncRows` 写 **`replaceTask3L2TargetKvFeatureKeyTokens`**；**`Diagnostic_Pain_Points` / `Extended_Features`** 等扩展字段当前**不落库**，仅保留模型完整 JSON 供审计；排查 **`[problem-case:task3-l2-target-kv]`** / **`[problem-case:task3-l2-graph]`**；`GET …/task-graph` 任务卡 **`taskId`** 仍为线步 **`industry_business_profile_extract`**；token 行 **`pillBatchKey`** 为 **`t3l2-0`**（与任务 2 之 `t2l1-0` 对称）。
- **任务 4 L2**：**`DesignDetailTaskToken.taskId`** 新写入为 **「任务 4：价值链分析推理」**（历史行可能仍为 **`任务 4：核心价值驱动推理`** 或线步 **`core_value_driver_inference`**，读/删双兼容，见 `design-detail-task-graph-catalog.ts`）；`L2_Value_Inference_Matrix.Target_KV` 经 `parseTask4L2TargetKvSyncRows` 写 **`replaceTask4L2TargetKvFeatureKeyTokens`**；**`L2_Value_Inference_Matrix.Token_Validation_Mapping`**（**`Mapped_L2_Feature`** 对齐本批四键）经 **`parseTokenValidationMappingFromL2ValueInferenceRaw`** 写 **任务 4 L2 → 任务 1**「反向验证」边；**`POST …/sync-task4-l2-target-kv-tokens`**（body `l2ValueInferenceRaw` 或根对象矩阵，见 `coerceHttpBodyToL2ValueInferenceRawString`）；排查 **`[problem-case:task4-l2-target-kv]`**（含 **`token_validation_parse`**）/ **`[problem-case:task4-l2-graph]`**；`GET …/task-graph` 任务卡 **`taskId`** 为线步 **`core_value_driver_inference`**；**`tasks[].title`** 由 **`getDesignDetailTaskGraphCardTitle`** 给出；token 行 **`pillBatchKey`** 为 **`t4l2-0`**。
- 鉴权与测试基线（`npm test` / `npm run build`）保持可信。
- Prisma（`@prisma/adapter-mariadb`）：`createPrismaClient` 为连接配置 `timezone`（默认 `+08:00`），连接器在每条连接上 `SET time_zone`，使写入的 `DateTime` 默认值与东八区 wall clock 对齐；可选环境变量 `DATABASE_SESSION_TIMEZONE` 覆盖（见 `backend/src/lib/prisma.ts`）。

## 3. 冻结边界

### 后端负责

- 鉴权、`case` 当前状态、`task summaries`、`message timeline`。
- `task start / confirm / revise / rollback`。
- AI 调用入口与基础可观测性。

### 后端暂不做（阶段内）

- 全量 `company analyses` 后端化、`tools` 全量后端化、完整审计系统。

### 兼容策略

- 保留旧 `PUT /messages` 作兼容，但不再作为主路径；鼓励前端逐步改用 PATCH/追加语义（以契约为准）。

## 4. 任务清单（按优先级摘要）

详细 P0/P1/P2 与接口列表见 **`02-playbooks.md`**。

## 5. 需要前端配合的内容

- 是否仍依赖旧 `PUT /messages` 主路径。
- 哪些字段必须兼容当前 UI。
- 详情页首次加载需要的聚合结果。
