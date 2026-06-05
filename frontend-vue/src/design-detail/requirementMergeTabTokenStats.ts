/**
 * [INPUT]: 各 Tab 下需求提炼 JSON 片段（与 `mergeRequirementTabSliceAsync` / 后端 `buildCustomerReqSectionGraphPlan` 口径对齐）
 * [OUTPUT]: 统计「被合并」相对「合并需求（当前总集）」的新增 token 数、更新 token 数（集合交并，与 `tokenSurfaceForMergePath` 主路径一致）
 * [POS]: `useDesignDetailChat.runIncrementalMergeTotalRequirementAfterDistill` 进度文案
 *
 * [PROTOCOL]: token 展平规则须与 `design-detail-customer-req-section-graph.ts`、`designDetailRequirementMergeTokenPaths.ts` 保持可比对；变更任一侧时复查本文件 collectors
 */

import { tokenSurfaceForMergePath, sanitizeTokenSecondSegment } from './designDetailRequirementMergeTokenPaths';

const PRELIMINARY_CBE_CONCEPT_CATEGORIES = ['人', '财', '物', '事'] as const;
type ConceptCategory = (typeof PRELIMINARY_CBE_CONCEPT_CATEGORIES)[number];

const STM_PREFIX = '状态转移矩阵';
const PPR_PREFIX = '痛点雷达';
const OPERATION_MODEL_PREFIX = '运营模式';
const EXISTING_SPREADSHEETS_PREFIX = '现有表格';

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === 'object' && !Array.isArray(x);
}

function hasSubstantiveContent(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 && t !== 'NOT_SPECIFIED';
  }
  if (Array.isArray(v)) return v.length > 0;
  if (isPlainObject(v)) return Object.keys(v).length > 0;
  return true;
}

function stripStateTransitionEntityDuplicateSuffix(raw: string): string {
  let s = String(raw ?? '').trim();
  for (let n = 0; n < 8; n += 1) {
    const next = s.replace(/[\s]*[(（][\s]*\p{Nd}+[\s]*[)）][\s]*$/u, '').trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

function normalizeStateTransitionEntityGroupKey(entity: string): string {
  const base = stripStateTransitionEntityDuplicateSuffix(entity);
  const compact = base.replace(/\s+/g, '');
  return compact.length > 0 ? compact : '__unnamed__';
}

/** 与后端 `pprDimensionShortForToken` 一致 */
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

function nonemptyTrimmedStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === 'string' && x.trim()) out.push(x.trim());
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

function collectBusinessContextTokens(v: unknown): Set<string> {
  const out = new Set<string>();
  if (!isPlainObject(v)) return out;
  const o = v as Record<string, unknown>;

  function walkValue(val: unknown, path: string[]) {
    if (!hasSubstantiveContent(val)) return;
    if (typeof val === 'string') {
      out.add(tokenSurfaceForMergePath('businessContext', path));
      return;
    }
    if (Array.isArray(val)) {
      out.add(tokenSurfaceForMergePath('businessContext', path));
      return;
    }
    if (isPlainObject(val)) {
      for (const [ck, cv] of Object.entries(val)) {
        walkValue(cv, [...path, ck]);
      }
    }
  }

  for (const [k, val] of Object.entries(o)) {
    if (!hasSubstantiveContent(val)) continue;
    if (k === 'orgTopology' && isPlainObject(val)) {
      for (const [sk, sv] of Object.entries(val)) {
        if (!hasSubstantiveContent(sv)) continue;
        out.add(tokenSurfaceForMergePath('businessContext', ['businessContext', 'orgTopology', sk]));
      }
      continue;
    }
    walkValue(val, ['businessContext', k]);
  }
  return out;
}

function collectCoreBusinessEntitiesTokens(v: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(v)) return out;
  let anon = 0;
  for (const item of v) {
    if (!isPlainObject(item)) continue;
    const o = item as Record<string, unknown>;
    const cat = normalizeCoreEntityConceptCategory(getCoreEntityConceptCategoryRaw(o));
    const name = getEntityName(o);
    const key = name || `__anon_${(anon += 1)}`;
    out.add(tokenSurfaceForMergePath('coreBusinessEntities', ['coreBusinessEntities', cat, key]));
  }
  return out;
}

function collectStateTransitionMatrixTokens(v: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(v) || v.length === 0) return out;
  const orderKeys: string[] = [];
  const buckets = new Map<string, Record<string, unknown>[]>();
  for (const item of v) {
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
      gk === '__unnamed__' ? '未命名实体' : stripStateTransitionEntityDuplicateSuffix(ent0) || gk;
    out.add(`${STM_PREFIX}/${sanitizeTokenSecondSegment(displayEntity)}`);
  }
  return out;
}

function collectPainPointRadarTokens(v: unknown): Set<string> {
  const out = new Set<string>();
  const usedSurfaces = new Set<string>();
  if (!Array.isArray(v) || v.length === 0) return out;
  for (let i = 0; i < v.length; i += 1) {
    const item = v[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const dimension = typeof row.dimension === 'string' ? row.dimension.trim() : '';
    const dimForToken = pprDimensionShortForToken(dimension);
    const baseLabel = dimForToken || `痛点${i + 1}`;
    const pathOnly = allocUniqueTokenSurface(PPR_PREFIX, baseLabel, usedSurfaces);
    out.add(pathOnly);
  }
  return out;
}

function collectItLandscapeTokens(v: unknown): Set<string> {
  const out = new Set<string>();
  if (!isPlainObject(v)) return out;
  const o = v as Record<string, unknown>;
  if (nonemptyTrimmedStringArray(o.legacySystems).length > 0) {
    out.add(tokenSurfaceForMergePath('itLandscape', ['itLandscape', 'legacySystems']));
  }
  if (nonemptyTrimmedStringArray(o.integrationRequirements).length > 0) {
    out.add(tokenSurfaceForMergePath('itLandscape', ['itLandscape', 'integrationRequirements']));
  }
  const dep = o.deploymentMode;
  if (typeof dep === 'string' && dep.trim()) {
    out.add(tokenSurfaceForMergePath('itLandscape', ['itLandscape', 'deploymentMode']));
  }
  return out;
}

/** 与后端 `extractOrgStakeholderRoleTitle` 一致 */
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

function collectExistingSpreadsheetsTokens(v: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(v) || v.length === 0) return out;
  const usedSurfaces = new Set<string>();
  for (let i = 0; i < v.length; i += 1) {
    const item = v[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const tableNameRaw = typeof row.tableName === 'string' ? row.tableName.trim() : '';
    const headers = nonemptyTrimmedStringArray(row.columnHeaders);
    if (headers.length === 0) continue;
    const tableName = tableNameRaw || `数据表${i + 1}`;
    out.add(allocUniqueTokenSurface(EXISTING_SPREADSHEETS_PREFIX, tableName, usedSurfaces));
  }
  return out;
}

function collectOperationModelTokens(v: unknown): Set<string> {
  const out = new Set<string>();
  if (!isPlainObject(v)) return out;
  const o = v as Record<string, unknown>;

  const personnelOrder: string[] = [];
  const personnelBuckets = new Map<string, string[]>();
  const org = o.orgAndRoles;
  if (org && typeof org === 'object' && !Array.isArray(org)) {
    const g = org as Record<string, unknown>;
    if (typeof g.governanceLogic === 'string' && g.governanceLogic.trim()) {
      out.add(
        tokenSurfaceForMergePath('operationModel', ['operationModel', 'orgAndRoles', 'governanceLogic']),
      );
    }
    if (typeof g.incentiveHooks === 'string' && g.incentiveHooks.trim()) {
      out.add(
        tokenSurfaceForMergePath('operationModel', ['operationModel', 'orgAndRoles', 'incentiveHooks']),
      );
    }
    const sh = g.stakeholders;
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
        personnelBuckets.get(nk)!.push(line);
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
    out.add(`${OPERATION_MODEL_PREFIX}/人员组织/${sanitizeTokenSecondSegment(roleTitle)}`);
  }
  for (const nk of processOrder) {
    const items = processBuckets.get(nk)!;
    const first = items[0]!;
    const pn0 = typeof first.processName === 'string' ? first.processName.trim() : '';
    const dm0 = typeof first.domain === 'string' ? first.domain.trim() : '';
    const procName = pn0 || dm0 || nk;
    out.add(`${OPERATION_MODEL_PREFIX}/业务流程/${sanitizeTokenSecondSegment(procName)}`);
  }

  return out;
}

function collectManagementResourcesTokens(v: unknown): Set<string> {
  const out = new Set<string>();
  if (!isPlainObject(v)) return out;
  const o = v as Record<string, unknown>;
  for (const key of ['peopleResource', 'financeResource', 'assetResource', 'informationAsset'] as const) {
    const raw = o[key];
    if (typeof raw !== 'string') continue;
    const text = raw.trim();
    if (!text || text === 'NOT_SPECIFIED') continue;
    out.add(tokenSurfaceForMergePath('managementResources', ['managementResources', key]));
  }
  return out;
}

function walkRoadmap(val: unknown, path: string[], out: Set<string>) {
  if (!hasSubstantiveContent(val)) return;
  if (typeof val === 'string') {
    out.add(tokenSurfaceForMergePath('roadmap', path));
    return;
  }
  if (Array.isArray(val)) {
    out.add(tokenSurfaceForMergePath('roadmap', path));
    return;
  }
  if (isPlainObject(val)) {
    for (const [k, cv] of Object.entries(val)) {
      walkRoadmap(cv, [...path, k], out);
    }
  }
}

function collectRoadmapTokens(v: unknown): Set<string> {
  const out = new Set<string>();
  if (!isPlainObject(v)) return out;
  walkRoadmap(v, ['roadmap'], out);
  return out;
}

/** 从单 Tab 切片收集与合并/图同步口径一致的 token 主路径集合 */
export function collectRequirementTabTokenSurfaces(tabKey: string, value: unknown): Set<string> {
  switch (tabKey) {
    case 'businessContext':
      return collectBusinessContextTokens(value);
    case 'coreBusinessEntities':
      return collectCoreBusinessEntitiesTokens(value);
    case 'stateTransitionMatrix':
      return collectStateTransitionMatrixTokens(value);
    case 'painPointRadar':
      return collectPainPointRadarTokens(value);
    case 'itLandscape':
      return collectItLandscapeTokens(value);
    case 'existingSpreadsheets':
      return collectExistingSpreadsheetsTokens(value);
    case 'operationModel':
      return collectOperationModelTokens(value);
    case 'managementResources':
      return collectManagementResourcesTokens(value);
    case 'roadmap':
      return collectRoadmapTokens(value);
    default:
      return new Set();
  }
}

/**
 * 新增：仅出现在被合并切片、不在当前合并总集；更新：两集交集（两边均有该 token，合并时走内容合并）。
 */
export function countRequirementTabMergeTokenDelta(
  tabKey: string,
  mergedTabSlice: unknown,
  incomingTabSlice: unknown,
): { newTokens: number; updatedTokens: number } {
  const base = collectRequirementTabTokenSurfaces(tabKey, mergedTabSlice);
  const add = collectRequirementTabTokenSurfaces(tabKey, incomingTabSlice);
  let updatedTokens = 0;
  for (const t of add) {
    if (base.has(t)) updatedTokens += 1;
  }
  const newTokens = add.size - updatedTokens;
  return { newTokens, updatedTokens };
}
