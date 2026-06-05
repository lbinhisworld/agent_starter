/**
 * [INPUT]: 多条需求提炼 JSON 片段（与 `CUSTOMER_REQUIREMENT_CANVAS_FIELDS` 字段对齐）；可选 **异步字符串合并器**（设计详情「合并需求」大模型总结 + `ProblemCaseLlmLog`）
 * [OUTPUT]: 业务背景 / 核心业务对象 等维度的合并（默认规则拼接 `【并入】`；传入 `mergeStrings` 时对双非空字符串走 LLM 去重保留差异）
 * [POS]: 设计详情页；由 `useDesignDetailChat` 在每批需求提炼（管理资源分域同步）后 **`runIncrementalMergeTotalRequirementAfterDistill`** 调用 `mergeRequirementTabSliceAsync`
 *
 * [PROTOCOL]: 字段语义与 `designDetailRequirementPrelimCanvasHtml.ts` / `coreEntitiesRequirementCanvas.ts` 对齐；token 路径与 `designDetailRequirementMergeTokenPaths.ts`、后端 `design-detail-customer-req-section-graph.ts` 对齐；`businessContext.businessStatus` 已废弃，上移至顶层 `corePainPointSummary`；变更时同步本 Header 与 `design-detail/AGENTS.md`
 */

const PRELIMINARY_CBE_CONCEPT_CATEGORIES = ['人', '财', '物', '事'] as const;
type ConceptCategory = (typeof PRELIMINARY_CBE_CONCEPT_CATEGORIES)[number];

/** 与 `useDesignDetailChat` / 画布子 Tab 顺序一致，用于合并进度（N/总数） */
export const REQUIREMENT_MERGE_TAB_KEYS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'businessContext', label: '业务背景' },
  { key: 'coreBusinessEntities', label: '核心业务对象' },
  { key: 'stateTransitionMatrix', label: '状态转移矩阵' },
  { key: 'painPointRadar', label: '痛点雷达' },
  { key: 'itLandscape', label: 'IT 现状与集成' },
  { key: 'existingSpreadsheets', label: '现有表格' },
  { key: 'operationModel', label: '运营模式' },
  { key: 'managementResources', label: '管理资源' },
  { key: 'roadmap', label: '路线图' },
];

export const REQUIREMENT_MERGE_TAB_COUNT = REQUIREMENT_MERGE_TAB_KEYS.length;

/** 单次字符串合并的上下文（供审计 `合并#token` 解析路径） */
export type RequirementMergeStringContext = {
  tabKey: string;
  /** JSON 路径：含顶层 tabKey，便于 `tokenSurfaceForMergePath` */
  path: string[];
};

/**
 * 异步合并两段文本；未注入时由内部回退为 `summarizeMergeTwoStrings`。
 * 实现侧应包一层 `withDesignDetailLlmLogContext`：`taskId`=`designLinePillLabel('customer_basic')`（与经营/需求/BMC 子环节一致）；`callTarget`=`需求#${batch}合并#${tokenSurface}`（`batch` 为本轮所涉最大 `task1RequirementDistillOrdinal`）。
 */
export type RequirementMergeStringMerger = (a: string, b: string, ctx: RequirementMergeStringContext) => Promise<string>;

function safeJsonStringify(x: unknown): string {
  try {
    return JSON.stringify(x ?? null, null, 2);
  } catch {
    return String(x);
  }
}

/** 两段非空文本总结合并（无 LLM，规则拼接） */
export function summarizeMergeTwoStrings(a: string, b: string): string {
  const A = String(a ?? '').trim();
  const B = String(b ?? '').trim();
  if (!A) return B;
  if (!B) return A;
  if (A === B) return A;
  return `${A}\n\n【并入】\n\n${B}`;
}

async function applyMergeStrings(
  merger: RequirementMergeStringMerger | undefined,
  a: string,
  b: string,
  tabKey: string,
  path: string[],
): Promise<string> {
  if (!merger) return summarizeMergeTwoStrings(a, b);
  return merger(a, b, { tabKey, path });
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === 'object' && !Array.isArray(x);
}

async function mergeOrgTopologyObjectsAsync(
  base: Record<string, unknown> | null | undefined,
  add: Record<string, unknown> | null | undefined,
  merger: RequirementMergeStringMerger | undefined,
  pathPrefix: string[],
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = isPlainObject(base) ? { ...base } : {};
  if (!isPlainObject(add)) return out;
  for (const [key, vAdd] of Object.entries(add)) {
    const path = [...pathPrefix, key];
    if (!(key in out)) {
      out[key] = vAdd;
      continue;
    }
    const vBase = out[key];
    if (typeof vBase === 'string' && typeof vAdd === 'string') {
      out[key] = await applyMergeStrings(merger, vBase, vAdd, 'businessContext', path);
    } else if (isPlainObject(vBase) && isPlainObject(vAdd)) {
      out[key] = await mergeOrgTopologyObjectsAsync(vBase, vAdd, merger, path);
    } else if (Array.isArray(vBase) && Array.isArray(vAdd)) {
      out[key] = [...vBase, ...vAdd];
    } else {
      out[key] = await applyMergeStrings(
        merger,
        safeJsonStringify(vBase),
        safeJsonStringify(vAdd),
        'businessContext',
        path,
      );
    }
  }
  return out;
}

/** 从提炼 JSON 解析「核心痛点总结」；只读兼容旧版 `businessContext.businessStatus`（落库前会剥离） */
export function resolveCorePainPointSummaryFromParsed(
  parsed: Record<string, unknown> | null | undefined,
): string {
  if (!parsed) return '';
  const direct = String(parsed.corePainPointSummary ?? '').trim();
  if (direct) return direct;
  const bc = parsed.businessContext;
  if (bc && typeof bc === 'object' && !Array.isArray(bc)) {
    return String((bc as Record<string, unknown>).businessStatus ?? '').trim();
  }
  return '';
}

/** 核心痛点总结：与痛点雷达分域 token 对齐的字符串合并 */
export async function mergeCorePainPointSummaryFieldAsync(
  baseParsed: Record<string, unknown>,
  addParsed: Record<string, unknown>,
  merger?: RequirementMergeStringMerger,
): Promise<string> {
  const vb = resolveCorePainPointSummaryFromParsed(baseParsed);
  const va = resolveCorePainPointSummaryFromParsed(addParsed);
  if (!va) return vb;
  if (!vb) return va;
  return applyMergeStrings(merger, vb, va, 'painPointRadar', ['corePainPointSummary']);
}

/** 业务背景：行业与商业模式、组织拓扑等按产品规则合并（已下线 `digitalMaturity`） */
export function stripDeprecatedBusinessContextFields(
  bc: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!bc || typeof bc !== 'object' || Array.isArray(bc)) return {};
  const out = { ...bc };
  delete out.digitalMaturity;
  delete out.businessStatus;
  return out;
}

/** 将 `businessContext.businessStatus` 上移至顶层 `corePainPointSummary`（若顶层尚无） */
export function hoistLegacyBusinessStatusToCorePainPointSummary(
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...parsed };
  if (String(out.corePainPointSummary ?? '').trim()) return out;
  const bc = out.businessContext;
  if (!bc || typeof bc !== 'object' || Array.isArray(bc)) return out;
  const legacy = String((bc as Record<string, unknown>).businessStatus ?? '').trim();
  if (legacy) out.corePainPointSummary = legacy;
  return out;
}

/** 从需求提炼根对象剔除已下线字段，供落库与画布展示 */
export function sanitizeRequirementParsedDeprecatedFields(
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  const out = hoistLegacyBusinessStatusToCorePainPointSummary(parsed);
  if (out.businessContext != null) {
    out.businessContext = stripDeprecatedBusinessContextFields(
      out.businessContext as Record<string, unknown>,
    );
  }
  return out;
}

export async function mergeBusinessContextFieldAsync(
  base: unknown,
  add: unknown,
  merger?: RequirementMergeStringMerger,
): Promise<Record<string, unknown>> {
  const B = stripDeprecatedBusinessContextFields(
    isPlainObject(base) ? (base as Record<string, unknown>) : {},
  );
  if (!isPlainObject(add)) return B;
  const A = stripDeprecatedBusinessContextFields(add as Record<string, unknown>);
  const out: Record<string, unknown> = { ...B };

  if ('industryDomain' in A) {
    out.industryDomain = await applyMergeStrings(
      merger,
      String(out.industryDomain ?? ''),
      String(A.industryDomain ?? ''),
      'businessContext',
      ['businessContext', 'industryDomain'],
    );
  }
  if ('orgTopology' in A) {
    out.orgTopology = await mergeOrgTopologyObjectsAsync(
      isPlainObject(out.orgTopology) ? (out.orgTopology as Record<string, unknown>) : {},
      isPlainObject(A.orgTopology) ? (A.orgTopology as Record<string, unknown>) : {},
      merger,
      ['businessContext', 'orgTopology'],
    );
  }
  // 旧版「现状与核心矛盾」已迁至顶层 corePainPointSummary，合并时不再写入 businessContext
  if ('businessStatus' in out) {
    delete out.businessStatus;
  }
  if ('clientName' in A) {
    const oc = String(out.clientName ?? '').trim();
    const nc = String(A.clientName ?? '').trim();
    if (nc) {
      out.clientName =
        oc && oc !== nc
          ? await applyMergeStrings(merger, oc, nc, 'businessContext', ['businessContext', 'clientName'])
          : nc;
    }
  }
  for (const key of Object.keys(A)) {
    if (['industryDomain', 'orgTopology', 'clientName', 'businessStatus', 'digitalMaturity'].includes(key)) continue;
    if (!(key in out)) {
      out[key] = A[key];
      continue;
    }
    const vb = out[key];
    const va = A[key];
    if (typeof vb === 'string' && typeof va === 'string') {
      out[key] = await applyMergeStrings(merger, vb, va, 'businessContext', ['businessContext', key]);
    } else if (isPlainObject(vb) && isPlainObject(va)) {
      out[key] = await mergeBusinessContextFieldAsync(vb, va, merger);
    } else if (Array.isArray(vb) && Array.isArray(va)) {
      out[key] = [...vb, ...va];
    }
  }
  return out;
}

function normalizeCoreEntityConceptCategory(raw: unknown): ConceptCategory {
  const s = String(raw ?? '').trim();
  if ((PRELIMINARY_CBE_CONCEPT_CATEGORIES as readonly string[]).includes(s)) return s as ConceptCategory;
  return '事';
}

function getCoreEntityConceptCategoryRaw(item: Record<string, unknown>): string {
  const v = item.conceptCategory ?? item['概念类别'];
  return v != null ? String(v).trim() : '';
}

function getEntityName(item: Record<string, unknown>): string {
  const v = item.entityName ?? item['实体名称'] ?? item['名称'];
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}

function parseLifecycleStates(item: Record<string, unknown>): string[] {
  const statesRaw = item.lifecycleStates ?? item['生命周期'];
  if (Array.isArray(statesRaw)) {
    return statesRaw.map((x) => String(x != null ? x : '').trim()).filter(Boolean);
  }
  if (statesRaw != null && String(statesRaw).trim() !== '') {
    return [String(statesRaw).trim()];
  }
  return [];
}

function getConceptExpl(item: Record<string, unknown>): string {
  const v = item.conceptExplanation ?? item['概念解释'];
  return v != null ? String(v).trim() : '';
}

function getOwnership(item: Record<string, unknown>): string {
  const v = item.ownershipLogic ?? item['归属逻辑'];
  return v != null ? String(v).trim() : '';
}

/** 核心业务对象：按类目 + 对象名称合并概念解释 / 生命周期 / 归属逻辑；异名追加 */
export async function mergeCoreBusinessEntitiesArraysAsync(
  base: unknown,
  add: unknown,
  merger?: RequirementMergeStringMerger,
): Promise<unknown[]> {
  let anon = 0;
  const byCat = new Map<ConceptCategory, Map<string, Record<string, unknown>>>();
  const orderKeys = new Map<ConceptCategory, string[]>();

  function mapFor(cat: ConceptCategory): Map<string, Record<string, unknown>> {
    let m = byCat.get(cat);
    if (!m) {
      m = new Map();
      byCat.set(cat, m);
      orderKeys.set(cat, []);
    }
    return m;
  }

  function keysFor(cat: ConceptCategory): string[] {
    if (!orderKeys.has(cat)) orderKeys.set(cat, []);
    return orderKeys.get(cat)!;
  }

  async function ingestItem(item: unknown) {
    if (!isPlainObject(item)) return;
    const o = { ...item } as Record<string, unknown>;
    const cat = normalizeCoreEntityConceptCategory(getCoreEntityConceptCategoryRaw(o));
    const name = getEntityName(o);
    const key = name || `__anon_${(anon += 1)}`;
    const m = mapFor(cat);
    const ord = keysFor(cat);
    const entPath = ['coreBusinessEntities', cat, name || key];
    if (!m.has(key)) {
      m.set(key, o);
      ord.push(key);
      return;
    }
    const ex = m.get(key)!;
    ex.conceptExplanation = await applyMergeStrings(
      merger,
      getConceptExpl(ex),
      getConceptExpl(o),
      'coreBusinessEntities',
      [...entPath, 'conceptExplanation'],
    );
    const st = [...parseLifecycleStates(ex), ...parseLifecycleStates(o)];
    const uniq: string[] = [];
    for (const s of st) {
      if (s && !uniq.includes(s)) uniq.push(s);
    }
    ex.lifecycleStates = uniq;
    ex.ownershipLogic = await applyMergeStrings(merger, getOwnership(ex), getOwnership(o), 'coreBusinessEntities', [
      ...entPath,
      'ownershipLogic',
    ]);
  }

  for (const it of Array.isArray(base) ? base : []) await ingestItem(it);
  for (const it of Array.isArray(add) ? add : []) await ingestItem(it);

  const out: unknown[] = [];
  for (const cat of PRELIMINARY_CBE_CONCEPT_CATEGORIES) {
    const m = byCat.get(cat);
    const ord = orderKeys.get(cat);
    if (!m || !ord) continue;
    for (const k of ord) {
      const rec = m.get(k);
      if (rec) out.push(rec);
    }
  }
  return out;
}

function mergeArraysConcat(base: unknown, add: unknown): unknown {
  const a = Array.isArray(base) ? base : [];
  const b = Array.isArray(add) ? add : [];
  return [...a, ...b];
}

/**
 * 单个子 Tab **异步**合并入口。
 * @param path 可选；缺省时按 `[tabKey]` 参与 token 解析
 */
export async function mergeRequirementTabSliceAsync(
  tabKey: string,
  baseVal: unknown,
  addVal: unknown,
  merger?: RequirementMergeStringMerger,
  path: string[] = [tabKey],
): Promise<unknown> {
  if (addVal === undefined || addVal === null) return baseVal;
  if (baseVal === undefined || baseVal === null) {
    if (isPlainObject(addVal)) return { ...(addVal as Record<string, unknown>) };
    if (Array.isArray(addVal)) return [...addVal];
    return addVal;
  }
  if (tabKey === 'businessContext') {
    return mergeBusinessContextFieldAsync(baseVal, addVal, merger);
  }
  if (tabKey === 'coreBusinessEntities') {
    return mergeCoreBusinessEntitiesArraysAsync(baseVal, addVal, merger);
  }
  if (
    tabKey === 'stateTransitionMatrix' ||
    tabKey === 'painPointRadar' ||
    tabKey === 'itLandscape' ||
    tabKey === 'existingSpreadsheets' ||
    tabKey === 'operationModel' ||
    tabKey === 'managementResources' ||
    tabKey === 'roadmap'
  ) {
    if (Array.isArray(baseVal) || Array.isArray(addVal)) {
      return mergeArraysConcat(baseVal, addVal);
    }
    if (isPlainObject(baseVal) && isPlainObject(addVal)) {
      const o: Record<string, unknown> = { ...(baseVal as Record<string, unknown>) };
      for (const [k, v] of Object.entries(addVal as Record<string, unknown>)) {
        const nextPath = [...path, k];
        if (!(k in o)) {
          o[k] = v;
          continue;
        }
        const vb = o[k];
        if (typeof vb === 'string' && typeof v === 'string') {
          o[k] = await applyMergeStrings(merger, vb, v, tabKey, nextPath);
        } else if (Array.isArray(vb) && Array.isArray(v)) {
          o[k] = [...vb, ...v];
        } else if (isPlainObject(vb) && isPlainObject(v)) {
          o[k] = await mergeRequirementTabSliceAsync(tabKey, vb, v, merger, nextPath);
        } else {
          o[k] = v;
        }
      }
      return o;
    }
  }
  if (typeof baseVal === 'string' && typeof addVal === 'string') {
    return applyMergeStrings(merger, baseVal, addVal, tabKey, path);
  }
  return addVal;
}

export function deepCloneParsed(parsed: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;
  } catch {
    return { ...parsed };
  }
}

/** 供 `RequirementMergeStringMerger` 实现侧组装 `callTarget` 的 token 段：`需求#${batch}合并#${tokenSurface}`（`tokenSurface` 与 `DesignDetailTaskToken` 展平口径一致） */
export { tokenSurfaceForMergePath } from './designDetailRequirementMergeTokenPaths';
