<!--
  [INPUT]: caseId、refreshTick
  [OUTPUT]: 架构清单「ER 图」子页——按宿主平台分块 + 表按 FK 被引用次数纵向分层 + FK 绿色虚线与流动箭头
  [POS]: `DesignDetailArchitectureInventoryTab.vue`
  [PROTOCOL]: 数据经 `buildDataArchitectureFromTaskGraph` → `buildErDiagramFromDataArchitecture`；变更时同步 AGENTS.md
-->
<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue';
import { buildDataArchitectureFromTaskGraph } from './buildDataArchitectureFromTaskGraph';
import {
  buildErDiagramFromDataArchitecture,
  type ErDiagramModel,
  type ErFieldPillModel,
  type ErPlatformModel,
  type ErTableBlockModel,
} from './buildErDiagramModelFromTaskGraph';
import {
  buildErPlatformRefCountLayers,
  type ErRefCountLayer,
} from './layoutErDiagramFkRefLayers';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import type { DesignDetailLogicGraphLinkDto } from './designDetailLogicGraphMerge';
import { normalizeLogicGraphTasksFromApiPayload } from './designDetailTask2L1SyncUiProgress';

const props = defineProps<{
  caseId: string;
  refreshTick: number;
}>();

const loading = ref(false);
const loadError = ref<string | null>(null);
const model = ref<ErDiagramModel | null>(null);

const scrollWrapRef = ref<HTMLElement | null>(null);
const paintHostRef = ref<HTMLElement | null>(null);
const lineSvgRef = ref<SVGSVGElement | null>(null);
const pathDList = ref<string[]>([]);
const svgSize = ref({ w: 480, h: 320 });
/** 外键流动箭头沿贝塞尔路径单程时长（秒） */
const FK_ARROW_ANIM_SEC = 2.4;

function erPillDataSlug(stableId: string): string {
  return encodeURIComponent(stableId);
}

function bezierBetween(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): string {
  return bezierBetweenAnchors(sx, sy, tx, ty);
}

function erTableBucketClass(tb: ErTableBlockModel): Record<string, boolean> {
  return {
    'dd-er-table-node--main': tb.bucket === 'main',
    'dd-er-table-node--base': tb.bucket === 'base',
    'dd-er-table-node--other': tb.bucket === 'other',
  };
}

function refLayersForPlatform(plat: ErPlatformModel): ErRefCountLayer[] {
  const m = model.value;
  if (!m) return [];
  return buildErPlatformRefCountLayers(plat, m.edges);
}

function erPillClass(pill: ErFieldPillModel): Record<string, boolean> {
  return {
    'dd-er-pill--pk': pill.isPk,
    'dd-er-pill--fk': pill.isFk && !pill.isPk,
  };
}

/** 字段 pill 顶部边缘中点（相对 paintHost） */
function pillTopCenterAnchor(el: HTMLElement, hostRect: DOMRect): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return {
    x: r.left - hostRect.left + r.width / 2,
    y: r.top - hostRect.top,
  };
}

/** 字段 pill 底部边缘中点（相对 paintHost，FK 侧锚点） */
function pillBottomCenterAnchor(el: HTMLElement, hostRect: DOMRect): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return {
    x: r.left - hostRect.left + r.width / 2,
    y: r.bottom - hostRect.top,
  };
}

function pillConnectPoints(
  fromEl: HTMLElement,
  toEl: HTMLElement,
  hostRect: DOMRect,
): { sx: number; sy: number; tx: number; ty: number } {
  const from = pillBottomCenterAnchor(fromEl, hostRect);
  const to = pillTopCenterAnchor(toEl, hostRect);
  return { sx: from.x, sy: from.y, tx: to.x, ty: to.y };
}

/** FK 底边 → PK 顶边贝塞尔，适配纵向分层 */
function bezierBetweenAnchors(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): string {
  const dy = ty - sy;
  const midY = sy + dy * 0.45;
  const spread = Math.max(20, Math.abs(tx - sx) * 0.12);
  const c1y = midY - spread * 0.15;
  const c2y = midY + spread * 0.15;
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${sx.toFixed(1)} ${c1y.toFixed(1)} ${tx.toFixed(1)} ${c2y.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
}

function findPillElement(host: HTMLElement, stableId: string): HTMLElement | null {
  const nodes = host.querySelectorAll<HTMLElement>('[data-er-pill]');
  for (const el of nodes) {
    const raw = el.getAttribute('data-er-pill') ?? '';
    try {
      if (decodeURIComponent(raw) === stableId) return el;
    } catch {
      if (raw === stableId) return el;
    }
  }
  return null;
}

function redrawLines(): void {
  const host = paintHostRef.value;
  const svg = lineSvgRef.value;
  const m = model.value;
  if (!host || !svg || !m?.edges.length) {
    pathDList.value = [];
    return;
  }

  /** 画布尺寸铺满内容宿主 */
  const w = Math.max(host.scrollWidth, host.clientWidth, 480);
  const h = Math.max(host.scrollHeight, host.clientHeight, 320);
  svgSize.value = { w, h };

  const hr = host.getBoundingClientRect();

  const paths: string[] = [];
  for (const e of m.edges) {
    const fromEl = findPillElement(host, e.fromStableId);
    const toEl = findPillElement(host, e.toStableId);
    if (!fromEl || !toEl) continue;
    const { sx, sy, tx, ty } = pillConnectPoints(fromEl, toEl, hr);
    paths.push(bezierBetween(sx, sy, tx, ty));
  }
  pathDList.value = paths;
}

function scheduleRedrawLines(): void {
  void nextTick().then(() => {
    requestAnimationFrame(() => redrawLines());
  });
}

async function fetchGraph(): Promise<void> {
  const cid = String(props.caseId || '').trim();
  if (!cid) {
    model.value = null;
    loadError.value = '缺少 caseId';
    return;
  }
  loading.value = true;
  loadError.value = null;
  try {
    const api = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            getDesignDetailTaskGraph?: (id: string) => Promise<{
              ok?: boolean;
              data?: { tasks?: unknown[]; links?: unknown[] };
              message?: string;
            } | null>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;
    if (typeof api !== 'function') {
      loadError.value = '未加载 problemCaseApi.getDesignDetailTaskGraph';
      model.value = null;
      return;
    }
    const res = await api(cid);
    if (!res?.ok || !res.data) {
      loadError.value = res?.message || '拉取 task-graph 失败';
      model.value = null;
      return;
    }
    const tasks = normalizeLogicGraphTasksFromApiPayload(res.data.tasks ?? []);
    const links = (Array.isArray(res.data.links) ? res.data.links : []) as DesignDetailLogicGraphLinkDto[];
    const dm = buildDataArchitectureFromTaskGraph(tasks as { taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }[], links);
    model.value = buildErDiagramFromDataArchitecture(dm);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
    model.value = null;
  } finally {
    loading.value = false;
  }
}

const hasDiagram = computed(() => {
  const m = model.value;
  return !!m && !m.emptyMessage && m.platforms.length > 0;
});

watch(
  () => [props.caseId, props.refreshTick] as const,
  () => {
    void fetchGraph();
  },
  { immediate: true },
);

watch(
  () => [model.value, loading.value] as const,
  () => {
    scheduleRedrawLines();
  },
);

watch(
  () => scrollWrapRef.value,
  (sw, _prev, onCleanup) => {
    if (!sw) return;
    sw.addEventListener('scroll', scheduleRedrawLines, { passive: true });
    onCleanup(() => sw.removeEventListener('scroll', scheduleRedrawLines));
  },
  { flush: 'post' },
);

/** Resize：表块换行后重算贝塞尔 */
let roCleanup: (() => void) | null = null;

watch(
  () => ({ host: paintHostRef.value, draw: hasDiagram.value }),
  async ({ host, draw }) => {
    roCleanup?.();
    roCleanup = null;
    await nextTick();
    if (!draw || !host || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => scheduleRedrawLines());
    ro.observe(host);
    roCleanup = () => ro.disconnect();
  },
  { flush: 'post' },
);

onMounted(() => {
  window.addEventListener('resize', scheduleRedrawLines);
});

onUnmounted(() => {
  roCleanup?.();
  window.removeEventListener('resize', scheduleRedrawLines);
});

defineExpose({
  refreshLines: scheduleRedrawLines,
});
</script>

<template>
  <section class="dd-er-root" aria-label="ER 图">
    <header class="dd-er-toolbar">
      <span class="dd-er-toolbar-title">ER 图</span>
      <span class="dd-er-toolbar-hint">
        由任务 10 物理表结构 Schema 派生｜按外键被引用次数自上而下分层（少→多）｜主键深蓝；外键绿虚线 + 流动箭头
      </span>
    </header>

    <div v-if="loading" class="dd-er-state">正在加载 task-graph…</div>
    <div v-else-if="loadError" class="dd-er-state dd-er-state--err">{{ loadError }}</div>
    <div v-else-if="model?.emptyMessage" class="dd-er-state">{{ model.emptyMessage }}</div>
    <div v-else-if="!hasDiagram" class="dd-er-state">
      暂无 ER 图内容。请确认任务 10 已完成落库，且特征含「物理表结构Schema」与「字段集合」。
    </div>

    <div v-else ref="scrollWrapRef" class="dd-er-scroll">
      <div ref="paintHostRef" class="dd-er-host">
        <div class="dd-er-platform-stack">
          <article
            v-for="plat in model!.platforms"
            :key="plat.platformKey"
            class="dd-er-platform-card"
          >
            <header class="dd-er-platform-cap">
              {{ plat.platformLabel }}
            </header>

            <div class="dd-er-platform-inner dd-er-platform-inner--ref-layers">
              <div
                v-for="layer in refLayersForPlatform(plat)"
                :key="`${plat.platformKey}-ref-${layer.refCount}-${layer.isolatedZeroFk ? 'iso0' : 'std'}`"
                class="dd-er-ref-layer"
              >
                <div class="dd-er-row-label">被引用 {{ layer.refCount }} 次</div>
                <div class="dd-er-table-row">
                  <div
                    v-for="tb in layer.tables"
                    :key="tb.featureId"
                    class="dd-er-table-node"
                    :class="erTableBucketClass(tb)"
                  >
                    <div class="dd-er-table-title">{{ tb.displayTableTitle }}</div>
                    <div class="dd-er-table-body">
                      <span
                        v-for="pill in tb.pills"
                        :key="pill.stableId"
                        class="dd-er-pill"
                        :class="erPillClass(pill)"
                        :data-er-pill="erPillDataSlug(pill.stableId)"
                      >
                        <span class="dd-er-pill-name">{{ pill.fieldName }}</span>
                        <span class="dd-er-pill-type">{{ pill.dataType }}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>

        <svg
          ref="lineSvgRef"
          class="dd-er-lines"
          :width="svgSize.w"
          :height="svgSize.h"
          aria-hidden="true"
        >
          <g v-for="(d, i) in pathDList" :key="`er-fk-edge-${i}`" class="dd-er-edge-group">
            <path
              :id="`dd-er-motion-path-${i}`"
              :d="d"
              class="dd-er-edge-motion-path"
              fill="none"
              stroke="none"
            />
            <path
              :d="d"
              class="dd-er-edge"
              fill="none"
            />
            <polygon class="dd-er-edge-arrow" points="0,-3.5 7,0 0,3.5">
              <animateMotion
                :dur="`${FK_ARROW_ANIM_SEC}s`"
                repeatCount="indefinite"
                rotate="auto"
                calcMode="linear"
              >
                <mpath :href="`#dd-er-motion-path-${i}`" />
              </animateMotion>
            </polygon>
          </g>
        </svg>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dd-er-root {
  display: flex;
  flex-direction: column;
  min-height: 360px;
  height: 100%;
}

.dd-er-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0 14px;
  flex-shrink: 0;
}

.dd-er-toolbar-title {
  font-weight: 700;
  font-size: 14px;
  color: #0f172a;
}

.dd-er-toolbar-hint {
  flex: 1;
  font-size: 12px;
  color: #64748b;
}

.dd-er-scroll {
  flex: 1;
  min-height: 280px;
  overflow: auto;
  position: relative;
}

.dd-er-host {
  position: relative;
  min-height: min-content;
}

.dd-er-lines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  overflow: visible;
}

.dd-er-platform-stack {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 0 40px;
}

.dd-er-platform-card {
  border: 2px solid #cbd5e1;
  border-radius: 16px;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 52%);
  box-shadow: 0 10px 30px rgb(15 23 42 / 6%);
  overflow: hidden;
}

.dd-er-platform-cap {
  margin: 0;
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
  border-bottom: 1px solid #e2e8f0;
  background: #f1f5f9;
}

.dd-er-platform-inner {
  padding: 14px;
}

.dd-er-platform-inner--ref-layers {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dd-er-ref-layer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dd-er-row-label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: none;
  margin: 12px 0 8px;
  letter-spacing: 0.06em;
}

.dd-er-platform-inner .dd-er-row-label:first-child {
  margin-top: 0;
}

.dd-er-table-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

.dd-er-table-node {
  min-width: 180px;
  max-width: 420px;
  border-radius: 12px;
  border: 1px solid #94a3b8;
  background: #fff;
  overflow: hidden;
}

.dd-er-table-node--main {
  border-color: #2563eb;
  box-shadow: 0 0 0 1px rgb(37 99 235 / 10%);
}

.dd-er-table-node--base {
  border-color: #ca8a04;
  box-shadow: 0 0 0 1px rgb(234 179 8 / 12%);
}

.dd-er-table-node--other {
  border-color: #94a3b8;
}

.dd-er-table-node--main .dd-er-table-title {
  background: linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1e40af;
}

.dd-er-table-node--base .dd-er-table-title {
  background: linear-gradient(180deg, #fef9c3 0%, #fde68a 100%);
  color: #854d0e;
}

.dd-er-table-node--other .dd-er-table-title {
  background: #e2e8f0;
  color: #334155;
}

.dd-er-table-title {
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 800;
}

.dd-er-table-body {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px;
  background: #fafafa;
}

.dd-er-pill {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  font-size: 11px;
  line-height: 1.3;
  padding: 5px 9px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #cbd5e1;
  box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
  min-width: 72px;
}

.dd-er-pill-name {
  font-weight: 600;
  color: #0f172a;
}

.dd-er-pill-type {
  font-size: 10px;
  font-weight: 500;
  color: #64748b;
}

.dd-er-pill--pk .dd-er-pill-name {
  color: #1e3a8a;
}

.dd-er-pill--fk .dd-er-pill-name {
  color: #16a34a;
}

.dd-er-pill--fk {
  border-color: #86efac;
  box-shadow: 0 0 0 1px rgb(22 163 74 / 12%);
}

.dd-er-edge-motion-path {
  pointer-events: none;
}

.dd-er-edge {
  vector-effect: non-scaling-stroke;
  stroke: #16a34a;
  stroke-width: 1.6;
  stroke-dasharray: 7 5;
  stroke-linecap: round;
  opacity: 0.92;
}

.dd-er-edge-arrow {
  fill: #16a34a;
  opacity: 0.95;
}

.dd-er-state {
  padding: 36px 20px;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}

.dd-er-state--err {
  color: #b45309;
}
</style>
