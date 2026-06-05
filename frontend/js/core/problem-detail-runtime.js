/**
 * [INPUT]: globalThis.SmartCto.problemDetailRuntime.__host（由 main.js init 注入）
 * [OUTPUT]: renderProblemDetailContent、handleProblemDetailChatSend、hydration 恢复管道；SmartCto.problemDetailRuntime
 * [POS]: Phase 3B — 详情工作区宿主渲染与对话发送编排迁出 main.js
 *
 * [PROTOCOL]: 变更任务推进语义、消息类型或 render 宿主 DOM 结构时须同步 frontend/js/core/AGENTS.md 与主记录；ITGap 子步 1 用户可见结构与不透明实现约束见 `docs/design/it-design-supplement-workspace.md`
 * task1 对话发送路由（awaitingPrelim / 阶段查询门禁 / 深度提炼后跟进卡片）业务口径对齐 commit 9f25d68，经 __host 注入 merge/persist/show 等依赖；**FE-20260331**：刷新丢失 `prelimSupplement` 等待态时，若仍存在未收官的 `preliminaryRequirementFollowupBlock`，输入框须路由 `runTask1PreliminarySupplementRefinement`，避免 Agent 误提示仅用卡片按钮；**FE-20260409**：`prelimSupplementModify` + `TASK1_PRELIM_SUPPLEMENT_MODIFY_PROMPT` 路由 `runTask1PreliminarySupplementModifyWithFeedback`（聊天区引导，无浏览器 prompt）；**FE-20260331-13**：`hasV2Prelim`/跟进期判定须与 `buildResolvedPreliminaryRequirement` 一致（含 `basicInfo.__createContractExtras` 与后端顶层 `preliminaryReq` 抬升修复）。**FE-20260331-14**：`isTask1ActivePreliminaryFollowupPhase` 须 `const $ = __pdrHost` 再 `$()`，禁止 `const $ = __pdrHost()` 后再 `$()`（否则 `$ is not a function`）。
 * FE-20260330-9：初步需求工作区卡须加 `problem-detail-card-preliminary-tabs`，三 Tab（view / json / 历史详情）与 `main.js` setupProblemDetailCardToggle 一致；view 用 `buildPreliminaryWorkspaceSectionTabsHtml`（横向子 Tab + 分区 JSON），json 用 `buildPreliminaryStructuredJsonString`（V2 顶层键全量 JSON）；勿再用双 Tab+`buildPreliminaryCardRowsHtml` 导致与既有 Tab 绑定脱节。**FE-20260409-8**：标题栏最右 **全屏**（`.problem-detail-card-preliminary-fs-btn`）+ `setupProblemDetailPreliminaryFullscreen`（`problem-detail-chat.js`）。
 * FE-20260330-23：task1 深度提炼落库 `requirementDetailHistory` 经 `buildRequirementDetailHistoryEntry`（RQ 编号由渲染侧按序生成，条目含 title）。
 * FE-20260410：历史详情每条 **删除** 由 `main.js` `deletePreliminaryHistoryItemAt` 写回存储并重绘；`setupPreliminaryHistoryItemToggle` 仅将展开/收起绑在 `.preliminary-history-item-header-main`。
 * FE-20260330-24：`renderProblemDetailContent` 在顶栏工具条下刷新 `#problemDetailCaseHeadline`（`buildCaseRequirementHeadlineParts` → `客户名称｜需求标题`）。
 * **FE-20260331-52**：工作流对齐阶段工作区**不再展示**「价值流设计逻辑」卡片，仅保留价值流图 + json Tab；`valueStreamLogicText*` 仍落库，聊天区 `valueStreamCard` 的 `logicText` 不受影响。
 * **FE-20260331-53**：价值流卡标题栏右侧「全屏」按钮 HTML（`problem-detail-value-stream-fs-btn`），全屏目标为整块 `.problem-detail-value-stream-card`；绑定见 `problem-detail-chat.js`。**FE-20260405-03**：全屏左侧「下载图」`problem-detail-value-stream-download-btn`，导出当前价值流图为 PNG（`problem-detail-chat.js`）。**FE-20260416-ws-json**：「下载图」右侧「下载 json」`problem-detail-workspace-json-download-btn[data-workspace-json-kind="value-stream"]`。
 * **FE-20260401-07**：ITGap「端到端事务流」卡标题栏右侧「全屏」（`problem-detail-e2e-flow-fs-btn`），整块 `.problem-detail-card-e2e-flow`；`setupProblemDetailE2eFlowFullscreen` 见 `problem-detail-chat.js`。**FE-20260408-e2e-dl**：标题栏三列网格——左标题、中 view｜json、右「下载图」（`problem-detail-e2e-flow-download-btn`，样式同价值流下载钮）+ 全屏；导出逻辑见 `problem-detail-chat.js`（下载时临时全屏以匹配全屏工作区布局截图）。**FE-20260416-ws-json**：主「端到端事务流」卡「下载图」与全屏之间「下载 json」`data-workspace-json-kind="e2e-flow"`；IT设计补齐卡全屏左侧同 class + `it-design-supplement`。**FE-20260409**：ITGap 子步 1「IT设计补齐」卡（`.problem-detail-card-it-design-supplement`）标题栏右侧「全屏」`problem-detail-it-design-supplement-fs-btn`（与端到端全屏钮同套样式类）；`setupProblemDetailItDesignSupplementFullscreen`；`main.js` `setupProblemDetailCardToggle` 对该钮 `stopPropagation`。**FE-20260409-it-fs-scope**：`itDesignFsBtnHtml` 须与占位 `itDesignWorkspacePlaceholder` 同作用域（在 `if (igSub===1)` 外声明），避免占位路径 `ReferenceError`。
 * **FE-20260403-18**：ITGap 大阶段工作区按顶栏子步骤分页——`itGapViewingSubstep` 0 仅「端到端事务流」、1 仅「IT设计补齐」、2 仅「对象状态机构建」；确认 `globalItGapStartBlock` 后 `main.js` 将子步骤切至 1 并刷新；`.problem-detail-workspace-scroll` 带 `data-itgap-workspace-sub`。
 * **FE-20260402**：task7 工作区 view/json：`resolveE2eTransactionFlowJsonForWorkspace`（`stages[].stage_name` 与 Session 计划 `stageName`/价值流阶段对齐）+ `renderE2eBpmTransactionFlowHTML`（`stages` + `transaction_nodes` 或仅扁平 `transaction_nodes`；阶段内事务卡纵向满宽左对齐；**每张事务节点卡**无内层 json Tab（**角色 chip 在标题栏名称后**以 **｜** 分隔；正文仅 BPM 节点以蓝色 → 间隔；单节点 JSON 见外层 **json** Tab）；**全页首张卡默认展开、其余默认折叠**（`.e2e-bpm-tx-node-collapse-btn`）；端到端主卡顶栏 **view｜json**（无压缩 Tab）；`setupProblemDetailE2eBpmTxPreview` 绑定成图预览抽屉与折叠；`setupProblemDetailCardToggle` 的 e2e 分支 `data-tab="view"`。**FE-20260403-11**：`e2eTransactionFlowSessionsBlock` 仅保留「自动顺序执行」入口（无手动逐项）。**FE-20260401-41**：空态/JSON 引导与聊天区 Session 计划流程一致。**FE-20260409**：价值流阶段事务流全部生成后聊天区下发 `e2ePrelimFvsCompletenessSessionsBlock`；子步 0 下主卡「端到端事务流」后追加 **需求场景事务流补齐** 卡（`item.e2eRequirementScenarioSupplementJson`）。**FE-20260412**：类目补齐每轮落库后即刷新该卡，不必等全部类目。**FE-20260403-16**：确认端到端 JSON 后不再触发全景观压缩 LLM、不推送 `e2eFlowCompressionStartBlock` / `e2eFlowCompressionBlock`；`updateDigitalProblemE2eFlowLandscape(..., undefined)` 清历史 `e2eFlowLandscapeJson`。
 * **FE-20260411**：task9「对象状态机构建」第三子步：顶栏 **view｜json**（与端到端卡同系），view 为 `object-state-machine-viz.js` 的 SVG 状态机；json 为完整源码；任务启动确认后由 `main.js` 调 LLM 写入 `objectStateMachineJson`。
 * **FE-20260415**：task9 顶栏 **Json-View｜Mermaid-View｜json｜mermaid**：Json-View 为 SVG；Mermaid-View 渲染根字段 `mermaid_diagram`；json / mermaid 为源码 Tab（json 展示不含 `mermaid_diagram` 的结构化 JSON）。
 * **FE-20260403-20**：该字段若为 JSON 字符串（部分接口/历史数据）先解析再参与 `typeof === 'object'` 门控，避免工作区空白。
 * **FE-20260407**：`resolveValueStreamForWorkflowAlignWorkspace`（`main.js` 注入）在 bundle 覆盖或字段缺失时从聊天 `valueStreamCard` 回填；刷新链路 `applyValueStreamHydrationFromMessages`。**FE-20260407-bpm**：task8 IT设计补齐 V1 下，若仅有聚合 `globalItGapAnalysisJson.transactions[]` 而无内存 session，则从 `transactions[].bpm_flow_diagram_markdown` 回填各事务行的 `bpmFlowDrawMarkdown`，供 `buildItDesignSupplementTransactionViewHtml` 第四折叠「流程图绘制」展示。**FE-20260408-itgap-bpm-cols**：IT设计补齐事务子卡渲染时 `resolveE2eTransactionFlowJsonForWorkspace` + `getBpmDetailedFlowForItDesignSession` 注入 ITGap 表「节点描述」「逻辑」列。**FE-20260407-refresh-it-design-confirm**：刷新后 __host `ensureItDesignSupplementAllDoneConfirmAfterChatHydrate`：未写 v1 聚合、未推旧版 `itDesignBpmDrawSessionsBlock` 时，若 `itDesignSupplementSessionsBlock.interleavedBpmDrawPlan` 则须各事务设计+BPM 均齐才补发收尾块，否则仍可在「仅设计齐」时补发（旧计划）。**FE-20260407-b**：task4「请修改」首轮改为 Mirror/加固各一轮提示词修订时，向过程日志推两条 `modificationRegenerateLlmQueryBlock`（`promptRevisionOnly`，**LLM-修改**）；`modificationNewPromptConfirmBlock` 带 `task4Mirror*`/`task4Hardening*` 分阶段字段。**FE-20260408-it-design-workspace**：ITGap 子屏 1「IT设计补齐」卡 `isItDesignV1` 须含 `item.itDesignSupplementSessions.length > 0`，以便已下发 Session 计划即可渲染各事务子卡（无产出为「待执行」），与左侧聊天进度同步。**FE-20260408-it-design-workspace-resolve**：事务行列表须经 __host `resolveItDesignSupplementSessionsForTask8(item, msgs)` 解析（与聊天 `itDesignSupplementSessionsBlock` / 列表缓存同源），避免 `currentProblemDetailItem` 暂未带上 sessions 时子卡列表空白。**FE-20260408-bpm-flow-tabs**：子屏 1 渲染后调用 __host `setupItDesignBpmFlowDrawTabs(container)`，绑定各事务「流程图绘制」view｜code 与 Mermaid 挂载。
 * **FE-20260403-task9-debug**：`globalThis.__FE_TASK9_PORTAL_DEBUG === true` 时 `console.debug('[FE:task9-portal]', …)` 输出 ITGap 子屏诊断（门户卡已下线，仅余 workspace-render 等）。
 * **FE-20260403**：独立 task10 编排下线；`applyStoredChatPostHydrationPipeline` 不再调用 `ensureTask10RefreshNotificationIfNeeded`。
 * **FE-20260403-27**：需求理解工作区「客户基本信息」卡默认折叠；view/json 仅渲染非空字段（无则空态提示）。
 * **FE-20260415-bmc-ws**：需求理解工作区「商业模式画布 BMC」九宫格为每行 3 列圆角子卡片、格内要点列表；**九宫格子卡**样式见 `styles.css`（深色底 `#0d1117`、金棕描边、顶栏棕底 `#2d2418`、标题橙 `#f2a154`）；行业洞察/业务痛点为全宽条卡（浅底、标题蓝）；`item.preliminaryReq.coreBusinessEntities` 与「核心业务对象」经 `applyBmcCoreObjectHighlights` 绿色强调。
 * **FE-20260416-bmc-ws-ui**：BMC 卡标题栏「下载图」+ 全屏；view 外包 `.problem-detail-bmc-capture-root` 供 PNG；`setupProblemDetailBmcWorkspace`（`problem-detail-chat.js`）。
 * **FE-20260416-logic-ws**：需求理解工作区「需求逻辑」卡四章节为 `.problem-detail-logic-ws-stack` 下圆角条卡 `.problem-detail-logic-ws-strip`，标题 `.problem-detail-bmc-ws-cell-title` + `buildBmcWsBulletLisFromRaw` 要点列表；「逻辑链条总结」多因果节点时条卡内保留 `.problem-detail-logic-causal-chain`。
 * **FE-20260416-llm-bullet**：`splitBmcFieldToBulletSegments` 合并非要点边界换行，识别「标题：」/「一是」等新条；`promotePlainColonTitleToBoldSubtitleMarkdown` + `collapseWsBulletInnerBr` 优化 `buildBmcWsBulletLisFromRaw` 展示（绿字小标题、少 br）。
 * **FE-20260412-05**：ITGap 子步 0 端到端事务流卡：`globalThis.__FE_E2E_WORKSPACE_DEBUG === true` 时 `console.log('[FE:task7-e2e-workspace]', 'render:itgap-sub0', …)` 输出 `SmartCto.task7E2eTransactionFlow.buildE2eWorkspaceDebugSnapshot` 快照（辅助排查补齐节点不显示）。
 * **FE-20260413-e2e-nav-log**：同上 debug 开关下，ITGap 子步在**相邻两次渲染间**发生变化时追加 `itgap-substep-change`（`from`/`to`、IT设计补齐→端到端的场景 hint、`preResolveSnapshot` 便于对照「返回端到端后补齐 BPM 消失」）。
 */

/** 上一次在 ITGap 工作区（大阶段≥2 且有价值流）渲染时的子步 0/1/2，供 `__FE_E2E_WORKSPACE_DEBUG` 检测子步切换 */
let __pdrLastRenderedMajor2ItGapSub = -1;

function __pdrHost() {
  const h = globalThis.SmartCto?.problemDetailRuntime?.__host;
  if (!h) throw new Error('[problem-detail-runtime] __host 未初始化，请先 initProblemDetailRuntime()');
  return h;
}

function __shouldLogTask1PrelimDiag() {
  try {
    if (globalThis.__FE_TASK1_PRELIM_DEBUG === false) return false;
    if (globalThis.__FE_TASK1_PRELIM_DEBUG === true) return true;
    return true;
  } catch (_) {
    return true;
  }
}

function __logTask1PrelimRender(tag, payload) {
  if (!__shouldLogTask1PrelimDiag()) return;
  try {
    console.info('[FE:task1-prelim-render]', tag, payload == null ? '' : payload);
  } catch (_) {}
}

function __logTask9Portal(phase, payload) {
  if (globalThis.__FE_TASK9_PORTAL_DEBUG !== true) return;
  try {
    console.debug('[FE:task9-portal]', phase, payload == null ? '' : payload);
  } catch (_) {}
}

/** 与初步需求工作区同源：顶层 `preliminaryReq` 或 `buildResolvedPreliminaryRequirement`（含 extras 嵌套） */
function task1HasEffectiveV2Preliminary(dataItem) {
  if (!dataItem || typeof globalThis.isPreliminaryRequirementV2Shape !== 'function') return false;
  const top = dataItem.preliminaryReq;
  if (top && typeof top === 'object' && globalThis.isPreliminaryRequirementV2Shape(top)) return true;
  if (typeof globalThis.buildResolvedPreliminaryRequirement === 'function') {
    try {
      const resolved = globalThis.buildResolvedPreliminaryRequirement(dataItem);
      return !!(resolved && globalThis.isPreliminaryRequirementV2Shape(resolved));
    } catch (_) {
      return false;
    }
  }
  return false;
}

/**
 * 是否存在「企业背景洞察」V2 初步需求跟进期：最后一条 preliminaryRequirementFollowupBlock 之后尚无 task1 taskCompleteBlock。
 * 刷新会清空 problemDetailWaitingForFeedback；须仅靠聊天恢复可输入补充修订的语义（FE-20260331）。
 */
function isTask1ActivePreliminaryFollowupPhase(messages, dataItem) {
  const $ = __pdrHost;
  if (!Array.isArray(messages) || !dataItem) return false;
  const first = $().getFirstUncompletedTask(dataItem);
  if (!first || first.id !== 'task1') return false;
  if ($().isTaskCompleted(dataItem, 'task1')) return false;
  if (!task1HasEffectiveV2Preliminary(dataItem)) return false;
  /** 自末尾向前找最近的跟进卡或「点补充更多需求」后的系统引导（持久化可能仅存其一；FE-20260331） */
  let lastMarker = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.type === 'preliminaryRequirementFollowupBlock') {
      lastMarker = i;
      break;
    }
    if (
      m?.role === 'system' &&
      typeof m.content === 'string' &&
      m.content.includes('请继续补充客户需求')
    ) {
      lastMarker = i;
      break;
    }
  }
  if (lastMarker < 0) return false;
  for (let j = lastMarker + 1; j < messages.length; j++) {
    if (messages[j]?.type === 'taskCompleteBlock' && messages[j]?.taskId === 'task1') return false;
  }
  return true;
}

function stripLeadingBmcNineGridTitleEcho(text, blockLabel) {
  let s = String(text ?? '').trim();
  const lb = String(blockLabel ?? '').trim();
  if (!s || !lb || s === '—') return s;
  const esc = lb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* 中文宫格名 + (VP)/(CS)/（CS）等英文缩写 + 可选冒号，与左侧子卡片重复 */
  const bmcParenAbbr = new RegExp(
    `^${esc}\\s*[（(]\\s*[^\\n)）*]{1,120}\\s*[）)]\\s*[：:]?\\s*`,
    '',
  );
  const bmcParenAbbrBold = new RegExp(
    `^\\*\\*${esc}\\s*[（(]\\s*[^\\n)）*]{1,120}\\s*[）)]\\*\\*\\s*[：:]?\\s*`,
    '',
  );

  let prev;
  do {
    prev = s;
    s = s
      .replace(bmcParenAbbrBold, '')
      .replace(bmcParenAbbr, '')
      .replace(new RegExp(`^\\*\\*${esc}\\*\\*\\s*[：:]?\\s*`, ''), '')
      .replace(new RegExp(`^【\\s*${esc}\\s*】\\s*[：:]?\\s*`, ''), '')
      .replace(new RegExp(`^#{1,6}\\s*${esc}\\s*[：:]?\\s*\r?\n`, ''), '')
      .replace(new RegExp(`^#{1,6}\\s*${esc}\\s*[：:]?\\s*$`, ''), '')
      .replace(new RegExp(`^${esc}\\s*[：:]\\s*`, ''), '')
      .replace(new RegExp(`^${esc}\\s*[\r\n]+`, ''), '')
      .trim();
  } while (s !== prev);

  const parenAbbrLine = new RegExp(
    `^\\s*${esc}\\s*[（(]\\s*[^\\n)）]{1,120}\\s*[）)]\\s*[：:]?\\s*$`,
    '',
  );
  const lines = s.split(/\r?\n/);
  if (lines.length > 1) {
    const first = lines[0].trim();
    if (first === lb || first === `**${lb}**` || first === `【${lb}】` || parenAbbrLine.test(first)) {
      s = lines.slice(1).join('\n').trim();
    }
  } else if (lines.length === 1) {
    const first = lines[0].trim();
    if (first === lb || first === `**${lb}**` || first === `【${lb}】` || parenAbbrLine.test(first)) {
      s = '';
    }
  }

  return s.trim();
}

/** 从初步需求提取 BMC 绿色高亮用的核心业务对象名称（去重） */
function collectBmcHighlightEntityNames(item) {
  const out = [];
  /** @param {unknown} v */
  const add = (v) => {
    const t = v != null ? String(v).trim() : '';
    if (t.length >= 2) out.push(t);
  };
  try {
    const prelim = item?.preliminaryReq;
    const ents = prelim?.coreBusinessEntities;
    if (Array.isArray(ents)) {
      for (const e of ents) {
        if (e && typeof e === 'object') {
          add(e.entityName);
          add(e.name);
          if (e.identifier != null) add(String(e.identifier));
        }
      }
    }
  } catch (_) {
    /* 忽略解析异常 */
  }
  return Array.from(new Set(out));
}

function isMarkdownOrDashBulletLine(line) {
  return /^\s*[-*•·]\s+\S/.test(line);
}

function isNumberedItemStart(line) {
  return /^\d+[\.、]\s*\S/.test(line);
}

/**
 * 无列表符时，行首像新要点：短标题+全角/半角冒号+正文、或「一是/其次」等起笔。
 */
function isLikelyNewTopicLine(line) {
  const t = String(line ?? '').trim();
  if (!t) return false;
  if (isMarkdownOrDashBulletLine(t) || isNumberedItemStart(t)) return true;
  if (/^[\u4e00-\u9fff（）\w·•]{2,40}[：:]\s*\S/.test(t)) return true;
  if (/^(?:一是|二是|三是|四是)/.test(t)) return true;
  if (/^(?:第一[，、]|第二[，、]|第三[，、]|第四[，、]|首先|其次|再者|最后)\s*\S/.test(t)) return true;
  return false;
}

function stripLineListPrefix(line) {
  const t = String(line ?? '');
  if (isMarkdownOrDashBulletLine(t)) return t.replace(/^\s*[-*•·]\s+/, '').trim();
  if (isNumberedItemStart(t)) return t.replace(/^\d+[\.、]\s*/, '').trim();
  return t.trim();
}

/**
 * 将大模型正文拆成要点：合并非要点边界的软换行；再按分号、编号切分。
 * 用于 BMC 宫格/条卡与需求逻辑条卡等共用。
 */
function splitBmcFieldToBulletSegments(raw) {
  const s0 = String(raw ?? '').trim();
  if (!s0 || s0 === '—') return [];
  const s = s0.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
  const rawLines = s.split('\n').map((l) => l.trim()).filter(Boolean);
  const merged = [];
  let buf = '';

  const flushBuf = () => {
    const t = buf.replace(/\s+/g, ' ').trim();
    if (t) merged.push(t);
    buf = '';
  };

  for (const line of rawLines) {
    if (isLikelyNewTopicLine(line)) {
      flushBuf();
      buf = stripLineListPrefix(line);
    } else {
      const piece = stripLineListPrefix(line);
      buf = buf ? `${buf} ${piece}` : piece;
    }
  }
  flushBuf();

  if (merged.length === 0) {
    const one = s.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    return one ? [one] : [];
  }

  let parts = [];
  for (const m of merged) {
    if (m.includes('；')) {
      const subs = m.split('；').map((x) => x.trim()).filter(Boolean);
      parts.push(...(subs.length > 1 ? subs : [m]));
    } else if (m.includes(';')) {
      const semi = m.split(';').map((x) => x.trim()).filter(Boolean);
      parts.push(...(semi.length > 1 ? semi : [m]));
    } else {
      parts.push(m);
    }
  }

  if (parts.length === 1) {
    const one = parts[0];
    const numSplit = one
      .split(/(?=\d+[\.、]\s+)/)
      .map((x) => x.replace(/^\d+[\.、]\s*/, '').trim())
      .filter(Boolean);
    if (numSplit.length > 1) parts = numSplit;
  }

  const out = parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return out.length ? out : [s.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()].filter(Boolean);
}

/** 无 ** 时把行首「标题：正文」提升为 **标题**：，以走 renderRequirementWorkspaceFieldValueHtml 绿色小标题 */
function promotePlainColonTitleToBoldSubtitleMarkdown(text) {
  const s = String(text ?? '').trim();
  if (!s || /\*\*/.test(s)) return s;
  const m = s.match(/^([\u4e00-\u9fff（）\w·•]{2,40}?)([：:]\s*)([\s\S]+)$/);
  if (!m || !m[3].trim()) return s;
  return `**${m[1]}**${m[2]}${m[3]}`;
}

/** 要点行内将软换行产生的 br 收成空格，避免一条要点多行断开 */
function collapseWsBulletInnerBr(html) {
  return String(html || '').replace(/<br\s*\/?>/gi, ' ');
}

/**
 * 在已转义/已 renderWs 的 HTML 片段上，对文本节点匹配实体名与「核心业务对象」包绿色 span（避免破坏标签）
 * @param {string} html
 * @param {string[]} entityNames
 */
function applyBmcCoreObjectHighlights(html, entityNames) {
  if (!html) return html;
  const escOut = (s) => __pdrHost().escapeHtml(String(s));
  const names = Array.from(
    new Set(
      (Array.isArray(entityNames) ? entityNames : [])
        .map((x) => String(x ?? '').trim())
        .filter((n) => n.length >= 2),
    ),
  ).sort((a, b) => b.length - a.length);
  const pieces = String(html).split(/(<[^>]+>)/);
  return pieces
    .map((part) => {
      if (!part || part.startsWith('<')) return part;
      let text = part;
      for (const name of names) {
        const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        text = text.replace(new RegExp(esc, 'g'), () => {
          const safe = escOut(name);
          return `<span class="problem-detail-bmc-core-object">${safe}</span>`;
        });
      }
      text = text.replace(
        /核心业务对象/g,
        `<span class="problem-detail-bmc-core-object">${escOut('核心业务对象')}</span>`,
      );
      return text;
    })
    .join('');
}

/** BMC 工作区：单字段正文拆要点后生成 `<li>` 串（与九宫格、行业/痛点条卡共用） */
function buildBmcWsBulletLisFromRaw(rawText, renderWs, coreNames, escapeHtmlFn) {
  const segments = splitBmcFieldToBulletSegments(String(rawText ?? '').trim());
  if (segments.length === 0) {
    return '<li class="problem-detail-bmc-ws-cell-li">—</li>';
  }
  return segments
    .map((seg) => {
      const forRender = promotePlainColonTitleToBoldSubtitleMarkdown(seg);
      const inner = collapseWsBulletInnerBr(renderWs(escapeHtmlFn(forRender)));
      const marked = applyBmcCoreObjectHighlights(inner, coreNames);
      return `<li class="problem-detail-bmc-ws-cell-li">${marked}</li>`;
    })
    .join('');
}

function renderProblemDetailContent() {
  const $ = __pdrHost;
  const __appState = globalThis.SmartCto.appState.getState();
  let problemDetailViewingMajorStage = $().getProblemDetailViewingMajorStage();
  const itStrategyPlanViewingSubstep = $().getItStrategyPlanViewingSubstep();
  const itGapViewingSubstep = $().getItGapViewingSubstep();
  const el = $().el;
    const container = el.problemDetailContent;
    if (!container) return;
    try {
    const item = __appState.currentProblemDetailItem;
    if (!item) {
      container.innerHTML = '<p class="problem-follow-empty">暂无详情</p>';
      const headlineElEmpty = el.problemDetailCaseHeadline;
      if (headlineElEmpty) {
        headlineElEmpty.textContent = '';
        headlineElEmpty.hidden = true;
      }
      return;
    }
    {
      const headlineEl = el.problemDetailCaseHeadline;
      if (headlineEl && typeof globalThis.buildCaseRequirementHeadlineParts === 'function') {
        const parts = globalThis.buildCaseRequirementHeadlineParts(item);
        headlineEl.textContent = parts.headlineLine || `${parts.customerName || '—'}｜${parts.requirementTitle || '—'}`;
        headlineEl.hidden = false;
      } else if (headlineEl) {
        headlineEl.textContent = '';
        headlineEl.hidden = true;
      }
    }
    {
      const n = Number(problemDetailViewingMajorStage);
      if (Number.isFinite(n)) {
        problemDetailViewingMajorStage = Math.max(0, Math.min(3, n));
        $().setProblemDetailViewingMajorStage(problemDetailViewingMajorStage);
      }
    }
    if (problemDetailViewingMajorStage < 2) {
      __pdrLastRenderedMajor2ItGapSub = -1;
    }
    $().syncProblemDetailWorkspaceToCanonicalTask(item);
    const currentMajorStage = item.currentMajorStage ?? 0;
    if ($().feRolePermissionLog()) console.log('[角色与权限] renderProblemDetailContent 调用: problemDetailViewingMajorStage=', problemDetailViewingMajorStage, 'itStrategyPlanViewingSubstep=', itStrategyPlanViewingSubstep);
    if (problemDetailViewingMajorStage === 3) {
      const contentPlaceholders = $().IT_STRATEGY_TASKS.map((t) => ({
        title: t.name,
        desc: `任务目标：${t.objective || '—'} 评估标准：${t.evaluationCriteria || '—'}`,
      }));
      const currentPlaceholder = contentPlaceholders[itStrategyPlanViewingSubstep];
      let workspaceInner = `
        <div class="problem-detail-it-strategy-content">
          <div class="problem-detail-workflow-align-placeholder">
            <h3 class="problem-detail-workflow-align-title">${$().escapeHtml(currentPlaceholder.title)}</h3>
            <p class="problem-detail-workflow-align-desc">${$().escapeHtml(currentPlaceholder.desc)}</p>
            <p class="problem-detail-workflow-align-desc problem-detail-workflow-align-note">此任务内容展示区，后续可接入大模型生成与编辑。</p>
          </div>
        </div>`;
      if (itStrategyPlanViewingSubstep === 0 || itStrategyPlanViewingSubstep === 1) {
        const mergedCboSessions = $().resolveMergedCoreBusinessObjectSessions();
        const valueStream =
          typeof $().resolveValueStreamForWorkflowAlignWorkspace === 'function'
            ? $().resolveValueStreamForWorkflowAlignWorkspace(item)
            : item.valueStream;
        const roleContent = $().getLatestConfirmedRolePermissionContent(item);
        const model = roleContent ? $().parseRolePermissionModel(roleContent) : [];
        const isNewRbacFormat = Array.isArray(model) && model.length > 0 && model.some((m) => m && (m.step_name != null || m.step_id != null || m.stage_name != null || m.stage_id != null));
        let stageCardsHtml = '';
        if ($().feRolePermissionLog()) console.log('[角色与权限] 工作区渲染: problemDetailViewingMajorStage=', problemDetailViewingMajorStage, 'itStrategyPlanViewingSubstep=', itStrategyPlanViewingSubstep, 'roleContent=', roleContent ? '有(' + roleContent.length + '字)' : 'null', 'model条数=', model.length, 'isNewRbacFormat=', isNewRbacFormat, 'valueStream=', !!(valueStream && !valueStream.raw), 'valueStream.raw=', valueStream?.raw);
  
        if (valueStream && !valueStream.raw) {
          if (isNewRbacFormat) {
            const { stages } = $().parseValueStreamGraph(valueStream);
            const norm = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
            const modelByStage = (() => {
              const map = new Map();
              for (const m of model) {
                const k = norm(m.stage_name != null ? String(m.stage_name) : '') || '_';
                if (!map.has(k)) map.set(k, []);
                map.get(k).push(m);
              }
              return map;
            })();
            const getModelListForStage = (stageNameNorm) => {
              if (modelByStage.get(stageNameNorm)) return modelByStage.get(stageNameNorm);
              for (const [k, list] of modelByStage) {
                if (k === '_' || !stageNameNorm || !k) continue;
                if (k === stageNameNorm || k.includes(stageNameNorm) || stageNameNorm.includes(k)) return list;
              }
              return modelByStage.get('_') || [];
            };
            if (stages && stages.length > 0) {
              if ($().feRolePermissionLog()) console.log('[角色与权限] 工作区渲染: 价值流阶段数=', stages.length, 'modelByStage keys=', [...modelByStage.keys()]);
              let globalStepIndex = 0;
              stageCardsHtml = stages
                .map((stage) => {
                  const stageNameNorm = norm(stage.name || '');
                  const stageModelList = getModelListForStage(stageNameNorm);
                  if ($().feRolePermissionLog()) console.log('[角色与权限] 阶段:', stageNameNorm, '该阶段model条数=', stageModelList.length);
                  const stepCardsHtml = (stage.steps || [])
                    .map((step, stepIndex) => {
                      const nodeName = (step?.name || '').trim();
                      if (!nodeName) return '';
                      const currentGlobal = globalStepIndex++;
                      const nodeNorm = norm(nodeName);
                      /* 大模型常只填 stage_name 表示价值流环节名、未填 step_name；匹配时二者任一可与 nodeName 对齐 */
                      let match = model.find((m) => {
                        const mStage = norm(m.stage_name != null ? String(m.stage_name) : '');
                        const mStep = norm(m.step_name != null ? String(m.step_name) : '');
                        const nameForStep = mStep || mStage;
                        if (!nameForStep) return false;
                        const stepMatch = nodeNorm === nameForStep || nodeNorm.includes(nameForStep) || nameForStep.includes(nodeNorm);
                        const stageMatch = !stageNameNorm || !mStage || stageNameNorm === mStage || stageNameNorm.includes(mStage) || mStage.includes(stageNameNorm);
                        return stepMatch && stageMatch;
                      }) || model.find((m) => {
                        const mStep = norm(m.step_name != null ? String(m.step_name) : '');
                        const mStage = norm(m.stage_name != null ? String(m.stage_name) : '');
                        const nameForStep = mStep || mStage;
                        return nameForStep && (nodeNorm === nameForStep || nodeNorm.includes(nameForStep) || nameForStep.includes(nodeNorm));
                      });
                      if (!match && stepIndex < stageModelList.length) match = stageModelList[stepIndex];
                      if ($().feRolePermissionLog()) console.log('[角色与权限] 环节:', nodeName, 'match=', !!match, match ? 'step_name=' + (match.step_name || '') : '');
                      const stepJsonForHeader = $().getRolePermissionStepJsonForWorkspace(item, currentGlobal, match);
                      /* 优先按环节下标使用会话/聊天记录中的 JSON，避免聚合 model 的 match 覆盖已写入的环节结果；不再要求 roles 非空（空时 view 内提示暂无角色） */
                      const effectiveRpMatch =
                        stepJsonForHeader && typeof stepJsonForHeader === 'object'
                          ? stepJsonForHeader
                          : match && typeof match === 'object'
                            ? match
                            : null;
                      const rpStepHeaderStatus =
                        typeof $().buildRolePermissionStepHeaderDeducedHtml === 'function'
                          ? $().buildRolePermissionStepHeaderDeducedHtml(stepJsonForHeader)
                          : '';
                      const viewHtml = effectiveRpMatch ? $().buildRolePermissionStepViewHtml(effectiveRpMatch) : '';
                      const jsonStr = effectiveRpMatch ? JSON.stringify(effectiveRpMatch, null, 2) : '';
                      const rolePermissionBlock = effectiveRpMatch
                        ? `<div class="problem-detail-role-permission-tabs">
              <span class="problem-detail-role-permission-tabs-title">角色与权限模型推演</span>
              <button type="button" class="problem-detail-role-permission-tab problem-detail-role-permission-tab-active" data-tab="view">view</button>
              <button type="button" class="problem-detail-role-permission-tab" data-tab="json">json</button>
            </div>
            <div class="problem-detail-role-permission-panel problem-detail-role-permission-panel-view" data-panel="view">${viewHtml}</div>
            <div class="problem-detail-role-permission-panel problem-detail-role-permission-panel-json" data-panel="json" hidden><pre class="problem-detail-role-permission-json">${$().escapeHtml(jsonStr)}</pre></div>`
                        : '<div class="problem-detail-role-permission-placeholder" data-placeholder-kind="role-permission">角色与权限模型：待推演</div>';
                      const sessions = mergedCboSessions.length > 0 ? mergedCboSessions : (item?.coreBusinessObjectSessions || []);
                      const session = sessions[currentGlobal];
                      const raw = session?.coreBusinessObjectJson;
                      let cboMatch = null;
                      if (raw && typeof $().parseCoreBusinessObjectModel === 'function') {
                        const parsed = $().parseCoreBusinessObjectModel(typeof raw === 'string' ? raw : JSON.stringify(raw));
                        cboMatch = Array.isArray(parsed) && parsed[0] ? parsed[0] : null;
                        $().logCoreBusinessObject('工作区匹配(新RBAC路径)', {
                          stepIndex: currentGlobal,
                          stepName: nodeName,
                          rawType: typeof raw,
                          rawLength: typeof raw === 'string' ? raw.length : JSON.stringify(raw).length,
                          parsedCount: Array.isArray(parsed) ? parsed.length : 0,
                          matched: !!cboMatch,
                          entityCount: Array.isArray(cboMatch?.entities) ? cboMatch.entities.length : 0,
                          hasLocalGapResolved: !!(cboMatch?.local_gap_resolved && String(cboMatch.local_gap_resolved).trim()),
                        });
                      }
                      let cboViewHtml = cboMatch && typeof $().buildCoreBusinessObjectStepViewHtml === 'function' ? $().buildCoreBusinessObjectStepViewHtml(cboMatch) : '';
                      if (!cboViewHtml && raw && typeof $().buildCoreBusinessObjectStepViewHtml === 'function') {
                        const normalized = $().normalizeCoreBusinessObjectFromStrictOutput(raw);
                        if (normalized) {
                          cboViewHtml = $().buildCoreBusinessObjectStepViewHtml(normalized);
                          $().logCoreBusinessObject('view兜底归一化生效(新RBAC路径)', {
                            stepIndex: currentGlobal,
                            stepName: nodeName,
                            entityCount: Array.isArray(normalized.entities) ? normalized.entities.length : 0,
                          });
                        }
                      }
                      if (!cboViewHtml && raw && typeof $().buildCoreBusinessObjectStepViewHtml === 'function' && typeof $().parseCoreBusinessObjectModel === 'function') {
                        const parsedAgain = $().parseCoreBusinessObjectModel(typeof raw === 'string' ? raw : JSON.stringify(raw));
                        const firstParsed = Array.isArray(parsedAgain) ? parsedAgain[0] : null;
                        if (firstParsed) {
                          cboViewHtml = $().buildCoreBusinessObjectStepViewHtml(firstParsed);
                          $().logCoreBusinessObject('view二次解析兜底生效(新RBAC路径)', {
                            stepIndex: currentGlobal,
                            stepName: nodeName,
                            parsedCount: Array.isArray(parsedAgain) ? parsedAgain.length : 0,
                            entityCount: Array.isArray(firstParsed.entities) ? firstParsed.entities.length : 0,
                          });
                        }
                      }
                      const cboJsonStr = raw != null ? (typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)) : '';
                      const hasCbo = raw != null;
                      if (hasCbo) {
                        $().logCoreBusinessObject('工作区渲染(view/json)', {
                          stepIndex: currentGlobal,
                          stepName: nodeName,
                          viewHtmlLength: cboViewHtml ? cboViewHtml.length : 0,
                          jsonLength: cboJsonStr ? cboJsonStr.length : 0,
                        });
                      }
                      const cboSubCardHtml = hasCbo
                        ? `<div class="problem-detail-step-card-core-business-object">
            <div class="problem-detail-core-business-object-tabs">
              <span class="problem-detail-core-business-object-tabs-title">核心业务对象推演</span>
              <button type="button" class="problem-detail-core-business-object-tab" data-tab="view">view</button>
              <button type="button" class="problem-detail-core-business-object-tab problem-detail-core-business-object-tab-active" data-tab="json">json</button>
            </div>
            <div class="problem-detail-core-business-object-panel" data-panel="view" hidden>${cboViewHtml || '<pre class="problem-detail-core-business-object-json">' + $().escapeHtml(cboJsonStr) + '</pre>'}</div>
            <div class="problem-detail-core-business-object-panel" data-panel="json"><pre class="problem-detail-core-business-object-json">${$().escapeHtml(cboJsonStr)}</pre></div>
          </div>`
                        : '<div class="problem-detail-step-card-core-business-object"><div class="problem-detail-role-permission-placeholder" data-placeholder-kind="core-business-object">核心业务对象推演：待推演</div></div>';
                      const stepBodyContent = itStrategyPlanViewingSubstep === 0 ? rolePermissionBlock : cboSubCardHtml;
                      const cboEntityCountForHeader = hasCbo ? $().getCoreBusinessObjectEntityCountForWorkspaceStep(raw, cboMatch) : 0;
                      const cboHeaderRemark = hasCbo
                        ? `<span class="problem-detail-step-card-header-cbo-remark">生成业务对象${cboEntityCountForHeader}个</span>`
                        : '';
                      const rpCboClusterHtml = (rpStepHeaderStatus || hasCbo)
                        ? `<span class="problem-detail-card-header-rp-cbo-cluster">${rpStepHeaderStatus}${cboHeaderRemark}</span>`
                        : '';
                      return `
                    <div class="problem-detail-card problem-detail-card-role-permission">
                      <div class="problem-detail-card-header problem-detail-card-header-collapsed" tabindex="0" role="button" aria-expanded="false">
                        <span class="problem-detail-card-header-title-row">
                          <span class="problem-detail-card-header-title">环节：${$().escapeHtml(nodeName)}</span>
                          ${rpCboClusterHtml}
                        </span>
                        <span class="problem-detail-card-header-arrow">▾</span>
                      </div>
                      <div class="problem-detail-card-body" hidden>${stepBodyContent}</div>
                    </div>`;
                    })
                    .join('');
                  const stageName = stage.name || '未命名阶段';
                  return `
                <div class="problem-detail-card problem-detail-role-permission-stage">
                  <div class="problem-detail-card-header" tabindex="0" role="button" aria-expanded="true">
                    <span class="problem-detail-card-header-title">${$().escapeHtml(stageName)}</span>
                    <span class="problem-detail-card-header-arrow">▾</span>
                  </div>
                  <div class="problem-detail-card-body">${stepCardsHtml}</div>
                </div>`;
                })
                .join('');
            } else {
              stageCardsHtml = $().buildRolePermissionNodeCardsHtml(model);
            }
          } else {
            const { stages } = $().parseValueStreamGraph(valueStream);
            let globalStepIndexOld = 0;
            stageCardsHtml = stages
              .map((stage) => {
                const stepCardsHtml = (stage.steps || [])
                  .map((step) => {
                    const nodeName = step?.name || '';
                    if (!nodeName) return '';
                    const currentGlobal = globalStepIndexOld++;
                    const match =
                      model.find((m) => m.node === nodeName) ||
                      model.find((m) => nodeName.includes(m.node) || m.node.includes(nodeName));
                    const roles = match?.roles || { executor: '', approver: '', informer: '' };
                    const perms = match?.perms || { wechat: '', lowcode: '', notify: '', query: '' };
                    const duty = match?.duty || '';
                    const hasContent = match && (roles.executor || roles.approver || roles.informer || perms.wechat || perms.lowcode || perms.notify || perms.query || duty);
                    const stepJsonOldPath = $().getRolePermissionStepJsonForWorkspace(item, currentGlobal, match);
                    let rpStepHeaderStatusOld = '';
                    if (typeof $().buildRolePermissionStepHeaderDeducedHtml === 'function') {
                      rpStepHeaderStatusOld = $().buildRolePermissionStepHeaderDeducedHtml(stepJsonOldPath);
                    }
                    if (!rpStepHeaderStatusOld && typeof $().buildLegacyRolePermissionHeaderDeducedHtml === 'function' && match) {
                      rpStepHeaderStatusOld = $().buildLegacyRolePermissionHeaderDeducedHtml(match);
                    }
                    const rolePermissionBlock = hasContent
                      ? `
                        <table class="problem-detail-role-permission-table">
                          <tbody>
                            <tr><td class="problem-detail-role-permission-table-label">环节名称</td><td class="problem-detail-role-permission-table-value">${$().escapeHtml(nodeName)}</td></tr>
                            <tr><td class="problem-detail-role-permission-table-label">执行者</td><td class="problem-detail-role-permission-table-value">${$().escapeHtml(roles.executor || '—')}</td></tr>
                            <tr><td class="problem-detail-role-permission-table-label">审批者</td><td class="problem-detail-role-permission-table-value">${$().escapeHtml(roles.approver || '—')}</td></tr>
                            <tr><td class="problem-detail-role-permission-table-label">知情者</td><td class="problem-detail-role-permission-table-value">${$().escapeHtml(roles.informer || '—')}</td></tr>
                            <tr><td class="problem-detail-role-permission-table-label">企微端</td><td class="problem-detail-role-permission-table-value">${$().escapeHtml(perms.wechat || '—')}</td></tr>
                            <tr><td class="problem-detail-role-permission-table-label">低代码</td><td class="problem-detail-role-permission-table-value">${$().escapeHtml(perms.lowcode || '—')}</td></tr>
                            <tr><td class="problem-detail-role-permission-table-label">接收通知</td><td class="problem-detail-role-permission-table-value">${$().escapeHtml(perms.notify || '—')}</td></tr>
                            <tr><td class="problem-detail-role-permission-table-label">查询数据</td><td class="problem-detail-role-permission-table-value">${$().escapeHtml(perms.query || '—')}</td></tr>
                            ${duty ? `<tr><td class="problem-detail-role-permission-table-label">核心职责</td><td class="problem-detail-role-permission-table-value">${$().escapeHtml(duty)}</td></tr>` : ''}
                          </tbody>
                        </table>`
                      : '<div class="problem-detail-role-permission-placeholder" data-placeholder-kind="role-permission">角色与权限模型：待推演</div>';
                    const sessions = mergedCboSessions.length > 0 ? mergedCboSessions : (item?.coreBusinessObjectSessions || []);
                    const session = sessions[currentGlobal];
                    const raw = session?.coreBusinessObjectJson;
                    let cboMatch = null;
                    if (raw && typeof $().parseCoreBusinessObjectModel === 'function') {
                      const parsed = $().parseCoreBusinessObjectModel(typeof raw === 'string' ? raw : JSON.stringify(raw));
                      cboMatch = Array.isArray(parsed) && parsed[0] ? parsed[0] : null;
                      $().logCoreBusinessObject('工作区匹配(旧RBAC路径)', {
                        stepIndex: currentGlobal,
                        stepName: nodeName,
                        rawType: typeof raw,
                        rawLength: typeof raw === 'string' ? raw.length : JSON.stringify(raw).length,
                        parsedCount: Array.isArray(parsed) ? parsed.length : 0,
                        matched: !!cboMatch,
                        entityCount: Array.isArray(cboMatch?.entities) ? cboMatch.entities.length : 0,
                        hasLocalGapResolved: !!(cboMatch?.local_gap_resolved && String(cboMatch.local_gap_resolved).trim()),
                      });
                    }
                    let cboViewHtml = cboMatch && typeof $().buildCoreBusinessObjectStepViewHtml === 'function' ? $().buildCoreBusinessObjectStepViewHtml(cboMatch) : '';
                    if (!cboViewHtml && raw && typeof $().buildCoreBusinessObjectStepViewHtml === 'function') {
                      const normalized = $().normalizeCoreBusinessObjectFromStrictOutput(raw);
                      if (normalized) {
                        cboViewHtml = $().buildCoreBusinessObjectStepViewHtml(normalized);
                        $().logCoreBusinessObject('view兜底归一化生效(旧RBAC路径)', {
                          stepIndex: currentGlobal,
                          stepName: nodeName,
                          entityCount: Array.isArray(normalized.entities) ? normalized.entities.length : 0,
                        });
                      }
                    }
                    if (!cboViewHtml && raw && typeof $().buildCoreBusinessObjectStepViewHtml === 'function' && typeof $().parseCoreBusinessObjectModel === 'function') {
                      const parsedAgain = $().parseCoreBusinessObjectModel(typeof raw === 'string' ? raw : JSON.stringify(raw));
                      const firstParsed = Array.isArray(parsedAgain) ? parsedAgain[0] : null;
                      if (firstParsed) {
                        cboViewHtml = $().buildCoreBusinessObjectStepViewHtml(firstParsed);
                        $().logCoreBusinessObject('view二次解析兜底生效(旧RBAC路径)', {
                          stepIndex: currentGlobal,
                          stepName: nodeName,
                          parsedCount: Array.isArray(parsedAgain) ? parsedAgain.length : 0,
                          entityCount: Array.isArray(firstParsed.entities) ? firstParsed.entities.length : 0,
                        });
                      }
                    }
                    const cboJsonStr = raw != null ? (typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)) : '';
                    const hasCbo = raw != null;
                    if (hasCbo) {
                      $().logCoreBusinessObject('工作区渲染(view/json)', {
                        stepIndex: currentGlobal,
                        stepName: nodeName,
                        viewHtmlLength: cboViewHtml ? cboViewHtml.length : 0,
                        jsonLength: cboJsonStr ? cboJsonStr.length : 0,
                      });
                    }
                    const cboSubCardHtml = hasCbo
                      ? `<div class="problem-detail-step-card-core-business-object">
            <div class="problem-detail-core-business-object-tabs">
              <span class="problem-detail-core-business-object-tabs-title">核心业务对象推演</span>
              <button type="button" class="problem-detail-core-business-object-tab" data-tab="view">view</button>
              <button type="button" class="problem-detail-core-business-object-tab problem-detail-core-business-object-tab-active" data-tab="json">json</button>
            </div>
            <div class="problem-detail-core-business-object-panel" data-panel="view" hidden>${cboViewHtml || '<pre class="problem-detail-core-business-object-json">' + $().escapeHtml(cboJsonStr) + '</pre>'}</div>
            <div class="problem-detail-core-business-object-panel" data-panel="json"><pre class="problem-detail-core-business-object-json">${$().escapeHtml(cboJsonStr)}</pre></div>
          </div>`
                      : '<div class="problem-detail-step-card-core-business-object"><div class="problem-detail-role-permission-placeholder" data-placeholder-kind="core-business-object">核心业务对象推演：待推演</div></div>';
                    const stepBodyContent = itStrategyPlanViewingSubstep === 0 ? rolePermissionBlock : cboSubCardHtml;
                    const cboEntityCountForHeaderOld = hasCbo ? $().getCoreBusinessObjectEntityCountForWorkspaceStep(raw, cboMatch) : 0;
                    const cboHeaderRemarkOld = hasCbo
                      ? `<span class="problem-detail-step-card-header-cbo-remark">生成业务对象${cboEntityCountForHeaderOld}个</span>`
                      : '';
                    const rpCboClusterHtmlOld = (rpStepHeaderStatusOld || hasCbo)
                      ? `<span class="problem-detail-card-header-rp-cbo-cluster">${rpStepHeaderStatusOld}${cboHeaderRemarkOld}</span>`
                      : '';
                    return `
                    <div class="problem-detail-card problem-detail-card-role-permission">
                      <div class="problem-detail-card-header problem-detail-card-header-collapsed" tabindex="0" role="button" aria-expanded="false">
                        <span class="problem-detail-card-header-title-row">
                          <span class="problem-detail-card-header-title">环节：${$().escapeHtml(nodeName)}</span>
                          ${rpCboClusterHtmlOld}
                        </span>
                        <span class="problem-detail-card-header-arrow">▾</span>
                      </div>
                      <div class="problem-detail-card-body" hidden>${stepBodyContent}</div>
                    </div>`;
                  })
                  .join('');
                const stageName = stage.name || '未命名阶段';
                return `
                <div class="problem-detail-card problem-detail-role-permission-stage">
                  <div class="problem-detail-card-header" tabindex="0" role="button" aria-expanded="true">
                    <span class="problem-detail-card-header-title">${$().escapeHtml(stageName)}</span>
                    <span class="problem-detail-card-header-arrow">▾</span>
                  </div>
                  <div class="problem-detail-card-body">${stepCardsHtml}</div>
                </div>`;
              })
              .join('');
          }
        }
        if (model.length > 0 && !stageCardsHtml) {
          if ($().feRolePermissionLog()) console.log('[角色与权限] 工作区渲染: 无价值流或未填stageCardsHtml, 使用扁平环节列表, model条数=', model.length);
          stageCardsHtml = $().buildRolePermissionNodeCardsHtml(model);
        }
        let rolePermissionRegistryCardHtml = '';
        if (itStrategyPlanViewingSubstep === 0 && typeof $().buildRolePermissionRegistryCardHtml === 'function') {
          const regForCard = typeof $().getRolePermissionRegistryForDisplay === 'function' ? $().getRolePermissionRegistryForDisplay(item) : [];
          rolePermissionRegistryCardHtml = $().buildRolePermissionRegistryCardHtml(regForCard);
        }
        let staticAnchorCardHtml = '';
        if (itStrategyPlanViewingSubstep === 1 && typeof $().buildStaticAnchorCardHtml === 'function') {
          staticAnchorCardHtml = $().buildStaticAnchorCardHtml(item);
        }
        let coreBusinessObjectChecklistCardHtml = '';
        if (itStrategyPlanViewingSubstep === 1 && typeof $().buildCoreBusinessObjectChecklistCardHtml === 'function') {
          const sessionsForChecklist = mergedCboSessions.length > 0 ? mergedCboSessions : (item?.coreBusinessObjectSessions || []);
          const checklistItems = $().mergeCoreBusinessObjectChecklistByIdentity(sessionsForChecklist);
          coreBusinessObjectChecklistCardHtml = $().buildCoreBusinessObjectChecklistCardHtml(checklistItems);
        }
        if (stageCardsHtml) {
          if ($().feRolePermissionLog()) console.log('[角色与权限] 工作区渲染: 已设置 workspaceInner 为环节卡片内容');
          workspaceInner = `
            <div class="problem-detail-it-strategy-content">
              ${rolePermissionRegistryCardHtml}
              ${staticAnchorCardHtml}
              ${coreBusinessObjectChecklistCardHtml}
              <div class="problem-detail-role-permission-wrap">
                ${stageCardsHtml}
              </div>
            </div>`;
        } else if ($().feRolePermissionLog()) {
          console.log('[角色与权限] 工作区渲染: stageCardsHtml 为空, 未更新 workspaceInner, 仍为占位符');
        }
      }
      container.innerHTML = `
        <div class="problem-detail-workspace-scroll">
          ${workspaceInner}
        </div>`;
      $().setupProblemDetailCardToggle();
      return;
    }
    if (problemDetailViewingMajorStage >= 2) {
      const valueStream = $().resolveValueStreamForItGap(item);
      let workspaceContent = '';
      let itGapWorkspaceSubAttr = '';
      if (valueStream && !valueStream.raw) {
        const igSub = Math.max(0, Math.min(2, Number(itGapViewingSubstep) || 0));
        const prevIgSubForLog = __pdrLastRenderedMajor2ItGapSub;
        if (globalThis.__FE_E2E_WORKSPACE_DEBUG === true && prevIgSubForLog >= 0 && prevIgSubForLog !== igSub) {
          try {
            let preResolveSnapshot = null;
            if (
              igSub === 0 &&
              typeof globalThis.SmartCto?.task7E2eTransactionFlow?.buildE2eWorkspaceDebugSnapshot === 'function'
            ) {
              preResolveSnapshot = globalThis.SmartCto.task7E2eTransactionFlow.buildE2eWorkspaceDebugSnapshot(
                item,
                __appState.problemDetailChatMessages,
                null,
              );
            }
            console.log('[FE:task7-e2e-workspace]', 'itgap-substep-change', {
              from: prevIgSubForLog,
              to: igSub,
              scenario:
                prevIgSubForLog === 1 && igSub === 0
                  ? 'IT设计补齐→端到端：若补齐节点/BPM 消失，对照 preResolveSnapshot 与紧随其后的 render:itgap-sub0'
                  : null,
              preResolveSnapshot,
            });
          } catch (e) {
            console.warn('[FE:task7-e2e-workspace]', 'itgap-substep-change:snapshot-failed', e);
          }
        }
        __pdrLastRenderedMajor2ItGapSub = igSub;
        itGapWorkspaceSubAttr = String(igSub);
        __logTask9Portal('workspace-render:itgap', {
          igSub,
          majorStage: problemDetailViewingMajorStage,
          portalFieldNil: item.roleTaskCenterPortalDesignJson == null,
          portalFieldType:
            item.roleTaskCenterPortalDesignJson == null ? 'nil' : typeof item.roleTaskCenterPortalDesignJson,
        });
        let e2eCardHtml = '';
        let e2eScenarioSupplementCardHtml = '';
        if (igSub === 0) {
          const hideE2eWorkspaceDraw = $().shouldHideE2eFlowWorkspaceUntilTaskStart(item, __appState.problemDetailChatMessages);
          const txFlow =
            !hideE2eWorkspaceDraw && typeof $().resolveE2eTransactionFlowJsonForWorkspace === 'function'
              ? $().resolveE2eTransactionFlowJsonForWorkspace(item, __appState.problemDetailChatMessages)
              : null;
          if (globalThis.__FE_E2E_WORKSPACE_DEBUG === true) {
            try {
              const snap =
                typeof globalThis.SmartCto?.task7E2eTransactionFlow?.buildE2eWorkspaceDebugSnapshot === 'function'
                  ? globalThis.SmartCto.task7E2eTransactionFlow.buildE2eWorkspaceDebugSnapshot(
                      item,
                      __appState.problemDetailChatMessages,
                      txFlow,
                    )
                  : null;
              console.log('[FE:task7-e2e-workspace]', 'render:itgap-sub0', {
                hideE2eWorkspaceDraw,
                hasTxFlow: !!txFlow,
                snapshot: snap,
              });
            } catch (e) {
              console.warn('[FE:task7-e2e-workspace]', 'render:itgap-sub0:snapshot-failed', e);
            }
          }
          let e2eHtml = '';
          if (hideE2eWorkspaceDraw) {
            e2eHtml =
              '<p class="problem-detail-local-itgap-pending">请在聊天区点击「确认」开始端到端事务流构建任务后，将在此展示业务事务流 view 与 json。</p>';
          } else if (txFlow && typeof $().renderE2eBpmTransactionFlowHTML === 'function') {
            e2eHtml = $().renderE2eBpmTransactionFlowHTML(txFlow);
          } else if (!hideE2eWorkspaceDraw) {
            e2eHtml =
              '<p class="problem-detail-local-itgap-pending">请在聊天区使用「生成事务流 Session 计划」并点击「自动顺序执行」完成各阶段模型生成后，将在此按阶段展示 BPM 事务视图；json Tab 展示合并后的完整事务流 JSON。</p>';
          }
          const e2eJsonPlain = hideE2eWorkspaceDraw
            ? '确认开始任务后将展示业务事务流 JSON。'
            : txFlow
              ? JSON.stringify(txFlow, null, 2)
              : '尚未生成业务事务流 JSON，请先在聊天区完成 Session 计划中的各阶段事务流生成并等待模型返回。';
          const jsonStrE2e = $().escapeHtml(e2eJsonPlain);
          const e2eFsEnterIcon =
            '<svg class="problem-detail-value-stream-fs-icon-enter" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
          const e2eFsExitIcon =
            '<svg class="problem-detail-value-stream-fs-icon-exit" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
          e2eCardHtml = `
        <div class="problem-detail-card problem-detail-card-e2e-flow" data-task-id="e2e-flow">
          <div class="problem-detail-card-header problem-detail-card-e2e-flow-header" role="button" tabindex="0" aria-expanded="true">
            <span class="problem-detail-card-header-title">端到端事务流</span>
            <div class="problem-detail-e2e-flow-header-center-tabs">
              <div class="problem-detail-card-header-actions">
                <button type="button" class="problem-detail-card-tab problem-detail-card-tab-active" data-tab="view" aria-pressed="true">view</button>
                <button type="button" class="problem-detail-card-tab" data-tab="json" aria-pressed="false">json</button>
              </div>
            </div>
            <div class="problem-detail-e2e-flow-header-right-actions">
              <button type="button" class="problem-detail-e2e-flow-download-btn" title="将当前端到端事务流视图导出为 PNG 图片" aria-label="下载端到端事务流图">下载图</button>
              <button type="button" class="problem-detail-workspace-json-download-btn" data-workspace-json-kind="e2e-flow" title="下载当前端到端事务流 JSON 文件" aria-label="下载端到端事务流 JSON">下载 json</button>
              <button type="button" class="problem-detail-e2e-flow-fs-btn" title="全屏显示端到端事务流" aria-label="全屏显示端到端事务流" aria-pressed="false">${e2eFsEnterIcon}${e2eFsExitIcon}</button>
              <span class="problem-detail-card-header-arrow">▾</span>
            </div>
          </div>
          <div class="problem-detail-card-body">
            <div class="problem-detail-card-body-detail problem-detail-it-gap-e2e-wrap">${e2eHtml}</div>
            <div class="problem-detail-card-body-json problem-detail-card-body-e2e-full-json" hidden><pre class="problem-detail-card-json-pre">${jsonStrE2e}</pre></div>
          </div>
        </div>`;
          const msgsForE2eSup = Array.isArray(__appState.problemDetailChatMessages)
            ? __appState.problemDetailChatMessages
            : [];
          let supCandidate =
            typeof globalThis.SmartCto?.task7E2eTransactionFlow?.resolveEffectiveRequirementScenarioSupplementJson ===
            'function'
              ? globalThis.SmartCto.task7E2eTransactionFlow.resolveEffectiveRequirementScenarioSupplementJson(
                  item,
                  msgsForE2eSup,
                )
              : null;
          if (supCandidate == null && item?.e2eRequirementScenarioSupplementJson != null) {
            let raw = item.e2eRequirementScenarioSupplementJson;
            if (typeof raw === 'string' && raw.trim()) {
              try {
                raw = JSON.parse(raw);
              } catch (_) {
                raw = null;
              }
            }
            supCandidate = raw;
          }
          let supFlow = null;
          if (supCandidate != null && typeof supCandidate === 'object' && !Array.isArray(supCandidate)) {
            const hasSup =
              (Array.isArray(supCandidate.stages) && supCandidate.stages.length > 0) ||
              (Array.isArray(supCandidate.transaction_nodes) && supCandidate.transaction_nodes.length > 0);
            if (hasSup) supFlow = supCandidate;
          }
          if (supFlow && typeof $().renderE2eBpmTransactionFlowHTML === 'function') {
            const e2eSupHtml = $().renderE2eBpmTransactionFlowHTML(supFlow);
            let supJsonPlain;
            try {
              supJsonPlain = JSON.stringify(supFlow, null, 2);
            } catch (_) {
              supJsonPlain = String(supFlow);
            }
            const jsonStrSup = $().escapeHtml(supJsonPlain);
            e2eScenarioSupplementCardHtml = `
        <div class="problem-detail-card problem-detail-card-e2e-flow problem-detail-card-e2e-scenario-supplement" data-task-id="e2e-flow-supplement">
          <div class="problem-detail-card-header problem-detail-card-e2e-flow-header" role="button" tabindex="0" aria-expanded="true">
            <span class="problem-detail-card-header-title">需求场景事务流补齐</span>
            <div class="problem-detail-e2e-flow-header-center-tabs">
              <div class="problem-detail-card-header-actions">
                <button type="button" class="problem-detail-card-tab problem-detail-card-tab-active" data-tab="view" aria-pressed="true">view</button>
                <button type="button" class="problem-detail-card-tab" data-tab="json" aria-pressed="false">json</button>
              </div>
            </div>
            <div class="problem-detail-e2e-flow-header-right-actions">
              <button type="button" class="problem-detail-e2e-flow-download-btn" title="将需求场景事务流补齐视图导出为 PNG" aria-label="下载需求场景事务流补齐图">下载图</button>
              <button type="button" class="problem-detail-e2e-flow-fs-btn" title="全屏显示需求场景事务流补齐" aria-label="全屏显示需求场景事务流补齐" aria-pressed="false">${e2eFsEnterIcon}${e2eFsExitIcon}</button>
              <span class="problem-detail-card-header-arrow">▾</span>
            </div>
          </div>
          <div class="problem-detail-card-body">
            <div class="problem-detail-card-body-detail problem-detail-it-gap-e2e-wrap">${e2eSupHtml}</div>
            <div class="problem-detail-card-body-json problem-detail-card-body-e2e-full-json" hidden><pre class="problem-detail-card-json-pre">${jsonStrSup}</pre></div>
          </div>
        </div>`;
          }
        }
        let globalItGapCardHtml = '';
        // 占位卡与 igSub===1 内正文共用全屏按钮 HTML，须定义在 if (igSub===1) 外，否则 ReferenceError
        const itDesignFsEnterIcon =
          '<svg class="problem-detail-value-stream-fs-icon-enter" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
        const itDesignFsExitIcon =
          '<svg class="problem-detail-value-stream-fs-icon-exit" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
        const itDesignFsBtnHtml = `<button type="button" class="problem-detail-e2e-flow-fs-btn problem-detail-it-design-supplement-fs-btn" title="全屏显示 IT设计补齐" aria-label="全屏显示 IT设计补齐" aria-pressed="false">${itDesignFsEnterIcon}${itDesignFsExitIcon}</button>`;
        if (igSub === 1) {
        const rawGlobalItGapAnalysis = item.globalItGapAnalysisJson;
        const msgsForItDesignWorkspace =
          typeof globalThis.getProblemDetailChatMessagesForCanonical === 'function'
            ? globalThis.getProblemDetailChatMessagesForCanonical(item)
            : Array.isArray(__appState.problemDetailChatMessages)
              ? __appState.problemDetailChatMessages
              : [];
        const idSessions =
          typeof $().resolveItDesignSupplementSessionsForTask8 === 'function'
            ? $().resolveItDesignSupplementSessionsForTask8(item, msgsForItDesignWorkspace)
            : Array.isArray(item.itDesignSupplementSessions)
              ? item.itDesignSupplementSessions
              : [];
        // 与 main.js `resolveItDesignSupplementSessionsForTask8` 对齐：已下发 Session 计划（内存/落库有 sessions）即展示事务子卡；
        // 勿要求先有一条 designOutputJson，否则自动顺序执行首轮 LLM 完成前工作区永远只有占位说明，与左侧聊天不同步。
        const isItDesignV1 =
          (rawGlobalItGapAnalysis && rawGlobalItGapAnalysis.itDesignSupplementV1 === true) ||
          idSessions.length > 0 ||
          idSessions.some((s) => s && s.designOutputJson != null);
        if (isItDesignV1) {
          const rows =
            idSessions.length > 0
              ? idSessions
              : Array.isArray(rawGlobalItGapAnalysis?.transactions)
                ? rawGlobalItGapAnalysis.transactions.map((t, i) => ({
                    stepIndex: t.stepIndex ?? i,
                    stageName: t.stageName || '',
                    transactionId: t.transactionId || '',
                    transactionName: t.transactionName || t.transactionId || `事务${i + 1}`,
                    designOutputJson: t.design_output != null ? { design_output: t.design_output } : null,
                    bpmFlowDrawMarkdown: t.bpm_flow_diagram_markdown != null ? String(t.bpm_flow_diagram_markdown) : undefined,
                  }))
                : [];
          const e2eForItDesignTx =
            typeof $().resolveE2eTransactionFlowJsonForWorkspace === 'function'
              ? $().resolveE2eTransactionFlowJsonForWorkspace(item, msgsForItDesignWorkspace)
              : null;
          const txCardsHtml = rows
            .map((s) => {
              const title = s.stageName
                ? `${$().escapeHtml(s.stageName)} · ${$().escapeHtml(s.transactionName || s.transactionId)}`
                : $().escapeHtml(s.transactionName || s.transactionId || `事务${(s.stepIndex ?? 0) + 1}`);
              const out = s.designOutputJson;
              let inner = '<p class="problem-detail-local-itgap-pending">待执行（请在聊天区 Session 计划点击自动顺序执行）</p>';
              if (out != null) {
                if (typeof window.buildItDesignSupplementTransactionViewHtml === 'function') {
                  const rm = typeof $().renderMarkdown === 'function' ? $().renderMarkdown : null;
                  const bpmFlow =
                    typeof window.getBpmDetailedFlowForItDesignSession === 'function'
                      ? window.getBpmDetailedFlowForItDesignSession(e2eForItDesignTx, s)
                      : [];
                  inner = window.buildItDesignSupplementTransactionViewHtml(
                    out,
                    $().escapeHtml,
                    s.bpmFlowDrawMarkdown,
                    rm,
                    bpmFlow,
                    s.transactionName || s.transactionId || '',
                  );
                } else {
                  try {
                    const pretty = JSON.stringify(out, null, 2);
                    inner = `<pre class="problem-detail-local-itgap-json-pre">${$().escapeHtml(pretty)}</pre>`;
                  } catch (_) {
                    inner = `<pre class="problem-detail-local-itgap-json-pre">${$().escapeHtml(String(out))}</pre>`;
                  }
                }
              }
              return `<div class="problem-detail-local-itgap-subcard problem-detail-it-design-supplement-tx-card" data-it-design-step="${$().escapeHtml(String(s.stepIndex ?? ''))}">
            <div class="problem-detail-local-itgap-subcard-header"><span class="problem-detail-local-itgap-subcard-title">${title}</span></div>
            <div class="problem-detail-local-itgap-subcard-body">${inner}</div>
          </div>`;
            })
            .join('');
          const aggPlain = JSON.stringify(
            idSessions.length > 0 && typeof window.buildAggregateGlobalItGapFromSessions === 'function'
              ? window.buildAggregateGlobalItGapFromSessions(idSessions)
              : rawGlobalItGapAnalysis && rawGlobalItGapAnalysis.itDesignSupplementV1
                ? rawGlobalItGapAnalysis
                : { itDesignSupplementV1: true, transactions: [] },
            null,
            2,
          );
          const jsonStrV1 = $().escapeHtml(aggPlain);
          const structuredWrap = `<div class="problem-detail-it-design-supplement-tx-list">${txCardsHtml}</div>`;
          globalItGapCardHtml = `
        <div class="problem-detail-card problem-detail-card-global-itgap problem-detail-card-it-design-supplement" data-task-id="global-itgap">
          <div class="problem-detail-card-header problem-detail-it-design-supplement-header" role="button" tabindex="0" aria-expanded="true">
            <span class="problem-detail-card-header-title">IT设计补齐</span>
            <div class="problem-detail-it-design-supplement-header-center-tabs">
              <div class="problem-detail-card-header-actions">
                <button type="button" class="problem-detail-card-tab problem-detail-card-tab-active" data-tab="detail" aria-pressed="true">view</button>
                <button type="button" class="problem-detail-card-tab" data-tab="json" aria-pressed="false">json</button>
              </div>
            </div>
            <div class="problem-detail-it-design-supplement-header-right">
              <button type="button" class="problem-detail-workspace-json-download-btn" data-workspace-json-kind="it-design-supplement" title="下载当前 IT设计补齐 JSON 文件" aria-label="下载 IT设计补齐 JSON">下载 json</button>
              ${itDesignFsBtnHtml}
              <span class="problem-detail-card-header-arrow">▾</span>
            </div>
          </div>
          <div class="problem-detail-card-body">
            <div class="problem-detail-card-body-detail problem-detail-global-itgap-detail">${structuredWrap}</div>
            <div class="problem-detail-card-body-json problem-detail-card-body-global-itgap-full-json" hidden><pre class="problem-detail-card-json-pre">${jsonStrV1}</pre></div>
          </div>
        </div>`;
        } else if (rawGlobalItGapAnalysis) {
          const analysis = $().normalizeGlobalItGapAnalysisShape(rawGlobalItGapAnalysis);
          const structuredHtml = `<div class="problem-detail-global-itgap-phases-wrap">${$().buildGlobalItGapWorkspacePhaseSubcardsHtml(analysis)}</div>`;
          const globalItGapJsonPlain = JSON.stringify(analysis, null, 2);
          const jsonStr = $().escapeHtml(globalItGapJsonPlain);
          const compressedRaw = $().getGlobalItGapCompressedJsonForWorkspace(item);
          let globalItGapCompressPanelHtml = '<p class="problem-detail-local-itgap-pending">暂无压缩结果（请在聊天区确认 IT设计补齐 后自动压缩）</p>';
          let globalItGapCompDisplayStr = '';
          if (compressedRaw && String(compressedRaw).trim()) {
            try {
              globalItGapCompDisplayStr = JSON.stringify(
                JSON.parse(String(compressedRaw).trim().replace(/^\uFEFF/, '')),
                null,
                2
              );
              globalItGapCompressPanelHtml = `<pre class="problem-detail-card-json-pre">${$().escapeHtml(globalItGapCompDisplayStr)}</pre>`;
            } catch (_) {
              globalItGapCompDisplayStr = String(compressedRaw);
              globalItGapCompressPanelHtml = `<pre class="problem-detail-card-json-pre">${$().escapeHtml(globalItGapCompDisplayStr)}</pre>`;
            }
          }
          let globalItGapCompressRatioHtml = '';
          if (globalItGapCompDisplayStr && globalItGapJsonPlain.length > 0) {
            const jsonLen = globalItGapJsonPlain.length;
            const compLen = globalItGapCompDisplayStr.length;
            const ratioPct = ((jsonLen - compLen) / jsonLen) * 100;
            const pctStr = Number.isFinite(ratioPct) ? ratioPct.toFixed(1) : '—';
            globalItGapCompressRatioHtml = `<span class="problem-detail-local-itgap-compress-ratio" title="压缩比率 = (原始 JSON 展示字数 − 压缩后展示字数) ÷ 原始 JSON 展示字数">（压缩率 ${pctStr}%）</span>`;
          }
          globalItGapCardHtml = `
        <div class="problem-detail-card problem-detail-card-global-itgap problem-detail-card-it-design-supplement" data-task-id="global-itgap">
          <div class="problem-detail-card-header problem-detail-it-design-supplement-header" role="button" tabindex="0" aria-expanded="true">
            <span class="problem-detail-card-header-title">IT设计补齐</span>
            <div class="problem-detail-it-design-supplement-header-center-tabs">
              <div class="problem-detail-card-header-actions">
                <button type="button" class="problem-detail-card-tab problem-detail-card-tab-active" data-tab="detail" aria-pressed="true">view</button>
                <button type="button" class="problem-detail-card-tab" data-tab="json" aria-pressed="false">json</button>
                <span class="problem-detail-local-itgap-aggregate-header-tab-wrap">
                  <button type="button" class="problem-detail-card-tab" data-tab="compressed-json" aria-pressed="false">压缩 json</button>${globalItGapCompressRatioHtml}
                </span>
              </div>
            </div>
            <div class="problem-detail-it-design-supplement-header-right">
              <button type="button" class="problem-detail-workspace-json-download-btn" data-workspace-json-kind="it-design-supplement" title="下载当前 IT设计补齐 JSON 文件" aria-label="下载 IT设计补齐 JSON">下载 json</button>
              ${itDesignFsBtnHtml}
              <span class="problem-detail-card-header-arrow">▾</span>
            </div>
          </div>
          <div class="problem-detail-card-body">
            <div class="problem-detail-card-body-detail problem-detail-global-itgap-detail">${structuredHtml}</div>
            <div class="problem-detail-card-body-json problem-detail-card-body-global-itgap-full-json" hidden><pre class="problem-detail-card-json-pre">${jsonStr}</pre></div>
            <div class="problem-detail-card-body-json problem-detail-card-body-global-itgap-compressed-json" hidden>${globalItGapCompressPanelHtml}</div>
          </div>
        </div>`;
        }
        }
        const itDesignWorkspacePlaceholder = `
        <div class="problem-detail-card problem-detail-card-global-itgap problem-detail-card-it-design-supplement" data-task-id="global-itgap">
          <div class="problem-detail-card-header problem-detail-it-design-supplement-header" role="button" tabindex="0" aria-expanded="true">
            <span class="problem-detail-card-header-title">IT设计补齐</span>
            <div class="problem-detail-it-design-supplement-header-center-tabs" aria-hidden="true"></div>
            <div class="problem-detail-it-design-supplement-header-right">
              <button type="button" class="problem-detail-workspace-json-download-btn" data-workspace-json-kind="it-design-supplement" title="下载当前 IT设计补齐 JSON 文件" aria-label="下载 IT设计补齐 JSON">下载 json</button>
              ${itDesignFsBtnHtml}
              <span class="problem-detail-card-header-arrow">▾</span>
            </div>
          </div>
          <div class="problem-detail-card-body">
            <div class="problem-detail-card-body-detail problem-detail-global-itgap-detail">
              <p class="problem-detail-local-itgap-pending">本页仅展示 IT设计补齐 工作区。请在聊天区确认「即将针对端到端事务流开展 IT设计补齐」后，按 Session 计划执行「自动顺序执行」。查看或调整 BPM 事务流请通过顶栏步骤条切换至「端到端事务流构建」。</p>
            </div>
          </div>
        </div>`;
        if (igSub === 0) {
          workspaceContent = e2eCardHtml + e2eScenarioSupplementCardHtml;
        } else if (igSub === 1) {
          workspaceContent = globalItGapCardHtml || itDesignWorkspacePlaceholder;
        } else {
          const msgsForTask9 =
            typeof globalThis.getProblemDetailChatMessagesForCanonical === 'function'
              ? globalThis.getProblemDetailChatMessagesForCanonical(item)
              : Array.isArray(__appState.problemDetailChatMessages)
                ? __appState.problemDetailChatMessages
                : [];
          const task9Started = msgsForTask9.some(
            (m) =>
              m &&
              m.type === 'taskStartNotification' &&
              String(m.taskId) === 'task9' &&
              m.confirmed,
          );
          let task9WorkspaceInner = '';
          const osmRaw = item && item.objectStateMachineJson;
          let osm = osmRaw;
          if (typeof osmRaw === 'string' && String(osmRaw).trim()) {
            try {
              osm = JSON.parse(String(osmRaw).trim().replace(/^\uFEFF/, ''));
            } catch (_) {
              osm = null;
            }
          }
          const hasOsm = osm != null && typeof osm === 'object';
          if (!task9Started) {
            task9WorkspaceInner =
              '<p class="problem-detail-local-itgap-pending">请先在对话区对本任务「任务启动通知」点击确认开始。确认后将自动调用大模型生成状态机 JSON（含 <code>mermaid_diagram</code>）并展示于此；任务完工以聊天区「已完成」确认及案例 itGapCompletedStages 含 2 为准。</p>';
          } else if (hasOsm) {
            const sm = osm;
            /** @param {Record<string, unknown>} o */
            const stripMermaidForJsonTab = (o) => {
              if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
              const { mermaid_diagram: _md1, mermaidDiagram: _md2, ...rest } = o;
              return rest;
            };
            const mermaidPlain =
              sm && typeof sm === 'object' && !Array.isArray(sm)
                ? String(sm.mermaid_diagram ?? sm.mermaidDiagram ?? '').trim()
                : '';
            const smForJsonTab = stripMermaidForJsonTab(sm);
            let jsonPlain;
            try {
              jsonPlain = JSON.stringify(smForJsonTab, null, 2);
            } catch (_) {
              jsonPlain = String(smForJsonTab);
            }
            const jsonStr = $().escapeHtml(jsonPlain);
            const mermaidStoreEsc = $().escapeHtml(mermaidPlain);
            const viewInner =
              typeof globalThis.buildObjectStateMachineWorkspaceView === 'function'
                ? globalThis.buildObjectStateMachineWorkspaceView(sm, $().escapeHtml)
                : `<p class="problem-detail-local-itgap-pending">状态机视图脚本未加载，请刷新页面。</p>`;
            task9WorkspaceInner = `
            <div class="problem-detail-card-body-detail problem-detail-task9-osm-view-wrap problem-detail-task9-osm-view-json" data-task9-tab-panel="json-view">${viewInner}</div>
            <div class="problem-detail-card-body-detail problem-detail-task9-osm-view-mermaid" data-task9-tab-panel="mermaid-view" hidden>
              <div class="task9-osm-mermaid-mount" data-task9-mermaid-hydrated="0">
                <p class="task9-osm-mermaid-placeholder problem-detail-local-itgap-pending"${mermaidPlain ? ' hidden' : ''}>暂无 Mermaid 源码：模型返回的 JSON 根上缺少 <code>mermaid_diagram</code> 字段或内容为空。</p>
                <textarea class="task9-osm-mermaid-raw-store" hidden readonly>${mermaidStoreEsc}</textarea>
                <div class="task9-osm-mermaid-run-host"></div>
              </div>
            </div>
            <div class="problem-detail-card-body-json problem-detail-card-body-task9-osm-json" data-task9-tab-panel="json-code" hidden><pre class="problem-detail-card-json-pre">${jsonStr}</pre></div>
            <div class="problem-detail-card-body-json problem-detail-card-body-task9-osm-mermaid" data-task9-tab-panel="mermaid-code" hidden><pre class="problem-detail-card-json-pre">${mermaidStoreEsc}</pre></div>`;
          } else {
            task9WorkspaceInner =
              '<p class="problem-detail-local-itgap-pending">已确认任务启动。若大模型正在生成，请查看左侧对话区进度；生成成功后此处将展示状态机 JSON 与 Mermaid 源码。若失败，请根据聊天区系统提示排查。</p>';
          }
          const task9Header =
            hasOsm && task9Started
              ? `
          <div class="problem-detail-card-header problem-detail-task9-osm-header" role="button" tabindex="0" aria-expanded="true">
            <span class="problem-detail-card-header-title">对象状态机构建</span>
            <div class="problem-detail-task9-osm-header-center-tabs">
              <div class="problem-detail-card-header-actions problem-detail-task9-osm-tablist">
                <button type="button" class="problem-detail-card-tab problem-detail-card-tab-active" data-tab="json-view" aria-pressed="true">Json-View</button>
                <button type="button" class="problem-detail-card-tab" data-tab="mermaid-view" aria-pressed="false">Mermaid-View</button>
                <button type="button" class="problem-detail-card-tab" data-tab="json-code" aria-pressed="false">json</button>
                <button type="button" class="problem-detail-card-tab" data-tab="mermaid-code" aria-pressed="false">mermaid</button>
              </div>
            </div>
            <div class="problem-detail-task9-osm-header-right">
              <span class="problem-detail-card-header-arrow">▾</span>
            </div>
          </div>`
              : `
          <div class="problem-detail-card-header problem-detail-task9-osm-card-header" role="button" tabindex="0" aria-expanded="true">
            <span class="problem-detail-card-header-title">对象状态机构建</span>
            <span class="problem-detail-card-header-arrow">▾</span>
          </div>`;
          workspaceContent = `
        <div class="problem-detail-card problem-detail-card-task9-object-state" data-task-id="task9-object-state">
          ${task9Header}
          <div class="problem-detail-card-body problem-detail-task9-osm-card-body">
            ${task9WorkspaceInner}
          </div>
        </div>`;
        }
      } else {
        workspaceContent = `
          <div class="problem-detail-workflow-align-placeholder">
            <h3 class="problem-detail-workflow-align-title">ITGap 分析</h3>
            <p class="problem-detail-workflow-align-desc">请先完成工作流对齐阶段的价值流图绘制后再进行 ITGap 分析。</p>
          </div>`;
      }
      const itGapScrollDataAttr =
        itGapWorkspaceSubAttr !== ''
          ? ` data-itgap-workspace-sub="${$().escapeHtml(itGapWorkspaceSubAttr)}"`
          : '';
      container.innerHTML = `
        <div class="problem-detail-workspace-scroll"${itGapScrollDataAttr}>
          ${workspaceContent}
        </div>`;
      if (valueStream && !valueStream.raw) {
        const igSubSetup = Math.max(0, Math.min(2, Number(itGapViewingSubstep) || 0));
        $().setupProblemDetailCardToggle();
        if (igSubSetup === 0) {
          $().setupProblemDetailE2eFlowFullscreen(container);
          $().setupProblemDetailE2eBpmTxPreview?.(container);
        }
        if (igSubSetup === 1) {
          $().setupGlobalItGapSubcardToggle();
          $().setupGlobalItGapWorkspaceDimensionTabs();
          if (typeof $().setupItDesignBpmFlowDrawTabs === 'function') {
            $().setupItDesignBpmFlowDrawTabs(container);
          }
          $().setupProblemDetailItDesignSupplementFullscreen?.(container);
        }
        if (igSubSetup === 2 && typeof globalThis.setupObjectStateMachineWorkspace === 'function') {
          const osmRoot = container.querySelector('.osm-workspace-root');
          if (osmRoot) globalThis.setupObjectStateMachineWorkspace(osmRoot);
        }
      }
      return;
    }
    if (problemDetailViewingMajorStage >= 1) {
      // 工作区价值流区：价值流图来自 vsm_data（存为 item.valueStream）；设计逻辑字段仍落库，工作区不再单独展示逻辑卡片
      const valueStream =
        typeof $().resolveValueStreamForWorkflowAlignWorkspace === 'function'
          ? $().resolveValueStreamForWorkflowAlignWorkspace(item)
          : item.valueStream; // vsm_data：{ stages, connections }；缺省时 __host 从 valueStreamCard 还原
      let workspaceContent = '';
      if (valueStream && !valueStream.raw) {
        const displayValueStream = $().buildWorkflowAlignDisplayValueStream(item, valueStream);
        if (typeof console !== 'undefined' && typeof console.log === 'function') {
          try {
            const vsStagesLen = Array.isArray(displayValueStream?.stages) ? displayValueStream.stages.length : 0;
            const vsStepsLen = (Array.isArray(displayValueStream?.stages) ? displayValueStream.stages : [])
              .reduce((n, s) => n + (Array.isArray(s?.steps) ? s.steps.length : 0), 0);
            console.log('[FE:task4-workspace-render]', {
              caseId: item?.id || null,
              createdAt: item?.createdAt || null,
              archiveNo: item?.archiveNo || null,
              wfCompleted: item?.workflowAlignCompletedStages || [],
              firstUncompletedTaskId: $().getFirstUncompletedTask(item)?.id || null,
              vsStagesLen,
              vsStepsLen,
            });
          } catch (_) {}
        }
        const graphHtml = $().renderValueStreamViewHTML(displayValueStream); // 根据当前阶段门控后的 vsm_data 渲染绘图
        const jsonStr = $().escapeHtml(JSON.stringify(displayValueStream, null, 2));
        const vsFsEnterIcon =
          '<svg class="problem-detail-value-stream-fs-icon-enter" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
        const vsFsExitIcon =
          '<svg class="problem-detail-value-stream-fs-icon-exit" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
        workspaceContent = `
        <div class="problem-detail-value-stream-card" data-task-id="task4">
          <div class="problem-detail-value-stream-card-header">
            <div class="problem-detail-value-stream-header-tabs">
              <button type="button" class="problem-detail-value-stream-tab problem-detail-value-stream-tab-active" data-tab="view">价值流图</button>
              <button type="button" class="problem-detail-value-stream-tab" data-tab="json">价值流图json</button>
            </div>
            <div class="problem-detail-value-stream-header-actions">
              <button type="button" class="problem-detail-value-stream-download-btn" title="将当前价值流图导出为 PNG 图片" aria-label="下载价值流图">下载图</button>
              <button type="button" class="problem-detail-workspace-json-download-btn" data-workspace-json-kind="value-stream" title="下载当前价值流图 JSON 文件" aria-label="下载价值流图 JSON">下载 json</button>
              <button type="button" class="problem-detail-value-stream-fs-btn" title="全屏显示价值流图" aria-label="全屏显示价值流图" aria-pressed="false">${vsFsEnterIcon}${vsFsExitIcon}</button>
            </div>
          </div>
          <div class="problem-detail-value-stream-card-body">
            <div class="problem-detail-value-stream-panel" data-panel="view">${graphHtml}</div>
            <div class="problem-detail-value-stream-panel" data-panel="json" hidden><pre class="problem-detail-card-json-pre">${jsonStr}</pre></div>
          </div>
        </div>`;
      } else {
        workspaceContent = `
          <div class="problem-detail-workflow-align-placeholder">
            <h3 class="problem-detail-workflow-align-title">工作流对齐</h3>
            <p class="problem-detail-workflow-align-desc">此阶段将基于需求逻辑，进行工作流与业务场景的对齐分析。请先在聊天区确认价值流图设计 JSON 后点击「开始绘制价值流图」的确认按钮。</p>
          </div>`;
      }
      container.innerHTML = `
        <div class="problem-detail-workspace-scroll">
          ${workspaceContent}
        </div>`;
      if (valueStream && !valueStream.raw) {
        $().setupProblemDetailValueStreamTabs(container);
      }
      return;
    }
    const prelimEsc = $().escapeHtml;
    const preliminaryViewHtml =
      typeof __pdrHost().buildPreliminaryWorkspaceSectionTabsHtml === 'function'
        ? __pdrHost().buildPreliminaryWorkspaceSectionTabsHtml(item, prelimEsc)
        : typeof __pdrHost().buildPreliminaryCardRowsHtml === 'function'
          ? __pdrHost().buildPreliminaryCardRowsHtml(item, prelimEsc)
          : '';
    const preliminaryStructuredJsonRaw =
      typeof __pdrHost().buildPreliminaryStructuredJsonString === 'function'
        ? __pdrHost().buildPreliminaryStructuredJsonString(item)
        : '{}';
    const preliminaryStructuredJsonHtml = prelimEsc(preliminaryStructuredJsonRaw);
    const preliminaryHistoryHtml =
      typeof __pdrHost().buildPreliminaryHistoryHtml === 'function' ? __pdrHost().buildPreliminaryHistoryHtml(item, prelimEsc) : '';
    __logTask1PrelimRender('workspace-preliminary', {
      caseKey:
        typeof __pdrHost().getProblemDetailChatStorageKey === 'function'
          ? __pdrHost().getProblemDetailChatStorageKey(item)
          : String(item?.id || item?.createdAt || ''),
      hasPreliminaryReq: !!item?.preliminaryReq,
      preliminaryReqTopKeys: item?.preliminaryReq && typeof item.preliminaryReq === 'object' ? Object.keys(item.preliminaryReq) : [],
      requirementDetailHistoryLen: Array.isArray(item?.requirementDetailHistory) ? item.requirementDetailHistory.length : -1,
      viewHtmlLen: String(preliminaryViewHtml || '').length,
      jsonRawLen: String(preliminaryStructuredJsonRaw || '').length,
      historyHtmlLen: String(preliminaryHistoryHtml || '').length,
      waitingForFeedback: (() => {
        const w = globalThis.SmartCto.problemDetailRuntime.__host.getProblemDetailWaitingForFeedback?.();
        return w
          ? {
              taskId: w.taskId,
              type: w.type,
              prelimSupplement: !!w.prelimSupplement,
              prelimSupplementModify: !!w.prelimSupplementModify,
              createdAt: w.createdAt,
            }
          : null;
      })(),
    });
    const basicInfoLabels = [
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
    let basicInfoCardHtml = '';
    const basicInfoObj = globalThis.SmartCto.problemDetailRuntime.__host.getProblemDetailConfirmedBasicInfo();
    if (basicInfoObj) {
      /** @param {string} key */
      const basicInfoKeyHasContent = (key) => {
        const v = basicInfoObj[key];
        if (v == null) return false;
        if (typeof v === 'boolean') return true;
        return String(v).trim() !== '';
      };
      const filledBasicInfoLabels = basicInfoLabels.filter(({ key }) => basicInfoKeyHasContent(key));
      const renderWs =
        typeof __pdrHost().renderRequirementWorkspaceFieldValueHtml === 'function'
          ? __pdrHost().renderRequirementWorkspaceFieldValueHtml
          : (esc) =>
              (typeof __pdrHost().renderMarkdownBold === 'function' ? __pdrHost().renderMarkdownBold(esc) : esc).replace(/\n/g, '<br>');
      const basicInfoRows =
        filledBasicInfoLabels.length === 0
          ? '<p class="problem-detail-basic-info-ws-empty">暂无已填写字段。</p>'
          : filledBasicInfoLabels
              .map(({ key, label }) => {
                const raw = basicInfoObj[key];
                const value = raw != null ? String(raw).trim() : '';
                const valueHtml = renderWs($().escapeHtml(value));
                return `<div class="problem-detail-row" data-field="${$().escapeHtml(label)}"><span class="problem-detail-label">${$().escapeHtml(label)}</span><span class="problem-detail-value">${valueHtml}</span></div>`;
              })
              .join('');
      const basicInfoJsonPayload = {};
      for (const { key } of filledBasicInfoLabels) {
        basicInfoJsonPayload[key] = basicInfoObj[key];
      }
      const basicInfoJsonStr = $().escapeHtml(JSON.stringify(basicInfoJsonPayload, null, 2));
      basicInfoCardHtml = `
    <div class="problem-detail-card problem-detail-card-basic-info" data-task-id="task1">
      <div class="problem-detail-card-header problem-detail-card-header-collapsed" role="button" tabindex="0" aria-expanded="false">
        <span class="problem-detail-card-header-title">客户基本信息</span>
        <div class="problem-detail-card-header-actions">
          <button type="button" class="problem-detail-card-tab problem-detail-card-tab-active" data-tab="detail" aria-pressed="true">view</button>
          <button type="button" class="problem-detail-card-tab" data-tab="json" aria-pressed="false">JSON</button>
        </div>
        <span class="problem-detail-card-header-arrow">▾</span>
      </div>
      <div class="problem-detail-card-body" hidden>
        <div class="problem-detail-card-body-detail">${basicInfoRows}</div>
        <div class="problem-detail-card-body-json" hidden><pre class="problem-detail-card-json-pre">${basicInfoJsonStr}</pre></div>
      </div>
    </div>`;
    }
    let bmcCardHtml = '';
    if (item.bmc) {
      const bmcFsEnterIcon =
        '<svg class="problem-detail-value-stream-fs-icon-enter" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
      const bmcFsExitIcon =
        '<svg class="problem-detail-value-stream-fs-icon-exit" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
      const bmc = item.bmc;
      const renderWs =
        typeof __pdrHost().renderRequirementWorkspaceFieldValueHtml === 'function'
          ? __pdrHost().renderRequirementWorkspaceFieldValueHtml
          : (esc) =>
              (typeof __pdrHost().renderMarkdownBold === 'function' ? __pdrHost().renderMarkdownBold(esc) : esc).replace(/\n/g, '<br>');
      const coreNames = collectBmcHighlightEntityNames(item);
      const escH = (s) => $().escapeHtml(s);
      const bmcRows = $()
        .BMC_FIELDS.map(({ key, label }) => {
          let raw = bmc[key] != null ? String(bmc[key]).trim() : '';
          if (raw) raw = stripLeadingBmcNineGridTitleEcho(raw, label);
          const lis = buildBmcWsBulletLisFromRaw(raw, renderWs, coreNames, escH);
          return `<div class="problem-detail-bmc-ws-cell" data-field="${escH(label)}"><div class="problem-detail-bmc-ws-cell-title">${escH(label)}</div><ul class="problem-detail-bmc-ws-cell-list">${lis}</ul></div>`;
        })
        .join('');
      const industryInsight = (bmc.industry_insight || '').trim();
      const painPoints = (bmc.pain_points || '').trim();
      const bmcJsonStr = $().escapeHtml(JSON.stringify(bmc, null, 2));
      const industryStrip = industryInsight
        ? `<div class="problem-detail-bmc-ws-cell problem-detail-bmc-ws-strip" data-field="${escH('行业背景洞察')}"><div class="problem-detail-bmc-ws-cell-title">${escH('行业背景洞察')}</div><ul class="problem-detail-bmc-ws-cell-list">${buildBmcWsBulletLisFromRaw(industryInsight, renderWs, coreNames, escH)}</ul></div>`
        : '';
      const painStrip = painPoints
        ? `<div class="problem-detail-bmc-ws-cell problem-detail-bmc-ws-strip" data-field="${escH('业务痛点预判')}"><div class="problem-detail-bmc-ws-cell-title">${escH('业务痛点预判')}</div><ul class="problem-detail-bmc-ws-cell-list">${buildBmcWsBulletLisFromRaw(painPoints, renderWs, coreNames, escH)}</ul></div>`
        : '';
      const bmcDetailContent = `
        <div class="problem-detail-bmc-ws-stack">
        ${industryStrip}
        <div class="problem-detail-bmc-grid problem-detail-bmc-ws-grid">${bmcRows}</div>
        ${painStrip}
        </div>`;
      bmcCardHtml = `
    <div class="problem-detail-card problem-detail-card-bmc" data-task-id="task2">
      <div class="problem-detail-card-header" role="button" tabindex="0" aria-expanded="true">
        <span class="problem-detail-card-header-title">商业模式画布 BMC</span>
        <div class="problem-detail-card-header-actions">
          <button type="button" class="problem-detail-card-tab problem-detail-card-tab-active" data-tab="detail" aria-pressed="true">view</button>
          <button type="button" class="problem-detail-card-tab" data-tab="json" aria-pressed="false">JSON</button>
          <span class="problem-detail-card-bmc-header-tools">
            <button type="button" class="problem-detail-bmc-download-btn" title="将当前商业模式画布视图导出为 PNG" aria-label="下载商业模式画布图">下载图</button>
            <button type="button" class="problem-detail-e2e-flow-fs-btn problem-detail-bmc-fs-btn" title="全屏显示商业模式画布" aria-label="全屏显示商业模式画布" aria-pressed="false">${bmcFsEnterIcon}${bmcFsExitIcon}</button>
          </span>
        </div>
        <span class="problem-detail-card-header-arrow">▾</span>
      </div>
      <div class="problem-detail-card-body">
        <div class="problem-detail-card-body-detail"><div class="problem-detail-bmc-capture-root">${bmcDetailContent}</div></div>
        <div class="problem-detail-card-body-json" hidden><pre class="problem-detail-card-json-pre">${bmcJsonStr}</pre></div>
      </div>
    </div>`;
    }
    let requirementLogicCardHtml = '';
    if (item.requirementLogic) {
      const parsed = $().parseRequirementLogicFromMarkdown(item.requirementLogic);
      const hasAnyContent = $().REQUIREMENT_LOGIC_SECTIONS.some(({ key }) => (parsed[key] || '').trim());
      const renderWs =
        typeof __pdrHost().renderRequirementWorkspaceFieldValueHtml === 'function'
          ? __pdrHost().renderRequirementWorkspaceFieldValueHtml
          : (esc) =>
              (typeof __pdrHost().renderMarkdownBold === 'function' ? __pdrHost().renderMarkdownBold(esc) : esc).replace(/\n/g, '<br>');
      const extractCausal =
        typeof __pdrHost().extractCausalChainNodesFromLogicSummary === 'function'
          ? __pdrHost().extractCausalChainNodesFromLogicSummary
          : null;
      const causalArrowHtml =
        '<span class="problem-detail-logic-causal-arrow" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';
      const escH = (s) => $().escapeHtml(s);
      const logicStrip = (labelEsc, bodyHtml) =>
        `<div class="problem-detail-logic-ws-strip" data-field="${labelEsc}"><div class="problem-detail-bmc-ws-cell-title">${labelEsc}</div>${bodyHtml}</div>`;
      const logicStackInner = hasAnyContent
        ? $()
            .REQUIREMENT_LOGIC_SECTIONS.map(({ key, label }) => {
              const val = (parsed[key] || '').trim() || '—';
              const labelEsc = escH(label);
              if (key === 'logic_summary' && val !== '—' && extractCausal) {
                const nodes = extractCausal(val);
                if (nodes.length >= 2) {
                  const parts = [];
                  for (let i = 0; i < nodes.length; i++) {
                    const inner = renderWs(escH(nodes[i]));
                    parts.push(
                      `<div class="problem-detail-logic-causal-node" data-node-index="${i}"><div class="problem-detail-logic-causal-node-body markdown-body">${inner}</div></div>`,
                    );
                    if (i < nodes.length - 1) parts.push(causalArrowHtml);
                  }
                  const causalBody = `<div class="problem-detail-logic-ws-strip-causal-inner"><div class="problem-detail-logic-causal-chain">${parts.join('')}</div></div>`;
                  return logicStrip(labelEsc, causalBody);
                }
              }
              const lisHtml = `<ul class="problem-detail-bmc-ws-cell-list">${buildBmcWsBulletLisFromRaw(val === '—' ? '' : val, renderWs, [], escH)}</ul>`;
              return logicStrip(labelEsc, lisHtml);
            })
            .join('')
        : (() => {
            const lisHtml = `<ul class="problem-detail-bmc-ws-cell-list">${buildBmcWsBulletLisFromRaw(item.requirementLogic || '', renderWs, [], escH)}</ul>`;
            return logicStrip(escH('原始输出'), lisHtml);
          })();
      const logicRows = `<div class="problem-detail-logic-ws-stack">${logicStackInner}</div>`;
      const logicJson = {};
      $().REQUIREMENT_LOGIC_SECTIONS.forEach(({ key, label }) => {
        logicJson[label] = (parsed[key] || '').trim() || '—';
      });
      const logicJsonStr = $().escapeHtml(JSON.stringify(logicJson, null, 2));
      requirementLogicCardHtml = `
    <div class="problem-detail-card problem-detail-card-requirement-logic" data-task-id="task3">
      <div class="problem-detail-card-header" role="button" tabindex="0" aria-expanded="true">
        <span class="problem-detail-card-header-title">需求逻辑</span>
        <div class="problem-detail-card-header-actions">
          <button type="button" class="problem-detail-card-tab problem-detail-card-tab-active" data-tab="detail" aria-pressed="true">view</button>
          <button type="button" class="problem-detail-card-tab" data-tab="json" aria-pressed="false">JSON</button>
        </div>
        <span class="problem-detail-card-header-right">
          <span class="problem-detail-card-header-arrow">▾</span>
          <button type="button" class="btn-delete-requirement-logic" aria-label="删除需求逻辑">删除</button>
        </span>
      </div>
      <div class="problem-detail-card-body">
        <div class="problem-detail-card-body-detail">${logicRows}</div>
        <div class="problem-detail-card-body-json" hidden><pre class="problem-detail-card-json-pre">${logicJsonStr}</pre></div>
      </div>
    </div>`;
    }
    const prelimFsEnterIcon =
      '<svg class="problem-detail-value-stream-fs-icon-enter" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    const prelimFsExitIcon =
      '<svg class="problem-detail-value-stream-fs-icon-exit" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
    const cardsHtml = `<div class="problem-detail-card problem-detail-card-preliminary-tabs" data-task-id="preliminary">
      <div class="problem-detail-card-header problem-detail-card-preliminary-header" role="button" tabindex="0" aria-expanded="true">
        <span class="problem-detail-card-header-title">初步需求</span>
        <div class="problem-detail-card-header-actions">
          <button type="button" class="problem-detail-card-tab problem-detail-card-tab-active" data-tab="detail" aria-pressed="true">view</button>
          <button type="button" class="problem-detail-card-tab" data-tab="prelim-json" aria-pressed="false">json</button>
          <button type="button" class="problem-detail-card-tab" data-tab="history" aria-pressed="false">历史详情</button>
        </div>
        <span class="problem-detail-card-preliminary-header-right">
          <button type="button" class="problem-detail-e2e-flow-fs-btn problem-detail-card-preliminary-fs-btn" title="全屏显示初步需求" aria-label="全屏显示初步需求" aria-pressed="false">${prelimFsEnterIcon}${prelimFsExitIcon}</button>
          <span class="problem-detail-card-header-arrow">▾</span>
        </span>
      </div>
      <div class="problem-detail-card-body">
        <div class="problem-detail-card-body-detail">${preliminaryViewHtml}</div>
        <div class="problem-detail-card-body-prelim-structured-json" hidden><pre class="problem-detail-card-json-pre problem-detail-prelim-full-json-pre">${preliminaryStructuredJsonHtml}</pre></div>
        <div class="problem-detail-card-body-preliminary-history" hidden>${preliminaryHistoryHtml}</div>
      </div>
    </div>${basicInfoCardHtml}${bmcCardHtml}${requirementLogicCardHtml}`;
    container.innerHTML = `<div class="problem-detail-workspace-scroll">
      <div class="problem-detail-workspace-cards">${cardsHtml}</div>
    </div>`;
    $().setupProblemDetailCardToggle();
    $().setupProblemDetailPreliminaryFullscreen?.(container);
    $().setupProblemDetailBmcWorkspace?.(container);
    $().setupPreliminaryHistoryItemToggle(container);
    } finally {
      $().updateProblemDetailTaskStepBar();
    }
}


async function handleProblemDetailChatSend(options) {
  const $ = __pdrHost;
  const el = $().el;
  const itStrategyPlanViewingSubstep = $().getItStrategyPlanViewingSubstep();
  const opts = options || {};
  const input = el.problemDetailChatInput;
  const container = el.problemDetailChatMessages;
  const sendBtn = el.problemDetailChatSend;
  if (!input || !container) return;
  const text = (opts.overrideText != null ? String(opts.overrideText) : (input.value || '')).trim();
  if (!text) return;
  if (sendBtn) sendBtn.disabled = true;
  if (!opts.skipInputClear) input.value = '';
  if (!opts.skipAppendUser) $().appendProblemDetailChatMessage(container, 'user', text);

  if (globalThis.SmartCto.problemDetailRuntime.__host.getProblemDetailWaitingForFeedback()) {
    const { taskId, createdAt, type, sourceMsgIndex, prelimSupplement, prelimSupplementModify } =
      globalThis.SmartCto.problemDetailRuntime.__host.getProblemDetailWaitingForFeedback();
    const caseKeyForFeedback = createdAt || $().getProblemDetailChatStorageKey(globalThis.SmartCto.appState.getState().currentProblemDetailItem);
    globalThis.SmartCto.problemDetailRuntime.__host.setProblemDetailWaitingForFeedback(null);
    if (prelimSupplementModify && taskId === 'task1' && type === 'modification') {
      if (!opts.skipAppendUser && globalThis.SmartCto.appState.getState().problemDetailChatMessages.length > 0) {
        const lastMsg =
          globalThis.SmartCto.appState.getState().problemDetailChatMessages[
            globalThis.SmartCto.appState.getState().problemDetailChatMessages.length - 1
          ];
        if (lastMsg && lastMsg.role === 'user') {
          lastMsg._logType = 'modify';
          if (caseKeyForFeedback) {
            $().saveProblemDetailChat(caseKeyForFeedback, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
          }
        }
      }
      const runPrelimMod =
        globalThis.SmartCto.problemDetailRuntime.__host.runTask1PreliminarySupplementModifyWithFeedback;
      if (typeof runPrelimMod === 'function') {
        await runPrelimMod(text, container);
      }
      if (sendBtn) sendBtn.disabled = false;
      return;
    }
    if (prelimSupplement && taskId === 'task1' && type === 'modification') {
      if (!opts.skipAppendUser && globalThis.SmartCto.appState.getState().problemDetailChatMessages.length > 0) {
        const lastMsg =
          globalThis.SmartCto.appState.getState().problemDetailChatMessages[
            globalThis.SmartCto.appState.getState().problemDetailChatMessages.length - 1
          ];
        if (lastMsg && lastMsg.role === 'user') {
          lastMsg._logType = 'modify';
          if (caseKeyForFeedback) {
            $().saveProblemDetailChat(caseKeyForFeedback, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
          }
        }
      }
      const runPrelimSup = globalThis.SmartCto.problemDetailRuntime.__host.runTask1PreliminarySupplementRefinement;
      if (typeof runPrelimSup === 'function') {
        await runPrelimSup(text, container);
      }
      if (sendBtn) sendBtn.disabled = false;
      return;
    }
    if (type === 'modification' && !opts.skipAppendUser && globalThis.SmartCto.appState.getState().problemDetailChatMessages.length > 0) {
      const lastMsg = globalThis.SmartCto.appState.getState().problemDetailChatMessages[globalThis.SmartCto.appState.getState().problemDetailChatMessages.length - 1];
      if (lastMsg && lastMsg.role === 'user') {
        lastMsg._logType = 'modify';
        if (caseKeyForFeedback) $().saveProblemDetailChat(caseKeyForFeedback, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
      }
    }
    if (type === 'modification' && !opts.modificationIntentConfirmed) {
      const parsingIntentBlock = document.createElement('div');
      parsingIntentBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
      parsingIntentBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在提炼修改意图…</span></div></div><div class="problem-detail-chat-msg-time">${$().getTimeStr()}</div>`;
      container.appendChild(parsingIntentBlock);
      container.scrollTop = container.scrollHeight;
      try {
        const taskNameForIntent = ($().FOLLOW_TASKS || []).concat($().ITGAP_HISTORY_TASKS || []).concat($().IT_STRATEGY_TASKS || []).find((t) => t.id === taskId)?.name || taskId;
        const chatsBeforeUser = globalThis.SmartCto.appState.getState().problemDetailChatMessages.length > 0 ? globalThis.SmartCto.appState.getState().problemDetailChatMessages.slice(0, -1) : [];
        const timelineCapOpts =
          (taskId === 'task5' || taskId === 'task6') && typeof $().getCompactTimelineOptsForHeavySessionTask === 'function'
            ? $().getCompactTimelineOptsForHeavySessionTask(taskId)
            : undefined;
        const timelineCtx = $().buildTaskTimelineContextForLLM(
          caseKeyForFeedback,
          taskId,
          chatsBeforeUser,
          timelineCapOpts,
        );
        const { reason, goal, llmMeta } = await $().extractModificationIntentWithLLM(text, taskId, taskNameForIntent, timelineCtx);
        parsingIntentBlock.remove();
        $().pushAndSaveProblemDetailChat({
          type: 'modificationIntentConfirmBlock',
          taskId,
          modificationReason: reason,
          modificationGoal: goal,
          userFeedback: text,
          sourceMsgIndex: (typeof sourceMsgIndex === 'number' ? sourceMsgIndex : -1),
          timestamp: $().getTimeStr(),
          confirmed: false,
          llmMeta,
        });
      } catch (err) {
        try {
          const st = typeof globalThis !== 'undefined' ? globalThis.__FE_LAST_MOD_INTENT_STATS : null;
          console.warn('[FE:mod-intent][fail]', {
            taskId,
            lastPayloadStats: st,
            statsAlignedWithThisTask: st?.taskId === taskId,
            message: err?.message || String(err),
          });
        } catch (_) {}
        parsingIntentBlock.classList.remove('problem-detail-chat-msg-parsing');
        const wrap = parsingIntentBlock.querySelector('.problem-detail-chat-msg-content-wrap');
        if (wrap) {
          wrap.innerHTML = `<div class="problem-detail-chat-msg-content">修改意图提炼失败：${$().escapeHtml(err.message || String(err))}</div>`;
        }
        $().pushAndSaveProblemDetailChat({ role: 'system', content: '修改意图提炼失败：' + (err.message || String(err)), timestamp: $().getTimeStr() });
        if (sendBtn) sendBtn.disabled = false;
        return;
      }
      container.innerHTML = '';
      $().renderProblemDetailChatFromStorage(container, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
      $().renderProblemDetailHistory();
      if (sendBtn) sendBtn.disabled = false;
      return;
    }
    if (taskId === 'task2' && type === 'discussion' && globalThis.SmartCto.appState.getState().problemDetailChatMessages.length > 0) {
      const lastMsg = globalThis.SmartCto.appState.getState().problemDetailChatMessages[globalThis.SmartCto.appState.getState().problemDetailChatMessages.length - 1];
      if (lastMsg && lastMsg.role === 'user') {
        lastMsg._logType = 'bmcDiscussionUser';
        if (caseKeyForFeedback) $().saveProblemDetailChat(caseKeyForFeedback, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
      }
    }
    const parsingBlock = document.createElement('div');
    parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
    parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在根据您的反馈${type === 'modification' ? '重新生成' : '讨论'}…</span></div></div><div class="problem-detail-chat-msg-time">${$().getTimeStr()}</div>`;
    container.appendChild(parsingBlock);
    container.scrollTop = container.scrollHeight;
    try {
      const chatsForRefinement = opts.skipAppendUser ? globalThis.SmartCto.appState.getState().problemDetailChatMessages.slice() : globalThis.SmartCto.appState.getState().problemDetailChatMessages.slice(0, -1);
      const timelineContext = $().buildTaskTimelineContextForLLM(caseKeyForFeedback, taskId, chatsForRefinement);
      if (taskId === 'task2') {
        if (type === 'discussion') {
          const runBmcDiscussionTurn = globalThis.SmartCto.problemDetailRuntime.__host.runBmcDiscussionTurn;
          if (!runBmcDiscussionTurn) throw new Error('BMC 讨论模式函数未定义');
          const baseBmcData = $().getBaseBmcData();
          const discussionHistory = $().getBmcDiscussionHistory();
          const { content: replyContent, usage, model, durationMs, fullPrompt } = await runBmcDiscussionTurn(baseBmcData, discussionHistory, text);
          parsingBlock.remove();
          $().pushAndSaveProblemDetailChat({
            type: 'bmcDiscussionLlmQueryBlock',
            taskId: 'task2',
            noteName: '大模型讨论应答',
            llmInputPrompt: fullPrompt || '',
            llmOutputRaw: replyContent || '',
            timestamp: $().getTimeStr(),
            llmMeta: { usage, model, durationMs },
          });
          $().pushAndSaveProblemDetailChat({
            type: 'bmcDiscussionReplyBlock',
            taskId: 'task2',
            content: replyContent,
            timestamp: $().getTimeStr(),
            llmMeta: { usage, model, durationMs },
          });
          container.innerHTML = '';
          $().renderProblemDetailChatFromStorage(container, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
          container.scrollTop = container.scrollHeight;
        $().renderProblemDetailHistory();
        $().updateProblemDetailChatDiscussionIndicator();
        if (sendBtn) sendBtn.disabled = false;
        return;
        }
        const basicInfoJson = globalThis.SmartCto.problemDetailRuntime.__host.getProblemDetailConfirmedBasicInfo() || globalThis.SmartCto.appState.getState().currentProblemDetailItem?.basicInfo || {};
        if (!basicInfoJson || Object.keys(basicInfoJson).length === 0) {
          throw new Error('商业画布加载需要已确认的客户基本信息');
        }
        const sourceMsg = typeof sourceMsgIndex === 'number' && sourceMsgIndex >= 0 && sourceMsgIndex < globalThis.SmartCto.appState.getState().problemDetailChatMessages.length ? globalThis.SmartCto.appState.getState().problemDetailChatMessages[sourceMsgIndex] : null;
        let prevBmc = sourceMsg?.data || {};
        if (!prevBmc || Object.keys(prevBmc).length === 0) {
          for (let i = globalThis.SmartCto.appState.getState().problemDetailChatMessages.length - 1; i >= 0; i--) {
            if (globalThis.SmartCto.appState.getState().problemDetailChatMessages[i]?.type === 'bmcCard') {
              prevBmc = globalThis.SmartCto.appState.getState().problemDetailChatMessages[i]?.data || {};
              break;
            }
          }
        }
        if (!prevBmc || Object.keys(prevBmc).length === 0) {
          throw new Error('商业画布加载需要已生成的 BMC 作为上下文');
        }
        const genFn = globalThis.SmartCto.problemDetailRuntime.__host.generateBmcFromBasicInfoWithFeedback;
        if (!genFn) throw new Error('BMC 细化生成函数未定义');
        const { parsed: bmc, usage, model, durationMs, fullPrompt, rawOutput } = await genFn(basicInfoJson, prevBmc, text, type);
        parsingBlock.remove();

        // 替换最近一次的 BMC 提炼结果：移除旧 bmcCard + 对应 task2LlmQueryBlock，避免出现多份待确认卡片
        const bmcIdx = globalThis.SmartCto.appState.getState().problemDetailChatMessages.findLastIndex((m) => m.type === 'bmcCard');
        const qIdx = (() => {
          if (bmcIdx < 0) return -1;
          for (let i = bmcIdx - 1; i >= 0; i--) {
            if (globalThis.SmartCto.appState.getState().problemDetailChatMessages[i]?.type === 'task2LlmQueryBlock') return i;
          }
          return -1;
        })();
        const toRemove = [bmcIdx, qIdx].filter((i) => typeof i === 'number' && i >= 0).sort((a, b) => b - a);
        if (toRemove.length) {
          toRemove.forEach((i) => globalThis.SmartCto.appState.getState().problemDetailChatMessages.splice(i, 1));
          if (caseKeyForFeedback) $().saveProblemDetailChat(caseKeyForFeedback, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
        }

        $().pushAndSaveProblemDetailChat(
          globalThis.SmartCto.problemDetailRuntime.__host.buildTask2LlmQueryMessage({
            fullPrompt,
            parsed: bmc,
            rawOutput,
            timestamp: $().getTimeStr(),
            usage,
            model,
            durationMs,
          })
        );
        $().pushAndSaveProblemDetailChat({
          type: 'bmcCard',
          data: bmc,
          confirmed: false,
          timestamp: $().getTimeStr(),
          llmMeta: { usage, model, durationMs },
        });

        container.innerHTML = '';
        $().renderProblemDetailChatFromStorage(container, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
        container.scrollTop = container.scrollHeight;
        $().renderProblemDetailHistory();
        if (sendBtn) sendBtn.disabled = false;
        return;
      }

      const sourceMsg = (typeof sourceMsgIndex === 'number' && sourceMsgIndex >= 0 && sourceMsgIndex < chatsForRefinement.length)
        ? chatsForRefinement[sourceMsgIndex]
        : null;
      const refResult = await $().requestRefinementFromFeedback(taskId, caseKeyForFeedback, timelineContext, text, type, sourceMsg, chatsForRefinement);
      parsingBlock.remove();
      if (refResult.modification) {
        const tp = refResult.task4PromptRevisionPhases;
        if (taskId === 'task4' && refResult.task4DualPhase && tp && tp.mirror && tp.hardening) {
          const pushModReg = (phaseLabel, inputPrompt, outputRaw, usage, model, durationMs) => {
            $().pushAndSaveProblemDetailChat({
              type: 'modificationRegenerateLlmQueryBlock',
              taskId: 'task4',
              promptRevisionOnly: true,
              noteName: phaseLabel,
              valueStreamPhase: 'prompt_revision',
              llmInputPrompt: inputPrompt || '',
              llmOutputRaw: outputRaw != null ? String(outputRaw) : '',
              timestamp: $().getTimeStr(),
              llmMeta: { usage, model, durationMs },
            });
          };
          pushModReg(
            '价值流·修改提示词优化（第一阶段·Mirror）',
            tp.mirror.firstRoundLlmInputPrompt,
            tp.mirror.firstRoundRaw,
            tp.mirror.usage,
            tp.mirror.model,
            tp.mirror.durationMs,
          );
          pushModReg(
            '价值流·修改提示词优化（第二阶段·分阶段加固）',
            tp.hardening.firstRoundLlmInputPrompt,
            tp.hardening.firstRoundRaw,
            tp.hardening.usage,
            tp.hardening.model,
            tp.hardening.durationMs,
          );
        } else {
          $().pushAndSaveProblemDetailChat({
            type: 'modificationPromptRevisionLlmQueryBlock',
            taskId,
            noteName: '修改·新提示词生成',
            llmInputPrompt: refResult.firstRoundLlmInputPrompt || '',
            llmOutputRaw: refResult.firstRound.content,
            skillTimelinePrompt: refResult.revision.newSystemPrompt,
            timestamp: $().getTimeStr(),
            llmMeta: {
              usage: refResult.firstRound.usage,
              model: refResult.firstRound.model,
              durationMs: refResult.firstRound.durationMs,
            },
          });
        }
        const pend = refResult.secondRoundPending || {};
        const confirmPayload = {
          type: 'modificationNewPromptConfirmBlock',
          taskId,
          sourceMsgIndex: typeof sourceMsgIndex === 'number' ? sourceMsgIndex : -1,
          newSystemPrompt: refResult.revision.newSystemPrompt,
          versionChangelog: refResult.revision.versionChangelog,
          firstRoundRaw: refResult.firstRound.content,
          systemForSecond: String(pend.systemForSecond || ''),
          userForSecond: String(pend.userForSecond || ''),
          timestamp: $().getTimeStr(),
          llmMeta: {
            usage: refResult.firstRound.usage,
            model: refResult.firstRound.model,
            durationMs: refResult.firstRound.durationMs,
          },
          confirmed: false,
        };
        if (taskId === 'task4' && refResult.task4DualPhase && tp && tp.mirror && tp.hardening) {
          confirmPayload.task4MirrorNewSystemPrompt = tp.mirror.newSystemPrompt;
          confirmPayload.task4MirrorVersionChangelog = tp.mirror.versionChangelog;
          confirmPayload.task4MirrorFirstRoundRaw = tp.mirror.firstRoundRaw;
          confirmPayload.task4MirrorSystemForSecond = tp.mirror.systemForSecond;
          confirmPayload.task4HardeningNewSystemPrompt = tp.hardening.newSystemPrompt;
          confirmPayload.task4HardeningVersionChangelog = tp.hardening.versionChangelog;
          confirmPayload.task4HardeningFirstRoundRaw = tp.hardening.firstRoundRaw;
          confirmPayload.task4HardeningSystemForSecond = tp.hardening.systemForSecond;
        }
        $().pushAndSaveProblemDetailChat(confirmPayload);
        container.innerHTML = '';
        $().renderProblemDetailChatFromStorage(container, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
        container.scrollTop = container.scrollHeight;
        $().renderProblemDetailHistory();
        if (sendBtn) sendBtn.disabled = false;
        return;
      }
      const content = refResult.content;
      const usage = refResult.usage;
      const model = refResult.model;
      const durationMs = refResult.durationMs;
      if (taskId === 'task1' && type === 'modification') {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content;
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed && typeof parsed === 'object' && (parsed.company_name != null || parsed.credit_code != null || parsed.business_scope != null)) {
            $().pushAndSaveProblemDetailChat({
              role: 'system',
              type: 'basicInfoCard',
              data: parsed,
              timestamp: $().getTimeStr(),
              confirmed: false,
              llmMeta: { usage, model, durationMs },
            });
            container.innerHTML = '';
            $().renderProblemDetailChatFromStorage(container, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
            container.scrollTop = container.scrollHeight;
            $().renderProblemDetailHistory();
            if (sendBtn) sendBtn.disabled = false;
            return;
          }
        } catch (_) {}
      }
      if (taskId === 'task4' && type === 'modification') {
        let valueStreamJson = null;
        const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonBlockMatch) {
          try {
            valueStreamJson = JSON.parse(jsonBlockMatch[1].trim());
          } catch (_) {}
        }
        if (!valueStreamJson) {
          const fallbackMatch = content.match(/\{[\s\S]*\}/);
          if (fallbackMatch) {
            try {
              valueStreamJson = JSON.parse(fallbackMatch[0]);
            } catch (_) {}
          }
        }
        if (valueStreamJson && typeof valueStreamJson === 'object') {
          const valueStream = valueStreamJson;
          $().pushAndSaveProblemDetailChat({
            type: 'valueStreamCard',
            taskId: 'task4',
            data: valueStream,
            logicText: content.replace(/```[\s\S]*?```/g, '').trim(),
            timestamp: $().getTimeStr(),
            confirmed: false,
            llmMeta: { usage, model, durationMs },
          });
          container.innerHTML = '';
          $().renderProblemDetailChatFromStorage(container, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
          container.scrollTop = container.scrollHeight;
          $().renderProblemDetailHistory();
          if (sendBtn) sendBtn.disabled = false;
          return;
        }
      }
      $().pushAndSaveProblemDetailChat({
        type: 'modificationResponseBlock',
        taskId,
        content,
        timestamp: $().getTimeStr(),
        llmMeta: { usage, model, durationMs },
        confirmed: false,
      });
      container.innerHTML = '';
      $().renderProblemDetailChatFromStorage(container, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
      $().renderProblemDetailHistory();
    } catch (err) {
      if (type === 'modification') {
        try {
          const st = typeof globalThis !== 'undefined' ? globalThis.__FE_LAST_MOD_REFINEMENT_STATS : null;
          const msg = String(err?.message || err || '');
          const isCtxLen = /context length|maximum context|tokens/i.test(msg);
          console.warn('[FE:mod-refinement][fail]', {
            taskId,
            isLikelyContextLength: isCtxLen,
            lastPayloadStats: st,
            statsAlignedWithThisTask: st?.taskId === taskId,
            message: err?.message || String(err),
          });
        } catch (_) {}
      }
      parsingBlock.classList.remove('problem-detail-chat-msg-parsing');
      const wrap = parsingBlock.querySelector('.problem-detail-chat-msg-content-wrap');
      if (wrap) wrap.innerHTML = `<div class="problem-detail-chat-msg-content">${type === 'modification' ? '重新生成' : '讨论'}失败：${$().escapeHtml(err.message || String(err))}</div>`;
      $().pushAndSaveProblemDetailChat({ role: 'system', content: `${type === 'modification' ? '重新生成' : '讨论'}失败：` + (err.message || String(err)), timestamp: $().getTimeStr() });
    }
    if (sendBtn) sendBtn.disabled = false;
    return;
  }

  /** task1 路由：须先于「阶段进度」启发式计算，避免需求/工商长文命中「项目进度」「当前…阶段」等子串后误答阶段、跳过初步需求提炼（业务口径对齐 commit 9f25d68） */
  const item = globalThis.SmartCto.appState.getState().currentProblemDetailItem;
  const dataItem = $().resolveProblemItemForTaskNotification() || item;
  const firstUncompleted = $().getFirstUncompletedTask(dataItem);
  const hasConfirmedBasicInfo = $().hasTask1BasicInfoFields($().getProblemDetailConfirmedBasicInfo() || dataItem?.basicInfo);
  const task1Pending = firstUncompleted?.id === 'task1' && !$().isTaskCompleted(dataItem, 'task1');
  const task1DirectInputAllowed = task1Pending && $().looksLikeTask1BasicInfoInput(text);
  const hasV2Prelim = task1HasEffectiveV2Preliminary(dataItem);
  const awaitingPrelim =
    task1Pending && hasConfirmedBasicInfo && dataItem?.task1PendingPreliminaryRequirement === true && !hasV2Prelim;
  // 已有 V2 初步需求时不得再走「输入框→工商自动提炼」：刷新后 basicInfo/confirmed 内存态短暂缺失时 isTask1Stage 会为 true，误占补充修订语义（FE-20260331）
  const isTask1Stage =
    task1Pending && !awaitingPrelim && !hasV2Prelim && (!hasConfirmedBasicInfo || task1DirectInputAllowed);

  // 特殊处理：用户询问「当前处于什么阶段 / 现在做到哪一步」等——不在 task1 待收工商/待收初步需求时触发，以免正文误匹配
  const stageQueryPattern =
    /当前.*阶段|现在.*阶段|目前.*阶段|目前处于.*阶段|现在处于.*阶段|项目.*进度|进度.*如何|做到哪一步|进行到哪/;
  if (stageQueryPattern.test(text) && !awaitingPrelim && !isTask1Stage) {
    const majorStageIndex = item?.currentMajorStage ?? 0;
    const majorStageLabel = $().PROBLEM_DETAIL_MAJOR_STAGE_LABELS[majorStageIndex] ?? String(majorStageIndex);
    let msg = `当前任务阶段为：${majorStageLabel}（索引 ${majorStageIndex}）。`;
    if (majorStageIndex === 3 && Array.isArray($().IT_STRATEGY_TASKS) && $().IT_STRATEGY_TASKS.length > 0) {
      const subIdx = typeof itStrategyPlanViewingSubstep === 'number' ? itStrategyPlanViewingSubstep : 0;
      const itStrategyTask = $().IT_STRATEGY_TASKS[subIdx] || $().IT_STRATEGY_TASKS[0];
      if (itStrategyTask?.name) {
        msg += ` 当前 IT 策略规划任务为：${itStrategyTask.name}（${itStrategyTask.id}）。`;
      }
    }
    const replyBlock = document.createElement('div');
    replyBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
    replyBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">${$().escapeHtml(
      msg
    )}</div></div><div class="problem-detail-chat-msg-time">${$().getTimeStr()}</div>`;
    container.appendChild(replyBlock);
    container.scrollTop = container.scrollHeight;
    $().pushAndSaveProblemDetailChat({ role: 'system', content: msg, timestamp: $().getTimeStr() });
    if (sendBtn) sendBtn.disabled = false;
    return;
  }

  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug('[FE:task1-input]', {
      firstUncompletedId: firstUncompleted?.id || null,
      hasConfirmedBasicInfo,
      awaitingPrelim,
      hitTask1AutoExtract: isTask1Stage,
    });
  }

  if (awaitingPrelim && text) {
    const task1PrelimBlock = document.createElement('div');
    task1PrelimBlock.className =
      'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing problem-detail-chat-preliminary-extracting';
    task1PrelimBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner" aria-hidden="true"></span><span class="problem-detail-chat-msg-content">我正在进行初步需求提炼</span></div></div><div class="problem-detail-chat-msg-time">${$().getTimeStr()}</div>`;
    container.appendChild(task1PrelimBlock);
    container.scrollTop = container.scrollHeight;
    try {
      if (!$().hasAiConfig()) {
        throw new Error('请先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）才能使用解析功能。');
      }
      const parseFn =
        typeof globalThis.parsePreliminaryRequirementDepthV2 === 'function'
          ? globalThis.parsePreliminaryRequirementDepthV2
          : typeof globalThis.parseDigitalProblemInput === 'function'
            ? globalThis.parseDigitalProblemInput
            : null;
      if (!parseFn) throw new Error('初步需求提炼模块未加载');
      const parsedResult = await parseFn(text);
      task1PrelimBlock.remove();
      const parsedCore = parsedResult?.parsed || {};
      const histEntry =
        typeof globalThis.buildRequirementDetailHistoryEntry === 'function'
          ? globalThis.buildRequirementDetailHistoryEntry(text)
          : { timestamp: new Date().toISOString(), content: text };
      const prevHist = Array.isArray(dataItem.requirementDetailHistory) ? [...dataItem.requirementDetailHistory] : [];
      const llmSnap = {
        noteName: '客户初步需求提炼（深度）',
        llmInputPrompt: parsedResult?.fullPrompt || '',
        llmOutputJson: parsedCore,
        llmOutputRaw: parsedResult?.rawOutput || '',
        llmMeta: parsedResult?.llmMeta || null,
      };
      const patchKeyPrelim = typeof $().getDigitalProblemPersistKey === 'function' ? $().getDigitalProblemPersistKey(dataItem) : '';
      let mergedAfterPrelimPatch = null;
      if (patchKeyPrelim && typeof $().mergeDigitalProblemPatch === 'function') {
        mergedAfterPrelimPatch = $().mergeDigitalProblemPatch(patchKeyPrelim, {
          preliminaryReq: parsedCore,
          requirementDetail: text,
          requirementDetailHistory: [...prevHist, histEntry],
          task1PendingPreliminaryRequirement: false,
          task1InitialLlmQuery: llmSnap,
        });
      }
      if (mergedAfterPrelimPatch && typeof globalThis.SmartCto.appState.setCurrentProblemDetailItem === 'function') {
        globalThis.SmartCto.appState.setCurrentProblemDetailItem(mergedAfterPrelimPatch);
      }
      const itemForPersist =
        mergedAfterPrelimPatch || globalThis.SmartCto.appState.getState().currentProblemDetailItem || dataItem;
      if (itemForPersist && typeof $().persistTask1InitialLlmQueryForItem === 'function') {
        $().persistTask1InitialLlmQueryForItem(itemForPersist, llmSnap);
      }
      $().pushAndSaveProblemDetailChat({
        ...$().buildTask1LlmQueryMessage({
          noteName: '客户初步需求提炼（深度）',
          fullPrompt: llmSnap.llmInputPrompt,
          parsed: parsedCore,
          rawOutput: llmSnap.llmOutputRaw,
          timestamp: $().getTimeStr(),
          usage: llmSnap.llmMeta?.usage,
          model: llmSnap.llmMeta?.model,
          durationMs: llmSnap.llmMeta?.durationMs,
        }),
      });
      $().pushAndSaveProblemDetailChat({
        type: 'preliminaryRequirementFollowupBlock',
        taskId: 'task1',
        content: '客户初步需求已经更新到工作区',
        timestamp: $().getTimeStr(),
      });
      container.innerHTML = '';
      $().renderProblemDetailChatFromStorage(container, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
      container.scrollTop = container.scrollHeight;
      renderProblemDetailContent();
      $().updateProblemDetailChatHeaderLabel();
      $().renderProblemDetailHistory();
    } catch (err) {
      task1PrelimBlock.classList.remove('problem-detail-chat-msg-parsing');
      const wrap = task1PrelimBlock.querySelector('.problem-detail-chat-msg-content-wrap');
      if (wrap) {
        wrap.innerHTML = `<div class="problem-detail-chat-msg-content">初步需求提炼失败：${$().escapeHtml(err.message || String(err))}</div>`;
      }
      $().pushAndSaveProblemDetailChat({
        role: 'system',
        content: '初步需求提炼失败：' + (err.message || String(err)),
        timestamp: $().getTimeStr(),
      });
    }
    if (sendBtn) sendBtn.disabled = false;
    return;
  }

  /** task1：须在 isTask1Stage（工商提炼）之前：**已有 V2 + 跟进/补充引导** 时输入应走补充修订，避免刷新后 basicInfo 标志抖动误进工商链（FE-20260331） */
  if (
    task1Pending &&
    hasV2Prelim &&
    !awaitingPrelim &&
    !globalThis.SmartCto.problemDetailRuntime.__host.getProblemDetailWaitingForFeedback() &&
    isTask1ActivePreliminaryFollowupPhase(globalThis.SmartCto.appState.getState().problemDetailChatMessages, dataItem)
  ) {
    const msgs = globalThis.SmartCto.appState.getState().problemDetailChatMessages;
    const modifyPrompt = globalThis.SmartCto.problemDetailRuntime.__host.TASK1_PRELIM_SUPPLEMENT_MODIFY_PROMPT;
    const prev = Array.isArray(msgs) && msgs.length >= 2 ? msgs[msgs.length - 2] : null;
    const routeModify =
      modifyPrompt &&
      prev &&
      prev.role === 'system' &&
      String(prev.content || '') === String(modifyPrompt);
    if (routeModify) {
      const runPrelimMod =
        globalThis.SmartCto.problemDetailRuntime.__host.runTask1PreliminarySupplementModifyWithFeedback;
      if (typeof runPrelimMod === 'function') {
        await runPrelimMod(text, container);
      }
    } else {
      const runPrelimSup = globalThis.SmartCto.problemDetailRuntime.__host.runTask1PreliminarySupplementRefinement;
      if (typeof runPrelimSup === 'function') {
        await runPrelimSup(text, container);
      }
    }
    if (sendBtn) sendBtn.disabled = false;
    return;
  }

  if (isTask1Stage) {
    const task1ParsingBlock = document.createElement('div');
    task1ParsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
    task1ParsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在提炼客户基本信息</span></div></div><div class="problem-detail-chat-msg-time">${$().getTimeStr()}</div>`;
    container.appendChild(task1ParsingBlock);
    container.scrollTop = container.scrollHeight;
    try {
      if (!$().hasAiConfig()) {
        throw new Error('请先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）才能使用解析功能。');
      }
      const { parsed, usage, model, durationMs, fullPrompt, rawOutput } = await globalThis.SmartCto.problemDetailRuntime.__host.parseCompanyBasicInfoInput(text);
      task1ParsingBlock.remove();
      const labels = [
        { key: 'company_name', label: '公司名称' }, { key: 'credit_code', label: '信用代码' }, { key: 'legal_representative', label: '法人' },
        { key: 'established_date', label: '成立时间' }, { key: 'registered_capital', label: '注册资本' }, { key: 'is_listed', label: '是否上市' },
        { key: 'listing_location', label: '上市地' }, { key: 'business_scope', label: '经营范围' }, { key: 'core_qualifications', label: '核心资质' }, { key: 'official_website', label: '官方网站' },
      ];
      const rows = labels.map(({ key, label }) => {
        const value = (parsed[key] != null ? String(parsed[key]).trim() : '') || '—';
        return `<div class="problem-detail-basic-info-row"><span class="problem-detail-basic-info-label">${$().escapeHtml(label)}</span><span class="problem-detail-basic-info-value">${$().escapeHtml(value)}</span></div>`;
      }).join('');
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-card-collapsible problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(globalThis.SmartCto.appState.getState().problemDetailChatMessages.length);
      cardBlock.dataset.taskId = 'task1';
      const jsonAttr = String(JSON.stringify(parsed)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const llmMetaHtml = $().buildLlmMetaHtml({ usage, model, durationMs });
      cardBlock.innerHTML = `<button type="button" class="btn-delete-chat-msg" aria-label="删除">${$().DELETE_CHAT_MSG_ICON}</button><div class="problem-detail-basic-info-card" role="button" tabindex="0"><div class="problem-detail-basic-info-card-body">${rows}</div><div class="problem-detail-basic-info-card-actions"><button type="button" class="btn-confirm-basic-info btn-confirm-primary" data-json="${jsonAttr}">确认</button><button type="button" class="btn-redo-basic-info">重做</button><button type="button" class="btn-refine-modify">修正</button><button type="button" class="btn-refine-discuss">讨论</button></div></div><div class="problem-detail-chat-msg-time">${$().getTimeStr()}</div>${llmMetaHtml}`;
      container.appendChild(cardBlock);
      $().pushAndSaveProblemDetailChat({
        ...globalThis.SmartCto.problemDetailRuntime.__host.buildTask1LlmQueryMessage({
          noteName: '工商信息提炼',
          fullPrompt,
          parsed,
          rawOutput,
          timestamp: $().getTimeStr(),
          usage,
          model,
          durationMs,
        }),
      });
      $().pushAndSaveProblemDetailChat({ role: 'system', type: 'basicInfoCard', data: parsed, timestamp: $().getTimeStr(), confirmed: false, llmMeta: { usage, model, durationMs } });
      $().setupProblemDetailChatCardToggle(cardBlock);
      renderProblemDetailContent();
      $().updateProblemDetailChatHeaderLabel();
      $().renderProblemDetailHistory();
    } catch (err) {
      task1ParsingBlock.classList.remove('problem-detail-chat-msg-parsing');
      task1ParsingBlock.querySelector('.problem-detail-chat-msg-content-wrap').innerHTML = `<div class="problem-detail-chat-msg-content">客户基本信息提炼失败：${$().escapeHtml(err.message || String(err))}</div>`;
      $().pushAndSaveProblemDetailChat({ role: 'system', content: '客户基本信息提炼失败：' + (err.message || String(err)), timestamp: $().getTimeStr() });
    }
    container.scrollTop = container.scrollHeight;
    if (sendBtn) sendBtn.disabled = false;
    return;
  }

  // Agent 模式：不进行查询、修改意图的提取，仅响应任务相关的内容确认、修正、讨论
  // 若当前处于 task2 讨论延续（已有讨论开始标记且最后一条为用户消息），则按继续讨论处理，避免“继续讨论”点击后状态丢失导致误提示
  if (globalThis.SmartCto.problemDetailRuntime.__host.getProblemDetailChatMode() === 'agent') {
    const hasBmcDiscussionStart = Array.isArray(globalThis.SmartCto.appState.getState().problemDetailChatMessages) && globalThis.SmartCto.appState.getState().problemDetailChatMessages.some((m) => m?.type === 'bmcDiscussionStartBlock');
    const lastMsg = globalThis.SmartCto.appState.getState().problemDetailChatMessages.length > 0 ? globalThis.SmartCto.appState.getState().problemDetailChatMessages[globalThis.SmartCto.appState.getState().problemDetailChatMessages.length - 1] : null;
    const lastIsUser = lastMsg && lastMsg.role === 'user';
    const createdAt = globalThis.SmartCto.appState.getState().currentProblemDetailItem?.createdAt;
    if (hasBmcDiscussionStart && lastIsUser && createdAt) {
      lastMsg._logType = 'bmcDiscussionUser';
      $().saveProblemDetailChat(createdAt, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
      const parsingBlock = document.createElement('div');
      parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
      parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在根据您的反馈讨论…</span></div></div><div class="problem-detail-chat-msg-time">${$().getTimeStr()}</div>`;
      container.appendChild(parsingBlock);
      container.scrollTop = container.scrollHeight;
      const runBmcDiscussionTurn = globalThis.SmartCto.problemDetailRuntime.__host.runBmcDiscussionTurn;
      if (runBmcDiscussionTurn) {
        const baseBmcData = $().getBaseBmcData();
        const discussionHistory = $().getBmcDiscussionHistory();
        runBmcDiscussionTurn(baseBmcData, discussionHistory, text).then(({ content: replyContent, usage, model, durationMs, fullPrompt }) => {
          parsingBlock.remove();
          $().pushAndSaveProblemDetailChat({
            type: 'bmcDiscussionLlmQueryBlock',
            taskId: 'task2',
            noteName: '大模型讨论应答',
            llmInputPrompt: fullPrompt || '',
            llmOutputRaw: replyContent || '',
            timestamp: $().getTimeStr(),
            llmMeta: { usage, model, durationMs },
          });
          $().pushAndSaveProblemDetailChat({
            type: 'bmcDiscussionReplyBlock',
            taskId: 'task2',
            content: replyContent,
            timestamp: $().getTimeStr(),
            llmMeta: { usage, model, durationMs },
          });
          container.innerHTML = '';
          $().renderProblemDetailChatFromStorage(container, globalThis.SmartCto.appState.getState().problemDetailChatMessages);
          container.scrollTop = container.scrollHeight;
          $().renderProblemDetailHistory();
          if (sendBtn) sendBtn.disabled = false;
        }).catch((err) => {
          parsingBlock.remove();
          const errBlock = document.createElement('div');
          errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
          errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">讨论失败：${$().escapeHtml(err.message || String(err))}</div></div><div class="problem-detail-chat-msg-time">${$().getTimeStr()}</div>`;
          container.appendChild(errBlock);
          $().pushAndSaveProblemDetailChat({ role: 'system', content: '讨论失败：' + (err.message || String(err)), timestamp: $().getTimeStr() });
          container.scrollTop = container.scrollHeight;
          if (sendBtn) sendBtn.disabled = false;
        });
      } else {
        parsingBlock.remove();
        if (sendBtn) sendBtn.disabled = false;
      }
      return;
    }
    const tipBlock = document.createElement('div');
    tipBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
    tipBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">Agent 模式下请使用内容卡片上的确认、修正、讨论按钮推进任务；自由查询请切换至 Ask 模式。</div></div><div class="problem-detail-chat-msg-time">${$().getTimeStr()}</div>`;
    container.appendChild(tipBlock);
    container.scrollTop = container.scrollHeight;
    $().pushAndSaveProblemDetailChat({ role: 'system', content: 'Agent 模式下请使用内容卡片上的确认、修正、讨论按钮推进任务；自由查询请切换至 Ask 模式。', timestamp: $().getTimeStr() });
    if (sendBtn) sendBtn.disabled = false;
    return;
  }

  // Ask 模式：不进行意图判断，直接用当前问题所有环节数据+用户问题发大模型，精准回答并定位工作区
  const parsingBlock = document.createElement('div');
  parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
  parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在查询…</span></div></div><div class="problem-detail-chat-msg-time">${$().getTimeStr()}</div>`;
  container.appendChild(parsingBlock);
  container.scrollTop = container.scrollHeight;
  try {
    if (!$().hasAiConfig()) {
      throw new Error('请先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）才能使用解析功能。');
    }
    const { content, usage, model, durationMs, wasTruncated, contextLength } = await $().executeAskModeDirectQuery(item, text);
    parsingBlock.remove();
    const llmMeta = $().buildLlmMetaHtml({ usage, model, durationMs });
    const resultBlock = document.createElement('div');
    resultBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-with-delete';
    resultBlock.dataset.msgIndex = String(globalThis.SmartCto.appState.getState().problemDetailChatMessages.length);
    resultBlock.innerHTML = `<button type="button" class="btn-delete-chat-msg" aria-label="删除">${$().DELETE_CHAT_MSG_ICON}</button><div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content markdown-body">${$().renderMarkdown(content)}</div></div><div class="problem-detail-chat-msg-time">${$().getTimeStr()}</div>${llmMeta}`;
    container.appendChild(resultBlock);
    $().pushAndSaveProblemDetailChat({ role: 'system', content, timestamp: $().getTimeStr(), llmMeta: { usage, model, durationMs } });
    if (wasTruncated) {
      const currentLen = typeof contextLength === 'number' ? contextLength : 0;
      const maxTruncate = $().ASK_CONTEXT_MAX_PER_BLOCK;
      const truncateTip = `上下文长度已超过截断阈值。当前上下文长度：${currentLen.toLocaleString()} 字符，单块最大截断值：${maxTruncate.toLocaleString()} 字符，查询结果可能不完整。`;
      const truncateBlock = document.createElement('div');
      truncateBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
      truncateBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">${$().escapeHtml(truncateTip)}</div></div><div class="problem-detail-chat-msg-time">${$().getTimeStr()}</div>`;
      container.appendChild(truncateBlock);
      $().pushAndSaveProblemDetailChat({ role: 'system', content: truncateTip, timestamp: $().getTimeStr() });
    }
    container.scrollTop = container.scrollHeight;
    $().focusWorkspaceOnUserQuestion(text);
  } catch (err) {
    parsingBlock.classList.remove('problem-detail-chat-msg-parsing');
    const wrap = parsingBlock.querySelector('.problem-detail-chat-msg-content-wrap');
    if (wrap) wrap.innerHTML = `<div class="problem-detail-chat-msg-content">查询失败：${$().escapeHtml(err.message || String(err))}</div>`;
    $().pushAndSaveProblemDetailChat({ role: 'system', content: '查询失败：' + (err.message || String(err)), timestamp: $().getTimeStr() });
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

function applyStoredChatPostHydrationPipeline(container) {
  const $ = __pdrHost;
  const st = globalThis.SmartCto.appState.getState();
  if ($().ensureCoreBusinessObjectAllDoneBlockIfNeeded?.()) {
    $().renderProblemDetailChatFromStorage(container, st.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
  }
  if ($().ensureItDesignSupplementAllDoneConfirmAfterChatHydrate?.()) {
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
