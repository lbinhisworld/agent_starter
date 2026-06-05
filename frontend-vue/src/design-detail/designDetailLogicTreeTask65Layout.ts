/**
 * [INPUT]: 任务 6.5 层 `LogicTreeLayerNode`、逻辑边
 * [OUTPUT]: 三维 Gap 分框布局（交互体验 / 数据管理 / 计算分析）；每框 5 列栅格换行；轨道最小宽度
 * [POS]: `DesignDetailLogicTreeModal.vue` 任务 6.5 层专用渲染（仅展示 feature id 短标签）
 *
 * [PROTOCOL]: 与 `expandTask65L3ItGapRowsToGapFeatureRows` 落库键「交互体验 gap」「数据管理 gap」「计算分析 gap」对齐
 */

import type { DesignDetailLogicGraphFeatureDto } from './designDetailLogicGraphMerge';
import { resolveTask5LogicTreeFeatureKey, type LogicTreeLayerNode } from './designDetailLogicTreeLayout';

export const TASK65_LOGIC_TREE_NODES_PER_ROW = 5;
export const TASK65_LOGIC_TREE_GAP_BOX_GAP_PX = 16;
export const TASK65_LOGIC_TREE_NODE_SLOT_WIDTH_PX = 76;
export const TASK65_LOGIC_TREE_NODE_ROW_GAP_PX = 8;
export const TASK65_LOGIC_TREE_BOX_PAD_PX = 12;

export type Task65GapDimension = 'interaction' | 'data' | 'calculation';

export type Task65GapBox = {
  dimension: Task65GapDimension;
  title: string;
  nodes: LogicTreeLayerNode[];
};

const TASK65_GAP_FEATURE_KEY_TO_DIMENSION: Record<string, Task65GapDimension> = {
  '交互体验 gap': 'interaction',
  '数据管理 gap': 'data',
  '计算分析 gap': 'calculation',
};

export function isTask65GapFeatureKey(key: string): boolean {
  return key in TASK65_GAP_FEATURE_KEY_TO_DIMENSION;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const s = String(raw || '').trim();
  if (!s || (!s.startsWith('{') && !s.startsWith('['))) return null;
  try {
    return asRecord(JSON.parse(s));
  } catch {
    return null;
  }
}

export function parseTask65FeatureValueRoot(
  display: DesignDetailLogicGraphFeatureDto,
): Record<string, unknown> | null {
  const raw = display.featureValue ?? display.feature_value;
  if (raw == null) {
    const name = display.name;
    if (typeof name === 'object' && name !== null) return asRecord(name);
    if (typeof name === 'string') return parseJsonObject(name);
    return null;
  }
  if (typeof raw === 'string') return parseJsonObject(raw);
  return asRecord(raw);
}

function task65StepSortKey(node: LogicTreeLayerNode): string {
  const fv = parseTask65FeatureValueRoot(node.display);
  const phase = String(fv?.targeted_value_phase ?? fv?.Targeted_Value_Phase ?? '').trim();
  const step = String(
    fv?.current_process_step_name ?? fv?.Current_Process_Step_Name ?? '',
  ).trim();
  const wf = String(fv?.optimized_workflow_segment ?? fv?.Optimized_Workflow_Segment ?? '').trim();
  return `${phase}\t${wf}\t${step}`;
}

function sortTask65GapNodes(list: readonly LogicTreeLayerNode[]): LogicTreeLayerNode[] {
  return [...list].sort(
    (a, b) =>
      task65StepSortKey(a).localeCompare(task65StepSortKey(b), 'zh-CN') ||
      a.featureId.localeCompare(b.featureId, 'zh-CN'),
  );
}

/** 将任务 6.5 层节点归入三个 Gap 维度大框（固定左→右顺序） */
export function buildTask65ThreeGapBoxLayout(nodes: readonly LogicTreeLayerNode[]): Task65GapBox[] {
  const buckets: Record<Task65GapDimension, LogicTreeLayerNode[]> = {
    interaction: [],
    data: [],
    calculation: [],
  };
  const other: LogicTreeLayerNode[] = [];
  for (const n of nodes) {
    const key = resolveTask5LogicTreeFeatureKey(n);
    const dim = TASK65_GAP_FEATURE_KEY_TO_DIMENSION[key];
    if (dim) buckets[dim].push(n);
    else other.push(n);
  }
  if (other.length) buckets.data.push(...other);
  return [
    { dimension: 'interaction', title: '交互体验 gap', nodes: sortTask65GapNodes(buckets.interaction) },
    { dimension: 'data', title: '数据管理 gap', nodes: sortTask65GapNodes(buckets.data) },
    {
      dimension: 'calculation',
      title: '计算分析 gap',
      nodes: sortTask65GapNodes(buckets.calculation),
    },
  ];
}

export function flattenTask65ThreeGapBoxLayout(boxes: Task65GapBox[]): LogicTreeLayerNode[] {
  return boxes.flatMap((b) => b.nodes);
}

/** 单框内按每行 5 个节点分块 */
export function chunkTask65GapNodesForGrid(nodes: readonly LogicTreeLayerNode[]): LogicTreeLayerNode[][] {
  const out: LogicTreeLayerNode[][] = [];
  for (let i = 0; i < nodes.length; i += TASK65_LOGIC_TREE_NODES_PER_ROW) {
    out.push(nodes.slice(i, i + TASK65_LOGIC_TREE_NODES_PER_ROW));
  }
  return out;
}

export function logicTreeTask65LayerTrackMinWidthPx(boxes: readonly Task65GapBox[]): number {
  const maxInBox = Math.max(0, ...boxes.map((b) => b.nodes.length));
  const rowCount = Math.max(1, Math.ceil(maxInBox / TASK65_LOGIC_TREE_NODES_PER_ROW));
  const boxInnerWidth =
    TASK65_LOGIC_TREE_NODES_PER_ROW * TASK65_LOGIC_TREE_NODE_SLOT_WIDTH_PX +
    (TASK65_LOGIC_TREE_NODES_PER_ROW - 1) * TASK65_LOGIC_TREE_NODE_ROW_GAP_PX;
  const boxHeightPad = rowCount * 48 + (rowCount - 1) * TASK65_LOGIC_TREE_NODE_ROW_GAP_PX;
  void boxHeightPad;
  const threeBoxes =
    3 * (boxInnerWidth + TASK65_LOGIC_TREE_BOX_PAD_PX * 2) + 2 * TASK65_LOGIC_TREE_GAP_BOX_GAP_PX;
  return Math.max(threeBoxes, 420);
}
