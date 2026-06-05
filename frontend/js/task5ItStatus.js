/**
 * [INPUT]: main 暴露的 getCurrentProblemDetailItem/setCurrentProblemDetailItem、getProblemDetailChatMessages、renderProblemDetailChatFromStorage、parseValueStreamGraph、updateDigitalProblemValueStreamItStatus、updateDigitalProblemItStatusSessions、updateDigitalProblemItStatusStep、buildPreliminarySummaryJson 等
 * [OUTPUT]: setupItStatusSessionPlanAfterTaskStart、runItStatusAnnotation（整图一次，修改链兼容）、generateItStatusSessions、runItStatusAnnotationForNextStep、runItStatusAnnotationAutoSequential、applyItStatusStepConfirm、mergeItStatusIntoValueStream、`buildTask5ItStatusSingleStepPromptSnapshot`（修改提示词首轮与单环节调用共用「仅当前环节价值流设计摘录」）等
 * [POS]: ProblemDetail 任务5（IT 现状标注）专用模块
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新此 Header 和所属目录的 AGENTS.md
 *
 * 任务5：IT 现状标注。主流程为 Session 计划 +「自动顺序执行」逐环节调用大模型；修改链经「新提示词确认 → itStatusModificationRegenerateNotifyBlock → Session 计划 → 自动执行前按需清空 VS 上 IT 标注」；`getTask5ItStatusPromptOverride` 覆盖单步/整图 system。整图单次 `runItStatusAnnotation` 仍供兼容。
 */
(function (global) {
  function getDetailItemForTask5() {
    if (typeof global.getCurrentProblemDetailItem === 'function') return global.getCurrentProblemDetailItem();
    return global.currentProblemDetailItem;
  }

  function syncCurrentProblemDetailItem(nextItem) {
    if (nextItem == null) return;
    if (typeof global.setCurrentProblemDetailItem === 'function') global.setCurrentProblemDetailItem(nextItem);
    global.currentProblemDetailItem = nextItem;
  }

  function findListItemByCaseKey(caseKey) {
    const k = caseKey == null ? '' : String(caseKey);
    if (!k) return null;
    const list = global.getDigitalProblems ? global.getDigitalProblems() : [];
    return list.find((it) => String(it.createdAt) === k || String(it.id || '') === k) || null;
  }

  function resolveItemForItStatusStep(optionalItem) {
    const fromGetter = typeof global.getCurrentProblemDetailItem === 'function' ? global.getCurrentProblemDetailItem() : null;
    const a = fromGetter != null && fromGetter.createdAt != null ? String(fromGetter.createdAt) : '';
    const b = optionalItem != null && optionalItem.createdAt != null ? String(optionalItem.createdAt) : '';
    if (a && b && a === b) return fromGetter;
    if (optionalItem != null && typeof optionalItem === 'object' && optionalItem.createdAt != null) return optionalItem;
    return getDetailItemForTask5();
  }

  /** 企业背景洞察中的 IT 现状/已有系统 JSON 字符串 */
  function pickItLandscapeJsonForTask5(item) {
    const prelim =
      item && typeof global.buildPreliminarySummaryJson === 'function' ? global.buildPreliminarySummaryJson(item) : {};
    const il =
      (prelim && typeof prelim === 'object' && prelim.itLandscape) ||
      (item?.preliminaryReq && typeof item.preliminaryReq === 'object' ? item.preliminaryReq.itLandscape : null) ||
      {};
    const obj = il && typeof il === 'object' && !Array.isArray(il) ? il : {};
    return JSON.stringify(obj, null, 2);
  }

  function formatItStatusLine(itStatus) {
    if (!itStatus || typeof itStatus !== 'object') return '';
    const t = String(itStatus.type || '').trim();
    const d = String(itStatus.detail || '').trim();
    if (t === '手工') return `手工-${d || '—'}`;
    if (t === '系统') return `系统-${d || '—'}`;
    return d || t || '';
  }

  function normalizeItStatusFromLlm(raw) {
    if (!raw || typeof raw !== 'object') return { type: '手工', detail: '纸质' };
    let type = String(raw.type || '').trim();
    if (type !== '手工' && type !== '系统') type = '手工';
    const detail = String(raw.detail != null ? raw.detail : '').trim() || (type === '手工' ? '纸质' : '未命名系统');
    return { type, detail };
  }

  /** IT 系统未来计划：集成、替换、保留、新建、无 */
  function normalizeItPlanFromLlm(raw) {
    if (raw == null || typeof raw !== 'object') return { plan: '无' };
    const p = String(raw.plan != null ? raw.plan : raw.future != null ? raw.future : '').trim();
    const allowed = new Set(['集成', '替换', '保留', '新建', '无']);
    const plan = allowed.has(p) ? p : p ? p.slice(0, 32) : '无';
    return { plan };
  }

  function parseItAnnotateObjectFromLlmText(content) {
    const text = content != null ? String(content) : '';
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const slice = fence ? fence[1].trim() : text.trim();
    try {
      const o = JSON.parse(slice);
      if (o && typeof o === 'object' && !Array.isArray(o)) return o;
    } catch (_) {}
    const brace = text.match(/\{[\s\S]*"itStatus"[\s\S]*\}/);
    if (brace) {
      try {
        const o = JSON.parse(brace[0]);
        if (o && typeof o === 'object') return o;
      } catch (_) {}
    }
    return null;
  }

  const IT_STATUS_SINGLE_STEP_PROMPT = `# 角色设定
你是一位资深的业务架构师与 IT 现状分析专家，须结合**需求逻辑**、**企业 IT 现状/已有系统（it_landscape）**与用户消息中的 **value_stream（仅当前目标环节的设计摘录）**，仅对「目标环节」输出结构化结论。

# 任务（单环节）
1. **itStatus**：该环节当前 IT 支撑方式
   - type 只能是 \`手工\` 或 \`系统\`
   - 手工时 detail 为 \`纸质\` 或 \`excel\`
   - 系统时 detail 为具体系统名称（如：金蝶 ERP、OA、自研系统等）
2. **itPlan**：在客户数字化诉求下，该环节涉及系统的**未来计划类型**（选一个最贴切的主标签）
   - 允许值：\`集成\`（与周边系统打通）、\`替换\`（淘汰换系统）、\`保留\`（维持现状）、\`新建\`（新建系统支撑）、\`无\`（无明确计划或纯手工无系统）

# 输出格式（仅一个 JSON 对象，禁止 Markdown 围栏外多余文字）
\`\`\`json
{ "itStatus": { "type": "系统", "detail": "金蝶 ERP" }, "itPlan": { "plan": "集成" } }
\`\`\``;

  const IT_STATUS_ANNOTATION_PROMPT = `# 角色设定
你是一位资深的业务架构师与 IT 现状分析专家，擅长结合需求逻辑判断各业务环节的 IT 支撑方式与未来系统计划。

# 输入数据
1. **requirement_logic**：需求逻辑 json。
2. **value_stream**：已绘制的价值流图 JSON。

# 任务
请结合需求逻辑，在价值流图每个环节节点标注：
1. **itStatus**：手工（纸质/excel）或系统（具体系统名）
2. **itPlan**：未来计划类型，取值仅限：**集成**、**替换**、**保留**、**新建**、**无**

# 输出格式
请直接返回 JSON 代码块，结构与输入 value_stream 一致，每个 step 增加 \`itStatus\` 与 \`itPlan\`：
- itStatus: { "type": "手工"|"系统", "detail": "..." }
- itPlan: { "plan": "集成"|"替换"|"保留"|"新建"|"无" }
保持原有 stages、steps 其它字段不变。`;

  function mergeItStatusIntoValueStream(baseVs, annotatedVs) {
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
        const itStatus = annStep?.itStatus ?? annStep?.it_status;
        const itPlan = annStep?.itPlan ?? annStep?.it_plan;
        if ((!itStatus || typeof itStatus !== 'object') && (!itPlan || typeof itPlan !== 'object')) return baseStep;
        const step = typeof baseStep === 'object' && baseStep !== null ? { ...baseStep } : { name: String(baseStep) };
        delete step.itStatusLabel;
        if (itStatus && typeof itStatus === 'object') {
          step.itStatus = normalizeItStatusFromLlm(itStatus);
          step.it_status = step.itStatus;
        }
        if (itPlan && typeof itPlan === 'object') {
          step.itPlan = normalizeItPlanFromLlm(itPlan);
        } else if (itStatus && typeof itStatus === 'object') {
          step.itPlan = { plan: '无' };
        }
        return step;
      });
      return { ...baseStage, steps };
    });
    return { ...baseVs, stages };
  }

  /**
   * 按与 generateItStatusSessions 相同的全局环节序号，截取单环节价值流「设计」子图（去掉 itStatus/itPlan 等标注字段，减小单步与修改提示词首轮上下文）。
   * @returns {{ stages: Array<{name: string, steps: object[]}> }}
   */
  function buildValueStreamDesignSliceForStep(valueStream, stepIndex) {
    const parseValueStreamGraph = global.parseValueStreamGraph || (() => ({ stages: [] }));
    const { stages } = parseValueStreamGraph(valueStream || {});
    const si = Number(stepIndex);
    if (!Number.isFinite(si) || si < 0) return { stages: [] };
    let idx = 0;
    for (const stage of stages) {
      const stageName = stage?.name || '';
      const rawSteps = stage.steps || [];
      for (const step of rawSteps) {
        if (idx === si) {
          const base = step && typeof step === 'object' && !Array.isArray(step) ? step : { name: String(step || '') };
          let cloned;
          try {
            cloned = JSON.parse(JSON.stringify(base));
          } catch (_) {
            cloned = { ...base };
          }
          delete cloned.itStatus;
          delete cloned.it_status;
          delete cloned.itPlan;
          delete cloned.it_plan;
          delete cloned.itStatusLabel;
          return { stages: [{ name: stageName, steps: [cloned] }] };
        }
        idx += 1;
      }
    }
    return { stages: [] };
  }

  function resolveStageStepLabelsAtGlobalIndex(valueStream, stepIndex) {
    const parseValueStreamGraph = global.parseValueStreamGraph || (() => ({ stages: [] }));
    const { stages } = parseValueStreamGraph(valueStream || {});
    const si = Number(stepIndex);
    if (!Number.isFinite(si) || si < 0) return { stageName: '', stepName: '' };
    let idx = 0;
    for (const stage of stages) {
      const stageName = stage?.name || '';
      for (const step of stage.steps || []) {
        if (idx === si) {
          const sn = step && typeof step === 'object' && !Array.isArray(step) ? String(step.name || '').trim() : '';
          return { stageName, stepName: sn || `环节${idx + 1}` };
        }
        idx += 1;
      }
    }
    return { stageName: '', stepName: `环节${si + 1}` };
  }

  function composeItStatusSingleStepUserContent(stepName, stageName, valueStreamSlice, requirementLogic, itLandscapeJson) {
    const logicStr =
      typeof requirementLogic === 'string' ? requirementLogic : JSON.stringify(requirementLogic || {}, null, 2);
    const vsStr =
      typeof valueStreamSlice === 'string' ? valueStreamSlice : JSON.stringify(valueStreamSlice || {}, null, 2);
    return `请仅针对以下**单个价值流环节**输出 itStatus 与 itPlan（一个 JSON 对象）。

## 目标环节
- 阶段：${stageName || '—'}
- 环节名称：${stepName || '—'}

## requirement_logic
\`\`\`json
${logicStr}
\`\`\`

## it_landscape（企业背景洞察 → IT 现状/已有系统等，可能含 legacySystems）
\`\`\`json
${itLandscapeJson || '{}'}
\`\`\`

## value_stream（仅含当前目标环节的价值流设计摘录）
\`\`\`json
${vsStr}
\`\`\`

请严格只输出一个 JSON 对象，格式见系统提示。`;
  }

  /**
   * 与单环节 LLM 调用一致的 prompt 快照，供 main「修改提示词」首轮替换整段历史 prompt，避免重复塞入全图 value_stream。
   * @param {object} item - 数字化案例（须含 valueStream）
   * @param {number} stepIndex - 全局环节下标（与 task5LlmQueryBlock.stepIndex 一致）
   * @returns {{ fullPrompt: string, systemPrompt: string, userContent: string } | null }
   */
  function buildTask5ItStatusSingleStepPromptSnapshot(item, stepIndex) {
    if (!item?.valueStream || item.valueStream.raw) return null;
    const si = Number(stepIndex);
    if (!Number.isFinite(si) || si < 0) return null;
    const sessions = item.itStatusSessions || [];
    const session = sessions[si];
    const fromGraph = resolveStageStepLabelsAtGlobalIndex(item.valueStream, si);
    const stageName = (session && session.stageName) || fromGraph.stageName || '';
    const stepName = (session && session.stepName) || fromGraph.stepName || `环节${si + 1}`;
    let vsSlice = buildValueStreamDesignSliceForStep(item.valueStream, si);
    if (!vsSlice.stages || vsSlice.stages.length === 0) {
      vsSlice = item.valueStream;
    }
    const requirementLogic = item.requirementLogic != null ? item.requirementLogic : {};
    const itLandscapeJson = pickItLandscapeJsonForTask5(item);
    const userContent = composeItStatusSingleStepUserContent(
      stepName,
      stageName,
      vsSlice,
      requirementLogic,
      itLandscapeJson,
    );
    const caseKey =
      item && typeof global.getProblemDetailChatStorageKey === 'function'
        ? global.getProblemDetailChatStorageKey(item)
        : '';
    const ov =
      caseKey && typeof global.getTask5ItStatusPromptOverride === 'function'
        ? String(global.getTask5ItStatusPromptOverride(caseKey) || '').trim()
        : '';
    const systemPrompt = ov || IT_STATUS_SINGLE_STEP_PROMPT;
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userContent}`;
    return { fullPrompt, systemPrompt, userContent };
  }

  function generateItStatusSessions(valueStream) {
    const parseValueStreamGraph = global.parseValueStreamGraph || (() => ({ stages: [] }));
    const { stages } = parseValueStreamGraph(valueStream || {});
    let stepIndex = 0;
    const sessions = [];
    for (const stage of stages) {
      const stageName = stage?.name || '';
      for (const step of stage.steps || []) {
        const stepName = step?.name || `环节${stepIndex + 1}`;
        sessions.push({ stepName, stepIndex, stageName, itAnnotation: null });
        stepIndex += 1;
      }
    }
    return sessions;
  }

  /**
   * 任务5启动后下发 Session 计划（上下文块 + itStatusSessions + 聊天块），与 taskStartNotification 确认后逻辑一致。
   * @param {object} item - 当前案例
   * @param {object[]|undefined} messagesOpt - 可选聊天数组（用于近期上下文去重）；缺省从 getter 读取
   * @returns {boolean} 是否已写入计划
   */
  function setupItStatusSessionPlanAfterTaskStart(item, messagesOpt) {
    if (!item || item.createdAt == null) return false;
    const valueStream = item.valueStream;
    if (!valueStream || valueStream.raw) return false;
    const messages = Array.isArray(messagesOpt)
      ? messagesOpt
      : (typeof global.getProblemDetailChatMessages === 'function'
          ? global.getProblemDetailChatMessages()
          : global.problemDetailChatMessages) || [];
    const recent = messages.slice(-8);
    const hasVsCtx = recent.some(
      (m) => m?.type === 'taskContextBlock' && m?.taskId === 'task5' && m?.contextLabel === '价值流 IT 现状标注 json',
    );
    const hasReqCtx = recent.some(
      (m) => m?.type === 'taskContextBlock' && m?.taskId === 'task5' && m?.contextLabel === '客户需求逻辑json',
    );
    const prelim =
      item && typeof global.buildPreliminarySummaryJson === 'function' ? global.buildPreliminarySummaryJson(item) : {};
    const itLand =
      prelim && typeof prelim === 'object' && prelim.itLandscape !== undefined
        ? prelim.itLandscape
        : item?.preliminaryReq?.itLandscape != null
          ? item.preliminaryReq.itLandscape
          : {};
    const hasItCtx = recent.some(
      (m) => m?.type === 'taskContextBlock' && m?.taskId === 'task5' && m?.contextLabel === 'IT现状已有系统 json',
    );
    if (!hasVsCtx) {
      global.pushAndSaveProblemDetailChat?.({
        type: 'taskContextBlock',
        taskId: 'task5',
        contextLabel: '价值流 IT 现状标注 json',
        contextJson: valueStream,
        timestamp: global.getTimeStr(),
      });
    }
    if (!hasReqCtx) {
      global.pushAndSaveProblemDetailChat?.({
        type: 'taskContextBlock',
        taskId: 'task5',
        contextLabel: '客户需求逻辑json',
        contextJson: item?.requirementLogic != null ? item.requirementLogic : {},
        timestamp: global.getTimeStr(),
      });
    }
    if (!hasItCtx) {
      global.pushAndSaveProblemDetailChat?.({
        type: 'taskContextBlock',
        taskId: 'task5',
        contextLabel: 'IT现状已有系统 json',
        contextJson: itLand,
        timestamp: global.getTimeStr(),
      });
    }
    const sessions = generateItStatusSessions(valueStream);
    if (typeof global.updateDigitalProblemItStatusSessions === 'function') {
      global.updateDigitalProblemItStatusSessions(item.createdAt, sessions);
    }
    const list = global.getDigitalProblems ? global.getDigitalProblems() : [];
    const updated = list.find((it) => String(it.createdAt) === String(item.createdAt));
    if (updated) syncCurrentProblemDetailItem(updated);
    else syncCurrentProblemDetailItem({ ...item, itStatusSessions: sessions });
    global.pushAndSaveProblemDetailChat?.({
      type: 'itStatusSessionsBlock',
      taskId: 'task5',
      sessions,
      timestamp: global.getTimeStr(),
    });
    return true;
  }

  async function generateItStatusAnnotation(valueStream, requirementLogic, optionalItem) {
    const caseKey =
      optionalItem && typeof global.getProblemDetailChatStorageKey === 'function'
        ? global.getProblemDetailChatStorageKey(optionalItem)
        : '';
    const ov =
      caseKey && typeof global.getTask5ItStatusPromptOverride === 'function'
        ? String(global.getTask5ItStatusPromptOverride(caseKey) || '').trim()
        : '';
    const systemPrompt = ov || IT_STATUS_ANNOTATION_PROMPT;
    const userContent = `请结合需求逻辑，在价值流图各环节标注 IT 现状与 IT 计划。

## requirement_logic（需求逻辑 - 逻辑链条总结等）
\`\`\`json
${typeof requirementLogic === 'string' ? requirementLogic : JSON.stringify(requirementLogic || {}, null, 2)}
\`\`\`

## value_stream（已绘制的价值流图）
\`\`\`json
${typeof valueStream === 'string' ? valueStream : JSON.stringify(valueStream || {}, null, 2)}
\`\`\`

请按提示词要求，为每个环节增加 itStatus 与 itPlan 字段，直接返回完整 JSON 代码块。`;
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userContent}`;
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 未定义');
    const { content, usage, model, durationMs } = await fetchDeepSeekChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]);
    return { content, usage, model, durationMs, fullPrompt };
  }

  /**
   * @param {number} stepIndexForSlice - 全局环节下标；与 itStatusSessions / task5LlmQueryBlock 一致，用于 value_stream 仅注入当前环节设计摘录
   */
  async function generateItStatusForOneStep(
    stepName,
    stageName,
    valueStream,
    requirementLogic,
    itLandscapeJson,
    item,
    stepIndexForSlice,
  ) {
    const si = Number(stepIndexForSlice);
    let vsSlice =
      Number.isFinite(si) && si >= 0 ? buildValueStreamDesignSliceForStep(valueStream, si) : { stages: [] };
    if (!vsSlice.stages || vsSlice.stages.length === 0) {
      vsSlice = valueStream;
    }
    const userContent = composeItStatusSingleStepUserContent(
      stepName,
      stageName,
      vsSlice,
      requirementLogic,
      itLandscapeJson,
    );
    const caseKey =
      item && typeof global.getProblemDetailChatStorageKey === 'function'
        ? global.getProblemDetailChatStorageKey(item)
        : '';
    const ov =
      caseKey && typeof global.getTask5ItStatusPromptOverride === 'function'
        ? String(global.getTask5ItStatusPromptOverride(caseKey) || '').trim()
        : '';
    const systemPrompt = ov || IT_STATUS_SINGLE_STEP_PROMPT;
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userContent}`;
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 未定义');
    const { content, usage, model, durationMs } = await fetchDeepSeekChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]);
    return { content, usage, model, durationMs, fullPrompt };
  }

  /**
   * 单步确认：标记聊天块已确认；若全部环节已标注则返回 true（可弹任务完成确认）。
   */
  function applyItStatusStepConfirm(createdAt, stepIndex) {
    const messages = (typeof global.getProblemDetailChatMessages === 'function'
      ? global.getProblemDetailChatMessages()
      : global.problemDetailChatMessages) || [];
    const cardIdx = Array.isArray(messages) ? messages.findIndex((m) => m.type === 'itStatusStepCard' && m.stepIndex === stepIndex) : -1;
    if (cardIdx >= 0) {
      messages[cardIdx] = { ...messages[cardIdx], confirmed: true };
      if (typeof global.saveProblemDetailChat === 'function') global.saveProblemDetailChat(createdAt, messages);
    }
    const list = global.getDigitalProblems ? global.getDigitalProblems() : [];
    const updated = list.find((it) => it.createdAt === createdAt);
    if (updated && getDetailItemForTask5()?.createdAt === createdAt) syncCurrentProblemDetailItem(updated);
    const sessions = updated?.itStatusSessions || [];
    const allDone = sessions.length > 0 && sessions.every((s) => s.itAnnotation != null && typeof s.itAnnotation === 'object');
    const container = global.el?.problemDetailChatMessages;
    if (container) {
      container.innerHTML = '';
      if (typeof global.renderProblemDetailChatFromStorage === 'function') {
        const msgs = (typeof global.getProblemDetailChatMessages === 'function'
          ? global.getProblemDetailChatMessages()
          : global.problemDetailChatMessages) || [];
        global.renderProblemDetailChatFromStorage(container, Array.isArray(msgs) ? msgs : []);
      }
      container.scrollTop = container.scrollHeight;
    }
    global.renderProblemDetailContent?.();
    global.renderProblemDetailHistory?.();
    return !!allDone;
  }

  async function runItStatusAnnotationForNextStep(optionalItem) {
    const container = global.el?.problemDetailChatMessages;
    const item = resolveItemForItStatusStep(optionalItem);
    if (!container || !item?.createdAt || !global.hasAiConfig?.()) return null;
    const sessions = item.itStatusSessions || [];
    const valueStream = item.valueStream;
    const requirementLogic = item.requirementLogic != null ? item.requirementLogic : {};
    if (!valueStream || valueStream.raw) return null;
    const nextIdx = sessions.findIndex((s) => s.itAnnotation == null);
    if (nextIdx < 0) return null;
    const session = sessions[nextIdx];
    const stepName = session.stepName || `环节${nextIdx + 1}`;
    const stageName = session.stageName || '';
    const itLandscapeJson = pickItLandscapeJsonForTask5(item);
    container.innerHTML = '';
    const messages = (typeof global.getProblemDetailChatMessages === 'function'
      ? global.getProblemDetailChatMessages()
      : global.problemDetailChatMessages) || [];
    global.renderProblemDetailChatFromStorage?.(container, Array.isArray(messages) ? messages : []);
    container.scrollTop = container.scrollHeight;
    const escapeHtml = global.escapeHtml || ((s) => (s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')));
    const parsingBlock = document.createElement('div');
    parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
    parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在标注环节【${escapeHtml(stepName)}】的 IT 现状…</span></div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
    container.appendChild(parsingBlock);
    container.scrollTop = container.scrollHeight;
    try {
      const { content, usage, model, durationMs, fullPrompt } = await generateItStatusForOneStep(
        stepName,
        stageName,
        valueStream,
        requirementLogic,
        itLandscapeJson,
        item,
        nextIdx,
      );
      parsingBlock.remove();
      const rawObj = parseItAnnotateObjectFromLlmText(content);
      const itStatus = normalizeItStatusFromLlm(rawObj?.itStatus || rawObj);
      const itPlan = normalizeItPlanFromLlm(rawObj?.itPlan || { plan: '无' });
      const statusLine = formatItStatusLine(itStatus);
      const planLine = itPlan.plan ? `IT计划：${itPlan.plan}` : 'IT计划：无';
      const llmMeta = { usage, model, durationMs };
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        type: 'task5LlmQueryBlock',
        taskId: 'task5',
        noteName: 'IT 现状标注',
        stepName,
        stepIndex: nextIdx,
        llmInputPrompt: fullPrompt != null ? String(fullPrompt) : '',
        llmOutputRaw: content != null ? String(content) : '',
        llmMeta,
        timestamp: global.getTimeStr(),
        confirmed: false,
      });
      const itAnnotation = { itStatus, itPlan, statusLine, planLine };
      if (typeof global.updateDigitalProblemItStatusStep === 'function') {
        global.updateDigitalProblemItStatusStep(item.createdAt, nextIdx, itStatus, itPlan, itAnnotation);
        const list = global.getDigitalProblems ? global.getDigitalProblems() : [];
        const updated = list.find((it) => String(it.createdAt) === String(item.createdAt));
        if (updated) syncCurrentProblemDetailItem(updated);
      }
      const deleteIcon = global.DELETE_CHAT_MSG_ICON || '';
      const llmMetaHtml = global.buildLlmMetaHtml?.(llmMeta) || '';
      const cardBlock = document.createElement('div');
      cardBlock.className =
        'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-it-status-step-card problem-detail-chat-msg-with-delete';
      cardBlock.dataset.taskId = 'task5';
      cardBlock.dataset.stepName = stepName;
      cardBlock.dataset.stepIndex = String(nextIdx);
      cardBlock.innerHTML = `
      <button type="button" class="btn-delete-chat-msg" aria-label="删除">${deleteIcon}</button>
      <div class="problem-detail-chat-pain-point-step-card-wrap">
        <div class="problem-detail-chat-pain-point-step-card-header">IT 现状标注：${escapeHtml(stepName)}</div>
        <div class="problem-detail-chat-pain-point-step-card-body">
          <div class="problem-detail-chat-it-status-step-lines">
            <div class="problem-detail-chat-it-status-line"><span class="problem-detail-chat-it-status-k">IT现状</span>：${escapeHtml(statusLine || '—')}</div>
            <div class="problem-detail-chat-it-status-line"><span class="problem-detail-chat-it-status-k">IT计划</span>：${escapeHtml(planLine.replace(/^IT计划：/, '') || '—')}</div>
          </div>
        </div>
        <div class="problem-detail-chat-pain-point-step-card-actions">
          <button type="button" class="btn-confirm-it-status-step btn-confirm-primary" data-step-index="${nextIdx}">确认</button>
          <button type="button" class="btn-redo-it-status-step" data-step-index="${nextIdx}">重做</button>
          <button type="button" class="btn-refine-modify" data-task-id="task5">修正</button>
          <button type="button" class="btn-refine-discuss" data-task-id="task5">讨论</button>
        </div>
      </div>
      <div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>${llmMetaHtml}`;
      container.appendChild(cardBlock);
      global.pushAndSaveProblemDetailChat?.({
        type: 'itStatusStepCard',
        taskId: 'task5',
        stepName,
        stepIndex: nextIdx,
        itStatus,
        itPlan,
        statusLine,
        planLine,
        timestamp: global.getTimeStr(),
        confirmed: false,
        llmMeta,
      });
      container.scrollTop = container.scrollHeight;
      global.renderProblemDetailContent?.();
      global.renderProblemDetailHistory?.();
      const raf = typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame : (fn) => setTimeout(fn, 0);
      raf(() => {
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
      return { stepIndex: nextIdx, itStatus, itPlan };
    } catch (err) {
      parsingBlock.remove();
      const escapeH = global.escapeHtml || ((s) => (s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')));
      const errBlock = document.createElement('div');
      errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
      errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">IT 现状标注失败：${escapeH(err.message || String(err))}</div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
      container.appendChild(errBlock);
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        content: 'IT 现状标注失败：' + (err.message || String(err)),
        timestamp: global.getTimeStr(),
      });
      container.scrollTop = container.scrollHeight;
      return null;
    }
  }

  async function runItStatusAnnotationAutoSequential(optionalItem) {
    const item = (optionalItem != null && typeof optionalItem === 'object' && optionalItem.createdAt != null)
      ? optionalItem
      : getDetailItemForTask5();
    if (!item?.createdAt) return;
    const btn = document.querySelector('.btn-auto-it-status-sessions');
    if (btn && !btn.disabled) btn.disabled = true;
    if (!global.hasAiConfig?.()) {
      if (btn) btn.disabled = false;
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        content: '请先配置 AI 后再使用「自动顺序执行」。',
        timestamp: global.getTimeStr(),
      });
      const chatContainer0 = global.el?.problemDetailChatMessages;
      if (chatContainer0) {
        chatContainer0.innerHTML = '';
        const msgs0 = (typeof global.getProblemDetailChatMessages === 'function'
          ? global.getProblemDetailChatMessages()
          : global.problemDetailChatMessages) || [];
        global.renderProblemDetailChatFromStorage?.(chatContainer0, Array.isArray(msgs0) ? msgs0 : []);
        chatContainer0.scrollTop = chatContainer0.scrollHeight;
      }
      return;
    }
    const caseKey =
      typeof global.getProblemDetailChatStorageKey === 'function' ? global.getProblemDetailChatStorageKey(item) : String(item.createdAt || item.id || '');
    if (
      caseKey &&
      typeof global.getTask5ModAwaitingAutoStrip === 'function' &&
      global.getTask5ModAwaitingAutoStrip(caseKey)
    ) {
      if (typeof global.rollbackValueStreamItStatus === 'function') {
        global.rollbackValueStreamItStatus(caseKey);
      }
      if (typeof global.setTask5ModAwaitingAutoStrip === 'function') {
        global.setTask5ModAwaitingAutoStrip(caseKey, false);
      }
      const refreshed = findListItemByCaseKey(caseKey);
      if (refreshed) syncCurrentProblemDetailItem(refreshed);
      global.renderProblemDetailContent?.();
    }
    const vs0 = getDetailItemForTask5()?.valueStream;
    const sess0 = getDetailItemForTask5()?.itStatusSessions || [];
    if (!vs0 || vs0.raw || !sess0.length) {
      if (btn) btn.disabled = false;
      return;
    }
    while (true) {
      const cur = getDetailItemForTask5();
      const sessions = cur?.itStatusSessions || [];
      const nextIdx = sessions.findIndex((s) => s.itAnnotation == null);
      if (nextIdx < 0) {
        global.pushAndSaveProblemDetailChat?.({
          type: 'itStatusAllDoneConfirmBlock',
          content:
            '所有价值流子环节的 IT 现状与 IT 计划已按序标注完成。请确认结果无误后点击「确认所有」，系统将询问是否将该任务标记为已完成。',
          taskId: 'task5',
          timestamp: global.getTimeStr(),
          confirmed: false,
        });
        const chatContainer = global.el?.problemDetailChatMessages;
        if (chatContainer) {
          chatContainer.innerHTML = '';
          const msgs = (typeof global.getProblemDetailChatMessages === 'function'
            ? global.getProblemDetailChatMessages()
            : global.problemDetailChatMessages) || [];
          global.renderProblemDetailChatFromStorage?.(chatContainer, Array.isArray(msgs) ? msgs : []);
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        global.renderProblemDetailHistory?.();
        break;
      }
      const r = await runItStatusAnnotationForNextStep(cur);
      if (!r) {
        break;
      }
      const list = global.getDigitalProblems ? global.getDigitalProblems() : [];
      const k = typeof global.getProblemDetailChatStorageKey === 'function' ? global.getProblemDetailChatStorageKey(item) : String(item.createdAt || '');
      const nextItem = list.find((it) => String(it.createdAt) === String(item.createdAt) || String(it.id || '') === k || String(it.createdAt) === k);
      if (nextItem) syncCurrentProblemDetailItem(nextItem);
    }
    if (btn) {
      const sess = (getDetailItemForTask5()?.itStatusSessions || []);
      const hasUnfinished = sess.some((s) => s.itAnnotation == null);
      btn.disabled = !hasUnfinished;
    }
  }

  async function runItStatusAnnotation(optionalItem) {
    const container = global.el?.problemDetailChatMessages;
    const item = (optionalItem != null && typeof optionalItem === 'object' && optionalItem.createdAt != null) ? optionalItem : getDetailItemForTask5();
    if (!container || !item?.createdAt) return;
    if (!global.hasAiConfig?.()) {
      const errBlock = document.createElement('div');
      errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
      errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">请先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）才能使用 IT 现状标注功能。</div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
      container.appendChild(errBlock);
      global.pushAndSaveProblemDetailChat?.({ role: 'system', content: '请先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）才能使用 IT 现状标注功能。', timestamp: global.getTimeStr() });
      return;
    }
    const valueStream = item.valueStream;
    const requirementLogic = item.requirementLogic || {};
    const logicForPrompt = typeof requirementLogic === 'string' ? requirementLogic : JSON.stringify(requirementLogic, null, 2);
    try {
      const loadingBlock = document.createElement('div');
      loadingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
      loadingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在标注价值流图各环节 IT 现状…</span></div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
      container.appendChild(loadingBlock);
      container.scrollTop = container.scrollHeight;
      const { content, usage, model, durationMs, fullPrompt } = await generateItStatusAnnotation(valueStream, logicForPrompt, item);
      loadingBlock.remove();
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        type: 'task5LlmQueryBlock',
        taskId: 'task5',
        noteName: 'IT 现状标注（整图）',
        llmInputPrompt: fullPrompt != null ? String(fullPrompt) : '',
        llmOutputRaw: content != null ? String(content) : '',
        llmMeta: { usage, model, durationMs },
        timestamp: global.getTimeStr(),
        confirmed: false,
      });
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      let annotatedVs = null;
      if (jsonMatch) {
        try {
          annotatedVs = JSON.parse(jsonMatch[1].trim());
        } catch (_) {}
      }
      if (!annotatedVs) {
        const fallbackMatch = content.match(/\{[\s\S]*\}/);
        if (fallbackMatch) {
          try {
            annotatedVs = JSON.parse(fallbackMatch[0]);
          } catch (_) {}
        }
      }
      const mergedVs = annotatedVs ? mergeItStatusIntoValueStream(valueStream, annotatedVs) : valueStream;
      global.pushOperationToHistory?.(item.createdAt, 'itStatus', JSON.parse(JSON.stringify(item)), (global.problemDetailChatMessages || []).length);
      global.updateDigitalProblemValueStreamItStatus?.(item.createdAt, mergedVs);
      const nextItem = { ...item, valueStream: mergedVs };
      syncCurrentProblemDetailItem(nextItem);
      global.renderProblemDetailContent?.();
      const parseValueStreamGraph = global.parseValueStreamGraph || (() => ({ stages: [] }));
      const { stages: vsStages } = parseValueStreamGraph(mergedVs);
      const itStatusOutputData = [];
      for (const stage of vsStages || []) {
        const stageName = stage.name || '';
        for (const step of stage.steps || []) {
          const stepName = step.name || '';
          const it = step.itStatus || step.it_status;
          let itStatus = step.itStatusLabel || '';
          if (!itStatus) {
            itStatus = !it ? '' : (typeof it === 'object' ? (it.type === '手工' ? `手工-${it.detail || ''}` : it.type === '系统' ? `系统-${it.detail || ''}` : '') : String(it));
          }
          const pl = step.itPlan && typeof step.itPlan === 'object' ? String(step.itPlan.plan || '').trim() : '';
          itStatusOutputData.push({ stageName, stepName, itStatus, itPlan: pl ? `IT计划：${pl}` : '' });
        }
      }
      global.pushAndSaveProblemDetailChat?.({ type: 'itStatusCard', taskId: 'task5', data: itStatusOutputData, timestamp: global.getTimeStr(), confirmed: false, llmMeta: { usage, model, durationMs } });
      const chatMsgs = typeof global.getProblemDetailChatMessages === 'function'
        ? global.getProblemDetailChatMessages()
        : (global.problemDetailChatMessages || []);
      if (typeof global.renderProblemDetailChatFromStorage === 'function' && container) {
        container.innerHTML = '';
        global.renderProblemDetailChatFromStorage(container, chatMsgs);
        container.scrollTop = container.scrollHeight;
      }
      global.renderProblemDetailHistory?.();
    } catch (err) {
      console.error('[task5] runItStatusAnnotation 异常', err);
      const escapeHtml = global.escapeHtml || ((s) => (s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')));
      const errBlock = document.createElement('div');
      errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
      errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">IT 现状标注失败：${escapeHtml(err.message || String(err))}</div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
      container.appendChild(errBlock);
      global.pushAndSaveProblemDetailChat?.({ role: 'system', content: 'IT 现状标注失败：' + (err.message || String(err)), timestamp: global.getTimeStr() });
    }
  }

  global.runItStatusAnnotation = runItStatusAnnotation;
  global.generateItStatusAnnotation = generateItStatusAnnotation;
  global.mergeItStatusIntoValueStream = mergeItStatusIntoValueStream;
  global.IT_STATUS_ANNOTATION_PROMPT = IT_STATUS_ANNOTATION_PROMPT;
  global.generateItStatusSessions = generateItStatusSessions;
  global.generateItStatusForOneStep = generateItStatusForOneStep;
  global.buildTask5ItStatusSingleStepPromptSnapshot = buildTask5ItStatusSingleStepPromptSnapshot;
  global.runItStatusAnnotationForNextStep = runItStatusAnnotationForNextStep;
  global.runItStatusAnnotationAutoSequential = runItStatusAnnotationAutoSequential;
  global.applyItStatusStepConfirm = applyItStatusStepConfirm;
  global.setupItStatusSessionPlanAfterTaskStart = setupItStatusSessionPlanAfterTaskStart;
})(typeof window !== 'undefined' ? window : this);
