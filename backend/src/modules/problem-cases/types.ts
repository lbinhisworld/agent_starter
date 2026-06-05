/**
 * [INPUT]: 无外部模块依赖
 * [OUTPUT]: ProblemCase / Message 领域类型与 Repository 契约
 * [POS]: problem-cases 模块类型定义
 *
 * [PROTOCOL]: 一旦本文件导出或契约变更，必须同步更新此 Header 和 docs/agents/backend-agent.md（含 ProblemCase 可选字段如 itDesignSupplementSessions、e2eTransactionFlowJson、e2eRequirementScenarioSupplementJson、objectStateMachineJson、coreBusinessObjectSystemPromptOverride、**designDetailRequirementSyncGen**（Task1 需求提炼轮次计数，一般不暴露给 PUT 契约）；**archiveNo** 为服务端按 owner 递增的档案编号，PUT 不可改；导出包可选 clientMeta、POST :id/restore 覆盖当前案例）；`GET …/design-detail/task-graph` 的 `DesignDetailTaskGraph*Dto` 含 **`pillBatchKey`**（`cr-*` 与 `DesignDetailTaskToken.requirementSyncGeneration` 对齐）、**`features[].themeKey`**（历史 `dd:` 主键由 `featureId` 解析；新 **`ft_`+12 位** 依绑定 token 的 `taskId`+`surfaceTokens`）、**`features[].valueRefDomain`**（任务 2 L1 **`value_ref_domain`**，非 N/A）、**任务 2** `links[]` 的 **`logic`/`weight`/`source`/`target`/`linkKind`/`validationConsistency`**（`source`/`target` 上可选 **`tokenDisplay`/`operator`**；`operator` 归一见 `design-detail-feature-operator.ts`）、**任务 2** `POST …/sync-task2-l1-target-kv-tokens`（及 `sync-task2-l1-inference-graph`）写入 **Feature_Key** token、**`DesignFeatureNode`** 及由 **`Evidence_Support_Chain`** 解析之 **`DesignLogicLink`**（跨任务 1 源 → 任务 2 目标）时须同步 `DesignDetailLogicModal.vue`、`design-detail-task-graph-catalog.ts`、`design-detail-task2-l1-target-kv-tokens.ts`、`design-detail-graph-ids.ts`、`prisma-problem-case.repository.ts` 与 `docs/agents/backend/01-context.md`
 */
/** GET `…/design-detail/task-graph`：单任务逻辑折叠卡片用（只读聚合） */
export type DesignDetailTaskGraphTokenDto = {
  tokenId: string;
  name: string;
  /** 逻辑弹层：与分域语义对齐（调试/兼容）；**pill 颜色以 `pillBatchKey` 为准** */
  themeKey: string;
  /**
   * 逻辑弹层 pill 颜色：**同一需求提炼轮次**同色，与业务分域无关。
   * `cb-0`＝工商向 token（`tokens` 路径非需求分域）；`cr-0`…`cr-7`＝需求提炼向 token 按 `requirementSyncGeneration`（`businessContext` 分域同步时递增案例计数）映射；未写轮次的旧行回退 `createdAt` 间隔启发式（至多 `cr-0`/`cr-1`）。**落库** `DesignDetailTaskToken.taskId` 任务 1 均为「任务 1：客户基本情况了解」。
   */
  pillBatchKey: string;
};
/** `name`：逻辑弹层 Feature 列展示文案，由 `DesignFeatureNode.value` 格式化；无法提炼时回退 token 路径（`surfaceTokens`） */
export type DesignDetailTaskGraphFeatureDto = {
  featureId: string;
  name: string;
  /** 与对应 Token 行同一 `themeKey`（历史 `dd:…:cr:{sectionKey}:` / `dd:…:cb:`；新主键 `ft_`+12 位时依绑定 token 的 `taskId` + `surfaceTokens` 推断） */
  themeKey: string;
  /** 与所绑定 `DesignDetailTaskToken` 行同一 `pillBatchKey` */
  pillBatchKey: string;
  /** `DesignFeatureNode` 列 **`TokenStr`**（Prisma：`surfaceTokens`）的展示串，与弹层 Token 列同拼接规则（` · `）；逻辑边 `links[].source`/`target` 子卡用 */
  tokenDisplay?: string;
  /** `DesignFeatureNode.operator`；逻辑边端点子卡用；下发前已归一为 **等于/不等于/小于/大于/小于等于/大于等于/包含/属于** 之一 */
  operator?: string;
  /** 任务 2 L1：`value` JSON 内 **value_ref_domain**（非 N/A 时）；逻辑弹层 Feature 卡「备注」行 */
  valueRefDomain?: string;
  /** 任务 2/3/4 Target_KV：`value` JSON 内 **inference_summary**（有值时）；Tree focus 悬停「推理结论」 */
  inferenceSummary?: string;
  /** 任务 1 L1 原始实然特征：`value` JSON 内 **Validation_Status**（如 `Pending` / `Resolved_By_Customer`） */
  validationStatus?: string;
  /** 任务 9/10 等：`value` JSON 内 **Tech_Host_Platform**（有值时）；逻辑树任务 10 按宿主平台分块 */
  techHostPlatform?: string;
  /** 任务 10：`value` JSON 内 **Induction_Type**（主表基准 / 主子级联纵向裂变 / 主表正向归纳派生） */
  inductionType?: string;
  /** 任务 10：`value` JSON 内 **Parent_Table_Ref** */
  parentTableRef?: string;
  /** 任务 10：`value` JSON 内 **Introduction_Reason** */
  introductionReason?: string;
  /** 任务 10：`value` JSON 内 **Reference_Field_Mapping** */
  referenceFieldMapping?: string;
  /** 任务 1 节点：是否确认痛点（历史痛点免疫） */
  painPointConfirmed?: boolean;
  /** 确认痛点的设计线步 id（如 `scale_org_mode_extract`） */
  painPointConfirmedByLineStepId?: string;
  /**
   * 原始 `DesignFeatureNode.value`（JSON）。
   * 任务 10 等需完整 `Feature_Value`（如 `字段集合`）的只读视图（数据架构 Tab）使用；`name` 仅为摘要。
   */
  featureValue?: unknown;
};
export type DesignDetailTaskGraphLinkDto = {
  linkId: string;
  name: string;
  /** `DesignLogicLink.linkKind`：与 MySQL ENUM 一致，仅 **`正向归纳`** / **`反向验证`**（**非**任务 1 端 → 任务 1 端为反向验证） */
  linkKind?: '正向归纳' | '反向验证';
  /** `DesignLogicLink.validationConsistency`：`Token_Validation_Mapping.Consistency`（Tree 边着色） */
  validationConsistency?: string;
  /** 与 `sourceFeatureId` 所属分域对齐（供任务 1 三 Tab 同色） */
  themeKey: string;
  /** 与 `sourceFeatureId` 所在特征行的父 token 同一 `pillBatchKey` */
  pillBatchKey: string;
  /** 逻辑边源特征 id（`DesignLogicLink.sourceFeatureId`） */
  sourceFeatureId?: string;
  /** 逻辑边目标特征 id */
  targetFeatureId?: string;
  /** 推导说明全文（任务 2 逻辑子卡；`name` 仍为截断预览） */
  logic?: string;
  /** 权重 [0,1]；无效或缺失时可不下发 */
  weight?: number | null;
  /** 源特征展示（与 `features[]` 口径一致） */
  source?: DesignDetailTaskGraphFeatureDto;
  /** 目标特征展示 */
  target?: DesignDetailTaskGraphFeatureDto;
};
export type DesignDetailTaskGraphTaskDto = {
  taskId: string;
  title: string;
  tokenCount: number;
  featureCount: number;
  linkCount: number;
  tokens: DesignDetailTaskGraphTokenDto[];
  features: DesignDetailTaskGraphFeatureDto[];
  links: DesignDetailTaskGraphLinkDto[];
};

export interface ProblemCase {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** owner 隔离：只来自登录 token（不信任前端） */
  ownerSubjectId?: string;
  ownerSubjectType?: 'user' | 'admin';
  ownerUsernameSnapshot?: string;
  /** 档案编号：服务端按 owner 递增分配，删除案例不回收 */
  archiveNo: number;
  customerName: string;
  customerNeedsOrChallenges: string;
  customerItStatus: string;
  projectTimeRequirement: string;
  requirementDetail?: unknown;
  requirementDetailHistory?: unknown;
  operationModel?: unknown;
  businessStatus?: unknown;
  urgencyAnalysis?: unknown;
  /** 深度提炼（V2）结构化初步需求，存于 basicInfo.__createContractExtras 往返 */
  preliminaryReq?: unknown;
  /** task1：工商已确认后等待用户在聊天区发送初步需求原文 */
  task1PendingPreliminaryRequirement?: boolean;
  /** task1 大模型调用快照（初步需求提炼等） */
  task1InitialLlmQuery?: unknown;
  currentMajorStage: number;
  currentItStrategySubstep: number;
  completedStages: number[];
  workflowAlignCompletedStages: number[];
  itGapCompletedStages: number[];
  completedTaskIds: string[];
  basicInfo?: unknown;
  bmc?: unknown;
  requirementLogic?: unknown;
  valueStream?: unknown;
  /** 端到端工作区提示是否已抑制 */
  e2eFlowWorkspaceSuppressed?: boolean;
  /** task7：历史全景观压缩 JSON */
  e2eFlowLandscapeJson?: unknown;
  /** task7：端到端业务事务流 BPM JSON */
  e2eTransactionFlowJson?: unknown;
  /** task7：初步需求 FVS 完整性补齐事务流 JSON */
  e2eRequirementScenarioSupplementJson?: unknown;
  globalItGapAnalysisJson?: unknown;
  /** task8：按事务 IT 设计补齐 + BPM 泳道进度 */
  itDesignSupplementSessions?: unknown;
  localItGapSessions?: unknown;
  localItGapAnalyses?: unknown;
  /** task9：流程、待办与决策中心门户设计（多角色 task_center） */
  roleTaskCenterPortalDesignJson?: unknown;
  /** task9：对象状态机构建 — 状态机 JSON（REA/BMC 导向） */
  objectStateMachineJson?: unknown;
  rolePermissionSessions?: unknown;
  coreBusinessObjectSessions?: unknown;
  /** task11：修改确认后的自定义 system 提示词（可选） */
  coreBusinessObjectSystemPromptOverride?: string;
}

export interface ProblemCaseMessage {
  id: string;
  caseId?: string;
  taskId?: string;
  taskName?: string;
  role?: 'user' | 'assistant' | 'system';
  type?: string;
  content: string;
  timestamp: string;
  confirmed?: boolean;
  payloadJson?: unknown;
  [key: string]: unknown;
}

export interface ProblemCaseTaskSummary {
  taskId: string;
  label: string;
  majorStage: number;
  status: 'pending' | 'current' | 'completed';
}

export interface ProblemCaseParsePreview {
  customerName: string;
  customerNeedsOrChallenges: string;
  customerItStatus: string;
  projectTimeRequirement: string;
}

/** 前端写入导出 JSON：用于详情页「恢复」时校验档案编号与客户名称（与 case.archiveNo 一致时可双因子校验） */
export interface ProblemCaseClientExportMetaV1 {
  displayArchiveNo: number;
  displayCustomerName: string;
}

/** v1 单案例 JSON 案例包（导出/导入共用结构） */
export interface ProblemCaseExportPackageV1 {
  schemaVersion: 1;
  exportedAt: string;
  case: ProblemCase;
  messages: ProblemCaseMessage[];
  /** 可选；由前端导出时注入，导入为新案例时忽略 */
  clientMeta?: ProblemCaseClientExportMetaV1;
}

export const PROBLEM_CASE_EXPORT_SCHEMA_VERSION = 1 as const;

/** 导入为新案例后的响应 */
export interface ProblemCaseImportResultV1 {
  caseId: string;
  importedMessageCount: number;
  schemaVersion: typeof PROBLEM_CASE_EXPORT_SCHEMA_VERSION;
}

export interface CreateProblemCaseInput extends ProblemCaseParsePreview {
  id?: string;
  ownerSubjectId?: string;
  ownerSubjectType?: 'user' | 'admin';
  ownerUsernameSnapshot?: string;
  requirementDetail?: unknown;
  requirementDetailHistory?: unknown;
  operationModel?: unknown;
  businessStatus?: unknown;
  urgencyAnalysis?: unknown;
  preliminaryReq?: unknown;
  task1PendingPreliminaryRequirement?: boolean;
  task1InitialLlmQuery?: unknown;
}

/** 更新接口不允许由前端改写 owner（由服务端 owner helper 统一注入/校验） */
export type UpdateProblemCaseInput = Partial<
  Omit<
    ProblemCase,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'ownerSubjectId'
    | 'ownerSubjectType'
    | 'ownerUsernameSnapshot'
    | 'archiveNo'
  >
>;

/** PATCH 单条消息时允许写入的字段（不含 id / caseId） */
export type ProblemCaseMessagePatch = Partial<
  Pick<
    ProblemCaseMessage,
    'content' | 'confirmed' | 'payloadJson' | 'timestamp' | 'taskId' | 'taskName' | 'type' | 'role'
  >
>;

export interface ProblemCaseRepository {
  list(): Promise<ProblemCase[]>;
  findById(id: string): Promise<ProblemCase | null>;
  create(input: CreateProblemCaseInput): Promise<ProblemCase>;
  update(id: string, updates: UpdateProblemCaseInput): Promise<ProblemCase | null>;
  delete(id: string): Promise<boolean>;
  getMessages(caseId: string): Promise<ProblemCaseMessage[]>;
  appendMessage(caseId: string, message: ProblemCaseMessage): Promise<ProblemCaseMessage>;
  replaceMessages(caseId: string, messages: ProblemCaseMessage[]): Promise<ProblemCaseMessage[]>;
  /** 单条增量更新（PATCH），用于避免整段 PUT 覆盖 */
  updateMessage(caseId: string, messageId: string, patch: ProblemCaseMessagePatch): Promise<ProblemCaseMessage | null>;
  deleteMessage(caseId: string, messageId: string): Promise<boolean>;
  /** 设计详情任务进展工作区 JSON；无行时返回 null */
  getDesignDetailProgressWorkspace(caseId: string): Promise<unknown | null>;
  upsertDesignDetailProgressWorkspace(caseId: string, payload: unknown): Promise<void>;
  deleteDesignDetailProgressWorkspace(caseId: string): Promise<void>;
  /**
   * Task1 客户基本信息提炼完成后：替换本案例任务 1 **工商**向 `DesignDetailTaskToken` / `DesignFeatureNode`（`taskId`=`DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID`；**不写**推导用 `DesignLogicLink`；删 token 级联删旧特征与相关边）
   */
  replaceDesignDetailTask1BasicInfoGraph(
    caseId: string,
    basicInfo: unknown,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }>;
  /** 任务 1 L1 原始实然特征集 `Target_KV`（行级 `Validation_Status` 写入 `DesignFeatureNode.value`） */
  replaceTask1L1OriginalFeatureMatrixGraph(
    caseId: string,
    syncRows: ReadonlyArray<{
      featureId: string;
      featureKey: string;
      operator: string;
      featureValue: string;
      valueRefDomain?: string;
      inferenceSummary?: string;
      validationStatus: string;
      tokenstr?: string;
    }>,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }>;
  /**
   * 任务 2 L1：将 `Target_KV` 各行写 `DesignDetailTaskToken`（`Feature_Key`；`taskId` = `DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID`，现用「任务 2：规模与组织模式推理」）并各写一条 `DesignFeatureNode`（`operator`/`value`）；对每行 **`Evidence_Support_Chain`** 写 **`DesignLogicLink`**；并对 **`Token_Validation_Mapping`** 写 **任务 2 L1 → 任务 1** 的 **`linkKind`＝「反向验证」** 边（`validationConsistency`）。
   */
  replaceTask2L1TargetKvFeatureKeyTokens(
    caseId: string,
    rows: ReadonlyArray<{
      featureKey: string;
      operator?: string;
      featureValue?: unknown;
      valueRefDomain?: string;
      inferenceSummary?: string;
      evidenceSource?: string;
      logicRule?: string;
      inferenceWeight?: number;
      /** 见 `design-detail-task2-l1-target-kv-tokens` 之 `Task2L1EvidenceLinkPlan` */
      evidenceLinks?: ReadonlyArray<{ sourceFeatureId: string; logic: string; weight: number }>;
    }>,
    tokenValidationPlans?: ReadonlyArray<{
      targetFeatureId: string;
      mappedL1FeatureKey: string;
      validationLogic: string;
      validationWeight: number;
      consistencyLabel: string;
    }>,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }>;
  /**
   * 任务 3 L2：将 **`L2_Business_Inference_Matrix` / `L2_Inference_Matrix`** 内 `Target_KV` 各行写 `DesignDetailTaskToken`（`taskId` = **`DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID`**）及特征、逻辑边；并对 **`Token_Validation_Mapping`** 写 **任务 3 L2 → 任务 1** 的 **`linkKind`＝「反向验证」** 边（`validationConsistency`；计划类型与任务 2 共用 `mappedL1FeatureKey` 字段存 **Mapped_L2_Feature** 归一键）。
   */
  replaceTask3L2TargetKvFeatureKeyTokens(
    caseId: string,
    rows: ReadonlyArray<{
      featureKey: string;
      operator?: string;
      featureValue?: unknown;
      valueRefDomain?: string;
      inferenceSummary?: string;
      evidenceSource?: string;
      logicRule?: string;
      inferenceWeight?: number;
      evidenceLinks?: ReadonlyArray<{ sourceFeatureId: string; logic: string; weight: number }>;
    }>,
    tokenValidationPlans?: ReadonlyArray<{
      targetFeatureId: string;
      mappedL1FeatureKey: string;
      validationLogic: string;
      validationWeight: number;
      consistencyLabel: string;
    }>,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }>;
  /**
   * 任务 4 L2：将 `L2_Value_Inference_Matrix.Target_KV` 各行写 `DesignDetailTaskToken`（`taskId` = **`DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID`**）及特征、逻辑边；并对 **`Token_Validation_Mapping`** 写 **任务 4 L2 → 任务 1** 的 **`linkKind`＝「反向验证」** 边。
   */
  replaceTask4L2TargetKvFeatureKeyTokens(
    caseId: string,
    rows: ReadonlyArray<{
      featureKey: string;
      operator?: string;
      featureValue?: unknown;
      valueRefDomain?: string;
      inferenceSummary?: string;
      evidenceSource?: string;
      logicRule?: string;
      inferenceWeight?: number;
      evidenceLinks?: ReadonlyArray<{ sourceFeatureId: string; logic: string; weight: number }>;
    }>,
    tokenValidationPlans?: ReadonlyArray<{
      targetFeatureId: string;
      mappedL1FeatureKey: string;
      validationLogic: string;
      validationWeight: number;
      consistencyLabel: string;
    }>,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }>;
  /** 任务 0：全量替换工具箱原语特征（服务端分配 `ft_` / `tk_task0_*`） */
  replaceTask0ToolboxPrimitiveFeatures(
    caseId: string,
    primitives: ReadonlyArray<{
      featureId?: string;
      featureKey: string;
      tokenDisplay: string;
      toolName: string;
      value: string;
      operator?: string;
    }>,
  ): Promise<{
    tokenCount: number;
    featureCount: number;
    linkCount: number;
    features: Array<{
      featureId: string;
      featureKey: string;
      tokenDisplay: string;
      toolName: string;
      value: string;
      operator: string;
    }>;
  }>;
  /** 任务 5 / 5.5 L3：写 `L3_Process_Inference_Matrix.Target_KV` 至对应推理图（`scope` 区分落库 taskId） */
  replaceTask5L3TargetKvFeatureKeyTokens(
    caseId: string,
    rows: ReadonlyArray<{
      featureKey: string;
      operator?: string;
      featureValue?: unknown;
      valueRefDomain?: string;
      inferenceSummary?: string;
      /** 任务 5.1：`causality_summary`（主张→能力单元正向边 logic） */
      causalitySummary?: string;
      evidenceSource?: string;
      logicRule?: string;
      /** 任务 9 二级菜单：`Belongs_To_Primary_Module` */
      belongsToPrimaryModule?: string;
      inferenceWeight?: number;
      evidenceLinks?: ReadonlyArray<{ sourceFeatureId: string; logic: string; weight: number }>;
    }>,
    tokenValidationPlans?: ReadonlyArray<{
      targetFeatureId: string;
      mappedL1FeatureKey: string;
      validationLogic: string;
      validationWeight: number;
      consistencyLabel: string;
    }>,
    scope?: {
      graphTaskId?: string;
      tokenDbTaskIds?: readonly string[];
    },
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }>;
  /**
   * Task1 客户需求提炼 JSON 某一顶层分域：**合并写入**同一 `taskId`（`DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID`；多轮补充追加，不先删整批分域行）。同 `tokens` 路径复用 `DesignDetailTaskToken`；同 `featureId` 更新 `DesignFeatureNode`；**当前不写**任务 1 分域 `DesignLogicLink`。分域归属：`customerRequirementTokenRowBelongsToSection`（兼容 `tokens[0]===sectionKey` 与单元素 `业务背景/`、`核心业务对象/`、`状态转移矩阵/`、`痛点雷达/`、`IT 集成与现状/` 及历史 `IT 现状与集成/`、`运营模式/`、`管理资源/` 路径）
   */
  replaceCustomerRequirementSectionGraph(
    caseId: string,
    sectionKey: string,
    sectionLabelZh: string,
    requirementParsed: unknown,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }>;
  /** 删除某案例、某设计任务线步下的 token（级联删 `DesignFeatureNode` 及关联 `DesignLogicLink`） */
  deleteDesignDetailTaskGraph(caseId: string, taskId: string): Promise<void>;
  /** 按案例聚合设计详情推理图（`DesignDetailTaskToken` / `DesignFeatureNode` / `DesignLogicLink`），供逻辑详情弹层只读展示 */
  getDesignDetailTaskGraphDetail(caseId: string): Promise<DesignDetailTaskGraphTaskDto[]>;
  /** 追加一条案例级 LLM 调用审计记录 */
  appendCaseLlmLog(caseId: string, row: CaseLlmLogAppendInput): Promise<void>;
  /** 列出某案例全部 LLM 日志（新在前），供详情页表格 */
  listCaseLlmLogsForCase(caseId: string): Promise<CaseLlmLogListRow[]>;
  /** 按 taskId 列表删除案例下 LLM 审计行（设计页「重启当前」与推理图清理对齐） */
  deleteCaseLlmLogsByTaskIds(caseId: string, taskIds: string[]): Promise<number>;
  /** 删除案例下全部 LLM 审计行（设计页「完全重启」） */
  deleteAllCaseLlmLogs(caseId: string): Promise<number>;
  /** 删除案例下全部设计详情推理图 token（级联特征与逻辑边；含需求提炼轮次计数归零） */
  deleteAllDesignDetailTaskGraph(caseId: string): Promise<void>;
  /** 按落库 `taskId` 列表删除推理修订审计行（设计页重启当前 / 选择重启） */
  deleteDesignDetailInferenceRevisionRecords(
    caseId: string,
    dbTaskIds: readonly string[],
  ): Promise<number>;
  /** 标记任务 1 特征节点为已确认痛点 */
  markDesignDetailTask1PainPointConfirmed(
    caseId: string,
    targetFeatureIds: readonly string[],
    lineStepId: string,
  ): Promise<number>;
  /** 对齐后：任务 1 特征 `value.Validation_Status` → `Resolved_By_Customer` */
  markDesignDetailTask1ValidationResolvedByCustomer(
    caseId: string,
    targetFeatureIds: readonly string[],
  ): Promise<number>;
  /** 按线步或全案重置任务 1 痛点确认 */
  resetDesignDetailTask1PainPointConfirmed(
    caseId: string,
    scope: { kind: 'all' } | { kind: 'line_steps'; lineStepIds: readonly string[] },
  ): Promise<number>;
  /**
   * 任务 2–5 每次 Target_KV sync 后：替换本案例该 `taskId` 下全部推理修订审计行（`syncSeq` 递增）。
   */
  replaceDesignDetailInferenceRevisionRecords(
    caseId: string,
    taskId: string,
    rows: ReadonlyArray<{
      recordKind: 'FEATURE_VALUE' | 'TOKEN_VALIDATION' | 'DIAGNOSTIC_PAIN_POINT';
      featureId: string;
      fieldLabel?: string;
      valueBefore?: string;
      valueAfter?: string;
      validationLogic?: string;
      logicGapReport?: string;
      insightResolutionSummary?: string;
      alignmentQuestionnaire?: string;
      alignmentUserReply?: string;
      conflictDescription?: string;
      insightConfirmation?: string;
      rootCauseAnalysis?: string;
      designConstraint?: string;
    }>,
  ): Promise<{ syncSeq: number; recordCount: number }>;
}

/** POST `/api/problem-cases/:id/llm-logs` 与 AI 代理落库共用 */
export type CaseLlmLogAppendInput = {
  taskId: string;
  callTarget: string;
  inputPrompt: string;
  inputTokens?: number | null;
  outputContent: string;
  outputTokens?: number | null;
  durationMs: number;
  model?: string | null;
};

/** GET 列表行（不含全文 prompt/output，减轻带宽） */
export type CaseLlmLogListRow = {
  id: string;
  caseId: string;
  taskId: string;
  callTarget: string;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
  createdAt: string;
};

export interface ProblemCaseParser {
  parse(input: string): Promise<ProblemCaseParsePreview>;
}
