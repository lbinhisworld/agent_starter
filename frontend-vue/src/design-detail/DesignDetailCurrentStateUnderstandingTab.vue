<!--
  [INPUT]: customerName、task51L3MatrixRawOutput、taskGraphTasks、refreshTick
  [OUTPUT]: 「现状理解」画布——价值主张 + 能力单元 + 业务流程 + 第四层价值流/关键场景 + 贝塞尔虚线箭头
  [POS]: `DesignDetailPage` 工作区 Tab（紧挨「需求提炼」右侧）

  [PROTOCOL]: 数据经 `buildCurrentStateUnderstandingViewModel`（5.1 + 5.2 + 5.3 task-graph）；5.3 落库后由 `refreshCurrentStateUnderstandingFromTaskGraph` 刷新
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
import type { DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import {
  buildCurrentStateUnderstandingViewModel,
  CSU_FIELD_TAGS_PER_ROW,
  CSU_WORKFLOW_STEP_FIELD_TAGS_PER_ROW,
  type CurrentStateUnderstandingModel,
} from './buildCurrentStateUnderstandingFromTask51';

const props = defineProps<{
  customerName: string;
  task51L3MatrixRawOutput: string;
  /** 归并后的推理图 tasks（5.2 落库后由父级刷新） */
  taskGraphTasks: DesignDetailLogicGraphTaskDto[];
  refreshTick: number;
  /** 画布 Tab 是否当前可见（v-show）；隐藏时尺寸为 0，需在激活后重绘连线 */
  panelActive?: boolean;
}>();

const paintHostRef = ref<HTMLElement | null>(null);
/** 业务流程折叠卡：默认全部展开 */
const workflowExpanded = ref<Record<string, boolean>>({});

/** 画布区外层滚容器（`.dd-workspace-body`），与 Tab 内嵌滚动解耦 */
function resolveWorkspaceScrollEl(from: HTMLElement | null): HTMLElement | null {
  return from?.closest('.dd-workspace-body') ?? null;
}
const lineSvgRef = ref<SVGSVGElement | null>(null);
const pathDList = ref<string[]>([]);
const svgSize = ref({ w: 640, h: 400 });
const CSU_ARROW_ANIM_SEC = 2.2;

const model = computed((): CurrentStateUnderstandingModel | null => {
  void props.refreshTick;
  const raw = String(props.task51L3MatrixRawOutput || '').trim();
  if (!raw) return null;
  return buildCurrentStateUnderstandingViewModel(raw, props.customerName, props.taskGraphTasks);
});

function chunkFieldTags<T>(items: readonly T[], perRow: number): T[][] {
  const n = Math.max(1, Math.floor(perRow));
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += n) {
    rows.push(items.slice(i, i + n));
  }
  return rows;
}

const hasContent = computed(
  () =>
    !!model.value &&
    (model.value.coreValueClaim ||
      model.value.capabilityUnits.length > 0 ||
      model.value.workflows.length > 0 ||
      model.value.vsmScenarioPhases.length > 0),
);

function isWorkflowExpanded(workflowId: string): boolean {
  return workflowExpanded.value[workflowId] !== false;
}

function toggleWorkflowExpanded(workflowId: string): void {
  const id = String(workflowId || '').trim();
  if (!id) return;
  workflowExpanded.value = {
    ...workflowExpanded.value,
    [id]: !isWorkflowExpanded(id),
  };
}

watch(
  () => model.value?.workflows.map((w) => w.id).join('\t') ?? '',
  (key) => {
    if (!key) return;
    const next: Record<string, boolean> = {};
    for (const w of model.value?.workflows ?? []) {
      next[w.id] = workflowExpanded.value[w.id] !== false;
    }
    workflowExpanded.value = next;
  },
);

function cardBottomCenterAnchor(el: HTMLElement, hostRect: DOMRect): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return {
    x: r.left - hostRect.left + r.width / 2,
    y: r.bottom - hostRect.top,
  };
}

function cardTopCenterAnchor(el: HTMLElement, hostRect: DOMRect): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return {
    x: r.left - hostRect.left + r.width / 2,
    y: r.top - hostRect.top,
  };
}

function bezierDownward(sx: number, sy: number, tx: number, ty: number): string {
  const dy = ty - sy;
  const midY = sy + dy * 0.5;
  const spread = Math.max(24, Math.abs(tx - sx) * 0.2);
  const c1y = midY - spread * 0.2;
  const c2y = midY + spread * 0.15;
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${sx.toFixed(1)} ${c1y.toFixed(1)} ${tx.toFixed(1)} ${c2y.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
}

function findAnchorElement(host: HTMLElement, anchorId: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-csu-anchor="${anchorId}"]`);
}

function redrawLines(): void {
  const host = paintHostRef.value;
  const m = model.value;
  if (!host || !m?.capabilityUnits.length) {
    pathDList.value = [];
    return;
  }

  const hostRect = host.getBoundingClientRect();
  if (hostRect.width < 2 || hostRect.height < 2) {
    return;
  }

  const vpEl = findAnchorElement(host, 'value-proposition');
  if (!vpEl) {
    pathDList.value = [];
    return;
  }

  const w = Math.max(host.scrollWidth, host.clientWidth, 480);
  const h = Math.max(host.scrollHeight, host.clientHeight, 320);
  svgSize.value = { w, h };
  const from = cardBottomCenterAnchor(vpEl, hostRect);

  const paths: string[] = [];
  for (const unit of m.capabilityUnits) {
    const capEl = findAnchorElement(host, unit.id);
    if (!capEl) continue;
    const to = cardTopCenterAnchor(capEl, hostRect);
    paths.push(bezierDownward(from.x, from.y, to.x, to.y));
  }
  pathDList.value = paths;
}

function scheduleRedrawLines(): void {
  void nextTick().then(() => {
    requestAnimationFrame(() => {
      redrawLines();
      requestAnimationFrame(() => redrawLines());
    });
  });
}

watch(
  () => [model.value, props.refreshTick] as const,
  () => scheduleRedrawLines(),
);

watch(
  () => props.panelActive,
  (active) => {
    if (active) scheduleRedrawLines();
  },
);

watch(lineSvgRef, (svg) => {
  if (svg) scheduleRedrawLines();
});

watch(
  () => paintHostRef.value,
  (host, _prev, onCleanup) => {
    const scroller = resolveWorkspaceScrollEl(host);
    if (!scroller) return;
    scroller.addEventListener('scroll', scheduleRedrawLines, { passive: true });
    onCleanup(() => scroller.removeEventListener('scroll', scheduleRedrawLines));
  },
  { flush: 'post' },
);

let roCleanup: (() => void) | null = null;
watch(
  () => ({ host: paintHostRef.value, draw: hasContent.value }),
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
  scheduleRedrawLines();
});

onUnmounted(() => {
  roCleanup?.();
  window.removeEventListener('resize', scheduleRedrawLines);
});
</script>

<template>
  <section class="dd-csu-root" aria-label="现状理解">
    <header class="dd-csu-toolbar">
      <span class="dd-csu-toolbar-title">现状理解</span>
      <span class="dd-csu-toolbar-hint">
        5.1 价值主张｜5.2 字段集（每行 {{ CSU_FIELD_TAGS_PER_ROW }} 标签）｜5.3 环节（每行
        {{ CSU_WORKFLOW_STEP_FIELD_TAGS_PER_ROW }} 字段）｜5.5/6 价值流阶段横向列（业务流程 + 关键场景）
      </span>
    </header>

    <div v-if="!hasContent" class="dd-csu-state">
      暂无内容。请完成任务 5.1（战略价值主张与业务能力单元）推理并成功落库后查看。
    </div>

    <div v-else ref="paintHostRef" class="dd-csu-canvas">
        <div class="dd-csu-layer">
          <h2 class="dd-csu-layer-title">第一层 · 价值主张理解</h2>
          <article
            class="dd-csu-vp-card"
            data-csu-anchor="value-proposition"
            aria-label="价值主张理解"
          >
            <header class="dd-csu-vp-head">
              <h3 class="dd-csu-vp-title">{{ model!.valuePropositionTitle }}</h3>
            </header>
            <div class="dd-csu-vp-body">
              <section class="dd-csu-vp-section">
                <h4 class="dd-csu-vp-subtitle">价值主张描述</h4>
                <p class="dd-csu-vp-text">{{ model!.coreValueClaim }}</p>
              </section>
              <section class="dd-csu-vp-section">
                <h4 class="dd-csu-vp-subtitle">交付模式特征</h4>
                <p class="dd-csu-vp-text">{{ model!.deliveryModelCharacter }}</p>
              </section>
              <section class="dd-csu-vp-section">
                <h4 class="dd-csu-vp-subtitle">核心推理逻辑</h4>
                <p class="dd-csu-vp-text dd-csu-vp-text--logic">{{ model!.coreReasoningLogic }}</p>
              </section>
            </div>
          </article>
        </div>

        <div class="dd-csu-layer dd-csu-layer--capabilities">
          <h2 class="dd-csu-layer-title">第二层 · 业务能力拆解</h2>
          <div class="dd-csu-cap-grid" role="list">
            <article
              v-for="unit in model!.capabilityUnits"
              :key="unit.id"
              class="dd-csu-cap-card"
              :data-csu-anchor="unit.id"
              role="listitem"
              :aria-label="unit.title"
            >
              <header class="dd-csu-cap-head">
                <h3 class="dd-csu-cap-title">{{ unit.title }}</h3>
              </header>
              <p class="dd-csu-cap-summary">{{ unit.businessFunction }}</p>
              <div v-if="unit.fieldSets.length" class="dd-csu-fs-stack" role="list">
                <article
                  v-for="fs in unit.fieldSets"
                  :key="fs.id"
                  class="dd-csu-fs-card"
                  role="listitem"
                  :aria-label="`字段集 ${fs.title}`"
                >
                  <header class="dd-csu-fs-head">
                    <h4 class="dd-csu-fs-title">{{ fs.title }}</h4>
                  </header>
                  <div v-if="fs.fieldTags.length" class="dd-csu-fs-tags">
                    <div
                      v-for="(row, ri) in chunkFieldTags(fs.fieldTags, CSU_FIELD_TAGS_PER_ROW)"
                      :key="`${fs.id}-row-${ri}`"
                      class="dd-csu-fs-tag-row"
                    >
                      <span
                        v-for="tag in row"
                        :key="`${fs.id}-${tag.fieldName}`"
                        class="dd-csu-fs-tag"
                        :class="{ 'dd-csu-fs-tag--pk': tag.isPrimaryKey }"
                        :title="tag.dataType ? `${tag.fieldName} · ${tag.dataType}` : tag.fieldName"
                      >
                        {{ tag.fieldName }}
                      </span>
                    </div>
                  </div>
                  <p v-else class="dd-csu-fs-empty">（暂无字段定义）</p>
                </article>
              </div>
            </article>
          </div>
        </div>

        <div v-if="model!.workflows.length" class="dd-csu-layer dd-csu-layer--workflows">
          <h2 class="dd-csu-layer-title">第三层 · 业务流程理解</h2>
          <div class="dd-csu-wf-stack" role="list">
            <article
              v-for="wf in model!.workflows"
              :key="wf.id"
              class="dd-csu-wf-card"
              role="listitem"
            >
              <button
                type="button"
                class="dd-csu-wf-head"
                :aria-expanded="isWorkflowExpanded(wf.id) ? 'true' : 'false'"
                :aria-controls="`dd-csu-wf-body-${wf.id}`"
                @click="toggleWorkflowExpanded(wf.id)"
              >
                <span class="dd-csu-wf-chevron" aria-hidden="true">{{
                  isWorkflowExpanded(wf.id) ? '▾' : '▸'
                }}</span>
                <h3 class="dd-csu-wf-title">{{ wf.workflowName }}</h3>
                <span class="dd-csu-wf-meta">{{ wf.steps.length }} 个环节</span>
              </button>
              <div
                v-show="isWorkflowExpanded(wf.id)"
                :id="`dd-csu-wf-body-${wf.id}`"
                class="dd-csu-wf-body"
              >
                <div v-if="wf.steps.length" class="dd-csu-wf-steps" role="list">
                  <template v-for="(step, si) in wf.steps" :key="step.id">
                    <span v-if="si > 0" class="dd-csu-wf-step-arrow" aria-hidden="true">→</span>
                    <article
                      class="dd-csu-wf-step-card"
                      role="listitem"
                      :aria-label="`环节 ${step.stepName}`"
                    >
                      <h4 class="dd-csu-wf-step-name">{{ step.stepName }}</h4>
                      <p class="dd-csu-wf-step-line">
                        <span class="dd-csu-wf-step-label">业务单元</span>
                        <span class="dd-csu-wf-step-val">{{ step.capabilityUnit }}</span>
                      </p>
                      <p class="dd-csu-wf-step-line">
                        <span class="dd-csu-wf-step-label">字段集</span>
                        <span class="dd-csu-wf-step-val">{{ step.assetFieldSet }}</span>
                      </p>
                      <div v-if="step.fieldTags.length" class="dd-csu-wf-step-fields">
                        <div
                          v-for="(row, ri) in chunkFieldTags(
                            step.fieldTags,
                            CSU_WORKFLOW_STEP_FIELD_TAGS_PER_ROW,
                          )"
                          :key="`${step.id}-fields-${ri}`"
                          class="dd-csu-wf-step-tag-row"
                        >
                          <span
                            v-for="tag in row"
                            :key="`${step.id}-${tag.fieldName}`"
                            class="dd-csu-fs-tag"
                            :class="{ 'dd-csu-fs-tag--pk': tag.isPrimaryKey }"
                            :title="tag.dataType ? `${tag.fieldName} · ${tag.dataType}` : tag.fieldName"
                          >
                            {{ tag.fieldName }}
                          </span>
                        </div>
                      </div>
                      <p v-else-if="step.assetFieldSet && step.assetFieldSet !== '—'" class="dd-csu-wf-step-fields-empty">
                        （未匹配到字段集 schema）
                      </p>
                    </article>
                  </template>
                </div>
                <p v-else class="dd-csu-wf-steps-empty">（无环节链）</p>
              </div>
            </article>
          </div>
        </div>

        <div v-if="model!.vsmScenarioPhases.length" class="dd-csu-layer dd-csu-layer--vsm">
          <h2 class="dd-csu-layer-title">第四层 · 关键痛点场景理解</h2>
          <div class="dd-csu-vsm-row" role="list">
            <article
              v-for="phase in model!.vsmScenarioPhases"
              :key="phase.id"
              class="dd-csu-vsm-phase-card"
              role="listitem"
              :aria-label="`价值流阶段 ${phase.phaseName}`"
            >
              <header class="dd-csu-vsm-phase-head">
                <h3 class="dd-csu-vsm-phase-title">{{ phase.phaseName }}</h3>
              </header>
              <div class="dd-csu-vsm-phase-body">
                <section class="dd-csu-vsm-section" aria-label="业务流程">
                  <h4 class="dd-csu-vsm-section-title">业务流程</h4>
                  <div
                    v-if="phase.workflows.length"
                    class="dd-csu-vsm-subcards"
                    role="list"
                  >
                    <article
                      v-for="wf in phase.workflows"
                      :key="wf.id"
                      class="dd-csu-vsm-wf-chip"
                      role="listitem"
                    >
                      {{ wf.workflowName }}
                    </article>
                  </div>
                  <p v-else class="dd-csu-vsm-empty">（本阶段暂无归类工作流）</p>
                </section>
                <section class="dd-csu-vsm-section" aria-label="关键场景">
                  <h4 class="dd-csu-vsm-section-title">关键场景</h4>
                  <div
                    v-if="phase.scenarios.length"
                    class="dd-csu-vsm-subcards dd-csu-vsm-subcards--scenarios"
                    role="list"
                  >
                    <article
                      v-for="sc in phase.scenarios"
                      :key="sc.id"
                      class="dd-csu-vsm-scenario-card"
                      role="listitem"
                    >
                      <h5 class="dd-csu-vsm-scenario-name">{{ sc.scenarioName }}</h5>
                      <p v-if="sc.painPointDescription" class="dd-csu-vsm-scenario-meta">
                        <span class="dd-csu-vsm-scenario-label">绑定痛点</span>
                        {{ sc.painPointDescription }}
                      </p>
                      <p
                        v-if="sc.defenseRationale"
                        class="dd-csu-vsm-scenario-rationale"
                      >
                        {{ sc.defenseRationale }}
                      </p>
                    </article>
                  </div>
                  <p v-else class="dd-csu-vsm-empty">（本阶段暂无关键场景）</p>
                </section>
              </div>
            </article>
          </div>
        </div>

        <svg
          v-if="model!.capabilityUnits.length > 0"
          ref="lineSvgRef"
          class="dd-csu-lines"
          :width="svgSize.w"
          :height="svgSize.h"
          :viewBox="`0 0 ${svgSize.w} ${svgSize.h}`"
          aria-hidden="true"
        >
          <g v-for="(d, i) in pathDList" :key="`csu-edge-${i}`" class="dd-csu-edge-group">
            <path
              :id="`dd-csu-motion-path-${i}`"
              :d="d"
              class="dd-csu-edge-motion-path"
              fill="none"
              stroke="none"
            />
            <path
              :d="d"
              class="dd-csu-edge"
              fill="none"
              stroke="#7c3aed"
              stroke-width="2"
              stroke-dasharray="8 6"
              opacity="0.85"
            />
            <polygon class="dd-csu-edge-arrow" points="0,-3.5 7,0 0,3.5">
              <animateMotion
                :dur="`${CSU_ARROW_ANIM_SEC}s`"
                repeatCount="indefinite"
                rotate="auto"
                calcMode="linear"
              >
                <mpath :href="`#dd-csu-motion-path-${i}`" />
              </animateMotion>
            </polygon>
          </g>
        </svg>
    </div>
  </section>
</template>

<style scoped>
.dd-csu-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  flex: 1 1 auto;
}

.dd-csu-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 16px;
  padding: 0 4px;
}

.dd-csu-toolbar-title {
  font-size: 15px;
  font-weight: 700;
  color: #312e81;
}

.dd-csu-toolbar-hint {
  font-size: 12px;
  color: #64748b;
}

.dd-csu-state {
  padding: 24px 16px;
  color: #64748b;
  font-size: 14px;
  text-align: center;
}

/* 开放式画布：不嵌套 max-height 滚区，由 `.dd-workspace-body` 纵向滚动到底 */
.dd-csu-canvas {
  position: relative;
  flex: 1 1 auto;
  min-height: min-content;
  padding: 8px 4px 72px;
  box-sizing: border-box;
}

.dd-csu-layer {
  position: relative;
  z-index: 1;
  margin-bottom: 40px;
}

.dd-csu-layer-title {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 700;
  color: #4f46e5;
  letter-spacing: 0.02em;
}

.dd-csu-vp-card {
  max-width: 920px;
  margin: 0 auto;
  border-radius: 16px;
  border: 2px solid #a5b4fc;
  background: linear-gradient(165deg, #eef2ff 0%, #faf5ff 55%, #fff 100%);
  box-shadow: 0 8px 28px rgba(79, 70, 229, 0.12);
}

.dd-csu-vp-head {
  padding: 16px 20px 12px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.2);
}

.dd-csu-vp-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #312e81;
  line-height: 1.35;
}

.dd-csu-vp-body {
  padding: 16px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dd-csu-vp-subtitle {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: #6366f1;
}

.dd-csu-vp-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: #1e293b;
  white-space: pre-wrap;
}

.dd-csu-vp-text--logic {
  color: #334155;
}

.dd-csu-layer--capabilities {
  width: 100%;
}

.dd-csu-cap-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  overflow-x: auto;
  padding-bottom: 8px;
}

.dd-csu-cap-card {
  flex: 1 1 0;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1.5px solid #c4b5fd;
  background: #fff;
  box-shadow: 0 4px 16px rgba(124, 58, 237, 0.1);
  padding: 14px 16px 16px;
  box-sizing: border-box;
}

.dd-csu-cap-head {
  margin-bottom: 10px;
}

.dd-csu-cap-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #5b21b6;
  line-height: 1.4;
}

.dd-csu-cap-summary {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #475569;
  white-space: pre-wrap;
}

.dd-csu-fs-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.dd-csu-fs-card {
  border-radius: 10px;
  border: 1px solid #ddd6fe;
  background: #faf5ff;
  padding: 10px 12px 12px;
}

.dd-csu-fs-head {
  margin-bottom: 8px;
}

.dd-csu-fs-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #6d28d9;
  line-height: 1.35;
}

.dd-csu-fs-tags {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dd-csu-fs-tag-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.dd-csu-fs-tag {
  display: block;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid #ddd6fe;
  background: #ede9fe;
  color: #4c1d95;
  font-size: 11px;
  line-height: 1.35;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dd-csu-fs-tag--pk {
  background: #2563eb;
  border-color: #1d4ed8;
  color: #fff;
  font-weight: 600;
}

.dd-csu-fs-empty {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.dd-csu-lines {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: 2;
  overflow: visible;
}

.dd-csu-edge-motion-path {
  visibility: hidden;
}

.dd-csu-edge {
  stroke: #7c3aed;
  stroke-width: 2;
  stroke-dasharray: 8 6;
  fill: none;
  opacity: 0.85;
}

.dd-csu-edge-arrow {
  fill: #7c3aed;
}

.dd-csu-layer--workflows {
  width: 100%;
}

.dd-csu-wf-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dd-csu-wf-card {
  border-radius: 14px;
  border: 1.5px solid #7dd3fc;
  background: linear-gradient(180deg, #f0f9ff 0%, #fff 85%);
  box-shadow: 0 4px 14px rgba(14, 165, 233, 0.1);
  overflow: hidden;
}

.dd-csu-wf-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  box-sizing: border-box;
}

.dd-csu-wf-head:hover {
  background: rgba(186, 230, 253, 0.35);
}

.dd-csu-wf-chevron {
  flex: 0 0 auto;
  font-size: 14px;
  font-weight: 700;
  color: #0369a1;
  line-height: 1;
}

.dd-csu-wf-title {
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
  color: #0c4a6e;
  line-height: 1.35;
}

.dd-csu-wf-meta {
  flex: 0 0 auto;
  font-size: 12px;
  color: #64748b;
}

.dd-csu-wf-body {
  padding: 0 14px 14px;
}

.dd-csu-wf-steps {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 0;
  width: max-content;
  max-width: 100%;
  overflow-x: auto;
  padding-bottom: 4px;
}

.dd-csu-wf-step-arrow {
  flex: 0 0 1.35rem;
  align-self: center;
  color: #2563eb;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1;
  text-align: center;
  user-select: none;
}

.dd-csu-wf-step-card {
  flex: 0 0 auto;
  min-width: 10rem;
  max-width: 20rem;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #93c5fd;
  background: #fff;
  box-sizing: border-box;
}

.dd-csu-wf-step-name {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: #1e3a8a;
  line-height: 1.35;
}

.dd-csu-wf-step-line {
  margin: 0 0 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  line-height: 1.4;
}

.dd-csu-wf-step-line:last-child {
  margin-bottom: 0;
}

.dd-csu-wf-step-label {
  color: #64748b;
  font-weight: 600;
}

.dd-csu-wf-step-val {
  color: #0f172a;
  word-break: break-word;
}

.dd-csu-wf-step-fields {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #bae6fd;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dd-csu-wf-step-tag-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.dd-csu-wf-step-fields-empty {
  margin: 8px 0 0;
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.4;
}

.dd-csu-wf-steps-empty {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.dd-csu-layer--vsm {
  width: 100%;
}

.dd-csu-vsm-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 14px;
  width: 100%;
  overflow-x: auto;
  padding-bottom: 10px;
}

.dd-csu-vsm-phase-card {
  flex: 0 0 auto;
  width: min(320px, 88vw);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  border: 2px solid #86efac;
  background: linear-gradient(165deg, #ecfdf5 0%, #f0fdf4 40%, #fff 100%);
  box-shadow: 0 6px 22px rgba(22, 163, 74, 0.12);
  box-sizing: border-box;
}

.dd-csu-vsm-phase-head {
  padding: 14px 16px 10px;
  border-bottom: 1px solid rgba(34, 197, 94, 0.25);
}

.dd-csu-vsm-phase-title {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #14532d;
  line-height: 1.4;
}

.dd-csu-vsm-phase-body {
  padding: 12px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1 1 auto;
}

.dd-csu-vsm-section-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  color: #15803d;
  letter-spacing: 0.04em;
}

.dd-csu-vsm-subcards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dd-csu-vsm-wf-chip {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #bbf7d0;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  color: #166534;
  line-height: 1.45;
  box-shadow: 0 1px 4px rgba(22, 101, 52, 0.06);
}

.dd-csu-vsm-scenario-card {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #93c5fd;
  background: #eff6ff;
  box-shadow: 0 1px 4px rgba(37, 99, 235, 0.08);
}

.dd-csu-vsm-scenario-name {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: #1e3a8a;
  line-height: 1.4;
}

.dd-csu-vsm-scenario-meta {
  margin: 0 0 6px;
  font-size: 11px;
  line-height: 1.45;
  color: #dc2626;
}

.dd-csu-vsm-scenario-label {
  display: inline-block;
  margin-right: 4px;
  font-weight: 700;
  color: inherit;
}

.dd-csu-vsm-scenario-rationale {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: #334155;
}

.dd-csu-vsm-empty {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.45;
}
</style>
