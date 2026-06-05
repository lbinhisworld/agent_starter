/**
 * [INPUT]: `APP_CONFIG`、`window.__STORAGE_HTTP_HYDRATED` / `window.__STORAGE_INDEXEDDB_HYDRATED`（由 storage 适配器置位）、`globalThis.getFirstUncompletedTask`（由 `main.js` 后挂）
 * [OUTPUT]: 详情页/聊天相关全局状态读写 façade；`globalThis.SmartCto.appState`
 * [POS]: Phase 1B — 不承担业务规则，仅集中状态槽位与 hydration / canonical task 读口
 *
 * [PROTOCOL]: 变更状态字段语义、hydration 判定或对外 API 时须同步 `frontend/js/core/AGENTS.md` 与主记录覆盖表；`problemDetailChatMessagesCaseKey` 与内存聊天绑定，换案须失效以防 canonical 串案（FE-20260403）。
 */

/** @type {{ currentProblemDetailItem: null | object, problemDetailChatMessages: Array, problemDetailChatMessagesCaseKey: string | null, chatHistory: Array }} */
const state = {
  currentProblemDetailItem: null,
  problemDetailChatMessages: [],
  /** 与 `problemDetailChatMessages` 绑定的存储键（通常同 `getProblemDetailChatStorageKey`）；为 null 时 canonical 不得信任内存数组（换案首帧 / bundle 刷新前）。 */
  problemDetailChatMessagesCaseKey: null,
  chatHistory: [],
};

function getState() {
  return state;
}

function getCurrentProblemDetailItem() {
  return state.currentProblemDetailItem;
}

function setCurrentProblemDetailItem(item) {
  state.currentProblemDetailItem = item;
}

function getProblemDetailChatMessages() {
  return state.problemDetailChatMessages;
}

/**
 * @param {Array} msgs
 * @param {string | null | undefined} [caseKey] 传入时同步更新与内存消息绑定的案例键；省略则不改键（仅追加场景）。
 */
function setProblemDetailChatMessages(msgs, caseKey) {
  state.problemDetailChatMessages = msgs;
  if (arguments.length >= 2) {
    state.problemDetailChatMessagesCaseKey =
      caseKey == null || String(caseKey).trim() === '' ? null : String(caseKey);
  }
}

function getChatHistory() {
  return state.chatHistory;
}

function setChatHistory(msgs) {
  state.chatHistory = msgs;
}

/** 与 `main.js` 原实现一致：local 看 IndexedDB hydration，online 看 HTTP hydration；不改动事件名与适配器置位语义 */
function isProblemDetailStorageHydrated() {
  const cfg = (typeof window !== 'undefined' && window.APP_CONFIG) || {};
  const mode = cfg.MODE;
  if (mode === 'local' && typeof window !== 'undefined' && window.STORAGE_INDEXEDDB_ADAPTER) {
    return window.__STORAGE_INDEXEDDB_HYDRATED === true;
  }
  if (mode === 'online') {
    return typeof window !== 'undefined' && window.__STORAGE_HTTP_HYDRATED === true;
  }
  return true;
}

/** 当前案例下首个未完成任务 id（委托 `getFirstUncompletedTask`，无业务分支） */
function getCanonicalActiveTaskId() {
  const item = state.currentProblemDetailItem;
  const fn = typeof globalThis !== 'undefined' ? globalThis.getFirstUncompletedTask : null;
  if (!item || typeof fn !== 'function') return null;
  const t = fn(item);
  return t && t.id != null ? String(t.id) : null;
}

const appState = {
  getState,
  getCurrentProblemDetailItem,
  setCurrentProblemDetailItem,
  getProblemDetailChatMessages,
  setProblemDetailChatMessages,
  getChatHistory,
  setChatHistory,
  isProblemDetailStorageHydrated,
  getCanonicalActiveTaskId,
};

globalThis.SmartCto = globalThis.SmartCto || {};
globalThis.SmartCto.appState = appState;
