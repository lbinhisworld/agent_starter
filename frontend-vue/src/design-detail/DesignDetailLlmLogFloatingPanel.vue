<!--
  [INPUT]: `visible`、`caseId`、可选 `customerName` / `archiveNoRaw`、可选 `refreshTick`（`useDesignDetailChat.llmLogAuditRefreshTick`：每次 LLM 收尾递增，**「重启当前」成功收尾也会递增**）
  [OUTPUT]: 可拖拽、**淡紫主题**高不透明度磨砂浮层（指标卡居中、数值紫色、卡片与面板带阴影），展示案例 LLM 审计指标与列表；**打开时**与 **refreshTick 变化且可见时** 自动 `fetchCaseLlmLogs`；不挡下层点击（仅面板接收指针）
  [POS]: 设计详情顶栏「LLM」配套

  [PROTOCOL]: 数据契约同 `GET /problem-cases/:id/llm-logs`；列表「调用目标」经 `formatCallTargetForStatsDisplay`（如 `需求提炼#n`、`需求#n合并#token`、`客户工商及经营范围信息提炼`）；task1 子环节 `taskId` 均为「任务 1：客户基本情况了解」；**关闭浮层**（`visible=false`）前须将焦点移出 `.dd-llm-float-panel`，避免 `aria-hidden` 与保留焦点冲突（控制台 Blocked aria-hidden）；变更时同步 `AGENTS.md`
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { backendApi, type CaseLlmLogRowDto, type CaseLlmLogSummaryDto } from '../api/client';
import { formatCallTargetForStatsDisplay } from './designDetailLlmStats';

function displayLlmLogCallTarget(raw: string): string {
  return formatCallTargetForStatsDisplay(String(raw || ''));
}

const props = defineProps<{
  visible: boolean;
  caseId: string;
  customerName?: string;
  archiveNoRaw?: string;
  /** 设计详情页每次 LLM 调用结束后递增；本面板在可见时监听并重新拉取列表 */
  refreshTick?: number;
}>();

const emit = defineEmits<{ close: [] }>();

const loadError = ref('');
const loading = ref(false);
const summary = ref<CaseLlmLogSummaryDto | null>(null);
const items = ref<CaseLlmLogRowDto[]>([]);

const panelX = ref(48);
const panelY = ref(72);
const dragging = ref(false);
let dragStartClientX = 0;
let dragStartClientY = 0;
let dragOrigX = 0;
let dragOrigY = 0;

function panelSize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(920, vw - 32);
  const h = Math.min(vh * 0.88, 760);
  return { w, h };
}

function clampPosition() {
  const pad = 8;
  const { w, h } = panelSize();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  panelX.value = Math.min(Math.max(pad, panelX.value), Math.max(pad, vw - w - pad));
  panelY.value = Math.min(Math.max(pad, panelY.value), Math.max(pad, vh - h - pad));
}

function resetPosition() {
  const { w, h } = panelSize();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  panelX.value = Math.max(16, (vw - w) / 2);
  panelY.value = Math.max(16, (vh - h) / 5);
}

const archiveLabel = computed(() => {
  const n = Number(props.archiveNoRaw || '');
  if (Number.isFinite(n) && n > 0) {
    return `档案编号 ${String(Math.floor(n)).padStart(4, '0')}`;
  }
  return '';
});

const headlineText = computed(() => {
  const name = String(props.customerName || '').trim() || '未命名客户';
  const id = String(props.caseId || '').trim();
  if (!id) return name;
  return `${name} · caseId ${id}`;
});

function formatDurationHhmmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

async function load() {
  loadError.value = '';
  const id = String(props.caseId || '').trim();
  if (!id) {
    loading.value = false;
    summary.value = null;
    items.value = [];
    return;
  }
  loading.value = true;
  try {
    const data = await backendApi.fetchCaseLlmLogs(id);
    summary.value = data.summary;
    items.value = data.items;
  } catch (e) {
    summary.value = null;
    items.value = [];
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function onResize() {
  if (props.visible) clampPosition();
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return;
  panelX.value = dragOrigX + (e.clientX - dragStartClientX);
  panelY.value = dragOrigY + (e.clientY - dragStartClientY);
  clampPosition();
}

function onPointerUp() {
  dragging.value = false;
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
}

function onHeaderPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  const el = e.target as HTMLElement | null;
  if (el?.closest?.('button')) return;
  dragging.value = true;
  dragStartClientX = e.clientX;
  dragStartClientY = e.clientY;
  dragOrigX = panelX.value;
  dragOrigY = panelY.value;
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      resetPosition();
      void load();
      return;
    }
    /** 在 DOM 将面板标为隐藏/`aria-hidden` 之前移出焦点，避免 Blocked aria-hidden 控制台告警 */
    const ae = document.activeElement;
    if (ae instanceof HTMLElement && ae.closest('.dd-llm-float-panel')) {
      ae.blur();
    }
  },
  { flush: 'sync' },
);

watch(
  () => props.caseId,
  () => {
    if (props.visible) void load();
  },
);

watch(
  () => props.refreshTick,
  () => {
    if (!props.visible) return;
    if (props.refreshTick == null || props.refreshTick < 1) return;
    void load();
  },
);

onMounted(() => {
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-show="visible"
      class="dd-llm-float-panel"
      role="dialog"
      aria-labelledby="dd-llm-float-title"
      :aria-hidden="!visible"
      :style="{ left: `${panelX}px`, top: `${panelY}px` }"
    >
      <header class="dd-llm-float-header" @pointerdown="onHeaderPointerDown">
        <div class="dd-llm-float-header-main">
          <span id="dd-llm-float-title" class="dd-llm-float-title">LLM 调用详情</span>
          <span class="dd-llm-float-drag-hint" aria-hidden="true">拖拽标题栏移动</span>
        </div>
        <div class="dd-llm-float-header-actions">
          <button type="button" class="dd-llm-float-icon-btn" title="刷新" aria-label="刷新列表" @click.stop="load">
            ↻
          </button>
          <button type="button" class="dd-llm-float-icon-btn" title="关闭" aria-label="关闭" @click.stop="emit('close')">
            ×
          </button>
        </div>
      </header>

      <div class="dd-llm-float-headline">
        <span v-if="archiveLabel" class="dd-llm-float-pill">{{ archiveLabel }}</span>
        <span class="dd-llm-float-headline-text">{{ headlineText }}</span>
      </div>

      <div class="dd-llm-float-body">
        <p v-if="!caseId.trim()" class="dd-llm-float-muted">未加载案例 ID。</p>
        <template v-else>
          <p v-if="loadError" class="dd-llm-float-error" role="alert">{{ loadError }}</p>
          <p v-else-if="loading" class="dd-llm-float-muted">加载中…</p>
          <template v-else-if="summary">
            <section class="dd-llm-float-metrics" aria-label="累计指标">
              <div class="dd-llm-float-metric">
                <div class="dd-llm-float-metric-value">{{ summary.callCount }}</div>
                <div class="dd-llm-float-metric-label">调用次数</div>
              </div>
              <div class="dd-llm-float-metric">
                <div class="dd-llm-float-metric-value">{{ summary.inputTokens }}</div>
                <div class="dd-llm-float-metric-label">输入 token</div>
              </div>
              <div class="dd-llm-float-metric">
                <div class="dd-llm-float-metric-value">{{ summary.outputTokens }}</div>
                <div class="dd-llm-float-metric-label">输出 token</div>
              </div>
              <div class="dd-llm-float-metric">
                <div class="dd-llm-float-metric-value">{{ formatDurationHhmmss(summary.durationMs) }}</div>
                <div class="dd-llm-float-metric-label">累计耗时</div>
              </div>
            </section>
            <section class="dd-llm-float-table-wrap" aria-label="调用列表">
              <table class="dd-llm-float-table">
                <thead>
                  <tr>
                    <th scope="col">taskId</th>
                    <th scope="col">调用目标</th>
                    <th scope="col" class="dd-llm-num">输入 token</th>
                    <th scope="col" class="dd-llm-num">输出 token</th>
                    <th scope="col" class="dd-llm-num">耗时</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in items" :key="row.id">
                    <td class="dd-llm-mono">{{ row.taskId }}</td>
                    <td>{{ displayLlmLogCallTarget(row.callTarget) }}</td>
                    <td class="dd-llm-num">{{ row.inputTokens ?? '—' }}</td>
                    <td class="dd-llm-num">{{ row.outputTokens ?? '—' }}</td>
                    <td class="dd-llm-num dd-llm-mono">{{ formatDurationHhmmss(row.durationMs) }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-if="items.length === 0" class="dd-llm-float-muted dd-llm-float-empty">暂无调用记录</p>
            </section>
          </template>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dd-llm-float-panel {
  position: fixed;
  z-index: 100050;
  width: min(920px, calc(100vw - 32px));
  max-height: min(88vh, 760px);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #3b2f4a;
  /* 淡紫主题 + 轻磨砂 */
  background: rgba(250, 245, 255, 0.97);
  backdrop-filter: blur(12px) saturate(1.15);
  -webkit-backdrop-filter: blur(12px) saturate(1.15);
  border: 1px solid rgba(167, 139, 250, 0.55);
  box-shadow:
    0 12px 40px rgba(91, 33, 182, 0.14),
    0 4px 14px rgba(109, 40, 217, 0.1),
    0 0 0 1px rgba(196, 181, 253, 0.35) inset;
}

.dd-llm-float-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px 10px 14px;
  cursor: grab;
  user-select: none;
  background: rgba(243, 232, 255, 0.92);
  border-bottom: 1px solid rgba(167, 139, 250, 0.4);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6) inset;
}

.dd-llm-float-header:active {
  cursor: grabbing;
}

.dd-llm-float-header-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dd-llm-float-title {
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.01em;
}

.dd-llm-float-drag-hint {
  font-size: 11px;
  color: rgba(91, 33, 182, 0.55);
}

.dd-llm-float-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.dd-llm-float-icon-btn {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(167, 139, 250, 0.45);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
  color: #5b21b6;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(91, 33, 182, 0.12);
}

.dd-llm-float-icon-btn:hover {
  background: #ffffff;
  color: #4c1d95;
  box-shadow: 0 2px 6px rgba(91, 33, 182, 0.16);
}

.dd-llm-float-headline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 14px 6px;
  background: rgba(237, 233, 254, 0.55);
}

.dd-llm-float-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(221, 214, 254, 0.95);
  color: #5b21b6;
  font-weight: 500;
  border: 1px solid rgba(167, 139, 250, 0.35);
}

.dd-llm-float-headline-text {
  font-size: 13px;
  font-weight: 600;
  color: #4c1d95;
}

.dd-llm-float-body {
  padding: 8px 14px 14px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}

.dd-llm-float-muted {
  margin: 8px 0;
  font-size: 13px;
  color: rgba(91, 33, 182, 0.55);
}

.dd-llm-float-error {
  margin: 8px 0;
  font-size: 13px;
  color: #b91c1c;
}

.dd-llm-float-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.dd-llm-float-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: linear-gradient(180deg, #fdf4ff 0%, #faf5ff 100%);
  border: 1px solid rgba(167, 139, 250, 0.5);
  border-radius: 12px;
  padding: 14px 12px;
  box-shadow:
    0 4px 14px rgba(91, 33, 182, 0.1),
    0 1px 3px rgba(109, 40, 217, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.7) inset;
}

.dd-llm-float-metric-value {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #6d28d9;
  line-height: 1.25;
}

.dd-llm-float-metric-label {
  margin-top: 6px;
  font-size: 11px;
  color: rgba(91, 33, 182, 0.62);
  line-height: 1.3;
}

.dd-llm-float-table-wrap {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(167, 139, 250, 0.45);
  border-radius: 12px;
  overflow: auto;
  max-height: min(42vh, 360px);
  box-shadow:
    0 4px 16px rgba(91, 33, 182, 0.08),
    0 0 0 1px rgba(237, 233, 254, 0.8) inset;
}

.dd-llm-float-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.dd-llm-float-table th,
.dd-llm-float-table td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
}

.dd-llm-float-table th {
  background: rgba(237, 233, 254, 0.95);
  font-weight: 600;
  color: #5b21b6;
  position: sticky;
  top: 0;
  z-index: 1;
}

.dd-llm-num {
  text-align: right;
  white-space: nowrap;
}

.dd-llm-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
}

.dd-llm-float-empty {
  padding: 14px;
  text-align: center;
}
</style>
