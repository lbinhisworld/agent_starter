<!--
  [INPUT]: 工具列表、新增模式与错误文案
  [OUTPUT]: 选择或新增工具的弹层
  [POS]: `ToolDetailPage.vue`
-->
<script setup lang="ts">
import type { ToolSuiteEntry } from './tool-suite-registry';

defineProps<{
  open: boolean;
  tools: ToolSuiteEntry[];
  activeToolId: string;
  addMode: boolean;
  newToolName: string;
  errorText: string;
}>();

const emit = defineEmits<{
  close: [];
  select: [entry: ToolSuiteEntry];
  'start-add': [];
  'cancel-add': [];
  'update:newToolName': [value: string];
  'confirm-add': [];
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="td-picker-backdrop"
      role="presentation"
      @click.self="emit('close')"
    >
      <div
        class="td-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="td-picker-title"
        @click.stop
      >
        <header class="td-picker-head">
          <h2 id="td-picker-title" class="td-picker-title">工具集</h2>
          <button type="button" class="td-picker-close" aria-label="关闭" @click="emit('close')">
            ×
          </button>
        </header>

        <div class="td-picker-actions">
          <button type="button" class="td-btn td-btn--primary td-picker-add-btn" @click="emit('start-add')">
            新增
          </button>
        </div>

        <div v-if="addMode" class="td-picker-add-form">
          <label class="td-picker-add-label" for="td-picker-new-name">新工具名称</label>
          <input
            id="td-picker-new-name"
            :value="newToolName"
            type="text"
            class="td-picker-add-input"
            placeholder="输入工具名称…"
            maxlength="80"
            @input="emit('update:newToolName', ($event.target as HTMLInputElement).value)"
            @keydown.enter.prevent="emit('confirm-add')"
          />
          <div class="td-picker-add-foot">
            <button type="button" class="td-btn td-btn--ghost" @click="emit('cancel-add')">取消</button>
            <button type="button" class="td-btn td-btn--primary" @click="emit('confirm-add')">确定</button>
          </div>
        </div>

        <p v-if="errorText" class="td-picker-error" role="alert">{{ errorText }}</p>

        <ul v-if="tools.length" class="td-picker-list" role="listbox" aria-label="工具列表">
          <li v-for="t in tools" :key="t.id" role="presentation">
            <button
              type="button"
              role="option"
              class="td-picker-item"
              :class="{ 'td-picker-item--on': t.id === activeToolId }"
              :aria-selected="t.id === activeToolId"
              @click="emit('select', t)"
            >
              <span class="td-picker-item-name">{{ t.name }}</span>
              <span v-if="t.id === activeToolId" class="td-picker-item-mark" aria-hidden="true">当前</span>
            </button>
          </li>
        </ul>
        <p v-else class="td-picker-empty">暂无工具，请点击「新增」创建。</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.td-picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.45);
}

.td-picker-dialog {
  width: min(420px, 100%);
  max-height: min(70vh, 520px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.td-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.td-picker-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.td-picker-close {
  border: none;
  background: transparent;
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  color: #64748b;
  padding: 0.15rem 0.35rem;
  border-radius: 6px;
}

.td-picker-close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.td-picker-actions {
  padding: 0.65rem 1rem 0.35rem;
}

.td-picker-add-btn {
  width: 100%;
}

.td-picker-add-form {
  padding: 0.35rem 1rem 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.td-picker-add-label {
  font-size: 0.8rem;
  color: #64748b;
}

.td-picker-add-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  font-size: 0.9rem;
}

.td-picker-add-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.td-picker-error {
  margin: 0 1rem 0.35rem;
  font-size: 0.82rem;
  color: #b91c1c;
}

.td-picker-list {
  list-style: none;
  margin: 0;
  padding: 0.35rem 0.5rem 0.75rem;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
}

.td-picker-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.65rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  text-align: left;
  color: #0f172a;
}

.td-picker-item:hover {
  background: #f1f5f9;
}

.td-picker-item--on {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 600;
}

.td-picker-item-mark {
  font-size: 0.72rem;
  font-weight: 600;
  color: #2563eb;
}

.td-picker-empty {
  margin: 0;
  padding: 0.75rem 1rem 1rem;
  font-size: 0.85rem;
  color: #64748b;
}

/* 与 ToolDetailPage 按钮样式一致（弹层 Teleport 到 body，须局部复刻） */
.td-btn {
  font-family: inherit;
  font-size: 0.9rem;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  padding: 0.45rem 0.9rem;
}

.td-btn--ghost {
  color: #2563eb;
  background: #fff;
  border-color: #2563eb;
}

.td-btn--primary {
  color: #fff;
  background: #2563eb;
  border-color: #2563eb;
}
</style>
