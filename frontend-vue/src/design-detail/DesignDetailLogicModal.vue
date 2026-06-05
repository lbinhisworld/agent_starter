<!--
  [INPUT]: `visible`、`caseId`；运行时 `SmartCto.problemCaseApi.getDesignDetailTaskGraph`
  [OUTPUT]: 全屏遮罩「逻辑详情」：按设计任务折叠卡片，头栏展示 token / feature / 逻辑链数量；展开后 Token / Feature / 逻辑 子 Tab；**Token** 列为 `DesignDetailTaskToken` 路径（**展示**去掉「 · 」后英文键，`title` 仍给全文）；**Feature** 列为**复合圆角卡片网格**（`grid-auto-rows: auto`：**每行**高度随该行内容，**行内** stretch 等高；子卡按内容撑开；每卡内**两行**子卡 + **value 下**非子卡「**备注：**`valueRefDomain`」红色斜体，**N/A** 不展示；字段同 `tokenDisplay`/`operator`/`name`/`valueRefDomain`）；**逻辑** 列为推导说明预览；**任务 2**（`scale_org_mode_extract`）且 **`links.length > 0`** 时，**逻辑** Tab 恒为 **`linkId` 可折叠行** + **2×3 网格**（标题行 Source / （Logic·仅读屏） / Target；内容行左中右）：**Source/Target** 为三块圆角子卡（**不**再展示 Token/Operator/Value 字面标签，改 `aria-label`）；**中间列**为 **权重（蓝底标签）+ 蓝色水平箭头（→）+ 下方浅蓝圆角逻辑卡**（`logicBodyForLinkRow`）；竖直方向 **`flex:1` 顶空 + `flex:2` 下区** 使箭头带落在内容区约上 **1/3**；窄屏改为纵向堆叠且隐藏顶空 flex；缺 `source`/`target` 时占位提示；其余任务逻辑 Tab 仍为 pill；展示层合并 `customer_requirement` 入 `customer_basic`（**落库** `taskId` 已为「任务 1：客户基本情况了解」时 `normLogicTaskId` 归并）；**任务 1** 头栏「逻辑链」计数与 **逻辑** Tab 仍不显推导链（`linkCount` 为 0、Tab 空态），但 **`links[]`** 仍携带 **`linkKind`＝「反向验证」**（兼容旧英文 `REVERSE_VALIDATION`）供 **Tree**（见 `designDetailLogicGraphMerge.mergeCustomerRequirementIntoBasicForLogicGraph`）；**任务 1**（`customer_basic` **或** 独立 `customer_requirement` 卡）下 pill 优先按后端 **`pillBatchKey`**（工商 `cb-0`；需求提炼按轮次 `cr-0`…`cr-7`，与业务分域无关；无字段时回退 `themeKey` 分域色）；任务体设最小高度保证三 Tab 与空态可见
  [POS]: `DesignDetailPage.vue` 子组件

  [PROTOCOL]: 变更任务线步数或与后端 `GET …/design-detail/task-graph` 契约不一致时，同步 `design-detail-task-graph-catalog.ts`（后端）与本组件及 `design_mode_ux.md`；**任务 2** `links[].source|target` 字段（含 **`tokenDisplay`/`operator`**；`operator` 由后端归一为中文八值）变更时同步 `backend/.../types.ts`、`design-detail-feature-operator.ts` 与 `prisma-problem-case.repository.ts`；弹层列表 `.dd-logic-stack` 限高滚动时任务卡须 `flex-shrink: 0`；**任务 1 合并展示**与 **同线步任务卡去重**见 **`designDetailLogicGraphMerge.ts`**（与 **Tree** 视图共用 **`dedupeLogicGraphTasksByNormTaskId`**）；Tab 内容 `v-if` 单面板 + 任务卡 `overflow: visible`、折叠态头栏全圆角，避免多行 pill 被裁切
-->
<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import {
  dedupeLogicGraphTasksByNormTaskId,
  mergeCustomerRequirementIntoBasicForLogicGraph,
  normalizeLogicGraphTasksAfterFetch,
  normLogicTaskId,
} from './designDetailLogicGraphMerge';
import { isTask1FeaturePainPointConfirmed } from './designDetailPainPointConfirmed';

type LogicModalTaskTab = 'tokens' | 'features' | 'links';

type DesignDetailLogicTaskDto = {
  taskId: string;
  title: string;
  tokenCount: number;
  featureCount: number;
  linkCount: number;
  tokens: { tokenId: string; name: string; themeKey?: string; theme_key?: string; pillBatchKey?: string; pill_batch_key?: string }[];
  /** `name`：特征取值 `value` 的展示摘要（Feature Tab · Value 子卡）；`tokenDisplay`/`operator` 与 `GET …/task-graph` 的 `features[]` DTO 对齐 */
  features: {
    featureId: string;
    name: string;
    themeKey?: string;
    theme_key?: string;
    pillBatchKey?: string;
    pill_batch_key?: string;
    tokenDisplay?: string;
    token_display?: string;
    operator?: string;
    /** 任务 2 L1：值域说明；为 N/A 时不下发 */
    valueRefDomain?: string;
    value_ref_domain?: string;
    painPointConfirmed?: boolean;
    pain_point_confirmed?: boolean;
  }[];
  links: {
    linkId: string;
    name: string;
    /** `DesignLogicLink.linkKind`：仅「正向归纳」「反向验证」；旧后端英文枚举名仍兼容 */
    linkKind?: '正向归纳' | '反向验证';
    themeKey?: string;
    theme_key?: string;
    pillBatchKey?: string;
    pill_batch_key?: string;
    sourceFeatureId?: string;
    targetFeatureId?: string;
    logic?: string;
    weight?: number | null;
    source?: {
      featureId: string;
      name: string;
      themeKey?: string;
      theme_key?: string;
      pillBatchKey?: string;
      pill_batch_key?: string;
      tokenDisplay?: string;
      token_display?: string;
      operator?: string;
    };
    target?: {
      featureId: string;
      name: string;
      themeKey?: string;
      theme_key?: string;
      pillBatchKey?: string;
      pill_batch_key?: string;
      tokenDisplay?: string;
      token_display?: string;
      operator?: string;
    };
  }[];
};

/** 与后端 `GET …/task-graph` 任务卡片 `taskId`（线步 `DESIGN_DETAIL_TASK2_LINE_TASK_ID`，`design-detail-task-graph-catalog.ts`）一致 */
const DESIGN_DETAIL_TASK2_L1_LOGIC_TREE_TASK_ID = 'scale_org_mode_extract';

/**
 * 任务 1：**`pillBatchKey`**（后端：`cb-0` 工商；`cr-*` 为需求提炼轮次，`requirementSyncGeneration` 未写的旧数据回退 `createdAt` 启发式）→ pill 色相；同一 `pillBatchKey` 内各分域同色。
 * 无 `pillBatchKey` 的旧接口回退：`themeKey` → `TASK1_PILL_THEME_CLASS`。
 */
const TASK1_PILL_BATCH_CLASS: Readonly<Record<string, string>> = {
  'cb-0': 'dd-logic-pill--bat-cb0',
  /** 任务 2 L1 推理图 token 批次（与后端 `pillBatchByTokenId` 对齐） */
  't2l1-0': 'dd-logic-pill--bat-t2l10',
  'cr-0': 'dd-logic-pill--bat-cr0',
  'cr-1': 'dd-logic-pill--bat-cr1',
  'cr-2': 'dd-logic-pill--bat-cr2',
  'cr-3': 'dd-logic-pill--bat-cr3',
  'cr-4': 'dd-logic-pill--bat-cr4',
  'cr-5': 'dd-logic-pill--bat-cr5',
  'cr-6': 'dd-logic-pill--bat-cr6',
  'cr-7': 'dd-logic-pill--bat-cr7',
  'nx-0': 'dd-logic-pill--bat-nx0',
};

function pillBatchClassForTask1(batchKey: string | undefined): string {
  const k = String(batchKey ?? '').trim();
  if (!k) return '';
  return TASK1_PILL_BATCH_CLASS[k] ?? 'dd-logic-pill--bat-nx0';
}

function readPillBatchKey(row: { pillBatchKey?: string; pill_batch_key?: string }): string {
  const a = row.pillBatchKey;
  const b = row.pill_batch_key;
  return String((a != null ? a : b) ?? '').trim();
}

const TASK1_PILL_THEME_CLASS: Readonly<Record<string, string>> = {
  customer_basic: 'dd-logic-pill--tk-customer_basic',
  businessContext: 'dd-logic-pill--tk-businessContext',
  coreBusinessEntities: 'dd-logic-pill--tk-coreBusinessEntities',
  stateTransitionMatrix: 'dd-logic-pill--tk-stateTransitionMatrix',
  painPointRadar: 'dd-logic-pill--tk-painPointRadar',
  itLandscape: 'dd-logic-pill--tk-itLandscape',
  operationModel: 'dd-logic-pill--tk-operationModel',
  managementResources: 'dd-logic-pill--tk-managementResources',
  requirement_misc: 'dd-logic-pill--tk-requirement_misc',
};

function pillThemeClassForTask1(themeKey: string | undefined): string {
  const k = String(themeKey ?? '').trim();
  if (!k) return 'dd-logic-pill--tk-requirement_misc';
  return TASK1_PILL_THEME_CLASS[k] ?? 'dd-logic-pill--tk-requirement_misc';
}

/** 与后端 `taskGraphThemeKeyFromCustomerRequirementTokenSurface` 对齐：展示路径首段 → 分域 themeKey */
function deriveThemeKeyFromTokenDisplayName(name: string): string {
  const s = String(name || '').trim();
  if (!s) return '';
  if (s.startsWith('业务背景/')) return 'businessContext';
  if (s.startsWith('核心业务对象/')) return 'coreBusinessEntities';
  if (s.startsWith('状态转移矩阵/')) return 'stateTransitionMatrix';
  if (s.startsWith('痛点雷达/')) return 'painPointRadar';
  if (s.startsWith('IT 集成与现状/') || s.startsWith('IT 现状与集成/')) return 'itLandscape';
  if (s.startsWith('运营模式/')) return 'operationModel';
  if (s.startsWith('管理资源/')) return 'managementResources';
  return '';
}

/** 与后端 `taskGraphThemeKeyForFeatureId` 对齐（客户端兜底） */
function deriveThemeKeyFromFeatureId(featureId: string): string {
  const fid = String(featureId || '');
  if (/^dd:[^:]+:cb:/.test(fid)) return 'customer_basic';
  const m = /^dd:[^:]+:cr:([^:]+):/.exec(fid);
  if (m?.[1]) return m[1];
  return '';
}

function readRowThemeKey(row: { themeKey?: string; theme_key?: string }): string {
  const a = row.themeKey;
  const b = row.theme_key;
  const k = String((a != null ? a : b) ?? '').trim();
  return k;
}

function logicModalUsesTask1PillTheming(taskId: string): boolean {
  const id = normLogicTaskId(taskId);
  return id === 'customer_basic' || id === 'customer_requirement';
}

function resolveTokenRowThemeKey(row: DesignDetailLogicTaskDto['tokens'][number]): string | undefined {
  const k = readRowThemeKey(row);
  if (k) return k;
  const fromName = deriveThemeKeyFromTokenDisplayName(row.name);
  return fromName || undefined;
}

function resolveFeatureRowThemeKey(row: DesignDetailLogicTaskDto['features'][number]): string | undefined {
  const k = readRowThemeKey(row);
  if (k) return k;
  const fromId = deriveThemeKeyFromFeatureId(row.featureId);
  return fromId || undefined;
}

function resolveLinkRowThemeKey(row: DesignDetailLogicTaskDto['links'][number]): string | undefined {
  const k = readRowThemeKey(row);
  if (k) return k;
  return undefined;
}

function resolveTask1TokenPillClass(taskId: string, row: DesignDetailLogicTaskDto['tokens'][number]): string {
  if (!logicModalUsesTask1PillTheming(taskId)) return '';
  const pk = readPillBatchKey(row);
  if (pk) return pillBatchClassForTask1(pk);
  return pillThemeClassForTask1(resolveTokenRowThemeKey(row));
}

function resolveTask1FeaturePillClass(taskId: string, row: DesignDetailLogicTaskDto['features'][number]): string {
  if (!logicModalUsesTask1PillTheming(taskId)) return '';
  const pk = readPillBatchKey(row);
  if (pk) return pillBatchClassForTask1(pk);
  return pillThemeClassForTask1(resolveFeatureRowThemeKey(row));
}

/** Feature Tab 外层复合卡片：任务 1 批次色；任务 2 默认 `t2l1-0`；其余任务回退 theme / pillBatch */
function resolveFeatureCardShellClass(taskId: string, row: DesignDetailLogicTaskDto['features'][number]): string {
  const id = normLogicTaskId(taskId);
  if (id === 'customer_basic' || id === 'customer_requirement') {
    return resolveTask1FeaturePillClass(taskId, row);
  }
  if (id === DESIGN_DETAIL_TASK2_L1_LOGIC_TREE_TASK_ID) {
    const pk = readPillBatchKey(row);
    if (pk) return pillBatchClassForTask1(pk);
    return pillBatchClassForTask1('t2l1-0');
  }
  const pk = readPillBatchKey(row);
  if (pk) return pillBatchClassForTask1(pk);
  return pillThemeClassForTask1(resolveFeatureRowThemeKey(row));
}

function readFeatureTokenDisplay(row: DesignDetailLogicTaskDto['features'][number]): string {
  return readLinkEndpointTokenDisplay(row);
}

function readFeatureOperator(row: DesignDetailLogicTaskDto['features'][number]): string {
  return readLinkEndpointOperator(row);
}

function readFeatureValue(row: DesignDetailLogicTaskDto['features'][number]): string {
  const s = String(row.name ?? '').trim();
  return s || '—';
}

function readFeatureValueRefDomainRaw(row: DesignDetailLogicTaskDto['features'][number]): string {
  const a = row.valueRefDomain;
  const b = row.value_ref_domain;
  return String((a != null ? a : b) ?? '').trim();
}

/** 与后端 `shouldPersistValueRefDomain` 口径一致：N/A 不展示「备注」 */
function shouldShowFeatureValueRefRemark(row: DesignDetailLogicTaskDto['features'][number]): boolean {
  const t = readFeatureValueRefDomainRaw(row);
  if (!t) return false;
  const squish = t.toUpperCase().replace(/\s+/g, '').replace(/／/g, '/');
  if (squish === 'N/A' || squish === 'NA' || squish === 'NONE') return false;
  if (/^n\/?a$/i.test(t)) return false;
  return true;
}

function resolveTask1LinkPillClass(taskId: string, row: DesignDetailLogicTaskDto['links'][number]): string {
  if (!logicModalUsesTask1PillTheming(taskId)) return '';
  const pk = readPillBatchKey(row);
  if (pk) return pillBatchClassForTask1(pk);
  return pillThemeClassForTask1(resolveLinkRowThemeKey(row));
}

function isTask2LogicTreeTask(taskId: string): boolean {
  return normLogicTaskId(taskId) === DESIGN_DETAIL_TASK2_L1_LOGIC_TREE_TASK_ID;
}

/** 任务 2 子卡内特征 pill：优先 `pillBatchKey`（含 `t2l1-0`），否则 `themeKey` / `featureId`（与 Feature 行同字段口径） */
function resolveTask2LinkEndpointPillClass(row: DesignDetailLogicTaskDto['features'][number]): string {
  const pk = readPillBatchKey(row);
  if (pk) return pillBatchClassForTask1(pk);
  return pillThemeClassForTask1(resolveFeatureRowThemeKey(row));
}

/**
 * Token 标签展示：去掉「展示名 · 英文键」中的英文段（与后端 `parts.join(' · ')` 口径一致），无 `·` 时原样返回。
 */
function formatTokenLabelChineseOnly(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return s;
  const parts = s.split(/\s*·\s*/);
  const left = parts[0]?.trim() ?? '';
  return left || s;
}

/** 逻辑边端点：原始 `tokenDisplay`（悬停 title 等保留全文） */
function readLinkEndpointTokenDisplayRaw(row: {
  tokenDisplay?: string;
  token_display?: string;
}): string {
  const a = row.tokenDisplay;
  const b = row.token_display;
  const s = String((a != null ? a : b) ?? '').trim();
  return s || '—';
}

/** 逻辑边端点：绑定 Token 路径（与后端字段对齐；**展示**仅中文段） */
function readLinkEndpointTokenDisplay(row: {
  tokenDisplay?: string;
  token_display?: string;
}): string {
  const s = readLinkEndpointTokenDisplayRaw(row);
  if (s === '—') return '—';
  return formatTokenLabelChineseOnly(s);
}

function readTaskTokenLabelForUi(row: DesignDetailLogicTaskDto['tokens'][number]): string {
  const s = String(row.name ?? '').trim();
  if (!s) return '—';
  return formatTokenLabelChineseOnly(s);
}

function readLinkEndpointOperator(row: { operator?: string }): string {
  const s = String(row.operator ?? '').trim();
  return s || '—';
}

function formatLinkWeightDisplay(w: unknown): string {
  if (w == null) return '—';
  const n = typeof w === 'number' ? w : Number(w);
  if (!Number.isFinite(n)) return '—';
  const c = Math.min(1, Math.max(0, n));
  return String(Math.round(c * 1000) / 1000);
}

function logicBodyForLinkRow(row: DesignDetailLogicTaskDto['links'][number]): string {
  const raw = row.logic;
  if (raw != null && String(raw).trim().length) return String(raw);
  const nm = String(row.name ?? '').trim();
  return nm || '—';
}

/** `DesignLogicLink.linkKind` → 中文短标签（逻辑链折叠行） */
function designLogicLinkKindLabel(row: DesignDetailLogicTaskDto['links'][number]): string {
  const k = String(row.linkKind || '正向归纳').trim();
  if (k === '反向验证' || k === 'REVERSE_VALIDATION') return '反向验证';
  return '正向归纳';
}

/**
 * API 按 `taskId` 分域落库；弹层将 `customer_requirement` 并入任务 1，**不**单独呈现「客户需求提炼推理图」卡片。
 * 任务 1 **逻辑** Tab 仍不显推导链 pill（`linkCount` 为 0）；**`links[]`** 可含 **`linkKind`＝「反向验证」**（任务 2 Token 校验）仅供 **Tree** 使用，见 **`designDetailLogicGraphMerge.mergeCustomerRequirementIntoBasicForLogicGraph`**。
 * 任务 2（`scale_org_mode_extract`）：L1 同步后 **`Evidence_Support_Chain`** 落 **`DesignLogicLink`**，`links.length>0` 时**逻辑** Tab 为可折叠链式 UI。
 * 合并实现见 **`designDetailLogicGraphMerge.ts`**。
 */

const props = defineProps<{
  visible: boolean;
  caseId: string;
}>();

const emit = defineEmits<{ close: [] }>();

const loading = ref(false);
const loadError = ref<string | null>(null);
const tasks = ref<DesignDetailLogicTaskDto[]>([]);

/** 任务 2 逻辑 Tab：`linkId` 行展开态 */
const expandedTask2LinkIds = ref<Set<string>>(new Set());

function isTask2LinkExpanded(linkId: string): boolean {
  return expandedTask2LinkIds.value.has(String(linkId || '').trim());
}

function toggleTask2Link(linkId: string) {
  const id = String(linkId || '').trim();
  if (!id) return;
  const next = new Set(expandedTask2LinkIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedTask2LinkIds.value = next;
}

function resetTask2LinkExpansion(list: DesignDetailLogicTaskDto[]) {
  const t2 = list.find((x) => normLogicTaskId(x.taskId) === DESIGN_DETAIL_TASK2_L1_LOGIC_TREE_TASK_ID);
  if (!t2?.links?.length) {
    expandedTask2LinkIds.value = new Set();
    return;
  }
  const firstId = String(t2.links[0]?.linkId || '').trim();
  expandedTask2LinkIds.value = firstId ? new Set([firstId]) : new Set();
}

/** 缺省折叠，避免 14 张卡片首屏过长 */
const expandedByTaskId = ref<Record<string, boolean>>({});
const tabByTaskId = ref<Record<string, LogicModalTaskTab>>({});

function isTaskExpanded(taskId: string): boolean {
  return expandedByTaskId.value[taskId] === true;
}

function toggleTask(taskId: string) {
  expandedByTaskId.value = {
    ...expandedByTaskId.value,
    [taskId]: !isTaskExpanded(taskId),
  };
}

function activeTab(taskId: string): LogicModalTaskTab {
  return tabByTaskId.value[taskId] ?? 'tokens';
}

function setTab(taskId: string, tab: LogicModalTaskTab) {
  tabByTaskId.value = { ...tabByTaskId.value, [taskId]: tab };
}

function onBackdropClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('dd-logic-backdrop')) emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.visible) emit('close');
}

async function fetchGraph() {
  const cid = String(props.caseId || '').trim();
  if (!cid) {
    tasks.value = [];
    return;
  }
  loading.value = true;
  loadError.value = null;
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
    const res = (await fn(cid)) as {
      ok?: boolean;
      data?: { tasks?: DesignDetailLogicTaskDto[] };
      errorMessage?: string;
    };
    if (!res?.ok) {
      loadError.value = String(res?.errorMessage || '加载失败');
      tasks.value = [];
      return;
    }
    const list = Array.isArray(res.data?.tasks) ? res.data!.tasks! : [];
    tasks.value = normalizeLogicGraphTasksAfterFetch(
      dedupeLogicGraphTasksByNormTaskId(mergeCustomerRequirementIntoBasicForLogicGraph(list)),
    ) as DesignDetailLogicTaskDto[];
    resetTask2LinkExpansion(tasks.value);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
    tasks.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.visible, props.caseId] as const,
  ([v, cid]) => {
    if (v && String(cid || '').trim()) void fetchGraph();
  },
  { immediate: true },
);

watch(
  () => props.visible,
  (v) => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = v ? 'hidden' : '';
  },
);

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  if (typeof document !== 'undefined') document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <div
      v-show="visible"
      class="dd-logic-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dd-logic-title"
      @click="onBackdropClick"
    >
      <div class="dd-logic-panel" @click.stop>
        <header class="dd-logic-head">
          <h2 id="dd-logic-title" class="dd-logic-title">逻辑详情</h2>
          <button type="button" class="dd-logic-close" @click="emit('close')">关闭</button>
        </header>

        <p class="dd-logic-hint">
          展示本案例在后台已沉淀的推理图数据（<code>DesignDetailTaskToken</code> / <code>DesignFeatureNode</code> /
          <code>DesignLogicLink</code>）。经营信息与需求提炼的 token / 特征 / 逻辑链均汇总在<strong>任务 1：客户基本情况了解</strong>卡片内；其余任务步多为占位空态。
        </p>

        <p v-if="loadError" class="dd-logic-error" role="alert">{{ loadError }}</p>
        <p v-else-if="loading" class="dd-logic-loading">加载中…</p>

        <div v-else class="dd-logic-stack" aria-label="按任务折叠的逻辑图">
          <section
            v-for="t in tasks"
            :key="t.taskId"
            class="dd-logic-task-card"
          >
            <header
              class="dd-logic-task-head"
              :class="{ 'dd-logic-task-head--collapsed': !isTaskExpanded(t.taskId) }"
            >
              <button
                type="button"
                class="dd-logic-task-toggle"
                :aria-expanded="isTaskExpanded(t.taskId)"
                :aria-controls="'dd-logic-body-' + t.taskId"
                @click="toggleTask(t.taskId)"
              >
                <span
                  class="dd-logic-chevron"
                  :class="{ 'dd-logic-chevron--open': isTaskExpanded(t.taskId) }"
                  aria-hidden="true"
                />
                <span class="dd-logic-task-title">{{ t.title }}</span>
              </button>
              <div class="dd-logic-task-metrics" aria-label="数量摘要">
                <span class="dd-logic-metric"><em>token</em> {{ t.tokenCount }}</span>
                <span class="dd-logic-metric"><em>feature</em> {{ t.featureCount }}</span>
                <span class="dd-logic-metric"><em>逻辑链</em> {{ t.linkCount }}</span>
              </div>
            </header>

            <div
              v-show="isTaskExpanded(t.taskId)"
              :id="'dd-logic-body-' + t.taskId"
              class="dd-logic-task-body"
            >
              <div class="dd-logic-subtabs" role="tablist" :aria-label="t.title + ' 子分类'">
                <button
                  type="button"
                  role="tab"
                  class="dd-logic-subtab"
                  :class="{ 'dd-logic-subtab--on': activeTab(t.taskId) === 'tokens' }"
                  :aria-selected="activeTab(t.taskId) === 'tokens'"
                  @click="setTab(t.taskId, 'tokens')"
                >
                  Token
                </button>
                <button
                  type="button"
                  role="tab"
                  class="dd-logic-subtab"
                  :class="{ 'dd-logic-subtab--on': activeTab(t.taskId) === 'features' }"
                  :aria-selected="activeTab(t.taskId) === 'features'"
                  @click="setTab(t.taskId, 'features')"
                >
                  Feature
                </button>
                <button
                  type="button"
                  role="tab"
                  class="dd-logic-subtab"
                  :class="{ 'dd-logic-subtab--on': activeTab(t.taskId) === 'links' }"
                  :aria-selected="activeTab(t.taskId) === 'links'"
                  @click="setTab(t.taskId, 'links')"
                >
                  逻辑
                </button>
              </div>

              <div
                class="dd-logic-subpanel"
                role="tabpanel"
                :aria-label="
                  activeTab(t.taskId) === 'tokens'
                    ? 'Token'
                    : activeTab(t.taskId) === 'features'
                      ? 'Feature'
                      : '逻辑'
                "
              >
                <!-- 仅挂载当前 Tab 的面板，高度随标签行数自然撑开，避免 v-show 多面板叠放或父级裁切导致只显示部分 pill -->
                <div v-if="activeTab(t.taskId) === 'tokens'" :key="t.taskId + '-panel-tok'" class="dd-logic-pill-grid">
                  <div
                    v-for="row in t.tokens"
                    :key="t.taskId + '-tok-' + row.tokenId"
                    class="dd-logic-pill"
                    :class="resolveTask1TokenPillClass(t.taskId, row)"
                    :title="row.name"
                  >
                    {{ readTaskTokenLabelForUi(row) }}
                  </div>
                  <p v-if="!t.tokens.length" class="dd-logic-empty">暂无 token</p>
                </div>
                <div
                  v-else-if="activeTab(t.taskId) === 'features'"
                  :key="t.taskId + '-panel-feat'"
                  class="dd-logic-feature-grid"
                >
                  <article
                    v-for="row in t.features"
                    :key="t.taskId + '-feat-' + row.featureId"
                    class="dd-logic-feature-card dd-logic-pill"
                    :class="resolveFeatureCardShellClass(t.taskId, row)"
                    :aria-label="'特征 ' + row.featureId"
                  >
                    <div class="dd-logic-feature-stack">
                      <span
                        v-if="
                          normLogicTaskId(t.taskId) === 'customer_basic' &&
                          isTask1FeaturePainPointConfirmed(row)
                        "
                        class="dd-logic-pain-badge"
                        title="已确认痛点（历史痛点免疫）"
                      >PAIN</span>
                      <div class="dd-logic-feature-row-tok-op">
                        <div class="dd-logic-feature-sub dd-logic-feature-sub--tok">
                          <p
                            class="dd-logic-feature-sub-body"
                            :title="readLinkEndpointTokenDisplayRaw(row)"
                          >
                            {{ readFeatureTokenDisplay(row) }}
                          </p>
                        </div>
                        <div class="dd-logic-feature-sub dd-logic-feature-sub--op">
                          <p
                            class="dd-logic-feature-sub-body dd-logic-feature-sub-body--op"
                            :title="readFeatureOperator(row)"
                          >
                            {{ readFeatureOperator(row) }}
                          </p>
                        </div>
                      </div>
                      <div class="dd-logic-feature-sub dd-logic-feature-sub--value">
                        <p class="dd-logic-feature-sub-body" :title="readFeatureValue(row)">
                          {{ readFeatureValue(row) }}
                        </p>
                      </div>
                      <p
                        v-if="shouldShowFeatureValueRefRemark(row)"
                        class="dd-logic-feature-value-ref"
                        :title="readFeatureValueRefDomainRaw(row)"
                      >
                        备注：{{ readFeatureValueRefDomainRaw(row) }}
                      </p>
                    </div>
                  </article>
                  <p v-if="!t.features.length" class="dd-logic-empty">暂无 feature</p>
                </div>
                <div
                  v-else-if="activeTab(t.taskId) === 'links' && isTask2LogicTreeTask(t.taskId) && t.links.length"
                  :key="t.taskId + '-panel-lnk-t2'"
                  class="dd-logic-link-tree"
                >
                  <div
                    v-for="row in t.links"
                    :key="t.taskId + '-lnk-tree-' + row.linkId"
                    class="dd-logic-link-tree-node"
                  >
                    <button
                      type="button"
                      class="dd-logic-link-tree-toggle"
                      :aria-expanded="isTask2LinkExpanded(row.linkId)"
                      @click="toggleTask2Link(row.linkId)"
                    >
                      <span
                        class="dd-logic-chevron dd-logic-chevron--tree"
                        :class="{ 'dd-logic-chevron--open': isTask2LinkExpanded(row.linkId) }"
                        aria-hidden="true"
                      />
                      <code class="dd-logic-link-id">{{ row.linkId }}</code>
                      <span
                        class="dd-logic-link-kind-pill"
                        :class="{ 'dd-logic-link-kind-pill--reverse': row.linkKind === '反向验证' || row.linkKind === 'REVERSE_VALIDATION' }"
                        :title="'逻辑边类型：' + designLogicLinkKindLabel(row)"
                        >{{ designLogicLinkKindLabel(row) }}</span>
                    </button>
                    <div v-show="isTask2LinkExpanded(row.linkId)" class="dd-logic-link-triple-wrap">
                      <h4 class="dd-logic-link-subcard-label dd-logic-link-grid-h dd-logic-link-grid-h--src">
                        SourceFeature
                      </h4>
                      <h4
                        class="dd-logic-link-subcard-label dd-logic-link-grid-h dd-logic-link-grid-h--bridge"
                        :id="'dd-logic-bridge-h-' + row.linkId"
                      >
                        <span class="dd-logic-sr-only">Logic</span>
                      </h4>
                      <h4 class="dd-logic-link-subcard-label dd-logic-link-grid-h dd-logic-link-grid-h--tgt">
                        TargetFeature
                      </h4>
                      <section class="dd-logic-link-subcard dd-logic-link-grid-b dd-logic-link-grid-b--src">
                        <template v-if="row.source">
                          <div class="dd-logic-endpoint-stack" :aria-label="'源特征 ' + row.source.featureId">
                            <div
                              class="dd-logic-endpoint-tile"
                              :aria-label="'Token：' + readLinkEndpointTokenDisplay(row.source)"
                            >
                              <div
                                class="dd-logic-pill dd-logic-pill--endpoint-tok"
                                :class="resolveTask2LinkEndpointPillClass(row.source)"
                                :title="readLinkEndpointTokenDisplayRaw(row.source)"
                              >
                                {{ readLinkEndpointTokenDisplay(row.source) }}
                              </div>
                            </div>
                            <div
                              class="dd-logic-endpoint-tile"
                              :aria-label="'Operator：' + readLinkEndpointOperator(row.source)"
                            >
                              <p class="dd-logic-endpoint-tile-body dd-logic-endpoint-tile-body--op">
                                {{ readLinkEndpointOperator(row.source) }}
                              </p>
                            </div>
                            <div
                              class="dd-logic-endpoint-tile"
                              :aria-label="'Value：' + row.source.name"
                            >
                              <div
                                class="dd-logic-pill dd-logic-pill--endpoint-val"
                                :class="resolveTask2LinkEndpointPillClass(row.source)"
                                :title="row.source.name"
                              >
                                {{ row.source.name }}
                              </div>
                            </div>
                          </div>
                        </template>
                        <p v-else class="dd-logic-link-missing">
                          接口未返回 <code>source</code>。请部署含任务 2 链路扩展的<strong>最新后端</strong>并<strong>重启 Node 进程</strong>后，对本页<strong>强制刷新</strong>（避免缓存旧 JS）。
                        </p>
                      </section>
                      <div
                        class="dd-logic-link-bridge-column"
                        role="group"
                        :aria-labelledby="'dd-logic-bridge-h-' + row.linkId"
                        :aria-label="'推导权重 ' + formatLinkWeightDisplay(row.weight)"
                      >
                        <div class="dd-logic-link-bridge-inner">
                          <div class="dd-logic-link-bridge-spacer-top" aria-hidden="true" />
                          <div class="dd-logic-link-bridge-mid">
                            <span class="dd-logic-weight-tag dd-logic-weight-tag--bridge">{{
                              formatLinkWeightDisplay(row.weight)
                            }}</span>
                            <div class="dd-logic-link-arrow-h" aria-hidden="true">
                              <span class="dd-logic-link-arrow-shaft" />
                              <span class="dd-logic-link-arrow-head" />
                            </div>
                          </div>
                          <div class="dd-logic-link-bridge-bottom">
                            <div class="dd-logic-link-logic-card">
                              <p class="dd-logic-link-logic-body">{{ logicBodyForLinkRow(row) }}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <section class="dd-logic-link-subcard dd-logic-link-grid-b dd-logic-link-grid-b--tgt">
                        <template v-if="row.target">
                          <div class="dd-logic-endpoint-stack" :aria-label="'目标特征 ' + row.target.featureId">
                            <div
                              class="dd-logic-endpoint-tile"
                              :aria-label="'Token：' + readLinkEndpointTokenDisplay(row.target)"
                            >
                              <div
                                class="dd-logic-pill dd-logic-pill--endpoint-tok"
                                :class="resolveTask2LinkEndpointPillClass(row.target)"
                                :title="readLinkEndpointTokenDisplayRaw(row.target)"
                              >
                                {{ readLinkEndpointTokenDisplay(row.target) }}
                              </div>
                            </div>
                            <div
                              class="dd-logic-endpoint-tile"
                              :aria-label="'Operator：' + readLinkEndpointOperator(row.target)"
                            >
                              <p class="dd-logic-endpoint-tile-body dd-logic-endpoint-tile-body--op">
                                {{ readLinkEndpointOperator(row.target) }}
                              </p>
                            </div>
                            <div
                              class="dd-logic-endpoint-tile"
                              :aria-label="'Value：' + row.target.name"
                            >
                              <div
                                class="dd-logic-pill dd-logic-pill--endpoint-val"
                                :class="resolveTask2LinkEndpointPillClass(row.target)"
                                :title="row.target.name"
                              >
                                {{ row.target.name }}
                              </div>
                            </div>
                          </div>
                        </template>
                        <p v-else class="dd-logic-link-missing">
                          接口未返回 <code>target</code>。请同上更新并重启后端后硬刷新。
                        </p>
                      </section>
                    </div>
                  </div>
                  <p v-if="!t.links.length" class="dd-logic-empty">暂无逻辑链</p>
                </div>
                <div v-else :key="t.taskId + '-panel-lnk'" class="dd-logic-pill-grid">
                  <div
                    v-for="row in t.links"
                    :key="t.taskId + '-lnk-' + row.linkId"
                    class="dd-logic-pill dd-logic-pill--logic"
                    :class="resolveTask1LinkPillClass(t.taskId, row)"
                    :title="row.name"
                  >
                    {{ row.name }}
                  </div>
                  <p v-if="!t.links.length" class="dd-logic-empty">暂无逻辑链</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dd-logic-backdrop {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1.25rem 1rem 2rem;
  box-sizing: border-box;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  overflow-y: auto;
}

.dd-logic-panel {
  width: 100%;
  max-width: 960px;
  margin-top: 0.35rem;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.18);
  padding: 1rem 1.15rem 1.25rem;
  box-sizing: border-box;
}

.dd-logic-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.dd-logic-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
}

.dd-logic-close {
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 10px;
  padding: 0.4rem 0.95rem;
  border: 1px solid #2563eb;
  color: #1d4ed8;
  background: #eff6ff;
}

.dd-logic-close:hover {
  background: #dbeafe;
}

.dd-logic-hint {
  margin: 0 0 0.75rem;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.45;
}

.dd-logic-hint code {
  font-size: 0.76em;
  padding: 0.08em 0.32em;
  border-radius: 4px;
  background: #f1f5f9;
}

.dd-logic-error {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: #b91c1c;
}

.dd-logic-loading {
  margin: 0;
  font-size: 0.88rem;
  color: #64748b;
}

.dd-logic-stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  max-height: min(72vh, 680px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.35rem;
  /* 由本容器滚动；子任务卡按内容增高，禁止 flex 压缩否则 pill 区被裁切、下一任务头视觉上叠在上卡底部 */
  min-height: 0;
}

.dd-logic-task-card {
  flex-shrink: 0;
  min-width: 0;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  /* 勿 hidden：展开区需随 Tab 内 pill 行数增高，hidden 会在部分布局下裁切末行标签 */
  overflow: visible;
  background: #fafbfc;
}

.dd-logic-task-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0;
  background: linear-gradient(180deg, #f1f5f9 0%, #fff 100%);
  border-bottom: 1px solid #e2e8f0;
  border-radius: 12px 12px 0 0;
  overflow: hidden;
}

.dd-logic-task-head--collapsed {
  border-bottom: none;
  /* 折叠时仅头栏可见，四角圆角与整张卡一致（卡本体 overflow: visible 后由头栏承担圆角） */
  border-radius: 12px;
}

.dd-logic-task-toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0.5rem 0.65rem;
  border: none;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.dd-logic-task-toggle:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}

.dd-logic-chevron {
  display: block;
  width: 0.38rem;
  height: 0.38rem;
  flex-shrink: 0;
  border-right: 2px solid #64748b;
  border-bottom: 2px solid #64748b;
  transform: rotate(-45deg);
  transition: transform 0.15s ease;
}

.dd-logic-chevron--open {
  transform: rotate(45deg);
}

.dd-logic-task-title {
  font-weight: 700;
  font-size: 0.82rem;
  color: #0f172a;
  min-width: 0;
}

.dd-logic-task-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  padding: 0.35rem 0.65rem 0.5rem;
  font-size: 0.72rem;
  color: #475569;
}

.dd-logic-metric em {
  font-style: normal;
  font-weight: 700;
  color: #2563eb;
  margin-right: 0.15rem;
}

.dd-logic-task-body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 0 0 auto;
  background: #fff;
  border-radius: 0 0 12px 12px;
  /* 无标签时也要完整露出三 Tab + 空态一行，避免卡片被压成一条缝 */
  min-height: 10.5rem;
  box-sizing: border-box;
  overflow: visible;
}

.dd-logic-subtabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
  align-content: flex-start;
  min-height: 2.65rem;
  flex-shrink: 0;
  padding: 0.5rem 0.65rem 0.45rem;
  border-bottom: 1px solid #f1f5f9;
  background: #fafafa;
  box-sizing: border-box;
}

.dd-logic-subtab {
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.32rem 0.62rem;
  line-height: 1.25;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  cursor: pointer;
}

.dd-logic-subtab--on {
  color: #1d4ed8;
  border-color: #2563eb;
  background: #eff6ff;
}

.dd-logic-subpanel {
  flex: 0 0 auto;
  padding: 0.55rem 0.65rem 0.95rem;
  overflow: visible;
  min-height: 6.25rem;
  box-sizing: border-box;
}

.dd-logic-pill-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: flex-start;
  align-content: flex-start;
  width: 100%;
  min-height: 2.75rem;
  overflow: visible;
}

/* Feature Tab：复合卡按内容撑开；网格每行内 stretch 等高，各行高度独立；首行 token | operator，次行通栏 value */
.dd-logic-feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(17.5rem, 1fr));
  grid-auto-rows: auto;
  gap: 0.65rem;
  width: 100%;
  min-height: 2.75rem;
  align-items: stretch;
  box-sizing: border-box;
}

.dd-logic-feature-card.dd-logic-pill {
  margin: 0;
  max-width: none;
  width: 100%;
  padding: 0.55rem 0.58rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
  align-items: stretch;
  font-weight: 500;
}

.dd-logic-feature-stack {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  flex: 0 1 auto;
  min-height: 0;
  width: 100%;
}

.dd-logic-pain-badge {
  align-self: flex-start;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #fff;
  background: #dc2626;
  line-height: 1.2;
}

.dd-logic-feature-row-tok-op {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem;
  min-width: 0;
  align-items: stretch;
}

@media (max-width: 720px) {
  .dd-logic-feature-row-tok-op {
    grid-template-columns: 1fr;
  }
}

.dd-logic-feature-sub {
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 8px;
  padding: 0.45rem 0.5rem;
  background: #fff;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.dd-logic-feature-sub--value {
  flex: 0 1 auto;
  justify-content: flex-start;
}

.dd-logic-feature-value-ref {
  margin: 0.3rem 0 0;
  padding: 0 0.08rem;
  font-size: 0.68rem;
  font-style: italic;
  font-weight: 400;
  line-height: 1.35;
  color: #dc2626;
  word-break: break-word;
}

.dd-logic-feature-sub-body {
  margin: 0;
  flex: 0 1 auto;
  max-height: 12rem;
  overflow-y: auto;
  font-size: 0.72rem;
  line-height: 1.4;
  color: #334155;
  word-break: break-word;
  min-height: 0;
}

.dd-logic-feature-sub-body--op {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.7rem;
  color: #0f172a;
}

.dd-logic-pill {
  max-width: 100%;
  padding: 0.4rem 0.65rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 0.78rem;
  font-weight: 600;
  color: #334155;
  line-height: 1.35;
  word-break: break-word;
}

.dd-logic-pill--logic {
  font-weight: 500;
  color: #475569;
}

/* 任务 1：同一 themeKey 的 Token / Feature / 逻辑 pill 同色边框与浅底（双类名提高优先级，避免 scoped 下与基类 `.dd-logic-pill` 抢样式失败） */
.dd-logic-pill.dd-logic-pill--tk-customer_basic {
  border-color: #93c5fd;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
  color: #1e3a5f;
}
.dd-logic-pill.dd-logic-pill--tk-businessContext {
  border-color: #6ee7b7;
  background: linear-gradient(180deg, #ecfdf5 0%, #f8fafc 100%);
  color: #064e3b;
}
.dd-logic-pill.dd-logic-pill--tk-coreBusinessEntities {
  border-color: #c4b5fd;
  background: linear-gradient(180deg, #f5f3ff 0%, #fafafa 100%);
  color: #4c1d95;
}
.dd-logic-pill.dd-logic-pill--tk-stateTransitionMatrix {
  border-color: #fcd34d;
  background: linear-gradient(180deg, #fffbeb 0%, #fafafa 100%);
  color: #78350f;
}
.dd-logic-pill.dd-logic-pill--tk-painPointRadar {
  border-color: #fda4af;
  background: linear-gradient(180deg, #fff1f2 0%, #fafafa 100%);
  color: #9f1239;
}
.dd-logic-pill.dd-logic-pill--tk-itLandscape {
  border-color: #67e8f9;
  background: linear-gradient(180deg, #ecfeff 0%, #f8fafc 100%);
  color: #164e63;
}
.dd-logic-pill.dd-logic-pill--tk-operationModel {
  border-color: #fdba74;
  background: linear-gradient(180deg, #fff7ed 0%, #fafafa 100%);
  color: #9a3412;
}
.dd-logic-pill.dd-logic-pill--tk-managementResources {
  border-color: #a5b4fc;
  background: linear-gradient(180deg, #eef2ff 0%, #fafafa 100%);
  color: #312e81;
}
.dd-logic-pill.dd-logic-pill--tk-requirement_misc {
  border-color: #cbd5e1;
  background: linear-gradient(180deg, #f1f5f9 0%, #fafafa 100%);
  color: #334155;
}

/* 任务 1：按「需求提炼 / 工商」批次上色（`pillBatchKey`）；同一 `cr-*` 或 `cb-0` 内各分域同色 */
.dd-logic-pill.dd-logic-pill--bat-cb0 {
  border-color: #93c5fd;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
  color: #1e3a5f;
}
.dd-logic-pill.dd-logic-pill--bat-cr0 {
  border-color: #5eead4;
  background: linear-gradient(180deg, #ecfdf5 0%, #f0fdfa 100%);
  color: #115e59;
}
.dd-logic-pill.dd-logic-pill--bat-cr1 {
  border-color: #fdba74;
  background: linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%);
  color: #9a3412;
}
.dd-logic-pill.dd-logic-pill--bat-cr2 {
  border-color: #c4b5fd;
  background: linear-gradient(180deg, #f5f3ff 0%, #faf5ff 100%);
  color: #5b21b6;
}
.dd-logic-pill.dd-logic-pill--bat-cr3 {
  border-color: #fb7185;
  background: linear-gradient(180deg, #fff1f2 0%, #fdf2f8 100%);
  color: #9f1239;
}
.dd-logic-pill.dd-logic-pill--bat-cr4 {
  border-color: #86efac;
  background: linear-gradient(180deg, #f0fdf4 0%, #ecfccb 100%);
  color: #14532d;
}
.dd-logic-pill.dd-logic-pill--bat-cr5 {
  border-color: #7dd3fc;
  background: linear-gradient(180deg, #f0f9ff 0%, #ecfeff 100%);
  color: #0c4a6e;
}
.dd-logic-pill.dd-logic-pill--bat-cr6 {
  border-color: #fcd34d;
  background: linear-gradient(180deg, #fffbeb 0%, #fef9c3 100%);
  color: #854d0e;
}
.dd-logic-pill.dd-logic-pill--bat-cr7 {
  border-color: #e879f9;
  background: linear-gradient(180deg, #fdf4ff 0%, #faf5ff 100%);
  color: #86198f;
}
.dd-logic-pill.dd-logic-pill--bat-nx0 {
  border-color: #cbd5e1;
  background: linear-gradient(180deg, #f1f5f9 0%, #fafafa 100%);
  color: #334155;
}

.dd-logic-pill.dd-logic-pill--bat-t2l10 {
  border-color: #a78bfa;
  background: linear-gradient(180deg, #f5f3ff 0%, #fafafa 100%);
  color: #4c1d95;
}

.dd-logic-link-tree {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  width: 100%;
  min-height: 2.75rem;
}

.dd-logic-link-tree-node {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  padding: 0.35rem 0.45rem 0.5rem;
  box-sizing: border-box;
}

.dd-logic-link-tree-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  margin: 0;
  padding: 0.25rem 0.15rem;
  border: none;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.dd-logic-link-tree-toggle:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
  border-radius: 6px;
}

.dd-logic-chevron--tree {
  width: 0.32rem;
  height: 0.32rem;
}

.dd-logic-link-id {
  font-size: 0.72rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  color: #0f172a;
  word-break: break-all;
  font-weight: 600;
}

.dd-logic-link-kind-pill {
  flex-shrink: 0;
  font-size: 0.62rem;
  padding: 0.1rem 0.38rem;
  border-radius: 999px;
  background: #e0f2fe;
  color: #0369a1;
  font-weight: 600;
  line-height: 1.2;
}
.dd-logic-link-kind-pill--reverse {
  background: #ffedd5;
  color: #9a3412;
}

/* 任务 2 逻辑链展开：2 行 × 3 列（标题行 + 内容行）；中间列为权重 + 蓝色水平箭头 + 下方逻辑圆角卡，竖直方向用 1:2 flex 使箭头带落在内容区约上 1/3 处 */
.dd-logic-link-triple-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(6.25rem, 9rem) minmax(0, 1fr);
  grid-template-rows: auto 1fr;
  gap: 0.5rem;
  margin-top: 0.45rem;
  align-items: start;
}

.dd-logic-link-grid-h {
  margin: 0 0 0.35rem;
}

.dd-logic-link-grid-h--src {
  grid-column: 1;
  grid-row: 1;
}

.dd-logic-link-grid-h--bridge {
  position: relative;
  grid-column: 2;
  grid-row: 1;
  min-height: 0.85rem;
}

.dd-logic-link-grid-h--tgt {
  grid-column: 3;
  grid-row: 1;
}

.dd-logic-link-grid-b {
  margin: 0;
  grid-row: 2;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.dd-logic-link-grid-b--src {
  grid-column: 1;
}

.dd-logic-link-grid-b--tgt {
  grid-column: 3;
}

.dd-logic-link-bridge-column {
  grid-column: 2;
  grid-row: 2;
  align-self: stretch;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.dd-logic-link-bridge-inner {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-height: 100%;
  width: 100%;
}

.dd-logic-link-bridge-spacer-top {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
}

.dd-logic-link-bridge-mid {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
}

.dd-logic-link-bridge-bottom {
  flex: 2 1 0;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 0.4rem;
  box-sizing: border-box;
}

.dd-logic-weight-tag--bridge {
  flex-shrink: 0;
}

.dd-logic-link-arrow-h {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 5.5rem;
}

.dd-logic-link-arrow-shaft {
  flex: 1 1 auto;
  height: 3px;
  min-width: 1.25rem;
  background: #2563eb;
  border-radius: 2px 0 0 2px;
}

.dd-logic-link-arrow-head {
  width: 0;
  height: 0;
  margin-left: -1px;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 10px solid #2563eb;
}

.dd-logic-link-logic-card {
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  border: 1px solid #bfdbfe;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
  box-sizing: border-box;
}

.dd-logic-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

@media (max-width: 720px) {
  .dd-logic-link-triple-wrap {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }

  .dd-logic-link-grid-h--src,
  .dd-logic-link-grid-h--bridge,
  .dd-logic-link-grid-h--tgt,
  .dd-logic-link-grid-b--src,
  .dd-logic-link-bridge-column,
  .dd-logic-link-grid-b--tgt {
    grid-column: 1;
  }

  .dd-logic-link-grid-h--src {
    grid-row: 1;
  }

  .dd-logic-link-grid-b--src {
    grid-row: 2;
  }

  .dd-logic-link-grid-h--bridge {
    grid-row: 3;
  }

  .dd-logic-link-bridge-column {
    grid-row: 4;
  }

  .dd-logic-link-grid-h--tgt {
    grid-row: 5;
  }

  .dd-logic-link-grid-b--tgt {
    grid-row: 6;
  }

  .dd-logic-link-bridge-inner {
    min-height: 0;
  }

  .dd-logic-link-bridge-spacer-top {
    flex: 0;
    display: none;
  }

  .dd-logic-link-bridge-mid {
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  .dd-logic-link-arrow-h {
    max-width: 8rem;
  }

  .dd-logic-link-bridge-bottom {
    flex: 0 1 auto;
    padding-top: 0.35rem;
  }
}

.dd-logic-link-subcard {
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #fff;
  padding: 0.45rem 0.5rem;
  min-height: 3rem;
  box-sizing: border-box;
}

.dd-logic-link-subcard-label {
  margin: 0 0 0.35rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.dd-logic-weight-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.42rem;
  border-radius: 999px;
  background: #2563eb;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  flex-shrink: 0;
  line-height: 1.2;
}

.dd-logic-link-logic-body {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.45;
  color: #1e293b;
  white-space: pre-wrap;
  word-break: break-word;
}

.dd-logic-link-missing {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.45;
  color: #94a3b8;
}

.dd-logic-link-missing code {
  font-size: 0.7em;
  padding: 0.06em 0.28em;
  border-radius: 4px;
  background: #f1f5f9;
}

/* 任务 2 逻辑边：Source/Target 主卡内的 Token / Operator / Value 三子卡 */
.dd-logic-endpoint-stack {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
  min-width: 0;
}

.dd-logic-endpoint-tile {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.38rem 0.45rem;
  background: #fafbfc;
  box-sizing: border-box;
  min-width: 0;
}

.dd-logic-endpoint-tile-body {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.4;
  color: #334155;
  word-break: break-word;
}

.dd-logic-endpoint-tile-body--op {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.7rem;
  color: #0f172a;
}

.dd-logic-pill.dd-logic-pill--endpoint-tok,
.dd-logic-pill.dd-logic-pill--endpoint-val {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.dd-logic-empty {
  margin: 0;
  font-size: 0.78rem;
  color: #94a3b8;
}
</style>
