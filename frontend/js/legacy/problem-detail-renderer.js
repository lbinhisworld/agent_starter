/**
 * [INPUT]: `globalThis.SmartCto.appState`、`initProblemDetailRenderer(deps)` 注入的 DOM 与只读解析依赖（由 `main.js` 提供）
 * [OUTPUT]: 问题详情壳层 UI 的 DOM 更新与步骤条等纯展示；`globalThis.SmartCto.problemDetailRenderer`
 * [POS]: Phase 2B — `renderProblemDetailContent` 宿主仍留在 `main.js`（Phase 3B）
 *
 * [PROTOCOL]: 变更详情顶栏/步骤条展示口径时须同步 `frontend/js/legacy/AGENTS.md` 与主记录覆盖表
 */

/** @type {Record<string, unknown> | null} */
let _deps = null;

function requireDeps() {
  if (!_deps) {
    throw new Error('[problem-detail-renderer] initProblemDetailRenderer() must run before DOM updates');
  }
  return _deps;
}

function getAppState() {
  return globalThis.SmartCto.appState.getState();
}

/** @param {Record<string, unknown>} d */
function initProblemDetailRenderer(d) {
  _deps = d;
}

/** 更新问题详情顶栏：返回按钮右侧「案例编号」标签（与首页档案编号同源 archiveNo）；online 无 archiveNo 时仅展示「—」 */
function updateArchiveNoBadge() {
  const deps = requireDeps();
  const el = deps.el;
  const badge = el.problemDetailArchiveNoBadge;
  if (!badge) return;
  const item = getAppState().currentProblemDetailItem;
  if (!item) {
    badge.hidden = true;
    badge.textContent = '\u6848\u4f8b\u7f16\u53f7 \u2014';
    return;
  }
  const archiveNoNum = Number(item.archiveNo);
  const hasValid = Number.isFinite(archiveNoNum) && archiveNoNum > 0;
  if (deps.isOnlineMode() && !hasValid) {
    badge.textContent = '\u2014';
    badge.hidden = false;
    return;
  }
  badge.textContent = hasValid
    ? `\u6848\u4f8b\u7f16\u53f7 ${String(Math.floor(archiveNoNum)).padStart(4, '0')}`
    : '\u6848\u4f8b\u7f16\u53f7 \u2014';
  badge.hidden = false;
}

/** 更新对话区标题栏右上角讨论动画：讨论模式下显示，否则隐藏 */
function updateChatDiscussionIndicator() {
  const deps = requireDeps();
  const ind = deps.el.problemDetailChatDiscussionIndicator;
  if (!ind) return;
  if (deps.isInBmcDiscussionMode()) {
    ind.hidden = false;
    ind.removeAttribute('aria-hidden');
  } else {
    ind.hidden = true;
    ind.setAttribute('aria-hidden', 'true');
  }
}

/** 更新问题详情对话区标题栏：Agent 模式仅显示「任务阶段」+ 阶段徽章；Ask 模式显示「询问讨论模式」 */
function updateChatHeaderLabel() {
  const deps = requireDeps();
  const el = deps.el;
  const labelEl = el.problemDetailChatHeaderLabel;
  if (!labelEl) return;
  if (deps.getProblemDetailChatMode() === 'ask') {
    labelEl.textContent = '询问讨论模式';
    updateChatDiscussionIndicator();
    return;
  }
  const resolve = deps.resolveProblemItemForTaskNotification;
  const item =
    (typeof resolve === 'function' ? resolve() : null) || getAppState().currentProblemDetailItem;
  const messages = deps.getProblemDetailChatMessagesForCanonical(item);
  const canon = deps.getCanonicalCurrentProblemFollowTaskState(item, messages);
  const wsTid = typeof deps.getWorkspaceViewingTaskId === 'function' ? deps.getWorkspaceViewingTaskId() : null;
  const displayTaskId = canon.allComplete ? null : wsTid || canon.taskId;
  try {
    console.info('[FE:chat-header-canonical]', {
      taskId: displayTaskId,
      allComplete: canon.allComplete,
      majorStage: canon.majorStage,
      itemMajor: item?.currentMajorStage ?? null,
      viewingMajor: deps.getProblemDetailViewingMajorStage(),
    });
  } catch (_) {}
  labelEl.textContent = '';
  const prefix = document.createElement('span');
  prefix.className = 'problem-detail-chat-phase-prefix';
  prefix.textContent = '任务阶段：';
  labelEl.appendChild(prefix);
  const phaseBadge = document.createElement('span');
  phaseBadge.className = 'problem-detail-chat-task-phase-badge';
  phaseBadge.setAttribute('aria-label', '任务阶段');
  const phaseBadgeVariant = (text, variantSuffix) => {
    phaseBadge.textContent = text;
    if (variantSuffix) phaseBadge.classList.add(`problem-detail-chat-task-phase-badge--${variantSuffix}`);
  };
  if (canon.allComplete) {
    phaseBadgeVariant('已完成', 'completed');
  } else if (!displayTaskId) {
    phaseBadgeVariant('—', 'empty');
  } else {
    const FT = globalThis.FOLLOW_TASKS || [];
    const IG = globalThis.ITGAP_HISTORY_TASKS || [];
    const IS = globalThis.IT_STRATEGY_TASKS || [];
    const allTasks = [...FT, ...IG, ...IS];
    const phaseText =
      typeof deps.getTaskStatusText === 'function'
        ? deps.getTaskStatusText(item, displayTaskId, allTasks, messages)
        : '—';
    const suffix =
      phaseText === '待执行'
        ? 'pending'
        : phaseText === '进行中'
          ? 'in-progress'
          : phaseText === '已完成'
            ? 'completed'
            : phaseText === '修改中'
              ? 'modifying'
              : phaseText === '审计中'
                ? 'auditing'
                : 'unknown';
    phaseBadgeVariant(phaseText, suffix);
  }
  labelEl.appendChild(phaseBadge);
  updateChatDiscussionIndicator();
}

/** 根据 Agent/Ask 模式更新输入框样式与占位符 */
function updateChatInputForMode() {
  const deps = requireDeps();
  const input = deps.el.problemDetailChatInput;
  if (!input) return;
  if (deps.getProblemDetailChatMode() === 'ask') {
    input.classList.add('problem-detail-chat-input-ask-mode');
    input.placeholder = '您想了解本项目的什么信息？';
  } else {
    input.classList.remove('problem-detail-chat-input-ask-mode');
    input.placeholder = '输入消息或执行操作…';
  }
}

/**
 * task1–task15 步骤条：挂载于详情页工具栏下方独立一行 `#problemDetailTaskStepBar`
 * [PROTOCOL]: 与 problemDetailViewingMajorStage / focusWorkspaceOnCurrentTask / renderProblemDetailContent 联动变更时同步本函数、`frontend/index.html` 与 `frontend/AGENTS.md`
 */
function updateTaskStepBar() {
  const deps = requireDeps();
  const wrap = document.getElementById('problemDetailTaskStepBar');
  if (!wrap) return;
  const resolve = deps.resolveProblemItemForTaskNotification;
  const item =
    typeof resolve === 'function'
      ? resolve() || getAppState().currentProblemDetailItem
      : getAppState().currentProblemDetailItem;
  if (!item) {
    wrap.innerHTML = '';
    return;
  }
  const merged = item;
  const msgs =
    typeof deps.getProblemDetailChatMessagesForCanonical === 'function'
      ? deps.getProblemDetailChatMessagesForCanonical(item)
      : [];
  const canon = deps.getCanonicalCurrentProblemFollowTaskState(item, msgs);
  const currentMajorStage = merged.currentMajorStage ?? 0;
  const viewingTid = deps.getWorkspaceViewingTaskId();
  const FT = globalThis.FOLLOW_TASKS || [];
  const IG = globalThis.ITGAP_HISTORY_TASKS || [];
  const IS = globalThis.IT_STRATEGY_TASKS || [];
  const allTasks = [...FT, ...IG, ...IS];
  const parts = [];
  allTasks.forEach((t, idx) => {
    const tid = t.id;
    const taskMajor = deps.getMajorStageByTaskId(tid);
    const reached = taskMajor <= currentMajorStage;
    const done = deps.isTaskCompleted(merged, tid);
    const isCanon = !!(canon && !canon.allComplete && canon.taskId === tid);
    const isView = viewingTid === tid;
    let cls = 'problem-detail-task-step';
    if (!reached) cls += ' problem-detail-task-step--locked';
    if (done) cls += ' problem-detail-task-step--done';
    if (isView) cls += ' problem-detail-task-step--viewing';
    if (isCanon) cls += ' problem-detail-task-step--current';
    const num = idx + 1;
    const shortName = (t.name || tid).trim();
    const label = `${num}. ${shortName}`;
    const titleStr = `${t.stage || '—'} · ${shortName}`;
    const doneMark = done ? '<span class="problem-detail-task-step-check" aria-hidden="true">✓</span>' : '';
    parts.push(
      `<button type="button" class="${cls}" data-task-id="${deps.escapeHtml(tid)}" ${reached ? '' : 'disabled'} title="${deps.escapeHtml(titleStr)}">${deps.escapeHtml(label)}${doneMark}</button>`,
    );
  });
  wrap.innerHTML = parts.join('');
}

function updateProgressStages(_currentMajorStage, _viewingMajorStage) {
  updateTaskStepBar();
}

globalThis.SmartCto = globalThis.SmartCto || {};
globalThis.SmartCto.problemDetailRenderer = {
  init: initProblemDetailRenderer,
  updateArchiveNoBadge,
  updateChatDiscussionIndicator,
  updateChatHeaderLabel,
  updateChatInputForMode,
  updateTaskStepBar,
  updateProgressStages,
};
