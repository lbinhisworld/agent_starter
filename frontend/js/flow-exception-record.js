/**
 * [INPUT]: localStorage、`SmartCto` 宿主（由详情页写入快照）
 * [OUTPUT]: `SmartCto.flowExceptionRecord` — 流程异常快照持久化、最近系统动作探针
 * [POS]: 详情跟进异常恢复与审计；无后端依赖
 *
 * [PROTOCOL]: 变更字段语义或存储键时须同步 `main.js` 的 `applyFlowExceptionResume` 与 `frontend/js/AGENTS.md`。**FE-20260409**：`plusRequirementResetConfirmBlock` → 探针 `plus_requirement_reset_confirm`
 */
(function (global) {
  const STORAGE_KEY = 'feFlowExceptionSnapshot_v1';

  /** @type {{ kind: string, summary: string, detail: Object|null, at: string|null }} */
  let lastSystemActionProbe = { kind: 'none', summary: '', detail: null, at: null };

  function safeParse(json, fallback) {
    try {
      const o = JSON.parse(json);
      return o && typeof o === 'object' ? o : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function readStore() {
    try {
      return safeParse(global.localStorage.getItem(STORAGE_KEY), {});
    } catch (_) {
      return {};
    }
  }

  function writeStore(map) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(map && typeof map === 'object' ? map : {}));
    } catch (_) {}
  }

  /**
   * @param {Object} entry - 完整快照（含 lastSystemAction、会话 UI 状态等）
   */
  function recordFlowException(entry) {
    if (!entry || typeof entry !== 'object' || !entry.caseKey) return;
    const map = readStore();
    const prev = map[entry.caseKey];
    const hist = Array.isArray(prev?.history) ? prev.history.slice() : [];
    hist.push({
      archiveNo: entry.archiveNo,
      type: entry.type,
      typeLabel: entry.typeLabel,
      description: String(entry.description || '').slice(0, 2000),
      occurredAt: entry.occurredAt,
      taskId: entry.taskId,
      taskPhase: entry.taskPhase,
      lastSystemActionSummary: entry.lastSystemAction?.summary || '',
    });
    while (hist.length > 40) hist.shift();
    map[entry.caseKey] = { ...entry, history: hist };
    writeStore(map);
  }

  function getLastFlowException(caseKey) {
    if (!caseKey) return null;
    const map = readStore();
    return map[caseKey] || null;
  }

  function clearFlowException(caseKey) {
    if (!caseKey) return;
    const map = readStore();
    delete map[caseKey];
    writeStore(map);
  }

  function getLastSystemActionProbe() {
    return { ...lastSystemActionProbe };
  }

  /** 写入异常快照前可强制覆盖探针（如补充失败后希望「异常继续」重放继续引导语而非错误行） */
  function setLastSystemActionProbeOverride(override) {
    if (!override || typeof override !== 'object') return;
    lastSystemActionProbe = {
      kind: String(override.kind || 'none'),
      summary: String(override.summary || ''),
      detail: override.detail != null && typeof override.detail === 'object' ? override.detail : null,
      at: new Date().toISOString(),
    };
  }

  /**
   * 在 push 聊天后更新「最近一次系统动作」探针，供异常快照引用。
   * @param {Object} msg
   */
  function updateLastSystemActionFromChatMsg(msg) {
    if (!msg || typeof msg !== 'object') return;
    const at = new Date().toISOString();
    if (msg.type === 'taskStartNotification' && msg.taskId) {
      lastSystemActionProbe = {
        kind: 'task_start_notification',
        summary: `下发任务启动通知：${msg.taskName || msg.taskId}`,
        detail: { taskId: msg.taskId, taskName: msg.taskName || '' },
        at,
      };
      return;
    }
    if (msg.role === 'system' && typeof msg.content === 'string' && msg.content.trim()) {
      const s = msg.content.trim();
      lastSystemActionProbe = {
        kind: 'system_message',
        summary: s.length > 240 ? `${s.slice(0, 240)}…` : s,
        detail: { content: s },
        at,
      };
      return;
    }
    if (msg.type === 'preliminaryRequirementFollowupBlock') {
      lastSystemActionProbe = {
        kind: 'preliminary_followup_block',
        summary: '下发初步需求跟进块（客户初步需求已更新到工作区）',
        detail: { type: 'preliminaryRequirementFollowupBlock', taskId: msg.taskId || 'task1' },
        at,
      };
      return;
    }
    if (msg.type === 'plusRequirementResetConfirmBlock') {
      lastSystemActionProbe = {
        kind: 'plus_requirement_reset_confirm',
        summary: '聊天区确认：+需求（清空 task2+ 回 task1 补充）',
        detail: { type: 'plusRequirementResetConfirmBlock', taskId: msg.taskId || 'task1' },
        at,
      };
      return;
    }
    if (msg.type === 'llmRetryNoticeBlock') {
      lastSystemActionProbe = {
        kind: 'llm_retry_notice',
        summary: String(msg.content || '').slice(0, 240),
        detail: {
          type: 'llmRetryNoticeBlock',
          taskId: msg.taskId || '',
          content: String(msg.content || ''),
          retryAction: String(msg.retryAction || 'continue-current-task'),
          retryTargetLabel: String(msg.retryTargetLabel || ''),
        },
        at,
      };
    }
  }

  global.SmartCto = global.SmartCto || {};
  global.SmartCto.flowExceptionRecord = {
    recordFlowException,
    getLastFlowException,
    clearFlowException,
    getLastSystemActionProbe,
    updateLastSystemActionFromChatMsg,
    setLastSystemActionProbeOverride,
    STORAGE_KEY,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
