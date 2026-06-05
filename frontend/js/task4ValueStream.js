/**
 * 任务4：价值流绘制（VSM）— 主流程为三子环节 Session：**Mirror** → **Hardening（不刷新工作区主图）** → **Synthesis 合成终稿**；兼容旧版「引导块 + 两阶段确认」。
 *
 * [INPUT]: 全局 `VALUE_STREAM_PROMPT_MIRROR`、`VALUE_STREAM_PROMPT_STAGE_HARDENING`、`fetchDeepSeekChat`；Mirror user 见 `buildMirrorStageUserContent`（`getPreliminarySlicesFromItem` → `buildPreliminarySummaryJson` → `buildResolvedPreliminaryRequirement`，核心流程梳理取自已归一的 `operationModel.valueStreamMapping`）；分阶段加固 user 见 `buildPerStageHardeningUserContent`（legacySystems + painPointRadar itGap + causal_relation）
 * [OUTPUT]: `runValueStreamDrawSessionsAutoSequential`、`runValueStreamPhaseMirror`、`runValueStreamPhaseHardening`、`runValueStreamPhaseSynthesis`（占位）、`runValueStreamGeneration`、`runTask4ModificationTwoPhaseRegenerate`（兼容）；**修改链**：`main.js` 写入 `getTask4ValueStreamModificationBundle`（**FE-20260407**：`mirrorSystemPrompt`/`hardeningSystemPrompt` 分路注入），仅在 Session `fromSessionPlan` 自动执行时注入 Mirror/加固提示词，过程日志推 `modificationRegenerateLlmQueryBlock`（沟通历史 **LLM-修改** 三子卡）；跑完 `clearTask4ValueStreamModificationBundle`。`generateValueStreamFromInputs` 仅 **mirror** / **per_stage_hardening**；`task4ValueStreamPromptJsonBlock`；环节编号 `N.{阶段序}.{环节序}`。**FE-20260411**：Mirror 完成后重建加固 `subSteps` 时不继承旧 `done`，避免修改提示词重跑后仅加固未标记完成的阶段。
 * [POS]: 工作流对齐 task4 大模型与聊天区 Session 计划（`valueStreamDrawSessionsBlock`）
 *
 * [PROTOCOL]: 变更时同步 `frontend/js/AGENTS.md`、`frontend/docs/task4ValueStream.md`
 *
 * 排查二阶段超时：控制台执行 `globalThis.__FE_TASK4_LLM_DEBUG = true`，复现后过滤 `[FE:task4-llm]`。输入字符少不代表更快：Hardening 须输出全量 Original+Enhanced，**补全 token 与生成耗时**常远大于 Mirror；另对照 `api.js` 默认超时（online 180s / local 90s）。
 */
(function (global) {
  /** 与 `api.js` 的 `resolveFetchTimeoutMs` 一致，仅用于调试日志展示本次请求生效的上限 */
  function resolveTask4LogTimeoutMs(chatOpts) {
    const raw = chatOpts && chatOpts.timeoutMs != null ? Number(chatOpts.timeoutMs) : NaN;
    const mode = (global.APP_CONFIG || {}).MODE || 'local';
    const def = mode === 'online' ? 180_000 : 90_000;
    if (!Number.isFinite(raw)) return def;
    return Math.max(15_000, Math.min(Math.floor(raw), 600_000));
  }

  function isTask4LlmDebugEnabled() {
    return typeof globalThis !== 'undefined' && globalThis.__FE_TASK4_LLM_DEBUG === true;
  }

  /** @param {'mirror'|'hardening'|'synthesis'} stage */
  function logTask4Llm(stage, event, data) {
    if (!isTask4LlmDebugEnabled()) return;
    const payload = { stage, event, isoTime: new Date().toISOString(), ...data };
    if (event === 'request_error') console.warn('[FE:task4-llm]', payload);
    else console.log('[FE:task4-llm]', payload);
  }

  /** 与 main 的 `__appState.problemDetailChatMessages` 同源；避免 `global.problemDetailChatMessages` 为 undefined 时传入 `[]` 清空主聊天区 */
  function getProblemDetailChatMessagesArray() {
    if (typeof global.getProblemDetailChatMessages === 'function') {
      const m = global.getProblemDetailChatMessages();
      return Array.isArray(m) ? m : [];
    }
    const fb = global.problemDetailChatMessages;
    return Array.isArray(fb) ? fb : [];
  }

  /**
   * 合并写入当前详情案例（须进 SmartCto.appState，供 `renderProblemDetailContent` 读取）。
   * 禁止赋值 `window.currentProblemDetailItem`：与 appState 不同步会导致 Mirror/Hardening 后工作区仍显示占位。
   */
  function patchCurrentProblemDetailItem(patch) {
    if (!patch || typeof patch !== 'object') return;
    const cur =
      typeof global.getCurrentProblemDetailItem === 'function' ? global.getCurrentProblemDetailItem() : null;
    if (!cur) return;
    const next = { ...cur, ...patch };
    if (typeof global.setCurrentProblemDetailItem === 'function') {
      global.setCurrentProblemDetailItem(next);
    } else if (typeof globalThis !== 'undefined' && globalThis.SmartCto?.appState?.setCurrentProblemDetailItem) {
      globalThis.SmartCto.appState.setCurrentProblemDetailItem(next);
    }
  }

  function getMergedProblemItem() {
    const cur =
      typeof global.getCurrentProblemDetailItem === 'function' ? global.getCurrentProblemDetailItem() : global.currentProblemDetailItem;
    if (!cur) return null;
    if (typeof global.findDigitalProblemCaseInList === 'function') {
      return global.findDigitalProblemCaseInList(cur) || cur;
    }
    return cur;
  }

  function persistKeyForItem(item) {
    if (!item) return null;
    if (typeof global.getProblemDetailChatStorageKey === 'function') return global.getProblemDetailChatStorageKey(item);
    return item.createdAt != null ? item.createdAt : null;
  }

  /** 与 `runTask4ModificationTwoPhaseRegenerate` 一致，拼在修订后的 system 后约束 JSON 形态 */
  const TASK4_MIRROR_OUTPUT_PROTOCOL = `

【输出协议（Mirror 须遵守）】
- 你只能输出一个 JSON 对象，禁止输出 Markdown、Mermaid、解释前缀。
- 顶层须含 logic_description（字符串）与 vsm_data（对象），或等价地直接含 stages 数组（与历史格式兼容）。
- vsm_data（或根对象）须含 stages 数组；connections 可选。`;

  const TASK4_STAGE_OUTPUT_PROTOCOL = `

【输出协议（各分阶段加固须遵守）】
- 你只能输出一个 JSON 对象，含 stage_name 与 nodes 数组，禁止 Markdown 围栏与解释前缀。
- 须保留全部 Original 节点语义，可插入 type 为 Enhanced 的节点且必填 gap_resolved。`;

  /** 读取 main 在「请修改」新提示词确认后写入的修改包；仅应在 Session 自动顺序路径使用 */
  function resolveTask4ModificationInjectionForSessionPlan() {
    const item = getMergedProblemItem();
    const pk = persistKeyForItem(item);
    if (!pk || typeof global.getTask4ValueStreamModificationBundle !== 'function') return null;
    const b = global.getTask4ValueStreamModificationBundle(pk);
    if (!b) return null;
    const mirrorInj = String(b.mirrorSystemPrompt != null ? b.mirrorSystemPrompt : b.systemPrompt || '').trim();
    const hardInj = String(b.hardeningSystemPrompt != null ? b.hardeningSystemPrompt : b.systemPrompt || '').trim();
    const act =
      b.versionChangelog && String(b.versionChangelog).trim()
        ? String(b.versionChangelog).trim()
        : '（提示词修订未返回「新版本对老版本的修改」要点）';
    return {
      modificationSysMirror: mirrorInj + TASK4_MIRROR_OUTPUT_PROTOCOL,
      modificationSysHardening: hardInj + TASK4_STAGE_OUTPUT_PROTOCOL,
      modificationUsr: String(b.userPrompt || '').trim(),
      modificationActionMarkdown: act,
    };
  }

  /** 将 Mirror/Hardening 协议中的单节点转为工作区 steps 项（含 vsmL2 供价值流视图子卡片） */
  function normalizeMirrorOrHardenNode(n) {
    if (!n || typeof n !== 'object') return null;
    const lm = n.logic_meta && typeof n.logic_meta === 'object' ? n.logic_meta : {};
    const con = lm.constraints != null ? String(lm.constraints).trim() : '';
    const det = lm.details != null ? String(lm.details).trim() : '';
    const mobj = n.main_object != null ? String(n.main_object).trim() : '';
    const gap = n.gap_resolved != null ? String(n.gap_resolved).trim() : '';
    const typeStr = n.type != null ? String(n.type) : n.Type != null ? String(n.Type) : '';
    const name = String(n.node_name || n.name || '环节').trim() || '环节';
    const nodeId = n.node_id != null ? String(n.node_id).trim() : '';
    const actor = String(n.actor || n.role || '').trim();
    const vsmL2 = {
      node_id: nodeId,
      node_name: name,
      actor,
      main_object: mobj,
      logic_meta: { constraints: con, details: det },
      type: typeStr || 'Original',
      gap_resolved: gap,
    };
    return {
      name,
      desc: typeStr === 'Enhanced' && gap ? gap : '',
      role: actor,
      duration: String(n.duration || n.lead_time || n.time || '').trim(),
      vsmL2,
    };
  }

  /**
   * 当 LLM 未单独返回 logic_description / 拼接逻辑时，从归一化价值流各阶段 clustering_reason 生成设计逻辑正文（供工作区「价值流设计逻辑」卡立即展示）。
   */
  function buildLogicTextFromValueStreamClustering(valueStream) {
    if (!valueStream || typeof valueStream !== 'object' || valueStream.raw || !Array.isArray(valueStream.stages)) return '';
    const parts = [];
    let n = 0;
    for (const st of valueStream.stages) {
      if (!st || typeof st !== 'object') continue;
      const cr = st.clustering_reason != null ? String(st.clustering_reason).trim() : '';
      if (!cr) continue;
      n += 1;
      parts.push(`${n}. ${cr}`);
    }
    return parts.join('\n');
  }

  function enrichValueStreamLogicText(valueStream, logicText) {
    const t = logicText != null ? String(logicText).trim() : '';
    if (t) return t;
    return buildLogicTextFromValueStreamClustering(valueStream);
  }

  /**
   * 为工作区阶段下的环节写入规范编号 `N.{阶段序}.{环节序}`（与解析/渲染一致）。
   * @param {Array} stages
   */
  function applyCanonicalVsmNodeIdsToStagesArray(stages) {
    if (!Array.isArray(stages)) return;
    stages.forEach((stage, si) => {
      if (!stage || typeof stage !== 'object') return;
      const key = Array.isArray(stage.steps)
        ? 'steps'
        : Array.isArray(stage.tasks)
          ? 'tasks'
          : Array.isArray(stage.phases)
            ? 'phases'
            : Array.isArray(stage.items)
              ? 'items'
              : null;
      if (!key) return;
      const arr = stage[key];
      arr.forEach((st, ji) => {
        if (typeof st !== 'object' || !st) return;
        const nid = `N.${si + 1}.${ji + 1}`;
        st.canonicalNodeId = nid;
        if (st.vsmL2 && typeof st.vsmL2 === 'object') {
          st.vsmL2 = { ...st.vsmL2, node_id: nid };
        }
      });
    });
  }

  /** L1 块 → { name, steps } */
  function normalizeStageBlock(block, index) {
    if (!block || typeof block !== 'object') return { name: `阶段${index + 1}`, steps: [] };
    const rawNodes = block.nodes || block.steps || block.tasks || [];
    const nodes = Array.isArray(rawNodes) ? rawNodes : [];
    const steps = nodes.map(normalizeMirrorOrHardenNode).filter(Boolean);
    const sid = index + 1;
    steps.forEach((step, ji) => {
      const nid = `N.${sid}.${ji + 1}`;
      step.canonicalNodeId = nid;
      if (step.vsmL2 && typeof step.vsmL2 === 'object') {
        step.vsmL2 = { ...step.vsmL2, node_id: nid };
      }
    });
    const rawTitle = String(block.stage_name || block.name || `阶段${index + 1}`).trim() || `阶段${index + 1}`;
    const splitFn =
      typeof global.splitStageTitleAndParenthetical === 'function'
        ? global.splitStageTitleAndParenthetical
        : (x) => ({ title: String(x || '').trim(), hint: '' });
    const split = splitFn(rawTitle);
    const baseName = split.hint ? split.title : rawTitle;
    const crField = block.clustering_reason != null ? String(block.clustering_reason).trim() : '';
    const cr = crField || split.hint || '';
    const out = { name: baseName, steps };
    if (cr) out.clustering_reason = cr;
    return out;
  }

  /**
   * 将 LLM 解析结果（顶层阶段数组、或 stages+nodes、或历史 tasks 结构）归一为工作区 { stages }。
   * @param {*} parsed - JSON.parse 结果
   * @returns {object|null}
   */
  function normalizeTask4LlmToWorkspace(parsed) {
    if (parsed == null) return null;
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return null;
      const f = parsed[0];
      if (f && typeof f === 'object' && (f.stage_name != null || Array.isArray(f.nodes))) {
        return { stages: parsed.map((b, i) => normalizeStageBlock(b, i)) };
      }
      return null;
    }
    if (typeof parsed !== 'object') return null;
    if (parsed.vsm_data && typeof parsed.vsm_data === 'object') {
      const inner = normalizeTask4LlmToWorkspace(parsed.vsm_data);
      if (inner) return inner;
    }
    if (Array.isArray(parsed.stages) && parsed.stages.length) {
      const s0 = parsed.stages[0];
      const hasClassic = s0 && (Array.isArray(s0.tasks) || Array.isArray(s0.steps));
      if (hasClassic) {
        applyCanonicalVsmNodeIdsToStagesArray(parsed.stages);
        return parsed;
      }
      if (s0 && Array.isArray(s0.nodes)) {
        return { ...parsed, stages: parsed.stages.map((b, i) => normalizeStageBlock(b, i)) };
      }
    }
    const wrapped = parsed.valueStream || parsed.value_stream || parsed.data || parsed.result;
    if (wrapped && typeof wrapped === 'object') {
      const inner = normalizeTask4LlmToWorkspace(wrapped);
      if (inner) return inner;
    }
    return null;
  }

  function getPreliminarySlicesFromItem(item) {
    const summary =
      item && typeof global.buildPreliminarySummaryJson === 'function' ? global.buildPreliminarySummaryJson(item) : {};
    const hasV2 = summary && typeof summary === 'object' && Object.keys(summary).length > 0;
    const op = hasV2 && summary.operationModel && typeof summary.operationModel === 'object' ? summary.operationModel : {};
    const valueStreamMapping = Array.isArray(op.valueStreamMapping) ? op.valueStreamMapping : [];
    const orgAndRoles = op.orgAndRoles && typeof op.orgAndRoles === 'object' ? op.orgAndRoles : {};
    return {
      valueStreamMapping,
      orgAndRoles,
      painPointRadar: hasV2 && summary.painPointRadar !== undefined ? summary.painPointRadar : undefined,
      itLandscape: hasV2 && summary.itLandscape !== undefined ? summary.itLandscape : undefined,
      hasV2,
    };
  }

  /**
   * 解析大模型返回为 { valueStream, logicText }（L1/L2 数组、vsm_data、历史 stages/tasks 兼容）
   */
  function parseValueStreamLlmContent(content) {
    const contentTrim = (content != null ? String(content) : '').trim();
    const raw = content != null ? String(content) : '';

    function tryParseAndNormalize(text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed == null) return null;
        if (!Array.isArray(parsed) && parsed.vsm_data && (parsed.vsm_data.stages || parsed.vsm_data.connections)) {
          const vs = parsed.vsm_data;
          const norm = normalizeTask4LlmToWorkspace(vs);
          return {
            valueStream: norm || vs,
            logicText: (parsed.logic_description != null ? String(parsed.logic_description) : '').trim(),
          };
        }
        const norm = normalizeTask4LlmToWorkspace(parsed);
        if (norm && Array.isArray(norm.stages)) {
          let lt = '';
          if (!Array.isArray(parsed) && parsed.logic_description) lt = String(parsed.logic_description).trim();
          else if (Array.isArray(parsed)) {
            lt = parsed
              .map((s) => (s && s.clustering_reason != null ? String(s.clustering_reason).trim() : ''))
              .filter(Boolean)
              .join('\n');
          }
          return { valueStream: norm, logicText: lt };
        }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (Array.isArray(parsed.stages) || Array.isArray(parsed.connections))) {
          const norm2 = normalizeTask4LlmToWorkspace(parsed);
          return {
            valueStream: norm2 || parsed,
            logicText: (parsed.logic_description != null ? String(parsed.logic_description) : '').trim(),
          };
        }
      } catch (_) {}
      return null;
    }

    const direct = tryParseAndNormalize(contentTrim);
    if (direct) return direct;

    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const fb = tryParseAndNormalize(jsonMatch[1].trim());
      if (fb) return fb;
    }
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      const fb = tryParseAndNormalize(arrMatch[0]);
      if (fb) return fb;
    }
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (objMatch) {
      const fb = tryParseAndNormalize(objMatch[0]);
      if (fb) return fb;
    }
    return { valueStream: { raw }, logicText: raw.replace(/```[\s\S]*?```/g, '').trim() };
  }

  function buildTripleUserContent(enterpriseInfo, bmcData, requirementLogic) {
    return `请基于以下三个维度的数据生成价值流图：

## 1. enterprise_info（客户基本信息）
\`\`\`json
${typeof enterpriseInfo === 'string' ? enterpriseInfo : JSON.stringify(enterpriseInfo || {}, null, 2)}
\`\`\`

## 2. bmc_data（商业模式画布 BMC）
\`\`\`json
${typeof bmcData === 'string' ? bmcData : JSON.stringify(bmcData || {}, null, 2)}
\`\`\`

## 3. requirement_logic（需求逻辑）
\`\`\`json
${typeof requirementLogic === 'string' ? requirementLogic : JSON.stringify(requirementLogic || {}, null, 2)}
\`\`\``;
  }

  /** Mirror 用户消息：从 BMC 取价值主张（与 task2 `value_propositions` 对齐） */
  function pickBmcValuePropositionsForMirror(bmcData) {
    if (bmcData && typeof bmcData === 'object' && !Array.isArray(bmcData)) {
      const vp = bmcData.value_propositions;
      if (vp != null && String(vp).trim() !== '') {
        return { value_propositions: typeof vp === 'string' ? vp.trim() : vp };
      }
    }
    return {};
  }

  /** Mirror：初步需求 V2 roadmap.phase1_Critical（最紧急/第一阶段），供价值流覆盖约束 */
  function pickPhase1CriticalForMirror(item) {
    if (!item || typeof global.buildPreliminarySummaryJson !== 'function') return {};
    try {
      const summary = global.buildPreliminarySummaryJson(item);
      const roadmap = summary && typeof summary.roadmap === 'object' && summary.roadmap ? summary.roadmap : {};
      const p1 = roadmap.phase1_Critical;
      if (p1 == null) return {};
      if (typeof p1 === 'object' && !Array.isArray(p1)) {
        return Object.keys(p1).length ? { phase1_Critical: p1 } : {};
      }
      const s = String(p1).trim();
      if (!s) return {};
      try {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { phase1_Critical: parsed };
      } catch (_) {}
      return { phase1_Critical: { raw: s } };
    } catch (_) {
      return {};
    }
  }

  /** Mirror 用户消息：需求逻辑中「需求背后的深层动机」→ JSON 字段 deep_motivation（与 task3 章节 key 对齐） */
  function pickRequirementDeepMotivationForMirror(requirementLogic) {
    if (requirementLogic == null) return {};
    if (typeof requirementLogic === 'object' && !Array.isArray(requirementLogic)) {
      const dm = requirementLogic.deep_motivation;
      if (dm != null && String(dm).trim() !== '') return { deep_motivation: String(dm).trim() };
    }
    if (typeof global.parseRequirementLogicFromMarkdown === 'function') {
      const parsed = global.parseRequirementLogicFromMarkdown(String(requirementLogic));
      const t = parsed && parsed.deep_motivation != null ? String(parsed.deep_motivation).trim() : '';
      if (t) return { deep_motivation: t };
    }
    return {};
  }

  /** 需求逻辑「初步需求与商业模式的因果关联」→ `causal_relation`（与 task3 对齐） */
  function pickRequirementCausalRelationForHardening(requirementLogic) {
    if (requirementLogic == null) return {};
    if (typeof requirementLogic === 'object' && !Array.isArray(requirementLogic)) {
      const cr = requirementLogic.causal_relation;
      if (cr != null && String(cr).trim() !== '') return { causal_relation: String(cr).trim() };
    }
    if (typeof global.parseRequirementLogicFromMarkdown === 'function') {
      const parsed = global.parseRequirementLogicFromMarkdown(String(requirementLogic));
      const t = parsed && parsed.causal_relation != null ? String(parsed.causal_relation).trim() : '';
      if (t) return { causal_relation: t };
    }
    return {};
  }

  /** 初步需求 V2 `itLandscape.legacySystems` → 单列 JSON 供 Hardening 极简上下文 */
  function pickItLegacySystemsForHardening(itLandscape) {
    if (!itLandscape || typeof itLandscape !== 'object' || Array.isArray(itLandscape)) {
      return { legacySystems: [] };
    }
    const leg = itLandscape.legacySystems;
    if (leg == null) return { legacySystems: [] };
    return { legacySystems: Array.isArray(leg) ? leg : [leg] };
  }

  /** Hardening user：BMC 成本结构 + 收入来源（与 task2 对齐；当前主流程 Hardening user 未注入，保留供扩展/修改链） */
  function pickBmcCostAndRevenueForHardening(bmcData) {
    if (!bmcData || typeof bmcData !== 'object' || Array.isArray(bmcData)) return {};
    const out = {};
    ['cost_structure', 'revenue_streams'].forEach((k) => {
      const v = bmcData[k];
      if (v != null && String(v).trim() !== '') out[k] = typeof v === 'string' ? v.trim() : v;
    });
    return out;
  }

  function buildMirrorStageUserContent(item, enterpriseInfo, bmcData, requirementLogic) {
    const sl = getPreliminarySlicesFromItem(item);
    const vsJson = JSON.stringify(sl.valueStreamMapping.length ? sl.valueStreamMapping : [], null, 2);
    const orgJson = JSON.stringify(Object.keys(sl.orgAndRoles).length ? sl.orgAndRoles : {}, null, 2);
    const bmcVpJson = JSON.stringify(pickBmcValuePropositionsForMirror(bmcData), null, 2);
    const motiveJson = JSON.stringify(pickRequirementDeepMotivationForMirror(requirementLogic), null, 2);
    const phase1Json = JSON.stringify(pickPhase1CriticalForMirror(item), null, 2);
    let body = `## 1. 核心业务流程梳理（step、actor、action、object、logicalConstraint）\n\n\`\`\`json\n${vsJson}\n\`\`\`\n\n## 2. 人员组织模式（stakeholders、governanceLogic、incentiveHooks）\n\n\`\`\`json\n${orgJson}\n\`\`\`\n\n## 3. BMC 核心【价值主张】（value_propositions）\n\n\`\`\`json\n${bmcVpJson}\n\`\`\`\n\n## 4. 需求【显性动机】（需求逻辑 → 需求背后的深层动机，字段 deep_motivation）\n\n\`\`\`json\n${motiveJson}\n\`\`\`\n\n## 5. 初步需求 → 最紧急/第一阶段（roadmap.phase1_Critical，JSON 根键为 phase1_Critical 或见内层对象）\n\n\`\`\`json\n${phase1Json}\n\`\`\`\n\n请严格按系统提示仅输出 JSON（阶段数组）；须满足系统提示中对 phase1_Critical 与价值流环节的覆盖约束。`;
    if (!sl.hasV2 || !sl.valueStreamMapping.length) {
      body += `\n\n## 6. 补充上下文（无 V2 初步需求或流程梳理为空时参考）\n\n${buildTripleUserContent(enterpriseInfo, bmcData, requirementLogic)}`;
    }
    return body;
  }

  function cloneValueStreamJson(vsm) {
    try {
      return JSON.parse(JSON.stringify(vsm));
    } catch (_) {
      return vsm;
    }
  }

  /** painPointRadar 各条含 dimension / itGap，作为「IT Gap」合成 JSON 注入分阶段加固 */
  function pickPainPointRadarForStageHardening(item) {
    const sl = getPreliminarySlicesFromItem(item);
    return Array.isArray(sl.painPointRadar) ? sl.painPointRadar : [];
  }

  function workspaceStepToOriginalNode(step, stageIndex0, stepIndex0) {
    if (!step || typeof step !== 'object') return null;
    const si = Number.isFinite(stageIndex0) && stageIndex0 >= 0 ? Math.floor(stageIndex0) : 0;
    const ji = Number.isFinite(stepIndex0) && stepIndex0 >= 0 ? Math.floor(stepIndex0) : 0;
    const id = `N.${si + 1}.${ji + 1}`;
    const v2 = step.vsmL2 && typeof step.vsmL2 === 'object' ? step.vsmL2 : {};
    const lm = v2.logic_meta && typeof v2.logic_meta === 'object' ? v2.logic_meta : {};
    return {
      node_id: id,
      node_name: String(v2.node_name || step.name || '环节').trim() || '环节',
      actor: String(v2.actor || step.role || '').trim(),
      main_object:
        v2.main_object != null
          ? String(v2.main_object).trim()
          : step.main_object != null
            ? String(step.main_object).trim()
            : '',
      type: String(v2.type || 'Original').replace(/enhanced/i, 'Enhanced'),
      gap_resolved:
        v2.gap_resolved != null && String(v2.gap_resolved).trim() ? String(v2.gap_resolved).trim() : null,
      logic_meta: {
        constraints: lm.constraints != null ? String(lm.constraints) : '',
        details: lm.details != null ? String(lm.details) : '',
      },
    };
  }

  function workspaceStageToOriginalNodesForPrompt(stage, stageIndex0) {
    if (!stage || typeof stage !== 'object') return [];
    const steps = Array.isArray(stage.steps) ? stage.steps : Array.isArray(stage.tasks) ? stage.tasks : [];
    const si = Number.isFinite(stageIndex0) && stageIndex0 >= 0 ? Math.floor(stageIndex0) : 0;
    return steps.map((step, i) => workspaceStepToOriginalNode(step, si, i)).filter(Boolean);
  }

  function buildPerStageHardeningUserContent(stageDisplayName, originalNodes, item, requirementLogic) {
    const legacyJson = JSON.stringify(pickItLegacySystemsForHardening(getPreliminarySlicesFromItem(item).itLandscape), null, 2);
    const itGapJson = JSON.stringify(pickPainPointRadarForStageHardening(item), null, 2);
    const causalJson = JSON.stringify(pickRequirementCausalRelationForHardening(requirementLogic), null, 2);
    const nodesJson = JSON.stringify(originalNodes, null, 2);
    const name = String(stageDisplayName || '').trim() || '（未命名阶段）';
    return `## 1. 待处理素材 (Stage Artifacts)
* **目标阶段**: ${name}
* **原始节点清单 (JSON)**:

\`\`\`json
${nodesJson}
\`\`\`

## 2. 架构加固背景 (Hardening Context)
* **IT现状**: [初步需求→ IT 现状/已有系统→legacySystems字段json]

\`\`\`json
${legacyJson}
\`\`\`

* **IT Gap**: [初步需求→核心需求与痛点→各维度的 itGap字段合成 json]

\`\`\`json
${itGapJson}
\`\`\`

* **初步需求与商业模式的"因果关联"**: [需求逻辑→ 初步需求与商业模式的"因果关联"json]

\`\`\`json
${causalJson}
\`\`\`
`;
  }

  function parseSingleStageHardeningLlmContent(content) {
    const raw = content != null ? String(content) : '';
    const tryOne = (text) => {
      try {
        const p = JSON.parse(text);
        if (p && typeof p === 'object' && Array.isArray(p.nodes)) return p;
        if (Array.isArray(p) && p.length && p[0] && typeof p[0] === 'object' && Array.isArray(p[0].nodes)) return p[0];
      } catch (_) {}
      return null;
    };
    let o = tryOne(raw.trim());
    if (o) return o;
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) {
      o = tryOne(fence[1].trim());
      if (o) return o;
    }
    const brace = raw.match(/\{[\s\S]*"nodes"\s*:\s*\[[\s\S]*\]\s*[\s\S]*\}/);
    if (brace) {
      o = tryOne(brace[0]);
      if (o) return o;
    }
    return null;
  }

  function mergeHardenedStageIntoWorkingVsm(workingVsm, stageIndex, stageBlockFromLlm) {
    if (!workingVsm || !Array.isArray(workingVsm.stages) || stageIndex < 0 || stageIndex >= workingVsm.stages.length)
      return workingVsm;
    const prev = workingVsm.stages[stageIndex];
    const normalized = normalizeStageBlock(stageBlockFromLlm, stageIndex);
    workingVsm.stages[stageIndex] = {
      name: normalized.name || prev.name,
      steps: normalized.steps,
      clustering_reason: normalized.clustering_reason || prev.clustering_reason,
    };
    return workingVsm;
  }

  /**
   * @param {Array} existingSubSteps - 仅用于**未重跑 Mirror** 时恢复进度（长度对齐时继承 `done`）。**禁止**在「本轮刚完成 Mirror」后传入旧 subSteps，否则旧 `done:true` 会导致后续加固循环跳过前序阶段（FE-20260411）。
   */
  function buildHardeningSubSessionsFromVsm(vsm, existingSubSteps) {
    if (!vsm || typeof vsm !== 'object' || vsm.raw || !Array.isArray(vsm.stages)) return [];
    return vsm.stages.map((st, idx) => {
      const name = String(st.name || `阶段${idx + 1}`).trim() || `阶段${idx + 1}`;
      const prev = Array.isArray(existingSubSteps) ? existingSubSteps[idx] : null;
      return {
        stepName: `加固：${name}`,
        done: prev ? !!prev.done : false,
        stageIndex: idx,
      };
    });
  }

  function normalizeStoredDrawSessions(stored, defaultTwo) {
    const d0 = defaultTwo[0];
    const d1 = defaultTwo[1];
    if (!Array.isArray(stored) || stored.length === 0) return [{ ...d0 }, { ...d1, subSteps: [] }];
    if (stored.length >= 3 && !Array.isArray(stored[1]?.subSteps)) {
      const mirrorDone = !!stored[0]?.done;
      const p2done = !!(stored[1]?.done && stored[2]?.done);
      return [
        { ...d0, done: mirrorDone },
        { ...d1, done: p2done, subSteps: [] },
      ];
    }
    return [
      { ...d0, done: !!stored[0]?.done },
      {
        ...d1,
        done: !!stored[1]?.done,
        subSteps: Array.isArray(stored[1]?.subSteps)
          ? stored[1].subSteps.map((s, i) => ({
              stepName: s.stepName || `加固：阶段${i + 1}`,
              done: !!s.done,
              stageIndex: s.stageIndex != null ? Number(s.stageIndex) : i,
            }))
          : [],
      },
    ];
  }

  function valueStreamDrawSessionsHasUnfinished(sessions) {
    if (!Array.isArray(sessions) || sessions.length < 2) return true;
    if (!sessions[0].done) return true;
    const subs = sessions[1] && Array.isArray(sessions[1].subSteps) ? sessions[1].subSteps : [];
    if (subs.length === 0) return !sessions[1].done;
    return subs.some((s) => !s.done);
  }

  /**
   * @param {'mirror'|'per_stage_hardening'} stage
   * @param {object} [options]
   * @param {object} [options.item] - 当前案例（缺省则 getCurrentProblemDetailItem）
   * @param {object} [options.perStage] - per_stage_hardening：`stageDisplayName`、`originalNodes`、`stageIndex`
   * @param {string} [options.modificationSys] - 修改链路注入的系统约束
   * @param {string} [options.modificationUsr] - 修改链路注入的用户说明
   */
  async function generateValueStreamFromInputs(enterpriseInfo, bmcData, requirementLogic, stage, options) {
    const opt = options || {};
    const st = stage === 'per_stage_hardening' ? 'per_stage_hardening' : 'mirror';
    const item =
      opt.item ||
      (typeof global.getCurrentProblemDetailItem === 'function' ? global.getCurrentProblemDetailItem() : global.currentProblemDetailItem);
    let userContent;
    if (st === 'per_stage_hardening') {
      const ps = opt.perStage || {};
      userContent = buildPerStageHardeningUserContent(
        ps.stageDisplayName,
        Array.isArray(ps.originalNodes) ? ps.originalNodes : [],
        item,
        requirementLogic,
      );
    } else {
      userContent = buildMirrorStageUserContent(item, enterpriseInfo, bmcData, requirementLogic);
    }
    if (opt.modificationUsr && String(opt.modificationUsr).trim()) {
      userContent += `\n\n## 本轮修改意图与用户说明\n${String(opt.modificationUsr).trim()}\n`;
    }
    let systemPrompt;
    if (st === 'per_stage_hardening') {
      systemPrompt =
        typeof global.VALUE_STREAM_PROMPT_STAGE_HARDENING === 'string' && global.VALUE_STREAM_PROMPT_STAGE_HARDENING.trim()
          ? global.VALUE_STREAM_PROMPT_STAGE_HARDENING
          : '# 数字化架构专家\n单阶段输出含 stage_name 与 nodes 的 Strict JSON。';
    } else {
      systemPrompt =
        typeof global.VALUE_STREAM_PROMPT_MIRROR === 'string' && global.VALUE_STREAM_PROMPT_MIRROR.trim()
          ? global.VALUE_STREAM_PROMPT_MIRROR
          : global.VALUE_STREAM_PROMPT;
    }
    if (opt.modificationSys && String(opt.modificationSys).trim()) {
      systemPrompt = `${systemPrompt}\n\n【本轮修改专用系统约束】\n${String(opt.modificationSys).trim()}`;
    }
    if (!systemPrompt || !String(systemPrompt).trim()) {
      systemPrompt =
        '# 角色：价值流建模助手\n请根据后续提供的 JSON 上下文生成符合前端组件要求的价值流图 JSON。优先保证 JSON 语法正确。';
    }
    const psMeta = st === 'per_stage_hardening' ? opt.perStage || {} : {};
    const promptJsonText = JSON.stringify(
      st === 'per_stage_hardening'
        ? {
            phase: st,
            stageIndex: psMeta.stageIndex,
            stageDisplayName: psMeta.stageDisplayName,
            system: systemPrompt,
            user: userContent,
          }
        : { phase: st, system: systemPrompt, user: userContent },
      null,
      2,
    );
    if (typeof global.pushAndSaveProblemDetailChat === 'function') {
      global.pushAndSaveProblemDetailChat({
        role: 'system',
        type: 'task4ValueStreamPromptJsonBlock',
        taskId: 'task4',
        valueStreamPhase: st,
        task4PerStageIndex: psMeta.stageIndex,
        task4PerStageName: psMeta.stageDisplayName,
        promptJsonText,
        timestamp: global.getTimeStr(),
      });
      refreshProblemDetailChatFromStorage();
    }
    const chatContainer = global.el && global.el.problemDetailChatMessages;
    let loadingBlock = null;
    if (chatContainer) {
      loadingBlock = document.createElement('div');
      loadingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
      const loadingLabel =
        st === 'mirror'
          ? '正在执行忠实还原 (Mirror Stage)…'
          : `正在分阶段架构加固：${String((opt.perStage && opt.perStage.stageDisplayName) || '当前阶段')}…`;
      loadingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">${global.escapeHtml(
        loadingLabel,
      )}</span></div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
      chatContainer.appendChild(loadingBlock);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    const fetchOpts = opt.chatOpts && typeof opt.chatOpts === 'object' ? opt.chatOpts : undefined;
    const systemChars = systemPrompt.length;
    const userChars = userContent.length;
    const tRequestStart = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    logTask4Llm(st, 'request_start', {
      systemChars,
      userChars,
      totalPromptChars: systemChars + userChars,
      approxPromptTokensHint: Math.ceil((systemChars + userChars) / 4),
      systemPromptSource:
        st === 'per_stage_hardening' ? 'VALUE_STREAM_PROMPT_STAGE_HARDENING' : 'VALUE_STREAM_PROMPT_MIRROR|VALUE_STREAM_PROMPT',
      timeoutMsEffective: resolveTask4LogTimeoutMs(fetchOpts),
      mode: (global.APP_CONFIG || {}).MODE || 'local',
      hasModificationSys: !!(opt.modificationSys && String(opt.modificationSys).trim()),
      hasModificationUsr: !!(opt.modificationUsr && String(opt.modificationUsr).trim()),
      note: '分阶段加固单次仅输出一个 L1 阶段 JSON，耗时与 nodes 规模相关；若日志显示 isAbort 见 api 层。',
    });
    try {
      const { content, usage, model, durationMs } = await global.fetchDeepSeekChat(
        [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
        ],
        fetchOpts,
      );
      const tEnd = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      logTask4Llm(st, 'request_success', {
        clientElapsedMs: Math.round(tEnd - tRequestStart),
        durationMsReported: durationMs,
        responseChars: content != null ? String(content).length : 0,
        usage,
        model,
      });
      return { content, usage, model, durationMs, fullPrompt: userContent, systemPromptUsed: systemPrompt };
    } catch (err) {
      const tEnd = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      logTask4Llm(st, 'request_error', {
        clientElapsedMs: Math.round(tEnd - tRequestStart),
        message: err && err.message ? String(err.message) : String(err),
        systemChars,
        userChars,
        timeoutMsEffective: resolveTask4LogTimeoutMs(fetchOpts),
      });
      throw err;
    } finally {
      if (loadingBlock && loadingBlock.parentNode) loadingBlock.remove();
    }
  }

  function refreshProblemDetailChatFromStorage() {
    const c = global.el && global.el.problemDetailChatMessages;
    if (!c) return;
    c.innerHTML = '';
    global.renderProblemDetailChatFromStorage?.(c, getProblemDetailChatMessagesArray());
    c.scrollTop = c.scrollHeight;
  }

  function pushHardeningIntroBlock() {
    global.pushAndSaveProblemDetailChat?.({
      type: 'valueStreamPhaseIntroBlock',
      taskId: 'task4',
      phase: 'hardening',
      content: '我将继续按 VSM 各阶段逐段进行架构加固与无损集成（与 Session 计划中「分阶段架构加固」一致）。',
      timestamp: global.getTimeStr(),
      confirmed: false,
    });
    refreshProblemDetailChatFromStorage();
  }

  /**
   * 对 workingVsm 的某一 L1 阶段调用分阶段加固大模型并写入 workingVsm（就地修改）。
   */
  async function executeStageHardenAtIndex(workingVsm, stageIndex, ctx) {
    const { item, basicInfo, bmc, requirementLogic, chatOpts, modificationSys, modificationUsr } = ctx;
    const stBlock = workingVsm.stages[stageIndex];
    if (!stBlock) throw new Error(`阶段索引 ${stageIndex} 不存在`);
    const displayName = String(stBlock.name || `阶段${stageIndex + 1}`).trim() || `阶段${stageIndex + 1}`;
    const originalNodes = workspaceStageToOriginalNodesForPrompt(stBlock, stageIndex);
    const { content, usage, model, durationMs, fullPrompt, systemPromptUsed } = await generateValueStreamFromInputs(
      basicInfo,
      bmc,
      requirementLogic,
      'per_stage_hardening',
      {
        item,
        chatOpts,
        modificationSys,
        modificationUsr,
        perStage: { stageDisplayName: displayName, originalNodes, stageIndex },
      },
    );
    const parsed = parseSingleStageHardeningLlmContent(content);
    if (!parsed || !Array.isArray(parsed.nodes)) {
      throw new Error(`阶段「${displayName}」加固结果无法解析为含 nodes 的 JSON`);
    }
    mergeHardenedStageIntoWorkingVsm(workingVsm, stageIndex, parsed);
    return { content, usage, model, durationMs, fullPrompt, systemPromptUsed, displayName };
  }

  /**
   * Mirror Stage：生成草稿并下发 Hardening 引导块（不弹出任务完工确认）
   */
  async function runValueStreamPhaseMirror(extraOptions) {
    const container = global.el && global.el.problemDetailChatMessages;
    const item =
      typeof global.getCurrentProblemDetailItem === 'function'
      ? global.getCurrentProblemDetailItem()
      : global.currentProblemDetailItem;
    const opt = extraOptions || {};
    const fromSessionPlan = !!opt.fromSessionPlan;
    if (!container || !item?.createdAt) return;
    if (!global.hasAiConfig || !global.hasAiConfig()) {
      const msg = '请先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）才能使用价值流图生成功能。';
      const errBlock = document.createElement('div');
      errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
      errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">${global.escapeHtml(
        msg,
      )}</div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
      container.appendChild(errBlock);
      global.pushAndSaveProblemDetailChat?.({ role: 'system', content: msg, timestamp: global.getTimeStr() });
      return;
    }
    const basicInfo = item.basicInfo || global.problemDetailConfirmedBasicInfo || {};
    const bmc = item.bmc || {};
    const requirementLogic = item.requirementLogic || {};
    const modInj = fromSessionPlan ? resolveTask4ModificationInjectionForSessionPlan() : null;
    const mirrorSysEff = modInj ? modInj.modificationSysMirror : opt.modificationSys;
    const mirrorUsrEff = modInj ? modInj.modificationUsr : opt.modificationUsr;
    try {
      const { content, usage, model, durationMs, fullPrompt, systemPromptUsed } = await generateValueStreamFromInputs(
        basicInfo,
        bmc,
        requirementLogic,
        'mirror',
        { item, modificationSys: mirrorSysEff, modificationUsr: mirrorUsrEff, chatOpts: opt.chatOpts },
      );
      let { valueStream, logicText } = parseValueStreamLlmContent(content);
      logicText = enrichValueStreamLogicText(valueStream, logicText);
      const llmInputMirror = `【系统】\n${systemPromptUsed || ''}\n\n【用户】\n${fullPrompt != null ? String(fullPrompt) : ''}`;
      if (typeof global.updateDigitalProblemValueStreamLogicText === 'function') {
        global.updateDigitalProblemValueStreamLogicText(item.createdAt, logicText || '', 'mirror');
      }
      global.pushOperationToHistory?.(
        item.createdAt,
        'valueStreamDraw',
        JSON.parse(JSON.stringify(item)),
        getProblemDetailChatMessagesArray().length,
      );
      global.pushAndSaveProblemDetailChat?.({
        type: 'valueStreamCard',
        taskId: 'task4',
        data: valueStream,
        logicText: logicText || '',
        valueStreamPhase: 'mirror',
        timestamp: global.getTimeStr(),
        confirmed: false,
        llmMeta: { usage, model, durationMs },
      });
      global.updateDigitalProblemValueStream?.(item.createdAt, valueStream);
      const ltM = logicText || '';
      patchCurrentProblemDetailItem({
        valueStream,
        valueStreamLogicText: ltM || item.valueStreamLogicText || '',
        valueStreamLogicTextMirror: ltM || item.valueStreamLogicTextMirror || '',
        valueStreamLogicTextHardening: item.valueStreamLogicTextHardening || '',
      });
      global.renderProblemDetailContent?.();
      if (modInj) {
        global.pushAndSaveProblemDetailChat?.({
          type: 'modificationRegenerateLlmQueryBlock',
          taskId: 'task4',
          noteName: '忠实还原策略价值流生成',
          valueStreamPhase: 'mirror',
          llmInputPrompt: llmInputMirror,
          llmOutputRaw: content != null ? String(content) : '',
          modificationActionMarkdown: modInj.modificationActionMarkdown,
          llmMeta: { usage, model, durationMs },
          timestamp: global.getTimeStr(),
          confirmed: false,
        });
      } else {
        global.pushAndSaveProblemDetailChat?.({
          role: 'system',
          type: 'task4LlmQueryBlock',
          taskId: 'task4',
          noteName: '忠实还原策略价值流生成',
          valueStreamPhase: 'mirror',
          llmInputPrompt: llmInputMirror,
          llmOutputRaw: content != null ? String(content) : '',
          llmMeta: { usage, model, durationMs },
          timestamp: global.getTimeStr(),
          confirmed: false,
        });
      }
      if (!fromSessionPlan) {
        pushHardeningIntroBlock();
      } else {
        refreshProblemDetailChatFromStorage();
      }
      requestAnimationFrame(() => {
        global.renderProblemDetailContent?.();
      });
      global.renderProblemDetailHistory?.();
    } catch (err) {
      const errBlock = document.createElement('div');
      errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
      errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">价值流图 Mirror Stage 生成失败：${global.escapeHtml(
        err.message || String(err),
      )}</div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
      container.appendChild(errBlock);
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        content: '价值流图 Mirror Stage 生成失败：' + (err.message || String(err)),
        timestamp: global.getTimeStr(),
      });
    }
  }

  /**
   * 架构加固：按 VSM 各 L1 阶段串行调用分阶段加固提示词，合并回工作区形状；`skipWorkspaceUpdate` 时仅落 `valueStreamHardeningDraft` + 聊天卡。
   */
  async function runValueStreamPhaseHardening(extraOptions) {
    const container = global.el && global.el.problemDetailChatMessages;
    const item =
      typeof global.getCurrentProblemDetailItem === 'function'
        ? global.getCurrentProblemDetailItem()
        : global.currentProblemDetailItem;
    const opt = extraOptions || {};
    const skipWs = !!opt.skipWorkspaceUpdate;
    if (!container || !item?.createdAt) return;
    const mirrorVsm = item.valueStream;
    if (!mirrorVsm || mirrorVsm.raw) {
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        content: '无法执行架构加固：请先完成 Mirror Stage 并生成有效价值流草稿。',
        timestamp: global.getTimeStr(),
      });
      const c = global.el && global.el.problemDetailChatMessages;
      if (c) {
        c.innerHTML = '';
        global.renderProblemDetailChatFromStorage?.(c, getProblemDetailChatMessagesArray());
        c.scrollTop = c.scrollHeight;
      }
      return;
    }
    if (!global.hasAiConfig || !global.hasAiConfig()) {
      const msg = '请先配置 AI 才能执行分阶段架构加固。';
      global.pushAndSaveProblemDetailChat?.({ role: 'system', content: msg, timestamp: global.getTimeStr() });
      return;
    }
    const basicInfo = item.basicInfo || global.problemDetailConfirmedBasicInfo || {};
    const bmc = item.bmc || {};
    const requirementLogic = item.requirementLogic || {};
    try {
      const working = cloneValueStreamJson(mirrorVsm);
      if (!working || !Array.isArray(working.stages) || working.stages.length === 0) {
        throw new Error('当前价值流无有效 stages，无法分阶段加固');
      }
      const ctx = {
        item,
        basicInfo,
        bmc,
        requirementLogic,
        chatOpts: opt.chatOpts,
        modificationSys: opt.modificationSys,
        modificationUsr: opt.modificationUsr,
      };
      const rounds = [];
      for (let si = 0; si < working.stages.length; si++) {
        rounds.push(await executeStageHardenAtIndex(working, si, ctx));
      }
      const valueStream = working;
      const logicText = enrichValueStreamLogicText(valueStream, '');
      const llmInputHard = rounds
        .map(
          (r, i) =>
            `【阶段 ${i + 1}：${r.displayName}】\n【系统】\n${r.systemPromptUsed || ''}\n\n【用户】\n${r.fullPrompt != null ? String(r.fullPrompt) : ''}`,
        )
        .join('\n\n---\n\n');
      const llmOutputRaw = rounds
        .map((r, i) => `【阶段 ${i + 1}：${r.displayName}】\n${r.content != null ? String(r.content) : ''}`)
        .join('\n\n---\n\n');
      const usageAgg = rounds.reduce(
        (acc, r) => {
          const u = r.usage || {};
          const pt = Number(u.prompt_tokens) || 0;
          const ct = Number(u.completion_tokens) || 0;
          const tt = Number(u.total_tokens) || pt + ct;
          acc.prompt_tokens += pt;
          acc.completion_tokens += ct;
          acc.total_tokens += tt;
          return acc;
        },
        { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      );
      const durationMs = rounds.reduce((s, r) => s + (Number(r.durationMs) || 0), 0);
      const model = rounds.length ? rounds[rounds.length - 1].model || '' : '';
      const llmMeta = { usage: usageAgg, model, durationMs };
      const pk = persistKeyForItem(item);
      if (!skipWs) {
        if (typeof global.updateDigitalProblemValueStreamLogicText === 'function') {
          global.updateDigitalProblemValueStreamLogicText(item.createdAt, logicText || '', 'hardening');
        }
      } else {
        const draft = { valueStream, logicText: logicText || '' };
        if (typeof global.updateDigitalProblemValueStreamHardeningDraft === 'function' && pk) {
          global.updateDigitalProblemValueStreamHardeningDraft(pk, draft);
        }
        patchCurrentProblemDetailItem({ valueStreamHardeningDraft: draft });
      }
      const snapItem = getMergedProblemItem() || item;
      global.pushOperationToHistory?.(
        item.createdAt,
        'valueStreamDraw',
        JSON.parse(JSON.stringify(snapItem)),
        getProblemDetailChatMessagesArray().length,
      );
      global.pushAndSaveProblemDetailChat?.({
        type: 'valueStreamCard',
        taskId: 'task4',
        data: valueStream,
        logicText,
        valueStreamPhase: skipWs ? 'hardening_draft' : 'hardening_final',
        timestamp: global.getTimeStr(),
        confirmed: false,
        llmMeta,
      });
      if (!skipWs) {
      global.updateDigitalProblemValueStream?.(item.createdAt, valueStream);
        const ltH = logicText || '';
        patchCurrentProblemDetailItem({
        valueStream,
          valueStreamLogicText: ltH || item.valueStreamLogicText || '',
          valueStreamLogicTextMirror: item.valueStreamLogicTextMirror || '',
          valueStreamLogicTextHardening: ltH || item.valueStreamLogicTextHardening || '',
        });
      global.renderProblemDetailContent?.();
      }
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        type: 'task4LlmQueryBlock',
        taskId: 'task4',
        noteName: '分阶段架构加固（全阶段汇总）',
        valueStreamPhase: 'hardening',
        llmInputPrompt: llmInputHard,
        llmOutputRaw,
        llmMeta,
        timestamp: global.getTimeStr(),
        confirmed: false,
      });
      refreshProblemDetailChatFromStorage();
      requestAnimationFrame(() => {
        if (!skipWs) global.renderProblemDetailContent?.();
      });
      if (!skipWs) {
        const taskName = '绘制价值流';
        const g = typeof globalThis !== 'undefined' ? globalThis : global;
        if (typeof g.showTaskCompletionConfirm === 'function') g.showTaskCompletionConfirm('task4', taskName);
      }
      global.renderProblemDetailHistory?.();
    } catch (err) {
      const errBlock = document.createElement('div');
      errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
      errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">价值流分阶段架构加固失败：${global.escapeHtml(
        err.message || String(err),
      )}</div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr()}</div>`;
      container.appendChild(errBlock);
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        content: '价值流分阶段架构加固失败：' + (err.message || String(err)),
        timestamp: global.getTimeStr(),
      });
    }
  }

  /**
   * 已废弃：独立「合成」大模型环节；终稿由分阶段加固直接合并到工作区。保留函数避免旧代码调用时报错。
   */
  async function runValueStreamPhaseSynthesis(extraOptions) {
    void extraOptions;
    global.pushAndSaveProblemDetailChat?.({
      role: 'system',
      content: '已取消独立「合成最终价值流」大模型调用：加固与集成已在各 VSM 阶段串行完成。',
      timestamp: global.getTimeStr(),
    });
    refreshProblemDetailChatFromStorage();
  }

  /**
   * Session 计划：Mirror → 按 stages 动态子任务逐段加固（每段推送进度卡；修改链为 LLM-修改）；结束后弹出任务完工确认。
   */
  async function runValueStreamDrawSessionsAutoSequential() {
    const chatOpts = { taskTag: 'task4', timeoutMs: 300_000 };
    const w = typeof globalThis !== 'undefined' ? globalThis : global;
    const taskName =
      (Array.isArray(w.FOLLOW_TASKS) &&
        w.FOLLOW_TASKS.concat(w.ITGAP_HISTORY_TASKS || []).concat(w.IT_STRATEGY_TASKS || []).find((t) => t.id === 'task4')?.name) ||
      '绘制价值流';
    let base = getMergedProblemItem();
    if (!base?.createdAt) return;
    const modInjSequential = resolveTask4ModificationInjectionForSessionPlan();
    const defSessions =
      typeof global.getDefaultValueStreamDrawSessions === 'function'
        ? global.getDefaultValueStreamDrawSessions()
        : [
            { stepName: '忠实还原 (The Mirror Stage)', done: false, kind: 'mirror' },
            { stepName: '分阶段架构加固与集成', done: false, kind: 'hardening_per_stage', subSteps: [] },
          ];
    const stored = Array.isArray(base.valueStreamDrawSessions) ? base.valueStreamDrawSessions : [];
    let sessions = normalizeStoredDrawSessions(stored, defSessions);
    const pk = persistKeyForItem(base);
    const saveSessions = (next) => {
      if (pk && typeof global.updateDigitalProblemValueStreamDrawSessions === 'function') {
        global.updateDigitalProblemValueStreamDrawSessions(pk, next);
      }
      patchCurrentProblemDetailItem({ valueStreamDrawSessions: next });
    };

    if (!sessions[0]?.done) {
      await runValueStreamPhaseMirror({ fromSessionPlan: true, chatOpts });
      sessions[0] = { ...sessions[0], done: true };
      const itemAfter = getMergedProblemItem();
      const vsm0 = itemAfter && itemAfter.valueStream;
      // Mirror 产出新图后须从零加固各阶段；继承旧 subSteps 的 done 会导致仅执行未完成的阶段（修改提示词后常见只跑最后一阶段）（FE-20260411）
      sessions[1] = {
        ...sessions[1],
        subSteps: buildHardeningSubSessionsFromVsm(vsm0, []),
        done: false,
      };
      saveSessions(sessions);
      refreshProblemDetailChatFromStorage();
    }

    let item = getMergedProblemItem();
    const basicInfo = item.basicInfo || global.problemDetailConfirmedBasicInfo || {};
    const bmc = item.bmc || {};
    const requirementLogic = item.requirementLogic || {};

    if (sessions[0]?.done && sessions[1] && !sessions[1].done) {
      item = getMergedProblemItem();
      const vsm = item && item.valueStream;
      if (!vsm || vsm.raw || !Array.isArray(vsm.stages) || vsm.stages.length === 0) {
        sessions[1].done = true;
        saveSessions(sessions);
        refreshProblemDetailChatFromStorage();
      } else {
        let subSteps = Array.isArray(sessions[1].subSteps) ? sessions[1].subSteps : [];
        if (subSteps.length !== vsm.stages.length) {
          subSteps = buildHardeningSubSessionsFromVsm(vsm, subSteps);
          sessions[1] = { ...sessions[1], subSteps };
          saveSessions(sessions);
          refreshProblemDetailChatFromStorage();
        }
        const working = cloneValueStreamJson(vsm);
        const ctx = {
          item,
          basicInfo,
          bmc,
          requirementLogic,
          chatOpts,
          modificationSys: modInjSequential ? modInjSequential.modificationSysHardening : undefined,
          modificationUsr: modInjSequential ? modInjSequential.modificationUsr : undefined,
        };
        const lastK = subSteps.length - 1;
        for (let k = 0; k < subSteps.length; k++) {
          if (subSteps[k].done) continue;
          const stageIdx = subSteps[k].stageIndex != null ? Number(subSteps[k].stageIndex) : k;
          const r = await executeStageHardenAtIndex(working, stageIdx, ctx);
          const ltCur = enrichValueStreamLogicText(working, '');
          if (typeof global.updateDigitalProblemValueStreamLogicText === 'function') {
            global.updateDigitalProblemValueStreamLogicText(item.createdAt, ltCur || '', 'hardening');
          }
          global.updateDigitalProblemValueStream?.(item.createdAt, working);
          patchCurrentProblemDetailItem({
            valueStream: working,
            valueStreamLogicText: ltCur || item.valueStreamLogicText || '',
            valueStreamLogicTextMirror: item.valueStreamLogicTextMirror || '',
            valueStreamLogicTextHardening: ltCur || item.valueStreamLogicTextHardening || '',
          });
          global.renderProblemDetailContent?.();
          const llmIn = `【系统】\n${r.systemPromptUsed || ''}\n\n【用户】\n${r.fullPrompt != null ? String(r.fullPrompt) : ''}`;
          global.pushAndSaveProblemDetailChat?.({
            type: 'valueStreamCard',
            taskId: 'task4',
            data: cloneValueStreamJson(working),
            logicText: ltCur || '',
            valueStreamPhase: k === lastK ? 'hardening_final' : 'hardening_stage_progress',
            hardeningStageIndex: stageIdx,
            hardeningStageLabel: r.displayName,
            timestamp: global.getTimeStr(),
            confirmed: false,
            llmMeta: { usage: r.usage, model: r.model, durationMs: r.durationMs },
          });
          if (modInjSequential) {
            global.pushAndSaveProblemDetailChat?.({
              type: 'modificationRegenerateLlmQueryBlock',
              taskId: 'task4',
              noteName: `分阶段架构加固：${r.displayName}`,
              valueStreamPhase: 'hardening',
              llmInputPrompt: llmIn,
              llmOutputRaw: r.content != null ? String(r.content) : '',
              modificationActionMarkdown: modInjSequential.modificationActionMarkdown,
              llmMeta: { usage: r.usage, model: r.model, durationMs: r.durationMs },
              timestamp: global.getTimeStr(),
              confirmed: false,
            });
          } else {
            global.pushAndSaveProblemDetailChat?.({
              role: 'system',
              type: 'task4LlmQueryBlock',
              taskId: 'task4',
              noteName: `分阶段架构加固：${r.displayName}`,
              valueStreamPhase: 'hardening',
              llmInputPrompt: llmIn,
              llmOutputRaw: r.content != null ? String(r.content) : '',
              llmMeta: { usage: r.usage, model: r.model, durationMs: r.durationMs },
              timestamp: global.getTimeStr(),
              confirmed: false,
            });
          }
          subSteps[k] = { ...subSteps[k], done: true };
          sessions[1] = { ...sessions[1], subSteps: subSteps.map((s) => ({ ...s })), done: subSteps.every((s) => s.done) };
          saveSessions(sessions);
          refreshProblemDetailChatFromStorage();
          global.renderProblemDetailHistory?.();
          item = getMergedProblemItem();
        }
      }
    }

    const g = typeof globalThis !== 'undefined' ? globalThis : global;
    if (typeof g.showTaskCompletionConfirm === 'function') {
      g.showTaskCompletionConfirm('task4', taskName);
    }
    if (modInjSequential && pk && typeof global.clearTask4ValueStreamModificationBundle === 'function') {
      global.clearTask4ValueStreamModificationBundle(pk);
    }
    global.renderProblemDetailHistory?.();
  }

  /**
   * 修改链路（兼容）：按新提示词依次执行 Mirror + Hardening；主路径已改为 Session 计划 + 自动顺序执行。
   */
  async function runTask4ModificationTwoPhaseRegenerate(systemPrompt, userPrompt, chatOpts) {
    const co = chatOpts && typeof chatOpts === 'object' ? chatOpts : undefined;
    const item =
      typeof global.getCurrentProblemDetailItem === 'function'
        ? global.getCurrentProblemDetailItem()
        : global.currentProblemDetailItem;
    if (!item?.createdAt) throw new Error('缺少当前案例');
    const basicInfo = item.basicInfo || global.problemDetailConfirmedBasicInfo || {};
    const bmc = item.bmc || {};
    const requirementLogic = item.requirementLogic || {};
    const sys = String(systemPrompt || '').trim();
    const usr = String(userPrompt || '').trim();
    const mirrorJsonProtocol = `

【输出协议（Mirror 须遵守）】
- 你只能输出一个 JSON 对象，禁止输出 Markdown、Mermaid、解释前缀。
- 顶层须含 logic_description（字符串）与 vsm_data（对象），或等价地直接含 stages 数组（与历史格式兼容）。
- vsm_data（或根对象）须含 stages 数组；connections 可选。`;

    const stageJsonProtocol = `

【输出协议（各分阶段加固须遵守）】
- 你只能输出一个 JSON 对象，含 stage_name 与 nodes 数组，禁止 Markdown 围栏与解释前缀。
- 须保留全部 Original 节点语义，可插入 type 为 Enhanced 的节点且必填 gap_resolved。`;

    const m1 = await generateValueStreamFromInputs(basicInfo, bmc, requirementLogic, 'mirror', {
      modificationSys: sys + mirrorJsonProtocol,
      modificationUsr: usr,
      chatOpts: co,
    });
    const mirrorParsed = parseValueStreamLlmContent(m1.content);
    if (!mirrorParsed.valueStream || mirrorParsed.valueStream.raw) {
      throw new Error('Mirror Stage 未解析出有效价值流 JSON');
    }
    const mirrorLogic = enrichValueStreamLogicText(mirrorParsed.valueStream, mirrorParsed.logicText);
    global.updateDigitalProblemValueStream?.(item.createdAt, mirrorParsed.valueStream);
    const ltMid = mirrorLogic || '';
    patchCurrentProblemDetailItem({
      valueStream: mirrorParsed.valueStream,
      valueStreamLogicText: ltMid || item.valueStreamLogicText || '',
      valueStreamLogicTextMirror: ltMid || item.valueStreamLogicTextMirror || '',
      valueStreamLogicTextHardening: item.valueStreamLogicTextHardening || '',
    });

    const working = cloneValueStreamJson(mirrorParsed.valueStream);
    if (!working || !Array.isArray(working.stages) || working.stages.length === 0) {
      throw new Error('Mirror 结果无 stages，无法分阶段加固');
    }
    const ctx = {
      item: { ...item, valueStream: mirrorParsed.valueStream },
      basicInfo,
      bmc,
      requirementLogic,
      chatOpts: co,
      modificationSys: sys + stageJsonProtocol,
      modificationUsr: usr,
    };
    const rounds = [];
    for (let si = 0; si < working.stages.length; si++) {
      rounds.push(await executeStageHardenAtIndex(working, si, ctx));
    }
    const hardLogic = enrichValueStreamLogicText(working, '');
    const mirrorInputFull = `【系统】\n${m1.systemPromptUsed || ''}\n\n【用户】\n${m1.fullPrompt || ''}`;
    const hardInputFull = rounds
      .map(
        (r, i) =>
          `【分阶段加固 ${i + 1}：${r.displayName}】\n【系统】\n${r.systemPromptUsed || ''}\n\n【用户】\n${r.fullPrompt || ''}`,
      )
      .join('\n\n---\n\n');
    const usageAgg = rounds.reduce(
      (acc, r) => {
        const u = r.usage || {};
        const pt = Number(u.prompt_tokens) || 0;
        const ct = Number(u.completion_tokens) || 0;
        const tt = Number(u.total_tokens) || pt + ct;
        acc.prompt_tokens += pt;
        acc.completion_tokens += ct;
        acc.total_tokens += tt;
        return acc;
      },
      { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    );
    const hardeningDurationMs = rounds.reduce((s, r) => s + (Number(r.durationMs) || 0), 0);
    const hardeningModel = rounds.length ? rounds[rounds.length - 1].model || '' : '';
    return {
      mirrorContent: m1.content != null ? String(m1.content) : '',
      hardeningContent: rounds.map((r) => (r.content != null ? String(r.content) : '')).join('\n\n---\n\n'),
      combinedInput: `【Mirror Stage 输入】\n${mirrorInputFull}\n\n---\n\n【分阶段加固输入汇总】\n${hardInputFull}`,
      mirrorUsage: m1.usage,
      mirrorModel: m1.model,
      mirrorDurationMs: m1.durationMs,
      hardeningUsage: usageAgg,
      hardeningModel,
      hardeningDurationMs,
      finalValueStream: working,
      finalLogicText: hardLogic,
      mirrorLogicText: mirrorLogic,
    };
  }

  /**
   * 默认入口：重做时直接跑 Mirror；否则仅补发 Mirror 阶段引导块（若尚未存在）
   */
  async function runValueStreamGeneration(options) {
    const opt = options || {};
    if (opt.redoMirror) {
      await runValueStreamPhaseMirror({ fromSessionPlan: true, chatOpts: opt.chatOpts });
      return;
    }
    const msgs = getProblemDetailChatMessagesArray();
    const hasPlan = msgs.some((m) => m.type === 'valueStreamDrawSessionsBlock');
    if (!hasPlan) {
      const item =
        typeof global.getCurrentProblemDetailItem === 'function'
          ? global.getCurrentProblemDetailItem()
          : global.currentProblemDetailItem;
      const sessions =
        typeof global.getDefaultValueStreamDrawSessions === 'function'
          ? global.getDefaultValueStreamDrawSessions()
          : [
              { stepName: '忠实还原 (The Mirror Stage)', done: false },
              { stepName: '架构加固 (The Hardening Stage)', done: false },
              { stepName: '合成最终价值流', done: false },
            ];
      const pk = persistKeyForItem(item);
      if (pk && typeof global.updateDigitalProblemValueStreamDrawSessions === 'function') {
        global.updateDigitalProblemValueStreamDrawSessions(pk, sessions);
      }
      patchCurrentProblemDetailItem({ valueStreamDrawSessions: sessions });
      global.pushAndSaveProblemDetailChat?.({
        type: 'valueStreamDrawSessionsBlock',
        taskId: 'task4',
        timestamp: global.getTimeStr(),
      });
    }
    refreshProblemDetailChatFromStorage();
    global.renderProblemDetailHistory?.();
  }

  global.parseValueStreamLlmContent = parseValueStreamLlmContent;
  global.normalizeTask4LlmToWorkspace = normalizeTask4LlmToWorkspace;
  global.generateValueStreamFromInputs = function (enterpriseInfo, bmcData, requirementLogic, stage, options) {
    if (stage === 'mirror' || stage === 'per_stage_hardening') {
      return generateValueStreamFromInputs(enterpriseInfo, bmcData, requirementLogic, stage, options);
    }
    return generateValueStreamFromInputs(enterpriseInfo, bmcData, requirementLogic, 'mirror', null);
  };
  global.valueStreamDrawSessionsHasUnfinished = valueStreamDrawSessionsHasUnfinished;
  global.runValueStreamPhaseMirror = runValueStreamPhaseMirror;
  global.runValueStreamPhaseHardening = runValueStreamPhaseHardening;
  global.runValueStreamPhaseSynthesis = runValueStreamPhaseSynthesis;
  global.runValueStreamDrawSessionsAutoSequential = runValueStreamDrawSessionsAutoSequential;
  global.runTask4ModificationTwoPhaseRegenerate = runTask4ModificationTwoPhaseRegenerate;
  global.runValueStreamGeneration = runValueStreamGeneration;
})(typeof window !== 'undefined' ? window : this);
