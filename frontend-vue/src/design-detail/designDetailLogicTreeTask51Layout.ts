/**
 * [INPUT]: 任务 5.1 层 `LogicTreeLayerNode`、task-graph 任务卡与已有跨层边
 * [OUTPUT]: 两层子布局（价值主张 / 业务能力单元）、轨道最小宽度、层内主张→能力合成正向边（历史数据兜底）
 * [POS]: `DesignDetailLogicTreeModal.vue` 任务 5.1 专用渲染（第一层价值主张、第二层业务能力）
 *
 * [PROTOCOL]: 变更 featureKey 分层或排序时同步 `designDetailLogicTreeLayout.ts` 与 `buildTask51IntraValuePropositionForwardLinks`（后端落库）；Tree 合成边仅补全缺失 VP→能力对
 */

import {
  DESIGN_DETAIL_TASK51_LINE_TASK_ID,
  type DesignDetailLogicGraphLinkDto,
  type DesignDetailLogicGraphTaskDto,
  normLogicTaskId,
} from './designDetailLogicGraphMerge';
import {
  logicTreeLayerTrackMinWidthPx,
  resolveTask5LogicTreeFeatureKey,
  type LogicTreeLayerNode,
} from './designDetailLogicTreeLayout';

export function isTask51ValuePropositionFeatureKey(key: string): boolean {
  const k = String(key || '').trim();
  return k === '核心价值主张' || k === '交付模式定性';
}

export function isTask51BusinessCapabilityUnitFeatureKey(key: string): boolean {
  return String(key || '').trim() === '业务能力单元';
}

export function isTask51ValuePropositionNode(node: LogicTreeLayerNode): boolean {
  return isTask51ValuePropositionFeatureKey(resolveTask5LogicTreeFeatureKey(node));
}

export function isTask51CapabilityUnitNode(node: LogicTreeLayerNode): boolean {
  return isTask51BusinessCapabilityUnitFeatureKey(resolveTask5LogicTreeFeatureKey(node));
}

export type Task51TwoTierLayout = {
  valuePropositionNodes: LogicTreeLayerNode[];
  capabilityNodes: LogicTreeLayerNode[];
};

function vpSortIndex(key: string): number {
  if (key === '核心价值主张') return 0;
  if (key === '交付模式定性') return 1;
  return 99;
}

export function sortTask51TwoTierNodesInPlace(layout: Task51TwoTierLayout): void {
  layout.valuePropositionNodes.sort((a, b) => {
    const ia = vpSortIndex(resolveTask5LogicTreeFeatureKey(a));
    const ib = vpSortIndex(resolveTask5LogicTreeFeatureKey(b));
    if (ia !== ib) return ia - ib;
    return String(a.display?.name ?? '').localeCompare(String(b.display?.name ?? ''), 'zh-CN');
  });
  layout.capabilityNodes.sort((a, b) =>
    String(a.display?.name ?? '').localeCompare(String(b.display?.name ?? ''), 'zh-CN'),
  );
}

export function buildTask51TwoTierLayout(
  nodes: ReadonlyArray<LogicTreeLayerNode>,
): Task51TwoTierLayout {
  const valuePropositionNodes: LogicTreeLayerNode[] = [];
  const capabilityNodes: LogicTreeLayerNode[] = [];
  for (const n of nodes) {
    if (isTask51CapabilityUnitNode(n)) capabilityNodes.push(n);
    else if (isTask51ValuePropositionNode(n)) valuePropositionNodes.push(n);
    else capabilityNodes.push(n);
  }
  const layout = { valuePropositionNodes, capabilityNodes };
  sortTask51TwoTierNodesInPlace(layout);
  return layout;
}

export function flattenTask51TwoTierLayout(layout: Task51TwoTierLayout): LogicTreeLayerNode[] {
  return [...layout.valuePropositionNodes, ...layout.capabilityNodes];
}

export function logicTreeTask51LayerTrackMinWidthPx(layout: Task51TwoTierLayout): number {
  const n = Math.max(
    layout.valuePropositionNodes.length,
    layout.capabilityNodes.length,
    1,
  );
  return logicTreeLayerTrackMinWidthPx(n);
}

function linkEndpointPairKey(
  l: Pick<DesignDetailLogicGraphLinkDto, 'sourceFeatureId' | 'targetFeatureId' | 'source' | 'target'>,
): string {
  const sid = String(l.sourceFeatureId ?? l.source?.featureId ?? '').trim();
  const tid = String(l.targetFeatureId ?? l.target?.featureId ?? '').trim();
  return sid && tid ? `${sid}\t${tid}` : '';
}

/**
 * 任务 5.1 Tree：为尚未落库的「价值主张 → 业务能力单元」对合成正向归纳边（与后端 `buildTask51IntraValuePropositionForwardLinks` 对齐）。
 */
export function synthesizeTask51VpToCapabilityGraphLinks(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  baseLinks: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
): DesignDetailLogicGraphLinkDto[] {
  const t51 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK51_LINE_TASK_ID);
  if (!t51?.features?.length) return [];

  const nodes: LogicTreeLayerNode[] = [];
  for (const f of t51.features) {
    const fid = String(f.featureId ?? '').trim();
    if (!fid) continue;
    nodes.push({
      featureId: fid,
      taskId: DESIGN_DETAIL_TASK51_LINE_TASK_ID,
      display: f,
    });
  }
  const layout = buildTask51TwoTierLayout(nodes);
  if (!layout.valuePropositionNodes.length || !layout.capabilityNodes.length) return [];

  const existing = new Set<string>();
  for (const L of baseLinks) {
    const k = linkEndpointPairKey(L);
    if (k) existing.add(k);
  }

  const out: DesignDetailLogicGraphLinkDto[] = [];
  let synthIdx = 0;
  for (const vp of layout.valuePropositionNodes) {
    const vpKey = resolveTask5LogicTreeFeatureKey(vp);
    const vpText = task51ValuePropositionCardPrimaryText(vp);
    for (const cap of layout.capabilityNodes) {
      const pair = `${vp.featureId}\t${cap.featureId}`;
      if (existing.has(pair)) continue;
      existing.add(pair);
      const capLabel = String(cap.display?.name ?? '').trim() || '业务能力单元';
      out.push({
        linkId: `__synth_task51_vp_cap_${synthIdx++}`,
        name: '主张→能力',
        linkKind: '正向归纳',
        themeKey: 'task51-intra-vp',
        pillBatchKey: 'synth-0',
        sourceFeatureId: vp.featureId,
        targetFeatureId: cap.featureId,
        logic:
          vpKey === '交付模式定性'
            ? `正向归纳：交付模式定性向业务能力单元「${capLabel}」补充传导（交付模式与能力单元对齐）`
            : `正向归纳：核心价值主张「${vpText.slice(0, 64)}」→业务能力单元「${capLabel}」（主张→能力权重穿透）`,
        weight: vpKey === '交付模式定性' ? 0.7 : 0.85,
        source: vp.display,
        target: cap.display,
      });
    }
  }
  return out;
}

/** 价值主张层主文案：Feature_Value（`display.name`） */
export function task51ValuePropositionCardPrimaryText(node: LogicTreeLayerNode): string {
  const name = String(node.display?.name ?? '').trim();
  if (name) return name;
  const raw = node.display?.value;
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}
