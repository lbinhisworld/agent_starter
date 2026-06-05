<!--
  [INPUT]: `coreBusinessEntities` 字段原始值；`coreEntitiesRequirementCanvas.ts` 视图模型
  [OUTPUT]: 与详情页初步需求「核心对象」Tab 同构的卡片栈（亮色主题适配设计画布）；**展开后高度随内容，不用语义块 `max-height` 裁切**
  [POS]: `DesignDetailPage` 需求提炼子 Tab「核心业务对象」

  [PROTOCOL]: 视觉区块或字段变更时同步本 Header 与 `AGENTS.md`
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  buildCustomerRequirementCoreEntitiesPanelVm,
  lifecycleChipToneIndex,
} from './coreEntitiesRequirementCanvas';

const props = defineProps<{
  /** `parsed.coreBusinessEntities` */
  value: unknown;
}>();

const vm = computed(() => buildCustomerRequirementCoreEntitiesPanelVm(props.value));

function chipClass(stateIndex: number): string {
  return `dd-req-cbe-chip dd-req-cbe-chip--t${lifecycleChipToneIndex(stateIndex)}`;
}
</script>

<template>
  <div class="dd-req-cbe-root" aria-label="核心业务对象">
    <template v-if="vm.mode === 'fallback'">
      <pre class="dd-req-cbe-fallback-pre">{{ vm.jsonText }}</pre>
    </template>
    <template v-else>
      <section
        v-for="sec in vm.categories"
        :key="sec.category"
        class="dd-req-cbe-cat"
        :data-cbe-category="sec.category"
      >
        <header class="dd-req-cbe-cat-head">
          <span class="dd-req-cbe-cat-icon" aria-hidden="true">{{ sec.icon }}</span>
          <span class="dd-req-cbe-cat-title">{{ sec.categoryTitle }}</span>
        </header>
        <div class="dd-req-cbe-cat-body">
          <p v-if="sec.cards.length === 0" class="dd-req-cbe-cat-empty">本类别下暂无提炼对象</p>
          <div v-else class="dd-req-cbe-grid">
            <article
              v-for="c in sec.cards"
              :key="`${sec.category}-${c.index}`"
              class="dd-req-cbe-card"
              :class="{ 'dd-req-cbe-card--raw': c.kind === 'raw' }"
              :data-index="c.index"
            >
              <template v-if="c.kind === 'entity'">
                <div class="dd-req-cbe-card-head">{{ c.title }}</div>
                <div class="dd-req-cbe-card-body">
                  <div class="dd-req-cbe-nest">
                    <div class="dd-req-cbe-nest-h">概念解释</div>
                    <div class="dd-req-cbe-nest-b dd-req-cbe-prewrap">
                      {{ c.conceptExpl || '—' }}
                    </div>
                  </div>
                  <div class="dd-req-cbe-nest">
                    <div class="dd-req-cbe-nest-h">生命周期</div>
                    <div class="dd-req-cbe-nest-b dd-req-cbe-lifecycle">
                      <template v-if="!c.states.length">
                        <span class="dd-req-cbe-dash">—</span>
                      </template>
                      <template v-else>
                        <template v-for="(st, si) in c.states" :key="si">
                          <span :class="chipClass(si)">{{ st }}</span>
                          <span v-if="si < c.states.length - 1" class="dd-req-cbe-arrow" aria-hidden="true">→</span>
                        </template>
                      </template>
                    </div>
                  </div>
                  <div class="dd-req-cbe-nest">
                    <div class="dd-req-cbe-nest-h">归属逻辑</div>
                    <div class="dd-req-cbe-nest-b dd-req-cbe-prewrap">
                      {{ c.ownership || '—' }}
                    </div>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="dd-req-cbe-card-head">{{ c.title }}</div>
                <div class="dd-req-cbe-card-body dd-req-cbe-card-body--raw">
                  <pre class="dd-req-cbe-raw-pre">{{ c.jsonPretty }}</pre>
                </div>
              </template>
            </article>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* 结构借鉴 `frontend/styles.css` 中 `.problem-detail-prelim-cbe-*` / `.problem-detail-prelim-pp-card`，配色适配设计详情亮色画布 */
.dd-req-cbe-root {
  min-width: 0;
  width: 100%;
}

.dd-req-cbe-fallback-pre {
  margin: 0;
  padding: 0.5rem 0.55rem;
  font-size: 0.78rem;
  line-height: 1.45;
  border-radius: 8px;
  border: 1px solid var(--dd-border, #e2e8f0);
  background: #f8fafc;
  color: var(--dd-text, #0f172a);
  overflow: visible;
  white-space: pre-wrap;
  word-break: break-word;
}

.dd-req-cbe-cat {
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

.dd-req-cbe-cat:last-child {
  margin-bottom: 0;
}

.dd-req-cbe-cat-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.65rem;
  background: rgba(56, 189, 248, 0.1);
  border-bottom: 1px solid rgba(56, 189, 248, 0.28);
}

.dd-req-cbe-cat-icon {
  font-size: 1.1rem;
  line-height: 1;
  flex-shrink: 0;
}

.dd-req-cbe-cat-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0369a1;
  letter-spacing: 0.02em;
}

.dd-req-cbe-cat-body {
  padding: 0.55rem 0.6rem 0.65rem;
  min-width: 0;
}

.dd-req-cbe-cat-empty {
  margin: 0;
  padding: 0.5rem 0.35rem;
  font-size: 0.8rem;
  color: var(--dd-muted, #64748b);
  text-align: center;
}

.dd-req-cbe-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem 0.5rem;
  min-width: 0;
  width: 100%;
  align-items: stretch;
}

@media (max-width: 1200px) {
  .dd-req-cbe-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 420px) {
  .dd-req-cbe-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.dd-req-cbe-card {
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

.dd-req-cbe-card--raw {
  border-color: rgba(148, 163, 184, 0.55);
}

.dd-req-cbe-card-head {
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

.dd-req-cbe-card-body {
  flex: 1 1 auto;
  min-height: auto;
  padding: 0.55rem 0.6rem 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dd-req-cbe-card-body--raw {
  overflow: visible;
}

.dd-req-cbe-nest {
  border-radius: 10px;
  border: 1px solid rgba(56, 189, 248, 0.28);
  background: rgba(248, 250, 252, 0.95);
  overflow: hidden;
  min-width: 0;
}

.dd-req-cbe-nest-h {
  padding: 0.28rem 0.45rem;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.35;
  color: #0369a1;
  background: rgba(56, 189, 248, 0.08);
  border-bottom: 1px solid rgba(56, 189, 248, 0.2);
}

.dd-req-cbe-nest-b {
  padding: 0.4rem 0.45rem 0.45rem;
  font-size: 0.76rem;
  line-height: 1.45;
  color: var(--dd-text, #0f172a);
  word-break: break-word;
}

.dd-req-cbe-prewrap {
  white-space: pre-wrap;
}

.dd-req-cbe-lifecycle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.32rem 0.24rem;
}

.dd-req-cbe-dash {
  color: var(--dd-muted, #64748b);
  font-size: 0.76rem;
}

.dd-req-cbe-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.14rem 0.45rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.25;
  border: 1px solid transparent;
}

.dd-req-cbe-chip--t0 {
  color: #a16207;
  background: rgba(251, 191, 36, 0.2);
  border-color: rgba(251, 191, 36, 0.5);
}
.dd-req-cbe-chip--t1 {
  color: #0e7490;
  background: rgba(34, 211, 238, 0.16);
  border-color: rgba(34, 211, 238, 0.42);
}
.dd-req-cbe-chip--t2 {
  color: #5b21b6;
  background: rgba(167, 139, 250, 0.2);
  border-color: rgba(167, 139, 250, 0.45);
}
.dd-req-cbe-chip--t3 {
  color: #166534;
  background: rgba(74, 222, 128, 0.16);
  border-color: rgba(74, 222, 128, 0.4);
}
.dd-req-cbe-chip--t4 {
  color: #9f1239;
  background: rgba(251, 113, 133, 0.18);
  border-color: rgba(251, 113, 133, 0.42);
}
.dd-req-cbe-chip--t5 {
  color: #075985;
  background: rgba(56, 189, 248, 0.18);
  border-color: rgba(56, 189, 248, 0.42);
}

.dd-req-cbe-arrow {
  color: rgba(100, 116, 139, 0.85);
  font-size: 0.8rem;
  font-weight: 600;
  user-select: none;
}

.dd-req-cbe-raw-pre {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
