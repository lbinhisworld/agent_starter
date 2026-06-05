<!--
  [INPUT]: L0.5 Target_KV 行列表与可选摘要
  [OUTPUT]: 解析工作区内的技术原语特征矩阵只读表
  [POS]: `ToolDetailPage.vue` 解析 Tab
-->
<script setup lang="ts">
import type { ToolDetailL05KvRow } from './toolDetailL05Format';

defineProps<{
  rows: ToolDetailL05KvRow[];
  summary?: string;
}>();
</script>

<template>
  <div class="td-l05-panel">
    <p v-if="rows.length === 0" class="tool-exp-workspace-hint">暂无 L0.5 特征行，请检查模型输出 JSON。</p>
    <table v-else class="td-l05-table">
      <thead>
        <tr>
          <th scope="col">FeatureID</th>
          <th scope="col">特征键</th>
          <th scope="col">特征值</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="`${row.FeatureID ?? ''}-${i}`">
          <td class="td-l05-fid">{{ row.FeatureID || '—' }}</td>
          <td class="td-l05-key">{{ row.Feature_Key || '—' }}</td>
          <td class="td-l05-val">{{ row.Feature_Value || '—' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="summary" class="td-l05-summary">{{ summary }}</p>
  </div>
</template>

<style scoped>
.td-l05-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.td-l05-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.td-l05-table th,
.td-l05-table td {
  border: 1px solid #e2e8f0;
  padding: 0.45rem 0.55rem;
  text-align: left;
  vertical-align: top;
}

.td-l05-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #475569;
}

.td-l05-fid {
  font-family: ui-monospace, monospace;
  font-size: 0.78rem;
  white-space: nowrap;
}

.td-l05-key {
  font-weight: 600;
  color: #1e40af;
  white-space: nowrap;
}

.td-l05-val {
  word-break: break-word;
}

.td-l05-summary {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.55;
  color: #64748b;
  padding: 0.55rem 0.65rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
</style>
