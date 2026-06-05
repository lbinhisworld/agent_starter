<!--
  [INPUT]: `visible`、`caseId`、**`graphRefreshTick`**（递增时若已可见则再拉 **`GET …/task-graph`**）；`SmartCto.problemCaseApi.getDesignDetailTaskGraph`
  [OUTPUT]: 全屏「逻辑树」（Teleport **占满视口**：`dd-tree-backdrop` 无外边距、`dd-tree-panel` **通栏 100%×100dvh** 白底；`dd-tree-canvas` **`flex:1`** 占满标题与说明下方剩余空间）；标题栏 **「下载 JSON」**（**`designDetailLogicTreeJsonExport`**，完整 `task-graph` DAG）与 **「下载 PNG」**（关闭左侧）经 **`designDetailLogicTreePngExport`** 导出 **2～3×** 高清图（含标题 + 横纵滚动全图）；由 **`designDetailLogicTreeLayout`** 从 `DesignLogicLink` 提取端点特征并按 `taskId` 分层（含 **任务 4** 层：聚合任务 2/3/4 卡上 `links[]` + **任务 1 卡上 `linkKind`＝「反向验证」**（任务 2 L1 / **任务 3 L2** / **任务 4 L2** 之 **`Token_Validation_Mapping`** 落库）+ **`appendTask4OrphanEndpointNodes`**）；**任务 0 层**（L0-工具原语）：默认 **`.dd-tree-card--task0`** 青绿；**企业微信** **`dd-tree-card--task0-wecom`** 海蓝、**七巧低代码** **`dd-tree-card--task0-qiqiao`** 紫；**自任务 0 节点发出的正向归纳边** **紫色**（**`dd-tree-edge--task0-fi`**）；**任务 1 层**：仅展示至少一端落在 **正向归纳** 边上的节点（**`痛点雷达/`**、**`现有表格/`** 无正向归纳边则不展示）；**`sortTask1LayerNodesInPlace`** 痛点最左、现有表格次之；**PAIN** 角标仅 **`painPointConfirmed`**；**默认**不绘 **无冲突绿色** 反向验证虚线（**focus** 下自锚点至任务 1 的绿脉动边才展示）；**各层节点**标题栏上方卡内展示 **`formatLogicTreeFeatureIdShortLabel`**（蓝字 **`FT***`末四位**）；**每层行首标题**：**`logicTreeInferenceLayerTierLabelByNormTaskId`**（**绿色加粗**，如 **L1-实体画像层**）+ 全角 **`｜`** + **`canonicalLogicGraphTaskTitleByNormTaskId`** / **`layerDisplayTitle`** 任务名（例：**L1-实体画像层 ｜ 任务 1：客户基本情况了解**）；并对 **`GET …/task-graph`** 结果执行 **`dedupeLogicGraphTasksByNormTaskId`**；各层轨道 **flex 横向等分**，层内卡片 **stretch 等高**；**节点槽 / 特征卡** 宽度在已缩窄 30%（×0.7）基础上再缩窄 **15%**（×0.85），合约为原设计的 **×0.595**（`.dd-tree-node-slot` 与 **`logicTreeLayerTrackMinWidthPx`** 同口径）；**Feature token** 为 **蓝底白字** 子标签；**value** 最多 **5 行**；**仅当 value 被截断** 时 **点击** 旁侧 **`position:fixed`** 浮层全文；**点击节点**进入 **focus**：**正向归纳**边沿 **target←source** 闭包得 **蓝色脉动**节点（**任务 0 出发** 高亮边 **紫色**）；**反向验证**且源为当前节点、目标为任务 1 特征者得 **绿色脉动**任务 1 节点；**focus** 下悬停：**任务 1 绿脉动节点**（反向验证端点）展示 **节点编号**（`featureId`）；**蓝脉动推理节点**（`forwardInductionFocusFeatureSet` 且非任务 1）展示 **取值范围** / **推理结论** 双卡片白底浮层（离开卡片边框消失，与 **`edgeLogicTip`** 定位口径一致）；两类高亮边在 focus 下 **stroke-dashoffset** 循环流动（路径长 `--dd-edge-len`）；**focus 下仅绘 `edgePathFocusFlow` 高亮边**（其余边不渲染），且每条高亮边分 **线体**（`marker-end=none`）与 **仅箭头**（`dd-tree-edge--focus-marker-only`）两层，并加 **透明加宽命中层**（`dd-tree-edge-hit`）悬停展示 **`DesignLogicLink.logic`** 圆角浮层（正向 **蓝** / 反向一致 **绿** / 潜在冲突 **红**半透明，随指针移动，离开边消失）；其余节点 **淡灰**；**画布空白** `pointerdown` 或 **Esc**（无浮层时）退出 focus；**横向滚动条**上的 `pointerdown` **不**退出 focus；**`syncLayerRowHeights`**、层间行高 **36%** 间隙（原 30% 基础上 **×1.2**，即任务与任务之间间距增加 20%）；**SVG** 贝塞尔 + 箭头：端点 **TOP/BOTTOM** 水平中点（见脚本 **`updateEdgePaths`**）；**向上**（下层→上层）**下层 TOP → 上层 BOTTOM**（含反向验证到任务1）；**向下**（正向输出）**上层 BOTTOM → 下层 TOP**；**反向验证**边 **恒为虚线**（`dd-tree-edge--reverse`，含 focus 高亮）；**`validationConsistency`**：**仅**在 **`isTokenValidationMappingPotentialConflict`（与 TVM 一致）** 时为 **红**；**逻辑一致** / **已通过洞察修正** 为 **绿**；其余为默认蓝
  [POS]: `DesignDetailPage.vue` 顶栏 **Tree** 入口

  [PROTOCOL]: 与 `GET …/design-detail/task-graph`（含 **`features[].inferenceSummary`**）、`designDetailLogicGraphMerge.ts`、`designDetailLogicTreeLayout.ts` 同步；**反向边红/绿与 `designDetailTask2L1SyncUiProgress.isTokenValidationMappingPotentialConflict` 对齐**；**`graphRefreshTick`** 与 **`useDesignDetailChat.logicTreeGraphRefreshTick`** 对齐；边几何依赖 DOM 测量，变更布局时须重跑 `updateEdgePaths`；**TOP/BOTTOM 锚点与虚线反向边** 规则变更时须同步 **`logicTreeFeatureLayerIndex`** 与 `AGENTS.md`；**focus 推理节点悬停浮层** 与 **`edgeLogicTip`** 一并维护关闭路径
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch, withDefaults, type ComponentPublicInstance } from 'vue';
import {
  type DesignDetailLogicGraphLinkDto,
  type DesignDetailLogicGraphTaskDto,
  canonicalLogicGraphTaskTitleByNormTaskId,
  dedupeLogicGraphTasksByNormTaskId,
  logicTreeInferenceLayerTierLabelByNormTaskId,
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
  DESIGN_DETAIL_TASK0_LINE_TASK_ID,
  LOGIC_GRAPH_TASK0_TITLE,
  LOGIC_GRAPH_TASK1_TITLE,
  buildFeatureIdToNormTaskIdFromGraphTasks,
  enrichLogicGraphLinksWithFeatureEndpoints,
  isDesignDetailReverseValidationLogicLink,
  logicGraphLinkIdOf,
  mergeCustomerRequirementIntoBasicForLogicGraph,
  normalizeLogicGraphTasksAfterFetch,
  normLogicTaskId,
  pickPreferredReverseValidationLink,
  reverseValidationLinkEndpointPairKey,
} from './designDetailLogicGraphMerge';
import {
  appendTask0OrphanEndpointNodes,
  appendTool0PrimitiveLayerNodes,
  extendFeatureIdToNormTaskIdWithTool0Primitives,
  mergeLayerOrderWithTool0Primitive,
  mergeLogicTreeLayerOrderWithOrphanLayers,
  appendTask1PainPointRadarEndpointNodes,
  appendTask1ExistingSpreadsheetEndpointNodes,
  appendTask2OrphanEndpointNodes,
  appendTask3OrphanEndpointNodes,
  appendTask4OrphanEndpointNodes,
  appendTask5OrphanEndpointNodes,
  appendTask51OrphanEndpointNodes,
  appendTask52OrphanEndpointNodes,
  appendTask53OrphanEndpointNodes,
  mergeTask53AllFeatureNodesOntoLayer,
  appendTask55OrphanEndpointNodes,
  appendTask6OrphanEndpointNodes,
  appendTask65OrphanEndpointNodes,
  appendTask7OrphanEndpointNodes,
  appendTask8OrphanEndpointNodes,
  appendTask85OrphanEndpointNodes,
  appendTask9OrphanEndpointNodes,
  appendTask10OrphanEndpointNodes,
  enrichTask1LayerPainBadgeFromTaskFeatures,
  enrichTask10LayerTechHostFromTaskFeatures,
  isTask1PainPointRadarLogicTreeNode,
  isTask0WeComLogicTreeNode,
  isTask0QiQiaoLowCodeLogicTreeNode,
  isTask1ExistingSpreadsheetLogicTreeNode,
  sortTask1LayerNodesInPlace,
  sortTask4LayerNodesInPlace,
  sortTask5LayerNodesInPlace,
  sortTask51LayerNodesInPlace,
  sortTask52LayerNodesInPlace,
  sortTask53LayerNodesInPlace,
  sortTask55LayerNodesInPlace,
  sortTask6LayerNodesInPlace,
  sortTask65LayerNodesInPlace,
  sortTask7LayerNodesInPlace,
  sortTask8LayerNodesInPlace,
  sortTask85LayerNodesInPlace,
  sortTask9LayerNodesInPlace,
  isTask5ValueStreamStageLogicTreeNode,
  extractEndpointFeaturesByTaskFromLinks,
  formatLogicTreeFeatureIdShortLabel,
  formatLogicTreeFeatureValueLine,
  formatLogicTreeTask10FeatureValueLine,
  resolveTask5LogicTreeFeatureKey,
  logicTreeFeatureLayerIndex,
  logicTreeLayerTrackMinWidthPx,
  type LogicTreeLayerNode,
} from './designDetailLogicTreeLayout';
import { isTask1FeaturePainPointConfirmed } from './designDetailPainPointConfirmed';
import { isLogicTreeFeatureResolvedByCustomer } from './designDetailLogicTreeValidationStatus';
import {
  buildTask7CollaborationNodesInTreeVisualOrder,
  buildTask7ProcessBlocks,
  logicTreeTask7BlockGapPx,
  logicTreeTask7LayerTrackMinWidthPx,
  type Task7ProcessBlock,
} from './designDetailLogicTreeTask7Layout';
import {
  buildTask51TwoTierLayout,
  flattenTask51TwoTierLayout,
  logicTreeTask51LayerTrackMinWidthPx,
  synthesizeTask51VpToCapabilityGraphLinks,
  task51ValuePropositionCardPrimaryText,
  type Task51TwoTierLayout,
} from './designDetailLogicTreeTask51Layout';
import {
  buildTask65ThreeGapBoxLayout,
  chunkTask65GapNodesForGrid,
  flattenTask65ThreeGapBoxLayout,
  logicTreeTask65LayerTrackMinWidthPx,
  TASK65_LOGIC_TREE_NODE_SLOT_WIDTH_PX,
  TASK65_LOGIC_TREE_NODES_PER_ROW,
  type Task65GapBox,
} from './designDetailLogicTreeTask65Layout';
import { DESIGN_DETAIL_EXCEL_FIELD_ICON_URL } from './designDetailExcelFieldIconUrl';
import {
  chunkTask52FieldTagsForGrid,
  logicTreeTask52LayerTrackMinWidthPx,
  TASK52_LOGIC_TREE_CARD_WIDTH_PX,
  TASK52_LOGIC_TREE_FIELD_TAGS_PER_ROW,
  task52FieldSchemaLeavesFromNode,
  task52FieldSetCardTitle,
  task52FieldTagPaddingRowCount,
  task52FieldTagRowKey,
  task52FieldTagTooltip,
  task52MaxFieldTagRowCount,
  synthesizeTask52CapabilityToFieldSetGraphLinks,
} from './designDetailLogicTreeTask52Layout';
import {
  buildTask53StepFeatureIdLookup,
  buildTask53StepFeatureIdSet,
  filterTask53TreeRenderLinks,
  isTask53WorkflowGraphFeatureRow,
  logicTreeTask53CardWidthPx,
  logicTreeTask53LayerTrackMinWidthPx,
  isTask53WorkflowStepLayerNode,
  task53StepFeatureIdsForWorkflowTitle,
  task53WorkflowFeatureDisplayById,
  synthesizeTask51CapabilityToStepGraphLinks,
  synthesizeTask52FieldSetToStepGraphLinks,
  synthesizeTask52FieldSetToWorkflowGraphLinks,
  task53GraphHasStepFeatureNodes,
  task53StepCardTitle,
  task53StepFeatureIdForWorkflowAndStep,
  task53StepMetaFromNode,
  task53WorkflowCardTitle,
  task53WorkflowOrderedStepsFromNode,
} from './designDetailLogicTreeTask53Layout';
import {
  buildTask8CollaborationBlocks,
  logicTreeTask8BlockGapPx,
  logicTreeTask8LayerTrackMinWidthPx,
  type Task8CollaborationBlock,
} from './designDetailLogicTreeTask8Layout';
import {
  buildTask9ModuleBlocks,
  isTask9IntraModuleMenuForwardLink,
  logicTreeTask9BlockGapPx,
  logicTreeTask9LayerTrackMinWidthPx,
  type Task9ModuleBlock,
} from './designDetailLogicTreeTask9Layout';
import {
  buildTask10LayerBlocks,
  buildTask10FeatureMetaById,
  logicTreeTask10BlockGapPx,
  logicTreeTask10LayerTrackMinWidthPx,
  sortTask10LayerNodesInPlace,
  TASK10_PLATFORM_INTEGRATION_BLOCK_LABEL,
  type Task10HostPlatformBlock,
  type Task10IntegrationBlock,
} from './designDetailLogicTreeTask10Layout';
import {
  buildLogicTreePngFilename,
  downloadLogicTreePageAsPng,
} from './designDetailLogicTreePngExport';
import { downloadLogicTreeDagJson } from './designDetailLogicTreeJsonExport';
import { isTokenValidationMappingPotentialConflict } from './designDetailTask2L1SyncUiProgress';
import {
  buildToolSuitePrimitiveGraphFeatures,
  hydrateToolSuiteKnowledgeForDesign,
  type ToolSuitePrimitiveGraphFeature,
} from './designDetailToolSuitePrimitiveSource';

const props = withDefaults(
  defineProps<{
    visible: boolean;
    caseId: string;
    /** 任务 2 L1 同步等场景由页面上推递增；Modal 已打开时触发再拉推理图 */
    graphRefreshTick?: number;
  }>(),
  { graphRefreshTick: 0 },
);

const emit = defineEmits<{ close: []; /** 任务 0 层节点已绘制（供设计页自动进入任务 1） */ task0LayerReady: [] }>();

/** 本次打开 Tree 仅上报一次任务 0 层就绪 */
let task0LayerReadyEmitted = false;

/** 递增以丢弃过期的 fetchGraph，避免并发请求把 loading 状态弄乱 */
let fetchGraphSeq = 0;

const loading = ref(false);
const loadError = ref<string | null>(null);
const tasks = ref<DesignDetailLogicGraphTaskDto[]>([]);
const toolSuitePrimitiveFeatures = ref<ToolSuitePrimitiveGraphFeature[]>([]);
const treePanelRef = ref<HTMLElement | null>(null);
const treePageExportRef = ref<HTMLElement | null>(null);
const canvasRoot = ref<HTMLElement | null>(null);
const treeHScrollRef = ref<HTMLElement | null>(null);
const treeScrollInnerRef = ref<HTMLElement | null>(null);
const pngExporting = ref(false);
type EdgePathItem = {
  d: string;
  sid: string;
  tid: string;
  pathLen: number;
  isRv: boolean;
  tone?: 'val-ok' | 'val-warn';
  /** 任务 9 本层一级模块 → 二级菜单（双源横向 + 落库合成边，块内垂直连线） */
  task9Intra?: boolean;
  /** 源端在任务 0 层的正向归纳边（紫色） */
  task0Forward?: boolean;
  /** 源端在任务 8 层 → 任务 8.5 的正向归纳边（琥珀色） */
  task8Forward?: boolean;
  /** 目标为任务 5.3「流程环节」的正向归纳边（紫色；绘于节点上层 SVG 以免被流程卡遮挡） */
  task53StepForward?: boolean;
  linkId: string;
  logicText: string;
};

type EdgeLogicTipTheme = 'fi' | 'rv-ok' | 'rv-warn';

/** focus 模式下悬停连接线时，在指针处展示推理逻辑 */
const edgeLogicTip = ref<{
  text: string;
  top: number;
  left: number;
  maxWidth: number;
  theme: EdgeLogicTipTheme;
} | null>(null);

/** focus 悬停浮层：任务 1 绿脉动节点展示编号；其余蓝脉动推理节点展示取值范围与推理结论 */
type NodeFeatureTipState =
  | {
      kind: 'task1_feature_id';
      featureId: string;
      top: number;
      left: number;
      maxWidth: number;
    }
  | {
      kind: 'inference_meta';
      valueRefDomainText: string;
      inferenceSummaryText: string;
      top: number;
      left: number;
      maxWidth: number;
    };

const nodeFeatureTip = ref<NodeFeatureTipState | null>(null);

const edgePathItems = ref<EdgePathItem[]>([]);

/** SVG `marker-end` 用 id，避免多实例冲突 */
const treeSvgUid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
const arrowMarkerId = `ddlt-arr-${treeSvgUid}`;
const arrowMarkerDimId = `ddlt-arr-dim-${treeSvgUid}`;
const arrowMarkerOkId = `ddlt-arr-ok-${treeSvgUid}`;
const arrowMarkerWarnId = `ddlt-arr-warn-${treeSvgUid}`;
const arrowMarkerTask0Id = `ddlt-arr-task0-${treeSvgUid}`;
const arrowMarkerTask8Id = `ddlt-arr-task8-${treeSvgUid}`;

/** 画布内选中的特征：正向归纳上游闭包（蓝）+ 自该点发出的反向验证任务 1 端点（绿） */
const focusFeatureId = ref<string | null>(null);

/** 点击节点后展示完整 value（视口坐标 px） */
const valuePopover = ref<{
  featureId: string;
  text: string;
  top: number;
  left: number;
  maxWidth: number;
  maxHeight: number;
} | null>(null);

let valuePopoverOutsideCloser: ((e: Event) => void) | null = null;

function detachValuePopoverOutsideCloser() {
  if (valuePopoverOutsideCloser && typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', valuePopoverOutsideCloser, true);
  }
  valuePopoverOutsideCloser = null;
}

function closeValuePopover() {
  valuePopover.value = null;
  detachValuePopoverOutsideCloser();
}

function closeEdgeLogicTip() {
  edgeLogicTip.value = null;
}

function closeNodeFeatureTip() {
  nodeFeatureTip.value = null;
}

function logicBodyForTreeLink(link: DesignDetailLogicGraphLinkDto): string {
  const raw = link.logic;
  if (raw != null && String(raw).trim().length) return String(raw).trim();
  const nm = String(link.name ?? '').trim();
  return nm || '—';
}

function edgeLogicTipThemeForItem(item: EdgePathItem): EdgeLogicTipTheme {
  if (!item.isRv) return 'fi';
  if (item.tone === 'val-warn') return 'rv-warn';
  return 'rv-ok';
}

function placeEdgeLogicTipAtPointer(e: PointerEvent, item: EdgePathItem) {
  const text = String(item.logicText || '').trim() || '—';
  const pad = 12;
  const offset = 14;
  const maxWidth = Math.min(352, Math.max(160, window.innerWidth - pad * 2));
  let left = e.clientX + offset;
  let top = e.clientY + offset;
  const estH = 88;
  if (left + maxWidth > window.innerWidth - pad) {
    left = Math.max(pad, e.clientX - maxWidth - offset);
  }
  if (top + estH > window.innerHeight - pad) {
    top = Math.max(pad, e.clientY - estH - offset);
  }
  edgeLogicTip.value = {
    text,
    left,
    top,
    maxWidth,
    theme: edgeLogicTipThemeForItem(item),
  };
}

function onFocusEdgePointerEnter(item: EdgePathItem, e: PointerEvent) {
  if (!focusModeActive.value) return;
  const flow = edgePathFocusFlow(item);
  if (flow !== 'fi' && flow !== 'rv') return;
  placeEdgeLogicTipAtPointer(e, item);
}

function onFocusEdgePointerMove(item: EdgePathItem, e: PointerEvent) {
  if (!focusModeActive.value || !edgeLogicTip.value) return;
  const flow = edgePathFocusFlow(item);
  if (flow !== 'fi' && flow !== 'rv') return;
  placeEdgeLogicTipAtPointer(e, item);
}

function onFocusEdgePointerLeave() {
  closeEdgeLogicTip();
}

function isValueRefDomainNaLike(raw: string): boolean {
  const t = String(raw || '').trim();
  if (!t) return true;
  const squish = t.toUpperCase().replace(/\s+/g, '').replace(/／/g, '/');
  if (squish === 'N/A' || squish === 'NA' || squish === 'NONE') return true;
  return /^n\/?a$/i.test(t);
}

function featureTipBodyText(raw: unknown, opts?: { treatNaAsDash?: boolean }): string {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  if (opts?.treatNaAsDash && isValueRefDomainNaLike(s)) return '—';
  return s;
}

function valueRefDomainTipText(f: LogicTreeLayerNode['display']): string {
  const raw = f.valueRefDomain ?? f.value_ref_domain;
  return featureTipBodyText(raw, { treatNaAsDash: true });
}

function inferenceSummaryTipText(f: LogicTreeLayerNode['display']): string {
  const raw = f.inferenceSummary ?? f.inference_summary;
  return featureTipBodyText(raw);
}

function isTask1LayerTaskId(taskId: string): boolean {
  return normLogicTaskId(taskId) === 'customer_basic';
}

/** 任务 1 绿脉动：自锚点发出的反向验证所连端点 */
function isTask1ReverseValidationFocusNode(taskId: string, featureId: string): boolean {
  if (!focusModeActive.value || !isTask1LayerTaskId(taskId)) return false;
  const fid = String(featureId || '').trim();
  return Boolean(fid && reverseValidationTask1FromFocusSet.value.has(fid));
}

/** 任务 1 层 focus 悬停展示节点编号：绿脉动端点，或当前 focus 锚点本身（点在任务 1 上时） */
function shouldShowTask1FeatureIdTip(taskId: string, featureId: string): boolean {
  if (!focusModeActive.value || !isTask1LayerTaskId(taskId)) return false;
  const fid = String(featureId || '').trim();
  if (!fid) return false;
  if (isTask1ReverseValidationFocusNode(taskId, fid)) return true;
  return fid === String(focusFeatureId.value || '').trim();
}

/** focus 下可展示悬停浮层的节点：任务 1（编号）或正向归纳链（取值范围/推理结论） */
function shouldShowNodeFeatureTip(taskId: string, featureId: string): boolean {
  if (!focusModeActive.value) return false;
  const fid = String(featureId || '').trim();
  if (!fid) return false;
  if (shouldShowTask1FeatureIdTip(taskId, fid)) return true;
  if (isTask1LayerTaskId(taskId)) return false;
  return forwardInductionFocusFeatureSet.value.has(fid);
}

function placeNodeFeatureTipAtPointer(e: PointerEvent, node: LogicTreeLayerNode, taskId: string) {
  const pad = 12;
  const offset = 14;
  const maxWidth = Math.min(360, Math.max(168, window.innerWidth - pad * 2));
  let left = e.clientX + offset;
  let top = e.clientY + offset;
  const showTask1Id = shouldShowTask1FeatureIdTip(taskId, node.featureId);
  const estH = showTask1Id ? 72 : 168;
  if (left + maxWidth > window.innerWidth - pad) {
    left = Math.max(pad, e.clientX - maxWidth - offset);
  }
  if (top + estH > window.innerHeight - pad) {
    top = Math.max(pad, e.clientY - estH - offset);
  }
  const pos = { left, top, maxWidth };
  if (showTask1Id) {
    nodeFeatureTip.value = {
      kind: 'task1_feature_id',
      featureId: String(node.featureId || '').trim() || '—',
      ...pos,
    };
    return;
  }
  nodeFeatureTip.value = {
    kind: 'inference_meta',
    valueRefDomainText: valueRefDomainTipText(node.display),
    inferenceSummaryText: inferenceSummaryTipText(node.display),
    ...pos,
  };
}

function onNodeFeatureTipEnter(node: LogicTreeLayerNode, taskId: string, e: PointerEvent) {
  if (!shouldShowNodeFeatureTip(taskId, node.featureId)) return;
  closeEdgeLogicTip();
  placeNodeFeatureTipAtPointer(e, node, taskId);
}

function onNodeFeatureTipMove(node: LogicTreeLayerNode, taskId: string, e: PointerEvent) {
  if (!shouldShowNodeFeatureTip(taskId, node.featureId)) return;
  placeNodeFeatureTipAtPointer(e, node, taskId);
}

function onNodeFeatureTipLeave() {
  closeNodeFeatureTip();
}

function attachValuePopoverOutsideCloser() {
  detachValuePopoverOutsideCloser();
  if (typeof document === 'undefined') return;
  const fn = (e: Event) => {
    const t = e.target;
    if (!(t instanceof Node)) return;
    const pop = document.querySelector('.dd-tree-value-popover');
    if (pop && (pop === t || pop.contains(t))) return;
    const hitCard = (t as HTMLElement).closest?.('[data-dd-tree-node-card="1"]');
    if (hitCard) return;
    closeValuePopover();
  };
  valuePopoverOutsideCloser = fn;
  document.addEventListener('pointerdown', fn, true);
}

function isCardValueTruncated(cardRoot: HTMLElement): boolean {
  const valEl = cardRoot.querySelector('.dd-tree-card-val');
  if (!(valEl instanceof HTMLElement)) return false;
  return valEl.scrollHeight > valEl.clientHeight + 1;
}

function onNodeCardClick(node: LogicTreeLayerNode, e: Event, taskId?: string) {
  closeEdgeLogicTip();
  closeNodeFeatureTip();
  focusFeatureId.value = node.featureId;
  /** focus 下须重绘 SVG：非 focus 时 `val-ok` 反向边未写入 `edgePathItems` */
  void nextTick(() => refreshTreeLayout());
  const el = e.currentTarget;
  if (!(el instanceof HTMLElement)) return;
  const text = cardValueLine(node.display, taskId);
  if (!text || text === '—') {
    closeValuePopover();
    return;
  }
  if (!isCardValueTruncated(el)) {
    closeValuePopover();
    return;
  }
  const cur = valuePopover.value;
  if (cur?.featureId === node.featureId) {
    closeValuePopover();
    return;
  }
  const r = el.getBoundingClientRect();
  const pad = 10;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const maxW = Math.min(440, Math.max(200, vw - pad * 2));
  const gap = 10;
  let left = r.right + gap;
  if (left + maxW > vw - pad) {
    left = r.left - gap - maxW;
  }
  if (left < pad) left = pad;
  let top = r.top;
  const maxH = Math.min(360, vh - pad * 2);
  if (top + maxH > vh - pad) {
    top = Math.max(pad, vh - pad - maxH);
  }
  valuePopover.value = {
    featureId: node.featureId,
    text,
    top,
    left,
    maxWidth: maxW,
    maxHeight: maxH,
  };
  void nextTick(() => attachValuePopoverOutsideCloser());
}

const featureElByFeatureId = new Map<string, HTMLElement>();

function resolveRefEl(el: Element | ComponentPublicInstance | null): HTMLElement | null {
  const node = el && '$el' in el ? (el as { $el?: HTMLElement }).$el : (el as HTMLElement | null);
  return node instanceof HTMLElement ? node : null;
}

function setFeatureAnchor(featureId: string, el: Element | ComponentPublicInstance | null) {
  const id = String(featureId || '').trim();
  if (!id) return;
  const node = resolveRefEl(el);
  if (node) featureElByFeatureId.set(id, node);
  else featureElByFeatureId.delete(id);
}

/** 工作流卡内环节 chip 作为「流程环节」特征的 SVG 锚点（与落库 `featureId` 对齐） */
function registerTask53StepChipAnchor(
  el: Element | ComponentPublicInstance | null,
  workflowNode: LogicTreeLayerNode,
  stepName: string,
) {
  const fid = task53StepFeatureIdForWorkflowAndStep(
    task53StepFeatureIdLookup.value,
    task53WorkflowCardTitle(workflowNode),
    stepName,
  );
  if (fid) setFeatureAnchor(fid, el);
}

function formatTokenChinese(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return s;
  const parts = s.split(/\s*·\s*/);
  const left = parts[0]?.trim() ?? '';
  return left || s;
}

function cardTokenLine(f: LogicTreeLayerNode['display']): string {
  const a = f.tokenDisplay;
  const b = f.token_display;
  const raw = String((a != null ? a : b) ?? '').trim();
  if (!raw || raw === '—') return '';
  return formatTokenChinese(raw);
}

function cardValueLine(
  f: LogicTreeLayerNode['display'],
  taskId?: string,
  node?: LogicTreeLayerNode,
): string {
  if (taskId === DESIGN_DETAIL_TASK10_LINE_TASK_ID) {
    const key = node ? resolveTask5LogicTreeFeatureKey(node) : '';
    return formatLogicTreeTask10FeatureValueLine(f.name, key);
  }
  if (taskId === DESIGN_DETAIL_TASK52_LINE_TASK_ID && node) {
    return task52FieldSetCardTitle(node);
  }
  if (taskId === DESIGN_DETAIL_TASK53_LINE_TASK_ID && node) {
    return isTask53WorkflowStepLayerNode(node)
      ? task53StepCardTitle(node)
      : task53WorkflowCardTitle(node);
  }
  return formatLogicTreeFeatureValueLine(f.name);
}

function task52FieldTagRows(node: LogicTreeLayerNode) {
  return chunkTask52FieldTagsForGrid(task52FieldSchemaLeavesFromNode(node));
}

function cardOperatorLine(f: LogicTreeLayerNode['display']): string {
  const s = String(f.operator ?? '').trim();
  return s || '—';
}

/** 聚合任务 1 卡上 **反向校验** 边 + 任务 2/3/4 卡逻辑链（去重），供端点分层、focus 上游与 SVG 边 */
function collectLogicTreeCrossLinks(list: DesignDetailLogicGraphTaskDto[]): DesignDetailLogicGraphLinkDto[] {
  const out: DesignDetailLogicGraphLinkDto[] = [];
  const seenLinkId = new Set<string>();
  const rvByEndpointPair = new Map<string, DesignDetailLogicGraphLinkDto>();
  const fidToTask = buildFeatureIdToNormTaskIdFromGraphTasks(list);
  const rawLinks: DesignDetailLogicGraphLinkDto[] = [];
  for (const t of list) {
    for (const l of t.links ?? []) {
      rawLinks.push(l);
    }
  }
  const enrichedById = new Map<string, DesignDetailLogicGraphLinkDto>();
  for (const l of enrichLogicGraphLinksWithFeatureEndpoints(list, rawLinks)) {
    const id = logicGraphLinkIdOf(l);
    if (id) enrichedById.set(id, l);
  }
  for (const t of list) {
    const tid = normLogicTaskId(t.taskId);
    const fromTask234 =
      tid === DESIGN_DETAIL_TASK0_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK2_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK3_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK4_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK5_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK51_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK52_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK53_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK55_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK6_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK65_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK7_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK8_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK85_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK9_LINE_TASK_ID ||
      tid === DESIGN_DETAIL_TASK10_LINE_TASK_ID;
    const fromTask1Rv = tid === 'customer_basic';
    if (!fromTask234 && !fromTask1Rv) continue;
    for (const l of t.links ?? []) {
      const le = enrichedById.get(logicGraphLinkIdOf(l)) ?? l;
      if (fromTask1Rv && !isDesignDetailReverseValidationLogicLink(le, fidToTask)) continue;
      const id = logicGraphLinkIdOf(le);
      const sid = linkSourceFeatureId(le);
      const tgid = linkTargetFeatureId(le);
      if (!(le.source && le.target && id && sid && tgid)) continue;
      if (isDesignDetailReverseValidationLogicLink(le, fidToTask)) {
        const pairKey = reverseValidationLinkEndpointPairKey(le);
        if (!pairKey) continue;
        const prev = rvByEndpointPair.get(pairKey);
        rvByEndpointPair.set(pairKey, prev ? pickPreferredReverseValidationLink(prev, le) : le);
        continue;
      }
      if (seenLinkId.has(id)) continue;
      seenLinkId.add(id);
      out.push(le);
    }
  }
  for (const l of rvByEndpointPair.values()) {
    const id = logicGraphLinkIdOf(l);
    if (!id || seenLinkId.has(id)) continue;
    seenLinkId.add(id);
    out.push(l);
  }
  return out;
}

function linkTargetFeatureId(l: { targetFeatureId?: string; target?: { featureId?: string } | null }): string {
  return String(l.targetFeatureId ?? l.target?.featureId ?? '').trim();
}

function linkSourceFeatureId(l: { sourceFeatureId?: string; source?: { featureId?: string } | null }): string {
  return String(l.sourceFeatureId ?? l.source?.featureId ?? '').trim();
}

function isReverseValidationLinkKind(l: DesignDetailLogicGraphLinkDto): boolean {
  return isDesignDetailReverseValidationLogicLink(l, buildFeatureIdToNormTaskIdFromGraphTasks(tasks.value));
}

function isForwardInductionLinkKind(l: DesignDetailLogicGraphLinkDto): boolean {
  return !isReverseValidationLinkKind(l);
}

function validationEdgeTone(l: DesignDetailLogicGraphLinkDto): 'val-ok' | 'val-warn' | undefined {
  if (!isReverseValidationLinkKind(l)) return undefined;
  const c = String(l.validationConsistency ?? '').trim();
  /** 红色 **仅**在 TVM `Consistency` 判定为真实「潜在冲突」时（与 `isTokenValidationMappingPotentialConflict` 一致）；「无潜在冲突」等不误标红 */
  if (isTokenValidationMappingPotentialConflict(c)) return 'val-warn';
  if (c.includes('逻辑一致') || c.includes('已通过洞察修正') || c.includes('已通过纠偏修正')) {
    return 'val-ok';
  }
  return undefined;
}

const filteredCrossLinks = computed(() => collectLogicTreeCrossLinks(tasks.value));

/** 含任务 5.1 层内「价值主张→业务能力单元」与 5.1→5.2「能力单元→字段集」合成正向边（落库边优先，缺失时前端兜底） */
const logicTreeRenderLinks = computed(() => {
  const base = filteredCrossLinks.value;
  const synth51 = synthesizeTask51VpToCapabilityGraphLinks(tasks.value, base);
  const merged51 = synth51.length ? [...base, ...synth51] : base;
  const synth52 = synthesizeTask52CapabilityToFieldSetGraphLinks(tasks.value, merged51);
  const merged52 = synth52.length ? [...merged51, ...synth52] : merged51;
  const synth53FsStep = synthesizeTask52FieldSetToStepGraphLinks(tasks.value, merged52);
  const merged53a = synth53FsStep.length ? [...merged52, ...synth53FsStep] : merged52;
  const synth53CapStep = synthesizeTask51CapabilityToStepGraphLinks(tasks.value, merged53a);
  const merged53b = synth53CapStep.length ? [...merged53a, ...synth53CapStep] : merged53a;
  const synth53FsWf = task53GraphHasStepFeatureNodes(tasks.value)
    ? []
    : synthesizeTask52FieldSetToWorkflowGraphLinks(tasks.value, merged53b);
  const merged53 = synth53FsWf.length ? [...merged53b, ...synth53FsWf] : merged53b;
  /** 5.3 层内「关键工作流→环节」正向归纳不在 Tree 绘制（环节由卡内 chip 链展示） */
  return filterTask53TreeRenderLinks(merged53, tasks.value);
});

/**
 * 从选中节点沿 **正向归纳** 边「target ← source」反向遍历得到的特征 id 集合（含自身）。
 * 不含反向验证边，避免经任务 1 共享校验目标误扩兄弟 L1。
 */
const forwardInductionFocusFeatureSet = computed(() => {
  const start = String(focusFeatureId.value || '').trim();
  if (!start) return new Set<string>();
  const rev = new Map<string, string[]>();
  for (const L of logicTreeRenderLinks.value) {
    if (!isForwardInductionLinkKind(L)) continue;
    const sid = linkSourceFeatureId(L);
    const tid = linkTargetFeatureId(L);
    if (!sid || !tid) continue;
    if (!rev.has(tid)) rev.set(tid, []);
    rev.get(tid)!.push(sid);
  }
  const out = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const up of rev.get(cur) ?? []) {
      if (!out.has(up)) stack.push(up);
    }
  }
  return out;
});

const focusModeActive = computed(() => !!String(focusFeatureId.value || '').trim());

const task53StepFeatureIdLookup = computed(() => buildTask53StepFeatureIdLookup(tasks.value));

const task53StepFeatureIdSet = computed(() => buildTask53StepFeatureIdSet(tasks.value));

/** focus 在关键工作流上时，该流程全部环节特征 id（用于高亮 5.1/5.2→环节 等正向归纳边） */
const task53FocusWorkflowStepFeatureIds = computed(() => {
  const focus = String(focusFeatureId.value || '').trim();
  if (!focus) return new Set<string>();
  const disp = task53WorkflowFeatureDisplayById(tasks.value, focus);
  if (!disp || !isTask53WorkflowGraphFeatureRow(disp)) return new Set<string>();
  const wfTitle = task53WorkflowCardTitle({
    featureId: focus,
    taskId: DESIGN_DETAIL_TASK53_LINE_TASK_ID,
    display: disp,
  });
  return task53StepFeatureIdsForWorkflowTitle(task53StepFeatureIdLookup.value, wfTitle);
});

const edgePathItemsUnderlay = computed(() =>
  edgePathItems.value.filter((item) => !item.task53StepForward),
);

const edgePathItemsTask53Overlay = computed(() =>
  edgePathItems.value.filter((item) => item.task53StepForward),
);

const logicPrepared = computed(() => {
  const list = tasks.value;
  const links = logicTreeRenderLinks.value;
  const prep = extractEndpointFeaturesByTaskFromLinks(links, list);
  const linkEndpointIds = new Set<string>();
  for (const L of links) {
    const sid = linkSourceFeatureId(L);
    const tid = linkTargetFeatureId(L);
    if (sid) linkEndpointIds.add(sid);
    if (tid) linkEndpointIds.add(tid);
  }
  appendTask2OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask3OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask4OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask5OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask51OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask52OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask53OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  mergeTask53AllFeatureNodesOntoLayer(prep.nodesByLayer, list);
  appendTask55OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask6OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask65OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask7OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask8OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask85OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask9OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask10OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  appendTask0OrphanEndpointNodes(prep.nodesByLayer, list, linkEndpointIds);
  const graphHasTask0 = list.some(
    (t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK0_LINE_TASK_ID && (t.features?.length ?? 0) > 0,
  );
  /** online：任务 0 层仅展示落库后的 `ft_*` 节点；离线才用本地 preview 预览 */
  const onlineMode =
    String(
      (window as unknown as { APP_CONFIG?: { MODE?: string } }).APP_CONFIG?.MODE || '',
    ).toLowerCase() === 'online';
  if (!graphHasTask0 && !onlineMode) {
    appendTool0PrimitiveLayerNodes(prep.nodesByLayer, toolSuitePrimitiveFeatures.value);
  }
  const t0Nodes = prep.nodesByLayer.get(DESIGN_DETAIL_TASK0_LINE_TASK_ID) ?? [];
  const hasTask0 = t0Nodes.length > 0;
  /** 任务 1 痛点雷达 / 现有表格：无链也展示（来自 `tasks[].features` 全量补点） */
  appendTask1PainPointRadarEndpointNodes(prep.nodesByLayer, list);
  appendTask1ExistingSpreadsheetEndpointNodes(prep.nodesByLayer, list);
  sortTask4LayerNodesInPlace(prep.nodesByLayer);
  sortTask5LayerNodesInPlace(prep.nodesByLayer);
  sortTask51LayerNodesInPlace(prep.nodesByLayer);
  sortTask52LayerNodesInPlace(prep.nodesByLayer);
  sortTask53LayerNodesInPlace(prep.nodesByLayer);
  sortTask55LayerNodesInPlace(prep.nodesByLayer);
  sortTask6LayerNodesInPlace(prep.nodesByLayer);
  sortTask65LayerNodesInPlace(prep.nodesByLayer);
  sortTask7LayerNodesInPlace(prep.nodesByLayer);
  const fidToTaskForSort = buildFeatureIdToNormTaskIdFromGraphTasks(list);
  const t7NodesForSort = prep.nodesByLayer.get(DESIGN_DETAIL_TASK7_LINE_TASK_ID) ?? [];
  const t7CollabVisualOrder = new Map(
    buildTask7CollaborationNodesInTreeVisualOrder(t7NodesForSort, links, fidToTaskForSort).map(
      (n, i) => [n.featureId, i] as const,
    ),
  );
  sortTask8LayerNodesInPlace(prep.nodesByLayer, links, fidToTaskForSort, t7CollabVisualOrder);
  sortTask85LayerNodesInPlace(prep.nodesByLayer);
  sortTask9LayerNodesInPlace(prep.nodesByLayer, links, fidToTaskForSort);
  enrichTask10LayerTechHostFromTaskFeatures(prep.nodesByLayer, list);
  sortTask10LayerNodesInPlace(
    prep.nodesByLayer,
    links,
    fidToTaskForSort,
    buildTask10FeatureMetaById(list),
  );
  enrichTask1LayerPainBadgeFromTaskFeatures(prep.nodesByLayer, list);

  /** 任务 1 层：仅保留至少一端落在 **正向归纳** 边上的节点（默认不展示仅被绿色反向验证挂接的端点） */
  const forwardInductionLinkedFeatureIds = new Set<string>();
  for (const L of logicTreeRenderLinks.value) {
    if (!isForwardInductionLinkKind(L)) continue;
    const sid = linkSourceFeatureId(L);
    const tid = linkTargetFeatureId(L);
    if (sid) forwardInductionLinkedFeatureIds.add(sid);
    if (tid) forwardInductionLinkedFeatureIds.add(tid);
  }
  const t1Key = 'customer_basic';
  const t1Before = prep.nodesByLayer.get(t1Key);
  if (t1Before?.length) {
    const kept = t1Before.filter((n) => forwardInductionLinkedFeatureIds.has(n.featureId));
    prep.nodesByLayer.set(t1Key, kept);
  }
  sortTask1LayerNodesInPlace(prep.nodesByLayer);

  const layerOrder = mergeLayerOrderWithTool0Primitive(
    mergeLogicTreeLayerOrderWithOrphanLayers(prep.layerOrder, prep.nodesByLayer),
    hasTask0,
  );
  return { layerOrder, nodesByLayer: prep.nodesByLayer };
});

type LogicLayerView = {
  taskId: string;
  inferenceTierLabel: string;
  taskTitle: string;
  nodes: LogicTreeLayerNode[];
  task7Blocks?: Task7ProcessBlock[];
  task51Layout?: Task51TwoTierLayout;
  task8Blocks?: Task8CollaborationBlock[];
  task9Blocks?: Task9ModuleBlock[];
  task10Blocks?: Task10HostPlatformBlock[];
  task10IntegrationBlock?: Task10IntegrationBlock | null;
  task65GapBoxes?: Task65GapBox[];
};

const logicLayers = computed((): LogicLayerView[] => {
  const { layerOrder, nodesByLayer } = logicPrepared.value;
  const links = filteredCrossLinks.value;
  const fidToTask = buildFeatureIdToNormTaskIdFromGraphTasks(tasks.value);
  extendFeatureIdToNormTaskIdWithTool0Primitives(fidToTask, nodesByLayer);
  return layerOrder.map((taskId) => {
    const nodes = [...(nodesByLayer.get(taskId) ?? [])] as LogicTreeLayerNode[];
    if (taskId === DESIGN_DETAIL_TASK51_LINE_TASK_ID) {
      const task51Layout = buildTask51TwoTierLayout(nodes);
      const flatFromTier = flattenTask51TwoTierLayout(task51Layout);
      return {
        taskId,
        inferenceTierLabel: logicTreeInferenceLayerTierLabelByNormTaskId(taskId),
        taskTitle: layerDisplayTitle(taskId),
        nodes: flatFromTier.length ? flatFromTier : nodes,
        task51Layout,
      };
    }
    if (taskId === DESIGN_DETAIL_TASK65_LINE_TASK_ID) {
      const task65GapBoxes = buildTask65ThreeGapBoxLayout(nodes);
      const flat65 = flattenTask65ThreeGapBoxLayout(task65GapBoxes);
      return {
        taskId,
        inferenceTierLabel: logicTreeInferenceLayerTierLabelByNormTaskId(taskId),
        taskTitle: layerDisplayTitle(taskId),
        nodes: flat65.length ? flat65 : nodes,
        task65GapBoxes,
      };
    }
    if (taskId === DESIGN_DETAIL_TASK7_LINE_TASK_ID) {
      const task7Blocks = buildTask7ProcessBlocks(nodes, links, fidToTask);
      const flatFromBlocks = task7Blocks.flatMap((b) =>
        [...(b.flowNode ? [b.flowNode] : []), ...b.operationNodes],
      );
      return {
        taskId,
        inferenceTierLabel: logicTreeInferenceLayerTierLabelByNormTaskId(taskId),
        taskTitle: layerDisplayTitle(taskId),
        nodes: flatFromBlocks.length ? flatFromBlocks : nodes,
        task7Blocks,
      };
    }
    if (taskId === DESIGN_DETAIL_TASK8_LINE_TASK_ID) {
      const task8Blocks = buildTask8CollaborationBlocks(
        nodes,
        nodesByLayer,
        links,
        fidToTask,
      );
      const flatFromBlocks = task8Blocks.flatMap((b) => b.prototypeNodes);
      return {
        taskId,
        inferenceTierLabel: logicTreeInferenceLayerTierLabelByNormTaskId(taskId),
        taskTitle: layerDisplayTitle(taskId),
        nodes: flatFromBlocks.length ? flatFromBlocks : nodes,
        task8Blocks,
      };
    }
    if (taskId === DESIGN_DETAIL_TASK9_LINE_TASK_ID) {
      const task9Blocks = buildTask9ModuleBlocks(nodes, nodesByLayer, links, fidToTask);
      const flatFromBlocks = task9Blocks.flatMap((b) => [
        ...(b.moduleNode ? [b.moduleNode] : []),
        ...b.menuNodes,
      ]);
      return {
        taskId,
        inferenceTierLabel: logicTreeInferenceLayerTierLabelByNormTaskId(taskId),
        taskTitle: layerDisplayTitle(taskId),
        nodes: flatFromBlocks.length ? flatFromBlocks : nodes,
        task9Blocks,
      };
    }
    if (taskId === DESIGN_DETAIL_TASK10_LINE_TASK_ID) {
      const task10FeatureMeta = buildTask10FeatureMetaById(tasks.value);
      const { hostBlocks: task10Blocks, integrationBlock: task10IntegrationBlock } =
        buildTask10LayerBlocks(nodes, nodesByLayer, links, fidToTask, task10FeatureMeta);
      const flatFromBlocks = [
        ...task10Blocks.flatMap((b) => b.entries.map((e) => e.node)),
        ...(task10IntegrationBlock?.entries.map((e) => e.node) ?? []),
      ];
      return {
        taskId,
        inferenceTierLabel: logicTreeInferenceLayerTierLabelByNormTaskId(taskId),
        taskTitle: layerDisplayTitle(taskId),
        nodes: flatFromBlocks.length ? flatFromBlocks : nodes,
        task10Blocks,
        task10IntegrationBlock,
      };
    }
    return {
      taskId,
      inferenceTierLabel: logicTreeInferenceLayerTierLabelByNormTaskId(taskId),
      taskTitle: layerDisplayTitle(taskId),
      nodes,
    };
  });
});

const hasGraphContent = computed(() => logicLayers.value.some((L) => L.nodes.length > 0));

/** 当前树中任务 1 层已渲染的端点 `featureId`（与布局一致，含孤儿补点） */
const task1EndpointFeatureIdSet = computed(() => {
  const m = logicPrepared.value.nodesByLayer.get('customer_basic');
  if (!m?.length) return new Set<string>();
  return new Set(m.map((n) => n.featureId));
});

/**
 * 任务 1 节点：至少一条 **红色**（`validationConsistency` 潜在冲突）**反向验证** 边以其为 **target**。
 */
const task1RedReverseValidationTargetSet = computed(() => {
  const t1 = task1EndpointFeatureIdSet.value;
  const out = new Set<string>();
  for (const L of filteredCrossLinks.value) {
    if (!isReverseValidationLinkKind(L)) continue;
    if (validationEdgeTone(L) !== 'val-warn') continue;
    const tid = linkTargetFeatureId(L);
    if (tid && t1.has(tid)) out.add(tid);
  }
  return out;
});

/**
 * 任务 1 **痛点雷达** 节点：至少一条 **绿色**（`validationConsistency` 逻辑一致等）**反向验证** 边以其为 **target**（不与红色冲突集重叠时生效）。
 */
const task1PainRadarGreenReverseValidationTargetSet = computed(() => {
  const t1 = task1EndpointFeatureIdSet.value;
  const red = task1RedReverseValidationTargetSet.value;
  const out = new Set<string>();
  for (const L of filteredCrossLinks.value) {
    if (!isReverseValidationLinkKind(L)) continue;
    if (validationEdgeTone(L) !== 'val-ok') continue;
    const tid = linkTargetFeatureId(L);
    if (tid && t1.has(tid) && !red.has(tid)) out.add(tid);
  }
  return out;
});

/** focus 锚点作为 **源** 的反向验证边所指向的任务 1 特征（绿色脉动） */
const reverseValidationTask1FromFocusSet = computed(() => {
  const focus = String(focusFeatureId.value || '').trim();
  if (!focus) return new Set<string>();
  const t1 = task1EndpointFeatureIdSet.value;
  const out = new Set<string>();
  for (const L of filteredCrossLinks.value) {
    if (!isReverseValidationLinkKind(L)) continue;
    if (linkSourceFeatureId(L) !== focus) continue;
    const tid = linkTargetFeatureId(L);
    if (t1.has(tid)) out.add(tid);
  }
  return out;
});

function layerDisplayTitle(taskId: string): string {
  const canon = canonicalLogicGraphTaskTitleByNormTaskId(taskId);
  if (canon) return canon;
  const row = tasks.value.find((t) => normLogicTaskId(t.taskId) === taskId);
  const t = String(row?.title || '').trim();
  if (t) return t;
  if (taskId === DESIGN_DETAIL_TASK0_LINE_TASK_ID) return LOGIC_GRAPH_TASK0_TITLE;
  if (taskId === 'customer_basic') return LOGIC_GRAPH_TASK1_TITLE;
  if (taskId === DESIGN_DETAIL_TASK2_LINE_TASK_ID) return '任务 2';
  if (taskId === DESIGN_DETAIL_TASK3_LINE_TASK_ID) return '任务 3';
  if (taskId === DESIGN_DETAIL_TASK4_LINE_TASK_ID) return '任务 4';
  return taskId;
}

function layerTrackMinWidth(nodeCount: number): string {
  return `${logicTreeLayerTrackMinWidthPx(nodeCount)}px`;
}

function layerTrackMinWidthForLayer(layer: LogicLayerView): string {
  if (layer.taskId === DESIGN_DETAIL_TASK51_LINE_TASK_ID && layer.task51Layout) {
    return `${logicTreeTask51LayerTrackMinWidthPx(layer.task51Layout)}px`;
  }
  if (layer.taskId === DESIGN_DETAIL_TASK7_LINE_TASK_ID && layer.task7Blocks?.length) {
    return `${logicTreeTask7LayerTrackMinWidthPx(layer.task7Blocks.length)}px`;
  }
  if (layer.taskId === DESIGN_DETAIL_TASK8_LINE_TASK_ID && layer.task8Blocks?.length) {
    return `${logicTreeTask8LayerTrackMinWidthPx(layer.task8Blocks)}px`;
  }
  if (layer.taskId === DESIGN_DETAIL_TASK9_LINE_TASK_ID && layer.task9Blocks?.length) {
    return `${logicTreeTask9LayerTrackMinWidthPx(layer.task9Blocks)}px`;
  }
  if (
    layer.taskId === DESIGN_DETAIL_TASK10_LINE_TASK_ID &&
    (layer.task10Blocks?.length || layer.task10IntegrationBlock?.entries.length)
  ) {
    return `${logicTreeTask10LayerTrackMinWidthPx(layer.task10Blocks ?? [], layer.task10IntegrationBlock)}px`;
  }
  if (layer.taskId === DESIGN_DETAIL_TASK52_LINE_TASK_ID) {
    return `${logicTreeTask52LayerTrackMinWidthPx(layer.nodes.length)}px`;
  }
  if (layer.taskId === DESIGN_DETAIL_TASK53_LINE_TASK_ID) {
    return `${logicTreeTask53LayerTrackMinWidthPx(layer.nodes)}px`;
  }
  if (layer.taskId === DESIGN_DETAIL_TASK65_LINE_TASK_ID && layer.task65GapBoxes?.length) {
    return `${logicTreeTask65LayerTrackMinWidthPx(layer.task65GapBoxes)}px`;
  }
  return layerTrackMinWidth(layer.nodes.length);
}

function task53TrackStyle(layer: LogicLayerView): Record<string, string> {
  return {
    minWidth: layerTrackMinWidthForLayer(layer),
  };
}

function task53NodeSlotStyle(node: LogicTreeLayerNode): Record<string, string> {
  return {
    flex: `0 0 ${logicTreeTask53CardWidthPx(node)}px`,
    width: `${logicTreeTask53CardWidthPx(node)}px`,
    minWidth: `${logicTreeTask53CardWidthPx(node)}px`,
    maxWidth: `${logicTreeTask53CardWidthPx(node)}px`,
  };
}

function task52TrackStyle(layer: LogicLayerView): Record<string, string> {
  const maxRows = task52MaxFieldTagRowCount(layer.nodes);
  return {
    minWidth: `${logicTreeTask52LayerTrackMinWidthPx(layer.nodes.length)}px`,
    '--dd-task52-tag-rows': String(maxRows),
    '--dd-task52-card-width': `${TASK52_LOGIC_TREE_CARD_WIDTH_PX}px`,
  };
}

function task7TrackStyle(layer: LogicLayerView): Record<string, string> {
  const n = layer.task7Blocks?.length ?? 0;
  return {
    minWidth: layerTrackMinWidthForLayer(layer),
    '--dd-task7-block-gap': `${logicTreeTask7BlockGapPx(n)}px`,
  };
}

function task8TrackStyle(layer: LogicLayerView): Record<string, string> {
  const n = layer.task8Blocks?.length ?? 0;
  return {
    minWidth: layerTrackMinWidthForLayer(layer),
    '--dd-task8-block-gap': `${logicTreeTask8BlockGapPx(n)}px`,
  };
}

function task8AnchorCaption(node: LogicTreeLayerNode): string {
  const tok = String(node.display?.tokenDisplay ?? node.display?.token_display ?? '').trim();
  const val = String(node.display?.name ?? '').trim();
  const head = tok.includes('·') ? (tok.split(/\s*·\s*/)[0]?.trim() ?? tok) : tok;
  if (head && val) return `${head} · ${val}`;
  return val || head || '协作节点';
}

function task9TrackStyle(layer: LogicLayerView): Record<string, string> {
  const n = layer.task9Blocks?.length ?? 0;
  return {
    minWidth: layerTrackMinWidthForLayer(layer),
    '--dd-task9-block-gap': `${logicTreeTask9BlockGapPx(n)}px`,
  };
}

function task10TrackStyle(layer: LogicLayerView): Record<string, string> {
  const hostN = layer.task10Blocks?.length ?? 0;
  const integrationN = layer.task10IntegrationBlock?.entries.length ? 1 : 0;
  const n = hostN + integrationN;
  return {
    minWidth: layerTrackMinWidthForLayer(layer),
    '--dd-task10-block-gap': `${logicTreeTask10BlockGapPx(Math.max(1, n))}px`,
  };
}

function task10UpstreamCaption(node: LogicTreeLayerNode): string {
  const tok = String(node.display?.tokenDisplay ?? node.display?.token_display ?? '').trim();
  const val = String(node.display?.name ?? '').trim();
  const head = tok.includes('·') ? (tok.split(/\s*·\s*/)[0]?.trim() ?? tok) : tok;
  if (head && val) return `${head} · ${val}`;
  return val || head || '系统一级模块';
}

const canDownloadLogicTreeExport = computed(
  () => !loading.value && !loadError.value && hasGraphContent.value && !pngExporting.value,
);

const canDownloadLogicTreePng = canDownloadLogicTreeExport;

/** 标题栏「下载 PNG」：展开全图后 `html-to-image` 高清导出（含标题与全部层/边） */
async function onDownloadTreePng() {
  if (!canDownloadLogicTreePng.value) return;
  const captureRoot = treePageExportRef.value;
  const panel = treePanelRef.value;
  const canvas = canvasRoot.value;
  const hscroll = treeHScrollRef.value;
  const inner = treeScrollInnerRef.value;
  if (!captureRoot || !panel || !canvas || !hscroll || !inner) return;

  pngExporting.value = true;
  const prevFocus = focusFeatureId.value;
  closeValuePopover();
  closeEdgeLogicTip();
  closeNodeFeatureTip();
  focusFeatureId.value = null;
  try {
    refreshTreeLayout();
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await downloadLogicTreePageAsPng(
      captureRoot,
      panel,
      canvas,
      hscroll,
      inner,
      buildLogicTreePngFilename(props.caseId),
    );
  } catch (err) {
    console.warn('[logic-tree] PNG export failed', err);
    window.alert('导出图片失败，请检查网络（需加载 html-to-image 库）或稍后重试。');
  } finally {
    focusFeatureId.value = prevFocus;
    pngExporting.value = false;
    refreshTreeLayout();
  }
}

/** 标题栏「下载 JSON」：导出当前已加载的完整 task-graph DAG */
function onDownloadTreeJson() {
  if (!canDownloadLogicTreeExport.value) return;
  try {
    downloadLogicTreeDagJson(props.caseId, tasks.value);
  } catch (err) {
    console.warn('[logic-tree] JSON export failed', err);
    window.alert('导出 JSON 失败，请稍后重试。');
  }
}

/** PAIN 角标仅 **客户已确认痛点**（`painPointConfirmed`）；颜色可随反向验证红/绿状态区分 */
function task1PainBadgeExtraClass(featureId: string): string {
  if (task1RedReverseValidationTargetSet.value.has(featureId)) return 'dd-tree-pain-badge--rv-warn';
  if (task1PainRadarGreenReverseValidationTargetSet.value.has(featureId)) return 'dd-tree-pain-badge--rv-ok';
  return '';
}

function task1PainBadgeTitle(featureId: string): string {
  if (task1RedReverseValidationTargetSet.value.has(featureId)) return '已确认痛点；反向验证潜在冲突';
  if (task1PainRadarGreenReverseValidationTargetSet.value.has(featureId)) return '已确认痛点；反向验证逻辑一致';
  return '已确认痛点';
}

function cardClassForLayer(
  taskId: string,
  node: LogicTreeLayerNode,
  opts?: {
    task7Role?: 'flow' | 'op';
    task9Role?: 'module' | 'menu';
    task51Role?: 'vp' | 'cap';
  },
): string {
  const base = 'dd-tree-card dd-tree-card--stretch';
  let layer = '';
  if (taskId === DESIGN_DETAIL_TASK0_LINE_TASK_ID) {
    if (isTask0WeComLogicTreeNode(node)) {
      layer = 'dd-tree-card--task0-wecom';
    } else if (isTask0QiQiaoLowCodeLogicTreeNode(node)) {
      layer = 'dd-tree-card--task0-qiqiao';
    } else {
      layer = 'dd-tree-card--task0';
    }
  } else if (taskId === 'customer_basic') {
    const fid = node.featureId;
    if (task1RedReverseValidationTargetSet.value.has(fid)) {
      layer = 'dd-tree-card--task1-rv-warn';
    } else if (isTask1PainPointRadarLogicTreeNode(node)) {
      layer = task1PainRadarGreenReverseValidationTargetSet.value.has(fid)
        ? 'dd-tree-card--pain-radar-rv'
        : 'dd-tree-card--pain-radar';
    } else if (isTask1ExistingSpreadsheetLogicTreeNode(node)) {
      layer = task1PainRadarGreenReverseValidationTargetSet.value.has(fid)
        ? 'dd-tree-card--existing-spreadsheet-rv'
        : 'dd-tree-card--existing-spreadsheet';
    } else {
      layer = 'dd-tree-card--src';
    }
  } else if (
    node.orphan &&
    (taskId === DESIGN_DETAIL_TASK2_LINE_TASK_ID ||
      taskId === DESIGN_DETAIL_TASK3_LINE_TASK_ID ||
      taskId === DESIGN_DETAIL_TASK4_LINE_TASK_ID)
  )
    layer = 'dd-tree-card--t2';
  else if (taskId === DESIGN_DETAIL_TASK7_LINE_TASK_ID) {
    layer = opts?.task7Role === 'flow' ? 'dd-tree-card--task7-flow' : 'dd-tree-card--task7-op';
  } else if (taskId === DESIGN_DETAIL_TASK9_LINE_TASK_ID) {
    layer = opts?.task9Role === 'module' ? 'dd-tree-card--task9-module' : 'dd-tree-card--task9-menu';
  } else if (taskId === DESIGN_DETAIL_TASK51_LINE_TASK_ID) {
    layer = opts?.task51Role === 'vp' ? 'dd-tree-card--task51-vp' : 'dd-tree-card--task51-cap';
  } else if (taskId === DESIGN_DETAIL_TASK52_LINE_TASK_ID) {
    layer = 'dd-tree-card--task52-fieldset';
  } else if (taskId === DESIGN_DETAIL_TASK53_LINE_TASK_ID) {
    layer = isTask53WorkflowStepLayerNode(node)
      ? 'dd-tree-card--task53-step'
      : 'dd-tree-card--task53-workflow';
  } else if (taskId === DESIGN_DETAIL_TASK65_LINE_TASK_ID) {
    layer = 'dd-tree-card--task65-gap-fid';
  } else layer = 'dd-tree-card--tgt';
  let focus = '';
  if (focusModeActive.value) {
    const inForward = forwardInductionFocusFeatureSet.value.has(node.featureId);
    const inRv =
      taskId === 'customer_basic' && reverseValidationTask1FromFocusSet.value.has(node.featureId);
    const rvWarn = inRv && task1RedReverseValidationTargetSet.value.has(node.featureId);
    if (inForward && inRv) {
      focus = rvWarn ? ' dd-tree-card--focus-dual-fr-warn' : ' dd-tree-card--focus-dual-fr';
    } else if (inForward) focus = ' dd-tree-card--focus-chain';
    else if (inRv) focus = rvWarn ? ' dd-tree-card--focus-rv-warn' : ' dd-tree-card--focus-rv';
    else focus = ' dd-tree-card--focus-dim';
  }
  return `${base} ${layer}${focus}`;
}

/** 避免 `.dd-tree-hscroll` 横向滚动条上的 pointerdown 冒泡到画布根节点后误清 focus */
function isPointerOnHorizontalScrollbar(e: PointerEvent, scrollEl: HTMLElement | null): boolean {
  if (!scrollEl) return false;
  if (scrollEl.scrollWidth <= scrollEl.clientWidth + 1) return false;
  const r = scrollEl.getBoundingClientRect();
  const zonePx = 16;
  return (
    e.clientX >= r.left &&
    e.clientX <= r.right &&
    e.clientY >= r.bottom - zonePx &&
    e.clientY <= r.bottom + 2
  );
}

function onCanvasBlankPointerDown(e: PointerEvent) {
  if (isPointerOnHorizontalScrollbar(e, treeHScrollRef.value)) return;
  focusFeatureId.value = null;
  void nextTick(() => refreshTreeLayout());
  closeValuePopover();
  closeEdgeLogicTip();
  closeNodeFeatureTip();
}

function edgePathFocusFlow(item: Pick<EdgePathItem, 'sid' | 'tid' | 'isRv'>): 'fi' | 'rv' | null {
  if (!focusModeActive.value) return null;
  const focusId = String(focusFeatureId.value || '').trim();
  const forward = forwardInductionFocusFeatureSet.value;
  const rvT1 = reverseValidationTask1FromFocusSet.value;
  const wfSteps = task53FocusWorkflowStepFeatureIds.value;
  if (!item.isRv) {
    if (forward.has(item.sid) && forward.has(item.tid)) return 'fi';
    /** 选中关键工作流：该流程全部环节参与的正向归纳边一并高亮 */
    if (wfSteps.size && (wfSteps.has(item.sid) || wfSteps.has(item.tid))) return 'fi';
  }
  if (item.isRv && item.sid === focusId && rvT1.has(item.tid)) return 'rv';
  return null;
}

function edgePathDashStyle(_item: EdgePathItem): Record<string, string> {
  return {};
}

function edgePathClasses(item: EdgePathItem): string {
  const base = 'dd-tree-edge';
  const flow = edgePathFocusFlow(item);
  const flowRv = flow === 'rv';
  const flowFi = flow === 'fi';
  /** 反向验证（反向确认）边一律虚线，含 focus 高亮脉动时 */
  const dash = item.isRv ? ' dd-tree-edge--reverse' : '';
  const tone =
    item.tone === 'val-ok' ? ' dd-tree-edge--val-ok' : item.tone === 'val-warn' ? ' dd-tree-edge--val-warn' : '';
  const t9intra = item.task9Intra ? ' dd-tree-edge--task9-intra' : '';
  const t0fi = item.task0Forward && !item.isRv ? ' dd-tree-edge--task0-fi' : '';
  const t8fi = item.task8Forward && !item.isRv ? ' dd-tree-edge--task8-fi' : '';
  const t53fi = item.task53StepForward && !item.isRv ? ' dd-tree-edge--task53-step-fi' : '';
  if (!focusModeActive.value) return `${base}${dash}${tone}${t9intra}${t0fi}${t8fi}${t53fi}`;
  if (!flowFi && !flowRv) return `${base}${dash}${tone}${t9intra}${t0fi}${t8fi}${t53fi} dd-tree-edge--dim`;
  let cls = `${base}${dash}${tone}${t9intra}${t0fi}${t8fi}${t53fi} dd-tree-edge--focus`;
  if (flowFi) cls += ' dd-tree-edge--flow-fi';
  if (flowRv) cls += ' dd-tree-edge--flow-rv';
  return cls;
}

function edgeMarkerRefId(item: EdgePathItem): string {
  if (!focusModeActive.value) {
    if (item.tone === 'val-ok') return arrowMarkerOkId;
    if (item.tone === 'val-warn') return arrowMarkerWarnId;
    if (item.task0Forward && !item.isRv) return arrowMarkerTask0Id;
    if (item.task8Forward && !item.isRv) return arrowMarkerTask8Id;
    if (item.task53StepForward && !item.isRv) return arrowMarkerTask0Id;
    return arrowMarkerId;
  }
  const flow = edgePathFocusFlow(item);
  if (!flow) return arrowMarkerDimId;
  if (item.tone === 'val-ok') return arrowMarkerOkId;
  if (item.tone === 'val-warn') return arrowMarkerWarnId;
  if (item.task0Forward && !item.isRv) return arrowMarkerTask0Id;
  if (item.task8Forward && !item.isRv) return arrowMarkerTask8Id;
  if (item.task53StepForward && !item.isRv) return arrowMarkerTask0Id;
  return arrowMarkerId;
}

/**
 * focus 下 SVG 边：**仅**渲染 **`edgePathFocusFlow`** 为正向归纳 / 反向验证高亮的边；每条仍分两层绘制（文档序自下而上）：
 * 1. 高亮边 **仅线体**（`marker-end=none`，避免他边 marker 压在本边线段上）
 * 2. 高亮边 **仅箭头**（透明 stroke + `marker-end`）
 * 非 focus 或无边数据时走单层 `edgePathItems`。
 */
function computeEdgePathFocusSplit(items: ReadonlyArray<EdgePathItem>) {
  if (!focusModeActive.value || !items.length) {
    return { useSingleLayer: true as const, focus: [] as EdgePathItem[] };
  }
  const focus: EdgePathItem[] = [];
  for (const item of items) {
    const flow = edgePathFocusFlow(item);
    if (flow === 'fi' || flow === 'rv') focus.push(item);
  }
  return { useSingleLayer: false as const, focus };
}

const edgePathFocusSplitUnder = computed(() => computeEdgePathFocusSplit(edgePathItemsUnderlay.value));

const edgePathFocusSplitOverlay = computed(() =>
  computeEdgePathFocusSplit(edgePathItemsTask53Overlay.value),
);

/** 测量每层节点行高度，供层间间隙 = 行高 ×0.36（原 0.3 基础上 ×1.2，任务层间距增加 20%）（`--dd-node-row-h`） */
function syncLayerRowHeights() {
  const inner = treeScrollInnerRef.value;
  if (!inner) return;
  const layers = inner.querySelectorAll('.dd-tree-layer');
  layers.forEach((layerEl) => {
    const track = layerEl.querySelector('.dd-tree-layer-track');
    if (!(track instanceof HTMLElement)) return;
    const h = Math.max(1, Math.round(track.getBoundingClientRect().height));
    (layerEl as HTMLElement).style.setProperty('--dd-node-row-h', `${h}px`);
  });
}

function refreshTreeLayout() {
  void nextTick(() => {
    requestAnimationFrame(() => {
      syncLayerRowHeights();
      updateEdgePaths();
    });
  });
}

let ro: ResizeObserver | null = null;

/**
 * 端点锚点（相对 `treeScrollInnerRef` 内容坐标）：
 * - 展示层 **layerOrder[0]=任务1 在最上**；**向上**几何边 = 数据 source 在 **更下** 层、target 在 **更上** 层 → **source TOP 中点 → target BOTTOM 中点**（任务1 上的反向验证入口落在 **BOTTOM**，与产品一致）。
 * - **向下**正向输出：**source BOTTOM → target TOP**。
 * - 若端点层序缺失（孤儿未入 `features` 等），用两卡 `getBoundingClientRect` 纵向中心比较兜底。
 */
function updateEdgePaths() {
  const inner = treeScrollInnerRef.value;
  if (!inner) {
    edgePathItems.value = [];
    return;
  }
  const ir = inner.getBoundingClientRect();
  const layerOrder = logicPrepared.value.layerOrder;
  const taskRows = tasks.value;
  const fidToTask = buildFeatureIdToNormTaskIdFromGraphTasks(taskRows);
  extendFeatureIdToNormTaskIdWithTool0Primitives(fidToTask, logicPrepared.value.nodesByLayer);
  const task9Fids = new Set<string>();
  for (const t of taskRows) {
    if (normLogicTaskId(t.taskId) !== DESIGN_DETAIL_TASK9_LINE_TASK_ID) continue;
    for (const f of t.features ?? []) {
      const fid = String(f.featureId || '').trim();
      if (fid) task9Fids.add(fid);
    }
  }
  const out: EdgePathItem[] = [];
  const svgNS = 'http://www.w3.org/2000/svg';
  const task53StepIds = task53StepFeatureIdSet.value;

  for (const link of logicTreeRenderLinks.value) {
    const sid = linkSourceFeatureId(link);
    const tid = linkTargetFeatureId(link);
    if (!sid || !tid) continue;
    const isRv = isReverseValidationLinkKind(link);
    const tone = validationEdgeTone(link);
    /** 非 focus：无冲突绿色反向验证边不绘制；focus 下由 `edgePathFocusSplit` 仅绘高亮子集 */
    if (!focusModeActive.value && isRv && tone === 'val-ok') continue;
    const sEl = featureElByFeatureId.get(sid);
    const tEl = featureElByFeatureId.get(tid);
    if (!sEl || !tEl) continue;
    const s = sEl.getBoundingClientRect();
    const t = tEl.getBoundingClientRect();

    const scx = s.left + s.width / 2 - ir.left;
    const stTop = s.top - ir.top;
    const stBot = s.bottom - ir.top;
    const tcx = t.left + t.width / 2 - ir.left;
    const ttTop = t.top - ir.top;
    const ttBot = t.bottom - ir.top;

    const sRank = logicTreeFeatureLayerIndex(sid, layerOrder, taskRows);
    const tRank = logicTreeFeatureLayerIndex(tid, layerOrder, taskRows);

    let upwardGeo: boolean;
    let downwardGeo: boolean;
    if (sRank < 0 || tRank < 0 || sRank === tRank) {
      const midS = (s.top + s.bottom) / 2;
      const midT = (t.top + t.bottom) / 2;
      upwardGeo = midS > midT;
      downwardGeo = midS < midT;
    } else {
      upwardGeo = sRank > tRank;
      downwardGeo = sRank < tRank;
    }

    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;
    if (upwardGeo && !downwardGeo) {
      x1 = scx;
      y1 = stTop;
      x2 = tcx;
      y2 = ttBot;
    } else if (downwardGeo && !upwardGeo) {
      x1 = scx;
      y1 = stBot;
      x2 = tcx;
      y2 = ttTop;
    } else {
      const midS = (s.top + s.bottom) / 2;
      const midT = (t.top + t.bottom) / 2;
      if (midS >= midT) {
        x1 = scx;
        y1 = stTop;
        x2 = tcx;
        y2 = ttBot;
      } else {
        x1 = scx;
        y1 = stBot;
        x2 = tcx;
        y2 = ttTop;
      }
    }

    const midY = (y1 + y2) / 2;
    const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    let pathLen = 120;
    try {
      const pe = document.createElementNS(svgNS, 'path');
      pe.setAttribute('d', d);
      const len = pe.getTotalLength();
      if (Number.isFinite(len) && len > 1) pathLen = len;
    } catch {
      /* ignore */
    }
    const task9Intra =
      !isRv && task9Fids.size > 0 && isTask9IntraModuleMenuForwardLink(link, fidToTask, task9Fids);
    const srcTask = normLogicTaskId(String(fidToTask.get(sid) ?? ''));
    const tgtTask = normLogicTaskId(String(fidToTask.get(tid) ?? ''));
    const task8Forward =
      !isRv &&
      !task9Intra &&
      srcTask === DESIGN_DETAIL_TASK8_LINE_TASK_ID &&
      tgtTask === DESIGN_DETAIL_TASK85_LINE_TASK_ID;
    const task0Forward =
      !isRv &&
      !task9Intra &&
      !task8Forward &&
      srcTask === DESIGN_DETAIL_TASK0_LINE_TASK_ID;
    const task53StepForward = !isRv && !task9Intra && task53StepIds.has(tid);
    out.push({
      sid,
      tid,
      d,
      pathLen,
      isRv,
      linkId: logicGraphLinkIdOf(link),
      logicText: logicBodyForTreeLink(link),
      ...(tone ? { tone } : {}),
      ...(task9Intra ? { task9Intra: true } : {}),
      ...(task0Forward ? { task0Forward: true } : {}),
      ...(task8Forward ? { task8Forward: true } : {}),
      ...(task53StepForward ? { task53StepForward: true } : {}),
    });
  }
  edgePathItems.value = out;
}

function refreshTool0PrimitivesFromLocal() {
  toolSuitePrimitiveFeatures.value = buildToolSuitePrimitiveGraphFeatures();
}

async function fetchGraph() {
  const cid = String(props.caseId || '').trim();
  if (!cid) {
    tasks.value = [];
    return;
  }
  const seq = ++fetchGraphSeq;
  loading.value = true;
  loadError.value = null;
  refreshTool0PrimitivesFromLocal();
  void hydrateToolSuiteKnowledgeForDesign().then(() => {
    if (seq !== fetchGraphSeq) return;
    refreshTool0PrimitivesFromLocal();
    if (props.visible) refreshTreeLayout();
  });
  try {
    const api = (
      window as unknown as {
        SmartCto?: { problemCaseApi?: { getDesignDetailTaskGraph?: (id: string) => Promise<unknown> } };
      }
    ).SmartCto?.problemCaseApi;
    const fn = api?.getDesignDetailTaskGraph;
    if (typeof fn !== 'function') {
      loadError.value = '案例 API 未就绪，请刷新页面后重试。';
      tasks.value = [];
      return;
    }
    const TASK_GRAPH_TIMEOUT_MS = 25_000;
    const res = (await Promise.race([
      fn(cid) as Promise<{
        ok?: boolean;
        data?: { tasks?: DesignDetailLogicGraphTaskDto[] };
        errorMessage?: string;
      }>,
      new Promise<never>((_, reject) => {
        window.setTimeout(
          () => reject(new Error('推理图请求超时，请检查后端是否已启动并重试。')),
          TASK_GRAPH_TIMEOUT_MS,
        );
      }),
    ])) as {
      ok?: boolean;
      data?: { tasks?: DesignDetailLogicGraphTaskDto[] };
      errorMessage?: string;
    };
    if (seq !== fetchGraphSeq) return;
    if (!res?.ok) {
      loadError.value = String(res?.errorMessage || '加载失败');
      tasks.value = [];
      return;
    }
    const list = Array.isArray(res.data?.tasks) ? res.data!.tasks! : [];
    tasks.value = normalizeLogicGraphTasksAfterFetch(
      dedupeLogicGraphTasksByNormTaskId(mergeCustomerRequirementIntoBasicForLogicGraph(list)),
    );
    const t0Task = tasks.value.find(
      (t) =>
        normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK0_LINE_TASK_ID ||
        String(t.taskId || '').trim() === LOGIC_GRAPH_TASK0_TITLE,
    );
    try {
      console.info('[design-detail:task0-tree]', {
        phase: 'fetch_graph_done',
        caseId: cid,
        graphRefreshTick: props.graphRefreshTick,
        task0TokenCount: t0Task?.tokens?.length ?? 0,
        task0FeatureCount: t0Task?.features?.length ?? 0,
        sampleFeatureIds: (t0Task?.features ?? []).slice(0, 3).map((f) => f.featureId),
      });
    } catch {
      /* ignore */
    }
  } catch (e) {
    if (seq !== fetchGraphSeq) return;
    loadError.value = e instanceof Error ? e.message : String(e);
    tasks.value = [];
  } finally {
    if (seq === fetchGraphSeq) loading.value = false;
  }
}

function bindResizeObserver() {
  ro?.disconnect();
  ro = null;
  if (typeof ResizeObserver === 'undefined') return;
  const inner = treeScrollInnerRef.value;
  const h = treeHScrollRef.value;
  const outer = canvasRoot.value;
  const el = inner ?? outer;
  if (!el) return;
  ro = new ResizeObserver(() => {
    refreshTreeLayout();
  });
  ro.observe(el);
  if (inner && h && h !== inner) ro.observe(h);
}

watch(
  () => [props.visible, props.caseId, props.graphRefreshTick] as const,
  async ([v, cid]) => {
    if (v && String(cid || '').trim()) await fetchGraph();
  },
  { immediate: true },
);

watch(
  () => tasks.value,
  async () => {
    if (!props.visible) return;
    await nextTick();
    refreshTreeLayout();
    bindResizeObserver();
  },
  { deep: true },
);

watch(loading, async (v) => {
  if (!v && props.visible) {
    await nextTick();
    refreshTreeLayout();
    bindResizeObserver();
  }
});

/** 进入/退出 focus 时重算边集（默认隐藏的无冲突绿色反向验证边仅在 focus 时加入 `edgePathItems`） */
watch(focusFeatureId, async () => {
  if (!props.visible) return;
  await nextTick();
  refreshTreeLayout();
});

watch(
  () => props.visible,
  (v) => {
    if (typeof document === 'undefined') return;
    if (!v) {
      task0LayerReadyEmitted = false;
      closeValuePopover();
      closeEdgeLogicTip();
      closeNodeFeatureTip();
      focusFeatureId.value = null;
    }
    document.body.style.overflow = v ? 'hidden' : '';
    if (v) void nextTick(() => refreshTreeLayout());
  },
);

/** 任务 0 层节点渲染完成后通知设计页（落库后 graph 有节点时触发，供收官串行） */
watch(
  () =>
    [
      props.visible,
      loading.value,
      logicLayers.value.find((l) => l.taskId === DESIGN_DETAIL_TASK0_LINE_TASK_ID)?.nodes.length ?? 0,
      tasks.value.some(
        (t) =>
          normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK0_LINE_TASK_ID && (t.features?.length ?? 0) > 0,
      ),
    ] as const,
  ([vis, ld, t0Count, graphHasTask0Features]) => {
    if (!vis || ld || task0LayerReadyEmitted) return;
    const onlineMode =
      String(
        (window as unknown as { APP_CONFIG?: { MODE?: string } }).APP_CONFIG?.MODE || '',
      ).toLowerCase() === 'online';
    if (onlineMode && !graphHasTask0Features) return;
    if (t0Count > 0) {
      task0LayerReadyEmitted = true;
      emit('task0LayerReady');
    }
  },
);

function onBackdropClick(e: MouseEvent) {
  closeValuePopover();
  closeEdgeLogicTip();
  closeNodeFeatureTip();
  focusFeatureId.value = null;
  if ((e.target as HTMLElement).classList.contains('dd-tree-backdrop')) emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (!props.visible) return;
  if (e.key === 'Escape') {
    if (valuePopover.value) {
      closeValuePopover();
      e.stopPropagation();
      return;
    }
    if (focusFeatureId.value) {
      closeEdgeLogicTip();
      closeNodeFeatureTip();
      focusFeatureId.value = null;
      e.stopPropagation();
      return;
    }
    emit('close');
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  void nextTick(() => {
    bindResizeObserver();
    refreshTreeLayout();
  });
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  closeValuePopover();
  closeEdgeLogicTip();
  closeNodeFeatureTip();
  focusFeatureId.value = null;
  ro?.disconnect();
  ro = null;
  if (typeof document !== 'undefined') document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <div
      v-show="visible"
      class="dd-tree-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dd-tree-title"
      @click="onBackdropClick"
    >
      <div ref="treePanelRef" class="dd-tree-panel" @click.stop>
        <div ref="treePageExportRef" class="dd-tree-page-capture">
          <header class="dd-tree-head">
            <h2 id="dd-tree-title" class="dd-tree-title">逻辑树</h2>
            <div class="dd-tree-head-actions">
              <button
                type="button"
                class="dd-tree-download dd-tree-download--json"
                :disabled="!canDownloadLogicTreeExport"
                @click="onDownloadTreeJson"
              >
                下载 JSON
              </button>
              <button
                type="button"
                class="dd-tree-download"
                :disabled="!canDownloadLogicTreePng"
                :aria-busy="pngExporting ? 'true' : 'false'"
                @click="onDownloadTreePng"
              >
                {{ pngExporting ? '生成中…' : '下载 PNG' }}
              </button>
              <button type="button" class="dd-tree-close" @click="emit('close')">关闭</button>
            </div>
          </header>
          <p v-if="loadError" class="dd-tree-error" role="alert">{{ loadError }}</p>
          <p v-else-if="loading" class="dd-tree-loading">加载中…</p>
          <div
            v-else
            ref="canvasRoot"
            class="dd-tree-canvas"
          :class="{ 'dd-tree-canvas--focus-mode': focusModeActive }"
          @pointerdown="onCanvasBlankPointerDown"
        >
          <div ref="treeHScrollRef" class="dd-tree-hscroll">
            <div ref="treeScrollInnerRef" class="dd-tree-hscroll-inner">
              <svg class="dd-tree-svg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <marker
                    :id="arrowMarkerId"
                    markerWidth="9"
                    markerHeight="9"
                    refX="8"
                    refY="4.5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#2563eb" />
                  </marker>
                  <marker
                    :id="arrowMarkerDimId"
                    markerWidth="9"
                    markerHeight="9"
                    refX="8"
                    refY="4.5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#94a3b8" />
                  </marker>
                  <marker
                    :id="arrowMarkerOkId"
                    markerWidth="9"
                    markerHeight="9"
                    refX="8"
                    refY="4.5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#16a34a" />
                  </marker>
                  <marker
                    :id="arrowMarkerWarnId"
                    markerWidth="9"
                    markerHeight="9"
                    refX="8"
                    refY="4.5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#dc2626" />
                  </marker>
                  <marker
                    :id="arrowMarkerTask0Id"
                    markerWidth="9"
                    markerHeight="9"
                    refX="8"
                    refY="4.5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#9333ea" />
                  </marker>
                  <marker
                    :id="arrowMarkerTask8Id"
                    markerWidth="9"
                    markerHeight="9"
                    refX="8"
                    refY="4.5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#d97706" />
                  </marker>
                </defs>
                <template v-if="edgePathFocusSplitUnder.useSingleLayer">
                  <path
                    v-for="item in edgePathItemsUnderlay"
                    :key="'e-' + item.sid + '-' + item.tid"
                    :d="item.d"
                    :class="edgePathClasses(item)"
                    :style="edgePathDashStyle(item)"
                    fill="none"
                    :marker-end="'url(#' + edgeMarkerRefId(item) + ')'"
                  />
                </template>
                <template v-else>
                  <path
                    v-for="item in edgePathFocusSplitUnder.focus"
                    :key="'efb-' + item.sid + '-' + item.tid"
                    :d="item.d"
                    :class="edgePathClasses(item) + ' dd-tree-edge--focus-interactive'"
                    :style="edgePathDashStyle(item)"
                    fill="none"
                    marker-end="none"
                    @pointerenter="onFocusEdgePointerEnter(item, $event)"
                    @pointermove="onFocusEdgePointerMove(item, $event)"
                    @pointerleave="onFocusEdgePointerLeave"
                  />
                  <path
                    v-for="item in edgePathFocusSplitUnder.focus"
                    :key="'efm-' + item.sid + '-' + item.tid"
                    :d="item.d"
                    class="dd-tree-edge dd-tree-edge--focus-marker-only"
                    fill="none"
                    :marker-end="'url(#' + edgeMarkerRefId(item) + ')'"
                  />
                  <path
                    v-for="item in edgePathFocusSplitUnder.focus"
                    :key="'efh-' + item.sid + '-' + item.tid"
                    :d="item.d"
                    class="dd-tree-edge-hit"
                    fill="none"
                    @pointerenter="onFocusEdgePointerEnter(item, $event)"
                    @pointermove="onFocusEdgePointerMove(item, $event)"
                    @pointerleave="onFocusEdgePointerLeave"
                  />
                </template>
              </svg>
              <div class="dd-tree-body">
                <template v-for="(layer, li) in logicLayers" :key="layer.taskId">
                  <div class="dd-tree-layer" :class="{ 'dd-tree-layer--last': li === logicLayers.length - 1 }">
                    <div
                      class="dd-tree-layer-label"
                      :aria-label="layer.inferenceTierLabel + ' ｜ ' + layer.taskTitle"
                    >
                      <span class="dd-tree-layer-inference-tier">{{ layer.inferenceTierLabel }}</span>
                      <span class="dd-tree-layer-label-sep" aria-hidden="true"> ｜ </span>
                      <span class="dd-tree-layer-task-title-line">{{ layer.taskTitle }}</span>
                    </div>
                    <div
                      v-if="
                        layer.taskId === DESIGN_DETAIL_TASK7_LINE_TASK_ID &&
                        layer.task7Blocks?.length
                      "
                      class="dd-tree-layer-track dd-tree-task7-track"
                      :style="task7TrackStyle(layer)"
                    >
                      <div
                        v-for="block in layer.task7Blocks"
                        :key="block.flowNode?.featureId ?? 'task7-block-' + block.operationNodes[0]?.featureId"
                        class="dd-tree-task7-process-block"
                      >
                        <div v-if="block.flowNode" class="dd-tree-task7-flow-row">
                          <div
                            class="dd-tree-node-slot dd-tree-node-slot--task7-flow"
                            @pointerenter="
                              onNodeFeatureTipEnter(block.flowNode!, layer.taskId, $event)
                            "
                            @pointermove="
                              onNodeFeatureTipMove(block.flowNode!, layer.taskId, $event)
                            "
                            @pointerleave="onNodeFeatureTipLeave"
                          >
                            <article
                              :class="
                                cardClassForLayer(layer.taskId, block.flowNode!, {
                                  task7Role: 'flow',
                                })
                              "
                              data-dd-tree-node-card="1"
                              role="button"
                              tabindex="0"
                              :aria-expanded="
                                valuePopover?.featureId === block.flowNode!.featureId
                                  ? 'true'
                                  : 'false'
                              "
                              :aria-label="
                                '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；若 value 被截断可展开全文：' +
                                cardValueLine(block.flowNode!.display)
                              "
                              :ref="
                                (el) =>
                                  setFeatureAnchor(block.flowNode!.featureId, el as Element | null)
                              "
                              @pointerdown.stop
                              @pointerenter="
                                onNodeFeatureTipEnter(block.flowNode!, layer.taskId, $event)
                              "
                              @pointermove="
                                onNodeFeatureTipMove(block.flowNode!, layer.taskId, $event)
                              "
                              @pointerleave="onNodeFeatureTipLeave"
                              @click="onNodeCardClick(block.flowNode!, $event)"
                              @keydown.enter.prevent="onNodeCardClick(block.flowNode!, $event)"
                              @keydown.space.prevent="onNodeCardClick(block.flowNode!, $event)"
                            >
                              <p class="dd-tree-card-fid" aria-hidden="true">
                                {{ formatLogicTreeFeatureIdShortLabel(block.flowNode!.featureId) }}
                              </p>
                              <p
                                v-if="cardTokenLine(block.flowNode!.display)"
                                class="dd-tree-card-tok"
                              >
                                <span class="dd-tree-card-tok-badge">
                                  {{ cardTokenLine(block.flowNode!.display) }}
                                </span>
                              </p>
                              <p class="dd-tree-card-op">
                                {{ cardOperatorLine(block.flowNode!.display) }}
                              </p>
                              <div class="dd-tree-card-val-wrap">
                                <p class="dd-tree-card-val">
                                  {{ cardValueLine(block.flowNode!.display) }}
                                </p>
                              </div>
                            </article>
                          </div>
                        </div>
                        <div v-if="block.operationNodes.length" class="dd-tree-task7-op-row">
                          <template
                            v-for="(op, oi) in block.operationNodes"
                            :key="op.featureId"
                          >
                            <span
                              v-if="oi > 0"
                              class="dd-tree-task7-seq-arrow"
                              aria-hidden="true"
                            >→</span>
                            <div
                              class="dd-tree-node-slot dd-tree-node-slot--task7-op"
                              @pointerenter="onNodeFeatureTipEnter(op, layer.taskId, $event)"
                              @pointermove="onNodeFeatureTipMove(op, layer.taskId, $event)"
                              @pointerleave="onNodeFeatureTipLeave"
                            >
                              <article
                                :class="
                                  cardClassForLayer(layer.taskId, op, { task7Role: 'op' })
                                "
                                data-dd-tree-node-card="1"
                                role="button"
                                tabindex="0"
                                :aria-expanded="
                                  valuePopover?.featureId === op.featureId ? 'true' : 'false'
                                "
                                :aria-label="
                                  '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；若 value 被截断可展开全文：' +
                                  cardValueLine(op.display)
                                "
                                :ref="(el) => setFeatureAnchor(op.featureId, el as Element | null)"
                                @pointerdown.stop
                                @pointerenter="onNodeFeatureTipEnter(op, layer.taskId, $event)"
                                @pointermove="onNodeFeatureTipMove(op, layer.taskId, $event)"
                                @pointerleave="onNodeFeatureTipLeave"
                                @click="onNodeCardClick(op, $event)"
                                @keydown.enter.prevent="onNodeCardClick(op, $event)"
                                @keydown.space.prevent="onNodeCardClick(op, $event)"
                              >
                                <p class="dd-tree-card-fid" aria-hidden="true">
                                  {{ formatLogicTreeFeatureIdShortLabel(op.featureId) }}
                                </p>
                                <p v-if="cardTokenLine(op.display)" class="dd-tree-card-tok">
                                  <span class="dd-tree-card-tok-badge">
                                    {{ cardTokenLine(op.display) }}
                                  </span>
                                </p>
                                <p class="dd-tree-card-op">{{ cardOperatorLine(op.display) }}</p>
                                <div class="dd-tree-card-val-wrap">
                                  <p class="dd-tree-card-val">{{ cardValueLine(op.display) }}</p>
                                </div>
                              </article>
                            </div>
                          </template>
                        </div>
                      </div>
                    </div>
                    <div
                      v-else-if="
                        layer.taskId === DESIGN_DETAIL_TASK8_LINE_TASK_ID &&
                        layer.task8Blocks?.length
                      "
                      class="dd-tree-layer-track dd-tree-task8-track"
                      :style="task8TrackStyle(layer)"
                    >
                      <div
                        v-for="block in layer.task8Blocks"
                        :key="
                          block.anchorNode?.featureId ??
                          'task8-orphan-' + block.prototypeNodes[0]?.featureId
                        "
                        class="dd-tree-task8-collab-block"
                      >
                        <p
                          v-if="block.anchorNode"
                          class="dd-tree-task8-anchor-caption"
                          :title="task8AnchorCaption(block.anchorNode)"
                        >
                          {{ task8AnchorCaption(block.anchorNode) }}
                        </p>
                        <p v-else class="dd-tree-task8-anchor-caption dd-tree-task8-anchor-caption--orphan">
                          未绑定协作节点
                        </p>
                        <div class="dd-tree-task8-prototype-row">
                          <div
                            v-for="node in block.prototypeNodes"
                            :key="node.featureId"
                            class="dd-tree-node-slot dd-tree-node-slot--task8-proto"
                            @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                            @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                            @pointerleave="onNodeFeatureTipLeave"
                          >
                            <article
                              :class="
                                cardClassForLayer(layer.taskId, node, { task9Role: 'menu' })
                              "
                              data-dd-tree-node-card="1"
                              role="button"
                              tabindex="0"
                              :aria-expanded="valuePopover?.featureId === node.featureId ? 'true' : 'false'"
                              :aria-label="
                                '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；若 value 被截断可展开全文：' +
                                cardValueLine(node.display)
                              "
                              :ref="(el) => setFeatureAnchor(node.featureId, el as Element | null)"
                              @pointerdown.stop
                              @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                              @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                              @pointerleave="onNodeFeatureTipLeave"
                              @click="onNodeCardClick(node, $event)"
                              @keydown.enter.prevent="onNodeCardClick(node, $event)"
                              @keydown.space.prevent="onNodeCardClick(node, $event)"
                            >
                              <p class="dd-tree-card-fid" aria-hidden="true">
                                {{ formatLogicTreeFeatureIdShortLabel(node.featureId) }}
                              </p>
                              <p v-if="cardTokenLine(node.display)" class="dd-tree-card-tok">
                                <span class="dd-tree-card-tok-badge">
                                  {{ cardTokenLine(node.display) }}
                                </span>
                              </p>
                              <p class="dd-tree-card-op">{{ cardOperatorLine(node.display) }}</p>
                              <div class="dd-tree-card-val-wrap">
                                <p class="dd-tree-card-val">{{ cardValueLine(node.display) }}</p>
                              </div>
                            </article>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      v-else-if="
                        layer.taskId === DESIGN_DETAIL_TASK9_LINE_TASK_ID &&
                        layer.task9Blocks?.length
                      "
                      class="dd-tree-layer-track dd-tree-task9-track"
                      :style="task9TrackStyle(layer)"
                    >
                      <div
                        v-for="block in layer.task9Blocks"
                        :key="
                          block.moduleNode?.featureId ??
                          'task9-orphan-' + block.menuNodes[0]?.featureId
                        "
                        class="dd-tree-task9-module-block"
                      >
                        <div v-if="block.moduleNode" class="dd-tree-task9-module-row">
                          <div
                            class="dd-tree-node-slot dd-tree-node-slot--task9-module"
                            @pointerenter="
                              onNodeFeatureTipEnter(block.moduleNode!, layer.taskId, $event)
                            "
                            @pointermove="
                              onNodeFeatureTipMove(block.moduleNode!, layer.taskId, $event)
                            "
                            @pointerleave="onNodeFeatureTipLeave"
                          >
                            <article
                              :class="
                                cardClassForLayer(layer.taskId, block.moduleNode!, {
                                  task9Role: 'module',
                                })
                              "
                              data-dd-tree-node-card="1"
                              role="button"
                              tabindex="0"
                              :aria-expanded="
                                valuePopover?.featureId === block.moduleNode!.featureId
                                  ? 'true'
                                  : 'false'
                              "
                              :aria-label="
                                '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；若 value 被截断可展开全文：' +
                                cardValueLine(block.moduleNode!.display)
                              "
                              :ref="
                                (el) =>
                                  setFeatureAnchor(block.moduleNode!.featureId, el as Element | null)
                              "
                              @pointerdown.stop
                              @pointerenter="
                                onNodeFeatureTipEnter(block.moduleNode!, layer.taskId, $event)
                              "
                              @pointermove="
                                onNodeFeatureTipMove(block.moduleNode!, layer.taskId, $event)
                              "
                              @pointerleave="onNodeFeatureTipLeave"
                              @click="onNodeCardClick(block.moduleNode!, $event)"
                              @keydown.enter.prevent="onNodeCardClick(block.moduleNode!, $event)"
                              @keydown.space.prevent="onNodeCardClick(block.moduleNode!, $event)"
                            >
                              <p class="dd-tree-card-fid" aria-hidden="true">
                                {{
                                  formatLogicTreeFeatureIdShortLabel(block.moduleNode!.featureId)
                                }}
                              </p>
                              <p
                                v-if="cardTokenLine(block.moduleNode!.display)"
                                class="dd-tree-card-tok"
                              >
                                <span class="dd-tree-card-tok-badge">
                                  {{ cardTokenLine(block.moduleNode!.display) }}
                                </span>
                              </p>
                              <p class="dd-tree-card-op">
                                {{ cardOperatorLine(block.moduleNode!.display) }}
                              </p>
                              <div class="dd-tree-card-val-wrap">
                                <p class="dd-tree-card-val">
                                  {{ cardValueLine(block.moduleNode!.display) }}
                                </p>
                              </div>
                            </article>
                          </div>
                        </div>
                        <p
                          v-else-if="block.menuNodes.length"
                          class="dd-tree-task9-module-orphan-hint"
                        >
                          未绑定一级模块
                        </p>
                        <div v-if="block.menuNodes.length" class="dd-tree-task9-menu-row">
                          <div
                            v-for="node in block.menuNodes"
                            :key="node.featureId"
                            class="dd-tree-node-slot dd-tree-node-slot--task9-menu"
                            @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                            @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                            @pointerleave="onNodeFeatureTipLeave"
                          >
                            <article
                              :class="cardClassForLayer(layer.taskId, node)"
                              data-dd-tree-node-card="1"
                              role="button"
                              tabindex="0"
                              :aria-expanded="valuePopover?.featureId === node.featureId ? 'true' : 'false'"
                              :aria-label="
                                '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；若 value 被截断可展开全文：' +
                                cardValueLine(node.display)
                              "
                              :ref="(el) => setFeatureAnchor(node.featureId, el as Element | null)"
                              @pointerdown.stop
                              @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                              @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                              @pointerleave="onNodeFeatureTipLeave"
                              @click="onNodeCardClick(node, $event)"
                              @keydown.enter.prevent="onNodeCardClick(node, $event)"
                              @keydown.space.prevent="onNodeCardClick(node, $event)"
                            >
                              <p class="dd-tree-card-fid" aria-hidden="true">
                                {{ formatLogicTreeFeatureIdShortLabel(node.featureId) }}
                              </p>
                              <p v-if="cardTokenLine(node.display)" class="dd-tree-card-tok">
                                <span class="dd-tree-card-tok-badge">
                                  {{ cardTokenLine(node.display) }}
                                </span>
                              </p>
                              <p class="dd-tree-card-op">{{ cardOperatorLine(node.display) }}</p>
                              <div class="dd-tree-card-val-wrap">
                                <p class="dd-tree-card-val">{{ cardValueLine(node.display) }}</p>
                              </div>
                            </article>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      v-else-if="
                        layer.taskId === DESIGN_DETAIL_TASK10_LINE_TASK_ID &&
                        (layer.task10Blocks?.length || layer.task10IntegrationBlock?.entries.length)
                      "
                      class="dd-tree-layer-track dd-tree-task10-track"
                      :style="task10TrackStyle(layer)"
                    >
                      <div
                        v-for="block in layer.task10Blocks ?? []"
                        :key="block.hostPlatform"
                        class="dd-tree-task10-host-block"
                      >
                        <p class="dd-tree-task10-host-caption" :title="block.hostPlatform">
                          {{ block.hostPlatform }}
                        </p>
                        <div
                          v-for="tier in block.cascadeTiers"
                          :key="`${block.hostPlatform}-${tier.tier}`"
                          class="dd-tree-task10-cascade-tier"
                        >
                          <p
                            class="dd-tree-task10-tier-caption"
                            :title="`${tier.tierLabel} · ${tier.tierRemark}`"
                          >
                            <span class="dd-tree-task10-tier-label">{{ tier.tierLabel }}</span>
                            <span class="dd-tree-task10-tier-remark">{{ tier.tierRemark }}</span>
                          </p>
                          <div
                            v-if="tier.tableEntries.length || tier.fieldEntries.length"
                            class="dd-tree-task10-tier-stack"
                          >
                            <div
                              v-if="tier.tableEntries.length"
                              class="dd-tree-task10-node-row dd-tree-task10-node-row--table"
                            >
                              <div
                                v-for="entry in tier.tableEntries"
                                :key="entry.node.featureId"
                                class="dd-tree-node-slot dd-tree-node-slot--task10"
                                @pointerenter="onNodeFeatureTipEnter(entry.node, layer.taskId, $event)"
                                @pointermove="onNodeFeatureTipMove(entry.node, layer.taskId, $event)"
                                @pointerleave="onNodeFeatureTipLeave"
                              >
                                <p
                                  v-if="entry.upstreamAnchor"
                                  class="dd-tree-task10-upstream-caption"
                                  :title="task10UpstreamCaption(entry.upstreamAnchor)"
                                >
                                  {{ task10UpstreamCaption(entry.upstreamAnchor) }}
                                </p>
                                <p
                                  v-else
                                  class="dd-tree-task10-upstream-caption dd-tree-task10-upstream-caption--orphan"
                                >
                                  未绑定上层正向归纳
                                </p>
                                <article
                                  :class="cardClassForLayer(layer.taskId, entry.node)"
                                  data-dd-tree-node-card="1"
                                  role="button"
                                  tabindex="0"
                                  :aria-expanded="
                                    valuePopover?.featureId === entry.node.featureId ? 'true' : 'false'
                                  "
                                  :aria-label="
                                    '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；若 value 被截断可展开全文：' +
                                    cardValueLine(entry.node.display, layer.taskId, entry.node)
                                  "
                                  :ref="(el) => setFeatureAnchor(entry.node.featureId, el as Element | null)"
                                  @pointerdown.stop
                                  @pointerenter="onNodeFeatureTipEnter(entry.node, layer.taskId, $event)"
                                  @pointermove="onNodeFeatureTipMove(entry.node, layer.taskId, $event)"
                                  @pointerleave="onNodeFeatureTipLeave"
                                  @click="onNodeCardClick(entry.node, $event, layer.taskId)"
                                  @keydown.enter.prevent="onNodeCardClick(entry.node, $event, layer.taskId)"
                                  @keydown.space.prevent="onNodeCardClick(entry.node, $event, layer.taskId)"
                                >
                                  <p class="dd-tree-card-fid" aria-hidden="true">
                                    {{ formatLogicTreeFeatureIdShortLabel(entry.node.featureId) }}
                                  </p>
                                  <p v-if="cardTokenLine(entry.node.display)" class="dd-tree-card-tok">
                                    <span class="dd-tree-card-tok-badge">
                                      {{ cardTokenLine(entry.node.display) }}
                                    </span>
                                  </p>
                                  <p class="dd-tree-card-op">{{ cardOperatorLine(entry.node.display) }}</p>
                                  <div class="dd-tree-card-val-wrap">
                                    <p class="dd-tree-card-val">
                                      {{ cardValueLine(entry.node.display, layer.taskId, entry.node) }}
                                    </p>
                                  </div>
                                </article>
                              </div>
                            </div>
                            <p
                              v-if="tier.fieldEntries.length"
                              class="dd-tree-task10-tier-subcaption"
                              title="表 → 字段内生强依赖纵向归纳"
                            >
                              字段层
                            </p>
                            <div
                              v-if="tier.fieldEntries.length"
                              class="dd-tree-task10-node-row dd-tree-task10-node-row--field"
                            >
                              <div
                                v-for="entry in tier.fieldEntries"
                                :key="entry.node.featureId"
                                class="dd-tree-node-slot dd-tree-node-slot--task10 dd-tree-node-slot--task10-field"
                                @pointerenter="onNodeFeatureTipEnter(entry.node, layer.taskId, $event)"
                                @pointermove="onNodeFeatureTipMove(entry.node, layer.taskId, $event)"
                                @pointerleave="onNodeFeatureTipLeave"
                              >
                                <article
                                  :class="[
                                    cardClassForLayer(layer.taskId, entry.node),
                                    'dd-tree-card--task10-field',
                                  ]"
                                  data-dd-tree-node-card="1"
                                  role="button"
                                  tabindex="0"
                                  :aria-expanded="
                                    valuePopover?.featureId === entry.node.featureId ? 'true' : 'false'
                                  "
                                  :aria-label="
                                    '字段子节点；表→字段正向归纳；字段→任务1化石血缘：' +
                                    cardValueLine(entry.node.display, layer.taskId, entry.node)
                                  "
                                  :ref="(el) => setFeatureAnchor(entry.node.featureId, el as Element | null)"
                                  @pointerdown.stop
                                  @pointerenter="onNodeFeatureTipEnter(entry.node, layer.taskId, $event)"
                                  @pointermove="onNodeFeatureTipMove(entry.node, layer.taskId, $event)"
                                  @pointerleave="onNodeFeatureTipLeave"
                                  @click="onNodeCardClick(entry.node, $event, layer.taskId)"
                                  @keydown.enter.prevent="onNodeCardClick(entry.node, $event, layer.taskId)"
                                  @keydown.space.prevent="onNodeCardClick(entry.node, $event, layer.taskId)"
                                >
                                  <p class="dd-tree-card-fid" aria-hidden="true">
                                    {{ formatLogicTreeFeatureIdShortLabel(entry.node.featureId) }}
                                  </p>
                                  <p v-if="cardTokenLine(entry.node.display)" class="dd-tree-card-tok">
                                    <span class="dd-tree-card-tok-badge">
                                      {{ cardTokenLine(entry.node.display) }}
                                    </span>
                                  </p>
                                  <p class="dd-tree-card-op">{{ cardOperatorLine(entry.node.display) }}</p>
                                  <div class="dd-tree-card-val-wrap">
                                    <p class="dd-tree-card-val">
                                      {{ cardValueLine(entry.node.display, layer.taskId, entry.node) }}
                                    </p>
                                  </div>
                                </article>
                              </div>
                            </div>
                          </div>
                          <p v-else class="dd-tree-task10-tier-empty">（本轨暂无表）</p>
                        </div>
                        <div
                          v-if="block.ancillaryEntries.length"
                          class="dd-tree-task10-cascade-tier dd-tree-task10-ancillary-tier"
                        >
                          <p class="dd-tree-task10-tier-caption" title="RBAC / 权限初始化">
                            <span class="dd-tree-task10-tier-label">附属</span>
                            <span class="dd-tree-task10-tier-remark">基础表初始化 / RBAC</span>
                          </p>
                          <div class="dd-tree-task10-node-row">
                            <div
                              v-for="entry in block.ancillaryEntries"
                              :key="entry.node.featureId"
                              class="dd-tree-node-slot dd-tree-node-slot--task10"
                              @pointerenter="onNodeFeatureTipEnter(entry.node, layer.taskId, $event)"
                              @pointermove="onNodeFeatureTipMove(entry.node, layer.taskId, $event)"
                              @pointerleave="onNodeFeatureTipLeave"
                            >
                              <p
                                v-if="entry.upstreamAnchor"
                                class="dd-tree-task10-upstream-caption"
                                :title="task10UpstreamCaption(entry.upstreamAnchor)"
                              >
                                {{ task10UpstreamCaption(entry.upstreamAnchor) }}
                              </p>
                              <p
                                v-else
                                class="dd-tree-task10-upstream-caption dd-tree-task10-upstream-caption--orphan"
                              >
                                未绑定上层正向归纳
                              </p>
                              <article
                                :class="cardClassForLayer(layer.taskId, entry.node)"
                                data-dd-tree-node-card="1"
                                role="button"
                                tabindex="0"
                                :aria-expanded="
                                  valuePopover?.featureId === entry.node.featureId ? 'true' : 'false'
                                "
                                :aria-label="
                                  '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；若 value 被截断可展开全文：' +
                                  cardValueLine(entry.node.display, layer.taskId, entry.node)
                                "
                                :ref="(el) => setFeatureAnchor(entry.node.featureId, el as Element | null)"
                                @pointerdown.stop
                                @pointerenter="onNodeFeatureTipEnter(entry.node, layer.taskId, $event)"
                                @pointermove="onNodeFeatureTipMove(entry.node, layer.taskId, $event)"
                                @pointerleave="onNodeFeatureTipLeave"
                                @click="onNodeCardClick(entry.node, $event, layer.taskId)"
                                @keydown.enter.prevent="onNodeCardClick(entry.node, $event, layer.taskId)"
                                @keydown.space.prevent="onNodeCardClick(entry.node, $event, layer.taskId)"
                              >
                                <p class="dd-tree-card-fid" aria-hidden="true">
                                  {{ formatLogicTreeFeatureIdShortLabel(entry.node.featureId) }}
                                </p>
                                <p v-if="cardTokenLine(entry.node.display)" class="dd-tree-card-tok">
                                  <span class="dd-tree-card-tok-badge">
                                    {{ cardTokenLine(entry.node.display) }}
                                  </span>
                                </p>
                                <p class="dd-tree-card-op">{{ cardOperatorLine(entry.node.display) }}</p>
                                <div class="dd-tree-card-val-wrap">
                                  <p class="dd-tree-card-val">
                                    {{ cardValueLine(entry.node.display, layer.taskId, entry.node) }}
                                  </p>
                                </div>
                              </article>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div
                        v-if="layer.task10IntegrationBlock?.entries.length"
                        class="dd-tree-task10-host-block dd-tree-task10-integration-block"
                      >
                        <p
                          class="dd-tree-task10-host-caption"
                          :title="TASK10_PLATFORM_INTEGRATION_BLOCK_LABEL"
                        >
                          {{ TASK10_PLATFORM_INTEGRATION_BLOCK_LABEL }}
                        </p>
                        <div class="dd-tree-task10-node-row">
                          <div
                            v-for="entry in layer.task10IntegrationBlock.entries"
                            :key="entry.node.featureId"
                            class="dd-tree-node-slot dd-tree-node-slot--task10"
                            @pointerenter="onNodeFeatureTipEnter(entry.node, layer.taskId, $event)"
                            @pointermove="onNodeFeatureTipMove(entry.node, layer.taskId, $event)"
                            @pointerleave="onNodeFeatureTipLeave"
                          >
                            <p
                              v-if="entry.upstreamAnchor"
                              class="dd-tree-task10-upstream-caption"
                              :title="task10UpstreamCaption(entry.upstreamAnchor)"
                            >
                              {{ task10UpstreamCaption(entry.upstreamAnchor) }}
                            </p>
                            <p
                              v-else
                              class="dd-tree-task10-upstream-caption dd-tree-task10-upstream-caption--orphan"
                            >
                              未绑定上层正向归纳
                            </p>
                            <article
                              :class="cardClassForLayer(layer.taskId, entry.node)"
                              data-dd-tree-node-card="1"
                              role="button"
                              tabindex="0"
                              :aria-expanded="
                                valuePopover?.featureId === entry.node.featureId ? 'true' : 'false'
                              "
                              :aria-label="
                                '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；若 value 被截断可展开全文：' +
                                cardValueLine(entry.node.display, layer.taskId, entry.node)
                              "
                              :ref="(el) => setFeatureAnchor(entry.node.featureId, el as Element | null)"
                              @pointerdown.stop
                              @pointerenter="onNodeFeatureTipEnter(entry.node, layer.taskId, $event)"
                              @pointermove="onNodeFeatureTipMove(entry.node, layer.taskId, $event)"
                              @pointerleave="onNodeFeatureTipLeave"
                              @click="onNodeCardClick(entry.node, $event, layer.taskId)"
                              @keydown.enter.prevent="onNodeCardClick(entry.node, $event, layer.taskId)"
                              @keydown.space.prevent="onNodeCardClick(entry.node, $event, layer.taskId)"
                            >
                              <p class="dd-tree-card-fid" aria-hidden="true">
                                {{ formatLogicTreeFeatureIdShortLabel(entry.node.featureId) }}
                              </p>
                              <p v-if="cardTokenLine(entry.node.display)" class="dd-tree-card-tok">
                                <span class="dd-tree-card-tok-badge">
                                  {{ cardTokenLine(entry.node.display) }}
                                </span>
                              </p>
                              <p class="dd-tree-card-op">{{ cardOperatorLine(entry.node.display) }}</p>
                              <div class="dd-tree-card-val-wrap">
                                <p class="dd-tree-card-val">
                                  {{ cardValueLine(entry.node.display, layer.taskId, entry.node) }}
                                </p>
                              </div>
                            </article>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      v-else-if="
                        layer.taskId === DESIGN_DETAIL_TASK51_LINE_TASK_ID && layer.task51Layout
                      "
                      class="dd-tree-layer-track dd-tree-task51-track"
                      :style="{ minWidth: layerTrackMinWidthForLayer(layer) }"
                    >
                      <div class="dd-tree-task51-subrow">
                        <p class="dd-tree-task51-subtitle">第一层：价值主张</p>
                        <div
                          class="dd-tree-task51-subtrack"
                          :style="{
                            minWidth: layerTrackMinWidth(
                              Math.max(layer.task51Layout.valuePropositionNodes.length, 1),
                            ),
                          }"
                        >
                          <div
                            v-for="node in layer.task51Layout.valuePropositionNodes"
                            :key="node.featureId"
                            class="dd-tree-node-slot"
                            @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                            @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                            @pointerleave="onNodeFeatureTipLeave"
                          >
                            <article
                              :class="
                                cardClassForLayer(layer.taskId, node, { task51Role: 'vp' })
                              "
                              data-dd-tree-node-card="1"
                              role="button"
                              tabindex="0"
                              :aria-expanded="
                                valuePopover?.featureId === node.featureId ? 'true' : 'false'
                              "
                              :aria-label="
                                '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；若 value 被截断可展开全文：' +
                                task51ValuePropositionCardPrimaryText(node)
                              "
                              :ref="(el) => setFeatureAnchor(node.featureId, el as Element | null)"
                              @pointerdown.stop
                              @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                              @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                              @pointerleave="onNodeFeatureTipLeave"
                              @click="onNodeCardClick(node, $event)"
                              @keydown.enter.prevent="onNodeCardClick(node, $event)"
                              @keydown.space.prevent="onNodeCardClick(node, $event)"
                            >
                              <p class="dd-tree-card-fid" aria-hidden="true">
                                {{ formatLogicTreeFeatureIdShortLabel(node.featureId) }}
                              </p>
                              <p v-if="cardTokenLine(node.display)" class="dd-tree-card-tok">
                                <span class="dd-tree-card-tok-badge">
                                  {{ cardTokenLine(node.display) }}
                                </span>
                              </p>
                              <div class="dd-tree-card-val-wrap">
                                <p class="dd-tree-card-val dd-tree-card-val--task51-vp">
                                  {{ task51ValuePropositionCardPrimaryText(node) }}
                                </p>
                              </div>
                            </article>
                          </div>
                        </div>
                      </div>
                      <div class="dd-tree-task51-subrow">
                        <p class="dd-tree-task51-subtitle">第二层：业务能力</p>
                        <div
                          class="dd-tree-task51-subtrack"
                          :style="{
                            minWidth: layerTrackMinWidth(
                              Math.max(layer.task51Layout.capabilityNodes.length, 1),
                            ),
                          }"
                        >
                          <div
                            v-for="node in layer.task51Layout.capabilityNodes"
                            :key="node.featureId"
                            class="dd-tree-node-slot"
                            @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                            @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                            @pointerleave="onNodeFeatureTipLeave"
                          >
                            <article
                              :class="
                                cardClassForLayer(layer.taskId, node, { task51Role: 'cap' })
                              "
                              data-dd-tree-node-card="1"
                              role="button"
                              tabindex="0"
                              :aria-expanded="
                                valuePopover?.featureId === node.featureId ? 'true' : 'false'
                              "
                              :aria-label="
                                '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；若 value 被截断可展开全文：' +
                                cardValueLine(node.display)
                              "
                              :ref="(el) => setFeatureAnchor(node.featureId, el as Element | null)"
                              @pointerdown.stop
                              @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                              @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                              @pointerleave="onNodeFeatureTipLeave"
                              @click="onNodeCardClick(node, $event)"
                              @keydown.enter.prevent="onNodeCardClick(node, $event)"
                              @keydown.space.prevent="onNodeCardClick(node, $event)"
                            >
                              <p class="dd-tree-card-fid" aria-hidden="true">
                                {{ formatLogicTreeFeatureIdShortLabel(node.featureId) }}
                              </p>
                              <p v-if="cardTokenLine(node.display)" class="dd-tree-card-tok">
                                <span class="dd-tree-card-tok-badge">
                                  {{ cardTokenLine(node.display) }}
                                </span>
                              </p>
                              <p class="dd-tree-card-op">{{ cardOperatorLine(node.display) }}</p>
                              <div class="dd-tree-card-val-wrap">
                                <p class="dd-tree-card-val">{{ cardValueLine(node.display) }}</p>
                              </div>
                            </article>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      v-else-if="
                        layer.taskId === DESIGN_DETAIL_TASK65_LINE_TASK_ID &&
                        layer.task65GapBoxes?.length
                      "
                      class="dd-tree-layer-track dd-tree-task65-track"
                      :style="{ minWidth: layerTrackMinWidthForLayer(layer) }"
                    >
                      <div
                        v-for="box in layer.task65GapBoxes"
                        :key="box.dimension"
                        class="dd-tree-task65-gap-box"
                      >
                        <p class="dd-tree-task65-gap-box-title">{{ box.title }}</p>
                        <div v-if="box.nodes.length" class="dd-tree-task65-gap-grid">
                          <div
                            v-for="(row, rowIdx) in chunkTask65GapNodesForGrid(box.nodes)"
                            :key="box.dimension + '-row-' + rowIdx"
                            class="dd-tree-task65-gap-row"
                          >
                            <div
                              v-for="node in row"
                              :key="node.featureId"
                              class="dd-tree-node-slot dd-tree-node-slot--task65"
                              :style="{
                                flex: `0 0 ${TASK65_LOGIC_TREE_NODE_SLOT_WIDTH_PX}px`,
                                width: `${TASK65_LOGIC_TREE_NODE_SLOT_WIDTH_PX}px`,
                                minWidth: `${TASK65_LOGIC_TREE_NODE_SLOT_WIDTH_PX}px`,
                                maxWidth: `${TASK65_LOGIC_TREE_NODE_SLOT_WIDTH_PX}px`,
                              }"
                              @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                              @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                              @pointerleave="onNodeFeatureTipLeave"
                            >
                              <article
                                :class="cardClassForLayer(layer.taskId, node)"
                                data-dd-tree-node-card="1"
                                role="button"
                                tabindex="0"
                                :aria-expanded="
                                  valuePopover?.featureId === node.featureId ? 'true' : 'false'
                                "
                                :aria-label="
                                  '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；节点编号 ' +
                                  formatLogicTreeFeatureIdShortLabel(node.featureId)
                                "
                                :ref="(el) => setFeatureAnchor(node.featureId, el as Element | null)"
                                @pointerdown.stop
                                @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                                @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                                @pointerleave="onNodeFeatureTipLeave"
                                @click="onNodeCardClick(node, $event, layer.taskId)"
                                @keydown.enter.prevent="onNodeCardClick(node, $event, layer.taskId)"
                                @keydown.space.prevent="onNodeCardClick(node, $event, layer.taskId)"
                              >
                                <p class="dd-tree-card-fid dd-tree-card-fid--task65-only">
                                  {{ formatLogicTreeFeatureIdShortLabel(node.featureId) }}
                                </p>
                              </article>
                            </div>
                            <span
                              v-for="pad in TASK65_LOGIC_TREE_NODES_PER_ROW - row.length"
                              :key="box.dimension + '-pad-' + rowIdx + '-' + pad"
                              class="dd-tree-task65-gap-pad"
                              aria-hidden="true"
                            />
                          </div>
                        </div>
                        <p v-else class="dd-tree-task65-gap-empty">（本维度暂无 Gap 节点）</p>
                      </div>
                    </div>
                    <div
                      v-else-if="layer.taskId === DESIGN_DETAIL_TASK52_LINE_TASK_ID"
                      class="dd-tree-layer-track dd-tree-layer-track--flex dd-tree-layer-track--task52"
                      :style="task52TrackStyle(layer)"
                    >
                      <div
                        v-for="node in layer.nodes"
                        :key="node.featureId"
                        class="dd-tree-node-slot dd-tree-node-slot--task52"
                        @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                        @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                        @pointerleave="onNodeFeatureTipLeave"
                      >
                        <article
                          :class="cardClassForLayer(layer.taskId, node)"
                          data-dd-tree-node-card="1"
                          role="button"
                          tabindex="0"
                          :aria-expanded="valuePopover?.featureId === node.featureId ? 'true' : 'false'"
                          :aria-label="
                            '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；字段集：' +
                            task52FieldSetCardTitle(node)
                          "
                          :ref="(el) => setFeatureAnchor(node.featureId, el as Element | null)"
                          @pointerdown.stop
                          @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                          @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                          @pointerleave="onNodeFeatureTipLeave"
                          @click="onNodeCardClick(node, $event, layer.taskId)"
                          @keydown.enter.prevent="onNodeCardClick(node, $event, layer.taskId)"
                          @keydown.space.prevent="onNodeCardClick(node, $event, layer.taskId)"
                        >
                          <p class="dd-tree-card-fid" aria-hidden="true">
                            {{ formatLogicTreeFeatureIdShortLabel(node.featureId) }}
                          </p>
                          <p v-if="cardTokenLine(node.display)" class="dd-tree-card-tok">
                            <span class="dd-tree-card-tok-badge">
                              {{ cardTokenLine(node.display) }}
                            </span>
                          </p>
                          <p class="dd-tree-card-op">{{ cardOperatorLine(node.display) }}</p>
                          <div class="dd-tree-card-val-wrap dd-tree-card-val-wrap--task52">
                            <p class="dd-tree-card-val dd-tree-card-val--task52-title">
                              {{ task52FieldSetCardTitle(node) }}
                            </p>
                            <div
                              v-if="task52FieldSchemaLeavesFromNode(node).length"
                              class="dd-tree-field-tag-grid"
                              aria-label="字段名标签"
                            >
                              <div
                                v-for="(row, rowIdx) in task52FieldTagRows(node)"
                                :key="task52FieldTagRowKey(row, rowIdx)"
                                class="dd-tree-field-tag-row"
                              >
                                <span
                                  v-for="leaf in row"
                                  :key="leaf.sourceFeatureId || leaf.fieldName"
                                  class="dd-tree-field-tag"
                                  :title="task52FieldTagTooltip(leaf)"
                                >
                                  <img
                                    class="dd-tree-field-tag-excel"
                                    :src="DESIGN_DETAIL_EXCEL_FIELD_ICON_URL"
                                    alt=""
                                    width="14"
                                    height="14"
                                    aria-hidden="true"
                                  />
                                  <span class="dd-tree-field-tag-label">{{ leaf.fieldName }}</span>
                                </span>
                                <span
                                  v-for="pad in TASK52_LOGIC_TREE_FIELD_TAGS_PER_ROW - row.length"
                                  :key="'pad-' + rowIdx + '-' + pad"
                                  class="dd-tree-field-tag dd-tree-field-tag--pad"
                                  aria-hidden="true"
                                />
                              </div>
                              <div
                                v-for="pi in task52FieldTagPaddingRowCount(
                                  node,
                                  task52MaxFieldTagRowCount(layer.nodes),
                                )"
                                :key="'pad-row-' + node.featureId + '-' + pi"
                                class="dd-tree-field-tag-row dd-tree-field-tag-row--pad"
                                aria-hidden="true"
                              >
                                <span
                                  v-for="j in TASK52_LOGIC_TREE_FIELD_TAGS_PER_ROW"
                                  :key="'pad-cell-' + j"
                                  class="dd-tree-field-tag dd-tree-field-tag--pad"
                                />
                              </div>
                            </div>
                            <p v-else class="dd-tree-card-val dd-tree-card-val--task52-empty">
                              （无 fields_schema_tree）
                            </p>
                          </div>
                        </article>
                      </div>
                    </div>
                    <div
                      v-else-if="layer.taskId === DESIGN_DETAIL_TASK53_LINE_TASK_ID"
                      class="dd-tree-layer-track dd-tree-layer-track--flex dd-tree-layer-track--task53"
                      :style="task53TrackStyle(layer)"
                    >
                      <div
                        v-for="node in layer.nodes"
                        :key="node.featureId"
                        class="dd-tree-node-slot dd-tree-node-slot--task53"
                        :style="task53NodeSlotStyle(node)"
                        @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                        @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                        @pointerleave="onNodeFeatureTipLeave"
                      >
                        <article
                          :class="cardClassForLayer(layer.taskId, node)"
                          data-dd-tree-node-card="1"
                          role="button"
                          tabindex="0"
                          :aria-expanded="valuePopover?.featureId === node.featureId ? 'true' : 'false'"
                          :aria-label="
                            '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；' +
                            (isTask53WorkflowStepLayerNode(node)
                              ? '环节：' + task53StepCardTitle(node)
                              : '流程：' + task53WorkflowCardTitle(node))
                          "
                          :ref="(el) => setFeatureAnchor(node.featureId, el as Element | null)"
                          @pointerdown.stop
                          @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                          @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                          @pointerleave="onNodeFeatureTipLeave"
                          @click="onNodeCardClick(node, $event, layer.taskId)"
                          @keydown.enter.prevent="onNodeCardClick(node, $event, layer.taskId)"
                          @keydown.space.prevent="onNodeCardClick(node, $event, layer.taskId)"
                        >
                          <p class="dd-tree-card-fid" aria-hidden="true">
                            {{ formatLogicTreeFeatureIdShortLabel(node.featureId) }}
                          </p>
                          <p v-if="cardTokenLine(node.display)" class="dd-tree-card-tok">
                            <span class="dd-tree-card-tok-badge">
                              {{ cardTokenLine(node.display) }}
                            </span>
                          </p>
                          <p class="dd-tree-card-op">{{ cardOperatorLine(node.display) }}</p>
                          <div
                            class="dd-tree-card-val-wrap dd-tree-card-val-wrap--task53"
                            :aria-label="
                              isTask53WorkflowStepLayerNode(node)
                                ? '流程环节：' + task53StepCardTitle(node)
                                : '业务流程：' + task53WorkflowCardTitle(node)
                            "
                          >
                            <div
                              v-if="isTask53WorkflowStepLayerNode(node)"
                              class="dd-tree-workflow-step-shell"
                            >
                              <p class="dd-tree-workflow-step-shell-title">
                                {{ task53StepMetaFromNode(node).stepName }}
                              </p>
                              <p
                                v-if="task53StepMetaFromNode(node).associatedCapabilityUnit"
                                class="dd-tree-workflow-step-shell-meta"
                              >
                                单元：{{ task53StepMetaFromNode(node).associatedCapabilityUnit }}
                              </p>
                              <p
                                v-if="task53StepMetaFromNode(node).associatedAssetDataset"
                                class="dd-tree-workflow-step-shell-meta"
                              >
                                字段集：{{ task53StepMetaFromNode(node).associatedAssetDataset }}
                              </p>
                            </div>
                            <div v-else class="dd-tree-workflow-shell">
                              <p class="dd-tree-workflow-shell-title">
                                {{ task53WorkflowCardTitle(node) }}
                              </p>
                              <div
                                v-if="task53WorkflowOrderedStepsFromNode(node).length"
                                class="dd-tree-workflow-steps"
                                role="list"
                                aria-label="业务环节时序链"
                              >
                                <template
                                  v-for="(chip, si) in task53WorkflowOrderedStepsFromNode(node)"
                                  :key="node.featureId + '-step-' + si"
                                >
                                  <span
                                    v-if="si > 0"
                                    class="dd-tree-workflow-step-arrow"
                                    aria-hidden="true"
                                  >→</span>
                                  <span
                                    class="dd-tree-workflow-step-chip"
                                    role="listitem"
                                    :title="chip.stepName"
                                    :ref="
                                      (el) =>
                                        registerTask53StepChipAnchor(el, node, chip.stepName)
                                    "
                                  >
                                    {{ chip.stepName }}
                                  </span>
                                </template>
                              </div>
                              <p v-else class="dd-tree-workflow-steps-empty">（无环节链）</p>
                            </div>
                          </div>
                        </article>
                      </div>
                    </div>
                    <div
                      v-else
                      class="dd-tree-layer-track dd-tree-layer-track--flex"
                      :style="{ minWidth: layerTrackMinWidthForLayer(layer) }"
                    >
                      <div
                        v-for="node in layer.nodes"
                        :key="node.featureId"
                        class="dd-tree-node-slot"
                        @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                        @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                        @pointerleave="onNodeFeatureTipLeave"
                      >
                        <article
                          :class="cardClassForLayer(layer.taskId, node)"
                          data-dd-tree-node-card="1"
                          role="button"
                          tabindex="0"
                          :aria-expanded="valuePopover?.featureId === node.featureId ? 'true' : 'false'"
                          :aria-label="
                            '聚焦：正向归纳上游（蓝）与自本点反向验证至任务1（绿）；若 value 被截断可展开全文：' +
                            cardValueLine(node.display)
                          "
                          :ref="(el) => setFeatureAnchor(node.featureId, el as Element | null)"
                          @pointerdown.stop
                          @pointerenter="onNodeFeatureTipEnter(node, layer.taskId, $event)"
                          @pointermove="onNodeFeatureTipMove(node, layer.taskId, $event)"
                          @pointerleave="onNodeFeatureTipLeave"
                          @click="onNodeCardClick(node, $event)"
                          @keydown.enter.prevent="onNodeCardClick(node, $event)"
                          @keydown.space.prevent="onNodeCardClick(node, $event)"
                        >
                          <span
                            v-if="
                              isTask1LayerTaskId(layer.taskId) &&
                              isLogicTreeFeatureResolvedByCustomer(node.display)
                            "
                            class="dd-tree-resolved-badge"
                            title="客户纠偏已消解（Validation_Status: Resolved_By_Customer）"
                            aria-label="Resolved"
                          >Resolved</span>
                          <p class="dd-tree-card-fid" aria-hidden="true">
                            {{ formatLogicTreeFeatureIdShortLabel(node.featureId) }}
                          </p>
                          <p v-if="cardTokenLine(node.display)" class="dd-tree-card-tok">
                            <span
                              class="dd-tree-card-tok-badge"
                              :class="{
                                'dd-tree-card-tok-badge--task5-vsm-stage':
                                  isTask5ValueStreamStageLogicTreeNode(layer.taskId, node),
                              }"
                            >
                              {{ cardTokenLine(node.display) }}
                            </span>
                            <span
                              v-if="
                                layer.taskId === 'customer_basic' &&
                                isTask1FeaturePainPointConfirmed(node.display)
                              "
                              class="dd-tree-pain-badge"
                              :class="task1PainBadgeExtraClass(node.featureId)"
                              :title="task1PainBadgeTitle(node.featureId)"
                            >PAIN</span>
                          </p>
                          <p class="dd-tree-card-op">{{ cardOperatorLine(node.display) }}</p>
                          <div class="dd-tree-card-val-wrap">
                            <p class="dd-tree-card-val">{{ cardValueLine(node.display) }}</p>
                          </div>
                        </article>
                      </div>
                    </div>
                  </div>
                </template>
                <p v-if="!hasGraphContent" class="dd-tree-empty">暂无推理图节点（可先在工具详情维护「特征」视图，或完成任务 1 / 任务 2 同步）。</p>
              </div>
              <!-- 5.3 环节正向归纳边绘于节点之上，避免被关键工作流卡遮挡 -->
              <svg
                class="dd-tree-svg dd-tree-svg--task53-step-overlay"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <template v-if="edgePathFocusSplitOverlay.useSingleLayer">
                  <path
                    v-for="item in edgePathItemsTask53Overlay"
                    :key="'e53-' + item.sid + '-' + item.tid"
                    :d="item.d"
                    :class="edgePathClasses(item)"
                    :style="edgePathDashStyle(item)"
                    fill="none"
                    :marker-end="'url(#' + edgeMarkerRefId(item) + ')'"
                  />
                </template>
                <template v-else>
                  <path
                    v-for="item in edgePathFocusSplitOverlay.focus"
                    :key="'efb53-' + item.sid + '-' + item.tid"
                    :d="item.d"
                    :class="edgePathClasses(item) + ' dd-tree-edge--focus-interactive'"
                    :style="edgePathDashStyle(item)"
                    fill="none"
                    marker-end="none"
                    @pointerenter="onFocusEdgePointerEnter(item, $event)"
                    @pointermove="onFocusEdgePointerMove(item, $event)"
                    @pointerleave="onFocusEdgePointerLeave"
                  />
                  <path
                    v-for="item in edgePathFocusSplitOverlay.focus"
                    :key="'efm53-' + item.sid + '-' + item.tid"
                    :d="item.d"
                    class="dd-tree-edge dd-tree-edge--focus-marker-only"
                    fill="none"
                    :marker-end="'url(#' + edgeMarkerRefId(item) + ')'"
                  />
                  <path
                    v-for="item in edgePathFocusSplitOverlay.focus"
                    :key="'efh53-' + item.sid + '-' + item.tid"
                    :d="item.d"
                    class="dd-tree-edge-hit"
                    fill="none"
                    @pointerenter="onFocusEdgePointerEnter(item, $event)"
                    @pointermove="onFocusEdgePointerMove(item, $event)"
                    @pointerleave="onFocusEdgePointerLeave"
                  />
                </template>
              </svg>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
    <div
      v-if="valuePopover"
      class="dd-tree-value-popover"
      role="tooltip"
      :style="{
        top: valuePopover.top + 'px',
        left: valuePopover.left + 'px',
        maxWidth: valuePopover.maxWidth + 'px',
        maxHeight: valuePopover.maxHeight + 'px',
      }"
      @click.stop
    >
      <p class="dd-tree-value-popover-text">{{ valuePopover.text }}</p>
    </div>
    <div
      v-if="edgeLogicTip"
      class="dd-tree-edge-logic-tip"
      :class="'dd-tree-edge-logic-tip--' + edgeLogicTip.theme"
      role="tooltip"
      :style="{
        top: edgeLogicTip.top + 'px',
        left: edgeLogicTip.left + 'px',
        maxWidth: edgeLogicTip.maxWidth + 'px',
      }"
    >
      <p class="dd-tree-edge-logic-tip-text">{{ edgeLogicTip.text }}</p>
    </div>
    <div
      v-if="nodeFeatureTip"
      class="dd-tree-node-feature-tip"
      role="tooltip"
      :style="{
        top: nodeFeatureTip.top + 'px',
        left: nodeFeatureTip.left + 'px',
        maxWidth: nodeFeatureTip.maxWidth + 'px',
      }"
    >
      <template v-if="nodeFeatureTip.kind === 'task1_feature_id'">
        <section class="dd-tree-node-feature-tip-card">
          <h4 class="dd-tree-node-feature-tip-card-title">节点编号</h4>
          <p class="dd-tree-node-feature-tip-card-body dd-tree-node-feature-tip-card-body--mono">
            {{ nodeFeatureTip.featureId }}
          </p>
        </section>
      </template>
      <template v-else>
        <section class="dd-tree-node-feature-tip-card">
          <h4 class="dd-tree-node-feature-tip-card-title">取值范围</h4>
          <p class="dd-tree-node-feature-tip-card-body">{{ nodeFeatureTip.valueRefDomainText }}</p>
        </section>
        <section class="dd-tree-node-feature-tip-card">
          <h4 class="dd-tree-node-feature-tip-card-title">推理结论</h4>
          <p class="dd-tree-node-feature-tip-card-body">{{ nodeFeatureTip.inferenceSummaryText }}</p>
        </section>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.dd-tree-backdrop {
  position: fixed;
  inset: 0;
  z-index: 4001;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: stretch;
  padding: 0;
  box-sizing: border-box;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  overflow: hidden;
  min-height: 100vh;
  min-height: 100dvh;
}

.dd-tree-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  max-width: none;
  margin: 0;
  background: #fff;
  border-radius: 0;
  border: none;
  box-shadow: none;
  padding: 0.75rem 1rem 1rem;
  box-sizing: border-box;
}

.dd-tree-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
  flex-shrink: 0;
}

.dd-tree-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
}

.dd-tree-head-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.dd-tree-download {
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 10px;
  padding: 0.35rem 0.85rem;
  border: 1px solid #16a34a;
  color: #15803d;
  background: #f0fdf4;
}

.dd-tree-download:hover:not(:disabled) {
  background: #dcfce7;
}

.dd-tree-download:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.dd-tree-download--json {
  border-color: #2563eb;
  color: #1d4ed8;
  background: #eff6ff;
}

.dd-tree-download--json:hover:not(:disabled) {
  background: #dbeafe;
}

.dd-tree-close {
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 10px;
  padding: 0.35rem 0.85rem;
  border: 1px solid #2563eb;
  color: #1d4ed8;
  background: #eff6ff;
}

.dd-tree-close:hover {
  background: #dbeafe;
}

.dd-tree-page-capture {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  background: #fff;
}

.dd-tree-error,
.dd-tree-loading,
.dd-tree-empty {
  margin: 0;
  font-size: 0.82rem;
  color: #64748b;
  flex-shrink: 0;
}

.dd-tree-error {
  color: #b91c1c;
}

.dd-tree-canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.dd-tree-hscroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  width: 100%;
  min-width: 0;
  -webkit-overflow-scrolling: touch;
}

.dd-tree-hscroll-inner {
  position: relative;
  isolation: isolate;
  display: inline-block;
  vertical-align: top;
  min-width: 100%;
  min-height: 100%;
  box-sizing: border-box;
}

.dd-tree-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
  overflow: visible;
}

/** 5.3 环节正向归纳边：叠在节点层之上，避免被流程卡白底遮挡 */
.dd-tree-svg--task53-step-overlay {
  z-index: 6;
}

/**
 * focus 下：环节入边 overlay 须高于 `.dd-tree-body`（4）及 focus 脉动卡（4～5），
 * 否则 5.1/5.2→环节 紫色边会被关键工作流卡盖住。
 */
.dd-tree-canvas--focus-mode .dd-tree-svg--task53-step-overlay {
  z-index: 50;
  transform: translateZ(0);
}

/**
 * focus 下：节点层（z-index:4）高于底层 SVG（z-index:3），蓝/绿高亮卡可接收 pointerenter；
 * 5.3 环节紫色边由 overlay（z-index:50）绘制，不在此层。
 */
.dd-tree-canvas--focus-mode .dd-tree-svg:not(.dd-tree-svg--task53-step-overlay) {
  pointer-events: none;
  z-index: 3;
}

.dd-tree-canvas--focus-mode .dd-tree-body {
  pointer-events: none;
  z-index: 4;
}

/** focus 下 5.3 关键工作流卡不抬升 z-index，避免压盖环节入边（光晕仍由 box-shadow 保留） */
.dd-tree-canvas--focus-mode .dd-tree-card--task53-workflow.dd-tree-card--focus-chain,
.dd-tree-canvas--focus-mode .dd-tree-card--task53-workflow.dd-tree-card--focus-dual-fr,
.dd-tree-canvas--focus-mode .dd-tree-card--task53-workflow.dd-tree-card--focus-dual-fr-warn,
.dd-tree-canvas--focus-mode .dd-tree-card--task53-workflow.dd-tree-card--focus-dim {
  z-index: 0;
}

.dd-tree-canvas--focus-mode .dd-tree-node-slot,
.dd-tree-canvas--focus-mode .dd-tree-card,
.dd-tree-canvas--focus-mode .dd-tree-layer-label {
  pointer-events: auto;
}

.dd-tree-canvas--focus-mode .dd-tree-card--focus-rv,
.dd-tree-canvas--focus-mode .dd-tree-card--focus-rv-warn,
.dd-tree-canvas--focus-mode .dd-tree-card--focus-dual-fr,
.dd-tree-canvas--focus-mode .dd-tree-card--focus-dual-fr-warn {
  position: relative;
  z-index: 5;
}

.dd-tree-edge {
  stroke: #2563eb;
  stroke-width: 2.25;

}

/** 任务 9 本层：一级模块 → 二级菜单（双源横向 + Belongs_To 落库边，块内垂直连线） */
.dd-tree-edge--task9-intra {
  stroke: #0d9488;
  stroke-width: 2.5;
}

.dd-tree-edge--task9-intra.dd-tree-edge--focus {
  stroke: #0f766e;
  stroke-width: 2.75;
}

/** 任务 0 层 → 下游正向归纳边（与任务 0 卡片青绿、痛点紫区分） */
.dd-tree-edge--task0-fi {
  stroke: #9333ea;
  stroke-width: 2.35;
}

.dd-tree-edge--task0-fi.dd-tree-edge--focus {
  stroke: #7e22ce;
  stroke-width: 2.65;
}

/** 任务 5.1/5.2 → 5.3 流程环节正向归纳边（紫色，与任务 0 出边区分语义） */
.dd-tree-edge--task53-step-fi {
  stroke: #9333ea;
  stroke-width: 2.35;
}

.dd-tree-edge--task53-step-fi.dd-tree-edge--focus {
  stroke: #7e22ce;
  stroke-width: 2.65;
}

/** 任务 8 层 → 任务 8.5 正向归纳边（纵向业务因果，琥珀色） */
.dd-tree-edge--task8-fi {
  stroke: #d97706;
  stroke-width: 2.35;
}

.dd-tree-edge--task8-fi.dd-tree-edge--focus {
  stroke: #b45309;
  stroke-width: 2.65;
}

/** 反向验证边：虚线（可与 val-ok / val-warn 配色叠加） */
.dd-tree-edge--reverse {
  stroke-dasharray: 6 5;
}

.dd-tree-edge--focus {
  stroke: #1d4ed8;
  stroke-width: 2.65;
}

.dd-tree-edge--dim {
  stroke: #cbd5e1;
  stroke-width: 1.85;
  opacity: 0.52;
}

.dd-tree-edge--val-ok {
  stroke: #16a34a;
}

.dd-tree-edge--val-warn {
  stroke: #dc2626;
}

.dd-tree-edge--val-ok.dd-tree-edge--focus {
  stroke: #15803d;
  stroke-width: 2.65;
}

.dd-tree-edge--val-warn.dd-tree-edge--focus {
  stroke: #b91c1c;
  stroke-width: 2.65;
}

.dd-tree-edge--val-ok.dd-tree-edge--dim,
.dd-tree-edge--val-warn.dd-tree-edge--dim {
  stroke: #94a3b8;
  stroke-width: 1.85;
  opacity: 0.52;
}

.dd-tree-canvas--focus-mode .dd-tree-card--focus-dim {
  opacity: 0.4;
  filter: grayscale(0.42);
  transition: opacity 0.22s ease, filter 0.22s ease;
}

.dd-tree-card--focus-chain {
  position: relative;
  z-index: 4;
  animation: dd-tree-card-focus-pulse 1.65s ease-in-out infinite;
}

@keyframes dd-tree-card-focus-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.45);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.88);
  }
}

.dd-tree-card--focus-rv {
  position: relative;
  z-index: 4;
  animation: dd-tree-card-focus-rv-pulse 1.65s ease-in-out infinite;
}

@keyframes dd-tree-card-focus-rv-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.48);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.88);
  }
}

/** focus 下任务 1 红色主题（潜在冲突反向验证 target）脉动光晕 */
.dd-tree-card--focus-rv-warn {
  position: relative;
  z-index: 4;
  animation: dd-tree-card-focus-rv-warn-pulse 1.65s ease-in-out infinite;
}

@keyframes dd-tree-card-focus-rv-warn-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.48);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.9);
  }
}

.dd-tree-card--focus-dual-fr {
  position: relative;
  z-index: 4;
  animation: dd-tree-card-focus-dual-fr-pulse 1.65s ease-in-out infinite;
}

@keyframes dd-tree-card-focus-dual-fr-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 2px rgba(37, 99, 235, 0.42),
      0 0 0 5px rgba(22, 163, 74, 0.38);
  }
  50% {
    box-shadow:
      0 0 0 4px rgba(37, 99, 235, 0.78),
      0 0 0 8px rgba(34, 197, 94, 0.55);
  }
}

.dd-tree-card--focus-dual-fr-warn {
  position: relative;
  z-index: 4;
  animation: dd-tree-card-focus-dual-fr-warn-pulse 1.65s ease-in-out infinite;
}

@keyframes dd-tree-card-focus-dual-fr-warn-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 2px rgba(37, 99, 235, 0.42),
      0 0 0 5px rgba(220, 38, 38, 0.38);
  }
  50% {
    box-shadow:
      0 0 0 4px rgba(37, 99, 235, 0.78),
      0 0 0 8px rgba(239, 68, 68, 0.58);
  }
}

.dd-tree-canvas--focus-mode .dd-tree-edge--flow-fi.dd-tree-edge--focus,
.dd-tree-canvas--focus-mode .dd-tree-edge--flow-rv.dd-tree-edge--focus {
  stroke-width: 2.65;
  filter: drop-shadow(0 0 4px rgba(37, 99, 235, 0.45));


  animation: dd-tree-edge-focus-breathe 2s ease-in-out infinite;
}

.dd-tree-canvas--focus-mode .dd-tree-edge--flow-fi.dd-tree-edge--task0-fi.dd-tree-edge--focus,
.dd-tree-canvas--focus-mode .dd-tree-edge--flow-fi.dd-tree-edge--task53-step-fi.dd-tree-edge--focus {
  filter: drop-shadow(0 0 4px rgba(147, 51, 234, 0.48));
}

@keyframes dd-tree-edge-focus-breathe {
  0%, 100% { stroke-width: 2.65; opacity: 1; }
  50% { stroke-width: 3.2; opacity: 0.82; }
}

/** focus 高亮边「仅箭头」层：同几何路径但不绘 stroke，避免 `.dd-tree-edge` 的 stroke 盖住下层线体；marker 仍绘在末端 */
.dd-tree-edge.dd-tree-edge--focus-marker-only {
  stroke: none !important;
  stroke-width: 0 !important;
  fill: none;
  pointer-events: none;
  opacity: 1;
}

/** focus 高亮边：可见线体也可触发悬停（加宽命中，虚线边用实线命中区） */
.dd-tree-canvas--focus-mode .dd-tree-edge--focus-interactive {
  pointer-events: stroke;
  cursor: default;
}

/** focus 高亮边透明加宽命中区（叠在可见线体之上），用于悬停展示推理逻辑 */
.dd-tree-edge-hit {
  pointer-events: stroke;
  stroke: transparent !important;
  stroke-width: 20;
  stroke-dasharray: none !important;
  fill: none;
  cursor: default;
}

.dd-tree-edge-logic-tip {
  position: fixed;
  z-index: 4025;
  box-sizing: border-box;
  padding: 0.55rem 0.72rem;
  border-radius: 10px;
  font-size: 0.8125rem;
  line-height: 1.45;
  pointer-events: none;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(6px);
}

.dd-tree-edge-logic-tip-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.dd-tree-edge-logic-tip--fi {
  background: rgba(37, 99, 235, 0.9);
  color: #f8fafc;
  border: 1px solid rgba(147, 197, 253, 0.45);
}

.dd-tree-edge-logic-tip--rv-ok {
  background: rgba(22, 163, 74, 0.9);
  color: #f0fdf4;
  border: 1px solid rgba(134, 239, 172, 0.45);
}

.dd-tree-edge-logic-tip--rv-warn {
  background: rgba(220, 38, 38, 0.9);
  color: #fef2f2;
  border: 1px solid rgba(252, 165, 165, 0.45);
}

.dd-tree-node-feature-tip {
  position: fixed;
  z-index: 4026;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.55rem;
  border-radius: 12px;
  background: #fff;
  pointer-events: none;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
  border: 1px solid rgba(226, 232, 240, 0.95);
}

.dd-tree-node-feature-tip-card {
  margin: 0;
  padding: 0.45rem 0.5rem;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.dd-tree-node-feature-tip-card-title {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #334155;
  line-height: 1.3;
}

.dd-tree-node-feature-tip-card-body--mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 0.78rem;
  word-break: break-all;
}

.dd-tree-node-feature-tip-card-body {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: #64748b;
  white-space: pre-wrap;
  word-break: break-word;
}

.dd-tree-body {
  position: relative;
  z-index: 1;
}

.dd-tree-layer {
  --dd-node-row-h: 5.5rem;
}

.dd-tree-layer:not(.dd-tree-layer--last) {
  /* 原 0.3；×1.2 → 0.36，任务层之间垂直间距增加 20% */
  margin-bottom: calc(var(--dd-node-row-h) * 0.36);
}

.dd-tree-layer--last {
  margin-bottom: 0;
}

.dd-tree-layer-label {
  position: relative;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  font-size: 0.72rem;
  font-weight: 700;
  margin: 0 0 0.45rem;
  line-height: 1.45;
}

.dd-tree-layer-inference-tier {
  color: #15803d;
  font-weight: 700;
}

.dd-tree-layer-label-sep {
  color: #94a3b8;
  font-weight: 700;
}

.dd-tree-layer-task-title-line {
  color: #475569;
  font-weight: 700;
}

.dd-tree-layer-track {
  box-sizing: border-box;
}

.dd-tree-layer-track--flex {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  justify-content: space-evenly;
  gap: 0.5rem;
  padding: 0 0.35rem;
  min-height: 4.25rem;
}

/** 任务 7：按「所属业务流程」横向分块；子块透明底仅边框，不遮挡 SVG 连线 */
.dd-tree-task7-track {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  justify-content: center;
  width: 100%;
  gap: var(--dd-task7-block-gap, 2rem);
  padding: 0.35rem 1.25rem;
  min-height: 10.5rem;
  box-sizing: border-box;
}

.dd-tree-task7-process-block {
  flex: 0 0 auto;
  /* 流程块基准宽 520px（较初版 ×1.95）；协作行多时可撑至 max-width */
  min-width: 520px;
  width: fit-content;
  max-width: 780px;
  padding: 0.65rem 0.85rem;
  border-radius: 14px;
  background: transparent;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  /* 流程行与协作行间距（在 1.375rem 基础上再 ×1.5 ≈ 2.06rem） */
  gap: 2.0625rem;
  box-sizing: border-box;
  pointer-events: none;
}

.dd-tree-task7-process-block .dd-tree-node-slot {
  pointer-events: auto;
}

.dd-tree-task7-flow-row {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: stretch;
  width: 100%;
}

.dd-tree-task7-op-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: stretch;
  width: 100%;
  gap: 0;
}

.dd-tree-task7-seq-arrow {
  flex: 0 0 1.35rem;
  color: #16a34a;
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1;
  user-select: none;
  text-align: center;
  align-self: center;
}

/** 任务 6.5：三维 Gap 分框（每框 5 列换行，仅展示 feature id） */
.dd-tree-task65-track {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 1rem;
  width: 100%;
  padding: 0.35rem 0.5rem 0.5rem;
  box-sizing: border-box;
}

.dd-tree-task65-gap-box {
  flex: 1 1 0;
  min-width: 0;
  padding: 0.55rem 0.65rem 0.75rem;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  box-sizing: border-box;
}

.dd-tree-task65-gap-box-title {
  margin: 0 0 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #5b21b6;
  letter-spacing: 0.02em;
}

.dd-tree-task65-gap-grid {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.dd-tree-task65-gap-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 0.45rem;
}

.dd-tree-task65-gap-pad {
  flex: 0 0 76px;
  width: 76px;
  min-width: 76px;
  visibility: hidden;
  pointer-events: none;
}

.dd-tree-task65-gap-empty {
  margin: 0;
  font-size: 0.68rem;
  color: #94a3b8;
}

.dd-tree-node-slot--task65 {
  flex-shrink: 0;
}

.dd-tree-card--task65-gap-fid {
  min-height: 2.4rem;
  padding: 0.35rem 0.25rem;
  justify-content: center;
  align-items: center;
}

.dd-tree-card-fid--task65-only {
  margin: 0;
  text-align: center;
  font-size: 0.78rem;
  font-weight: 700;
  color: #1d4ed8;
  line-height: 1.25;
}

/** 任务 5.1：价值主张（上）+ 业务能力单元（下）两层子轨 */
.dd-tree-task51-track {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  gap: 1.35rem;
  padding: 0.35rem 0.5rem 0.5rem;
  min-height: 8.5rem;
  box-sizing: border-box;
}

.dd-tree-task51-subrow {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
}

.dd-tree-task51-subtitle {
  margin: 0;
  padding: 0 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #0f766e;
}

.dd-tree-task51-subtrack {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  justify-content: space-evenly;
  gap: 0.5rem;
  padding: 0 0.35rem;
  min-height: 3.75rem;
  width: 100%;
  box-sizing: border-box;
}

.dd-tree-card--task51-vp {
  border-color: #99f6e4;
  background: linear-gradient(180deg, #f0fdfa 0%, #ffffff 72%);
}

.dd-tree-card--task51-cap {
  border-color: #bfdbfe;
  background: linear-gradient(180deg, #eff6ff 0%, #ffffff 72%);
}

.dd-tree-card-val--task51-vp {
  font-weight: 600;
  color: #115e59;
}

.dd-tree-layer-track--task52 {
  align-items: stretch;
  gap: 0.65rem;
  padding: 0.35rem 0.75rem;
  min-height: 11rem;
}

.dd-tree-card--task52-fieldset {
  border-color: #c4b5fd;
  background: linear-gradient(180deg, #faf5ff 0%, #ffffff 72%);
  height: 100%;
}

.dd-tree-card-val-wrap--task52 {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
}

.dd-tree-card-val--task52-title {
  margin: 0;
  font-weight: 700;
  color: #5b21b6;
  line-height: 1.4;
  display: block;
  overflow: visible;
  max-height: none;
  -webkit-line-clamp: unset;
  -webkit-box-orient: unset;
  white-space: normal;
  word-break: break-word;
  min-height: 0;
}

.dd-tree-card-val--task52-empty {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  min-height: 2.75em;
}

.dd-tree-field-tag-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
}

.dd-tree-field-tag-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  align-items: stretch;
}

.dd-tree-field-tag {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 4px;
  padding: 3px 5px;
  border-radius: 8px;
  border: 1px solid #ddd6fe;
  background: #ede9fe;
  font-size: 10px;
  line-height: 1.35;
  color: #5b21b6;
  text-align: left;
  overflow: visible;
  min-height: 1.85rem;
  height: auto;
  box-sizing: border-box;
}

.dd-tree-field-tag-excel {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  object-fit: contain;
  border-radius: 2px;
}

.dd-tree-field-tag-label {
  flex: 1 1 auto;
  min-width: 0;
  white-space: normal;
  word-break: break-word;
}

.dd-tree-field-tag--pad {
  visibility: hidden;
  border-color: transparent;
  background: transparent;
  min-height: 1.85rem;
}

.dd-tree-node-slot--task7-flow {
  /* 占流程块宽度 35%×1.5 ≈ 52.5% */
  flex: 0 0 52.5%;
  width: 52.5%;
  min-width: 0;
  max-width: none;
  justify-content: center;
}

.dd-tree-node-slot--task7-flow .dd-tree-card {
  width: 100%;
}

.dd-tree-node-slot--task7-op {
  flex: 1 1 0;
  min-width: 3.5rem;
  max-width: none;
  display: flex;
  justify-content: center;
  align-items: stretch;
}

.dd-tree-node-slot--task7-op .dd-tree-card {
  width: 100%;
  max-width: 8.5rem;
}

.dd-tree-card--task7-flow {
  border-color: #94a3b8;
  background: #fff;
}

.dd-tree-card--task7-op {
  border-color: #cbd5e1;
  background: #f8fafc;
  min-height: 3.25rem;
}

/** 任务 8：按任务 7 协作节点分子块；透明底 + 淡灰边框，块内节点水平均匀分布 */
.dd-tree-task8-track {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  justify-content: center;
  width: 100%;
  gap: var(--dd-task8-block-gap, 1.5rem);
  padding: 0.35rem 1rem;
  min-height: 6.5rem;
  box-sizing: border-box;
}

.dd-tree-task8-collab-block {
  flex: 0 0 auto;
  min-width: 260px;
  width: fit-content;
  max-width: 640px;
  padding: 0.5rem 0.65rem 0.65rem;
  border-radius: 14px;
  background: transparent;
  border: 1px solid #e2e8f0;
  box-sizing: border-box;
  pointer-events: none;
}

.dd-tree-task8-collab-block .dd-tree-node-slot {
  pointer-events: auto;
}

.dd-tree-task8-anchor-caption {
  margin: 0 0 0.4rem;
  padding: 0 0.15rem 0.35rem;
  font-size: 0.68rem;
  line-height: 1.35;
  color: #94a3b8;
  text-align: center;
  border-bottom: 1px dashed #e8ecf0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.dd-tree-task8-anchor-caption--orphan {
  color: #b45309;
  border-bottom-color: #fde68a;
}

.dd-tree-task8-prototype-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  justify-content: space-evenly;
  width: 100%;
  gap: 0.35rem;
  min-height: 4.25rem;
}

.dd-tree-node-slot--task8-proto {
  flex: 1 1 0;
  min-width: 3.87rem;
  max-width: 5.95rem;
  display: flex;
  justify-content: center;
  align-items: stretch;
}

.dd-tree-node-slot--task8-proto .dd-tree-card {
  width: 100%;
}

/** 任务 10：按 Tech_Host_Platform 分子块；透明底 + 淡灰边框；每节点标注任务 9 正向归纳上游 */
.dd-tree-task10-track {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  justify-content: center;
  width: 100%;
  gap: var(--dd-task10-block-gap, 1.5rem);
  padding: 0.35rem 1rem;
  min-height: 7rem;
  box-sizing: border-box;
}

.dd-tree-task10-cascade-tier {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.35rem;
  width: 100%;
  padding: 0.35rem 0 0.5rem;
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
}

.dd-tree-task10-cascade-tier:first-of-type {
  border-top: none;
  padding-top: 0;
}

.dd-tree-task10-tier-caption {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.35;
  color: rgba(0, 0, 0, 0.55);
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  align-items: baseline;
}

.dd-tree-task10-tier-label {
  font-weight: 700;
  color: #0d6e3f;
}

.dd-tree-task10-tier-remark {
  color: rgba(0, 0, 0, 0.45);
}

.dd-tree-task10-tier-empty {
  margin: 0;
  font-size: 0.7rem;
  color: rgba(0, 0, 0, 0.35);
  font-style: italic;
  padding: 0.15rem 0 0.35rem;
  text-align: center;
}

.dd-tree-task10-tier-stack {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.dd-tree-task10-tier-subcaption {
  margin: 0.15rem 0 0;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--dd-muted, #64748b);
  text-align: center;
}

.dd-tree-task10-node-row--field {
  margin-top: 0.1rem;
  padding-top: 0.35rem;
  border-top: 1px dashed rgba(148, 163, 184, 0.45);
}

.dd-tree-node-slot--task10-field .dd-tree-card--task10-field {
  border-color: rgba(59, 130, 246, 0.35);
  background: rgba(239, 246, 255, 0.72);
}

.dd-tree-task10-host-block {
  flex: 0 0 auto;
  min-width: 280px;
  width: fit-content;
  max-width: 720px;
  padding: 0.5rem 0.65rem 0.65rem;
  border-radius: 14px;
  background: transparent;
  border: 1px solid #e2e8f0;
  box-sizing: border-box;
  pointer-events: none;
}

.dd-tree-task10-host-block .dd-tree-node-slot {
  pointer-events: auto;
}

.dd-tree-task10-integration-block {
  border-color: #c7d2fe;
  background: rgba(238, 242, 255, 0.28);
}

.dd-tree-task10-host-caption {
  margin: 0 0 0.45rem;
  padding: 0 0.15rem 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.35;
  color: #64748b;
  text-align: center;
  border-bottom: 1px dashed #e8ecf0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.dd-tree-task10-upstream-caption {
  margin: 0 0 0.3rem;
  padding: 0 0.1rem;
  font-size: 0.62rem;
  line-height: 1.3;
  color: #94a3b8;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.dd-tree-task10-upstream-caption--orphan {
  color: #b45309;
}

.dd-tree-task10-node-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  justify-content: flex-start;
  width: 100%;
  gap: 0.35rem;
  min-height: 4.5rem;
  overflow-x: auto;
  overflow-y: visible;
  padding-bottom: 0.15rem;
}

.dd-tree-node-slot--task10 {
  flex: 0 0 auto;
  min-width: 4.25rem;
  max-width: 6.5rem;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-end;
}

.dd-tree-node-slot--task10 .dd-tree-card {
  width: 100%;
}

/** 任务 9：对齐任务 7 二级模式 — 一级模块独立子块，块内首行一级模块卡、次行二级菜单平铺 */
.dd-tree-task9-track {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  justify-content: center;
  width: 100%;
  gap: var(--dd-task9-block-gap, 2rem);
  padding: 0.35rem 1.25rem;
  min-height: 10.5rem;
  box-sizing: border-box;
}

.dd-tree-task9-module-block {
  flex: 0 0 auto;
  min-width: 520px;
  width: fit-content;
  max-width: 780px;
  padding: 0.65rem 0.85rem;
  border-radius: 14px;
  background: transparent;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 2.0625rem;
  box-sizing: border-box;
  pointer-events: none;
}

.dd-tree-task9-module-block .dd-tree-node-slot {
  pointer-events: auto;
}

.dd-tree-task9-module-row {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: stretch;
  width: 100%;
}

.dd-tree-task9-module-orphan-hint {
  margin: 0 0 0.35rem;
  padding: 0 0.15rem 0.35rem;
  font-size: 0.68rem;
  line-height: 1.35;
  color: #b45309;
  text-align: center;
  border-bottom: 1px dashed #fde68a;
}

.dd-tree-task9-menu-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  justify-content: space-evenly;
  width: 100%;
  gap: 0.35rem;
  min-height: 4.25rem;
}

.dd-tree-node-slot--task9-module {
  flex: 0 0 52.5%;
  width: 52.5%;
  min-width: 0;
  max-width: none;
  justify-content: center;
}

.dd-tree-node-slot--task9-module .dd-tree-card {
  width: 100%;
}

.dd-tree-node-slot--task9-menu {
  flex: 1 1 0;
  min-width: 3.5rem;
  max-width: none;
  display: flex;
  justify-content: center;
  align-items: stretch;
}

.dd-tree-node-slot--task9-menu .dd-tree-card {
  width: 100%;
  max-width: 8.5rem;
}

.dd-tree-card--task9-module {
  border-color: #94a3b8;
  background: #fff;
}

.dd-tree-card--task9-menu {
  border-color: #cbd5e1;
  background: #f8fafc;
  min-height: 3.25rem;
}

.dd-tree-node-slot {
  position: relative;
  z-index: 2;
  flex: 1 1 0;
  /* 在 ×0.7（6.5→4.55 / 10→7 rem）基础上再 ×0.85，再缩窄 15% */
  min-width: 3.87rem;
  max-width: 5.95rem;
  display: flex;
  justify-content: center;
  align-items: stretch;
}

/** 任务 5.2：固定卡宽 + 层内等高；须在通用 `.dd-tree-node-slot` 之后以免 `max-width: 5.95rem` 压窄 */
.dd-tree-node-slot.dd-tree-node-slot--task52 {
  flex: 0 0 var(--dd-task52-card-width, 260px);
  width: var(--dd-task52-card-width, 260px);
  min-width: var(--dd-task52-card-width, 260px);
  max-width: var(--dd-task52-card-width, 260px);
}

.dd-tree-node-slot.dd-tree-node-slot--task52 .dd-tree-card {
  width: 100%;
}

.dd-tree-card--task52-fieldset .dd-tree-card-op {
  white-space: normal;
  word-break: break-word;
}

/** 任务 5.3：流程圆角框 + 横向环节子节点 */
.dd-tree-layer-track--task53 {
  align-items: stretch;
  gap: 0.65rem;
  padding: 0.35rem 0.75rem;
  min-height: 9rem;
}

.dd-tree-node-slot.dd-tree-node-slot--task53 {
  display: flex;
  justify-content: center;
  align-items: stretch;
}

.dd-tree-node-slot.dd-tree-node-slot--task53 .dd-tree-card {
  width: 100%;
}

.dd-tree-card--task53-workflow {
  border-color: #7dd3fc;
  background: linear-gradient(180deg, #f0f9ff 0%, #ffffff 72%);
  height: 100%;
}

.dd-tree-card--task53-step {
  border-color: #0ea5e9;
  background: linear-gradient(180deg, #e0f2fe 0%, #ffffff 78%);
  height: 100%;
}

.dd-tree-workflow-step-shell {
  border: 1px solid #7dd3fc;
  border-radius: 8px;
  background: #ffffff;
  padding: 0.4rem 0.45rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 100%;
  box-sizing: border-box;
}

.dd-tree-workflow-step-shell-title {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.35;
  color: #0c4a6e;
  white-space: nowrap;
}

.dd-tree-workflow-step-shell-meta {
  margin: 0;
  font-size: 0.62rem;
  line-height: 1.3;
  color: #475569;
  white-space: nowrap;
}

.dd-tree-card-val-wrap--task53 {
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
}

.dd-tree-workflow-shell {
  border: 1px solid #bae6fd;
  border-radius: 10px;
  background: #ffffff;
  padding: 0.45rem 0.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  width: 100%;
  box-sizing: border-box;
}

.dd-tree-workflow-shell-title {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.35;
  color: #0369a1;
  word-break: break-word;
}

.dd-tree-workflow-steps {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0;
  width: max-content;
  overflow: visible;
}

.dd-tree-workflow-step-arrow {
  flex: 0 0 1.25rem;
  color: #2563eb;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1;
  text-align: center;
  user-select: none;
}

.dd-tree-workflow-step-chip {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  min-width: 4.5rem;
  padding: 0.28rem 0.4rem;
  border-radius: 8px;
  border: 1px solid #93c5fd;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
  font-size: 0.62rem;
  font-weight: 600;
  line-height: 1.3;
  color: #1e3a8a;
  text-align: center;
  white-space: nowrap;
  box-sizing: border-box;
}

/** focus 下环节 chip 锚点略高于流程壳，便于与 overlay 边对齐 */
.dd-tree-canvas--focus-mode .dd-tree-workflow-step-chip {
  z-index: 3;
}

.dd-tree-workflow-steps-hint {
  margin: 0;
  font-size: 0.62rem;
  line-height: 1.35;
  color: #64748b;
}

.dd-tree-workflow-steps-empty {
  margin: 0;
  font-size: 0.65rem;
  color: #64748b;
}

.dd-tree-card {
  width: 100%;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  padding: 0.4rem 0.45rem;
  box-sizing: border-box;
  font-size: 0.7rem;
  line-height: 1.35;
}

.dd-tree-card--stretch {
  position: relative;
  height: 100%;
  min-height: 3.75rem;
  display: flex;
  flex-direction: column;
  align-self: stretch;
  cursor: pointer;
}

/** 任务 1 · Validation_Status = Resolved_By_Customer：卡右上角绿底白字 */
.dd-tree-resolved-badge {
  position: absolute;
  top: 0.22rem;
  right: 0.22rem;
  z-index: 2;
  padding: 0.07rem 0.38rem;
  border-radius: 4px;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1.2;
  color: #fff;
  background: #16a34a;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
  pointer-events: none;
}

.dd-tree-card--stretch:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.dd-tree-card-val-wrap {
  flex: 1 1 auto;
  min-height: 0;
  margin-top: 0.1rem;
  display: flex;
  align-items: flex-start;
}

.dd-tree-card-val {
  margin: 0;
  color: #1e293b;
  font-weight: 600;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  overflow: hidden;
  word-break: break-word;
  line-height: 1.35;
  max-height: calc(1.35em * 5);
}

.dd-tree-card-fid {
  margin: 0 0 0.15rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: #2563eb;
  line-height: 1.2;
}

.dd-tree-card--task0 {
  border-color: #2dd4bf;
  background: linear-gradient(180deg, #ccfbf1 0%, #f8fafc 100%);
}

/** 任务 0 · 企业微信：海蓝主题 */
.dd-tree-card--task0-wecom {
  border-color: #0891b2;
  background: linear-gradient(180deg, #cffafe 0%, #f0f9ff 100%);
}

.dd-tree-card--task0-wecom .dd-tree-card-fid {
  color: #0e7490;
}

.dd-tree-card--task0-wecom .dd-tree-card-tok-badge {
  background: #0284c7;
}

/** 任务 0 · 七巧低代码：紫色主题 */
.dd-tree-card--task0-qiqiao {
  border-color: #c084fc;
  background: linear-gradient(180deg, #f3e8ff 0%, #faf5ff 100%);
}

.dd-tree-card--task0-qiqiao .dd-tree-card-fid {
  color: #7e22ce;
}

.dd-tree-card--task0-qiqiao .dd-tree-card-tok-badge {
  background: #9333ea;
}

.dd-tree-card--src {
  border-color: #60a5fa;
  background: linear-gradient(180deg, #dbeafe 0%, #f8fafc 100%);
}

/** 任务 1 痛点雷达：默认紫色主题 */
.dd-tree-card--pain-radar {
  border-color: #c084fc;
  background: linear-gradient(180deg, #f3e8ff 0%, #faf5ff 100%);
}

.dd-tree-card--pain-radar .dd-tree-card-tok-badge {
  background: #9333ea;
}

/** 任务 1 现有表格：默认黄色主题 */
.dd-tree-card--existing-spreadsheet {
  border-color: #facc15;
  background: linear-gradient(180deg, #fef9c3 0%, #fffbeb 100%);
}

.dd-tree-card--existing-spreadsheet .dd-tree-card-fid {
  color: #a16207;
}

.dd-tree-card--existing-spreadsheet .dd-tree-card-tok-badge {
  background: #ca8a04;
}

/** 任务 1 现有表格：有绿色反向验证边连入时黄绿强调 */
.dd-tree-card--existing-spreadsheet-rv {
  border-color: #4ade80;
  background: linear-gradient(180deg, #ecfccb 0%, #fef9c3 100%);
}

.dd-tree-card--existing-spreadsheet-rv .dd-tree-card-fid {
  color: #15803d;
}

.dd-tree-card--existing-spreadsheet-rv .dd-tree-card-tok-badge {
  background: #16a34a;
}

/** 任务 1 痛点雷达：有绿色反向验证边连入时整卡绿色主题 */
.dd-tree-card--pain-radar-rv {
  border-color: #4ade80;
  background: linear-gradient(180deg, #dcfce7 0%, #f0fdf4 100%);
}

.dd-tree-card--pain-radar-rv .dd-tree-card-tok-badge {
  background: #16a34a;
}

/** 任务 1：被红色（潜在冲突）反向验证边指向的端点 */
.dd-tree-card--task1-rv-warn {
  border-color: #f87171;
  background: linear-gradient(180deg, #fee2e2 0%, #fef2f2 100%);
}

.dd-tree-card--task1-rv-warn .dd-tree-card-tok-badge {
  background: #dc2626;
}

.dd-tree-card--tgt {
  border-color: #a78bfa;
  background: linear-gradient(180deg, #f5f3ff 0%, #fafafa 100%);
}

.dd-tree-card--t2 {
  border-color: #c4b5fd;
  background: linear-gradient(180deg, #faf5ff 0%, #fafafa 100%);
}

.dd-tree-card-tok {
  margin: 0 0 0.2rem;
  line-height: 1.25;
}

.dd-tree-card-tok-badge {
  display: inline-block;
  max-width: 100%;
  box-sizing: border-box;
  padding: 0.12rem 0.32rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.65rem;
  line-height: 1.3;
  color: #fff;
  background: #2563eb;
  word-break: break-word;
  vertical-align: top;
}

/** 任务 4 层：价值流阶段_* 节点标题栏（绿底白字，与同层固定维度蓝底区分） */
.dd-tree-card-tok-badge--task5-vsm-stage {
  background: #16a34a;
}

.dd-tree-pain-badge {
  margin-left: 0.35rem;
  padding: 0.08rem 0.4rem;
  border-radius: 4px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #fff;
  background: #dc2626;
  vertical-align: middle;
}

.dd-tree-pain-badge--rv-ok {
  background: #16a34a;
}

.dd-tree-pain-badge--rv-warn {
  background: #dc2626;
}

.dd-tree-card-op {
  margin: 0 0 0.2rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.66rem;
  color: #334155;
}

.dd-tree-value-popover {
  position: fixed;
  z-index: 4020;
  box-sizing: border-box;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #fff;
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.2);
  overflow: auto;
  pointer-events: auto;
}

.dd-tree-value-popover-text {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
  color: #0f172a;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 720px) {
  .dd-tree-node-slot {
    /* 在 ×0.7 基础上再 ×0.85 */
    min-width: 3.42rem;
    max-width: 4.31rem;
  }
}
</style>
