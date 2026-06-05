/**
 * [INPUT]: `globalThis.SmartCto.appState`、`initProblemDetailChat(deps)` 注入的 DOM、存储辅助与只读解析依赖（由 `main.js` 提供）
 * [OUTPUT]: 聊天消息管理（push/save + 辅助 UI 交互）；`globalThis.SmartCto.problemDetailChat`
 * [POS]: Phase 3A — 聊天消息模型、持久化入口、渲染辅助迁出；`renderProblemDetailChatFromStorage` 宿主仍留在 `main.js`
 *
 * [PROTOCOL]: 变更 message 类型、消息顺序或聊天块 HTML 结构时须同步 `frontend/js/core/AGENTS.md` 与主记录覆盖表；push 后调用 `SmartCto.flowExceptionRecord.updateLastSystemActionFromChatMsg` 维护异常快照「最近系统动作」探针；`setProblemDetailChatMessages` 须传入存储键以绑定 `problemDetailChatMessagesCaseKey`（防换案串案，FE-20260403）。
 * **FE-20260331-52**：`setupProblemDetailValueStreamTabs` 仅绑定工作区「价值流图 / json」Tab（已移除价值流设计逻辑子卡 Tab 绑定）。
 * **FE-20260331-53**：价值流卡标题栏「全屏」按钮：`requestFullscreen` / `webkit` 前缀；`fullscreenchange` 同步图标与 `aria`。
 * **FE-20260405-03**：价值流卡标题栏「下载图」：`html-to-image` 动态 `import`（jsDelivr +esm）对 `.vs-graph-scroll`（或 view 面板）`toPng`，含横向滚动全宽；导出前临时切到「价值流图」Tab 并双 rAF 再截图。
 * **FE-20260401-07**：ITGap 工作区「端到端事务流」卡标题栏右侧全屏按钮（整块 `.problem-detail-card-e2e-flow`），与价值流卡同一套 Fullscreen API 与文档级 `fullscreenchange` 同步。**FE-20260408-e2e-dl**：全屏左侧「下载图」`.problem-detail-e2e-flow-download-btn`：先切 view Tab；未全屏时临时 `requestFullscreen` 使布局与全屏工作区一致，展开全部 `.e2e-bpm-tx-node-card` 后对 `.problem-detail-it-gap-e2e-wrap` `toPng`，导出后若本次进入全屏则 `exitFullscreen`；失败则退化为嵌入式导出（jsDelivr `html-to-image`）。**FE-20260409**：`setupProblemDetailItDesignSupplementFullscreen` + `syncItDesignSupplementFullscreenButtonState`，整块 `.problem-detail-card-it-design-supplement`。**FE-20260416-ws-json**：价值流 / 端到端事务流 / IT设计补齐 标题栏「下载 json」`.problem-detail-workspace-json-download-btn`：`{archiveNo}_价值流图json.json` 等，正文取自对应 json 面板 `<pre>`。
 * **FE-20260402-06**：事务流节点卡「成图预览」按钮 → 右侧滑出抽屉「事务流程图预览」；`setupProblemDetailE2eBpmTxPreview` 委托成图预览与 **`.e2e-bpm-tx-node-collapse-btn`** 折叠正文（`hidden` + 卡壳 `.e2e-bpm-tx-node-card--collapsed`；**`styles.css`** 对 `.e2e-bpm-tx-node-body` 配 `display:none !important`，避免 `display:flex` 压过 `[hidden]`）；`buildE2eBpmTransactionFlowPreviewDiagramHTML`（`valueStream.js`）+ 打开后 `syncE2eBpmPreviewDiagramWires`（双 rAF + `ResizeObserver`）按端口 DOM 绘连线。
 * **FE-20260409-6**：初步需求状态逻辑子卡 `.problem-detail-prelim-stm-card` 全屏与 `syncPrelimStmFullscreenButtonState`（`fullscreenchange` 与价值流/端到端同源）。**FE-20260409-8**：初步需求工作区整块卡 `.problem-detail-card-preliminary-tabs` 标题栏全屏 + `setupProblemDetailPreliminaryFullscreen` + `syncPreliminaryWorkspaceCardFullscreenButtonState`。
 * **FE-20260416-bmc-ws-ui**：需求理解工作区 `.problem-detail-card-bmc` 标题栏「下载图」`.problem-detail-bmc-download-btn`（`toPng` 目标 `.problem-detail-bmc-capture-root`，先切 view Tab）+ 全屏 `.problem-detail-bmc-fs-btn`；`setupProblemDetailBmcWorkspace` + `syncBmcFullscreenButtonState`。
 * **FE-20260409-llm-dedup**：`pushAndSaveProblemDetailChat` 对纳入过程日志双子卡的 LLM 块做去重：与 `communication-history.js` 中 `payload.content`（LLM-查询 / LLM-修改 / LLM-审计）及 `noteName`、输入 prompt、`llmOutputRaw` 或规范化后的 `llmOutputJson` 均一致则不再追加；`msg.skipProcessLogDedup === true` 可跳过；`isDuplicateProcessLogLlmMessage` 供 `main.js` 中不走 pushAndSave 的路径（如 task1 初步需求回填）复用。
 * **FE-20260415**：`getProblemDetailChatStorageKey` 与 `main.js` / HTTP 适配器一致：**优先 `id` 再 `createdAt`**，避免在线案 bundle 补全 `createdAt` 后聊天键从 `problem_*` 漂移到 ISO 时间戳。
 */

/** 与过程日志双子卡对齐、需防重复推送的 LLM 消息 type（与 communication-history 分支一致） */
const PROCESS_LOG_LLM_DEDUP_TYPES = new Set([
  'task1LlmQueryBlock',
  'task2LlmQueryBlock',
  'bmcDiscussionLlmQueryBlock',
  'task3LlmQueryBlock',
  'task4LlmQueryBlock',
  'task5LlmQueryBlock',
  'task6LlmQueryBlock',
  'task7LlmQueryBlock',
  'task8LlmQueryBlock',
  'task9LlmQueryBlock',
  'task10LlmQueryBlock',
  'task11LlmQueryBlock',
  'task11GlobalSkeletonAuditLlmQueryBlock',
  'task11CoreBusinessObjectAuditLlmQueryBlock',
  'rolePermissionAuditLlmQueryBlock',
  'modificationPromptRevisionLlmQueryBlock',
  'modificationRegenerateLlmQueryBlock',
  'rolePermissionModificationLlmQueryBlock',
]);

/** 与沟通历史写入过程日志时的「标签」一致，用于去重键 */
function getProcessLogLlmTagForDedup(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const t = msg.type;
  if (!t || !PROCESS_LOG_LLM_DEDUP_TYPES.has(t)) return null;
  if (t === 'task11GlobalSkeletonAuditLlmQueryBlock' || t === 'rolePermissionAuditLlmQueryBlock') return 'LLM-审计';
  if (t === 'modificationRegenerateLlmQueryBlock') {
    const tid = msg.taskId;
    return tid === 'task5' || tid === 'task1' || tid === 'task4' ? 'LLM-修改' : 'LLM-查询';
  }
  if (t === 'rolePermissionModificationLlmQueryBlock') return 'LLM-修改';
  return 'LLM-查询';
}

/** 对象键排序后序列化，便于比较 llmOutputJson 等价 */
function stableStringifyForLlmDedup(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return `[${v.map((x) => stableStringifyForLlmDedup(x)).join(',')}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringifyForLlmDedup(v[k])}`).join(',')}}`;
}

/** 输出侧指纹：优先原始文本，否则规范化 JSON */
function llmOutputFingerprintForDedup(msg) {
  const raw = msg?.llmOutputRaw != null ? String(msg.llmOutputRaw).trim() : '';
  if (raw !== '') return raw;
  if (msg?.llmOutputJson != null && typeof msg.llmOutputJson === 'object') return stableStringifyForLlmDedup(msg.llmOutputJson);
  if (msg?.llmOutputJson != null) return String(msg.llmOutputJson);
  return '';
}

/**
 * 过程日志 LLM 双子卡去重签名（标签 + 标题 + 输入输出 + 分步字段 + 任务 id）
 * @returns {string|null} null 表示不参与去重
 */
function buildProcessLogLlmDedupSignature(msg) {
  if (!msg || msg.skipProcessLogDedup === true) return null;
  const tag = getProcessLogLlmTagForDedup(msg);
  if (!tag) return null;
  const type = String(msg.type || '');
  const taskId = String(msg.taskId || '');
  const noteName = String(msg.noteName || '');
  const stepKey = [msg.stepName, msg.stepIndex, msg.phaseIndex].map((x) => (x == null ? '' : String(x))).join('\x1f');
  const extraKey = [
    msg.modificationActionMarkdown != null ? String(msg.modificationActionMarkdown) : '',
    msg.modificationDiffMarkdown != null ? String(msg.modificationDiffMarkdown) : '',
    msg.skillTimelinePrompt != null ? String(msg.skillTimelinePrompt) : '',
  ].join('\x1e');
  const input = msg.llmInputPrompt != null ? String(msg.llmInputPrompt) : '';
  const output = llmOutputFingerprintForDedup(msg);
  return [type, tag, taskId, noteName, stepKey, extraKey, input, output].join('\x00');
}

/**
 * 是否已存在与 candidate 过程日志展示等价（标签、标题、输入、输出一致）的 LLM 块
 * @param {unknown[]} existingList
 * @param {Record<string, unknown>} candidate
 */
function isDuplicateProcessLogLlmMessage(existingList, candidate) {
  const sig = buildProcessLogLlmDedupSignature(candidate);
  if (!sig || !Array.isArray(existingList)) return false;
  for (let i = 0; i < existingList.length; i++) {
    const m = existingList[i];
    if (!m || m.skipProcessLogDedup === true) continue;
    if (buildProcessLogLlmDedupSignature(m) === sig) return true;
  }
  return false;
}

/** @type {Record<string, unknown> | null} */
let _deps = null;

function requireDeps() {
  if (!_deps) {
    throw new Error('[problem-detail-chat] initProblemDetailChat() must run before chat operations');
  }
  return _deps;
}

function getAppState() {
  return globalThis.SmartCto.appState.getState();
}

/** 与 `main.js` / storage 适配器一致：有 id 时优先 id，否则 createdAt */
function getProblemDetailChatStorageKey(item) {
  if (!item) return '';
  const idStr = item.id != null && String(item.id).trim() !== '' ? String(item.id).trim() : '';
  const caStr = item.createdAt != null && String(item.createdAt).trim() !== '' ? String(item.createdAt).trim() : '';
  return idStr || caStr;
}

function getProblemDetailChatModeFromDeps() {
  const d = _deps;
  if (!d) return 'agent';
  if (typeof d.getProblemDetailChatMode === 'function') return d.getProblemDetailChatMode();
  return d.problemDetailChatMode ?? 'agent';
}

/** @param {Record<string, unknown>} d */
function initProblemDetailChat(d) {
  _deps = d;
}

/** 追加一条聊天消息到容器并保存到存储（ask 模式标记） */
function appendProblemDetailChatMessage(container, role, content, options) {
  const deps = requireDeps();
  const timeStr = options?.timestamp ?? deps.getTimeStr?.() ?? String(Date.now());
  const askMode = getProblemDetailChatModeFromDeps() === 'ask';
  const block = document.createElement('div');
  const collapsibleClass = role === 'user' ? ' problem-detail-chat-msg-collapsible' : '';
  block.className = `problem-detail-chat-msg problem-detail-chat-msg-${role}${collapsibleClass}`;
  block.innerHTML = `<div class="problem-detail-chat-msg-content-wrap" role="button" tabindex="0"><div class="problem-detail-chat-msg-content markdown-body">${deps.renderMarkdown?.(content) || String(content)}</div></div><div class="problem-detail-chat-msg-time">${deps.escapeHtml?.(timeStr) || ''}</div>`;
  container.appendChild(block);
  if (role === 'user') {
    setupProblemDetailChatTextToggle(block);
  }
  container.scrollTop = container.scrollHeight;
  if (!options?.noSave) {
    const st = getAppState();
    const prev = Array.isArray(st.problemDetailChatMessages) ? st.problemDetailChatMessages : [];
    const msg = { role, content, timestamp: timeStr };
    if (askMode) msg.askMode = true;
    const next = [...prev, msg];
    const ck = getProblemDetailChatStorageKey(st.currentProblemDetailItem);
    globalThis.SmartCto.appState.setProblemDetailChatMessages(next, ck || null);
    deps.saveProblemDetailChat?.(ck, next);
    try {
      globalThis.SmartCto?.flowExceptionRecord?.updateLastSystemActionFromChatMsg?.(msg);
    } catch (_) {}
  }
  return block;
}

/** 推送并保存一条聊天消息（ask 模式标记） */
function pushAndSaveProblemDetailChat(msg) {
  const deps = requireDeps();
  const st = getAppState();
  const prev = Array.isArray(st.problemDetailChatMessages) ? st.problemDetailChatMessages : [];
  const toPush = { ...msg };
  if (isDuplicateProcessLogLlmMessage(prev, toPush)) {
    return;
  }
  if (getProblemDetailChatModeFromDeps() === 'ask') toPush.askMode = true;
  const next = [...prev, toPush];
  const ck = getProblemDetailChatStorageKey(st.currentProblemDetailItem);
  globalThis.SmartCto.appState.setProblemDetailChatMessages(next, ck || null);
  deps.saveProblemDetailChat?.(ck, next);
  try {
    globalThis.SmartCto?.flowExceptionRecord?.updateLastSystemActionFromChatMsg?.(toPush);
  } catch (_) {}
}

/** 聊天文本展开/收起辅助 */
function setupProblemDetailChatTextToggle(msgBlock) {
  const wrap = msgBlock?.querySelector('.problem-detail-chat-msg-content-wrap');
  if (!wrap) return;
  wrap.addEventListener('click', () => {
    msgBlock.classList.toggle('problem-detail-chat-msg-expanded');
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      msgBlock.classList.toggle('problem-detail-chat-msg-expanded');
    }
  });
}

/** 基本信息卡片展开/收起（与 `main.js` 原选择器一致，仅 `.problem-detail-basic-info-card`） */
function setupProblemDetailChatCardToggle(cardBlock) {
  const card = cardBlock?.querySelector('.problem-detail-basic-info-card');
  if (!card) return;
  card.addEventListener('click', (e) => {
    if (e.target.closest('.btn-confirm-basic-info') || e.target.closest('.btn-confirm-requirement-logic') || e.target.closest('.btn-redo-basic-info') || e.target.closest('.btn-refine-modify') || e.target.closest('.btn-refine-discuss')) return;
    cardBlock.classList.toggle('problem-detail-chat-card-expanded');
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!e.target.closest('.btn-confirm-basic-info') && !e.target.closest('.btn-confirm-requirement-logic') && !e.target.closest('.btn-redo-basic-info') && !e.target.closest('.btn-refine-modify') && !e.target.closest('.btn-refine-discuss')) {
        cardBlock.classList.toggle('problem-detail-chat-card-expanded');
      }
    }
  });
}

function setupProblemDetailBmcCardToggle(cardBlock) {
  const card = cardBlock?.querySelector('.problem-detail-bmc-card');
  if (!card) return;
  card.addEventListener('click', (e) => {
    if (e.target.closest('.btn-confirm-bmc') || e.target.closest('.btn-redo-bmc') || e.target.closest('.btn-refine-modify') || e.target.closest('.btn-refine-discuss')) return;
    cardBlock.classList.toggle('problem-detail-chat-card-expanded');
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!e.target.closest('.btn-confirm-bmc') && !e.target.closest('.btn-redo-bmc') && !e.target.closest('.btn-refine-modify') && !e.target.closest('.btn-refine-discuss')) {
        cardBlock.classList.toggle('problem-detail-chat-card-expanded');
      }
    }
  });
}

function valueStreamCardIsFullscreen(card) {
  if (!card) return false;
  return document.fullscreenElement === card || document.webkitFullscreenElement === card;
}

function valueStreamRequestFullscreen(el) {
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  return Promise.reject(new Error('fullscreen unsupported'));
}

function valueStreamExitFullscreen() {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  return Promise.reject(new Error('exit fullscreen unsupported'));
}

/** 同步当前工作区价值流卡全屏按钮状态（依赖 document 级 fullscreenchange） */
function syncValueStreamFullscreenButtonState() {
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  const card =
    fsEl && fsEl.classList && fsEl.classList.contains('problem-detail-value-stream-card')
      ? fsEl
      : document.querySelector('.problem-detail-value-stream-card');
  if (!card) return;
  const btn = card.querySelector('.problem-detail-value-stream-fs-btn');
  if (!btn) return;
  const on = valueStreamCardIsFullscreen(card);
  btn.classList.toggle('problem-detail-value-stream-fs-btn--exit', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute('aria-label', on ? '退出全屏' : '全屏显示价值流图');
  btn.title = on ? '退出全屏' : '全屏显示价值流图';
}

function e2eFlowCardIsFullscreen(card) {
  if (!card) return false;
  return document.fullscreenElement === card || document.webkitFullscreenElement === card;
}

/** 同步端到端事务流卡全屏按钮状态（多张卡各自独立） */
function syncE2eFlowFullscreenButtonState() {
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  document.querySelectorAll('.problem-detail-card-e2e-flow').forEach((card) => {
    const btn = card.querySelector('.problem-detail-e2e-flow-fs-btn');
    if (!btn) return;
    const on = fsEl === card;
    const isSupplement = card.classList.contains('problem-detail-card-e2e-scenario-supplement');
    const labelBase = isSupplement ? '需求场景事务流补齐' : '端到端事务流';
    btn.classList.toggle('problem-detail-e2e-flow-fs-btn--exit', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? '退出全屏' : `全屏显示${labelBase}`);
    btn.title = on ? '退出全屏' : `全屏显示${labelBase}`;
  });
}

function itDesignSupplementCardIsFullscreen(card) {
  if (!card) return false;
  return document.fullscreenElement === card || document.webkitFullscreenElement === card;
}

/** 同步初步需求「状态逻辑」子卡全屏按钮（整块 `.problem-detail-prelim-stm-card`） */
function preliminaryWorkspaceCardIsFullscreen(card) {
  if (!card) return false;
  return document.fullscreenElement === card || document.webkitFullscreenElement === card;
}

/** 同步初步需求工作区卡（整块 `.problem-detail-card-preliminary-tabs`）全屏按钮 */
function syncPreliminaryWorkspaceCardFullscreenButtonState() {
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  document.querySelectorAll('.problem-detail-card-preliminary-tabs').forEach((card) => {
    const btn = card.querySelector('.problem-detail-card-preliminary-fs-btn');
    if (!btn) return;
    const on = fsEl === card;
    btn.classList.toggle('problem-detail-e2e-flow-fs-btn--exit', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? '退出全屏' : '全屏显示初步需求');
    btn.title = on ? '退出全屏' : '全屏显示初步需求';
  });
}

function syncPrelimStmFullscreenButtonState() {
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  document.querySelectorAll('.problem-detail-prelim-stm-card').forEach((card) => {
    const btn = card.querySelector('.problem-detail-prelim-stm-fs-btn');
    if (!btn) return;
    const on = fsEl === card;
    btn.classList.toggle('problem-detail-e2e-flow-fs-btn--exit', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? '退出全屏' : '全屏显示状态逻辑图');
    btn.title = on ? '退出全屏' : '全屏显示状态逻辑图';
  });
}

/** 同步 IT设计补齐 工作区卡全屏按钮状态（整块 `.problem-detail-card-it-design-supplement`） */
function syncItDesignSupplementFullscreenButtonState() {
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  const card =
    fsEl && fsEl.classList && fsEl.classList.contains('problem-detail-card-it-design-supplement')
      ? fsEl
      : document.querySelector('.problem-detail-card-it-design-supplement');
  if (!card) return;
  const btn = card.querySelector('.problem-detail-it-design-supplement-fs-btn');
  if (!btn) return;
  const on = itDesignSupplementCardIsFullscreen(card);
  btn.classList.toggle('problem-detail-e2e-flow-fs-btn--exit', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute('aria-label', on ? '退出全屏' : '全屏显示 IT设计补齐');
  btn.title = on ? '退出全屏' : '全屏显示 IT设计补齐';
}

let _workspaceFullscreenDocListenerBound = false;
function ensureWorkspaceFullscreenDocListener() {
  if (_workspaceFullscreenDocListenerBound) return;
  _workspaceFullscreenDocListenerBound = true;
  const fn = () => {
    syncValueStreamFullscreenButtonState();
    syncE2eFlowFullscreenButtonState();
    syncItDesignSupplementFullscreenButtonState();
    syncPreliminaryWorkspaceCardFullscreenButtonState();
    syncPrelimStmFullscreenButtonState();
    syncBmcFullscreenButtonState();
  };
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
}

/** 与首页 CDN 策略一致：按需加载，避免首屏体积（FE-20260405-03） */
const HTML_TO_IMAGE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm';

function resolveValueStreamPngBackground(panel, card) {
  const scroll = panel?.querySelector?.('.vs-graph-scroll');
  const probe = scroll || panel;
  if (!probe) return '#0f172a';
  let bg = getComputedStyle(probe).backgroundColor;
  if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
  const body = card?.querySelector?.('.problem-detail-value-stream-card-body');
  if (body) {
    bg = getComputedStyle(body).backgroundColor;
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
  }
  return '#0f172a';
}

function buildValueStreamPngFilename() {
  let st;
  try {
    st = getAppState();
  } catch (_) {
    st = null;
  }
  const item = st?.currentProblemDetailItem;
  const raw = String(item?.customerName || item?.customer_name || item?.archiveNo || '')
    .trim()
    .replace(/[/\\?%*:|"<>']/g, '_')
    .slice(0, 48);
  const base = raw || '价值流图';
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${base}_${stamp}.png`;
}

/**
 * 将当前工作区价值流图导出为 PNG（临时切换到 view Tab 以包含完整横向内容）。
 * @param {HTMLElement} card
 */
async function downloadValueStreamGraphAsPng(card) {
  const viewPanel = card.querySelector('.problem-detail-value-stream-panel[data-panel="view"]');
  if (!viewPanel) return;
  const captureEl = viewPanel.querySelector('.vs-graph-scroll') || viewPanel;
  const panels = card.querySelectorAll('.problem-detail-value-stream-panel');
  const tabs = card.querySelectorAll('.problem-detail-value-stream-tab');
  const activeTab = card.querySelector('.problem-detail-value-stream-tab-active');
  const activeName = activeTab?.getAttribute('data-tab') || 'view';
  const prevHidden = [...panels].map((p) => p.hidden);
  panels.forEach((p) => {
    p.hidden = p.getAttribute('data-panel') !== 'view';
  });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let dataUrl = null;
  try {
    const { toPng } = await import(HTML_TO_IMAGE_MODULE_URL);
    const w = Math.max(captureEl.scrollWidth, captureEl.clientWidth || 0);
    const h = Math.max(captureEl.scrollHeight, captureEl.clientHeight || 0);
    dataUrl = await toPng(captureEl, {
      cacheBust: true,
      pixelRatio: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
      backgroundColor: resolveValueStreamPngBackground(viewPanel, card),
      ...(w > 0 && h > 0 ? { width: w, height: h } : {}),
    });
  } catch (err) {
    console.warn('[value-stream] PNG export failed', err);
    alert('导出图片失败，请检查网络（需加载 html-to-image 库）或稍后重试。');
  } finally {
    panels.forEach((p, i) => {
      p.hidden = prevHidden[i];
    });
    tabs.forEach((t) => {
      t.classList.toggle('problem-detail-value-stream-tab-active', t.getAttribute('data-tab') === activeName);
    });
  }
  if (!dataUrl) return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = buildValueStreamPngFilename();
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * 导出前临时展开所有事务节点卡正文，返回恢复函数。
 * @param {HTMLElement} root
 * @returns {() => void}
 */
function expandAllE2eBpmTxNodesForCapture(root) {
  if (!root) return () => {};
  const cards = root.querySelectorAll('.e2e-bpm-tx-node-card');
  const undos = [];
  cards.forEach((card) => {
    const body = card.querySelector('.e2e-bpm-tx-node-body');
    const btn = card.querySelector('.e2e-bpm-tx-node-collapse-btn');
    const wasCollapsed = card.classList.contains('e2e-bpm-tx-node-card--collapsed');
    const bodyWasHidden = !!(body && body.hidden);
    undos.push(() => {
      card.classList.toggle('e2e-bpm-tx-node-card--collapsed', wasCollapsed);
      if (body) body.hidden = bodyWasHidden;
      if (btn) {
        btn.setAttribute('aria-expanded', wasCollapsed ? 'false' : 'true');
        const icon = btn.querySelector('.e2e-bpm-tx-node-collapse-icon');
        if (icon) icon.classList.toggle('e2e-bpm-tx-node-collapse-icon--open', !wasCollapsed);
      }
    });
    card.classList.remove('e2e-bpm-tx-node-card--collapsed');
    if (body) body.hidden = false;
    if (btn) {
      btn.setAttribute('aria-expanded', 'true');
      const icon = btn.querySelector('.e2e-bpm-tx-node-collapse-icon');
      if (icon) icon.classList.add('e2e-bpm-tx-node-collapse-icon--open');
    }
  });
  return () => {
    for (let i = undos.length - 1; i >= 0; i -= 1) undos[i]();
  };
}

function resolveE2eFlowPngBackground(wrap, card) {
  if (!wrap) return '#0f172a';
  let bg = getComputedStyle(wrap).backgroundColor;
  if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
  const body = card?.querySelector?.('.problem-detail-card-body');
  if (body) {
    bg = getComputedStyle(body).backgroundColor;
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
  }
  return '#0f172a';
}

function buildE2eTransactionFlowPngFilename() {
  let st;
  try {
    st = getAppState();
  } catch (_) {
    st = null;
  }
  const item = st?.currentProblemDetailItem;
  const raw = String(item?.customerName || item?.customer_name || item?.archiveNo || '')
    .trim()
    .replace(/[/\\?%*:|"<>']/g, '_')
    .slice(0, 40);
  const base = raw ? `${raw}_端到端事务流` : '端到端事务流';
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${base}_${stamp}.png`;
}

/** 工作区「下载 json」文件名前缀：与导出包口径一致，优先 `archiveNo`（案例编号） */
function buildCaseArchivePrefixForWorkspaceJsonDownload() {
  let st;
  try {
    st = getAppState();
  } catch (_) {
    st = null;
  }
  const item = st?.currentProblemDetailItem;
  const n = item?.archiveNo;
  const raw = n != null && String(n).trim() !== '' ? String(n).trim() : '';
  return raw.replace(/[/\\?%*:|"<>']/g, '_').slice(0, 48) || '未编号';
}

/**
 * @param {'value-stream' | 'e2e-flow' | 'it-design-supplement'} kind
 */
function buildWorkspaceJsonDownloadFilename(kind) {
  const prefix = buildCaseArchivePrefixForWorkspaceJsonDownload();
  const map = {
    'value-stream': '价值流图json',
    'e2e-flow': '端到端事务流json',
    'it-design-supplement': 'IT设计补齐json',
  };
  const mid = map[kind] || '数据json';
  return `${prefix}_${mid}.json`;
}

/**
 * @param {string} rawText
 * @returns {string|null} 可写入 .json 文件的 UTF-8 正文；无效时 null
 */
function prettifyWorkspaceJsonDownloadText(rawText) {
  const t = rawText == null ? '' : String(rawText).trim();
  if (!t) return null;
  try {
    return `${JSON.stringify(JSON.parse(t), null, 2)}\n`;
  } catch (_) {
    if (t.startsWith('{') || t.startsWith('[')) return `${t}\n`;
    return null;
  }
}

/**
 * @param {string} text
 * @param {'value-stream' | 'e2e-flow' | 'it-design-supplement'} kind
 */
function downloadProblemDetailWorkspaceJsonFile(text, kind) {
  const pretty = prettifyWorkspaceJsonDownloadText(text);
  if (pretty == null) {
    alert('暂无可下载的有效 JSON，请先在工作区生成对应内容。');
    return;
  }
  const filename = buildWorkspaceJsonDownloadFilename(kind);
  const blob = new Blob([pretty], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * @param {HTMLButtonElement | null} btn
 * @param {'value-stream' | 'e2e-flow' | 'it-design-supplement'} kind
 * @param {() => string} getRawJsonText
 */
function bindProblemDetailWorkspaceJsonDownloadButton(btn, kind, getRawJsonText) {
  if (!btn || btn.dataset.feWorkspaceJsonDlBound === '1') return;
  btn.dataset.feWorkspaceJsonDlBound = '1';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadProblemDetailWorkspaceJsonFile(getRawJsonText(), kind);
  });
}

/**
 * 将当前工作区端到端事务流 view 导出为 PNG（与全屏模式同宽高的布局：必要时临时全屏；view Tab + 展开全部节点卡）。
 * @param {HTMLElement} card
 */
async function downloadE2eTransactionFlowViewAsPng(card) {
  const bodyDetail = card.querySelector('.problem-detail-card-body-detail');
  const bodyFullJson = card.querySelector('.problem-detail-card-body-e2e-full-json');
  const captureEl = card.querySelector('.problem-detail-it-gap-e2e-wrap');
  if (!captureEl) return;
  const tabs = card.querySelectorAll('.problem-detail-card-tab');
  const wasJsonVisible = !!(bodyFullJson && !bodyFullJson.hidden);
  if (bodyDetail) bodyDetail.hidden = false;
  if (bodyFullJson) bodyFullJson.hidden = true;
  tabs.forEach((t) => {
    const v = t.getAttribute('data-tab') === 'view';
    t.classList.toggle('problem-detail-card-tab-active', v);
    t.setAttribute('aria-pressed', v ? 'true' : 'false');
  });

  const wasAlreadyFs = e2eFlowCardIsFullscreen(card);
  let enteredFsForExport = false;
  if (!wasAlreadyFs) {
    try {
      await valueStreamRequestFullscreen(card);
      if (e2eFlowCardIsFullscreen(card)) {
        enteredFsForExport = true;
        syncE2eFlowFullscreenButtonState();
      }
    } catch (err) {
      console.warn('[e2e-flow] enter fullscreen for PNG export failed, using embedded layout', err);
    }
  }

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (enteredFsForExport) {
    await new Promise((r) => setTimeout(r, 50));
  }

  const restoreCollapse = expandAllE2eBpmTxNodesForCapture(captureEl);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let dataUrl = null;
  try {
    const { toPng } = await import(HTML_TO_IMAGE_MODULE_URL);
    const w = Math.max(captureEl.scrollWidth, captureEl.clientWidth || 0);
    const h = Math.max(captureEl.scrollHeight, captureEl.clientHeight || 0);
    dataUrl = await toPng(captureEl, {
      cacheBust: true,
      pixelRatio: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
      backgroundColor: resolveE2eFlowPngBackground(captureEl, card),
      ...(w > 0 && h > 0 ? { width: w, height: h } : {}),
    });
  } catch (err) {
    console.warn('[e2e-flow] PNG export failed', err);
    alert('导出图片失败，请检查网络（需加载 html-to-image 库）或稍后重试。');
  } finally {
    restoreCollapse();
    if (enteredFsForExport) {
      try {
        await valueStreamExitFullscreen();
      } catch (_) {}
      syncE2eFlowFullscreenButtonState();
    }
    if (wasJsonVisible) {
      if (bodyDetail) bodyDetail.hidden = true;
      if (bodyFullJson) bodyFullJson.hidden = false;
      tabs.forEach((t) => {
        const j = t.getAttribute('data-tab') === 'json';
        t.classList.toggle('problem-detail-card-tab-active', j);
        t.setAttribute('aria-pressed', j ? 'true' : 'false');
      });
    } else {
      if (bodyDetail) bodyDetail.hidden = false;
      if (bodyFullJson) bodyFullJson.hidden = true;
      tabs.forEach((t) => {
        const v = t.getAttribute('data-tab') === 'view';
        t.classList.toggle('problem-detail-card-tab-active', v);
        t.setAttribute('aria-pressed', v ? 'true' : 'false');
      });
    }
  }
  if (!dataUrl) return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = buildE2eTransactionFlowPngFilename();
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function bmcWorkspaceCardIsFullscreen(card) {
  if (!card) return false;
  return document.fullscreenElement === card || document.webkitFullscreenElement === card;
}

/** 同步商业模式画布 BMC 卡全屏按钮（整块 `.problem-detail-card-bmc`） */
function syncBmcFullscreenButtonState() {
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  document.querySelectorAll('.problem-detail-card-bmc').forEach((card) => {
    const btn = card.querySelector('.problem-detail-bmc-fs-btn');
    if (!btn) return;
    const on = fsEl === card;
    btn.classList.toggle('problem-detail-e2e-flow-fs-btn--exit', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? '退出全屏' : '全屏显示商业模式画布');
    btn.title = on ? '退出全屏' : '全屏显示商业模式画布';
  });
}

function resolveBmcPngBackground(captureEl, card) {
  if (!captureEl) return '#0f172a';
  let bg = getComputedStyle(captureEl).backgroundColor;
  if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
  const bd = card?.querySelector?.('.problem-detail-card-body-detail');
  if (bd) {
    bg = getComputedStyle(bd).backgroundColor;
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
  }
  return '#0f172a';
}

function buildBmcPngFilename() {
  let st;
  try {
    st = getAppState();
  } catch (_) {
    st = null;
  }
  const item = st?.currentProblemDetailItem;
  const raw = String(item?.customerName || item?.customer_name || item?.archiveNo || '')
    .trim()
    .replace(/[/\\?%*:|"<>']/g, '_')
    .slice(0, 40);
  const base = raw ? `${raw}_商业模式画布BMC` : '商业模式画布BMC';
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${base}_${stamp}.png`;
}

/**
 * 将当前工作区 BMC view 导出为 PNG（先切 view Tab，截取 `.problem-detail-bmc-capture-root`）。
 * @param {HTMLElement} card
 */
async function downloadBmcWorkspaceAsPng(card) {
  const bodyDetail = card.querySelector('.problem-detail-card-body-detail');
  const bodyJson = card.querySelector('.problem-detail-card-body-json');
  const captureEl = card.querySelector('.problem-detail-bmc-capture-root');
  if (!captureEl) return;
  const tabs = card.querySelectorAll('.problem-detail-card-tab');
  const wasJsonVisible = !!(bodyJson && !bodyJson.hidden);
  if (bodyDetail) bodyDetail.hidden = false;
  if (bodyJson) bodyJson.hidden = true;
  tabs.forEach((t) => {
    const d = t.getAttribute('data-tab') === 'detail';
    t.classList.toggle('problem-detail-card-tab-active', d);
    t.setAttribute('aria-pressed', d ? 'true' : 'false');
  });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let dataUrl = null;
  try {
    const { toPng } = await import(HTML_TO_IMAGE_MODULE_URL);
    const w = Math.max(captureEl.scrollWidth, captureEl.clientWidth || 0);
    const h = Math.max(captureEl.scrollHeight, captureEl.clientHeight || 0);
    dataUrl = await toPng(captureEl, {
      cacheBust: true,
      pixelRatio: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
      backgroundColor: resolveBmcPngBackground(captureEl, card),
      ...(w > 0 && h > 0 ? { width: w, height: h } : {}),
    });
  } catch (err) {
    console.warn('[bmc] PNG export failed', err);
    alert('导出图片失败，请检查网络（需加载 html-to-image 库）或稍后重试。');
  } finally {
    if (wasJsonVisible) {
      if (bodyDetail) bodyDetail.hidden = true;
      if (bodyJson) bodyJson.hidden = false;
      tabs.forEach((t) => {
        const j = t.getAttribute('data-tab') === 'json';
        t.classList.toggle('problem-detail-card-tab-active', j);
        t.setAttribute('aria-pressed', j ? 'true' : 'false');
      });
    } else {
      if (bodyDetail) bodyDetail.hidden = false;
      if (bodyJson) bodyJson.hidden = true;
      tabs.forEach((t) => {
        const d = t.getAttribute('data-tab') === 'detail';
        t.classList.toggle('problem-detail-card-tab-active', d);
        t.setAttribute('aria-pressed', d ? 'true' : 'false');
      });
    }
  }
  if (!dataUrl) return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = buildBmcPngFilename();
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** task2 工作区：商业模式画布卡 下载图 / 全屏 */
function setupProblemDetailBmcWorkspace(container) {
  if (!container) return;
  const cards = container.querySelectorAll('.problem-detail-card-bmc');
  if (!cards.length) return;
  ensureWorkspaceFullscreenDocListener();
  cards.forEach((card) => {
    const dlBtn = card.querySelector('.problem-detail-bmc-download-btn');
    if (dlBtn && dlBtn.dataset.feBmcDlBound !== '1') {
      dlBtn.dataset.feBmcDlBound = '1';
      dlBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (dlBtn.disabled) return;
        const prev = dlBtn.textContent;
        dlBtn.disabled = true;
        dlBtn.textContent = '导出中…';
        try {
          await downloadBmcWorkspaceAsPng(card);
        } catch (_) {
          /* downloadBmcWorkspaceAsPng 已提示 */
        } finally {
          dlBtn.disabled = false;
          dlBtn.textContent = prev;
        }
      });
    }
    const fsBtn = card.querySelector('.problem-detail-bmc-fs-btn');
    if (fsBtn && fsBtn.dataset.feBmcFsBound !== '1') {
      fsBtn.dataset.feBmcFsBound = '1';
      fsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (bmcWorkspaceCardIsFullscreen(card)) {
          valueStreamExitFullscreen().catch(() => {});
        } else {
          valueStreamRequestFullscreen(card).catch(() => {});
        }
      });
    }
  });
  syncBmcFullscreenButtonState();
}

function setupProblemDetailValueStreamTabs(container) {
  const card = container?.querySelector('.problem-detail-value-stream-card');
  if (!card) return;
  ensureWorkspaceFullscreenDocListener();
  const dlBtn = card.querySelector('.problem-detail-value-stream-download-btn');
  if (dlBtn && dlBtn.dataset.feVsDlBound !== '1') {
    dlBtn.dataset.feVsDlBound = '1';
    dlBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (dlBtn.disabled) return;
      const prev = dlBtn.textContent;
      dlBtn.disabled = true;
      dlBtn.textContent = '导出中…';
      try {
        await downloadValueStreamGraphAsPng(card);
      } catch (_) {
        /* downloadValueStreamGraphAsPng 已提示 */
      } finally {
        dlBtn.disabled = false;
        dlBtn.textContent = prev;
      }
    });
  }
  bindProblemDetailWorkspaceJsonDownloadButton(
    card.querySelector('.problem-detail-workspace-json-download-btn[data-workspace-json-kind="value-stream"]'),
    'value-stream',
    () => card.querySelector('.problem-detail-value-stream-panel[data-panel="json"] pre')?.textContent ?? '',
  );
  const fsBtn = card.querySelector('.problem-detail-value-stream-fs-btn');
  if (fsBtn && fsBtn.dataset.feVsFsBound !== '1') {
    fsBtn.dataset.feVsFsBound = '1';
    fsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (valueStreamCardIsFullscreen(card)) {
        valueStreamExitFullscreen().catch(() => {});
      } else {
        valueStreamRequestFullscreen(card).catch(() => {});
      }
    });
  }
  syncValueStreamFullscreenButtonState();
  const tabs = card.querySelectorAll('.problem-detail-value-stream-tab');
  const panels = card.querySelectorAll('.problem-detail-value-stream-panel');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      tabs.forEach((t) => t.classList.toggle('problem-detail-value-stream-tab-active', t.getAttribute('data-tab') === tabName));
      panels.forEach((p) => { p.hidden = p.getAttribute('data-panel') !== tabName; });
    });
  });
}

/** ITGap 工作区：IT设计补齐 卡标题栏全屏（整块 `.problem-detail-card-it-design-supplement`） */
function setupProblemDetailItDesignSupplementFullscreen(container) {
  const card = container?.querySelector('.problem-detail-card-it-design-supplement');
  if (!card) return;
  ensureWorkspaceFullscreenDocListener();
  bindProblemDetailWorkspaceJsonDownloadButton(
    card.querySelector('.problem-detail-workspace-json-download-btn[data-workspace-json-kind="it-design-supplement"]'),
    card,
    'it-design-supplement',
    () => card.querySelector('.problem-detail-card-body-global-itgap-full-json pre')?.textContent ?? '',
  );
  const fsBtn = card.querySelector('.problem-detail-it-design-supplement-fs-btn');
  if (fsBtn && fsBtn.dataset.feItDesignFsBound !== '1') {
    fsBtn.dataset.feItDesignFsBound = '1';
    fsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (itDesignSupplementCardIsFullscreen(card)) {
        valueStreamExitFullscreen().catch(() => {});
      } else {
        valueStreamRequestFullscreen(card).catch(() => {});
      }
    });
  }
  syncItDesignSupplementFullscreenButtonState();
}

/** task1 工作区：初步需求卡标题栏全屏（整块 `.problem-detail-card-preliminary-tabs`） */
function setupProblemDetailPreliminaryFullscreen(container) {
  const card = container?.querySelector('.problem-detail-card-preliminary-tabs');
  if (!card) return;
  ensureWorkspaceFullscreenDocListener();
  const fsBtn = card.querySelector('.problem-detail-card-preliminary-fs-btn');
  if (fsBtn && fsBtn.dataset.fePrelimWorkspaceFsBound !== '1') {
    fsBtn.dataset.fePrelimWorkspaceFsBound = '1';
    fsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (preliminaryWorkspaceCardIsFullscreen(card)) {
        valueStreamExitFullscreen().catch(() => {});
      } else {
        valueStreamRequestFullscreen(card).catch(() => {});
      }
    });
  }
  syncPreliminaryWorkspaceCardFullscreenButtonState();
}

/** ITGap 工作区：端到端事务流卡（可多张：主事务流 + 需求场景补齐）下载图 / 下载 json / 全屏 */
function setupProblemDetailE2eFlowFullscreen(container) {
  if (!container) return;
  const cards = container.querySelectorAll('.problem-detail-card-e2e-flow');
  if (!cards.length) return;
  ensureWorkspaceFullscreenDocListener();
  cards.forEach((card) => {
    const dlBtn = card.querySelector('.problem-detail-e2e-flow-download-btn');
    if (dlBtn && dlBtn.dataset.feE2eDlBound !== '1') {
      dlBtn.dataset.feE2eDlBound = '1';
      dlBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (dlBtn.disabled) return;
        const prev = dlBtn.textContent;
        dlBtn.disabled = true;
        dlBtn.textContent = '导出中…';
        try {
          await downloadE2eTransactionFlowViewAsPng(card);
        } catch (_) {
          /* downloadE2eTransactionFlowViewAsPng 已提示 */
        } finally {
          dlBtn.disabled = false;
          dlBtn.textContent = prev;
        }
      });
    }
    bindProblemDetailWorkspaceJsonDownloadButton(
      card.querySelector('.problem-detail-workspace-json-download-btn[data-workspace-json-kind="e2e-flow"]'),
      'e2e-flow',
      () => card.querySelector('.problem-detail-card-body-e2e-full-json pre')?.textContent ?? '',
    );
    const fsBtn = card.querySelector('.problem-detail-e2e-flow-fs-btn');
    if (fsBtn && fsBtn.dataset.feE2eFsBound !== '1') {
      fsBtn.dataset.feE2eFsBound = '1';
      fsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e2eFlowCardIsFullscreen(card)) {
          valueStreamExitFullscreen().catch(() => {});
        } else {
          valueStreamRequestFullscreen(card).catch(() => {});
        }
      });
    }
  });
  syncE2eFlowFullscreenButtonState();
}

const E2E_BPM_PREVIEW_DRAWER_ID = 'e2e-bpm-preview-drawer';

/** @type {HTMLElement | null} */
let _e2eBpmPreviewDrawerEl = null;
/** @type {(() => void) | null} */
let _e2eBpmPreviewDocKeydown = null;
/** @type {Element | null} */
let _e2eBpmPreviewFocusRestore = null;

function decodeE2eBpmTxFromPreviewButton(btn) {
  const raw = btn?.getAttribute?.('data-tx-b64');
  if (!raw || typeof raw !== 'string') return null;
  try {
    const json = decodeURIComponent(escape(atob(raw)));
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function ensureE2eBpmPreviewDrawer() {
  if (_e2eBpmPreviewDrawerEl && document.body.contains(_e2eBpmPreviewDrawerEl)) return _e2eBpmPreviewDrawerEl;
  const root = document.createElement('div');
  root.id = E2E_BPM_PREVIEW_DRAWER_ID;
  root.className = 'e2e-bpm-preview-drawer';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="e2e-bpm-preview-drawer-backdrop" data-e2e-bpm-preview-close="1" aria-hidden="true"></div>
    <div class="e2e-bpm-preview-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="e2e-bpm-preview-drawer-title">
      <header class="e2e-bpm-preview-drawer-header">
        <h2 id="e2e-bpm-preview-drawer-title" class="e2e-bpm-preview-drawer-title">事务流程图预览</h2>
        <button type="button" class="e2e-bpm-preview-drawer-close" data-e2e-bpm-preview-close="1" aria-label="关闭预览">×</button>
      </header>
      <div class="e2e-bpm-preview-drawer-subtitle" id="e2e-bpm-preview-drawer-subtitle"></div>
      <div class="e2e-bpm-preview-drawer-body"></div>
    </div>`;
  document.body.appendChild(root);
  _e2eBpmPreviewDrawerEl = root;

  root.addEventListener('click', (e) => {
    if (e.target?.closest?.('[data-e2e-bpm-preview-close]')) closeE2eBpmPreviewDrawer();
  });

  if (!_e2eBpmPreviewDocKeydown) {
    _e2eBpmPreviewDocKeydown = (e) => {
      if (e.key !== 'Escape') return;
      if (!root.classList.contains('e2e-bpm-preview-drawer--open')) return;
      closeE2eBpmPreviewDrawer();
    };
    document.addEventListener('keydown', _e2eBpmPreviewDocKeydown);
  }
  return root;
}

/** @type {ResizeObserver | null} */
let _e2eBpmPreviewWireRo = null;

function closeE2eBpmPreviewDrawer() {
  const root = _e2eBpmPreviewDrawerEl || document.getElementById(E2E_BPM_PREVIEW_DRAWER_ID);
  if (!root) return;
  if (_e2eBpmPreviewWireRo) {
    try {
      _e2eBpmPreviewWireRo.disconnect();
    } catch (_) {}
    _e2eBpmPreviewWireRo = null;
  }
  root.classList.remove('e2e-bpm-preview-drawer--open');
  root.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('e2e-bpm-preview-drawer-open');
  if (_e2eBpmPreviewFocusRestore && typeof _e2eBpmPreviewFocusRestore.focus === 'function') {
    try {
      _e2eBpmPreviewFocusRestore.focus({ preventScroll: true });
    } catch (_) {
      _e2eBpmPreviewFocusRestore.focus();
    }
  }
  _e2eBpmPreviewFocusRestore = null;
}

function openE2eBpmPreviewDrawer(tx) {
  const root = ensureE2eBpmPreviewDrawer();
  const subtitle = root.querySelector('#e2e-bpm-preview-drawer-subtitle');
  const body = root.querySelector('.e2e-bpm-preview-drawer-body');
  const build =
    typeof globalThis.buildE2eBpmTransactionFlowPreviewDiagramHTML === 'function'
      ? globalThis.buildE2eBpmTransactionFlowPreviewDiagramHTML
      : null;
  const idRaw = tx?.transaction_id;
  const nameRaw = tx?.name ?? tx?.transaction_name;
  const idStr = idRaw != null && String(idRaw).trim() ? String(idRaw).trim() : '—';
  const nameStr = nameRaw != null && String(nameRaw).trim() ? String(nameRaw).trim() : '—';
  if (subtitle) {
    subtitle.textContent = `${idStr}｜${nameStr}`;
    subtitle.hidden = idStr === '—' && nameStr === '—';
  }
  if (body) {
    body.innerHTML = build ? build(tx) : '<p class="e2e-bpm-preview-empty">预览组件未加载</p>';
  }
  _e2eBpmPreviewFocusRestore = document.activeElement;
  root.classList.add('e2e-bpm-preview-drawer--open');
  root.setAttribute('aria-hidden', 'false');
  document.body.classList.add('e2e-bpm-preview-drawer-open');
  if (body && typeof globalThis.syncE2eBpmPreviewDiagramWires === 'function') {
    const runWires = () => globalThis.syncE2eBpmPreviewDiagramWires(body);
    requestAnimationFrame(() => {
      requestAnimationFrame(runWires);
    });
    if (_e2eBpmPreviewWireRo) {
      try {
        _e2eBpmPreviewWireRo.disconnect();
      } catch (_) {}
      _e2eBpmPreviewWireRo = null;
    }
    if (typeof ResizeObserver !== 'undefined') {
      _e2eBpmPreviewWireRo = new ResizeObserver(() => {
        requestAnimationFrame(runWires);
      });
      _e2eBpmPreviewWireRo.observe(body);
    }
  }
  requestAnimationFrame(() => {
    const closeBtn = root.querySelector('.e2e-bpm-preview-drawer-close');
    if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
  });
}

/** ITGap 工作区：事务流节点卡折叠 +「成图预览」→ 右侧抽屉（委托在 container 上，仅绑定一次） */
function setupProblemDetailE2eBpmTxPreview(container) {
  if (!container || container.dataset?.feE2eBpmTxPreviewBound === '1') return;
  container.dataset.feE2eBpmTxPreviewBound = '1';
  container.addEventListener('click', (e) => {
    const collapseBtn = e.target?.closest?.('.e2e-bpm-tx-node-collapse-btn');
    if (collapseBtn && container.contains(collapseBtn)) {
      e.preventDefault();
      e.stopPropagation();
      const card = collapseBtn.closest('.e2e-bpm-tx-node-card');
      const bodyId = collapseBtn.getAttribute('aria-controls');
      let body = null;
      if (bodyId && card) {
        try {
          body = card.querySelector(`#${CSS.escape(bodyId)}`);
        } catch (_) {
          body = null;
        }
      }
      if (!body && card) body = card.querySelector('.e2e-bpm-tx-node-body');
      const expanded = collapseBtn.getAttribute('aria-expanded') === 'true';
      const next = !expanded;
      collapseBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
      if (body) body.hidden = !next;
      if (card) card.classList.toggle('e2e-bpm-tx-node-card--collapsed', !next);
      const icon = collapseBtn.querySelector('.e2e-bpm-tx-node-collapse-icon');
      if (icon) icon.classList.toggle('e2e-bpm-tx-node-collapse-icon--open', next);
      return;
    }
    const btn = e.target?.closest?.('.e2e-bpm-tx-preview-btn');
    if (!btn || !container.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    const tx = decodeE2eBpmTxFromPreviewButton(btn);
    if (!tx) return;
    openE2eBpmPreviewDrawer(tx);
  });
}

function setupProblemDetailJsonBlockToggle(jsonBlock) {
  const wrap = jsonBlock?.querySelector('.problem-detail-chat-json-wrap');
  if (!wrap) return;
  wrap.addEventListener('click', () => {
    jsonBlock.classList.toggle('problem-detail-chat-json-expanded');
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      jsonBlock.classList.toggle('problem-detail-chat-json-expanded');
    }
  });
}

/** 将聊天区滚动到指定任务的任务启动通知块 */
function scrollChatToTaskStartNotification(taskId) {
  const deps = requireDeps();
  const container = deps.el?.problemDetailChatMessages;
  if (!container || !taskId) return;
  const block = container.querySelector(`.problem-detail-chat-task-start-notification button[data-task-id="${taskId}"]`);
  if (!block) return;
  const msg = block.closest('.problem-detail-chat-msg');
  if (msg) {
    msg.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

globalThis.SmartCto = globalThis.SmartCto || {};
globalThis.SmartCto.problemDetailChat = {
  init: initProblemDetailChat,
  appendMessage: appendProblemDetailChatMessage,
  pushAndSave: pushAndSaveProblemDetailChat,
  isDuplicateProcessLogLlmMessage,
  setupChatTextToggle: setupProblemDetailChatTextToggle,
  setupChatCardToggle: setupProblemDetailChatCardToggle,
  setupBmcCardToggle: setupProblemDetailBmcCardToggle,
  setupValueStreamTabs: setupProblemDetailValueStreamTabs,
  setupE2eFlowFullscreen: setupProblemDetailE2eFlowFullscreen,
  setupProblemDetailBmcWorkspace,
  setupProblemDetailPreliminaryFullscreen,
  setupItDesignSupplementFullscreen: setupProblemDetailItDesignSupplementFullscreen,
  setupE2eBpmTxPreview: setupProblemDetailE2eBpmTxPreview,
  setupJsonBlockToggle: setupProblemDetailJsonBlockToggle,
  ensureWorkspaceFullscreenDocListener,
  scrollToTaskStart: scrollChatToTaskStartNotification,
  getStorageKey: getProblemDetailChatStorageKey,
};
