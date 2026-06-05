/**
 * [INPUT]: 任务 10 task-graph `features[]`（Schema 行 + 物理表字段裂变行）
 * [OUTPUT]: 任务进展卡「推理结论」结构化文案（表头 + 字段树形缩进）
 * [POS]: `designDetailFeatureInferenceConclusionProgress.ts` 在任务 10 落库后推送结论时专用
 *
 * [PROTOCOL]: 变更展示口径时同步 `designDetailFeatureInferenceConclusionProgress.ts` 与本目录 `AGENTS.md`
 */

import type { DesignDetailLogicGraphFeatureDto } from './designDetailLogicGraphMerge';
import { extractLogicTreeTask10TableName } from './designDetailLogicTreeLayout';

export type Task10ConclusionLine = {
  text: string;
  /** 与 graph `featureId` 对齐，供增量推送与 hydrate 去重 */
  inferenceFeatureId: string;
};

export type Task10ConclusionUnit = {
  /** 主锚点：物理表 Schema 特征 id */
  anchorFeatureId: string;
  /** 本表块涉及的全部 featureId（含字段裂变行） */
  coveredFeatureIds: string[];
  lines: Task10ConclusionLine[];
};

const SCHEMA_TOKEN_KEYS = new Set([
  '物理表结构Schema',
  '物理技术Schema',
  '物理表结构 Schema',
  '物理表结构schema',
]);

const FIELD_TOKEN_KEY = '物理表字段';

const SYNC_TOKEN_KEYS = new Set([
  '跨平台接口同步Schema',
  '跨平台接口同步 Schema',
  '跨平台接口同步schema',
]);

function tokenKeyOne(tokenDisplay: string): string {
  const td = String(tokenDisplay ?? '').trim();
  return td.includes('·') ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : td;
}

function resolveFeatureTokenKey(f: DesignDetailLogicGraphFeatureDto): string {
  const raw = String(
    f.tokenDisplay ??
      f.token_display ??
      (f as { featureKey?: string }).featureKey ??
      (f as { token?: string }).token ??
      f.operator ??
      '',
  ).trim();
  return tokenKeyOne(raw);
}

function isSchemaTokenKey(tok: string): boolean {
  if (SCHEMA_TOKEN_KEYS.has(tok)) return true;
  const norm = tok.replace(/\s+/g, '').toLowerCase();
  return norm === '物理表结构schema' || norm === '物理技术schema';
}

function isSyncTokenKey(tok: string): boolean {
  if (SYNC_TOKEN_KEYS.has(tok)) return true;
  return tok.replace(/\s+/g, '').toLowerCase() === '跨平台接口同步schema';
}

function readFeatureValueRaw(f: DesignDetailLogicGraphFeatureDto): unknown {
  return (
    (f as { featureValue?: unknown }).featureValue ??
    (f as { feature_value?: unknown }).feature_value ??
    null
  );
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

function unwrapFeatureValueRoot(parsed: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!parsed) return null;
  const inner = parsed.Feature_Value ?? parsed.feature_value;
  if (typeof inner === 'string') {
    const s = inner.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        const nested = JSON.parse(s) as unknown;
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          return nested as Record<string, unknown>;
        }
      } catch {
        /* 截断 JSON：保留外层 */
      }
    }
  }
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  if (parsed.table_metadata != null || parsed.columns != null) return parsed;
  return parsed;
}

function readSchemaPayload(f: DesignDetailLogicGraphFeatureDto): Record<string, unknown> | null {
  for (const src of [readFeatureValueRaw(f), f.name]) {
    const parsed = unwrapFeatureValueRoot(parseFeatureValueObject(src));
    if (!parsed) continue;
    if (parsed.table_metadata != null || Array.isArray(parsed.columns)) return parsed;
    const tn = extractLogicTreeTask10TableName(parsed);
    if (tn) return parsed;
  }
  return null;
}

function readFieldPayload(f: DesignDetailLogicGraphFeatureDto): Record<string, unknown> | null {
  for (const src of [readFeatureValueRaw(f), f.name]) {
    const parsed = unwrapFeatureValueRoot(parseFeatureValueObject(src));
    if (!parsed) continue;
    const fn = String(parsed.field_name ?? parsed['字段名称'] ?? '').trim();
    if (fn) return parsed;
  }
  return null;
}

type ColumnRow = {
  fieldName: string;
  dataType: string;
  constraints: string;
};

function readColumnsFromSchemaPayload(parsed: Record<string, unknown>): ColumnRow[] {
  const raw = parsed.columns ?? parsed['字段集合'] ?? parsed['字段信息'];
  if (!Array.isArray(raw)) return [];
  const out: ColumnRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const fieldName = String(o.field_name ?? o['字段名称'] ?? o['字段名'] ?? o.name ?? '').trim();
    if (!fieldName) continue;
    out.push({
      fieldName,
      dataType: String(o.data_type ?? o['数据类型'] ?? '').trim(),
      constraints: String(o.constraints ?? o['主键约束'] ?? o['约束'] ?? '').trim(),
    });
  }
  return out;
}

function readParentTableRef(parsed: Record<string, unknown> | null): string {
  if (!parsed) return '';
  const meta = parsed.table_metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const ref = String((meta as Record<string, unknown>).parent_table_ref ?? '').trim();
    if (ref && ref !== 'N/A') return ref;
  }
  return '';
}

function isForeignKeyConstraints(constraints: string): boolean {
  const c = String(constraints ?? '').trim();
  if (!c) return false;
  if (c.includes('外键')) return true;
  return /foreign\s*key/i.test(c);
}

function parseScenarioFkRefFromConstraints(constraints: string): {
  table?: string;
  field?: string;
} {
  const m = /关联至\[([^\]]+)\]的\[([^\]]+)\]字段/u.exec(String(constraints ?? ''));
  if (!m) return {};
  return { table: m[1]?.trim(), field: m[2]?.trim() };
}

function parseFkReferencedTableFromConstraints(constraints: string): string {
  const scenario = parseScenarioFkRefFromConstraints(constraints);
  if (scenario.table) return scenario.table;
  const c = String(constraints ?? '');
  const m = /references\s+([a-zA-Z0-9_\u4e00-\u9fff]+)/i.exec(c);
  return m?.[1]?.trim() ?? '';
}

function formatFieldLine(
  fieldName: string,
  dataType: string,
  constraints: string,
  parentTableRef: string,
): string {
  const fn = fieldName.trim();
  const dt = dataType.trim();
  if (dt === '外键' || isForeignKeyConstraints(constraints)) {
    const scenario = parseScenarioFkRefFromConstraints(constraints);
    const refTable =
      scenario.table ||
      parseFkReferencedTableFromConstraints(constraints) ||
      String(parentTableRef ?? '').trim();
    if (refTable && refTable !== 'N/A') {
      return `｜→ 引入字段【${fn}】，类型【外键】，关联数据表【${refTable}】`;
    }
    return `｜→ 引入字段【${fn}】，类型【外键】`;
  }
  if (dt === '主键') {
    return `｜→ 引入字段【${fn}】，类型【主键】`;
  }
  const typeLabel = dt || constraints.trim() || '—';
  return `｜→ 引入字段【${fn}】，类型【${typeLabel}】`;
}

function columnRowsFromFieldFeature(f: DesignDetailLogicGraphFeatureDto): ColumnRow | null {
  const payload = readFieldPayload(f);
  if (!payload) return null;
  const fieldName = String(payload.field_name ?? payload['字段名称'] ?? '').trim();
  if (!fieldName) return null;
  return {
    fieldName,
    dataType: String(payload.data_type ?? payload['数据类型'] ?? '').trim(),
    constraints: String(payload.constraints ?? payload['主键约束'] ?? '').trim(),
  };
}

function readFieldParentTableFeatureId(f: DesignDetailLogicGraphFeatureDto): string {
  const payload = readFieldPayload(f);
  return String(payload?.parent_table_feature_id ?? '').trim();
}

function readFieldParentTableName(f: DesignDetailLogicGraphFeatureDto): string {
  const payload = readFieldPayload(f);
  return String(payload?.parent_table_name ?? '').trim();
}

function readInterfaceName(f: DesignDetailLogicGraphFeatureDto): string {
  for (const src of [readFeatureValueRaw(f), f.name]) {
    const parsed = unwrapFeatureValueRoot(parseFeatureValueObject(src));
    if (!parsed) continue;
    const v = String(parsed['接口名称'] ?? '').trim();
    if (v) return v;
  }
  return extractLogicTreeTask10TableName(f.name).trim();
}

/** 将任务 10 特征整理为「表设计 + 字段树」结论块 */
export function buildTask10InferenceConclusionUnits(
  features: ReadonlyArray<DesignDetailLogicGraphFeatureDto>,
): Task10ConclusionUnit[] {
  const schemaFeatures: DesignDetailLogicGraphFeatureDto[] = [];
  const fieldFeatures: DesignDetailLogicGraphFeatureDto[] = [];
  const miscFeatures: DesignDetailLogicGraphFeatureDto[] = [];

  for (const f of features) {
    const tok = resolveFeatureTokenKey(f);
    if (isSchemaTokenKey(tok)) schemaFeatures.push(f);
    else if (tok === FIELD_TOKEN_KEY) fieldFeatures.push(f);
    else miscFeatures.push(f);
  }

  const fieldsByTableFid = new Map<string, DesignDetailLogicGraphFeatureDto[]>();
  const fieldsByTableName = new Map<string, DesignDetailLogicGraphFeatureDto[]>();
  for (const ff of fieldFeatures) {
    const parentFid = readFieldParentTableFeatureId(ff);
    if (parentFid) {
      const list = fieldsByTableFid.get(parentFid) ?? [];
      list.push(ff);
      fieldsByTableFid.set(parentFid, list);
    }
    const parentName = readFieldParentTableName(ff);
    if (parentName) {
      const list = fieldsByTableName.get(parentName) ?? [];
      list.push(ff);
      fieldsByTableName.set(parentName, list);
    }
  }

  const units: Task10ConclusionUnit[] = [];
  const consumedFieldIds = new Set<string>();

  for (const sf of schemaFeatures) {
    const fid = String(sf.featureId ?? '').trim();
    if (!fid) continue;
    const payload = readSchemaPayload(sf);
    const tableName =
      (payload ? readTableNameFromPayload(payload) : '') ||
      extractLogicTreeTask10TableName(readFeatureValueRaw(sf)) ||
      extractLogicTreeTask10TableName(sf.name);
    if (!tableName) continue;

    const parentRef = readParentTableRef(payload);
    const lines: Task10ConclusionLine[] = [
      { text: `→ 引入数据表设计【${tableName}】`, inferenceFeatureId: fid },
    ];

    const schemaColumns = payload ? readColumnsFromSchemaPayload(payload) : [];
    const attachedFields = [
      ...(fieldsByTableFid.get(fid) ?? []),
      ...(fieldsByTableName.get(tableName) ?? []),
    ];
    const seenFieldNames = new Set<string>();

    if (schemaColumns.length > 0) {
      for (const col of schemaColumns) {
        seenFieldNames.add(col.fieldName);
        lines.push({
          text: formatFieldLine(col.fieldName, col.dataType, col.constraints, parentRef),
          inferenceFeatureId: fid,
        });
      }
    }

    for (const ff of attachedFields) {
      const ffid = String(ff.featureId ?? '').trim();
      if (ffid) consumedFieldIds.add(ffid);
      const col = columnRowsFromFieldFeature(ff);
      if (!col) continue;
      if (schemaColumns.length > 0 && seenFieldNames.has(col.fieldName)) continue;
      seenFieldNames.add(col.fieldName);
      lines.push({
        text: formatFieldLine(col.fieldName, col.dataType, col.constraints, parentRef),
        inferenceFeatureId: ffid || fid,
      });
    }

    const covered = new Set<string>([fid]);
    for (const ff of attachedFields) {
      const ffid = String(ff.featureId ?? '').trim();
      if (ffid) covered.add(ffid);
    }
    units.push({
      anchorFeatureId: fid,
      coveredFeatureIds: [...covered],
      lines,
    });
  }

  for (const ff of fieldFeatures) {
    const ffid = String(ff.featureId ?? '').trim();
    if (!ffid || consumedFieldIds.has(ffid)) continue;
    const col = columnRowsFromFieldFeature(ff);
    if (!col) continue;
    const tableName = readFieldParentTableName(ff) || '（未命名表）';
    units.push({
      anchorFeatureId: ffid,
      coveredFeatureIds: [ffid],
      lines: [
        { text: `→ 引入数据表设计【${tableName}】`, inferenceFeatureId: ffid },
        {
          text: formatFieldLine(col.fieldName, col.dataType, col.constraints, tableName),
          inferenceFeatureId: ffid,
        },
      ],
    });
  }

  for (const mf of miscFeatures) {
    const fid = String(mf.featureId ?? '').trim();
    if (!fid) continue;
    const tok = resolveFeatureTokenKey(mf);
    if (isSyncTokenKey(tok)) {
      const iface = readInterfaceName(mf);
      if (!iface) continue;
      units.push({
        anchorFeatureId: fid,
        coveredFeatureIds: [fid],
        lines: [{ text: `→ 引入跨平台接口设计【${iface}】`, inferenceFeatureId: fid }],
      });
      continue;
    }
    const label =
      extractLogicTreeTask10TableName(readFeatureValueRaw(mf)) ||
      extractLogicTreeTask10TableName(mf.name) ||
      String(mf.name ?? '').trim();
    if (!label || label.startsWith('{')) continue;
    units.push({
      anchorFeatureId: fid,
      coveredFeatureIds: [fid],
      lines: [{ text: `→ 引入数据表设计【${label}】`, inferenceFeatureId: fid }],
    });
  }

  return units;
}

function readTableNameFromPayload(parsed: Record<string, unknown>): string {
  const meta = parsed.table_metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const tn = String((meta as Record<string, unknown>).table_name ?? '').trim();
    if (tn) return tn;
  }
  return extractLogicTreeTask10TableName(parsed);
}

/** 任务 10：从动态卡行收集已推送的 anchorFeatureId */
export function collectPushedTask10ConclusionAnchorIds(
  lines: ReadonlyArray<{ kind: string; inferenceFeatureId?: string }>,
  units: ReadonlyArray<Task10ConclusionUnit>,
): Set<string> {
  const ids = new Set<string>();
  for (const l of lines) {
    const fid = String(l.inferenceFeatureId ?? '').trim();
    if (fid && fid !== '—') ids.add(fid);
  }
  if (ids.size > 0) {
    const pushedAnchors = new Set<string>();
    for (const u of units) {
      if (ids.has(u.anchorFeatureId)) pushedAnchors.add(u.anchorFeatureId);
      else if (u.coveredFeatureIds.some((id) => ids.has(id))) pushedAnchors.add(u.anchorFeatureId);
    }
    return pushedAnchors;
  }
  return ids;
}

export function listRemainingTask10ConclusionUnits(
  lines: ReadonlyArray<{ kind: string; inferenceFeatureId?: string }>,
  units: ReadonlyArray<Task10ConclusionUnit>,
): Task10ConclusionUnit[] {
  if (!units.length) return [];
  const pushed = collectPushedTask10ConclusionAnchorIds(lines, units);
  return units.filter((u) => !pushed.has(u.anchorFeatureId));
}
