/** 常量与任务定义已移至 js/config.js */

// [bridge] → core/problem-follow-shared.js（首页案例键 / session 高亮；Vue 首页消费见 frontend-vue/src/home/problem-follow-home.ts）
const {
  getProblemFollowCaseKey,
  getProblemFollowHighlightedCaseKey,
  setProblemFollowHighlightedCaseKey,
} = globalThis.SmartCto.problemFollowShared;

/** FOLLOW_TASKS、DELETE_CHAT_MSG_ICON、DEEPSEEK 配置、fetchDeepSeekChat、buildLlmMetaHtml 已移至 js/config.js 与 js/api.js */

/** 任务5 IT 现状标注入口由 js/task5ItStatus.js 提供 */
const runItStatusAnnotation = (typeof window !== 'undefined' && window.runItStatusAnnotation) || (async function () {});
const generateItStatusSessions = (typeof window !== 'undefined' && window.generateItStatusSessions) || (function () { return []; });
const runItStatusAnnotationAutoSequential =
  (typeof window !== 'undefined' && window.runItStatusAnnotationAutoSequential) || (async function () {});
const runItStatusAnnotationForNextStep =
  (typeof window !== 'undefined' && window.runItStatusAnnotationForNextStep) || (async function () { return null; });
const applyItStatusStepConfirm =
  (typeof window !== 'undefined' && window.applyItStatusStepConfirm) || (function () { return false; });
const runPainPointAnnotation = (typeof window !== 'undefined' && window.runPainPointAnnotation) || (async function () {});
const runPainPointAnnotationForNextStep = (typeof window !== 'undefined' && window.runPainPointAnnotationForNextStep) || (async function () { return null; });
const applyPainPointStepConfirm = (typeof window !== 'undefined' && window.applyPainPointStepConfirm) || (function () { return false; });
const runPainPointAnnotationAutoSequential = (typeof window !== 'undefined' && window.runPainPointAnnotationAutoSequential) || (async function () {});
const generatePainPointSessions = (typeof window !== 'undefined' && window.generatePainPointSessions) || (function () { return []; });

/**
 * 为 true：问题详情「对话」区不渲染、不写 CBO 交互消息（session 计划、环节卡、全部确认、审计、修改再生成通知等）；`coreBusinessObject.js` 内 `executeCoreBusinessObjectTaskOnConfirm` 同步跳过推送。
 * 设为 false 可恢复历史聊天区交互（需与产品策略一致）。
 */
globalThis.__FE_SUPPRESS_CBO_PROBLEM_DETAIL_CHAT_UI = true;

function isProblemDetailChatCboUiSuppressed() {
  return globalThis.__FE_SUPPRESS_CBO_PROBLEM_DETAIL_CHAT_UI === true;
}

/** 当前详情页的公司名称，用于对话上下文 */
let currentDetailCompanyName = '';

/** 当前详情页完整记录，用于大模型分析页面结构及应用修改 */
let currentDetailRecord = null;

// [bridge] → legacy/app-dom.js (Phase 2A)
const el = globalThis.SmartCto.appDom.el;

// [bridge] → core/problem-detail-chat.js (Phase 3A)
const problemDetailChatBridge = globalThis.SmartCto.problemDetailChat;
if (!problemDetailChatBridge) {
  console.warn('[main.js] problemDetailChat module not loaded yet. Falling back to original implementation.');
}
if (typeof window !== 'undefined') window.el = el;

function ensureProblemDetailCriticalButtonBindings() {
  if (el.btnProblemDetailRestartTask && el.btnProblemDetailRestartTask.dataset.feDirectRestartBound !== '1') {
    el.btnProblemDetailRestartTask.dataset.feDirectRestartBound = '1';
    el.btnProblemDetailRestartTask.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      applyRestartCurrentTask();
    });
  }
}

ensureProblemDetailCriticalButtonBindings();

let lastQueriedCompanyName = '';
let lastQueryResult = null;

const TASK1_INITIAL_LLM_QUERY_STORAGE_KEY = 'task1InitialLlmQueryByCaseKey';

/** task1 补充需求：点击「补充更多需求」与刷新恢复时统一下发的引导文案 */
const TASK1_PRELIM_SUPPLEMENT_CONTINUE_PROMPT =
  '请继续补充客户需求，我将基于您的补充进一步提炼并合并到当前初步需求。';

/** task1 跟进卡「对补充内容修改」：聊天区引导，下一条用户消息走 `runTask1PreliminarySupplementModifyWithFeedback`（勿用浏览器 prompt） */
const TASK1_PRELIM_SUPPLEMENT_MODIFY_PROMPT =
  '请在下方输入框发送您对当前初步需求（含已合并的补充）的修改意见。系统将据此生成修订版 JSON，并在本聊天区展示修改摘要；您点击「确认更新工作区」后才会写入 view/json。';

function getTask1InitialLlmQueryMap() {
  try {
    const raw = localStorage.getItem(TASK1_INITIAL_LLM_QUERY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function saveTask1InitialLlmQueryMap(map) {
  try {
    localStorage.setItem(TASK1_INITIAL_LLM_QUERY_STORAGE_KEY, JSON.stringify(map && typeof map === 'object' ? map : {}));
  } catch (_) {}
}

function persistTask1InitialLlmQueryForItem(item, query) {
  if (!item || !query) return;
  const map = getTask1InitialLlmQueryMap();
  const keys = [];
  const caseKey = getProblemFollowCaseKey(item);
  if (caseKey) keys.push(caseKey);
  if (item.createdAt) keys.push(String(item.createdAt));
  if (item.id) keys.push(String(item.id));
  keys.forEach((k) => { if (k) map[k] = { ...query }; });
  saveTask1InitialLlmQueryMap(map);
  logTask1PrelimLlm('persist-query', {
    keys,
    hasInputPrompt: !!(query.llmInputPrompt && String(query.llmInputPrompt).trim()),
    inputPromptLen: query.llmInputPrompt ? String(query.llmInputPrompt).length : 0,
    hasOutputRaw: !!(query.llmOutputRaw && String(query.llmOutputRaw).trim()),
    outputRawLen: query.llmOutputRaw ? String(query.llmOutputRaw).length : 0,
  });
}

/** 「重启当前」task1 等场景：清除 local 映射，避免工作区仍读首页解析的 LLM 快照 */
function clearTask1InitialLlmQueryPersistedForItem(item) {
  if (!item) return;
  const map = getTask1InitialLlmQueryMap();
  const keys = [];
  const caseKey = getProblemFollowCaseKey(item);
  if (caseKey) keys.push(caseKey);
  if (item.createdAt) keys.push(String(item.createdAt));
  if (item.id) keys.push(String(item.id));
  let changed = false;
  keys.forEach((k) => {
    if (k && Object.prototype.hasOwnProperty.call(map, k)) {
      delete map[k];
      changed = true;
    }
  });
  if (changed) saveTask1InitialLlmQueryMap(map);
}

function readTask1InitialLlmQueryForItem(item) {
  if (!item) return null;
  const map = getTask1InitialLlmQueryMap();
  const keys = [];
  const caseKey = getProblemFollowCaseKey(item);
  if (caseKey) keys.push(caseKey);
  if (item.createdAt) keys.push(String(item.createdAt));
  if (item.id) keys.push(String(item.id));
  for (const k of keys) {
    const q = map[k];
    if (q && typeof q === 'object') {
      logTask1PrelimLlm('read-persisted-query-hit', {
        key: k,
        hasInputPrompt: !!(q.llmInputPrompt && String(q.llmInputPrompt).trim()),
        inputPromptLen: q.llmInputPrompt ? String(q.llmInputPrompt).length : 0,
        hasOutputRaw: !!(q.llmOutputRaw && String(q.llmOutputRaw).trim()),
        outputRawLen: q.llmOutputRaw ? String(q.llmOutputRaw).length : 0,
      });
      return { ...q };
    }
  }
  logTask1PrelimLlm('read-persisted-query-miss', { keys });
  return null;
}

// [bridge] → core/app-state.js (Phase 1B)：详情/聊天/首页 chat 上下文状态槽位
const __appState = globalThis.SmartCto.appState.getState();

/** 当前问题详情页展示的跟进项（状态在 `SmartCto.appState`，经 __appState 引用同一对象） */
// 提供只读 getter 给其他模块（如 task4ValueStream.js）使用，避免直接依赖局部变量。
if (typeof window !== 'undefined') {
  // [bridge] → core/app-state.js (Phase 1B)
  window.getCurrentProblemDetailItem = function getCurrentProblemDetailItem() {
    return globalThis.SmartCto.appState.getCurrentProblemDetailItem();
  };
  // [bridge] → core/app-state.js (Phase 1B)
  window.setCurrentProblemDetailItem = function setCurrentProblemDetailItem(item) {
    globalThis.SmartCto.appState.setCurrentProblemDetailItem(item);
  };
}

/** 修改意图追问状态：当用户修改意图不明确时，记录需合并的用户消息起始索引，待用户补充后合并再提炼 */
let lastModificationClarification = null;

/** 当前正在浏览的大节段（可点击切换，用于回看需求理解等） */
let problemDetailViewingMajorStage = 0;

/** IT 策略规划阶段当前选中的任务索引：0=角色与权限 1=核心业务对象 2=全局架构 3=环节专项 4=链条串联 5=价值回溯 */
let itStrategyPlanViewingSubstep = 0;

/** ITGap 大阶段内当前浏览的子步骤：0=端到端事务流构建（工作区仅事务流卡）1=IT设计补齐（工作区仅 IT设计补齐 卡）2=对象状态机构建（工作区仅本任务占位卡）；顶栏 task 步骤条 viewing 与 focusWorkspaceOnCurrentTask 与此一致。确认 globalItGapStartBlock 后强制切至 1（FE-20260403-18）。 */
let itGapViewingSubstep = 0;

/** 管线 canonical 当前任务上次已对齐工作区滚动的 taskId；变化时触发 focusWorkspaceOnCurrentTask（FE-20260331-26） */
let lastCanonTaskIdForWorkspaceScroll = null;
/** 打开详情首帧：避免 render 内与 openProblemDetail 的 sessionStorage 恢复滚动打架 */
let openingProblemDetailInProgress = false;

/** 问题详情页已确认的客户基本信息（解析后点击确认） */
let problemDetailConfirmedBasicInfo = null;

/** 当前问题详情页的聊天记录（用于持久化）；状态槽位见 `SmartCto.appState` / __appState */
__appState.problemDetailChatMessages = [];
__appState.problemDetailChatMessagesCaseKey = null;
let currentProblemDetailTaskSummaries = [];
let problemDetailRemoteSyncSeq = 0;

/** 供 task5/task6 等模块获取当前聊天消息数组（main 中为 let 未挂 window，模块重绘聊天区时需用此 getter） */
if (typeof window !== 'undefined') {
  // [bridge] → core/app-state.js (Phase 1B)
  window.getProblemDetailChatMessages = function getProblemDetailChatMessages() {
    return globalThis.SmartCto.appState.getProblemDetailChatMessages();
  };
}

/** 问题详情对话模式：'agent' | 'ask'，Agent 与大模型完整联动，Ask 仅支持查询与讨论 */
let problemDetailChatMode = 'agent';

/** 聊天历史，用于 DeepSeek API 的 messages 上下文；状态槽位见 `SmartCto.appState` / __appState */
__appState.chatHistory = [];

/** 当前未闭环的修改任务：{ parsed, block }，确认或放弃后清空 */
let currentModificationTask = null;

/** 点击「修改」或「讨论」后等待用户输入反馈：{ taskId, createdAt, type: 'modification'|'discussion' }，发送后清空 */
let problemDetailWaitingForFeedback = null;

/** task6 按案例缓存「痛点标注提示词覆盖」：用于修改链确认后按新提示词重跑 session。 */
const task6PainPointPromptOverrideByCaseKey = {};
function getTask6PainPointPromptOverride(caseKey) {
  const key = caseKey == null ? '' : String(caseKey).trim();
  if (!key) return '';
  const v = task6PainPointPromptOverrideByCaseKey[key];
  return v == null ? '' : String(v);
}
function setTask6PainPointPromptOverride(caseKey, promptText) {
  const key = caseKey == null ? '' : String(caseKey).trim();
  if (!key) return;
  const v = promptText == null ? '' : String(promptText).trim();
  if (!v) delete task6PainPointPromptOverrideByCaseKey[key];
  else task6PainPointPromptOverrideByCaseKey[key] = v;
}

/** task5：修改链后的 IT 现状标注 system 提示词覆盖；「自动顺序执行」前是否须先清空 VS 上 IT 标注（修改链二次确认后置位）。 */
const task5ItStatusPromptOverrideByCaseKey = {};
const task5ModAwaitingAutoStripByCaseKey = {};
function getTask5ItStatusPromptOverride(caseKey) {
  const key = caseKey == null ? '' : String(caseKey).trim();
  if (!key) return '';
  const v = task5ItStatusPromptOverrideByCaseKey[key];
  return v == null ? '' : String(v);
}
function setTask5ItStatusPromptOverride(caseKey, promptText) {
  const key = caseKey == null ? '' : String(caseKey).trim();
  if (!key) return;
  const v = promptText == null ? '' : String(promptText).trim();
  if (!v) delete task5ItStatusPromptOverrideByCaseKey[key];
  else task5ItStatusPromptOverrideByCaseKey[key] = v;
}
function getTask5ModAwaitingAutoStrip(caseKey) {
  const key = caseKey == null ? '' : String(caseKey).trim();
  if (!key) return false;
  return !!task5ModAwaitingAutoStripByCaseKey[key];
}
function setTask5ModAwaitingAutoStrip(caseKey, val) {
  const key = caseKey == null ? '' : String(caseKey).trim();
  if (!key) return;
  if (val) task5ModAwaitingAutoStripByCaseKey[key] = true;
  else delete task5ModAwaitingAutoStripByCaseKey[key];
}

/** task4：价值流「请修改」确认新提示词后暂存；含 Mirror / 分阶段加固 两路注入正文（FE-20260407：双阶段修订） */
const task4ValueStreamModificationBundleByCaseKey = {};
function getTask4ValueStreamModificationBundle(caseKey) {
  const key = caseKey == null ? '' : String(caseKey).trim();
  if (!key) return null;
  const b = task4ValueStreamModificationBundleByCaseKey[key];
  if (!b || typeof b !== 'object') return null;
  const userPrompt = b.userPrompt != null ? String(b.userPrompt).trim() : '';
  const mirrorSystemPrompt =
    b.mirrorSystemPrompt != null
      ? String(b.mirrorSystemPrompt).trim()
      : b.systemPrompt != null
        ? String(b.systemPrompt).trim()
        : '';
  const hardeningSystemPrompt =
    b.hardeningSystemPrompt != null
      ? String(b.hardeningSystemPrompt).trim()
      : b.systemPrompt != null
        ? String(b.systemPrompt).trim()
        : '';
  if (!mirrorSystemPrompt || !hardeningSystemPrompt || !userPrompt) return null;
  const versionChangelogMirror =
    b.versionChangelogMirror != null ? String(b.versionChangelogMirror).trim() : '';
  const versionChangelogHardening =
    b.versionChangelogHardening != null ? String(b.versionChangelogHardening).trim() : '';
  const versionChangelogLegacy = b.versionChangelog != null ? String(b.versionChangelog).trim() : '';
  const versionChangelog =
    versionChangelogLegacy ||
    [versionChangelogMirror && `【第一阶段 Mirror】\n${versionChangelogMirror}`, versionChangelogHardening && `【第二阶段 分阶段加固】\n${versionChangelogHardening}`]
      .filter(Boolean)
      .join('\n\n');
  return {
    mirrorSystemPrompt,
    hardeningSystemPrompt,
    userPrompt,
    versionChangelog,
    versionChangelogMirror: versionChangelogMirror || versionChangelogLegacy,
    versionChangelogHardening: versionChangelogHardening || versionChangelogLegacy,
    /** @deprecated 兼容旧读法：等同 mirror 注入正文 */
    systemPrompt: mirrorSystemPrompt,
  };
}
/**
 * @param {string} caseKey
 * @param {string|object} systemPromptOrBundle - 旧版：单段 system；新版：对象含 mirrorSystemPrompt、hardeningSystemPrompt、userPrompt、versionChangelog*
 * @param {string} [userPrompt]
 * @param {string} [versionChangelog]
 */
function setTask4ValueStreamModificationBundle(caseKey, systemPromptOrBundle, userPrompt, versionChangelog) {
  const key = caseKey == null ? '' : String(caseKey).trim();
  if (!key) return;
  if (systemPromptOrBundle && typeof systemPromptOrBundle === 'object' && !Array.isArray(systemPromptOrBundle)) {
    const o = systemPromptOrBundle;
    const mirrorSystemPrompt = o.mirrorSystemPrompt != null ? String(o.mirrorSystemPrompt).trim() : '';
    const hardeningSystemPrompt = o.hardeningSystemPrompt != null ? String(o.hardeningSystemPrompt).trim() : '';
    const usr = o.userPrompt != null ? String(o.userPrompt).trim() : '';
    const vcm = o.versionChangelogMirror != null ? String(o.versionChangelogMirror).trim() : '';
    const vch = o.versionChangelogHardening != null ? String(o.versionChangelogHardening).trim() : '';
    if (!mirrorSystemPrompt || !hardeningSystemPrompt || !usr) {
      delete task4ValueStreamModificationBundleByCaseKey[key];
      return;
    }
    const versionChangelogJoined = [vcm && vcm !== '—' ? `【第一阶段 Mirror】\n${vcm}` : '', vch && vch !== '—' ? `【第二阶段 分阶段加固】\n${vch}` : '']
      .filter(Boolean)
      .join('\n\n');
    task4ValueStreamModificationBundleByCaseKey[key] = {
      mirrorSystemPrompt,
      hardeningSystemPrompt,
      userPrompt: usr,
      versionChangelogMirror: vcm,
      versionChangelogHardening: vch,
      versionChangelog: versionChangelogJoined,
    };
    return;
  }
  const sys = systemPromptOrBundle == null ? '' : String(systemPromptOrBundle).trim();
  const usr = userPrompt == null ? '' : String(userPrompt).trim();
  if (!sys || !usr) {
    delete task4ValueStreamModificationBundleByCaseKey[key];
    return;
  }
  const vc = versionChangelog != null ? String(versionChangelog).trim() : '';
  task4ValueStreamModificationBundleByCaseKey[key] = {
    mirrorSystemPrompt: sys,
    hardeningSystemPrompt: sys,
    userPrompt: usr,
    versionChangelogMirror: vc,
    versionChangelogHardening: vc,
    versionChangelog: vc,
  };
}
function clearTask4ValueStreamModificationBundle(caseKey) {
  const key = caseKey == null ? '' : String(caseKey).trim();
  if (!key) return;
  delete task4ValueStreamModificationBundleByCaseKey[key];
}
if (typeof window !== 'undefined') {
  window.getTask6PainPointPromptOverride = getTask6PainPointPromptOverride;
  window.getTask5ItStatusPromptOverride = getTask5ItStatusPromptOverride;
  window.setTask5ItStatusPromptOverride = setTask5ItStatusPromptOverride;
  window.getTask5ModAwaitingAutoStrip = getTask5ModAwaitingAutoStrip;
  window.setTask5ModAwaitingAutoStrip = setTask5ModAwaitingAutoStrip;
  window.getTask4ValueStreamModificationBundle = getTask4ValueStreamModificationBundle;
  window.setTask4ValueStreamModificationBundle = setTask4ValueStreamModificationBundle;
  window.clearTask4ValueStreamModificationBundle = clearTask4ValueStreamModificationBundle;
}

/**
 * 将当前任务的过程日志时间线格式化为大模型上下文字符串。
 * @param {string} createdAt
 * @param {string} taskId
 * @param {object[]} chats
 * @param {{ maxComms?: number, perEntryMaxChars?: number, maxTotalChars?: number }} [opts] - 不传则保留历史行为（全量条目、每条最多 3000 字、总长度不截断）
 */
function buildTaskTimelineContextForLLM(createdAt, taskId, chats, opts) {
  const getCommunicationsByTask = typeof window.getCommunicationsByTask === 'function' ? window.getCommunicationsByTask : () => ({});
  const byTask = getCommunicationsByTask(createdAt, chats || []);
  let comms = (byTask[taskId] || []).slice().sort((a, b) => {
    const ta = (a.time && new Date(a.time).getTime()) || 0;
    const tb = (b.time && new Date(b.time).getTime()) || 0;
    return ta - tb;
  });
  const maxComms = opts && typeof opts.maxComms === 'number' && opts.maxComms > 0 ? opts.maxComms : 0;
  if (maxComms > 0 && comms.length > maxComms) {
    comms = comms.slice(-maxComms);
  }
  const perCap =
    opts && typeof opts.perEntryMaxChars === 'number' && opts.perEntryMaxChars > 0 ? opts.perEntryMaxChars : 3000;
  let joined = comms
    .map((c) => {
      const timeStr = c.time && typeof formatChatTime === 'function' ? formatChatTime(c.time) : c.time || '—';
      const content = typeof c.content === 'string' ? c.content : JSON.stringify(c.content || {}, null, 2);
      return `[${timeStr}] ${c.speaker || '—'}：\n${content.slice(0, perCap)}${content.length > perCap ? '\n…' : ''}`;
    })
    .join('\n\n');
  const maxTotal = opts && typeof opts.maxTotalChars === 'number' && opts.maxTotalChars > 0 ? opts.maxTotalChars : 0;
  if (maxTotal > 0 && joined.length > maxTotal) {
    joined =
      '…（时间线过长，已截断前段；以下为近期末尾摘录，供理解修改语境）…\n\n' +
      joined.slice(Math.max(0, joined.length - maxTotal));
  }
  return joined;
}

/** task5/task6 等多环节 session：过程日志条目多且单条常含大段 prompt/json，供修改意图提炼 / 修改提示词首轮等压上下文 */
function getCompactTimelineOptsForHeavySessionTask(taskId) {
  if (taskId === 'task5') return { maxComms: 22, perEntryMaxChars: 700, maxTotalChars: 9000 };
  if (taskId === 'task6') return { maxComms: 28, perEntryMaxChars: 900, maxTotalChars: 12000 };
  return { maxComms: 48, perEntryMaxChars: 2200, maxTotalChars: 28000 };
}

/** 中英混合粗略 token 估算（仅用于调试日志，非精确计费） */
function estimateRoughTokenCountFromChars(text) {
  const s = text == null ? '' : String(text);
  if (!s) return 0;
  return Math.ceil(s.length / 3);
}

/**
 * 记录「修改·新提示词生成」首轮请求体规模，供排查 context length 超限（见 `__FE_LAST_MOD_REFINEMENT_STATS`）。
 * 详细控制台输出：`globalThis.__FE_MOD_REFINEMENT_DEBUG = true`
 */
function recordModificationRefinementPayloadDebug(payload) {
  try {
    const stats = {
      phase: 'modification-refinement-first-round',
      taskId: payload.taskId,
      promptSource: payload.promptSource,
      currentLlmPromptChars: payload.currentLlmPromptLen,
      currentLlmOutputChars: payload.currentLlmOutputLen,
      timelineContextChars: payload.timelineLen,
      reasonChars: payload.reasonLen,
      goalChars: payload.goalLen,
      systemPromptChars: payload.systemLen,
      userContentChars: payload.userContentLen,
      approxMessageTokens: payload.approxMessageTokens,
      timelineCommsCount: payload.timelineCommsCount,
      timelineCommsUsed: payload.timelineCommsUsed,
    };
    if (typeof globalThis !== 'undefined') globalThis.__FE_LAST_MOD_REFINEMENT_STATS = stats;
    if (typeof globalThis !== 'undefined' && globalThis.__FE_MOD_REFINEMENT_DEBUG === true) {
      console.warn('[FE:mod-refinement]', stats);
    }
  } catch (_) {}
}

/** 从用户修改建议中提取「修改动因 / 修改目标」；若未显式提供则回退为整段反馈（支持多行，直至下一标签或文末） */
function extractModificationReasonAndGoal(userFeedback) {
  const raw = String(userFeedback || '').trim();
  const reasonMatch = raw.match(/修改动因\s*[:：]\s*([\s\S]*?)(?=\n\s*修改目标\s*[:：]|\n\s*【用户原始反馈】|$)/);
  const goalMatch = raw.match(/修改目标\s*[:：]\s*([\s\S]*?)(?=\n\s*【用户原始反馈】|$)/);
  const reason = reasonMatch && reasonMatch[1] ? reasonMatch[1].trim() : '';
  const goal = goalMatch && goalMatch[1] ? goalMatch[1].trim() : '';
  return {
    reason: reason || raw || '（未提供）',
    goal: goal || raw || '（未提供）',
  };
}

/**
 * 调用大模型将用户口语化修改意见提炼为「修改动因」「修改目标」（供确认卡片展示与后续提示词重组）。
 * 「修改目标」可含多条编号项（用户同时提多类修改时须逐条保留），禁止多选一或「待补充」式追问（见 systemPrompt 正文）。
 * 解析失败时回退到 extractModificationReasonAndGoal（与历史行为兼容）。
 * @returns {Promise<{ reason: string, goal: string, llmMeta: { usage: Object, model: string, durationMs: number } }>}
 */
async function extractModificationIntentWithLLM(userFeedback, taskId, taskName, timelineContext) {
  const systemPrompt = `你是数字化问题跟进的「修改意图提炼」助手。用户刚对某项任务成果提出了修改意见（可能口语化、不完整或夹杂情绪）。

请结合【任务】与【过程日志时间线摘录】，将用户意见提炼为两部分：
1. 修改动因：为什么要改（客户反馈、事实/数据纠偏、约束或范围变化、表述不清需重写等），1～4 句，客观准确。
2. 修改目标：说明「后续提示词修订须落实什么」，须与当前任务、时间线语境一致；面向系统自动重组提示词，表述必须**确定、可执行**。
   - 若用户**只提一类**修改：用 1～4 句陈述句即可。
   - 若用户**同时提多类或多处**修改（例如：重命名某编号节点、在某阶段新增某类型环节、增补集成协议/字段规则等）：必须用 **编号列表（1. 2. 3. …）逐条写出**，**每一条都是必须落实项**；**禁止**为追求简短而合并成一句概括，导致丢失环节编号（如 N.1.1）、节点类型（如 Original/Enhanced）、主业务对象名称、或具体字段规则。
   **禁止**在「修改目标」中出现：互斥选项、「A 还是 B」「是否」「或者」「需要进一步向用户确认」「待补充：」等让读者再选择或再追问的表述；**禁止**罗列多种并列方案让用户挑选。
   若某处细节用户未说清，可依据任务类型与时间线作出**合理默认推断**，并在该条末用括号简短注明依据；**不得**因历史「只写一条」的习惯而丢弃用户已明确的多条要求。

【输出格式】只输出一个 JSON 对象，不要 Markdown 代码块、不要任何其它文字。键名必须为：
{"修改动因":"...","修改目标":"..."}`;

  const userContent = `【当前任务】${taskName || taskId}（taskId=${taskId || '—'}）\n\n【用户修改意见原文】\n${String(userFeedback || '').trim() || '(空)'}\n\n【当前任务过程日志时间线（摘录）】\n${String(timelineContext || '').trim() || '(无)'}`;

  try {
    if (typeof globalThis !== 'undefined') {
      const approx = estimateRoughTokenCountFromChars(systemPrompt) + estimateRoughTokenCountFromChars(userContent);
      globalThis.__FE_LAST_MOD_INTENT_STATS = {
        phase: 'mod-intent-extract',
        taskId,
        systemPromptChars: systemPrompt.length,
        userContentChars: userContent.length,
        approxMessageTokens: approx,
      };
      if (globalThis.__FE_MOD_REFINEMENT_DEBUG === true) {
        console.warn('[FE:mod-intent]', globalThis.__FE_LAST_MOD_INTENT_STATS);
      }
    }
  } catch (_) {}
  const chatOpts = taskId ? { taskTag: `${String(taskId)}-mod-intent` } : undefined;
  const { content, usage, model, durationMs } = await fetchDeepSeekChat(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
    chatOpts
  );
  const raw = String(content || '').trim();
  let reason = '';
  let goal = '';
  try {
    const jsonFence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const tryParse = (t) => {
      try {
        return JSON.parse(t);
      } catch (_) {
        return null;
      }
    };
    let obj = tryParse(jsonFence ? jsonFence[1].trim() : raw);
    if (!obj || typeof obj !== 'object') {
      const brace = raw.match(/\{[\s\S]*\}/);
      if (brace) obj = tryParse(brace[0]);
    }
    if (obj && typeof obj === 'object') {
      reason = String(obj['修改动因'] ?? obj.modificationReason ?? obj.reason ?? '').trim();
      goal = String(obj['修改目标'] ?? obj.modificationGoal ?? obj.goal ?? '').trim();
    }
  } catch (_) {}
  if (!reason && !goal) {
    const fb = extractModificationReasonAndGoal(userFeedback);
    reason = fb.reason;
    goal = fb.goal;
  }
  return {
    reason: reason || '（模型未返回修改动因）',
    goal: goal || '（模型未返回修改目标）',
    llmMeta: { usage, model, durationMs },
  };
}

/** 从任务时间线中回溯最近一次 LLM 调用的输入/输出，供「修改提示词重组」使用 */
function resolveLatestTaskLlmQueryIO(createdAt, taskId, chats) {
  const getCommunicationsByTask = typeof window.getCommunicationsByTask === 'function' ? window.getCommunicationsByTask : () => ({});
  const byTask = getCommunicationsByTask(createdAt, chats || []);
  const comms = Array.isArray(byTask[taskId]) ? byTask[taskId] : [];
  for (let i = comms.length - 1; i >= 0; i--) {
    const c = comms[i];
    try {
      const parsed = typeof c.content === 'string' ? JSON.parse(c.content) : c.content;
      const type = String(parsed?.type || '');
      const isLlmQueryType = type.includes('LlmQueryBlock') || type === 'rolePermissionCard' || type === 'rolePermissionAnalysisCard';
      if (!isLlmQueryType) continue;
      // 修改·新提示词生成块不是「任务主产出」的 LLM 查询，回溯上下文时应跳过
      if (type === 'modificationPromptRevisionLlmQueryBlock' || type === 'modificationRegenerateLlmQueryBlock') continue;
      if (type === 'rolePermissionAuditLlmQueryBlock') continue;
      const llmInput = parsed?.llmInputPrompt ?? parsed?.llmMeta?.inputPromptSnapshot ?? '';
      const llmOutput = parsed?.llmOutputRaw ?? parsed?.llmOutputJson ?? parsed?.content ?? '';
      if (String(llmInput || '').trim() || String(llmOutput || '').trim()) {
        return {
          llmInputPrompt: typeof llmInput === 'string' ? llmInput : JSON.stringify(llmInput || {}, null, 2),
          llmOutput: typeof llmOutput === 'string' ? llmOutput : JSON.stringify(llmOutput || {}, null, 2),
        };
      }
    } catch (_) {}
  }
  return { llmInputPrompt: '', llmOutput: '' };
}

/** task4：从主聊天消息回溯 Mirror / 分阶段加固 最近一次 LLM 卡（排除仅「提示词优化」用的 modificationRegenerate 卡） */
function findLastTask4PhaseLlmMessage(messages, phase) {
  const list = Array.isArray(messages) ? messages : [];
  const isHardeningVs = (vs) =>
    vs === 'hardening' || vs === 'hardening_stage_progress' || vs === 'hardening_final' || vs === 'hardening_draft';
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m || m.taskId !== 'task4') continue;
    const t = m.type;
    if (t === 'modificationPromptRevisionLlmQueryBlock') continue;
    if (t === 'modificationRegenerateLlmQueryBlock') {
      if (m.promptRevisionOnly) continue;
      const vs = String(m.valueStreamPhase || '');
      if (phase === 'mirror' && vs === 'mirror') return m;
      if (phase === 'hardening' && isHardeningVs(vs)) return m;
      continue;
    }
    if (t === 'task4LlmQueryBlock') {
      const vs = String(m.valueStreamPhase || '');
      if (phase === 'mirror' && vs === 'mirror') return m;
      if (phase === 'hardening' && isHardeningVs(vs)) return m;
    }
  }
  return null;
}

function aggregateLlmUsageTwo(u1, u2) {
  const pt = (u) => Number(u?.prompt_tokens) || 0;
  const ct = (u) => Number(u?.completion_tokens) || 0;
  const tt = (u) => Number(u?.total_tokens) || 0;
  const p = pt(u1) + pt(u2);
  const c = ct(u1) + ct(u2);
  const t = tt(u1) + tt(u2);
  return {
    prompt_tokens: p,
    completion_tokens: c,
    total_tokens: t > 0 ? t : p + c,
  };
}

/** 从「【系统】…【用户】…」合并提示词中拆出系统段与用户段（用于修改后第二轮仅替换 system）；兼容 task5 单环节使用的【system】/【user】 */
function parseCombinedSystemUserParts(fullPrompt) {
  const s = String(fullPrompt || '').trim();
  const pairs = [
    ['【系统】', '【用户】'],
    ['【system】', '【user】'],
  ];
  for (const [systemMark, userMark] of pairs) {
    const sp = s.indexOf(systemMark);
    const up = s.indexOf(userMark);
    if (sp >= 0 && up > sp) {
      return {
        system: s.slice(sp + systemMark.length, up).trim(),
        user: s.slice(up + userMark.length).trim(),
      };
    }
  }
  return { system: s, user: s ? '请根据任务要求完成输出。' : '' };
}

/**
 * 解析「提示词修订」首轮返回：须含新提示词 + 相对旧版变更说明（JSON，兼容英文键）
 * @returns {{ newSystemPrompt: string, versionChangelog: string }}
 */
function parsePromptRevisionOutput(rawContent) {
  const raw = String(rawContent || '').trim();
  let obj = null;
  const jsonFence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const tryParse = (t) => {
    try {
      return JSON.parse(t);
    } catch (_) {
      return null;
    }
  };
  obj = tryParse(jsonFence ? jsonFence[1].trim() : raw);
  if (!obj || typeof obj !== 'object') {
    const brace = raw.match(/\{[\s\S]*\}/);
    if (brace) obj = tryParse(brace[0]);
  }
  if (obj && typeof obj === 'object') {
    const newPrompt =
      obj['新提示词'] ??
      obj.newSystemPrompt ??
      obj.new_prompt ??
      '';
    const changelog =
      obj['新版本对老版本的修改'] ??
      obj.changesFromPreviousVersion ??
      obj.version_changes ??
      '';
    const np = String(newPrompt || '').trim();
    if (np) {
      return {
        newSystemPrompt: np,
        versionChangelog: String(changelog || '').trim() || '—',
      };
    }
  }
  return {
    newSystemPrompt: raw,
    versionChangelog: '（模型未按约定 JSON 返回，已将全文视为「新提示词」）',
  };
}

/**
 * 确认「新提示词」后：将「新版本对老版本的修改」追加进实际发往模型的 system，避免修订模型只在变更说明里写要点、正文遗漏时无法落地（task4/5/6/11/12 及二轮重生成共用，FE-20260409+）。
 */
function appendModificationVersionChangelogToSystemPrompt(systemPrompt, versionChangelog) {
  const sys = String(systemPrompt || '').trim();
  const vc = String(versionChangelog || '').trim();
  if (!vc || vc === '—' || /^（模型未按约定/.test(vc)) return sys;
  return `${sys}\n\n---\n【新版本对老版本的修改（与上文具有同等效力，执行须逐条落实）】\n${vc}`;
}

/** task5 单环节修改提示词：从 sourceMsg 或聊天回退解析 stepIndex，与 task5LlmQueryBlock 一致 */
function resolveTask5ItStatusStepIndexForRefinement(sourceMsg, chats) {
  if (sourceMsg?.type === 'task5LlmQueryBlock' && typeof sourceMsg.stepIndex === 'number' && sourceMsg.stepIndex >= 0) {
    return sourceMsg.stepIndex;
  }
  const list = Array.isArray(chats) ? chats : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m?.type === 'task5LlmQueryBlock' && typeof m.stepIndex === 'number' && m.stepIndex >= 0) {
      return m.stepIndex;
    }
  }
  return null;
}

/** 按案例键（createdAt / id）解析详情项，供 task5 单环节 prompt 快照 */
function findDigitalProblemItemByCaseRef(caseRef) {
  const r = caseRef == null ? '' : String(caseRef).trim();
  if (!r) return null;
  const list = typeof getDigitalProblems === 'function' ? getDigitalProblems() : [];
  const hit = list.find((it) => String(it.createdAt) === r || String(it.id || '') === r);
  if (hit) return hit;
  const cur = typeof __appState !== 'undefined' ? __appState.currentProblemDetailItem : null;
  if (cur && (String(cur.createdAt) === r || String(cur.id || '') === r)) return cur;
  return null;
}

/** 根据过程日志与用户修改/讨论反馈请求大模型重新生成内容 */
async function requestRefinementFromFeedback(taskId, createdAt, timelineContext, userFeedback, type, sourceMsg, chats) {
  const isModification = type === 'modification';
  const sourceInput = sourceMsg?.llmInputPrompt ?? sourceMsg?.llmMeta?.inputPromptSnapshot ?? '';
  const sourceOutput = sourceMsg?.llmOutputRaw ?? sourceMsg?.llmOutputJson ?? sourceMsg?.content ?? '';
  const latestIO = resolveLatestTaskLlmQueryIO(createdAt, taskId, chats);
  const currentLlmPrompt = String(sourceInput || latestIO.llmInputPrompt || '').trim();
  const currentLlmOutput = String(
    typeof sourceOutput === 'string' ? sourceOutput : (sourceOutput != null ? JSON.stringify(sourceOutput, null, 2) : (latestIO.llmOutput || ''))
  ).trim();
  let effectiveLlmPrompt = currentLlmPrompt;
  if (taskId === 'task5' && typeof window !== 'undefined' && typeof window.buildTask5ItStatusSingleStepPromptSnapshot === 'function') {
    const stepIdx = resolveTask5ItStatusStepIndexForRefinement(sourceMsg, chats);
    if (stepIdx != null) {
      const item = findDigitalProblemItemByCaseRef(createdAt);
      const snap = item ? window.buildTask5ItStatusSingleStepPromptSnapshot(item, stepIdx) : null;
      if (snap?.fullPrompt) effectiveLlmPrompt = String(snap.fullPrompt).trim();
    }
  }
  let systemPrompt;
  const chatOpts = taskId ? { taskTag: String(taskId) } : undefined;
  if (isModification) {
    const revisionOutputSpec = `【输出要求】只输出一个 JSON 对象，不要 Markdown 代码块、不要前后解释。键名必须为：
- "新提示词"：字符串，将作为下一轮大模型调用的 system 角色正文（若需保留原任务的用户侧输入结构，可在此字符串内继续使用「【系统】」「【用户】」分段，系统侧只取「【系统】」与「【用户】」之间的部分作为 system、其后为用户内容；更简单做法是只写纯 system 提示词正文）；
- "新版本对老版本的修改"：字符串，用条目或段落说明相对上一版提示词/行为做了哪些调整。

JSON 示例：
{"新提示词":"……","新版本对老版本的修改":"……"}`;
    const multiItemConstraint = `【完整性硬性要求】若「用户修改目标」中出现多条（编号列表、多段落或多句并列要求），你产出的「新提示词」必须**逐条**在 system 正文中落实为可执行约束或说明，**禁止**只挑选其中一条（例如仅写集成协议而忽略具体节点重命名、新增环节、主业务对象等）。价值流/拓扑类任务：凡用户给出环节编号、阶段名、节点类型、主业务对象、actor 规则等，均须写入新提示词对应章节，不得仅用笼统「优化表述」代替。`;
    const revisionJsonFieldConsistencyCommon = `【「新提示词」与「新版本对老版本的修改」一致性（硬性，全任务）】
- **禁止**在「新版本对老版本的修改」中声称已落实某项改动，却在「新提示词」正文（含「【系统】」「【用户】」各段，若使用分段）中找不到对应的**可执行条文**；须含可检索关键词（字段名、环节/阶段名、节点编号、JSON 键名、规则要点等，随任务而定）。
- 须在「新提示词」中设独立章节「## 【本次修订落实清单】」，用编号列表将「用户修改目标」中每一条写成可执行的输出/建模约束；「新版本对老版本的修改」只能概括该清单，**禁止**仅用「整体已支持用户需求」等空话代替正文中的具体条文。
- 若使用「【系统】」「【用户】」分段：变更说明中的每条须在 **system 与 user 两段合计** 中有对应表述，禁止要点只写在「新版本对老版本的修改」里而不进入「新提示词」任一区段。`;
    const task4MirrorRevisionNote = `【task4·Mirror 工程语义】「新提示词」仅在 **第一阶段 Mirror** 自动重跑时拼在全局 Mirror 系统模板之后，作为「本轮修改专用系统约束」。只写 Mirror 侧增量（阶段切分、L1 命名、节点要素、JSON 形态等），**禁止**把分阶段 Enhanced/gap_resolved 规则写进本段（属第二阶段）。可只写增量条款，须满足上文「两字段一致性」。`;
    const task4HardeningRevisionNote = `【task4·分阶段加固 工程语义】「新提示词」在 **第二阶段** 每一 L1 阶段加固调用时拼在全局 Hardening 系统模板之后。只写架构加固侧增量（Enhanced 插入、四域闭环、gap_resolved、无损保留 Original 等），**禁止**重复 Mirror 才关心的整图骨架规则。可只写增量条款，须满足上文「两字段一致性」。`;
    const { reason, goal } = extractModificationReasonAndGoal(userFeedback);
    const noProcessLogNote =
      '（完成确认「请修改」链路不加载过程日志；请仅依据上文「当前大模型调用提示词」「当前返回」与「修改动因 / 修改目标」整合新提示词。）';

    if (taskId === 'task4') {
      const maxPhaseChars = 24000;
      const messages = Array.isArray(chats) ? chats : [];
      const mirrorMsg = findLastTask4PhaseLlmMessage(messages, 'mirror');
      const hardenMsg = findLastTask4PhaseLlmMessage(messages, 'hardening');
      const capOut = (t) => {
        const s = String(t || '');
        return s.length > maxPhaseChars ? s.slice(0, maxPhaseChars) + '\n…（当前返回过长已截断）…' : s;
      };
      const mirrorInput = String((mirrorMsg?.llmInputPrompt || '') || latestIO.llmInputPrompt || '').trim();
      const mirrorOutputRaw = String((mirrorMsg?.llmOutputRaw || '') || latestIO.llmOutput || '').trim();
      const hardenInput = String((hardenMsg?.llmInputPrompt || '') || mirrorInput || latestIO.llmInputPrompt || '').trim();
      const hardenOutputRaw = String((hardenMsg?.llmOutputRaw || '') || latestIO.llmOutput || '').trim();

      const mirrorSys = `你是一位提示词工程助手。用户从「是否视为已完成」流程进入修订，需单独优化 task4 **第一阶段 Mirror** 的注入约束。
请**仅**根据：①下方「当前大模型调用提示词」②「当前返回」③修改动因 ④修改目标 —— 产出修订结果；**不要**臆造未给出的过程日志条目。

${multiItemConstraint}
${revisionJsonFieldConsistencyCommon}
${task4MirrorRevisionNote}
${revisionOutputSpec}`;
      const mirrorUserContent = `【阶段】Mirror（忠实还原）\n【当前大模型调用提示词】\n${mirrorInput || '(无)'}\n\n【当前返回】\n${capOut(mirrorOutputRaw) || '(无)'}\n\n【用户修改动因】\n${reason}\n\n【用户修改目标】\n${goal}\n\n【补充：当前任务过程日志时间线】\n${noProcessLogNote}`;

      recordModificationRefinementPayloadDebug({
        taskId: 'task4-mirror-prompt-revision',
        promptSource: mirrorMsg ? 'mirrorBlock' : String(latestIO.llmInputPrompt || '').trim() ? 'latestIO' : 'empty',
        currentLlmPromptLen: mirrorInput.length,
        currentLlmOutputLen: mirrorOutputRaw.length,
        timelineLen: 0,
        reasonLen: String(reason || '').length,
        goalLen: String(goal || '').length,
        systemLen: mirrorSys.length,
        userContentLen: mirrorUserContent.length,
        approxMessageTokens:
          estimateRoughTokenCountFromChars(mirrorSys) + estimateRoughTokenCountFromChars(mirrorUserContent),
        timelineCommsCount: 0,
        timelineCommsUsed: 0,
      });

      const firstMirror = await fetchDeepSeekChat(
        [{ role: 'system', content: mirrorSys }, { role: 'user', content: mirrorUserContent }],
        chatOpts,
      );
      const revM = parsePromptRevisionOutput((firstMirror.content || '').trim());
      const partsM = parseCombinedSystemUserParts(revM.newSystemPrompt);

      const hardenSys = `你是一位提示词工程助手。用户从「是否视为已完成」流程进入修订，需单独优化 task4 **第二阶段分阶段架构加固** 的注入约束（各 L1 阶段调用共用）。
请**仅**根据：①下方「当前大模型调用提示词」②「当前返回」③修改动因 ④修改目标 —— 产出修订结果；**不要**臆造未给出的过程日志条目。

${multiItemConstraint}
${revisionJsonFieldConsistencyCommon}
${task4HardeningRevisionNote}
${revisionOutputSpec}`;
      const hardenUserContent = `【阶段】分阶段架构加固（单阶段 LLM）\n【当前大模型调用提示词】\n${hardenInput || '(无)'}\n\n【当前返回】\n${capOut(hardenOutputRaw) || '(无)'}\n\n【用户修改动因】\n${reason}\n\n【用户修改目标】\n${goal}\n\n【补充：当前任务过程日志时间线】\n${noProcessLogNote}`;

      recordModificationRefinementPayloadDebug({
        taskId: 'task4-hardening-prompt-revision',
        promptSource: hardenMsg ? 'hardeningBlock' : 'fallback',
        currentLlmPromptLen: hardenInput.length,
        currentLlmOutputLen: hardenOutputRaw.length,
        timelineLen: 0,
        reasonLen: String(reason || '').length,
        goalLen: String(goal || '').length,
        systemLen: hardenSys.length,
        userContentLen: hardenUserContent.length,
        approxMessageTokens:
          estimateRoughTokenCountFromChars(hardenSys) + estimateRoughTokenCountFromChars(hardenUserContent),
        timelineCommsCount: 0,
        timelineCommsUsed: 0,
      });

      const firstHard = await fetchDeepSeekChat(
        [{ role: 'system', content: hardenSys }, { role: 'user', content: hardenUserContent }],
        chatOpts,
      );
      const revH = parsePromptRevisionOutput((firstHard.content || '').trim());
      const partsH = parseCombinedSystemUserParts(revH.newSystemPrompt);

      const userForSecond =
        (partsM.user && String(partsM.user).trim()) ||
        (partsH.user && String(partsH.user).trim()) ||
        parseCombinedSystemUserParts(currentLlmPrompt).user ||
        '请根据任务要求完成输出。';

      const mirrorRoundIn = `【系统】\n${mirrorSys}\n\n【用户】\n${mirrorUserContent}`;
      const hardRoundIn = `【系统】\n${hardenSys}\n\n【用户】\n${hardenUserContent}`;
      const usageAgg = aggregateLlmUsageTwo(firstMirror.usage, firstHard.usage);
      const durationMs = (Number(firstMirror.durationMs) || 0) + (Number(firstHard.durationMs) || 0);

      return {
        modification: true,
        task4DualPhase: true,
        firstRoundLlmInputPrompt: `【第一阶段 Mirror · 提示词修订】\n${mirrorRoundIn}\n\n---\n【第二阶段 分阶段加固 · 提示词修订】\n${hardRoundIn}`,
        firstRound: {
          content: JSON.stringify(
            { mirror: firstMirror.content || '', hardening: firstHard.content || '' },
            null,
            2,
          ),
          usage: usageAgg,
          model: firstHard.model || firstMirror.model || '',
          durationMs,
        },
        revision: {
          newSystemPrompt: `${revM.newSystemPrompt}\n\n---\n${revH.newSystemPrompt}`,
          versionChangelog: `【第一阶段 Mirror】\n${revM.versionChangelog}\n\n【第二阶段 分阶段加固】\n${revH.versionChangelog}`,
        },
        secondRoundPending: {
          systemForSecond: partsM.system || revM.newSystemPrompt,
          userForSecond,
        },
        task4PromptRevisionPhases: {
          mirror: {
            newSystemPrompt: revM.newSystemPrompt,
            versionChangelog: revM.versionChangelog,
            firstRoundRaw: firstMirror.content,
            firstRoundLlmInputPrompt: mirrorRoundIn,
            systemForSecond: partsM.system || revM.newSystemPrompt,
            usage: firstMirror.usage,
            model: firstMirror.model,
            durationMs: firstMirror.durationMs,
          },
          hardening: {
            newSystemPrompt: revH.newSystemPrompt,
            versionChangelog: revH.versionChangelog,
            firstRoundRaw: firstHard.content,
            firstRoundLlmInputPrompt: hardRoundIn,
            systemForSecond: partsH.system || revH.newSystemPrompt,
            usage: firstHard.usage,
            model: firstHard.model,
            durationMs: firstHard.durationMs,
          },
          userForSecond,
        },
      };
    }

    systemPrompt = `你是一位提示词工程助手。用户从「是否视为已完成」等完成确认流程点击「请修改」进入修订：希望对当前任务的大模型提示词做调整。
请**仅**根据用户消息中的：①当前大模型调用提示词 ②当前返回 ③修改动因 ④修改目标 —— 将修改意图与原有提示词整合，产出修订后的提示词；**不要**依赖或臆造过程日志（本请求刻意不提供过程日志时间线）。

${multiItemConstraint}
${revisionJsonFieldConsistencyCommon}
${revisionOutputSpec}`;
    const maxLlmOutChars = taskId === 'task5' ? 16000 : taskId === 'task6' ? 20000 : 32000;
    let cappedLlmOutput = currentLlmOutput;
    if (cappedLlmOutput.length > maxLlmOutChars) {
      cappedLlmOutput =
        cappedLlmOutput.slice(0, maxLlmOutChars) + '\n…（当前返回过长已截断，修改提示词修订请优先依据未截断前的用户动因/目标与系统提示）…';
    }
    const userContent = `【当前大模型调用提示词】\n${effectiveLlmPrompt || '(无)'}\n\n【当前返回】\n${cappedLlmOutput || '(无)'}\n\n【用户修改动因】\n${reason}\n\n【用户修改目标】\n${goal}\n\n【补充：当前任务过程日志时间线】\n${noProcessLogNote}`;
    const promptSource = String(sourceInput || '').trim()
      ? 'sourceMsg'
      : String(latestIO.llmInputPrompt || '').trim()
        ? 'latestIO'
        : 'empty';
    recordModificationRefinementPayloadDebug({
      taskId,
      promptSource,
      currentLlmPromptLen: effectiveLlmPrompt.length,
      currentLlmOutputLen: cappedLlmOutput.length,
      timelineLen: 0,
      reasonLen: String(reason || '').length,
      goalLen: String(goal || '').length,
      systemLen: systemPrompt.length,
      userContentLen: userContent.length,
      approxMessageTokens:
        estimateRoughTokenCountFromChars(systemPrompt) + estimateRoughTokenCountFromChars(userContent),
      timelineCommsCount: 0,
      timelineCommsUsed: 0,
    });
    const first = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      chatOpts
    );
    const firstRaw = (first.content || '').trim();
    const firstRoundLlmInputPrompt = `【系统】\n${systemPrompt}\n\n【用户】\n${userContent}`;
    const { newSystemPrompt, versionChangelog } = parsePromptRevisionOutput(firstRaw);
    const parts = parseCombinedSystemUserParts(newSystemPrompt);
    const systemForSecond = parts.system || newSystemPrompt;
    const userForSecond =
      (parts.user && String(parts.user).trim()) || parseCombinedSystemUserParts(effectiveLlmPrompt).user || '请根据任务要求完成输出。';
    return {
      modification: true,
      firstRoundLlmInputPrompt,
      firstRound: { content: firstRaw, usage: first.usage, model: first.model, durationMs: first.durationMs },
      revision: { newSystemPrompt, versionChangelog },
      secondRoundPending: { systemForSecond, userForSecond },
    };
  } else {
    systemPrompt = `你是一位数字化问题跟进助手。用户希望就当前任务进一步讨论。请根据【当前任务过程日志时间线】与【用户问题】，给出有针对性的回复（可为说明、建议或补充内容）。`;
  }
  const userContent = `【当前任务过程日志时间线】\n${timelineContext || '(无)'}\n\n【用户问题】\n${userFeedback || ''}`;
  const { content, usage, model, durationMs } = await fetchDeepSeekChat(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
    chatOpts
  );
  return { modification: false, content: (content || '').trim(), usage, model, durationMs };
}

/** 从模型返回文本中解析 JSON（对象或数组），供 task10 修改后重生成等场景 */
function parseLooseJsonValue(rawText) {
  const t = String(rawText || '').trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch (_) {}
  const codeBlocks = [...t.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => (m[1] || '').trim()).filter(Boolean);
  for (const blk of codeBlocks) {
    try {
      return JSON.parse(blk);
    } catch (_) {}
  }
  const startObj = t.indexOf('{');
  const startArr = t.indexOf('[');
  let start = -1;
  if (startObj >= 0 && startArr >= 0) start = Math.min(startObj, startArr);
  else if (startObj >= 0) start = startObj;
  else if (startArr >= 0) start = startArr;
  if (start < 0) return null;
  const tail = t.slice(start);
  if (tail.startsWith('{')) {
    const endObj = tail.lastIndexOf('}');
    if (endObj > 0) {
      try {
        return JSON.parse(tail.slice(0, endObj + 1));
      } catch (_) {}
    }
  } else {
    const endArr = tail.lastIndexOf(']');
    if (endArr > 0) {
      try {
        return JSON.parse(tail.slice(0, endArr + 1));
      } catch (_) {}
    }
  }
  return null;
}

// 角色与权限推演任务已移除；保留解析/快照工具供修改链路与 task11 审计回退解析使用
function parseTask10RolePermissionRegeneratePayload() {
  return null;
}
function parseRolePermissionAuditOpinionItems(rawText) {
  const raw = String(rawText == null ? '' : rawText).replace(/\r\n?/g, '\n').trim();
  if (!raw) return [];
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const bulletRe = /^(?:\d+[\.\)、]|[-*•])\s*(.+)$/;
  const bulletItems = [];
  for (const line of lines) {
    const m = line.match(bulletRe);
    if (!m) continue;
    const t = String(m[1] || '').trim();
    if (t) bulletItems.push(t);
  }
  if (bulletItems.length >= 2) return [...new Set(bulletItems)];
  if (lines.length >= 2) {
    const nonHeading = lines.filter((line) => !/^(审计|结论|建议|说明|总体|备注)[:：]?$/.test(line));
    if (nonHeading.length >= 2) return [...new Set(nonHeading)];
  }
  return [raw];
}
function parseRolePermissionAuditDefectItems(rawText, options) {
  const raw = String(rawText == null ? '' : rawText).trim();
  if (!raw) return [];
  const fallbackRefactor =
    options && typeof options.fallbackRefactorInstruction === 'string' && options.fallbackRefactorInstruction.trim()
      ? String(options.fallbackRefactorInstruction).trim()
      : '请根据该审计意见完成相关提示词与产出调整。';
  const parsed = parseLooseJsonValue(raw);
  const toDefectObj = (it) => {
    if (!it || typeof it !== 'object') return null;
    const principle = String(it['违反准则'] ?? it.violatedPrinciple ?? it.principle ?? '').trim();
    const roleStep = String(
      it['涉及角色/环节'] ?? it['涉及环节/对象'] ?? it.involvedRoleOrStep ?? it.scope ?? '',
    ).trim();
    const desc = String(it['问题描述'] ?? it.problemDescription ?? it.description ?? '').trim();
    const cmd = String(it['重构指令'] ?? it.refactorInstruction ?? it.rewriteCommand ?? '').trim();
    if (!principle && !roleStep && !desc && !cmd) return null;
    return {
      principle: principle || '（未提供）',
      roleStep: roleStep || '（未提供）',
      problemDescription: desc || '（未提供）',
      refactorInstruction: cmd || '（未提供）',
    };
  };
  let list = [];
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const defects = parsed['缺陷清单'] ?? parsed.defects ?? parsed.issues ?? [];
    if (Array.isArray(defects)) list = defects;
  } else if (Array.isArray(parsed)) {
    list = parsed;
  }
  const normalized = list.map(toDefectObj).filter(Boolean);
  if (normalized.length > 0) return normalized;
  return parseRolePermissionAuditOpinionItems(raw).map((txt) => ({
    principle: '（未结构化）',
    roleStep: '（未结构化）',
    problemDescription: String(txt || '').trim() || '（未提供）',
    refactorInstruction: fallbackRefactor,
  }));
}
function parseCoreBusinessObjectGlobalAuditDefectItems(rawText) {
  const raw = String(rawText == null ? '' : rawText).trim();
  if (!raw) return [];
  const cboFallback = {
    fallbackRefactorInstruction: '请根据该审计意见调整核心业务对象推演相关提示词与产出。',
  };
  const parsed = parseLooseJsonValue(raw);
  const fromConsistencyDefect = (it) => {
    if (!it || typeof it !== 'object') return null;
    const defectType = String(it['缺陷类型'] ?? it.defectType ?? it.type ?? '').trim();
    const objectsRaw = it['涉及对象'];
    let roleStep = '';
    if (Array.isArray(objectsRaw)) {
      roleStep = objectsRaw.map((o) => String(o).trim()).filter(Boolean).join('、');
    } else {
      roleStep = String(objectsRaw ?? it.involvedObjects ?? '').trim();
    }
    const risk = String(it['风险描述'] ?? it.riskDescription ?? it.description ?? '').trim();
    const fix = String(it['修正建议'] ?? it.suggestion ?? it.refactorInstruction ?? '').trim();
    if (!defectType && !roleStep && !risk && !fix) return null;
    return {
      principle: defectType || '（未提供）',
      roleStep: roleStep || '（未提供）',
      problemDescription: risk || '（未提供）',
      refactorInstruction: fix || '（未提供）',
    };
  };
  let list = [];
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const defects = parsed['一致性缺陷清单'] ?? parsed['缺陷清单'] ?? parsed.defects ?? parsed.issues ?? [];
    if (Array.isArray(defects)) list = defects;
  } else if (Array.isArray(parsed)) {
    list = parsed;
  }
  const normalized = list.map(fromConsistencyDefect).filter(Boolean);
  if (normalized.length > 0) return normalized;
  return parseRolePermissionAuditDefectItems(raw, cboFallback);
}
function cloneJsonSafeForRpSnapshot(v) {
  if (v == null) return v;
  try {
    return JSON.parse(JSON.stringify(v));
  } catch (_) {
    return v;
  }
}
function snapshotRolePermissionSessionsForModificationDiff(sessions) {
  if (!Array.isArray(sessions)) return [];
  return sessions.map((s) => ({
    stepIndex: Number(s.stepIndex),
    stageName: String(s.stageName || ''),
    stepName: String(s.stepName || ''),
    rolePermissionJson: cloneJsonSafeForRpSnapshot(s.rolePermissionJson),
  }));
}
function stableStringifyRolePermissionJson(obj) {
  if (obj == null) return '';
  try {
    return JSON.stringify(obj, null, 2);
  } catch (_) {
    return String(obj);
  }
}
function buildRolePermissionModificationDiffMarkdown(prevSnap, curSnap) {
  let md = '### 推演 JSON 相对上一版的变化\n\n';
  const byIdx = (arr) => {
    const m = new Map();
    for (const row of arr || []) m.set(Number(row.stepIndex), row);
    return m;
  };
  const pm = byIdx(prevSnap);
  const cm = byIdx(curSnap);
  const indices = new Set([...pm.keys(), ...cm.keys()]);
  const sorted = [...indices].sort((a, b) => a - b);
  let any = false;
  for (const si of sorted) {
    const p = pm.get(si);
    const c = cm.get(si);
    const ps = stableStringifyRolePermissionJson(p?.rolePermissionJson ?? null);
    const cs = stableStringifyRolePermissionJson(c?.rolePermissionJson ?? null);
    if (ps === cs) continue;
    any = true;
    const label =
      c?.stageName && c?.stepName
        ? `${c.stageName} / ${c.stepName}`
        : p?.stageName && p?.stepName
          ? `${p.stageName} / ${p.stepName}`
          : `环节（stepIndex=${si}）`;
    md += `#### ${label}\n\n**上一版：**\n\`\`\`json\n${ps || '(无)'}\n\`\`\`\n\n**当前：**\n\`\`\`json\n${cs || '(无)'}\n\`\`\`\n\n`;
  }
  if (!any) md += '_各环节推演 JSON 文本与上一版一致。_\n';
  return md;
}
function buildRolePermissionStepChangeMarkdown(prevJson, nextJson, stepName, stageName) {
  const prevObj = prevJson && typeof prevJson === 'object' ? prevJson : null;
  const nextObj = nextJson && typeof nextJson === 'object' ? nextJson : null;
  const prevRoles = Array.isArray(prevObj?.roles) ? prevObj.roles : [];
  const nextRoles = Array.isArray(nextObj?.roles) ? nextObj.roles : [];
  const prevNames = new Set(prevRoles.map((r) => String(r?.role_name || '').trim()).filter(Boolean));
  const nextNames = new Set(nextRoles.map((r) => String(r?.role_name || '').trim()).filter(Boolean));
  const added = [...nextNames].filter((n) => !prevNames.has(n));
  const removed = [...prevNames].filter((n) => !nextNames.has(n));
  const label = stageName ? `${stageName} / ${stepName}` : stepName;
  const changed =
    stableStringifyRolePermissionJson(prevObj) !== stableStringifyRolePermissionJson(nextObj);
  let md = `### ${label}\n\n`;
  md += `- 角色数：${prevRoles.length} -> ${nextRoles.length}\n`;
  if (added.length) md += `- 新增角色：${added.join('、')}\n`;
  if (removed.length) md += `- 移除角色：${removed.join('、')}\n`;
  const prevSod = prevObj?.sod_warning == null ? '' : String(prevObj.sod_warning).trim();
  const nextSod = nextObj?.sod_warning == null ? '' : String(nextObj.sod_warning).trim();
  if (prevSod !== nextSod) {
    md += `- SoD 变更：${prevSod || '（空）'} -> ${nextSod || '（空）'}\n`;
  }
  if (!changed) md += '- 结构化 JSON 与上一版一致（可能仅措辞变化）\n';
  md += `\n**上一版**\n\`\`\`json\n${stableStringifyRolePermissionJson(prevObj) || '(无)'}\n\`\`\`\n\n`;
  md += `**当前版**\n\`\`\`json\n${stableStringifyRolePermissionJson(nextObj) || '(无)'}\n\`\`\`\n`;
  return md;
}

function normalizeItStatusLabelForDiff(rawItStatus) {
  if (!rawItStatus) return '';
  if (typeof rawItStatus === 'string') return rawItStatus.trim();
  if (typeof rawItStatus === 'object') {
    const t = String(rawItStatus.type || '').trim();
    const d = String(rawItStatus.detail || '').trim();
    if (!t && !d) return '';
    if (t && d) return `${t}-${d}`;
    return t || d;
  }
  return String(rawItStatus).trim();
}

function collectTask5ItStatusRowsForDiff(valueStream) {
  const rows = [];
  const parsed = parseValueStreamGraph(valueStream || {});
  const stages = Array.isArray(parsed?.stages) ? parsed.stages : [];
  stages.forEach((stage, stageIndex) => {
    const stageName = String(stage?.name || '').trim() || `阶段${stageIndex + 1}`;
    const steps = Array.isArray(stage?.steps) ? stage.steps : [];
    steps.forEach((step, stepIndex) => {
      const stepName = String(step?.name || '').trim() || `环节${stepIndex + 1}`;
      const statusLabel = String(step?.itStatusLabel || '').trim() || normalizeItStatusLabelForDiff(step?.itStatus || step?.it_status);
      rows.push({
        stageIndex,
        stepIndex,
        stageName,
        stepName,
        itStatus: statusLabel || '',
      });
    });
  });
  return rows;
}

function buildTask5ItStatusModificationActionMarkdown(previousValueStream, currentValueStream) {
  const prevRows = collectTask5ItStatusRowsForDiff(previousValueStream);
  const curRows = collectTask5ItStatusRowsForDiff(currentValueStream);
  const maxLen = Math.max(prevRows.length, curRows.length);
  const changed = [];
  for (let i = 0; i < maxLen; i += 1) {
    const p = prevRows[i] || null;
    const c = curRows[i] || null;
    const prevStatus = p?.itStatus || '';
    const curStatus = c?.itStatus || '';
    if (prevStatus === curStatus) continue;
    const stageName = c?.stageName || p?.stageName || `阶段${(c?.stageIndex ?? p?.stageIndex ?? 0) + 1}`;
    const stepName = c?.stepName || p?.stepName || `环节${(c?.stepIndex ?? p?.stepIndex ?? 0) + 1}`;
    changed.push({ stageName, stepName, prevStatus, curStatus });
  }
  if (!changed.length) {
    return '### 修改动作\n\n- 本次按新提示词重生成后，各环节 IT 现状与上一版一致。';
  }
  const lines = ['### 修改动作', '', `- 共识别 ${changed.length} 处 IT 现状变更：`, ''];
  changed.forEach((it) => {
    lines.push(
      `- ${it.stageName} / ${it.stepName}：${it.prevStatus || '（空）'} -> ${it.curStatus || '（空）'}`,
    );
  });
  return lines.join('\n');
}

function attachTask5ModificationActionToLatestLlmQueryBlock(markdown) {
  if (!Array.isArray(__appState.problemDetailChatMessages)) return;
  const idx = __appState.problemDetailChatMessages.findLastIndex(
    (m) => m?.type === 'modificationRegenerateLlmQueryBlock' && m?.taskId === 'task5',
  );
  if (idx < 0) return;
  __appState.problemDetailChatMessages[idx] = {
    ...__appState.problemDetailChatMessages[idx],
    modificationActionMarkdown: String(markdown || '').trim(),
  };
  const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
  if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
}

function buildTask10ModifiedStepUserPrompt() {
  return '';
}
async function runRolePermissionRegenerateWithNewPromptSequentially() {
  return;
}
function applyTask10RolePermissionRegenerateToCase() {
  return { ok: false, reason: 'removed' };
}

/** 修改链路：用户确认新提示词后，第二轮大模型返回结果的落地（task1/task4/task5 结构化卡片或 modificationResponseBlock） */
function pushModificationRegenerateOutcome(taskId, content, usage, model, durationMs, opts) {
  const tid = String(taskId || '');
  const ts = getTimeStr();
  const meta = { usage, model, durationMs };
  const confirmBlock = opts && typeof opts === 'object' ? opts.modificationConfirmBlock : null;
  const parseLooseJsonObject = (rawText) => {
    const text = String(rawText || '').trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {}
    const codeBlocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => (m[1] || '').trim()).filter(Boolean);
    for (const blk of codeBlocks) {
      try {
        const parsed = JSON.parse(blk);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (_) {}
    }
    const startObj = text.indexOf('{');
    const endObj = text.lastIndexOf('}');
    if (startObj >= 0 && endObj > startObj) {
      try {
        const parsed = JSON.parse(text.slice(startObj, endObj + 1));
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (_) {}
    }
    const startArr = text.indexOf('[');
    const endArr = text.lastIndexOf(']');
    if (startArr >= 0 && endArr > startArr) {
      try {
        const parsed = JSON.parse(text.slice(startArr, endArr + 1));
        return parsed != null && typeof parsed === 'object' ? parsed : null;
      } catch (_) {}
    }
    return null;
  };
  const normalizeTask4ValueStreamShape = (parsed) => {
    if (typeof globalThis !== 'undefined' && typeof globalThis.normalizeTask4LlmToWorkspace === 'function') {
      const n = globalThis.normalizeTask4LlmToWorkspace(parsed);
      if (n && typeof n === 'object' && Array.isArray(n.stages)) return n;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    // 直接是价值流结构
    if (Array.isArray(parsed.stages)) return parsed;
    // 常见包裹层
    const wrapped =
      parsed.valueStream ||
      parsed.value_stream ||
      parsed.valueStreamJson ||
      parsed.value_stream_json ||
      parsed.data ||
      parsed.result ||
      null;
    if (wrapped && typeof wrapped === 'object' && Array.isArray(wrapped.stages)) return wrapped;
    // 少数模型会返回数组包裹
    if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object' && Array.isArray(parsed[0].stages)) return parsed[0];
    return null;
  };
  if (tid === 'task1') {
    const jsonMatch = String(content || '').match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : String(content || '');
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object' && (parsed.company_name != null || parsed.credit_code != null || parsed.business_scope != null)) {
        pushAndSaveProblemDetailChat({
          role: 'system',
          type: 'basicInfoCard',
          data: parsed,
          timestamp: ts,
          confirmed: false,
          llmMeta: meta,
        });
        return;
      }
    } catch (_) {}
  }
  if (tid === 'task4') {
    const rawParsed = parseLooseJsonObject(content);
    const valueStreamJson = normalizeTask4ValueStreamShape(rawParsed);
    if (valueStreamJson && typeof valueStreamJson === 'object') {
      const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
      if (caseKey) {
        // task4 修改后重生成：在聊天卡片之外，同步刷新工作区使用的数据源
        if (typeof updateDigitalProblemValueStreamDataOnly === 'function') {
          updateDigitalProblemValueStreamDataOnly(caseKey, valueStreamJson);
        } else if (typeof updateDigitalProblemValueStream === 'function') {
          updateDigitalProblemValueStream(caseKey, valueStreamJson);
        }
        const updated = typeof findDigitalProblemCaseInList === 'function'
          ? findDigitalProblemCaseInList(__appState.currentProblemDetailItem)
          : null;
        __appState.currentProblemDetailItem = updated ? { ...updated } : { ...__appState.currentProblemDetailItem, valueStream: valueStreamJson };
      }
      pushAndSaveProblemDetailChat({
        type: 'valueStreamCard',
        taskId: 'task4',
        data: valueStreamJson,
        logicText: String(content || '').replace(/```[\s\S]*?```/g, '').trim(),
        timestamp: ts,
        confirmed: false,
        llmMeta: meta,
        valueStreamPhase: (opts && opts.valueStreamPhase) || 'hardening_final',
      });
      return;
    }
    pushAndSaveProblemDetailChat({
      role: 'system',
      content: '已收到重生成结果，但未识别出合法的价值流 JSON（需包含 stages 数组），请调整提示词后重试。',
      timestamp: ts,
    });
  }
  if (tid === 'task5') {
    const item = __appState.currentProblemDetailItem;
    const caseKey = getProblemDetailChatStorageKey(item);
    const rawParsed = parseLooseJsonObject(content);
    const baseVs = item?.valueStream;
    const parsedLooksLikeValueStream =
      !!rawParsed && typeof rawParsed === 'object' && Array.isArray(rawParsed.stages);
    let mergedVs = null;
    if (rawParsed && baseVs && !baseVs.raw && typeof window.mergeItStatusIntoValueStream === 'function') {
      mergedVs = window.mergeItStatusIntoValueStream(baseVs, rawParsed);
    }
    // 兜底：若模型直接返回完整价值流（含 stages），即便无法命中“合并分支”也直接落库，避免刷新后仍旧图
    if ((!mergedVs || typeof mergedVs !== 'object') && parsedLooksLikeValueStream) {
      mergedVs = rawParsed;
    }
    if (mergedVs && typeof mergedVs === 'object') {
      const modificationActionMarkdown = buildTask5ItStatusModificationActionMarkdown(baseVs, mergedVs);
      attachTask5ModificationActionToLatestLlmQueryBlock(modificationActionMarkdown);
      if (caseKey) {
        if (typeof updateDigitalProblemValueStreamItStatus === 'function') {
          updateDigitalProblemValueStreamItStatus(caseKey, mergedVs);
        } else if (typeof updateDigitalProblemValueStreamDataOnly === 'function') {
          updateDigitalProblemValueStreamDataOnly(caseKey, mergedVs);
        } else if (typeof updateDigitalProblemValueStream === 'function') {
          updateDigitalProblemValueStream(caseKey, mergedVs);
        }
        const updated = typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(__appState.currentProblemDetailItem) : null;
        __appState.currentProblemDetailItem = updated ? { ...updated } : { ...__appState.currentProblemDetailItem, valueStream: mergedVs };
      }
      pushAndSaveProblemDetailChat({
        type: 'task5ModificationActionBlock',
        taskId: 'task5',
        content: modificationActionMarkdown,
        timestamp: ts,
        llmMeta: meta,
        confirmed: false,
      });
      const { stages: vsStages } = parseValueStreamGraph(mergedVs);
      const itStatusOutputData = [];
      for (const stage of vsStages || []) {
        const stageName = stage.name || '';
        for (const step of stage.steps || []) {
          const stepName = step.name || '';
          let itStatus = step.itStatusLabel || '';
          if (!itStatus) {
            const it = step.itStatus || step.it_status;
            itStatus = !it ? '' : (typeof it === 'object' ? (it.type === '手工' ? `手工-${it.detail || ''}` : it.type === '系统' ? `系统-${it.detail || ''}` : '') : String(it));
          }
          const pl = step.itPlan && typeof step.itPlan === 'object' ? String(step.itPlan.plan || '').trim() : '';
          itStatusOutputData.push({ stageName, stepName, itStatus, itPlan: pl ? `IT计划：${pl}` : '' });
        }
      }
      pushAndSaveProblemDetailChat({
        type: 'itStatusCard',
        taskId: 'task5',
        data: itStatusOutputData,
        timestamp: ts,
        confirmed: false,
        llmMeta: meta,
      });
      return;
    }
  }
  pushAndSaveProblemDetailChat({
    type: 'modificationResponseBlock',
    taskId: tid,
    content: String(content || '').trim(),
    timestamp: ts,
    llmMeta: meta,
    confirmed: false,
  });
}

/**
 * 调试：检查「查询价值流列表」按钮及其父元素的状态
 */
function debugValueStreamButton() {
  const btn = document.getElementById('btnValueStreamList');
  const section = document.querySelector('.value-stream-actions');
  const result = document.getElementById('result');

  const info = {
    'btnValueStreamList 元素': btn ? '存在' : '不存在',
    'value-stream-actions 区块': section ? '存在' : '不存在',
    'result (main)': result ? '存在' : '不存在',
  };
  if (btn) {
    const rect = btn.getBoundingClientRect();
    const style = window.getComputedStyle(btn);
    info['按钮 display'] = style.display;
    info['按钮 visibility'] = style.visibility;
    info['按钮 opacity'] = style.opacity;
    info['按钮 width/height'] = `${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`;
    info['按钮在视口内'] = rect.width > 0 && rect.height > 0;
    info['按钮 offsetParent'] = btn.offsetParent ? btn.offsetParent.tagName : 'null';
  }
  if (section) {
    const rect = section.getBoundingClientRect();
    const style = window.getComputedStyle(section);
    info['区块 display'] = style.display;
    info['区块 visibility'] = style.visibility;
    info['区块 width/height'] = `${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`;
  }
  if (result) {
    info['result.hidden'] = result.hidden;
    info['result display'] = window.getComputedStyle(result).display;
  }
  if (typeof globalThis !== 'undefined' && globalThis.__FE_DEBUG_VALUE_STREAM) {
    console.log('[价值流按钮调试]', info);
  }
  return info;
}

/** BASIC_INFO_FIELDS、BMC_FIELDS、LABEL_TO_PATH 已移至 js/config.js */
/** buildPageStructureForLLM、renderBasicInfo、renderBMC、renderMetadata、buildDetailHTML 已移至 js/rendering.js */

function showLoading(show) {
  if (el.loading) el.loading.hidden = !show;
  if (el.btnQuery) el.btnQuery.disabled = show;
}

function showError(message) {
  if (!el.error) return;
  el.error.textContent = message;
  el.error.hidden = !message;
}

function showResult(show) {
  if (!el.result) return;
  el.result.hidden = !show;
  if (el.valueStreamSection) el.valueStreamSection.hidden = true;
  if (show && typeof globalThis !== 'undefined' && globalThis.__FE_DEBUG_VALUE_STREAM) {
    debugValueStreamButton?.();
  }
}

/** formatValue 已移至 js/utils.js */
/** escapeHtml、renderMarkdown 已移至 js/utils.js */

/** 从大模型回复中解析结构化修改建议，返回 { position, modification, reason, positionKey, newValue } 或 null */
function parseModificationResponse(text) {
  if (!text || typeof text !== 'string') return null;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]).trim() : text;
  try {
    const obj = JSON.parse(jsonStr);
    if (obj && (obj.position || obj.modification || obj.reason)) {
      const parsed = {
        position: obj.position || '—',
        modification: obj.modification || obj.newValue || '—',
        reason: obj.reason || '—',
        positionKey: obj.positionKey || obj.position,
        newValue: obj.newValue,
      };
      if (obj.isValueStream) {
        parsed.isValueStream = true;
        parsed.operation = (obj.operation || 'update').toLowerCase();
        parsed.valueStreamName = obj.valueStreamName || obj.value_stream_name || '';
        parsed.nodeName = obj.nodeName || obj.node_name || '';
        parsed.insertAfterStepName = obj.insertAfterStepName || obj.insert_after_step_name || '';
        parsed.valueStreamIndex = obj.valueStreamIndex != null ? obj.valueStreamIndex : obj.value_stream_index;
      }
      return parsed;
    }
  } catch (_) {}
  const posMatch = text.match(/修改位置[：:]\s*([^\n]+)/);
  const modMatch = text.match(/修改意见[：:]\s*([^\n]+)/);
  const reasonMatch = text.match(/修改原因[：:]\s*([^\n]+)/);
  if (posMatch || modMatch || reasonMatch) {
    return {
      position: (posMatch && posMatch[1].trim()) || '—',
      modification: (modMatch && modMatch[1].trim()) || '—',
      reason: (reasonMatch && reasonMatch[1].trim()) || '—',
      positionKey: (posMatch && posMatch[1].trim()) || null,
      newValue: null,
    };
  }
  return null;
}

/** 判断两个修改位置是否相同（同一修改目标） */
function isSameModificationPosition(pos1, pos2) {
  if (!pos1 || !pos2) return false;
  const p1 = typeof pos1 === 'object' ? pos1 : null;
  const p2 = typeof pos2 === 'object' ? pos2 : null;
  if (p1?.isValueStream && p2?.isValueStream) {
    const n1 = (p1.valueStreamName || '').trim();
    const n2 = (p2.valueStreamName || '').trim();
    const node1 = (p1.nodeName || '').trim();
    const node2 = (p2.nodeName || '').trim();
    return n1 === n2 && node1 === node2;
  }
  const s1 = typeof pos1 === 'object' ? (pos1.positionKey || pos1.position) : pos1;
  const s2 = typeof pos2 === 'object' ? (pos2.positionKey || pos2.position) : pos2;
  const path1 = getPathForPosition(s1);
  const path2 = getPathForPosition(s2);
  if (!path1 || !path2) return String(s1).trim() === String(s2).trim();
  return path1.section === path2.section && path1.key === path2.key;
}

/** 根据 position 获取 record 中对应的路径 { section, key } */
function getPathForPosition(pos) {
  const p = String(pos).trim();
  const path = LABEL_TO_PATH.get(p);
  if (path) return path;
  for (const [label, path] of LABEL_TO_PATH) {
    if (p.includes(label) || label.includes(p)) return path;
  }
  return null;
}

/** 获取修改前的当前值 */
function getCurrentValueForPosition(record, parsed) {
  if (!record || !parsed) return '';
  if (parsed.isValueStream) {
    const vsList = record.valueStreams || [];
    const vsName = (parsed.valueStreamName || '').trim();
    const nodeName = (parsed.nodeName || '').trim();
    for (const vs of vsList) {
      const name = formatValue(vs.name ?? vs.title ?? vs.value_stream_name) || '';
      if (!vsName || name === vsName) {
        const { stages } = parseValueStreamGraph(vs);
        for (const stage of stages) {
          if (stage.name === nodeName) return stage.name;
          for (const step of stage.steps || []) {
            if (step.name === nodeName) return step.desc || step.name || '';
          }
        }
      }
    }
    return '';
  }
  const path = getPathForPosition(parsed.positionKey || parsed.position);
  if (!path) return '';
  const section = record[path.section];
  if (!section || !(path.key in section)) return '';
  return formatValue(section[path.key]) || '';
}

/** 根据 position 匹配并应用修改到 record */
function applyModification(record, parsed) {
  if (!record || !parsed) return false;
  const newVal = parsed.newValue != null ? String(parsed.newValue) : parsed.modification;

  if (parsed.isValueStream) {
    const vsList = record.valueStreams || [];
    const vsName = (parsed.valueStreamName || '').trim();
    const nodeName = (parsed.nodeName || '').trim();
    const vsIndex = parsed.valueStreamIndex;
    const op = (parsed.operation || 'update').toLowerCase();

    for (let vi = 0; vi < vsList.length; vi++) {
      const vs = vsList[vi];
      const name = formatValue(vs.name ?? vs.title ?? vs.value_stream_name) || '';
      const nameMatch = !vsName || name === vsName || name.includes(vsName) || vsName.includes(name);
      if (!nameMatch || (vsIndex != null && vi !== vsIndex)) continue;

      let rawStages = vs.stages ?? vs.phases ?? vs.nodes ?? vs.value_stream?.stages ?? vs.data?.stages;
      if (!Array.isArray(rawStages)) rawStages = vs.stages = [];
      if (!vs.stages && (vs.phases || vs.nodes)) rawStages = vs.phases ?? vs.nodes;

      const getStageNameForMatch = (s) => {
        const raw = s.name ?? s.title ?? s.stage_name ?? s.phase_name ?? s.label ?? s.node_name ?? '';
        let n = extractPureStageName(raw) || formatValue(raw);
        const splitFn = typeof globalThis.splitStageTitleAndParenthetical === 'function' ? globalThis.splitStageTitleAndParenthetical : null;
        if (splitFn) {
          const sp = splitFn(n);
          if (sp && sp.hint) n = sp.title;
        }
        return n;
      };

      if (op === 'addstage') {
        const newStage = { name: newVal, steps: [] };
        if (nodeName) {
          const insertIdx = rawStages.findIndex((s) => s && getStageNameForMatch(s) === nodeName);
          if (insertIdx >= 0) rawStages.splice(insertIdx + 1, 0, newStage);
          else rawStages.push(newStage);
        } else {
          rawStages.push(newStage);
        }
        return true;
      }

      if (op === 'addstep') {
        const insertAfterStep = (parsed.insertAfterStepName || parsed.insert_after_step_name || '').trim();
        const STEP_KEYS = ['steps', 'phases', 'items', 'nodes', 'children'];
        const getStepsArray = (stage) => {
          for (const k of STEP_KEYS) {
            const arr = stage[k];
            if (Array.isArray(arr)) return { arr, key: k };
          }
          stage.steps = Array.isArray(stage.steps) ? stage.steps : [];
          return { arr: stage.steps, key: 'steps' };
        };
        const getStepNameForMatch = (st) => {
          const raw = formatValue(st.name ?? st.title ?? st.step_name ?? st.phase_name ?? st.label ?? st.node_name ?? '');
          const m = raw.match(/^(.+?)\s*\([^)]*\)$/);
          return m ? m[1].trim() : raw;
        };
        for (const s of rawStages) {
          if (!s) continue;
          const stageName = getStageNameForMatch(s);
          if (stageName !== nodeName && !stageName.includes(nodeName) && !nodeName.includes(stageName)) continue;
          const { arr: rawSteps } = getStepsArray(s);
          const parts = newVal.split(/\n/);
          const stepName = parts[0]?.trim() || newVal;
          const stepDesc = parts.slice(1).join('\n').trim() || '';
          const newStep = {
            name: stepName,
            step_name: stepName,
            title: stepName,
            description: stepDesc,
            desc: stepDesc,
            content: stepDesc,
          };
          if (insertAfterStep) {
            const idx = rawSteps.findIndex((st) => st && getStepNameForMatch(st) === insertAfterStep);
            if (idx >= 0) rawSteps.splice(idx + 1, 0, newStep);
            else rawSteps.push(newStep);
          } else {
            rawSteps.push(newStep);
          }
          return true;
        }
        return false;
      }

      for (const s of rawStages) {
        if (!s) continue;
        const stageName = getStageNameForMatch(s);
        if (stageName === nodeName) {
          s.name = s.title = s.stage_name = s.phase_name = s.label = s.node_name = newVal;
          return true;
        }
        const rawSteps = s.steps ?? s.phases ?? s.items ?? s.nodes ?? s.children ?? [];
        if (!Array.isArray(rawSteps)) continue;
        for (const st of rawSteps) {
          if (!st) continue;
          const stepName = formatValue(st.name ?? st.title ?? st.step_name ?? st.phase_name ?? st.label ?? st.node_name ?? '');
          if (stepName === nodeName) {
            if (st.description != null || st.desc != null || st.content != null) {
              st.description = st.desc = st.content = newVal;
            } else {
              st.name = st.title = st.step_name = st.phase_name = st.label = st.node_name = newVal;
            }
            return true;
          }
        }
      }
    }
    return false;
  }

  const pos = String(parsed.positionKey || parsed.position).trim();
  const path = getPathForPosition(pos);
  if (path) {
    const section = record[path.section];
    if (section && path.key in section) {
      section[path.key] = newVal;
      return true;
    }
  }
  return false;
}

/** 根据修改位置或 parsed 找到详情页中对应的 DOM 元素 */
function findModificationTarget(positionOrParsed) {
  if (!el.detailResult) return null;
  const parsed = positionOrParsed && typeof positionOrParsed === 'object' ? positionOrParsed : null;
  const position = parsed ? (parsed.positionKey || parsed.position) : String(positionOrParsed || '').trim();

  if (parsed?.isValueStream) {
    const vsName = (parsed.valueStreamName || '').trim();
    const nodeName = (parsed.nodeName || '').trim();
    const vsIndex = parsed.valueStreamIndex;
    const cards = el.detailResult.querySelectorAll('.vs-card');
    let card = null;
    for (const c of cards) {
      const cName = (c.dataset.vsName || '').trim();
      const cIdx = parseInt(c.dataset.vsIndex ?? c.dataset.index, 10);
      if ((vsName && cName === vsName) || (vsIndex != null && cIdx === vsIndex)) {
        card = c;
        break;
      }
    }
    if (!card) return null;
    if (!nodeName) return card;
    const body = card.querySelector('.vs-card-body');
    const viewPanel = body?.querySelector('.vs-tab-panel-view');
    if (!viewPanel || viewPanel.dataset.rendered !== 'true') return card;
    const stageEl = viewPanel.querySelector(`[data-vs-stage-name="${nodeName}"]`);
    if (stageEl) return stageEl;
    const stepEl = viewPanel.querySelector(`[data-vs-step-name="${nodeName}"]`);
    if (stepEl) return stepEl;
    const allNames = viewPanel.querySelectorAll('[data-vs-stage-name], [data-vs-step-name]');
    for (const n of allNames) {
      const name = n.dataset.vsStageName || n.dataset.vsStepName || '';
      if (name === nodeName || name.includes(nodeName) || nodeName.includes(name)) return n;
    }
    return card;
  }

  if (!position) return null;
  const direct = el.detailResult.querySelector(`[data-modify-target="${position}"]`);
  if (direct) return direct;
  for (const [label] of LABEL_TO_PATH) {
    if (position.includes(label) || position === label) {
      const elx = el.detailResult.querySelector(`[data-modify-target="${label}"]`);
      if (elx) return elx;
    }
  }
  return null;
}

/** 清除当前高亮 */
function clearModificationHighlight() {
  el.detailResult?.querySelectorAll('.modify-target-highlight').forEach((el) => el.classList.remove('modify-target-highlight'));
}

/** 滚动到目标元素并居中，添加红色闪动高亮。价值流修改时会先展开卡片并渲染 view */
function scrollToTargetAndHighlight(positionOrParsed) {
  clearModificationHighlight();
  const parsed = positionOrParsed && typeof positionOrParsed === 'object' ? positionOrParsed : { position: positionOrParsed };
  let target = findModificationTarget(positionOrParsed);
  if (!target || !el.detailContent) return;

  if (parsed.isValueStream) {
    const card = target.closest('.vs-card') || (target.classList.contains('vs-card') ? target : null);
    if (card) {
      const header = card.querySelector('.vs-card-header');
      const body = card.querySelector('.vs-card-body');
      if (header && body && body.hidden) {
        header.click();
        header.setAttribute('aria-expanded', 'true');
        body.hidden = false;
        const viewPanel = body.querySelector('.vs-tab-panel-view');
        if (viewPanel && viewPanel.dataset.rendered !== 'true') {
          const idx = parseInt(card.dataset.index ?? card.dataset.vsIndex, 10);
          const item = (currentDetailRecord?.valueStreams || [])[idx];
          if (item) {
            viewPanel.innerHTML = renderValueStreamViewHTML(item);
            viewPanel.dataset.rendered = 'true';
            target = findModificationTarget(positionOrParsed);
          }
        }
      }
    }
  }

  if (target) {
    target.classList.add('modify-target-highlight');
    target.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' });
  }
}

/** extractPureStageName、extractStepNameAndDesc、parseValueStreamGraph、renderValueStreamViewHTML、renderEndToEndFlowHTML、getValueStreamList、currentValueStreamList、renderValueStreamList 已移至 js/valueStream.js */

async function loadValueStreamList() {
  if (!lastQueriedCompanyName) return;
  el.btnValueStreamList.disabled = true;
  el.valueStreamSection.hidden = false;
  el.valueStreamContent.innerHTML = '<p class="vs-empty">加载中…</p>';

  try {
    const res = await fetch(VALUE_STREAM_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: lastQueriedCompanyName }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      el.valueStreamContent.innerHTML = '<p class="vs-empty">加载失败：' + escapeHtml(json.error || res.status) + '</p>';
      return;
    }

    const data = json.data !== undefined ? json.data : json;
    const list = getValueStreamList(data);
    renderValueStreamList(list);
  } catch (err) {
    el.valueStreamContent.innerHTML = '<p class="vs-empty">请求异常：' + escapeHtml(err.message || String(err)) + '</p>';
  } finally {
    el.btnValueStreamList.disabled = false;
  }
}

async function query() {
  if (!el.companyName) return;
  const companyName = (el.companyName.value || '').trim();
  if (!companyName) {
    showError('请输入企业名称');
    return;
  }

  showError('');
  showResult(false);
  showLoading(true);

  const target = (API_URL || '').replace(/\/$/, '') || window.location.origin;

  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = json.error || `请求失败 (${res.status})`;
      showError(msg);
      showLoading(false);
      return;
    }

    if (!json.success || !json.data) {
      showError(json.error || '返回数据格式异常');
      showLoading(false);
      return;
    }

    const { basic_info, business_model_canvas, metadata } = json.data;
    lastQueriedCompanyName = (basic_info && basic_info.company_name) || companyName;
    lastQueryResult = { basic_info, business_model_canvas, metadata };
    renderBasicInfo(basic_info);
    renderBMC(business_model_canvas);
    renderMetadata(metadata);
    el.valueStreamSection.hidden = true;
    el.valueStreamContent.innerHTML = '';
    showResult(true);
  } catch (err) {
    const message = err.message || String(err);
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      showError(
        '连接被拒绝：当前没有程序在 ' + target + ' 监听。\n\n' +
        '请先启动后端 API 服务（例如在 API 项目目录运行 deno 启动命令），并确保 main.js 顶部的 API_URL 与后端地址、端口一致。'
      );
    } else {
      showError('请求异常：' + message);
    }
  } finally {
    showLoading(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof globalThis !== 'undefined' && globalThis.__FE_DEBUG_VALUE_STREAM) {
    debugValueStreamButton();
  }
  // 在线模式下，problem-cases 通过 storage-http-adapter 异步拉取；
  // main.js 初始化时第一次渲染可能拿不到数据，因此需要在后端加载完成后重渲染。
  window.addEventListener('storageBackendReady', () => {
    try {
      if (window.APP_CONFIG && window.APP_CONFIG.MODE === 'online') {
        try {
          const url = new URL(window.location.href);
          const caseIdFromUrl = url.searchParams.get('caseId') || '';
          const chatKey = __appState.currentProblemDetailItem?.createdAt || '';
          const chatsMap = typeof getProblemDetailChats === 'function' ? getProblemDetailChats() : null;
          const storedChatLen = chatKey && chatsMap ? (chatsMap[chatKey]?.length ?? 0) : 0;
          console.debug('[FE:http-hydration]', {
            phase: 'storageBackendReady-handler',
            __STORAGE_HTTP_HYDRATED: window.__STORAGE_HTTP_HYDRATED,
            caseId: caseIdFromUrl || (__appState.currentProblemDetailItem?.id ?? __appState.currentProblemDetailItem?.createdAt ?? ''),
            chatKey,
            storedChatLen,
          });
        } catch (_) {}
      }
      refreshProblemDetailChatIfOpen();
      ensureTask1StartNotificationIfPending('storageBackendReady');
    } catch (err) {
      console.warn('[storageBackendReady] 详情聊天刷新失败:', err);
    }
  });
  /* local + IndexedDB 首次渲染可能为空，待真实数据回填后重刷详情聊天 */
  window.addEventListener('storageIndexedDbReady', () => {
    try {
      refreshProblemDetailChatIfOpen();
    } catch (err) {
      console.warn('[storageIndexedDbReady] 刷新详情聊天失败:', err);
    }
  });
  const routeRestored = restoreRouteState();
  void routeRestored;
  // 当前 index 无「价值流列表」按钮（旧版查询区已下线）；存在时再绑定，缺失时不告警以免每次首屏误报
  if (el.btnValueStreamList) {
    el.btnValueStreamList.addEventListener('click', loadValueStreamList);
  }
  window.addEventListener('popstate', handleAppPopState);
  updateProblemCaseImportExportUiState();
});

function updateSearchSuggestions() {
  const input = (el.companyName?.value || '').trim();
  const container = el.searchSuggestions;
  if (!container) return;
  if (!input) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  const list = getSavedAnalyses();
  const lower = input.toLowerCase();
  const matches = list.filter((r) => {
    const name = (r.companyName || '').trim();
    return name && name.toLowerCase().includes(lower);
  });
  if (matches.length === 0) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  container.innerHTML = matches
    .map(
      (r) =>
        `<div class="search-suggestion-item" role="button" tabindex="0">${escapeHtml(r.companyName || '未命名')}</div>`
    )
    .join('');
  container.hidden = false;
  container.querySelectorAll('.search-suggestion-item').forEach((node, i) => {
    node.addEventListener('click', () => selectSuggestion(matches[i]));
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectSuggestion(matches[i]);
      }
    });
  });
}

function selectSuggestion(record) {
  if (!record) return;
  el.searchSuggestions.hidden = true;
  el.searchSuggestions.innerHTML = '';
  el.companyName.value = record.companyName || '';
  openDetail(record);
}

/** getSavedAnalyses、saveAnalysis 已移至 js/storage.js */

function saveCurrent() {
  if (!lastQueryResult) {
    showError('请先查询企业信息');
    return;
  }
  const companyName = (lastQueryResult.basic_info?.company_name || lastQueriedCompanyName || '').trim();
  if (!companyName) {
    showError('无法获取企业名称');
    return;
  }
  const record = {
    companyName,
    basicInfo: lastQueryResult.basic_info,
    bmc: lastQueryResult.business_model_canvas,
    metadata: lastQueryResult.metadata,
    valueStreams: [...(currentValueStreamList || [])],
    storedAt: new Date().toISOString(),
  };
  saveAnalysis(record);
  showError('');
  alert('已存储成功');
}

/** saveRouteState 已移至 js/storage.js */

/** 从 URL 移除 `caseId`，避免首页仍残留深链参数 */
function clearUrlCaseIdParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('caseId')) return;
    url.searchParams.delete('caseId');
    window.history.replaceState({ appView: 'home' }, '', url.pathname + url.search + url.hash);
  } catch (_) {}
}

function createProblemDetailStubFromCaseId(caseId) {
  const id = caseId == null ? '' : String(caseId);
  return {
    id,
    createdAt: id,
    currentMajorStage: 0,
    completedStages: [],
    completedTaskIds: [],
    workflowAlignCompletedStages: [],
    itGapCompletedStages: [],
    basicInfo: null,
    bmc: null,
    requirementLogic: null,
    valueStream: null,
    e2eFlowLandscapeJson: null,
    e2eTransactionFlowJson: null,
    globalItGapAnalysisJson: null,
    localItGapSessions: [],
    localItGapAnalyses: [],
    rolePermissionSessions: [],
    coreBusinessObjectSessions: [],
    coreBusinessObjectSystemPromptOverride: null,
  };
}

function clearProblemCaseSessionKeys() {
  // 高亮键读写见 `js/core/problem-follow-shared.js`；清空须与 bridge 同源，避免 sessionStorage 字面量漂移
  try {
    setProblemFollowHighlightedCaseKey('');
  } catch (_) {}
  try {
    sessionStorage.removeItem(ROUTE_STORAGE_KEY);
  } catch (_) {}
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && String(k).startsWith('problemDetailScroll_')) sessionStorage.removeItem(k);
    }
  } catch (_) {}
}

function resetProblemCaseCurrentState() {
  lastModificationClarification = null;
  __appState.currentProblemDetailItem = null;

  problemDetailViewingMajorStage = 0;
  itStrategyPlanViewingSubstep = 0;
  itGapViewingSubstep = 0;
  problemDetailConfirmedBasicInfo = null;

  __appState.problemDetailChatMessages = [];
  __appState.problemDetailChatMessagesCaseKey = null;
  currentProblemDetailTaskSummaries = [];
  problemDetailRemoteSyncSeq = 0;

  problemDetailChatMode = 'agent';
  __appState.chatHistory = [];

  currentModificationTask = null;
  problemDetailWaitingForFeedback = null;
  try {
    Object.keys(task6PainPointPromptOverrideByCaseKey).forEach((k) => delete task6PainPointPromptOverrideByCaseKey[k]);
    Object.keys(task5ItStatusPromptOverrideByCaseKey).forEach((k) => delete task5ItStatusPromptOverrideByCaseKey[k]);
    Object.keys(task5ModAwaitingAutoStripByCaseKey).forEach((k) => delete task5ModAwaitingAutoStripByCaseKey[k]);
  } catch (_) {}

  if (el.problemDetailContent) el.problemDetailContent.innerHTML = '';
  if (el.problemDetailChatMessages) el.problemDetailChatMessages.innerHTML = '';
  if (el.problemDetailHistoryContent) el.problemDetailHistoryContent.innerHTML = '';
}

function handleProblemCaseAccessDenied(caseId, status) {
  const msg = '案例不存在或无权访问';
  showError(msg);
  clearUrlCaseIdParam();
  clearProblemCaseSessionKeys();
  resetProblemCaseCurrentState();
  try {
    window.location.replace(new URL('home.html', window.location.href).href);
  } catch (_) {
    window.location.href = new URL('home.html', window.location.href).href;
  }
}

function clearProblemCaseCachesAndUiStateOnLogout() {
  // 仅 online 的在线案例内存 cache 需要跨账号清理
  try {
    const mode = window.APP_CONFIG && window.APP_CONFIG.MODE ? window.APP_CONFIG.MODE : '';
    if (String(mode) === 'online') {
      const adapter = globalThis.STORAGE_HTTP_ADAPTER;
      if (adapter && typeof adapter.clearProblemDetailCaches === 'function') adapter.clearProblemDetailCaches();
    }
  } catch (_) {}

  clearProblemCaseSessionKeys();
  resetProblemCaseCurrentState();
}

/**
 * 根据 URL 中的 caseId 打开 ProblemDetail。
 * 供 restoreRouteState、浏览器 history 前进/后退（popstate）共用。
 */
function openProblemDetailByCaseId(caseId) {
  if (!caseId) return false;
  const list = getDigitalProblems();
  const item = (Array.isArray(list) ? list : []).find((p) => String(p?.id ?? p?.createdAt) === String(caseId));
  if (item) {
    openProblemDetail(item);
    return true;
  }
  // 列表可能不包含该 case（后端 404/无权不返回）；直接 stub 打开，交由后端 bundle 决裁
  openProblemDetail(createProblemDetailStubFromCaseId(caseId));
  return true;
}

/** 浏览器前进/后退时按 URL 同步首页 / 问题详情（与 pushState 闭环） */
function handleAppPopState() {
  try {
    const url = new URL(window.location.href);
    const caseId = url.searchParams.get('caseId');
    if (!caseId) {
      saveRouteState('home');
      window.location.href = new URL('home.html', window.location.href).href;
      return;
    }
    if (openProblemDetailByCaseId(caseId)) return;
    clearUrlCaseIdParam();
    saveRouteState('home');
    try {
      window.location.href = new URL('home.html', window.location.href).href;
    } catch (_) {}
  } catch (_) {}
}

function restoreRouteState() {
  try {
    const getUrlCaseId = () => {
      try {
        const url = new URL(window.location.href);
        return url.searchParams.get('caseId');
      } catch {
        return null;
      }
    };

    // URL 优先：刷新/深链恢复优先采用 `?caseId=...`
    const urlCaseId = getUrlCaseId();
    if (urlCaseId) {
      if (openProblemDetailByCaseId(urlCaseId)) return true;
      // 兜底：后端数据尚未加载完成时轮询；仍无法打开则清理 stale caseId，避免停在首页但 URL 仍带 caseId
      const pending = urlCaseId;
      let pollStarted = false;
      switchView('problemDetail');
      const startPolling = () => {
        if (pollStarted) return;
        pollStarted = true;
        let n = 0;
        const timer = setInterval(() => {
          n += 1;
          if (openProblemDetailByCaseId(pending)) {
            clearInterval(timer);
            return;
          }
          if (n >= 35) {
            clearInterval(timer);
            clearUrlCaseIdParam();
            window.location.replace(new URL('home.html', window.location.href).href);
          }
        }, 100);
      };
      window.addEventListener('storageBackendReady', startPolling, { once: true });
      setTimeout(startPolling, 0);
      return true;
    }

    const raw = sessionStorage.getItem(ROUTE_STORAGE_KEY);
    if (!raw) return false;
    const { view, params } = JSON.parse(raw);
    if (view === 'problemDetail' && (params.caseId || params.createdAt)) {
      const list = getDigitalProblems();
      const key = params.caseId || params.createdAt;
      const item = list.find((p) => String(p?.id ?? p?.createdAt) === String(key));
      if (item) {
        openProblemDetail(item);
        return true;
      }
    }
    if (view === 'taskTracking' && params.createdAt) {
      const list = getDigitalProblems();
      const item = list.find((p) => String(p.createdAt) === String(params.createdAt));
      if (item) {
        openTaskTracking(item);
        return true;
      }
    }
    if (view === 'detail' && params.companyName) {
      const list = getSavedAnalyses();
      const record = list.find((r) => (r.companyName || '').trim() === (params.companyName || '').trim());
      if (record) {
        openDetail(record);
        return true;
      }
    }
    // legacy 首页壳已移除：会话态「回首页」与默认回落统一进入 home.html
    try {
      window.location.replace(new URL('home.html', window.location.href).href);
    } catch (_) {
      window.location.href = new URL('home.html', window.location.href).href;
    }
    return true;
  } catch (_) {}
  return false;
}

/** switchView、renderSavedList、toggleChatPanel、toggleHistoryPanel、toggleProblemDetailHistory 已移至 js/navigation.js */

function renderModificationHistory() {
  if (!el.historyContent) return;
  const record = currentDetailRecord;
  const history = record?.modificationHistory || [];
  const companyName = record?.companyName || '当前企业';
  const titleEl = el.historyPanel?.querySelector('.history-panel-title');
  if (titleEl) titleEl.textContent = `${companyName} - 修改历史`;
  el.historyContent.innerHTML = history.length === 0
    ? `<p class="history-empty">暂无修改历史</p><p class="history-subtitle">${escapeHtml(companyName)}</p>`
    : `<p class="history-subtitle">${escapeHtml(companyName)}</p>
       <div class="history-timeline">
         ${history
           .map(
             (item) => `
           <div class="history-item">
             <div class="history-item-dot"></div>
             <div class="history-item-content">
               <div class="history-item-meta">${escapeHtml(formatHistoryTime(item.timestamp))}</div>
               <div class="history-item-row"><span class="history-label">修改位置</span>${escapeHtml(item.position || '—')}</div>
               <div class="history-item-row"><span class="history-label">修改前</span>${escapeHtml(item.beforeValue ?? '—')}</div>
               <div class="history-item-row"><span class="history-label">修改意见</span>${escapeHtml(item.modification || '—')}</div>
               <div class="history-item-row"><span class="history-label">修改后</span>${escapeHtml(item.afterValue ?? item.modification ?? '—')}</div>
               <div class="history-item-row"><span class="history-label">修改原因</span>${escapeHtml(item.reason || '—')}</div>
             </div>
           </div>`
           )
           .join('')}
       </div>`;
}
if (typeof window !== 'undefined') window.renderModificationHistory = renderModificationHistory;

/** formatHistoryTime、formatChatTime 已移至 js/utils.js */

/** 从 parsed 获取价值流索引 */
function getValueStreamIndexFromParsed(parsed) {
  if (!parsed?.isValueStream) return null;
  if (parsed.valueStreamIndex != null && parsed.valueStreamIndex >= 0) return parsed.valueStreamIndex;
  const vsName = (parsed.valueStreamName || '').trim();
  if (!vsName || !currentDetailRecord) return null;
  const list = currentDetailRecord.valueStreams || [];
  for (let i = 0; i < list.length; i++) {
    const name = formatValue(list[i].name ?? list[i].title ?? list[i].value_stream_name) || '';
    if (name === vsName || name.includes(vsName) || vsName.includes(name)) return i;
  }
  return null;
}

/**
 * 展开并刷新指定价值流卡片的 view 和 json
 */
function expandAndRefreshValueStreamCard(vsIndex) {
  if (!el.detailResult || !currentDetailRecord) return;
  const valueStreams = currentDetailRecord.valueStreams || [];
  const item = valueStreams[vsIndex];
  if (!item) return;
  const card = el.detailResult.querySelector(`.vs-card[data-index="${vsIndex}"]`);
  if (!card) return;
  const header = card.querySelector('.vs-card-header');
  const body = card.querySelector('.vs-card-body');
  const viewPanel = card.querySelector('.vs-tab-panel-view');
  const jsonPanel = card.querySelector('.vs-tab-panel-json');
  body.hidden = false;
  header.setAttribute('aria-expanded', 'true');
  card.classList.add('vs-card-expanded');
  if (viewPanel) {
    viewPanel.innerHTML = renderValueStreamViewHTML(item);
    viewPanel.dataset.rendered = 'true';
  }
  if (jsonPanel) {
    const pre = jsonPanel.querySelector('.vs-json');
    if (pre) pre.textContent = JSON.stringify(item, null, 2);
  }
}

function setupDetailValueStreamEvents() {
  if (!el.detailResult) return;
  currentValueStreamList.length = 0;
  (currentDetailRecord?.valueStreams || []).forEach((x) => currentValueStreamList.push(x));
  el.detailResult.querySelectorAll('.vs-card-header').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.vs-card');
      const body = card.querySelector('.vs-card-body');
      const expanded = body.hidden;
      body.hidden = !expanded;
      btn.setAttribute('aria-expanded', String(!expanded));
      card.classList.toggle('vs-card-expanded', !expanded);
      if (expanded) {
        const viewPanel = card.querySelector('.vs-tab-panel-view');
        if (viewPanel && viewPanel.dataset.rendered !== 'true') {
          const idx = parseInt(card.dataset.index, 10);
          const item = currentValueStreamList[idx];
          if (item) {
            viewPanel.innerHTML = renderValueStreamViewHTML(item);
            viewPanel.dataset.rendered = 'true';
          }
        }
      }
    });
  });
  el.detailResult.querySelectorAll('.vs-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = tab.closest('.vs-card');
      const targetTab = tab.dataset.tab;
      card.querySelectorAll('.vs-tab').forEach((t) => t.classList.remove('vs-tab-active'));
      card.querySelectorAll('.vs-tab-panel').forEach((p) => { p.hidden = p.dataset.panel !== targetTab; });
      tab.classList.add('vs-tab-active');
      if (targetTab === 'view') {
        const viewPanel = card.querySelector('.vs-tab-panel-view');
        if (viewPanel) {
          const idx = parseInt(card.dataset.index, 10);
          const item = currentValueStreamList[idx];
          if (item) {
            viewPanel.innerHTML = renderValueStreamViewHTML(item);
            viewPanel.dataset.rendered = 'true';
          }
        }
      }
    });
  });

  setupVsJsonEditEvents();
}

function setupVsJsonEditEvents() {
  if (!el.detailResult) return;
  el.detailResult.querySelectorAll('.vs-json-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => enterVsJsonEditMode(btn.closest('.vs-card')));
  });
  el.detailResult.querySelectorAll('.vs-json-undo-btn').forEach((btn) => {
    btn.addEventListener('click', () => undoVsJsonEdit(btn.closest('.vs-card')));
  });
  el.detailResult.querySelectorAll('.vs-json-save-btn').forEach((btn) => {
    btn.addEventListener('click', () => saveVsJsonEdit(btn.closest('.vs-card')));
  });
  el.detailResult.querySelectorAll('.vs-json-cancel-btn').forEach((btn) => {
    btn.addEventListener('click', () => exitVsJsonEditMode(btn.closest('.vs-card')));
  });
}

const vsJsonEditState = new WeakMap();

function enterVsJsonEditMode(card) {
  if (!card || !currentDetailRecord) return;
  const idx = parseInt(card.dataset.index, 10);
  const item = currentDetailRecord.valueStreams?.[idx];
  if (!item) return;
  const jsonPanel = card.querySelector('.vs-tab-panel-json');
  const pre = jsonPanel?.querySelector('.vs-json');
  const textarea = jsonPanel?.querySelector('.vs-json-edit');
  const editBtn = jsonPanel?.querySelector('.vs-json-edit-btn');
  const editActions = jsonPanel?.querySelector('.vs-json-edit-actions');
  const errorEl = jsonPanel?.querySelector('.vs-json-error');
  if (!pre || !textarea || !editBtn || !editActions) return;
  const content = JSON.stringify(item, null, 2);
  textarea.value = content;
  vsJsonEditState.set(card, { undoStack: [], lastPushed: content });
  if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
  pre.hidden = true;
  textarea.hidden = false;
  editBtn.hidden = true;
  editActions.hidden = false;
  editActions.querySelector('.vs-json-undo-btn').hidden = true;
  textarea.focus();
  let debounceTimer;
  const onInput = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const state = vsJsonEditState.get(card);
      if (state && state.lastPushed !== textarea.value) {
        state.undoStack.push(state.lastPushed);
        state.lastPushed = textarea.value;
        editActions.querySelector('.vs-json-undo-btn').hidden = state.undoStack.length === 0;
      }
    }, 300);
  };
  textarea.addEventListener('input', onInput);
  textarea._vsJsonCleanup?.();
  textarea._vsJsonCleanup = () => {
    textarea.removeEventListener('input', onInput);
    clearTimeout(debounceTimer);
    delete textarea._vsJsonCleanup;
  };
}

function undoVsJsonEdit(card) {
  const state = vsJsonEditState.get(card);
  const jsonPanel = card?.querySelector('.vs-tab-panel-json');
  const textarea = jsonPanel?.querySelector('.vs-json-edit');
  const errorEl = jsonPanel?.querySelector('.vs-json-error');
  const undoBtn = jsonPanel?.querySelector('.vs-json-undo-btn');
  if (!textarea || !state || state.undoStack.length === 0) return;
  const prev = state.undoStack.pop();
  textarea.value = prev;
  state.lastPushed = prev;
  if (undoBtn) undoBtn.hidden = state.undoStack.length === 0;
  if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
}

function saveVsJsonEdit(card) {
  if (!card || !currentDetailRecord) return;
  const idx = parseInt(card.dataset.index, 10);
  const jsonPanel = card.querySelector('.vs-tab-panel-json');
  const textarea = jsonPanel?.querySelector('.vs-json-edit');
  const errorEl = jsonPanel?.querySelector('.vs-json-error');
  if (!textarea) return;
  let parsed;
  try {
    parsed = JSON.parse(textarea.value);
  } catch (e) {
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = 'JSON 格式错误：' + (e.message || '无法解析');
    }
    return;
  }
  if (!parsed || typeof parsed !== 'object') {
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = 'JSON 必须为对象';
    }
    return;
  }
  if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
  textarea._vsJsonCleanup?.();
  vsJsonEditState.delete(card);
  currentDetailRecord.valueStreams[idx] = parsed;
  saveAnalysis(currentDetailRecord);
  const viewPanel = card.querySelector('.vs-tab-panel-view');
  if (viewPanel) {
    viewPanel.innerHTML = renderValueStreamViewHTML(parsed);
    viewPanel.dataset.rendered = 'true';
  }
  const pre = jsonPanel.querySelector('.vs-json');
  pre.textContent = JSON.stringify(parsed, null, 2);
  pre.hidden = false;
  textarea.hidden = true;
  jsonPanel.querySelector('.vs-json-edit-btn').hidden = false;
  jsonPanel.querySelector('.vs-json-edit-actions').hidden = true;
  delete textarea.dataset.undoContent;
}

function exitVsJsonEditMode(card) {
  if (!card || !currentDetailRecord) return;
  const idx = parseInt(card.dataset.index, 10);
  const item = currentDetailRecord.valueStreams?.[idx];
  if (!item) return;
  const jsonPanel = card.querySelector('.vs-tab-panel-json');
  const pre = jsonPanel?.querySelector('.vs-json');
  const textarea = jsonPanel?.querySelector('.vs-json-edit');
  const errorEl = jsonPanel?.querySelector('.vs-json-error');
  if (!pre || !textarea) return;
  textarea._vsJsonCleanup?.();
  vsJsonEditState.delete(card);
  pre.textContent = JSON.stringify(item, null, 2);
  pre.hidden = false;
  textarea.hidden = true;
  if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
  jsonPanel.querySelector('.vs-json-edit-btn').hidden = false;
  jsonPanel.querySelector('.vs-json-edit-actions').hidden = true;
}

function openDetail(record) {
  if (!record) return;
  saveChatToRecord();
  toggleChatPanel(false);
  toggleHistoryPanel(false);
  currentModificationTask = null;
  currentDetailCompanyName = record.companyName || '';
  currentDetailRecord = record;
  __appState.chatHistory = record.chatHistory ? [...record.chatHistory] : [];
  record.chatHistory = __appState.chatHistory;
  el.detailTitle.textContent = record.companyName || '客户详情';
  el.detailResult.innerHTML = buildDetailHTML(record);
  saveRouteState('detail', { companyName: record.companyName });
  switchView('detail');
  setupDetailValueStreamEvents();
  renderChatMessagesFromHistory();
}
if (typeof window !== 'undefined') window.openDetail = openDetail;

function renderChatMessagesFromHistory() {
  if (!el.chatMessages) return;
  el.chatMessages.innerHTML = '';
  __appState.chatHistory.forEach((msg) => {
    const timeStr = formatChatTime(msg.timestamp);
    if (msg.role === 'user') {
      appendChatBlock(el.chatMessages, 'user', msg.content, timeStr);
    } else {
      const parsed = parseModificationResponse(msg.content);
      if (parsed) {
        appendModificationBlockReadOnly(el.chatMessages, parsed, timeStr);
      } else {
        appendChatBlock(el.chatMessages, 'assistant', msg.content, timeStr);
      }
    }
  });
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function saveChatToRecord() {
  if (currentDetailRecord) {
    currentDetailRecord.chatHistory = [...__appState.chatHistory];
    saveAnalysis(currentDetailRecord);
  }
}

if (el.btnQuery) el.btnQuery.addEventListener('click', query);
if (el.companyName) {
  el.companyName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') query();
  });
  el.companyName.addEventListener('input', updateSearchSuggestions);
  el.companyName.addEventListener('focus', updateSearchSuggestions);
  el.companyName.addEventListener('blur', () => {
    setTimeout(() => {
      if (el.searchSuggestions) el.searchSuggestions.hidden = true;
    }, 150);
  });
}
if (el.btnSave) el.btnSave.addEventListener('click', saveCurrent);
if (el.btnProblemCasePresalesReport) {
  el.btnProblemCasePresalesReport.addEventListener('click', () => {
    const caseId = typeof getCurrentProblemCaseIdForBackend === 'function' ? getCurrentProblemCaseIdForBackend() : '';
    openPresalesReportPageForCaseId(caseId);
  });
}
if (el.btnProblemCaseExport) {
  el.btnProblemCaseExport.addEventListener('click', () => {
    exportCurrentProblemCasePackage();
  });
}
if (el.btnProblemCaseRestore && el.problemCaseRestoreInput) {
  el.btnProblemCaseRestore.addEventListener('click', () => {
    if (!isOnlineMode()) {
      showError('恢复档案仅支持 online 模式（需配置 BACKEND_API_URL 并登录）。');
      return;
    }
    if (!__appState.currentProblemDetailItem) {
      showError('请先打开档案详情后再恢复。');
      return;
    }
    el.problemCaseRestoreInput.click();
  });
  el.problemCaseRestoreInput.addEventListener('change', () => {
    const f = el.problemCaseRestoreInput.files && el.problemCaseRestoreInput.files[0];
    el.problemCaseRestoreInput.value = '';
    if (f) importProblemCaseRestorePackageFile(f);
  });
}

if (el.btnProblemDetailBack) {
  el.btnProblemDetailBack.addEventListener('click', () => {
    const st = window.history.state;
    if (st && st.appView === 'problemDetail' && st.pushed === true) {
      window.history.back();
      return;
    }
    saveRouteState('home');
    clearUrlCaseIdParam();
    window.location.href = new URL('home.html', window.location.href).href;
  });
}
if (el.btnProblemDetailReset) {
  el.btnProblemDetailReset.addEventListener('click', () => {
    const item = __appState.currentProblemDetailItem;
    const persistKey =
      typeof getDigitalProblemPersistKey === 'function'
        ? String(getDigitalProblemPersistKey(item) || '').trim()
        : '';
    if (!item || !persistKey) return;
    if (
      !confirm(
        '确定重置本案例？将回到「企业背景洞察」待执行：清空聊天记录、工作区产出、沟通历史侧栏时间线相关数据（档案号与客户名称保留）。',
      )
    ) {
      return;
    }
    const preliminaryChats = [];
    const resetItem =
      typeof resetDigitalProblemToPreliminary === 'function' ? resetDigitalProblemToPreliminary(persistKey) : null;
    if (!resetItem) return;
    const listAfter = typeof getDigitalProblems === 'function' ? getDigitalProblems() : [];
    const synced =
      listAfter.find((p) =>
        (item.id && p.id && String(p.id) === String(item.id)) ||
        String(p.createdAt || '') === String(persistKey) ||
        String(p.id || '') === String(persistKey) ||
        (item.id && String(p.createdAt) === String(item.id)) ||
        (p.id && String(p.createdAt) === String(item.id)),
      ) || null;
    const merged = synced || resetItem;
    // 与列表合并结果可能仍含 null：强制空态便于 task1 工作区与工商卡回到「待填写 / 待确认」
    __appState.currentProblemDetailItem = {
      ...merged,
      basicInfo: undefined,
      preliminaryReq: undefined,
      task1InitialLlmQuery: undefined,
      task1PendingPreliminaryRequirement: false,
    };
    try {
      clearTask1InitialLlmQueryPersistedForItem(merged);
    } catch (_) {}
    const chatCaseKey =
      typeof getProblemDetailChatStorageKey === 'function' ? String(getProblemDetailChatStorageKey(merged) || '').trim() : '';
    try {
      globalThis.SmartCto?.flowExceptionRecord?.clearFlowException?.(chatCaseKey || persistKey);
    } catch (_) {}
    problemDetailConfirmedBasicInfo = null;
    problemDetailViewingMajorStage = 0;
    itGapViewingSubstep = 0;
    itStrategyPlanViewingSubstep = 0;
    try {
      const ckFollow = typeof getProblemFollowCaseKey === 'function' ? getProblemFollowCaseKey(merged) : '';
      if (ckFollow && typeof persistItStrategyPlanSubstepForCaseKey === 'function') {
        persistItStrategyPlanSubstepForCaseKey(ckFollow, 0);
      }
    } catch (_) {}
    currentProblemDetailTaskSummaries = [];
    problemDetailWaitingForFeedback = null;
    lastModificationClarification = null;
    __appState.problemDetailChatMessages = preliminaryChats;
    __appState.problemDetailChatMessagesCaseKey = chatCaseKey || persistKey || null;
    const g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};
    if (typeof g.saveProblemDetailChatLocalStorageMulticast === 'function') {
      g.saveProblemDetailChatLocalStorageMulticast(merged, preliminaryChats);
    }
    if (typeof saveProblemDetailChat === 'function') {
      saveProblemDetailChat(chatCaseKey || persistKey, preliminaryChats);
    }
    updateProblemDetailProgressStages(0, 0);
    renderProblemDetailContent();
    const container = el.problemDetailChatMessages;
    if (container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    }
    renderProblemDetailHistory();
    updateProblemDetailChatHeaderLabel();
    try {
      if (typeof updateFlowExceptionResumeButtonVisibility === 'function') updateFlowExceptionResumeButtonVisibility();
    } catch (_) {}
  });
}
if (el.btnTaskTrackingBack) {
  el.btnTaskTrackingBack.addEventListener('click', () => {
    saveRouteState('home');
    window.location.href = new URL('home.html', window.location.href).href;
  });
}
if (el.btnTaskTrackingEnter) {
  el.btnTaskTrackingEnter.addEventListener('click', () => {
    if (__appState.currentProblemDetailItem) openProblemDetail(__appState.currentProblemDetailItem);
  });
}
/** 打开回退任务选择弹窗：列出从 task1 到（当前第一个未完成任务的前一任务），用户选择后回退到该任务并清空该任务及之后的数据 */
function openRollbackTaskModal() {
  const item = __appState.currentProblemDetailItem;
  if (!item?.createdAt || !el.rollbackModalOverlay || !el.rollbackModalTaskList) return;
  const allTasks = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...IT_STRATEGY_TASKS];
  const first = getFirstUncompletedTask(item);
  if (!first || first.id === 'task1') {
    alert('已在最早任务，无法回退');
    return;
  }
  const firstIdx = allTasks.findIndex((t) => t.id === first.id);
  const options = firstIdx <= 0 ? [] : allTasks.slice(0, firstIdx);
  el.rollbackModalTaskList.innerHTML = '';
  options.forEach((task) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rollback-modal-option';
    btn.setAttribute('data-task-id', task.id);
    btn.textContent = task.name;
    el.rollbackModalTaskList.appendChild(btn);
  });
  el.rollbackModalOverlay.classList.add('rollback-modal-open');
  el.rollbackModalOverlay.setAttribute('aria-hidden', 'false');
}

function closeRollbackTaskModal() {
  const root = el.rollbackModalOverlay;
  if (!root) return;
  const ae = typeof document !== 'undefined' ? document.activeElement : null;
  if (ae && root.contains(ae) && typeof ae.blur === 'function') {
    ae.blur();
  }
  if (el.btnProblemDetailRollback && typeof el.btnProblemDetailRollback.focus === 'function') {
    try {
      el.btnProblemDetailRollback.focus({ preventScroll: true });
    } catch (_) {
      el.btnProblemDetailRollback.focus();
    }
  }
  root.classList.remove('rollback-modal-open');
  root.setAttribute('aria-hidden', 'true');
}

/**
 * 回退到 targetTaskId 后同步会话态：当前查看大阶段与子步骤对齐目标环节（待执行）、清空修改等待态与任务追踪摘要，使工作区/聊天/沟通历史与截断后的数据一致。
 * 须在 `__appState.currentProblemDetailItem` 与（本地路径下）`__appState.problemDetailChatMessages` 已更新为回退结果之后调用。
 * 在线 bundle 若仍带大于回退目标的 currentMajorStage，会误将步骤条/viewing 留在 task9、且 isTaskCompleted(task1) 因 major>0 判真（FE-20260415-rollback-view）。
 */
function syncProblemDetailSessionAfterRollback(targetTaskId) {
  if (!targetTaskId) return;
  let item = __appState.currentProblemDetailItem;
  const itemPersist = getDigitalProblemPersistKey(item);
  if (!item || !itemPersist) return;
  const targetMajor = Math.max(0, Math.min(3, getMajorStageByTaskId(targetTaskId)));
  const persisted = Number(item.currentMajorStage);
  if (Number.isFinite(persisted) && persisted > targetMajor) {
    logTaskPhaseNotificationDebug('rollbackSync:clampItemMajor', {
      targetTaskId,
      persistedMajor: persisted,
      targetMajor,
      caseKey: itemPersist,
    });
    item = { ...item, currentMajorStage: targetMajor };
    __appState.currentProblemDetailItem = item;
  }
  const major = Math.max(0, Math.min(3, Number(item.currentMajorStage ?? targetMajor) || targetMajor));
  problemDetailViewingMajorStage = major;
  updateProblemDetailProgressStages(major, major);

  if (major === 2) {
    const igMap = { task7: 0, task8: 1, task9: 2 };
    itGapViewingSubstep =
      igMap[targetTaskId] !== undefined ? igMap[targetTaskId] : getItGapDefaultViewingSubstep(item);
  } else {
    itGapViewingSubstep = 0;
  }

  const caseKey = typeof getProblemFollowCaseKey === 'function' ? getProblemFollowCaseKey(item) : '';
  if (major === 3) {
    const substepMap = { task12: 0, task13: 1, task14: 2, task15: 3 };
    const si = substepMap[targetTaskId];
    itStrategyPlanViewingSubstep = si !== undefined ? si : 0;
    if (caseKey) persistItStrategyPlanSubstepForCaseKey(caseKey, itStrategyPlanViewingSubstep);
  } else {
    itStrategyPlanViewingSubstep = 0;
    if (caseKey) persistItStrategyPlanSubstepForCaseKey(caseKey, 0);
  }

  problemDetailWaitingForFeedback = null;
  lastModificationClarification = null;
  problemDetailConfirmedBasicInfo = __appState.currentProblemDetailItem.basicInfo || null;

  currentProblemDetailTaskSummaries = [];

  if (typeof getTaskTrackingData === 'function' && typeof saveTaskTrackingData === 'function') {
    saveTaskTrackingData(itemPersist, {});
  }
}

/**
 * 「重启当前任务」后同步会话态：对齐当前查看大阶段与 ITGap/IT 策略子步骤、清空修改等待与澄清态、剔除该任务在任务追踪与在线 task summaries 缓存中的条目，使沟通历史与截断后的聊天/工作区一致（不回滚后续任务）。
 * viewing 与 `item.currentMajorStage` 取 max(持久化, 任务所属大阶段)，避免 `??` 在 major=0 时不回落到 task7→2（FE-20260328-31）。
 */
function syncProblemDetailSessionAfterRestartCurrent(taskId) {
  if (!taskId) return;
  const item = __appState.currentProblemDetailItem;
  if (!item?.createdAt) return;

  problemDetailWaitingForFeedback = null;
  lastModificationClarification = null;
  problemDetailConfirmedBasicInfo = item.basicInfo || null;

  const taskMajor = getMajorStageByTaskId(taskId);
  const p = Number(item.currentMajorStage);
  const persisted = Number.isFinite(p) && p >= 0 && p <= 3 ? p : taskMajor;
  const major = Math.max(0, Math.min(3, Math.max(persisted, taskMajor)));
  logRestartCurrent('sync:after-restart', { taskId, taskMajor, persistedItemMajor: item.currentMajorStage, chosenMajor: major });
  problemDetailViewingMajorStage = major;
  updateProblemDetailProgressStages(major, major);

  if (major === 2) {
    const igMap = { task7: 0, task8: 1, task9: 2 };
    itGapViewingSubstep =
      igMap[taskId] !== undefined ? igMap[taskId] : getItGapDefaultViewingSubstep(item);
  } else {
    itGapViewingSubstep = 0;
  }

  const caseKey = typeof getProblemFollowCaseKey === 'function' ? getProblemFollowCaseKey(item) : '';
  if (major === 3) {
    const substepMap = { task12: 0, task13: 1, task14: 2, task15: 3 };
    const si = substepMap[taskId];
    itStrategyPlanViewingSubstep = si !== undefined ? si : 0;
    if (caseKey) persistItStrategyPlanSubstepForCaseKey(caseKey, itStrategyPlanViewingSubstep);
  } else {
    itStrategyPlanViewingSubstep = 0;
    if (caseKey) persistItStrategyPlanSubstepForCaseKey(caseKey, 0);
  }

  const createdAt = item.createdAt;
  if (createdAt && typeof getTaskTrackingData === 'function' && typeof saveTaskTrackingData === 'function') {
    const all = getTaskTrackingData();
    const prev = all[createdAt] && typeof all[createdAt] === 'object' ? { ...all[createdAt] } : {};
    delete prev[taskId];
    saveTaskTrackingData(createdAt, prev);
  }

  if (Array.isArray(currentProblemDetailTaskSummaries)) {
    currentProblemDetailTaskSummaries = currentProblemDetailTaskSummaries.filter((s) => {
      const raw = s?.taskId;
      if (raw == null || raw === '') return true;
      return mapRollbackCtxTaskId(raw) !== mapRollbackCtxTaskId(taskId);
    });
  }

  const httpAdapter = typeof globalThis !== 'undefined' ? globalThis.STORAGE_HTTP_ADAPTER : null;
  if (httpAdapter && typeof httpAdapter.removeTaskSummaryEntriesForRestart === 'function') {
    httpAdapter.removeTaskSummaryEntriesForRestart(createdAt, taskId);
  }
}

function applyRollbackToTask(targetTaskId) {
  const item = __appState.currentProblemDetailItem;
  if (!item?.createdAt || !targetTaskId) return;

  const caseId = getCurrentProblemCaseIdForBackend();
  const backendTaskId = mapProblemTaskIdToBackendTaskId(targetTaskId);

  // 在线模式：直调后端 rollback 并刷新首屏 bundle，避免本地回退状态机逻辑
  if (isOnlineMode() && caseId && backendTaskId) {
    void (async () => {
      const t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      if (typeof console !== 'undefined' && console.info) {
        console.info('[problem-detail][rollback] request', {
          targetTaskId,
          backendTaskId,
          caseId,
          createdAt: item.createdAt,
          customerName: item.customerName,
        });
      }
      try {
        await postProblemCaseTaskAction(caseId, backendTaskId, 'rollback', {
          content: '用户选择回退任务',
          timestamp: new Date().toISOString(),
        });
        const t1 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        if (typeof console !== 'undefined' && console.info) {
          console.info('[problem-detail][rollback] api ok, refreshing bundle', {
            caseId,
            backendTaskId,
            elapsedMs: Math.round(t1 - t0),
          });
        }
        await refreshProblemDetailBundleFromBackend(caseId, { skipShowNextTaskStartNotification: true });
        const t2 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        if (typeof console !== 'undefined' && console.info) {
          console.info('[problem-detail][rollback] done', {
            caseId,
            backendTaskId,
            bundleElapsedMs: Math.round(t2 - t1),
            totalElapsedMs: Math.round(t2 - t0),
          });
        }
        syncProblemDetailSessionAfterRollback(targetTaskId);
        renderProblemDetailContent();
        renderProblemDetailHistory();
        updateProblemDetailChatHeaderLabel();
        if (!ensureTask4RefreshNotificationIfNeeded()) {
          showNextTaskStartNotificationIfCurrentTaskPendingOnly();
        }
        ensureTask1StartNotificationIfPending('rollbackBundle');
      } catch (err) {
        const tErr = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[problem-detail][rollback] failed', {
            targetTaskId,
            backendTaskId,
            caseId,
            createdAt: item.createdAt,
            elapsedMs: Math.round(tErr - t0),
            message: err && err.message ? String(err.message) : String(err),
            err,
          });
        }
      }
    })();
    return;
  }

  const updated = buildItemAfterRollbackToTaskId(item, targetTaskId);
  if (typeof restoreItemFromSnapshot === 'function') restoreItemFromSnapshot(item.createdAt, updated);
  // 以当前聊天框中的消息为源，删除「选定任务及以后」的所有聊天记录，再写回并刷新
  const isCurrentProblem = String(item.createdAt) === String(__appState.currentProblemDetailItem?.createdAt);
  const chats = isCurrentProblem && Array.isArray(__appState.problemDetailChatMessages)
    ? __appState.problemDetailChatMessages
    : (typeof getProblemDetailChats === 'function' ? (getProblemDetailChats()[item.createdAt] || []) : []);
  const filteredChats = filterChatMessagesAfterRollback(Array.isArray(chats) ? chats : [], targetTaskId);
  if (typeof saveProblemDetailChat === 'function') saveProblemDetailChat(item.createdAt, filteredChats);
  __appState.problemDetailChatMessages = filteredChats;
  __appState.problemDetailChatMessagesCaseKey =
    typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) || null : item.createdAt || null;
  const list = getDigitalProblems();
  const fromStorage = list.find((p) => String(p.createdAt) === String(item.createdAt));
  const finalItem = fromStorage || updated;
  __appState.currentProblemDetailItem = finalItem;
  if (typeof updateDigitalProblemMajorStage === 'function') {
    const targetStage = finalItem.currentMajorStage ?? getMajorStageByTaskId(targetTaskId);
    updateDigitalProblemMajorStage(item.createdAt, targetStage);
  }
  syncProblemDetailSessionAfterRollback(targetTaskId);
  renderProblemDetailContent();
  const container = el.problemDetailChatMessages;
  if (container) {
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
  }
  updateProblemDetailChatHeaderLabel();
  renderProblemDetailHistory();
}

/** 仅在显式设 `globalThis.__FE_RESTART_DEBUG = true` 时输出重启链路调试日志。 */
function logRestartCurrent(tag, payload) {
  try {
    if (typeof globalThis === 'undefined' || globalThis.__FE_RESTART_DEBUG !== true) return;
    if (typeof console !== 'undefined' && typeof console.info === 'function') {
      console.info('[FE:restart-current]', tag, payload === undefined ? '' : payload);
    }
  } catch (_) {}
}

/**
 * 重新开始当前任务：清空当前任务已形成的聊天、工作区、沟通历史数据，不改变当前任务设置，并推送当前任务启动通知。
 * FE-20260412：在线案仅有 `id`、无 `createdAt` 时须用 `getDigitalProblemPersistKey` / `getProblemDetailChatStorageKey`，避免误判后静默无响应。
 */
function applyRestartCurrentTask() {
  const item = __appState.currentProblemDetailItem;
  const persistKey = typeof getDigitalProblemPersistKey === 'function' ? getDigitalProblemPersistKey(item) : '';
  const chatKey =
    typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : persistKey;
  if (!persistKey) {
    logRestartCurrent('apply:abort', { reason: 'no-persist-key' });
    if (typeof alert === 'function') alert('当前案例标识缺失，无法重启任务');
    return;
  }
  const list = getDigitalProblems();
  const dataItem =
    (typeof getDigitalProblemPersistKey === 'function'
      ? list.find((p) => getDigitalProblemPersistKey(p) === persistKey)
      : list.find((p) => String(p.createdAt) === String(item.createdAt))) || item;
  const taskId = resolveCurrentTaskIdForRestartActions(dataItem);
  logRestartCurrent('apply:entry', {
    persistKey,
    chatKey: chatKey || persistKey,
    createdAt: item.createdAt,
    archiveNo: item.archiveNo ?? null,
    id: item.id ?? null,
    dataItemMajor: dataItem?.currentMajorStage ?? null,
    detailItemMajor: item?.currentMajorStage ?? null,
    resolvedTaskId: taskId,
    viewingBefore: problemDetailViewingMajorStage,
    itGapSubBefore: itGapViewingSubstep,
  });
  if (!taskId) {
    if (typeof alert === 'function') alert('当前没有可重启的任务（所有任务已完成）');
    logRestartCurrent('apply:abort', { reason: 'no-resolved-taskId' });
    return;
  }
  const curPersist =
    typeof getDigitalProblemPersistKey === 'function'
      ? getDigitalProblemPersistKey(__appState.currentProblemDetailItem)
      : '';
  const isCurrentProblem = !!persistKey && curPersist === persistKey;
  const chats = isCurrentProblem && Array.isArray(__appState.problemDetailChatMessages)
    ? __appState.problemDetailChatMessages
    : typeof getProblemDetailChats === 'function'
      ? getProblemDetailChats()[chatKey] || getProblemDetailChats()[persistKey] || []
      : [];

  let updated = buildItemClearCurrentTaskOnly(dataItem, taskId);
  let filteredChats = filterChatMessagesRemoveTask(Array.isArray(chats) ? chats : [], taskId);
  if (taskId === 'task2') {
    filteredChats = (Array.isArray(filteredChats) ? filteredChats : []).filter((m) => {
      if (!m) return false;
      const t = m.type || '';
      if (t === 'task2LlmQueryBlock') return false;
      if (t === 'bmcCard' || t === 'bmcStartBlock') return false;
      if (t === 'bmcDiscussionStartBlock' || t === 'bmcDiscussionReplyBlock' || t === 'bmcDiscussionLlmQueryBlock' || t === 'bmcDiscussionEndBlock') return false;
      if ((t === 'taskCompleteBlock' || t === 'taskCompletionConfirmBlock') && m.taskId === 'task2') return false;
      if (t === 'taskStartNotification' && m.taskId === 'task2') return false;
      if (m.role === 'system' && typeof m.content === 'string' && m.content.includes('商业模式画布 BMC')) return false;
      if (m.role === 'system' && typeof m.content === 'string' && m.content.trim() === '请描述您想讨论的问题（输入后发送）') return false;
      if (m.role === 'user' && m._logType === 'bmcDiscussionUser') return false;
      return true;
    });
  }
  if (taskId === 'task1') {
    // task1「重启当前」口径：企业背景洞察产物（初步需求/历史详情）应清空，回到待收基础信息与需求输入的空态。
    updated = {
      ...updated,
      preliminaryReq: undefined,
      requirementDetail: '',
      requirementDetailHistory: [],
      task1PendingPreliminaryRequirement: false,
      task1InitialLlmQuery: undefined,
    };
    filteredChats = [];
    clearTask1InitialLlmQueryPersistedForItem(item);
    if (typeof globalThis.saveProblemDetailChatLocalStorageMulticast === 'function') {
      globalThis.saveProblemDetailChatLocalStorageMulticast(dataItem, filteredChats);
    }
    // 企业背景洞察重启后，不应允许继续使用旧异常快照恢复。
    const caseKeyForException = chatKey || persistKey;
    globalThis.SmartCto?.flowExceptionRecord?.clearFlowException?.(caseKeyForException);
  }

  if (typeof restoreItemFromSnapshot === 'function') restoreItemFromSnapshot(persistKey, updated);
  if (typeof saveProblemDetailChat === 'function') saveProblemDetailChat(chatKey || persistKey, filteredChats);
  __appState.problemDetailChatMessages = filteredChats;
  __appState.problemDetailChatMessagesCaseKey = chatKey || persistKey || null;
  const fromStorage =
    typeof getDigitalProblemPersistKey === 'function'
      ? getDigitalProblems().find((p) => getDigitalProblemPersistKey(p) === persistKey)
      : getDigitalProblems().find((p) => String(p.createdAt) === String(item.createdAt));
  // 列表缓存可能与本次 computed `updated` 不同步；必须用 updated 字段覆盖，禁止 `fromStorage || updated` 整对象替换丢掉已修正的 currentMajorStage / 清空字段（FE-20260328-31）
  __appState.currentProblemDetailItem = fromStorage ? { ...fromStorage, ...updated } : updated;
  logRestartCurrent('apply:after-merge', {
    mergedMajor: __appState.currentProblemDetailItem?.currentMajorStage ?? null,
    updatedMajor: updated?.currentMajorStage ?? null,
    fromListHadRow: !!fromStorage,
    chatLen: Array.isArray(filteredChats) ? filteredChats.length : 0,
  });
  syncProblemDetailSessionAfterRestartCurrent(taskId);
  logRestartCurrent('apply:after-sync', {
    viewing: problemDetailViewingMajorStage,
    itGapSub: itGapViewingSubstep,
    itStrategySub: itStrategyPlanViewingSubstep,
  });
  renderProblemDetailContent();
  updateFlowExceptionResumeButtonVisibility();
  const container = el.problemDetailChatMessages;
  if (container) {
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
  }
  updateProblemDetailChatHeaderLabel();
  renderProblemDetailHistory();
  showNextTaskStartNotificationIfCurrentTaskPendingOnly();
  logRestartCurrent('apply:done', { taskId });
}


if (el.navUserInfo && typeof getUsername === 'function') {
  const username = getUsername();
  el.navUserInfo.textContent = username ? '用户：' + username : '';
}
if (el.btnLogout) {
  el.btnLogout.addEventListener('click', async () => {
    try {
      if (typeof postLogoutToBackend === 'function') {
        await postLogoutToBackend();
      }
    } catch (_) {}
    try {
      if (typeof clearProblemCaseCachesAndUiStateOnLogout === 'function') clearProblemCaseCachesAndUiStateOnLogout();
    } catch (_) {}
    if (typeof clearAuth === 'function') clearAuth();
    window.location.href = 'login.html';
  });
}
if (el.btnHome) el.btnHome.addEventListener('click', () => {
  saveChatToRecord();
  saveRouteState('home');
  window.location.href = new URL('home.html', window.location.href).href;
  if (el.searchSuggestions) { el.searchSuggestions.hidden = true; el.searchSuggestions.innerHTML = ''; }
});
if (el.btnModelConfig) el.btnModelConfig.addEventListener('click', () => {
  saveChatToRecord();
  const redirect = window.location.pathname + window.location.search + window.location.hash;
  const next =
    globalThis.AUTH_RUNTIME?.buildModelConfigUrl?.(redirect) ||
    ('model-config.html?redirect=' + encodeURIComponent(redirect));
  window.location.href = next;
});
if (el.btnChat) el.btnChat.addEventListener('click', () => toggleChatPanel(true));
if (el.btnCloseChat) el.btnCloseChat.addEventListener('click', () => toggleChatPanel(false));
if (el.btnHistory) el.btnHistory.addEventListener('click', () => toggleHistoryPanel(true));
if (el.btnCloseHistory) el.btnCloseHistory.addEventListener('click', () => toggleHistoryPanel(false));
if (el.chatSend) el.chatSend.addEventListener('click', sendChatMessage);
if (el.chatInput) el.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

if (el.detailResult) {
  el.detailResult.addEventListener('click', (e) => {
    if (e.target.closest('.btn-basic-info-json')) {
      openBasicInfoJsonPanel();
    } else if (e.target.closest('.btn-bmc-json')) {
      openBmcJsonPanel();
    }
  });
}
if (el.btnCloseBasicInfoJson) {
  el.btnCloseBasicInfoJson.addEventListener('click', closeBasicInfoJsonPanel);
}
if (el.btnCopyBasicInfoJson) {
  el.btnCopyBasicInfoJson.addEventListener('click', copyBasicInfoJson);
}
if (el.btnCloseBmcJson) {
  el.btnCloseBmcJson.addEventListener('click', closeBmcJsonPanel);
}
if (el.btnCopyBmcJson) {
  el.btnCopyBmcJson.addEventListener('click', copyBmcJson);
}

function openBasicInfoJsonPanel() {
  if (!currentDetailRecord || !el.basicInfoJsonPanel || !el.basicInfoJsonContent) return;
  const basicInfo = currentDetailRecord.basicInfo || {};
  const jsonStr = JSON.stringify(basicInfo, null, 2);
  el.basicInfoJsonContent.textContent = jsonStr;
  el.basicInfoJsonPanel.classList.add('basic-info-json-panel-open');
  document.querySelector('.detail-body')?.classList.add('basic-info-json-panel-open');
}

function closeBasicInfoJsonPanel() {
  el.basicInfoJsonPanel?.classList.remove('basic-info-json-panel-open');
  document.querySelector('.detail-body')?.classList.remove('basic-info-json-panel-open');
}

function copyBasicInfoJson() {
  const text = el.basicInfoJsonContent?.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = el.btnCopyBasicInfoJson;
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }
  }).catch(() => {
    alert('复制失败');
  });
}

function openBmcJsonPanel() {
  if (!currentDetailRecord || !el.bmcJsonPanel || !el.bmcJsonContent) return;
  const bmc = currentDetailRecord.bmc || {};
  const jsonStr = JSON.stringify(bmc, null, 2);
  el.bmcJsonContent.textContent = jsonStr;
  el.bmcJsonPanel.classList.add('bmc-json-panel-open');
  const body = document.querySelector('.detail-body');
  if (body) body.classList.add('bmc-json-panel-open');
}

function closeBmcJsonPanel() {
  el.bmcJsonPanel?.classList.remove('bmc-json-panel-open');
  document.querySelector('.detail-body')?.classList.remove('bmc-json-panel-open');
}

function copyBmcJson() {
  const text = el.bmcJsonContent?.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = el.btnCopyBmcJson;
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }
  }).catch(() => {
    alert('复制失败');
  });
}

/** getTimeStr 已移至 js/utils.js */

function appendChatBlock(container, role, content, timeStr) {
  const block = document.createElement('div');
  block.className = `chat-message chat-message-${role}`;
  block.innerHTML = `<div class="chat-message-content markdown-body">${renderMarkdown(content)}</div><div class="chat-message-time">${timeStr}</div>`;
  container.appendChild(block);
  container.scrollTop = container.scrollHeight;
  return block;
}

function buildModificationBlockRows(parsed) {
  if (parsed.isValueStream) {
    const opLabel = parsed.operation === 'addstage' ? '新增阶段' : parsed.operation === 'addstep' ? '新增环节' : '修改节点';
    return `
      <div class="chat-modification-row">
        <span class="chat-modification-label">操作类型</span>
        <span class="chat-modification-value">${escapeHtml(opLabel)}</span>
      </div>
      <div class="chat-modification-row">
        <span class="chat-modification-label">需要修改的价值流</span>
        <span class="chat-modification-value">${escapeHtml(parsed.valueStreamName || '—')}</span>
      </div>
      <div class="chat-modification-row">
        <span class="chat-modification-label">${parsed.operation === 'addstep' ? '所属阶段' : parsed.operation === 'addstage' ? '插入位置（前一阶段名）' : '需要修改的节点名称'}</span>
        <span class="chat-modification-value">${escapeHtml(parsed.nodeName || '—')}</span>
      </div>
      <div class="chat-modification-row">
        <span class="chat-modification-label">修改意见</span>
        <span class="chat-modification-value">${escapeHtml(parsed.modification)}</span>
      </div>
      <div class="chat-modification-row">
        <span class="chat-modification-label">修改原因</span>
        <span class="chat-modification-value">${escapeHtml(parsed.reason)}</span>
      </div>`;
  }
  return `
      <div class="chat-modification-row">
        <span class="chat-modification-label">修改位置</span>
        <span class="chat-modification-value">${escapeHtml(parsed.position)}</span>
      </div>
      <div class="chat-modification-row">
        <span class="chat-modification-label">修改意见</span>
        <span class="chat-modification-value">${escapeHtml(parsed.modification)}</span>
      </div>
      <div class="chat-modification-row">
        <span class="chat-modification-label">修改原因</span>
        <span class="chat-modification-value">${escapeHtml(parsed.reason)}</span>
      </div>`;
}

function appendModificationBlock(container, parsed, timeStr, onConfirm, onCancel, onRetry) {
  const block = document.createElement('div');
  block.className = 'chat-message chat-message-assistant chat-message-modification';
  block.innerHTML = `
    <div class="chat-modification-body">
      ${buildModificationBlockRows(parsed)}
      <div class="chat-modification-actions">
        <button type="button" class="btn-confirm-mod">确认</button>
        <button type="button" class="btn-retry-mod">重来</button>
        <button type="button" class="btn-cancel-mod">放弃</button>
      </div>
    </div>
    <div class="chat-message-time">${timeStr}</div>
  `;
  container.appendChild(block);
  container.scrollTop = container.scrollHeight;
  block.querySelector('.btn-confirm-mod')?.addEventListener('click', () => {
    block.querySelector('.chat-modification-actions').innerHTML = '<span class="mod-status">已确认</span>';
    currentModificationTask = null;
    onConfirm?.();
  });
  block.querySelector('.btn-retry-mod')?.addEventListener('click', () => {
    block.querySelector('.chat-modification-actions').innerHTML = '<span class="mod-status">正在重新分析...</span>';
    onRetry?.(block);
  });
  block.querySelector('.btn-cancel-mod')?.addEventListener('click', () => {
    currentModificationTask = null;
    onCancel?.(block);
  });
  currentModificationTask = { parsed, block };
  return block;
}

/**
 * 将新的价值流修改内容整合到当前任务中。若新内容与旧内容有冲突，则以新内容为准。
 * 仅当当前任务为价值流修改时使用。
 */
function mergeValueStreamModification(currentParsed, newParsed) {
  if (!currentParsed?.isValueStream) return newParsed || currentParsed;
  if (!newParsed) return currentParsed;
  return {
    ...currentParsed,
    ...newParsed,
    isValueStream: true,
    operation: (newParsed.operation || currentParsed.operation || 'update').toLowerCase(),
    valueStreamName: (newParsed.valueStreamName || currentParsed.valueStreamName || '').trim() || currentParsed.valueStreamName,
    nodeName: (newParsed.nodeName || currentParsed.nodeName || '').trim() || currentParsed.nodeName,
    insertAfterStepName: (newParsed.insertAfterStepName ?? currentParsed.insertAfterStepName ?? '').trim() || currentParsed.insertAfterStepName,
    valueStreamIndex: newParsed.valueStreamIndex ?? currentParsed.valueStreamIndex,
    modification: newParsed.modification ?? currentParsed.modification,
    reason: newParsed.reason ?? currentParsed.reason,
    newValue: newParsed.newValue ?? currentParsed.newValue,
    position: newParsed.position || currentParsed.position,
    positionKey: newParsed.positionKey || currentParsed.positionKey || currentParsed.position,
  };
}

/** 就地更新修改块内容（用于同一任务内的修订） */
function updateModificationBlockContent(block, parsed) {
  if (!block || !parsed) return;
  const body = block.querySelector('.chat-modification-body');
  if (!body) return;
  const rows = body.querySelectorAll('.chat-modification-row');
  if (parsed.isValueStream && rows.length >= 5) {
    const opLabel = parsed.operation === 'addstage' ? '新增阶段' : parsed.operation === 'addstep' ? '新增环节' : '修改节点';
    const nodeLabel = parsed.operation === 'addstep' ? '所属阶段' : parsed.operation === 'addstage' ? '插入位置（前一阶段名）' : '需要修改的节点名称';
    rows[0].querySelector('.chat-modification-label').textContent = '操作类型';
    rows[0].querySelector('.chat-modification-value').textContent = opLabel;
    rows[1].querySelector('.chat-modification-value').textContent = parsed.valueStreamName || '—';
    rows[2].querySelector('.chat-modification-label').textContent = nodeLabel;
    rows[2].querySelector('.chat-modification-value').textContent = parsed.nodeName || '—';
    rows[3].querySelector('.chat-modification-value').textContent = parsed.modification || '—';
    rows[4].querySelector('.chat-modification-value').textContent = parsed.reason || '—';
  } else if (parsed.isValueStream && rows.length >= 4) {
    rows[0].querySelector('.chat-modification-value').textContent = parsed.valueStreamName || '—';
    rows[1].querySelector('.chat-modification-value').textContent = parsed.nodeName || '—';
    rows[2].querySelector('.chat-modification-value').textContent = parsed.modification || '—';
    rows[3].querySelector('.chat-modification-value').textContent = parsed.reason || '—';
  } else if (rows.length >= 3) {
    rows[0].querySelector('.chat-modification-value').textContent = parsed.position || '—';
    rows[1].querySelector('.chat-modification-value').textContent = parsed.modification || '—';
    rows[2].querySelector('.chat-modification-value').textContent = parsed.reason || '—';
  }
}

function appendModificationBlockReadOnly(container, parsed, timeStr) {
  const block = document.createElement('div');
  block.className = 'chat-message chat-message-assistant chat-message-modification chat-message-readonly';
  block.innerHTML = `
    <div class="chat-modification-body">
      ${buildModificationBlockRows(parsed)}
      <div class="chat-modification-actions readonly"><span class="mod-status">历史记录</span></div>
    </div>
    <div class="chat-message-time">${timeStr}</div>
  `;
  container.appendChild(block);
  container.scrollTop = container.scrollHeight;
  return block;
}

async function fetchModificationFromLLM() {
  const pageStructure = buildPageStructureForLLM(currentDetailRecord);
  const pendingVs = currentModificationTask?.parsed?.isValueStream
    ? `\n【重要】当前有一条未确认的价值流修改建议（${currentModificationTask.parsed.valueStreamName || ''} - ${currentModificationTask.parsed.nodeName || ''}）。用户发送的新内容应视为对该修改的补充，请将新内容整合到同一条修改建议中，若有冲突则以新内容为准，仍使用格式 B 回复。\n`
    : '';
  const systemContent = `你是企业信息与商业画布修改助手。当前用户正在查看「${currentDetailCompanyName || '某企业'}」的详情页。
${pendingVs}
【任务】当用户提出修改需求时，你需要：
1. 分析下方「当前页面详情结构」，判断用户要修改的是哪个位置的内容；
2. 提炼出：修改位置、修改意见（具体的修改点的总结）、修改原因、修改后的完整内容；
3. 用以下 JSON 格式回复（不要包含其他说明文字）：

当修改涉及【基本信息】或【商业画布】时，使用格式 A：
\`\`\`json
{
  "position": "精确的字段标签，如：客户细分、价值主张、企业名称 等",
  "modification": "具体的修改点的总结",
  "reason": "修改原因说明",
  "newValue": "修改后的完整新内容（必填）"
}
\`\`\`

当修改涉及【价值流】时，使用格式 B。必须根据操作类型填写 operation：
- update：修改现有节点/环节的内容，nodeName 为要修改的节点名称，newValue 为修改后的内容
- addStage：新增阶段节点，nodeName 为插入位置之前的阶段名（为空则追加到末尾），newValue 为新阶段名称
- addStep：在某个阶段内新增环节，nodeName 为所属阶段名称，newValue 为新环节名称（可含描述，用换行分隔）。若需在指定环节后插入，需填写 insertAfterStepName（前一环节名称））

\`\`\`json
{
  "isValueStream": true,
  "operation": "update|addStage|addStep",
  "valueStreamName": "需要修改的价值流名称（与页面中价值流名称一致）",
  "nodeName": "见上方各 operation 说明",
  "insertAfterStepName": "（仅 addStep 且需指定插入位置时）前一环节名称，如：审核方案",
  "position": "价值流-节点（如：xxx价值流-xxx阶段/环节）",
  "modification": "具体的修改意见",
  "reason": "修改原因说明",
  "newValue": "修改后的完整新内容 或 新增节点/环节的名称（必填）"
}
\`\`\`

【当前页面详情结构】
${pageStructure || '(无详情数据)'}`;

  const apiMessages = [
    { role: 'system', content: systemContent },
    ...__appState.chatHistory.map((m) => ({ role: m.role, content: m.content })),
  ];
  try {
    const { content } = await fetchDeepSeekChat(apiMessages);
    return content || '未收到有效回复。';
  } catch (e) {
    return '请求失败：' + (e.message || String(e));
  }
}

/** 初步需求提炼与展示逻辑已移至 js/preliminaryRequirement.js（parseDigitalProblemInput、renderParsePreview、getByPath、PRELIMINARY_LABEL_TO_KEY、buildPreliminaryCardRowsHtml、buildPreliminaryPreContent 等）。 */

/** 构建意图提炼的完整上下文：当前问题的沟通历史 + 页面内容结构，供大模型搜索匹配；返回 { context, currentTask } */
function buildIntentExtractionContext(createdAt, item) {
  const chats = getProblemDetailChats()[createdAt];
  const lines = [];
  lines.push('【沟通历史】');
  let currentTask = 'task1';
  if (Array.isArray(chats) && chats.length > 0) {
    for (const msg of chats) {
      const inferred = inferTaskIdFromMessage(msg);
      if (inferred) currentTask = inferred;
      if (msg.type === 'intentExtractionCard' && !msg.confirmed) continue;
      if (msg.type === 'modificationClarificationRequest') continue;
      const taskLabel = FOLLOW_TASKS.find((t) => t.id === currentTask)?.name || currentTask;
      if (msg.role === 'user') {
        lines.push(`[${taskLabel}] 用户: ${(msg.content || '').trim() || '(空)'}`);
      } else if (msg.type === 'basicInfoCard' && msg.confirmed && msg.data) {
        const fields = Object.keys(msg.data).filter((k) => msg.data[k] != null && String(msg.data[k]).trim());
        lines.push(`[${taskLabel}] 系统(已确认企业基本信息): 含字段 ${fields.join('、')}`);
      } else if (msg.type === 'bmcCard' && msg.confirmed && msg.data) {
        const fields = Object.keys(msg.data).filter((k) => msg.data[k] != null && String(msg.data[k]).trim());
        lines.push(`[${taskLabel}] 系统(已确认BMC): 含字段 ${fields.slice(0, 8).join('、')}${fields.length > 8 ? '...' : ''}`);
      } else if (msg.type === 'requirementLogicBlock' && msg.confirmed) {
        lines.push(`[${taskLabel}] 系统(已确认需求逻辑)`);
      } else if (msg.type === 'valueStreamCard' && msg.confirmed && msg.data) {
        const { stages } = parseValueStreamGraph(msg.data);
        const stageNames = stages.map((s) => s.name).filter(Boolean);
        const stepNames = stages.flatMap((s) => s.steps.map((st) => st.name).filter(Boolean));
        lines.push(`[${taskLabel}] 系统(已确认价值流): 阶段 ${stageNames.join('、')}；环节示例 ${stepNames.slice(0, 6).join('、')}${stepNames.length > 6 ? '...' : ''}`);
      } else if (msg.type === 'intentExtractionCard' && msg.confirmed && msg.data) {
        lines.push(`[${taskLabel}] 系统(意图已确认): ${(msg.data.summary || '').trim() || JSON.stringify(msg.data).slice(0, 80)}`);
      } else if (msg.role === 'system' && msg.content && (msg._taskId || msg.llmMeta)) {
        const snippet = (msg.content || '').trim().slice(0, 300);
        lines.push(`[${taskLabel}] 系统大模型: ${snippet}${(msg.content || '').length > 300 ? '…' : ''}`);
      }
    }
  } else {
    lines.push('(暂无历史记录)');
  }
  lines.push('');
  lines.push('【当前页面内容结构】（用于匹配定位，请从中搜索最为匹配的内容单元）');
  const BASIC_INFO_KEY_TO_LABEL = { company_name: '公司名称', credit_code: '信用代码', legal_representative: '法人', established_date: '成立时间', registered_capital: '注册资本', is_listed: '是否上市', listing_location: '上市地', business_scope: '经营范围', core_qualifications: '核心资质', official_website: '官方网站' };
  if (item) {
    const basicInfo = problemDetailConfirmedBasicInfo || item.basicInfo;
    if (basicInfo) {
      const labels = Object.keys(basicInfo)
        .filter((k) => basicInfo[k] != null && String(basicInfo[k]).trim())
        .map((k) => BASIC_INFO_KEY_TO_LABEL[k] || k);
      lines.push(`- 客户基本信息(task1): ${labels.join('、')}`);
    }
    if (item.bmc) {
      const bmc = item.bmc;
      const bmcLabels = BMC_FIELDS.filter((f) => bmc[f.key] != null && String(bmc[f.key]).trim()).map((f) => f.label);
      if (bmc.industry_insight) bmcLabels.unshift('行业背景洞察');
      if (bmc.pain_points) bmcLabels.push('业务痛点预判');
      lines.push(`- BMC(task2): ${bmcLabels.join('、')}`);
    }
    if (item.requirementLogic) {
      lines.push(`- 需求逻辑(task3): 行业底层逻辑与竞争共性、初步需求与商业模式的"因果关联"、需求背后的深层动机、逻辑链条总结`);
    }
    const vs = item.valueStream;
    if (vs && !vs.raw) {
      const { stages } = parseValueStreamGraph(vs);
      stages.forEach((s, i) => {
        const stepNames = (s.steps || []).map((st) => st.name).filter(Boolean);
        lines.push(`- 价值流(task4) 阶段${i + 1}「${s.name}」: 环节 ${stepNames.join('、') || '(无)'}`);
      });
    }
    const localSessions = item.localItGapSessions || [];
    const localStepNames = localSessions.length > 0
      ? localSessions.map((s) => s.stepName || `环节${(s.stepIndex ?? 0) + 1}`).filter(Boolean)
      : (vs && !vs.raw ? parseValueStreamGraph(vs).stages.flatMap((s) => (s.steps || []).map((st) => st.name).filter(Boolean)) : []);
    if (localStepNames.length > 0) {
      lines.push(`- 对象状态机构建(task9): 环节 ${localStepNames.join('、')}`);
    }
  }
  return { context: lines.join('\n'), currentTask };
}

/** 单条沟通内容最大字符数（超长 JSON 截断以降低 LLM 请求体积与延迟） */
const COMM_HISTORY_CONTENT_MAX_LEN = 3500;

/** 获取指定问题的聊天消息数组：当前在问题详情且为该问题则用内存，否则用 storage */
function getChatsForProblem(createdAt) {
  const item = __appState.currentProblemDetailItem;
  const arg = createdAt != null && String(createdAt) !== '' ? String(createdAt) : '';
  const detailOpenForArg =
    !!item &&
    !!arg &&
    (String(item.createdAt || '') === arg ||
      (item.id != null && String(item.id) === arg) ||
      getProblemFollowCaseKey(item) === arg);
  // 含长度为 0：task1「重启当前」等截断后须以内存为准，否则回退 localStorage 可能命中 id/createdAt 双键下的陈旧副本，过程日志仍满（FE-20260417）
  const useMemory = detailOpenForArg && Array.isArray(__appState.problemDetailChatMessages);
  let result;
  if (useMemory) {
    result = __appState.problemDetailChatMessages;
  } else {
    const map = getProblemDetailChats();
    const keys = [];
    if (arg) keys.push(arg);
    if (item && detailOpenForArg) {
      const sk = getProblemDetailChatStorageKey(item);
      if (sk && !keys.includes(sk)) keys.push(sk);
      const ca = item.createdAt != null ? String(item.createdAt) : '';
      if (ca && !keys.includes(ca)) keys.push(ca);
      const idStr = item.id != null && String(item.id).trim() !== '' ? String(item.id) : '';
      if (idStr && !keys.includes(idStr)) keys.push(idStr);
    }
    result = [];
    for (const k of keys) {
      const arr = map[k];
      if (Array.isArray(arr) && arr.length > 0) {
        result = arr;
        break;
      }
    }
    if (result.length === 0) {
      for (const k of keys) {
        const arr = map[k];
        if (Array.isArray(arr)) {
          result = arr;
          break;
        }
      }
    }
  }
  if (shouldLogTask1PrelimLlm()) {
    try {
      const typesPreview = Array.isArray(result)
        ? result.slice(0, 24).map((m) => m?.type || m?.role || '?')
        : [];
      console.info('[FE:task1-prelim-llm]', 'getChatsForProblem', {
        createdAtArg: arg || '(empty)',
        detailOpenForArg,
        useMemory,
        memoryMsgCount: Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages.length : null,
        resultCount: Array.isArray(result) ? result.length : -1,
        typesPreview,
      });
    } catch (_) {}
  }
  return result;
}

/** Ask 模式上下文单块最大字符数（确保涵盖所有数据，仅极端超长时截断） */
const ASK_CONTEXT_MAX_PER_BLOCK = 128000;

/** 构建 Ask 模式下当前问题的完整上下文：必须涵盖当前项目的所有数据，供大模型精准回答；返回 { context, wasTruncated } */
function buildAskModeProblemContext(item) {
  if (!item) return { context: '', wasTruncated: false };
  const lines = [];
  let wasTruncated = false;
  const fmt = (v) => (v != null && String(v).trim() ? String(v).trim() : '—');
  const trunc = (s, max) => {
    if (typeof s !== 'string') return s;
    if (s.length > max) {
      wasTruncated = true;
      return s.slice(0, max) + '\n...(已截断)';
    }
    return s;
  };
  const BASIC_INFO_KEY_TO_LABEL = { company_name: '公司名称', credit_code: '信用代码', legal_representative: '法人', established_date: '成立时间', registered_capital: '注册资本', is_listed: '是否上市', listing_location: '上市地', business_scope: '经营范围', core_qualifications: '核心资质', official_website: '官网' };
  const prelimJson =
    typeof window.buildPreliminaryStructuredJsonString === 'function'
      ? window.buildPreliminaryStructuredJsonString(item)
      : '{}';
  const reqDetail = String(item.requirementDetail ?? item.requirement_detail ?? '').trim();
  lines.push('【项目进度】');
  lines.push(`  当前大阶段: ${PROBLEM_DETAIL_MAJOR_STAGE_LABELS[item.currentMajorStage ?? 0] ?? '—'}`);
  lines.push(`  需求理解已完成子步骤: ${(item.completedStages || []).join(', ') || '无'}`);
  lines.push(`  工作流对齐已完成子步骤: ${(item.workflowAlignCompletedStages || []).join(', ') || '无'}`);
  lines.push(`  ITGap 分析已完成子步骤: ${(item.itGapCompletedStages || []).join(', ') || '无'}`);
  lines.push('');
  lines.push('【初步需求】（新版深度提炼 JSON，不含需求详情原文）');
  lines.push(trunc(prelimJson, ASK_CONTEXT_MAX_PER_BLOCK));
  lines.push(`  需求详情(原文): ${fmt(reqDetail)}`);
  const basicInfo = problemDetailConfirmedBasicInfo || item.basicInfo || {};
  lines.push('');
  lines.push('【客户基本信息】');
  if (Object.keys(basicInfo).some((k) => basicInfo[k] != null && String(basicInfo[k]).trim())) {
    Object.entries(basicInfo).forEach(([k, v]) => {
      if (v != null && String(v).trim()) lines.push(`  ${BASIC_INFO_KEY_TO_LABEL[k] || k}: ${fmt(v)}`);
    });
  } else {
    lines.push('  (暂无)');
  }
  const bmc = item.bmc || {};
  lines.push('');
  lines.push('【商业模式画布 BMC】');
  if (Object.keys(bmc).some((k) => bmc[k] != null && String(bmc[k]).trim())) {
    (BMC_FIELDS || []).forEach((f) => {
      const v = bmc[f.key];
      if (v != null && String(v).trim()) lines.push(`  ${f.label}: ${fmt(v)}`);
    });
    if (bmc.industry_insight) lines.push(`  行业背景洞察: ${fmt(bmc.industry_insight)}`);
    if (bmc.pain_points) lines.push(`  业务痛点预判: ${fmt(bmc.pain_points)}`);
    if (bmc.comprehensive_review) lines.push(`  综合评述: ${fmt(bmc.comprehensive_review)}`);
  } else {
    lines.push('  (暂无)');
  }
  lines.push('');
  lines.push('【需求逻辑】');
  if (item.requirementLogic && (typeof item.requirementLogic === 'string' ? item.requirementLogic.trim() : JSON.stringify(item.requirementLogic))) {
    const rl = typeof item.requirementLogic === 'string' ? item.requirementLogic : JSON.stringify(item.requirementLogic, null, 2);
    lines.push(trunc(rl, ASK_CONTEXT_MAX_PER_BLOCK));
  } else {
    lines.push('  (暂无)');
  }
  const vs = item.valueStream;
  lines.push('');
  lines.push('【价值流图】');
  if (vs) {
    if (vs.raw) {
      lines.push(trunc(typeof vs.raw === 'string' ? vs.raw : JSON.stringify(vs, null, 2), ASK_CONTEXT_MAX_PER_BLOCK));
    } else {
      const vsJson = JSON.stringify(vs, null, 2);
      lines.push(trunc(vsJson, ASK_CONTEXT_MAX_PER_BLOCK));
    }
  } else {
    lines.push('  (暂无)');
  }
  lines.push('');
  lines.push('【IT设计补齐】');
  if (item.globalItGapAnalysisJson) {
    const gj = typeof item.globalItGapAnalysisJson === 'string' ? item.globalItGapAnalysisJson : JSON.stringify(item.globalItGapAnalysisJson, null, 2);
    lines.push(trunc(gj, ASK_CONTEXT_MAX_PER_BLOCK));
  } else {
    lines.push('  (暂无)');
  }
  const localSessions = item.localItGapSessions || [];
  lines.push('');
  lines.push('【对象状态机构建】');
  if (localSessions.length > 0) {
    localSessions.forEach((s, i) => {
      const analysis = (item.localItGapAnalyses || [])[i];
      const analysisJson = analysis?.analysisJson || s.analysisJson;
      const analysisMarkdown = analysis?.analysisMarkdown || s.analysisMarkdown;
      const stepName = s.stepName || `环节${(s.stepIndex ?? i) + 1}`;
      lines.push(`  --- ${stepName} ---`);
      if (analysisMarkdown && String(analysisMarkdown).trim()) {
        lines.push(trunc(String(analysisMarkdown).trim(), ASK_CONTEXT_MAX_PER_BLOCK));
      }
      if (analysisJson) {
        const aj = typeof analysisJson === 'string' ? analysisJson : JSON.stringify(analysisJson, null, 2);
        lines.push(trunc(aj, ASK_CONTEXT_MAX_PER_BLOCK));
      }
    });
  } else {
    lines.push('  (暂无)');
  }
  lines.push('');
  lines.push('【角色与权限模型】');
  const rpContent = typeof item.rolePermissionModel === 'string' ? item.rolePermissionModel : (item.rolePermissionModel && typeof item.rolePermissionModel === 'object' ? JSON.stringify(item.rolePermissionModel, null, 2) : null);
  if (rpContent && rpContent.trim()) {
    lines.push(trunc(rpContent, ASK_CONTEXT_MAX_PER_BLOCK));
  } else {
    lines.push('  (暂无)');
  }
  const commHistory = buildCommunicationHistoryTextForQuery(item?.createdAt, ASK_CONTEXT_MAX_PER_BLOCK);
  lines.push('');
  lines.push('【过程日志/沟通历史】');
  if (commHistory && commHistory !== '(暂无沟通记录)') {
    lines.push(trunc(commHistory, ASK_CONTEXT_MAX_PER_BLOCK));
  } else {
    lines.push('  (暂无)');
  }
  return { context: lines.join('\n'), wasTruncated };
}

/** 构建用于查询的沟通历史文本（排除查询类消息），供大模型回答查询时使用；maxContentLen 可选，Ask 上下文传入更大值以涵盖所有数据 */
function buildCommunicationHistoryTextForQuery(createdAt, maxContentLen) {
  const maxLen = maxContentLen ?? COMM_HISTORY_CONTENT_MAX_LEN;
  const communications = getCommunicationsByTask(createdAt, getChatsForProblem(createdAt));
  const lines = [];
  const allTasks = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...IT_STRATEGY_TASKS];
  for (const task of allTasks) {
    const comms = communications[task.id] || [];
    const taskLabel = task.name;
    for (const c of comms) {
      let contentStr = typeof c.content === 'object' ? JSON.stringify(c.content, null, 2) : c.content;
      if (typeof contentStr === 'string' && contentStr.length > maxLen) {
        contentStr = contentStr.slice(0, maxLen) + '\n...(内容已截断)';
      }
      lines.push(`[${taskLabel}] ${c.speaker} (${c.time}):\n${contentStr}`);
    }
  }
  return lines.join('\n\n') || '(暂无沟通记录)';
}

/** 执行查询意图：将查询需求及沟通历史发往大模型，返回回答及元信息 */
async function executeQueryIntent(extracted, item) {
  const createdAt = item?.createdAt;
  const commHistory = buildCommunicationHistoryTextForQuery(createdAt);
  const queryReq = extracted.queryTarget || extracted.summary || '用户查询';
  const systemPrompt = `你是一位数字化问题跟进助手。用户有一个查询需求，请优先依据【当前问题的阶段状态】来判断当前处于哪个阶段或任务，再结合【沟通历史】补充细节。若两者不一致，以【当前问题的阶段状态】为准。若仍无相关信息，请如实说明。`;

  const majorStageIndex = item?.currentMajorStage ?? 0;
  const majorStageLabel = PROBLEM_DETAIL_MAJOR_STAGE_LABELS[majorStageIndex] ?? String(majorStageIndex);
  const workflowAlignCompleted = (item?.workflowAlignCompletedStages || []).join(', ');
  const itGapCompleted = (item?.itGapCompletedStages || []).join(', ');
  let currentStageLine = `当前问题的阶段为：${majorStageLabel}（索引 ${majorStageIndex}）。`;
  if (majorStageIndex === 3) {
    const subIdx = typeof itStrategyPlanViewingSubstep === 'number' ? itStrategyPlanViewingSubstep : 0;
    const itStrategyTask = IT_STRATEGY_TASKS[subIdx];
    if (itStrategyTask) {
      currentStageLine += ` 当前 IT 策略规划任务为：${itStrategyTask.name}（${itStrategyTask.id}）。`;
    }
  }
  const stateLines = [
    currentStageLine,
    `已完成的工作流对齐子步骤索引：${workflowAlignCompleted || '无'}`,
    `已完成的 ITGap 分析子步骤索引：${itGapCompleted || '无'}`,
  ].join('\n');

  const userContent = `【当前问题的阶段状态】
${stateLines}

【沟通历史】
${commHistory}

【查询需求】
${queryReq}`;
  const { content, usage, model, durationMs } = await fetchDeepSeekChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]);
  return { content: (content || '').trim() || '（无返回内容）', usage, model, durationMs };
}

/** Ask 模式：将当前问题所有环节数据 + 用户问题发送大模型，要求精准回答、不添加非上下文内容；返回 { content, usage, model, durationMs, wasTruncated } */
async function executeAskModeDirectQuery(item, userQuestion) {
  const { context: contextStr, wasTruncated } = buildAskModeProblemContext(item);
  const systemPrompt = `你是数字化问题跟进助手。下方【上下文】是当前问题的所有环节数据。用户会提出一个问题，请你仅基于【上下文】中提供的数据精准回答。

要求：
1. 直接给出答案，不要使用「根据...」「依据...」「从上下文可知...」等数据来源描述；
2. 不要添加任何上下文之外的内容；
3. 若上下文无相关信息，请如实说明「暂无相关信息」。`;
  const userContent = `【上下文】\n${contextStr}\n\n【用户问题】\n${userQuestion}`;
  const { content, usage, model, durationMs } = await fetchDeepSeekChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]);
  const contextLength = (contextStr && contextStr.length) || 0;
  return { content: (content || '').trim() || '（无返回内容）', usage, model, durationMs, wasTruncated, contextLength };
}

/** 根据用户问题关键词将工作区定位到对应内容块，并用绿色闪烁边框高亮 */
function focusWorkspaceOnUserQuestion(text) {
  const container = el.problemDetailContent;
  const item = __appState.currentProblemDetailItem;
  if (!container || !item) return;
  const t = (text || '').toLowerCase();
  let taskId = null;
  if (/基本信息|公司名称|信用代码|法人|注册资本|经营范围|企业背景/.test(t)) taskId = 'task1';
  else if (/bmc|商业模式|商业画布|客户细分|价值主张|渠道通路/.test(t)) taskId = 'task2';
  else if (/需求逻辑|行业逻辑|逻辑链条|需求背后的逻辑|行业底层逻辑|痛点.*逻辑|逻辑.*痛点|需求背后|深层次|深层原因|深层动机|商业动机|因果关联/.test(t)) taskId = 'task3';
  else if (/端到端|e2e/.test(t)) taskId = 'task7';
  else if (/全局.*itgap|itgap.*全局/.test(t)) taskId = 'task8';
  else if (/局部.*itgap|itgap.*局部/.test(t)) taskId = 'task9';
  else if (/角色|权限|干系人/.test(t)) taskId = 'task12';
  else if (/价值流|it现状|痛点/.test(t)) taskId = 'task4';
  if (!taskId) return;
  let cardTaskId = taskId;
  if (['task5', 'task6'].includes(taskId)) cardTaskId = 'task4';
  else if (taskId === 'task7') cardTaskId = 'e2e-flow';
  else if (taskId === 'task8') cardTaskId = 'global-itgap';
  else if (taskId === 'task9') cardTaskId = 'local-itgap';
  else if (['task12', 'task13', 'task14', 'task15'].includes(taskId)) cardTaskId = taskId;
  const currentMajorStage = item.currentMajorStage ?? 0;
  let targetMajorStage = 0;
  if (['task1', 'task2', 'task3'].includes(taskId)) targetMajorStage = 0;
  else if (['task4', 'task5', 'task6'].includes(taskId)) targetMajorStage = 1;
  else if (['task7', 'task8', 'task9'].includes(taskId)) targetMajorStage = 2;
  else if (['task12', 'task13', 'task14', 'task15'].includes(taskId)) targetMajorStage = 3;
  else targetMajorStage = 1;
  if (['task12', 'task13', 'task14', 'task15'].includes(taskId)) {
    const substepMap = { task12: 0, task13: 1, task14: 2, task15: 3 };
    itStrategyPlanViewingSubstep = substepMap[taskId];
  }
  if (problemDetailViewingMajorStage !== targetMajorStage) {
    problemDetailViewingMajorStage = Math.min(targetMajorStage, currentMajorStage);
    updateProblemDetailProgressStages(currentMajorStage, problemDetailViewingMajorStage);
    renderProblemDetailContent();
  }
  requestAnimationFrame(() => {
    container.querySelectorAll('.problem-detail-ask-highlight').forEach((el) => el.classList.remove('problem-detail-ask-highlight'));
    let targetCard = container.querySelector(`.problem-detail-card[data-task-id="${cardTaskId}"]`);
    if (!targetCard) targetCard = container.querySelector(`.problem-detail-value-stream-card[data-task-id="${cardTaskId}"]`);
    if (!targetCard && cardTaskId === 'local-itgap') {
      targetCard = container.querySelector('.problem-detail-card[data-task-id="local-itgap-trigger"]');
    }
    if (!targetCard) targetCard = container.querySelector(`[data-task-id="${cardTaskId}"]`);
    if (targetCard) {
      targetCard.classList.add('problem-detail-ask-highlight');
      const header = targetCard.querySelector('.problem-detail-card-header');
      const body = targetCard.querySelector('.problem-detail-card-body');
      if (header && body && body.hidden) {
        body.hidden = false;
        header.classList.remove('problem-detail-card-header-collapsed');
        header.setAttribute('aria-expanded', 'true');
      }
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

/** 执行请教讨论意图：将用户讨论问题及沟通历史上下文发往大模型，返回回答；讨论归入对应任务的沟通历史 */
async function executeDiscussionIntent(extracted, item, userText) {
  const createdAt = item?.createdAt;
  const commHistory = buildCommunicationHistoryTextForQuery(createdAt);
  const topic = extracted.discussionTopic || extracted.summary || userText || '用户讨论';
  const systemPrompt = `你是一位数字化问题跟进顾问。用户针对当前数字化问题的某个专题进行延展性讨论或请教。请结合【沟通历史】的完整上下文，对用户的问题进行专业、深入的解答或讨论。可以结合行业经验、最佳实践给出建议，保持友好、专业的对话风格。`;
  const userContent = `【沟通历史】\n${commHistory}\n\n【用户讨论/请教】\n${topic}`;
  const { content, usage, model, durationMs } = await fetchDeepSeekChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]);
  return { content: (content || '').trim() || '（无返回内容）', usage, model, durationMs };
}

/** 标签到基本信息字段的映射 */
const BASIC_INFO_LABEL_TO_KEY = {
  公司名称: 'company_name',
  信用代码: 'credit_code',
  法人: 'legal_representative',
  成立时间: 'established_date',
  注册资本: 'registered_capital',
  是否上市: 'is_listed',
  上市地: 'listing_location',
  经营范围: 'business_scope',
  核心资质: 'core_qualifications',
  官方网站: 'official_website',
};

/** 获取修改目标位置的当前内容，返回 { taskId, fieldKey, currentContent, positionDesc } 或 null */
function getCurrentContentAtModificationTarget(extracted, item) {
  const taskId = extracted.taskId || 'task1';
  const modField = String(extracted.modificationField || '').trim();
  const modTarget = String(extracted.modificationTarget || '').trim();
  const vsLevel = String(extracted.modificationValueStreamLevel || '').toLowerCase();
  const vsTarget = String(extracted.modificationValueStreamTarget || '').trim();

  if (taskId === 'task1' || modTarget.includes('企业基本信息') || modTarget.includes('基本信息')) {
    const basicInfo = problemDetailConfirmedBasicInfo || item?.basicInfo || {};
    const fieldKey = modField ? (BASIC_INFO_LABEL_TO_KEY[modField] || modField) : null;
    if (fieldKey && basicInfo[fieldKey] != null) {
      return { taskId: 'task1', fieldKey, currentContent: String(basicInfo[fieldKey]).trim(), positionDesc: `客户基本信息 - ${modField || fieldKey}` };
    }
    return { taskId: 'task1', fieldKey: null, currentContent: JSON.stringify(basicInfo, null, 2), positionDesc: '客户基本信息（整块）' };
  }

  if (taskId === 'task2' || modTarget.includes('bmc') || modTarget.includes('商业画布') || modTarget.includes('商业模式')) {
    const bmc = item?.bmc || {};
    const bmcField = BMC_FIELDS.find((f) => f.label === modField);
    const industryInsight = modField === '行业背景洞察';
    const painPoints = modField === '业务痛点预判';
    if (bmcField) {
      const val = bmc[bmcField.key];
      return { taskId: 'task2', fieldKey: bmcField.key, currentContent: val != null ? String(val).trim() : '', positionDesc: `BMC - ${modField}` };
    }
    if (industryInsight) return { taskId: 'task2', fieldKey: 'industry_insight', currentContent: (bmc.industry_insight || '').trim(), positionDesc: 'BMC - 行业背景洞察' };
    if (painPoints) return { taskId: 'task2', fieldKey: 'pain_points', currentContent: (bmc.pain_points || '').trim(), positionDesc: 'BMC - 业务痛点预判' };
    return { taskId: 'task2', fieldKey: null, currentContent: JSON.stringify(bmc, null, 2), positionDesc: 'BMC（整块）' };
  }

  if (taskId === 'task3' || modTarget.includes('需求逻辑')) {
    const logic = item?.requirementLogic || '';
    const parsed = typeof logic === 'string' ? parseRequirementLogicFromMarkdown(logic) : logic;
    const section = REQUIREMENT_LOGIC_SECTIONS.find((s) => s.label === modField);
    if (section) {
      const val = (parsed[section.key] || '').trim();
      return { taskId: 'task3', fieldKey: section.key, currentContent: val, positionDesc: `需求逻辑 - ${modField}` };
    }
    return { taskId: 'task3', fieldKey: null, currentContent: typeof logic === 'string' ? logic : JSON.stringify(logic, null, 2), positionDesc: '需求逻辑（整块）' };
  }

  if (['task4', 'task5', 'task6'].includes(taskId) && item?.valueStream && !item.valueStream.raw) {
    const vs = item.valueStream;
    const { stages } = parseValueStreamGraph(vs);
    const targetName = vsTarget || modField;
    const modTargetLower = modTarget.toLowerCase();
    const isPainPointIntent = modTargetLower.includes('痛点') || modField.includes('痛点');
    const isItStatusIntent = modTargetLower.includes('it现状') || modTargetLower.includes('it 现状') || modField.includes('IT现状');
    if ((vsLevel === 'step' || (!vsLevel && targetName)) && targetName) {
      for (let si = 0; si < stages.length; si++) {
        const stage = stages[si];
        for (let ji = 0; ji < (stage.steps || []).length; ji++) {
          const step = stage.steps[ji];
          const name = (step.name || '').trim();
          if (name && (name === targetName || name.includes(targetName) || targetName.includes(name))) {
            let vsStepField;
            if (isPainPointIntent) vsStepField = 'painPoint';
            else if (isItStatusIntent) vsStepField = 'itStatus';
            else vsStepField = step.painPoint ? 'painPoint' : step.itStatusLabel ? 'itStatus' : 'name';
            const itStatus = step.itStatusLabel || (step.itStatus && typeof step.itStatus === 'object' ? (step.itStatus.type === '手工' ? `手工-${step.itStatus.detail || ''}` : step.itStatus.type === '系统' ? `系统-${step.itStatus.detail || ''}` : '') : '');
            const content = vsStepField === 'painPoint' ? (step.painPoint || '') : vsStepField === 'itStatus' ? itStatus : step.name || '';
            const fieldLabel = vsStepField === 'painPoint' ? '痛点描述' : vsStepField === 'itStatus' ? 'IT现状' : '环节名称';
            return { taskId: 'task4', fieldKey: 'valueStream', currentContent: content, positionDesc: `价值流 - 阶段「${stage.name}」- 环节「${step.name}」的${fieldLabel}`, vsStageIndex: si, vsStepIndex: ji, vsStepField };
          }
        }
      }
    }
    if (vsLevel === 'stage' && targetName) {
      for (let si = 0; si < stages.length; si++) {
        const stage = stages[si];
        const name = (stage.name || '').trim();
        if (name && (name === targetName || name.includes(targetName) || targetName.includes(name))) {
          return { taskId: 'task4', fieldKey: 'valueStream', currentContent: stage.name || '', positionDesc: `价值流 - 阶段「${stage.name}」的阶段名称`, vsStageIndex: si, vsStepIndex: -1, vsStepField: 'stageName' };
        }
      }
    }
    return { taskId: 'task4', fieldKey: 'valueStream', currentContent: JSON.stringify(vs, null, 2), positionDesc: '价值流图（整块）' };
  }

  if (taskId === 'preliminary' || modTarget.includes('初步需求')) {
    const PRELIMINARY_LABEL_TO_KEY = typeof window.PRELIMINARY_LABEL_TO_KEY !== 'undefined' ? window.PRELIMINARY_LABEL_TO_KEY : {};
    const getByPath = typeof window.getByPath === 'function' ? window.getByPath : () => undefined;
    const buildPreliminaryPreContent = typeof window.buildPreliminaryPreContent === 'function' ? window.buildPreliminaryPreContent : () => ({});
    const buildResolved =
      typeof window.buildResolvedPreliminaryRequirement === 'function' ? window.buildResolvedPreliminaryRequirement : (it) => it;
    const preKey = modField ? PRELIMINARY_LABEL_TO_KEY[modField] : null;
    if (preKey && item) {
      const resolved = buildResolved(item);
      const val = preKey.indexOf('.') >= 0 ? getByPath(resolved, preKey) : resolved[preKey];
      if (val != null) {
        const currentContent = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val).trim();
        return { taskId: 'preliminary', fieldKey: preKey, currentContent, positionDesc: `初步需求 - ${modField || preKey}` };
      }
    }
    const preContent = buildPreliminaryPreContent(item);
    return { taskId: 'preliminary', fieldKey: null, currentContent: JSON.stringify(preContent, null, 2), positionDesc: '初步需求（整块）' };
  }

  return null;
}

/** 价值流修改类型对应的说明，用于提示词中明确告知大模型 */
const VS_STEP_FIELD_LABELS = {
  painPoint: '环节痛点描述',
  itStatus: '环节IT现状',
  name: '环节名称',
  stageName: '阶段名称',
};

/** 构建价值流结构描述，供多目标修改分析使用 */
function buildValueStreamStructureForMultiMod( vs) {
  if (!vs || vs.raw) return '';
  const { stages } = parseValueStreamGraph(vs);
  const lines = stages.map((stage, si) => {
    const stepLines = (stage.steps || []).map((step, ji) => {
      const itStatus = step.itStatusLabel || (step.itStatus && typeof step.itStatus === 'object' ? (step.itStatus.type === '手工' ? `手工-${step.itStatus.detail || ''}` : step.itStatus.type === '系统' ? `系统-${step.itStatus.detail || ''}` : '') : '');
      return `      - 环节「${step.name || ''}」: itStatus=${itStatus || '(空)'}, painPoint=${(step.painPoint || '').trim() || '(空)'}`;
    }).join('\n');
    return `  阶段「${stage.name || ''}」:\n${stepLines}`;
  }).join('\n');
  return lines;
}

/** 分析多目标修改意图：当修改涉及价值流多个环节/字段时，由大模型拆分为独立更新项，分别更新对应位置 */
async function analyzeMultiModificationForValueStream(extracted, item) {
  const vs = item?.valueStream;
  if (!vs || vs.raw) return null;
  const vsStructure = buildValueStreamStructureForMultiMod(vs);
  const modTarget = extracted.modificationTarget || '';
  const modField = extracted.modificationField || '';
  const modNewValue = extracted.modificationNewValue || '';
  const summary = extracted.summary || '';
  const systemPrompt = `你是一位数字化问题跟进助手。用户希望对价值流图进行修改。请分析修改意图，若涉及多个位置（如：订单合并与生产需求分析两个环节的 IT 现状和痛点都需修改），必须拆分为多条独立更新，每条更新对应一个具体位置，分别修改，不要将多个位置的修改合并到其中一处。

【价值流当前结构】
${vsStructure}

【输出格式】只返回 JSON 数组，不要有其他内容。每个元素：
{ "stageName": "阶段名称（必须与上面结构中的阶段名一致）", "stepName": "环节名称（必须与上面结构中的环节名一致）", "field": "itStatus"|"painPoint"|"name", "newContent": "该位置的新内容" }

- field 为 itStatus 时，newContent 格式如「手工-excel」或「系统-ERP」
- field 为 painPoint 时，newContent 为该环节的痛点描述文案
- field 为 name 时，newContent 为环节名称
- 若修改阶段名称，stepName 填空字符串，field 填 "stageName"，newContent 为新阶段名

规则：每个需要修改的位置单独一条；同一环节的 itStatus 与 painPoint 若都需修改，分两条；不同环节的修改必须分条。`;
  const userContent = `【修改意图】\n${modTarget}
${modField ? `修改字段：${modField}` : ''}
${modNewValue ? `用户希望改为：${modNewValue}` : ''}
${summary ? `意图概括：${summary}` : ''}

请分析并返回需更新的位置列表（JSON 数组）。`;
  const { content, usage, model, durationMs } = await fetchDeepSeekChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]);
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;
  try {
    const updates = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(updates) || updates.length === 0) return null;
    return { updates, usage, model, durationMs };
  } catch {
    return null;
  }
}

/** 根据 stageName、stepName 在价值流中查找步骤索引，返回 { vsStageIndex, vsStepIndex } 或 null；stepName 为空时匹配阶段 */
function findValueStreamStepIndex(vs, stageName, stepName) {
  const rawStages = vs.stages ?? vs.phases ?? vs.nodes ?? [];
  for (let si = 0; si < rawStages.length; si++) {
    const stage = rawStages[si];
    const sName = (stage.name ?? stage.title ?? stage.stage_name ?? '').toString().trim();
    if (sName !== stageName) continue;
    if (!stepName || (typeof stepName === 'string' && !stepName.trim())) {
      return { vsStageIndex: si, vsStepIndex: -1 };
    }
    const rawSteps = stage.steps ?? stage.tasks ?? stage.phases ?? stage.items ?? [];
    for (let ji = 0; ji < rawSteps.length; ji++) {
      const step = rawSteps[ji];
      const stName = (step.name ?? step.title ?? '').toString().trim();
      if (stName === stepName || (stName && stepName && (stName.includes(stepName) || stepName.includes(stName)))) {
        return { vsStageIndex: si, vsStepIndex: ji };
      }
    }
  }
  return null;
}

/** 将多目标更新列表依次应用到价值流 */
function applyValueStreamUpdates(item, updates) {
  const vs = item?.valueStream;
  if (!vs || vs.raw || !Array.isArray(updates) || updates.length === 0) return false;
  const createdAt = item?.createdAt;
  if (!createdAt) return false;
  let currentVs = { ...vs, stages: JSON.parse(JSON.stringify(vs.stages ?? vs.phases ?? vs.nodes ?? [])) };
  const rawStages = currentVs.stages;
  for (const u of updates) {
    const { stageName, stepName, field, newContent } = u;
    if (!stageName || !field || newContent == null) continue;
    const idx = findValueStreamStepIndex({ stages: rawStages }, stageName, (stepName || '').trim());
    if (!idx) continue;
    const { vsStageIndex: si, vsStepIndex: ji } = idx;
    if (si < 0 || si >= rawStages.length) continue;
    const stage = rawStages[si];
    const rawSteps = stage.steps ?? stage.tasks ?? stage.phases ?? stage.items ?? [];
    if (field === 'stageName') {
      rawStages[si] = { ...stage, name: newContent, title: newContent, stage_name: newContent };
    } else if (ji >= 0 && ji < rawSteps.length) {
      const step = rawSteps[ji];
      const nextStep = typeof step === 'object' && step !== null ? { ...step } : { name: String(step) };
      if (field === 'painPoint') nextStep.painPoint = newContent;
      else if (field === 'itStatus') {
        const m = String(newContent).match(/^(手工|系统)[-：]?(.*)$/);
        if (m) nextStep.itStatus = nextStep.it_status = { type: m[1], detail: (m[2] || '').trim() };
        else nextStep.itStatus = nextStep.it_status = { type: '手工', detail: newContent };
      } else nextStep.name = nextStep.title = newContent;
      const newSteps = [...rawSteps];
      newSteps[ji] = nextStep;
      rawStages[si] = { ...stage, steps: newSteps };
    }
  }
  updateDigitalProblemValueStream(createdAt, currentVs);
  __appState.currentProblemDetailItem = { ...item, valueStream: currentVs };
  return true;
}

/** 执行修改意图：将修改意见及当前位置内容发往大模型，返回新内容及元信息 */
async function executeModificationIntent(extracted, positionInfo) {
  const modTarget = extracted.modificationTarget || '';
  const modField = extracted.modificationField || '';
  const modNewValue = extracted.modificationNewValue || '';
  const { currentContent, positionDesc } = positionInfo;
  const vsStepField = positionInfo.vsStepField;
  const fieldTypeLabel = vsStepField ? VS_STEP_FIELD_LABELS[vsStepField] : null;
  const valueStreamFieldHint = fieldTypeLabel
    ? `\n【重要】本次修改类型为：${fieldTypeLabel}。你只返回该字段的新内容，不要返回其他无关内容。若修改的是痛点描述，只返回痛点文案；若修改的是IT现状，只返回如「手工-excel」或「系统-ERP」格式；若修改的是环节名称，只返回环节名；若修改的是阶段名称，只返回阶段名。`
    : '';
  const systemPrompt = `你是一位数字化问题跟进助手。用户希望对工作区某处内容进行修改。请根据【修改意见】和【当前位置的现有内容】，综合处理形成新的内容。

要求：
1. 新内容应满足用户的修改意图，同时保持与上下文一致；
2. 若用户已明确给出修改后的值（modificationNewValue），可优先采纳，并做必要的润色或补充；
3. 只返回修改后的新内容本身，不要包含解释、说明或 markdown 代码块；
4. 若为 JSON 字段，返回合法的 JSON 字符串；若为普通文本，返回纯文本。${valueStreamFieldHint}`;
  const userContent = `【修改位置】\n${positionDesc}

【修改意见】\n修改目标：${modTarget}
${modField ? `修改字段：${modField}` : ''}
${modNewValue ? `用户希望改为：${modNewValue}` : ''}

【当前位置的现有内容】\n${currentContent || '(空)'}`;
  const { content, usage, model, durationMs } = await fetchDeepSeekChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]);
  return { newContent: (content || '').trim(), usage, model, durationMs };
}

/**
 * 将初步需求子字段写入 `preliminaryReq`（支持 `a.b.c` 路径）；`requirementDetail` 同步顶层 `requirementDetail`。
 * @returns {{ preliminaryReq: Object, patchTop: Record<string, unknown> }}
 */
function mergePreliminaryReqFieldFromModification(prelim, fieldKey, rawContent) {
  const base = prelim && typeof prelim === 'object' ? { ...prelim } : {};
  let value = rawContent;
  const t = String(rawContent ?? '').trim();
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try {
      value = JSON.parse(t);
    } catch (_) {
      value = rawContent;
    }
  }
  const patchTop = {};
  if (fieldKey === 'requirementDetail') {
    const str = typeof value === 'string' ? value : String(rawContent ?? '');
    base.requirementDetail = str;
    patchTop.requirementDetail = str;
    return { preliminaryReq: base, patchTop };
  }
  const parts = String(fieldKey).split('.');
  let cur = base;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const nextLayer = cur[p];
    cur[p] = nextLayer != null && typeof nextLayer === 'object' && !Array.isArray(nextLayer) ? { ...nextLayer } : {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return { preliminaryReq: base, patchTop };
}

/** 将修改结果应用到工作区并更新存储 */
function applyModificationToWorkspace(extracted, newContent, positionInfo, item) {
  const { taskId, fieldKey } = positionInfo;
  const createdAt = item?.createdAt;
  if (!createdAt) return false;

  if (taskId === 'preliminary' && fieldKey) {
    const { preliminaryReq, patchTop } = mergePreliminaryReqFieldFromModification(item?.preliminaryReq, fieldKey, newContent);
    const nameSync = {};
    if (fieldKey === 'businessContext' && preliminaryReq.businessContext && typeof preliminaryReq.businessContext === 'object') {
      const cn = preliminaryReq.businessContext.clientName;
      if (cn != null && String(cn).trim()) nameSync.customerName = String(cn).trim();
    }
    if (typeof mergeDigitalProblemPatch === 'function') {
      mergeDigitalProblemPatch(createdAt, { preliminaryReq, ...patchTop, ...nameSync });
    } else {
      const list = getDigitalProblems();
      const idx = list.findIndex((it) => it.createdAt === createdAt);
      if (idx < 0) return false;
      list[idx] = { ...list[idx], preliminaryReq, ...patchTop, ...nameSync };
      localStorage.setItem(DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
      __appState.currentProblemDetailItem = { ...item, preliminaryReq, ...patchTop, ...nameSync };
    }
    return true;
  }

  if (taskId === 'task1') {
    let basicInfo = { ...(problemDetailConfirmedBasicInfo || item?.basicInfo || {}) };
    if (fieldKey) {
      basicInfo[fieldKey] = newContent;
    } else {
      try {
        const parsed = JSON.parse(newContent);
        if (parsed && typeof parsed === 'object') basicInfo = { ...basicInfo, ...parsed };
      } catch (_) {}
    }
    problemDetailConfirmedBasicInfo = basicInfo;
    updateDigitalProblemBasicInfo(createdAt, basicInfo, false);
    __appState.currentProblemDetailItem = { ...item, basicInfo };
    return true;
  }

  if (taskId === 'task2') {
    let bmc = { ...(item?.bmc || {}) };
    if (fieldKey) {
      bmc[fieldKey] = newContent;
    } else {
      try {
        const parsed = JSON.parse(newContent);
        if (parsed && typeof parsed === 'object') bmc = { ...bmc, ...parsed };
      } catch (_) {}
    }
    updateDigitalProblemBmc(createdAt, bmc, false);
    __appState.currentProblemDetailItem = { ...item, bmc };
    return true;
  }

  if (taskId === 'task3') {
    let logicStr = item?.requirementLogic || '';
    const parsed = parseRequirementLogicFromMarkdown(logicStr);
    if (fieldKey) {
      parsed[fieldKey] = newContent;
      logicStr = REQUIREMENT_LOGIC_SECTIONS.map((s) => `## ${s.label}\n\n${(parsed[s.key] || '').trim() || '—'}`).join('\n\n');
    } else {
      logicStr = newContent;
    }
    updateDigitalProblemRequirementLogic(createdAt, logicStr, false);
    __appState.currentProblemDetailItem = { ...item, requirementLogic: logicStr };
    return true;
  }

  if (taskId === 'task4' && positionInfo.vsStageIndex !== undefined) {
    const vs = item?.valueStream;
    if (!vs || vs.raw) return false;
    const rawStages = vs.stages ?? vs.phases ?? vs.nodes ?? [];
    const si = positionInfo.vsStageIndex;
    const ji = positionInfo.vsStepIndex;
    const field = positionInfo.vsStepField;
    if (si < 0 || si >= rawStages.length) return false;
    const stage = rawStages[si];
    const rawSteps = stage.steps ?? stage.tasks ?? stage.phases ?? stage.items ?? [];
    if (ji >= 0 && ji < rawSteps.length) {
      const step = rawSteps[ji];
      const nextStep = typeof step === 'object' && step !== null ? { ...step } : { name: String(step) };
      if (field === 'painPoint') nextStep.painPoint = newContent;
      else if (field === 'itStatus') {
        const m = newContent.match(/^(手工|系统)[-：]?(.*)$/);
        if (m) nextStep.itStatus = nextStep.it_status = { type: m[1], detail: (m[2] || '').trim() };
        else nextStep.itStatus = nextStep.it_status = { type: '手工', detail: newContent };
      } else nextStep.name = nextStep.title = newContent;
      const newSteps = [...rawSteps];
      newSteps[ji] = nextStep;
      const newStages = [...rawStages];
      newStages[si] = { ...stage, steps: newSteps };
      const newVs = { ...vs, stages: newStages };
      updateDigitalProblemValueStream(createdAt, newVs);
      __appState.currentProblemDetailItem = { ...item, valueStream: newVs };
    } else if (field === 'stageName') {
      const newStages = [...rawStages];
      newStages[si] = { ...stage, name: newContent, title: newContent, stage_name: newContent };
      const newVs = { ...vs, stages: newStages };
      updateDigitalProblemValueStream(createdAt, newVs);
      __appState.currentProblemDetailItem = { ...item, valueStream: newVs };
    } else return false;
    return true;
  }

  return false;
}

/** 提炼客户聊天输入的意图：当前任务、阶段、意图类型及具体内容；结合沟通历史搜索最匹配的内容单元并协助定位
 * @param {string} text - 用户输入
 * @param {string} context - 沟通历史与页面结构
 * @param {{ currentTaskHint?: string | null, globalScope?: boolean }} options - currentTaskHint: 当前任务提示，优先考虑；globalScope: 用户点击「不对」时传 true，全局匹配
 */
async function extractUserIntentFromChat(text, context, options = {}) {
  const { currentTaskHint, globalScope } = options;
  const tasksDesc = FOLLOW_TASKS.map((t) => `- ${t.id}: ${t.name}（${t.stage}）`).join('\n');
  const taskHintBlock = globalScope
    ? `【当前任务】用户表示当前任务推断不对，请从【任务列表】中全局搜索，判断用户意图与哪个任务最为相关，不要受沟通历史中任务标签的局限。`
    : currentTaskHint
      ? `【当前任务】当前对话上下文最可能涉及的任务为 ${currentTaskHint}（${FOLLOW_TASKS.find((t) => t.id === currentTaskHint)?.name || currentTaskHint}）。请优先考虑用户意图与此任务的关联；若用户输入明显与其它任务更相关，则选择最相关的任务。`
      : '';
  const systemPrompt = `你是一个数字化问题跟进对话的意图分析助手。用户会在聊天区输入消息，请结合【沟通历史】和【当前页面内容结构】提炼意图，从上下文中搜索最为匹配的内容单元，协助定位到对应的页面位置。
${taskHintBlock ? `\n${taskHintBlock}\n` : ''}
【任务列表】
${tasksDesc}

【输出格式】
{
  "taskId": "task1",
  "taskName": "企业背景洞察",
  "stage": "需求理解",
  "intent": "query" | "modification" | "execute" | "discussion",
  "queryTarget": "用户想查询的具体内容，仅当 intent 为 query 时填写",
  "discussionTopic": "用户想请教或讨论的具体话题，仅当 intent 为 discussion 时填写",
  "queryValueStreamLevel": "step" | "stage" | "card",
  "queryValueStreamTarget": "环节名或阶段名",
  "modificationTarget": "用户想修改的具体内容或目标，仅当 intent 为 modification 时填写",
  "modificationField": "具体要修改的字段名称，仅当 intent 为 modification 且能明确到具体字段时填写",
  "modificationValueStreamLevel": "step" | "stage" | "card",
  "modificationValueStreamTarget": "环节名或阶段名",
  "modificationClear": true | false,
  "modificationNewValue": "用户希望修改成的具体内容",
  "executeTaskId": "task2",
  "executeTaskName": "商业画布加载",
  "summary": "一句话概括用户意图"
}

【可修改字段参考】（modificationField 应使用以下精确字段名之一）
- 初步需求：客户名称、客户需求或挑战、客户IT现状、项目时间要求
- 客户基本信息：公司名称、信用代码、法人、成立时间、注册资本、是否上市、上市地、经营范围、核心资质、官方网站
- BMC：行业背景洞察、客户细分、价值主张、渠道通路、客户关系、收入来源、核心资源、关键业务、重要合作、成本结构、业务痛点预判
- 需求逻辑：行业底层逻辑与竞争共性、初步需求与商业模式的"因果关联"、需求背后的深层动机、逻辑链条总结

规则：
1. 结合【沟通历史】理解对话脉络，从【当前页面内容结构】中搜索与用户输入最为匹配的内容单元（字段名、环节名、阶段名等）。
2. taskId/taskName/stage：根据用户消息及沟通历史推断当前沟通涉及的任务及阶段，从上述任务列表中选择最相关的。
3. intent：简单查询(query) / 反馈修改意见(modification) / 执行操作(execute) / 请教讨论(discussion)
4. 若 intent=discussion：用户针对当前问题的各种专题进行延展性讨论或请教时填写。判断用户讨论话题与哪个任务最为相关，填写 taskId；填写 discussionTopic 概括讨论话题。
5. 若 intent=query，填写 queryTarget。若用户查询「某环节的 ITGap 分析」「某环节的对象状态机构建」（或历史说法「角色汇总设计」）「某环节的局部 ITGap 分析」，填 taskId=task9，queryValueStreamTarget=环节名。若涉及价值流图（非 ITGap 分析），从【当前页面内容结构】中匹配环节名/阶段名，填写 queryValueStreamLevel 和 queryValueStreamTarget
6. 若 intent=modification：必须判断 modificationClear。仅当用户明确指定了「把什么改成什么」（具体修改对象+修改后的值）时填 true，否则填 false。若用户只说「想修改」「改一下」等未明确具体内容，填 false。modificationNewValue 仅当 modificationClear 为 true 时填写用户希望修改成的具体内容。
7. 若 intent=modification 且 modificationClear=true，填写 modificationTarget、modificationField 或 modificationValueStreamTarget；从【当前页面内容结构】中匹配最具体的字段名/环节名/阶段名。
8. 若涉及价值流图：从【当前页面内容结构】的价值流阶段与环节中精确匹配，modificationValueStreamLevel 填 step/stage/card，modificationValueStreamTarget 填匹配到的环节名或阶段名（必须与结构中出现的名称一致）
9. 若 intent=execute，填写 executeTaskId 和 executeTaskName。当用户说「重新进行需求逻辑构建」「重新构建需求逻辑」等时，intent=execute，executeTaskId=task3
10. summary：用一句话概括用户意图
11. 若无法明确推断，相关字段可填空字符串或合理默认值
12. 只返回 JSON，不要有 markdown 代码块包裹`;

  const ctx = context ? `\n${context}` : '';
  const { content, usage, model, durationMs } = await fetchDeepSeekChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `用户输入：${text}${ctx}` },
  ]);
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : content;
  const parsed = JSON.parse(jsonStr);
  const result = { ...parsed, _llmMeta: { usage, model, durationMs } };

  // 简单查询意图下，进一步判断是全局/宏观查询还是特定任务查询：
  // 若是全局/宏观查询，则在解析卡片中将「当前任务」显示为「整个任务」，stage 为「整体」。
  if (result.intent === 'query') {
    const fullText = String(text || '').toLowerCase();
    const qTarget = String(result.queryTarget || '').toLowerCase();
    const summary = String(result.summary || '').toLowerCase();
    const combined = `${fullText} ${qTarget} ${summary}`;
    const isMacroQuery = /整体|全局|全盘|总体|全貌|整体情况|全局情况|整个项目|整个任务|整个流程|当前阶段|现在什么阶段|目前什么阶段|目前处于什么阶段|现在处于什么阶段|进度|做到哪一步|进行到哪/.test(
      combined
    );
    const taskNames = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...(typeof IT_STRATEGY_TASKS !== 'undefined' ? IT_STRATEGY_TASKS : [])].map(
      (t) => String(t.name || '').toLowerCase()
    );
    const mentionsSpecificTask = taskNames.some((name) => name && combined.includes(name));
    const mentionsValueStreamDetail = /价值流|环节|节点|阶段任务/.test(combined);
    if (isMacroQuery && !mentionsSpecificTask && !mentionsValueStreamDetail) {
      result.taskId = result.taskId || 'all';
      result.taskName = '整个任务';
      result.stage = result.stage || '整体';
    }
  }

  return result;
}

/** 单段兼容入口：与 Mirror 阶段提示一致（旧链路/兜底） */
const VALUE_STREAM_PROMPT = `# Role: 资深业务架构师 (Business Architect)
# Task: 结构化需求还原与基于逻辑特征的价值流VSM阶段聚合 (L1-L2 Mapping)

## 1. 核心输入
* **核心业务流程梳理**: [初步需求→核心业务流程梳理 json：输入包含 step, actor, action, object, logicalConstraint 的数组]
* **人员组织模式**: [初步需求→人员组织模式 json：输入包含 stakeholders，governanceLogic，incentiveHooks]
* **BMC 核心【价值主张】**: [商业模式画布 BMC→ 价值主张 json]
* **需求【显性动机】**: [需求逻辑→需求背后的深层动机 json]
* **最紧急/第一阶段**: [初步需求→roadmap.phase1_Critical JSON：通常含 focus、deliverables 等；见用户消息专节]

## 1.1 最紧急/第一阶段 — 价值流覆盖（硬约束，仅 Mirror 阶段）
- 你必须阅读用户消息中的 **「初步需求 → 最紧急/第一阶段（roadmap.phase1_Critical）」** JSON。其中的 \`focus\` 以及 \`deliverables\` 数组**每一项**均视为须在价值流中可追踪的业务要点。
- 在 **100% 保留**「核心业务流程梳理」中每一条输入 step 的语义镜像（遵守下文「L2 节点镜像」：不得合并具有不同产出物 object 的步骤）的前提下，若某要点尚不能在现有镜像节点中识别，你须通过**追加** Original 类型 \`nodes\` 或**拆分**未违反「不同产出物不得合并」规则的节点，使每个要点至少在某一节点的 \`node_name\`、\`main_object\` 或 \`logic_meta.details\` 中**显式可辨**。
- 在至少一个阶段的 \`clustering_reason\` 中，用简短列表说明本阶段节点如何对应 \`phase1_Critical\` 中的 focus / deliverables（可写「要点→环节名」对应关系）。

## 2. 阶段聚合指引 (L1 Clustering Logic)
请不要预设固定的阶段名称，而是根据以下三个【逻辑切分点】对输入的 Steps 进行动态聚合：

1. **对象状态转换点 (Object Lifecycle)**：
   - 当核心对象从“意向/申请”转变为“正式实体/合同”，或从“在途/处理中”转变为“结案/归档”时，应切分阶段。
2. **核心角色位移 (Actor Pivot)**：
   - 当业务主责角色发生重大切换时（例如从“前端销售”转向“后端交付”，或从“业务员”转向“财务/管理员”），应切分阶段。
3. **空间与时间跨度 (Context Shift)**：
   - 当业务场景从“外部市场/客户互动”转移到“内部资源准备”，或从“日常运营”转移到“异常冲突处理/仲裁”时，应切分阶段。

## 3. 构造协议 (Construction Protocol)
- **命名规范**：根据上述逻辑生成的 L1 阶段名称应具备高度概括性（如：[核心对象]+[状态]，或 [核心价值中心]）。
- **stage_name 与 clustering_reason 字段隔离（硬约束）**：
  - \`stage_name\` **只写**简短阶段标题（概括性短语，通常约 2～15 个汉字或同量级英文），**不得**在标题内或标题末尾用半角 \`()\`、全角 \`（）\` 追加任何说明、注释或聚合理由。
  - 凡需说明「为何将上述节点归为本阶段」「基于对象生命周期 / 角色位移 / 场景切换的哪种依据」等内容，**必须且只能**写入 \`clustering_reason\`；**禁止**把这些说明当作括号备注拼进 \`stage_name\`。
- **L2 节点镜像**：必须 100% 保留原始 \`step\`，严禁合并具有不同产出物（object）的步骤。
- **要素透传**：将原文的 \`logicalConstraint\` 和 \`nodeDescription\` 完整保留在节点的元数据中。

## 4. 输出格式 (Strict JSON)
仅输出一个合法 JSON（可为数组），不得包含 Markdown 代码围栏、前言或后缀。
每个阶段对象必须同时包含 \`stage_name\`（仅短标题）与 \`clustering_reason\`（完整聚合说明），二者语义不得混写。

[
  {
    "stage_name": "根据指引生成的 L1 阶段名",
    "clustering_reason": "简述为何将这些步骤聚合在一起（基于对象/角色/场景的哪种变化）",
    "nodes": [
      {
        "node_id": "N.{阶段序}.{环节序}，如 N.1.1、N.2.3（阶段序与环节序均为从 1 起的整数）",
        "node_name": "环节名称 (原文)",
        "actor": "主责角色",
        "main_object": "核心业务对象",
        "logic_meta": { "constraints": "原文规则", "details": "原文描述" },
        "type": "Original"
      }
    ]
  }
]`;

/** task4 两阶段·阶段一：忠实还原 (The Mirror Stage) */
const VALUE_STREAM_PROMPT_MIRROR = VALUE_STREAM_PROMPT;

/** 已废弃：整图一次性 Hardening（task4 改为按 VSM 阶段逐段调用 `VALUE_STREAM_PROMPT_STAGE_HARDENING`） */
const VALUE_STREAM_PROMPT_HARDENING = '';

/** 已废弃：合成终稿（不再使用独立 Synthesis 大模型调用） */
const VALUE_STREAM_PROMPT_SYNTHESIS = '';

/** task4·按单个 L1 阶段调用：系统提示（§1§2 由用户消息提供素材） */
const VALUE_STREAM_PROMPT_STAGE_HARDENING = `# Role: 数字化架构专家 (Digital Architect)
# Task: [用户消息指定的阶段] 价值流架构加固与无损集成 (One-Stop Stage Hardening)

用户消息将提供 **§1 待处理素材**（目标阶段名 + 该阶段 Original 节点 JSON 数组）与 **§2 架构加固背景**（IT现状 legacySystems、IT Gap、因果关联 JSON）。你必须仅针对该阶段输出**单个**阶段对象 JSON，不得输出其它阶段。

## 3. 补全指引 (The 4-Domain Hardening Protocol)
请在本阶段节点间插入 \`Type: Enhanced\` 支撑节点。插入逻辑必须对标上述背景：
1. **【人】准入闭环**：针对“关系驱动”，增加【角色资质/绑定关系】核验。
2. **【财】对账闭环**：针对“分润与对账难”，在价值转移点增加【流水预记录】或【外部系统同步】。
3. **【物】资源闭环**：针对“资产流失”，增加【资源状态锁定/唯一码核销】。
4. **【事】审计闭环**：针对“纠纷风险”，增加【业务快照存证】或【仲裁证据归档】。
5. **【异常】路径**：为所有审批/申请流补充【驳回/退回】分支逻辑。

## 4. 集成与无损协议 (Lossless Integration)
- **绝对保留**：必须 100% 完整保留原始节点的 \`node_name\`, \`actor\`, \`main_object\` 以及 \`logic_meta\` (含细节描述)，禁止做任何语义缩减。
- **增量插入**：新节点应具有明确的 \`node_id\`，格式为 \`N.{阶段序}.{环节序}\`（与本阶段输出顺序一致，如 N.3.4），以及 \`type: "Enhanced"\`。
- **价值显性化**：每个 Enhanced 节点必须注明 \`gap_resolved\` 字段，精准对应上述【架构加固背景】中的某一项。

## 5. 输出要求 (Strict Output)
- 严禁使用“保持不变”或“...省略”字样，必须输出全量、可直接使用的 JSON。
- 仅输出**一个** JSON 对象（单个阶段），禁止 Markdown 代码围栏、前言或后缀。

## 输出格式 (Strict JSON)
{
  "stage_name": "...",
  "nodes": [
    {
      "node_id": "N.{阶段序}.{环节序}",
      "node_name": "...",
      "actor": "...",
      "main_object": "...",
      "type": "Original/Enhanced",
      "gap_resolved": "若为增强节点必填，否则 null",
      "logic_meta": { "constraints": "...", "details": "..." }
    }
  ]
}`;

if (typeof window !== 'undefined') {
  window.VALUE_STREAM_PROMPT = VALUE_STREAM_PROMPT;
  window.VALUE_STREAM_PROMPT_MIRROR = VALUE_STREAM_PROMPT_MIRROR;
  window.VALUE_STREAM_PROMPT_HARDENING = VALUE_STREAM_PROMPT_HARDENING;
  window.VALUE_STREAM_PROMPT_SYNTHESIS = VALUE_STREAM_PROMPT_SYNTHESIS;
  window.VALUE_STREAM_PROMPT_STAGE_HARDENING = VALUE_STREAM_PROMPT_STAGE_HARDENING;
}

/**
 * task4 价值流完工门槛：
 * - **Session 计划**（`valueStreamDrawSessionsBlock`）：须存在 `hardening_final` 或历史兼容 `synthesis_final` 价值流卡；
 * - **旧两阶段引导**（`valueStreamPhaseIntroBlock`）：须存在 `hardening_final` 卡；
 * - 无上述标记的老数据：视为单阶段路径，保持兼容。
 */
function task4ValueStreamIsFinalForCompletion(messages) {
  const msgs = Array.isArray(messages) ? messages : [];
  const usedSessionPlan = msgs.some((m) => m && m.type === 'valueStreamDrawSessionsBlock');
  if (usedSessionPlan) {
    return msgs.some(
      (m) =>
        m &&
        m.type === 'valueStreamCard' &&
        (m.valueStreamPhase === 'hardening_final' || m.valueStreamPhase === 'synthesis_final'),
    );
  }
  const usedTwoPhase = msgs.some((m) => m && m.type === 'valueStreamPhaseIntroBlock');
  if (!usedTwoPhase) return true;
  return msgs.some((m) => m && m.type === 'valueStreamCard' && m.valueStreamPhase === 'hardening_final');
}

/** task4 Session：两主环节 — Mirror + 分阶段架构加固（子任务在 Mirror 完成后按 VSM stages 动态生成） */
function getDefaultValueStreamDrawSessions() {
  return [
    { stepName: '忠实还原 (The Mirror Stage)', done: false, kind: 'mirror' },
    { stepName: '分阶段架构加固与集成', done: false, kind: 'hardening_per_stage', subSteps: [] },
  ];
}
if (typeof window !== 'undefined') {
  window.getDefaultValueStreamDrawSessions = getDefaultValueStreamDrawSessions;
}

/** IT_STATUS_ANNOTATION_PROMPT 已移至 js/task5ItStatus.js；PAIN_POINT_ANNOTATION_PROMPT、generatePainPointSessions 等已移至 js/task6PainPoint.js */

// [bridge] → core/task8-global-itgap.js (Phase 4A)
function __t8() {
  return globalThis.SmartCto.task8GlobalItGap;
}
function buildGlobalItGapDatasetUserContent(enterpriseContext, businessCanvas, fullProcessVsm) {
  return __t8().buildGlobalItGapDatasetUserContent(enterpriseContext, businessCanvas, fullProcessVsm);
}
function extractJsonObjectFromLlmContent(content) {
  return __t8().extractJsonObjectFromLlmContent(content);
}
function pickGlobalItGapPhaseFields(obj, keys) {
  return __t8().pickGlobalItGapPhaseFields(obj, keys);
}
function mergeGlobalItGapPhaseIntoAccum(accum, phaseObj, keys) {
  return __t8().mergeGlobalItGapPhaseIntoAccum(accum, phaseObj, keys);
}
async function generateGlobalItGapPhaseAnalysis(phaseDef, enterpriseContext, businessCanvas, fullProcessVsm, priorMerged) {
  return __t8().generateGlobalItGapPhaseAnalysis(phaseDef, enterpriseContext, businessCanvas, fullProcessVsm, priorMerged);
}
function pushGlobalItGapPhasePlanBlockAndRender() {
  return __t8().pushGlobalItGapPhasePlanBlockAndRender();
}

/**
 * task8 IT设计补齐：从「任务通知确认」到 Session 计划卡片的诊断日志。
 * 控制台过滤：`[FE:task8-it-design-start]`；关闭：`globalThis.__FE_TASK8_IT_DESIGN_START_LOG = false`
 */
function logTask8ItDesignStart(phase, payload) {
  if (typeof globalThis !== 'undefined' && globalThis.__FE_TASK8_IT_DESIGN_START_LOG === false) return;
  try {
    if (payload !== undefined && payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
      console.warn('[FE:task8-it-design-start]', phase, { ...payload });
    } else {
      console.warn('[FE:task8-it-design-start]', phase, payload);
    }
  } catch (_) {
    console.warn('[FE:task8-it-design-start]', phase, String(payload));
  }
}

/** 主聊天区滚动到指定 `data-msg-index`（用于已有 Session 计划卡已在历史中时的定位）。 */
function scrollProblemDetailChatToMsgIndex(msgIndex) {
  const container = el.problemDetailChatMessages;
  if (!container || msgIndex == null || msgIndex < 0) return;
  requestAnimationFrame(() => {
    const row = container.querySelector(`[data-msg-index="${msgIndex}"]`);
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

/** task8 IT设计补齐：按 BPM 事务节点生成 Session 计划卡片（对齐痛点标注 Session 交互）。 */
function pushItDesignSupplementSessionsBlockAndRender() {
  const item = __appState.currentProblemDetailItem;
  const container = el.problemDetailChatMessages;
  // 与 pushAndSaveProblemDetailChat / saveProblemDetailChat 一致：createdAt 优先否则 id（在线新建案可无 createdAt）
  const caseKey =
    typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
  logTask8ItDesignStart('push-enter', {
    hasItem: !!item,
    caseKey: caseKey || '(empty)',
    hasContainer: !!container,
    msgLen: Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages.length : -1,
  });
  if (!item || !caseKey || !container) {
    logTask8ItDesignStart('push-abort', {
      reason: !item ? 'no-item' : !caseKey ? 'no-caseKey' : 'no-chat-container',
    });
    return;
  }
  const msgs = __appState.problemDetailChatMessages;
  if (!Array.isArray(msgs)) {
    logTask8ItDesignStart('push-abort', { reason: 'messages-not-array' });
    return;
  }
  const lastPlanIdx = msgs.findLastIndex((m) => m && m.type === 'itDesignSupplementSessionsBlock');
  const resolvedSessions = resolveItDesignSupplementSessionsForTask8(item, msgs);
  const designIncomplete =
    resolvedSessions.length > 0 &&
    resolvedSessions.some((s) => !s || s.designOutputJson == null);
  const bpmGateOk =
    typeof window.isItDesignBpmDrawCompleteForItem === 'function'
      ? window.isItDesignBpmDrawCompleteForItem(item, msgs)
      : true;
  const hasUnfinishedPlanWork =
    lastPlanIdx >= 0 && resolvedSessions.length === 0
      ? true
      : designIncomplete || !bpmGateOk;

  if (lastPlanIdx >= 0) {
    if (hasUnfinishedPlanWork) {
      logTask8ItDesignStart('push-skip-existing-plan', {
        reason: 'sessions-or-bpm-not-all-done',
        blockIndex: lastPlanIdx,
        resolvedLen: resolvedSessions.length,
        designIncomplete,
        bpmGateOk,
      });
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, msgs);
      scrollProblemDetailChatToMsgIndex(lastPlanIdx);
      renderProblemDetailHistory();
      renderProblemDetailContent();
      return;
    }
    // 已有计划卡且设计+BPM（含历史二段计划门禁）均已齐：`confirmed` 从未被置 true 会导致误走「重复」短路，此处收束并补「全部确认」块
    let marked = false;
    const nextMsgs = msgs.map((m) => {
      if (m && m.type === 'itDesignSupplementSessionsBlock' && m.confirmed !== true) {
        marked = true;
        return { ...m, confirmed: true };
      }
      return m;
    });
    if (marked) {
      __appState.problemDetailChatMessages = nextMsgs;
      saveProblemDetailChat(caseKey, nextMsgs);
    }
    const v1Done = item.globalItGapAnalysisJson && item.globalItGapAnalysisJson.itDesignSupplementV1 === true;
    const hasPendingAllDone = nextMsgs.some(
      (m) => m && m.type === 'itDesignSupplementAllDoneConfirmBlock' && m.confirmed !== true,
    );
    if (!v1Done && !hasPendingAllDone) {
      pushAndSaveProblemDetailChat({
        type: 'itDesignSupplementAllDoneConfirmBlock',
        content: IT_DESIGN_SUPPLEMENT_ALL_DONE_CONFIRM_CONTENT,
        taskId: 'task8',
        timestamp: getTimeStr(),
        confirmed: false,
      });
    }
    logTask8ItDesignStart('push-skip-plan-already-finished', {
      blockIndex: lastPlanIdx,
      pushedAllDone: !v1Done && !hasPendingAllDone,
      markedPlanConfirmed: marked,
    });
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
    renderProblemDetailHistory();
    renderProblemDetailContent();
    return;
  }
  const pick = pickRawE2eTransactionFlowJsonFromItemAndMessages(item, msgs);
  const hasItemE2e = !!(item?.e2eTransactionFlowJson && typeof item.e2eTransactionFlowJson === 'object');
  const pickStages = pick && Array.isArray(pick.stages) ? pick.stages.length : 0;
  const pickFlat = pick && Array.isArray(pick.transaction_nodes) ? pick.transaction_nodes.length : 0;
  logTask8ItDesignStart('push-e2e-pick', {
    hasItemE2e,
    pickIsNull: pick == null,
    pickStagesLen: pickStages,
    pickTransactionNodesLen: pickFlat,
  });
  const sessions =
    typeof window.generateItDesignSupplementSessions === 'function' ? window.generateItDesignSupplementSessions(pick) : [];
  if (!sessions.length) {
    logTask8ItDesignStart('push-no-sessions', {
      action: 'pushing-system-hint-no-transaction-list',
      generateFn: typeof window.generateItDesignSupplementSessions,
    });
    pushAndSaveProblemDetailChat({
      role: 'system',
      content:
        '当前尚无可用的端到端事务流对象列表。请先在 task7 完成「生成事务流 Session 计划」并「自动顺序执行」，确认合并 BPM JSON 后再开始 IT设计补齐。',
      timestamp: getTimeStr(),
    });
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
    renderProblemDetailHistory();
    renderProblemDetailContent();
    return;
  }
  if (typeof updateDigitalProblemTask8ItDesignPlanReset === 'function') {
    updateDigitalProblemTask8ItDesignPlanReset(caseKey, sessions);
  }
  const list = getDigitalProblems();
  const persistKey = typeof getDigitalProblemPersistKey === 'function' ? getDigitalProblemPersistKey(item) : caseKey;
  const updated = list.find(
    (it) => (typeof getDigitalProblemPersistKey === 'function' ? getDigitalProblemPersistKey(it) : '') === persistKey,
  );
  if (updated) __appState.currentProblemDetailItem = updated;
  pushAndSaveProblemDetailChat({
    type: 'itDesignSupplementSessionsBlock',
    taskId: 'task8',
    interleavedBpmDrawPlan: true,
    sessions,
    timestamp: getTimeStr(),
    confirmed: false,
  });
  logTask8ItDesignStart('push-done', { sessionCount: sessions.length });
  container.innerHTML = '';
  renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
  container.scrollTop = container.scrollHeight;
  renderProblemDetailHistory();
  renderProblemDetailContent();
}
function normalizeGlobalItGapAnalysisShape(raw) {
  return __t8().normalizeGlobalItGapAnalysisShape(raw);
}
function stripRedundantHeadingFromContent(content, label) {
  return __t8().stripRedundantHeadingFromContent(content, label);
}
function buildGlobalItGapStructuredHtmlForSections(analysis, sections, options) {
  return __t8().buildGlobalItGapStructuredHtmlForSections(analysis, sections, options);
}
function buildGlobalItGapStructuredHtml(analysis, options) {
  return __t8().buildGlobalItGapStructuredHtml(analysis, options);
}
function buildGlobalItGapWorkspacePhaseSubcardsHtml(analysis, _options) {
  return __t8().buildGlobalItGapWorkspacePhaseSubcardsHtml(analysis);
}
async function generateGlobalItGapAnalysis(enterpriseContext, businessCanvas, fullProcessVsm) {
  return __t8().generateGlobalItGapAnalysis(enterpriseContext, businessCanvas, fullProcessVsm);
}
function buildPreliminarySummaryForTask8(item) {
  return __t8().buildPreliminarySummaryForTask8(item);
}
function buildGlobalItGapConstraintCompressionSystemPrompt(customerLabel) {
  return __t8().buildGlobalItGapConstraintCompressionSystemPrompt(customerLabel);
}
function getCustomerLabelForGlobalItGap(item) {
  return __t8().getCustomerLabelForGlobalItGap(item);
}
async function runGlobalItGapConstraintCompressionAfterConfirm(analysisJson) {
  return __t8().runGlobalItGapConstraintCompressionAfterConfirm(analysisJson);
}
async function runGlobalItGapAnalysis(isRedo) {
  return __t8().runGlobalItGapAnalysis(isRedo);
}

/** task1 工商确认 → 初步需求引导链路调试日志；设为 `false` 可关闭 */
function logTask1PrelimFlow(phase, payload) {
  if (globalThis.__FE_TASK1_PRELIM_FLOW_LOG === false) return;
  try {
    console.debug('[FE:task1-prelim-flow]', phase, payload && typeof payload === 'object' ? payload : { detail: payload });
  } catch (_) {}
}

/** 案例写入/合并用主键：与 HTTP 适配器 `getItem` 一致，优先 createdAt，否则 id（在线新建案常仅有 id） */
function getDigitalProblemPersistKey(it) {
  if (!it || typeof it !== 'object') return '';
  const ca = it.createdAt != null && String(it.createdAt).trim() !== '' ? String(it.createdAt) : '';
  const id = it.id != null && String(it.id).trim() !== '' ? String(it.id) : '';
  return ca || id;
}
if (typeof globalThis !== 'undefined') globalThis.getDigitalProblemPersistKey = getDigitalProblemPersistKey;

/** task1 工商信息卡：确认后禁用同卡「重做/修正/讨论」等，避免与已进入的初步需求阶段冲突 */
function disableTask1BasicInfoCardActionButtons(confirmBtn) {
  const actions = confirmBtn && confirmBtn.closest ? confirmBtn.closest('.problem-detail-basic-info-card-actions') : null;
  if (!actions) return;
  actions.querySelectorAll('button').forEach((b) => {
    if (b.classList.contains('btn-confirm-basic-info')) {
      b.textContent = '已确认';
      b.disabled = true;
    } else {
      b.disabled = true;
    }
  });
}

/**
 * task1：用户确认工商信息卡后——先落库并刷新工作区（客户基本信息），再在下一帧进入「请反馈客户基本需求」阶段
 *（merge task1PendingPreliminaryRequirement + 下发系统提示 + 重绘聊天），避免与工作区更新抢同一帧。
 */
function finalizeTask1BasicInfoConfirmAndPromptPreliminaryRequirement(parsedBasicInfo) {
  const data = parsedBasicInfo && typeof parsedBasicInfo === 'object' ? parsedBasicInfo : {};
  const item = __appState.currentProblemDetailItem;
  const chatStorageKey = getProblemDetailChatStorageKey(item);
  const persistKey = getDigitalProblemPersistKey(item);
  const msgs = __appState.problemDetailChatMessages;
  logTask1PrelimFlow('finalize-enter', {
    hasItem: !!item,
    persistKey: persistKey || '(empty)',
    chatStorageKey: chatStorageKey || '(empty)',
    msgCount: Array.isArray(msgs) ? msgs.length : 0,
    chatMode: typeof problemDetailChatMode === 'string' ? problemDetailChatMode : '',
  });
  problemDetailConfirmedBasicInfo = data;
  if (persistKey) {
    updateDigitalProblemBasicInfo(persistKey, data, false);
    logTask1PrelimFlow('finalize-basicInfo-persist', { persistKey });
  } else {
    logTask1PrelimFlow('finalize-basicInfo-skip-no-persistKey', {});
  }
  const curItemForBasicInfo = __appState.currentProblemDetailItem || item;
  if (curItemForBasicInfo) {
    __appState.currentProblemDetailItem = { ...curItemForBasicInfo, basicInfo: data };
  }
  let basicCardIdx = -1;
  if (Array.isArray(msgs)) {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].type === 'basicInfoCard') {
        basicCardIdx = i;
        break;
      }
    }
    if (basicCardIdx >= 0) {
      msgs[basicCardIdx] = { ...msgs[basicCardIdx], data, confirmed: true };
      for (let j = basicCardIdx - 1; j >= 0; j--) {
        const q = msgs[j];
        if (q?.type === 'task1LlmQueryBlock') {
          msgs[j] = { ...q, confirmed: true };
          break;
        }
      }
      const curItem = __appState.currentProblemDetailItem || item;
      const saveKey = getProblemDetailChatStorageKey(curItem) || chatStorageKey;
      saveProblemDetailChat(saveKey, msgs);
      logTask1PrelimFlow('finalize-chat-saved', { saveKey: saveKey || '(empty)', basicCardIdx });
    } else {
      logTask1PrelimFlow('finalize-chat-skip-no-basicInfoCard', {});
    }
  }
  renderProblemDetailContent();
  updateProblemDetailChatHeaderLabel();
  renderProblemDetailHistory();

  const PROMPT =
    '请反馈客户的基本需求（请在下方输入框发送，发送后将自动提炼并更新工作区「初步需求」卡片）。';
  const proceed = () => {
    logTask1PrelimFlow('finalize-proceed-rAF', {});
    const mergeKey = getDigitalProblemPersistKey(__appState.currentProblemDetailItem);
    if (mergeKey) {
      mergeDigitalProblemPatch(mergeKey, { task1PendingPreliminaryRequirement: true });
      logTask1PrelimFlow('finalize-merge-patch', {
        mergeKey,
        task1PendingPreliminaryRequirement: __appState.currentProblemDetailItem?.task1PendingPreliminaryRequirement === true,
      });
    } else {
      logTask1PrelimFlow('finalize-merge-skip-no-key', {});
    }
    const msgsAfter = __appState.problemDetailChatMessages;
    const dup =
      Array.isArray(msgsAfter) &&
      msgsAfter.some(
        (m) => m.role === 'system' && typeof m.content === 'string' && m.content.includes('请反馈客户的基本需求'),
      );
    logTask1PrelimFlow('finalize-dup-check', { dup, msgCount: msgsAfter?.length });
    if (!dup) {
      pushAndSaveProblemDetailChat({ role: 'system', content: PROMPT, timestamp: getTimeStr() });
      logTask1PrelimFlow('finalize-pushed-prompt', {
        afterCount: Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages.length : 0,
        saveKey: getProblemDetailChatStorageKey(__appState.currentProblemDetailItem) || '(empty)',
      });
    } else {
      logTask1PrelimFlow('finalize-skip-push-dup', {});
    }
    const chatContainerAfterPrelim = el.problemDetailChatMessages;
    if (chatContainerAfterPrelim) {
      chatContainerAfterPrelim.innerHTML = '';
      renderProblemDetailChatFromStorage(
        chatContainerAfterPrelim,
        Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages : [],
      );
      chatContainerAfterPrelim.scrollTop = chatContainerAfterPrelim.scrollHeight;
    }
    renderProblemDetailContent();
    updateProblemDetailChatHeaderLabel();
    renderProblemDetailHistory();
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(proceed);
  });
}

/**
 * 合并写入案例若干字段（local：快照；online：HTTP 适配器 PUT + 内存 cache）。
 * @param {string} createdAt
 * @param {Record<string, unknown>} patch
 * @returns {Object|null}
 */
function mergeDigitalProblemPatch(createdAt, patch) {
  if (createdAt == null || !patch || typeof patch !== 'object') return null;
  const key = String(createdAt);
  const g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};
  const cfg = g.APP_CONFIG || {};
  if (cfg.MODE === 'online' && typeof g.STORAGE_HTTP_ADAPTER?.updateDigitalProblem === 'function') {
    g.STORAGE_HTTP_ADAPTER.updateDigitalProblem(createdAt, patch);
    const list = typeof getDigitalProblems === 'function' ? getDigitalProblems() : [];
    const idx = list.findIndex((it) => String(it.createdAt || '') === key || String(it.id || '') === key);
    const next = idx >= 0 ? list[idx] : null;
    if (next && __appState.currentProblemDetailItem && String(__appState.currentProblemDetailItem.createdAt || __appState.currentProblemDetailItem.id || '') === key) {
      __appState.currentProblemDetailItem = { ...__appState.currentProblemDetailItem, ...patch };
    }
    return next;
  }
  const list = typeof getDigitalProblems === 'function' ? getDigitalProblems() : [];
  const idx = list.findIndex((it) => String(it.createdAt || '') === key || String(it.id || '') === key);
  if (idx < 0) return null;
  const next = { ...list[idx], ...patch };
  list[idx] = next;
  if (typeof saveDigitalProblemsSnapshot === 'function') saveDigitalProblemsSnapshot(list);
  if (__appState.currentProblemDetailItem && String(__appState.currentProblemDetailItem.createdAt || __appState.currentProblemDetailItem.id || '') === key) {
    __appState.currentProblemDetailItem = next;
  }
  return next;
}

/** getDigitalProblems、saveDigitalProblem、... 已移至 js/storage.js；inferTaskIdFromMessage、shouldIncludeInCommunicationHistory、getCommunicationsByTask、getCommunicationsAsTimeline 已移至 js/communication-history.js */

const TASK1_BASIC_INFO_KEYS = [
  'company_name',
  'credit_code',
  'legal_representative',
  'established_date',
  'registered_capital',
  'business_scope',
  'core_qualifications',
  'official_website',
];

function hasTask1BasicInfoFields(basicInfo) {
  if (!basicInfo || typeof basicInfo !== 'object') return false;
  return TASK1_BASIC_INFO_KEYS.some((key) => {
    const value = basicInfo[key];
    return value != null && String(value).trim() !== '';
  });
}

function hasTask1StartNotificationMessage(taskId) {
  if (!Array.isArray(__appState.problemDetailChatMessages) || !taskId) return false;
  return __appState.problemDetailChatMessages.some((m) => m?.type === 'taskStartNotification' && m.taskId === taskId);
}

function looksLikeTask1BasicInfoInput(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const keywords = [
    '公司', '企业', '工商', '客户', '统一社会信用代码', '信用代码', '法人',
    '成立', '注册资本', '经营范围', '资质', '官网', 'company', 'credit code',
    'legal representative', 'registered capital', 'business scope',
  ];
  const hitCount = keywords.reduce((acc, kw) => acc + (raw.includes(kw) || lower.includes(kw) ? 1 : 0), 0);
  const hasStructuredPair = /[:：]/.test(raw) && /\n/.test(raw);
  // 曾误伤：仅「多行 + 冒号」即视为工商录入，需求/管理制度类长文（含编号、目的、规则等）会走 parseCompanyBasicInfoInput，
  // 得到空字段的 basicInfoCard，且不写入 requirementDetailHistory（须走「补充更多需求」或 awaitingPrelim 深度提炼）。
  const looksLikeRequirementOrRegulationDoc =
    hasStructuredPair &&
    /(目的|规则|条款|需求|流程|学员|业务|所有权|管理|范围|章节|第\s*\d+)/.test(raw);
  if (looksLikeRequirementOrRegulationDoc) {
    return hitCount >= 3;
  }
  return hitCount >= 2 || (hasStructuredPair && hitCount >= 1);
}

function ensureTask1StartNotificationIfPending(reason) {
  const item = resolveProblemItemForTaskNotification() || __appState.currentProblemDetailItem;
  if (!item?.createdAt) return;
  const firstUncompleted = getFirstUncompletedTask(item);
  const task1Completed = isTaskCompleted(item, 'task1');
  const hasConfirmedBasicInfo = hasTask1BasicInfoFields(problemDetailConfirmedBasicInfo || item.basicInfo);
  const wsTid = typeof getWorkspaceViewingTaskId === 'function' ? getWorkspaceViewingTaskId() : null;
  const shouldNotifyTask1 = wsTid === 'task1' && firstUncompleted?.id === 'task1' && !task1Completed;
  const hasTask1Notification = hasTask1StartNotificationMessage('task1');
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug('[FE:task1-entry]', {
      phase: reason,
      firstUncompletedId: firstUncompleted?.id || null,
      isTask1Completed: task1Completed,
      hasConfirmedBasicInfo,
      callShowTask1StartNotification: shouldNotifyTask1 && !hasTask1Notification,
    });
  }
  if (shouldNotifyTask1 && !hasTask1Notification) {
    showTaskStartNotificationIfNeeded('task1', true, TASK_START_NOTIFY_NAVIGATE_PENDING);
  }
}

/** 是否为重置后状态（仅保留初步需求，所有任务视为尚未开始，任务启动通知/已完成·请修改 按钮应可点击） */
function isProblemResetState(item) {
  if (!item) return false;
  const first = getFirstUncompletedTask(item);
  return first?.id === 'task1' && !hasTask1BasicInfoFields(item.basicInfo);
}

/** 判断任务是否已完成（基于 problem 状态） */
function isTaskCompleted(item, taskId) {
  if (!item) return false;
  const completed = item.completedStages || [];
  const wfCompleted = item.workflowAlignCompletedStages || [];
  const itGapCompleted = item.itGapCompletedStages || [];
  switch (taskId) {
    case 'task1': {
      // completedStages 含 0 仅表示工商信息已落库（updateDigitalProblemBasicInfo），不代表企业背景洞察/初步需求+补充链路已结束；
      // 否则补充失败刷新后 isTaskCompleted(task1) 为真 → canonical 落到 task2 → 误发商业画布任务通知。
      if ((item.currentMajorStage ?? 0) > 0) return true;
      const ids = item.completedTaskIds || [];
      if (ids.includes('task1')) return true;
      const msgs = getProblemDetailChatMessagesForCanonical(item);
      if (Array.isArray(msgs)) {
        if (msgs.some((m) => m?.type === 'taskCompleteBlock' && m.taskId === 'task1')) return true;
        if (msgs.some((m) => m?.type === 'taskCompletionConfirmBlock' && m.taskId === 'task1' && m.confirmed)) return true;
      }
      const hasBmc = item.bmc && typeof item.bmc === 'object' && Object.keys(item.bmc).length > 0;
      if (completed.includes(0) && hasBmc) return true;
      return false;
    }
    case 'task2': return completed.includes(1) || !!(item.bmc);
    // task3：不得以「仅有 requirementLogic」推断完成（与 task2/bmc 同类误判）；须 completedStages 含 2 或后端 confirm 写回
    case 'task3': return completed.includes(2);
    // task4–6：workflowAlignCompletedStages 仅应在「已完成」confirm / advanceProblemState 后写入，与输出生成/确认落库解耦（FE-20260325-03）
    case 'task4': return wfCompleted.includes(0) && !!(item.valueStream && !item.valueStream.raw);
    case 'task5': return wfCompleted.includes(1);
    case 'task6': return wfCompleted.includes(2);
    case 'task7': return itGapCompleted.includes(0);
    case 'task8': {
      const msgs = getProblemDetailChatMessagesForCanonical(item);
      const useStrictTask8Completion =
        (Array.isArray(item.itDesignSupplementSessions) && item.itDesignSupplementSessions.length > 0) ||
        (Array.isArray(msgs) && msgs.some((m) => m && m.type === 'itDesignSupplementSessionsBlock'));
      const hasFormalTask8Completion =
        (Array.isArray(item.itGapCompletedStages) && item.itGapCompletedStages.includes(1)) ||
        (Array.isArray(msgs) &&
          (msgs.some((m) => m?.type === 'taskCompleteBlock' && m.taskId === 'task8') ||
            msgs.some((m) => m?.type === 'taskCompletionConfirmBlock' && m.taskId === 'task8' && m.confirmed)));
      if (useStrictTask8Completion && !hasFormalTask8Completion) return false;
      if (!item.globalItGapAnalysisJson) return false;
      if (
        typeof window.isItDesignBpmDrawCompleteForItem === 'function' &&
        !window.isItDesignBpmDrawCompleteForItem(item, Array.isArray(msgs) ? msgs : [])
      ) {
        return false;
      }
      return true;
    }
    case 'task9': {
      // 仅当用户确认 task9（对象状态机构建）完工且历史链路下完成上下文压缩等条件满足时，itGapCompletedStages 才写入 2
      return itGapCompleted.includes(2);
    }
    case 'task12':
    case 'task13':
    case 'task14':
    case 'task15': {
      const ids = item.completedTaskIds || [];
      if (ids.includes(taskId)) return true;
      if (
        taskId === 'task12' &&
        (ids.includes('task11') || ids.includes('strategy-0') || ids.includes('strategy-1') || ids.includes('task10'))
      ) {
        return true;
      }
      return false;
    }
    default: return false;
  }
}

/**
 * 供 canonical 判定：仅当内存消息与 `problemDetailChatMessagesCaseKey` 绑定到入参案例时才用内存数组；
 * 否则读持久化（避免换案后、initProblemDetailChat 之前仍持有上一案 messages 导致大阶段/task4 等误判串案）。
 */
function getProblemDetailChatMessagesForCanonical(item) {
  const itemKey =
    item && typeof getProblemDetailChatStorageKey === 'function'
      ? String(getProblemDetailChatStorageKey(item) || '').trim()
      : item?.createdAt != null
        ? String(item.createdAt).trim()
        : '';
  const mem = Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages : [];
  const rawMemKey = __appState.problemDetailChatMessagesCaseKey;
  const memKey = rawMemKey != null && String(rawMemKey).trim() !== '' ? String(rawMemKey).trim() : '';
  if (mem.length > 0 && itemKey && memKey && memKey === itemKey) return mem;
  if (itemKey && typeof getProblemDetailChats === 'function') {
    const persisted = getProblemDetailChats()[itemKey];
    return Array.isArray(persisted) ? persisted : [];
  }
  if (item?.createdAt && typeof getProblemDetailChats === 'function') {
    const persisted = getProblemDetailChats()[item.createdAt];
    return Array.isArray(persisted) ? persisted : [];
  }
  return [];
}

/**
 * 【全案唯一·实现体】推导当前档案的「管线应对齐的下一任务」（canonical）：步骤条 `--current` 高亮、`showNextTaskStartNotification`（上一任务刚完成后的下一任务）、`syncProblemDetailWorkspaceToCanonicalTask` 等与推进语义相关的逻辑经本函数（或别名 `resolveCanonicalProblemCurrentTaskState`）。
 * **与「工作区当前在看哪一 task」解耦**：对话顶栏阶段徽章、沟通历史每行 `getTaskStatusText`、`ensureTask1/4/10RefreshNotification*` 等以 `getWorkspaceViewingTaskId()` 为准（FE-20260328-27）。**刷新/重入补发** `showNextTaskStartNotificationIfCurrentTaskPendingOnly`（`NAVIGATE_PENDING`）目标 task 须与管线 **canonical `taskId` 一致**，避免 viewing 大阶段滞后（如仍判在工作流对齐）时 `wsTid` 落在已完成 task6 导致 task7 通知被 `getTaskStatusText===已完成` 拦截（FE-20260328-29）。
 * 使用合并态 item + 聊天 messages；**不依据**聊天区未点击/未确认的输出卡定义 canonical 当前任务或「已完成」；**首个未完成任务**仅以 `isTaskCompleted` 判定；task10 等特殊补丁仍读 messages。`currentMajorStage === 2/3` 时将 canonical 约束在 task7–9 / task10–15，与「已进入该大阶段」语义一致（FE-20260328-24）。
 * [PROTOCOL]: 变更判定规则时须同步更新本注释、getCanonicalCurrentProblemFollowTaskState、updateProblemDetailChatHeaderLabel、getTaskStatusText（含 FE-20260328-25/27、task4 `isTask4InValueStreamModificationPipeline`）/isProblemDetailModificationWaiting、syncProblemDetailWorkspaceToCanonicalTask、showTaskStartNotificationIfNeeded/showNextTaskStartNotification*、frontend/AGENTS.md
 */
function getCanonicalCurrentProblemFollowTaskState(item, messages) {
  const empty = {
    taskId: null,
    taskName: '—',
    majorStage: 0,
    itGapSubstepIndex: null,
    itStrategySubstepIndex: null,
    allComplete: true,
  };
  if (!item) return { ...empty, allComplete: false };
  // 必须按入参 item 与列表合并；勿用无参 resolve（否则首页多卡会全部吃到「当前打开的详情案例」的合并态，导致当前任务显示一致）
  const merged = typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification(item) || item : item;
  const allTasks = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...IT_STRATEGY_TASKS];
  const msgs = Array.isArray(messages) ? messages : null;
  // 推导「当前应对齐的下一任务」时仅以状态机 isTaskCompleted 为准；聊天区残留的早期未确认输出卡不得把 canonical 拉回 task1（否则 ITGap 阶段顶栏误显示企业背景洞察、且 showNext 被 hasUnconfirmedOutputCardBeforeTask 误拦）
  const taskDone = (tid) => isTaskCompleted(merged, tid);

  let candidate = allTasks.find((t) => !taskDone(t.id)) || null;

  if (candidate?.id === 'task1' && Number(merged.currentMajorStage) === 1) {
    const workflowAlignTasks = allTasks.filter((t) => ['task4', 'task5', 'task6'].includes(t.id));
    const wf = workflowAlignTasks.find((t) => !taskDone(t.id));
    if (wf) candidate = wf;
  }
  // 已进入 ITGap 大阶段时，当前任务应对齐 task7–9 中首个未完成；避免 majorStage 与 completedStages 短暂不一致时顶栏误显示需求理解 task1（FE-20260328-24）
  if (Number(merged.currentMajorStage) === 2) {
    const itGapTasks = allTasks.filter((t) => ['task7', 'task8', 'task9'].includes(t.id));
    const ig = itGapTasks.find((t) => !taskDone(t.id));
    candidate = ig || allTasks.find((t) => !taskDone(t.id)) || null;
  }
  // 已进入 IT 策略大阶段时，当前任务应对齐 task10–15 中首个未完成
  if (Number(merged.currentMajorStage) === 3) {
    const stIds = ['task12', 'task13', 'task14', 'task15'];
    const stTasks = allTasks.filter((t) => stIds.includes(t.id));
    const st = stTasks.find((t) => !taskDone(t.id));
    candidate = st || allTasks.find((t) => !taskDone(t.id)) || null;
  }

  if (!candidate) {
    return { ...empty, allComplete: true };
  }
  const taskId = candidate.id;
  const taskName = candidate.name || '—';
  const majorStage = getMajorStageByTaskId(taskId);
  let itGapSubstepIndex = null;
  if (taskId === 'task7') itGapSubstepIndex = 0;
  else if (taskId === 'task8') itGapSubstepIndex = 1;
  else if (taskId === 'task9') itGapSubstepIndex = 2;
  const siMap = { task12: 0, task13: 1, task14: 2, task15: 3 };
  const itStrategySubstepIndex = siMap[taskId] !== undefined ? siMap[taskId] : null;
  return {
    taskId,
    taskName,
    majorStage,
    itGapSubstepIndex,
    itStrategySubstepIndex,
    allComplete: false,
  };
}

/** 历史命名；与 `getCanonicalCurrentProblemFollowTaskState` 相同，供旧代码与调试引用。 */
function resolveCanonicalProblemCurrentTaskState(item, messages) {
  return getCanonicalCurrentProblemFollowTaskState(item, messages);
}

/**
 * 当用户正在查看「案例已推进到的当前大阶段」时，将 IT 策略 / ITGap 子步骤与 canonical 当前任务对齐，避免内存索引与顶栏/沟通历史分叉。
 */
function syncProblemDetailWorkspaceToCanonicalTask(item) {
  if (!item) return;
  const messages = getProblemDetailChatMessagesForCanonical(item);
  const canon = getCanonicalCurrentProblemFollowTaskState(item, messages);
  if (!canon || canon.allComplete) return;
  const itemMajor = Math.max(0, Math.min(3, Number(item.currentMajorStage) || 0));
  const viewing = Math.max(0, Math.min(3, Number(problemDetailViewingMajorStage) || 0));
  if (viewing !== itemMajor) return;
  if (viewing !== canon.majorStage) return;
  const tasks = Array.isArray(IT_STRATEGY_TASKS) ? IT_STRATEGY_TASKS : [];
  // 仅当内存子步骤「落后于」canonical 时向前对齐（修复误停在 task10）；用户主动点到更后子步骤预览时不回拉，避免与点击冲突。
  if (viewing === 3 && canon.itStrategySubstepIndex != null && tasks.length > 0) {
    const curIdx = Math.max(0, Math.min(tasks.length - 1, Number(itStrategyPlanViewingSubstep) || 0));
    if (curIdx < canon.itStrategySubstepIndex) {
      itStrategyPlanViewingSubstep = canon.itStrategySubstepIndex;
      persistItStrategyPlanSubstepForCaseKey(getProblemFollowCaseKey(item), canon.itStrategySubstepIndex);
    }
  }
  if (viewing === 2 && canon.itGapSubstepIndex != null) {
    const curIdx = Math.max(0, Math.min(2, Number(itGapViewingSubstep) || 0));
    if (curIdx < canon.itGapSubstepIndex) {
      itGapViewingSubstep = canon.itGapSubstepIndex;
    }
  }
}

/** 用户从任务完工确认块点「请修改」后，内存等待修改意见（与在线 revise 后引导一致） */
function isProblemDetailModificationWaiting(taskId, item) {
  const w = problemDetailWaitingForFeedback;
  if (!w || !taskId || !item) return false;
  if (String(w.taskId || '') !== String(taskId)) return false;
  if (w.type !== 'modification') return false;
  const itemKey = typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
  if (!itemKey || String(w.createdAt || '') !== String(itemKey)) return false;
  return true;
}

/**
 * task4 价值流修改链：确认「修改意图」后会清空 problemDetailWaitingForFeedback，但聊天中仍有未完成的修改节点（二次确认、新提示词卡、完工确认重跑等），须仍标「修改中」与顶栏一致（FE-20260405-02）。
 * @param {unknown[]} messages
 */
function isTask4ValueStreamModificationActiveFromChat(messages) {
  const msgs = Array.isArray(messages) ? messages : [];
  return msgs.some((m) => {
    if (!m) return false;
    const tid = String(m.taskId || '').trim();
    if (m.type === 'valueStreamModificationRegenerateNotifyBlock' && tid === 'task4' && !m.confirmed) return true;
    if (m.type === 'modificationIntentConfirmBlock' && tid === 'task4' && !m.confirmed) return true;
    if (m.type === 'modificationNewPromptConfirmBlock' && tid === 'task4' && !m.confirmed) return true;
    if (
      m.type === 'taskCompletionConfirmBlock' &&
      m.taskId === 'task4' &&
      !m.confirmed &&
      m.userChoseModify
    ) {
      return true;
    }
    return false;
  });
}

/** task4 修改链：内存 bundle 在「确认新提示词 → Session 自动执行 → clear」前始终存在，此间聊天可能已无未确认块（FE-20260405-02）。 */
function isTask4InValueStreamModificationPipeline(item, messages) {
  if (!item) return false;
  if (typeof isTaskCompleted === 'function' && isTaskCompleted(item, 'task4')) return false;
  const sk = typeof getProblemDetailChatStorageKey === 'function' ? String(getProblemDetailChatStorageKey(item) || '').trim() : '';
  if (sk && getTask4ValueStreamModificationBundle(sk)) return true;
  return isTask4ValueStreamModificationActiveFromChat(messages);
}

function isTask10RolePermissionAuditInProgress() {
  return false;
}

/**
 * task1 顶栏阶段：刷新后 `problemDetailWaitingForFeedback` 等内存态丢失时，仅凭「是否已点任务启动确认」会误标为待执行。
 * 若聊天/持久化中已有工商确认、初步需求提炼/跟进/补充修订等痕迹，视为已实质开展企业背景洞察（FE-20260331）。
 */
function task1HasSubstantiveProgressForPhaseBadge(item, messages) {
  if (!item || !Array.isArray(messages)) return false;
  const merged =
    typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() || item : item;
  if (messages.some((m) => m?.type === 'basicInfoCard' && m.confirmed)) return true;
  if (messages.some((m) => m?.type === 'task1LlmQueryBlock')) return true;
  if (messages.some((m) => m?.type === 'preliminaryRequirementFollowupBlock')) return true;
  if (messages.some((m) => m?.type === 'modificationRegenerateLlmQueryBlock' && m.taskId === 'task1')) return true;
  if (
    messages.some(
      (m) =>
        m?.role === 'system' &&
        typeof m.content === 'string' &&
        (m.content.includes('请反馈客户的基本需求') || m.content.includes('请继续补充客户需求')),
    )
  ) {
    return true;
  }
  if (
    typeof isPreliminaryRequirementV2Shape === 'function' &&
    isPreliminaryRequirementV2Shape(merged?.preliminaryReq || {})
  ) {
    return true;
  }
  return false;
}

/**
 * 根据问题单与聊天记录推导任务状态：已完成 / 修改中 / 审计中 / 进行中 / 待执行（沟通历史、顶栏阶段徽章与 **工作区** `getWorkspaceViewingTaskId` 对齐）。
 *
 * 【产品口径·FE-20260328-25】档案进入某一任务的「当前环节」时，默认 **待执行**；用户在聊天区对「我即将开始【…】任务」`taskStartNotification` 点击确认（`confirmed`）后，该任务（且为 **工作区当前展示** 的 task 时）才为 **进行中**。不因已有产出卡/过程日志 alone 标成进行中。
 * 【FE-20260328-27】待执行/进行中相对 **工作区当前 task**，非 canonical `taskId`；已完成仍仅看 `isTaskCompleted`。
 * 【FE-20260328-34】task10：确认使用新提示词重新生成后清除修改等待态即回「进行中」；确认开启审计至审计结果落块前为「审计中」。
 * 【FE-20260405-02】task4：确认修改意图会清空 `problemDetailWaitingForFeedback`，须结合聊天未完成块与 `getTask4ValueStreamModificationBundle` 仍判「修改中」。
 */
function getTaskStatusText(item, taskId, allTasks, messages) {
  if (!item || !taskId || !allTasks?.length) return '—';
  const merged = typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() || item : item;
  const taskDone = (tid) => isTaskCompleted(merged, tid);
  if (taskDone(taskId)) {
    if (taskId === 'task1') logTask1PrelimStatus('status', { result: '已完成', reason: 'taskDone' });
    return '已完成';
  }
  if (isProblemDetailModificationWaiting(taskId, merged)) {
    if (taskId === 'task1') {
      const w = problemDetailWaitingForFeedback;
      logTask1PrelimStatus('status', {
        result: '修改中',
        reason: 'waitingForModification',
        waiting: w
          ? {
              taskId: w.taskId,
              type: w.type,
              prelimSupplement: !!w.prelimSupplement,
              prelimSupplementModify: !!w.prelimSupplementModify,
              createdAt: w.createdAt,
            }
          : null,
      });
    }
    return '修改中';
  }
  const msgsForTask4Mod = Array.isArray(messages) ? messages : [];
  if (taskId === 'task4' && isTask4InValueStreamModificationPipeline(merged, msgsForTask4Mod)) {
    return '修改中';
  }
  const workspaceTid = typeof getWorkspaceViewingTaskId === 'function' ? getWorkspaceViewingTaskId() : null;
  if (workspaceTid && workspaceTid === taskId) {
    const msgsSafe = Array.isArray(messages) ? messages : [];
    // task8：聊天区确认「即将针对端到端事务流开展 IT设计补齐」即视为已进入 IT设计补齐 工作区任务过程（与 taskStartNotification 并列口径）
    if (
      taskId === 'task8' &&
      msgsSafe.some((m) => m && m.type === 'globalItGapStartBlock' && m.confirmed)
    ) {
      return '进行中';
    }
    const startMsgs = msgsSafe.filter((m) => m && m.type === 'taskStartNotification' && m.taskId === taskId);
    if (startMsgs.length > 0) {
      const hasConfirmedStart = startMsgs.some((m) => m.confirmed);
      if (!hasConfirmedStart) {
        if (
          taskId === 'task1' &&
          task1HasSubstantiveProgressForPhaseBadge(merged, msgsSafe)
        ) {
          logTask1PrelimStatus('status', {
            result: '进行中',
            reason: 'task1SubstantiveProgressWithoutStartConfirm',
            workspaceTid,
            taskStartCount: startMsgs.length,
          });
          return '进行中';
        }
        if (taskId === 'task1') {
          logTask1PrelimStatus('status', {
            result: '待执行',
            reason: 'taskStartUnconfirmed',
            workspaceTid,
            taskStartCount: startMsgs.length,
          });
        }
        return '待执行';
      }
    } else {
      if (
        taskId === 'task1' &&
        task1HasSubstantiveProgressForPhaseBadge(merged, msgsSafe)
      ) {
        logTask1PrelimStatus('status', {
          result: '进行中',
          reason: 'task1SubstantiveProgressNoStartMsg',
          workspaceTid,
        });
        return '进行中';
      }
      if (taskId === 'task1') {
        logTask1PrelimStatus('status', { result: '待执行', reason: 'noTaskStartNotification', workspaceTid });
      }
      return '待执行';
    }
    if (taskId === 'task1') {
      logTask1PrelimStatus('status', { result: '进行中', reason: 'workspaceCurrentAndStarted', workspaceTid });
    }
    return '进行中';
  }
  if (taskId === 'task1') {
    logTask1PrelimStatus('status', { result: '待执行', reason: 'notWorkspaceCurrentTask', workspaceTid });
  }
  return '待执行';
}

function openTaskTracking(item) {
  __appState.currentProblemDetailItem = item;
  const createdAt = item?.createdAt;
  if (!createdAt) return;
  const customerName = (item.customerName || item.customer_name || '').trim() || '未命名';
  if (el.taskTrackingTitle) el.taskTrackingTitle.textContent = `${customerName} - 任务追踪`;
  const trackingData = getTaskTrackingData()[createdAt] || {};
  const chats = getProblemDetailChats()[createdAt] || [];
  const communications = getCommunicationsByTask(createdAt, chats);
  renderTaskTrackingList(item, trackingData, communications);
  renderTaskTrackingDetail(null);
  if (el.taskTrackingDetail) {
    el.taskTrackingDetail.innerHTML = '<p class="task-tracking-detail-placeholder">请从左侧选择任务查看详情</p>';
  }
  saveRouteState('taskTracking', { createdAt });
  switchView('taskTracking');
}

function renderTaskTrackingList(item, trackingData, communications) {
  const container = el.taskTrackingList;
  if (!container) return;
  container.innerHTML = FOLLOW_TASKS.map((task) => {
    const completed = isTaskCompleted(item, task.id);
    const taskData = trackingData[task.id] || {};
    const objective = taskData.objective ?? task.objective;
    const evaluationCriteria = taskData.evaluationCriteria ?? task.evaluationCriteria;
    const comms = communications[task.id] || [];
    const commCount = comms.length;
    const cls = completed ? ' task-tracking-item-done' : '';
    return `
      <div class="task-tracking-item${cls}" data-task-id="${task.id}" role="button" tabindex="0">
        <div class="task-tracking-item-header">
          <span class="task-tracking-item-name">${escapeHtml(task.id.charAt(0).toUpperCase() + task.id.slice(1) + '｜' + task.name)}</span>
          ${completed ? '<span class="task-tracking-item-check">✅</span>' : ''}
        </div>
        <div class="task-tracking-item-meta">
          <span class="task-tracking-item-stage">${escapeHtml(task.stage)}</span>
          ${commCount > 0 ? `<span class="task-tracking-item-comm">${commCount} 条沟通</span>` : ''}
        </div>
      </div>`;
  }).join('');
  container.querySelectorAll('.task-tracking-item').forEach((el) => {
    el.addEventListener('click', () => {
      const taskId = el.dataset.taskId;
      const task = FOLLOW_TASKS.find((t) => t.id === taskId);
      if (task) renderTaskTrackingDetail(task, item, trackingData[taskId], communications[taskId] || []);
    });
  });
}

function renderTaskTrackingDetail(task, item, taskData, communications) {
  const container = el.taskTrackingDetail;
  if (!container) return;
  if (!task) {
    container.innerHTML = '<p class="task-tracking-detail-placeholder">请从左侧选择任务查看详情</p>';
    return;
  }
  const def = FOLLOW_TASKS.find((t) => t.id === task.id) || task;
  const objective = (taskData?.objective ?? def.objective) || '—';
  const evaluationCriteria = (taskData?.evaluationCriteria ?? def.evaluationCriteria) || '—';
  const intentLabels = { query: '简单查询', modification: '反馈修改意见', execute: '执行操作', discussion: '讨论请教' };
  const commsHtml = communications.length === 0
    ? '<p class="task-tracking-comm-empty">暂无沟通记录</p>'
    : communications.map((c) => {
        const timeStr = c.time ? formatChatTime(c.time) : '—';
        const contentStr = typeof c.content === 'object' ? JSON.stringify(c.content, null, 2) : c.content;
        let titleLabel = c.speaker;
        try {
          const parsed = typeof c.content === 'string' ? JSON.parse(c.content) : c.content;
          if (parsed?.type === 'intentExtractionCard' && parsed?.data?.intent != null) {
            const intentLabel = intentLabels[parsed.data.intent] || parsed.data.intent || '—';
            titleLabel = `用户意图提炼：${intentLabel}`;
          }
        } catch (_) {}
        return `
        <div class="task-tracking-comm-item">
          <div class="task-tracking-comm-meta">
            <span class="task-tracking-comm-speaker">${escapeHtml(titleLabel)}</span>
            <span class="task-tracking-comm-time">${escapeHtml(timeStr)}</span>
          </div>
          <pre class="task-tracking-comm-content">${escapeHtml(contentStr)}</pre>
        </div>
      `;
      }).join('');
  container.innerHTML = `
    <div class="task-tracking-detail-card">
      <h3 class="task-tracking-detail-title">${escapeHtml(task.id.charAt(0).toUpperCase() + task.id.slice(1) + '｜' + task.name)}</h3>
      <div class="task-tracking-detail-section">
        <h4>归属阶段</h4>
        <p>${escapeHtml(task.stage)}</p>
      </div>
      <div class="task-tracking-detail-section">
        <h4>任务目标</h4>
        <p>${escapeHtml(objective)}</p>
      </div>
      <div class="task-tracking-detail-section">
        <h4>评估标准</h4>
        <p>${escapeHtml(evaluationCriteria)}</p>
      </div>
      <div class="task-tracking-detail-section">
        <h4>任务过程日志</h4>
        <div class="task-tracking-comm-list">${commsHtml}</div>
      </div>
    </div>`;
}

function truncateTo20(str) {
  const s = (str != null ? String(str).trim() : '') || '';
  if (s.length <= 20) return s;
  return s.slice(0, 20) + '…';
}

function formatProblemDate(createdAt) {
  if (!createdAt) return '—';
  try {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return String(createdAt);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return String(createdAt);
  }
}

/** 与 storage-http-adapter 聊天缓存主键一致：有服务端 id 时优先 id（与 URL caseId、messages API 一致），否则 createdAt（纯本地案） */
function getProblemDetailChatStorageKey(item) {
  if (!item) return '';
  const idStr = item.id != null && String(item.id).trim() !== '' ? String(item.id).trim() : '';
  const caStr = item.createdAt != null && String(item.createdAt).trim() !== '' ? String(item.createdAt).trim() : '';
  return idStr || caStr;
}

/** 与聊天区「确认」按钮对齐：取**最后一条**同 taskId 的启动通知写入 confirmed，避免 taskId 类型不一致时 findIndex 未命中导致 runBmcGeneration 门禁失败 */
function findLastTaskStartNotificationIndex(messages, taskId) {
  if (!Array.isArray(messages) || taskId == null || String(taskId).trim() === '') return -1;
  const tid = String(taskId);
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.type === 'taskStartNotification' && String(m.taskId || '') === tid) return i;
  }
  return -1;
}

function getProblemFollowCompatibleCaseKeys(item) {
  if (!item) return [];
  const keys = [];
  if (item.id != null && String(item.id).trim()) keys.push(String(item.id).trim());
  if (item.createdAt != null && String(item.createdAt).trim()) keys.push(String(item.createdAt).trim());
  return [...new Set(keys)];
}

function isProblemFollowCaseKeyMatched(item, caseKey) {
  const normalized = caseKey == null ? '' : String(caseKey).trim();
  if (!normalized) return false;
  return getProblemFollowCompatibleCaseKeys(item).includes(normalized);
}

/** local IndexedDB / online HTTP 缓存是否已回填到适配器（避免空缓存时误写占位消息） */
function isProblemDetailStorageHydrated() {
  // [bridge] → core/app-state.js (Phase 1B)
  return globalThis.SmartCto.appState.isProblemDetailStorageHydrated();
}

/** 存储就绪后若当前停留在问题详情，重载聊天与沟通历史 */
function refreshProblemDetailChatIfOpen() {
  if (!el?.problemDetailView || el.problemDetailView.hidden) return;
  const item = __appState.currentProblemDetailItem;
  if (!item || !getProblemDetailChatStorageKey(item)) return;
  initProblemDetailChat();
  __appState.currentProblemDetailItem = applyE2eTransactionFlowHydrationFromMessages(
    __appState.currentProblemDetailItem,
    __appState.problemDetailChatMessages,
    'refreshProblemDetailChatIfOpen',
  );
  const pushedPrelim = pushTask1PreliminaryLlmQueryFromCaseIfNeeded(__appState.currentProblemDetailItem, 'refreshProblemDetailChatIfOpen');
  if (pushedPrelim) rerenderProblemDetailChatFromStorageState();
  renderProblemDetailHistory();
  renderProblemDetailContent();
  if (typeof updateProblemDetailChatDiscussionIndicator === 'function') updateProblemDetailChatDiscussionIndicator();
  updateFlowExceptionResumeButtonVisibility();
}

/** IT 策略子步骤 session 键前缀；与 getProblemFollowCaseKey 组合，避免刷新后误回 task10（FE-20260328） */
const IT_STRATEGY_SUBSTEP_SESSION_PREFIX = 'itStrategyPlanSubstep_v1_';

function itStrategyPlanSubstepSessionKey(caseKey) {
  return IT_STRATEGY_SUBSTEP_SESSION_PREFIX + String(caseKey || '');
}

function persistItStrategyPlanSubstepForCaseKey(caseKey, subIdx) {
  try {
    if (!caseKey) return;
    const tasks = Array.isArray(IT_STRATEGY_TASKS) ? IT_STRATEGY_TASKS : [];
    const maxIdx = tasks.length > 0 ? tasks.length - 1 : 5;
    const n = Math.max(0, Math.min(maxIdx, Number(subIdx) || 0));
    sessionStorage.setItem(itStrategyPlanSubstepSessionKey(caseKey), String(n));
  } catch (_) {}
}

function readPersistedItStrategyPlanSubstepIndex(caseKey) {
  try {
    if (!caseKey) return null;
    const raw = sessionStorage.getItem(itStrategyPlanSubstepSessionKey(caseKey));
    if (raw == null) return null;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return null;
    const tasks = Array.isArray(IT_STRATEGY_TASKS) ? IT_STRATEGY_TASKS : [];
    const maxIdx = tasks.length > 0 ? tasks.length - 1 : 5;
    if (n < 0 || n > maxIdx) return null;
    return n;
  } catch (_) {
    return null;
  }
}

/**
 * 进入详情或切换到大阶段 3 时恢复 IT 策略子步骤：以首个未完成任务为准；
 * 若推导落在 task10（sub=0）但 session 中记录在更后且该任务仍未完，则用 session 纠正（如 task11 重启后 completedTaskIds 与列表短暂不一致）。
 */
function resolveItStrategyPlanOpeningSubstep(item, caseKey, subFromData) {
  const tasks = Array.isArray(IT_STRATEGY_TASKS) ? IT_STRATEGY_TASKS : [];
  const maxIdx = tasks.length > 0 ? tasks.length - 1 : 5;
  let sub = Math.max(0, Math.min(maxIdx, Number(subFromData) || 0));
  const persisted = readPersistedItStrategyPlanSubstepIndex(caseKey);
  if (persisted != null && persisted >= 1 && sub === 0) {
    const tid = tasks[persisted]?.id;
    if (tid && item && !isTaskCompleted(item, tid)) {
      sub = persisted;
    }
  }
  persistItStrategyPlanSubstepForCaseKey(caseKey, sub);
  return sub;
}

function openProblemDetail(item, options) {
  if (lastModificationClarification && lastModificationClarification.createdAt !== item?.createdAt) {
    lastModificationClarification = null;
  }
  openingProblemDetailInProgress = true;
  lastCanonTaskIdForWorkspaceScroll = null;
  const caseId = item?.id ?? item?.createdAt;
  __appState.currentProblemDetailItem = item;
  // 换案首帧：失效聊天内存绑定，避免 canonical / 抬升大阶段仍读上一案 messages（FE-20260403 串案修复）
  __appState.problemDetailChatMessagesCaseKey = null;
  if (problemDetailWaitingForFeedback && item) {
    const ik =
      typeof getProblemDetailChatStorageKey === 'function'
        ? String(getProblemDetailChatStorageKey(item) || '').trim()
        : String(item.createdAt || item.id || '').trim();
    const wk = String(problemDetailWaitingForFeedback.createdAt || '').trim();
    if (!ik || wk !== ik) problemDetailWaitingForFeedback = null;
  }
  currentProblemDetailTaskSummaries = [];
  problemDetailConfirmedBasicInfo = item.basicInfo || null;
  // FE-20260331：企业背景洞察 task1 在 V2 流程下须在用户点「没有更多补充」并写入 taskCompleteBlock 后才收官；不得在仅已有工商信息时写入 completedStages 0，否则 isTaskCompleted(task1) 误判、步骤条跳到 task2（刷新后顶栏对 task2 显示待执行）。
  const openChatKey =
    item && typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
  const openChats =
    typeof getProblemDetailChats === 'function'
      ? getProblemDetailChats()[openChatKey || item.createdAt] || []
      : [];
  const mergedForOpen =
    typeof resolveProblemItemForTaskNotification === 'function'
      ? resolveProblemItemForTaskNotification() || __appState.currentProblemDetailItem
      : __appState.currentProblemDetailItem;
  let majorStage = Number(mergedForOpen.currentMajorStage) || 0;
  const canonOpen = getCanonicalCurrentProblemFollowTaskState(mergedForOpen, openChats);
  // 持久化 major 落后于管线首个未完成任务所属大阶段时抬升内存态（如工作流已完成但 currentMajorStage 仍为 1），避免 wsTid 误判 task6、吞掉 task7 启动通知（FE-20260328-29）
  if (!canonOpen.allComplete && typeof canonOpen.majorStage === 'number' && majorStage < canonOpen.majorStage) {
    majorStage = canonOpen.majorStage;
    __appState.currentProblemDetailItem = { ...__appState.currentProblemDetailItem, currentMajorStage: majorStage };
  }
  problemDetailViewingMajorStage = majorStage;
  logTaskPhaseNotificationDebug('openProblemDetail:viewing', {
    caseKey: openChatKey || item?.createdAt,
    persistedMajor: Number(mergedForOpen.currentMajorStage) || 0,
    chosenMajorStage: majorStage,
    liftedFromCanon: !canonOpen.allComplete && typeof canonOpen.majorStage === 'number' && (Number(mergedForOpen.currentMajorStage) || 0) < canonOpen.majorStage,
    canonTaskId: canonOpen?.taskId,
    canonMajorStage: canonOpen?.majorStage,
    canonAllComplete: !!canonOpen?.allComplete,
    openChatsLen: openChats.length,
    viewingMajor: problemDetailViewingMajorStage,
  });
  // IT 策略 / ITGap：子步骤与 getCanonicalCurrentProblemFollowTaskState 同源，再结合 session 纠正（resolveItStrategyPlanOpeningSubstep）
  if (majorStage === 3) {
    const canon = getCanonicalCurrentProblemFollowTaskState(mergedForOpen, openChats);
    const subFromData = canon.itStrategySubstepIndex ?? 0;
    const caseKey = getProblemFollowCaseKey(item);
    itStrategyPlanViewingSubstep = resolveItStrategyPlanOpeningSubstep(item, caseKey, subFromData);
  }
  if (majorStage === 2) {
    const canon = getCanonicalCurrentProblemFollowTaskState(mergedForOpen, openChats);
    itGapViewingSubstep =
      canon.itGapSubstepIndex != null ? canon.itGapSubstepIndex : getItGapDefaultViewingSubstep(mergedForOpen);
  }
  // 非当前大阶段时重置子步骤索引，避免上一案 ITGap/策略子屏残留影响本案顶栏与工作区（FE-20260403 串案修复）
  if (majorStage !== 2) {
    itGapViewingSubstep = getItGapDefaultViewingSubstep(mergedForOpen);
  }
  if (majorStage !== 3) {
    itStrategyPlanViewingSubstep = 0;
  }
  updateProblemDetailProgressStages(majorStage, problemDetailViewingMajorStage);
  renderProblemDetailContent();
  initProblemDetailChat();
  __appState.currentProblemDetailItem = applyPreliminaryReqHydrationFromMessages(
    __appState.currentProblemDetailItem,
    __appState.problemDetailChatMessages,
    'openProblemDetail',
  );
  __appState.currentProblemDetailItem = applyE2eTransactionFlowHydrationFromMessages(
    __appState.currentProblemDetailItem,
    __appState.problemDetailChatMessages,
    'openProblemDetail',
  );
  renderProblemDetailContent();
  const pushedPrelimOpen = pushTask1PreliminaryLlmQueryFromCaseIfNeeded(
    __appState.currentProblemDetailItem,
    'openProblemDetail',
  );
  if (pushedPrelimOpen) rerenderProblemDetailChatFromStorageState();
  toggleProblemDetailHistory(false);
  try {
    if (caseId) {
      const url = new URL(window.location.href);
      const currentParam = url.searchParams.get('caseId');
      const next = String(caseId);
      url.searchParams.set('caseId', next);
      const nextHref = url.pathname + url.search + url.hash;
      // 与当前 URL 一致时（刷新/深链首屏）：replace，不增加 history 层；
      // 从首页或其它 case 进入时：push，使浏览器「返回」稳定回到上一屏（通常是首页）
      if (currentParam === next) {
        window.history.replaceState({ appView: 'problemDetail', caseId: next, pushed: false }, '', nextHref);
      } else {
        window.history.pushState({ appView: 'problemDetail', caseId: next, pushed: true }, '', nextHref);
      }
    }
  } catch (_) {}
  saveRouteState('problemDetail', { caseId, createdAt: item.createdAt });
  switchView('problemDetail');
  updateProblemDetailArchiveNoBadge();
  updateProblemDetailChatHeaderLabel();
  updateFlowExceptionResumeButtonVisibility();
  updateProblemDetailChatInputForMode();
  // 恢复刷新前工作区滚动位置
  const scrollKey = 'problemDetailScroll_' + String(caseId ?? item.createdAt);
  const savedScroll = sessionStorage.getItem(scrollKey);
  if (savedScroll !== null) {
    const scrollTop = parseInt(savedScroll, 10);
    if (!isNaN(scrollTop)) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const wsScroll = document.querySelector('.problem-detail-workspace-scroll');
          if (wsScroll) {
            wsScroll.scrollTop = scrollTop;
          }
          sessionStorage.removeItem(scrollKey);
          openingProblemDetailInProgress = false;
        });
      });
    } else {
      openingProblemDetailInProgress = false;
      maybeFocusWorkspaceAfterCanonicalTaskChange();
    }
  } else {
    openingProblemDetailInProgress = false;
    maybeFocusWorkspaceAfterCanonicalTaskChange();
  }
  // 双重 rAF：确保视图已渲染（含刷新后恢复路由），再触发当前任务开始通知
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!ensureTask4RefreshNotificationIfNeeded()) {
        showNextTaskStartNotificationIfCurrentTaskPendingOnly();
      }
      ensureTask1StartNotificationIfPending('openProblemDetail-rAF');
    });
  });
  refreshProblemDetailBundleFromBackend(caseId);
}

/**
 * 顶层 `preliminaryReq` 缺失或为空对象时，从聊天记录解析最近一次 V2（导入漏库、仅嵌套在 basicInfo 等场景的内存修复）。
 * 控制台 `[FE:prelim-hydrate-from-chat]`；关闭：`globalThis.__FE_PRELIM_HYDRATE_DEBUG = false`。
 */
function applyPreliminaryReqHydrationFromMessages(item, messages, sourceTag) {
  if (!item) return item;
  const pr = item.preliminaryReq;
  const emptyish =
    pr == null ||
    (typeof pr === 'object' &&
      !Array.isArray(pr) &&
      Object.keys(pr).length === 0);
  if (!emptyish) return item;
  if (typeof window.extractPreliminaryReqV2FromChatMessages !== 'function') return item;
  const extracted = window.extractPreliminaryReqV2FromChatMessages(Array.isArray(messages) ? messages : []);
  if (!extracted) return item;
  try {
    if (globalThis.__FE_PRELIM_HYDRATE_DEBUG !== false) {
      console.info('[FE:prelim-hydrate-from-chat]', sourceTag || 'apply', {
        caseId: item.id || item.createdAt,
        msgCount: Array.isArray(messages) ? messages.length : 0,
      });
    }
  } catch (_) {}
  return { ...item, preliminaryReq: extracted };
}

/** 是否处于 task2 讨论模式：存在 bmcDiscussionStartBlock 且最近一次 end 在最近一次 start 之前（即尚未点击重新生成结束讨论） */
function mapProblemTaskIdToBackendTaskId(taskId) {
  switch (taskId) {
    case 'task7':
      return 'e2e-flow';
    case 'task8':
      return 'global-itgap';
    case 'task9':
      return 'local-itgap';
    default:
      return taskId;
  }
}

/**
 * @param {string} caseId
 * @param {{ skipShowNextTaskStartNotification?: boolean }} [options] - 为 true 时不在本函数内调用 showNextTaskStartNotification（调用方将自行触发，避免与在线「任务完成 confirm」后的 rAF 重复下发下一任务通知；FE-20260325-08）
 */
async function refreshProblemDetailBundleFromBackend(caseId, options) {
  // [bridge] bundle refresh → core/problem-case-api.js (Phase 1A)
  if (!caseId || typeof globalThis.SmartCto?.problemCaseApi?.refreshProblemDetailBundle !== 'function') return;
  const skipShowNextTaskStartNotification = !!(options && options.skipShowNextTaskStartNotification);
  const seq = ++problemDetailRemoteSyncSeq;
  try {
    const bundle = await globalThis.SmartCto.problemCaseApi.refreshProblemDetailBundle(caseId);
    if (!bundle || seq !== problemDetailRemoteSyncSeq) return;
    const curCaseId = __appState.currentProblemDetailItem?.id ?? __appState.currentProblemDetailItem?.createdAt;
    if (String(curCaseId) !== String(caseId)) return;

    if (bundle.item) {
      const prev = __appState.currentProblemDetailItem;
      const fromList = typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(bundle.item) : null;
      const fromPersisted = readTask1InitialLlmQueryForItem(bundle.item);
      const msgsForHydration =
        Array.isArray(bundle.messages) && bundle.messages.length > 0
          ? bundle.messages
          : __appState.problemDetailChatMessages || [];
      __appState.currentProblemDetailItem = applyE2eTransactionFlowHydrationFromMessages(
        applyPreliminaryReqHydrationFromMessages(
          applyValueStreamHydrationFromMessages(
            {
              ...bundle.item,
              // 后端 bundle 往往不含首页解析写入的 task1InitialLlmQuery，覆盖后会丢失，导致过程日志无法生成「初步需求提取」LLM-查询块
              task1InitialLlmQuery:
                bundle.item.task1InitialLlmQuery ?? prev?.task1InitialLlmQuery ?? fromList?.task1InitialLlmQuery ?? fromPersisted,
              // 同上：详情 GET 常不回传或未持久化 V2 preliminaryReq / 需求原文历史，仅 spread bundle.item 会清空工作区 view·json·历史详情（FE-20260331）
              preliminaryReq: bundle.item.preliminaryReq ?? prev?.preliminaryReq ?? fromList?.preliminaryReq,
              requirementDetail: bundle.item.requirementDetail ?? prev?.requirementDetail ?? fromList?.requirementDetail,
              requirementDetailHistory:
                bundle.item.requirementDetailHistory ?? prev?.requirementDetailHistory ?? fromList?.requirementDetailHistory,
              task1PendingPreliminaryRequirement:
                bundle.item.task1PendingPreliminaryRequirement ??
                prev?.task1PendingPreliminaryRequirement ??
                fromList?.task1PendingPreliminaryRequirement,
              // bundle 若未带 vsm_data，勿用空值覆盖内存/列表已有价值流，避免 task4 修改重生成后工作区空白（FE-20260407）
              valueStream: bundle.item.valueStream ?? prev?.valueStream ?? fromList?.valueStream,
              valueStreamDrawSessions:
                bundle.item.valueStreamDrawSessions ?? prev?.valueStreamDrawSessions ?? fromList?.valueStreamDrawSessions,
              itDesignSupplementSessions: mergeItDesignSupplementSessionsPreferProgress(
                bundle.item.itDesignSupplementSessions,
                prev?.itDesignSupplementSessions,
                fromList?.itDesignSupplementSessions,
              ),
              objectStateMachineJson:
                bundle.item.objectStateMachineJson ?? prev?.objectStateMachineJson ?? fromList?.objectStateMachineJson,
              e2eRequirementScenarioSupplementJson:
                bundle.item.e2eRequirementScenarioSupplementJson ??
                prev?.e2eRequirementScenarioSupplementJson ??
                fromList?.e2eRequirementScenarioSupplementJson,
              e2eTransactionFlowJson:
                typeof globalThis.SmartCto?.task7E2eTransactionFlow?.pickRicherE2eTransactionFlowJson === 'function'
                  ? globalThis.SmartCto.task7E2eTransactionFlow.pickRicherE2eTransactionFlowJson(
                      bundle.item.e2eTransactionFlowJson,
                      prev?.e2eTransactionFlowJson ?? fromList?.e2eTransactionFlowJson,
                    )
                  : bundle.item.e2eTransactionFlowJson ?? prev?.e2eTransactionFlowJson ?? fromList?.e2eTransactionFlowJson,
            },
            msgsForHydration,
            'refreshProblemDetailBundle',
          ),
          msgsForHydration,
          'refreshProblemDetailBundle',
        ),
        msgsForHydration,
        'refreshProblemDetailBundle',
      );
      problemDetailConfirmedBasicInfo = bundle.item.basicInfo || null;
      // online：bundle 刷新后已与 advanceProblemStateOnTaskComplete 一样写入 currentMajorStage，但须同步 viewing 与顶部进度条；
      // 否则 task3 完成后后端已推进到阶段 1，页面仍停在需求理解（viewing=0），工作流对齐不自动展示。
      const currentMajorStage = bundle.item.currentMajorStage ?? 0;
      const viewingBeforeBundle = problemDetailViewingMajorStage;
      if (currentMajorStage > problemDetailViewingMajorStage) {
        problemDetailViewingMajorStage = currentMajorStage;
      }
      if (problemDetailViewingMajorStage > currentMajorStage) {
        problemDetailViewingMajorStage = currentMajorStage;
      }
      logTaskPhaseNotificationDebug('refreshBundle:viewingSync', {
        caseId,
        bundleMajor: currentMajorStage,
        viewingBefore: viewingBeforeBundle,
        viewingAfter: problemDetailViewingMajorStage,
        itemMajorAfterSpread: __appState.currentProblemDetailItem?.currentMajorStage,
        skipShowNext: !!skipShowNextTaskStartNotification,
      });
      updateProblemDetailProgressStages(currentMajorStage, problemDetailViewingMajorStage);
      updateProblemDetailArchiveNoBadge();
    }
    currentProblemDetailTaskSummaries = Array.isArray(bundle.taskSummaries) ? bundle.taskSummaries : [];

    const resolvedAfterBundle =
      typeof resolveProblemItemForTaskNotification === 'function'
        ? resolveProblemItemForTaskNotification() || __appState.currentProblemDetailItem
        : __appState.currentProblemDetailItem;
    // bundle 应用后、initProblemDetailChat 重载前，内存 messages 可能仍属旧快照；失效绑定以强制走持久化/入参案例键（与换案串案同源修复）
    __appState.problemDetailChatMessagesCaseKey = null;
    const msgsForCanonBundle =
      typeof getProblemDetailChatMessagesForCanonical === 'function'
        ? getProblemDetailChatMessagesForCanonical(resolvedAfterBundle)
        : [];
    if (resolvedAfterBundle && problemDetailViewingMajorStage === 3) {
      const canonB = getCanonicalCurrentProblemFollowTaskState(resolvedAfterBundle, msgsForCanonBundle);
      const subFromData = canonB.itStrategySubstepIndex ?? 0;
      const caseKey = getProblemFollowCaseKey(resolvedAfterBundle);
      itStrategyPlanViewingSubstep = resolveItStrategyPlanOpeningSubstep(resolvedAfterBundle, caseKey, subFromData);
    }
    if (resolvedAfterBundle && problemDetailViewingMajorStage === 2) {
      const canonB = getCanonicalCurrentProblemFollowTaskState(resolvedAfterBundle, msgsForCanonBundle);
      itGapViewingSubstep =
        canonB.itGapSubstepIndex != null ? canonB.itGapSubstepIndex : getItGapDefaultViewingSubstep(resolvedAfterBundle);
    }

    renderProblemDetailContent();
    initProblemDetailChat();
    const pushedAfterBundle = pushTask1PreliminaryLlmQueryFromCaseIfNeeded(__appState.currentProblemDetailItem, 'refreshProblemDetailBundle');
    if (pushedAfterBundle) rerenderProblemDetailChatFromStorageState();
    if (!ensureTask4RefreshNotificationIfNeeded()) {
      if (!skipShowNextTaskStartNotification) {
        logTaskPhaseNotificationDebug('refreshBundle:callingNavigatePending', { caseId });
        showNextTaskStartNotificationIfCurrentTaskPendingOnly();
      } else {
        logTaskPhaseNotificationDebug('refreshBundle:skipNavigatePending', { caseId, reason: 'skipShowNextTaskStartNotification' });
      }
    } else {
      logTaskPhaseNotificationDebug('refreshBundle:skipNavigatePending', { caseId, reason: 'task4-refresh-notification' });
    }
    ensureTask1StartNotificationIfPending('refreshBundle');
    if (el.problemDetailHistoryPanel && !el.problemDetailHistoryPanel.classList.contains('hidden')) {
      renderProblemDetailHistory();
    }
  } catch (err) {
    const status = err && typeof err.status === 'number' ? err.status : null;
    if (status === 404 || status === 403) {
      handleProblemCaseAccessDenied(caseId, status);
      return;
    }
    console.warn('[problem-detail] refresh bundle failed:', err);
  }
}

function isOnlineMode() {
  return (window.APP_CONFIG && window.APP_CONFIG.MODE === 'online');
}

function getCurrentProblemCaseIdForBackend() {
  return __appState.currentProblemDetailItem?.id ?? __appState.currentProblemDetailItem?.createdAt;
}

function getBackendBaseUrl() {
  // [bridge] → core/problem-case-api.js (Phase 1A)
  const api = globalThis.SmartCto?.problemCaseApi;
  if (api && typeof api.getBackendBaseUrl === 'function') return api.getBackendBaseUrl();
  const cfg = window.APP_CONFIG || {};
  return String(cfg.BACKEND_API_URL || '').replace(/\/$/, '');
}

function extractTask11SessionsArray(raw) {
  if (Array.isArray(raw)) return raw.slice();
  if (raw && typeof raw === 'object' && Array.isArray(raw.sessions)) return raw.sessions.slice();
  return [];
}

function syncTask11SessionsToFrontendState(caseRef, sessions) {
  const nextSessions = Array.isArray(sessions) ? sessions.slice() : [];
  if (!nextSessions.length) return;
  if (__appState.currentProblemDetailItem) {
    const curCaseId = __appState.currentProblemDetailItem.id ?? __appState.currentProblemDetailItem.createdAt;
    const targetCaseId = caseRef?.id ?? caseRef?.createdAt;
    if (String(curCaseId) === String(targetCaseId)) {
      __appState.currentProblemDetailItem = {
        ...__appState.currentProblemDetailItem,
        coreBusinessObjectSessions: nextSessions,
      };
    }
  }
  const list = getDigitalProblems();
  const targetKey = String(caseRef?.createdAt ?? caseRef?.id ?? '');
  const targetId = String(caseRef?.id ?? '');
  const idx = list.findIndex((it) => {
    const key = String(it.createdAt ?? it.id ?? '');
    const id = String(it.id ?? '');
    return key === targetKey || (targetId && id === targetId) || (targetId && key === targetId);
  });
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      coreBusinessObjectSessions: nextSessions,
    };
  }
}

/** FE-20260324-19：售前方案/报告独立页（新标签页，不占用当前工作台） */
function openPresalesReportPageForCaseId(caseId) {
  if (!isOnlineMode()) {
    showError('售前方案仅支持 online 模式（需配置 BACKEND_API_URL 并登录）。');
    return;
  }
  if (!caseId) {
    showError('无法打开报告：案例标识缺失。');
    return;
  }
  try {
    const u = new URL('report.html', window.location.href);
    u.searchParams.set('caseId', String(caseId));
    window.open(u.href, '_blank', 'noopener,noreferrer');
  } catch (e) {
    showError('无法打开报告页。');
  }
}

async function postProblemCaseTaskAction(caseId, backendTaskId, action, payload) {
  // [bridge] → core/problem-case-api.js (Phase 1A)
  return globalThis.SmartCto.problemCaseApi.postProblemCaseTaskAction(caseId, backendTaskId, action, payload, {
    onAccessDenied: handleProblemCaseAccessDenied,
  });
}

async function putProblemCaseTask11StepCheckpoint(caseId, stepIndex, payload) {
  // [bridge] → core/problem-case-api.js (Phase 1A)
  return globalThis.SmartCto.problemCaseApi.putProblemCaseTask11StepCheckpoint(caseId, stepIndex, payload, {
    onAccessDenied: handleProblemCaseAccessDenied,
  });
}

/**
 * ProblemCase JSON 包导入导出（online / FE-20260321-03）
 * 契约：GET /problem-cases/:id/export（application/json + Content-Disposition）；POST /problem-cases/import（application/json 案例包 body，成功 201，body 含 caseId；见 FE-20260321-06）；POST /problem-cases/:id/restore（同包结构覆盖当前案例，服务端校验包内客户名称与库内一致；档案编号由前端比对 clientMeta）
 * 导出：下载前注入可选 clientMeta（displayArchiveNo、displayCustomerName）供「恢复」校验；导入为新案例仍忽略 clientMeta。
 * 解析/HTTP 细节见 `js/core/problem-case-api.js`（Phase 1A）。
 */
function getImportTraceRouteState() {
  try {
    return sessionStorage.getItem(ROUTE_STORAGE_KEY) || '';
  } catch (_) {
    return '';
  }
}

function getImportTraceVisibleView() {
  try {
    const defs = [
      ['problemDetail', 'problemDetailView'],
      ['taskTracking', 'taskTrackingView'],
      ['detail', 'detailView'],
    ];
    for (const [name, id] of defs) {
      const node = document.getElementById(id);
      if (!node || node.hidden) continue;
      const style = window.getComputedStyle(node);
      if (style.display !== 'none' && style.visibility !== 'hidden') return name;
    }
  } catch (_) {}
  return 'unknown';
}

function buildImportTraceFirstCards(limit) {
  try {
    // FE-20260406-02：正式首页在 home.html；导入追踪不再读已删除的主站首页列表 DOM，改从 getDigitalProblems() 取样
    const list = Array.isArray(getDigitalProblems()) ? getDigitalProblems() : [];
    const n = Math.max(0, limit || 0);
    return list.slice(0, n).map((item, index) => ({
      index,
      caseKey: getProblemFollowCaseKey(item),
      title: String(item?.customerName ?? '').trim(),
    }));
  } catch (_) {
    return [];
  }
}

function logImportTrace(step, extra) {
  if (typeof globalThis === 'undefined' || !globalThis.__FE_IMPORT_TRACE_DEBUG) return;
  try {
    console.log('[IMPORT-TRACE][BUILTIN]', {
      step,
      visibleView: getImportTraceVisibleView(),
      highlightedCaseKey: getProblemFollowHighlightedCaseKey(),
      routeState: getImportTraceRouteState(),
      ...extra,
    });
  } catch (_) {}
}

async function fetchImportedProblemCaseDetail(baseUrl, caseId) {
  // [bridge] GET case detail → core/problem-case-api.js (Phase 1A)
  const api = globalThis.SmartCto.problemCaseApi;
  const detailUrl = `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}`;
  logImportTrace('fetch-detail-start', { caseId, detailUrl });
  const item = await api.fetchProblemCaseDetail(baseUrl, caseId);
  logImportTrace('fetch-detail-success', {
    caseId,
    itemCaseKey: getProblemFollowCaseKey(item),
    customerName: String(item.customerName ?? item.customer_name ?? '').trim(),
  });
  return item;
}

function triggerProblemCaseImportBackgroundReload(adapter, importedCaseId) {
  if (!adapter || typeof adapter.reloadCachesFromBackend !== 'function') return;
  const beforeCount = Array.isArray(getDigitalProblems()) ? getDigitalProblems().length : 0;
  logImportTrace('background-reload-start', { importedCaseId, beforeCount });
  Promise.resolve()
    .then(() => adapter.reloadCachesFromBackend())
    .then(() => {
      const list = Array.isArray(getDigitalProblems()) ? getDigitalProblems() : [];
      const normalizedCaseId = importedCaseId == null ? '' : String(importedCaseId);
      logImportTrace('background-reload-success', {
        importedCaseId: normalizedCaseId,
        afterCount: list.length,
        hasImportedCase: list.some((item) => getProblemFollowCaseKey(item) === normalizedCaseId),
        firstCards: buildImportTraceFirstCards(8),
      });
    })
    .catch((e) => console.warn('[import] reloadCachesFromBackend failed:', e));
}

async function finalizeProblemCaseImportSuccess(baseUrl, newId, data) {
  const adapter = globalThis.STORAGE_HTTP_ADAPTER;
  const beforeList = Array.isArray(getDigitalProblems()) ? getDigitalProblems() : [];
  logImportTrace('finalize-start', {
    newId,
    beforeCount: beforeList.length,
    importedMessageCount: data && typeof data.importedMessageCount === 'number' ? data.importedMessageCount : null,
    schemaVersion: data && data.schemaVersion != null ? String(data.schemaVersion) : null,
  });
  const item = await fetchImportedProblemCaseDetail(baseUrl, newId);
  if (adapter && typeof adapter.upsertCaseFromDetailPayload === 'function') {
    adapter.upsertCaseFromDetailPayload(item);
  }
  const afterUpsertList = Array.isArray(getDigitalProblems()) ? getDigitalProblems() : [];
  logImportTrace('after-upsert-current-list', {
    newId,
    afterCount: afterUpsertList.length,
    hasImportedCase: afterUpsertList.some((entry) => getProblemFollowCaseKey(entry) === String(newId)),
    listCaseKeys: afterUpsertList.slice(0, 12).map((entry) => getProblemFollowCaseKey(entry)),
  });
  setProblemFollowHighlightedCaseKey(getProblemFollowCaseKey(item) || newId);
  logImportTrace('after-highlight-set', {
    newId,
    itemCaseKey: getProblemFollowCaseKey(item),
  });
  logImportTrace('after-import-list-skip', {
    newId,
    note: 'legacy index 首页列表已移除；高亮键供 home.html 返回排序',
  });
  triggerProblemCaseImportBackgroundReload(adapter, newId);
  const nMsg = data && typeof data.importedMessageCount === 'number' ? data.importedMessageCount : null;
  const ver = data && data.schemaVersion != null ? String(data.schemaVersion) : null;
  const tip = [
    '已导入为新案例，正在打开详情…',
    nMsg != null ? `消息 ${nMsg} 条` : null,
    ver != null ? `schema ${ver}` : null,
  ].filter(Boolean).join('；');
  alert(tip);
  logImportTrace('before-open-detail', {
    newId,
    itemCaseKey: getProblemFollowCaseKey(item),
    customerName: String(item.customerName ?? item.customer_name ?? '').trim(),
  });
  openProblemDetail(item);
  logImportTrace('after-open-detail', {
    newId,
    currentCaseId: getCurrentProblemCaseIdForBackend(),
  });
}

function updateProblemCaseImportExportUiState() {
  const online = isOnlineMode();
  if (el.btnProblemCaseExport) el.btnProblemCaseExport.disabled = !online;
  if (el.btnProblemCaseRestore) el.btnProblemCaseRestore.disabled = !online;
}

async function exportCurrentProblemCasePackage() {
  // [bridge] GET export → core/problem-case-api.js (Phase 1A)；clientMeta 与下载仍在本函数
  if (!isOnlineMode()) {
    showError('导入/导出仅支持 online 模式（需配置 BACKEND_API_URL 并登录）。');
    return;
  }
  const caseId = getCurrentProblemCaseIdForBackend();
  if (!caseId) {
    showError('无法导出：当前案例标识缺失。');
    return;
  }
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    showError('未配置 BACKEND_API_URL。');
    return;
  }
  try {
    const result = await globalThis.SmartCto.problemCaseApi.fetchProblemCaseExport(caseId, {
      onAccessDenied: handleProblemCaseAccessDenied,
    });
    if (!result.ok) {
      if (result.errorKind === 'auth') return;
      if (result.errorKind === 'access') return;
      showError(`导出失败：${result.errorMessage || '未知错误'}`);
      return;
    }
    let filename = result.filename || `problem-case-${caseId}.json`;
    const pkg = result.pkg;
    const cur = __appState.currentProblemDetailItem;
    const archiveNo = Number(cur?.archiveNo);
    const customerName = String(cur?.customerName ?? cur?.customer_name ?? '').trim();
    if (Number.isFinite(archiveNo) && archiveNo > 0 && customerName) {
      pkg.clientMeta = {
        displayArchiveNo: Math.floor(archiveNo),
        displayCustomerName: customerName,
      };
    }
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch (e) {
    showError(`导出失败：${e?.message || String(e)}`);
  }
}

async function importProblemCasePackageFile(file) {
  if (!isOnlineMode()) {
    showError('\u5bfc\u5165/\u5bfc\u51fa\u4ec5\u652f\u6301 online \u6a21\u5f0f\uff08\u9700\u914d\u7f6e BACKEND_API_URL \u5e76\u767b\u5f55\uff09\u3002');
    return;
  }
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    showError('\u672a\u914d\u7f6e BACKEND_API_URL\u3002');
    return;
  }
  // [bridge] POST import → core/problem-case-api.js (Phase 1A)
  let text;
  try {
    text = await file.text();
  } catch (e) {
    showError(`\u5bfc\u5165\u5931\u8d25\uff1a\u65e0\u6cd5\u8bfb\u53d6\u6587\u4ef6\uff1a${e?.message || String(e)}`);
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    showError(`\u5bfc\u5165\u5931\u8d25\uff1a\u6587\u4ef6\u4e0d\u662f\u5408\u6cd5 JSON\uff1a${e?.message || String(e)}`);
    return;
  }
  try {
    const apiResult = await globalThis.SmartCto.problemCaseApi.postProblemCaseImport(parsed);
    if (!apiResult.ok) {
      if (apiResult.errorMessage) showError(`\u5bfc\u5165\u5931\u8d25\uff1a${apiResult.errorMessage}`);
      return;
    }
    const data = apiResult.data;
    const newId = globalThis.SmartCto.problemCaseApi.extractImportedProblemCaseId(data);
    logImportTrace('import-response', {
      status: apiResult.status,
      newId,
      responseCaseId: data && typeof data === 'object' ? (data.caseId || data.id || (data.case && data.case.id) || '') : '',
      importedMessageCount: data && typeof data.importedMessageCount === 'number' ? data.importedMessageCount : null,
      schemaVersion: data && data.schemaVersion != null ? String(data.schemaVersion) : null,
    });
    if (!newId) {
      showError('\u5bfc\u5165\u6210\u529f\u4f46\u672a\u8fd4\u56de caseId\uff0c\u8bf7\u4e0e\u540e\u7aef\u786e\u8ba4\u54cd\u5e94 JSON\uff08\u9700\u542b caseId\uff09\u3002');
      return;
    }
    await finalizeProblemCaseImportSuccess(baseUrl, newId, data);
  } catch (e) {
    logImportTrace('import-error', { message: e?.message || String(e) });
    showError(`\u5bfc\u5165\u5931\u8d25\uff1a${e?.message || String(e)}`);
  }
}

function normalizeCustomerNameForArchiveRestore(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * 校验所选 JSON 包可否用于恢复当前档案：客户名称一致，且 clientMeta 中档案编号与当前详情一致。
 * @returns {string|null} 错误说明，null 表示通过
 */
function validateProblemCasePackageForRestore(pkg, currentItem) {
  if (!pkg || typeof pkg !== 'object' || pkg.schemaVersion !== 1 || !pkg.case || typeof pkg.case !== 'object') {
    return '文件不是有效的案例 JSON 包（需 schemaVersion 与 case 完整结构）。';
  }
  if (!Array.isArray(pkg.messages)) {
    return '案例包缺少 messages 数组。';
  }
  const curName = normalizeCustomerNameForArchiveRestore(currentItem?.customerName ?? currentItem?.customer_name);
  const pkgCaseName = normalizeCustomerNameForArchiveRestore(pkg.case.customerName);
  if (!pkgCaseName || pkgCaseName !== curName) {
    return '导出包中的客户名称与当前档案不一致，无法恢复。';
  }
  const meta = pkg.clientMeta;
  if (!meta || typeof meta !== 'object' || typeof meta.displayArchiveNo !== 'number' || !Number.isFinite(meta.displayArchiveNo)) {
    return '该导出包缺少档案编号快照，请使用本页「导出」重新下载后再恢复。';
  }
  const curNo = Number(currentItem?.archiveNo);
  if (!Number.isFinite(curNo) || curNo <= 0) {
    return '当前档案缺少有效的案例编号，无法校验恢复包。';
  }
  if (Math.floor(meta.displayArchiveNo) !== Math.floor(curNo)) {
    return '导出包中的档案编号与当前档案不一致，无法恢复。';
  }
  const metaName = normalizeCustomerNameForArchiveRestore(meta.displayCustomerName);
  if (metaName && metaName !== curName) {
    return '导出包中的客户名称与当前档案不一致，无法恢复。';
  }
  return null;
}

async function finalizeProblemCaseRestoreSuccess(caseId, data) {
  const baseUrl = getBackendBaseUrl();
  const adapter = globalThis.STORAGE_HTTP_ADAPTER;
  const item = await fetchImportedProblemCaseDetail(baseUrl, caseId);
  if (adapter && typeof adapter.upsertCaseFromDetailPayload === 'function') {
    adapter.upsertCaseFromDetailPayload(item);
  }
  const merged = typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(item) : null;
  const itemWithArchive =
    merged && merged.archiveNo != null ? { ...item, archiveNo: merged.archiveNo } : item;
  __appState.currentProblemDetailItem = itemWithArchive;
  problemDetailConfirmedBasicInfo = itemWithArchive.basicInfo || null;
  triggerProblemCaseImportBackgroundReload(adapter, caseId);
  const nMsg = data && typeof data.importedMessageCount === 'number' ? data.importedMessageCount : null;
  if (typeof alert === 'function') {
    alert(nMsg != null ? `已恢复当前档案，共写入 ${nMsg} 条消息。` : '已恢复当前档案。');
  }
  await refreshProblemDetailBundleFromBackend(caseId, { skipShowNextTaskStartNotification: true });
  updateProblemDetailArchiveNoBadge();
}

async function importProblemCaseRestorePackageFile(file) {
  if (!isOnlineMode()) {
    showError('恢复档案仅支持 online 模式（需配置 BACKEND_API_URL 并登录）。');
    return;
  }
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    showError('未配置 BACKEND_API_URL。');
    return;
  }
  const caseId = getCurrentProblemCaseIdForBackend();
  if (!caseId) {
    showError('当前案例标识缺失，无法恢复。');
    return;
  }
  const currentItem = __appState.currentProblemDetailItem;
  if (!currentItem) {
    showError('当前无打开的档案。');
    return;
  }
  if (typeof confirm === 'function') {
    const ok = confirm(
      '将用所选 JSON 文件覆盖当前档案的任务进度、工作区数据与聊天记录（案例 id 不变）。是否继续？',
    );
    if (!ok) return;
  }
  let text;
  try {
    text = await file.text();
  } catch (e) {
    showError(`读取文件失败：${e?.message || String(e)}`);
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    showError(`文件不是合法 JSON：${e?.message || String(e)}`);
    return;
  }
  const vErr = validateProblemCasePackageForRestore(parsed, currentItem);
  if (vErr) {
    showError(vErr);
    return;
  }
  // [bridge] POST restore → core/problem-case-api.js (Phase 1A)
  try {
    const restoreResult = await globalThis.SmartCto.problemCaseApi.postProblemCaseRestore(caseId, parsed, {
      onAccessDenied: handleProblemCaseAccessDenied,
    });
    if (!restoreResult.ok) {
      if (restoreResult.errorKind === 'access') return;
      if (restoreResult.errorMessage) showError(`恢复失败：${restoreResult.errorMessage}`);
      return;
    }
    const data = restoreResult.data;
    await finalizeProblemCaseRestoreSuccess(caseId, data);
  } catch (e) {
    showError(`恢复失败：${e?.message || String(e)}`);
  }
}

function isInBmcDiscussionMode() {
  // [bridge] → core/task2-companion-runtime.js (Phase 4A)
  return globalThis.SmartCto.task2Runtime.isInBmcDiscussionMode();
}

// [bridge] → legacy/problem-detail-renderer.js (Phase 2B)
function updateProblemDetailArchiveNoBadge() {
  globalThis.SmartCto.problemDetailRenderer.updateArchiveNoBadge();
}
function updateProblemDetailChatDiscussionIndicator() {
  globalThis.SmartCto.problemDetailRenderer.updateChatDiscussionIndicator();
}
function updateProblemDetailChatHeaderLabel() {
  globalThis.SmartCto.problemDetailRenderer.updateChatHeaderLabel();
}
function updateProblemDetailChatInputForMode() {
  globalThis.SmartCto.problemDetailRenderer.updateChatInputForMode();
}
function updateProblemDetailTaskStepBar() {
  globalThis.SmartCto.problemDetailRenderer.updateTaskStepBar();
}
function updateProblemDetailProgressStages(_currentMajorStage, _viewingMajorStage) {
  globalThis.SmartCto.problemDetailRenderer.updateProgressStages(_currentMajorStage, _viewingMajorStage);
}

/** 获取当前问题的第一个未完成任务 */
function getFirstUncompletedTask(item) {
  if (!item) return null;
  const allTasks = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...IT_STRATEGY_TASKS];
  return allTasks.find((t) => !isTaskCompleted(item, t.id)) || null;
}
if (typeof window !== 'undefined') {
  window.isTaskCompleted = isTaskCompleted;
  window.getFirstUncompletedTask = getFirstUncompletedTask;
  window.getCanonicalCurrentProblemFollowTaskState = getCanonicalCurrentProblemFollowTaskState;
  window.resolveCanonicalProblemCurrentTaskState = resolveCanonicalProblemCurrentTaskState;
  window.getProblemDetailChatMessagesForCanonical = getProblemDetailChatMessagesForCanonical;
  window.getWorkspaceViewingTaskId = getWorkspaceViewingTaskId;
}

/** ITGap 子步骤默认浏览索引：第一个未完成的 0/1/2；若均已标记完成则落在局部（2） */
function getItGapDefaultViewingSubstep(item) {
  const itGapCompleted = item?.itGapCompletedStages || [];
  const idx = [0, 1, 2].find((i) => !itGapCompleted.includes(i));
  return idx !== undefined ? idx : 2;
}

/** 「重启当前」解析目标 taskId：与 getCanonicalCurrentProblemFollowTaskState 同源，避免 DOM/内存子步骤分叉误重启到 task10。 */
function resolveCurrentTaskIdForRestartActions(item) {
  if (!item) return null;
  const merged = typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() || item : item;
  const msgs = getProblemDetailChatMessagesForCanonical(merged);
  const canon = getCanonicalCurrentProblemFollowTaskState(merged, msgs);
  return canon?.taskId || null;
}

/** 根据任务 id 得到所属大阶段索引（0=需求理解, 1=工作流对齐, 2=ITGap分析, 3=IT策略规划） */
function getMajorStageByTaskId(taskId) {
  if (!taskId) return 0;
  if (['task1', 'task2', 'task3'].includes(taskId)) return 0;
  if (['task4', 'task5', 'task6'].includes(taskId)) return 1;
  if (['task7', 'task8', 'task9'].includes(taskId)) return 2;
  if (['task12', 'task13', 'task14', 'task15'].includes(taskId)) return 3;
  return 0;
}

/** 回退到指定任务：清空该任务的完成状态与产出数据，返回新 item（不写存储）。用于「按任务回退」。 */
function buildItemAfterRollbackToTask(item, prevTaskId) {
  if (!item || !prevTaskId) return item;
  const completed = item.completedStages || [];
  const wfCompleted = item.workflowAlignCompletedStages || [];
  const itGapCompleted = item.itGapCompletedStages || [];
  const completedTaskIds = item.completedTaskIds || [];
  let nextItem = { ...item };
  switch (prevTaskId) {
    case 'task1':
      nextItem = { ...nextItem, basicInfo: undefined, completedStages: [] };
      break;
    case 'task2':
      nextItem = { ...nextItem, bmc: undefined, completedStages: completed.filter((x) => x !== 1) };
      break;
    case 'task3':
      nextItem = { ...nextItem, requirementLogic: undefined, completedStages: completed.filter((x) => x !== 2) };
      break;
    case 'task4':
      nextItem = { ...nextItem, valueStream: undefined, workflowAlignCompletedStages: [] };
      break;
    case 'task5': {
      nextItem = { ...nextItem, workflowAlignCompletedStages: wfCompleted.filter((x) => x !== 1), itStatusSessions: undefined };
      const vs = nextItem.valueStream;
      if (vs && !vs.raw && (vs.stages || vs.phases || vs.nodes)) {
        const rawStages = vs.stages ?? vs.phases ?? vs.nodes ?? [];
        if (Array.isArray(rawStages)) {
          const stages = rawStages.map((s) => {
            if (!s || typeof s !== 'object') return s;
            const rawSteps = s.steps ?? s.tasks ?? s.phases ?? s.items ?? [];
            const steps = rawSteps.map((st) => {
              if (typeof st !== 'object' || st == null) return st;
              const { itStatus, it_status, itPlan, it_plan, itStatusLabel, ...rest } = st;
              return rest;
            });
            return { ...s, steps };
          });
          nextItem = { ...nextItem, valueStream: { ...vs, stages } };
        }
      }
      getProblemFollowCompatibleCaseKeys(nextItem).forEach((k) => {
        setTask5ItStatusPromptOverride(k, '');
        setTask5ModAwaitingAutoStrip(k, false);
      });
      break;
    }
    case 'task6': {
      nextItem = { ...nextItem, workflowAlignCompletedStages: wfCompleted.filter((x) => x !== 2), painPointSessions: undefined };
      const vs = nextItem.valueStream;
      if (vs && !vs.raw && (vs.stages || vs.phases || vs.nodes)) {
        const rawStages = vs.stages ?? vs.phases ?? vs.nodes ?? [];
        if (Array.isArray(rawStages)) {
          const stages = rawStages.map((s) => {
            if (!s || typeof s !== 'object') return s;
            const rawSteps = s.steps ?? s.tasks ?? s.phases ?? s.items ?? [];
            const steps = rawSteps.map((st) => {
              if (typeof st !== 'object' || st == null) return st;
              const { painPoint, pain_point, ...rest } = st;
              return rest;
            });
            return { ...s, steps };
          });
          nextItem = { ...nextItem, valueStream: { ...vs, stages } };
        }
      }
      break;
    }
    case 'task7':
      nextItem = {
        ...nextItem,
        itGapCompletedStages: itGapCompleted.filter((x) => x !== 0),
        e2eFlowLandscapeJson: undefined,
        e2eTransactionFlowJson: undefined,
        e2eRequirementScenarioSupplementJson: undefined,
      };
      break;
    case 'task8':
      nextItem = {
        ...nextItem,
        globalItGapAnalysisJson: undefined,
        globalItGapConstraintBaseMarkdown: undefined,
        itDesignSupplementSessions: undefined,
        itGapCompletedStages: itGapCompleted.filter((x) => x !== 1),
      };
      break;
    case 'task9':
      nextItem = {
        ...nextItem,
        localItGapSessions: undefined,
        localItGapAnalyses: undefined,
        roleTaskCenterPortalDesignJson: undefined,
        itGapCompletedStages: itGapCompleted.filter((x) => x !== 2),
      };
      break;
    case 'task12': {
      const prevRpSessions = nextItem.rolePermissionSessions;
      const clearedRpSessions = Array.isArray(prevRpSessions)
        ? prevRpSessions.map((s) => (s && typeof s === 'object' ? { ...s, rolePermissionJson: undefined } : s))
        : undefined;
      const sessions = (nextItem.coreBusinessObjectSessions || []).map((s) => ({ ...s, coreBusinessObjectJson: null }));
      nextItem = {
        ...nextItem,
        completedTaskIds: completedTaskIds.filter(
          (id) =>
            id !== prevTaskId &&
            id !== 'strategy-0' &&
            id !== 'strategy-1' &&
            id !== 'task10' &&
            id !== 'task11',
        ),
        rolePermissionModel: undefined,
        ...(clearedRpSessions !== undefined ? { rolePermissionSessions: clearedRpSessions } : {}),
        coreBusinessObjectSessions: sessions,
        coreBusinessObjectSystemPromptOverride: undefined,
      };
      break;
    }
    case 'task13':
    case 'task14':
    case 'task15':
      nextItem = { ...nextItem, completedTaskIds: completedTaskIds.filter((id) => id !== prevTaskId) };
      break;
    default:
      return item;
  }
  nextItem.currentMajorStage = getMajorStageByTaskId(prevTaskId);
  return nextItem;
}

/**
 * 仅清空指定任务的工作区/完成数据（用于「重新开始当前任务」）。
 * `buildItemAfterRollbackToTask` 已将 `currentMajorStage` 设为该任务所属大阶段；**不得**再用 `item.currentMajorStage ?? …` 覆盖，否则持久化为 0 时会把 task7 等误写回 0，重启后工作区落到初步需求（FE-20260328-31）。
 */
function buildItemClearCurrentTaskOnly(item, taskId) {
  if (!item || !taskId) return item;
  return buildItemAfterRollbackToTask(item, taskId);
}

/** 回退到指定任务：清空该任务及之后所有任务的完成状态与产出数据，返回新 item（不写存储） */
function buildItemAfterRollbackToTaskId(item, targetTaskId) {
  if (!item || !targetTaskId) return item;
  const allTasks = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...IT_STRATEGY_TASKS];
  const targetIdx = allTasks.findIndex((t) => t.id === targetTaskId);
  if (targetIdx < 0) return item;
  let next = { ...item };
  for (let i = targetIdx; i < allTasks.length; i++) {
    next = buildItemAfterRollbackToTask(next, allTasks[i].id);
  }
  next.currentMajorStage = getMajorStageByTaskId(targetTaskId);
  return next;
}

/**
 * 仅清空 task2 及之后任务的工作区/完成态（保留 task1 与 preliminaryReq 等），并将大阶段压回需求理解。
 * 用于对话顶栏「+需求」：不得用 `buildItemAfterRollbackToTaskId(..., 'task1')`，否则会连 task1 的 basicInfo 一并清空。
 */
function buildItemClearTasksFromTask2Onward(item) {
  if (!item) return item;
  const allTasks = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...IT_STRATEGY_TASKS];
  const startIdx = allTasks.findIndex((t) => t.id === 'task2');
  if (startIdx < 0) return { ...item, currentMajorStage: 0, completedTaskIds: [] };
  let next = { ...item };
  for (let i = startIdx; i < allTasks.length; i++) {
    next = buildItemAfterRollbackToTask(next, allTasks[i].id);
  }
  next.currentMajorStage = 0;
  next.completedTaskIds = [];
  return next;
}

/**
 * 「+需求」：在 `filterChatMessagesAfterRollback(..., 'task2')` 基础上去掉 task1 完工块与旧跟进卡，便于重新进入初步需求补充态。
 */
function filterChatMessagesForPlusRequirementReset(messages) {
  const base = filterChatMessagesAfterRollback(Array.isArray(messages) ? messages : [], 'task2');
  return base.filter((msg) => {
    if (!msg) return true;
    if (msg.type === 'taskCompleteBlock' && msg.taskId === 'task1') return false;
    if (msg.type === 'taskCompletionConfirmBlock' && msg.taskId === 'task1') return false;
    if (msg.type === 'preliminaryRequirementFollowupBlock') return false;
    if (msg.type === 'plusRequirementResetConfirmBlock') return false;
    return true;
  });
}

/** 顶栏「+需求」在聊天区下发的确认文案（与历史浏览器 confirm 口径一致） */
const PLUS_REQUIREMENT_RESET_CONFIRM_CONTENT =
  '将清空 task2 及以后任务的沟通历史与工作区数据，回到企业背景洞察（task1）并进入「补充需求」流程。是否继续？';

/** 对话顶栏「+需求」：向聊天区推送确认块（取消浏览器弹窗）；若已有未处理确认块则滚动到该条 */
function requestPlusRequirementResetConfirmInChat() {
  const item = __appState.currentProblemDetailItem;
  // 与 getProblemDetailChatStorageKey / HTTP 案例一致：在线案常仅有 id，不得依赖 createdAt
  if (!item || !getDigitalProblemPersistKey(item)) return;
  if (!Array.isArray(__appState.problemDetailChatMessages)) {
    __appState.problemDetailChatMessages = [];
  }
  const msgs = __appState.problemDetailChatMessages;
  let pendingIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.type === 'plusRequirementResetConfirmBlock' && !m.resolution) {
      pendingIdx = i;
      break;
    }
  }
  if (pendingIdx >= 0) {
    requestAnimationFrame(() => {
      const wrap = el.problemDetailChatMessages;
      const row = wrap?.querySelector(`[data-msg-index="${pendingIdx}"]`);
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return;
  }
  pushAndSaveProblemDetailChat({
    type: 'plusRequirementResetConfirmBlock',
    taskId: 'task1',
    content: PLUS_REQUIREMENT_RESET_CONFIRM_CONTENT,
    timestamp: getTimeStr(),
  });
  const chatEl = el.problemDetailChatMessages;
  if (chatEl) {
    chatEl.innerHTML = '';
    renderProblemDetailChatFromStorage(chatEl, __appState.problemDetailChatMessages);
    chatEl.scrollTop = chatEl.scrollHeight;
  }
}

/** 用户于聊天区点「确定」后执行：截断 task2+ 聊天与工作区，切回 task1 并下发 preliminaryRequirementFollowupBlock */
function executePlusRequirementResetFromTask2() {
  const item = __appState.currentProblemDetailItem;
  const persistKey = getDigitalProblemPersistKey(item);
  if (!item || !persistKey) return;

  const updated = buildItemClearTasksFromTask2Onward(item);
  if (typeof restoreItemFromSnapshot === 'function') restoreItemFromSnapshot(persistKey, updated);

  const listAfter = typeof getDigitalProblems === 'function' ? getDigitalProblems() : [];
  const synced = listAfter.find(
    (p) =>
      String(p.createdAt) === String(persistKey) ||
      String(p.id || '') === String(persistKey) ||
      (item.id && p.id && String(p.id) === String(item.id)),
  );
  __appState.currentProblemDetailItem = synced || updated;

  const dataItem = __appState.currentProblemDetailItem;
  const dataPersist = getDigitalProblemPersistKey(dataItem);
  const chatKey =
    typeof getProblemDetailChatStorageKey === 'function'
      ? getProblemDetailChatStorageKey(dataItem) || dataPersist
      : dataPersist;
  const memKey = __appState.problemDetailChatMessagesCaseKey;
  const memOk =
    Array.isArray(__appState.problemDetailChatMessages) &&
    memKey != null &&
    String(memKey).trim() !== '' &&
    String(memKey).trim() === String(chatKey).trim();
  const chats = memOk
    ? __appState.problemDetailChatMessages
    : typeof getProblemDetailChats === 'function'
      ? getProblemDetailChats()[chatKey] || (dataPersist ? getProblemDetailChats()[dataPersist] : []) || []
      : [];

  const filtered = filterChatMessagesForPlusRequirementReset(chats);
  if (typeof globalThis.saveProblemDetailChatLocalStorageMulticast === 'function') {
    globalThis.saveProblemDetailChatLocalStorageMulticast(dataItem, filtered);
  } else if (typeof saveProblemDetailChat === 'function') {
    saveProblemDetailChat(chatKey, filtered);
  }
  __appState.problemDetailChatMessages = filtered;
  __appState.problemDetailChatMessagesCaseKey = chatKey;

  if (typeof updateDigitalProblemMajorStage === 'function') {
    const majorKey = getDigitalProblemPersistKey(dataItem);
    if (majorKey) updateDigitalProblemMajorStage(majorKey, 0);
  }

  syncProblemDetailSessionAfterRollback('task1');
  problemDetailWaitingForFeedback = {
    taskId: 'task1',
    createdAt: chatKey,
    type: 'modification',
    prelimSupplement: true,
  };
  lastCanonTaskIdForWorkspaceScroll = null;

  pushAndSaveProblemDetailChat({
    type: 'preliminaryRequirementFollowupBlock',
    taskId: 'task1',
    content: '请继续补充客户需求，我将基于您的补充进一步提炼并合并到当前初步需求。',
    timestamp: getTimeStr(),
  });

  const container = el.problemDetailChatMessages;
  if (container) {
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
  }
  renderProblemDetailContent();
  updateProblemDetailChatHeaderLabel();
  renderProblemDetailHistory();
  if (typeof focusWorkspaceOnCurrentTask === 'function') focusWorkspaceOnCurrentTask('task1');
  if (typeof showNextTaskStartNotificationIfCurrentTaskPendingOnly === 'function') {
    showNextTaskStartNotificationIfCurrentTaskPendingOnly();
  }
}

/** 从聊天记录中删除仅属于指定任务的所有消息（用于「重新开始当前任务」：清空当前任务形成的聊天数据，不改当前任务设置） */
function filterChatMessagesRemoveTask(messages, taskId) {
  if (!Array.isArray(messages) || !taskId) return messages || [];
  const inferTaskId = typeof window.inferTaskIdFromMessage === 'function' ? window.inferTaskIdFromMessage : () => null;
  let ctxTask = 'task1';
  return messages.filter((msg) => {
    if (!msg) return true;
    if (msg.askMode === true) return true;
    const inferred = inferTaskId(msg);
    const explicit = msg.taskId || msg._taskId;
    const explicitStr = explicit != null && explicit !== '' ? String(explicit) : '';
    const explicitMapped = explicitStr ? mapRollbackCtxTaskId(explicitStr) : '';
    const ctxMapped = ctxTask ? mapRollbackCtxTaskId(ctxTask) : '';
    let remove = false;
    if (explicitMapped === taskId || explicitStr === taskId || inferred === taskId) remove = true;
    else if (
      !explicitStr &&
      !inferred &&
      ctxMapped === taskId &&
      (msg.role === 'user' || (msg.role === 'system' && !msg.type))
    ) {
      remove = true;
    }
    if (msg.type === 'taskStartNotification' && msg.taskId) {
      ctxTask = mapRollbackCtxTaskId(msg.taskId);
    } else if (inferred) {
      ctxTask = inferred;
    }
    return !remove;
  });
}

/** 任务启动通知等消息上的 taskId 与前端任务序列表 id 对齐（与后端 path 用 id 一致；含 strategy-0..5 → task10..15） */
function mapRollbackCtxTaskId(raw) {
  if (raw == null || raw === '') return 'task1';
  const s = String(raw).trim();
  if (s === 'task10' || s === 'strategy-0' || s === 'task11' || s === 'strategy-1') return 'task12';
  const m = {
    'e2e-flow': 'task7',
    'global-itgap': 'task8',
    'local-itgap': 'task9',
    'strategy-0': 'task12',
    'strategy-1': 'task12',
  };
  if (m[s]) return m[s];
  const strategyMatch = s.match(/^strategy-(\d+)$/);
  if (strategyMatch) {
    const strategyIndex = Number(strategyMatch[1]);
    if (Number.isInteger(strategyIndex) && strategyIndex >= 2 && strategyIndex <= 5) {
      return 'task' + String(strategyIndex + 10);
    }
    if (strategyIndex === 0 || strategyIndex === 1) return 'task12';
  }
  return s;
}

/** 回退到某任务时，从聊天记录中删除「选定任务及之后」的所有消息（与 filterChatMessagesRemoveTask 同一归属判定，含无显式 taskId 但落在已清除阶段上下文中的 user/系统句） */
function filterChatMessagesAfterRollback(messages, targetTaskId) {
  if (!Array.isArray(messages) || !targetTaskId) return messages || [];
  const allTasks = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...IT_STRATEGY_TASKS];
  const targetIdx = allTasks.findIndex((t) => t.id === targetTaskId);
  if (targetIdx < 0) return messages;
  const taskIdsToRemove = new Set(allTasks.slice(targetIdx).map((t) => t.id));
  const inferTaskId = typeof window.inferTaskIdFromMessage === 'function' ? window.inferTaskIdFromMessage : () => null;
  let ctxTask = 'task1';
  return messages.filter((msg) => {
    if (!msg) return true;
    if (msg.askMode === true) return true;
    const inferred = inferTaskId(msg);
    const explicit = msg.taskId || msg._taskId;
    const explicitStr = explicit != null && explicit !== '' ? String(explicit) : '';
    const explicitMapped = explicitStr ? mapRollbackCtxTaskId(explicitStr) : '';
    const mid = explicitMapped || inferred;
    let remove = false;
    if (mid && taskIdsToRemove.has(mid)) remove = true;
    else if (
      !explicitStr &&
      !inferred &&
      ctxTask &&
      taskIdsToRemove.has(ctxTask) &&
      (msg.role === 'user' || (msg.role === 'system' && !msg.type))
    ) {
      remove = true;
    }
    if (msg.type === 'taskStartNotification' && msg.taskId) {
      ctxTask = mapRollbackCtxTaskId(msg.taskId);
    } else if (inferred) {
      ctxTask = inferred;
    }
    return !remove;
  });
}

/** 根据《数字化问题跟进阶段设计》1.3 各任务输入数据，从当前问题记录（不含聊天区内容）合成该任务的上下文 JSON，供沟通历史「上下文」块展示 */
function buildTaskContextJson(taskId, item) {
  if (!item) return {};
  const basicInfo = item.basicInfo || problemDetailConfirmedBasicInfo || null;
  const bmc = item.bmc || null;
  const requirementLogic = item.requirementLogic || null;
  const valueStream = item.valueStream && !item.valueStream.raw ? item.valueStream : null;
  const preliminaryReq =
    typeof window.buildPreliminarySummaryJson === 'function' ? window.buildPreliminarySummaryJson(item) : {};
  const globalItGapAnalysisJson = item.globalItGapAnalysisJson || null;
  const localItGapSessions = item.localItGapSessions || null;
  switch (taskId) {
    case 'task1':
      return basicInfo ? { basicInfo } : { note: '尚无企业基本信息' };
    case 'task2':
      return basicInfo || bmc ? { basicInfo: basicInfo || undefined, bmc: bmc || undefined } : { note: '尚无企业基本信息' };
    case 'task3':
      return { preliminaryReq, basicInfo: basicInfo || undefined, bmc: bmc || undefined };
    case 'task4':
      return { basicInfo: basicInfo || undefined, bmc: bmc || undefined, requirementLogic: requirementLogic || undefined };
    case 'task5':
    case 'task6':
      return { valueStream: valueStream || undefined, requirementLogic: requirementLogic || undefined };
    case 'task7':
      return valueStream ? { valueStream } : { note: '尚无已绘制价值流图' };
    case 'task8': {
      const prelimKeys = preliminaryReq && typeof preliminaryReq === 'object' ? Object.keys(preliminaryReq) : [];
      const prelimNonEmpty =
        prelimKeys.length > 0 &&
        prelimKeys.some((k) => {
          const v = preliminaryReq[k];
          if (v == null) return false;
          if (typeof v === 'string') return v.trim() !== '';
          if (typeof v === 'object') return Object.keys(v).length > 0;
          return true;
        });
      const enterpriseContext = basicInfo || requirementLogic || prelimNonEmpty
        ? { basicInfo: basicInfo || undefined, requirementLogic: requirementLogic || undefined, preliminary: preliminaryReq }
        : undefined;
      return { enterpriseContext, businessCanvas: bmc || undefined, fullProcessVsm: valueStream || undefined };
    }
    case 'task9':
      return { valueStream: valueStream || undefined, globalItGapAnalysisJson: globalItGapAnalysisJson || undefined };
    case 'task12':
    case 'task13':
    case 'task14':
    case 'task15':
      return { valueStream: valueStream || undefined, globalItGapAnalysisJson: globalItGapAnalysisJson || undefined, localItGapSessions: (localItGapSessions && localItGapSessions.length) ? localItGapSessions : undefined };
    default:
      return {};
  }
}

/**
 * 是否输出「初步需求提取」时间线推送诊断日志。
 * - `globalThis.__FE_TASK1_PRELIM_DEBUG === true`：强制开启（online 排查用）
 * - `globalThis.__FE_TASK1_PRELIM_DEBUG === false`：强制关闭
 * - 未设置且 `APP_CONFIG.MODE === 'local'`：默认开启
 */
function shouldLogTask1PrelimLlm() {
  try {
    if (globalThis.__FE_TASK1_PRELIM_DEBUG === false) return false;
    if (globalThis.__FE_TASK1_PRELIM_DEBUG === true) return true;
    // 默认开启，直到排查完成后再改回按模式输出
    return true;
  } catch (_) {
    return true;
  }
}

/** 诊断日志：控制台过滤 `[FE:task1-prelim-llm]` */
function logTask1PrelimLlm(tag, payload) {
  if (!shouldLogTask1PrelimLlm()) return;
  try {
    console.info('[FE:task1-prelim-llm]', tag, payload == null ? '' : payload);
  } catch (_) {}
}

/** task1「补充需求」链路诊断日志：控制台过滤 `[FE:task1-prelim-supplement]` */
function logTask1PrelimSupplement(tag, payload) {
  if (!shouldLogTask1PrelimLlm()) return;
  try {
    console.info('[FE:task1-prelim-supplement]', tag, payload == null ? '' : payload);
  } catch (_) {}
}

/** task1 任务状态/聊天渲染诊断日志：控制台过滤 `[FE:task1-prelim-status]` */
function logTask1PrelimStatus(tag, payload) {
  if (!shouldLogTask1PrelimLlm()) return;
  try {
    console.info('[FE:task1-prelim-status]', tag, payload == null ? '' : payload);
  } catch (_) {}
}

/** 聊天中是否已有「初步需求」类 task1 LLM-查询块（含首页解析复用数据） */
function hasMessagesTask1PreliminaryLlmQuery(messages) {
  if (!Array.isArray(messages)) return false;
  return messages.some((m) => {
    if (!m || m.type !== 'task1LlmQueryBlock') return false;
    const note = String(m.noteName || '');
    return note.includes('初步需求');
  });
}

/**
 * 同步/后端可能丢掉 noteName：若仅剩无备注的 task1LlmQueryBlock，用过程日志指纹与待写入块比对视为同一条。
 * @param {unknown[]} messages
 * @param {Record<string, unknown>} candidateMsg
 * @returns {boolean}
 */
function hasMessagesTask1PreliminaryLlmQueryStrippedNote(messages, candidateMsg) {
  if (!Array.isArray(messages) || !candidateMsg) return false;
  const dupFn =
    typeof globalThis.SmartCto?.problemDetailChat?.isDuplicateProcessLogLlmMessage === 'function'
      ? globalThis.SmartCto.problemDetailChat.isDuplicateProcessLogLlmMessage
      : null;
  if (!dupFn) return false;
  return messages.some((m) => {
    if (!m || m.type !== 'task1LlmQueryBlock' || String(m.taskId || 'task1') !== 'task1') return false;
    if (String(m.noteName || '').trim() !== '') return false;
    return dupFn([m], candidateMsg);
  });
}

/**
 * 收集「是否已存在初步需求提取时间线」判定用的消息列表：适配器缓存 id/createdAt 双键 + 当前内存（须与本案绑定）。
 * @param {Object|null|undefined} item
 * @param {string} chatStorageKey
 * @returns {Array<unknown[]>}
 */
function gatherTask1PreliminaryLlmDedupMessageLists(item, chatStorageKey) {
  const lists = [];
  const seen = new Set();
  const add = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0 || seen.has(arr)) return;
    seen.add(arr);
    lists.push(arr);
  };
  const keySet = new Set();
  if (chatStorageKey) keySet.add(String(chatStorageKey));
  if (item && typeof getProblemFollowCompatibleCaseKeys === 'function') {
    for (const k of getProblemFollowCompatibleCaseKeys(item)) {
      if (k != null && String(k).trim() !== '') keySet.add(String(k).trim());
    }
  }
  if (typeof getProblemDetailChats === 'function') {
    const map = getProblemDetailChats();
    for (const k of keySet) {
      const arr = map[k];
      if (Array.isArray(arr)) add(arr);
    }
  }
  const mem = __appState.problemDetailChatMessages;
  const memCk = __appState.problemDetailChatMessagesCaseKey;
  if (Array.isArray(mem) && mem.length > 0 && memCk != null && memCk !== '') {
    const memK = String(memCk);
    if (keySet.has(memK) || (chatStorageKey && memK === String(chatStorageKey))) {
      add(mem);
    }
  }
  return lists;
}

/**
 * 将多路聊天数组摊平为一条列表再判重（避免 id/createdAt 两键曾不同步时只扫到较短分支而误判「尚无初步需求块」）。
 * @param {Array<unknown[]>} lists
 * @returns {unknown[]}
 */
function flattenTask1PrelimDedupChatMessages(lists) {
  const out = [];
  if (!Array.isArray(lists)) return out;
  for (const arr of lists) {
    if (!Array.isArray(arr) || arr.length === 0) continue;
    for (let i = 0; i < arr.length; i++) {
      const m = arr[i];
      if (m) out.push(m);
    }
  }
  return out;
}

/**
 * @param {Array<unknown[]>} lists
 * @param {Record<string, unknown>} candidateMsg
 * @returns {string|null} 跳过原因，可推送时为 null
 */
function resolveSkipPushTask1PreliminaryLlmQueryReason(lists, candidateMsg) {
  const flat = flattenTask1PrelimDedupChatMessages(lists);
  const dupFn =
    typeof globalThis.SmartCto?.problemDetailChat?.isDuplicateProcessLogLlmMessage === 'function'
      ? globalThis.SmartCto.problemDetailChat.isDuplicateProcessLogLlmMessage
      : null;
  if (flat.length > 0) {
    if (hasMessagesTask1PreliminaryLlmQuery(flat)) return 'already_has_preliminary_task1LlmQueryBlock';
    if (hasMessagesTask1PreliminaryLlmQueryStrippedNote(flat, candidateMsg)) return 'already_has_preliminary_stripped_note_or_fingerprint';
    if (dupFn && dupFn(flat, candidateMsg)) return 'dedup_identical_llm_process_log_card';
  }
  return null;
}

/** 初步需求提取 LLM 输入兜底：至少保留当时用户原文，避免卡片输入显示「(无)」 */
function buildTask1PreliminaryInputPromptFallback(item) {
  const requirementDetail = String(item?.requirementDetail ?? item?.requirement_detail ?? '').trim();
  if (!requirementDetail) return '';
  return `【system】\n数字化需求分析助手（历史回填）\n\n【user】\n${requirementDetail}`;
}

/** task1 初步需求 LLM 查询缺失时，仅在新版 V2 已持久化时用摘要 JSON 兜底（不再合成旧版扁平字段） */
function buildTask1PreliminaryLlmQueryFallbackFromItem(item) {
  if (!item) return null;
  const pr = item.preliminaryReq && typeof item.preliminaryReq === 'object' ? item.preliminaryReq : null;
  const hasV2Stored =
    pr && typeof window.isPreliminaryRequirementV2Shape === 'function' && window.isPreliminaryRequirementV2Shape(pr);
  if (!hasV2Stored) return null;
  const summary =
    typeof window.buildPreliminarySummaryJson === 'function' ? window.buildPreliminarySummaryJson(item) : {};
  const keys = summary && typeof summary === 'object' ? Object.keys(summary) : [];
  const hasAny =
    keys.length > 0 &&
    keys.some((k) => {
      const v = summary[k];
      if (v == null) return false;
      if (typeof v === 'string') return v.trim() !== '';
      if (typeof v === 'object') return Object.keys(v).length > 0;
      return true;
    });
  if (!hasAny) return null;
  const rawOut =
    typeof window.buildPreliminaryStructuredJsonString === 'function'
      ? window.buildPreliminaryStructuredJsonString(item)
      : JSON.stringify(summary, null, 2);
  return {
    noteName: '初步需求提取',
    llmInputPrompt: buildTask1PreliminaryInputPromptFallback(item),
    llmOutputJson: summary,
    llmOutputRaw: rawOut,
    llmMeta: undefined,
    __fallback: true,
  };
}

/**
 * 将首页解析得到的初步需求大模型调用写入聊天时间线（task1LlmQueryBlock），供沟通历史与聊天区展示。
 * 插入在「企业背景洞察」任务启动通知之前；若尚无启动通知则追加在末尾。
 * **FE-20260410**：已停用向时间线推送备注为「初步需求提取」的卡片（与 `communication-history.js` 过滤一致）；深度提炼仍由 `problem-detail-runtime` 推送「客户初步需求提炼（深度）」`task1LlmQueryBlock`。仍会同步 `item.task1InitialLlmQuery` 供档案与 dedup 指纹。
 * @returns {boolean} 是否新写入了一条消息
 */
function pushTask1PreliminaryLlmQueryFromCaseIfNeeded(item, sourceTag) {
  const source = sourceTag || 'unknown';
  const chatKeyTry = item ? getProblemDetailChatStorageKey(item) : '';
  const task1Done = typeof isTaskCompleted === 'function' ? isTaskCompleted(item, 'task1') : null;
  const persistedInit = readTask1InitialLlmQueryForItem(item);
  const fallbackInit = buildTask1PreliminaryLlmQueryFallbackFromItem(item);
  const effectiveInit = item?.task1InitialLlmQuery || persistedInit || fallbackInit;
  logTask1PrelimLlm('invoke', {
    source,
    hasTask1InitialLlmQuery: !!item?.task1InitialLlmQuery,
    hasPersistedTask1InitialLlmQuery: !!persistedInit,
    hasFallbackInitialLlmQuery: !!fallbackInit,
    chatStorageKey: chatKeyTry || '(empty)',
    createdAt: item?.createdAt,
    id: item?.id,
    chatMode: problemDetailChatMode,
    task1Completed: task1Done,
    msgCountBefore: Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages.length : null,
  });
  if (!effectiveInit) {
    logTask1PrelimLlm('skip', { source, reason: 'no_task1InitialLlmQuery_and_no_fallback' });
    return false;
  }
  const chatStorageKey = chatKeyTry;
  if (!chatStorageKey) {
    logTask1PrelimLlm('skip', { source, reason: 'no_chatStorageKey' });
    return false;
  }
  if (typeof isTaskCompleted === 'function' && isTaskCompleted(item, 'task1')) {
    logTask1PrelimLlm('skip', { source, reason: 'task1_already_completed' });
    return false;
  }
  const initLlm = effectiveInit;
  if (item && initLlm && !item.task1InitialLlmQuery) {
    item.task1InitialLlmQuery = { ...initLlm };
  }
  logTask1PrelimLlm('skip', { source, reason: 'preliminary_extraction_llm_card_push_disabled_keep_deep_refinement_only' });
  return false;
}

/** 按当前 __appState.problemDetailChatMessages 全量重绘聊天区（插入 LLM 块后等与 append 混用时的兜底） */
function rerenderProblemDetailChatFromStorageState() {
  const chatContainer = el.problemDetailChatMessages;
  if (!chatContainer) return;
  chatContainer.innerHTML = '';
  renderProblemDetailChatFromStorage(chatContainer, __appState.problemDetailChatMessages);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/** 将聊天区滚动到指定任务的任务启动通知块（若存在），确保用户可见 */
function scrollChatToTaskStartNotification(taskId) {
  problemDetailChatBridge?.scrollToTaskStart?.(taskId);
}

/** 任务启动通知「我即将开始【*】任务」仅允许的触发原因（与产品口径一致：①上一任务已完成后的下一任务；②进入/刷新详情且 canonical 当前任务仍为「待执行」） */
const TASK_START_NOTIFY_AFTER_PREV_COMPLETED = 'after_prev_completed';
const TASK_START_NOTIFY_NAVIGATE_PENDING = 'navigate_pending';

/**
 * 任务阶段 / 启动通知链路调试：控制台执行 `globalThis.__FE_TASK_PHASE_DEBUG = true` 后刷新详情，查看 `[FE:task-phase]`。
 * 关闭：`globalThis.__FE_TASK_PHASE_DEBUG = false`
 */
function logTaskPhaseNotificationDebug(tag, payload) {
  try {
    if (globalThis.__FE_TASK_PHASE_DEBUG !== true) return;
    console.info('[FE:task-phase]', tag, payload === undefined ? '' : payload);
  } catch (_) {}
}

/** 若聊天中尚无该任务的任务启动通知，或已有但用户未确认，则在聊天区展示/重新下发统一任务启动通知（任务通知：我即将开始【任务名称】任务 + 确认按钮）
 * @param {string} taskId - 任务 id
 * @param {boolean} [forceShow=false] - 为 true 时即使已有已确认通知也重新下发（用于打开详情/刷新后，回退后该任务的「已确认」已失效）
 * @param {string} [reason] - 必须为 TASK_START_NOTIFY_AFTER_PREV_COMPLETED 或 TASK_START_NOTIFY_NAVIGATE_PENDING；后者仅当 getTaskStatusText 为「待执行」时下发
 */
function showTaskStartNotificationIfNeeded(taskId, forceShow, reason) {
  if (reason !== TASK_START_NOTIFY_AFTER_PREV_COMPLETED && reason !== TASK_START_NOTIFY_NAVIGATE_PENDING) {
    return;
  }
  const container = el.problemDetailChatMessages;
  const item = __appState.currentProblemDetailItem;
  if (!container || !item?.createdAt) {
    logTaskPhaseNotificationDebug('showTaskStart:skip', { taskId, reason, why: !container ? 'no-container' : 'no-item' });
    return;
  }
  logTaskPhaseNotificationDebug('showTaskStart:enter', {
    taskId,
    forceShow: !!forceShow,
    reason,
    itemMajor: item.currentMajorStage,
    viewingMajor: problemDetailViewingMajorStage,
    wsTid: typeof getWorkspaceViewingTaskId === 'function' ? getWorkspaceViewingTaskId() : null,
  });
  if (reason === TASK_START_NOTIFY_NAVIGATE_PENDING) {
    const allTasksForPhase = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...IT_STRATEGY_TASKS];
    const dataItem = typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() || item : item;
    const msgs = typeof getProblemDetailChatMessagesForCanonical === 'function' ? getProblemDetailChatMessagesForCanonical(dataItem) : __appState.problemDetailChatMessages;
    const phase =
      typeof getTaskStatusText === 'function' ? getTaskStatusText(dataItem, taskId, allTasksForPhase, msgs) : '—';
    if (phase !== '待执行') {
      logTaskPhaseNotificationDebug('showTaskStart:skip', { taskId, reason, why: 'phase-not-pending', phase, mergedItemMajor: dataItem?.currentMajorStage });
      return;
    }
  }
  const allTasks = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...IT_STRATEGY_TASKS];
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) {
    logTaskPhaseNotificationDebug('showTaskStart:skip', { taskId, reason, why: 'unknown-taskId' });
    return;
  }
  if (taskId === 'task3') {
    const hasBasicInfoCtx = __appState.problemDetailChatMessages.some((m) => m.type === 'taskContextBlock' && m.taskId === 'task3' && m.contextLabel === '客户基本信息 json');
    const hasBmcCtx = __appState.problemDetailChatMessages.some((m) => m.type === 'taskContextBlock' && m.taskId === 'task3' && m.contextLabel === '商业模式画布 BMC json');
    if (!hasBasicInfoCtx) {
      pushAndSaveProblemDetailChat({
        type: 'taskContextBlock',
        taskId: 'task3',
        contextLabel: '客户基本信息 json',
        contextJson: item.basicInfo || {},
        timestamp: getTimeStr(),
      });
    }
    if (!hasBmcCtx) {
      pushAndSaveProblemDetailChat({
        type: 'taskContextBlock',
        taskId: 'task3',
        contextLabel: '商业模式画布 BMC json',
        contextJson: item.bmc || {},
        timestamp: getTimeStr(),
      });
    }
  }
  if (taskId === 'task12' && !isProblemDetailChatCboUiSuppressed()) {
    const sessions = item.coreBusinessObjectSessions || [];
    if (sessions.length > 0 && !sessions.some((s) => !s.coreBusinessObjectJson)) {
      const hasUnconfirmed = __appState.problemDetailChatMessages.some((m) => m.type === 'coreBusinessObjectAnalysisCard' && !m.confirmed);
      if (hasUnconfirmed) return;
    }
  }
  const existingIdx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'taskStartNotification' && m.taskId === taskId);
  if (existingIdx >= 0) {
    const existing = __appState.problemDetailChatMessages[existingIdx];
    if (existing.confirmed && !forceShow) {
      return; // 已确认且非强制展示，无需重复下发
    }
    // 未确认或强制展示（如回退后刷新）：移除旧通知，重新下发到底部
    __appState.problemDetailChatMessages.splice(existingIdx, 1);
    saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
  }
  pushAndSaveProblemDetailChat({
    type: 'taskStartNotification',
    taskId: task.id,
    taskName: task.name,
    timestamp: getTimeStr(),
    confirmed: false,
  });
  logTaskPhaseNotificationDebug('showTaskStart:pushed', {
    taskId: task.id,
    taskName: task.name,
    reason,
    forceShow: !!forceShow,
  });
  const taskStartNotifyBody =
    taskId === 'task7'
      ? '任务通知：我即将开始端到端事务流构建任务'
      : `任务通知：我即将开始【${escapeHtml(task.name)}】任务`;
  const block = document.createElement('div');
  block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-task-start-notification';
  block.dataset.msgIndex = String(__appState.problemDetailChatMessages.length - 1);
  block.innerHTML = `
    <div class="problem-detail-chat-msg-content-wrap">
      <div class="problem-detail-chat-msg-content">${taskStartNotifyBody}</div>
      <div class="problem-detail-chat-task-start-notification-actions">
        <button type="button" class="btn-confirm-task-start btn-confirm-primary" data-task-id="${escapeHtml(task.id)}" data-task-name="${escapeHtml(task.name)}">确认</button>
      </div>
    </div>
    <div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
  container.appendChild(block);
  container.scrollTop = container.scrollHeight;
}

/** 检查聊天中是否存在「下一任务」之前的未确认输出卡片（有则不下发下一任务启动通知） */
function hasUnconfirmedOutputCardBeforeTask(messages, nextTaskId) {
  if (!Array.isArray(messages)) return false;
  // 下一任务为 task9 且全局 ITGap 已产出时，不再用 task1–5 聊天卡的「未确认」态拦截（在线 bundle 刷新可能用服务端快照覆盖缓存，陈旧未确认标记会误判并吞掉局部 ITGap 的任务启动通知；FE-20260325-06）
  if (nextTaskId === 'task9') {
    const item = typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() : null;
    if (item && isTaskCompleted(item, 'task8')) {
      return false;
    }
  }
  const allTasks = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...IT_STRATEGY_TASKS];
  const nextIdx = allTasks.findIndex((t) => t.id === nextTaskId);
  if (nextIdx <= 0) return false;
  let taskIdsToCheck = allTasks.slice(0, nextIdx).map((t) => t.id);
  // 下一任务为 task3 时，仅用 task1 的未确认卡拦截；task2 的 bmc 可能未点确认但状态已推进到 task3，仍允许下发 task3 通知
  if (nextTaskId === 'task3') {
    taskIdsToCheck = ['task1'];
  }
  const itemForCards =
    typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() : null;
  const cardByTask = { task1: 'basicInfoCard', task2: 'bmcCard', task3: 'requirementLogicBlock', task4: 'valueStreamCard', task5: 'itStatusCard' };
  for (const tid of taskIdsToCheck) {
    if (itemForCards && isTaskCompleted(itemForCards, tid)) continue;
    const cardType = cardByTask[tid];
    if (!cardType) continue;
    const hasUnconfirmed = messages.some((m) => m.type === cardType && !m.confirmed);
    if (hasUnconfirmed) {
      return true;
    }
  }
  // 下一任务为 task12 时，须管线判定 task9 已完工（itGapCompletedStages 含 2 等），不依赖历史聊天块
  if (nextTaskId === 'task12') {
    const itemFor12 =
      typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() : null;
    if (itemFor12 && !isTaskCompleted(itemFor12, 'task9')) {
      return true;
    }
  }
  return false;
}

/** 合并两侧「阶段完成」类数组（去重升序），用于 resolveProblemItemForTaskNotification（FE-20260323-05） */
function mergeCompletedStageArrays(a, b) {
  return [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])].sort((x, y) => x - y);
}

/**
 * 合并「指定案例」与 getDigitalProblems() 中同案行的完成态字段，供下一任务判定（FE-20260322-04-B、FE-20260323-05）。
 * online 下 bundle 与列表缓存偶发不同步时，避免 getFirstUncompletedTask 吃到缺字段的一侧；
 * 除 completedTaskIds 外须合并 workflowAlignCompletedStages / itGapCompletedStages / completedStages，避免 …cur 覆盖列表侧较新阶段位。
 * @param {object} [itemForMerge] 传入时按该案例与列表合并（首页多卡 canonical 必须用此口径）；不传则仍用 `__appState.currentProblemDetailItem`（详情内全局调用）
 */
function resolveProblemItemForTaskNotification(itemForMerge) {
  const cur = itemForMerge !== undefined ? itemForMerge : __appState.currentProblemDetailItem;
  if (!cur?.createdAt) return null;
  const list = getDigitalProblems();
  const fromList = list.find((p) =>
    (cur.id && p.id && String(p.id) === String(cur.id)) ||
    String(p.createdAt) === String(cur.createdAt) ||
    (cur.id && String(p.createdAt) === String(cur.id)) ||
    (p.id && String(p.createdAt) === String(cur.id))
  );
  if (!fromList) return cur;
  const a = fromList.completedTaskIds || [];
  const b = cur.completedTaskIds || [];
  const mergedIds = [...new Set([...a, ...b])].sort();
  const mergedWf = mergeCompletedStageArrays(fromList.workflowAlignCompletedStages, cur.workflowAlignCompletedStages);
  const mergedItGap = mergeCompletedStageArrays(fromList.itGapCompletedStages, cur.itGapCompletedStages);
  const mergedReqStages = mergeCompletedStageArrays(fromList.completedStages, cur.completedStages);
  // 取两侧较大 currentMajorStage，避免 online 列表与详情/ bundle 短暂不同步时 `...cur` 把已推进阶段覆盖成 0，导致 isTaskCompleted(task1) 为 false、顶栏 canonical 误回 task1（FE-20260328-24）
  const mergedMajorStage = Math.max(
    Number(fromList.currentMajorStage) || 0,
    Number(cur.currentMajorStage) || 0,
  );
  return {
    ...fromList,
    ...cur,
    currentMajorStage: mergedMajorStage,
    // 避免 `...cur` 把 undefined 盖掉列表侧已落库的全局 ITGap JSON（task8 完成态）
    globalItGapAnalysisJson: cur.globalItGapAnalysisJson ?? fromList.globalItGapAnalysisJson,
    // 避免 `...cur` 把 undefined 盖掉列表侧 task1 初步需求 / 过程快照（online 详情与列表短暂不同步时，补充链路异常后工作区 view/json 被清空）
    preliminaryReq: cur.preliminaryReq != null ? cur.preliminaryReq : fromList.preliminaryReq,
    task1InitialLlmQuery:
      cur.task1InitialLlmQuery != null ? cur.task1InitialLlmQuery : fromList.task1InitialLlmQuery,
    task1PendingPreliminaryRequirement:
      cur.task1PendingPreliminaryRequirement != null
        ? cur.task1PendingPreliminaryRequirement
        : fromList.task1PendingPreliminaryRequirement,
    requirementDetail: cur.requirementDetail !== undefined ? cur.requirementDetail : fromList.requirementDetail,
    requirementDetailHistory: Array.isArray(cur.requirementDetailHistory)
      ? cur.requirementDetailHistory
      : fromList.requirementDetailHistory,
    objectStateMachineJson: cur.objectStateMachineJson ?? fromList.objectStateMachineJson,
    completedTaskIds: mergedIds,
    workflowAlignCompletedStages: mergedWf,
    itGapCompletedStages: mergedItGap,
    completedStages: mergedReqStages,
  };
}

/** FE-20260323-05：task5 任务完成确认「已完成」前后，owner 控制台对照用 */
function logTask5TaskDoneProgressDebug(phase) {
  if (typeof console === 'undefined' || typeof console.log !== 'function') return;
  try {
    const cur = __appState.currentProblemDetailItem;
    const list = getDigitalProblems();
    const fromList = list.find((p) =>
      (cur?.id && p.id && String(p.id) === String(cur.id)) ||
      String(p?.createdAt) === String(cur?.createdAt) ||
      (cur?.id && String(p.createdAt) === String(cur.id)) ||
      (p.id && String(cur?.createdAt) === String(cur.id))
    );
    const resolved = resolveProblemItemForTaskNotification();
    const nextFirst = resolved ? getFirstUncompletedTask(resolved) : null;
    console.log('[FE-20260323-task5-done]', phase, {
      currentProblemDetailItem_workflowAlign: cur?.workflowAlignCompletedStages,
      listSameCase_workflowAlign: fromList?.workflowAlignCompletedStages,
      resolveProblemItem_workflowAlign: resolved?.workflowAlignCompletedStages,
      getFirstUncompletedTask_id: nextFirst?.id ?? null,
    });
  } catch (err) {
    console.warn('[FE-20260323-task5-done]', phase, err);
  }
}

/** 自动触发当前第一个未完成任务的任务启动通知（仅情况 1：上一任务刚进入「已完成」后的下一任务）；下一任务与 getCanonicalCurrentProblemFollowTaskState 同源。 */
function showNextTaskStartNotification() {
  const item = __appState.currentProblemDetailItem;
  if (!item?.createdAt) {
    return;
  }
  const hasPendingLlmResume = Array.isArray(__appState.problemDetailChatMessages) &&
    __appState.problemDetailChatMessages.some((m) => m?.type === 'llmResumeIntentBlock' && !m.confirmed);
  if (hasPendingLlmResume) return;
  const dataItem = resolveProblemItemForTaskNotification() || item;
  const msgs = getProblemDetailChatMessagesForCanonical(dataItem);
  const canon = getCanonicalCurrentProblemFollowTaskState(dataItem, msgs);
  if (!canon?.taskId || canon.allComplete) {
    return;
  }
  const hasUnconfirmed = hasUnconfirmedOutputCardBeforeTask(__appState.problemDetailChatMessages, canon.taskId);
  if (hasUnconfirmed) {
    return;
  }
  showTaskStartNotificationIfNeeded(canon.taskId, true, TASK_START_NOTIFY_AFTER_PREV_COMPLETED);
}

/**
 * 情况 2：打开详情 / 刷新 bundle 后，仅当 **canonical 当前任务** 仍处于「待执行」时补发该任务启动通知（避免进行中重复下发；与管线首个未完成任务一致，FE-20260328-29）。
 * 沟通历史/顶栏「进行中」仍由 `getWorkspaceViewingTaskId` + `getTaskStatusText` 决定；此处不得用滞后 viewing 的 wsTid，否则 task7 待执行时可能误对已完成 task6 校验而拒发。
 */
function showNextTaskStartNotificationIfCurrentTaskPendingOnly() {
  const item = __appState.currentProblemDetailItem;
  if (!item?.createdAt) {
    logTaskPhaseNotificationDebug('navigatePending:skip', { why: 'no-item' });
    return;
  }
  const hasPendingLlmResume = Array.isArray(__appState.problemDetailChatMessages) &&
    __appState.problemDetailChatMessages.some((m) => m?.type === 'llmResumeIntentBlock' && !m.confirmed);
  if (hasPendingLlmResume) {
    logTaskPhaseNotificationDebug('navigatePending:skip', { why: 'pending-llm-resume' });
    return;
  }
  const dataItem = resolveProblemItemForTaskNotification() || item;
  const msgs = getProblemDetailChatMessagesForCanonical(dataItem);
  const canon = getCanonicalCurrentProblemFollowTaskState(dataItem, msgs);
  logTaskPhaseNotificationDebug('navigatePending:probe', {
    caseKey: typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : null,
    itemMajor: item.currentMajorStage,
    mergedMajor: dataItem?.currentMajorStage,
    viewingMajor: problemDetailViewingMajorStage,
    itGapSubstep: itGapViewingSubstep,
    wsTid: typeof getWorkspaceViewingTaskId === 'function' ? getWorkspaceViewingTaskId() : null,
    canonTaskId: canon?.taskId,
    canonMajor: canon?.majorStage,
    canonAllComplete: !!canon?.allComplete,
    msgLen: Array.isArray(msgs) ? msgs.length : -1,
    memMsgLen: Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages.length : -1,
    memCaseKey: __appState.problemDetailChatMessagesCaseKey,
  });
  if (!canon || canon.allComplete || !canon.taskId) {
    logTaskPhaseNotificationDebug('navigatePending:skip', { why: 'no-canon-target', canon });
    return;
  }
  const targetTid = canon.taskId;
  const hasUnconfirmed = hasUnconfirmedOutputCardBeforeTask(__appState.problemDetailChatMessages, targetTid);
  if (hasUnconfirmed) {
    logTaskPhaseNotificationDebug('navigatePending:skip', { why: 'unconfirmed-card-before', targetTid });
    return;
  }
  logTaskPhaseNotificationDebug('navigatePending:callShowTaskStart', { targetTid });
  showTaskStartNotificationIfNeeded(targetTid, true, TASK_START_NOTIFY_NAVIGATE_PENDING);
}

/** 流程异常快照：类型中文标签（写入 localStorage 供「异常继续」） */
const FLOW_EXCEPTION_TYPE_LABELS = {
  llm: '大模型调用异常',
  render: '页面渲染或运行时异常',
  network: '网络或异步异常',
  unknown: '未知异常',
};

function buildFlowExceptionSnapshot(type, description) {
  const item = __appState.currentProblemDetailItem;
  const caseKey = typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
  if (!caseKey || !item) return null;
  const merged =
    typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() || item : item;
  const allTasks = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...IT_STRATEGY_TASKS];
  const wsTid = typeof getWorkspaceViewingTaskId === 'function' ? getWorkspaceViewingTaskId() : '';
  const msgs =
    typeof getProblemDetailChatMessagesForCanonical === 'function' ? getProblemDetailChatMessagesForCanonical(merged) : [];
  const taskPhase =
    typeof getTaskStatusText === 'function' && wsTid ? getTaskStatusText(merged, wsTid, allTasks, msgs) : '—';
  const canon =
    typeof getCanonicalCurrentProblemFollowTaskState === 'function'
      ? getCanonicalCurrentProblemFollowTaskState(merged, msgs)
      : null;
  const probe = globalThis.SmartCto?.flowExceptionRecord?.getLastSystemActionProbe?.() || {};
  const archiveNo = item.archiveNo != null ? String(item.archiveNo) : '';
  const w = problemDetailWaitingForFeedback;
  return {
    archiveNo,
    caseKey,
    type: String(type || 'unknown'),
    typeLabel: FLOW_EXCEPTION_TYPE_LABELS[type] || FLOW_EXCEPTION_TYPE_LABELS.unknown,
    description: String(description || '').slice(0, 4000),
    occurredAt: new Date().toISOString(),
    taskId: wsTid || '',
    taskPhase,
    canonicalTaskId: canon?.taskId || '',
    lastSystemAction: {
      kind: probe.kind || 'none',
      summary: probe.summary || '',
      detail: probe.detail || null,
      at: probe.at || null,
    },
    problemDetailWaitingForFeedbackSnapshot: w ? { ...w } : null,
    viewingMajorStage: problemDetailViewingMajorStage,
    itGapViewingSubstep,
    itStrategyPlanViewingSubstep,
    persistedMajorStage: merged.currentMajorStage ?? 0,
  };
}

function recordFlowExceptionTyped(type, description) {
  try {
    const snap = buildFlowExceptionSnapshot(type, description);
    if (!snap || !globalThis.SmartCto?.flowExceptionRecord?.recordFlowException) return;
    globalThis.SmartCto.flowExceptionRecord.recordFlowException(snap);
    updateFlowExceptionResumeButtonVisibility();
  } catch (e) {
    console.warn('[flow-exception] record failed', e);
  }
}

function updateFlowExceptionResumeButtonVisibility() {
  const btn = el.btnProblemDetailExceptionResume;
  if (!btn) return;
  btn.hidden = false;
  const item = __appState.currentProblemDetailItem;
  const caseKey = typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
  const ex = caseKey && globalThis.SmartCto?.flowExceptionRecord?.getLastFlowException?.(caseKey);
  btn.disabled = !ex;
  btn.setAttribute('aria-disabled', ex ? 'false' : 'true');
  if (ex) {
    const t = ex.occurredAt || '';
    const d = String(ex.description || '').slice(0, 160);
    btn.title = `上次异常：${ex.typeLabel || ex.type}\n时间：${t}\n任务/阶段：${ex.taskId || '—'} / ${ex.taskPhase || '—'}\n${d}`;
  } else {
    btn.title = caseKey
      ? '当前档案暂无可恢复的异常记录。大模型失败、未捕获的页面/网络错误等会自动写入快照，也可在控制台执行 recordFlowExceptionTyped(...) 手动记录。'
      : '请先打开案例详情';
  }
}

/** 按最近一次异常快照恢复等待态、工作区焦点，并重放最近系统动作（聊天推送） */
function applyFlowExceptionResume() {
  const item = __appState.currentProblemDetailItem;
  const caseKey = typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
  if (!item || !caseKey) {
    showError('当前无打开的案例，无法异常继续。');
    return;
  }
  const ex = globalThis.SmartCto?.flowExceptionRecord?.getLastFlowException?.(caseKey);
  if (!ex) {
    showError('当前档案没有可恢复的异常记录。');
    return;
  }
  if (ex.problemDetailWaitingForFeedbackSnapshot && typeof ex.problemDetailWaitingForFeedbackSnapshot === 'object') {
    problemDetailWaitingForFeedback = {
      ...ex.problemDetailWaitingForFeedbackSnapshot,
      createdAt: caseKey,
    };
  } else {
    problemDetailWaitingForFeedback = null;
  }
  const tid = String(ex.taskId || ex.canonicalTaskId || 'task1').trim() || 'task1';
  focusWorkspaceOnCurrentTask(tid);

  const act = ex.lastSystemAction || {};
  const lastMsg = Array.isArray(__appState.problemDetailChatMessages)
    ? __appState.problemDetailChatMessages[__appState.problemDetailChatMessages.length - 1]
    : null;

  if (act.kind === 'task_start_notification' && act.detail?.taskId) {
    showTaskStartNotificationIfNeeded(act.detail.taskId, true, TASK_START_NOTIFY_AFTER_PREV_COMPLETED);
  } else if (act.kind === 'system_message' && act.detail?.content) {
    const c = String(act.detail.content);
    const dup = lastMsg?.role === 'system' && String(lastMsg.content || '') === c;
    if (c === TASK1_PRELIM_SUPPLEMENT_CONTINUE_PROMPT) {
      problemDetailWaitingForFeedback = {
        taskId: 'task1',
        createdAt: caseKey,
        type: 'modification',
        prelimSupplement: true,
      };
    }
    if (!dup) {
      pushAndSaveProblemDetailChat({ role: 'system', content: c, timestamp: getTimeStr() });
    }
  } else if (act.kind === 'preliminary_followup_block') {
    const dupBlock =
      lastMsg?.type === 'preliminaryRequirementFollowupBlock' &&
      String(lastMsg.content || '') === '客户初步需求已经更新到工作区';
    if (!dupBlock) {
      pushAndSaveProblemDetailChat({
        type: 'preliminaryRequirementFollowupBlock',
        taskId: 'task1',
        content: '客户初步需求已经更新到工作区',
        timestamp: getTimeStr(),
      });
    }
  } else if (act.kind === 'llm_retry_notice' && act.detail?.content != null) {
    const ra = String(act.detail.retryAction || '').trim();
    if (ra === 'task8-it-design-auto-seq' && typeof window.runItDesignSupplementAutoSequential === 'function') {
      void window.runItDesignSupplementAutoSequential(__appState.currentProblemDetailItem);
    } else {
      const c = String(act.detail.content);
      const dupRetry = lastMsg?.type === 'llmRetryNoticeBlock' && String(lastMsg.content || '') === c;
      if (!dupRetry) {
        pushAndSaveProblemDetailChat({
          type: 'llmRetryNoticeBlock',
          taskId: act.detail.taskId || '',
          content: c,
          retryAction: act.detail.retryAction || 'continue-current-task',
          retryTargetLabel: act.detail.retryTargetLabel || '',
          timestamp: getTimeStr(),
        });
      }
    }
  }

  const container = el.problemDetailChatMessages;
  if (container) {
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
  }
  renderProblemDetailContent();
  renderProblemDetailHistory();
  updateProblemDetailTaskStepBar();
  updateProblemDetailChatHeaderLabel();
  globalThis.SmartCto?.flowExceptionRecord?.clearFlowException?.(caseKey);
  updateFlowExceptionResumeButtonVisibility();
}

function installGlobalFlowExceptionCapturers() {
  if (globalThis.__FE_FLOW_EXCEPTION_CAPTURE__) return;
  globalThis.__FE_FLOW_EXCEPTION_CAPTURE__ = true;
  window.addEventListener('error', (ev) => {
    try {
      if (el.problemDetailView?.hidden) return;
      const now = Date.now();
      if (now - (globalThis.__FE_FLOW_EXC_DEBOUNCE_TS__ || 0) < 1200) return;
      globalThis.__FE_FLOW_EXC_DEBOUNCE_TS__ = now;
      recordFlowExceptionTyped('render', ev?.message || 'window.error');
    } catch (_) {}
  });
  window.addEventListener('unhandledrejection', (ev) => {
    try {
      if (el.problemDetailView?.hidden) return;
      const now = Date.now();
      if (now - (globalThis.__FE_FLOW_EXC_DEBOUNCE_TS__ || 0) < 1200) return;
      globalThis.__FE_FLOW_EXC_DEBOUNCE_TS__ = now;
      const r = ev?.reason;
      recordFlowExceptionTyped('network', r?.message || String(r || 'unhandledrejection'));
    } catch (_) {}
  });
}

/** 统一推送：大模型调用异常通知（含「重新尝试」按钮） */
function pushLlmRetryNoticeBlock(taskId, content, retryAction, retryTargetLabel) {
  pushAndSaveProblemDetailChat({
    type: 'llmRetryNoticeBlock',
    taskId: taskId || '',
    content: String(content || '大模型调用失败，请稍后重试。'),
    retryAction: String(retryAction || 'continue-current-task'),
    retryTargetLabel: String(retryTargetLabel || ''),
    timestamp: getTimeStr(),
  });
  try {
    recordFlowExceptionTyped('llm', String(content || '大模型调用失败'));
  } catch (_) {}
}

/** 根据重试动作恢复剩余流程 */
async function retryLlmFlowByAction(retryAction, taskId) {
  const action = String(retryAction || '').trim();
  const createdAt = __appState.currentProblemDetailItem?.createdAt || '';
  // 历史 retryAction：task11-step / task11-auto / task11-audit（核心业务对象推演已下线，不再恢复执行）
  // 兜底：按当前首个未完成任务继续
  const item = resolveProblemItemForTaskNotification() || __appState.currentProblemDetailItem;
  const first = item ? getFirstUncompletedTask(item) : null;
  const targetTaskId = (taskId && String(taskId).trim()) || first?.id || '';
  if (action === 'task8-it-design-auto-seq' && typeof window.runItDesignSupplementAutoSequential === 'function') {
    await window.runItDesignSupplementAutoSequential(__appState.currentProblemDetailItem);
    return;
  }
  if (targetTaskId === 'task9') {
    requestAnimationFrame(() => {
      if (typeof focusWorkspaceOnCurrentTask === 'function') focusWorkspaceOnCurrentTask('task9');
    });
    return;
  }
  if (targetTaskId === 'task6' && typeof runPainPointAnnotationForNextStep === 'function') {
    await runPainPointAnnotationForNextStep(__appState.currentProblemDetailItem);
    return;
  }
  throw new Error('未找到可重试的任务流程');
}

/** 刷新恢复：若存在未成功重试的 LLM 失败通知，则补发「继续调用」确认块。 */
function ensureLlmResumeIntentIfNeeded() {
  if (!isProblemDetailNavigationReload()) return false;
  if (!Array.isArray(__appState.problemDetailChatMessages) || __appState.problemDetailChatMessages.length === 0) return false;
  const hasPendingIntent = __appState.problemDetailChatMessages.some((m) => m?.type === 'llmResumeIntentBlock' && !m.confirmed);
  if (hasPendingIntent) return true;
  const retryIdx = __appState.problemDetailChatMessages.findLastIndex((m) => m?.type === 'llmRetryNoticeBlock' && !m.retrySucceeded);
  if (retryIdx < 0) return false;
  const retryMsg = __appState.problemDetailChatMessages[retryIdx] || {};
  const labelRaw = String(retryMsg.retryTargetLabel || '').trim();
  const taskName =
    (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === String(retryMsg.taskId || '').trim())?.name) ||
    String(retryMsg.taskId || '').trim();
  const label = labelRaw || taskName || '当前任务';
  pushAndSaveProblemDetailChat({
    type: 'llmResumeIntentBlock',
    taskId: String(retryMsg.taskId || ''),
    retryAction: String(retryMsg.retryAction || 'continue-current-task'),
    sourceRetryIndex: retryIdx,
    retryTargetLabel: label,
    content: `我将继续进行【${label}】的大模型调用`,
    confirmed: false,
    timestamp: getTimeStr(),
  });
  return true;
}

/**
 * 判断某任务是否处于“已提示请修改，等待用户输入修改意见”状态（刷新后可从聊天历史恢复）。
 * 规则：存在该任务的修改引导系统消息，且其后尚未出现用户反馈或修改链路节点。
 */
function hasPendingTaskModificationPrompt(taskId, taskName) {
  if (!taskId || !Array.isArray(__appState.problemDetailChatMessages) || __appState.problemDetailChatMessages.length === 0) return false;
  const expectedPrompt = buildTaskModificationRequestMessage(taskName);
  let promptIdx = -1;
  for (let i = __appState.problemDetailChatMessages.length - 1; i >= 0; i--) {
    const m = __appState.problemDetailChatMessages[i];
    if (m?.role === 'system' && String(m.content || '').trim() === expectedPrompt) {
      promptIdx = i;
      break;
    }
  }
  if (promptIdx < 0) return false;
  for (let i = promptIdx + 1; i < __appState.problemDetailChatMessages.length; i++) {
    const m = __appState.problemDetailChatMessages[i];
    if (!m) continue;
    if (m.role === 'user') return false;
    if (m.type === 'modificationIntentConfirmBlock' && String(m.taskId || '') === String(taskId)) return false;
    if (m.type === 'modificationPromptRevisionLlmQueryBlock' && String(m.taskId || '') === String(taskId)) return false;
  }
  return true;
}

/**
 * 刷新恢复补偿（task4/task6）：
 * - 若当前处于 task6 且在“等待用户提交修改意见”状态：补发 task6 修改引导消息；
 * - 若当前处于 task4 且已有价值流结果（含工作区可绘制数据）但任务未完成：补发「是否视为完成」确认块；
 * - 若当前处于 task4 且尚无价值流：补发 task4 任务启动通知。
 * @returns {boolean} 是否已处理专属通知
 */
function ensureTask4RefreshNotificationIfNeeded() {
  const mergedItem = resolveProblemItemForTaskNotification() || __appState.currentProblemDetailItem;
  if (!mergedItem) return false;
  const wsTid = typeof getWorkspaceViewingTaskId === 'function' ? getWorkspaceViewingTaskId() : null;
  const next = getFirstUncompletedTask(mergedItem);
  if (!next?.id) return false;
  if (next.id === 'task6') {
    if (wsTid !== 'task6') return false;
    const task6Name = (
      FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === 'task6')?.name
    ) || '痛点标注';
    const waitingByMemoryTask6 = !!(
      problemDetailWaitingForFeedback &&
      String(problemDetailWaitingForFeedback.taskId || '') === 'task6' &&
      String(problemDetailWaitingForFeedback.type || '') === 'modification'
    );
    const waitingByChatTask6 = hasPendingTaskModificationPrompt('task6', task6Name);
    if (waitingByMemoryTask6 || waitingByChatTask6) {
      if (!waitingByChatTask6) {
        pushAndSaveProblemDetailChat({
          role: 'system',
          content: buildTaskModificationRequestMessage(task6Name),
          timestamp: getTimeStr(),
        });
      }
      return true;
    }
    return false;
  }
  if (next.id !== 'task4') return false;
  if (wsTid !== 'task4') return false;
  const taskName = (
    FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === 'task4')?.name
  ) || '绘制价值流';
  const waitingByMemory = !!(
    problemDetailWaitingForFeedback &&
    String(problemDetailWaitingForFeedback.taskId || '') === 'task4' &&
    String(problemDetailWaitingForFeedback.type || '') === 'modification'
  );
  const waitingByChat = hasPendingTaskModificationPrompt('task4', taskName);
  if (waitingByMemory || waitingByChat) {
    if (!waitingByChat) {
      pushAndSaveProblemDetailChat({
        role: 'system',
        content: buildTaskModificationRequestMessage(taskName),
        timestamp: getTimeStr(),
      });
    }
    return true;
  }

  const hasValueStream = !!(mergedItem.valueStream && !mergedItem.valueStream.raw);
  if (hasValueStream) {
    const msgs = __appState.problemDetailChatMessages || [];
    const usedDrawSessions = msgs.some((m) => m?.type === 'valueStreamDrawSessionsBlock');
    const hasMirrorOnly =
      msgs.some((m) => m?.type === 'valueStreamCard' && m.valueStreamPhase === 'mirror') &&
      !task4ValueStreamIsFinalForCompletion(msgs);
    if (hasMirrorOnly && !usedDrawSessions) {
      const hasHardeningIntro = msgs.some((m) => m?.type === 'valueStreamPhaseIntroBlock' && m.phase === 'hardening');
      if (!hasHardeningIntro) {
        pushAndSaveProblemDetailChat({
          type: 'valueStreamPhaseIntroBlock',
          taskId: 'task4',
          phase: 'hardening',
          content: '我将继续采用架构加固 (The Hardening Stage)策略补充价值流',
          timestamp: getTimeStr(),
          confirmed: false,
        });
        const c = el.problemDetailChatMessages;
        if (c) {
          c.innerHTML = '';
          renderProblemDetailChatFromStorage(c, __appState.problemDetailChatMessages);
          c.scrollTop = c.scrollHeight;
        }
      }
      return true;
    }
    if (!task4ValueStreamIsFinalForCompletion(msgs)) {
      return true;
    }
    const hasTask4PendingCompletionConfirm = msgs.some(
      (m) =>
        m?.type === 'taskCompletionConfirmBlock' &&
        m.taskId === 'task4' &&
        !m.confirmed &&
        !m.userChoseModify,
    );
    if (!hasTask4PendingCompletionConfirm) {
      showTaskCompletionConfirm('task4', taskName);
    }
    return true;
  }

  showTaskStartNotificationIfNeeded('task4', true, TASK_START_NOTIFY_NAVIGATE_PENDING);
  return true;
}

/** 是否为浏览器刷新进入（用于 task10 等「仅刷新时重新下发提示块」） */
function isProblemDetailNavigationReload() {
  try {
    const entries = typeof performance !== 'undefined' && performance.getEntriesByType ? performance.getEntriesByType('navigation') : [];
    const nav = entries[0];
    if (nav && nav.type === 'reload') return true;
  } catch (_) {}
  return false;
}

function needsRolePermissionComplianceAuditInChat() {
  return false;
}
function hasPendingRolePermissionAuditIntentInChat() {
  return false;
}
function hasRolePermissionAuditIntentBlockInChat() {
  return false;
}
function pushRolePermissionAuditIntentBlockIfNeeded() {
  return false;
}
function needsCoreBusinessObjectGlobalAuditInChat() {
  return false;
}
function hasPendingCoreBusinessObjectGlobalAuditIntentInChat() {
  return false;
}
function hasCoreBusinessObjectGlobalAuditIntentBlockInChat() {
  return false;
}
function pushCoreBusinessObjectGlobalAuditIntentBlockIfNeeded() {
  return false;
}
async function runCoreBusinessObjectGlobalAuditIfNotYetInChat() {
  return 'aborted';
}
async function runRolePermissionComplianceAuditIfNotYetInChat() {
  return 'aborted';
}

/**
 * 管线「当前任务」（canonical）变化时，将工作区滚动到对应任务卡片并展开；与顶栏阶段徽章、步骤条 `--current` 同源。
 * `openingProblemDetailInProgress` 为真时跳过（与 openProblemDetail 的 sessionStorage 恢复滚动互斥）。
 */
function maybeFocusWorkspaceAfterCanonicalTaskChange() {
  if (openingProblemDetailInProgress) return;
  const item = __appState.currentProblemDetailItem;
  if (!item) return;
  const merged =
    typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() || item : item;
  const msgs =
    typeof getProblemDetailChatMessagesForCanonical === 'function' ? getProblemDetailChatMessagesForCanonical(merged) : [];
  const canon = getCanonicalCurrentProblemFollowTaskState(merged, msgs);
  if (canon.allComplete) {
    lastCanonTaskIdForWorkspaceScroll = null;
    return;
  }
  const tid = canon.taskId;
  if (!tid) return;
  if (tid === lastCanonTaskIdForWorkspaceScroll) return;
  lastCanonTaskIdForWorkspaceScroll = tid;
  focusWorkspaceOnCurrentTask(tid);
}

/** 根据 taskId 将工作区切换到对应大阶段并定位到对应内容卡片（步骤条点击等）。大阶段上限取 max(持久化 currentMajorStage, canonical.majorStage)，避免滞后时误将 task7 判回初步需求（FE-20260328-30）。 */
function focusWorkspaceOnCurrentTask(taskId) {
  const container = el.problemDetailContent;
  if (!container) return;
  const item = __appState.currentProblemDetailItem;
  if (!item) return;
  if (!taskId) return;
  const prevItGapViewingSubstep = itGapViewingSubstep;
  let cardTaskId = taskId;
  if (['task5', 'task6'].includes(taskId)) cardTaskId = 'task4';
  else if (taskId === 'task7') cardTaskId = 'e2e-flow';
  else if (taskId === 'task8') cardTaskId = 'global-itgap';
  else if (taskId === 'task9') cardTaskId = 'local-itgap';
  else if (['task12', 'task13', 'task14', 'task15'].includes(taskId)) cardTaskId = taskId;
  const currentMajorStage = item.currentMajorStage ?? 0;
  const mergedForFocus =
    typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() || item : item;
  const msgsForFocus =
    typeof getProblemDetailChatMessagesForCanonical === 'function' ? getProblemDetailChatMessagesForCanonical(mergedForFocus) : [];
  const canonFocus =
    typeof getCanonicalCurrentProblemFollowTaskState === 'function'
      ? getCanonicalCurrentProblemFollowTaskState(mergedForFocus, msgsForFocus)
      : null;
  const canonMajorStage =
    canonFocus && !canonFocus.allComplete && canonFocus.majorStage != null
      ? Math.max(0, Math.min(3, Number(canonFocus.majorStage) || 0))
      : currentMajorStage;
  // 允许 viewing 跟到「管线已推进到」的大阶段，避免持久化 currentMajorStage 滞后时 Math.min(target, itemMajor) 把 task7 误压回 0（初步需求）或 1（工作流对齐）（FE-20260328-30）
  const allowedMajorStage = Math.max(currentMajorStage, canonMajorStage);
  let targetMajorStage = 0;
  if (['task1', 'task2', 'task3'].includes(taskId)) targetMajorStage = 0;
  else if (['task4', 'task5', 'task6'].includes(taskId)) targetMajorStage = 1;
  else if (['task7', 'task8', 'task9'].includes(taskId)) targetMajorStage = 2;
  else if (['task12', 'task13', 'task14', 'task15'].includes(taskId)) targetMajorStage = 3;
  else targetMajorStage = 0;
  if (['task12', 'task13', 'task14', 'task15'].includes(taskId)) {
    const substepMap = { task12: 0, task13: 1, task14: 2, task15: 3 };
    itStrategyPlanViewingSubstep = substepMap[taskId];
    const caseKey = getProblemFollowCaseKey(item);
    if (caseKey) persistItStrategyPlanSubstepForCaseKey(caseKey, itStrategyPlanViewingSubstep);
  }
  if (['task7', 'task8', 'task9'].includes(taskId)) {
    const igMap = { task7: 0, task8: 1, task9: 2 };
    itGapViewingSubstep = igMap[taskId];
  }
  const stageChanged = problemDetailViewingMajorStage !== targetMajorStage;
  if (stageChanged) {
    problemDetailViewingMajorStage = Math.min(targetMajorStage, allowedMajorStage);
    updateProblemDetailProgressStages(currentMajorStage, problemDetailViewingMajorStage);
  }
  const itGapBadgeTargets = ['task7', 'task8', 'task9'];
  const needRender =
    stageChanged ||
    (targetMajorStage === 3 && ['task12', 'task13', 'task14', 'task15'].includes(taskId)) ||
    (targetMajorStage === 2 && itGapBadgeTargets.includes(taskId) && itGapViewingSubstep !== prevItGapViewingSubstep);
  if (needRender) renderProblemDetailContent();
  else updateProblemDetailTaskStepBar();
  if (itGapBadgeTargets.includes(taskId)) updateProblemDetailChatHeaderLabel();
  requestAnimationFrame(() => {
    let card = container.querySelector(`.problem-detail-card[data-task-id="${cardTaskId}"]`);
    if (!card) card = container.querySelector(`.problem-detail-value-stream-card[data-task-id="${cardTaskId}"]`);
    if (!card && cardTaskId === 'local-itgap') {
      card = container.querySelector('.problem-detail-card[data-task-id="role-task-center-portal"]');
    }
    if (!card && cardTaskId === 'local-itgap') {
      card = container.querySelector('.problem-detail-card[data-task-id="local-itgap-trigger"]');
    }
    if (!card && ['task12', 'task13', 'task14', 'task15'].includes(cardTaskId)) {
      const btn = container.querySelector(`button[data-task-id="${cardTaskId}"]`);
      if (btn) card = container.querySelector('.problem-detail-workspace-scroll');
    }
    if (!card) return;
    const header = card.querySelector('.problem-detail-card-header');
    const body = card.querySelector('.problem-detail-card-body');
    if (header && body && body.hidden) {
      body.hidden = false;
      header.classList.remove('problem-detail-card-header-collapsed');
      header.setAttribute('aria-expanded', 'true');
    }
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth', inline: 'nearest' });
  });
}

/** 根据当前浏览大阶段与子步骤索引推导工作区正在展示的主线 taskId（用于工具栏下 task1–task15 步骤条 viewing 高亮） */
function getWorkspaceViewingTaskId() {
  const item =
    typeof resolveProblemItemForTaskNotification === 'function'
      ? resolveProblemItemForTaskNotification() || __appState.currentProblemDetailItem
      : __appState.currentProblemDetailItem;
  const v = problemDetailViewingMajorStage;
  if (v === 0) {
    const ids = ['task1', 'task2', 'task3'];
    if (!item) return 'task1';
    for (const id of ids) {
      if (!isTaskCompleted(item, id)) return id;
    }
    return 'task3';
  }
  if (v === 1) {
    if (!item) return 'task4';
    const ids = ['task4', 'task5', 'task6'];
    for (const id of ids) {
      if (!isTaskCompleted(item, id)) return id;
    }
    return 'task6';
  }
  if (v === 2) {
    const map = ['task7', 'task8', 'task9'];
    const i = Math.max(0, Math.min(2, Number(itGapViewingSubstep) || 0));
    return map[i] || 'task7';
  }
  if (v === 3) {
    const map = ['task12', 'task13', 'task14', 'task15'];
    const i = Math.max(0, Math.min(3, Number(itStrategyPlanViewingSubstep) || 0));
    return map[i] || 'task12';
  }
  return null;
}

/** 沟通历史页面更新：委托 js/communication-history.js 渲染，main 仅传入容器与依赖 */
function renderProblemDetailHistory() {
  const container = el.problemDetailHistoryContent;
  if (!container) return;
  const render = typeof window.renderCommunicationHistoryPanel === 'function' ? window.renderCommunicationHistoryPanel : null;
  if (render) {
    render(container, {
      item: __appState.currentProblemDetailItem,
      getChatsForProblem,
      getTaskStatusText,
    });
  }
}
if (typeof window !== 'undefined') window.renderProblemDetailHistory = renderProblemDetailHistory;

/** 任务完成确认时推进状态机：将当前任务标记为已完成，当前问题状态改为下一状态 */
function advanceProblemStateOnTaskComplete(createdAt, taskId) {
  if (!createdAt || !taskId) return;
  const list = getDigitalProblems();
  const item = list.find((it) => it.createdAt === createdAt);
  if (!item) return;
  switch (taskId) {
    case 'task1':
      if (hasTask1BasicInfoFields(item.basicInfo)) updateDigitalProblemBasicInfo(createdAt, item.basicInfo);
      break;
    case 'task2':
      if (item.bmc) updateDigitalProblemBmc(createdAt, item.bmc);
      break;
    case 'task3':
      if (item.requirementLogic) {
        updateDigitalProblemRequirementLogic(createdAt, item.requirementLogic);
        updateDigitalProblemMajorStage(createdAt, 1);
      }
      break;
    case 'task4':
      if (item.valueStream && !item.valueStream.raw) {
        if (typeof updateDigitalProblemValueStreamDataOnly === 'function') {
          updateDigitalProblemValueStreamDataOnly(createdAt, item.valueStream);
        } else {
          updateDigitalProblemValueStream(createdAt, item.valueStream);
        }
        const wf = [...new Set([...(item.workflowAlignCompletedStages || []), 0])].sort((a, b) => a - b);
        if (typeof updateDigitalProblemWorkflowAlignCompletedStages === 'function') {
          updateDigitalProblemWorkflowAlignCompletedStages(createdAt, wf);
        }
      }
      break;
    case 'task5':
      if (item.valueStream) {
        if (typeof updateDigitalProblemValueStreamDataOnly === 'function') {
          updateDigitalProblemValueStreamDataOnly(createdAt, item.valueStream);
        } else {
          updateDigitalProblemValueStreamItStatus(createdAt, item.valueStream);
        }
        const wf = [...new Set([...(item.workflowAlignCompletedStages || []), 0, 1])].sort((a, b) => a - b);
        if (typeof updateDigitalProblemWorkflowAlignCompletedStages === 'function') {
          updateDigitalProblemWorkflowAlignCompletedStages(createdAt, wf);
        }
      }
      break;
    case 'task6':
      if (item.valueStream) {
        if (typeof updateDigitalProblemValueStreamDataOnly === 'function') {
          updateDigitalProblemValueStreamDataOnly(createdAt, item.valueStream);
        } else {
          updateDigitalProblemValueStreamPainPoint(createdAt, item.valueStream);
        }
        const wf = [...new Set([...(item.workflowAlignCompletedStages || []), 0, 1, 2])].sort((a, b) => a - b);
        if (typeof updateDigitalProblemWorkflowAlignCompletedStages === 'function') {
          updateDigitalProblemWorkflowAlignCompletedStages(createdAt, wf);
        }
        // 痛点标注完成后进入 ITGap 大阶段，当前任务为 task7 待执行（与后端 resolveMajorStage 一致）
        updateDigitalProblemMajorStage(createdAt, 2);
      }
      break;
    case 'task7': {
      const stages7 = [...(item.itGapCompletedStages || []), 0].sort((a, b) => a - b);
      updateDigitalProblemItGapCompletedStages(createdAt, stages7);
      updateDigitalProblemMajorStage(createdAt, 2);
      break;
    }
    case 'task8': {
      if (item.globalItGapAnalysisJson) updateDigitalProblemGlobalItGapAnalysis(createdAt, item.globalItGapAnalysisJson);
      const stages8 = [...(item.itGapCompletedStages || []), 1].sort((a, b) => a - b);
      if (typeof updateDigitalProblemItGapCompletedStages === 'function') {
        updateDigitalProblemItGapCompletedStages(createdAt, stages8);
      }
      break;
    }
    case 'task9': {
      const stages9 = [...(item.itGapCompletedStages || []), 2].sort((a, b) => a - b);
      updateDigitalProblemItGapCompletedStages(createdAt, stages9);
      updateDigitalProblemMajorStage(createdAt, 3);
      break;
    }
    case 'task12':
    case 'task13':
    case 'task14':
    case 'task15':
      if (typeof updateDigitalProblemCompletedTaskId === 'function') {
        updateDigitalProblemCompletedTaskId(createdAt, taskId);
      }
      break;
    default:
      break;
  }
  const updated = getDigitalProblems().find((it) => it.createdAt === createdAt);
  if (updated && __appState.currentProblemDetailItem?.createdAt === createdAt) {
    __appState.currentProblemDetailItem = updated;
    const majorStage = updated.currentMajorStage ?? __appState.currentProblemDetailItem.currentMajorStage ?? 0;
    problemDetailViewingMajorStage = majorStage;
    if (taskId === 'task6' || taskId === 'task7') {
      itGapViewingSubstep = getItGapDefaultViewingSubstep(updated);
    }
    if (taskId === 'task9') {
      itStrategyPlanViewingSubstep = 0;
      const caseKey9 = typeof getProblemFollowCaseKey === 'function' ? getProblemFollowCaseKey(updated) : '';
      if (caseKey9) persistItStrategyPlanSubstepForCaseKey(caseKey9, 0);
    }
    updateProblemDetailProgressStages(majorStage, problemDetailViewingMajorStage);
    renderProblemDetailContent();
  }
}

/**
 * 任务完工确认中用户点击「请修改」后，系统下发的引导文案（要求回复含明确修改动因与修改意见）。
 * 对齐产品：docs/agents/business-product-agent.md（修改意图提炼前置引导）。
 */
function buildTaskModificationRequestMessage(taskName) {
  const name = String(taskName == null ? '' : taskName).trim() || '当前任务';
  return `您要对【${name}】的成果做什么修改？请回复修改意见要有明确的修改动因及修改意见。`;
}

/** 用户点击「确认」认可大模型输出后，发送任务完工确认块：是否确认 XXX 任务已经完成？带「已完成」「请修改」按钮 */
function showTaskCompletionConfirm(taskId, taskName) {
  if (!taskId || !taskName) return;
  const content =
    taskId === 'task5'
      ? '是否确认 IT 现状标注任务已经完成？'
      : taskId === 'task7'
        ? '是否确认端到端事务流构建任务已经完成？'
        : taskId === 'task4'
          ? '价值流绘制任务（忠实还原、架构加固与合成终稿三子环节）是否视为已完成？'
          : `【${taskName}】是否视为完成？`;
  if (taskId === 'task4') {
    const msgs = __appState.problemDetailChatMessages || [];
    // 与「请修改」配合：userChoseModify 后允许再次下发（修改链重绘价值流后需新的完工确认）
    if (
      msgs.some(
        (m) =>
          m?.type === 'taskCompletionConfirmBlock' &&
          m.taskId === 'task4' &&
          !m.confirmed &&
          !m.userChoseModify,
      )
    ) {
      return;
    }
  }
  if (taskId === 'task7') {
    const msgs7 = __appState.problemDetailChatMessages || [];
    // 分阶段 Session 路径：必须先推送「所有价值流阶段的事务流已生成完毕…」系统说明，再允许完工确认，避免 JSON 卡「确认」或竞态早于收尾文案（FE-20260408）
    const TASK7_ALL_STAGES_DONE_SNIPPET = '所有价值流阶段的事务流已生成完毕';
    const TASK7_PRELIM_FVS_COMPLETENESS_DONE_SNIPPET = '所有端到端事务流补齐已完成';
    const hasE2eSessionPlan = msgs7.some((m) => m?.type === 'e2eTransactionFlowSessionsBlock');
    const hasAllStagesDoneNotice = msgs7.some(
      (m) =>
        m &&
        m.role === 'system' &&
        typeof m.content === 'string' &&
        m.content.includes(TASK7_ALL_STAGES_DONE_SNIPPET),
    );
    if (hasE2eSessionPlan && !hasAllStagesDoneNotice) {
      return;
    }
    const hasCompletenessPlan = msgs7.some((m) => m?.type === 'e2ePrelimFvsCompletenessSessionsBlock');
    const completenessAllDoneBlock = [...msgs7].reverse().find((m) => m?.type === 'e2ePrelimFvsCompletenessAllDoneConfirmBlock');
    const hasCompletenessDoneNotice = msgs7.some(
      (m) =>
        m &&
        m.role === 'system' &&
        typeof m.content === 'string' &&
        m.content.includes(TASK7_PRELIM_FVS_COMPLETENESS_DONE_SNIPPET),
    );
    if (hasCompletenessPlan) {
      if (completenessAllDoneBlock) {
        if (!completenessAllDoneBlock.confirmed) return;
      } else if (!hasCompletenessDoneNotice) {
        return;
      }
    }
    // 与「请修改」配合：userChoseModify 后允许再次下发（用户重跑分阶段生成后需新的完工确认）
    if (
      msgs7.some(
        (m) =>
          m?.type === 'taskCompletionConfirmBlock' &&
          m.taskId === 'task7' &&
          !m.confirmed &&
          !m.userChoseModify,
      )
    ) {
      return;
    }
  }
  if (taskId === 'task9') {
    const msgs9 = __appState.problemDetailChatMessages || [];
    if (
      msgs9.some(
        (m) =>
          m?.type === 'taskCompletionConfirmBlock' &&
          m.taskId === 'task9' &&
          !m.confirmed &&
          !m.userChoseModify,
      )
    ) {
      return;
    }
  }
  pushAndSaveProblemDetailChat({ type: 'taskCompletionConfirmBlock', taskId, taskName, content, timestamp: getTimeStr() });
  const container = el.problemDetailChatMessages;
  if (container) {
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
  }
}
if (typeof window !== 'undefined') {
  window.showTaskCompletionConfirm = showTaskCompletionConfirm;
}

/** 聊天区「初步需求已提炼」跟进块是否为当前最后一条（仅最后一条可操作按钮） */
function isLatestPreliminaryRequirementFollowupBlock(messages, idx) {
  if (!Array.isArray(messages) || idx < 0) return false;
  let last = -1;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]?.type === 'preliminaryRequirementFollowupBlock') last = i;
  }
  return last === idx;
}

/** 初步需求「按意见修订」摘要卡：仅最后一条待确认的（含 mergedPreliminaryReq 且未 confirmed）可点「确认更新工作区」 */
function isLatestPendingPreliminaryRequirementModSummaryBlock(messages, idx) {
  if (!Array.isArray(messages) || idx < 0) return false;
  let last = -1;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (
      m?.type === 'preliminaryRequirementModificationSummaryBlock' &&
      m.mergedPreliminaryReq &&
      typeof m.mergedPreliminaryReq === 'object' &&
      !m.confirmed
    ) {
      last = i;
    }
  }
  return last === idx;
}

/** 「+需求」聊天确认块：仅最后一条未 resolution 的可操作（与 preliminary 跟进块一致） */
function isLatestPendingPlusRequirementResetConfirmBlock(messages, idx) {
  if (!Array.isArray(messages) || idx < 0) return false;
  let lastPending = -1;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m?.type === 'plusRequirementResetConfirmBlock' && !m.resolution) lastPending = i;
  }
  return lastPending === idx;
}

function pushPreliminaryRequirementFollowupChatBlock() {
  pushAndSaveProblemDetailChat({
    type: 'preliminaryRequirementFollowupBlock',
    taskId: 'task1',
    content: '客户初步需求已经更新到工作区',
    timestamp: getTimeStr(),
  });
}

/** task1 补充合并 session：按「商业背景→核心对象→状态逻辑→…→分析备注」多字段分段执行 */
const TASK1_PRELIMINARY_MERGE_SESSION_SECTIONS = [
  { key: 'businessContext', label: '商业背景', path: 'businessContext' },
  { key: 'coreBusinessEntities', label: '核心对象', path: 'coreBusinessEntities' },
  { key: 'stateTransitionMatrix', label: '状态逻辑', path: 'stateTransitionMatrix' },
  { key: 'painPointRadar', label: '需求痛点', path: 'painPointRadar' },
  { key: 'itLandscape', label: 'IT 现状需求', path: 'itLandscape' },
  { key: 'operationModel.orgAndRoles', label: '人员组织', path: 'operationModel.orgAndRoles' },
  { key: 'operationModel.fullValueStreams', label: '业务流程', path: 'operationModel.fullValueStreams' },
  { key: 'roadmap.phase1_Critical', label: '优先上线', path: 'roadmap.phase1_Critical' },
  { key: 'roadmap.phase2_Strategic', label: '后续上线', path: 'roadmap.phase2_Strategic' },
  { key: 'roadmap.overallUrgency', label: '项目紧急度', path: 'roadmap.overallUrgency' },
];

/**
 * 从补充提炼结果中取出「当前工作区尚不存在该 entity 分组」的状态转移行，供直写并入。
 * @param {Object | null | undefined} mergedCurrentPrelim
 * @param {Object | null | undefined} extractedPrelim
 */
function task1ExtractStmNewEntityRowsForAppend(mergedCurrentPrelim, extractedPrelim) {
  const groupFn =
    typeof window.groupPreliminaryStmMatrixRowsByEntityLabel === 'function'
      ? window.groupPreliminaryStmMatrixRowsByEntityLabel
      : null;
  if (!groupFn) return [];
  const ext = extractedPrelim && typeof extractedPrelim === 'object' ? extractedPrelim : {};
  const extArr = Array.isArray(ext.stateTransitionMatrix) ? ext.stateTransitionMatrix : [];
  if (extArr.length === 0) return [];
  const extBy = groupFn(extArr, ext);
  const cur = mergedCurrentPrelim && typeof mergedCurrentPrelim === 'object' ? mergedCurrentPrelim : {};
  const curMx = Array.isArray(cur.stateTransitionMatrix) ? cur.stateTransitionMatrix : [];
  const curBy = groupFn(curMx, cur);
  const curKeys = new Set(curBy.keys());
  const out = [];
  for (const [label, list] of extBy) {
    if (!Array.isArray(list) || list.length === 0) continue;
    if (!curKeys.has(label)) out.push(...list);
  }
  return out;
}

/**
 * 从补充提炼结果中取出某 entity 展示键下的全部新提炼转移行。
 * @param {Object | null | undefined} extractedPrelim
 * @param {string} entityLabel
 */
function task1ExtractStmRowsForEntityInExtracted(extractedPrelim, entityLabel) {
  const groupFn =
    typeof window.groupPreliminaryStmMatrixRowsByEntityLabel === 'function'
      ? window.groupPreliminaryStmMatrixRowsByEntityLabel
      : null;
  if (!groupFn) return [];
  const key = String(entityLabel || '').trim();
  if (!key) return [];
  const ext = extractedPrelim && typeof extractedPrelim === 'object' ? extractedPrelim : {};
  const extArr = Array.isArray(ext.stateTransitionMatrix) ? ext.stateTransitionMatrix : [];
  const extBy = groupFn(extArr, ext);
  const list = extBy.get(key);
  return Array.isArray(list) ? list.slice() : [];
}

/**
 * 根据补充提炼结果与**当前**初步需求生成 Session 计划行：
 * 状态逻辑：先「新 entity 直写」一步（若有），再按新提炼中出现的**已有 entity**各一行 LLM 子任务（`stmEntityLabel`）；无分组能力时回退为单行整段合并。
 * 旧聊天仍可能带 `stmRowIndex` 逐行子任务，执行层兼容。
 * @param {Object | null | undefined} extracted
 * @param {Object | null | undefined} [currentPreliminaryReq]
 */
function buildTask1PrelimMergeSessionPlanSessions(extracted, currentPreliminaryReq) {
  const rows = [];
  const groupFn =
    typeof window.groupPreliminaryStmMatrixRowsByEntityLabel === 'function'
      ? window.groupPreliminaryStmMatrixRowsByEntityLabel
      : null;
  const cur =
    currentPreliminaryReq && typeof currentPreliminaryReq === 'object' ? currentPreliminaryReq : {};
  const ext = extracted && typeof extracted === 'object' ? extracted : {};
  for (const s of TASK1_PRELIMINARY_MERGE_SESSION_SECTIONS) {
    if (s.key !== 'stateTransitionMatrix') {
      rows.push({ ...s, status: 'pending' });
      continue;
    }
    const extArr = Array.isArray(ext.stateTransitionMatrix) ? ext.stateTransitionMatrix : [];
    if (extArr.length === 0) {
      rows.push({ ...s, status: 'pending' });
      continue;
    }
    if (!groupFn) {
      rows.push({ ...s, status: 'pending' });
      continue;
    }
    const extBy = groupFn(extArr, ext);
    const curMx = Array.isArray(cur.stateTransitionMatrix) ? cur.stateTransitionMatrix : [];
    const curBy = groupFn(curMx, cur);
    const curKeys = new Set(curBy.keys());
    const mergeEntities = [];
    let newEntRowCount = 0;
    for (const [label, list] of extBy) {
      if (!Array.isArray(list) || list.length === 0) continue;
      if (!curKeys.has(label)) {
        newEntRowCount += list.length;
      } else {
        mergeEntities.push({ label, count: list.length });
      }
    }
    mergeEntities.sort((a, b) =>
      String(a.label).localeCompare(String(b.label), 'zh-Hans-CN', { sensitivity: 'accent' }),
    );
    if (newEntRowCount > 0) {
      rows.push({
        ...s,
        label: `状态逻辑 · 新实体（${newEntRowCount}）`,
        stmMergePhase: 'appendNewEntities',
        status: 'pending',
      });
    }
    for (const me of mergeEntities) {
      rows.push({
        ...s,
        label: `状态逻辑 · ${me.label}（${me.count}）`,
        stmMergePhase: 'mergeEntity',
        stmEntityLabel: me.label,
        status: 'pending',
      });
    }
    if (newEntRowCount === 0 && mergeEntities.length === 0) {
      rows.push({ ...s, status: 'pending' });
    }
  }
  return rows;
}

function getTask1PreliminarySessionPathValue(obj, path) {
  if (!obj || typeof obj !== 'object' || !path) return undefined;
  if (typeof getByPath === 'function') return getByPath(obj, path);
  const parts = String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    cur = cur != null && typeof cur === 'object' ? cur[p] : undefined;
  }
  return cur;
}

function buildTask1PreliminaryPartialByPath(path, value) {
  const out = {};
  const parts = String(path).split('.');
  let cur = out;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i === parts.length - 1) cur[p] = value;
    else {
      cur[p] = {};
      cur = cur[p];
    }
  }
  return out;
}

/** 旧版 session 第二项为 objectState（单步含两键）；新版拆为核心对象 + 状态逻辑两步，长度差 1 */
function migrateLegacyTask1PrelimMergeSessions(raw, sections) {
  if (!Array.isArray(raw) || raw.length === 0) return raw;
  const second = raw[1];
  if (second && second.key === 'objectState' && raw.length === sections.length - 1) {
    const st = second.status || 'pending';
    return [raw[0], { ...sections[1], status: st }, { ...sections[2], status: st }, ...raw.slice(2)];
  }
  return raw;
}

/** 从补充提炼结果中取本步待合并切片：`path` 单字段，或 `paths` 多顶层键（仅含在 extracted 中有值的键）；顶层数组为空视为本步无增量、跳过 */
function getTask1PreliminaryMergeExtractedSlice(extracted, sec) {
  if (!extracted || typeof extracted !== 'object') return undefined;
  if (sec.key === 'stateTransitionMatrix' && Number.isInteger(sec.stmRowIndex)) {
    const arr = extracted.stateTransitionMatrix;
    if (!Array.isArray(arr) || arr[sec.stmRowIndex] == null) return undefined;
    return [arr[sec.stmRowIndex]];
  }
  if (Array.isArray(sec.paths) && sec.paths.length) {
    const slice = {};
    for (const p of sec.paths) {
      const v = getTask1PreliminarySessionPathValue(extracted, p);
      if (v !== undefined && !(Array.isArray(v) && v.length === 0)) slice[p] = v;
    }
    return Object.keys(slice).length ? slice : undefined;
  }
  if (sec.path) {
    const v = getTask1PreliminarySessionPathValue(extracted, sec.path);
    if (v === undefined) return undefined;
    if (Array.isArray(v) && v.length === 0) return undefined;
    return v;
  }
  return undefined;
}

/** 将本步切片打成 `mergePreliminaryRequirementV2ByLlm` 所需的 preliminaryReq 子集 */
function buildTask1PreliminaryPartialForMerge(sec, slice) {
  if (Array.isArray(sec.paths) && sec.paths.length && slice && typeof slice === 'object' && !Array.isArray(slice)) {
    let out = {};
    for (const p of sec.paths) {
      if (slice[p] !== undefined) {
        const sub = buildTask1PreliminaryPartialByPath(p, slice[p]);
        out = { ...out, ...sub };
      }
    }
    return out;
  }
  return buildTask1PreliminaryPartialByPath(sec.path, slice);
}

/** 从当前合并结果中取本步字段，供修改动作对比（多键时为对象） */
function getTask1PreliminaryMergeCurrentSlice(current, sec) {
  if (
    sec.key === 'stateTransitionMatrix' &&
    (Number.isInteger(sec.stmRowIndex) ||
      sec.stmMergePhase === 'appendNewEntities' ||
      sec.stmMergePhase === 'mergeEntity')
  ) {
    return getTask1PreliminarySessionPathValue(current, 'stateTransitionMatrix');
  }
  if (Array.isArray(sec.paths) && sec.paths.length) {
    const slice = {};
    for (const p of sec.paths) {
      slice[p] = getTask1PreliminarySessionPathValue(current, p);
    }
    return slice;
  }
  return getTask1PreliminarySessionPathValue(current, sec.path);
}

function stringifyTask1PrelimFieldForAction(value) {
  try {
    return JSON.stringify(value === undefined ? null : value, null, 2);
  } catch (_) {
    return String(value);
  }
}

function truncateTask1ActionPayload(text, maxChars) {
  const raw = String(text || '');
  const chars = Array.from(raw);
  if (chars.length <= maxChars) return raw;
  return `${chars.slice(0, maxChars).join('')}\n...（已截断，共 ${chars.length} 字符）`;
}

function buildTask1FieldMergeActionMarkdown(sectionLabel, beforeValue, afterValue, llmSummary) {
  const beforeJson = stringifyTask1PrelimFieldForAction(beforeValue);
  const afterJson = stringifyTask1PrelimFieldForAction(afterValue);
  const changed = beforeJson !== afterJson;
  return [
    '### 修改动作',
    `- 子任务：${sectionLabel}`,
    `- 变更判定：${changed ? '已更新当前字段' : '字段内容无变化（结构化结果与当前一致）'}`,
    `- 具体改动：${llmSummary || '（未生成修改要点）'}`,
  ].join('\n');
}

/** 与 TASK1_PRELIMINARY_MERGE_SESSION_SECTIONS 对齐 session 行，并保留合法 status */
function normalizeTask1PrelimMergeSessionsFromMsg(msg) {
  const sections = TASK1_PRELIMINARY_MERGE_SESSION_SECTIONS;
  const raw0 = msg && Array.isArray(msg.sessions) ? msg.sessions : [];
  const raw = migrateLegacyTask1PrelimMergeSessions(raw0, sections);
  const hasStmSubTasks = raw.some(
    (r) =>
      r &&
      r.key === 'stateTransitionMatrix' &&
      (Number.isInteger(r.stmRowIndex) ||
        r.stmMergePhase === 'appendNewEntities' ||
        (r.stmMergePhase === 'mergeEntity' && r.stmEntityLabel != null && String(r.stmEntityLabel).trim() !== '')),
  );
  if (hasStmSubTasks) {
    return raw.map((r) => {
      if (!r || typeof r !== 'object') {
        return { ...TASK1_PRELIMINARY_MERGE_SESSION_SECTIONS[0], status: 'pending' };
      }
      const st = r.status;
      const ok = st === 'done' || st === 'skipped' || st === 'running' || st === 'pending';
      return { ...r, status: ok ? st : 'pending' };
    });
  }
  return sections.map((s, i) => {
    const ex = raw[i];
    const st = ex && typeof ex === 'object' ? ex.status : null;
    const ok = st === 'done' || st === 'skipped' || st === 'running' || st === 'pending';
    return { ...s, status: ok ? st : 'pending' };
  });
}

function findTask1PrelimMergeResumeStartIndex(sessions) {
  const n = Array.isArray(sessions) ? sessions.length : 0;
  for (let i = 0; i < n; i++) {
    const st = sessions[i]?.status;
    if (st === 'pending' || st === 'running') return i;
  }
  return -1;
}

/** 刷新后：已点确认且计划未整体 done，且仍存在待跑/中断在小节 */
function isTask1PrelimMergeSessionPlanResumable(msg) {
  if (!msg || msg.type !== 'preliminaryRequirementMergeSessionPlanBlock') return false;
  if (!msg.confirmed) return false;
  if (msg.status === 'done') return false;
  const sessions = normalizeTask1PrelimMergeSessionsFromMsg(msg);
  return findTask1PrelimMergeResumeStartIndex(sessions) >= 0;
}

/**
 * task1 分段合并 Session 计划：刷新后续跑确认弹窗（仅 problemDetailView 内一层遮罩，换案时移除他案遮罩）。
 * @param {{ caseKey: string, sectionLabel: string, onConfirm: () => void, onCancel?: () => void }} p
 */
function showTask1PrelimMergeSessionResumeDialog(p) {
  const caseKey = String(p?.caseKey || '');
  const sectionLabel = String(p?.sectionLabel || '下一小节');
  const host = el.problemDetailView || document.body;
  for (const node of document.querySelectorAll('.task1-prelim-merge-resume-dialog-overlay')) {
    if (node.getAttribute('data-case-key') !== caseKey) node.remove();
  }
  if (
    [...document.querySelectorAll('.task1-prelim-merge-resume-dialog-overlay')].some(
      (n) => n.getAttribute('data-case-key') === caseKey,
    )
  ) {
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'task1-prelim-merge-resume-dialog-overlay';
  overlay.setAttribute('data-case-key', caseKey);
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="task1-prelim-merge-resume-dialog">
      <p class="task1-prelim-merge-resume-dialog-title">继续执行 Session 计划</p>
      <p class="task1-prelim-merge-resume-dialog-text">检测到未执行完的初步需求分段合并计划。点击确认后将继续从「${escapeHtml(sectionLabel)}」起执行该 Session 计划。</p>
      <div class="task1-prelim-merge-resume-dialog-actions">
        <button type="button" class="task1-prelim-merge-resume-btn task1-prelim-merge-resume-btn-cancel">取消</button>
        <button type="button" class="task1-prelim-merge-resume-btn task1-prelim-merge-resume-btn-confirm">确认</button>
      </div>
    </div>
  `;
  const close = () => {
    overlay.remove();
  };
  overlay.querySelector('.task1-prelim-merge-resume-btn-cancel')?.addEventListener('click', () => {
    close();
    try {
      p?.onCancel?.();
    } catch (_) {}
  });
  overlay.querySelector('.task1-prelim-merge-resume-btn-confirm')?.addEventListener('click', () => {
    close();
    try {
      p?.onConfirm?.();
    } catch (_) {}
  });
  host.appendChild(overlay);
}

/** 聊天记录就绪后：task1 未收官且存在中断的分段合并计划时，弹窗确认后续跑 */
function ensureTask1PrelimMergeSessionPlanResumeAfterChatLoad() {
  const item = __appState.currentProblemDetailItem;
  const msgs = __appState.problemDetailChatMessages;
  const container = el.problemDetailChatMessages;
  const caseKey = typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
  if (!item || !caseKey || !container || !Array.isArray(msgs) || msgs.length === 0) return;
  const merged =
    typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() || item : item;
  if (typeof isTaskCompleted === 'function' && isTaskCompleted(merged, 'task1')) return;

  let planIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.type === 'preliminaryRequirementMergeSessionPlanBlock') {
      planIdx = i;
      break;
    }
  }
  if (planIdx < 0) return;
  const planMsg = msgs[planIdx];
  if (!isTask1PrelimMergeSessionPlanResumable(planMsg)) return;

  const sessionsNorm = normalizeTask1PrelimMergeSessionsFromMsg(planMsg);
  const startIdx = findTask1PrelimMergeResumeStartIndex(sessionsNorm);
  const sectionLabel =
    startIdx >= 0 && sessionsNorm[startIdx] && sessionsNorm[startIdx].label
      ? String(sessionsNorm[startIdx].label)
      : '下一小节';

  showTask1PrelimMergeSessionResumeDialog({
    caseKey,
    sectionLabel,
    onConfirm: () => {
      void runTask1PreliminaryMergeSessionPlan(planIdx, container, { resume: true });
    },
  });
}

/**
 * task1 初步需求分段合并 Session 计划执行（首次确认或刷新后续跑）。
 * @param {number} planMsgIndex
 * @param {HTMLElement | null} container
 * @param {{ resume?: boolean }} [opts]
 */
async function runTask1PreliminaryMergeSessionPlan(planMsgIndex, container, opts) {
  const resume = !!(opts && opts.resume);
  const msg = __appState.problemDetailChatMessages?.[planMsgIndex];
  if (!msg || msg.type !== 'preliminaryRequirementMergeSessionPlanBlock') return;
  if (!resume) {
    if (msg.confirmed) return;
  } else if (!msg.confirmed || msg.status === 'done') {
    return;
  }
  const mergeFn = typeof window.mergePreliminaryRequirementV2ByLlm === 'function' ? window.mergePreliminaryRequirementV2ByLlm : null;
  const shapeFn = typeof window.isPreliminaryRequirementV2Shape === 'function' ? window.isPreliminaryRequirementV2Shape : null;
  if (!mergeFn || !shapeFn) {
    pushAndSaveProblemDetailChat({ role: 'system', content: '初步需求合并模块未加载。', timestamp: getTimeStr() });
    return;
  }
  const currentItem = __appState.currentProblemDetailItem;
  const dataItem = typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() || currentItem : currentItem;
  const basePreliminaryReq =
    typeof window.buildResolvedPreliminaryRequirement === 'function'
      ? window.buildResolvedPreliminaryRequirement(dataItem)
      : dataItem?.preliminaryReq;
  if (!basePreliminaryReq || !shapeFn(basePreliminaryReq)) {
    pushAndSaveProblemDetailChat({ role: 'system', content: '当前没有可修订的 V2 初步需求，请先完成深度提炼。', timestamp: getTimeStr() });
    return;
  }
  const extracted = msg.extractedPreliminaryReq && typeof msg.extractedPreliminaryReq === 'object' ? msg.extractedPreliminaryReq : null;
  if (!extracted || !shapeFn(extracted)) {
    pushAndSaveProblemDetailChat({ role: 'system', content: '补充提炼结果无效，无法执行分段合并。', timestamp: getTimeStr() });
    return;
  }

  const caseKey = getProblemDetailChatStorageKey(dataItem);
  let startLoop = 0;
  let mergedCurrent;

  if (!resume) {
    __appState.problemDetailChatMessages[planMsgIndex] = {
      ...msg,
      confirmed: true,
      status: 'running',
      sessions: buildTask1PrelimMergeSessionPlanSessions(extracted, basePreliminaryReq).map((s) => ({
        ...s,
        status: 'pending',
      })),
    };
    if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
    if (container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    }
    mergedCurrent = basePreliminaryReq;
    startLoop = 0;
  } else {
    let sessionsNorm = normalizeTask1PrelimMergeSessionsFromMsg(msg);
    const startIdx = findTask1PrelimMergeResumeStartIndex(sessionsNorm);
    if (startIdx < 0) {
      __appState.problemDetailChatMessages[planMsgIndex] = {
        ...msg,
        status: 'done',
        sessions: sessionsNorm,
      };
      if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
      if (container) {
        container.innerHTML = '';
        renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
        container.scrollTop = container.scrollHeight;
      }
      return;
    }
    if (sessionsNorm[startIdx]?.status === 'running') {
      sessionsNorm = sessionsNorm.map((row, j) => (j === startIdx ? { ...row, status: 'pending' } : row));
    }
    __appState.problemDetailChatMessages[planMsgIndex] = {
      ...msg,
      status: 'running',
      sessions: sessionsNorm,
    };
    if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
    if (container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    }
    mergedCurrent =
      typeof window.buildResolvedPreliminaryRequirement === 'function'
        ? window.buildResolvedPreliminaryRequirement(dataItem)
        : dataItem?.preliminaryReq;
    if (!mergedCurrent || !shapeFn(mergedCurrent)) {
      pushAndSaveProblemDetailChat({ role: 'system', content: '当前没有可修订的 V2 初步需求，无法续跑分段合并。', timestamp: getTimeStr() });
      return;
    }
    startLoop = startIdx;
  }

  const sessions = Array.isArray(__appState.problemDetailChatMessages[planMsgIndex]?.sessions)
    ? __appState.problemDetailChatMessages[planMsgIndex].sessions
    : buildTask1PrelimMergeSessionPlanSessions(extracted, basePreliminaryReq).map((s) => ({
        ...s,
        status: 'pending',
      }));
  const patchKey = typeof getDigitalProblemPersistKey === 'function' ? getDigitalProblemPersistKey(dataItem) : null;
  const mergeStmRowFn =
    typeof window.mergePreliminaryStmRowIntoMatrixByLlm === 'function'
      ? window.mergePreliminaryStmRowIntoMatrixByLlm
      : null;
  const mergeStmEntityFn =
    typeof window.mergePreliminaryStmEntityBucketByLlm === 'function'
      ? window.mergePreliminaryStmEntityBucketByLlm
      : null;

  try {
    for (let i = startLoop; i < sessions.length; i++) {
      const sec = sessions[i];
      let secVal;
      /** @type {'default'|'appendNew'|'mergeEntity'|'rowLegacy'} */
      let stmMergeMode = 'default';
      if (sec.key === 'stateTransitionMatrix') {
        if (sec.stmMergePhase === 'appendNewEntities') {
          stmMergeMode = 'appendNew';
          secVal = task1ExtractStmNewEntityRowsForAppend(mergedCurrent, extracted);
        } else if (
          sec.stmMergePhase === 'mergeEntity' &&
          sec.stmEntityLabel != null &&
          String(sec.stmEntityLabel).trim() !== ''
        ) {
          stmMergeMode = 'mergeEntity';
          secVal = task1ExtractStmRowsForEntityInExtracted(extracted, String(sec.stmEntityLabel).trim());
        } else if (Number.isInteger(sec.stmRowIndex)) {
          stmMergeMode = 'rowLegacy';
          secVal = getTask1PreliminaryMergeExtractedSlice(extracted, sec);
        } else {
          secVal = getTask1PreliminaryMergeExtractedSlice(extracted, sec);
        }
      } else {
        secVal = getTask1PreliminaryMergeExtractedSlice(extracted, sec);
      }

      const skipEmptyAppend = stmMergeMode === 'appendNew' && (!Array.isArray(secVal) || secVal.length === 0);
      const skipEmptyEntity =
        stmMergeMode === 'mergeEntity' && (!Array.isArray(secVal) || secVal.length === 0);
      if (secVal === undefined || skipEmptyAppend || skipEmptyEntity) {
        sessions[i] = { ...sessions[i], status: 'skipped' };
        const latestPlanSkip = __appState.problemDetailChatMessages[planMsgIndex];
        if (latestPlanSkip && latestPlanSkip.type === 'preliminaryRequirementMergeSessionPlanBlock') {
          __appState.problemDetailChatMessages[planMsgIndex] = { ...latestPlanSkip, sessions };
          if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
        }
        if (container) {
          container.innerHTML = '';
          renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
          container.scrollTop = container.scrollHeight;
        }
        continue;
      }
      sessions[i] = { ...sessions[i], status: 'running' };
      const latestPlanRun = __appState.problemDetailChatMessages[planMsgIndex];
      if (latestPlanRun && latestPlanRun.type === 'preliminaryRequirementMergeSessionPlanBlock') {
        __appState.problemDetailChatMessages[planMsgIndex] = { ...latestPlanRun, sessions };
        if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
      }
      if (container) {
        container.innerHTML = '';
        renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
        container.scrollTop = container.scrollHeight;
      }
      const beforeFieldValue = getTask1PreliminaryMergeCurrentSlice(mergedCurrent, sec);
      const partial = buildTask1PreliminaryPartialForMerge(sec, secVal);
      const isStmAppendStep = sec.key === 'stateTransitionMatrix' && stmMergeMode === 'appendNew';
      const isStmRowStep =
        sec.key === 'stateTransitionMatrix' && stmMergeMode === 'rowLegacy' && mergeStmRowFn;
      const isStmEntityMerge =
        sec.key === 'stateTransitionMatrix' && stmMergeMode === 'mergeEntity' && Array.isArray(secVal);
      // 「核心对象」「状态逻辑」合并前将本次 LLM 完整输入推入主聊天区（新实体直写步不推提示词卡）
      if (sec.key === 'coreBusinessEntities' || sec.key === 'stateTransitionMatrix') {
        let promptFullText = null;
        if (sec.key === 'coreBusinessEntities') {
          promptFullText =
            typeof window.buildPreliminaryMergeV2LlmInputFullText === 'function'
              ? window.buildPreliminaryMergeV2LlmInputFullText(mergedCurrent, partial)
              : null;
        } else if (isStmRowStep) {
          const curMx = getTask1PreliminarySessionPathValue(mergedCurrent, 'stateTransitionMatrix');
          const oneRow = partial?.stateTransitionMatrix?.[0];
          promptFullText =
            typeof window.buildPreliminaryStmRowMergeLlmInputFullText === 'function'
              ? window.buildPreliminaryStmRowMergeLlmInputFullText(curMx, oneRow)
              : null;
        } else if (isStmEntityMerge) {
          const label = String(sec.stmEntityLabel || '').trim();
          const curMx = getTask1PreliminarySessionPathValue(mergedCurrent, 'stateTransitionMatrix');
          const curArr = Array.isArray(curMx) ? curMx : [];
          const fnLabel =
            typeof window.getPrelimStmRowEntityDisplayLabel === 'function'
              ? window.getPrelimStmRowEntityDisplayLabel
              : null;
          const currentForEntity = fnLabel
            ? curArr.filter((r) => fnLabel(r, mergedCurrent) === label)
            : [];
          promptFullText =
            typeof window.buildPreliminaryStmEntityMergeLlmInputFullText === 'function'
              ? window.buildPreliminaryStmEntityMergeLlmInputFullText(currentForEntity, secVal)
              : null;
        } else if (!isStmAppendStep) {
          promptFullText =
            typeof window.buildPreliminaryMergeV2LlmInputFullText === 'function'
              ? window.buildPreliminaryMergeV2LlmInputFullText(mergedCurrent, partial)
              : null;
        }
        if (promptFullText) {
          try {
            pushAndSaveProblemDetailChat({
              type: 'task1PrelimMergePromptJsonBlock',
              taskId: 'task1',
              sectionKey: sec.key,
              sectionLabel: sec.label || sec.key,
              promptFullText,
              timestamp: getTimeStr(),
            });
          } catch (_) {}
          if (container) {
            container.innerHTML = '';
            renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
            container.scrollTop = container.scrollHeight;
          }
        }
      }
      const stepSpin = document.createElement('div');
      stepSpin.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing problem-detail-chat-preliminary-extracting';
      stepSpin.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner" aria-hidden="true"></span><span class="problem-detail-chat-msg-content">正在执行【${escapeHtml(sec.label)}】合并…</span></div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
      if (container) {
        container.appendChild(stepSpin);
        container.scrollTop = container.scrollHeight;
      }
      let result;
      if (isStmAppendStep) {
        const mergeV2 =
          typeof window.mergePreliminaryV2TopLevel === 'function' ? window.mergePreliminaryV2TopLevel : null;
        if (!mergeV2) throw new Error('mergePreliminaryV2TopLevel 不可用');
        const mergedReq = mergeV2(mergedCurrent, { stateTransitionMatrix: secVal });
        result = {
          mergedPreliminaryReq: mergedReq,
          modificationSummaryMarkdown: `已将 ${secVal.length} 条「新实体」分类下的状态转移直接并入当前矩阵（未调用大模型）。`,
          fullPrompt:
            '（本步未调用大模型：新提取结果中、当前初步需求尚不存在的 entity 分组已由系统按键并集直接写入。）',
          rawOutput: '',
          llmMeta: null,
        };
      } else if (isStmEntityMerge) {
        if (mergeStmEntityFn) {
          result = await mergeStmEntityFn(mergedCurrent, String(sec.stmEntityLabel).trim(), secVal);
        } else {
          result = await mergeFn(mergedCurrent, partial);
        }
      } else if (isStmRowStep) {
        const oneRow = partial?.stateTransitionMatrix?.[0];
        result = await mergeStmRowFn(mergedCurrent, oneRow);
      } else {
        result = await mergeFn(mergedCurrent, partial);
      }
      stepSpin.remove();
      mergedCurrent = result?.mergedPreliminaryReq || mergedCurrent;
      sessions[i] = { ...sessions[i], status: 'done' };
      const afterFieldValue = getTask1PreliminaryMergeCurrentSlice(mergedCurrent, sec);

      const cn =
        mergedCurrent?.businessContext?.clientName != null && String(mergedCurrent.businessContext.clientName).trim() !== ''
          ? String(mergedCurrent.businessContext.clientName).trim()
          : dataItem?.customerName ?? '';
      if (patchKey) {
        mergeDigitalProblemPatch(patchKey, {
          preliminaryReq: mergedCurrent,
          customerName: cn,
        });
      }
      const itemRef = __appState.currentProblemDetailItem;
      if (itemRef?.createdAt && typeof getDigitalProblems === 'function') {
        const synced = getDigitalProblems().find((it) => String(it.createdAt || '') === String(itemRef.createdAt));
        if (synced) __appState.currentProblemDetailItem = synced;
      }
      const latestPlanDone = __appState.problemDetailChatMessages[planMsgIndex];
      if (latestPlanDone && latestPlanDone.type === 'preliminaryRequirementMergeSessionPlanBlock') {
        __appState.problemDetailChatMessages[planMsgIndex] = { ...latestPlanDone, sessions };
        if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
      }
      if (container) {
        container.innerHTML = '';
        renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
        container.scrollTop = container.scrollHeight;
      }
      renderProblemDetailContent();
      pushAndSaveProblemDetailChat({
        type: 'modificationRegenerateLlmQueryBlock',
        taskId: 'task1',
        noteName: `初步需求分段合并：${sec.label}`,
        llmInputPrompt: result?.fullPrompt || '',
        llmOutputRaw: result?.rawOutput || '',
        modificationActionMarkdown: buildTask1FieldMergeActionMarkdown(
          sec.label,
          beforeFieldValue,
          afterFieldValue,
          result?.modificationSummaryMarkdown || '',
        ),
        timestamp: getTimeStr(),
        llmMeta: result?.llmMeta || null,
      });
      renderProblemDetailHistory();
    }
  } catch (err) {
    const latestPlanErr = __appState.problemDetailChatMessages[planMsgIndex];
    if (latestPlanErr && latestPlanErr.type === 'preliminaryRequirementMergeSessionPlanBlock') {
      __appState.problemDetailChatMessages[planMsgIndex] = { ...latestPlanErr, status: 'failed', sessions };
      if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
    }
    pushAndSaveProblemDetailChat({
      role: 'system',
      content: `初步需求分段合并失败：${err?.message || String(err)}`,
      timestamp: getTimeStr(),
    });
    if (container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    }
    renderProblemDetailHistory();
    updateProblemDetailChatHeaderLabel();
    return;
  }

  const latestPlan = __appState.problemDetailChatMessages[planMsgIndex];
  if (latestPlan && latestPlan.type === 'preliminaryRequirementMergeSessionPlanBlock') {
    __appState.problemDetailChatMessages[planMsgIndex] = { ...latestPlan, status: 'done', sessions };
    if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
  }

  const histEntry =
    typeof globalThis.buildRequirementDetailHistoryEntry === 'function'
      ? globalThis.buildRequirementDetailHistoryEntry(msg.userText || '')
      : { timestamp: new Date().toISOString(), content: msg.userText || '' };
  const latestItem = __appState.currentProblemDetailItem || dataItem;
  const prevHist = Array.isArray(latestItem?.requirementDetailHistory) ? [...latestItem.requirementDetailHistory] : [];
  const patchKeyFinal = typeof getDigitalProblemPersistKey === 'function' ? getDigitalProblemPersistKey(latestItem) : null;
  if (patchKeyFinal) {
    mergeDigitalProblemPatch(patchKeyFinal, {
      preliminaryReq: mergedCurrent,
      requirementDetailHistory: [...prevHist, histEntry],
    });
  }

  pushAndSaveProblemDetailChat({
    type: 'preliminaryRequirementFollowupBlock',
    taskId: 'task1',
    content: '请继续补充客户需求，我将基于您的补充进一步提炼并合并到当前初步需求。',
    timestamp: getTimeStr(),
  });

  if (container) {
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
  }
  renderProblemDetailContent();
  renderProblemDetailHistory();
  updateProblemDetailChatHeaderLabel();
}

/** 用户点击「没有更多补充」：完成 task1 并下发 task2 任务启动通知 */
async function completeTask1PreliminaryFeedbackDone() {
  // async 严格模式：bare currentProblemDetailItem 会 ReferenceError → unhandledrejection → 误记异常快照
  const item = __appState.currentProblemDetailItem;
  if (!item?.createdAt) return;
  problemDetailWaitingForFeedback = null;
  const caseId = getCurrentProblemCaseIdForBackend();

  if (isOnlineMode() && caseId) {
    try {
      await postProblemCaseTaskAction(caseId, mapProblemTaskIdToBackendTaskId('task1'), 'confirm', {
        content: '用户确认企业背景洞察（初步需求）完成',
        timestamp: new Date().toISOString(),
      });
      await refreshProblemDetailBundleFromBackend(caseId, { skipShowNextTaskStartNotification: true });
    } catch (err) {
      console.warn('[problem-detail] task1 preliminary feedback done confirm failed:', err);
      showError(`确认任务完成失败：${err?.message || String(err)}`);
      return;
    }
  }

  const alreadyCompleted =
    Array.isArray(__appState.problemDetailChatMessages) &&
    __appState.problemDetailChatMessages.some((m) => m.type === 'taskCompleteBlock' && m.taskId === 'task1');
  if (!alreadyCompleted) {
    pushAndSaveProblemDetailChat({ type: 'taskCompleteBlock', taskId: 'task1', content: '用户确认任务完成', timestamp: getTimeStr() });
    advanceProblemStateOnTaskComplete(item.createdAt, 'task1');
  }

  const chatEl = el.problemDetailChatMessages;
  if (chatEl) {
    chatEl.innerHTML = '';
    renderProblemDetailChatFromStorage(chatEl, __appState.problemDetailChatMessages);
    chatEl.scrollTop = chatEl.scrollHeight;
  }
  const updated = typeof getDigitalProblems === 'function' ? getDigitalProblems().find((it) => String(it.createdAt || '') === String(item.createdAt)) : null;
  if (updated) __appState.currentProblemDetailItem = updated;
  renderProblemDetailContent();
  renderProblemDetailHistory();
  updateProblemDetailChatHeaderLabel();
  if (typeof syncProblemDetailWorkspaceToCanonicalTask === 'function') {
    syncProblemDetailWorkspaceToCanonicalTask(__appState.currentProblemDetailItem);
  }
  requestAnimationFrame(() => {
    showTaskStartNotificationIfNeeded('task2', true, TASK_START_NOTIFY_AFTER_PREV_COMPLETED);
    if (typeof focusWorkspaceOnCurrentTask === 'function') focusWorkspaceOnCurrentTask('task2');
  });
}

/** task1：用户处于「补充更多需求」后，先提炼补充内容，再下发分段合并 session 计划 */
async function runTask1PreliminarySupplementRefinement(userText, container) {
  const currentItem = __appState.currentProblemDetailItem;
  const dataItem = typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() || currentItem : currentItem;
  const dataKey = typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(dataItem) : '';
  const basePreliminaryReq =
    typeof window.buildResolvedPreliminaryRequirement === 'function'
      ? window.buildResolvedPreliminaryRequirement(dataItem)
      : dataItem?.preliminaryReq;
  logTask1PrelimSupplement('start', {
    dataKey,
    hasPreliminaryReq: !!(dataItem?.preliminaryReq || (basePreliminaryReq && typeof basePreliminaryReq === 'object')),
    userTextLength: String(userText || '').length,
    chatLength: Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages.length : -1,
  });
  if (
    !basePreliminaryReq ||
    typeof window.isPreliminaryRequirementV2Shape !== 'function' ||
    !window.isPreliminaryRequirementV2Shape(basePreliminaryReq)
  ) {
    pushAndSaveProblemDetailChat({ role: 'system', content: '当前没有可修订的 V2 初步需求，请先完成深度提炼。', timestamp: getTimeStr() });
    logTask1PrelimSupplement('abort.invalid-preliminary', { dataKey });
    return;
  }
  const parseFn = typeof window.parsePreliminaryRequirementDepthV2 === 'function' ? window.parsePreliminaryRequirementDepthV2 : null;
  if (!parseFn) {
    pushAndSaveProblemDetailChat({ role: 'system', content: '初步需求补充模块未加载。', timestamp: getTimeStr() });
    logTask1PrelimSupplement('abort.missing-fn', { hasParseFn: !!parseFn, dataKey });
    return;
  }
  const spin = document.createElement('div');
  spin.className =
    'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing problem-detail-chat-preliminary-extracting';
  spin.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner" aria-hidden="true"></span><span class="problem-detail-chat-msg-content">正在提炼补充内容（全文）…</span></div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
  if (container) {
    container.appendChild(spin);
    container.scrollTop = container.scrollHeight;
  }
  const setPrelimSupplementSpinText = (t) => {
    const el = spin.querySelector('.problem-detail-chat-msg-content');
    if (el) el.textContent = t;
  };
  const patchKeyForPrelimRestore =
    typeof getDigitalProblemPersistKey === 'function' ? getDigitalProblemPersistKey(dataItem) : '';
  let preservedPreliminaryReq = null;
  try {
    if (dataItem?.preliminaryReq && typeof dataItem.preliminaryReq === 'object') {
      preservedPreliminaryReq = JSON.parse(JSON.stringify(dataItem.preliminaryReq));
    }
  } catch (_) {
    preservedPreliminaryReq = null;
  }
  try {
    const parsedResult = await parseFn(userText);
    let parsedCore = parsedResult?.parsed && typeof parsedResult.parsed === 'object' ? { ...parsedResult.parsed } : {};
    logTask1PrelimSupplement('parsed', {
      dataKey,
      llmModel: parsedResult?.llmMeta?.model || '',
      parsedTopKeys: Object.keys(parsedCore || {}),
      chatLengthAfterParse: Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages.length : -1,
    });
    if (!window.isPreliminaryRequirementV2Shape(parsedCore)) {
      throw new Error('补充内容提炼结果不是有效的 V2 初步需求结构');
    }
    const sliceFn =
      typeof window.parsePreliminaryRequirementSupplementSliceV2 === 'function'
        ? window.parsePreliminaryRequirementSupplementSliceV2
        : null;
    if (sliceFn) {
      setPrelimSupplementSpinText('正在提炼补充内容（核心对象）…');
      try {
        const rCore = await sliceFn(userText, 'coreBusinessEntities');
        if (rCore?.parsed && Array.isArray(rCore.parsed.coreBusinessEntities)) {
          parsedCore = { ...parsedCore, coreBusinessEntities: rCore.parsed.coreBusinessEntities };
        }
      } catch (e) {
        console.warn('[task1-prelim-supplement] coreBusinessEntities slice failed', e?.message || e);
      }
      setPrelimSupplementSpinText('正在提炼补充内容（状态逻辑）…');
      try {
        const rStm = await sliceFn(userText, 'stateTransitionMatrix');
        if (rStm?.parsed && Array.isArray(rStm.parsed.stateTransitionMatrix)) {
          parsedCore = { ...parsedCore, stateTransitionMatrix: rStm.parsed.stateTransitionMatrix };
        }
      } catch (e) {
        console.warn('[task1-prelim-supplement] stateTransitionMatrix slice failed', e?.message || e);
      }
    }
    if (!window.isPreliminaryRequirementV2Shape(parsedCore)) {
      throw new Error('补充内容提炼结果不是有效的 V2 初步需求结构');
    }
    pushAndSaveProblemDetailChat({
      ...buildTask1LlmQueryMessage({
        noteName: '客户初步需求补充提炼',
        fullPrompt: parsedResult?.fullPrompt || '',
        parsed: parsedCore,
        rawOutput: parsedResult?.rawOutput || '',
        timestamp: getTimeStr(),
        usage: parsedResult?.llmMeta?.usage,
        model: parsedResult?.llmMeta?.model,
        durationMs: parsedResult?.llmMeta?.durationMs,
      }),
    });
    spin.remove();
    const basePrelimForPlan =
      typeof window.buildResolvedPreliminaryRequirement === 'function'
        ? window.buildResolvedPreliminaryRequirement(dataItem)
        : dataItem?.preliminaryReq;
    const planSessions0 = buildTask1PrelimMergeSessionPlanSessions(parsedCore, basePrelimForPlan);
    pushAndSaveProblemDetailChat({
      type: 'preliminaryRequirementMergeSessionPlanBlock',
      taskId: 'task1',
      content: `已完成结构化需求提取。下面将按 ${planSessions0.length} 个子任务逐字段整合到当前初步需求，请确认开始执行。`,
      userText: String(userText || ''),
      extractedPreliminaryReq: parsedCore,
      sessions: planSessions0.map((s) => ({ ...s, status: 'pending' })),
      confirmed: false,
      status: 'pending',
      timestamp: getTimeStr(),
    });
    if (container) {
      logTask1PrelimSupplement('rerender.before', {
        dataKey,
        chatLength: Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages.length : -1,
      });
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
      logTask1PrelimSupplement('rerender.after', {
        dataKey,
        domChildCount: container.childElementCount,
        chatLength: Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages.length : -1,
      });
    }
    renderProblemDetailContent();
    updateProblemDetailChatHeaderLabel();
    renderProblemDetailHistory();
  } catch (err) {
    spin.remove();
    const msg = err?.message || String(err);
    logTask1PrelimSupplement('error', {
      dataKey,
      error: msg,
      stack: err?.stack || '',
      chatLengthOnError: Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages.length : -1,
    });
    pushAndSaveProblemDetailChat({ role: 'system', content: `初步需求补充处理失败：${msg}`, timestamp: getTimeStr() });
    if (dataKey) {
      problemDetailWaitingForFeedback = {
        taskId: 'task1',
        createdAt: dataKey,
        type: 'modification',
        prelimSupplement: true,
      };
    }
    try {
      globalThis.SmartCto?.flowExceptionRecord?.setLastSystemActionProbeOverride?.({
        kind: 'system_message',
        summary: TASK1_PRELIM_SUPPLEMENT_CONTINUE_PROMPT,
        detail: { content: TASK1_PRELIM_SUPPLEMENT_CONTINUE_PROMPT },
      });
      recordFlowExceptionTyped('llm', `初步需求补充处理失败：${msg}`);
    } catch (_) {}
    if (preservedPreliminaryReq && patchKeyForPrelimRestore) {
      mergeDigitalProblemPatch(patchKeyForPrelimRestore, { preliminaryReq: preservedPreliminaryReq });
      const itemRef = __appState.currentProblemDetailItem;
      if (itemRef && typeof getDigitalProblems === 'function') {
        const synced = getDigitalProblems().find(
          (it) =>
            String(it.createdAt || '') === String(itemRef.createdAt) ||
            (itemRef.id && String(it.id || '') === String(itemRef.id)),
        );
        if (synced) __appState.currentProblemDetailItem = synced;
      }
    }
    if (container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    }
    renderProblemDetailContent();
    updateProblemDetailChatHeaderLabel();
    renderProblemDetailHistory();
  }
}

/**
 * task1：跟进卡片「对补充内容修改」——收集修改意见后调用 LLM 修订 V2 初步需求，聊天区推送摘要与确认入口。
 * @param {string} modificationText
 * @param {HTMLElement|null} container
 */
async function runTask1PreliminarySupplementModifyWithFeedback(modificationText, container) {
  const currentItem = __appState.currentProblemDetailItem;
  const dataItem =
    typeof resolveProblemItemForTaskNotification === 'function'
      ? resolveProblemItemForTaskNotification() || currentItem
      : currentItem;
  const basePreliminaryReq =
    typeof window.buildResolvedPreliminaryRequirement === 'function'
      ? window.buildResolvedPreliminaryRequirement(dataItem)
      : dataItem?.preliminaryReq;
  if (
    !basePreliminaryReq ||
    typeof window.isPreliminaryRequirementV2Shape !== 'function' ||
    !window.isPreliminaryRequirementV2Shape(basePreliminaryReq)
  ) {
    pushAndSaveProblemDetailChat({
      role: 'system',
      content: '当前没有可修订的 V2 初步需求，请先完成深度提炼。',
      timestamp: getTimeStr(),
    });
    if (container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    }
    return;
  }
  const refineFn =
    typeof window.refinePreliminaryRequirementV2WithFeedback === 'function'
      ? window.refinePreliminaryRequirementV2WithFeedback
      : null;
  if (!refineFn) {
    pushAndSaveProblemDetailChat({ role: 'system', content: '初步需求修订模块未加载。', timestamp: getTimeStr() });
    if (container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    }
    return;
  }
  const spin = document.createElement('div');
  spin.className =
    'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing problem-detail-chat-preliminary-extracting';
  spin.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner" aria-hidden="true"></span><span class="problem-detail-chat-msg-content">正在根据您的意见修订初步需求…</span></div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
  if (container) {
    container.appendChild(spin);
    container.scrollTop = container.scrollHeight;
  }
  try {
    const result = await refineFn(basePreliminaryReq, String(modificationText || '').trim());
    const merged = result?.mergedPreliminaryReq;
    if (!merged || !window.isPreliminaryRequirementV2Shape(merged)) {
      throw new Error('修订结果无效');
    }
    if (typeof buildTask1LlmQueryMessage === 'function') {
      pushAndSaveProblemDetailChat({
        ...buildTask1LlmQueryMessage({
          noteName: '客户初步需求·按意见修订',
          fullPrompt: result.fullPrompt || '',
          parsed: merged,
          rawOutput: result.rawOutput || '',
          timestamp: getTimeStr(),
          usage: result.llmMeta?.usage,
          model: result.llmMeta?.model,
          durationMs: result.llmMeta?.durationMs,
        }),
      });
    }
    let summaryMd = result.modificationSummaryMarkdown != null ? String(result.modificationSummaryMarkdown).trim() : '';
    if (!summaryMd) summaryMd = '（未生成修改要点）';
    pushAndSaveProblemDetailChat({
      type: 'preliminaryRequirementModificationSummaryBlock',
      taskId: 'task1',
      summaryMarkdown: summaryMd,
      userModificationFeedback: String(modificationText || '').trim(),
      mergedPreliminaryReq: JSON.parse(JSON.stringify(merged)),
      confirmed: false,
      timestamp: getTimeStr(),
    });
    spin.remove();
    if (container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    }
    renderProblemDetailContent();
    updateProblemDetailChatHeaderLabel();
    renderProblemDetailHistory();
  } catch (err) {
    spin.remove();
    const msg = err?.message || String(err);
    pushAndSaveProblemDetailChat({
      role: 'system',
      content: `按意见修订初步需求失败：${msg}`,
      timestamp: getTimeStr(),
    });
    if (container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    }
    renderProblemDetailContent();
    updateProblemDetailChatHeaderLabel();
    renderProblemDetailHistory();
  }
}

/**
 * 判断刷新后是否应恢复 task1「补充需求」等待态（内存 problemDetailWaitingForFeedback 丢失）。
 * @param {Array} msgs
 * @param {Object} item - 当前详情案例
 * @returns {{ pushPrompt: boolean } | null}
 */
function getTask1PrelimSupplementRecoveryDecision(msgs, item) {
  if (!item || !Array.isArray(msgs) || msgs.length === 0) return null;
  const merged =
    typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() || item : item;
  if (isTaskCompleted(merged, 'task1')) return null;
  const isV2 =
    typeof window.isPreliminaryRequirementV2Shape === 'function' &&
    window.isPreliminaryRequirementV2Shape(merged.preliminaryReq);
  if (!isV2) return null;
  let hasFollowup = false;
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i]?.type === 'preliminaryRequirementFollowupBlock') {
      hasFollowup = true;
      break;
    }
  }
  if (!hasFollowup) return null;
  const last = msgs[msgs.length - 1];
  if (!last) return null;
  const lastContent = String(last.content || '');
  if (last.role === 'system') {
    if (lastContent.includes('初步需求补充处理失败')) return { pushPrompt: true };
    if (lastContent === TASK1_PRELIM_SUPPLEMENT_CONTINUE_PROMPT) return { pushPrompt: false };
  }
  if (last.role === 'user') {
    let lastFu = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]?.type === 'preliminaryRequirementFollowupBlock') {
        lastFu = i;
        break;
      }
    }
    if (lastFu < 0) return null;
    let hasContinueAfterFu = false;
    for (let i = lastFu + 1; i < msgs.length; i++) {
      if (
        msgs[i]?.role === 'system' &&
        String(msgs[i].content || '') === TASK1_PRELIM_SUPPLEMENT_CONTINUE_PROMPT
      ) {
        hasContinueAfterFu = true;
        break;
      }
    }
    if (hasContinueAfterFu) return { pushPrompt: true };
  }
  return null;
}

/** 聊天记录加载完成后：若最后一条为「对补充内容修改」引导语，恢复 `prelimSupplementModify` 等待态（刷新后不靠浏览器 prompt） */
function ensureTask1PrelimModifyInstructionRecoveryAfterChatLoad() {
  const item = __appState.currentProblemDetailItem;
  const msgs = __appState.problemDetailChatMessages;
  const caseKey = typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
  if (!item || !caseKey || !Array.isArray(msgs) || msgs.length === 0) return;
  const merged =
    typeof resolveProblemItemForTaskNotification === 'function' ? resolveProblemItemForTaskNotification() || item : item;
  if (isTaskCompleted(merged, 'task1')) return;
  const isV2 =
    typeof window.isPreliminaryRequirementV2Shape === 'function' &&
    window.isPreliminaryRequirementV2Shape(merged.preliminaryReq);
  if (!isV2) return;
  const last = msgs[msgs.length - 1];
  if (!last || last.role !== 'system' || String(last.content || '') !== TASK1_PRELIM_SUPPLEMENT_MODIFY_PROMPT) return;
  if (problemDetailWaitingForFeedback) return;
  problemDetailWaitingForFeedback = {
    taskId: 'task1',
    createdAt: caseKey,
    type: 'modification',
    prelimSupplementModify: true,
  };
}

/** 聊天记录加载完成后：若处于企业背景洞察且补充链路失败/中断，恢复等待态并可选补发引导语 */
function ensureTask1PrelimSupplementRecoveryAfterChatLoad() {
  const item = __appState.currentProblemDetailItem;
  const msgs = __appState.problemDetailChatMessages;
  const container = el.problemDetailChatMessages;
  const caseKey = typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
  if (!item || !caseKey || !container || !Array.isArray(msgs)) return;
  const decision = getTask1PrelimSupplementRecoveryDecision(msgs, item);
  if (!decision) return;
  problemDetailWaitingForFeedback = {
    taskId: 'task1',
    createdAt: caseKey,
    type: 'modification',
    prelimSupplement: true,
  };
  logTask1PrelimSupplement('recovery.after-chat-load', {
    caseKey,
    pushPrompt: decision.pushPrompt,
    lastMsgRole: msgs[msgs.length - 1]?.role,
    lastMsgType: msgs[msgs.length - 1]?.type,
  });
  if (decision.pushPrompt) {
    pushAndSaveProblemDetailChat({
      role: 'system',
      content: TASK1_PRELIM_SUPPLEMENT_CONTINUE_PROMPT,
      timestamp: getTimeStr(),
    });
  }
  container.innerHTML = '';
  renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
  container.scrollTop = container.scrollHeight;
  if (typeof renderProblemDetailHistory === 'function') renderProblemDetailHistory();
  if (typeof updateProblemDetailChatHeaderLabel === 'function') updateProblemDetailChatHeaderLabel();
  if (typeof renderProblemDetailContent === 'function') renderProblemDetailContent();
}

/**
 * 完工确认块：用户点「请修改」或从输出卡「修正」进入修改链时标记 userChoseModify，避免旧块仍 !confirmed 时阻塞再次下发确认（与 task7 一致；task4 价值流修改重跑后须能再弹出「是否视为完成」）。
 * 遍历全部未确认块，避免历史重复块仅改最后一条仍留一条 !userChoseModify 导致 showTaskCompletionConfirm 早退。
 * @param {string} taskId
 */
function markTaskCompletionConfirmUserChoseModify(taskId) {
  if (!taskId || !Array.isArray(__appState.problemDetailChatMessages)) return;
  let dirty = false;
  for (let i = 0; i < __appState.problemDetailChatMessages.length; i++) {
    const m = __appState.problemDetailChatMessages[i];
    if (m?.type === 'taskCompletionConfirmBlock' && m.taskId === taskId && !m.confirmed && !m.userChoseModify) {
      __appState.problemDetailChatMessages[i] = { ...m, userChoseModify: true };
      dirty = true;
    }
  }
  if (!dirty) return;
  const chatKey =
    typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(__appState.currentProblemDetailItem) : '';
  if (chatKey) saveProblemDetailChat(chatKey, __appState.problemDetailChatMessages);
}

function markTaskCompletionConfirmBlockConfirmed(taskId) {
  if (!taskId || !Array.isArray(__appState.problemDetailChatMessages)) return false;
  const targetIdx = __appState.problemDetailChatMessages.findLastIndex(
    (m) => m?.type === 'taskCompletionConfirmBlock' && m.taskId === taskId,
  );
  if (targetIdx < 0) return false;
  const target = __appState.problemDetailChatMessages[targetIdx];
  if (target?.confirmed) return false;
  // confirmInFlight：task2–task6 用于「提交中」态；写回 confirmed 时一并清除，避免脏标记
  __appState.problemDetailChatMessages[targetIdx] = { ...target, confirmed: true, confirmInFlight: false };
  const chatKey = typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(__appState.currentProblemDetailItem) : '';
  if (chatKey) saveProblemDetailChat(chatKey, __appState.problemDetailChatMessages);
  return true;
}

/** task2–task6 完成确认块：内存中切换「提交中」态（不落盘，避免刷新误卡在提交中） */
function setTaskCompletionConfirmBlockInFlight(taskId, inFlight) {
  if (!taskId || !Array.isArray(__appState.problemDetailChatMessages)) return false;
  if (!['task2', 'task3', 'task4', 'task5', 'task6'].includes(taskId)) return false;
  const targetIdx = __appState.problemDetailChatMessages.findLastIndex(
    (m) => m?.type === 'taskCompletionConfirmBlock' && m.taskId === taskId,
  );
  if (targetIdx < 0) return false;
  const target = __appState.problemDetailChatMessages[targetIdx];
  __appState.problemDetailChatMessages[targetIdx] = { ...target, confirmInFlight: !!inFlight };
  return true;
}

function logTask2CompletionConfirmPhase(extra) {
  const resolvedItem = resolveProblemItemForTaskNotification() || __appState.currentProblemDetailItem;
  const firstUncompletedTask = resolvedItem ? getFirstUncompletedTask(resolvedItem) : null;
  console.info('[FE:task2-completion-confirm]', {
    taskId: 'task2',
    isTaskCompletedTask2: !!(resolvedItem && isTaskCompleted(resolvedItem, 'task2')),
    firstUncompletedTaskId: firstUncompletedTask?.id || null,
    ...(extra && typeof extra === 'object' ? extra : {}),
  });
}

/** owner 最小日志：task3 完成态须以 completedStages 含 2 为准，不得与「仅有 requirementLogic」混淆 */
function logTask3CompletionConfirmPhase(extra) {
  const resolvedItem = resolveProblemItemForTaskNotification() || __appState.currentProblemDetailItem;
  const firstUncompletedTask = resolvedItem ? getFirstUncompletedTask(resolvedItem) : null;
  console.info('[FE:task3-completion-confirm]', {
    taskId: 'task3',
    isTaskCompleted: !!(resolvedItem && isTaskCompleted(resolvedItem, 'task3')),
    completedStages: resolvedItem && Array.isArray(resolvedItem.completedStages) ? [...resolvedItem.completedStages] : resolvedItem?.completedStages ?? null,
    hasRequirementLogic: !!(resolvedItem && resolvedItem.requirementLogic),
    firstUncompletedTaskId: firstUncompletedTask?.id || null,
    ...(extra && typeof extra === 'object' ? extra : {}),
  });
}

/** owner 最小日志：task4/5/6 完成态须与 workflowAlignCompletedStages 及后端 confirm 对齐（不得与仅输出落库混淆） */
function logWorkflowAlignTaskCompletionConfirmPhase(taskId, extra) {
  const resolvedItem = resolveProblemItemForTaskNotification() || __appState.currentProblemDetailItem;
  const firstUncompletedTask = resolvedItem ? getFirstUncompletedTask(resolvedItem) : null;
  const wf = resolvedItem && Array.isArray(resolvedItem.workflowAlignCompletedStages)
    ? [...resolvedItem.workflowAlignCompletedStages]
    : resolvedItem?.workflowAlignCompletedStages ?? null;
  console.info('[FE:workflow-align-task-completion-confirm]', {
    taskId,
    workflowAlignCompletedStages: wf,
    isTaskCompleted: !!(resolvedItem && isTaskCompleted(resolvedItem, taskId)),
    firstUncompletedTaskId: firstUncompletedTask?.id || null,
    ...(extra && typeof extra === 'object' ? extra : {}),
  });
}

function hasCoreBusinessObjectAllDoneBlockAfterLatestSessions() {
  const sessionsIdx = __appState.problemDetailChatMessages.findLastIndex((m) => m.type === 'coreBusinessObjectSessionsBlock');
  if (sessionsIdx < 0) return false;
  return __appState.problemDetailChatMessages.slice(sessionsIdx + 1).some((m) => m.type === 'coreBusinessObjectAllDoneBlock');
}
function ensureCoreBusinessObjectAllDoneBlockIfNeeded() {
  return false;
}

/**
 * 解析 IT设计补齐 session：优先 `getDigitalProblems()` 中与当前案例同 persistKey 的缓存行，其次 `item.itDesignSupplementSessions`，
 * 最后从聊天中最近的 `itDesignSupplementSessionsBlock.sessions` 回填。避免详情内存项与列表缓存不同步时「确认所有」得到空数组。
 */
function resolveItDesignSupplementSessionsForTask8(item, messages) {
  if (!item || typeof item !== 'object') return [];
  const persistKey =
    typeof getDigitalProblemPersistKey === 'function' ? String(getDigitalProblemPersistKey(item) || '').trim() : '';
  const list = typeof getDigitalProblems === 'function' ? getDigitalProblems() : [];
  const fromList =
    persistKey && list.length > 0
      ? list.find((it) => typeof getDigitalProblemPersistKey === 'function' && getDigitalProblemPersistKey(it) === persistKey)
      : null;
  const pick = (arr) => (Array.isArray(arr) && arr.length > 0 ? arr : null);
  const mergedRows = mergeItDesignSupplementSessionsPreferProgress(
    fromList?.itDesignSupplementSessions,
    item.itDesignSupplementSessions,
  );
  const raw = pick(mergedRows);
  if (raw) {
    return overlayItDesignSupplementSessionsFromGlobalAggregate(raw, item.globalItGapAnalysisJson);
  }
  const msgs = Array.isArray(messages) ? messages : [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m && m.type === 'itDesignSupplementSessionsBlock' && pick(m.sessions)) {
      return overlayItDesignSupplementSessionsFromGlobalAggregate(m.sessions, item.globalItGapAnalysisJson);
    }
  }
  return [];
}
globalThis.resolveItDesignSupplementSessionsForTask8 = resolveItDesignSupplementSessionsForTask8;

/** 与 itDesignSupplement.js 自动顺序收尾推送文案保持一致 */
const IT_DESIGN_SUPPLEMENT_ALL_DONE_CONFIRM_CONTENT =
  '各事务的 IT 设计补齐与 BPM 泳道绘制均已完成。点击「全部确认」将写入工作区汇总，并下发本任务（IT设计补齐）是否视为完成的确认。';
globalThis.IT_DESIGN_SUPPLEMENT_ALL_DONE_CONFIRM_CONTENT = IT_DESIGN_SUPPLEMENT_ALL_DONE_CONFIRM_CONTENT;

/**
 * 浏览器刷新进入详情且聊天记录已从存储恢复后：若 task8 主路径下各事务均已产出 designOutputJson，
 * 但用户尚未通过「确认所有」写入 itDesignSupplementV1 聚合（且未进入 BPM 计划），则删除历史「确认所有」块并重新下发，避免陈旧块与按钮态不一致。
 * @returns {boolean} 是否已改写聊天记录并需重绘主聊天区
 */
function ensureItDesignSupplementAllDoneConfirmAfterChatHydrate() {
  if (!isProblemDetailNavigationReload()) return false;
  if (problemDetailChatMode !== 'agent') return false;
  const item = resolveProblemItemForTaskNotification() || __appState.currentProblemDetailItem;
  const caseKeyHydrate = typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
  if (!caseKeyHydrate || !Array.isArray(__appState.problemDetailChatMessages)) return false;
  const nextTask = typeof getFirstUncompletedTask === 'function' ? getFirstUncompletedTask(item) : null;
  if (!nextTask || nextTask.id !== 'task8') return false;
  const sessions = resolveItDesignSupplementSessionsForTask8(item, __appState.problemDetailChatMessages);
  if (sessions.length === 0) return false;
  const allDesignDone = sessions.every((s) => s && s.designOutputJson != null);
  if (!allDesignDone) return false;
  let interleavedPlan = false;
  for (let i = __appState.problemDetailChatMessages.length - 1; i >= 0; i--) {
    const m = __appState.problemDetailChatMessages[i];
    if (m && m.type === 'itDesignSupplementSessionsBlock') {
      interleavedPlan = m.interleavedBpmDrawPlan === true;
      break;
    }
  }
  if (interleavedPlan) {
    const allBpmDone = sessions.every((s) => {
      if (!s || s.designOutputJson == null) return false;
      const md = s.bpmFlowDrawMarkdown;
      return md != null && String(md).trim() !== '';
    });
    if (!allBpmDone) return false;
  }
  if (item.globalItGapAnalysisJson && item.globalItGapAnalysisJson.itDesignSupplementV1 === true) return false;
  if (__appState.problemDetailChatMessages.some((m) => m && m.type === 'itDesignBpmDrawSessionsBlock')) return false;
  if (__appState.problemDetailChatMessages.some((m) => m && m.type === 'itDesignSupplementAllDoneConfirmBlock' && m.confirmed === true)) {
    return false;
  }
  const hadPrior = __appState.problemDetailChatMessages.some((m) => m && m.type === 'itDesignSupplementAllDoneConfirmBlock');
  const filtered = __appState.problemDetailChatMessages.filter((m) => m && m.type !== 'itDesignSupplementAllDoneConfirmBlock');
  filtered.push({
    type: 'itDesignSupplementAllDoneConfirmBlock',
    content: IT_DESIGN_SUPPLEMENT_ALL_DONE_CONFIRM_CONTENT,
    taskId: 'task8',
    timestamp: getTimeStr(),
    confirmed: false,
  });
  __appState.problemDetailChatMessages = filtered;
  saveProblemDetailChat(caseKeyHydrate, filtered);
  if (typeof globalThis !== 'undefined' && globalThis.__FE_MSG_PERSIST_DEBUG) {
    try {
      console.debug('[FE:task8-it-design-confirm-refresh]', { hadPrior, len: filtered.length });
    } catch (_) {}
  }
  return true;
}

function initProblemDetailChat() {
  __ensureProblemDetailRuntimeHostMounted();
  const container = el.problemDetailChatMessages;
  if (!container) return;
  container.innerHTML = '';
  const item = __appState.currentProblemDetailItem;
  const chatKey = getProblemDetailChatStorageKey(item);
  const storedChat = chatKey ? getProblemDetailChats()[chatKey] : null;
  if (storedChat && Array.isArray(storedChat) && storedChat.length > 0) {
    // 浅拷贝数组，避免与 adapter 内 problemChatsCache[key] 共用同一引用，导致 push 后 save 增量 diff 误判
    __appState.problemDetailChatMessages = storedChat.slice();
    __appState.problemDetailChatMessagesCaseKey = chatKey || null;
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    if (typeof globalThis !== 'undefined' && globalThis.__FE_MSG_PERSIST_DEBUG) {
      try {
        console.debug('[FE:msg-init]', {
          clonedChat: true,
          len: __appState.problemDetailChatMessages.length,
          sameArrayRefAsCache: __appState.problemDetailChatMessages === storedChat,
        });
      } catch (_) {}
    }
    if (typeof globalThis.SmartCto?.problemDetailRuntime?.applyStoredChatPostHydrationPipeline === 'function') {
      globalThis.SmartCto.problemDetailRuntime.applyStoredChatPostHydrationPipeline(container);
    }
  } else {
    if (!isProblemDetailStorageHydrated()) {
      __appState.problemDetailChatMessages = [];
      __appState.problemDetailChatMessagesCaseKey = null;
      container.innerHTML = `<div class="problem-detail-chat-msg problem-detail-chat-msg-system"><div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">正在加载聊天记录…</div></div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
      if (el.problemDetailChatInput) el.problemDetailChatInput.value = '';
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
      return;
    }
    // 空案例：仅 DOM 占位，不写 __appState.problemDetailChatMessages、不调 saveProblemDetailChat（避免占位污染后端/缓存）
    __appState.problemDetailChatMessages = [];
    __appState.problemDetailChatMessagesCaseKey = chatKey || null;
    appendProblemDetailChatMessage(container, 'system', '请输入客户基本信息', { noSave: true });
    if (typeof globalThis !== 'undefined' && globalThis.__FE_MSG_PERSIST_DEBUG) {
      try {
        console.debug('[FE:msg-init]', {
          emptyChat: true,
          skipBackendMessages: true,
          domMsgCount: document.querySelectorAll('.problem-detail-chat-msg').length,
        });
      } catch (_) {}
    }
  }
  if (el.problemDetailChatInput) el.problemDetailChatInput.value = '';
  ensureTask1PrelimModifyInstructionRecoveryAfterChatLoad();
  ensureTask1PrelimSupplementRecoveryAfterChatLoad();
  ensureTask1PrelimMergeSessionPlanResumeAfterChatLoad();
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

async function runBmcGeneration() {
  // [bridge] → core/task2-companion-runtime.js (Phase 4A)
  return globalThis.SmartCto.task2Runtime.runBmcGeneration();
}

async function runRequirementLogicConstruction() {
  const container = el.problemDetailChatMessages;
  const item = __appState.currentProblemDetailItem;
  if (!container || !item?.createdAt || !hasAiConfig()) return;
  const basicInfo = item.basicInfo || problemDetailConfirmedBasicInfo || {};
  const bmc = item.bmc || {};
  const preliminaryReq =
    typeof window.buildPreliminaryPreContent === 'function' ? window.buildPreliminaryPreContent(item) : {};
  if (!basicInfo || Object.keys(basicInfo).length === 0) {
    const errBlock = document.createElement('div');
    errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
    errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">需求逻辑构建需要客户基本信息，请先完成企业背景洞察。</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
    container.appendChild(errBlock);
    pushAndSaveProblemDetailChat({ role: 'system', content: '需求逻辑构建需要客户基本信息，请先完成企业背景洞察。', timestamp: getTimeStr() });
    return;
  }
  if (!bmc || Object.keys(bmc).length === 0) {
    const errBlock = document.createElement('div');
    errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
    errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">需求逻辑构建需要商业模式画布 BMC，请先完成商业画布加载。</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
    container.appendChild(errBlock);
    pushAndSaveProblemDetailChat({ role: 'system', content: '需求逻辑构建需要商业模式画布 BMC，请先完成商业画布加载。', timestamp: getTimeStr() });
    return;
  }
  const loadingBlock = document.createElement('div');
  loadingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
  loadingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在基于最新客户初步需求、基本信息与 BMC 构建需求逻辑…</span></div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
  container.appendChild(loadingBlock);
  container.scrollTop = container.scrollHeight;
  try {
    const { content, usage, model, durationMs, fullPrompt, rawOutput } = await generateRequirementLogicFromInputs(preliminaryReq, basicInfo, bmc);
    loadingBlock.remove();
    const logicStr = (content || '').trim() || '（无返回内容）';
    const parsed = parseRequirementLogicFromMarkdown(logicStr);
    pushAndSaveProblemDetailChat(buildTask3LlmQueryMessage({
      fullPrompt: fullPrompt || '',
      parsed,
      rawOutput: rawOutput || logicStr,
      timestamp: getTimeStr(),
      usage,
      model,
      durationMs,
    }));
    pushOperationToHistory(item.createdAt, 'requirementLogic', JSON.parse(JSON.stringify(item)), __appState.problemDetailChatMessages.length);
    updateDigitalProblemRequirementLogic(item.createdAt, logicStr, false);
    __appState.currentProblemDetailItem = { ...item, requirementLogic: logicStr };
    const llmMeta = buildLlmMetaHtml({ usage, model, durationMs });
    const block = document.createElement('div');
    block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-requirement-logic-start problem-detail-chat-msg-with-delete';
    block.dataset.msgIndex = String(__appState.problemDetailChatMessages.length);
    const hasAnyContent = REQUIREMENT_LOGIC_SECTIONS.some(({ key }) => (parsed[key] || '').trim());
    const rows = hasAnyContent
      ? REQUIREMENT_LOGIC_SECTIONS.map(({ key, label }) => {
          const val = (parsed[key] || '').trim() || '—';
          return `<div class="problem-detail-basic-info-row"><span class="problem-detail-basic-info-label">${escapeHtml(label)}</span><span class="problem-detail-basic-info-value markdown-body">${renderMarkdown(val)}</span></div>`;
        }).join('')
      : `<div class="problem-detail-basic-info-row"><span class="problem-detail-basic-info-label">原始输出</span><span class="problem-detail-basic-info-value markdown-body">${renderMarkdown(logicStr)}</span></div>`;
    block.innerHTML = `
      <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
      <div class="problem-detail-basic-info-card" role="button" tabindex="0">
        <div class="problem-detail-basic-info-card-body">${rows}</div>
        <div class="problem-detail-basic-info-card-actions">
          <button type="button" class="btn-confirm-requirement-logic btn-confirm-primary">确认</button>
          <button type="button" class="btn-redo-requirement-logic">重做</button>
          <button type="button" class="btn-refine-modify" data-task-id="task3">修正</button>
          <button type="button" class="btn-refine-discuss" data-task-id="task3">讨论</button>
        </div>
      </div>
      <div class="problem-detail-chat-msg-time">${getTimeStr()}</div>${llmMeta}`;
    container.appendChild(block);
    setupProblemDetailRequirementLogicCardToggle(block);
    pushAndSaveProblemDetailChat({ type: 'requirementLogicBlock', content: logicStr, parsed, timestamp: getTimeStr(), confirmed: false, llmMeta: { usage, model, durationMs } });
    container.scrollTop = container.scrollHeight;
    renderProblemDetailContent();
  } catch (err) {
    loadingBlock.remove();
    const errBlock = document.createElement('div');
    errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
    errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">需求逻辑构建失败：${escapeHtml(err.message || String(err))}</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
    container.appendChild(errBlock);
    pushAndSaveProblemDetailChat({ role: 'system', content: '需求逻辑构建失败：' + (err.message || String(err)), timestamp: getTimeStr() });
  }
}

/** 从问题记录或聊天记录中解析出有效的端到端事务流 valueStream（支持 valueStream、valueStreams[0]、e2eFlowGeneratedLog） */
function resolveValueStreamForItGap(item) {
  let vs = item?.valueStream;
  if (vs && !vs.raw) return vs;
  const streams = item?.valueStreams;
  if (Array.isArray(streams) && streams.length > 0) {
    vs = streams[0];
    if (vs && !vs.raw) return vs;
  }
  const chats = item?.createdAt ? getProblemDetailChats()[item.createdAt] : null;
  if (Array.isArray(chats)) {
    for (let i = chats.length - 1; i >= 0; i--) {
      const m = chats[i];
      const json = m?.valueStreamJson ?? m?.value_stream_json;
      if (json && typeof json === 'object' && !json.raw) return json;
    }
  }
  return vs || null;
}

/** `item.valueStream` 若为 JSON 字符串则解析为对象，否则返回原对象引用 */
function parseValueStreamFieldMaybeJson(vs) {
  if (vs == null) return null;
  if (typeof vs === 'string') {
    const t = String(vs).trim();
    if (!t) return null;
    try {
      const p = JSON.parse(t);
      return p != null && typeof p === 'object' ? p : null;
    } catch (_) {
      return null;
    }
  }
  if (typeof vs === 'object') return vs;
  return null;
}

/** 工作区可绘制：非 raw、且价值流图有至少一个阶段 */
function isValueStreamWorkspaceDrawable(vs) {
  const o = parseValueStreamFieldMaybeJson(vs);
  if (!o || o.raw) return false;
  try {
    const { stages } = parseValueStreamGraph(o);
    return Array.isArray(stages) && stages.length > 0;
  } catch (_) {
    return false;
  }
}

/** 自后向前取最近一条可绘制的 `valueStreamCard.data`（task4；无 taskId 视为兼容旧消息） */
function extractLatestDrawableValueStreamFromChatMessages(messages) {
  const arr = Array.isArray(messages) ? messages : [];
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i];
    if (!m || m.type !== 'valueStreamCard') continue;
    const tid = m.taskId != null ? String(m.taskId) : '';
    if (tid && tid !== 'task4') continue;
    const data = m.data;
    if (!isValueStreamWorkspaceDrawable(data)) continue;
    return data;
  }
  return null;
}

/** 当前案优先用内存 `problemDetailChatMessages`，否则 localStorage 映射（与打开详情页加载聊天一致） */
function getProblemDetailMessagesForValueStreamItem(item) {
  if (!item) return [];
  const storageKey = typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
  const cur = __appState.currentProblemDetailItem;
  const isCurrent =
    cur &&
    storageKey &&
    typeof getProblemDetailChatStorageKey === 'function' &&
    getProblemDetailChatStorageKey(cur) === storageKey;
  if (isCurrent && Array.isArray(__appState.problemDetailChatMessages)) {
    return __appState.problemDetailChatMessages;
  }
  if (typeof getProblemDetailChats !== 'function') return [];
  const map = getProblemDetailChats();
  if (item.createdAt != null && Array.isArray(map[item.createdAt])) return map[item.createdAt];
  if (item.id != null && Array.isArray(map[item.id])) return map[item.id];
  return [];
}

/**
 * task4 工作流对齐工作区数据源：优先 `item.valueStream`（含 JSON 字符串），否则从聊天 `valueStreamCard` 还原（bundle 刷新覆盖后仍可见图）。
 */
function resolveValueStreamForWorkflowAlignWorkspace(item) {
  if (!item) return null;
  const fromItem = parseValueStreamFieldMaybeJson(item.valueStream);
  if (isValueStreamWorkspaceDrawable(fromItem)) return fromItem;
  return extractLatestDrawableValueStreamFromChatMessages(getProblemDetailMessagesForValueStreamItem(item));
}

/**
 * bundle 刷新等：`valueStream` 被后端省略或与内存不一致时，从消息列表回填可绘制数据。控制台 `[FE:valuestream-hydrate-from-chat]`；关闭：`globalThis.__FE_VS_HYDRATE_DEBUG = false`。
 */
function applyValueStreamHydrationFromMessages(item, messages, sourceTag) {
  if (!item) return item;
  const parsedVs = parseValueStreamFieldMaybeJson(item.valueStream);
  const next = parsedVs !== null && parsedVs !== item.valueStream ? { ...item, valueStream: parsedVs } : item;
  if (isValueStreamWorkspaceDrawable(next.valueStream)) return next;
  const fromChat = extractLatestDrawableValueStreamFromChatMessages(Array.isArray(messages) ? messages : []);
  if (!fromChat) return next;
  try {
    if (globalThis.__FE_VS_HYDRATE_DEBUG !== false) {
      console.info('[FE:valuestream-hydrate-from-chat]', sourceTag || 'apply', {
        caseId: item.id || item.createdAt,
        msgCount: Array.isArray(messages) ? messages.length : 0,
      });
    }
  } catch (_) {}
  return { ...next, valueStream: fromChat };
}

function parseStrictJsonObjectFromLlmText(text) {
  if (!text || typeof text !== 'string') return null;
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fencedMatch ? fencedMatch[1].trim() : text;
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  const jsonStr = (objectMatch ? objectMatch[0] : raw).trim();
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch (_) {
    return null;
  }
}

/** task9 对象状态机构建：大模型 system 提示（待处理数据在 user 消息中） */
const TASK9_OBJECT_STATE_MACHINE_SYSTEM_PROMPT = `# Role: 数字化架构建模专家 (REA + BMC 逻辑内核方向)
# Task: 基于商业模式与需求逻辑，生成**同一业务对象**的两份并行表达：（1）供前端 SVG 渲染的状态机 JSON；（2）供 Mermaid 渲染的状态图源码字符串。

## 1. 建模哲学与输入 (The Triple-Engine)
请交叉参考以下维度进行深度逻辑推演，但【不要输出】推演过程，仅将结果融入 JSON：
- **【BMC 锚点】**: 状态机必须支撑 [Value Propositions] 并在跳转中体现 [Revenue Streams]。
- **【Logic 动机】**: 必须识别 [隐性风险] 并设计对应的防御性状态分支（Risk Paths）。
- **【REA 框架】**: 每一个 Transition 必须回答：进入该状态付出了什么【对价 (Consideration)】以及留下了什么【存证 (Commitment)】。

## 2. 状态机 JSON 规范 (Schema Definition)
输出的 JSON 根对象必须包含以下结构：

### A. 资产元数据 (Resource Metadata)
- \`resource_metadata\` 对象：\`resource_id\`、\`icon_type\`（如 key, database, coin, certificate）、\`value_proposition\`（BMC 核心价值描述）。

### B. 状态节点 (States)
- \`states\` 数组，每项含：\`id\`、\`label\`、\`visual_tier\`（1:核心获利态, 2:中间流转态, 3:异常/风险态）、\`permissions\`（字符串数组）。

### C. 转换逻辑 (Transitions)
- \`transitions\` 数组：\`from\` / \`to\`、\`event\`、\`trigger_type\` (Manual | Chronos_Time | Financial)、\`is_risk_path\`、\`consideration\`（含 \`type\`: Money|Time|Quota|Evidence 与 \`description\`）、\`commitment_proof\`、\`animation_hint\` (flow | pulse | dash | shake)。

### D. Mermaid 状态图源码（与 JSON 严格同构）
- 根对象必须包含字符串字段 \`mermaid_diagram\`。
- 内容使用 **stateDiagram-v2**（或 **stateDiagram**），状态 id 与 JSON \`states[].id\` 一致；转移与 \`transitions\` 一一对应（含自环与风险路径）。
- 边上文字优先用 \`event\`；过长时可缩写但须可辨认。
- **禁止**在 \`mermaid_diagram\` 内使用 \`linkStyle\` / \`classDef\` / \`style\` 等易触发解析失败的指令；节点标签用简短中文或英文，避免未转义的特殊字符破坏语法。

## 3. 输出限制 (Strict Constraints)
- **NO PROSE**: 禁止输出任何开场白、解释性文字或结语。
- **PURE JSON**: 仅输出**一个**标准 JSON 对象（根上同时含 \`resource_metadata\`、\`states\`、\`transitions\`、\`mermaid_diagram\`）。
- **MECE**: 逻辑路径不重不漏，特别是时间过期和驳回路径。`;

/**
 * task9：拼装「待处理数据」用户消息（BMC / 需求逻辑 / 结构化初步需求）。
 * @param {object} item
 * @returns {string}
 */
function buildTask9ObjectStateMachineUserPrompt(item) {
  const bmc = item?.bmc != null ? item.bmc : null;
  let reqLogicPart = item?.requirementLogic;
  if (reqLogicPart != null && typeof reqLogicPart === 'object') {
    try {
      reqLogicPart = JSON.stringify(reqLogicPart, null, 2);
    } catch (_) {
      reqLogicPart = String(reqLogicPart);
    }
  } else if (reqLogicPart != null) {
    reqLogicPart = String(reqLogicPart);
  } else {
    reqLogicPart = 'null';
  }
  const prelim =
    typeof window.buildPreliminarySummaryJson === 'function' ? window.buildPreliminarySummaryJson(item) : item?.preliminaryReq ?? null;
  let prelimStr;
  try {
    prelimStr = JSON.stringify(prelim ?? null, null, 2);
  } catch (_) {
    prelimStr = '{}';
  }
  let bmcStr;
  try {
    bmcStr = JSON.stringify(bmc, null, 2);
  } catch (_) {
    bmcStr = '{}';
  }
  return [
    '## 4. 待处理数据',
    '- **BMC**:',
    bmcStr,
    '- **需求逻辑**:',
    reqLogicPart,
    '- **结构化需求**:',
    prelimStr,
    '',
    '## 5. 输出核对',
    '- 根对象须含 `mermaid_diagram` 字符串，且与 `states` / `transitions` 语义一致；前端 **json** Tab 仅展示不含 `mermaid_diagram` 的结构化副本；**mermaid** Tab 与 **Mermaid-View** 使用该字段正文。',
  ].join('\n');
}

/**
 * task9：任务启动通知确认后调用大模型生成状态机 JSON，落库、过程日志 LLM-查询块、聊天区完工确认。
 * @param {object} item
 */
async function runTask9ObjectStateMachineAfterStartConfirmed(item) {
  const chatContainer = el.problemDetailChatMessages;
  const persistKey =
    typeof getDigitalProblemPersistKey === 'function' ? getDigitalProblemPersistKey(item) : item?.createdAt || item?.id;
  if (persistKey == null || String(persistKey).trim() === '') return;

  const rerenderAll = () => {
    if (chatContainer) {
      chatContainer.innerHTML = '';
      renderProblemDetailChatFromStorage(chatContainer, __appState.problemDetailChatMessages);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    if (typeof renderProblemDetailHistory === 'function') renderProblemDetailHistory();
    if (typeof renderProblemDetailContent === 'function') renderProblemDetailContent();
    if (typeof updateProblemDetailChatHeaderLabel === 'function') updateProblemDetailChatHeaderLabel();
  };

  if (typeof hasAiConfig === 'function' && !hasAiConfig()) {
    pushAndSaveProblemDetailChat({
      role: 'system',
      content:
        '对象状态机构建需要先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）。',
      timestamp: getTimeStr(),
    });
    rerenderAll();
    return;
  }

  const systemPrompt = TASK9_OBJECT_STATE_MACHINE_SYSTEM_PROMPT;
  const userPrompt = buildTask9ObjectStateMachineUserPrompt(item);
  const llmInputPrompt = ['【系统】', systemPrompt, '', '【用户】', userPrompt].join('\n');

  if (chatContainer) {
    chatContainer.innerHTML = '';
    renderProblemDetailChatFromStorage(chatContainer, __appState.problemDetailChatMessages);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    const parsingBlock = document.createElement('div');
    parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
    parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">${escapeHtml(
      '正在生成对象状态机 JSON…',
    )}</span></div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
    chatContainer.appendChild(parsingBlock);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  try {
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { taskTag: 'task9' },
    );
    const raw = content != null ? String(content) : '';
    const parsed = parseStrictJsonObjectFromLlmText(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('模型返回无法解析为 JSON 对象');
    }
    if (typeof updateDigitalProblemObjectStateMachine === 'function') {
      updateDigitalProblemObjectStateMachine(persistKey, parsed);
    }
    const listAfter = typeof getDigitalProblems === 'function' ? getDigitalProblems() : [];
    const pk = String(persistKey);
    const freshItem = listAfter.find((it) => {
      const k =
        typeof getDigitalProblemPersistKey === 'function'
          ? String(getDigitalProblemPersistKey(it) || '').trim()
          : String(it.createdAt || it.id || '').trim();
      return k === pk;
    });
    if (freshItem) __appState.currentProblemDetailItem = { ...freshItem };

    pushAndSaveProblemDetailChat({
      type: 'task9LlmQueryBlock',
      taskId: 'task9',
      noteName: '对象状态机构建',
      stepName: '状态机 JSON + Mermaid',
      llmInputPrompt,
      llmOutputRaw: raw,
      llmMeta: { usage, model, durationMs },
      timestamp: getTimeStr(),
      confirmed: false,
    });

    const task9Name =
      (typeof ITGAP_HISTORY_TASKS !== 'undefined' && ITGAP_HISTORY_TASKS.find((t) => t.id === 'task9')?.name) ||
      '对象状态机构建';
    showTaskCompletionConfirm('task9', task9Name);
  } catch (err) {
    const msg = err && typeof err.message === 'string' ? err.message : String(err);
    pushAndSaveProblemDetailChat({
      role: 'system',
      content: `对象状态机构建：大模型调用或解析失败。${msg ? `（${msg}）` : ''}`,
      timestamp: getTimeStr(),
    });
  } finally {
    rerenderAll();
  }
}

/**
 * task8：session 行缺 designOutputJson / BPM 正文时，从已写入的 V1 全局聚合 `globalItGapAnalysisJson.transactions` 按事务对齐回填，
 * 避免「列表缓存仅有骨架、详情已合并聚合」或「仅聚合持久化成功」时重进案例子卡全是「待执行」。
 * @param {Array|undefined|null} sessions
 * @param {unknown} globalJson
 * @returns {Array}
 */
function overlayItDesignSupplementSessionsFromGlobalAggregate(sessions, globalJson) {
  if (!Array.isArray(sessions) || sessions.length === 0) return Array.isArray(sessions) ? sessions.slice() : [];
  let g = globalJson;
  if (g == null) return sessions.map((x) => (x && typeof x === 'object' ? { ...x } : x));
  if (typeof g === 'string') {
    const str = String(g).trim().replace(/^\uFEFF/, '');
    if (!str) return sessions.map((x) => (x && typeof x === 'object' ? { ...x } : x));
    try {
      g = JSON.parse(str);
    } catch (_) {
      return sessions.map((x) => (x && typeof x === 'object' ? { ...x } : x));
    }
  }
  if (!g || typeof g !== 'object' || Array.isArray(g)) {
    return sessions.map((x) => (x && typeof x === 'object' ? { ...x } : x));
  }
  if (g.itDesignSupplementV1 !== true) {
    return sessions.map((x) => (x && typeof x === 'object' ? { ...x } : x));
  }
  const txs = Array.isArray(g.transactions) ? g.transactions : [];
  if (txs.length === 0) {
    return sessions.map((x) => (x && typeof x === 'object' ? { ...x } : x));
  }
  return sessions.map((row, idx) => {
    if (!row || typeof row !== 'object') return row;
    const out = { ...row };
    const tx =
      txs.find(
        (t) =>
          t &&
          typeof t === 'object' &&
          out.transactionId != null &&
          out.transactionId !== '' &&
          t.transactionId === out.transactionId,
      ) ||
      txs.find((t) => t && typeof t === 'object' && Number(t.stepIndex) === Number(out.stepIndex)) ||
      txs[idx];
    if (!tx || typeof tx !== 'object') return out;
    if (out.designOutputJson == null && tx.design_output != null) {
      out.designOutputJson = { design_output: tx.design_output };
    }
    const md = tx.bpm_flow_diagram_markdown;
    if (
      (out.bpmFlowDrawMarkdown == null || String(out.bpmFlowDrawMarkdown).trim() === '') &&
      md != null &&
      String(md).trim() !== ''
    ) {
      out.bpmFlowDrawMarkdown = String(md);
    }
    return out;
  });
}
globalThis.overlayItDesignSupplementSessionsFromGlobalAggregate = overlayItDesignSupplementSessionsFromGlobalAggregate;

/**
 * task8：bundle 与内存/列表合并时按行保留较完整的 designOutputJson / bpmFlowDrawMarkdown（GET 滞后或空包时不丢已生成事务）。
 * @param {...(Array|undefined|null)} sources
 * @returns {Array|undefined}
 */
function mergeItDesignSupplementSessionsPreferProgress(...sources) {
  const defined = sources.filter((x) => x != null && Array.isArray(x));
  if (defined.length === 0) return undefined;
  const arrs = defined.filter((x) => x.length > 0);
  if (arrs.length === 0) return defined[0];
  const base = arrs.reduce((best, cur) => (cur.length > best.length ? cur : best));
  return base.map((baseRow, idx) => {
    let acc = baseRow && typeof baseRow === 'object' ? { ...baseRow } : {};
    for (const arr of arrs) {
      const row = arr[idx];
      if (!row || typeof row !== 'object') continue;
      if (row.stageName != null && acc.stageName == null) acc.stageName = row.stageName;
      if (row.transactionId != null && acc.transactionId == null) acc.transactionId = row.transactionId;
      if (row.transactionName != null && acc.transactionName == null) acc.transactionName = row.transactionName;
      if (row.stepIndex != null && acc.stepIndex == null) acc.stepIndex = row.stepIndex;
      if (row.designOutputJson != null && acc.designOutputJson == null) acc.designOutputJson = row.designOutputJson;
      const md = row.bpmFlowDrawMarkdown;
      if (md != null && String(md).trim() !== '') {
        if (acc.bpmFlowDrawMarkdown == null || String(acc.bpmFlowDrawMarkdown).trim() === '') {
          acc.bpmFlowDrawMarkdown = md;
        }
      }
    }
    return acc;
  });
}

async function runRolePermissionModeling(isRedo) {
  const container = el.problemDetailChatMessages;
  const item = __appState.currentProblemDetailItem;
  if (!container || !item?.createdAt) return;
  if (!hasAiConfig()) {
    const errBlock = document.createElement('div');
    errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
    errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">请先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）才能使用角色与权限模型推演功能。</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
    container.appendChild(errBlock);
    pushAndSaveProblemDetailChat({
      role: 'system',
      content: '请先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）才能使用角色与权限模型推演功能。',
      timestamp: getTimeStr(),
    });
    return;
  }
  const valueStream = item.valueStream;
  if (!valueStream || valueStream.raw) {
    const errBlock = document.createElement('div');
    errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
    errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">角色与权限模型推演需要完整的价值流图，请先在工作流对齐阶段完成价值流图绘制。</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
    container.appendChild(errBlock);
    pushAndSaveProblemDetailChat({
      role: 'system',
      content: '角色与权限模型推演需要完整的价值流图，请先在工作流对齐阶段完成价值流图绘制。',
      timestamp: getTimeStr(),
    });
    return;
  }
  const customerName = (item.customerName ?? item.customer_name ?? '').trim() || '该客户';
  const projectName = `${customerName} 数字化项目`;
  const vsmJson = JSON.stringify(valueStream, null, 2);
  const globalItGapJson = item.globalItGapAnalysisJson != null ? JSON.stringify(item.globalItGapAnalysisJson, null, 2) : '';
  let localItGapJson = '';
  if (item.roleTaskCenterPortalDesignJson != null && typeof item.roleTaskCenterPortalDesignJson === 'object') {
    const pr =
      typeof window.normalizeRoleTaskCenterPortalRoles === 'function'
        ? window.normalizeRoleTaskCenterPortalRoles(item.roleTaskCenterPortalDesignJson)
        : [];
    if (pr.length > 0) localItGapJson = JSON.stringify(item.roleTaskCenterPortalDesignJson, null, 2);
  }
  if (!localItGapJson) {
    localItGapJson =
      Array.isArray(item.localItGapAnalyses) && item.localItGapAnalyses.length > 0
        ? JSON.stringify(item.localItGapAnalyses, null, 2)
        : Array.isArray(item.localItGapSessions) && item.localItGapSessions.length > 0
          ? JSON.stringify(item.localItGapSessions, null, 2)
          : '';
  }
  let parsingBlock = null;
  if (!isRedo) {
    parsingBlock = document.createElement('div');
    parsingBlock.className =
      'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
    parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在推演角色与权限模型…</span></div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
    container.appendChild(parsingBlock);
    container.scrollTop = container.scrollHeight;
  } else {
    const lastCard = container.querySelector('.problem-detail-chat-role-permission-card');
    if (lastCard) {
      const body = lastCard.querySelector('.problem-detail-chat-role-permission-body');
      if (body) {
        body.innerHTML =
          '<div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在重新生成角色与权限模型推演结果…</span></div>';
      }
    }
  }
  try {
    const systemPrompt = `Role & Context:
我是一名软件公司的需求分析专家。我已经完成了客户业务的全链路价值流绘制，并详细标注了每个环节的 IT 现状及痛点标注（端到端事务流 json）、全局 itgap 分析json，对象状态机构建。

Task Goal:
请基于我提供的价值流逻辑，利用行业最佳实践（Industry Best Practices）模拟出一套高度匹配的角色与权限模型（RBAC Model）。这套模型将作为后续 IT 解决方案的底座。

重要说明：推演对象是价值流图中**每个阶段（stage）内的具体环节（step）节点**，不是按阶段聚合。即：遍历每个阶段下的每一个环节，对**每个环节**分别输出一条角色与权限推演结果。数组的每个元素对应**一个具体环节**。

Requirement Details:

角色画像模拟： 针对每个环节推演 1-2 个标准业务角色（如：高管、业务经办、风险控制官等），并定义其在该节点的核心业务使命。

现状转换映射： 深度对比该角色在"旧系统/线下纸质"与"新 IT 系统"中的操作差异。

痛点闭环设计： 权限设计必须直接对冲标注的痛点。例如：若痛点是"人工查验慢"，新权限应包含"系统自动准入校验权"；若痛点是"信息孤岛"，新权限应包含"跨模块数据透视权"。

初步需求与人员组织： 用户消息中可能包含初步需求卡片里的「核心业务流程梳理」与「人员组织模式」（来源：企业背景洞察→初步需求）。若「人员组织模式」中已有明确的企业角色定义（类型、称谓或岗位名单），则全量推演数组中各环节的 \`roles[].role_name\` 须以该定义为基准；**允许**在环节中**额外增加**支撑性角色；**禁止**删除、合并或更名致使初步需求已定义的人员角色在整个输出数组所覆盖的价值流中不再出现或无法一一对应（每个已定义角色须在至少一个环节的 \`roles\` 中出现且称谓与初步需求一致）。

合规与风控（SoD）： 识别关键节点中的职责分离要求（如：提报与审批、财务与出纳、采购与验收等角色的互斥逻辑）。

Output Format (Strict JSON):
请直接输出 JSON 数据，不要包含任何多余的解释文字。数组的每一项对应**一个具体环节（步骤）**，结构需包含如下字段：

[
  {
    "stage_name": "所属阶段名称（来自价值流阶段）",
    "step_id": "环节序号或标识",
    "step_name": "环节名称（该阶段内的具体步骤/环节名）",
    "it_gap_reference": "关联的 IT 现状与痛点简述",
    "roles": [
      {
        "role_name": "模拟角色名称",
        "legacy_operation": "现状/线下操作模式描述",
        "new_it_permissions": {
          "create": "boolean",
          "read": "string (权限范围：本人/本组/全行)",
          "update": "boolean",
          "delete": "boolean",
          "approve": "boolean"
        },
        "pain_point_solution": {
          "target_pain": "解决的具体痛点",
          "improvement_logic": "新权限/新功能如何从技术层面消除该痛点"
        },
        "trigger_logic": "该角色触发下一环节的操作逻辑或系统判别条件"
      }
    ],
    "sod_warning": "该环节的职责分离建议（如无则设为 null）"
  }
]`;
    const prelimOmRp =
      typeof globalThis.buildPreliminaryOperationModelTextForRolePermission === 'function'
        ? globalThis.buildPreliminaryOperationModelTextForRolePermission(item)
        : '';
    const userParts = [`我正在进行 ${projectName} 的 IT 解决方案设计。`];
    if (prelimOmRp) userParts.push(prelimOmRp, '');
    userParts.push('【端到端事务流 / 价值流】', vsmJson);
    if (globalItGapJson) {
      userParts.push('【IT设计补齐】');
      userParts.push(globalItGapJson);
    }
    if (localItGapJson) {
      userParts.push('【对象状态机构建】');
      userParts.push(localItGapJson);
    }
    userParts.push('\n请根据上述数据，直接输出符合 Output Format 的 JSON 数组，不要包含 markdown 代码块或其它说明文字。');
    const userPrompt = userParts.join('\n\n');
    const llmInputPromptForLog = `【系统】\n${systemPrompt}\n\n【用户】\n${userPrompt}`;
    const { content, usage, model, durationMs } = await fetchDeepSeekChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    if (parsingBlock) parsingBlock.remove();
    const llmMeta = { usage, model, durationMs, inputPromptSnapshot: llmInputPromptForLog };
    const parsedModel = parseRolePermissionModel(content || '');
    const hasStructured = Array.isArray(parsedModel) && parsedModel.length > 0;
    const structuredHtml = hasStructured ? buildRolePermissionNodeCardsHtml(parsedModel) : '';
    const llmMetaHtml = buildLlmMetaHtml(llmMeta);
    if (isRedo) {
      const lastCard = container.querySelector('.problem-detail-chat-role-permission-card');
      if (lastCard) {
        const body = lastCard.querySelector('.problem-detail-chat-role-permission-body');
        if (body) {
          body.innerHTML = hasStructured
            ? structuredHtml
            : `<div class="problem-detail-basic-info-card-body markdown-body">${renderMarkdown(
                content || ''
              )}</div>`;
        }
        lastCard.querySelector('.problem-detail-chat-msg-llm-meta')?.remove();
        const metaDiv = document.createElement('div');
        metaDiv.className = 'problem-detail-chat-msg-llm-meta';
        metaDiv.innerHTML = llmMetaHtml;
        lastCard.appendChild(metaDiv);
      }
      // 不重复追加消息，只更新最新一条 rolePermissionCard 的内容和元信息
      const idx = __appState.problemDetailChatMessages
        .slice()
        .reverse()
        .findIndex((m) => m.type === 'rolePermissionCard');
      if (idx >= 0) {
        const realIdx = __appState.problemDetailChatMessages.length - 1 - idx;
        __appState.problemDetailChatMessages[realIdx] = {
          ...__appState.problemDetailChatMessages[realIdx],
          content,
          llmMeta,
          llmInputPrompt: llmInputPromptForLog,
          llmOutputRaw: (content != null ? String(content) : '') || '',
        };
        saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
      }
    } else {
      const card = document.createElement('div');
      card.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-role-permission-card problem-detail-chat-msg-with-delete';
      card.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-basic-info-card problem-detail-role-permission-card-inner">
            <div class="problem-detail-basic-info-card-body problem-detail-chat-role-permission-body${
              hasStructured ? '' : ' markdown-body'
            }">
              ${
                hasStructured
                  ? structuredHtml
                  : renderMarkdown(content || '')
              }
            </div>
            <div class="problem-detail-basic-info-card-actions">
              <button type="button" class="btn-confirm-role-permission btn-confirm-primary">确认</button>
              <button type="button" class="btn-refine-modify">修正</button>
              <button type="button" class="btn-refine-discuss">讨论</button>
              <button type="button" class="btn-redo-role-permission">重做</button>
            </div>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${getTimeStr()}</div>
        ${llmMetaHtml}`;
      card.dataset.taskId = 'task10';
      container.appendChild(card);
      container.scrollTop = container.scrollHeight;
      pushAndSaveProblemDetailChat({
        type: 'rolePermissionCard',
        content,
        llmInputPrompt: llmInputPromptForLog,
        llmOutputRaw: (content != null ? String(content) : '') || '',
        timestamp: getTimeStr(),
        confirmed: false,
        llmMeta,
      });
      card.dataset.msgIndex = String(__appState.problemDetailChatMessages.length - 1);
      // 同时推送到过程日志：时间线为 LLM-查询 卡片（含输入/输出子卡片）
      if (typeof renderProblemDetailHistory === 'function') renderProblemDetailHistory();
    }
  } catch (err) {
    if (parsingBlock) parsingBlock.remove();
    const errBlock = document.createElement('div');
    errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
    errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">角色与权限模型推演失败：${escapeHtml(
      err.message || String(err)
    )}</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
    container.appendChild(errBlock);
    container.scrollTop = container.scrollHeight;
    pushAndSaveProblemDetailChat({
      role: 'system',
      content: '角色与权限模型推演失败：' + (err.message || String(err)),
      timestamp: getTimeStr(),
    });
  }
}

let lastConfirmedRolePermissionContentForRender = null;
/** 默认关闭；需诊断时在控制台执行 globalThis.__FE_ROLE_PERMISSION_DEBUG = true */
function feRolePermissionLog() {
  return typeof globalThis !== 'undefined' && !!globalThis.__FE_ROLE_PERMISSION_DEBUG;
}
/** 默认关闭；需诊断时在控制台执行 globalThis.__FE_CORE_BUSINESS_OBJECT_DEBUG = true */
function feCoreBusinessObjectLog() {
  return typeof globalThis !== 'undefined' && !!globalThis.__FE_CORE_BUSINESS_OBJECT_DEBUG;
}
function logCoreBusinessObject(...args) {
  if (feCoreBusinessObjectLog()) console.log('[核心业务对象]', ...args);
}

/** 将严格提示词的 business_objects 结构兜底归一化为 view 渲染所需 entities */
function normalizeCoreBusinessObjectFromStrictOutput(raw) {
  if (raw == null) return null;
  let parsed = raw;
  try {
    if (typeof raw === 'string') parsed = JSON.parse(raw);
  } catch (_) {
    // 宽松解析：支持 markdown 代码块或前后夹杂说明文字
    if (typeof raw === 'string') {
      const s = raw.trim();
      const codeBlock = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (codeBlock && codeBlock[1]) {
        try {
          parsed = JSON.parse(codeBlock[1].trim());
        } catch (_e1) {}
      }
      if (parsed === raw) {
        const startArr = s.indexOf('[');
        const endArr = s.lastIndexOf(']');
        if (startArr >= 0 && endArr > startArr) {
          try {
            parsed = JSON.parse(s.slice(startArr, endArr + 1));
          } catch (_e2) {}
        }
      }
      if (parsed === raw) {
        const startObj = s.indexOf('{');
        const endObj = s.lastIndexOf('}');
        if (startObj >= 0 && endObj > startObj) {
          try {
            parsed = JSON.parse(s.slice(startObj, endObj + 1));
          } catch (_e3) {}
        }
      }
    }
    if (parsed === raw) return null;
  }
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first || typeof first !== 'object') return null;
  if (Array.isArray(first.entities) && first.entities.length > 0) return first;
  const bos = Array.isArray(first.business_objects) ? first.business_objects : [];
  const skeletons = Array.isArray(first['核心骨架清单']) ? first['核心骨架清单'] : [];
  if (bos.length === 0 && skeletons.length === 0) return null;
  const entities = (bos.length > 0 ? bos : skeletons).map((bo) => {
    const fields = Array.isArray(bo?.key_attributes)
      ? bo.key_attributes.map((a) => ({
          field_name: a?.field ?? a?.field_name,
          type: a?.type ?? a?.data_type ?? 'string',
          description: a?.purpose ?? a?.description ?? '',
        }))
      : (Array.isArray(bo?.['嵌套子表模块'])
        ? bo['嵌套子表模块'].map((m) => ({
            field_name: String(m || ''),
            type: 'array',
            description: '嵌套子表模块',
          }))
        : []);
    const stateMachine = Array.isArray(bo?.lifecycle_machine)
      ? bo.lifecycle_machine.map((lm) => ({
          state: lm?.state_to ?? lm?.state_from ?? lm?.state ?? '—',
          description: [lm?.trigger_role, lm?.action].filter(Boolean).join(' '),
          transitions: lm?.state_to ? [lm.state_to] : [],
        }))
      : [];
    const relations = Array.isArray(bo?.associations)
      ? bo.associations.map((a) => ({
          target_entity: a?.target_object ?? a?.target_entity,
          relation_type: a?.relation_type ?? '—',
        }))
      : [];
    return {
      entity_name: bo?.object_name ?? bo?.entity_name ?? bo?.['对象中文名'],
      description: bo?.object_role ?? bo?.global_integration_note ?? bo?.['独立存在理由'] ?? '',
      object_role: bo?.object_role ?? bo?.['对象类型'] ?? '',
      object_usage:
        bo?.object_usage ??
        `业务功能：${bo?.['对象中文名'] || bo?.object_name || bo?.entity_name || '该对象'}。对冲Gap：${bo?.['设计理由']?.['对冲ITGap'] || '—'}。设计思路：${bo?.['设计理由']?.['设计思路'] || '—'}`,
      category: bo?.category ?? bo?.['对象类型'] ?? '',
      is_global_shared: bo?.is_global_shared,
      fields,
      state_machine: stateMachine,
      relations,
    };
  });
  return { ...first, entities };
}

/** 工作区环节标题栏：本环节已推演业务对象个数（与 view 中 entities 条数一致） */
function getCoreBusinessObjectEntityCountForWorkspaceStep(raw, cboMatch) {
  if (raw == null) return 0;
  if (cboMatch && Array.isArray(cboMatch.entities)) return cboMatch.entities.length;
  const n = typeof normalizeCoreBusinessObjectFromStrictOutput === 'function' ? normalizeCoreBusinessObjectFromStrictOutput(raw) : null;
  if (n && Array.isArray(n.entities)) return n.entities.length;
  if (typeof parseCoreBusinessObjectModel === 'function') {
    const parsed = parseCoreBusinessObjectModel(typeof raw === 'string' ? raw : JSON.stringify(raw));
    const first = Array.isArray(parsed) && parsed[0] ? parsed[0] : null;
    if (first && Array.isArray(first.entities)) return first.entities.length;
  }
  return 0;
}

/**
 * 工作区刷新动画：在重生成结果写回后，先提示“正在刷新页面”，再渲染新数据到工作区。
 * @param {string} [message]
 * @returns {Promise<void>}
 */
function refreshProblemDetailWorkspaceWithAnimation(message) {
  const contentEl = el.problemDetailContent;
  if (!contentEl) {
    renderProblemDetailContent();
    return Promise.resolve();
  }
  const host = el.problemDetailView || contentEl;
  const hostStyle = window.getComputedStyle(host);
  const needRelativeHost = hostStyle.position === 'static';
  if (needRelativeHost) host.style.position = 'relative';
  // 避免重复叠加遮罩
  host.querySelectorAll('.problem-detail-workspace-refresh-overlay').forEach((n) => n.remove());

  const REFRESH_OVERLAY_VISIBLE_MS = 1000;
  const REFRESH_OVERLAY_FADE_MS = 180;
  const overlay = document.createElement('div');
  overlay.className = 'problem-detail-workspace-refresh-overlay';
  overlay.innerHTML = `
    <div class="problem-detail-workspace-refresh-overlay-card">
      <span class="problem-detail-workspace-refresh-spinner" aria-hidden="true"></span>
      <span class="problem-detail-workspace-refresh-text">${escapeHtml(String(message || '正在刷新页面并加载最新数据…'))}</span>
    </div>
  `;
  host.appendChild(overlay);

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        renderProblemDetailContent();
        setTimeout(() => {
          overlay.classList.add('is-fade-out');
          setTimeout(() => {
            overlay.remove();
            if (needRelativeHost) host.style.position = '';
            resolve();
          }, REFRESH_OVERLAY_FADE_MS);
        }, REFRESH_OVERLAY_VISIBLE_MS);
      });
    });
  });
}

/**
 * 价值流结构中是否已有任一步的 IT 现状字段（用于展示门控：输出已写入即可显，不必等 workflowAlignCompletedStages 含 1）。
 */
function valueStreamHasAnyItStatus(valueStream) {
  if (!valueStream || typeof valueStream !== 'object' || !Array.isArray(valueStream.stages)) return false;
  for (const stage of valueStream.stages) {
    if (!stage || typeof stage !== 'object') continue;
    const stepsSource =
      stage.steps ??
      stage.tasks ??
      stage.phases ??
      stage.items ??
      stage.nodes ??
      [];
    const steps = Array.isArray(stepsSource) ? stepsSource : [];
    for (const step of steps) {
      if (!step || typeof step !== 'object') continue;
      if (step.itStatus != null || step.it_status != null) return true;
      if (step.itStatusLabel != null && String(step.itStatusLabel).trim() !== '') return true;
      const ip = step.itPlan ?? step.it_plan;
      if (ip && typeof ip === 'object' && String(ip.plan || '').trim() !== '') return true;
    }
  }
  return false;
}

/**
 * 工作流对齐阶段渲染门控：
 * - 未完成 task5（IT现状标注）前，不展示 step.itStatus；**但若 VS 已含 IT 现状数据则展示**（FE-20260325-03：wf 位不再随输出提前推进）。
 * - 未完成 task6（痛点标注）前，不展示 step.painPoint。
 * 仅用于工作区展示层，底层 valueStream 原始数据不改写。
 */
function buildWorkflowAlignDisplayValueStream(item, valueStream) {
  if (!item || !valueStream || typeof valueStream !== 'object' || !Array.isArray(valueStream.stages)) return valueStream;
  const wfCompleted = Array.isArray(item.workflowAlignCompletedStages) ? item.workflowAlignCompletedStages : [];
  const allowItStatus = wfCompleted.includes(1) || valueStreamHasAnyItStatus(valueStream);
  // 痛点显示策略（收敛版）：
  // - 未真正进入 task6 前一律隐藏（避免在 task5 阶段提前透出）；
  // - 进入 task6 的判定：出现 task6 启动/会话/输出痕迹；
  // - task6 完成后继续显示。
  const hasTask6Trace = Array.isArray(__appState.problemDetailChatMessages) && __appState.problemDetailChatMessages.some((m) => {
    if (!m) return false;
    const t = String(m.type || '');
    if (t === 'painPointStartBlock' || t === 'painPointSessionsBlock' || t === 'task6LlmQueryBlock' || t === 'painPointStepCard' || t === 'painPointAllDoneConfirmBlock') {
      return true;
    }
    if (m.role === 'system') {
      const c = String(m.content || '');
      if (c === '痛点标注完成' || c === '痛点标注完毕') return true;
    }
    return false;
  });
  const allowPainPoint = wfCompleted.includes(2) || hasTask6Trace;
  if (allowItStatus && allowPainPoint) return valueStream;
  const next = {
    ...valueStream,
    stages: valueStream.stages.map((stage) => {
      if (!stage || typeof stage !== 'object') return stage;
      const stepsSource =
        stage.steps ??
        stage.tasks ??
        stage.phases ??
        stage.items ??
        stage.nodes ??
        stage.children ??
        stage['环节'] ??
        stage['环节列表'] ??
        stage['节点'] ??
        stage['节点列表'] ??
        [];
      const steps = Array.isArray(stepsSource) ? stepsSource : [];
      return {
        ...stage,
        steps: steps.map((step) => {
          if (!step || typeof step !== 'object') return step;
          const copied = { ...step };
          if (!allowItStatus) {
            delete copied.itStatus;
            delete copied.it_status;
            delete copied.itStatusLabel;
            delete copied.itPlan;
            delete copied.it_plan;
          }
          if (!allowPainPoint) {
            delete copied.painPoint;
            delete copied.pain_point;
          }
          return copied;
        }),
      };
    }),
  };
  return next;
}

/** task11 顶部对象清单：渲染字段值（字符串走 markdown，对象/数组走 JSON） */
function formatCoreBusinessChecklistField(val) {
  if (val == null || (typeof val === 'string' && !val.trim())) return '<span class="problem-detail-core-business-object-empty">—</span>';
  if (typeof val === 'string') {
    return `<div class="problem-detail-core-business-object-field-content markdown-body">${renderMarkdown(val.trim())}</div>`;
  }
  if (typeof val === 'object') {
    return `<pre class="problem-detail-core-business-object-field-pre">${escapeHtml(JSON.stringify(val, null, 2))}</pre>`;
  }
  return escapeHtml(String(val));
}

/** task11 顶部对象清单：宽松解析单环节原始 JSON（兼容代码块/前后说明） */
function parseCoreBusinessObjectRawJsonLenient(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {}
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlock && codeBlock[1]) {
    try {
      return JSON.parse(codeBlock[1].trim());
    } catch (_) {}
  }
  const startObj = text.indexOf('{');
  const endObj = text.lastIndexOf('}');
  if (startObj >= 0 && endObj > startObj) {
    try {
      return JSON.parse(text.slice(startObj, endObj + 1));
    } catch (_) {}
  }
  const startArr = text.indexOf('[');
  const endArr = text.lastIndexOf(']');
  if (startArr >= 0 && endArr > startArr) {
    try {
      return JSON.parse(text.slice(startArr, endArr + 1));
    } catch (_) {}
  }
  return null;
}

/** task11 顶部对象清单：从单环节结构中提取对象列表 */
function extractCoreBusinessObjectItemsForWorkspace(raw, stepName) {
  const parsed = parseCoreBusinessObjectRawJsonLenient(raw);
  if (!parsed) return [];
  const normalizedStepName = String(stepName || '').trim();
  const collectFromOne = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    if (Array.isArray(obj['核心骨架清单']) && obj['核心骨架清单'].length > 0) {
      return obj['核心骨架清单']
        .filter((x) => x && typeof x === 'object')
        .map((x) => ({ ...x, 环节: (x['环节'] ?? obj['环节'] ?? normalizedStepName) || '—' }));
    }
    if (Array.isArray(obj.business_objects) && obj.business_objects.length > 0) {
      return obj.business_objects
        .filter((x) => x && typeof x === 'object')
        .map((x) => ({ ...x, 环节: (x['环节'] ?? obj['环节'] ?? normalizedStepName) || '—' }));
    }
    const objectName = obj['对象名'] ?? obj['对象中文名'] ?? obj.object_name ?? obj.entity_name ?? obj.name;
    if (objectName != null && String(objectName).trim()) {
      return [{ ...obj, 环节: (obj['环节'] ?? normalizedStepName) || '—' }];
    }
    return [];
  };
  if (Array.isArray(parsed)) return parsed.flatMap((one) => collectFromOne(one));
  return collectFromOne(parsed);
}

/** task11 顶部对象清单：按当前 sessions 汇总所有已生成对象 */
function collectCoreBusinessObjectItemsForWorkspaceFromSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];
  const out = [];
  sessions.forEach((s, i) => {
    const stepName = s?.stepName || `环节${i + 1}`;
    const list = extractCoreBusinessObjectItemsForWorkspace(s?.coreBusinessObjectJson, stepName);
    list.forEach((obj, j) => {
      out.push({ stepName, indexInStep: j, object: obj });
    });
  });
  return out;
}

/** 对象清单：名称规范化（去首尾空白、合并连续空格） */
function normalizeCoreBusinessObjectNameKey(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

/** 对象清单：稳定身份键（优先对象ID，否则对象名） */
function normalizeCoreBusinessObjectIdentityKeyFromObject(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const id = obj['对象ID'] ?? obj.object_id ?? obj.entity_id ?? obj.id;
  if (id != null && String(id).trim() !== '') return 'id:' + String(id).trim();
  const n =
    obj['对象名'] ?? obj['对象中文名'] ?? obj.object_name ?? obj.entity_name ?? obj.name;
  const ns = normalizeCoreBusinessObjectNameKey(n);
  return ns ? 'name:' + ns : '';
}

/** 当前行是否表示本环节「创建/定义」该对象（非仅引用上游存量） */
function rowSuggestsCreatedInThisStep(row) {
  if (!row || typeof row !== 'object') return true;
  if (row.is_newly_created === false || row['本环节新建'] === false) return false;
  const role = String(row.object_role ?? row['对象角色'] ?? '').trim();
  if (role === '关联引用') return false;
  if (role.includes('关联引用') && !role.includes('主产出') && !role.includes('环节主产出')) return false;
  return true;
}

/** 从骨架行中抽取其引用的上游对象名称（承接/关联/associations 等） */
function extractReferencedObjectNamesFromCoreBusinessRow(row) {
  const out = [];
  const pushOne = (v) => {
    if (v == null) return;
    if (typeof v === 'string') {
      const t = v.trim();
      if (!t) return;
      t.split(/[,，、;；\/|｜\n]+/).forEach((s) => {
        const x = normalizeCoreBusinessObjectNameKey(s);
        if (x) out.push(x);
      });
      return;
    }
    if (typeof v === 'object') {
      pushOne(v['父级对象'] ?? v.parent ?? v.target_object ?? v.target_entity ?? v.target);
    }
  };
  if (!row || typeof row !== 'object') return out;
  pushOne(row['承接对象名']);
  const stock = row['存量对象承接'];
  if (Array.isArray(stock)) {
    for (const h of stock) {
      if (h && typeof h === 'object') pushOne(h['承接对象名'] ?? h.object_name ?? h.entity_name);
    }
  }
  pushOne(row['关联引用']);
  const rel = row['关联关系'];
  if (rel && typeof rel === 'object') pushOne(rel['父级对象'] ?? rel['映射关系']);
  else pushOne(rel);
  const ass = row.associations;
  if (Array.isArray(ass)) {
    for (const a of ass) {
      if (a && typeof a === 'object') pushOne(a.target_object ?? a.target_entity);
    }
  }
  return [...new Set(out)];
}

/** 承接名 → 已登记对象的 identity key */
function resolveChecklistIdentityKeyForReferencedName(refNorm, nameToKey) {
  if (!refNorm) return '';
  if (nameToKey.has(refNorm)) return nameToKey.get(refNorm);
  for (const [n, k] of nameToKey) {
    if (n === refNorm) return k;
    if (n.includes(refNorm) || refNorm.includes(n)) return k;
  }
  return '';
}

function preferCoreBusinessObjectRowForChecklist(a, b) {
  const score = (o) => {
    if (!o || typeof o !== 'object') return 0;
    let s = 0;
    if (String(o['对象ID'] ?? o.object_id ?? '').trim()) s += 3;
    const n = String(o['对象名'] ?? o['对象中文名'] ?? o.object_name ?? '').trim();
    if (n) s += 1;
    return s + Object.keys(o).length * 0.01;
  };
  return score(b) > score(a) ? { ...b } : { ...a };
}

/**
 * 对象清单按身份去重：每个对象唯一被创建环节、可多被引用环节（FE-20260324-63）。
 * 创建：按 session 顺序首次满足「本环节新建」语义之行；引用：后续再出现或他行承接/关联指向该对象。
 */
function mergeCoreBusinessObjectChecklistByIdentity(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];
  const flat = [];
  sessions.forEach((s, i) => {
    const stepName = s?.stepName || `环节${i + 1}`;
    const list = extractCoreBusinessObjectItemsForWorkspace(s?.coreBusinessObjectJson, stepName);
    list.forEach((obj, j) => {
      flat.push({ stepName, indexInStep: j, object: obj });
    });
  });
  const byKey = new Map();
  const nameToKey = new Map();
  const registerNamesForKey = (key, obj) => {
    if (!obj || typeof obj !== 'object') return;
    const names = [obj['对象名'], obj['对象中文名'], obj.object_name, obj.entity_name, obj.name];
    for (const n of names) {
      const dn = normalizeCoreBusinessObjectNameKey(n);
      if (dn && !nameToKey.has(dn)) nameToKey.set(dn, key);
    }
  };
  for (const { stepName, object: row } of flat) {
    const key = normalizeCoreBusinessObjectIdentityKeyFromObject(row);
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, { object: { ...row }, createdStep: null, refSteps: new Set() });
    }
    const entry = byKey.get(key);
    entry.object = preferCoreBusinessObjectRowForChecklist(entry.object, row);
    registerNamesForKey(key, row);
    const suggestsCreate = rowSuggestsCreatedInThisStep(row);
    if (suggestsCreate && !entry.createdStep) entry.createdStep = stepName;
    else entry.refSteps.add(stepName);
  }
  for (const [key, entry] of byKey) {
    registerNamesForKey(key, entry.object);
  }
  for (let si = 0; si < sessions.length; si++) {
    const s = sessions[si];
    const stepName = s?.stepName || `环节${si + 1}`;
    const list = extractCoreBusinessObjectItemsForWorkspace(s?.coreBusinessObjectJson, stepName);
    for (const row of list) {
      for (const refNorm of extractReferencedObjectNamesFromCoreBusinessRow(row)) {
        const k = resolveChecklistIdentityKeyForReferencedName(refNorm, nameToKey);
        if (!k || !byKey.has(k)) continue;
        byKey.get(k).refSteps.add(stepName);
      }
    }
  }
  const result = [];
  for (const [, entry] of byKey) {
    const cs = entry.createdStep ? String(entry.createdStep).trim() : '';
    if (cs) entry.refSteps.delete(cs);
    const refs = [...entry.refSteps].filter(Boolean).sort();
    result.push({
      stepName: cs || String(entry.object['环节'] || '').trim(),
      indexInStep: 0,
      object: entry.object,
      createdStep: cs || '—',
      referencedSteps: refs,
    });
  }
  return result;
}

/** task11 顶部对象清单：对象卡标题数据（对象名 + 被创建环节） */
function getCoreBusinessObjectChecklistCardTitle(item, fallbackIdx) {
  const obj = item?.object;
  if (!obj || typeof obj !== 'object') return { objectName: `对象${fallbackIdx + 1}`, stepName: '', createdStep: '—' };
  const createdRaw = item?.createdStep != null ? String(item.createdStep).trim() : '';
  const createdStep = createdRaw || '—';
  const fallbackStep = String(item?.stepName || obj['环节'] || '').trim();
  const name = obj['对象名'] ?? obj['对象中文名'] ?? obj.object_name ?? obj.entity_name ?? obj.name;
  const objectName = (name != null && String(name).trim()) ? String(name).trim() : `对象${fallbackIdx + 1}`;
  const stepName = createdRaw && createdRaw !== '—' ? createdRaw : fallbackStep;
  return { objectName, stepName, createdStep };
}

/** task11 顶部「对象清单」可折叠卡（view/json） */
function buildCoreBusinessObjectChecklistCardHtml(items) {
  const list = Array.isArray(items) ? items : [];
  const checklistPlainTextKeys = new Set(['被创建环节', '被引用环节']);
  const pickChecklistObject = (it) => {
    const obj = it?.object && typeof it.object === 'object' ? it.object : {};
    const createdStep =
      it?.createdStep != null && String(it.createdStep).trim() !== ''
        ? String(it.createdStep).trim()
        : String(it?.stepName || obj['环节'] || '').trim() || '—';
    const refArr = Array.isArray(it?.referencedSteps) ? it.referencedSteps.filter(Boolean) : [];
    const 被引用环节 = refArr.length ? refArr.join('、') : '—';
    const objectName = obj['对象名'] ?? obj['对象中文名'] ?? obj.object_name ?? obj.entity_name ?? obj.name ?? '—';
    const objectId = obj['对象ID'] ?? obj.object_id ?? obj.entity_id ?? obj.id ?? '—';
    const relationRef = obj['关联引用'] ?? obj['关联关系'] ?? obj.relations ?? '—';
    const traceAnchor = obj['溯源锚点'] ?? obj.trace_anchor ?? obj['Project_ID'] ?? '—';
    return {
      被创建环节: createdStep,
      被引用环节,
      对象ID: objectId,
      关联引用: relationRef,
      溯源锚点: traceAnchor,
    };
  };

  const jsonData = list.map((it, idx) => ({ 序号: idx + 1, 对象名: getCoreBusinessObjectChecklistCardTitle(it, idx).objectName, ...pickChecklistObject(it) }));
  const viewCards = list.length
    ? list.map((it, idx) => {
        const obj = pickChecklistObject(it);
        const title = getCoreBusinessObjectChecklistCardTitle(it, idx);
        const sections = Object.entries(obj).filter(([k]) => k !== '对象名');
        const sectionHtml = sections.length
          ? sections.map(([k, v]) => `
              <div class="problem-detail-core-business-object-mini-view-item">
                <div class="problem-detail-core-business-object-mini-view-item-title">${escapeHtml(String(k))}</div>
                <div class="problem-detail-core-business-object-mini-view-item-body">${
                  checklistPlainTextKeys.has(k)
                    ? v != null && String(v).trim()
                      ? escapeHtml(String(v))
                      : '<span class="problem-detail-core-business-object-empty">—</span>'
                    : formatCoreBusinessChecklistField(v)
                }</div>
              </div>
            `).join('')
          : `
              <div class="problem-detail-core-business-object-mini-view-item">
                <div class="problem-detail-core-business-object-mini-view-item-title">内容</div>
                <div class="problem-detail-core-business-object-mini-view-item-body"><span class="problem-detail-core-business-object-empty">—</span></div>
              </div>
            `;
        return `
          <div class="problem-detail-core-business-object-mini-card">
            <div class="problem-detail-core-business-object-mini-card-title-row">
              <span class="problem-detail-core-business-object-mini-card-title">
                <span class="problem-detail-core-business-object-mini-card-title-object-name">${escapeHtml(title.objectName || `对象${idx + 1}`)}</span>
                <span class="problem-detail-core-business-object-mini-card-title-step">（被创建环节：${escapeHtml(title.createdStep || '—')}）</span>
              </span>
            </div>
            <div class="problem-detail-core-business-object-mini-card-body">${sectionHtml}</div>
          </div>
        `;
      }).join('')
    : '<div class="problem-detail-core-business-object-placeholder">暂无可展示的对象清单（请先完成至少一个环节推演）</div>';
  const jsonStr = JSON.stringify(jsonData, null, 2);
  return `
    <div class="problem-detail-card problem-detail-card-core-business-object problem-detail-card-core-business-object-checklist">
      <div class="problem-detail-card-header" tabindex="0" role="button" aria-expanded="true">
        <span class="problem-detail-card-header-title">对象清单（共 ${list.length} 个）</span>
        <span class="problem-detail-card-header-arrow">▾</span>
      </div>
      <div class="problem-detail-card-body">
        <div class="problem-detail-core-business-object-tabs">
          <span class="problem-detail-core-business-object-tabs-title">对象清单</span>
          <button type="button" class="problem-detail-core-business-object-tab problem-detail-core-business-object-tab-active" data-tab="view">view</button>
          <button type="button" class="problem-detail-core-business-object-tab" data-tab="json">json</button>
        </div>
        <div class="problem-detail-core-business-object-panel" data-panel="view">
          <div class="problem-detail-core-business-object-step-layout">
            <div class="problem-detail-core-business-object-mini-card-row">${viewCards}</div>
          </div>
        </div>
        <div class="problem-detail-core-business-object-panel" data-panel="json" hidden><pre class="problem-detail-core-business-object-json">${escapeHtml(jsonStr)}</pre></div>
      </div>
    </div>
  `;
}

function getLatestConfirmedRolePermissionContent(item) {
  if (typeof lastConfirmedRolePermissionContentForRender === 'string' && lastConfirmedRolePermissionContentForRender.trim()) {
    const content = lastConfirmedRolePermissionContentForRender;
    if (feRolePermissionLog()) console.log('[角色与权限] getLatestConfirmedRolePermissionContent: 使用刚确认的覆盖内容, 长度=', content.length);
    lastConfirmedRolePermissionContentForRender = null;
    return content;
  }
  const it = item || __appState.currentProblemDetailItem;
  const sessions = it?.rolePermissionSessions;
  if (Array.isArray(sessions) && sessions.some((s) => s.rolePermissionJson)) {
    const arr = [];
    for (const s of sessions) {
      if (!s.rolePermissionJson) continue;
      const j = typeof s.rolePermissionJson === 'object' ? s.rolePermissionJson : (() => { try { return JSON.parse(s.rolePermissionJson); } catch (_) { return null; } })();
      if (j) arr.push(j);
    }
    if (arr.length) {
      if (feRolePermissionLog()) console.log('[角色与权限] getLatestConfirmedRolePermissionContent: 从 rolePermissionSessions 聚合, 环节数=', arr.length);
      return JSON.stringify(arr);
    }
  }
  if (!Array.isArray(__appState.problemDetailChatMessages) || __appState.problemDetailChatMessages.length === 0) {
    if (feRolePermissionLog()) console.log('[角色与权限] getLatestConfirmedRolePermissionContent: 无消息列表, 返回 null');
    return null;
  }
  // FE-20260327-05：当详情对象中的 rolePermissionSessions 因刷新/回写延迟暂缺时，
  // 兜底从聊天区 rolePermissionAnalysisCard 聚合，避免 task11 工作区丢失「角色与权限模型推演」卡片。
  const latestByStepFromAnalysis = new Map();
  for (let i = __appState.problemDetailChatMessages.length - 1; i >= 0; i--) {
    const m = __appState.problemDetailChatMessages[i];
    if (m?.type !== 'rolePermissionAnalysisCard') continue;
    if (m?.content == null) continue;
    const raw = m.content;
    let parsed = null;
    if (typeof raw === 'object') parsed = raw;
    else {
      try {
        parsed = JSON.parse(String(raw));
      } catch (_) {
        parsed = null;
      }
    }
    if (!parsed || typeof parsed !== 'object') continue;
    const k =
      Number.isFinite(Number(m.stepIndex)) && Number(m.stepIndex) >= 0
        ? `i:${Number(m.stepIndex)}`
        : `n:${String(parsed.step_name ?? parsed.stage_name ?? '').trim()}`;
    if (!k || k === 'n:') continue;
    if (!latestByStepFromAnalysis.has(k)) latestByStepFromAnalysis.set(k, parsed);
  }
  if (latestByStepFromAnalysis.size > 0) {
    const merged = [...latestByStepFromAnalysis.entries()]
      .sort((a, b) => {
        const [ka] = a;
        const [kb] = b;
        const ia = ka.startsWith('i:') ? Number(ka.slice(2)) : Number.POSITIVE_INFINITY;
        const ib = kb.startsWith('i:') ? Number(kb.slice(2)) : Number.POSITIVE_INFINITY;
        if (ia !== ib) return ia - ib;
        return ka.localeCompare(kb);
      })
      .map(([, v]) => v);
    if (merged.length > 0) {
      if (feRolePermissionLog()) {
        console.log(
          '[角色与权限] getLatestConfirmedRolePermissionContent: 从 rolePermissionAnalysisCard 聚合, 环节数=',
          merged.length,
        );
      }
      return JSON.stringify(merged);
    }
  }
  for (let i = __appState.problemDetailChatMessages.length - 1; i >= 0; i--) {
    const m = __appState.problemDetailChatMessages[i];
    if (m && m.type === 'rolePermissionCard' && m.confirmed && typeof m.content === 'string') {
      if (feRolePermissionLog()) console.log('[角色与权限] getLatestConfirmedRolePermissionContent: 从消息列表找到已确认卡片, index=', i, 'content长度=', m.content.length);
      return m.content;
    }
  }
  if (feRolePermissionLog()) console.log('[角色与权限] getLatestConfirmedRolePermissionContent: 未找到已确认的 rolePermissionCard, 返回 null');
  return null;
}

/**
 * 工作区环节卡片标题栏：取该环节最新推演 JSON（优先会话存储，其次聊天区 rolePermissionAnalysisCard，最后 model 匹配项）。
 * @param {Object} item - 当前问题单
 * @param {number} stepIndex - 与价值流遍历顺序一致的全局环节下标
 * @param {Object|null} matchFromModel - 已从聚合 model 匹配到的单环节对象
 * @returns {Object|null}
 */
function getRolePermissionStepJsonForWorkspace(item, stepIndex, matchFromModel) {
  const sessions = item?.rolePermissionSessions;
  const si = Number(stepIndex);
  const s = Array.isArray(sessions) ? sessions.find((x) => Number(x.stepIndex) === si) : null;
  if (s?.rolePermissionJson != null) {
    const raw = s.rolePermissionJson;
    if (typeof raw === 'object' && raw !== null) return raw;
    try {
      return JSON.parse(String(raw));
    } catch (_) {}
  }
  if (Array.isArray(__appState.problemDetailChatMessages)) {
    for (let i = __appState.problemDetailChatMessages.length - 1; i >= 0; i--) {
      const m = __appState.problemDetailChatMessages[i];
      if (m?.type !== 'rolePermissionAnalysisCard') continue;
      if (Number(m.stepIndex) !== si) continue;
      if (m.content == null) continue;
      const c = m.content;
      if (typeof c === 'object') return c;
      try {
        return JSON.parse(String(c));
      } catch (_) {}
    }
  }
  return matchFromModel && typeof matchFromModel === 'object' ? matchFromModel : null;
}

/** 工作区「压缩 json」Tab：取该环节最近一次 localItGapCompressionBlock 的 compressedJson */
function getLocalItGapCompressedJsonForWorkspace(stepIndex) {
  if (!Array.isArray(__appState.problemDetailChatMessages)) return '';
  for (let i = __appState.problemDetailChatMessages.length - 1; i >= 0; i--) {
    const m = __appState.problemDetailChatMessages[i];
    if (m?.type !== 'localItGapCompressionBlock') continue;
    if (Number(m.stepIndex) !== Number(stepIndex)) continue;
    const raw = m.compressedJson;
    if (raw != null && String(raw).trim()) {
      const s = String(raw).trim();
      if (s !== 'null' && s !== 'undefined' && s !== '""') return String(raw);
    }
    const fallback = m.llmOutputRaw;
    if (fallback != null && String(fallback).trim()) return String(fallback);
  }
  return '';
}

/** 工作区「全局 ITGap 压缩 json」优先读案例字段；为空时回退最近一次 globalItGapCompressionBlock。 */
function getGlobalItGapCompressedJsonForWorkspace(item) {
  // [bridge] → core/task8-global-itgap.js (Phase 4A)
  return __t8().getGlobalItGapCompressedJsonForWorkspace(item);
}

async function runRolePermissionModelingForNextStep() {}
async function runRolePermissionModelingAutoSequential() {}

/** 与 storage getItem / adapter 对齐：按 createdAt 或 id 命中列表中的 case（FE-20260322-06） */
function findDigitalProblemCaseInList(item) {
  if (!item) return undefined;
  const key = String(item.createdAt || '');
  const id = String(item.id || '');
  return getDigitalProblems().find(
    (it) =>
      String(it.createdAt || '') === key ||
      (id && String(it.id || '') === id) ||
      (id && String(it.id || '') === key),
  );
}

function hasCoreBusinessObjectStepJson(session) {
  if (!session || session.coreBusinessObjectJson == null) return false;
  const j = session.coreBusinessObjectJson;
  if (typeof j === 'string') return j.trim() !== '';
  return true;
}

function mergeCoreBusinessObjectSessionsConservative(listSessions, curSessions, msgSessions) {
  const a = Array.isArray(listSessions) ? listSessions : [];
  const b = Array.isArray(curSessions) ? curSessions : [];
  const c = Array.isArray(msgSessions) ? msgSessions : [];
  const maxLen = Math.max(a.length, b.length, c.length, 0);
  const out = [];
  for (let i = 0; i < maxLen; i++) {
    const la = a[i];
    const lb = b[i];
    const lc = c[i];
    const base = {
      stepIndex: i,
      ...(la && typeof la === 'object' ? la : {}),
      ...(lc && typeof lc === 'object' ? lc : {}),
      ...(lb && typeof lb === 'object' ? lb : {}),
    };
    let pick;
    if (hasCoreBusinessObjectStepJson(lb)) pick = lb.coreBusinessObjectJson;
    else if (hasCoreBusinessObjectStepJson(la)) pick = la.coreBusinessObjectJson;
    else if (hasCoreBusinessObjectStepJson(lc)) pick = lc.coreBusinessObjectJson;
    else pick = undefined;
    out.push({
      ...base,
      stepIndex: i,
      coreBusinessObjectJson: pick,
    });
  }
  return out;
}

function resolveMergedCoreBusinessObjectSessions() {
  const cur = __appState.currentProblemDetailItem;
  if (!cur?.createdAt) return [];
  const list = getDigitalProblems();
  const listItem = list.find(
    (p) =>
      String(p.createdAt) === String(cur.createdAt) ||
      (cur.id && p.id && String(p.id) === String(cur.id)) ||
      (p.id && String(p.id) === String(cur.createdAt)),
  );
  const listS = extractTask11SessionsArray(listItem?.coreBusinessObjectSessions);
  const curS = extractTask11SessionsArray(cur?.coreBusinessObjectSessions);
  const msgIdx = __appState.problemDetailChatMessages.findLastIndex((m) => m.type === 'coreBusinessObjectSessionsBlock');
  const msgS = msgIdx >= 0 ? extractTask11SessionsArray(__appState.problemDetailChatMessages[msgIdx]?.sessions) : [];
  if (curS.length > 0) return curS;
  if (listS.length > 0) return listS;
  return msgS;
}

function countCoreBusinessObjectSessionsDone(sessions) {
  if (!Array.isArray(sessions)) return 0;
  return sessions.filter((s) => hasCoreBusinessObjectStepJson(s)).length;
}

function logTask11CboSessionsSnapshot(phase) {
  if (typeof globalThis === 'undefined' || !globalThis.__FE_TASK11_CBO_DEBUG) return;
  if (typeof console === 'undefined' || !console.log) return;
  const merged = resolveMergedCoreBusinessObjectSessions();
  console.log('[task11-cbo]', String(phase), { mergedDone: countCoreBusinessObjectSessionsDone(merged), mergedLen: merged.length });
}

async function runCoreBusinessObjectForNextStep() {}

async function runCoreBusinessObjectAutoSequential() {}


/** runItStatusAnnotation、generateItStatusAnnotation 已移至 js/task5ItStatus.js；runPainPointAnnotation、runPainPointAnnotationForNextStep 等已移至 js/task6PainPoint.js */

/** mergeItStatusIntoValueStream 已移至 js/task5ItStatus.js；mergePainPointIntoValueStream、runPainPointAnnotation 等已移至 js/task6PainPoint.js */

/** 聊天区 task10/task11 单环节推演卡片：将 content 格式化为可展示 JSON；兼容在线误存字面量「[object Object]」 */
function formatAnalysisStepCardJsonPreview(content) {
  if (content == null) return '';
  if (typeof content === 'string') {
    const s = content.trim();
    if (s === '[object Object]') {
      return '（本条因在线同步时误将 JSON 对象写成字符串，原始推演 JSON 已无法从此处恢复。请在该环节点击「重做」重新推演，或在沟通历史中查看该次任务的「过程日志」— LLM 输出。）';
    }
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      try {
        return JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        return content;
      }
    }
    return content;
  }
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

function renderProblemDetailChatFromStorage(container, messages) {
  const item = __appState.currentProblemDetailItem;
  const inferTaskId = typeof window.inferTaskIdFromMessage === 'function' ? window.inferTaskIdFromMessage : () => null;
  /** 持久化可为 ISO8601（online）或 yyyy-MM-dd HH:mm:ss（local），展示统一为本地可读格式 */
  const fmtChatTs = (ts) =>
    escapeHtml(typeof formatChatTime === 'function' ? formatChatTime(ts) : String(ts || ''));
  const list = Array.isArray(messages) ? messages : [];
  if (item && (typeof getWorkspaceViewingTaskId !== 'function' || getWorkspaceViewingTaskId() === 'task1')) {
    logTask1PrelimStatus('renderChat.entry', {
      caseKey: typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '',
      msgLength: list.length,
      waiting: problemDetailWaitingForFeedback
        ? {
            taskId: problemDetailWaitingForFeedback.taskId,
            type: problemDetailWaitingForFeedback.type,
            prelimSupplement: !!problemDetailWaitingForFeedback.prelimSupplement,
            prelimSupplementModify: !!problemDetailWaitingForFeedback.prelimSupplementModify,
            createdAt: problemDetailWaitingForFeedback.createdAt,
          }
        : null,
      stackTop: (() => {
        try {
          return String(new Error().stack || '').split('\n').slice(1, 3).join(' | ');
        } catch (_) {
          return '';
        }
      })(),
    });
  }
  list.forEach((msg, idx) => {
    const _taskId = inferTaskId(msg) || '';
    if (
      isProblemDetailChatCboUiSuppressed() &&
      (msg.type === 'coreBusinessObjectContextBlock' ||
        msg.type === 'coreBusinessObjectModificationRegenerateNotifyBlock' ||
        msg.type === 'coreBusinessObjectAnalysisCard' ||
        msg.type === 'coreBusinessObjectAllDoneBlock' ||
        msg.type === 'coreBusinessObjectSessionsBlock' ||
        msg.type === 'coreBusinessObjectGlobalAuditIntentBlock' ||
        msg.type === 'coreBusinessObjectGlobalAuditResultBlock')
    ) {
      return;
    }
    if (msg.type === 'taskStartNotification') {
      const taskName = msg.taskName || (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS).concat(IT_STRATEGY_TASKS).find((t) => t.id === msg.taskId)?.name) || msg.taskId;
      const taskStartNotifyLine =
        msg.taskId === 'task7'
          ? '任务通知：我即将开始端到端事务流构建任务'
          : `任务通知：我即将开始【${escapeHtml(taskName)}】任务`;
      const confirmed = (typeof isProblemResetState === 'function' && isProblemResetState(item)) ? false : !!msg.confirmed;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-task-start-notification';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${taskStartNotifyLine}</div>
          <div class="problem-detail-chat-task-start-notification-actions">
            <button type="button" class="btn-confirm-task-start btn-confirm-primary" data-task-id="${escapeHtml(msg.taskId || '')}" data-task-name="${escapeHtml(taskName)}" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'task1LlmQueryBlock') {
      // task1 初步需求 LLM-查询仅推送到沟通历史（输入/输出双子卡片），不在聊天区展示
      return;
    } else if (msg.type === 'globalArchitectureContextBlock') {
      return;
    } else if (msg.type === 'localItGapContextBlock') {
      return;
    } else if (msg.type === 'taskContextBlock') {
      /* 上下文内容块仅时间线展示，聊天区不渲染 */
      return;
    } else if (msg.type === 'bmcDiscussionEndBlock') {
      /* 讨论结束标记仅用于状态，聊天区不渲染 */
      return;
    } else if (msg.role === 'system' && typeof msg.content === 'string' && msg.content.trim() === '基本信息 json 提取完毕') {
      /* 基本信息 json 提取完毕不再在聊天区展示 */
      return;
    } else if (msg.type === 'taskCompletionConfirmBlock') {
      const taskId = msg.taskId || '';
      const taskName = msg.taskName || (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS).concat(IT_STRATEGY_TASKS).find((t) => t.id === taskId)?.name) || taskId;
      const resolvedItem = resolveProblemItemForTaskNotification() || __appState.currentProblemDetailItem;
      // FE-20260325-01 / FE-20260325-02：task2 不以「仅有 bmc」、task3 不以「仅有 requirementLogic」推断完成；完成确认块须与 completedStages / confirm 写回一致
      let taskAlreadyDoneFromState;
      if (taskId === 'task2') {
        taskAlreadyDoneFromState = !!(resolvedItem && Array.isArray(resolvedItem.completedStages) && resolvedItem.completedStages.includes(1));
      } else if (taskId === 'task3') {
        taskAlreadyDoneFromState = !!(resolvedItem && Array.isArray(resolvedItem.completedStages) && resolvedItem.completedStages.includes(2));
      } else if (taskId === 'task5') {
        // 仅 wf 含 1 视为 task5 真完成；避免与 isTaskCompleted 其它任务分支间接耦合（FE-20260325-04）
        taskAlreadyDoneFromState = !!(resolvedItem && Array.isArray(resolvedItem.workflowAlignCompletedStages) && resolvedItem.workflowAlignCompletedStages.includes(1));
      } else if (taskId === 'task8') {
        // task8：isTaskCompleted 已要求 V1 路径下「数据齐 + 用户完工确认」；仅在为真时禁用按钮（FE-20260408）
        taskAlreadyDoneFromState = !!(resolvedItem && isTaskCompleted(resolvedItem, 'task8'));
      } else {
        taskAlreadyDoneFromState = !!(resolvedItem && isTaskCompleted(resolvedItem, taskId));
      }
      const taskAlreadyDoneFromMessage = Array.isArray(messages) && messages.some((m) => m.type === 'taskCompleteBlock' && m.taskId === taskId);
      const confirmInFlight =
        (taskId === 'task2' || taskId === 'task3' || taskId === 'task4' || taskId === 'task5' || taskId === 'task6') &&
        !!msg.confirmInFlight;
      const taskAlreadyDone =
        !!msg.confirmed ||
        taskAlreadyDoneFromState ||
        taskAlreadyDoneFromMessage ||
        (taskId === 'task7' && !!msg.userChoseModify) ||
        (taskId === 'task9' && !!msg.userChoseModify) ||
        (taskId === 'task4' && !!msg.userChoseModify);
      const doneDisabled = confirmInFlight || taskAlreadyDone;
      const notYetDisabled = confirmInFlight || taskAlreadyDone;
      const doneLabel = confirmInFlight ? '提交中…' : '已完成';
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-task-completion-confirm';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || `【${taskName}】是否视为完成？`)}</div>
          <div class="problem-detail-chat-task-completion-actions">
            <button type="button" class="btn-task-complete-done btn-confirm-primary" data-task-id="${escapeHtml(taskId)}" data-task-name="${escapeHtml(taskName)}" ${doneDisabled ? 'disabled' : ''}>${escapeHtml(doneLabel)}</button>
            <button type="button" class="btn-task-complete-not-yet" ${notYetDisabled ? 'disabled' : ''}>请修改</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'preliminaryRequirementMergeSessionPlanBlock') {
      const confirmed = !!msg.confirmed;
      const planStatus = String(msg.status || 'pending');
      const sessions = Array.isArray(msg.sessions) ? msg.sessions : [];
      const sessionsHtml = sessions
        .map((s, i) => {
          const st = String(s?.status || 'pending');
          const stText = st === 'done' ? '已完成' : st === 'skipped' ? '已跳过' : st === 'running' ? '进行中' : '待执行';
          const stClass = st === 'done'
            ? 'session-done prelim-session-done'
            : st === 'skipped'
              ? 'session-done'
              : st === 'running'
                ? 'session-running'
                : 'session-pending';
          const subCls =
            Number.isInteger(s?.stmRowIndex) ||
            s?.stmMergePhase === 'appendNewEntities' ||
            s?.stmMergePhase === 'mergeEntity'
              ? ' prelim-merge-stm-subtask'
              : '';
          return `<div class="problem-detail-chat-local-itgap-session-item${subCls}"><span class="problem-detail-chat-local-itgap-session-name">${escapeHtml(`${i + 1}. ${s?.label || s?.key || '子任务'}`)}</span><span class="problem-detail-chat-local-itgap-session-status ${stClass}">${escapeHtml(stText)}</span></div>`;
        })
        .join('');
      const btnLabel = confirmed ? (planStatus === 'done' ? '已完成' : planStatus === 'failed' ? '执行失败' : '执行中…') : '确认';
      const btnDisabled = confirmed ? 'disabled' : '';
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-local-itgap-sessions-card problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-local-itgap-sessions-card-wrap">
          <div class="problem-detail-chat-local-itgap-sessions-card-header">初步需求更新 Session 计划</div>
          <div class="problem-detail-chat-local-itgap-sessions-card-body">
            <div class="problem-detail-chat-local-itgap-sessions-header">${escapeHtml(msg.content || '')}</div>
            <div class="problem-detail-chat-local-itgap-sessions-list">${sessionsHtml}</div>
          </div>
          <div class="problem-detail-chat-local-itgap-sessions-actions">
            <button type="button" class="btn-confirm-prelim-merge-session-plan btn-confirm-primary" ${btnDisabled}>${escapeHtml(btnLabel)}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'preliminaryRequirementFollowupBlock') {
      const taskIdFollow = msg.taskId || 'task1';
      const actionsEnabled = isLatestPreliminaryRequirementFollowupBlock(list, idx);
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-preliminary-followup';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '')}</div>
          <div class="problem-detail-chat-preliminary-followup-actions">
            <button type="button" class="btn-prelim-supplement-continue btn-confirm-primary" data-task-id="${escapeHtml(taskIdFollow)}" ${actionsEnabled ? '' : 'disabled'}>补充更多需求</button>
            <button type="button" class="btn-prelim-supplement-modify" ${actionsEnabled ? '' : 'disabled'}>对补充内容修改</button>
            <button type="button" class="btn-prelim-feedback-done" ${actionsEnabled ? '' : 'disabled'}>没有更多补充</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'plusRequirementResetConfirmBlock') {
      const res = msg.resolution ? String(msg.resolution) : '';
      const resolved = res === 'cancelled' || res === 'confirmed';
      const actionsEnabled = !resolved && isLatestPendingPlusRequirementResetConfirmBlock(list, idx);
      let statusLine = '';
      if (res === 'cancelled') statusLine = '<div class="problem-detail-chat-plus-requirement-reset-status">已取消</div>';
      else if (res === 'confirmed') statusLine = '<div class="problem-detail-chat-plus-requirement-reset-status">已确认</div>';
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-plus-requirement-reset';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || PLUS_REQUIREMENT_RESET_CONFIRM_CONTENT)}</div>
          ${statusLine}
          <div class="problem-detail-chat-plus-requirement-reset-actions">
            <button type="button" class="btn-plus-requirement-reset-cancel" ${actionsEnabled ? '' : 'disabled'}>取消</button>
            <button type="button" class="btn-plus-requirement-reset-confirm btn-confirm-primary" ${actionsEnabled ? '' : 'disabled'}>确定</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'preliminaryRequirementModificationSummaryBlock') {
      const md = msg.summaryMarkdown != null ? String(msg.summaryMarkdown) : '';
      const sumHtml =
        typeof window.renderMarkdown === 'function' ? window.renderMarkdown(md) : escapeHtml(md);
      const feedback = msg.userModificationFeedback != null ? String(msg.userModificationFeedback).trim() : '';
      const feedbackLine =
        feedback !== ''
          ? `<div class="problem-detail-chat-prelim-mod-user-feedback"><span class="problem-detail-chat-prelim-mod-user-feedback-label">您的修改意见</span><span class="problem-detail-chat-prelim-mod-user-feedback-text">${escapeHtml(feedback)}</span></div>`
          : '';
      const hasPendingApply =
        msg.mergedPreliminaryReq &&
        typeof msg.mergedPreliminaryReq === 'object' &&
        !msg.confirmed &&
        isLatestPendingPreliminaryRequirementModSummaryBlock(list, idx);
      const appliedLine = msg.confirmed
        ? '<div class="problem-detail-chat-prelim-mod-applied">已更新初步需求工作区（view / json）。</div>'
        : '';
      const actionsHtml = hasPendingApply
        ? `<div class="problem-detail-chat-prelim-mod-summary-actions">
            <button type="button" class="btn-prelim-mod-summary-confirm btn-confirm-primary">确认更新工作区</button>
          </div>`
        : '';
      const hintHtml = hasPendingApply
        ? '<div class="problem-detail-chat-prelim-mod-proposal-hint">以下为模型整理的修改摘要，确认后将写入工作区初步需求（view 与 json）。</div>'
        : '';
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-preliminary-mod-summary';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          ${hintHtml}
          ${feedbackLine}
          <div class="problem-detail-chat-msg-content problem-detail-chat-prelim-summary-md">${sumHtml}</div>
          ${appliedLine}
          ${actionsHtml}
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'taskCompleteBlock') {
      // 任务完成仅写入过程日志，不在聊天区展示
      return;
    } else if (msg.type === 'globalItGapContextLog') {
      // 全局 ITGap 上下文仅推送到沟通历史（标签「上下文」），不在聊天区展示卡片
      return;
    } else if (msg.type === 'task8LlmQueryBlock') {
      // 全局 ITGap LLM-查询块仅推送到沟通历史（输入/输出双子卡片），不在聊天区展示
      return;
    } else if (msg.type === 'globalItGapCompressionBlock') {
      // 全局 ITGap 架构约束底座 LLM-压缩块仅推送到沟通历史（输入/输出双子卡片），不在聊天区展示
      return;
    } else if (msg.type === 'task9LlmQueryBlock') {
      // 局部 ITGap LLM-查询块仅推送到沟通历史（输入/输出双子卡片），不在聊天区展示
      return;
    } else if (msg.type === 'task7LlmQueryBlock') {
      // task7 分阶段事务流：过程日志 LLM-查询双子卡，不在主聊天区展示
      return;
    } else if (msg.type === 'task10LlmQueryBlock') {
      // task10 按环节角色与权限推演：过程日志 LLM-查询双子卡，不在聊天区展示（FE-20260329-09）
      return;
    } else if (msg.type === 'task11LlmQueryBlock') {
      // 核心业务对象推演 LLM-查询块仅推送到沟通历史（输入/输出双子卡片），不在聊天区展示
      return;
    } else if (
      msg.type === 'task11GlobalSkeletonAuditLlmQueryBlock' ||
      msg.type === 'task11CoreBusinessObjectAuditLlmQueryBlock' ||
      msg.type === 'rolePermissionAuditLlmQueryBlock'
    ) {
      // 全局骨架审计 / task10 角色权限合规审计：仅过程日志 LLM-审计双子卡，不在聊天区展示
      return;
    } else if (msg.type === 'coreBusinessObjectContextBlock') {
      // 核心业务对象推演上下文仅推送到沟通历史（标签「上下文」），不在聊天区展示
      return;
    } else if (msg.type === 'localItGapContextLog') {
      // 局部 ITGap 上下文仅推送到沟通历史（标签「上下文」+ 备注），不在聊天区展示卡片
      return;
    } else if (msg.type === 'valueStreamConfirmLog') {
      // 价值流确认仅写入过程日志，不在聊天区展示
      return;
    } else if (msg.type === 'itStatusOutputLog') {
      // IT 现状标注输出仅写入过程日志，不在聊天区展示
      return;
    } else if (msg.type === 'modificationPromptRevisionLlmQueryBlock') {
      // 修改链路·新提示词生成 LLM-查询仅推送到沟通历史过程日志，不在聊天区展示
      return;
    } else if (msg.type === 'modificationRegenerateLlmQueryBlock') {
      // 修改链路·按新提示词重新生成 LLM-查询仅推送到沟通历史过程日志，不在聊天区展示
      return;
    } else if (msg.type === 'rolePermissionModificationLlmQueryBlock') {
      // task10 修改链路·逐环节重生成过程日志，仅在沟通历史展示（LLM-修改）
      return;
    } else if (msg.type === 'coreBusinessObjectModificationRegenerateNotifyBlock') {
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-modification-revision problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = 'task12';
      const bodyText =
        String(msg.content || '').trim() || '我将按新提示词重新进行【核心业务对象推演】。请点击「确认」后继续。';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(bodyText)}</div>
          <div class="problem-detail-chat-basic-info-card-actions problem-detail-chat-modification-regenerate-actions">
            <button type="button" class="btn-confirm-core-business-object-mod-regenerate-phase2 btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'painPointModificationRegenerateNotifyBlock') {
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-modification-revision problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = 'task6';
      const bodyText =
        String(msg.content || '').trim() || '即将按新提示词重新生成【痛点标注】session计划。请点击「确认」后继续。';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(bodyText)}</div>
          <div class="problem-detail-chat-basic-info-card-actions problem-detail-chat-modification-regenerate-actions">
            <button type="button" class="btn-confirm-pain-point-mod-regenerate-phase2 btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'itStatusModificationRegenerateNotifyBlock') {
      const confirmedIs = !!msg.confirmed;
      const blockIs = document.createElement('div');
      blockIs.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-modification-revision problem-detail-chat-msg-with-delete';
      blockIs.dataset.msgIndex = String(idx);
      blockIs.dataset.taskId = 'task5';
      const bodyTextIs =
        String(msg.content || '').trim() ||
        '将按新提示词重新进行 IT 现状标注。请点击「确认」后加载 Session 计划，再在计划卡片上点击「自动顺序执行」。';
      blockIs.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(bodyTextIs)}</div>
          <div class="problem-detail-chat-basic-info-card-actions problem-detail-chat-modification-regenerate-actions">
            <button type="button" class="btn-confirm-it-status-mod-regenerate-phase2 btn-confirm-primary" ${confirmedIs ? 'disabled' : ''}>${confirmedIs ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(blockIs);
    } else if (msg.type === 'valueStreamModificationRegenerateNotifyBlock') {
      const confirmedVs = !!msg.confirmed;
      const blockVsMod = document.createElement('div');
      blockVsMod.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-modification-revision problem-detail-chat-msg-with-delete';
      blockVsMod.dataset.msgIndex = String(idx);
      blockVsMod.dataset.taskId = 'task4';
      const bodyVsMod =
        String(msg.content || '').trim() ||
        '将按新提示词重新绘制价值流。请点击「确认」后清空工作区价值流并下发 Session 计划，再在计划卡片上点击「自动顺序执行」。';
      blockVsMod.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(bodyVsMod)}</div>
          <div class="problem-detail-chat-basic-info-card-actions problem-detail-chat-modification-regenerate-actions">
            <button type="button" class="btn-confirm-value-stream-mod-regenerate-phase2 btn-confirm-primary" ${confirmedVs ? 'disabled' : ''}>${confirmedVs ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(blockVsMod);
    } else if (msg.type === 'modificationNewPromptConfirmBlock') {
      const taskId = msg.taskId || '';
      const llmMetaFirst = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-modification-revision problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = taskId;
      const raw = msg.firstRoundRaw != null ? String(msg.firstRoundRaw) : '';
      const task4Dual =
        taskId === 'task4' &&
        (msg.task4MirrorNewSystemPrompt != null || msg.task4HardeningNewSystemPrompt != null);
      const newPromptDetails = task4Dual
        ? `<div class="problem-detail-chat-modification-revision-section">
            <div class="problem-detail-chat-modification-revision-label">第一阶段 Mirror · 新版本对老版本的修改</div>
            <div class="problem-detail-chat-msg-content markdown-body">${renderMarkdown(msg.task4MirrorVersionChangelog || '—')}</div>
          </div>
          <details class="problem-detail-chat-modification-revision-raw"><summary>第一阶段 Mirror · 新提示词（待确认后注入 Mirror 轮次）</summary><pre class="problem-detail-chat-modification-revision-pre problem-detail-chat-modification-revision-pre--terminal">${escapeHtml(msg.task4MirrorNewSystemPrompt || '')}</pre></details>
          <div class="problem-detail-chat-modification-revision-section">
            <div class="problem-detail-chat-modification-revision-label">第二阶段 分阶段加固 · 新版本对老版本的修改</div>
            <div class="problem-detail-chat-msg-content markdown-body">${renderMarkdown(msg.task4HardeningVersionChangelog || '—')}</div>
          </div>
          <details class="problem-detail-chat-modification-revision-raw"><summary>第二阶段 分阶段加固 · 新提示词（待确认后注入各 L1 加固轮次）</summary><pre class="problem-detail-chat-modification-revision-pre problem-detail-chat-modification-revision-pre--terminal">${escapeHtml(msg.task4HardeningNewSystemPrompt || '')}</pre></details>`
        : `<details class="problem-detail-chat-modification-revision-raw"><summary>\u65b0\u63d0\u793a\u8bcd\uff08\u5f85\u786e\u8ba4\u540e\u5c06\u7528\u4e8e\u91cd\u65b0\u751f\u6210\uff09</summary><pre class="problem-detail-chat-modification-revision-pre problem-detail-chat-modification-revision-pre--terminal">${escapeHtml(msg.newSystemPrompt || '')}</pre></details>`;
      const rawDetails = task4Dual
        ? [
            msg.task4MirrorFirstRoundRaw
              ? `<details class="problem-detail-chat-modification-revision-raw"><summary>查看首轮模型原始返回（Mirror 修订）</summary><pre class="problem-detail-chat-modification-revision-pre problem-detail-chat-modification-revision-pre--terminal">${escapeHtml(String(msg.task4MirrorFirstRoundRaw))}</pre></details>`
              : '',
            msg.task4HardeningFirstRoundRaw
              ? `<details class="problem-detail-chat-modification-revision-raw"><summary>查看首轮模型原始返回（分阶段加固修订）</summary><pre class="problem-detail-chat-modification-revision-pre problem-detail-chat-modification-revision-pre--terminal">${escapeHtml(String(msg.task4HardeningFirstRoundRaw))}</pre></details>`
              : '',
          ]
            .filter(Boolean)
            .join('')
        : raw
          ? `<details class="problem-detail-chat-modification-revision-raw"><summary>\u67e5\u770b\u9996\u8f6e\u6a21\u578b\u539f\u59cb\u8fd4\u56de</summary><pre class="problem-detail-chat-modification-revision-pre problem-detail-chat-modification-revision-pre--terminal">${escapeHtml(raw)}</pre></details>`
          : '';
      const changelogAppendNote =
        '确认后还会将各阶段「新版本对老版本的修改」全文追加进该阶段实际使用的 system，与对应「新提示词」一并进入后续大模型调用（避免变更说明与正文脱节）。';
      const modRegenerateHint =
        taskId === 'task5'
          ? `已生成新的 IT 现状标注提示词，将用于后续逐环节重新标注。请点击「确认」后，系统将弹出二次说明；再确认后将下发 Session 计划（列出全部价值流环节）。在计划卡片上点击「自动顺序执行」时，会先清空工作区当前 IT 现状/IT 计划，再按新提示词逐环节重新标注。${changelogAppendNote}`
          : taskId === 'task6'
            ? `已生成新的痛点标注提示词。请点击「确认」后继续二次说明与按新提示词重跑 Session。${changelogAppendNote}`
            : taskId === 'task4'
              ? task4Dual
                ? `已分别优化第一阶段 Mirror 与第二阶段分阶段加固的注入提示词；上表分两阶段展示变更说明与全文。请点击「确认」后查看二次说明；再确认后将清空当前工作区价值流并按新提示词重新下发 Session 计划，在计划卡片上「自动顺序执行」。${changelogAppendNote}`
                : `已生成新的价值流绘制提示词。展开「新提示词」可查看正文；若其中含「【系统】」「【用户】」分段，重跑时系统段与用户段将分别注入（与单段全文不同）。${changelogAppendNote}请点击「确认」后按二次说明重新下发 Session 计划并「自动顺序执行」。`
              : taskId === 'task11' || taskId === 'task12'
                ? `已生成新的核心业务对象推演提示词。请点击「确认」后继续。${changelogAppendNote}`
                : `将按新提示词重新生成或继续后续步骤。${changelogAppendNote}`;
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content problem-detail-chat-modification-revision-title">提示词修订结果</div>
          ${
            task4Dual
              ? ''
              : `<div class="problem-detail-chat-modification-revision-section">
            <div class="problem-detail-chat-modification-revision-label">新版本对老版本的修改</div>
            <div class="problem-detail-chat-msg-content markdown-body">${renderMarkdown(msg.versionChangelog || '—')}</div>
          </div>`
          }
          ${newPromptDetails}
          ${rawDetails}
          <div class="problem-detail-chat-modification-regenerate-hint problem-detail-chat-msg-content">${escapeHtml(modRegenerateHint)}</div>
          <div class="problem-detail-basic-info-card-actions problem-detail-chat-modification-regenerate-actions">
            <button type="button" class="btn-confirm-modification-regenerate-prompt btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaFirst}`;
      container.appendChild(block);
    } else if (msg.type === 'modificationPromptRevisionBlock') {
      const taskId = msg.taskId || '';
      const llmMetaFirst = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-modification-revision problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = taskId;
      const raw = msg.firstRoundRaw != null ? String(msg.firstRoundRaw) : '';
      const newPromptDetailsHist = `<details class="problem-detail-chat-modification-revision-raw"><summary>\u65b0\u63d0\u793a\u8bcd</summary><pre class="problem-detail-chat-modification-revision-pre problem-detail-chat-modification-revision-pre--terminal">${escapeHtml(msg.newSystemPrompt || '')}</pre></details>`;
      const rawDetails = raw
        ? `<details class="problem-detail-chat-modification-revision-raw"><summary>\u67e5\u770b\u9996\u8f6e\u6a21\u578b\u539f\u59cb\u8fd4\u56de</summary><pre class="problem-detail-chat-modification-revision-pre problem-detail-chat-modification-revision-pre--terminal">${escapeHtml(raw)}</pre></details>`
        : '';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content problem-detail-chat-modification-revision-title">提示词修订（历史记录）</div>
          <div class="problem-detail-chat-modification-revision-section">
            <div class="problem-detail-chat-modification-revision-label">新版本对老版本的修改</div>
            <div class="problem-detail-chat-msg-content markdown-body">${renderMarkdown(msg.versionChangelog || '—')}</div>
          </div>
          ${newPromptDetailsHist}
          ${rawDetails}
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaFirst}`;
      container.appendChild(block);
    } else if (
      msg.type === 'modificationResponseBlock' ||
      msg.type === 'rolePermissionModificationActionBlock' ||
      msg.type === 'task5ModificationActionBlock'
    ) {
      const taskId = msg.taskId || '';
      const taskName = (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS).concat(IT_STRATEGY_TASKS).find((t) => t.id === taskId) || {}).name || taskId;
      const confirmed = !!msg.confirmed;
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const isRpModAction = msg.type === 'rolePermissionModificationActionBlock';
      const isTask5ModAction = msg.type === 'task5ModificationActionBlock';
      const vc = isRpModAction && String(msg.versionChangelogFromPrompt || '').trim();
      const diffMd = isRpModAction && String(msg.diffSummaryMarkdown || '').trim();
      const vcSection = vc
        ? `<div class="problem-detail-chat-modification-revision-section"><div class="problem-detail-chat-modification-revision-label">提示词相对上一版的调整</div><div class="problem-detail-chat-msg-content markdown-body ${isRpModAction ? 'problem-detail-chat-rp-mod-markdown' : ''}">${renderMarkdown(vc)}</div></div>`
        : '';
      const diffSection = diffMd
        ? `<div class="problem-detail-chat-modification-revision-section"><div class="problem-detail-chat-modification-revision-label">推演结果相对上一版的变化</div><div class="problem-detail-chat-msg-content markdown-body ${isRpModAction ? 'problem-detail-chat-rp-mod-markdown' : ''}">${renderMarkdown(diffMd)}</div></div>`
        : '';
      const currentJsonDetails =
        isRpModAction && msg.currentSessionsSnapshot != null
          ? `<details class="problem-detail-chat-modification-revision-raw"><summary>当前全量各环节推演 JSON</summary><pre class="problem-detail-chat-modification-revision-pre problem-detail-chat-modification-revision-pre--terminal">${escapeHtml(JSON.stringify(msg.currentSessionsSnapshot, null, 2))}</pre></details>`
          : '';
      const titleLine = isRpModAction
        ? `<div class="problem-detail-chat-msg-content problem-detail-chat-modification-revision-title">角色与权限 · 修改动作（按新提示词重生成）</div>`
        : isTask5ModAction
          ? `<div class="problem-detail-chat-msg-content problem-detail-chat-modification-revision-title">IT现状标注 · 修改动作（按新提示词重生成）</div>`
          : '';
      const task5ActionSection = isTask5ModAction
        ? `<div class="problem-detail-chat-modification-revision-section"><div class="problem-detail-chat-modification-revision-label">按新提示词相对上一版的修改项</div><div class="problem-detail-chat-msg-content markdown-body">${renderMarkdown(msg.content || '')}</div></div>`
        : '';
      const fallbackBody = (!isRpModAction && !isTask5ModAction)
        ? `<div class="problem-detail-chat-msg-content markdown-body">${renderMarkdown(msg.content || '')}</div>`
        : '';
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-modification-response problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = taskId;
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          ${titleLine}
          ${vcSection}
          ${diffSection}
          ${task5ActionSection}
          ${fallbackBody}
          ${currentJsonDetails}
          <div class="problem-detail-modification-response-actions">
            <button type="button" class="btn-confirm-modification-response btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-refine-modify" data-task-id="${escapeHtml(taskId)}" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" data-task-id="${escapeHtml(taskId)}" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(block);
    } else if (msg.type === 'bmcDiscussionStartBlock') {
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-bmc-discussion-start problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = msg.taskId || 'task2';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">— 讨论 —</div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'bmcDiscussionReplyBlock') {
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-bmc-discussion-reply problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = msg.taskId || 'task2';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content markdown-body">${renderMarkdown(msg.content || '')}</div>
          <div class="problem-detail-bmc-discussion-reply-actions">
            <button type="button" class="btn-bmc-discuss-continue">继续讨论</button>
            <button type="button" class="btn-bmc-discuss-regenerate">重新生成</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(block);
    } else if (msg.type === 'requirementLogicStartBlock') {
      if (item?.requirementLogic) return;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-requirement-logic-start problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      const confirmed = !!msg.confirmed;
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">我即将开始提取需求逻辑</div>
          <div class="problem-detail-chat-requirement-logic-start-actions">
            <button type="button" class="btn-confirm-start-requirement-logic" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'itStatusStartBlock') {
      const hasItStatus = item?.valueStream && !item.valueStream.raw && (() => {
        const rawStages = item.valueStream.stages ?? item.valueStream.phases ?? item.valueStream.nodes ?? [];
        if (!Array.isArray(rawStages)) return false;
        for (const s of rawStages) {
          const steps = s.steps ?? s.tasks ?? s.phases ?? s.items ?? [];
          for (const st of steps) {
            if (st && typeof st === 'object' && (st.itStatus || st.it_status)) return true;
          }
        }
        return false;
      })();
      if (hasItStatus) return;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-it-status-start';
      block.dataset.msgIndex = String(idx);
      const confirmed = !!msg.confirmed;
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">即将开始 IT 现状标注</div>
          <div class="problem-detail-chat-it-status-start-actions">
            <button type="button" class="btn-confirm-start-it-status" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'painPointStartBlock') {
      const hasPainPoint = item?.valueStream && !item.valueStream.raw && (() => {
        const rawStages = item.valueStream.stages ?? item.valueStream.phases ?? item.valueStream.nodes ?? [];
        if (!Array.isArray(rawStages)) return false;
        for (const s of rawStages) {
          const steps = s.steps ?? s.tasks ?? s.phases ?? s.items ?? [];
          for (const st of steps) {
            const pp = st?.painPoint ?? st?.pain_point;
            if (pp && typeof pp === 'string' && pp.trim()) return true;
          }
        }
        return false;
      })();
      if (hasPainPoint) return;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-pain-point-start problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      const confirmed = !!msg.confirmed;
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">即将开始价值流图环节节点痛点标注</div>
          <div class="problem-detail-chat-pain-point-start-actions">
            <button type="button" class="btn-confirm-start-pain-point" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'itGapStartBlock') {
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-it-gap-start problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      const confirmed = !!msg.confirmed;
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">即将在现有价值流上开始 ITGap 分析</div>
          <div class="problem-detail-chat-it-gap-start-actions">
            <button type="button" class="btn-confirm-start-it-gap" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'valueStreamStartBlock') {
      if (item?.valueStream) return;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-value-stream-start problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      const confirmed = !!msg.confirmed;
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">我即将开始需求相关核心价值流图绘制</div>
          <div class="problem-detail-chat-value-stream-start-actions">
            <button type="button" class="btn-confirm-start-value-stream" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'bmcStartBlock') {
      if (item?.bmc) return;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-bmc-start problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      const confirmed = !!msg.confirmed;
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">我将发起商业模式画布 BMC 生成</div>
          <div class="problem-detail-chat-bmc-start-actions">
            <button type="button" class="btn-confirm-start-bmc" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'bmcCard') {
      const data = msg.data || {};
      const confirmed = !!msg.confirmed;
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-bmc-card-collapsible problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = _taskId;
      const bmcRows = BMC_FIELDS.map(({ key, label }) => {
        const value = (data[key] != null ? String(data[key]).trim() : '') || '—';
        return `<div class="problem-detail-bmc-row"><span class="problem-detail-bmc-label">${escapeHtml(label)}</span><span class="problem-detail-bmc-value">${escapeHtml(value)}</span></div>`;
      }).join('');
      const industryInsight = (data.industry_insight || '').trim() || '—';
      const painPoints = (data.pain_points || '').trim() || '—';
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-bmc-card" role="button" tabindex="0">
          <div class="problem-detail-bmc-card-body">
            ${industryInsight ? `<div class="problem-detail-bmc-section"><h4>商业模式画布 BMC 提炼</h4><div class="problem-detail-bmc-content">${escapeHtml(industryInsight)}</div></div>` : ''}
            <div class="problem-detail-bmc-grid">${bmcRows}</div>
            ${painPoints ? `<div class="problem-detail-bmc-section"><h4>业务痛点预判</h4><div class="problem-detail-bmc-content">${escapeHtml(painPoints)}</div></div>` : ''}
          </div>
          <div class="problem-detail-bmc-card-expand-hint">点击展开</div>
          <div class="problem-detail-bmc-card-actions">
            <button type="button" class="btn-confirm-bmc btn-confirm-primary" data-json="${String(JSON.stringify(data)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-redo-bmc" ${confirmed ? 'disabled' : ''}>重做</button>
            <button type="button" class="btn-refine-modify" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(cardBlock);
      setupProblemDetailBmcCardToggle(cardBlock);
    } else if (msg.type === 'requirementLogicBlock') {
      const content = msg.content || '';
      const parsed = msg.parsed || parseRequirementLogicFromMarkdown(content);
      const confirmed = !!msg.confirmed;
      const hasAnyContent = REQUIREMENT_LOGIC_SECTIONS.some(({ key }) => (parsed[key] || '').trim());
      const rows = hasAnyContent
        ? REQUIREMENT_LOGIC_SECTIONS.map(({ key, label }) => {
            const val = (parsed[key] || '').trim() || '—';
            return `<div class="problem-detail-basic-info-row"><span class="problem-detail-basic-info-label">${escapeHtml(label)}</span><span class="problem-detail-basic-info-value markdown-body">${renderMarkdown(val)}</span></div>`;
          }).join('')
        : `<div class="problem-detail-basic-info-row"><span class="problem-detail-basic-info-label">原始输出</span><span class="problem-detail-basic-info-value markdown-body">${renderMarkdown(content)}</span></div>`;
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-card-collapsible problem-detail-chat-msg-with-delete problem-detail-chat-requirement-logic-card';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = _taskId;
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-basic-info-card" role="button" tabindex="0">
          <div class="problem-detail-basic-info-card-body">${rows}</div>
          <div class="problem-detail-basic-info-card-actions">
            <button type="button" class="btn-confirm-requirement-logic btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-redo-requirement-logic" ${confirmed ? 'disabled' : ''}>重做</button>
            <button type="button" class="btn-refine-modify" data-task-id="task3" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" data-task-id="task3" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(cardBlock);
      setupProblemDetailRequirementLogicCardToggle(cardBlock);
    } else if (msg.type === 'drawValueStreamStartBlock') {
      const data = msg.data || {};
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-draw-value-stream-start';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = _taskId;
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">开始绘制价值流图</div>
          <div class="problem-detail-chat-draw-value-stream-start-actions">
            <button type="button" class="btn-confirm-draw-value-stream" data-json="${String(JSON.stringify(data)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-refine-modify" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'valueStreamPhaseIntroBlock') {
      const phase = msg.phase === 'hardening' ? 'hardening' : 'mirror';
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-value-stream-phase-intro';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = msg.taskId || 'task4';
      const bodyText = escapeHtml(msg.content || '');
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${bodyText}</div>
          <div class="problem-detail-chat-draw-value-stream-start-actions">
            <button type="button" class="btn-confirm-value-stream-phase-intro btn-confirm-primary" data-phase="${escapeHtml(phase)}" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-refine-modify" data-task-id="task4" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" data-task-id="task4" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'task1PrelimMergePromptJsonBlock') {
      const secLbl = msg.sectionLabel != null ? String(msg.sectionLabel) : '核心对象 / 状态逻辑';
      const headerTitle = `初步需求分段合并 · 调用前完整提示词（${escapeHtml(secLbl)}）`;
      const rawPrompt =
        msg.promptFullText != null && String(msg.promptFullText).trim() !== ''
          ? String(msg.promptFullText)
          : msg.promptJsonText != null
            ? String(msg.promptJsonText)
            : '';
      const jsonStr = escapeHtml(rawPrompt);
      const preBlock = document.createElement('div');
      preBlock.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-value-stream-card problem-detail-chat-msg-with-delete';
      preBlock.dataset.msgIndex = String(idx);
      preBlock.dataset.taskId = msg.taskId || 'task1';
      preBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-value-stream-card-wrap">
          <div class="problem-detail-chat-value-stream-card-header">${headerTitle}</div>
          <div class="problem-detail-chat-value-stream-card-body"><pre class="problem-detail-chat-json-pre">${jsonStr}</pre></div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(preBlock);
    } else if (msg.type === 'task4ValueStreamPromptJsonBlock') {
      const vsPh = msg.valueStreamPhase === 'per_stage_hardening' ? 'per_stage_hardening' : 'mirror';
      const subName = msg.task4PerStageName != null ? String(msg.task4PerStageName) : '';
      const headerTitle =
        vsPh === 'mirror'
          ? '价值流生成 · 调用前提示词 JSON（Mirror Stage）'
          : subName
            ? `价值流生成 · 调用前提示词 JSON（分阶段加固：${escapeHtml(subName)}）`
            : '价值流生成 · 调用前提示词 JSON（分阶段加固）';
      const jsonStr = escapeHtml(msg.promptJsonText != null ? String(msg.promptJsonText) : '');
      const preBlock = document.createElement('div');
      preBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-value-stream-card problem-detail-chat-msg-with-delete';
      preBlock.dataset.msgIndex = String(idx);
      preBlock.dataset.taskId = msg.taskId || 'task4';
      preBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-value-stream-card-wrap">
          <div class="problem-detail-chat-value-stream-card-header">${headerTitle}</div>
          <div class="problem-detail-chat-value-stream-card-body"><pre class="problem-detail-chat-json-pre">${jsonStr}</pre></div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(preBlock);
    } else if (msg.type === 'valueStreamCard') {
      const data = msg.data || {};
      const confirmed = !!msg.confirmed;
      const taskIdVs = msg.taskId || 'task4';
      const vsPhase = msg.valueStreamPhase || '';
      const isHardeningDraft = vsPhase === 'hardening_draft';
      const stageLbl = msg.hardeningStageLabel != null ? String(msg.hardeningStageLabel) : '';
      const cardHeader =
        vsPhase === 'mirror'
          ? '价值流图设计 JSON（Mirror Stage 草稿）'
          : vsPhase === 'hardening_draft'
            ? '价值流图设计 JSON（Hardening Stage 中间稿·未写入工作区）'
            : vsPhase === 'hardening_stage_progress'
              ? `价值流图设计 JSON（分阶段加固进行中${stageLbl ? ' · ' + stageLbl : ''}）`
              : vsPhase === 'hardening_final'
                ? '价值流图设计 JSON（完整价值流）'
                : vsPhase === 'synthesis_final'
                  ? '价值流图设计 JSON（最终合成·历史兼容）'
                  : '价值流图设计 JSON';
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-value-stream-card problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = taskIdVs;
      const jsonStr = escapeHtml(JSON.stringify(data, null, 2));
      const dataAttr = String(JSON.stringify(data)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const actionsHtml = isHardeningDraft
        ? `<div class="problem-detail-chat-value-stream-card-actions">
            <span class="problem-detail-chat-vs-draft-hint-text">本稿为中间稿（历史兼容）；当前主流程为 Mirror 后分阶段加固并直接写入工作区。</span>
            <button type="button" class="btn-refine-modify" data-task-id="task4" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" data-task-id="task4" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>`
        : `<div class="problem-detail-chat-value-stream-card-actions">
            <button type="button" class="btn-confirm-value-stream btn-confirm-primary" data-json="${dataAttr}" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-redo-value-stream" ${confirmed ? 'disabled' : ''}>重做</button>
            <button type="button" class="btn-refine-modify" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>`;
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-value-stream-card-wrap">
          <div class="problem-detail-chat-value-stream-card-header">${cardHeader}</div>
          <div class="problem-detail-chat-value-stream-card-body"><pre class="problem-detail-chat-json-pre">${jsonStr}</pre></div>
          ${actionsHtml}
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'itStatusCard') {
      const itStatusData = msg.data || [];
      const confirmed = !!msg.confirmed;
      const taskIdItStatus = msg.taskId || 'task5';
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-value-stream-card problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = taskIdItStatus;
      const itStatusJsonStr = escapeHtml(JSON.stringify(itStatusData, null, 2));
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-value-stream-card-wrap">
          <div class="problem-detail-chat-value-stream-card-header">IT 现状标注 JSON（阶段名-环节名-IT 现状）</div>
          <div class="problem-detail-chat-value-stream-card-body"><pre class="problem-detail-chat-json-pre">${itStatusJsonStr}</pre></div>
          <div class="problem-detail-chat-value-stream-card-actions">
            <button type="button" class="btn-confirm-it-status btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-redo-it-status" ${confirmed ? 'disabled' : ''}>重做</button>
            <button type="button" class="btn-refine-modify" data-task-id="task5" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" data-task-id="task5" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'rolePermissionCard') {
      const content = msg.content || '';
      const parsedModel = parseRolePermissionModel(content);
      const hasStructured = Array.isArray(parsedModel) && parsedModel.length > 0;
      const structuredHtml = hasStructured ? buildRolePermissionNodeCardsHtml(parsedModel) : '';
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const card = document.createElement('div');
      card.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-role-permission-card problem-detail-chat-msg-with-delete';
      card.dataset.msgIndex = String(idx);
      card.dataset.taskId = _taskId;
      card.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-basic-info-card problem-detail-role-permission-card-inner">
            <div class="problem-detail-basic-info-card-body problem-detail-chat-role-permission-body${
              hasStructured ? '' : ' markdown-body'
            }">
              ${
                hasStructured
                  ? structuredHtml
                  : renderMarkdown(content || '')
              }
            </div>
            <div class="problem-detail-basic-info-card-actions">
              <button type="button" class="btn-confirm-role-permission btn-confirm-primary" ${
                msg.confirmed ? 'disabled' : ''
              }>${msg.confirmed ? '已确认' : '确认'}</button>
              <button type="button" class="btn-refine-modify" ${msg.confirmed ? 'disabled' : ''}>修正</button>
              <button type="button" class="btn-refine-discuss" ${msg.confirmed ? 'disabled' : ''}>讨论</button>
              <button type="button" class="btn-redo-role-permission" ${msg.confirmed ? 'disabled' : ''}>重做</button>
            </div>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>
        ${llmMetaHtml}`;
      container.appendChild(card);
    } else if (msg.type === 'rolePermissionStepProgressBlock') {
      const stepName = (msg.stepName || '').trim() || '当前环节';
      const progressBlock = document.createElement('div');
      progressBlock.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing problem-detail-chat-role-permission-step-progress';
      progressBlock.dataset.msgIndex = String(idx);
      progressBlock.dataset.taskId = 'task10';
      progressBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner" aria-hidden="true"></span><span class="problem-detail-chat-msg-content">正在进行【${escapeHtml(stepName)}】的角色与权限模型推演…</span></div></div><div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(progressBlock);
    } else if (msg.type === 'rolePermissionAnalysisCard') {
      const jsonStr = formatAnalysisStepCardJsonPreview(msg.content);
      const stepName = (msg.stepName || '').trim() || `环节${(msg.stepIndex ?? 0) + 1}`;
      const stepIndex = parseInt(msg.stepIndex, 10);
      const confirmed = !!msg.confirmed;
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-role-permission-step-card problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = 'task10';
      cardBlock.dataset.stepName = stepName;
      cardBlock.dataset.stepIndex = String(stepIndex);
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-role-permission-step-card-wrap">
          <div class="problem-detail-chat-role-permission-step-card-header">角色与权限模型推演：${escapeHtml(stepName)}</div>
          <div class="problem-detail-chat-role-permission-step-card-body"><pre class="problem-detail-chat-json-pre">${escapeHtml(jsonStr)}</pre></div>
          <div class="problem-detail-chat-role-permission-step-card-actions">
            <button type="button" class="btn-confirm-role-permission-step btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-redo-role-permission-step" ${confirmed ? 'disabled' : ''}>重做</button>
            <button type="button" class="btn-refine-modify" data-task-id="task10" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" data-task-id="task10" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>
        <div class="problem-detail-chat-role-permission-step-meta">${llmMetaHtml}</div>`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'coreBusinessObjectAnalysisCard') {
      const jsonStr = formatAnalysisStepCardJsonPreview(msg.content);
      const stepName = (msg.stepName || '').trim() || `环节${(msg.stepIndex ?? 0) + 1}`;
      const stepIndex = parseInt(msg.stepIndex, 10);
      const confirmed = !!msg.confirmed;
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-role-permission-step-card problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = 'task12';
      cardBlock.dataset.stepName = stepName;
      cardBlock.dataset.stepIndex = String(stepIndex);
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-role-permission-step-card-wrap">
          <div class="problem-detail-chat-role-permission-step-card-header">核心业务对象推演：${escapeHtml(stepName)}</div>
          <div class="problem-detail-chat-role-permission-step-card-body"><pre class="problem-detail-chat-json-pre">${escapeHtml(jsonStr)}</pre></div>
          <div class="problem-detail-chat-role-permission-step-card-actions">
            <button type="button" class="btn-confirm-core-business-object-step btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-redo-core-business-object-step" ${confirmed ? 'disabled' : ''}>重做</button>
            <button type="button" class="btn-refine-modify" data-task-id="task12" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" data-task-id="task12" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>
        <div class="problem-detail-chat-role-permission-step-meta">${llmMetaHtml}</div>`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'rolePermissionAllDoneBlock') {
      const resolvedItem = resolveProblemItemForTaskNotification() || __appState.currentProblemDetailItem;
      const ids = resolvedItem?.completedTaskIds;
      const legacyRpMerged =
        !!resolvedItem &&
        (isTaskCompleted(resolvedItem, 'task12') ||
          (Array.isArray(ids) && (ids.includes('task10') || ids.includes('strategy-0'))));
      const firstUncompletedTask = resolvedItem ? getFirstUncompletedTask(resolvedItem) : null;
      const allConfirmed = !!msg.allConfirmed || !!msg.confirmed || legacyRpMerged || firstUncompletedTask?.id === 'task12';
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-role-permission-all-done';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '全部环节已推演完毕，结果已写入工作区，请点击「全部确认」以继续。')}</div>
          <div class="problem-detail-chat-role-permission-all-done-actions">
            <button type="button" class="btn-role-permission-confirm-all btn-confirm-primary" ${allConfirmed ? 'disabled' : ''}>${allConfirmed ? '已全部确认' : '全部确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'coreBusinessObjectAllDoneBlock') {
      const allConfirmed = !!msg.allConfirmed;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-role-permission-all-done problem-detail-chat-core-business-object-all-done';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '所有环节的核心业务对象推演已经结束，是否全部确认？')}</div>
          <div class="problem-detail-chat-role-permission-all-done-actions">
            <button type="button" class="btn-core-business-object-confirm-all btn-confirm-primary" ${allConfirmed ? 'disabled' : ''}>${allConfirmed ? '已全部确认' : '全部确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'basicInfoJsonBlock') {
      /* 客户基本信息提取的 JSON 卡片不再在聊天区展示，仅时间线等可保留 */
      return;
    } else if (msg.type === 'modificationClarificationRequest') {
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-clarification';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content markdown-body">${renderMarkdown(msg.content || MODIFICATION_CLARIFICATION_TEXT)}</div></div><div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'e2eFlowExtractStartBlock') {
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-e2e-extract-start problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">我先需要提取端到端事务流的 json 数据</div>
          <div class="problem-detail-chat-e2e-extract-actions">
            <button type="button" class="btn-confirm-e2e-extract" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'e2eBusinessFlowIntentBlock') {
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-e2e-business-flow-intent problem-detail-chat-task-start-notification problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '将基于价值流生成事务流')}</div>
          <div class="problem-detail-chat-task-start-notification-actions">
            <button type="button" class="btn-confirm-e2e-business-flow-intent btn-confirm-task-start btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'e2eTransactionFlowLlmPromptBlock') {
      const headerTitle = escapeHtml(msg.content || '事务流生成 · 调用前完整提示词');
      const preText = escapeHtml(msg.promptFullText != null ? String(msg.promptFullText) : '');
      const preBlock = document.createElement('div');
      preBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-value-stream-card problem-detail-chat-msg-with-delete';
      preBlock.dataset.msgIndex = String(idx);
      preBlock.dataset.taskId = msg.taskId || 'task7';
      preBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-value-stream-card-wrap">
          <div class="problem-detail-chat-value-stream-card-header">${headerTitle}</div>
          <div class="problem-detail-chat-value-stream-card-body"><pre class="problem-detail-chat-json-pre">${preText}</pre></div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(preBlock);
    } else if (msg.type === 'e2eBusinessFlowLlmStartBlock') {
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-parsing-inner">
            <span class="problem-detail-chat-spinner"></span>
            <span class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '正在基于价值流生成业务事务流 JSON…')}</span>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'e2eFlowJsonBlock') {
      const jsonBlock = document.createElement('div');
      jsonBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-e2e-json-block problem-detail-chat-msg-with-delete';
      jsonBlock.dataset.msgIndex = String(idx);
      jsonBlock.dataset.taskId = _taskId;
      const displayObj =
        msg.transactionFlowJson != null && typeof msg.transactionFlowJson === 'object'
          ? msg.transactionFlowJson
          : msg.valueStreamJson || {};
      const headerLabel =
        msg.transactionFlowJson != null && typeof msg.transactionFlowJson === 'object'
          ? '业务事务流 JSON（BPM 指令）'
          : '端到端事务流 JSON 数据';
      const jsonStr = escapeHtml(JSON.stringify(displayObj, null, 2));
      const dataAttr = String(JSON.stringify(displayObj)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const confirmed = !!msg.confirmed;
      jsonBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-e2e-json-wrap">
          <div class="problem-detail-chat-e2e-json-header">${escapeHtml(headerLabel)}</div>
          <pre class="problem-detail-chat-json-pre">${jsonStr}</pre>
          <div class="problem-detail-chat-e2e-json-actions">
            <button type="button" class="btn-confirm-e2e-json btn-confirm-primary" data-json="${dataAttr}" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-redo-e2e-json" ${confirmed ? 'disabled' : ''}>重做</button>
            <button type="button" class="btn-refine-modify" data-task-id="task7" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" data-task-id="task7" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(jsonBlock);
    } else if (msg.type === 'e2eFlowCompressionStartBlock' || msg.type === 'e2eFlowCompressionBlock') {
      /* 端到端全景观压缩已下线：历史块仅保留在过程日志，主聊天区不渲染 */
      return;
    } else if (msg.type === 'e2eFlowGeneratedLog') {
      const taskLabel = msg.taskLabel || '端到端事务流构建';
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-e2e-flow-log problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-e2e-flow-log-task">${escapeHtml(taskLabel)}</div>
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '已生成端到端事务流 JSON 数据')}</div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'globalItGapStartBlock') {
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-global-itgap-start problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">即将针对端到端事务流开展 IT设计补齐</div>
          <div class="problem-detail-chat-global-itgap-start-actions">
            <button type="button" class="btn-confirm-start-global-itgap" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'globalItGapPhasePlanBlock') {
      const confirmed = !!msg.confirmed;
      const phases = Array.isArray(msg.phases) ? msg.phases : [];
      const listHtml = phases
        .map((p) => `<li class="problem-detail-chat-global-itgap-phase-plan-item">${escapeHtml((p && p.stepName) || '')}</li>`)
        .join('');
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-global-itgap-phase-plan-card problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = _taskId;
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-global-itgap-phase-plan-wrap">
          <div class="problem-detail-chat-global-itgap-phase-plan-header">IT设计补齐 Session 计划</div>
          <p class="problem-detail-chat-global-itgap-phase-plan-intro">将按以下四个阶段依次执行大模型分析，请确认后开始。</p>
          <ol class="problem-detail-chat-global-itgap-phase-plan-list">${listHtml}</ol>
          <div class="problem-detail-chat-global-itgap-phase-plan-actions">
            <button type="button" class="btn-confirm-global-itgap-phase-plan btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认开始'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'globalItGapAnalysisCard') {
      const data = msg.data || {};
      const confirmed = !!msg.confirmed;
      const structuredView = !!msg.structuredView;
      const jsonStr = escapeHtml(JSON.stringify(data, null, 2));
      const dataAttr = String(JSON.stringify(data)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-global-itgap-card problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = _taskId;
      const bodyContent = structuredView
        ? `<div class="problem-detail-chat-global-itgap-structured">${buildGlobalItGapStructuredHtml(data)}</div>`
        : `<pre class="problem-detail-chat-json-pre">${jsonStr}</pre>`;
      const confirmBtn = structuredView
        ? `<button type="button" class="btn-confirm-global-itgap-structured btn-confirm-primary" data-json="${dataAttr}" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>`
        : `<button type="button" class="btn-confirm-global-itgap-json btn-confirm-primary" data-json="${dataAttr}" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>`;
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-global-itgap-card-wrap">
          <div class="problem-detail-chat-global-itgap-card-header">IT设计补齐</div>
          <div class="problem-detail-chat-global-itgap-card-body">${bodyContent}</div>
          <div class="problem-detail-chat-global-itgap-card-actions">
            ${confirmBtn}
            <button type="button" class="btn-redo-global-itgap" ${confirmed ? 'disabled' : ''}>重做</button>
            <button type="button" class="btn-refine-modify" data-task-id="task8" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" data-task-id="task8" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'globalItGapAnalysisLog') {
      const taskLabel = msg.taskLabel || 'IT设计补齐';
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-global-itgap-log problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-e2e-flow-log-task">${escapeHtml(taskLabel)}</div>
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '已生成 IT设计补齐 成果')}</div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'roleTaskCenterDesignIntentBlock') {
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-role-task-center-design-intent problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = 'task9';
      const bodyIntro =
        '我将开始【对象状态机构建】。请阅读说明后点击下方「确认」以记录任务开始；工作区具体产出与自动化编排将随版本迭代接入（原「流程、待办与决策中心」门户路径已下线）。';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-role-task-center-design-intent-box">
            <div class="problem-detail-chat-role-task-center-design-intent-title">对象状态机构建</div>
            <div class="problem-detail-chat-msg-content">${escapeHtml(bodyIntro)}</div>
          </div>
          <div class="problem-detail-chat-local-itgap-start-actions">
            <button type="button" class="btn-confirm-role-task-center-design btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'localItGapStartBlock') {
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-local-itgap-start problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">即将生成每个环节的 session（历史 task9 计划块，仅供参考）</div>
          <div class="problem-detail-chat-local-itgap-start-actions">
            <button type="button" class="btn-confirm-start-local-itgap" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'itStrategyPlanStartBlock') {
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-it-strategy-plan-start problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">即将开始 IT 策略规划</div>
          <div class="problem-detail-chat-it-strategy-plan-start-actions">
            <button type="button" class="btn-confirm-start-it-strategy-plan btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'e2eTransactionFlowSessionsBlock') {
      const sessions = msg.sessions || [];
      const hasUnfinished = sessions.some((s) => s == null || s.transactionNodesJson == null);
      const sessionsListHtml = sessions
        .map(
          (s) =>
            `<div class="problem-detail-chat-local-itgap-session-item"><span class="problem-detail-chat-local-itgap-session-name">${escapeHtml(s.stageName || `阶段${(s.stageIndex ?? 0) + 1}`)}</span><span class="problem-detail-chat-local-itgap-session-status ${s.transactionNodesJson ? 'session-done' : 'session-pending'}">${s.transactionNodesJson ? '已生成✅' : '待生成'}</span></div>`,
        )
        .join('');
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-local-itgap-sessions-card problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = 'task7';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-local-itgap-sessions-card-wrap">
          <div class="problem-detail-chat-local-itgap-sessions-card-header">生成事务流 Session 计划</div>
          <div class="problem-detail-chat-local-itgap-sessions-card-body">
            <div class="problem-detail-chat-local-itgap-sessions-header">已为 ${sessions.length} 个价值流阶段生成事务流 session</div>
            <div class="problem-detail-chat-local-itgap-sessions-list">${sessionsListHtml}</div>
          </div>
          <div class="problem-detail-chat-local-itgap-sessions-actions">
            <button type="button" class="btn-auto-e2e-transaction-flow-sessions btn-confirm-primary" ${!hasUnfinished ? 'disabled' : ''}>${!hasUnfinished ? '全部已完成' : '自动顺序执行'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'e2ePrelimFvsCompletenessSessionsBlock') {
      const sessionsGap = msg.sessions || [];
      const hasUnfinishedGap = sessionsGap.some((s) => s == null || s.transactionNodesJson == null);
      const runningGapIdx = typeof msg.runningSessionIndex === 'number' ? msg.runningSessionIndex : -1;
      const sessionsListHtmlGap = sessionsGap
        .map((s, si) => {
          const rowName = escapeHtml(s.stageName || s.domainLabel || `类目${(s.stageIndex ?? 0) + 1}`);
          const done = !!s.transactionNodesJson;
          const running = !done && si === runningGapIdx;
          const statusClass = done ? 'session-done' : running ? 'session-running' : 'session-pending';
          const statusText = done ? '已校验✅' : running ? '进行中…' : '待校验';
          return `<div class="problem-detail-chat-local-itgap-session-item"><span class="problem-detail-chat-local-itgap-session-name">${rowName}</span><span class="problem-detail-chat-local-itgap-session-status ${statusClass}">${statusText}</span></div>`;
        })
        .join('');
      const blockGap = document.createElement('div');
      blockGap.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-local-itgap-sessions-card problem-detail-chat-msg-with-delete';
      blockGap.dataset.msgIndex = String(idx);
      blockGap.dataset.taskId = 'task7';
      blockGap.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-local-itgap-sessions-card-wrap">
          <div class="problem-detail-chat-local-itgap-sessions-card-header">校验流程完整性 Session 计划（初步需求·业务流程）</div>
          <div class="problem-detail-chat-local-itgap-sessions-card-body">
            <div class="problem-detail-chat-local-itgap-sessions-header">已按 ${sessionsGap.length} 个类目生成补齐 session，逐项比对当前端到端事务流与初步需求流程</div>
            <div class="problem-detail-chat-local-itgap-sessions-list">${sessionsListHtmlGap}</div>
          </div>
          <div class="problem-detail-chat-local-itgap-sessions-actions">
            <button type="button" class="btn-auto-e2e-prelim-fvs-completeness-sessions btn-confirm-primary" ${!hasUnfinishedGap ? 'disabled' : ''}>${!hasUnfinishedGap ? '全部已完成' : '自动顺序执行'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(blockGap);
    } else if (msg.type === 'e2ePrelimFvsCompletenessAllDoneConfirmBlock') {
      const confirmedGapAll = !!msg.confirmed;
      const blockGapAll = document.createElement('div');
      blockGapAll.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-pain-point-all-done-confirm';
      blockGapAll.dataset.msgIndex = String(idx);
      blockGapAll.dataset.taskId = 'task7';
      blockGapAll.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '所有端到端事务流补齐已完成。')}</div>
          <div class="problem-detail-chat-pain-point-all-done-actions">
            <button type="button" class="btn-confirm-e2e-prelim-fvs-completeness-all-done btn-confirm-primary" ${confirmedGapAll ? 'disabled' : ''}>${confirmedGapAll ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(blockGapAll);
    } else if (msg.type === 'localItGapSessionsBlock') {
      const item = __appState.currentProblemDetailItem;
      const sessions = item?.localItGapSessions || msg.sessions || [];
      const sessionsConfirmed = !!msg.confirmed;
      const hasUnfinished = sessions.some((s) => !s.analysisJson);
      const sessionsListHtml = sessions
        .map(
          (s) =>
            `<div class="problem-detail-chat-local-itgap-session-item"><span class="problem-detail-chat-local-itgap-session-name">${escapeHtml(s.stepName || `环节${s.stepIndex + 1}`)}</span><span class="problem-detail-chat-local-itgap-session-status ${s.analysisJson ? 'session-done' : 'session-pending'}">${s.analysisJson ? '已分析✅' : '待分析'}</span></div>`
        )
        .join('');
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-local-itgap-sessions-card problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-local-itgap-sessions-card-wrap">
          <div class="problem-detail-chat-local-itgap-sessions-card-header">对象状态机构建 Session 计划（历史）</div>
          <div class="problem-detail-chat-local-itgap-sessions-card-body">
            <div class="problem-detail-chat-local-itgap-sessions-header">已为 ${sessions.length} 个环节生成 session</div>
            <div class="problem-detail-chat-local-itgap-sessions-list">${sessionsListHtml}</div>
          </div>
          <div class="problem-detail-chat-local-itgap-sessions-actions">
            <p class="problem-detail-chat-msg-content" style="margin:0;font-size:13px;opacity:0.85">历史数据：旧版按环节 session 计划，已不再提供自动/逐项执行；当前 task9 以「对象状态机构建」为准。</p>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'painPointSessionsBlock') {
      const item = __appState.currentProblemDetailItem;
      const sessions = item?.painPointSessions || msg.sessions || [];
      const hasUnfinished = sessions.some((s) => s.painPoint == null || (typeof s.painPoint === 'string' && !s.painPoint.trim()));
      const sessionsListHtml = sessions
        .map(
          (s) =>
            `<div class="problem-detail-chat-pain-point-session-item"><span class="problem-detail-chat-pain-point-session-name">${escapeHtml(s.stepName || `环节${s.stepIndex + 1}`)}</span><span class="problem-detail-chat-pain-point-session-status ${s.painPoint ? 'session-done' : 'session-pending'}">${s.painPoint ? '已标注✅' : '待标注'}</span></div>`
        )
        .join('');
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-pain-point-sessions-card problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = 'task6';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-pain-point-sessions-card-wrap">
          <div class="problem-detail-chat-pain-point-sessions-card-header">痛点标注 Session 计划确认</div>
          <div class="problem-detail-chat-pain-point-sessions-card-body">
            <div class="problem-detail-chat-pain-point-sessions-header">已为 ${sessions.length} 个价值流环节生成痛点标注 session</div>
            <div class="problem-detail-chat-pain-point-sessions-list">${sessionsListHtml}</div>
          </div>
          <div class="problem-detail-chat-pain-point-sessions-actions">
            <button type="button" class="btn-auto-pain-point-sessions btn-confirm-primary" ${!hasUnfinished ? 'disabled' : ''}>${!hasUnfinished ? '全部已完成' : '自动顺序执行'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'itDesignSupplementSessionsBlock') {
      const itemIds = __appState.currentProblemDetailItem;
      const sessions = itemIds?.itDesignSupplementSessions || msg.sessions || [];
      const hasUnfinished = sessions.some((s) => {
        if (!s || s.designOutputJson == null) return true;
        const md = s.bpmFlowDrawMarkdown;
        return md == null || !String(md).trim();
      });
      const sessionsListHtml = sessions
        .map((s) => {
          // 仅展示事务流名称 + 子任务类型，不前置价值流阶段名（与 generateItDesignSupplementSessions 仍保留 stageName 落库无关）
          const txTitle = escapeHtml(s.transactionName || s.transactionId || `事务${(s.stepIndex ?? 0) + 1}`);
          const designDone = s.designOutputJson != null;
          const bpmDone = s.bpmFlowDrawMarkdown != null && String(s.bpmFlowDrawMarkdown).trim();
          const rowDesign = `<div class="problem-detail-chat-pain-point-session-item"><span class="problem-detail-chat-pain-point-session-name">${txTitle} IT设计补齐</span><span class="problem-detail-chat-pain-point-session-status ${designDone ? 'session-done' : 'session-pending'}">${designDone ? '已完成✅' : '待执行'}</span></div>`;
          const rowBpm = `<div class="problem-detail-chat-pain-point-session-item"><span class="problem-detail-chat-pain-point-session-name">${txTitle} bpm 绘制</span><span class="problem-detail-chat-pain-point-session-status ${bpmDone ? 'session-done' : 'session-pending'}">${bpmDone ? '已绘制✅' : designDone ? '待执行' : '待前置'}</span></div>`;
          return rowDesign + rowBpm;
        })
        .join('');
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-pain-point-sessions-card problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = 'task8';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-pain-point-sessions-card-wrap">
          <div class="problem-detail-chat-pain-point-sessions-card-header">IT设计补齐 Session 计划确认</div>
          <div class="problem-detail-chat-pain-point-sessions-card-body">
            <div class="problem-detail-chat-pain-point-sessions-header">已为 ${sessions.length} 个事务流对象各生成「IT设计补齐」与「bpm 绘制」子任务；请点击「自动顺序执行」按事务依次完成设计与泳道图绘制。</div>
            <div class="problem-detail-chat-pain-point-sessions-list">${sessionsListHtml}</div>
          </div>
          <div class="problem-detail-chat-pain-point-sessions-actions">
            <button type="button" class="btn-auto-it-design-supplement-sessions btn-confirm-primary" ${!hasUnfinished ? 'disabled' : ''}>${!hasUnfinished ? '全部已完成' : '自动顺序执行'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'itDesignBpmDrawSessionsBlock') {
      const itemBpm = __appState.currentProblemDetailItem;
      const fromItemBpm = itemBpm?.itDesignSupplementSessions;
      const fromMsgBpm = msg.sessions;
      const sessionsBpm =
        Array.isArray(fromItemBpm) && fromItemBpm.length > 0
          ? fromItemBpm
          : Array.isArray(fromMsgBpm) && fromMsgBpm.length > 0
            ? fromMsgBpm
            : [];
      const hasUnfinishedBpm = sessionsBpm.some(
        (s) => s.designOutputJson != null && (s.bpmFlowDrawMarkdown == null || !String(s.bpmFlowDrawMarkdown).trim()),
      );
      const sessionsListHtmlBpm = sessionsBpm
        .map((s) => {
          const label = escapeHtml(s.transactionName || s.transactionId || `事务${(s.stepIndex ?? 0) + 1}`);
          let statusText = '待绘制';
          let done = false;
          if (s.designOutputJson == null) {
            statusText = '无设计产出';
          } else if (s.bpmFlowDrawMarkdown != null && String(s.bpmFlowDrawMarkdown).trim()) {
            statusText = '已绘制✅';
            done = true;
          }
          return `<div class="problem-detail-chat-pain-point-session-item"><span class="problem-detail-chat-pain-point-session-name">${label}</span><span class="problem-detail-chat-pain-point-session-status ${done ? 'session-done' : 'session-pending'}">${statusText}</span></div>`;
        })
        .join('');
      const blockBpm = document.createElement('div');
      blockBpm.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-pain-point-sessions-card problem-detail-chat-msg-with-delete';
      blockBpm.dataset.msgIndex = String(idx);
      blockBpm.dataset.taskId = 'task8';
      blockBpm.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-pain-point-sessions-card-wrap">
          <div class="problem-detail-chat-pain-point-sessions-card-header">BPM 流程绘制 session 计划</div>
          <div class="problem-detail-chat-pain-point-sessions-card-body">
            <div class="problem-detail-chat-pain-point-sessions-header">下列为各事务流对象；请点击「自动顺序执行」按事务调用大模型绘制角色-阶段二维泳道图，结果写入工作区对应事务「流程图绘制」折叠区。</div>
            <div class="problem-detail-chat-pain-point-sessions-list">${sessionsListHtmlBpm}</div>
          </div>
          <div class="problem-detail-chat-pain-point-sessions-actions">
            <button type="button" class="btn-auto-it-design-bpm-draw-sessions btn-confirm-primary" ${!hasUnfinishedBpm ? 'disabled' : ''}>${!hasUnfinishedBpm ? '全部已完成' : '自动顺序执行'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(blockBpm);
    } else if (msg.type === 'itDesignSupplementAllDoneConfirmBlock') {
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-pain-point-all-done-confirm';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = 'task8';
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '是否确认全部 IT设计补齐 结果？')}</div>
          <div class="problem-detail-chat-pain-point-all-done-actions">
            <button type="button" class="btn-confirm-all-it-design-supplement btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已全部确认' : '全部确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'itStatusSessionsBlock') {
      const itemIt = __appState.currentProblemDetailItem;
      const sessions = itemIt?.itStatusSessions || msg.sessions || [];
      const hasUnfinished = sessions.some((s) => s.itAnnotation == null);
      const sessionsListHtml = sessions
        .map(
          (s) =>
            `<div class="problem-detail-chat-pain-point-session-item"><span class="problem-detail-chat-pain-point-session-name">${escapeHtml(s.stepName || `环节${(s.stepIndex ?? 0) + 1}`)}</span><span class="problem-detail-chat-pain-point-session-status ${s.itAnnotation ? 'session-done' : 'session-pending'}">${s.itAnnotation ? '已标注✅' : '待执行'}</span></div>`,
        )
        .join('');
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-pain-point-sessions-card problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = 'task5';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-pain-point-sessions-card-wrap">
          <div class="problem-detail-chat-pain-point-sessions-card-header">IT 现状标注 Session 计划</div>
          <div class="problem-detail-chat-pain-point-sessions-card-body">
            <div class="problem-detail-chat-pain-point-sessions-header">下列子工作项对应各价值流子环节，状态为「待执行」；请点击下方「自动顺序执行」，将结合需求逻辑与 IT 现状/已有系统 JSON 逐环节标注，并同步到工作区环节卡片的 IT 现状与 IT 计划</div>
            <div class="problem-detail-chat-pain-point-sessions-list">${sessionsListHtml}</div>
          </div>
          <div class="problem-detail-chat-pain-point-sessions-actions">
            <button type="button" class="btn-auto-it-status-sessions btn-confirm-primary" ${!hasUnfinished ? 'disabled' : ''}>${!hasUnfinished ? '全部已完成' : '自动顺序执行'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'itStatusStepCard') {
      const stepName = msg.stepName || `环节${(msg.stepIndex ?? 0) + 1}`;
      const statusLine = msg.statusLine != null ? String(msg.statusLine) : '';
      const planLine = msg.planLine != null ? String(msg.planLine) : '';
      const planDisplay = planLine.replace(/^IT计划：/, '');
      const confirmed = !!msg.confirmed;
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const cardBlock = document.createElement('div');
      cardBlock.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-it-status-step-card problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = 'task5';
      cardBlock.dataset.stepName = stepName;
      cardBlock.dataset.stepIndex = String(msg.stepIndex ?? -1);
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-pain-point-step-card-wrap">
          <div class="problem-detail-chat-pain-point-step-card-header">IT 现状标注：${escapeHtml(stepName)}</div>
          <div class="problem-detail-chat-pain-point-step-card-body">
            <div class="problem-detail-chat-it-status-step-lines">
              <div class="problem-detail-chat-it-status-line"><span class="problem-detail-chat-it-status-k">IT现状</span>：${escapeHtml(statusLine || '—')}</div>
              <div class="problem-detail-chat-it-status-line"><span class="problem-detail-chat-it-status-k">IT计划</span>：${escapeHtml(planDisplay || '—')}</div>
            </div>
          </div>
          <div class="problem-detail-chat-pain-point-step-card-actions">
            <button type="button" class="btn-confirm-it-status-step btn-confirm-primary" data-step-index="${msg.stepIndex ?? -1}" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-redo-it-status-step" data-step-index="${msg.stepIndex ?? -1}" ${confirmed ? 'disabled' : ''}>重做</button>
            <button type="button" class="btn-refine-modify" data-task-id="task5" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" data-task-id="task5" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'itStatusAllDoneConfirmBlock') {
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-pain-point-all-done-confirm';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = 'task5';
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '是否确认所有 IT 现状标注结果？')}</div>
          <div class="problem-detail-chat-pain-point-all-done-actions">
            <button type="button" class="btn-confirm-all-it-status btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认所有' : '确认所有'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'valueStreamDrawSessionsBlock') {
      const itemVs = __appState.currentProblemDetailItem;
      const sessions =
        itemVs?.valueStreamDrawSessions ||
        msg.sessions ||
        (typeof getDefaultValueStreamDrawSessions === 'function' ? getDefaultValueStreamDrawSessions() : []);
      const hasUnfinished =
        typeof window.valueStreamDrawSessionsHasUnfinished === 'function'
          ? window.valueStreamDrawSessionsHasUnfinished(sessions)
          : sessions.some((s) => !s.done);
      const renderSub = (subs) => {
        if (!Array.isArray(subs) || !subs.length) return '';
        return subs
          .map(
            (sub) =>
              `<div class="problem-detail-chat-vs-draw-session-item problem-detail-chat-vs-draw-session-sub"><span class="problem-detail-chat-vs-draw-session-name">${escapeHtml(sub.stepName || '')}</span><span class="problem-detail-chat-vs-draw-session-status ${sub.done ? 'session-done' : 'session-pending'}">${sub.done ? '已完成✅' : '待执行'}</span></div>`,
          )
          .join('');
      };
      const sessionsListHtml = sessions
        .map((s) => {
          const main = `<div class="problem-detail-chat-vs-draw-session-item"><span class="problem-detail-chat-vs-draw-session-name">${escapeHtml(s.stepName || '')}</span><span class="problem-detail-chat-vs-draw-session-status ${s.done ? 'session-done' : 'session-pending'}">${s.done ? '已完成✅' : '待执行'}</span></div>`;
          const subs = s.kind === 'hardening_per_stage' || Array.isArray(s.subSteps) ? renderSub(s.subSteps) : '';
          return main + subs;
        })
        .join('');
      const block = document.createElement('div');
      block.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-pain-point-sessions-card problem-detail-chat-vs-draw-sessions-card problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = 'task4';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-pain-point-sessions-card-wrap">
          <div class="problem-detail-chat-pain-point-sessions-card-header">价值流绘制 Session 计划</div>
          <div class="problem-detail-chat-pain-point-sessions-card-body">
            <div class="problem-detail-chat-pain-point-sessions-header">两主环节（第二阶段含各 VSM 阶段子任务），请点击下方按钮按顺序自动执行</div>
            <div class="problem-detail-chat-pain-point-sessions-list problem-detail-chat-vs-draw-sessions-list">${sessionsListHtml}</div>
          </div>
          <div class="problem-detail-chat-pain-point-sessions-actions">
            <button type="button" class="btn-auto-value-stream-draw-sessions btn-confirm-primary" ${!hasUnfinished ? 'disabled' : ''}>${!hasUnfinished ? '全部已完成' : '自动顺序执行'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'painPointStepCard') {
      const stepName = msg.stepName || `环节${(msg.stepIndex ?? 0) + 1}`;
      const content = msg.content != null ? String(msg.content) : '';
      const confirmed = !!msg.confirmed;
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-pain-point-step-card problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = 'task6';
      cardBlock.dataset.stepName = stepName;
      cardBlock.dataset.stepIndex = String(msg.stepIndex ?? -1);
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-pain-point-step-card-wrap">
          <div class="problem-detail-chat-pain-point-step-card-header">痛点标注：${escapeHtml(stepName)}</div>
          <div class="problem-detail-chat-pain-point-step-card-body"><div class="problem-detail-chat-pain-point-step-content">${escapeHtml(content || '—')}</div></div>
          <div class="problem-detail-chat-pain-point-step-card-actions">
            <button type="button" class="btn-confirm-pain-point-step btn-confirm-primary" data-step-index="${msg.stepIndex ?? -1}" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-redo-pain-point-step" data-step-index="${msg.stepIndex ?? -1}" ${confirmed ? 'disabled' : ''}>重做</button>
            <button type="button" class="btn-refine-modify" data-task-id="task6" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" data-task-id="task6" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'painPointAllDoneConfirmBlock') {
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-pain-point-all-done-confirm';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = 'task6';
      block.innerHTML = `
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '是否确认所有痛点标注结果？')}</div>
          <div class="problem-detail-chat-pain-point-all-done-actions">
            <button type="button" class="btn-confirm-all-pain-points btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认所有' : '确认所有'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'localItGapInputBlock' || msg.type === 'localItGapOutputBlock') {
      /* 输入/输出内容块仅时间线展示，聊天区不渲染 */
    } else if (msg.type === 'rolePermissionSessionsBlock') {
      const item = __appState.currentProblemDetailItem;
      const sessions = item?.rolePermissionSessions || msg.sessions || [];
      const sessionsConfirmed = !!msg.confirmed;
      const sessionsListHtml = sessions
        .map(
          (s) =>
            `<div class="problem-detail-chat-role-permission-session-item"><span class="problem-detail-chat-role-permission-session-name">${escapeHtml(s.stepName || `环节${s.stepIndex + 1}`)}</span><span class="problem-detail-chat-role-permission-session-status ${s.rolePermissionJson ? 'session-done' : 'session-pending'}">${s.rolePermissionJson ? '已推演✅' : '待推演'}</span></div>`
        )
        .join('');
      const actionLabelAuto = sessionsConfirmed ? '已选择：自动顺序执行' : '自动顺序执行';
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-role-permission-sessions-card problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = 'task10';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-role-permission-sessions-card-wrap">
          <div class="problem-detail-chat-role-permission-sessions-card-header">角色与权限模型推演 Session</div>
          <div class="problem-detail-chat-role-permission-sessions-card-body">
            <div class="problem-detail-chat-role-permission-sessions-header">已为 ${sessions.length} 个环节生成角色与权限模型推演 session</div>
            <div class="problem-detail-chat-role-permission-sessions-list">${sessionsListHtml}</div>
          </div>
          <div class="problem-detail-chat-role-permission-sessions-actions">
            <button type="button" class="btn-role-permission-sessions-auto btn-confirm-primary" ${sessionsConfirmed ? 'disabled' : ''}>${escapeHtml(actionLabelAuto)}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'coreBusinessObjectSessionsBlock') {
      const item = __appState.currentProblemDetailItem;
      const merged = resolveMergedCoreBusinessObjectSessions();
      const sessions = merged.length > 0 ? merged : (item?.coreBusinessObjectSessions || msg.sessions || []);
      const sessionsConfirmed = !!msg.confirmed;
      const sessionMode = msg.coreBusinessObjectSessionMode || '';
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-role-permission-sessions-card problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = 'task12';
      block.innerHTML = typeof buildCoreBusinessObjectSessionsBlockHtml === 'function'
        ? buildCoreBusinessObjectSessionsBlockHtml(sessions, msg.timestamp || '', DELETE_CHAT_MSG_ICON, sessionsConfirmed, sessionMode)
        : '';
      container.appendChild(block);
    } else if (msg.type === 'localItGapAnalysisCard') {
      const data = msg.data || {};
      const stepName = msg.stepName || '';
      const stepIndex = msg.stepIndex ?? -1;
      const confirmed = !!msg.confirmed;
      const structuredHtml = typeof buildLocalItGapStructuredHtml === 'function' ? buildLocalItGapStructuredHtml(data) : '<p>（暂无内容）</p>';
      const dataAttr = String(JSON.stringify(data)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-local-itgap-card problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = _taskId;
      cardBlock.dataset.stepName = stepName;
      cardBlock.dataset.stepIndex = String(stepIndex);
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-local-itgap-card-wrap">
          <div class="problem-detail-chat-local-itgap-card-header">对象状态机构建：${escapeHtml(stepName)}</div>
          <div class="problem-detail-chat-local-itgap-card-body">${structuredHtml}</div>
          <div class="problem-detail-chat-local-itgap-card-actions">
            <button type="button" class="btn-confirm-local-itgap btn-confirm-primary" data-json="${dataAttr}" data-step-name="${escapeHtml(stepName)}" data-step-index="${stepIndex}" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-redo-local-itgap" data-step-name="${escapeHtml(stepName)}" data-step-index="${stepIndex}" ${confirmed ? 'disabled' : ''}>重做</button>
            <button type="button" class="btn-refine-modify" data-task-id="task9" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" data-task-id="task9" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'localItGapAnalysisLog') {
      const taskLabel = msg.taskLabel || '对象状态机构建';
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-local-itgap-log problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-e2e-flow-log-task">${escapeHtml(taskLabel)}</div>
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '已生成对象状态机构建产出')}</div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(block);
    } else if (msg.type === 'localItGapAllDoneConfirmBlock') {
      const confirmed = !!msg.confirmed;
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-local-itgap-all-done-confirm problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = msg.taskId || 'task9';
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '已经完成所有环节输出，是否自动确认所有输出？')}</div>
          <div class="problem-detail-chat-task-completion-actions">
            <button type="button" class="btn-confirm-all-local-itgap-outputs btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认所有输出'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'localItGapTaskCompleteConfirmBlock') {
      const confirmed = !!msg.confirmed;
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-local-itgap-task-complete-confirm problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = msg.taskId || 'task9';
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '是否确认对象状态机构建任务已经完成？')}</div>
          <div class="problem-detail-chat-task-completion-actions">
            <button type="button" class="btn-confirm-local-itgap-task-complete btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'localItGapCompressionIntentBlock') {
      const confirmed = !!msg.confirmed;
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-local-itgap-compression-intent problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = msg.taskId || 'task9';
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '我即将开始对对象状态机构建做上下文压缩，便于后续环节的处理。')}</div>
          <div class="problem-detail-chat-task-completion-actions">
            <button type="button" class="btn-confirm-local-itgap-compression btn-confirm-primary" disabled title="该步骤已下线">${confirmed ? '已确认' : '已下线'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'rolePermissionAuditIntentBlock') {
      const confirmed = !!msg.confirmed;
      const skipped = !!msg.auditSkippedByUser;
      const confirmLabel = !confirmed ? '已下线' : skipped ? '确认' : '已确认';
      const skipLabel = skipped ? '已无需审计' : '已下线';
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-role-permission-audit-intent problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = msg.taskId || 'task12';
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '我即将对角色与权限推演结果进行审计')}</div>
          <div class="problem-detail-chat-task-completion-actions">
            <button type="button" class="btn-confirm-role-permission-audit btn-confirm-primary" disabled title="角色与权限独立任务已下线">${confirmLabel}</button>
            <button type="button" class="btn-skip-role-permission-audit btn-task-complete-not-yet" disabled title="角色与权限独立任务已下线">${skipLabel}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'coreBusinessObjectGlobalAuditIntentBlock') {
      const confirmed = !!msg.confirmed;
      const skipped = !!msg.auditSkippedByUser;
      const confirmLabel = !confirmed ? '确认' : skipped ? '确认' : '已确认';
      const skipLabel = skipped ? '已无需审计' : '无需继续审计';
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-role-permission-audit-intent problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = msg.taskId || 'task12';
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '我即将开始对核心业务对象推演进行审计')}</div>
          <div class="problem-detail-chat-task-completion-actions">
            <button type="button" class="btn-confirm-core-business-object-audit btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmLabel}</button>
            <button type="button" class="btn-skip-core-business-object-audit" ${confirmed ? 'disabled' : ''}>${skipLabel}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'coreBusinessObjectGlobalAuditResultBlock') {
      const used = !!msg.modificationExtractUsed;
      const bodyRaw = String(msg.auditOpinionRaw != null ? msg.auditOpinionRaw : msg.content || '').trim() || '（无）';
      const defectItems =
        Array.isArray(msg.auditDefectItems) && msg.auditDefectItems.length > 0
          ? msg.auditDefectItems
          : parseCoreBusinessObjectGlobalAuditDefectItems(bodyRaw);
      const selectedSet = new Set(
        Array.isArray(msg.selectedAuditDefectIndexes)
          ? msg.selectedAuditDefectIndexes.map((n) => Number(n)).filter((n) => Number.isInteger(n))
          : [],
      );
      const optionsHtml =
        defectItems.length > 0
          ? `<div class="problem-detail-chat-role-permission-audit-options">${defectItems
              .map((it, i) => {
                const checked = selectedSet.size === 0 ? true : selectedSet.has(i);
                return `<label class="problem-detail-chat-role-permission-audit-option problem-detail-chat-role-permission-audit-option-card"><input type="checkbox" class="role-permission-audit-defect-checkbox" data-defect-index="${i}" ${checked ? 'checked' : ''} ${used ? 'disabled' : ''}/><div class="problem-detail-chat-role-permission-audit-defect-card"><div class="problem-detail-chat-role-permission-audit-defect-title">缺陷 ${i + 1}</div><div class="problem-detail-chat-role-permission-audit-defect-row"><span class="problem-detail-chat-role-permission-audit-defect-key">缺陷类型</span><span class="problem-detail-chat-role-permission-audit-defect-val">${escapeHtml(String(it?.principle || '（未提供）'))}</span></div><div class="problem-detail-chat-role-permission-audit-defect-row"><span class="problem-detail-chat-role-permission-audit-defect-key">涉及对象/环节</span><span class="problem-detail-chat-role-permission-audit-defect-val">${escapeHtml(String(it?.roleStep || '（未提供）'))}</span></div><div class="problem-detail-chat-role-permission-audit-defect-row"><span class="problem-detail-chat-role-permission-audit-defect-key">风险描述</span><span class="problem-detail-chat-role-permission-audit-defect-val">${escapeHtml(String(it?.problemDescription || '（未提供）'))}</span></div><div class="problem-detail-chat-role-permission-audit-defect-row"><span class="problem-detail-chat-role-permission-audit-defect-key">修正建议</span><span class="problem-detail-chat-role-permission-audit-defect-val">${escapeHtml(String(it?.refactorInstruction || '（未提供）'))}</span></div></div></label>`;
              })
              .join('')}</div>`
          : '';
      const cardBlock = document.createElement('div');
      cardBlock.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-role-permission-audit-result problem-detail-chat-cbo-global-audit-result problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = msg.taskId || 'task12';
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content problem-detail-chat-role-permission-audit-result-title">核心业务对象全局审计意见</div>
          ${optionsHtml}
          <div class="problem-detail-modification-response-actions">
            <button type="button" class="btn-cbo-global-audit-extract-modification btn-confirm-primary" ${used ? 'disabled' : ''}>${used ? '已确定' : '确定'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'rolePermissionAuditResultBlock') {
      const used = !!msg.modificationExtractUsed;
      const bodyRaw = String(msg.auditOpinionRaw != null ? msg.auditOpinionRaw : msg.content || '').trim() || '（无）';
      const defectItems =
        Array.isArray(msg.auditDefectItems) && msg.auditDefectItems.length > 0
          ? msg.auditDefectItems
          : parseRolePermissionAuditDefectItems(bodyRaw);
      const selectedSet = new Set(
        Array.isArray(msg.selectedAuditDefectIndexes)
          ? msg.selectedAuditDefectIndexes.map((n) => Number(n)).filter((n) => Number.isInteger(n))
          : [],
      );
      const optionsHtml = defectItems.length > 0
        ? `<div class="problem-detail-chat-role-permission-audit-options">${defectItems.map((it, i) => {
            const checked = selectedSet.size === 0 ? true : selectedSet.has(i);
            return `<label class="problem-detail-chat-role-permission-audit-option problem-detail-chat-role-permission-audit-option-card"><input type="checkbox" class="role-permission-audit-defect-checkbox" data-defect-index="${i}" ${checked ? 'checked' : ''} ${used ? 'disabled' : ''}/><div class="problem-detail-chat-role-permission-audit-defect-card"><div class="problem-detail-chat-role-permission-audit-defect-title">缺陷 ${i + 1}</div><div class="problem-detail-chat-role-permission-audit-defect-row"><span class="problem-detail-chat-role-permission-audit-defect-key">违反准则</span><span class="problem-detail-chat-role-permission-audit-defect-val">${escapeHtml(String(it?.principle || '（未提供）'))}</span></div><div class="problem-detail-chat-role-permission-audit-defect-row"><span class="problem-detail-chat-role-permission-audit-defect-key">涉及角色/环节</span><span class="problem-detail-chat-role-permission-audit-defect-val">${escapeHtml(String(it?.roleStep || '（未提供）'))}</span></div><div class="problem-detail-chat-role-permission-audit-defect-row"><span class="problem-detail-chat-role-permission-audit-defect-key">问题描述</span><span class="problem-detail-chat-role-permission-audit-defect-val">${escapeHtml(String(it?.problemDescription || '（未提供）'))}</span></div><div class="problem-detail-chat-role-permission-audit-defect-row"><span class="problem-detail-chat-role-permission-audit-defect-key">重构指令</span><span class="problem-detail-chat-role-permission-audit-defect-val">${escapeHtml(String(it?.refactorInstruction || '（未提供）'))}</span></div></div></label>`;
          }).join('')}</div>`
        : '';
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-role-permission-audit-result problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = msg.taskId || 'task10';
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content problem-detail-chat-role-permission-audit-result-title">角色与权限合规审计意见</div>
          ${optionsHtml}
          <div class="problem-detail-modification-response-actions">
            <button type="button" class="btn-role-permission-audit-extract-modification btn-confirm-primary" ${used ? 'disabled' : ''}>${used ? '已提炼' : '提炼修改意见'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'llmRetryNoticeBlock') {
      const retryAction = String(msg.retryAction || 'continue-current-task');
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = msg.taskId || '';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '大模型调用失败，请稍后重试。')}</div>
          <div class="problem-detail-chat-task-completion-actions">
            <button type="button" class="btn-retry-llm-call btn-confirm-primary" data-retry-action="${escapeHtml(retryAction)}">重新尝试</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'llmResumeIntentBlock') {
      const confirmed = !!msg.confirmed;
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = msg.taskId || '';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <div class="problem-detail-chat-msg-content">${escapeHtml(msg.content || '我将继续进行当前任务的大模型调用')}</div>
          <div class="problem-detail-chat-task-completion-actions">
            <button type="button" class="btn-confirm-llm-resume btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'localItGapCompressionBlock') {
      /* 压缩内容块仅时间线展示，聊天区不渲染 */
    } else if (msg.type === 'intentExtractionCard') {
      const data = msg.data || {};
      const confirmed = !!msg.confirmed;
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const intentLabels = { query: '简单查询', modification: '反馈修改意见', execute: '执行操作', discussion: '讨论请教' };
      const intentLabel = intentLabels[data.intent] || data.intent || '—';
      const rows = [
        { label: '当前任务', value: `${data.taskName || '—'}（${data.stage || '—'}）` },
        { label: '意图类型', value: intentLabel },
        { label: '意图概括', value: data.summary || '—' },
      ];
      if (data.intent === 'query' && data.queryTarget) rows.push({ label: '查询内容', value: data.queryTarget });
      if (data.intent === 'discussion' && data.discussionTopic) rows.push({ label: '讨论话题', value: data.discussionTopic });
      if (data.intent === 'modification' && data.modificationTarget) {
        let modVal = data.modificationTarget;
        if (data.modificationField) modVal += ` → ${data.modificationField}`;
        rows.push({ label: '修改目标', value: modVal });
      }
      if (data.intent === 'execute' && data.executeTaskName) rows.push({ label: '执行任务', value: data.executeTaskName });
      const vsLvl = data.modificationValueStreamLevel || data.queryValueStreamLevel;
      const vsTgt = data.modificationValueStreamTarget || data.queryValueStreamTarget;
      if (vsLvl) {
        const vsLvlLabel = { step: '环节', stage: '阶段', card: '整图' }[vsLvl] || vsLvl;
        rows.push({ label: '价值流范围', value: vsTgt ? `${vsLvlLabel}：${vsTgt}` : vsLvlLabel });
      }
      const rowsHtml = rows.map((r) => `<div class="problem-detail-basic-info-row"><span class="problem-detail-basic-info-label">${escapeHtml(r.label)}</span><span class="problem-detail-basic-info-value">${escapeHtml(r.value)}</span></div>`).join('');
      const dataAttr = String(JSON.stringify(data)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const userTextAttr = (msg.userText || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-intent-card';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = _taskId;
      const rejectBtnHtml = confirmed ? '' : `<button type="button" class="btn-reject-intent-extraction" data-user-text="${userTextAttr}">不对</button>`;
      cardBlock.innerHTML = `
        <div class="problem-detail-basic-info-card problem-detail-intent-card-inner">
          <div class="problem-detail-basic-info-card-body">${rowsHtml}</div>
          <div class="problem-detail-basic-info-card-actions">
            <button type="button" class="btn-confirm-intent-extraction" data-extracted="${dataAttr}" data-user-text="${userTextAttr}" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-refine-modify" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" ${confirmed ? 'disabled' : ''}>讨论</button>
            ${rejectBtnHtml}
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(cardBlock);
    } else if (msg.type === 'basicInfoCard') {
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-card-collapsible problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = _taskId;
      const labels = [
        { key: 'company_name', label: '公司名称' },
        { key: 'credit_code', label: '信用代码' },
        { key: 'legal_representative', label: '法人' },
        { key: 'established_date', label: '成立时间' },
        { key: 'registered_capital', label: '注册资本' },
        { key: 'is_listed', label: '是否上市' },
        { key: 'listing_location', label: '上市地' },
        { key: 'business_scope', label: '经营范围' },
        { key: 'core_qualifications', label: '核心资质' },
        { key: 'official_website', label: '官方网站' },
      ];
      const data = msg.data || {};
      const rows = labels.map(({ key, label }) => {
        const value = (data[key] != null ? String(data[key]).trim() : '') || '—';
        return `<div class="problem-detail-basic-info-row"><span class="problem-detail-basic-info-label">${escapeHtml(label)}</span><span class="problem-detail-basic-info-value">${escapeHtml(value)}</span></div>`;
      }).join('');
      const confirmed = !!msg.confirmed;
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      cardBlock.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-basic-info-card" role="button" tabindex="0">
          <div class="problem-detail-basic-info-card-body">${rows}</div>
          <div class="problem-detail-basic-info-card-actions">
            <button type="button" class="btn-confirm-basic-info btn-confirm-primary" data-json="${String(JSON.stringify(data)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认'}</button>
            <button type="button" class="btn-redo-basic-info" ${confirmed ? 'disabled' : ''}>重做</button>
            <button type="button" class="btn-refine-modify" ${confirmed ? 'disabled' : ''}>修正</button>
            <button type="button" class="btn-refine-discuss" ${confirmed ? 'disabled' : ''}>讨论</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(cardBlock);
      setupProblemDetailChatCardToggle(cardBlock);
    } else if (msg.type === 'unsatisfiedBlock') {
      const block = document.createElement('div');
      block.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-unsatisfied problem-detail-chat-msg-with-delete';
      block.dataset.msgIndex = String(idx);
      block.dataset.taskId = msg.taskId || '';
      block.innerHTML = `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
        <div class="problem-detail-chat-msg-content-wrap">
          <span class="problem-detail-history-log-type-tag problem-detail-history-log-type-unsatisfied">不满意</span>
          <div class="problem-detail-chat-msg-content">用户表示不满意，请描述修改意见（输入后发送）</div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>`;
      container.appendChild(block);
    } else if (msg.type === 'modificationIntentConfirmBlock') {
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-intent-card';
      cardBlock.dataset.msgIndex = String(idx);
      cardBlock.dataset.taskId = msg.taskId || '';
      const confirmed = !!msg.confirmed;
      cardBlock.innerHTML = `
        <div class="problem-detail-basic-info-card problem-detail-intent-card-inner">
          <div class="problem-detail-basic-info-card-body">
            <div class="problem-detail-basic-info-row"><span class="problem-detail-basic-info-label">类型</span><span class="problem-detail-basic-info-value">修改意图提炼</span></div>
            <div class="problem-detail-basic-info-row"><span class="problem-detail-basic-info-label">修改动因</span><span class="problem-detail-basic-info-value">${escapeHtml(msg.modificationReason || '—')}</span></div>
            <div class="problem-detail-basic-info-row"><span class="problem-detail-basic-info-label">修改目标</span><span class="problem-detail-basic-info-value">${escapeHtml(msg.modificationGoal || '—')}</span></div>
          </div>
          <div class="problem-detail-basic-info-card-actions">
            <button type="button" class="btn-confirm-modification-intent btn-confirm-primary" ${confirmed ? 'disabled' : ''}>${confirmed ? '已确认' : '确认并生成新提示词'}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(cardBlock);
    } else {
      const block = document.createElement('div');
      const collapsibleClass = msg.role === 'user' ? ' problem-detail-chat-msg-collapsible' : '';
      let innerHtml = '';
      if (msg.hasCheck) {
        innerHtml = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content markdown-body">${renderMarkdown(msg.content)}</div><span class="problem-detail-chat-check" aria-hidden="true">✅</span></div>`;
      } else {
        innerHtml = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content markdown-body">${renderMarkdown(msg.content)}</div></div>`;
      }
      const llmMetaHtml = msg.llmMeta ? buildLlmMetaHtml(msg.llmMeta) : '';
      block.className = `problem-detail-chat-msg problem-detail-chat-msg-${msg.role}${collapsibleClass} problem-detail-chat-msg-with-delete`;
      block.dataset.msgIndex = String(idx);
      block.innerHTML = `<button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>${innerHtml}<div class="problem-detail-chat-msg-time">${fmtChatTs(msg.timestamp)}</div>${llmMetaHtml}`;
      container.appendChild(block);
      if (msg.role === 'user') setupProblemDetailChatTextToggle(block);
    }
  });
  // 主聊天区与「沟通历史」分工：大量类型（如 task1LlmQueryBlock、modificationRegenerateLlmQueryBlock）仅写入数组供过程日志展示，此处不 append，可能导致列表非空但主区空白。
  const renderedDomCount = container ? container.children.length : 0;
  if (list.length > 0 && renderedDomCount === 0) {
    const typeCounts = {};
    list.forEach((m) => {
      const k = m?.type || (m?.role === 'user' ? 'user' : m?.role === 'system' ? 'system_plain' : '?');
      typeCounts[k] = (typeCounts[k] || 0) + 1;
    });
    logTask1PrelimStatus('renderChat.mainSkipsAll', {
      msgLength: list.length,
      typeCounts,
      hint: '主聊天区仅渲染可交互卡片；LLM-查询/合并等仅出现在沟通历史过程日志',
    });
    if (shouldLogTask1PrelimLlm()) {
      try {
        console.info('[FE:task1-prelim-llm]', 'renderChat.mainSkipsAll', { msgLength: list.length, typeCounts });
      } catch (_) {}
    }
    const hintBlock = document.createElement('div');
    hintBlock.className =
      'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-main-empty-hint';
    hintBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">当前主聊天区仅展示可交互对话卡片。本案例会话中仍有 <strong>${list.length}</strong> 条记录（含已写入过程日志的 LLM-查询/合并等），完整内容请在右侧「沟通历史」→「过程日志」中查看。</div></div><div class="problem-detail-chat-msg-time">${fmtChatTs(typeof getTimeStr === 'function' ? getTimeStr() : '')}</div>`;
    container.appendChild(hintBlock);
  }
}

function appendProblemDetailChatMessage(container, role, content, options) {
  return problemDetailChatBridge.appendMessage(container, role, content, options);
}

function pushAndSaveProblemDetailChat(msg) {
  problemDetailChatBridge.pushAndSave(msg);
}

/** 获取当前用于渲染工作区 BMC 的 base bmc data：优先当前条目 bmc，否则取聊天中最后一张 bmcCard 的 data */
function getBaseBmcData() {
  // [bridge] → core/task2-companion-runtime.js (Phase 4A)
  return globalThis.SmartCto.task2Runtime.getBaseBmcData();
}

/** 讨论模式开始后的历史交互（时间线）：从最后一条 bmcDiscussionStartBlock 之后到 bmcDiscussionEndBlock 或当前用户消息之前，格式化为 { role, content }[] */
function getBmcDiscussionHistory() {
  // [bridge] → core/task2-companion-runtime.js (Phase 4A)
  return globalThis.SmartCto.task2Runtime.getBmcDiscussionHistory();
}

function setupProblemDetailChatTextToggle(msgBlock) {
  problemDetailChatBridge.setupChatTextToggle(msgBlock);
}

function setupProblemDetailChatCardToggle(cardBlock) {
  problemDetailChatBridge.setupChatCardToggle(cardBlock);
}

function setupProblemDetailBmcCardToggle(cardBlock) {
  problemDetailChatBridge.setupBmcCardToggle(cardBlock);
}

function setupProblemDetailRequirementLogicCardToggle(cardBlock) {
  const card = cardBlock?.querySelector('.problem-detail-basic-info-card');
  if (!card) return;
  card.addEventListener('click', (e) => {
    if (e.target.closest('.btn-confirm-requirement-logic') || e.target.closest('.btn-redo-requirement-logic') || e.target.closest('.btn-refine-modify') || e.target.closest('.btn-refine-discuss')) return;
    cardBlock.classList.toggle('problem-detail-chat-card-expanded');
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!e.target.closest('.btn-confirm-requirement-logic') && !e.target.closest('.btn-redo-requirement-logic') && !e.target.closest('.btn-refine-modify') && !e.target.closest('.btn-refine-discuss')) {
        cardBlock.classList.toggle('problem-detail-chat-card-expanded');
      }
    }
  });
  const confirmBtn = cardBlock.querySelector('.btn-confirm-requirement-logic');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmBtn.disabled = true;
      confirmBtn.textContent = '已确认';
      let idx = -1;
      for (let i = __appState.problemDetailChatMessages.length - 1; i >= 0; i--) {
        if (__appState.problemDetailChatMessages[i].type === 'requirementLogicBlock') {
          idx = i;
          break;
        }
      }
      if (idx >= 0) {
        __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true };
        for (let j = idx - 1; j >= 0; j--) {
          const q = __appState.problemDetailChatMessages[j];
          if (q?.type === 'task3LlmQueryBlock') {
            __appState.problemDetailChatMessages[j] = { ...q, confirmed: true };
            break;
          }
        }
        saveProblemDetailChat(__appState.currentProblemDetailItem?.createdAt, __appState.problemDetailChatMessages);
      }
      const item = __appState.currentProblemDetailItem;
      if (item?.createdAt) {
        updateDigitalProblemRequirementLogic(item.createdAt, item.requirementLogic, false);
        renderProblemDetailContent();
      }
      renderProblemDetailHistory();
      requestAnimationFrame(() => {
        showTaskCompletionConfirm('task3', (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === 'task3')?.name) || '需求逻辑构建');
      });
    });
  }
}

function setupProblemDetailValueStreamTabs(container) {
  problemDetailChatBridge.setupValueStreamTabs(container);
}

function setupProblemDetailE2eFlowFullscreen(container) {
  problemDetailChatBridge.setupE2eFlowFullscreen?.(container);
}

function setupProblemDetailItDesignSupplementFullscreen(container) {
  problemDetailChatBridge.setupItDesignSupplementFullscreen?.(container);
}

function setupProblemDetailPreliminaryFullscreen(container) {
  problemDetailChatBridge.setupProblemDetailPreliminaryFullscreen?.(container);
}

function setupProblemDetailBmcWorkspace(container) {
  problemDetailChatBridge.setupProblemDetailBmcWorkspace?.(container);
}

function setupProblemDetailE2eBpmTxPreview(container) {
  problemDetailChatBridge.setupE2eBpmTxPreview?.(container);
}

function setupProblemDetailJsonBlockToggle(jsonBlock) {
  problemDetailChatBridge.setupJsonBlockToggle(jsonBlock);
}

const MODIFICATION_CLARIFICATION_TEXT = '请明确具体修改需求：您要修改的具体内容是什么？希望改成什么？';

async function handleProblemDetailChatSend(options) {
  // [bridge] → core/problem-detail-runtime.js (Phase 3B)
  __ensureProblemDetailRuntimeHostMounted();
  return globalThis.SmartCto.problemDetailRuntime.handleProblemDetailChatSend(options);
}


const PROBLEM_DETAIL_MAJOR_STAGE_LABELS = ['需求理解', '工作流对齐', 'ITGap分析', 'IT策略规划'];

/** 任务编号前缀（与 task1~task15 一致，圈号数字风格统一） */
const CIRCLED_TASK_NUMBER_PREFIX = [
  '',
  '①',
  '②',
  '③',
  '④',
  '⑤',
  '⑥',
  '⑦',
  '⑧',
  '⑨',
  '⑩',
  '⑪',
  '⑫',
  '⑬',
  '⑭',
  '⑮',
];

function withTaskNumberPrefix(taskId, name) {
  const m = String(taskId || '').match(/^task(\d{1,2})$/);
  const n = m ? parseInt(m[1], 10) : NaN;
  const prefix = !Number.isNaN(n) ? (CIRCLED_TASK_NUMBER_PREFIX[n] || '') : '';
  return prefix ? `${prefix} ${name}` : name;
}

/** 根据意图提炼结果，将工作区定位到对应页面并高亮修改目标 */
function focusWorkspaceOnIntent(extracted) {
  const container = el.problemDetailContent;
  if (!container) return;
  const item = __appState.currentProblemDetailItem;
  if (!item) return;
  // 对于全局/宏观查询（当前任务为「整个任务」），不需要跳转或高亮具体工作区
  if (extracted.intent === 'query' && (extracted.taskName === '整个任务' || extracted.taskId === 'all')) return;
  const taskId = extracted.taskId || extracted.executeTaskId;
  if (!taskId) return;
  let cardTaskId = taskId;
  if (['task5', 'task6'].includes(taskId)) cardTaskId = 'task4';
  else if (taskId === 'task7') cardTaskId = 'e2e-flow';
  else if (taskId === 'task8') cardTaskId = 'global-itgap';
  else if (taskId === 'task9') cardTaskId = 'local-itgap';
  else if (['task12', 'task13', 'task14', 'task15'].includes(taskId)) cardTaskId = taskId;
  const currentMajorStage = item.currentMajorStage ?? 0;
  let targetMajorStage = 0;
  if (['task1', 'task2', 'task3'].includes(taskId)) targetMajorStage = 0;
  else if (['task4', 'task5', 'task6'].includes(taskId)) targetMajorStage = 1;
  else if (['task7', 'task8', 'task9'].includes(taskId)) targetMajorStage = 2;
  else if (['task12', 'task13', 'task14', 'task15'].includes(taskId)) targetMajorStage = 3;
  else targetMajorStage = 1;
  if (['task12', 'task13', 'task14', 'task15'].includes(taskId)) {
    const substepMap = { task12: 0, task13: 1, task14: 2, task15: 3 };
    itStrategyPlanViewingSubstep = substepMap[taskId];
  }
  if (problemDetailViewingMajorStage !== targetMajorStage) {
    problemDetailViewingMajorStage = Math.min(targetMajorStage, currentMajorStage);
    updateProblemDetailProgressStages(currentMajorStage, problemDetailViewingMajorStage);
    renderProblemDetailContent();
  }
  requestAnimationFrame(() => {
    const targetCard = container.querySelector(`[data-task-id="${cardTaskId}"]`);
    let scrollTarget = targetCard;
    container.querySelectorAll('.modify-target-highlight').forEach((el) => el.classList.remove('modify-target-highlight'));
    const isModification = extracted.intent === 'modification';
    const isQuery = extracted.intent === 'query';
    const modTarget = String(extracted.modificationTarget || '').toLowerCase();
    const queryTarget = String(extracted.queryTarget || '').toLowerCase();
    const modField = String(extracted.modificationField || '').trim();
    const vsLevel = String(extracted.modificationValueStreamLevel || extracted.queryValueStreamLevel || '').toLowerCase();
    const vsTarget = String(extracted.modificationValueStreamTarget || extracted.queryValueStreamTarget || '').trim();
    const isValueStreamRelated = (modTarget + queryTarget).includes('价值流') || (modTarget + queryTarget).includes('it现状') || (modTarget + queryTarget).includes('痛点') || ['task4', 'task5', 'task6'].includes(taskId);
    const isLocalItGapRelated = taskId === 'task9' || (modTarget + queryTarget).includes('局部') || (modTarget + queryTarget).includes('itgap');
    let highlightEl = null;
    if (isModification || (isQuery && (isValueStreamRelated || isLocalItGapRelated))) {
      if (isLocalItGapRelated && (vsTarget || queryTarget || modTarget)) {
        const targetName = (vsTarget || queryTarget || modTarget).trim();
        if (targetName) {
          const subcards = container.querySelectorAll('.problem-detail-local-itgap-subcard');
          for (const subcard of subcards) {
            const titleEl = subcard.querySelector('.problem-detail-local-itgap-subcard-title');
            const name = (titleEl?.textContent || '').trim();
            if (name && (name === targetName || name.includes(targetName) || targetName.includes(name))) {
              highlightEl = subcard;
              const header = subcard.querySelector('.problem-detail-local-itgap-subcard-header');
              const body = subcard.querySelector('.problem-detail-local-itgap-subcard-body');
              if (header && body && body.hidden) {
                header.click();
              }
              break;
            }
          }
        }
        if (!highlightEl) {
          highlightEl = container.querySelector('[data-task-id="local-itgap"]');
        }
      }
      if (!highlightEl) {
        const fieldAliases = { '客户名称': ['公司名称', '客户名称'], '公司名称': ['公司名称'], '企业名称': ['企业名称'] };
        const possibleFields = modField ? (fieldAliases[modField] || [modField]) : [];
        for (const fieldName of possibleFields) {
          const el = container.querySelector(`[data-field="${fieldName}"]`);
          if (el) {
            highlightEl = el;
            break;
          }
        }
      }
      if (!highlightEl && modField) {
        highlightEl = container.querySelector(`[data-field="${modField}"]`);
      }
      if (!highlightEl && isValueStreamRelated && !isLocalItGapRelated && vsLevel !== 'card') {
        const targetName = vsTarget || modField;
        if ((vsLevel === 'step' || (!vsLevel && targetName)) && targetName) {
          const stepNodes = container.querySelectorAll('[data-vs-step-name]');
          for (const node of stepNodes) {
            const name = (node.getAttribute('data-vs-step-name') || '').trim();
            if (name && (name === targetName || name.includes(targetName) || targetName.includes(name))) {
              highlightEl = node;
              break;
            }
          }
        }
        if (!highlightEl && (vsLevel === 'stage' || (vsLevel !== 'card' && targetName))) {
          const stageNodes = container.querySelectorAll('.vs-stage-node[data-vs-stage-name]');
          for (const node of stageNodes) {
            const name = (node.getAttribute('data-vs-stage-name') || '').trim();
            if (name && (name === targetName || name.includes(targetName) || targetName.includes(name))) {
              highlightEl = node;
              break;
            }
          }
        }
        if (!highlightEl && isValueStreamRelated) {
          highlightEl = container.querySelector('[data-task-id="task4"]');
        }
      }
      if (!highlightEl) {
        if (modTarget.includes('企业基本信息') || modTarget.includes('基本信息') || modTarget.includes('客户基本信息')) {
          highlightEl = container.querySelector('[data-task-id="task1"]');
        } else if (modTarget.includes('bmc') || modTarget.includes('商业画布') || modTarget.includes('商业模式')) {
          highlightEl = container.querySelector('[data-task-id="task2"]');
        } else if (modTarget.includes('需求逻辑')) {
          highlightEl = container.querySelector('[data-task-id="task3"]');
        } else if (isValueStreamRelated) {
          highlightEl = container.querySelector('[data-task-id="task4"]');
        } else {
          highlightEl = targetCard;
        }
      }
      if (highlightEl) {
        highlightEl.classList.add('modify-target-highlight');
        scrollTarget = highlightEl;
      }
    }
    if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
if (typeof window !== 'undefined') window.renderProblemDetailChatFromStorage = renderProblemDetailChatFromStorage;

function renderProblemDetailContent() {
  // [bridge] → core/problem-detail-runtime.js (Phase 3B)
  __ensureProblemDetailRuntimeHostMounted();
  globalThis.SmartCto.problemDetailRuntime.renderProblemDetailContent();
  maybeFocusWorkspaceAfterCanonicalTaskChange();
}

/**
 * 删除「历史详情」中指定下标的条目并落库重绘。
 * - 若 `item.requirementDetailHistory` 非空：按数组下标删除。
 * - 若为虚拟单条（无历史数组、仅展示当前 `requirementDetail`）：仅允许下标 0，清空 `requirementDetail` 与 `preliminaryReq.requirementDetail`（若存在）。
 */
function deletePreliminaryHistoryItemAt(index) {
  const item = __appState.currentProblemDetailItem;
  if (!item || typeof index !== 'number' || index < 0 || !Number.isFinite(index)) return false;
  const persistKey = getDigitalProblemPersistKey(item);
  if (!persistKey) {
    showError('无法保存：缺少案例标识');
    return false;
  }
  const storedHist = Array.isArray(item.requirementDetailHistory) ? [...item.requirementDetailHistory] : [];
  const hasStoredHist = storedHist.length > 0;
  /** @type {Record<string, unknown>} */
  const patch = {};

  if (hasStoredHist) {
    if (index >= storedHist.length) return false;
    patch.requirementDetailHistory = storedHist.filter((_, i) => i !== index);
  } else {
    if (index !== 0) return false;
    patch.requirementDetail = '';
    patch.requirementDetailHistory = [];
    if (item.preliminaryReq && typeof item.preliminaryReq === 'object' && item.preliminaryReq.requirementDetail != null) {
      patch.preliminaryReq = { ...item.preliminaryReq, requirementDetail: '' };
    }
  }

  mergeDigitalProblemPatch(persistKey, patch);
  renderProblemDetailContent();
  return true;
}

/** 初步需求卡片「历史详情」Tab 内可折叠项：点击标题主区展开/收起；删除钮单独处理（事件委托，避免被卡片头部折叠拦截） */
function setupPreliminaryHistoryItemToggle(container) {
  const log = (msg, data) => {
    if (typeof globalThis !== 'undefined' && globalThis.__FE_PRELIM_HISTORY_DEBUG && typeof console !== 'undefined' && console.log) {
      console.log('[PreliminaryHistoryToggle]', msg, data !== undefined ? data : '');
    }
  };
  if (!container) {
    log('setup skipped: no container');
    return;
  }
  const card = container.querySelector('.problem-detail-card[data-task-id="preliminary"]');
  if (!card) {
    log('setup skipped: preliminary card not found in container');
    return;
  }
  const headersInCard = card.querySelectorAll('.preliminary-history-item-header-main');
  const historyPanel = card.querySelector('.problem-detail-card-body-preliminary-history');
  log('setup ok', {
    cardFound: !!card,
    headersCount: headersInCard.length,
    historyPanelHidden: historyPanel ? historyPanel.hidden : 'no panel',
    historyPanelInnerHTMLLength: historyPanel ? (historyPanel.innerHTML || '').length : 0,
  });
  card.addEventListener('click', (e) => {
    const delBtn = e.target.closest('.preliminary-history-item-delete-btn');
    if (delBtn) {
      e.preventDefault();
      e.stopPropagation();
      const itemEl = delBtn.closest('.preliminary-history-item');
      const idxRaw = itemEl?.getAttribute('data-index');
      const idx = idxRaw != null ? parseInt(idxRaw, 10) : NaN;
      if (Number.isNaN(idx)) return;
      deletePreliminaryHistoryItemAt(idx);
      return;
    }
    const header = e.target.closest('.preliminary-history-item-header-main');
    log('card click', { targetTag: e.target?.tagName, targetClass: e.target?.className, headerFound: !!header });
    if (!header) return;
    e.preventDefault();
    e.stopPropagation();
    const itemEl = header.closest('.preliminary-history-item');
    const body = itemEl?.querySelector('.preliminary-history-item-body');
    if (!body) {
      log('header clicked but body not found', { itemEl: !!itemEl });
      return;
    }
    const wasExpanded = body.hasAttribute('hidden') === false;
    const expanded = !wasExpanded;
    if (expanded) {
      body.removeAttribute('hidden');
    } else {
      body.setAttribute('hidden', '');
    }
    header.setAttribute('aria-expanded', String(expanded));
    itemEl.classList.toggle('preliminary-history-item-expanded', expanded);
    log('toggled', { wasExpanded, expanded });
  });
  card.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const header = e.target.closest('.preliminary-history-item-header-main');
    if (!header) return;
    e.preventDefault();
    const itemEl = header.closest('.preliminary-history-item');
    const body = itemEl?.querySelector('.preliminary-history-item-body');
    if (!body) return;
    const wasExpanded = body.hasAttribute('hidden') === false;
    const expanded = !wasExpanded;
    if (expanded) {
      body.removeAttribute('hidden');
    } else {
      body.setAttribute('hidden', '');
    }
    header.setAttribute('aria-expanded', String(expanded));
    itemEl.classList.toggle('preliminary-history-item-expanded', expanded);
    log('toggled (keydown)', { wasExpanded, expanded });
  });
}

function setupRoleCardToggle() {
  if (el.problemDetailContent?.dataset.roleCardToggleBound === '1') return;
  if (!el.problemDetailContent) return;
  el.problemDetailContent.dataset.roleCardToggleBound = '1';
  el.problemDetailContent.addEventListener('click', (e) => {
    const header = e.target.closest('.problem-detail-role-card-header');
    if (!header || header.closest('.problem-detail-role-permission-tab')) return;
    const card = header.closest('.problem-detail-role-card');
    const body = card?.querySelector('.problem-detail-role-card-body');
    if (!body) return;
    const willExpand = body.hidden;
    const container = card?.closest('.problem-detail-role-permission-view-roles');
    const allCards = container ? container.querySelectorAll('.problem-detail-role-card') : [card];
    allCards.forEach((c) => {
      const b = c.querySelector('.problem-detail-role-card-body');
      const h = c.querySelector('.problem-detail-role-card-header');
      if (b && h) {
        b.hidden = !willExpand;
        h.setAttribute('aria-expanded', String(willExpand));
        h.classList.toggle('problem-detail-role-card-header-collapsed', !willExpand);
      }
    });
  });
  el.problemDetailContent.addEventListener('keydown', (e) => {
    const header = e.target.closest('.problem-detail-role-card-header');
    if (!header || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    header.click();
  });
}

function setupRolePermissionStepTabs() {
  setupRoleCardToggle();
  el.problemDetailContent?.querySelectorAll('.problem-detail-role-permission-tabs').forEach((tabsWrap) => {
    const tabs = tabsWrap.querySelectorAll('.problem-detail-role-permission-tab');
    const card = tabsWrap.closest('.problem-detail-card-body');
    const panels = card?.querySelectorAll('.problem-detail-role-permission-panel') || [];
    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabName = tab.getAttribute('data-tab');
        tabs.forEach((t) => t.classList.toggle('problem-detail-role-permission-tab-active', t.getAttribute('data-tab') === tabName));
        panels.forEach((p) => { p.hidden = (p.getAttribute('data-panel') || '') !== tabName; });
      });
    });
  });
  el.problemDetailContent?.querySelectorAll('.problem-detail-core-business-object-tabs').forEach((tabsWrap) => {
    const tabs = tabsWrap.querySelectorAll('.problem-detail-core-business-object-tab');
    // 仅在当前 tabs 的直接同级区域内找 panel，避免父级范围过大导致切错面板。
    const siblingPanels = Array.from(tabsWrap.parentElement?.children || []).filter((node) =>
      node?.classList?.contains('problem-detail-core-business-object-panel')
    );
    const stepWrapper = tabsWrap.closest('.problem-detail-step-card-core-business-object');
    const cardBody = tabsWrap.closest('.problem-detail-card-body');
    const scope = stepWrapper || cardBody || tabsWrap.parentElement;
    const panels = siblingPanels.length
      ? siblingPanels
      : Array.from(scope?.querySelectorAll('.problem-detail-core-business-object-panel') || []);
    logCoreBusinessObject('绑定Tab', {
      tabsCount: tabs.length,
      panelsCount: panels.length,
      hasStepWrapper: !!stepWrapper,
      hasCardBody: !!cardBody,
      scopeClass: scope?.className || '',
    });
    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabName = tab.getAttribute('data-tab');
        const beforeHidden = panels.map((p) => ({ panel: p.getAttribute('data-panel') || '', hidden: !!p.hidden }));
        logCoreBusinessObject('点击Tab', {
          tabName,
          panelsCount: panels.length,
          panelNames: Array.from(panels).map((p) => p.getAttribute('data-panel') || ''),
          beforeHidden,
        });
        tabs.forEach((t) => t.classList.toggle('problem-detail-core-business-object-tab-active', t.getAttribute('data-tab') === tabName));
        panels.forEach((p) => {
          const name = p.getAttribute('data-panel') || '';
          const active = name === tabName;
          p.hidden = !active;
          // 兜底：避免某些样式覆盖 hidden 导致面板不可见
          p.style.display = active ? '' : 'none';
        });
        const afterHidden = panels.map((p) => {
          const panel = p.getAttribute('data-panel') || '';
          const computedDisplay = typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
            ? window.getComputedStyle(p).display
            : '';
          return { panel, hidden: !!p.hidden, inlineDisplay: p.style.display || '', computedDisplay };
        });
        logCoreBusinessObject('点击Tab后状态', { tabName, afterHidden });
        logCoreBusinessObject(
          `点击Tab后状态详情 tab=${tabName} | ` +
          afterHidden.map((x) => `${x.panel}:hidden=${x.hidden},inline=${x.inlineDisplay || '(empty)'},computed=${x.computedDisplay || '(empty)'}`).join(' ; ')
        );
        const viewPanel = panels.find((p) => (p.getAttribute('data-panel') || '') === 'view');
        if (viewPanel) {
          const viewText = (viewPanel.textContent || '').trim();
          logCoreBusinessObject(`view面板内容长度=${viewText.length}，前120字=${viewText.slice(0, 120)}`);
        }
      });
    });
  });
}

function b64ToUtf8ForItDesignBpm(s) {
  try {
    return decodeURIComponent(escape(atob(String(s || ''))));
  } catch {
    return '';
  }
}

/**
 * 模型受「动画箭头」等提示诱导时会在 linkStyle/classDef 中写入 marker-end:url(#...) 等 CSS/SVG，Mermaid 10 无法解析。
 * 渲染前剥离这些片段，尽量保留其余图结构。
 */
/**
 * 仅替换双引号 **字符串内** 的 []#<>，与 `preliminaryRequirement.js` 生成侧一致；修复历史 DOM 中未转义标签导致的 Mermaid 10 Syntax error。
 */
function sanitizePrelimStmMermaidQuotedPayloads(src) {
  const s = String(src ?? '');
  let out = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      inStr = !inStr;
      out += c;
      continue;
    }
    if (inStr) {
      if (c === '[') out += '［';
      else if (c === ']') out += '］';
      else if (c === '#') out += '＃';
      else if (c === '<') out += '＜';
      else if (c === '>') out += '＞';
      else out += c;
    } else {
      out += c;
    }
  }
  return out;
}

function sanitizeItDesignBpmMermaidForRender(src) {
  let s = String(src ?? '');
  s = s.replace(/\bmarker-end\s*:\s*url\([^)]*\)/gi, '');
  s = s.replace(/\bmarker-start\s*:\s*url\([^)]*\)/gi, '');
  s = s.replace(/\bmarker-end\s*:\s*[^,;\n\r]+/gi, '');
  s = s.replace(/\bmarker-start\s*:\s*[^,;\n\r]+/gi, '');
  s = s.replace(/url\(\s*#[^)]*\)/gi, 'none');
  s = s.replace(/,\s*,/g, ',');
  s = s
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      if (/^(linkStyle|classDef|style)\b/i.test(trimmed)) {
        return line.replace(/,\s*$/u, '').replace(/,\s*,/g, ',');
      }
      return line;
    })
    .join('\n');
  return s.replace(/[ \t]+$/gm, '');
}

/** IT设计补齐「流程图绘制」view：泳道 JSON → `renderItDesignBpmSwimlaneSvg`；json 子卡为层级化文本；兼容 Markdown + SVG（DOMPurify）+ Mermaid */
async function hydrateItDesignBpmFlowViewIfNeeded(folder) {
  if (!folder || !folder.classList || !folder.classList.contains('it-design-bpm-flow-folder')) return;
  const mount = folder.querySelector('.it-design-bpm-flow-view-mount');
  if (!mount || mount.getAttribute('data-it-design-bpm-hydrated') === '1') return;
  const b64 = mount.getAttribute('data-chunks-b64');
  if (!b64) {
    mount.setAttribute('data-it-design-bpm-hydrated', '1');
    return;
  }
  let chunks;
  try {
    const json = b64ToUtf8ForItDesignBpm(b64);
    chunks = JSON.parse(json);
  } catch {
    mount.innerHTML =
      '<p class="it-design-tree-empty">流程图数据解析失败，请切换到 json 查看原文。</p>';
    mount.setAttribute('data-it-design-bpm-hydrated', '1');
    return;
  }
  if (!Array.isArray(chunks)) {
    mount.setAttribute('data-it-design-bpm-hydrated', '1');
    return;
  }
  mount.removeAttribute('data-chunks-b64');
  mount.innerHTML = '';
  const mermaidNodes = [];
  const rm = typeof renderMarkdown === 'function' ? renderMarkdown : (x) => escapeHtml(String(x ?? ''));
  for (let i = 0; i < chunks.length; i++) {
    const ch = chunks[i];
    if (!ch || !ch.text) continue;
    if (ch.type === 'flowJson') {
      const wrap = document.createElement('div');
      wrap.className = 'it-design-bpm-flow-json-chunk it-design-bpm-flow-body';
      try {
        const model = JSON.parse(ch.text);
        const renderFn = globalThis.renderItDesignBpmSwimlaneSvg;
        if (typeof renderFn !== 'function') {
          wrap.innerHTML =
            '<p class="it-design-tree-empty">泳道渲染脚本未加载（需 it-design-bpm-flow-render.js），请切换到 json 查看原文。</p>';
        } else {
          const layout = renderFn(wrap, model);
          if (layout == null && !wrap.querySelector('svg')) {
            wrap.innerHTML =
              '<p class="it-design-tree-empty">泳道数据无法绘制（字段不完整或步骤未落在有效格子），请切换到 json 核对数据。</p>';
          }
        }
      } catch (err) {
        const pe = document.createElement('p');
        pe.className = 'it-design-tree-empty';
        pe.textContent =
          '泳道 JSON 解析失败：' + (err && err.message != null ? String(err.message) : String(err));
        wrap.appendChild(pe);
      }
      mount.appendChild(wrap);
    } else if (ch.type === 'svg') {
      const wrap = document.createElement('div');
      wrap.className = 'it-design-bpm-svg-chunk it-design-bpm-flow-body';
      const san =
        typeof globalThis.sanitizeItDesignBpmSvgHtml === 'function'
          ? globalThis.sanitizeItDesignBpmSvgHtml(ch.text)
          : '';
      if (san && /<svg[\s>]/i.test(san)) {
        wrap.innerHTML = san;
      } else {
        const pe = document.createElement('p');
        pe.className = 'it-design-bpm-svg-error';
        pe.textContent =
          typeof globalThis.sanitizeItDesignBpmSvgHtml !== 'function'
            ? 'SVG 预览需要 DOMPurify（utils.js），请切换到 json 查看原文。'
            : 'SVG 清洗后缺少可渲染的 <svg> 根元素，请切换到 json 核对（须含 xmlns）。';
        wrap.appendChild(pe);
      }
      mount.appendChild(wrap);
    } else if (ch.type === 'mermaid') {
      const d = document.createElement('div');
      d.className = 'mermaid it-design-bpm-mermaid-graph';
      d.textContent = sanitizeItDesignBpmMermaidForRender(ch.text);
      mount.appendChild(d);
      mermaidNodes.push(d);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'it-design-bpm-md-chunk markdown-body';
      wrap.innerHTML = rm(ch.text);
      mount.appendChild(wrap);
    }
  }
  if (mermaidNodes.length) {
    if (typeof globalThis.mermaid !== 'undefined' && typeof globalThis.mermaid.run === 'function') {
      try {
        if (!globalThis.__FE_IT_DESIGN_MERMAID_INIT) {
          globalThis.mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme: 'dark',
            themeVariables: {
              primaryColor: '#1e293b',
              primaryTextColor: '#e2e8f0',
              primaryBorderColor: '#6366f1',
              lineColor: '#94a3b8',
              secondaryColor: '#0f172a',
              tertiaryColor: '#334155',
              fontFamily:
                '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif',
              fontSize: '13px',
            },
            flowchart: {
              useMaxWidth: true,
              /* false：避免 foreignObject 在多图/全屏 flex 下错位叠层（初步需求状态逻辑等） */
              htmlLabels: false,
              curve: 'basis',
              padding: 8,
            },
          });
          globalThis.__FE_IT_DESIGN_MERMAID_INIT = true;
        }
        await globalThis.mermaid.run({ nodes: mermaidNodes });
      } catch (err) {
        const pe = document.createElement('p');
        pe.className = 'it-design-bpm-mermaid-error';
        pe.textContent =
          '流程图渲染失败：' + (err && err.message != null ? String(err.message) : String(err));
        mount.insertBefore(pe, mount.firstChild);
      }
    } else {
      const pe = document.createElement('p');
      pe.className = 'it-design-bpm-mermaid-missing';
      pe.textContent = 'Mermaid 未加载，请切换到 json 查看绘图源码。';
      mount.insertBefore(pe, mount.firstChild);
    }
  }
  mount.setAttribute('data-it-design-bpm-hydrated', '1');
}

/** 流程图绘制子卡：view | json Tab + 首次进入 view 时挂载泳道/Mermaid */
function setupItDesignBpmFlowDrawTabs(scope) {
  const root = scope || el.problemDetailContent;
  if (!root) return;
  root.querySelectorAll('.it-design-bpm-flow-folder').forEach((folder) => {
    if (folder.getAttribute('data-bpm-flow-tabs-bound') === '1') return;
    const tabsRow = folder.querySelector('.it-design-bpm-flow-tabs');
    const tabs = folder.querySelectorAll('.it-design-bpm-flow-tab');
    const panels = folder.querySelectorAll('.it-design-bpm-flow-panel');
    if (!tabsRow || !tabs.length || !panels.length) return;
    folder.setAttribute('data-bpm-flow-tabs-bound', '1');
    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const name = tab.dataset.tab;
        tabs.forEach((t) => {
          const active = t.dataset.tab === name;
          t.classList.toggle('it-design-bpm-flow-tab--active', active);
          t.setAttribute('aria-pressed', active ? 'true' : 'false');
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        panels.forEach((p) => {
          const show = p.dataset.panel === name;
          p.hidden = !show;
        });
        if (name === 'view') {
          void hydrateItDesignBpmFlowViewIfNeeded(folder);
        }
      });
    });
    const hydrateIfViewVisible = () => {
      const viewPanel = folder.querySelector('.it-design-bpm-flow-panel[data-panel="view"]');
      if (viewPanel && !viewPanel.hidden) {
        void hydrateItDesignBpmFlowViewIfNeeded(folder);
      }
    };
    if (folder.tagName === 'DETAILS') {
      folder.addEventListener('toggle', () => {
        if (folder.open) hydrateIfViewVisible();
      });
      if (folder.open) hydrateIfViewVisible();
    } else {
      hydrateIfViewVisible();
    }
  });
}

/** task9 工作区：Mermaid-View 首次展示时从隐藏 textarea 取源码并 mermaid.run */
async function hydrateTask9OsmMermaidViewIfNeeded(body) {
  const mount = body && body.querySelector ? body.querySelector('.task9-osm-mermaid-mount') : null;
  if (!mount || mount.getAttribute('data-task9-mermaid-hydrated') === '1') return;
  const store = mount.querySelector('.task9-osm-mermaid-raw-store');
  const host = mount.querySelector('.task9-osm-mermaid-run-host');
  const placeholder = mount.querySelector('.task9-osm-mermaid-placeholder');
  const raw = store && typeof store.value === 'string' ? store.value.trim() : '';
  if (!host) {
    mount.setAttribute('data-task9-mermaid-hydrated', '1');
    return;
  }
  if (!raw) {
    mount.setAttribute('data-task9-mermaid-hydrated', '1');
    return;
  }
  if (placeholder) placeholder.hidden = true;
  const d = document.createElement('div');
  d.className = 'mermaid task9-osm-mermaid-graph';
  d.textContent = sanitizeItDesignBpmMermaidForRender(raw);
  host.innerHTML = '';
  host.appendChild(d);
  if (typeof globalThis.mermaid !== 'undefined' && typeof globalThis.mermaid.run === 'function') {
    try {
      if (!globalThis.__FE_IT_DESIGN_MERMAID_INIT) {
        globalThis.mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'dark',
          themeVariables: {
            primaryColor: '#1e293b',
            primaryTextColor: '#e2e8f0',
            primaryBorderColor: '#6366f1',
            lineColor: '#94a3b8',
            secondaryColor: '#0f172a',
            tertiaryColor: '#334155',
            fontFamily:
              '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif',
            fontSize: '13px',
          },
          flowchart: {
            useMaxWidth: true,
            htmlLabels: false,
            curve: 'basis',
            padding: 8,
          },
        });
        globalThis.__FE_IT_DESIGN_MERMAID_INIT = true;
      }
      await globalThis.mermaid.run({ nodes: [d] });
      const graphEl = host.querySelector('.task9-osm-mermaid-graph');
      if (graphEl) {
        for (let c = graphEl.firstElementChild; c; c = c.nextElementSibling) {
          if (c.tagName === 'svg') {
            c.removeAttribute('width');
            c.removeAttribute('height');
            c.style.width = '100%';
            c.style.maxWidth = '100%';
            c.style.height = 'auto';
            break;
          }
        }
      }
    } catch (err) {
      const pe = document.createElement('p');
      pe.className = 'it-design-bpm-mermaid-error';
      pe.textContent =
        'Mermaid 渲染失败：' + (err && err.message != null ? String(err.message) : String(err));
      host.insertBefore(pe, host.firstChild);
    }
  } else {
    const pe = document.createElement('p');
    pe.className = 'it-design-bpm-mermaid-missing';
    pe.textContent = 'Mermaid 未加载，请切换到 mermaid Tab 查看源码。';
    host.insertBefore(pe, host.firstChild);
  }
  mount.setAttribute('data-task9-mermaid-hydrated', '1');
}

/** 串行执行，避免全屏/切 Tab 时多次重叠 `mermaid.run` 与 Mermaid 10 内部状态竞态（表现为 Syntax error 叠图） */
let __prelimStmHydrateChain = Promise.resolve();
/** `mermaid.render` 要求 DOM id 唯一 */
let __fePrelimStmRenderSeq = 0;

/**
 * 初步需求「状态逻辑」Tab·状态转移矩阵：由 JSON 生成的 Mermaid 挂载点首次可见时执行 `mermaid.run`
 * @param {ParentNode} scopeRoot
 * @param {{ force?: boolean }} [opts]
 */
function hydratePrelimStateTransitionMatrixIfNeeded(scopeRoot, opts) {
  const p = __prelimStmHydrateChain.then(() => runHydratePrelimStateTransitionMatrix(scopeRoot, opts));
  __prelimStmHydrateChain = p.catch(() => {});
  return p;
}

async function runHydratePrelimStateTransitionMatrix(scopeRoot, opts) {
  if (!scopeRoot || !scopeRoot.querySelectorAll) return;
  const force = !!(opts && opts.force);
  const mounts = force
    ? scopeRoot.querySelectorAll('.problem-detail-prelim-stm-mermaid-mount')
    : scopeRoot.querySelectorAll('.problem-detail-prelim-stm-mermaid-mount[data-prelim-stm-hydrated="0"]');
  for (const mount of mounts) {
    if (force) {
      mount.setAttribute('data-prelim-stm-hydrated', '0');
      const hostClear = mount.querySelector('.problem-detail-prelim-stm-mermaid-host');
      if (hostClear) hostClear.innerHTML = '';
    }
    const store = mount.querySelector('.problem-detail-prelim-stm-mermaid-store');
    const host = mount.querySelector('.problem-detail-prelim-stm-mermaid-host');
    const errP = mount.querySelector('.problem-detail-prelim-stm-mermaid-error');
    if (!host) {
      mount.setAttribute('data-prelim-stm-hydrated', '1');
      continue;
    }
    const raw = store && typeof store.value === 'string' ? store.value.trim() : '';
    if (!raw) {
      mount.setAttribute('data-prelim-stm-hydrated', '1');
      continue;
    }
    if (errP) {
      errP.hidden = true;
      errP.textContent = '';
    }
    host.innerHTML = '';
    const spec = sanitizePrelimStmMermaidQuotedPayloads(sanitizeItDesignBpmMermaidForRender(raw));
    const m = globalThis.mermaid;
    if (m && typeof m.initialize === 'function' && typeof m.render === 'function') {
      try {
        if (!globalThis.__FE_IT_DESIGN_MERMAID_INIT) {
          m.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme: 'dark',
            themeVariables: {
              primaryColor: '#1e293b',
              primaryTextColor: '#e2e8f0',
              primaryBorderColor: '#6366f1',
              lineColor: '#94a3b8',
              secondaryColor: '#0f172a',
              tertiaryColor: '#334155',
              fontFamily:
                '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif',
              fontSize: '13px',
            },
            flowchart: {
              useMaxWidth: true,
              htmlLabels: false,
              curve: 'basis',
              padding: 8,
            },
          });
          globalThis.__FE_IT_DESIGN_MERMAID_INIT = true;
        }
        /* render 注入独立 SVG，避免 run 改写的 .mermaid 节点与 foreignObject 在全屏下叠到视口中央 */
        const rid = `fePrelimStm${__fePrelimStmRenderSeq++}`;
        const out = await m.render(rid, spec);
        const svgStr =
          typeof out === 'string'
            ? out
            : out && typeof out.svg === 'string'
              ? out.svg
              : '';
        if (!svgStr) throw new Error('mermaid.render 未返回 svg');
        host.innerHTML =
          '<div class="problem-detail-prelim-stm-mermaid-graph">' + svgStr + '</div>';
        if (out && typeof out.bindFunctions === 'function') {
          try {
            out.bindFunctions(host.firstElementChild);
          } catch (_) {
            /* 非交互图可忽略 */
          }
        }
        const svgEl = host.querySelector('.problem-detail-prelim-stm-mermaid-graph svg');
        if (svgEl) {
          svgEl.removeAttribute('width');
          svgEl.removeAttribute('height');
          svgEl.style.width = '100%';
          svgEl.style.maxWidth = '100%';
          svgEl.style.height = 'auto';
          if (!svgEl.getAttribute('preserveAspectRatio')) {
            svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          }
        }
      } catch (err) {
        if (errP) {
          errP.hidden = false;
          errP.textContent =
            'Mermaid 渲染失败：' + (err && err.message != null ? String(err.message) : String(err));
        }
      }
    } else if (m && typeof m.run === 'function') {
      try {
        if (!globalThis.__FE_IT_DESIGN_MERMAID_INIT) {
          m.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme: 'dark',
            themeVariables: {
              primaryColor: '#1e293b',
              primaryTextColor: '#e2e8f0',
              primaryBorderColor: '#6366f1',
              lineColor: '#94a3b8',
              secondaryColor: '#0f172a',
              tertiaryColor: '#334155',
              fontFamily:
                '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif',
              fontSize: '13px',
            },
            flowchart: {
              useMaxWidth: true,
              htmlLabels: false,
              curve: 'basis',
              padding: 8,
            },
          });
          globalThis.__FE_IT_DESIGN_MERMAID_INIT = true;
        }
        const d = document.createElement('div');
        d.className = 'mermaid problem-detail-prelim-stm-mermaid-graph';
        d.textContent = spec;
        host.appendChild(d);
        await m.run({ nodes: [d] });
        const graphEl = host.querySelector('.problem-detail-prelim-stm-mermaid-graph');
        const svgEl = graphEl?.querySelector?.('svg');
        if (svgEl) {
          svgEl.removeAttribute('width');
          svgEl.removeAttribute('height');
          svgEl.style.width = '100%';
          svgEl.style.maxWidth = '100%';
          svgEl.style.height = 'auto';
          if (!svgEl.getAttribute('preserveAspectRatio')) {
            svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          }
        }
      } catch (err) {
        if (errP) {
          errP.hidden = false;
          errP.textContent =
            'Mermaid 渲染失败：' + (err && err.message != null ? String(err.message) : String(err));
        }
      }
    } else if (errP) {
      errP.hidden = false;
      errP.textContent = 'Mermaid 未加载，请刷新页面或检查网络。';
    }
    mount.setAttribute('data-prelim-stm-hydrated', '1');
  }
}

/** 全屏后视口变化：仅对「单张状态卡」或「退出全屏」debounce 后重绘；整块初步需求全屏勿批量 force（易连续 run 竞态 → Mermaid Syntax error 叠图） */
let __prelimStmFsReflowTimer = null;
function reflowPrelimStateTransitionMatrixAfterFullscreen() {
  if (__prelimStmFsReflowTimer) clearTimeout(__prelimStmFsReflowTimer);
  __prelimStmFsReflowTimer = setTimeout(() => {
    __prelimStmFsReflowTimer = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fs = document.fullscreenElement || document.webkitFullscreenElement;
        if (fs && fs.classList?.contains('problem-detail-prelim-stm-card')) {
          void hydratePrelimStateTransitionMatrixIfNeeded(fs, { force: true });
          return;
        }
        if (fs && fs.classList?.contains('problem-detail-card-preliminary-tabs')) {
          return;
        }
        if (fs && fs.querySelector?.('.problem-detail-prelim-stm-mermaid-mount')) {
          void hydratePrelimStateTransitionMatrixIfNeeded(fs, { force: true });
          return;
        }
        if (!fs) {
          const prelim = document.querySelector('.problem-detail-card-preliminary-tabs');
          if (prelim?.querySelector('.problem-detail-prelim-stm-mermaid-mount')) {
            void hydratePrelimStateTransitionMatrixIfNeeded(prelim, { force: true });
          }
        }
      });
    });
  }, 180);
}

let _prelimStmFullscreenReflowBound = false;
function ensurePrelimStmFullscreenReflowListener() {
  if (_prelimStmFullscreenReflowBound) return;
  _prelimStmFullscreenReflowBound = true;
  const run = () => reflowPrelimStateTransitionMatrixAfterFullscreen();
  document.addEventListener('fullscreenchange', run);
  document.addEventListener('webkitfullscreenchange', run);
}

function setupProblemDetailCardToggle() {
  setupRolePermissionStepTabs();
  el.problemDetailContent?.querySelectorAll('.problem-detail-card').forEach((card) => {
    const header = card.querySelector('.problem-detail-card-header');
    const body = card.querySelector('.problem-detail-card-body');
    if (!header || !body) return;
    const toggle = () => {
      const collapsed = body.hidden;
      body.hidden = !collapsed;
      header.setAttribute('aria-expanded', String(!collapsed));
      header.classList.toggle('problem-detail-card-header-collapsed', !collapsed);
    };
    header.addEventListener('click', (e) => {
      if (
        e.target.closest('.problem-detail-card-tab') ||
        e.target.closest('.btn-delete-requirement-logic') ||
        e.target.closest('.problem-detail-e2e-flow-download-btn') ||
        e.target.closest('.problem-detail-workspace-json-download-btn') ||
        e.target.closest('.problem-detail-e2e-flow-fs-btn') ||
        e.target.closest('.problem-detail-it-design-supplement-fs-btn') ||
        e.target.closest('.problem-detail-card-preliminary-fs-btn') ||
        e.target.closest('.problem-detail-bmc-download-btn') ||
        e.target.closest('.problem-detail-bmc-fs-btn')
      ) {
        return;
      }
      toggle();
    });
    header.addEventListener('keydown', (e) => {
      if (
        e.target.closest('.problem-detail-card-tab') ||
        e.target.closest('.btn-delete-requirement-logic') ||
        e.target.closest('.problem-detail-e2e-flow-download-btn') ||
        e.target.closest('.problem-detail-workspace-json-download-btn') ||
        e.target.closest('.problem-detail-e2e-flow-fs-btn') ||
        e.target.closest('.problem-detail-it-design-supplement-fs-btn') ||
        e.target.closest('.problem-detail-card-preliminary-fs-btn') ||
        e.target.closest('.problem-detail-bmc-download-btn') ||
        e.target.closest('.problem-detail-bmc-fs-btn')
      ) {
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
    const tabs = card.querySelectorAll('.problem-detail-card-tab');
    const bodyDetail = body.querySelector('.problem-detail-card-body-detail');
    const bodyJson = body.querySelector('.problem-detail-card-body-json');
    if (tabs.length && bodyDetail && card.classList.contains('problem-detail-card-local-itgap-aggregate-tabs')) {
      const bodyAggJson = body.querySelector('.problem-detail-card-body-local-itgap-aggregate-json');
      const bodyAggCompressed = body.querySelector('.problem-detail-card-body-local-itgap-compressed-json');
      if (bodyAggJson && bodyAggCompressed) {
        tabs.forEach((tab) => {
          tab.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabName = tab.dataset.tab;
            tabs.forEach((t) => {
              t.classList.toggle('problem-detail-card-tab-active', t.dataset.tab === tabName);
              t.setAttribute('aria-pressed', t.dataset.tab === tabName ? 'true' : 'false');
            });
            bodyDetail.hidden = tabName !== 'view';
            bodyAggJson.hidden = tabName !== 'json';
            bodyAggCompressed.hidden = tabName !== 'compressed-json';
          });
        });
      }
    } else if (tabs.length && bodyDetail && card.classList.contains('problem-detail-card-global-itgap')) {
      const bodyFullJson = body.querySelector('.problem-detail-card-body-global-itgap-full-json');
      const bodyCompressed = body.querySelector('.problem-detail-card-body-global-itgap-compressed-json');
      if (bodyFullJson && bodyCompressed) {
        tabs.forEach((tab) => {
          tab.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabName = tab.dataset.tab;
            tabs.forEach((t) => {
              t.classList.toggle('problem-detail-card-tab-active', t.dataset.tab === tabName);
              t.setAttribute('aria-pressed', t.dataset.tab === tabName ? 'true' : 'false');
            });
            bodyDetail.hidden = tabName !== 'detail';
            bodyFullJson.hidden = tabName !== 'json';
            bodyCompressed.hidden = tabName !== 'compressed-json';
          });
        });
      } else if (bodyFullJson) {
        // IT设计补齐 v1：仅 view｜json，无架构约束底座压缩 Tab
        tabs.forEach((tab) => {
          tab.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabName = tab.dataset.tab;
            tabs.forEach((t) => {
              t.classList.toggle('problem-detail-card-tab-active', t.dataset.tab === tabName);
              t.setAttribute('aria-pressed', t.dataset.tab === tabName ? 'true' : 'false');
            });
            bodyDetail.hidden = tabName !== 'detail';
            bodyFullJson.hidden = tabName !== 'json';
          });
        });
      }
    } else if (tabs.length && bodyDetail && card.classList.contains('problem-detail-card-e2e-flow')) {
      const bodyFullJson = body.querySelector('.problem-detail-card-body-e2e-full-json');
      if (bodyFullJson) {
        tabs.forEach((tab) => {
          tab.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabName = tab.dataset.tab;
            tabs.forEach((t) => {
              t.classList.toggle('problem-detail-card-tab-active', t.dataset.tab === tabName);
              t.setAttribute('aria-pressed', t.dataset.tab === tabName ? 'true' : 'false');
            });
            bodyDetail.hidden = tabName !== 'view';
            bodyFullJson.hidden = tabName !== 'json';
          });
        });
      }
    } else if (tabs.length && card.classList.contains('problem-detail-card-task9-object-state')) {
      const pJsonView = body.querySelector('[data-task9-tab-panel="json-view"]');
      const pMermaidView = body.querySelector('[data-task9-tab-panel="mermaid-view"]');
      const pJsonCode = body.querySelector('[data-task9-tab-panel="json-code"]');
      const pMermaidCode = body.querySelector('[data-task9-tab-panel="mermaid-code"]');
      if (pJsonView && pMermaidView && pJsonCode && pMermaidCode) {
        tabs.forEach((tab) => {
          tab.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabName = tab.dataset.tab;
            tabs.forEach((t) => {
              t.classList.toggle('problem-detail-card-tab-active', t.dataset.tab === tabName);
              t.setAttribute('aria-pressed', t.dataset.tab === tabName ? 'true' : 'false');
            });
            const isJsonView = tabName === 'json-view';
            const isMermaidView = tabName === 'mermaid-view';
            const isJsonCode = tabName === 'json-code';
            const isMermaidCode = tabName === 'mermaid-code';
            pJsonView.hidden = !isJsonView;
            pMermaidView.hidden = !isMermaidView;
            pJsonCode.hidden = !isJsonCode;
            pMermaidCode.hidden = !isMermaidCode;
            if (isMermaidView) {
              void hydrateTask9OsmMermaidViewIfNeeded(body);
            }
          });
        });
      }
    } else if (tabs.length && bodyDetail && card.classList.contains('problem-detail-card-preliminary-tabs')) {
      const bodyPrelimFullJson = body.querySelector('.problem-detail-card-body-prelim-structured-json');
      const bodyPrelimHistory = body.querySelector('.problem-detail-card-body-preliminary-history');
      const sectionTabsRoot = body.querySelector('.problem-detail-prelim-section-tabs');
      if (bodyPrelimHistory) {
        tabs.forEach((tab) => {
          tab.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabName = tab.dataset.tab;
            tabs.forEach((t) => {
              t.classList.toggle('problem-detail-card-tab-active', t.dataset.tab === tabName);
              t.setAttribute('aria-pressed', t.dataset.tab === tabName ? 'true' : 'false');
            });
            bodyDetail.hidden = tabName !== 'detail';
            if (bodyPrelimFullJson) bodyPrelimFullJson.hidden = tabName !== 'prelim-json';
            bodyPrelimHistory.hidden = tabName !== 'history';
            if (tabName === 'detail') {
              void hydratePrelimStateTransitionMatrixIfNeeded(body);
            }
          });
        });
      }
      if (sectionTabsRoot) {
        if (body.querySelector('.problem-detail-prelim-stm-fs-btn')) {
          problemDetailChatBridge.ensureWorkspaceFullscreenDocListener?.();
        }
        const secTablist = sectionTabsRoot.querySelector(':scope > .problem-detail-prelim-section-tablist');
        const secTabs = secTablist ? secTablist.querySelectorAll('.problem-detail-prelim-section-tab') : [];
        const secPanels = sectionTabsRoot.querySelectorAll('.problem-detail-prelim-section-panel');
        const tryHydratePrelimStm = () => {
          const vis = sectionTabsRoot.querySelector('.problem-detail-prelim-section-panel:not([hidden])');
          if (vis && vis.dataset.section === 'stateTransitionMatrix') {
            void hydratePrelimStateTransitionMatrixIfNeeded(body);
          }
        };
        secTabs.forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const k = btn.dataset.section;
            if (!k) return;
            secTabs.forEach((b) => {
              b.classList.toggle('problem-detail-prelim-section-tab-active', b.dataset.section === k);
              b.setAttribute('aria-selected', b.dataset.section === k ? 'true' : 'false');
            });
            secPanels.forEach((p) => {
              p.hidden = p.dataset.section !== k;
            });
            tryHydratePrelimStm();
          });
        });
        tryHydratePrelimStm();
        body.querySelectorAll('.problem-detail-prelim-stm-card').forEach((stmCard) => {
          const fsBtn = stmCard.querySelector('.problem-detail-prelim-stm-fs-btn');
          if (fsBtn && fsBtn.dataset.fePrelimStmFsBound !== '1') {
            fsBtn.dataset.fePrelimStmFsBound = '1';
            fsBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const inFs =
                document.fullscreenElement === stmCard || document.webkitFullscreenElement === stmCard;
              if (inFs) {
                if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                return;
              }
              void hydratePrelimStateTransitionMatrixIfNeeded(stmCard);
              const p =
                stmCard.requestFullscreen?.() ?? stmCard.webkitRequestFullscreen?.() ?? null;
              if (p && typeof p.then === 'function') p.catch(() => {});
            });
          }
        });
        body.querySelectorAll('.problem-detail-prelim-stm-entity-details').forEach((det) => {
          if (det.dataset.fePrelimStmDetailsBound === '1') return;
          det.dataset.fePrelimStmDetailsBound = '1';
          det.addEventListener('toggle', () => {
            if (det.open) void hydratePrelimStateTransitionMatrixIfNeeded(det);
          });
        });
      }
    } else if (tabs.length && bodyDetail && bodyJson) {
      tabs.forEach((tab) => {
        tab.addEventListener('click', (e) => {
          e.stopPropagation();
          const tabName = tab.dataset.tab;
          tabs.forEach((t) => {
            t.classList.toggle('problem-detail-card-tab-active', t.dataset.tab === tabName);
            t.setAttribute('aria-pressed', t.dataset.tab === tabName ? 'true' : 'false');
          });
          bodyDetail.hidden = tabName !== 'detail';
          bodyJson.hidden = tabName !== 'json';
        });
      });
    }
    const deleteBtn = card.querySelector('.btn-delete-requirement-logic');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = __appState.currentProblemDetailItem;
        if (!item?.createdAt) return;
        deleteDigitalProblemRequirementLogic(item.createdAt);
        __appState.currentProblemDetailItem = { ...item, requirementLogic: undefined, completedStages: (item.completedStages || []).filter((x) => x !== 2).sort((a, b) => a - b) };
        const container = el.problemDetailChatMessages;
        __appState.problemDetailChatMessages = __appState.problemDetailChatMessages.filter(
          (m) => m.type !== 'requirementLogicStartBlock' && m.type !== 'requirementLogicBlock'
        );
        saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
        if (container) {
          container.innerHTML = '';
          renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
          requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
        }
        renderProblemDetailContent();
      });
    }
  });
}

/** 工作区全局 ITGap view：各维度一级块可折叠子卡片 */
function setupGlobalItGapSubcardToggle() {
  // [bridge] → core/task8-global-itgap.js (Phase 4A)
  return __t8().setupGlobalItGapSubcardToggle();
}

/** 全局 ITGap 工作区：阶段下各维度子卡内 view | json Tab（委托，避免重复绑定） */
function setupGlobalItGapWorkspaceDimensionTabs() {
  // [bridge] → core/task8-global-itgap.js (Phase 4A)
  return __t8().setupGlobalItGapWorkspaceDimensionTabs();
}

function renderModificationOrPlain(container, assistantContent) {
  const parsed = parseModificationResponse(assistantContent);
  if (parsed && currentDetailRecord) {
    scrollToTargetAndHighlight(parsed);
    const lastTs = __appState.chatHistory[__appState.chatHistory.length - 1]?.timestamp;
    return appendModificationBlock(container, parsed, formatChatTime(lastTs), () => {
      clearModificationHighlight();
      const appliedParsed = currentModificationTask?.parsed || parsed;
      const beforeValue = getCurrentValueForPosition(currentDetailRecord, appliedParsed);
      if (applyModification(currentDetailRecord, appliedParsed)) {
        const afterValue = appliedParsed.newValue != null ? String(appliedParsed.newValue) : appliedParsed.modification;
        const modificationSummary = appliedParsed.modification && appliedParsed.modification !== afterValue
          ? appliedParsed.modification
          : (beforeValue || afterValue ? `将「${beforeValue || '空'}」修改为「${afterValue}」` : '内容已更新');
        const history = currentDetailRecord.modificationHistory || [];
        history.unshift({
          position: appliedParsed.position,
          beforeValue,
          modification: modificationSummary,
          afterValue,
          reason: appliedParsed.reason,
          timestamp: new Date().toISOString(),
        });
        currentDetailRecord.modificationHistory = history;
        el.detailResult.innerHTML = buildDetailHTML(currentDetailRecord);
        saveAnalysis(currentDetailRecord);
        setupDetailValueStreamEvents();
        if (appliedParsed.isValueStream) {
          const vsIdx = getValueStreamIndexFromParsed(appliedParsed);
          if (vsIdx != null) {
            requestAnimationFrame(() => {
              expandAndRefreshValueStreamCard(vsIdx);
              el.detailResult?.querySelector(`.vs-card[data-index="${vsIdx}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            });
          }
        }
      }
    }, (modBlock) => {
      clearModificationHighlight();
      cancelModification(container, modBlock);
    }, (oldBlock) => retryModification(container, oldBlock));
  }
  return appendChatBlock(container, 'assistant', assistantContent, formatChatTime(__appState.chatHistory[__appState.chatHistory.length - 1]?.timestamp));
}

function cancelModification(container, modBlock) {
  currentModificationTask = null;
  const userBlock = modBlock.previousElementSibling;
  if (userBlock && userBlock.classList.contains('chat-message-user')) {
    userBlock.remove();
  }
  modBlock.remove();
  __appState.chatHistory.pop();
  if (__appState.chatHistory.length > 0 && __appState.chatHistory[__appState.chatHistory.length - 1].role === 'user') {
    __appState.chatHistory.pop();
  }
  saveChatToRecord();
  container.scrollTop = container.scrollHeight;
}

async function retryModification(container, oldBlock) {
  __appState.chatHistory.pop();
  oldBlock.classList.remove('chat-message-modification');
  oldBlock.classList.add('chat-message-loading');
  oldBlock.innerHTML = '<div class="chat-message-content">正在重新分析...</div><div class="chat-message-time">' + getTimeStr() + '</div>';
  container.scrollTop = container.scrollHeight;
  let assistantContent = '';
  try {
    assistantContent = await fetchModificationFromLLM();
  } catch (err) {
    assistantContent = '网络或请求错误：' + (err.message || String(err));
  }
  const assistantMsg = { role: 'assistant', content: assistantContent, timestamp: new Date().toISOString() };
  __appState.chatHistory.push(assistantMsg);
  oldBlock.remove();
  renderModificationOrPlain(container, assistantContent);
  saveChatToRecord();
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = el.chatInput;
  const messages = el.chatMessages;
  if (!input || !messages) return;
  const text = (input.value || '').trim();
  if (!text) return;

  input.value = '';
  const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
  __appState.chatHistory.push(userMsg);
  appendChatBlock(messages, 'user', text, formatChatTime(userMsg.timestamp));
  saveChatToRecord();

  const loadingBlock = document.createElement('div');
  loadingBlock.className = 'chat-message chat-message-assistant chat-message-loading';
  loadingBlock.innerHTML = '<div class="chat-message-content">正在分析页面结构并提炼修改建议...</div><div class="chat-message-time">' + getTimeStr() + '</div>';
  messages.appendChild(loadingBlock);
  messages.scrollTop = messages.scrollHeight;

  if (!hasAiConfig()) {
    loadingBlock.querySelector('.chat-message-content').textContent = '请先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）才能使用大模型对话。';
    loadingBlock.classList.remove('chat-message-loading');
    return;
  }

  let assistantContent = '';
  try {
    assistantContent = await fetchModificationFromLLM();
  } catch (err) {
    assistantContent = '网络或请求错误：' + (err.message || String(err));
  }

  const assistantMsg = { role: 'assistant', content: assistantContent, timestamp: new Date().toISOString() };
  __appState.chatHistory.push(assistantMsg);
  loadingBlock.remove();

  if (currentModificationTask) {
    const currentParsed = currentModificationTask.parsed;
    const newParsed = parseModificationResponse(assistantContent);

    if (currentParsed.isValueStream) {
      const merged = mergeValueStreamModification(currentParsed, newParsed);
      const oldBlock = currentModificationTask.block;
      oldBlock.remove();
      const timeStr = formatChatTime(assistantMsg.timestamp);
      appendModificationBlock(messages, merged, timeStr, () => {
        clearModificationHighlight();
        const appliedParsed = currentModificationTask?.parsed || merged;
        const beforeValue = getCurrentValueForPosition(currentDetailRecord, appliedParsed);
        if (applyModification(currentDetailRecord, appliedParsed)) {
          const afterValue = appliedParsed.newValue != null ? String(appliedParsed.newValue) : appliedParsed.modification;
          const modificationSummary = appliedParsed.modification && appliedParsed.modification !== afterValue
            ? appliedParsed.modification
            : (beforeValue || afterValue ? `将「${beforeValue || '空'}」修改为「${afterValue}」` : '内容已更新');
          const history = currentDetailRecord.modificationHistory || [];
          history.unshift({
            position: appliedParsed.position,
            beforeValue,
            modification: modificationSummary,
            afterValue,
            reason: appliedParsed.reason,
            timestamp: new Date().toISOString(),
          });
          currentDetailRecord.modificationHistory = history;
          el.detailResult.innerHTML = buildDetailHTML(currentDetailRecord);
          saveAnalysis(currentDetailRecord);
          setupDetailValueStreamEvents();
          const vsIdx = getValueStreamIndexFromParsed(appliedParsed);
          if (vsIdx != null) {
            requestAnimationFrame(() => {
              expandAndRefreshValueStreamCard(vsIdx);
              el.detailResult?.querySelector(`.vs-card[data-index="${vsIdx}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            });
          }
        }
      }, (modBlock) => {
        clearModificationHighlight();
        cancelModification(messages, modBlock);
      }, (retryBlock) => retryModification(messages, retryBlock));
      scrollToTargetAndHighlight(merged);
      messages.scrollTop = messages.scrollHeight;
      saveChatToRecord();
    } else if (newParsed && isSameModificationPosition(newParsed, currentParsed)) {
      currentModificationTask.parsed = newParsed;
      updateModificationBlockContent(currentModificationTask.block, newParsed);
      scrollToTargetAndHighlight(newParsed);
      saveChatToRecord();
    } else {
      __appState.chatHistory.pop();
      const currentPosition = currentParsed.position;
      const prompt = `请先确认或放弃当前修改（${currentPosition}）后再开启新的修改任务。`;
      __appState.chatHistory.push({ role: 'assistant', content: prompt, timestamp: assistantMsg.timestamp });
      appendChatBlock(messages, 'assistant', prompt, formatChatTime(assistantMsg.timestamp));
      saveChatToRecord();
    }
  } else {
    renderModificationOrPlain(messages, assistantContent);
    saveChatToRecord();
  }
  messages.scrollTop = messages.scrollHeight;
}

// ========== Phase 2B: problem-detail-events 转发函数（原内联监听器体，语义不变）==========
function onProblemDetailViewClickTaskStep(e) {
  const stepBtn = e.target.closest('.problem-detail-task-step');
  if (!stepBtn || stepBtn.disabled || stepBtn.classList.contains('problem-detail-task-step--locked')) return;
  const taskId = stepBtn.getAttribute('data-task-id');
  if (!taskId || !__appState.currentProblemDetailItem) return;
  e.preventDefault();
  focusWorkspaceOnCurrentTask(taskId);
}
function onProblemDetailViewClickRestart(e) {
  const resumeBtn = e.target.closest('#btnProblemDetailExceptionResume, .btn-problem-detail-exception-resume');
  if (resumeBtn) {
    if (resumeBtn.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    applyFlowExceptionResume();
    return;
  }
  const restartBtn = e.target.closest('#btnProblemDetailRestartTask, .btn-problem-detail-restart-task');
  if (restartBtn) {
    e.preventDefault();
    e.stopPropagation();
    logRestartCurrent('ui:restart-click', { targetId: restartBtn.id || null });
    applyRestartCurrentTask();
  }
}
function onBtnProblemDetailHistoryClick() {
  toggleProblemDetailHistory(true);
}
function onBtnProblemDetailRollbackClick() {
  openRollbackTaskModal();
}
function onRollbackModalOverlayClick(e) {
  if (e.target === el.rollbackModalOverlay) closeRollbackTaskModal();
}
function onBtnCloseRollbackModalClick() {
  closeRollbackTaskModal();
}
function onRollbackModalTaskListClick(e) {
  const btn = e.target.closest('.rollback-modal-option');
  if (!btn) return;
  const taskId = btn.getAttribute('data-task-id');
  if (taskId) {
    closeRollbackTaskModal();
    applyRollbackToTask(taskId);
  }
}
function onBtnCloseProblemDetailHistoryClick() {
  toggleProblemDetailHistory(false);
}
function onProblemDetailHistoryPanelClick(e) {
  const btn = e.target.closest('.problem-detail-history-task-node');
  if (!btn) {
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  const root = btn.closest('.problem-detail-history-task-root');
  const children = root?.querySelector('.problem-detail-history-task-children');
  if (!children) {
    return;
  }
  const wasHidden = !!children.hidden;
  const willShow = wasHidden;
  children.hidden = !willShow;
  btn.classList.toggle('expanded', willShow);
}
function onProblemDetailBodyClick(e) {
  /* task9 对象状态机构建：工作区占位；对话区任务启动通知与历史块仍可渲染 */
  const addReqBtn = e.target && e.target.closest && e.target.closest('#btnProblemDetailAddRequirement, .btn-problem-detail-add-requirement');
  if (addReqBtn) {
    e.preventDefault();
    requestPlusRequirementResetConfirmInChat();
  }
}
function onWindowPagehideProblemDetailScroll() {
  const item = __appState.currentProblemDetailItem;
  const caseId = item?.id ?? item?.createdAt;
  if (!item || caseId == null) return;
  const wsScroll = document.querySelector('.problem-detail-workspace-scroll');
  if (wsScroll) {
    try {
      sessionStorage.setItem('problemDetailScroll_' + String(caseId), String(wsScroll.scrollTop));
    } catch (_) {}
  }
}
function onProblemDetailChatSendClick() {
  handleProblemDetailChatSend();
}
function onProblemDetailChatInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleProblemDetailChatSend();
  }
}
function onProblemDetailChatModeTriggerClick(e) {
  e.stopPropagation();
  const dd = el.problemDetailChatModeDropdown;
  if (!dd) return;
  const isOpen = dd.getAttribute('aria-hidden') !== 'true';
  dd.setAttribute('aria-hidden', String(isOpen));
  el.problemDetailChatModeTrigger?.setAttribute('aria-expanded', String(!isOpen));
}
function onProblemDetailChatModeOptionAgentClick() {
  problemDetailChatMode = 'agent';
  if (el.problemDetailChatModeTriggerText) el.problemDetailChatModeTriggerText.textContent = 'Agent';
  if (el.problemDetailChatModeTriggerIcon) el.problemDetailChatModeTriggerIcon.textContent = '∞';
  if (el.problemDetailChatModeOptionAgent) el.problemDetailChatModeOptionAgent.setAttribute('aria-selected', 'true');
  if (el.problemDetailChatModeOptionAsk) el.problemDetailChatModeOptionAsk.setAttribute('aria-selected', 'false');
  if (el.problemDetailChatModeDropdown) el.problemDetailChatModeDropdown.setAttribute('aria-hidden', 'true');
  if (el.problemDetailChatModeTrigger) el.problemDetailChatModeTrigger.setAttribute('aria-expanded', 'false');
  updateProblemDetailChatHeaderLabel();
  updateProblemDetailChatInputForMode();
  const next = getFirstUncompletedTask(__appState.currentProblemDetailItem);
  if (next) {
    if (typeof hasUnconfirmedOutputCardBeforeTask === 'function' && hasUnconfirmedOutputCardBeforeTask(__appState.problemDetailChatMessages, next.id)) return;
    focusWorkspaceOnCurrentTask(next.id);
    requestAnimationFrame(() => {
      scrollChatToTaskStartNotification(next.id);
    });
  }
}
function onProblemDetailChatModeOptionAskClick() {
  problemDetailChatMode = 'ask';
  if (el.problemDetailChatModeTriggerText) el.problemDetailChatModeTriggerText.textContent = 'Ask';
  if (el.problemDetailChatModeTriggerIcon) el.problemDetailChatModeTriggerIcon.textContent = '💬';
  if (el.problemDetailChatModeOptionAgent) el.problemDetailChatModeOptionAgent.setAttribute('aria-selected', 'false');
  if (el.problemDetailChatModeOptionAsk) el.problemDetailChatModeOptionAsk.setAttribute('aria-selected', 'true');
  if (el.problemDetailChatModeDropdown) el.problemDetailChatModeDropdown.setAttribute('aria-hidden', 'true');
  if (el.problemDetailChatModeTrigger) el.problemDetailChatModeTrigger.setAttribute('aria-expanded', 'false');
  updateProblemDetailChatHeaderLabel();
  updateProblemDetailChatInputForMode();
}
function onDocumentClickCloseProblemDetailChatModeDropdown() {
  if (el.problemDetailChatModeDropdown) el.problemDetailChatModeDropdown.setAttribute('aria-hidden', 'true');
  if (el.problemDetailChatModeTrigger) el.problemDetailChatModeTrigger.setAttribute('aria-expanded', 'false');
}
function handleProblemDetailChatMessagesClick(e) {
  const confirmResumeLlmBtn = e.target.closest('.btn-confirm-llm-resume');
  if (confirmResumeLlmBtn && !confirmResumeLlmBtn.disabled) {
    const card = confirmResumeLlmBtn.closest('[data-msg-index]');
    const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    const idx = card ? parseInt(card.getAttribute('data-msg-index') || '-1', 10) : -1;
    const msg = Number.isInteger(idx) && idx >= 0 && idx < __appState.problemDetailChatMessages.length ? __appState.problemDetailChatMessages[idx] : null;
    if (!msg || msg.type !== 'llmResumeIntentBlock') return;
    __appState.problemDetailChatMessages[idx] = { ...msg, confirmed: true };
    if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
    const c0 = el.problemDetailChatMessages;
    if (c0) {
      c0.innerHTML = '';
      renderProblemDetailChatFromStorage(c0, __appState.problemDetailChatMessages);
      c0.scrollTop = c0.scrollHeight;
    }
    confirmResumeLlmBtn.disabled = true;
    confirmResumeLlmBtn.textContent = '已确认';
    void (async () => {
      try {
        await retryLlmFlowByAction(msg.retryAction, msg.taskId);
        const sourceIdx = Number(msg.sourceRetryIndex);
        if (Number.isInteger(sourceIdx) && sourceIdx >= 0 && sourceIdx < __appState.problemDetailChatMessages.length) {
          const src = __appState.problemDetailChatMessages[sourceIdx];
          if (src && src.type === 'llmRetryNoticeBlock') {
            __appState.problemDetailChatMessages[sourceIdx] = { ...src, retrySucceeded: true };
            if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
          }
        }
      } catch (err) {
        showError('继续调用失败：' + (err?.message || String(err)));
        if (idx >= 0 && idx < __appState.problemDetailChatMessages.length) {
          const latest = __appState.problemDetailChatMessages[idx];
          if (latest && latest.type === 'llmResumeIntentBlock') {
            __appState.problemDetailChatMessages[idx] = { ...latest, confirmed: false };
            if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
          }
        }
        const c1 = el.problemDetailChatMessages;
        if (c1) {
          c1.innerHTML = '';
          renderProblemDetailChatFromStorage(c1, __appState.problemDetailChatMessages);
          c1.scrollTop = c1.scrollHeight;
        }
      }
    })();
    return;
  }
  const plusReqResetConfirmBtn = e.target.closest('.btn-plus-requirement-reset-confirm');
  if (plusReqResetConfirmBtn && !plusReqResetConfirmBtn.disabled) {
    const card = plusReqResetConfirmBtn.closest('[data-msg-index]');
    const idx = card ? parseInt(card.getAttribute('data-msg-index') || '-1', 10) : -1;
    if (
      !Number.isInteger(idx) ||
      idx < 0 ||
      !isLatestPendingPlusRequirementResetConfirmBlock(__appState.problemDetailChatMessages, idx)
    ) {
      return;
    }
    plusReqResetConfirmBtn.disabled = true;
    const cancelSib = card?.querySelector('.btn-plus-requirement-reset-cancel');
    if (cancelSib) cancelSib.disabled = true;
    executePlusRequirementResetFromTask2();
    return;
  }
  const plusReqResetCancelBtn = e.target.closest('.btn-plus-requirement-reset-cancel');
  if (plusReqResetCancelBtn && !plusReqResetCancelBtn.disabled) {
    const card = plusReqResetCancelBtn.closest('[data-msg-index]');
    const idx = card ? parseInt(card.getAttribute('data-msg-index') || '-1', 10) : -1;
    if (
      !Number.isInteger(idx) ||
      idx < 0 ||
      !isLatestPendingPlusRequirementResetConfirmBlock(__appState.problemDetailChatMessages, idx)
    ) {
      return;
    }
    const msg = __appState.problemDetailChatMessages[idx];
    if (!msg || msg.type !== 'plusRequirementResetConfirmBlock') return;
    const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    __appState.problemDetailChatMessages[idx] = { ...msg, resolution: 'cancelled' };
    if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
    plusReqResetCancelBtn.disabled = true;
    const confirmSib = card?.querySelector('.btn-plus-requirement-reset-confirm');
    if (confirmSib) confirmSib.disabled = true;
    const c0 = el.problemDetailChatMessages;
    if (c0) {
      c0.innerHTML = '';
      renderProblemDetailChatFromStorage(c0, __appState.problemDetailChatMessages);
      c0.scrollTop = c0.scrollHeight;
    }
    return;
  }
  const prelimContinueBtn = e.target.closest('.btn-prelim-supplement-continue');
  if (prelimContinueBtn && !prelimContinueBtn.disabled) {
    const card = prelimContinueBtn.closest('[data-msg-index]');
    const idx = card ? parseInt(card.getAttribute('data-msg-index') || '-1', 10) : -1;
    if (!Number.isInteger(idx) || idx < 0 || !isLatestPreliminaryRequirementFollowupBlock(__appState.problemDetailChatMessages, idx)) return;
    const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    problemDetailWaitingForFeedback = {
      taskId: 'task1',
      createdAt: caseKey,
      type: 'modification',
      prelimSupplement: true,
    };
    logTask1PrelimSupplement('click.supplement-more', {
      caseKey,
      msgIndex: idx,
      chatLength: Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages.length : -1,
    });
    pushAndSaveProblemDetailChat({
      role: 'system',
      content: TASK1_PRELIM_SUPPLEMENT_CONTINUE_PROMPT,
      timestamp: getTimeStr(),
    });
    const c0 = el.problemDetailChatMessages;
    if (c0) {
      c0.innerHTML = '';
      renderProblemDetailChatFromStorage(c0, __appState.problemDetailChatMessages);
      c0.scrollTop = c0.scrollHeight;
    }
    renderProblemDetailContent();
    renderProblemDetailHistory();
    updateProblemDetailChatHeaderLabel();
    return;
  }
  const prelimSupplementModifyBtn = e.target.closest('.btn-prelim-supplement-modify');
  if (prelimSupplementModifyBtn && !prelimSupplementModifyBtn.disabled) {
    const card = prelimSupplementModifyBtn.closest('[data-msg-index]');
    const idx = card ? parseInt(card.getAttribute('data-msg-index') || '-1', 10) : -1;
    if (!Number.isInteger(idx) || idx < 0 || !isLatestPreliminaryRequirementFollowupBlock(__appState.problemDetailChatMessages, idx)) {
      return;
    }
    const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    problemDetailWaitingForFeedback = {
      taskId: 'task1',
      createdAt: caseKey,
      type: 'modification',
      prelimSupplementModify: true,
    };
    logTask1PrelimSupplement('click.supplement-modify-chat', {
      caseKey,
      msgIndex: idx,
      chatLength: Array.isArray(__appState.problemDetailChatMessages) ? __appState.problemDetailChatMessages.length : -1,
    });
    pushAndSaveProblemDetailChat({
      role: 'system',
      content: TASK1_PRELIM_SUPPLEMENT_MODIFY_PROMPT,
      timestamp: getTimeStr(),
    });
    const cModInstr = el.problemDetailChatMessages;
    if (cModInstr) {
      cModInstr.innerHTML = '';
      renderProblemDetailChatFromStorage(cModInstr, __appState.problemDetailChatMessages);
      cModInstr.scrollTop = cModInstr.scrollHeight;
    }
    renderProblemDetailContent();
    renderProblemDetailHistory();
    updateProblemDetailChatHeaderLabel();
    return;
  }
  const prelimModSummaryConfirmBtn = e.target.closest('.btn-prelim-mod-summary-confirm');
  if (prelimModSummaryConfirmBtn && !prelimModSummaryConfirmBtn.disabled) {
    const card = prelimModSummaryConfirmBtn.closest('[data-msg-index]');
    const idx = card ? parseInt(card.getAttribute('data-msg-index') || '-1', 10) : -1;
    if (
      !Number.isInteger(idx) ||
      idx < 0 ||
      !isLatestPendingPreliminaryRequirementModSummaryBlock(__appState.problemDetailChatMessages, idx)
    ) {
      return;
    }
    const chatMsg = __appState.problemDetailChatMessages[idx];
    if (
      !chatMsg ||
      chatMsg.type !== 'preliminaryRequirementModificationSummaryBlock' ||
      !chatMsg.mergedPreliminaryReq ||
      chatMsg.confirmed
    ) {
      return;
    }
    let nextReq;
    try {
      nextReq = JSON.parse(JSON.stringify(chatMsg.mergedPreliminaryReq));
    } catch (_) {
      showError('待应用的初步需求数据无效。');
      return;
    }
    const patchKey = typeof getDigitalProblemPersistKey === 'function' ? getDigitalProblemPersistKey(__appState.currentProblemDetailItem) : null;
    if (!patchKey) {
      showError('无法定位当前案例，未写入工作区。');
      return;
    }
    mergeDigitalProblemPatch(patchKey, { preliminaryReq: nextReq });
    const itemRef = __appState.currentProblemDetailItem;
    if (itemRef && typeof getDigitalProblems === 'function') {
      const synced = getDigitalProblems().find(
        (it) =>
          String(it.createdAt || '') === String(itemRef.createdAt) ||
          (itemRef.id && String(it.id || '') === String(itemRef.id)),
      );
      if (synced) __appState.currentProblemDetailItem = synced;
    }
    __appState.problemDetailChatMessages[idx] = { ...chatMsg, confirmed: true };
    const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
    const cMod = el.problemDetailChatMessages;
    if (cMod) {
      cMod.innerHTML = '';
      renderProblemDetailChatFromStorage(cMod, __appState.problemDetailChatMessages);
      cMod.scrollTop = cMod.scrollHeight;
    }
    renderProblemDetailContent();
    renderProblemDetailHistory();
    updateProblemDetailChatHeaderLabel();
    return;
  }
  const prelimSessionPlanConfirmBtn = e.target.closest('.btn-confirm-prelim-merge-session-plan');
  if (prelimSessionPlanConfirmBtn && !prelimSessionPlanConfirmBtn.disabled) {
    const card = prelimSessionPlanConfirmBtn.closest('[data-msg-index]');
    const idx = card ? parseInt(card.getAttribute('data-msg-index') || '-1', 10) : -1;
    const msg =
      Number.isInteger(idx) && idx >= 0 && idx < __appState.problemDetailChatMessages.length
        ? __appState.problemDetailChatMessages[idx]
        : null;
    if (!msg || msg.type !== 'preliminaryRequirementMergeSessionPlanBlock') return;
    prelimSessionPlanConfirmBtn.disabled = true;
    prelimSessionPlanConfirmBtn.textContent = '执行中…';
    void runTask1PreliminaryMergeSessionPlan(idx, el.problemDetailChatMessages);
    return;
  }
  const prelimDoneBtn = e.target.closest('.btn-prelim-feedback-done');
  if (prelimDoneBtn && !prelimDoneBtn.disabled) {
    const card = prelimDoneBtn.closest('[data-msg-index]');
    const idx = card ? parseInt(card.getAttribute('data-msg-index') || '-1', 10) : -1;
    if (!Number.isInteger(idx) || idx < 0 || !isLatestPreliminaryRequirementFollowupBlock(__appState.problemDetailChatMessages, idx)) return;
    void completeTask1PreliminaryFeedbackDone();
    return;
  }
  const retryLlmBtn = e.target.closest('.btn-retry-llm-call');
  if (retryLlmBtn && !retryLlmBtn.disabled) {
    const card = retryLlmBtn.closest('[data-msg-index]');
    const idx = card ? parseInt(card.getAttribute('data-msg-index') || '-1', 10) : -1;
    const msg = Number.isInteger(idx) && idx >= 0 && idx < __appState.problemDetailChatMessages.length ? __appState.problemDetailChatMessages[idx] : null;
    if (!msg || msg.type !== 'llmRetryNoticeBlock') return;
    retryLlmBtn.disabled = true;
    retryLlmBtn.textContent = '重试中…';
    void (async () => {
      try {
        await retryLlmFlowByAction(msg.retryAction, msg.taskId);
        const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
        if (idx >= 0 && idx < __appState.problemDetailChatMessages.length) {
          const latest = __appState.problemDetailChatMessages[idx];
          if (latest && latest.type === 'llmRetryNoticeBlock') {
            __appState.problemDetailChatMessages[idx] = { ...latest, retrySucceeded: true };
            if (caseKey) saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
          }
        }
        retryLlmBtn.textContent = '已重试';
      } catch (err) {
        showError('重新尝试失败：' + (err?.message || String(err)));
        retryLlmBtn.disabled = false;
        retryLlmBtn.textContent = '重新尝试';
      }
    })();
    return;
  }
  const extractModFromRpAuditBtn = e.target.closest('.btn-role-permission-audit-extract-modification');
  if (extractModFromRpAuditBtn && !extractModFromRpAuditBtn.disabled) {
    const card = extractModFromRpAuditBtn.closest('[data-msg-index]');
    const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    if (card && caseKey) {
      const idx = parseInt(card.getAttribute('data-msg-index'), 10);
      if (!isNaN(idx) && idx >= 0 && idx < __appState.problemDetailChatMessages.length) {
        const msg = __appState.problemDetailChatMessages[idx];
        if (msg && msg.type === 'rolePermissionAuditResultBlock') {
          const opinionRaw = String(msg.auditOpinionRaw != null ? msg.auditOpinionRaw : msg.content || '').trim();
          const defectItems =
            Array.isArray(msg.auditDefectItems) && msg.auditDefectItems.length > 0
              ? msg.auditDefectItems
              : parseRolePermissionAuditDefectItems(opinionRaw);
          const checkedInputs = card ? Array.from(card.querySelectorAll('.role-permission-audit-defect-checkbox')) : [];
          let selectedIdx = checkedInputs
            .filter((it) => !!it && it.checked)
            .map((it) => Number(it.getAttribute('data-defect-index')))
            .filter((n) => Number.isInteger(n) && n >= 0 && n < defectItems.length);
          if (selectedIdx.length === 0 && defectItems.length === 1) selectedIdx = [0];
          if (selectedIdx.length === 0) {
            showError('请至少选择一条审计意见，再提炼修改意见。');
            return;
          }
          const selectedItems = selectedIdx.map((i) => defectItems[i]).filter(Boolean);
          const opinion = selectedItems.map((it, i) => (
            `缺陷 ${i + 1}\n` +
            `- 违反准则：${String(it.principle || '').trim() || '（未提供）'}\n` +
            `- 涉及角色/环节：${String(it.roleStep || '').trim() || '（未提供）'}\n` +
            `- 问题描述：${String(it.problemDescription || '').trim() || '（未提供）'}\n` +
            `- 重构指令：${String(it.refactorInstruction || '').trim() || '（未提供）'}`
          )).join('\n\n').trim();
          if (opinion) {
            __appState.problemDetailChatMessages[idx] = {
              ...msg,
              modificationExtractUsed: true,
              auditDefectItems: defectItems,
              selectedAuditDefectIndexes: selectedIdx,
              selectedAuditDefectItems: selectedItems,
            };
            saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
            const cont0 = el.problemDetailChatMessages;
            if (cont0) {
              cont0.innerHTML = '';
              renderProblemDetailChatFromStorage(cont0, __appState.problemDetailChatMessages);
              cont0.scrollTop = cont0.scrollHeight;
            }
            renderProblemDetailHistory();
            problemDetailWaitingForFeedback = { taskId: 'task12', createdAt: caseKey, type: 'modification', sourceMsgIndex: idx };
            void handleProblemDetailChatSend({
              overrideText: `【角色与权限合规审计意见】\n${opinion}`,
              skipAppendUser: true,
              skipInputClear: true,
              modificationIntentConfirmed: false,
            });
          }
        }
      }
    }
    return;
  }
  const extractModFromCboGlobalAuditBtn = e.target.closest('.btn-cbo-global-audit-extract-modification');
  if (extractModFromCboGlobalAuditBtn && !extractModFromCboGlobalAuditBtn.disabled) {
    if (isProblemDetailChatCboUiSuppressed()) return;
    const card = extractModFromCboGlobalAuditBtn.closest('[data-msg-index]');
    const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    if (card && caseKey) {
      const idx = parseInt(card.getAttribute('data-msg-index'), 10);
      if (!isNaN(idx) && idx >= 0 && idx < __appState.problemDetailChatMessages.length) {
        const msg = __appState.problemDetailChatMessages[idx];
        if (msg && msg.type === 'coreBusinessObjectGlobalAuditResultBlock') {
          const opinionRaw = String(msg.auditOpinionRaw != null ? msg.auditOpinionRaw : msg.content || '').trim();
          const defectItems =
            Array.isArray(msg.auditDefectItems) && msg.auditDefectItems.length > 0
              ? msg.auditDefectItems
              : parseCoreBusinessObjectGlobalAuditDefectItems(opinionRaw);
          const checkedInputs = card ? Array.from(card.querySelectorAll('.role-permission-audit-defect-checkbox')) : [];
          let selectedIdx = checkedInputs
            .filter((it) => !!it && it.checked)
            .map((it) => Number(it.getAttribute('data-defect-index')))
            .filter((n) => Number.isInteger(n) && n >= 0 && n < defectItems.length);
          if (selectedIdx.length === 0 && defectItems.length === 1) selectedIdx = [0];
          if (selectedIdx.length === 0) {
            showError('请至少选择一条审计缺陷，再点击确定。');
            return;
          }
          const selectedItems = selectedIdx.map((i) => defectItems[i]).filter(Boolean);
          const opinion = selectedItems
            .map(
              (it, i) =>
                `缺陷 ${i + 1}\n` +
                `- 缺陷类型：${String(it.principle || '').trim() || '（未提供）'}\n` +
                `- 涉及对象/环节：${String(it.roleStep || '').trim() || '（未提供）'}\n` +
                `- 风险描述：${String(it.problemDescription || '').trim() || '（未提供）'}\n` +
                `- 修正建议：${String(it.refactorInstruction || '').trim() || '（未提供）'}`,
            )
            .join('\n\n')
            .trim();
          if (opinion) {
            __appState.problemDetailChatMessages[idx] = {
              ...msg,
              modificationExtractUsed: true,
              auditDefectItems: defectItems,
              selectedAuditDefectIndexes: selectedIdx,
              selectedAuditDefectItems: selectedItems,
            };
            saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
            const cont0 = el.problemDetailChatMessages;
            if (cont0) {
              cont0.innerHTML = '';
              renderProblemDetailChatFromStorage(cont0, __appState.problemDetailChatMessages);
              cont0.scrollTop = cont0.scrollHeight;
            }
            renderProblemDetailHistory();
            problemDetailWaitingForFeedback = { taskId: 'task12', createdAt: caseKey, type: 'modification', sourceMsgIndex: idx };
            void handleProblemDetailChatSend({
              overrideText: `【核心业务对象全局审计意见】\n${opinion}`,
              skipAppendUser: true,
              skipInputClear: true,
              modificationIntentConfirmed: false,
            });
          }
        }
      }
    }
    return;
  }
  const refineModifyBtn = e.target.closest('.btn-refine-modify');
  if (refineModifyBtn && !refineModifyBtn.disabled) {
    const card = refineModifyBtn.closest('[data-msg-index]');
    const taskId = (card && card.getAttribute('data-task-id')) || '';
    const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    // 与完工确认「请修改」一致：从输出卡「修正」进入修改链时须收口未决确认块，否则重跑 Session 后 showTaskCompletionConfirm 会因旧块 !userChoseModify 早退（FE-20260407）
    if (taskId === 'task4' || taskId === 'task7') markTaskCompletionConfirmUserChoseModify(taskId);
    if (card && taskId && caseKey) {
      const idx = parseInt(card.getAttribute('data-msg-index'), 10);
      if (!isNaN(idx) && idx >= 0 && idx < __appState.problemDetailChatMessages.length) {
        const msg = __appState.problemDetailChatMessages[idx];
        const payloadJson = JSON.stringify(msg);
        pushAndSaveProblemDetailChat({ type: 'unsatisfiedBlock', taskId, content: payloadJson, timestamp: getTimeStr() });
        problemDetailWaitingForFeedback = { taskId, createdAt: caseKey, type: 'modification', sourceMsgIndex: idx };
        const tipBlock = document.createElement('div');
        tipBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
        tipBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">请描述您的修改意见（输入后发送）</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
        el.problemDetailChatMessages?.appendChild(tipBlock);
        el.problemDetailChatMessages.scrollTop = el.problemDetailChatMessages.scrollHeight;
        pushAndSaveProblemDetailChat({ role: 'system', content: '请描述您的修改意见（输入后发送）', timestamp: getTimeStr() });
        const cont = el.problemDetailChatMessages;
        if (cont) {
          cont.innerHTML = '';
          renderProblemDetailChatFromStorage(cont, __appState.problemDetailChatMessages);
          cont.scrollTop = cont.scrollHeight;
        }
        renderProblemDetailHistory();
      }
    }
    return;
  }
  const refineDiscussBtn = e.target.closest('.btn-refine-discuss');
  if (refineDiscussBtn && !refineDiscussBtn.disabled) {
    const card = refineDiscussBtn.closest('[data-msg-index]');
    const taskId = (card && card.getAttribute('data-task-id')) || '';
    const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    if (taskId && caseKey && card) {
      const idx = parseInt(card.getAttribute('data-msg-index'), 10);
      problemDetailWaitingForFeedback = { taskId, createdAt: caseKey, type: 'discussion', sourceMsgIndex: !isNaN(idx) ? idx : undefined };
      if (taskId === 'task2') {
        pushAndSaveProblemDetailChat({ type: 'bmcDiscussionStartBlock', taskId: 'task2', timestamp: getTimeStr() });
        updateProblemDetailChatDiscussionIndicator();
      }
      const cont = el.problemDetailChatMessages;
      const tipBlock = document.createElement('div');
      tipBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
      tipBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">请描述您想讨论的问题（输入后发送）</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
      cont?.appendChild(tipBlock);
      cont.scrollTop = cont.scrollHeight;
      pushAndSaveProblemDetailChat({ role: 'system', content: '请描述您想讨论的问题（输入后发送）', timestamp: getTimeStr() });
      if (cont) {
        cont.innerHTML = '';
        renderProblemDetailChatFromStorage(cont, __appState.problemDetailChatMessages);
        cont.scrollTop = cont.scrollHeight;
      }
    }
    return;
  }
  const bmcDiscussContinueBtn = e.target.closest('.btn-bmc-discuss-continue');
  if (bmcDiscussContinueBtn) {
    const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    if (caseKey) {
      problemDetailWaitingForFeedback = { taskId: 'task2', createdAt: caseKey, type: 'discussion' };
      const inputEl = el.problemDetailChatInput;
      if (inputEl) {
        inputEl.focus();
      }
    }
    return;
  }
  const bmcDiscussRegenerateBtn = e.target.closest('.btn-bmc-discuss-regenerate');
  if (bmcDiscussRegenerateBtn) {
    // [bridge] → core/task2-companion-runtime.js (Phase 4A)
    void globalThis.SmartCto.task2Runtime.handleBmcDiscussRegenerateClick();
    return;
  }
  const confirmModificationResponseBtn = e.target.closest('.btn-confirm-modification-response');
  if (confirmModificationResponseBtn && !confirmModificationResponseBtn.disabled) {
    const card = confirmModificationResponseBtn.closest('[data-msg-index]');
    if (card && __appState.currentProblemDetailItem?.createdAt) {
      const idx = parseInt(card.getAttribute('data-msg-index'), 10);
      const taskId = card.getAttribute('data-task-id') || '';
      if (!isNaN(idx) && idx >= 0 && idx < __appState.problemDetailChatMessages.length) {
        const msg = __appState.problemDetailChatMessages[idx];
        if (msg && (msg.type === 'modificationResponseBlock' || msg.type === 'rolePermissionModificationActionBlock')) {
          msg.confirmed = true;
          saveProblemDetailChat(__appState.currentProblemDetailItem.createdAt, __appState.problemDetailChatMessages);
          const container = el.problemDetailChatMessages;
          if (container) {
            container.innerHTML = '';
            renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
            container.scrollTop = container.scrollHeight;
          }
          renderProblemDetailHistory();
          const taskName = (FOLLOW_TASKS || []).concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === taskId)?.name || taskId;
          showTaskCompletionConfirm(taskId, taskName);
        }
      }
    }
    return;
  }
  const confirmModificationIntentBtn = e.target.closest('.btn-confirm-modification-intent');
  if (confirmModificationIntentBtn && !confirmModificationIntentBtn.disabled) {
    const card = confirmModificationIntentBtn.closest('[data-msg-index]');
    const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    if (card && caseKey) {
      const idx = parseInt(card.getAttribute('data-msg-index'), 10);
      if (!isNaN(idx) && idx >= 0 && idx < __appState.problemDetailChatMessages.length) {
        const msg = __appState.problemDetailChatMessages[idx];
        if (msg && msg.type === 'modificationIntentConfirmBlock') {
          msg.confirmed = true;
          saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
          const container = el.problemDetailChatMessages;
          if (container) {
            container.innerHTML = '';
            renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
            container.scrollTop = container.scrollHeight;
          }
          renderProblemDetailHistory();
          problemDetailWaitingForFeedback = {
            taskId: msg.taskId || '',
            createdAt: caseKey,
            type: 'modification',
            sourceMsgIndex: (typeof msg.sourceMsgIndex === 'number' ? msg.sourceMsgIndex : -1),
          };
          const r = String(msg.modificationReason || '').trim() || '（未提供）';
          const g = String(msg.modificationGoal || '').trim() || '（未提供）';
          const orig = String(msg.userFeedback || '').trim();
          void handleProblemDetailChatSend({
            overrideText: `修改动因：${r}\n修改目标：${g}${orig ? `\n\n【用户原始反馈】\n${orig}` : ''}`,
            skipAppendUser: true,
            skipInputClear: true,
            modificationIntentConfirmed: true,
          });
        }
      }
    }
    return;
  }
  const confirmCboModRegenPhase2Btn = e.target.closest('.btn-confirm-core-business-object-mod-regenerate-phase2');
  if (confirmCboModRegenPhase2Btn && !confirmCboModRegenPhase2Btn.disabled) {
    if (isProblemDetailChatCboUiSuppressed()) return;
    const card = confirmCboModRegenPhase2Btn.closest('[data-msg-index]');
    if (card && __appState.currentProblemDetailItem?.createdAt) {
      const idx = parseInt(card.getAttribute('data-msg-index'), 10);
      const createdAt = __appState.currentProblemDetailItem.createdAt;
      const container = el.problemDetailChatMessages;
      if (!isNaN(idx) && idx >= 0 && idx < __appState.problemDetailChatMessages.length) {
        const msg = __appState.problemDetailChatMessages[idx];
        if (msg && msg.type === 'coreBusinessObjectModificationRegenerateNotifyBlock' && !msg.confirmed) {
          msg.confirmed = true;
          saveProblemDetailChat(createdAt, __appState.problemDetailChatMessages);
          if (typeof removeDigitalProblemCompletedTaskId === 'function') {
            removeDigitalProblemCompletedTaskId(createdAt, 'task11');
            removeDigitalProblemCompletedTaskId(createdAt, 'task12');
          }
          let item =
            typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(__appState.currentProblemDetailItem) : null;
          if (!item) item = __appState.currentProblemDetailItem;
          const valueStream = resolveValueStreamForItGap(item);
          const result =
            typeof executeCoreBusinessObjectTaskOnConfirm === 'function'
              ? executeCoreBusinessObjectTaskOnConfirm(
                  item,
                  valueStream,
                  {
                    pushAndSaveProblemDetailChat,
                    updateDigitalProblemCoreBusinessObjectSessions,
                    getTimeStr,
                    getLatestConfirmedRolePermissionContent,
                    getLocalItGapCompressedJsonForWorkspace,
                  },
                  { skipContextBlocks: true },
                )
              : null;
          if (result && !result.ok) {
            pushAndSaveProblemDetailChat({
              role: 'system',
              content: result.error || '无法按新提示词重新下发核心业务对象推演 session 计划。',
              timestamp: getTimeStr(),
            });
          } else if (result && result.ok) {
            __appState.currentProblemDetailItem = result.updatedItem;
            const merged = typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(__appState.currentProblemDetailItem) : null;
            if (merged) __appState.currentProblemDetailItem = merged;
          }
          if (container) {
            container.innerHTML = '';
            renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
            container.scrollTop = container.scrollHeight;
          }
          if (typeof renderProblemDetailHistory === 'function') renderProblemDetailHistory();
          itStrategyPlanViewingSubstep = 1;
          problemDetailViewingMajorStage = 3;
          updateProblemDetailProgressStages(3, problemDetailViewingMajorStage);
          renderProblemDetailContent();
        }
      }
    }
    return;
  }
  const confirmPainPointModRegenPhase2Btn = e.target.closest('.btn-confirm-pain-point-mod-regenerate-phase2');
  if (confirmPainPointModRegenPhase2Btn && !confirmPainPointModRegenPhase2Btn.disabled) {
    const card = confirmPainPointModRegenPhase2Btn.closest('[data-msg-index]');
    const caseKey = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    if (card && caseKey) {
      const idx = parseInt(card.getAttribute('data-msg-index'), 10);
      const container = el.problemDetailChatMessages;
      if (!isNaN(idx) && idx >= 0 && idx < __appState.problemDetailChatMessages.length) {
        const msg = __appState.problemDetailChatMessages[idx];
        if (msg && msg.type === 'painPointModificationRegenerateNotifyBlock' && !msg.confirmed) {
          msg.confirmed = true;
          saveProblemDetailChat(caseKey, __appState.problemDetailChatMessages);
          if (typeof rollbackValueStreamPainPoint === 'function') rollbackValueStreamPainPoint(caseKey);
          let item =
            typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(__appState.currentProblemDetailItem) : null;
          if (!item) item = __appState.currentProblemDetailItem;
          const valueStream = resolveValueStreamForItGap(item);
          const sessions = typeof generatePainPointSessions === 'function' ? generatePainPointSessions(valueStream) : [];
          if (typeof updateDigitalProblemPainPointSessions === 'function') {
            updateDigitalProblemPainPointSessions(caseKey, sessions);
          }
          const mergedListItem =
            typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(__appState.currentProblemDetailItem) : null;
          __appState.currentProblemDetailItem = mergedListItem
            ? { ...mergedListItem, painPointSessions: sessions }
            : { ...__appState.currentProblemDetailItem, painPointSessions: sessions };
          pushAndSaveProblemDetailChat({
            type: 'painPointSessionsBlock',
            taskId: 'task6',
            sessions,
            timestamp: getTimeStr(),
          });
          if (container) {
            container.innerHTML = '';
            renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
            container.scrollTop = container.scrollHeight;
          }
          void refreshProblemDetailWorkspaceWithAnimation('正在刷新页面并重置痛点标注数据…').then(() => {
            if (typeof renderProblemDetailHistory === 'function') renderProblemDetailHistory();
            // 与主流程一致：下发 painPointSessionsBlock 后由用户在卡片上点击「自动顺序执行」再开始首环，不在此处自动单步
          });
        }
      }
    }
    return;
  }
  const confirmItStatusModRegenPhase2Btn = e.target.closest('.btn-confirm-it-status-mod-regenerate-phase2');
  if (confirmItStatusModRegenPhase2Btn && !confirmItStatusModRegenPhase2Btn.disabled) {
    const card = confirmItStatusModRegenPhase2Btn.closest('[data-msg-index]');
    const caseKeyIt = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    if (card && caseKeyIt) {
      const idxIt = parseInt(card.getAttribute('data-msg-index'), 10);
      const containerItMod = el.problemDetailChatMessages;
      if (!isNaN(idxIt) && idxIt >= 0 && idxIt < __appState.problemDetailChatMessages.length) {
        const msgIt = __appState.problemDetailChatMessages[idxIt];
        if (msgIt && msgIt.type === 'itStatusModificationRegenerateNotifyBlock' && !msgIt.confirmed) {
          msgIt.confirmed = true;
          saveProblemDetailChat(caseKeyIt, __appState.problemDetailChatMessages);
          let itemIt =
            typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(__appState.currentProblemDetailItem) : null;
          if (!itemIt) itemIt = __appState.currentProblemDetailItem;
          const valueStreamIt = itemIt?.valueStream;
          if (!valueStreamIt || valueStreamIt.raw) {
            pushAndSaveProblemDetailChat({
              role: 'system',
              content: '无法继续：当前案例缺少有效价值流数据，不能重建 IT 现状 Session 计划。',
              timestamp: getTimeStr(),
            });
            if (containerItMod) {
              containerItMod.innerHTML = '';
              renderProblemDetailChatFromStorage(containerItMod, __appState.problemDetailChatMessages);
              containerItMod.scrollTop = containerItMod.scrollHeight;
            }
            renderProblemDetailHistory();
            return;
          }
          const sessionsIt =
            typeof generateItStatusSessions === 'function' ? generateItStatusSessions(valueStreamIt) : [];
          if (typeof updateDigitalProblemItStatusSessions === 'function') {
            updateDigitalProblemItStatusSessions(caseKeyIt, sessionsIt);
          }
          setTask5ModAwaitingAutoStrip(caseKeyIt, true);
          const mergedListIt =
            typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(__appState.currentProblemDetailItem) : null;
          __appState.currentProblemDetailItem = mergedListIt
            ? { ...mergedListIt, itStatusSessions: sessionsIt }
            : { ...__appState.currentProblemDetailItem, itStatusSessions: sessionsIt };
          pushAndSaveProblemDetailChat({
            type: 'itStatusSessionsBlock',
            taskId: 'task5',
            sessions: sessionsIt,
            timestamp: getTimeStr(),
          });
          if (containerItMod) {
            containerItMod.innerHTML = '';
            renderProblemDetailChatFromStorage(containerItMod, __appState.problemDetailChatMessages);
            containerItMod.scrollTop = containerItMod.scrollHeight;
          }
          void refreshProblemDetailWorkspaceWithAnimation('正在刷新页面并加载 IT 现状 Session 计划…').then(() => {
            if (typeof renderProblemDetailHistory === 'function') renderProblemDetailHistory();
          });
        }
      }
    }
    return;
  }
  const confirmValueStreamModRegenPhase2Btn = e.target.closest('.btn-confirm-value-stream-mod-regenerate-phase2');
  if (confirmValueStreamModRegenPhase2Btn && !confirmValueStreamModRegenPhase2Btn.disabled) {
    const cardVs = confirmValueStreamModRegenPhase2Btn.closest('[data-msg-index]');
    const caseKeyVsMod = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
    if (cardVs && caseKeyVsMod) {
      const idxVs = parseInt(cardVs.getAttribute('data-msg-index'), 10);
      const containerVsMod = el.problemDetailChatMessages;
      if (!isNaN(idxVs) && idxVs >= 0 && idxVs < __appState.problemDetailChatMessages.length) {
        const msgVs = __appState.problemDetailChatMessages[idxVs];
        if (msgVs && msgVs.type === 'valueStreamModificationRegenerateNotifyBlock' && !msgVs.confirmed) {
          const bundle = getTask4ValueStreamModificationBundle(caseKeyVsMod);
          if (!bundle) {
            pushAndSaveProblemDetailChat({
              role: 'system',
              content: '无法继续：缺少价值流修改提示词上下文，请从「请修改」链路重新生成新提示词。',
              timestamp: getTimeStr(),
            });
            if (containerVsMod) {
              containerVsMod.innerHTML = '';
              renderProblemDetailChatFromStorage(containerVsMod, __appState.problemDetailChatMessages);
              containerVsMod.scrollTop = containerVsMod.scrollHeight;
            }
            renderProblemDetailHistory();
            return;
          }
          markTaskCompletionConfirmUserChoseModify('task4');
          msgVs.confirmed = true;
          saveProblemDetailChat(caseKeyVsMod, __appState.problemDetailChatMessages);
          const vsSessionsReset = getDefaultValueStreamDrawSessions();
          const emptyVs = { stages: [] };
          if (typeof updateDigitalProblemValueStream === 'function') {
            updateDigitalProblemValueStream(caseKeyVsMod, emptyVs);
          }
          if (typeof updateDigitalProblemValueStreamLogicText === 'function') {
            updateDigitalProblemValueStreamLogicText(caseKeyVsMod, '', 'mirror');
            updateDigitalProblemValueStreamLogicText(caseKeyVsMod, '', 'hardening');
          }
          if (typeof updateDigitalProblemValueStreamHardeningDraft === 'function') {
            updateDigitalProblemValueStreamHardeningDraft(caseKeyVsMod, null);
          }
          if (typeof updateDigitalProblemValueStreamDrawSessions === 'function') {
            updateDigitalProblemValueStreamDrawSessions(caseKeyVsMod, vsSessionsReset);
          }
          const mergedVs =
            typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(__appState.currentProblemDetailItem) : null;
          __appState.currentProblemDetailItem = mergedVs
            ? {
                ...mergedVs,
                valueStream: emptyVs,
                valueStreamLogicText: '',
                valueStreamLogicTextMirror: '',
                valueStreamLogicTextHardening: '',
                valueStreamHardeningDraft: undefined,
                valueStreamDrawSessions: vsSessionsReset,
              }
            : {
                ...__appState.currentProblemDetailItem,
                valueStream: emptyVs,
                valueStreamLogicText: '',
                valueStreamLogicTextMirror: '',
                valueStreamLogicTextHardening: '',
                valueStreamHardeningDraft: undefined,
                valueStreamDrawSessions: vsSessionsReset,
              };
          pushAndSaveProblemDetailChat({
            type: 'valueStreamDrawSessionsBlock',
            taskId: 'task4',
            timestamp: getTimeStr(),
          });
          if (containerVsMod) {
            containerVsMod.innerHTML = '';
            renderProblemDetailChatFromStorage(containerVsMod, __appState.problemDetailChatMessages);
            containerVsMod.scrollTop = containerVsMod.scrollHeight;
          }
          void refreshProblemDetailWorkspaceWithAnimation('已清空工作区价值流，正在加载 Session 计划…').then(() => {
            if (typeof renderProblemDetailHistory === 'function') renderProblemDetailHistory();
          });
        }
      }
    }
    return;
  }
  const confirmModificationRegeneratePromptBtn = e.target.closest('.btn-confirm-modification-regenerate-prompt');
  if (confirmModificationRegeneratePromptBtn && !confirmModificationRegeneratePromptBtn.disabled) {
    const card = confirmModificationRegeneratePromptBtn.closest('[data-msg-index]');
    if (card && getProblemDetailChatStorageKey(__appState.currentProblemDetailItem)) {
      const idx = parseInt(card.getAttribute('data-msg-index'), 10);
      const taskIdAttr = card.getAttribute('data-task-id') || '';
      if (!isNaN(idx) && idx >= 0 && idx < __appState.problemDetailChatMessages.length) {
        const msg = __appState.problemDetailChatMessages[idx];
        if (msg && msg.type === 'modificationNewPromptConfirmBlock' && !msg.confirmed) {
          const createdAt = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
          const container = el.problemDetailChatMessages;
          const sendBtn = el.problemDetailChatSend;
          const effectiveTaskId = String(msg.taskId || taskIdAttr || '').trim();
          if (effectiveTaskId === 'task11' || effectiveTaskId === 'task12') {
            let sysCbo = String(msg.systemForSecond || msg.newSystemPrompt || '').trim();
            sysCbo = appendModificationVersionChangelogToSystemPrompt(sysCbo, msg.versionChangelog);
            if (!sysCbo) {
              pushAndSaveProblemDetailChat({
                role: 'system',
                content: '无法继续：缺少新提示词内容，请重新发起修改。',
                timestamp: getTimeStr(),
              });
              if (container) {
                container.innerHTML = '';
                renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
                container.scrollTop = container.scrollHeight;
              }
              renderProblemDetailHistory();
              return;
            }
            if (typeof updateDigitalProblemCoreBusinessObjectSystemPromptOverride === 'function') {
              updateDigitalProblemCoreBusinessObjectSystemPromptOverride(createdAt, sysCbo);
            }
            const mergedListItem =
              typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(__appState.currentProblemDetailItem) : null;
            __appState.currentProblemDetailItem = mergedListItem
              ? { ...mergedListItem, coreBusinessObjectSystemPromptOverride: sysCbo }
              : { ...__appState.currentProblemDetailItem, coreBusinessObjectSystemPromptOverride: sysCbo };
            msg.confirmed = true;
            saveProblemDetailChat(createdAt, __appState.problemDetailChatMessages);
            if (isProblemDetailChatCboUiSuppressed()) {
              if (typeof removeDigitalProblemCompletedTaskId === 'function') {
                removeDigitalProblemCompletedTaskId(createdAt, 'task11');
                removeDigitalProblemCompletedTaskId(createdAt, 'task12');
              }
              let cboItem =
                typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(__appState.currentProblemDetailItem) : null;
              if (!cboItem) cboItem = __appState.currentProblemDetailItem;
              const vsCbo = resolveValueStreamForItGap(cboItem);
              const cboResult =
                typeof executeCoreBusinessObjectTaskOnConfirm === 'function'
                  ? executeCoreBusinessObjectTaskOnConfirm(
                      cboItem,
                      vsCbo,
                      {
                        pushAndSaveProblemDetailChat,
                        updateDigitalProblemCoreBusinessObjectSessions,
                        getTimeStr,
                        getLatestConfirmedRolePermissionContent,
                        getLocalItGapCompressedJsonForWorkspace,
                      },
                      { skipContextBlocks: true },
                    )
                  : null;
              if (cboResult && !cboResult.ok) {
                pushAndSaveProblemDetailChat({
                  role: 'system',
                  content: cboResult.error || '无法按新提示词重新下发核心业务对象 session 计划。',
                  timestamp: getTimeStr(),
                });
              } else if (cboResult && cboResult.ok) {
                __appState.currentProblemDetailItem = cboResult.updatedItem;
                const mergedCbo =
                  typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(__appState.currentProblemDetailItem) : null;
                if (mergedCbo) __appState.currentProblemDetailItem = mergedCbo;
              }
              itStrategyPlanViewingSubstep = 1;
              problemDetailViewingMajorStage = 3;
              updateProblemDetailProgressStages(3, problemDetailViewingMajorStage);
            } else {
              pushAndSaveProblemDetailChat({
                type: 'coreBusinessObjectModificationRegenerateNotifyBlock',
                taskId: 'task12',
                content: '我将按新提示词重新进行【核心业务对象推演】。请点击「确认」后继续。',
                timestamp: getTimeStr(),
                confirmed: false,
              });
            }
            if (container) {
              container.innerHTML = '';
              renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
              container.scrollTop = container.scrollHeight;
            }
            void refreshProblemDetailWorkspaceWithAnimation('正在刷新页面并加载新的任务数据…').then(() => {
              renderProblemDetailHistory();
            });
            return;
          }
          if (effectiveTaskId === 'task6') {
            let sysTask6 = String(msg.systemForSecond || msg.newSystemPrompt || '').trim();
            sysTask6 = appendModificationVersionChangelogToSystemPrompt(sysTask6, msg.versionChangelog);
            if (!sysTask6) {
              pushAndSaveProblemDetailChat({
                role: 'system',
                content: '无法继续：缺少新提示词内容，请重新发起修改。',
                timestamp: getTimeStr(),
              });
              if (container) {
                container.innerHTML = '';
                renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
                container.scrollTop = container.scrollHeight;
              }
              renderProblemDetailHistory();
              return;
            }
            setTask6PainPointPromptOverride(createdAt, sysTask6);
            msg.confirmed = true;
            saveProblemDetailChat(createdAt, __appState.problemDetailChatMessages);
            pushAndSaveProblemDetailChat({
              type: 'painPointModificationRegenerateNotifyBlock',
              taskId: 'task6',
              content: '已恢复修改意图。即将按新提示词重新生成【痛点标注】session计划。请点击「确认」后继续。',
              timestamp: getTimeStr(),
              confirmed: false,
            });
            if (container) {
              container.innerHTML = '';
              renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
              container.scrollTop = container.scrollHeight;
            }
            renderProblemDetailHistory();
            return;
          }
          if (effectiveTaskId === 'task5') {
            let sysTask5 = String(msg.systemForSecond || msg.newSystemPrompt || '').trim();
            sysTask5 = appendModificationVersionChangelogToSystemPrompt(sysTask5, msg.versionChangelog);
            if (!sysTask5) {
              pushAndSaveProblemDetailChat({
                role: 'system',
                content: '无法继续：缺少新提示词内容，请重新发起修改。',
                timestamp: getTimeStr(),
              });
              if (container) {
                container.innerHTML = '';
                renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
                container.scrollTop = container.scrollHeight;
              }
              renderProblemDetailHistory();
              return;
            }
            setTask5ItStatusPromptOverride(createdAt, sysTask5);
            msg.confirmed = true;
            saveProblemDetailChat(createdAt, __appState.problemDetailChatMessages);
            pushAndSaveProblemDetailChat({
              type: 'itStatusModificationRegenerateNotifyBlock',
              taskId: 'task5',
              content:
                '修改意图已确认。上方「新提示词」将用于后续 IT 现状逐环节标注。请点击「确认」后重新加载 Session 计划（列出全部价值流环节）；随后在计划卡片点击「自动顺序执行」时，会先清空工作区中的 IT 现状/IT 计划，再按新提示词逐节点重新标注。',
              timestamp: getTimeStr(),
              confirmed: false,
            });
            if (container) {
              container.innerHTML = '';
              renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
              container.scrollTop = container.scrollHeight;
            }
            if (
              problemDetailWaitingForFeedback &&
              String(problemDetailWaitingForFeedback.taskId || '') === 'task5' &&
              String(problemDetailWaitingForFeedback.type || '') === 'modification'
            ) {
              problemDetailWaitingForFeedback = null;
            }
            renderProblemDetailHistory();
            return;
          }
          const sys = String(msg.systemForSecond || '').trim();
          const usr = String(msg.userForSecond || '').trim();
          if (!sys || !usr) {
            pushAndSaveProblemDetailChat({
              role: 'system',
              content: '无法执行重新生成：缺少新提示词或用户侧上下文。',
              timestamp: getTimeStr(),
            });
            if (container) {
              container.innerHTML = '';
              renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
              container.scrollTop = container.scrollHeight;
            }
            renderProblemDetailHistory();
            return;
          }
          if (effectiveTaskId === 'task4') {
            msg.confirmed = true;
            saveProblemDetailChat(createdAt, __appState.problemDetailChatMessages);
            markTaskCompletionConfirmUserChoseModify('task4');
            const task4Dual =
              msg.task4MirrorSystemForSecond != null || msg.task4HardeningSystemForSecond != null;
            if (task4Dual) {
              const mirrorSys = appendModificationVersionChangelogToSystemPrompt(
                String(msg.task4MirrorSystemForSecond || '').trim(),
                msg.task4MirrorVersionChangelog || '',
              );
              const hardeningSys = appendModificationVersionChangelogToSystemPrompt(
                String(msg.task4HardeningSystemForSecond || '').trim(),
                msg.task4HardeningVersionChangelog || '',
              );
              setTask4ValueStreamModificationBundle(createdAt, {
                mirrorSystemPrompt: mirrorSys,
                hardeningSystemPrompt: hardeningSys,
                userPrompt: usr,
                versionChangelogMirror: String(msg.task4MirrorVersionChangelog || '').trim(),
                versionChangelogHardening: String(msg.task4HardeningVersionChangelog || '').trim(),
              });
            } else {
              const sys4 = appendModificationVersionChangelogToSystemPrompt(sys, msg.versionChangelog);
              setTask4ValueStreamModificationBundle(createdAt, sys4, usr, msg.versionChangelog || '');
            }
            if (
              problemDetailWaitingForFeedback &&
              String(problemDetailWaitingForFeedback.taskId || '') === 'task4' &&
              String(problemDetailWaitingForFeedback.type || '') === 'modification'
            ) {
              problemDetailWaitingForFeedback = null;
            }
            pushAndSaveProblemDetailChat({
              type: 'valueStreamModificationRegenerateNotifyBlock',
              taskId: 'task4',
              content: task4Dual
                ? '修改意图已确认。即将按**两阶段新提示词**（Mirror 与分阶段加固分别注入）重新提取并绘制价值流。请点击「确认」后将**清空当前工作区价值流图**，再重新下发 Session 计划；随后在计划卡片点击「自动顺序执行」依次完成 Mirror 与加固。'
                : '修改意图已确认。将按新提示词重新绘制价值流：请点击「确认」后重新下发「绘制价值流 Session 计划」，再在计划卡片上点击「自动顺序执行」完成 Mirror 与分阶段加固。',
              timestamp: getTimeStr(),
              confirmed: false,
            });
            if (container) {
              container.innerHTML = '';
              renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
              container.scrollTop = container.scrollHeight;
            }
            renderProblemDetailHistory();
            return;
          }
          let secondRoundSys = appendModificationVersionChangelogToSystemPrompt(sys, msg.versionChangelog);
          const secondRoundUsr = usr;
          if (sendBtn) sendBtn.disabled = true;
          const parsingBlock = document.createElement('div');
          parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
          parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在按新提示词重新生成…</span></div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
          if (container) {
            container.appendChild(parsingBlock);
            container.scrollTop = container.scrollHeight;
          }
          const chatOpts = effectiveTaskId ? { taskTag: String(effectiveTaskId) } : undefined;
          void fetchDeepSeekChat([{ role: 'system', content: secondRoundSys }, { role: 'user', content: secondRoundUsr }], chatOpts)
            .then((second) => {
              parsingBlock.remove();
              msg.confirmed = true;
              saveProblemDetailChat(createdAt, __appState.problemDetailChatMessages);
              const secondRoundLlmInputPrompt = `【系统】\n${secondRoundSys}\n\n【用户】\n${secondRoundUsr}`;
              const effTid = String(msg.taskId || taskIdAttr || '').trim();
              const regenerateNoteName =
                effTid === 'task5' ? 'IT现状按新提示词重新生成' : '修改·按新提示词重新生成';
              pushAndSaveProblemDetailChat({
                type: 'modificationRegenerateLlmQueryBlock',
                taskId: msg.taskId || taskIdAttr,
                noteName: regenerateNoteName,
                llmInputPrompt: secondRoundLlmInputPrompt,
                llmOutputRaw: second.content || '',
                timestamp: getTimeStr(),
                llmMeta: { usage: second.usage, model: second.model, durationMs: second.durationMs },
              });
              pushModificationRegenerateOutcome(msg.taskId || taskIdAttr, (second.content || '').trim(), second.usage, second.model, second.durationMs, {
                modificationConfirmBlock: msg,
              });
              if (container) {
                container.innerHTML = '';
                renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
                container.scrollTop = container.scrollHeight;
              }
              void refreshProblemDetailWorkspaceWithAnimation('正在刷新页面并加载重生成结果…').then(() => {
                renderProblemDetailHistory();
              });
              if (sendBtn) sendBtn.disabled = false;
            })
            .catch((err) => {
              parsingBlock.remove();
              const errText = err.message || String(err);
              if (container) {
                const errBlock = document.createElement('div');
                errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
                errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">按新提示词重新生成失败：${escapeHtml(errText)}</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
                container.appendChild(errBlock);
              }
              pushAndSaveProblemDetailChat({ role: 'system', content: '按新提示词重新生成失败：' + errText, timestamp: getTimeStr() });
              if (sendBtn) sendBtn.disabled = false;
            });
        }
      }
    }
    return;
  }
  const taskCompleteDoneBtn = e.target.closest('.btn-task-complete-done');
  if (taskCompleteDoneBtn && !taskCompleteDoneBtn.disabled) {
    const taskId = taskCompleteDoneBtn.getAttribute('data-task-id') || '';
    const taskName = taskCompleteDoneBtn.getAttribute('data-task-name') || taskId;
    const item = __appState.currentProblemDetailItem;
    const caseId = getCurrentProblemCaseIdForBackend();
    const backendTaskId = mapProblemTaskIdToBackendTaskId(taskId);
    if (taskId === 'task5') logTask5TaskDoneProgressDebug('before-done');

    // 在线模式：任务完工确认走后端动作接口并刷新首屏
    if (isOnlineMode() && caseId && backendTaskId) {
      let taskCompleteContent = '用户确认任务完成';
      if (taskId === 'task7') taskCompleteContent = '用户确认端到端事务流构建';
      else if (taskId === 'task8') taskCompleteContent = '用户确认 IT设计补齐';
      else if (taskId === 'task9') taskCompleteContent = '用户确认对象状态机构建';

      const notYetBtn = taskCompleteDoneBtn.closest('.problem-detail-chat-task-completion-actions')?.querySelector('.btn-task-complete-not-yet');
      const isTask2Confirm = taskId === 'task2';
      const useCompletionConfirmInFlight =
        taskId === 'task2' ||
        taskId === 'task3' ||
        taskId === 'task4' ||
        taskId === 'task5' ||
        taskId === 'task6';

      // task2–task6：先发「提交中」与 confirmInFlight，避免请求未完成时误显「已完成」；其余任务维持原立即禁用逻辑
      if (useCompletionConfirmInFlight) {
        setTaskCompletionConfirmBlockInFlight(taskId, true);
        if (isTask2Confirm) {
          logTask2CompletionConfirmPhase({ confirmRequestStarted: true, confirmRequestSucceeded: false });
        } else if (taskId === 'task3') {
          logTask3CompletionConfirmPhase({ confirmRequestStarted: true, confirmRequestSucceeded: false });
        } else if (taskId === 'task4' || taskId === 'task5' || taskId === 'task6') {
          logWorkflowAlignTaskCompletionConfirmPhase(taskId, { confirmRequestStarted: true, confirmRequestSucceeded: false });
        }
        const chatEl = el.problemDetailChatMessages;
        if (chatEl) {
          chatEl.innerHTML = '';
          renderProblemDetailChatFromStorage(chatEl, __appState.problemDetailChatMessages);
          chatEl.scrollTop = chatEl.scrollHeight;
        }
      } else {
        taskCompleteDoneBtn.textContent = '已完成';
        taskCompleteDoneBtn.disabled = true;
        if (notYetBtn) notYetBtn.disabled = true;
      }

      void (async () => {
        const restoreCompletionConfirmAfterFailure = () => {
          if (!useCompletionConfirmInFlight) return;
          setTaskCompletionConfirmBlockInFlight(taskId, false);
          const chatEl2 = el.problemDetailChatMessages;
          if (chatEl2) {
            chatEl2.innerHTML = '';
            renderProblemDetailChatFromStorage(chatEl2, __appState.problemDetailChatMessages);
            chatEl2.scrollTop = chatEl2.scrollHeight;
          }
        };
        try {
          const actionResult = await postProblemCaseTaskAction(caseId, backendTaskId, 'confirm', {
            content: taskCompleteContent,
            timestamp: new Date().toISOString(),
          });
          if (actionResult == null) {
            restoreCompletionConfirmAfterFailure();
            if (isTask2Confirm) {
              logTask2CompletionConfirmPhase({ confirmRequestStarted: false, confirmRequestSucceeded: false, aborted: true });
            } else if (taskId === 'task3') {
              logTask3CompletionConfirmPhase({ confirmRequestStarted: false, confirmRequestSucceeded: false, aborted: true });
            } else if (taskId === 'task4' || taskId === 'task5' || taskId === 'task6') {
              logWorkflowAlignTaskCompletionConfirmPhase(taskId, {
                confirmRequestStarted: false,
                confirmRequestSucceeded: false,
                aborted: true,
              });
            }
            return;
          }
          markTaskCompletionConfirmBlockConfirmed(taskId);
          await refreshProblemDetailBundleFromBackend(caseId, { skipShowNextTaskStartNotification: true });
          // bundle 用服务端聊天覆盖内存后，须再次收口「已完成」确认态并统一聊天键落盘，否则按钮仍高亮且与 rAF 的 showNext 叠加会重复下发下一任务通知（FE-20260325-08）
          markTaskCompletionConfirmBlockConfirmed(taskId);
          const chatElAfterBundle = el.problemDetailChatMessages;
          if (chatElAfterBundle) {
            chatElAfterBundle.innerHTML = '';
            renderProblemDetailChatFromStorage(chatElAfterBundle, __appState.problemDetailChatMessages);
            chatElAfterBundle.scrollTop = chatElAfterBundle.scrollHeight;
          }
          const resolvedItem = resolveProblemItemForTaskNotification() || __appState.currentProblemDetailItem;
          const firstUncompletedTask = resolvedItem ? getFirstUncompletedTask(resolvedItem) : null;
          const rolePermissionAllDoneBlock = __appState.problemDetailChatMessages.findLast((m) => m?.type === 'rolePermissionAllDoneBlock');
          if (isTask2Confirm) {
            logTask2CompletionConfirmPhase({ confirmRequestStarted: false, confirmRequestSucceeded: true });
          } else if (taskId === 'task3') {
            logTask3CompletionConfirmPhase({ confirmRequestStarted: false, confirmRequestSucceeded: true });
          } else if (taskId === 'task4' || taskId === 'task5' || taskId === 'task6') {
            logWorkflowAlignTaskCompletionConfirmPhase(taskId, { confirmRequestStarted: false, confirmRequestSucceeded: true });
          } else {
            console.info('[FE:task-completion-confirm-sync]', {
              taskId,
              taskCompletionConfirmBlockConfirmed: __appState.problemDetailChatMessages.findLast(
                (m) => m?.type === 'taskCompletionConfirmBlock' && m.taskId === taskId,
              )?.confirmed === true,
              rolePermissionAllDoneBlockConfirmed: rolePermissionAllDoneBlock?.confirmed === true,
              rolePermissionAllDoneBlockAllConfirmed: rolePermissionAllDoneBlock?.allConfirmed === true,
              isTaskCompleted: !!(resolvedItem && isTaskCompleted(resolvedItem, taskId)),
              firstUncompletedTaskId: firstUncompletedTask?.id || null,
            });
          }
          if (taskId === 'task5') logTask5TaskDoneProgressDebug('after-done-online');
          renderProblemDetailHistory();
          updateProblemDetailChatHeaderLabel();
          requestAnimationFrame(() => {
            if (taskId === 'task2') {
              showTaskStartNotificationIfNeeded('task3', true, TASK_START_NOTIFY_AFTER_PREV_COMPLETED);
            } else if (taskId === 'task7') {
              showTaskStartNotificationIfNeeded('task8', true, TASK_START_NOTIFY_AFTER_PREV_COMPLETED);
            } else if (taskId === 'task9') {
              showTaskStartNotificationIfNeeded('task12', true, TASK_START_NOTIFY_AFTER_PREV_COMPLETED);
            } else {
              showNextTaskStartNotification();
            }
          });
        } catch (err) {
          console.warn('[problem-detail] confirm task failed:', err);
          restoreCompletionConfirmAfterFailure();
          if (isTask2Confirm) {
            logTask2CompletionConfirmPhase({
              confirmRequestStarted: false,
              confirmRequestSucceeded: false,
              error: err?.message || String(err),
            });
            showError(`商业画布任务确认失败：${err?.message || String(err)}`);
          } else if (taskId === 'task3') {
            logTask3CompletionConfirmPhase({
              confirmRequestStarted: false,
              confirmRequestSucceeded: false,
              error: err?.message || String(err),
            });
            showError(`需求逻辑构建任务确认失败：${err?.message || String(err)}`);
          } else if (taskId === 'task4' || taskId === 'task5' || taskId === 'task6') {
            logWorkflowAlignTaskCompletionConfirmPhase(taskId, {
              confirmRequestStarted: false,
              confirmRequestSucceeded: false,
              error: err?.message || String(err),
            });
            const wfNames = { task4: '价值流图', task5: 'IT 现状标注', task6: '痛点标注' };
            showError(`${wfNames[taskId] || '工作流对齐'}任务确认失败：${err?.message || String(err)}`);
          }
        }
      })();
      return;
    }

    // 本地模式：保留旧的前端状态推进逻辑（用于非在线开发/回归）
    const alreadyCompleted = Array.isArray(__appState.problemDetailChatMessages) && __appState.problemDetailChatMessages.some((m) => m.type === 'taskCompleteBlock' && m.taskId === taskId);
    if (!alreadyCompleted) {
      let taskCompleteContent = '用户确认任务完成';
      if (taskId === 'task7') taskCompleteContent = '用户确认端到端事务流构建';
      else if (taskId === 'task8') taskCompleteContent = '用户确认 IT设计补齐';
      else if (taskId === 'task9') taskCompleteContent = '用户确认对象状态机构建';
      pushAndSaveProblemDetailChat({ type: 'taskCompleteBlock', taskId, content: taskCompleteContent, timestamp: getTimeStr() });
      const createdAt = item?.createdAt;
      if (createdAt) advanceProblemStateOnTaskComplete(createdAt, taskId);
    }
    if (taskId === 'task5') logTask5TaskDoneProgressDebug('after-done-local');
    taskCompleteDoneBtn.textContent = '已完成';
    taskCompleteDoneBtn.disabled = true;
    const notYetBtn = taskCompleteDoneBtn.closest('.problem-detail-chat-task-completion-actions')?.querySelector('.btn-task-complete-not-yet');
    if (notYetBtn) notYetBtn.disabled = true;
    const container = el.problemDetailChatMessages;
    if (container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    }
    renderProblemDetailHistory();
    updateProblemDetailChatHeaderLabel();
    requestAnimationFrame(() => {
      if (taskId === 'task2') {
        showTaskStartNotificationIfNeeded('task3', true, TASK_START_NOTIFY_AFTER_PREV_COMPLETED);
      } else if (taskId === 'task7') {
        showTaskStartNotificationIfNeeded('task8', true, TASK_START_NOTIFY_AFTER_PREV_COMPLETED);
      } else if (taskId === 'task9') {
        showTaskStartNotificationIfNeeded('task12', true, TASK_START_NOTIFY_AFTER_PREV_COMPLETED);
      } else {
        showNextTaskStartNotification();
      }
    });
    return;
  }
  const taskCompleteNotYetBtn = e.target.closest('.btn-task-complete-not-yet');
  if (
    taskCompleteNotYetBtn &&
    !taskCompleteNotYetBtn.disabled &&
    !taskCompleteNotYetBtn.classList.contains('btn-skip-role-permission-audit')
  ) {
    const actions = taskCompleteNotYetBtn.closest('.problem-detail-chat-task-completion-actions');
    const doneBtn = actions?.querySelector('.btn-task-complete-done');
    const taskId = doneBtn?.getAttribute('data-task-id') || '';
    const taskName = doneBtn?.getAttribute('data-task-name') || taskId;
    const modificationPrompt = buildTaskModificationRequestMessage(taskName);

    const caseId = getCurrentProblemCaseIdForBackend();
    const backendTaskId = mapProblemTaskIdToBackendTaskId(taskId);

    // 在线模式：revise 后刷新聊天，再追加系统引导消息并落库（后端 revise 不写聊天正文）
    if (isOnlineMode() && caseId && backendTaskId) {
      taskCompleteNotYetBtn.textContent = '已反馈';
      taskCompleteNotYetBtn.disabled = true;
      if (doneBtn) doneBtn.disabled = true;

      void (async () => {
        try {
          await postProblemCaseTaskAction(caseId, backendTaskId, 'revise', {
            content: modificationPrompt,
            timestamp: new Date().toISOString(),
          });
          await refreshProblemDetailBundleFromBackend(caseId);
          if (taskId === 'task4' || taskId === 'task7') markTaskCompletionConfirmUserChoseModify(taskId);
          problemDetailWaitingForFeedback = {
            taskId,
            createdAt: getProblemDetailChatStorageKey(__appState.currentProblemDetailItem),
            type: 'modification',
            sourceMsgIndex: -1,
          };
          if (__appState.currentProblemDetailItem && getProblemDetailChatStorageKey(__appState.currentProblemDetailItem)) {
            pushAndSaveProblemDetailChat({ role: 'system', content: modificationPrompt, timestamp: getTimeStr() });
            const containerAfter = el.problemDetailChatMessages;
            if (containerAfter) {
              containerAfter.innerHTML = '';
              renderProblemDetailChatFromStorage(containerAfter, __appState.problemDetailChatMessages);
              containerAfter.scrollTop = containerAfter.scrollHeight;
            }
          }
          renderProblemDetailHistory();
          updateProblemDetailChatHeaderLabel();
        } catch (err) {
          console.warn('[problem-detail] revise task failed:', err);
        }
      })();
      return;
    }

    // 本地模式：保留旧的“写入反馈系统消息 + disable”逻辑
    if (taskId === 'task4' || taskId === 'task7') markTaskCompletionConfirmUserChoseModify(taskId);
    const container = el.problemDetailChatMessages;
    pushAndSaveProblemDetailChat({ role: 'system', content: modificationPrompt, timestamp: getTimeStr() });
    if ((taskId === 'task4' || taskId === 'task7') && container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    } else {
      const tipBlock = document.createElement('div');
      tipBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
      tipBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">${escapeHtml(modificationPrompt)}</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
      container?.appendChild(tipBlock);
      if (container) container.scrollTop = container.scrollHeight;
    }
    problemDetailWaitingForFeedback = {
      taskId,
      createdAt: getProblemDetailChatStorageKey(__appState.currentProblemDetailItem),
      type: 'modification',
      sourceMsgIndex: -1,
    };
    taskCompleteNotYetBtn.textContent = '已反馈';
    taskCompleteNotYetBtn.disabled = true;
    if (doneBtn) doneBtn.disabled = true;
    return;
  }
  const deleteBtn = e.target.closest('.btn-delete-chat-msg');
  if (deleteBtn) {
    const msgBlock = deleteBtn.closest('[data-msg-index]');
    if (msgBlock) {
      const idx = parseInt(msgBlock.dataset.msgIndex, 10);
      if (!isNaN(idx) && idx >= 0 && idx < __appState.problemDetailChatMessages.length) {
        const msg = __appState.problemDetailChatMessages[idx];
        const isGlobalItGapMsg =
          msg?.type === 'globalItGapStartBlock' ||
          msg?.type === 'globalItGapPhasePlanBlock' ||
          msg?.type === 'globalItGapAnalysisCard' ||
          msg?.type === 'globalItGapAnalysisLog' ||
          msg?.type === 'task8LlmQueryBlock' ||
          msg?.type === 'globalItGapCompressionBlock' ||
          msg?.type === 'itDesignSupplementSessionsBlock' ||
          msg?.type === 'itDesignBpmDrawSessionsBlock' ||
          msg?.type === 'itDesignSupplementAllDoneConfirmBlock';
        if (isGlobalItGapMsg && __appState.currentProblemDetailItem?.createdAt) {
          __appState.problemDetailChatMessages = __appState.problemDetailChatMessages.filter((m) => {
            const t = m.type;
            return (
              t !== 'globalItGapStartBlock' &&
              t !== 'globalItGapPhasePlanBlock' &&
              t !== 'globalItGapAnalysisCard' &&
              t !== 'globalItGapAnalysisLog' &&
              t !== 'task8LlmQueryBlock' &&
              t !== 'globalItGapCompressionBlock' &&
              t !== 'itDesignSupplementSessionsBlock' &&
              t !== 'itDesignBpmDrawSessionsBlock' &&
              t !== 'itDesignSupplementAllDoneConfirmBlock' &&
              t !== 'roleTaskCenterDesignIntentBlock' &&
              t !== 'localItGapStartBlock' &&
              t !== 'localItGapSessionsBlock' &&
              t !== 'localItGapInputBlock' &&
              t !== 'localItGapOutputBlock' &&
              t !== 'localItGapAnalysisCard' &&
              t !== 'localItGapAnalysisLog' &&
              t !== 'localItGapAllDoneConfirmBlock' &&
              t !== 'localItGapTaskCompleteConfirmBlock' &&
              t !== 'rolePermissionSessionsBlock' &&
              t !== 'rolePermissionCard' &&
              t !== 'rolePermissionAnalysisCard'
            );
          });
          saveProblemDetailChat(__appState.currentProblemDetailItem.createdAt, __appState.problemDetailChatMessages);
          clearDigitalProblemGlobalItGapAnalysis(__appState.currentProblemDetailItem.createdAt);
          const list = getDigitalProblems();
          const updated = list.find((it) => it.createdAt === __appState.currentProblemDetailItem.createdAt);
          if (updated) __appState.currentProblemDetailItem = updated;
          const container = el.problemDetailChatMessages;
          container.innerHTML = '';
          renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
          container.scrollTop = container.scrollHeight;
          renderProblemDetailContent();
          renderProblemDetailHistory();
          return;
        }
        const isPainPointStartBlock = msg?.type === 'painPointStartBlock';
        const isPainPointDoneMsg = msg?.role === 'system' && msg?.content === '痛点标注完成';
        const shouldRollbackPainPoint = (isPainPointStartBlock || isPainPointDoneMsg) && __appState.currentProblemDetailItem?.createdAt;
        if (shouldRollbackPainPoint) {
          rollbackValueStreamPainPoint(__appState.currentProblemDetailItem.createdAt);
          __appState.currentProblemDetailItem = {
            ...__appState.currentProblemDetailItem,
            valueStream: (() => {
              const vs = __appState.currentProblemDetailItem.valueStream;
              if (!vs || vs.raw) return vs;
              const rawStages = vs.stages ?? vs.phases ?? vs.nodes ?? [];
              if (!Array.isArray(rawStages)) return vs;
              const stages = rawStages.map((s) => {
                if (!s || typeof s !== 'object') return s;
                const rawSteps = s.steps ?? s.tasks ?? s.phases ?? s.items ?? [];
                const steps = rawSteps.map((st) => {
                  if (typeof st !== 'object' || st == null) return st;
                  const { painPoint, pain_point, ...rest } = st;
                  return rest;
                });
                return { ...s, steps };
              });
              return { ...vs, stages };
            })(),
            workflowAlignCompletedStages: (__appState.currentProblemDetailItem.workflowAlignCompletedStages || []).filter((x) => x !== 2).sort((a, b) => a - b),
          };
          renderProblemDetailContent();
        }
        let spliceIdx = idx;
        if (isPainPointStartBlock && shouldRollbackPainPoint) {
          let lastDoneIdx = -1;
          for (let i = __appState.problemDetailChatMessages.length - 1; i >= 0; i--) {
            const m = __appState.problemDetailChatMessages[i];
            if (m?.role === 'system' && m?.content === '痛点标注完成') {
              lastDoneIdx = i;
              break;
            }
          }
          if (lastDoneIdx >= 0) __appState.problemDetailChatMessages.splice(lastDoneIdx, 1);
          spliceIdx = lastDoneIdx >= 0 && lastDoneIdx < idx ? idx - 1 : idx;
        }
        __appState.problemDetailChatMessages.splice(spliceIdx, 1);
        saveProblemDetailChat(__appState.currentProblemDetailItem?.createdAt, __appState.problemDetailChatMessages);
        const container = el.problemDetailChatMessages;
        container.innerHTML = '';
        renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
        container.scrollTop = container.scrollHeight;
        if (msg?.type === 'rolePermissionCard') {
          renderProblemDetailContent();
        }
      }
    }
    return;
  }
  const confirmTaskStartBtn = e.target.closest('.btn-confirm-task-start');
  if (confirmTaskStartBtn && !confirmTaskStartBtn.disabled) {
    const taskId = confirmTaskStartBtn.getAttribute('data-task-id');
    const item = __appState.currentProblemDetailItem;
    if (taskId === 'task8') {
      logTask8ItDesignStart('task-notify-click', {
        taskId,
        online: typeof isOnlineMode === 'function' ? isOnlineMode() : undefined,
        itemId: item?.id != null ? String(item.id).slice(0, 24) : '',
        itemCreatedAt: item?.createdAt != null ? String(item.createdAt).slice(0, 24) : '',
        chatKey:
          item && typeof getProblemDetailChatStorageKey === 'function'
            ? String(getProblemDetailChatStorageKey(item) || '').slice(0, 40)
            : '',
      });
    }
    const continueAfterTaskStartConfirmed = () => {
    // 在线异步返回后须用最新 __appState.currentProblemDetailItem（含 bundle/合并态），勿沿用点击瞬间闭包里的引用，避免 valueStream / major 滞后导致 task7 分支整段跳过
    const item = __appState.currentProblemDetailItem;
    // 与 pushItDesignSupplementSessionsBlockAndRender / saveProblemDetailChat 一致：在线案可仅有 id 无 createdAt，勿用 createdAt 作唯一门禁（否则 task8 确认启动后不会下发 Session 计划）
    const continueChatKey =
      item && typeof getProblemDetailChatStorageKey === 'function' ? String(getProblemDetailChatStorageKey(item) || '').trim() : '';
    if (taskId === 'task8') {
      logTask8ItDesignStart('continue-enter', {
        taskId,
        hasItem: !!item,
        continueChatKey: continueChatKey || '(empty)',
      });
    }
    if (!item || !continueChatKey) {
      if (taskId === 'task8') {
        logTask8ItDesignStart('continue-abort', {
          reason: !item ? 'no-item' : 'empty-continueChatKey',
        });
      }
      return;
    }
    if (taskId === 'task1') {
      pushTask1PreliminaryLlmQueryFromCaseIfNeeded(item, 'task1StartConfirmed');
      pushAndSaveProblemDetailChat({ role: 'system', content: '请提供企业基本工商信息', timestamp: getTimeStr() });
      const chatContainer = el.problemDetailChatMessages;
      if (chatContainer) {
        chatContainer.innerHTML = '';
        renderProblemDetailChatFromStorage(chatContainer, __appState.problemDetailChatMessages);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
      renderProblemDetailHistory();
      renderProblemDetailContent();
      updateProblemDetailChatHeaderLabel();
      return;
    }
    // task2：商业画布加载任务，确认开始后向时间线推送客户基本信息 json + 客户初步需求 json
    if (taskId === 'task2' && item) {
      const hasBasicInfoCtx = __appState.problemDetailChatMessages.some(
        (m) => m.type === 'taskContextBlock' && m.taskId === 'task2' && m.contextLabel === '客户基本信息 json'
      );
      const hasPrelimCtx = __appState.problemDetailChatMessages.some(
        (m) => m.type === 'taskContextBlock' && m.taskId === 'task2' && m.contextLabel === '客户初步需求 json'
      );
      if (!hasBasicInfoCtx) {
        pushAndSaveProblemDetailChat({
          type: 'taskContextBlock',
          taskId: 'task2',
          contextLabel: '客户基本信息 json',
          contextJson: item.basicInfo || {},
          timestamp: getTimeStr(),
        });
      }
      const preliminaryReqJson = typeof window.buildPreliminarySummaryJson === 'function'
        ? window.buildPreliminarySummaryJson(item)
        : {};
      if (!hasPrelimCtx) {
        pushAndSaveProblemDetailChat({
          type: 'taskContextBlock',
          taskId: 'task2',
          contextLabel: '客户初步需求 json',
          contextJson: preliminaryReqJson,
          timestamp: getTimeStr(),
        });
      }
    }
    // task4：绘制价值流任务，确认后向时间线推送三条上下文块（客户基本信息 / BMC / 需求逻辑）
    if (taskId === 'task4' && item) {
      const hasBasicInfoCtx = __appState.problemDetailChatMessages.some(
        (m) => m.type === 'taskContextBlock' && m.taskId === 'task4' && m.contextLabel === '客户基本信息 json'
      );
      const hasBmcCtx = __appState.problemDetailChatMessages.some(
        (m) => m.type === 'taskContextBlock' && m.taskId === 'task4' && m.contextLabel === '商业模式画布 BMC json'
      );
      const hasReqCtx = __appState.problemDetailChatMessages.some(
        (m) => m.type === 'taskContextBlock' && m.taskId === 'task4' && m.contextLabel === '需求逻辑 json'
      );
      if (!hasBasicInfoCtx) {
        pushAndSaveProblemDetailChat({
          type: 'taskContextBlock',
          taskId: 'task4',
          contextLabel: '客户基本信息 json',
          contextJson: item.basicInfo || {},
          timestamp: getTimeStr(),
        });
      }
      if (!hasBmcCtx) {
        pushAndSaveProblemDetailChat({
          type: 'taskContextBlock',
          taskId: 'task4',
          contextLabel: '商业模式画布 BMC json',
          contextJson: item.bmc || {},
          timestamp: getTimeStr(),
        });
      }
      if (!hasReqCtx) {
        pushAndSaveProblemDetailChat({
          type: 'taskContextBlock',
          taskId: 'task4',
          contextLabel: '需求逻辑 json',
          contextJson: item.requirementLogic != null ? item.requirementLogic : {},
          timestamp: getTimeStr(),
        });
      }
      const hasVsDrawPlan = __appState.problemDetailChatMessages.some((m) => m.type === 'valueStreamDrawSessionsBlock');
      if (!hasVsDrawPlan) {
        const vsSessions = getDefaultValueStreamDrawSessions();
        const caseKeyCtx = getProblemDetailChatStorageKey(item);
        if (caseKeyCtx && typeof updateDigitalProblemValueStreamDrawSessions === 'function') {
          updateDigitalProblemValueStreamDrawSessions(caseKeyCtx, vsSessions);
        }
        __appState.currentProblemDetailItem = { ...__appState.currentProblemDetailItem, valueStreamDrawSessions: vsSessions };
        pushAndSaveProblemDetailChat({
          type: 'valueStreamDrawSessionsBlock',
          taskId: 'task4',
          timestamp: getTimeStr(),
        });
      }
    }
    const contextJson = buildTaskContextJson(taskId, item);
    if (taskId === 'task5') {
      if (typeof window.setupItStatusSessionPlanAfterTaskStart === 'function') {
        window.setupItStatusSessionPlanAfterTaskStart(item, __appState.problemDetailChatMessages);
      }
    } else if (taskId === 'task6') {
      const valueStream = item?.valueStream;
      if (valueStream && !valueStream.raw) {
        const recent = __appState.problemDetailChatMessages.slice(-4);
        const hasVsCtx = recent.some((m) => m?.type === 'taskContextBlock' && m?.taskId === 'task6' && m?.contextLabel === '价值流痛点标注的 json');
        const hasReqCtx = recent.some((m) => m?.type === 'taskContextBlock' && m?.taskId === 'task6' && m?.contextLabel === '客户需求逻辑json');
        if (!hasVsCtx) pushAndSaveProblemDetailChat({ type: 'taskContextBlock', taskId: 'task6', contextLabel: '价值流痛点标注的 json', contextJson: valueStream, timestamp: getTimeStr() });
        if (!hasReqCtx) pushAndSaveProblemDetailChat({ type: 'taskContextBlock', taskId: 'task6', contextLabel: '客户需求逻辑json', contextJson: item?.requirementLogic != null ? item.requirementLogic : {}, timestamp: getTimeStr() });
        const sessions = generatePainPointSessions(valueStream);
        if (typeof updateDigitalProblemPainPointSessions === 'function') updateDigitalProblemPainPointSessions(item.createdAt, sessions);
        __appState.currentProblemDetailItem = { ...item, painPointSessions: sessions };
        pushAndSaveProblemDetailChat({ type: 'painPointSessionsBlock', taskId: 'task6', sessions, timestamp: getTimeStr() });
      } else {
        runPainPointAnnotation(__appState.currentProblemDetailItem, false);
      }
    } else if (taskId !== 'task2' && taskId !== 'task8' && taskId !== 'task9' && taskId !== 'task12' && taskId !== 'task4' && taskId !== 'task5') {
      // 去重：若最近几条中已有同 taskId 的 taskContextBlock（如双击导致），则不再推送，避免时间线出现两条「上下文」；task2 已在上方单独推送两条上下文
      const recent = __appState.problemDetailChatMessages.slice(-4);
      const hasRecentContext = recent.some((m) => m?.type === 'taskContextBlock' && m?.taskId === taskId);
      if (!hasRecentContext) {
        pushAndSaveProblemDetailChat({ type: 'taskContextBlock', taskId, contextJson, timestamp: getTimeStr() });
      }
    }
    const chatContainer = el.problemDetailChatMessages;
    if (chatContainer) {
      chatContainer.innerHTML = '';
      renderProblemDetailChatFromStorage(chatContainer, __appState.problemDetailChatMessages);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    renderProblemDetailHistory();
    if (taskId === 'task2') {
      runBmcGeneration();
      return;
    }
    if (taskId === 'task3') {
      runRequirementLogicConstruction();
      return;
    }
    if (taskId === 'task4') {
      return;
    }
    if (taskId === 'task5') {
      renderProblemDetailContent();
      requestAnimationFrame(() => {
        if (typeof focusWorkspaceOnCurrentTask === 'function') focusWorkspaceOnCurrentTask('task5');
      });
      updateProblemDetailChatHeaderLabel();
      return;
    }
    if (taskId === 'task6') {
      return;
    }
    if (taskId === 'task7') {
      const valueStream = item?.valueStream;
      if (valueStream && !valueStream.raw && item?.createdAt) {
        if (typeof updateDigitalProblemE2eFlowLandscape === 'function') {
          updateDigitalProblemE2eFlowLandscape(item.createdAt, undefined);
        }
        if (typeof updateDigitalProblemE2eTransactionFlow === 'function') {
          updateDigitalProblemE2eTransactionFlow(item.createdAt, undefined);
        }
        if (typeof updateDigitalProblemE2eRequirementScenarioSupplement === 'function') {
          updateDigitalProblemE2eRequirementScenarioSupplement(item.createdAt, undefined);
        }
        updateDigitalProblemMajorStage(item.createdAt, 2);
        // 不在此处标记 task7 完成；下发「生成事务流 Session 计划」（按价值流阶段），用户仅可点「自动顺序执行」后分阶段 LLM，合并写入 e2eTransactionFlowJson 并维护 e2eFlowJsonBlock，再经 JSON 卡确认后进入 task7 完工确认
        __appState.currentProblemDetailItem = {
          ...item,
          currentMajorStage: 2,
          e2eFlowLandscapeJson: undefined,
          e2eTransactionFlowJson: undefined,
          e2eRequirementScenarioSupplementJson: undefined,
        };
        problemDetailViewingMajorStage = 2;
        itGapViewingSubstep = 0;
        updateProblemDetailProgressStages(2, problemDetailViewingMajorStage);
        renderProblemDetailContent();
        requestAnimationFrame(() => focusWorkspaceOnCurrentTask('task7'));
        pushAndSaveProblemDetailChat({ role: 'user', content: '确认', timestamp: getTimeStr() });
        const txSessions = generateE2eTransactionFlowSessionsFromValueStream(valueStream);
        if (!txSessions.length) {
          pushAndSaveProblemDetailChat({
            role: 'system',
            content: '当前价值流中无阶段数据，无法生成事务流 Session 计划。请先完善价值流阶段后再开始本任务。',
            timestamp: getTimeStr(),
          });
        } else {
          pushAndSaveProblemDetailChat({
            type: 'e2eTransactionFlowSessionsBlock',
            taskId: 'task7',
            sessions: txSessions,
            timestamp: getTimeStr(),
            confirmed: false,
          });
        }
        const container = el.problemDetailChatMessages;
        if (container) {
          container.innerHTML = '';
          renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
          container.scrollTop = container.scrollHeight;
        }
        renderProblemDetailHistory();
      }
      return;
    }
    if (taskId === 'task8') {
      logTask8ItDesignStart('continue-schedule-push', { via: 'requestAnimationFrame' });
      requestAnimationFrame(() => {
        logTask8ItDesignStart('rAF-run-pushItDesignSupplementSessionsBlockAndRender', {});
        pushItDesignSupplementSessionsBlockAndRender();
      });
      return;
    }
    if (taskId === 'task9') {
      const valueStream = resolveValueStreamForItGap(item);
      const caseReady = !!(item && (item.createdAt || item.id));
      if (caseReady) {
        const container = el.problemDetailChatMessages;
        if (container) {
          container.innerHTML = '';
          renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
          container.scrollTop = container.scrollHeight;
        }
        renderProblemDetailHistory();
        renderProblemDetailContent();
        void runTask9ObjectStateMachineAfterStartConfirmed(item);
        if (valueStream && !valueStream.raw) {
          requestAnimationFrame(() => focusWorkspaceOnCurrentTask('task9'));
        }
        updateProblemDetailChatHeaderLabel();
      }
      return;
    }
    if (taskId === 'task12') {
      if (item?.createdAt) {
        const timestamp = getTimeStr();
        const globalItGap = item.globalItGapAnalysisJson ?? null;
        const localItGap =
          item.objectStateMachineJson != null
            ? item.objectStateMachineJson
            : item.roleTaskCenterPortalDesignJson != null
              ? item.roleTaskCenterPortalDesignJson
              : item.localItGapSessions ?? null;
        const roleContent = typeof getLatestConfirmedRolePermissionContent === 'function' ? getLatestConfirmedRolePermissionContent(item) : null;
        const rolePermissionJson = (roleContent && typeof parseRolePermissionModel === 'function') ? parseRolePermissionModel(typeof roleContent === 'string' ? roleContent : JSON.stringify(roleContent)) : (Array.isArray(roleContent) ? roleContent : null);
        const coreBusinessObjectJson = item.coreBusinessObjectSessions ?? null;
        pushAndSaveProblemDetailChat({ type: 'globalArchitectureContextBlock', taskId: 'task12', contextLabel: 'IT设计补齐 json', contextJson: globalItGap, timestamp });
        pushAndSaveProblemDetailChat({ type: 'globalArchitectureContextBlock', taskId: 'task12', contextLabel: '对象状态机构建 json', contextJson: Array.isArray(localItGap) ? localItGap : null, timestamp });
        pushAndSaveProblemDetailChat({ type: 'globalArchitectureContextBlock', taskId: 'task12', contextLabel: '角色与权限模型推演 json', contextJson: Array.isArray(rolePermissionJson) ? rolePermissionJson : null, timestamp });
        pushAndSaveProblemDetailChat({ type: 'globalArchitectureContextBlock', taskId: 'task12', contextLabel: '核心业务对象推演 json', contextJson: Array.isArray(coreBusinessObjectJson) ? coreBusinessObjectJson : null, timestamp });
        itStrategyPlanViewingSubstep = 2;
        problemDetailViewingMajorStage = 3;
        updateProblemDetailProgressStages(3, problemDetailViewingMajorStage);
        const chatContainer = el.problemDetailChatMessages;
        if (chatContainer) {
          chatContainer.innerHTML = '';
          renderProblemDetailChatFromStorage(chatContainer, __appState.problemDetailChatMessages);
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        if (typeof renderProblemDetailHistory === 'function') renderProblemDetailHistory();
        renderProblemDetailContent();
        updateProblemDetailChatHeaderLabel();
      }
      return;
    }
    if (['task13', 'task14', 'task15'].includes(taskId)) {
      if (item?.createdAt) {
        const substepMap = { task13: 3, task14: 4, task15: 5 };
        itStrategyPlanViewingSubstep = substepMap[taskId] ?? 0;
        problemDetailViewingMajorStage = 3;
        updateProblemDetailProgressStages(3, problemDetailViewingMajorStage);
        renderProblemDetailContent();
      }
      return;
    }
    updateProblemDetailChatHeaderLabel();
    };
    const caseId = getCurrentProblemCaseIdForBackend();
    const backendTaskId = mapProblemTaskIdToBackendTaskId(taskId);
    let idx = findLastTaskStartNotificationIndex(__appState.problemDetailChatMessages, taskId);
    if (isOnlineMode() && caseId && backendTaskId) {
      if (taskId === 'task8') {
        logTask8ItDesignStart('online-start-request', { caseId: String(caseId).slice(0, 24), backendTaskId });
      }
      confirmTaskStartBtn.disabled = true;
      confirmTaskStartBtn.textContent = '已确认';
      void (async () => {
        try {
          const bundle = await postProblemCaseTaskAction(caseId, backendTaskId, 'start', {
            timestamp: new Date().toISOString(),
          });
          if (String(getCurrentProblemCaseIdForBackend() || '') !== String(caseId)) {
            if (taskId === 'task8') {
              logTask8ItDesignStart('online-start-abort', { reason: 'caseId-changed-after-request', caseId: String(caseId).slice(0, 24) });
            }
            return;
          }
          if (idx >= 0) {
            __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true };
          }
          if (bundle && Array.isArray(bundle.tasks)) {
            currentProblemDetailTaskSummaries = bundle.tasks;
          }
          if (taskId === 'task8') {
            logTask8ItDesignStart('online-start-ok-calling-continue', {});
          }
          // 勿在 continue 之前 render：item 尚未经各分支更新（如 task7 写 major=2），会先误绘初步需求（FE-20260328-30）
          continueAfterTaskStartConfirmed();
          renderProblemDetailContent();
          if (el.problemDetailHistoryPanel && !el.problemDetailHistoryPanel.classList.contains('hidden')) {
            renderProblemDetailHistory();
          }
        } catch (err) {
          confirmTaskStartBtn.disabled = false;
          confirmTaskStartBtn.textContent = '确认';
          if (taskId === 'task8') {
            logTask8ItDesignStart('online-start-error', { message: err && err.message ? String(err.message) : String(err) });
          }
          console.warn('[problem-detail] start task failed:', err);
        }
      })();
      return;
    }
    if (idx >= 0) {
      __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true };
      const skStart =
        item && typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
      if (skStart) saveProblemDetailChat(skStart, __appState.problemDetailChatMessages);
    }
    confirmTaskStartBtn.disabled = true;
    confirmTaskStartBtn.textContent = '已确认';
    if (taskId === 'task8') {
      logTask8ItDesignStart('local-start-calling-continue', {});
    }
    continueAfterTaskStartConfirmed();
    return;
  }
  const rpHeader = e.target.closest(
    '.problem-detail-card-role-permission .problem-detail-card-header'
  );
  if (rpHeader) {
    const card = rpHeader.closest('.problem-detail-card-role-permission');
    const body = card?.querySelector('.problem-detail-card-body');
    if (body) {
      const willShow = body.hidden;
      body.hidden = !willShow;
      rpHeader.setAttribute('aria-expanded', String(willShow));
      rpHeader.classList.toggle('problem-detail-card-header-collapsed', !willShow);
    }
    return;
  }
  const confirmRolePermissionBtn = e.target.closest('.btn-confirm-role-permission');
  if (confirmRolePermissionBtn && !confirmRolePermissionBtn.disabled) {
    confirmRolePermissionBtn.disabled = true;
    confirmRolePermissionBtn.textContent = '已确认';
    const item = __appState.currentProblemDetailItem;
    if (item?.createdAt) {
      const idx = __appState.problemDetailChatMessages
        .slice()
        .reverse()
        .findIndex((m) => m.type === 'rolePermissionCard' && !m.confirmed);
      if (idx >= 0) {
        const realIdx = __appState.problemDetailChatMessages.length - 1 - idx;
        const msg = __appState.problemDetailChatMessages[realIdx];
        __appState.problemDetailChatMessages[realIdx] = {
          ...msg,
          confirmed: true,
        };
        saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
        // 时间线对应内容块标注为「确认」
        if (typeof renderProblemDetailHistory === 'function') renderProblemDetailHistory();
        const currentMajorStage = item.currentMajorStage ?? 0;
        const targetMajorStage = 3;
        if (currentMajorStage < targetMajorStage) {
          __appState.currentProblemDetailItem = { ...item, currentMajorStage: targetMajorStage };
          updateDigitalProblemMajorStage(item.createdAt, targetMajorStage);
        }
        problemDetailViewingMajorStage = targetMajorStage;
        itStrategyPlanViewingSubstep = 0;
        persistItStrategyPlanSubstepForCaseKey(getProblemFollowCaseKey(item), 0);
        updateProblemDetailProgressStages(Math.max(currentMajorStage, targetMajorStage), problemDetailViewingMajorStage);
        // 将大模型返回的 JSON 按环节提取并展示到对应环节名称的内容卡片上（本次渲染强制使用刚确认的内容）
        lastConfirmedRolePermissionContentForRender = typeof msg.content === 'string' ? msg.content : null;
        if (feRolePermissionLog()) console.log('[角色与权限] 确认按钮: 已设置 lastConfirmedRolePermissionContentForRender, content类型=', typeof msg.content, '长度=', typeof msg.content === 'string' ? msg.content.length : 0, '前200字=', typeof msg.content === 'string' ? msg.content.slice(0, 200) : '');
        renderProblemDetailContent();
        requestAnimationFrame(() => {
          const wsScroll = document.querySelector('.problem-detail-workspace-scroll');
          if (wsScroll) wsScroll.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          if (typeof focusWorkspaceOnCurrentTask === 'function') focusWorkspaceOnCurrentTask('task12');
          if (typeof showNextTaskStartNotification === 'function') showNextTaskStartNotification();
        });
      }
    }
    return;
  }
  const startItStatusBtn = e.target.closest('.btn-confirm-start-it-status');
  if (startItStatusBtn && !startItStatusBtn.disabled) {
    startItStatusBtn.disabled = true;
    startItStatusBtn.textContent = '已确认';
    let idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'itStatusStartBlock');
    if (idx >= 0) {
      __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true };
      saveProblemDetailChat(__appState.currentProblemDetailItem?.createdAt, __appState.problemDetailChatMessages);
    }
    // 与 taskStartNotification 确认后一致：下发 Session 计划 +「自动顺序执行」，不再整图单次标注
    if (typeof window.setupItStatusSessionPlanAfterTaskStart === 'function') {
      window.setupItStatusSessionPlanAfterTaskStart(__appState.currentProblemDetailItem, __appState.problemDetailChatMessages);
    }
    const containerItStart = el.problemDetailChatMessages;
    if (containerItStart) {
      containerItStart.innerHTML = '';
      renderProblemDetailChatFromStorage(containerItStart, __appState.problemDetailChatMessages);
      containerItStart.scrollTop = containerItStart.scrollHeight;
    }
    renderProblemDetailHistory();
    renderProblemDetailContent();
    requestAnimationFrame(() => {
      if (typeof focusWorkspaceOnCurrentTask === 'function') focusWorkspaceOnCurrentTask('task5');
    });
    updateProblemDetailChatHeaderLabel();
    return;
  }
  const startPainPointBtn = e.target.closest('.btn-confirm-start-pain-point');
  if (startPainPointBtn && !startPainPointBtn.disabled) {
    startPainPointBtn.disabled = true;
    startPainPointBtn.textContent = '已确认';
    let idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'painPointStartBlock');
    if (idx >= 0) {
      __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true };
      saveProblemDetailChat(__appState.currentProblemDetailItem?.createdAt, __appState.problemDetailChatMessages);
    }
    const item = __appState.currentProblemDetailItem;
    const valueStream = item?.valueStream;
    if (valueStream && !valueStream.raw) {
      pushAndSaveProblemDetailChat({ type: 'taskContextBlock', taskId: 'task6', contextLabel: '价值流痛点标注的 json', contextJson: valueStream, timestamp: getTimeStr() });
      pushAndSaveProblemDetailChat({ type: 'taskContextBlock', taskId: 'task6', contextLabel: '客户需求逻辑json', contextJson: item?.requirementLogic != null ? item.requirementLogic : {}, timestamp: getTimeStr() });
      const sessions = generatePainPointSessions(valueStream);
      if (typeof updateDigitalProblemPainPointSessions === 'function') updateDigitalProblemPainPointSessions(item.createdAt, sessions);
      __appState.currentProblemDetailItem = { ...item, painPointSessions: sessions };
      pushAndSaveProblemDetailChat({ type: 'painPointSessionsBlock', taskId: 'task6', sessions, timestamp: getTimeStr() });
      const container = el.problemDetailChatMessages;
      if (container) {
        container.innerHTML = '';
        renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
        container.scrollTop = container.scrollHeight;
      }
      renderProblemDetailHistory();
    } else {
      runPainPointAnnotation(__appState.currentProblemDetailItem);
    }
    return;
  }
  const confirmE2eBusinessFlowIntentBtn = e.target.closest('.btn-confirm-e2e-business-flow-intent');
  if (confirmE2eBusinessFlowIntentBtn && !confirmE2eBusinessFlowIntentBtn.disabled) {
    const item = __appState.currentProblemDetailItem;
    const valueStream = item?.valueStream;
    if (!valueStream || valueStream.raw) return;
    let idxIntent = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'e2eBusinessFlowIntentBlock');
    if (idxIntent >= 0) {
      __appState.problemDetailChatMessages[idxIntent] = {
        ...__appState.problemDetailChatMessages[idxIntent],
        confirmed: true,
      };
      saveProblemDetailChat(item?.createdAt, __appState.problemDetailChatMessages);
    }
    confirmE2eBusinessFlowIntentBtn.disabled = true;
    confirmE2eBusinessFlowIntentBtn.textContent = '已确认';
    pushAndSaveProblemDetailChat({ role: 'user', content: '确认', timestamp: getTimeStr() });
    const hasPlan = __appState.problemDetailChatMessages.some((m) => m.type === 'e2eTransactionFlowSessionsBlock');
    if (!hasPlan) {
      const txSessions = generateE2eTransactionFlowSessionsFromValueStream(valueStream);
      pushAndSaveProblemDetailChat({
        type: 'e2eTransactionFlowSessionsBlock',
        taskId: 'task7',
        sessions: txSessions,
        timestamp: getTimeStr(),
        confirmed: false,
      });
    }
    const containerLegacy = el.problemDetailChatMessages;
    if (containerLegacy) {
      containerLegacy.innerHTML = '';
      renderProblemDetailChatFromStorage(containerLegacy, __appState.problemDetailChatMessages);
      containerLegacy.scrollTop = containerLegacy.scrollHeight;
    }
    renderProblemDetailHistory();
    return;
  }
  const confirmE2eExtractBtn = e.target.closest('.btn-confirm-e2e-extract');
  if (confirmE2eExtractBtn && !confirmE2eExtractBtn.disabled) {
    const item = __appState.currentProblemDetailItem;
    const valueStream = item?.valueStream;
    if (!valueStream || valueStream.raw) return;
    let idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'e2eFlowExtractStartBlock');
    if (idx >= 0) {
      __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true };
      saveProblemDetailChat(item?.createdAt, __appState.problemDetailChatMessages);
    }
    confirmE2eExtractBtn.disabled = true;
    confirmE2eExtractBtn.textContent = '已确认';
    pushAndSaveProblemDetailChat({ role: 'user', content: '确认', timestamp: getTimeStr() });
    const container = el.problemDetailChatMessages;
    const jsonStr = escapeHtml(JSON.stringify(valueStream, null, 2));
    const dataAttr = String(JSON.stringify(valueStream)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const jsonBlock = document.createElement('div');
    jsonBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-e2e-json-block problem-detail-chat-msg-with-delete';
    jsonBlock.dataset.msgIndex = String(__appState.problemDetailChatMessages.length);
    jsonBlock.innerHTML = `
      <button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button>
      <div class="problem-detail-chat-e2e-json-wrap">
        <div class="problem-detail-chat-e2e-json-header">端到端事务流 JSON 数据</div>
        <pre class="problem-detail-chat-json-pre">${jsonStr}</pre>
        <div class="problem-detail-chat-e2e-json-actions">
          <button type="button" class="btn-confirm-e2e-json btn-confirm-primary" data-json="${dataAttr}">确认</button>
          <button type="button" class="btn-redo-e2e-json">重做</button>
          <button type="button" class="btn-refine-modify" data-task-id="task7">修正</button>
          <button type="button" class="btn-refine-discuss" data-task-id="task7">讨论</button>
        </div>
      </div>
      <div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
    container.appendChild(jsonBlock);
    pushAndSaveProblemDetailChat({ type: 'e2eFlowJsonBlock', valueStreamJson: valueStream, timestamp: getTimeStr(), confirmed: false });
    container.scrollTop = container.scrollHeight;
    renderProblemDetailHistory();
    return;
  }
  const confirmE2eJsonBtn = e.target.closest('.btn-confirm-e2e-json');
  if (confirmE2eJsonBtn && !confirmE2eJsonBtn.disabled) {
    try {
      const item = __appState.currentProblemDetailItem;
      if (!item?.createdAt) return;
      let idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'e2eFlowJsonBlock');
      if (idx >= 0) {
        __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true };
        saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
      }
      if (typeof updateDigitalProblemE2eFlowLandscape === 'function') {
        updateDigitalProblemE2eFlowLandscape(item.createdAt, undefined);
      }
      confirmE2eJsonBtn.disabled = true;
      confirmE2eJsonBtn.textContent = '已确认';
      const container = el.problemDetailChatMessages;
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
      renderProblemDetailHistory();
      const task7Name =
        (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === 'task7')?.name) ||
        '端到端事务流构建';
      renderProblemDetailContent();
      const msgsE2e = __appState.problemDetailChatMessages || [];
      const hasTask7CompletionConfirm = msgsE2e.some((m) => m?.type === 'taskCompletionConfirmBlock' && m.taskId === 'task7');
      if (!hasTask7CompletionConfirm && !isTaskCompleted(item, 'task7')) {
        showTaskCompletionConfirm('task7', task7Name);
      }
    } catch (_) {}
    return;
  }
  const redoE2eJsonBtn = e.target.closest('.btn-redo-e2e-json');
  if (redoE2eJsonBtn && !redoE2eJsonBtn.disabled) {
    const item = __appState.currentProblemDetailItem;
    if (!item?.createdAt) return;
    if (typeof updateDigitalProblemE2eFlowLandscape === 'function') {
      updateDigitalProblemE2eFlowLandscape(item.createdAt, undefined);
    }
    if (typeof updateDigitalProblemE2eTransactionFlow === 'function') {
      updateDigitalProblemE2eTransactionFlow(item.createdAt, undefined);
    }
    if (typeof updateDigitalProblemE2eRequirementScenarioSupplement === 'function') {
      updateDigitalProblemE2eRequirementScenarioSupplement(item.createdAt, undefined);
    }
    __appState.currentProblemDetailItem = {
      ...item,
      e2eFlowLandscapeJson: undefined,
      e2eTransactionFlowJson: undefined,
      e2eRequirementScenarioSupplementJson: undefined,
    };
    const idxSess = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'e2eTransactionFlowSessionsBlock');
    if (idxSess >= 0) {
      const prevS = __appState.problemDetailChatMessages[idxSess];
      const resetSessions = (Array.isArray(prevS.sessions) ? prevS.sessions : []).map((s) => ({
        ...s,
        transactionNodesJson: null,
      }));
      __appState.problemDetailChatMessages[idxSess] = { ...prevS, sessions: resetSessions };
      saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
    }
    __appState.problemDetailChatMessages = __appState.problemDetailChatMessages.filter(
      (m) => m.type !== 'e2ePrelimFvsCompletenessAllDoneConfirmBlock',
    );
    const idxCompleteness = __appState.problemDetailChatMessages.findIndex(
      (m) => m.type === 'e2ePrelimFvsCompletenessSessionsBlock',
    );
    if (idxCompleteness >= 0) {
      const prevC = __appState.problemDetailChatMessages[idxCompleteness];
      const resetCSessions = (Array.isArray(prevC.sessions) ? prevC.sessions : []).map((s) => ({
        ...s,
        transactionNodesJson: null,
      }));
      const nextC = { ...prevC, sessions: resetCSessions };
      delete nextC.runningSessionIndex;
      __appState.problemDetailChatMessages[idxCompleteness] = nextC;
      saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
    }
    const idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'e2eFlowJsonBlock');
    if (idx >= 0) {
      __appState.problemDetailChatMessages[idx] = {
        ...__appState.problemDetailChatMessages[idx],
        confirmed: false,
        transactionFlowJson: { bpm_schema_version: 2, stages: [], transaction_nodes: [] },
      };
      saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
      const container = el.problemDetailChatMessages;
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
      renderProblemDetailContent();
      renderProblemDetailHistory();
    }
    return;
  }
  const startGlobalItGapBtn = e.target.closest('.btn-confirm-start-global-itgap');
  if (startGlobalItGapBtn && !startGlobalItGapBtn.disabled) {
    logTask8ItDesignStart('globalItGapStartBlock-click', {
      chatKey:
        __appState.currentProblemDetailItem && typeof getProblemDetailChatStorageKey === 'function'
          ? String(getProblemDetailChatStorageKey(__appState.currentProblemDetailItem) || '').slice(0, 40)
          : '',
    });
    startGlobalItGapBtn.disabled = true;
    startGlobalItGapBtn.textContent = '已确认';
    const item = __appState.currentProblemDetailItem;
    let idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'globalItGapStartBlock');
    if (idx >= 0) {
      __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true };
      const sk =
        item && typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
      if (sk) saveProblemDetailChat(sk, __appState.problemDetailChatMessages);
    }
    // 切换到 IT设计补齐 独立工作区子页（与端到端事务流构建分页展示）；顶栏/沟通历史 task8 标为进行中依赖 globalItGapStartBlock.confirmed
    itGapViewingSubstep = 1;
    if (typeof renderProblemDetailContent === 'function') renderProblemDetailContent();
    if (typeof renderProblemDetailHistory === 'function') renderProblemDetailHistory();
    if (typeof updateProblemDetailChatHeaderLabel === 'function') updateProblemDetailChatHeaderLabel();
    requestAnimationFrame(() => {
      logTask8ItDesignStart('globalItGapStartBlock-rAF-push', {});
      pushItDesignSupplementSessionsBlockAndRender();
    });
    return;
  }
  const confirmGlobalItGapPhasePlanBtn = e.target.closest('.btn-confirm-global-itgap-phase-plan');
  if (confirmGlobalItGapPhasePlanBtn && !confirmGlobalItGapPhasePlanBtn.disabled) {
    confirmGlobalItGapPhasePlanBtn.disabled = true;
    confirmGlobalItGapPhasePlanBtn.textContent = '已确认';
    const item = __appState.currentProblemDetailItem;
    let pidx = __appState.problemDetailChatMessages.findLastIndex((m) => m.type === 'globalItGapPhasePlanBlock');
    if (pidx >= 0) {
      __appState.problemDetailChatMessages[pidx] = { ...__appState.problemDetailChatMessages[pidx], confirmed: true };
      saveProblemDetailChat(item?.createdAt, __appState.problemDetailChatMessages);
    }
    const container = el.problemDetailChatMessages;
    if (container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    }
    renderProblemDetailHistory();
    requestAnimationFrame(() => runGlobalItGapAnalysis(false));
    return;
  }
  const confirmGlobalItGapJsonBtn = e.target.closest('.btn-confirm-global-itgap-json');
  if (confirmGlobalItGapJsonBtn && confirmGlobalItGapJsonBtn.dataset.json && !confirmGlobalItGapJsonBtn.disabled) {
    try {
      const analysisJson = normalizeGlobalItGapAnalysisShape(JSON.parse(confirmGlobalItGapJsonBtn.dataset.json));
      const item = __appState.currentProblemDetailItem;
      let idx = __appState.problemDetailChatMessages.findLastIndex((m) => m.type === 'globalItGapAnalysisCard');
      if (idx >= 0) {
        // 取消首次确认后切换 Markdown 结构化视图，改为直接确认完成
        __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], data: analysisJson, confirmed: true };
        // 同步将本任务下全部 task8 LLM-查询 块标记为已确认（四阶段各一条）
        for (let j = idx - 1; j >= 0; j--) {
          const q = __appState.problemDetailChatMessages[j];
          if (q?.type === 'globalItGapPhasePlanBlock' || q?.type === 'globalItGapStartBlock') break;
          if (q?.type === 'task8LlmQueryBlock') {
            __appState.problemDetailChatMessages[j] = { ...q, confirmed: true };
          }
        }
        saveProblemDetailChat(item?.createdAt, __appState.problemDetailChatMessages);
      }
      confirmGlobalItGapJsonBtn.disabled = true;
      confirmGlobalItGapJsonBtn.textContent = '已确认';
      updateDigitalProblemGlobalItGapAnalysis(item.createdAt, analysisJson);
      __appState.currentProblemDetailItem = { ...item, globalItGapAnalysisJson: analysisJson };
      renderProblemDetailContent();
      const container = el.problemDetailChatMessages;
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
      renderProblemDetailHistory();
      requestAnimationFrame(() => {
        runGlobalItGapConstraintCompressionAfterConfirm(analysisJson);
      });
    } catch (_) {}
    return;
  }
  const confirmGlobalItGapStructuredBtn = e.target.closest('.btn-confirm-global-itgap-structured');
  if (confirmGlobalItGapStructuredBtn && confirmGlobalItGapStructuredBtn.dataset.json && !confirmGlobalItGapStructuredBtn.disabled) {
    try {
      const analysisJson = normalizeGlobalItGapAnalysisShape(JSON.parse(confirmGlobalItGapStructuredBtn.dataset.json));
      const item = __appState.currentProblemDetailItem;
      let idx = __appState.problemDetailChatMessages.findLastIndex((m) => m.type === 'globalItGapAnalysisCard');
      if (idx >= 0) {
        __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], data: analysisJson, confirmed: true };
        // 同步将本任务下全部 task8 LLM-查询 块标记为已确认（四阶段各一条）
        for (let j = idx - 1; j >= 0; j--) {
          const q = __appState.problemDetailChatMessages[j];
          if (q?.type === 'globalItGapPhasePlanBlock' || q?.type === 'globalItGapStartBlock') break;
          if (q?.type === 'task8LlmQueryBlock') {
            __appState.problemDetailChatMessages[j] = { ...q, confirmed: true };
          }
        }
        saveProblemDetailChat(item?.createdAt, __appState.problemDetailChatMessages);
      }
      confirmGlobalItGapStructuredBtn.disabled = true;
      confirmGlobalItGapStructuredBtn.textContent = '已确认';
      updateDigitalProblemGlobalItGapAnalysis(item.createdAt, analysisJson);
      __appState.currentProblemDetailItem = { ...item, globalItGapAnalysisJson: analysisJson };
      renderProblemDetailContent();
      const container = el.problemDetailChatMessages;
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
      renderProblemDetailHistory();
      requestAnimationFrame(() => {
        runGlobalItGapConstraintCompressionAfterConfirm(analysisJson);
      });
    } catch (_) {}
    return;
  }
  const redoGlobalItGapBtn = e.target.closest('.btn-redo-global-itgap');
  if (redoGlobalItGapBtn && !redoGlobalItGapBtn.disabled) {
    requestAnimationFrame(() => runGlobalItGapAnalysis(true));
    return;
  }
  const btnCoreBusinessObjectSessionsAuto = e.target.closest('.btn-core-business-object-sessions-auto');
  if (btnCoreBusinessObjectSessionsAuto && !btnCoreBusinessObjectSessionsAuto.disabled) {
    if (isProblemDetailChatCboUiSuppressed()) return;
    const item = __appState.currentProblemDetailItem;
    const sessionsIdx = __appState.problemDetailChatMessages.findLastIndex((m) => m.type === 'coreBusinessObjectSessionsBlock');
    if (sessionsIdx >= 0) {
      __appState.problemDetailChatMessages[sessionsIdx] = { ...__appState.problemDetailChatMessages[sessionsIdx], confirmed: true, coreBusinessObjectSessionMode: 'auto' };
      saveProblemDetailChat(item?.createdAt, __appState.problemDetailChatMessages);
    }
    btnCoreBusinessObjectSessionsAuto.disabled = true;
    btnCoreBusinessObjectSessionsAuto.textContent = '已选择：自动顺序执行';
    const otherBtn = btnCoreBusinessObjectSessionsAuto.closest('.problem-detail-chat-role-permission-sessions-actions')?.querySelector('.btn-core-business-object-sessions-manual');
    if (otherBtn) { otherBtn.disabled = true; otherBtn.textContent = '手工逐项确认'; }
    const container = el.problemDetailChatMessages;
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
    renderProblemDetailContent();
    renderProblemDetailHistory();
    if (typeof logTask11CboSessionsSnapshot === 'function') logTask11CboSessionsSnapshot('auto-click-before-rAF');
    requestAnimationFrame(() => runCoreBusinessObjectAutoSequential && runCoreBusinessObjectAutoSequential());
    return;
  }
  const btnCoreBusinessObjectSessionsManual = e.target.closest('.btn-core-business-object-sessions-manual');
  if (btnCoreBusinessObjectSessionsManual && !btnCoreBusinessObjectSessionsManual.disabled) {
    if (isProblemDetailChatCboUiSuppressed()) return;
    const item = __appState.currentProblemDetailItem;
    const sessionsIdx = __appState.problemDetailChatMessages.findLastIndex((m) => m.type === 'coreBusinessObjectSessionsBlock');
    if (sessionsIdx >= 0) {
      __appState.problemDetailChatMessages[sessionsIdx] = { ...__appState.problemDetailChatMessages[sessionsIdx], confirmed: true, coreBusinessObjectSessionMode: 'manual' };
      saveProblemDetailChat(item?.createdAt, __appState.problemDetailChatMessages);
    }
    btnCoreBusinessObjectSessionsManual.disabled = true;
    btnCoreBusinessObjectSessionsManual.textContent = '已选择：手工逐项确认';
    const otherBtn = btnCoreBusinessObjectSessionsManual.closest('.problem-detail-chat-role-permission-sessions-actions')?.querySelector('.btn-core-business-object-sessions-auto');
    if (otherBtn) { otherBtn.disabled = true; otherBtn.textContent = '自动顺序执行'; }
    const container = el.problemDetailChatMessages;
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
    renderProblemDetailContent();
    renderProblemDetailHistory();
    requestAnimationFrame(() => runCoreBusinessObjectForNextStep && runCoreBusinessObjectForNextStep());
    return;
  }
  const btnCoreBusinessObjectConfirmAll = e.target.closest('.btn-core-business-object-confirm-all');
  if (btnCoreBusinessObjectConfirmAll && !btnCoreBusinessObjectConfirmAll.disabled) {
    if (isProblemDetailChatCboUiSuppressed()) return;
    const item = __appState.currentProblemDetailItem;
    if (!item?.createdAt) return;
    const allDoneBlock = btnCoreBusinessObjectConfirmAll.closest('[data-msg-index]');
    const allDoneIdx = allDoneBlock ? parseInt(allDoneBlock.dataset.msgIndex, 10) : -1;
    let hasUnconfirmed = false;
    for (let i = 0; i < __appState.problemDetailChatMessages.length; i++) {
      const m = __appState.problemDetailChatMessages[i];
      if (m.type === 'coreBusinessObjectAnalysisCard' && !m.confirmed) {
        hasUnconfirmed = true;
        __appState.problemDetailChatMessages[i] = { ...m, confirmed: true };
      }
      if (m.type === 'task11LlmQueryBlock' && !m.confirmed) {
        __appState.problemDetailChatMessages[i] = { ...m, confirmed: true };
      }
    }
    if (allDoneIdx >= 0 && allDoneIdx < __appState.problemDetailChatMessages.length && __appState.problemDetailChatMessages[allDoneIdx].type === 'coreBusinessObjectAllDoneBlock') {
      __appState.problemDetailChatMessages[allDoneIdx] = { ...__appState.problemDetailChatMessages[allDoneIdx], allConfirmed: true };
    }
    saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
    const updated = getDigitalProblems().find((it) => it.createdAt === item.createdAt);
    if (updated) __appState.currentProblemDetailItem = updated;
    btnCoreBusinessObjectConfirmAll.disabled = true;
    btnCoreBusinessObjectConfirmAll.textContent = '已全部确认';
    const container = el.problemDetailChatMessages;
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
    renderProblemDetailContent();
    renderProblemDetailHistory();
    const mergedCboItem = getDigitalProblems().find((it) => it.createdAt === item.createdAt);
    const task12CboMergedFinished = mergedCboItem && isTaskCompleted(mergedCboItem, 'task12');
    if (hasUnconfirmed || !task12CboMergedFinished) {
      requestAnimationFrame(() => {
        const wsScroll = document.querySelector('.problem-detail-workspace-scroll');
        if (wsScroll) wsScroll.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        pushCoreBusinessObjectGlobalAuditIntentBlockIfNeeded();
        const c = el.problemDetailChatMessages;
        if (c) {
          c.innerHTML = '';
          renderProblemDetailChatFromStorage(c, __appState.problemDetailChatMessages);
          c.scrollTop = c.scrollHeight;
        }
        renderProblemDetailHistory();
      });
    }
    return;
  }
  const confirmCoreBusinessObjectStepBtn = e.target.closest('.btn-confirm-core-business-object-step');
  if (confirmCoreBusinessObjectStepBtn && !confirmCoreBusinessObjectStepBtn.disabled) {
    if (isProblemDetailChatCboUiSuppressed()) return;
    const card = confirmCoreBusinessObjectStepBtn.closest('[data-msg-index]');
    const stepIndex = parseInt(card?.getAttribute('data-step-index') || card?.dataset?.stepIndex || '-1', 10);
    const item = __appState.currentProblemDetailItem;
    if (!item?.createdAt || isNaN(stepIndex) || stepIndex < 0) return;
    const idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'coreBusinessObjectAnalysisCard' && m.stepIndex === stepIndex);
    if (idx < 0) return;
    const msg = __appState.problemDetailChatMessages[idx];
    __appState.problemDetailChatMessages[idx] = { ...msg, confirmed: true };
    for (let j = idx - 1; j >= 0; j--) {
      const q = __appState.problemDetailChatMessages[j];
      if (q?.type === 'task11LlmQueryBlock' && (q.stepIndex == null || q.stepIndex === stepIndex)) {
        __appState.problemDetailChatMessages[j] = { ...q, confirmed: true };
        break;
      }
    }
    saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
    const list = getDigitalProblems();
    const updated = list.find((it) => it.createdAt === item.createdAt);
    if (updated) __appState.currentProblemDetailItem = updated;
    confirmCoreBusinessObjectStepBtn.disabled = true;
    confirmCoreBusinessObjectStepBtn.textContent = '已确认';
    const container = el.problemDetailChatMessages;
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
    renderProblemDetailContent();
    renderProblemDetailHistory();
    const sessions = resolveMergedCoreBusinessObjectSessions();
    const hasMore = sessions.some((s, i) => i > stepIndex && !hasCoreBusinessObjectStepJson(s));
    if (hasMore) {
      requestAnimationFrame(() => runCoreBusinessObjectForNextStep && runCoreBusinessObjectForNextStep());
    } else {
      // 手工逐项：最后一环点「确认」后，补发「全部确认」块；由「全部确认」继续进入审计意图流（与 task10 对齐）。
      const stillUnconfirmed = __appState.problemDetailChatMessages.some((m) => m.type === 'coreBusinessObjectAnalysisCard' && !m.confirmed);
      if (!stillUnconfirmed) {
        if (!isProblemDetailChatCboUiSuppressed() && !hasCoreBusinessObjectAllDoneBlockAfterLatestSessions()) {
          pushAndSaveProblemDetailChat({
            type: 'coreBusinessObjectAllDoneBlock',
            content: '所有环节的核心业务对象推演已经结束，是否全部确认？',
            timestamp: getTimeStr(),
          });
        }
        const c = el.problemDetailChatMessages;
        if (c) {
          c.innerHTML = '';
          renderProblemDetailChatFromStorage(c, __appState.problemDetailChatMessages);
          c.scrollTop = c.scrollHeight;
        }
        renderProblemDetailHistory();
      }
    }
    return;
  }
  const skipCoreBusinessObjectAuditBtn = e.target.closest('.btn-skip-core-business-object-audit');
  if (skipCoreBusinessObjectAuditBtn && !skipCoreBusinessObjectAuditBtn.disabled) {
    if (isProblemDetailChatCboUiSuppressed()) return;
    const item = __appState.currentProblemDetailItem;
    if (!item?.createdAt) return;
    const idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'coreBusinessObjectGlobalAuditIntentBlock' && !m.confirmed);
    if (idx < 0) return;
    __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true, auditSkippedByUser: true };
    saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
    const container = el.problemDetailChatMessages;
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
    renderProblemDetailHistory();
    // 核心业务对象审计链路已下线：仅关闭意图块，不弹完工确认（避免误标整个 task12）
    return;
  }
  const confirmCoreBusinessObjectAuditBtn = e.target.closest('.btn-confirm-core-business-object-audit');
  if (confirmCoreBusinessObjectAuditBtn && !confirmCoreBusinessObjectAuditBtn.disabled) {
    if (isProblemDetailChatCboUiSuppressed()) return;
    const item = __appState.currentProblemDetailItem;
    if (!item?.createdAt) return;
    const idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'coreBusinessObjectGlobalAuditIntentBlock' && !m.confirmed);
    if (idx < 0) return;
    __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true, auditSkippedByUser: false };
    saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
    confirmCoreBusinessObjectAuditBtn.disabled = true;
    confirmCoreBusinessObjectAuditBtn.textContent = '已确认';
    const container = el.problemDetailChatMessages;
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
    renderProblemDetailHistory();
    // 全局 CBO 审计 LLM 已下线：意图确认后不再调用审计模型
    return;
  }
  const redoCoreBusinessObjectStepBtn = e.target.closest('.btn-redo-core-business-object-step');
  if (redoCoreBusinessObjectStepBtn && !redoCoreBusinessObjectStepBtn.disabled) {
    if (isProblemDetailChatCboUiSuppressed()) return;
    const card = redoCoreBusinessObjectStepBtn.closest('[data-msg-index]');
    const stepIndex = parseInt(card?.getAttribute('data-step-index') || card?.dataset?.stepIndex || '-1', 10);
    const item = __appState.currentProblemDetailItem;
    if (!item?.createdAt || isNaN(stepIndex) || stepIndex < 0) return;
    const dataItem = findDigitalProblemCaseInList(item) || item;
    let sessions = (dataItem.coreBusinessObjectSessions || []).slice();
    if (sessions[stepIndex]) sessions[stepIndex] = { ...sessions[stepIndex], coreBusinessObjectJson: null };
    if (typeof updateDigitalProblemCoreBusinessObjectSessions === 'function') updateDigitalProblemCoreBusinessObjectSessions(item.createdAt || item.id, sessions);
    __appState.problemDetailChatMessages = __appState.problemDetailChatMessages.filter(
      (m) => !(m.type === 'coreBusinessObjectAnalysisCard' && m.stepIndex === stepIndex) && !(m.type === 'task11LlmQueryBlock' && m.stepIndex === stepIndex),
    );
    saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
    const updated = findDigitalProblemCaseInList(item);
    if (updated) __appState.currentProblemDetailItem = updated;
    const sessionsIdx = __appState.problemDetailChatMessages.findLastIndex((m) => m.type === 'coreBusinessObjectSessionsBlock');
    if (sessionsIdx >= 0) __appState.problemDetailChatMessages[sessionsIdx] = { ...__appState.problemDetailChatMessages[sessionsIdx], sessions: updated?.coreBusinessObjectSessions || sessions };
    const container = el.problemDetailChatMessages;
    container.innerHTML = '';
    renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
    renderProblemDetailContent();
    renderProblemDetailHistory();
    requestAnimationFrame(() => runCoreBusinessObjectForNextStep && runCoreBusinessObjectForNextStep());
    return;
  }
  const autoE2eTxFlowSessionsBtn = e.target.closest('.btn-auto-e2e-transaction-flow-sessions');
  if (autoE2eTxFlowSessionsBtn && !autoE2eTxFlowSessionsBtn.disabled) {
    autoE2eTxFlowSessionsBtn.disabled = true;
    (async function runE2eTxFlowAutoSequential() {
      const item = __appState.currentProblemDetailItem;
      const valueStream = item?.valueStream;
      if (!valueStream || valueStream.raw || !item?.createdAt) {
        autoE2eTxFlowSessionsBtn.disabled = false;
        return;
      }
      const maxIter = Math.max(32, (getE2eTransactionFlowSessionsFromMessages(__appState.problemDetailChatMessages).length || 0) + 8);
      let iter = 0;
      let lastNextIdx = -1;
      let stagnant = 0;
      while (true) {
        const sessions = getE2eTransactionFlowSessionsFromMessages(__appState.problemDetailChatMessages);
        const nextIdx = sessions.findIndex((s) => s == null || s.transactionNodesJson == null);
        if (nextIdx < 0) break;
        if (++iter > maxIter) {
          console.warn('[task7] 事务流 Session 自动顺序已达最大迭代次数，已中止');
          break;
        }
        if (nextIdx === lastNextIdx) {
          stagnant += 1;
          if (stagnant > 1) {
            console.warn('[task7] 事务流自动顺序：同一未完成阶段未推进，已中止');
            break;
          }
        } else {
          stagnant = 0;
          lastNextIdx = nextIdx;
        }
        await runE2eTransactionFlowForNextStage(valueStream, __appState.currentProblemDetailItem);
      }
      const containerTx = el.problemDetailChatMessages;
      if (containerTx) {
        containerTx.innerHTML = '';
        renderProblemDetailChatFromStorage(containerTx, __appState.problemDetailChatMessages);
        containerTx.scrollTop = containerTx.scrollHeight;
      }
      renderProblemDetailContent();
      renderProblemDetailHistory();
      const againE2eBtn = document.querySelector('.btn-auto-e2e-transaction-flow-sessions');
      if (againE2eBtn) {
        const sessionsAfter = getE2eTransactionFlowSessionsFromMessages(__appState.problemDetailChatMessages);
        const hasUnfinished = sessionsAfter.some((s) => s == null || s.transactionNodesJson == null);
        againE2eBtn.disabled = !hasUnfinished;
        againE2eBtn.textContent = hasUnfinished ? '自动顺序执行' : '全部已完成';
      }
    })();
    return;
  }
  const autoE2ePrelimFvsCompletenessBtn = e.target.closest('.btn-auto-e2e-prelim-fvs-completeness-sessions');
  if (autoE2ePrelimFvsCompletenessBtn && !autoE2ePrelimFvsCompletenessBtn.disabled) {
    autoE2ePrelimFvsCompletenessBtn.disabled = true;
    void (async function runE2ePrelimFvsCompletenessAutoSequential() {
      const itemC = __appState.currentProblemDetailItem;
      if (!itemC?.createdAt) {
        autoE2ePrelimFvsCompletenessBtn.disabled = false;
        return;
      }
      const maxIterC = Math.max(32, (getE2ePrelimFvsCompletenessSessionsFromMessages(__appState.problemDetailChatMessages).length || 0) + 8);
      let iterC = 0;
      let lastNextIdxC = -1;
      let stagnantC = 0;
      while (true) {
        const sessionsC = getE2ePrelimFvsCompletenessSessionsFromMessages(__appState.problemDetailChatMessages);
        const nextIdxC = sessionsC.findIndex((s) => s == null || s.transactionNodesJson == null);
        if (nextIdxC < 0) break;
        if (++iterC > maxIterC) {
          console.warn('[task7] 业务流程完整性 Session 自动顺序已达最大迭代次数，已中止');
          break;
        }
        if (nextIdxC === lastNextIdxC) {
          stagnantC += 1;
          if (stagnantC > 1) {
            console.warn('[task7] 业务流程完整性自动顺序：同一未完成类目未推进，已中止');
            break;
          }
        } else {
          stagnantC = 0;
          lastNextIdxC = nextIdxC;
        }
        await runE2ePrelimFvsCompletenessForNextDomain(__appState.currentProblemDetailItem);
      }
      const containerC = el.problemDetailChatMessages;
      if (containerC) {
        containerC.innerHTML = '';
        renderProblemDetailChatFromStorage(containerC, __appState.problemDetailChatMessages);
        containerC.scrollTop = containerC.scrollHeight;
      }
      renderProblemDetailContent();
      renderProblemDetailHistory();
      const againCompletenessBtn = document.querySelector('.btn-auto-e2e-prelim-fvs-completeness-sessions');
      if (againCompletenessBtn) {
        const sessionsAfterC = getE2ePrelimFvsCompletenessSessionsFromMessages(__appState.problemDetailChatMessages);
        const hasUnfinishedC = sessionsAfterC.some((s) => s == null || s.transactionNodesJson == null);
        againCompletenessBtn.disabled = !hasUnfinishedC;
        againCompletenessBtn.textContent = hasUnfinishedC ? '自动顺序执行' : '全部已完成';
      }
    })();
    return;
  }
  const autoValueStreamDrawSessionsBtn = e.target.closest('.btn-auto-value-stream-draw-sessions');
  if (autoValueStreamDrawSessionsBtn && !autoValueStreamDrawSessionsBtn.disabled) {
    autoValueStreamDrawSessionsBtn.disabled = true;
    void (async () => {
      try {
        if (typeof runValueStreamDrawSessionsAutoSequential === 'function') {
          await runValueStreamDrawSessionsAutoSequential();
        }
      } catch (err) {
        console.error('[task4] 价值流 Session 自动顺序执行失败', err);
      }
      const containerVs = el.problemDetailChatMessages;
      if (containerVs) {
        containerVs.innerHTML = '';
        renderProblemDetailChatFromStorage(containerVs, __appState.problemDetailChatMessages);
        containerVs.scrollTop = containerVs.scrollHeight;
      }
      renderProblemDetailContent();
      renderProblemDetailHistory();
      const againBtn = document.querySelector('.btn-auto-value-stream-draw-sessions');
      const sess = __appState.currentProblemDetailItem?.valueStreamDrawSessions;
      if (againBtn) {
        const allDone =
          Array.isArray(sess) &&
          sess.length > 0 &&
          (typeof window.valueStreamDrawSessionsHasUnfinished === 'function'
            ? !window.valueStreamDrawSessionsHasUnfinished(sess)
            : sess.every((s) => s.done));
        againBtn.disabled = allDone;
        againBtn.textContent = allDone ? '全部已完成' : '自动顺序执行';
      }
    })();
    return;
  }
  const autoPainPointSessionsBtn = e.target.closest('.btn-auto-pain-point-sessions');
  if (autoPainPointSessionsBtn && !autoPainPointSessionsBtn.disabled) {
    requestAnimationFrame(() => { if (typeof runPainPointAnnotationAutoSequential === 'function') runPainPointAnnotationAutoSequential(__appState.currentProblemDetailItem); });
    return;
  }
  const autoItDesignSupplementBtn = e.target.closest('.btn-auto-it-design-supplement-sessions');
  if (autoItDesignSupplementBtn && !autoItDesignSupplementBtn.disabled) {
    requestAnimationFrame(() => {
      try {
        if (globalThis.__FE_TASK8_IT_DESIGN_AUTO_SEQ_LOG === true) {
          const it = __appState.currentProblemDetailItem;
          const pk =
            typeof getDigitalProblemPersistKey === 'function' && it
              ? String(getDigitalProblemPersistKey(it) || '')
              : '';
          console.warn('[FE:task8-it-design-auto-seq]', 'click-auto-seq-button', {
            persistKey: pk,
            hasItem: !!it,
            preSessions: Array.isArray(it?.itDesignSupplementSessions) ? it.itDesignSupplementSessions.length : -1,
          });
        }
      } catch (_) {}
      if (typeof window.runItDesignSupplementAutoSequential === 'function') {
        window.runItDesignSupplementAutoSequential(__appState.currentProblemDetailItem);
      }
    });
    return;
  }
  const autoItDesignBpmDrawBtn = e.target.closest('.btn-auto-it-design-bpm-draw-sessions');
  if (autoItDesignBpmDrawBtn && !autoItDesignBpmDrawBtn.disabled) {
    requestAnimationFrame(() => {
      if (typeof window.runItDesignBpmDrawAutoSequential === 'function') {
        window.runItDesignBpmDrawAutoSequential(__appState.currentProblemDetailItem);
      }
    });
    return;
  }
  const confirmE2ePrelimCompletenessAllDoneBtn = e.target.closest('.btn-confirm-e2e-prelim-fvs-completeness-all-done');
  if (confirmE2ePrelimCompletenessAllDoneBtn && !confirmE2ePrelimCompletenessAllDoneBtn.disabled) {
    const itemGapDone = __appState.currentProblemDetailItem;
    const caseKeyGapDone =
      typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(itemGapDone) : '';
    if (!itemGapDone || !caseKeyGapDone) return;
    __appState.problemDetailChatMessages = __appState.problemDetailChatMessages.map((m) => {
      if (m.type === 'e2ePrelimFvsCompletenessAllDoneConfirmBlock') return { ...m, confirmed: true };
      return m;
    });
    saveProblemDetailChat(caseKeyGapDone, __appState.problemDetailChatMessages);
    confirmE2ePrelimCompletenessAllDoneBtn.textContent = '已确认';
    confirmE2ePrelimCompletenessAllDoneBtn.disabled = true;
    const containerGapDone = el.problemDetailChatMessages;
    if (containerGapDone) {
      containerGapDone.innerHTML = '';
      renderProblemDetailChatFromStorage(containerGapDone, __appState.problemDetailChatMessages);
      containerGapDone.scrollTop = containerGapDone.scrollHeight;
    }
    renderProblemDetailHistory();
    const task7NameGap =
      (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === 'task7')?.name) ||
      '端到端事务流构建';
    requestAnimationFrame(() => {
      if (typeof showTaskCompletionConfirm === 'function') showTaskCompletionConfirm('task7', task7NameGap);
    });
    return;
  }
  const confirmAllItDesignSupplementBtn = e.target.closest('.btn-confirm-all-it-design-supplement');
  if (confirmAllItDesignSupplementBtn && !confirmAllItDesignSupplementBtn.disabled) {
    const item = __appState.currentProblemDetailItem;
    const caseKeyConfirm =
      typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey(item) : '';
    if (!item || !caseKeyConfirm) return;
    const sessions = resolveItDesignSupplementSessionsForTask8(item, __appState.problemDetailChatMessages);
    if (sessions.length === 0) {
      pushAndSaveProblemDetailChat({
        role: 'system',
        content:
          '无法确认 IT设计补齐：未找到事务 session 数据（列表缓存与聊天 Session 计划均缺失）。请刷新页面或从案例列表重新进入本案例后再试。',
        timestamp: getTimeStr(),
      });
      return;
    }
    if (typeof updateDigitalProblemItDesignSupplementSessions === 'function') {
      updateDigitalProblemItDesignSupplementSessions(caseKeyConfirm, sessions);
    }
    const agg =
      typeof window.buildAggregateGlobalItGapFromSessions === 'function'
        ? window.buildAggregateGlobalItGapFromSessions(sessions)
        : { itDesignSupplementV1: true, transactions: [] };
    __appState.problemDetailChatMessages = __appState.problemDetailChatMessages.map((m) => {
      if (m.type === 'task8LlmQueryBlock') return { ...m, confirmed: true };
      if (m.type === 'itDesignSupplementAllDoneConfirmBlock') return { ...m, confirmed: true };
      return m;
    });
    saveProblemDetailChat(caseKeyConfirm, __appState.problemDetailChatMessages);
    confirmAllItDesignSupplementBtn.textContent = '已全部确认';
    confirmAllItDesignSupplementBtn.disabled = true;
    updateDigitalProblemGlobalItGapAnalysis(caseKeyConfirm, agg);
    const persistKey =
      typeof getDigitalProblemPersistKey === 'function' ? getDigitalProblemPersistKey(item) : caseKeyConfirm;
    const listAfter = typeof getDigitalProblems === 'function' ? getDigitalProblems() : [];
    const mergedRow =
      listAfter.find((it) => typeof getDigitalProblemPersistKey === 'function' && getDigitalProblemPersistKey(it) === persistKey) ||
      item;
    __appState.currentProblemDetailItem = {
      ...mergedRow,
      globalItGapAnalysisJson: agg,
      itDesignSupplementSessions: sessions,
    };
    renderProblemDetailContent();
    const container = el.problemDetailChatMessages;
    if (container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    }
    renderProblemDetailHistory();
    const tasks = []
      .concat(FOLLOW_TASKS || [])
      .concat(ITGAP_HISTORY_TASKS || [])
      .concat(IT_STRATEGY_TASKS || []);
    const t8Name = tasks.find((t) => t && t.id === 'task8')?.name || 'IT设计补齐';
    requestAnimationFrame(() => {
      if (typeof showTaskCompletionConfirm === 'function') showTaskCompletionConfirm('task8', t8Name);
    });
    return;
  }
  const autoItStatusSessionsBtn = e.target.closest('.btn-auto-it-status-sessions');
  if (autoItStatusSessionsBtn && !autoItStatusSessionsBtn.disabled) {
    requestAnimationFrame(() => {
      if (typeof runItStatusAnnotationAutoSequential === 'function') runItStatusAnnotationAutoSequential(__appState.currentProblemDetailItem);
    });
    return;
  }
  const confirmPainPointStepBtn = e.target.closest('.btn-confirm-pain-point-step');
  if (confirmPainPointStepBtn && !confirmPainPointStepBtn.disabled) {
    const stepIndex = parseInt(confirmPainPointStepBtn.dataset.stepIndex, 10);
    const item = __appState.currentProblemDetailItem;
    if (item?.createdAt && !isNaN(stepIndex) && stepIndex >= 0) {
      const msg = __appState.problemDetailChatMessages.find((m) => m.type === 'painPointStepCard' && m.stepIndex === stepIndex);
      const painPointText = (msg && msg.content != null) ? String(msg.content) : '';
      const allDone = typeof applyPainPointStepConfirm === 'function' && applyPainPointStepConfirm(item.createdAt, stepIndex, painPointText);
      confirmPainPointStepBtn.textContent = '已确认';
      confirmPainPointStepBtn.disabled = true;
      // 同步将最近一条 task6 的 LLM-查询 块标记为已确认，用于时间线显示「LLM-查询 + 确认」
      const cardIdxForConfirm = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'painPointStepCard' && m.stepIndex === stepIndex);
      if (cardIdxForConfirm >= 0) {
        for (let j = cardIdxForConfirm - 1; j >= 0; j--) {
          const q = __appState.problemDetailChatMessages[j];
          if (q?.type === 'task6LlmQueryBlock') {
            __appState.problemDetailChatMessages[j] = { ...q, confirmed: true };
            saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
            break;
          }
        }
      }
      if (allDone) {
        requestAnimationFrame(() => {
          showTaskCompletionConfirm('task6', (FOLLOW_TASKS || []).find((t) => t.id === 'task6')?.name || '痛点标注');
        });
      } else {
        // 单步卡「确认」后：若仍有未标注 session（如历史会话曾用手动顺序），链式调用下一环；新流程 Session 计划仅提供自动顺序，通常走「确认所有」收口
        const updated = getDigitalProblems().find((it) => it.createdAt === item.createdAt);
        if (updated) __appState.currentProblemDetailItem = updated;
        requestAnimationFrame(() => {
          if (typeof runPainPointAnnotationForNextStep === 'function') runPainPointAnnotationForNextStep(__appState.currentProblemDetailItem);
        });
      }
    }
    return;
  }
  const confirmAllPainPointsBtn = e.target.closest('.btn-confirm-all-pain-points');
  if (confirmAllPainPointsBtn && !confirmAllPainPointsBtn.disabled) {
    const item = __appState.currentProblemDetailItem;
    if (!item?.createdAt) return;
    __appState.problemDetailChatMessages = __appState.problemDetailChatMessages.map((m) => {
      if (m.type === 'painPointStepCard' || m.type === 'task6LlmQueryBlock') return { ...m, confirmed: true };
      if (m.type === 'painPointAllDoneConfirmBlock') return { ...m, confirmed: true };
      return m;
    });
    saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
    confirmAllPainPointsBtn.textContent = '已确认所有';
    confirmAllPainPointsBtn.disabled = true;
    const container = el.problemDetailChatMessages;
    if (container) {
      container.innerHTML = '';
      renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
    }
    renderProblemDetailHistory();
    requestAnimationFrame(() => {
      showTaskCompletionConfirm('task6', (FOLLOW_TASKS || []).find((t) => t.id === 'task6')?.name || '痛点标注');
    });
    return;
  }
  const confirmItStatusStepBtn = e.target.closest('.btn-confirm-it-status-step');
  if (confirmItStatusStepBtn && !confirmItStatusStepBtn.disabled) {
    const stepIndex = parseInt(confirmItStatusStepBtn.dataset.stepIndex, 10);
    const item = __appState.currentProblemDetailItem;
    if (item?.createdAt && !isNaN(stepIndex) && stepIndex >= 0) {
      const allDone = typeof applyItStatusStepConfirm === 'function' && applyItStatusStepConfirm(item.createdAt, stepIndex);
      confirmItStatusStepBtn.textContent = '已确认';
      confirmItStatusStepBtn.disabled = true;
      const cardIdxForConfirm = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'itStatusStepCard' && m.stepIndex === stepIndex);
      if (cardIdxForConfirm >= 0) {
        for (let j = cardIdxForConfirm - 1; j >= 0; j--) {
          const q = __appState.problemDetailChatMessages[j];
          if (q?.type === 'task5LlmQueryBlock' && (q.stepIndex == null || q.stepIndex === stepIndex)) {
            __appState.problemDetailChatMessages[j] = { ...q, confirmed: true };
            saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
            break;
          }
        }
      }
      if (allDone) {
        requestAnimationFrame(() => {
          showTaskCompletionConfirm(
            'task5',
            (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === 'task5')?.name) || 'IT 现状标注',
          );
        });
      } else {
        const updated = getDigitalProblems().find((it) => it.createdAt === item.createdAt);
        if (updated) __appState.currentProblemDetailItem = updated;
        requestAnimationFrame(() => {
          if (typeof runItStatusAnnotationForNextStep === 'function') runItStatusAnnotationForNextStep(__appState.currentProblemDetailItem);
        });
      }
    }
    return;
  }
  const confirmAllItStatusBtn = e.target.closest('.btn-confirm-all-it-status');
  if (confirmAllItStatusBtn && !confirmAllItStatusBtn.disabled) {
    const item = __appState.currentProblemDetailItem;
    if (!item?.createdAt) return;
    __appState.problemDetailChatMessages = __appState.problemDetailChatMessages.map((m) => {
      if (m.type === 'itStatusStepCard' || m.type === 'task5LlmQueryBlock') return { ...m, confirmed: true };
      if (m.type === 'itStatusAllDoneConfirmBlock') return { ...m, confirmed: true };
      return m;
    });
    saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
    confirmAllItStatusBtn.textContent = '已确认所有';
    confirmAllItStatusBtn.disabled = true;
    const containerIt = el.problemDetailChatMessages;
    if (containerIt) {
      containerIt.innerHTML = '';
      renderProblemDetailChatFromStorage(containerIt, __appState.problemDetailChatMessages);
      containerIt.scrollTop = containerIt.scrollHeight;
    }
    renderProblemDetailHistory();
    requestAnimationFrame(() => {
      showTaskCompletionConfirm(
        'task5',
        (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === 'task5')?.name) || 'IT 现状标注',
      );
    });
    return;
  }
  const redoPainPointStepBtn = e.target.closest('.btn-redo-pain-point-step');
  if (redoPainPointStepBtn && !redoPainPointStepBtn.disabled) {
    const stepIndex = parseInt(redoPainPointStepBtn.dataset.stepIndex, 10);
    const item = __appState.currentProblemDetailItem;
    if (item?.createdAt && !isNaN(stepIndex) && stepIndex >= 0 && typeof updateDigitalProblemPainPointStep === 'function') {
      updateDigitalProblemPainPointStep(item.createdAt, stepIndex, null);
      __appState.problemDetailChatMessages = __appState.problemDetailChatMessages.filter((m) => !(m.type === 'painPointStepCard' && m.stepIndex === stepIndex));
      saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
      const list = getDigitalProblems();
      const updated = list.find((it) => it.createdAt === item.createdAt);
      if (updated) __appState.currentProblemDetailItem = updated;
      const container = el.problemDetailChatMessages;
      if (container) {
        container.innerHTML = '';
        renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
        container.scrollTop = container.scrollHeight;
      }
      renderProblemDetailContent();
      renderProblemDetailHistory();
      const autoBtn = document.querySelector('.btn-auto-pain-point-sessions');
      if (autoBtn) autoBtn.disabled = false;
    }
    return;
  }
  const redoItStatusStepBtn = e.target.closest('.btn-redo-it-status-step');
  if (redoItStatusStepBtn && !redoItStatusStepBtn.disabled) {
    const stepIndex = parseInt(redoItStatusStepBtn.dataset.stepIndex, 10);
    const item = __appState.currentProblemDetailItem;
    if (item?.createdAt && !isNaN(stepIndex) && stepIndex >= 0 && typeof updateDigitalProblemItStatusStep === 'function') {
      updateDigitalProblemItStatusStep(item.createdAt, stepIndex, null, null, null);
      __appState.problemDetailChatMessages = __appState.problemDetailChatMessages.filter((m) => !(m.type === 'itStatusStepCard' && m.stepIndex === stepIndex));
      saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
      const list = getDigitalProblems();
      const updated = list.find((it) => it.createdAt === item.createdAt);
      if (updated) __appState.currentProblemDetailItem = updated;
      const container = el.problemDetailChatMessages;
      if (container) {
        container.innerHTML = '';
        renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
        container.scrollTop = container.scrollHeight;
      }
      renderProblemDetailContent();
      renderProblemDetailHistory();
      const autoBtnIt = document.querySelector('.btn-auto-it-status-sessions');
      if (autoBtnIt) autoBtnIt.disabled = false;
    }
    return;
  }
  const startItStrategyPlanBtn = e.target.closest('.btn-confirm-start-it-strategy-plan');
  if (startItStrategyPlanBtn && !startItStrategyPlanBtn.disabled) {
    startItStrategyPlanBtn.disabled = true;
    startItStrategyPlanBtn.textContent = '已确认';
    const item = __appState.currentProblemDetailItem;
    let idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'itStrategyPlanStartBlock');
    if (idx >= 0) {
      __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true };
      saveProblemDetailChat(item?.createdAt, __appState.problemDetailChatMessages);
    }
    if (item?.createdAt) {
      updateDigitalProblemMajorStage(item.createdAt, 3);
      __appState.currentProblemDetailItem = { ...item, currentMajorStage: 3 };
      problemDetailViewingMajorStage = 3;
      itStrategyPlanViewingSubstep = 0;
      persistItStrategyPlanSubstepForCaseKey(getProblemFollowCaseKey(item), 0);
      updateProblemDetailProgressStages(3, 3);
      renderProblemDetailContent();
      updateProblemDetailChatHeaderLabel();
    }
    requestAnimationFrame(() => {
      showNextTaskStartNotificationIfCurrentTaskPendingOnly();
    });
    return;
  }
  const startItGapBtn = e.target.closest('.btn-confirm-start-it-gap');
  if (startItGapBtn && !startItGapBtn.disabled) {
    startItGapBtn.disabled = true;
    startItGapBtn.textContent = '已确认';
    let idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'itGapStartBlock');
    if (idx >= 0) {
      __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true };
      saveProblemDetailChat(__appState.currentProblemDetailItem?.createdAt, __appState.problemDetailChatMessages);
    }
    const item = __appState.currentProblemDetailItem;
    if (item?.createdAt) {
      updateDigitalProblemMajorStage(item.createdAt, 2);
      // 仅切换到 ITGap 阶段，不在此处标记 task7 完成；task7 在用户点击端到端事务流 JSON 卡片的「确认」后才标记完成
      __appState.currentProblemDetailItem = { ...item, currentMajorStage: 2 };
      problemDetailViewingMajorStage = 2;
      updateProblemDetailProgressStages(2, problemDetailViewingMajorStage);
      renderProblemDetailContent();
    }
    requestAnimationFrame(() => {
      showNextTaskStartNotificationIfCurrentTaskPendingOnly();
    });
    return;
  }
  const valueStreamPhaseIntroBtn = e.target.closest('.btn-confirm-value-stream-phase-intro');
  if (valueStreamPhaseIntroBtn && !valueStreamPhaseIntroBtn.disabled) {
    const phase = valueStreamPhaseIntroBtn.getAttribute('data-phase') || 'mirror';
    const wrap = valueStreamPhaseIntroBtn.closest('[data-msg-index]');
    const msgIdx = wrap ? parseInt(wrap.getAttribute('data-msg-index'), 10) : NaN;
    if (!isNaN(msgIdx) && msgIdx >= 0 && msgIdx < __appState.problemDetailChatMessages.length) {
      const m = __appState.problemDetailChatMessages[msgIdx];
      if (m?.type === 'valueStreamPhaseIntroBlock' && !m.confirmed) {
        __appState.problemDetailChatMessages[msgIdx] = { ...m, confirmed: true };
        saveProblemDetailChat(__appState.currentProblemDetailItem?.createdAt, __appState.problemDetailChatMessages);
        valueStreamPhaseIntroBtn.textContent = '已确认';
        valueStreamPhaseIntroBtn.disabled = true;
        const refineBtns = wrap?.querySelectorAll('.btn-refine-modify, .btn-refine-discuss');
        refineBtns?.forEach((b) => {
          b.disabled = true;
        });
        const chatElPh = el.problemDetailChatMessages;
        if (chatElPh) {
          chatElPh.innerHTML = '';
          renderProblemDetailChatFromStorage(chatElPh, __appState.problemDetailChatMessages);
          chatElPh.scrollTop = chatElPh.scrollHeight;
        }
        renderProblemDetailHistory();
        if (phase === 'hardening') {
          if (typeof runValueStreamPhaseHardening === 'function') void runValueStreamPhaseHardening();
        } else if (typeof runValueStreamPhaseMirror === 'function') {
          void runValueStreamPhaseMirror();
        }
      }
    }
    return;
  }
  const startValueStreamBtn = e.target.closest('.btn-confirm-start-value-stream');
  if (startValueStreamBtn && !startValueStreamBtn.disabled) {
    startValueStreamBtn.disabled = true;
    startValueStreamBtn.textContent = '已确认';
    let idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'valueStreamStartBlock');
    if (idx >= 0) {
      __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true };
      saveProblemDetailChat(__appState.currentProblemDetailItem?.createdAt, __appState.problemDetailChatMessages);
    }
    const hasVsDrawPlan = __appState.problemDetailChatMessages.some((m) => m.type === 'valueStreamDrawSessionsBlock');
    if (!hasVsDrawPlan) {
      const vsSessions = getDefaultValueStreamDrawSessions();
      const caseKeyVs = getProblemDetailChatStorageKey(__appState.currentProblemDetailItem);
      if (caseKeyVs && typeof updateDigitalProblemValueStreamDrawSessions === 'function') {
        updateDigitalProblemValueStreamDrawSessions(caseKeyVs, vsSessions);
      }
      __appState.currentProblemDetailItem = {
        ...__appState.currentProblemDetailItem,
        valueStreamDrawSessions: vsSessions,
      };
      pushAndSaveProblemDetailChat({
        type: 'valueStreamDrawSessionsBlock',
        taskId: 'task4',
        timestamp: getTimeStr(),
      });
    }
    const chatElVs = el.problemDetailChatMessages;
    if (chatElVs) {
      chatElVs.innerHTML = '';
      renderProblemDetailChatFromStorage(chatElVs, __appState.problemDetailChatMessages);
      chatElVs.scrollTop = chatElVs.scrollHeight;
    }
    renderProblemDetailHistory();
    return;
  }
  const startReqLogicBtn = e.target.closest('.btn-confirm-start-requirement-logic');
  if (startReqLogicBtn && !startReqLogicBtn.disabled) {
    startReqLogicBtn.disabled = true;
    startReqLogicBtn.textContent = '已确认';
    let idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'requirementLogicStartBlock');
    if (idx >= 0) {
      __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true };
      saveProblemDetailChat(__appState.currentProblemDetailItem?.createdAt, __appState.problemDetailChatMessages);
    }
    runRequirementLogicConstruction();
    return;
  }
  const startBmcBtn = e.target.closest('.btn-confirm-start-bmc');
  if (startBmcBtn && !startBmcBtn.disabled) {
    startBmcBtn.disabled = true;
    startBmcBtn.textContent = '已确认';
    let idx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'bmcStartBlock');
    if (idx >= 0) {
      __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], confirmed: true };
      saveProblemDetailChat(__appState.currentProblemDetailItem?.createdAt, __appState.problemDetailChatMessages);
    }
    runBmcGeneration();
    return;
  }
  const valueStreamBtn = e.target.closest('.btn-confirm-value-stream');
  if (valueStreamBtn && valueStreamBtn.dataset.json && !valueStreamBtn.disabled) {
    try {
      const wrapCard = valueStreamBtn.closest('[data-msg-index]');
      let idx = -1;
      if (wrapCard) {
        const mi = parseInt(wrapCard.getAttribute('data-msg-index'), 10);
        if (
          !Number.isNaN(mi) &&
          mi >= 0 &&
          mi < __appState.problemDetailChatMessages.length &&
          __appState.problemDetailChatMessages[mi]?.type === 'valueStreamCard'
        ) {
          idx = mi;
        }
      }
      if (idx < 0) {
        for (let i = __appState.problemDetailChatMessages.length - 1; i >= 0; i--) {
          if (__appState.problemDetailChatMessages[i].type === 'valueStreamCard') {
            idx = i;
            break;
          }
        }
      }
      const cardPhaseEarly = idx >= 0 ? __appState.problemDetailChatMessages[idx]?.valueStreamPhase : null;
      if (cardPhaseEarly === 'hardening_draft') return;

      const valueStream = JSON.parse(valueStreamBtn.dataset.json);
      const item = __appState.currentProblemDetailItem;
      const caseKey = getProblemDetailChatStorageKey(item);
      if (caseKey) {
        if (typeof updateDigitalProblemValueStreamDataOnly === 'function') {
          updateDigitalProblemValueStreamDataOnly(caseKey, valueStream);
        } else {
          updateDigitalProblemValueStream(caseKey, valueStream);
        }
        const mergedVs =
          typeof findDigitalProblemCaseInList === 'function' ? findDigitalProblemCaseInList(item) : null;
        __appState.currentProblemDetailItem = { ...(mergedVs || item), valueStream };
      }
      if (idx >= 0) {
        __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], data: valueStream, confirmed: true };
        saveProblemDetailChat(getProblemDetailChatStorageKey(__appState.currentProblemDetailItem), __appState.problemDetailChatMessages);
      }
      const cardPhase = idx >= 0 ? __appState.problemDetailChatMessages[idx]?.valueStreamPhase : null;
      for (let j = __appState.problemDetailChatMessages.length - 1; j >= 0; j--) {
        const q = __appState.problemDetailChatMessages[j];
        if (q?.type !== 'task4LlmQueryBlock' || q.confirmed) continue;
        let match = true;
        if (cardPhase === 'mirror') match = q.valueStreamPhase === 'mirror';
        else if (cardPhase === 'hardening_final' || cardPhase === 'hardening_stage_progress' || cardPhase === 'synthesis_final')
          match = q.valueStreamPhase === 'hardening' || q.valueStreamPhase === 'synthesis';
        if (!match) continue;
        __appState.problemDetailChatMessages[j] = { ...q, confirmed: true };
        saveProblemDetailChat?.(getProblemDetailChatStorageKey(__appState.currentProblemDetailItem), __appState.problemDetailChatMessages);
        break;
      }
      valueStreamBtn.textContent = '已确认';
      valueStreamBtn.disabled = true;
      const container = el.problemDetailChatMessages;
      if (container) {
        container.innerHTML = '';
        renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
        container.scrollTop = container.scrollHeight;
      }
      void refreshProblemDetailWorkspaceWithAnimation('正在刷新页面并加载最新价值流图…').then(() => {
        renderProblemDetailHistory();
        if (task4ValueStreamIsFinalForCompletion(__appState.problemDetailChatMessages)) {
          showTaskCompletionConfirm(
            'task4',
            (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === 'task4')?.name) || '绘制价值流',
          );
        }
      });
    } catch (_) {}
    return;
  }
  const drawValueStreamBtn = e.target.closest('.btn-confirm-draw-value-stream');
  if (drawValueStreamBtn && drawValueStreamBtn.dataset.json && !drawValueStreamBtn.disabled) {
    try {
      const valueStream = JSON.parse(drawValueStreamBtn.dataset.json);
      const item = __appState.currentProblemDetailItem;
      if (item?.createdAt) {
        pushOperationToHistory(item.createdAt, 'valueStreamDraw', JSON.parse(JSON.stringify(item)), __appState.problemDetailChatMessages.length);
        updateDigitalProblemValueStream(item.createdAt, valueStream);
        __appState.currentProblemDetailItem = { ...item, valueStream };
      }
      drawValueStreamBtn.textContent = '已确认';
      drawValueStreamBtn.disabled = true;
      const drawIdx = __appState.problemDetailChatMessages.findIndex((m) => m.type === 'drawValueStreamStartBlock');
      if (drawIdx >= 0) {
        __appState.problemDetailChatMessages[drawIdx] = { ...__appState.problemDetailChatMessages[drawIdx], confirmed: true };
        saveProblemDetailChat(__appState.currentProblemDetailItem?.createdAt, __appState.problemDetailChatMessages);
      }
      renderProblemDetailContent();
      requestAnimationFrame(() => {
        if (task4ValueStreamIsFinalForCompletion(__appState.problemDetailChatMessages)) {
          showTaskCompletionConfirm(
            'task4',
            (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === 'task4')?.name) || '绘制价值流',
          );
        }
      });
    } catch (_) {}
    return;
  }
  const confirmItStatusBtn = e.target.closest('.btn-confirm-it-status');
  if (confirmItStatusBtn && !confirmItStatusBtn.disabled) {
    const item = __appState.currentProblemDetailItem;
    const cardIdx = __appState.problemDetailChatMessages.findLastIndex((m) => m.type === 'itStatusCard');
    if (cardIdx >= 0 && item?.createdAt) {
      __appState.problemDetailChatMessages[cardIdx] = { ...__appState.problemDetailChatMessages[cardIdx], confirmed: true };
      // 同步将最近一条 task5 的 LLM-查询 块标记为已确认，用于时间线显示「LLM-查询 + 确认」
      for (let j = cardIdx - 1; j >= 0; j--) {
        const q = __appState.problemDetailChatMessages[j];
        if (q?.type === 'task5LlmQueryBlock') {
          __appState.problemDetailChatMessages[j] = { ...q, confirmed: true };
          break;
        }
      }
      saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
      confirmItStatusBtn.textContent = '已确认';
      confirmItStatusBtn.disabled = true;
      renderProblemDetailContent();
      const chatContainer = el.problemDetailChatMessages;
      if (chatContainer) {
        chatContainer.innerHTML = '';
        renderProblemDetailChatFromStorage(chatContainer, __appState.problemDetailChatMessages);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
      renderProblemDetailHistory();
      requestAnimationFrame(() => {
        showTaskCompletionConfirm('task5', (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === 'task5')?.name) || 'IT 现状标注');
      });
    }
    return;
  }
  const redoValueStreamBtn = e.target.closest('.btn-redo-value-stream');
  if (redoValueStreamBtn && !redoValueStreamBtn.disabled) {
    const item = __appState.currentProblemDetailItem;
    const vsIdx = __appState.problemDetailChatMessages.findLastIndex((m) => m.type === 'valueStreamCard');
    if (vsIdx >= 0 && item?.createdAt) {
      __appState.problemDetailChatMessages.splice(vsIdx, 1);
      saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
      const chatContainer = el.problemDetailChatMessages;
      if (chatContainer) {
        chatContainer.innerHTML = '';
        renderProblemDetailChatFromStorage(chatContainer, __appState.problemDetailChatMessages);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
      renderProblemDetailHistory();
      requestAnimationFrame(() => {
        if (typeof runValueStreamGeneration === 'function') void runValueStreamGeneration({ redoMirror: true });
      });
    }
    return;
  }
  const redoItStatusBtn = e.target.closest('.btn-redo-it-status');
  if (redoItStatusBtn && !redoItStatusBtn.disabled) {
    const item = __appState.currentProblemDetailItem;
    const cardIdx = __appState.problemDetailChatMessages.findLastIndex((m) => m.type === 'itStatusCard');
    if (cardIdx >= 0 && item?.createdAt) {
      const toRemove = [cardIdx];
      const doneIdx = cardIdx + 1;
      if (doneIdx < __appState.problemDetailChatMessages.length && __appState.problemDetailChatMessages[doneIdx].role === 'system' && __appState.problemDetailChatMessages[doneIdx].content === 'IT 现状标注完成') toRemove.push(doneIdx);
      toRemove.sort((a, b) => b - a).forEach((i) => __appState.problemDetailChatMessages.splice(i, 1));
      saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
      const chatContainer = el.problemDetailChatMessages;
      if (chatContainer) {
        chatContainer.innerHTML = '';
        renderProblemDetailChatFromStorage(chatContainer, __appState.problemDetailChatMessages);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
      renderProblemDetailHistory();
      requestAnimationFrame(() => runItStatusAnnotation(__appState.currentProblemDetailItem));
    }
    return;
  }
  const redoBmcOnErrorBtn = e.target.closest('.btn-redo-bmc-on-error');
  if (redoBmcOnErrorBtn && !redoBmcOnErrorBtn.disabled) {
    const item = __appState.currentProblemDetailItem;
    const chatContainer = el.problemDetailChatMessages;
    const errorBlock = redoBmcOnErrorBtn.closest('.problem-detail-chat-msg');
    if (errorBlock && errorBlock.parentNode === chatContainer) {
      errorBlock.remove();
      const failIdx = __appState.problemDetailChatMessages.findLastIndex((m) => m.role === 'system' && typeof m.content === 'string' && m.content.startsWith('生成失败：'));
      if (failIdx >= 0) {
        __appState.problemDetailChatMessages.splice(failIdx, 1);
        if (item?.createdAt) saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
      }
      redoBmcOnErrorBtn.disabled = true;
      requestAnimationFrame(() => runBmcGeneration());
    }
    return;
  }
  const redoBmcBtn = e.target.closest('.btn-redo-bmc');
  if (redoBmcBtn && !redoBmcBtn.disabled) {
    const item = __appState.currentProblemDetailItem;
    const bmcIdx = __appState.problemDetailChatMessages.findLastIndex((m) => m.type === 'bmcCard');
    if (bmcIdx >= 0 && item?.createdAt) {
      __appState.problemDetailChatMessages.splice(bmcIdx, 1);
      saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
      const chatContainer = el.problemDetailChatMessages;
      if (chatContainer) {
        chatContainer.innerHTML = '';
        renderProblemDetailChatFromStorage(chatContainer, __appState.problemDetailChatMessages);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
      renderProblemDetailHistory();
      requestAnimationFrame(() => runBmcGeneration());
    }
    return;
  }
  const redoRequirementLogicBtn = e.target.closest('.btn-redo-requirement-logic');
  if (redoRequirementLogicBtn && !redoRequirementLogicBtn.disabled) {
    const item = __appState.currentProblemDetailItem;
    const logicIdx = __appState.problemDetailChatMessages.findLastIndex((m) => m.type === 'requirementLogicBlock');
    if (logicIdx >= 0 && item?.createdAt) {
      __appState.problemDetailChatMessages.splice(logicIdx, 1);
      saveProblemDetailChat(item.createdAt, __appState.problemDetailChatMessages);
      const chatContainer = el.problemDetailChatMessages;
      if (chatContainer) {
        chatContainer.innerHTML = '';
        renderProblemDetailChatFromStorage(chatContainer, __appState.problemDetailChatMessages);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
      renderProblemDetailHistory();
      requestAnimationFrame(() => runRequirementLogicConstruction());
    }
    return;
  }
  const bmcBtn = e.target.closest('.btn-confirm-bmc');
  if (bmcBtn && bmcBtn.dataset.json) {
    try {
      const bmc = JSON.parse(bmcBtn.dataset.json);
      // [bridge] → core/task2-companion-runtime.js (Phase 4A)
      globalThis.SmartCto.task2Runtime.confirmBusinessModelCanvasFromChat(bmc, bmcBtn);
    } catch (_) {}
    return;
  }
  const rejectBtn = e.target.closest('.btn-reject-intent-extraction');
  if (rejectBtn) {
    const cardBlock = rejectBtn.closest('.problem-detail-chat-intent-card');
    if (cardBlock && cardBlock.dataset.msgIndex != null) {
      const idx = parseInt(cardBlock.dataset.msgIndex, 10);
      const userText = (rejectBtn.dataset.userText || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      if (!isNaN(idx) && idx >= 0 && idx < __appState.problemDetailChatMessages.length && userText) {
        const item = __appState.currentProblemDetailItem;
        const createdAt = item?.createdAt;
        const { context: contextStr } = buildIntentExtractionContext(createdAt, item);
        const inner = cardBlock.querySelector('.problem-detail-intent-card-inner');
        if (inner) {
          inner.innerHTML = `<div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在全局重新匹配任务…</span></div>`;
        }
        (async () => {
          try {
            const result = await extractUserIntentFromChat(userText, contextStr, { globalScope: true });
            const { _llmMeta, ...extracted } = result;
            __appState.problemDetailChatMessages[idx] = { role: 'system', type: 'intentExtractionCard', data: extracted, userText, timestamp: getTimeStr(), confirmed: false, llmMeta: _llmMeta };
            saveProblemDetailChat(createdAt, __appState.problemDetailChatMessages);
            const container = el.problemDetailChatMessages;
            container.innerHTML = '';
            renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
            container.scrollTop = container.scrollHeight;
            focusWorkspaceOnIntent(extracted);
          } catch (err) {
            __appState.problemDetailChatMessages[idx] = { role: 'system', content: '重新提炼失败：' + (err.message || String(err)), timestamp: getTimeStr() };
            saveProblemDetailChat(createdAt, __appState.problemDetailChatMessages);
            const container = el.problemDetailChatMessages;
            container.innerHTML = '';
            renderProblemDetailChatFromStorage(container, __appState.problemDetailChatMessages);
            container.scrollTop = container.scrollHeight;
          }
        })();
      }
    }
    return;
  }
  const intentBtn = e.target.closest('.btn-confirm-intent-extraction');
  if (intentBtn && intentBtn.dataset.extracted && !intentBtn.disabled) {
    try {
      const extracted = JSON.parse(intentBtn.dataset.extracted);
      const userText = (intentBtn.dataset.userText || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      let idx = -1;
      for (let i = __appState.problemDetailChatMessages.length - 1; i >= 0; i--) {
        if (__appState.problemDetailChatMessages[i].type === 'intentExtractionCard') {
          idx = i;
          break;
        }
      }
      if (idx >= 0) {
        __appState.problemDetailChatMessages[idx] = { ...__appState.problemDetailChatMessages[idx], data: extracted, userText, confirmed: true };
        saveProblemDetailChat(__appState.currentProblemDetailItem?.createdAt, __appState.problemDetailChatMessages);
      }
      intentBtn.textContent = '已确认';
      intentBtn.disabled = true;
      renderProblemDetailHistory();
      const taskIdForConfirm = extracted.taskId || 'task1';
      const taskNameForConfirm = (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || [])).find((t) => t.id === taskIdForConfirm)?.name || taskIdForConfirm;
      if (extracted.intent !== 'query' && extracted.intent !== 'discussion' && extracted.intent !== 'execute') {
        showTaskCompletionConfirm(taskIdForConfirm, taskNameForConfirm);
      }
      if (problemDetailChatMode === 'ask' && (extracted.intent === 'modification' || extracted.intent === 'execute')) {
        const container = el.problemDetailChatMessages;
        const tipBlock = document.createElement('div');
        tipBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
        tipBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">当前为 Ask 模式，仅支持查询与讨论。请切换至 Agent 模式</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
        container?.appendChild(tipBlock);
        container.scrollTop = container.scrollHeight;
        pushAndSaveProblemDetailChat({ role: 'system', content: '当前为 Ask 模式，仅支持查询与讨论。请切换至 Agent 模式', timestamp: getTimeStr() });
        return;
      }
      if (extracted.intent === 'execute' && extracted.executeTaskId) {
        const runMap = {
          task2: runBmcGeneration,
          task3: runRequirementLogicConstruction,
          task4: runValueStreamGeneration,
          task5: runItStatusAnnotation,
          task6: () => runPainPointAnnotation(__appState.currentProblemDetailItem, true),
        };
        const run = runMap[extracted.executeTaskId];
        if (run) {
          requestAnimationFrame(async () => {
            const sb = el.problemDetailChatSend;
            if (sb) sb.disabled = true;
            try {
              const r = run();
              if (r && typeof r.then === 'function') await r;
            } finally {
              if (sb) sb.disabled = false;
            }
          });
        }
      }
      if (extracted.intent === 'query') {
        const item = __appState.currentProblemDetailItem;
        const container = el.problemDetailChatMessages;
        const parsingBlock = document.createElement('div');
        parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
        parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在查询…</span></div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
        container?.appendChild(parsingBlock);
        container.scrollTop = container.scrollHeight;
        requestAnimationFrame(async () => {
          const sb = el.problemDetailChatSend;
          if (sb) sb.disabled = true;
          try {
            const { content, usage, model, durationMs } = await executeQueryIntent(extracted, item);
            parsingBlock.remove();
            const llmMeta = buildLlmMetaHtml({ usage, model, durationMs });
            const resultBlock = document.createElement('div');
            resultBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-with-delete';
            resultBlock.dataset.msgIndex = String(__appState.problemDetailChatMessages.length);
            resultBlock.innerHTML = `<button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button><div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content markdown-body">${renderMarkdown(content)}</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>${llmMeta}`;
            container?.appendChild(resultBlock);
            pushAndSaveProblemDetailChat({ role: 'system', content, timestamp: getTimeStr(), llmMeta: { usage, model, durationMs } });
            container.scrollTop = container.scrollHeight;
            if (problemDetailChatMode === 'ask') focusWorkspaceOnIntent(extracted);
          } catch (err) {
            parsingBlock.classList.remove('problem-detail-chat-msg-parsing');
            parsingBlock.querySelector('.problem-detail-chat-msg-content-wrap').innerHTML = `<div class="problem-detail-chat-msg-content">查询失败：${escapeHtml(err.message || String(err))}</div>`;
            pushAndSaveProblemDetailChat({ role: 'system', content: '查询失败：' + (err.message || String(err)), timestamp: getTimeStr() });
          } finally {
            if (sb) sb.disabled = false;
          }
        });
      }
      if (extracted.intent === 'discussion') {
        const item = __appState.currentProblemDetailItem;
        const container = el.problemDetailChatMessages;
        const userText = (intentBtn.dataset.userText || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const parsingBlock = document.createElement('div');
        parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
        parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在讨论…</span></div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
        container?.appendChild(parsingBlock);
        container.scrollTop = container.scrollHeight;
        requestAnimationFrame(async () => {
          const sb = el.problemDetailChatSend;
          if (sb) sb.disabled = true;
          try {
            const relatedTaskId = extracted.taskId || 'task1';
            const { content, usage, model, durationMs } = await executeDiscussionIntent(extracted, item, userText);
            parsingBlock.remove();
            const llmMeta = buildLlmMetaHtml({ usage, model, durationMs });
            const resultBlock = document.createElement('div');
            resultBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-with-delete';
            resultBlock.dataset.msgIndex = String(__appState.problemDetailChatMessages.length);
            resultBlock.innerHTML = `<button type="button" class="btn-delete-chat-msg" aria-label="删除">${DELETE_CHAT_MSG_ICON}</button><div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content markdown-body">${renderMarkdown(content)}</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>${llmMeta}`;
            container?.appendChild(resultBlock);
            pushAndSaveProblemDetailChat({ role: 'system', content, timestamp: getTimeStr(), llmMeta: { usage, model, durationMs }, _taskId: relatedTaskId });
            container.scrollTop = container.scrollHeight;
            renderProblemDetailHistory();
          } catch (err) {
            parsingBlock.classList.remove('problem-detail-chat-msg-parsing');
            parsingBlock.querySelector('.problem-detail-chat-msg-content-wrap').innerHTML = `<div class="problem-detail-chat-msg-content">讨论失败：${escapeHtml(err.message || String(err))}</div>`;
            pushAndSaveProblemDetailChat({ role: 'system', content: '讨论失败：' + (err.message || String(err)), timestamp: getTimeStr() });
          } finally {
            if (sb) sb.disabled = false;
          }
        });
      }
      const isBasicInfoMod = extracted.intent === 'modification' && extracted.modificationTarget && (String(extracted.modificationTarget).includes('企业基本信息') || String(extracted.modificationTarget).includes('基本信息'));
      const hasCurrentBasicInfo = hasTask1BasicInfoFields(problemDetailConfirmedBasicInfo || __appState.currentProblemDetailItem?.basicInfo);
      const isBasicInfoProvide = (extracted.intent === 'modification' || extracted.taskId === 'task1') && !hasCurrentBasicInfo;
      const isModificationWithLlm = extracted.intent === 'modification' && extracted.modificationClear === true && !isBasicInfoProvide;
      if (isModificationWithLlm) {
        const item = __appState.currentProblemDetailItem;
        const container = el.problemDetailChatMessages;
        const workspaceContainer = el.problemDetailContent;
        const taskId = extracted.taskId || '';
        const modTarget = String(extracted.modificationTarget || '');
        const isValueStreamMod = ['task4', 'task5', 'task6'].includes(taskId) || modTarget.includes('价值流') || modTarget.includes('环节') || modTarget.includes('痛点') || modTarget.includes('IT现状');
        const parsingBlock = document.createElement('div');
        parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
        parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在综合修改…</span></div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
        container?.appendChild(parsingBlock);
        container.scrollTop = container.scrollHeight;
        requestAnimationFrame(async () => {
          const sb = el.problemDetailChatSend;
          if (sb) sb.disabled = true;
          try {
            let applied = false;
            let usage = {};
            let model = DEEPSEEK_MODEL;
            let durationMs = 0;
            let positionDesc = '';
            if (isValueStreamMod && item?.valueStream && !item.valueStream.raw) {
              const multiResult = await analyzeMultiModificationForValueStream(extracted, item);
              if (multiResult && multiResult.updates.length > 0) {
                parsingBlock.remove();
                pushOperationToHistory(item.createdAt, 'modification', JSON.parse(JSON.stringify(item)), __appState.problemDetailChatMessages.length);
                applied = applyValueStreamUpdates(item, multiResult.updates);
                usage = multiResult.usage || {};
                model = multiResult.model || DEEPSEEK_MODEL;
                durationMs = multiResult.durationMs || 0;
                positionDesc = `价值流 ${multiResult.updates.length} 处已分别更新`;
              }
            }
            if (!applied) {
              const positionInfo = getCurrentContentAtModificationTarget(extracted, item);
              if (positionInfo) {
                if (!parsingBlock.parentNode) container?.appendChild(parsingBlock);
                const singleResult = await executeModificationIntent(extracted, positionInfo);
                parsingBlock.remove();
                pushOperationToHistory(item.createdAt, 'modification', JSON.parse(JSON.stringify(item)), __appState.problemDetailChatMessages.length);
                applied = applyModificationToWorkspace(extracted, singleResult.newContent, positionInfo, item);
                usage = singleResult.usage || {};
                model = singleResult.model || DEEPSEEK_MODEL;
                durationMs = singleResult.durationMs || 0;
                positionDesc = positionInfo.positionDesc;
              } else {
                parsingBlock.remove();
              }
            }
            if (applied) {
              renderProblemDetailContent();
              workspaceContainer?.querySelectorAll('.modify-target-highlight').forEach((node) => node.classList.remove('modify-target-highlight'));
              const llmMeta = buildLlmMetaHtml({ usage, model, durationMs });
              const doneBlock = document.createElement('div');
              doneBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsed';
              doneBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">修改已应用：${escapeHtml(positionDesc)}</div><span class="problem-detail-chat-check" aria-hidden="true">✅</span></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>${llmMeta}`;
              container?.appendChild(doneBlock);
              pushAndSaveProblemDetailChat({ role: 'system', content: '修改已应用：' + positionDesc, timestamp: getTimeStr(), hasCheck: true, llmMeta: { usage, model, durationMs } });
            } else {
              const errBlock = document.createElement('div');
              errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
              errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">修改应用失败：无法更新目标位置</div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>`;
              container?.appendChild(errBlock);
              pushAndSaveProblemDetailChat({ role: 'system', content: '修改应用失败：无法更新目标位置', timestamp: getTimeStr() });
            }
            container.scrollTop = container.scrollHeight;
          } catch (err) {
              parsingBlock.classList.remove('problem-detail-chat-msg-parsing');
              parsingBlock.querySelector('.problem-detail-chat-msg-content-wrap').innerHTML = `<div class="problem-detail-chat-msg-content">修改失败：${escapeHtml(err.message || String(err))}</div>`;
              pushAndSaveProblemDetailChat({ role: 'system', content: '修改失败：' + (err.message || String(err)), timestamp: getTimeStr() });
            } finally {
              if (sb) sb.disabled = false;
            }
          });
      }
      const lastUserMsg = __appState.problemDetailChatMessages.filter((m) => m.role === 'user').pop();
      const textToParse = (userText || lastUserMsg?.content || '').trim();
      const useBasicInfoParseFlow = (isBasicInfoMod || isBasicInfoProvide) && textToParse && (isBasicInfoProvide || extracted.modificationClear !== true);
      if (useBasicInfoParseFlow) {
        const item = __appState.currentProblemDetailItem;
        requestAnimationFrame(async () => {
          const sb = el.problemDetailChatSend;
          if (sb) sb.disabled = true;
          try {
            const { parsed, usage, model, durationMs, fullPrompt, rawOutput } = await window.parseCompanyBasicInfoInput(textToParse);
            problemDetailConfirmedBasicInfo = parsed;
            if (item?.createdAt) {
              updateDigitalProblemBasicInfo(item.createdAt, parsed, false);
              __appState.currentProblemDetailItem = { ...item, basicInfo: parsed };
            }
            pushAndSaveProblemDetailChat({
              ...window.buildTask1LlmQueryMessage({
                noteName: '工商信息提炼',
                fullPrompt,
                parsed,
                rawOutput,
                timestamp: getTimeStr(),
                usage,
                model,
                durationMs,
              }),
            });
            const cardBlock = document.createElement('div');
            cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-card-collapsible';
            const labels = [
              { key: 'company_name', label: '公司名称' }, { key: 'credit_code', label: '信用代码' }, { key: 'legal_representative', label: '法人' },
              { key: 'established_date', label: '成立时间' }, { key: 'registered_capital', label: '注册资本' }, { key: 'is_listed', label: '是否上市' },
              { key: 'listing_location', label: '上市地' }, { key: 'business_scope', label: '经营范围' }, { key: 'core_qualifications', label: '核心资质' }, { key: 'official_website', label: '官方网站' },
            ];
            const rows = labels.map(({ key, label }) => {
              const value = (parsed[key] != null ? String(parsed[key]).trim() : '') || '—';
              return `<div class="problem-detail-basic-info-row"><span class="problem-detail-basic-info-label">${escapeHtml(label)}</span><span class="problem-detail-basic-info-value">${escapeHtml(value)}</span></div>`;
            }).join('');
            const llmMetaHtml = buildLlmMetaHtml({ usage, model, durationMs });
            cardBlock.innerHTML = `<div class="problem-detail-basic-info-card" role="button" tabindex="0"><div class="problem-detail-basic-info-card-body">${rows}</div><div class="problem-detail-basic-info-card-actions"><button type="button" class="btn-confirm-basic-info btn-confirm-primary" data-json="${String(JSON.stringify(parsed)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}">确认</button><button type="button" class="btn-redo-basic-info">重做</button><button type="button" class="btn-refine-modify">修正</button><button type="button" class="btn-refine-discuss">讨论</button></div></div><div class="problem-detail-chat-msg-time">${getTimeStr()}</div>${llmMetaHtml}`;
            el.problemDetailChatMessages?.appendChild(cardBlock);
            pushAndSaveProblemDetailChat({ role: 'system', type: 'basicInfoCard', data: parsed, timestamp: getTimeStr(), confirmed: false, llmMeta: { usage, model, durationMs } });
            cardBlock.dataset.msgIndex = String(__appState.problemDetailChatMessages.length - 1);
            cardBlock.dataset.taskId = 'task1';
            setupProblemDetailChatCardToggle(cardBlock);
            renderProblemDetailContent();
            updateProblemDetailChatHeaderLabel();
          } catch (_) {}
          finally { if (sb) sb.disabled = false; }
        });
      }
    } catch (_) {}
    return;
  }
  const redoBasicInfoBtn = e.target.closest('.btn-redo-basic-info');
  if (redoBasicInfoBtn && !redoBasicInfoBtn.disabled) {
    const card = redoBasicInfoBtn.closest('[data-msg-index]');
    const item = __appState.currentProblemDetailItem;
    if (!card || !item?.createdAt || !hasAiConfig()) return;
    const idx = parseInt(card.getAttribute('data-msg-index'), 10);
    if (isNaN(idx) || idx < 0 || idx >= __appState.problemDetailChatMessages.length) return;
    let textToParse = '';
    for (let i = idx - 1; i >= 0; i--) {
      const m = __appState.problemDetailChatMessages[i];
      if (m.role === 'user') { textToParse = (m.content || '').trim(); break; }
      if (m.type === 'intentExtractionCard' && m.userText) { textToParse = (m.userText || '').trim(); break; }
    }
    if (!textToParse) return;
    redoBasicInfoBtn.disabled = true;
    const labels = [
      { key: 'company_name', label: '公司名称' }, { key: 'credit_code', label: '信用代码' }, { key: 'legal_representative', label: '法人' },
      { key: 'established_date', label: '成立时间' }, { key: 'registered_capital', label: '注册资本' }, { key: 'is_listed', label: '是否上市' },
      { key: 'listing_location', label: '上市地' }, { key: 'business_scope', label: '经营范围' }, { key: 'core_qualifications', label: '核心资质' }, { key: 'official_website', label: '官方网站' },
    ];
    requestAnimationFrame(async () => {
      try {
        const { parsed, usage, model, durationMs, fullPrompt, rawOutput } = await window.parseCompanyBasicInfoInput(textToParse);
        problemDetailConfirmedBasicInfo = null;
        const messages = __appState.problemDetailChatMessages;
        if (idx >= 0 && idx < messages.length && messages[idx].type === 'basicInfoCard') {
          messages[idx] = { ...messages[idx], data: parsed, confirmed: false, llmMeta: { usage, model, durationMs } };
          saveProblemDetailChat(item.createdAt, messages);
        }
        pushAndSaveProblemDetailChat({
          ...window.buildTask1LlmQueryMessage({
            noteName: '工商信息提炼',
            fullPrompt,
            parsed,
            rawOutput,
            timestamp: getTimeStr(),
            usage,
            model,
            durationMs,
          }),
        });
        const container = el.problemDetailChatMessages;
        if (container) {
          container.innerHTML = '';
          renderProblemDetailChatFromStorage(container, messages);
          container.scrollTop = container.scrollHeight;
        }
        renderProblemDetailContent();
        updateProblemDetailChatHeaderLabel();
      } catch (_) {}
      finally { redoBasicInfoBtn.disabled = false; }
    });
    return;
  }
  const btn = e.target.closest('.btn-confirm-basic-info');
  if (btn && btn.dataset.json) {
    try {
      const data = JSON.parse(btn.dataset.json);
      disableTask1BasicInfoCardActionButtons(btn);
      // 与 AGENTS「FE-20260329-10」一致：先完成工商链路再下发「请反馈客户的基本需求」，完工确认改在初步需求链路末尾（如 completeTask1PreliminaryFeedbackDone / runtime）
      finalizeTask1BasicInfoConfirmAndPromptPreliminaryRequirement(data);
    } catch (_) {}
  }

}

function __ensureProblemDetailRuntimeHostMounted() {
  const pdr = globalThis.SmartCto?.problemDetailRuntime;
  if (!pdr || typeof pdr.initProblemDetailRuntime !== 'function') {
    throw new Error('[main] SmartCto.problemDetailRuntime 未就绪，请确认已加载 js/core/problem-detail-runtime.js');
  }
  if (pdr.__host) return;
  pdr.initProblemDetailRuntime(__buildProblemDetailRuntimeHost());
}

/** Phase 3B：__host 对象；末尾 bootstrap 与 render/send bridge 幂等挂载（避免末尾 init 未跑完时早注册的列表点击仍可进详情） */
function __buildProblemDetailRuntimeHost() {
  return {
    el,
    getProblemDetailViewingMajorStage: () => problemDetailViewingMajorStage,
    setProblemDetailViewingMajorStage: (v) => {
      problemDetailViewingMajorStage = v;
    },
    getItStrategyPlanViewingSubstep: () => itStrategyPlanViewingSubstep,
    getItGapViewingSubstep: () => itGapViewingSubstep,
    getProblemDetailConfirmedBasicInfo: () => problemDetailConfirmedBasicInfo,
    getProblemDetailWaitingForFeedback: () => problemDetailWaitingForFeedback,
    setProblemDetailWaitingForFeedback: (v) => {
      problemDetailWaitingForFeedback = v;
    },
    getProblemDetailChatMode: () => problemDetailChatMode,
    PROBLEM_DETAIL_MAJOR_STAGE_LABELS,
    ASK_CONTEXT_MAX_PER_BLOCK,
    BMC_FIELDS,
    DELETE_CHAT_MSG_ICON,
    FOLLOW_TASKS,
    ITGAP_HISTORY_TASKS,
    IT_STRATEGY_TASKS,
    REQUIREMENT_LOGIC_SECTIONS,
    appendProblemDetailChatMessage,
    buildCoreBusinessObjectChecklistCardHtml,
    buildCoreBusinessObjectStepViewHtml,
    buildGlobalItGapWorkspacePhaseSubcardsHtml,
    buildLegacyRolePermissionHeaderDeducedHtml,
    buildLlmMetaHtml,
    buildLocalItGapMarkdown,
    buildLocalItGapStructuredHtml,
    buildPreliminaryCardRowsHtml,
    buildPreliminaryWorkspaceSectionTabsHtml:
      typeof globalThis.buildPreliminaryWorkspaceSectionTabsHtml === 'function'
        ? globalThis.buildPreliminaryWorkspaceSectionTabsHtml
        : undefined,
    buildPreliminaryStructuredJsonString:
      typeof globalThis.buildPreliminaryStructuredJsonString === 'function'
        ? globalThis.buildPreliminaryStructuredJsonString
        : undefined,
    buildPreliminaryHistoryHtml,
    buildRolePermissionNodeCardsHtml,
    buildRolePermissionRegistryCardHtml,
    buildRolePermissionStepHeaderDeducedHtml,
    buildRolePermissionStepViewHtml,
    // 仓库内可能未定义（历史仅 typeof 防护）；禁止裸标识符以免 ReferenceError
    buildStaticAnchorCardHtml:
      typeof globalThis.buildStaticAnchorCardHtml === 'function' ? globalThis.buildStaticAnchorCardHtml : undefined,
    buildTask1LlmQueryMessage,
    buildTask2LlmQueryMessage,
    buildTaskTimelineContextForLLM,
    getCompactTimelineOptsForHeavySessionTask,
    buildWorkflowAlignDisplayValueStream,
    ensureCoreBusinessObjectAllDoneBlockIfNeeded,
    ensureItDesignSupplementAllDoneConfirmAfterChatHydrate,
    ensureLlmResumeIntentIfNeeded,
    escapeHtml,
    executeAskModeDirectQuery,
    extractCausalChainNodesFromLogicSummary,
    extractModificationIntentWithLLM,
    feRolePermissionLog,
    focusWorkspaceOnUserQuestion,
    generateBmcFromBasicInfoWithFeedback,
    getBaseBmcData,
    getBmcDiscussionHistory,
    getCoreBusinessObjectEntityCountForWorkspaceStep,
    getDigitalProblemPersistKey,
    resolveE2eTransactionFlowJsonForWorkspace,
    renderE2eBpmTransactionFlowHTML:
      typeof globalThis.renderE2eBpmTransactionFlowHTML === 'function'
        ? globalThis.renderE2eBpmTransactionFlowHTML
        : undefined,
    buildE2eBpmTransactionFlowPreviewDiagramHTML:
      typeof globalThis.buildE2eBpmTransactionFlowPreviewDiagramHTML === 'function'
        ? globalThis.buildE2eBpmTransactionFlowPreviewDiagramHTML
        : undefined,
    getFirstUncompletedTask,
    getGlobalItGapCompressedJsonForWorkspace,
    getLatestConfirmedRolePermissionContent,
    getLocalItGapCompressedJsonForWorkspace,
    getProblemDetailChatStorageKey,
    getProblemDetailChats,
    getRolePermissionRegistryForDisplay,
    getRolePermissionStepJsonForWorkspace,
    getTimeStr,
    TASK1_PRELIM_SUPPLEMENT_MODIFY_PROMPT,
    hasAiConfig,
    hasTask1BasicInfoFields,
    isTaskCompleted,
    logCoreBusinessObject,
    looksLikeTask1BasicInfoInput,
    mergeCoreBusinessObjectChecklistByIdentity,
    mergeDigitalProblemPatch,
    normalizeCoreBusinessObjectFromStrictOutput,
    normalizeGlobalItGapAnalysisShape,
    parseCompanyBasicInfoInput,
    parseCoreBusinessObjectModel,
    parseRequirementLogicFromMarkdown,
    parseRolePermissionModel,
    parseValueStreamGraph,
    persistTask1InitialLlmQueryForItem,
    pushAndSaveProblemDetailChat,
    renderEndToEndFlowHTML,
    renderMarkdown,
    renderMarkdownBold,
    renderProblemDetailChatFromStorage,
    renderProblemDetailHistory,
    renderRequirementWorkspaceFieldValueHtml,
    renderValueStreamViewHTML,
    requestRefinementFromFeedback,
    runTask1PreliminarySupplementRefinement,
    runTask1PreliminarySupplementModifyWithFeedback,
    resolveMergedCoreBusinessObjectSessions,
    resolveItDesignSupplementSessionsForTask8,
    resolveProblemItemForTaskNotification,
    resolveValueStreamForItGap,
    resolveValueStreamForWorkflowAlignWorkspace,
    runBmcDiscussionTurn,
    saveProblemDetailChat,
    showTaskCompletionConfirm,
    setupGlobalItGapSubcardToggle,
    setupGlobalItGapWorkspaceDimensionTabs,
    setupItDesignBpmFlowDrawTabs,
    setupPreliminaryHistoryItemToggle,
    setupProblemDetailCardToggle,
    setupProblemDetailChatCardToggle,
    setupProblemDetailE2eFlowFullscreen,
    setupProblemDetailPreliminaryFullscreen,
    setupProblemDetailBmcWorkspace,
    setupProblemDetailItDesignSupplementFullscreen,
    setupProblemDetailE2eBpmTxPreview,
    setupProblemDetailValueStreamTabs,
    shouldHideE2eFlowWorkspaceUntilTaskStart,
    syncProblemDetailWorkspaceToCanonicalTask,
    updateProblemDetailChatDiscussionIndicator,
    updateProblemDetailChatHeaderLabel,
    updateProblemDetailTaskStepBar,
  };
}

// [bridge] Phase 4A — task8 / task2：`init` 须在 `problemDetailRenderer.init` 之前（`isInBmcDiscussionMode` 等即刻委托 `task2Runtime`）
globalThis.SmartCto.task8GlobalItGap.init({
  el,
  getAppState: () => __appState,
  pushAndSaveProblemDetailChat,
  saveProblemDetailChat,
  renderProblemDetailChatFromStorage,
  renderProblemDetailHistory,
  getTimeStr: () => getTimeStr(),
  showTaskCompletionConfirm,
  getTaskLists: () => ({ FOLLOW_TASKS, ITGAP_HISTORY_TASKS, IT_STRATEGY_TASKS }),
  hasAiConfig,
  getProblemDetailConfirmedBasicInfo: () => problemDetailConfirmedBasicInfo,
  updateDigitalProblemGlobalItGapConstraintBase:
    typeof globalThis.updateDigitalProblemGlobalItGapConstraintBase === 'function'
      ? globalThis.updateDigitalProblemGlobalItGapConstraintBase
      : undefined,
  getDigitalProblems,
  renderProblemDetailContent,
  fetchDeepSeekChat:
    typeof fetchDeepSeekChat === 'function' ? fetchDeepSeekChat : globalThis.fetchDeepSeekChat,
  escapeHtml,
  renderMarkdown,
});

// [bridge] task7 端到端事务流：实现体在 `js/task7-e2e-transaction-flow.js`；须早于 `__ensureProblemDetailRuntimeHostMounted`
globalThis.SmartCto.task7E2eTransactionFlow.init({
  getAppState: () => __appState,
  el,
  parseValueStreamGraph,
  parseStrictJsonObjectFromLlmText,
  isTaskCompleted,
  hasAiConfig,
  fetchDeepSeekChat:
    typeof fetchDeepSeekChat === 'function' ? fetchDeepSeekChat : globalThis.fetchDeepSeekChat,
  getTimeStr,
  escapeHtml,
  saveProblemDetailChat,
  pushAndSaveProblemDetailChat,
  renderProblemDetailChatFromStorage,
  renderProblemDetailContent,
  renderProblemDetailHistory,
  updateDigitalProblemE2eTransactionFlow:
    typeof updateDigitalProblemE2eTransactionFlow === 'function' ? updateDigitalProblemE2eTransactionFlow : undefined,
  updateDigitalProblemE2eRequirementScenarioSupplement:
    typeof updateDigitalProblemE2eRequirementScenarioSupplement === 'function'
      ? updateDigitalProblemE2eRequirementScenarioSupplement
      : undefined,
  getDigitalProblems,
  showTaskCompletionConfirm,
  getTaskLists: () => ({ FOLLOW_TASKS, ITGAP_HISTORY_TASKS, IT_STRATEGY_TASKS }),
  resolveValueStreamForItGap:
    typeof resolveValueStreamForItGap === 'function' ? resolveValueStreamForItGap : undefined,
  getDigitalProblemPersistKey:
    typeof getDigitalProblemPersistKey === 'function' ? getDigitalProblemPersistKey : undefined,
  getProblemDetailChatStorageKey:
    typeof getProblemDetailChatStorageKey === 'function' ? getProblemDetailChatStorageKey : undefined,
  mergeDigitalProblemPatch:
    typeof mergeDigitalProblemPatch === 'function' ? mergeDigitalProblemPatch : undefined,
});

function shouldHideE2eFlowWorkspaceUntilTaskStart(item, messages) {
  return globalThis.SmartCto.task7E2eTransactionFlow.shouldHideE2eFlowWorkspaceUntilTaskStart(item, messages);
}
function applyE2eTransactionFlowHydrationFromMessages(item, messages, _sourceTag) {
  return globalThis.SmartCto.task7E2eTransactionFlow.applyE2eTransactionFlowHydrationFromMessages(
    item,
    messages,
    _sourceTag,
  );
}
function pickRawE2eTransactionFlowJsonFromItemAndMessages(item, messages) {
  return globalThis.SmartCto.task7E2eTransactionFlow.pickRawE2eTransactionFlowJsonFromItemAndMessages(item, messages);
}
function resolveE2eTransactionFlowJsonForWorkspace(item, messages) {
  return globalThis.SmartCto.task7E2eTransactionFlow.resolveE2eTransactionFlowJsonForWorkspace(item, messages);
}
function generateE2eTransactionFlowSessionsFromValueStream(valueStream) {
  return globalThis.SmartCto.task7E2eTransactionFlow.generateE2eTransactionFlowSessionsFromValueStream(valueStream);
}
function getE2eTransactionFlowSessionsFromMessages(messages) {
  return globalThis.SmartCto.task7E2eTransactionFlow.getE2eTransactionFlowSessionsFromMessages(messages);
}
function getE2ePrelimFvsCompletenessSessionsFromMessages(messages) {
  return globalThis.SmartCto.task7E2eTransactionFlow.getE2ePrelimFvsCompletenessSessionsFromMessages(messages);
}
function runE2eTransactionFlowForNextStage(valueStream, itemOverride) {
  return globalThis.SmartCto.task7E2eTransactionFlow.runE2eTransactionFlowForNextStage(valueStream, itemOverride);
}
function runE2ePrelimFvsCompletenessForNextDomain(itemOverride) {
  return globalThis.SmartCto.task7E2eTransactionFlow.runE2ePrelimFvsCompletenessForNextDomain(itemOverride);
}

globalThis.SmartCto.initTask2CompanionRuntime({
  el,
  appState: globalThis.SmartCto.appState,
  problemDetailChat: globalThis.SmartCto.problemDetailChat,
  getProblemDetailConfirmedBasicInfo: () => problemDetailConfirmedBasicInfo,
  hasAiConfig,
  getTimeStr: () => getTimeStr(),
  buildLlmMetaHtml,
  BMC_FIELDS,
  escapeHtml,
  DELETE_CHAT_MSG_ICON,
  setupProblemDetailBmcCardToggle,
  renderProblemDetailHistory,
  renderProblemDetailChatFromStorage,
  saveProblemDetailChat,
  updateDigitalProblemBmc,
  renderProblemDetailContent,
  showTaskCompletionConfirm,
  getTaskLists: () => ({ FOLLOW_TASKS, ITGAP_HISTORY_TASKS, IT_STRATEGY_TASKS }),
  updateProblemDetailChatDiscussionIndicator,
});

// [bridge] → legacy/problem-detail-renderer.js (Phase 2B) — init 依赖须在主流程末尾、全部解析函数就绪后执行
globalThis.SmartCto.problemDetailRenderer.init({
  el,
  getProblemDetailChatMode: () => problemDetailChatMode,
  getProblemDetailViewingMajorStage: () => problemDetailViewingMajorStage,
  isInBmcDiscussionMode,
  resolveProblemItemForTaskNotification,
  getProblemDetailChatMessagesForCanonical,
  getCanonicalCurrentProblemFollowTaskState,
  getWorkspaceViewingTaskId,
  getTaskStatusText,
  isOnlineMode,
  isTaskCompleted,
  getMajorStageByTaskId,
  escapeHtml,
});

// [bridge] → core/problem-detail-chat.js (Phase 3A) — bootstrap init
problemDetailChatBridge?.init?.({
  el,
  saveProblemDetailChat,
  getProblemDetailChats,
  getTimeStr: () => getTimeStr(),
  escapeHtml: (text) => escapeHtml(text),
  renderMarkdown: (text) => renderMarkdown(text),
  getProblemDetailChatMode: () => problemDetailChatMode,
});

ensurePrelimStmFullscreenReflowListener();

// [bridge] → core/problem-detail-runtime.js (Phase 3B) — __host 须在 renderer/chat init 之后、problemDetailEvents 之前
__ensureProblemDetailRuntimeHostMounted();

installGlobalFlowExceptionCapturers();

// [bridge] → legacy/problem-detail-events.js (Phase 2B)
globalThis.SmartCto.problemDetailEvents.install({
  el,
  onProblemDetailViewClickTaskStep,
  onProblemDetailViewClickRestart,
  onBtnProblemDetailHistoryClick,
  onBtnProblemDetailRollbackClick,
  onRollbackModalOverlayClick,
  onBtnCloseRollbackModalClick,
  onRollbackModalTaskListClick,
  onBtnCloseProblemDetailHistoryClick,
  onProblemDetailHistoryPanelClick,
  onProblemDetailBodyClick,
  onWindowPagehideProblemDetailScroll,
  onProblemDetailChatSendClick,
  onProblemDetailChatInputKeydown,
  onProblemDetailChatModeTriggerClick,
  onProblemDetailChatModeOptionAgentClick,
  onProblemDetailChatModeOptionAskClick,
  onDocumentClickCloseProblemDetailChatModeDropdown,
  onProblemDetailChatMessagesClick: handleProblemDetailChatMessagesClick,
});

// [compat] Phase 3A — 旧全局名与 `SmartCto.problemDetailChat` 双挂（navigation / task 模块等）
if (typeof window !== 'undefined') {
  window.appendProblemDetailChatMessage = appendProblemDetailChatMessage;
  window.pushAndSaveProblemDetailChat = pushAndSaveProblemDetailChat;
  window.scrollChatToTaskStartNotification = scrollChatToTaskStartNotification;
  // [compat] Phase 3B — 旧全局名与 `SmartCto.problemDetailRuntime` 双挂
  window.renderProblemDetailContent = renderProblemDetailContent;
  window.handleProblemDetailChatSend = handleProblemDetailChatSend;
  window.recordFlowExceptionTyped = recordFlowExceptionTyped;
  window.applyFlowExceptionResume = applyFlowExceptionResume;
  window.pushLlmRetryNoticeBlock = pushLlmRetryNoticeBlock;
}
