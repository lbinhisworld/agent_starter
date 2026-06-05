/**
 * [INPUT]: 任务 8 层 `LogicTreeLayerNode`、任务 7 层协作节点序、逻辑边
 * [OUTPUT]: 按上游任务 7「协作节点」分组的子块（块内任务 8 节点水平均匀分布）
 * [POS]: `DesignDetailLogicTreeModal.vue` 任务 8 层专用渲染（透明底 + 淡灰边框圆角子块）
 *
 * [PROTOCOL]: 块序须与 `buildTask7CollaborationNodesInTreeVisualOrder` 一致；变更时同步 Modal 与 `sortTask8LayerNodesInPlace` 的 `t7CollabOrder`
 */

import {
  type DesignDetailLogicGraphLinkDto,
  DESIGN_DETAIL_TASK7_LINE_TASK_ID,
  isDesignDetailReverseValidationLogicLink,
} from './designDetailLogicGraphMerge';
import { buildTask7CollaborationNodesInTreeVisualOrder } from './designDetailLogicTreeTask7Layout';
import {
  resolveTask5LogicTreeFeatureKey,
  type LogicTreeLayerNode,
} from './designDetailLogicTreeLayout';

export type Task8CollaborationBlock = {
  /** 对应的上游任务 7「协作节点」；无正向锚点的归入 `anchorNode === null` 块 */
  anchorNode: LogicTreeLayerNode | null;
  prototypeNodes: LogicTreeLayerNode[];
};

const TASK8_KEY_ORDER: Record<string, number> = {
  操作角色: 0,
  单据对象: 1,
  状态转移矩阵: 2,
};

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

function isTask8PrototypeNode(node: LogicTreeLayerNode): boolean {
  const k = resolveTask5LogicTreeFeatureKey(node);
  return Object.prototype.hasOwnProperty.call(TASK8_KEY_ORDER, k);
}

/** task8 featureId → 上游任务 7 协作节点 featureId（正向归纳边） */
function buildTask8ToT7CollaborationAnchorMap(
  task8Nodes: ReadonlyArray<LogicTreeLayerNode>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  featureIdToNormTaskId: Map<string, string>,
  t7CollabFids: Set<string>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const n of task8Nodes) {
    const t8id = n.featureId;
    for (const L of links) {
      if (!isForwardLink(L, featureIdToNormTaskId)) continue;
      if (linkTargetId(L) !== t8id) continue;
      const src = linkSourceId(L);
      if (!src || !t7CollabFids.has(src)) continue;
      out.set(t8id, src);
      break;
    }
  }
  return out;
}

/**
 * 将任务 8 节点按上游任务 7「协作节点」拆为子块；块顺序与任务 7 协作节点层内序一致。
 */
export function buildTask8CollaborationBlocks(
  task8Nodes: ReadonlyArray<LogicTreeLayerNode>,
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  featureIdToNormTaskId: Map<string, string>,
): Task8CollaborationBlock[] {
  const protos = task8Nodes.filter(isTask8PrototypeNode);
  if (!protos.length) return [];

  const t7Nodes = nodesByLayer.get(DESIGN_DETAIL_TASK7_LINE_TASK_ID) ?? [];
  const t7Collabs = buildTask7CollaborationNodesInTreeVisualOrder(
    t7Nodes,
    links,
    featureIdToNormTaskId,
  );
  const t7CollabFids = new Set(t7Collabs.map((n) => n.featureId));
  const t7ByFid = new Map(t7Collabs.map((n) => [n.featureId, n] as const));
  const t8ToT7 = buildTask8ToT7CollaborationAnchorMap(protos, links, featureIdToNormTaskId, t7CollabFids);

  const byAnchor = new Map<string, LogicTreeLayerNode[]>();
  const orphanKey = '__orphan__';
  for (const n of protos) {
    const anchor = t8ToT7.get(n.featureId) ?? orphanKey;
    if (!byAnchor.has(anchor)) byAnchor.set(anchor, []);
    byAnchor.get(anchor)!.push(n);
  }

  const sortProtos = (list: LogicTreeLayerNode[]) =>
    [...list].sort((a, b) => {
      const ka = resolveTask5LogicTreeFeatureKey(a);
      const kb = resolveTask5LogicTreeFeatureKey(b);
      const oa = TASK8_KEY_ORDER[ka] ?? 9;
      const ob = TASK8_KEY_ORDER[kb] ?? 9;
      if (oa !== ob) return oa - ob;
      const va = String(a.display?.name ?? '').trim();
      const vb = String(b.display?.name ?? '').trim();
      return va.localeCompare(vb, 'zh-CN') || a.featureId.localeCompare(b.featureId, 'zh-CN');
    });

  const blocks: Task8CollaborationBlock[] = [];
  for (const collab of t7Collabs) {
    const group = byAnchor.get(collab.featureId);
    if (!group?.length) continue;
    blocks.push({
      anchorNode: collab,
      prototypeNodes: sortProtos(group),
    });
    byAnchor.delete(collab.featureId);
  }

  const orphanNodes = byAnchor.get(orphanKey);
  if (orphanNodes?.length) {
    blocks.push({
      anchorNode: null,
      prototypeNodes: sortProtos(orphanNodes),
    });
  }

  for (const [anchorFid, group] of byAnchor) {
    if (!group.length || anchorFid === orphanKey) continue;
    blocks.push({
      anchorNode: t7ByFid.get(anchorFid) ?? null,
      prototypeNodes: sortProtos(group),
    });
  }

  return blocks;
}

/** 任务 8 协作子块横向间距 */
export function logicTreeTask8BlockGapPx(blockCount: number): number {
  const n = Math.max(1, Math.ceil(blockCount));
  if (n <= 1) return 0;
  if (n === 2) return 48;
  if (n === 3) return 40;
  if (n === 4) return 32;
  return 24;
}

const TASK8_SLOT_PX = 81;

function collaborationBlockContentWidthPx(nodeCount: number): number {
  const n = Math.max(1, Math.ceil(nodeCount));
  return Math.max(260, n * TASK8_SLOT_PX + 56);
}

/** 任务 8 轨道最小宽度（多子块横向居中排列；按各块内节点数估算块宽） */
export function logicTreeTask8LayerTrackMinWidthPx(blocks: ReadonlyArray<Task8CollaborationBlock>): number {
  const n = Math.max(1, blocks.length);
  const gap = logicTreeTask8BlockGapPx(n);
  const sidePad = n <= 1 ? 120 : n === 2 ? 100 : 80;
  let content = 0;
  for (const b of blocks) {
    content += collaborationBlockContentWidthPx(b.prototypeNodes.length);
  }
  content += Math.max(0, n - 1) * gap;
  return Math.max(720, content + sidePad * 2);
}
