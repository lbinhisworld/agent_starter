/**
 * [INPUT]: `main.js` 在加载末尾 `init(deps)` 注入 getAppState、el、parseValueStreamGraph、parseStrictJsonObjectFromLlmText、AI/渲染/落库回调
 * [OUTPUT]: task7 端到端事务流分阶段 LLM、Session 合并、工作区 JSON 解析与业务流程完整性补齐（补齐结果 merge 入主 `e2eTransactionFlowJson` 并打标 `e2e_gap_supplement`）；BPM 步对 **决策/执行** 输出 `core_object_state_changes`（核心对象状态变更，与 `valueStream.js` 工作区/预览子卡一致）；落库经 **`mergeDigitalProblemPatch`（persistKey）** 与分阶段合并一致，保证在线 `PUT` 写入 `e2eTransactionFlowJson`；`pickRaw` 与 bundle 合并 **择优** item/聊天块；补齐后 **upsert** `e2eFlowJsonBlock`；`resolve` 在无打标时从 **`resolveEffectiveRequirementScenarioSupplementJson`（item + 聊天 `e2ePrelimFvsCompletenessSessionsBlock` 重建择优）** 重 merge；独立「需求场景事务流补齐」卡同源；`__FE_E2E_WORKSPACE_DEBUG` + `buildE2eWorkspaceDebugSnapshot`；`globalThis.SmartCto.task7E2eTransactionFlow`；`globalThis.pickRawE2eTransactionFlowJsonFromItemAndMessages`（供 `itDesignSupplement.js`）
 * [POS]: 从 `main.js` 迁出以降低主包体积；行为与 message `type`/payload 与迁出前一致
 *
 * [PROTOCOL]: 变更 task7 事务流/补齐协议时须同步 `frontend/js/AGENTS.md` 与 problem-detail-runtime 注入约定
 */

/** @type {Record<string, unknown> | null} */
let _host = null;

function requireHost() {
  if (!_host) throw new Error('[task7-e2e-transaction-flow] init() 须由 main.js 在编排调用前执行');
  return _host;
}

function as() {
  return requireHost().getAppState();
}

/** 避免与 main.js 全局 `const el` 同名冲突（本文件为经典 script，非 module） */
function hostEl() {
  return requireHost().el;
}

/** 控制台：设 `globalThis.__FE_E2E_WORKSPACE_DEBUG = true` 后输出端到端工作区解析/落库诊断 */
function logE2eWorkspaceDebug(tag, payload) {
  if (typeof globalThis === 'undefined' || globalThis.__FE_E2E_WORKSPACE_DEBUG !== true) return;
  try {
    console.log('[FE:task7-e2e-workspace]', tag, payload);
  } catch (_) {}
}

/** 与 `mergeDigitalProblemPatch` / HTTP 适配器一致：优先 `createdAt`，否则 `id` */
function persistKeyForItem(item) {
  try {
    const h0 = requireHost();
    if (typeof h0.getDigitalProblemPersistKey === 'function') {
      return String(h0.getDigitalProblemPersistKey(item) || '').trim();
    }
  } catch (_) {}
  return String(item?.createdAt != null ? item.createdAt : item?.id != null ? item.id : '').trim();
}

/** 聊天持久化键（在线案常需与 persistKey 一致） */
function chatCaseKeyForItem(item) {
  try {
    const h0 = requireHost();
    if (typeof h0.getProblemDetailChatStorageKey === 'function') {
      const ck = String(h0.getProblemDetailChatStorageKey(item) || '').trim();
      if (ck) return ck;
    }
  } catch (_) {}
  return persistKeyForItem(item);
}

/**
 * task7 端到端工作区：与 getTaskStatusText(task7) 一致，未在聊天区确认「开始任务」前不绘制事务流 view/json；
 * 若聊天记录或案例中已能恢复 BPM 合并结果（含分阶段 Session 合并），则不再隐藏，避免刷新后空态。
 */
function shouldHideE2eFlowWorkspaceUntilTaskStart(item, messages) {
  const h0 = requireHost();
  if (!item || h0.isTaskCompleted(item, 'task7')) return false;
  if (pickRawE2eTransactionFlowJsonFromItemAndMessages(item, messages)) return false;
  const msgs = Array.isArray(messages) ? messages : [];
  const startMsgs = msgs.filter((m) => m && m.type === 'taskStartNotification' && String(m.taskId) === 'task7');
  if (startMsgs.length === 0) return true;
  return !startMsgs.some((m) => m.confirmed);
}

/**
 * 将 `stages[].stage_name` 与聊天区 Session 计划中的 `stageName` 对齐（价值流阶段名为准，覆盖模型返回的 stage_name）。
 * @param {Object} txFlow
 * @param {Array} messages
 * @returns {Object}
 */
function overlayE2eTransactionFlowStageNamesFromSessions(txFlow, messages) {
  if (!txFlow || typeof txFlow !== 'object') return txFlow;
  const stages = txFlow.stages;
  if (!Array.isArray(stages) || stages.length === 0) return txFlow;
  const sessions = getE2eTransactionFlowSessionsFromMessages(messages);
  if (!sessions.length) return txFlow;
  let j = 0;
  const mapped = stages.map((st) => ({ ...st }));
  for (const s of sessions) {
    if (!s?.transactionNodesJson || typeof s.transactionNodesJson !== 'object') continue;
    if (j >= mapped.length) break;
    const canonical = String(s.stageName || '').trim();
    if (canonical) mapped[j] = { ...mapped[j], stage_name: canonical };
    j += 1;
  }
  return { ...txFlow, stages: mapped };
}

/**
 * task7 业务流 LLM：从价值流解析结果提取精简节点列表（剔除 itStatus/itPlan/painPoint/desc 等，仅保留建模所需字段）。
 * @param {Object} valueStream
 * @returns {Array<{node_id: string, node_name: string, actor: string, main_object: string, logic_meta: {constraints: string, details: string}}>}
 */
function buildE2eSimplifiedVsmNodesForBpmPrompt(valueStream) {
  const parseVs = requireHost().parseValueStreamGraph;
  if (!valueStream || valueStream.raw) return [];
  const { stages } = parseVs(valueStream);
  const out = [];
  stages.forEach((stage, si) => {
    (stage.steps || []).forEach((step, ji) => {
      const nid =
        (step.canonicalNodeId != null && String(step.canonicalNodeId).trim()) ||
        (step.vsmL2 && step.vsmL2.node_id != null && String(step.vsmL2.node_id).trim()) ||
        `N.${si + 1}.${ji + 1}`;
      const nodeName = String(step.name || '').trim() || `环节${ji + 1}`;
      const actor = String(step.role || '').trim();
      let main_object = '';
      let constraints = '';
      let details = '';
      if (step.vsmL2 && typeof step.vsmL2 === 'object') {
        if (step.vsmL2.main_object != null) main_object = String(step.vsmL2.main_object).trim();
        const lm = step.vsmL2.logic_meta && typeof step.vsmL2.logic_meta === 'object' ? step.vsmL2.logic_meta : {};
        if (lm.constraints != null) constraints = String(lm.constraints).trim();
        if (lm.details != null) details = String(lm.details).trim();
      }
      if (!main_object && step.main_object != null) main_object = String(step.main_object).trim();
      const lmTop = step.logic_meta && typeof step.logic_meta === 'object' ? step.logic_meta : {};
      if (!constraints && lmTop.constraints != null) constraints = String(lmTop.constraints).trim();
      if (!details && lmTop.details != null) details = String(lmTop.details).trim();
      out.push({
        node_id: nid,
        node_name: nodeName,
        actor,
        main_object,
        logic_meta: { constraints, details },
      });
    });
  });
  return out;
}

/**
 * 仅某一价值流阶段的精简 VSM 节点（供 task7 分阶段事务流 LLM）。
 */
function buildE2eSimplifiedVsmNodesForSingleStage(valueStream, stageIndex) {
  const parseVs = requireHost().parseValueStreamGraph;
  if (!valueStream || valueStream.raw || stageIndex == null || stageIndex < 0) return [];
  const { stages } = parseVs(valueStream);
  const stage = stages[stageIndex];
  if (!stage || !Array.isArray(stage.steps)) return [];
  const si = stageIndex;
  const out = [];
  (stage.steps || []).forEach((step, ji) => {
    const nid =
      (step.canonicalNodeId != null && String(step.canonicalNodeId).trim()) ||
      (step.vsmL2 && step.vsmL2.node_id != null && String(step.vsmL2.node_id).trim()) ||
      `N.${si + 1}.${ji + 1}`;
    const nodeName = String(step.name || '').trim() || `环节${ji + 1}`;
    const actor = String(step.role || '').trim();
    let main_object = '';
    let constraints = '';
    let details = '';
    if (step.vsmL2 && typeof step.vsmL2 === 'object') {
      if (step.vsmL2.main_object != null) main_object = String(step.vsmL2.main_object).trim();
      const lm = step.vsmL2.logic_meta && typeof step.vsmL2.logic_meta === 'object' ? step.vsmL2.logic_meta : {};
      if (lm.constraints != null) constraints = String(lm.constraints).trim();
      if (lm.details != null) details = String(lm.details).trim();
    }
    if (!main_object && step.main_object != null) main_object = String(step.main_object).trim();
    const lmTop = step.logic_meta && typeof step.logic_meta === 'object' ? step.logic_meta : {};
    if (!constraints && lmTop.constraints != null) constraints = String(lmTop.constraints).trim();
    if (!details && lmTop.details != null) details = String(lmTop.details).trim();
    out.push({
      node_id: nid,
      node_name: nodeName,
      actor,
      main_object,
      logic_meta: { constraints, details },
    });
  });
  return out;
}

/** task7 分阶段事务流 LLM：系统提示词（T_01 事务编号、bpm.T01.001 式 BPM ID、flow 内 vsm_node_ref 溯源）。 */
function buildE2ePerStageTransactionFlowSystemPrompt() {
  return `# Role: 资深系统架构师 / BPMN 2.0 专家
# Task: 针对价值流【特定阶段】的事务重组与细颗粒度 BPM 指令设计

## 1. 任务背景
我正在按阶段拆解业务流程。请审阅我提供的【阶段 VSM 数据】，将其重组为高内聚的“事务节点”。
**核心目标**：将业务里程碑拆解为“系统原子指令”。

## 2. 节点编号与分类规则 (Strict Naming)
### A. 编号规则：
- **事务节点编号**：沿用 T_01, T_02...
- **BPM 节点 ID**：格式为 \`bpm.[事务编号].[三位流水号]\`。
  * 例如：事务 T_01 下的第一个 BPM 节点为 \`bpm.T01.001\`，第二个为 \`bpm.T01.002\`。

### B. 节点类型分类：
- **[输入]**: 定义表单提交的时机、角色及核心字段约束。
- **[核验]**: 系统自动执行的逻辑比对（如：查重、资质、状态、唯一性校验）。
- **[决策]**: 基于核验结果的分支路径（If-Then 逻辑，通过则继续，失败则阻断）。
- **[执行]**: 具体的数据库动作（如：物理字段变更 Status: 0->1、资源锁定 Lock_Flag: True）。
- **[留痕]**: 自动抓取业务全量数据的 JSON 快照并写入审计流水。

## 3. 严格输出 Schema (JSON)
{
  "stage_name": "当前处理的阶段名称",
  "transaction_nodes": [
    {
      "transaction_id": "T_01",
      "name": "事务名称 (中文)",
      "vsm_origin_refs": ["关联的 VSM 节点编号，如 N.1.1"],
      "actor": "主责角色 (中文)",
      "bpm_detailed_flow": [
        {
          "bpm_node_id": "bpm.T01.001",
          "vsm_node_ref": "N.1.1",
          "type": "节点类型 (必须从以下选择：输入/核验/决策/执行/留痕)",
          "desc": "环节描述 (中文)",
          "logic": "详细的判定算法或数据操作逻辑 (中文)",
          "field_memo": "涉及的物理字段或操作备注 (中文)",
          "core_object_state_changes": ["核心业务对象｜状态 A → 状态 B", "另一对象｜状态 X → 状态 Y"]
        }
      ],
      "data_entity_impact": {
        "target_object": "核心业务对象 (中文)",
        "field_changes": "物理字段的具体变更值 (如 Status: 0->1)"
      }
    }
  ]
}

## 4. 处理要求
- **溯源性**：每个 BPM 节点必须保留 \`vsm_node_ref\`，指向原始 VSM 编号，以确保业务可追溯。
- **数据压缩**：请忽略输入数据中的 itStatus, itPlan, painPoint, desc 等冗余字段，仅关注 \`logic_meta\`。
- **深度穿透**：逻辑描述必须达到可直接配置【后端脚本】或【自动化规则】的深度。
- **核心对象状态变更（\`core_object_state_changes\`）**：当 \`type\` 为 **决策** 或 **执行** 时必填；为 **字符串数组**，每一项格式为「**\`对象名称｜状态 A → 状态 B\`**」（全角竖线 \`｜\`、Unicode 箭头 \`→\`；状态为简短中文）。多对象则多条。**输入 / 核验 / 留痕** 节点请将本字段设为 \`null\` 或省略。

---
## 5. 本次输入数据 (仅限当前阶段)
用户消息中以「## 5. 本次输入数据 (仅限当前阶段)」为标题，其下一空行之后为【当前阶段的 VSM JSON 数组】。`;
}

function generateE2eTransactionFlowSessionsFromValueStream(valueStream) {
  const parseVs = requireHost().parseValueStreamGraph;
  if (!valueStream || valueStream.raw) return [];
  const { stages } = parseVs(valueStream);
  return stages.map((stage, si) => {
    const rawName = stage?.name != null ? String(stage.name).trim() : '';
    const stageName =
      typeof globalThis.extractPureStageName === 'function'
        ? globalThis.extractPureStageName(rawName) || rawName || `阶段${si + 1}`
        : rawName || `阶段${si + 1}`;
    return {
      stageIndex: si,
      stageName,
      transactionNodesJson: null,
    };
  });
}

function getE2eTransactionFlowSessionsFromMessages(messages) {
  const msgs = Array.isArray(messages) ? messages : [];
  const block = msgs.find((m) => m?.type === 'e2eTransactionFlowSessionsBlock');
  return Array.isArray(block?.sessions) ? block.sessions : [];
}

function patchE2eTransactionFlowSessionsBlockInChat(createdAt, newSessions) {
  const msgs = as().problemDetailChatMessages;
  const idx = msgs.findIndex((m) => m?.type === 'e2eTransactionFlowSessionsBlock');
  if (idx < 0) return false;
  msgs[idx] = { ...msgs[idx], sessions: newSessions };
  requireHost().saveProblemDetailChat(createdAt, msgs);
  return true;
}

function buildMergedE2eBpmTransactionFlowFromSessions(sessions) {
  const stages = [];
  const flat = [];
  for (const s of sessions || []) {
    const chunk = s?.transactionNodesJson;
    if (!chunk || typeof chunk !== 'object') continue;
    const sn =
      String(s.stageName || chunk.stage_name || '').trim() || `阶段${(s.stageIndex ?? 0) + 1}`;
    const tnodes = Array.isArray(chunk.transaction_nodes) ? chunk.transaction_nodes : [];
    stages.push({ stage_name: sn, transaction_nodes: tnodes });
    for (const tx of tnodes) flat.push(tx);
  }
  return { bpm_schema_version: 2, stages, transaction_nodes: flat };
}

/**
 * 从案例字段与聊天记录恢复 BPM 合并 JSON：item.e2eTransactionFlowJson → 最近 e2eFlowJsonBlock → Session 计划逐阶段合并。
 * 不含阶段标题 overlay（供 resolve / 内存回填 / 是否隐藏工作区判定共用）。
 * @param {Object|null} item
 * @param {Array} messages
 * @returns {Object|null}
 */
function pickRawE2eTransactionFlowJsonFromItemAndMessages(item, messages) {
  const msgs = Array.isArray(messages) ? messages : [];
  const fromItem =
    item?.e2eTransactionFlowJson != null && typeof item.e2eTransactionFlowJson === 'object'
      ? item.e2eTransactionFlowJson
      : null;
  let fromBlock = null;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (isTask7BpmE2eFlowJsonBlock(m) && m.transactionFlowJson != null && typeof m.transactionFlowJson === 'object') {
      fromBlock = m.transactionFlowJson;
      break;
    }
  }
  let primary = pickRicherE2eTransactionFlowJson(fromItem, fromBlock);
  const merged = buildMergedE2eBpmTransactionFlowFromSessions(getE2eTransactionFlowSessionsFromMessages(msgs));
  const has =
    (Array.isArray(merged.stages) && merged.stages.length > 0) ||
    (Array.isArray(merged.transaction_nodes) && merged.transaction_nodes.length > 0);
  const fromSessions = has ? merged : null;
  if (fromSessions) {
    primary = pickRicherE2eTransactionFlowJson(primary, fromSessions);
  }
  logE2eWorkspaceDebug('pickRaw:result', {
    fromItemGap: fromItem ? countE2eGapTaggedStepsInFlow(fromItem) : 0,
    fromBlockGap: fromBlock ? countE2eGapTaggedStepsInFlow(fromBlock) : 0,
    sessionMergeGap: fromSessions ? countE2eGapTaggedStepsInFlow(fromSessions) : 0,
    chosenGap: primary ? countE2eGapTaggedStepsInFlow(primary) : 0,
    stagesLen: primary?.stages?.length ?? 0,
    flatTxLen: primary?.transaction_nodes?.length ?? 0,
    msgLen: msgs.length,
  });
  return primary;
}

/**
 * 工作区与压缩：`pickRawE2eTransactionFlowJsonFromItemAndMessages` + Session 阶段名 overlay。
 * @param {Object|null} item
 * @param {Array} messages
 * @returns {Object|null}
 */
function resolveE2eTransactionFlowJsonForWorkspace(item, messages) {
  const base = pickRawE2eTransactionFlowJsonFromItemAndMessages(item, messages);
  if (!base) return null;
  const msgs = Array.isArray(messages) ? messages : [];
  let flow = overlayE2eTransactionFlowStageNamesFromSessions(base, msgs);
  const sup = resolveEffectiveRequirementScenarioSupplementJson(item, msgs);
  const beforeGap = countE2eGapTaggedStepsInFlow(flow);
  const supBpm = sup && typeof sup === 'object' ? countTotalBpmStepsInSupplementAgg(sup) : 0;
  const supTx = sup && typeof sup === 'object' ? countSupplementTransactionNodesInAgg(sup) : 0;
  let didRemergeFromSupplement = false;
  if (sup && typeof sup === 'object' && beforeGap === 0 && (supBpm > 0 || supTx > 0)) {
    const remerged = mergeAllSupplementStagesIntoMainForDisplay(flow, sup);
    if (remerged && typeof remerged === 'object') {
      flow = overlayE2eTransactionFlowStageNamesFromSessions(remerged, msgs);
      didRemergeFromSupplement = true;
    }
  }
  const gapSess = getE2ePrelimFvsCompletenessSessionsFromMessages(msgs);
  const completenessSessionsWithTx = gapSess.filter(
    (s) => s?.transactionNodesJson != null && typeof s.transactionNodesJson === 'object',
  ).length;
  logE2eWorkspaceDebug('resolve:for-workspace', {
    pickRawGap: base ? countE2eGapTaggedStepsInFlow(base) : 0,
    afterOverlayGap: beforeGap,
    didRemergeFromSupplement,
    resolvedGap: countE2eGapTaggedStepsInFlow(flow),
    supplementBpmSteps: supBpm,
    supplementTxCount: supTx,
    completenessSessionsWithTx,
    itemHadSupplementField: item?.e2eRequirementScenarioSupplementJson != null,
    stagesLen: flow?.stages?.length ?? 0,
    flatTxLen: flow?.transaction_nodes?.length ?? 0,
  });
  return flow;
}

/**
 * 刷新/重入后 `item.e2eTransactionFlowJson` 缺失时，从聊天合并结果回填内存（与 preliminary 聊天回填策略一致）。
 * @param {Object|null} item
 * @param {Array} messages
 * @param {string} [_sourceTag]
 * @returns {Object|null}
 */
function applyE2eTransactionFlowHydrationFromMessages(item, messages, _sourceTag) {
  if (!item || typeof item !== 'object') return item;
  const raw = pickRawE2eTransactionFlowJsonFromItemAndMessages(item, messages);
  if (!raw) return item;
  const prev = item.e2eTransactionFlowJson;
  if (prev != null && typeof prev === 'object') {
    const best = pickRicherE2eTransactionFlowJson(prev, raw);
    if (best !== prev) return { ...item, e2eTransactionFlowJson: best };
    return item;
  }
  return { ...item, e2eTransactionFlowJson: raw };
}

/** 业务事务流 BPM 确认卡：含 `taskId==='task7'` 或已带 `transactionFlowJson`（旧聊天可能缺 taskId） */
function isTask7BpmE2eFlowJsonBlock(m) {
  if (m?.type !== 'e2eFlowJsonBlock') return false;
  if (m.taskId === 'task7') return true;
  return m.transactionFlowJson != null && typeof m.transactionFlowJson === 'object';
}

function upsertE2eFlowJsonBlockInChatMessages(createdAt, merged, valueStream) {
  const msgs = as().problemDetailChatMessages;
  let idx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (isTask7BpmE2eFlowJsonBlock(msgs[i])) {
      idx = i;
      break;
    }
  }
  const h0 = requireHost();
  const ts = idx >= 0 && msgs[idx]?.timestamp ? msgs[idx].timestamp : h0.getTimeStr();
  const row = {
    type: 'e2eFlowJsonBlock',
    taskId: 'task7',
    transactionFlowJson: merged,
    valueStreamJson: valueStream,
    timestamp: ts,
    confirmed: false,
  };
  if (idx >= 0) msgs[idx] = { ...msgs[idx], ...row };
  else msgs.push({ ...row, timestamp: h0.getTimeStr() });
  h0.saveProblemDetailChat(createdAt, msgs);
}

/** 分阶段事务流未完成时移除聊天区 BPM 型 e2eFlowJsonBlock，避免用不完整合并结果误点「确认」。 */
function removeTask7BpmE2eFlowJsonBlockFromChat(createdAt) {
  const msgs = as().problemDetailChatMessages;
  const h0 = requireHost();
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (
      isTask7BpmE2eFlowJsonBlock(m) &&
      m?.transactionFlowJson != null &&
      typeof m.transactionFlowJson === 'object'
    ) {
      msgs.splice(i, 1);
      h0.saveProblemDetailChat(createdAt, msgs);
      return;
    }
  }
}

/** task7：初步需求 operationModel.fullValueStreams 按 domain 分组（与「业务流程」Tab 类目一致）。 */
function groupTask7PrelimFvsDomainsFromItem(item) {
  const preliminary =
    typeof globalThis.buildResolvedPreliminaryRequirement === 'function'
      ? globalThis.buildResolvedPreliminaryRequirement(item)
      : null;
  const om = preliminary && typeof preliminary.operationModel === 'object' ? preliminary.operationModel : null;
  const arr = om && Array.isArray(om.fullValueStreams) ? om.fullValueStreams : [];
  if (arr.length === 0) return [];
  const byDomain = new Map();
  arr.forEach((row) => {
    let domainKey = '未分类领域';
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const d = row.domain;
      if (d != null && String(d).trim() !== '' && String(d).trim() !== 'NOT_SPECIFIED') {
        domainKey = String(d).trim();
      }
    } else if (row != null) {
      domainKey = '其他';
    }
    if (!byDomain.has(domainKey)) byDomain.set(domainKey, []);
    byDomain.get(domainKey).push(row);
  });
  return Array.from(byDomain.entries()).map(([domainLabel, processes]) => ({ domainLabel, processes }));
}

/** task7：校验流程完整性 Session 计划行（含该类目下初步流程条目，供 LLM 输入）。 */
function generateE2ePrelimFvsCompletenessSessionsFromItem(item) {
  return groupTask7PrelimFvsDomainsFromItem(item).map(({ domainLabel, processes }, si) => ({
    stageIndex: si,
    stageName: domainLabel,
    domainLabel,
    prelimProcesses: processes,
    prelimProcessCount: processes.length,
    transactionNodesJson: null,
  }));
}

function getE2ePrelimFvsCompletenessSessionsFromMessages(messages) {
  const msgs = Array.isArray(messages) ? messages : [];
  let block = null;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.type === 'e2ePrelimFvsCompletenessSessionsBlock') {
      block = msgs[i];
      break;
    }
  }
  return Array.isArray(block?.sessions) ? block.sessions : [];
}

/**
 * @param {string} createdAt
 * @param {unknown[]} newSessions
 * @param {{ runningSessionIndex?: number | null }} [opts] 传入数字表示当前进行中的类目索引；null 或仅更新 sessions 时清除进行中状态
 */
function patchE2ePrelimFvsCompletenessSessionsBlockInChat(createdAt, newSessions, opts) {
  const msgs = as().problemDetailChatMessages;
  let idx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.type === 'e2ePrelimFvsCompletenessSessionsBlock') {
      idx = i;
      break;
    }
  }
  if (idx < 0) return false;
  const prev = msgs[idx];
  const next = { ...prev, sessions: newSessions };
  const o = opts || {};
  if (typeof o.runningSessionIndex === 'number') {
    next.runningSessionIndex = o.runningSessionIndex;
  } else if (o.runningSessionIndex === null || o.clearRunningSessionIndex === true) {
    delete next.runningSessionIndex;
  } else {
    delete next.runningSessionIndex;
  }
  msgs[idx] = next;
  requireHost().saveProblemDetailChat(createdAt, msgs);
  return true;
}

/** 将类目补齐 Session 合并为独立 BPM JSON；无事务时返回 null。 */
function buildE2eRequirementScenarioSupplementJsonFromGapSessions(sessions) {
  const merged = buildMergedE2eBpmTransactionFlowFromSessions(sessions);
  const stages = (merged.stages || []).filter(
    (st) => Array.isArray(st.transaction_nodes) && st.transaction_nodes.length > 0,
  );
  if (stages.length === 0) return null;
  const flat = [];
  for (const st of stages) {
    for (const tx of st.transaction_nodes) flat.push(tx);
  }
  return { bpm_schema_version: 2, stages, transaction_nodes: flat };
}

/** 为补齐写入主事务流的 BPM 步骤打标，供工作区「节点描述（补齐）」展示 */
const E2E_GAP_SUPPLEMENT_FLAG = 'e2e_gap_supplement';

/** 统计 BPM 中带 `e2e_gap_supplement` 的步骤数（优先 `stages[]`，否则扁平 `transaction_nodes`） */
function countE2eGapTaggedStepsInFlow(e2e) {
  if (!e2e || typeof e2e !== 'object') return 0;
  let n = 0;
  const visitTx = (tx) => {
    if (!tx || typeof tx !== 'object') return;
    const flow = Array.isArray(tx.bpm_detailed_flow) ? tx.bpm_detailed_flow : [];
    for (const s of flow) {
      if (s && typeof s === 'object' && s[E2E_GAP_SUPPLEMENT_FLAG] === true) n += 1;
    }
  };
  if (Array.isArray(e2e.stages) && e2e.stages.length > 0) {
    for (const st of e2e.stages) {
      for (const tx of st.transaction_nodes || []) visitTx(tx);
    }
    return n;
  }
  for (const tx of e2e.transaction_nodes || []) visitTx(tx);
  return n;
}

/** 需求场景补齐聚合 JSON 内全部 BPM 步骤条数（用于判断是否与主 JSON 不同步） */
function countTotalBpmStepsInSupplementAgg(sup) {
  if (!sup || typeof sup !== 'object') return 0;
  const norm = normalizeE2eStagesShapeForGapMerge(sup);
  let n = 0;
  for (const st of norm.stages || []) {
    for (const tx of st.transaction_nodes || []) {
      const flow = tx && Array.isArray(tx.bpm_detailed_flow) ? tx.bpm_detailed_flow : [];
      n += flow.length;
    }
  }
  return n;
}

/** 补齐聚合内事务节点条数（无 BPM 步骤的事务也可计数，用于触发重 merge） */
function countSupplementTransactionNodesInAgg(sup) {
  if (!sup || typeof sup !== 'object') return 0;
  const norm = normalizeE2eStagesShapeForGapMerge(sup);
  let n = 0;
  for (const st of norm.stages || []) {
    n += Array.isArray(st.transaction_nodes) ? st.transaction_nodes.length : 0;
  }
  return n;
}

/**
 * 需求场景补齐 BPM 聚合：优先 `item.e2eRequirementScenarioSupplementJson`；若空或弱于聊天 Session，则从
 * `e2ePrelimFvsCompletenessSessionsBlock.sessions` 重建（与 `buildE2eRequirementScenarioSupplementJsonFromGapSessions` 同源）。
 * 解决 bundle/列表覆盖导致 item 丢字段、但聊天仍保留各类目 `transactionNodesJson` 时工作区无法重 merge 的问题。
 * @param {object|null|undefined} item
 * @param {unknown[]} messages
 * @returns {object|null}
 */
function resolveEffectiveRequirementScenarioSupplementJson(item, messages) {
  const msgs = Array.isArray(messages) ? messages : [];
  let fromItem = item?.e2eRequirementScenarioSupplementJson;
  if (typeof fromItem === 'string' && fromItem.trim()) {
    try {
      fromItem = JSON.parse(fromItem);
    } catch (_) {
      fromItem = null;
    }
  }
  const itemOk = fromItem != null && typeof fromItem === 'object' && !Array.isArray(fromItem);
  const sessions = getE2ePrelimFvsCompletenessSessionsFromMessages(msgs);
  const rebuilt = buildE2eRequirementScenarioSupplementJsonFromGapSessions(sessions);

  if (!itemOk) return rebuilt || null;
  if (!rebuilt) return fromItem;

  const ib = countTotalBpmStepsInSupplementAgg(fromItem);
  const rb = countTotalBpmStepsInSupplementAgg(rebuilt);
  const itx = countSupplementTransactionNodesInAgg(fromItem);
  const rtx = countSupplementTransactionNodesInAgg(rebuilt);
  if (rb > ib || (rb === ib && rtx > itx)) return rebuilt;
  if (ib === 0 && itx === 0 && (rb > 0 || rtx > 0)) return rebuilt;
  return fromItem;
}

/** 主 JSON 中全部 BPM 步骤条数（tie-break） */
function countTotalBpmStepsInE2e(e2e) {
  if (!e2e || typeof e2e !== 'object') return 0;
  let n = 0;
  const visitTx = (tx) => {
    if (!tx || typeof tx !== 'object') return;
    const flow = Array.isArray(tx.bpm_detailed_flow) ? tx.bpm_detailed_flow : [];
    n += flow.length;
  };
  if (Array.isArray(e2e.stages) && e2e.stages.length > 0) {
    for (const st of e2e.stages) {
      for (const tx of st.transaction_nodes || []) visitTx(tx);
    }
    return n;
  }
  for (const tx of e2e.transaction_nodes || []) visitTx(tx);
  return n;
}

/**
 * bundle / 列表合并时择优保留「更完整」的事务流（含更多补齐打标步骤者优先，其次 BPM 步骤总数多者）。
 * @param {unknown} a
 * @param {unknown} b
 * @returns {unknown}
 */
function pickRicherE2eTransactionFlowJson(a, b) {
  if (!b || typeof b !== 'object') return a && typeof a === 'object' ? a : null;
  if (!a || typeof a !== 'object') return b;
  const ca = countE2eGapTaggedStepsInFlow(a);
  const cb = countE2eGapTaggedStepsInFlow(b);
  if (cb > ca) return b;
  if (ca > cb) return a;
  const ba = countTotalBpmStepsInE2e(a);
  const bb = countTotalBpmStepsInE2e(b);
  if (bb > ba) return b;
  if (ba > bb) return a;
  return a;
}

/**
 * 当主 JSON 已无补齐打标但 `e2eRequirementScenarioSupplementJson` 仍有内容时，将各阶段补齐块重新 merge 进副本（供工作区展示，避免切换子页/刷新后 item 被旧快照覆盖导致「补齐节点消失」）。
 * @param {unknown} baseFlow
 * @param {unknown} supplementJson
 * @returns {unknown}
 */
function mergeAllSupplementStagesIntoMainForDisplay(baseFlow, supplementJson) {
  if (!supplementJson || typeof supplementJson !== 'object') return baseFlow;
  const sup = normalizeE2eStagesShapeForGapMerge(supplementJson);
  const stages = Array.isArray(sup.stages) ? sup.stages : [];
  if (stages.length === 0) return baseFlow;
  let acc =
    baseFlow && typeof baseFlow === 'object'
      ? JSON.parse(JSON.stringify(baseFlow))
      : { bpm_schema_version: 2, stages: [], transaction_nodes: [] };
  for (const st of stages) {
    const domain = String(st.stage_name || '').trim() || '业务流程补齐';
    const chunk = {
      stage_name: st.stage_name,
      transaction_nodes: Array.isArray(st.transaction_nodes) ? st.transaction_nodes : [],
    };
    if (chunk.transaction_nodes.length === 0) continue;
    const next = mergePrelimGapChunkIntoMainE2e(acc, chunk, domain);
    if (next) acc = next;
  }
  return acc;
}

/**
 * @param {Record<string, unknown>} tx
 * @returns {Record<string, unknown>}
 */
function cloneTxWithGapTaggedBpmSteps(tx) {
  if (!tx || typeof tx !== 'object') return tx;
  const flow = Array.isArray(tx.bpm_detailed_flow) ? tx.bpm_detailed_flow : [];
  const taggedFlow = flow.map((step) =>
    step && typeof step === 'object' ? { ...step, [E2E_GAP_SUPPLEMENT_FLAG]: true } : step,
  );
  return { ...tx, bpm_detailed_flow: taggedFlow };
}

/**
 * 扁平 transaction_nodes 或缺 stages 时归一为 stages[]，便于按价值流阶段合并。
 * @param {unknown} e2e
 * @returns {{ bpm_schema_version?: number, stages: Array<{ stage_name?: string, transaction_nodes: unknown[] }>, transaction_nodes?: unknown[] }}
 */
function normalizeE2eStagesShapeForGapMerge(e2e) {
  if (!e2e || typeof e2e !== 'object') {
    return { bpm_schema_version: 2, stages: [], transaction_nodes: [] };
  }
  const copy = JSON.parse(JSON.stringify(e2e));
  if (Array.isArray(copy.stages) && copy.stages.length > 0) {
    return copy;
  }
  const flat = Array.isArray(copy.transaction_nodes) ? copy.transaction_nodes : [];
  if (flat.length === 0) {
    return { ...copy, stages: [] };
  }
  return {
    ...copy,
    stages: [{ stage_name: '事务流', transaction_nodes: flat }],
  };
}

/**
 * 价值流阶段名与初步需求类目 / 模型 stage_name 的适配分（越大越匹配）。
 */
function scoreE2eStageForPrelimDomain(stageName, domainLabel, gapStageName) {
  const a = String(stageName || '')
    .trim()
    .toLowerCase();
  const b = String(domainLabel || '')
    .trim()
    .toLowerCase();
  const c = String(gapStageName || '')
    .trim()
    .toLowerCase();
  if (!a) return 0;
  let score = 0;
  if (b && (a === b || a.includes(b) || b.includes(a))) score += 80;
  if (c && c !== b && (a === c || a.includes(c) || c.includes(a))) score += 80;
  const tokenize = (s) =>
    String(s)
      .toLowerCase()
      .split(/[\s·\-—|，,、./]+/)
      .filter((t) => t.length > 1);
  const ta = new Set(tokenize(a));
  for (const t of tokenize(`${b} ${c}`)) {
    if (ta.has(t)) score += 6;
  }
  return score;
}

/**
 * 补齐事务与已有事务的语义接近度（用于合并 bpm_detailed_flow）。
 */
function scoreGapTransactionAgainstExisting(gapTx, existingTx) {
  if (!gapTx || !existingTx) return 0;
  const gn = String(gapTx.name ?? gapTx.transaction_name ?? '').trim();
  const en = String(existingTx.name ?? existingTx.transaction_name ?? '').trim();
  const ga = String(gapTx.actor ?? '').trim();
  const ea = String(existingTx.actor ?? '').trim();
  let s = 0;
  if (gn && en && (gn === en || gn.includes(en) || en.includes(gn))) s += 45;
  if (ga && ea && (ga === ea || ga.includes(ea) || ea.includes(ga))) s += 25;
  const grefs = Array.isArray(gapTx.vsm_origin_refs) ? gapTx.vsm_origin_refs : [];
  const erefs = Array.isArray(existingTx.vsm_origin_refs) ? existingTx.vsm_origin_refs : [];
  for (const g of grefs) {
    const gs = String(g);
    for (const e of erefs) {
      if (gs && gs === String(e)) s += 18;
    }
  }
  return s;
}

/**
 * 将当前类目补齐块合并进主端到端事务流：先选最适配的价值流阶段 A，再视情况并入已有事务的 BPM 或在 A 下新建事务。
 * @param {unknown} baseE2e pickRaw / 当前主 JSON
 * @param {{ stage_name?: string, transaction_nodes?: unknown[] }} gapChunk 本轮 LLM 归一结果
 * @param {string} domainLabel Session 类目名（初步需求业务流程 domain）
 * @returns {Object|null} 新主 JSON；无补齐节点时返回 null（调用方跳过落库）
 */
function mergePrelimGapChunkIntoMainE2e(baseE2e, gapChunk, domainLabel) {
  const gapNodes = Array.isArray(gapChunk?.transaction_nodes) ? gapChunk.transaction_nodes : [];
  if (gapNodes.length === 0) return null;

  const gapStageName = String(gapChunk?.stage_name || domainLabel || '').trim();
  const normalized = normalizeE2eStagesShapeForGapMerge(baseE2e);
  let stages = Array.isArray(normalized.stages)
    ? normalized.stages.map((st) => ({
        ...st,
        stage_name: st?.stage_name,
        transaction_nodes: Array.isArray(st?.transaction_nodes)
          ? st.transaction_nodes.map((t) =>
              t && typeof t === 'object'
                ? {
                    ...t,
                    bpm_detailed_flow: Array.isArray(t.bpm_detailed_flow)
                      ? t.bpm_detailed_flow.map((s) => (s && typeof s === 'object' ? { ...s } : s))
                      : [],
                  }
                : t,
            )
          : [],
      }))
    : [];

  if (stages.length === 0) {
    stages = [{ stage_name: domainLabel || gapStageName || '业务流程补齐', transaction_nodes: [] }];
  }

  let bestStageIdx = 0;
  let bestStageScore = -1;
  for (let i = 0; i < stages.length; i++) {
    const sc = scoreE2eStageForPrelimDomain(stages[i].stage_name, domainLabel, gapStageName);
    if (sc > bestStageScore) {
      bestStageScore = sc;
      bestStageIdx = i;
    }
  }

  const targetStage = stages[bestStageIdx];
  if (!Array.isArray(targetStage.transaction_nodes)) targetStage.transaction_nodes = [];

  const MERGE_TX_THRESHOLD = 28;

  for (const gapTx of gapNodes) {
    if (!gapTx || typeof gapTx !== 'object') continue;
    const tagged = cloneTxWithGapTaggedBpmSteps(gapTx);
    const newSteps = Array.isArray(tagged.bpm_detailed_flow) ? tagged.bpm_detailed_flow : [];
    if (newSteps.length === 0) {
      targetStage.transaction_nodes.push(tagged);
      continue;
    }

    let bestTxi = -1;
    let bestTs = -1;
    for (let j = 0; j < targetStage.transaction_nodes.length; j++) {
      const sc = scoreGapTransactionAgainstExisting(gapTx, targetStage.transaction_nodes[j]);
      if (sc > bestTs) {
        bestTs = sc;
        bestTxi = j;
      }
    }

    if (bestTxi >= 0 && bestTs >= MERGE_TX_THRESHOLD) {
      const existing = targetStage.transaction_nodes[bestTxi];
      const existingFlow = Array.isArray(existing.bpm_detailed_flow) ? existing.bpm_detailed_flow : [];
      targetStage.transaction_nodes[bestTxi] = {
        ...existing,
        bpm_detailed_flow: [...existingFlow, ...newSteps],
      };
    } else {
      targetStage.transaction_nodes.push(tagged);
    }
  }

  normalized.stages = stages;
  const flat = [];
  for (const st of stages) {
    const arr = Array.isArray(st.transaction_nodes) ? st.transaction_nodes : [];
    for (const tx of arr) flat.push(tx);
  }
  normalized.transaction_nodes = flat;
  if (normalized.bpm_schema_version == null) normalized.bpm_schema_version = 2;
  return normalized;
}

/** task7：按类目比对价值流事务与初步需求业务流程，仅为缺失项输出 transaction_nodes（schema 同分阶段事务流）。 */
function buildE2ePrelimFvsCompletenessSystemPrompt() {
  return `# Role: 资深系统架构师 / BPMN 2.0 专家
# Task: 校验「初步需求·业务流程」某一类目下的客户流程是否已在当前端到端事务流中得到体现；仅为**尚未体现**的流程设计事务节点

## 1. 输入说明
用户消息包含：
- **类目名称**与该类目下**全部**初步需求流程条目（JSON）；
- **当前已生成的端到端事务流**合并结果（JSON，含多阶段 transaction_nodes）。

## 2. 比对原则
- 若某条初步流程（以 processName / 流程名称 / 环节链 nodes 等综合判断）已被现有事务在名称、角色、环节语义上**充分覆盖**，则**不要**为其再输出事务节点。
- **仅输出**仍缺失或覆盖明显不足的流程对应的事务节点。
- 若该类目下所有流程均已覆盖，输出空的 transaction_nodes 数组。

## 3. 合并说明（由前端执行，勿在输出中重复）
- 系统会将本 JSON 的 \`transaction_nodes\` 合并进**主端到端事务流**：按价值流**阶段标题**与当前**类目名称**的匹配度选定阶段 A；若某事务与 A 下已有事务名称/角色/溯源足够接近，则将其 \`bpm_detailed_flow\` **追加**到该事务的 BPM 流程末尾，否则在 A 下**新增**一条事务。
- 合并进入的 BPM 步骤会由系统标记，工作区在「节点描述」处展示「（补齐）」。

## 4. 输出 Schema（仅 JSON，勿输出说明文字）
与价值流分阶段事务流一致；**决策 / 执行** 类 BPM 步须含 \`core_object_state_changes\`（字符串数组，每项「对象｜状态 A → 状态 B」）；其余类型可省略或 \`null\`。
{
  "stage_name": "与输入类目名称一致或为其简短概括",
  "transaction_nodes": [
    {
      "transaction_id": "T_xx（须与现有合并结果中已有编号不重复；可在最大编号基础上递增，或使用 T_GAP_01 等形式保证全局唯一）",
      "name": "事务名称 (中文)",
      "vsm_origin_refs": ["可用 PRELIM:流程名 等形式标明溯源"],
      "actor": "主责角色 (中文)",
      "bpm_detailed_flow": [
        {
          "bpm_node_id": "bpm.Txx.001",
          "vsm_node_ref": "PRELIM 或自拟",
          "type": "输入/核验/决策/执行/留痕 之一",
          "desc": "环节描述 (中文)",
          "logic": "判定或数据逻辑 (中文)",
          "field_memo": "字段或操作备注 (中文)",
          "core_object_state_changes": ["对象名称｜状态 A → 状态 B"]
        }
      ],
      "data_entity_impact": {
        "target_object": "核心业务对象 (中文)",
        "field_changes": "字段变更说明 (中文)"
      }
    }
  ]
}`;
}

/**
 * task7：执行下一类目「业务流程完整性」补齐（自动顺序调用）。
 */
async function runE2ePrelimFvsCompletenessForNextDomain(itemOverride) {
  const h0 = requireHost();
  const item = itemOverride || as().currentProblemDetailItem;
  const chatContainer = hostEl().problemDetailChatMessages;
  const pk = persistKeyForItem(item);
  const cKey = chatCaseKeyForItem(item);
  if (!pk) {
    logE2eWorkspaceDebug('prelim-completeness:abort-no-persist-key', {
      hasCreatedAt: item?.createdAt != null,
      hasId: item?.id != null,
    });
    return;
  }
  const sessions = getE2ePrelimFvsCompletenessSessionsFromMessages(as().problemDetailChatMessages);
  const nextIdx = sessions.findIndex((s) => s == null || s.transactionNodesJson == null);
  if (nextIdx < 0) return;
  const sess = sessions[nextIdx];
  const stageName = sess.stageName || sess.domainLabel || `类目${nextIdx + 1}`;
  const processes = Array.isArray(sess.prelimProcesses) ? sess.prelimProcesses : [];

  const appendCompletenessParsingRow = () => {
    if (!chatContainer) return;
    chatContainer.innerHTML = '';
    h0.renderProblemDetailChatFromStorage(chatContainer, as().problemDetailChatMessages);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    const parsingBlock = document.createElement('div');
    parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
    parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">${h0.escapeHtml('正在校验「' + stageName + '」类目的事务流覆盖与补齐…')}</span></div></div><div class="problem-detail-chat-msg-time">${h0.getTimeStr()}</div>`;
    chatContainer.appendChild(parsingBlock);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  };

  patchE2ePrelimFvsCompletenessSessionsBlockInChat(cKey, sessions, { runningSessionIndex: nextIdx });
  appendCompletenessParsingRow();

  if (!h0.hasAiConfig()) {
    patchE2ePrelimFvsCompletenessSessionsBlockInChat(cKey, sessions, { runningSessionIndex: null });
    h0.pushAndSaveProblemDetailChat({
      role: 'system',
      content: '业务流程完整性补齐需要先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）。',
      timestamp: h0.getTimeStr(),
    });
    if (chatContainer) {
      chatContainer.innerHTML = '';
      h0.renderProblemDetailChatFromStorage(chatContainer, as().problemDetailChatMessages);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    h0.renderProblemDetailHistory();
    return;
  }
  const currentE2e =
    typeof pickRawE2eTransactionFlowJsonFromItemAndMessages === 'function'
      ? pickRawE2eTransactionFlowJsonFromItemAndMessages(item, as().problemDetailChatMessages)
      : null;
  const systemPrompt = buildE2ePrelimFvsCompletenessSystemPrompt();
  let normalized;
  if (processes.length === 0) {
    await new Promise((r) => setTimeout(r, 120));
    normalized = { stage_name: stageName, transaction_nodes: [] };
  } else {
    const userPrompt = [
      '## 1. 当前类目（初步需求·业务流程）',
      stageName,
      '',
      '## 2. 该类目下全部流程条目（JSON）',
      JSON.stringify(processes, null, 2),
      '',
      '## 3. 当前已生成的端到端事务流合并结果（JSON）',
      JSON.stringify(currentE2e && typeof currentE2e === 'object' ? currentE2e : {}, null, 2),
      '',
      '## 4. 输出要求',
      '请严格按系统提示中的 Schema 仅输出 JSON 对象。',
    ].join('\n');
    const llmInputPrompt = ['【系统】', systemPrompt, '', '【用户】', userPrompt].join('\n');
    try {
      const { content, usage, model, durationMs } = await h0.fetchDeepSeekChat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { taskTag: 'task7' },
      );
      const raw = content != null ? String(content) : '';
      const parsed = h0.parseStrictJsonObjectFromLlmText(raw);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('模型返回无法解析为 JSON 对象');
      }
      const llmMeta = { usage, model, durationMs };
      h0.pushAndSaveProblemDetailChat({
        type: 'task7LlmQueryBlock',
        taskId: 'task7',
        noteName: '业务流程完整性补齐',
        stepName: stageName,
        stepIndex: nextIdx,
        llmInputPrompt,
        llmOutputRaw: raw,
        llmMeta,
        timestamp: h0.getTimeStr(),
        confirmed: false,
      });
      normalized = {
        stage_name: String(parsed.stage_name || stageName).trim() || stageName,
        transaction_nodes: Array.isArray(parsed.transaction_nodes) ? parsed.transaction_nodes : [],
      };
    } catch (err) {
      console.warn('[task7] 业务流程完整性补齐失败:', err);
      patchE2ePrelimFvsCompletenessSessionsBlockInChat(cKey, sessions, { runningSessionIndex: null });
      h0.pushAndSaveProblemDetailChat({
        role: 'system',
        content: '业务流程完整性补齐失败：' + String(err?.message || err),
        timestamp: h0.getTimeStr(),
      });
      if (chatContainer) {
        chatContainer.innerHTML = '';
        h0.renderProblemDetailChatFromStorage(chatContainer, as().problemDetailChatMessages);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
      h0.renderProblemDetailHistory();
      return;
    }
  }
  const newSessions = sessions.map((s, i) => (i === nextIdx ? { ...s, transactionNodesJson: normalized } : s));
  patchE2ePrelimFvsCompletenessSessionsBlockInChat(cKey, newSessions);
  // 将本轮补齐 BPM 合并进主端到端事务流（最适配价值流阶段 + 事务内 bpm_detailed_flow 或新建事务），并打标 e2e_gap_supplement
  const mergedMainE2e = mergePrelimGapChunkIntoMainE2e(currentE2e, normalized, stageName);
  const supplementJson = buildE2eRequirementScenarioSupplementJsonFromGapSessions(newSessions);
  const patchE2e = {};
  if (mergedMainE2e) patchE2e.e2eTransactionFlowJson = mergedMainE2e;
  if (supplementJson != null) patchE2e.e2eRequirementScenarioSupplementJson = supplementJson;
  if (Object.keys(patchE2e).length > 0 && typeof h0.mergeDigitalProblemPatch === 'function') {
    h0.mergeDigitalProblemPatch(pk, patchE2e);
  } else {
    if (mergedMainE2e && typeof h0.updateDigitalProblemE2eTransactionFlow === 'function') {
      h0.updateDigitalProblemE2eTransactionFlow(pk, mergedMainE2e);
    }
    if (typeof h0.updateDigitalProblemE2eRequirementScenarioSupplement === 'function') {
      h0.updateDigitalProblemE2eRequirementScenarioSupplement(pk, supplementJson);
    }
  }
  logE2eWorkspaceDebug('persist:after-gap-merge', {
    pkTail: String(pk).slice(-10),
    stageName,
    mergedGapSteps: mergedMainE2e ? countE2eGapTaggedStepsInFlow(mergedMainE2e) : 0,
    hasSupplementAgg: !!(supplementJson && typeof supplementJson === 'object'),
    usedMergeDigitalProblemPatch: Object.keys(patchE2e).length > 0 && typeof h0.mergeDigitalProblemPatch === 'function',
  });
  // 同步聊天区 BPM 确认卡内 JSON，避免 pickRaw 在 item 被旧快照覆盖时仍读到无补齐前的 `e2eFlowJsonBlock`
  if (mergedMainE2e) {
    const msgsNow = as().problemDetailChatMessages;
    const hasE2eBlock = Array.isArray(msgsNow) && msgsNow.some((m) => isTask7BpmE2eFlowJsonBlock(m));
    if (hasE2eBlock) {
      const vs =
        typeof h0.resolveValueStreamForItGap === 'function' ? h0.resolveValueStreamForItGap(item) : item?.valueStream ?? null;
      upsertE2eFlowJsonBlockInChatMessages(cKey, mergedMainE2e, vs);
    }
  }
  const listAfterSup = typeof h0.getDigitalProblems === 'function' ? h0.getDigitalProblems() : [];
  const freshItemSup = listAfterSup.find(
    (it) => String(it.createdAt || '') === String(item.createdAt || '') || String(it.id || '') === String(item.id || ''),
  );
  as().currentProblemDetailItem = freshItemSup
    ? { ...freshItemSup }
    : { ...item, e2eRequirementScenarioSupplementJson: supplementJson || undefined };
  h0.renderProblemDetailContent();
  h0.pushAndSaveProblemDetailChat({
    role: 'system',
    content: `已完成【${stageName}】的业务流程完整性校验与补齐。`,
    timestamp: h0.getTimeStr(),
  });
  const allGapDone = newSessions.every((s) => s != null && s.transactionNodesJson != null);
  if (allGapDone) {
    h0.pushAndSaveProblemDetailChat({
      type: 'e2ePrelimFvsCompletenessAllDoneConfirmBlock',
      taskId: 'task7',
      content: '所有端到端事务流补齐已完成。',
      timestamp: h0.getTimeStr(),
      confirmed: false,
    });
  }
  h0.renderProblemDetailContent();
  if (chatContainer) {
    chatContainer.innerHTML = '';
    h0.renderProblemDetailChatFromStorage(chatContainer, as().problemDetailChatMessages);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  h0.renderProblemDetailHistory();
}

/**
 * task7：执行下一阶段事务流生成（由 Session 计划「自动顺序执行」循环调用；每轮推进一个未完成阶段）。
 */
async function runE2eTransactionFlowForNextStage(valueStream, itemOverride) {
  const h0 = requireHost();
  const item = itemOverride || as().currentProblemDetailItem;
  const chatContainer = hostEl().problemDetailChatMessages;
  const pk = persistKeyForItem(item);
  const cKey = chatCaseKeyForItem(item);
  if (!pk || !valueStream || valueStream.raw) return;
  const sessions = getE2eTransactionFlowSessionsFromMessages(as().problemDetailChatMessages);
  const nextIdx = sessions.findIndex((s) => s == null || s.transactionNodesJson == null);
  if (nextIdx < 0) return;
  const sess = sessions[nextIdx];
  const stageName = sess.stageName || `阶段${nextIdx + 1}`;
  if (!h0.hasAiConfig()) {
    h0.pushAndSaveProblemDetailChat({
      role: 'system',
      content: '生成业务事务流需要先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）。',
      timestamp: h0.getTimeStr(),
    });
    if (chatContainer) {
      chatContainer.innerHTML = '';
      h0.renderProblemDetailChatFromStorage(chatContainer, as().problemDetailChatMessages);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    h0.renderProblemDetailHistory();
    return;
  }
  const simplifiedNodes = buildE2eSimplifiedVsmNodesForSingleStage(valueStream, sess.stageIndex ?? nextIdx);
  const systemPrompt = buildE2ePerStageTransactionFlowSystemPrompt();
  const userPrompt = ['## 5. 本次输入数据 (仅限当前阶段)', '', JSON.stringify(simplifiedNodes, null, 2)].join('\n');
  const llmInputPrompt = ['【系统】', systemPrompt, '', '【用户】', userPrompt].join('\n');
  if (chatContainer) {
    chatContainer.innerHTML = '';
    h0.renderProblemDetailChatFromStorage(chatContainer, as().problemDetailChatMessages);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    const parsingBlock = document.createElement('div');
    parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
    parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">${h0.escapeHtml('正在生成阶段「' + stageName + '」的事务流…')}</span></div></div><div class="problem-detail-chat-msg-time">${h0.getTimeStr()}</div>`;
    chatContainer.appendChild(parsingBlock);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  try {
    let parsed = null;
    if (simplifiedNodes.length === 0) {
      parsed = { stage_name: stageName, transaction_nodes: [] };
    } else {
      const { content, usage, model, durationMs } = await h0.fetchDeepSeekChat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { taskTag: 'task7' },
      );
      const raw = content != null ? String(content) : '';
      parsed = h0.parseStrictJsonObjectFromLlmText(raw);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('模型返回无法解析为 JSON 对象');
      }
      const llmMeta = { usage, model, durationMs };
      h0.pushAndSaveProblemDetailChat({
        type: 'task7LlmQueryBlock',
        taskId: 'task7',
        noteName: '事务流分阶段生成',
        stepName: stageName,
        stepIndex: nextIdx,
        llmInputPrompt,
        llmOutputRaw: raw,
        llmMeta,
        timestamp: h0.getTimeStr(),
        confirmed: false,
      });
    }
    const normalized = {
      stage_name: String(parsed.stage_name || stageName).trim() || stageName,
      transaction_nodes: Array.isArray(parsed.transaction_nodes) ? parsed.transaction_nodes : [],
    };
    const newSessions = sessions.map((s, i) =>
      i === nextIdx ? { ...s, transactionNodesJson: normalized } : s,
    );
    patchE2eTransactionFlowSessionsBlockInChat(cKey, newSessions);
    const merged = buildMergedE2eBpmTransactionFlowFromSessions(newSessions);
    if (typeof h0.mergeDigitalProblemPatch === 'function') {
      h0.mergeDigitalProblemPatch(pk, { e2eTransactionFlowJson: merged });
    } else if (typeof h0.updateDigitalProblemE2eTransactionFlow === 'function') {
      h0.updateDigitalProblemE2eTransactionFlow(pk, merged);
    }
    logE2eWorkspaceDebug('persist:after-stage-merge', {
      pkTail: String(pk).slice(-10),
      gapSteps: countE2eGapTaggedStepsInFlow(merged),
      stagesLen: merged?.stages?.length ?? 0,
    });
    const listAfter = typeof h0.getDigitalProblems === 'function' ? h0.getDigitalProblems() : [];
    const freshItem = listAfter.find(
      (it) =>
        String(it.createdAt || '') === String(item.createdAt || '') || String(it.id || '') === String(item.id || ''),
    );
    as().currentProblemDetailItem = freshItem ? { ...freshItem } : { ...item, e2eTransactionFlowJson: merged };
    const allSessionsHaveTx = newSessions.every((s) => s != null && s.transactionNodesJson != null);
    h0.pushAndSaveProblemDetailChat({
      role: 'system',
      content: `已完成【${normalized.stage_name}】的事务流生成。`,
      timestamp: h0.getTimeStr(),
    });
    if (allSessionsHaveTx) {
      upsertE2eFlowJsonBlockInChatMessages(cKey, merged, valueStream);
      const doneItem = freshItem || as().currentProblemDetailItem;
      if (doneItem && typeof h0.isTaskCompleted === 'function' && !h0.isTaskCompleted(doneItem, 'task7')) {
        const gapSessions = generateE2ePrelimFvsCompletenessSessionsFromItem(doneItem);
        const hasPrelimFvsDomains = gapSessions.length > 0;
        const msgsCheck = as().problemDetailChatMessages || [];
        const alreadyHasCompleteness = msgsCheck.some((m) => m?.type === 'e2ePrelimFvsCompletenessSessionsBlock');
        if (!hasPrelimFvsDomains || alreadyHasCompleteness) {
          h0.pushAndSaveProblemDetailChat({
            role: 'system',
            content: '所有价值流阶段的事务流已生成完毕，合并结果已写入工作区。',
            timestamp: h0.getTimeStr(),
          });
          const lists = typeof h0.getTaskLists === 'function' ? h0.getTaskLists() : {};
          const FOLLOW_TASKS = lists.FOLLOW_TASKS || [];
          const ITGAP_HISTORY_TASKS = lists.ITGAP_HISTORY_TASKS || [];
          const IT_STRATEGY_TASKS = lists.IT_STRATEGY_TASKS || [];
          const task7Name =
            (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === 'task7')?.name) ||
            '端到端事务流构建';
          h0.showTaskCompletionConfirm('task7', task7Name);
        } else {
          h0.pushAndSaveProblemDetailChat({
            role: 'system',
            content:
              '所有价值流阶段的事务流已生成完毕，合并结果已写入工作区。将根据初步需求「业务流程」按类目校验覆盖情况：请在下方「校验流程完整性 Session 计划」中点击「自动顺序执行」，逐项补齐尚未体现在当前端到端事务流中的客户流程。',
            timestamp: h0.getTimeStr(),
          });
          h0.pushAndSaveProblemDetailChat({
            type: 'e2ePrelimFvsCompletenessSessionsBlock',
            taskId: 'task7',
            sessions: gapSessions,
            timestamp: h0.getTimeStr(),
          });
        }
      }
    } else {
      removeTask7BpmE2eFlowJsonBlockFromChat(cKey);
    }
    h0.renderProblemDetailContent();
    if (chatContainer) {
      chatContainer.innerHTML = '';
      h0.renderProblemDetailChatFromStorage(chatContainer, as().problemDetailChatMessages);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    h0.renderProblemDetailHistory();
  } catch (err) {
    console.warn('[task7] 分阶段事务流生成失败:', err);
    h0.pushAndSaveProblemDetailChat({
      role: 'system',
      content: '业务事务流生成失败：' + String(err?.message || err),
      timestamp: h0.getTimeStr(),
    });
    if (chatContainer) {
      chatContainer.innerHTML = '';
      h0.renderProblemDetailChatFromStorage(chatContainer, as().problemDetailChatMessages);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    h0.renderProblemDetailHistory();
  }
}

/**
 * 端到端事务流工作区排障快照（不含全文 JSON）。控制台设 `globalThis.__FE_E2E_WORKSPACE_DEBUG = true` 后，渲染路径会打印本对象。
 * @param {object|null} item
 * @param {unknown[]} messages
 * @param {object|null} txFlowResolved
 * @returns {Record<string, unknown>}
 */
function buildE2eWorkspaceDebugSnapshot(item, messages, txFlowResolved) {
  const msgs = Array.isArray(messages) ? messages : [];
  const pk = item ? persistKeyForItem(item) : '';
  const fromItem = item?.e2eTransactionFlowJson;
  const rawPick = item ? pickRawE2eTransactionFlowJsonFromItemAndMessages(item, msgs) : null;
  const supEff = item ? resolveEffectiveRequirementScenarioSupplementJson(item, msgs) : null;
  const gapSess = getE2ePrelimFvsCompletenessSessionsFromMessages(msgs);
  const completenessSessionsWithTx = gapSess.filter(
    (s) => s?.transactionNodesJson != null && typeof s.transactionNodesJson === 'object',
  ).length;
  let hideE2e = true;
  try {
    hideE2e = item ? shouldHideE2eFlowWorkspaceUntilTaskStart(item, msgs) : true;
  } catch (_) {
    hideE2e = true;
  }
  return {
    persistKeyTail: pk.length > 14 ? `…${pk.slice(-10)}` : pk || '(empty)',
    hideE2eWorkspace: hideE2e,
    hasItemE2eJson: !!(fromItem && typeof fromItem === 'object'),
    itemFieldGapSteps: fromItem && typeof fromItem === 'object' ? countE2eGapTaggedStepsInFlow(fromItem) : 0,
    pickRawGapSteps: rawPick ? countE2eGapTaggedStepsInFlow(rawPick) : 0,
    resolvedGapSteps: txFlowResolved ? countE2eGapTaggedStepsInFlow(txFlowResolved) : 0,
    pickRawStages: rawPick?.stages?.length ?? 0,
    pickRawFlatTx: rawPick?.transaction_nodes?.length ?? 0,
    hasE2eFlowJsonBlock: msgs.some((m) => isTask7BpmE2eFlowJsonBlock(m)),
    hasSupplementFieldOnItem: item?.e2eRequirementScenarioSupplementJson != null,
    effectiveSupplementBpmSteps: supEff ? countTotalBpmStepsInSupplementAgg(supEff) : 0,
    effectiveSupplementTxCount: supEff ? countSupplementTransactionNodesInAgg(supEff) : 0,
    completenessSessionsWithTx,
    msgLen: msgs.length,
  };
}

/**
 * @param {Record<string, unknown>} host
 */
function init(host) {
  _host = host;
  if (typeof globalThis !== 'undefined') {
    globalThis.pickRawE2eTransactionFlowJsonFromItemAndMessages = pickRawE2eTransactionFlowJsonFromItemAndMessages;
  }
}

const task7E2eTransactionFlowApi = {
  init,
  shouldHideE2eFlowWorkspaceUntilTaskStart,
  overlayE2eTransactionFlowStageNamesFromSessions,
  buildE2eSimplifiedVsmNodesForBpmPrompt,
  buildE2eSimplifiedVsmNodesForSingleStage,
  buildE2ePerStageTransactionFlowSystemPrompt,
  generateE2eTransactionFlowSessionsFromValueStream,
  getE2eTransactionFlowSessionsFromMessages,
  patchE2eTransactionFlowSessionsBlockInChat,
  buildMergedE2eBpmTransactionFlowFromSessions,
  pickRawE2eTransactionFlowJsonFromItemAndMessages,
  pickRicherE2eTransactionFlowJson,
  resolveE2eTransactionFlowJsonForWorkspace,
  applyE2eTransactionFlowHydrationFromMessages,
  upsertE2eFlowJsonBlockInChatMessages,
  removeTask7BpmE2eFlowJsonBlockFromChat,
  groupTask7PrelimFvsDomainsFromItem,
  generateE2ePrelimFvsCompletenessSessionsFromItem,
  getE2ePrelimFvsCompletenessSessionsFromMessages,
  patchE2ePrelimFvsCompletenessSessionsBlockInChat,
  buildE2eRequirementScenarioSupplementJsonFromGapSessions,
  resolveEffectiveRequirementScenarioSupplementJson,
  buildE2ePrelimFvsCompletenessSystemPrompt,
  runE2ePrelimFvsCompletenessForNextDomain,
  runE2eTransactionFlowForNextStage,
  buildE2eWorkspaceDebugSnapshot,
};

globalThis.SmartCto = globalThis.SmartCto || {};
globalThis.SmartCto.task7E2eTransactionFlow = task7E2eTransactionFlowApi;
