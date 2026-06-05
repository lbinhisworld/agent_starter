/**
 * [INPUT]: 任务 5.3 层 `LogicTreeLayerNode.display`（`featureValue.workflow_name` / `workflow_steps_topology`）
 * [OUTPUT]: 流程卡标题、环节子节点列表、卡宽与轨道最小宽度
 * [POS]: `DesignDetailLogicTreeModal.vue` 任务 5.3「关键工作流」节点（流程圆角框 + 横向环节子节点）
 *
 * [PROTOCOL]: 与 `designDetailTask53L3SyncContract.ts`、`designDetailL53WorkflowFlowSystemPrompt.js` 对齐；Tree 仅展示关键工作流卡与卡内环节 chip；5.1/5.2→环节边锚定在 chip；`filterTask53TreeRenderLinks` 隐藏工作流→环节正向归纳
 */

import {
  DESIGN_DETAIL_TASK51_LINE_TASK_ID,
  DESIGN_DETAIL_TASK52_LINE_TASK_ID,
  DESIGN_DETAIL_TASK53_LINE_TASK_ID,
  type DesignDetailLogicGraphFeatureDto,
  type DesignDetailLogicGraphLinkDto,
  type DesignDetailLogicGraphTaskDto,
  normLogicTaskId,
} from './designDetailLogicGraphMerge';
import {
  isTask53L3TargetKvSyncableFeatureKey,
  normalizeTask53FeatureKeyLabel,
  TASK53_L3_WORKFLOW_FLOW_KEY,
  TASK53_L3_WORKFLOW_STEP_KEY,
} from './designDetailTask53L3SyncContract';
import type { LogicTreeLayerNode } from './designDetailLogicTreeLayout';
import {
  isTask52FieldSetGraphFeatureRow,
  task52FieldSetTitleFromDisplay,
} from './designDetailLogicTreeTask52Layout';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';

/** 单张流程卡最小宽度（px） */
export const TASK53_LOGIC_TREE_CARD_MIN_WIDTH_PX = 220;

/** 环节子节点（chip）最小宽度（px） */
export const TASK53_LOGIC_TREE_STEP_CHIP_MIN_WIDTH_PX = 72;

/** 环节间时序箭头占位（px，与 Task7 绿箭头同量级） */
export const TASK53_LOGIC_TREE_STEP_ARROW_PX = 20;

const TASK53_LOGIC_TREE_TRACK_GAP_PX = 10;
const TASK53_LOGIC_TREE_TRACK_PAD_PX = 24;
/** 流程壳 + 卡 value 区左右内边距（与 `.dd-tree-workflow-shell` / 卡 padding 对齐） */
const TASK53_LOGIC_TREE_SHELL_PAD_PX = 28;
/** chip 左右 padding（与 `.dd-tree-workflow-step-chip` 对齐，约 0.4rem×2 + 边框） */
const TASK53_LOGIC_TREE_STEP_CHIP_PAD_PX = 26;
/** 0.62rem 字号下 CJK / ASCII 估算字宽（用于单行铺满、无横向滚动） */
const TASK53_LOGIC_TREE_CJK_CHAR_PX = 11;
const TASK53_LOGIC_TREE_ASCII_CHAR_PX = 6;

export type Task53WorkflowStepChip = {
  stepName: string;
};

export type Task53StepNodeMeta = {
  stepName: string;
  workflowName: string;
  associatedCapabilityUnit: string;
  associatedAssetDataset: string;
};

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

/** 剥除 `Feature_Value` 字符串层 / 嵌套包裹（与后端 `peelJsonStringLayers` 口径一致） */
function peelTask53FeatureValueLayers(raw: unknown, maxDepth = 8): unknown {
  let cur: unknown = raw;
  for (let i = 0; i < maxDepth; i++) {
    if (cur == null) break;
    if (typeof cur === 'string') {
      const parsed = parseJsonObject(cur);
      if (!parsed) break;
      cur = parsed;
      continue;
    }
    const rec = asRecord(cur);
    if (!rec) break;
    const inner = rec.Feature_Value ?? rec.feature_value ?? rec.featureValue;
    if (inner === undefined || inner === null) break;
    cur = inner;
  }
  return cur;
}

function task53WorkflowPayloadLooksValid(rec: Record<string, unknown>): boolean {
  return readWorkflowStepsTopology(rec).length > 0 || !!readTask53WorkflowNameFromRoot(rec);
}

/** 从误落库的整段 `L3_Workflow_Flow_Matrix` 中取首条「关键工作流」的 `Feature_Value` */
function extractTask53WorkflowFromMatrixRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  const matrix = asRecord(
    root.L3_Workflow_Flow_Matrix ??
      root.l3_workflow_flow_matrix ??
      root.L3_Workflow_Flow_matrix,
  );
  if (!matrix) return null;
  const tk = matrix.Target_KV ?? matrix.target_kv ?? matrix.Target_kv;
  if (!Array.isArray(tk)) return null;
  for (const item of tk) {
    const row = asRecord(item);
    if (!row) continue;
    const fk = normalizeTask53FeatureKeyLabel(
      row.Feature_Key ?? row.feature_key ?? (row as { FeatureKey?: unknown }).FeatureKey,
    );
    if (!isTask53L3TargetKvSyncableFeatureKey(fk)) continue;
    const peeled = peelTask53FeatureValueLayers(row.Feature_Value ?? row.feature_value);
    const inner = asRecord(peeled);
    if (inner && task53WorkflowPayloadLooksValid(inner)) return inner;
  }
  return null;
}

function unwrapTask53WorkflowPayload(rec: Record<string, unknown>): Record<string, unknown> | null {
  const fromMatrix = extractTask53WorkflowFromMatrixRoot(rec);
  if (fromMatrix) return fromMatrix;

  const peeled = peelTask53FeatureValueLayers(rec);
  const inner = asRecord(peeled);
  if (inner && task53WorkflowPayloadLooksValid(inner)) return inner;

  if (task53WorkflowPayloadLooksValid(rec)) return rec;
  return null;
}

function tryParseTask53Payload(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  const peeled = peelTask53FeatureValueLayers(raw);
  const rec = asRecord(peeled);
  if (!rec) {
    if (typeof raw === 'string') {
      const parsed = parseJsonObject(raw);
      if (!parsed) return null;
      return unwrapTask53WorkflowPayload(parsed);
    }
    return null;
  }
  return unwrapTask53WorkflowPayload(rec);
}

/** 解析节点落库 `DesignFeatureNode.value`（兼容 `{ Feature_Value, inference_summary }` 包裹） */
export function parseTask53FeatureValueRoot(
  display: DesignDetailLogicGraphFeatureDto,
): Record<string, unknown> | null {
  const fromFv = tryParseTask53Payload(display.featureValue ?? display.feature_value);
  if (fromFv) return fromFv;
  return tryParseTask53Payload(display.name);
}

function readStepNameFromRecord(step: Record<string, unknown>): string {
  return String(step.step_name ?? step.Step_Name ?? '').trim();
}

function readStepPredFromRecord(step: Record<string, unknown>): string {
  return String(step.predecessor_step_name ?? step.Predecessor_Step_Name ?? '').trim();
}

function readStepSuccFromRecord(step: Record<string, unknown>): string {
  return String(step.successor_step_name ?? step.Successor_Step_Name ?? '').trim();
}

function isTask53TopologyStartPred(pred: string, stepNames: Set<string>): boolean {
  const p = String(pred ?? '').trim();
  if (!p || p === 'START_NODE') return true;
  return !stepNames.has(p);
}

/** 按 predecessor/successor 链排序环节（START_NODE → … → END_NODE） */
export function orderTask53WorkflowStepsFromRoot(root: Record<string, unknown>): Task53WorkflowStepChip[] {
  const steps: Record<string, unknown>[] = [];
  for (const item of readWorkflowStepsTopology(root)) {
    const step = asRecord(item);
    if (!step) continue;
    const name = readStepNameFromRecord(step);
    if (name) steps.push(step);
  }
  if (!steps.length) return [];

  const byName = new Map<string, Record<string, unknown>>();
  const names = new Set<string>();
  for (const s of steps) {
    const n = readStepNameFromRecord(s);
    byName.set(n, s);
    names.add(n);
  }

  let cur =
    steps.find((s) => isTask53TopologyStartPred(readStepPredFromRecord(s), names)) ?? steps[0];
  const ordered: Task53WorkflowStepChip[] = [];
  const seen = new Set<string>();

  while (cur) {
    const name = readStepNameFromRecord(cur);
    if (!name || seen.has(name)) break;
    seen.add(name);
    ordered.push({ stepName: name });
    const succ = readStepSuccFromRecord(cur);
    if (!succ || succ === 'END_NODE') break;
    const next = byName.get(succ);
    if (!next) break;
    cur = next;
  }

  for (const s of steps) {
    const name = readStepNameFromRecord(s);
    if (name && !seen.has(name)) ordered.push({ stepName: name });
  }
  return ordered;
}

function readWorkflowStepsTopology(root: Record<string, unknown>): unknown[] {
  const raw =
    root.workflow_steps_topology ??
    root.Workflow_Steps_Topology ??
    root.workflowStepsTopology;
  return Array.isArray(raw) ? raw : [];
}

export function readTask53WorkflowNameFromRoot(root: Record<string, unknown>): string {
  const wf = String(root.workflow_name ?? root.Workflow_Name ?? '').trim();
  if (wf) return wf;
  const seg = String(root.flow_segment_name ?? root.Flow_Segment_Name ?? '').trim();
  return seg;
}

/** 是否为任务 5.3「流程环节」独立图节点（token 含 `/环节/`） */
export function isTask53WorkflowStepGraphFeatureRow(
  display: DesignDetailLogicGraphFeatureDto | Task2L1TaskGraphFeatureRow,
): boolean {
  const tok = String(display.tokenDisplay ?? display.token_display ?? '').trim();
  const head = tok && tok !== '—' ? (tok.split(/\s*·\s*/)[0]?.trim() ?? tok) : '';
  if (head === TASK53_L3_WORKFLOW_STEP_KEY || head.includes('/环节/')) return true;
  const root = parseTask53FeatureValueRoot(display as DesignDetailLogicGraphFeatureDto);
  if (root) {
    const stepName = readStepNameFromRecord(root);
    if (stepName && readWorkflowStepsTopology(root).length === 0) return true;
  }
  return false;
}

/** 是否为任务 5.3「关键工作流」特征行 */
export function isTask53WorkflowGraphFeatureRow(
  display: DesignDetailLogicGraphFeatureDto | Task2L1TaskGraphFeatureRow,
): boolean {
  if (isTask53WorkflowStepGraphFeatureRow(display)) return false;
  const tok = String(display.tokenDisplay ?? display.token_display ?? '').trim();
  const head = tok && tok !== '—' ? (tok.split(/\s*·\s*/)[0]?.trim() ?? tok) : '';
  if (head.includes('/环节/')) return false;
  if (
    head === TASK53_L3_WORKFLOW_FLOW_KEY ||
    (head.startsWith(`${TASK53_L3_WORKFLOW_FLOW_KEY}/`) && !head.includes('/环节/')) ||
    head === TASK53_L3_WORKFLOW_FLOW_KEY
  ) {
    return true;
  }
  const theme = String(display.themeKey ?? display.theme_key ?? '').trim();
  if (theme === TASK53_L3_WORKFLOW_FLOW_KEY) return true;
  const root = parseTask53FeatureValueRoot(display as DesignDetailLogicGraphFeatureDto);
  if (root && readWorkflowStepsTopology(root).length > 0) return true;
  if (root && readTask53WorkflowNameFromRoot(root)) return true;
  return false;
}

function task53WorkflowTitleFallbackFromDisplayName(name: unknown): string {
  const nm = String(name ?? '').trim();
  if (!nm || nm === '—') return '';
  if (nm.startsWith('{') || nm.startsWith('[')) return '';
  if (nm.length > 160) return '';
  return nm;
}

/** 流程卡主标题（`workflow_name`；`name` 仅作 API 摘要回退，不用 `inference_summary`） */
function readAssociatedCapabilityFromRoot(root: Record<string, unknown>): string {
  return String(
    root.associated_capability_unit ?? root.Associated_Capability_Unit ?? '',
  ).trim();
}

function readAssociatedDatasetFromRoot(root: Record<string, unknown>): string {
  return String(root.associated_asset_dataset ?? root.Associated_Asset_Dataset ?? '').trim();
}

/** 环节独立节点元数据 */
export function task53StepMetaFromNode(node: LogicTreeLayerNode): Task53StepNodeMeta {
  const root = parseTask53FeatureValueRoot(node.display);
  const stepName = root ? readStepNameFromRecord(root) : '';
  const workflowName = root ? readTask53WorkflowNameFromRoot(root) : '';
  return {
    stepName: stepName || '（未命名环节）',
    workflowName: workflowName || '（未命名流程）',
    associatedCapabilityUnit: root ? readAssociatedCapabilityFromRoot(root) : '',
    associatedAssetDataset: root ? readAssociatedDatasetFromRoot(root) : '',
  };
}

export function task53StepCardTitle(node: LogicTreeLayerNode): string {
  return task53StepMetaFromNode(node).stepName;
}

/** 环节节点排序键：`流程名/环节名` */
export function task53StepSortKey(node: LogicTreeLayerNode): string {
  const m = task53StepMetaFromNode(node);
  return `${m.workflowName}/${m.stepName}`;
}

export function isTask53WorkflowStepLayerNode(node: LogicTreeLayerNode): boolean {
  return isTask53WorkflowStepGraphFeatureRow(node.display);
}

/** `workflowName + stepName` → 环节特征 `featureId`（供逻辑树 SVG 锚定环节 chip） */
export function buildTask53StepFeatureIdLookup(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): Map<string, string> {
  const t53 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK53_LINE_TASK_ID);
  const out = new Map<string, string>();
  if (!t53?.features?.length) return out;
  for (const f of t53.features) {
    if (!isTask53WorkflowStepGraphFeatureRow(f)) continue;
    const fid = String(f.featureId ?? '').trim();
    if (!fid) continue;
    const meta = task53StepMetaFromNode({
      featureId: fid,
      taskId: DESIGN_DETAIL_TASK53_LINE_TASK_ID,
      display: f,
    });
    const wf = normProcessNameForTask53Lookup(meta.workflowName);
    const step = normProcessNameForTask53Lookup(meta.stepName);
    if (!wf || !step) continue;
    out.set(`${wf}\t${step}`, fid);
  }
  return out;
}

function normProcessNameForTask53Lookup(name: string): string {
  return String(name ?? '').trim();
}

export function task53StepFeatureIdForWorkflowAndStep(
  lookup: ReadonlyMap<string, string>,
  workflowName: string,
  stepName: string,
): string {
  const wf = normProcessNameForTask53Lookup(workflowName);
  const step = normProcessNameForTask53Lookup(stepName);
  if (!wf || !step) return '';
  return String(lookup.get(`${wf}\t${step}`) ?? '').trim();
}

/** 任务 5.3「关键工作流」落库特征 id 集合 */
export function buildTask53WorkflowFeatureIdSet(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): Set<string> {
  const t53 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK53_LINE_TASK_ID);
  const out = new Set<string>();
  if (!t53?.features?.length) return out;
  for (const f of t53.features) {
    if (!isTask53WorkflowGraphFeatureRow(f)) continue;
    const id = String(f.featureId ?? '').trim();
    if (id) out.add(id);
  }
  return out;
}

/** 任务 5.3「流程环节」落库特征 id 集合（逻辑树 SVG 锚点与边样式判定） */
export function buildTask53StepFeatureIdSet(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): Set<string> {
  const out = new Set<string>();
  for (const fid of buildTask53StepFeatureIdLookup(tasks).values()) {
    const id = String(fid ?? '').trim();
    if (id) out.add(id);
  }
  return out;
}

/** 指定流程名下全部环节特征 id（focus 工作流时高亮环节正向归纳边） */
export function task53StepFeatureIdsForWorkflowTitle(
  lookup: ReadonlyMap<string, string>,
  workflowTitle: string,
): Set<string> {
  const wf = normProcessNameForTask53Lookup(workflowTitle);
  if (!wf) return new Set();
  const out = new Set<string>();
  for (const [key, fid] of lookup) {
    const tab = key.indexOf('\t');
    if (tab < 0) continue;
    if (key.slice(0, tab) === wf) {
      const id = String(fid ?? '').trim();
      if (id) out.add(id);
    }
  }
  return out;
}

/** 逻辑树不展示：关键工作流 → 流程环节（层内落库边；环节关系由卡内 chip 链表达） */
export function isTask53WorkflowToStepForwardTreeHiddenLink(
  link: DesignDetailLogicGraphLinkDto,
  workflowIds: ReadonlySet<string>,
  stepIds: ReadonlySet<string>,
): boolean {
  const sid = String(link.sourceFeatureId ?? link.source?.featureId ?? '').trim();
  const tid = String(link.targetFeatureId ?? link.target?.featureId ?? '').trim();
  if (!sid || !tid) return false;
  return workflowIds.has(sid) && stepIds.has(tid);
}

/** 从 Tree 渲染边集中剔除「工作流→环节」正向归纳（保留 5.1/5.2→环节等跨层边） */
export function filterTask53TreeRenderLinks(
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): DesignDetailLogicGraphLinkDto[] {
  const workflowIds = buildTask53WorkflowFeatureIdSet(tasks);
  const stepIds = buildTask53StepFeatureIdSet(tasks);
  if (!workflowIds.size || !stepIds.size) return [...links];
  return links.filter(
    (l) => !isTask53WorkflowToStepForwardTreeHiddenLink(l, workflowIds, stepIds),
  );
}

/** 按 `featureId` 取任务 5.3 特征行（判定 focus 锚点是否为关键工作流） */
export function task53WorkflowFeatureDisplayById(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  featureId: string,
): DesignDetailLogicGraphFeatureDto | undefined {
  const fid = String(featureId || '').trim();
  if (!fid) return undefined;
  const t53 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK53_LINE_TASK_ID);
  for (const f of t53?.features ?? []) {
    if (String(f.featureId ?? '').trim() === fid) return f;
  }
  return undefined;
}

/** 逻辑树 5.3 层仅展示「关键工作流」卡；「流程环节」落库特征仅作连边锚点（挂在工作流内 chip 上） */
export function filterTask53WorkflowCardsForTreeDisplay(
  nodes: ReadonlyArray<LogicTreeLayerNode>,
): LogicTreeLayerNode[] {
  return nodes.filter((n) => !isTask53WorkflowStepGraphFeatureRow(n.display));
}

/** 任务 5.3 图内是否已有「流程环节」落库节点（有则不再兜底 5.2→关键工作流 边） */
export function task53GraphHasStepFeatureNodes(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): boolean {
  const t53 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK53_LINE_TASK_ID);
  if (!t53?.features?.length) return false;
  return t53.features.some((f) => isTask53WorkflowStepGraphFeatureRow(f));
}

export function task53WorkflowCardTitle(node: LogicTreeLayerNode): string {
  const root = parseTask53FeatureValueRoot(node.display);
  if (root) {
    const t = readTask53WorkflowNameFromRoot(root);
    if (t) return t;
  }
  const fromName = task53WorkflowTitleFallbackFromDisplayName(node.display?.name);
  if (fromName) return fromName;
  return '（未命名流程）';
}

/** 自节点 value 解析环节链（按拓扑先后排序） */
export function task53WorkflowOrderedStepsFromNode(node: LogicTreeLayerNode): Task53WorkflowStepChip[] {
  const root = parseTask53FeatureValueRoot(node.display);
  if (!root) return [];
  return orderTask53WorkflowStepsFromRoot(root);
}

/** @deprecated 使用 `task53WorkflowOrderedStepsFromNode` */
export function task53WorkflowStepChipsFromNode(node: LogicTreeLayerNode): Task53WorkflowStepChip[] {
  return task53WorkflowOrderedStepsFromNode(node);
}

/** 按文案估算单行文本宽度（px） */
function estimateTask53TextWidthPx(
  text: string,
  minPx = TASK53_LOGIC_TREE_STEP_CHIP_MIN_WIDTH_PX,
): number {
  const t = String(text ?? '').trim();
  if (!t) return minPx;
  let w = 0;
  for (const ch of t) {
    w += ch.charCodeAt(0) > 0xff ? TASK53_LOGIC_TREE_CJK_CHAR_PX : TASK53_LOGIC_TREE_ASCII_CHAR_PX;
  }
  return Math.max(minPx, w);
}

/** 单环节 chip 占位宽（单行 `step_name`，与 CSS `white-space: nowrap` 对齐） */
export function estimateTask53StepChipWidthPx(stepName: string): number {
  return estimateTask53TextWidthPx(stepName) + TASK53_LOGIC_TREE_STEP_CHIP_PAD_PX;
}

/** 单流程卡宽度（px）：按各环节名累加，保证一行内展示完整环节链 */
/** 单环节独立节点宽度（px） */
export function logicTreeTask53StepCardWidthPx(node: LogicTreeLayerNode): number {
  const m = task53StepMetaFromNode(node);
  const lines = [m.stepName, m.associatedCapabilityUnit, m.associatedAssetDataset].filter(Boolean);
  let bodyPx = 0;
  for (const line of lines) {
    bodyPx = Math.max(bodyPx, estimateTask53TextWidthPx(line, 80));
  }
  return Math.max(TASK53_LOGIC_TREE_STEP_CHIP_MIN_WIDTH_PX + 40, bodyPx + TASK53_LOGIC_TREE_SHELL_PAD_PX);
}

export function logicTreeTask53CardWidthPx(node: LogicTreeLayerNode): number {
  if (isTask53WorkflowStepLayerNode(node)) return logicTreeTask53StepCardWidthPx(node);
  const steps = task53WorkflowOrderedStepsFromNode(node);
  const title = task53WorkflowCardTitle(node);
  let stepsRowPx = 0;
  for (let i = 0; i < steps.length; i++) {
    stepsRowPx += estimateTask53StepChipWidthPx(steps[i]!.stepName);
    if (i > 0) stepsRowPx += TASK53_LOGIC_TREE_STEP_ARROW_PX;
  }
  const titlePx = estimateTask53TextWidthPx(title, 80) + 8;
  const bodyPx = Math.max(stepsRowPx, titlePx) + TASK53_LOGIC_TREE_SHELL_PAD_PX;
  if (!steps.length) {
    return Math.max(TASK53_LOGIC_TREE_CARD_MIN_WIDTH_PX, bodyPx);
  }
  return Math.max(TASK53_LOGIC_TREE_CARD_MIN_WIDTH_PX, bodyPx);
}

/** 任务 5.3 层横向轨道最小宽度（px） */
export function logicTreeTask53LayerTrackMinWidthPx(nodes: ReadonlyArray<LogicTreeLayerNode>): number {
  if (!nodes.length) return TASK53_LOGIC_TREE_CARD_MIN_WIDTH_PX + TASK53_LOGIC_TREE_TRACK_PAD_PX;
  let sum = 0;
  for (const n of nodes) {
    sum += logicTreeTask53CardWidthPx(n);
  }
  const gaps = Math.max(0, nodes.length - 1) * TASK53_LOGIC_TREE_TRACK_GAP_PX;
  return sum + gaps + TASK53_LOGIC_TREE_TRACK_PAD_PX;
}

function linkEndpointPairKey(
  l: Pick<DesignDetailLogicGraphLinkDto, 'sourceFeatureId' | 'targetFeatureId' | 'source' | 'target'>,
): string {
  const sid = String(l.sourceFeatureId ?? l.source?.featureId ?? '').trim();
  const tid = String(l.targetFeatureId ?? l.target?.featureId ?? '').trim();
  return sid && tid ? `${sid}\t${tid}` : '';
}

function resolveFieldSetByDatasetTitle(
  associatedDataset: string,
  fieldSetByTitle: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): DesignDetailLogicGraphFeatureDto | undefined {
  const ds = String(associatedDataset || '').trim();
  if (!ds) return undefined;
  const direct = fieldSetByTitle.get(ds);
  if (direct) return direct;
  for (const [title, f] of fieldSetByTitle) {
    if (title === ds || title.includes(ds) || ds.includes(title)) return f;
  }
  return undefined;
}

function resolveCapabilityUnitByLabel(
  label: string,
  capabilityByLabel: ReadonlyMap<string, DesignDetailLogicGraphFeatureDto>,
): DesignDetailLogicGraphFeatureDto | undefined {
  const needle = String(label || '').trim();
  if (!needle) return undefined;
  const direct = capabilityByLabel.get(needle);
  if (direct) return direct;
  for (const [name, f] of capabilityByLabel) {
    if (name === needle || name.includes(needle) || needle.includes(name)) return f;
  }
  return undefined;
}

function collectTask52FieldSetTitleMap(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): Map<string, DesignDetailLogicGraphFeatureDto> {
  const t52 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK52_LINE_TASK_ID);
  const fieldSetByTitle = new Map<string, DesignDetailLogicGraphFeatureDto>();
  if (!t52?.features?.length) return fieldSetByTitle;
  for (const f of t52.features) {
    if (!isTask52FieldSetGraphFeatureRow(f)) continue;
    const fid = String(f.featureId ?? '').trim();
    if (!fid) continue;
    const title = task52FieldSetTitleFromDisplay(f);
    if (title) fieldSetByTitle.set(title, f);
  }
  return fieldSetByTitle;
}

function collectTask51CapabilityLabelMap(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): Map<string, DesignDetailLogicGraphFeatureDto> {
  const t51 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK51_LINE_TASK_ID);
  const out = new Map<string, DesignDetailLogicGraphFeatureDto>();
  if (!t51?.features?.length) return out;
  for (const f of t51.features) {
    const fid = String(f.featureId ?? '').trim();
    if (!fid) continue;
    const label = String(f.name ?? '').trim();
    const tok = String(f.tokenDisplay ?? f.token_display ?? '').trim();
    const head = tok.split(/\s*·\s*/)[0]?.trim() ?? '';
    if (head !== '业务能力单元' && !label) continue;
    if (label) out.set(label, f);
  }
  return out;
}

/**
 * Tree 兜底：5.1 业务能力单元 → 5.3 流程环节（按环节 `associated_capability_unit` 匹配）。
 */
export function synthesizeTask51CapabilityToStepGraphLinks(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  baseLinks: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
): DesignDetailLogicGraphLinkDto[] {
  const t53 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK53_LINE_TASK_ID);
  if (!t53?.features?.length) return [];
  const capabilityByLabel = collectTask51CapabilityLabelMap(tasks);
  if (!capabilityByLabel.size) return [];

  const existing = new Set<string>();
  for (const L of baseLinks) {
    const k = linkEndpointPairKey(L);
    if (k) existing.add(k);
  }

  const out: DesignDetailLogicGraphLinkDto[] = [];
  let synthIdx = 0;
  for (const f of t53.features) {
    if (!isTask53WorkflowStepGraphFeatureRow(f)) continue;
    const tgt = String(f.featureId ?? '').trim();
    if (!tgt) continue;
    const meta = task53StepMetaFromNode({ featureId: tgt, taskId: DESIGN_DETAIL_TASK53_LINE_TASK_ID, display: f });
    const srcCap = resolveCapabilityUnitByLabel(meta.associatedCapabilityUnit, capabilityByLabel);
    if (!srcCap) continue;
    const src = String(srcCap.featureId ?? '').trim();
    if (!src) continue;
    const pair = `${src}\t${tgt}`;
    if (existing.has(pair)) continue;
    existing.add(pair);
    const capLabel = String(srcCap.name ?? '').trim() || meta.associatedCapabilityUnit || '业务能力单元';
    out.push({
      linkId: `__synth_task53_cap_step_${synthIdx++}`,
      name: '能力单元→环节',
      linkKind: '正向归纳',
      themeKey: 'task53-cap-to-step',
      pillBatchKey: 'synth-0',
      sourceFeatureId: src,
      targetFeatureId: tgt,
      logic: `正向归纳：业务能力单元「${capLabel}」→ 环节「${meta.stepName}」`,
      weight: 0.85,
      source: srcCap,
      target: f,
    });
  }
  return out;
}

/**
 * Tree 兜底：5.2 字段集 → 5.3 流程环节（按 `associated_asset_dataset` 与字段集标题匹配）。
 */
export function synthesizeTask52FieldSetToStepGraphLinks(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  baseLinks: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
): DesignDetailLogicGraphLinkDto[] {
  const t53 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK53_LINE_TASK_ID);
  if (!t53?.features?.length) return [];
  const fieldSetByTitle = collectTask52FieldSetTitleMap(tasks);
  if (!fieldSetByTitle.size) return [];

  const existing = new Set<string>();
  for (const L of baseLinks) {
    const k = linkEndpointPairKey(L);
    if (k) existing.add(k);
  }

  const out: DesignDetailLogicGraphLinkDto[] = [];
  let synthIdx = 0;
  for (const f of t53.features) {
    if (!isTask53WorkflowStepGraphFeatureRow(f)) continue;
    const tgt = String(f.featureId ?? '').trim();
    if (!tgt) continue;
    const meta = task53StepMetaFromNode({ featureId: tgt, taskId: DESIGN_DETAIL_TASK53_LINE_TASK_ID, display: f });
    const srcFs = resolveFieldSetByDatasetTitle(meta.associatedAssetDataset, fieldSetByTitle);
    if (!srcFs) continue;
    const src = String(srcFs.featureId ?? '').trim();
    if (!src) continue;
    const pair = `${src}\t${tgt}`;
    if (existing.has(pair)) continue;
    existing.add(pair);
    const fsTitle = task52FieldSetTitleFromDisplay(srcFs);
    out.push({
      linkId: `__synth_task53_fs_step_${synthIdx++}`,
      name: '字段集→环节',
      linkKind: '正向归纳',
      themeKey: 'task53-fs-to-step',
      pillBatchKey: 'synth-0',
      sourceFeatureId: src,
      targetFeatureId: tgt,
      logic: `正向归纳：业务能力字段集「${fsTitle}」→ 环节「${meta.stepName}」`,
      weight: 0.85,
      source: srcFs,
      target: f,
    });
  }
  return out;
}

/**
 * Tree 兜底：5.2 字段集 → 5.3 关键工作流（按首环节 `associated_asset_dataset` 与字段集标题匹配）。
 */
export function synthesizeTask52FieldSetToWorkflowGraphLinks(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  baseLinks: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
): DesignDetailLogicGraphLinkDto[] {
  const t52 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK52_LINE_TASK_ID);
  const t53 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK53_LINE_TASK_ID);
  if (!t52?.features?.length || !t53?.features?.length) return [];

  const fieldSetByTitle = new Map<string, DesignDetailLogicGraphFeatureDto>();
  for (const f of t52.features) {
    if (!isTask52FieldSetGraphFeatureRow(f)) continue;
    const fid = String(f.featureId ?? '').trim();
    if (!fid) continue;
    const title = task52FieldSetTitleFromDisplay(f);
    if (title) fieldSetByTitle.set(title, f);
  }

  const existing = new Set<string>();
  for (const L of baseLinks) {
    const k = linkEndpointPairKey(L);
    if (k) existing.add(k);
  }

  const out: DesignDetailLogicGraphLinkDto[] = [];
  let synthIdx = 0;
  for (const f of t53.features) {
    if (!isTask53WorkflowGraphFeatureRow(f)) continue;
    const tgt = String(f.featureId ?? '').trim();
    if (!tgt) continue;
    const root = parseTask53FeatureValueRoot(f);
    if (!root) continue;
    const wfName = readTask53WorkflowNameFromRoot(root);
    const steps = readWorkflowStepsTopology(root);
    let srcFs: DesignDetailLogicGraphFeatureDto | undefined;
    for (const item of steps) {
      const step = asRecord(item);
      if (!step) continue;
      const ds = String(
        step.associated_asset_dataset ?? step.Associated_Asset_Dataset ?? '',
      ).trim();
      if (!ds) continue;
      srcFs = fieldSetByTitle.get(ds);
      if (srcFs) break;
    }
    if (!srcFs) continue;
    const src = String(srcFs.featureId ?? '').trim();
    if (!src) continue;
    const pair = `${src}\t${tgt}`;
    if (existing.has(pair)) continue;
    existing.add(pair);
    const fsTitle = task52FieldSetTitleFromDisplay(srcFs);
    out.push({
      linkId: `__synth_task53_fs_workflow_${synthIdx++}`,
      name: '字段集→关键工作流',
      linkKind: '正向归纳',
      themeKey: 'task53-fs-to-workflow',
      pillBatchKey: 'synth-0',
      sourceFeatureId: src,
      targetFeatureId: tgt,
      logic: `正向归纳：业务能力字段集「${fsTitle}」→ 关键工作流「${wfName || '（未命名流程）'}」`,
      weight: 0.85,
      source: srcFs,
      target: f,
    });
  }
  return out;
}
