<!--
  [INPUT]: 任务动态卡片 props（标题、进行中/完成、起止时刻、进度行含流式片段）
  [OUTPUT]: 淡黄色主题「任务动态」卡：标题栏进行中**不展示**右上角转圈；完成后勾选 + 固定耗时；**完成态行尾不再展示转圈**（`bmcGenUi: spinner` 兜底隐藏）；约 10 行滚动进度区（`.dd-dyn-body-scroll` **随 `rows` 深变更自动滚底**，保证最新进度可见）；默认蓝箭头行、task1 绿色引导行、灰色引用块行（`user_quote` / `bmc_result_quote`）；**`token_validation_mapping_quote`** 为 **Token_Validation_Mapping** JSON（按条 **潜在冲突淡红 / 无冲突淡绿** + **`Target_FeatureID` / `Mapped_L1_Feature`** 深蓝）；**`inference_conclusion_sub`** 为 Target_KV 落库后说人话推理结论（使用/调试均展示）；**`task*_alignment_questionnaire_sub`** 深访问卷正文与配套引导行（产生疑问 / 请在下方回复 / 深访洞察已写入）为**紫色字体**；**`task3_inference_sub`** 等推理调试子区仍为灰色；**`alignment_diff_sub`** 为深访对齐重跑后逐条 diff（灰字修改项/修改前 + 绿字修改后）；`bmc_generating` 行尾内联环形动画（琥珀或蓝）/绿色 ✓；`default` 箭头行也可带 `bmcGenUi === 'check'`（如需求分域「完成…逻辑提炼」行尾绿勾）
  [POS]: 设计详情左侧聊天流子组件

  [PROTOCOL]: 变更任务动态视觉或流式契约时须同步 `design_mode_ux.md` 与 `useDesignDetailChat.ts`；补充需求是/否须同时声明 **`onRequirementSupplementYes` / `onRequirementSupplementNo`**（`DesignDetailPage` 已传入），否则 **`v-if` 会隐藏按钮**；按钮打 `[design-detail:supplement-yes] card_button_*`；**调试「继续」**打 **`[design-detail:debug-pipeline-continue] card_button_continue`**
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import {
  designDetailProgressLineNeedsUserInput,
  designDetailProgressLineShowAwaitingContentSpinner,
} from './designDetailProgressGovernance';
import {
  formatTokenValidationMappingProgressHtml,
  normalizeTokenValidationMappingProgressLineKind,
} from './designDetailTask2L1SyncUiProgress';
import {
  TASK52_LOGIC_PROGRESS_LABEL,
  task52LogicUnderstandingBodyFromProgressText,
} from './designDetailTask52TableDebugProgress';

const props = defineProps<{
  titleText: string;
  /** 任务 1 完成态：淡绿壳；进行中第二张卡仍为淡黄 */
  cardTone?: 'amber' | 'mint_done';
  completed: boolean;
  startedAtMs: number;
  completedAtMs: number | null;
  /** 完成后耗时（秒）展示，外框绿色圆角 */
  durationSec: number | null;
  /** 进度行：id + 已流式展示文本（父组件码点切片）；`kind` / `bmcGenUi` / `spinnerBlue` 见 `useDesignDetailChat` */
  rows: Array<{
    id: string;
    text: string;
    kind?:
      | 'default'
      | 'scope_green'
      | 'user_quote'
      | 'bmc_generating'
      | 'bmc_result_quote'
      | 'token_validation_mapping_quote'
      | 'task2_alignment_questionnaire_sub'
      | 'task3_alignment_questionnaire_sub'
      | 'task4_alignment_questionnaire_sub'
      | 'task5_alignment_questionnaire_sub'
      | 'task51_alignment_questionnaire_sub'
      | 'task55_alignment_questionnaire_sub'
      | 'task6_alignment_questionnaire_sub'
      | 'task65_alignment_questionnaire_sub'
      | 'task7_alignment_questionnaire_sub'
      | 'task8_alignment_questionnaire_sub'
      | 'task85_alignment_questionnaire_sub'
      | 'task9_alignment_questionnaire_sub'
      | 'task10_alignment_questionnaire_sub'
      | 'task3_inference_sub'
      | 'task4_inference_sub'
      | 'task5_inference_sub'
      | 'task51_inference_sub'
      | 'task55_inference_sub'
      | 'task6_inference_sub'
      | 'task65_inference_sub'
      | 'task7_inference_sub'
      | 'task8_inference_sub'
      | 'alignment_diff_sub'
      | 'alignment_user_feedback_sub'
      | 'requirement_supplement_prompt'
      | 'debug_step_continue_prompt'
      | 'inference_conclusion_sub'
      | 'task52_inference_sub'
      | 'task52_logic_understanding'
      | 'task53_inference_sub';
    bmcGenUi?: 'spinner' | 'check';
    alignmentDiff?: { field: string; before: string; after: string };
    /** `bmc_generating` 且 spinner：蓝色环（经营信息提炼） */
    spinnerBlue?: boolean;
  }>;
  /** 本案例持久化聊天快照，供「待用户输入」行尾沙漏门控 */
  sessionMessages: Array<Record<string, unknown>>;
  preliminaryFollowupActive: boolean;
  /** 需求分域提炼完成后「是否继续补充需求」行内「是/否」 */
  onRequirementSupplementYes?: () => void;
  onRequirementSupplementNo?: () => void;
  /** 调试：任务完成后「是否继续」门闩 */
  onDebugPipelineStepContinue?: () => void;
}>();

const cardToneResolved = computed(() => props.cardTone ?? 'amber');

/** 卡内进度区（与外层 `dd-chat-body` 滚动独立） */
const progressScrollRoot = ref<HTMLElement | null>(null);

function scrollProgressBodyToBottom() {
  const el = progressScrollRoot.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

watch(
  () => props.rows,
  async () => {
    await nextTick();
    requestAnimationFrame(() => scrollProgressBodyToBottom());
  },
  { deep: true },
);

onMounted(() => {
  void nextTick(() => requestAnimationFrame(() => scrollProgressBodyToBottom()));
});

/** 已完成任务卡不再展示行尾转圈（兜底：hydrate 快照若残留 `bmcGenUi: spinner` 也不转） */
function rowBmcGenUi(r: { bmcGenUi?: 'spinner' | 'check' }): 'spinner' | 'check' | undefined {
  if (props.completed && r.bmcGenUi === 'spinner') return undefined;
  return r.bmcGenUi;
}

function rowShowSpinner(rowText: string, rowKind?: string): boolean {
  if (props.completed) return false;
  if (
    rowKind === 'bmc_generating' ||
    rowKind === 'bmc_result_quote' ||
    rowKind === 'token_validation_mapping_quote' ||
    isTvmProgressRow(rowKind) ||
    rowKind === 'task2_alignment_questionnaire_sub' ||
    rowKind === 'task3_alignment_questionnaire_sub' ||
    rowKind === 'task4_alignment_questionnaire_sub' ||
    rowKind === 'task5_alignment_questionnaire_sub' ||
    rowKind === 'task51_alignment_questionnaire_sub' ||
    rowKind === 'task55_alignment_questionnaire_sub' ||
    rowKind === 'task6_alignment_questionnaire_sub' ||
    rowKind === 'task65_alignment_questionnaire_sub' ||
    rowKind === 'task7_alignment_questionnaire_sub' ||
    rowKind === 'task8_alignment_questionnaire_sub' ||
    rowKind === 'task85_alignment_questionnaire_sub' ||
    rowKind === 'task9_alignment_questionnaire_sub' ||
    rowKind === 'task10_alignment_questionnaire_sub' ||
    rowKind === 'task3_inference_sub' ||
    rowKind === 'task4_inference_sub' ||
    rowKind === 'task5_inference_sub' ||
    rowKind === 'task51_inference_sub' ||
    rowKind === 'task55_inference_sub' ||
    rowKind === 'task6_inference_sub' ||
    rowKind === 'task65_inference_sub' ||
    rowKind === 'task7_inference_sub' ||
    rowKind === 'task8_inference_sub' ||
    rowKind === 'inference_conclusion_sub' ||
    rowKind === 'alignment_diff_sub' ||
    rowKind === 'alignment_user_feedback_sub' ||
    rowKind === 'debug_step_continue_prompt'
  ) {
    return false;
  }
  return designDetailProgressLineShowAwaitingContentSpinner(rowText, props.sessionMessages, {
    preliminaryFollowupActive: props.preliminaryFollowupActive,
  });
}

function rowAwaitInput(rowText: string): boolean {
  return designDetailProgressLineNeedsUserInput(rowText);
}

/** 已完成时展示的固定秒数（不随墙钟刷新） */
const completedTotalSec = computed(() => {
  if (props.durationSec != null) return Math.max(0, props.durationSec);
  if (props.completed && props.completedAtMs != null) {
    return Math.max(0, Math.round((props.completedAtMs - props.startedAtMs) / 1000));
  }
  return 0;
});

function splitArrowBody(text: string): { arrow: string; body: string } {
  const t = String(text || '');
  if (t.startsWith('→')) {
    return { arrow: '→', body: t.slice(1) };
  }
  return { arrow: '', body: t };
}

const ALIGNMENT_QUESTIONNAIRE_SUB_KINDS = new Set([
  'task2_alignment_questionnaire_sub',
  'task3_alignment_questionnaire_sub',
  'task4_alignment_questionnaire_sub',
  'task5_alignment_questionnaire_sub',
  'task51_alignment_questionnaire_sub',
  'task55_alignment_questionnaire_sub',
  'task6_alignment_questionnaire_sub',
  'task65_alignment_questionnaire_sub',
  'task7_alignment_questionnaire_sub',
  'task8_alignment_questionnaire_sub',
  'task85_alignment_questionnaire_sub',
  'task9_alignment_questionnaire_sub',
  'task10_alignment_questionnaire_sub',
]);

function isAlignmentQuestionnaireSubKind(kind?: string): boolean {
  return ALIGNMENT_QUESTIONNAIRE_SUB_KINDS.has(String(kind ?? ''));
}

/** 深访问卷推送配套引导行（产生疑问 / 请在下方回复 / 深访洞察已写入 / 正在生成对齐问卷） */
function isAlignmentQuestionnaireGuideLine(text?: string): boolean {
  const t = String(text ?? '').trim();
  if (!t) return false;
  if (t.includes('请在下方回复上述问卷')) return true;
  if (t.includes('深访洞察已写入')) return true;
  if (t.includes('产生疑问')) return true;
  if (t.includes('对齐问卷') && t.includes('正在生成')) return true;
  return false;
}

function alignmentQuestionnaireAriaLabel(kind?: string): string {
  switch (kind) {
    case 'task10_alignment_questionnaire_sub':
      return '任务 10 反向验证对齐问卷';
    case 'task9_alignment_questionnaire_sub':
      return '任务 9 反向验证对齐问卷';
    case 'task85_alignment_questionnaire_sub':
      return '任务 8.5 反向验证对齐问卷';
    case 'task8_alignment_questionnaire_sub':
      return '任务 8 反向验证对齐问卷';
    case 'task7_alignment_questionnaire_sub':
      return '任务 7 反向验证对齐问卷';
    case 'task6_alignment_questionnaire_sub':
      return '任务 6 反向验证对齐问卷';
    case 'task65_alignment_questionnaire_sub':
      return '任务 6.5 反向验证对齐问卷';
    case 'task55_alignment_questionnaire_sub':
      return '任务 5.5 反向验证对齐问卷';
    case 'task51_alignment_questionnaire_sub':
      return '任务 5.1 反向验证对齐问卷';
    case 'task5_alignment_questionnaire_sub':
      return '任务 5 反向验证对齐问卷';
    case 'task4_alignment_questionnaire_sub':
      return '任务 4 反向验证对齐问卷';
    case 'task3_alignment_questionnaire_sub':
      return '任务 3 对齐问卷';
    default:
      return '任务 2 对齐问卷';
  }
}

/** 查证「继续补充 → 是/否」是否点到；控制台搜 `[design-detail:supplement-yes] card_button_` */
function onSupplementYesClick() {
  const n = props.rows.filter((r) => r.kind === 'requirement_supplement_prompt').length;
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info('[design-detail:supplement-yes] card_button_yes', {
      hasHandler: typeof props.onRequirementSupplementYes === 'function',
      supplementKindRowsInProps: n,
      propsRowCount: props.rows.length,
    });
  }
  props.onRequirementSupplementYes?.();
}

function onSupplementNoClick() {
  const n = props.rows.filter((r) => r.kind === 'requirement_supplement_prompt').length;
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info('[design-detail:supplement-yes] card_button_no', {
      hasHandler: typeof props.onRequirementSupplementNo === 'function',
      supplementKindRowsInProps: n,
      propsRowCount: props.rows.length,
    });
  }
  props.onRequirementSupplementNo?.();
}

function onDebugContinueClick() {
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info('[design-detail:debug-pipeline-continue] card_button_continue', {
      hasHandler: typeof props.onDebugPipelineStepContinue === 'function',
    });
  }
  props.onDebugPipelineStepContinue?.();
}

function resolveRowDisplayKind(kind?: string, text?: string): string {
  return normalizeTokenValidationMappingProgressLineKind(kind, String(text ?? ''));
}

function isTvmProgressRow(kind?: string, text?: string): boolean {
  return resolveRowDisplayKind(kind, text) === 'token_validation_mapping_quote';
}

function rowKindClass(kind?: string, text?: string): string {
  if (kind === 'scope_green') return 'dd-dyn-line--scope-green';
  if (kind === 'requirement_supplement_prompt') return 'dd-dyn-line--scope-green';
  if (kind === 'debug_step_continue_prompt') return 'dd-dyn-line--debug-continue';
  if (isTvmProgressRow(kind, text)) return 'dd-dyn-line--tvm-quote';
  if (kind === 'user_quote' || kind === 'bmc_result_quote') {
    return 'dd-dyn-line--user-quote';
  }
  if (
    kind === 'task3_inference_sub' ||
    kind === 'task4_inference_sub' ||
    kind === 'task5_inference_sub' ||
    kind === 'task51_inference_sub' ||
    kind === 'task52_inference_sub' ||
    kind === 'task53_inference_sub' ||
    kind === 'task55_inference_sub' ||
    kind === 'task6_inference_sub' ||
    kind === 'task65_inference_sub' ||
    kind === 'task7_inference_sub' ||
    kind === 'task8_inference_sub'
  )
    return 'dd-dyn-line--task3-sub';
  if (isAlignmentQuestionnaireSubKind(kind)) return 'dd-dyn-line--alignment-questionnaire';
  if (isAlignmentQuestionnaireGuideLine(text)) return 'dd-dyn-line--alignment-questionnaire-guide';
  if (kind === 'alignment_diff_sub') return 'dd-dyn-line--alignment-diff';
  if (kind === 'alignment_user_feedback_sub') return 'dd-dyn-line--alignment-user-feedback';
  if (kind === 'inference_conclusion_sub') return 'dd-dyn-line--inference-conclusion';
  if (kind === 'task52_logic_understanding') return 'dd-dyn-line--task52-logic';
  return '';
}
</script>

<template>
  <article
    class="dd-dyn"
    :class="{
      'dd-dyn--done': completed,
      'dd-dyn--mint-done': cardToneResolved === 'mint_done',
    }"
  >
    <header class="dd-dyn-head">
      <span class="dd-dyn-title">{{ titleText }}</span>
      <span v-if="completed" class="dd-dyn-head-right dd-dyn-head-right--done" aria-live="polite">
        <span class="dd-dyn-check" aria-hidden="true">✓</span>
        <span class="dd-dyn-elapsed dd-dyn-elapsed--boxed">{{ completedTotalSec }}s</span>
      </span>
    </header>
    <div ref="progressScrollRoot" class="dd-dyn-body-scroll" role="log" aria-label="任务进度">
      <div
        v-for="r in rows"
        :key="r.id"
        class="dd-dyn-line"
        :class="[
          rowKindClass(r.kind, r.text),
          {
            'dd-dyn-line--await-input':
              (!r.kind || r.kind === 'default') && rowAwaitInput(r.text),
          },
        ]"
      >
        <template v-if="r.kind === 'user_quote'">
          <span class="dd-dyn-line-rest dd-dyn-line-rest--quote">{{ r.text }}</span>
        </template>
        <template v-else-if="r.kind === 'alignment_user_feedback_sub'">
          <span class="dd-dyn-line-rest dd-dyn-line-rest--alignment-user-feedback">{{ r.text }}</span>
        </template>
        <template v-else-if="r.kind === 'alignment_diff_sub' && r.alignmentDiff">
          <div
            class="dd-dyn-alignment-diff-line"
            role="listitem"
            :aria-label="`修改项 ${r.alignmentDiff.field}`"
          >
            <span class="dd-dyn-alignment-diff-before"
              >【{{ r.alignmentDiff.field }}】：【{{ r.alignmentDiff.before }}】</span
            ><span class="dd-dyn-alignment-diff-arrow"> → </span
            ><span class="dd-dyn-alignment-diff-after">【{{ r.alignmentDiff.after }}】</span>
          </div>
        </template>
        <template v-else-if="isTvmProgressRow(r.kind, r.text)">
          <span
            class="dd-dyn-line-rest dd-dyn-line-rest--tvm-json"
            v-html="formatTokenValidationMappingProgressHtml(r.text)"
          />
        </template>
        <template v-else-if="r.kind === 'bmc_result_quote'">
          <span class="dd-dyn-line-rest dd-dyn-line-rest--quote dd-dyn-line-rest--bmc-json">{{ r.text }}</span>
        </template>
        <template v-else-if="r.kind === 'inference_conclusion_sub'">
          <div class="dd-dyn-inference-conclusion" role="listitem">
            <span class="dd-dyn-inference-conclusion-text">{{ r.text }}</span>
          </div>
        </template>
        <template v-else-if="isAlignmentQuestionnaireSubKind(r.kind)">
          <div
            class="dd-dyn-alignment-questionnaire"
            role="region"
            :aria-label="alignmentQuestionnaireAriaLabel(r.kind)"
          >
            <span class="dd-dyn-alignment-questionnaire-text">{{ r.text }}</span>
          </div>
        </template>
        <template
          v-else-if="
            r.kind === 'task3_inference_sub' ||
            r.kind === 'task4_inference_sub' ||
            r.kind === 'task5_inference_sub' ||
            r.kind === 'task51_inference_sub' ||
            r.kind === 'task52_inference_sub' ||
            r.kind === 'task53_inference_sub' ||
            r.kind === 'task55_inference_sub' ||
            r.kind === 'task6_inference_sub' ||
            r.kind === 'task65_inference_sub' ||
            r.kind === 'task7_inference_sub' ||
            r.kind === 'task8_inference_sub'
          "
        >
          <div
            class="dd-dyn-task3-sub"
            role="region"
            :aria-label="
              r.kind === 'task8_inference_sub'
                ? '任务 8 推理结果'
                : r.kind === 'task7_inference_sub'
                ? '任务 7 推理结果'
                : r.kind === 'task6_inference_sub'
                ? '任务 6 推理结果'
                : r.kind === 'task65_inference_sub'
                ? '任务 6.5 推理结果'
                : r.kind === 'task55_inference_sub'
                ? '任务 5.5 推理结果'
                : r.kind === 'task52_inference_sub'
                ? '任务 5.2 推理结果'
                : r.kind === 'task53_inference_sub'
                ? '任务 5.3 推理结果'
                : r.kind === 'task51_inference_sub'
                ? '任务 5.1 推理结果'
                : r.kind === 'task5_inference_sub'
                  ? '任务 5 推理结果'
                  : r.kind === 'task4_inference_sub'
                    ? '任务 4 推理结果'
                    : r.kind === 'task3_inference_sub'
                        ? '任务 3 推理结果'
                        : '任务 2 对齐问卷'
            "
          >
            <span class="dd-dyn-task3-sub-text">{{ r.text }}</span>
          </div>
        </template>
        <template v-else-if="r.kind === 'bmc_generating' && splitArrowBody(r.text).arrow">
          <span class="dd-dyn-arrow">{{ splitArrowBody(r.text).arrow }}</span>
          <span class="dd-dyn-line-rest">{{ splitArrowBody(r.text).body }}</span>
          <span
            v-if="rowBmcGenUi(r) === 'spinner'"
            class="dd-dyn-inline-ring"
            :class="{ 'dd-dyn-inline-ring--blue': r.spinnerBlue }"
            aria-hidden="true"
          />
          <span v-else-if="rowBmcGenUi(r) === 'check'" class="dd-dyn-inline-check" aria-hidden="true">✓</span>
        </template>
        <template v-else-if="r.kind === 'debug_step_continue_prompt' && splitArrowBody(r.text).arrow">
          <div class="dd-dyn-supplement-row">
            <span class="dd-dyn-arrow">{{ splitArrowBody(r.text).arrow }}</span>
            <span class="dd-dyn-line-rest dd-dyn-line-rest--scope">{{ splitArrowBody(r.text).body }}</span>
          </div>
          <div
            v-if="onDebugPipelineStepContinue"
            class="dd-dyn-supplement-actions"
            role="group"
            aria-label="调试是否继续"
          >
            <button type="button" class="dd-dyn-supplement-btn dd-dyn-supplement-btn--continue" @click="onDebugContinueClick">
              继续
            </button>
          </div>
        </template>
        <template v-else-if="r.kind === 'task52_logic_understanding' && splitArrowBody(r.text).arrow">
          <span class="dd-dyn-arrow">{{ splitArrowBody(r.text).arrow }}</span>
          <span class="dd-dyn-task52-logic-wrap">
            <strong class="dd-dyn-task52-logic-label">{{ TASK52_LOGIC_PROGRESS_LABEL }}</strong>
            <span class="dd-dyn-task52-logic-body">{{
              task52LogicUnderstandingBodyFromProgressText(r.text)
            }}</span>
          </span>
        </template>
        <template v-else-if="r.kind === 'requirement_supplement_prompt' && splitArrowBody(r.text).arrow">
          <div class="dd-dyn-supplement-row">
            <span class="dd-dyn-arrow">{{ splitArrowBody(r.text).arrow }}</span>
            <span class="dd-dyn-line-rest dd-dyn-line-rest--scope">{{ splitArrowBody(r.text).body }}</span>
          </div>
          <div
            v-if="onRequirementSupplementYes && onRequirementSupplementNo"
            class="dd-dyn-supplement-actions"
            role="group"
            aria-label="是否继续补充需求"
          >
            <button type="button" class="dd-dyn-supplement-btn" @click="onSupplementYesClick">是</button>
            <button type="button" class="dd-dyn-supplement-btn" @click="onSupplementNoClick">否</button>
          </div>
        </template>
        <template v-else-if="splitArrowBody(r.text).arrow">
          <span class="dd-dyn-arrow">{{ splitArrowBody(r.text).arrow }}</span>
          <span
            class="dd-dyn-line-rest"
            :class="{ 'dd-dyn-line-rest--scope': r.kind === 'scope_green' }"
          >{{ splitArrowBody(r.text).body }}</span>
          <span
            v-if="rowBmcGenUi(r) === 'spinner'"
            class="dd-dyn-inline-ring"
            :class="{ 'dd-dyn-inline-ring--blue': r.spinnerBlue }"
            aria-hidden="true"
          />
          <span v-else-if="rowBmcGenUi(r) === 'check'" class="dd-dyn-inline-check" aria-hidden="true">✓</span>
        </template>
        <span v-else class="dd-dyn-line-rest">{{ r.text }}</span>
        <span
          v-if="(!r.kind || r.kind === 'default') && rowShowSpinner(r.text, r.kind)"
          class="dd-dyn-hourglass"
          aria-hidden="true"
        >⏳</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.dd-dyn {
  border-radius: 12px;
  border: 1px solid #f0e6c8;
  background: linear-gradient(180deg, #fffbeb 0%, #fef9c3 48%, #fffbeb 100%);
  box-shadow: 0 1px 3px rgba(180, 83, 9, 0.12);
  overflow: hidden;
}

/* 任务 1 已收官：淡绿主题（与进行中淡黄卡区分） */
.dd-dyn--mint-done {
  border-color: #bbf7d0;
  background: linear-gradient(180deg, #ecfdf5 0%, #d1fae5 48%, #ecfdf5 100%);
  box-shadow: 0 1px 3px rgba(22, 101, 52, 0.12);
}

.dd-dyn--mint-done .dd-dyn-head {
  border-bottom-color: rgba(34, 197, 94, 0.35);
  background: rgba(236, 253, 245, 0.95);
}

.dd-dyn--mint-done .dd-dyn-title {
  color: #14532d;
}

.dd-dyn-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  padding: 0.5rem 0.65rem;
  border-bottom: 1px solid rgba(234, 179, 8, 0.35);
  background: rgba(255, 251, 235, 0.95);
}

.dd-dyn-title {
  font-weight: 700;
  font-size: 0.88rem;
  color: #78350f;
  flex: 1 1 auto;
  min-width: 0;
}

.dd-dyn-head-right {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.dd-dyn-head-right--done .dd-dyn-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  background: #16a34a;
  color: #fff;
  font-size: 0.62rem;
  font-weight: 800;
  line-height: 1;
}

@keyframes dd-dyn-spin {
  to {
    transform: rotate(360deg);
  }
}

.dd-dyn-elapsed {
  font-size: 0.78rem;
  font-weight: 700;
  color: #92400e;
  font-variant-numeric: tabular-nums;
}

.dd-dyn-elapsed--boxed {
  padding: 0.12rem 0.45rem;
  border-radius: 8px;
  border: 1px solid #86efac;
  background: #ecfdf5;
  color: #166534;
}

.dd-dyn-body-scroll {
  max-height: calc(1.35em * 10 + 0.7rem);
  min-height: 2.4rem;
  overflow-y: auto;
  padding: 0.4rem 0.55rem 0.55rem;
  background: rgba(255, 255, 255, 0.45);
}

.dd-dyn-line {
  font-size: 0.78rem;
  line-height: 1.35;
  padding: 0.12rem 0;
  color: #1e293b;
  word-break: break-word;
  white-space: pre-wrap;
}

.dd-dyn-arrow {
  color: #2563eb;
  font-weight: 700;
  margin-right: 0.15em;
}

.dd-dyn-line-rest {
  color: #334155;
}

.dd-dyn-line--await-input .dd-dyn-line-rest {
  color: #1d4ed8;
  font-weight: 500;
}

/* 任务 1：绿色引导行（箭头 + 正文均偏绿） */
.dd-dyn-line--scope-green .dd-dyn-arrow {
  color: #16a34a;
}

.dd-dyn-line-rest--scope {
  color: #15803d;
  font-weight: 600;
}

/* 调试门闩行：与绿引导区分 */
.dd-dyn-line--debug-continue .dd-dyn-arrow {
  color: #4f46e5;
}

.dd-dyn-line--debug-continue .dd-dyn-line-rest--scope {
  color: #3730a3;
}

.dd-dyn-supplement-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.15rem 0.25rem;
}

.dd-dyn-supplement-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0.4rem 0 0.1rem 1.15rem;
}

.dd-dyn-supplement-btn {
  appearance: none;
  border: none;
  border-radius: 7px;
  padding: 0.28rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  background: #2563eb;
  color: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
}

.dd-dyn-supplement-btn:hover {
  background: #1d4ed8;
}

.dd-dyn-supplement-btn:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 2px;
}

/* 用户输入引用块：整行灰字，保留流式逐字揭示 */
.dd-dyn-line--user-quote .dd-dyn-line-rest--quote {
  display: block;
  color: #64748b;
  font-weight: 400;
  font-size: 0.76rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  padding-left: 0.15rem;
  border-left: 2px solid #e2e8f0;
  margin-top: 0.08rem;
}

.dd-dyn-line-rest--bmc-json {
  margin-top: 0.12rem;
  color: #94a3b8;
  font-size: 0.74rem;
}

/* Token_Validation_Mapping：独立行类，避免 `.dd-dyn-line--user-quote` 灰字盖掉分色 */
.dd-dyn-line--tvm-quote {
  padding: 0.04rem 0;
}

.dd-dyn-line--tvm-quote .dd-dyn-line-rest--tvm-json {
  display: block;
  margin-top: 0.12rem;
  padding-left: 0.15rem;
  border-left: 2px solid #fecaca;
  font-size: 0.74rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.dd-dyn-line--tvm-quote .dd-dyn-line-rest--tvm-json :deep(.dd-dyn-tvm-record--warn) {
  color: #e57373;
}

.dd-dyn-line--tvm-quote .dd-dyn-line-rest--tvm-json :deep(.dd-dyn-tvm-record--ok) {
  color: #81c784;
}

.dd-dyn-line--tvm-quote .dd-dyn-line-rest--tvm-json :deep(.dd-dyn-tvm-fallback) {
  color: #94a3b8;
}

.dd-dyn-line--tvm-quote .dd-dyn-line-rest--tvm-json :deep(.dd-dyn-tvm-array) {
  color: #64748b;
}

.dd-dyn-line--tvm-quote .dd-dyn-line-rest--tvm-json :deep(.dd-dyn-tvm-record .dd-dyn-tvm-em) {
  color: #1e3a8a;
  font-weight: 700;
}

/* 深访问卷：问卷正文子区（紫色字体，与顶栏当前任务标签同色阶） */
.dd-dyn-line--alignment-questionnaire {
  padding: 0.08rem 0;
}

.dd-dyn-alignment-questionnaire {
  margin: 0.12rem 0 0.08rem 0.5rem;
  padding: 0.28rem 0.45rem 0.38rem;
  border-radius: 8px;
  background: rgba(245, 243, 255, 0.95);
  border: 1px solid #ddd6fe;
  border-left: 3px solid #7c3aed;
}

.dd-dyn-alignment-questionnaire-text {
  display: block;
  color: #6d28d9;
  font-weight: 500;
  font-size: 0.74rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 深访问卷：产生疑问 / 请在下方回复 / 深访洞察已写入 / 正在生成对齐问卷 */
.dd-dyn-line--alignment-questionnaire-guide .dd-dyn-arrow {
  color: #7c3aed;
}

.dd-dyn-line--alignment-questionnaire-guide .dd-dyn-line-rest,
.dd-dyn-line--alignment-questionnaire-guide .dd-dyn-line-rest--scope {
  color: #6d28d9;
  font-weight: 500;
}

/* 任务 3 L2：「推理完成」行下方的灰色子区域（模型输出） */
.dd-dyn-line--task3-sub {
  padding: 0.08rem 0;
}

.dd-dyn-task3-sub {
  margin: 0.12rem 0 0.08rem 0.5rem;
  padding: 0.28rem 0.45rem 0.38rem;
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid #e2e8f0;
}

.dd-dyn-task3-sub-text {
  display: block;
  color: #64748b;
  font-weight: 400;
  font-size: 0.74rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 任务 5.2 调试：逻辑理解正文灰字 + 「逻辑理解：」黑体 */
.dd-dyn-line--task52-logic {
  padding: 0.06rem 0;
}

.dd-dyn-task52-logic-wrap {
  display: inline;
  word-break: break-word;
  white-space: pre-wrap;
}

.dd-dyn-task52-logic-label {
  color: #0f172a;
  font-weight: 700;
}

.dd-dyn-task52-logic-body {
  color: #64748b;
  font-weight: 400;
  font-size: 0.76rem;
  line-height: 1.45;
}

.dd-dyn-line--inference-conclusion {
  padding: 0.04rem 0;
}

.dd-dyn-inference-conclusion {
  margin: 0.08rem 0 0.06rem 0.35rem;
  padding: 0.22rem 0.5rem 0.28rem;
  border-radius: 8px;
  background: rgba(240, 253, 244, 0.75);
  border-left: 3px solid #22c55e;
}

.dd-dyn-inference-conclusion-text {
  display: block;
  color: #1e293b;
  font-weight: 400;
  font-size: 0.76rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.dd-dyn-line--alignment-diff {
  padding: 0.04rem 0;
}

.dd-dyn-line--alignment-user-feedback {
  padding: 0.04rem 0 0.12rem 0.5rem;
}

.dd-dyn-line-rest--alignment-user-feedback {
  font-size: 0.78rem;
  line-height: 1.45;
  color: #5b21b6;
  white-space: pre-wrap;
  word-break: break-word;
}

.dd-dyn-alignment-diff-line {
  margin: 0.1rem 0 0.06rem 0.5rem;
  font-size: 0.74rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.dd-dyn-alignment-diff-before,
.dd-dyn-alignment-diff-arrow {
  color: #64748b;
  font-weight: 400;
}

.dd-dyn-alignment-diff-after {
  color: #16a34a;
  font-weight: 500;
}

.dd-dyn-inline-ring {
  display: inline-block;
  width: 0.65rem;
  height: 0.65rem;
  margin-left: 0.35em;
  border-radius: 50%;
  border: 2px solid rgba(245, 158, 11, 0.35);
  border-top-color: #d97706;
  vertical-align: -0.12em;
  animation: dd-dyn-spin 0.7s linear infinite;
}

.dd-dyn-inline-ring--blue {
  border-color: rgba(59, 130, 246, 0.35);
  border-top-color: #2563eb;
}

.dd-dyn-inline-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.85rem;
  height: 0.85rem;
  margin-left: 0.3em;
  border-radius: 50%;
  background: #16a34a;
  color: #fff;
  font-size: 0.55rem;
  font-weight: 800;
  line-height: 1;
  vertical-align: -0.1em;
}

.dd-dyn-hourglass {
  display: inline-block;
  margin-left: 0.2em;
  font-size: 0.92em;
  vertical-align: -0.08em;
  animation: dd-dyn-hourglass-rotate 0.85s linear infinite;
}

@keyframes dd-dyn-hourglass-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
