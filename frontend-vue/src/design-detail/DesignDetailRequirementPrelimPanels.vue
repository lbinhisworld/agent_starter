<!--
  [INPUT]: `sectionKey`（与 `CUSTOMER_REQUIREMENT_CANVAS_FIELDS` 中除核心业务对象外的提炼维度）、`value`（JSON 片段）、可选 `coreEntities`（仅状态矩阵 entity 名归一）
  [OUTPUT]: 与详情页初步需求 **view** 同构的亮色卡片栈 HTML（经 `buildDesignDetailRequirementSectionHtml` + `v-html`）；**子区壳不用语义块 `max-height` 裁切，由页面滚动完整展示**
  [POS]: `DesignDetailPage` 需求提炼子 Tab 专用

  [PROTOCOL]: 结构真源与 `frontend/js/preliminaryRequirement.js` 对齐；区壳为 `dd-prelim-*`，痛点 / IT / 运营 / 管理资源 / 路线图 / 分析师备注等子卡与 **`DesignDetailRequirementCoreEntitiesPanel` 同构的 `dd-req-cbe-*`**（本文件非 scoped 下挂在 `.dd-prelim-root`）；**现有表格**：`dd-prelim-ess-*` 等宽纵向子卡、**绿色表名 + Excel 图标**（与逻辑树字段标签同源）；**痛点雷达**：`mergedPainPointRadarLayout` 仅合并需求卡启用（按 `dimension` 分类折叠 + 组内 4 列网格）；`DesignDetailPage` 须将 `existingSpreadsheets` 路由至本组件（勿走 `formatCustomerRequirementSubTabValue`）；变更时同步 `designDetailRequirementPrelimCanvasHtml.ts` 与本目录 `AGENTS.md`
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  buildDesignDetailRequirementSectionHtml,
  type BuildDesignDetailRequirementSectionOptions,
  type DesignDetailPrelimSectionKey,
} from './designDetailRequirementPrelimCanvasHtml';

/** 与 `useDesignDetailChat.ts` 中需求画布子 Tab 键一致（不含 `coreBusinessEntities`，该条由专用组件渲染） */
const DESIGN_DETAIL_PRELIM_SECTION_KEYS: ReadonlySet<string> = new Set([
  'businessContext',
  'stateTransitionMatrix',
  'painPointRadar',
  'itLandscape',
  'existingSpreadsheets',
  'operationModel',
  'managementResources',
  'roadmap',
]);

const props = defineProps<{
  /** 与 `CUSTOMER_REQUIREMENT_CANVAS_FIELDS[].key` 对齐（不含核心业务对象） */
  sectionKey: string;
  value: unknown;
  /** 与 `parsed.coreBusinessEntities` 同源，供状态矩阵 entity 展示名归一 */
  coreEntities?: unknown;
  /** 为真且为「痛点雷达」时：合并需求视图按痛点类别可折叠分组，组内一行 4 卡 */
  mergedPainPointRadarLayout?: boolean;
  /** 痛点雷达 Tab 顶部「核心痛点总结」正文 */
  corePainPointSummary?: string;
}>();

const html = computed(() => {
  const sk = props.sectionKey;
  if (!DESIGN_DETAIL_PRELIM_SECTION_KEYS.has(sk)) {
    return '<p class="dd-prelim-empty">—</p>';
  }
  const opts: BuildDesignDetailRequirementSectionOptions | undefined =
    sk === 'painPointRadar'
      ? {
          mergedPainPointRadarLayout: props.mergedPainPointRadarLayout === true,
          corePainPointSummary: String(props.corePainPointSummary ?? '').trim(),
        }
      : undefined;
  return buildDesignDetailRequirementSectionHtml(
    sk as DesignDetailPrelimSectionKey,
    props.value,
    props.coreEntities,
    opts,
  );
});
</script>

<template>
  <div class="dd-prelim-root" v-html="html" />
</template>

<style>
/* 非 scoped：v-html 子节点无 data-v-*，统一挂在 `.dd-prelim-root` 下避免污染全局 */
.dd-prelim-root {
  width: 100%;
  min-width: 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--dd-text, #0f172a);
}

.dd-prelim-empty {
  margin: 0;
  color: var(--dd-muted, #64748b);
  font-size: 0.84rem;
}

.dd-prelim-section-json {
  margin: 0;
  padding: 0.5rem 0.55rem;
  font-size: 0.78rem;
  line-height: 1.4;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #334155;
  background: #f8fafc;
  border: 1px solid var(--dd-border, #e2e8f0);
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: visible;
}

/* —— 与「核心业务对象」一致的子卡（v-html 无 scoped，须挂在 `.dd-prelim-root`） —— */
.dd-prelim-root .dd-prelim-req-card-stack {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  width: 100%;
  min-width: 0;
}

.dd-prelim-root .dd-req-cbe-cat {
  border-radius: 12px;
  border: 1px solid rgba(56, 189, 248, 0.35);
  background: rgba(255, 255, 255, 0.92);
  overflow: hidden;
  min-width: 0;
  width: 100%;
  max-width: min(100%, calc(52rem * 1.1 * 1.1));
  margin: 0 auto 0.85rem;
  box-sizing: border-box;
}

.dd-prelim-root .dd-req-cbe-cat:last-child {
  margin-bottom: 0;
}

.dd-prelim-root .dd-req-cbe-cat-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.65rem;
  background: rgba(56, 189, 248, 0.1);
  border-bottom: 1px solid rgba(56, 189, 248, 0.28);
  flex-wrap: wrap;
}

.dd-prelim-root .dd-req-cbe-cat-icon {
  font-size: 1.1rem;
  line-height: 1;
  flex-shrink: 0;
}

.dd-prelim-root .dd-req-cbe-cat-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0369a1;
  letter-spacing: 0.02em;
}

.dd-prelim-root .dd-req-cbe-cat-body {
  padding: 0.55rem 0.6rem 0.65rem;
  min-width: 0;
}

.dd-prelim-root .dd-req-cbe-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem 0.5rem;
  min-width: 0;
  width: 100%;
  align-items: stretch;
}

@media (max-width: 1200px) {
  .dd-prelim-root .dd-req-cbe-grid:not(.dd-prelim-fvs-domain-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 420px) {
  .dd-prelim-root .dd-req-cbe-grid:not(.dd-prelim-fvs-domain-grid) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.dd-prelim-root .dd-req-cbe-card {
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid rgba(245, 158, 11, 0.45);
  background: #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
  overflow: hidden;
  min-width: 0;
  width: 100%;
}

.dd-prelim-root .dd-req-cbe-card--raw {
  border-color: rgba(148, 163, 184, 0.55);
}

.dd-prelim-root .dd-req-cbe-card-head {
  flex-shrink: 0;
  padding: 0.45rem 0.6rem;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.35;
  color: #c2410c;
  background: rgba(245, 158, 11, 0.12);
  border-bottom: 1px solid rgba(245, 158, 11, 0.32);
  word-break: break-word;
}

.dd-prelim-root .dd-req-cbe-card-body {
  flex: 1 1 auto;
  min-height: auto;
  padding: 0.55rem 0.6rem 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dd-prelim-root .dd-req-cbe-card-body--raw {
  overflow: visible;
}

.dd-prelim-root .dd-req-cbe-nest {
  border-radius: 10px;
  border: 1px solid rgba(56, 189, 248, 0.28);
  background: rgba(248, 250, 252, 0.95);
  overflow: hidden;
  min-width: 0;
}

.dd-prelim-root .dd-req-cbe-nest-h {
  padding: 0.28rem 0.45rem;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.35;
  color: #0369a1;
  background: rgba(56, 189, 248, 0.08);
  border-bottom: 1px solid rgba(56, 189, 248, 0.2);
}

.dd-prelim-root .dd-req-cbe-nest-b {
  padding: 0.4rem 0.45rem 0.45rem;
  font-size: 0.76rem;
  line-height: 1.45;
  color: var(--dd-text, #0f172a);
  word-break: break-word;
}

.dd-prelim-root .dd-req-cbe-prewrap {
  white-space: pre-wrap;
}

.dd-prelim-root .dd-req-cbe-raw-pre {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.dd-prelim-root .dd-prelim-fvs-domain.dd-req-cbe-cat {
  flex-shrink: 0;
  max-width: 100%;
  margin-left: 0;
  margin-right: 0;
}

.dd-prelim-root .dd-prelim-om-stack .dd-prelim-fvs-stack .dd-req-cbe-cat {
  margin-left: 0;
  margin-right: 0;
}

.dd-prelim-root .dd-prelim-fvs-domain-head-count {
  margin-left: auto;
  font-size: 0.78rem;
  font-weight: 600;
  color: #0ea5e9;
}

.dd-prelim-root .dd-prelim-fvs-domain-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

@media (max-width: 1200px) {
  .dd-prelim-root .dd-prelim-fvs-domain-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .dd-prelim-root .dd-prelim-fvs-domain-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 420px) {
  .dd-prelim-root .dd-prelim-fvs-domain-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.dd-prelim-root .dd-prelim-pp-strip:not(.dd-prelim-pp-strip--org-roles) > .dd-req-cbe-card {
  flex: 1 1 14rem;
  min-width: 12rem;
  max-width: 100%;
}

/**
 * 痛点雷达：橙色标题栏与卡片内正文（`.dd-req-cbe-nest-b`）同字号/行高；统一高度约 3 行 + padding，多列顶对齐；
 * 超出 3 行省略（仅 `.dd-prelim-pp-strip` / 合并网格内）。
 */
.dd-prelim-root .dd-prelim-pp-strip:not(.dd-prelim-pp-strip--org-roles) > .dd-req-cbe-card > .dd-req-cbe-card-head,
.dd-prelim-root .dd-prelim-pp-merged-item-grid > .dd-req-cbe-card > .dd-req-cbe-card-head {
  box-sizing: border-box;
  font-size: 0.76rem;
  line-height: 1.45;
  font-weight: 400;
  height: calc(0.45rem * 2 + 0.76rem * 1.45 * 3);
  min-height: calc(0.45rem * 2 + 0.76rem * 1.45 * 3);
  max-height: calc(0.45rem * 2 + 0.76rem * 1.45 * 3);
  padding: 0.45rem 0.6rem;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  word-break: break-word;
}

/* —— 痛点雷达：「痛点表现」内嵌「IT 缺口」子卡 + 缺口正文红色 —— */
.dd-prelim-root .dd-prelim-pp-manifest-nest .dd-prelim-pp-desc {
  margin-bottom: 0.35rem;
}

.dd-prelim-root .dd-prelim-pp-itgap-subcard {
  margin-top: 0.25rem;
  border-radius: 8px;
  border: 1px solid rgba(248, 113, 113, 0.5);
  background: rgba(254, 242, 242, 0.88);
  overflow: hidden;
  min-width: 0;
}

.dd-prelim-root .dd-prelim-pp-itgap-subcard-h {
  padding: 0.24rem 0.42rem;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.35;
  color: #b91c1c;
  background: rgba(254, 226, 226, 0.7);
  border-bottom: 1px solid rgba(248, 113, 113, 0.32);
}

.dd-prelim-root .dd-prelim-pp-itgap-subcard-b {
  padding: 0.38rem 0.42rem 0.42rem;
  font-size: 0.74rem;
  line-height: 1.45;
  color: #dc2626;
  word-break: break-word;
}

/* —— 合并需求 · 痛点雷达：按类别可折叠，组内 4 列网格 —— */
.dd-prelim-root .dd-prelim-pp-wrap--merged-categories {
  padding: 0.35rem 0.35rem 0.45rem;
}

.dd-prelim-root .dd-prelim-pp-cat-stack {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  min-width: 0;
}

.dd-prelim-root .dd-prelim-pp-cat-details {
  border-radius: 12px;
  border: 1px solid rgba(245, 158, 11, 0.5);
  background: #fffbeb;
  overflow: hidden;
  min-width: 0;
}

.dd-prelim-root .dd-prelim-pp-cat-summary {
  list-style: none;
  cursor: pointer;
  padding: 0.42rem 0.55rem;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.35;
  color: #c2410c;
  background: linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%);
  border-bottom: 1px solid rgba(245, 158, 11, 0.35);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  user-select: none;
}

.dd-prelim-root .dd-prelim-pp-cat-summary::-webkit-details-marker {
  display: none;
}

.dd-prelim-root .dd-prelim-pp-cat-chevron {
  display: inline-block;
  width: 0.45rem;
  height: 0.45rem;
  border-right: 2px solid #c2410c;
  border-bottom: 2px solid #c2410c;
  transform: rotate(-45deg);
  margin-top: -0.12rem;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.dd-prelim-root .dd-prelim-pp-cat-details[open] .dd-prelim-pp-cat-chevron {
  transform: rotate(45deg);
  margin-top: 0.05rem;
}

.dd-prelim-root .dd-prelim-pp-cat-title {
  min-width: 0;
  word-break: break-word;
}

.dd-prelim-root .dd-prelim-pp-merged-item-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
  padding: 0.5rem 0.55rem 0.6rem;
  background: rgba(255, 255, 255, 0.72);
  box-sizing: border-box;
}

@media (max-width: 1100px) {
  .dd-prelim-root .dd-prelim-pp-merged-item-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .dd-prelim-root .dd-prelim-pp-merged-item-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.dd-prelim-root .dd-prelim-pp-merged-grid-card {
  min-width: 0;
}

/* —— 商业背景 —— */
.dd-prelim-bc-tree {
  width: 100%;
  min-width: 0;
}

.dd-prelim-bc-fields {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.dd-prelim-bc-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0.6rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #fff;
}

.dd-prelim-bc-field-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #2563eb;
  letter-spacing: 0.02em;
}

.dd-prelim-bc-field-value {
  font-size: 0.875rem;
  color: #0f172a;
  word-break: break-word;
}

.dd-prelim-bc-field-pre {
  margin: 0;
  padding: 0.45rem 0.5rem;
  font-size: 0.78rem;
  line-height: 1.4;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #334155;
  background: #f1f5f9;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-all;
}

.dd-prelim-bc-subcard {
  border-radius: 10px;
  border: 1px solid rgba(37, 99, 235, 0.28);
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
}

.dd-prelim-bc-subcard-head {
  padding: 0.42rem 0.65rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #1d4ed8;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
  border-bottom: 1px solid rgba(37, 99, 235, 0.2);
}

.dd-prelim-bc-subcard-body {
  padding: 0.5rem 0.6rem 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.dd-prelim-bc-subcard-body--org-hstrip {
  padding: 0.45rem 0.5rem 0.5rem;
}

.dd-prelim-bc-nested-row {
  display: grid;
  grid-template-columns: minmax(4.75rem, 26%) minmax(0, 1fr);
  column-gap: 0.35rem;
  row-gap: 0.35rem;
  align-items: start;
  font-size: 0.84rem;
}

.dd-prelim-bc-nested-label {
  font-weight: 600;
  color: #64748b;
  word-break: break-word;
}

.dd-prelim-bc-nested-value {
  color: #0f172a;
  min-width: 0;
  word-break: break-word;
}

.dd-prelim-bc-inline-pre {
  margin: 0;
  padding: 0.35rem 0.45rem;
  font-size: 0.74rem;
  line-height: 1.35;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #475569;
  background: #f8fafc;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-all;
}

.dd-prelim-bc-nested-slot .dd-prelim-bc-subcard {
  margin-top: 0.12rem;
}

/* —— 痛点雷达顶部「核心痛点总结」 —— */
.dd-prelim-root .dd-prelim-pp-core-summary {
  margin: 0 0 0.65rem;
  padding: 0.65rem 0.75rem;
  border-radius: 12px;
  border: 1px solid rgba(248, 113, 113, 0.35);
  background: linear-gradient(180deg, rgba(254, 242, 242, 0.95), rgba(255, 255, 255, 0.98));
  box-sizing: border-box;
}

.dd-prelim-root .dd-prelim-pp-core-summary-h {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #b91c1c;
  margin-bottom: 0.35rem;
}

.dd-prelim-root .dd-prelim-pp-core-summary-b {
  font-size: 0.875rem;
  line-height: 1.55;
  color: #1e293b;
}

/* —— 痛点 / 组织拓扑横向卡 —— */
.dd-prelim-pp-wrap {
  margin: 0;
  padding: 0.45rem 0.4rem 0.5rem;
  overflow: visible;
  box-sizing: border-box;
}

.dd-prelim-pp-wrap--nested-in-bc {
  padding: 0.35rem 0.25rem;
}

.dd-prelim-pp-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: stretch;
}

.dd-prelim-pp-strip--org-equal > .dd-prelim-pp-card {
  flex: 1 1 12rem;
  min-width: 10rem;
}

.dd-prelim-pp-card {
  border-radius: 10px;
  border: 1px solid rgba(245, 158, 11, 0.55);
  background: #fffbeb;
  box-shadow: 0 2px 8px rgba(180, 83, 9, 0.08);
  overflow: hidden;
  min-width: 0;
  flex: 0 1 auto;
}

.dd-prelim-pp-card--org-topo {
  border-color: rgba(251, 191, 36, 0.65);
  background: #fffbeb;
}

.dd-prelim-pp-card--raw {
  border-color: #94a3b8;
  background: #f8fafc;
}

.dd-prelim-pp-card-head {
  padding: 0.38rem 0.55rem;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.35;
  color: #c2410c;
  background: linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%);
  border-bottom: 1px solid rgba(245, 158, 11, 0.35);
  word-break: break-word;
}

.dd-prelim-pp-card-body {
  padding: 0.45rem 0.55rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.dd-prelim-pp-card-body--scalar {
  padding: 0.4rem 0.5rem;
}

.dd-prelim-pp-row {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  font-size: 0.8rem;
}

.dd-prelim-pp-row-label {
  flex: 0 0 5.5rem;
  font-weight: 600;
  color: #64748b;
}

.dd-prelim-pp-row-value {
  flex: 1;
  min-width: 0;
  color: #0f172a;
  word-break: break-word;
}

.dd-prelim-pp-row-value--block {
  display: block;
  white-space: normal;
}

.dd-prelim-pp-strip--org-roles {
  flex-wrap: wrap;
  min-width: 0;
  width: 100%;
}

.dd-prelim-pp-strip--org-roles > .dd-req-cbe-card {
  flex: 1 1 14rem;
  min-width: 12rem;
  max-width: 100%;
}

.dd-prelim-org-stakeholder-value {
  font-size: 0.8rem;
  line-height: 1.45;
}

.dd-prelim-pp-pre {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.4;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-all;
  color: #475569;
}

/* —— 状态转移矩阵 —— */
.dd-prelim-stm-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.55rem;
  width: 100%;
  min-width: 0;
}

.dd-prelim-stm-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0.4rem;
  width: 100%;
  min-width: 0;
}

.dd-prelim-stm-row-index {
  flex: 0 0 auto;
  min-width: 1.25rem;
  margin-top: 0.35rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #94a3b8;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.dd-prelim-stm-entity-details {
  flex: 1 1 auto;
  min-width: 0;
  border-radius: 10px;
  border: 1px solid rgba(14, 165, 233, 0.35);
  background: #fff;
  box-shadow: 0 1px 3px rgba(14, 165, 233, 0.08);
  overflow: hidden;
}

.dd-prelim-stm-entity-summary {
  list-style: none;
  cursor: pointer;
  padding: 0.4rem 0.55rem;
  user-select: none;
}

.dd-prelim-stm-entity-summary::-webkit-details-marker,
.dd-prelim-stm-entity-summary::marker {
  display: none;
}

.dd-prelim-stm-entity-summary-inner {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.dd-prelim-stm-entity-chevron {
  flex-shrink: 0;
  width: 0.42rem;
  height: 0.42rem;
  border-right: 2px solid #0ea5e9;
  border-bottom: 2px solid #0ea5e9;
  transform: rotate(-45deg);
  transition: transform 0.15s ease;
  margin-top: -0.08rem;
}

.dd-prelim-stm-entity-details[open] > .dd-prelim-stm-entity-summary .dd-prelim-stm-entity-chevron {
  transform: rotate(45deg);
  margin-top: 0.05rem;
}

.dd-prelim-stm-entity-summary-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: #0369a1;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dd-prelim-stm-entity-body {
  padding: 0 0.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  border-top: 1px solid rgba(14, 165, 233, 0.12);
}

.dd-prelim-stm-transition-list {
  display: flex;
  flex-direction: column;
  gap: 0.32rem;
}

.dd-prelim-stm-transition-item {
  padding: 0.32rem 0.42rem;
  border-radius: 6px;
  background: #f0f9ff;
  border: 1px solid rgba(14, 165, 233, 0.2);
}

.dd-prelim-stm-transition-main {
  font-size: 0.78rem;
  color: #0f172a;
  line-height: 1.4;
  word-break: break-word;
}

.dd-prelim-stm-transition-arrow {
  color: #0284c7;
  margin: 0 0.12rem;
}

.dd-prelim-stm-transition-meta {
  font-size: 0.72rem;
  color: #64748b;
  margin-top: 0.2rem;
  line-height: 1.35;
  word-break: break-word;
}

.dd-prelim-stm-transition-idx {
  color: #94a3b8;
  font-weight: 600;
  margin-right: 0.1rem;
}

.dd-prelim-stm-card {
  border-radius: 8px;
  border: 1px solid rgba(14, 165, 233, 0.3);
  background: #f8fafc;
  overflow: hidden;
}

.dd-prelim-stm-card-head {
  padding: 0.32rem 0.45rem;
  border-bottom: 1px solid rgba(14, 165, 233, 0.15);
  background: linear-gradient(180deg, #e0f2fe 0%, #f8fafc 100%);
}

.dd-prelim-stm-card-title {
  font-size: 0.76rem;
  font-weight: 600;
  color: #0369a1;
}

.dd-prelim-stm-subpanels {
  padding: 0.4rem 0.45rem 0.45rem;
}

.dd-prelim-stm-mermaid-src {
  margin: 0;
  padding: 0.4rem 0.45rem;
  font-size: 0.7rem;
  line-height: 1.35;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #475569;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: visible;
}

/* —— IT 现状与集成（纵向子卡 + 列表） —— */
.dd-prelim-it-stack {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin: 0;
  padding: 0.45rem 0.4rem 0.5rem;
  overflow: visible;
  box-sizing: border-box;
}

.dd-prelim-it-list {
  margin: 0;
  padding-left: 1.15rem;
  font-size: 0.82rem;
  line-height: 1.45;
  color: #0f172a;
}

.dd-prelim-it-list li {
  margin: 0.18rem 0;
  word-break: break-word;
}

.dd-prelim-it-list--empty {
  list-style: none;
  padding-left: 0;
  color: #64748b;
}

.dd-prelim-it-li-pre {
  margin: 0;
  padding: 0.32rem 0.4rem;
  font-size: 0.72rem;
  line-height: 1.35;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #475569;
  background: #fff;
  border: 1px solid #fde68a;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-all;
}

/* —— 业务流程 fullValueStreams —— */
.dd-prelim-fvs-stack {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0.4rem 0.35rem 0.5rem;
  overflow-x: hidden;
  overflow-y: visible;
  box-sizing: border-box;
}

.dd-prelim-fvs-field-scalar {
  font-size: 0.8rem;
  line-height: 1.45;
  color: #0f172a;
  word-break: break-word;
}

.dd-prelim-fvs-field-empty {
  margin: 0;
  font-size: 0.78rem;
  color: #94a3b8;
}

.dd-prelim-fvs-json-pre {
  margin: 0;
  overflow: visible;
  font-size: 0.72rem;
  line-height: 1.35;
  word-break: break-word;
  white-space: pre-wrap;
}

/* —— 运营模式（人员组织 + 价值流等分块） —— */
.dd-prelim-om-stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
  min-width: 0;
}

/* —— 路线图 —— */
.dd-prelim-rm-stack {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.35rem 0.25rem 0.45rem;
  overflow: visible;
}

.dd-prelim-rm-del-list {
  margin: 0;
  padding-left: 1.1rem;
  line-height: 1.45;
  word-break: break-word;
}

/* —— 分析师备注 —— */
.dd-prelim-an-notes-wrap {
  padding: 0.3rem 0.25rem 0.4rem;
  overflow: visible;
}

.dd-prelim-an-notes-stack {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  width: 100%;
  min-width: 0;
}

.dd-prelim-an-note-empty {
  color: #94a3b8;
  font-size: 0.78rem;
}

.dd-prelim-an-note-pre {
  margin: 0;
  overflow: visible;
}

/* —— 现有表格：等宽纵向子卡 + 表头字段横向 pill —— */
.dd-prelim-root .dd-prelim-ess-stack {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.dd-prelim-root .dd-prelim-ess-table-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border-radius: 12px;
  border: 1px solid rgba(56, 189, 248, 0.38);
  background: #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.dd-prelim-root .dd-prelim-ess-table-card-head {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.65rem;
  background: rgba(34, 197, 94, 0.08);
  border-bottom: 1px solid rgba(34, 197, 94, 0.28);
  min-width: 0;
}

.dd-prelim-root .dd-prelim-ess-table-excel-icon {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  object-fit: contain;
  border-radius: 2px;
}

.dd-prelim-root .dd-prelim-ess-table-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.35;
  color: #15803d;
  word-break: break-word;
}

.dd-prelim-root .dd-prelim-ess-table-card-body {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0.55rem 0.65rem 0.65rem;
  box-sizing: border-box;
}

.dd-prelim-root .dd-prelim-ess-chip-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.45rem;
  align-items: flex-start;
  width: 100%;
  min-width: 0;
}

.dd-prelim-root .dd-prelim-ess-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 0.28rem 0.55rem;
  font-size: 0.76rem;
  line-height: 1.35;
  font-weight: 500;
  color: #0f172a;
  background: rgba(248, 250, 252, 0.98);
  border: 1px solid rgba(148, 163, 184, 0.55);
  border-radius: 999px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  word-break: break-word;
  box-sizing: border-box;
}
</style>
