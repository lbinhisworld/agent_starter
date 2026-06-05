/**
 * [INPUT]: Prisma、`problem-cases/types`、Task1 图构建器
 * [OUTPUT]: ProblemCase 等 CRUD；设计详情 Task1 图写入 DesignFeatureNode 时经 insertDesignFeatureNodeFeatureRow 显式插入 TokenStr 列；任务 2 L1 replaceTask2L1TargetKvFeatureKeyTokens 合并追加同步 Target_KV/Extended_Features（同路径同值复用 feature、不同 value 仅增 feature、新路径增 token；不删旧 token、不改旧 value），并按 Evidence_Support_Chain 写 DesignLogicLink；getDesignDetailTaskGraphDetail 附加 themeKey/pillBatchKey 与 features 展示字段
 * [POS]: problem-cases 仓储实现
 *
 * [PROTOCOL]: 变更 `DesignFeatureNode` 列或图事务时同步 `backend/prisma/schema.prisma`、`backend/prisma/AGENTS.md` 与 `docs/agents/backend/01-context.md`；`replaceCustomerRequirementSectionGraph` 为 **合并追加**（同 `tokens` 路径 / 同 `featureId`；`plan.linkPairs` 当前恒空、任务 1 不写 `DesignLogicLink`）时须同步 `design-detail-customer-req-section-graph.ts` 与 `types.ts` 注释；**`DesignLogicLink.linkKind`** 规则见 **`design-detail-logic-link-kind.ts`**；Task1 工商替换事务内打 `[problem-case:task1-basic-graph] replaceDesignDetailTask1BasicInfoGraph tx`（删前样本与即将写入的 `tokens` 预览）；任务 2 L1 / **任务 3 L2** 同步与 **`Evidence_Support_Chain`/`Token_Validation_Mapping`→`DesignLogicLink`** 口径见 `design-detail-task2-l1-target-kv-tokens.ts`；**`Token_Validation_Mapping`** 落库跳过见 **`[problem-case:task2-l1-graph]`** / **`[problem-case:task3-l2-graph] skip_token_validation_link`** 与事务后 **`merge_task2_l1_tx_summary`** / **`replace_task3_l2_tx_summary`** 之 **`tvSkipEvents`/`tvLinksInserted`**
 */
import { randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  allocateNextDesignDetailTaskTokenId,
  allocateNextDesignFeatureNumericId12,
  allocateNextDesignLogicLinkNumericId12,
} from './design-detail-graph-ids';
import {
  CaseLlmLogAppendInput,
  CaseLlmLogListRow,
  CreateProblemCaseInput,
  ProblemCase,
  ProblemCaseMessage,
  ProblemCaseMessagePatch,
  ProblemCaseRepository,
  type DesignDetailTaskGraphFeatureDto,
  type DesignDetailTaskGraphTaskDto,
  UpdateProblemCaseInput,
} from './types';
import { DESIGN_DETAIL_TASK1_LINE_TASK_ID, buildTask1BasicGraphPlan } from './design-detail-task1-basic-graph';
import {
  buildTask1L1OriginalFeatureGraphPlan,
  isValidTask1L1ModelFeatureId,
  type Task1L1OriginalFeatureSyncRow,
} from './design-detail-task1-l1-original-feature';
import { mergeValidationStatusIntoTask1FeatureValue } from './design-detail-task1-validation-status';
import {
  designLogicLinkKindToApiValue,
  inferDesignLogicLinkKind,
  isDesignDetailTask1GraphTokenTaskId,
} from './design-detail-logic-link-kind';
import {
  DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID,
  buildCustomerReqSectionGraphPlan,
  buildPainPointRadarSectionPlan,
  customerRequirementTokenRowBelongsToSection,
} from './design-detail-customer-req-section-graph';
import {
  DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK2_L1_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
  DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK3_L2_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK4_LINE_TASK_ID,
  DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK5_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK5_LINE_TASK_ID,
  DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK51_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK51_LINE_TASK_ID,
  isDesignDetailTask51L3TokenTaskId,
  DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK52_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK52_LINE_TASK_ID,
  isDesignDetailTask52L3TokenTaskId,
  DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK53_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK53_LINE_TASK_ID,
  isDesignDetailTask53L3TokenTaskId,
  DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK55_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK55_LINE_TASK_ID,
  isDesignDetailTask55L3TokenTaskId,
  DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK6_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK6_LINE_TASK_ID,
  isDesignDetailTask6L3TokenTaskId,
  DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK65_L3_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK65_LINE_TASK_ID,
  isDesignDetailTask65L3TokenTaskId,
  DESIGN_DETAIL_TASK0_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK0_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK0_LINE_TASK_ID,
  isDesignDetailTask0TokenTaskId,
  DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK7_L4_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK7_LINE_TASK_ID,
  isDesignDetailTask7L4TokenTaskId,
  DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK8_L45_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK8_LINE_TASK_ID,
  isDesignDetailTask8L45TokenTaskId,
  DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK85_L475_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK85_LINE_TASK_ID,
  isDesignDetailTask85L475TokenTaskId,
  DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK9_L5_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK9_LINE_TASK_ID,
  isDesignDetailTask9L5TokenTaskId,
  isDesignDetailTask10L5TokenTaskId,
  DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK10_L5_TOKEN_DB_TASK_IDS,
  DESIGN_DETAIL_TASK10_LINE_TASK_ID,
  DESIGN_DETAIL_TASK_GRAPH_ORDER,
  getDesignDetailTaskGraphCardTitle,
  isDesignDetailTask2L1TokenTaskId,
  isDesignDetailTask3L2TokenTaskId,
  isDesignDetailTask4L2TokenTaskId,
  isDesignDetailTask5L3TokenTaskId,
} from './design-detail-task-graph-catalog';
import {
  buildTask7IntraFlowForwardLinks,
  buildTask51IntraValuePropositionForwardLinks,
  buildTask52CapabilityUnitToFieldSetForwardLinks,
  buildTask53WorkflowAndStepForwardLinks,
  buildTask53WorkflowStepFeaturePlans,
  type Task52CapabilityUnitRef,
  type Task52FieldSetRef,
  task53StepFeatureIdMapKey,
  task53StepNameFromDesignFeatureValue,
  buildTask9IntraModuleMenuForwardLinks,
  task7SyncRowFeatureValueLabel,
  buildTask10MainTableToBaseForwardLinks,
  buildTask10SchemaFieldFissionPlans,
  normalizeTask2L1MappedFeatureKey,
  registerTask9SyncBatchEvidenceIdAliases,
  registerTask6UpstreamEvidenceAliases,
  ensureTask6ScenarioEvidenceLinks,
  resolveEvidenceLinkSourceFeatureId,
  task53WorkflowNameFromDesignFeatureValue,
  task55VsmStagePhaseNameFromDesignFeatureValue,
  task55VsmTargetKvDedupKey,
  type Task2L1TokenValidationLinkPlan,
} from './design-detail-task2-l1-target-kv-tokens';
import { normalizeDesignDetailFeatureOperator } from './design-detail-feature-operator';
import { replaceReverseValidationLinksFromSourcesToTask1 } from './design-detail-reverse-validation-link-replace';

/** 事务内 client：仅需 `$executeRawUnsafe`（与 `$transaction` 回调 `tx` 对齐） */
type RawSqlTx = { $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown> };

/**
 * 显式 INSERT `DesignFeatureNode` 的 `TokenStr` 列。
 * 背景：列已由 `tokens` 更名为 `TokenStr` 后，个别运行环境仍加载旧 Prisma 引擎，对 `designFeatureNode.create({ surfaceTokens })` 生成列名 `tokens` 触发 MySQL「列不存在」。
 */
async function insertDesignFeatureNodeFeatureRow(
  tx: RawSqlTx,
  params: {
    featureId: string;
    tokenId: string;
    tokenSurfaces: string[];
    featureValue: unknown;
    /** 缺省为「等于」；任务 2 L1 等处写入模型比较符，经 `normalizeDesignDetailFeatureOperator` 归一后截断至 64 */
    operator?: string;
  },
): Promise<void> {
  const tokenStrJson = JSON.stringify(params.tokenSurfaces);
  const valueJson = JSON.stringify(params.featureValue === undefined ? null : params.featureValue);
  const op = normalizeDesignDetailFeatureOperator(params.operator).slice(0, 64);
  /** MariaDB 部分版本对 `CAST(? AS JSON)` 报 1064；`JSON` 列直接绑定合法 JSON 文本即可 */
  await tx.$executeRawUnsafe(
    'INSERT INTO `DesignFeatureNode` (`featureId`, `tokenId`, `TokenStr`, `operator`, `value`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))',
    params.featureId,
    params.tokenId,
    tokenStrJson,
    op,
    valueJson,
  );
}

/** 与 `DesignDetailTaskToken.tokens` 判重一致：序列化为稳定字符串键（多轮补充需求时同路径不重复建 token） */
function customerRequirementTokenSurfacesKey(surfaces: unknown): string {
  if (!Array.isArray(surfaces)) return '[]';
  return JSON.stringify(surfaces.map((x) => String(x)));
}

/** 任务 2 L1 等：`Feature_Key` 为 `中文 · 英文键` 时，`tokens` / `TokenStr` 仅写入中文段（与前端逻辑弹层 strip 口径一致） */
function designDetailTaskTokenSurfaceChinesePrimary(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const parts = s.split(/\s*·\s*/);
  const left = parts[0]?.trim() ?? '';
  return left || s;
}

const TASK_GRAPH_LOGIC_PREVIEW_LEN = 160;
/** 逻辑弹层 Feature 列：由 `DesignFeatureNode.value` 格式化的最大展示长度（超出加省略号） */
const TASK_GRAPH_FEATURE_VALUE_PREVIEW_LEN = 480;

function taskGraphTokenDisplayName(tokensJson: unknown): string {
  if (!Array.isArray(tokensJson) || tokensJson.length === 0) return '—';
  const parts = tokensJson.map((x) => String(x).trim()).filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

/** `DesignFeatureNode.TokenStr`（`surfaceTokens`）在逻辑边端点子卡中的直显：数组同 Token 列拼接，否则尽量字符串化 */
function taskGraphFeatureTokenStrDisplay(surfaceTokens: unknown): string {
  if (surfaceTokens === null || surfaceTokens === undefined) return '—';
  if (Array.isArray(surfaceTokens)) {
    const t = taskGraphTokenDisplayName(surfaceTokens).trim();
    return t.length ? t : '—';
  }
  if (typeof surfaceTokens === 'string') {
    const s = surfaceTokens.trim();
    if (s.length) return s;
    return '—';
  }
  if (typeof surfaceTokens === 'number' || typeof surfaceTokens === 'boolean') {
    return String(surfaceTokens);
  }
  try {
    const j = JSON.stringify(surfaceTokens);
    return j.length ? j : '—';
  } catch {
    return '—';
  }
}

function truncateTaskGraphPreview(s: string, maxLen: number): string {
  const t = String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  const arr = Array.from(t);
  if (arr.length <= maxLen) return t;
  return `${arr.slice(0, maxLen - 1).join('')}…`;
}

/** 逻辑弹层 `value` 摘要选项：任务 2 L1 **Target_KV** 落库值应展示 **Feature_Value**，避免误取对象内 `Description` 叙事 */
type TaskGraphFeatureValueFormatOpts = {
  omitDescription?: boolean;
  /** 任务 1 等：`value` 内可能含模型/历史 `operator` 英文字段，勿拼进 Feature 列摘要（与表列 `operator` 区分） */
  omitValueObjectOperatorKeys?: boolean;
};

/**
 * 将 `DesignFeatureNode.value`（JSON）格式化为逻辑弹层 Feature 列文案。
 * 默认优先抽取常见叙事字段（如 `description`）；`omitDescription` 时跳过 `description` 键（任务 2 L1 目标特征）。
 */
function formatDesignFeatureValueForTaskGraph(value: unknown, options?: TaskGraphFeatureValueFormatOpts): string {
  const omitDescription = options?.omitDescription === true;
  const omitOpKeys = options?.omitValueObjectOperatorKeys === true;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    const parts = value
      .map((x) => formatDesignFeatureValueForTaskGraph(x, options))
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length) return parts.join('、');
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const k of ['表格名称', '表名', '表格名']) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) {
        return truncateTaskGraphPreview(v.trim(), TASK_GRAPH_FEATURE_VALUE_PREVIEW_LEN);
      }
    }
    const preferredStringKeys = omitDescription
      ? [
          'Feature_Value',
          'feature_value',
          'value',
          'content',
          'text',
          'summary',
          'name',
          'title',
          'label',
          'note',
          'remark',
        ]
      : [
          'description',
          'content',
          'text',
          'summary',
          'value',
          'name',
          'title',
          'label',
          'note',
          'remark',
        ];
    for (const k of preferredStringKeys) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    const nestedFv = o.Feature_Value ?? o.feature_value;
    if (nestedFv !== undefined && nestedFv !== null) {
      const inner = formatDesignFeatureValueForTaskGraph(nestedFv, options).trim();
      if (inner.length) return inner;
    }
    const flat: string[] = [];
    for (const [k, v] of Object.entries(o)) {
      if (k.startsWith('__')) continue;
      const kn = k.toLowerCase().replace(/\s+/g, '_');
      if (kn === 'value_ref_domain' || kn === 'valuerefdomain') continue;
      if (omitDescription && k.toLowerCase() === 'description') continue;
      if (omitOpKeys && (k === 'operator' || k === 'Operator')) continue;
      if (typeof v === 'string' && v.trim()) flat.push(v.trim());
      else if (typeof v === 'number' || typeof v === 'boolean') flat.push(String(v));
    }
    if (flat.length) return flat.slice(0, 8).join('；');
    try {
      return JSON.stringify(o);
    } catch {
      return '';
    }
  }
  return '';
}

/** 任务 2 L1：`value_ref_domain` 为 N/A 或空时不落库、不下发「备注」 */
function shouldPersistValueRefDomain(domain: string): boolean {
  const t = String(domain ?? '').trim();
  if (!t) return false;
  const squish = t.toUpperCase().replace(/\s+/g, '').replace(/／/g, '/');
  if (squish === 'N/A' || squish === 'NA' || squish === 'NONE') return false;
  if (/^n\/?a$/i.test(t.trim())) return false;
  return true;
}

/** 任务 10 三元级联：写入 `DesignFeatureNode.value` 供 GET task-graph 与逻辑树分轨 */
type Task10FeatureNodeValueExtras = {
  inductionType?: string;
  parentTableRef?: string;
  introductionReason?: string;
  referenceFieldMapping?: string;
};

/** 任务 5.2：字段集层次容器写入 `DesignFeatureNode.value` */
type Task52FeatureNodeValueExtras = {
  associatedCapabilityUnit?: string;
  fieldsSchemaTree?: unknown;
};

/** 任务 2/3/4 Target_KV：`DesignFeatureNode.value` 写入 `{ Feature_Value, value_ref_domain?, inference_summary?, business_function?, Tech_Host_Platform?, Validation_Status?, associated_capability_unit?, fields_schema_tree? }` 或标量（兼容旧数据） */
function buildTask2L1FeatureNodeValue(
  featureValue: unknown,
  valueRefDomain?: string,
  inferenceSummary?: string,
  techHostPlatform?: string,
  validationStatus?: string,
  task10Extras?: Task10FeatureNodeValueExtras,
  task52Extras?: Task52FeatureNodeValueExtras,
  businessFunction?: string,
): unknown {
  const d = String(valueRefDomain ?? '').trim();
  const inf = String(inferenceSummary ?? '').trim();
  const biz = String(businessFunction ?? '').trim();
  const thp = String(techHostPlatform ?? '').trim();
  const vs = String(validationStatus ?? '').trim();
  const it = String(task10Extras?.inductionType ?? '').trim();
  const ptr = String(task10Extras?.parentTableRef ?? '').trim();
  const ir = String(task10Extras?.introductionReason ?? '').trim();
  const rfm = String(task10Extras?.referenceFieldMapping ?? '').trim();
  const acu = String(task52Extras?.associatedCapabilityUnit ?? '').trim();
  const fst = task52Extras?.fieldsSchemaTree;
  const hasVrd = shouldPersistValueRefDomain(d);
  const hasInf = inf.length > 0;
  const hasBiz = biz.length > 0;
  const hasThp = thp.length > 0;
  const hasVs = vs.length > 0;
  const hasIt = it.length > 0;
  const hasPtr = ptr.length > 0 && ptr !== 'N/A' && ptr !== '—' && ptr !== '-';
  const hasIr = ir.length > 0;
  const hasRfm = rfm.length > 0;
  const hasAcu = acu.length > 0;
  const hasFst = Array.isArray(fst) && fst.length > 0;
  if (
    !hasVrd &&
    !hasInf &&
    !hasBiz &&
    !hasThp &&
    !hasVs &&
    !hasIt &&
    !hasPtr &&
    !hasIr &&
    !hasRfm &&
    !hasAcu &&
    !hasFst
  ) {
    return featureValue;
  }
  const o: Record<string, unknown> = { Feature_Value: featureValue };
  if (hasVrd) o.value_ref_domain = d;
  if (hasInf) o.inference_summary = inf;
  if (hasBiz) o.business_function = biz;
  if (hasThp) o.Tech_Host_Platform = thp;
  if (hasVs) o.Validation_Status = vs;
  if (hasIt) o.Induction_Type = it;
  if (hasPtr) o.Parent_Table_Ref = ptr;
  if (hasIr) o.Introduction_Reason = ir;
  if (hasRfm) o.Reference_Field_Mapping = rfm;
  if (hasAcu) o.associated_capability_unit = acu;
  if (hasFst) o.fields_schema_tree = fst;
  return o;
}

/** 任务 2 L1：token 路径查找键（标准三键归一；裂变键 `*_01` 与 Extended 保留完整路径） */
function task2L1TokenLookupKey(featureKey: string): string {
  const raw = String(featureKey || '').trim();
  if (/_\d+$/.test(raw)) {
    return designDetailTaskTokenSurfaceChinesePrimary(raw) || raw;
  }
  const canon = normalizeTask2L1MappedFeatureKey(featureKey);
  if (canon) return canon;
  const surface = designDetailTaskTokenSurfaceChinesePrimary(featureKey);
  return surface || raw;
}

/** 任务 2 L1：比较 `operator` + 落库 `value` 是否视为同一条特征取值（用于合并追加去重） */
function task2L1ValueIdentityKey(valueForDb: unknown, operator?: string): string {
  try {
    return JSON.stringify({
      op: normalizeDesignDetailFeatureOperator(operator),
      v: valueForDb,
    });
  } catch {
    return `${normalizeDesignDetailFeatureOperator(operator)}:${String(valueForDb)}`;
  }
}

function taskGraphExtractValueRefDomain(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const o = value as Record<string, unknown>;
  const raw =
    o.value_ref_domain ?? o.Value_Ref_Domain ?? o.valueRefDomain ?? o.ValueRefDomain;
  if (raw === null || raw === undefined) return undefined;
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  if (!s.length || !shouldPersistValueRefDomain(s)) return undefined;
  return s;
}

function taskGraphExtractInferenceSummary(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const o = value as Record<string, unknown>;
  const raw =
    o.inference_summary ?? o.Inference_Summary ?? o.inferenceSummary ?? o.InferenceSummary;
  if (raw === null || raw === undefined) return undefined;
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  return s.length ? s : undefined;
}

/** 任务 1 L1 原始实然特征：`value` JSON 内 **Validation_Status**（行级断路器基因） */
function taskGraphExtractValidationStatus(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const o = value as Record<string, unknown>;
  const raw =
    o.Validation_Status ?? o.validation_status ?? o.validationStatus ?? o.ValidationStatus;
  if (raw === null || raw === undefined) return undefined;
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  return s.length ? s : undefined;
}

function taskGraphExtractStringFieldFromValue(
  value: unknown,
  keys: readonly string[],
): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t.startsWith('{') && !t.startsWith('[')) return undefined;
    try {
      return taskGraphExtractStringFieldFromValue(JSON.parse(t) as unknown, keys);
    } catch {
      return undefined;
    }
  }
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const o = value as Record<string, unknown>;
  for (const k of keys) {
    const raw = o[k];
    if (raw === null || raw === undefined) continue;
    const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
    if (s.length) return s;
  }
  return undefined;
}

function taskGraphExtractInductionType(value: unknown): string | undefined {
  return taskGraphExtractStringFieldFromValue(value, [
    'Induction_Type',
    'induction_type',
    'inductionType',
  ]);
}

function taskGraphExtractParentTableRef(value: unknown): string | undefined {
  return taskGraphExtractStringFieldFromValue(value, [
    'Parent_Table_Ref',
    'parent_table_ref',
    'parentTableRef',
  ]);
}

function taskGraphExtractIntroductionReason(value: unknown): string | undefined {
  return taskGraphExtractStringFieldFromValue(value, [
    'Introduction_Reason',
    'introduction_reason',
    'introductionReason',
  ]);
}

function taskGraphExtractReferenceFieldMapping(value: unknown): string | undefined {
  return taskGraphExtractStringFieldFromValue(value, [
    'Reference_Field_Mapping',
    'reference_field_mapping',
    'referenceFieldMapping',
  ]);
}

function taskGraphExtractTechHostPlatform(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t.startsWith('{')) return undefined;
    try {
      return taskGraphExtractTechHostPlatform(JSON.parse(t) as unknown);
    } catch {
      return undefined;
    }
  }
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const o = value as Record<string, unknown>;
  const raw =
    o.Tech_Host_Platform ?? o.tech_host_platform ?? o.TechHostPlatform ?? o.techHostPlatform;
  if (raw === null || raw === undefined) return undefined;
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  return s.length ? s : undefined;
}

/** 历史上任务 2 L1 目标特征：`dd:{caseId}:t2l1:k…`；新形态为 `ft_`+12 位数字且绑定任务 2 L1 token */
function isTask2L1ModelTargetFeatureId(featureId: string, tokenDbTaskId?: string): boolean {
  const fid = String(featureId || '');
  if (/^dd:[^:]+:t2l1:k\d+_/.test(fid)) return true;
  return Boolean(
    tokenDbTaskId && isDesignDetailTask2L1TokenTaskId(tokenDbTaskId) && /^ft_[0-9]{12}$/.test(fid),
  );
}

function taskGraphFeatureDisplayName(surfaceTokens: unknown, featureId: string): string {
  if (Array.isArray(surfaceTokens) && surfaceTokens.length > 0) {
    const s = String(surfaceTokens[0] ?? '').trim();
    if (s.length) return s;
  }
  const fid = String(featureId || '');
  const idx = fid.lastIndexOf(':');
  return idx >= 0 ? fid.slice(idx + 1) || fid : fid || '—';
}

/** 任务 1 工商/需求：`dd:{caseId}:cb:…` / `dd:…:cr:…`；新形态 `ft_`+12 位且绑定任务 1 token */
function isTask1DesignDetailFeatureId(featureId: string, tokenDbTaskId?: string): boolean {
  const fid = String(featureId || '');
  if (/^dd:[^:]+:(cb|cr):/.test(fid)) return true;
  return Boolean(tokenDbTaskId && isTask1TokenDbTaskId(tokenDbTaskId) && /^ft_[0-9]{12}$/.test(fid));
}

/** Feature 列：以 `value` 为主；空或无法展示时回退 `surfaceTokens` 路径（与 Token 列区分） */
/** 任务 1「现有表格」化石：value 为逗号拼接表头，任务 5.2 送模须原样暴露 */
function taskGraphShouldExposeRawFeatureValueForSurface(surfaceTokens: unknown): boolean {
  if (!Array.isArray(surfaceTokens) || surfaceTokens.length === 0) return false;
  const first = surfaceTokens[0];
  return typeof first === 'string' && first.trim().startsWith('现有表格/');
}

function taskGraphShouldExposeRawFeatureValue(taskId: string): boolean {
  const t = String(taskId || '').trim();
  if (
    t === DESIGN_DETAIL_TASK10_LINE_TASK_ID ||
    t === DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID ||
    t.includes('任务 10')
  ) {
    return true;
  }
  /** 任务 5.2：逻辑树须读 `value` 内 `fields_schema_tree`，仅 `name` 摘要会丢嵌套字段 */
  if (
    t === DESIGN_DETAIL_TASK52_LINE_TASK_ID ||
    t === DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID ||
    isDesignDetailTask52L3TokenTaskId(t)
  ) {
    return true;
  }
  /** 任务 5.3：逻辑树须读 `value` 内 `workflow_steps_topology` */
  if (
    t === DESIGN_DETAIL_TASK53_LINE_TASK_ID ||
    isDesignDetailTask53L3TokenTaskId(t)
  ) {
    return true;
  }
  /** 任务 5.5 / 6：现状理解第四层须读 `phase_name` / `classified_workflows` / `targeted_value_phase` 等结构化 JSON */
  if (
    t === DESIGN_DETAIL_TASK55_LINE_TASK_ID ||
    isDesignDetailTask55L3TokenTaskId(t)
  ) {
    return true;
  }
  if (
    t === DESIGN_DETAIL_TASK6_LINE_TASK_ID ||
    isDesignDetailTask6L3TokenTaskId(t)
  ) {
    return true;
  }
  if (
    t === DESIGN_DETAIL_TASK65_LINE_TASK_ID ||
    isDesignDetailTask65L3TokenTaskId(t)
  ) {
    return true;
  }
  return false;
}

function taskGraphFeatureRowLabel(
  value: unknown,
  surfaceTokens: unknown,
  featureId: string,
  tokenDbTaskId?: string,
): string {
  const tid = String(tokenDbTaskId || '').trim();
  if (isDesignDetailTask53L3TokenTaskId(tid)) {
    const surfaceFirst =
      Array.isArray(surfaceTokens) && typeof surfaceTokens[0] === 'string'
        ? String(surfaceTokens[0]).trim()
        : '';
    if (surfaceFirst.includes('/环节/')) {
      const step = task53StepNameFromDesignFeatureValue(value);
      if (step.length) {
        return truncateTaskGraphPreview(step, TASK_GRAPH_FEATURE_VALUE_PREVIEW_LEN);
      }
    }
    const wf = task53WorkflowNameFromDesignFeatureValue(value);
    if (wf.length) {
      return truncateTaskGraphPreview(wf, TASK_GRAPH_FEATURE_VALUE_PREVIEW_LEN);
    }
  }
  if (isDesignDetailTask55L3TokenTaskId(tid)) {
    const phase = task55VsmStagePhaseNameFromDesignFeatureValue(value);
    if (phase.length) {
      return truncateTaskGraphPreview(phase, TASK_GRAPH_FEATURE_VALUE_PREVIEW_LEN);
    }
  }
  const surfaceFirst =
    Array.isArray(surfaceTokens) && typeof surfaceTokens[0] === 'string'
      ? String(surfaceTokens[0]).trim()
      : '';
  if (surfaceFirst.startsWith('现有表格/')) {
    const headers = formatDesignFeatureValueForTaskGraph(value, {
      omitDescription: isTask2L1ModelTargetFeatureId(featureId, tokenDbTaskId),
      omitValueObjectOperatorKeys: isTask1DesignDetailFeatureId(featureId, tokenDbTaskId),
    }).trim();
    if (headers.length) {
      return truncateTaskGraphPreview(headers, TASK_GRAPH_FEATURE_VALUE_PREVIEW_LEN);
    }
    return '原始数据模型表头';
  }
  const fromValue = formatDesignFeatureValueForTaskGraph(value, {
    omitDescription: isTask2L1ModelTargetFeatureId(featureId, tokenDbTaskId),
    omitValueObjectOperatorKeys: isTask1DesignDetailFeatureId(featureId, tokenDbTaskId),
  }).trim();
  if (fromValue.length) return truncateTaskGraphPreview(fromValue, TASK_GRAPH_FEATURE_VALUE_PREVIEW_LEN);
  return taskGraphFeatureDisplayName(surfaceTokens, featureId);
}

function taskGraphLinkDisplayName(logic: string): string {
  const t = String(logic || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!t.length) return '—';
  if (t.length <= TASK_GRAPH_LOGIC_PREVIEW_LEN) return t;
  return `${t.slice(0, TASK_GRAPH_LOGIC_PREVIEW_LEN - 1)}…`;
}

/** `DesignLogicLink.weight` 归一化到 [0,1]；无效则 null（兼容部分驱动返回字符串） */
function normalizeDesignLogicLinkWeight(raw: unknown): number | null {
  if (raw == null) return null;
  let n: number;
  if (typeof raw === 'number') {
    n = raw;
  } else if (typeof raw === 'string') {
    n = parseFloat(raw.trim());
  } else {
    n = Number(raw);
  }
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}

type TaskGraphFeatureNodePainSource = {
  painPointConfirmed?: boolean;
  painPointConfirmedByLineStepId?: string | null;
};

function taskGraphPainFieldsFromNode(
  node: TaskGraphFeatureNodePainSource,
): Pick<DesignDetailTaskGraphFeatureDto, 'painPointConfirmed' | 'painPointConfirmedByLineStepId'> {
  const painConfirmed = node.painPointConfirmed === true;
  const painByStep = String(node.painPointConfirmedByLineStepId ?? '').trim();
  return {
    ...(painConfirmed ? { painPointConfirmed: true as const } : {}),
    ...(painByStep ? { painPointConfirmedByLineStepId: painByStep } : {}),
  };
}

/** 由 `DesignLogicLink` 外键关联的 `DesignFeatureNode` 行构造逻辑弹层用特征 DTO（`name` 为 `value` 摘要；`tokenDisplay` 仅来自 **`TokenStr`/`surfaceTokens`**；`operator` 同表字段） */
function taskGraphFeatureDtoFromLinkedNode(
  node:
    | {
        featureId: string;
        value: unknown;
        surfaceTokens: unknown;
        tokenId: string;
        operator: string;
      }
    | null
    | undefined,
  pillBatchByTokenId: Map<string, string>,
  fallbackFeatureId: string,
  tokenDbTaskId?: string,
): DesignDetailTaskGraphFeatureDto {
  if (!node?.featureId) return taskGraphMissingFeatureDto(fallbackFeatureId);
  const tid = String(tokenDbTaskId || '').trim();
  const tokenDisplayRaw = taskGraphFeatureTokenStrDisplay(node.surfaceTokens).trim();
  const opRaw = String(node.operator ?? '').trim();
  const vrd = taskGraphExtractValueRefDomain(node.value);
  const inf = taskGraphExtractInferenceSummary(node.value);
  const thp = taskGraphExtractTechHostPlatform(node.value);
  const vs = taskGraphExtractValidationStatus(node.value);
  const inductionType = taskGraphExtractInductionType(node.value);
  const parentTableRef = taskGraphExtractParentTableRef(node.value);
  const introductionReason = taskGraphExtractIntroductionReason(node.value);
  const referenceFieldMapping = taskGraphExtractReferenceFieldMapping(node.value);
  return {
    featureId: node.featureId,
    name: taskGraphFeatureRowLabel(node.value, node.surfaceTokens, node.featureId, tid || undefined),
    themeKey: taskGraphThemeKeyForFeatureId(node.featureId, tid || undefined, node.surfaceTokens),
    pillBatchKey: pillBatchByTokenId.get(node.tokenId) ?? 'nx-0',
    tokenDisplay: tokenDisplayRaw.length ? tokenDisplayRaw : '—',
    operator: opRaw.length ? normalizeDesignDetailFeatureOperator(opRaw) : '—',
    ...(vrd ? { valueRefDomain: vrd } : {}),
    ...(inf ? { inferenceSummary: inf } : {}),
    ...(thp ? { techHostPlatform: thp } : {}),
    ...(vs ? { validationStatus: vs } : {}),
    ...(inductionType ? { inductionType } : {}),
    ...(parentTableRef ? { parentTableRef } : {}),
    ...(introductionReason ? { introductionReason } : {}),
    ...(referenceFieldMapping ? { referenceFieldMapping } : {}),
    ...taskGraphPainFieldsFromNode(node as TaskGraphFeatureNodePainSource),
    ...(tid &&
    (taskGraphShouldExposeRawFeatureValue(tid) ||
      (isTask1TokenDbTaskId(tid) && taskGraphShouldExposeRawFeatureValueForSurface(node.surfaceTokens)))
      ? { featureValue: node.value }
      : {}),
  };
}

/** 逻辑边引用特征未出现在本案例 token 聚合缓存时的占位，避免弹层崩溃 */
function taskGraphMissingFeatureDto(featureId: string): DesignDetailTaskGraphFeatureDto {
  const fid = String(featureId || '').trim() || '—';
  const short = fid.length > 28 ? `${fid.slice(0, 28)}…` : fid;
  return {
    featureId: fid,
    name: `（特征未命中展示）${short}`,
    themeKey: 'requirement_misc',
    pillBatchKey: 'nx-0',
    tokenDisplay: '—',
    operator: '—',
  };
}

/** 需求提炼 token 首段路径 → 与 `design-detail-customer-req-section-graph` 分域 key 对齐的 `themeKey` */
function taskGraphThemeKeyFromCustomerRequirementTokenSurface(first: string): string {
  const t = String(first || '').trim();
  if (t.startsWith('业务背景/')) return 'businessContext';
  if (t.startsWith('核心业务对象/')) return 'coreBusinessEntities';
  if (t.startsWith('状态转移矩阵/')) return 'stateTransitionMatrix';
  if (t.startsWith('痛点雷达/')) return 'painPointRadar';
  if (t.startsWith('IT 集成与现状/') || t.startsWith('IT 现状与集成/')) return 'itLandscape';
  if (t.startsWith('现有表格/')) return 'existingSpreadsheets';
  if (t.startsWith('运营模式/')) return 'operationModel';
  if (t.startsWith('管理资源/')) return 'managementResources';
  return 'requirement_misc';
}

function isTask1TokenDbTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return (
    t === DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK1_LINE_TASK_ID ||
    t === DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID
  );
}

/** 与 `customerRequirementTokenRowBelongsToSection` 路径前缀一致：用于统一 `taskId` 后按 `tokens` 区分工商 vs 需求 pill/theme */
function isRequirementStyleTokenRow(tokens: unknown): boolean {
  if (!Array.isArray(tokens) || tokens.length === 0) return false;
  const first = tokens[0];
  if (typeof first !== 'string') return false;
  const s = first.trim();
  return (
    s.startsWith('业务背景/') ||
    s.startsWith('核心业务对象/') ||
    s.startsWith('状态转移矩阵/') ||
    s.startsWith('痛点雷达/') ||
    s.startsWith('IT 集成与现状/') ||
    s.startsWith('IT 现状与集成/') ||
    s.startsWith('现有表格/') ||
    s.startsWith('运营模式/') ||
    s.startsWith('管理资源/')
  );
}

/** GET 聚合用线步 id：`customer_basic` 卡内合并工商 + 需求提炼 token */
function canonicalDesignDetailGraphTaskKey(dbTaskId: string): string {
  const t = String(dbTaskId || '').trim();
  if (isTask1TokenDbTaskId(t)) return DESIGN_DETAIL_TASK1_LINE_TASK_ID;
  if (isDesignDetailTask2L1TokenTaskId(t)) return DESIGN_DETAIL_TASK2_LINE_TASK_ID;
  if (isDesignDetailTask3L2TokenTaskId(t)) return DESIGN_DETAIL_TASK3_LINE_TASK_ID;
  if (isDesignDetailTask4L2TokenTaskId(t)) return DESIGN_DETAIL_TASK4_LINE_TASK_ID;
  if (isDesignDetailTask5L3TokenTaskId(t)) return DESIGN_DETAIL_TASK5_LINE_TASK_ID;
  if (isDesignDetailTask51L3TokenTaskId(t)) return DESIGN_DETAIL_TASK51_LINE_TASK_ID;
  if (isDesignDetailTask52L3TokenTaskId(t)) return DESIGN_DETAIL_TASK52_LINE_TASK_ID;
  if (isDesignDetailTask53L3TokenTaskId(t)) return DESIGN_DETAIL_TASK53_LINE_TASK_ID;
  if (isDesignDetailTask55L3TokenTaskId(t)) return DESIGN_DETAIL_TASK55_LINE_TASK_ID;
  if (isDesignDetailTask6L3TokenTaskId(t)) return DESIGN_DETAIL_TASK6_LINE_TASK_ID;
  if (isDesignDetailTask65L3TokenTaskId(t)) return DESIGN_DETAIL_TASK65_LINE_TASK_ID;
  if (isDesignDetailTask0TokenTaskId(t)) return DESIGN_DETAIL_TASK0_LINE_TASK_ID;
  if (isDesignDetailTask7L4TokenTaskId(t)) return DESIGN_DETAIL_TASK7_LINE_TASK_ID;
  if (isDesignDetailTask8L45TokenTaskId(t)) return DESIGN_DETAIL_TASK8_LINE_TASK_ID;
  if (isDesignDetailTask85L475TokenTaskId(t)) return DESIGN_DETAIL_TASK85_LINE_TASK_ID;
  if (isDesignDetailTask9L5TokenTaskId(t)) return DESIGN_DETAIL_TASK9_LINE_TASK_ID;
  if (isDesignDetailTask10L5TokenTaskId(t)) return DESIGN_DETAIL_TASK10_LINE_TASK_ID;
  return t;
}

function taskGraphThemeKeyForTask1MergedToken(tokensJson: unknown): string {
  if (isRequirementStyleTokenRow(tokensJson)) {
    if (!Array.isArray(tokensJson) || tokensJson.length === 0) return 'requirement_misc';
    const first = tokensJson[0];
    if (typeof first === 'string' && first.trim()) {
      return taskGraphThemeKeyFromCustomerRequirementTokenSurface(first);
    }
    return 'requirement_misc';
  }
  return 'customer_basic';
}

function taskGraphThemeKeyForTokenRow(taskId: string, tokensJson: unknown): string {
  const tid = String(taskId || '').trim();
  if (isTask1TokenDbTaskId(tid)) {
    return taskGraphThemeKeyForTask1MergedToken(tokensJson);
  }
  if (isDesignDetailTask2L1TokenTaskId(tid)) return DESIGN_DETAIL_TASK2_LINE_TASK_ID;
  if (isDesignDetailTask3L2TokenTaskId(tid)) return DESIGN_DETAIL_TASK3_LINE_TASK_ID;
  if (isDesignDetailTask4L2TokenTaskId(tid)) return DESIGN_DETAIL_TASK4_LINE_TASK_ID;
  if (isDesignDetailTask5L3TokenTaskId(tid)) return DESIGN_DETAIL_TASK5_LINE_TASK_ID;
  if (isDesignDetailTask55L3TokenTaskId(tid)) return DESIGN_DETAIL_TASK55_LINE_TASK_ID;
  if (isDesignDetailTask51L3TokenTaskId(tid)) return DESIGN_DETAIL_TASK51_LINE_TASK_ID;
  if (isDesignDetailTask52L3TokenTaskId(tid)) return DESIGN_DETAIL_TASK52_LINE_TASK_ID;
  if (isDesignDetailTask53L3TokenTaskId(tid)) return DESIGN_DETAIL_TASK53_LINE_TASK_ID;
  return `task_${tid}`;
}

/** `dd:…:cb:` / `dd:…:cr:` 解析分域；`ft_`+12 位新主键则依绑定 token 的 `taskId` + `surfaceTokens` 推断 */
function taskGraphThemeKeyForFeatureId(
  featureId: string,
  tokenDbTaskId?: string,
  surfaceTokens?: unknown,
): string {
  const fid = String(featureId || '');
  if (/^dd:[^:]+:cb:/.test(fid)) return 'customer_basic';
  if (/^dd:[^:]+:t2l1:/.test(fid)) return DESIGN_DETAIL_TASK2_LINE_TASK_ID;
  const m = /^dd:[^:]+:cr:([^:]+):/.exec(fid);
  if (m?.[1]) return m[1];
  if (/^ft_[0-9]{12}$/.test(fid) && tokenDbTaskId) {
    if (isDesignDetailTask2L1TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK2_LINE_TASK_ID;
    if (isDesignDetailTask3L2TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK3_LINE_TASK_ID;
    if (isDesignDetailTask4L2TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK4_LINE_TASK_ID;
    if (isDesignDetailTask5L3TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK5_LINE_TASK_ID;
    if (isDesignDetailTask55L3TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK55_LINE_TASK_ID;
    if (isDesignDetailTask0TokenTaskId(tokenDbTaskId)) return 'toolbox_primitive';
    if (isDesignDetailTask7L4TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK7_LINE_TASK_ID;
    if (isDesignDetailTask8L45TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK8_LINE_TASK_ID;
    if (isDesignDetailTask85L475TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK85_LINE_TASK_ID;
    if (isDesignDetailTask6L3TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK6_LINE_TASK_ID;
    if (isDesignDetailTask65L3TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK65_LINE_TASK_ID;
    if (isDesignDetailTask9L5TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK9_LINE_TASK_ID;
    if (isDesignDetailTask10L5TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK10_LINE_TASK_ID;
    if (isDesignDetailTask51L3TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK51_LINE_TASK_ID;
    if (isDesignDetailTask52L3TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK52_LINE_TASK_ID;
    if (isDesignDetailTask53L3TokenTaskId(tokenDbTaskId)) return DESIGN_DETAIL_TASK53_LINE_TASK_ID;
    if (isTask1TokenDbTaskId(tokenDbTaskId)) {
      return taskGraphThemeKeyForTask1MergedToken(surfaceTokens);
    }
  }
  return 'task_misc';
}

/** 两波「需求提炼」写入间隔超过该值（毫秒）则切分为 `cr-0` / `cr-1`；否则视为同一批次（全 `cr-0`）。仅用于 `requirementSyncGeneration === 0` 的旧数据兼容 */
const TASK_GRAPH_PILL_BATCH_GAP_MS = 10 * 60 * 1000;

/** `pillBatchKey` 中 `cr-{n}` 的最大 n（与前端样式档位数一致） */
const TASK_GRAPH_PILL_BATCH_REQUIREMENT_MAX_CR_INDEX = 7;

/**
 * 按 `DesignDetailTaskToken.createdAt` 对**需求向** token 行（`tokens` 路径属需求分域）做**单次**最大间隔切分，得到至多两档 `cr-0`、`cr-1`（旧数据兜底）。
 */
function pillBatchKeysForRequirementTokenRows(
  rows: Array<{ tokenId: string; createdAt: Date }>,
): Map<string, string> {
  const out = new Map<string, string>();
  if (!rows.length) return out;
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (sorted.length === 1) {
    out.set(sorted[0]!.tokenId, 'cr-0');
    return out;
  }
  let maxGap = 0;
  let splitAfter = -1;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const g = sorted[i + 1]!.createdAt.getTime() - sorted[i]!.createdAt.getTime();
    if (g > maxGap) {
      maxGap = g;
      splitAfter = i;
    }
  }
  if (maxGap < TASK_GRAPH_PILL_BATCH_GAP_MS) {
    for (const r of sorted) out.set(r.tokenId, 'cr-0');
    return out;
  }
  for (let i = 0; i < sorted.length; i += 1) {
    out.set(sorted[i]!.tokenId, i <= splitAfter ? 'cr-0' : 'cr-1');
  }
  return out;
}

export class PrismaProblemCaseRepository implements ProblemCaseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<ProblemCase[]> {
    const items = await this.prisma.problemCase.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return items.map(mapProblemCase);
  }

  async findById(id: string): Promise<ProblemCase | null> {
    const item = await this.prisma.problemCase.findUnique({
      where: { id },
    });

    return item ? mapProblemCase(item) : null;
  }

  async create(input: CreateProblemCaseInput): Promise<ProblemCase> {
    const createContractExtras = pickCreateContractExtras(input);
    const nextBasicInfo = mergeCreateContractExtrasToBasicInfo(undefined, createContractExtras);
    return this.prisma.$transaction(async (tx) => {
      const agg = await tx.problemCase.aggregate({
        where: {
          ownerSubjectId: input.ownerSubjectId ?? null,
          ownerSubjectType: input.ownerSubjectType ?? null,
        },
        _max: { archiveNo: true },
      });
      const nextArchiveNo = (agg._max.archiveNo ?? 0) + 1;
      const item = await tx.problemCase.create({
        data: {
          id: input.id || `problem_${randomUUID().slice(0, 8)}`,
          ownerSubjectId: input.ownerSubjectId ?? null,
          ownerSubjectType: input.ownerSubjectType ?? null,
          ownerUsernameSnapshot: input.ownerUsernameSnapshot ?? null,
          archiveNo: nextArchiveNo,
          customerName: input.customerName,
          customerNeedsOrChallenges: input.customerNeedsOrChallenges,
          customerItStatus: input.customerItStatus,
          projectTimeRequirement: input.projectTimeRequirement,
          basicInfo: nextBasicInfo as Prisma.InputJsonValue | undefined,
          currentMajorStage: 0,
          currentItStrategySubstep: 0,
          completedStages: [],
          workflowAlignCompletedStages: [],
          itGapCompletedStages: [],
          completedTaskIds: [],
        },
      });
      return mapProblemCase(item);
    });
  }

  async update(id: string, updates: UpdateProblemCaseInput): Promise<ProblemCase | null> {
    const payload = sanitizeProblemCaseUpdates(updates);
    const hasIncomingExtras = hasAnyCreateContractExtras(updates);
    const hasBasicInfoUpdate = Object.prototype.hasOwnProperty.call(payload, 'basicInfo');

    if (hasIncomingExtras || hasBasicInfoUpdate) {
      const existing = await this.prisma.problemCase.findUnique({
        where: { id },
        select: { basicInfo: true },
      });
      if (!existing) return null;

      const incomingExtras = pickCreateContractExtras(updates);
      const mergedBasicInfo = mergeCreateContractExtrasToBasicInfo(
        hasBasicInfoUpdate ? payload.basicInfo : existing.basicInfo,
        mergeCreateContractExtras(
          // 若本次显式更新 extras，则以本次为准；未显式更新时保留旧 extras
          readCreateContractExtrasFromBasicInfo(existing.basicInfo),
          incomingExtras,
        ),
      );

      // mergeCreateContractExtrasToBasicInfo 在 extras 为空时返回 undefined；勿写入 payload.basicInfo = undefined，
      // 否则 Prisma/MySQL updateMany 易报 Invalid invocation（回退到商业画布等路径常带 basicInfo 补丁）。
      if (mergedBasicInfo !== undefined) {
        payload.basicInfo = mergedBasicInfo as Prisma.InputJsonValue;
      }
      delete (payload as Record<string, unknown>).requirementDetail;
      delete (payload as Record<string, unknown>).requirementDetailHistory;
      delete (payload as Record<string, unknown>).operationModel;
      delete (payload as Record<string, unknown>).businessStatus;
      delete (payload as Record<string, unknown>).urgencyAnalysis;
      delete (payload as Record<string, unknown>).preliminaryReq;
      delete (payload as Record<string, unknown>).task1PendingPreliminaryRequirement;
      delete (payload as Record<string, unknown>).task1InitialLlmQuery;
    }

    const allowed = pickAllowedProblemCaseUpdatePayload(payload as Record<string, unknown>);
    // 空有效更新：无字段可写时直接返回当前行
    if (Object.keys(allowed).length === 0) {
      return this.findById(id);
    }

    const stripped = stripUndefinedDeep(allowed) as Record<string, unknown>;
    const data = applyDbNullForNullableJsonColumns(
      cloneJsonSerializableForMysql(stripped),
    ) as Prisma.ProblemCaseUpdateInput;

    try {
      await this.prisma.problemCase.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) return null;
      throw error;
    }

    const item = await this.prisma.problemCase.findUnique({
      where: { id },
    });

    return item ? mapProblemCase(item) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.problemCase.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      if (isRecordNotFoundError(error)) return false;
      throw error;
    }
  }

  async getMessages(_caseId: string): Promise<ProblemCaseMessage[]> {
    const items = await this.prisma.problemCaseMessage.findMany({
      where: { caseId: _caseId },
      orderBy: { timestamp: 'asc' },
    });

    return items.map(mapProblemCaseMessage);
  }

  async replaceMessages(caseId: string, messages: ProblemCaseMessage[]): Promise<ProblemCaseMessage[]> {
    await this.prisma.$transaction(async (tx) => {
      await tx.problemCaseMessage.deleteMany({
        where: { caseId },
      });

      if (messages.length === 0) return;

      // 同 id 重复时保留先出现的条目，避免回滚后批量 insert 触发唯一约束 500
      const seenIds = new Set<string>();
      const uniqueOrdered: ProblemCaseMessage[] = [];
      for (const m of messages) {
        const mid = m && m.id != null ? String(m.id).trim() : '';
        if (!mid) {
          throw new Error('replaceMessages: message 缺少非空 id');
        }
        if (seenIds.has(mid)) continue;
        seenIds.add(mid);
        uniqueOrdered.push(m);
      }

      for (const message of uniqueOrdered) {
        const { id, taskId, taskName, role, type, content, timestamp, confirmed, payloadJson, ...payload } = message;
        const mergedPayload = {
          ...(payloadJson && typeof payloadJson === 'object' && !Array.isArray(payloadJson)
            ? payloadJson as Record<string, unknown>
            : {}),
          ...payload,
        };

        const ts = new Date(timestamp);
        if (!Number.isFinite(ts.getTime())) {
          throw new Error(`problemCaseMessage.create: 非法 timestamp（id=${String(id)}）`);
        }

        await tx.problemCaseMessage.create({
          data: {
            id,
            caseId,
            taskId: taskId ?? null,
            taskName: taskName ?? null,
            role: role ?? null,
            type: type ?? null,
            content,
            payloadJson: Object.keys(mergedPayload).length > 0 ? mergedPayload as Prisma.InputJsonValue : undefined,
            confirmed: Boolean(confirmed),
            timestamp: ts,
          },
        });
      }
    });

    return this.getMessages(caseId);
  }

  async appendMessage(caseId: string, message: ProblemCaseMessage): Promise<ProblemCaseMessage> {
    const { id, taskId, taskName, role, type, content, timestamp, confirmed, payloadJson, ...payload } = message;

    const mergedPayload =
      payloadJson && typeof payloadJson === 'object' && !Array.isArray(payloadJson)
        ? { ...(payloadJson as Record<string, unknown>), ...payload }
        : payload;

    return this.prisma.problemCaseMessage
      .create({
        data: {
          id,
          caseId,
          taskId: taskId ?? null,
          taskName: taskName ?? null,
          role: role ?? null,
          type: type ?? null,
          content,
          payloadJson:
            Object.keys(mergedPayload).length > 0 ? (mergedPayload as Prisma.InputJsonValue) : undefined,
          confirmed: Boolean(confirmed),
          timestamp: new Date(timestamp),
        },
      })
      .then((created) => mapProblemCaseMessage(created as any));
  }

  async deleteMessage(caseId: string, messageId: string): Promise<boolean> {
    const res = await this.prisma.problemCaseMessage.deleteMany({
      where: { caseId, id: messageId },
    });
    return res.count > 0;
  }

  async updateMessage(
    caseId: string,
    messageId: string,
    patch: ProblemCaseMessagePatch,
  ): Promise<ProblemCaseMessage | null> {
    const existing = await this.prisma.problemCaseMessage.findFirst({
      where: { caseId, id: messageId },
    });
    if (!existing) return null;

    const data: Record<string, unknown> = {};
    if (patch.content !== undefined) data.content = patch.content;
    if (patch.confirmed !== undefined) data.confirmed = Boolean(patch.confirmed);
    if (patch.timestamp !== undefined) data.timestamp = new Date(patch.timestamp);
    if (patch.role !== undefined) data.role = patch.role ?? null;
    if (patch.type !== undefined) data.type = patch.type ?? null;
    if (patch.taskId !== undefined) data.taskId = patch.taskId ?? null;
    if (patch.taskName !== undefined) data.taskName = patch.taskName ?? null;
    if (patch.payloadJson !== undefined) {
      if (patch.payloadJson === null) {
        data.payloadJson = Prisma.DbNull;
      } else {
        data.payloadJson = patch.payloadJson as Prisma.InputJsonValue;
      }
    }

    if (Object.keys(data).length === 0) {
      const row = await this.prisma.problemCaseMessage.findFirst({ where: { caseId, id: messageId } });
      return row ? mapProblemCaseMessage(row as any) : null;
    }

    const updated = await this.prisma.problemCaseMessage.update({
      where: { id: messageId },
      data: data as Prisma.ProblemCaseMessageUpdateInput,
    });
    return mapProblemCaseMessage(updated as any);
  }

  async getDesignDetailProgressWorkspace(caseId: string): Promise<unknown | null> {
    const row = await this.prisma.designDetailProgressWorkspace.findUnique({
      where: { caseId },
      select: { payload: true },
    });
    return row?.payload ?? null;
  }

  async upsertDesignDetailProgressWorkspace(caseId: string, payload: unknown): Promise<void> {
    const json = stripUndefinedDeep(payload) as Prisma.InputJsonValue;
    await this.prisma.designDetailProgressWorkspace.upsert({
      where: { caseId },
      create: { caseId, payload: json },
      update: { payload: json },
    });
  }

  async deleteDesignDetailProgressWorkspace(caseId: string): Promise<void> {
    await this.prisma.designDetailProgressWorkspace.deleteMany({ where: { caseId } });
  }

  async replaceDesignDetailTask1BasicInfoGraph(
    caseId: string,
    basicInfo: unknown,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    const plan = buildTask1BasicGraphPlan(caseId, basicInfo);
    await this.prisma.$transaction(async (tx) => {
      const basicCandidates = await tx.designDetailTaskToken.findMany({
        where: {
          caseId,
          taskId: {
            in: [DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID, DESIGN_DETAIL_TASK1_LINE_TASK_ID],
          },
        },
        select: { tokenId: true, tokens: true },
      });
      try {
        const priorBasic = basicCandidates.filter((r) => !isRequirementStyleTokenRow(r.tokens));
        console.log('[problem-case:task1-basic-graph] replaceDesignDetailTask1BasicInfoGraph tx', {
          caseId,
          priorBasicTokenRows: priorBasic.length,
          priorTokensSample: priorBasic.slice(0, 3).map((r) => r.tokens),
          insertRowCount: plan.rows.length,
          insertTokensPreview: plan.rows.map((r) => ({ fieldKey: r.fieldKey, tokens: r.tokenSurfaces })),
        });
      } catch {
        /* 诊断日志失败不影响主路径 */
      }
      const basicDeleteIds = basicCandidates
        .filter((r) => !isRequirementStyleTokenRow(r.tokens))
        .map((r) => r.tokenId);
      if (basicDeleteIds.length > 0) {
        await tx.designDetailTaskToken.deleteMany({ where: { tokenId: { in: basicDeleteIds } } });
      }
      for (const row of plan.rows) {
        const tokenId = await allocateNextDesignDetailTaskTokenId(tx, caseId, DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID);
        const tokenRow = await tx.designDetailTaskToken.create({
          data: {
            tokenId,
            caseId,
            taskId: DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
            tokens: row.tokenSurfaces,
          },
        });
        if (row.hasFeature) {
          const featureId = await allocateNextDesignFeatureNumericId12(tx);
          await insertDesignFeatureNodeFeatureRow(tx, {
            featureId,
            tokenId: tokenRow.tokenId,
            tokenSurfaces: row.tokenSurfaces,
            featureValue: row.featureValue,
            operator: '等于',
          });
        }
      }
      for (const link of plan.linkPairs) {
        const sRow = await tx.designFeatureNode.findUnique({
          where: { featureId: link.sourceFeatureId },
          select: { tokenRow: { select: { taskId: true } } },
        });
        const tRow = await tx.designFeatureNode.findUnique({
          where: { featureId: link.targetFeatureId },
          select: { tokenRow: { select: { taskId: true } } },
        });
        const linkKind = inferDesignLogicLinkKind(
          String(sRow?.tokenRow?.taskId ?? ''),
          String(tRow?.tokenRow?.taskId ?? ''),
        );
        const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
        await tx.designLogicLink.create({
          data: {
            linkId,
            sourceFeatureId: link.sourceFeatureId,
            targetFeatureId: link.targetFeatureId,
            weight: link.weight,
            logic: link.logic,
            linkKind,
          },
        });
      }
    });
    return {
      tokenCount: plan.rows.length,
      featureCount: plan.rows.filter((r) => r.hasFeature).length,
      linkCount: plan.linkPairs.length,
    };
  }

  /**
   * 任务 2 L1：按 Target_KV / Extended_Features 各行合并追加 DesignDetailTaskToken 与 DesignFeatureNode（同路径且取值相同则复用既有 feature；同路径不同 value 仅增 feature；新路径增 token；不删除历史任务 2 L1 token、不更新既有 feature 的 value）。
   * 最后按每行 **`evidenceLinks`** 与 **`Token_Validation_Mapping`** 追加 **`DesignLogicLink`**（端点去重）；事务结束后打 **`[problem-case:task2-l1-graph]`** `phase: merge_task2_l1_tx_summary`。
   */
  async replaceTask2L1TargetKvFeatureKeyTokens(
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
      validationStatus?: string;
      evidenceLinks?: ReadonlyArray<{ sourceFeatureId: string; logic: string; weight: number }>;
    }>,
    tokenValidationPlans?: ReadonlyArray<Task2L1TokenValidationLinkPlan>,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    const cid = String(caseId || '').trim();
    const cleaned = rows
      .map((r) => ({
        featureKey: String(r.featureKey || '').trim(),
        operator: r.operator,
        featureValue: r.featureValue,
        valueRefDomain: r.valueRefDomain,
        inferenceSummary: r.inferenceSummary,
        evidenceSource: r.evidenceSource,
        logicRule: r.logicRule,
        inferenceWeight: r.inferenceWeight,
        validationStatus: r.validationStatus,
        evidenceLinks: r.evidenceLinks,
      }))
      .filter((r) => r.featureKey.length > 0);
    let linkInserted = 0;
    let skipEmptySourceId = 0;
    let skipDuplicatePair = 0;
    let skipUnknownSource = 0;
    let skipTvInvalidMapped = 0;
    let skipTvUnknownSourceA = 0;
    let skipTvEmptyTargetId = 0;
    let skipTvUnknownTargetB = 0;
    let skipTvSourceNotT2L1 = 0;
    let skipTvTargetNotT1 = 0;
    let skipTvDuplicatePair = 0;
    let tvLinksInserted = 0;
    let tvReverseCleared = 0;
    /** `Token_Validation_Mapping` 单条跳过/失败原因（限条数，防日志爆） */
    const tvSkipEvents: Array<Record<string, unknown>> = [];
    const pushTvSkip = (evt: Record<string, unknown>) => {
      if (tvSkipEvents.length >= 40) return;
      tvSkipEvents.push(evt);
      try {
        console.warn('[problem-case:task2-l1-graph] skip_token_validation_link', { caseId: cid, ...evt });
      } catch {
        /* ignore */
      }
    };
    const plannedEdges = cleaned.reduce((s, r) => s + (r.evidenceLinks?.length ?? 0), 0);
    const tvPlans = tokenValidationPlans ?? [];
    const plannedTv = tvPlans.length;
    let tokensCreated = 0;
    let featuresCreated = 0;
    await this.prisma.$transaction(async (tx) => {
      const existingTokens = await tx.designDetailTaskToken.findMany({
        where: {
          caseId: cid,
          taskId: { in: [...DESIGN_DETAIL_TASK2_L1_TOKEN_DB_TASK_IDS] },
        },
        include: {
          featureNodes: {
            select: { featureId: true, value: true, operator: true },
          },
        },
      });

      const lookupKeyToTokenId = new Map<string, string>();
      const tokenIdToFeatureIdentities = new Map<
        string,
        Array<{ featureId: string; identity: string }>
      >();

      for (const tok of existingTokens) {
        const surfaces = Array.isArray(tok.tokens) ? tok.tokens.map((x) => String(x)) : [];
        const lk = task2L1TokenLookupKey(surfaces[0] ?? '');
        if (lk && !lookupKeyToTokenId.has(lk)) {
          lookupKeyToTokenId.set(lk, tok.tokenId);
        }
        const identities: Array<{ featureId: string; identity: string }> = [];
        for (const fn of tok.featureNodes) {
          identities.push({
            featureId: fn.featureId,
            identity: task2L1ValueIdentityKey(fn.value, fn.operator),
          });
        }
        tokenIdToFeatureIdentities.set(tok.tokenId, identities);
      }

      const targetFeatureIds: string[] = [];
      const featureKeyToTask2FeatureId = new Map<string, string>();

      for (let i = 0; i < cleaned.length; i++) {
        const row = cleaned[i]!;
        const { featureKey, operator, featureValue, valueRefDomain, inferenceSummary, validationStatus } = row;
        const lookupKey = task2L1TokenLookupKey(featureKey);
        const tokenSurface = designDetailTaskTokenSurfaceChinesePrimary(featureKey) || featureKey;
        const valueForDb = buildTask2L1FeatureNodeValue(
          featureValue === undefined ? null : featureValue,
          valueRefDomain,
          inferenceSummary,
          undefined,
          validationStatus,
        );
        const valueIdentity = task2L1ValueIdentityKey(valueForDb, operator);

        let tokenId = lookupKeyToTokenId.get(lookupKey);
        if (!tokenId) {
          tokenId = await allocateNextDesignDetailTaskTokenId(tx, cid, DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID);
          await tx.designDetailTaskToken.create({
            data: {
              tokenId,
              caseId: cid,
              taskId: DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID,
              tokens: [tokenSurface],
              requirementSyncGeneration: 0,
            },
          });
          lookupKeyToTokenId.set(lookupKey, tokenId);
          tokenIdToFeatureIdentities.set(tokenId, []);
          tokensCreated += 1;
        }

        const existingIdentities = tokenIdToFeatureIdentities.get(tokenId) ?? [];
        const hit = existingIdentities.find((x) => x.identity === valueIdentity);
        let featureId: string;
        if (hit) {
          featureId = hit.featureId;
        } else {
          featureId = await allocateNextDesignFeatureNumericId12(tx);
          await insertDesignFeatureNodeFeatureRow(tx, {
            featureId,
            tokenId,
            tokenSurfaces: [tokenSurface],
            featureValue: valueForDb,
            operator: operator ?? '等于',
          });
          existingIdentities.push({ featureId, identity: valueIdentity });
          tokenIdToFeatureIdentities.set(tokenId, existingIdentities);
          featuresCreated += 1;
        }

        targetFeatureIds.push(featureId);
        const canonKey = normalizeTask2L1MappedFeatureKey(featureKey);
        if (canonKey) featureKeyToTask2FeatureId.set(canonKey, featureId);
        featureKeyToTask2FeatureId.set(featureKey, featureId);
      }
      try {
        console.warn('[problem-case:task2-l1-graph]', {
          phase: 'token_validation_row_map',
          caseId: cid,
          targetKvFeatureKeys: cleaned.map((r) => r.featureKey),
          tvPlanCount: tvPlans.length,
        });
      } catch {
        /* ignore */
      }

      const seenLink = new Set<string>();
      for (let i = 0; i < cleaned.length; i++) {
        const row = cleaned[i]!;
        const targetFeatureId = targetFeatureIds[i]!;
        const links = row.evidenceLinks;
        if (!links?.length) continue;
        for (const L of links) {
          const srcRaw = String(L.sourceFeatureId || '').trim();
          const src = resolveEvidenceLinkSourceFeatureId(srcRaw, featureKeyToTask2FeatureId);
          if (!src) {
            skipEmptySourceId += 1;
            continue;
          }
          const pairKey = `${src}\t${targetFeatureId}`;
          if (seenLink.has(pairKey)) {
            skipDuplicatePair += 1;
            continue;
          }
          const srcNode = await tx.designFeatureNode.findUnique({
            where: { featureId: src },
            select: {
              featureId: true,
              tokenRow: { select: { taskId: true } },
            },
          });
          if (!srcNode) {
            skipUnknownSource += 1;
            try {
              console.warn('[problem-case:task2-l1-graph] skip_logic_link_unknown_source', {
                caseId: cid,
                sourceFeatureId: src,
                sourceFeatureIdRaw: srcRaw,
                targetFeatureId,
                featureKey: row.featureKey,
              });
            } catch {
              /* 诊断日志失败不影响主路径 */
            }
            continue;
          }
          const w =
            typeof L.weight === 'number' && Number.isFinite(L.weight)
              ? Math.min(1, Math.max(0, L.weight))
              : 0.5;
          const logicStr = String(L.logic || '').trim() || '（无说明）';
          const linkKind = inferDesignLogicLinkKind(
            String(srcNode.tokenRow?.taskId ?? ''),
            DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID,
          );
          const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
          await tx.designLogicLink.create({
            data: {
              linkId,
              sourceFeatureId: src,
              targetFeatureId,
              weight: w,
              logic: logicStr,
              linkKind,
            },
          });
          seenLink.add(pairKey);
          linkInserted += 1;
        }
      }

      const tvInsertedBrief: Array<{
        linkId: string;
        sourceFeatureId: string;
        targetFeatureId: string;
        mappedL1FeatureKey: string;
        validationConsistency?: string;
      }> = [];

      if (tvPlans.length > 0) {
        const task2SourceNodes = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: { in: [...DESIGN_DETAIL_TASK2_L1_TOKEN_DB_TASK_IDS] },
            },
          },
          select: { featureId: true },
        });
        tvReverseCleared = await replaceReverseValidationLinksFromSourcesToTask1(
          tx,
          cid,
          task2SourceNodes.map((n) => n.featureId),
        );
        try {
          console.warn('[problem-case:task2-l1-graph]', {
            phase: 'token_validation_links_cleared_before_insert',
            caseId: cid,
            clearedCount: tvReverseCleared,
            task2SourceFeatureCount: task2SourceNodes.length,
            tvPlanCount: tvPlans.length,
          });
        } catch {
          /* ignore */
        }
      }

      for (const tv of tvPlans) {
        const featureIdA = featureKeyToTask2FeatureId.get(tv.mappedL1FeatureKey);
        if (!featureIdA) {
          skipTvInvalidMapped += 1;
          pushTvSkip({
            reason: 'invalid_mapped_l1',
            detail:
              'Mapped_L1_Feature 无法对齐本批 Target_KV 行的 featureKey；须与当次写入的四键之一逐字一致（或经解析器归一后的键）。',
            mappedL1FeatureKey: tv.mappedL1FeatureKey,
            targetFeatureId: tv.targetFeatureId,
            rowFeatureKeys: cleaned.map((r) => r.featureKey),
          });
          continue;
        }
        const featureIdB = String(tv.targetFeatureId || '').trim();
        if (!featureIdB) {
          skipTvEmptyTargetId += 1;
          pushTvSkip({
            reason: 'empty_target_feature_id',
            mappedL1FeatureKey: tv.mappedL1FeatureKey,
            resolvedSourceFeatureIdA: featureIdA,
          });
          continue;
        }
        const pairKeyTv = `${featureIdA}\t${featureIdB}`;
        if (seenLink.has(pairKeyTv)) {
          skipTvDuplicatePair += 1;
          pushTvSkip({
            reason: 'duplicate_pair_vs_seenLink',
            detail:
              '与本事务已写入的边（含 Evidence_Support_Chain）端点键冲突：反向校验使用「任务2源特征 id + TAB + 任务1目标特征 id」作为去重键。',
            pairKeyTv,
            mappedL1FeatureKey: tv.mappedL1FeatureKey,
            targetFeatureId: featureIdB,
            resolvedSourceFeatureIdA: featureIdA,
          });
          continue;
        }
        const srcNodeA = await tx.designFeatureNode.findUnique({
          where: { featureId: featureIdA },
          select: {
            featureId: true,
            tokenRow: { select: { taskId: true } },
          },
        });
        if (!srcNodeA) {
          skipTvUnknownSourceA += 1;
          pushTvSkip({
            reason: 'unknown_source_feature_row',
            resolvedSourceFeatureIdA: featureIdA,
            targetFeatureId: featureIdB,
            mappedL1FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const srcTaskIdA = String(srcNodeA.tokenRow?.taskId ?? '');
        if (!isDesignDetailTask2L1TokenTaskId(srcTaskIdA)) {
          skipTvSourceNotT2L1 += 1;
          pushTvSkip({
            reason: 'source_not_task2_l1_token',
            detail: '源特征须绑定任务 2 L1 token 行（落库 taskId 为中文任务名或线步 id 之一）。',
            resolvedSourceFeatureIdA: featureIdA,
            sourceTokenTaskId: srcTaskIdA,
            targetFeatureId: featureIdB,
            mappedL1FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const tgtNodeB = await tx.designFeatureNode.findUnique({
          where: { featureId: featureIdB },
          select: {
            featureId: true,
            tokenRow: { select: { taskId: true } },
          },
        });
        if (!tgtNodeB) {
          skipTvUnknownTargetB += 1;
          pushTvSkip({
            reason: 'unknown_target_feature',
            detail: 'Target_FeatureID 在本库无对应 DesignFeatureNode（非本案例、已删、或 id 抄错）。',
            targetFeatureId: featureIdB,
            resolvedSourceFeatureIdA: featureIdA,
            mappedL1FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const tgtTaskIdB = String(tgtNodeB.tokenRow?.taskId ?? '');
        if (!isDesignDetailTask1GraphTokenTaskId(tgtTaskIdB)) {
          skipTvTargetNotT1 += 1;
          pushTvSkip({
            reason: 'target_not_task1_token',
            detail:
              '目标特征绑定 token 的 taskId 须为任务 1 图（「任务 1：客户基本情况了解」/customer_basic/customer_requirement）。若误指向任务 2 自身特征会落此分支。',
            targetFeatureId: featureIdB,
            targetTokenTaskId: tgtTaskIdB,
            resolvedSourceFeatureIdA: featureIdA,
            mappedL1FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const linkIdTv = await allocateNextDesignLogicLinkNumericId12(tx);
        const vc = tv.consistencyLabel?.trim() ? tv.consistencyLabel.trim().slice(0, 32) : null;
        await tx.designLogicLink.create({
          data: {
            linkId: linkIdTv,
            sourceFeatureId: featureIdA,
            targetFeatureId: featureIdB,
            weight: tv.validationWeight,
            logic: String(tv.validationLogic || '').trim() || '（无说明）',
            linkKind: 'REVERSE_VALIDATION',
            ...(vc ? { validationConsistency: vc } : {}),
          },
        });
        seenLink.add(pairKeyTv);
        linkInserted += 1;
        tvLinksInserted += 1;
        tvInsertedBrief.push({
          linkId: linkIdTv,
          sourceFeatureId: featureIdA,
          targetFeatureId: featureIdB,
          mappedL1FeatureKey: tv.mappedL1FeatureKey,
          ...(vc ? { validationConsistency: vc } : {}),
        });
      }
      try {
        if (tvInsertedBrief.length > 0) {
          console.warn('[problem-case:task2-l1-graph]', {
            phase: 'token_validation_links_inserted',
            caseId: cid,
            count: tvInsertedBrief.length,
            items: tvInsertedBrief,
          });
        }
      } catch {
        /* ignore */
      }
    });
    try {
      console.warn('[problem-case:task2-l1-graph]', {
        phase: 'merge_task2_l1_tx_summary',
        caseId: cid,
        syncRowCount: cleaned.length,
        tokensCreated,
        featuresCreated,
        plannedEdgesFromParse: plannedEdges,
        plannedTokenValidation: plannedTv,
        linkInserted,
        tvLinksInserted,
        tvReverseCleared,
        tvSkipEventCount: tvSkipEvents.length,
        tvSkipEvents,
        skipEmptySourceId,
        skipDuplicatePair,
        skipUnknownSource,
        skipTvInvalidMapped,
        skipTvUnknownSourceA,
        skipTvEmptyTargetId,
        skipTvUnknownTargetB,
        skipTvSourceNotT2L1,
        skipTvTargetNotT1,
        skipTvDuplicatePair,
        hint:
          skipUnknownSource > 0
            ? '源 featureId 须已存在于本案例 DesignFeatureNode（与任务 2 输入 TSV 第一列一致）；见各条 skip_logic_link_unknown_source'
            : undefined,
        tvHint:
          plannedTv > 0 && tvLinksInserted === 0
            ? 'Token_Validation_Mapping 有解析条数但未写入任何「反向验证」边：请对照 skip_token_validation_link 与 skipTv* 计数；常见原因：Mapped_L1_Feature 与 Target_KV.Feature_Key 不一致、Target_FeatureID 非本案例任务 1 特征、目标 token.taskId 非任务 1、或与 seenLink 证据链键重复。'
            : undefined,
      });
    } catch {
      /* ignore */
    }
    return {
      tokenCount: tokensCreated,
      featureCount: featuresCreated,
      linkCount: linkInserted,
    };
  }

  /**
   * 任务 3 L2：按 **`L2_Business_Inference_Matrix` / `L2_Inference_Matrix`** 内 `Target_KV` 各行写 `DesignDetailTaskToken`（`taskId` = **`DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID`**）及特征、逻辑边；并按 **`Token_Validation_Mapping`** 写 **任务 3 L2 → 任务 1** 的反向验证边（口径对齐任务 2 L1）。
   */
  async replaceTask3L2TargetKvFeatureKeyTokens(
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
      validationStatus?: string;
      evidenceLinks?: ReadonlyArray<{ sourceFeatureId: string; logic: string; weight: number }>;
    }>,
    tokenValidationPlans?: ReadonlyArray<Task2L1TokenValidationLinkPlan>,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    const cid = String(caseId || '').trim();
    const cleaned = rows
      .map((r) => ({
        featureKey: String(r.featureKey || '').trim(),
        operator: r.operator,
        featureValue: r.featureValue,
        valueRefDomain: r.valueRefDomain,
        inferenceSummary: r.inferenceSummary,
        evidenceSource: r.evidenceSource,
        logicRule: r.logicRule,
        inferenceWeight: r.inferenceWeight,
        validationStatus: r.validationStatus,
        evidenceLinks: r.evidenceLinks,
      }))
      .filter((r) => r.featureKey.length > 0);
    let linkInserted = 0;
    let skipEmptySourceId = 0;
    let skipDuplicatePair = 0;
    let skipUnknownSource = 0;
    let skipTvInvalidMapped = 0;
    let skipTvUnknownSourceA = 0;
    let skipTvEmptyTargetId = 0;
    let skipTvUnknownTargetB = 0;
    let skipTvSourceNotT3L2 = 0;
    let skipTvTargetNotT1 = 0;
    let skipTvDuplicatePair = 0;
    let tvLinksInserted = 0;
    const tvSkipEvents: Array<Record<string, unknown>> = [];
    const pushTvSkip = (evt: Record<string, unknown>) => {
      if (tvSkipEvents.length >= 40) return;
      tvSkipEvents.push(evt);
      try {
        console.warn('[problem-case:task3-l2-graph] skip_token_validation_link', { caseId: cid, ...evt });
      } catch {
        /* ignore */
      }
    };
    const plannedEdges = cleaned.reduce((s, r) => s + (r.evidenceLinks?.length ?? 0), 0);
    const tvPlans = tokenValidationPlans ?? [];
    const plannedTv = tvPlans.length;
    await this.prisma.$transaction(async (tx) => {
      await tx.designDetailTaskToken.deleteMany({
        where: {
          caseId: cid,
          taskId: { in: [...DESIGN_DETAIL_TASK3_L2_TOKEN_DB_TASK_IDS] },
        },
      });

      const targetFeatureIds: string[] = [];

      for (let i = 0; i < cleaned.length; i++) {
        const { featureKey, operator, featureValue, valueRefDomain, inferenceSummary, validationStatus } =
          cleaned[i]!;
        const tokenOne = designDetailTaskTokenSurfaceChinesePrimary(featureKey) || featureKey;
        const tokenId = await allocateNextDesignDetailTaskTokenId(tx, cid, DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID);
        const tokenRow = await tx.designDetailTaskToken.create({
          data: {
            tokenId,
            caseId: cid,
            taskId: DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID,
            tokens: [tokenOne],
            requirementSyncGeneration: 0,
          },
        });
        const featureId = await allocateNextDesignFeatureNumericId12(tx);
        const valueForDb = buildTask2L1FeatureNodeValue(
          featureValue === undefined ? null : featureValue,
          valueRefDomain,
          inferenceSummary,
          undefined,
          validationStatus,
        );
        await insertDesignFeatureNodeFeatureRow(tx, {
          featureId,
          tokenId: tokenRow.tokenId,
          tokenSurfaces: [tokenOne],
          featureValue: valueForDb,
          operator: operator ?? '等于',
        });
        targetFeatureIds.push(featureId);
      }

      const featureKeyToTask3FeatureId = new Map<string, string>();
      for (let i = 0; i < cleaned.length; i++) {
        featureKeyToTask3FeatureId.set(cleaned[i]!.featureKey, targetFeatureIds[i]!);
      }

      const seenLink = new Set<string>();
      for (let i = 0; i < cleaned.length; i++) {
        const row = cleaned[i]!;
        const targetFeatureId = targetFeatureIds[i]!;
        const links = row.evidenceLinks;
        if (!links?.length) continue;
        for (const L of links) {
          const srcRaw = String(L.sourceFeatureId || '').trim();
          const src = resolveEvidenceLinkSourceFeatureId(srcRaw, featureKeyToTask3FeatureId);
          if (!src) {
            skipEmptySourceId += 1;
            continue;
          }
          const pairKey = `${src}\t${targetFeatureId}`;
          if (seenLink.has(pairKey)) {
            skipDuplicatePair += 1;
            continue;
          }
          const srcNode = await tx.designFeatureNode.findUnique({
            where: { featureId: src },
            select: {
              featureId: true,
              tokenRow: { select: { taskId: true } },
            },
          });
          if (!srcNode) {
            skipUnknownSource += 1;
            try {
              console.warn('[problem-case:task3-l2-graph] skip_logic_link_unknown_source', {
                caseId: cid,
                sourceFeatureId: src,
                sourceFeatureIdRaw: srcRaw,
                targetFeatureId,
                featureKey: row.featureKey,
              });
            } catch {
              /* 诊断日志失败不影响主路径 */
            }
            continue;
          }
          const w =
            typeof L.weight === 'number' && Number.isFinite(L.weight)
              ? Math.min(1, Math.max(0, L.weight))
              : 0.5;
          const logicStr = String(L.logic || '').trim() || '（无说明）';
          const linkKind = inferDesignLogicLinkKind(
            String(srcNode.tokenRow?.taskId ?? ''),
            DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID,
          );
          const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
          await tx.designLogicLink.create({
            data: {
              linkId,
              sourceFeatureId: src,
              targetFeatureId,
              weight: w,
              logic: logicStr,
              linkKind,
            },
          });
          seenLink.add(pairKey);
          linkInserted += 1;
        }
      }

      const tvInsertedBrief: Array<{
        linkId: string;
        sourceFeatureId: string;
        targetFeatureId: string;
        mappedL2FeatureKey: string;
        validationConsistency?: string;
      }> = [];

      for (const tv of tvPlans) {
        const featureIdA = featureKeyToTask3FeatureId.get(tv.mappedL1FeatureKey);
        if (!featureIdA) {
          skipTvInvalidMapped += 1;
          pushTvSkip({
            reason: 'invalid_mapped_l2',
            detail:
              'Mapped_L2_Feature 无法对齐本批 L2 Target_KV 行的 featureKey；须与当次写入的四键之一一致（或经解析器归一后的键）。',
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
            targetFeatureId: tv.targetFeatureId,
            rowFeatureKeys: cleaned.map((r) => r.featureKey),
          });
          continue;
        }
        const featureIdB = String(tv.targetFeatureId || '').trim();
        if (!featureIdB) {
          skipTvEmptyTargetId += 1;
          pushTvSkip({
            reason: 'empty_target_feature_id',
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
            resolvedSourceFeatureIdA: featureIdA,
          });
          continue;
        }
        const pairKeyTv = `${featureIdA}\t${featureIdB}`;
        if (seenLink.has(pairKeyTv)) {
          skipTvDuplicatePair += 1;
          pushTvSkip({
            reason: 'duplicate_pair_vs_seenLink',
            detail:
              '与本事务已写入的边（含 Evidence_Support_Chain）端点键冲突：反向校验使用「任务3源特征 id + TAB + 任务1目标特征 id」作为去重键。',
            pairKeyTv,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
            targetFeatureId: featureIdB,
            resolvedSourceFeatureIdA: featureIdA,
          });
          continue;
        }
        const srcNodeA = await tx.designFeatureNode.findUnique({
          where: { featureId: featureIdA },
          select: {
            featureId: true,
            tokenRow: { select: { taskId: true } },
          },
        });
        if (!srcNodeA) {
          skipTvUnknownSourceA += 1;
          pushTvSkip({
            reason: 'unknown_source_feature_row',
            resolvedSourceFeatureIdA: featureIdA,
            targetFeatureId: featureIdB,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const srcTaskIdA = String(srcNodeA.tokenRow?.taskId ?? '');
        if (!isDesignDetailTask3L2TokenTaskId(srcTaskIdA)) {
          skipTvSourceNotT3L2 += 1;
          pushTvSkip({
            reason: 'source_not_task3_l2_token',
            detail: '源特征须绑定任务 3 L2 token 行（落库 taskId 为中文任务名或线步 id 之一）。',
            resolvedSourceFeatureIdA: featureIdA,
            sourceTokenTaskId: srcTaskIdA,
            targetFeatureId: featureIdB,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const tgtNodeB = await tx.designFeatureNode.findUnique({
          where: { featureId: featureIdB },
          select: {
            featureId: true,
            tokenRow: { select: { taskId: true } },
          },
        });
        if (!tgtNodeB) {
          skipTvUnknownTargetB += 1;
          pushTvSkip({
            reason: 'unknown_target_feature',
            detail: 'Target_FeatureID 在本库无对应 DesignFeatureNode（非本案例、已删、或 id 抄错）。',
            targetFeatureId: featureIdB,
            resolvedSourceFeatureIdA: featureIdA,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const tgtTaskIdB = String(tgtNodeB.tokenRow?.taskId ?? '');
        if (!isDesignDetailTask1GraphTokenTaskId(tgtTaskIdB)) {
          skipTvTargetNotT1 += 1;
          pushTvSkip({
            reason: 'target_not_task1_token',
            detail:
              '目标特征绑定 token 的 taskId 须为任务 1 图（「任务 1：客户基本情况了解」/customer_basic/customer_requirement）。',
            targetFeatureId: featureIdB,
            targetTokenTaskId: tgtTaskIdB,
            resolvedSourceFeatureIdA: featureIdA,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const linkIdTv = await allocateNextDesignLogicLinkNumericId12(tx);
        const vc = tv.consistencyLabel?.trim() ? tv.consistencyLabel.trim().slice(0, 32) : null;
        await tx.designLogicLink.create({
          data: {
            linkId: linkIdTv,
            sourceFeatureId: featureIdA,
            targetFeatureId: featureIdB,
            weight: tv.validationWeight,
            logic: String(tv.validationLogic || '').trim() || '（无说明）',
            linkKind: 'REVERSE_VALIDATION',
            ...(vc ? { validationConsistency: vc } : {}),
          },
        });
        seenLink.add(pairKeyTv);
        linkInserted += 1;
        tvLinksInserted += 1;
        tvInsertedBrief.push({
          linkId: linkIdTv,
          sourceFeatureId: featureIdA,
          targetFeatureId: featureIdB,
          mappedL2FeatureKey: tv.mappedL1FeatureKey,
          ...(vc ? { validationConsistency: vc } : {}),
        });
      }
      try {
        if (tvInsertedBrief.length > 0) {
          console.warn('[problem-case:task3-l2-graph]', {
            phase: 'token_validation_links_inserted',
            caseId: cid,
            count: tvInsertedBrief.length,
            items: tvInsertedBrief,
          });
        }
      } catch {
        /* ignore */
      }
    });
    try {
      console.warn('[problem-case:task3-l2-graph]', {
        phase: 'replace_task3_l2_tx_summary',
        caseId: cid,
        plannedEdgesFromParse: plannedEdges,
        plannedTokenValidation: plannedTv,
        linkInserted,
        tvLinksInserted,
        tvSkipEventCount: tvSkipEvents.length,
        tvSkipEvents,
        skipEmptySourceId,
        skipDuplicatePair,
        skipUnknownSource,
        skipTvInvalidMapped,
        skipTvUnknownSourceA,
        skipTvEmptyTargetId,
        skipTvUnknownTargetB,
        skipTvSourceNotT3L2,
        skipTvTargetNotT1,
        skipTvDuplicatePair,
        tvHint:
          plannedTv > 0 && tvLinksInserted === 0
            ? 'Token_Validation_Mapping 有解析条数但未写入任何「反向验证」边：请对照 skip_token_validation_link 与 skipTv*；常见原因：Mapped_L2_Feature 与 Target_KV.Feature_Key 不一致、Target_FeatureID 非本案例任务 1 特征、或与 seenLink 证据链键重复。'
            : undefined,
      });
    } catch {
      /* ignore */
    }
    return {
      tokenCount: cleaned.length,
      featureCount: cleaned.length,
      linkCount: linkInserted,
    };
  }

  /**
   * 任务 4 L2：按 `L2_Value_Inference_Matrix.Target_KV` 各行写 `DesignDetailTaskToken`（`taskId` = **`DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID`**）及特征、逻辑边；并按 **`Token_Validation_Mapping`** 写 **任务 4 L2 → 任务 1** 的反向验证边（口径对齐任务 3 L2）。
   */
  async replaceTask4L2TargetKvFeatureKeyTokens(
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
      validationStatus?: string;
      evidenceLinks?: ReadonlyArray<{ sourceFeatureId: string; logic: string; weight: number }>;
    }>,
    tokenValidationPlans?: ReadonlyArray<Task2L1TokenValidationLinkPlan>,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    const cid = String(caseId || '').trim();
    const cleaned = rows
      .map((r) => ({
        featureKey: String(r.featureKey || '').trim(),
        operator: r.operator,
        featureValue: r.featureValue,
        valueRefDomain: r.valueRefDomain,
        inferenceSummary: r.inferenceSummary,
        evidenceSource: r.evidenceSource,
        logicRule: r.logicRule,
        inferenceWeight: r.inferenceWeight,
        validationStatus: r.validationStatus,
        evidenceLinks: r.evidenceLinks,
      }))
      .filter((r) => r.featureKey.length > 0);
    let linkInserted = 0;
    let skipEmptySourceId = 0;
    let skipDuplicatePair = 0;
    let skipUnknownSource = 0;
    let skipTvInvalidMapped = 0;
    let skipTvUnknownSourceA = 0;
    let skipTvEmptyTargetId = 0;
    let skipTvUnknownTargetB = 0;
    let skipTvSourceNotT4L2 = 0;
    let skipTvTargetNotT1 = 0;
    let skipTvDuplicatePair = 0;
    let tvLinksInserted = 0;
    const tvSkipEvents: Array<Record<string, unknown>> = [];
    const pushTvSkip = (evt: Record<string, unknown>) => {
      if (tvSkipEvents.length >= 40) return;
      tvSkipEvents.push(evt);
      try {
        console.warn('[problem-case:task4-l2-graph] skip_token_validation_link', { caseId: cid, ...evt });
      } catch {
        /* ignore */
      }
    };
    const plannedEdges = cleaned.reduce((s, r) => s + (r.evidenceLinks?.length ?? 0), 0);
    const tvPlans = tokenValidationPlans ?? [];
    const plannedTv = tvPlans.length;
    await this.prisma.$transaction(async (tx) => {
      await tx.designDetailTaskToken.deleteMany({
        where: {
          caseId: cid,
          taskId: { in: [...DESIGN_DETAIL_TASK4_L2_TOKEN_DB_TASK_IDS] },
        },
      });

      const targetFeatureIds: string[] = [];

      for (let i = 0; i < cleaned.length; i++) {
        const { featureKey, operator, featureValue, valueRefDomain, inferenceSummary, validationStatus } =
          cleaned[i]!;
        const tokenOne = designDetailTaskTokenSurfaceChinesePrimary(featureKey) || featureKey;
        const tokenId = await allocateNextDesignDetailTaskTokenId(tx, cid, DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID);
        const tokenRow = await tx.designDetailTaskToken.create({
          data: {
            tokenId,
            caseId: cid,
            taskId: DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID,
            tokens: [tokenOne],
            requirementSyncGeneration: 0,
          },
        });
        const featureId = await allocateNextDesignFeatureNumericId12(tx);
        const valueForDb = buildTask2L1FeatureNodeValue(
          featureValue === undefined ? null : featureValue,
          valueRefDomain,
          inferenceSummary,
          undefined,
          validationStatus,
        );
        await insertDesignFeatureNodeFeatureRow(tx, {
          featureId,
          tokenId: tokenRow.tokenId,
          tokenSurfaces: [tokenOne],
          featureValue: valueForDb,
          operator: operator ?? '等于',
        });
        targetFeatureIds.push(featureId);
      }

      const featureKeyToTask4FeatureId = new Map<string, string>();
      for (let i = 0; i < cleaned.length; i++) {
        featureKeyToTask4FeatureId.set(cleaned[i]!.featureKey, targetFeatureIds[i]!);
      }

      const seenLink = new Set<string>();
      for (let i = 0; i < cleaned.length; i++) {
        const row = cleaned[i]!;
        const targetFeatureId = targetFeatureIds[i]!;
        const links = row.evidenceLinks;
        if (!links?.length) continue;
        for (const L of links) {
          const srcRaw = String(L.sourceFeatureId || '').trim();
          const src = resolveEvidenceLinkSourceFeatureId(srcRaw, featureKeyToTask4FeatureId);
          if (!src) {
            skipEmptySourceId += 1;
            continue;
          }
          const pairKey = `${src}\t${targetFeatureId}`;
          if (seenLink.has(pairKey)) {
            skipDuplicatePair += 1;
            continue;
          }
          const srcNode = await tx.designFeatureNode.findUnique({
            where: { featureId: src },
            select: {
              featureId: true,
              tokenRow: { select: { taskId: true } },
            },
          });
          if (!srcNode) {
            skipUnknownSource += 1;
            try {
              console.warn('[problem-case:task4-l2-graph] skip_logic_link_unknown_source', {
                caseId: cid,
                sourceFeatureId: src,
                sourceFeatureIdRaw: srcRaw,
                targetFeatureId,
                featureKey: row.featureKey,
              });
            } catch {
              /* 诊断日志失败不影响主路径 */
            }
            continue;
          }
          const w =
            typeof L.weight === 'number' && Number.isFinite(L.weight)
              ? Math.min(1, Math.max(0, L.weight))
              : 0.5;
          const logicStr = String(L.logic || '').trim() || '（无说明）';
          const linkKind = inferDesignLogicLinkKind(
            String(srcNode.tokenRow?.taskId ?? ''),
            DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID,
          );
          const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
          await tx.designLogicLink.create({
            data: {
              linkId,
              sourceFeatureId: src,
              targetFeatureId,
              weight: w,
              logic: logicStr,
              linkKind,
            },
          });
          seenLink.add(pairKey);
          linkInserted += 1;
        }
      }

      const tvInsertedBrief: Array<{
        linkId: string;
        sourceFeatureId: string;
        targetFeatureId: string;
        mappedL2FeatureKey: string;
        validationConsistency?: string;
      }> = [];

      for (const tv of tvPlans) {
        const featureIdA = featureKeyToTask4FeatureId.get(tv.mappedL1FeatureKey);
        if (!featureIdA) {
          skipTvInvalidMapped += 1;
          pushTvSkip({
            reason: 'invalid_mapped_l2',
            detail:
              'Mapped_L3_Feature / Mapped_L2_Feature 无法对齐本批 Target_KV 行的 featureKey；须与当次写入的 L3 阶段键或固定维度键一致（或经解析器归一后的键）。',
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
            targetFeatureId: tv.targetFeatureId,
            rowFeatureKeys: cleaned.map((r) => r.featureKey),
          });
          continue;
        }
        const featureIdB = String(tv.targetFeatureId || '').trim();
        if (!featureIdB) {
          skipTvEmptyTargetId += 1;
          pushTvSkip({
            reason: 'empty_target_feature_id',
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
            resolvedSourceFeatureIdA: featureIdA,
          });
          continue;
        }
        const pairKeyTv = `${featureIdA}\t${featureIdB}`;
        if (seenLink.has(pairKeyTv)) {
          skipTvDuplicatePair += 1;
          pushTvSkip({
            reason: 'duplicate_pair_vs_seenLink',
            detail:
              '与本事务已写入的边（含 Evidence_Support_Chain）端点键冲突：反向校验使用「任务4源特征 id + TAB + 任务1目标特征 id」作为去重键。',
            pairKeyTv,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
            targetFeatureId: featureIdB,
            resolvedSourceFeatureIdA: featureIdA,
          });
          continue;
        }
        const srcNodeA = await tx.designFeatureNode.findUnique({
          where: { featureId: featureIdA },
          select: {
            featureId: true,
            tokenRow: { select: { taskId: true } },
          },
        });
        if (!srcNodeA) {
          skipTvUnknownSourceA += 1;
          pushTvSkip({
            reason: 'unknown_source_feature_row',
            resolvedSourceFeatureIdA: featureIdA,
            targetFeatureId: featureIdB,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const srcTaskIdA = String(srcNodeA.tokenRow?.taskId ?? '');
        if (!isDesignDetailTask4L2TokenTaskId(srcTaskIdA)) {
          skipTvSourceNotT4L2 += 1;
          pushTvSkip({
            reason: 'source_not_task4_l2_token',
            detail: '源特征须绑定任务 4 L2 token 行（落库 taskId 为中文任务名或线步 id 之一）。',
            resolvedSourceFeatureIdA: featureIdA,
            sourceTokenTaskId: srcTaskIdA,
            targetFeatureId: featureIdB,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const tgtNodeB = await tx.designFeatureNode.findUnique({
          where: { featureId: featureIdB },
          select: {
            featureId: true,
            tokenRow: { select: { taskId: true } },
          },
        });
        if (!tgtNodeB) {
          skipTvUnknownTargetB += 1;
          pushTvSkip({
            reason: 'unknown_target_feature',
            detail: 'Target_FeatureID 在本库无对应 DesignFeatureNode（非本案例、已删、或 id 抄错）。',
            targetFeatureId: featureIdB,
            resolvedSourceFeatureIdA: featureIdA,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const tgtTaskIdB = String(tgtNodeB.tokenRow?.taskId ?? '');
        if (!isDesignDetailTask1GraphTokenTaskId(tgtTaskIdB)) {
          skipTvTargetNotT1 += 1;
          pushTvSkip({
            reason: 'target_not_task1_token',
            detail:
              '目标特征绑定 token 的 taskId 须为任务 1 图（「任务 1：客户基本情况了解」/customer_basic/customer_requirement）。',
            targetFeatureId: featureIdB,
            targetTokenTaskId: tgtTaskIdB,
            resolvedSourceFeatureIdA: featureIdA,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const linkIdTv = await allocateNextDesignLogicLinkNumericId12(tx);
        const vc = tv.consistencyLabel?.trim() ? tv.consistencyLabel.trim().slice(0, 32) : null;
        await tx.designLogicLink.create({
          data: {
            linkId: linkIdTv,
            sourceFeatureId: featureIdA,
            targetFeatureId: featureIdB,
            weight: tv.validationWeight,
            logic: String(tv.validationLogic || '').trim() || '（无说明）',
            linkKind: 'REVERSE_VALIDATION',
            ...(vc ? { validationConsistency: vc } : {}),
          },
        });
        seenLink.add(pairKeyTv);
        linkInserted += 1;
        tvLinksInserted += 1;
        tvInsertedBrief.push({
          linkId: linkIdTv,
          sourceFeatureId: featureIdA,
          targetFeatureId: featureIdB,
          mappedL2FeatureKey: tv.mappedL1FeatureKey,
          ...(vc ? { validationConsistency: vc } : {}),
        });
      }
      try {
        if (tvInsertedBrief.length > 0) {
          console.warn('[problem-case:task4-l2-graph]', {
            phase: 'token_validation_links_inserted',
            caseId: cid,
            count: tvInsertedBrief.length,
            items: tvInsertedBrief,
          });
        }
      } catch {
        /* ignore */
      }
    });
    try {
      console.warn('[problem-case:task4-l2-graph]', {
        phase: 'replace_task4_l2_tx_summary',
        caseId: cid,
        plannedEdgesFromParse: plannedEdges,
        plannedTokenValidation: plannedTv,
        linkInserted,
        tvLinksInserted,
        tvSkipEventCount: tvSkipEvents.length,
        tvSkipEvents,
        skipEmptySourceId,
        skipDuplicatePair,
        skipUnknownSource,
        skipTvInvalidMapped,
        skipTvUnknownSourceA,
        skipTvEmptyTargetId,
        skipTvUnknownTargetB,
        skipTvSourceNotT4L2,
        skipTvTargetNotT1,
        skipTvDuplicatePair,
        tvHint:
          plannedTv > 0 && tvLinksInserted === 0
            ? 'Token_Validation_Mapping 有解析条数但未写入任何「反向验证」边：请对照 skip_token_validation_link 与 skipTv*；常见原因：Mapped_L2_Feature 与 Target_KV.Feature_Key 不一致、Target_FeatureID 非本案例任务 1 特征、或与 seenLink 证据链键重复。'
            : undefined,
      });
    } catch {
      /* ignore */
    }
    return {
      tokenCount: cleaned.length,
      featureCount: cleaned.length,
      linkCount: linkInserted,
    };
  }

  /**
   * 任务 0：全量替换工具箱原语特征（服务端分配 `ft_`+12 位与 `tk_task0_*`，供任务 8/8.5 Evidence 跨层正向归纳）。
   */
  async replaceTask0ToolboxPrimitiveFeatures(
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
  }> {
    const cid = String(caseId || '').trim();
    const empty = { tokenCount: 0, featureCount: 0, linkCount: 0, features: [] as never[] };
    if (!cid) return empty;
    const list = primitives
      .map((p) => ({
        featureKey: String(p.featureKey || '').trim(),
        tokenDisplay: String(p.tokenDisplay || '').trim(),
        toolName: String(p.toolName || '').trim(),
        value: String(p.value || '').trim(),
        operator: String(p.operator || '工具原语').trim() || '工具原语',
      }))
      .filter((p) => p.featureKey && p.value);
    if (!list.length) return empty;

    return this.prisma.$transaction(async (tx) => {
      await tx.designDetailTaskToken.deleteMany({
        where: { caseId: cid, taskId: { in: [...DESIGN_DETAIL_TASK0_TOKEN_DB_TASK_IDS] } },
      });
      const tokenBySurface = new Map<string, string>();
      const features: Array<{
        featureId: string;
        featureKey: string;
        tokenDisplay: string;
        toolName: string;
        value: string;
        operator: string;
      }> = [];
      let tokenCount = 0;
      let featureCount = 0;
      for (const p of list) {
        const surface = designDetailTaskTokenSurfaceChinesePrimary(
          p.tokenDisplay || `${p.featureKey}/${p.toolName}`,
        );
        let tokenId = tokenBySurface.get(surface);
        if (!tokenId) {
          tokenId = await allocateNextDesignDetailTaskTokenId(tx, cid, DESIGN_DETAIL_TASK0_GRAPH_TASK_ID);
          await tx.designDetailTaskToken.create({
            data: {
              tokenId,
              caseId: cid,
              taskId: DESIGN_DETAIL_TASK0_GRAPH_TASK_ID,
              tokens: [surface],
            },
          });
          tokenBySurface.set(surface, tokenId);
          tokenCount += 1;
        }
        const featureId = await allocateNextDesignFeatureNumericId12(tx);
        await insertDesignFeatureNodeFeatureRow(tx, {
          featureId,
          tokenId,
          tokenSurfaces: [surface],
          featureValue: { name: p.value, value_ref_domain: p.value },
          operator: p.operator,
        });
        featureCount += 1;
        features.push({
          featureId,
          featureKey: p.featureKey,
          tokenDisplay: surface,
          toolName: p.toolName,
          value: p.value,
          operator: p.operator,
        });
      }
      try {
        console.warn('[problem-case:task0-toolbox-primitives]', {
          phase: 'prisma_tx_done',
          caseId: cid,
          dbTaskId: DESIGN_DETAIL_TASK0_GRAPH_TASK_ID,
          tokenCount,
          featureCount,
          sampleFeatureIds: features.slice(0, 3).map((f) => f.featureId),
        });
      } catch {
        /* ignore */
      }
      return { tokenCount, featureCount, linkCount: 0, features };
    });
  }

  async replaceTask5L3TargetKvFeatureKeyTokens(
    caseId: string,
    rows: ReadonlyArray<{
      featureKey: string;
      operator?: string;
      featureValue?: unknown;
      valueRefDomain?: string;
      inferenceSummary?: string;
      /** 任务 5.1：`business_function` */
      businessFunction?: string;
      causalitySummary?: string;
      evidenceSource?: string;
      logicRule?: string;
      /** 任务 9 二级菜单：`Belongs_To_Primary_Module`（历史契约） */
      belongsToPrimaryModule?: string;
      /** 任务 9 系统一级模块：`Tech_Host_Platform` */
      techHostPlatform?: string;
      inferenceWeight?: number;
      validationStatus?: string;
      evidenceLinks?: ReadonlyArray<{ sourceFeatureId: string; logic: string; weight: number }>;
      /** 任务 10：`Induction_Type` / `Parent_Table_Ref` 等（层内主→子/基础正向归纳边） */
      inductionType?: string;
      parentTableRef?: string;
      introductionReason?: string;
      referenceFieldMapping?: string;
      associatedCapabilityUnit?: string;
      fieldsSchemaTree?: unknown;
    }>,
    tokenValidationPlans?: ReadonlyArray<Task2L1TokenValidationLinkPlan>,
    scope?: {
      graphTaskId?: string;
      tokenDbTaskIds?: readonly string[];
    },
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    const graphTaskId = scope?.graphTaskId ?? DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID;
    const tokenDbTaskIds = scope?.tokenDbTaskIds ?? DESIGN_DETAIL_TASK5_L3_TOKEN_DB_TASK_IDS;
    const cid = String(caseId || '').trim();
    const cleaned = rows
      .map((r) => ({
        featureKey: String(r.featureKey || '').trim(),
        operator: r.operator,
        featureValue: r.featureValue,
        valueRefDomain: r.valueRefDomain,
        inferenceSummary: r.inferenceSummary,
        businessFunction: r.businessFunction,
        causalitySummary: r.causalitySummary,
        evidenceSource: r.evidenceSource,
        logicRule: r.logicRule,
        belongsToPrimaryModule: r.belongsToPrimaryModule,
        techHostPlatform: r.techHostPlatform,
        inferenceWeight: r.inferenceWeight,
        validationStatus: r.validationStatus,
        evidenceLinks: r.evidenceLinks,
        inductionType: r.inductionType,
        parentTableRef: r.parentTableRef,
        introductionReason: r.introductionReason,
        referenceFieldMapping: r.referenceFieldMapping,
        associatedCapabilityUnit: r.associatedCapabilityUnit,
        fieldsSchemaTree: r.fieldsSchemaTree,
      }))
      .filter((r) => r.featureKey.length > 0);
    let linkInserted = 0;
    let skipEmptySourceId = 0;
    let skipDuplicatePair = 0;
    let skipUnknownSource = 0;
    let skipTvInvalidMapped = 0;
    let skipTvUnknownSourceA = 0;
    let skipTvEmptyTargetId = 0;
    let skipTvUnknownTargetB = 0;
    let skipTvSourceNotT5L3 = 0;
    let skipTvTargetNotT1 = 0;
    let skipTvDuplicatePair = 0;
    let tvLinksInserted = 0;
    const tvSkipEvents: Array<Record<string, unknown>> = [];
    const pushTvSkip = (evt: Record<string, unknown>) => {
      if (tvSkipEvents.length >= 40) return;
      tvSkipEvents.push(evt);
      try {
        console.warn('[problem-case:task5-l3-graph] skip_token_validation_link', { caseId: cid, ...evt });
      } catch {
        /* ignore */
      }
    };
    const plannedEdges = cleaned.reduce((s, r) => s + (r.evidenceLinks?.length ?? 0), 0);
    const tvPlans = tokenValidationPlans ?? [];
    const plannedTv = tvPlans.length;
    await this.prisma.$transaction(async (tx) => {
      await tx.designDetailTaskToken.deleteMany({
        where: {
          caseId: cid,
          taskId: { in: [...tokenDbTaskIds] },
        },
      });

      const targetFeatureIds: string[] = [];

      for (let i = 0; i < cleaned.length; i++) {
        const row = cleaned[i]!;
        const {
          featureKey,
          operator,
          featureValue,
          valueRefDomain,
          inferenceSummary,
          businessFunction,
          techHostPlatform,
          validationStatus,
          associatedCapabilityUnit,
          fieldsSchemaTree,
        } = row;
        const tokenOne = designDetailTaskTokenSurfaceChinesePrimary(featureKey) || featureKey;
        const tokenId = await allocateNextDesignDetailTaskTokenId(tx, cid, graphTaskId);
        const tokenRow = await tx.designDetailTaskToken.create({
          data: {
            tokenId,
            caseId: cid,
            taskId: graphTaskId,
            tokens: [tokenOne],
            requirementSyncGeneration: 0,
          },
        });
        const featureId = await allocateNextDesignFeatureNumericId12(tx);
        const valueForDb = buildTask2L1FeatureNodeValue(
          featureValue === undefined ? null : featureValue,
          valueRefDomain,
          inferenceSummary,
          techHostPlatform,
          validationStatus,
          graphTaskId === DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID
            ? {
                inductionType: row.inductionType,
                parentTableRef: row.parentTableRef,
                introductionReason: row.introductionReason,
                referenceFieldMapping: row.referenceFieldMapping,
              }
            : undefined,
          isDesignDetailTask52L3TokenTaskId(graphTaskId)
            ? {
                associatedCapabilityUnit,
                fieldsSchemaTree,
              }
            : undefined,
          businessFunction,
        );
        await insertDesignFeatureNodeFeatureRow(tx, {
          featureId,
          tokenId: tokenRow.tokenId,
          tokenSurfaces: [tokenOne],
          featureValue: valueForDb,
          operator: operator ?? '等于',
        });
        targetFeatureIds.push(featureId);
      }

      const featureKeyToTask5FeatureId = new Map<string, string>();
      for (let i = 0; i < cleaned.length; i++) {
        const row = cleaned[i]!;
        const fid = targetFeatureIds[i]!;
        if (graphTaskId === DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID) {
          featureKeyToTask5FeatureId.set(
            task55VsmTargetKvDedupKey(row.featureKey, row.featureValue),
            fid,
          );
          const phase = task55VsmStagePhaseNameFromDesignFeatureValue(
            buildTask2L1FeatureNodeValue(
              row.featureValue,
              row.valueRefDomain,
              row.inferenceSummary,
            ),
          );
          if (phase) featureKeyToTask5FeatureId.set(phase, fid);
        } else {
          featureKeyToTask5FeatureId.set(row.featureKey, fid);
        }
      }
      /** 任务 5.3：为拓扑内每个环节落库「流程环节」特征（供 5.1/5.2→环节 正向归纳边挂接） */
      const stepFeatureIdByKey = new Map<string, string>();
      if (graphTaskId === DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID) {
        const stepPlans = buildTask53WorkflowStepFeaturePlans(cleaned);
        for (const plan of stepPlans) {
          const tokenOne = plan.tokenSurface;
          const tokenId = await allocateNextDesignDetailTaskTokenId(tx, cid, graphTaskId);
          const tokenRow = await tx.designDetailTaskToken.create({
            data: {
              tokenId,
              caseId: cid,
              taskId: graphTaskId,
              tokens: [tokenOne],
              requirementSyncGeneration: 0,
            },
          });
          const featureId = await allocateNextDesignFeatureNumericId12(tx);
          const valueForDb = buildTask2L1FeatureNodeValue(
            plan.featureValue,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
          );
          await insertDesignFeatureNodeFeatureRow(tx, {
            featureId,
            tokenId: tokenRow.tokenId,
            tokenSurfaces: [tokenOne],
            featureValue: valueForDb,
            operator: '等于',
          });
          stepFeatureIdByKey.set(
            task53StepFeatureIdMapKey(plan.workflowIndex, plan.stepName),
            featureId,
          );
          featureKeyToTask5FeatureId.set(plan.tokenSurface, featureId);
        }
      }
      /** 任务 5.1：Evidence_Support_Chain 须对齐任务 1~4 与任务 5 已落库 FeatureID / token 表面（否则全部 skip_logic_link_unknown_source） */
      if (graphTaskId === DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID) {
        const upstreamNodesT51 = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: {
                in: [
                  DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
                  'customer_basic',
                  ...DESIGN_DETAIL_TASK2_L1_TOKEN_DB_TASK_IDS,
                  ...DESIGN_DETAIL_TASK3_L2_TOKEN_DB_TASK_IDS,
                  ...DESIGN_DETAIL_TASK4_L2_TOKEN_DB_TASK_IDS,
                  ...DESIGN_DETAIL_TASK5_L3_TOKEN_DB_TASK_IDS,
                ],
              },
            },
          },
          select: {
            featureId: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        for (const fn of upstreamNodesT51) {
          const fid = String(fn.featureId || '').trim();
          if (fid) featureKeyToTask5FeatureId.set(fid, fid);
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (surface && !featureKeyToTask5FeatureId.has(surface)) {
            featureKeyToTask5FeatureId.set(surface, fid);
          }
        }
      }
      /** 任务 5.5：Derived_Feature 常引用任务 5 宏观键名，须并入已落库的任务 5 特征 id */
      if (graphTaskId === DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID) {
        const macroNodes = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: { in: [...DESIGN_DETAIL_TASK5_L3_TOKEN_DB_TASK_IDS] },
            },
          },
          select: {
            featureId: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        for (const fn of macroNodes) {
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (surface && !featureKeyToTask5FeatureId.has(surface)) {
            featureKeyToTask5FeatureId.set(surface, fn.featureId);
          }
        }
      }
      /** 任务 5.2：TVM 源特征须对齐任务 5.1「业务能力单元」 */
      if (isDesignDetailTask52L3TokenTaskId(graphTaskId)) {
        const task51Nodes = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: { in: [...DESIGN_DETAIL_TASK51_L3_TOKEN_DB_TASK_IDS] },
            },
          },
          select: {
            featureId: true,
            value: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        for (const fn of task51Nodes) {
          const fid = String(fn.featureId || '').trim();
          if (!fid) continue;
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (surface !== '业务能力单元') continue;
          featureKeyToTask5FeatureId.set(fid, fid);
          const val = fn.value;
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            const rec = val as Record<string, unknown>;
            const fv = rec.Feature_Value ?? rec.feature_value;
            const name = String(fv ?? '').trim();
            if (name) featureKeyToTask5FeatureId.set(name, fid);
          } else {
            const name = String(val ?? '').trim();
            if (name) featureKeyToTask5FeatureId.set(name, fid);
          }
        }
      }
      /** 任务 5.3：TVM 源特征须对齐任务 5.2「业务能力字段集」与任务 5.1「业务能力单元」 */
      if (graphTaskId === DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID) {
        const upstreamNodes = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: {
                in: [
                  ...DESIGN_DETAIL_TASK52_L3_TOKEN_DB_TASK_IDS,
                  ...DESIGN_DETAIL_TASK51_L3_TOKEN_DB_TASK_IDS,
                ],
              },
            },
          },
          select: {
            featureId: true,
            value: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        for (const fn of upstreamNodes) {
          const fid = String(fn.featureId || '').trim();
          if (!fid) continue;
          featureKeyToTask5FeatureId.set(fid, fid);
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (
            surface === '业务能力字段集' ||
            surface === '业务能力单元' ||
            (surface && !featureKeyToTask5FeatureId.has(surface))
          ) {
            featureKeyToTask5FeatureId.set(surface, fid);
          }
          const val = fn.value;
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            const rec = val as Record<string, unknown>;
            const fv = rec.Feature_Value ?? rec.feature_value;
            const name = String(fv ?? '').trim();
            if (name) featureKeyToTask5FeatureId.set(name, fid);
          } else {
            const name = String(val ?? '').trim();
            if (name) featureKeyToTask5FeatureId.set(name, fid);
          }
        }
      }
      /** 任务 6.5：Evidence 须对齐 5.5 / 5.3 / 任务 6 关键场景 / 任务 1 化石 FeatureID */
      if (graphTaskId === DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID) {
        const upstreamNodesT65 = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: {
                in: [
                  ...DESIGN_DETAIL_TASK55_L3_TOKEN_DB_TASK_IDS,
                  ...DESIGN_DETAIL_TASK53_L3_TOKEN_DB_TASK_IDS,
                  ...DESIGN_DETAIL_TASK6_L3_TOKEN_DB_TASK_IDS,
                  DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
                  'customer_basic',
                ],
              },
            },
          },
          select: {
            featureId: true,
            value: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        registerTask6UpstreamEvidenceAliases(
          upstreamNodesT65.map((fn) => ({
            featureId: String(fn.featureId || ''),
            value: fn.value,
          })),
          featureKeyToTask5FeatureId,
        );
        for (const fn of upstreamNodesT65) {
          const fid = String(fn.featureId || '').trim();
          if (fid) featureKeyToTask5FeatureId.set(fid, fid);
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (surface && !featureKeyToTask5FeatureId.has(surface)) {
            featureKeyToTask5FeatureId.set(surface, fid);
          }
        }
      }
      /** 任务 6：Evidence 须对齐 5.5 价值流阶段、5.3 核心工作流与任务 1 痛点雷达 */
      if (graphTaskId === DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID) {
        const upstreamNodes = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: {
                in: [
                  ...DESIGN_DETAIL_TASK55_L3_TOKEN_DB_TASK_IDS,
                  ...DESIGN_DETAIL_TASK53_L3_TOKEN_DB_TASK_IDS,
                  DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
                  'customer_basic',
                ],
              },
            },
          },
          select: {
            featureId: true,
            value: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        registerTask6UpstreamEvidenceAliases(
          upstreamNodes.map((fn) => ({
            featureId: String(fn.featureId || ''),
            value: fn.value,
          })),
          featureKeyToTask5FeatureId,
        );
        for (const fn of upstreamNodes) {
          const fid = String(fn.featureId || '').trim();
          if (fid) featureKeyToTask5FeatureId.set(fid, fid);
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (surface && !featureKeyToTask5FeatureId.has(surface)) {
            featureKeyToTask5FeatureId.set(surface, fid);
          }
        }
      }
      /** 任务 7：Evidence 须对齐任务 6 关键场景 FeatureID 与任务 1 业务对象 FeatureID */
      if (graphTaskId === DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID) {
        const upstreamNodesT7 = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: {
                in: [
                  ...DESIGN_DETAIL_TASK6_L3_TOKEN_DB_TASK_IDS,
                  DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
                  'customer_basic',
                ],
              },
            },
          },
          select: {
            featureId: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        for (const fn of upstreamNodesT7) {
          const fid = String(fn.featureId || '').trim();
          if (fid) featureKeyToTask5FeatureId.set(fid, fid);
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (surface && !featureKeyToTask5FeatureId.has(surface)) {
            featureKeyToTask5FeatureId.set(surface, fid);
          }
        }
      }
      /** 任务 8：Evidence 须对齐任务 7 协作节点、任务 0 工具原语与任务 1 业务对象 FeatureID */
      if (graphTaskId === DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID) {
        const upstreamNodesT8 = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: {
                in: [
                  ...DESIGN_DETAIL_TASK0_TOKEN_DB_TASK_IDS,
                  ...DESIGN_DETAIL_TASK7_L4_TOKEN_DB_TASK_IDS,
                  DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
                  'customer_basic',
                ],
              },
            },
          },
          select: {
            featureId: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        for (const fn of upstreamNodesT8) {
          const fid = String(fn.featureId || '').trim();
          if (fid) featureKeyToTask5FeatureId.set(fid, fid);
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (surface && !featureKeyToTask5FeatureId.has(surface)) {
            featureKeyToTask5FeatureId.set(surface, fid);
          }
        }
      }
      /** 任务 8.5：Evidence 双源须对齐任务 8 状态转移矩阵与任务 0 工具原语 FeatureID */
      if (graphTaskId === DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID) {
        const upstreamNodesT85 = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: {
                in: [
                  ...DESIGN_DETAIL_TASK0_TOKEN_DB_TASK_IDS,
                  ...DESIGN_DETAIL_TASK8_L45_TOKEN_DB_TASK_IDS,
                ],
              },
            },
          },
          select: {
            featureId: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        for (const fn of upstreamNodesT85) {
          const fid = String(fn.featureId || '').trim();
          if (fid) featureKeyToTask5FeatureId.set(fid, fid);
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (surface && !featureKeyToTask5FeatureId.has(surface)) {
            featureKeyToTask5FeatureId.set(surface, fid);
          }
        }
      }
      /** 任务 9：Evidence 须对齐任务 8.5 物理外挂 FeatureID 与任务 0 工具原语 */
      if (graphTaskId === DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID) {
        const upstreamNodesT9 = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: {
                in: [
                  ...DESIGN_DETAIL_TASK85_L475_TOKEN_DB_TASK_IDS,
                  ...DESIGN_DETAIL_TASK0_TOKEN_DB_TASK_IDS,
                ],
              },
            },
          },
          select: {
            featureId: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        for (const fn of upstreamNodesT9) {
          const fid = String(fn.featureId || '').trim();
          if (fid) featureKeyToTask5FeatureId.set(fid, fid);
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (surface && !featureKeyToTask5FeatureId.has(surface)) {
            featureKeyToTask5FeatureId.set(surface, fid);
          }
        }
        registerTask9SyncBatchEvidenceIdAliases(cleaned, targetFeatureIds, featureKeyToTask5FeatureId);
      }

      if (graphTaskId === DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID) {
        for (let i = 0; i < cleaned.length; i++) {
          const row = cleaned[i]!;
          const evidenceLinks = ensureTask6ScenarioEvidenceLinks(row, featureKeyToTask5FeatureId);
          cleaned[i] = { ...row, evidenceLinks: [...evidenceLinks] };
        }
      }

      const seenLink = new Set<string>();
      for (let i = 0; i < cleaned.length; i++) {
        const row = cleaned[i]!;
        const targetFeatureId = targetFeatureIds[i]!;
        const links = row.evidenceLinks;
        if (!links?.length) continue;
        for (const L of links) {
          const srcRaw = String(L.sourceFeatureId || '').trim();
          const src = resolveEvidenceLinkSourceFeatureId(srcRaw, featureKeyToTask5FeatureId);
          if (!src) {
            skipEmptySourceId += 1;
            continue;
          }
          const pairKey = `${src}\t${targetFeatureId}`;
          if (seenLink.has(pairKey)) {
            skipDuplicatePair += 1;
            continue;
          }
          const srcNode = await tx.designFeatureNode.findUnique({
            where: { featureId: src },
            select: {
              featureId: true,
              tokenRow: { select: { taskId: true } },
            },
          });
          if (!srcNode) {
            skipUnknownSource += 1;
            try {
              console.warn('[problem-case:task5-l3-graph] skip_logic_link_unknown_source', {
                caseId: cid,
                sourceFeatureId: src,
                sourceFeatureIdRaw: srcRaw,
                targetFeatureId,
                featureKey: row.featureKey,
              });
            } catch {
              /* 诊断日志失败不影响主路径 */
            }
            continue;
          }
          const w =
            typeof L.weight === 'number' && Number.isFinite(L.weight)
              ? Math.min(1, Math.max(0, L.weight))
              : 0.5;
          const logicStr = String(L.logic || '').trim() || '（无说明）';
          const tgtNodeForKind = await tx.designFeatureNode.findUnique({
            where: { featureId: targetFeatureId },
            select: { tokenRow: { select: { taskId: true } } },
          });
          const linkKind = inferDesignLogicLinkKind(
            String(srcNode.tokenRow?.taskId ?? ''),
            String(tgtNodeForKind?.tokenRow?.taskId ?? ''),
          );
          const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
          await tx.designLogicLink.create({
            data: {
              linkId,
              sourceFeatureId: src,
              targetFeatureId,
              weight: w,
              logic: logicStr,
              linkKind,
            },
          });
          seenLink.add(pairKey);
          linkInserted += 1;
        }
      }

      /** 任务 5.1：价值主张 → 业务能力单元（层内正向归纳，与 Evidence 上游链并存） */
      if (graphTaskId === DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID) {
        const intraVpLinks = buildTask51IntraValuePropositionForwardLinks(cleaned, targetFeatureIds);
        for (const plan of intraVpLinks) {
          const src = String(plan.sourceFeatureId || '').trim();
          const tgt = String(plan.targetFeatureId || '').trim();
          if (!src || !tgt || src === tgt) continue;
          const pairKey = `${src}\t${tgt}`;
          if (seenLink.has(pairKey)) continue;
          const srcNode = await tx.designFeatureNode.findUnique({
            where: { featureId: src },
            select: {
              featureId: true,
              tokenRow: { select: { taskId: true } },
            },
          });
          const tgtNode = await tx.designFeatureNode.findUnique({
            where: { featureId: tgt },
            select: { tokenRow: { select: { taskId: true } } },
          });
          if (!srcNode || !tgtNode) continue;
          const linkKind = inferDesignLogicLinkKind(
            String(srcNode.tokenRow?.taskId ?? ''),
            String(tgtNode.tokenRow?.taskId ?? ''),
          );
          const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
          await tx.designLogicLink.create({
            data: {
              linkId,
              sourceFeatureId: src,
              targetFeatureId: tgt,
              weight: plan.weight,
              logic: String(plan.logic || '').trim() || '（无说明）',
              linkKind,
            },
          });
          seenLink.add(pairKey);
          linkInserted += 1;
        }
      }
      /** 任务 5.2：业务能力单元（任务 5.1）→ 业务能力字段集（层间正向归纳） */
      if (isDesignDetailTask52L3TokenTaskId(graphTaskId)) {
        const task51CapNodes = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: { in: [...DESIGN_DETAIL_TASK51_L3_TOKEN_DB_TASK_IDS] },
            },
          },
          select: {
            featureId: true,
            value: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        const capabilityUnits: Task52CapabilityUnitRef[] = [];
        for (const fn of task51CapNodes) {
          const fid = String(fn.featureId || '').trim();
          if (!fid) continue;
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (surface !== '业务能力单元') continue;
          const label = task7SyncRowFeatureValueLabel(fn.value);
          capabilityUnits.push({ featureId: fid, label: label || fid });
        }
        const intraCapToFieldSetLinks = buildTask52CapabilityUnitToFieldSetForwardLinks(
          cleaned,
          targetFeatureIds,
          capabilityUnits,
        );
        for (const plan of intraCapToFieldSetLinks) {
          const src = String(plan.sourceFeatureId || '').trim();
          const tgt = String(plan.targetFeatureId || '').trim();
          if (!src || !tgt || src === tgt) continue;
          const pairKey = `${src}\t${tgt}`;
          if (seenLink.has(pairKey)) continue;
          const srcNode = await tx.designFeatureNode.findUnique({
            where: { featureId: src },
            select: {
              featureId: true,
              tokenRow: { select: { taskId: true } },
            },
          });
          const tgtNode = await tx.designFeatureNode.findUnique({
            where: { featureId: tgt },
            select: { tokenRow: { select: { taskId: true } } },
          });
          if (!srcNode || !tgtNode) continue;
          const linkKind = inferDesignLogicLinkKind(
            String(srcNode.tokenRow?.taskId ?? ''),
            String(tgtNode.tokenRow?.taskId ?? ''),
          );
          const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
          await tx.designLogicLink.create({
            data: {
              linkId,
              sourceFeatureId: src,
              targetFeatureId: tgt,
              weight: plan.weight,
              logic: String(plan.logic || '').trim() || '（无说明）',
              linkKind,
            },
          });
          seenLink.add(pairKey);
          linkInserted += 1;
        }
      }
      /** 任务 5.3：5.1 业务能力单元 / 5.2 字段集 → 流程环节；关键工作流 → 环节 */
      if (graphTaskId === DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID && stepFeatureIdByKey.size > 0) {
        const task51CapNodes = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: { in: [...DESIGN_DETAIL_TASK51_L3_TOKEN_DB_TASK_IDS] },
            },
          },
          select: {
            featureId: true,
            value: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        const capabilityUnits: Task52CapabilityUnitRef[] = [];
        for (const fn of task51CapNodes) {
          const fid = String(fn.featureId || '').trim();
          if (!fid) continue;
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (surface !== '业务能力单元') continue;
          const label = task7SyncRowFeatureValueLabel(fn.value);
          capabilityUnits.push({ featureId: fid, label: label || fid });
        }
        const task52FsNodes = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: { in: [...DESIGN_DETAIL_TASK52_L3_TOKEN_DB_TASK_IDS] },
            },
          },
          select: {
            featureId: true,
            value: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        const fieldSets: Task52FieldSetRef[] = [];
        for (const fn of task52FsNodes) {
          const fid = String(fn.featureId || '').trim();
          if (!fid) continue;
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (surface !== '业务能力字段集') continue;
          const label = task7SyncRowFeatureValueLabel(fn.value);
          fieldSets.push({ featureId: fid, label: label || fid });
        }
        const task53ForwardLinks = buildTask53WorkflowAndStepForwardLinks(
          cleaned,
          targetFeatureIds,
          stepFeatureIdByKey,
          capabilityUnits,
          fieldSets,
        );
        for (const plan of task53ForwardLinks) {
          const src = String(plan.sourceFeatureId || '').trim();
          const tgt = String(plan.targetFeatureId || '').trim();
          if (!src || !tgt || src === tgt) continue;
          const pairKey = `${src}\t${tgt}`;
          if (seenLink.has(pairKey)) continue;
          const srcNode = await tx.designFeatureNode.findUnique({
            where: { featureId: src },
            select: {
              featureId: true,
              tokenRow: { select: { taskId: true } },
            },
          });
          const tgtNode = await tx.designFeatureNode.findUnique({
            where: { featureId: tgt },
            select: { tokenRow: { select: { taskId: true } } },
          });
          if (!srcNode || !tgtNode) continue;
          const linkKind = inferDesignLogicLinkKind(
            String(srcNode.tokenRow?.taskId ?? ''),
            String(tgtNode.tokenRow?.taskId ?? ''),
          );
          const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
          await tx.designLogicLink.create({
            data: {
              linkId,
              sourceFeatureId: src,
              targetFeatureId: tgt,
              weight: plan.weight,
              logic: String(plan.logic || '').trim() || '（无说明）',
              linkKind,
            },
          });
          seenLink.add(pairKey);
          linkInserted += 1;
        }
      }
      /** 任务 7：所属业务流程 → 协作节点（流程内正向归纳，与 Evidence 上游链并存） */
      if (graphTaskId === DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID) {
        const intraFlowLinks = buildTask7IntraFlowForwardLinks(cleaned, targetFeatureIds);
        for (const plan of intraFlowLinks) {
          const src = String(plan.sourceFeatureId || '').trim();
          const tgt = String(plan.targetFeatureId || '').trim();
          if (!src || !tgt || src === tgt) continue;
          const pairKey = `${src}\t${tgt}`;
          if (seenLink.has(pairKey)) continue;
          const srcNode = await tx.designFeatureNode.findUnique({
            where: { featureId: src },
            select: {
              featureId: true,
              tokenRow: { select: { taskId: true } },
            },
          });
          const tgtNode = await tx.designFeatureNode.findUnique({
            where: { featureId: tgt },
            select: { tokenRow: { select: { taskId: true } } },
          });
          if (!srcNode || !tgtNode) continue;
          const linkKind = inferDesignLogicLinkKind(
            String(srcNode.tokenRow?.taskId ?? ''),
            String(tgtNode.tokenRow?.taskId ?? ''),
          );
          const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
          await tx.designLogicLink.create({
            data: {
              linkId,
              sourceFeatureId: src,
              targetFeatureId: tgt,
              weight: plan.weight,
              logic: String(plan.logic || '').trim() || '（无说明）',
              linkKind,
            },
          });
          seenLink.add(pairKey);
          linkInserted += 1;
        }
      }
      /** 任务 10 层内：主表 → 基础表正向归纳（`Parent_Table_Ref` + `Introduction_Reason` + `Inference_Weight`） */
      if (graphTaskId === DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID) {
        const intraMainBaseLinks = buildTask10MainTableToBaseForwardLinks(cleaned, targetFeatureIds);
        for (const plan of intraMainBaseLinks) {
          const src = String(plan.sourceFeatureId || '').trim();
          const tgt = String(plan.targetFeatureId || '').trim();
          if (!src || !tgt || src === tgt) continue;
          const pairKey = `${src}\t${tgt}`;
          if (seenLink.has(pairKey)) continue;
          const srcNode = await tx.designFeatureNode.findUnique({
            where: { featureId: src },
            select: {
              featureId: true,
              tokenRow: { select: { taskId: true } },
            },
          });
          const tgtNode = await tx.designFeatureNode.findUnique({
            where: { featureId: tgt },
            select: { tokenRow: { select: { taskId: true } } },
          });
          if (!srcNode || !tgtNode) continue;
          const linkKind = inferDesignLogicLinkKind(
            String(srcNode.tokenRow?.taskId ?? ''),
            String(tgtNode.tokenRow?.taskId ?? ''),
          );
          const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
          await tx.designLogicLink.create({
            data: {
              linkId,
              sourceFeatureId: src,
              targetFeatureId: tgt,
              weight: plan.weight,
              logic: String(plan.logic || '').trim() || '（无说明）',
              linkKind,
            },
          });
          seenLink.add(pairKey);
          linkInserted += 1;
        }
        try {
          if (intraMainBaseLinks.length > 0) {
            console.warn('[problem-case:task10-l5-technical-ddl-target-kv]', {
              caseId: cid,
              phase: 'intra_layer_main_to_base_forward_links',
              count: intraMainBaseLinks.length,
            });
          }
        } catch {
          /* ignore */
        }
      }

      /** 任务 10：Schema 表 → 物理表字段子节点（columns 裂变）+ 字段 → 任务 1 化石血缘边 */
      if (graphTaskId === DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID) {
        const fieldPlans = buildTask10SchemaFieldFissionPlans(cleaned, targetFeatureIds);
        for (const plan of fieldPlans) {
          const tokenOne = '物理表字段';
          const tokenId = await allocateNextDesignDetailTaskTokenId(tx, cid, graphTaskId);
          const tokenRowField = await tx.designDetailTaskToken.create({
            data: {
              tokenId,
              caseId: cid,
              taskId: graphTaskId,
              tokens: [tokenOne],
              requirementSyncGeneration: 0,
            },
          });
          const fieldFeatureId = await allocateNextDesignFeatureNumericId12(tx);
          const fieldValueObj: Record<string, unknown> = {
            field_name: plan.fieldName,
            data_type: plan.dataType,
            constraints: plan.constraints,
            source_feature_id: plan.sourceFeatureId,
            parent_table_feature_id: plan.tableFeatureId,
            parent_table_name: plan.tableName,
          };
          await insertDesignFeatureNodeFeatureRow(tx, {
            featureId: fieldFeatureId,
            tokenId: tokenRowField.tokenId,
            tokenSurfaces: [tokenOne],
            featureValue: buildTask2L1FeatureNodeValue(fieldValueObj),
            operator: '等于',
          });

          const tableFid = String(plan.tableFeatureId || '').trim();
          if (tableFid && tableFid !== fieldFeatureId) {
            const pairKeyTf = `${tableFid}\t${fieldFeatureId}`;
            if (!seenLink.has(pairKeyTf)) {
              const srcNode = await tx.designFeatureNode.findUnique({
                where: { featureId: tableFid },
                select: { tokenRow: { select: { taskId: true } } },
              });
              const tgtNode = await tx.designFeatureNode.findUnique({
                where: { featureId: fieldFeatureId },
                select: { tokenRow: { select: { taskId: true } } },
              });
              if (srcNode && tgtNode) {
                const linkKind = inferDesignLogicLinkKind(
                  String(srcNode.tokenRow?.taskId ?? ''),
                  String(tgtNode.tokenRow?.taskId ?? ''),
                );
                const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
                await tx.designLogicLink.create({
                  data: {
                    linkId,
                    sourceFeatureId: tableFid,
                    targetFeatureId: fieldFeatureId,
                    weight: 1,
                    logic: `表「${plan.tableName}」内生强依赖纵向归纳：包含物理列「${plan.fieldName}」`,
                    linkKind,
                  },
                });
                seenLink.add(pairKeyTf);
                linkInserted += 1;
              }
            }
          }

          const fossilFid = String(plan.sourceFeatureId || '').trim();
          if (fossilFid && fossilFid !== fieldFeatureId) {
            const pairKeyFf = `${fieldFeatureId}\t${fossilFid}`;
            if (!seenLink.has(pairKeyFf)) {
              const fossilNode = await tx.designFeatureNode.findUnique({
                where: { featureId: fossilFid },
                select: { tokenRow: { select: { taskId: true } } },
              });
              const fieldNode = await tx.designFeatureNode.findUnique({
                where: { featureId: fieldFeatureId },
                select: { tokenRow: { select: { taskId: true } } },
              });
              if (fossilNode && fieldNode) {
                const linkKind = inferDesignLogicLinkKind(
                  String(fieldNode.tokenRow?.taskId ?? ''),
                  String(fossilNode.tokenRow?.taskId ?? ''),
                );
                const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
                await tx.designLogicLink.create({
                  data: {
                    linkId,
                    sourceFeatureId: fieldFeatureId,
                    targetFeatureId: fossilFid,
                    weight: 1,
                    logic: `像素级字段数据对账血缘：列「${plan.fieldName}」映射任务1化石 ${fossilFid}`,
                    linkKind,
                  },
                });
                seenLink.add(pairKeyFf);
                linkInserted += 1;
              }
            }
          }
        }
        try {
          if (fieldPlans.length > 0) {
            console.warn('[problem-case:task10-l5-technical-ddl-target-kv]', {
              caseId: cid,
              phase: 'schema_field_fission',
              count: fieldPlans.length,
            });
          }
        } catch {
          /* ignore */
        }
      }

      /** 任务 10：Evidence 须对齐任务 9 系统一级模块与任务 8.5 物理外挂 FeatureID */
      if (graphTaskId === DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID) {
        const upstreamNodesT10 = await tx.designFeatureNode.findMany({
          where: {
            tokenRow: {
              caseId: cid,
              taskId: {
                in: [
                  ...DESIGN_DETAIL_TASK9_L5_TOKEN_DB_TASK_IDS,
                  ...DESIGN_DETAIL_TASK85_L475_TOKEN_DB_TASK_IDS,
                ],
              },
            },
          },
          select: {
            featureId: true,
            tokenRow: { select: { tokens: true } },
          },
        });
        for (const fn of upstreamNodesT10) {
          const fid = String(fn.featureId || '').trim();
          if (fid) featureKeyToTask5FeatureId.set(fid, fid);
          const tokJson = fn.tokenRow?.tokens;
          let surface = '';
          if (Array.isArray(tokJson) && tokJson.length > 0) {
            surface = String(tokJson[0] ?? '').trim();
          } else if (typeof tokJson === 'string') {
            try {
              const parsed = JSON.parse(tokJson) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                surface = String(parsed[0] ?? '').trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (surface && !featureKeyToTask5FeatureId.has(surface)) {
            featureKeyToTask5FeatureId.set(surface, fid);
          }
        }
      }

      /** 任务 9：系统一级模块 → 二级功能菜单（模块内正向归纳，供逻辑树分块渲染） */
      if (graphTaskId === DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID) {
        const intraModuleMenuLinks = buildTask9IntraModuleMenuForwardLinks(cleaned, targetFeatureIds);
        for (const plan of intraModuleMenuLinks) {
          const src = String(plan.sourceFeatureId || '').trim();
          const tgt = String(plan.targetFeatureId || '').trim();
          if (!src || !tgt || src === tgt) continue;
          const pairKey = `${src}\t${tgt}`;
          if (seenLink.has(pairKey)) continue;
          const srcNode = await tx.designFeatureNode.findUnique({
            where: { featureId: src },
            select: {
              featureId: true,
              tokenRow: { select: { taskId: true } },
            },
          });
          const tgtNode = await tx.designFeatureNode.findUnique({
            where: { featureId: tgt },
            select: { tokenRow: { select: { taskId: true } } },
          });
          if (!srcNode || !tgtNode) continue;
          const linkKind = inferDesignLogicLinkKind(
            String(srcNode.tokenRow?.taskId ?? ''),
            String(tgtNode.tokenRow?.taskId ?? ''),
          );
          const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
          await tx.designLogicLink.create({
            data: {
              linkId,
              sourceFeatureId: src,
              targetFeatureId: tgt,
              weight: plan.weight,
              logic: String(plan.logic || '').trim() || '（无说明）',
              linkKind,
            },
          });
          seenLink.add(pairKey);
          linkInserted += 1;
        }
      }

      const tvInsertedBrief: Array<{
        linkId: string;
        sourceFeatureId: string;
        targetFeatureId: string;
        mappedL2FeatureKey: string;
        validationConsistency?: string;
      }> = [];

      for (const tv of tvPlans) {
        const featureIdA = featureKeyToTask5FeatureId.get(tv.mappedL1FeatureKey);
        if (!featureIdA) {
          skipTvInvalidMapped += 1;
          pushTvSkip({
            reason: 'invalid_mapped_l3',
            detail:
              'Mapped_L3_Feature 无法对齐本批 Target_KV 行的 featureKey；须与当次写入的 VSM 阶段键或固定维度键一致（或经解析器归一后的键）。',
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
            targetFeatureId: tv.targetFeatureId,
            rowFeatureKeys: cleaned.map((r) => r.featureKey),
          });
          continue;
        }
        const featureIdB = String(tv.targetFeatureId || '').trim();
        if (!featureIdB) {
          skipTvEmptyTargetId += 1;
          pushTvSkip({
            reason: 'empty_target_feature_id',
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
            resolvedSourceFeatureIdA: featureIdA,
          });
          continue;
        }
        const pairKeyTv = `${featureIdA}\t${featureIdB}`;
        if (seenLink.has(pairKeyTv)) {
          skipTvDuplicatePair += 1;
          pushTvSkip({
            reason: 'duplicate_pair_vs_seenLink',
            detail:
              '与本事务已写入的边（含 Evidence_Support_Chain）端点键冲突：反向校验使用「任务5源特征 id + TAB + 任务1目标特征 id」作为去重键。',
            pairKeyTv,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
            targetFeatureId: featureIdB,
            resolvedSourceFeatureIdA: featureIdA,
          });
          continue;
        }
        const srcNodeA = await tx.designFeatureNode.findUnique({
          where: { featureId: featureIdA },
          select: {
            featureId: true,
            tokenRow: { select: { taskId: true } },
          },
        });
        if (!srcNodeA) {
          skipTvUnknownSourceA += 1;
          pushTvSkip({
            reason: 'unknown_source_feature_row',
            resolvedSourceFeatureIdA: featureIdA,
            targetFeatureId: featureIdB,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const srcTaskIdA = String(srcNodeA.tokenRow?.taskId ?? '');
        const sourceOk =
          graphTaskId === DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID
            ? isDesignDetailTask7L4TokenTaskId(srcTaskIdA) ||
              isDesignDetailTask6L3TokenTaskId(srcTaskIdA)
            : graphTaskId === DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID
              ? isDesignDetailTask65L3TokenTaskId(srcTaskIdA)
              : graphTaskId === DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID
                ? isDesignDetailTask6L3TokenTaskId(srcTaskIdA)
                : isDesignDetailTask52L3TokenTaskId(graphTaskId)
                  ? isDesignDetailTask51L3TokenTaskId(srcTaskIdA)
                  : graphTaskId === DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID
                    ? isDesignDetailTask55L3TokenTaskId(srcTaskIdA)
                    : isDesignDetailTask5L3TokenTaskId(srcTaskIdA);
        if (!sourceOk) {
          skipTvSourceNotT5L3 += 1;
          pushTvSkip({
            reason: 'source_not_task5_l3_token',
            detail:
              '源特征须绑定本步 L3 token 行（任务 5 / 5.5 / 6 落库 taskId，与 graphTaskId 一致）。',
            resolvedSourceFeatureIdA: featureIdA,
            sourceTokenTaskId: srcTaskIdA,
            targetFeatureId: featureIdB,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const tgtNodeB = await tx.designFeatureNode.findUnique({
          where: { featureId: featureIdB },
          select: {
            featureId: true,
            tokenRow: { select: { taskId: true } },
          },
        });
        if (!tgtNodeB) {
          skipTvUnknownTargetB += 1;
          pushTvSkip({
            reason: 'unknown_target_feature',
            detail: 'Target_FeatureID 在本库无对应 DesignFeatureNode（非本案例、已删、或 id 抄错）。',
            targetFeatureId: featureIdB,
            resolvedSourceFeatureIdA: featureIdA,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const tgtTaskIdB = String(tgtNodeB.tokenRow?.taskId ?? '');
        if (!isDesignDetailTask1GraphTokenTaskId(tgtTaskIdB)) {
          skipTvTargetNotT1 += 1;
          pushTvSkip({
            reason: 'target_not_task1_token',
            detail:
              '目标特征绑定 token 的 taskId 须为任务 1 图（「任务 1：客户基本情况了解」/customer_basic/customer_requirement）。',
            targetFeatureId: featureIdB,
            targetTokenTaskId: tgtTaskIdB,
            resolvedSourceFeatureIdA: featureIdA,
            mappedL2FeatureKey: tv.mappedL1FeatureKey,
          });
          continue;
        }
        const linkIdTv = await allocateNextDesignLogicLinkNumericId12(tx);
        const vc = tv.consistencyLabel?.trim() ? tv.consistencyLabel.trim().slice(0, 32) : null;
        await tx.designLogicLink.create({
          data: {
            linkId: linkIdTv,
            sourceFeatureId: featureIdA,
            targetFeatureId: featureIdB,
            weight: tv.validationWeight,
            logic: String(tv.validationLogic || '').trim() || '（无说明）',
            linkKind: 'REVERSE_VALIDATION',
            ...(vc ? { validationConsistency: vc } : {}),
          },
        });
        seenLink.add(pairKeyTv);
        linkInserted += 1;
        tvLinksInserted += 1;
        tvInsertedBrief.push({
          linkId: linkIdTv,
          sourceFeatureId: featureIdA,
          targetFeatureId: featureIdB,
          mappedL2FeatureKey: tv.mappedL1FeatureKey,
          ...(vc ? { validationConsistency: vc } : {}),
        });
      }
      try {
        if (tvInsertedBrief.length > 0) {
          console.warn('[problem-case:task5-l3-graph]', {
            phase: 'token_validation_links_inserted',
            caseId: cid,
            count: tvInsertedBrief.length,
            items: tvInsertedBrief,
          });
        }
      } catch {
        /* ignore */
      }
    });
    try {
      console.warn('[problem-case:task5-l3-graph]', {
        phase: 'replace_task5_l3_tx_summary',
        caseId: cid,
        plannedEdgesFromParse: plannedEdges,
        plannedTokenValidation: plannedTv,
        linkInserted,
        tvLinksInserted,
        tvSkipEventCount: tvSkipEvents.length,
        tvSkipEvents,
        skipEmptySourceId,
        skipDuplicatePair,
        skipUnknownSource,
        skipTvInvalidMapped,
        skipTvUnknownSourceA,
        skipTvEmptyTargetId,
        skipTvUnknownTargetB,
        skipTvSourceNotT5L3,
        skipTvTargetNotT1,
        skipTvDuplicatePair,
        tvHint:
          plannedTv > 0 && tvLinksInserted === 0
            ? 'Token_Validation_Mapping 有解析条数但未写入任何「反向验证」边：请对照 skip_token_validation_link 与 skipTv*；常见原因：Mapped_L2_Feature 与 Target_KV.Feature_Key 不一致、Target_FeatureID 非本案例任务 1 特征、或与 seenLink 证据链键重复。'
            : undefined,
      });
    } catch {
      /* ignore */
    }
    return {
      tokenCount: cleaned.length,
      featureCount: cleaned.length,
      linkCount: linkInserted,
    };
  }

  async replaceCustomerRequirementSectionGraph(
    caseId: string,
    sectionKey: string,
    sectionLabelZh: string,
    requirementParsed: unknown,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    const sectionPayload =
      requirementParsed && typeof requirementParsed === 'object' && !Array.isArray(requirementParsed)
        ? (requirementParsed as Record<string, unknown>)[sectionKey]
        : undefined;
    const plan =
      sectionKey === 'painPointRadar'
        ? buildPainPointRadarSectionPlan(
            caseId,
            sectionKey,
            sectionLabelZh,
            sectionPayload,
            requirementParsed && typeof requirementParsed === 'object' && !Array.isArray(requirementParsed)
              ? (requirementParsed as Record<string, unknown>)
              : undefined,
          )
        : buildCustomerReqSectionGraphPlan(caseId, sectionKey, sectionLabelZh, sectionPayload);
    await this.prisma.$transaction(async (tx) => {
      /** 每轮用户「需求提炼」以 `businessContext` 为首分域触发时 +1；同轮其它分域沿用该值，避免同秒内批量写入导致 `createdAt` 无法分两批 */
      let requirementSyncGeneration: number;
      if (sectionKey === 'businessContext') {
        const bumped = await tx.problemCase.update({
          where: { id: caseId },
          data: { designDetailRequirementSyncGen: { increment: 1 } },
          select: { designDetailRequirementSyncGen: true },
        });
        requirementSyncGeneration = bumped.designDetailRequirementSyncGen;
      } else {
        const cur = await tx.problemCase.findUnique({
          where: { id: caseId },
          select: { designDetailRequirementSyncGen: true },
        });
        let gen = cur?.designDetailRequirementSyncGen ?? 0;
        if (gen <= 0) {
          gen = 1;
          await tx.problemCase.update({
            where: { id: caseId },
            data: { designDetailRequirementSyncGen: 1 },
          });
        }
        requirementSyncGeneration = gen;
      }

      const existing = await tx.designDetailTaskToken.findMany({
        where: {
          caseId,
          taskId: {
            in: [
              DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
              DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID,
              DESIGN_DETAIL_TASK1_LINE_TASK_ID,
            ],
          },
        },
        select: { tokenId: true, tokens: true },
      });
      /** 同分域下同 `tokens` 路径 → 复用 `tokenId`，不删旧行（多轮需求提炼追加） */
      const surfaceKeyToTokenId = new Map<string, string>();
      for (const row of existing) {
        if (!customerRequirementTokenRowBelongsToSection(sectionKey, row.tokens)) continue;
        const k = customerRequirementTokenSurfacesKey(row.tokens);
        if (!surfaceKeyToTokenId.has(k)) surfaceKeyToTokenId.set(k, row.tokenId);
      }

      for (const row of plan.rows) {
        const sk = customerRequirementTokenSurfacesKey(row.tokenSurfaces);
        let tokenId = surfaceKeyToTokenId.get(sk);
        if (!tokenId) {
          const newTokenId = await allocateNextDesignDetailTaskTokenId(
            tx,
            caseId,
            DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
          );
          const tokenRow = await tx.designDetailTaskToken.create({
            data: {
              tokenId: newTokenId,
              caseId,
              taskId: DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
              tokens: row.tokenSurfaces,
              requirementSyncGeneration,
            },
          });
          tokenId = tokenRow.tokenId;
          surfaceKeyToTokenId.set(sk, tokenId);
        } else {
          await tx.designDetailTaskToken.update({
            where: { tokenId },
            data: {
              tokens: row.tokenSurfaces as Prisma.InputJsonValue,
              requirementSyncGeneration,
            },
          });
        }

        if (row.hasFeature) {
          const existingNode = await tx.designFeatureNode.findFirst({
            where: {
              tokenId,
              surfaceTokens: { equals: row.tokenSurfaces as Prisma.InputJsonValue },
            },
            select: { featureId: true },
          });
          if (existingNode) {
            await tx.designFeatureNode.update({
              where: { featureId: existingNode.featureId },
              data: {
                tokenId,
                surfaceTokens: row.tokenSurfaces as Prisma.InputJsonValue,
                value:
                  row.featureValue === undefined || row.featureValue === null
                    ? Prisma.JsonNull
                    : (row.featureValue as Prisma.InputJsonValue),
                operator: row.operator ?? '等于',
              },
            });
          } else {
            const newFeatureId = await allocateNextDesignFeatureNumericId12(tx);
            await insertDesignFeatureNodeFeatureRow(tx, {
              featureId: newFeatureId,
              tokenId,
              tokenSurfaces: row.tokenSurfaces,
              featureValue: row.featureValue,
              operator: row.operator ?? '等于',
            });
          }
        }
      }

      for (const link of plan.linkPairs) {
        const dup = await tx.designLogicLink.findFirst({
          where: {
            sourceFeatureId: link.sourceFeatureId,
            targetFeatureId: link.targetFeatureId,
          },
          select: { linkId: true },
        });
        if (dup) continue;
        const sRow = await tx.designFeatureNode.findUnique({
          where: { featureId: link.sourceFeatureId },
          select: { tokenRow: { select: { taskId: true } } },
        });
        const tRow = await tx.designFeatureNode.findUnique({
          where: { featureId: link.targetFeatureId },
          select: { tokenRow: { select: { taskId: true } } },
        });
        const linkKind = inferDesignLogicLinkKind(
          String(sRow?.tokenRow?.taskId ?? ''),
          String(tRow?.tokenRow?.taskId ?? ''),
        );
        const linkId = await allocateNextDesignLogicLinkNumericId12(tx);
        await tx.designLogicLink.create({
          data: {
            linkId,
            sourceFeatureId: link.sourceFeatureId,
            targetFeatureId: link.targetFeatureId,
            weight: link.weight,
            logic: link.logic,
            linkKind,
          },
        });
      }
    });
    return {
      tokenCount: plan.rows.length,
      featureCount: plan.rows.filter((r) => r.hasFeature).length,
      linkCount: plan.linkPairs.length,
    };
  }

  /**
   * 任务 1 L1 原始实然特征集：按模型 `Feature_ID`（`ft_`+12 位）与 token 路径合并追加/更新特征（**不写** `DesignLogicLink`）。
   */
  async replaceTask1L1OriginalFeatureMatrixGraph(
    caseId: string,
    syncRows: ReadonlyArray<Task1L1OriginalFeatureSyncRow>,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    const plan = buildTask1L1OriginalFeatureGraphPlan([...syncRows]);
    let tokensTouched = 0;
    let featuresTouched = 0;
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.designDetailTaskToken.findMany({
        where: {
          caseId,
          taskId: {
            in: [
              DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
              DESIGN_DETAIL_TASK1_LINE_TASK_ID,
            ],
          },
        },
        select: { tokenId: true, tokens: true },
      });
      const surfaceKeyToTokenId = new Map<string, string>();
      for (const row of existing) {
        const k = customerRequirementTokenSurfacesKey(row.tokens);
        if (!surfaceKeyToTokenId.has(k)) surfaceKeyToTokenId.set(k, row.tokenId);
      }

      for (const row of plan.rows) {
        if (!row.hasFeature) continue;
        const sk = customerRequirementTokenSurfacesKey(row.tokenSurfaces);
        let tokenId = surfaceKeyToTokenId.get(sk);
        if (!tokenId) {
          const newTokenId = await allocateNextDesignDetailTaskTokenId(
            tx,
            caseId,
            DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
          );
          await tx.designDetailTaskToken.create({
            data: {
              tokenId: newTokenId,
              caseId,
              taskId: DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
              tokens: row.tokenSurfaces,
              requirementSyncGeneration: 0,
            },
          });
          tokenId = newTokenId;
          surfaceKeyToTokenId.set(sk, tokenId);
          tokensTouched += 1;
        }

        let featureId = isValidTask1L1ModelFeatureId(row.featureId) ? row.featureId : '';
        if (featureId) {
          const hit = await tx.designFeatureNode.findUnique({
            where: { featureId },
            select: {
              featureId: true,
              tokenRow: { select: { caseId: true } },
            },
          });
          if (hit && hit.tokenRow.caseId !== caseId) {
            featureId = '';
          }
        }
        if (!featureId) {
          featureId = await allocateNextDesignFeatureNumericId12(tx);
        }

        const existingNode = await tx.designFeatureNode.findUnique({
          where: { featureId },
          select: { featureId: true },
        });
        if (existingNode) {
          await tx.designFeatureNode.update({
            where: { featureId },
            data: {
              tokenId,
              surfaceTokens: row.tokenSurfaces as Prisma.InputJsonValue,
              value:
                row.featureValue === undefined || row.featureValue === null
                  ? Prisma.JsonNull
                  : (row.featureValue as Prisma.InputJsonValue),
              operator: row.operator ?? '等于',
            },
          });
        } else {
          await insertDesignFeatureNodeFeatureRow(tx, {
            featureId,
            tokenId,
            tokenSurfaces: row.tokenSurfaces,
            featureValue: row.featureValue,
            operator: row.operator ?? '等于',
          });
        }
        featuresTouched += 1;
      }
    });
    return {
      tokenCount: tokensTouched,
      featureCount: featuresTouched,
      linkCount: 0,
    };
  }

  async deleteDesignDetailTaskGraph(caseId: string, taskId: string): Promise<void> {
    const tid = String(taskId || '').trim();
    const task1DbIds = [
      DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
      DESIGN_DETAIL_TASK1_LINE_TASK_ID,
      DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID,
    ];
    try {
    /** 与旧 `customer_basic` / `customer_requirement` 分库存一致：工商删非需求路径；需求删需求路径（统一 taskId 后仅靠 `tokens` 区分） */
    if (tid === DESIGN_DETAIL_TASK1_LINE_TASK_ID || tid === DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID) {
      const candidates = await this.prisma.designDetailTaskToken.findMany({
        where: { caseId, taskId: { in: task1DbIds } },
        select: { tokenId: true, tokens: true },
      });
      const toDelete = candidates.filter((r) => !isRequirementStyleTokenRow(r.tokens)).map((r) => r.tokenId);
      if (toDelete.length > 0) {
        await this.prisma.designDetailTaskToken.deleteMany({ where: { tokenId: { in: toDelete } } });
      }
      return;
    }
    if (tid === DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID) {
      const candidates = await this.prisma.designDetailTaskToken.findMany({
        where: { caseId, taskId: { in: task1DbIds } },
        select: { tokenId: true, tokens: true, taskId: true },
      });
      const toDelete = candidates
        .filter(
          (r) =>
            String(r.taskId || '').trim() === DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID ||
            isRequirementStyleTokenRow(r.tokens),
        )
        .map((r) => r.tokenId);
      if (toDelete.length > 0) {
        await this.prisma.designDetailTaskToken.deleteMany({ where: { tokenId: { in: toDelete } } });
      }
      await this.prisma.problemCase.update({
        where: { id: caseId },
        data: { designDetailRequirementSyncGen: 0 },
      });
      return;
    }

    if (isDesignDetailTask2L1TokenTaskId(tid)) {
      await this.prisma.designDetailInferenceRevisionRecord.deleteMany({
        where: { caseId, taskId: DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID },
      });
      await this.prisma.designDetailTaskToken.deleteMany({
        where: {
          caseId,
          taskId: { in: [...DESIGN_DETAIL_TASK2_L1_TOKEN_DB_TASK_IDS] },
        },
      });
      return;
    }

    if (isDesignDetailTask3L2TokenTaskId(tid)) {
      await this.prisma.designDetailInferenceRevisionRecord.deleteMany({
        where: { caseId, taskId: DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID },
      });
      await this.prisma.designDetailTaskToken.deleteMany({
        where: {
          caseId,
          taskId: { in: [...DESIGN_DETAIL_TASK3_L2_TOKEN_DB_TASK_IDS] },
        },
      });
      return;
    }

    if (isDesignDetailTask4L2TokenTaskId(tid)) {
      await this.prisma.designDetailInferenceRevisionRecord.deleteMany({
        where: { caseId, taskId: DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID },
      });
      await this.prisma.designDetailTaskToken.deleteMany({
        where: {
          caseId,
          taskId: { in: [...DESIGN_DETAIL_TASK4_L2_TOKEN_DB_TASK_IDS] },
        },
      });
      return;
    }

    if (isDesignDetailTask5L3TokenTaskId(tid)) {
      await this.prisma.designDetailInferenceRevisionRecord.deleteMany({
        where: { caseId, taskId: DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID },
      });
      await this.prisma.designDetailTaskToken.deleteMany({
        where: {
          caseId,
          taskId: { in: [...DESIGN_DETAIL_TASK5_L3_TOKEN_DB_TASK_IDS] },
        },
      });
      return;
    }

    if (isDesignDetailTask55L3TokenTaskId(tid)) {
      await this.prisma.designDetailInferenceRevisionRecord.deleteMany({
        where: { caseId, taskId: DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID },
      });
      await this.prisma.designDetailTaskToken.deleteMany({
        where: {
          caseId,
          taskId: { in: [...DESIGN_DETAIL_TASK55_L3_TOKEN_DB_TASK_IDS] },
        },
      });
      return;
    }

    if (isDesignDetailTask6L3TokenTaskId(tid)) {
      await this.prisma.designDetailInferenceRevisionRecord.deleteMany({
        where: { caseId, taskId: DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID },
      });
      await this.prisma.designDetailTaskToken.deleteMany({
        where: {
          caseId,
          taskId: { in: [...DESIGN_DETAIL_TASK6_L3_TOKEN_DB_TASK_IDS] },
        },
      });
      return;
    }

    if (isDesignDetailTask65L3TokenTaskId(tid)) {
      await this.prisma.designDetailInferenceRevisionRecord.deleteMany({
        where: { caseId, taskId: DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID },
      });
      await this.prisma.designDetailTaskToken.deleteMany({
        where: {
          caseId,
          taskId: { in: [...DESIGN_DETAIL_TASK65_L3_TOKEN_DB_TASK_IDS] },
        },
      });
      return;
    }

    if (isDesignDetailTask7L4TokenTaskId(tid)) {
      await this.prisma.designDetailInferenceRevisionRecord.deleteMany({
        where: { caseId, taskId: DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID },
      });
      await this.prisma.designDetailTaskToken.deleteMany({
        where: {
          caseId,
          taskId: { in: [...DESIGN_DETAIL_TASK7_L4_TOKEN_DB_TASK_IDS] },
        },
      });
      return;
    }

    if (isDesignDetailTask8L45TokenTaskId(tid)) {
      await this.prisma.designDetailInferenceRevisionRecord.deleteMany({
        where: { caseId, taskId: DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID },
      });
      await this.prisma.designDetailTaskToken.deleteMany({
        where: {
          caseId,
          taskId: { in: [...DESIGN_DETAIL_TASK8_L45_TOKEN_DB_TASK_IDS] },
        },
      });
      return;
    }

    if (isDesignDetailTask9L5TokenTaskId(tid)) {
      await this.prisma.designDetailInferenceRevisionRecord.deleteMany({
        where: { caseId, taskId: DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID },
      });
      await this.prisma.designDetailTaskToken.deleteMany({
        where: {
          caseId,
          taskId: { in: [...DESIGN_DETAIL_TASK9_L5_TOKEN_DB_TASK_IDS] },
        },
      });
      return;
    }

    if (isDesignDetailTask10L5TokenTaskId(tid)) {
      await this.prisma.designDetailInferenceRevisionRecord.deleteMany({
        where: { caseId, taskId: DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID },
      });
      await this.prisma.designDetailTaskToken.deleteMany({
        where: {
          caseId,
          taskId: { in: [...DESIGN_DETAIL_TASK10_L5_TOKEN_DB_TASK_IDS] },
        },
      });
      return;
    }

    await this.prisma.designDetailTaskToken.deleteMany({ where: { caseId, taskId: tid } });
    } finally {
      await this.purgeOrphanDesignLogicLinksForCase(caseId);
    }
  }

  async getDesignDetailTaskGraphDetail(caseId: string): Promise<DesignDetailTaskGraphTaskDto[]> {
    const cid = String(caseId || '').trim();
    if (!cid) return [];

    const tokenRows = await this.prisma.designDetailTaskToken.findMany({
      where: { caseId: cid },
      select: {
        tokenId: true,
        taskId: true,
        tokens: true,
        createdAt: true,
        requirementSyncGeneration: true,
        featureNodes: {
          select: {
            featureId: true,
            surfaceTokens: true,
            value: true,
            operator: true,
            painPointConfirmed: true,
            painPointConfirmedByLineStepId: true,
          },
        },
      },
    });

    const pillBatchByTokenId = new Map<string, string>();
    for (const row of tokenRows) {
      const tid = String(row.taskId || '').trim();
      if (isDesignDetailTask2L1TokenTaskId(tid)) {
        pillBatchByTokenId.set(row.tokenId, 't2l1-0');
      } else if (isDesignDetailTask3L2TokenTaskId(tid)) {
        pillBatchByTokenId.set(row.tokenId, 't3l2-0');
      } else if (isDesignDetailTask4L2TokenTaskId(tid)) {
        pillBatchByTokenId.set(row.tokenId, 't4l2-0');
      } else if (isDesignDetailTask5L3TokenTaskId(tid)) {
        pillBatchByTokenId.set(row.tokenId, 't5l3-0');
      } else if (isDesignDetailTask55L3TokenTaskId(tid)) {
        pillBatchByTokenId.set(row.tokenId, 't55l3-0');
      } else if (isDesignDetailTask6L3TokenTaskId(tid)) {
        pillBatchByTokenId.set(row.tokenId, 't6l3-0');
      } else if (isDesignDetailTask65L3TokenTaskId(tid)) {
        pillBatchByTokenId.set(row.tokenId, 't65l3-0');
      } else if (isTask1TokenDbTaskId(tid) && !isRequirementStyleTokenRow(row.tokens)) {
        pillBatchByTokenId.set(row.tokenId, 'cb-0');
      }
    }
    const reqTokenRows = tokenRows.filter((r) => {
      const tid = String(r.taskId || '').trim();
      if (tid === DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID) return true;
      if (isTask1TokenDbTaskId(tid) && isRequirementStyleTokenRow(r.tokens)) return true;
      return false;
    });
    for (const r of reqTokenRows) {
      const g = typeof r.requirementSyncGeneration === 'number' ? r.requirementSyncGeneration : 0;
      if (g > 0) {
        const idx = Math.min(g - 1, TASK_GRAPH_PILL_BATCH_REQUIREMENT_MAX_CR_INDEX);
        pillBatchByTokenId.set(r.tokenId, `cr-${idx}`);
      }
    }
    const reqRowsLegacy = reqTokenRows.filter((r) => {
      const g = typeof r.requirementSyncGeneration === 'number' ? r.requirementSyncGeneration : 0;
      return g <= 0;
    });
    pillBatchKeysForRequirementTokenRows(
      reqRowsLegacy.map((r) => ({ tokenId: r.tokenId, createdAt: r.createdAt })),
    ).forEach((pk, tokenId) => {
      if (!pillBatchByTokenId.has(tokenId)) pillBatchByTokenId.set(tokenId, pk);
    });

    const byTaskId = new Map<string, typeof tokenRows>();
    const featureIdToTaskId = new Map<string, string>();
    const featureIdToParentTokenId = new Map<string, string>();
    for (const row of tokenRows) {
      const rawTid = String(row.taskId || '').trim() || '—';
      const tid = canonicalDesignDetailGraphTaskKey(rawTid);
      if (!byTaskId.has(tid)) byTaskId.set(tid, []);
      byTaskId.get(tid)!.push(row);
      for (const fn of row.featureNodes) {
        featureIdToTaskId.set(fn.featureId, tid);
        featureIdToParentTokenId.set(fn.featureId, row.tokenId);
      }
    }

    const allFids = Array.from(featureIdToTaskId.keys());
    const linkRows =
      allFids.length > 0
        ? await this.prisma.designLogicLink.findMany({
            where: { sourceFeatureId: { in: allFids }, targetFeatureId: { in: allFids } },
            select: {
              linkId: true,
              sourceFeatureId: true,
              targetFeatureId: true,
              logic: true,
              weight: true,
              linkKind: true,
              validationConsistency: true,
              /** 按外键直读 `DesignFeatureNode.value`，与 token 行嵌套查询解耦，避免聚合映射遗漏 */
              sourceFeature: {
                select: {
                  featureId: true,
                  value: true,
                  surfaceTokens: true,
                  tokenId: true,
                  operator: true,
                  painPointConfirmed: true,
                  painPointConfirmedByLineStepId: true,
                },
              },
              targetFeature: {
                select: {
                  featureId: true,
                  value: true,
                  surfaceTokens: true,
                  tokenId: true,
                  operator: true,
                  painPointConfirmed: true,
                  painPointConfirmedByLineStepId: true,
                },
              },
            },
            orderBy: { linkId: 'asc' },
          })
        : [];

    const linksByTask = new Map<string, typeof linkRows>();
    for (const L of linkRows) {
      const st = featureIdToTaskId.get(L.sourceFeatureId);
      const tt = featureIdToTaskId.get(L.targetFeatureId);
      /** 边归入**目标**特征所在任务，便于展示 task1 证据 → task2 L1 结论 等跨步推导 */
      const bucket = tt ?? st;
      if (!bucket) continue;
      if (!linksByTask.has(bucket)) linksByTask.set(bucket, []);
      linksByTask.get(bucket)!.push(L);
    }

    const buildTaskDto = (taskId: string): DesignDetailTaskGraphTaskDto => {
      const rows = byTaskId.get(taskId) ?? [];
      const tokens: DesignDetailTaskGraphTaskDto['tokens'] = rows.map((r) => ({
        tokenId: r.tokenId,
        name: taskGraphTokenDisplayName(r.tokens),
        themeKey: taskGraphThemeKeyForTokenRow(taskId, r.tokens),
        pillBatchKey: pillBatchByTokenId.get(r.tokenId) ?? 'nx-0',
      }));
      const features: DesignDetailTaskGraphTaskDto['features'] = [];
      for (const r of rows) {
        for (const fn of r.featureNodes) {
          const parentTid = featureIdToParentTokenId.get(fn.featureId) ?? r.tokenId;
          const dbTidForFeature = featureIdToTaskId.get(fn.featureId) ?? r.taskId;
          const tokenDisp = taskGraphFeatureTokenStrDisplay(fn.surfaceTokens).trim();
          const vrd = taskGraphExtractValueRefDomain(fn.value);
          const inf = taskGraphExtractInferenceSummary(fn.value);
          const thp = taskGraphExtractTechHostPlatform(fn.value);
          features.push({
            featureId: fn.featureId,
            name: taskGraphFeatureRowLabel(fn.value, fn.surfaceTokens, fn.featureId, dbTidForFeature),
            themeKey: taskGraphThemeKeyForFeatureId(fn.featureId, dbTidForFeature, fn.surfaceTokens),
            pillBatchKey: pillBatchByTokenId.get(parentTid) ?? 'nx-0',
            tokenDisplay: tokenDisp.length ? tokenDisp : undefined,
            operator: normalizeDesignDetailFeatureOperator(fn.operator),
            ...(vrd ? { valueRefDomain: vrd } : {}),
            ...(inf ? { inferenceSummary: inf } : {}),
            ...(thp ? { techHostPlatform: thp } : {}),
            ...taskGraphPainFieldsFromNode(fn),
            ...(taskGraphShouldExposeRawFeatureValue(taskId) ||
            (isTask1TokenDbTaskId(taskId) && taskGraphShouldExposeRawFeatureValueForSurface(fn.surfaceTokens))
              ? { featureValue: fn.value }
              : {}),
          });
        }
      }
      const links = (linksByTask.get(taskId) ?? []).map((l) => {
        const stTask = featureIdToTaskId.get(l.sourceFeatureId);
        const ttTask = featureIdToTaskId.get(l.targetFeatureId);
        const cross = !!(stTask && ttTask && stTask !== ttTask);
        const themeFid = cross ? l.targetFeatureId : l.sourceFeatureId;
        const pillTok = cross
          ? featureIdToParentTokenId.get(l.targetFeatureId)
          : featureIdToParentTokenId.get(l.sourceFeatureId);
        const logicFull = String(l.logic ?? '');
        const themeTokDb = featureIdToTaskId.get(themeFid);
        const themeSurf =
          themeFid === l.targetFeatureId ? l.targetFeature?.surfaceTokens : l.sourceFeature?.surfaceTokens;
        return {
          linkId: l.linkId,
          name: taskGraphLinkDisplayName(logicFull),
          themeKey: taskGraphThemeKeyForFeatureId(themeFid, themeTokDb, themeSurf),
          pillBatchKey: pillBatchByTokenId.get(pillTok ?? '') ?? 'nx-0',
          sourceFeatureId: l.sourceFeatureId,
          targetFeatureId: l.targetFeatureId,
          logic: logicFull,
          weight: normalizeDesignLogicLinkWeight(l.weight),
          linkKind: designLogicLinkKindToApiValue(String(l.linkKind)),
          ...(l.validationConsistency != null && String(l.validationConsistency).trim()
            ? { validationConsistency: String(l.validationConsistency).trim() }
            : {}),
          source: taskGraphFeatureDtoFromLinkedNode(
            l.sourceFeature,
            pillBatchByTokenId,
            l.sourceFeatureId,
            featureIdToTaskId.get(l.sourceFeatureId),
          ),
          target: taskGraphFeatureDtoFromLinkedNode(
            l.targetFeature,
            pillBatchByTokenId,
            l.targetFeatureId,
            featureIdToTaskId.get(l.targetFeatureId),
          ),
        };
      });
      return {
        taskId,
        title: getDesignDetailTaskGraphCardTitle(taskId),
        tokenCount: tokens.length,
        featureCount: features.length,
        linkCount: links.length,
        tokens,
        features,
        links,
      };
    };

    const ordered: DesignDetailTaskGraphTaskDto[] = [];
    const seen = new Set<string>();
    for (const tid of DESIGN_DETAIL_TASK_GRAPH_ORDER) {
      ordered.push(buildTaskDto(tid));
      seen.add(tid);
    }
    for (const tid of byTaskId.keys()) {
      if (seen.has(tid)) continue;
      ordered.push(buildTaskDto(tid));
    }
    return ordered;
  }

  async appendCaseLlmLog(caseId: string, row: CaseLlmLogAppendInput): Promise<void> {
    await this.prisma.problemCaseLlmLog.create({
      data: {
        caseId,
        taskId: row.taskId,
        callTarget: row.callTarget,
        inputPrompt: row.inputPrompt,
        inputTokens: row.inputTokens ?? null,
        outputContent: row.outputContent,
        outputTokens: row.outputTokens ?? null,
        durationMs: row.durationMs,
        model: row.model ?? null,
      },
    });
  }

  async listCaseLlmLogsForCase(caseId: string): Promise<CaseLlmLogListRow[]> {
    const rows = await this.prisma.problemCaseLlmLog.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        caseId: true,
        taskId: true,
        callTarget: true,
        inputTokens: true,
        outputTokens: true,
        durationMs: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      caseId: r.caseId,
      taskId: r.taskId,
      callTarget: r.callTarget,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      durationMs: r.durationMs,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async deleteCaseLlmLogsByTaskIds(caseId: string, taskIds: string[]): Promise<number> {
    const ids = [...new Set((taskIds || []).map((t) => String(t || '').trim()).filter(Boolean))];
    if (ids.length === 0) return 0;
    const res = await this.prisma.problemCaseLlmLog.deleteMany({
      where: { caseId, taskId: { in: ids } },
    });
    return res.count;
  }

  async deleteAllCaseLlmLogs(caseId: string): Promise<number> {
    const res = await this.prisma.problemCaseLlmLog.deleteMany({ where: { caseId } });
    return res.count;
  }

  async deleteDesignDetailInferenceRevisionRecords(
    caseId: string,
    dbTaskIds: readonly string[],
  ): Promise<number> {
    const cid = String(caseId || '').trim();
    const ids = [...new Set((dbTaskIds || []).map((t) => String(t || '').trim()).filter(Boolean))];
    if (!cid || !ids.length) return 0;
    const res = await this.prisma.designDetailInferenceRevisionRecord.deleteMany({
      where: { caseId: cid, taskId: { in: ids } },
    });
    try {
      console.warn('[problem-case:inference-revision]', {
        phase: 'delete_by_task_ids',
        caseId: cid,
        taskIds: ids,
        deleted: res.count,
      });
    } catch {
      /* ignore */
    }
    return res.count;
  }

  private async listTask1TokenIdsForCase(caseId: string): Promise<string[]> {
    const cid = String(caseId || '').trim();
    if (!cid) return [];
    const rows = await this.prisma.designDetailTaskToken.findMany({
      where: {
        caseId: cid,
        taskId: {
          in: [
            DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
            DESIGN_DETAIL_TASK1_LINE_TASK_ID,
            DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID,
          ],
        },
      },
      select: { tokenId: true },
    });
    return rows.map((r) => r.tokenId);
  }

  async markDesignDetailTask1ValidationResolvedByCustomer(
    caseId: string,
    targetFeatureIds: readonly string[],
  ): Promise<number> {
    const cid = String(caseId || '').trim();
    const ids = [...new Set((targetFeatureIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
    if (!cid || !ids.length) return 0;
    const tokenIds = await this.listTask1TokenIdsForCase(cid);
    if (!tokenIds.length) return 0;
    const nodes = await this.prisma.designFeatureNode.findMany({
      where: { featureId: { in: ids }, tokenId: { in: tokenIds } },
      select: { featureId: true, value: true },
    });
    let updated = 0;
    for (const node of nodes) {
      const nextValue = mergeValidationStatusIntoTask1FeatureValue(node.value);
      await this.prisma.designFeatureNode.update({
        where: { featureId: node.featureId },
        data: { value: nextValue as Prisma.InputJsonValue },
      });
      updated += 1;
    }
    try {
      console.warn('[problem-case:validation-resolved]', {
        phase: 'mark',
        caseId: cid,
        requested: ids.length,
        updated,
      });
    } catch {
      /* ignore */
    }
    return updated;
  }

  async markDesignDetailTask1PainPointConfirmed(
    caseId: string,
    targetFeatureIds: readonly string[],
    lineStepId: string,
  ): Promise<number> {
    const cid = String(caseId || '').trim();
    const step = String(lineStepId || '').trim();
    const ids = [...new Set((targetFeatureIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
    if (!cid || !step || !ids.length) return 0;
    const tokenIds = await this.listTask1TokenIdsForCase(cid);
    if (!tokenIds.length) return 0;
    const res = await this.prisma.designFeatureNode.updateMany({
      where: { featureId: { in: ids }, tokenId: { in: tokenIds } },
      data: { painPointConfirmed: true, painPointConfirmedByLineStepId: step },
    });
    try {
      console.warn('[problem-case:pain-point-confirmed]', {
        phase: 'mark',
        caseId: cid,
        lineStepId: step,
        requested: ids.length,
        updated: res.count,
      });
    } catch {
      /* ignore */
    }
    return res.count;
  }

  async resetDesignDetailTask1PainPointConfirmed(
    caseId: string,
    scope: { kind: 'all' } | { kind: 'line_steps'; lineStepIds: readonly string[] },
  ): Promise<number> {
    const cid = String(caseId || '').trim();
    if (!cid) return 0;
    const tokenIds = await this.listTask1TokenIdsForCase(cid);
    if (!tokenIds.length) return 0;
    const where: Prisma.DesignFeatureNodeWhereInput = {
      tokenId: { in: tokenIds },
      painPointConfirmed: true,
    };
    if (scope.kind === 'line_steps') {
      const steps = [...new Set((scope.lineStepIds || []).map((s) => String(s || '').trim()).filter(Boolean))];
      if (!steps.length) return 0;
      where.painPointConfirmedByLineStepId = { in: steps };
    }
    const res = await this.prisma.designFeatureNode.updateMany({
      where,
      data: { painPointConfirmed: false, painPointConfirmedByLineStepId: null },
    });
    try {
      console.warn('[problem-case:pain-point-confirmed]', {
        phase: 'reset',
        caseId: cid,
        scope: scope.kind,
        lineStepIds: scope.kind === 'line_steps' ? scope.lineStepIds : undefined,
        updated: res.count,
      });
    } catch {
      /* ignore */
    }
    return res.count;
  }

  /** 删除本案例已无对应 feature 的悬空逻辑边（重启清图后兜底） */
  private async purgeOrphanDesignLogicLinksForCase(
    caseId: string,
    tx?: Pick<typeof this.prisma, 'designFeatureNode' | 'designLogicLink'>,
  ): Promise<number> {
    const db = tx ?? this.prisma;
    const features = await db.designFeatureNode.findMany({
      where: { tokenRow: { caseId } },
      select: { featureId: true },
    });
    const valid = new Set(features.map((f) => f.featureId));
    const links = await db.designLogicLink.findMany({
      where: {
        OR: [
          { sourceFeature: { tokenRow: { caseId } } },
          { targetFeature: { tokenRow: { caseId } } },
        ],
      },
      select: { linkId: true, sourceFeatureId: true, targetFeatureId: true },
    });
    const orphanIds = links
      .filter((l) => !valid.has(l.sourceFeatureId) || !valid.has(l.targetFeatureId))
      .map((l) => l.linkId);
    if (orphanIds.length === 0) return 0;
    const res = await db.designLogicLink.deleteMany({ where: { linkId: { in: orphanIds } } });
    return res.count;
  }

  async deleteAllDesignDetailTaskGraph(caseId: string): Promise<void> {
    await this.prisma.designLogicLink.deleteMany({
      where: {
        OR: [
          { sourceFeature: { tokenRow: { caseId } } },
          { targetFeature: { tokenRow: { caseId } } },
        ],
      },
    });
    await this.prisma.designDetailInferenceRevisionRecord.deleteMany({ where: { caseId } });
    await this.prisma.designDetailTaskToken.deleteMany({ where: { caseId } });
    await this.prisma.problemCase.update({
      where: { id: caseId },
      data: { designDetailRequirementSyncGen: 0 },
    });
  }

  async replaceDesignDetailInferenceRevisionRecords(
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
  ): Promise<{ syncSeq: number; recordCount: number }> {
    const cid = String(caseId || '').trim();
    const tid = String(taskId || '').trim();
    if (!cid || !tid) return { syncSeq: 0, recordCount: 0 };
    return this.prisma.$transaction(async (tx) => {
      const agg = await tx.designDetailInferenceRevisionRecord.aggregate({
        where: { caseId: cid, taskId: tid },
        _max: { syncSeq: true },
      });
      const syncSeq = (agg._max.syncSeq ?? 0) + 1;
      const cleaned = rows
        .map((r) => ({
          recordKind: r.recordKind,
          featureId: String(r.featureId || '').trim(),
          fieldLabel: r.fieldLabel?.trim() || null,
          valueBefore: r.valueBefore?.trim() || null,
          valueAfter: r.valueAfter?.trim() || null,
          validationLogic: r.validationLogic?.trim() || null,
          logicGapReport: r.logicGapReport?.trim() || null,
          insightResolutionSummary: r.insightResolutionSummary?.trim() || null,
          alignmentQuestionnaire: r.alignmentQuestionnaire?.trim() || null,
          alignmentUserReply: r.alignmentUserReply?.trim() || null,
          conflictDescription: r.conflictDescription?.trim() || null,
          insightConfirmation: r.insightConfirmation?.trim() || null,
          rootCauseAnalysis: r.rootCauseAnalysis?.trim() || null,
          designConstraint: r.designConstraint?.trim() || null,
        }))
        .filter((r) => r.featureId.length > 0);
      if (!cleaned.length) {
        try {
          console.warn('[problem-case:inference-revision]', {
            caseId: cid,
            taskId: tid,
            phase: 'skip_replace_empty_rows',
            syncSeq,
            hint: '未构建出修订行，保留上一批审计数据；请查 persist 日志 builtRows / persist_failed',
          });
        } catch {
          /* ignore */
        }
        return { syncSeq, recordCount: 0 };
      }
      await tx.designDetailInferenceRevisionRecord.deleteMany({
        where: { caseId: cid, taskId: tid },
      });
      await tx.designDetailInferenceRevisionRecord.createMany({
        data: cleaned.map((r) => ({
          caseId: cid,
          taskId: tid,
          recordKind: r.recordKind,
          featureId: r.featureId,
          fieldLabel: r.fieldLabel,
          valueBefore: r.valueBefore,
          valueAfter: r.valueAfter,
          validationLogic: r.validationLogic,
          logicGapReport: r.logicGapReport,
          insightResolutionSummary: r.insightResolutionSummary,
          alignmentQuestionnaire: r.alignmentQuestionnaire,
          alignmentUserReply: r.alignmentUserReply,
          conflictDescription: r.conflictDescription,
          insightConfirmation: r.insightConfirmation,
          rootCauseAnalysis: r.rootCauseAnalysis,
          designConstraint: r.designConstraint,
          syncSeq,
        })),
      });
      return { syncSeq, recordCount: cleaned.length };
    });
  }
}

function mapProblemCase(item: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  ownerSubjectId: string | null;
  ownerSubjectType: string | null;
  ownerUsernameSnapshot: string | null;
  archiveNo: number;
  customerName: string;
  customerNeedsOrChallenges: string;
  customerItStatus: string;
  projectTimeRequirement: string;
  currentMajorStage: number;
  currentItStrategySubstep: number;
  completedStages: unknown;
  workflowAlignCompletedStages: unknown;
  itGapCompletedStages: unknown;
  completedTaskIds: unknown;
  basicInfo: unknown;
  bmc: unknown;
  requirementLogic: unknown;
  valueStream: unknown;
  e2eFlowWorkspaceSuppressed: boolean | null;
  e2eFlowLandscapeJson: unknown;
  e2eTransactionFlowJson: unknown;
  e2eRequirementScenarioSupplementJson: unknown;
  globalItGapAnalysisJson: unknown;
  itDesignSupplementSessions: unknown;
  localItGapSessions: unknown;
  localItGapAnalyses: unknown;
  roleTaskCenterPortalDesignJson: unknown;
  objectStateMachineJson: unknown;
  rolePermissionSessions: unknown;
  coreBusinessObjectSessions: unknown;
  coreBusinessObjectSystemPromptOverride?: string | null;
}): ProblemCase {
  const extras = readCreateContractExtrasFromBasicInfo(item.basicInfo);
  return {
    id: item.id,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    ownerSubjectId: item.ownerSubjectId ?? undefined,
    ownerSubjectType:
      item.ownerSubjectType === 'user' || item.ownerSubjectType === 'admin'
        ? (item.ownerSubjectType as 'user' | 'admin')
        : undefined,
    ownerUsernameSnapshot: item.ownerUsernameSnapshot ?? undefined,
    archiveNo: item.archiveNo,
    customerName: item.customerName,
    customerNeedsOrChallenges: item.customerNeedsOrChallenges,
    customerItStatus: item.customerItStatus,
    projectTimeRequirement: item.projectTimeRequirement,
    requirementDetail: extras.requirementDetail,
    requirementDetailHistory: extras.requirementDetailHistory,
    operationModel: extras.operationModel,
    businessStatus: extras.businessStatus,
    urgencyAnalysis: extras.urgencyAnalysis,
    /** 与 CreateContractExtras 同源：此前仅写入 basicInfo 元区，未抬升到 API 顶层，导致前端刷新后 `preliminaryReq` 丢失、task1 补充路由误判（FE-20260331） */
    preliminaryReq: extras.preliminaryReq,
    task1PendingPreliminaryRequirement:
      typeof extras.task1PendingPreliminaryRequirement === 'boolean'
        ? extras.task1PendingPreliminaryRequirement
        : undefined,
    task1InitialLlmQuery: extras.task1InitialLlmQuery,
    currentMajorStage: item.currentMajorStage,
    currentItStrategySubstep: item.currentItStrategySubstep,
    completedStages: normalizeStringArray(item.completedStages),
    workflowAlignCompletedStages: normalizeStringArray(item.workflowAlignCompletedStages),
    itGapCompletedStages: normalizeStringArray(item.itGapCompletedStages),
    completedTaskIds: normalizeTaskIds(item.completedTaskIds),
    basicInfo: normalizePublicBasicInfo(item.basicInfo),
    bmc: item.bmc ?? undefined,
    requirementLogic: item.requirementLogic ?? undefined,
    valueStream: item.valueStream ?? undefined,
    e2eFlowWorkspaceSuppressed:
      typeof item.e2eFlowWorkspaceSuppressed === 'boolean' ? item.e2eFlowWorkspaceSuppressed : undefined,
    e2eFlowLandscapeJson: item.e2eFlowLandscapeJson ?? undefined,
    e2eTransactionFlowJson: item.e2eTransactionFlowJson ?? undefined,
    e2eRequirementScenarioSupplementJson: item.e2eRequirementScenarioSupplementJson ?? undefined,
    globalItGapAnalysisJson: item.globalItGapAnalysisJson ?? undefined,
    itDesignSupplementSessions: item.itDesignSupplementSessions ?? undefined,
    localItGapSessions: item.localItGapSessions ?? undefined,
    localItGapAnalyses: item.localItGapAnalyses ?? undefined,
    roleTaskCenterPortalDesignJson: item.roleTaskCenterPortalDesignJson ?? undefined,
    objectStateMachineJson: item.objectStateMachineJson ?? undefined,
    rolePermissionSessions: item.rolePermissionSessions ?? undefined,
    coreBusinessObjectSessions: item.coreBusinessObjectSessions ?? undefined,
    coreBusinessObjectSystemPromptOverride:
      item.coreBusinessObjectSystemPromptOverride != null && item.coreBusinessObjectSystemPromptOverride !== ''
        ? String(item.coreBusinessObjectSystemPromptOverride)
        : undefined,
  };
}

const CREATE_CONTRACT_EXTRA_KEYS = [
  'requirementDetail',
  'requirementDetailHistory',
  'operationModel',
  'businessStatus',
  'urgencyAnalysis',
  'preliminaryReq',
  'task1PendingPreliminaryRequirement',
  'task1InitialLlmQuery',
] as const;

type CreateContractExtraKey = typeof CREATE_CONTRACT_EXTRA_KEYS[number];

type CreateContractExtras = Partial<Record<CreateContractExtraKey, unknown>>;

const CREATE_CONTRACT_EXTRAS_META_KEY = '__createContractExtras';

function pickCreateContractExtras(input: CreateProblemCaseInput | UpdateProblemCaseInput): CreateContractExtras {
  const extras: CreateContractExtras = {};
  for (const key of CREATE_CONTRACT_EXTRA_KEYS) {
    if (input[key] !== undefined) {
      extras[key] = input[key];
    }
  }
  return extras;
}

function hasAnyCreateContractExtras(input: UpdateProblemCaseInput | CreateProblemCaseInput): boolean {
  return CREATE_CONTRACT_EXTRA_KEYS.some((key) => (input as Record<string, unknown>)[key] !== undefined);
}

function mergeCreateContractExtras(base: CreateContractExtras, incoming: CreateContractExtras): CreateContractExtras {
  const merged: CreateContractExtras = { ...base };
  for (const key of CREATE_CONTRACT_EXTRA_KEYS) {
    if (incoming[key] !== undefined) {
      merged[key] = incoming[key];
    }
  }
  return merged;
}

function mergeCreateContractExtrasToBasicInfo(
  basicInfo: unknown,
  extras: CreateContractExtras,
): Record<string, unknown> | undefined {
  if (Object.keys(extras).length === 0) return undefined;
  const base =
    basicInfo && typeof basicInfo === 'object' && !Array.isArray(basicInfo)
      ? { ...(basicInfo as Record<string, unknown>) }
      : {};
  base[CREATE_CONTRACT_EXTRAS_META_KEY] = extras;
  return base;
}

function readCreateContractExtrasFromBasicInfo(basicInfo: unknown): CreateContractExtras {
  if (!basicInfo || typeof basicInfo !== 'object' || Array.isArray(basicInfo)) return {};
  const raw = (basicInfo as Record<string, unknown>)[CREATE_CONTRACT_EXTRAS_META_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const extras: CreateContractExtras = {};
  for (const key of CREATE_CONTRACT_EXTRA_KEYS) {
    if ((raw as Record<string, unknown>)[key] !== undefined) {
      extras[key] = (raw as Record<string, unknown>)[key];
    }
  }
  return extras;
}

function normalizePublicBasicInfo(basicInfo: unknown): unknown {
  if (!basicInfo || typeof basicInfo !== 'object' || Array.isArray(basicInfo)) {
    return basicInfo ?? undefined;
  }
  const keys = Object.keys(basicInfo as Record<string, unknown>);
  if (keys.length === 0) return undefined;
  const nonMetaKeys = keys.filter((key) => key !== CREATE_CONTRACT_EXTRAS_META_KEY);
  if (nonMetaKeys.length === 0) return undefined;
  return basicInfo;
}

function normalizeStringArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function normalizeTaskIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item))
    .filter(Boolean);
}

function isRecordNotFoundError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2025'
  );
}

/** 仅允许写入 Prisma ProblemCase 标量/Json 列，丢弃顶层领域别名（如 requirementDetail）避免 Invalid invocation */
const ALLOWED_PROBLEM_CASE_UPDATE_KEYS = new Set([
  'customerName',
  'customerNeedsOrChallenges',
  'customerItStatus',
  'projectTimeRequirement',
  'currentMajorStage',
  'currentItStrategySubstep',
  'completedStages',
  'workflowAlignCompletedStages',
  'itGapCompletedStages',
  'completedTaskIds',
  'basicInfo',
  'bmc',
  'requirementLogic',
  'valueStream',
  'e2eFlowWorkspaceSuppressed',
  'e2eFlowLandscapeJson',
  'e2eTransactionFlowJson',
  'e2eRequirementScenarioSupplementJson',
  'globalItGapAnalysisJson',
  'itDesignSupplementSessions',
  'localItGapSessions',
  'localItGapAnalyses',
  'roleTaskCenterPortalDesignJson',
  'objectStateMachineJson',
  'rolePermissionSessions',
  'coreBusinessObjectSessions',
  'coreBusinessObjectSystemPromptOverride',
]);

function pickAllowedProblemCaseUpdatePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (ALLOWED_PROBLEM_CASE_UPDATE_KEYS.has(k)) {
      out[k] = v;
    }
  }
  return out;
}

/** 将 payload 转为可落 MySQL JSON 的纯 JSON 值（去稀疏键、统一可序列化），再交给 Prisma */
function cloneJsonSerializableForMysql(payload: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(
      JSON.stringify(payload, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)),
    ) as Record<string, unknown>;
  } catch {
    throw new Error('problemCase.update: 存在无法 JSON 序列化的字段（请检查 basicInfo 等嵌套结构）');
  }
}

/** MySQL 可空 Json 列写入 SQL NULL 须使用 DbNull；裸 null 在部分 Prisma/驱动组合下会触发 Invalid invocation 或引擎报错 */
const NULLABLE_JSON_COLUMN_KEYS: (keyof Prisma.ProblemCaseUpdateInput)[] = [
  'completedStages',
  'workflowAlignCompletedStages',
  'itGapCompletedStages',
  'completedTaskIds',
  'basicInfo',
  'bmc',
  'requirementLogic',
  'valueStream',
  'e2eFlowLandscapeJson',
  'e2eTransactionFlowJson',
  'e2eRequirementScenarioSupplementJson',
  'globalItGapAnalysisJson',
  'itDesignSupplementSessions',
  'localItGapSessions',
  'localItGapAnalyses',
  'roleTaskCenterPortalDesignJson',
  'objectStateMachineJson',
  'rolePermissionSessions',
  'coreBusinessObjectSessions',
];

function applyDbNullForNullableJsonColumns(payload: Record<string, unknown>): Record<string, unknown> {
  const out = { ...payload };
  for (const k of NULLABLE_JSON_COLUMN_KEYS) {
    const key = k as string;
    if (out[key] === null) {
      out[key] = Prisma.DbNull;
    }
  }
  return out;
}

/** 递归剔除 undefined，避免 JSON 列序列化/Prisma 校验失败（领域对象常含稀疏字段） */
function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return (value as unknown[])
      .map((x) => stripUndefinedDeep(x))
      .filter((x) => x !== undefined);
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = stripUndefinedDeep(v);
  }
  return out;
}

function sanitizeProblemCaseUpdates(updates: UpdateProblemCaseInput) {
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      payload[key] = value;
    }
  }

  delete payload.archiveNo;

  return payload;
}

function mapProblemCaseMessage(item: {
  caseId: string;
  id: string;
  taskId: string | null;
  taskName: string | null;
  role: string | null;
  type: string | null;
  content: string;
  payloadJson: unknown;
  confirmed: boolean;
  timestamp: Date;
}): ProblemCaseMessage {
  const payload =
    item.payloadJson && typeof item.payloadJson === 'object' && !Array.isArray(item.payloadJson)
      ? item.payloadJson as Record<string, unknown>
      : undefined;

  return {
    caseId: item.caseId,
    id: item.id,
    taskId: item.taskId ?? undefined,
    taskName: item.taskName ?? undefined,
    role: normalizeRole(item.role),
    type: item.type ?? undefined,
    content: item.content,
    timestamp: item.timestamp.toISOString(),
    confirmed: item.confirmed,
    payloadJson: item.payloadJson ?? undefined,
    ...(payload || {}),
  };
}

function normalizeRole(value: string | null): ProblemCaseMessage['role'] {
  if (value === 'user' || value === 'assistant' || value === 'system') {
    return value;
  }
  return undefined;
}
