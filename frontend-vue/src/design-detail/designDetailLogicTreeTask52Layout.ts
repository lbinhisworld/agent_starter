/**
 * [INPUT]: 任务 5.2 层 `LogicTreeLayerNode.display`（含 `featureValue.fields_schema_tree`）
 * [OUTPUT]: 字段集卡标题、字段名标签行解析与分块；卡宽 `TASK52_LOGIC_TREE_CARD_WIDTH_PX`（260）
 * [POS]: `DesignDetailLogicTreeModal.vue` 任务 5.2「业务能力字段集」节点专用渲染
 *
 * [PROTOCOL]: 与 `designDetailL52AssetFieldSetSystemPrompt.js`、`designDetailTask52InferenceConclusionFormat.ts` 行内 `fields_schema_tree` 契约对齐；**GET task-graph** 须对任务 5.2 暴露 `featureValue`（见后端 `taskGraphShouldExposeRawFeatureValue`）；**5.1 业务能力单元→5.2 字段集** 正向归纳边见 **`buildTask52CapabilityUnitToFieldSetForwardLinks`**（后端）与 **`synthesizeTask52CapabilityToFieldSetGraphLinks`**（Tree 兜底）；**卡宽 / 轨道最小宽度** 须与 Modal `--dd-task52-*` 一致
 */

import {
  DESIGN_DETAIL_TASK51_LINE_TASK_ID,
  DESIGN_DETAIL_TASK52_LINE_TASK_ID,
  type DesignDetailLogicGraphFeatureDto,
  type DesignDetailLogicGraphLinkDto,
  type DesignDetailLogicGraphTaskDto,
  normLogicTaskId,
} from './designDetailLogicGraphMerge';
import {
  formatLogicTreeFeatureValueLine,
  type LogicTreeLayerNode,
} from './designDetailLogicTreeLayout';
import {
  buildTask51TwoTierLayout,
  isTask51CapabilityUnitNode,
} from './designDetailLogicTreeTask51Layout';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';

type Task52FieldSetGraphFeatureLike = DesignDetailLogicGraphFeatureDto | Task2L1TaskGraphFeatureRow;

/** 逻辑树字段集卡内字段名圆角标签：每行个数 */
export const TASK52_LOGIC_TREE_FIELD_TAGS_PER_ROW = 3;

/** 单张字段集卡固定宽度（px）；层轨道 `logicTreeTask52LayerTrackMinWidthPx` 同口径（较初版 520 缩窄 50%） */
export const TASK52_LOGIC_TREE_CARD_WIDTH_PX = 260;

const TASK52_LOGIC_TREE_TRACK_GAP_PX = 10;
const TASK52_LOGIC_TREE_TRACK_PAD_PX = 24;

export type Task52FieldSchemaLeaf = {
  fieldName: string;
  dataType: string;
  sourceFeatureId: string;
  /** 可选；用于主键判定（`constraints` 含「主键」等） */
  constraints?: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const s = String(raw || '').trim();
  if (!s || (!s.startsWith('{') && !s.startsWith('['))) return null;
  try {
    const v = JSON.parse(s);
    return asRecord(v);
  } catch {
    return null;
  }
}

function readFieldsSchemaTreeArray(root: Record<string, unknown>): unknown[] {
  const tree =
    root.fields_schema_tree ??
    root.fieldsSchemaTree ??
    root.Fields_Schema_Tree;
  return Array.isArray(tree) ? tree : [];
}

/** 解析节点落库 `DesignFeatureNode.value`（须 task-graph 下发 `features[].featureValue`） */
export function parseTask52FeatureValueRoot(
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

function readFeatureValueTitle(root: Record<string, unknown>): string {
  const v =
    root.Feature_Value ??
    root.feature_value ??
    root.featureValue;
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object') {
    const inner = asRecord(v);
    if (inner) return readFeatureValueTitle(inner);
  }
  return String(v).trim();
}

/** 从 `featureValue` / `name` 解析字段集切片标题（`Feature_Value`） */
export function task52FieldSetTitleFromDisplay(
  display: DesignDetailLogicGraphFeatureDto,
): string {
  const root = parseTask52FeatureValueRoot(display);
  if (root) {
    const t = readFeatureValueTitle(root);
    if (t) return t;
  }
  const line = formatLogicTreeFeatureValueLine(display.name);
  return line === '—' ? '（未命名字段集）' : line;
}

/** 字段集节点主标题（`Feature_Value` 切片语义名） */
export function task52FieldSetCardTitle(node: LogicTreeLayerNode): string {
  return task52FieldSetTitleFromDisplay(node.display);
}

/** 是否为任务 5.2「业务能力字段集」特征行（供 5.2/5.3 送模与 Tree 孤儿补全共用） */
export function isTask52FieldSetGraphFeatureRow(display: Task52FieldSetGraphFeatureLike): boolean {
  const tok = String(display.tokenDisplay ?? display.token_display ?? '').trim();
  const head = tok && tok !== '—' ? (tok.split(/\s*·\s*/)[0]?.trim() ?? tok) : '';
  if (head === '业务能力字段集' || head.startsWith('业务能力字段集/') || head.includes('业务能力字段集')) {
    return true;
  }
  const theme = String(display.themeKey ?? display.theme_key ?? '').trim();
  if (theme === '业务能力字段集') return true;
  const nm = String(display.name ?? '').trim();
  if (nm === '业务能力字段集' || nm.startsWith('业务能力字段集/') || nm.includes('业务能力字段集')) {
    return true;
  }
  const root = parseTask52FeatureValueRoot(display as DesignDetailLogicGraphFeatureDto);
  if (root) {
    const tree = readFieldsSchemaTreeArray(root);
    if (tree.length > 0) return true;
    const acu = String(
      root.associated_capability_unit ??
        root.associatedCapabilityUnit ??
        '',
    ).trim();
    if (acu.length > 0) return true;
  }
  return false;
}

/** 自 task-graph 特征行解析 `fields_schema_tree` 叶子（保持模型顺序） */
export function task52FieldSchemaLeavesFromDisplay(
  display: DesignDetailLogicGraphFeatureDto,
): Task52FieldSchemaLeaf[] {
  const root = parseTask52FeatureValueRoot(display);
  if (!root) return [];
  const out: Task52FieldSchemaLeaf[] = [];
  for (const item of readFieldsSchemaTreeArray(root)) {
    const leaf = readFieldLeaf(item);
    if (leaf) out.push(leaf);
  }
  return out;
}

function readFieldLeaf(item: unknown): Task52FieldSchemaLeaf | null {
  const row = asRecord(item);
  if (!row) return null;
  const fieldName = String(row.field_name ?? row.fieldName ?? row['字段名'] ?? '').trim();
  if (!fieldName) return null;
  const dataType = String(row.data_type ?? row.dataType ?? '').trim();
  const constraints = String(row.constraints ?? row['约束'] ?? '').trim();
  return {
    fieldName,
    dataType,
    sourceFeatureId: String(row.source_feature_id ?? row.sourceFeatureId ?? '').trim(),
    constraints,
  };
}

/** `fields_schema_tree` 叶子是否为主键字段（与 5.2 提示词 `data_type=主键` 及 ER 图口径一致） */
export function isTask52SchemaFieldPrimaryKey(dataType: string, constraints?: string): boolean {
  const dt = String(dataType ?? '').trim();
  if (dt === '主键') return true;
  const c = String(constraints ?? '').trim();
  if (/主键/u.test(c) && !/外键/u.test(c)) return true;
  return /主键/u.test(dt) && !/外键/u.test(dt);
}

/** 自节点 value 解析 `fields_schema_tree` 叶子列表（保持模型顺序） */
export function task52FieldSchemaLeavesFromNode(node: LogicTreeLayerNode): Task52FieldSchemaLeaf[] {
  return task52FieldSchemaLeavesFromDisplay(node.display);
}

/** 按每行 N 个字段标签分块（默认 3） */
export function chunkTask52FieldTagsForGrid(
  leaves: readonly Task52FieldSchemaLeaf[],
  perRow: number = TASK52_LOGIC_TREE_FIELD_TAGS_PER_ROW,
): Task52FieldSchemaLeaf[][] {
  const n = Math.max(1, Math.floor(perRow));
  const rows: Task52FieldSchemaLeaf[][] = [];
  for (let i = 0; i < leaves.length; i += n) {
    rows.push(leaves.slice(i, i + n));
  }
  return rows;
}

export function task52FieldTagRowKey(row: readonly Task52FieldSchemaLeaf[], rowIndex: number): string {
  const body = row.map((l) => l.sourceFeatureId || l.fieldName).join('|');
  return `t52-row-${rowIndex}-${body || 'empty'}`;
}

export function task52FieldTagTooltip(leaf: Task52FieldSchemaLeaf): string {
  const parts = [leaf.fieldName];
  if (leaf.dataType) parts.push(leaf.dataType);
  if (leaf.sourceFeatureId) parts.push(leaf.sourceFeatureId);
  return parts.join(' · ');
}

/** 节点字段标签占用行数（每行 1 个；无字段时为 0） */
export function task52FieldTagRowCountForNode(node: LogicTreeLayerNode): number {
  const n = task52FieldSchemaLeavesFromNode(node).length;
  if (n <= 0) return 0;
  return Math.ceil(n / TASK52_LOGIC_TREE_FIELD_TAGS_PER_ROW);
}

/** 层内最大标签行数（用于统一卡高；至少 1 行占位） */
export function task52MaxFieldTagRowCount(nodes: ReadonlyArray<LogicTreeLayerNode>): number {
  let max = 1;
  for (const node of nodes) {
    max = Math.max(max, task52FieldTagRowCountForNode(node));
  }
  return max;
}

/** 相对本层最大行数，节点需补的空白标签行数（统一栅格高度） */
export function task52FieldTagPaddingRowCount(
  node: LogicTreeLayerNode,
  maxRows: number,
): number {
  const actual = task52FieldTagRowCountForNode(node);
  return Math.max(0, maxRows - actual);
}

/** 任务 5.2 层横向轨道最小宽度（px） */
export function logicTreeTask52LayerTrackMinWidthPx(nodeCount: number): number {
  const n = Math.max(1, Math.ceil(nodeCount));
  const gaps = Math.max(0, n - 1) * TASK52_LOGIC_TREE_TRACK_GAP_PX;
  return n * TASK52_LOGIC_TREE_CARD_WIDTH_PX + gaps + TASK52_LOGIC_TREE_TRACK_PAD_PX;
}

/** 读字段集行 `associated_capability_unit`（落库在 `featureValue` 对象内） */
export function task52AssociatedCapabilityUnitFromDisplay(
  display: DesignDetailLogicGraphFeatureDto,
): string {
  const root = parseTask52FeatureValueRoot(display);
  if (!root) return '';
  const v =
    root.associated_capability_unit ??
    root.associatedCapabilityUnit ??
    getPropertyCI(root, 'associated_capability_unit', 'associatedCapabilityUnit');
  return v == null ? '' : String(v).trim();
}

function getPropertyCI(
  rec: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const k of keys) {
    if (rec[k] !== undefined) return rec[k];
    const norm = k.replace(/\s+/g, '_').toLowerCase();
    for (const [rk, rv] of Object.entries(rec)) {
      if (rk.replace(/\s+/g, '_').toLowerCase() === norm) return rv;
    }
  }
  return undefined;
}

function linkEndpointPairKey(
  l: Pick<DesignDetailLogicGraphLinkDto, 'sourceFeatureId' | 'targetFeatureId' | 'source' | 'target'>,
): string {
  const sid = String(l.sourceFeatureId ?? l.source?.featureId ?? '').trim();
  const tid = String(l.targetFeatureId ?? l.target?.featureId ?? '').trim();
  return sid && tid ? `${sid}\t${tid}` : '';
}

function resolveCapabilityUnitIdByAssociatedUnit(
  associatedUnit: string,
  caps: ReadonlyArray<{ featureId: string; label: string }>,
): string | null {
  const needle = String(associatedUnit || '').trim();
  if (!needle) return null;
  for (const cap of caps) {
    const label = String(cap.label || '').trim();
    if (label && label === needle) return cap.featureId;
  }
  for (const cap of caps) {
    const label = String(cap.label || '').trim();
    if (!label) continue;
    if (needle.includes(label) || label.includes(needle)) return cap.featureId;
  }
  return null;
}

/**
 * 任务 5.2 Tree：为尚未落库的「业务能力单元（5.1）→ 业务能力字段集（5.2）」对合成正向归纳边（与后端 `buildTask52CapabilityUnitToFieldSetForwardLinks` 对齐）。
 */
export function synthesizeTask52CapabilityToFieldSetGraphLinks(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  baseLinks: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
): DesignDetailLogicGraphLinkDto[] {
  const t51 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK51_LINE_TASK_ID);
  const t52 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK52_LINE_TASK_ID);
  if (!t51?.features?.length || !t52?.features?.length) return [];

  const capNodes: LogicTreeLayerNode[] = [];
  for (const f of t51.features) {
    const fid = String(f.featureId ?? '').trim();
    if (!fid) continue;
    capNodes.push({
      featureId: fid,
      taskId: DESIGN_DETAIL_TASK51_LINE_TASK_ID,
      display: f,
    });
  }
  const layout = buildTask51TwoTierLayout(capNodes);
  const capabilityUnitNodes = layout.capabilityNodes.filter((n) => isTask51CapabilityUnitNode(n));
  const capabilityUnits = capabilityUnitNodes.map((n) => ({
    featureId: n.featureId,
    label: String(n.display?.name ?? '').trim() || task52FieldSetTitleFromDisplay(n.display),
  }));
  const capDisplayById = new Map(
    capabilityUnitNodes.map((n) => [n.featureId, n.display] as const),
  );
  if (!capabilityUnits.length) return [];

  const existing = new Set<string>();
  for (const L of baseLinks) {
    const k = linkEndpointPairKey(L);
    if (k) existing.add(k);
  }

  const out: DesignDetailLogicGraphLinkDto[] = [];
  let synthIdx = 0;
  for (const f of t52.features) {
    const tgt = String(f.featureId ?? '').trim();
    if (!tgt) continue;
    const acu = task52AssociatedCapabilityUnitFromDisplay(f);
    const src = resolveCapabilityUnitIdByAssociatedUnit(acu, capabilityUnits);
    if (!src) continue;
    const pair = `${src}\t${tgt}`;
    if (existing.has(pair)) continue;
    existing.add(pair);
    const fieldSetTitle = task52FieldSetTitleFromDisplay(f);
    const capLabel =
      capabilityUnits.find((c) => c.featureId === src)?.label || acu || '业务能力单元';
    out.push({
      linkId: `__synth_task52_cap_fieldset_${synthIdx++}`,
      name: '能力→字段集',
      linkKind: '正向归纳',
      themeKey: 'task52-cap-to-fieldset',
      pillBatchKey: 'synth-0',
      sourceFeatureId: src,
      targetFeatureId: tgt,
      logic: `正向归纳：业务能力单元「${capLabel}」→ 业务能力字段集「${fieldSetTitle}」（职能切片权重穿透）`,
      weight: 0.85,
      source: capDisplayById.get(src),
      target: f,
    });
  }
  return out;
}
