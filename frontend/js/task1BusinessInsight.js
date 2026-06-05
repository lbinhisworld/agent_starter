/**
 * 企业背景洞察（Task1）核心逻辑模块：
 * - 工商信息提炼大模型调用（`parseCompanyBasicInfoInput`，主站/通用）
 * - 设计详情页 task1：经营信息提取（`extractDesignDetailBusinessInfoFromUserFeedback` + `DESIGN_DETAIL_BUSINESS_EXTRACT_NOTE_NAME`）；**L1 原始实然特征集**（`inferDesignDetailL1OriginalFeatureFromContext` + `designDetailL1OriginalFeatureSystemPrompt.js`，根键 `L1_Original_Feature_Matrix`，行级 `Validation_Status: Pending`）；客户需求提炼（`extractDesignDetailCustomerRequirementFromUserFeedback` + `parseExistingSpreadsheetsFromRequirementText` + `DESIGN_DETAIL_CUSTOMER_REQUIREMENT_SYSTEM_PROMPT`，含顶层 `existingSpreadsheets`；**仅用户原文明确表名**时落库，不按字段推测表名）
 * - 设计详情页 BMC（`generateDesignDetailBmcFromContext` + `DESIGN_DETAIL_BMC_NOTE_NAME`，由后续步骤触发）
 * - 设计详情任务 2：`inferDesignDetailL1EntityPortraitFromContext`（`L1_Entity_Inference_Matrix`：**三键全量保活**（组织管控拓扑/合规约束等级/管控复杂度）+ **Validation_Status 透传** + **`Token_Validation_Mapping`**（Resolved_By_Customer→已通过纠偏修正/N/A）；**user** 为 `task2InferenceUserBlock`；提示词见 `designDetailL2L1EntityPortraitSystemPrompt.js`；**`POST …/sync-task2-l1-target-kv-tokens`** 合并追加落库）；**对齐问卷** / **深访合成** 带 **`llmLog`**
 * - 设计详情任务 3：`inferDesignDetailL2IndustryBusinessFromContext`（`L2_Business_Inference_Matrix`；**三键**核心资产属性/交付模式/行业类别 + **Validation_Status 中继透传** + TVM/Resolved 免疫；提示词见 `designDetailL3L2IndustryBusinessSystemPrompt.js`）；**L2 反向验证对齐** / **深访合成**（**`llmLog`** 约定）
 * - 设计详情任务 4：`inferDesignDetailL2CoreValueDriverFromContext`（`L2_Value_Inference_Matrix`；**四键**核心价值驱动/运营重心/账面焦点/数字化成熟度预期 + **Validation_Status 中继** + TVM/Resolved 免疫；提示词见 `designDetailL4L2ValueDriverSystemPrompt.js`）；**user** 为 `task4InferenceUserBlock`）；**反向验证对齐** / **深访合成**（**`llmLog`** 约定）
 * - 设计详情任务 5：`inferDesignDetailL3MacroProcessFromContext`（根键 **`L3_Process_Inference_Matrix`**；五大宏观流程特征 + **Validation_Status 中继** + TVM/Resolved 免疫；**不含** VSM 阶段（属任务 5.5）；提示词见 `designDetailL5L3MacroProcessSystemPrompt.js`；**user** 为 `task5InferenceUserBlock`）
 * - 设计详情任务 5.5：`inferDesignDetailL3VsmStageFromContext`（根键 **`L3_Value_Stream_Matrix`**；**`classified_workflows`** 100% 收容 5.3 工作流；策略 A 动宾 `phase_name`；提示词见 `designDetailL55L3VsmStageSystemPrompt.js`；**user** 仅 Input 1）
 * - Task1 LLM 查询时间线消息构建
 */
(function (global) {
  /**
   * 解析模型输出的 JSON 字符串；失败时抛出带场景说明的中文错误，避免 V8 `SyntaxError` 原文直接进入设计页 `loadError`（用户常描述为「任务进展」旁红字）。
   * @param {string} jsonStr
   * @param {string} scenarioLabel
   * @returns {Object}
   */
  function parseTask1LlmJsonOrThrow(jsonStr, scenarioLabel) {
    const label = String(scenarioLabel || '大模型输出').trim() || '大模型输出';
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      const hint = e instanceof Error ? e.message : String(e);
      throw new Error(
        `${label}：返回内容不是合法 JSON（${hint}）。请缩短或调整输入后重试；若模型在 JSON 值内使用了未转义的双引号，也会触发本错误。`,
      );
    }
  }

  /**
   * @typedef {Object} Task1BasicInfoLlmResult
   * @property {Object} parsed - 解析后的工商信息 JSON。
   * @property {Object} usage - 大模型 token 使用统计（prompt_tokens/completion_tokens/total_tokens）。
   * @property {string} model - 模型名称。
   * @property {number} durationMs - 本次调用耗时（毫秒）。
   * @property {string} fullPrompt - 完整提示词（system + user）。
   * @property {string} rawOutput - 原始 JSON 输出文本。
   */

  /**
   * @typedef {Object} Task1LlmQueryMessageArgs
   * @property {string} [noteName] - 备注名称（例如：工商信息提炼、初步需求提炼）。
   * @property {string} fullPrompt - 提交给大模型的完整提示词。
   * @property {Object|string} parsed - 大模型解析结果。
   * @property {string} [rawOutput] - 原始输出文本（兜底展示）。
   * @property {string} timestamp - 时间戳。
   * @property {Object} [usage] - token 使用统计。
   * @property {string} [model] - 模型名称。
   * @property {number} [durationMs] - 调用耗时（毫秒）。
   * @property {number} [task1RequirementDistillOrdinal] - 仅设计详情「客户需求提炼」：本案例聊天中**全案第几次**需求提炼 LLM 调用（1-based），写入持久化聊天供统计/画布与历史对齐。
   */

  /**
   * 解析用户输入的客户基本信息，提取结构化字段。
   * @param {string} text - 用户输入文本。
   * @returns {Promise<Task1BasicInfoLlmResult>} 大模型调用结果与解析结果。
   * @throws {Error} 当 `fetchDeepSeekChat` 未加载或返回内容无法解析为 JSON 时抛出。
   */
  async function parseCompanyBasicInfoInput(text) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = `你是一个专业的企业信息提取助手。用户会输入一段关于企业基本信息的描述（可能是复制粘贴或自由输入），请从中提炼出以下字段，以 JSON 格式返回，不要包含其他内容：

{
  "company_name": "企业名称/公司名称",
  "credit_code": "统一社会信用代码",
  "legal_representative": "法定代表人",
  "established_date": "成立日期",
  "registered_capital": "注册资本",
  "is_listed": "是否上市",
  "listing_location": "上市地点",
  "business_scope": "经营范围",
  "core_qualifications": "核心资质",
  "official_website": "官网"
}

如果某字段无法从输入中推断，该字段填 "" 或 "—"。只返回 JSON，不要有 markdown 代码块包裹。`;

    const { content, usage, model, durationMs } = await fetchDeepSeekChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ]);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const parsed = parseTask1LlmJsonOrThrow(String(jsonStr), '工商信息提炼');
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${text}`;
    return { parsed, usage, model, durationMs, fullPrompt, rawOutput: jsonStr };
  }

  /**
   * 构建 task1 LLM 查询消息（供时间线与聊天记录持久化）。
   * @param {Task1LlmQueryMessageArgs} args - 消息参数。
   * @returns {Object} 可直接 `pushAndSaveProblemDetailChat` 的 `task1LlmQueryBlock` 消息对象。
   */
  function buildTask1LlmQueryMessage(args) {
    const noteName = args?.noteName || '工商信息提炼';
    const ordRaw = args && args.task1RequirementDistillOrdinal;
    const ordNum = typeof ordRaw === 'number' ? ordRaw : Number(ordRaw);
    const out = {
      role: 'system',
      type: 'task1LlmQueryBlock',
      taskId: 'task1',
      noteName,
      llmInputPrompt: args?.fullPrompt || '',
      llmOutputJson: args?.parsed != null ? args.parsed : {},
      llmOutputRaw: args?.rawOutput || '',
      timestamp: args?.timestamp || '',
      llmMeta: (args && args.usage) || args?.model || typeof args?.durationMs === 'number'
        ? { usage: args?.usage || {}, model: args?.model, durationMs: args?.durationMs || 0 }
        : undefined,
    };
    if (Number.isFinite(ordNum) && ordNum >= 1) {
      out.task1RequirementDistillOrdinal = Math.floor(ordNum);
    }
    return out;
  }

  /** 设计详情页 task1 进度路径：经营范围类用户补充后生成 BMC；与主站 task2 `BMC_GENERATION_PROMPT` 独立 */
  const DESIGN_DETAIL_BMC_NOTE_NAME = '设计详情 BMC 生成';

  const DESIGN_DETAIL_BMC_SYSTEM_PROMPT = `# Role
你是一位拥有15年经验的【首席商业架构师】与【数字化转型专家】。你擅长在信息不完整时，用商业模式画布（BMC）把「谁付钱、交付什么、如何持续」说清楚；既能解读集团型/多业务线组织，也能解读小微团队、工作室、项目制或产品型技术团队。

# Task
请基于提供的【客户基础信息】及【初步需求/总结提炼】，运用商业模式画布（Business Model Canvas）框架，分析该主体的经营模式与关键假设。

# Input Data（使用优先级）
1) 【初步需求/总结提炼】若存在且非空：视为**主证据**，优先据此判断交付形态、客户、价值与风险。
2) 【客户基础信息】中的工商/登记类信息：视为**主体锚点**（名称、行业大类、经营范围、规模线索等），用于校准行业与合规语境；**禁止**在初步需求已矛盾时仍以工商为准硬编故事。
3) 若工商信息稀薄（如经营范围泛化为「软件开发/技术咨询」等）而初步需求较具体：**以初步需求为准**补全商业逻辑，并在推演中显式写出你采用的关键假设。

# Analysis Logic（推演要求）
在构建画布时，不要简单复述经营范围或口号，而应做可检验的推演，并**按组织规模与形态自适应**：

规模与形态：
- 若为集团/多法人/多业务线：在「客户细分」「价值主张」「渠道/客户关系」中体现分层或主次（不必展开到集团全貌，但需说明本次画布描述的主业务或主客群）。
- 若为小微组织（如十人级开发团队、工作室、轻资产服务商）：允许各格合并叙述，但必须写清**交付形态**（项目制/人月外包/产品订阅/驻场/混合等）、**产能与瓶颈**（人力、关键人、并发项目、交付周期）、**主要成本结构**（人力、云与第三方服务、分包、销售获客等）。

产业链与模式（在信息允许时选用，勿牵强）：
- 产业链位置：更偏上游/中游/下游，或偏「能力输出/工具平台」而非传统制造链。
- 核心驱动力：技术创新、规模与成本、品牌与渠道、资质与准入、关系与转介绍、生态与平台效应等，择其最贴近证据的一两类并说明理由。
- 客户关系：B2B/B2G/B2C/混合；长周期强关系 vs 短周期交易等。

# Output Format（输出要求）
请严格按以下 JSON 结构输出；**只返回 JSON**，不要 Markdown 代码块、不要前后解释文字。

字段书写要求：
- industry_insight：首段 1～2 句话必须说明「本次画布所假设的组织形态与主要交付方式」（例如：集团某事业部 / 项目制外包团队 / 产品型 SaaS 等）；其后写行业与赛道洞察、准入与数字化趋势。
- 其余各格：用完整中文句子或要点列表均可，但需与上述形态一致、彼此自洽。
- pain_points：至少 3 条；需覆盖与该形态相关的数字化/协作/治理风险。除制造/运营类外，可按证据纳入：交付与需求变更、回款与现金流、人才与关键岗位、安全与合规、对外部平台/API/云厂商依赖、数据与知识管理、多项目并行与产能等（择 relevant 者，勿堆砌无关项）。

{
  "industry_insight": "……",
  "customer_segments": "客户细分 (CS)：……",
  "value_propositions": "价值主张 (VP)：……",
  "channels": "渠道通路 (CH)：……",
  "customer_relationships": "客户关系 (CR)：……",
  "revenue_streams": "收入来源 (RS)：……",
  "key_resources": "核心资源 (KR)：……",
  "key_activities": "关键业务 (KA)：……",
  "key_partnerships": "重要合作 (KP)：……",
  "cost_structure": "成本结构 (CS)：……",
  "pain_points": "……"
}`;

  /**
   * 设计详情页：在用户提供工商/经营范围类描述后生成 BMC（JSON）。
   * @param {{ basicInfo?: object, preliminaryReq?: object|null, userSupplementText: string }} ctx
   * @returns {Promise<{ parsed: object, usage: object, model: string, durationMs: number, fullPrompt: string, rawOutput: string }>}
   */
  async function generateDesignDetailBmcFromContext(ctx) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const basicStr = JSON.stringify((ctx && ctx.basicInfo) || {}, null, 2);
    const prelim =
      ctx && ctx.preliminaryReq != null && typeof ctx.preliminaryReq === 'object' && Object.keys(ctx.preliminaryReq).length > 0
        ? JSON.stringify(ctx.preliminaryReq, null, 2)
        : '（无）';
    const sup = String((ctx && ctx.userSupplementText) || '').trim() || '（无）';
    const inputStr =
      `【客户基础信息】\n${basicStr}\n\n【初步需求/总结提炼】\n${prelim}\n\n【用户在任务进展中补充的工商及经营范围相关描述】\n${sup}`;
    const fullPrompt = `【system】\n${DESIGN_DETAIL_BMC_SYSTEM_PROMPT}\n\n【user】\n${inputStr}`;
    const { content, usage, model, durationMs } = await fetchDeepSeekChat([
      { role: 'system', content: DESIGN_DETAIL_BMC_SYSTEM_PROMPT },
      { role: 'user', content: inputStr },
    ]);
    const raw = String(content || '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    const parsed = parseTask1LlmJsonOrThrow(String(jsonStr), '设计详情 BMC 生成');
    return { parsed, usage, model, durationMs, fullPrompt, rawOutput: jsonStr };
  }

  /** 设计详情页 task1：聊天 `task1LlmQueryBlock` 备注名（经营信息提炼） */
  const DESIGN_DETAIL_BUSINESS_EXTRACT_NOTE_NAME = '设计详情经营信息提炼';

  const DESIGN_DETAIL_BUSINESS_EXTRACT_SYSTEM_PROMPT = `你是一个专业的企业信息提取助手，请从用户反馈的工商经营信息提炼出以下字段，以 JSON 格式返回，不要包含其他内容：

{
  "company_name": "企业名称/公司名称",
  "credit_code": "统一社会信用代码",
  "legal_representative": "法定代表人",
  "established_date": "成立日期",
  "registered_capital": "注册资本",
  "is_listed": "是否上市",
  "listing_location": "上市地点",
  "business_scope": "经营范围",
  "core_qualifications": "核心资质",
  "official_website": "官网"
}

如果某字段无法从输入中推断，该字段填 "" 或 "—"。只返回 JSON，不要有 markdown 代码块包裹。`;

  /**
   * 设计详情页：用户返回工商及经营范围后，按专用 system 提示词提炼结构化字段（与主站 `parseCompanyBasicInfoInput` 文案分离）。
   * @param {string} text - 用户输入
   * @returns {Promise<Task1BasicInfoLlmResult>}
   */
  async function extractDesignDetailBusinessInfoFromUserFeedback(text) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const { content, usage, model, durationMs } = await fetchDeepSeekChat([
      { role: 'system', content: DESIGN_DETAIL_BUSINESS_EXTRACT_SYSTEM_PROMPT },
      { role: 'user', content: text },
    ]);
    const jsonMatch = String(content || '').trim().match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : String(content || '').trim();
    const parsed = parseTask1LlmJsonOrThrow(String(jsonStr), '设计详情经营信息提炼');
    const fullPrompt = `【system】\n${DESIGN_DETAIL_BUSINESS_EXTRACT_SYSTEM_PROMPT}\n\n【user】\n${text}`;
    return { parsed, usage, model, durationMs, fullPrompt, rawOutput: jsonStr };
  }

  global.parseCompanyBasicInfoInput = parseCompanyBasicInfoInput;
  global.buildTask1LlmQueryMessage = buildTask1LlmQueryMessage;
  global.generateDesignDetailBmcFromContext = generateDesignDetailBmcFromContext;
  global.DESIGN_DETAIL_BMC_NOTE_NAME = DESIGN_DETAIL_BMC_NOTE_NAME;
  global.extractDesignDetailBusinessInfoFromUserFeedback = extractDesignDetailBusinessInfoFromUserFeedback;
  global.DESIGN_DETAIL_BUSINESS_EXTRACT_NOTE_NAME = DESIGN_DETAIL_BUSINESS_EXTRACT_NOTE_NAME;

  /** 设计详情页 task1：L1 原始实然特征集（`L1_Original_Feature_Matrix` + 行级 `Validation_Status: Pending`） */
  const DESIGN_DETAIL_L1_ORIGINAL_FEATURE_NOTE_NAME = '设计详情原始实然特征集提炼';

  /**
   * 设计详情任务 1：原始实然特征集提炼（输出 `L1_Original_Feature_Matrix` JSON）。
   * @param {{ task1L1OriginalFeatureUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL1OriginalFeatureFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L1_ORIGINAL_FEATURE_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L1_ORIGINAL_FEATURE_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task1L1OriginalFeatureUserBlock === 'string') {
      userBlock = String(payload.task1L1OriginalFeatureUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('task1L1OriginalFeatureUserBlock 为空');
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  global.inferDesignDetailL1OriginalFeatureFromContext = inferDesignDetailL1OriginalFeatureFromContext;
  global.DESIGN_DETAIL_L1_ORIGINAL_FEATURE_NOTE_NAME = DESIGN_DETAIL_L1_ORIGINAL_FEATURE_NOTE_NAME;

  /** 设计详情页 task1：聊天 `task1LlmQueryBlock` 备注名（客户需求提炼） */
  const DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE_NAME = '设计详情客户需求提炼';

  const DESIGN_DETAIL_CUSTOMER_REQUIREMENT_SYSTEM_PROMPT = "# Role\n你是一位精通多租户架构、集团管控与领域驱动设计（DDD）的资深需求分析专家。你的任务是将杂乱的客户原始需求，转化为具备“对象生命周期”、“状态机驱动”与“多级组织能力”的结构化需求底座。\n\n# Task\n请严格按以下 JSON 结构输出。在提取时，必须横向覆盖组织/IT/痛点，纵向穿透业务对象的“招募/准入 -> 运行/交付 -> 结算/退出”全生命周期，并深度解析状态转移背后的规则。\n\n# Output JSON Structure\n{\n  \"businessContext\": {\n    \"clientName\": \"企业/项目名称\",\n    \"industryDomain\": \"所属行业及核心商业模式\",\n    \"orgTopology\": {\n      \"type\": \"单体 / 集团-分子 / 总部-加盟 / 区域矩阵\",\n      \"scale\": \"当前规模及未来扩张计划\",\n      \"dataIsolation\": \"数据隔离与审计汇总需求\",\n      \"managementDepth\": \"管理层级定义\"\n    }\n  },\n  \"coreBusinessEntities\": [\n    {\n      \"entityName\": \"核心业务对象（如：个体学员所有权、培训合同）\",\n      \"identifier\": \"唯一性识别标识（如：微信号、身份证号、订单号）\",\n      \"conceptCategory\": \"人 | 财 | 物 | 事（四选一：人=人员/角色/组织关系；财=资金/对账/结算；物=实物或数字化资产/载体；事=流程/事项/合约等业务事件或抽象对象）\",\n      \"conceptExplanation\": \"100 字以内、一至两句完整中文句（句末须为 。 ！ ？ 或 ；），结合客户原文说明该对象在场景中的含义；禁止半截词/半截句，禁止只写抽象架构词\",\n      \"lifecycleStates\": [\"识别出的所有名词状态，如：潜在、正式、睡眠、冲突\"],\n      \"ownershipLogic\": \"该对象归属于谁？如何界定归属权？\"\n    }\n  ],\n  \"stateTransitionMatrix\": [\n    {\n      \"entity\": \"关联业务对象\",\n      \"fromState\": \"起始状态\",\n      \"toState\": \"目标状态\",\n      \"triggerEvent\": \"动作或事件（如：提交结单、到期未复购）\",\n      \"actor\": \"执行角色\",\n      \"guards\": \"准入守卫逻辑（必须满足什么条件才能跳转，如：检查是否他人所有）\",\n      \"sideEffects\": {\n        \"financeImpact\": \"利益分配逻辑（包含具体分成比例、补偿金计算公式）\",\n        \"timeImpact\": \"效期延展逻辑（Expiry Date 如何更新）\",\n        \"dataSnapshot\": \"是否需要留痕/生成审计记录\"\n      }\n    }\n  ],\n  \"corePainPointSummary\": \"核心痛点总结（归纳客户现状、核心矛盾与关键痛点的总述段落）\",\n  \"painPointRadar\": [\n    {\n      \"dimension\": \"人/财/物/事/系统/管控\",\n      \"description\": \"痛点具体表现\",\n      \"itGap\": \"现有工具在多级协同或状态流转自动执行上的缺失\"\n    }\n  ],\n  \"itLandscape\": {\n    \"legacySystems\": [\"旧系统及局限性\"],\n    \"integrationRequirements\": [\"必须打通的三方生态\"],\n    \"deploymentMode\": \"SaaS / 私有化 / 混合云\"\n  },\n  \"existingSpreadsheets\": [\n    { \"tableName\": \"前线接单与订单业务表\", \"columnHeaders\": [\"配方编号\", \"客户自定义色号\"] }\n  ],\n  \"operationModel\": {\n    \"orgAndRoles\": {\n      \"stakeholders\": [\"总部角色：岗位A、岗位B（仅列举下文「可引用角色池」中已出现的称谓）\", \"分支角色：岗位C、岗位D\"],\n      \"governanceLogic\": \"总部与分支的权责边界（统分逻辑）\",\n      \"incentiveHooks\": \"跨组织的激励与利益分配逻辑（如授权费、跨分支分润）\"\n    },\n    \"fullValueStreams\": [\n      {\n        \"domain\": \"业务域（如：招募认证、销售运营、财务结算）\",\n        \"processName\": \"流程名称\",\n        \"nodes\": \"【节点1】→【节点2】→...\",\n        \"actor\": \"主责角色\",\n        \"scope\": \"组织覆盖范围（全集团/单校区/跨分支）\",\n        \"logicAndRules\": \"业务规则、准入门槛或审批逻辑\",\n        \"dataAsset\": \"产生的单据/数据（标注是否有组织标识）\"\n      }\n    ]\n  },\n  \"managementResources\": {\n    \"peopleResource\": \"资质认证、多点执业、角色等级成长需求\",\n    \"financeResource\": \"多级结算、预算管控、资金归集、分润划拨需求\",\n    \"assetResource\": \"实物/数字资产分布与借调\",\n    \"informationAsset\": \"知识库授权、各级看板监控需求\"\n  },\n  \"roadmap\": {\n    \"phase1_Critical\": { \"focus\": \"核心战役\", \"deliverables\": [\"功能点\"] },\n    \"phase2_Strategic\": { \"focus\": \"后续优化\" },\n    \"overallUrgency\": \"判定理由\"\n  }\n}\n\n# Constraints (硬性约束)\n1. **状态机驱动**：必须识别对象的生命周期。所有状态变迁必须关联“钱”的流向（分成、补偿、扣费）和“时间”的变动（有效期延展）。\n2. **多维度扫描**：强制识别并提取“人”的准入（招募、签约）和“钱”的闭环（下单、分润结算）。\n3. **组织敏感性**：所有对象必须判断“组织标识”。涉及分成需明确是“个人间补偿”还是“跨机构结算”。\n4. **推演补全**：根据文档描述（如“全国6城”）自动推演 orgTopology；根据利益描述自动推演 financeResource 需求。\n5. **缺失处理**：若某维度完全未提及，在该维度对应字段填入 \"NOT_SPECIFIED\" 或省略该键（勿编造）。\n6. **纯净输出**：仅返回 JSON 纯文本（不要 Markdown 代码围栏、不要前言/后记说明）。\n7. **人员组织与对象—状态口径一致（硬性）**：输出须**自洽**。在写 `operationModel.orgAndRoles` 前，先在**同一份 JSON** 中写清 `coreBusinessEntities`（各条 `entityName`、`conceptCategory`、`conceptExplanation`、`ownershipLogic` 等全文）、`stateTransitionMatrix`（每条 `actor`）、`operationModel.fullValueStreams`（每条 `actor`）。将上述四处文本中出现的**干系人/岗位/角色称谓**归并为**可引用角色池**（去同义重复）。`stakeholders` 中每一条（含「标题：正文」格式时**冒号后的正文**）所列举的**每一个具体岗位或角色称谓**，必须能在**可引用角色池**中找到相同或明确同义表述；**禁止**输出池中不存在的称谓，**禁止**凭常识臆造原文与上述字段均未支撑的角色。\n8. **人员组织去重与结构（硬性）**：`stakeholders` 为字符串数组；**同一角色称谓不得在多条条目中重复出现**。「总部角色」「分支角色」等组织侧维度**各至多一条**；若原文对同一维度多次描述，须**合并为一条**，文内角色列表用顿号或逗号并列且**去重**。**禁止**用多条同标题或近义标题（如两条「分支角色」）重复罗列。\n9. **核心对象概念维度（硬性）**：`coreBusinessEntities` **每一条**须含 `conceptCategory` 与 `conceptExplanation`。`conceptCategory` 只能是 **「人」「财」「物」「事」** 之一；无法明确归类时用 **「事」**。`conceptExplanation` 为 **100 个字符以内**（按 Unicode 标量计，含标点），须写成 **完整句子**：**禁止**在词或句子中间截断（句末须为 **。**、**！**、**？** 或 **；** 之一，允许一至两句）；须**引用客户需求中的场景信息**说明该对象在业务里是什么、起何作用；**禁止**仅用「实体层」「领域对象」等空洞架构词而无场景。\n10. **JSON 语法（硬性）**：输出必须是单个可解析对象。键名与字符串边界仅使用 ASCII 双引号 \"。字符串内引用优先用中文「」。禁止在值内出现未转义的 \"。元素分隔仅使用英文逗号 ,。\n11. **核心痛点位置（硬性）**：客户现状与核心矛盾须写入 JSON **顶层**字段 \`corePainPointSummary\`（与 \`painPointRadar\` 配套）；**禁止**在 \`businessContext\` 内输出 \`businessStatus\` 或「现状与核心矛盾」等同义子字段（已废弃；下游推理图仅通过 \`痛点雷达/核心痛点总结\` token 挂载）。\n12. **现有表格（硬性）**：仅当用户在【用户输入的客户需求】中**明确点名每一张表的业务表名**，且在同一句或相邻结构中给出该表的**字段/列清单**时，才写入顶层 \`existingSpreadsheets\`（每项 \`{ tableName, columnHeaders[] }\`）。可识别的原文形态示例：\`《订单主表》：（字段）\`、\`「配方主数据表」：（字段）\`、\`配方主数据表：（字段）\`、\`数据表 2-密炼排产台账：（字段）\`（连字符后须为**具体表名**，非纯编号）。**禁止**：仅凭字段语义、业务场景或 Excel/台账等笼统描述**推测/编造**表名；禁止输出「数据表 1」「数据表 2」等纯编号占位；禁止在用户**未给出具名表**时输出 \`existingSpreadsheets\`（可省略该键）。\`tableName\` 须**取自用户原文中的表名表述**（仅可做全角/半角与空白规整，不得改写为系统归纳名）。字段以逗号/顿号/分号分隔。\n";

  /** 与后端 `design-detail-existing-spreadsheet-parse.ts` 同口径（须同步维护） */
  function isGenericSpreadsheetTablePlaceholder(name) {
    const compact = String(name || '')
      .trim()
      .replace(/\s+/g, '');
    if (!compact || compact === '数据表') return true;
    return /^数据表[\d０-９一二三四五六七八九十百千]+$/.test(compact);
  }

  /** 是否为可用于落库的具名表（非「数据表 N」类占位） */
  function isExplicitExistingSpreadsheetTableName(name) {
    const tn = String(name || '').trim();
    if (!tn || isGenericSpreadsheetTablePlaceholder(tn)) return false;
    return true;
  }

  function refineExistingSpreadsheetTableNames(rows) {
    return (rows || [])
      .map((row) => ({
        tableName: String(row.tableName || '').trim(),
        columnHeaders: row.columnHeaders || [],
      }))
      .filter((row) => isExplicitExistingSpreadsheetTableName(row.tableName) && row.columnHeaders.length > 0);
  }

  function splitSpreadsheetFieldList(blob) {
    return String(blob || '')
      .split(/[,，、;；]\s*/u)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function headersSignature(headers) {
    return [...headers].sort().join('\u0001');
  }

  function ingestSpreadsheetRow(order, buckets, tableName, headers) {
    const tn = String(tableName || '').trim();
    const parts = (headers || []).map((h) => String(h || '').trim()).filter(Boolean);
    if (!tn || !parts.length) return;
    const sig = headersSignature(parts);
    const existing = buckets.get(sig);
    if (!existing) {
      buckets.set(sig, { tableName: tn, columnHeaders: [...parts] });
      order.push(sig);
      return;
    }
    if (isGenericSpreadsheetTablePlaceholder(existing.tableName) && !isGenericSpreadsheetTablePlaceholder(tn)) {
      existing.tableName = tn;
    }
    for (const p of parts) {
      if (!existing.columnHeaders.includes(p)) existing.columnHeaders.push(p);
    }
  }

  function ingestSpreadsheetBlock(order, buckets, tableName, fieldBlob) {
    ingestSpreadsheetRow(order, buckets, tableName, splitSpreadsheetFieldList(fieldBlob));
  }

  /**
   * 从用户需求原文解析现有表格块（仅具名：《》/「」/ 业务表名：（字段）/ 数据表 N-具体名称：（字段））。
   * @param {string} text
   * @returns {Array<{ tableName: string, columnHeaders: string[] }>}
   */
  function parseExistingSpreadsheetsFromRequirementText(text) {
    const raw = String(text || '');
    if (!raw.trim()) return [];
    const order = [];
    const buckets = new Map();
    const consumed = [];

    const markConsumed = (m) => {
      consumed.push({ start: m.index, end: m.index + m[0].length });
    };
    const overlapsConsumed = (index, len) => {
      const end = index + len;
      return consumed.some((c) => index < c.end && end > c.start);
    };

    const bookTitleRe = /《([^》]{2,48})》\s*[:：]\s*[（(]([^）)]*)[）)]/gu;
    let m;
    while ((m = bookTitleRe.exec(raw)) !== null) {
      markConsumed(m);
      ingestSpreadsheetBlock(order, buckets, m[1], m[2]);
    }

    const quoteRe = /「([^」]{2,48})」\s*[:：]\s*[（(]([^）)]*)[）)]/gu;
    while ((m = quoteRe.exec(raw)) !== null) {
      if (overlapsConsumed(m.index, m[0].length)) continue;
      markConsumed(m);
      ingestSpreadsheetBlock(order, buckets, m[1], m[2]);
    }

    const numberedNamedRe =
      /数据表\s*([\d０-９一二三四五六七八九十百千]+)\s*[-—－·]\s*([^\s：:（(\n]{2,48})\s*[:：]\s*[（(]([^）)]*)[）)]/gu;
    while ((m = numberedNamedRe.exec(raw)) !== null) {
      if (overlapsConsumed(m.index, m[0].length)) continue;
      markConsumed(m);
      ingestSpreadsheetBlock(order, buckets, String(m[2]).trim(), m[3]);
    }

    const namedSuffixRe =
      /(?:^|[；;\n\r])([^；;\n\r]{2,48}?(?:表|台账|清单|明细|主数据|报表))\s*[:：]\s*[（(]([^）)]*)[）)]/gu;
    while ((m = namedSuffixRe.exec(raw)) !== null) {
      if (overlapsConsumed(m.index, m[0].length)) continue;
      const name = String(m[1] || '').trim();
      if (isGenericSpreadsheetTablePlaceholder(name)) continue;
      markConsumed(m);
      ingestSpreadsheetBlock(order, buckets, name, m[2]);
    }

    const rows = order.map((sig) => buckets.get(sig));
    return refineExistingSpreadsheetTableNames(rows);
  }

  /**
   * 正文解析与 LLM `existingSpreadsheets` 按字段集合并；优先保留非占位 tableName。
   * @param {Object} parsed
   * @param {Array<{ tableName: string, columnHeaders: string[] }>} fromText
   * @returns {Object}
   */
  function mergeExistingSpreadsheetsIntoParsed(parsed, fromText) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;
    const out = { ...parsed };
    const llmList = [];
    if (Array.isArray(out.existingSpreadsheets)) {
      for (const item of out.existingSpreadsheets) {
        if (!item || typeof item !== 'object') continue;
        const tableName = typeof item.tableName === 'string' ? item.tableName.trim() : '';
        const headers = Array.isArray(item.columnHeaders)
          ? item.columnHeaders
              .map((x) => (typeof x === 'string' ? x.trim() : ''))
              .filter(Boolean)
          : [];
        if (tableName && headers.length && isExplicitExistingSpreadsheetTableName(tableName)) {
          llmList.push({ tableName, columnHeaders: headers });
        }
      }
    }
    const order = [];
    const buckets = new Map();
    for (const row of llmList) ingestSpreadsheetRow(order, buckets, row.tableName, row.columnHeaders);
    for (const row of fromText || []) ingestSpreadsheetRow(order, buckets, row.tableName, row.columnHeaders);
    let arr = order.map((sig) => buckets.get(sig));
    arr = refineExistingSpreadsheetTableNames(arr);
    if (arr.length) out.existingSpreadsheets = arr;
    else delete out.existingSpreadsheets;
    return out;
  }

  /**
   * 设计详情客户需求提炼：剥离 `businessContext` 内已废弃字段，并将遗留 `businessStatus` 上移至顶层 `corePainPointSummary`。
   * @param {Object} parsed
   * @returns {Object}
   */
  function sanitizeDesignDetailCustomerRequirementParsed(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;
    const out = { ...parsed };
    const bc = out.businessContext;
    if (bc && typeof bc === 'object' && !Array.isArray(bc)) {
      const legacy = String(bc.businessStatus ?? '').trim();
      if (legacy && !String(out.corePainPointSummary ?? '').trim()) {
        out.corePainPointSummary = legacy;
      }
      const cleaned = { ...bc };
      delete cleaned.businessStatus;
      delete cleaned.digitalMaturity;
      out.businessContext = cleaned;
    }
    delete out.analystNotes;
    return out;
  }

  /**
   * 设计详情页：在客户基础信息 JSON 已就绪后，根据用户自然语言需求做结构化提炼。
   * @param {string} userText - 用户输入的需求原文
   * @param {string} basicInfoJsonStr - 已提炼客户基础信息 JSON 字符串（可为 "{}"）
   */
  async function extractDesignDetailCustomerRequirementFromUserFeedback(userText, basicInfoJsonStr) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const bi = String(basicInfoJsonStr || '').trim() || '{}';
    const ut = String(userText || '').trim();
    const userBlock = `【已提炼客户基础信息（JSON）】\n${bi}\n\n【用户输入的客户需求】\n${ut}`;
    const { content, usage, model, durationMs } = await fetchDeepSeekChat([
      { role: 'system', content: DESIGN_DETAIL_CUSTOMER_REQUIREMENT_SYSTEM_PROMPT },
      { role: 'user', content: userBlock },
    ]);
    const jsonMatch = String(content || '').trim().match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : String(content || '').trim();
    let parsed = sanitizeDesignDetailCustomerRequirementParsed(
      parseTask1LlmJsonOrThrow(String(jsonStr), '设计详情客户需求提炼'),
    );
    const fromText = parseExistingSpreadsheetsFromRequirementText(ut);
    parsed = mergeExistingSpreadsheetsIntoParsed(parsed, fromText);
    const fullPrompt = `【system】\n${DESIGN_DETAIL_CUSTOMER_REQUIREMENT_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { parsed, usage, model, durationMs, fullPrompt, rawOutput: jsonStr };
  }

  /**
   * 设计详情「合并需求」：对同一 token 维度下两段文本做大模型去重合并（供 `ProblemCaseLlmLog`：`taskId`=合并需求#序号，`callTarget`=合并#token）。
   * 须在调用外层使用 `SmartCto.designDetailLlmLogContext`（由 Vue `withDesignDetailLlmLogContext` 注入）。
   * @param {{ tokenSurface: string, tabLabel: string, textA: string, textB: string }} opts
   * @returns {Promise<{ mergedText: string, usage: Object, model: string, durationMs: number, fullPrompt: string, rawOutput: string }>}
   */
  async function summarizeDesignDetailRequirementMergeByLlm(opts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const tokenSurface = String(opts && opts.tokenSurface ? opts.tokenSurface : '').trim() || '（未命名维度）';
    const tabLabel = String(opts && opts.tabLabel ? opts.tabLabel : '').trim() || '需求分域';
    const textA = String(opts && opts.textA != null ? opts.textA : '');
    const textB = String(opts && opts.textB != null ? opts.textB : '');
    const mergeSystem = `你是资深需求分析师。用户将提供两段针对**同一需求维度**的文字（可能来自多轮需求提炼），请你合并为**一段**连贯中文正文：
1）相同或等价内容去重合并，避免啰嗦重复；
2）互补信息全部保留；
3）若有冲突，简要并列说明不同表述（可用分号）；
4）仅输出合并后的正文，不要 Markdown 代码围栏、不要 JSON、不要以「合并后：」等前缀起笔，不要生成「【并入】」字样。`;
    const user = `维度路径：${tokenSurface}\n所属分域：${tabLabel}\n\n【版本 A】\n${textA}\n\n【版本 B】\n${textB}`;
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: mergeSystem },
        { role: 'user', content: user },
      ],
      {
        taskTag: 'design-detail-req-merge',
        maxOutputTokens: 8192,
        timeoutMs: 180000,
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${mergeSystem}\n\n【user】\n${user}`;
    const fallbackConcat = `${String(textA).trim()}\n\n【并入】\n\n${String(textB).trim()}`;
    const mergedText = raw || fallbackConcat;
    return { mergedText, usage, model, durationMs, fullPrompt, rawOutput: String(content || '') };
  }

  global.extractDesignDetailCustomerRequirementFromUserFeedback = extractDesignDetailCustomerRequirementFromUserFeedback;
  global.parseExistingSpreadsheetsFromRequirementText = parseExistingSpreadsheetsFromRequirementText;
  global.DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE_NAME = DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE_NAME;
  global.summarizeDesignDetailRequirementMergeByLlm = summarizeDesignDetailRequirementMergeByLlm;

  /**
   * 各任务 `Token_Validation_Mapping` 共用：反向验证仅指向任务 1 原始 Feature，不校验中间推理层节点。
   */
  const DESIGN_DETAIL_REVERSE_VALIDATION_SCOPE_RULE = `【反向验证范围（硬性）】仅校验 **任务 1 原始业务背景** 上的 Feature 节点（客户直述的实然 Token）。**Target_FeatureID** 必须逐字来自任务 1 对应 user 段 TSV **第一列 FeatureID**。**严禁**使用任务 2/3/4/5 等任意中间推理层 Feature 节点 id，或推理结论字段名（如组织模式、合规约束等级、核心价值驱动、价值流阶段_* 等）充当 Target_FeatureID。落库有向边：**本步 Mapped_*_Feature 所锚定的本批推理特征 → 任务 1 目标特征**。`;

  /**
   * 全链路深访闭环：对齐问卷生成（任务 2/3/4 及未来 L1~L5 共用）。
   * user 由 `buildAlignmentQuestionnaireUserBlock`（`designDetailAlignmentQuestionnaireInput.ts`）拼装 JSON。
   */
  const DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT = `# Role
你是一位精通企业数字化转型与全链路需求工程的资深商业咨询顾问 Agent。你擅长将系统各层级（L1~L5）中复杂的、干瘪的逻辑不一致性（Potential Conflict），转化为大方、得体、且具备高度专业洞察力的直接提问，引导客户在不知不觉中补全深访背景。

# Task
请基于提供的【Input Data：全链路通用潜在冲突数据集】，生成一份逻辑清晰、表达简练且专业度极高的“客户对齐询问清单”。
你必须将后台检测出的每一条冲突记录，合并并翻译为一气呵成、情商极高的顾问直问，由你作为 Agent 直接向用户口述或展示。

# Input Data (全链路通用结构化数据源输入接口)
以下是推理引擎在任意任务层级（L1~L5）筛选出的 \`Consistency == "潜在冲突"\` 的通用结构化记录：
\`\`\`json
[
  {
    "Target_FeatureID": "\${FeatureID：必须为 **任务 1 原始业务背景** Feature 节点 id（与 TVM 中 Target_FeatureID 一致）；**禁止**填任务 2/3/4/5 推理层节点 id}",
    "Client_Fact_Token": "\${客户现状事实：任务 1 上该 Feature 的实然 Token 文本（Token_Str），非中间层推理结论字段名}",
    "Anchor_Model_Feature": "\${锚定模型特征：当前层级系统推导出的应然业务模型特征名称}",
    "Conflict_Causality_Logic": "\${冲突因果逻辑：系统判定当前实然现状与应然模型不自洽的推导理由与商业背景说明}",
    "Raw_Verification_Pivot": "\${原始验证支点：基于该冲突点衍生出的原始干瘪提问或确认核心}",
    "Consistency": "潜在冲突"
  }
]
\`\`\`
（实际 user 消息中将为已填充真实值的 JSON 数组，请逐条处理。）

# Questionnaire Generation Principles
1. 严格禁止“上帝视角”穿帮：在生成的提问中，绝对不能出现“根据系统推理”、“返回的JSON显示”、“由于 Anchor_Feature 是...”等任何带有技术、系统、后台开发或模型推导痕迹的词汇。
2. **反向验证节点口径**：**Target_FeatureID** / **Client_Fact_Token** 仅指 **任务 1 原始业务背景** 上的客户实然 Feature；**Anchor_Model_Feature** 指 **当前推理任务** 本步推导结论（Mapped_*_Feature）。提问时引述的「客户原话」必须来自 Client_Fact_Token，不得把中间层推理字段（如合规约束等级、核心价值驱动）说成客户亲口描述。
3. 严格区分“实然（现状）”与“应然（洞察）”的口吻：
	- 实然（指 Client_Fact_Token）：对此，你必须用 “关于您提到的……”、“您反馈的现状……” 来礼貌引述客户提供的事实。
	- 应然（指 Conflict_Causality_Logic 中系统推算出来的商业本质）：这是系统在后台计算出来的，绝对不能说是客户自己提的。你必须以分析师自身的主观专业洞察口吻强行切入，使用 “我认为咱们的业务核心应该更侧重于……”、“从咱们的商业模式来看，我们的焦点更偏向于……” 来表达。
4. 通用去术语化机制：不论输入数据来自哪一层（L1~L5），必须自动将系统建模术语转化为客户听得懂的商业语言：
	- L1/L2 术语转化：“合规约束等级” → “业务安全/监管要求”；“组织拓扑” → “部门协作/汇报模式”。
	- L3/L4 术语转化：“过程控制密度” → “审批卡控力度”；“状态转移矩阵/生命周期” → “单据流转阶段/业务跟进节点”。
	- L5 术语转化：“物理 Schema/元数据” → “表单核心字段/底层核心数据项”。
5. 高情商话术“钢印结构”：每个冲突项直接列出问题（无需给分析师的现场建议）。话术必须一气呵成合为一段，严格遵循以下三段式结构：
	- [礼貌切入并引述客户的原话现状（实然）] + [表达分析师对于其商业本质的专业洞察与挑战（应然）] + [抛出方向明确的“二选一”或“程度确认”选择题，引导用户做决策]。

# Dynamic Header Logic (动态头部选择逻辑)
你必须仔细检查 # Input Data 中 JSON 数组的记录条数（即不一致性的数量），并严格按照以下规则生成问卷的开头导语：
1. 规则 1【单处不一致】：如果 Input Data 中只有 1 条冲突记录，开头导语必须完全固定为：我有一个疑问需要向您进一步确认：
2. 规则 2【多处不一致】：如果 Input Data 中包含 2 条或 2 条以上冲突记录，开头导语必须完全固定为：基于刚才的业务信息扫描，我发现了几处关键的业务逻辑衔接点需要向您进一步确认，以确保系统底层设计的精准度。

# 全链路跨层级应用示例 (Few-Shots - 严禁删除任何层级示例)
## 📌 示例 1（应用于 L1 实体画像层冲突）
### Input Data:
	- {"Client_Fact_Token": "各地分公司自主决定大额开支，无需向总部报备", "Anchor_Model_Feature": "组织管控拓扑", "Conflict_Causality_Logic": "企业本身具备跨境跨地区的外资集团背景，且涉及高额注册资本，组织拓扑上应属于强集团管控。分公司完全游离在集团外会导致财税审计高风险。"}
### Agent 实际输出:
	- 您好，关于您反馈的现状“各地分公司自主决定大额开支，无需向总部报备”，我有个疑问：从咱们整体的集团治理与外资审计安全来看，多机构运营往往更需要倾向于集团集中管控，以规避资金离散风险。那么，在后续规划中，您更倾向于将大额资金权限收拢回总部进行统一在线审批，还是由于地方业务差异极大，目前阶段仍需维持其高度的自主性，第一期仅做资金存量登记？

## 📌 示例 2（应用于 L2 业务底色层冲突）
### Input Data:
		- {"Client_Fact_Token": "会议室预约后未使用无有效管控，导致资源闲置", "Anchor_Model_Feature": "业务价值焦点", "Conflict_Causality_Logic": "业务价值焦点是溢价能力与客户满意度，资源闲置增加持有成本，但并非核心利润流失的矛盾点。"}
### Agent 实际输出:
	- 您好，关于您提到的“会议室预约后未使用无有效管控，导致资源闲置”的需求，我有个疑问：我认为咱们业务价值焦点是溢价能力与客户满意度，因此，资源闲置虽增加成本但并非核心矛盾。那么，在资源闲置管理上，您更倾向于将其作为次要优化项，通过现有流程的自动化附带解决，还是需要系统单独设立预警与调度模块来主动管控？

## 📌 示例 3（应用于 L3 流程骨干与 VSM 层冲突）
### Input Data:
	- {"Client_Fact_Token": "业务流程全靠微信口头对接，不希望设置任何复杂的评审环节", "Anchor_Model_Feature": "过程控制密度", "Conflict_Causality_Logic": "上游业务底色判定企业核心资产属于极度依赖专家经验和设计质量的智力资产，流程模式应为‘反馈迭代流程’。缺乏核心评审闸口将直接摧毁最终交付质量。"}
### Agent 实际输出:
	- 您好，关于您提到的“业务流程全靠微信口头对接，不希望设置任何复杂的评审环节”，我有个疑问：由于咱们的产品研发极度依赖专家经验与交付质量，我认为在流程的关键节点上必须设置必要的质量评审卡点。那么，在流程卡控力度上，您更倾向于“在系统关键节点配置标准评审闸口”以硬性保障质量，还是由于前线追求极致效率，更希望在流程中不做任何阻拦，仅在交付后由专家进行结果抽查追溯？

## 📌 示例 4（应用于 L4 业务原型层冲突）
### Input Data:
	- {"Client_Fact_Token": "合同审批通过后可以随时被销售直接修改内容", "Anchor_Model_Feature": "合同状态机控制等级", "Conflict_Causality_Logic": "上游 L1 判定外部合规监管等级极高，审批通过的合同单据状态应立刻锁定进入‘冻结’状态，随时修改会导致合规穿帮。"}
### Agent 实际输出:
	- 您好，关于您反馈的现状“合同审批通过后可以随时被销售直接修改内容”，我有个疑问：从咱们整体的业务安全与监管要求来看，合同一经审批通过，其状态理应立刻锁定以确保合规数据无法被篡改。那么，在后续单据流转设计中，您更倾向于“严格执行审批后状态冻结、任何修改必须重新走变更流程”的模式，还是由于前线业务变更过于高频，需要维持当前随时可改的现状，并在系统后台静默记录修改日志以备审计？

## 📌 示例 5（应用于 L5 数据蓝图层冲突）
### Input Data:
	- {"Client_Fact_Token": "客户档案表里必须包含：客户生日、结婚纪念日、子女年龄、最喜欢的菜系", "Anchor_Model_Feature": "数据项精简度与隐私合规范围", "Conflict_Causality_Logic": "企业商业底色属于典型的大宗原材料 B2B 工业级订单交付，而非 B2C 强情感连接的会员运营。采集极度私密且低频的个人生活特征字段，严重背离了工业级表单设计的高效原则。"}
### Agent 实际输出:
	- 您好，关于您提到的“客户档案表里必须包含生日、纪念日、子女及菜系等精细背景”的表单需求，我有个疑问：由于咱们企业属于典型的大宗工业级采购模式，我认为商务沟通的核心和底层数据基础更应聚焦于企业的资信和商务条款。那么，在客户档案的核心数据项采集上，您更倾向于精简表单，只保留关键商务字段以提升前线录入效率，还是由于贵司具备极其独特的强情感驱动销售文化，必须保留这些非标生活特征项？
	
# Output Format (Strict Markdown)
请直接输出面向客户的直问问题清单。
🎯 需求深度对齐确认
[在此根据【Dynamic Header Logic】动态生成对应的开场导语文本，严禁错记漏记]
1. [业务模块名称，根据冲突内容智能拟定，如：审批流程与安全合规]
[严格按照“三段式钢印结构”生成的直问话术，一气扼成合为一段，严禁拆分小标题。]
2. [业务模块名称，如有多条记录则依次列出]
[同上，严格执行引述现状、抛出洞察、二选一引导的话术。]

(提示：您的回复将直接作为深访洞察合入系统，影响后续业务原型和功能模块的精准推导。)

仅输出 Markdown 正文，不要 JSON 代码围栏、不要前言“以下是”之类套话。`;

  /**
   * 任务 6.5 子任务 IT-Gap 对齐问卷：在通用问卷规则上强调「只问客观业务事实、禁止 IT 产品名」。
   */
  const DESIGN_DETAIL_TASK65_IT_GAP_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT = `${DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT}

# Task 6.5 IT-Gap 附加约束（优先级高于通用 L3 术语转化）
1. **只收集客观数据**：问题应聚焦客户能直接回答的业务事实——例如单据量级、是否手工台账、是否多分支并行、审批有几级、是否跨部门交接、出错后如何补救等。不要询问或暗示具体软件选型、平台名称、数据库/接口/Schema 设计。
2. **禁止 IT 产品与技术名词**：输出中不得出现任何具体产品名、厂商名、组件名，以及 Low-code、中台、微服务、API、Token、Feature、矩阵、Gap 方案代号等内部术语。
3. **Gap/策略差异通俗化**：当 Input 中的 Anchor_Model_Feature 或 Conflict_Causality_Logic 涉及不同 IT 实现路径时，改写为业务语言对比，例如「主要靠 Excel/纸质台账汇总」「每条业务在表单里逐条录入」「系统自动汇总并提示差异」——勿写技术架构名称。
4. **工位聚焦**：user 消息中的【当前工位】即本问卷唯一关注环节；勿扩散到其他流程环节。
5. **模块标题（🎯 下每条序号前的名称）**：
   - 必须用客户能懂的**业务场景/工作方式**命名，例如：「派工明细怎么记」「采购对账习惯」「审批要不要留痕」「数据大概有多少」。
   - **严禁**使用：底座选型、技术选型、平台选型、存储选型、架构选型、IT-Gap、Schema、中台、数据库、低代码、性能红线 等词作标题。
   - 若冲突本质是数据量或记账方式，标题宜写「本环节数据规模与记账方式」「明细怎么汇总核对」等，勿写「XX底座」「XX选型」。`;

  /** @deprecated 使用 DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT */
  const DESIGN_DETAIL_TASK2_L1_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT =
    DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT;

  /** 任务 2 L1：用户对齐回复 → 写入 Input 5 的深访洞察纯文本 */
  const DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT = `# Role
你是一位资深的商业需求分析专家。你擅长从用户的非结构化回复中提取关键的业务约束、逻辑修正和决策证据，并将其转化为能够驱动推理引擎进化的“深访洞察”。

# Task
请基于【原始冲突清单】与【用户对齐回复】，生成一份结构化的“深访洞察文本”。该文本将作为后续 L1-L3 推理任务的 Input 5（深访洞察）输入，用于修正逻辑偏差、确认业务痛点或触发特征裂变。

# Input Context
原始冲突清单：之前识别出的潜在冲突项（包含 FeatureID、原始逻辑、提出的问题）。
用户对齐回复：用户针对上述问题给出的原始回答。

# Synthesis Principles (提炼原则)
因果锚定：明确指出用户的回复对应的是哪一个业务模块或逻辑矛盾。
类型界定：将洞察分为三种类型：
【冲突确认型】：证实了之前的逻辑矛盾，确认为真实痛点。
【逻辑修正型】：用户解释了背景，需要修正之前的推导假设。
【信息补充型】：提供了全新的业务维度或更细颗粒度的子类（裂变）。
保留原意：尽量保留用户回复中的关键动词和特有术语。
去口语化：将“我们其实不是...”转化为“业务实然现状为...”等专业表述。

# Output Format (纯文本摘要)
请按照以下结构输出，无需 Markdown 格式，直接输出文本块：
【深访洞察摘要】
[序号]. 涉及模块：[具体模块名称]
映射ID：[关联的原始 FeatureID]
洞察类型：[冲突确认/逻辑修正/信息补充]
核心内容：(描述用户确认的事实，如：用户确认虽然具备外资背景，但国内业务采用独立结算逻辑，无需多币种模块。)
逻辑影响：(该洞察如何改变之前的推导，如：应修正合规约束等级，将运营重心由财务合规转向属地化效率。)
(以此类推...)

提示：以上内容将作为最高优先级的逻辑锚点，直接干预后续层级的架构推导。

仅输出上述结构的纯文本，不要 Markdown 围栏。`;

  /**
   * 设计详情 LLM：将当前 `SmartCto.designDetailLlmLogContext` 并入 `fetchDeepSeekChat` 的 `llmLog`（与 `api.js` `resolveLlmLogForRequest` 双保险）。
   * @returns {{ caseId: string, taskId: string, callTarget: string } | undefined}
   */
  function resolveDesignDetailLlmLogForFetchOpts() {
    try {
      const ctx = global.SmartCto && global.SmartCto.designDetailLlmLogContext;
      if (ctx && ctx.caseId && ctx.taskId && ctx.callTarget) {
        return {
          caseId: String(ctx.caseId).trim(),
          taskId: String(ctx.taskId).trim(),
          callTarget: String(ctx.callTarget).trim(),
        };
      }
    } catch (_) {}
    return undefined;
  }

  /** 任务 6/7 等大上下文 L3/L4 推理：与后端 `/api/ai/chat` 上游 300s 超时对齐（默认 online 仅 180s 会先 abort） */
  const DESIGN_DETAIL_HEAVY_LLM_TIMEOUT_MS = 300_000;

  /** 深访问卷/合成：`fetchOpts.llmLog` 优先，否则读 `SmartCto.designDetailLlmLogContext` */
  function resolveDesignDetailAlignmentLlmLogForFetchOpts(fetchOpts) {
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    const direct = fo.llmLog;
    if (direct && direct.caseId && direct.taskId && direct.callTarget) {
      return {
        caseId: String(direct.caseId).trim(),
        taskId: String(direct.taskId).trim(),
        callTarget: String(direct.callTarget).trim(),
      };
    }
    return resolveDesignDetailLlmLogForFetchOpts();
  }

  /**
   * 设计详情任务 2 L1：由潜在冲突数据集生成对齐问卷（Markdown）。
   * @param {{ alignmentQuestionnaireUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function generateDesignDetailTask2L1AlignmentQuestionnaireFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentQuestionnaireUserBlock === 'string') {
      userBlock = String(payload.alignmentQuestionnaireUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentQuestionnaireUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 2 L1：冲突清单 + 问卷 + 用户回复 → 深访洞察纯文本（Input 5）。
   * @param {{ alignmentSynthesisUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function synthesizeDesignDetailTask2L1DeepInsightFromAlignmentReply(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentSynthesisUserBlock === 'string') {
      userBlock = String(payload.alignmentSynthesisUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentSynthesisUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 3 L2：`Token_Validation_Mapping` 潜在冲突 → 对齐问卷（Markdown）；**system 提示与任务 2 L1 问卷相同**，审计 `callTarget` 由设计页注入。
   * @param {{ alignmentQuestionnaireUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function generateDesignDetailTask3L2AlignmentQuestionnaireFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentQuestionnaireUserBlock === 'string') {
      userBlock = String(payload.alignmentQuestionnaireUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentQuestionnaireUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 3 L2：冲突清单 + 问卷 + 用户回复 → 深访洞察纯文本（Input 3）；**system 提示与任务 2 L1 合成相同**。
   * @param {{ alignmentSynthesisUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function synthesizeDesignDetailTask3L2DeepInsightFromAlignmentReply(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentSynthesisUserBlock === 'string') {
      userBlock = String(payload.alignmentSynthesisUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentSynthesisUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 4 L2：`Token_Validation_Mapping` 潜在冲突 → 对齐问卷（Markdown）；**system 提示与任务 2/3 问卷相同**。
   * @param {{ alignmentQuestionnaireUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function generateDesignDetailTask4L2AlignmentQuestionnaireFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentQuestionnaireUserBlock === 'string') {
      userBlock = String(payload.alignmentQuestionnaireUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentQuestionnaireUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 4 L2：冲突清单 + 问卷 + 用户回复 → 深访洞察纯文本（Input 4）；**system 提示与任务 2/3 合成相同**。
   * @param {{ alignmentSynthesisUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function synthesizeDesignDetailTask4L2DeepInsightFromAlignmentReply(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentSynthesisUserBlock === 'string') {
      userBlock = String(payload.alignmentSynthesisUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentSynthesisUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 6 L3：`Token_Validation_Mapping` 潜在冲突 → 对齐问卷（Markdown）；**system 与任务 2/3/4 问卷相同**。
   * @param {{ alignmentQuestionnaireUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function generateDesignDetailTask6L3AlignmentQuestionnaireFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentQuestionnaireUserBlock === 'string') {
      userBlock = String(payload.alignmentQuestionnaireUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentQuestionnaireUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 6.5 L3 IT-Gap：子任务 TVM 潜在冲突 → 对齐问卷（Markdown）；**通俗化 system，与任务 6 分离**。
   * @param {{ alignmentQuestionnaireUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function generateDesignDetailTask65L3AlignmentQuestionnaireFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentQuestionnaireUserBlock === 'string') {
      userBlock = String(payload.alignmentQuestionnaireUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentQuestionnaireUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_TASK65_IT_GAP_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_TASK65_IT_GAP_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 6 L3：冲突清单 + 问卷 + 用户回复 → 深访洞察纯文本（Input 3）；**system 与任务 2/3/4 合成相同**。
   * @param {{ alignmentSynthesisUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentSynthesisUserBlock === 'string') {
      userBlock = String(payload.alignmentSynthesisUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentSynthesisUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  async function generateDesignDetailTask7L4AlignmentQuestionnaireFromContext(payload, fetchOpts) {
    return generateDesignDetailTask6L3AlignmentQuestionnaireFromContext(payload, fetchOpts);
  }

  async function synthesizeDesignDetailTask7L4DeepInsightFromAlignmentReply(payload, fetchOpts) {
    return synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply(payload, fetchOpts);
  }

  async function generateDesignDetailTask8L45AlignmentQuestionnaireFromContext(payload, fetchOpts) {
    return generateDesignDetailTask6L3AlignmentQuestionnaireFromContext(payload, fetchOpts);
  }

  async function synthesizeDesignDetailTask8L45DeepInsightFromAlignmentReply(payload, fetchOpts) {
    return synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply(payload, fetchOpts);
  }

  async function generateDesignDetailTask85L475AlignmentQuestionnaireFromContext(payload, fetchOpts) {
    return generateDesignDetailTask6L3AlignmentQuestionnaireFromContext(payload, fetchOpts);
  }

  async function synthesizeDesignDetailTask85L475DeepInsightFromAlignmentReply(payload, fetchOpts) {
    return synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply(payload, fetchOpts);
  }

  async function generateDesignDetailTask9L5AlignmentQuestionnaireFromContext(payload, fetchOpts) {
    return generateDesignDetailTask6L3AlignmentQuestionnaireFromContext(payload, fetchOpts);
  }

  async function synthesizeDesignDetailTask9L5DeepInsightFromAlignmentReply(payload, fetchOpts) {
    return synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply(payload, fetchOpts);
  }

  /**
   * 设计详情任务 5 L3：`Token_Validation_Mapping` 潜在冲突 → 对齐问卷（Markdown）。
   * @param {{ alignmentQuestionnaireUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function generateDesignDetailTask5L3AlignmentQuestionnaireFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentQuestionnaireUserBlock === 'string') {
      userBlock = String(payload.alignmentQuestionnaireUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentQuestionnaireUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 5 L3：冲突清单 + 问卷 + 用户回复 → 深访洞察纯文本。
   * @param {{ alignmentSynthesisUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function synthesizeDesignDetailTask5L3DeepInsightFromAlignmentReply(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentSynthesisUserBlock === 'string') {
      userBlock = String(payload.alignmentSynthesisUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentSynthesisUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 5.1 L3.1：`Token_Validation_Mapping` 潜在冲突 → 对齐问卷（Markdown）。
   * @param {{ alignmentQuestionnaireUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function generateDesignDetailTask51L3AlignmentQuestionnaireFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentQuestionnaireUserBlock === 'string') {
      userBlock = String(payload.alignmentQuestionnaireUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentQuestionnaireUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 5.1 L3.1：冲突清单 + 问卷 + 用户回复 → 深访洞察纯文本。
   * @param {{ alignmentSynthesisUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function synthesizeDesignDetailTask51L3DeepInsightFromAlignmentReply(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentSynthesisUserBlock === 'string') {
      userBlock = String(payload.alignmentSynthesisUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentSynthesisUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 5.5 L3.5：`Token_Validation_Mapping` 潜在冲突 → 对齐问卷（Markdown）。
   * @param {{ alignmentQuestionnaireUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function generateDesignDetailTask55L3AlignmentQuestionnaireFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentQuestionnaireUserBlock === 'string') {
      userBlock = String(payload.alignmentQuestionnaireUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentQuestionnaireUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 5.5 L3.5：冲突清单 + 问卷 + 用户回复 → 深访洞察纯文本。
   * @param {{ alignmentSynthesisUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
   */
  async function synthesizeDesignDetailTask55L3DeepInsightFromAlignmentReply(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.alignmentSynthesisUserBlock === 'string') {
      userBlock = String(payload.alignmentSynthesisUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('alignmentSynthesisUserBlock 为空');
    const llmLog = resolveDesignDetailAlignmentLlmLogForFetchOpts(fo);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${DESIGN_DETAIL_TASK2_L1_DEEP_INSIGHT_SYNTHESIS_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 2：规模与组织模式 / L1 推理（输出 L1_Entity_Inference_Matrix JSON）。
   * @param {{ task2InferenceUserBlock?: string, basicInfo?: Object, orgTopologySlice?: Object, managementResources?: Object }} payload - 优先 `task2InferenceUserBlock`（Input 1～4：L0 TSV + 任务1 TSV + 深访 + 纠偏）；否则回退三块 JSON
   * @param {{ signal?: AbortSignal }} [fetchOpts] 可选；传入时与 `fetchDeepSeekChat` 内置超时合并，供「完全重启」中止进行中的任务 2 L1 请求
   * @returns {Promise<{ content: string, rawOutput: string, usage: Object, model: string, durationMs: number, fullPrompt: string }>}
   */
  async function inferDesignDetailL1EntityPortraitFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L1_ENTITY_PORTRAIT_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L1_ENTITY_PORTRAIT_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task2InferenceUserBlock === 'string') {
      userBlock = String(payload.task2InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) {
      const basic = payload && payload.basicInfo != null ? payload.basicInfo : {};
      const org = payload && payload.orgTopologySlice != null ? payload.orgTopologySlice : {};
      const mgr = payload && payload.managementResources != null ? payload.managementResources : {};
      userBlock = `【工商及业务背景信息】（兼容旧入参）

1) 客户基本信息（JSON）：
${JSON.stringify(basic, null, 2)}

2) 组织拓扑（JSON）：
${JSON.stringify(org, null, 2)}

3) 管理资源（JSON）：
${JSON.stringify(mgr, null, 2)}`;
    }
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 3：行业与业务属性 / L2 推理（输出 `L2_Business_Inference_Matrix` JSON；旧根键 `L2_Inference_Matrix` 仍兼容）。
   * @param {{ task3InferenceUserBlock?: string }} payload - `task3InferenceUserBlock`（Input 1–4，见 `buildTask3L2InferenceUserBlock`）
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   * @returns {Promise<{ content: string, rawOutput: string, usage: Object, model: string, durationMs: number, fullPrompt: string }>}
   */
  async function inferDesignDetailL2IndustryBusinessFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L2_INDUSTRY_BUSINESS_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L2_INDUSTRY_BUSINESS_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task3InferenceUserBlock === 'string') {
      userBlock = String(payload.task3InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) {
      throw new Error('task3InferenceUserBlock 为空');
    }
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        taskTag: 'design-detail-task3-l2',
        maxOutputTokens: 8192,
        timeoutMs: DESIGN_DETAIL_HEAVY_LLM_TIMEOUT_MS,
        ...(fo.signal ? { signal: fo.signal } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /** 设计详情任务 4：L2 价值链分析 / 核心价值驱动；系统提示见 `designDetailL4L2ValueDriverSystemPrompt.js` */
  /** 设计详情任务 5：L3 宏观流程特征（VSM 阶段属任务 5.5）；系统提示见 `designDetailL5L3MacroProcessSystemPrompt.js` */

  /**
   * 设计详情任务 4：L2 核心价值驱动 / 价值链分析（输出 L2_Value_Inference_Matrix JSON）。
   * @param {{ task4InferenceUserBlock?: string }} payload - `task4InferenceUserBlock`（L1/L2/原始 Token TSV）
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL2CoreValueDriverFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L2_CORE_VALUE_DRIVER_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L2_CORE_VALUE_DRIVER_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task4InferenceUserBlock === 'string') {
      userBlock = String(payload.task4InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) {
      throw new Error('task4InferenceUserBlock 为空');
    }
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 5：L3 宏观流程特征（输出 L3_Process_Feature_Matrix JSON）。
   * @param {{ task5InferenceUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL3MacroProcessFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L3_MACRO_PROCESS_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L3_MACRO_PROCESS_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task5InferenceUserBlock === 'string') {
      userBlock = String(payload.task5InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) {
      throw new Error('task5InferenceUserBlock 为空');
    }
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /** 设计详情任务 5.1：L3.1 战略价值主张；系统提示见 `designDetailL51ValuePropositionSystemPrompt.js` */

  /**
   * 设计详情任务 5.1：L3.1 战略价值主张与业务能力单元（输出 L3_Value_Proposition_Matrix JSON）。
   * @param {{ task51InferenceUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL51ValuePropositionFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L51_VALUE_PROPOSITION_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L51_VALUE_PROPOSITION_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task51InferenceUserBlock === 'string') {
      userBlock = String(payload.task51InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) {
      throw new Error('task51InferenceUserBlock 为空');
    }
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 5.2：表格字段功能理解（单表循环，输出 L3_Asset_Mapping_Matrix JSON）。
   * @param {{ task52InferenceUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL52AssetFieldSetFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L52_ASSET_FIELD_SET_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L52_ASSET_FIELD_SET_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task52InferenceUserBlock === 'string') {
      userBlock = String(payload.task52InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) {
      throw new Error('task52InferenceUserBlock 为空');
    }
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /**
   * 设计详情任务 5.3：L3.3 跨能力单元字段集时序流转串联（输出 L3_Workflow_Flow_Matrix JSON）。
   * @param {{ task53InferenceUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL53WorkflowFlowFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L53_WORKFLOW_FLOW_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L53_WORKFLOW_FLOW_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task53InferenceUserBlock === 'string') {
      userBlock = String(payload.task53InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) {
      throw new Error('task53InferenceUserBlock 为空');
    }
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  /** 设计详情任务 5.5：L3.5 VSM；系统提示见 `designDetailL55L3VsmStageSystemPrompt.js` */

  /**
   * 设计详情任务 5.5：价值流阶段 To-Be 设计（输出 L3_Value_Stream_Matrix；Feature_Key 统一为「价值流阶段」）。
   * @param {{ task55InferenceUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL3VsmStageFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L3_VSM_STAGE_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L3_VSM_STAGE_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task55InferenceUserBlock === 'string') {
      userBlock = String(payload.task55InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) {
      throw new Error('task55InferenceUserBlock 为空');
    }
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: 180000,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  global.inferDesignDetailL1EntityPortraitFromContext = inferDesignDetailL1EntityPortraitFromContext;
  global.generateDesignDetailTask2L1AlignmentQuestionnaireFromContext =
    generateDesignDetailTask2L1AlignmentQuestionnaireFromContext;
  global.synthesizeDesignDetailTask2L1DeepInsightFromAlignmentReply =
    synthesizeDesignDetailTask2L1DeepInsightFromAlignmentReply;
  global.generateDesignDetailTask3L2AlignmentQuestionnaireFromContext =
    generateDesignDetailTask3L2AlignmentQuestionnaireFromContext;
  global.synthesizeDesignDetailTask3L2DeepInsightFromAlignmentReply =
    synthesizeDesignDetailTask3L2DeepInsightFromAlignmentReply;
  global.generateDesignDetailTask4L2AlignmentQuestionnaireFromContext =
    generateDesignDetailTask4L2AlignmentQuestionnaireFromContext;
  global.synthesizeDesignDetailTask4L2DeepInsightFromAlignmentReply =
    synthesizeDesignDetailTask4L2DeepInsightFromAlignmentReply;
  global.generateDesignDetailTask5L3AlignmentQuestionnaireFromContext =
    generateDesignDetailTask5L3AlignmentQuestionnaireFromContext;
  global.synthesizeDesignDetailTask5L3DeepInsightFromAlignmentReply =
    synthesizeDesignDetailTask5L3DeepInsightFromAlignmentReply;
  global.generateDesignDetailTask51L3AlignmentQuestionnaireFromContext =
    generateDesignDetailTask51L3AlignmentQuestionnaireFromContext;
  global.synthesizeDesignDetailTask51L3DeepInsightFromAlignmentReply =
    synthesizeDesignDetailTask51L3DeepInsightFromAlignmentReply;
  global.generateDesignDetailTask55L3AlignmentQuestionnaireFromContext =
    generateDesignDetailTask55L3AlignmentQuestionnaireFromContext;
  global.synthesizeDesignDetailTask55L3DeepInsightFromAlignmentReply =
    synthesizeDesignDetailTask55L3DeepInsightFromAlignmentReply;
  global.generateDesignDetailTask6L3AlignmentQuestionnaireFromContext =
    generateDesignDetailTask6L3AlignmentQuestionnaireFromContext;
  global.generateDesignDetailTask65L3AlignmentQuestionnaireFromContext =
    generateDesignDetailTask65L3AlignmentQuestionnaireFromContext;
  global.synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply =
    synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply;
  global.generateDesignDetailTask7L4AlignmentQuestionnaireFromContext =
    generateDesignDetailTask7L4AlignmentQuestionnaireFromContext;
  global.synthesizeDesignDetailTask7L4DeepInsightFromAlignmentReply =
    synthesizeDesignDetailTask7L4DeepInsightFromAlignmentReply;
  global.generateDesignDetailTask8L45AlignmentQuestionnaireFromContext =
    generateDesignDetailTask8L45AlignmentQuestionnaireFromContext;
  global.synthesizeDesignDetailTask8L45DeepInsightFromAlignmentReply =
    synthesizeDesignDetailTask8L45DeepInsightFromAlignmentReply;
  global.generateDesignDetailTask85L475AlignmentQuestionnaireFromContext =
    generateDesignDetailTask85L475AlignmentQuestionnaireFromContext;
  global.synthesizeDesignDetailTask85L475DeepInsightFromAlignmentReply =
    synthesizeDesignDetailTask85L475DeepInsightFromAlignmentReply;
  global.generateDesignDetailTask9L5AlignmentQuestionnaireFromContext =
    generateDesignDetailTask9L5AlignmentQuestionnaireFromContext;
  global.synthesizeDesignDetailTask9L5DeepInsightFromAlignmentReply =
    synthesizeDesignDetailTask9L5DeepInsightFromAlignmentReply;
  global.inferDesignDetailL2IndustryBusinessFromContext = inferDesignDetailL2IndustryBusinessFromContext;
  global.inferDesignDetailL2CoreValueDriverFromContext = inferDesignDetailL2CoreValueDriverFromContext;
  global.inferDesignDetailL3MacroProcessFromContext = inferDesignDetailL3MacroProcessFromContext;
  global.inferDesignDetailL51ValuePropositionFromContext = inferDesignDetailL51ValuePropositionFromContext;
  global.inferDesignDetailL52AssetFieldSetFromContext = inferDesignDetailL52AssetFieldSetFromContext;
  global.inferDesignDetailL53WorkflowFlowFromContext = inferDesignDetailL53WorkflowFlowFromContext;
  global.inferDesignDetailL3VsmStageFromContext = inferDesignDetailL3VsmStageFromContext;

  /**
   * 设计详情任务 6：关键场景推理（`L3_Scenario_Inference_Matrix`；5.5 动宾价值流 × 任务 1 痛点雷达；`associated_pain_point`；提示词见 `designDetailL3ScenarioSystemPrompt.js`）。
   * @param {{ task6InferenceUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL3ScenarioFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L3_SCENARIO_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L3_SCENARIO_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task6InferenceUserBlock === 'string') {
      userBlock = String(payload.task6InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('task6InferenceUserBlock 为空');
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: DESIGN_DETAIL_HEAVY_LLM_TIMEOUT_MS,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  global.inferDesignDetailL3ScenarioFromContext = inferDesignDetailL3ScenarioFromContext;

  /**
   * 设计详情任务 6.5：三维 IT-Gap 分析（`L3_IT_Gap_Analysis_Matrix`；单流程环节循环；提示词见 `designDetailL65ItGapSystemPrompt.js`）。
   * @param {{ task65InferenceUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL65ItGapFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L65_IT_GAP_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L65_IT_GAP_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task65InferenceUserBlock === 'string') {
      userBlock = String(payload.task65InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('task65InferenceUserBlock 为空');
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: DESIGN_DETAIL_HEAVY_LLM_TIMEOUT_MS,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  global.inferDesignDetailL65ItGapFromContext = inferDesignDetailL65ItGapFromContext;

  /**
   * 设计详情任务 7：L4 流程二级协作节点拆解（`L4_Collaboration_Inference_Matrix`；`所属业务流程` + `协作节点` + Validation_Status 中继 + TVM）。
   * @param {{ task7InferenceUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL4CollaborationFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L4_COLLABORATION_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L4_COLLABORATION_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task7InferenceUserBlock === 'string') {
      userBlock = String(payload.task7InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('task7InferenceUserBlock 为空');
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: DESIGN_DETAIL_HEAVY_LLM_TIMEOUT_MS,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  global.inferDesignDetailL4CollaborationFromContext = inferDesignDetailL4CollaborationFromContext;

  /**
   * 设计详情任务 8：L4.5 角色、对象与状态转移矩阵（`L4_Prototype_Inference_Matrix`；三键 + Validation_Status 中继 + TVM）。
   * @param {{ task8InferenceUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL4PrototypeFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L4_PROTOTYPE_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L4_PROTOTYPE_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task8InferenceUserBlock === 'string') {
      userBlock = String(payload.task8InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('task8InferenceUserBlock 为空');
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 16384,
        timeoutMs: DESIGN_DETAIL_HEAVY_LLM_TIMEOUT_MS,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  global.inferDesignDetailL4PrototypeFromContext = inferDesignDetailL4PrototypeFromContext;

  /**
   * 设计详情任务 8.5：L4.7 技术集成（`L4_7_Tech_Integration_Matrix`；三键 + Validation_Status 中继 + TVM）。
   * @param {{ task85InferenceUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL475PhysicalHookFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L475_PHYSICAL_HOOK_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L475_PHYSICAL_HOOK_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task85InferenceUserBlock === 'string') {
      userBlock = String(payload.task85InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('task85InferenceUserBlock 为空');
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: DESIGN_DETAIL_HEAVY_LLM_TIMEOUT_MS,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  global.inferDesignDetailL475PhysicalHookFromContext = inferDesignDetailL475PhysicalHookFromContext;

  /**
   * 设计详情任务 9：L5 领域驱动逻辑容器与工具宿主（`L5_Blueprint_Domain_Matrix`；系统一级模块 + Validation_Status 中继 + TVM）。
   * @param {{ task9InferenceUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL5BlueprintFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L5_BLUEPRINT_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L5_BLUEPRINT_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task9InferenceUserBlock === 'string') {
      userBlock = String(payload.task9InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('task9InferenceUserBlock 为空');
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: DESIGN_DETAIL_HEAVY_LLM_TIMEOUT_MS,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  global.inferDesignDetailL5BlueprintFromContext = inferDesignDetailL5BlueprintFromContext;

  /**
   * 设计详情任务 10：L5 物理建表 Schema 与 RBAC 初始化（输出 L5_Technical_DDL_Matrix）。
   * @param {{ task10InferenceUserBlock?: string }} payload
   * @param {{ signal?: AbortSignal }} [fetchOpts]
   */
  async function inferDesignDetailL5TechnicalDdlFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_L5_TECHNICAL_DDL_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_L5_TECHNICAL_DDL_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.task10InferenceUserBlock === 'string') {
      userBlock = String(payload.task10InferenceUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('task10InferenceUserBlock 为空');
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 8192,
        timeoutMs: DESIGN_DETAIL_HEAVY_LLM_TIMEOUT_MS,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  global.inferDesignDetailL5TechnicalDdlFromContext = inferDesignDetailL5TechnicalDdlFromContext;

  /** 架构清单「设计报告」LLM 轴：仅第一～三章叙事（第四、五章由前端 JS 直刷） */
  async function inferDesignDetailDesignReportFromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_DESIGN_REPORT_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_DESIGN_REPORT_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.designReportLlmUserBlock === 'string') {
      userBlock = String(payload.designReportLlmUserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('designReportLlmUserBlock 为空');
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 4096,
        timeoutMs: DESIGN_DETAIL_HEAVY_LLM_TIMEOUT_MS,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  global.inferDesignDetailDesignReportFromContext = inferDesignDetailDesignReportFromContext;

  /** 设计报告子任务：第一章「对需求痛点的理解」 */
  async function inferDesignDetailDesignReportChapter1FromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_DESIGN_REPORT_CHAPTER1_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_DESIGN_REPORT_CHAPTER1_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.designReportChapter1UserBlock === 'string') {
      userBlock = String(payload.designReportChapter1UserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('designReportChapter1UserBlock 为空');
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 6144,
        timeoutMs: DESIGN_DETAIL_HEAVY_LLM_TIMEOUT_MS,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  global.inferDesignDetailDesignReportChapter1FromContext = inferDesignDetailDesignReportChapter1FromContext;

  /** 设计报告子任务：第二章「剖析与诊断」 */
  async function inferDesignDetailDesignReportChapter2FromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_DESIGN_REPORT_CHAPTER2_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_DESIGN_REPORT_CHAPTER2_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.designReportChapter2UserBlock === 'string') {
      userBlock = String(payload.designReportChapter2UserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('designReportChapter2UserBlock 为空');
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 6144,
        timeoutMs: DESIGN_DETAIL_HEAVY_LLM_TIMEOUT_MS,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  global.inferDesignDetailDesignReportChapter2FromContext = inferDesignDetailDesignReportChapter2FromContext;

  /** 设计报告子任务：第三章「方案构建」 */
  async function inferDesignDetailDesignReportChapter3FromContext(payload, fetchOpts) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const systemPrompt = String(global.DESIGN_DETAIL_DESIGN_REPORT_CHAPTER3_SYSTEM_PROMPT || '').trim();
    if (!systemPrompt) throw new Error('DESIGN_DETAIL_DESIGN_REPORT_CHAPTER3_SYSTEM_PROMPT 未加载');
    const fo = fetchOpts && typeof fetchOpts === 'object' ? fetchOpts : {};
    let userBlock = '';
    if (payload && typeof payload.designReportChapter3UserBlock === 'string') {
      userBlock = String(payload.designReportChapter3UserBlock).replace(/^\uFEFF/, '').trim();
    }
    if (!userBlock) throw new Error('designReportChapter3UserBlock 为空');
    const llmLog = resolveDesignDetailLlmLogForFetchOpts();
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      {
        maxOutputTokens: 6144,
        timeoutMs: DESIGN_DETAIL_HEAVY_LLM_TIMEOUT_MS,
        ...(fo.signal ? { signal: fo.signal } : {}),
        ...(llmLog ? { llmLog } : {}),
      },
    );
    const raw = String(content || '').trim();
    const fullPrompt = `【system】\n${systemPrompt}\n\n【user】\n${userBlock}`;
    return { content: raw, rawOutput: raw, usage, model, durationMs, fullPrompt };
  }

  global.inferDesignDetailDesignReportChapter3FromContext = inferDesignDetailDesignReportChapter3FromContext;
})(typeof window !== 'undefined' ? window : this);
