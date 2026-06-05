/**
 * [INPUT]: 任务 7 层 `LogicTreeLayerNode`、逻辑边 `DesignDetailLogicGraphLinkDto`
 * [OUTPUT]: 按「所属业务流程」分组的子块布局；协作节点按 `Predecessor_Value` / 链上 logic 时序排序
 * [POS]: `DesignDetailLogicTreeModal.vue` 任务 7 层专用渲染（灰底圆角流程子块 + 流程行 + 操作行）
 *
 * [PROTOCOL]: 变更分组或时序规则时同步 `DesignDetailLogicTreeModal.vue`、`designDetailLogicTreeTask8Layout.ts` 与 `designDetailLogicTreeLayout.ts`（`sortTask8LayerNodesInPlace` 的 `t7CollabOrder`）
 */

import {
  type DesignDetailLogicGraphLinkDto,
  isDesignDetailReverseValidationLogicLink,
} from './designDetailLogicGraphMerge';
import {
  resolveTask5LogicTreeFeatureKey,
  type LogicTreeLayerNode,
} from './designDetailLogicTreeLayout';

export type Task7ProcessBlock = {
  flowNode: LogicTreeLayerNode | null;
  operationNodes: LogicTreeLayerNode[];
};

const FLOW_KEY = '所属业务流程';
const OP_KEY = '协作节点';

export function isTask7FlowFeatureKey(key: string): boolean {
  return String(key || '').trim() === FLOW_KEY;
}

export function isTask7OperationFeatureKey(key: string): boolean {
  return String(key || '').trim() === OP_KEY;
}

export function isTask7FlowNode(node: LogicTreeLayerNode): boolean {
  return isTask7FlowFeatureKey(resolveTask5LogicTreeFeatureKey(node));
}

export function isTask7OperationNode(node: LogicTreeLayerNode): boolean {
  return isTask7OperationFeatureKey(resolveTask5LogicTreeFeatureKey(node));
}

function linkTargetId(l: DesignDetailLogicGraphLinkDto): string {
  return String(l.targetFeatureId ?? l.target?.featureId ?? '').trim();
}

function linkSourceId(l: DesignDetailLogicGraphLinkDto): string {
  return String(l.sourceFeatureId ?? l.source?.featureId ?? '').trim();
}

function linkLogicText(l: DesignDetailLogicGraphLinkDto): string {
  return String(l.logic ?? '').trim();
}

function isForwardLink(
  l: DesignDetailLogicGraphLinkDto,
  featureIdToNormTaskId: Map<string, string>,
): boolean {
  return !isDesignDetailReverseValidationLogicLink(l, featureIdToNormTaskId);
}

/** 从入边 logic 解析 `前置锚定=…`（任务 7 落库前缀） */
export function readPredecessorHintForOperationNode(
  opFeatureId: string,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  featureIdToNormTaskId: Map<string, string>,
): string {
  const fid = String(opFeatureId || '').trim();
  if (!fid) return '';
  for (const L of links) {
    if (!isForwardLink(L, featureIdToNormTaskId)) continue;
    if (linkTargetId(L) !== fid) continue;
    const logic = linkLogicText(L);
    const m = logic.match(/前置锚定=([^；]+)/);
    if (m?.[1]) return m[1].trim();
  }
  return '';
}

function opDisplayValue(node: LogicTreeLayerNode): string {
  return String(node.display?.name ?? '').trim();
}

/**
 * 按 Predecessor_Value 链排序协作节点：START → 前一节点 Feature_Value → 余下按名称。
 */
export function sortTask7OperationsByPredecessorChain(
  ops: LogicTreeLayerNode[],
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  featureIdToNormTaskId: Map<string, string>,
): LogicTreeLayerNode[] {
  if (ops.length <= 1) return [...ops];
  const byValue = new Map<string, LogicTreeLayerNode>();
  for (const n of ops) {
    const v = opDisplayValue(n);
    if (v) byValue.set(v, n);
  }
  const predByFid = new Map<string, string>();
  for (const n of ops) {
    predByFid.set(
      n.featureId,
      readPredecessorHintForOperationNode(n.featureId, links, featureIdToNormTaskId),
    );
  }
  const start = ops.find((n) => predByFid.get(n.featureId)?.toUpperCase() === 'START');
  const ordered: LogicTreeLayerNode[] = [];
  const used = new Set<string>();
  if (start) {
    ordered.push(start);
    used.add(start.featureId);
  }
  let cursor = start ? opDisplayValue(start) : '';
  let guard = 0;
  while (guard++ < ops.length + 2) {
    const next = ops.find(
      (n) => !used.has(n.featureId) && predByFid.get(n.featureId) === cursor && cursor.length > 0,
    );
    if (!next) break;
    ordered.push(next);
    used.add(next.featureId);
    cursor = opDisplayValue(next);
  }
  const rest = ops
    .filter((n) => !used.has(n.featureId))
    .sort(
      (a, b) =>
        opDisplayValue(a).localeCompare(opDisplayValue(b), 'zh-CN') ||
        a.featureId.localeCompare(b.featureId, 'zh-CN'),
    );
  return [...ordered, ...rest];
}

/**
 * 将任务 7 扁平节点拆为「流程子块」：流程节点横向并列；块内上流程下操作（操作时序左→右）。
 */
export function buildTask7ProcessBlocks(
  nodes: ReadonlyArray<LogicTreeLayerNode>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  featureIdToNormTaskId: Map<string, string>,
): Task7ProcessBlock[] {
  const flows: LogicTreeLayerNode[] = [];
  const ops: LogicTreeLayerNode[] = [];
  for (const n of nodes) {
    if (isTask7FlowNode(n)) flows.push(n);
    else if (isTask7OperationNode(n)) ops.push(n);
  }
  flows.sort(
    (a, b) =>
      opDisplayValue(a).localeCompare(opDisplayValue(b), 'zh-CN') ||
      a.featureId.localeCompare(b.featureId, 'zh-CN'),
  );

  const opToFlow = new Map<string, string>();
  for (const L of links) {
    if (!isForwardLink(L, featureIdToNormTaskId)) continue;
    const sid = linkSourceId(L);
    const tid = linkTargetId(L);
    if (!sid || !tid) continue;
    const src = nodes.find((n) => n.featureId === sid);
    const tgt = nodes.find((n) => n.featureId === tid);
    if (src && isTask7FlowNode(src) && tgt && isTask7OperationNode(tgt)) {
      opToFlow.set(tid, sid);
    }
  }

  const blocks: Task7ProcessBlock[] = flows.map((flow) => ({
    flowNode: flow,
    operationNodes: [] as LogicTreeLayerNode[],
  }));
  const flowByFid = new Map(blocks.map((b) => [b.flowNode!.featureId, b]));

  const defaultFlowFid = flows[0]?.featureId ?? '';
  for (const op of ops) {
    const fid = opToFlow.get(op.featureId) || defaultFlowFid;
    let block = fid ? flowByFid.get(fid) : undefined;
    if (!block && blocks.length === 1) block = blocks[0];
    if (!block) {
      const synthetic: Task7ProcessBlock = { flowNode: null, operationNodes: [] };
      blocks.push(synthetic);
      block = synthetic;
    }
    block.operationNodes.push(op);
  }

  for (const b of blocks) {
    b.operationNodes = sortTask7OperationsByPredecessorChain(
      b.operationNodes,
      links,
      featureIdToNormTaskId,
    );
  }

  return blocks.filter((b) => b.flowNode || b.operationNodes.length > 0);
}

/**
 * 任务 7 Tree 上协作节点从左到右的全局序：流程子块左→右，块内操作按前置链左→右。
 * 供任务 8 子块排序与层内平铺排序对齐。
 */
export function buildTask7CollaborationNodesInTreeVisualOrder(
  nodes: ReadonlyArray<LogicTreeLayerNode>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  featureIdToNormTaskId: Map<string, string>,
): LogicTreeLayerNode[] {
  const blocks = buildTask7ProcessBlocks(nodes, links, featureIdToNormTaskId);
  const out: LogicTreeLayerNode[] = [];
  for (const b of blocks) {
    for (const op of b.operationNodes) out.push(op);
  }
  return out;
}

/** 任务 7 流程子块横向间距（块越少间距越大，便于居中后仍疏朗） */
export function logicTreeTask7BlockGapPx(blockCount: number): number {
  const n = Math.max(1, Math.ceil(blockCount));
  if (n <= 1) return 0;
  if (n === 2) return 56;
  if (n === 3) return 44;
  if (n === 4) return 36;
  if (n === 5) return 30;
  return 24;
}

/** 单块流程子块基准宽度（px，在 ×1.5 基础上再 ×1.3） */
export const LOGIC_TREE_TASK7_PROCESS_BLOCK_WIDTH_PX = 520;

/** 任务 7 轨道最小宽度：子块总宽 + 间距 + 两侧留白（供 `justify-content: center` 居中） */
export function logicTreeTask7LayerTrackMinWidthPx(blockCount: number): number {
  const n = Math.max(1, Math.ceil(blockCount));
  const perBlock = LOGIC_TREE_TASK7_PROCESS_BLOCK_WIDTH_PX;
  const gap = logicTreeTask7BlockGapPx(n);
  const sidePad = n <= 1 ? 156 : n === 2 ? 140 : n === 3 ? 125 : 94;
  const content = n * perBlock + Math.max(0, n - 1) * gap;
  return Math.max(936, content + sidePad * 2);
}
