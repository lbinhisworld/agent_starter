/**
 * [INPUT]: 依赖 problem-cases/types、repository、parser、Zod
 * [OUTPUT]: ProblemCase CRUD、消息时间线、任务动作（含 rollback：截断目标 task 及之后消息并同步案例字段）、解析预览、单案例 JSON 导入导出（导入/恢复须合并 `preliminaryReq` 等 CreateContractExtras，避免 __createContractExtras 被覆盖丢失 V2 初步需求；导出下载文件名：`buildProblemCaseExportDownloadBasename`）、即时聚合 `getReport`（售前分析报告 DTO）；GET /api/problem-cases 列表：admin 额外返回 createdBy；设计详情任务进展工作区 `DesignDetailProgressWorkspace` GET/PUT/DELETE；设计详情推理图只读聚合 `GET …/design-detail/task-graph`；`DELETE …/design-detail/task-graph` 清空本案例全部推理图；设计详情 Task1 客户基本信息图 `POST …/design-detail/sync-task1-basic-info-graph`；Task1 客户需求提炼分域图 `POST …/design-detail/sync-customer-req-section-graph`；任务 2 L1 `Target_KV` 的 Feature_Key 写入 `DesignDetailTaskToken`：`POST …/design-detail/sync-task2-l1-target-kv-tokens`；案例级 LLM 审计 `GET/POST …/:id/llm-logs` 与 `recordCaseLlmFromAiChat`（供 `/api/ai/chat` 成功路径落库）；**`POST …/:id/llm-logs/clear`** 支持 `{ taskIds }` 或 **`{ all: true }`** 清空本案例全部审计
 * [POS]: ProblemDetail 业务裁决核心服务层
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新此 Header 和所属目录的 AGENTS.md
 * FE-20260415：POST 单条追加 `createMessageSchema` 对可选字段允许 `null`，与 PATCH 及前端 `toMessagePayload` 展开消息形状一致，避免 Zod 400。
 * FE-20260507：`clearCaseLlmLogsForTasks` 成功后打 `console.info('[problem-case:llm-logs-clear]', …)`，与前端 `[design-detail:restart-llm-clear]` 对账。
 * FE-20260508-t2l1-peel：`sync-task2-l1-target-kv-tokens` 请求体 `l1InferenceRaw` 支持 object（预处理为 JSON 字符串）；解析失败或 Zod 失败时 `console.warn('[problem-case:task2-l1-target-kv]', …)`。
 * FE-20260508-t2l1-inference-api：`POST …/sync-task2-l1-inference-graph` 与 target-kv-tokens 同落库；`coerceHttpBodyToL1InferenceRawString` 支持根对象即 `L1_Inference_Matrix`；失败时对客户端统一 `Target_KV 为空或无法解析`，细节打 `[problem-case:task2-l1-inference-graph]`。
 * Task1 工商图同步：`syncDesignDetailTask1BasicInfoGraph` 入口打 `[problem-case:task1-basic-graph] syncDesignDetailTask1BasicInfoGraph ingress`（basicInfo 顶层键样本）。
 */
import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { JwtAuthPayload } from '../auth/auth.service';
import {
  CaseLlmLogAppendInput,
  CaseLlmLogListRow,
  CreateProblemCaseInput,
  ProblemCase,
  ProblemCaseExportPackageV1,
  ProblemCaseImportResultV1,
  ProblemCaseMessage,
  ProblemCaseMessagePatch,
  ProblemCaseParser,
  ProblemCaseParsePreview,
  ProblemCaseRepository,
  ProblemCaseTaskSummary,
  type DesignDetailTaskGraphTaskDto,
  PROBLEM_CASE_EXPORT_SCHEMA_VERSION,
  UpdateProblemCaseInput,
} from './types';
import { buildRollbackCasePatch, filterMessagesAfterRollback, FRONTEND_TASK_ORDER, pathTaskIdToFrontendTaskId } from './problem-case-rollback';
import { buildProblemCaseReportDto, ProblemCaseReportDto } from './problem-case-report.aggregator';
import { DESIGN_CUSTOMER_REQ_GRAPH_SECTIONS, isAllowedCustomerReqSectionKey } from './design-detail-customer-req-section-graph';
import {
  coerceHttpBodyToL1OriginalFeatureRawString,
  normalizeL1OriginalFeatureInferenceRawForServerSync,
  parseTask1L1OriginalFeatureTargetKvSyncRows,
} from './design-detail-task1-l1-original-feature';
import {
  coerceHttpBodyToL1InferenceRawString,
  coerceHttpBodyToL2ValueInferenceRawString,
  parseTask2L1TargetKvSyncRows,
  parseTask3L2TargetKvSyncRows,
  normalizeL2BusinessInferenceRawForServerSync,
  normalizeL2ValueInferenceRawForServerSync,
  parseTask4L2TargetKvSyncRows,
  parseTokenValidationMappingFromL1Raw,
  parseTokenValidationMappingFromL2InferenceRaw,
  parseTokenValidationMappingFromL2ValueInferenceRaw,
  isTask5L3TargetKvSyncableFeatureKey,
  parseTask5L3MacroTargetKvSyncRows,
  parseTask5L3TargetKvSyncRows,
  parseTask5L5VsmTargetKvSyncRows,
  parseTask51L3TargetKvSyncRows,
  parseTask52L3TargetKvSyncRows,
  parseTask53L3TargetKvSyncRows,
  parseTokenValidationMappingFromL52AssetMappingRaw,
  parseTokenValidationMappingFromL53WorkflowFlowRaw,
  normalizeL52AssetMappingRawForServerSync,
  normalizeL53WorkflowFlowRawForServerSync,
  normalizeTask52L3MappedFeatureKey,
  normalizeTask53L3MappedFeatureKey,
  parseTokenValidationMappingFromL51ValuePropositionRaw,
  normalizeL51ValuePropositionRawForServerSync,
  isTask51L3TargetKvSyncableFeatureKey,
  parseTask6L3ScenarioTargetKvSyncRows,
  parseTask65L3ItGapTargetKvSyncRows,
  expandTask65L3TokenValidationPlans,
  expandTask7L4TokenValidationPlans,
  normalizeTask65L3MappedFeatureKey,
  parseTask7L4CollaborationTargetKvSyncRows,
  parseTask8L45PrototypeTargetKvSyncRows,
  parseTokenValidationMappingFromL8PrototypeInferenceRaw,
  isTask8L45PrototypeFeatureKey,
  parseTask85L475PhysicalHookTargetKvSyncRows,
  parseTokenValidationMappingFromL85PhysicalHookInferenceRaw,
  parseTask9L5BlueprintTargetKvSyncRows,
  parseTokenValidationMappingFromL9BlueprintInferenceRaw,
  parseTask10L5TechnicalDdlTargetKvSyncRows,
  isTask5L3MacroFeatureKey,
  isTask5L5VsmStageFeatureKey,
  isTask6L3ScenarioFeatureKey,
  isTask7L4CollaborationFeatureKey,
  isTask85L475PhysicalHookFeatureKey,
  isTask9L5BlueprintFeatureKey,
  isTask10L5TechnicalDdlFeatureKey,
  parseTokenValidationMappingFromL35VsmInferenceRaw,
  parseTokenValidationMappingFromL3ProcessInferenceRaw,
  parseTokenValidationMappingFromL6ScenarioInferenceRaw,
  parseTokenValidationMappingFromL7CollaborationInferenceRaw,
  normalizeL3ProcessInferenceRawForServerSync,
  normalizeL3Vsm55InferenceRawForServerSync,
  normalizeL6ScenarioInferenceRawForServerSync,
  normalizeL65ItGapInferenceRawForServerSync,
  parseTokenValidationMappingFromL65ItGapInferenceRaw,
  normalizeL4CollaborationInferenceRawForServerSync,
  normalizeL4PrototypeInferenceRawForServerSync,
  normalizeL475PhysicalHookInferenceRawForServerSync,
  normalizeL5BlueprintInferenceRawForServerSync,
  normalizeL5TechnicalDdlInferenceRawForServerSync,
  coerceHttpBodyToL3ProcessInferenceRawString,
  buildTask85PhysicalHookParseFailureDiagnostics,
  parseCausalityAnalysisFromInferenceRaw,
  parseDiagnosticPainPointsFromInferenceRaw,
  type InferenceCausalityMatrixKind,
} from './design-detail-task2-l1-target-kv-tokens';
import {
  buildTask1PainPointConfirmedIndex,
  mergeTokenValidationPlansWithPainPointConfirmedImmunity,
  resolveLineStepIdsForPainPointReset,
} from './design-detail-pain-point-confirmed';
import {
  buildTask2Task3UpstreamConsistencyForTask4Immunity,
  buildTask2UpstreamConsistencyForTask3Immunity,
  mergeTokenValidationPlansWithUpstreamImmunity,
} from './design-detail-upstream-validation-immunity';
import type { Task2L1TokenValidationLinkPlan } from './design-detail-task2-l1-target-kv-tokens';
import {
  designDetailInferenceRevisionDbTaskIdsForLineStep,
  designDetailInferenceRevisionDbTaskIdsFromLineStepInclusive,
} from './design-detail-task-graph-catalog';
import {
  buildDesignDetailInferenceRevisionRows,
  pickGraphFeaturesForTaskIds,
} from './design-detail-inference-revision';
import {
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK2_L1_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK3_L2_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK5_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK51_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK52_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK53_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK55_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK6_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK65_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK7_L4_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK8_L45_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK85_L475_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK9_L5_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK10_L5_TOKEN_DB_TASK_IDS,
} from './design-detail-task-graph-catalog';
import type { DesignDetailTaskGraphFeatureDto } from './types';

/** 任务 2 L1 推理图同步接口（`sync-task2-l1-inference-graph`）对用户可见的归一错误文案 */
const TASK2_L1_INFERENCE_GRAPH_BAD_MESSAGE = 'Target_KV 为空或无法解析';

const parsePreviewInputSchema = z.object({
  input: z.string().trim().min(1, '请输入数字化问题描述'),
});

const createProblemCaseSchema = z.object({
  id: z.string().trim().optional(),
  customerName: z.string().trim().min(1, '客户名称不能为空'),
  customerNeedsOrChallenges: z.string().trim().default(''),
  customerItStatus: z.string().trim().default(''),
  projectTimeRequirement: z.string().trim().default(''),
  requirementDetail: z.unknown().optional(),
  requirementDetailHistory: z.unknown().optional(),
  operationModel: z.unknown().optional(),
  businessStatus: z.unknown().optional(),
  urgencyAnalysis: z.unknown().optional(),
  preliminaryReq: z.unknown().optional(),
  task1PendingPreliminaryRequirement: z.boolean().optional(),
  task1InitialLlmQuery: z.unknown().optional(),
});

/** 与前端默认占位 system 提示一致：用于拦截「非空历史被整段替换为单条占位」的危险 PUT */
const DEFAULT_PLACEHOLDER_MESSAGE_TEXT = '请输入客户基本信息';

const syncMessagesSchema = z.object({
  items: z.array(z.object({
    id: z.string().trim().min(1),
    taskId: z.string().trim().nullable().optional(),
    taskName: z.string().trim().nullable().optional(),
    role: z.enum(['user', 'assistant', 'system']).nullable().optional(),
    type: z.string().trim().nullable().optional(),
    content: z.string(),
    timestamp: z.string().datetime(),
    confirmed: z.boolean().optional(),
  }).passthrough()),
});

const patchMessageSchema = z
  .object({
    content: z.string().optional(),
    confirmed: z.boolean().optional(),
    payloadJson: z.unknown().optional(),
    timestamp: z.string().datetime().optional(),
    taskId: z.union([z.string().trim(), z.null()]).optional(),
    taskName: z.union([z.string().trim(), z.null()]).optional(),
    type: z.union([z.string().trim(), z.null()]).optional(),
    role: z.enum(['user', 'assistant', 'system']).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: '至少需要提供一个可更新字段' });

function isDangerousDefaultPlaceholderReplace(
  items: z.infer<typeof syncMessagesSchema>['items'],
): boolean {
  if (items.length !== 1) return false;
  const m = items[0];
  const content = typeof m.content === 'string' ? m.content.trim() : '';
  if (content !== DEFAULT_PLACEHOLDER_MESSAGE_TEXT) return false;
  const r = m.role;
  if (r !== undefined && r !== null && r !== 'system') return false;
  return true;
}

/** POST 单条追加：与 PATCH 一致须接受 null（前端 toMessagePayload 会展开内存/DB 形状消息，optional 不含 null 时 Zod 抛错→400） */
const createMessageSchema = z.object({
  id: z.string().trim().optional().nullable(),
  taskId: z.string().trim().optional().nullable(),
  taskName: z.string().trim().optional().nullable(),
  role: z.enum(['user', 'assistant', 'system']).optional().nullable(),
  type: z.string().trim().optional().nullable(),
  content: z.string().trim().optional().default(''),
  timestamp: z.string().datetime().optional().nullable(),
  confirmed: z.boolean().optional().nullable(),
  payloadJson: z.unknown().optional().nullable(),
}).passthrough();

const taskActionSchema = z
  .object({
    content: z.string().trim().optional(),
    timestamp: z.string().datetime().optional(),
    payloadJson: z.unknown().optional(),
  })
  .passthrough();

const updateProblemCaseSchema = z.object({
  customerName: z.string().trim().optional(),
  customerNeedsOrChallenges: z.string().trim().optional(),
  customerItStatus: z.string().trim().optional(),
  projectTimeRequirement: z.string().trim().optional(),
  currentMajorStage: z.number().int().optional(),
  currentItStrategySubstep: z.number().int().optional(),
  completedStages: z.array(z.number().int()).optional(),
  workflowAlignCompletedStages: z.array(z.number().int()).optional(),
  itGapCompletedStages: z.array(z.number().int()).optional(),
  completedTaskIds: z.array(z.string()).optional(),
  basicInfo: z.unknown().optional(),
  bmc: z.unknown().optional(),
  requirementLogic: z.unknown().optional(),
  valueStream: z.unknown().optional(),
  e2eFlowWorkspaceSuppressed: z.boolean().optional(),
  /** task7：JSON 列须进入 PUT 白名单以便在线模式落库 */
  e2eFlowLandscapeJson: z.unknown().optional(),
  e2eTransactionFlowJson: z.unknown().optional(),
  e2eRequirementScenarioSupplementJson: z.unknown().optional(),
  globalItGapAnalysisJson: z.unknown().optional(),
  /** task8：按事务 session，须进入 PUT 白名单以便单步持久化 */
  itDesignSupplementSessions: z.unknown().optional(),
  localItGapSessions: z.unknown().optional(),
  localItGapAnalyses: z.unknown().optional(),
  roleTaskCenterPortalDesignJson: z.unknown().optional(),
  objectStateMachineJson: z.unknown().optional(),
  rolePermissionSessions: z.unknown().optional(),
  coreBusinessObjectSessions: z.unknown().optional(),
  coreBusinessObjectSystemPromptOverride: z.string().optional(),
  requirementDetail: z.unknown().optional(),
  requirementDetailHistory: z.unknown().optional(),
  operationModel: z.unknown().optional(),
  businessStatus: z.unknown().optional(),
  urgencyAnalysis: z.unknown().optional(),
  preliminaryReq: z.unknown().optional(),
  task1PendingPreliminaryRequirement: z.boolean().optional(),
  task1InitialLlmQuery: z.unknown().optional(),
});

/** 设计详情任务进展工作区 PUT body */
const putDesignDetailProgressWorkspaceSchema = z
  .object({
    payload: z.unknown(),
  })
  .strict();

/** Task1 经营信息提炼 JSON → token / 特征 / 逻辑边 */
const syncDesignDetailTask1BasicInfoGraphSchema = z
  .object({
    basicInfo: z.unknown().optional(),
  })
  .strict();

/** Task1 客户需求提炼 JSON：按顶层分域同步 token / 特征 / 逻辑边 */
const syncDesignDetailCustomerReqSectionGraphSchema = z
  .object({
    sectionKey: z.string().trim().min(1),
    requirementParsed: z.unknown().optional(),
  })
  .strict();

/** 任务 1 L1 原始实然特征集 JSON → token / 特征 */
const syncDesignDetailTask1L1OriginalFeatureMatrixSchema = z
  .object({
    l1OriginalFeatureRaw: z.unknown().optional(),
  })
  .strict();

/** 任务 2–5 Target_KV sync：深访问卷与用户回复（写入 `DesignDetailInferenceRevisionRecord`） */
const designDetailTargetKvSyncAlignmentFieldsSchema = z.object({
  alignmentQuestionnaire: z.string().optional(),
  alignmentUserReply: z.string().optional(),
  painPointConfirmedTargetFeatureIds: z.array(z.string()).optional(),
  painPointConfirmingLineStepId: z.string().max(191).optional(),
  validationStatusResolvedTargetFeatureIds: z.array(z.string()).optional(),
});

function pickTargetKvSyncAlignmentMeta(body: {
  alignmentQuestionnaire?: string;
  alignmentUserReply?: string;
  painPointConfirmedTargetFeatureIds?: string[];
  painPointConfirmingLineStepId?: string;
  validationStatusResolvedTargetFeatureIds?: string[];
}): {
  alignmentQuestionnaire?: string;
  alignmentUserReply?: string;
  painPointConfirmedTargetFeatureIds?: string[];
  painPointConfirmingLineStepId?: string;
  validationStatusResolvedTargetFeatureIds?: string[];
} {
  const alignmentQuestionnaire = String(body.alignmentQuestionnaire ?? '').trim();
  const alignmentUserReply = String(body.alignmentUserReply ?? '').trim();
  const painIds = (body.painPointConfirmedTargetFeatureIds ?? [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  const painStep = String(body.painPointConfirmingLineStepId ?? '').trim();
  const resolvedIds = (body.validationStatusResolvedTargetFeatureIds ?? [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  const out: {
    alignmentQuestionnaire?: string;
    alignmentUserReply?: string;
    painPointConfirmedTargetFeatureIds?: string[];
    painPointConfirmingLineStepId?: string;
    validationStatusResolvedTargetFeatureIds?: string[];
  } = {};
  if (alignmentQuestionnaire) out.alignmentQuestionnaire = alignmentQuestionnaire;
  if (alignmentUserReply) out.alignmentUserReply = alignmentUserReply;
  if (painIds.length) out.painPointConfirmedTargetFeatureIds = [...new Set(painIds)];
  if (painStep) out.painPointConfirmingLineStepId = painStep;
  if (resolvedIds.length) out.validationStatusResolvedTargetFeatureIds = [...new Set(resolvedIds)];
  return out;
}

function pickTargetKvSyncAlignmentMetaFromBody(body: unknown): {
  alignmentQuestionnaire?: string;
  alignmentUserReply?: string;
} {
  const parsed = designDetailTargetKvSyncAlignmentFieldsSchema.safeParse(body);
  return parsed.success ? pickTargetKvSyncAlignmentMeta(parsed.data) : {};
}

/** 任务 2 L1：解析 `Target_KV[].Feature_Key` 并各写一条 `DesignDetailTaskToken`（`taskId` = `DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID`，中文任务名） */
const syncDesignDetailTask2L1TargetKvTokensSchema = z
  .object({
    /** 正常为模型原文 string；若客户端误传已解析的 JSON 对象，先 stringify 再交给解析器 */
    l1InferenceRaw: z.preprocess(
      (v) => {
        if (typeof v === 'string') return v;
        if (v != null && typeof v === 'object') return JSON.stringify(v);
        return v;
      },
      z.string(),
    ),
  })
  .merge(designDetailTargetKvSyncAlignmentFieldsSchema)
  .strict();

/** 任务 3 L2：解析 `L2_Business_Inference_Matrix` / `L2_Inference_Matrix` 内 `Target_KV` 并写入任务 3 推理图 token（`l2InferenceRaw` 可与任务 2 一样支持 object） */
const syncDesignDetailTask3L2TargetKvTokensSchema = z
  .object({
    l2InferenceRaw: z.preprocess(
      (v) => {
        if (typeof v === 'string') return v;
        if (v != null && typeof v === 'object') return JSON.stringify(v);
        return v;
      },
      z.string(),
    ),
  })
  .merge(designDetailTargetKvSyncAlignmentFieldsSchema)
  .strict();

/** 任务 4 L2：解析 `L2_Value_Inference_Matrix.Target_KV`；`l2ValueInferenceRaw` 可与任务 3 一样支持 object */
const syncDesignDetailTask4L2TargetKvTokensSchema = z
  .object({
    l2ValueInferenceRaw: z.preprocess(
      (v) => {
        if (typeof v === 'string') return v;
        if (v != null && typeof v === 'object') return JSON.stringify(v);
        return v;
      },
      z.string(),
    ),
  })
  .merge(designDetailTargetKvSyncAlignmentFieldsSchema)
  .strict();

const syncDesignDetailTask5L3TargetKvTokensSchema = z
  .object({
    l3ProcessInferenceRaw: z.preprocess(
      (v) => {
        if (typeof v === 'string') return v;
        if (v != null && typeof v === 'object') return JSON.stringify(v);
        return v;
      },
      z.string(),
    ),
  })
  .merge(designDetailTargetKvSyncAlignmentFieldsSchema)
  .strict();

/** POST `/api/problem-cases/:id/llm-logs`：本地直连 DeepSeek 成功后补记，或与 AI 代理字段对齐的手工写入 */
const appendCaseLlmLogSchema = z.object({
  taskId: z.string().trim().min(1),
  callTarget: z.string().trim().min(1),
  inputPrompt: z.string(),
  inputTokens: z.number().int().optional().nullable(),
  outputContent: z.string(),
  outputTokens: z.number().int().optional().nullable(),
  durationMs: z.number().int().min(0),
  model: z.string().trim().optional().nullable(),
});

/** POST `/api/problem-cases/:id/llm-logs/clear`：设计页「重启当前」按 taskId 批量删审计行；**完全重启**可传 `{ all: true }` */
const clearCaseLlmLogsSchema = z.union([
  z.object({ all: z.literal(true) }).strict(),
  z.object({ taskIds: z.array(z.string().trim().min(1)).min(1) }).strict(),
]);

/** 导入包中的 case 快照：不信任 id/时间戳，仅作字段来源 */
const importCaseSnapshotSchema = z
  .object({
    id: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    customerName: z.string().trim().min(1, '客户名称不能为空'),
    customerNeedsOrChallenges: z.string().optional(),
    customerItStatus: z.string().optional(),
    projectTimeRequirement: z.string().optional(),
    currentMajorStage: z.number().int().optional(),
    currentItStrategySubstep: z.number().int().optional(),
    completedStages: z.array(z.number().int()).optional(),
    workflowAlignCompletedStages: z.array(z.number().int()).optional(),
    itGapCompletedStages: z.array(z.number().int()).optional(),
    completedTaskIds: z.array(z.string()).optional(),
    basicInfo: z.unknown().optional(),
    bmc: z.unknown().optional(),
    requirementLogic: z.unknown().optional(),
    valueStream: z.unknown().optional(),
    e2eFlowWorkspaceSuppressed: z.boolean().optional(),
    e2eFlowLandscapeJson: z.unknown().optional(),
    e2eTransactionFlowJson: z.unknown().optional(),
    e2eRequirementScenarioSupplementJson: z.unknown().optional(),
    globalItGapAnalysisJson: z.unknown().optional(),
    itDesignSupplementSessions: z.unknown().optional(),
    localItGapSessions: z.unknown().optional(),
    localItGapAnalyses: z.unknown().optional(),
    roleTaskCenterPortalDesignJson: z.unknown().optional(),
    objectStateMachineJson: z.unknown().optional(),
    rolePermissionSessions: z.unknown().optional(),
    coreBusinessObjectSessions: z.unknown().optional(),
    coreBusinessObjectSystemPromptOverride: z.string().optional(),
    /** 与 GET 详情/导出 case 顶层一致；导入时必须写入 update，否则 Prisma 合并 __createContractExtras 会覆盖掉包内 preliminaryReq */
    preliminaryReq: z.unknown().optional(),
    task1PendingPreliminaryRequirement: z.boolean().optional(),
    task1InitialLlmQuery: z.unknown().optional(),
    requirementDetail: z.unknown().optional(),
    requirementDetailHistory: z.unknown().optional(),
    operationModel: z.unknown().optional(),
    businessStatus: z.unknown().optional(),
    urgencyAnalysis: z.unknown().optional(),
  })
  .passthrough();

const importMessageItemSchema = z
  .object({
    id: z.string().optional(),
    caseId: z.string().optional(),
    taskId: z.string().nullable().optional(),
    taskName: z.string().nullable().optional(),
    role: z.enum(['user', 'assistant', 'system']).nullable().optional(),
    type: z.string().nullable().optional(),
    content: z.string(),
    timestamp: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'timestamp 无效'),
    confirmed: z.boolean().optional(),
    payloadJson: z.unknown().optional(),
  })
  .passthrough();

const clientExportMetaSchema = z.object({
  displayArchiveNo: z.number().int().positive(),
  displayCustomerName: z.string().min(1),
});

const importCasePackageSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string().min(1),
  case: importCaseSnapshotSchema,
  messages: z.array(importMessageItemSchema),
  /** 前端导出时注入；导入为新案例时忽略；恢复当前案例时不校验此字段（由前端校验） */
  clientMeta: clientExportMetaSchema.optional(),
});

/** 将当前案例恢复为包内数据态：包内 case.id / message.id 忽略，保留 URL 中案例 id */
export class ProblemCaseRestoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProblemCaseRestoreValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const EXPORT_FILENAME_BASE_MAX = 120;

/** 导出下载用安全文件名（仅 basename，含 .json） */
export function buildProblemCaseExportDownloadBasename(
  item: ProblemCase,
  summaries: ProblemCaseTaskSummary[],
): string {
  const major = item.currentMajorStage ?? 0;
  const inStage = summaries.filter((t) => t.majorStage === major);
  let row = inStage.find((t) => t.status === 'current');
  if (!row) row = inStage.find((t) => t.status === 'pending');
  const taskLabel = row?.label ?? '未知任务';
  const customer = String(item.customerName ?? '').trim() || '未命名案例';
  const combined = `${customer}_${taskLabel}`;
  const base = sanitizeExportFilenameBase(combined, EXPORT_FILENAME_BASE_MAX);
  return `${base}.json`;
}

function sanitizeExportFilenameBase(raw: string, maxLen: number): string {
  let s = raw.replace(/[\x00-\x1f\\\/:*?"<>|]/g, '_').replace(/_+/g, '_').trim();
  if (!s) s = 'export';
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/** HTTP Content-Disposition：ASCII filename + RFC5987 filename*（UTF-8） */
export function buildAttachmentContentDisposition(utf8Filename: string): string {
  let ascii = utf8Filename
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\\r\n]/g, '_')
    .replace(/_+/g, '_')
    .trim();
  if (!ascii || /^_+\.json$/i.test(ascii)) ascii = 'export.json';
  if (ascii.length > 180) ascii = ascii.slice(0, 180);
  const encoded = encodeURIComponent(utf8Filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export class ProblemCaseService {
  constructor(
    private readonly repository: ProblemCaseRepository,
    private readonly parser: ProblemCaseParser,
  ) {}

  /** 落库前：对已确认痛点的任务 1 节点统一 Consistency，避免重复问卷 */
  private async mergeTvPlansWithPainPointConfirmedImmunity(
    caseId: string,
    tvPlans: Task2L1TokenValidationLinkPlan[],
    logTag: string,
  ): Promise<Task2L1TokenValidationLinkPlan[]> {
    try {
      const graphTasks = await this.repository.getDesignDetailTaskGraphDetail(caseId);
      const confirmed = buildTask1PainPointConfirmedIndex(graphTasks);
      if (confirmed.size > 0) {
        const merged = mergeTokenValidationPlansWithPainPointConfirmedImmunity(tvPlans, confirmed);
        console.warn(`[problem-case:${logTag}]`, {
          phase: 'pain_point_immunity_merged',
          caseId,
          confirmedTargets: confirmed.size,
        });
        return merged;
      }
    } catch (immErr) {
      console.warn(`[problem-case:${logTag}]`, {
        phase: 'pain_point_immunity_failed',
        caseId,
        message: immErr instanceof Error ? immErr.message : String(immErr),
      });
    }
    return tvPlans;
  }

  /** 对齐问卷提交后的 sync：标记任务 1 节点「是否确认痛点」= 是 */
  private async markTask1PainPointConfirmedAfterAlignmentSync(
    caseId: string,
    meta: ReturnType<typeof pickTargetKvSyncAlignmentMeta>,
  ): Promise<void> {
    const reply = String(meta.alignmentUserReply ?? '').trim();
    const step = String(meta.painPointConfirmingLineStepId ?? '').trim();
    const ids = meta.painPointConfirmedTargetFeatureIds ?? [];
    if (!reply || !step || !ids.length) return;
    await this.repository.markDesignDetailTask1PainPointConfirmed(caseId, ids, step);
  }

  /** 对齐问卷提交后：任务 1 冲突节点 `Validation_Status` → `Resolved_By_Customer`（方案 A Mutation） */
  private async markTask1ValidationResolvedAfterAlignmentSync(
    caseId: string,
    meta: ReturnType<typeof pickTargetKvSyncAlignmentMeta>,
  ): Promise<void> {
    const reply = String(meta.alignmentUserReply ?? '').trim();
    const ids = meta.validationStatusResolvedTargetFeatureIds ?? [];
    if (!reply || !ids.length) return;
    await this.repository.markDesignDetailTask1ValidationResolvedByCustomer(caseId, ids);
  }

  async markDesignDetailTask1ValidationResolvedByCustomer(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; updatedCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };
    const parsed = z
      .object({
        targetFeatureIds: z.array(z.string()).min(1),
      })
      .safeParse(body);
    if (!parsed.success) {
      return { badRequest: true, message: '请求体须包含非空 targetFeatureIds' };
    }
    const ids = [...new Set(parsed.data.targetFeatureIds.map((x) => String(x || '').trim()).filter(Boolean))];
    if (!ids.length) {
      return { badRequest: true, message: 'targetFeatureIds 为空' };
    }
    const updatedCount = await this.repository.markDesignDetailTask1ValidationResolvedByCustomer(id, ids);
    return { ok: true, updatedCount };
  }

  /**
   * 任务 2–5 每次 Target_KV sync 成功后：比对重跑前后特征、写入 TVM Validation_Logic 与 Causality 摘要。
   */
  private async persistInferenceRevisionAfterTargetKvSync(
    caseId: string,
    graphTaskId: string,
    taskIdAliases: readonly string[],
    raw: string,
    matrixKind: InferenceCausalityMatrixKind,
    tvPlans: ReadonlyArray<{ targetFeatureId: string; validationLogic: string }>,
    beforeFeatures: ReadonlyArray<DesignDetailTaskGraphFeatureDto>,
    alignment?: { alignmentQuestionnaire?: string; alignmentUserReply?: string },
    afterTargetKvRows?: ReadonlyArray<{
      featureKey: string;
      operator?: string;
      featureValue?: unknown;
    }>,
  ): Promise<void> {
    try {
      const tasks = await this.repository.getDesignDetailTaskGraphDetail(caseId);
      const afterFeatures = pickGraphFeaturesForTaskIds(tasks, [graphTaskId, ...taskIdAliases]);
      const causality = parseCausalityAnalysisFromInferenceRaw(raw, matrixKind);
      const painPoints = parseDiagnosticPainPointsFromInferenceRaw(raw, matrixKind);
      const rows = buildDesignDetailInferenceRevisionRows({
        beforeFeatures,
        afterFeatures,
        afterTargetKvRows,
        tvPlans,
        causality,
        painPoints,
        alignment,
      });
      const result = await this.repository.replaceDesignDetailInferenceRevisionRecords(
        caseId,
        graphTaskId,
        rows,
      );
      const featureRows = rows.filter((r) => r.recordKind === 'FEATURE_VALUE').length;
      const tvRows = rows.filter((r) => r.recordKind === 'TOKEN_VALIDATION').length;
      const painRows = rows.filter((r) => r.recordKind === 'DIAGNOSTIC_PAIN_POINT').length;
      console.warn('[problem-case:inference-revision]', {
        caseId,
        taskId: graphTaskId,
        syncSeq: result.syncSeq,
        recordCount: result.recordCount,
        builtRows: rows.length,
        featureRows,
        tvRows,
        painRows,
        beforeFeatureCount: beforeFeatures.length,
        afterFeatureCount: afterFeatures.length,
        afterTargetKvCount: afterTargetKvRows?.length ?? 0,
      });
      if (result.recordCount === 0 && rows.length > 0) {
        console.error('[problem-case:inference-revision]', {
          caseId,
          taskId: graphTaskId,
          phase: 'insert_zero_but_built_rows',
          builtRows: rows.length,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error('[problem-case:inference-revision]', {
        caseId,
        taskId: graphTaskId,
        phase: 'persist_failed',
        error: msg,
        stack,
      });
    }
  }

  private async loadGraphFeaturesBeforeTargetKvSync(
    caseId: string,
    taskIdAliases: readonly string[],
  ): Promise<DesignDetailTaskGraphFeatureDto[]> {
    const tasks = await this.repository.getDesignDetailTaskGraphDetail(caseId);
    return pickGraphFeaturesForTaskIds(tasks, taskIdAliases);
  }

  private buildOwnerFromAuth(auth: JwtAuthPayload): Pick<ProblemCase, 'ownerSubjectId' | 'ownerSubjectType' | 'ownerUsernameSnapshot'> {
    return {
      ownerSubjectId: auth.userId,
      ownerSubjectType: auth.role,
      ownerUsernameSnapshot: auth.username,
    };
  }

  private buildCreatedByFromOwner(item: ProblemCase): string {
    const snapshot = typeof item.ownerUsernameSnapshot === 'string' ? item.ownerUsernameSnapshot.trim() : '';
    if (snapshot) return snapshot;

    const ownerId = item.ownerSubjectId;
    const ownerType = item.ownerSubjectType;
    const hasOwner = Boolean(ownerId) || Boolean(ownerType);
    return hasOwner ? '未知用户' : '未归属';
  }

  private isAuthorizedForCase(item: ProblemCase, auth: JwtAuthPayload): boolean {
    // admin 保留全量视角
    if (auth.role === 'admin') return true;
    // user：仅可见自己创建/导入的案例；历史 owner 为空对 user 不可见
    return item.ownerSubjectType === 'user' && item.ownerSubjectId === auth.userId;
  }

  list(auth: JwtAuthPayload) {
    if (auth.role === 'admin') {
      return this.repository.list().then((items) => items.map((it) => ({
        ...it,
        createdBy: this.buildCreatedByFromOwner(it),
      })));
    }

    return this.repository
      .list()
      .then((items) => items.filter((it) => this.isAuthorizedForCase(it, auth)));
  }

  async getById(id: string, auth: JwtAuthPayload) {
    const item = await this.repository.findById(id);
    if (!item) return null;
    const normalized = normalizeProblemCase(id, item);
    if (!this.isAuthorizedForCase(normalized, auth)) return null;
    return normalized;
  }

  /** 在线版售前分析报告 v1：只读聚合，不写库、不新建存储表 */
  async getReport(id: string, auth: JwtAuthPayload): Promise<ProblemCaseReportDto | null> {
    const item = await this.getById(id, auth);
    if (!item) return null;
    return buildProblemCaseReportDto(item, new Date().toISOString());
  }

  async getMessages(id: string, auth: JwtAuthPayload): Promise<ProblemCaseMessage[] | null> {
    const item = await this.getById(id, auth);
    if (!item) return null;
    const messages = await this.repository.getMessages(id);
    return messages.map((m) => normalizeProblemCaseMessage(id, m));
  }

  async replaceMessages(id: string, payload: unknown, auth: JwtAuthPayload): Promise<ProblemCaseMessage[] | null> {
    const item = await this.getById(id, auth);
    if (!item) return null;

    const parsed = syncMessagesSchema.parse(payload);
    const existing = await this.repository.getMessages(id);
    if (existing.length > 0 && isDangerousDefaultPlaceholderReplace(parsed.items)) {
      return existing.map((m) => normalizeProblemCaseMessage(id, m));
    }

    const { items } = parsed;
    const messages = await this.repository.replaceMessages(id, items as ProblemCaseMessage[]);
    return messages.map((m) => normalizeProblemCaseMessage(id, m));
  }

  async update(id: string, payload: unknown, auth: JwtAuthPayload) {
    // owner check in service
    // (保持签名最小改动：路由已显式传 auth，内部将所有 caseId 更新前校验)
    // 注意：这里会在后续统一 patch 为 `update(id, payload, auth)`
    const item = await this.getById(id, auth);
    if (!item) return null;
    const updates = updateProblemCaseSchema.parse(payload) as UpdateProblemCaseInput;
    return this.repository.update(id, updates);
  }

  /**
   * @param cachedItem 若已由调用方加载案例，可传入以避免重复 findById（如导出接口）
   */
  async getTaskSummaries(
    id: string,
    auth: JwtAuthPayload,
    cachedItem?: ProblemCase | null,
  ): Promise<ProblemCaseTaskSummary[] | null> {
    const item = cachedItem ?? (await this.getById(id, auth));
    if (!item) return null;

    const completedRequirement = new Set(item.completedStages || []);
    const completedWorkflow = new Set(item.workflowAlignCompletedStages || []);
    const completedGap = new Set(item.itGapCompletedStages || []);

    return [
      { taskId: 'task1', label: '企业背景洞察', majorStage: 0, status: resolveStageStatus(0, 0, completedRequirement) },
      { taskId: 'task2', label: '商业画布加载', majorStage: 0, status: resolveStageStatus(0, 1, completedRequirement) },
      { taskId: 'task3', label: '需求逻辑构建', majorStage: 0, status: resolveStageStatus(0, 2, completedRequirement) },
      { taskId: 'task4', label: '价值流图', majorStage: 1, status: resolveStageStatus(1, 0, completedWorkflow) },
      { taskId: 'task5', label: 'IT 现状标注', majorStage: 1, status: resolveStageStatus(1, 1, completedWorkflow) },
      { taskId: 'task6', label: '痛点标注', majorStage: 1, status: resolveStageStatus(1, 2, completedWorkflow) },
      { taskId: 'e2e-flow', label: 'E2E 流程梳理', majorStage: 2, status: resolveStageStatus(2, 0, completedGap) },
      { taskId: 'global-itgap', label: '全局 ITGap', majorStage: 2, status: resolveStageStatus(2, 1, completedGap) },
      { taskId: 'local-itgap', label: '局部 ITGap', majorStage: 2, status: resolveStageStatus(2, 2, completedGap) },
      { taskId: 'task12', label: '全局架构设计', majorStage: 3, status: resolveStage3Status(item, 'task12') },
      { taskId: 'task13', label: '环节专项设计', majorStage: 3, status: resolveStage3Status(item, 'task13') },
      { taskId: 'task14', label: '链条串联与闭环', majorStage: 3, status: resolveStage3Status(item, 'task14') },
      { taskId: 'task15', label: '价值回溯与自检', majorStage: 3, status: resolveStage3Status(item, 'task15') },
    ];
  }

  async addMessage(caseId: string, payload: unknown, auth: JwtAuthPayload): Promise<ProblemCaseMessage | null> {
    const item = await this.getById(caseId, auth);
    if (!item) return null;

    const parsed = createMessageSchema.parse(payload);
    const now = new Date().toISOString();
    const timestamp = parsed.timestamp ? new Date(parsed.timestamp).toISOString() : now;

    const message: ProblemCaseMessage = {
      ...(parsed as any),
      id: parsed.id || `msg_${randomUUID().slice(0, 8)}`,
      content: parsed.content ?? '',
      timestamp,
    };

    // 去重：taskStartNotification 同一 taskId 仅保留一条
    if (message.type === 'taskStartNotification' && message.taskId) {
      const existing = (await this.repository.getMessages(caseId)).find(
        (m) => m.type === 'taskStartNotification' && m.taskId === message.taskId,
      );
      if (existing) return existing;
    }

    const saved = await this.repository.appendMessage(caseId, message);
    return normalizeProblemCaseMessage(caseId, saved);
  }

  async deleteMessage(caseId: string, messageId: string, auth: JwtAuthPayload): Promise<boolean> {
    const item = await this.getById(caseId, auth);
    if (!item) return false;
    return this.repository.deleteMessage(caseId, messageId);
  }

  async patchMessage(caseId: string, messageId: string, payload: unknown, auth: JwtAuthPayload): Promise<ProblemCaseMessage | null> {
    const item = await this.getById(caseId, auth);
    if (!item) return null;

    const parsed = patchMessageSchema.parse(payload) as ProblemCaseMessagePatch;
    const saved = await this.repository.updateMessage(caseId, messageId, parsed);
    if (!saved) return null;
    return normalizeProblemCaseMessage(caseId, saved);
  }

  async startTask(caseId: string, taskId: string, payload: unknown, auth: JwtAuthPayload) {
    const item = await this.getById(caseId, auth);
    if (!item) return null;

    const parsed = taskActionSchema.parse(payload);
    const taskName = resolveTaskName(taskId);

    await this.upsertTaskStartNotification(caseId, taskId, taskName, true, parsed.timestamp);

    return this.getTasksBundle(caseId, auth, item);
  }

  async confirmTask(caseId: string, taskId: string, payload: unknown, auth: JwtAuthPayload) {
    const item = await this.getById(caseId, auth);
    if (!item) return null;

    const parsed = taskActionSchema.parse(payload);
    const taskName = resolveTaskName(taskId);

    await this.upsertTaskStartNotification(caseId, taskId, taskName, true, parsed.timestamp);
    await this.ensureTaskCompleteBlock(caseId, taskId, parsed.content, parsed.timestamp, taskName);
    await this.applyCaseCompletionOnConfirm(caseId, taskId);

    return this.getTasksBundle(caseId, auth, item);
  }

  async reviseTask(caseId: string, taskId: string, payload: unknown, auth: JwtAuthPayload) {
    const item = await this.getById(caseId, auth);
    if (!item) return null;

    const parsed = taskActionSchema.parse(payload);
    const taskName = resolveTaskName(taskId);

    await this.deleteTaskCompleteBlocks(caseId, taskId);
    await this.resetCaseCompletionOnRevise(caseId, taskId);
    await this.resetTaskStartNotification(caseId, taskId, taskName, parsed.timestamp);

    return this.getTasksBundle(caseId, auth, item);
  }

  async rollbackTask(caseId: string, taskId: string, payload: unknown, auth: JwtAuthPayload) {
    const item = await this.getById(caseId, auth);
    if (!item) return null;

    taskActionSchema.parse(payload);
    const targetFront = pathTaskIdToFrontendTaskId(taskId);
    const order = FRONTEND_TASK_ORDER as readonly string[];
    if (order.indexOf(targetFront) < 0) {
      return this.reviseTask(caseId, taskId, payload, auth);
    }

    const messages = await this.repository.getMessages(caseId);
    const filtered = filterMessagesAfterRollback(messages, targetFront);
    const patch = buildRollbackCasePatch(item, targetFront);

    await this.repository.replaceMessages(caseId, filtered);
    await this.repository.update(caseId, patch);

    return this.getTasksBundle(caseId, auth, item);
  }

  async parsePreview(payload: unknown): Promise<ProblemCaseParsePreview> {
    const { input } = parsePreviewInputSchema.parse(payload);
    return this.parser.parse(input);
  }

  async create(payload: unknown, auth: JwtAuthPayload) {
    const input = createProblemCaseSchema.parse(payload) as CreateProblemCaseInput;
    // online 创建场景：忽略前端传入的 `id`（通常是 createdAt），避免时间戳主键链路。
    // 始终由 repository 生成独立的 caseId，并透传到创建响应/列表/详情。
    const { id: _incomingId, ...rest } = input;
    const owner = this.buildOwnerFromAuth(auth);
    return this.repository.create({ ...(rest as CreateProblemCaseInput), ...owner });
  }

  /** 导出单案例 JSON 包（v1） */
  async exportCasePackage(caseId: string, auth: JwtAuthPayload): Promise<ProblemCaseExportPackageV1 | null> {
    const item = await this.getById(caseId, auth);
    if (!item) return null;
    const messages = await this.getMessages(caseId, auth);
    if (!messages) return null;
    return {
      schemaVersion: PROBLEM_CASE_EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      case: item,
      messages,
    };
  }

  /**
   * 从 JSON 包导入为**新**案例：忽略包内 case.id / message.id / message.caseId，重生成主键与 messageId。
   */
  async importCasePackage(payload: unknown, auth: JwtAuthPayload): Promise<ProblemCaseImportResultV1> {
    const parsed = importCasePackageSchema.parse(payload);
    const rawCase = parsed.case as z.infer<typeof importCaseSnapshotSchema> & Record<string, unknown>;
    const { id: _rid, createdAt: _ca, updatedAt: _ua, ...caseRest } = rawCase;

    const owner = this.buildOwnerFromAuth(auth);
    const created = await this.repository.create({
      customerName: String(caseRest.customerName ?? '').trim(),
      customerNeedsOrChallenges:
        typeof caseRest.customerNeedsOrChallenges === 'string' ? caseRest.customerNeedsOrChallenges : '',
      customerItStatus: typeof caseRest.customerItStatus === 'string' ? caseRest.customerItStatus : '',
      projectTimeRequirement:
        typeof caseRest.projectTimeRequirement === 'string' ? caseRest.projectTimeRequirement : '',
      requirementDetail: caseRest.requirementDetail,
      requirementDetailHistory: caseRest.requirementDetailHistory,
      operationModel: caseRest.operationModel,
      businessStatus: caseRest.businessStatus,
      urgencyAnalysis: caseRest.urgencyAnalysis,
      preliminaryReq: caseRest.preliminaryReq,
      task1PendingPreliminaryRequirement:
        typeof caseRest.task1PendingPreliminaryRequirement === 'boolean'
          ? caseRest.task1PendingPreliminaryRequirement
          : undefined,
      task1InitialLlmQuery: caseRest.task1InitialLlmQuery,
      ...owner,
    });

    const updates = updateProblemCaseSchema.parse({
      currentMajorStage: caseRest.currentMajorStage,
      currentItStrategySubstep: caseRest.currentItStrategySubstep,
      completedStages: caseRest.completedStages,
      workflowAlignCompletedStages: caseRest.workflowAlignCompletedStages,
      itGapCompletedStages: caseRest.itGapCompletedStages,
      completedTaskIds: caseRest.completedTaskIds,
      basicInfo: caseRest.basicInfo,
      bmc: caseRest.bmc,
      requirementLogic: caseRest.requirementLogic,
      valueStream: caseRest.valueStream,
      e2eFlowWorkspaceSuppressed:
        typeof caseRest.e2eFlowWorkspaceSuppressed === 'boolean'
          ? caseRest.e2eFlowWorkspaceSuppressed
          : undefined,
      e2eFlowLandscapeJson: caseRest.e2eFlowLandscapeJson,
      e2eTransactionFlowJson: caseRest.e2eTransactionFlowJson,
      e2eRequirementScenarioSupplementJson: caseRest.e2eRequirementScenarioSupplementJson,
      globalItGapAnalysisJson: caseRest.globalItGapAnalysisJson,
      itDesignSupplementSessions: caseRest.itDesignSupplementSessions,
      localItGapSessions: caseRest.localItGapSessions,
      localItGapAnalyses: caseRest.localItGapAnalyses,
      roleTaskCenterPortalDesignJson: caseRest.roleTaskCenterPortalDesignJson,
      objectStateMachineJson: caseRest.objectStateMachineJson,
      rolePermissionSessions: caseRest.rolePermissionSessions,
      coreBusinessObjectSessions: caseRest.coreBusinessObjectSessions,
      coreBusinessObjectSystemPromptOverride: caseRest.coreBusinessObjectSystemPromptOverride,
      requirementDetail: caseRest.requirementDetail,
      requirementDetailHistory: caseRest.requirementDetailHistory,
      operationModel: caseRest.operationModel,
      businessStatus: caseRest.businessStatus,
      urgencyAnalysis: caseRest.urgencyAnalysis,
      preliminaryReq: caseRest.preliminaryReq,
      task1PendingPreliminaryRequirement:
        typeof caseRest.task1PendingPreliminaryRequirement === 'boolean'
          ? caseRest.task1PendingPreliminaryRequirement
          : undefined,
      task1InitialLlmQuery: caseRest.task1InitialLlmQuery,
    });
    await this.repository.update(created.id, updates);

    const newMessages: ProblemCaseMessage[] = parsed.messages.map((m) => {
      const p = importMessageItemSchema.parse(m);
      const id = `msg_${randomUUID().slice(0, 8)}`;
      const ts = new Date(p.timestamp).toISOString();
      return {
        id,
        taskId: p.taskId ?? undefined,
        taskName: p.taskName ?? undefined,
        role: p.role ?? undefined,
        type: p.type ?? undefined,
        content: p.content,
        timestamp: ts,
        confirmed: p.confirmed ?? false,
        payloadJson: p.payloadJson ?? null,
      } as ProblemCaseMessage;
    });

    await this.repository.replaceMessages(created.id, newMessages);

    return {
      caseId: created.id,
      importedMessageCount: newMessages.length,
      schemaVersion: PROBLEM_CASE_EXPORT_SCHEMA_VERSION,
    };
  }

  /**
   * 用 JSON 包覆盖**指定**案例（不新建 id）：服务端校验包内 `case.customerName` 与当前库内一致；档案编号由前端比对 clientMeta。
   */
  async restoreCasePackage(caseId: string, payload: unknown, auth: JwtAuthPayload): Promise<ProblemCaseImportResultV1 | null> {
    const parsed = importCasePackageSchema.parse(payload);
    const existing = await this.getById(caseId, auth);
    if (!existing) return null;

    const rawCase = parsed.case as z.infer<typeof importCaseSnapshotSchema> & Record<string, unknown>;
    const pkgName = String(rawCase.customerName ?? '').trim();
    const curName = String(existing.customerName ?? '').trim();
    if (pkgName !== curName) {
      throw new ProblemCaseRestoreValidationError('导出包中的客户名称与当前案例不一致，无法恢复。');
    }

    const { id: _rid, createdAt: _ca, updatedAt: _ua, ...caseRest } = rawCase;

    const updates = updateProblemCaseSchema.parse({
      customerName: pkgName,
      customerNeedsOrChallenges:
        typeof caseRest.customerNeedsOrChallenges === 'string' ? caseRest.customerNeedsOrChallenges : '',
      customerItStatus: typeof caseRest.customerItStatus === 'string' ? caseRest.customerItStatus : '',
      projectTimeRequirement:
        typeof caseRest.projectTimeRequirement === 'string' ? caseRest.projectTimeRequirement : '',
      currentMajorStage: caseRest.currentMajorStage,
      currentItStrategySubstep: caseRest.currentItStrategySubstep,
      completedStages: caseRest.completedStages,
      workflowAlignCompletedStages: caseRest.workflowAlignCompletedStages,
      itGapCompletedStages: caseRest.itGapCompletedStages,
      completedTaskIds: caseRest.completedTaskIds,
      basicInfo: caseRest.basicInfo,
      bmc: caseRest.bmc,
      requirementLogic: caseRest.requirementLogic,
      valueStream: caseRest.valueStream,
      e2eFlowWorkspaceSuppressed:
        typeof caseRest.e2eFlowWorkspaceSuppressed === 'boolean'
          ? caseRest.e2eFlowWorkspaceSuppressed
          : undefined,
      e2eFlowLandscapeJson: caseRest.e2eFlowLandscapeJson,
      e2eTransactionFlowJson: caseRest.e2eTransactionFlowJson,
      e2eRequirementScenarioSupplementJson: caseRest.e2eRequirementScenarioSupplementJson,
      globalItGapAnalysisJson: caseRest.globalItGapAnalysisJson,
      itDesignSupplementSessions: caseRest.itDesignSupplementSessions,
      localItGapSessions: caseRest.localItGapSessions,
      localItGapAnalyses: caseRest.localItGapAnalyses,
      roleTaskCenterPortalDesignJson: caseRest.roleTaskCenterPortalDesignJson,
      objectStateMachineJson: caseRest.objectStateMachineJson,
      rolePermissionSessions: caseRest.rolePermissionSessions,
      coreBusinessObjectSessions: caseRest.coreBusinessObjectSessions,
      coreBusinessObjectSystemPromptOverride: caseRest.coreBusinessObjectSystemPromptOverride,
      requirementDetail: caseRest.requirementDetail,
      requirementDetailHistory: caseRest.requirementDetailHistory,
      operationModel: caseRest.operationModel,
      businessStatus: caseRest.businessStatus,
      urgencyAnalysis: caseRest.urgencyAnalysis,
      preliminaryReq: caseRest.preliminaryReq,
      task1PendingPreliminaryRequirement:
        typeof caseRest.task1PendingPreliminaryRequirement === 'boolean'
          ? caseRest.task1PendingPreliminaryRequirement
          : undefined,
      task1InitialLlmQuery: caseRest.task1InitialLlmQuery,
    });
    await this.repository.update(caseId, updates);

    const newMessages: ProblemCaseMessage[] = parsed.messages.map((m) => {
      const p = importMessageItemSchema.parse(m);
      const id = `msg_${randomUUID().slice(0, 8)}`;
      const ts = new Date(p.timestamp).toISOString();
      return {
        id,
        taskId: p.taskId ?? undefined,
        taskName: p.taskName ?? undefined,
        role: p.role ?? undefined,
        type: p.type ?? undefined,
        content: p.content,
        timestamp: ts,
        confirmed: p.confirmed ?? false,
        payloadJson: p.payloadJson ?? null,
      } as ProblemCaseMessage;
    });

    await this.repository.replaceMessages(caseId, newMessages);

    return {
      caseId,
      importedMessageCount: newMessages.length,
      schemaVersion: PROBLEM_CASE_EXPORT_SCHEMA_VERSION,
    };
  }

  async delete(id: string, auth: JwtAuthPayload) {
    const item = await this.getById(id, auth);
    if (!item) return false;
    return this.repository.delete(id);
  }

  private async getTasksBundle(
    caseId: string,
    auth: JwtAuthPayload,
    cachedItem?: ProblemCase | null,
  ) {
    const item = cachedItem ?? (await this.getById(caseId, auth));
    if (!item) return null;
    const tasks = await this.getTaskSummaries(caseId, auth, item);
    return { case: item, tasks: tasks || [] };
  }

  private async upsertTaskStartNotification(
    caseId: string,
    taskId: string,
    taskName: string,
    confirmed: boolean,
    timestampOverride?: string,
  ) {
    const messages = await this.repository.getMessages(caseId);
    const existing = messages.find((m) => m.type === 'taskStartNotification' && m.taskId === taskId);
    const desiredTimestamp = timestampOverride
      ? new Date(timestampOverride).toISOString()
      : existing?.timestamp || new Date().toISOString();

    if (existing) {
      if (Boolean(existing.confirmed) === confirmed) return existing;
      await this.repository.deleteMessage(caseId, existing.id);
    }

    const message: ProblemCaseMessage = {
      id: existing?.id || `msg_${randomUUID().slice(0, 8)}`,
      taskId,
      taskName,
      role: 'system',
      type: 'taskStartNotification',
      content: `任务通知：我即将开始【${taskName}】任务`,
      timestamp: desiredTimestamp,
      confirmed,
    } as any;

    // 任务启动通知属于时间线卡片：直接追加，不走 repository 的 POST 去重逻辑
    return this.repository.appendMessage(caseId, message);
  }

  private async resetTaskStartNotification(caseId: string, taskId: string, taskName: string, timestampOverride?: string) {
    // 强制回到“未确认”态：删除旧任务启动通知并重建一条未确认记录
    const messages = await this.repository.getMessages(caseId);
    const existing = messages.find((m) => m.type === 'taskStartNotification' && m.taskId === taskId);
    if (existing) {
      await this.repository.deleteMessage(caseId, existing.id);
    }

    const desiredTimestamp = timestampOverride ? new Date(timestampOverride).toISOString() : new Date().toISOString();
    const message: ProblemCaseMessage = {
      id: existing?.id || `msg_${randomUUID().slice(0, 8)}`,
      taskId,
      taskName,
      role: 'system',
      type: 'taskStartNotification',
      content: `任务通知：我即将开始【${taskName}】任务`,
      timestamp: desiredTimestamp,
      confirmed: false,
    } as any;

    return this.repository.appendMessage(caseId, message);
  }

  private async ensureTaskCompleteBlock(
    caseId: string,
    taskId: string,
    contentOverride: string | undefined,
    timestampOverride: string | undefined,
    taskName: string,
  ) {
    const messages = await this.repository.getMessages(caseId);
    const existing = messages.find((m) => m.type === 'taskCompleteBlock' && m.taskId === taskId);
    if (existing) return;

    const timestamp = timestampOverride ? new Date(timestampOverride).toISOString() : new Date().toISOString();
    const content = contentOverride ?? resolveTaskCompleteContent(taskId, taskName);

    const message: ProblemCaseMessage = {
      id: `msg_${randomUUID().slice(0, 8)}`,
      taskId,
      taskName,
      role: 'user',
      type: 'taskCompleteBlock',
      content,
      timestamp,
      confirmed: false,
    } as any;

    return this.repository.appendMessage(caseId, message);
  }

  private async deleteTaskCompleteBlocks(caseId: string, taskId: string) {
    const messages = await this.repository.getMessages(caseId);
    const targets = messages.filter((m) => m.type === 'taskCompleteBlock' && m.taskId === taskId);
    for (const msg of targets) {
      await this.repository.deleteMessage(caseId, msg.id);
    }
  }

  private async applyCaseCompletionOnConfirm(caseId: string, taskId: string) {
    const item = await this.repository.findById(caseId);
    if (!item) return;

    const completedStages = [...(item.completedStages || [])];
    const workflowAlignCompletedStages = [...(item.workflowAlignCompletedStages || [])];
    const itGapCompletedStages = [...(item.itGapCompletedStages || [])];
    let completedTaskIds = [...(item.completedTaskIds || [])];

    if (taskId in TASK_INDEX_STAGE0) {
      const idx = TASK_INDEX_STAGE0[taskId as keyof typeof TASK_INDEX_STAGE0];
      const stages = Array.from({ length: idx + 1 }, (_v, i) => i);
      completedStages.splice(0, completedStages.length, ...stages);
    }

    if (taskId in TASK_INDEX_STAGE1) {
      const idx = TASK_INDEX_STAGE1[taskId as keyof typeof TASK_INDEX_STAGE1];
      const stages = Array.from({ length: idx + 1 }, (_v, i) => i);
      workflowAlignCompletedStages.splice(0, workflowAlignCompletedStages.length, ...stages);
    }

    if (taskId in TASK_INDEX_STAGE2) {
      const idx = TASK_INDEX_STAGE2[taskId as keyof typeof TASK_INDEX_STAGE2];
      const stages = Array.from({ length: idx + 1 }, (_v, i) => i);
      itGapCompletedStages.splice(0, itGapCompletedStages.length, ...stages);
    }

    // 仅用于 IT 策略规划（task10~15）阶段的 completedTaskIds
    if (isStrategyTask(taskId) && !completedTaskIds.includes(taskId)) {
      completedTaskIds = [...completedTaskIds, taskId].sort();
    }

    const currentMajorStage = resolveMajorStage(completedStages, itGapCompletedStages, workflowAlignCompletedStages);
    if (currentMajorStage < 3) completedTaskIds = [];

    await this.repository.update(caseId, {
      currentMajorStage,
      completedStages,
      workflowAlignCompletedStages,
      itGapCompletedStages,
      completedTaskIds,
    });
  }

  private async resetCaseCompletionOnRevise(caseId: string, taskId: string) {
    const item = await this.repository.findById(caseId);
    if (!item) return;

    const completedStages = [...(item.completedStages || [])];
    const workflowAlignCompletedStages = [...(item.workflowAlignCompletedStages || [])];
    const itGapCompletedStages = [...(item.itGapCompletedStages || [])];
    let completedTaskIds = [...(item.completedTaskIds || [])];

    if (taskId in TASK_INDEX_STAGE0) {
      const idx = TASK_INDEX_STAGE0[taskId as keyof typeof TASK_INDEX_STAGE0];
      completedStages.splice(0, completedStages.length, ...Array.from({ length: idx }, (_v, i) => i));
    }
    if (taskId in TASK_INDEX_STAGE1) {
      const idx = TASK_INDEX_STAGE1[taskId as keyof typeof TASK_INDEX_STAGE1];
      workflowAlignCompletedStages.splice(0, workflowAlignCompletedStages.length, ...Array.from({ length: idx }, (_v, i) => i));
    }
    if (taskId in TASK_INDEX_STAGE2) {
      const idx = TASK_INDEX_STAGE2[taskId as keyof typeof TASK_INDEX_STAGE2];
      itGapCompletedStages.splice(0, itGapCompletedStages.length, ...Array.from({ length: idx }, (_v, i) => i));
    }

    if (isStrategyTask(taskId)) {
      completedTaskIds = completedTaskIds.filter((t) => t !== taskId).sort();
    }

    const currentMajorStage = resolveMajorStage(completedStages, itGapCompletedStages, workflowAlignCompletedStages);
    if (currentMajorStage < 3) completedTaskIds = [];

    await this.repository.update(caseId, {
      currentMajorStage,
      completedStages,
      workflowAlignCompletedStages,
      itGapCompletedStages,
      completedTaskIds,
    });
  }

  /**
   * 设计详情页「任务进展」工作区：GET 用；无案例返回 notFound；无行时 payload 为 null。
   */
  async getDesignDetailProgressWorkspace(
    id: string,
    auth: JwtAuthPayload,
  ): Promise<{ notFound: true } | { payload: unknown | null }> {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };
    const payload = await this.repository.getDesignDetailProgressWorkspace(id);
    return { payload };
  }

  async putDesignDetailProgressWorkspace(id: string, body: unknown, auth: JwtAuthPayload): Promise<boolean> {
    const item = await this.getById(id, auth);
    if (!item) return false;
    const parsed = putDesignDetailProgressWorkspaceSchema.parse(body);
    await this.repository.upsertDesignDetailProgressWorkspace(id, parsed.payload);
    return true;
  }

  async deleteDesignDetailProgressWorkspace(id: string, auth: JwtAuthPayload): Promise<boolean> {
    const item = await this.getById(id, auth);
    if (!item) return false;
    await this.repository.deleteDesignDetailProgressWorkspace(id);
    return true;
  }

  /** 设计详情「重启当前」等：按案例 + 设计任务线 `taskId` 清空 token 图（级联特征与逻辑边） */
  async deleteDesignDetailTaskGraph(id: string, taskId: string, auth: JwtAuthPayload): Promise<boolean> {
    const item = await this.getById(id, auth);
    if (!item) return false;
    const tid = String(taskId || '').trim();
    if (!tid || tid.length > 191) return false;
    await this.repository.deleteDesignDetailTaskGraph(id, tid);
    return true;
  }

  /** 设计详情「完全重启」：删除本案例全部 `DesignDetailTaskToken`（级联特征与逻辑边），并重置需求提炼轮次计数 */
  async deleteAllDesignDetailTaskGraph(id: string, auth: JwtAuthPayload): Promise<boolean> {
    const item = await this.getById(id, auth);
    if (!item) return false;
    await this.repository.deleteAllDesignDetailTaskGraph(id);
    return true;
  }

  /**
   * 设计详情重启：按线步清理 `DesignDetailInferenceRevisionRecord`。
   * - `line_step`：仅当前线步（「重启当前」）
   * - `from_line_step`：锚点及之后线步（「选择重启」）
   */
  async clearDesignDetailInferenceRevisionRecords(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; deleted: number; taskIds: string[] }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };
    const parsed = z
      .object({
        scope: z.enum(['line_step', 'from_line_step']),
        lineStepId: z.string().min(1).max(191),
      })
      .safeParse(body);
    if (!parsed.success) {
      return { badRequest: true, message: '请求体须含 scope（line_step|from_line_step）与 lineStepId' };
    }
    const { scope, lineStepId } = parsed.data;
    const dbTaskIds =
      scope === 'line_step'
        ? designDetailInferenceRevisionDbTaskIdsForLineStep(lineStepId)
        : designDetailInferenceRevisionDbTaskIdsFromLineStepInclusive(lineStepId);
    if (!dbTaskIds.length) {
      return {
        badRequest: true,
        message: 'lineStepId 无对应推理修订审计任务（仅任务 2–10 线步产生审计行）',
      };
    }
    const deleted = await this.repository.deleteDesignDetailInferenceRevisionRecords(id, dbTaskIds);
    return { ok: true, deleted, taskIds: dbTaskIds };
  }

  /**
   * 设计详情重启：重置任务 1 特征「是否确认痛点」。
   * - `line_step`：仅清当前线步确认过的节点（「重启当前」）
   * - `from_line_step`：锚点及之后线步（「选择重启」）
   * - `all`：全案（「完全重启」时 task1 特征仍存在则清零）
   */
  async resetDesignDetailTask1PainPointConfirmed(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; updated: number; lineStepIds?: string[] }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };
    const parsed = z
      .object({
        scope: z.enum(['line_step', 'from_line_step', 'all']),
        lineStepId: z.string().max(191).optional(),
      })
      .safeParse(body);
    if (!parsed.success) {
      return { badRequest: true, message: '请求体须含 scope（line_step|from_line_step|all）' };
    }
    const { scope, lineStepId } = parsed.data;
    const resolved = resolveLineStepIdsForPainPointReset(scope, lineStepId);
    if (resolved !== 'all' && !resolved.length) {
      return { badRequest: true, message: 'lineStepId 无效或 scope 与 lineStepId 不匹配' };
    }
    const updated = await this.repository.resetDesignDetailTask1PainPointConfirmed(
      id,
      resolved === 'all' ? { kind: 'all' } : { kind: 'line_steps', lineStepIds: resolved },
    );
    return {
      ok: true,
      updated,
      ...(resolved !== 'all' ? { lineStepIds: resolved } : {}),
    };
  }

  /** 设计详情：按案例聚合各 `taskId` 下 token / feature / logic（只读，供「逻辑」弹层） */
  async getDesignDetailTaskGraph(
    id: string,
    auth: JwtAuthPayload,
  ): Promise<{ notFound: true } | { ok: true; tasks: DesignDetailTaskGraphTaskDto[] }> {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };
    const tasks = await this.repository.getDesignDetailTaskGraphDetail(id);
    return { ok: true, tasks };
  }

  /**
   * 设计详情 Task1：客户基本信息提炼完成后写入 `DesignDetailTaskToken`（`taskId`=`任务 1：客户基本情况了解`）+ `DesignFeatureNode`（**不写**任务 1 推导用 `DesignLogicLink`）。
   */
  async syncDesignDetailTask1BasicInfoGraph(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    const parsed = syncDesignDetailTask1BasicInfoGraphSchema.safeParse(body);
    if (!parsed.success) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const raw = parsed.data.basicInfo;
    if (raw !== undefined && raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) {
      return { badRequest: true, message: 'basicInfo 须为对象' };
    }
    const basicInfo = raw === undefined || raw === null ? {} : raw;
    try {
      const keys =
        basicInfo && typeof basicInfo === 'object' && !Array.isArray(basicInfo)
          ? Object.keys(basicInfo as object).filter(
              (k) => typeof k === 'string' && k.length > 0 && !k.startsWith('__'),
            )
          : [];
      console.log('[problem-case:task1-basic-graph] syncDesignDetailTask1BasicInfoGraph ingress', {
        caseId: id,
        basicInfoKeyCount: keys.length,
        basicInfoKeysSample: keys.slice(0, 32),
      });
    } catch {
      /* 诊断日志失败不影响主路径 */
    }
    const counts = await this.repository.replaceDesignDetailTask1BasicInfoGraph(id, basicInfo);
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 1：L1 原始实然特征集 `Target_KV`（行级 `Validation_Status` 写入 `DesignFeatureNode.value`）。
   */
  async syncDesignDetailTask1L1OriginalFeatureMatrix(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    let raw = coerceHttpBodyToL1OriginalFeatureRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask1L1OriginalFeatureMatrixSchema.safeParse(body);
      if (!parsed.success) {
        return { badRequest: true, message: '请求体格式无效' };
      }
      const inner = parsed.data.l1OriginalFeatureRaw;
      if (typeof inner === 'string') raw = inner.trim();
      else if (inner != null && typeof inner === 'object') {
        try {
          raw = JSON.stringify(inner);
        } catch {
          return { badRequest: true, message: '请求体格式无效' };
        }
      }
    }
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL1OriginalFeatureInferenceRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask1L1OriginalFeatureTargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      return { badRequest: true, message: rowsParsed.message };
    }
    try {
      console.log('[problem-case:task1-l1-original-feature] sync ingress', {
        caseId: id,
        rowCount: rowsParsed.rows.length,
        pendingCount: rowsParsed.rows.filter((r) => r.validationStatus === 'Pending').length,
      });
    } catch {
      /* 诊断日志失败不影响主路径 */
    }
    const counts = await this.repository.replaceTask1L1OriginalFeatureMatrixGraph(id, rowsParsed.rows);
    return { ok: true, ...counts };
  }

  /**
   * 设计详情 Task1：客户需求提炼 JSON 的某一顶层分域（`businessContext` / `coreBusinessEntities` / `stateTransitionMatrix` / `painPointRadar` / `itLandscape` 等，见 `design-detail-customer-req-section-graph.ts`）→ `DesignDetailTaskToken.taskId` = **「任务 1：客户基本情况了解」** / `DesignFeatureNode`（**不写**段内 `DesignLogicLink`）；仓储层 **合并追加**（同 token 路径 / 同 `featureId` 不重复插入）。
   */
  async syncDesignDetailCustomerReqSectionGraph(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    const parsed = syncDesignDetailCustomerReqSectionGraphSchema.safeParse(body);
    if (!parsed.success) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const sectionKey = parsed.data.sectionKey.trim();
    if (!isAllowedCustomerReqSectionKey(sectionKey)) {
      const allowed = DESIGN_CUSTOMER_REQ_GRAPH_SECTIONS.map((s) => s.key).join(', ');
      return {
        badRequest: true,
        message: `sectionKey 不在允许的分域列表内（当前进程允许：${allowed}）`,
      };
    }
    const raw = parsed.data.requirementParsed;
    if (raw !== undefined && raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) {
      return { badRequest: true, message: 'requirementParsed 须为对象' };
    }
    const requirementParsed = raw === undefined || raw === null ? {} : raw;
    const label =
      DESIGN_CUSTOMER_REQ_GRAPH_SECTIONS.find((s) => s.key === sectionKey)?.label ?? sectionKey;
    const counts = await this.repository.replaceCustomerRequirementSectionGraph(
      id,
      sectionKey,
      label,
      requirementParsed,
    );
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 2 L1：从模型原始 JSON 解析 `L1_Inference_Matrix.Target_KV`，写 **`DesignDetailTaskToken`**（每行 `Feature_Key`；`taskId` = **`DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID`**（现用「任务 2：规模与组织模式推理」），与任务 1 落库体系统一）并各写一条 **`DesignFeatureNode`**；对 **`Evidence_Support_Chain`** 写 **`DesignLogicLink`**；GET 聚合卡片 `taskId` 仍为线步 **`scale_org_mode_extract`**。
   */
  async syncDesignDetailTask2L1TargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    const parsed = syncDesignDetailTask2L1TargetKvTokensSchema.safeParse(body);
    if (!parsed.success) {
      try {
        console.warn('[problem-case:task2-l1-target-kv]', {
          caseId: id,
          phase: 'body_schema',
          issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code, message: i.message })),
        });
      } catch {
        /* ignore */
      }
      return { badRequest: true, message: '请求体格式无效' };
    }
    const raw = String(parsed.data.l1InferenceRaw || '').trim();
    const rowsParsed = parseTask2L1TargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      try {
        console.warn('[problem-case:task2-l1-target-kv]', {
          caseId: id,
          phase: 'parse_target_kv',
          message: rowsParsed.message,
          rawLength: raw.length,
          rawHead: raw.slice(0, 200),
        });
      } catch {
        /* ignore */
      }
      return { badRequest: true, message: rowsParsed.message };
    }
    let tvPlans = parseTokenValidationMappingFromL1Raw(raw);
    tvPlans = await this.mergeTvPlansWithPainPointConfirmedImmunity(id, tvPlans, 'task2-l1-target-kv');
    const alignmentMetaT2 = pickTargetKvSyncAlignmentMeta(parsed.data);
    try {
      const rowKeys = rowsParsed.rows.map((r) => r.featureKey);
      const rawHasTvKey = /Token_Validation_Mapping/i.test(raw);
      console.warn('[problem-case:task2-l1-target-kv]', {
        phase: 'token_validation_parse',
        caseId: id,
        parsedMappingCount: tvPlans.length,
        targetKvFeatureKeys: rowKeys,
        mappedL1Distinct: [...new Set(tvPlans.map((p) => p.mappedL1FeatureKey))],
        targetFeatureIdSample: tvPlans.slice(0, 5).map((p) => p.targetFeatureId),
        rawHasTvKey,
        rawLength: raw.length,
      });
      if (rawHasTvKey && tvPlans.length === 0) {
        console.warn('[problem-case:task2-l1-target-kv]', {
          phase: 'token_validation_parse_zero',
          caseId: id,
          hint:
            '原文含 Token_Validation_Mapping 字样但解析条数为 0：请检查 JSON 是否合法、数组是否在 L1_Inference_Matrix 内或与根键同级（已支持根级兜底）；或键名/类型非数组。',
        });
      }
    } catch {
      /* ignore */
    }
    try {
      const plannedEdges = rowsParsed.rows.reduce((s, r) => s + (r.evidenceLinks?.length ?? 0), 0);
      console.warn('[problem-case:task2-l1-target-kv]', {
        caseId: id,
        phase: 'parsed_rows',
        rowCount: rowsParsed.rows.length,
        plannedLogicEdges: plannedEdges,
        tokenValidationMappingCount: tvPlans.length,
        perRow: rowsParsed.rows.map((r) => ({
          featureKey: r.featureKey,
          evidenceLinkPlanCount: r.evidenceLinks?.length ?? 0,
        })),
      });
    } catch {
      /* ignore */
    }
    const beforeFeatures = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK2_L1_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask2L1TargetKvFeatureKeyTokens(id, rowsParsed.rows, tvPlans);
    await this.markTask1PainPointConfirmedAfterAlignmentSync(id, alignmentMetaT2);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT2);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK2_L1_TOKEN_DB_TASK_IDS,
      raw,
      'L1',
      tvPlans,
      beforeFeatures,
      alignmentMetaT2,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task2-l1-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 3 L2：从模型原始 JSON 解析 **`L2_Business_Inference_Matrix` / `L2_Inference_Matrix`** 内 `Target_KV`，写 **`DesignDetailTaskToken`**（`taskId` = **`DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID`**）及特征与逻辑边。
   */
  async syncDesignDetailTask3L2TargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    const parsed = syncDesignDetailTask3L2TargetKvTokensSchema.safeParse(body);
    if (!parsed.success) {
      try {
        console.warn('[problem-case:task3-l2-target-kv]', {
          caseId: id,
          phase: 'body_schema',
          issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code, message: i.message })),
        });
      } catch {
        /* ignore */
      }
      return { badRequest: true, message: '请求体格式无效' };
    }
    let raw = String(parsed.data.l2InferenceRaw || '').trim();
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL2BusinessInferenceRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask3L2TargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      try {
        console.warn('[problem-case:task3-l2-target-kv]', {
          caseId: id,
          phase: 'parse_target_kv',
          message: rowsParsed.message,
          rawLength: raw.length,
          rawHead: raw.slice(0, 200),
        });
      } catch {
        /* ignore */
      }
      return { badRequest: true, message: rowsParsed.message };
    }
    let tvPlans = parseTokenValidationMappingFromL2InferenceRaw(raw);
    try {
      const graphTasks = await this.repository.getDesignDetailTaskGraphDetail(id);
      const upstream = buildTask2UpstreamConsistencyForTask3Immunity(graphTasks);
      if (upstream.size) {
        tvPlans = mergeTokenValidationPlansWithUpstreamImmunity(tvPlans, upstream);
      }
    } catch (immErr) {
      console.warn('[problem-case:task3-l2-target-kv]', {
        phase: 'upstream_immunity_failed',
        caseId: id,
        message: immErr instanceof Error ? immErr.message : String(immErr),
      });
    }
    tvPlans = await this.mergeTvPlansWithPainPointConfirmedImmunity(id, tvPlans, 'task3-l2-target-kv');
    const alignmentMetaT3 = pickTargetKvSyncAlignmentMeta(parsed.data);
    try {
      const rowKeys = rowsParsed.rows.map((r) => r.featureKey);
      const rawHasTvKey = /Token_Validation_Mapping/i.test(raw);
      console.warn('[problem-case:task3-l2-target-kv]', {
        phase: 'token_validation_parse',
        caseId: id,
        parsedMappingCount: tvPlans.length,
        targetKvFeatureKeys: rowKeys,
        mappedL2Distinct: [...new Set(tvPlans.map((p) => p.mappedL1FeatureKey))],
        targetFeatureIdSample: tvPlans.slice(0, 5).map((p) => p.targetFeatureId),
        rawHasTvKey,
        rawLength: raw.length,
      });
      if (rawHasTvKey && tvPlans.length === 0) {
        console.warn('[problem-case:task3-l2-target-kv]', {
          phase: 'token_validation_parse_zero',
          caseId: id,
          hint:
            '原文含 Token_Validation_Mapping 字样但解析条数为 0：请检查 JSON 是否合法、数组是否在 L2_Business_Inference_Matrix / L2_Inference_Matrix 内或与根键同级（已支持根级兜底）；或键名/类型非数组、Mapped_L2_Feature 无法归一。',
        });
      }
    } catch {
      /* ignore */
    }
    const beforeFeaturesT3 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK3_L2_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask3L2TargetKvFeatureKeyTokens(id, rowsParsed.rows, tvPlans);
    await this.markTask1PainPointConfirmedAfterAlignmentSync(id, alignmentMetaT3);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT3);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK3_L2_TOKEN_DB_TASK_IDS,
      raw,
      'L2_BUSINESS',
      tvPlans,
      beforeFeaturesT3,
      alignmentMetaT3,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task3-l2-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 4 L2：从模型原始 JSON 解析 `L2_Value_Inference_Matrix.Target_KV`，写 **`DesignDetailTaskToken`**（`taskId` = **`DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID`**）及特征与逻辑边。
   */
  async syncDesignDetailTask4L2TargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    let raw = coerceHttpBodyToL2ValueInferenceRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask4L2TargetKvTokensSchema.safeParse(body);
      if (!parsed.success) {
        try {
          console.warn('[problem-case:task4-l2-target-kv]', {
            caseId: id,
            phase: 'body_schema',
            issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code, message: i.message })),
          });
        } catch {
          /* ignore */
        }
        return { badRequest: true, message: '请求体格式无效' };
      }
      raw = String(parsed.data.l2ValueInferenceRaw || '').trim();
    }
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL2ValueInferenceRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask4L2TargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      try {
        console.warn('[problem-case:task4-l2-target-kv]', {
          caseId: id,
          phase: 'parse_target_kv',
          message: rowsParsed.message,
          rawLength: raw.length,
          rawHead: raw.slice(0, 200),
        });
      } catch {
        /* ignore */
      }
      return { badRequest: true, message: rowsParsed.message };
    }
    let tvPlans = parseTokenValidationMappingFromL2ValueInferenceRaw(raw);
    try {
      const graphTasks = await this.repository.getDesignDetailTaskGraphDetail(id);
      const upstream = buildTask2Task3UpstreamConsistencyForTask4Immunity(graphTasks);
      if (upstream.size) {
        tvPlans = mergeTokenValidationPlansWithUpstreamImmunity(tvPlans, upstream);
      }
    } catch (immErr) {
      console.warn('[problem-case:task4-l2-target-kv]', {
        phase: 'upstream_immunity_failed',
        caseId: id,
        message: immErr instanceof Error ? immErr.message : String(immErr),
      });
    }
    tvPlans = await this.mergeTvPlansWithPainPointConfirmedImmunity(id, tvPlans, 'task4-l2-target-kv');
    const alignmentMetaT4 = pickTargetKvSyncAlignmentMetaFromBody(body);
    try {
      const rowKeys = rowsParsed.rows.map((r) => r.featureKey);
      const rawHasTvKey = /Token_Validation_Mapping/i.test(raw);
      console.warn('[problem-case:task4-l2-target-kv]', {
        phase: 'token_validation_parse',
        caseId: id,
        parsedMappingCount: tvPlans.length,
        targetKvFeatureKeys: rowKeys,
        mappedL2Distinct: [...new Set(tvPlans.map((p) => p.mappedL1FeatureKey))],
        targetFeatureIdSample: tvPlans.slice(0, 5).map((p) => p.targetFeatureId),
        rawHasTvKey,
        rawLength: raw.length,
      });
      if (rawHasTvKey && tvPlans.length === 0) {
        console.warn('[problem-case:task4-l2-target-kv]', {
          phase: 'token_validation_parse_zero',
          caseId: id,
          hint:
            '原文含 Token_Validation_Mapping 字样但解析条数为 0：请检查 JSON 是否合法、数组是否在 L3_Process_Inference_Matrix / L2_Value_Inference_Matrix 内或与根键同级；或 Mapped_L3_Feature 无法归一。',
        });
      }
    } catch {
      /* ignore */
    }
    const beforeFeaturesT4 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK4_L2_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask4L2TargetKvFeatureKeyTokens(id, rowsParsed.rows, tvPlans);
    await this.markTask1PainPointConfirmedAfterAlignmentSync(id, alignmentMetaT4);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT4);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK4_L2_TOKEN_DB_TASK_IDS,
      raw,
      'L2_VALUE',
      tvPlans,
      beforeFeaturesT4,
      alignmentMetaT4,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task4-l2-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 5 L3：从模型原始 JSON 解析 `L3_Process_Inference_Matrix.Target_KV`，写任务 5 推理图。
   */
  async syncDesignDetailTask5L3TargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    let raw = coerceHttpBodyToL3ProcessInferenceRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask5L3TargetKvTokensSchema.safeParse(body);
      if (!parsed.success) {
        return { badRequest: true, message: '请求体格式无效' };
      }
      raw = String(parsed.data.l3ProcessInferenceRaw || '').trim();
    }
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL3ProcessInferenceRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask5L3TargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      return { badRequest: true, message: rowsParsed.message };
    }
    const tvPlansAll = parseTokenValidationMappingFromL3ProcessInferenceRaw(raw);
    const tvPlans = tvPlansAll.filter((p) =>
      isTask5L3TargetKvSyncableFeatureKey(String(p.mappedL1FeatureKey || '')),
    );
    const beforeFeaturesT5 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK5_L3_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask5L3TargetKvFeatureKeyTokens(id, rowsParsed.rows, tvPlans);
    const alignmentMetaT5 = pickTargetKvSyncAlignmentMetaFromBody(body);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT5);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK5_L3_TOKEN_DB_TASK_IDS,
      raw,
      'L3',
      tvPlans,
      beforeFeaturesT5,
      alignmentMetaT5,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task5-l3-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 5.1 L3.1：解析战略价值主张与业务能力单元并写入任务 5.1 推理图。
   */
  async syncDesignDetailTask51L3ValuePropositionTargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    let raw = coerceHttpBodyToL3ProcessInferenceRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask5L3TargetKvTokensSchema.safeParse(body);
      if (!parsed.success) {
        return { badRequest: true, message: '请求体格式无效' };
      }
      raw = String(parsed.data.l3ProcessInferenceRaw || '').trim();
    }
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL51ValuePropositionRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask51L3TargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      return { badRequest: true, message: rowsParsed.message };
    }
    const tvPlansAll = parseTokenValidationMappingFromL51ValuePropositionRaw(raw);
    const tvPlans = tvPlansAll.filter((p) =>
      isTask51L3TargetKvSyncableFeatureKey(String(p.mappedL1FeatureKey || '')),
    );
    const beforeFeaturesT51 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK51_L3_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask5L3TargetKvFeatureKeyTokens(
      id,
      rowsParsed.rows,
      tvPlans,
      {
        graphTaskId: DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID,
        tokenDbTaskIds: DESIGN_DETAIL_TASK51_L3_TOKEN_DB_TASK_IDS,
      },
    );
    const alignmentMetaT51 = pickTargetKvSyncAlignmentMetaFromBody(body);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT51);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK51_L3_TOKEN_DB_TASK_IDS,
      raw,
      'L3',
      tvPlans,
      beforeFeaturesT51,
      alignmentMetaT51,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task51-l3-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 5.2 L3.2：解析业务能力字段集层次映射并写入任务 5.2 推理图。
   */
  async syncDesignDetailTask52L3AssetFieldSetTargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    let raw = coerceHttpBodyToL3ProcessInferenceRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask5L3TargetKvTokensSchema.safeParse(body);
      if (!parsed.success) {
        return { badRequest: true, message: '请求体格式无效' };
      }
      raw = String(parsed.data.l3ProcessInferenceRaw || '').trim();
    }
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL52AssetMappingRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask52L3TargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      return { badRequest: true, message: rowsParsed.message };
    }
    const tvPlansAll = parseTokenValidationMappingFromL52AssetMappingRaw(raw);
    const tvPlans = tvPlansAll.filter(
      (p) => normalizeTask52L3MappedFeatureKey(p.mappedL1FeatureKey) != null,
    );
    const beforeFeaturesT52 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK52_L3_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask5L3TargetKvFeatureKeyTokens(
      id,
      rowsParsed.rows,
      tvPlans,
      {
        graphTaskId: DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID,
        tokenDbTaskIds: DESIGN_DETAIL_TASK52_L3_TOKEN_DB_TASK_IDS,
      },
    );
    const alignmentMetaT52 = pickTargetKvSyncAlignmentMetaFromBody(body);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT52);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK52_L3_TOKEN_DB_TASK_IDS,
      raw,
      'L3',
      tvPlans,
      beforeFeaturesT52,
      alignmentMetaT52,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task52-l3-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 5.3 L3.3：解析关键场景时序流转并写入任务 5.3 推理图。
   */
  async syncDesignDetailTask53L3WorkflowFlowTargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    let raw = coerceHttpBodyToL3ProcessInferenceRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask5L3TargetKvTokensSchema.safeParse(body);
      if (!parsed.success) {
        return { badRequest: true, message: '请求体格式无效' };
      }
      raw = String(parsed.data.l3ProcessInferenceRaw || '').trim();
    }
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL53WorkflowFlowRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask53L3TargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      return { badRequest: true, message: rowsParsed.message };
    }
    const tvPlansAll = parseTokenValidationMappingFromL53WorkflowFlowRaw(raw);
    const tvPlans = tvPlansAll.filter(
      (p) => normalizeTask53L3MappedFeatureKey(p.mappedL1FeatureKey) != null,
    );
    const beforeFeaturesT53 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK53_L3_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask5L3TargetKvFeatureKeyTokens(
      id,
      rowsParsed.rows,
      tvPlans,
      {
        graphTaskId: DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID,
        tokenDbTaskIds: DESIGN_DETAIL_TASK53_L3_TOKEN_DB_TASK_IDS,
      },
    );
    const alignmentMetaT53 = pickTargetKvSyncAlignmentMetaFromBody(body);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT53);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK53_L3_TOKEN_DB_TASK_IDS,
      raw,
      'L3',
      tvPlans,
      beforeFeaturesT53,
      alignmentMetaT53,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task53-l3-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 5.5 L3.5：解析 `价值流阶段_*` 原子 VSM 节点并写入任务 5.5 推理图（以任务 5 宏观特征为硬约束，由前端 Input 1 保证）。
   */
  async syncDesignDetailTask55L3VsmTargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    let raw = coerceHttpBodyToL3ProcessInferenceRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask5L3TargetKvTokensSchema.safeParse(body);
      if (!parsed.success) {
        return { badRequest: true, message: '请求体格式无效' };
      }
      raw = String(parsed.data.l3ProcessInferenceRaw || '').trim();
    }
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL3Vsm55InferenceRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask5L5VsmTargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      return { badRequest: true, message: rowsParsed.message };
    }
    const tvPlansAll = parseTokenValidationMappingFromL35VsmInferenceRaw(raw);
    const tvPlans = tvPlansAll.filter((p) => String(p.mappedL1FeatureKey || '') === '价值流阶段');
    const beforeFeaturesT55 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK55_L3_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask5L3TargetKvFeatureKeyTokens(
      id,
      rowsParsed.rows,
      tvPlans,
      {
        graphTaskId: DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID,
        tokenDbTaskIds: DESIGN_DETAIL_TASK55_L3_TOKEN_DB_TASK_IDS,
      },
    );
    const alignmentMetaT55 = pickTargetKvSyncAlignmentMetaFromBody(body);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT55);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK55_L3_TOKEN_DB_TASK_IDS,
      raw,
      'L3',
      tvPlans,
      beforeFeaturesT55,
      alignmentMetaT55,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task55-l3-vsm-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 6 L3：解析 `关键场景_*` 与 Extended_Features，写入任务 6 推理图。
   */
  async syncDesignDetailTask6L3ScenarioTargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    let raw = coerceHttpBodyToL3ProcessInferenceRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask5L3TargetKvTokensSchema.safeParse(body);
      if (!parsed.success) {
        return { badRequest: true, message: '请求体格式无效' };
      }
      raw = String(parsed.data.l3ProcessInferenceRaw || '').trim();
    }
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL6ScenarioInferenceRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask6L3ScenarioTargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      return { badRequest: true, message: rowsParsed.message };
    }
    const tvPlansAll = parseTokenValidationMappingFromL6ScenarioInferenceRaw(raw);
    const tvPlans = tvPlansAll.filter((p) => String(p.mappedL1FeatureKey || '') === '关键场景');
    const beforeFeaturesT6 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK6_L3_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask5L3TargetKvFeatureKeyTokens(
      id,
      rowsParsed.rows,
      tvPlans,
      {
        graphTaskId: DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID,
        tokenDbTaskIds: DESIGN_DETAIL_TASK6_L3_TOKEN_DB_TASK_IDS,
      },
    );
    const alignmentMetaT6 = pickTargetKvSyncAlignmentMetaFromBody(body);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT6);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK6_L3_TOKEN_DB_TASK_IDS,
      raw,
      'L3',
      tvPlans,
      beforeFeaturesT6,
      alignmentMetaT6,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task6-l3-scenario-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 6.5 L3：解析 `流程优化Gap方案`，写入任务 6.5 推理图。
   */
  async syncDesignDetailTask65L3ItGapTargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    let raw = coerceHttpBodyToL3ProcessInferenceRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask5L3TargetKvTokensSchema.safeParse(body);
      if (!parsed.success) {
        return { badRequest: true, message: '请求体格式无效' };
      }
      raw = String(parsed.data.l3ProcessInferenceRaw || '').trim();
    }
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL65ItGapInferenceRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask65L3ItGapTargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      return { badRequest: true, message: rowsParsed.message };
    }
    const tvPlansAll = parseTokenValidationMappingFromL65ItGapInferenceRaw(raw);
    const tvPlansLegacy = tvPlansAll.filter(
      (p) =>
        normalizeTask65L3MappedFeatureKey(p.mappedL1FeatureKey) === '流程优化Gap方案' ||
        String(p.mappedL1FeatureKey || '').trim() === '流程优化Gap方案',
    );
    const tvPlans = expandTask65L3TokenValidationPlans(rowsParsed.rows, tvPlansLegacy);
    const beforeFeaturesT65 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK65_L3_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask5L3TargetKvFeatureKeyTokens(
      id,
      rowsParsed.rows,
      tvPlans,
      {
        graphTaskId: DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID,
        tokenDbTaskIds: DESIGN_DETAIL_TASK65_L3_TOKEN_DB_TASK_IDS,
      },
    );
    const alignmentMetaT65 = pickTargetKvSyncAlignmentMetaFromBody(body);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT65);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK65_L3_TOKEN_DB_TASK_IDS,
      raw,
      'L3',
      tvPlans,
      beforeFeaturesT65,
      alignmentMetaT65,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task65-l3-it-gap-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 7 L4：解析 `所属业务流程` / `协作节点`，写入任务 7 推理图。
   */
  async syncDesignDetailTask7L4CollaborationTargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    let raw = coerceHttpBodyToL3ProcessInferenceRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask5L3TargetKvTokensSchema.safeParse(body);
      if (!parsed.success) {
        return { badRequest: true, message: '请求体格式无效' };
      }
      raw = String(parsed.data.l3ProcessInferenceRaw || '').trim();
    }
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL4CollaborationInferenceRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask7L4CollaborationTargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      return { badRequest: true, message: rowsParsed.message };
    }
    const tvPlansAll = parseTokenValidationMappingFromL7CollaborationInferenceRaw(raw);
    const tvPlansLegacy = tvPlansAll.filter((p) =>
      isTask7L4CollaborationFeatureKey(String(p.mappedL1FeatureKey || '')),
    );
    const tvPlans = expandTask7L4TokenValidationPlans(rowsParsed.rows, tvPlansLegacy);
    const beforeFeaturesT7 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK7_L4_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask5L3TargetKvFeatureKeyTokens(
      id,
      rowsParsed.rows,
      tvPlans,
      {
        graphTaskId: DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID,
        tokenDbTaskIds: DESIGN_DETAIL_TASK7_L4_TOKEN_DB_TASK_IDS,
      },
    );
    const alignmentMetaT7 = pickTargetKvSyncAlignmentMetaFromBody(body);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT7);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK7_L4_TOKEN_DB_TASK_IDS,
      raw,
      'L3',
      tvPlans,
      beforeFeaturesT7,
      alignmentMetaT7,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task7-l4-collaboration-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 0：将工具箱「特征」视图原语写入推理图（服务端分配 `ft_`+12 位与 `tk_task0_{caseCompact}_{nnnnnn}`）。
   */
  async syncDesignDetailTask0ToolboxPrimitives(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | {
        ok: true;
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
      }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };
    const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    const rawList = b.primitives;
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return { badRequest: true, message: '请求体须含非空 primitives 数组' };
    }
    const primitives = rawList
      .map((row) => {
        const r = row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
        return {
          featureKey: String(r.featureKey ?? '').trim(),
          tokenDisplay: String(r.tokenDisplay ?? '').trim(),
          toolName: String(r.toolName ?? '').trim(),
          value: String(r.value ?? '').trim(),
          operator: String(r.operator ?? '工具原语').trim() || '工具原语',
        };
      })
      .filter((p) => p.featureKey && p.value);
    try {
      console.warn('[problem-case:task0-toolbox-primitives]', {
        phase: 'ingress',
        caseId: id,
        primitiveIn: rawList.length,
        primitiveValid: primitives.length,
        ownerSubjectId: auth?.userId,
      });
    } catch {
      /* ignore */
    }
    if (!primitives.length) {
      return { badRequest: true, message: 'primitives 内无有效条目（须含 featureKey、value）' };
    }
    const counts = await this.repository.replaceTask0ToolboxPrimitiveFeatures(id, primitives);
    try {
      console.warn('[problem-case:task0-toolbox-primitives]', {
        phase: 'replace_done',
        caseId: id,
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
        sampleTokenIds: counts.features?.slice(0, 3).map((f) => f.tokenDisplay),
        sampleFeatureIds: counts.features?.slice(0, 3).map((f) => f.featureId),
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 8 L4.5：解析 `操作角色` / `单据对象` / `状态转移矩阵`，写入任务 8 推理图。
   */
  async syncDesignDetailTask8L45PrototypeTargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    let raw = coerceHttpBodyToL3ProcessInferenceRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask5L3TargetKvTokensSchema.safeParse(body);
      if (!parsed.success) {
        return { badRequest: true, message: '请求体格式无效' };
      }
      raw = String(parsed.data.l3ProcessInferenceRaw || '').trim();
    }
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL4PrototypeInferenceRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask8L45PrototypeTargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      return { badRequest: true, message: rowsParsed.message };
    }
    const tvPlansAll = parseTokenValidationMappingFromL8PrototypeInferenceRaw(raw);
    const tvPlans = tvPlansAll.filter((p) =>
      isTask8L45PrototypeFeatureKey(String(p.mappedL1FeatureKey || '')),
    );
    const beforeFeaturesT8 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK8_L45_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask5L3TargetKvFeatureKeyTokens(
      id,
      rowsParsed.rows,
      tvPlans,
      {
        graphTaskId: DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID,
        tokenDbTaskIds: DESIGN_DETAIL_TASK8_L45_TOKEN_DB_TASK_IDS,
      },
    );
    const alignmentMetaT8 = pickTargetKvSyncAlignmentMetaFromBody(body);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT8);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK8_L45_TOKEN_DB_TASK_IDS,
      raw,
      'L3',
      tvPlans,
      beforeFeaturesT8,
      alignmentMetaT8,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task8-l45-prototype-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 8.5 L4.75：解析 `物理外挂Hook` / `微观连接器绑定` / `工具方案裁决`，写入任务 8.5 推理图。
   */
  async syncDesignDetailTask85L475PhysicalHookTargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    const logTask85 = (phase: string, extra?: Record<string, unknown>) => {
      try {
        console.warn('[problem-case:task85-l475-physical-hook-target-kv]', {
          caseId: id,
          parserRev: '20260527-l47-three-keys',
          phase,
          ...extra,
        });
      } catch {
        /* ignore */
      }
    };

    logTask85('ingress', {
      bodyType: body === null || body === undefined ? 'nullish' : typeof body,
      bodyTopKeys:
        body && typeof body === 'object' && !Array.isArray(body)
          ? Object.keys(body as Record<string, unknown>).slice(0, 24)
          : [],
    });

    let raw = coerceHttpBodyToL3ProcessInferenceRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask5L3TargetKvTokensSchema.safeParse(body);
      if (!parsed.success) {
        logTask85('bad_request_invalid_body_schema');
        return { badRequest: true, message: '请求体格式无效' };
      }
      raw = String(parsed.data.l3ProcessInferenceRaw || '').trim();
    }
    if (!raw) {
      logTask85('bad_request_empty_raw');
      return { badRequest: true, message: '请求体格式无效' };
    }

    logTask85('raw_received', { rawLengthChars: raw.length });

    const normRaw = normalizeL475PhysicalHookInferenceRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
      logTask85('normalize_ok', { normalizedLengthChars: raw.length });
    } else {
      logTask85('normalize_skipped_or_failed', {
        normalizeMessage: normRaw.message,
        diagnostics: buildTask85PhysicalHookParseFailureDiagnostics(raw),
      });
    }

    const rowsParsed = parseTask85L475PhysicalHookTargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      logTask85('parse_failed', {
        parseMessage: rowsParsed.message,
        diagnostics: buildTask85PhysicalHookParseFailureDiagnostics(raw),
      });
      return { badRequest: true, message: rowsParsed.message };
    }

    logTask85('parse_ok', { rowCount: rowsParsed.rows.length });
    const tvPlansAll = parseTokenValidationMappingFromL85PhysicalHookInferenceRaw(raw);
    const tvPlans = tvPlansAll.filter((p) =>
      isTask85L475PhysicalHookFeatureKey(String(p.mappedL1FeatureKey || '')),
    );
    const beforeFeaturesT85 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK85_L475_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask5L3TargetKvFeatureKeyTokens(
      id,
      rowsParsed.rows,
      tvPlans,
      {
        graphTaskId: DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID,
        tokenDbTaskIds: DESIGN_DETAIL_TASK85_L475_TOKEN_DB_TASK_IDS,
      },
    );
    const alignmentMetaT85 = pickTargetKvSyncAlignmentMetaFromBody(body);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT85);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK85_L475_TOKEN_DB_TASK_IDS,
      raw,
      'L3',
      tvPlans,
      beforeFeaturesT85,
      alignmentMetaT85,
      rowsParsed.rows,
    );
    logTask85('replace_done', {
      tokenCount: counts.tokenCount,
      featureCount: counts.featureCount,
      linkCount: counts.linkCount,
    });
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 9 L5：解析 `系统一级模块`（含 `Tech_Host_Platform`），写入任务 9 推理图。
   */
  async syncDesignDetailTask9L5BlueprintTargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    let raw = coerceHttpBodyToL3ProcessInferenceRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask5L3TargetKvTokensSchema.safeParse(body);
      if (!parsed.success) {
        return { badRequest: true, message: '请求体格式无效' };
      }
      raw = String(parsed.data.l3ProcessInferenceRaw || '').trim();
    }
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL5BlueprintInferenceRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask9L5BlueprintTargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      return { badRequest: true, message: rowsParsed.message };
    }
    const tvPlansAll = parseTokenValidationMappingFromL9BlueprintInferenceRaw(raw);
    const tvPlans = tvPlansAll.filter((p) => String(p.mappedL1FeatureKey || '') === '系统一级模块');
    const beforeFeaturesT9 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK9_L5_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask5L3TargetKvFeatureKeyTokens(
      id,
      rowsParsed.rows,
      tvPlans,
      {
        graphTaskId: DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID,
        tokenDbTaskIds: DESIGN_DETAIL_TASK9_L5_TOKEN_DB_TASK_IDS,
      },
    );
    const alignmentMetaT9 = pickTargetKvSyncAlignmentMetaFromBody(body);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT9);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK9_L5_TOKEN_DB_TASK_IDS,
      raw,
      'L3',
      tvPlans,
      beforeFeaturesT9,
      alignmentMetaT9,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task9-l5-blueprint-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 10 L5：解析 `物理表结构Schema` / `基础表初始化`（兼容历史 `权限字典初始化SQL`），写入任务 10 推理图。
   */
  async syncDesignDetailTask10L5TechnicalDdlTargetKvTokens(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };

    let raw = coerceHttpBodyToL3ProcessInferenceRawString(body)?.trim() ?? '';
    if (!raw) {
      const parsed = syncDesignDetailTask5L3TargetKvTokensSchema.safeParse(body);
      if (!parsed.success) {
        return { badRequest: true, message: '请求体格式无效' };
      }
      raw = String(parsed.data.l3ProcessInferenceRaw || '').trim();
    }
    if (!raw) {
      return { badRequest: true, message: '请求体格式无效' };
    }
    const normRaw = normalizeL5TechnicalDdlInferenceRawForServerSync(raw);
    if (normRaw.ok) {
      raw = normRaw.normalized;
    }
    const rowsParsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    if (!rowsParsed.ok) {
      return { badRequest: true, message: rowsParsed.message };
    }
    const beforeFeaturesT10 = await this.loadGraphFeaturesBeforeTargetKvSync(
      id,
      DESIGN_DETAIL_TASK10_L5_TOKEN_DB_TASK_IDS,
    );
    const counts = await this.repository.replaceTask5L3TargetKvFeatureKeyTokens(
      id,
      rowsParsed.rows,
      [],
      {
        graphTaskId: DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID,
        tokenDbTaskIds: DESIGN_DETAIL_TASK10_L5_TOKEN_DB_TASK_IDS,
      },
    );
    const alignmentMetaT10 = pickTargetKvSyncAlignmentMetaFromBody(body);
    await this.markTask1ValidationResolvedAfterAlignmentSync(id, alignmentMetaT10);
    await this.persistInferenceRevisionAfterTargetKvSync(
      id,
      DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK10_L5_TOKEN_DB_TASK_IDS,
      raw,
      'L3',
      [],
      beforeFeaturesT10,
      alignmentMetaT10,
      rowsParsed.rows,
    );
    try {
      console.warn('[problem-case:task10-l5-technical-ddl-target-kv]', {
        caseId: id,
        phase: 'replace_done',
        tokenCount: counts.tokenCount,
        featureCount: counts.featureCount,
        linkCount: counts.linkCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, ...counts };
  }

  /**
   * 设计详情任务 2 L1：**推理图同步**别名接口（与 `sync-task2-l1-target-kv-tokens` 同落库逻辑）。
   * 请求体可省略 `l1InferenceRaw`：若根上直接带 `L1_Inference_Matrix`，会先 `coerceHttpBodyToL1InferenceRawString` 再写入 token。
   * 解析/校验失败时对客户端统一返回 **`Target_KV 为空或无法解析`**（细节见控制台 `[problem-case:task2-l1-inference-graph]`）。
   */
  async syncDesignDetailTask2L1InferenceGraph(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    | { notFound: true }
    | { badRequest: true; message: string }
    | { ok: true; tokenCount: number; featureCount: number; linkCount: number }
  > {
    const coerced = coerceHttpBodyToL1InferenceRawString(body);
    if (coerced === null) {
      try {
        const keys =
          body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body as object) : [];
        console.warn('[problem-case:task2-l1-inference-graph]', {
          caseId: id,
          phase: 'coerce_body',
          bodyTopKeys: keys.slice(0, 24),
        });
      } catch {
        /* ignore */
      }
      return { badRequest: true, message: TASK2_L1_INFERENCE_GRAPH_BAD_MESSAGE };
    }
    const inner = await this.syncDesignDetailTask2L1TargetKvTokens(id, { l1InferenceRaw: coerced }, auth);
    if ('badRequest' in inner && inner.badRequest) {
      try {
        console.warn('[problem-case:task2-l1-inference-graph]', {
          caseId: id,
          phase: 'inner_target_kv',
          innerMessage: inner.message,
          rawLength: coerced.length,
          rawHead: coerced.slice(0, 200),
        });
      } catch {
        /* ignore */
      }
      return { badRequest: true, message: TASK2_L1_INFERENCE_GRAPH_BAD_MESSAGE };
    }
    return inner;
  }

  /** 列表 + 聚合指标（当前案例全部调用；items 新在前） */
  async getCaseLlmLogsWithSummary(
    id: string,
    auth: JwtAuthPayload,
  ): Promise<
    | null
    | {
        summary: {
          callCount: number;
          inputTokens: number;
          outputTokens: number;
          durationMs: number;
        };
        items: CaseLlmLogListRow[];
      }
  > {
    const item = await this.getById(id, auth);
    if (!item) return null;
    const items = await this.repository.listCaseLlmLogsForCase(id);
    const summary = {
      callCount: items.length,
      inputTokens: items.reduce((s, r) => s + (r.inputTokens ?? 0), 0),
      outputTokens: items.reduce((s, r) => s + (r.outputTokens ?? 0), 0),
      durationMs: items.reduce((s, r) => s + r.durationMs, 0),
    };
    return { summary, items };
  }

  async appendCaseLlmLog(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<{ notFound: true } | { badRequest: true; message: string } | { ok: true }> {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };
    const parsed = appendCaseLlmLogSchema.safeParse(body);
    if (!parsed.success) {
      return { badRequest: true, message: parsed.error.issues[0]?.message || '请求体格式无效' };
    }
    const row: CaseLlmLogAppendInput = {
      taskId: parsed.data.taskId,
      callTarget: parsed.data.callTarget,
      inputPrompt: parsed.data.inputPrompt,
      inputTokens: parsed.data.inputTokens ?? null,
      outputContent: parsed.data.outputContent,
      outputTokens: parsed.data.outputTokens ?? null,
      durationMs: parsed.data.durationMs,
      model: parsed.data.model ?? null,
    };
    await this.repository.appendCaseLlmLog(id, row);
    return { ok: true };
  }

  async clearCaseLlmLogsForTasks(
    id: string,
    body: unknown,
    auth: JwtAuthPayload,
  ): Promise<
    { notFound: true } | { badRequest: true; message: string } | { ok: true; deleted: number }
  > {
    const item = await this.getById(id, auth);
    if (!item) return { notFound: true };
    const parsed = clearCaseLlmLogsSchema.safeParse(body);
    if (!parsed.success) {
      return { badRequest: true, message: parsed.error.issues[0]?.message || '请求体格式无效' };
    }
    let deleted: number;
    if ('all' in parsed.data && parsed.data.all) {
      deleted = await this.repository.deleteAllCaseLlmLogs(id);
    } else {
      const taskIds = 'taskIds' in parsed.data ? parsed.data.taskIds : [];
      deleted = await this.repository.deleteCaseLlmLogsByTaskIds(id, taskIds);
    }
    const distinctIds =
      'taskIds' in parsed.data
        ? [...new Set(parsed.data.taskIds.map((t) => String(t || '').trim()).filter(Boolean))]
        : [];
    console.info('[problem-case:llm-logs-clear]', {
      caseId: id,
      mode: 'all' in parsed.data && parsed.data.all ? 'all' : 'taskIds',
      requestedDistinctTaskIds: distinctIds.length,
      deletedRows: deleted,
      taskIdSample: distinctIds.slice(0, 8),
    });
    return { ok: true, deleted };
  }

  /**
   * `/api/ai/chat` 成功返回前调用：须已校验案例归属（getById）。
   * 失败仅打日志，不影响 chat 响应。
   */
  async recordCaseLlmFromAiChat(
    auth: JwtAuthPayload,
    params: {
      caseId: string;
      taskId: string;
      callTarget: string;
      messages: Array<{ role: string; content: string }>;
      outputContent: string;
      usage: { prompt_tokens?: number; completion_tokens?: number };
      durationMs: number;
      model: string;
    },
  ): Promise<void> {
    try {
      const item = await this.getById(params.caseId, auth);
      if (!item) return;
      const inputPrompt = params.messages.map((m) => `[${m.role}]\n${m.content}`).join('\n\n');
      await this.repository.appendCaseLlmLog(params.caseId, {
        taskId: params.taskId,
        callTarget: params.callTarget,
        inputPrompt,
        inputTokens: params.usage?.prompt_tokens ?? null,
        outputContent: params.outputContent,
        outputTokens: params.usage?.completion_tokens ?? null,
        durationMs: params.durationMs,
        model: params.model ?? null,
      });
    } catch (e) {
      console.warn('[problem-case] recordCaseLlmFromAiChat failed', e);
    }
  }
}

function resolveStageStatus(
  _majorStage: number,
  index: number,
  completedSet: Set<number>,
): 'pending' | 'current' | 'completed' {
  if (completedSet.has(index)) return 'completed';
  return completedSet.size === index ? 'current' : 'pending';
}

const TASK_INDEX_STAGE0 = {
  task1: 0,
  task2: 1,
  task3: 2,
} as const;

const TASK_INDEX_STAGE1 = {
  task4: 0,
  task5: 1,
  task6: 2,
} as const;

const TASK_INDEX_STAGE2 = {
  'e2e-flow': 0,
  'global-itgap': 1,
  'local-itgap': 2,
} as const;

const TASK_NAME: Record<string, string> = {
  task1: '企业背景洞察',
  task2: '商业画布加载',
  task3: '需求逻辑构建',
  task4: '价值流图',
  task5: 'IT 现状标注',
  task6: '痛点标注',
  'e2e-flow': '端到端事务流构建',
  'global-itgap': '全局 ITGap',
  'local-itgap': '局部 ITGap',
  task12: '全局架构设计',
  task13: '环节专项设计',
  task14: '链条串联与闭环',
  task15: '价值回溯与自检',
};

function isStrategyTask(taskId: string) {
  return ['task12', 'task13', 'task14', 'task15'].includes(taskId);
}

function resolveTaskName(taskId: string) {
  return TASK_NAME[taskId] || taskId;
}

function resolveTaskCompleteContent(taskId: string, taskName: string) {
  // 对齐前端：task7/8/9 对应后端 e2e-flow/global-itgap/local-itgap
  switch (taskId) {
    case 'e2e-flow':
      return '用户确认端到端事务流构建';
    case 'global-itgap':
      return '用户确认全局 ITGap 分析';
    case 'local-itgap':
      return '用户确认对象状态机构建';
    default:
      return '用户确认任务完成';
  }
}

/**
 * 大阶段：0 需求理解 / 1 工作流对齐 / 2 ITGap / 3 IT 策略。
 * 工作流对齐三段（价值流、IT 现状、痛点）均完成后即进入阶段 2，当前待办为 task7（端到端），与前端一致。
 */
function resolveMajorStage(
  completedStages: number[],
  itGapCompletedStages: number[],
  workflowAlignCompletedStages: number[] = [],
) {
  const itGap = itGapCompletedStages || [];
  const wf = workflowAlignCompletedStages || [];
  const stage0 = completedStages || [];
  if (itGap.includes(2)) return 3;
  if (itGap.includes(0)) return 2;
  if (wf.includes(0) && wf.includes(1) && wf.includes(2)) return 2;
  if (stage0.includes(2)) return 1;
  return 0;
}

function resolveStage3Status(item: { currentMajorStage: number; completedTaskIds: string[] }, taskId: string) {
  const order = ['task12', 'task13', 'task14', 'task15'];
  const completed = new Set(item.completedTaskIds || []);
  const stage3Done = (t: string) => {
    if (completed.has(t)) return true;
    if (
      t === 'task12' &&
      (completed.has('task11') ||
        completed.has('strategy-0') ||
        completed.has('strategy-1') ||
        completed.has('task10'))
    ) {
      return true;
    }
    return false;
  };
  if (stage3Done(taskId)) return 'completed';
  if ((item.currentMajorStage || 0) < 3) return 'pending';
  const firstIncomplete = order.find((t) => !stage3Done(t));
  return firstIncomplete === taskId ? 'current' : 'pending';
}

function normalizeProblemCaseMessage(caseId: string, message: ProblemCaseMessage): ProblemCaseMessage {
  const m: any = message as any;
  const {
    id,
    taskId,
    taskName,
    role,
    type,
    content,
    timestamp,
    confirmed,
    payloadJson,
    ...rest
  } = m;

  // payloadJson 缺失时：把额外 card 字段收拢进 payloadJson（保持顶层字段不变，避免影响前端旧渲染逻辑）
  // 注意：taskName 属于“结构字段”，不应进入 payloadJson
  const nextPayloadJson = payloadJson ?? (Object.keys(rest).length > 0 ? rest : null);

  // 固定字段契约：confirmed / payloadJson 在返回时尽量稳定为布尔/可空值
  const nextConfirmed = confirmed === undefined ? false : Boolean(confirmed);

  const nextTimestamp = typeof timestamp === 'string' ? timestamp : new Date(timestamp ?? Date.now()).toISOString();

  return {
    ...m,
    caseId,
    payloadJson: nextPayloadJson,
    id,
    taskId: taskId ?? null,
    role: role ?? null,
    type: type ?? null,
    content: typeof content === 'string' ? content : String(content ?? ''),
    timestamp: nextTimestamp,
    confirmed: nextConfirmed,
  } as ProblemCaseMessage;
}

function normalizeProblemCase(caseId: string, item: ProblemCase): ProblemCase {
  return {
    ...item,
    id: item.id || caseId,
    basicInfo: normalizePublicBasicInfo(item.basicInfo),
    completedStages: Array.isArray(item.completedStages) ? item.completedStages : [],
    workflowAlignCompletedStages: Array.isArray(item.workflowAlignCompletedStages) ? item.workflowAlignCompletedStages : [],
    itGapCompletedStages: Array.isArray(item.itGapCompletedStages) ? item.itGapCompletedStages : [],
    completedTaskIds: Array.isArray(item.completedTaskIds) ? item.completedTaskIds : [],
  };
}

function normalizePublicBasicInfo(basicInfo: unknown): unknown {
  if (!basicInfo || typeof basicInfo !== 'object' || Array.isArray(basicInfo)) {
    return basicInfo ?? undefined;
  }
  const keys = Object.keys(basicInfo as Record<string, unknown>);
  if (keys.length === 0) return undefined;
  const nonMetaKeys = keys.filter((key) => key !== '__createContractExtras');
  if (nonMetaKeys.length === 0) return undefined;
  return basicInfo;
}

