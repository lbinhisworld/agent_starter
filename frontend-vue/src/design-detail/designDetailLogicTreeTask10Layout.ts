/**
 * [INPUT]: 任务 10 层 `LogicTreeLayerNode`、任务 9 层模块序、逻辑边
 * [OUTPUT]: 按 `Tech_Host_Platform` 分块；宿主块内 **主表→子表→基础表** 三子轨 + RBAC；跨平台接口同步归入「平台间集成」
 * [POS]: `DesignDetailLogicTreeModal.vue` 任务 10 层专用渲染（透明底 + 淡灰边框圆角子块，对齐任务 8）
 *
 * [PROTOCOL]: 宿主块序与任务 9 一级模块左→右一致；Schema 按 `Induction_Type` 分轨；每轨 **表层+字段层**；字段子节点由 sync `buildTask10SchemaFieldFissionPlans` 落库；变更时同步 Modal 与 `formatLogicTreeTask10FeatureValueLine`
 */

import {
  type DesignDetailLogicGraphFeatureDto,
  type DesignDetailLogicGraphLinkDto,
  DESIGN_DETAIL_TASK10_LINE_TASK_ID,
  DESIGN_DETAIL_TASK9_LINE_TASK_ID,
  isDesignDetailReverseValidationLogicLink,
} from './designDetailLogicGraphMerge';
import {
  resolveTask5LogicTreeFeatureKey,
  type LogicTreeLayerNode,
} from './designDetailLogicTreeLayout';

export type Task10BlockEntry = {
  node: LogicTreeLayerNode;
  /** 正向归纳上游任务 9「系统一级模块」节点 */
  upstreamAnchor: LogicTreeLayerNode | null;
};

/** 任务 10 宿主块内三元级联子轨 id */
export type Task10CascadeTierId = 'main' | 'child' | 'base';

export type Task10CascadeTierBlock = {
  tier: Task10CascadeTierId;
  /** 展示用表类型：主表 / 子表 / 基础表 */
  tierLabel: string;
  /** 与 `Induction_Type` 契约对齐的备注 */
  tierRemark: string;
  /** 表层：物理 Schema 表节点 */
  tableEntries: Task10BlockEntry[];
  /** 字段层：由 columns 裂变的「物理表字段」子节点 */
  fieldEntries: Task10BlockEntry[];
  /** 展平序：表层 + 字段层（兼容旧 consumers） */
  entries: Task10BlockEntry[];
};

export type Task10HostPlatformBlock = {
  hostPlatform: string;
  /** 物理 Schema 三元级联子轨（自上而下：主表→子表→基础表） */
  cascadeTiers: Task10CascadeTierBlock[];
  /** RBAC 等非级联 Schema 节点 */
  ancillaryEntries: Task10BlockEntry[];
  /** 展平序：级联子轨 + ancillary（排序与 flat nodes 列表） */
  entries: Task10BlockEntry[];
};

/** 任务 10 层「平台间集成」子块标题（跨平台接口同步 Schema 节点） */
export const TASK10_PLATFORM_INTEGRATION_BLOCK_LABEL = '平台间集成';

export type Task10IntegrationBlock = {
  entries: Task10BlockEntry[];
};

export type Task10LayerBlocksLayout = {
  hostBlocks: Task10HostPlatformBlock[];
  integrationBlock: Task10IntegrationBlock | null;
};

const CASCADE_TIER_ORDER: readonly Task10CascadeTierId[] = ['main', 'child', 'base'];

const CASCADE_TIER_LABEL: Record<Task10CascadeTierId, string> = {
  main: '主表',
  child: '子表',
  base: '基础表',
};

const CASCADE_TIER_REMARK: Record<Task10CascadeTierId, string> = {
  main: '主表基准',
  child: '主子级联纵向裂变',
  base: '主表正向归纳派生',
};

const SCHEMA_KEY = '物理表结构Schema';
const FIELD_KEY = '物理表字段';
const SYNC_KEY = '跨平台接口同步Schema';
const RBAC_KEY = '基础表初始化';
const RBAC_KEY_LEGACY = '权限字典初始化SQL';
const UNLABELED_HOST = '（未标注宿主平台）';

const HOST_PLATFORM_ORDER: Record<string, number> = {
  '企业微信智能表格轻量填报载体': 0,
  '企业微信智能表格/轻量填报载体': 0,
  '七巧低代码平台容器': 1,
};

export function isTask10SchemaNode(node: LogicTreeLayerNode): boolean {
  return resolveTask5LogicTreeFeatureKey(node) === SCHEMA_KEY;
}

export function isTask10FieldNode(node: LogicTreeLayerNode): boolean {
  return resolveTask5LogicTreeFeatureKey(node) === FIELD_KEY;
}

function readTask10FieldParentTableFeatureId(
  node: LogicTreeLayerNode,
  featureMetaById?: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): string {
  const meta = featureMetaById?.get(node.featureId);
  const sources: unknown[] = [
    meta?.featureValue,
    meta?.feature_value,
    (node.display as { featureValue?: unknown })?.featureValue,
    node.display?.name,
  ];
  for (const src of sources) {
    if (!src) continue;
    let o: Record<string, unknown> | null = null;
    if (typeof src === 'object' && !Array.isArray(src)) {
      o = src as Record<string, unknown>;
      const inner = o.Feature_Value ?? o.feature_value;
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        o = inner as Record<string, unknown>;
      }
    } else if (typeof src === 'string' && src.trim().startsWith('{')) {
      try {
        o = JSON.parse(src) as Record<string, unknown>;
      } catch {
        o = null;
      }
    }
    if (!o) continue;
    const parent = String(
      o.parent_table_feature_id ?? o.parentTableFeatureId ?? o.Parent_Table_Feature_Id ?? '',
    ).trim();
    if (parent) return parent;
  }
  return '';
}

export function isTask10CrossPlatformSyncNode(node: LogicTreeLayerNode): boolean {
  return resolveTask5LogicTreeFeatureKey(node) === SYNC_KEY;
}

export function isTask10RbacNode(node: LogicTreeLayerNode): boolean {
  const k = resolveTask5LogicTreeFeatureKey(node);
  return k === RBAC_KEY || k === RBAC_KEY_LEGACY;
}

/** 从 feature 元数据或 `display` 读取 `Induction_Type` */
export function readTask10InductionType(
  node: LogicTreeLayerNode,
  featureMetaById?: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): string {
  const meta = featureMetaById?.get(node.featureId);
  const fromMeta = String(meta?.inductionType ?? meta?.induction_type ?? '').trim();
  if (fromMeta) return fromMeta;
  const fromDisplay = String(
    (node.display as Record<string, unknown> | undefined)?.inductionType ??
      (node.display as Record<string, unknown> | undefined)?.induction_type ??
      '',
  ).trim();
  if (fromDisplay) return fromDisplay;
  const raw = meta?.featureValue ?? meta?.feature_value ?? (node.display as { featureValue?: unknown })
    ?.featureValue;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return String(o.Induction_Type ?? o.induction_type ?? o.inductionType ?? '').trim();
  }
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      return String(o.Induction_Type ?? o.induction_type ?? '').trim();
    } catch {
      /* ignore */
    }
  }
  return '';
}

/** Schema 节点归入主/子/基础子轨；非 Schema 返回 null */
export function resolveTask10CascadeTier(
  node: LogicTreeLayerNode,
  featureMetaById?: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): Task10CascadeTierId | null {
  if (!isTask10SchemaNode(node)) return null;
  const induction = readTask10InductionType(node, featureMetaById);
  if (induction.includes('主子级联') || induction.includes('纵向裂变')) return 'child';
  if (induction.includes('正向归纳派生') || induction.includes('派生')) return 'base';
  if (induction.includes('主表基准') || induction.includes('基准')) return 'main';
  return 'main';
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

function readTechHostFromDisplay(node: LogicTreeLayerNode): string {
  const d = node.display;
  return String(d?.techHostPlatform ?? d?.tech_host_platform ?? '').trim();
}

/** 从 `tasks[].features` 元数据读取 Tech_Host_Platform（优先于链边端点 DTO） */
function readTechHostFromFeatureMeta(
  node: LogicTreeLayerNode,
  featureMetaById?: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): string {
  const meta = featureMetaById?.get(node.featureId);
  if (!meta) return '';
  return String(meta.techHostPlatform ?? meta.tech_host_platform ?? '').trim();
}

function readTechHostPlatform(
  node: LogicTreeLayerNode,
  featureMetaById?: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): string {
  return readTechHostFromFeatureMeta(node, featureMetaById) || readTechHostFromDisplay(node);
}

function inferTechHostFromInferenceSummary(node: LogicTreeLayerNode): string {
  const inf = String(node.display?.inferenceSummary ?? node.display?.inference_summary ?? '').trim();
  if (inf.includes('企微') || inf.includes('企业微信')) return '企业微信智能表格/轻量填报载体';
  if (inf.includes('低代码') || inf.includes('七巧')) return '七巧低代码平台容器';
  return '';
}

/** 从 Schema 卡 `name`（Feature_Value JSON 摘要）抽取表名 token */
function extractTableNameTokens(displayName: string): string[] {
  const raw = String(displayName ?? '').trim();
  if (!raw) return [];
  const tokens = new Set<string>();
  const push = (s: string) => {
    const t = String(s ?? '').trim();
    if (t.length >= 4) tokens.add(t);
  };
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    push(String(o['表格名'] ?? ''));
    push(String(o['表格名称'] ?? ''));
    push(String(o['表名'] ?? ''));
    push(String(o.table_name ?? o.TableName ?? ''));
  } catch {
    /* 非 JSON 摘要（如 legacy SQL 文本） */
  }
  if (!tokens.size && raw.length >= 4) tokens.add(raw);
  return [...tokens];
}

function countSchemaNodesForHost(
  host: string,
  task10Nodes: ReadonlyArray<LogicTreeLayerNode>,
  hostByFid: ReadonlyMap<string, string>,
): number {
  let n = 0;
  for (const node of task10Nodes) {
    if (!isTask10SchemaNode(node)) continue;
    if (hostByFid.get(node.featureId) === host) n += 1;
  }
  return n;
}

/**
 * RBAC 行 Evidence 常指向任务 1 角色化石，链端点 DTO 可能缺 Tech_Host_Platform；
 * 若 SQL 与同层某宿主 Schema 的表名共引用，则归入该宿主平台。
 */
function inferTechHostFromCoReferencedSchema(
  rbacNode: LogicTreeLayerNode,
  task10Nodes: ReadonlyArray<LogicTreeLayerNode>,
  hostByFid: ReadonlyMap<string, string>,
): string | undefined {
  const sqlText = String(rbacNode.display?.name ?? '');
  if (!sqlText) return undefined;
  const hits = new Map<string, number>();
  for (const other of task10Nodes) {
    if (!isTask10SchemaNode(other)) continue;
    const host = hostByFid.get(other.featureId);
    if (!host || host === UNLABELED_HOST) continue;
    for (const token of extractTableNameTokens(String(other.display?.name ?? ''))) {
      if (sqlText.includes(token)) {
        hits.set(host, (hits.get(host) ?? 0) + 1);
      }
    }
  }
  let bestHost = '';
  let bestCount = 0;
  let bestSchemaNodes = 0;
  for (const [h, c] of hits) {
    const schemaN = countSchemaNodesForHost(h, task10Nodes, hostByFid);
    if (c > bestCount || (c === bestCount && c > 0 && schemaN > bestSchemaNodes)) {
      bestCount = c;
      bestHost = h;
      bestSchemaNodes = schemaN;
    }
  }
  return bestCount > 0 ? bestHost : undefined;
}

function resolveTechHostPlatformForNode(
  node: LogicTreeLayerNode,
  task10Nodes: ReadonlyArray<LogicTreeLayerNode>,
  hostByFid: Map<string, string>,
  featureMetaById?: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): string {
  const cached = hostByFid.get(node.featureId);
  if (cached) return cached;

  let thp = readTechHostPlatform(node, featureMetaById);
  if (!thp) thp = inferTechHostFromInferenceSummary(node);
  if (!thp && isTask10RbacNode(node)) {
    thp = inferTechHostFromCoReferencedSchema(node, task10Nodes, hostByFid) ?? '';
  }

  const host = thp || UNLABELED_HOST;
  hostByFid.set(node.featureId, host);
  return host;
}

function buildHostPlatformByFeatureId(
  task10Nodes: ReadonlyArray<LogicTreeLayerNode>,
  featureMetaById?: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): Map<string, string> {
  const hostByFid = new Map<string, string>();
  for (const n of task10Nodes) {
    if (isTask10SchemaNode(n)) resolveTechHostPlatformForNode(n, task10Nodes, hostByFid, featureMetaById);
  }
  for (const n of task10Nodes) {
    if (!isTask10SchemaNode(n)) resolveTechHostPlatformForNode(n, task10Nodes, hostByFid, featureMetaById);
  }
  return hostByFid;
}

/** 由 task-graph `tasks[].features` 建立 featureId → 完整特征 DTO（含 techHostPlatform） */
export function buildTask10FeatureMetaById(
  tasks: ReadonlyArray<{ taskId?: string; features?: DesignDetailLogicGraphFeatureDto[] }>,
): Map<string, DesignDetailLogicGraphFeatureDto> {
  const out = new Map<string, DesignDetailLogicGraphFeatureDto>();
  for (const t of tasks) {
    const tid = String(t?.taskId ?? '').trim();
    if (tid !== DESIGN_DETAIL_TASK10_LINE_TASK_ID && !tid.includes('任务 10')) continue;
    for (const f of t.features ?? []) {
      const fid = String(f.featureId ?? '').trim();
      if (fid) out.set(fid, f);
    }
  }
  return out;
}

function buildTask9LayerOrderIndex(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
): Map<string, number> {
  const out = new Map<string, number>();
  const t9 = nodesByLayer.get(DESIGN_DETAIL_TASK9_LINE_TASK_ID) ?? [];
  let i = 0;
  for (const n of t9) {
    out.set(n.featureId, i);
    i += 1;
  }
  return out;
}

/** task10 featureId → 上游任务 9 一级模块 featureId（正向归纳边） */
function buildTask10ToT9ForwardAnchorMap(
  task10Nodes: ReadonlyArray<LogicTreeLayerNode>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  featureIdToNormTaskId: Map<string, string>,
  t9NodeIds: ReadonlySet<string>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const n of task10Nodes) {
    const t10id = n.featureId;
    for (const L of links) {
      if (!isForwardLink(L, featureIdToNormTaskId)) continue;
      if (linkTargetId(L) !== t10id) continue;
      const src = linkSourceId(L);
      if (!src || !t9NodeIds.has(src)) continue;
      out.set(t10id, src);
      break;
    }
  }
  return out;
}

/** 无 task9 正向边时，按 Tech_Host_Platform 匹配任务  `系统一级模块` 作为展示锚点 */
function resolveUpstreamTask9Anchor(
  node: LogicTreeLayerNode,
  host: string,
  t10ToT9: ReadonlyMap<string, string>,
  t9ByFid: ReadonlyMap<string, LogicTreeLayerNode>,
  t9Nodes: ReadonlyArray<LogicTreeLayerNode>,
): LogicTreeLayerNode | null {
  const anchorFid = t10ToT9.get(node.featureId);
  if (anchorFid) return t9ByFid.get(anchorFid) ?? null;
  if (!host || host === UNLABELED_HOST) return null;
  for (const t9 of t9Nodes) {
    const thp = readTechHostFromDisplay(t9) || inferTechHostFromInferenceSummary(t9);
    if (thp === host) return t9;
  }
  return null;
}

function task10HostEntrySortOrder(node: LogicTreeLayerNode): number {
  if (isTask10SchemaNode(node)) return 0;
  if (isTask10RbacNode(node)) return 1;
  return 2;
}

function sortHostPlatformEntries(entries: Task10BlockEntry[]): Task10BlockEntry[] {
  return [...entries].sort((a, b) => {
    const oa = task10HostEntrySortOrder(a.node);
    const ob = task10HostEntrySortOrder(b.node);
    if (oa !== ob) return oa - ob;
    const va = String(a.node.display?.name ?? '').trim();
    const vb = String(b.node.display?.name ?? '').trim();
    return va.localeCompare(vb, 'zh-CN') || a.node.featureId.localeCompare(b.node.featureId, 'zh-CN');
  });
}

function sortIntegrationEntries(entries: Task10BlockEntry[]): Task10BlockEntry[] {
  return [...entries].sort((a, b) => {
    const va = String(a.node.display?.name ?? '').trim();
    const vb = String(b.node.display?.name ?? '').trim();
    return va.localeCompare(vb, 'zh-CN') || a.node.featureId.localeCompare(b.node.featureId, 'zh-CN');
  });
}

function hostPlatformSortRank(host: string, t9Order: Map<string, number>, entries: Task10BlockEntry[]): number {
  const fixed = HOST_PLATFORM_ORDER[host];
  if (fixed !== undefined) return fixed;
  let best = 1_000_000;
  for (const e of entries) {
    const fid = e.upstreamAnchor?.featureId;
    if (!fid) continue;
    const idx = t9Order.get(fid);
    if (idx !== undefined && idx < best) best = idx;
  }
  return best === 1_000_000 ? 500_000 : best;
}

function buildCascadeTiersForHostEntries(
  hostEntries: Task10BlockEntry[],
  featureMetaById?: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): { cascadeTiers: Task10CascadeTierBlock[]; ancillaryEntries: Task10BlockEntry[] } {
  const tierBuckets = new Map<Task10CascadeTierId, Task10BlockEntry[]>();
  for (const id of CASCADE_TIER_ORDER) tierBuckets.set(id, []);
  const fieldEntries: Task10BlockEntry[] = [];
  const ancillaryEntries: Task10BlockEntry[] = [];
  const tableFidToTier = new Map<string, Task10CascadeTierId>();

  for (const entry of hostEntries) {
    if (isTask10FieldNode(entry.node)) {
      fieldEntries.push(entry);
      continue;
    }
    const tier = resolveTask10CascadeTier(entry.node, featureMetaById);
    if (tier) {
      tierBuckets.get(tier)!.push(entry);
      tableFidToTier.set(entry.node.featureId, tier);
    } else {
      ancillaryEntries.push(entry);
    }
  }

  const fieldBuckets = new Map<Task10CascadeTierId, Task10BlockEntry[]>();
  for (const id of CASCADE_TIER_ORDER) fieldBuckets.set(id, []);
  for (const entry of fieldEntries) {
    const parentFid = readTask10FieldParentTableFeatureId(entry.node, featureMetaById);
    const tier = (parentFid && tableFidToTier.get(parentFid)) || 'main';
    fieldBuckets.get(tier)!.push(entry);
  }

  const cascadeTiers: Task10CascadeTierBlock[] = CASCADE_TIER_ORDER.map((tier) => {
    const tableEntries = sortHostPlatformEntries(tierBuckets.get(tier) ?? []);
    const tierFieldEntries = sortHostPlatformEntries(fieldBuckets.get(tier) ?? []);
    return {
      tier,
      tierLabel: CASCADE_TIER_LABEL[tier],
      tierRemark: CASCADE_TIER_REMARK[tier],
      tableEntries,
      fieldEntries: tierFieldEntries,
      entries: [...tableEntries, ...tierFieldEntries],
    };
  });

  return { cascadeTiers, ancillaryEntries: sortHostPlatformEntries(ancillaryEntries) };
}

function flattenHostBlockEntries(
  cascadeTiers: readonly Task10CascadeTierBlock[],
  ancillaryEntries: readonly Task10BlockEntry[],
): Task10BlockEntry[] {
  const out: Task10BlockEntry[] = [];
  for (const t of cascadeTiers) out.push(...t.entries);
  out.push(...ancillaryEntries);
  return out;
}

function buildTask10BlockEntries(
  scopeNodes: ReadonlyArray<LogicTreeLayerNode>,
  task10Nodes: ReadonlyArray<LogicTreeLayerNode>,
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  featureIdToNormTaskId: Map<string, string>,
  featureMetaById?: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): {
  hostBlocks: Task10HostPlatformBlock[];
  integrationBlock: Task10IntegrationBlock | null;
} {
  const t9Nodes = nodesByLayer.get(DESIGN_DETAIL_TASK9_LINE_TASK_ID) ?? [];
  const t9NodeIds = new Set(t9Nodes.map((n) => n.featureId));
  const t9ByFid = new Map(t9Nodes.map((n) => [n.featureId, n] as const));
  const t9Order = buildTask9LayerOrderIndex(nodesByLayer);
  const t10ToT9 = buildTask10ToT9ForwardAnchorMap(task10Nodes, links, featureIdToNormTaskId, t9NodeIds);
  const hostByFid = buildHostPlatformByFeatureId(task10Nodes, featureMetaById);

  const byHost = new Map<string, Task10BlockEntry[]>();
  const integrationEntries: Task10BlockEntry[] = [];
  for (const n of scopeNodes) {
    const host = hostByFid.get(n.featureId) ?? UNLABELED_HOST;
    const upstreamAnchor = resolveUpstreamTask9Anchor(n, host, t10ToT9, t9ByFid, t9Nodes);
    const entry: Task10BlockEntry = { node: n, upstreamAnchor };
    if (isTask10CrossPlatformSyncNode(n)) {
      integrationEntries.push(entry);
      continue;
    }
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host)!.push(entry);
  }

  const hostBlocks: Task10HostPlatformBlock[] = [...byHost.entries()].map(([hostPlatform, rawEntries]) => {
    const sorted = sortHostPlatformEntries(rawEntries);
    const { cascadeTiers, ancillaryEntries } = buildCascadeTiersForHostEntries(sorted, featureMetaById);
    return {
      hostPlatform,
      cascadeTiers,
      ancillaryEntries,
      entries: flattenHostBlockEntries(cascadeTiers, ancillaryEntries),
    };
  });

  hostBlocks.sort((a, b) => {
    const ra = hostPlatformSortRank(a.hostPlatform, t9Order, a.entries);
    const rb = hostPlatformSortRank(b.hostPlatform, t9Order, b.entries);
    if (ra !== rb) return ra - rb;
    return a.hostPlatform.localeCompare(b.hostPlatform, 'zh-CN');
  });

  const integrationBlock =
    integrationEntries.length > 0
      ? { entries: sortIntegrationEntries(integrationEntries) }
      : null;

  return { hostBlocks, integrationBlock };
}

/**
 * 将任务 10 节点按 Tech_Host_Platform 拆为宿主子块，跨平台接口同步节点归入「平台间集成」子块。
 */
export function buildTask10LayerBlocks(
  task10Nodes: ReadonlyArray<LogicTreeLayerNode>,
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  featureIdToNormTaskId: Map<string, string>,
  featureMetaById?: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): Task10LayerBlocksLayout {
  if (!task10Nodes.length) return { hostBlocks: [], integrationBlock: null };
  return buildTask10BlockEntries(
    task10Nodes,
    task10Nodes,
    nodesByLayer,
    links,
    featureIdToNormTaskId,
    featureMetaById,
  );
}

/** @deprecated 请使用 `buildTask10LayerBlocks`；仅返回宿主平台子块 */
export function buildTask10HostPlatformBlocks(
  task10Nodes: ReadonlyArray<LogicTreeLayerNode>,
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  featureIdToNormTaskId: Map<string, string>,
  featureMetaById?: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): Task10HostPlatformBlock[] {
  return buildTask10LayerBlocks(
    task10Nodes,
    nodesByLayer,
    links,
    featureIdToNormTaskId,
    featureMetaById,
  ).hostBlocks;
}

/** 任务 10 宿主平台子块横向间距 */
export function logicTreeTask10BlockGapPx(blockCount: number): number {
  const n = Math.max(1, Math.ceil(blockCount));
  if (n <= 1) return 0;
  if (n === 2) return 48;
  if (n === 3) return 40;
  return 32;
}

const TASK10_SLOT_PX = 92;

function hostBlockContentWidthPx(tableCount: number, fieldCount: number): number {
  const n = Math.max(1, Math.ceil(Math.max(tableCount, fieldCount)));
  return Math.max(280, n * TASK10_SLOT_PX + 56);
}

function hostBlockTrackWidthPx(block: Task10HostPlatformBlock): number {
  let w = 0;
  for (const tier of block.cascadeTiers) {
    w = Math.max(
      w,
      hostBlockContentWidthPx(tier.tableEntries.length, tier.fieldEntries.length),
    );
  }
  if (block.ancillaryEntries.length) {
    w = Math.max(w, hostBlockContentWidthPx(block.ancillaryEntries.length, 0));
  }
  if (!w) w = hostBlockContentWidthPx(block.entries.length, 0);
  return w;
}

/** 任务 10 轨道最小宽度（宿主子块 + 可选「平台间集成」子块） */
export function logicTreeTask10LayerTrackMinWidthPx(
  blocks: ReadonlyArray<Task10HostPlatformBlock>,
  integrationBlock?: Task10IntegrationBlock | null,
): number {
  const hasIntegration = (integrationBlock?.entries.length ?? 0) > 0;
  const blockCount = blocks.length + (hasIntegration ? 1 : 0);
  const n = Math.max(1, blockCount);
  const gap = logicTreeTask10BlockGapPx(n);
  const sidePad = n <= 1 ? 120 : n === 2 ? 100 : 80;
  let content = 0;
  for (const b of blocks) {
    content += hostBlockTrackWidthPx(b);
  }
  if (hasIntegration && integrationBlock) {
    content += hostBlockContentWidthPx(integrationBlock.entries.length, 0);
  }
  content += Math.max(0, n - 1) * gap;
  return Math.max(720, content + sidePad * 2);
}

/** 任务 10 层内排序：与分块展示序一致（宿主 → 主/子/基础子轨 → RBAC） */
export function sortTask10LayerNodesInPlace(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  fidToTask: Map<string, string>,
  featureMetaById?: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): void {
  const layerKey = DESIGN_DETAIL_TASK10_LINE_TASK_ID;
  const nodes = nodesByLayer.get(layerKey);
  if (!nodes?.length) return;
  const { hostBlocks, integrationBlock } = buildTask10LayerBlocks(
    nodes,
    nodesByLayer,
    links,
    fidToTask,
    featureMetaById,
  );
  const order = new Map<string, number>();
  let i = 0;
  for (const b of hostBlocks) {
    for (const tier of b.cascadeTiers) {
      for (const e of tier.tableEntries) {
        order.set(e.node.featureId, i);
        i += 1;
      }
      for (const e of tier.fieldEntries) {
        order.set(e.node.featureId, i);
        i += 1;
      }
    }
    for (const e of b.ancillaryEntries) {
      order.set(e.node.featureId, i);
      i += 1;
    }
  }
  if (integrationBlock) {
    for (const e of integrationBlock.entries) {
      order.set(e.node.featureId, i);
      i += 1;
    }
  }
  nodes.sort((a, b) => (order.get(a.featureId) ?? 999) - (order.get(b.featureId) ?? 999));
}
