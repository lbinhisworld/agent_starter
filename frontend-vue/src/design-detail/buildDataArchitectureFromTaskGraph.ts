/**
 * [INPUT]: `GET …/design-detail/task-graph` 的 `tasks[]` 与 `links[]`
 * [OUTPUT]: 可折叠层叠视图 + 各层「设计逻辑」子卡（inference_summary / 证据链）
 * [POS]: `DesignDetailDataArchitectureTab.vue` 只读数据源
 *
 * [PROTOCOL]: 工具平台 / 跨平台集成 / 一级模块 / 表 Schema 四层均带 `designLogic`；
 *   任务 10 `featureValue` 内嵌 JSON 字符串须经 `unwrapFeatureValueRoot` 二次解析；变更时同步 Tab 与 AGENTS.md
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { pickTask9SystemModuleFeaturesFromGraphTasks } from './buildTask10L5TechnicalDdlInferenceInputFromTaskGraph';
import {
  type DesignDetailLogicGraphLinkDto,
  DESIGN_DETAIL_TASK10_LINE_TASK_ID,
  DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK9_LINE_TASK_ID,
  buildFeatureIdToNormTaskIdFromGraphTasks,
  isDesignDetailReverseValidationLogicLink,
} from './designDetailLogicGraphMerge';
import {
  extractLogicTreeTask10InterfaceName,
  extractLogicTreeTask10TableName,
  formatLogicTreeFeatureValueLine,
  formatLogicTreeTask10FeatureValueLine,
} from './designDetailLogicTreeLayout';

export type DataArchFieldProperty = {
  key: string;
  value: string;
};

/** 二级模块下的字段圆角子卡 */
export type DataArchFieldCard = {
  fieldName: string;
  properties: DataArchFieldProperty[];
};

export type DataArchJsonLeaf = {
  featureId: string;
  label: string;
  jsonText: string;
};

/** 设计逻辑子卡：推理摘要 + 证据链要点（便于用户理解架构决策） */
export type DataArchDesignLogic = {
  paragraphs: string[];
  evidenceBullets: string[];
};

/** 二级模块 = 一张物理表结构 Schema（名称为表格名称） */
export type DataArchLevel2Module = {
  featureId: string;
  name: string;
  tableCategory: string;
  /** 任务 10 `table_metadata.parent_table_ref`（子表 → 主表，供 ER 外键连线） */
  parentTableRef?: string;
  fields: DataArchFieldCard[];
  permissionDesigns: DataArchJsonLeaf[];
  initDesigns: DataArchJsonLeaf[];
  designLogic: DataArchDesignLogic;
};

export type DataArchLevel1Module = {
  featureId: string;
  name: string;
  techHostPlatform: string;
  level2Modules: DataArchLevel2Module[];
  designLogic: DataArchDesignLogic;
};

export type DataArchPlatformBlock = {
  platformKey: string;
  platformLabel: string;
  level1Modules: DataArchLevel1Module[];
  designLogic: DataArchDesignLogic;
};

/** 跨平台接口同步 Schema 单接口子卡 */
export type DataArchCrossPlatformInterfaceCard = {
  featureId: string;
  interfaceName: string;
  communicationCategory: string;
  dataPipeline: string;
  techHostPlatform: string;
  triggerSourceJson: string;
  receiverConfigJson: string;
  fieldMappingJson: string;
};

/** 数据架构页底部「跨平台集成」一级卡 */
export type DataArchCrossPlatformBlock = {
  interfaces: DataArchCrossPlatformInterfaceCard[];
  designLogic: DataArchDesignLogic;
};

export type DataArchitectureModel = {
  platforms: DataArchPlatformBlock[];
  crossPlatformIntegration: DataArchCrossPlatformBlock | null;
  emptyMessage?: string;
};

const SCHEMA_TOKEN_KEY = '物理表结构Schema';
const SYNC_TOKEN_KEY = '跨平台接口同步Schema';
const INIT_TOKEN_KEY = '基础表初始化';
const PERMISSION_TOKEN_KEY = '权限字典初始化SQL';
const ORPHAN_L1_PREFIX = '__data_arch_orphan__';
const TASK10_HOST_PLACEHOLDER_RE = /待\s*Input\s*1|宿主对齐/i;
const GENERIC_FEATURE_OPERATORS = new Set(['等于', '—', '-', 'N/A', 'NA', 'eq', '=', '==']);

function isPlaceholderTechHost(host: string): boolean {
  const h = String(host ?? '').trim();
  if (!h) return true;
  return TASK10_HOST_PLACEHOLDER_RE.test(h);
}

function isGenericFeatureOperator(op: string): boolean {
  return GENERIC_FEATURE_OPERATORS.has(String(op ?? '').trim());
}

function readFeatureValueRaw(feature: Task2L1TaskGraphFeatureRow): unknown {
  const ext = feature as Task2L1TaskGraphFeatureRow & {
    featureValue?: unknown;
    feature_value?: unknown;
  };
  return ext.featureValue ?? ext.feature_value ?? null;
}

const TASK10_SCHEMA_TOKEN_KEYS = new Set([
  SCHEMA_TOKEN_KEY,
  '物理表结构 Schema',
  '物理表结构schema',
]);

const TASK10_SYNC_TOKEN_KEYS = new Set([SYNC_TOKEN_KEY, '跨平台接口同步 Schema', '跨平台接口同步schema']);

function resolveTask10FeatureTokenKey(feature: Task2L1TaskGraphFeatureRow): string {
  const raw = String(
    feature.tokenDisplay ??
      (feature as { token_display?: string }).token_display ??
      (feature as { featureKey?: string }).featureKey ??
      (feature as { token?: string }).token ??
      feature.operator ??
      '',
  ).trim();
  return tokenKeyOne(raw);
}

function isSchemaTokenKey(tok: string): boolean {
  if (TASK10_SCHEMA_TOKEN_KEYS.has(tok)) return true;
  return tok.replace(/\s+/g, '').toLowerCase() === '物理表结构schema';
}

function isSyncTokenKey(tok: string): boolean {
  if (TASK10_SYNC_TOKEN_KEYS.has(tok)) return true;
  return tok.replace(/\s+/g, '').toLowerCase() === '跨平台接口同步schema';
}

function readInferenceSummary(feature: Task2L1TaskGraphFeatureRow): string {
  return String(
    (feature as { inferenceSummary?: string }).inferenceSummary ??
      (feature as { inference_summary?: string }).inference_summary ??
      '',
  ).trim();
}

function extractEvidenceBulletsFromRecord(rec: Record<string, unknown>): string[] {
  const chain = rec.Evidence_Support_Chain ?? rec.evidence_support_chain;
  if (!Array.isArray(chain)) return [];
  const out: string[] = [];
  for (const item of chain) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const logic = String(o.logic ?? o.Logic ?? '').trim();
    const token = String(o.tokenstr ?? o.tokenStr ?? o.TokenStr ?? '').trim();
    const fid = String(o.FeatureID ?? o.featureId ?? '').trim();
    const value = String(o.value ?? o.Value ?? '').trim();
    if (logic && token) {
      out.push(`${token}：${logic}`);
    } else if (logic) {
      out.push(logic);
    } else if (token) {
      out.push(token);
    } else if (fid) {
      out.push(fid);
    } else if (value) {
      out.push(value);
    }
  }
  return out;
}

function extractEvidenceBulletsFromFeature(feature: Task2L1TaskGraphFeatureRow): string[] {
  const ext = feature as Task2L1TaskGraphFeatureRow & {
    featureValue?: unknown;
    feature_value?: unknown;
  };
  const sources: unknown[] = [
    ext.featureValue,
    ext.feature_value,
    feature.name,
    feature.operator,
  ];
  for (const src of sources) {
    const parsed = unwrapFeatureValueRoot(parseFeatureValueObject(src));
    if (!parsed) continue;
    const bullets = extractEvidenceBulletsFromRecord(parsed);
    if (bullets.length) return bullets;
    const nested = parseFeatureValueObject(parsed.Feature_Value ?? parsed.feature_value);
    if (nested) {
      const inner = extractEvidenceBulletsFromRecord(nested);
      if (inner.length) return inner;
    }
  }
  return [];
}

export function mergeDataArchDesignLogic(parts: ReadonlyArray<DataArchDesignLogic>): DataArchDesignLogic {
  const paragraphs: string[] = [];
  const evidenceBullets: string[] = [];
  const seenP = new Set<string>();
  const seenE = new Set<string>();
  for (const part of parts) {
    for (const p of part.paragraphs) {
      const t = p.trim();
      if (!t || seenP.has(t)) continue;
      seenP.add(t);
      paragraphs.push(t);
    }
    for (const e of part.evidenceBullets) {
      const t = e.trim();
      if (!t || seenE.has(t)) continue;
      seenE.add(t);
      evidenceBullets.push(t);
    }
  }
  return { paragraphs, evidenceBullets };
}

const EMPTY_DESIGN_LOGIC_HINT =
  '（暂无推理摘要；请确认任务 9/10 已落库且 task-graph 特征含 inference_summary 或 Evidence_Support_Chain。）';

/** 从单条 task-graph 特征构建「设计逻辑」文案 */
export function buildDesignLogicFromText(contextLine: string): DataArchDesignLogic {
  const t = String(contextLine ?? '').trim();
  if (!t) return { paragraphs: [EMPTY_DESIGN_LOGIC_HINT], evidenceBullets: [] };
  return { paragraphs: [t], evidenceBullets: [] };
}

export function buildDesignLogicFromFeature(
  feature: Task2L1TaskGraphFeatureRow,
  contextLine?: string,
): DataArchDesignLogic {
  const summary = readInferenceSummary(feature);
  const evidenceBullets = extractEvidenceBulletsFromFeature(feature);
  const paragraphs: string[] = [];
  const ctx = String(contextLine ?? '').trim();
  if (ctx) paragraphs.push(ctx);
  if (summary) {
    const chunks = summary.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    if (chunks.length) paragraphs.push(...chunks);
    else paragraphs.push(summary);
  }
  if (!paragraphs.length && !evidenceBullets.length) {
    paragraphs.push(EMPTY_DESIGN_LOGIC_HINT);
  }
  return { paragraphs, evidenceBullets };
}

function prettyJsonFragment(value: unknown, emptyLabel: string): string {
  if (value === null || value === undefined) return emptyLabel;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value) || emptyLabel;
  }
}

function unwrapFeatureValueRoot(parsed: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!parsed) return null;
  const inner = parsed.Feature_Value ?? parsed.feature_value;
  if (typeof inner === 'string') {
    const s = inner.trim();
    if (!s) return parsed;
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        const nested = JSON.parse(s) as unknown;
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          return nested as Record<string, unknown>;
        }
      } catch {
        /* 截断 JSON 等：保留外层供其它路径兜底 */
      }
    } else if (!s.startsWith('[')) {
      return { 表格名称: s, 表名: s, table_name: s };
    }
  }
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  if (
    parsed.table_metadata != null ||
    parsed.columns != null ||
    parsed['字段集合'] != null ||
    parsed['接口名称'] != null
  ) {
    return parsed;
  }
  return parsed;
}

function inferTechHostFromInferenceSummary(feature: Task2L1TaskGraphFeatureRow): string {
  const inf = String(
    (feature as { inferenceSummary?: string }).inferenceSummary ??
      (feature as { inference_summary?: string }).inference_summary ??
      '',
  ).trim();
  if (inf.includes('企微') || inf.includes('企业微信')) return '企业微信智能表格/轻量填报载体';
  if (inf.includes('低代码') || inf.includes('七巧')) return '七巧低代码平台容器';
  return '';
}

function readTechHostFromT10Feature(feature: Task2L1TaskGraphFeatureRow): string {
  const parsed = readFeatureValuePayload(feature);
  const fromModule = readTechHostPlatform(feature, parsed);
  if (fromModule) return fromModule;
  return inferTechHostFromInferenceSummary(feature);
}

function hostsMatch(a: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim();
  if (!x || !y) return false;
  if (x === y) return true;
  const norm = (h: string) => {
    if (h.includes('企微') || h.includes('企业微信')) return 'wecom';
    if (h.includes('七巧') || h.includes('低代码')) return 'qiqiao';
    return h;
  };
  return norm(x) === norm(y);
}

const FIELD_PROP_ORDER = [
  '数据类型',
  '主键约束',
  '外键约束',
  '唯一性',
  '是否外键',
  '被引用的表名',
  '被引用的字段名',
  '说明',
  '备注',
  '精度',
  '默认值',
  '是否必填',
] as const;

/** 任务 10 强类型 JSON Schema：将 `columns` 行归一为架构清单字段卡可读键 */
function normalizeTask10ColumnRow(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...o };
  if (o.field_name != null && out['字段名称'] == null) out['字段名称'] = o.field_name;
  if (o.data_type != null && out['数据类型'] == null) out['数据类型'] = o.data_type;
  const constraintsRaw = String(o.constraints ?? '').trim();
  if (constraintsRaw) {
    if (/外键/u.test(constraintsRaw)) {
      if (out['是否外键'] == null) out['是否外键'] = '是';
      if (out['外键约束'] == null) out['外键约束'] = constraintsRaw;
      const fkRef = /关联至\[(?<bt>[^\]]+)\]的\[(?<bf>[^\]]+)\]字段|关联至(?<t>[^，。]+?)的(?<f>[^，。]+?)字段/u.exec(constraintsRaw);
      if (fkRef) {
        const refTable = (fkRef.groups?.bt ?? fkRef.groups?.t)?.trim();
        const refField = (fkRef.groups?.bf ?? fkRef.groups?.f)?.trim();
        if (out['被引用的表名'] == null && refTable) out['被引用的表名'] = refTable;
        if (out['被引用的字段名'] == null && refField) out['被引用的字段名'] = refField;
      }
    } else if (out['主键约束'] == null) {
      out['主键约束'] = o.constraints;
    }
  }
  const dataTypeRaw = String(o.data_type ?? out['数据类型'] ?? '').trim();
  if (dataTypeRaw === '外键' && out['是否外键'] == null) out['是否外键'] = '是';
  if (dataTypeRaw === '主键' && out['主键约束'] == null) out['主键约束'] = '主键';
  if (o.source_feature_id != null && out['说明'] == null) {
    out['说明'] = `source_feature_id: ${String(o.source_feature_id).trim()}`;
  }
  return out;
}

/** 从 Feature_Value 根对象取字段行数组（兼容旧 `字段集合` 与任务 10 `columns`） */
function extractFieldRowsFromPayload(parsed: Record<string, unknown>): unknown[] {
  const raw =
    parsed['字段集合'] ??
    parsed['字段信息'] ??
    parsed['字段列表'] ??
    parsed.fields ??
    parsed.columns;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? normalizeTask10ColumnRow(item as Record<string, unknown>)
      : item,
  );
}

function readTableNameFromTask10SchemaPayload(parsed: Record<string, unknown>): string {
  const meta = parsed.table_metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const tn = String((meta as Record<string, unknown>).table_name ?? '').trim();
    if (tn) return stripDisplayPrefix(tn);
  }
  return '';
}

/** 优先读 API 下发的原始 value；`name` 仅为表格名摘要 */
function readFeatureValuePayload(feature: Task2L1TaskGraphFeatureRow): Record<string, unknown> | null {
  const sources: unknown[] = [readFeatureValueRaw(feature), feature.name];
  for (const src of sources) {
    const parsed = unwrapFeatureValueRoot(parseFeatureValueObject(src));
    if (!parsed) continue;
    if (extractFieldRowsFromPayload(parsed).length > 0) return parsed;
    if (readTableNameFromTask10SchemaPayload(parsed)) return parsed;
    const table = String(
      parsed['表格名称'] ?? parsed['表格名'] ?? parsed['表名'] ?? parsed.table_name ?? '',
    ).trim();
    if (table) return parsed;
    const iface = String(parsed['接口名称'] ?? '').trim();
    if (iface) return parsed;
    if (parsed['触发源配置'] != null || parsed['接收端配置'] != null) return parsed;
    if (Array.isArray(parsed['两端全中文点对点字段映射字典'])) return parsed;
  }
  return null;
}

function tokenKeyOne(tokenDisplay: string): string {
  const td = String(tokenDisplay ?? '').trim();
  return td.includes('·') ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : td;
}

function stripDisplayPrefix(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return s;
  return s.replace(/^\d+_/, '');
}

function parseFeatureValueObject(name: unknown): Record<string, unknown> | null {
  if (name === null || name === undefined) return null;
  if (typeof name === 'object' && !Array.isArray(name)) return name as Record<string, unknown>;
  if (typeof name === 'string') {
    const s = name.trim();
    if (!s || s === '[object Object]') return null;
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
    return { Feature_Value: s };
  }
  return null;
}

function readFeatureLabel(feature: Task2L1TaskGraphFeatureRow): string {
  const tok = resolveTask10FeatureTokenKey(feature);
  if (isSchemaTokenKey(tok)) {
    const fromSchema =
      formatLogicTreeTask10FeatureValueLine(readFeatureValueRaw(feature), tok) ||
      formatLogicTreeTask10FeatureValueLine(feature.name, tok);
    if (fromSchema && fromSchema !== '—') return fromSchema;
  }
  const fromName = formatLogicTreeFeatureValueLine(feature.name);
  if (fromName && fromName !== '—') return fromName;
  const fromFv = extractLogicTreeTask10TableName(readFeatureValueRaw(feature));
  if (fromFv.trim()) return fromFv.trim();
  const op = String(feature.operator ?? '').trim();
  if (op && !isGenericFeatureOperator(op)) {
    const fromOp = formatLogicTreeFeatureValueLine(feature.operator);
    if (fromOp && fromOp !== '—') return fromOp;
  }
  return '（未命名）';
}

function readModuleName(feature: Task2L1TaskGraphFeatureRow): string {
  const label = readFeatureLabel(feature);
  return label === '（未命名）' ? '系统一级模块' : label;
}

function readTechHostPlatform(
  feature: Task2L1TaskGraphFeatureRow,
  parsed: Record<string, unknown> | null,
): string {
  const meta = String(
    (feature as { techHostPlatform?: string }).techHostPlatform ??
      (feature as { tech_host_platform?: string }).tech_host_platform ??
      '',
  ).trim();
  if (meta && !isPlaceholderTechHost(meta)) return meta;
  if (parsed) {
    const thp = String(
      parsed.Tech_Host_Platform ?? parsed.tech_host_platform ?? parsed['工具宿主平台'] ?? '',
    ).trim();
    if (thp && !isPlaceholderTechHost(thp)) return thp;
  }
  return '';
}

function readTechHostFromTask9Module(mod: Task2L1TaskGraphFeatureRow): string {
  const parsed = unwrapFeatureValueRoot(
    parseFeatureValueObject(mod.name) ?? parseFeatureValueObject(readFeatureValueRaw(mod)),
  );
  return readTechHostPlatform(mod, parsed);
}

function defaultTask9HostForT10(
  moduleFeatures: readonly Task2L1TaskGraphFeatureRow[],
): string {
  for (const mod of moduleFeatures) {
    const h = readTechHostFromTask9Module(mod);
    if (h) return h;
  }
  return '';
}

function orphanL1DisplayName(
  host: string,
  moduleFeatures: readonly Task2L1TaskGraphFeatureRow[],
): string {
  const matches = moduleFeatures.filter((m) => {
    const mh = readTechHostFromTask9Module(m);
    return mh && hostsMatch(mh, host);
  });
  if (matches.length === 1) return readModuleName(matches[0]!);
  if (matches.length > 1) {
    return matches.map((m) => readModuleName(m)).filter(Boolean).join('、') || '（按宿主平台归集）';
  }
  if (moduleFeatures.length === 1) return readModuleName(moduleFeatures[0]!);
  return '（按宿主平台归集）';
}

function platformStyle(host: string): { key: string; label: string } {
  const h = host.trim();
  if (h.includes('七巧') || h.includes('低代码')) {
    return { key: 'qiqiao', label: h || '七巧低代码平台容器' };
  }
  if (h.includes('企微') || h.includes('企业微信')) {
    return { key: 'wecom', label: h || '企业微信智能表格/轻量填报载体' };
  }
  return { key: h || 'unknown', label: h || '（未标注宿主平台）' };
}

function extractTableNameFromFeature(feature: Task2L1TaskGraphFeatureRow): string {
  const fromFv =
    extractLogicTreeTask10TableName(readFeatureValueRaw(feature)) ||
    extractLogicTreeTask10TableName(feature.name);
  if (fromFv.trim()) return stripDisplayPrefix(fromFv.trim());
  const parsed = readFeatureValuePayload(feature);
  if (parsed) {
    const fromMeta = readTableNameFromTask10SchemaPayload(parsed);
    if (fromMeta) return fromMeta;
    const t = stripDisplayPrefix(
      String(
        parsed['表格名称'] ?? parsed['表格名'] ?? parsed['表名'] ?? parsed.table_name ?? '',
      ).trim(),
    );
    if (t) return t;
  }
  const label = readFeatureLabel(feature);
  if (label !== '（未命名）') return label;
  return '';
}

function readParentTableRefFromSchema(parsed: Record<string, unknown> | null): string {
  if (!parsed) return '';
  const meta = parsed.table_metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const ref = String((meta as Record<string, unknown>).parent_table_ref ?? '').trim();
    if (ref && ref !== 'N/A') return stripDisplayPrefix(ref);
  }
  return '';
}

function extractTableCategory(parsed: Record<string, unknown> | null): string {
  if (!parsed) return '';
  const fromLegacy = stripDisplayPrefix(
    String(parsed['表格类别'] ?? parsed['表类别'] ?? parsed['类别'] ?? '').trim(),
  );
  if (fromLegacy) return fromLegacy;
  const meta = parsed.table_metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const it = String((meta as Record<string, unknown>).induction_type ?? '').trim();
    if (it.includes('主表')) return '主表';
    if (it.includes('基础')) return '基础表';
    if (it.includes('裂变') || it.includes('子表')) return '子表';
  }
  return '';
}

function formatPropValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function fieldNameFromRow(o: Record<string, unknown>): string {
  return stripDisplayPrefix(
    String(o['字段名称'] ?? o['字段名'] ?? o.name ?? o.field_name ?? '').trim(),
  );
}

/** 从 Schema Feature_Value 解析字段子卡 */
export function parseSchemaFieldCards(feature: Task2L1TaskGraphFeatureRow): DataArchFieldCard[] {
  const parsed = readFeatureValuePayload(feature);
  if (!parsed) return [];
  const rawFields = extractFieldRowsFromPayload(parsed);
  if (!rawFields.length) return [];

  const cards: DataArchFieldCard[] = [];
  for (const item of rawFields) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const fieldName = fieldNameFromRow(o);
    if (!fieldName) continue;

    const usedKeys = new Set<string>(['字段名称', '字段名', 'name', 'field_name']);
    const properties: DataArchFieldProperty[] = [];

    for (const k of FIELD_PROP_ORDER) {
      const v = formatPropValue(o[k]);
      if (v) {
        properties.push({ key: k, value: v });
        usedKeys.add(k);
      }
    }
    for (const [k, v] of Object.entries(o)) {
      if (usedKeys.has(k)) continue;
      const val = formatPropValue(v);
      if (!val) continue;
      properties.push({ key: k, value: val });
    }

    cards.push({ fieldName, properties });
  }
  return cards;
}

function featureToPrettyJson(feature: Task2L1TaskGraphFeatureRow): string {
  const parsed = readFeatureValuePayload(feature);
  if (parsed) {
    try {
      return JSON.stringify(parsed, null, 2);
    } catch {
      /* fall through */
    }
  }
  const raw = String(feature.name ?? feature.operator ?? '').trim();
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(raw) as unknown, null, 2);
    } catch {
      return raw;
    }
  }
  return raw || '（无 JSON 内容）';
}

function toJsonLeaf(f: Task2L1TaskGraphFeatureRow, label?: string): DataArchJsonLeaf {
  return {
    featureId: String(f.featureId ?? ''),
    label: label ?? extractTableNameFromFeature(f),
    jsonText: featureToPrettyJson(f),
  };
}

function linkTargetId(l: DesignDetailLogicGraphLinkDto): string {
  return String(l.targetFeatureId ?? l.target?.featureId ?? '').trim();
}

function linkSourceId(l: DesignDetailLogicGraphLinkDto): string {
  return String(l.sourceFeatureId ?? l.source?.featureId ?? '').trim();
}

function isForwardLink(
  l: DesignDetailLogicGraphLinkDto,
  featureIdToNormTaskId: Map<string, string>,
): boolean {
  return !isDesignDetailReverseValidationLogicLink(l, featureIdToNormTaskId);
}

function pickTask10DesignFeatures(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t10 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK10_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID ||
      id.includes('任务 10')
    );
  });
  return Array.isArray(t10?.features) ? t10.features : [];
}

/** 正向归纳边 + Tech_Host_Platform 回退（与逻辑树 task10 布局一致） */
function resolveModuleForT10Feature(
  feat: Task2L1TaskGraphFeatureRow,
  t10ToModule: Map<string, string>,
  moduleFeatures: Task2L1TaskGraphFeatureRow[],
): Task2L1TaskGraphFeatureRow | null {
  const featFid = String(feat.featureId ?? '').trim();
  const linkedModFid = t10ToModule.get(featFid);
  if (linkedModFid) {
    const linked = moduleFeatures.find((m) => String(m.featureId ?? '').trim() === linkedModFid);
    if (linked) return linked;
  }
  const host = readTechHostFromT10Feature(feat);
  if (host) {
    for (const mod of moduleFeatures) {
      const modHost = readTechHostFromTask9Module(mod);
      if (modHost && hostsMatch(modHost, host)) return mod;
    }
  }
  if (moduleFeatures.length === 1) return moduleFeatures[0]!;
  return null;
}

/** 任务 10 特征（Schema / 初始化 / 权限）→ 一级模块 featureId */
function buildT10FeatureToModuleMap(
  t10Features: Task2L1TaskGraphFeatureRow[],
  moduleFeatures: Task2L1TaskGraphFeatureRow[],
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  featureIdToNormTaskId: Map<string, string>,
): Map<string, string> {
  const moduleIds = new Set(moduleFeatures.map((f) => String(f.featureId ?? '').trim()).filter(Boolean));
  const t10Ids = new Set(t10Features.map((f) => String(f.featureId ?? '').trim()).filter(Boolean));
  const t9Norm = DESIGN_DETAIL_TASK9_LINE_TASK_ID;
  const out = new Map<string, string>();
  for (const L of links) {
    if (!isForwardLink(L, featureIdToNormTaskId)) continue;
    const src = linkSourceId(L);
    const tgt = linkTargetId(L);
    if (moduleIds.has(src) && t10Ids.has(tgt)) {
      out.set(tgt, src);
      continue;
    }
    if (t10Ids.has(src) && moduleIds.has(tgt)) {
      out.set(src, tgt);
      continue;
    }
    if (t10Ids.has(tgt) && featureIdToNormTaskId.get(src) === t9Norm && moduleIds.has(src)) {
      out.set(tgt, src);
    }
  }
  return out;
}

function parseCrossPlatformInterfaceCard(
  feature: Task2L1TaskGraphFeatureRow,
): DataArchCrossPlatformInterfaceCard | null {
  const parsed = readFeatureValuePayload(feature);
  if (!parsed) return null;
  const interfaceName =
    String(parsed['接口名称'] ?? '').trim() ||
    extractLogicTreeTask10InterfaceName(feature.name) ||
    extractLogicTreeTask10InterfaceName(feature.operator) ||
    readFeatureLabel(feature);
  const featFid = String(feature.featureId ?? '').trim();
  return {
    featureId: featFid,
    interfaceName: interfaceName || '（未命名接口）',
    communicationCategory: String(parsed['通信类别'] ?? '').trim(),
    dataPipeline: String(parsed['数据管道载体'] ?? '').trim(),
    techHostPlatform: readTechHostFromT10Feature(feature),
    triggerSourceJson: prettyJsonFragment(parsed['触发源配置'], '（无触发源配置）'),
    receiverConfigJson: prettyJsonFragment(parsed['接收端配置'], '（无接收端配置）'),
    fieldMappingJson: prettyJsonFragment(
      parsed['两端全中文点对点字段映射字典'],
      '（无字段映射字典）',
    ),
  };
}

function buildCrossPlatformIntegrationBlock(
  syncFeatures: Task2L1TaskGraphFeatureRow[],
): DataArchCrossPlatformBlock | null {
  const interfaces = syncFeatures
    .map((f) => parseCrossPlatformInterfaceCard(f))
    .filter((c): c is DataArchCrossPlatformInterfaceCard => c !== null)
    .sort((a, b) => a.interfaceName.localeCompare(b.interfaceName, 'zh-CN'));
  if (!interfaces.length) return null;
  const designLogic = mergeDataArchDesignLogic([
    buildDesignLogicFromText(
      '跨平台集成区块汇总企业微信等轻量输入口与低代码主库之间的接口同步 Schema，焊死跨宿主数据契约与字段级映射账本。',
    ),
    ...syncFeatures.map((f) => buildDesignLogicFromFeature(f)),
  ]);
  return { interfaces, designLogic };
}

function findL2ByTableName(l1: { l2Map: Map<string, DataArchLevel2Module> }, tableName: string): DataArchLevel2Module | undefined {
  const norm = tableName.trim();
  for (const l2 of l1.l2Map.values()) {
    if (l2.name === norm) return l2;
  }
  return undefined;
}

/** 从 task-graph 构建数据架构层叠模型（只读） */
export function buildDataArchitectureFromTaskGraph(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto> = [],
): DataArchitectureModel {
  const moduleFeatures = pickTask9SystemModuleFeaturesFromGraphTasks(tasks);
  const allT10Features = pickTask10DesignFeatures(tasks);
  const schemaFeatures = allT10Features.filter((f) => isSchemaTokenKey(resolveTask10FeatureTokenKey(f)));
  const syncFeatures = allT10Features.filter((f) => isSyncTokenKey(resolveTask10FeatureTokenKey(f)));
  const crossPlatformIntegration = buildCrossPlatformIntegrationBlock(syncFeatures);

  if (!moduleFeatures.length && !schemaFeatures.length && !crossPlatformIntegration) {
    return {
      platforms: [],
      crossPlatformIntegration: null,
      emptyMessage: '暂无任务 9/10 数据架构内容，请先完成任务 10 Target_KV 落库。',
    };
  }

  const featureIdToNormTaskId = buildFeatureIdToNormTaskIdFromGraphTasks(tasks);
  const t10ToModule = buildT10FeatureToModuleMap(allT10Features, moduleFeatures, links, featureIdToNormTaskId);

  type L1Acc = {
    feature: Task2L1TaskGraphFeatureRow;
    host: string;
    l2Map: Map<string, DataArchLevel2Module>;
  };
  type PlatformAcc = { style: ReturnType<typeof platformStyle>; l1Map: Map<string, L1Acc> };

  const platformMap = new Map<string, PlatformAcc>();

  const ensureL1 = (mod: Task2L1TaskGraphFeatureRow): L1Acc => {
    const parsed = unwrapFeatureValueRoot(
      parseFeatureValueObject(mod.name) ?? parseFeatureValueObject(readFeatureValueRaw(mod)),
    );
    let host = readTechHostPlatform(mod, parsed) || defaultTask9HostForT10(moduleFeatures) || '（未标注宿主平台）';
    if (isPlaceholderTechHost(host)) {
      host = defaultTask9HostForT10(moduleFeatures) || '（未标注宿主平台）';
    }
    const style = platformStyle(host);
    let pAcc = platformMap.get(style.key);
    if (!pAcc) {
      pAcc = { style, l1Map: new Map() };
      platformMap.set(style.key, pAcc);
    }
    const modFid = String(mod.featureId ?? '').trim();
    let l1 = pAcc.l1Map.get(modFid);
    if (!l1) {
      l1 = { feature: mod, host, l2Map: new Map() };
      pAcc.l1Map.set(modFid, l1);
    }
    return l1;
  };

  const ensureOrphanL1 = (host: string): L1Acc => {
    let h = host.trim() || '（未标注宿主平台）';
    if (isPlaceholderTechHost(h)) {
      h = defaultTask9HostForT10(moduleFeatures) || '（未标注宿主平台）';
    }
    const style = platformStyle(h);
    let pAcc = platformMap.get(style.key);
    if (!pAcc) {
      pAcc = { style, l1Map: new Map() };
      platformMap.set(style.key, pAcc);
    }
    const orphanFid = `${ORPHAN_L1_PREFIX}${style.key}`;
    let l1 = pAcc.l1Map.get(orphanFid);
    if (!l1) {
      const synthetic: Task2L1TaskGraphFeatureRow = {
        featureId: orphanFid,
        name: '（按宿主平台归集）',
        tokenDisplay: '系统一级模块',
      };
      l1 = { feature: synthetic, host: h, l2Map: new Map() };
      pAcc.l1Map.set(orphanFid, l1);
    }
    return l1;
  };

  const ensureL1ForT10 = (feat: Task2L1TaskGraphFeatureRow): L1Acc => {
    const mod = resolveModuleForT10Feature(feat, t10ToModule, moduleFeatures);
    if (mod) return ensureL1(mod);
    let host = readTechHostFromT10Feature(feat);
    if (!host || isPlaceholderTechHost(host)) {
      host = defaultTask9HostForT10(moduleFeatures);
    }
    return ensureOrphanL1(host);
  };

  for (const schema of schemaFeatures) {
    const schemaFid = String(schema.featureId ?? '').trim();
    const parsed = readFeatureValuePayload(schema);
    const tableName = extractTableNameFromFeature(schema);
    const l1 = ensureL1ForT10(schema);

    l1.l2Map.set(schemaFid, {
      featureId: schemaFid,
      name: tableName || '（未命名表）',
      tableCategory: extractTableCategory(parsed),
      parentTableRef: readParentTableRefFromSchema(parsed),
      fields: parseSchemaFieldCards(schema),
      permissionDesigns: [],
      initDesigns: [],
      designLogic: buildDesignLogicFromFeature(
        schema,
        `物理表 Schema「${tableName || '（未命名表）'}」由任务 10 编译，字段命名锚定任务 1 客户习惯化石。`,
      ),
    });
  }

  for (const feat of allT10Features) {
    const tok = resolveTask10FeatureTokenKey(feat);
    if (isSchemaTokenKey(tok) || isSyncTokenKey(tok)) continue;
    const featFid = String(feat.featureId ?? '').trim();
    const l1 = ensureL1ForT10(feat);
    const tableName = extractTableNameFromFeature(feat);
    const l2 =
      findL2ByTableName(l1, tableName) ??
      (l1.l2Map.size === 1 ? [...l1.l2Map.values()][0] : undefined);
    if (!l2) continue;
    const leaf = toJsonLeaf(feat, tableName);
    if (tok === PERMISSION_TOKEN_KEY) {
      l2.permissionDesigns.push(leaf);
      l2.designLogic = mergeDataArchDesignLogic([
        l2.designLogic,
        buildDesignLogicFromFeature(feat, '权限字典初始化行的推理依据。'),
      ]);
    } else if (tok === INIT_TOKEN_KEY) {
      l2.initDesigns.push(leaf);
      l2.designLogic = mergeDataArchDesignLogic([
        l2.designLogic,
        buildDesignLogicFromFeature(feat, '基础表初始化（RBAC）行的推理依据。'),
      ]);
    }
  }

  const platformOrder = ['wecom', 'qiqiao'];
  const platforms: DataArchPlatformBlock[] = [...platformMap.entries()]
    .sort((a, b) => {
      const ia = platformOrder.indexOf(a[0]);
      const ib = platformOrder.indexOf(b[0]);
      const ra = ia >= 0 ? ia : 99;
      const rb = ib >= 0 ? ib : 99;
      if (ra !== rb) return ra - rb;
      return a[1].style.label.localeCompare(b[1].style.label, 'zh-CN');
    })
    .map(([, acc]) => {
      const platformLabel = acc.style.label;
      const level1Modules = [...acc.l1Map.values()]
        .map((l1) => {
          const modFid = String(l1.feature.featureId ?? '');
          const l1Name = modFid.startsWith(ORPHAN_L1_PREFIX)
            ? orphanL1DisplayName(l1.host, moduleFeatures)
            : readModuleName(l1.feature);
          return {
            featureId: modFid,
            name: l1Name,
            techHostPlatform: l1.host,
            designLogic: buildDesignLogicFromFeature(
              l1.feature,
              `一级模块「${l1Name}」对应任务 9 系统大伞，下辖本宿主平台物理表与初始化设计。`,
            ),
            level2Modules: [...l1.l2Map.values()]
              .filter(
                (l2) =>
                  !!l2.name ||
                  l2.fields.length > 0 ||
                  l2.permissionDesigns.length > 0 ||
                  l2.initDesigns.length > 0,
              )
              .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
          };
        })
        .filter((l1) => l1.level2Modules.length > 0);
      const designLogic = mergeDataArchDesignLogic([
        buildDesignLogicFromText(
          `工具平台「${platformLabel}」承载任务 9 系统一级模块与任务 10 物理表/初始化设计，按模块与表 Schema 分层可读展示。`,
        ),
        ...level1Modules.map((l1) => l1.designLogic),
      ]);
      return {
        platformKey: acc.style.key,
        platformLabel,
        designLogic,
        level1Modules,
      };
    })
    .filter((p) => p.level1Modules.length > 0);

  if (!platforms.length && schemaFeatures.length > 0 && !crossPlatformIntegration) {
    return {
      platforms: [],
      crossPlatformIntegration: null,
      emptyMessage:
        '已检测到任务 10 物理表 Schema，但未能解析字段集合（请重跑任务 10；task-graph 须含 featureValue 内嵌 JSON 的 columns 或「字段集合」）。',
    };
  }

  return { platforms, crossPlatformIntegration };
}
