<!--
  [INPUT]: 工具知识集（特征轴：一级键 → 二级工具 → 三级取值）
  [OUTPUT]: 工作画布「特征」子 Tab 可折叠目录树
  [POS]: `ToolDetailPage.vue` 工作画布
-->
<script setup lang="ts">
import { ref, watch } from 'vue';
import type { ToolDetailValueLocator } from './tool-detail-knowledge-persist';
import ToolDetailValueLeafRow from './ToolDetailValueLeafRow.vue';
import type { ToolDetailWorkspaceFeatureNode } from './toolDetailL05Format';

const props = defineProps<{
  features: ToolDetailWorkspaceFeatureNode[];
}>();

const emit = defineEmits<{
  updateValue: [locator: ToolDetailValueLocator, newValue: string];
  deleteValue: [locator: ToolDetailValueLocator];
}>();

const expandedFeatures = ref<Record<string, boolean>>({});
const expandedTools = ref<Record<string, boolean>>({});

function toolExpandKey(featureKey: string, toolId: string): string {
  return `${featureKey}::${toolId}`;
}

function syncExpandState() {
  const fnext: Record<string, boolean> = { ...expandedFeatures.value };
  const tnext: Record<string, boolean> = { ...expandedTools.value };
  for (const feat of props.features) {
    if (fnext[feat.featureKey] === undefined) fnext[feat.featureKey] = true;
    for (const t of feat.tools) {
      const k = toolExpandKey(feat.featureKey, t.toolId);
      if (tnext[k] === undefined) tnext[k] = true;
    }
  }
  expandedFeatures.value = fnext;
  expandedTools.value = tnext;
}

watch(() => props.features, () => syncExpandState(), { immediate: true, deep: true });

function toggleFeature(featureKey: string) {
  expandedFeatures.value = {
    ...expandedFeatures.value,
    [featureKey]: !expandedFeatures.value[featureKey],
  };
}

function toggleTool(featureKey: string, toolId: string) {
  const k = toolExpandKey(featureKey, toolId);
  expandedTools.value = {
    ...expandedTools.value,
    [k]: !expandedTools.value[k],
  };
}
</script>

<template>
  <div class="td-feat-tree-panel">
    <ul class="td-feat-tree" role="tree" aria-label="特征轴目录树">
      <li
        v-for="feat in features"
        :key="feat.featureKey"
        class="td-feat-tree-node td-feat-tree-node--l1"
        role="treeitem"
        :aria-expanded="Boolean(expandedFeatures[feat.featureKey])"
      >
        <button type="button" class="td-feat-tree-row td-feat-tree-row--l1" @click="toggleFeature(feat.featureKey)">
          <span
            class="td-feat-tree-caret"
            :class="{ 'td-feat-tree-caret--open': expandedFeatures[feat.featureKey] }"
            aria-hidden="true"
            >▸</span
          >
          <span class="td-feat-tree-label">{{ feat.featureKey }}</span>
          <span class="td-feat-tree-badge">{{ feat.tools.length }}</span>
        </button>
        <ul v-show="expandedFeatures[feat.featureKey]" class="td-feat-tree-children" role="group">
          <li
            v-for="t in feat.tools"
            :key="`${feat.featureKey}-${t.toolId}`"
            class="td-feat-tree-node td-feat-tree-node--l2"
            role="treeitem"
            :aria-expanded="Boolean(expandedTools[toolExpandKey(feat.featureKey, t.toolId)])"
          >
            <button
              type="button"
              class="td-feat-tree-row td-feat-tree-row--l2"
              @click="toggleTool(feat.featureKey, t.toolId)"
            >
              <span
                class="td-feat-tree-caret"
                :class="{
                  'td-feat-tree-caret--open': expandedTools[toolExpandKey(feat.featureKey, t.toolId)],
                }"
                aria-hidden="true"
                >▸</span
              >
              <span class="td-feat-tree-label td-feat-tree-label--tool">{{ t.toolName }}</span>
              <span class="td-feat-tree-badge td-feat-tree-badge--muted">{{ t.values.length }}</span>
            </button>
            <ul
              v-show="expandedTools[toolExpandKey(feat.featureKey, t.toolId)]"
              class="td-feat-tree-children"
              role="group"
            >
              <li
                v-for="(v, vi) in t.values"
                :key="`${feat.featureKey}-${t.toolId}-${vi}-${v.value}`"
                class="td-feat-tree-node td-feat-tree-node--l3"
                role="treeitem"
              >
                <ToolDetailValueLeafRow
                  :locator="{ toolId: t.toolId, featureKey: feat.featureKey, valueIndex: vi }"
                  :value="v.value"
                  :feature-id="v.featureId"
                  @save="(loc, val) => emit('updateValue', loc, val)"
                  @delete="(loc) => emit('deleteValue', loc)"
                />
              </li>
            </ul>
          </li>
        </ul>
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

.td-feat-tree-row--l1 .td-feat-tree-label {
  font-weight: 700;
  font-size: 0.95rem;
  color: #6d28d9;
}

.td-feat-tree-row--l2 .td-feat-tree-label--tool {
  font-weight: 600;
  font-size: 0.88rem;
  color: #1e40af;
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
  color: #6d28d9;
  background: #ede9fe;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
}

.td-feat-tree-badge--muted {
  color: #2563eb;
  background: #dbeafe;
}

</style>
