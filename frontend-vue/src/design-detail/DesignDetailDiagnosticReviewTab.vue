<script setup lang="ts">
/**
 * [INPUT]: 任务 6.5 各流程环节 IT-Gap 推理结果（按 progressLabel 覆盖）
 * [OUTPUT]: 「诊断梳理」目录树：价值流阶段 → 流程环节 → Gap 类型 → 观察/建议（末级圆角卡片）
 * [POS]: 任务 6.5 推理开始后出现在「现状理解」右侧
 */
import { computed } from 'vue';
import {
  buildDiagnosticReviewPhaseColumns,
  DIAGNOSTIC_REVIEW_GAP_KIND_LABELS,
  diagnosticReviewStepsRecordToList,
  getDiagnosticReviewGapPairForStep,
  getVisibleDiagnosticReviewGapKindsForStep,
  stepHasRenderableDiagnosticReviewGap,
  type DiagnosticReviewGapKind,
  type DiagnosticReviewStepCard,
} from './buildDiagnosticReviewFromTask65ItGap';

const props = defineProps<{
  stepCards: Readonly<Record<string, DiagnosticReviewStepCard>>;
  refreshTick: number;
  panelActive: boolean;
}>();

void props.refreshTick;
void props.panelActive;

const phaseColumns = computed(() =>
  buildDiagnosticReviewPhaseColumns(diagnosticReviewStepsRecordToList(props.stepCards)),
);

const hasContent = computed(() =>
  phaseColumns.value.some((p) => p.steps.some((s) => stepHasRenderableDiagnosticReviewGap(s))),
);

function visibleGapKinds(step: DiagnosticReviewStepCard): DiagnosticReviewGapKind[] {
  return getVisibleDiagnosticReviewGapKindsForStep(step);
}

function gapKindLabel(kind: DiagnosticReviewGapKind): string {
  return DIAGNOSTIC_REVIEW_GAP_KIND_LABELS[kind];
}

function gapKindThemeClass(kind: DiagnosticReviewGapKind): string {
  return `dd-drv-tree-node--gap-${kind}`;
}
</script>

<template>
  <section class="dd-drv-root" aria-label="诊断梳理">
    <header class="dd-drv-toolbar">
      <span class="dd-drv-toolbar-title">诊断梳理</span>
      <span class="dd-drv-toolbar-hint">
        任务 6.5 三维 IT-Gap · 目录树（Gap 观察为「暂无」的维度不展示）
      </span>
    </header>

    <div v-if="!hasContent" class="dd-drv-state">
      任务 6.5 推理进行中：每完成一个「价值流阶段-流程环节」的 IT-Gap 分析，将在此追加对应树节点。
    </div>

    <ul v-else class="dd-drv-tree" role="tree" aria-label="IT-Gap 诊断目录树">
      <li
        v-for="phase in phaseColumns"
        :key="phase.id"
        class="dd-drv-tree-node dd-drv-tree-node--l1"
        role="treeitem"
        aria-expanded="true"
      >
        <details class="dd-drv-tree-details" open>
          <summary class="dd-drv-tree-row dd-drv-tree-row--l1">
            <span class="dd-drv-tree-caret" aria-hidden="true" />
            <span class="dd-drv-tree-kind">价值流阶段</span>
            <span class="dd-drv-tree-name">{{ phase.phaseName }}</span>
            <span class="dd-drv-tree-badge">{{ phase.steps.length }} 个环节</span>
          </summary>

          <ul class="dd-drv-tree-children" role="group">
            <li
              v-for="step in phase.steps"
              :key="step.progressLabel"
              class="dd-drv-tree-node dd-drv-tree-node--l2"
              role="treeitem"
              aria-expanded="true"
            >
              <details class="dd-drv-tree-details" open>
                <summary class="dd-drv-tree-row dd-drv-tree-row--l2">
                  <span class="dd-drv-tree-caret" aria-hidden="true" />
                  <span class="dd-drv-tree-kind">流程环节</span>
                  <span class="dd-drv-tree-name">{{ step.stepName || step.progressLabel }}</span>
                  <span v-if="step.workflowName" class="dd-drv-tree-meta">{{ step.workflowName }}</span>
                </summary>

                <div class="dd-drv-tree-panel">
                  <p v-if="step.optimizedWorkflowSegment" class="dd-drv-step-segment">
                    {{ step.optimizedWorkflowSegment }}
                  </p>

                  <template v-if="visibleGapKinds(step).length">
                    <ul class="dd-drv-tree-children dd-drv-tree-children--gaps" role="group">
                      <li
                        v-for="kind in visibleGapKinds(step)"
                        :key="`${step.progressLabel}-${kind}`"
                        class="dd-drv-tree-node dd-drv-tree-node--l3"
                        :class="gapKindThemeClass(kind)"
                        role="treeitem"
                        aria-expanded="true"
                      >
                        <details class="dd-drv-tree-details" open>
                          <summary class="dd-drv-tree-row dd-drv-tree-row--l3">
                            <span class="dd-drv-tree-caret" aria-hidden="true" />
                            <span class="dd-drv-tree-dot" aria-hidden="true" />
                            <span class="dd-drv-tree-kind">Gap 类型</span>
                            <span class="dd-drv-tree-name">{{ gapKindLabel(kind) }}</span>
                          </summary>

                          <div class="dd-drv-tree-leaves">
                            <section class="dd-drv-gap-detail">
                              <h6 class="dd-drv-gap-detail-title">Gap 观察</h6>
                              <p class="dd-drv-gap-detail-text">
                                {{ getDiagnosticReviewGapPairForStep(step, kind).gapObservation.trim() }}
                              </p>
                            </section>
                            <section
                              v-if="getDiagnosticReviewGapPairForStep(step, kind).solutionProposal.trim()"
                              class="dd-drv-gap-detail"
                            >
                              <h6 class="dd-drv-gap-detail-title">解决方案建议</h6>
                              <p class="dd-drv-gap-detail-text">
                                {{ getDiagnosticReviewGapPairForStep(step, kind).solutionProposal.trim() }}
                              </p>
                            </section>
                          </div>
                        </details>
                      </li>
                    </ul>
                  </template>
                  <p v-else class="dd-drv-empty">（本环节三向 Gap 均为「暂无」，不展示）</p>

                  <p v-if="step.inferenceSummary" class="dd-drv-inference-summary">
                    {{ step.inferenceSummary }}
                  </p>
                </div>
              </details>
            </li>
          </ul>
        </details>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.dd-drv-root {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}

.dd-drv-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 1rem;
  padding: 0 0.15rem;
}

.dd-drv-toolbar-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
}

.dd-drv-toolbar-hint {
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.45;
}

.dd-drv-state {
  margin: 0;
  padding: 1rem 1.1rem;
  font-size: 0.84rem;
  color: #64748b;
  line-height: 1.55;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
}

/* —— 目录树 —— */
.dd-drv-tree,
.dd-drv-tree-children {
  list-style: none;
  margin: 0;
  padding: 0;
}

.dd-drv-tree {
  padding: 0.25rem 0 2rem;
}

.dd-drv-tree-children {
  margin-left: 0.65rem;
  padding-left: 0.85rem;
  border-left: 1px solid #cbd5e1;
}

.dd-drv-tree-children--gaps {
  margin-top: 0.35rem;
}

.dd-drv-tree-node {
  position: relative;
}

.dd-drv-tree-node + .dd-drv-tree-node {
  margin-top: 0.15rem;
}

.dd-drv-tree-details {
  min-width: 0;
}

.dd-drv-tree-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.55rem;
  padding: 0.42rem 0.35rem 0.42rem 0.15rem;
  cursor: pointer;
  list-style: none;
  user-select: none;
  border-radius: 6px;
  transition: background 0.12s ease;
}

.dd-drv-tree-row:hover {
  background: rgba(241, 245, 249, 0.9);
}

.dd-drv-tree-row::-webkit-details-marker {
  display: none;
}

.dd-drv-tree-caret {
  flex-shrink: 0;
  width: 0.55rem;
  height: 0.55rem;
  margin-right: 0.1rem;
  border-right: 2px solid #64748b;
  border-bottom: 2px solid #64748b;
  transform: rotate(-45deg);
  transition: transform 0.15s ease;
  align-self: center;
}

.dd-drv-tree-details[open] > .dd-drv-tree-row .dd-drv-tree-caret {
  transform: rotate(45deg);
}

.dd-drv-tree-kind {
  font-size: 0.68rem;
  font-weight: 600;
  color: #94a3b8;
  flex-shrink: 0;
}

.dd-drv-tree-name {
  font-weight: 600;
  color: #0f172a;
}

.dd-drv-tree-row--l1 .dd-drv-tree-name {
  font-size: 0.92rem;
  font-weight: 700;
}

.dd-drv-tree-row--l2 .dd-drv-tree-name {
  font-size: 0.86rem;
}

.dd-drv-tree-row--l3 .dd-drv-tree-name {
  font-size: 0.82rem;
}

.dd-drv-tree-meta {
  font-size: 0.76rem;
  color: #64748b;
}

.dd-drv-tree-badge {
  margin-left: auto;
  font-size: 0.72rem;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 999px;
  padding: 0.08rem 0.5rem;
}

.dd-drv-tree-panel {
  padding: 0.2rem 0 0.35rem 1.35rem;
}

.dd-drv-tree-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
  flex-shrink: 0;
}

/* Gap 类型：树节点色点 + 末级卡片边框色 */
.dd-drv-tree-node--gap-interaction .dd-drv-tree-dot {
  background: #3b82f6;
}

.dd-drv-tree-node--gap-interaction .dd-drv-tree-row--l3 .dd-drv-tree-kind {
  color: #2563eb;
}

.dd-drv-tree-node--gap-interaction .dd-drv-tree-row--l3 .dd-drv-tree-name {
  color: #1e40af;
}

.dd-drv-tree-node--gap-interaction .dd-drv-gap-detail {
  border-color: #bfdbfe;
  background: #f8fbff;
}

.dd-drv-tree-node--gap-interaction .dd-drv-gap-detail-title {
  color: #1d4ed8;
}

.dd-drv-tree-node--gap-data .dd-drv-tree-dot {
  background: #f59e0b;
}

.dd-drv-tree-node--gap-data .dd-drv-tree-row--l3 .dd-drv-tree-kind {
  color: #d97706;
}

.dd-drv-tree-node--gap-data .dd-drv-tree-row--l3 .dd-drv-tree-name {
  color: #b45309;
}

.dd-drv-tree-node--gap-data .dd-drv-gap-detail {
  border-color: #fde68a;
  background: #fffdf7;
}

.dd-drv-tree-node--gap-data .dd-drv-gap-detail-title {
  color: #b45309;
}

.dd-drv-tree-node--gap-calculation .dd-drv-tree-dot {
  background: #8b5cf6;
}

.dd-drv-tree-node--gap-calculation .dd-drv-tree-row--l3 .dd-drv-tree-kind {
  color: #7c3aed;
}

.dd-drv-tree-node--gap-calculation .dd-drv-tree-row--l3 .dd-drv-tree-name {
  color: #6d28d9;
}

.dd-drv-tree-node--gap-calculation .dd-drv-gap-detail {
  border-color: #ddd6fe;
  background: #faf8ff;
}

.dd-drv-tree-node--gap-calculation .dd-drv-gap-detail-title {
  color: #6d28d9;
}

/* 末级：Gap 观察 / 解决方案建议 — 圆角矩形卡片 */
.dd-drv-tree-leaves {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0.35rem 0 0.5rem 1.1rem;
  padding-left: 0.75rem;
  border-left: 1px dashed #e2e8f0;
}

.dd-drv-gap-detail {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

.dd-drv-gap-detail-title {
  margin: 0 0 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #475569;
}

.dd-drv-gap-detail-text {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.55;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
}

.dd-drv-step-segment {
  margin: 0 0 0.35rem;
  padding: 0 0.1rem;
  font-size: 0.74rem;
  color: #94a3b8;
  line-height: 1.45;
}

.dd-drv-inference-summary {
  margin: 0.35rem 0 0;
  padding: 0.5rem 0.6rem;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 0.72rem;
  line-height: 1.5;
  color: #64748b;
}

.dd-drv-empty {
  margin: 0.15rem 0 0.25rem 1.35rem;
  font-size: 0.78rem;
  color: #94a3b8;
}
</style>
