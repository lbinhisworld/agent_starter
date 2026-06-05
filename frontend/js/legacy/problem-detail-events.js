/**
 * [INPUT]: `globalThis.SmartCto.appDom.el`、`installProblemDetailEvents(handlers)` 由 `main.js` 注入的回调
 * [OUTPUT]: 问题详情视图相关 DOM 事件绑定；`globalThis.SmartCto.problemDetailEvents`
 * [POS]: Phase 2B — 仅注册监听并转发至 `main.js` 既有处理函数，不承载业务判断
 *
 * [PROTOCOL]: 变更 DOM 事件入口或 data-attr 选择器时须同步 `frontend/js/legacy/AGENTS.md` 与主记录覆盖表
 */

/**
 * @param {{
 *   el: Record<string, HTMLElement | null>,
 *   onProblemDetailViewClickTaskStep: (e: MouseEvent) => void,
 *   onProblemDetailViewClickRestart: (e: MouseEvent) => void,
 *   onBtnProblemDetailHistoryClick: () => void,
 *   onBtnProblemDetailRollbackClick: () => void,
 *   onRollbackModalOverlayClick: (e: MouseEvent) => void,
 *   onBtnCloseRollbackModalClick: () => void,
 *   onRollbackModalTaskListClick: (e: MouseEvent) => void,
 *   onBtnCloseProblemDetailHistoryClick: () => void,
 *   onProblemDetailHistoryPanelClick: (e: MouseEvent) => void,
 *   onProblemDetailBodyClick: (e: MouseEvent) => void, // 含顶栏「+需求」委托（`#btnProblemDetailAddRequirement`）
 *   onWindowPagehideProblemDetailScroll: () => void,
 *   onProblemDetailChatSendClick: () => void,
 *   onProblemDetailChatInputKeydown: (e: KeyboardEvent) => void,
 *   onProblemDetailChatModeTriggerClick: (e: MouseEvent) => void,
 *   onProblemDetailChatModeOptionAgentClick: () => void,
 *   onProblemDetailChatModeOptionAskClick: () => void,
 *   onDocumentClickCloseProblemDetailChatModeDropdown: () => void,
 *   onProblemDetailChatMessagesClick: (e: MouseEvent) => void,
 * }} api
 */
function installProblemDetailEvents(api) {
  const { el } = api;
  if (el.problemDetailView) {
    el.problemDetailView.addEventListener('click', api.onProblemDetailViewClickTaskStep);
    el.problemDetailView.addEventListener('click', api.onProblemDetailViewClickRestart);
  }
  if (el.btnProblemDetailHistory) {
    el.btnProblemDetailHistory.addEventListener('click', api.onBtnProblemDetailHistoryClick);
  }
  if (el.btnProblemDetailRollback) {
    el.btnProblemDetailRollback.addEventListener('click', api.onBtnProblemDetailRollbackClick);
  }
  if (el.rollbackModalOverlay) {
    el.rollbackModalOverlay.addEventListener('click', api.onRollbackModalOverlayClick);
  }
  if (el.btnCloseRollbackModal) {
    el.btnCloseRollbackModal.addEventListener('click', api.onBtnCloseRollbackModalClick);
  }
  if (el.rollbackModalTaskList) {
    el.rollbackModalTaskList.addEventListener('click', api.onRollbackModalTaskListClick);
  }
  if (el.btnCloseProblemDetailHistory) {
    el.btnCloseProblemDetailHistory.addEventListener('click', api.onBtnCloseProblemDetailHistoryClick);
  }
  if (el.problemDetailHistoryPanel) {
    el.problemDetailHistoryPanel.addEventListener('click', api.onProblemDetailHistoryPanelClick);
  }
  if (el.problemDetailBody) {
    el.problemDetailBody.addEventListener('click', api.onProblemDetailBodyClick);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', api.onWindowPagehideProblemDetailScroll);
  }
  if (el.problemDetailChatSend) {
    el.problemDetailChatSend.addEventListener('click', api.onProblemDetailChatSendClick);
  }
  if (el.problemDetailChatInput) {
    el.problemDetailChatInput.addEventListener('keydown', api.onProblemDetailChatInputKeydown);
  }
  if (el.problemDetailChatModeTrigger) {
    el.problemDetailChatModeTrigger.addEventListener('click', api.onProblemDetailChatModeTriggerClick);
  }
  if (el.problemDetailChatModeOptionAgent) {
    el.problemDetailChatModeOptionAgent.addEventListener('click', api.onProblemDetailChatModeOptionAgentClick);
  }
  if (el.problemDetailChatModeOptionAsk) {
    el.problemDetailChatModeOptionAsk.addEventListener('click', api.onProblemDetailChatModeOptionAskClick);
  }
  document.addEventListener('click', api.onDocumentClickCloseProblemDetailChatModeDropdown);
  if (el.problemDetailChatMessages) {
    el.problemDetailChatMessages.addEventListener('click', api.onProblemDetailChatMessagesClick);
  }
}

globalThis.SmartCto = globalThis.SmartCto || {};
globalThis.SmartCto.problemDetailEvents = {
  install: installProblemDetailEvents,
};
