/**
 * [INPUT]: 无（仅依赖 `sessionStorage` 与 `globalThis.SmartCto` 命名空间）
 * [OUTPUT]: `SmartCto.problemFollowShared` — 首页案例稳定键与 session 高亮键的单一实现（`main.js` 与 `frontend-vue` 首页 `problem-follow-home.ts` 共用）
 * [POS]: 首页 / 详情旁路共享契约；不得与 ProblemDetail 业务编排混写
 *
 * [PROTOCOL]: 变更键名或 `getProblemFollowCaseKey` 规则时须同步 `docs/design/home-shadow-migration-map.md` 与消费方；并更新本 Header 与 `frontend/js/core/AGENTS.md`
 */
(function (global) {
  'use strict';

  global.SmartCto = global.SmartCto || {};

  const PROBLEM_FOLLOW_HIGHLIGHTED_CASE_KEY = 'problem_follow_highlighted_case_key';

  /**
   * 首页卡片 / data-case-key / URL caseId 的稳定键：优先非空 id，否则 createdAt。
   * 注意：不能用 `id ?? createdAt`——后端若出现 id 为 "" 时 ?? 不会回退，会导致 caseKey 为空、详情按钮失效。
   */
  function getProblemFollowCaseKey(item) {
    if (!item) return '';
    const idStr = item.id != null && String(item.id).trim() !== '' ? String(item.id) : '';
    const caStr = item.createdAt != null && String(item.createdAt).trim() !== '' ? String(item.createdAt) : '';
    return idStr || caStr;
  }

  function getProblemFollowHighlightedCaseKey() {
    try {
      return String(sessionStorage.getItem(PROBLEM_FOLLOW_HIGHLIGHTED_CASE_KEY) || '').trim();
    } catch (_) {
      return '';
    }
  }

  function setProblemFollowHighlightedCaseKey(caseKey) {
    const normalized = caseKey == null ? '' : String(caseKey).trim();
    try {
      if (normalized) sessionStorage.setItem(PROBLEM_FOLLOW_HIGHLIGHTED_CASE_KEY, normalized);
      else sessionStorage.removeItem(PROBLEM_FOLLOW_HIGHLIGHTED_CASE_KEY);
    } catch (_) {}
    return normalized;
  }

  global.SmartCto.problemFollowShared = {
    PROBLEM_FOLLOW_HIGHLIGHTED_CASE_KEY,
    getProblemFollowCaseKey,
    getProblemFollowHighlightedCaseKey,
    setProblemFollowHighlightedCaseKey,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
