<!--
  [INPUT]: 多工具 L0.5 提炼结果（每个工具一个一级节点）
  [OUTPUT]: 工作画布汇总目录树（一级工具名 → 二级特征键 → 三级取值）
  [POS]: `ToolDetailPage.vue` 工作画布
-->
<script setup lang="ts">
import { ref, watch } from 'vue';
import type { ToolDetailValueLocator } from './tool-detail-knowledge-persist';
import ToolDetailValueLeafRow from './ToolDetailValueLeafRow.vue';
import type { ToolDetailWorkspaceToolNode } from './toolDetailL05Format';

const props = defineProps<{
  tools: ToolDetailWorkspaceToolNode[];
}>();

const emit = defineEmits<{
  deleteTool: [toolId: string];
  updateValue: [locator: ToolDetailValueLocator, newValue: string];
  deleteValue: [locator: ToolDetailValueLocator];
}>();

const expandedTools = ref<Record<string, boolean>>({});
const expandedKeys = ref<Record<string, boolean>>({});

function featureExpandKey(toolId: string, featureKey: string): string {
  return `${toolId}::${featureKey}`;
}

function syncExpandState() {
  const tnext: Record<string, boolean> = { ...expandedTools.value };
  const knext: Record<string, boolean> = { ...expandedKeys.value };
  for (const tool of props.tools) {
    if (tnext[tool.toolId] === undefined) tnext[tool.toolId] = true;
    for (const g of tool.groups) {
      const k = featureExpandKey(tool.toolId, g.featureKey);
      if (knext[k] === undefined) knext[k] = true;
    }
  }
  expandedTools.value = tnext;
  expandedKeys.value = knext;
}

watch(() => props.tools, () => syncExpandState(), { immediate: true, deep: true });

function toggleTool(toolId: string) {
  expandedTools.value = {
    ...expandedTools.value,
    [toolId]: !expandedTools.value[toolId],
  };
}

function toggleFeature(toolId: string, featureKey: string) {
  const k = featureExpandKey(toolId, featureKey);
  expandedKeys.value = {
    ...expandedKeys.value,
    [k]: !expandedKeys.value[k],
  };
}

function requestDeleteTool(tool: ToolDetailWorkspaceToolNode) {
  const ok = window.confirm(
    `确认从工作画布移除「${tool.toolName}」的工具知识集？\n左侧该工具的聊天记录将保留，可再次添加并整合。`,
  );
  if (!ok) return;
  emit('deleteTool', tool.toolId);
}
</script>

<template>
  <div class="td-feat-tree-panel">
    <ul class="td-feat-tree" role="tree" aria-label="工具特征目录树">
      <li
        v-for="tool in tools"
        :key="tool.toolId"
        class="td-feat-tree-node td-feat-tree-node--l1"
        role="treeitem"
        :aria-expanded="Boolean(expandedTools[tool.toolId])"
      >
        <div class="td-feat-tree-row td-feat-tree-row--l1">
          <button type="button" class="td-feat-tree-row-main" @click="toggleTool(tool.toolId)">
            <span
              class="td-feat-tree-caret"
              :class="{ 'td-feat-tree-caret--open': expandedTools[tool.toolId] }"
              aria-hidden="true"
              >▸</span
            >
            <span class="td-feat-tree-label">{{ tool.toolName }}</span>
          </button>
          <button
            type="button"
            class="td-feat-tree-del"
            title="从工作画布移除此工具"
            aria-label="从工作画布移除此工具"
            @click="requestDeleteTool(tool)"
          >
            删除
          </button>
        </div>
        <ul v-show="expandedTools[tool.toolId]" class="td-feat-tree-children" role="group">
          <li
            v-for="g in tool.groups"
            :key="`${tool.toolId}-${g.featureKey}`"
            class="td-feat-tree-node td-feat-tree-node--l2"
            role="treeitem"
            :aria-expanded="Boolean(expandedKeys[featureExpandKey(tool.toolId, g.featureKey)])"
          >
            <button
              type="button"
              class="td-feat-tree-row td-feat-tree-row--l2"
              @click="toggleFeature(tool.toolId, g.featureKey)"
            >
              <span
                class="td-feat-tree-caret"
                :class="{
                  'td-feat-tree-caret--open': expandedKeys[featureExpandKey(tool.toolId, g.featureKey)],
                }"
                aria-hidden="true"
                >▸</span
              >
              <span class="td-feat-tree-label">{{ g.featureKey }}</span>
              <span class="td-feat-tree-badge">{{ g.values.length }}</span>
            </button>
            <ul
              v-show="expandedKeys[featureExpandKey(tool.toolId, g.featureKey)]"
              class="td-feat-tree-children"
              role="group"
            >
              <li
                v-for="(v, vi) in g.values"
                :key="`${tool.toolId}-${g.featureKey}-${vi}-${v.value}`"
                class="td-feat-tree-node td-feat-tree-node--l3"
                role="treeitem"
              >
                <ToolDetailValueLeafRow
                  :locator="{ toolId: tool.toolId, featureKey: g.featureKey, valueIndex: vi }"
                  :value="v.value"
                  :feature-id="v.featureId"
                  @save="(loc, val) => emit('updateValue', loc, val)"
                  @delete="(loc) => emit('deleteValue', loc)"
                />
              </li>
            </ul>
          </li>
        </ul>
        <p v-if="tool.summary" class="td-feat-tree-tool-summary">{{ tool.summary }}</p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.td-feat-tree-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.td-feat-tree {
  list-style: none;
  margin: 0;
  padding: 0.5rem 0.65rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.td-feat-tree-node--l1 + .td-feat-tree-node--l1 {
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid #e2e8f0;
}

.td-feat-tree-children {
  list-style: none;
  margin: 0;
  padding: 0.15rem 0 0.25rem 1.15rem;
  border-left: 1px dashed #cbd5e1;
}

.td-feat-tree-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  padding: 0.35rem 0.25rem;
  border-radius: 6px;
  box-sizing: border-box;
}

.td-feat-tree-row:hover {
  background: #f1f5f9;
}

.td-feat-tree-row--l1 {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0.25rem;
  cursor: default;
}

.td-feat-tree-row--l1:hover {
  background: transparent;
}

.td-feat-tree-row-main {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
  min-width: 0;
  text-align: left;
  border: none;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  padding: 0.2rem 0.15rem;
  border-radius: 6px;
}

.td-feat-tree-row-main:hover {
  background: #f1f5f9;
}

.td-feat-tree-row--l1 .td-feat-tree-label {
  font-weight: 700;
  font-size: 0.95rem;
  color: #1e40af;
}

.td-feat-tree-del {
  flex-shrink: 0;
  border: 1px solid #fecaca;
  background: #fff;
  color: #b91c1c;
  font-size: 0.72rem;
  font-family: inherit;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
  cursor: pointer;
  line-height: 1.3;
}

.td-feat-tree-del:hover {
  background: #fef2f2;
  border-color: #f87171;
}

.td-feat-tree-row--l2 .td-feat-tree-label {
  font-weight: 600;
  font-size: 0.88rem;
  color: #0f172a;
}

.td-feat-tree-caret {
  flex-shrink: 0;
  display: inline-block;
  width: 0.85rem;
  font-size: 0.75rem;
  color: #64748b;
  transition: transform 0.15s ease;
}

.td-feat-tree-caret--open {
  transform: rotate(90deg);
}

.td-feat-tree-badge {
  flex-shrink: 0;
  font-size: 0.72rem;
  font-weight: 600;
  color: #2563eb;
  background: #dbeafe;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
}

.td-feat-tree-tool-summary {
  margin: 0.35rem 0 0 1.15rem;
  padding-left: 0.65rem;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #64748b;
  border-left: 1px dashed #e2e8f0;
}
</style>
