<!--
  [INPUT]: caseId、architectureInventoryGraphRefreshTick
  [OUTPUT]: 架构清单画布：设计报告 / 业务流程 / 功能清单 / ER 图 子 Tab
  [POS]: 设计详情工作画布「架构清单」主 Tab
  [PROTOCOL]: 功能清单承载原数据架构内容；变更时同步 AGENTS.md
-->
<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  ARCHITECTURE_INVENTORY_SUB_TABS,
  DEFAULT_ARCHITECTURE_INVENTORY_SUB_TAB,
  type ArchitectureInventorySubTabKey,
} from './architectureInventoryCanvas';
import DesignDetailDataArchitectureTab from './DesignDetailDataArchitectureTab.vue';
import DesignDetailErDiagramTab from './DesignDetailErDiagramTab.vue';
import DesignDetailDesignReportTab from './DesignDetailDesignReportTab.vue';

const props = defineProps<{
  caseId: string;
  customerName?: string;
  refreshTick: number;
  designReportContentTick?: number;
  designReportSubtabFocusTick?: number;
  businessProcessSubtabFocusTick?: number;
  functionInventorySubtabFocusTick?: number;
}>();

const activeSubTab = ref<ArchitectureInventorySubTabKey>(DEFAULT_ARCHITECTURE_INVENTORY_SUB_TAB);

watch(
  () => props.designReportSubtabFocusTick ?? 0,
  (n) => {
    if (n > 0) activeSubTab.value = 'design_report';
  },
);

watch(
  () => props.businessProcessSubtabFocusTick ?? 0,
  (n) => {
    if (n > 0) activeSubTab.value = 'business_process';
  },
);

watch(
  () => props.functionInventorySubtabFocusTick ?? 0,
  (n) => {
    if (n > 0) activeSubTab.value = 'function_inventory';
  },
);
</script>

<template>
  <section class="dd-arch-inv-root" aria-label="架构清单">
    <header v-if="activeSubTab !== 'design_report'" class="dd-arch-inv-toolbar">
      <span class="dd-arch-inv-toolbar-title">架构清单</span>
      <span class="dd-arch-inv-toolbar-hint">设计报告 · 业务流程 · 功能清单 · ER 图（任务 10）</span>
    </header>

    <div class="dd-arch-inv-subtabs" role="tablist" aria-label="架构清单子页面">
      <button
        v-for="sub in ARCHITECTURE_INVENTORY_SUB_TABS"
        :key="sub.key"
        type="button"
        role="tab"
        class="dd-arch-inv-subtab"
        :class="{ 'dd-arch-inv-subtab--on': activeSubTab === sub.key }"
        :aria-selected="activeSubTab === sub.key"
        @click="activeSubTab = sub.key"
      >
        {{ sub.label }}
      </button>
    </div>

    <div class="dd-arch-inv-subpanel">
      <div
        v-show="activeSubTab === 'design_report'"
        class="dd-arch-inv-pane"
        role="tabpanel"
        aria-label="设计报告"
      >
        <DesignDetailDesignReportTab
          :case-id="caseId"
          :customer-name="customerName"
          :refresh-tick="refreshTick"
          :content-tick="designReportContentTick ?? 0"
        />
      </div>

      <div
        v-show="activeSubTab === 'business_process'"
        class="dd-arch-inv-pane"
        role="tabpanel"
        aria-label="业务流程"
      >
        <div class="dd-arch-inv-placeholder">
          <p class="dd-arch-inv-placeholder-title">业务流程</p>
          <p class="dd-arch-inv-placeholder-desc">
            将展示任务 7 协作流程与关键业务动作在架构侧的挂接视图。内容待后续版本接入 task-graph 流程节点。
          </p>
        </div>
      </div>

      <div
        v-show="activeSubTab === 'function_inventory'"
        class="dd-arch-inv-pane dd-arch-inv-pane--function"
        role="tabpanel"
        aria-label="功能清单"
      >
        <DesignDetailDataArchitectureTab :case-id="caseId" :refresh-tick="refreshTick" />
      </div>

      <div
        v-show="activeSubTab === 'er_diagram'"
        class="dd-arch-inv-pane dd-arch-inv-pane--er"
        role="tabpanel"
        aria-label="ER 图"
      >
        <DesignDetailErDiagramTab :case-id="caseId" :refresh-tick="refreshTick" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.dd-arch-inv-root {
  display: flex;
  flex-direction: column;
  min-height: 420px;
  height: 100%;
}

.dd-arch-inv-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
}

.dd-arch-inv-toolbar-title {
  font-weight: 600;
  color: #0f172a;
}

.dd-arch-inv-toolbar-hint {
  flex: 1;
  font-size: 12px;
  color: #64748b;
}

.dd-arch-inv-subtabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 14px 0;
  flex-shrink: 0;
}

.dd-arch-inv-subtab {
  border: 1px solid #cbd5e1;
  border-radius: 8px 8px 0 0;
  background: #f1f5f9;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  cursor: pointer;
}

.dd-arch-inv-subtab--on {
  background: #fff;
  color: #1d4ed8;
  border-color: #93c5fd;
  border-bottom-color: #fff;
  margin-bottom: -1px;
  z-index: 1;
}

.dd-arch-inv-subpanel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid #e2e8f0;
  background: #fff;
}

.dd-arch-inv-pane {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.dd-arch-inv-pane--function :deep(.dd-data-arch-root) {
  height: 100%;
}

.dd-arch-inv-pane--function :deep(.dd-data-arch-toolbar) {
  display: none;
}

.dd-arch-inv-pane--er {
  padding: 0 14px 14px;
}

.dd-arch-inv-placeholder {
  padding: 32px 24px;
  max-width: 520px;
}

.dd-arch-inv-placeholder-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 700;
  color: #334155;
}

.dd-arch-inv-placeholder-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #64748b;
}
</style>
