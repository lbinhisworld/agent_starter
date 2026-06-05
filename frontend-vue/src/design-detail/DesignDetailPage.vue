<!--
  [INPUT]: URL query（caseId、customerName、archiveNo）；`window` 注入 auth-runtime / storage / problemCaseApi；`useDesignDetailChat`
  [OUTPUT]: 设计详情独立页：顶栏（**右上角「使用模式 / 调试模式」**切换；**「LLM」可拖拽磨砂浮层**（`DesignDetailLlmLogFloatingPanel`，**每次 LLM 调用结束后若浮层已打开则自动刷新列表**，不挡下层操作）、**「逻辑」**推理图只读弹层与 **「Tree」** 跨任务链贝塞尔视图 `DesignDetailLogicTreeModal`（绑定 **`logicTreeGraphRefreshTick`**，任务 2 L1 落库叙事后 Tree 已开时自动重拉图））+ 状态条 + **桌面（≥901px）：`.dd-app` 视口定高、`dd-top-nav`/`dd-case-headline`/左侧 `.dd-chat` 整列固定于视口内不随文档滚动；`.dd-main` 占满剩余高度；右侧 `.dd-workspace` 内 `.dd-workspace-body` 独立纵向滚动（横向 Tab 栏固定在白盒顶部，其下画布内容滚动），**Tab 栏右侧全屏按钮**（Fullscreen API 占满视口）；不再把整页顶出滚动条**；**窄屏**：维持纵向堆叠与整页滚动 + 左 1/3 任务进展（无「任务动态」小标题，直接淡黄进度卡；**`dd-chat-body` 外层滚底** + **`DesignTaskDynamicsCard` 卡内 `.dd-dyn-body-scroll` 滚底**，保证最新进度可见）+ 右 2/3 亮色 **动态 Tab 画布区**（案例概览 +「客户基本信息」+ **「需求提炼」**：顶栏 **「合并需求」** 绿底白字固定可折叠根卡片 + 与同套子 Tab（`mergedCustomerRequirementParsed`）；其下各次提炼根卡片 **新在上旧在下**，头区可折叠子 Tab，**蓝底白字**序号在标题左侧（`distillOrdinal`），**列表首条（时间上最新）** 标题 **蓝色**；**每新增一种画布横向 Tab** 由 `useDesignDetailChat` 将 `activeDesignCanvasTabId` 切至该 Tab；**当前激活**画布 Tab（`.dd-tab--on`）**蓝色闪烁光晕边缘**（与底部输入等待态同系 keyframes）；**「核心业务对象」**见 `DesignDetailRequirementCoreEntitiesPanel.vue`；**其余提炼子维度**见 `DesignDetailRequirementPrelimPanels.vue` + `designDetailRequirementPrelimCanvasHtml.ts`，结构与详情页初步需求 view 分区同构、亮色 `dd-prelim-*` 样式）；任务 1 等待工商或 **等待输入客户需求**（`designChatInputHighlightTask1ScopeOrRequirementAwait`）时底部输入框 **蓝色闪烁光晕** + 专用占位；**发送中**（`sendBusy`）不套光晕 class
  [POS]: `design-detail.html` 根组件

  [PROTOCOL]: 顶栏含「← 返回首页」（跳转 `home.html`）；不含用户信息、「模型配置」「退出登录」；「选择重启」见 `restartFromSelectedLineTaskAnchor`；「重启当前」/「完全重启」见 `useDesignDetailChat`；变更时同步本目录 `AGENTS.md` 与 `frontend-vue/AGENTS.md` 并执行 `npm run build` 刷新 `vue-auth-assets/design-detail.js`
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import DesignDetailArchitectureInventoryTab from './DesignDetailArchitectureInventoryTab.vue';
import DesignDetailCurrentStateUnderstandingTab from './DesignDetailCurrentStateUnderstandingTab.vue';
import DesignDetailDiagnosticReviewTab from './DesignDetailDiagnosticReviewTab.vue';
import DesignDetailLlmLogFloatingPanel from './DesignDetailLlmLogFloatingPanel.vue';
import DesignDetailLogicModal from './DesignDetailLogicModal.vue';
import DesignDetailLogicTreeModal from './DesignDetailLogicTreeModal.vue';
import DesignDetailRequirementCoreEntitiesPanel from './DesignDetailRequirementCoreEntitiesPanel.vue';
import DesignDetailRequirementPrelimPanels from './DesignDetailRequirementPrelimPanels.vue';
import DesignDetailChatTimeline from './DesignDetailChatTimeline.vue';
import DesignTaskDynamicsCard from './DesignTaskDynamicsCard.vue';
import type { DesignDetailChatPanelMode } from './designDetailChatPanelMode';
import { resolveCorePainPointSummaryFromParsed } from './designDetailRequirementMerge';
import { isDesignDetailDeveloperChromeVisible } from './designDetailExperienceMode';
import { DESIGN_DETAIL_MERGED_REQUIREMENT_CARD_ID, useDesignDetailChat } from './useDesignDetailChat';

const caseId = ref('');
const customerName = ref('');
const archiveNoRaw = ref('');

const archiveLabel = computed(() => {
  const n = Number(archiveNoRaw.value);
  if (Number.isFinite(n) && n > 0) {
    return `档案编号 ${String(Math.floor(n)).padStart(4, '0')}`;
  }
  return '';
});

const headlineText = computed(() => {
  const name = customerName.value.trim() || '未命名客户';
  const id = caseId.value.trim();
  if (!id) return name;
  return `${name} · caseId ${id}`;
});

function readQuery() {
  try {
    const u = new URL(window.location.href);
    caseId.value = u.searchParams.get('caseId') || u.searchParams.get('customerId') || '';
    customerName.value = u.searchParams.get('customerName') || '';
    archiveNoRaw.value = u.searchParams.get('archiveNo') || '';
  } catch {
    caseId.value = '';
    customerName.value = '';
    archiveNoRaw.value = '';
  }
}

readQuery();

function goHome() {
  window.location.href = 'home.html';
}

const {
  currentDesignLinePillText,
  currentDesignLineTaskId,
  dynamicsCardsView,
  designChatTimeline,
  designDetailChatPanelMode,
  leftPanelUiRestoreTick,
  leftPanelScrollProgress,
  leftPanelScrollChat,
  noteLeftPanelScroll,
  setDesignDetailChatPanelModeAndPersist,
  lastHydratedMessages,
  lastHydratedPreliminaryFollowupActive,
  loadError: designChatError,
  sendBusy,
  restartBusy,
  fullRestartBusy,
  designChatInputPlaceholder,
  designChatInputPlaceholderEffective,
  designChatInputHighlightTask1ScopeOrRequirementAwait,
  designChatInputSendDisabled,
  designChatInputSendTriggersTask0DebugContinue,
  onRequirementSupplementChoiceYes,
  onRequirementSupplementChoiceNo,
  onDebugPipelineStepContinue,
  designDetailExperienceMode,
  setDesignDetailExperienceMode,
  submitDesignDetailChatDraft,
  restartCurrentTaskFromDesignPage,
  restartFromSelectedLineTaskAnchor,
  selectRestartStageOptions,
  fullRestartDesignDetailFromPage,
  designCanvasTabs,
  activeDesignCanvasTabId,
  customerBasicCanvasRows,
  customerRequirementCanvasEntries,
  mergedCustomerRequirementParsed,
  mergedRequirementActiveSubTabKey,
  mergedRequirementMergeDoneTick,
  customerRequirementFieldDefs,
  formatCustomerRequirementSubTabValue,
  llmLogAuditRefreshTick,
  logicTreeGraphRefreshTick,
  architectureInventoryGraphRefreshTick,
  designReportContentRefreshTick,
  designReportSubTabFocusTick,
  businessProcessSubTabFocusTick,
  functionInventorySubTabFocusTick,
  onLogicTreeTask0LayerReady,
  designDetailChatDraft,
  task51L3MatrixRawOutput,
  currentStateUnderstandingGraphTasks,
  currentStateUnderstandingRefreshTick,
  diagnosticReviewStepCards,
  diagnosticReviewRefreshTick,
} = useDesignDetailChat(caseId);

/** 左栏「进展 / 聊天」滚动容器 */
const designDynamicsScrollRoot = ref<HTMLElement | null>(null);
const designChatScrollRoot = ref<HTMLElement | null>(null);

const LEFT_PANEL_SCROLL_NEAR_BOTTOM_PX = 96;
/** hydrate 恢复滚动后短暂抑制「追底」 */
let leftPanelSuppressAutoScrollUntil = 0;

function isScrollNearBottom(el: HTMLElement, thresholdPx = LEFT_PANEL_SCROLL_NEAR_BOTTOM_PX): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;
}

function resolveLeftPanelScrollTop(saved: number, el: HTMLElement | null): number {
  if (!el) return 0;
  if (saved > 0) return Math.min(saved, Math.max(0, el.scrollHeight - el.clientHeight));
  return el.scrollHeight;
}

function applyLeftPanelScrollTop(panel: 'progress' | 'chat', scrollTop: number) {
  const el = panel === 'progress' ? designDynamicsScrollRoot.value : designChatScrollRoot.value;
  if (!el) return;
  el.scrollTop = resolveLeftPanelScrollTop(scrollTop, el);
}

function scrollProgressPanelToBottom(opts?: { force?: boolean }) {
  if (designDetailChatPanelMode.value !== 'progress') return;
  const el = designDynamicsScrollRoot.value;
  if (!el) return;
  const force = opts?.force === true;
  if (Date.now() < leftPanelSuppressAutoScrollUntil) return;
  if (!force && !isScrollNearBottom(el)) return;
  el.scrollTop = el.scrollHeight;
}

function scrollActiveLeftPanelToBottomIfNear() {
  scrollProgressPanelToBottom();
}

/** 进展 Tab：当前应跟随的活跃任务卡（末张未完成卡，否则末张） */
function resolveActiveProgressCardKey(
  cards: ReadonlyArray<{ key: string; completed: boolean }>,
): string | null {
  if (!cards.length) return null;
  for (let i = cards.length - 1; i >= 0; i -= 1) {
    if (!cards[i]!.completed) return cards[i]!.key;
  }
  return cards[cards.length - 1]!.key;
}

let prevProgressCardCount = 0;
let prevActiveProgressCardKey: string | null = null;

let leftPanelScrollPersistTimer: ReturnType<typeof setTimeout> | null = null;

function onLeftPanelScroll(panel: 'progress' | 'chat') {
  const el = panel === 'progress' ? designDynamicsScrollRoot.value : designChatScrollRoot.value;
  if (!el) return;
  if (leftPanelScrollPersistTimer) clearTimeout(leftPanelScrollPersistTimer);
  leftPanelScrollPersistTimer = setTimeout(() => {
    leftPanelScrollPersistTimer = null;
    noteLeftPanelScroll(panel, el.scrollTop);
  }, 120);
}

async function restoreLeftPanelUiFromPersisted() {
  leftPanelSuppressAutoScrollUntil = Date.now() + 800;
  await nextTick();
  requestAnimationFrame(() => {
    applyLeftPanelScrollTop('progress', leftPanelScrollProgress.value);
    applyLeftPanelScrollTop('chat', leftPanelScrollChat.value);
    prevProgressCardCount = dynamicsCardsView.value.length;
    prevActiveProgressCardKey = resolveActiveProgressCardKey(dynamicsCardsView.value);
  });
}

watch(leftPanelUiRestoreTick, () => {
  if (leftPanelUiRestoreTick.value <= 0) return;
  void restoreLeftPanelUiFromPersisted();
});

watch(
  dynamicsCardsView,
  async (cards) => {
    if (designDetailChatPanelMode.value !== 'progress') return;
    const activeKey = resolveActiveProgressCardKey(cards);
    const forceFollowNewTaskCard =
      cards.length > prevProgressCardCount ||
      (activeKey != null && activeKey !== prevActiveProgressCardKey);
    prevProgressCardCount = cards.length;
    prevActiveProgressCardKey = activeKey;
    await nextTick();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollProgressPanelToBottom({ force: forceFollowNewTaskCard });
      });
    });
  },
  { deep: true },
);

watch(designChatTimeline, async () => {
  if (designDetailChatPanelMode.value !== 'chat') return;
  await nextTick();
  requestAnimationFrame(() => {
    const el = designChatScrollRoot.value;
    if (!el) return;
    if (Date.now() < leftPanelSuppressAutoScrollUntil) return;
    if (!isScrollNearBottom(el)) return;
    el.scrollTop = el.scrollHeight;
  });
});

watch(lastHydratedMessages, async () => {
  if (designDetailChatPanelMode.value !== 'progress') return;
  await nextTick();
  requestAnimationFrame(() => scrollActiveLeftPanelToBottomIfNear());
});

function onChatPanelModeChange(mode: DesignDetailChatPanelMode) {
  const prev = designDetailChatPanelMode.value;
  if (prev === 'progress') {
    const el = designDynamicsScrollRoot.value;
    if (el) noteLeftPanelScroll('progress', el.scrollTop);
  } else if (prev === 'chat') {
    const el = designChatScrollRoot.value;
    if (el) noteLeftPanelScroll('chat', el.scrollTop);
  }
  setDesignDetailChatPanelModeAndPersist(mode);
  void nextTick(() => {
    requestAnimationFrame(() => {
      applyLeftPanelScrollTop(
        mode,
        mode === 'progress' ? leftPanelScrollProgress.value : leftPanelScrollChat.value,
      );
    });
  });
}

/** 需求提炼根卡片折叠：缺省展开；键为 `entry.id` */
const reqCardExpanded = ref<Record<string, boolean>>({});

function isReqCardExpanded(id: string): boolean {
  return reqCardExpanded.value[id] !== false;
}

function toggleReqCard(id: string) {
  reqCardExpanded.value = {
    ...reqCardExpanded.value,
    [id]: !isReqCardExpanded(id),
  };
}

/** 需求合并完成后自动展开「合并需求」卡 */
watch(mergedRequirementMergeDoneTick, () => {
  if (mergedRequirementMergeDoneTick.value <= 0) return;
  reqCardExpanded.value = {
    ...reqCardExpanded.value,
    [DESIGN_DETAIL_MERGED_REQUIREMENT_CARD_ID]: true,
  };
});

const logicOpen = ref(false);
const treeOpen = ref(false);
const llmLogFloatingOpen = ref(false);

const showDesignDetailDeveloperChrome = computed(() => isDesignDetailDeveloperChromeVisible());

const selectRestartPickerOpen = ref(false);

/** 切回使用模式时收起仅调试可见的浮层/弹层 */
watch(designDetailExperienceMode, (mode) => {
  if (mode !== 'usage') return;
  llmLogFloatingOpen.value = false;
  logicOpen.value = false;
  treeOpen.value = false;
  selectRestartPickerOpen.value = false;
});

/** 右侧画布工作区 DOM，用于 Fullscreen API */
const workspaceEl = ref<HTMLElement | null>(null);
const workspaceFullscreenActive = ref(false);

function isWorkspaceFullscreenElement(el: HTMLElement | null): boolean {
  if (!el) return false;
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement === el || doc.webkitFullscreenElement === el;
}

function syncWorkspaceFullscreenState(): void {
  workspaceFullscreenActive.value = isWorkspaceFullscreenElement(workspaceEl.value);
  window.dispatchEvent(new Event('resize'));
}

async function requestWorkspaceFullscreen(el: HTMLElement): Promise<void> {
  const w = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  if (el.requestFullscreen) {
    await el.requestFullscreen();
    return;
  }
  if (w.webkitRequestFullscreen) {
    await w.webkitRequestFullscreen();
    return;
  }
  throw new Error('fullscreen unsupported');
}

async function exitWorkspaceFullscreen(): Promise<void> {
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
    return;
  }
  throw new Error('exit fullscreen unsupported');
}

async function toggleWorkspaceFullscreen(): Promise<void> {
  const el = workspaceEl.value;
  if (!el) return;
  try {
    if (isWorkspaceFullscreenElement(el)) {
      await exitWorkspaceFullscreen();
    } else {
      await requestWorkspaceFullscreen(el);
    }
  } catch (err) {
    console.warn('[design-detail:workspace-fullscreen]', err);
  } finally {
    syncWorkspaceFullscreenState();
  }
}

function onWorkspaceFullscreenChange(): void {
  syncWorkspaceFullscreenState();
}

onMounted(() => {
  readQuery();
  void restoreLeftPanelUiFromPersisted();
  document.addEventListener('fullscreenchange', onWorkspaceFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onWorkspaceFullscreenChange);
});

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onWorkspaceFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', onWorkspaceFullscreenChange);
});

function openLlmLogFloatingPanel() {
  if (!caseId.value.trim()) return;
  llmLogFloatingOpen.value = true;
}

async function onChatSend() {
  if (designChatInputSendTriggersTask0DebugContinue.value) {
    designDetailChatDraft.value = '';
    await onDebugPipelineStepContinue();
    return;
  }
  if (designChatInputSendDisabled.value) return;
  const t = designDetailChatDraft.value.trim();
  if (!t) return;
  designDetailChatDraft.value = '';
  await submitDesignDetailChatDraft(t);
}

/** 「完全重启」：较「重启当前」更强；二次确认文案须明示不可恢复范围 */
async function onFullRestartDesignDetail() {
  const id = caseId.value.trim();
  if (!id || fullRestartBusy.value || restartBusy.value || sendBusy.value) {
    try {
      console.info('[design-detail:full-restart]', {
        phase: 'button_click_blocked',
        caseId: id || null,
        fullRestartBusy: fullRestartBusy.value,
        restartBusy: restartBusy.value,
        sendBusy: sendBusy.value,
      });
    } catch {
      /* ignore */
    }
    return;
  }
  const msg =
    '「完全重启」将不可恢复地清空：本案例设计页**同源聊天**（整段清空）、任务进展快照、右侧画布与动态 Tab、后台**全部**设计推理图（所有线步及 customer_requirement）与逻辑边、以及本案例**全部** LLM 审计日志；全案回退到**任务 0** 起点，并先同步工具原语至逻辑树 **L0-工具原语层**（可打开「Tree」查看）。\n\n「重启当前」仅清空**当前任务**对应数据；「选择重启」清空**所选任务及之后**阶段数据。\n\n确定继续？';
  try {
    console.info('[design-detail:full-restart]', { phase: 'button_confirm_shown', caseId: id });
  } catch {
    /* ignore */
  }
  if (!window.confirm(msg)) {
    try {
      console.info('[design-detail:full-restart]', { phase: 'button_confirm_cancelled', caseId: id });
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    console.info('[design-detail:full-restart]', { phase: 'button_confirm_ok_call_handler', caseId: id });
  } catch {
    /* ignore */
  }
  await fullRestartDesignDetailFromPage();
  try {
    console.info('[design-detail:full-restart]', { phase: 'button_handler_returned', caseId: id });
  } catch {
    /* ignore */
  }
}

function openSelectRestartPicker() {
  if (!caseId.value.trim() || restartBusy.value || fullRestartBusy.value || sendBusy.value) return;
  if (selectRestartStageOptions.value.length === 0) {
    window.alert('当前案例尚无已完成的任务阶段，无法选择重启。');
    return;
  }
  selectRestartPickerOpen.value = true;
}

function closeSelectRestartPicker() {
  selectRestartPickerOpen.value = false;
}

async function onPickSelectRestartStage(anchor: (typeof selectRestartStageOptions.value)[number]['id']) {
  const opt = selectRestartStageOptions.value.find((o) => o.id === anchor);
  if (!opt) return;
  const msg =
    `将从「${opt.pillLabel}」重新开始，并清空该阶段及之后阶段的任务进展、LLM 调用日志、逻辑树与逻辑详情数据。\n\n确定继续？`;
  if (!window.confirm(msg)) return;
  selectRestartPickerOpen.value = false;
  await restartFromSelectedLineTaskAnchor(anchor);
}
</script>

<template>
  <div class="dd-app">
    <nav class="dd-top-nav" aria-label="主导航">
      <button
        type="button"
        class="dd-btn dd-btn--ghost dd-btn--back-home"
        aria-label="返回首页"
        @click="goHome"
      >
        <span class="dd-btn-back-arrow" aria-hidden="true">←</span>
        <span class="dd-btn-back-label">返回首页</span>
      </button>
      <button
        v-if="showDesignDetailDeveloperChrome"
        type="button"
        class="dd-btn dd-btn--ghost"
        aria-label="选择重启"
        :disabled="!caseId.trim() || restartBusy || fullRestartBusy || sendBusy"
        @click="openSelectRestartPicker"
      >
        {{ restartBusy ? '重启中…' : '选择重启' }}
      </button>
      <button
        v-if="showDesignDetailDeveloperChrome"
        type="button"
        class="dd-btn dd-btn--ghost"
        aria-label="重启当前"
        :disabled="!caseId.trim() || restartBusy || fullRestartBusy || sendBusy"
        @click="restartCurrentTaskFromDesignPage"
      >
        {{ restartBusy ? '重启中…' : '重启当前' }}
      </button>
      <button
        type="button"
        class="dd-btn dd-btn--ghost"
        aria-label="完全重启"
        :disabled="!caseId.trim() || restartBusy || fullRestartBusy || sendBusy"
        @click="onFullRestartDesignDetail"
      >
        {{ fullRestartBusy ? '完全重启中…' : '完全重启' }}
      </button>
      <button
        v-if="showDesignDetailDeveloperChrome"
        type="button"
        class="dd-btn dd-btn--ghost"
        aria-label="LLM 调用详情"
        :disabled="!caseId.trim()"
        @click="openLlmLogFloatingPanel"
      >
        LLM
      </button>
      <button
        v-if="showDesignDetailDeveloperChrome"
        type="button"
        class="dd-btn dd-btn--ghost"
        aria-label="逻辑详情"
        :disabled="!caseId.trim()"
        @click="logicOpen = true"
      >
        逻辑
      </button>
      <button
        v-if="showDesignDetailDeveloperChrome"
        type="button"
        class="dd-btn dd-btn--ghost"
        aria-label="逻辑树视图"
        :disabled="!caseId.trim()"
        @click="treeOpen = true"
      >
        Tree
      </button>
      <div class="dd-experience-mode" role="group" aria-label="页面体验模式">
        <button
          type="button"
          class="dd-experience-mode__btn"
          :class="{ 'dd-experience-mode__btn--on': designDetailExperienceMode === 'usage' }"
          :aria-pressed="designDetailExperienceMode === 'usage'"
          @click="setDesignDetailExperienceMode('usage')"
        >
          使用模式
        </button>
        <button
          type="button"
          class="dd-experience-mode__btn"
          :class="{ 'dd-experience-mode__btn--on': designDetailExperienceMode === 'debug' }"
          :aria-pressed="designDetailExperienceMode === 'debug'"
          @click="setDesignDetailExperienceMode('debug')"
        >
          调试模式
        </button>
      </div>
    </nav>

    <div class="dd-case-headline" role="status">
      <span v-if="archiveLabel" class="dd-archive-pill">{{ archiveLabel }}</span>
      <span class="dd-case-headline-main">{{ headlineText }}</span>
    </div>

    <div class="dd-main">
      <aside class="dd-chat" aria-label="设计对话">
        <div class="dd-chat-head">
          <div class="dd-chat-head-main">
            <span class="dd-chat-head-title">任务进展</span>
            <div class="dd-chat-panel-tabs" role="tablist" aria-label="左栏内容切换">
              <button
                type="button"
                role="tab"
                class="dd-chat-panel-tab"
                :class="{ 'dd-chat-panel-tab--on': designDetailChatPanelMode === 'progress' }"
                :aria-selected="designDetailChatPanelMode === 'progress'"
                @click="onChatPanelModeChange('progress')"
              >
                进展
              </button>
              <button
                type="button"
                role="tab"
                class="dd-chat-panel-tab"
                :class="{ 'dd-chat-panel-tab--on': designDetailChatPanelMode === 'chat' }"
                :aria-selected="designDetailChatPanelMode === 'chat'"
                @click="onChatPanelModeChange('chat')"
              >
                聊天
              </button>
            </div>
          </div>
          <span
            v-if="showDesignDetailDeveloperChrome && caseId.trim() && !designChatError"
            class="dd-current-task-tag"
            :title="currentDesignLinePillText"
          >{{ currentDesignLinePillText }}</span>
        </div>
        <div
          v-show="designDetailChatPanelMode === 'progress'"
          ref="designDynamicsScrollRoot"
          class="dd-chat-body"
          @scroll="onLeftPanelScroll('progress')"
        >
          <p v-if="designChatError" class="dd-chat-error" role="alert">{{ designChatError }}</p>
          <p v-else-if="!caseId.trim()" class="dd-chat-placeholder">请在 URL 中传入 <code>caseId=</code> 以加载案例任务状态。</p>
          <template v-else>
            <div class="dd-dynamics-section" aria-label="任务进度卡片">
              <div class="dd-dynamics-feed">
                <DesignTaskDynamicsCard
                  v-for="c in dynamicsCardsView"
                  :key="c.key"
                  :title-text="c.titleText"
                  :card-tone="c.cardTone"
                  :completed="c.completed"
                  :started-at-ms="c.startedAtMs"
                  :completed-at-ms="c.completedAtMs"
                  :duration-sec="c.durationSec"
                  :rows="c.rows"
                  :session-messages="lastHydratedMessages"
                  :preliminary-followup-active="lastHydratedPreliminaryFollowupActive"
                  :on-requirement-supplement-yes="onRequirementSupplementChoiceYes"
                  :on-requirement-supplement-no="onRequirementSupplementChoiceNo"
                  :on-debug-pipeline-step-continue="onDebugPipelineStepContinue"
                />
              </div>
            </div>
          </template>
        </div>
        <div
          v-show="designDetailChatPanelMode === 'chat'"
          ref="designChatScrollRoot"
          class="dd-chat-body dd-chat-body--timeline"
          @scroll="onLeftPanelScroll('chat')"
        >
          <p v-if="designChatError" class="dd-chat-error" role="alert">{{ designChatError }}</p>
          <p v-else-if="!caseId.trim()" class="dd-chat-placeholder">请在 URL 中传入 <code>caseId=</code> 以加载案例任务状态。</p>
          <DesignDetailChatTimeline v-else :items="designChatTimeline" />
        </div>
        <div class="dd-chat-foot">
          <textarea
            v-model="designDetailChatDraft"
            class="dd-chat-input"
            :class="{ 'dd-chat-input--await-task1-scope': designChatInputHighlightTask1ScopeOrRequirementAwait && !sendBusy }"
            rows="3"
            :placeholder="designChatInputPlaceholderEffective"
            :disabled="designChatInputSendDisabled"
            @keydown.enter.exact.prevent="onChatSend"
          />
          <button
            type="button"
            class="dd-btn dd-btn--primary dd-chat-send"
            :disabled="designChatInputSendDisabled"
            @click="onChatSend"
          >
            {{ sendBusy ? '发送中…' : '发送' }}
          </button>
        </div>
      </aside>

      <main ref="workspaceEl" class="dd-workspace" aria-label="设计画布">
        <div class="dd-workspace-inner">
          <div class="dd-workspace-toolbar">
            <div class="dd-tabs dd-tabs--scroll" role="tablist" aria-label="画布分区">
              <button
                v-for="t in designCanvasTabs"
                :key="t.id"
                type="button"
                role="tab"
                class="dd-tab"
                :class="{ 'dd-tab--on': activeDesignCanvasTabId === t.id }"
                :aria-selected="activeDesignCanvasTabId === t.id"
                @click="activeDesignCanvasTabId = t.id"
              >
                {{ t.label }}
              </button>
            </div>
            <button
              type="button"
              class="dd-workspace-fs-btn"
              :aria-pressed="workspaceFullscreenActive"
              :title="workspaceFullscreenActive ? '退出全屏' : '全屏显示画布'"
              :aria-label="workspaceFullscreenActive ? '退出全屏' : '全屏显示画布'"
              @click="toggleWorkspaceFullscreen"
            >
              <svg
                v-if="!workspaceFullscreenActive"
                class="dd-workspace-fs-icon"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M4 10V4h6v2H6v4H4zm10-6h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm16 0v6h-6v-2h4v-4h2z"
                />
              </svg>
              <svg
                v-else
                class="dd-workspace-fs-icon"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M14 10V4h6v6h-2V6h-4zm-4 0H4V4h6v2H6v4zm10 4v6h-6v-2h4v-4zm-4 0H4v-6h2v4h4v2z"
                />
              </svg>
            </button>
          </div>

          <div class="dd-workspace-body" aria-label="画布工作区">
          <template v-for="t in designCanvasTabs" :key="'canvas-panel-' + t.id">
            <div
              v-show="activeDesignCanvasTabId === t.id"
              class="dd-panel"
              :class="{
                'dd-panel--grid': t.kind === 'customer_basic',
                'dd-panel--req-stack': t.kind === 'requirement_distill',
                'dd-panel--csu': t.kind === 'current_state_understanding',
                'dd-panel--drv': t.kind === 'diagnostic_review',
                'dd-panel--arch-inventory': t.kind === 'architecture_inventory',
              }"
              role="tabpanel"
            >
              <template v-if="t.kind === 'case_overview'">
                <section class="dd-card">
                  <header class="dd-card-head">
                    <span class="dd-card-title">案例摘要</span>
                    <span class="dd-card-badge">只读</span>
                  </header>
                  <div class="dd-card-body dd-kv-grid">
                    <div class="dd-kv">
                      <span class="dd-k">客户名称</span>
                      <span class="dd-v">{{ customerName.trim() || '—' }}</span>
                    </div>
                    <div class="dd-kv">
                      <span class="dd-k">caseId</span>
                      <span class="dd-v dd-mono">{{ caseId || '—' }}</span>
                    </div>
                    <div class="dd-kv dd-kv--full">
                      <span class="dd-k">说明</span>
                      <span class="dd-v">
                        上方 Tab 随任务推进动态增加；完成左侧「客户基本情况」经营信息提炼后，将自动出现「客户基本信息」画布页。
                      </span>
                    </div>
                  </div>
                </section>
              </template>
              <template v-else-if="t.kind === 'customer_basic'">
                <section class="dd-card dd-card--accent">
                  <header class="dd-card-head">
                    <span class="dd-card-title">客户基本信息</span>
                    <span class="dd-card-badge">提炼结果</span>
                  </header>
                  <div class="dd-card-body dd-canvas-table-wrap">
                    <div class="dd-table-scroll">
                      <table class="dd-canvas-table" aria-label="客户基本信息">
                        <thead>
                          <tr>
                            <th scope="col">字段</th>
                            <th scope="col">内容</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="row in customerBasicCanvasRows" :key="row.field">
                            <th scope="row">{{ row.label }}</th>
                            <td>{{ row.value }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </template>
              <template v-else-if="t.kind === 'requirement_distill'">
                <div class="dd-req-stack" aria-label="需求提炼画布">
                  <article
                    class="dd-req-root-card dd-req-root-card--merged"
                    aria-label="合并需求"
                  >
                    <header
                      class="dd-req-root-head dd-req-root-head--merged"
                      :class="{
                        'dd-req-root-head--collapsed': !isReqCardExpanded(DESIGN_DETAIL_MERGED_REQUIREMENT_CARD_ID),
                      }"
                    >
                      <button
                        type="button"
                        class="dd-req-root-toggle"
                        :aria-expanded="isReqCardExpanded(DESIGN_DETAIL_MERGED_REQUIREMENT_CARD_ID)"
                        :aria-controls="'dd-req-body-' + DESIGN_DETAIL_MERGED_REQUIREMENT_CARD_ID"
                        @click="toggleReqCard(DESIGN_DETAIL_MERGED_REQUIREMENT_CARD_ID)"
                      >
                        <span
                          class="dd-req-chevron dd-req-chevron--merged"
                          :class="{
                            'dd-req-chevron--open': isReqCardExpanded(DESIGN_DETAIL_MERGED_REQUIREMENT_CARD_ID),
                          }"
                          aria-hidden="true"
                        />
                        <span class="dd-req-root-title dd-req-root-title--merged">合并需求</span>
                      </button>
                      <div class="dd-req-root-head-actions">
                        <span class="dd-req-root-badge dd-req-root-badge--merged">整合视图</span>
                      </div>
                    </header>
                    <div
                      v-show="isReqCardExpanded(DESIGN_DETAIL_MERGED_REQUIREMENT_CARD_ID)"
                      :id="'dd-req-body-' + DESIGN_DETAIL_MERGED_REQUIREMENT_CARD_ID"
                      class="dd-req-root-body"
                    >
                      <div class="dd-req-subtabs" role="tablist" aria-label="合并需求结构子维度">
                        <button
                          v-for="sub in customerRequirementFieldDefs"
                          :key="'merged-' + sub.key"
                          type="button"
                          role="tab"
                          class="dd-req-subtab"
                          :class="{ 'dd-req-subtab--on': mergedRequirementActiveSubTabKey === sub.key }"
                          :aria-selected="mergedRequirementActiveSubTabKey === sub.key"
                          @click="mergedRequirementActiveSubTabKey = sub.key"
                        >
                          {{ sub.label }}
                        </button>
                      </div>
                      <div class="dd-req-subpanel">
                        <template v-for="sub in customerRequirementFieldDefs" :key="'merged-p-' + sub.key">
                          <div
                            v-show="mergedRequirementActiveSubTabKey === sub.key"
                            class="dd-req-field-panel"
                            role="tabpanel"
                          >
                            <DesignDetailRequirementCoreEntitiesPanel
                              v-if="sub.key === 'coreBusinessEntities'"
                              :value="mergedCustomerRequirementParsed[sub.key]"
                            />
                            <DesignDetailRequirementPrelimPanels
                              v-else-if="
                                sub.key === 'businessContext' ||
                                sub.key === 'stateTransitionMatrix' ||
                                sub.key === 'painPointRadar' ||
                                sub.key === 'itLandscape' ||
                                sub.key === 'existingSpreadsheets' ||
                                sub.key === 'operationModel' ||
                                sub.key === 'managementResources' ||
                                sub.key === 'roadmap'
                              "
                              :section-key="sub.key"
                              :value="mergedCustomerRequirementParsed[sub.key]"
                              :core-entities="mergedCustomerRequirementParsed['coreBusinessEntities']"
                              :merged-pain-point-radar-layout="sub.key === 'painPointRadar'"
                              :core-pain-point-summary="
                                sub.key === 'painPointRadar'
                                  ? resolveCorePainPointSummaryFromParsed(mergedCustomerRequirementParsed)
                                  : ''
                              "
                            />
                            <div v-else class="dd-req-row">
                              <span class="dd-req-label">{{ sub.label }}</span>
                              <span class="dd-req-value">{{
                                formatCustomerRequirementSubTabValue(mergedCustomerRequirementParsed, sub.key)
                              }}</span>
                            </div>
                          </div>
                        </template>
                      </div>
                    </div>
                  </article>
                  <p v-if="!customerRequirementCanvasEntries.length" class="dd-req-empty">
                    暂无单次需求提炼记录；完成左侧「请输入用户需求」并发送后，将在下方按时间展示（新的在上）。
                  </p>
                  <article
                    v-for="(entry, reqIdx) in customerRequirementCanvasEntries"
                    :key="entry.id"
                    class="dd-req-root-card"
                  >
                    <header
                      class="dd-req-root-head"
                      :class="{ 'dd-req-root-head--collapsed': !isReqCardExpanded(entry.id) }"
                    >
                      <button
                        type="button"
                        class="dd-req-root-toggle"
                        :aria-expanded="isReqCardExpanded(entry.id)"
                        :aria-controls="'dd-req-body-' + entry.id"
                        @click="toggleReqCard(entry.id)"
                      >
                        <span
                          class="dd-req-chevron"
                          :class="{ 'dd-req-chevron--open': isReqCardExpanded(entry.id) }"
                          aria-hidden="true"
                        />
                        <span
                          class="dd-req-root-seq"
                          :title="'第 ' + (entry.distillOrdinal ?? reqIdx + 1) + ' 次需求提炼'"
                          :aria-label="'第' + (entry.distillOrdinal ?? reqIdx + 1) + '次需求提炼'"
                          >{{ entry.distillOrdinal ?? reqIdx + 1 }}</span
                        >
                        <span
                          class="dd-req-root-title"
                          :class="{
                            'dd-req-root-title--latest': reqIdx === 0,
                          }"
                        >{{ entry.titleTimeLabel }}</span>
                      </button>
                      <div class="dd-req-root-head-actions">
                        <span class="dd-req-root-badge">提炼结果</span>
                      </div>
                    </header>
                    <div
                      v-show="isReqCardExpanded(entry.id)"
                      :id="'dd-req-body-' + entry.id"
                      class="dd-req-root-body"
                    >
                    <div class="dd-req-subtabs" role="tablist" aria-label="需求结构子维度">
                      <button
                        v-for="sub in customerRequirementFieldDefs"
                        :key="entry.id + '-' + sub.key"
                        type="button"
                        role="tab"
                        class="dd-req-subtab"
                        :class="{ 'dd-req-subtab--on': entry.activeSubTabKey === sub.key }"
                        :aria-selected="entry.activeSubTabKey === sub.key"
                        @click="entry.activeSubTabKey = sub.key"
                      >
                        {{ sub.label }}
                      </button>
                    </div>
                    <div class="dd-req-subpanel">
                      <template v-for="sub in customerRequirementFieldDefs" :key="entry.id + '-p-' + sub.key">
                        <div
                          v-show="entry.activeSubTabKey === sub.key"
                          class="dd-req-field-panel"
                          role="tabpanel"
                        >
                          <DesignDetailRequirementCoreEntitiesPanel
                            v-if="sub.key === 'coreBusinessEntities'"
                            :value="entry.parsed[sub.key]"
                          />
                          <DesignDetailRequirementPrelimPanels
                            v-else-if="
                              sub.key === 'businessContext' ||
                              sub.key === 'stateTransitionMatrix' ||
                              sub.key === 'painPointRadar' ||
                              sub.key === 'itLandscape' ||
                              sub.key === 'existingSpreadsheets' ||
                              sub.key === 'operationModel' ||
                              sub.key === 'managementResources' ||
                              sub.key === 'roadmap'
                            "
                            :section-key="sub.key"
                            :value="entry.parsed[sub.key]"
                            :core-entities="entry.parsed['coreBusinessEntities']"
                            :core-pain-point-summary="
                              sub.key === 'painPointRadar'
                                ? resolveCorePainPointSummaryFromParsed(entry.parsed)
                                : ''
                            "
                          />
                          <div v-else class="dd-req-row">
                            <span class="dd-req-label">{{ sub.label }}</span>
                            <span class="dd-req-value">{{ formatCustomerRequirementSubTabValue(entry.parsed, sub.key) }}</span>
                          </div>
                        </div>
                      </template>
                    </div>
                    </div>
                  </article>
                </div>
              </template>
              <template v-else-if="t.kind === 'current_state_understanding'">
                <DesignDetailCurrentStateUnderstandingTab
                  :customer-name="customerName"
                  :task51-l3-matrix-raw-output="task51L3MatrixRawOutput"
                  :task-graph-tasks="currentStateUnderstandingGraphTasks"
                  :refresh-tick="currentStateUnderstandingRefreshTick"
                  :panel-active="activeDesignCanvasTabId === t.id"
                />
              </template>
              <template v-else-if="t.kind === 'diagnostic_review'">
                <DesignDetailDiagnosticReviewTab
                  :step-cards="diagnosticReviewStepCards"
                  :refresh-tick="diagnosticReviewRefreshTick"
                  :panel-active="activeDesignCanvasTabId === t.id"
                />
              </template>
              <template v-else-if="t.kind === 'architecture_inventory'">
                <DesignDetailArchitectureInventoryTab
                  :case-id="caseId"
                  :customer-name="customerName"
                  :refresh-tick="architectureInventoryGraphRefreshTick"
                  :design-report-content-tick="designReportContentRefreshTick"
                  :design-report-subtab-focus-tick="designReportSubTabFocusTick"
                  :business-process-subtab-focus-tick="businessProcessSubTabFocusTick"
                  :function-inventory-subtab-focus-tick="functionInventorySubTabFocusTick"
                />
              </template>
            </div>
          </template>
          </div>
        </div>
      </main>
    </div>

    <DesignDetailLogicModal :visible="logicOpen" :case-id="caseId" @close="logicOpen = false" />
    <DesignDetailLogicTreeModal
      :visible="treeOpen"
      :case-id="caseId"
      :graph-refresh-tick="logicTreeGraphRefreshTick"
      @close="treeOpen = false"
      @task0-layer-ready="onLogicTreeTask0LayerReady"
    />
    <DesignDetailLlmLogFloatingPanel
      :visible="llmLogFloatingOpen"
      :case-id="caseId"
      :customer-name="customerName"
      :archive-no-raw="archiveNoRaw"
      :refresh-tick="llmLogAuditRefreshTick"
      @close="llmLogFloatingOpen = false"
    />

    <Teleport to="body">
      <div
        v-show="selectRestartPickerOpen"
        class="dd-select-restart-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dd-select-restart-title"
        @click="closeSelectRestartPicker"
      >
        <div class="dd-select-restart-panel" @click.stop>
          <header class="dd-select-restart-head">
            <h2 id="dd-select-restart-title" class="dd-select-restart-title">选择重启阶段</h2>
            <button type="button" class="dd-select-restart-close" @click="closeSelectRestartPicker">
              关闭
            </button>
          </header>
          <p class="dd-select-restart-hint">
            选择要从哪一阶段重新开始。将清空该阶段及之后阶段的任务进展、LLM 日志、逻辑树与逻辑详情数据。
          </p>
          <ul class="dd-select-restart-list" role="listbox" aria-label="已完成任务阶段">
            <li v-for="opt in selectRestartStageOptions" :key="opt.id" role="presentation">
              <button
                type="button"
                class="dd-select-restart-item"
                role="option"
                :disabled="restartBusy || fullRestartBusy || sendBusy"
                @click="onPickSelectRestartStage(opt.id)"
              >
                <span class="dd-select-restart-item-label">{{ opt.pillLabel }}</span>
                <span class="dd-select-restart-item-sub">{{ opt.displayName }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* 亮色主题 token */
.dd-app {
  --dd-bg: #f1f5f9;
  --dd-surface: #ffffff;
  --dd-border: #e2e8f0;
  --dd-text: #0f172a;
  --dd-muted: #64748b;
  --dd-accent: #2563eb;
  --dd-accent-soft: #dbeafe;
  /* 窄屏下主栏最小高度；桌面定高布局由 flex 链与 `.dd-workspace-body` 滚动承担 */
  --dd-main-height: min(720px, calc(100vh - 11rem));

  max-width: 1600px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 2rem;
  min-height: 100vh;
  box-sizing: border-box;
  font-family: inherit;
  background: var(--dd-bg);
  color: var(--dd-text);
}

.dd-top-nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin-bottom: 1rem;
}

.dd-experience-mode {
  display: inline-flex;
  margin-left: auto;
  flex-shrink: 0;
  border: 1px solid var(--dd-accent);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.dd-experience-mode__btn {
  font-family: inherit;
  font-size: 0.85rem;
  line-height: 1.2;
  border: none;
  background: transparent;
  color: var(--dd-accent);
  padding: 0.45rem 0.7rem;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.dd-experience-mode__btn:hover:not(.dd-experience-mode__btn--on) {
  background: var(--dd-accent-soft);
}

.dd-experience-mode__btn--on {
  background: var(--dd-accent);
  color: #fff;
  font-weight: 600;
}

.dd-btn {
  font-family: inherit;
  font-size: 0.9rem;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  padding: 0.45rem 0.9rem;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.dd-btn--ghost {
  color: var(--dd-accent);
  background: #fff;
  border-color: var(--dd-accent);
}

.dd-btn--ghost:hover {
  background: var(--dd-accent-soft);
}

.dd-btn--back-home {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.dd-btn-back-arrow {
  font-size: 1.05rem;
  line-height: 1;
  font-weight: 700;
}

.dd-btn-back-label {
  font-weight: 600;
}

.dd-btn--danger-ghost {
  color: #b91c1c;
  background: #fff;
  border-color: #fecaca;
}

.dd-btn--danger-ghost:hover {
  background: #fef2f2;
}

.dd-btn--primary {
  color: #fff;
  background: var(--dd-accent);
  border-color: var(--dd-accent);
}

.dd-btn--primary:hover {
  filter: brightness(1.05);
}

.dd-case-headline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  padding: 0.55rem 1rem;
  background: #fff;
  border: 1px solid var(--dd-border);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.dd-archive-pill {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  background: var(--dd-accent);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
}

.dd-case-headline-main {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 0.92rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dd-main {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 1rem;
  min-height: var(--dd-main-height);
}

/* 左约 1/3：定宽 + 与主栏同高，内部仅 dd-chat-body 滚动 */
.dd-chat {
  flex: 0 0 33%;
  max-width: 33%;
  min-width: 280px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--dd-surface);
  border: 1px solid var(--dd-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.dd-chat-head {
  flex-shrink: 0;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--dd-border);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.dd-chat-head-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.45rem;
  min-width: 0;
}

.dd-chat-head-title {
  font-weight: 700;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.dd-chat-panel-tabs {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.12rem;
  border-radius: 8px;
  background: #f1f5f9;
  border: 1px solid var(--dd-border);
}

.dd-chat-panel-tab {
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.2;
  padding: 0.28rem 0.65rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dd-muted);
  cursor: pointer;
}

.dd-chat-panel-tab--on {
  color: #fff;
  background: var(--dd-accent, #7c3aed);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
}

.dd-chat-panel-tab:not(.dd-chat-panel-tab--on):hover {
  color: var(--dd-text);
  background: rgba(255, 255, 255, 0.75);
}

.dd-chat-body--timeline {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
}

/* 标题栏右侧：当前任务名（紫底白字圆角标签） */
.dd-current-task-tag {
  flex: 0 1 auto;
  max-width: min(14rem, 58%);
  padding: 0.28rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.25;
  color: #fff;
  background: #6d28d9;
  border: 1px solid #5b21b6;
  border-radius: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 1px 2px rgba(91, 33, 182, 0.25);
}

.dd-chat-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

/* 多张任务动态卡（任务 1 收官 + 任务 2 进行中等）纵向间距 */
.dd-dynamics-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dd-dynamics-feed {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

.dd-chat-placeholder {
  margin: 0;
  font-size: 0.82rem;
  color: var(--dd-muted);
  line-height: 1.5;
}

.dd-chat-placeholder code {
  font-size: 0.8em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: #e2e8f0;
}

.dd-chat-error {
  margin: 0;
  font-size: 0.84rem;
  color: #b91c1c;
  line-height: 1.45;
}

.dd-sys-card {
  border-radius: 10px;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--dd-border);
  background: linear-gradient(135deg, #f8fafc 0%, #fff 50%);
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.06);
}

.dd-sys-card-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
}

.dd-sys-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--dd-text);
}

.dd-sys-title--busy {
  color: var(--dd-accent);
}

.dd-sys-spinner {
  flex-shrink: 0;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  border: 2px solid rgba(37, 99, 235, 0.28);
  border-top-color: var(--dd-accent);
  animation: dd-sys-spin 0.65s linear infinite;
}

@keyframes dd-sys-spin {
  to {
    transform: rotate(360deg);
  }
}

.dd-sys-progress {
  min-height: 6.5rem;
  max-height: 6.5rem;
  overflow: hidden;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.dd-line-stack {
  padding: 0.35rem 0.5rem;
}

.dd-line {
  font-size: 0.78rem;
  line-height: 1.3;
  min-height: 1.3em;
  padding: 0.18rem 0;
  color: var(--dd-text);
  border-bottom: 1px solid #f1f5f9;
}

/* 「需用户返回内容」引导：偏蓝主文 + 行尾沙漏旋转（满足条件后沙漏隐藏） */
.dd-line--await-input {
  color: #1d4ed8;
  font-weight: 500;
}

.dd-line-text {
  vertical-align: baseline;
}

.dd-line-hourglass {
  display: inline-block;
  margin-left: 0.2em;
  font-size: 0.92em;
  vertical-align: -0.08em;
  animation: dd-hourglass-rotate 0.85s linear infinite;
}

@keyframes dd-hourglass-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.dd-line:last-child {
  border-bottom: none;
}

.dd-line-move,
.dd-line-enter-active,
.dd-line-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.dd-line-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.dd-line-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.dd-chat-msg {
  border-radius: 10px;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--dd-border);
  background: #f8fafc;
}

.dd-chat-msg--sys {
  border-left: 3px solid var(--dd-accent);
}

.dd-chat-msg-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--dd-muted);
  margin-bottom: 0.35rem;
}

.dd-chat-msg-body {
  font-size: 0.84rem;
  line-height: 1.5;
}

.dd-chat-foot {
  flex-shrink: 0;
  min-width: 0;
  padding: 0.65rem 1rem;
  border-top: 1px solid var(--dd-border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: #fff;
  box-sizing: border-box;
}

.dd-chat-input {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  resize: vertical;
  min-height: 3.5rem;
  border: 1px solid var(--dd-border);
  border-radius: 10px;
  padding: 0.5rem 0.65rem;
  font-family: inherit;
  font-size: 0.88rem;
  color: var(--dd-text);
  background: #fff;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

@keyframes dd-chat-input-scope-pulse {
  0%,
  100% {
    border-color: #60a5fa;
    box-shadow:
      0 0 0 1px rgba(37, 99, 235, 0.35),
      0 0 14px 2px rgba(59, 130, 246, 0.28);
  }
  50% {
    border-color: #2563eb;
    box-shadow:
      0 0 0 2px rgba(37, 99, 235, 0.45),
      0 0 22px 6px rgba(59, 130, 246, 0.38);
  }
}

.dd-chat-input--await-task1-scope:not(:disabled) {
  border-color: #3b82f6;
  animation: dd-chat-input-scope-pulse 1.75s ease-in-out infinite;
}

.dd-chat-send {
  align-self: flex-end;
}

/* 右约 2/3：桌面下由 `.dd-workspace-body` 承担纵向滚动，本壳不随内容顶高整页 */
.dd-workspace {
  flex: 1 1 67%;
  min-width: 0;
  background: var(--dd-surface);
  border: 1px solid var(--dd-border);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.dd-workspace-inner {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

/* 横向 Tab 下方面板区：桌面独立滚条 */
.dd-workspace-body {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}

.dd-workspace-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem 0;
}

.dd-workspace-toolbar .dd-tabs {
  flex: 1 1 auto;
  min-width: 0;
}

.dd-workspace-fs-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--dd-border);
  border-radius: 8px;
  background: #f8fafc;
  color: var(--dd-muted);
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}

.dd-workspace-fs-btn:hover {
  color: var(--dd-accent);
  border-color: var(--dd-accent);
  background: var(--dd-accent-soft);
}

.dd-workspace-fs-btn[aria-pressed='true'] {
  color: var(--dd-accent);
  border-color: var(--dd-accent);
  background: var(--dd-accent-soft);
}

.dd-workspace-fs-icon {
  display: block;
}

.dd-workspace:fullscreen,
.dd-workspace:-webkit-full-screen {
  flex: 1 1 auto;
  width: 100vw;
  height: 100vh;
  max-height: 100vh;
  border-radius: 0;
  border: none;
  box-shadow: none;
}

.dd-workspace:fullscreen .dd-workspace-inner,
.dd-workspace:-webkit-full-screen .dd-workspace-inner {
  height: 100%;
}

.dd-workspace:fullscreen .dd-workspace-body,
.dd-workspace:-webkit-full-screen .dd-workspace-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.dd-workspace:fullscreen .dd-panel--arch-inventory,
.dd-workspace:-webkit-full-screen .dd-panel--arch-inventory,
.dd-workspace:fullscreen .dd-panel--csu,
.dd-workspace:-webkit-full-screen .dd-panel--csu {
  min-height: 0;
  flex: 1 1 auto;
}

.dd-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.dd-tabs--scroll {
  flex-wrap: nowrap;
  overflow-x: auto;
  padding-bottom: 0.15rem;
  scrollbar-width: thin;
}

.dd-tab {
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.38rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--dd-border);
  background: #f8fafc;
  color: var(--dd-muted);
  cursor: pointer;
}

/* 与 `.dd-chat-input--await-task1-scope` 同系：标出当前画布分区 */
@keyframes dd-canvas-tab-active-glow {
  0%,
  100% {
    border-color: #60a5fa;
    box-shadow:
      0 0 0 1px rgba(37, 99, 235, 0.35),
      0 0 12px 2px rgba(59, 130, 246, 0.28);
  }
  50% {
    border-color: #2563eb;
    box-shadow:
      0 0 0 2px rgba(37, 99, 235, 0.45),
      0 0 18px 5px rgba(59, 130, 246, 0.36);
  }
}

.dd-tab--on {
  color: var(--dd-accent);
  border-color: var(--dd-accent);
  background: var(--dd-accent-soft);
  animation: dd-canvas-tab-active-glow 1.75s ease-in-out infinite;
}

.dd-panel {
  padding: 0.85rem;
  flex: 0 0 auto;
  overflow-x: hidden;
  overflow-y: visible;
}

.dd-panel--grid {
  display: flex;
  flex-direction: column;
}

.dd-panel--req-stack {
  display: flex;
  flex-direction: column;
}

.dd-panel--arch-inventory {
  display: flex;
  flex-direction: column;
  min-height: 420px;
  padding: 0;
  overflow: hidden;
}

/* 现状理解：单层滚动（工作区 body），全屏下占满剩余高度 */
.dd-panel--csu {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: visible;
}

.dd-panel--drv {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: visible;
}

/* 需求提炼画布：自上而下层叠根卡片；行式字段对齐详情页 .problem-detail-row / .problem-detail-label */
.dd-req-stack {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding-right: 0.15rem;
}

.dd-req-empty {
  margin: 0;
  font-size: 0.84rem;
  color: var(--dd-muted);
  line-height: 1.5;
}

.dd-req-root-card {
  background: #fff;
  border: 1px solid var(--dd-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.06);
}

.dd-req-root-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
  border-bottom: 1px solid var(--dd-border);
}

.dd-req-root-head--collapsed {
  border-bottom: none;
}

/* 「合并需求」：绿底白字标题栏，与子卡片同折叠/子 Tab 结构 */
.dd-req-root-head--merged {
  background: linear-gradient(180deg, #22c55e 0%, #15803d 100%);
  border-bottom: 1px solid #166534;
}

.dd-req-root-head--merged.dd-req-root-head--collapsed {
  border-bottom: none;
}

.dd-req-root-head--merged .dd-req-root-toggle {
  color: #fff;
}

.dd-req-root-head--merged .dd-req-root-toggle:focus-visible {
  outline-color: #fff;
}

.dd-req-root-title--merged {
  color: #fff;
  letter-spacing: 0.03em;
}

.dd-req-chevron--merged {
  border-right-color: rgba(255, 255, 255, 0.92);
  border-bottom-color: rgba(255, 255, 255, 0.92);
}

.dd-req-root-badge--merged {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.45);
}

.dd-req-root-card--merged {
  border-color: #86efac;
  box-shadow: 0 2px 12px rgba(22, 101, 52, 0.14);
}

.dd-req-root-toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0.55rem 0.75rem;
  border: none;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.dd-req-root-toggle:focus-visible {
  outline: 2px solid var(--dd-accent);
  outline-offset: -2px;
}

.dd-req-chevron {
  display: block;
  width: 0.4rem;
  height: 0.4rem;
  flex-shrink: 0;
  margin-top: 0.05rem;
  border-right: 2px solid var(--dd-muted);
  border-bottom: 2px solid var(--dd-muted);
  transform: rotate(-45deg);
  transition: transform 0.15s ease;
}

.dd-req-chevron--open {
  transform: rotate(45deg);
  margin-top: -0.05rem;
}

.dd-req-root-title {
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--dd-text);
  min-width: 0;
}

.dd-req-root-title--latest {
  color: var(--dd-accent);
}

.dd-req-root-head-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  margin-right: 0.75rem;
}

.dd-req-root-seq {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  padding: 0.12rem 0.42rem;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 800;
  line-height: 1.2;
  color: #fff;
  background: var(--dd-accent);
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.35);
}

.dd-req-root-badge {
  flex-shrink: 0;
  align-self: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--dd-muted);
  border: 1px solid var(--dd-border);
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: #fff;
}

.dd-req-subtabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem 0.35rem;
  border-bottom: 1px solid #f1f5f9;
  background: #fafafa;
}

.dd-req-subtab {
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.28rem 0.55rem;
  border-radius: 6px;
  border: 1px solid var(--dd-border);
  background: #fff;
  color: var(--dd-muted);
  cursor: pointer;
}

.dd-req-subtab--on {
  color: var(--dd-accent);
  border-color: var(--dd-accent);
  background: var(--dd-accent-soft);
}

.dd-req-subpanel {
  padding: 0.65rem 0.85rem 0.85rem;
}

.dd-req-field-panel {
  min-height: 2.5rem;
}

.dd-req-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.dd-req-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--dd-muted);
  width: 10em;
  min-width: 10em;
  max-width: 10em;
  flex: 0 0 10em;
  overflow-wrap: break-word;
  word-break: break-word;
  text-align: left;
}

.dd-req-value {
  font-size: 0.875rem;
  color: var(--dd-text);
  flex: 1;
  min-width: 0;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
}

.dd-card {
  background: #fff;
  border: 1px solid var(--dd-border);
  border-radius: 12px;
  overflow: hidden;
}

.dd-card--accent {
  border-color: #bfdbfe;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.08);
}

.dd-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.6rem 0.85rem;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
  border-bottom: 1px solid var(--dd-border);
}

.dd-card-title {
  font-weight: 700;
  font-size: 0.9rem;
}

.dd-card-badge {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--dd-muted);
  border: 1px solid var(--dd-border);
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
}

.dd-card-body {
  padding: 0.85rem;
}

.dd-kv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem 1rem;
}

.dd-kv--full {
  grid-column: 1 / -1;
}

.dd-k {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fff;
  background: var(--dd-accent);
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  margin-bottom: 0.35rem;
  width: fit-content;
}

.dd-v {
  font-size: 0.86rem;
  line-height: 1.45;
  word-break: break-word;
}

.dd-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8rem;
}

.dd-muted {
  margin: 0 0 0.75rem;
  font-size: 0.84rem;
  color: var(--dd-muted);
  line-height: 1.55;
}

.dd-canvas-table-wrap {
  padding: 0;
}

.dd-table-scroll {
  max-height: min(52vh, 28rem);
  overflow: auto;
  border-radius: 0 0 10px 10px;
}

.dd-canvas-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  line-height: 1.45;
}

.dd-canvas-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  padding: 0.5rem 0.65rem;
  background: #f1f5f9;
  border-bottom: 1px solid var(--dd-border);
  color: var(--dd-text);
  font-weight: 700;
}

.dd-canvas-table tbody th {
  width: 8.5rem;
  vertical-align: top;
  text-align: left;
  padding: 0.45rem 0.65rem;
  border-bottom: 1px solid #f1f5f9;
  font-weight: 600;
  color: var(--dd-muted);
  background: #fafafa;
}

.dd-canvas-table td {
  padding: 0.45rem 0.65rem;
  border-bottom: 1px solid #f1f5f9;
  word-break: break-word;
  color: var(--dd-text);
}

@media (min-width: 901px) {
  .dd-app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-height: 100vh;
    overflow: hidden;
  }

  .dd-top-nav,
  .dd-case-headline {
    flex-shrink: 0;
  }

  .dd-main {
    flex: 1 1 auto;
    min-height: 0;
    align-items: stretch;
  }

  .dd-chat {
    align-self: stretch;
    height: auto;
    max-height: none;
    flex-shrink: 0;
  }

  .dd-workspace {
    align-self: stretch;
    height: auto;
    min-height: 0;
  }

  .dd-workspace-body {
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}

@media (max-width: 900px) {
  .dd-main {
    flex-direction: column;
    min-height: 0;
  }

  .dd-chat {
    flex: 0 0 auto;
    max-width: none;
    width: 100%;
    height: auto;
    min-height: 280px;
  }

  .dd-workspace {
    flex: 1 1 auto;
    min-height: 360px;
    overflow: visible;
  }

  .dd-workspace-inner {
    overflow: visible;
  }

  .dd-workspace-body {
    flex: 0 1 auto;
    overflow: visible;
    min-height: 0;
  }

  .dd-kv-grid {
    grid-template-columns: 1fr;
  }

  .dd-kv--full {
    grid-column: 1;
  }
}

.dd-select-restart-backdrop {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1.25rem 1rem 2rem;
  box-sizing: border-box;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  overflow-y: auto;
}

.dd-select-restart-panel {
  width: 100%;
  max-width: 480px;
  margin-top: 2rem;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.18);
  padding: 1rem 1.15rem 1.1rem;
  box-sizing: border-box;
}

.dd-select-restart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.dd-select-restart-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
}

.dd-select-restart-close {
  font: inherit;
  font-size: 0.875rem;
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #334155;
  cursor: pointer;
}

.dd-select-restart-close:hover {
  background: #f1f5f9;
}

.dd-select-restart-hint {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #64748b;
}

.dd-select-restart-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: min(60vh, 420px);
  overflow-y: auto;
}

.dd-select-restart-item {
  width: 100%;
  text-align: left;
  font: inherit;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.dd-select-restart-item:hover:not(:disabled) {
  border-color: #93c5fd;
  background: #eff6ff;
}

.dd-select-restart-item:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.dd-select-restart-item-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #0f172a;
}

.dd-select-restart-item-sub {
  font-size: 0.78rem;
  color: #64748b;
}
</style>

<!-- 本页独立入口不链入主站 styles.css，在此统一浅色底避免裸 body 继承其它页暗色 token -->
<style>
  html,
  body {
    margin: 0;
    min-height: 100vh;
    background: #f1f5f9;
    color: #0f172a;
    font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Segoe UI', system-ui,
      -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.6;
  }
</style>
