/**
 * [INPUT]: 任务 9 层 `LogicTreeLayerNode`、逻辑边、任务 8.5 锚点序
 * [OUTPUT]: 按「系统一级模块」分组的子块（V4.1：仅宏观大伞 + Tech_Host_Platform，无二级菜单行）
 * [POS]: `DesignDetailLogicTreeModal.vue` 任务 9 层专用渲染
 *
 * [PROTOCOL]: 块序与任务 8.5 物理外挂特征左→右一致；变更时同步 Modal 样式与任务 9 提示词
 */

import {
  type DesignDetailLogicGraphLinkDto,
  DESIGN_DETAIL_TASK85_LINE_TASK_ID,
  isDesignDetailReverseValidationLogicLink,
} from './designDetailLogicGraphMerge';
import {
  resolveTask5LogicTreeFeatureKey,
  type LogicTreeLayerNode,
} from './designDetailLogicTreeLayout';

export type Task9ModuleBlock = {
  moduleNode: LogicTreeLayerNode | null;
  /** V4.1 无二级菜单；保留字段供历史数据兼容渲染 */
  menuNodes: LogicTreeLayerNode[];
};

const MODULE_KEY = '系统一级模块';

export function isTask9ModuleNode(node: LogicTreeLayerNode): boolean {
  return resolveTask5LogicTreeFeatureKey(node) === MODULE_KEY;
}

/** @deprecated V4.1 任务 9 不再产出二级功能菜单；保留供历史图数据 */
export function isTask9MenuNode(node: LogicTreeLayerNode): boolean {
  return resolveTask5LogicTreeFeatureKey(node) === '二级功能菜单';
}

function nodeDisplayValue(node: LogicTreeLayerNode): string {
  return String(node.display?.name ?? '').trim();
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

/** 任务 9 本层一级模块 → 二级菜单正向归纳边（历史契约） */
export function isTask9IntraModuleMenuForwardLink(
  l: DesignDetailLogicGraphLinkDto,
  featureIdToNormTaskId: Map<string, string>,
  task9NodeIds: ReadonlySet<string>,
): boolean {
  if (!isForwardLink(l, featureIdToNormTaskId)) return false;
  const sid = linkSourceId(l);
  const tid = linkTargetId(l);
  if (!sid || !tid || !task9NodeIds.has(sid) || !task9NodeIds.has(tid)) return false;
  const logic = linkLogicText(l);
  if (logic.includes('一级模块→二级功能菜单')) return true;
  if (logic.includes('横向') && logic.includes('一级模块')) return true;
  if (logic.includes('双源复合') || logic.includes('Belongs_To_Primary_Module')) return true;
  return false;
}

/** 任务 8.5 技术集成特征在层内的左→右序 */
function buildTask85FeatureOrderIndex(
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

function buildTask9ToT85AnchorRankMap(
  task9Nodes: ReadonlyArray<LogicTreeLayerNode>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  featureIdToNormTaskId: Map<string, string>,
  t85Order: Map<string, number>,
): Map<string, number> {
  const UNKNOWN = 1_000_000;
  const out = new Map<string, number>();
  for (const n of task9Nodes) {
    const t9id = n.featureId;
    let best = UNKNOWN;
    for (const L of links) {
      if (!isForwardLink(L, featureIdToNormTaskId)) continue;
      if (linkTargetId(L) !== t9id) continue;
      const src = linkSourceId(L);
      if (!src) continue;
      if (featureIdToNormTaskId.get(src) !== DESIGN_DETAIL_TASK85_LINE_TASK_ID) continue;
      const idx = t85Order.get(src);
      if (idx !== undefined && idx < best) best = idx;
    }
    out.set(t9id, best);
  }
  return out;
}

/**
 * 将任务 9 节点按「系统一级模块」拆为子块（V4.1：每块仅含一级模块大伞卡，无二级菜单层）。
 */
export function buildTask9ModuleBlocks(
  task9Nodes: ReadonlyArray<LogicTreeLayerNode>,
  nodesByLayer: Map<string, LogicTreeLayerNode[]>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
  featureIdToNormTaskId: Map<string, string>,
): Task9ModuleBlock[] {
  const modules = task9Nodes.filter(isTask9ModuleNode);
  const legacyMenus = task9Nodes.filter(isTask9MenuNode);
  if (!modules.length && !legacyMenus.length) return [];

  const rankMap = buildTask9ToT85AnchorRankMap(
    modules,
    links,
    featureIdToNormTaskId,
    buildTask85FeatureOrderIndex(nodesByLayer),
  );

  const sortedModules = [...modules].sort((a, b) => {
    const ra = rankMap.get(a.featureId) ?? 1_000_000;
    const rb = rankMap.get(b.featureId) ?? 1_000_000;
    if (ra !== rb) return ra - rb;
    return (
      nodeDisplayValue(a).localeCompare(nodeDisplayValue(b), 'zh-CN') ||
      a.featureId.localeCompare(b.featureId, 'zh-CN')
    );
  });

  const blocks: Task9ModuleBlock[] = sortedModules.map((mod) => ({
    moduleNode: mod,
    menuNodes: [],
  }));

  if (legacyMenus.length) {
    blocks.push({
      moduleNode: null,
      menuNodes: [...legacyMenus].sort((a, b) =>
        nodeDisplayValue(a).localeCompare(nodeDisplayValue(b), 'zh-CN'),
      ),
    });
  }

  return blocks.filter((b) => b.moduleNode || b.menuNodes.length > 0);
}

/** 任务 9 一级模块子块横向间距（对齐任务 7 流程子块疏朗度） */
export function logicTreeTask9BlockGapPx(blockCount: number): number {
  const n = Math.max(1, Math.ceil(blockCount));
  if (n <= 1) return 0;
  if (n === 2) return 56;
  if (n === 3) return 44;
  if (n === 4) return 36;
  if (n === 5) return 30;
  return 24;
}

/** 单块基准宽度（与任务 7 `LOGIC_TREE_TASK7_PROCESS_BLOCK_WIDTH_PX` 一致） */
export const LOGIC_TREE_TASK9_MODULE_BLOCK_WIDTH_PX = 520;

/** 任务 9 轨道最小宽度：子块总宽 + 间距 + 两侧留白 */
export function logicTreeTask9LayerTrackMinWidthPx(blocks: ReadonlyArray<Task9ModuleBlock>): number {
  const n = Math.max(1, blocks.length);
  const gap = logicTreeTask9BlockGapPx(n);
  const sidePad = n <= 1 ? 156 : n === 2 ? 140 : n === 3 ? 125 : 94;
  const content = n * LOGIC_TREE_TASK9_MODULE_BLOCK_WIDTH_PX + Math.max(0, n - 1) * gap;
  return Math.max(936, content + sidePad * 2);
}
