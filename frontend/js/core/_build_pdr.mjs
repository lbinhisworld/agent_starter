import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');
/** Phase 3B 生成脚本：从 **HEAD** 的 main.js 取基线片段，避免工作区 main 已改为 bridge 后行号漂移 */
const baselineMain = execSync('git show HEAD:frontend/main.js', {
  cwd: repoRoot,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const lines = baselineMain.split(/\n/);

function linesFromTo(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join('\n');
}

const stripAndFormat = linesFromTo(13351, 13438);
let handle = linesFromTo(12676, 13185);
let render = linesFromTo(13442, 14354);

const HOST = 'globalThis.SmartCto.problemDetailRuntime.__host';

function replaceAll(str, pairs) {
  let out = str;
  for (const [a, b] of pairs) {
    out = out.split(a).join(b);
  }
  return out;
}

const commonPairs = [
  ['getProblemDetailWaitingForFeedback()', '___GPFB___'],
  ['setProblemDetailWaitingForFeedback', '___SPFB___'],
  ['problemDetailWaitingForFeedback', `${HOST}.getProblemDetailWaitingForFeedback()`],
  ['___GPFB___', `${HOST}.getProblemDetailWaitingForFeedback()`],
  ['___SPFB___', `${HOST}.setProblemDetailWaitingForFeedback`],
  ['problemDetailConfirmedBasicInfo', `${HOST}.getProblemDetailConfirmedBasicInfo()`],
  ['problemDetailChatMode', `${HOST}.getProblemDetailChatMode()`],
  ['PROBLEM_DETAIL_MAJOR_STAGE_LABELS', `${HOST}.PROBLEM_DETAIL_MAJOR_STAGE_LABELS`],
  ['typeof window.runBmcDiscussionTurn === \'function\' ? window.runBmcDiscussionTurn : null', `${HOST}.runBmcDiscussionTurn`],
  ['typeof window.generateBmcFromBasicInfoWithFeedback === \'function\' ? window.generateBmcFromBasicInfoWithFeedback : null', `${HOST}.generateBmcFromBasicInfoWithFeedback`],
  ['await window.parseCompanyBasicInfoInput', `await ${HOST}.parseCompanyBasicInfoInput`],
  ['window.buildTask2LlmQueryMessage', `${HOST}.buildTask2LlmQueryMessage`],
  ['\n        ...window.buildTask1LlmQueryMessage(', `\n        ...${HOST}.buildTask1LlmQueryMessage(`],
  ['__appState', '__APPSTATE_VAR__'],
];

const HOST_NAMES = [
  'ASK_CONTEXT_MAX_PER_BLOCK',
  'BMC_FIELDS',
  'DELETE_CHAT_MSG_ICON',
  'FOLLOW_TASKS',
  'ITGAP_HISTORY_TASKS',
  'IT_STRATEGY_TASKS',
  'REQUIREMENT_LOGIC_SECTIONS',
  'buildGlobalItGapWorkspacePhaseSubcardsHtml',
  'buildLocalItGapMarkdown',
  'buildLocalItGapStructuredHtml',
  'buildPreliminaryCardRowsHtml',
  'buildPreliminaryWorkspaceSectionTabsHtml',
  'buildPreliminaryStructuredJsonString',
  'buildPreliminaryHistoryHtml',
  'extractCausalChainNodesFromLogicSummary',
  'getGlobalItGapCompressedJsonForWorkspace',
  'getLocalItGapCompressedJsonForWorkspace',
  'getProblemDetailChats',
  'hasTask1BasicInfoFields',
  'isTaskCompleted',
  'looksLikeTask1BasicInfoInput',
  'normalizeGlobalItGapAnalysisShape',
  'renderEndToEndFlowHTML',
  'renderE2eBpmTransactionFlowHTML',
  'buildE2eBpmTransactionFlowPreviewDiagramHTML',
  'resolveE2eTransactionFlowJsonForWorkspace',
  'renderMarkdownBold',
  'resolveProblemItemForTaskNotification',
  'shouldHideE2eFlowWorkspaceUntilTaskStart',
  'appendProblemDetailChatMessage',
  'buildCoreBusinessObjectChecklistCardHtml',
  'buildCoreBusinessObjectStepViewHtml',
  'buildLegacyRolePermissionHeaderDeducedHtml',
  'buildLlmMetaHtml',
  'buildRolePermissionNodeCardsHtml',
  'buildRolePermissionRegistryCardHtml',
  'buildRolePermissionStepHeaderDeducedHtml',
  'buildRolePermissionStepViewHtml',
  'buildStaticAnchorCardHtml',
  'buildTaskTimelineContextForLLM',
  'getCompactTimelineOptsForHeavySessionTask',
  'buildWorkflowAlignDisplayValueStream',
  'deleteDigitalProblemRequirementLogic',
  'escapeHtml',
  'executeAskModeDirectQuery',
  'extractModificationIntentWithLLM',
  'feRolePermissionLog',
  'focusWorkspaceOnUserQuestion',
  'getBaseBmcData',
  'getBmcDiscussionHistory',
  'getCoreBusinessObjectEntityCountForWorkspaceStep',
  'getFirstUncompletedTask',
  'getLatestConfirmedRolePermissionContent',
  'getProblemDetailChatStorageKey',
  'getRolePermissionRegistryForDisplay',
  'getRolePermissionStepJsonForWorkspace',
  'getTimeStr',
  'hasAiConfig',
  'logCoreBusinessObject',
  'mergeCoreBusinessObjectChecklistByIdentity',
  'normalizeCoreBusinessObjectFromStrictOutput',
  'parseCoreBusinessObjectModel',
  'parseRequirementLogicFromMarkdown',
  'parseRolePermissionModel',
  'parseValueStreamGraph',
  'pushAndSaveProblemDetailChat',
  'renderMarkdown',
  'renderProblemDetailChatFromStorage',
  'renderProblemDetailHistory',
  'renderValueStreamViewHTML',
  'requestRefinementFromFeedback',
  'resolveMergedCoreBusinessObjectSessions',
  'resolveValueStreamForItGap',
  'saveProblemDetailChat',
  'setupGlobalItGapSubcardToggle',
  'setupGlobalItGapWorkspaceDimensionTabs',
  'setupPreliminaryHistoryItemToggle',
  'setupProblemDetailCardToggle',
  'setupProblemDetailChatCardToggle',
  'setupProblemDetailE2eFlowFullscreen',
  'setupProblemDetailBmcWorkspace',
  'setupProblemDetailPreliminaryFullscreen',
  'setupProblemDetailItDesignSupplementFullscreen',
  'setupProblemDetailE2eBpmTxPreview',
  'setupProblemDetailValueStreamTabs',
  'showError',
  'syncProblemDetailWorkspaceToCanonicalTask',
  'updateProblemDetailChatDiscussionIndicator',
  'updateProblemDetailChatHeaderLabel',
  'updateProblemDetailTaskStepBar',
];

/** 将 main 侧符号改为 $().fn；跳过已在 xxx.name 访问链中的 name（避免破坏 __host.xxx） */
function hostify(src) {
  let out = src;
  for (const name of [...HOST_NAMES].sort((a, b) => b.length - a.length)) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<!\\.)\\b${esc}\\b`, 'g');
    out = out.replace(re, () => '$().' + name);
  }
  return out;
}

const renderPairs = [
  ...commonPairs.filter((p) => !String(p[0]).includes('window')),
  ['problemDetailViewingMajorStage', '__PDVMS__'],
  ['itStrategyPlanViewingSubstep', '__ITSPS__'],
];

let renderBody = render.replace(/^function renderProblemDetailContent\(\) \{\r?\n/, '');
renderBody = renderBody.replace(/\r?\n\}\s*$/m, '');
renderBody = replaceAll(renderBody, renderPairs);
renderBody = renderBody.split('__APPSTATE_VAR__').join('__appState');
renderBody = renderBody.split('__PDVMS__').join('problemDetailViewingMajorStage');
renderBody = renderBody.split('__ITSPS__').join('itStrategyPlanViewingSubstep');

const preClamp =
  `  const $ = __pdrHost;
  const __appState = globalThis.SmartCto.appState.getState();
  let problemDetailViewingMajorStage = $().getProblemDetailViewingMajorStage();
  const itStrategyPlanViewingSubstep = $().getItStrategyPlanViewingSubstep();
  const itGapViewingSubstep = $().getItGapViewingSubstep();
  const el = $().el;
`;

const indent = (s) =>
  s
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n');

const clampPatch =
  `  {
    const n = Number(problemDetailViewingMajorStage);
    if (Number.isFinite(n)) {
      problemDetailViewingMajorStage = Math.max(0, Math.min(3, n));
      $().setProblemDetailViewingMajorStage(problemDetailViewingMajorStage);
    }
  }
`;

renderBody = renderBody.replace(
  /  \{\r?\n    const n = Number\(problemDetailViewingMajorStage\);\r?\n    if \(Number\.isFinite\(n\)\) problemDetailViewingMajorStage = Math\.max\(0, Math\.min\(3, n\)\);\r?\n  \}\r?\n/,
  clampPatch,
);

const renderWindowFnPairs = [
  [
    "typeof window.buildPreliminaryCardRowsHtml === 'function' ? window.buildPreliminaryCardRowsHtml",
    'typeof __pdrHost().buildPreliminaryCardRowsHtml === \'function\' ? __pdrHost().buildPreliminaryCardRowsHtml',
  ],
  [
    "typeof window.buildPreliminaryHistoryHtml === 'function' ? window.buildPreliminaryHistoryHtml",
    'typeof __pdrHost().buildPreliminaryHistoryHtml === \'function\' ? __pdrHost().buildPreliminaryHistoryHtml',
  ],
  [
    "typeof window.renderRequirementWorkspaceFieldValueHtml === 'function'",
    'typeof __pdrHost().renderRequirementWorkspaceFieldValueHtml === \'function\'',
  ],
  ['? window.renderRequirementWorkspaceFieldValueHtml', '? __pdrHost().renderRequirementWorkspaceFieldValueHtml'],
  [
    "typeof window.renderMarkdownBold === 'function' ? window.renderMarkdownBold",
    'typeof __pdrHost().renderMarkdownBold === \'function\' ? __pdrHost().renderMarkdownBold',
  ],
  [
    "typeof window.extractCausalChainNodesFromLogicSummary === 'function'",
    'typeof __pdrHost().extractCausalChainNodesFromLogicSummary === \'function\'',
  ],
  ['? window.extractCausalChainNodesFromLogicSummary', '? __pdrHost().extractCausalChainNodesFromLogicSummary'],
];

renderBody = replaceAll(renderBody, renderWindowFnPairs);
renderBody = renderBody.replace(
  /typeof window !== 'undefined' && typeof window\.getComputedStyle === 'function'/g,
  'typeof __pdrHost().getComputedStyle === \'function\'',
);
renderBody = renderBody.replace(/window\.getComputedStyle\(/g, '__pdrHost().getComputedStyle(');

renderBody = hostify(renderBody);

handle = replaceAll(handle, commonPairs);
handle = handle.split('__APPSTATE_VAR__').join('globalThis.SmartCto.appState.getState()');

if (!handle.includes('const $ = __pdrHost')) {
  handle = handle.replace(
    /^async function handleProblemDetailChatSend\(options\) \{/,
    `async function handleProblemDetailChatSend(options) {
  const $ = __pdrHost;
  const el = $().el;
  const itStrategyPlanViewingSubstep = $().getItStrategyPlanViewingSubstep();`,
  );
}

handle = hostify(handle);
handle = handle.replace(
  /globalThis\.SmartCto\.problemDetailRuntime\.__host\.getProblemDetailWaitingForFeedback\(\) = null/g,
  'globalThis.SmartCto.problemDetailRuntime.__host.setProblemDetailWaitingForFeedback(null)',
);

const renderFn = `function renderProblemDetailContent() {
${preClamp}${indent(renderBody)}
}
`;

const header = `/**
 * [INPUT]: globalThis.SmartCto.problemDetailRuntime.__host（由 main.js init 注入）
 * [OUTPUT]: renderProblemDetailContent、handleProblemDetailChatSend、hydration 恢复管道；SmartCto.problemDetailRuntime
 * [POS]: Phase 3B — 详情工作区宿主渲染与对话发送编排迁出 main.js
 *
 * [PROTOCOL]: 变更任务推进语义、消息类型或 render 宿主 DOM 结构时须同步 frontend/js/core/AGENTS.md 与主记录
 */

function __pdrHost() {
  const h = globalThis.SmartCto?.problemDetailRuntime?.__host;
  if (!h) throw new Error('[problem-detail-runtime] __host 未初始化，请先 initProblemDetailRuntime()');
  return h;
}

`;

const tail = `function applyStoredChatPostHydrationPipeline(container) {
  const $ = __pdrHost;
  const st = globalThis.SmartCto.appState.getState();
  if ($().ensureCoreBusinessObjectAllDoneBlockIfNeeded?.()) {
    $().renderProblemDetailChatFromStorage(container, st.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
  }
  if ($().ensureLlmResumeIntentIfNeeded?.()) {
    $().renderProblemDetailChatFromStorage(container, st.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
  }
}

function initProblemDetailRuntime(host) {
  globalThis.SmartCto = globalThis.SmartCto || {};
  const slot = globalThis.SmartCto.problemDetailRuntime;
  if (!slot || typeof slot !== 'object') {
    throw new Error(
      '[problem-detail-runtime] SmartCto.problemDetailRuntime 未定义；请确认 index.html 中 problem-detail-runtime.js 在 main.js 之前加载。',
    );
  }
  if (typeof slot.renderProblemDetailContent !== 'function') {
    throw new Error('[problem-detail-runtime] 模块未正确挂载 renderProblemDetailContent，请勿用空对象覆盖 SmartCto.problemDetailRuntime。');
  }
  slot.__host = host;
}

globalThis.SmartCto = globalThis.SmartCto || {};
globalThis.SmartCto.problemDetailRuntime = Object.assign(globalThis.SmartCto.problemDetailRuntime || {}, {
  initProblemDetailRuntime,
  renderProblemDetailContent,
  handleProblemDetailChatSend,
  applyStoredChatPostHydrationPipeline,
});
`;

const outPath = new URL('./problem-detail-runtime.js', import.meta.url).pathname;
const out = header + stripAndFormat + '\n\n' + renderFn + '\n\n' + handle + '\n\n' + tail;
fs.writeFileSync(outPath, out);
console.log('ok', out.length);
