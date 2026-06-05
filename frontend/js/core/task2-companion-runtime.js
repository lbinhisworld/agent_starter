/**
 * [INPUT]: `init(deps)` 注入 `appState` / `problemDetailChat` / `problemDetailRuntime` 引用及 `main.js` 闭包依赖（BMC_FIELDS、problemDetailConfirmedBasicInfo 等）
 * [OUTPUT]: Task2 BMC 生成、讨论/重生成编排入口；`globalThis.SmartCto.task2Runtime`
 * [POS]: Phase 4A 从 `main.js` 承接 task2 编排；**不**吸收非 task2 逻辑
 *
 * [PROTOCOL]: 变更 task2 消息类型或完成确认链路须同步主记录与 `frontend/js/core/AGENTS.md`
 * FE-20260415-task2-start：`runBmcGeneration` 工商 JSON 与 `runRequirementLogicConstruction` 对齐——`getProblemDetailConfirmedBasicInfo() || item.basicInfo`；`hasTask2StartConfirmed` 用 `String(m.taskId)` 比对 `task2`
 */

/** @type {Record<string, unknown> | null} */
let _deps = null;

function requireDeps() {
  if (!_deps) throw new Error('[task2-companion-runtime] init() 须由 main.js 执行');
  return _deps;
}

function getState() {
  return requireDeps().appState.getState();
}

async function runBmcGeneration() {
  const d = requireDeps();
  const el = d.el;
  const container = el.problemDetailChatMessages;
  const st = getState();
  const item = st.currentProblemDetailItem;
  /** 与 `runRequirementLogicConstruction` 一致：工商卡确认态变量未同步时仍可读 `item.basicInfo`（刷新/在线 bundle 后常见） */
  const basicJsonForRun = d.getProblemDetailConfirmedBasicInfo() || (item && item.basicInfo) || null;
  if (!container || !basicJsonForRun || !d.hasAiConfig()) return;
  const msgs = st.problemDetailChatMessages;
  const hasTask2StartConfirmed =
    Array.isArray(msgs) &&
    msgs.some(
      (m) =>
        (m.type === 'taskStartNotification' && String(m?.taskId || '') === 'task2' && m.confirmed) ||
        (m.type === 'bmcStartBlock' && m.confirmed),
    );
  if (!hasTask2StartConfirmed) return;

  const loading1 = document.createElement('div');
  loading1.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
  loading1.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在提取客户基本信息 json 数据</span></div></div><div class="problem-detail-chat-msg-time">${d.getTimeStr()}</div>`;
  container.appendChild(loading1);
  container.scrollTop = container.scrollHeight;
  await new Promise((r) => setTimeout(r, 400));
  const json = basicJsonForRun;
  loading1.remove();
  const loading2 = document.createElement('div');
  loading2.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
  loading2.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在生成企业商业画布 BMC</span></div></div><div class="problem-detail-chat-msg-time">${d.getTimeStr()}</div>`;
  container.appendChild(loading2);
  container.scrollTop = container.scrollHeight;
  try {
    const preliminaryReqJson =
      typeof globalThis.buildPreliminarySummaryJson === 'function' ? globalThis.buildPreliminarySummaryJson(item) : {};
    const { parsed: bmc, usage, model, durationMs, fullPrompt, rawOutput } = await globalThis.generateBmcFromBasicInfo(json, preliminaryReqJson);
    loading2.remove();
    const llmMeta = d.buildLlmMetaHtml({ usage, model, durationMs });
    d.problemDetailChat.pushAndSave(
      globalThis.buildTask2LlmQueryMessage({ fullPrompt, parsed: bmc, rawOutput, timestamp: d.getTimeStr(), usage, model, durationMs }),
    );
    d.problemDetailChat.pushAndSave({
      type: 'bmcCard',
      data: bmc,
      confirmed: false,
      timestamp: d.getTimeStr(),
      llmMeta: { usage, model, durationMs },
    });
    const msgIdx = getState().problemDetailChatMessages.length - 1;
    const cardBlock = document.createElement('div');
    cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-bmc-card-collapsible problem-detail-chat-msg-with-delete';
    cardBlock.dataset.msgIndex = String(msgIdx);
    cardBlock.dataset.taskId = 'task2';
    const bmcRows = d.BMC_FIELDS.map(({ key, label }) => {
      const value = (bmc[key] != null ? String(bmc[key]).trim() : '') || '—';
      return `<div class="problem-detail-bmc-row"><span class="problem-detail-bmc-label">${d.escapeHtml(label)}</span><span class="problem-detail-bmc-value">${d.escapeHtml(value)}</span></div>`;
    }).join('');
    const industryInsight = (bmc.industry_insight || '').trim() || '—';
    const painPoints = (bmc.pain_points || '').trim() || '—';
    const dataAttr = String(JSON.stringify(bmc))
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    cardBlock.innerHTML = `
      <button type="button" class="btn-delete-chat-msg" aria-label="删除">${d.DELETE_CHAT_MSG_ICON}</button>
      <div class="problem-detail-bmc-card" role="button" tabindex="0">
        <div class="problem-detail-bmc-card-body">
          ${industryInsight ? `<div class="problem-detail-bmc-section"><h4>商业模式画布 BMC 提炼</h4><div class="problem-detail-bmc-content">${d.escapeHtml(industryInsight)}</div></div>` : ''}
          <div class="problem-detail-bmc-grid">${bmcRows}</div>
          ${painPoints ? `<div class="problem-detail-bmc-section"><h4>业务痛点预判</h4><div class="problem-detail-bmc-content">${d.escapeHtml(painPoints)}</div></div>` : ''}
        </div>
        <div class="problem-detail-bmc-card-expand-hint">点击展开</div>
        <div class="problem-detail-bmc-card-actions">
          <button type="button" class="btn-confirm-bmc btn-confirm-primary" data-json="${dataAttr}">确认</button>
          <button type="button" class="btn-redo-bmc">重做</button>
          <button type="button" class="btn-refine-modify">修正</button>
          <button type="button" class="btn-refine-discuss">讨论</button>
        </div>
      </div>
      <div class="problem-detail-chat-msg-time">${d.getTimeStr()}</div>${llmMeta}`;
    container.appendChild(cardBlock);
    d.setupProblemDetailBmcCardToggle(cardBlock);
    container.scrollTop = container.scrollHeight;
    d.renderProblemDetailHistory();
  } catch (err) {
    const errMsg = err.message || String(err);
    loading2.classList.remove('problem-detail-chat-msg-parsing');
    loading2.querySelector('.problem-detail-chat-msg-content-wrap').innerHTML = `<div class="problem-detail-chat-msg-content">生成失败：${d.escapeHtml(errMsg)}</div><div class="problem-detail-chat-msg-actions"><button type="button" class="btn-redo-bmc-on-error">重做</button></div>`;
    loading2.dataset.bmcErrorMsg = errMsg;
    d.problemDetailChat.pushAndSave({ role: 'system', content: '生成失败：' + errMsg, timestamp: d.getTimeStr() });
  }
}

function getBaseBmcData() {
  const st = getState();
  const item = st.currentProblemDetailItem;
  if (item?.bmc && typeof item.bmc === 'object' && Object.keys(item.bmc).length > 0) return item.bmc;
  const arr = st.problemDetailChatMessages || [];
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i]?.type === 'bmcCard' && arr[i]?.data) return arr[i].data;
  }
  return {};
}

function getBmcDiscussionHistory() {
  const arr = getState().problemDetailChatMessages || [];
  let startIdx = -1;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i]?.type === 'bmcDiscussionStartBlock') {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) return [];
  let endIdx = -1;
  for (let i = startIdx + 1; i < arr.length; i++) {
    if (arr[i]?.type === 'bmcDiscussionEndBlock') {
      endIdx = i;
      break;
    }
  }
  const lastIdx = endIdx >= 0 ? endIdx - 1 : arr.length - 2;
  const out = [];
  for (let j = startIdx + 1; j <= lastIdx && j < arr.length - 1; j++) {
    const m = arr[j];
    if (!m) continue;
    if (m.role === 'user' && m.content != null) out.push({ role: 'user', content: String(m.content) });
    else if (m.type === 'bmcDiscussionReplyBlock' && m.content != null) out.push({ role: 'assistant', content: String(m.content) });
  }
  return out;
}

function isInBmcDiscussionMode() {
  const arr = getState().problemDetailChatMessages || [];
  let lastStartIdx = -1;
  let lastEndIdx = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]?.type === 'bmcDiscussionStartBlock') lastStartIdx = i;
    if (arr[i]?.type === 'bmcDiscussionEndBlock') lastEndIdx = i;
  }
  return lastStartIdx >= 0 && lastEndIdx < lastStartIdx;
}

/** 讨论结束后按上下文重生成 BMC（原 `handleProblemDetailChatMessagesClick` 内 `btn-bmc-discuss-regenerate` 分支） */
/**
 * 聊天区「确认」BMC：落库、刷新工作区与聊天、触发 task2 完成确认弹层（与 main 原逻辑一致）
 * @param {object} bmc
 * @param {HTMLButtonElement} [bmcBtnEl]
 */
function confirmBusinessModelCanvasFromChat(bmc, bmcBtnEl) {
  const d = requireDeps();
  const st = getState();
  const item = st.currentProblemDetailItem;
  if (item?.createdAt) {
    d.updateDigitalProblemBmc(item.createdAt, bmc, false);
    st.currentProblemDetailItem = { ...item, bmc };
  }
  let idx = -1;
  for (let i = st.problemDetailChatMessages.length - 1; i >= 0; i--) {
    if (st.problemDetailChatMessages[i].type === 'bmcCard') {
      idx = i;
      break;
    }
  }
  if (idx >= 0) {
    st.problemDetailChatMessages[idx] = { ...st.problemDetailChatMessages[idx], data: bmc, confirmed: true };
    for (let j = idx - 1; j >= 0; j--) {
      const q = st.problemDetailChatMessages[j];
      if (q?.type === 'task2LlmQueryBlock') {
        st.problemDetailChatMessages[j] = { ...q, confirmed: true };
        break;
      }
    }
    d.saveProblemDetailChat(item?.createdAt, st.problemDetailChatMessages);
  }
  d.renderProblemDetailContent();
  if (bmcBtnEl) {
    bmcBtnEl.textContent = '已确认';
    bmcBtnEl.disabled = true;
  }
  const chatContainer = d.el.problemDetailChatMessages;
  if (chatContainer) {
    chatContainer.innerHTML = '';
    d.renderProblemDetailChatFromStorage(chatContainer, st.problemDetailChatMessages);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  d.renderProblemDetailHistory();
  const lists = typeof d.getTaskLists === 'function' ? d.getTaskLists() : {};
  const { FOLLOW_TASKS: FT = [], ITGAP_HISTORY_TASKS: IH = [], IT_STRATEGY_TASKS: IS = [] } = lists;
  const task2Name =
    (FT.concat(IH).concat(IS).find((t) => t.id === 'task2')?.name) || '商业画布加载';
  requestAnimationFrame(() => {
    d.showTaskCompletionConfirm('task2', task2Name);
  });
}

async function handleBmcDiscussRegenerateClick() {
  const d = requireDeps();
  const st = getState();
  const createdAt = st.currentProblemDetailItem?.createdAt;
  const container = d.el.problemDetailChatMessages;
  if (!createdAt || !container) return;
  const basicInfoJson = d.getProblemDetailConfirmedBasicInfo() || st.currentProblemDetailItem?.basicInfo || {};
  if (!basicInfoJson || Object.keys(basicInfoJson).length === 0) return;
  const baseBmc = getBaseBmcData();
  if (!baseBmc || Object.keys(baseBmc).length === 0) return;
  const discussionHistory = getBmcDiscussionHistory();
  const discussionContextStr =
    Array.isArray(discussionHistory) && discussionHistory.length > 0
      ? '【讨论记录】\n' +
        discussionHistory
          .map((t) => `${t.role === 'user' ? '用户' : '助手'}: ${(t.content || '').slice(0, 2000)}${(t.content || '').length > 2000 ? '…' : ''}`)
          .join('\n\n')
      : '（无讨论记录）';
  const parsingBlock = document.createElement('div');
  parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
  parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在根据讨论上下文重新生成 BMC…</span></div></div><div class="problem-detail-chat-msg-time">${d.getTimeStr()}</div>`;
  container.appendChild(parsingBlock);
  container.scrollTop = container.scrollHeight;
  const genFn = typeof globalThis.generateBmcFromBasicInfoWithFeedback === 'function' ? globalThis.generateBmcFromBasicInfoWithFeedback : null;
  if (!genFn) {
    parsingBlock.remove();
    return;
  }
  try {
    const { parsed: bmc, usage, model, durationMs, fullPrompt, rawOutput } = await genFn(basicInfoJson, baseBmc, discussionContextStr, 'discussion');
    parsingBlock.remove();
    const msgs = st.problemDetailChatMessages;
    const bmcIdx = msgs.findLastIndex((m) => m.type === 'bmcCard');
    const qIdx = (() => {
      if (bmcIdx < 0) return -1;
      for (let i = bmcIdx - 1; i >= 0; i--) {
        if (msgs[i]?.type === 'task2LlmQueryBlock') return i;
      }
      return -1;
    })();
    const toRemove = [bmcIdx, qIdx].filter((i) => typeof i === 'number' && i >= 0).sort((a, b) => b - a);
    if (toRemove.length) {
      toRemove.forEach((i) => msgs.splice(i, 1));
      d.saveProblemDetailChat(createdAt, msgs);
    }
    d.problemDetailChat.pushAndSave(
      globalThis.buildTask2LlmQueryMessage({
        fullPrompt,
        parsed: bmc,
        rawOutput,
        timestamp: d.getTimeStr(),
        usage,
        model,
        durationMs,
      }),
    );
    d.problemDetailChat.pushAndSave({
      type: 'bmcCard',
      data: bmc,
      confirmed: false,
      timestamp: d.getTimeStr(),
      llmMeta: { usage, model, durationMs },
    });
    d.problemDetailChat.pushAndSave({ type: 'bmcDiscussionEndBlock', taskId: 'task2', timestamp: d.getTimeStr() });
    container.innerHTML = '';
    d.renderProblemDetailChatFromStorage(container, getState().problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
    d.renderProblemDetailHistory();
    d.updateProblemDetailChatDiscussionIndicator();
  } catch (err) {
    parsingBlock.remove();
    const errBlock = document.createElement('div');
    errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
    errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">根据讨论重新生成 BMC 失败：${d.escapeHtml(err.message || String(err))}</div></div><div class="problem-detail-chat-msg-time">${d.getTimeStr()}</div>`;
    container.appendChild(errBlock);
    d.problemDetailChat.pushAndSave({
      role: 'system',
      content: '根据讨论重新生成 BMC 失败：' + (err.message || String(err)),
      timestamp: d.getTimeStr(),
    });
    container.scrollTop = container.scrollHeight;
  }
}

function init(deps) {
  _deps = deps;
}

/** 讨论结束后重生成 BMC（窗口/测试可显式调用，与点击「重新生成」同源） */
function regenerateBmcAfterDiscussion() {
  return handleBmcDiscussRegenerateClick();
}

const task2RuntimeApi = {
  init,
  runBmcGeneration,
  getBaseBmcData,
  getBmcDiscussionHistory,
  isInBmcDiscussionMode,
  handleBmcDiscussRegenerateClick,
  regenerateBmcAfterDiscussion,
  confirmBusinessModelCanvasFromChat,
};

globalThis.SmartCto = globalThis.SmartCto || {};
globalThis.SmartCto.task2Runtime = task2RuntimeApi;
/** `main.js` 非 module：由 bootstrap 调用，与 `export` 并存 */
globalThis.SmartCto.initTask2CompanionRuntime = init;

if (typeof window !== 'undefined') {
  window.runBmcGeneration = () => task2RuntimeApi.runBmcGeneration();
  window.getBaseBmcData = () => task2RuntimeApi.getBaseBmcData();
  window.getBmcDiscussionHistory = () => task2RuntimeApi.getBmcDiscussionHistory();
}

export { init };
