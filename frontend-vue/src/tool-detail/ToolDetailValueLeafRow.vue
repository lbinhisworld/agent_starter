<!--
  [INPUT]: value 定位与展示文案
  [OUTPUT]: 三级 value 行的编辑 / 删除操作
  [POS]: 工作画布目录树 L3 节点
-->
<script setup lang="ts">
import { ref } from 'vue';
import type { ToolDetailValueLocator } from './tool-detail-knowledge-persist';

const props = defineProps<{
  locator: ToolDetailValueLocator;
  value: string;
  featureId?: string;
}>();

const emit = defineEmits<{
  save: [locator: ToolDetailValueLocator, newValue: string];
  delete: [locator: ToolDetailValueLocator];
}>();

const editing = ref(false);
const draft = ref('');

function startEdit() {
  draft.value = props.value;
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  draft.value = '';
}

function submitEdit() {
  const next = draft.value.trim();
  if (!next) return;
  if (next === props.value.trim()) {
    cancelEdit();
    return;
  }
  emit('save', props.locator, next);
  cancelEdit();
}

function requestDelete() {
  const ok = window.confirm(`确认删除取值「${props.value}」？`);
  if (!ok) return;
  emit('delete', props.locator);
}
</script>

<template>
  <div class="td-value-leaf">
    <template v-if="editing">
      <input
        v-model="draft"
        type="text"
        class="td-value-leaf-input"
        aria-label="编辑取值"
        @keydown.enter.prevent="submitEdit"
        @keydown.esc.prevent="cancelEdit"
      />
      <button type="button" class="td-value-leaf-btn td-value-leaf-btn--primary" @click="submitEdit">保存</button>
      <button type="button" class="td-value-leaf-btn" @click="cancelEdit">取消</button>
    </template>
    <template v-else>
      <span class="td-value-leaf-dot" aria-hidden="true" />
      <span class="td-value-leaf-label">{{ value }}</span>
      <span v-if="featureId" class="td-value-leaf-fid" :title="featureId">{{ featureId }}</span>
      <span class="td-value-leaf-actions">
        <button type="button" class="td-value-leaf-btn" @click="startEdit">编辑</button>
        <button type="button" class="td-value-leaf-btn td-value-leaf-btn--danger" @click="requestDelete">
          删除
        </button>
      </span>
    </template>
  </div>
</template>

<style scoped>
.td-value-leaf {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.35rem 0.25rem;
  border-radius: 6px;
}

.td-value-leaf-dot {
  flex-shrink: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #94a3b8;
  margin-left: 0.2rem;
}

.td-value-leaf-label {
  font-size: 0.84rem;
  color: #475569;
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.td-value-leaf-fid {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-family: ui-monospace, monospace;
  color: #94a3b8;
  max-width: 8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-value-leaf-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
  margin-left: auto;
}

.td-value-leaf-input {
  flex: 1 1 12rem;
  min-width: 8rem;
  font-family: inherit;
  font-size: 0.84rem;
  padding: 0.25rem 0.45rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}

.td-value-leaf-btn {
  flex-shrink: 0;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
  font-size: 0.72rem;
  font-family: inherit;
  padding: 0.12rem 0.45rem;
  border-radius: 6px;
  cursor: pointer;
}

.td-value-leaf-btn:hover {
  background: #f8fafc;
}

.td-value-leaf-btn--primary {
  border-color: #2563eb;
  color: #1d4ed8;
}

.td-value-leaf-btn--danger {
  border-color: #fecaca;
  color: #b91c1c;
}

.td-value-leaf-btn--danger:hover {
  background: #fef2f2;
}
</style>
