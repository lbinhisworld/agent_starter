/**
 * [INPUT]: `ErPlatformModel` 平台内表块 + 全局 `ErFkEdge[]`
 * [OUTPUT]: 按 FK 被引用次数升序分层（上层计数小、下层计数大），同计数表同层横排
 * [POS]: `DesignDetailErDiagramTab.vue` ER 图纵向分层布局
 *
 * [PROTOCOL]: FK 边 incoming 计数 + 子表 `parent_table_ref`；refCount=0 组内 incoming=0 且 outgoing=0 的表单独顶部分子层；变更时同步 ER Tab 与 AGENTS.md
 */

import {
  stripTablePrefix,
  type ErFkEdge,
  type ErPlatformModel,
  type ErTableBlockModel,
} from './buildErDiagramModelFromTaskGraph';

export type ErRefCountLayer = {
  refCount: number;
  tables: ErTableBlockModel[];
  /** 被引用 0 且自身无外键出边时，置于 refCount=0 组内的顶部分离子层 */
  isolatedZeroFk?: boolean;
};

/** 平台内全部物理表（主表 + 基础表 + 其它） */
export function collectErPlatformTables(platform: ErPlatformModel): ErTableBlockModel[] {
  return [...platform.mainTables, ...platform.baseTables, ...platform.otherTables];
}

function buildPillToTableMap(tables: ErTableBlockModel[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tb of tables) {
    for (const pill of tb.pills) {
      map.set(pill.stableId, tb.featureId);
    }
  }
  return map;
}

function findErTableByName(
  tables: ErTableBlockModel[],
  tableName: string,
): ErTableBlockModel | undefined {
  const norm = stripTablePrefix(tableName);
  if (!norm) return undefined;
  const direct = tables.find((t) => stripTablePrefix(t.tableName) === norm);
  if (direct) return direct;
  return tables.find((t) => {
    const tn = stripTablePrefix(t.tableName);
    return tn.includes(norm) || norm.includes(tn);
  });
}

/**
 * 子表 `parent_table_ref` → 主表：主从归属下子表视为被主表引用，incoming +1（与 FK 边计数叠加）。
 */
function applyParentTableRefIncomingCounts(
  tables: ErTableBlockModel[],
  incomingCount: Map<string, number>,
  platformTableIds: ReadonlySet<string>,
): void {
  for (const child of tables) {
    const parentName = stripTablePrefix(child.parentTableRef || '');
    if (!parentName) continue;
    const parent = findErTableByName(tables, parentName);
    if (!parent || parent.featureId === child.featureId) continue;
    if (!platformTableIds.has(parent.featureId)) continue;
    incomingCount.set(child.featureId, (incomingCount.get(child.featureId) ?? 0) + 1);
  }
}

/**
 * 统计平台内每张表被外键引用的次数（每条 FK 边计 1；自引用不计入被引用表）。
 */
export function countIncomingFkRefsByTable(
  tables: ErTableBlockModel[],
  edges: ErFkEdge[],
  platformTableIds: ReadonlySet<string>,
): Map<string, number> {
  const pillToTable = buildPillToTableMap(tables);
  const incomingCount = new Map<string, number>();
  for (const tb of tables) {
    incomingCount.set(tb.featureId, 0);
  }
  for (const edge of edges) {
    const srcTable = pillToTable.get(edge.fromStableId);
    const tgtTable = pillToTable.get(edge.toStableId);
    if (!srcTable || !tgtTable) continue;
    if (!platformTableIds.has(srcTable) || !platformTableIds.has(tgtTable)) continue;
    if (srcTable === tgtTable) continue;
    incomingCount.set(tgtTable, (incomingCount.get(tgtTable) ?? 0) + 1);
  }
  applyParentTableRefIncomingCounts(tables, incomingCount, platformTableIds);
  return incomingCount;
}

/**
 * 统计平台内每张表通过外键字段引用其他表的次数（每条 FK 边计 1；自引用不计入）。
 */
export function countOutgoingFkRefsByTable(
  tables: ErTableBlockModel[],
  edges: ErFkEdge[],
  platformTableIds: ReadonlySet<string>,
): Map<string, number> {
  const pillToTable = buildPillToTableMap(tables);
  const outgoingCount = new Map<string, number>();
  for (const tb of tables) {
    outgoingCount.set(tb.featureId, 0);
  }
  for (const edge of edges) {
    const srcTable = pillToTable.get(edge.fromStableId);
    const tgtTable = pillToTable.get(edge.toStableId);
    if (!srcTable || !tgtTable) continue;
    if (!platformTableIds.has(srcTable) || !platformTableIds.has(tgtTable)) continue;
    if (srcTable === tgtTable) continue;
    outgoingCount.set(srcTable, (outgoingCount.get(srcTable) ?? 0) + 1);
  }
  return outgoingCount;
}

function sortTablesByName(row: ErTableBlockModel[]): ErTableBlockModel[] {
  return [...row].sort((a, b) => a.tableName.localeCompare(b.tableName, 'zh-CN'));
}

/** 层标签：仅展示被引用次数 */
export function formatErRefLayerLabel(layer: ErRefCountLayer): string {
  return `被引用 ${layer.refCount} 次`;
}

/**
 * 按被引用次数分层：最小在上、最大在下；同层内按表名字典序。
 */
export function buildErPlatformRefCountLayers(
  platform: ErPlatformModel,
  edges: ErFkEdge[],
): ErRefCountLayer[] {
  const tables = collectErPlatformTables(platform);
  if (!tables.length) return [];

  const platformTableIds = new Set(tables.map((t) => t.featureId));
  const incomingCount = countIncomingFkRefsByTable(tables, edges, platformTableIds);
  const outgoingCount = countOutgoingFkRefsByTable(tables, edges, platformTableIds);

  const layersByCount = new Map<number, ErTableBlockModel[]>();
  for (const tb of tables) {
    const c = incomingCount.get(tb.featureId) ?? 0;
    const arr = layersByCount.get(c) ?? [];
    arr.push(tb);
    layersByCount.set(c, arr);
  }

  const sortedCounts = [...layersByCount.keys()].sort((a, b) => a - b);
  const layers: ErRefCountLayer[] = [];
  for (const c of sortedCounts) {
    const row = layersByCount.get(c) ?? [];
    if (c === 0 && row.length > 0) {
      const isolated: ErTableBlockModel[] = [];
      const linked: ErTableBlockModel[] = [];
      for (const tb of row) {
        const out = outgoingCount.get(tb.featureId) ?? 0;
        if (out === 0) isolated.push(tb);
        else linked.push(tb);
      }
      if (isolated.length) {
        layers.push({ refCount: 0, tables: sortTablesByName(isolated), isolatedZeroFk: true });
      }
      if (linked.length) {
        layers.push({ refCount: 0, tables: sortTablesByName(linked) });
      }
      continue;
    }
    layers.push({ refCount: c, tables: sortTablesByName(row) });
  }
  return layers;
}
