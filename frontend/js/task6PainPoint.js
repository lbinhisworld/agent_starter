/**
 * [INPUT]: main.js 暴露的 getCurrentProblemDetailItem/setCurrentProblemDetailItem、el、渲染与存储函数、parseValueStreamGraph、大模型调用等
 * [OUTPUT]: 痛点标注流程（整图/单步/自动顺序）、applyPainPointStepConfirm、mergePainPointIntoValueStream 等全局 API
 * [POS]: ProblemDetail 任务6（价值流痛点标注）专用模块
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新此 Header 和所属目录的 AGENTS.md
 *
 * 任务6：痛点标注（价值流图各环节痛点描述标注）。
 *
 * 职责：
 * - 基于价值流图与 **需求逻辑·深层动机** + **初步需求 painPointRadar 的 itGap**，支持「整图一次标注」或「按环节单步标注」；
 * - 整图模式：调用大模型为所有环节标注 painPoint，合并后更新存储并推进工作流阶段；
 * - 单步模式：按 session 列表逐环节调用大模型，推送 painPointStepCard；Session 计划块仅「自动顺序执行」，runPainPointAnnotationForNextStep 供自动顺序内部与兼容链式确认（resolveItem 优先 getter；自动循环每轮取最新详情项）；
 * - 对外提供 runPainPointAnnotation、runPainPointAnnotationForNextStep、runPainPointAnnotationAutoSequential、applyPainPointStepConfirm、generatePainPointSessions 等，供 main 及任务调度使用。
 *
 * 依赖（由页面其他脚本提供的全局变量/函数）：
 * - 配置与工具：hasAiConfig、fetchDeepSeekChat、getTimeStr、escapeHtml、DELETE_CHAT_MSG_ICON
 * - 状态与渲染：**getCurrentProblemDetailItem / setCurrentProblemDetailItem**（主详情态在 main 闭包内，须通过二者同步）、el、renderProblemDetailContent、buildLlmMetaHtml、renderProblemDetailChatFromStorage
 * - 会话与历史：problemDetailChatMessages、getProblemDetailChatMessages、pushAndSaveProblemDetailChat、pushOperationToHistory、saveProblemDetailChat
 * - 价值流解析：parseValueStreamGraph（valueStream.js）
 * - 需求逻辑章节解析：parseRequirementLogicFromMarkdown（task3RequirementLogic.js，取 deep_motivation）
 * - 初步需求：buildResolvedPreliminaryRequirement（preliminaryRequirement.js，painPointRadar 含 itGap）
 * - 存储：updateDigitalProblemValueStreamPainPoint、updateDigitalProblemPainPointStep、updateDigitalProblemPainPointSessions、getDigitalProblems（online 下三者须走 adapter，见 `storage.js` FE-20260322-10）
 * - 导航：showNextTaskStartNotification、showTaskCompletionConfirm
 * - 任务列表：FOLLOW_TASKS
 */
(function (global) {
  /** 读取 main 内部当前详情项（勿仅用 global.currentProblemDetailItem，避免与闭包不同步） */
  function getDetailItemForTask6() {
    if (typeof global.getCurrentProblemDetailItem === 'function') return global.getCurrentProblemDetailItem();
    return global.currentProblemDetailItem;
  }

  /**
   * 单步痛点标注使用的详情项：若调用方传入的 optionalItem 与主态为同一案例，优先用 getter（存储/同步后的最新 painPointSessions），避免自动顺序循环里沿用陈旧引用导致只跑一环。
   */
  function resolveItemForPainPointStep(optionalItem) {
    const fromGetter = typeof global.getCurrentProblemDetailItem === 'function' ? global.getCurrentProblemDetailItem() : null;
    const a = fromGetter != null && fromGetter.createdAt != null ? String(fromGetter.createdAt) : '';
    const b = optionalItem != null && optionalItem.createdAt != null ? String(optionalItem.createdAt) : '';
    if (a && b && a === b) return fromGetter;
    if (optionalItem != null && typeof optionalItem === 'object' && optionalItem.createdAt != null) return optionalItem;
    return getDetailItemForTask6();
  }

  /**
   * 写回主详情态：必须优先 setCurrentProblemDetailItem；可同时镜像 global.currentProblemDetailItem 供兼容旧读法。
   */
  function syncCurrentProblemDetailItem(nextItem) {
    if (nextItem == null) return;
    if (typeof global.setCurrentProblemDetailItem === 'function') global.setCurrentProblemDetailItem(nextItem);
    global.currentProblemDetailItem = nextItem;
  }

  /** 按环节下标从 valueStream 解析出的 step 上读取 painPoint（供调试用） */
  function getPainPointAtStepIndex(valueStream, stepIndex) {
    const parseValueStreamGraph = global.parseValueStreamGraph || (() => ({ stages: [] }));
    const { stages } = parseValueStreamGraph(valueStream || {});
    let idx = 0;
    for (const stage of stages) {
      for (const step of stage.steps || []) {
        if (idx === stepIndex) {
          const pp = step?.painPoint ?? step?.pain_point;
          return pp != null ? String(pp) : null;
        }
        idx += 1;
      }
    }
    return null;
  }

  /** FE-20260322-10：渲染后价值流 step 与 DOM 卡片数（owner 可贴控制台） */
  function logTask6PainPointVsDebug(stepIndex) {
    if (typeof console === 'undefined' || typeof console.log !== 'function') return;
    const item = getDetailItemForTask6();
    const vs = item?.valueStream;
    const si = typeof stepIndex === 'number' && !Number.isNaN(stepIndex) ? stepIndex : 0;
    const painAtStep = getPainPointAtStepIndex(vs, si);
    const cardCount = typeof document !== 'undefined' && document.querySelectorAll
      ? document.querySelectorAll('.vs-step-pain-point-card').length
      : 0;
    console.log('[FE-20260322-10 task6]', JSON.stringify({ stepIndex: si, painPointAtStep: painAtStep, vsPainCards: cardCount }));
  }

  /** FE-20260322-10：单步确认后（getCurrentProblemDetailItem 与 DOM 卡片） */
  function logTask6StepConfirmDebug(stepIndex) {
    if (typeof console === 'undefined' || typeof console.log !== 'function') return;
    const getter = typeof global.getCurrentProblemDetailItem === 'function' ? global.getCurrentProblemDetailItem : getDetailItemForTask6;
    const item = getter();
    const si = Number(stepIndex);
    const pp = getPainPointAtStepIndex(item?.valueStream, si);
    const cardCount = typeof document !== 'undefined' && document.querySelectorAll
      ? document.querySelectorAll('.vs-step-pain-point-card').length
      : 0;
    console.log('[FE-20260322-10 task6][stepConfirm]', JSON.stringify({ stepIndex: si, painPointAtStep: pp, vsPainCards: cardCount }));
  }
  /**
   * 组装 task6 用户消息中的「深层动机」与「核心需求或痛点·itGap」两段（不再注入整段 requirement_logic）。
   *
   * @param {Object|null|undefined} item - 当前案例详情项。
   * @returns {{ deepMotivationText: string, painPointRadarItGapJson: string }}
   */
  function buildPainPointAnnotationUserContext(item) {
    const logicRaw = item?.requirementLogic;
    let deepMotivationText = '';

    if (logicRaw != null && typeof logicRaw === 'object' && !Array.isArray(logicRaw)) {
      const dm = logicRaw.deep_motivation ?? logicRaw['需求背后的深层动机'];
      if (dm != null && String(dm).trim()) deepMotivationText = String(dm).trim();
    }

    if (!deepMotivationText && typeof logicRaw === 'string') {
      const parseFn = global.parseRequirementLogicFromMarkdown;
      if (typeof parseFn === 'function') {
        const parsed = parseFn(logicRaw);
        deepMotivationText = String(parsed?.deep_motivation || '').trim();
      }
    }

    if (!deepMotivationText) deepMotivationText = '(无)';

    let painPointRadarItGapJson = '(无)';
    try {
      const buildResolved = global.buildResolvedPreliminaryRequirement;
      if (typeof buildResolved === 'function' && item) {
        const prelim = buildResolved(item);
        const radar = prelim?.painPointRadar;
        if (Array.isArray(radar) && radar.length > 0) {
          const rows = radar.map((entry) => ({
            dimension: entry?.dimension,
            description: entry?.description,
            itGap: entry?.itGap ?? entry?.it_gap,
          }));
          painPointRadarItGapJson = JSON.stringify(rows, null, 2);
        }
      }
    } catch (_) {}

    return { deepMotivationText, painPointRadarItGapJson };
  }

  const PAIN_POINT_ANNOTATION_PROMPT = `# 角色设定
你是一位资深的业务架构师与痛点分析专家，擅长结合「需求背后的深层动机」与「业务/IT 缺口（itGap）」识别各价值流环节中的痛点。

# 输入数据
1. **deep_motivation**：需求逻辑中「需求背后的深层动机」章节（对应 task3 结构化字段 \`deep_motivation\`），非整段需求逻辑全文。
2. **preliminary_pain_point_radar_it_gap**：初步需求 V2 中「核心需求或痛点」分区 \`painPointRadar\` 数组摘录，每条含 \`dimension\`、\`description\`、\`itGap\`（重点参考各维度的 IT/能力缺口描述）。
3. **value_stream**：已绘制的价值流图 JSON，包含 stages 及每个 stage 下的 steps（环节节点）。

# 任务
请结合深层动机与 itGap 摘录，在价值流图的每个环节节点中提炼该环节涉及到的痛点。为每个 step 增加 \`painPoint\` 字段，内容为该环节痛点的精炼概括（一句话或简短列表）。若某环节无明显痛点，可留空字符串或简短说明「无明显痛点」。

# 输出格式
请直接返回一个 JSON 代码块，结构与输入 value_stream 一致，但在每个 step 中增加 \`painPoint\` 字段：
\`\`\`json
{
  "stages": [
    {
      "name": "阶段名称",
      "steps": [
        {
          "name": "环节名称",
          "painPoint": "该环节痛点的提炼概括"
        }
      ]
    }
  ]
}
\`\`\`
- painPoint 为字符串，提炼当前环节涉及到的痛点
- 保持原有 stages、steps 结构及 name、role、duration、itStatus 等字段不变，仅新增 painPoint`;

  /**
   * 读取 task6 的提示词覆盖（来自 main 的修改链确认）；未命中时回退默认提示词。
   *
   * @param {string|number} caseKey - 当前问题键（createdAt 或等价主键）。
   * @returns {string}
   */
  function resolveTask6SystemPrompt(caseKey) {
    const getter = typeof global.getTask6PainPointPromptOverride === 'function' ? global.getTask6PainPointPromptOverride : null;
    const override = getter ? String(getter(caseKey) || '').trim() : '';
    return override || PAIN_POINT_ANNOTATION_PROMPT;
  }

  /**
   * 根据价值流生成痛点标注 session 列表（环节列表），用于「痛点标注 session 计划确认」卡片。
   *
   * @param {Object} valueStream - 价值流图（含 stages/steps 或由 parseValueStreamGraph 解析的结构）。
   * @returns {Array<{stepName: string, stepIndex: number, stageName: string, painPoint: null}>}
   */
  function generatePainPointSessions(valueStream) {
    const parseValueStreamGraph = global.parseValueStreamGraph || (() => ({ stages: [] }));
    const { stages } = parseValueStreamGraph(valueStream || {});
    let stepIndex = 0;
    const sessions = [];
    for (const stage of stages) {
      const stageName = stage?.name || '';
      for (const step of stage.steps || []) {
        const stepName = step?.name || `环节${stepIndex + 1}`;
        sessions.push({ stepName, stepIndex, stageName, painPoint: null });
        stepIndex += 1;
      }
    }
    return sessions;
  }

  /**
   * 将大模型返回的「带 painPoint 的价值流」合并进原始价值流图，按阶段/环节下标一一对应写入 painPoint。
   *
   * @param {Object} baseVs - 原始价值流图。
   * @param {Object} annotatedVs - 大模型返回的带 painPoint 的价值流图。
   * @returns {Object} 合并后的价值流图。
   */
  function mergePainPointIntoValueStream(baseVs, annotatedVs) {
    const baseStages = baseVs.stages ?? baseVs.phases ?? baseVs.nodes ?? [];
    const annStages = annotatedVs.stages ?? annotatedVs.phases ?? annotatedVs.nodes ?? [];
    if (!Array.isArray(baseStages) || !Array.isArray(annStages)) return baseVs;
    const stages = baseStages.map((baseStage, si) => {
      const annStage = annStages[si];
      if (!annStage) return baseStage;
      const baseSteps = baseStage.steps ?? baseStage.tasks ?? baseStage.phases ?? baseStage.items ?? [];
      const annSteps = annStage.steps ?? annStage.tasks ?? annStage.phases ?? annStage.items ?? [];
      const steps = baseSteps.map((baseStep, ji) => {
        const annStep = annSteps[ji];
        const painPoint = annStep?.painPoint ?? annStep?.pain_point;
        if (painPoint == null || (typeof painPoint === 'string' && !painPoint.trim())) return baseStep;
        const trimmed = typeof painPoint === 'string' ? painPoint.trim() : String(painPoint);
        if (/^(无明显痛点|无痛点|暂无|无)$/i.test(trimmed) || /^无明显痛点/i.test(trimmed)) return baseStep;
        const step = typeof baseStep === 'object' && baseStep !== null ? { ...baseStep } : { name: String(baseStep) };
        step.painPoint = trimmed;
        delete step.pain_point;
        return step;
      });
      return { ...baseStage, steps };
    });
    return { ...baseVs, stages };
  }

  /**
   * 调用大模型，基于价值流图与「深层动机 + 初步需求 itGap」为所有环节一次性标注痛点。
   *
   * @param {Object|string} valueStream - 价值流图。
   * @param {Object|null|undefined} item - 当前案例详情项（读取 requirementLogic、preliminaryReq）。
   * @param {string|number} caseKey - 案例键（用于提示词覆盖）。
   * @returns {Promise<{content: string, usage: object, model: string, durationMs: number}>}
   */
  async function generatePainPointAnnotation(valueStream, item, caseKey) {
    const { deepMotivationText, painPointRadarItGapJson } = buildPainPointAnnotationUserContext(item);
    const userContent = `请结合「需求背后的深层动机」「初步需求·核心需求或痛点（itGap）」与价值流图，在各环节标注痛点。

## 需求背后的深层动机（需求逻辑第 3 节）
${deepMotivationText}

## 初步需求·核心需求或痛点（painPointRadar，含各条 itGap）
\`\`\`json
${painPointRadarItGapJson}
\`\`\`

## value_stream（已绘制的价值流图）
\`\`\`json
${typeof valueStream === 'string' ? valueStream : JSON.stringify(valueStream || {}, null, 2)}
\`\`\`

请按提示词要求，为每个环节增加 painPoint 字段，直接返回完整 JSON 代码块。`;
    const systemPrompt = resolveTask6SystemPrompt(caseKey);
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 未定义');
    const { content, usage, model, durationMs } = await fetchDeepSeekChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]);
    return { content, usage, model, durationMs };
  }

  /**
   * 单环节痛点标注：仅针对指定环节调用大模型，返回该环节的痛点文案及完整输入 prompt（供时间线 LLM-查询 块使用）。
   *
   * @param {string} stepName - 环节名称。
   * @param {string} stageName - 阶段名称。
   * @param {Object|string} valueStream - 价值流图。
   * @param {Object|null|undefined} item - 当前案例详情项（读取 requirementLogic、preliminaryReq）。
   * @returns {Promise<{content: string, usage: object, model: string, durationMs: number, fullPrompt: string}>}
   */
  async function generatePainPointForOneStep(stepName, stageName, valueStream, item, caseKey) {
    const { deepMotivationText, painPointRadarItGapJson } = buildPainPointAnnotationUserContext(item);
    const userContent = `请结合「需求背后的深层动机」「初步需求·核心需求或痛点（itGap）」与价值流图，仅针对以下**单个环节**提炼痛点，直接返回该环节的痛点概括（一句话或简短列表）。若该环节无明显痛点，请返回「无明显痛点」或「无」。

## 目标环节
- 阶段：${stageName || '—'}
- 环节名称：${stepName || '—'}

## 需求背后的深层动机（需求逻辑第 3 节）
${deepMotivationText}

## 初步需求·核心需求或痛点（painPointRadar，含各条 itGap）
\`\`\`json
${painPointRadarItGapJson}
\`\`\`

## value_stream（价值流图，供上下文）
\`\`\`json
${typeof valueStream === 'string' ? valueStream : JSON.stringify(valueStream || {}, null, 2)}
\`\`\`

请只输出该环节的痛点文案，不要输出 JSON 或其它格式。`;
    const systemPrompt = resolveTask6SystemPrompt(caseKey);
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userContent}`;
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 未定义');
    const { content, usage, model, durationMs } = await fetchDeepSeekChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]);
    const painPointText = (content || '').trim();
    return { content: painPointText, usage, model, durationMs, fullPrompt };
  }

  /**
   * 确认单步痛点并写回存储；刷新会话与 UI。若全部环节已标注则返回 true。
   *
   * @param {string|number} createdAt - 问题创建时间。
   * @param {number} stepIndex - 环节下标。
   * @param {string} painPointText - 该环节痛点文案。
   * @returns {boolean} 是否全部环节已标注。
   */
  function applyPainPointStepConfirm(createdAt, stepIndex, painPointText) {
    if (typeof global.updateDigitalProblemPainPointStep !== 'function') return false;
    global.updateDigitalProblemPainPointStep(createdAt, stepIndex, painPointText);
    const messages = (typeof global.getProblemDetailChatMessages === 'function' ? global.getProblemDetailChatMessages() : global.problemDetailChatMessages) || [];
    const cardIdx = Array.isArray(messages) ? messages.findIndex((m) => m.type === 'painPointStepCard' && m.stepIndex === stepIndex) : -1;
    if (cardIdx >= 0) {
      messages[cardIdx] = { ...messages[cardIdx], content: painPointText, confirmed: true };
      if (typeof global.saveProblemDetailChat === 'function') global.saveProblemDetailChat(createdAt, messages);
    }
    const list = global.getDigitalProblems ? global.getDigitalProblems() : [];
    const updated = list.find((it) => it.createdAt === createdAt);
    if (updated && getDetailItemForTask6()?.createdAt === createdAt) {
      syncCurrentProblemDetailItem(updated);
    }
    const sessions = updated?.painPointSessions || [];
    const allDone = sessions.length > 0 && sessions.every((s) => s.painPoint != null && String(s.painPoint).trim());
    const container = global.el?.problemDetailChatMessages;
    if (container) {
      container.innerHTML = '';
      if (typeof global.renderProblemDetailChatFromStorage === 'function') {
        const msgs = (typeof global.getProblemDetailChatMessages === 'function' ? global.getProblemDetailChatMessages() : global.problemDetailChatMessages) || [];
        global.renderProblemDetailChatFromStorage(container, Array.isArray(msgs) ? msgs : []);
      }
      container.scrollTop = container.scrollHeight;
    }
    const wsScroll = typeof document !== 'undefined' ? document.querySelector('.problem-detail-workspace-scroll') : null;
    const savedWorkspaceScrollTop = wsScroll ? wsScroll.scrollTop : 0;
    if (typeof global.renderProblemDetailContent === 'function') global.renderProblemDetailContent();
    const raf = typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame : (fn) => setTimeout(fn, 0);
    raf(() => {
      logTask6StepConfirmDebug(stepIndex);
      const newWsScroll = typeof document !== 'undefined' ? document.querySelector('.problem-detail-workspace-scroll') : null;
      if (newWsScroll && savedWorkspaceScrollTop > 0) newWsScroll.scrollTop = savedWorkspaceScrollTop;
    });
    if (typeof global.renderProblemDetailHistory === 'function') global.renderProblemDetailHistory();
    return !!allDone;
  }

  /**
   * 痛点标注主流程（整图一次标注）：校验 AI 配置与当前项 → 调用大模型 → 解析 JSON → 合并 painPoint → 更新存储并推进阶段。
   *
   * @param {Object} [optionalItem] - 当前问题详情项（main 调用时传入）。
   * @param {boolean} [isRerun=false] - 是否为重做（文案区分「痛点标注完毕」/「痛点标注完成」）。
   * @returns {Promise<void>}
   */
  async function runPainPointAnnotation(optionalItem, isRerun) {
    const container = global.el?.problemDetailChatMessages;
    let item = (optionalItem != null && typeof optionalItem === 'object' && optionalItem.createdAt != null) ? optionalItem : getDetailItemForTask6();
    if (typeof optionalItem === 'boolean') {
      isRerun = optionalItem;
      item = getDetailItemForTask6();
    }
    if (!container || !item?.createdAt) return;
    if (!global.hasAiConfig?.()) {
      const errBlock = document.createElement('div');
      errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
      errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">请先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）才能使用痛点标注功能。</div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
      container.appendChild(errBlock);
      global.pushAndSaveProblemDetailChat?.({ role: 'system', content: '请先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）才能使用痛点标注功能。', timestamp: global.getTimeStr() });
      return;
    }
    const valueStream = item.valueStream;
    let loadingBlock = isRerun ? (() => { const arr = container.querySelectorAll('.problem-detail-chat-msg-parsing'); return arr[arr.length - 1] || null; })() : null;
    if (!loadingBlock) {
      loadingBlock = document.createElement('div');
      loadingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
      loadingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在标注价值流图各环节痛点…</span></div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
      container.appendChild(loadingBlock);
    }
    container.scrollTop = container.scrollHeight;
    try {
      const { content, usage, model, durationMs } = await generatePainPointAnnotation(valueStream, item, item.createdAt);
      loadingBlock.remove();
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      let annotatedVs = null;
      if (jsonMatch) {
        try { annotatedVs = JSON.parse(jsonMatch[1].trim()); } catch (_) {}
      }
      if (!annotatedVs) {
        const fallbackMatch = content.match(/\{[\s\S]*\}/);
        if (fallbackMatch) {
          try { annotatedVs = JSON.parse(fallbackMatch[0]); } catch (_) {}
        }
      }
      const mergedVs = annotatedVs ? mergePainPointIntoValueStream(valueStream, annotatedVs) : valueStream;
      const msgLen = (typeof global.getProblemDetailChatMessages === 'function' ? global.getProblemDetailChatMessages() : global.problemDetailChatMessages)?.length ?? 0;
      global.pushOperationToHistory?.(item.createdAt, 'painPoint', JSON.parse(JSON.stringify(item)), msgLen);
      global.updateDigitalProblemValueStreamPainPoint?.(item.createdAt, mergedVs);
      const nextItem = { ...item, valueStream: mergedVs };
      syncCurrentProblemDetailItem(nextItem);
      global.renderProblemDetailContent?.();
      if (typeof global.requestAnimationFrame === 'function') {
        global.requestAnimationFrame(() => logTask6PainPointVsDebug(0));
      } else {
        logTask6PainPointVsDebug(0);
      }
      const doneText = isRerun ? '痛点标注完毕' : '痛点标注完成';
      const llmMeta = global.buildLlmMetaHtml?.({ usage, model, durationMs }) || '';
      const escapeHtml = global.escapeHtml || ((s) => (s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')));
      const doneBlock = document.createElement('div');
      doneBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsed';
      doneBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">${escapeHtml(doneText)}</div><span class="problem-detail-chat-check" aria-hidden="true">✅</span></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>${llmMeta}`;
      container.appendChild(doneBlock);
      global.pushAndSaveProblemDetailChat?.({ role: 'system', content: doneText, timestamp: global.getTimeStr(), hasCheck: true, llmMeta: { usage, model, durationMs } });
      container.scrollTop = container.scrollHeight;
      if (typeof global.requestAnimationFrame === 'function') {
        global.requestAnimationFrame(() => global.showNextTaskStartNotification?.());
      } else {
        global.showNextTaskStartNotification?.();
      }
    } catch (err) {
      const errBlock = document.createElement('div');
      errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
      const escapeHtml = global.escapeHtml || ((s) => (s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')));
      errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">痛点标注失败：${escapeHtml(err.message || String(err))}</div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
      container.appendChild(errBlock);
      global.pushAndSaveProblemDetailChat?.({ role: 'system', content: '痛点标注失败：' + (err.message || String(err)), timestamp: global.getTimeStr() });
    }
  }

  /**
   * 执行下一个未标注环节的痛点标注（单步），推送痛点卡片。成功时返回 { stepIndex, painPointText }，无下一环节或失败时返回 null。
   *
   * @param {Object} [optionalItem] - 当前问题详情项。
   * @returns {Promise<{stepIndex: number, painPointText: string}|null>}
   */
  async function runPainPointAnnotationForNextStep(optionalItem) {
    const container = global.el?.problemDetailChatMessages;
    const item = resolveItemForPainPointStep(optionalItem);
    if (!container || !item?.createdAt || !global.hasAiConfig?.()) return null;
    const sessions = item.painPointSessions || [];
    const valueStream = item.valueStream;
    if (!valueStream || valueStream.raw) return null;
    const nextIdx = sessions.findIndex((s) => s.painPoint == null || (typeof s.painPoint === 'string' && !s.painPoint.trim()));
    if (nextIdx < 0) return null;
    const doneCount = sessions.filter((s) => s.painPoint != null && String(s.painPoint).trim()).length;
    if (nextIdx === 1 && typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log('[FE-20260322-10 task6][autoSequential]', JSON.stringify({
        nextIdx,
        painPointSessionsDone: doneCount,
        painPointSessionsLength: sessions.length,
      }));
    }
    const session = sessions[nextIdx];
    const stepName = session.stepName || `环节${nextIdx + 1}`;
    const stageName = session.stageName || '';
    global.pushAndSaveProblemDetailChat?.({ role: 'system', content: '正在标注环节【' + stepName + '】的痛点…', timestamp: global.getTimeStr() });
    container.innerHTML = '';
    const messages = (typeof global.getProblemDetailChatMessages === 'function' ? global.getProblemDetailChatMessages() : global.problemDetailChatMessages) || [];
    global.renderProblemDetailChatFromStorage?.(container, Array.isArray(messages) ? messages : []);
    container.scrollTop = container.scrollHeight;
    const escapeHtml = global.escapeHtml || ((s) => (s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')));
    const deleteIcon = global.DELETE_CHAT_MSG_ICON || '';
    const parsingBlock = document.createElement('div');
    parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
    parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在标注环节【${escapeHtml(stepName)}】的痛点…</span></div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
    container.appendChild(parsingBlock);
    container.scrollTop = container.scrollHeight;
    try {
      const { content: painPointText, usage, model, durationMs, fullPrompt } = await generatePainPointForOneStep(stepName, stageName, valueStream, item, item.createdAt);
      parsingBlock.remove();
      const llmMeta = { usage, model, durationMs };
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        type: 'task6LlmQueryBlock',
        taskId: 'task6',
        noteName: '痛点标注',
        stepName,
        llmInputPrompt: fullPrompt != null ? String(fullPrompt) : '',
        llmOutputRaw: (painPointText != null ? String(painPointText).trim() : '') || '',
        llmMeta: { usage, model, durationMs },
        timestamp: global.getTimeStr(),
        confirmed: false,
      });
      const llmMetaHtml = global.buildLlmMetaHtml?.(llmMeta) || '';
      const painPointContent = (painPointText && String(painPointText).trim()) || '';
      if (typeof global.updateDigitalProblemPainPointStep === 'function') {
        global.updateDigitalProblemPainPointStep(item.createdAt, nextIdx, painPointContent);
        const list = global.getDigitalProblems ? global.getDigitalProblems() : [];
        const updated = list.find((it) => it.createdAt === item.createdAt);
        if (updated) syncCurrentProblemDetailItem(updated);
      }
      const cardBlock = document.createElement('div');
      cardBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-pain-point-step-card problem-detail-chat-msg-with-delete';
      cardBlock.dataset.msgIndex = String(((typeof global.getProblemDetailChatMessages === 'function' ? global.getProblemDetailChatMessages() : global.problemDetailChatMessages) || []).length);
      cardBlock.dataset.taskId = 'task6';
      cardBlock.dataset.stepName = stepName;
      cardBlock.dataset.stepIndex = String(nextIdx);
      cardBlock.innerHTML = `
      <button type="button" class="btn-delete-chat-msg" aria-label="删除">${deleteIcon}</button>
      <div class="problem-detail-chat-pain-point-step-card-wrap">
        <div class="problem-detail-chat-pain-point-step-card-header">痛点标注：${escapeHtml(stepName)}</div>
        <div class="problem-detail-chat-pain-point-step-card-body"><div class="problem-detail-chat-pain-point-step-content">${escapeHtml(painPointContent || '—')}</div></div>
        <div class="problem-detail-chat-pain-point-step-card-actions">
          <button type="button" class="btn-confirm-pain-point-step btn-confirm-primary" data-step-index="${nextIdx}">确认</button>
          <button type="button" class="btn-redo-pain-point-step" data-step-index="${nextIdx}">重做</button>
          <button type="button" class="btn-refine-modify" data-task-id="task6">修正</button>
          <button type="button" class="btn-refine-discuss" data-task-id="task6">讨论</button>
        </div>
      </div>
      <div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>${llmMetaHtml}`;
      container.appendChild(cardBlock);
      global.pushAndSaveProblemDetailChat?.({
        type: 'painPointStepCard',
        taskId: 'task6',
        stepName,
        stepIndex: nextIdx,
        content: painPointContent,
        timestamp: global.getTimeStr(),
        confirmed: false,
        llmMeta,
      });
      container.scrollTop = container.scrollHeight;
      global.renderProblemDetailContent?.();
      global.renderProblemDetailHistory?.();
      const raf = typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame : (fn) => setTimeout(fn, 0);
      raf(() => {
        logTask6PainPointVsDebug(nextIdx);
        const scrollEl = typeof document !== 'undefined' ? document.querySelector('.problem-detail-workspace-scroll') : null;
        const stepEl = scrollEl ? scrollEl.querySelector(`[data-vs-step-index="${nextIdx}"]`) : null;
        if (!scrollEl || !stepEl) return;
        const scrollRect = scrollEl.getBoundingClientRect();
        const stepRect = stepEl.getBoundingClientRect();
        const elementOffsetTop = scrollEl.scrollTop + (stepRect.top - scrollRect.top);
        const elementHeight = stepRect.height;
        const win = typeof window !== 'undefined' ? window : null;
        const viewportBottom = win ? win.innerHeight : scrollRect.height;
        const visibleHeight = Math.min(scrollRect.height, Math.max(0, viewportBottom - scrollRect.top));
        const targetScrollTop = elementOffsetTop - visibleHeight / 2 + elementHeight / 2;
        const maxScroll = Math.max(0, scrollEl.scrollHeight - (visibleHeight || scrollEl.clientHeight));
        const clamped = Math.max(0, Math.min(targetScrollTop, maxScroll));
        scrollEl.scrollTo({ top: clamped, behavior: 'smooth' });
      });
      return { stepIndex: nextIdx, painPointText: painPointContent };
    } catch (err) {
      parsingBlock.remove();
      const errBlock = document.createElement('div');
      errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
      errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">痛点标注失败：${escapeHtml(err.message || String(err))}</div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
      container.appendChild(errBlock);
      global.pushAndSaveProblemDetailChat?.({ role: 'system', content: '痛点标注失败：' + (err.message || String(err)), timestamp: global.getTimeStr() });
      container.scrollTop = container.scrollHeight;
      return null;
    }
  }

  /**
   * 自动顺序执行：循环执行下一未标注环节直到全部完成；每步大模型返回后不自动确认，仅在工作区绘制痛点块；全部结束后下发「是否确认所有痛点标注结果？」。
   *
   * @param {Object} [optionalItem] - 当前问题详情项。
   * @returns {Promise<void>}
   */
  async function runPainPointAnnotationAutoSequential(optionalItem) {
    const item = (optionalItem != null && typeof optionalItem === 'object' && optionalItem.createdAt != null) ? optionalItem : getDetailItemForTask6();
    if (!item?.createdAt) return;
    const btn = document.querySelector('.btn-auto-pain-point-sessions');
    if (btn && !btn.disabled) btn.disabled = true;
    while (true) {
      const r = await runPainPointAnnotationForNextStep(getDetailItemForTask6());
      if (!r) {
        global.pushAndSaveProblemDetailChat?.({
          type: 'painPointAllDoneConfirmBlock',
          content: '是否确认所有痛点标注结果？',
          taskId: 'task6',
          timestamp: global.getTimeStr(),
          confirmed: false,
        });
        const chatContainer = global.el?.problemDetailChatMessages;
        if (chatContainer) {
          chatContainer.innerHTML = '';
          const msgs = (typeof global.getProblemDetailChatMessages === 'function' ? global.getProblemDetailChatMessages() : global.problemDetailChatMessages) || [];
          global.renderProblemDetailChatFromStorage?.(chatContainer, Array.isArray(msgs) ? msgs : []);
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        global.renderProblemDetailHistory?.();
        break;
      }
      const list = global.getDigitalProblems ? global.getDigitalProblems() : [];
      const nextItem = list.find((it) => String(it.createdAt) === String(item.createdAt));
      if (nextItem) syncCurrentProblemDetailItem(nextItem);
    }
    if (btn) {
      const sessions = (getDetailItemForTask6()?.painPointSessions || []);
      const hasUnfinished = sessions.some((s) => s.painPoint == null || (typeof s.painPoint === 'string' && !s.painPoint.trim()));
      btn.disabled = !hasUnfinished;
    }
  }

  global.PAIN_POINT_ANNOTATION_PROMPT = PAIN_POINT_ANNOTATION_PROMPT;
  global.generatePainPointSessions = generatePainPointSessions;
  global.generatePainPointAnnotation = generatePainPointAnnotation;
  global.generatePainPointForOneStep = generatePainPointForOneStep;
  global.mergePainPointIntoValueStream = mergePainPointIntoValueStream;
  global.runPainPointAnnotation = runPainPointAnnotation;
  global.runPainPointAnnotationForNextStep = runPainPointAnnotationForNextStep;
  global.applyPainPointStepConfirm = applyPainPointStepConfirm;
  global.runPainPointAnnotationAutoSequential = runPainPointAnnotationAutoSequential;
})(typeof window !== 'undefined' ? window : this);
