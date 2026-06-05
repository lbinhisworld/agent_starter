<!--
  [INPUT]: DataArchDesignLogic
  [OUTPUT]: 「设计逻辑」子卡（需求背景 + 架构推理 + 证据链要点）
  [POS]: DesignDetailDataArchitectureTab 内嵌
  [PROTOCOL]: 文案来自 buildDataArchitectureFromTaskGraph 之 inference_summary / Evidence_Support_Chain
-->
<script setup lang="ts">
import type { DataArchDesignLogic } from './buildDataArchitectureFromTaskGraph';

defineProps<{
  logic: DataArchDesignLogic;
}>();
</script>

<template>
  <article class="dd-data-arch-design-logic">
    <header class="dd-data-arch-design-logic-head">
      <span class="dd-data-arch-design-logic-badge">设计逻辑</span>
      <span class="dd-data-arch-design-logic-hint">客户需求与架构推理说明</span>
    </header>
    <p
      v-for="(para, pi) in logic.paragraphs"
      :key="'p-' + pi"
      class="dd-data-arch-design-logic-p"
    >
      {{ para }}
    </p>
    <section v-if="logic.evidenceBullets.length" class="dd-data-arch-design-logic-evidence-wrap">
      <h6 class="dd-data-arch-design-logic-evidence-title">证据链要点</h6>
      <ul class="dd-data-arch-design-logic-evidence">
        <li v-for="(line, ei) in logic.evidenceBullets" :key="'e-' + ei">{{ line }}</li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
.dd-data-arch-design-logic {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px dashed #94a3b8;
  border-radius: 10px;
  background: linear-gradient(180deg, #fffbeb 0%, #fff 72%);
}

.dd-data-arch-design-logic-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.dd-data-arch-design-logic-badge {
  font-size: 11px;
  font-weight: 700;
  color: #92400e;
  background: #fde68a;
  border-radius: 999px;
  padding: 2px 8px;
}

.dd-data-arch-design-logic-hint {
  font-size: 11px;
  color: #78716c;
}

.dd-data-arch-design-logic-p {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.55;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
}

.dd-data-arch-design-logic-p:last-of-type {
  margin-bottom: 0;
}

.dd-data-arch-design-logic-evidence-wrap {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #fde68a;
}

.dd-data-arch-design-logic-evidence-title {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  color: #b45309;
}

.dd-data-arch-design-logic-evidence {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 11px;
  line-height: 1.5;
  color: #475569;
}

.dd-data-arch-design-logic-evidence li + li {
  margin-top: 4px;
}
</style>
