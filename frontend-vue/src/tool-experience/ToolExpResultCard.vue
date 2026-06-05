<!--
  [INPUT]: 解析结果 JSON 切片（与五大卡片字段对应）
  [OUTPUT]: 可折叠卡片，含 view / json 子标签
  [POS]: 工具经验「解析工作区」专用

  [PROTOCOL]: 字段展示与 capability-prompt V3 输出结构对齐（tool_comparison 为数组；兼容旧版 object）；变更时同步 `AGENTS.md`
-->
<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  title: string;
  variant: 'doc' | 'scenarios' | 'tool_comparison' | 'core' | 'fingerprint';
  data: unknown;
}>();

const subTab = ref<'view' | 'json'>('view');

const jsonText = computed(() => {
  try {
    return JSON.stringify(props.data ?? {}, null, 2);
  } catch {
    return '{}';
  }
});

function str(v: unknown): string {
  if (v === null || v === undefined) return '暂无';
  if (typeof v === 'string') return v.trim() || '暂无';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '暂无';
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).filter(Boolean);
}

const docSlice = computed(() =>
  props.variant === 'doc' && props.data && typeof props.data === 'object' && !Array.isArray(props.data)
    ? (props.data as Record<string, unknown>)
    : null,
);

const scenariosList = computed(() => (Array.isArray(props.data) ? props.data : []));

/** V3：{ comparison_tools, dimension, comparison_detail }[]；旧版：Record<维度, 描述> */
const comparisonRows = computed(() => {
  const d = props.data;
  if (Array.isArray(d)) {
    return d
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => {
        const o = item as Record<string, unknown>;
        const tools = strList(o.comparison_tools);
        const dimension =
          typeof o.dimension === 'string' && o.dimension.trim() ? o.dimension.trim() : '暂无';
        const detail =
          typeof o.comparison_detail === 'string' && o.comparison_detail.trim()
            ? o.comparison_detail.trim()
            : '暂无';
        return { comparison_tools: tools, dimension, comparison_detail: detail };
      });
  }
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    return Object.entries(d as Record<string, unknown>).map(([dim, desc]) => ({
      comparison_tools: [] as string[],
      dimension: dim,
      comparison_detail: str(desc),
    }));
  }
  return [];
});

const coreProducts = computed(() => (Array.isArray(props.data) ? props.data : []));

const fingerprintProducts = computed(() => (Array.isArray(props.data) ? props.data : []));

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
</script>

<template>
  <details class="tool-exp-card" open>
    <summary>{{ title }}</summary>
    <div class="tool-exp-card-panel">
      <div class="tool-exp-card-subtablist" role="tablist" :aria-label="`${title} 展示方式`">
        <button
          type="button"
          role="tab"
          class="problem-detail-card-tab"
          :class="{ 'problem-detail-card-tab-active': subTab === 'view' }"
          :aria-selected="subTab === 'view'"
          @click="subTab = 'view'"
        >
          view
        </button>
        <button
          type="button"
          role="tab"
          class="problem-detail-card-tab"
          :class="{ 'problem-detail-card-tab-active': subTab === 'json' }"
          :aria-selected="subTab === 'json'"
          @click="subTab = 'json'"
        >
          json
        </button>
      </div>

      <div v-show="subTab === 'json'" class="tool-exp-card-json-wrap" role="tabpanel">
        <pre class="tool-exp-card-pre tool-exp-card-pre-json">{{ jsonText }}</pre>
      </div>

      <div v-show="subTab === 'view'" class="tool-exp-card-view" role="tabpanel">
        <template v-if="variant === 'doc' && docSlice">
          <div class="tool-exp-view-block">
            <div class="tool-exp-view-label">识别时间戳</div>
            <div class="tool-exp-view-value">{{ str(docSlice.identification_timestamp) }}</div>
          </div>
          <div class="tool-exp-view-block">
            <div class="tool-exp-view-label">文档摘要</div>
            <div class="tool-exp-view-value tool-exp-view-multiline">{{ str(docSlice.document_summary) }}</div>
          </div>
        </template>

        <template v-else-if="variant === 'scenarios'">
          <p v-if="scenariosList.length === 0" class="tool-exp-view-empty">暂无场景数据</p>
          <div
            v-for="(sc, si) in scenariosList"
            v-else
            :key="si"
            class="tool-exp-view-scenario"
          >
            <div class="tool-exp-view-scenario-title">场景 {{ si + 1 }}</div>
            <template v-if="sc && typeof sc === 'object' && !Array.isArray(sc)">
              <div class="tool-exp-view-kv">
                <span class="tool-exp-view-k">所属行业</span>
                <span class="tool-exp-view-v">{{ str((sc as Record<string, unknown>).industry) }}</span>
              </div>
              <div class="tool-exp-view-kv">
                <span class="tool-exp-view-k">场景描述</span>
                <span class="tool-exp-view-v tool-exp-view-multiline">{{
                  str((sc as Record<string, unknown>).description)
                }}</span>
              </div>
              <div class="tool-exp-view-kv">
                <span class="tool-exp-view-k">功能实现</span>
                <span class="tool-exp-view-v tool-exp-view-multiline">{{
                  str((sc as Record<string, unknown>).function_achieved)
                }}</span>
              </div>
              <div class="tool-exp-view-kv">
                <span class="tool-exp-view-k">使用产品</span>
                <span class="tool-exp-view-v">{{
                  strList((sc as Record<string, unknown>).products_used).join('、') || '暂无'
                }}</span>
              </div>
            </template>
          </div>
        </template>

        <template v-else-if="variant === 'tool_comparison'">
          <p v-if="comparisonRows.length === 0" class="tool-exp-view-empty">暂无对比数据</p>
          <div
            v-for="(row, ci) in comparisonRows"
            v-else
            :key="ci"
            class="tool-exp-view-compare-row"
          >
            <div v-if="row.comparison_tools.length" class="tool-exp-view-compare-tools">
              对比工具：{{ row.comparison_tools.join('、') }}
            </div>
            <div class="tool-exp-view-compare-dim">{{ row.dimension }}</div>
            <div class="tool-exp-view-compare-desc tool-exp-view-multiline">{{ row.comparison_detail }}</div>
          </div>
        </template>

        <template v-else-if="variant === 'core'">
          <p v-if="coreProducts.length === 0" class="tool-exp-view-empty">暂无产品功能数据</p>
          <template v-else>
            <div
              v-for="(prod, pi) in coreProducts"
              :key="pi"
            >
              <div v-if="prod && typeof prod === 'object' && !Array.isArray(prod)" class="tool-exp-view-product">
                <h4 class="tool-exp-view-product-name">
                  {{ str((prod as Record<string, unknown>).product_name) }}
                </h4>
                <template
                  v-for="(fn, fi) in (Array.isArray((prod as Record<string, unknown>).core_functions)
                    ? (prod as Record<string, unknown>).core_functions
                    : [])"
                  :key="fi"
                >
                  <div v-if="fn && typeof fn === 'object' && !Array.isArray(fn)" class="tool-exp-view-fn">
                    <div class="tool-exp-view-fn-name">
                      {{ str((fn as Record<string, unknown>).function_name) }}
                    </div>
                    <div v-if="strList((fn as Record<string, unknown>).selling_points).length" class="tool-exp-view-sub">
                      <span class="tool-exp-view-sub-label">核心卖点</span>
                      <ul class="tool-exp-view-ul">
                        <li v-for="(sp, spi) in strList((fn as Record<string, unknown>).selling_points)" :key="spi">
                          {{ sp }}
                        </li>
                      </ul>
                    </div>
                    <div v-if="strList((fn as Record<string, unknown>).operation_steps).length" class="tool-exp-view-sub">
                      <span class="tool-exp-view-sub-label">操作指引</span>
                      <ol class="tool-exp-view-ol">
                        <li v-for="(st, sti) in strList((fn as Record<string, unknown>).operation_steps)" :key="sti">
                          {{ st }}
                        </li>
                      </ol>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </template>

        <template v-else-if="variant === 'fingerprint'">
          <p v-if="fingerprintProducts.length === 0" class="tool-exp-view-empty">暂无能力画像数据</p>
          <template v-else>
            <div
              v-for="(prod, pi) in fingerprintProducts"
              :key="pi"
            >
              <div v-if="prod && typeof prod === 'object' && !Array.isArray(prod)" class="tool-exp-view-product">
                <h4 class="tool-exp-view-product-name">
                  {{ str((prod as Record<string, unknown>).product_name) }}
                </h4>
                <div
                  v-if="
                    (prod as Record<string, unknown>).capability_fingerprint &&
                    typeof (prod as Record<string, unknown>).capability_fingerprint === 'object' &&
                    !Array.isArray((prod as Record<string, unknown>).capability_fingerprint)
                  "
                  class="tool-exp-view-fp-grid"
                >
                  <template v-for="key in FP_KEY_ORDER" :key="key">
                    <div class="tool-exp-view-fp-k">{{ FP_LABELS[key] ?? key }}</div>
                    <div class="tool-exp-view-fp-v tool-exp-view-multiline">
                      {{
                        str(
                          (
                            (prod as Record<string, unknown>).capability_fingerprint as Record<string, unknown>
                          )[key],
                        )
                      }}
                    </div>
                  </template>
                </div>
                <div class="tool-exp-view-block tool-exp-view-block-tight">
                  <div class="tool-exp-view-label">识别问题</div>
                  <div class="tool-exp-view-value tool-exp-view-multiline">
                    {{ str((prod as Record<string, unknown>).identified_issues) }}
                  </div>
                </div>
                <div class="tool-exp-view-block tool-exp-view-block-tight">
                  <div class="tool-exp-view-label">架构建议</div>
                  <div class="tool-exp-view-value tool-exp-view-multiline">
                    {{ str((prod as Record<string, unknown>).architecture_advice) }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>
  </details>
</template>
