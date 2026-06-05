/**
 * [INPUT]: 首屏 `document`（脚本位于 `</body>` 前，与原先 `main.js` 内联查询同序）
 * [OUTPUT]: 壳层 DOM 缓存 `el`、`SmartCto.appDom` 与纯展示层 helper（无业务规则）
 * [POS]: Phase 2A — `main.js` 仅 bridge 引用本模块
 *
 * [PROTOCOL]: 变更 selector / 壳层结构须同步 `frontend/js/legacy/AGENTS.md` 与主记录覆盖表
 * （FE-20260406-02：`index.html` 已移除 legacy `#homeView` 及首页录入/列表相关 id，勿再向 `el` 缓存已删除节点。）
 */

/**
 * 主站壳层元素缓存（原 `main.js` 顶部 `el` 字面量；`problemDetailChatMessages` 为 **DOM 节点**，与 `SmartCto.appState` 中聊天数据数组区分）
 * @returns {Record<string, HTMLElement | null>}
 */
function buildShellElementCache() {
  return {
    companyName: document.getElementById('companyName'),
    btnQuery: document.getElementById('btnQuery'),
    btnSave: document.getElementById('btnSave'),
    btnHome: document.getElementById('btnHome'),
    navDetailLabel: document.getElementById('navDetailLabel'),
    chatPanel: document.getElementById('chatPanel'),
    btnChat: document.getElementById('btnChat'),
    btnCloseChat: document.getElementById('btnCloseChat'),
    historyPanel: document.getElementById('historyPanel'),
    btnHistory: document.getElementById('btnHistory'),
    btnCloseHistory: document.getElementById('btnCloseHistory'),
    historyContent: document.getElementById('historyContent'),
    chatInput: document.getElementById('chatInput'),
    chatSend: document.getElementById('chatSend'),
    chatMessages: document.getElementById('chatMessages'),
    btnValueStreamList: document.getElementById('btnValueStreamList'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    result: document.getElementById('result'),
    basicInfoList: document.getElementById('basicInfoList'),
    bmcGrid: document.getElementById('bmcGrid'),
    bmcReview: document.getElementById('bmcReview'),
    valueStreamSection: document.getElementById('valueStreamSection'),
    valueStreamContent: document.getElementById('valueStreamContent'),
    metadataList: document.getElementById('metadataList'),
    detailView: document.getElementById('detailView'),
    problemDetailView: document.getElementById('problemDetailView'),
    problemDetailCaseHeadline: document.getElementById('problemDetailCaseHeadline'),
    problemDetailContent: document.getElementById('problemDetailContent'),
    problemDetailChatMessages: document.getElementById('problemDetailChatMessages'),
    problemDetailChatInput: document.getElementById('problemDetailChatInput'),
    problemDetailChatSend: document.getElementById('problemDetailChatSend'),
    problemDetailChatHeaderLabel: document.getElementById('problemDetailChatHeaderLabel'),
    problemDetailChatDiscussionIndicator: document.getElementById('problemDetailChatDiscussionIndicator'),
    btnProblemDetailAddRequirement: document.getElementById('btnProblemDetailAddRequirement'),
    problemDetailChatModeTrigger: document.getElementById('problemDetailChatModeTrigger'),
    problemDetailChatModeTriggerIcon: document.getElementById('problemDetailChatModeTriggerIcon'),
    problemDetailChatModeTriggerText: document.getElementById('problemDetailChatModeTriggerText'),
    problemDetailChatModeDropdown: document.getElementById('problemDetailChatModeDropdown'),
    problemDetailChatModeOptionAgent: document.getElementById('problemDetailChatModeOptionAgent'),
    problemDetailChatModeOptionAsk: document.getElementById('problemDetailChatModeOptionAsk'),
    btnProblemDetailBack: document.getElementById('btnProblemDetailBack'),
    problemDetailArchiveNoBadge: document.getElementById('problemDetailArchiveNoBadge'),
    btnProblemDetailReset: document.getElementById('btnProblemDetailReset'),
    problemDetailBody: document.getElementById('problemDetailBody'),
    btnProblemDetailRollback: document.getElementById('btnProblemDetailRollback'),
    btnProblemDetailRestartTask: document.getElementById('btnProblemDetailRestartTask'),
    btnProblemDetailExceptionResume: document.getElementById('btnProblemDetailExceptionResume'),
    btnProblemDetailHistory: document.getElementById('btnProblemDetailHistory'),
    problemDetailHistoryPanel: document.getElementById('problemDetailHistoryPanel'),
    btnCloseProblemDetailHistory: document.getElementById('btnCloseProblemDetailHistory'),
    problemDetailHistoryContent: document.getElementById('problemDetailHistoryContent'),
    rollbackModalOverlay: document.getElementById('rollbackModalOverlay'),
    rollbackModalTaskList: document.getElementById('rollbackModalTaskList'),
    btnCloseRollbackModal: document.getElementById('btnCloseRollbackModal'),
    btnProblemCasePresalesReport: document.getElementById('btnProblemCasePresalesReport'),
    btnProblemCaseExport: document.getElementById('btnProblemCaseExport'),
    btnProblemCaseRestore: document.getElementById('btnProblemCaseRestore'),
    problemCaseRestoreInput: document.getElementById('problemCaseRestoreInput'),
    taskTrackingView: document.getElementById('taskTrackingView'),
    btnTaskTrackingBack: document.getElementById('btnTaskTrackingBack'),
    taskTrackingTitle: document.getElementById('taskTrackingTitle'),
    taskTrackingList: document.getElementById('taskTrackingList'),
    taskTrackingDetail: document.getElementById('taskTrackingDetail'),
    btnTaskTrackingEnter: document.getElementById('btnTaskTrackingEnter'),
    savedListContent: document.getElementById('savedListContent'),
    detailResult: document.getElementById('detailResult'),
    detailContent: document.querySelector('.detail-content'),
    detailTitle: document.getElementById('detailTitle'),
    searchSuggestions: document.getElementById('searchSuggestions'),
    topNav: document.getElementById('topNav'),
    navUserInfo: document.getElementById('navUserInfo'),
    btnModelConfig: document.getElementById('btnModelConfig'),
    btnLogout: document.getElementById('btnLogout'),
    basicInfoJsonPanel: document.getElementById('basicInfoJsonPanel'),
    basicInfoJsonContent: document.getElementById('basicInfoJsonContent'),
    btnCloseBasicInfoJson: document.getElementById('btnCloseBasicInfoJson'),
    btnCopyBasicInfoJson: document.getElementById('btnCopyBasicInfoJson'),
    bmcJsonPanel: document.getElementById('bmcJsonPanel'),
    bmcJsonContent: document.getElementById('bmcJsonContent'),
    btnCloseBmcJson: document.getElementById('btnCloseBmcJson'),
    btnCopyBmcJson: document.getElementById('btnCopyBmcJson'),
  };
}

const el = buildShellElementCache();

function getEl() {
  return el;
}

/** @param {HTMLElement | null} node */
function setHidden(node, hidden) {
  if (node) node.hidden = !!hidden;
}

/** @param {HTMLElement | null} node */
function toggleClass(node, className, force) {
  if (node && className) node.classList.toggle(className, force);
}

const appDom = {
  el,
  buildShellElementCache,
  getEl,
  setHidden,
  toggleClass,
};

globalThis.SmartCto = globalThis.SmartCto || {};
globalThis.SmartCto.appDom = appDom;
