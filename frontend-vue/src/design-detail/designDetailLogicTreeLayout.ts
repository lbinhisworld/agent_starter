/**
 * [INPUT]: `GET …/design-detail/task-graph` 合并后的 `tasks[]`；调用方聚合的任务 2/3/4 卡上 `links[]`（即 `DesignLogicLink` 等价边）
 * [OUTPUT]: 从链边提取 **端点特征**、按归一化 `taskId` 分层列表、**水平等距**槽位用的 `evenLayerSlotLeftPercent`；**`logicTreeLayerTrackMinWidthPx`** 与 Tree 节点槽宽度同口径（相对原设计先 ×0.7 再 ×0.85，约 **59.5%**）；可选追加任务 2/3/4/5/5.5 未出现在链端点集合中的孤儿特征（`appendTask*OrphanEndpointNodes`）
 * [POS]: `DesignDetailLogicTreeModal.vue` 专用布局，与 `designDetailLogicGraphMerge.ts` 契约对齐
 *
 * [PROTOCOL]: 变更链边端点归属或层顺序规则时须同步 `DesignDetailLogicTreeModal.vue` 与本文件及 `frontend-vue/src/design-detail/AGENTS.md`；**任务 5.1** 两层子轨见 **`designDetailLogicTreeTask51Layout.ts`**；**任务 5.2 字段标签栅格**见 **`designDetailLogicTreeTask52Layout.ts`**（`appendTask51OrphanEndpointNodes` / `sortTask51LayerNodesInPlace`）；**`collectLogicTreeCrossLinks` 须含任务 8.5**；**`mergeLogicTreeLayerOrderWithOrphanLayers`** 保证孤儿补点后层序完整；**`logicTreeLayerTrackMinWidthPx` 的 slotPx / 下限** 须与 Modal 中 **`.dd-tree-node-slot` 宽度口径**（先 ×0.7 再 ×0.85）一致；**任务 0** 工具分域 **`isTask0WeComLogicTreeNode` / `isTask0QiQiaoLowCodeLogicTreeNode`** 与 Modal **海蓝/紫** 主题配合；**任务 1** **`appendTask1PainPointRadarEndpointNodes`** / **`appendTask1ExistingSpreadsheetEndpointNodes`** 补点后由 Modal **按正向归纳边端点过滤**；**`sortTask1LayerNodesInPlace`**（痛点最左）icTreeNode`）、**紫/绿主题**（`task1PainRadarGreenReverseValidationTargetSet`）配合；**任务 1 现有表格** 由 **`appendTask1ExistingSpreadsheetEndpointNodes`** + **`isTask1ExistingSpreadsheetLogicTreeNode`**、**黄/绿黄主题**（`dd-tree-card--existing-spreadsheet*`）配合；**`formatLogicTreeFeatureIdShortLabel`** 与 Modal **`.dd-tree-card-fid`** 一致；**任务 10 卡 value** 仅 **`formatLogicTreeTask10FeatureValueLine`**（表名）；**任务 3 / 4 / 5 / 5.5** 孤儿特征与 **`appendTask3/4/5/55OrphanEndpointNodes`** 须与 `designDetailLogicGraphMerge` 归一 id 一致；**任务 5.5 层** 须 **`appendTask55OrphanEndpointNodes`** 补全无链 **`价值流阶段_*`**；**任务 4 层**（L2 价值链四键）由 **`sortTask4LogicTreeLayerNodes`** 固定；**任务 5 / 5.5 层** **`价值流阶段_*`** 由 **`sortTask5LogicTreeLayerNodes`** / **`sortTask55LayerNodesInPlace`** 升序；**价值流阶段_* 标题栏绿底** 由 **`isTask5ValueStreamStageLogicTreeNode`**（含任务 5.5 层）+ Modal **`.dd-tree-card-tok-badge--task5-vsm-stage`**；**任务 8 层** 由 **`sortTask8LayerNodesInPlace`**（先 **`sortTask7LayerNodesInPlace`**，再按任务 7「协作节点」正向边锚点聚邻，组内 操作角色→单据对象→STM）与 **`appendTask8OrphanEndpointNodes`** 配合；**任务 1 卡上 `linkKind`＝「反向验证」边** 由 **`DesignDetailLogicTreeModal`** 与任务 2/3/4/5/5.5 边一并聚合；**Tree SVG TOP/BOTTOM 锚点** 依赖 **`layerOrder`** 与 **`logicTreeFeatureLayerIndex`**
 */

import {
  type DesignDetailLogicGraphFeatureDto,
  type DesignDetailLogicGraphLinkDto,
  type DesignDetailLogicGraphTaskDto,
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  DESIGN_DETAIL_TASK4_LINE_TASK_ID,
  DESIGN_DETAIL_TASK5_LINE_TASK_ID,
  DESIGN_DETAIL_TASK51_LINE_TASK_ID,
  DESIGN_DETAIL_TASK52_LINE_TASK_ID,
  DESIGN_DETAIL_TASK53_LINE_TASK_ID,
  DESIGN_DETAIL_TASK55_LINE_TASK_ID,
  DESIGN_DETAIL_TASK6_LINE_TASK_ID,
  DESIGN_DETAIL_TASK65_LINE_TASK_ID,
  DESIGN_DETAIL_TASK7_LINE_TASK_ID,
  DESIGN_DETAIL_TASK8_LINE_TASK_ID,
  DESIGN_DETAIL_TASK85_LINE_TASK_ID,
  DESIGN_DETAIL_TASK0_LINE_TASK_ID,
  DESIGN_DETAIL_TASK9_LINE_TASK_ID,
  DESIGN_DETAIL_TASK10_LINE_TASK_ID,
  buildFeatureIdToNormTaskIdFromGraphTasks,
  normLogicTaskId,
} from './designDetailLogicGraphMerge';
import type { ToolSuitePrimitiveGraphFeature } from './designDetailToolSuitePrimitiveSource';
import {
  buildTask51TwoTierLayout,
  flattenTask51TwoTierLayout,
  isTask51BusinessCapabilityUnitFeatureKey,
  isTask51ValuePropositionFeatureKey,
} from './designDetailLogicTreeTask51Layout';
import {
  filterTask53WorkflowCardsForTreeDisplay,
  isTask53WorkflowGraphFeatureRow,
  task53WorkflowCardTitle,
} from './designDetailLogicTreeTask53Layout';
import {
  buildTask65ThreeGapBoxLayout,
  flattenTask65ThreeGapBoxLayout,
  isTask65GapFeatureKey,
} from './designDetailLogicTreeTask65Layout';

export {
  isTask51BusinessCapabilityUnitFeatureKey,
  isTask51ValuePropositionFeatureKey,
} from './designDetailLogicTreeTask51Layout';

const TASK1_LAYER_KEY = 'customer_basic' as const;

export type LogicTreeLayerNode = {
  featureId: string;
  taskId: string;
  /** 非链边端点、仅任务 2 独有特征时为 true */
  orphan?: boolean;
  display: DesignDetailLogicGraphFeatureDto;
};

export type LogicTreePreparedLayers = {
  /** 展示顺序：任务 1 层在前、任务 2 层在后，其余任务 id 字典序接尾 */
  layerOrder: readonly string[];
  /** 每层端点节点（链边遍历稳定序 + 层内去重） */
  nodesByLayer: Map<string, LogicTreeLayerNode[]>;
};

/**
 * 逻辑树节点编号展示：`ft_000000000001` → **`FT***0001`**（取 12 位数字末 4 位；历史 id 回退末 4 位数字/字母）。
 */
export function formatLogicTreeFeatureIdShortLabel(featureId: string): string {
  const raw = String(featureId || '').trim();
  if (!raw) return 'FT***----';
  const m = /^ft_(\d{12})$/i.exec(raw);
  if (m) return `FT***${m[1]!.slice(-4)}`;
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 4) return `FT***${digits.slice(-4)}`;
  const alnum = raw.replace(/[^a-zA-Z0-9]/g, '');
  const tail = (alnum.length >= 4 ? alnum.slice(-4) : alnum.padStart(4, '0')).toUpperCase();
  return `FT***${tail}`;
}

const LOGIC_TREE_FEATURE_VALUE_PREVIEW_LEN = 140;

const LOGIC_TREE_TABLE_NAME_KEYS = [
  '表格名称',
  '表名',
  '表格名',
  '接口名称',
  'table_name',
  'TableName',
] as const;

function truncateLogicTreeFeaturePreview(s: string): string {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= LOGIC_TREE_FEATURE_VALUE_PREVIEW_LEN) return t;
  return `${t.slice(0, LOGIC_TREE_FEATURE_VALUE_PREVIEW_LEN - 1)}…`;
}

/** 从任务 10「物理表字段」Feature_Value 抽取 `field_name (data_type)` 展示行 */
export function extractLogicTreeTask10FieldLabel(name: unknown): string {
  if (name === null || name === undefined) return '';
  if (typeof name === 'string') {
    const s = name.trim();
    if (!s || s === '[object Object]') return '';
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        return extractLogicTreeTask10FieldLabel(JSON.parse(s) as unknown);
      } catch {
        return '';
      }
    }
    return s;
  }
  if (typeof name === 'object') {
    const o = name as Record<string, unknown>;
    const nested = o.Feature_Value ?? o.feature_value;
    if (nested !== undefined && nested !== null && nested !== name) {
      return extractLogicTreeTask10FieldLabel(nested);
    }
    const fn = String(o.field_name ?? o['字段名称'] ?? o['字段名'] ?? o.name ?? '').trim();
    const dt = String(o.data_type ?? o['数据类型'] ?? '').trim();
    if (fn && dt) return `${fn} (${dt})`;
    if (fn) return fn;
  }
  return '';
}

/** 从任务 10 Feature_Value（对象 / JSON 字符串 / 后端摘要）抽取表名 */
export function extractLogicTreeTask10TableName(name: unknown): string {
  if (name === null || name === undefined) return '';
  if (typeof name === 'string') {
    const s = name.trim();
    if (!s || s === '[object Object]') return '';
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        return extractLogicTreeTask10TableName(JSON.parse(s) as unknown);
      } catch {
        return '';
      }
    }
    return s;
  }
  if (typeof name === 'object') {
    const o = name as Record<string, unknown>;
    const meta = o.table_metadata;
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      const tn = String((meta as Record<string, unknown>).table_name ?? '').trim();
      if (tn) return tn;
    }
    for (const k of LOGIC_TREE_TABLE_NAME_KEYS) {
      const v = String(o[k] ?? '').trim();
      if (v) return v;
    }
    const nested = o.Feature_Value ?? o.feature_value;
    if (nested !== undefined && nested !== null && nested !== name) {
      return extractLogicTreeTask10TableName(nested);
    }
  }
  return '';
}

/** 从任务 10 跨平台 Schema Feature_Value 抽取 `接口名称` */
export function extractLogicTreeTask10InterfaceName(name: unknown): string {
  if (name === null || name === undefined) return '';
  if (typeof name === 'string') {
    const s = name.trim();
    if (!s || s === '[object Object]') return '';
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        return extractLogicTreeTask10InterfaceName(JSON.parse(s) as unknown);
      } catch {
        return '';
      }
    }
    return '';
  }
  if (typeof name === 'object') {
    const o = name as Record<string, unknown>;
    const v = String(o['接口名称'] ?? '').trim();
    if (v) return v;
    const nested = o.Feature_Value ?? o.feature_value;
    if (nested !== undefined && nested !== null && nested !== name) {
      return extractLogicTreeTask10InterfaceName(nested);
    }
  }
  return '';
}

/** 任务 10 逻辑树卡 value：Schema/RBAC 展示表名；物理表字段展示 `field_name (data_type)`；跨平台接口同步展示 `接口名称` */
export function formatLogicTreeTask10FeatureValueLine(name: unknown, featureKey?: string): string {
  const key = String(featureKey ?? '').trim();
  if (key === '物理表字段') {
    const label = extractLogicTreeTask10FieldLabel(name).trim();
    if (!label) return '—';
    return truncateLogicTreeFeaturePreview(label) || '—';
  }
  if (key === '跨平台接口同步Schema') {
    const iface =
      extractLogicTreeTask10InterfaceName(name).trim() ||
      extractLogicTreeTask10TableName(name).trim();
    if (!iface) return '—';
    return truncateLogicTreeFeaturePreview(iface) || '—';
  }
  const table = extractLogicTreeTask10TableName(name).trim();
  if (!table) return '—';
  return truncateLogicTreeFeaturePreview(table) || '—';
}

/** 逻辑树节点卡 Feature 取值行：兼容任务 10 原生 JSON Object / 历史字符串 JSON */
export function formatLogicTreeFeatureValueLine(name: unknown): string {
  if (name === null || name === undefined) return '—';
  if (typeof name === 'string') {
    const s = name.trim();
    if (!s || s === '[object Object]') return '—';
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        return formatLogicTreeFeatureValueLine(JSON.parse(s) as unknown);
      } catch {
        return truncateLogicTreeFeaturePreview(s) || '—';
      }
    }
    return truncateLogicTreeFeaturePreview(s) || '—';
  }
  if (typeof name === 'number' || typeof name === 'boolean') {
    return String(name);
  }
  if (typeof name === 'object') {
    const o = name as Record<string, unknown>;
    for (const k of ['phase_name', 'Phase_Name', ...LOGIC_TREE_TABLE_NAME_KEYS]) {
      const v = String(o[k] ?? '').trim();
      if (v) return truncateLogicTreeFeaturePreview(v);
    }
    const nested = o.Feature_Value ?? o.feature_value;
    if (nested !== undefined && nested !== null && nested !== name) {
      const inner = formatLogicTreeFeatureValueLine(nested);
      if (inner !== '—') return inner;
    }
    try {
      return truncateLogicTreeFeaturePreview(JSON.stringify(o)) || '—';
    } catch {
      return '—';
    }
  }
  const s = String(name).trim();
  return s && s !== '[object Object]' ? truncateLogicTreeFeaturePreview(s) : '—';
}

function isBadLogicTreeFeatureDisplayName(name: unknown): boolean {
  if (name === null || name === undefined) return true;
  if (typeof name === 'object') return true;
  const s = String(name).trim();
  return !s || s === '[object Object]';
}

/** 由 `tasks[].features` 建立 `featureId` → 归一化 `taskId`（与逻辑弹层一致） */
/**
 * 任务 1 层节点 `display` 多来自链边 `source`/`target`；将 `tasks[].features` 上的 **painPointConfirmed** 合并回展示 DTO，供逻辑树 PAIN 角标。
 */
/** 任务 1 节点 token 主路径（`tokenDisplay` 首段，不含 ` · ` 后缀） */
export function resolveTask1LogicTreeTokenPath(node: LogicTreeLayerNode): string {
  const f = node.display;
  const td = String(f.tokenDisplay ?? f.token_display ?? '').trim();
  if (!td || td === '—') return '';
  return td.split(/\s*·\s*/)[0]?.trim() ?? td;
}

/** 是否属于痛点雷达分域（`痛点雷达/…` token 路径） */
export function isTask1PainPointRadarLogicTreeNode(node: LogicTreeLayerNode): boolean {
  return resolveTask1LogicTreeTokenPath(node).startsWith('痛点雷达/');
}

/** 是否属于现有表格分域（`现有表格/…` token 路径） */
export function isTask1ExistingSpreadsheetLogicTreeNode(node: LogicTreeLayerNode): boolean {
  return resolveTask1LogicTreeTokenPath(node).startsWith('现有表格/');
}

/** 任务 0 tokenDisplay 形态：`{featureKey}/{toolName}` → 二级工具名 */
export function resolveTask0LogicTreeToolName(node: LogicTreeLayerNode): string {
  const f = node.display;
  const raw = String(f.tokenDisplay ?? f.token_display ?? '').trim();
  if (!raw || raw === '—') return '';
  const head = raw.split(/\s*·\s*/)[0]?.trim() ?? raw;
  const slash = head.indexOf('/');
  if (slash >= 0) return head.slice(slash + 1).trim();
  return head;
}

/** 任务 0 · 企业微信工具原语节点（按 token 二级工具名） */
export function isTask0WeComLogicTreeNode(node: LogicTreeLayerNode): boolean {
  const tool = resolveTask0LogicTreeToolName(node);
  if (tool.includes('企业微信')) return true;
  const td = String(node.display.tokenDisplay ?? node.display.token_display ?? '').trim();
  return td.includes('企业微信');
}

/** 任务 0 · 七巧低代码工具原语节点（按 token 二级工具名） */
export function isTask0QiQiaoLowCodeLogicTreeNode(node: LogicTreeLayerNode): boolean {
  const tool = resolveTask0LogicTreeToolName(node);
  if (tool.includes('七巧低代码') || tool.includes('七巧')) return true;
  const td = String(node.display.tokenDisplay ?? node.display.token_display ?? '').trim();
  return td.includes('七巧低代码') || td.includes('七巧');
}

/**
 * 任务 1 层：将 `tasks[].features` 中所有 `痛点雷达/` token 补入候选集；Modal 仅保留有正向归纳边连接的端点。
 */
export function appendTask1PainPointRadarEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): void {
  const t1 = tasks.find((t) => normLogicTaskId(t.taskId) === TASK1_LAYER_KEY);
  if (!t1) return;
  const layerKey = TASK1_LAYER_KEY;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const list = nodesByLayer.get(layerKey)!;
  const seen = new Set(list.map((n) => n.featureId));
  for (const f of t1.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || seen.has(fid)) continue;
    const head = resolveTask1LogicTreeTokenPath({
      featureId: fid,
      taskId: layerKey,
      display: f,
    });
    if (!head.startsWith('痛点雷达/')) continue;
    seen.add(fid);
    list.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

/**
 * 任务 1 层：将 `tasks[].features` 中所有 `现有表格/` token 补入候选集；Modal 仅保留有正向归纳边连接的端点。
 */
export function appendTask1ExistingSpreadsheetEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): void {
  const t1 = tasks.find((t) => normLogicTaskId(t.taskId) === TASK1_LAYER_KEY);
  if (!t1) return;
  const layerKey = TASK1_LAYER_KEY;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const list = nodesByLayer.get(layerKey)!;
  const seen = new Set(list.map((n) => n.featureId));
  for (const f of t1.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || seen.has(fid)) continue;
    const head = resolveTask1LogicTreeTokenPath({
      featureId: fid,
      taskId: layerKey,
      display: f,
    });
    if (!head.startsWith('现有表格/')) continue;
    seen.add(fid);
    list.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

/** 痛点雷达层内排序：核心痛点总结最左，其余按常见维度顺序 */
const TASK1_PAIN_RADAR_TREE_SEGMENT_ORDER = [
  '核心痛点总结',
  '系统',
  '人',
  '财',
  '物',
  '事',
  '管控',
] as const;

function task1PainPointRadarNodeSortRank(node: LogicTreeLayerNode): { tier: number; tail: string } {
  const path = resolveTask1LogicTreeTokenPath(node);
  const seg = path.startsWith('痛点雷达/') ? path.slice('痛点雷达/'.length) : path;
  if (seg === '核心痛点总结') return { tier: 0, tail: node.featureId };
  for (let i = 0; i < TASK1_PAIN_RADAR_TREE_SEGMENT_ORDER.length; i += 1) {
    const label = TASK1_PAIN_RADAR_TREE_SEGMENT_ORDER[i]!;
    if (label === '核心痛点总结') continue;
    if (seg === label || seg.startsWith(`${label}/`) || seg.startsWith(label)) {
      return { tier: i, tail: seg };
    }
  }
  return { tier: TASK1_PAIN_RADAR_TREE_SEGMENT_ORDER.length, tail: seg || node.featureId };
}

/** 任务 1 层：痛点雷达最左，其次现有表格，其余按 featureId */
export function sortTask1LayerNodesInPlace(nodesByLayer: Map<string, LogicTreeLayerNode[]>): void {
  const list = nodesByLayer.get(TASK1_LAYER_KEY);
  if (!list?.length) return;
  nodesByLayer.set(
    TASK1_LAYER_KEY,
    [...list].sort((a, b) => {
      const aPain = isTask1PainPointRadarLogicTreeNode(a);
      const bPain = isTask1PainPointRadarLogicTreeNode(b);
      if (aPain !== bPain) return aPain ? -1 : 1;
      if (aPain && bPain) {
        const ra = task1PainPointRadarNodeSortRank(a);
        const rb = task1PainPointRadarNodeSortRank(b);
        if (ra.tier !== rb.tier) return ra.tier - rb.tier;
        return ra.tail.localeCompare(rb.tail, 'zh-CN');
      }
      const aEss = isTask1ExistingSpreadsheetLogicTreeNode(a);
      const bEss = isTask1ExistingSpreadsheetLogicTreeNode(b);
      if (aEss !== bEss) return aEss ? -1 : 1;
      if (aEss && bEss) {
        return resolveTask1LogicTreeTokenPath(a).localeCompare(
          resolveTask1LogicTreeTokenPath(b),
          'zh-CN',
        );
      }
      return a.featureId.localeCompare(b.featureId, 'zh-CN');
    }),
  );
}

export function enrichTask1LayerPainBadgeFromTaskFeatures(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): void {
  const t1 = tasks.find((t) => normLogicTaskId(t.taskId) === TASK1_LAYER_KEY);
  if (!t1?.features?.length) return;
  const byId = new Map(
    t1.features
      .map((f) => [String(f.featureId || '').trim(), f] as const)
      .filter(([id]) => id.length > 0),
  );
  const nodes = nodesByLayer.get(TASK1_LAYER_KEY);
  if (!nodes?.length) return;
  for (const n of nodes) {
    const src = byId.get(n.featureId);
    if (!src?.painPointConfirmed) continue;
    n.display = {
      ...n.display,
      painPointConfirmed: true,
      ...(src.painPointConfirmedByLineStepId
        ? { painPointConfirmedByLineStepId: src.painPointConfirmedByLineStepId }
        : {}),
    };
  }
}

/** 任务 10 层：补全 `tasks[].features` 中缺失节点，并合并 techHostPlatform / inferenceSummary / name */
export function enrichTask10LayerTechHostFromTaskFeatures(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): void {
  const t10 = tasks.find((t) => {
    const raw = String(t?.taskId || '').trim();
    return normLogicTaskId(raw) === DESIGN_DETAIL_TASK10_LINE_TASK_ID || raw.includes('任务 10');
  });
  if (!t10?.features?.length) return;
  const layerKey = DESIGN_DETAIL_TASK10_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const list = nodesByLayer.get(layerKey)!;
  const seen = new Set(list.map((n) => n.featureId));
  const byId = new Map(
    t10.features
      .map((f) => [String(f.featureId || '').trim(), f] as const)
      .filter(([id]) => id.length > 0),
  );
  for (const f of t10.features) {
    const fid = String(f.featureId || '').trim();
    if (!fid || seen.has(fid)) continue;
    const key = resolveTask5LogicTreeFeatureKey({
      featureId: fid,
      taskId: layerKey,
      display: f,
    });
    if (!isTask10L5TechnicalDdlFeatureKey(key)) continue;
    seen.add(fid);
    list.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
  for (const n of list) {
    const src = byId.get(n.featureId);
    if (!src) continue;
    const thp = String(src.techHostPlatform ?? src.tech_host_platform ?? '').trim();
    const inf = String(src.inferenceSummary ?? src.inference_summary ?? '').trim();
    const it = String(src.inductionType ?? src.induction_type ?? '').trim();
    const ptr = String(src.parentTableRef ?? src.parent_table_ref ?? '').trim();
    const curThp = String(n.display?.techHostPlatform ?? n.display?.tech_host_platform ?? '').trim();
    const curInf = String(n.display?.inferenceSummary ?? n.display?.inference_summary ?? '').trim();
    const curIt = String(
      (n.display as { inductionType?: string })?.inductionType ??
        (n.display as { induction_type?: string })?.induction_type ??
        '',
    ).trim();
    const key = resolveTask5LogicTreeFeatureKey(n);
    const nameFromSrc = formatLogicTreeTask10FeatureValueLine(src.name, key);
    const needName = isBadLogicTreeFeatureDisplayName(n.display?.name) && nameFromSrc !== '—';
    if (!thp && !inf && !needName && !it) continue;
    if (thp === curThp && (!inf || inf === curInf) && !needName && (!it || it === curIt)) continue;
    n.display = {
      ...n.display,
      ...(thp ? { techHostPlatform: thp } : {}),
      ...(inf && !curInf ? { inferenceSummary: inf } : {}),
      ...(it && it !== curIt ? { inductionType: it } : {}),
      ...(ptr ? { parentTableRef: ptr } : {}),
      ...(needName ? { name: nameFromSrc } : {}),
    };
  }
}

export function buildFeatureIdToNormTaskId(tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>): Map<string, string> {
  return buildFeatureIdToNormTaskIdFromGraphTasks(tasks);
}

/**
 * Tree SVG 锚点：端点所在层在 `layerOrder` 中的序号（0=最顶，与 `extractEndpointFeaturesByTaskFromLinks` 的展示序一致）。
 * 未知 feature 或 task 不在 `layerOrder` 中时返回 **-1**，由调用方用几何上下关系兜底。
 */
export function logicTreeFeatureLayerIndex(
  featureId: string,
  layerOrder: readonly string[],
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): number {
  const fid = String(featureId || '').trim();
  if (!fid) return -1;
  const tid = buildFeatureIdToNormTaskId(tasks).get(fid);
  if (!tid) return -1;
  const i = layerOrder.indexOf(tid);
  return i;
}

/** 将工具集「特征」视图合成的原语节点平铺进任务 0 层（无链也可展示；未 sync 时用 preview: 前缀，非落库 ft_） */
export function appendTool0PrimitiveLayerNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  primitives: ReadonlyArray<ToolSuitePrimitiveGraphFeature>,
): boolean {
  if (!primitives.length) return false;
  const list: LogicTreeLayerNode[] = primitives.map((p) => {
    const fid = `preview:${p.tokenDisplay}`;
    return {
      featureId: fid,
      taskId: DESIGN_DETAIL_TASK0_LINE_TASK_ID,
      orphan: true,
      display: {
        featureId: fid,
        name: p.value,
        tokenDisplay: p.tokenDisplay,
        operator: p.operator,
        valueRefDomain: p.value,
        themeKey: 'toolbox_primitive',
      },
    };
  });
  nodesByLayer.set(DESIGN_DETAIL_TASK0_LINE_TASK_ID, list);
  return true;
}

/** 任务 0：推理图中未出现在链端点上的工具原语仍平铺展示（与任务 2 孤儿补点一致） */
export function appendTask0OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkEndpointIds: ReadonlySet<string>,
): void {
  const t0 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK0_LINE_TASK_ID);
  const feats = Array.isArray(t0?.features) ? t0!.features! : [];
  if (!feats.length) return;
  const layerKey = DESIGN_DETAIL_TASK0_LINE_TASK_ID;
  const list = [...(nodesByLayer.get(layerKey) ?? [])];
  const seen = new Set(list.map((n) => n.featureId));
  for (const f of feats) {
    const fid = String(f.featureId || '').trim();
    if (!fid || seen.has(fid)) continue;
    seen.add(fid);
    list.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: f,
    });
  }
  if (list.length) nodesByLayer.set(layerKey, list);
}

export function mergeLayerOrderWithTool0Primitive(layerOrder: string[], hasTask0Nodes: boolean): string[] {
  const without = layerOrder.filter((k) => k !== DESIGN_DETAIL_TASK0_LINE_TASK_ID);
  if (!hasTask0Nodes) return sortLayerKeys(without.length ? without : layerOrder);
  return sortLayerKeys([DESIGN_DETAIL_TASK0_LINE_TASK_ID, ...without]);
}

/** 链边推导的 layerOrder 与孤儿补点后的 nodesByLayer 合并（避免仅有孤儿节点时整层缺失） */
export function mergeLogicTreeLayerOrderWithOrphanLayers(
  linkDerivedOrder: readonly string[],
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
): string[] {
  const keysWithNodes = [...nodesByLayer.keys()].filter((k) => (nodesByLayer.get(k) ?? []).length > 0);
  return sortLayerKeys([...new Set([...linkDerivedOrder, ...keysWithNodes])]);
}

export function extendFeatureIdToNormTaskIdWithTool0Primitives(
  fidToTask: Map<string, string>,
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
): void {
  for (const n of nodesByLayer.get(DESIGN_DETAIL_TASK0_LINE_TASK_ID) ?? []) {
    const fid = String(n.featureId || '').trim();
    if (fid) fidToTask.set(fid, DESIGN_DETAIL_TASK0_LINE_TASK_ID);
  }
}

function sortLayerKeys(keys: string[]): string[] {
  const known: readonly string[] = [
    DESIGN_DETAIL_TASK0_LINE_TASK_ID,
    TASK1_LAYER_KEY,
    DESIGN_DETAIL_TASK2_LINE_TASK_ID,
    DESIGN_DETAIL_TASK3_LINE_TASK_ID,
    DESIGN_DETAIL_TASK4_LINE_TASK_ID,
    DESIGN_DETAIL_TASK5_LINE_TASK_ID,
    DESIGN_DETAIL_TASK51_LINE_TASK_ID,
    DESIGN_DETAIL_TASK52_LINE_TASK_ID,
    DESIGN_DETAIL_TASK53_LINE_TASK_ID,
    DESIGN_DETAIL_TASK55_LINE_TASK_ID,
    DESIGN_DETAIL_TASK6_LINE_TASK_ID,
    DESIGN_DETAIL_TASK65_LINE_TASK_ID,
    DESIGN_DETAIL_TASK7_LINE_TASK_ID,
  DESIGN_DETAIL_TASK8_LINE_TASK_ID,
  DESIGN_DETAIL_TASK85_LINE_TASK_ID,
  DESIGN_DETAIL_TASK9_LINE_TASK_ID,
  DESIGN_DETAIL_TASK10_LINE_TASK_ID,
  ];
  const uniq = [...new Set(keys)];
  return uniq.sort((a, b) => {
    const ia = known.indexOf(a);
    const ib = known.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

/**
 * 从 `DesignLogicLink` 等价数据 `links[]` 提取全部端点特征；按端点所在任务的 `taskId`（归一化）归入各层列表。
 * 稳定序：按链边数组顺序依次处理，每端点 **首次出现** 时加入对应层。
 */
export function extractEndpointFeaturesByTaskFromLinks(
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): LogicTreePreparedLayers {
  const fidToTask = buildFeatureIdToNormTaskId(tasks);
  const lists = new Map<string, LogicTreeLayerNode[]>();
  const seenPerLayer = new Map<string, Set<string>>();

  function ensureList(tid: string) {
    if (!lists.has(tid)) {
      lists.set(tid, []);
      seenPerLayer.set(tid, new Set());
    }
  }

  function pushIfNew(tid: string, featureId: string, display: DesignDetailLogicGraphFeatureDto | null | undefined) {
    if (!tid || !featureId || !display) return;
    ensureList(tid);
    const s = seenPerLayer.get(tid)!;
    if (s.has(featureId)) return;
    s.add(featureId);
    lists.get(tid)!.push({ featureId, taskId: tid, display });
  }

  for (const L of links) {
    const sid = String(L.sourceFeatureId ?? L.source?.featureId ?? '').trim();
    const tid = String(L.targetFeatureId ?? L.target?.featureId ?? '').trim();
    const sTask = fidToTask.get(sid);
    const tTask = fidToTask.get(tid);
    if (sid && L.source && sTask) pushIfNew(sTask, sid, L.source);
    if (tid && L.target && tTask) pushIfNew(tTask, tid, L.target);
  }

  const keysWithNodes = [...lists.keys()].filter((k) => (lists.get(k) ?? []).length > 0);
  const layerOrder = sortLayerKeys(keysWithNodes);
  return { layerOrder, nodesByLayer: lists };
}

/**
 * 任务 2 上未作为任一条链 **target** 的特征，追加到任务 2 层末尾（与既有逻辑树「独有特征」一致）。
 */
export function appendTask2OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkTargetFeatureIds: ReadonlySet<string>,
): void {
  const t2 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK2_LINE_TASK_ID);
  if (!t2) return;
  const layerKey = DESIGN_DETAIL_TASK2_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t2.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkTargetFeatureIds.has(fid) || seen.has(fid)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

/**
 * 任务 3 上未作为任一条链 **target** 的特征，追加到任务 3 层末尾（与任务 2 孤儿特征对称）。
 */
export function appendTask3OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkTargetFeatureIds: ReadonlySet<string>,
): void {
  const t3 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK3_LINE_TASK_ID);
  if (!t3) return;
  const layerKey = DESIGN_DETAIL_TASK3_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t3.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkTargetFeatureIds.has(fid) || seen.has(fid)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

/**
 * 任务 4 上未作为任一条链 **target** 的特征，追加到任务 4 层末尾（与任务 2/3 孤儿特征对称）。
 */
export function appendTask4OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkTargetFeatureIds: ReadonlySet<string>,
): void {
  const t4 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK4_LINE_TASK_ID);
  if (!t4) return;
  const layerKey = DESIGN_DETAIL_TASK4_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t4.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkTargetFeatureIds.has(fid) || seen.has(fid)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

/** 任务 4 逻辑树层：L2 价值矩阵四键 */
export const TASK4_LOGIC_TREE_FIXED_FEATURE_KEY_ORDER = [
  '核心价值驱动',
  '运营重心',
  '账面焦点',
  '数字化成熟度预期',
] as const;

/** 任务 5 逻辑树层：L3 VSM 固定维度 */
export const TASK5_LOGIC_TREE_FIXED_FEATURE_KEY_ORDER = [
  '宏观业务流程模式',
  '流程始端边界',
  '流程末端边界',
  '过程控制密度',
  '关键管控闸口配置',
  '流程自动化水平',
] as const;

/** 任务 4：L2 四键归一（兼容历史「业务价值焦点」） */
export function normalizeTask4LogicTreeFeatureKey(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (s === '业务价值焦点' || s.includes('业务价值焦点')) return '账面焦点';
  for (const k of TASK4_LOGIC_TREE_FIXED_FEATURE_KEY_ORDER) {
    if (s === k || s.includes(k)) return k;
  }
  return s;
}

/** 任务 5：将 `价值流阶段_*` 归一；固定维度做包含匹配 */
export function normalizeTask5LogicTreeFeatureKey(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const stage = s.match(/价值流阶段[_\s]*(\d+)/);
  if (stage) return `价值流阶段_${stage[1]}`;
  for (const k of TASK5_LOGIC_TREE_FIXED_FEATURE_KEY_ORDER) {
    if (s === k || s.includes(k)) return k;
  }
  return s;
}

/** @deprecated 任务 4 无 VSM 阶段节点；保留 API 避免误用旧数据时崩溃 */
export function isTask4ValueStreamStageFeatureKey(_key: string): boolean {
  return false;
}

export function isTask4ValueStreamStageLogicTreeNode(_taskId: string, _node: LogicTreeLayerNode): boolean {
  return false;
}

export function isTask5ValueStreamStageFeatureKey(key: string): boolean {
  const k = normalizeTask5LogicTreeFeatureKey(key);
  if (k === '价值流阶段') return true;
  return /^价值流阶段_\d+$/.test(k);
}

export function isTask5ValueStreamStageLogicTreeNode(
  taskId: string,
  node: LogicTreeLayerNode,
): boolean {
  const tid = normLogicTaskId(taskId);
  if (tid !== DESIGN_DETAIL_TASK5_LINE_TASK_ID && tid !== DESIGN_DETAIL_TASK55_LINE_TASK_ID) {
    return false;
  }
  return isTask5ValueStreamStageFeatureKey(resolveTask5LogicTreeFeatureKey(node));
}

export function resolveTask4LogicTreeFeatureKey(node: LogicTreeLayerNode): string {
  const f = node.display;
  const td = String(f.tokenDisplay ?? f.token_display ?? '').trim();
  const tokenPrimary = td && td !== '—' ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : '';
  if (tokenPrimary) return normalizeTask4LogicTreeFeatureKey(tokenPrimary);
  const nm = String(f.name ?? '').trim();
  if (nm) return normalizeTask4LogicTreeFeatureKey(nm);
  return normalizeTask4LogicTreeFeatureKey(node.featureId);
}

export function resolveTask5LogicTreeFeatureKey(node: LogicTreeLayerNode): string {
  const f = node.display;
  const td = String(f.tokenDisplay ?? f.token_display ?? '').trim();
  const tokenPrimary = td && td !== '—' ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : '';
  if (tokenPrimary) return normalizeTask5LogicTreeFeatureKey(tokenPrimary);
  const nm = String(f.name ?? '').trim();
  if (nm) return normalizeTask5LogicTreeFeatureKey(nm);
  return normalizeTask5LogicTreeFeatureKey(node.featureId);
}

function task4LogicTreeNodeSortRank(node: LogicTreeLayerNode): { tier: number; tail: string } {
  const key = resolveTask4LogicTreeFeatureKey(node);
  const fixedIdx = (TASK4_LOGIC_TREE_FIXED_FEATURE_KEY_ORDER as readonly string[]).indexOf(key);
  if (fixedIdx >= 0) return { tier: fixedIdx, tail: node.featureId };
  return { tier: TASK4_LOGIC_TREE_FIXED_FEATURE_KEY_ORDER.length, tail: key || node.featureId };
}

function task5LogicTreeNodeSortRank(node: LogicTreeLayerNode): { tier: number; stageNum: number; tail: string } {
  const key = resolveTask5LogicTreeFeatureKey(node);
  const fixedIdx = (TASK5_LOGIC_TREE_FIXED_FEATURE_KEY_ORDER as readonly string[]).indexOf(key);
  if (fixedIdx >= 0) return { tier: fixedIdx, stageNum: 0, tail: node.featureId };
  const stage = key.match(/^价值流阶段_(\d+)$/);
  if (stage) {
    const n = parseInt(stage[1]!, 10);
    return {
      tier: TASK5_LOGIC_TREE_FIXED_FEATURE_KEY_ORDER.length,
      stageNum: Number.isFinite(n) ? n : 0,
      tail: node.featureId,
    };
  }
  return {
    tier: TASK5_LOGIC_TREE_FIXED_FEATURE_KEY_ORDER.length + 1,
    stageNum: 0,
    tail: key || node.featureId,
  };
}

export function sortTask4LogicTreeLayerNodes(nodes: readonly LogicTreeLayerNode[]): LogicTreeLayerNode[] {
  return [...nodes].sort((a, b) => {
    const ra = task4LogicTreeNodeSortRank(a);
    const rb = task4LogicTreeNodeSortRank(b);
    if (ra.tier !== rb.tier) return ra.tier - rb.tier;
    return ra.tail.localeCompare(rb.tail, 'zh-CN');
  });
}

export function sortTask5LogicTreeLayerNodes(nodes: readonly LogicTreeLayerNode[]): LogicTreeLayerNode[] {
  return [...nodes].sort((a, b) => {
    const ra = task5LogicTreeNodeSortRank(a);
    const rb = task5LogicTreeNodeSortRank(b);
    if (ra.tier !== rb.tier) return ra.tier - rb.tier;
    if (ra.stageNum !== rb.stageNum) return ra.stageNum - rb.stageNum;
    return ra.tail.localeCompare(rb.tail, 'zh-CN');
  });
}

export function sortTask4LayerNodesInPlace(nodesByLayer: Map<string, LogicTreeLayerNode[]>): void {
  const layerKey = DESIGN_DETAIL_TASK4_LINE_TASK_ID;
  const list = nodesByLayer.get(layerKey);
  if (!list?.length) return;
  nodesByLayer.set(layerKey, sortTask4LogicTreeLayerNodes(list));
}

export function appendTask5OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<import('./designDetailLogicGraphMerge').DesignDetailLogicGraphTaskDto>,
  linkTargetFeatureIds: ReadonlySet<string>,
): void {
  const t5 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK5_LINE_TASK_ID);
  if (!t5) return;
  const layerKey = DESIGN_DETAIL_TASK5_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t5.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkTargetFeatureIds.has(fid) || seen.has(fid)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

export function sortTask5LayerNodesInPlace(nodesByLayer: Map<string, LogicTreeLayerNode[]>): void {
  const layerKey = DESIGN_DETAIL_TASK5_LINE_TASK_ID;
  const list = nodesByLayer.get(layerKey);
  if (!list?.length) return;
  nodesByLayer.set(layerKey, sortTask5LogicTreeLayerNodes(list));
}

/**
 * 任务 5.1 上未出现在链边端点集合中的价值主张 / 业务能力单元特征，追加到任务 5.1 层。
 */
export function appendTask51OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkEndpointFeatureIds: ReadonlySet<string>,
): void {
  const t51 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK51_LINE_TASK_ID);
  if (!t51) return;
  const layerKey = DESIGN_DETAIL_TASK51_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t51.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkEndpointFeatureIds.has(fid) || seen.has(fid)) continue;
    const key = resolveTask5LogicTreeFeatureKey({
      featureId: fid,
      taskId: layerKey,
      display: f,
    });
    if (
      !isTask51BusinessCapabilityUnitFeatureKey(key) &&
      !isTask51ValuePropositionFeatureKey(key)
    )
      continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

export function sortTask51LayerNodesInPlace(nodesByLayer: Map<string, LogicTreeLayerNode[]>): void {
  const layerKey = DESIGN_DETAIL_TASK51_LINE_TASK_ID;
  const list = nodesByLayer.get(layerKey);
  if (!list?.length) return;
  nodesByLayer.set(layerKey, flattenTask51TwoTierLayout(buildTask51TwoTierLayout(list)));
}

export function isTask52BusinessFieldSetFeatureKey(key: string): boolean {
  const k = String(key || '').trim();
  return k === '业务能力字段集' || k.startsWith('业务能力字段集/') || k.includes('业务能力字段集');
}

/**
 * 任务 5.2 上未出现在链边端点集合中的「业务能力字段集」特征，追加到任务 5.2 层。
 */
export function appendTask52OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkEndpointFeatureIds: ReadonlySet<string>,
): void {
  const t52 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK52_LINE_TASK_ID);
  if (!t52) return;
  const layerKey = DESIGN_DETAIL_TASK52_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t52.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkEndpointFeatureIds.has(fid) || seen.has(fid)) continue;
    const key = resolveTask5LogicTreeFeatureKey({
      featureId: fid,
      taskId: layerKey,
      display: f,
    });
    if (!isTask52BusinessFieldSetFeatureKey(key)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

export function sortTask52LayerNodesInPlace(nodesByLayer: Map<string, LogicTreeLayerNode[]>): void {
  const layerKey = DESIGN_DETAIL_TASK52_LINE_TASK_ID;
  const list = nodesByLayer.get(layerKey);
  if (!list?.length) return;
  nodesByLayer.set(
    layerKey,
    [...list].sort((a, b) =>
      String(a.display?.name ?? '').localeCompare(String(b.display?.name ?? ''), 'zh-CN'),
    ),
  );
}

/**
 * 任务 5.3 上未出现在链边端点集合中的「关键工作流」特征，追加到任务 5.3 层（5.2 收官后全量流程须可见）。
 */
export function appendTask53OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkEndpointFeatureIds: ReadonlySet<string>,
): void {
  const t53 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK53_LINE_TASK_ID);
  if (!t53) return;
  const layerKey = DESIGN_DETAIL_TASK53_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t53.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkEndpointFeatureIds.has(fid) || seen.has(fid)) continue;
    if (!isTask53WorkflowGraphFeatureRow(f)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

/**
 * 将 task-graph 中全部「关键工作流」特征并入本层（环节仅在卡内 chip 展示，不落独立可见节点）。
 */
export function mergeTask53AllFeatureNodesOntoLayer(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): void {
  const t53 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK53_LINE_TASK_ID);
  if (!t53) return;
  const layerKey = DESIGN_DETAIL_TASK53_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const list = nodesByLayer.get(layerKey)!;
  const seen = new Set(list.map((n) => n.featureId));
  for (const f of t53.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || seen.has(fid)) continue;
    if (!isTask53WorkflowGraphFeatureRow(f)) continue;
    seen.add(fid);
    list.push({
      featureId: fid,
      taskId: layerKey,
      display: { ...f },
    });
  }
}

export function sortTask53LayerNodesInPlace(nodesByLayer: Map<string, LogicTreeLayerNode[]>): void {
  const layerKey = DESIGN_DETAIL_TASK53_LINE_TASK_ID;
  const list = nodesByLayer.get(layerKey);
  if (!list?.length) return;
  const workflows = filterTask53WorkflowCardsForTreeDisplay(list);
  nodesByLayer.set(
    layerKey,
    [...workflows].sort((a, b) =>
      task53WorkflowCardTitle(a).localeCompare(task53WorkflowCardTitle(b), 'zh-CN'),
    ),
  );
}

/** 排序后移除本层「流程环节」独立卡，仅保留工作流卡（环节在卡内 chip + chip 锚点连边） */
export function stripTask53StepNodesFromLayerDisplay(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
): void {
  const layerKey = DESIGN_DETAIL_TASK53_LINE_TASK_ID;
  const list = nodesByLayer.get(layerKey);
  if (!list?.length) return;
  nodesByLayer.set(layerKey, filterTask53WorkflowCardsForTreeDisplay(list));
}

/**
 * 任务 5.5 上未出现在链边端点集合中的 `价值流阶段_*` 特征，追加到任务 5.5 层（与任务 2/3/4/5 孤儿补全对称）。
 * 落库 5 个阶段但仅有 2 条正向归纳边时，其余 3 个阶段须靠本函数展示，否则会「推理 5 个、Tree 只 2 个」。
 */
export function appendTask55OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkEndpointFeatureIds: ReadonlySet<string>,
): void {
  const t55 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK55_LINE_TASK_ID);
  if (!t55) return;
  const layerKey = DESIGN_DETAIL_TASK55_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t55.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkEndpointFeatureIds.has(fid) || seen.has(fid)) continue;
    const key = resolveTask5LogicTreeFeatureKey({
      featureId: fid,
      taskId: layerKey,
      display: f,
    });
    if (!isTask5ValueStreamStageFeatureKey(key)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

export function sortTask55LayerNodesInPlace(nodesByLayer: Map<string, LogicTreeLayerNode[]>): void {
  const layerKey = DESIGN_DETAIL_TASK55_LINE_TASK_ID;
  const list = nodesByLayer.get(layerKey);
  if (!list?.length) return;
  nodesByLayer.set(layerKey, sortTask5LogicTreeLayerNodes(list));
}

function isTask6ScenarioFeatureKey(key: string): boolean {
  const k = String(key || '').trim();
  if (k === '关键场景') return true;
  return /^关键场景[_\s]*(\d+)/i.test(k);
}

function sortTask6LogicTreeLayerNodes(list: LogicTreeLayerNode[]): LogicTreeLayerNode[] {
  return [...list].sort((a, b) => {
    const ka = resolveTask5LogicTreeFeatureKey(a);
    const kb = resolveTask5LogicTreeFeatureKey(b);
    const na = parseInt(ka.match(/关键场景[_\s]*(\d+)/i)?.[1] ?? '0', 10);
    const nb = parseInt(kb.match(/关键场景[_\s]*(\d+)/i)?.[1] ?? '0', 10);
    if (na !== nb) return na - nb;
    const va = String(a.display?.name ?? '').trim();
    const vb = String(b.display?.name ?? '').trim();
    return va.localeCompare(vb, 'zh-CN') || a.featureId.localeCompare(b.featureId, 'zh-CN');
  });
}

/** 任务 6 层未出现在链端点上的「关键场景」特征补全 */
export function appendTask6OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkEndpointFeatureIds: ReadonlySet<string>,
): void {
  const t6 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK6_LINE_TASK_ID);
  if (!t6) return;
  const layerKey = DESIGN_DETAIL_TASK6_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t6.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkEndpointFeatureIds.has(fid) || seen.has(fid)) continue;
    const key = resolveTask5LogicTreeFeatureKey({
      featureId: fid,
      taskId: layerKey,
      display: f,
    });
    if (!isTask6ScenarioFeatureKey(key)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

export function sortTask6LayerNodesInPlace(nodesByLayer: Map<string, LogicTreeLayerNode[]>): void {
  const layerKey = DESIGN_DETAIL_TASK6_LINE_TASK_ID;
  const list = nodesByLayer.get(layerKey);
  if (!list?.length) return;
  nodesByLayer.set(layerKey, sortTask6LogicTreeLayerNodes(list));
}

/** 任务 6.5 层未出现在链端点上的三维 Gap 特征补全 */
export function appendTask65OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkEndpointFeatureIds: ReadonlySet<string>,
): void {
  const t65 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK65_LINE_TASK_ID);
  if (!t65) return;
  const layerKey = DESIGN_DETAIL_TASK65_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t65.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkEndpointFeatureIds.has(fid) || seen.has(fid)) continue;
    const key = resolveTask5LogicTreeFeatureKey({
      featureId: fid,
      taskId: layerKey,
      display: f,
    });
    if (!isTask65GapFeatureKey(key)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

export function sortTask65LayerNodesInPlace(nodesByLayer: Map<string, LogicTreeLayerNode[]>): void {
  const layerKey = DESIGN_DETAIL_TASK65_LINE_TASK_ID;
  const list = nodesByLayer.get(layerKey);
  if (!list?.length) return;
  nodesByLayer.set(layerKey, flattenTask65ThreeGapBoxLayout(buildTask65ThreeGapBoxLayout(list)));
}

function isTask7L4CollaborationFeatureKey(key: string): boolean {
  const k = String(key || '').trim();
  return k === '所属业务流程' || k === '协作节点';
}

function sortTask7LogicTreeLayerNodes(list: LogicTreeLayerNode[]): LogicTreeLayerNode[] {
  return [...list].sort((a, b) => {
    const ka = resolveTask5LogicTreeFeatureKey(a);
    const kb = resolveTask5LogicTreeFeatureKey(b);
    const flowA = ka === '所属业务流程' ? 0 : 1;
    const flowB = kb === '所属业务流程' ? 0 : 1;
    if (flowA !== flowB) return flowA - flowB;
    const va = String(a.display?.name ?? '').trim();
    const vb = String(b.display?.name ?? '').trim();
    return va.localeCompare(vb, 'zh-CN') || a.featureId.localeCompare(b.featureId, 'zh-CN');
  });
}

/** 任务 7 层未出现在链端点上的 L4 特征补全 */
export function appendTask7OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkEndpointFeatureIds: ReadonlySet<string>,
): void {
  const t7 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK7_LINE_TASK_ID);
  if (!t7) return;
  const layerKey = DESIGN_DETAIL_TASK7_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t7.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkEndpointFeatureIds.has(fid) || seen.has(fid)) continue;
    const key = resolveTask5LogicTreeFeatureKey({
      featureId: fid,
      taskId: layerKey,
      display: f,
    });
    if (!isTask7L4CollaborationFeatureKey(key)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

export function sortTask7LayerNodesInPlace(nodesByLayer: Map<string, LogicTreeLayerNode[]>): void {
  const layerKey = DESIGN_DETAIL_TASK7_LINE_TASK_ID;
  const list = nodesByLayer.get(layerKey);
  if (!list?.length) return;
  nodesByLayer.set(layerKey, sortTask7LogicTreeLayerNodes(list));
}

/** 任务 8 层：与任务 6 类似，平铺展示三类原型特征 */
const TASK8_PROTOTYPE_FEATURE_KEY_ORDER: Record<string, number> = {
  操作角色: 0,
  单据对象: 1,
  状态转移矩阵: 2,
};

function isTask8L45PrototypeFeatureKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(TASK8_PROTOTYPE_FEATURE_KEY_ORDER, String(key || '').trim());
}

function logicTreeLinkSourceFeatureId(l: DesignDetailLogicGraphLinkDto): string {
  return String(l.sourceFeatureId ?? l.source?.featureId ?? '').trim();
}

function logicTreeLinkTargetFeatureId(l: DesignDetailLogicGraphLinkDto): string {
  return String(l.targetFeatureId ?? l.target?.featureId ?? '').trim();
}

/** 任务 7 协作节点序（扁平层内序，仅作未传入 Tree 视觉序时的回退） */
function buildTask7CollaborationNodeOrderIndexFallback(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
): Map<string, number> {
  const out = new Map<string, number>();
  const t7 = nodesByLayer.get(DESIGN_DETAIL_TASK7_LINE_TASK_ID) ?? [];
  let i = 0;
  for (const n of t7) {
    if (resolveTask5LogicTreeFeatureKey(n) !== '协作节点') continue;
    out.set(n.featureId, i);
    i += 1;
  }
  return out;
}

/**
 * 任务 8 特征 → 上游任务 7「协作节点」在层内的锚点序（取多条正向边中最靠前的协作节点索引）。
 */
function resolveTask8UpstreamCollaborationSortRank(
  task8FeatureId: string,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  fidToTask: Map<string, string>,
  t7CollabOrder: Map<string, number>,
): number {
  const UNKNOWN_RANK = 1_000_000;
  let best = UNKNOWN_RANK;
  const tid8 = String(task8FeatureId || '').trim();
  if (!tid8) return UNKNOWN_RANK;
  for (const L of links) {
    const tgt = logicTreeLinkTargetFeatureId(L);
    const src = logicTreeLinkSourceFeatureId(L);
    if (tgt !== tid8 || !src) continue;
    if (fidToTask.get(src) !== DESIGN_DETAIL_TASK7_LINE_TASK_ID) continue;
    const idx = t7CollabOrder.get(src);
    if (idx !== undefined && idx < best) best = idx;
  }
  return best;
}

function sortTask8LogicTreeLayerNodes(
  list: LogicTreeLayerNode[],
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  fidToTask: Map<string, string>,
  t7CollabOrder: Map<string, number>,
): LogicTreeLayerNode[] {
  return [...list].sort((a, b) => {
    const ra = resolveTask8UpstreamCollaborationSortRank(a.featureId, links, fidToTask, t7CollabOrder);
    const rb = resolveTask8UpstreamCollaborationSortRank(b.featureId, links, fidToTask, t7CollabOrder);
    if (ra !== rb) return ra - rb;
    const ka = resolveTask5LogicTreeFeatureKey(a);
    const kb = resolveTask5LogicTreeFeatureKey(b);
    const oa = TASK8_PROTOTYPE_FEATURE_KEY_ORDER[ka] ?? 9;
    const ob = TASK8_PROTOTYPE_FEATURE_KEY_ORDER[kb] ?? 9;
    if (oa !== ob) return oa - ob;
    const va = String(a.display?.name ?? '').trim();
    const vb = String(b.display?.name ?? '').trim();
    return va.localeCompare(vb, 'zh-CN') || a.featureId.localeCompare(b.featureId, 'zh-CN');
  });
}

/** 任务 8 层未出现在链端点上的 L4.5 特征补全 */
export function appendTask8OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkEndpointFeatureIds: ReadonlySet<string>,
): void {
  const t8 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK8_LINE_TASK_ID);
  if (!t8) return;
  const layerKey = DESIGN_DETAIL_TASK8_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t8.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkEndpointFeatureIds.has(fid) || seen.has(fid)) continue;
    const key = resolveTask5LogicTreeFeatureKey({
      featureId: fid,
      taskId: layerKey,
      display: f,
    });
    if (!isTask8L45PrototypeFeatureKey(key)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

/** 任务 8.5 L4.7 技术集成特征键（含三键新版 + 历史三键 + 旧别名） */
const TASK85_L47_FEATURE_KEY_ORDER: Record<string, number> = {
  数据承载层: 0,
  技术组件映射: 0,
  微观连接器绑定: 0,
  衔接互动层: 1,
  自动化流Hook: 1,
  物理外挂Hook: 1,
  界面交互层: 2,
  前端交互载体: 2,
  工具方案裁决: 2,
};

function isTask85L47IntegrationFeatureKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(TASK85_L47_FEATURE_KEY_ORDER, String(key || '').trim());
}

/** 任务 8.5 层未出现在链端点上的 L4.7 特征补全 */
export function appendTask85OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkEndpointFeatureIds: ReadonlySet<string>,
): void {
  const t85 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK85_LINE_TASK_ID);
  if (!t85) return;
  const layerKey = DESIGN_DETAIL_TASK85_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t85.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkEndpointFeatureIds.has(fid) || seen.has(fid)) continue;
    const key = resolveTask5LogicTreeFeatureKey({
      featureId: fid,
      taskId: layerKey,
      display: f,
    });
    if (!isTask85L47IntegrationFeatureKey(key)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

function sortTask85LogicTreeLayerNodes(list: LogicTreeLayerNode[]): LogicTreeLayerNode[] {
  return [...list].sort((a, b) => {
    const ka = resolveTask5LogicTreeFeatureKey(a);
    const kb = resolveTask5LogicTreeFeatureKey(b);
    const oa = TASK85_L47_FEATURE_KEY_ORDER[ka] ?? 9;
    const ob = TASK85_L47_FEATURE_KEY_ORDER[kb] ?? 9;
    if (oa !== ob) return oa - ob;
    const va = String(a.display?.name ?? '').trim();
    const vb = String(b.display?.name ?? '').trim();
    return va.localeCompare(vb, 'zh-CN') || a.featureId.localeCompare(b.featureId, 'zh-CN');
  });
}

/** 任务 8.5 层内排序：数据承载层 → 衔接互动层 → 界面交互层（与历史键同序合并） */
export function sortTask85LayerNodesInPlace(nodesByLayer: Map<string, LogicTreeLayerNode[]>): void {
  const layerKey = DESIGN_DETAIL_TASK85_LINE_TASK_ID;
  const list = nodesByLayer.get(layerKey);
  if (!list?.length) return;
  nodesByLayer.set(layerKey, sortTask85LogicTreeLayerNodes(list));
}

/**
 * 任务 8 层内排序：先按上游任务 7「协作节点」Tree 左→右锚点聚邻，组内再按 操作角色→单据对象→状态转移矩阵。
 * 须在 `sortTask7LayerNodesInPlace` 之后调用；`t7CollabOrder` 宜由 Modal 用 `buildTask7CollaborationNodesInTreeVisualOrder` 构建。
 */
export function sortTask8LayerNodesInPlace(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto> = [],
  fidToTask: Map<string, string> = new Map(),
  t7CollabOrder?: Map<string, number>,
): void {
  const layerKey = DESIGN_DETAIL_TASK8_LINE_TASK_ID;
  const list = nodesByLayer.get(layerKey);
  if (!list?.length) return;
  const order = t7CollabOrder ?? buildTask7CollaborationNodeOrderIndexFallback(nodesByLayer);
  nodesByLayer.set(layerKey, sortTask8LogicTreeLayerNodes(list, links, fidToTask, order));
}

const TASK9_L5_FEATURE_KEY_ORDER: Record<string, number> = {
  系统一级模块: 0,
  二级功能菜单: 1,
};

function isTask9L5BlueprintFeatureKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(TASK9_L5_FEATURE_KEY_ORDER, String(key || '').trim());
}

function buildTask85FeatureOrderIndexForTask9(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
): Map<string, number> {
  const out = new Map<string, number>();
  const t85 = nodesByLayer.get(DESIGN_DETAIL_TASK85_LINE_TASK_ID) ?? [];
  let i = 0;
  for (const n of t85) {
    out.set(n.featureId, i);
    i += 1;
  }
  return out;
}

function resolveTask9UpstreamTask85SortRank(
  task9FeatureId: string,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  fidToTask: Map<string, string>,
  t85Order: Map<string, number>,
): number {
  const UNKNOWN_RANK = 1_000_000;
  let best = UNKNOWN_RANK;
  const tid9 = String(task9FeatureId || '').trim();
  if (!tid9) return UNKNOWN_RANK;
  for (const L of links) {
    const tgt = logicTreeLinkTargetFeatureId(L);
    const src = logicTreeLinkSourceFeatureId(L);
    if (tgt !== tid9 || !src) continue;
    if (fidToTask.get(src) !== DESIGN_DETAIL_TASK85_LINE_TASK_ID) continue;
    const idx = t85Order.get(src);
    if (idx !== undefined && idx < best) best = idx;
  }
  return best;
}

function sortTask9LogicTreeLayerNodes(
  list: LogicTreeLayerNode[],
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  fidToTask: Map<string, string>,
  t85Order: Map<string, number>,
): LogicTreeLayerNode[] {
  return [...list].sort((a, b) => {
    const ra = resolveTask9UpstreamTask85SortRank(a.featureId, links, fidToTask, t85Order);
    const rb = resolveTask9UpstreamTask85SortRank(b.featureId, links, fidToTask, t85Order);
    if (ra !== rb) return ra - rb;
    const ka = resolveTask5LogicTreeFeatureKey(a);
    const kb = resolveTask5LogicTreeFeatureKey(b);
    const oa = TASK9_L5_FEATURE_KEY_ORDER[ka] ?? 9;
    const ob = TASK9_L5_FEATURE_KEY_ORDER[kb] ?? 9;
    if (oa !== ob) return oa - ob;
    const va = String(a.display?.name ?? '').trim();
    const vb = String(b.display?.name ?? '').trim();
    return va.localeCompare(vb, 'zh-CN') || a.featureId.localeCompare(b.featureId, 'zh-CN');
  });
}

/** 任务 9 层未出现在链端点上的 L5 特征补全 */
export function appendTask9OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  linkEndpointFeatureIds: ReadonlySet<string>,
): void {
  const t9 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK9_LINE_TASK_ID);
  if (!t9) return;
  const layerKey = DESIGN_DETAIL_TASK9_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t9.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || linkEndpointFeatureIds.has(fid) || seen.has(fid)) continue;
    const key = resolveTask5LogicTreeFeatureKey({
      featureId: fid,
      taskId: layerKey,
      display: f,
    });
    if (!isTask9L5BlueprintFeatureKey(key)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

/**
 * 任务 9 层内排序：先按上游任务 8.5 锚点聚邻，组内按系统一级模块名称。
 */
export function sortTask9LayerNodesInPlace(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto> = [],
  fidToTask: Map<string, string> = new Map(),
  t85Order?: Map<string, number>,
): void {
  const layerKey = DESIGN_DETAIL_TASK9_LINE_TASK_ID;
  const list = nodesByLayer.get(layerKey);
  if (!list?.length) return;
  const order = t85Order ?? buildTask85FeatureOrderIndexForTask9(nodesByLayer);
  nodesByLayer.set(layerKey, sortTask9LogicTreeLayerNodes(list, links, fidToTask, order));
}

const TASK10_L5_FEATURE_KEYS = new Set([
  '物理技术Schema',
  '物理表结构Schema',
  '物理表字段',
  '跨平台接口同步Schema',
  '基础表初始化',
  '权限字典初始化SQL',
]);

function isTask10L5TechnicalDdlFeatureKey(key: string): boolean {
  return TASK10_L5_FEATURE_KEYS.has(String(key || '').trim());
}

/** 任务 10 层：从 `tasks[].features` 补全 L5 节点（不依赖 linkEndpointFeatureIds，避免链端点已登记但未入层） */
export function appendTask10OrphanEndpointNodes(
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  _linkEndpointFeatureIds: ReadonlySet<string>,
): void {
  const t10 = tasks.find((t) => {
    const raw = String(t?.taskId || '').trim();
    return normLogicTaskId(raw) === DESIGN_DETAIL_TASK10_LINE_TASK_ID || raw.includes('任务 10');
  });
  if (!t10) return;
  const layerKey = DESIGN_DETAIL_TASK10_LINE_TASK_ID;
  if (!nodesByLayer.has(layerKey)) nodesByLayer.set(layerKey, []);
  const seen = new Set(nodesByLayer.get(layerKey)!.map((n) => n.featureId));
  for (const f of t10.features ?? []) {
    const fid = String(f.featureId || '').trim();
    if (!fid || seen.has(fid)) continue;
    const key = resolveTask5LogicTreeFeatureKey({
      featureId: fid,
      taskId: layerKey,
      display: f,
    });
    if (!isTask10L5TechnicalDdlFeatureKey(key)) continue;
    seen.add(fid);
    nodesByLayer.get(layerKey)!.push({
      featureId: fid,
      taskId: layerKey,
      orphan: true,
      display: { ...f },
    });
  }
}

/**
 * 每层 `n` 个节点时，第 `index`（0-based）个节点槽位中心水平位置（百分比），用于 `left` + `translateX(-50%)` 等距。
 */
export function evenLayerSlotLeftPercent(index: number, total: number): string {
  if (total <= 0) return '50%';
  if (total === 1) return '50%';
  return `${((index + 1) / (total + 1)) * 100}%`;
}

/**
 * 每层轨道用于横向滚动的最小宽度（px），保证多节点时可横向滚动。
 * 与 `DesignDetailLogicTreeModal` 中 `.dd-tree-node-slot` 同口径：相对原设计 **×0.7** 后再 **×0.85**（再缩窄 15%），合 **×0.595**；`slotPx` 与整体下限同比例。
 */
const LOGIC_TREE_LAYER_TRACK_SLOT_PX = Math.round(136 * 0.7 * 0.85); // 81，由 95 再 ×0.85
const LOGIC_TREE_LAYER_TRACK_MIN_FLOOR_PX = Math.round(520 * 0.7 * 0.85); // 309，由 364 再 ×0.85

export function logicTreeLayerTrackMinWidthPx(nodeCount: number): number {
  const n = Math.max(0, Math.ceil(nodeCount));
  return Math.max(LOGIC_TREE_LAYER_TRACK_MIN_FLOOR_PX, n * LOGIC_TREE_LAYER_TRACK_SLOT_PX);
}
