/**
 * [INPUT]: `design-detail-task1-basic-graph` 的 `isTask1FeatureValueEmpty`（空值不写 `DesignFeatureNode`）
 * [OUTPUT]: 将设计详情 Task1「客户需求提炼」某一顶层分域展平为 token + 特征；**不写**段内 `DesignLogicLink`（`linkPairs` 恒空，与任务 1 逻辑链留空策略一致）；`businessContext` 每条 `tokens` **仅** `["业务背景/…"]`；`coreBusinessEntities` 每条 **仅** `["核心业务对象/人|财|物|事/实体名"]`；`stateTransitionMatrix` **按实体归并**：同一 `entity`（去空白、**剥**末尾 ` (1)` / `（１）` 等编号尾缀——数字段含全角 `\p{Nd}`——后再归并）**仅一条** `["状态转移矩阵/{实体名称}"]`，多条转移入同一 `value`（`stateTransitionRows`）；`painPointRadar` 每条 **仅** `["痛点雷达/{维度短名}"]`（**不**把 `description` 或长叙事拼进 token；正文仅 `value`；同短名由 `allocUniqueTokenSurface` 追加 `（1）` 等区分）；`itLandscape` **固定至多三条** `["IT 集成与现状/现有系统"]`、`["IT 集成与现状/待集成系统"]`、`["IT 集成与现状/部署形态"]`（列表与部署文案入 `value`，**不**写入 token 路径）；`existingSpreadsheets` 每条 **仅** `["现有表格/{表名}"]`，`DesignFeatureNode.operator` 为 **包含**、`value` 为逗号+空格连接的表头串（逻辑弹层 Feature **name** 为 **原始数据模型表头**）；`operationModel` 为 `["运营模式/人员组织/{角色标题}"]`、`["运营模式/业务流程/{流程名}"]`（同角色/流程合并一行，**无**路径尾编号）；`managementResources` 为 `["管理资源/人力资源"]` 等至多四键；其余对象分域可仍为三元素；`identifier` 或序号用于稳定 `featureId` 后缀
 * [POS]: problem-cases；由 `replaceCustomerRequirementSectionGraph` 事务调用（Prisma 侧 **合并追加**：同路径 token / 同 `featureId` 不重复插入；**不**写入任务 1 分域逻辑边）
 *
 * [PROTOCOL]: 上述单路径分域见 `customerRequirementTokenRowBelongsToSection`（`itLandscape` 兼容 `IT 集成与现状/` 与历史 `IT 现状与集成/`；`operationModel` / `managementResources` 以 `运营模式/`、`管理资源/` 前缀识别）；其余分域可仍为 `[sectionKey, 中文名, 子键]`；`tokens` **不含**子字段取值；`DesignFeatureNode.surfaceTokens`（列 `TokenStr`）与 token 行 `tokens` 一致（冗余）；**逻辑弹层多轮需求色**：仓储以 **`businessContext` 为每轮首写分域** 递增案例 `designDetailRequirementSyncGen` 并写入 `DesignDetailTaskToken.requirementSyncGeneration`（同轮其它分域沿用），调用顺序若偏离须同步调整
 */

import {
  isExplicitExistingSpreadsheetTableName,
  isGenericSpreadsheetTablePlaceholder,
  mergeExistingSpreadsheetsParsed,
  parseExistingSpreadsheetsFromRequirementText,
  refineExistingSpreadsheetTableNames,
  type ExistingSpreadsheetRow,
} from './design-detail-existing-spreadsheet-parse';
import { isTask1FeatureValueEmpty } from './design-detail-task1-basic-graph';

export {
  isExplicitExistingSpreadsheetTableName,
  isGenericSpreadsheetTablePlaceholder,
  mergeExistingSpreadsheetsParsed,
  parseExistingSpreadsheetsFromRequirementText,
  refineExistingSpreadsheetTableNames,
} from './design-detail-existing-spreadsheet-parse';

/** 与 `useDesignDetailChat.ts` 中需求画布前序分域及 API 允许列表一致（含 `coreBusinessEntities`；不含路线图、分析师备注） */
export const DESIGN_CUSTOMER_REQ_GRAPH_SECTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'businessContext', label: '业务背景' },
  { key: 'coreBusinessEntities', label: '核心业务对象' },
  { key: 'stateTransitionMatrix', label: '状态转移矩阵' },
  { key: 'painPointRadar', label: '痛点雷达' },
  { key: 'itLandscape', label: 'IT 现状与集成' },
  { key: 'existingSpreadsheets', label: '现有表格' },
  { key: 'operationModel', label: '运营模式' },
  { key: 'managementResources', label: '管理资源' },
];

/** 历史/接口别名：需求提炼 token 曾单独使用此 id；**落库**已与工商一并写入 `DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID`（见 `design-detail-task-graph-catalog.ts`）。`DELETE …/task-graph/:taskId` 仍接受本值以清空任务 1 全量 token。 */
export const DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID = 'customer_requirement';

/**
 * 判断既有 `DesignDetailTaskToken.tokens` 是否属于某顶层分域，供 `replaceCustomerRequirementSectionGraph` 与既有行合并判重。
 * 兼容旧版三元素 `[sectionKey, 中文名, …]` 与新版单元素中文路径。
 */
export function customerRequirementTokenRowBelongsToSection(sectionKey: string, tokens: unknown): boolean {
  if (!Array.isArray(tokens) || tokens.length === 0) return false;
  const first = tokens[0];
  if (typeof first !== 'string') return false;
  if (first === sectionKey) return true;
  if (sectionKey === 'businessContext' && first.startsWith('业务背景/')) return true;
  if (sectionKey === 'coreBusinessEntities' && first.startsWith('核心业务对象/')) return true;
  if (sectionKey === 'stateTransitionMatrix' && first.startsWith('状态转移矩阵/')) return true;
  if (sectionKey === 'painPointRadar' && first.startsWith('痛点雷达/')) return true;
  if (
    sectionKey === 'itLandscape' &&
    (first.startsWith('IT 集成与现状/') || first.startsWith('IT 现状与集成/'))
  ) {
    return true;
  }
  if (sectionKey === 'existingSpreadsheets' && first.startsWith('现有表格/')) return true;
  if (sectionKey === 'operationModel' && first.startsWith('运营模式/')) return true;
  if (sectionKey === 'managementResources' && first.startsWith('管理资源/')) return true;
  return false;
}

export function buildCustomerReqSectionFeatureId(
  caseId: string,
  sectionKey: string,
  firstLevelKey: string,
): string {
  return `dd:${caseId}:cr:${sectionKey}:${firstLevelKey}`;
}

export type CustomerReqSectionGraphRow = {
  fieldKey: string;
  featureId: string;
  tokenSurfaces: string[];
  featureValue: unknown;
  hasFeature: boolean;
  /** 缺省为 **等于**；`existingSpreadsheets` 为 **包含** */
  operator?: string;
};

export type CustomerReqSectionGraphPlan = {
  rows: CustomerReqSectionGraphRow[];
  /** 任务 1 需求分域当前不生成 `DesignLogicLink`，恒为空 */
  linkPairs: ReadonlyArray<{ sourceFeatureId: string; targetFeatureId: string; logic: string; weight: number }>;
};

const STM_PREFIX = '状态转移矩阵';
const PPR_PREFIX = '痛点雷达';
/** `itLandscape`：与需求画布 IT 分区三子卡标题一致；列表正文仅入 `DesignFeatureNode.value` */
const ITL_TOKEN_LEGACY = 'IT 集成与现状/现有系统';
const ITL_TOKEN_INTEGRATION = 'IT 集成与现状/待集成系统';
const ITL_TOKEN_DEPLOYMENT = 'IT 集成与现状/部署形态';
const MAX_TOKEN_SECOND_SEGMENT_CHARS = 72;

/** 第二段路径：去斜杠、压缩空白、限长（避免 token 过长） */
function sanitizeTokenSecondSegment(raw: string): string {
  let s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\//g, '／');
  const arr = Array.from(s);
  if (arr.length > MAX_TOKEN_SECOND_SEGMENT_CHARS) {
    return `${arr.slice(0, MAX_TOKEN_SECOND_SEGMENT_CHARS - 1).join('')}…`;
  }
  return s || '未命名';
}

/**
 * 痛点雷达：`tokens` 路径第二段只用「维度」短名，不把整句 `dimension` 或 `description` 写入 surface。
 * 对 LLM 把说明写进 `dimension` 的情况：截到首个句读，或空格分词取首词，仍过长则硬截断后再 `sanitizeTokenSecondSegment`。
 */
function pprDimensionShortForToken(dimensionRaw: string): string {
  let d = String(dimensionRaw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!d) return '';
  const punctIdx = d.search(/[，。、；,]/);
  if (punctIdx > 0 && punctIdx <= 24) {
    d = d.slice(0, punctIdx).trim();
  }
  const parts = d.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && d.length > 14) {
    d = parts[0]!;
  }
  if (d.length > 16) {
    d = Array.from(d)
      .slice(0, 16)
      .join('')
      .trim();
  }
  return sanitizeTokenSecondSegment(d);
}

/** 在分域前缀下分配不重复的 `前缀/第二段` 整段 surface（`usedSurfaces` 存完整路径） */
function allocUniqueTokenSurface(prefix: string, baseSecond: string, usedSurfaces: Set<string>): string {
  const sanitized = sanitizeTokenSecondSegment(baseSecond);
  let candidate = `${prefix}/${sanitized}`;
  let n = 0;
  while (usedSurfaces.has(candidate)) {
    n += 1;
    candidate = `${prefix}/${sanitized}（${n}）`;
  }
  usedSurfaces.add(candidate);
  return candidate;
}

function slugFieldKeyBase(raw: string, max = 96): string {
  const s = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fff-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, max);
  return s || 'row';
}

/**
 * `businessContext` 一级子键 → `DesignDetailTaskToken.tokens` **唯一元素**（与 `task1BusinessInsight.js` 占位说明对齐；未知键回退 `业务背景/（英文键）`）
 */
const BUSINESS_CONTEXT_FIRST_LEVEL_TOKEN_ZH: Readonly<Record<string, string>> = {
  clientName: '业务背景/企业/项目名称',
  industryDomain: '业务背景/所属行业及核心商业模式',
  orgTopology: '业务背景/组织拓扑',
};

/** 需求提炼已下线子项：不再生成 token（`businessStatus` 已迁至顶层 `corePainPointSummary` → `痛点雷达/核心痛点总结`） */
const DEPRECATED_BUSINESS_CONTEXT_CHILD_KEYS = new Set(['digitalMaturity', 'businessStatus']);

/** 与 `task1BusinessInsight.js` 顶层 `corePainPointSummary` 对齐 */
const PAIN_POINT_RADAR_CORE_SUMMARY_TOKEN = '痛点雷达/核心痛点总结';

function resolveCorePainPointSummaryFromRequirementParsed(
  requirementParsed: Record<string, unknown> | undefined,
): string {
  if (!requirementParsed) return '';
  const direct = String(requirementParsed.corePainPointSummary ?? '').trim();
  if (direct) return direct;
  const bc = requirementParsed.businessContext;
  if (bc && typeof bc === 'object' && !Array.isArray(bc)) {
    return String((bc as Record<string, unknown>).businessStatus ?? '').trim();
  }
  return '';
}

function resolveBusinessContextThirdTokenSurface(childKey: string): string {
  const k = String(childKey || '').trim();
  const mapped = BUSINESS_CONTEXT_FIRST_LEVEL_TOKEN_ZH[k];
  if (mapped) return mapped;
  if (!k) return '业务背景/（未命名）';
  return `业务背景/（${k}）`;
}

const CORE_ENTITY_CATEGORY_ZH = new Set(['人', '财', '物', '事']);

/** `conceptCategory` → 人｜财｜物｜事（与提示词四选一一致；无法识别时回退「事」） */
function normalizeCoreEntityConceptCategory(raw: unknown): string {
  const s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, '');
  if (CORE_ENTITY_CATEGORY_ZH.has(s)) return s;
  if (s.includes('人')) return '人';
  if (s.includes('财')) return '财';
  if (s.includes('物')) return '物';
  if (s.includes('事')) return '事';
  return '事';
}

/**
 * 单元素路径：如 `核心业务对象/物/教材`、`核心业务对象/人/客户（企业客户/个人客户）`（实体名取自 `entityName`）
 */
function resolveCoreBusinessEntityThirdTokenSurface(ent: Record<string, unknown>, entityDisplay: string): string {
  const cat = normalizeCoreEntityConceptCategory(ent.conceptCategory);
  const name = String(entityDisplay || '').trim() || '未命名对象';
  return `核心业务对象/${cat}/${name}`;
}

/**
 * `coreBusinessEntities` 为对象数组：每条 `tokens` **仅** `[「核心业务对象/人|财|物|事/实体名」]`，整段实体 JSON 入 `DesignFeatureNode.value`。
 */
function buildCoreBusinessEntitiesSectionPlan(
  caseId: string,
  sectionKey: string,
  sectionLabelZh: string,
  sectionPayload: unknown,
): CustomerReqSectionGraphPlan {
  const rows: CustomerReqSectionGraphRow[] = [];
  if (!Array.isArray(sectionPayload) || sectionPayload.length === 0) {
    return { rows, linkPairs: [] };
  }

  const usedFieldKeys = new Set<string>();
  for (let i = 0; i < sectionPayload.length; i += 1) {
    const item = sectionPayload[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    const ent = item as Record<string, unknown>;
    const entityNameRaw = typeof ent.entityName === 'string' ? ent.entityName.trim() : '';
    const entityDisplay = entityNameRaw || `对象${i + 1}`;

    let idBase =
      typeof ent.identifier === 'string' && ent.identifier.trim().length > 0
        ? ent.identifier.trim()
        : `${i}_${entityDisplay}`;
    let fieldKey = idBase;
    let dup = 0;
    while (usedFieldKeys.has(fieldKey)) {
      dup += 1;
      fieldKey = `${idBase}__${dup}`;
    }
    usedFieldKeys.add(fieldKey);

    const pathOnly = resolveCoreBusinessEntityThirdTokenSurface(ent, entityDisplay);
    const tokenSurfaces: string[] = [pathOnly];

    const normalized = item;
    const hasFeature = !isTask1FeatureValueEmpty(normalized);

    rows.push({
      fieldKey,
      featureId: buildCustomerReqSectionFeatureId(caseId, sectionKey, fieldKey),
      tokenSurfaces,
      featureValue: normalized,
      hasFeature,
    });
  }

  return { rows, linkPairs: [] };
}

/**
 * 去掉 `entity` 末尾形如 `(1)`、`（2）`、`（１）`（全角数字）的编号尾缀（常见于模型重复行或复制 noise），
 * 避免「个体学员」与「个体学员 (1)」被拆成两桶、两条 token。
 */
function stripStateTransitionEntityDuplicateSuffix(raw: string): string {
  let s = String(raw ?? '').trim();
  for (let n = 0; n < 8; n += 1) {
    const next = s.replace(/[\s]*[(（][\s]*\p{Nd}+[\s]*[)）][\s]*$/u, '').trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/** 归并键：先剥编号尾缀、再去空白；无实体名时并入同一桶 `__unnamed__`（单 token「未命名实体」） */
function normalizeStateTransitionEntityGroupKey(entity: string): string {
  const base = stripStateTransitionEntityDuplicateSuffix(entity);
  const compact = base.replace(/\s+/g, '');
  return compact.length > 0 ? compact : '__unnamed__';
}

/** 状态转移矩阵：同一实体 **仅一条** token `状态转移矩阵/{实体名称}`；`entity` 尾缀 `(1)` / `（１）` 等会先剥除再归并；多行转移合并入 `value.stateTransitionRows` */
function buildStateTransitionMatrixSectionPlan(
  caseId: string,
  sectionKey: string,
  sectionLabelZh: string,
  sectionPayload: unknown,
): CustomerReqSectionGraphPlan {
  const rows: CustomerReqSectionGraphRow[] = [];
  if (!Array.isArray(sectionPayload) || sectionPayload.length === 0) {
    return { rows, linkPairs: [] };
  }

  const orderKeys: string[] = [];
  const buckets = new Map<string, Record<string, unknown>[]>();

  for (let i = 0; i < sectionPayload.length; i += 1) {
    const item = sectionPayload[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const entity = typeof row.entity === 'string' ? row.entity.trim() : '';
    const gk = normalizeStateTransitionEntityGroupKey(entity);
    if (!buckets.has(gk)) {
      buckets.set(gk, []);
      orderKeys.push(gk);
    }
    buckets.get(gk)!.push(row);
  }

  for (const gk of orderKeys) {
    const items = buckets.get(gk);
    if (!items || items.length === 0) continue;
    const first = items[0]!;
    const ent0 = typeof first.entity === 'string' ? first.entity.trim() : '';
    const displayEntity =
      gk === '__unnamed__'
        ? '未命名实体'
        : stripStateTransitionEntityDuplicateSuffix(ent0) || gk;
    const pathOnly = `${STM_PREFIX}/${sanitizeTokenSecondSegment(displayEntity)}`;
    const fieldKey =
      gk === '__unnamed__'
        ? 'stm_unnamed'
        : slugFieldKeyBase(`stm_${gk}`, 96);

    const normalized =
      items.length === 1
        ? items[0]
        : { entity: displayEntity, stateTransitionRows: items };
    const hasFeature = !isTask1FeatureValueEmpty(normalized);
    rows.push({
      fieldKey,
      featureId: buildCustomerReqSectionFeatureId(caseId, sectionKey, fieldKey),
      tokenSurfaces: [pathOnly],
      featureValue: normalized,
      hasFeature,
    });
  }

  return { rows, linkPairs: [] };
}

/** 痛点雷达：首行 `痛点雷达/核心痛点总结`（`corePainPointSummary`）；其余每条 `痛点雷达/{维度短名}`，整行对象（含 `description`）入 `value` */
export function buildPainPointRadarSectionPlan(
  caseId: string,
  sectionKey: string,
  sectionLabelZh: string,
  sectionPayload: unknown,
  requirementParsed?: Record<string, unknown>,
): CustomerReqSectionGraphPlan {
  const rows: CustomerReqSectionGraphRow[] = [];

  const summaryText = resolveCorePainPointSummaryFromRequirementParsed(requirementParsed);
  if (summaryText) {
    const normalized = { corePainPointSummary: summaryText };
    rows.push({
      fieldKey: 'corePainPointSummary',
      featureId: buildCustomerReqSectionFeatureId(caseId, sectionKey, 'corePainPointSummary'),
      tokenSurfaces: [PAIN_POINT_RADAR_CORE_SUMMARY_TOKEN],
      featureValue: normalized,
      hasFeature: !isTask1FeatureValueEmpty(normalized),
    });
  }

  if (!Array.isArray(sectionPayload) || sectionPayload.length === 0) {
    return { rows, linkPairs: [] };
  }

  const usedSurfaces = new Set<string>();

  for (let i = 0; i < sectionPayload.length; i += 1) {
    const item = sectionPayload[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const dimension = typeof row.dimension === 'string' ? row.dimension.trim() : '';
    const description = typeof row.description === 'string' ? row.description.trim() : '';
    const dimKey = dimension.replace(/\s+/g, '') || `__pain_${i}`;
    const descShort = sanitizeTokenSecondSegment(description).slice(0, 36);
    const dimForToken = pprDimensionShortForToken(dimension);
    const baseLabel = dimForToken || `痛点${i + 1}`;
    const pathOnly = allocUniqueTokenSurface(PPR_PREFIX, baseLabel, usedSurfaces);

    const idBase =
      typeof row.identifier === 'string' && row.identifier.trim().length > 0
        ? row.identifier.trim()
        : slugFieldKeyBase(`${dimKey}_${descShort}_${i}`, 96);
    const fieldKey = slugFieldKeyBase(`ppr_${idBase}`, 96);

    const normalized = item;
    const hasFeature = !isTask1FeatureValueEmpty(normalized);
    rows.push({
      fieldKey,
      featureId: buildCustomerReqSectionFeatureId(caseId, sectionKey, fieldKey),
      tokenSurfaces: [pathOnly],
      featureValue: normalized,
      hasFeature,
    });
  }

  return { rows, linkPairs: [] };
}

/** 从 JSON 数组字段提取非空字符串项（顺序保留） */
function nonemptyTrimmedStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === 'string' && x.trim()) out.push(x.trim());
  }
  return out;
}

/** IT 现状与集成：至多三行固定 token（现有系统 / 待集成系统 / 部署形态），各子块完整 JSON 入 `value` */
function buildItLandscapeSectionPlan(
  caseId: string,
  sectionKey: string,
  sectionLabelZh: string,
  sectionPayload: unknown,
): CustomerReqSectionGraphPlan {
  const rows: CustomerReqSectionGraphRow[] = [];
  if (!sectionPayload || typeof sectionPayload !== 'object' || Array.isArray(sectionPayload)) {
    return { rows, linkPairs: [] };
  }
  const o = sectionPayload as Record<string, unknown>;

  const legacyList = nonemptyTrimmedStringArray(o.legacySystems);
  if (legacyList.length > 0) {
    const normalized = { legacySystems: legacyList };
    const hasFeature = !isTask1FeatureValueEmpty(normalized);
    rows.push({
      fieldKey: 'itl_legacy_systems',
      featureId: buildCustomerReqSectionFeatureId(caseId, sectionKey, 'itl_legacy_systems'),
      tokenSurfaces: [ITL_TOKEN_LEGACY],
      featureValue: normalized,
      hasFeature,
    });
  }

  const integList = nonemptyTrimmedStringArray(o.integrationRequirements);
  if (integList.length > 0) {
    const normalized = { integrationRequirements: integList };
    const hasFeature = !isTask1FeatureValueEmpty(normalized);
    rows.push({
      fieldKey: 'itl_integration_requirements',
      featureId: buildCustomerReqSectionFeatureId(caseId, sectionKey, 'itl_integration_requirements'),
      tokenSurfaces: [ITL_TOKEN_INTEGRATION],
      featureValue: normalized,
      hasFeature,
    });
  }

  const dep = o.deploymentMode;
  if (typeof dep === 'string' && dep.trim()) {
    const normalized = { deploymentMode: dep.trim() };
    const hasFeature = !isTask1FeatureValueEmpty(normalized);
    rows.push({
      fieldKey: 'itl_deployment_mode',
      featureId: buildCustomerReqSectionFeatureId(caseId, sectionKey, 'itl_deployment_mode'),
      tokenSurfaces: [ITL_TOKEN_DEPLOYMENT],
      featureValue: normalized,
      hasFeature,
    });
  }

  return { rows, linkPairs: [] };
}

const EXISTING_SPREADSHEETS_PREFIX = '现有表格';

/** 表头列表 → `DesignFeatureNode.value`（`operator`＝**包含**） */
export function joinExistingSpreadsheetColumnHeadersForFeatureValue(headers: string[]): string {
  return headers
    .map((h) => String(h ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

/** `existingSpreadsheets`：每条 `["现有表格/{表名}"]`，标量表头串入 `value`，`operator`＝**包含** */
export function buildExistingSpreadsheetsSectionPlan(
  caseId: string,
  sectionKey: string,
  sectionLabelZh: string,
  sectionPayload: unknown,
): CustomerReqSectionGraphPlan {
  const rows: CustomerReqSectionGraphRow[] = [];
  if (!Array.isArray(sectionPayload) || sectionPayload.length === 0) {
    return { rows, linkPairs: [] };
  }

  const usedSurfaces = new Set<string>();
  const usedFieldKeys = new Set<string>();

  const rawRows: ExistingSpreadsheetRow[] = [];
  for (let i = 0; i < sectionPayload.length; i += 1) {
    const item = sectionPayload[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const headers = nonemptyTrimmedStringArray(row.columnHeaders);
    if (headers.length === 0) continue;
    const tableNameRaw = typeof row.tableName === 'string' ? row.tableName.trim() : '';
    rawRows.push({ tableName: tableNameRaw, columnHeaders: headers });
  }
  const refinedRows = refineExistingSpreadsheetTableNames(rawRows);

  for (let i = 0; i < refinedRows.length; i += 1) {
    const { tableName: tableNameRefined, columnHeaders: headers } = refinedRows[i]!;
    const tableName = tableNameRefined.trim();
    if (!isExplicitExistingSpreadsheetTableName(tableName) || headers.length === 0) continue;

    const pathOnly = allocUniqueTokenSurface(
      EXISTING_SPREADSHEETS_PREFIX,
      tableName,
      usedSurfaces,
    );
    const featureValue = joinExistingSpreadsheetColumnHeadersForFeatureValue(headers);
    const hasFeature = !isTask1FeatureValueEmpty(featureValue);

    let fieldKey = slugFieldKeyBase(`ess_${tableName}`, 96);
    let dup = 0;
    while (usedFieldKeys.has(fieldKey)) {
      dup += 1;
      fieldKey = `${fieldKey}__${dup}`;
    }
    usedFieldKeys.add(fieldKey);

    rows.push({
      fieldKey,
      featureId: buildCustomerReqSectionFeatureId(caseId, sectionKey, fieldKey),
      tokenSurfaces: [pathOnly],
      featureValue,
      hasFeature,
      operator: '包含',
    });
  }

  return { rows, linkPairs: [] };
}

const OPERATION_MODEL_PREFIX = '运营模式';

/** `stakeholders` 单行「标题：正文」→ 标题为人员组织节点名（如 总部角色） */
function extractOrgStakeholderRoleTitle(line: string): string {
  const s = String(line || '').trim();
  if (!s || s === 'NOT_SPECIFIED') return '';
  const m = s.match(/^(.+?)[:：]/u);
  if (m && m[1]) {
    const t = m[1].trim();
    if (t) return t;
  }
  const fb = sanitizeTokenSecondSegment(s);
  return fb.length > 0 ? fb : '';
}

/** 运营模式：`人员组织/{角色标题}` + `业务流程/{流程名}`，同标题/流程名合并一行，**不**在路径末追加编号 token */
function buildOperationModelSectionPlan(
  caseId: string,
  sectionKey: string,
  sectionLabelZh: string,
  sectionPayload: unknown,
): CustomerReqSectionGraphPlan {
  const rows: CustomerReqSectionGraphRow[] = [];
  if (!sectionPayload || typeof sectionPayload !== 'object' || Array.isArray(sectionPayload)) {
    return { rows, linkPairs: [] };
  }
  const o = sectionPayload as Record<string, unknown>;

  const personnelOrder: string[] = [];
  const personnelBuckets = new Map<string, string[]>();
  const org = o.orgAndRoles;
  if (org && typeof org === 'object' && !Array.isArray(org)) {
    const sh = (org as Record<string, unknown>).stakeholders;
    if (Array.isArray(sh)) {
      for (const item of sh) {
        if (typeof item !== 'string') continue;
        const line = item.trim();
        if (!line) continue;
        const title = extractOrgStakeholderRoleTitle(line);
        if (!title) continue;
        const nk = title.replace(/\s+/g, '');
        if (!personnelBuckets.has(nk)) {
          personnelBuckets.set(nk, []);
          personnelOrder.push(nk);
        }
        personnelBuckets.get(nk)!.push(item);
      }
    }
  }

  const processOrder: string[] = [];
  const processBuckets = new Map<string, Record<string, unknown>[]>();
  const fvs = o.fullValueStreams;
  if (Array.isArray(fvs)) {
    for (let i = 0; i < fvs.length; i += 1) {
      const it = fvs[i];
      if (!it || typeof it !== 'object' || Array.isArray(it)) continue;
      const r = it as Record<string, unknown>;
      const pn = typeof r.processName === 'string' ? r.processName.trim() : '';
      const dm = typeof r.domain === 'string' ? r.domain.trim() : '';
      const name = pn || dm || `流程${i + 1}`;
      if (!name || name === 'NOT_SPECIFIED') continue;
      const nk = name.replace(/\s+/g, '');
      if (!processBuckets.has(nk)) {
        processBuckets.set(nk, []);
        processOrder.push(nk);
      }
      processBuckets.get(nk)!.push(r);
    }
  }

  for (const nk of personnelOrder) {
    const lines = personnelBuckets.get(nk)!;
    const roleTitle = extractOrgStakeholderRoleTitle(lines[0]!);
    const pathOnly = `${OPERATION_MODEL_PREFIX}/人员组织/${sanitizeTokenSecondSegment(roleTitle)}`;
    const normalized =
      lines.length === 1 ? { stakeholderLine: lines[0] } : { stakeholderLines: lines };
    const hasFeature = !isTask1FeatureValueEmpty(normalized);
    const fieldKey = slugFieldKeyBase(`om_org_${nk}`, 96);
    rows.push({
      fieldKey,
      featureId: buildCustomerReqSectionFeatureId(caseId, sectionKey, fieldKey),
      tokenSurfaces: [pathOnly],
      featureValue: normalized,
      hasFeature,
    });
  }

  for (const nk of processOrder) {
    const items = processBuckets.get(nk)!;
    const first = items[0]!;
    const pn0 = typeof first.processName === 'string' ? first.processName.trim() : '';
    const dm0 = typeof first.domain === 'string' ? first.domain.trim() : '';
    const procName = pn0 || dm0 || nk;
    const pathOnly = `${OPERATION_MODEL_PREFIX}/业务流程/${sanitizeTokenSecondSegment(procName)}`;
    const normalized = items.length === 1 ? items[0] : { processName: procName, valueStreamRows: items };
    const hasFeature = !isTask1FeatureValueEmpty(normalized);
    const fieldKey = slugFieldKeyBase(`om_vs_${nk}`, 96);
    rows.push({
      fieldKey,
      featureId: buildCustomerReqSectionFeatureId(caseId, sectionKey, fieldKey),
      tokenSurfaces: [pathOnly],
      featureValue: normalized,
      hasFeature,
    });
  }

  return { rows, linkPairs: [] };
}

const MANAGEMENT_RESOURCES_PREFIX = '管理资源';

/** 与需求 JSON 四键对应；每条 token `管理资源/{中文资源名}`，**不**为名称追加编号后缀 */
const MANAGEMENT_RESOURCES_FIELD_LABELS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'peopleResource', label: '人力资源' },
  { key: 'financeResource', label: '财务资源' },
  { key: 'assetResource', label: '实物资产' },
  { key: 'informationAsset', label: '信息资产' },
];

function buildManagementResourcesSectionPlan(
  caseId: string,
  sectionKey: string,
  sectionLabelZh: string,
  sectionPayload: unknown,
): CustomerReqSectionGraphPlan {
  const rows: CustomerReqSectionGraphRow[] = [];
  if (!sectionPayload || typeof sectionPayload !== 'object' || Array.isArray(sectionPayload)) {
    return { rows, linkPairs: [] };
  }
  const o = sectionPayload as Record<string, unknown>;

  for (const { key, label } of MANAGEMENT_RESOURCES_FIELD_LABELS) {
    const raw = o[key];
    if (typeof raw !== 'string') continue;
    const text = raw.trim();
    if (!text || text === 'NOT_SPECIFIED') continue;
    const pathOnly = `${MANAGEMENT_RESOURCES_PREFIX}/${sanitizeTokenSecondSegment(label)}`;
    const normalized: Record<string, unknown> = { [key]: text };
    const hasFeature = !isTask1FeatureValueEmpty(normalized);
    const fieldKey = slugFieldKeyBase(`mr_${key}`, 64);
    rows.push({
      fieldKey,
      featureId: buildCustomerReqSectionFeatureId(caseId, sectionKey, fieldKey),
      tokenSurfaces: [pathOnly],
      featureValue: normalized,
      hasFeature,
    });
  }

  return { rows, linkPairs: [] };
}

/** `sectionPayload` 一般为 `parsed[sectionKey]`：对象分域对其 **第一级** 子键各生成一行 token（空值不写特征）；`coreBusinessEntities` 见上 */
export function buildCustomerReqSectionGraphPlan(
  caseId: string,
  sectionKey: string,
  sectionLabelZh: string,
  sectionPayload: unknown,
): CustomerReqSectionGraphPlan {
  if (sectionKey === 'coreBusinessEntities') {
    if (Array.isArray(sectionPayload)) {
      return buildCoreBusinessEntitiesSectionPlan(caseId, sectionKey, sectionLabelZh, sectionPayload);
    }
    return { rows: [], linkPairs: [] };
  }
  if (sectionKey === 'stateTransitionMatrix') {
    return buildStateTransitionMatrixSectionPlan(caseId, sectionKey, sectionLabelZh, sectionPayload);
  }
  if (sectionKey === 'painPointRadar') {
    return buildPainPointRadarSectionPlan(caseId, sectionKey, sectionLabelZh, sectionPayload);
  }
  if (sectionKey === 'itLandscape') {
    return buildItLandscapeSectionPlan(caseId, sectionKey, sectionLabelZh, sectionPayload);
  }
  if (sectionKey === 'existingSpreadsheets') {
    return buildExistingSpreadsheetsSectionPlan(caseId, sectionKey, sectionLabelZh, sectionPayload);
  }
  if (sectionKey === 'operationModel') {
    return buildOperationModelSectionPlan(caseId, sectionKey, sectionLabelZh, sectionPayload);
  }
  if (sectionKey === 'managementResources') {
    return buildManagementResourcesSectionPlan(caseId, sectionKey, sectionLabelZh, sectionPayload);
  }

  const rows: CustomerReqSectionGraphRow[] = [];
  if (!sectionPayload || typeof sectionPayload !== 'object' || Array.isArray(sectionPayload)) {
    return { rows, linkPairs: [] };
  }
  const raw = sectionPayload as Record<string, unknown>;
  const keys = Object.keys(raw).filter((k) => typeof k === 'string' && k.length > 0 && !k.startsWith('__'));
  keys.sort((a, b) => a.localeCompare(b));

  for (const childKey of keys) {
    if (sectionKey === 'businessContext' && DEPRECATED_BUSINESS_CONTEXT_CHILD_KEYS.has(childKey)) {
      continue;
    }
    const value = raw[childKey];
    /** 业务背景：仅二级中文路径单元素；其它分域仍三元素（首项 `sectionKey` 便于删行） */
    const tokenSurfaces: string[] =
      sectionKey === 'businessContext'
        ? [resolveBusinessContextThirdTokenSurface(childKey)]
        : (() => {
            const third = childKey;
            const arr: string[] = [];
            const seen = new Set<string>();
            for (const s of [sectionKey, sectionLabelZh, third]) {
              const t = String(s || '').trim();
              if (!t || seen.has(t)) continue;
              seen.add(t);
              arr.push(t);
            }
            if (arr.length === 0) arr.push(sectionKey, childKey);
            return arr;
          })();

    const normalized = value === undefined ? null : value;
    const hasFeature = !isTask1FeatureValueEmpty(normalized);

    rows.push({
      fieldKey: childKey,
      featureId: buildCustomerReqSectionFeatureId(caseId, sectionKey, childKey),
      tokenSurfaces,
      featureValue: normalized,
      hasFeature,
    });
  }

  return { rows, linkPairs: [] };
}

export function isAllowedCustomerReqSectionKey(key: string): boolean {
  return DESIGN_CUSTOMER_REQ_GRAPH_SECTIONS.some((s) => s.key === key);
}

