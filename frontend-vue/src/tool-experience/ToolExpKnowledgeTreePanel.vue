<!--
  [INPUT]: `ToolExpKnowledgePayload`（来自 DB / localStorage）
  [OUTPUT]: 文件目录树式知识树展示
  [POS]: 工具经验「沉淀知识树」Tab

  [PROTOCOL]: 与 `knowledge-tree-payload.ts` 字段一致；典型场景二级=行业、三级=场景内容（场景描述正文内 `products_used` 绿底白字标签；`products_used` 全量列于「功能实现」标题栏「｜」后；功能正文纯文本）；产品核心功能/能力画像、工具对比同前。
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  formatComparisonDetailLines,
  groupComparisonEntriesForTree,
  groupScenarioEntriesByIndustry,
  segmentTextWithProductNames,
  type ToolExpComparisonComboGroup,
  type ToolExpKnowledgePayload,
  type ToolExpKnowledgeProductEntry,
} from './knowledge-tree-payload';

const props = defineProps<{
  payload: ToolExpKnowledgePayload;
}>();

const comparisonTree = computed(() => groupComparisonEntriesForTree(props.payload.comparisonEntries));

const scenarioTree = computed(() => groupScenarioEntriesByIndustry(props.payload.scenarioEntries));

/** 典型场景：`products_used` 去重顺序稳定，供「功能实现」标题栏展示 */
function uniqueScenarioProductNames(names: string[]): string[] {
  return [...new Set(names.map((p) => String(p).trim()).filter(Boolean))];
}

/** 场景正文纯展示（无内联标签） */
function scenarioPlainParagraph(text: string): string {
  const t = (text ?? '').trim();
  return t || '—';
}

function comboLatestImportedAt(combo: ToolExpComparisonComboGroup): string {
  let max = '';
  for (const d of combo.dimensions) {
    for (const b of d.blocks) {
      if (b.importedAt > max) max = b.importedAt;
    }
  }
  return max;
}

function formatImportedAt(iso: string): string {
  if (!iso || !String(iso).trim()) return '';
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

function safeJson(obj: unknown, maxLen = 16000): string {
  try {
    const s = JSON.stringify(obj, null, 2);
    return s.length > maxLen ? `${s.slice(0, maxLen)}\n…（已截断）` : s;
  } catch {
    return String(obj);
  }
}

function productLabel(p: ToolExpKnowledgeProductEntry, i: number): string {
  const base = p.product_name || `产品 ${i + 1}`;
  return `${base}`;
}

/** 与 `ToolExpResultCard` 对齐：字符串数组字段 */
function strListField(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).filter(Boolean);
}

type CoreFunctionTreeRow = {
  function_name: string;
  selling_points: string[];
  operation_steps: string[];
};

/**
 * V3：`core_functions` 为 `{ function_name, selling_points[], operation_steps[] }[]`。
 * 返回 `null` 表示非该结构，界面回退整段 JSON。
 */
function parseCoreFunctionsForTree(core: unknown): CoreFunctionTreeRow[] | null {
  if (!Array.isArray(core)) return null;
  const rows: CoreFunctionTreeRow[] = [];
  for (const item of core) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const o = item as Record<string, unknown>;
    const k = new Set(Object.keys(o));
    const looksV3 = k.has('function_name') || k.has('selling_points') || k.has('operation_steps');
    if (!looksV3) return null;
    rows.push({
      function_name: typeof o.function_name === 'string' ? o.function_name.trim() : '',
      selling_points: strListField(o.selling_points),
      operation_steps: strListField(o.operation_steps),
    });
  }
  return rows;
}

function coreFunctionTitle(row: CoreFunctionTreeRow, fi: number): string {
  return row.function_name?.trim() ? row.function_name.trim() : `功能 ${fi + 1}`;
}

/** 与 `productEntries` 下标对齐 */
const productCoreFnRows = computed(() =>
  props.payload.productEntries.map((p) => parseCoreFunctionsForTree(p.core_functions)),
);

/** 与 `ToolExpResultCard` fingerprint view 维度标签一致 */
const FP_LABELS: Record<string, string> = {
  interaction: '交互能力',
  automation_and_ai: '自动化与 AI',
  data_management: '数据管理',
  workflow: '流程能力',
  integration: '集成能力',
  security_permissions: '权限控制',
  performance: '性能表现',
  customization: '定制化延展',
  deployment: '部署模式',
  maintenance_cost: '维护与成本',
};

const FP_KEY_ORDER = [
  'interaction',
  'automation_and_ai',
  'data_management',
  'workflow',
  'integration',
  'security_permissions',
  'performance',
  'customization',
  'deployment',
  'maintenance_cost',
] as const;

type FingerprintDimRow = { key: string; label: string; text: string };

function fingerprintDimLabel(key: string): string {
  return FP_LABELS[key] ?? key;
}

function fingerprintValueToText(v: unknown): string {
  if (v === null || v === undefined) return '暂无';
  if (typeof v === 'string') return v.trim() || '暂无';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/**
 * 扁平对象为维度行；`null` 表示非对象（回退整段 JSON）。
 * 空对象返回 `[]`。
 */
function parseCapabilityFingerprintForTree(fp: unknown): FingerprintDimRow[] | null {
  if (fp === null || fp === undefined) return [];
  if (typeof fp !== 'object' || Array.isArray(fp)) return null;
  const o = fp as Record<string, unknown>;
  const seen = new Set<string>();
  const rows: FingerprintDimRow[] = [];
  for (const key of FP_KEY_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(o, key)) continue;
    seen.add(key);
    rows.push({ key, label: fingerprintDimLabel(key), text: fingerprintValueToText(o[key]) });
  }
  for (const key of Object.keys(o).sort()) {
    if (seen.has(key)) continue;
    rows.push({ key, label: fingerprintDimLabel(key), text: fingerprintValueToText(o[key]) });
  }
  return rows;
}

const productFingerprintRows = computed(() =>
  props.payload.productEntries.map((p) => parseCapabilityFingerprintForTree(p.capability_fingerprint)),
);
</script>

<template>
  <div class="tool-exp-k-tree" aria-label="沉淀知识树">
    <p v-if="
        !payload.productEntries.length &&
        !payload.comparisonEntries.length &&
        !payload.scenarioEntries.length
      "
      class="tool-exp-k-tree-empty"
    >
      暂无沉淀数据。完成「工具经验提炼」后，在第二步通知卡点击「确定」可将本次结果并入知识树。
    </p>

    <div v-else class="tool-exp-k-tree-roots">
      <!-- 一级：产品工具 -->
      <details class="tool-exp-k-tree-folder" open>
        <summary class="tool-exp-k-tree-summary">📁 产品工具</summary>
        <div class="tool-exp-k-tree-children">
          <template v-if="!payload.productEntries.length">
            <p class="tool-exp-k-tree-leaf-muted">（空）</p>
          </template>
          <details
            v-for="(p, pi) in payload.productEntries"
            v-else
            :key="`p-${pi}-${p.importedAt}`"
            class="tool-exp-k-tree-folder tool-exp-k-tree-folder-2"
          >
            <summary class="tool-exp-k-tree-summary tool-exp-k-tree-summary-2">
              📄 {{ productLabel(p, pi) }}
              <span class="tool-exp-k-tree-ts">{{ formatImportedAt(p.importedAt) }}</span>
            </summary>
            <div class="tool-exp-k-tree-children">
              <details class="tool-exp-k-tree-file">
                <summary class="tool-exp-k-tree-summary-file">核心功能</summary>
                <div class="tool-exp-k-tree-core-fn-wrap">
                  <template v-if="productCoreFnRows[pi] === null">
                    <pre class="tool-exp-k-tree-pre">{{ safeJson(p.core_functions) }}</pre>
                  </template>
                  <template v-else-if="productCoreFnRows[pi]!.length === 0">
                    <p class="tool-exp-k-tree-leaf-muted tool-exp-k-tree-core-fn-empty">（无核心功能条目）</p>
                  </template>
                  <template v-else>
                    <details
                      v-for="(fn, fi) in productCoreFnRows[pi]!"
                      :key="`cf-${pi}-${p.importedAt}-${fi}-${fn.function_name}`"
                      class="tool-exp-k-tree-folder tool-exp-k-tree-folder-core-fn"
                    >
                      <summary class="tool-exp-k-tree-summary tool-exp-k-tree-summary-core-fn">
                        🔹 {{ coreFunctionTitle(fn, fi) }}
                      </summary>
                      <div class="tool-exp-k-tree-children tool-exp-k-tree-core-fn-children">
                        <details class="tool-exp-k-tree-file tool-exp-k-tree-file-nested">
                          <summary class="tool-exp-k-tree-summary-file">卖点</summary>
                          <ul
                            v-if="fn.selling_points.length"
                            class="tool-exp-k-tree-ul"
                          >
                            <li v-for="(sp, spi) in fn.selling_points" :key="spi">{{ sp }}</li>
                          </ul>
                          <p v-else class="tool-exp-k-tree-leaf-muted tool-exp-k-tree-inline-muted">（无）</p>
                        </details>
                        <details class="tool-exp-k-tree-file tool-exp-k-tree-file-nested">
                          <summary class="tool-exp-k-tree-summary-file">操作指引</summary>
                          <ol
                            v-if="fn.operation_steps.length"
                            class="tool-exp-k-tree-ol"
                          >
                            <li v-for="(st, sti) in fn.operation_steps" :key="sti">{{ st }}</li>
                          </ol>
                          <p v-else class="tool-exp-k-tree-leaf-muted tool-exp-k-tree-inline-muted">（无）</p>
                        </details>
                      </div>
                    </details>
                  </template>
                </div>
              </details>
              <details class="tool-exp-k-tree-file">
                <summary class="tool-exp-k-tree-summary-file">能力画像</summary>
                <div class="tool-exp-k-tree-fp-wrap">
                  <template v-if="productFingerprintRows[pi] === null">
                    <pre class="tool-exp-k-tree-pre">{{ safeJson(p.capability_fingerprint) }}</pre>
                  </template>
                  <template v-else-if="productFingerprintRows[pi]!.length === 0">
                    <p class="tool-exp-k-tree-leaf-muted tool-exp-k-tree-fp-empty">（无能力画像字段）</p>
                  </template>
                  <template v-else>
                    <details
                      v-for="fd in productFingerprintRows[pi]!"
                      :key="`fp-${pi}-${p.importedAt}-${fd.key}`"
                      class="tool-exp-k-tree-folder tool-exp-k-tree-folder-fp-dim"
                    >
                      <summary class="tool-exp-k-tree-summary tool-exp-k-tree-summary-fp-dim">
                        📐 {{ fd.label }}
                      </summary>
                      <pre class="tool-exp-k-tree-pre tool-exp-k-tree-pre-fp-body">{{ fd.text }}</pre>
                    </details>
                  </template>
                </div>
              </details>
              <details
                v-if="p.identified_issues != null && String(p.identified_issues).trim()"
                class="tool-exp-k-tree-file"
              >
                <summary class="tool-exp-k-tree-summary-file">识别问题</summary>
                <pre class="tool-exp-k-tree-pre">{{ safeJson(p.identified_issues) }}</pre>
              </details>
              <details
                v-if="p.architecture_advice != null && String(p.architecture_advice).trim()"
                class="tool-exp-k-tree-file"
              >
                <summary class="tool-exp-k-tree-summary-file">架构建议</summary>
                <pre class="tool-exp-k-tree-pre">{{ safeJson(p.architecture_advice) }}</pre>
              </details>
            </div>
          </details>
        </div>
      </details>

      <!-- 一级：工具对比 -->
      <details class="tool-exp-k-tree-folder" open>
        <summary class="tool-exp-k-tree-summary">📁 工具对比</summary>
        <div class="tool-exp-k-tree-children">
          <template v-if="!payload.comparisonEntries.length">
            <p class="tool-exp-k-tree-leaf-muted">（空）</p>
          </template>
          <template v-else>
            <!-- 二级：对比组合（工具名 V.S. 串联） -->
            <details
              v-for="combo in comparisonTree"
              :key="`combo-${combo.toolsKey}`"
              class="tool-exp-k-tree-folder tool-exp-k-tree-folder-2"
            >
            <summary class="tool-exp-k-tree-summary tool-exp-k-tree-summary-2">
              📄 {{ combo.toolsDisplay }}
              <span v-if="comboLatestImportedAt(combo)" class="tool-exp-k-tree-ts">{{
                formatImportedAt(comboLatestImportedAt(combo))
              }}</span>
            </summary>
            <div class="tool-exp-k-tree-children tool-exp-k-tree-compare-body">
              <!-- 三级：对比维度 -->
              <details
                v-for="(dim, di) in combo.dimensions"
                :key="`dim-${combo.toolsKey}-${di}-${dim.dimension}`"
                class="tool-exp-k-tree-folder tool-exp-k-tree-folder-3"
              >
                <summary class="tool-exp-k-tree-summary tool-exp-k-tree-summary-3">
                  📂 {{ dim.dimension }}
                </summary>
                <div class="tool-exp-k-tree-children tool-exp-k-tree-compare-dim-children">
                  <!-- 四级：对比内容块（淡蓝边框） -->
                  <div
                    v-for="(blk, bi) in dim.blocks"
                    :key="`blk-${combo.toolsKey}-${di}-${bi}-${blk.importedAt}`"
                    class="tool-exp-k-tree-compare-content-block"
                  >
                    <div class="tool-exp-k-tree-compare-lines">
                      <template
                        v-for="(ln, li) in formatComparisonDetailLines(combo.toolsOrder, blk.text)"
                        :key="`ln-${combo.toolsKey}-${di}-${bi}-${li}-${blk.importedAt}`"
                      >
                        <div
                          v-if="ln.tool || ln.emoji"
                          class="tool-exp-k-tree-compare-line"
                        >
                          <span v-if="ln.tool" class="tool-exp-k-tree-compare-tool">{{ ln.tool }}</span>
                          <span v-if="ln.tool" class="tool-exp-k-tree-compare-colon">：</span>
                          <span v-if="ln.emoji" class="tool-exp-k-tree-compare-emoji" aria-hidden="true">{{
                            ln.emoji
                          }}</span>
                          <span class="tool-exp-k-tree-compare-line-body">{{ ln.body }}</span>
                        </div>
                        <pre
                          v-else
                          class="tool-exp-k-tree-pre tool-exp-k-tree-pre-compare-block tool-exp-k-tree-pre-compare-fallback"
                        >{{ ln.body }}</pre>
                      </template>
                    </div>
                    <div class="tool-exp-k-tree-compare-block-meta">{{ formatImportedAt(blk.importedAt) }}</div>
                  </div>
                </div>
              </details>
            </div>
            </details>
          </template>
        </div>
      </details>

      <!-- 一级：典型场景 → 二级行业 → 三级场景内容（描述内联标签；功能实现标题栏｜后列产品） -->
      <details class="tool-exp-k-tree-folder" open>
        <summary class="tool-exp-k-tree-summary">📁 典型场景</summary>
        <div class="tool-exp-k-tree-children">
          <template v-if="!payload.scenarioEntries.length">
            <p class="tool-exp-k-tree-leaf-muted">（空）</p>
          </template>
          <template v-else>
            <details
              v-for="grp in scenarioTree"
              :key="`ind-${grp.industryKey}`"
              class="tool-exp-k-tree-folder tool-exp-k-tree-folder-2"
            >
              <summary class="tool-exp-k-tree-summary tool-exp-k-tree-summary-2">
                🏭 {{ grp.industryLabel }}
              </summary>
              <div class="tool-exp-k-tree-children tool-exp-k-tree-scenario-industry-children">
                <details
                  v-for="(s, idx) in grp.scenarios"
                  :key="`sc-${grp.industryKey}-${idx}-${s.importedAt}`"
                  class="tool-exp-k-tree-folder tool-exp-k-tree-folder-scenario"
                >
                  <summary class="tool-exp-k-tree-summary tool-exp-k-tree-summary-scenario-content">
                    📄 场景 {{ idx + 1 }}
                    <span class="tool-exp-k-tree-ts">{{ formatImportedAt(s.importedAt) }}</span>
                  </summary>
                  <div class="tool-exp-k-tree-children tool-exp-k-tree-scenario-content-body">
                    <div class="tool-exp-k-tree-scenario-block">
                      <div class="tool-exp-k-tree-scenario-block-label">场景描述</div>
                      <div class="tool-exp-k-tree-scenario-block-text">
                        <template
                          v-for="(seg, sgi) in segmentTextWithProductNames(
                            s.description,
                            s.products_used,
                          )"
                          :key="`sd-${grp.industryKey}-${idx}-${sgi}-${seg.kind}`"
                        >
                          <span
                            v-if="seg.kind === 'pill'"
                            class="tool-exp-k-tree-product-pill tool-exp-k-tree-product-pill--green"
                          >{{ seg.value }}</span>
                          <span v-else>{{ seg.value }}</span>
                        </template>
                      </div>
                    </div>
                    <div class="tool-exp-k-tree-scenario-block">
                      <template
                        v-for="fnProducts in [uniqueScenarioProductNames(s.products_used)]"
                        :key="`fnp-${grp.industryKey}-${idx}`"
                      >
                        <div
                          class="tool-exp-k-tree-scenario-block-label tool-exp-k-tree-scenario-block-label--function-row"
                        >
                          <span class="tool-exp-k-tree-scenario-block-title">功能实现</span>
                          <template v-if="fnProducts.length">
                            <span class="tool-exp-k-tree-scenario-block-sep" aria-hidden="true">｜</span>
                            <span
                              v-for="(pn, pni) in fnProducts"
                              :key="`fn-${grp.industryKey}-${idx}-${pni}-${pn}`"
                              class="tool-exp-k-tree-product-pill tool-exp-k-tree-product-pill--green"
                            >{{ pn }}</span>
                          </template>
                        </div>
                      </template>
                      <div class="tool-exp-k-tree-scenario-block-text">
                        {{ scenarioPlainParagraph(s.function_achieved) }}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </details>
          </template>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.tool-exp-k-tree {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text);
}

.tool-exp-k-tree-empty {
  margin: 0 0 0.75rem;
  color: var(--text-muted);
}

.tool-exp-k-tree-roots {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tool-exp-k-tree-folder {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.tool-exp-k-tree-folder-2 {
  margin-left: 0.5rem;
  margin-bottom: 0.45rem;
  background: rgba(0, 0, 0, 0.18);
}

.tool-exp-k-tree-folder-3 {
  margin-left: 0.35rem;
  margin-bottom: 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.12);
}

.tool-exp-k-tree-summary-3 {
  font-weight: 600;
  font-size: 0.8rem;
  padding: 0.4rem 0.55rem;
}

.tool-exp-k-tree-compare-dim-children {
  padding-top: 0.25rem;
  padding-bottom: 0.5rem;
}

.tool-exp-k-tree-compare-content-block {
  border: 1px solid rgba(120, 190, 255, 0.55);
  border-radius: 6px;
  background: rgba(120, 190, 255, 0.08);
  margin-bottom: 0.45rem;
  overflow: hidden;
}

.tool-exp-k-tree-compare-content-block:last-child {
  margin-bottom: 0;
}

.tool-exp-k-tree-compare-lines {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tool-exp-k-tree-compare-line {
  display: block;
  font-size: 0.78rem;
  line-height: 1.55;
  word-break: break-word;
}

.tool-exp-k-tree-compare-tool {
  font-weight: 600;
  color: var(--text);
}

.tool-exp-k-tree-compare-colon {
  font-weight: 600;
}

.tool-exp-k-tree-compare-emoji {
  margin-right: 0.2rem;
}

.tool-exp-k-tree-compare-line-body {
  white-space: pre-wrap;
}

.tool-exp-k-tree-pre-compare-block {
  border-top: none;
  margin: 0;
  max-height: min(28vh, 220px);
  background: rgba(0, 0, 0, 0.2);
}

.tool-exp-k-tree-pre-compare-fallback {
  max-height: min(28vh, 220px);
}

.tool-exp-k-tree-compare-block-meta {
  padding: 0.2rem 0.5rem 0.35rem;
  font-size: 0.68rem;
  color: var(--text-muted);
  border-top: 1px solid rgba(120, 190, 255, 0.2);
}

.tool-exp-k-tree-summary {
  cursor: pointer;
  padding: 0.5rem 0.65rem;
  font-weight: 600;
  list-style: none;
  user-select: none;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tool-exp-k-tree-summary::-webkit-details-marker {
  display: none;
}

.tool-exp-k-tree-summary::before {
  content: '▸';
  display: inline-block;
  margin-right: 0.35rem;
  color: var(--accent);
  transition: transform 0.15s ease;
}

.tool-exp-k-tree-folder[open] > .tool-exp-k-tree-summary::before {
  transform: rotate(90deg);
}

.tool-exp-k-tree-summary-2 {
  font-weight: 600;
  font-size: 0.84rem;
}

.tool-exp-k-tree-ts {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--text-muted);
}

.tool-exp-k-tree-children {
  padding: 0.25rem 0.5rem 0.6rem 1.15rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.tool-exp-k-tree-file {
  margin-bottom: 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.15);
}

.tool-exp-k-tree-summary-file {
  cursor: pointer;
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent);
  list-style: none;
}

.tool-exp-k-tree-summary-file::-webkit-details-marker {
  display: none;
}

.tool-exp-k-tree-summary-file::before {
  content: '▸ ';
  color: var(--text-muted);
}

.tool-exp-k-tree-file[open] .tool-exp-k-tree-summary-file::before {
  content: '▾ ';
}

.tool-exp-k-tree-core-fn-wrap {
  padding: 0.25rem 0.35rem 0.45rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.tool-exp-k-tree-core-fn-empty {
  margin: 0.25rem 0.35rem 0.5rem;
}

.tool-exp-k-tree-folder-core-fn {
  margin-bottom: 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.12);
}

.tool-exp-k-tree-summary-core-fn {
  font-size: 0.8rem;
  padding: 0.35rem 0.5rem;
  font-weight: 600;
}

.tool-exp-k-tree-core-fn-children {
  padding: 0.2rem 0.35rem 0.45rem 0.5rem;
}

.tool-exp-k-tree-file-nested {
  margin-bottom: 0.28rem;
}

.tool-exp-k-tree-ul,
.tool-exp-k-tree-ol {
  margin: 0 0 0.35rem;
  padding: 0.35rem 0.55rem 0.45rem 1.25rem;
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--text);
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.tool-exp-k-tree-inline-muted {
  margin: 0.15rem 0.35rem 0.45rem;
  font-size: 0.76rem;
}

.tool-exp-k-tree-fp-wrap {
  padding: 0.25rem 0.35rem 0.45rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.tool-exp-k-tree-fp-empty {
  margin: 0.25rem 0.35rem 0.5rem;
}

.tool-exp-k-tree-folder-fp-dim {
  margin-bottom: 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.12);
}

.tool-exp-k-tree-summary-fp-dim {
  font-size: 0.8rem;
  padding: 0.35rem 0.5rem;
  font-weight: 600;
}

.tool-exp-k-tree-pre-fp-body {
  max-height: min(36vh, 280px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-family: inherit;
  font-size: 0.78rem;
  line-height: 1.55;
}

.tool-exp-k-tree-pre {
  margin: 0;
  padding: 0.45rem 0.55rem 0.55rem;
  font-size: 0.72rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: min(42vh, 360px);
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--text);
  background: rgba(0, 0, 0, 0.25);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.tool-exp-k-tree-pre-inline {
  max-height: min(28vh, 220px);
  border-top: none;
  margin-top: 0.2rem;
}

.tool-exp-k-tree-leaf-muted {
  margin: 0.2rem 0 0.35rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.tool-exp-k-tree-compare-body {
  padding-top: 0.35rem;
}

.tool-exp-k-tree-kv {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
  margin-bottom: 0.35rem;
  font-size: 0.78rem;
}

.tool-exp-k-tree-kv-block {
  flex-direction: column;
  align-items: stretch;
}

.tool-exp-k-tree-k {
  flex: 0 0 5.5rem;
  color: var(--text-muted);
}

.tool-exp-k-tree-v {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.tool-exp-k-tree-scenario-industry-children {
  padding-top: 0.2rem;
}

.tool-exp-k-tree-folder-scenario {
  margin-left: 0.35rem;
  margin-bottom: 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.1);
}

.tool-exp-k-tree-summary-scenario-content {
  font-size: 0.82rem;
  padding: 0.38rem 0.55rem;
  font-weight: 600;
}

.tool-exp-k-tree-scenario-content-body {
  padding: 0.35rem 0.45rem 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.tool-exp-k-tree-scenario-block {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.tool-exp-k-tree-scenario-block-label {
  padding: 0.3rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--accent, #58a6ff);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.15);
}

.tool-exp-k-tree-scenario-block-label--function-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.4rem;
  row-gap: 0.3rem;
}

.tool-exp-k-tree-scenario-block-title {
  flex: 0 0 auto;
  color: var(--accent, #58a6ff);
}

.tool-exp-k-tree-scenario-block-sep {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-weight: 500;
  user-select: none;
}

.tool-exp-k-tree-scenario-block-text {
  padding: 0.45rem 0.55rem;
  font-size: 0.78rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text);
}

.tool-exp-k-tree-product-pill {
  display: inline;
  margin: 0 0.06em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.95em;
  vertical-align: baseline;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.tool-exp-k-tree-product-pill--green {
  color: #fff;
  background: #2d8f47;
  border: 1px solid rgba(255, 255, 255, 0.22);
}
</style>
