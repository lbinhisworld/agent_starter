<!--
  [INPUT]: URL `caseId`（及可选 `customerName`、`archiveNo`）；`backendApi.fetchCaseLlmLogs`
  [OUTPUT]: 当前案例 LLM 调用累计指标 + 轻量列表（taskId / 调用目标 / tokens / 耗时）
  [POS]: 设计详情配套审计页

  [PROTOCOL]: 字段与后端 `GET /problem-cases/:id/llm-logs` 对齐；变更时同步本目录说明
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { backendApi, type CaseLlmLogRowDto, type CaseLlmLogSummaryDto } from '../api/client';
import { formatCallTargetForStatsDisplay } from '../design-detail/designDetailLlmStats';

function displayLlmLogCallTarget(raw: string): string {
  return formatCallTargetForStatsDisplay(String(raw || ''));
}

const caseId = ref('');
const customerName = ref('');
const archiveNoRaw = ref('');
const loadError = ref('');
const loading = ref(true);
const summary = ref<CaseLlmLogSummaryDto | null>(null);
const items = ref<CaseLlmLogRowDto[]>([]);

const archiveLabel = computed(() => {
  const n = Number(archiveNoRaw.value);
  if (Number.isFinite(n) && n > 0) {
    return `档案编号 ${String(Math.floor(n)).padStart(4, '0')}`;
  }
  return '';
});

const headlineText = computed(() => {
  const name = customerName.value.trim() || '未命名客户';
  const id = caseId.value.trim();
  if (!id) return name;
  return `${name} · caseId ${id}`;
});

function readQuery() {
  try {
    const u = new URL(window.location.href);
    caseId.value = u.searchParams.get('caseId') || u.searchParams.get('customerId') || '';
    customerName.value = u.searchParams.get('customerName') || '';
    archiveNoRaw.value = u.searchParams.get('archiveNo') || '';
  } catch {
    caseId.value = '';
    customerName.value = '';
    archiveNoRaw.value = '';
  }
}

function formatDurationHhmmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

function goDesignDetail() {
  const id = caseId.value.trim();
  if (!id) {
    window.location.href = 'design-detail.html';
    return;
  }
  const u = new URL('design-detail.html', window.location.href);
  u.searchParams.set('caseId', id);
  const cn = customerName.value.trim();
  if (cn) u.searchParams.set('customerName', cn);
  const ar = archiveNoRaw.value.trim();
  if (ar) u.searchParams.set('archiveNo', ar);
  window.location.href = u.pathname + u.search + u.hash;
}

function goHome() {
  window.location.href = 'home.html';
}

async function load() {
  loadError.value = '';
  const id = caseId.value.trim();
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

onMounted(() => {
  readQuery();
  void load();
});
</script>

<template>
  <div class="dll-app">
    <nav class="dll-nav" aria-label="主导航">
      <button type="button" class="dll-btn dll-btn--ghost" @click="goHome">← 返回首页</button>
      <button type="button" class="dll-btn dll-btn--ghost" @click="goDesignDetail">← 设计详情</button>
      <span class="dll-nav-title">LLM 调用详情</span>
    </nav>

    <div class="dll-headline" role="status">
      <span v-if="archiveLabel" class="dll-pill">{{ archiveLabel }}</span>
      <span class="dll-headline-main">{{ headlineText }}</span>
    </div>

    <div v-if="!caseId.trim()" class="dll-placeholder">
      请在 URL 中传入 <code>caseId=</code>。
    </div>

    <template v-else>
      <p v-if="loadError" class="dll-error" role="alert">{{ loadError }}</p>
      <p v-else-if="loading" class="dll-muted">加载中…</p>

      <template v-else-if="summary">
        <section class="dll-metrics" aria-label="累计指标">
          <div class="dll-metric">
            <div class="dll-metric-value">{{ summary.callCount }}</div>
            <div class="dll-metric-label">调用次数</div>
          </div>
          <div class="dll-metric">
            <div class="dll-metric-value">{{ summary.inputTokens }}</div>
            <div class="dll-metric-label">输入 token</div>
          </div>
          <div class="dll-metric">
            <div class="dll-metric-value">{{ summary.outputTokens }}</div>
            <div class="dll-metric-label">输出 token</div>
          </div>
          <div class="dll-metric">
            <div class="dll-metric-value">{{ formatDurationHhmmss(summary.durationMs) }}</div>
            <div class="dll-metric-label">累计耗时</div>
          </div>
        </section>

        <section class="dll-table-wrap" aria-label="调用列表">
          <table class="dll-table">
            <thead>
              <tr>
                <th scope="col">taskId</th>
                <th scope="col">调用目标</th>
                <th scope="col" class="dll-num">输入 token</th>
                <th scope="col" class="dll-num">输出 token</th>
                <th scope="col" class="dll-num">耗时</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in items" :key="row.id">
                <td class="dll-mono">{{ row.taskId }}</td>
                <td>{{ displayLlmLogCallTarget(row.callTarget) }}</td>
                <td class="dll-num">{{ row.inputTokens ?? '—' }}</td>
                <td class="dll-num">{{ row.outputTokens ?? '—' }}</td>
                <td class="dll-num dll-mono">{{ formatDurationHhmmss(row.durationMs) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="items.length === 0" class="dll-muted dll-empty">暂无调用记录</p>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.dll-app {
  min-height: 100vh;
  background: #f6f7fb;
  color: #1a1d26;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.dll-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  background: #fff;
  border-bottom: 1px solid #e2e5ec;
}

.dll-nav-title {
  margin-left: auto;
  font-weight: 600;
  font-size: 15px;
}

.dll-btn {
  border: 1px solid #c5cad6;
  background: #fff;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}

.dll-btn--ghost:hover {
  background: #f0f2f7;
}

.dll-headline {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px 8px;
  flex-wrap: wrap;
}

.dll-pill {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e8eeff;
  color: #2f4ad2;
}

.dll-headline-main {
  font-size: 17px;
  font-weight: 600;
}

.dll-placeholder,
.dll-error,
.dll-muted {
  margin: 16px 18px;
}

.dll-error {
  color: #b42318;
}

.dll-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  padding: 8px 18px 16px;
}

.dll-metric {
  background: #fff;
  border: 1px solid #e2e5ec;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.dll-metric-value {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.dll-metric-label {
  margin-top: 4px;
  font-size: 12px;
  color: #5c6478;
}

.dll-table-wrap {
  margin: 0 18px 32px;
  background: #fff;
  border: 1px solid #e2e5ec;
  border-radius: 12px;
  overflow: auto;
}

.dll-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.dll-table th,
.dll-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #eef0f5;
}

.dll-table th {
  background: #fafbff;
  font-weight: 600;
  color: #3d4458;
}

.dll-num {
  text-align: right;
  white-space: nowrap;
}

.dll-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.dll-empty {
  padding: 16px;
  text-align: center;
}
</style>
