<!--
  [INPUT]: caseId、customerName、refreshTick
  [OUTPUT]: 商业化售前设计报告（任务 11 逐章呈现 + 任务 10 静态 4～5 章）
  [POS]: 架构清单「设计报告」子 Tab
  [PROTOCOL]: 变更须同步 `parseDesignReportChapter1.ts`、`runTask11AnalysisReportPipeline.ts` 与 AGENTS.md
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { DesignReportModel } from './assembleDesignReportModel';
import { prepareDesignReportChapterSections } from './parseDesignReportChapter1';
import { splitReportParagraphs } from './parseDesignReportLlmChapters';
import {
  loadCachedDesignReportNarrative,
  runDesignReportHybridEngine,
} from './runDesignReportHybridEngine';

const props = defineProps<{
  caseId: string;
  customerName?: string;
  refreshTick: number;
  /** 子任务流水线写完第一章缓存后递增 */
  contentTick?: number;
}>();

const report = ref<DesignReportModel | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);

const companyLabel = computed(
  () => String(props.customerName ?? '').trim() || report.value?.companyName || '客户',
);

const chapter1Sections = computed(() =>
  prepareDesignReportChapterSections(report.value?.llm?.chapter1 ?? ''),
);

const hasChapter1 = computed(() => Boolean(report.value?.llm?.chapter1?.trim()));

const chapter2Sections = computed(() =>
  prepareDesignReportChapterSections(report.value?.llm?.chapter2 ?? ''),
);

const hasChapter2 = computed(() => Boolean(report.value?.llm?.chapter2?.trim()));

const hasChapter3 = computed(() => Boolean(report.value?.llm?.chapter3?.trim()));

const showStaticChapter4 = computed(
  () => (report.value?.staticPayload.fieldSyncSections.length ?? 0) > 0,
);

const showStaticChapter5 = computed(() => (report.value?.staticPayload.schemaTables.length ?? 0) > 0);

async function runEngine(
  mode: 'full' | 'static_only' | 'llm_only',
  opts?: { reuseCachedLlm?: boolean },
): Promise<void> {
  const cid = String(props.caseId || '').trim();
  if (!cid) {
    report.value = null;
    loadError.value = '缺少 caseId';
    return;
  }
  loading.value = true;
  loadError.value = null;
  try {
    const res = await runDesignReportHybridEngine({
      caseId: cid,
      companyName: companyLabel.value,
      userFeedback: '',
      mode,
      reuseCachedLlm: opts?.reuseCachedLlm ?? true,
    });
    report.value = res.model;
    if (res.model.llmError && mode !== 'static_only') {
      loadError.value = res.model.llmError;
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function reloadMergedFromCacheAndGraph(): Promise<void> {
  const cid = String(props.caseId || '').trim();
  if (!cid) return;
  try {
    const res = await runDesignReportHybridEngine({
      caseId: cid,
      companyName: companyLabel.value,
      mode: 'static_only',
      reuseCachedLlm: true,
    });
    report.value = res.model;
  } catch {
    const cached = loadCachedDesignReportNarrative(cid);
    if (cached && report.value) {
      report.value = { ...report.value, llm: cached, llmStatus: 'ok' };
    }
  }
}

watch(
  () => [props.caseId, props.refreshTick] as const,
  () => {
    void runEngine('static_only');
  },
  { immediate: true },
);

watch(
  () => [props.caseId, props.contentTick ?? 0] as const,
  () => {
    if ((props.contentTick ?? 0) > 0) void reloadMergedFromCacheAndGraph();
  },
);
</script>

<template>
  <section class="dd-design-report-root" aria-label="设计报告">
    <div v-if="loading && !report" class="dd-design-report-state">正在装配报告…</div>
    <div v-else-if="loadError && !report" class="dd-design-report-state dd-design-report-state--err">
      {{ loadError }}
    </div>

    <article v-if="report" class="dd-design-report-doc">
      <header class="dd-design-report-cover">
        <p class="dd-design-report-cover-eyebrow">数字化转型售前设计报告</p>
        <h1 class="dd-design-report-cover-title">{{ report.title }}</h1>
        <p class="dd-design-report-cover-meta">
          <span>生成时间：{{ new Date(report.generatedAt).toLocaleString('zh-CN') }}</span>
          <span class="dd-design-report-axis-badge dd-design-report-axis-badge--llm">
            叙事轴：{{ report.llmStatus === 'ok' ? '已就绪' : report.llmStatus }}
          </span>
          <span class="dd-design-report-axis-badge dd-design-report-axis-badge--static">
            对账轴：{{ report.staticStatus === 'ok' ? '已就绪' : report.staticStatus }}
          </span>
        </p>
        <p v-if="loadError" class="dd-design-report-cover-warn">{{ loadError }}</p>
      </header>

      <!-- 第一章：任务 11 子任务 1 落库后再展示整块 -->
      <section v-if="hasChapter1" class="dd-design-report-chapter">
        <h2 class="dd-design-report-chapter-title">
          <span class="dd-design-report-chapter-num">01</span>
          对需求痛点的理解
        </h2>
        <div
          v-for="(sec, si) in chapter1Sections"
          :key="'c1-sec-' + si"
          class="dd-design-report-md-section"
        >
          <h3 v-if="sec.heading && sec.heading !== '正文'" class="dd-design-report-md-h3">
            {{ sec.heading }}
          </h3>
          <p
            v-for="(para, pi) in splitReportParagraphs(sec.body)"
            :key="'c1-' + si + '-' + pi"
            class="dd-design-report-prose"
          >
            {{ para }}
          </p>
        </div>
      </section>

      <!-- 第二章：任务 11 子任务 2 落库后再展示 -->
      <section v-if="hasChapter2" class="dd-design-report-chapter">
        <h2 class="dd-design-report-chapter-title">
          <span class="dd-design-report-chapter-num">02</span>
          剖析与诊断
        </h2>
        <div
          v-for="(sec, si) in chapter2Sections"
          :key="'c2-sec-' + si"
          class="dd-design-report-md-section"
        >
          <h3 v-if="sec.heading && sec.heading !== '正文'" class="dd-design-report-md-h3">
            {{ sec.heading }}
          </h3>
          <p
            v-for="(para, pi) in splitReportParagraphs(sec.body)"
            :key="'c2-' + si + '-' + pi"
            class="dd-design-report-prose"
          >
            {{ para }}
          </p>
        </div>
      </section>

      <!-- 第三章：任务 11 子任务 3 落库后再展示 -->
      <section v-if="hasChapter3" class="dd-design-report-chapter">
        <h2 class="dd-design-report-chapter-title">
          <span class="dd-design-report-chapter-num">03</span>
          方案构建
        </h2>
        <div
          v-for="(sec, si) in prepareDesignReportChapterSections(report.llm?.chapter3 ?? '')"
          :key="'c3-sec-' + si"
          class="dd-design-report-md-section"
        >
          <h3 v-if="sec.heading && sec.heading !== '正文'" class="dd-design-report-md-h3">
            {{ sec.heading }}
          </h3>
          <p
            v-for="(para, pi) in splitReportParagraphs(sec.body)"
            :key="'c3-' + si + '-' + pi"
            class="dd-design-report-prose"
          >
            {{ para }}
          </p>
        </div>
      </section>

      <!-- 第四章：静态直刷（任务 10 后有数据即展示） -->
      <section
        v-if="showStaticChapter4"
        class="dd-design-report-chapter dd-design-report-chapter--static"
      >
        <h2 class="dd-design-report-chapter-title">
          <span class="dd-design-report-chapter-num">04</span>
          两端字段同步对账字典
          <span class="dd-design-report-static-tag">JS 直刷 · 零幻觉</span>
        </h2>
        <p v-if="report.staticPayload.emptyStaticMessage" class="dd-design-report-empty-hint">
          {{ report.staticPayload.emptyStaticMessage }}
        </p>
        <template v-else>
          <div
            v-for="sec in report.staticPayload.fieldSyncSections"
            :key="sec.featureId || sec.interfaceName"
            class="dd-design-report-sync-block"
          >
            <header class="dd-design-report-sync-head">
              <h3 class="dd-design-report-sync-title">{{ sec.interfaceName }}</h3>
              <span v-if="sec.communicationCategory" class="dd-design-report-sync-meta">{{
                sec.communicationCategory
              }}</span>
              <span v-if="sec.dataPipeline" class="dd-design-report-sync-meta">{{ sec.dataPipeline }}</span>
            </header>
            <p class="dd-design-report-sync-endpoints">
              <span>触发：{{ sec.triggerSummary }}</span>
              <span>接收：{{ sec.receiverSummary }}</span>
            </p>
            <div class="dd-design-report-table-wrap">
              <table class="dd-design-report-table dd-design-report-table--reconcile">
                <thead>
                  <tr>
                    <th class="dd-design-report-th--wecom">源端（企微/触发侧）</th>
                    <th class="dd-design-report-th--flow">流向</th>
                    <th class="dd-design-report-th--lowcode">目标端（低代码/接收侧）</th>
                    <th>数据格式校正</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!sec.mappings.length">
                    <td colspan="4" class="dd-design-report-td-empty">（无字段映射行）</td>
                  </tr>
                  <tr v-for="(row, ri) in sec.mappings" :key="ri">
                    <td class="dd-design-report-td--wecom">{{ row.sourceColumn }}</td>
                    <td class="dd-design-report-td--flow">{{ row.flowLabel }}</td>
                    <td class="dd-design-report-td--lowcode">{{ row.targetColumn }}</td>
                    <td>{{ row.formatCorrection }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </section>

      <!-- 第五章：静态直刷 -->
      <section
        v-if="showStaticChapter5"
        class="dd-design-report-chapter dd-design-report-chapter--static"
      >
        <h2 class="dd-design-report-chapter-title">
          <span class="dd-design-report-chapter-num">05</span>
          新旧系统全中文对账总账
          <span class="dd-design-report-static-tag">JS 直刷 · 零幻觉</span>
        </h2>
        <div
          v-for="tbl in report.staticPayload.schemaTables"
          :key="tbl.featureId || tbl.tableName"
          class="dd-design-report-schema-block"
        >
          <header class="dd-design-report-schema-head">
            <h3 class="dd-design-report-schema-title">{{ tbl.tableName }}</h3>
            <span v-if="tbl.tableCategory" class="dd-design-report-schema-meta">{{ tbl.tableCategory }}</span>
            <span v-if="tbl.techHostPlatform" class="dd-design-report-schema-meta">{{
              tbl.techHostPlatform
            }}</span>
          </header>
          <div class="dd-design-report-table-wrap">
            <table class="dd-design-report-table dd-design-report-table--schema">
              <thead>
                <tr>
                  <th>字段</th>
                  <th>类型</th>
                  <th>约束</th>
                  <th>外键指向</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!tbl.fields.length">
                  <td colspan="5" class="dd-design-report-td-empty">（无字段集合）</td>
                </tr>
                <tr v-for="(f, fi) in tbl.fields" :key="fi">
                  <td class="dd-design-report-field-name">
                    <span v-if="f.isPrimaryKey" class="dd-design-report-icon" title="主键">🔑</span>
                    <span v-else-if="f.isForeignKey" class="dd-design-report-icon" title="外键">↗</span>
                    {{ f.fieldName }}
                  </td>
                  <td>{{ f.dataType }}</td>
                  <td>
                    <span v-if="f.isPrimaryKey">主键</span>
                    <span v-else-if="f.isForeignKey">外键</span>
                    <span v-else>—</span>
                  </td>
                  <td>
                    <template v-if="f.isForeignKey && (f.refTable || f.refField)">
                      {{ f.refTable }}<template v-if="f.refField">.{{ f.refField }}</template>
                    </template>
                    <span v-else>—</span>
                  </td>
                  <td>{{ f.remark || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </article>
  </section>
</template>

<style scoped>
.dd-design-report-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
  font-size: 13px;
  color: #1a2332;
}

.dd-design-report-state {
  padding: 16px;
  color: #64748b;
  text-align: center;
}

.dd-design-report-state--err {
  color: #b91c1c;
}

.dd-design-report-doc {
  background: linear-gradient(180deg, #f8fafc 0%, #fff 120px);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.dd-design-report-cover {
  padding: 28px 32px 24px;
  background: linear-gradient(135deg, #0f2744 0%, #1a4a7a 55%, #2d6a9f 100%);
  color: #f8fafc;
}

.dd-design-report-cover-eyebrow {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.85;
}

.dd-design-report-cover-title {
  margin: 8px 0 12px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.25;
}

.dd-design-report-cover-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  margin: 0;
  font-size: 12px;
  opacity: 0.9;
}

.dd-design-report-cover-warn {
  margin: 10px 0 0;
  font-size: 12px;
  color: #fde68a;
}

.dd-design-report-axis-badge {
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.12);
}

.dd-design-report-chapter {
  padding: 20px 28px 24px;
  border-top: 1px solid #e8edf3;
}

.dd-design-report-chapter--static {
  background: #fafbfc;
}

.dd-design-report-chapter-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 14px;
  font-size: 16px;
  font-weight: 600;
  color: #0f2744;
}

.dd-design-report-chapter-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: 6px;
  background: #1a4a7a;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.dd-design-report-static-tag {
  font-size: 11px;
  font-weight: 500;
  color: #0d9488;
  background: #ccfbf1;
  padding: 2px 8px;
  border-radius: 4px;
}

.dd-design-report-md-section {
  margin-bottom: 16px;
}

.dd-design-report-md-h3 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #1e40af;
  letter-spacing: 0.02em;
}

.dd-design-report-prose {
  margin: 0 0 12px;
  line-height: 1.75;
  color: #334155;
  text-align: justify;
}

.dd-design-report-empty-hint {
  margin: 0;
  color: #94a3b8;
  font-style: italic;
}

.dd-design-report-sync-block,
.dd-design-report-schema-block {
  margin-bottom: 20px;
}

.dd-design-report-sync-head,
.dd-design-report-schema-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.dd-design-report-sync-title,
.dd-design-report-schema-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.dd-design-report-sync-meta,
.dd-design-report-schema-meta {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 4px;
}

.dd-design-report-sync-endpoints {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 0 10px;
  font-size: 12px;
  color: #475569;
}

.dd-design-report-table-wrap {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.dd-design-report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.dd-design-report-table th,
.dd-design-report-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #e8edf3;
  text-align: left;
}

.dd-design-report-table thead th {
  background: #f1f5f9;
  font-weight: 600;
  color: #334155;
}

.dd-design-report-th--wecom,
.dd-design-report-td--wecom {
  background: rgba(34, 197, 94, 0.08);
}

.dd-design-report-th--lowcode,
.dd-design-report-td--lowcode {
  background: rgba(59, 130, 246, 0.08);
}

.dd-design-report-th--flow,
.dd-design-report-td--flow {
  text-align: center;
  width: 72px;
  color: #64748b;
}

.dd-design-report-td-empty {
  text-align: center;
  color: #94a3b8;
}

.dd-design-report-field-name {
  font-weight: 500;
}

.dd-design-report-icon {
  margin-right: 4px;
}
</style>
