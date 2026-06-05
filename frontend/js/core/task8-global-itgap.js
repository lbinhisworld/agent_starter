/**
 * [INPUT]: `main.js` bootstrap `init(deps)` 注入 el、getAppState、push/save、渲染与存储回调
 * [OUTPUT]: IT设计补齐（task8，技术域全局 ITGap）四阶段定义、生成/压缩编排、工作区 HTML 与 Tab 绑定；`globalThis.SmartCto.task8GlobalItGap`
 * [POS]: Phase 4A 从 `main.js` 迁出；**禁止**引用 task9 `localItGap.js`
 *
 * [PROTOCOL]: 阶段定义变更须同步报告页、`frontend/js/core/AGENTS.md`、主记录 §4/§5
 */

/** @type {Record<string, unknown> | null} */
let _host = null;

function requireHost() {
  if (!_host) throw new Error("[task8-global-itgap] init() 须由 main.js 在编排调用前执行");
  return _host;
}

function esc(s) {
  const fn = _host && _host.escapeHtml;
  return fn ? fn(s) : globalThis.escapeHtml(s);
}

function md(s) {
  const fn = _host && _host.renderMarkdown;
  return fn ? fn(String(s)) : globalThis.renderMarkdown(String(s));
}

async function fetchChat(messages, opts) {
  const fn = (_host && _host.fetchDeepSeekChat) || globalThis.fetchDeepSeekChat;
  if (typeof fn !== "function") throw new Error("fetchDeepSeekChat 不可用");
  return fn(messages, opts);
}

const GLOBAL_ITGAP_PROMPT = `# 角色设定
你是一位拥有工业数字化背景的资深业务架构师。你擅长运用 McKinsey 7-Step 方法论，从全局视角审视企业端到端事务流中的"IT 断点"。

# 输入背景说明
我将为你提供三个核心数据集：
- enterprise_context: 包含客户工商信息及核心业务逻辑
- business_canvas: 描述客户的商业模式（BMC），特别是核心资源与关键业务
- full_process_vsm: 包含从需求获取到成品交付的全链路价值流图，以及各环节的 IT 现状与痛点描述

# 任务要求
请跳出单一环节的限制，针对全链路执行"全局 IT Gap 分析"，并按以下维度输出：

1. **全局架构失调诊断 (Structural Gap)**：识别是否存在"烟囱式"架构或数据孤岛；分析数据从最上游（销售/预测）到最下游（物流/发货）的流转损耗率。

2. **决策协同断裂分析 (Collaboration Gap)**：识别跨部门（如销售与生产、财务与计划）之间的信息不对称点；重点分析"经验驱动"而非"数据驱动"的决策节点。

3. **数字化覆盖盲区 (Digital Blind Spots)**：找出目前仍依赖手动 Excel、线下纸质单据或口头传达的"重度人工干预区"；分析现有老旧系统对新业务模式的支撑乏力点。

4. **优先级建议矩阵 (Roadmap Strategy)**：基于"实施难度"与"业务价值"，给出填补 Gap 的建议顺序；区分"基础底座型 Gap"与"业务增量型 Gap"。

# 输出格式
请以 JSON 格式返回，包含以下字段（均支持 Markdown）：
\`\`\`json
{
  "structuralGap": "全局架构失调诊断（烟囱式架构、数据孤岛、流转损耗等）",
  "collaborationGap": "决策协同断裂分析（跨部门信息不对称、经验驱动决策节点等）",
  "digitalBlindSpots": "数字化覆盖盲区（重度人工干预区、老旧系统支撑乏力点等）",
  "roadmapStrategy": "优先级建议矩阵（实施难度与业务价值、基础底座型与业务增量型 Gap）",
  "globalInsight": "深刻的全局洞察结论（Markdown）",
  "asIsToBeTable": "As-Is（现状）与 To-Be（目标）对比表格（Markdown）",
  "top3Gaps": ["核心 IT 缺口 1", "核心 IT 缺口 2", "核心 IT 缺口 3"],
  "priorityMatrix": [
    {"任务": "填补某项 Gap", "业务价值": "高/中/低", "实施难度": "高/中/低", "建议阶段": "短期/中期/长期"}
  ],
  "finalExecutiveSummary": "给决策层的一句话核心架构建议"
}
\`\`\`
- structuralGap、collaborationGap、digitalBlindSpots、roadmapStrategy：对应上述四个维度的分析内容
- globalInsight：一段深刻的全局洞察
- asIsToBeTable：使用 Markdown 表格展示现状与目标对比
- top3Gaps：Top 3 必须优先解决的"核心 IT 缺口"
- priorityMatrix：Gap 分类矩阵（业务价值 × 实施难度 × 建议阶段）
- finalExecutiveSummary：决策层一句话建议`;

const GLOBAL_ITGAP_STRUCTURED_SECTIONS = [
  { key: '现状扫描', label: '现状扫描（环节与 IT 现状）' },
  { key: 'asIsList', label: 'As-Is 环节清单（环节 / 现状支撑 / 核心痛点）', objectRowFields: ['环节', '现状支撑', '核心痛点'] },
  { key: 'structuralGap', label: '全局架构失调诊断 (Structural Gap)' },
  { key: 'collaborationGap', label: '决策协同断裂分析 (Collaboration Gap)' },
  { key: 'experienceDrivenNodes', label: '经验驱动决策节点', objectRowFields: ['决策节点', '经验依赖表现', '业务风险'] },
  { key: 'collaborationInsight', label: '协同效率全局洞察' },
  { key: 'digitalBlindSpots', label: '数字化覆盖盲区 (Digital Blind Spots)' },
  { key: 'asIsToBeTable', label: 'As-Is（现状）与 To-Be（目标）对比' },
  { key: 'top3Gaps', label: 'Top3 核心 IT 缺口', isArray: true },
  { key: 'globalInsight', label: '全局洞察 (Global Insight)' },
  { key: 'roadmapStrategy', label: '优先级建议矩阵 (Roadmap Strategy)' },
  {
    key: 'priorityMatrix',
    label: 'Gap 分类矩阵（基础底座型 / 业务增量型）',
    objectRowFields: ['任务', '业务价值', '实施难度', '建议阶段'],
  },
  { key: 'finalExecutiveSummary', label: '决策层一句话核心架构建议' },
];

/**
 * 工作区卡片：各阶段下嵌套「维度」子卡（与四阶段提示词产出对应），每项为 { label, keys }。
 * keys 对应 GLOBAL_ITGAP_STRUCTURED_SECTIONS 的 key，顺序即展示顺序。
 */
const GLOBAL_ITGAP_WORKSPACE_PHASE_DIMENSIONS = {
  1: [
    { label: '全局架构失调 (Structural Gap)', keys: ['现状扫描', 'asIsList', 'structuralGap'] },
    { label: '数字化覆盖盲区 (Digital Blind Spots)', keys: ['digitalBlindSpots'] },
  ],
  2: [
    { label: '决策协同断裂 (Collaboration Gap)', keys: ['collaborationGap'] },
    { label: '决策驱动诊断', keys: ['experienceDrivenNodes', 'collaborationInsight'] },
  ],
  3: [
    { label: '现状与目标映射 (As-Is vs To-Be)', keys: ['asIsToBeTable'] },
    { label: '核心缺口筛选 (Top 3 Gaps)', keys: ['top3Gaps'] },
    { label: '全局洞察 (Global Insight)', keys: ['globalInsight'] },
  ],
  4: [
    { label: '优先级建议 (Roadmap Strategy)', keys: ['roadmapStrategy', 'finalExecutiveSummary'] },
    { label: 'Gap 分类矩阵', keys: ['priorityMatrix'] },
  ],
};

/** 全局 ITGap 分四阶段顺序执行：每阶段独立 LLM 调用，合并为最终 JSON */
const GLOBAL_ITGAP_PHASE_DEFS = [
  {
    id: 1,
    stepName: '第一阶段：结构与盲区扫描 (基础现状层)',
    mergeKeys: ['现状扫描', 'structuralGap', 'digitalBlindSpots', 'asIsList'],
    /** 与总览 GLOBAL_ITGAP_PROMPT 二选一，避免重复与冲突 */
    skipBaseGlobalItGapPrompt: true,
    phaseInstruction: `# 角色设定
你是一位拥有工业数字化背景的资深业务架构师，擅长识别企业底层的"架构病灶"。

# 输入背景
以下由用户在后续消息中提供三段 JSON（对应企业背景洞察/客户基本信息、商业模式画布 BMC、端到端事务流价值流，含各环节 IT 现状与痛点）：
- enterprise_context
- business_canvas
- full_process_vsm

# 任务要求
请聚焦全链路中的"物理断点"与"手动干预区"，分析以下维度：
1. **全局架构失调 (Structural Gap)**：识别哪些环节存在数据孤岛（烟囱架构），并分析数据在流转过程中的损耗情况。
2. **数字化覆盖盲区 (Digital Blind Spots)**：找出重度依赖 Excel、纸质单据或口头传达的环节，并分析现有老旧系统为何支撑乏力。

# 输出格式 (仅返回 JSON，不要 Markdown 代码围栏或其它说明)
{
  "现状扫描": "环节名称与 IT 现状描述",
  "structuralGap": "架构失调与数据孤岛的具体诊断",
  "digitalBlindSpots": "手动干预区与老旧系统瓶颈分析",
  "asIsList": [
    {"环节": "环节名", "现状支撑": "系统名称或手段", "核心痛点": "具体的断裂表现"}
  ]
}`,
  },
  {
    id: 2,
    stepName: '第二阶段：协同与决策分析 (逻辑流转层)',
    mergeKeys: ['collaborationGap', 'experienceDrivenNodes', 'collaborationInsight'],
    skipBaseGlobalItGapPrompt: true,
    phaseInstruction: `# 角色设定
你是一位资深业务架构师。基于已识别的物理断点，进一步剖析企业逻辑层面的协同矛盾。

# 输入背景
以下由用户在后续消息中提供：
- **第一子任务阶段诊断输出**：见「已完成阶段输出」JSON 片段（含 现状扫描、structuralGap、digitalBlindSpots、asIsList 等）；
- **端到端事务流**：见 full_process_vsm（与 enterprise_context、business_canvas 一并给出）。

# 任务要求
请分析跨部门协作中的信息流转障碍：
1. **决策协同断裂 (Collaboration Gap)**：识别销售、交付、财务等部门间的信息不对称点（如：销售承诺了交付做不到的事情）。
2. **决策驱动诊断**：分析哪些关键节点仍依赖「个人经验」而非「数据驱动」，并指出其潜在风险。

# 输出格式 (仅返回 JSON，不要 Markdown 代码围栏或其它说明)
{
  "collaborationGap": "跨部门信息不对称的深度分析",
  "experienceDrivenNodes": [
    {"决策节点": "名称", "经验依赖表现": "描述", "业务风险": "对冲失败的后果"}
  ],
  "collaborationInsight": "一段关于协同效率低下的全局洞察"
}`,
  },
  {
    id: 3,
    stepName: '第三阶段：目标愿景与对比 (To-Be 建模层)',
    mergeKeys: ['asIsToBeTable', 'top3Gaps', 'globalInsight'],
    skipBaseGlobalItGapPrompt: true,
    phaseInstruction: `# 角色设定
你是一位资深业务架构师。现在需要将前两阶段的痛点转化为具体的「数字化建设目标」。

# 输入背景
以下由用户在后续消息中提供：
- **第一及第二子任务阶段诊断输出**：见「已完成阶段输出」JSON 片段（含 现状扫描、structuralGap、digitalBlindSpots、asIsList、collaborationGap、experienceDrivenNodes、collaborationInsight 等）；
- **端到端事务流**：见 full_process_vsm（与 enterprise_context、business_canvas 一并给出）。

# 任务要求
1. **现状与目标映射 (As-Is vs To-Be)**：针对核心痛点，定义数字化后的理想闭环状态。
2. **核心缺口筛选 (Top 3 Gaps)**：从全局视角筛选出必须最优先解决的 3 个「核心 IT 缺口」。
3. **全局洞察 (Global Insight)**：基于全链路视角给出一份深刻的数字化架构总结。

# 输出格式 (仅返回 JSON，不要 Markdown 代码围栏或其它说明)
{
  "asIsToBeTable": "Markdown 格式的现状与目标对比表格",
  "top3Gaps": ["核心缺口 1", "核心缺口 2", "核心缺口 3"],
  "globalInsight": "深刻的全局架构洞察结论（Markdown）"
}

禁止输出 现状扫描、asIsList、structuralGap、digitalBlindSpots、collaborationGap、experienceDrivenNodes、collaborationInsight、roadmapStrategy、priorityMatrix、finalExecutiveSummary。`,
  },
  {
    id: 4,
    stepName: '第四阶段：优先级与路径规划 (战略落地层)',
    mergeKeys: ['roadmapStrategy', 'priorityMatrix', 'finalExecutiveSummary'],
    skipBaseGlobalItGapPrompt: true,
    phaseInstruction: `# 角色设定
你是一位资深业务架构师。请为填补上述所有 IT Gap 制定具体的实施优先级与路线图。

# 输入背景
以下由用户在后续消息中提供：
- **第一、二、三子任务阶段诊断输出**：见「已完成阶段输出」JSON 片段；
- **端到端事务流**：见 full_process_vsm（与 enterprise_context、business_canvas 一并给出）。

# 任务要求
1. **优先级建议 (Roadmap Strategy)**：基于「实施难度」与「业务价值」，对填补 Gap 的动作进行排期。
2. **Gap 分类矩阵**：区分哪些是「基础底座型 Gap」（必须先行），哪些是「业务增量型 Gap」（快速见效）。

# 输出格式 (仅返回 JSON，不要 Markdown 代码围栏或其它说明)
{
  "roadmapStrategy": "详细的优先级排期建议描述",
  "priorityMatrix": [
    {"任务": "填补某项 Gap", "业务价值": "高/中/低", "实施难度": "高/中/低", "建议阶段": "短期/中期/长期"}
  ],
  "finalExecutiveSummary": "给决策层的一句话核心架构建议"
}

禁止输出 现状扫描、asIsList、structuralGap、digitalBlindSpots、collaborationGap、experienceDrivenNodes、collaborationInsight、asIsToBeTable、top3Gaps、globalInsight 及其它顶层字段。`,
  },
];

function buildGlobalItGapDatasetUserContent(enterpriseContext, businessCanvas, fullProcessVsm) {
  return `## enterprise_context（客户工商信息及核心业务逻辑）
\`\`\`json
${typeof enterpriseContext === 'string' ? enterpriseContext : JSON.stringify(enterpriseContext || {}, null, 2)}
\`\`\`

## business_canvas（商业模式 BMC）
\`\`\`json
${typeof businessCanvas === 'string' ? businessCanvas : JSON.stringify(businessCanvas || {}, null, 2)}
\`\`\`

## full_process_vsm（全链路价值流图，含 IT 现状与痛点）
\`\`\`json
${typeof fullProcessVsm === 'string' ? fullProcessVsm : JSON.stringify(fullProcessVsm || {}, null, 2)}
\`\`\``;
}

function extractJsonObjectFromLlmContent(content) {
  const jsonMatch = content != null ? String(content).match(/\{[\s\S]*\}/) : null;
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (_) {
    return null;
  }
}

function pickGlobalItGapPhaseFields(obj, keys) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null) {
      out[k] = obj[k];
    }
  }
  return out;
}

function mergeGlobalItGapPhaseIntoAccum(accum, phaseObj, keys) {
  const picked = pickGlobalItGapPhaseFields(phaseObj, keys);
  const next = { ...accum, ...picked };
  return normalizeGlobalItGapAnalysisShape(next);
}

async function generateGlobalItGapPhaseAnalysis(phaseDef, enterpriseContext, businessCanvas, fullProcessVsm, priorMerged) {
  const dataset = buildGlobalItGapDatasetUserContent(enterpriseContext, businessCanvas, fullProcessVsm);
  const priorKeys = [
    '现状扫描',
    'asIsList',
    'structuralGap',
    'digitalBlindSpots',
    'collaborationGap',
    'experienceDrivenNodes',
    'collaborationInsight',
    'globalInsight',
    'asIsToBeTable',
    'roadmapStrategy',
    'top3Gaps',
  ];
  const priorSlice = {};
  if (priorMerged && typeof priorMerged === 'object') {
    for (const k of priorKeys) {
      const v = priorMerged[k];
      if (v == null) continue;
      if (typeof v === 'string' && !v.trim()) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      priorSlice[k] = v;
    }
  }
  const priorStr =
    Object.keys(priorSlice).length > 0
      ? `\n\n## 已完成阶段输出（JSON 片段，请承接并保持术语一致）\n\`\`\`json\n${JSON.stringify(priorSlice, null, 2)}\n\`\`\``
      : '';
  const systemPrompt =
    phaseDef.skipBaseGlobalItGapPrompt === true
      ? phaseDef.phaseInstruction
      : `${GLOBAL_ITGAP_PROMPT}\n\n${phaseDef.phaseInstruction}`;
  const userContent = `${dataset}${priorStr}\n\n## 当前阶段\n${phaseDef.stepName}\n请严格只返回上述阶段要求的一个 JSON 对象，不要 Markdown 代码围栏。`;
  const fullPrompt = `${systemPrompt}\n\n${userContent}`;
  const { content, usage, model, durationMs } = await fetchChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    { taskTag: `task8-global-itgap-phase-${phaseDef.id}` },
  );
  return { content, usage, model, durationMs, fullPrompt };
}

function pushGlobalItGapPhasePlanBlockAndRender() {
  const h = requireHost();
  const st = h.getAppState();
  const item = st.currentProblemDetailItem;
  const container = h.el.problemDetailChatMessages;
  if (!item?.createdAt || !container) return;
  const msgs = st.problemDetailChatMessages;
  if (!Array.isArray(msgs)) return;
  const hasPendingPlan = msgs.some((m) => m.type === 'globalItGapPhasePlanBlock' && !m.confirmed);
  if (hasPendingPlan) return;
  h.pushAndSaveProblemDetailChat({
    type: 'globalItGapPhasePlanBlock',
    taskId: 'task8',
    phases: GLOBAL_ITGAP_PHASE_DEFS.map((p) => ({ stepName: p.stepName })),
    timestamp: h.getTimeStr(),
    confirmed: false,
  });
  container.innerHTML = '';
  h.renderProblemDetailChatFromStorage(container, h.getAppState().problemDetailChatMessages);
  container.scrollTop = container.scrollHeight;
  h.renderProblemDetailHistory();
}

function normalizeGlobalItGapAnalysisShape(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      现状扫描: '',
      asIsList: [],
      structuralGap: '',
      collaborationGap: '',
      experienceDrivenNodes: [],
      collaborationInsight: '',
      digitalBlindSpots: '',
      roadmapStrategy: '',
      globalInsight: '',
      asIsToBeTable: '',
      top3Gaps: [],
      priorityMatrix: [],
      finalExecutiveSummary: '',
    };
  }
  const obj = raw;
  const pick = (keys) => {
    for (const k of keys) {
      const v = obj[k];
      if (v == null) continue;
      if (Array.isArray(v)) return v;
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      if (typeof v === 'object') return v;
    }
    return null;
  };
  const toText = (v) => {
    if (v == null) return '';
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n');
    if (typeof v === 'object') return JSON.stringify(v, null, 2);
    return String(v);
  };
  const toArray = (v) => {
    if (Array.isArray(v)) return v.map((x) => (x == null ? '' : String(x))).filter((x) => x.trim());
    if (typeof v === 'string') return v.split(/\n|;|；/).map((x) => x.trim()).filter(Boolean);
    return [];
  };

  const 现状扫描 = toText(pick(['现状扫描', 'xianzhuang_saomiao', '环节名称与 IT 现状']));
  let asIsList = [];
  const rawAsIsList = obj.asIsList != null ? obj.asIsList : obj.as_is_list;
  if (Array.isArray(rawAsIsList)) {
    asIsList = rawAsIsList.filter((x) => x != null && typeof x === 'object');
  }

  let structuralGap = toText(pick(['structuralGap', 'structural_gap', '全局架构失调诊断', '结构性缺口']));
  let collaborationGap = toText(pick(['collaborationGap', 'collaboration_gap', '决策协同断裂分析', '协同缺口']));
  const collaborationInsight = toText(pick(['collaborationInsight', 'collaboration_insight', '协同效率全局洞察']));
  let experienceDrivenNodes = [];
  const rawExpNodes = obj.experienceDrivenNodes != null ? obj.experienceDrivenNodes : obj.experience_driven_nodes;
  if (Array.isArray(rawExpNodes)) {
    experienceDrivenNodes = rawExpNodes.filter((x) => x != null && typeof x === 'object');
  }
  let digitalBlindSpots = toText(pick(['digitalBlindSpots', 'digital_blind_spots', '数字化覆盖盲区']));
  let roadmapStrategy = toText(pick(['roadmapStrategy', 'roadmap_strategy', '优先级建议矩阵', '路线图策略']));
  const globalInsight = toText(pick(['globalInsight', 'global_insight', '全局洞察结论', '洞察结论']));
  const asIsToBeTable = toText(pick(['asIsToBeTable', 'as_is_to_be_table', 'asIsToBe', 'AsIsToBe', 'As-Is（现状）与 To-Be（目标）']));
  let top3Gaps = toArray(pick(['top3Gaps', 'top3_gaps', 'top3', 'Top3 核心 IT 缺口', '核心IT缺口']));
  let priorityMatrix = [];
  const rawPm = obj.priorityMatrix != null ? obj.priorityMatrix : obj.priority_matrix;
  if (Array.isArray(rawPm)) {
    priorityMatrix = rawPm
      .filter((x) => x != null && typeof x === 'object')
      .map((row) => ({
        任务: String(row['任务'] ?? row.task ?? row.gap ?? row.name ?? '').trim() || '—',
        业务价值: String(row['业务价值'] ?? row.business_value ?? row.businessValue ?? '').trim() || '—',
        实施难度: String(row['实施难度'] ?? row.difficulty ?? row.implementationDifficulty ?? '').trim() || '—',
        建议阶段: String(row['建议阶段'] ?? row.phase ?? row.stage ?? '').trim() || '—',
      }));
  }
  const finalExecutiveSummary = toText(
    pick(['finalExecutiveSummary', 'final_executive_summary', 'executiveSummary', '决策层一句话', '核心架构建议'])
  );

  if (!structuralGap && !collaborationGap && !digitalBlindSpots && !roadmapStrategy) {
    const archGaps = Array.isArray(obj.architecture_gaps) ? obj.architecture_gaps : [];
    if (archGaps.length > 0) {
      const lines = archGaps.map((g, i) => {
        const coordinate = g?.coordinate || '—';
        const impactType = g?.impact_type || '—';
        const loss = g?.loss_rate_or_risk || '—';
        const ex = Array.isArray(g?.exception_scenarios) ? g.exception_scenarios.join('；') : (g?.exception_scenarios || '—');
        const legacy = g?.legacy_system_constraints || '—';
        return `${i + 1}. ${coordinate}\n- 类型：${impactType}\n- 风险：${loss}\n- 异常：${ex}\n- 系统约束：${legacy}`;
      });
      structuralGap = lines.join('\n\n');
      collaborationGap = lines.join('\n\n');
      digitalBlindSpots = lines.join('\n\n');
      roadmapStrategy = toText(obj?.design_directives?.evolution_priority);
      const mustHave = obj?.design_directives?.must_have_objects;
      if (Array.isArray(mustHave) && mustHave.length > 0 && top3Gaps.length === 0) {
        top3Gaps = mustHave.map((x) => x?.object).filter((x) => typeof x === 'string' && x.trim()).slice(0, 3);
      }
    }
  }

  return {
    现状扫描,
    asIsList,
    structuralGap,
    collaborationGap,
    experienceDrivenNodes,
    collaborationInsight,
    digitalBlindSpots,
    roadmapStrategy,
    globalInsight,
    asIsToBeTable,
    top3Gaps,
    priorityMatrix,
    finalExecutiveSummary,
  };
}

/** 去除内容开头与蓝色子标题重复的 markdown 小标题（如 ## 标题、**标题** 等） */
function stripRedundantHeadingFromContent(content, label) {
  if (!content || typeof content !== 'string') return content;
  let text = content.trim();
  const chinesePart = (label.match(/^([^（(]+)/) || [])[1]?.trim() || label;
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`^#+\\s*[^\\n]*${esc(chinesePart)}[^\\n]*\\n?`),
    new RegExp(`^\\*\\*[^\\n]*${esc(chinesePart)}[^\\n]*\\*\\*\\s*\\n?`),
    new RegExp(`^${esc(chinesePart)}[\\s:：]*\\n?`),
  ];
  for (const re of patterns) {
    const prev = text;
    text = text.replace(re, '').trim();
    if (prev !== text) break;
  }
  return text || content;
}

/**
 * 将全局 ITGap 分析 JSON 转为结构化 HTML。
 * @param {object} analysis
 * @param {{ workspaceSubcards?: boolean }} [options] workspaceSubcards 为 true 时（工作区 view）：各维度为可折叠子卡片；默认 false（聊天区等）为平铺章节。
 */
/**
 * 按给定章节列表渲染全局 ITGap 结构化 HTML（工作区子卡或平铺）。
 * @param {object} analysis 已归一化的分析对象
 * @param {Array<{key: string, label: string, isArray?: boolean, objectRowFields?: string[]}>} sections
 */
function buildGlobalItGapStructuredHtmlForSections(analysis, sections, options = {}) {
  const workspaceSubcards = options.workspaceSubcards === true;
  if (!analysis || typeof analysis !== 'object') return '<p>（暂无内容）</p>';
  if (!Array.isArray(sections) || sections.length === 0) return '<p>（本阶段暂无结构化字段）</p>';
  const parts = [];
  for (const { key, label, isArray, objectRowFields } of sections) {
    let val = analysis[key];
    if (objectRowFields && Array.isArray(objectRowFields) && objectRowFields.length >= 2 && Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
      const fields = objectRowFields;
      const fTitle = fields[0];
      val = val
        .map((row, i) => {
          const vTitle = row[fTitle] || row.step || row.name || row.node || `项${i + 1}`;
          const rest = fields.slice(1);
          const lines = rest.map((fk) => {
            const vv = row[fk] != null ? String(row[fk]) : '—';
            return `- **${fk}**：${vv}`;
          });
          return `### ${i + 1}. ${vTitle}\n${lines.join('\n')}`;
        })
        .join('\n\n');
    } else if (isArray && Array.isArray(val)) {
      val = val.map((g, i) => `${i + 1}. ${g}`).join('\n');
    } else if (isArray) {
      val = '';
    }
    let content = (val != null ? String(val).trim() : '') || '—';
    if (content !== '—') content = stripRedundantHeadingFromContent(content, label);
    const bodyInner = content === '—' ? '—' : md(content);
    if (workspaceSubcards) {
      parts.push(
        `<div class="problem-detail-global-itgap-subcard" data-section-key="${esc(key)}">` +
          `<button type="button" class="problem-detail-global-itgap-subcard-header" aria-expanded="false">` +
          `<span class="problem-detail-global-itgap-subcard-title">${esc(label)}</span>` +
          `<span class="problem-detail-global-itgap-subcard-arrow">▸</span>` +
          `</button>` +
          `<div class="problem-detail-global-itgap-subcard-body markdown-body" hidden>${bodyInner}</div>` +
          `</div>`
      );
    } else {
      parts.push(
        `<div class="problem-detail-global-itgap-section"><h4 class="problem-detail-global-itgap-section-title">${esc(label)}</h4>` +
          `<div class="problem-detail-global-itgap-section-content markdown-body">${bodyInner}</div></div>`
      );
    }
  }
  const joined = parts.join('');
  return workspaceSubcards ? `<div class="problem-detail-global-itgap-subcards-wrap">${joined}</div>` : joined;
}

function buildGlobalItGapStructuredHtml(analysis, options = {}) {
  return buildGlobalItGapStructuredHtmlForSections(analysis, GLOBAL_ITGAP_STRUCTURED_SECTIONS, options);
}

/** 工作区：四阶段块，每阶段下按提示词维度嵌套子卡，各维度含 view｜json */
function buildGlobalItGapWorkspacePhaseSubcardsHtml(analysis) {
  const norm = normalizeGlobalItGapAnalysisShape(analysis);
  return GLOBAL_ITGAP_PHASE_DEFS.map((phase) => {
    let dimensions = GLOBAL_ITGAP_WORKSPACE_PHASE_DIMENSIONS[phase.id];
    if (!Array.isArray(dimensions) || dimensions.length === 0) {
      dimensions = [{ label: phase.stepName, keys: [...phase.mergeKeys] }];
    }
    const dimHtml = dimensions
      .map((dim, di) => {
        const orderedSections = dim.keys
          .map((k) => GLOBAL_ITGAP_STRUCTURED_SECTIONS.find((s) => s.key === k))
          .filter(Boolean);
        const slice = {};
        for (const k of dim.keys) {
          if (Object.prototype.hasOwnProperty.call(norm, k)) slice[k] = norm[k];
        }
        const viewInner = buildGlobalItGapStructuredHtmlForSections(norm, orderedSections, { workspaceSubcards: true });
        const jsonPlain = JSON.stringify(slice, null, 2);
        return (
          `<div class="problem-detail-global-itgap-dimension-subcard" data-phase-id="${esc(String(phase.id))}" data-dimension-index="${di}">` +
          `<div class="problem-detail-global-itgap-dimension-head">` +
          `<span class="problem-detail-global-itgap-dimension-title">${esc(dim.label)}</span>` +
          `<div class="problem-detail-global-itgap-dimension-tabs" role="tablist">` +
          `<button type="button" class="problem-detail-global-itgap-dimension-tab problem-detail-global-itgap-dimension-tab-active" data-tab="view" role="tab" aria-selected="true">view</button>` +
          `<button type="button" class="problem-detail-global-itgap-dimension-tab" data-tab="json" role="tab" aria-selected="false">json</button>` +
          `</div></div>` +
          `<div class="problem-detail-global-itgap-dimension-panel problem-detail-global-itgap-dimension-panel-view markdown-body" data-panel="view">${viewInner}</div>` +
          `<div class="problem-detail-global-itgap-dimension-panel problem-detail-global-itgap-dimension-panel-json" data-panel="json" hidden>` +
          `<pre class="problem-detail-card-json-pre">${esc(jsonPlain)}</pre></div></div>`
        );
      })
      .join('');
    return (
      `<div class="problem-detail-global-itgap-phase-block" data-phase-id="${esc(String(phase.id))}">` +
      `<div class="problem-detail-global-itgap-phase-block-head">` +
      `<span class="problem-detail-global-itgap-phase-block-title">${esc(phase.stepName)}</span></div>` +
      `<div class="problem-detail-global-itgap-phase-dimensions-wrap">${dimHtml}</div></div>`
    );
  }).join('');
}

async function generateGlobalItGapAnalysis(enterpriseContext, businessCanvas, fullProcessVsm) {
  const userContent = buildGlobalItGapDatasetUserContent(enterpriseContext, businessCanvas, fullProcessVsm);
  const fullPrompt = `${GLOBAL_ITGAP_PROMPT}\n\n${userContent}`;
  const { content, usage, model, durationMs } = await fetchChat([
    { role: 'system', content: GLOBAL_ITGAP_PROMPT },
    { role: 'user', content: userContent },
  ]);
  return { content, usage, model, durationMs, fullPrompt };
}

/** 构建 task8 使用的「初步需求-总结提炼」JSON（不含 requirementDetail 原文） */
function buildPreliminarySummaryForTask8(item) {
  // 与 preliminaryRequirement 同源：优先走 window.buildPreliminarySummaryJson（V2/合成对象）
  if (typeof globalThis.buildPreliminarySummaryJson === 'function') {
    return globalThis.buildPreliminarySummaryJson(item);
  }
  const pre = (item && typeof item === 'object' ? (item.preliminaryReq || {}) : {}) || {};
  return {
    customerName: pre.customerName ?? item?.customerName ?? item?.customer_name ?? '',
    customerNeedsOrChallenges: pre.customerNeedsOrChallenges ?? item?.customerNeedsOrChallenges ?? item?.customer_needs_or_challenges ?? '',
    customerItStatus: pre.customerItStatus ?? item?.customerItStatus ?? item?.customer_it_status ?? '',
    projectTimeRequirement: pre.projectTimeRequirement ?? item?.projectTimeRequirement ?? item?.project_time_requirement ?? '',
    operationModel: pre.operationModel ?? item?.operationModel,
    businessStatus: pre.businessStatus ?? item?.businessStatus,
    urgencyAnalysis: pre.urgencyAnalysis ?? item?.urgencyAnalysis,
  };
}

function buildGlobalItGapConstraintCompressionSystemPrompt(customerLabel) {
  const name = (customerLabel != null && String(customerLabel).trim()) ? String(customerLabel).trim().slice(0, 120) : '客户';
  const body = `Role & Context:
你是一名数字化转型专家。你需要将《企业 IT Gap 全局诊断报告》提炼为一份**“架构决策元数据”**。输出必须为严格的 JSON 格式，以便后续架构建模工具直接调用。

Task Goal:
在极高压缩比下，锁定业务动力、资产边界和异常逻辑，杜绝“颗粒度蒸发”或“时序倒置”。

⚠️ 压缩防损协议 (Anti-Loss Protocols):
必须在推演中闭环:

物理坐标锁定：严禁模糊描述。必须指明数据断裂的具体环节对（如：从顾问 Excel 到运营系统）及损耗率。

权力意志提取：必须明确数字化是要从谁手里收回资产管控权（解决“资产私有化”问题）。

异常流捕捉：必须包含报告中提到的业务错误场景（如：错发、漏发、分润争议），这是系统健壮性的来源。

技术边界固化：必须保留具体的第三方系统名（如金蝶、企微、CRM）及其集成要求。

Output Format (Strict JSON):
请直接输出 JSON，不要包含任何 Markdown 标识、开场白或结尾。结构如下：

JSON
{
  "customer_metadata": {
    "name": "[客户名]",
    "business_essence": "商业模式本质一句话洞察",
    "asset_reclamation_focus": ["资产收归重点1", "重点2"]
  },
  "architecture_gaps": [
    {
      "gap_id": "GAP_01",
      "coordinate": "发生环节 A -> B",
      "impact_type": "数据损耗 / 决策黑箱 / 影子流程",
      "loss_rate_or_risk": "描述损耗比例或具体业务风险",
      "exception_scenarios": ["常见异常场景1", "场景2"],
      "legacy_system_constraints": "涉及的旧系统及集成痛点"
    }
  ],
  "design_directives": {
    "must_have_objects": [
      {
        "object": "核心对象名",
        "reason": "为什么必须建立，解决哪个核心确权问题",
        "trace_requirement": "是否需要 Trace_ID 或 Evidence_Link"
      }
    ],
    "logic_engines": ["需建立的逻辑引擎，如：自动化分润、智能匹配"],
    "ecosystem_integration": ["企微/金蝶等具体集成方式硬要求"],
    "evolution_priority": {
      "P0_Foundation": ["地基任务"],
      "P1_Growth": ["骨架任务"]
    ]
  }
}`;
  return body.replace(/\[客户名\]/g, name);
}

function getCustomerLabelForGlobalItGap(item) {
  if (!item || typeof item !== 'object') return '客户';
  const bi = item.basicInfo || {};
  const n = bi.enterprise_name ?? bi.companyName ?? bi.customerName ?? item.customer_name ?? item.customerName;
  const s = n != null ? String(n).trim() : '';
  return s ? s.slice(0, 120) : '客户';
}

async function runGlobalItGapConstraintCompressionAfterConfirm(analysisJson) {
  const h = requireHost();
  const st = h.getAppState();
  const { FOLLOW_TASKS, ITGAP_HISTORY_TASKS, IT_STRATEGY_TASKS } = h.getTaskLists();
  const t8Name = (FOLLOW_TASKS.concat(ITGAP_HISTORY_TASKS || []).concat(IT_STRATEGY_TASKS || []).find((t) => t.id === 'task8')?.name) || 'IT设计补齐';
  const container = h.el.problemDetailChatMessages;
  const item = st.currentProblemDetailItem;
  const finishConfirm = () => h.showTaskCompletionConfirm('task8', t8Name);
  if (!container || !item?.createdAt || analysisJson == null) {
    finishConfirm();
    return;
  }
  if (!h.hasAiConfig()) {
    h.pushAndSaveProblemDetailChat({
      role: 'system',
      content: '未配置 AI，已跳过 IT设计补齐 的架构约束底座压缩；仍可点击下方确认任务完成。',
      timestamp: h.getTimeStr(),
    });
    finishConfirm();
    container.innerHTML = '';
    h.renderProblemDetailChatFromStorage(container, st.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
    h.renderProblemDetailHistory();
    return;
  }
  const customerLabel = getCustomerLabelForGlobalItGap(item);
  const systemPrompt = buildGlobalItGapConstraintCompressionSystemPrompt(customerLabel);
  const reportJson = JSON.stringify(analysisJson, null, 2);
  const userContent = `【以下为《企业 IT Gap 全局诊断报告》完整 JSON，请严格按系统指令输出 Strict JSON 压缩稿（只返回一个 JSON 对象，不要附加解释与代码块）】\n\n${reportJson}`;
  const llmInputPrompt = `【系统】\n${systemPrompt}\n\n【用户】\n${userContent}`;
  const parsingBlock = document.createElement('div');
  parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
  parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在将 IT设计补齐 诊断报告压缩为架构约束底座…</span></div></div><div class="problem-detail-chat-msg-time">${h.getTimeStr()}</div>`;
  container.appendChild(parsingBlock);
  container.scrollTop = container.scrollHeight;
  try {
    const { content, usage, model, durationMs } = await fetchChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]);
    parsingBlock.remove();
    const llmOutputRaw = content != null ? String(content) : '';
    const llmMeta = { usage, model, durationMs };
    if (typeof h.updateDigitalProblemGlobalItGapConstraintBase === 'function') {
      h.updateDigitalProblemGlobalItGapConstraintBase(item.createdAt, llmOutputRaw);
    }
    const list = h.getDigitalProblems();
    const updated = list.find((it) => it.createdAt === item.createdAt);
    if (updated) st.currentProblemDetailItem = updated;
    h.renderProblemDetailContent();
    h.pushAndSaveProblemDetailChat({
      type: 'globalItGapCompressionBlock',
      taskId: 'task8',
      noteName: t8Name,
      llmInputPrompt,
      llmOutputRaw,
      constraintBaseMarkdown: llmOutputRaw,
      llmMeta,
      timestamp: h.getTimeStr(),
      confirmed: false,
    });
  } catch (err) {
    parsingBlock.remove();
    h.pushAndSaveProblemDetailChat({
      role: 'system',
      content: 'IT设计补齐·架构约束底座压缩失败：' + (err.message || String(err)),
      timestamp: h.getTimeStr(),
    });
  }
  container.innerHTML = '';
  h.renderProblemDetailChatFromStorage(container, st.problemDetailChatMessages);
  container.scrollTop = container.scrollHeight;
  h.renderProblemDetailHistory();
  finishConfirm();
}

async function runGlobalItGapAnalysis(isRedo) {
  const h = requireHost();
  const st = h.getAppState();
  const container = h.el.problemDetailChatMessages;
  const item = st.currentProblemDetailItem;
  if (!container || !item?.createdAt) return;
  if (!h.hasAiConfig()) {
    const errBlock = document.createElement('div');
    errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
    errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">请先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）才能使用 IT设计补齐 功能。</div></div><div class="problem-detail-chat-msg-time">${h.getTimeStr()}</div>`;
    container.appendChild(errBlock);
    h.pushAndSaveProblemDetailChat({ role: 'system', content: '请先配置 AI（local 模式填写 DEEPSEEK_API_KEY，online 模式配置 BACKEND_API_URL）才能使用 IT设计补齐 功能。', timestamp: h.getTimeStr() });
    return;
  }
  const enterpriseContext = {
    basicInfo: item.basicInfo || h.getProblemDetailConfirmedBasicInfo(),
    requirementLogic: item.requirementLogic,
    preliminary: buildPreliminarySummaryForTask8(item),
  };
  const businessCanvas = item.bmc || {};
  const fullProcessVsm = item.valueStream;

  if (isRedo && item?.createdAt) {
    st.problemDetailChatMessages = st.problemDetailChatMessages.filter((m) => m.type !== 'globalItGapCompressionBlock');
    h.saveProblemDetailChat(item.createdAt, st.problemDetailChatMessages);
    if (typeof h.updateDigitalProblemGlobalItGapConstraintBase === 'function') {
      h.updateDigitalProblemGlobalItGapConstraintBase(item.createdAt, '');
    }
    const listRedo = h.getDigitalProblems();
    const updRedo = listRedo.find((it) => it.createdAt === item.createdAt);
    if (updRedo) st.currentProblemDetailItem = updRedo;
    const msgs = st.problemDetailChatMessages;
    const cardIdx = msgs.findLastIndex((m) => m.type === 'globalItGapAnalysisCard');
    if (cardIdx >= 0) {
      const toRemove = new Set([cardIdx]);
      for (let i = cardIdx - 1; i >= 0; i--) {
        const t = msgs[i].type;
        if (t === 'task8LlmQueryBlock') {
          toRemove.add(i);
          continue;
        }
        if (t === 'globalItGapPhasePlanBlock' || t === 'globalItGapStartBlock') break;
        break;
      }
      st.problemDetailChatMessages = msgs.filter((_, idx) => !toRemove.has(idx));
      h.saveProblemDetailChat(item.createdAt, st.problemDetailChatMessages);
    }
  }

  let merged = normalizeGlobalItGapAnalysisShape({});
  let lastMeta = { usage: {}, model: '', durationMs: 0 };
  let parsingBlock = null;

  try {
    for (let pi = 0; pi < GLOBAL_ITGAP_PHASE_DEFS.length; pi++) {
      const phase = GLOBAL_ITGAP_PHASE_DEFS[pi];
      parsingBlock = document.createElement('div');
      parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
      parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在执行【${esc(phase.stepName)}】</span></div></div><div class="problem-detail-chat-msg-time">${h.getTimeStr()}</div>`;
      container.appendChild(parsingBlock);
      container.scrollTop = container.scrollHeight;

      const { content, usage, model, durationMs, fullPrompt } = await generateGlobalItGapPhaseAnalysis(
        phase,
        enterpriseContext,
        businessCanvas,
        fullProcessVsm,
        merged,
      );
      if (parsingBlock) {
        parsingBlock.remove();
        parsingBlock = null;
      }
      const rawObj = extractJsonObjectFromLlmContent(content) || {};
      merged = mergeGlobalItGapPhaseIntoAccum(merged, rawObj, phase.mergeKeys);
      lastMeta = { usage: usage || {}, model: model || '', durationMs: durationMs || 0 };
      h.pushAndSaveProblemDetailChat({
        role: 'system',
        type: 'task8LlmQueryBlock',
        taskId: 'task8',
        noteName: 'IT设计补齐',
        stepName: phase.stepName,
        phaseIndex: phase.id,
        llmInputPrompt: fullPrompt != null ? String(fullPrompt) : '',
        llmOutputRaw: (content != null ? String(content) : '') || '',
        llmMeta: lastMeta,
        timestamp: h.getTimeStr(),
        confirmed: false,
      });
      if (typeof h.renderProblemDetailHistory === 'function') h.renderProblemDetailHistory();
    }

    h.pushAndSaveProblemDetailChat({
      type: 'globalItGapAnalysisCard',
      data: merged,
      structuredView: false,
      timestamp: h.getTimeStr(),
      confirmed: false,
      llmMeta: lastMeta,
    });
    container.innerHTML = '';
    h.renderProblemDetailChatFromStorage(container, st.problemDetailChatMessages);
    container.scrollTop = container.scrollHeight;
    h.renderProblemDetailHistory();
  } catch (err) {
    if (parsingBlock) parsingBlock.remove();
    const errBlock = document.createElement('div');
    errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
    errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">IT设计补齐失败：${esc(err.message || String(err))}</div></div><div class="problem-detail-chat-msg-time">${h.getTimeStr()}</div>`;
    container.appendChild(errBlock);
    h.pushAndSaveProblemDetailChat({ role: 'system', content: 'IT设计补齐失败：' + (err.message || String(err)), timestamp: h.getTimeStr() });
    container.scrollTop = container.scrollHeight;
    h.renderProblemDetailHistory();
  }
}

function getGlobalItGapCompressedJsonForWorkspace(item) {
  const h = requireHost();
  const st = h.getAppState();
  const fromItem = item?.globalItGapConstraintBaseMarkdown;
  if (fromItem != null) {
    if (typeof fromItem === 'string') {
      const s = fromItem.trim();
      if (s && s !== 'null' && s !== 'undefined' && s !== '""') return fromItem;
    } else if (typeof fromItem === 'object') {
      try {
        return JSON.stringify(fromItem, null, 2);
      } catch (_) {}
    }
  }
  if (!Array.isArray(st.problemDetailChatMessages)) return '';
  for (let i = st.problemDetailChatMessages.length - 1; i >= 0; i--) {
    const m = st.problemDetailChatMessages[i];
    if (m?.type !== 'globalItGapCompressionBlock') continue;
    const raw = m.constraintBaseMarkdown;
    if (raw != null) {
      const s = String(raw).trim();
      if (s && s !== 'null' && s !== 'undefined' && s !== '""') return String(raw);
    }
    const fallback = m.llmOutputRaw;
    if (fallback != null && String(fallback).trim()) return String(fallback);
  }
  return '';
}

function setupGlobalItGapSubcardToggle() {
  const pd = requireHost().el.problemDetailContent;
  pd?.querySelectorAll('.problem-detail-global-itgap-subcard').forEach((subcard) => {
    const header = subcard.querySelector('.problem-detail-global-itgap-subcard-header');
    const body = subcard.querySelector('.problem-detail-global-itgap-subcard-body');
    const arrow = header?.querySelector('.problem-detail-global-itgap-subcard-arrow');
    if (!header || !body || !arrow) return;
    const toggle = () => {
      const expanded = !body.hidden;
      body.hidden = expanded;
      header.setAttribute('aria-expanded', String(!expanded));
      arrow.textContent = expanded ? '▸' : '▾';
    };
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });
}

/** 全局 ITGap 工作区：阶段下各维度子卡内 view | json Tab（委托，避免重复绑定） */
function setupGlobalItGapWorkspaceDimensionTabs() {
  const pd = requireHost().el.problemDetailContent;
  if (pd?.dataset.globalItGapDimensionTabsDelegated === '1') return;
  if (!pd) return;
  pd.dataset.globalItGapDimensionTabsDelegated = '1';
  pd.addEventListener('click', (e) => {
    const tab = e.target.closest('.problem-detail-global-itgap-dimension-tab');
    if (!tab || !pd.contains(tab)) return;
    e.stopPropagation();
    const dimCard = tab.closest('.problem-detail-global-itgap-dimension-subcard');
    if (!dimCard) return;
    const tabs = dimCard.querySelectorAll('.problem-detail-global-itgap-dimension-tab');
    const panels = dimCard.querySelectorAll('.problem-detail-global-itgap-dimension-panel');
    const tabName = tab.getAttribute('data-tab');
    tabs.forEach((t) => {
      const active = t.getAttribute('data-tab') === tabName;
      t.classList.toggle('problem-detail-global-itgap-dimension-tab-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach((p) => {
      p.hidden = (p.getAttribute('data-panel') || '') !== tabName;
    });
  });
}

function hasNormalizedContent(norm) {
  if (!norm || typeof norm !== 'object') return false;
  for (const k of Object.keys(norm)) {
    if (!Object.prototype.hasOwnProperty.call(norm, k)) continue;
    const v = norm[k];
    if (typeof v === 'string' && v.trim()) return true;
    if (Array.isArray(v) && v.length > 0) {
      if (typeof v[0] === 'object' && v[0] != null) return true;
      if (typeof v[0] === 'string' && String(v[0]).trim()) return true;
    }
  }
  return false;
}

function buildGlobalItGapGenericHtml(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
  const keys = Object.keys(obj);
  if (keys.length === 0) return '';
  const parts = [];
  for (const k of keys) {
    const v = obj[k];
    const label = esc(String(k));
    let body = '';
    if (v == null) {
      body = '<p class="report-empty">—</p>';
    } else if (typeof v === 'string') {
      body = '<div class="markdown-body">' + md(v) + '</div>';
    } else if (Array.isArray(v)) {
      if (v.length === 0) {
        body = '<p class="report-empty">—</p>';
      } else if (typeof v[0] === 'object' && v[0] != null) {
        body = '<pre class="problem-detail-card-json-pre report-global-itgap-generic-pre">' + esc(JSON.stringify(v, null, 2)) + '</pre>';
      } else {
        body = '<ul class="report-global-itgap-generic-ul">' + v.map((x) => '<li>' + esc(x == null ? '' : String(x)) + '</li>').join('') + '</ul>';
      }
    } else if (typeof v === 'object') {
      body = '<pre class="problem-detail-card-json-pre report-global-itgap-generic-pre">' + esc(JSON.stringify(v, null, 2)) + '</pre>';
    } else {
      body = '<p>' + esc(String(v)) + '</p>';
    }
    parts.push(
      '<section class="report-global-itgap-generic-block"><h4 class="report-global-itgap-generic-title">' + label + '</h4><div class="report-global-itgap-generic-body">' + body + '</div></section>',
    );
  }
  return '<div class="report-global-itgap-generic-root">' + parts.join('') + '</div>';
}

function unwrapGlobalItGapPayload(raw) {
  if (raw == null) return raw;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw) && Object.prototype.hasOwnProperty.call(raw, 'analysis')) {
    return raw.analysis;
  }
  return raw;
}

function isGlobalItGapPayloadEmpty(raw) {
  if (raw == null) return true;
  if (typeof raw === 'string') return !String(raw).trim();
  if (typeof raw !== 'object') return false;
  const payload = unwrapGlobalItGapPayload(raw);
  if (payload == null) return true;
  if (typeof payload === 'string') return !String(payload).trim();
  if (Array.isArray(payload)) return payload.length === 0;
  if (typeof payload === 'object') {
    const n = normalizeGlobalItGapAnalysisShape(payload);
    if (hasNormalizedContent(n)) return false;
    const keys = Object.keys(payload);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = payload[k];
      if (v == null) continue;
      if (typeof v === 'string' && v.trim()) return false;
      if (Array.isArray(v) && v.length > 0) return false;
      if (typeof v === 'object' && Object.keys(v).length > 0) return false;
    }
  }
  return true;
}

/** 报告页与主站共用；`reportTabClasses:true` 时 Tab 追加 report-* 类名 */
function buildGlobalItGapWorkspacePhaseSubcardsHtmlForReport(analysis) {
  const norm = normalizeGlobalItGapAnalysisShape(analysis);
  return GLOBAL_ITGAP_PHASE_DEFS.map((phase) => {
    let dimensions = GLOBAL_ITGAP_WORKSPACE_PHASE_DIMENSIONS[phase.id];
    if (!Array.isArray(dimensions) || dimensions.length === 0) {
      dimensions = [{ label: phase.stepName, keys: [...phase.mergeKeys] }];
    }
    const dimHtml = dimensions
      .map((dim, di) => {
        const orderedSections = dim.keys.map((k) => GLOBAL_ITGAP_STRUCTURED_SECTIONS.find((s) => s.key === k)).filter(Boolean);
        const slice = {};
        for (const k of dim.keys) {
          if (Object.prototype.hasOwnProperty.call(norm, k)) slice[k] = norm[k];
        }
        const viewInner = buildGlobalItGapStructuredHtmlForSections(norm, orderedSections, { workspaceSubcards: true });
        const jsonPlain = JSON.stringify(slice, null, 2);
        return (
          '<div class="problem-detail-global-itgap-dimension-subcard" data-phase-id="' + esc(String(phase.id)) + '" data-dimension-index="' + di + '">' +
          '<div class="problem-detail-global-itgap-dimension-head">' +
          '<span class="problem-detail-global-itgap-dimension-title">' + esc(dim.label) + '</span>' +
          '<div class="problem-detail-global-itgap-dimension-tabs" role="tablist">' +
          '<button type="button" class="problem-detail-global-itgap-dimension-tab problem-detail-global-itgap-dimension-tab-active report-itgap-tab-view" data-tab="view" role="tab" aria-selected="true">view</button>' +
          '<button type="button" class="problem-detail-global-itgap-dimension-tab report-itgap-tab-json" data-tab="json" role="tab" aria-selected="false">json</button>' +
          '</div></div>' +
          '<div class="problem-detail-global-itgap-dimension-panel problem-detail-global-itgap-dimension-panel-view markdown-body" data-panel="view">' + viewInner + '</div>' +
          '<div class="problem-detail-global-itgap-dimension-panel problem-detail-global-itgap-dimension-panel-json" data-panel="json" hidden>' +
          '<pre class="problem-detail-card-json-pre">' + esc(jsonPlain) + '</pre></div></div>'
        );
      })
      .join('');
    return (
      '<div class="problem-detail-global-itgap-phase-block" data-phase-id="' + esc(String(phase.id)) + '">' +
      '<div class="problem-detail-global-itgap-phase-block-head">' +
      '<span class="problem-detail-global-itgap-phase-block-title">' + esc(phase.stepName) + '</span></div>' +
      '<div class="problem-detail-global-itgap-phase-dimensions-wrap">' + dimHtml + '</div></div>'
    );
  }).join('');
}

function reportGlobalItGapBuildWorkspaceHtml(raw) {
  if (raw == null) return '';
  const payload = unwrapGlobalItGapPayload(raw);
  if (typeof payload === 'string') {
    const ts = payload.trim();
    if (!ts) return '';
    return '<div class="report-global-itgap-shell markdown-body report-global-itgap-fallback-md">' + md(ts) + '</div>';
  }
  if (payload == null) return '';
  if (isGlobalItGapPayloadEmpty({ analysis: payload })) return '';
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    const g0 = buildGlobalItGapGenericHtml(Array.isArray(payload) ? { items: payload } : {});
    return g0 ? '<div class="report-global-itgap-shell">' + g0 + '</div>' : '';
  }
  const norm = normalizeGlobalItGapAnalysisShape(payload);
  if (hasNormalizedContent(norm)) {
    return '<div class="report-global-itgap-shell problem-detail-global-itgap-phases-wrap">' + buildGlobalItGapWorkspacePhaseSubcardsHtmlForReport(payload) + '</div>';
  }
  const generic = buildGlobalItGapGenericHtml(payload);
  if (generic && String(generic).trim()) {
    return '<div class="report-global-itgap-shell report-global-itgap-shell--generic">' + generic + '</div>';
  }
  return '';
}

function init(deps) {
  _host = deps;
}

const task8GlobalItGapApi = {
  init,
  GLOBAL_ITGAP_PROMPT,
  GLOBAL_ITGAP_STRUCTURED_SECTIONS,
  GLOBAL_ITGAP_WORKSPACE_PHASE_DIMENSIONS,
  GLOBAL_ITGAP_PHASE_DEFS,
  buildGlobalItGapDatasetUserContent,
  extractJsonObjectFromLlmContent,
  pickGlobalItGapPhaseFields,
  mergeGlobalItGapPhaseIntoAccum,
  generateGlobalItGapPhaseAnalysis,
  pushGlobalItGapPhasePlanBlockAndRender,
  normalizeGlobalItGapAnalysisShape,
  stripRedundantHeadingFromContent,
  buildGlobalItGapStructuredHtmlForSections,
  buildGlobalItGapStructuredHtml,
  buildGlobalItGapWorkspacePhaseSubcardsHtml,
  generateGlobalItGapAnalysis,
  buildPreliminarySummaryForTask8,
  buildGlobalItGapConstraintCompressionSystemPrompt,
  getCustomerLabelForGlobalItGap,
  runGlobalItGapConstraintCompressionAfterConfirm,
  runGlobalItGapAnalysis,
  getGlobalItGapCompressedJsonForWorkspace,
  setupGlobalItGapSubcardToggle,
  setupGlobalItGapWorkspaceDimensionTabs,
  hasNormalizedContent,
  buildGlobalItGapGenericHtml,
  unwrapGlobalItGapPayload,
  isGlobalItGapPayloadEmpty,
  buildGlobalItGapWorkspacePhaseSubcardsHtmlForReport,
  reportGlobalItGapBuildWorkspaceHtml,
};

globalThis.SmartCto = globalThis.SmartCto || {};
globalThis.SmartCto.task8GlobalItGap = task8GlobalItGapApi;

if (typeof window !== 'undefined') {
  window.pushGlobalItGapPhasePlanBlockAndRender = () => task8GlobalItGapApi.pushGlobalItGapPhasePlanBlockAndRender();
  window.runGlobalItGapAnalysis = (isRedo) => task8GlobalItGapApi.runGlobalItGapAnalysis(isRedo);
  window.reportGlobalItGapBuildWorkspaceHtml = (raw) => task8GlobalItGapApi.reportGlobalItGapBuildWorkspaceHtml(raw);
  window.reportGlobalItGapIsEmpty = (raw) => task8GlobalItGapApi.isGlobalItGapPayloadEmpty(raw);
}
