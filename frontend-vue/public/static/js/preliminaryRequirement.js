/**
 * [INPUT]: 依赖外部 `fetchDeepSeekChat`、详情页 item（可能含 preliminaryReq 与顶层字段）。
 * [OUTPUT]: 提供初步需求解析、预览渲染、详情卡片/历史详情渲染、`renderRequirementWorkspaceFieldValueHtml`（工作区 ** 小标题：`**A**与**B**` 合并为一行绿色标题；仅当闭合 `**` 后紧跟 ： 。 等标点才分块，否则整段走加粗正文）与统一字段合成能力。
 * [POS]: 首页解析预览与详情页「初步需求」字段语义的统一入口。
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新此 Header 和所属目录的 AGENTS.md。
 * FE-20260330：task1 内「客户初步需求」提炼改为深度 V2 JSON（businessContext…roadmap）；首页仅录入企业名称不再调 LLM。
 * FE-20260330-2：工作区「初步需求」view 为横向分区 Tab；**商业背景**层级子卡片、**需求痛点**横向子卡片，其余多为 `JSON.stringify` 预览。
 * FE-20260330-3：V2 view 多 Tab 分区——商业背景、**核心对象**、**状态逻辑**、需求痛点等（路径见 `PRELIMINARY_V2_WORKSPACE_VIEW_SECTIONS`）。
 * FE-20260330-4：工作区 view 多分区 Tab 仅读 V2 路径；不再从扁平字段合成。
 * FE-20260330-5：删除旧版多维度扁平字段（customerNeedsOrChallenges 等）的设计与展示；解析预览/总结 JSON/合成对象仅认 V2 结构 + requirementDetail。
 * FE-20260330-8：task1 初步需求补充修订 `refinePreliminaryRequirementV2WithFeedback` + `mergePreliminaryV2TopLevel`（用户反馈后合并回 `preliminaryReq`）。**FE-20260409**：跟进卡「对补充内容修改」同源调用，摘要与确认落 `main.js` `preliminaryRequirementModificationSummaryBlock`。
 * FE-20260330-9：详情工作区「初步需求」卡 view 面板以 `buildPreliminaryWorkspaceSectionTabsHtml` 为准（`problem-detail-runtime` 已接线）；`buildPreliminaryCardRowsHtml` 保留兼容/回退；整卡第三 Tab「json」展示 `buildPreliminaryStructuredJsonString`（与 `buildPreliminarySummaryJson` 同源）。
 * FE-20260330-11：task1 补充需求链路拆分为两段：先 `parsePreliminaryRequirementDepthV2` 生成「LLM-查询」候选，再 `mergePreliminaryRequirementV2ByLlm` 将候选与当前版本合并并输出修改要点（用于「LLM-修改」）。
 * FE-20260330-14：大模型返回用「括号配对 + 可选 Markdown 围栏」提取首段 JSON，避免贪婪 `/\{[\s\S]*\}/` 吞入多段对象或尾部说明导致 JSON.parse 失败。
 * FE-20260403-28：`parsePreliminaryLlmJsonObject` 多 `{` 起点候选 + 弯引号/中文顿号分隔符归一化；深度/修订/合并走 `task1-prelim-*` + `maxOutputTokens:8192`，并与 API `json_object` 模式对齐以降低补充长文档时非法 JSON。
 * FE-20260330-18：「历史详情」Tab 每条原始需求反馈卡片标题行左侧增加自编号标签（按 `requirementDetailHistory` 顺序从 1 递增）。
 * FE-20260410-hist-del：历史详情每条标题行右侧 **删除** 钮，点击经 `main.js` `deletePreliminaryHistoryItemAt` + `mergeDigitalProblemPatch` 落库并重绘；展开/收起仅绑定 `.preliminary-history-item-header-main`，避免嵌套 interactive。
 * FE-20260330-23：需求详情历史条目编号为 `RQ-001` 样式，写入时带 `title`（首行提炼，30 字以内）；时间线卡片展示编号+绿色标题，展开见全文。
 * FE-20260330-24：案例标题行「客户名称｜需求标题」与首页卡片第二行需求标题：`buildCaseRequirementHeadlineParts`（需求标题 `解决【问题描述】`，整段不超过 30 个 Unicode 字符）。
 * FE-20260330-25：需求标题不含公司名称，优先提炼数字化/IT 缺口（itGap、itLandscape），正文经 `stripCompanyNamesFromSnippet` 去客户名。
 * FE-20260331-12：online 详情 API 曾仅把 `preliminaryReq` 落在 `basicInfo.__createContractExtras`；`buildResolvedPreliminaryRequirement` 须从嵌套元区回读，与工作区/补充修订路由一致。
 * FE-20260331-17：task1 分段合并提示词改为「字段级」：`mergePreliminaryRequirementV2ByLlm` 的输入只包含当前字段与补充字段，不带其他字段。
 * FE-20260331-21：深度提炼 schema 以 `operationModel.fullValueStreams` 为主（`nodes` 为环节链字符串）；`buildResolvedPreliminaryRequirement` 在无 `valueStreamMapping` 时从 `fullValueStreams` 合成兼容别名，供 task4 Mirror 与角色推演读取。
 * FE-20260401：初步需求 view 为空时输出 `[FE:prelim-workspace-view]`（关闭：`globalThis.__FE_PRELIM_VIEW_DEBUG = false`），便于排查导入/合并后 item 与 view 分区命中。
 * FE-20260402：`extractPreliminaryReqV2FromChatMessages` 供 main 在 `preliminaryReq` 缺失时从 task1 LLM 块等回填内存态（与 `storage-http-adapter` 嵌套抬升互补）。
 * FE-20260403：task1 深度/修订/合并 system 提示词与 `frontend/PROMPTS.md` §1 同源；改提示词须同步该文档。
 * FE-20260404：补充合并/修订提示词明确「禁止无故删减」；`mergePreliminaryV2TopLevel` 对 `fullValueStreams`/`painPointRadar` 等数组按业务键与当前版本并集合并，避免模型输出缩数组长列表覆盖导致旧内容丢失。
 * FE-20260409：深度 V2 提示词与 schema 增 `coreBusinessEntities`、`stateTransitionMatrix`；工作区 view 为「核心对象」「状态逻辑」两分 Tab；`PRELIMINARY_V2_TOP_KEYS` 与修订/合并数组并集规则覆盖上述字段。
 * FE-20260409-2：`coreBusinessEntities` 与需求痛点一致的横向圆角卡；卡内「生命周期」彩色标签 + →、「归属逻辑」子卡正文。
 * FE-20260409-3：`stateTransitionMatrix` 非空数组时按 `entity` 各生成独立 Mermaid 子图，置于状态逻辑 **单列**网格（`problem-detail-prelim-stm-grid`）；`main.js` 对每个 `.problem-detail-prelim-stm-mermaid-mount` 执行 `mermaid.run` hydration。
 * FE-20260409-4：`coreBusinessEntities` 按归一化 `entityName` 并集去重合并；`stateTransitionMatrix` 行 `entity` 与核心对象列表展示名对齐，合并后去重转移行；工作区状态逻辑每卡前置序号。
 * FE-20260410：状态逻辑子卡去掉 **view / mermaid** 子 Tab 栏，仅保留实体标题行 + 全屏钮 + Mermaid 渲染区（源码仍存于隐藏 textarea 供 hydrate）。
 * FE-20260409-6：每条状态逻辑子卡顶栏标题（当前 entity 展示名）+ 全屏按钮；全屏目标为整张子卡，进入前强制 **view** Tab 并 hydration；`problem-detail-chat.js` `syncPrelimStmFullscreenButtonState` 随 `fullscreenchange` 同步图标。
 * FE-20260409-7：状态逻辑 Mermaid 图在工作区内 **宽度约束为 100%**（修正曾误用的 `svg { width:auto }`）；`main.js` hydrate 用 `querySelector('svg')` 去内禀宽高并设 `preserveAspectRatio`。
 * FE-20260409-stakeholders：深度/修订/合并 `PRELIMINARY_V2_*_SYSTEM_PROMPT` 要求 `orgAndRoles.stakeholders` 中角色仅来自同份 JSON 的**可引用角色池**（`coreBusinessEntities` 全文、`stateTransitionMatrix[].actor`、`fullValueStreams[].actor`），禁止池外臆造；组织维度各至多一条、条内与多条间去重。
 * FE-20260409-stm-esc：`prelimStmEscapeMermaidQuotedLabel` 对 `[]#<>` 做全角替换；`main.js` `sanitizePrelimStmMermaidQuotedPayloads` 渲染前再清引号内载荷；状态逻辑用 `mermaid.render` + 全局 `htmlLabels:false`，减轻全屏多图 foreignObject 叠层。
 * FE-20260409-8：核心对象条带 **每行 5 卡**（`--cbe-5col` 网格，窄屏降级列数）；分析备注 `analystNotes` 专用子卡纵列，条目前缀「提取中发现的逻辑矛盾点」子卡内去重展示。
 * FE-20260422-cbe：核心对象增 `conceptCategory`（人｜财｜物｜事）与 `conceptExplanation`（≤100 字、须完整句；展示/合并截断优先句末标点）；工作区按四类分卡片展示、标题配图标，对象卡内「概念解释」在「生命周期」之上；条带 **每行 4 卡**（`--cbe-4col`）。
 * FE-20260416：task1 补充分段合并 Session 在「商业背景」后为 **核心对象**、**状态逻辑** 两步（各对应单一顶层键，`main.js` `TASK1_PRELIMINARY_MERGE_SESSION_SECTIONS`）；`PRELIMINARY_V2_MERGE_SYSTEM_PROMPT` 强调增量合并、禁止整字段覆盖短表。
 * FE-20260411-split：补充提炼在全文深度 V2 之后对 `coreBusinessEntities` / `stateTransitionMatrix` 各增加一次独立切片 LLM（`parsePreliminaryRequirementSupplementSliceV2`），结果覆盖同名字段。
 * FE-20260409-fvs-grid：「业务流程」`fullValueStreams` 领域标题右侧半角括号数量、与标题同色 `#38bdf8`；领域下流程子卡为每行 5 列 CSS Grid（窄屏列数同核心对象 Tab 降级）。
 * FE-20260417：`PRELIMINARY_V2_MERGE_SYSTEM_PROMPT` 为模板字符串时，提示词内 Markdown 字段名须写成 \`...\` 转义，禁止裸 \`，否则整文件 SyntaxError、前端脚本不加载。
 * FE-20260418：`mergePreliminaryRequirementV2ByLlm` 在模型返回的 `preliminaryReq` 无有效 V2 顶层键时，兜底用入参 `newExtractedPreliminaryReq` 与 `mergePreliminaryV2TopLevel` 合并（常见于核心对象/状态逻辑等步模型漏写字段或只写摘要）。
 * FE-20260410：`buildPreliminaryMergeV2LlmInputFullText` 导出供 `main.js` 在「核心对象」「状态逻辑」分段合并调用 LLM 前将 **system+user 全文**推送到主聊天区 `task1PrelimMergePromptJsonBlock`；`buildPreliminaryMergeV2UserJsonPair` 仍导出供裁剪逻辑复用。
 * FE-20260403-26：深度提炼 schema 升级为 `fullValueStreams` + `analystNotes`；`normalizePreliminaryReqV2ValueStreamAlias` 补全下游所需的 `valueStreamMapping`。
 * FE-20260418-task4-vsm：`fullValueStreams` 条数多于 `valueStreamMapping` 时以 full 合成覆盖后者，避免 task4 Mirror 等只吃到模型回写的短聚合列表而与工作区「业务流程」不一致。
 * FE-20260403-28：工作区「商业背景」分区以层级子卡片渲染 `businessContext`（`orgTopology` 等嵌套对象独立子卡），非对象仍回退 pre JSON。
 * FE-20260403-29：工作区「需求痛点」分区以横向圆角子卡片渲染 `painPointRadar[]`（维度标题 + 表现 / IT 缺口）。
 * FE-20260403-32：工作区「人员组织」分区以子卡片渲染 `operationModel.orgAndRoles`（`stakeholders` 每项一卡 + 治理逻辑 / 激励挂钩等）；条带加 `problem-detail-prelim-pp-wrap--org-roles` 换行满宽，避免横向滚动（见 `styles.css`）。
 * FE-20260403-33：`stakeholders` 字符串为「标题：正文」时卡片标题取冒号前段、正文仅展示冒号后；子卡内不展示「要点」行标签。
 * FE-20260419：`consolidateOrgAndRolesStakeholdersArray` 按标题键合并多条「总部角色/分支角色」等为单卡，正文角色按顿号/逗号拆后去重；合并链路与人员组织 view 渲染均走此归一化。
 * FE-20260419-stm-rows：task1 补充分段合并中「状态逻辑」按新提炼矩阵**逐行**子任务执行；`mergePreliminaryStmRowIntoMatrixByLlm` + `PRELIMINARY_V2_STM_ROW_MERGE_SYSTEM_PROMPT` 仅输入当前完整矩阵与单行新提炼，减轻上下文压力（`main.js` Session 计划动态展开行）。
 * FE-20260421：状态逻辑合并改为「新 entity 直写 + 按 entity 分子任务 LLM」；`groupPreliminaryStmMatrixRowsByEntityLabel`、`mergePreliminaryStmEntityBucketByLlm`（`PRELIMINARY_V2_STM_ENTITY_MERGE_SYSTEM_PROMPT`）；兼容旧 Session 的 `stmRowIndex` 逐行路径。
 * FE-20260420：工作区「状态逻辑」Tab 按 entity **折叠子卡片**（`details`）；摘要标题含该实体下转移条数；展开区先列**逐条状态转移**再保留 Mermaid 关系图（`buildPrelimStmTransitionRowsListHtml`）。
 * FE-20260403-34：工作区「IT 现状需求」`itLandscape` 为三块纵向子卡（现有系统、待集成系统、部署形态），卡内 `<ul>` 列表；扩展键追加同栈。
 * FE-20260403-37：工作区「业务流程」`fullValueStreams` 按 `domain` 分领域子卡，同领域下流程子卡横向排列；流程卡标题为 `processName`，正文为「字段名+内容」列表（不展示 `domain`/`processName`）；`main.js` 顶栏分区 Tab 仅绑定首层 `tablist`。
 * FE-20260405：业务流程流程卡正文区高度由 `styles.css` `.problem-detail-prelim-fvs-process-body` 与外层栈配合撑开（避免 flex+min-height:0 压扁「环节链」等长正文）。
 * FE-20260403-30：商业背景内「组织拓扑」子卡正文为横向圆角字段卡条带（`--org-equal` 均分宽度；内层字段卡琥珀主题；外层标题条仍用商业背景默认蓝头样式）。
 * FE-20260403-31：工作区 view 子 Tab 栏样式见 `styles.css` 中 `.problem-detail-card-preliminary-tabs` 作用域（与标题栏顶距、Tab 行居中、绿色标题字）。
 */
(function (global) {
  /**
   * @typedef {Object} PreliminaryLlmResult
   * @property {Object} parsed - 解析后的初步需求对象（V2 最新结构或旧版扁平字段）。
   * @property {string} fullPrompt - 完整提示词（system + user）。
   * @property {string} rawOutput - 模型原始 JSON 文本。
   * @property {{ usage: Object, model: string, durationMs: number }} llmMeta - 大模型元数据。
   */

  const PRELIMINARY_V2_TOP_KEYS = [
    'businessContext',
    'coreBusinessEntities',
    'stateTransitionMatrix',
    'painPointRadar',
    'itLandscape',
    'operationModel',
    'managementResources',
    'roadmap',
  ];

  /** 需求详情历史时间线标题提炼最大长度（Unicode 字符） */
  const REQUIREMENT_DETAIL_HISTORY_TITLE_MAX_LEN = 30;

  /** 案例「需求标题」`解决【…】` 整段最大长度（Unicode 字符，含「解决」「【」「】」） */
  const CASE_REQUIREMENT_TITLE_MAX_LEN = 30;

  /** task1 聊天区：客户初步需求深度提炼（与产品约定 schema 一致；含核心业务对象与状态转移矩阵） */
  const PRELIMINARY_V2_DEPTH_SYSTEM_PROMPT = `# Role
你是一位精通多租户架构、集团管控与领域驱动设计（DDD）的资深需求分析专家。你的任务是将杂乱的客户原始需求，转化为具备“对象生命周期”、“状态机驱动”与“多级组织能力”的结构化需求底座。

# Task
请严格按以下 JSON 结构输出。在提取时，必须横向覆盖组织/IT/痛点，纵向穿透业务对象的“招募/准入 -> 运行/交付 -> 结算/退出”全生命周期，并深度解析状态转移背后的规则。

# Output JSON Structure
{
  "businessContext": {
    "clientName": "企业/项目名称",
    "industryDomain": "所属行业及核心商业模式",
    "orgTopology": {
      "type": "单体 / 集团-分子 / 总部-加盟 / 区域矩阵",
      "scale": "当前规模及未来扩张计划",
      "dataIsolation": "数据隔离与审计汇总需求",
      "managementDepth": "管理层级定义"
    },
  },
  "coreBusinessEntities": [
    {
      "entityName": "核心业务对象（如：个体学员所有权、培训合同）",
      "identifier": "唯一性识别标识（如：微信号、身份证号、订单号）",
      "conceptCategory": "人 | 财 | 物 | 事（四选一：人=人员/角色/组织关系；财=资金/对账/结算；物=实物或数字化资产/载体；事=流程/事项/合约等业务事件或抽象对象）",
      "conceptExplanation": "100 字以内、一至两句完整中文句（句末须为 。 ！ ？ 或 ；），结合客户原文说明该对象在场景中的含义；禁止半截词/半截句，禁止只写抽象架构词",
      "lifecycleStates": ["识别出的所有名词状态，如：潜在、正式、睡眠、冲突"],
      "ownershipLogic": "该对象归属于谁？如何界定归属权？"
    }
  ],
  "stateTransitionMatrix": [
    {
      "entity": "关联业务对象",
      "fromState": "起始状态",
      "toState": "目标状态",
      "triggerEvent": "动作或事件（如：提交结单、到期未复购）",
      "actor": "执行角色",
      "guards": "准入守卫逻辑（必须满足什么条件才能跳转，如：检查是否他人所有）",
      "sideEffects": {
        "financeImpact": "利益分配逻辑（包含具体分成比例、补偿金计算公式）",
        "timeImpact": "效期延展逻辑（Expiry Date 如何更新）",
        "dataSnapshot": "是否需要留痕/生成审计记录"
      }
    }
  ],
  "corePainPointSummary": "核心痛点总结（归纳客户现状、核心矛盾与关键痛点的总述段落）",
  "painPointRadar": [
    {
      "dimension": "人/财/物/事/系统/管控",
      "description": "痛点具体表现",
      "itGap": "现有工具在多级协同或状态流转自动执行上的缺失"
    }
  ],
  "itLandscape": {
    "legacySystems": ["旧系统及局限性"],
    "integrationRequirements": ["必须打通的三方生态"],
    "deploymentMode": "SaaS / 私有化 / 混合云"
  },
  "operationModel": {
    "orgAndRoles": {
      "stakeholders": ["总部角色：岗位A、岗位B（仅列举下文「可引用角色池」中已出现的称谓）", "分支角色：岗位C、岗位D"],
      "governanceLogic": "总部与分支的权责边界（统分逻辑）",
      "incentiveHooks": "跨组织的激励与利益分配逻辑（如授权费、跨分支分润）"
    },
    "fullValueStreams": [
      {
        "domain": "业务域（如：招募认证、销售运营、财务结算）",
        "processName": "流程名称",
        "nodes": "【节点1】→【节点2】→...",
        "actor": "主责角色",
        "scope": "组织覆盖范围（全集团/单校区/跨分支）",
        "logicAndRules": "业务规则、准入门槛或审批逻辑",
        "dataAsset": "产生的单据/数据（标注是否有组织标识）"
      }
    ]
  },
  "managementResources": {
    "peopleResource": "资质认证、多点执业、角色等级成长需求",
    "financeResource": "多级结算、预算管控、资金归集、分润划拨需求",
    "assetResource": "实物/数字资产分布与借调",
    "informationAsset": "知识库授权、各级看板监控需求"
  },
  "roadmap": {
    "phase1_Critical": { "focus": "核心战役", "deliverables": ["功能点"] },
    "phase2_Strategic": { "focus": "后续优化" },
    "overallUrgency": "判定理由"
  }
}

# Constraints (硬性约束)
1. **状态机驱动**：必须识别对象的生命周期。所有状态变迁必须关联“钱”的流向（分成、补偿、扣费）和“时间”的变动（有效期延展）。
2. **多维度扫描**：强制识别并提取“人”的准入（招募、签约）和“钱”的闭环（下单、分润结算）。
3. **组织敏感性**：所有对象必须判断“组织标识”。涉及分成需明确是“个人间补偿”还是“跨机构结算”。
4. **推演补全**：根据文档描述（如“全国6城”）自动推演 orgTopology；根据利益描述自动推演 financeResource 需求。
5. **缺失处理**：若某维度完全未提及，在该维度对应字段填入 "NOT_SPECIFIED" 或省略该键（勿编造）。
6. **纯净输出**：仅返回 JSON 纯文本（不要 Markdown 代码围栏、不要前言/后记说明）。
7. **人员组织与对象—状态口径一致（硬性）**：输出须**自洽**。在写 \`operationModel.orgAndRoles\` 前，先在**同一份 JSON** 中写清 \`coreBusinessEntities\`（各条 \`entityName\`、\`conceptCategory\`、\`conceptExplanation\`、\`ownershipLogic\` 等全文）、\`stateTransitionMatrix\`（每条 \`actor\`）、\`operationModel.fullValueStreams\`（每条 \`actor\`）。将上述四处文本中出现的**干系人/岗位/角色称谓**归并为**可引用角色池**（去同义重复）。\`stakeholders\` 中每一条（含「标题：正文」格式时**冒号后的正文**）所列举的**每一个具体岗位或角色称谓**，必须能在**可引用角色池**中找到相同或明确同义表述；**禁止**输出池中不存在的称谓，**禁止**凭常识臆造原文与上述字段均未支撑的角色。
8. **人员组织去重与结构（硬性）**：\`stakeholders\` 为字符串数组；**同一角色称谓不得在多条条目中重复出现**。「总部角色」「分支角色」等组织侧维度**各至多一条**；若原文对同一维度多次描述，须**合并为一条**，文内角色列表用顿号或逗号并列且**去重**。**禁止**用多条同标题或近义标题（如两条「分支角色」）重复罗列。
9. **核心对象概念维度（硬性）**：\`coreBusinessEntities\` **每一条**须含 \`conceptCategory\` 与 \`conceptExplanation\`。\`conceptCategory\` 只能是 **「人」「财」「物」「事」** 之一；无法明确归类时用 **「事」**。\`conceptExplanation\` 为 **100 个字符以内**（按 Unicode 标量计，含标点），须写成 **完整句子**：**禁止**在词或句子中间截断（句末须为 **。**、**！**、**？** 或 **；** 之一，允许一至两句）；须**引用客户需求中的场景信息**说明该对象在业务里是什么、起何作用；**禁止**仅用「实体层」「领域对象」等空洞架构词而无场景。
10. **JSON 语法（硬性）**：输出必须是单个可解析对象。键名与字符串边界仅使用 ASCII 双引号 \`"\`。字符串内引用优先用中文「」。禁止在值内出现未转义的 \`"\`。元素分隔仅使用英文逗号 \`,\`。`;

  /** task1：用户已有一份 V2 初步需求 JSON 时的补充/修订（按最新 V2 格式输出 preliminaryReq + 修改要点） */
  const PRELIMINARY_V2_REFINE_SYSTEM_PROMPT = `你是一位资深需求分析专家。系统中已有一份「企业背景洞察」阶段的新版初步需求结构化 JSON（V2 最新格式）。

根据用户的**补充或修改意见**，输出修订后的 preliminaryReq（结构与现有 V2 语义一致，可为字段级子集，不强制六键齐全），并给出面向业务同事阅读的修改要点。

## 输出格式（仅返回一个 JSON 对象，不要 Markdown 代码围栏）：
{
  "modificationSummaryMarkdown": "使用 ### 小标题与 - 列表，2～8 条，说明本次依据用户意见做了哪些调整",
  "preliminaryReq": { 按本次修改范围输出的 V2 结构对象 }
}

## 规则：
1. preliminaryReq 按本次修改范围输出；不得要求或补齐与本次无关的字段。
2. 对用户未提及的字段，不在输出里展开；由上层合并逻辑保留当前版本原意。
3. **禁止无故删减**：凡本次输出中出现的**数组型**字段（如 coreBusinessEntities、stateTransitionMatrix、painPointRadar、operationModel.fullValueStreams、itLandscape 中的列表项、roadmap 下的 deliverables 等），必须在**保留当前版本中全部既有元素**的前提下做整合；仅允许：① 按用户意见**改写**已有条目（同一业务维度/domain+processName、同一 entity+状态转移键等应对齐后更新）；② **新增**条目；③ 用户明确要求删除时方可删除。**禁止**仅根据补充片段重新生成一份更短的列表从而丢掉未在补充中再次出现的旧条目。
4. 缺失信息仍用 "NOT_SPECIFIED"（适用字段）。
5. operationModel 可按修改范围输出 fullValueStreams 与/或 valueStreamMapping（兼容别名）；二者不必同时输出；若输出其中之一为数组，须与当前版本**并集**融合而非整表替换为更短列表。
6. modificationSummaryMarkdown 必须为中文。
7. 若本次修订涉及 \`operationModel.orgAndRoles\`（尤其 \`stakeholders\`），须与深度提炼**同一套硬性规则**：角色称谓仅能来自修订后 preliminaryReq 中 \`coreBusinessEntities\` 全文、\`stateTransitionMatrix[].actor\`、\`operationModel.fullValueStreams[].actor\` 所构成的**可引用角色池**；\`stakeholders\` 内**不得重复**同一角色，「总部角色」「分支角色」等维度**各至多一条**且文内去重。
8. **JSON 语法**：整段须可被标准 JSON.parse；字符串边界仅用 ASCII \`"\`，值内引号须 \`\\"\` 或改用「」；字段分隔仅用英文逗号，勿用中文顿号充当 JSON 逗号。`;

  /** task1：将「新补充提炼结果」与「当前版本」进行字段级融合，输出字段级结果与修改动作摘要 */
  const PRELIMINARY_V2_MERGE_SYSTEM_PROMPT = `你是一位资深需求分析专家。系统里有两份初步需求 V2 JSON：
1) 当前工作区版本（currentPreliminaryReq）
2) 基于用户最新补充单独提炼得到的新版本（newExtractedPreliminaryReq）

你的任务是：仅融合输入中提供的字段范围，不得涉及未提供字段。
例如本次仅提供「商业背景」，就只输出商业背景融合结果，禁止输出痛点、IT现状等其它字段。
若本次仅提供「核心对象」\`coreBusinessEntities\` 或仅「状态逻辑」\`stateTransitionMatrix\`，则 \`preliminaryReq\` 中**只**输出输入块里实际出现的对应键，禁止输出痛点等其它未提供字段。

## 输出格式（仅返回一个 JSON 对象，不要 Markdown 代码围栏）：
{
  "modificationSummaryMarkdown": "使用 ### 小标题与 - 列表，2～8 条，说明相较上一版有哪些新增/修订/保留",
  "preliminaryReq": { 仅包含本次输入字段范围内的对象 }
}

## 规则：
1. 仅合并输入中提供的字段，禁止编造或输出未提供字段。
2. 以 newExtractedPreliminaryReq 为“新增信息来源”，但**不得无故删除** currentPreliminaryReq 在该字段内的既有有效信息；语义为**在完整保留 current 的基础上修订与追加**，**禁止**用更短的列表或未含 current 全部条目的数组**整体替换**该字段。
3. **数组型字段硬性要求**（凡 preliminaryReq 中本次涉及的数组，包括但不限于 coreBusinessEntities、stateTransitionMatrix、painPointRadar、operationModel.fullValueStreams、operationModel.valueStreamMapping、itLandscape 内各系统列表、roadmap 内 deliverables 等）：输出数组须**包含当前版本在该路径下的全部既有元素**，再并入补充带来的新增或修订；同一业务键（如痛点 dimension、流程 domain+processName、价值流节点 step、实体 entityName+identifier、转移 entity+fromState+toState+triggerEvent 等）以 newExtracted 与用户补充为准**覆盖**旧条目，但**未**出现在 newExtracted 中的旧条目必须**原样保留**在输出中。**禁止**输出比当前更短的数组导致旧流程/旧痛点/旧实体/旧转移被静默删除。系统落库时仍会对上述关键数组与 current 再做**按键并集兜底**，但模型仍须遵守本条约以减少偏差。
4. 对冲突信息，按“用户最新补充”优先，并保证该字段内部自洽。
5. 缺失信息保留 "NOT_SPECIFIED"（适用字段）。
6. operationModel 可按输入范围融合 fullValueStreams 与/或 valueStreamMapping；以新版本为增量来源，兼容字段可并存；融合结果须满足上文「数组不丢项」约束。
7. modificationSummaryMarkdown 必须为中文。
8. **JSON 语法**：整段须可被标准 JSON.parse；字符串边界仅用 ASCII \`"\`，值内引号须 \`\\"\` 或改用「」；字段分隔仅用英文逗号，勿用中文顿号充当 JSON 逗号。
9. **preliminaryReq 禁止为空对象**：凡 user 输入块中给出了 \`coreBusinessEntities\` 与/或 \`stateTransitionMatrix\`（或其它 V2 顶层键），返回的 \`preliminaryReq\` 中**必须**至少包含这些键之一且值为合法数组或对象；禁止仅输出 \`modificationSummaryMarkdown\` 而 \`preliminaryReq\` 为 \`{}\` 或缺键。
10. 若本次融合涉及 \`operationModel.orgAndRoles.stakeholders\`：在遵守「数组不丢项」前提下，对条目做**语义合并去重**（同维度标题合并、角色名去重），且融合后的角色称谓须仍能在**输出 preliminaryReq** 的 \`coreBusinessEntities\` 全文、\`stateTransitionMatrix[].actor\`、\`fullValueStreams[].actor\` 中找到依据；**禁止**借机引入上述三处均无依据的新角色。`;

  /** task1 分段合并：状态逻辑按「单行」并入当前矩阵时专用（输入仅为当前矩阵 + 一条新提炼行，见 \`mergePreliminaryStmRowIntoMatrixByLlm\`） */
  const PRELIMINARY_V2_STM_ROW_MERGE_SYSTEM_PROMPT = `你是一位资深需求分析专家。用户正在进行「状态转移矩阵」的逐条增量合并。
输入仅包含两部分 JSON：
1) currentStateTransitionMatrix：当前工作区已存在的**完整**状态转移数组
2) newExtractedRow：本次从用户补充中**新提炼的单一转移行**（一个对象，结构与 V2 中 stateTransitionMatrix 的元素一致：entity、fromState、toState、triggerEvent、actor、guards、sideEffects 等）

你的任务：将 newExtractedRow **合并进** currentStateTransitionMatrix，输出合并后的**完整**数组。

## 输出格式（仅返回一个 JSON 对象，不要 Markdown 代码围栏）：
{
  "modificationSummaryMarkdown": "使用 ### 小标题与 - 列表，1～5 条，说明本条转移相对合并前为新增、修订或与某条既有转移对齐覆盖",
  "preliminaryReq": {
    "stateTransitionMatrix": [ ]
  }
}

## 规则：
1. 输出 \`preliminaryReq.stateTransitionMatrix\` 必须**包含 current 中的全部既有行**；若 newExtractedRow 与某条既有转移为同一业务键（见下条），则以新行**覆盖**该条，**不得**删除其它无关行。
2. 判定「同一转移」时与常见合并逻辑一致：以 entity、fromState、toState、triggerEvent 等字段综合判定（语义相同即视为同键）；同键时以 newExtractedRow 与用户最新补充为准更新各字段。
3. 若为**全新**转移（业务键在 current 中不存在），在保留全部旧行前提下**追加**该行。
4. **禁止**输出比 current 行数更少的结果以致静默丢失未参与本条合并的旧行。
5. modificationSummaryMarkdown 必须为中文。
6. **JSON 语法**：整段须可被标准 JSON.parse；字符串边界仅用 ASCII \`"\`，值内引号须 \`\\"\` 或改用「」；字段分隔仅用英文逗号。
7. **preliminaryReq** 不得为空对象；**必须**含合法数组 \`stateTransitionMatrix\`，且为合并后的完整结果。`;

  /** task1：同一 entity 下多条新提炼转移，与当前工作区该 entity 已有转移合并（user 仅含该 entity 的 current + new 两段数组） */
  const PRELIMINARY_V2_STM_ENTITY_MERGE_SYSTEM_PROMPT = `你是一位资深需求分析专家。用户正在按**业务对象（entity）**增量合并状态转移矩阵。
输入仅包含两部分 JSON（均只含**同一 entity** 下的转移行）：
1) currentRowsForEntity：当前工作区中该对象已有的状态转移数组
2) newExtractedRows：本次从用户补充中**新提炼的**该对象状态转移数组（可多条）

你的任务：将 newExtractedRows **合并进** currentRowsForEntity，输出该对象**合并后的完整**转移数组（仅该 entity，不要包含其它对象的行）。

## 输出格式（仅返回一个 JSON 对象，不要 Markdown 代码围栏）：
{
  "modificationSummaryMarkdown": "使用 ### 小标题与 - 列表，2～8 条，说明新增/修订/覆盖的转移",
  "preliminaryReq": {
    "stateTransitionMatrix": [ ]
  }
}

## 规则：
1. 输出的 \`stateTransitionMatrix\` **只含本 entity** 下的行；须**完整保留** currentRowsForEntity 中未被 newExtractedRows 按业务键覆盖的既有行。
2. 同一转移的业务键以 entity + fromState + toState + triggerEvent 等判定；同键时以 newExtractedRows 与用户最新补充为准更新。
3. **禁止**输出比 currentRowsForEntity 行数更少的结果以致静默丢失未涉及修改的旧行（除非与 new 明确为同键覆盖）。
4. newExtractedRows 中的新键须**追加**到结果中。
5. modificationSummaryMarkdown 必须为中文。
6. **JSON 语法**：整段须可被标准 JSON.parse；字符串边界仅用 ASCII \`"\`，值内引号须 \`\\"\` 或改用「」。
7. **preliminaryReq.stateTransitionMatrix** 不得省略且须为非空数组（无增量时可与 current 一致复制）。`;

  /** task1 补充需求：在全文深度提炼之后，专门针对核心业务对象再提炼一轮（仅输出该数组） */
  const PRELIMINARY_V2_SUPPLEMENT_SLICE_CORE_ENTITIES_PROMPT = `你是一位资深需求分析专家。用户提供了对初步需求的**补充说明**（见 user）。请**仅**从中识别与提炼 **核心业务对象**（与 V2 中 coreBusinessEntities 项结构一致：entityName、identifier、conceptCategory、conceptExplanation、lifecycleStates、ownershipLogic）。

## 输出（仅一个 JSON 对象，不要 Markdown 代码围栏）
{
  "coreBusinessEntities": [
    {
      "entityName": "…",
      "identifier": "…",
      "conceptCategory": "人 | 财 | 物 | 事",
      "conceptExplanation": "100 字以内、完整句场景化说明",
      "lifecycleStates": ["…"],
      "ownershipLogic": "…"
    }
  ]
}

## 规则
1. **只**包含顶层键 coreBusinessEntities；数组可为空（补充中完全未涉及对象时）。
2. 每条须含 \`conceptCategory\`（仅「人」「财」「物」「事」之一）与 \`conceptExplanation\`（≤100 字符、一至两句完整中文句、句末须为 。！？或；、禁半截句/禁纯架构空话）；无法归类时用「事」。
3. 输出须可被 JSON.parse；键名与字符串边界仅用 ASCII 双引号；字符串内引号使用「」或 \`\\"\`。
4. 严格依据补充说明，禁止编造与补充无关的实体。`;

  /** task1 补充需求：在全文深度提炼之后，专门针对状态转移矩阵再提炼一轮（仅输出该数组） */
  const PRELIMINARY_V2_SUPPLEMENT_SLICE_STATE_LOGIC_PROMPT = `你是一位资深需求分析专家。用户提供了对初步需求的**补充说明**（见 user）。请**仅**从中识别与提炼 **状态转移矩阵**（与 V2 中 stateTransitionMatrix 项结构一致：entity、fromState、toState、triggerEvent、actor、guards、sideEffects 等）。

## 输出（仅一个 JSON 对象，不要 Markdown 代码围栏）
{
  "stateTransitionMatrix": [
    {
      "entity": "…",
      "fromState": "…",
      "toState": "…",
      "triggerEvent": "…",
      "actor": "…",
      "guards": "…",
      "sideEffects": { "financeImpact": "…", "timeImpact": "…", "dataSnapshot": "…" }
    }
  ]
}

## 规则
1. **只**包含顶层键 stateTransitionMatrix；数组可为空。
2. 输出须可被 JSON.parse；键名与字符串边界仅用 ASCII 双引号。
3. 转移应与对象生命周期口径一致；未提及则为空数组。`;

  /** @deprecated 保留常量名供外部引用；与 V2 深度提炼相同 */
  const PRELIMINARY_SYSTEM_PROMPT = PRELIMINARY_V2_DEPTH_SYSTEM_PROMPT;

  /**
   * 去掉模型常见的 ```json … ``` 围栏，便于定位 JSON。
   * @param {string} text
   * @returns {string}
   */
  function stripOptionalMarkdownJsonFence(text) {
    let s = String(text || '').trim();
    const m = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
    if (m) return String(m[1] || '').trim();
    const m2 = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (m2) return String(m2[1] || '').trim();
    return s;
  }

  /**
   * 从 `fromIndex` 处的 `{` 起按括号深度截取**一个**完整 JSON 对象（字符串内引号/转义感知）。
   * @param {string} text
   * @param {number} [fromIndex] 若为 number 则须指向 `{`；省略时从首个 `{` 开始。
   * @returns {string|null}
   */
  function extractBalancedJsonObjectFrom(text, fromIndex) {
    if (text == null) return null;
    const s = String(text);
    const start = typeof fromIndex === 'number' ? fromIndex : s.indexOf('{');
    if (start < 0 || start >= s.length || s[start] !== '{') return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (inString) {
        if (c === '\\') {
          escape = true;
          continue;
        }
        if (c === '"') {
          inString = false;
          continue;
        }
        continue;
      }
      if (c === '"') {
        inString = true;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
    return null;
  }

  /** @param {string} text @returns {string|null} */
  function extractFirstBalancedJsonObject(text) {
    const s = String(text || '');
    const start = s.indexOf('{');
    if (start < 0) return null;
    return extractBalancedJsonObjectFrom(s, start);
  }

  /** 模型偶发用中文顿号或全角逗号分隔 JSON 字段，在引号边界外做保守替换以尝试救回解析。 */
  function normalizeLlmJsonSeparators(s) {
    let t = String(s);
    t = t.replace(/",\s*，\s*"/g, '","');
    t = t.replace(/}\s*，\s*"/g, '},"');
    t = t.replace(/]\s*，\s*"/g, '],"');
    t = t.replace(/}\s*，\s*{/g, '},{');
    t = t.replace(/]\s*，\s*\[/g, '],[');
    t = t.replace(/"\s*，\s*"/g, '","');
    return t;
  }

  /** 将弯引号换成直角引号，避免模型在字符串内使用 \u201c\u201d 却仍夹杂非法 \`"\` 时难以阅读；对合法 JSON 无害。 */
  function normalizeCurlyQuotesForJson(s) {
    return String(s)
      .replace(/\u201c/g, '「')
      .replace(/\u201d/g, '」')
      .replace(/\u2018/g, '『')
      .replace(/\u2019/g, '』');
  }

  /** 收集可能含完整 V2 对象的片段（多 `{` 起点 + 围栏 + 贪婪兜底），按长度降序优先尝试最外层大对象。 */
  function collectPreliminaryJsonCandidateSlices(raw) {
    const text = String(raw || '');
    const fenced = stripOptionalMarkdownJsonFence(text);
    const slices = [];
    const seen = new Set();
    const add = (sl) => {
      const t = sl != null ? String(sl).trim() : '';
      if (!t || seen.has(t)) return;
      seen.add(t);
      slices.push(t);
    };
    add(fenced.trim());
    const MAX_BRACE = 80;
    const scan = (s) => {
      let n = 0;
      for (let i = 0; i < s.length && n < MAX_BRACE; i++) {
        if (s[i] === '{') {
          const sl = extractBalancedJsonObjectFrom(s, i);
          if (sl) {
            add(sl);
            n++;
          }
        }
      }
    };
    scan(fenced);
    scan(text);
    const greedy = text.match(/\{[\s\S]*\}/)?.[0];
    if (greedy) add(greedy);
    slices.sort((a, b) => b.length - a.length);
    return slices;
  }

  /**
   * 解析大模型返回中的 JSON 对象；多策略兜底；返回解析结果与用于回放的原始片段。
   * @param {string} content - 模型原文
   * @param {string} [contextLabel] - 日志/错误上下文
   * @returns {{ parsed: Object, rawSlice: string }}
   */
  function parsePreliminaryLlmJsonObject(content, contextLabel) {
    const label = contextLabel || 'preliminary-llm-json';
    const raw = String(content || '');
    const baseSlices = collectPreliminaryJsonCandidateSlices(raw);
    const variants = (slice) => {
      const a = String(slice).trim();
      const b = normalizeCurlyQuotesForJson(a);
      const c = normalizeLlmJsonSeparators(a);
      const d = normalizeLlmJsonSeparators(b);
      return [...new Set([a, b, c, d].filter(Boolean))];
    };
    let lastErr = '';
    for (const slice of baseSlices) {
      for (const t of variants(slice)) {
        try {
          const parsed = JSON.parse(t);
          if (parsed && typeof parsed === 'object') return { parsed, rawSlice: t };
        } catch (e) {
          lastErr = e?.message || String(e);
        }
      }
    }
    throw new Error(
      `[${label}] 大模型返回无法解析为合法 JSON（${lastErr || '未知'}）。可尝试缩短补充说明后重试；若持续失败请检查输出是否被截断或含多段 JSON。`,
    );
  }

  /** 深度合并两个普通对象（不含数组逐项合并，数组以右侧为准整体替换） */
  function mergeDeepObjects(a, b) {
    if (a == null || typeof a !== 'object' || Array.isArray(a)) return b !== undefined ? b : a;
    if (b == null || typeof b !== 'object' || Array.isArray(b)) return b !== undefined ? b : a;
    const out = { ...a };
    for (const key of Object.keys(b)) {
      const bv = b[key];
      const av = a[key];
      if (bv != null && typeof bv === 'object' && !Array.isArray(bv) && av != null && typeof av === 'object' && !Array.isArray(av)) {
        out[key] = mergeDeepObjects(av, bv);
      } else {
        out[key] = bv;
      }
    }
    return out;
  }

  /** `fullValueStreams` 单项业务键：domain + processName */
  function preliminaryFullValueStreamItemKey(item) {
    if (!item || typeof item !== 'object') {
      try {
        return `__raw__${JSON.stringify(item)}`;
      } catch (_) {
        return '__unknown__';
      }
    }
    const d = String(item.domain ?? '').trim();
    const p = String(item.processName ?? '').trim();
    const k = `${d}\n${p}`;
    if (k !== '\n') return k;
    try {
      return `__json__${JSON.stringify(item)}`;
    } catch (_) {
      return '__unknown__';
    }
  }

  /**
   * 合并业务流程数组：以 new 中同键项为准覆盖，new 未出现的旧项全部保留（防止模型缩表丢流程）。
   * @param {unknown[]} prev
   * @param {unknown[]} next
   */
  function mergePreliminaryFullValueStreamsArrays(prev, next) {
    if (!Array.isArray(next)) return Array.isArray(prev) ? prev.slice() : [];
    if (!Array.isArray(prev) || prev.length === 0) return next.slice();
    const nextKeys = new Set(next.map(preliminaryFullValueStreamItemKey));
    const out = next.slice();
    for (const it of prev) {
      const key = preliminaryFullValueStreamItemKey(it);
      if (!nextKeys.has(key)) out.push(it);
    }
    return out;
  }

  /** 痛点雷达单项键：dimension */
  function preliminaryPainPointItemKey(item) {
    if (!item || typeof item !== 'object') {
      try {
        return `__raw__${JSON.stringify(item)}`;
      } catch (_) {
        return '__unknown__';
      }
    }
    const dim = String(item.dimension ?? '').trim();
    if (dim) return dim;
    try {
      return `__json__${JSON.stringify(item)}`;
    } catch (_) {
      return '__unknown__';
    }
  }

  function mergePreliminaryPainPointRadarArrays(prev, next) {
    if (!Array.isArray(next)) return Array.isArray(prev) ? prev.slice() : [];
    if (!Array.isArray(prev) || prev.length === 0) return next.slice();
    const nextKeys = new Set(next.map(preliminaryPainPointItemKey));
    const out = next.slice();
    for (const it of prev) {
      const key = preliminaryPainPointItemKey(it);
      if (!nextKeys.has(key)) out.push(it);
    }
    return out;
  }

  /** 分析备注：字符串并集，先旧后新 */
  function mergePreliminaryAnalystNotesArrays(prev, next) {
    if (!Array.isArray(next)) return Array.isArray(prev) ? prev.slice() : [];
    if (!Array.isArray(prev) || prev.length === 0) return next.slice();
    const seen = new Set(prev.map((x) => String(x)));
    const out = prev.slice();
    for (const x of next) {
      const s = String(x);
      if (!seen.has(s)) {
        seen.add(s);
        out.push(x);
      }
    }
    return out;
  }

  /** `valueStreamMapping` 单项键：step（与 task4 兼容结构一致） */
  function preliminaryValueStreamMappingItemKey(item) {
    if (!item || typeof item !== 'object') {
      try {
        return `__raw__${JSON.stringify(item)}`;
      } catch (_) {
        return '__unknown__';
      }
    }
    const st = String(item.step ?? '').trim();
    if (st) return st;
    try {
      return `__json__${JSON.stringify(item)}`;
    } catch (_) {
      return '__unknown__';
    }
  }

  function mergePreliminaryValueStreamMappingArrays(prev, next) {
    if (!Array.isArray(next)) return Array.isArray(prev) ? prev.slice() : [];
    if (!Array.isArray(prev) || prev.length === 0) return next.slice();
    const nextKeys = new Set(next.map(preliminaryValueStreamMappingItemKey));
    const out = next.slice();
    for (const it of prev) {
      const key = preliminaryValueStreamMappingItemKey(it);
      if (!nextKeys.has(key)) out.push(it);
    }
    return out;
  }

  /**
   * 首段全角/半角冒号拆「标题：正文」；无冒号则 title 空、body 为整段（人员组织 `stakeholders` 字符串条目用）。
   * @param {string} raw
   * @returns {{ title: string, body: string }}
   */
  function splitPrelimColonTitleBody(raw) {
    const s = String(raw || '').trim();
    if (!s || s === 'NOT_SPECIFIED') return { title: '', body: '' };
    const iCn = s.indexOf('：');
    const iEn = s.indexOf(':');
    let i = -1;
    if (iCn >= 0 && (iEn < 0 || iCn <= iEn)) i = iCn;
    else if (iEn >= 0) i = iEn;
    if (i < 0) return { title: '', body: s };
    const title = s.slice(0, i).trim();
    const body = s.slice(i + 1).trim();
    if (!title) return { title: '', body: s };
    return { title, body: body || '—' };
  }

  /** 人员组织条目标题归一化键（去空白），用于合并「总部角色」与「总 部 角 色」 */
  function normalizeOrgStakeholderTitleKey(titleRaw) {
    const t = String(titleRaw || '').trim().replace(/\s+/g, '');
    return t || '__untitled__';
  }

  /** 将「正文」拆成角色称谓列表（顿号/逗号/分号等） */
  function parseOrgStakeholderBodyRoleTokens(body) {
    const s = String(body || '').trim();
    if (!s || s === 'NOT_SPECIFIED') return [];
    return s
      .split(/[,，、；;]\s*|\s+(?:与|和|及)\s+/)
      .map((x) => String(x).trim())
      .filter((x) => x && x !== 'NOT_SPECIFIED');
  }

  /** 多段正文解析出的角色列表：按出现顺序并集，按去空白后的键去重 */
  function mergeOrgStakeholderTokenListsPreserveOrder(lists) {
    const seen = new Set();
    const out = [];
    for (const list of lists) {
      for (const tok of list) {
        const trimmed = String(tok).trim();
        const nk = trimmed.replace(/\s+/g, '');
        if (!nk || seen.has(nk)) continue;
        seen.add(nk);
        out.push(trimmed);
      }
    }
    return out;
  }

  /**
   * 持续补充合并后常见多条「总部角色：…」「分支角色：…」；合并为同标题单条，角色名去重。
   * 非字符串项（对象）保留在数组末尾，供渲染走 JSON 子卡。
   * @param {unknown[]} sh
   * @returns {unknown[]}
   */
  function consolidateOrgAndRolesStakeholdersArray(sh) {
    if (!Array.isArray(sh) || sh.length === 0) return Array.isArray(sh) ? sh.slice() : [];
    const byTitle = new Map();
    const titleOrder = [];
    const rawObjects = [];
    for (const item of sh) {
      if (item != null && typeof item === 'object' && !Array.isArray(item)) {
        rawObjects.push(item);
        continue;
      }
      const fullText = item == null ? '' : String(item).trim();
      if (!fullText || fullText === 'NOT_SPECIFIED') continue;
      const { title, body } = splitPrelimColonTitleBody(fullText);
      const key = normalizeOrgStakeholderTitleKey(title);
      if (!byTitle.has(key)) {
        byTitle.set(key, { displayTitle: title.trim(), tokensLists: [] });
        titleOrder.push(key);
      }
      const rec = byTitle.get(key);
      const bodyTokens = title.trim() ? parseOrgStakeholderBodyRoleTokens(body) : parseOrgStakeholderBodyRoleTokens(fullText);
      rec.tokensLists.push(bodyTokens);
    }
    if (titleOrder.length === 0) return sh.slice();

    const preferredOrder = ['总部角色', '分支角色'];
    function prefRank(key) {
      const dt = String(byTitle.get(key)?.displayTitle || '').replace(/\s+/g, '');
      const pi = preferredOrder.findIndex((p) => p.replace(/\s+/g, '') === dt);
      return pi >= 0 ? pi : 100 + titleOrder.indexOf(key);
    }
    const sortedKeys = [...titleOrder].sort((a, b) => prefRank(a) - prefRank(b));

    const out = [];
    for (const k of sortedKeys) {
      const rec = byTitle.get(k);
      const merged = mergeOrgStakeholderTokenListsPreserveOrder(rec.tokensLists);
      const displayTitle =
        rec.displayTitle ||
        (k === '__untitled__' ? '干系人 / 角色' : k);
      if (merged.length === 0) {
        out.push(`${displayTitle}：—`);
      } else {
        out.push(`${displayTitle}：${merged.join('、')}`);
      }
    }
    return [...out, ...rawObjects];
  }

  /** 字符串列表：旧序优先，追加新中出现的未重复项 */
  function mergePreliminaryStringListArraysUnion(prev, next) {
    if (!Array.isArray(next)) return Array.isArray(prev) ? prev.slice() : [];
    if (!Array.isArray(prev) || prev.length === 0) return next.slice();
    const seen = new Set(prev.map((x) => String(x).trim()));
    const out = prev.slice();
    for (const x of next) {
      const t = String(x).trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(x);
      }
    }
    return out;
  }

  /** 干系人数组：先按整段指纹并集（保留对象项），再按标题合并、角色去重 */
  function mergePreliminaryStakeholdersArraysUnion(prev, next) {
    if (!Array.isArray(next)) return consolidateOrgAndRolesStakeholdersArray(Array.isArray(prev) ? prev.slice() : []);
    if (!Array.isArray(prev) || prev.length === 0) return consolidateOrgAndRolesStakeholdersArray(next.slice());
    const sig = (x) => {
      try {
        return typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x);
      } catch (_) {
        return String(x);
      }
    };
    const seen = new Set(prev.map(sig));
    const out = prev.slice();
    for (const x of next) {
      const s = sig(x);
      if (!seen.has(s)) {
        seen.add(s);
        out.push(x);
      }
    }
    return consolidateOrgAndRolesStakeholdersArray(out);
  }

  /** 核心对象概念类别：仅允许 人、财、物、事 */
  const PRELIMINARY_CBE_CONCEPT_CATEGORIES = ['人', '财', '物', '事'];

  /** 概念解释：与深度/切片提示词上限一致；展示与合并截断用 */
  const PRELIMINARY_CBE_CONCEPT_EXPL_MAX_UNICODE = 100;

  /** @param {unknown} raw */
  function normalizeCoreEntityConceptCategory(raw) {
    const s = String(raw ?? '').trim();
    if (PRELIMINARY_CBE_CONCEPT_CATEGORIES.includes(s)) return s;
    return '事';
  }

  /** @param {Record<string, unknown>|null|undefined} item */
  function getCoreEntityConceptCategoryRaw(item) {
    if (!item || typeof item !== 'object') return '';
    const v = item.conceptCategory ?? item['概念类别'];
    return v != null ? String(v).trim() : '';
  }

  /** @param {Record<string, unknown>|null|undefined} item */
  function getCoreEntityConceptExplanationRaw(item) {
    if (!item || typeof item !== 'object') return '';
    const v = item.conceptExplanation ?? item['概念解释'];
    return v != null ? String(v).trim() : '';
  }

  /** 截断为最多 maxChars 个 Unicode 字符（通用） */
  function truncatePrelimUnicodeChars(text, maxChars) {
    const ch = Array.from(String(text ?? ''));
    if (ch.length <= maxChars) return ch.join('');
    return ch.slice(0, maxChars).join('');
  }

  /**
   * 概念解释展示/合并：最多 maxChars 个 Unicode 字符；超长时优先在句末标点（。！？；）处收束，避免半截句。
   * 句末窗口内无则再尝试逗号、顿号；仍无则硬截断至 maxChars。
   */
  function truncatePrelimConceptExplanationUnicodeChars(text, maxChars) {
    const ch = Array.from(String(text ?? ''));
    if (ch.length <= maxChars) return ch.join('');
    const slice = ch.slice(0, maxChars);
    const sentenceEnds = new Set(['。', '！', '？', '；']);
    const lookbackSentence = 40;
    const startS = Math.max(0, maxChars - lookbackSentence);
    for (let i = maxChars - 1; i >= startS; i--) {
      if (sentenceEnds.has(slice[i])) {
        return slice.slice(0, i + 1).join('');
      }
    }
    const lookbackComma = 22;
    const startC = Math.max(0, maxChars - lookbackComma);
    for (let i = maxChars - 1; i >= startC; i--) {
      if (slice[i] === '，' || slice[i] === '、') {
        return slice.slice(0, i + 1).join('');
      }
    }
    return slice.join('');
  }

  /** @param {Record<string, unknown>|null|undefined} a @param {Record<string, unknown>|null|undefined} b */
  function pickCoreEntityConceptCategoryMerged(a, b) {
    const rb = getCoreEntityConceptCategoryRaw(b);
    if (rb) return normalizeCoreEntityConceptCategory(rb);
    const ra = getCoreEntityConceptCategoryRaw(a);
    if (ra) return normalizeCoreEntityConceptCategory(ra);
    return '事';
  }

  /** @param {Record<string, unknown>|null|undefined} a @param {Record<string, unknown>|null|undefined} b */
  function pickCoreEntityConceptExplanationMerged(a, b) {
    const tb = truncatePrelimConceptExplanationUnicodeChars(
      getCoreEntityConceptExplanationRaw(b),
      PRELIMINARY_CBE_CONCEPT_EXPL_MAX_UNICODE
    );
    const ta = truncatePrelimConceptExplanationUnicodeChars(
      getCoreEntityConceptExplanationRaw(a),
      PRELIMINARY_CBE_CONCEPT_EXPL_MAX_UNICODE
    );
    if (tb.length >= ta.length) return tb;
    return ta;
  }

  /** 核心业务对象名归一化：trim、合并空白，用于同对象去重（如「教练」与「教练 」视为同一对象） */
  function normalizeCoreEntityNameKey(raw) {
    const s = String(raw ?? '').trim();
    if (!s || s === 'NOT_SPECIFIED') return '';
    return s.replace(/\s+/g, '');
  }

  /** 无有效 entityName 时回退到 JSON 指纹，避免异构脏数据被误合并 */
  function preliminaryCoreBusinessEntityItemKey(item) {
    if (!item || typeof item !== 'object') {
      try {
        return `__raw__${JSON.stringify(item)}`;
      } catch (_) {
        return '__unknown__';
      }
    }
    const name = String(item.entityName ?? '').trim();
    const id = String(item.identifier ?? '').trim();
    const key = `${name}\u0000${id}`;
    if (key !== '\u0000') return key;
    try {
      return `__json__${JSON.stringify(item)}`;
    } catch (_) {
      return '__unknown__';
    }
  }

  /** 核心业务对象去重键：优先归一化后的 entityName；无名称时回退 itemKey */
  function preliminaryCoreBusinessEntityDedupKey(item) {
    const nk = normalizeCoreEntityNameKey(item?.entityName);
    if (nk) return `name:${nk}`;
    return preliminaryCoreBusinessEntityItemKey(item);
  }

  function ownershipLogicTextLen(x) {
    const t = String(x ?? '').trim();
    if (!t || t === 'NOT_SPECIFIED') return 0;
    return t.length;
  }

  /** 合并两条核心对象记录：`b` 在标量冲突上优先（符合补充/修订覆盖语义） */
  function mergeCoreBusinessEntityRecordsPreferB(a, b) {
    if (!a || typeof a !== 'object') return b && typeof b === 'object' ? { ...b } : a || b;
    if (!b || typeof b !== 'object') return { ...a };
    const out = { ...a, ...b };
    const lsA = Array.isArray(a.lifecycleStates) ? a.lifecycleStates : [];
    const lsB = Array.isArray(b.lifecycleStates) ? b.lifecycleStates : [];
    out.lifecycleStates = mergePreliminaryStringListArraysUnion(lsA, lsB);
    const la = ownershipLogicTextLen(a.ownershipLogic);
    const lb = ownershipLogicTextLen(b.ownershipLogic);
    if (lb > la) out.ownershipLogic = b.ownershipLogic;
    else out.ownershipLogic = a.ownershipLogic ?? b.ownershipLogic;
    const idb = String(b.identifier ?? '').trim();
    if (idb && idb !== 'NOT_SPECIFIED') out.identifier = b.identifier;
    else out.identifier = a.identifier ?? b.identifier;
    const neb = String(b.entityName ?? '').trim();
    const nea = String(a.entityName ?? '').trim();
    out.entityName = neb || nea;
    out.conceptCategory = pickCoreEntityConceptCategoryMerged(a, b);
    out.conceptExplanation = pickCoreEntityConceptExplanationMerged(a, b);
    delete out['概念类别'];
    delete out['概念解释'];
    return out;
  }

  /** 单数组内按归一化 entityName 去重，同键多条合并为一条 */
  function dedupeCoreBusinessEntitiesArray(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return Array.isArray(arr) ? arr.slice() : [];
    const map = new Map();
    const orderKeys = [];
    for (const it of arr) {
      if (!it || typeof it !== 'object') continue;
      const k = preliminaryCoreBusinessEntityDedupKey(it);
      if (!map.has(k)) {
        map.set(k, { ...it });
        orderKeys.push(k);
      } else {
        map.set(k, mergeCoreBusinessEntityRecordsPreferB(map.get(k), it));
      }
    }
    return orderKeys.map((k) => map.get(k));
  }

  /**
   * 核心业务对象：按归一化 entityName 并集；同对象多条合并为一条；顺序为 newExtracted 中键序优先，再追加仅存在于 current 的键（与旧 next-first 语义一致）。
   */
  function mergePreliminaryCoreBusinessEntitiesArrays(prev, next) {
    const p = Array.isArray(prev) ? prev : [];
    const n = Array.isArray(next) ? next : [];
    const map = new Map();
    const prevOrderKeys = [];
    for (const it of p) {
      if (!it || typeof it !== 'object') continue;
      const k = preliminaryCoreBusinessEntityDedupKey(it);
      if (!map.has(k)) {
        map.set(k, { ...it });
        prevOrderKeys.push(k);
      } else {
        map.set(k, mergeCoreBusinessEntityRecordsPreferB(map.get(k), it));
      }
    }
    const nextOrderKeys = [];
    const seenN = new Set();
    for (const it of n) {
      if (!it || typeof it !== 'object') continue;
      const k = preliminaryCoreBusinessEntityDedupKey(it);
      if (!seenN.has(k)) {
        seenN.add(k);
        nextOrderKeys.push(k);
      }
      if (!map.has(k)) {
        map.set(k, { ...it });
      } else {
        map.set(k, mergeCoreBusinessEntityRecordsPreferB(map.get(k), it));
      }
    }
    const inNext = new Set(nextOrderKeys);
    const tail = prevOrderKeys.filter((k) => !inNext.has(k));
    const orderedKeys = [...nextOrderKeys, ...tail];
    return orderedKeys.map((k) => map.get(k));
  }

  /** 状态转移矩阵：按 entity+from+to+trigger 键并集 */
  function preliminaryStateTransitionItemKey(item) {
    if (!item || typeof item !== 'object') {
      try {
        return `__raw__${JSON.stringify(item)}`;
      } catch (_) {
        return '__unknown__';
      }
    }
    const a = [
      String(item.entity ?? '').trim(),
      String(item.fromState ?? '').trim(),
      String(item.toState ?? '').trim(),
      String(item.triggerEvent ?? '').trim(),
    ].join('\u0001');
    if (a.replace(/\u0001/g, '').trim() !== '') return a;
    try {
      return `__json__${JSON.stringify(item)}`;
    } catch (_) {
      return '__unknown__';
    }
  }

  function mergePreliminaryStateTransitionMatrixArrays(prev, next) {
    if (!Array.isArray(next)) return Array.isArray(prev) ? prev.slice() : [];
    if (!Array.isArray(prev) || prev.length === 0) return next.slice();
    const nextKeys = new Set(next.map(preliminaryStateTransitionItemKey));
    const out = next.slice();
    for (const it of prev) {
      const key = preliminaryStateTransitionItemKey(it);
      if (!nextKeys.has(key)) out.push(it);
    }
    return out;
  }

  /** 从已去重的核心对象列表建立「归一化名 → 列表中的展示名 entityName」映射（先出现者优先） */
  function buildCanonicalEntityNameLookup(coreEntities) {
    const map = new Map();
    if (!Array.isArray(coreEntities)) return map;
    for (const e of coreEntities) {
      if (!e || typeof e !== 'object') continue;
      const disp = String(e.entityName ?? '').trim();
      if (!disp || disp === 'NOT_SPECIFIED') continue;
      const k = normalizeCoreEntityNameKey(disp);
      if (!k) continue;
      if (!map.has(k)) map.set(k, disp);
    }
    return map;
  }

  /**
   * 将矩阵中的 entity 文案解析为与核心对象列表一致的展示名（归一化键命中时）；否则保留 trim 后的原文。
   * @param {unknown} rawEntity
   * @param {Map<string, string>} canonicalMap
   */
  function resolveStateMatrixEntityDisplayName(rawEntity, canonicalMap) {
    const raw = rawEntity != null ? String(rawEntity).trim() : '';
    if (!raw || raw === 'NOT_SPECIFIED') return '未命名对象';
    const m = canonicalMap && canonicalMap instanceof Map ? canonicalMap : new Map();
    const k = normalizeCoreEntityNameKey(raw);
    if (k && m.size > 0 && m.has(k)) return m.get(k);
    return raw;
  }

  /** 对齐 entity 字段后按业务键去重转移行，避免同转移重复 */
  function dedupeStateTransitionMatrixRows(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return Array.isArray(arr) ? arr.slice() : [];
    const map = new Map();
    const order = [];
    for (const row of arr) {
      if (!row || typeof row !== 'object') continue;
      const k = preliminaryStateTransitionItemKey(row);
      if (!map.has(k)) {
        map.set(k, { ...row });
        order.push(k);
      } else {
        map.set(k, { ...map.get(k), ...row });
      }
    }
    return order.map((k) => map.get(k));
  }

  /**
   * 就地：核心对象去重合并、状态矩阵 entity 与核心对象展示名对齐并去重转移行。
   * @param {Object} prelim
   */
  function applyPreliminaryCoreEntitiesAndStateMatrixNormalizationMutating(prelim) {
    if (!prelim || typeof prelim !== 'object') return;
    if (Array.isArray(prelim.coreBusinessEntities)) {
      prelim.coreBusinessEntities = dedupeCoreBusinessEntitiesArray(prelim.coreBusinessEntities);
    }
    const map = buildCanonicalEntityNameLookup(prelim.coreBusinessEntities);
    if (Array.isArray(prelim.stateTransitionMatrix) && prelim.stateTransitionMatrix.length > 0) {
      for (const row of prelim.stateTransitionMatrix) {
        if (!row || typeof row !== 'object') continue;
        row.entity = resolveStateMatrixEntityDisplayName(row.entity, map);
      }
      prelim.stateTransitionMatrix = dedupeStateTransitionMatrixRows(prelim.stateTransitionMatrix);
    }
  }

  /**
   * 返回浅拷贝 + 核心对象/状态矩阵规范化副本（不修改入参），供详情工作区展示与未走 merge 的落库数据对齐。
   * @param {Object} prelim
   * @returns {Object}
   */
  function withPreliminaryCoreEntitiesAndStateMatrixNormalized(prelim) {
    if (!prelim || typeof prelim !== 'object') return prelim;
    const hasCore = Array.isArray(prelim.coreBusinessEntities);
    const hasStm = Array.isArray(prelim.stateTransitionMatrix);
    if (!hasCore && !hasStm) return prelim;
    const out = { ...prelim };
    if (hasCore) {
      out.coreBusinessEntities = dedupeCoreBusinessEntitiesArray(prelim.coreBusinessEntities.slice());
    }
    const lookupCore = Array.isArray(out.coreBusinessEntities) ? out.coreBusinessEntities : prelim.coreBusinessEntities;
    const canonMap = buildCanonicalEntityNameLookup(lookupCore);
    if (hasStm) {
      out.stateTransitionMatrix = prelim.stateTransitionMatrix.map((row) => {
        if (!row || typeof row !== 'object') return row;
        return { ...row, entity: resolveStateMatrixEntityDisplayName(row.entity, canonMap) };
      });
      out.stateTransitionMatrix = dedupeStateTransitionMatrixRows(out.stateTransitionMatrix);
    }
    return out;
  }

  function mergePreliminaryItLandscapeObjects(bk, nk) {
    const merged = mergeDeepObjects(bk, nk);
    if (!nk || typeof nk !== 'object' || Array.isArray(nk)) return merged;
    for (const fld of ['legacySystems', 'integrationRequirements']) {
      if (Array.isArray(nk[fld]) && Array.isArray(bk?.[fld])) {
        merged[fld] = mergePreliminaryStringListArraysUnion(bk[fld], nk[fld]);
      }
    }
    if (Array.isArray(nk.deploymentMode) && Array.isArray(bk?.deploymentMode)) {
      merged.deploymentMode = mergePreliminaryStringListArraysUnion(bk.deploymentMode, nk.deploymentMode);
    }
    return merged;
  }

  function mergePreliminaryRoadmapObjects(bk, nk) {
    const merged = mergeDeepObjects(bk, nk);
    if (!nk || typeof nk !== 'object' || Array.isArray(nk)) return merged;
    for (const phaseKey of ['phase1_Critical', 'phase2_Strategic']) {
      const nb = nk[phaseKey];
      const ob = bk?.[phaseKey];
      if (
        nb &&
        ob &&
        typeof nb === 'object' &&
        typeof ob === 'object' &&
        Array.isArray(nb.deliverables) &&
        Array.isArray(ob.deliverables)
      ) {
        merged[phaseKey] = { ...merged[phaseKey] };
        merged[phaseKey].deliverables = mergePreliminaryStringListArraysUnion(ob.deliverables, nb.deliverables);
      }
    }
    return merged;
  }

  /**
   * 合并 operationModel：对象仍递归合并，数组字段用并集策略，避免 fullValueStreams 等被缩表覆盖。
   * @param {Object} bk
   * @param {Object} nk
   */
  function mergePreliminaryOperationModelObjects(bk, nk) {
    const merged = mergeDeepObjects(bk, nk);
    if (!nk || typeof nk !== 'object' || Array.isArray(nk)) return merged;
    if (Array.isArray(nk.fullValueStreams)) {
      merged.fullValueStreams = mergePreliminaryFullValueStreamsArrays(
        Array.isArray(bk?.fullValueStreams) ? bk.fullValueStreams : [],
        nk.fullValueStreams,
      );
    }
    if (Array.isArray(nk.valueStreamMapping)) {
      merged.valueStreamMapping = mergePreliminaryValueStreamMappingArrays(
        Array.isArray(bk?.valueStreamMapping) ? bk.valueStreamMapping : [],
        nk.valueStreamMapping,
      );
    }
    if (
      nk.orgAndRoles &&
      bk?.orgAndRoles &&
      typeof nk.orgAndRoles === 'object' &&
      typeof bk.orgAndRoles === 'object' &&
      Array.isArray(nk.orgAndRoles.stakeholders) &&
      Array.isArray(bk.orgAndRoles.stakeholders)
    ) {
      merged.orgAndRoles = { ...merged.orgAndRoles };
      merged.orgAndRoles.stakeholders = mergePreliminaryStakeholdersArraysUnion(
        bk.orgAndRoles.stakeholders,
        nk.orgAndRoles.stakeholders,
      );
    }
    if (merged.orgAndRoles && Array.isArray(merged.orgAndRoles.stakeholders)) {
      merged.orgAndRoles = { ...merged.orgAndRoles };
      merged.orgAndRoles.stakeholders = consolidateOrgAndRolesStakeholdersArray(merged.orgAndRoles.stakeholders);
    }
    return merged;
  }

  /**
   * 将模型返回的 preliminaryReq 与当前版本按顶层键深度合并（对象递归合并；列表型业务字段用并集/按键覆盖，避免整表替换丢数据）。
   * @param {Object} prev - 当前持久化的 preliminaryReq
   * @param {Object} next - 模型输出的 preliminaryReq
   */
  function mergePreliminaryV2TopLevel(prev, next) {
    if (!next || typeof next !== 'object') return prev && typeof prev === 'object' ? { ...prev } : {};
    const base = prev && typeof prev === 'object' ? { ...prev } : {};
    const out = { ...base };
    for (const k of PRELIMINARY_V2_TOP_KEYS) {
      if (next[k] === undefined) continue;
      const nk = next[k];
      const bk = base[k];
      if (k === 'operationModel') {
        if (nk != null && typeof nk === 'object' && !Array.isArray(nk) && bk != null && typeof bk === 'object' && !Array.isArray(bk)) {
          out[k] = mergePreliminaryOperationModelObjects(bk, nk);
        } else {
          out[k] = nk;
        }
        continue;
      }
      if (k === 'itLandscape') {
        if (nk != null && typeof nk === 'object' && !Array.isArray(nk) && bk != null && typeof bk === 'object' && !Array.isArray(bk)) {
          out[k] = mergePreliminaryItLandscapeObjects(bk, nk);
        } else {
          out[k] = nk;
        }
        continue;
      }
      if (k === 'roadmap') {
        if (nk != null && typeof nk === 'object' && !Array.isArray(nk) && bk != null && typeof bk === 'object' && !Array.isArray(bk)) {
          out[k] = mergePreliminaryRoadmapObjects(bk, nk);
        } else {
          out[k] = nk;
        }
        continue;
      }
      if (k === 'painPointRadar' && Array.isArray(nk) && Array.isArray(bk)) {
        out[k] = mergePreliminaryPainPointRadarArrays(bk, nk);
        continue;
      }
      if (k === 'coreBusinessEntities' && Array.isArray(nk) && Array.isArray(bk)) {
        out[k] = mergePreliminaryCoreBusinessEntitiesArrays(bk, nk);
        continue;
      }
      if (k === 'stateTransitionMatrix' && Array.isArray(nk) && Array.isArray(bk)) {
        out[k] = mergePreliminaryStateTransitionMatrixArrays(bk, nk);
        continue;
      }
      if (k === 'analystNotes') {
        continue;
      }
      if (nk != null && typeof nk === 'object' && !Array.isArray(nk) && bk != null && typeof bk === 'object' && !Array.isArray(bk)) {
        out[k] = mergeDeepObjects(bk, nk);
      } else {
        out[k] = nk;
      }
    }
    applyPreliminaryCoreEntitiesAndStateMatrixNormalizationMutating(out);
    return out;
  }

  /** `next` 是否至少包含一个 V2 顶层键（允许字段级子集） */
  function hasAnyPreliminaryV2TopKey(next) {
    if (!next || typeof next !== 'object') return false;
    return PRELIMINARY_V2_TOP_KEYS.some((k) => next[k] !== undefined);
  }

  /**
   * 按 `template` 裁剪 current：只保留本次待合并字段，避免把其它字段传给模型。
   * - 对象：递归按同名键取交集
   * - 数组：若 current 是数组则整体保留（否则返回空数组）
   * - 标量：返回 current 标量
   */
  function pickCurrentScopedByTemplate(current, template) {
    if (template === undefined) return undefined;
    if (template === null) return current;
    if (Array.isArray(template)) return Array.isArray(current) ? current : [];
    if (typeof template !== 'object') return current;
    const curObj = current && typeof current === 'object' ? current : {};
    const out = {};
    Object.keys(template).forEach((k) => {
      const picked = pickCurrentScopedByTemplate(curObj[k], template[k]);
      if (picked !== undefined) out[k] = picked;
    });
    return out;
  }

  /**
   * 与 `mergePreliminaryRequirementV2ByLlm` 的 user 段 JSON 两侧数据源一致：裁剪后的当前字段 + 本次新提炼子集；完整展示请用 `buildPreliminaryMergeV2LlmInputFullText`。
   * @param {Object} currentPreliminaryReq
   * @param {Object} newExtractedPreliminaryReq
   * @returns {{ scopedCurrent: Object, newExtractedPreliminaryReq: Object } | null}
   */
  function buildPreliminaryMergeV2UserJsonPair(currentPreliminaryReq, newExtractedPreliminaryReq) {
    const cur = currentPreliminaryReq && typeof currentPreliminaryReq === 'object' ? currentPreliminaryReq : {};
    const next =
      newExtractedPreliminaryReq && typeof newExtractedPreliminaryReq === 'object' ? newExtractedPreliminaryReq : {};
    if (!hasAnyPreliminaryV2TopKey(next)) return null;
    const scopedCurrent = pickCurrentScopedByTemplate(cur, next);
    return {
      scopedCurrent: scopedCurrent && typeof scopedCurrent === 'object' ? scopedCurrent : {},
      newExtractedPreliminaryReq: next,
    };
  }

  /** 与 `mergePreliminaryRequirementV2ByLlm` 发往 API 的 `user.content` 字节级一致 */
  function buildPreliminaryMergeV2UserContentBlock(scopedCurrent, next) {
    const sc = scopedCurrent && typeof scopedCurrent === 'object' ? scopedCurrent : {};
    const nx = next && typeof next === 'object' ? next : {};
    return `【当前字段版本 currentPreliminaryReq】\n${JSON.stringify(sc, null, 2)}\n\n【新提炼字段版本 newExtractedPreliminaryReq】\n${JSON.stringify(nx, null, 2)}`;
  }

  /**
   * 与 `mergePreliminaryRequirementV2ByLlm` 返回的 `fullPrompt` 一致（【system】+【user】），供主聊天区在调用模型前完整展示。
   * @returns {string | null}
   */
  function buildPreliminaryMergeV2LlmInputFullText(currentPreliminaryReq, newExtractedPreliminaryReq) {
    const pair = buildPreliminaryMergeV2UserJsonPair(currentPreliminaryReq, newExtractedPreliminaryReq);
    if (!pair) return null;
    const userBlock = buildPreliminaryMergeV2UserContentBlock(pair.scopedCurrent, pair.newExtractedPreliminaryReq);
    return `【system】\n${PRELIMINARY_V2_MERGE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
  }

  /**
   * 基于用户反馈修订 V2 初步需求（合并写回对象 + 修改要点文案）。
   * @param {Object} currentPreliminaryReq - 当前 item.preliminaryReq（V2）
   * @param {string} userFeedbackText - 用户补充/修改说明
   */
  async function refinePreliminaryRequirementV2WithFeedback(currentPreliminaryReq, userFeedbackText) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const cur = currentPreliminaryReq && typeof currentPreliminaryReq === 'object' ? currentPreliminaryReq : {};
    const currentStr = JSON.stringify(cur, null, 2);
    const userBlock = `【当前已提炼的初步需求 JSON】\n${currentStr}\n\n【用户补充/修改意见】\n${String(userFeedbackText || '').trim()}`;
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: PRELIMINARY_V2_REFINE_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      { taskTag: 'task1-prelim-refine', maxOutputTokens: 8192 },
    );
    const { parsed, rawSlice: jsonStr } = parsePreliminaryLlmJsonObject(content, 'task1-prelim-refine');
    const summary = parsed.modificationSummaryMarkdown != null ? String(parsed.modificationSummaryMarkdown).trim() : '';
    const nextReq = parsed.preliminaryReq && typeof parsed.preliminaryReq === 'object' ? parsed.preliminaryReq : null;
    if (!nextReq || !isPreliminaryRequirementV2Shape(nextReq)) {
      throw new Error('修订结果不是有效的 V2 初步需求结构');
    }
    const merged = mergePreliminaryV2TopLevel(cur, nextReq);
    if (!isPreliminaryRequirementV2Shape(merged)) {
      throw new Error('合并后的初步需求结构无效');
    }
    const fullPrompt = `【system】\n${PRELIMINARY_V2_REFINE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    const defaultModel = global.DEEPSEEK_MODEL || 'deepseek-chat';
    return {
      mergedPreliminaryReq: merged,
      modificationSummaryMarkdown: summary || '（未生成修改要点）',
      fullPrompt,
      rawOutput: jsonStr,
      llmMeta: { usage: usage || {}, model: model || defaultModel, durationMs: durationMs || 0 },
    };
  }

  /**
   * 将「当前版本」与「用户补充后新提炼版本」进行 LLM 融合，返回合并结果与修改要点。
   * @param {Object} currentPreliminaryReq - 当前 item.preliminaryReq（V2）
   * @param {Object} newExtractedPreliminaryReq - 基于用户补充新提炼出的 V2
   */
  async function mergePreliminaryRequirementV2ByLlm(currentPreliminaryReq, newExtractedPreliminaryReq) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const cur = currentPreliminaryReq && typeof currentPreliminaryReq === 'object' ? currentPreliminaryReq : {};
    const next = newExtractedPreliminaryReq && typeof newExtractedPreliminaryReq === 'object' ? newExtractedPreliminaryReq : {};
    const pair = buildPreliminaryMergeV2UserJsonPair(cur, next);
    if (!pair) {
      throw new Error('待合并的新提炼结果未包含可合并的 V2 字段');
    }
    const userBlock = buildPreliminaryMergeV2UserContentBlock(pair.scopedCurrent, pair.newExtractedPreliminaryReq);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: PRELIMINARY_V2_MERGE_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      { taskTag: 'task1-prelim-merge', maxOutputTokens: 8192 },
    );
    const { parsed, rawSlice: jsonStr } = parsePreliminaryLlmJsonObject(content, 'task1-prelim-merge');
    let summary = parsed.modificationSummaryMarkdown != null ? String(parsed.modificationSummaryMarkdown).trim() : '';
    const mergedReqRaw = parsed.preliminaryReq && typeof parsed.preliminaryReq === 'object' ? parsed.preliminaryReq : null;
    let effectiveMergedReq = mergedReqRaw;
    if (!effectiveMergedReq || !hasAnyPreliminaryV2TopKey(effectiveMergedReq)) {
      // 模型常漏写 preliminaryReq 或返回 {}（尤其「对象与状态」步）；入参 next 已通过 hasAnyPreliminaryV2TopKey，与 current 做并集合并即可保证不丢补充提炼结果
      if (!hasAnyPreliminaryV2TopKey(next)) {
        throw new Error('融合结果未返回可用的 V2 字段');
      }
      effectiveMergedReq = next;
      const fallbackNote =
        '（系统自动兜底）大模型返回的 preliminaryReq 未包含有效 V2 顶层字段，已按本次输入的新提炼字段与当前版本执行并集合并。';
      summary = summary ? `${summary}\n\n${fallbackNote}` : fallbackNote;
    }
    const merged = mergePreliminaryV2TopLevel(cur, effectiveMergedReq);
    if (!isPreliminaryRequirementV2Shape(merged)) {
      throw new Error('融合后的初步需求结构无效');
    }
    const defaultModel = global.DEEPSEEK_MODEL || 'deepseek-chat';
    const fullPrompt = `【system】\n${PRELIMINARY_V2_MERGE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return {
      mergedPreliminaryReq: merged,
      modificationSummaryMarkdown: summary || '（未生成修改要点）',
      fullPrompt,
      rawOutput: jsonStr,
      llmMeta: { usage: usage || {}, model: model || defaultModel, durationMs: durationMs || 0 },
    };
  }

  /**
   * 状态逻辑单行合并：user 段仅含当前完整矩阵 + 一条新提炼行。
   * @param {unknown[]} currentMatrix
   * @param {Object} newRow
   */
  function buildPreliminaryStmRowMergeUserContent(currentMatrix, newRow) {
    const cur = Array.isArray(currentMatrix) ? currentMatrix : [];
    const row = newRow && typeof newRow === 'object' ? newRow : {};
    return `【当前完整状态转移矩阵 currentStateTransitionMatrix】\n${JSON.stringify(cur, null, 2)}\n\n【本批新提炼的单一转移行 newExtractedRow】\n${JSON.stringify(row, null, 2)}`;
  }

  /**
   * 与 \`mergePreliminaryStmRowIntoMatrixByLlm\` 调用前展示一致（system + user）。
   * @param {unknown[]} currentMatrix
   * @param {Object} newRow
   * @returns {string}
   */
  function buildPreliminaryStmRowMergeLlmInputFullText(currentMatrix, newRow) {
    const ub = buildPreliminaryStmRowMergeUserContent(currentMatrix, newRow);
    return `【system】\n${PRELIMINARY_V2_STM_ROW_MERGE_SYSTEM_PROMPT}\n\n【user】\n${ub}`;
  }

  /**
   * 将单条新提炼状态转移并入当前 V2 初步需求（仅 LLM 输入矩阵 + 该行；返回完整 preliminaryReq）。
   * @param {Object} currentPreliminaryReq
   * @param {Object} newRow - stateTransitionMatrix 中的一行
   */
  async function mergePreliminaryStmRowIntoMatrixByLlm(currentPreliminaryReq, newRow) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const cur = currentPreliminaryReq && typeof currentPreliminaryReq === 'object' ? currentPreliminaryReq : {};
    const row = newRow && typeof newRow === 'object' ? newRow : null;
    if (!row) throw new Error('待合并的状态转移行为空');
    const matrix = Array.isArray(cur.stateTransitionMatrix) ? cur.stateTransitionMatrix : [];
    const userBlock = buildPreliminaryStmRowMergeUserContent(matrix, row);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: PRELIMINARY_V2_STM_ROW_MERGE_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      { taskTag: 'task1-prelim-merge-stm-row', maxOutputTokens: 8192 },
    );
    const { parsed, rawSlice: jsonStr } = parsePreliminaryLlmJsonObject(content, 'task1-prelim-merge-stm-row');
    let summary = parsed.modificationSummaryMarkdown != null ? String(parsed.modificationSummaryMarkdown).trim() : '';
    const mergedReqRaw = parsed.preliminaryReq && typeof parsed.preliminaryReq === 'object' ? parsed.preliminaryReq : null;
    const stmFromModel =
      mergedReqRaw && Array.isArray(mergedReqRaw.stateTransitionMatrix) ? mergedReqRaw.stateTransitionMatrix : null;
    let effectiveStm = stmFromModel;
    if (
      !effectiveStm ||
      (matrix.length > 0 && effectiveStm.length < matrix.length)
    ) {
      effectiveStm = mergePreliminaryStateTransitionMatrixArrays(matrix, [row]);
      const fallbackNote =
        '（系统自动兜底）大模型返回的状态矩阵行数少于当前版本或未返回有效数组，已按当前矩阵与本条新提炼行执行按键并集合并。';
      summary = summary ? `${summary}\n\n${fallbackNote}` : fallbackNote;
    }
    const merged = mergePreliminaryV2TopLevel(cur, { stateTransitionMatrix: effectiveStm });
    if (!isPreliminaryRequirementV2Shape(merged)) {
      throw new Error('融合后的初步需求结构无效');
    }
    const defaultModel = global.DEEPSEEK_MODEL || 'deepseek-chat';
    const fullPrompt = `【system】\n${PRELIMINARY_V2_STM_ROW_MERGE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return {
      mergedPreliminaryReq: merged,
      modificationSummaryMarkdown: summary || '（未生成修改要点）',
      fullPrompt,
      rawOutput: jsonStr,
      llmMeta: { usage: usage || {}, model: model || defaultModel, durationMs: durationMs || 0 },
    };
  }

  /**
   * entity 分桶合并：user 段为当前该 entity 行 + 新提炼该 entity 行。
   * @param {unknown[]} currentForEntity
   * @param {unknown[]} newRows
   */
  function buildPreliminaryStmEntityMergeUserContent(currentForEntity, newRows) {
    const cur = Array.isArray(currentForEntity) ? currentForEntity : [];
    const nx = Array.isArray(newRows) ? newRows : [];
    return `【当前该 entity 已有转移 currentRowsForEntity】\n${JSON.stringify(cur, null, 2)}\n\n【本次新提炼该 entity 转移 newExtractedRows】\n${JSON.stringify(nx, null, 2)}`;
  }

  /**
   * 与 \`mergePreliminaryStmEntityBucketByLlm\` 调用前展示一致。
   * @param {unknown[]} currentForEntity
   * @param {unknown[]} newRows
   */
  function buildPreliminaryStmEntityMergeLlmInputFullText(currentForEntity, newRows) {
    const ub = buildPreliminaryStmEntityMergeUserContent(currentForEntity, newRows);
    return `【system】\n${PRELIMINARY_V2_STM_ENTITY_MERGE_SYSTEM_PROMPT}\n\n【user】\n${ub}`;
  }

  /**
   * 将「同一 entity」下多条新提炼转移合并入当前初步需求（仅 LLM 输入该 entity 两侧数组；返回完整 preliminaryReq）。
   * @param {Object} currentPreliminaryReq
   * @param {string} entityDisplayLabel - 与 \`getPrelimStmRowEntityDisplayLabel\` 一致的分组键
   * @param {unknown[]} newRowsForEntity
   */
  async function mergePreliminaryStmEntityBucketByLlm(currentPreliminaryReq, entityDisplayLabel, newRowsForEntity) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const label = entityDisplayLabel != null ? String(entityDisplayLabel).trim() : '';
    if (!label) throw new Error('entity 展示名为空');
    const nx = Array.isArray(newRowsForEntity) ? newRowsForEntity.filter((r) => r && typeof r === 'object') : [];
    if (nx.length === 0) throw new Error('待合并的该 entity 新提炼行为空');
    const cur = currentPreliminaryReq && typeof currentPreliminaryReq === 'object' ? currentPreliminaryReq : {};
    const matrix = Array.isArray(cur.stateTransitionMatrix) ? cur.stateTransitionMatrix : [];
    const currentForEntity = matrix.filter((r) => getPrelimStmRowEntityDisplayLabel(r, cur) === label);
    const userBlock = buildPreliminaryStmEntityMergeUserContent(currentForEntity, nx);
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: PRELIMINARY_V2_STM_ENTITY_MERGE_SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
      { taskTag: 'task1-prelim-merge-stm-entity', maxOutputTokens: 8192 },
    );
    const { parsed, rawSlice: jsonStr } = parsePreliminaryLlmJsonObject(content, 'task1-prelim-merge-stm-entity');
    let summary = parsed.modificationSummaryMarkdown != null ? String(parsed.modificationSummaryMarkdown).trim() : '';
    const mergedReqRaw = parsed.preliminaryReq && typeof parsed.preliminaryReq === 'object' ? parsed.preliminaryReq : null;
    const stmFromModel =
      mergedReqRaw && Array.isArray(mergedReqRaw.stateTransitionMatrix) ? mergedReqRaw.stateTransitionMatrix : null;
    let effectiveEntityStm = stmFromModel;
    if (
      !effectiveEntityStm ||
      effectiveEntityStm.length === 0 ||
      (currentForEntity.length > 0 && effectiveEntityStm.length < currentForEntity.length)
    ) {
      effectiveEntityStm = mergePreliminaryStateTransitionMatrixArrays(currentForEntity, nx);
      const fallbackNote =
        '（系统自动兜底）大模型返回的该 entity 状态矩阵无效或行数异常，已按当前该对象行与新提炼行执行按键并集合并。';
      summary = summary ? `${summary}\n\n${fallbackNote}` : fallbackNote;
    }
    const stripped = matrix.filter((r) => getPrelimStmRowEntityDisplayLabel(r, cur) !== label);
    const combined = mergePreliminaryStateTransitionMatrixArrays(stripped, effectiveEntityStm);
    const merged = mergePreliminaryV2TopLevel(cur, { stateTransitionMatrix: combined });
    if (!isPreliminaryRequirementV2Shape(merged)) {
      throw new Error('融合后的初步需求结构无效');
    }
    const defaultModel = global.DEEPSEEK_MODEL || 'deepseek-chat';
    const fullPrompt = `【system】\n${PRELIMINARY_V2_STM_ENTITY_MERGE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}`;
    return {
      mergedPreliminaryReq: merged,
      modificationSummaryMarkdown: summary || '（未生成修改要点）',
      fullPrompt,
      rawOutput: jsonStr,
      llmMeta: { usage: usage || {}, model: model || defaultModel, durationMs: durationMs || 0 },
    };
  }

  function isPreliminaryRequirementV2Shape(obj) {
    return (
      obj != null &&
      typeof obj === 'object' &&
      obj.businessContext != null &&
      typeof obj.businessContext === 'object' &&
      !Array.isArray(obj.businessContext)
    );
  }

  /**
   * 将 `operationModel.fullValueStreams[]` 转为 task4 Mirror / 角色推演兼容的 `valueStreamMapping[]`。
   * @param {unknown[]} full
   * @returns {Array<Record<string, string>>}
   */
  function synthesizeValueStreamMappingFromFullStreams(full) {
    if (!Array.isArray(full) || full.length === 0) return [];
    const dash = (v) => {
      const t = v != null ? String(v).trim() : '';
      return t !== '' ? t : '—';
    };
    const primaryStep = (it) => {
      const a = it?.processName != null ? String(it.processName).trim() : '';
      if (a) return a;
      const b = it?.domain != null ? String(it.domain).trim() : '';
      return b || '—';
    };
    return full.map((it) =>
      it && typeof it === 'object'
        ? {
            step: primaryStep(it),
            actor: dash(it.actor),
            scope: dash(it.scope),
            action: dash(it.logicAndRules),
            object: dash(it.dataAsset),
            logicalConstraint: dash(it.logicAndRules),
            nodeDescription: dash(it.nodes),
          }
        : {
            step: '—',
            actor: '—',
            scope: '—',
            action: '—',
            object: '—',
            logicalConstraint: '—',
            nodeDescription: '—',
          },
    );
  }

  /**
   * 合成/校正 `valueStreamMapping`：无短表时从 `fullValueStreams` 生成；若 full 条数多于现有 valueStreamMapping，以 full 为准覆盖（与工作区「业务流程」一致，避免 Mirror 只吃聚合摘要）。
   * @param {Object} prelim
   * @returns {Object}
   */
  function normalizePreliminaryReqV2ValueStreamAlias(prelim) {
    if (!prelim || typeof prelim !== 'object' || !isPreliminaryRequirementV2Shape(prelim)) return prelim;
    const om = prelim.operationModel;
    if (!om || typeof om !== 'object') return prelim;
    const vsm = Array.isArray(om.valueStreamMapping) ? om.valueStreamMapping : [];
    const fullArr = Array.isArray(om.fullValueStreams) ? om.fullValueStreams : [];

    if (fullArr.length > vsm.length) {
      const valueStreamMapping = synthesizeValueStreamMappingFromFullStreams(fullArr);
      return {
        ...prelim,
        operationModel: {
          ...om,
          valueStreamMapping,
        },
      };
    }

    const hasVsm = vsm.length > 0;
    if (hasVsm || fullArr.length === 0) return prelim;
    const valueStreamMapping = synthesizeValueStreamMappingFromFullStreams(fullArr);
    return {
      ...prelim,
      operationModel: {
        ...om,
        valueStreamMapping,
      },
    };
  }

  /**
   * 案例未带 `preliminaryReq`（导入/GET 漏字段）时，从聊天记录逆向取最近一次 V2 对象。
   * 自末尾向前扫描：task1LlmQueryBlock（备注含「初步需求」）、task1 的 modificationRegenerateLlmQueryBlock、preliminaryRequirementMergeSessionPlanBlock.extractedPreliminaryReq。
   */
  function extractPreliminaryReqV2FromChatMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return null;
    const tryFromRaw = (raw) => {
      try {
        if (raw == null) return null;
        if (typeof raw === 'object' && !Array.isArray(raw)) {
          if (raw.preliminaryReq && typeof raw.preliminaryReq === 'object' && isPreliminaryRequirementV2Shape(raw.preliminaryReq)) {
            return raw.preliminaryReq;
          }
          if (isPreliminaryRequirementV2Shape(raw)) return raw;
          return null;
        }
        const s = String(raw).trim();
        if (!s) return null;
        const { parsed } = parsePreliminaryLlmJsonObject(s, 'hydrate-prelim-from-chat');
        if (!parsed || typeof parsed !== 'object') return null;
        if (parsed.preliminaryReq && typeof parsed.preliminaryReq === 'object' && isPreliminaryRequirementV2Shape(parsed.preliminaryReq)) {
          return parsed.preliminaryReq;
        }
        if (isPreliminaryRequirementV2Shape(parsed)) return parsed;
      } catch (_) {
        /* 单条消息解析失败继续扫描 */
      }
      return null;
    };

    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!m || typeof m !== 'object') continue;
      if (m.type === 'preliminaryRequirementMergeSessionPlanBlock') {
        const ex = m.extractedPreliminaryReq;
        if (ex && typeof ex === 'object' && isPreliminaryRequirementV2Shape(ex)) return ex;
      }
      if (m.type === 'task1LlmQueryBlock') {
        const note = String(m.noteName || '');
        if (!note.includes('初步需求')) continue;
        const got = tryFromRaw(m.llmOutputRaw ?? m.llmOutputJson);
        if (got) return got;
      }
      if (m.type === 'modificationRegenerateLlmQueryBlock' && String(m.taskId || '') === 'task1') {
        const got = tryFromRaw(m.llmOutputRaw ?? m.llmOutputJson);
        if (got) return got;
      }
    }
    return null;
  }

  /**
   * 按路径取对象值。
   * @param {Object} obj - 源对象。
   * @param {string} path - 路径，如 'operationModel.businessProcess'。
   * @returns {*} 路径对应的值，不存在则为 undefined。
   */
  function getByPath(obj, path) {
    if (obj == null || typeof path !== 'string') return undefined;
    const parts = path.split('.');
    let v = obj;
    for (const p of parts) {
      v = v != null && typeof v === 'object' ? v[p] : undefined;
    }
    return v;
  }

  /** 解析预览（首页）展示字段：仅新版深度提炼 V2 摘要项 */
  const PRELIMINARY_V2_PREVIEW_FIELDS = [
    { key: 'businessContext.clientName', label: '企业/项目名称' },
    { key: 'businessContext.industryDomain', label: '行业与业务模式' },
    { key: 'businessContext.orgTopology.type', label: '组织拓扑类型' },
    { key: 'corePainPointSummary', label: '核心痛点总结' },
    { key: 'roadmap.overallUrgency', label: '整体紧急度' },
  ];

  /** 对外导出：与 `PRELIMINARY_V2_PREVIEW_FIELDS` 相同（旧版扁平预览字段已移除） */
  const PARSE_PREVIEW_FIELDS = PRELIMINARY_V2_PREVIEW_FIELDS;

  /** V2 工作区 view：子 Tab 顺序与展示标签；path 为 `getByPath(preliminary, path)`；kind===coreObjects/stateLogic 为专用面板（原「对象与状态」拆为两 Tab） */
  const PRELIMINARY_V2_WORKSPACE_VIEW_SECTIONS = [
    { path: 'businessContext', label: '商业背景' },
    { path: 'coreBusinessEntities', label: '核心对象', kind: 'coreObjects' },
    { path: 'stateTransitionMatrix', label: '状态逻辑', kind: 'stateLogic' },
    { path: 'painPointRadar', label: '需求痛点' },
    { path: 'itLandscape', label: 'IT 现状需求' },
    { path: 'operationModel.orgAndRoles', label: '人员组织' },
    { path: 'operationModel.fullValueStreams', label: '业务流程' },
    { path: 'roadmap.phase1_Critical', label: '优先上线' },
    { path: 'roadmap.phase2_Strategic', label: '后续上线' },
    { path: 'roadmap.overallUrgency', label: '项目紧急度' },
  ];

  /** 路径上已有非空值则返回，否则 undefined（空串/空对象/空数组视为无） */
  function getMeaningfulDirectWorkspaceSlice(obj, path) {
    const direct = getByPath(obj, path);
    if (direct === undefined || direct === null) return undefined;
    if (typeof direct === 'string') return direct.trim() === '' ? undefined : direct;
    if (Array.isArray(direct)) return direct.length === 0 ? undefined : direct;
    if (typeof direct === 'object') return Object.keys(direct).length === 0 ? undefined : direct;
    return direct;
  }

  /**
   * 工作区 view 分区内展示的 JSON 根：仅 V2 路径（不做扁平字段回退）。
   * @param {Object} preliminary - `buildResolvedPreliminaryRequirement` 结果
   * @param {string} path - 与 PRELIMINARY_V2_WORKSPACE_VIEW_SECTIONS 一致
   */
  function getPreliminaryWorkspaceSectionValue(preliminary, path) {
    if (!preliminary || typeof preliminary !== 'object') return undefined;
    return getMeaningfulDirectWorkspaceSlice(preliminary, path);
  }

  /** 是否存在任一工作区 view 分区内可展示的 V2 提炼内容 */
  function hasPreliminaryWorkspaceViewContent(preliminary) {
    if (!preliminary || typeof preliminary !== 'object') return false;
    return PRELIMINARY_V2_WORKSPACE_VIEW_SECTIONS.some((sec) => {
      return getPreliminaryWorkspaceSectionValue(preliminary, sec.path) != null;
    });
  }

  /**
   * view 将显示「暂无初步需求提炼结果…」时打诊断日志（导入/刷新后 item 与 view 分区是否命中）。
   * 关闭：全局 `__FE_PRELIM_VIEW_DEBUG = false`。
   */
  function logPrelimWorkspaceViewWhenEmpty(item, preliminary) {
    try {
      if (globalThis.__FE_PRELIM_VIEW_DEBUG === false) return;
      const safeItem = item && typeof item === 'object' ? item : {};
      const top = safeItem.preliminaryReq;
      const topKeys = top && typeof top === 'object' && !Array.isArray(top) ? Object.keys(top) : [];
      let nestedPrelimKeys = [];
      let nestedHasMeta = false;
      const bi = safeItem.basicInfo;
      if (bi && typeof bi === 'object' && !Array.isArray(bi)) {
        const meta = bi[CREATE_CONTRACT_EXTRAS_META_KEY];
        nestedHasMeta = !!(meta && typeof meta === 'object' && !Array.isArray(meta));
        if (nestedHasMeta && meta.preliminaryReq != null && typeof meta.preliminaryReq === 'object') {
          nestedPrelimKeys = Object.keys(meta.preliminaryReq);
        }
      }
      const rawFromRead = readPreliminaryReqObjectFromItem(safeItem);
      const rawReadKeys = rawFromRead && typeof rawFromRead === 'object' ? Object.keys(rawFromRead) : [];
      const v2 = isPreliminaryRequirementV2Shape(preliminary);
      const sectionHits = {};
      for (const sec of PRELIMINARY_V2_WORKSPACE_VIEW_SECTIONS) {
        sectionHits[sec.path] = getPreliminaryWorkspaceSectionValue(preliminary, sec.path) != null;
      }
      const histLen = Array.isArray(safeItem.requirementDetailHistory) ? safeItem.requirementDetailHistory.length : 0;
      const rd = preliminary?.requirementDetail ?? safeItem.requirementDetail;
      const rdStr = typeof rd === 'string' ? rd : '';
      console.info('[FE:prelim-workspace-view]', 'view_empty', {
        caseId: safeItem.id,
        createdAt: safeItem.createdAt,
        isV2Shape: v2,
        topPreliminaryReqType: top == null ? 'nil' : typeof top,
        topPreliminaryReqKeys: topKeys,
        nestedExtrasMetaPresent: nestedHasMeta,
        nestedPreliminaryReqKeyCount: nestedPrelimKeys.length,
        nestedPreliminaryReqKeysSample: nestedPrelimKeys.slice(0, 12),
        readPreliminaryReqObjectKeys: rawReadKeys,
        resolvedPreliminaryKeys:
          preliminary && typeof preliminary === 'object' ? Object.keys(preliminary) : [],
        sectionHits,
        requirementDetailHistoryLen: histLen,
        requirementDetailStrLen: rdStr.length,
        requirementDetailHead: rdStr.slice(0, 120),
      });
    } catch (e) {
      console.warn('[FE:prelim-workspace-view]', 'view_empty_diag_failed', e);
    }
  }

  /** 初步需求可编辑字段（V2 路径 + 管理资源 + 需求详情），供意图修改等 */
  function getPreliminaryCardLabels() {
    const rows = PRELIMINARY_V2_WORKSPACE_VIEW_SECTIONS.map(({ path, label }) => ({ key: path, label }));
    rows.push({ key: 'managementResources', label: '管理资源（人财物信）' });
    rows.push({ key: 'requirementDetail', label: '需求详情' });
    return rows;
  }

  /** 标签到初步需求字段 path 的映射，供意图修改定位（仅新版） */
  const PRELIMINARY_LABEL_TO_KEY = {
    商业背景: 'businessContext',
    业务上下文与组织拓扑: 'businessContext',
    需求痛点: 'painPointRadar',
    核心需求或痛点: 'painPointRadar',
    痛点雷达: 'painPointRadar',
    'IT 现状需求': 'itLandscape',
    'IT 现状': 'itLandscape',
    'IT 现状与集成': 'itLandscape',
    'IT 现状/已有系统': 'itLandscape',
    业务流程: 'operationModel.fullValueStreams',
    核心业务流程梳理: 'operationModel.fullValueStreams',
    人员组织: 'operationModel.orgAndRoles',
    人员组织模式: 'operationModel.orgAndRoles',
    运营模式与价值流: 'operationModel',
    '管理资源（人财物信）': 'managementResources',
    阶段路线与紧急度: 'roadmap',
    优先上线: 'roadmap.phase1_Critical',
    最紧急第一阶段: 'roadmap.phase1_Critical',
    '最紧急/第一阶段': 'roadmap.phase1_Critical',
    后续上线: 'roadmap.phase2_Strategic',
    可二期或后续: 'roadmap.phase2_Strategic',
    项目紧急度: 'roadmap.overallUrgency',
    整体紧急程度: 'roadmap.overallUrgency',
    分析备注: 'analystNotes',
    对象与状态: 'coreBusinessEntities',
    核心对象: 'coreBusinessEntities',
    核心业务对象: 'coreBusinessEntities',
    状态逻辑: 'stateTransitionMatrix',
    状态转移矩阵: 'stateTransitionMatrix',
    需求详情: 'requirementDetail',
    'operationModel.fullValueStreams': 'operationModel.fullValueStreams',
    'operationModel.valueStreamMapping': 'operationModel.valueStreamMapping',
    'operationModel.orgAndRoles': 'operationModel.orgAndRoles',
    'roadmap.phase1_Critical': 'roadmap.phase1_Critical',
    'roadmap.phase2_Strategic': 'roadmap.phase2_Strategic',
    'roadmap.overallUrgency': 'roadmap.overallUrgency',
  };

  /**
   * task1 聊天区：对用户输入的初步需求原文做深度 V2 提炼。
   * @param {string} text - 用户输入的原始需求描述。
   * @returns {Promise<PreliminaryLlmResult>}
   */
  async function parsePreliminaryRequirementDepthV2(text) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const { content, usage, model, durationMs, truncated, finishReason } = await fetchDeepSeekChat(
      [
        { role: 'system', content: PRELIMINARY_V2_DEPTH_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      { taskTag: 'task1-prelim-depth-v2', maxOutputTokens: 8192 },
    );
    let { parsed, rawSlice: jsonStr } = parsePreliminaryLlmJsonObject(content, 'task1-prelim-depth-v2');
    if (parsed && typeof parsed === 'object' && isPreliminaryRequirementV2Shape(parsed)) {
      parsed = normalizePreliminaryReqV2ValueStreamAlias(parsed);
      delete parsed.analystNotes;
    }
    const fullPrompt = `【system】\n${PRELIMINARY_V2_DEPTH_SYSTEM_PROMPT}\n\n【user】\n${text}`;
    const defaultModel = global.DEEPSEEK_MODEL || 'deepseek-chat';
    return {
      parsed,
      fullPrompt,
      rawOutput: jsonStr,
      llmMeta: {
        usage: usage || {},
        model: model || defaultModel,
        durationMs: durationMs || 0,
        truncated: truncated === true,
        finishReason: finishReason != null ? String(finishReason) : undefined,
      },
    };
  }

  /**
   * task1 补充需求：针对单一顶层数组字段再提炼（在全文深度 V2 之后调用，结果用于覆盖 `extractedPreliminaryReq` 同名字段）。
   * @param {string} text - 用户补充原文
   * @param {'coreBusinessEntities'|'stateTransitionMatrix'} sliceKey
   */
  async function parsePreliminaryRequirementSupplementSliceV2(text, sliceKey) {
    const fetchDeepSeekChat = global.fetchDeepSeekChat;
    if (typeof fetchDeepSeekChat !== 'function') throw new Error('fetchDeepSeekChat 不可用');
    const key = String(sliceKey || '').trim();
    const system =
      key === 'stateTransitionMatrix'
        ? PRELIMINARY_V2_SUPPLEMENT_SLICE_STATE_LOGIC_PROMPT
        : key === 'coreBusinessEntities'
          ? PRELIMINARY_V2_SUPPLEMENT_SLICE_CORE_ENTITIES_PROMPT
          : '';
    if (!system) throw new Error(`不支持的补充切片字段：${sliceKey}`);
    const userBlock = String(text || '').trim();
    if (!userBlock) throw new Error('补充原文为空');
    const { content, usage, model, durationMs, truncated, finishReason } = await fetchDeepSeekChat(
      [
        { role: 'system', content: system },
        { role: 'user', content: userBlock },
      ],
      { taskTag: `task1-prelim-supplement-${key}`, maxOutputTokens: 8192 },
    );
    const { parsed: rawParsed, rawSlice: jsonStr } = parsePreliminaryLlmJsonObject(
      content,
      `task1-prelim-supplement-${key}`,
    );
    let arr =
      rawParsed && typeof rawParsed === 'object' && !Array.isArray(rawParsed) ? rawParsed[key] : undefined;
    if (!Array.isArray(arr) && rawParsed && typeof rawParsed === 'object' && rawParsed.preliminaryReq) {
      const pr = rawParsed.preliminaryReq;
      if (pr && typeof pr === 'object' && !Array.isArray(pr)) arr = pr[key];
    }
    if (!Array.isArray(arr)) {
      throw new Error(`补充切片 ${key} 解析结果不是数组`);
    }
    const fullPrompt = `【system】\n${system}\n\n【user】\n${userBlock}`;
    const defaultModel = global.DEEPSEEK_MODEL || 'deepseek-chat';
    return {
      parsed: { [key]: arr },
      fullPrompt,
      rawOutput: jsonStr,
      llmMeta: {
        usage: usage || {},
        model: model || defaultModel,
        durationMs: durationMs || 0,
        truncated: truncated === true,
        finishReason: finishReason != null ? String(finishReason) : undefined,
      },
    };
  }

  /**
   * 兼容旧名：与 `parsePreliminaryRequirementDepthV2` 相同（深度 V2）。
   */
  async function parseDigitalProblemInput(text) {
    return parsePreliminaryRequirementDepthV2(text);
  }

  /**
   * 渲染解析预览区域 HTML 并显示面板。
   * @param {Object} parsed - 解析结果对象（含各字段及嵌套 operationModel、urgencyAnalysis）。
   * @param {HTMLElement} [contentEl] - 解析预览内容容器（如 parsePreviewContent），用于设置 innerHTML。
   * @param {HTMLElement} [previewEl] - 解析预览外层容器（如 parsePreview），用于设置 hidden。
   * @param {function(string): string} escapeHtml - 转义 HTML 的函数。
   */
  function renderParsePreview(parsed, contentEl, previewEl, escapeHtml) {
    if (!contentEl) return;
    const esc = escapeHtml || ((s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
    if (!isPreliminaryRequirementV2Shape(parsed)) {
      contentEl.innerHTML = `<dt>提示</dt><dd>未识别为新版深度提炼结构（需含有效的 <code>businessContext</code> 对象）。请重新解析或在详情页任务对话中完成客户初步需求提炼。</dd>`;
    } else {
      contentEl.innerHTML = PRELIMINARY_V2_PREVIEW_FIELDS.map(({ key, label }) => {
        const raw = getByPath(parsed, key);
        const value = raw != null && typeof raw === 'object' ? JSON.stringify(raw) : raw != null ? String(raw).trim() : '—';
        return `<dt>${esc(label)}</dt><dd>${esc(value) || '—'}</dd>`;
      }).join('');
      const pr = parsed.painPointRadar;
      if (Array.isArray(pr) && pr.length > 0) {
        contentEl.innerHTML += `<dt>痛点条数</dt><dd>${esc(String(pr.length))}</dd>`;
      }
    }
    if (previewEl) previewEl.hidden = false;
  }

  /**
   * 生成问题详情「初步需求」卡片的行 HTML。
   * @param {Object} item - 当前问题项（含 customerName、operationModel、urgencyAnalysis、requirementDetail 等）。
   * @param {function(string): string} escapeHtml - 转义 HTML 的函数。
   * @returns {string} 多行 .problem-detail-row 的 HTML 拼接。
   */
  /**
   * 总结提炼 Tab 展示的字段（不含需求详情，需求详情在历史详情 Tab 中按时间线展示）。
   */
  function getPreliminarySummaryCardLabels() {
    return getPreliminaryCardLabels().filter(({ key }) => key !== 'requirementDetail');
  }

  /** 将已转义文本中的 **...** 转为加粗 HTML（正文内强调；工作区「小标题」另用绿色类名由 `renderRequirementWorkspaceFieldValueHtml` 输出） */
  function renderMarkdownBold(escapedText) {
    if (typeof escapedText !== 'string') return '';
    return escapedText.replace(/\*\*(.+?)\*\*/g, '<strong class="problem-detail-value-bold">$1</strong>');
  }

  /**
   * 从字符串末尾剥离「下一组 ** 小标题」前的数字编号（如 1. / 2、/ （3）），供并入绿色小标题同一行展示。
   */
  function peelTrailingEnumBeforeNextTitle(str) {
    if (typeof str !== 'string') return { main: '', nextPrefix: '' };
    const m = str.match(/(?:[0-9０-９]+[\.、．．]\s*|\([0-9０-９]+\)\s*)$/u);
    if (!m) return { main: str, nextPrefix: '' };
    const main = str.slice(0, str.length - m[0].length).replace(/\s+$/u, '');
    return { main, nextPrefix: m[0] };
  }

  /** `**…**` 闭合后若紧跟（可含空白）以下任一，则视为小标题与正文分界 */
  const SUBTITLE_AFTER_BOLD_RE = /^[：:。．.！!？?；;，,、]/;

  /**
   * 将相邻且仅被「与」「和」隔开的 **块** 合并为一条展示用小标题（中间不换行语义）。
   * @returns {{ openIndex: number, closeEnd: number, titleInner: string }[]}
   */
  function mergeAdjacentBoldTitlesByYuHe(s, matches) {
    if (!matches.length) return [];
    const out = [];
    let i = 0;
    while (i < matches.length) {
      const first = matches[i];
      let closeEnd = first.index + first[0].length;
      const pieces = [String(first[1] || '').trim()];
      let j = i;
      while (j + 1 < matches.length) {
        const between = s.slice(closeEnd, matches[j + 1].index);
        if (!/^\s*[与和]\s*$/.test(between)) break;
        const conn = between.replace(/\s+/g, '');
        pieces.push(conn);
        j += 1;
        pieces.push(String(matches[j][1] || '').trim());
        closeEnd = matches[j].index + matches[j][0].length;
      }
      out.push({
        openIndex: first.index,
        closeEnd,
        titleInner: pieces.join(''),
      });
      i = j + 1;
    }
    return out;
  }

  /**
   * 需求理解工作区字段值：仅当 `**…**`（可含 **A**与**B** 合并）后紧跟 ： 。 等标点时视为小标题；否则整段走加粗正文。
   * `**` 紧前的数字编号并入小标题；入参须为已 `escapeHtml` 的字符串。
   */
  function renderRequirementWorkspaceFieldValueHtml(escapedText) {
    if (escapedText == null) return '';
    const s = String(escapedText);
    if (!s.trim()) return '—';
    const rawMatches = [...s.matchAll(/\*\*([\s\S]+?)\*\*/g)];
    if (rawMatches.length === 0) {
      return renderMarkdownBold(s).replace(/\n/g, '<br>');
    }

    const merged = mergeAdjacentBoldTitlesByYuHe(s, rawMatches);
    const subtitleRanges = merged.filter((m) => {
      const tail = s.slice(m.closeEnd).trimStart();
      return SUBTITLE_AFTER_BOLD_RE.test(tail);
    });
    const subtitleOpenSet = new Set(subtitleRanges.map((r) => r.openIndex));

    if (subtitleRanges.length === 0) {
      return renderMarkdownBold(s).replace(/\n/g, '<br>');
    }

    const chunks = [];
    let pendingNum = '';
    let plainCursor = 0;

    const appendPlainThrough = (endExclusive) => {
      if (endExclusive <= plainCursor) return;
      const slice = s.slice(plainCursor, endExclusive);
      plainCursor = endExclusive;
      if (!slice.length) return;
      const { main: leadPlain, nextPrefix: leadNum } = peelTrailingEnumBeforeNextTitle(slice);
      if (leadPlain.trim()) chunks.push({ kind: 'plain', text: leadPlain.trim() });
      if (leadNum) pendingNum = leadNum;
    };

    for (let k = 0; k < merged.length; k++) {
      const mr = merged[k];
      if (!subtitleOpenSet.has(mr.openIndex)) continue;

      appendPlainThrough(mr.openIndex);

      const title = (pendingNum + mr.titleInner).trim();
      pendingNum = '';

      const nextSub = merged.slice(k + 1).find((r) => subtitleOpenSet.has(r.openIndex));
      const untilNext = nextSub ? nextSub.openIndex : s.length;
      let segment = s.slice(mr.closeEnd, untilNext);
      const delim = segment.match(/^\s*([：:。．.！!？?；;，,、])/);
      if (delim) {
        segment = segment.slice(segment.indexOf(delim[1]) + 1);
      }
      const { main: bodyCore, nextPrefix } = peelTrailingEnumBeforeNextTitle(segment);
      pendingNum = nextPrefix;
      chunks.push({ kind: 'block', title, body: bodyCore.trim() });
      plainCursor = untilNext;
    }

    appendPlainThrough(s.length);

    if (pendingNum.trim()) {
      const last = chunks[chunks.length - 1];
      if (last && last.kind === 'block') last.body = `${last.body || ''}${pendingNum}`.trim();
      else chunks.push({ kind: 'plain', text: pendingNum.trim() });
    }

    return chunks
      .map((c) => {
        if (c.kind === 'plain') {
          const inner = renderMarkdownBold(c.text).replace(/\n/g, '<br>');
          return `<div class="problem-detail-value-plain">${inner}</div>`;
        }
        const bodyHtml = renderMarkdownBold(c.body || '').replace(/\n/g, '<br>');
        return `<div class="problem-detail-value-subhead-block"><span class="problem-detail-value-subtitle">${c.title}</span><span class="problem-detail-value-subhead-body">${bodyHtml}</span></div>`;
      })
      .join('');
  }

  /** 后端 Prisma 映射：`basicInfo.__createContractExtras.preliminaryReq` 与顶层 `preliminaryReq` 等价 */
  const CREATE_CONTRACT_EXTRAS_META_KEY = '__createContractExtras';

  function readPreliminaryReqObjectFromItem(safeItem) {
    const top = safeItem.preliminaryReq;
    let nested = null;
    const bi = safeItem.basicInfo;
    if (bi && typeof bi === 'object' && !Array.isArray(bi)) {
      const meta = bi[CREATE_CONTRACT_EXTRAS_META_KEY];
      if (meta && typeof meta === 'object' && !Array.isArray(meta) && meta.preliminaryReq && typeof meta.preliminaryReq === 'object') {
        nested = meta.preliminaryReq;
      }
    }
    /* 顶层可能为 {} 占位，须让位于 extras 内真实 V2（FE-20260331） */
    if (top && typeof top === 'object' && Object.keys(top).length > 0) return top;
    if (nested) return nested;
    return {};
  }

  /**
   * 合成详情页初步需求对象：优先 preliminaryReq，其次回退顶层字段，避免详情页字段读空。
   * @param {Object} item - 当前问题项，可能同时存在 preliminaryReq 与顶层字段。
   * @returns {Object} 统一后的 preliminary 对象。
   */
  function buildResolvedPreliminaryRequirement(item) {
    const safeItem = item && typeof item === 'object' ? item : {};
    const prelim = readPreliminaryReqObjectFromItem(safeItem);
    const hist = Array.isArray(safeItem.requirementDetailHistory) ? safeItem.requirementDetailHistory : [];
    const reqDetail = prelim.requirementDetail ?? safeItem.requirementDetail ?? safeItem.requirement_detail ?? '';

    if (isPreliminaryRequirementV2Shape(prelim)) {
      let normalized = normalizePreliminaryReqV2ValueStreamAlias(prelim);
      delete normalized.analystNotes;
      normalized = withPreliminaryCoreEntitiesAndStateMatrixNormalized(normalized);
      const clientName =
        normalized.businessContext?.clientName != null && String(normalized.businessContext.clientName).trim() !== ''
          ? String(normalized.businessContext.clientName).trim()
          : safeItem.customerName ?? safeItem.customer_name ?? '';
      return {
        ...normalized,
        customerName: clientName,
        requirementDetail: reqDetail,
        requirementDetailHistory: hist,
      };
    }

    return {
      customerName: safeItem.customerName ?? safeItem.customer_name ?? '',
      requirementDetail: reqDetail,
      requirementDetailHistory: hist,
    };
  }

  /**
   * Unicode 字符粒度截断（与「30 字」口径一致）。
   * @param {string} str
   * @param {number} max
   * @returns {string}
   */
  function clampUnicodeChars(str, max) {
    const s = String(str ?? '');
    const ch = Array.from(s);
    if (ch.length <= max) return s;
    return ch.slice(0, max).join('');
  }

  /**
   * 收集可能出现在正文里的客户/公司称谓，供从需求标题片段中剔除（需求标题仅保留数字化问题，不含商号）。
   * @param {Object} preliminary
   * @param {Object} item
   * @returns {string[]}
   */
  function collectCaseHeadlineCompanyNameHints(preliminary, item) {
    const safeItem = item && typeof item === 'object' ? item : {};
    const pre = preliminary && typeof preliminary === 'object' ? preliminary : {};
    const set = new Set();
    const add = (s) => {
      const t = String(s ?? '').trim();
      if (t.length >= 2) set.add(t);
    };
    add(pre.businessContext?.clientName);
    add(pre.customerName);
    add(safeItem.customerName);
    add(safeItem.customer_name);
    return [...set];
  }

  /**
   * 从一句文案中移除已知客户/公司名及常见领起前缀，避免需求标题重复商号。
   * @param {string} text
   * @param {string[]} nameHints
   * @returns {string}
   */
  function stripCompanyNamesFromSnippet(text, nameHints) {
    let s = String(text ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!s) return '';
    const hintsSorted = [...nameHints].filter((n) => n && n.length >= 2).sort((a, b) => b.length - a.length);
    for (const n of hintsSorted) {
      s = s.split(n).join(' ');
    }
    s = s
      .replace(/\s+/g, ' ')
      .replace(/^[本公司我司贵司该企业该客户客户名称\s：:，,、]+/u, '')
      .replace(/^[\s「」【】]+/, '')
      .trim();
    return s;
  }

  /**
   * 从已解析的初步需求中选取「数字化问题」一句（用于 `解决【…】` 内文；不含公司名称，优先 IT 缺口与系统侧描述）。
   * @param {Object} preliminary - `buildResolvedPreliminaryRequirement` 结果
   * @param {Object} item - 原始案例项（回退 requirementDetail）
   * @returns {string}
   */
  function pickCaseProblemDescriptionSnippet(preliminary, item) {
    const safeItem = item && typeof item === 'object' ? item : {};
    const nameHints = collectCaseHeadlineCompanyNameHints(preliminary, safeItem);
    const sanitizeOneLine = (t) =>
      String(t ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    const take = (raw) => {
      const cleaned = stripCompanyNamesFromSnippet(sanitizeOneLine(raw), nameHints);
      return cleaned.length >= 2 ? cleaned : '';
    };

    if (preliminary && typeof preliminary === 'object' && isPreliminaryRequirementV2Shape(preliminary)) {
      const radar = preliminary.painPointRadar;
      if (Array.isArray(radar) && radar.length > 0) {
        const first = radar[0];
        if (first && typeof first === 'object') {
          // 优先 IT/管控缺口（数字化），再业务痛点描述
          const order = [first.itGap, first.description, first.pain];
          for (const cand of order) {
            const got = take(cand);
            if (got) return got;
          }
        }
        if (typeof first === 'string') {
          const got = take(first);
          if (got) return got;
        }
      }

      const itl = preliminary.itLandscape;
      if (itl && typeof itl === 'object') {
        const integ = Array.isArray(itl.integrationRequirements) ? itl.integrationRequirements : [];
        for (const x of integ) {
          const got = take(x);
          if (got) return got;
        }
        const leg = Array.isArray(itl.legacySystems) ? itl.legacySystems : [];
        for (const x of leg) {
          const got = take(x);
          if (got) return got;
        }
      }

      const p1 = preliminary.roadmap?.phase1_Critical;
      if (p1 && typeof p1 === 'object') {
        const f = take(p1.focus);
        if (f) return f;
        const dels = p1.deliverables;
        if (Array.isArray(dels)) {
          for (const x of dels) {
            const got = take(x);
            if (got) return got;
          }
        }
      }

      const coreSummary = resolveCorePainPointSummaryFromPreliminary(preliminary);
      const fromSummary = take(coreSummary);
      if (fromSummary) return fromSummary;
    }

    const rd = String(safeItem.requirementDetail ?? preliminary?.requirementDetail ?? '').trim();
    if (rd) {
      const line = rd.split(/\n/)[0].trim();
      const got = take(line);
      if (got) return got;
    }
    return '待明确';
  }

  /**
   * 案例标题：客户名称 + 需求标题（`解决【问题描述】`，需求标题段 ≤30 Unicode 字符）。
   * @param {Object} item - 当前案例项
   * @returns {{ customerName: string, requirementTitle: string, headlineLine: string }}
   */
  function buildCaseRequirementHeadlineParts(item) {
    const preliminary = buildResolvedPreliminaryRequirement(item);
    const customerNameRaw = String(preliminary.customerName ?? '').trim();
    const customerName = customerNameRaw || '未命名';
    const snippet = pickCaseProblemDescriptionSnippet(preliminary, item);
    let requirementTitle = `解决【${snippet}】`;
    requirementTitle = clampUnicodeChars(requirementTitle, CASE_REQUIREMENT_TITLE_MAX_LEN);
    return {
      customerName,
      requirementTitle,
      headlineLine: `${customerName}｜${requirementTitle}`,
    };
  }

  /** 商业背景顶层字段顺序与中文标签（与 V2 schema 对齐） */
  const PRELIM_BC_TOP_ORDER = ['clientName', 'industryDomain', 'orgTopology'];
  const PRELIM_BC_TOP_LABELS = {
    clientName: '企业/项目名称',
    industryDomain: '行业与商业模式',
    orgTopology: '组织拓扑',
  };
  const PRELIM_PP_CORE_SUMMARY_LABEL = '核心痛点总结';
  /** 已迁至痛点雷达，商业背景区不再展示 */
  const PRELIM_BC_LEGACY_HIDDEN_KEYS = new Set(['businessStatus']);

  function resolveCorePainPointSummaryFromPreliminary(preliminary) {
    if (!preliminary || typeof preliminary !== 'object') return '';
    const direct = String(preliminary.corePainPointSummary ?? '').trim();
    if (direct) return direct;
    const bc = preliminary.businessContext;
    if (bc && typeof bc === 'object' && !Array.isArray(bc)) {
      return String(bc.businessStatus ?? '').trim();
    }
    return '';
  }
  const PRELIM_BC_ORG_ORDER = ['type', 'scale', 'dataIsolation', 'managementDepth'];
  const PRELIM_BC_ORG_LABELS = {
    type: '拓扑类型',
    scale: '规模与扩张',
    dataIsolation: '数据隔离与审计汇总',
    managementDepth: '管理层级',
  };

  /**
   * JSON 键名兜底展示标签（camelCase / 下划线拆词）。
   * @param {string} key
   * @returns {string}
   */
  function formatPrelimBcFallbackLabel(key) {
    const s = String(key || '').replace(/_/g, ' ');
    return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^\w/, (c) => c.toUpperCase());
  }

  /**
   * 单层嵌套对象 → 子卡片（体内为标签+值行；可再嵌套）。
   * @param {string} title
   * @param {Object} obj
   * @param {function(string): string} esc
   * @param {function(string): string} renderWs
   * @param {number} depth
   * @param {Record<string, string>|null} childLabelMap
   * @param {string[]|null} childOrder
   */
  function buildPrelimBusinessContextNestedCard(title, obj, esc, renderWs, depth, childLabelMap, childOrder) {
    const order =
      Array.isArray(childOrder) && childOrder.length > 0
        ? [
            ...childOrder.filter((k) => Object.prototype.hasOwnProperty.call(obj, k)),
            ...Object.keys(obj).filter((k) => !childOrder.includes(k)),
          ]
        : Object.keys(obj).sort();
    const maxNest = 5;
    const bodyHtml = order
      .map((k) => {
        const v = obj[k];
        const lbl = (childLabelMap && childLabelMap[k]) || formatPrelimBcFallbackLabel(k);
        if (v != null && typeof v === 'object' && !Array.isArray(v)) {
          if (depth >= maxNest) {
            return `<div class="problem-detail-prelim-bc-nested-row"><span class="problem-detail-prelim-bc-nested-label">${esc(lbl)}</span><pre class="problem-detail-prelim-bc-inline-pre">${esc(JSON.stringify(v, null, 2))}</pre></div>`;
          }
          return `<div class="problem-detail-prelim-bc-nested-slot">${buildPrelimBusinessContextNestedCard(lbl, v, esc, renderWs, depth + 1, null, null)}</div>`;
        }
        if (Array.isArray(v)) {
          return `<div class="problem-detail-prelim-bc-nested-row"><span class="problem-detail-prelim-bc-nested-label">${esc(lbl)}</span><pre class="problem-detail-prelim-bc-inline-pre">${esc(JSON.stringify(v, null, 2))}</pre></div>`;
        }
        const text = v == null ? '' : typeof v === 'boolean' ? (v ? '是' : '否') : String(v).trim();
        const inner = text === '' ? '—' : renderWs(esc(text));
        return `<div class="problem-detail-prelim-bc-nested-row"><span class="problem-detail-prelim-bc-nested-label">${esc(lbl)}</span><div class="problem-detail-prelim-bc-nested-value">${inner}</div></div>`;
      })
      .join('');
    return `<div class="problem-detail-prelim-bc-subcard" data-depth="${depth}">
      <div class="problem-detail-prelim-bc-subcard-head">${esc(title)}</div>
      <div class="problem-detail-prelim-bc-subcard-body">${bodyHtml}</div>
    </div>`;
  }

  /**
   * 组织拓扑：外层子卡标题 + 内层横向圆角字段卡（与 painPointRadar 条带同构）。
   * @param {Object} obj - orgTopology
   * @param {function(string): string} esc
   * @param {function(string): string} renderWs
   */
  function buildPrelimOrgTopologyHorizontalSubcardHtml(obj, esc, renderWs) {
    const headTitle = PRELIM_BC_TOP_LABELS.orgTopology || '组织拓扑';
    const order = [
      ...PRELIM_BC_ORG_ORDER.filter((k) => Object.prototype.hasOwnProperty.call(obj, k)),
      ...Object.keys(obj).filter((k) => !PRELIM_BC_ORG_ORDER.includes(k)),
    ];
    const cards = order
      .map((k) => {
        const v = obj[k];
        const lbl = PRELIM_BC_ORG_LABELS[k] || formatPrelimBcFallbackLabel(k);
        if (v != null && typeof v === 'object' && !Array.isArray(v)) {
          const inner = `<pre class="problem-detail-prelim-pp-pre">${esc(JSON.stringify(v, null, 2))}</pre>`;
          return `<article class="problem-detail-prelim-pp-card problem-detail-prelim-pp-card--org-topo" data-field="${esc(k)}">
            <div class="problem-detail-prelim-pp-card-head">${esc(lbl)}</div>
            <div class="problem-detail-prelim-pp-card-body problem-detail-prelim-pp-card-body--scalar">${inner}</div>
          </article>`;
        }
        if (Array.isArray(v)) {
          const inner = `<pre class="problem-detail-prelim-pp-pre">${esc(JSON.stringify(v, null, 2))}</pre>`;
          return `<article class="problem-detail-prelim-pp-card problem-detail-prelim-pp-card--org-topo" data-field="${esc(k)}">
            <div class="problem-detail-prelim-pp-card-head">${esc(lbl)}</div>
            <div class="problem-detail-prelim-pp-card-body problem-detail-prelim-pp-card-body--scalar">${inner}</div>
          </article>`;
        }
        const text = v == null ? '' : String(v).trim();
        const inner = text ? renderWs(esc(text)) : '—';
        return `<article class="problem-detail-prelim-pp-card problem-detail-prelim-pp-card--org-topo" data-field="${esc(k)}">
          <div class="problem-detail-prelim-pp-card-head">${esc(lbl)}</div>
          <div class="problem-detail-prelim-pp-card-body problem-detail-prelim-pp-card-body--scalar">
            <div class="problem-detail-prelim-pp-row-value">${inner}</div>
          </div>
        </article>`;
      })
      .join('');
    return `<div class="problem-detail-prelim-bc-subcard" data-depth="1" data-org-topology-layout="horizontal">
      <div class="problem-detail-prelim-bc-subcard-head">${esc(headTitle)}</div>
      <div class="problem-detail-prelim-bc-subcard-body problem-detail-prelim-bc-subcard-body--org-hstrip">
        <div class="problem-detail-prelim-pp-wrap problem-detail-prelim-pp-wrap--nested-in-bc">
          <div class="problem-detail-prelim-pp-strip problem-detail-prelim-pp-strip--org-equal">${cards}</div>
        </div>
      </div>
    </div>`;
  }

  /**
   * 商业背景分区：层级子卡片 HTML（入参为 `businessContext` 对象）。
   * @param {Object} data
   * @param {function(string): string} esc
   * @param {function(string): string} renderWs - 已转义片段 → 工作区正文 HTML（`renderRequirementWorkspaceFieldValueHtml`）
   */
  function buildPreliminaryBusinessContextPanelHtml(data, esc, renderWs) {
    if (data == null || typeof data !== 'object' || Array.isArray(data)) {
      const s = data == null ? 'null' : JSON.stringify(data, null, 2);
      return `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json">${esc(s)}</pre>`;
    }
    const keys = [
      ...PRELIM_BC_TOP_ORDER.filter((k) => Object.prototype.hasOwnProperty.call(data, k)),
      ...Object.keys(data).filter((k) => !PRELIM_BC_TOP_ORDER.includes(k) && !PRELIM_BC_LEGACY_HIDDEN_KEYS.has(k)),
    ];
    const parts = keys
      .filter((key) => !PRELIM_BC_LEGACY_HIDDEN_KEYS.has(key))
      .map((key) => {
      const v = data[key];
      const title = PRELIM_BC_TOP_LABELS[key] || formatPrelimBcFallbackLabel(key);
      if (v != null && typeof v === 'object' && !Array.isArray(v)) {
        if (key === 'orgTopology') {
          return buildPrelimOrgTopologyHorizontalSubcardHtml(v, esc, renderWs);
        }
        return buildPrelimBusinessContextNestedCard(title, v, esc, renderWs, 1, null, null);
      }
      if (Array.isArray(v)) {
        return `<div class="problem-detail-prelim-bc-field">
          <span class="problem-detail-prelim-bc-field-label">${esc(title)}</span>
          <pre class="problem-detail-prelim-bc-field-pre">${esc(JSON.stringify(v, null, 2))}</pre>
        </div>`;
      }
      const text = v == null ? '' : typeof v === 'boolean' ? (v ? '是' : '否') : String(v).trim();
      const inner = text === '' ? '—' : renderWs(esc(text));
      return `<div class="problem-detail-prelim-bc-field">
        <span class="problem-detail-prelim-bc-field-label">${esc(title)}</span>
        <div class="problem-detail-prelim-bc-field-value">${inner}</div>
      </div>`;
    });
    return `<div class="problem-detail-prelim-bc-tree"><div class="problem-detail-prelim-bc-fields">${parts.join('')}</div></div>`;
  }

  /** painPointRadar 单项内字段中文标签（dimension 用作卡片标题） */
  const PRELIM_PP_RADAR_LABELS = {
    description: '痛点表现',
    itGap: 'IT 缺口',
  };

  /**
   * 需求痛点分区：横向圆角子卡片（`painPointRadar` 数组）。
   * @param {unknown[]} arr
   * @param {function(string): string} esc
   * @param {function(string): string} renderWs
   */
  function buildPreliminaryCorePainPointSummaryHtml(summary, esc, renderWs) {
    const text = String(summary || '').trim();
    if (!text) return '';
    return `<div class="problem-detail-prelim-pp-core-summary">
      <div class="problem-detail-prelim-pp-core-summary-h">${esc(PRELIM_PP_CORE_SUMMARY_LABEL)}</div>
      <div class="problem-detail-prelim-pp-core-summary-b">${renderWs(esc(text))}</div>
    </div>`;
  }

  function buildPreliminaryPainPointRadarPanelHtml(arr, esc, renderWs, corePainPointSummary) {
    const summaryBlock = buildPreliminaryCorePainPointSummaryHtml(corePainPointSummary, esc, renderWs);
    if (!Array.isArray(arr) || arr.length === 0) {
      if (summaryBlock) return summaryBlock;
      const s = !Array.isArray(arr) ? JSON.stringify(arr, null, 2) : '[]';
      return `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json">${esc(s)}</pre>`;
    }
    const cards = arr
      .map((item, idx) => {
        const n = idx + 1;
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return `<article class="problem-detail-prelim-pp-card problem-detail-prelim-pp-card--raw" data-index="${n}">
            <div class="problem-detail-prelim-pp-card-head">${esc(`条目 ${n}`)}</div>
            <div class="problem-detail-prelim-pp-card-body">
              <pre class="problem-detail-prelim-pp-pre">${esc(JSON.stringify(item, null, 2))}</pre>
            </div>
          </article>`;
        }
        const dimRaw = item.dimension;
        const head =
          dimRaw != null && String(dimRaw).trim() !== '' ? String(dimRaw).trim() : `痛点 ${n}`;
        const desc = item.description != null ? String(item.description).trim() : '';
        const gap = item.itGap != null ? String(item.itGap).trim() : '';
        const extraKeys = Object.keys(item).filter((k) => !['dimension', 'description', 'itGap'].includes(k));
        const extraHtml = extraKeys
          .map((k) => {
            const v = item[k];
            let text = '';
            if (v != null && typeof v === 'object') {
              try {
                text = JSON.stringify(v);
              } catch (_) {
                text = String(v);
              }
            } else if (v != null) {
              text = String(v).trim();
            }
            const inner = text ? renderWs(esc(text)) : '—';
            return `<div class="problem-detail-prelim-pp-row">
              <span class="problem-detail-prelim-pp-row-label">${esc(formatPrelimBcFallbackLabel(k))}</span>
              <div class="problem-detail-prelim-pp-row-value">${inner}</div>
            </div>`;
          })
          .join('');
        const descHtml = desc ? renderWs(esc(desc)) : '—';
        const gapHtml = gap ? renderWs(esc(gap)) : '—';
        return `<article class="problem-detail-prelim-pp-card" data-index="${n}">
          <div class="problem-detail-prelim-pp-card-head">${esc(head)}</div>
          <div class="problem-detail-prelim-pp-card-body">
            <div class="problem-detail-prelim-pp-row">
              <span class="problem-detail-prelim-pp-row-label">${esc(PRELIM_PP_RADAR_LABELS.description)}</span>
              <div class="problem-detail-prelim-pp-row-value">${descHtml}</div>
            </div>
            <div class="problem-detail-prelim-pp-row">
              <span class="problem-detail-prelim-pp-row-label">${esc(PRELIM_PP_RADAR_LABELS.itGap)}</span>
              <div class="problem-detail-prelim-pp-row-value">${gapHtml}</div>
            </div>
            ${extraHtml}
          </div>
        </article>`;
      })
      .join('');
    const body = `<div class="problem-detail-prelim-pp-wrap"><div class="problem-detail-prelim-pp-strip">${cards}</div></div>`;
    return summaryBlock ? `${summaryBlock}${body}` : body;
  }

  /** orgAndRoles 已知键（其余键以扩展子卡展示） */
  const PRELIM_ORG_ROLES_KNOWN_KEYS = ['stakeholders', 'governanceLogic', 'incentiveHooks'];

  /** itLandscape 已知键（其余键以扩展子卡展示） */
  const PRELIM_IT_LANDSCAPE_KNOWN_KEYS = ['legacySystems', 'integrationRequirements', 'deploymentMode'];

  /**
   * 人员组织分区：横向圆角子卡片（`operationModel.orgAndRoles` 对象；与需求痛点条带共用样式类）。
   * @param {Object} obj
   * @param {function(string): string} esc
   * @param {function(string): string} renderWs
   */
  function buildPreliminaryOrgAndRolesPanelHtml(obj, esc, renderWs) {
    if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
      const s = obj == null ? 'null' : JSON.stringify(obj, null, 2);
      return `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json">${esc(s)}</pre>`;
    }

    /** @param {unknown} v */
    function scalarDisplay(v) {
      if (v == null) return '—';
      const t = String(v).trim();
      if (t === '' || t === 'NOT_SPECIFIED') return '—';
      return renderWs(esc(t));
    }

    const cardParts = [];

    const sh = obj.stakeholders;
    const shRows = Array.isArray(sh) && sh.length > 0 ? consolidateOrgAndRolesStakeholdersArray(sh) : sh;
    if (Array.isArray(shRows) && shRows.length > 0) {
      shRows.forEach((item, idx) => {
        const n = idx + 1;
        if (item != null && typeof item === 'object' && !Array.isArray(item)) {
          cardParts.push(
            `<article class="problem-detail-prelim-pp-card problem-detail-prelim-pp-card--raw" data-org-field="stakeholders" data-index="${n}">` +
              `<div class="problem-detail-prelim-pp-card-head">${esc(`干系人 ${n}`)}</div>` +
              `<div class="problem-detail-prelim-pp-card-body">` +
              `<pre class="problem-detail-prelim-pp-pre">${esc(JSON.stringify(item, null, 2))}</pre>` +
              `</div></article>`,
          );
          return;
        }
        const fullText = item == null ? '' : String(item).trim();
        if (fullText === '' || fullText === 'NOT_SPECIFIED') {
          cardParts.push(
            `<article class="problem-detail-prelim-pp-card" data-org-field="stakeholders" data-index="${n}">` +
              `<div class="problem-detail-prelim-pp-card-head">${esc(`干系人 ${n}`)}</div>` +
              `<div class="problem-detail-prelim-pp-card-body">` +
              `<div class="problem-detail-prelim-pp-row-value problem-detail-prelim-org-stakeholder-value">—</div>` +
              `</div></article>`,
          );
          return;
        }
        const { title, body } = splitPrelimColonTitleBody(fullText);
        const head = title || `干系人 ${n}`;
        const inner = body === '' || body === '—' ? '—' : renderWs(esc(body));
        cardParts.push(
          `<article class="problem-detail-prelim-pp-card" data-org-field="stakeholders" data-index="${n}">` +
            `<div class="problem-detail-prelim-pp-card-head">${esc(head)}</div>` +
            `<div class="problem-detail-prelim-pp-card-body">` +
            `<div class="problem-detail-prelim-pp-row-value problem-detail-prelim-org-stakeholder-value">${inner}</div>` +
            `</div></article>`,
        );
      });
    } else if (sh != null && !Array.isArray(sh)) {
      if (typeof sh === 'object') {
        cardParts.push(
          `<article class="problem-detail-prelim-pp-card" data-org-field="stakeholders">` +
            `<div class="problem-detail-prelim-pp-card-head">${esc('干系人 / 角色')}</div>` +
            `<div class="problem-detail-prelim-pp-card-body">` +
            `<pre class="problem-detail-prelim-pp-pre">${esc(JSON.stringify(sh, null, 2))}</pre>` +
            `</div></article>`,
        );
      } else {
        const fullText = String(sh).trim();
        const { title, body } = splitPrelimColonTitleBody(fullText);
        const head = title || '干系人 / 角色';
        const inner =
          fullText === '' || fullText === 'NOT_SPECIFIED'
            ? '—'
            : body === '' || body === '—'
              ? '—'
              : renderWs(esc(body));
        cardParts.push(
          `<article class="problem-detail-prelim-pp-card" data-org-field="stakeholders">` +
            `<div class="problem-detail-prelim-pp-card-head">${esc(head)}</div>` +
            `<div class="problem-detail-prelim-pp-card-body">` +
            `<div class="problem-detail-prelim-pp-row-value problem-detail-prelim-org-stakeholder-value">${inner}</div>` +
            `</div></article>`,
        );
      }
    }

    const gov = obj.governanceLogic;
    if (gov != null && String(gov).trim() !== '' && String(gov).trim() !== 'NOT_SPECIFIED') {
      cardParts.push(
        `<article class="problem-detail-prelim-pp-card" data-org-field="governanceLogic">` +
          `<div class="problem-detail-prelim-pp-card-head">${esc('治理逻辑')}</div>` +
          `<div class="problem-detail-prelim-pp-card-body">` +
          `<div class="problem-detail-prelim-pp-row">` +
          `<span class="problem-detail-prelim-pp-row-label">${esc('统分与权责')}</span>` +
          `<div class="problem-detail-prelim-pp-row-value">${scalarDisplay(gov)}</div>` +
          `</div></div></article>`,
      );
    }

    const inc = obj.incentiveHooks;
    if (inc != null) {
      let incInner = '';
      if (Array.isArray(inc)) {
        const parts = inc
          .map((x) => {
            if (x == null) return '';
            const t = String(x).trim();
            if (t === '' || t === 'NOT_SPECIFIED') return '';
            return renderWs(esc(t));
          })
          .filter(Boolean);
        incInner = parts.length ? parts.join('<br>') : '';
      } else if (typeof inc === 'object') {
        incInner = `<pre class="problem-detail-prelim-pp-pre">${esc(JSON.stringify(inc, null, 2))}</pre>`;
      } else {
        const t = String(inc).trim();
        incInner = t === '' || t === 'NOT_SPECIFIED' ? '' : renderWs(esc(t));
      }
      if (incInner) {
        cardParts.push(
          `<article class="problem-detail-prelim-pp-card" data-org-field="incentiveHooks">` +
            `<div class="problem-detail-prelim-pp-card-head">${esc('激励挂钩')}</div>` +
            `<div class="problem-detail-prelim-pp-card-body">` +
            `<div class="problem-detail-prelim-pp-row">` +
            `<span class="problem-detail-prelim-pp-row-label">${esc('利益与激励')}</span>` +
            `<div class="problem-detail-prelim-pp-row-value problem-detail-prelim-pp-row-value--block">${incInner}</div>` +
            `</div></div></article>`,
        );
      }
    }

    const extraKeys = Object.keys(obj).filter((k) => !PRELIM_ORG_ROLES_KNOWN_KEYS.includes(k));
    for (const k of extraKeys) {
      const v = obj[k];
      let block = '';
      if (v != null && typeof v === 'object') {
        block = `<pre class="problem-detail-prelim-pp-pre">${esc(JSON.stringify(v, null, 2))}</pre>`;
      } else {
        block = `<div class="problem-detail-prelim-pp-row-value">${scalarDisplay(v)}</div>`;
      }
      cardParts.push(
        `<article class="problem-detail-prelim-pp-card problem-detail-prelim-pp-card--raw" data-org-field="${esc(k)}">` +
          `<div class="problem-detail-prelim-pp-card-head">${esc(formatPrelimBcFallbackLabel(k))}</div>` +
          `<div class="problem-detail-prelim-pp-card-body">${block}</div></article>`,
      );
    }

    if (cardParts.length === 0) {
      return `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json">${esc(JSON.stringify(obj, null, 2))}</pre>`;
    }
    return (
      `<div class="problem-detail-prelim-pp-wrap problem-detail-prelim-pp-wrap--org-roles">` +
      `<div class="problem-detail-prelim-pp-strip problem-detail-prelim-pp-strip--org-roles">${cardParts.join('')}</div></div>`
    );
  }

  /**
   * IT 现状需求分区：三块纵向子卡（现有系统 / 待集成系统 / 部署形态），卡内 `<ul>` 列表；扩展字段追加在同栈下方。
   * @param {Object} obj
   * @param {function(string): string} esc
   * @param {function(string): string} renderWs
   */
  function buildPreliminaryItLandscapePanelHtml(obj, esc, renderWs) {
    if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
      const s = obj == null ? 'null' : JSON.stringify(obj, null, 2);
      return `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json">${esc(s)}</pre>`;
    }

    /**
     * 将字段值规整为列表字符串（数组逐项、标量一条、对象/数组嵌套 JSON 一条）。
     * @param {unknown} v
     * @returns {string[]}
     */
    function collectItLandscapeListStrings(v) {
      if (v == null) return [];
      if (Array.isArray(v)) {
        const out = [];
        for (const el of v) {
          if (el == null) continue;
          if (typeof el === 'object') {
            try {
              out.push(JSON.stringify(el, null, 2));
            } catch (_) {
              out.push(String(el));
            }
          } else {
            const t = String(el).trim();
            if (t && t !== 'NOT_SPECIFIED') out.push(t);
          }
        }
        return out;
      }
      if (typeof v === 'object') {
        try {
          return [JSON.stringify(v, null, 2)];
        } catch (_) {
          return [String(v)];
        }
      }
      const t = String(v).trim();
      if (!t || t === 'NOT_SPECIFIED') return [];
      return [t];
    }

    /**
     * @param {string[]} strings
     */
    function renderItLandscapeListUl(strings) {
      if (!strings.length) {
        return `<ul class="problem-detail-prelim-it-list problem-detail-prelim-it-list--empty" role="list"><li>—</li></ul>`;
      }
      const lis = strings
        .map((s) => {
          if (s.indexOf('\n') >= 0) {
            return `<li><pre class="problem-detail-prelim-it-li-pre">${esc(s)}</pre></li>`;
          }
          return `<li>${renderWs(esc(s))}</li>`;
        })
        .join('');
      return `<ul class="problem-detail-prelim-it-list" role="list">${lis}</ul>`;
    }

    /**
     * @param {string} titleZh
     * @param {string} dataField
     * @param {string[]} strings
     */
    function itLandscapeSectionHtml(titleZh, dataField, strings) {
      return (
        `<article class="problem-detail-prelim-it-subcard" data-it-section="${esc(dataField)}">` +
        `<div class="problem-detail-prelim-it-subcard-head">${esc(titleZh)}</div>` +
        `<div class="problem-detail-prelim-it-subcard-body">${renderItLandscapeListUl(strings)}</div>` +
        `</article>`
      );
    }

    const parts = [
      itLandscapeSectionHtml('现有系统', 'legacySystems', collectItLandscapeListStrings(obj.legacySystems)),
      itLandscapeSectionHtml('待集成系统', 'integrationRequirements', collectItLandscapeListStrings(obj.integrationRequirements)),
      itLandscapeSectionHtml('部署形态', 'deploymentMode', collectItLandscapeListStrings(obj.deploymentMode)),
    ];

    const extraKeys = Object.keys(obj).filter((k) => !PRELIM_IT_LANDSCAPE_KNOWN_KEYS.includes(k));
    for (const k of extraKeys) {
      parts.push(
        itLandscapeSectionHtml(formatPrelimBcFallbackLabel(k), k, collectItLandscapeListStrings(obj[k])),
      );
    }

    return `<div class="problem-detail-prelim-it-stack">${parts.join('')}</div>`;
  }

  /** 流程卡正文展示字段顺序（不含 domain、processName，领域/流程标题已体现） */
  const PRELIM_FVS_BODY_FIELD_ORDER = ['nodes', 'actor', 'scope', 'logicAndRules', 'dataAsset'];

  /** `fullValueStreams` 字段中文标签（正文列表用；domain/processName 不在正文列出） */
  const PRELIM_FVS_FIELD_LABELS = {
    domain: '业务域',
    processName: '流程名称',
    nodes: '环节链',
    actor: '主责角色',
    scope: '组织覆盖范围',
    logicAndRules: '业务规则',
    dataAsset: '数据资产',
  };

  const PRELIM_FVS_SKIP_IN_PROCESS_BODY = new Set(['domain', 'processName']);

  /**
   * 业务流程分区：按 `domain` 领域子卡（标题含流程条数）→ 同领域流程子卡多行网格（默认每行 5 列）→ 流程卡内「字段名+内容」列表（排除 domain/processName）。
   * @param {unknown[]} arr
   * @param {function(string): string} esc
   * @param {function(string): string} renderWs
   */
  function buildPreliminaryFullValueStreamsPanelHtml(arr, esc, renderWs) {
    if (!Array.isArray(arr) || arr.length === 0) {
      const s = !Array.isArray(arr) ? JSON.stringify(arr, null, 2) : '[]';
      return `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json">${esc(s)}</pre>`;
    }

    /** @param {unknown} v */
    function fieldValueHtml(v) {
      if (v === undefined || v === null) {
        return '<p class="problem-detail-prelim-fvs-field-empty">—</p>';
      }
      if (typeof v === 'object') {
        let jsonStr = '';
        try {
          jsonStr = JSON.stringify(v, null, 2);
        } catch (_) {
          jsonStr = esc(String(v));
        }
        return `<pre class="problem-detail-card-json-pre problem-detail-prelim-fvs-json-pre">${esc(jsonStr)}</pre>`;
      }
      const t = String(v).trim();
      if (t === '' || t === 'NOT_SPECIFIED') {
        return '<p class="problem-detail-prelim-fvs-field-empty">—</p>';
      }
      return `<div class="problem-detail-prelim-fvs-field-scalar">${renderWs(esc(t))}</div>`;
    }

    /** @type {Map<string, { item: unknown, idx: number }[]>} */
    const byDomain = new Map();
    arr.forEach((item, idx) => {
      let domainKey = '未分类领域';
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const d = item.domain;
        if (d != null && String(d).trim() !== '' && String(d).trim() !== 'NOT_SPECIFIED') {
          domainKey = String(d).trim();
        }
      } else if (item != null) {
        domainKey = '其他';
      }
      if (!byDomain.has(domainKey)) byDomain.set(domainKey, []);
      byDomain.get(domainKey).push({ item, idx });
    });

    const domainSections = [];
    byDomain.forEach((entries, domainLabel) => {
      const processCards = entries
        .map(({ item, idx }) => {
          const n = idx + 1;
          if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return (
              `<article class="problem-detail-prelim-fvs-process" data-fvs-index="${n}">` +
              `<div class="problem-detail-prelim-fvs-process-head">${esc(`流程 ${n}`)}</div>` +
              `<div class="problem-detail-prelim-fvs-process-body">` +
              `<pre class="problem-detail-card-json-pre problem-detail-prelim-fvs-json-pre">${esc(JSON.stringify(item, null, 2))}</pre>` +
              `</div></article>`
            );
          }
          const pName = item.processName != null ? String(item.processName).trim() : '';
          const headTitle = pName !== '' && pName !== 'NOT_SPECIFIED' ? pName : `流程 ${n}`;
          const keys = [
            ...PRELIM_FVS_BODY_FIELD_ORDER.filter((k) => Object.prototype.hasOwnProperty.call(item, k)),
            ...Object.keys(item).filter(
              (k) =>
                !PRELIM_FVS_BODY_FIELD_ORDER.includes(k) &&
                !PRELIM_FVS_SKIP_IN_PROCESS_BODY.has(k),
            ),
          ];
          let bodyInner;
          if (keys.length === 0) {
            bodyInner = '<p class="problem-detail-prelim-fvs-field-empty">—</p>';
          } else {
            const rows = keys
              .map((k) => {
                const lbl = PRELIM_FVS_FIELD_LABELS[k] || formatPrelimBcFallbackLabel(k);
                return (
                  `<div class="problem-detail-prelim-fvs-row">` +
                  `<span class="problem-detail-prelim-fvs-row-label">${esc(lbl)}</span>` +
                  `<div class="problem-detail-prelim-fvs-row-value">${fieldValueHtml(item[k])}</div>` +
                  `</div>`
                );
              })
              .join('');
            bodyInner = `<div class="problem-detail-prelim-fvs-row-list">${rows}</div>`;
          }
          return (
            `<article class="problem-detail-prelim-fvs-process" data-fvs-index="${n}">` +
            `<div class="problem-detail-prelim-fvs-process-head">${esc(headTitle)}</div>` +
            `<div class="problem-detail-prelim-fvs-process-body">${bodyInner}</div></article>`
          );
        })
        .join('');
      const processCount = entries.length;
      domainSections.push(
        `<section class="problem-detail-prelim-fvs-domain" data-fvs-domain="${esc(domainLabel)}">` +
          `<div class="problem-detail-prelim-fvs-domain-head">` +
          `<span class="problem-detail-prelim-fvs-domain-head-title">${esc(domainLabel)}</span>` +
          `<span class="problem-detail-prelim-fvs-domain-head-count" title="该类目下流程条数">${esc(`(${processCount})`)}</span>` +
          `</div>` +
          `<div class="problem-detail-prelim-fvs-domain-body">${processCards}</div>` +
          `</section>`,
      );
    });

    return `<div class="problem-detail-prelim-fvs-stack">${domainSections.join('')}</div>`;
  }

  /** 生命周期状态标签配色种数（按索引取模） */
  const PRELIM_CBE_LIFECYCLE_TONE_COUNT = 6;

  /**
   * @param {number} index
   * @returns {string}
   */
  function prelimCbeLifecycleToneClass(index) {
    return `problem-detail-prelim-cbe-state-chip--tone-${index % PRELIM_CBE_LIFECYCLE_TONE_COUNT}`;
  }

  /** 分析备注条目中与 schema 示例重复的前缀，子卡内不再重复展示 */
  const PRELIM_ANALYST_NOTE_BOILERPLATE_RE = /^提取中发现的逻辑矛盾点[：:\s]*/u;

  /**
   * @param {string} text
   * @returns {string}
   */
  function stripPrelimAnalystNoteBoilerplate(text) {
    return String(text ?? '')
      .replace(PRELIM_ANALYST_NOTE_BOILERPLATE_RE, '')
      .trim();
  }

  /**
   * 分析备注：每条一项子卡纵向排列；去掉与 schema 示例重复的「提取中发现的逻辑矛盾点」前缀。
   * @param {unknown[]} arr
   * @param {function(string): string} esc
   * @param {function(string): string} renderWs
   */
  function buildPreliminaryAnalystNotesPanelHtml(arr, esc, renderWs) {
    if (!Array.isArray(arr) || arr.length === 0) {
      const s = !Array.isArray(arr) ? JSON.stringify(arr, null, 2) : '[]';
      return `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json">${esc(s)}</pre>`;
    }
    const cards = arr
      .map((item, idx) => {
        const n = idx + 1;
        const raw =
          typeof item === 'string'
            ? item
            : item != null && typeof item === 'object'
              ? JSON.stringify(item, null, 2)
              : String(item ?? '');
        const cleaned = typeof item === 'string' ? stripPrelimAnalystNoteBoilerplate(raw) : raw.trim();
        const body =
          cleaned && cleaned !== 'NOT_SPECIFIED'
            ? renderWs(esc(cleaned))
            : '<span class="problem-detail-prelim-an-note-empty">—</span>';
        return (
          `<article class="problem-detail-prelim-an-note-card" data-index="${n}">` +
          `<div class="problem-detail-prelim-an-note-card-body">${body}</div>` +
          `</article>`
        );
      })
      .join('');
    return `<div class="problem-detail-prelim-an-notes-stack">${cards}</div>`;
  }

  /** 概念类别标题栏图标（与「人/财/物/事」一致） */
  const PRELIMINARY_CBE_CATEGORY_HEAD_UI = {
    人: { icon: '👤', title: '人' },
    财: { icon: '💰', title: '财' },
    物: { icon: '📦', title: '物' },
    事: { icon: '📋', title: '事' },
  };

  /**
   * 单条核心对象 → 横向圆角卡 HTML（含概念解释 / 生命周期 / 归属逻辑）。
   * @param {unknown} item
   * @param {number} n 全局序号（展示用）
   */
  function buildPreliminarySingleCoreBusinessEntityCardHtml(item, n, esc, renderWs) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return (
        `<article class="problem-detail-prelim-pp-card problem-detail-prelim-pp-card--raw problem-detail-prelim-cbe-card" data-index="${n}">` +
        `<div class="problem-detail-prelim-pp-card-head">${esc(`条目 ${n}`)}</div>` +
        `<div class="problem-detail-prelim-pp-card-body">` +
        `<pre class="problem-detail-prelim-pp-pre">${esc(JSON.stringify(item, null, 2))}</pre>` +
        `</div></article>`
      );
    }
    const head =
      item.entityName != null && String(item.entityName).trim() !== ''
        ? String(item.entityName).trim()
        : `核心业务对象 ${n}`;
    const explRaw = getCoreEntityConceptExplanationRaw(item);
    const explTrunc = truncatePrelimConceptExplanationUnicodeChars(explRaw, PRELIMINARY_CBE_CONCEPT_EXPL_MAX_UNICODE);
    const explHtml =
      explTrunc && explTrunc !== 'NOT_SPECIFIED' ? renderWs(esc(explTrunc)) : '<span class="problem-detail-prelim-cbe-empty">—</span>';
    const statesRaw = item.lifecycleStates;
    const states = Array.isArray(statesRaw)
      ? statesRaw.map((x) => String(x != null ? x : '').trim()).filter(Boolean)
      : statesRaw != null && String(statesRaw).trim() !== ''
        ? [String(statesRaw).trim()]
        : [];
    const lifecycleInner =
      states.length === 0
        ? '<span class="problem-detail-prelim-cbe-empty">—</span>'
        : states
            .map((st, si) => {
              const chip = `<span class="problem-detail-prelim-cbe-state-chip ${prelimCbeLifecycleToneClass(si)}">${esc(st)}</span>`;
              const arrow =
                si < states.length - 1
                  ? '<span class="problem-detail-prelim-cbe-state-arrow" aria-hidden="true">→</span>'
                  : '';
              return chip + arrow;
            })
            .join('');
    const ownRaw = item.ownershipLogic != null ? String(item.ownershipLogic).trim() : '';
    const ownHtml = ownRaw && ownRaw !== 'NOT_SPECIFIED' ? renderWs(esc(ownRaw)) : '—';
    return (
      `<article class="problem-detail-prelim-pp-card problem-detail-prelim-cbe-card" data-index="${n}">` +
      `<div class="problem-detail-prelim-pp-card-head">${esc(head)}</div>` +
      `<div class="problem-detail-prelim-pp-card-body problem-detail-prelim-cbe-card-body">` +
      `<div class="problem-detail-prelim-cbe-nest">` +
      `<div class="problem-detail-prelim-cbe-nest-head">${esc('概念解释')}</div>` +
      `<div class="problem-detail-prelim-cbe-nest-body problem-detail-prelim-cbe-concept-expl">${explHtml}</div>` +
      `</div>` +
      `<div class="problem-detail-prelim-cbe-nest">` +
      `<div class="problem-detail-prelim-cbe-nest-head">${esc('生命周期')}</div>` +
      `<div class="problem-detail-prelim-cbe-nest-body problem-detail-prelim-cbe-lifecycle">${lifecycleInner}</div>` +
      `</div>` +
      `<div class="problem-detail-prelim-cbe-nest">` +
      `<div class="problem-detail-prelim-cbe-nest-head">${esc('归属逻辑')}</div>` +
      `<div class="problem-detail-prelim-cbe-nest-body problem-detail-prelim-cbe-ownership">${ownHtml}</div>` +
      `</div>` +
      `</div></article>`
    );
  }

  /**
   * 核心业务对象：按概念类别（人/财/物/事）分卡片；类内网格每行 4 卡；对象卡内概念解释在生命周期之上。
   * @param {unknown[]} arr
   * @param {function(string): string} esc
   * @param {function(string): string} renderWs
   */
  function buildPreliminaryCoreBusinessEntitiesPanelHtml(arr, esc, renderWs) {
    if (!Array.isArray(arr) || arr.length === 0) {
      const s = !Array.isArray(arr) ? JSON.stringify(arr, null, 2) : '[]';
      return `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json">${esc(s)}</pre>`;
    }
    /** @type {Record<string, unknown[]>} */
    const byCat = { 人: [], 财: [], 物: [], 事: [] };
    for (const item of arr) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        byCat['事'].push(item);
        continue;
      }
      const cat = normalizeCoreEntityConceptCategory(getCoreEntityConceptCategoryRaw(item));
      byCat[cat].push(item);
    }
    let globalIdx = 0;
    const sections = PRELIMINARY_CBE_CONCEPT_CATEGORIES.map((cat) => {
      const ui = PRELIMINARY_CBE_CATEGORY_HEAD_UI[cat] || { icon: '•', title: cat };
      const items = byCat[cat] || [];
      const cards = items
        .map((item) => {
          globalIdx += 1;
          return buildPreliminarySingleCoreBusinessEntityCardHtml(item, globalIdx, esc, renderWs);
        })
        .join('');
      const bodyInner =
        items.length === 0
          ? `<p class="problem-detail-prelim-cbe-category-empty">${esc('本类别下暂无提炼对象')}</p>`
          : `<div class="problem-detail-prelim-pp-wrap problem-detail-prelim-pp-wrap--in-object-state problem-detail-prelim-pp-wrap--cbe-4col">` +
            `<div class="problem-detail-prelim-pp-strip problem-detail-prelim-pp-strip--cbe-4col">${cards}</div></div>`;
      return (
        `<section class="problem-detail-prelim-cbe-category-card" data-cbe-category="${esc(cat)}">` +
        `<header class="problem-detail-prelim-cbe-category-head">` +
        `<span class="problem-detail-prelim-cbe-category-icon" aria-hidden="true">${ui.icon}</span>` +
        `<span class="problem-detail-prelim-cbe-category-title">${esc(ui.title)}</span>` +
        `</header>` +
        `<div class="problem-detail-prelim-cbe-category-body">${bodyInner}</div>` +
        `</section>`
      );
    }).join('');
    return `<div class="problem-detail-prelim-cbe-category-stack">${sections}</div>`;
  }

  /** 状态转移矩阵 → Mermaid 边标签最大展示长度 */
  const PRELIM_STM_EDGE_LABEL_MAX = 56;

  /**
   * 单状态文案归一（用于节点合并与占位）。
   * @param {unknown} raw
   * @returns {string}
   */
  function prelimStmNormalizeState(raw) {
    if (raw == null) return '（未指定状态）';
    const s = String(raw).trim();
    if (!s || s === 'NOT_SPECIFIED') return '（未指定状态）';
    return s;
  }

  /**
   * Mermaid 节点/子图标题内引号标签的精简与字符清理（避免破坏 flowchart 语法）。
   * @param {unknown} text
   * @param {number} maxLen
   * @returns {string}
   */
  function prelimStmEscapeMermaidQuotedLabel(text, maxLen) {
    let s = String(text ?? '')
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, ' ');
    /* Mermaid flowchart：引号内若含 []#<> 等易被子图/注释/ HTML 标签解析误切分，改为全角或空格 */
    s = s
      .replace(/["|\\]/g, ' ')
      .replace(/\|/g, '｜')
      .replace(/\[/g, '［')
      .replace(/\]/g, '］')
      .replace(/#/g, '＃')
      .replace(/</g, '＜')
      .replace(/>/g, '＞');
    s = s.trim();
    if (!s) s = '—';
    const ch = Array.from(s);
    return ch.length <= maxLen ? s : ch.slice(0, Math.max(1, maxLen - 1)).join('') + '…';
  }

  /**
   * 从单条转移记录生成边上展示文案（触发/角色）。
   * @param {Record<string, unknown>} row
   * @returns {string}
   */
  function prelimStmBuildEdgeLabel(row) {
    const parts = [];
    const tr = row.triggerEvent != null ? String(row.triggerEvent).trim() : '';
    if (tr && tr !== 'NOT_SPECIFIED') parts.push(tr);
    const act = row.actor != null ? String(row.actor).trim() : '';
    if (act && act !== 'NOT_SPECIFIED') parts.push(`角色：${act}`);
    const label = parts.length ? parts.join(' · ') : '转移';
    return prelimStmEscapeMermaidQuotedLabel(label, PRELIM_STM_EDGE_LABEL_MAX);
  }

  /**
   * 将矩阵行按 entity 分组（供 Mermaid 子图 / 分格渲染）。
   * @param {unknown[]} matrix
   * @returns {Map<string, Record<string, unknown>[]>}
   */
  /**
   * @param {unknown[]} matrix
   * @param {Map<string, string>} [canonicalEntityMap] - 与核心对象列表一致的「归一化名 → entityName」
   */
  function prelimStmGroupMatrixRowsByEntity(matrix, canonicalEntityMap) {
    if (!Array.isArray(matrix) || matrix.length === 0) return new Map();
    const rows = matrix.filter((r) => r && typeof r === 'object' && !Array.isArray(r));
    if (rows.length === 0) return new Map();
    const canonMap = canonicalEntityMap && canonicalEntityMap instanceof Map ? canonicalEntityMap : new Map();
    const byEntity = new Map();
    for (const r of rows) {
      let ent = r.entity != null ? String(r.entity).trim() : '';
      if (!ent || ent === 'NOT_SPECIFIED') {
        ent = '未命名对象';
      } else {
        ent = resolveStateMatrixEntityDisplayName(ent, canonMap);
        if (!ent || ent === 'NOT_SPECIFIED') ent = '未命名对象';
      }
      if (!byEntity.has(ent)) byEntity.set(ent, []);
      byEntity.get(ent).push(r);
    }
    return byEntity;
  }

  /**
   * 单条状态矩阵行在指定初步需求上下文下的 entity **展示分组键**（与 Mermaid 分格、合并分组一致）。
   * @param {unknown} row
   * @param {Object} [preliminaryReq]
   * @returns {string}
   */
  function getPrelimStmRowEntityDisplayLabel(row, preliminaryReq) {
    const pre = preliminaryReq && typeof preliminaryReq === 'object' ? preliminaryReq : {};
    const core = getMeaningfulDirectWorkspaceSlice(pre, 'coreBusinessEntities');
    const canonMap = buildCanonicalEntityNameLookup(Array.isArray(core) ? core : []);
    if (!row || typeof row !== 'object' || Array.isArray(row)) return '未命名对象';
    let ent = row.entity != null ? String(row.entity).trim() : '';
    if (!ent || ent === 'NOT_SPECIFIED') return '未命名对象';
    ent = resolveStateMatrixEntityDisplayName(ent, canonMap);
    if (!ent || ent === 'NOT_SPECIFIED') return '未命名对象';
    return ent;
  }

  /**
   * 将状态矩阵按 entity 展示名分组（供 task1 合并 Session 计划与 entity 分桶 LLM）。
   * @param {unknown[]} matrix
   * @param {Object} [preliminaryReq] - 用于读取 coreBusinessEntities 做展示名归一
   * @returns {Map<string, Record<string, unknown>[]>}
   */
  function groupPreliminaryStmMatrixRowsByEntityLabel(matrix, preliminaryReq) {
    const pre = preliminaryReq && typeof preliminaryReq === 'object' ? preliminaryReq : {};
    const core = getMeaningfulDirectWorkspaceSlice(pre, 'coreBusinessEntities');
    const canonMap = buildCanonicalEntityNameLookup(Array.isArray(core) ? core : []);
    return prelimStmGroupMatrixRowsByEntity(matrix, canonMap);
  }

  /**
   * 向 lines 追加一个 entity 子图（flowchart 内 subgraph，direction LR）。
   * @param {string[]} lines
   * @param {string} subgraphId
   * @param {string} entLabel
   * @param {Record<string, unknown>[]} list
   */
  function prelimStmAppendEntitySubgraph(lines, subgraphId, entLabel, list) {
    const titleEsc = prelimStmEscapeMermaidQuotedLabel(entLabel, 72);
    lines.push(`  subgraph ${subgraphId}["${titleEsc}"]`);
    lines.push('    direction LR');
    const stateKeyToId = new Map();
    let n = 0;
    const getId = (rawState) => {
      const k = prelimStmNormalizeState(rawState);
      if (!stateKeyToId.has(k)) {
        stateKeyToId.set(k, `${subgraphId}_n${n++}`);
      }
      return stateKeyToId.get(k);
    };
    for (const r of list) {
      getId(r.fromState);
      getId(r.toState);
    }
    for (const [stateLabel, nid] of stateKeyToId) {
      const disp = prelimStmEscapeMermaidQuotedLabel(stateLabel, 48);
      lines.push(`    ${nid}["${disp}"]`);
    }
    for (const r of list) {
      const a = getId(r.fromState);
      const b = getId(r.toState);
      const lb = prelimStmBuildEdgeLabel(r);
      lines.push(`    ${a} -->|"${lb}"| ${b}`);
    }
    lines.push('  end');
  }

  /**
   * 将 `stateTransitionMatrix` 数组转为**单张** Mermaid flowchart（多 entity 多 subgraph 并列，兼容/调试）。
   * @param {unknown[]} matrix
   * @returns {string} 空字符串表示无法生成（调用方回退 JSON）。
   */
  function buildStateTransitionMatrixMermaidSource(matrix, canonicalEntityMap) {
    const byEntity = prelimStmGroupMatrixRowsByEntity(matrix, canonicalEntityMap);
    if (byEntity.size === 0) return '';
    const lines = ['flowchart TB'];
    let eIdx = 0;
    for (const [entLabel, list] of byEntity) {
      prelimStmAppendEntitySubgraph(lines, `PE${eIdx}`, entLabel, list);
      eIdx += 1;
    }
    return lines.join('\n');
  }

  /**
   * 单个 entity 一张独立 Mermaid 图（用于工作区网格，每格单独 `mermaid.run`）。
   * @param {string} entLabel
   * @param {Record<string, unknown>[]} list
   * @returns {string}
   */
  function buildStateTransitionMatrixMermaidSourceForEntity(entLabel, list) {
    if (!Array.isArray(list) || list.length === 0) return '';
    const lines = ['flowchart TB'];
    prelimStmAppendEntitySubgraph(lines, 'PE0', entLabel, list);
    return lines.join('\n');
  }

  /**
   * 某 entity 下状态转移逐条摘要列表（工作区折叠卡片正文上部）。
   * @param {Record<string, unknown>[]} list
   * @param {function(string): string} esc
   */
  function buildPrelimStmTransitionRowsListHtml(list, esc) {
    if (!Array.isArray(list) || list.length === 0) return '';
    const parts = [];
    for (let j = 0; j < list.length; j++) {
      const r = list[j];
      if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
      const from = r.fromState != null ? String(r.fromState).trim() : '—';
      const to = r.toState != null ? String(r.toState).trim() : '—';
      const trig = r.triggerEvent != null ? String(r.triggerEvent).trim() : '';
      const actor = r.actor != null ? String(r.actor).trim() : '';
      const guardsRaw = r.guards;
      let guards = '';
      if (guardsRaw != null && typeof guardsRaw === 'object') {
        try {
          guards = JSON.stringify(guardsRaw);
        } catch (_) {
          guards = String(guardsRaw);
        }
      } else if (guardsRaw != null) {
        guards = String(guardsRaw).trim();
      }
      const metaBits = [];
      if (trig) metaBits.push(`触发：${trig}`);
      if (actor) metaBits.push(`执行方：${actor}`);
      if (guards) metaBits.push(`守卫：${guards.length > 120 ? `${guards.slice(0, 120)}…` : guards}`);
      const meta = metaBits.join(' · ');
      parts.push(
        `<div class="problem-detail-prelim-stm-transition-item" role="listitem">` +
          `<div class="problem-detail-prelim-stm-transition-main"><span class="problem-detail-prelim-stm-transition-idx">${j + 1}.</span> ` +
          `<strong>${esc(from)}</strong> <span class="problem-detail-prelim-stm-transition-arrow" aria-hidden="true">→</span> <strong>${esc(to)}</strong></div>` +
          (meta
            ? `<div class="problem-detail-prelim-stm-transition-meta">${esc(meta)}</div>`
            : '') +
          `</div>`,
      );
    }
    if (!parts.length) return '';
    return `<div class="problem-detail-prelim-stm-transition-list" role="list">${parts.join('')}</div>`;
  }

  /**
   * 状态转移矩阵：按 entity **分格**渲染（每格独立 Mermaid）；无法生成时回退 JSON pre。
   * @param {unknown} matrix - 原始矩阵（非空数组）
   * @param {function(string): string} esc
   * @returns {string}
   */
  /**
   * @param {unknown} matrix
   * @param {function(string): string} esc
   * @param {Object} [preliminary] - 用于与 `coreBusinessEntities` 对齐状态矩阵中的 entity 展示名
   */
  function buildPreliminaryStateTransitionMatrixPanelHtml(matrix, esc, preliminary) {
    const pre = preliminary && typeof preliminary === 'object' ? preliminary : {};
    const core = getMeaningfulDirectWorkspaceSlice(pre, 'coreBusinessEntities');
    const canonMap = buildCanonicalEntityNameLookup(Array.isArray(core) ? core : []);
    const byEntity = prelimStmGroupMatrixRowsByEntity(matrix, canonMap);
    if (byEntity.size === 0) {
      let matrixJson = 'null';
      try {
        matrixJson = matrix === undefined || matrix === null ? 'null' : JSON.stringify(matrix, null, 2);
      } catch (_) {
        matrixJson = esc(String(matrix));
      }
      return `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json problem-detail-prelim-object-state-pre">${esc(matrixJson)}</pre>`;
    }
    const stmFsEnterIcon =
      '<svg class="problem-detail-value-stream-fs-icon-enter" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    const stmFsExitIcon =
      '<svg class="problem-detail-value-stream-fs-icon-exit" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
    const cells = [];
    let displayIdx = 0;
    for (const [entLabel, list] of byEntity) {
      const src = buildStateTransitionMatrixMermaidSourceForEntity(entLabel, list);
      if (!src) continue;
      displayIdx += 1;
      const titleEsc = esc(entLabel);
      const n = Array.isArray(list) ? list.length : 0;
      const titleWithCount = `${titleEsc}（${n}）`;
      const listHtml = buildPrelimStmTransitionRowsListHtml(list, esc);
      cells.push(
        `<div class="problem-detail-prelim-stm-row">` +
          `<span class="problem-detail-prelim-stm-row-index" aria-hidden="true">${displayIdx}</span>` +
          `<details class="problem-detail-prelim-stm-entity-details" open>` +
          `<summary class="problem-detail-prelim-stm-entity-summary">` +
          `<span class="problem-detail-prelim-stm-entity-summary-inner">` +
          `<span class="problem-detail-prelim-stm-entity-chevron" aria-hidden="true"></span>` +
          `<span class="problem-detail-prelim-stm-entity-summary-title" title="${titleWithCount}">${titleWithCount}</span>` +
          `</span></summary>` +
          `<div class="problem-detail-prelim-stm-entity-body">` +
          listHtml +
          `<div class="problem-detail-prelim-stm-card">` +
          `<div class="problem-detail-prelim-stm-card-head">` +
          `<span class="problem-detail-prelim-stm-card-title" title="${titleWithCount}">状态关系图</span>` +
          `<button type="button" class="problem-detail-e2e-flow-fs-btn problem-detail-prelim-stm-fs-btn" title="全屏显示状态逻辑图" aria-label="全屏显示状态逻辑图" aria-pressed="false">${stmFsEnterIcon}${stmFsExitIcon}</button>` +
          `</div>` +
          `<div class="problem-detail-prelim-stm-subpanels">` +
          `<div class="problem-detail-prelim-stm-subpanel">` +
          `<div class="problem-detail-prelim-stm-mermaid-mount" data-prelim-stm-hydrated="0">` +
          `<textarea class="problem-detail-prelim-stm-mermaid-store" hidden readonly>${esc(src)}</textarea>` +
          `<div class="problem-detail-prelim-stm-mermaid-host"></div>` +
          `<p class="problem-detail-prelim-stm-mermaid-error" hidden></p>` +
          `</div></div></div></div></div></details></div>`,
      );
    }
    if (!cells.length) {
      let matrixJson = 'null';
      try {
        matrixJson = matrix === undefined || matrix === null ? 'null' : JSON.stringify(matrix, null, 2);
      } catch (_) {
        matrixJson = esc(String(matrix));
      }
      return `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json problem-detail-prelim-object-state-pre">${esc(matrixJson)}</pre>`;
    }
    return `<div class="problem-detail-prelim-stm-grid">${cells.join('')}</div>`;
  }

  /** 「分析备注」Tab：analystNotes 子卡纵向列表 */
  function buildPreliminaryAnalystNotesSectionPanelHtml(preliminary, esc, renderWs) {
    const notes = getMeaningfulDirectWorkspaceSlice(preliminary, 'analystNotes');
    const inner =
      Array.isArray(notes) && notes.length > 0
        ? buildPreliminaryAnalystNotesPanelHtml(notes, esc, renderWs)
        : (() => {
            let j = 'null';
            try {
              j = notes === undefined || notes === null ? 'null' : JSON.stringify(notes, null, 2);
            } catch (_) {
              j = esc(String(notes));
            }
            return `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json problem-detail-prelim-object-state-pre">${esc(j)}</pre>`;
          })();
    return `<div class="problem-detail-prelim-an-notes-wrap">${inner}</div>`;
  }

  /** 「核心对象」Tab：仅核心业务对象横向卡或 JSON 回退 */
  function buildPreliminaryCoreObjectsSectionPanelHtml(preliminary, esc, renderWs) {
    const entities = getMeaningfulDirectWorkspaceSlice(preliminary, 'coreBusinessEntities');
    let entitiesInner;
    if (Array.isArray(entities) && entities.length > 0) {
      entitiesInner = buildPreliminaryCoreBusinessEntitiesPanelHtml(entities, esc, renderWs);
    } else {
      let entitiesJson = 'null';
      try {
        entitiesJson = entities === undefined || entities === null ? 'null' : JSON.stringify(entities, null, 2);
      } catch (_) {
        entitiesJson = esc(String(entities));
      }
      entitiesInner = `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json problem-detail-prelim-object-state-pre">${esc(entitiesJson)}</pre>`;
    }
    return `<div class="problem-detail-prelim-object-state-wrap problem-detail-prelim-object-state-wrap--single">${entitiesInner}</div>`;
  }

  /** 「状态逻辑」Tab：仅状态转移矩阵 Mermaid 或 JSON 回退 */
  function buildPreliminaryStateLogicSectionPanelHtml(preliminary, esc) {
    const matrix = getMeaningfulDirectWorkspaceSlice(preliminary, 'stateTransitionMatrix');
    let matrixInner;
    if (Array.isArray(matrix) && matrix.length > 0) {
      matrixInner = buildPreliminaryStateTransitionMatrixPanelHtml(matrix, esc, preliminary);
    } else {
      let matrixJson = 'null';
      try {
        matrixJson = matrix === undefined || matrix === null ? 'null' : JSON.stringify(matrix, null, 2);
      } catch (_) {
        matrixJson = esc(String(matrix));
      }
      matrixInner = `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json problem-detail-prelim-object-state-pre">${esc(matrixJson)}</pre>`;
    }
    return `<div class="problem-detail-prelim-object-state-wrap problem-detail-prelim-object-state-wrap--single problem-detail-prelim-object-state-wrap--stm">${matrixInner}</div>`;
  }

  /**
   * 工作区「初步需求」卡 view 面板：横向分区 Tab，点击切换展示对应分区的 JSON（pre 块）。
   * 统一 view 多分区；仅展示 `preliminaryReq` 内 V2 路径已有值（无则该面板为 null）。
   */
  function buildPreliminaryWorkspaceSectionTabsHtml(item, escapeHtml) {
    const esc = escapeHtml || ((s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
    const preliminary = buildResolvedPreliminaryRequirement(item);
    const emptyHint =
      '<p class="problem-detail-prelim-empty">暂无初步需求提炼结果，请在任务对话中完成客户初步需求提炼。</p>';

    const wrapTabs = (tabButtonsHtml, panelsHtml) =>
      `<div class="problem-detail-prelim-section-tabs">` +
      `<div class="problem-detail-prelim-section-tablist" role="tablist">${tabButtonsHtml}</div>` +
      `<div class="problem-detail-prelim-section-panels">${panelsHtml}</div>` +
      `</div>`;

    if (!hasPreliminaryWorkspaceViewContent(preliminary)) {
      logPrelimWorkspaceViewWhenEmpty(item, preliminary);
      return emptyHint;
    }

    const tabButtons = PRELIMINARY_V2_WORKSPACE_VIEW_SECTIONS.map((sec, i) => {
      const { path, label } = sec;
      const active = i === 0 ? ' problem-detail-prelim-section-tab-active' : '';
      const selected = i === 0 ? 'true' : 'false';
      return `<button type="button" class="problem-detail-prelim-section-tab${active}" role="tab" aria-selected="${selected}" data-section="${esc(path)}">${esc(label)}</button>`;
    }).join('');
    const renderWs =
      typeof global.renderRequirementWorkspaceFieldValueHtml === 'function'
        ? global.renderRequirementWorkspaceFieldValueHtml
        : (escaped) => renderMarkdownBold(escaped).replace(/\n/g, '<br>');
    const panels = PRELIMINARY_V2_WORKSPACE_VIEW_SECTIONS.map((sec, i) => {
      const { path, kind } = sec;
      const raw =
        kind === 'coreObjects' || kind === 'stateLogic' || kind === 'analystNotes'
          ? null
          : getPreliminaryWorkspaceSectionValue(preliminary, path);
      const hiddenAttr = i === 0 ? '' : ' hidden';
      let panelBody;
      if (kind === 'coreObjects') {
        panelBody = buildPreliminaryCoreObjectsSectionPanelHtml(preliminary, esc, renderWs);
      } else if (kind === 'stateLogic') {
        panelBody = buildPreliminaryStateLogicSectionPanelHtml(preliminary, esc);
      } else if (kind === 'analystNotes') {
        panelBody = buildPreliminaryAnalystNotesSectionPanelHtml(preliminary, esc, renderWs);
      } else if (path === 'businessContext' && raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
        panelBody = buildPreliminaryBusinessContextPanelHtml(raw, esc, renderWs);
      } else if (path === 'itLandscape' && raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
        panelBody = buildPreliminaryItLandscapePanelHtml(raw, esc, renderWs);
      } else if (path === 'painPointRadar') {
        const ppSummary = resolveCorePainPointSummaryFromPreliminary(preliminary);
        const ppArr = Array.isArray(raw) ? raw : [];
        if (ppSummary || ppArr.length > 0) {
          panelBody = buildPreliminaryPainPointRadarPanelHtml(ppArr, esc, renderWs, ppSummary);
        } else {
          panelBody = `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json">${esc('[]')}</pre>`;
        }
      } else if (path === 'operationModel.orgAndRoles' && raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
        panelBody = buildPreliminaryOrgAndRolesPanelHtml(raw, esc, renderWs);
      } else if (path === 'operationModel.fullValueStreams' && Array.isArray(raw) && raw.length > 0) {
        panelBody = buildPreliminaryFullValueStreamsPanelHtml(raw, esc, renderWs);
      } else {
        let jsonStr = 'null';
        try {
          jsonStr = raw === undefined || raw === null ? 'null' : JSON.stringify(raw, null, 2);
        } catch (_) {
          jsonStr = esc(String(raw));
        }
        panelBody = `<pre class="problem-detail-card-json-pre problem-detail-prelim-section-json">${esc(jsonStr)}</pre>`;
      }
      return `<div class="problem-detail-prelim-section-panel" role="tabpanel" data-section="${esc(path)}"${hiddenAttr}>${panelBody}</div>`;
    }).join('');
    return wrapTabs(tabButtons, panels);
  }

  function buildPreliminaryCardRowsHtml(item, escapeHtml) {
    const esc = escapeHtml || ((s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
    const preliminary = buildResolvedPreliminaryRequirement(item);
    try {
      console.debug('[FE:preliminary-resolve]', {
        preliminaryReq: item?.preliminaryReq,
        resolvedKeys: preliminary && typeof preliminary === 'object' ? Object.keys(preliminary) : [],
      });
    } catch {}

    return PRELIMINARY_V2_WORKSPACE_VIEW_SECTIONS.map((sec) => {
      const { path, label } = sec;
      const raw = getPreliminaryWorkspaceSectionValue(preliminary, path);
      const value =
        raw != null && typeof raw !== 'object'
          ? String(raw).trim()
          : raw != null && typeof raw === 'object'
            ? JSON.stringify(raw, null, 2)
            : '—';
      const valueHtml =
        typeof raw === 'object' && raw != null
          ? `<pre class="problem-detail-card-json-pre">${esc(value === '—' ? '—' : value)}</pre>`
          : renderRequirementWorkspaceFieldValueHtml(esc(value || '—'));
      return `<div class="problem-detail-row" data-field="${esc(label)}"><span class="problem-detail-label">${esc(label)}</span><span class="problem-detail-value">${valueHtml}</span></div>`;
    }).join('');
  }

  /**
   * 构建「总结提炼」专用 JSON，供时间线「客户初步需求 json」与 BMC 生成入参使用（不含需求详情）。
   */
  function buildPreliminarySummaryJson(item) {
    if (!item) return {};
    const preliminary = buildResolvedPreliminaryRequirement(item);
    if (!isPreliminaryRequirementV2Shape(preliminary)) return {};
    const out = {};
    PRELIMINARY_V2_TOP_KEYS.forEach((k) => {
      if (preliminary[k] !== undefined) out[k] = preliminary[k];
    });
    return out;
  }

  /** 工作区初步需求卡「JSON」Tab：深度提炼结构 Pretty（不含 requirementDetail） */
  function buildPreliminaryStructuredJsonString(item) {
    try {
      return JSON.stringify(buildPreliminarySummaryJson(item), null, 2);
    } catch (_) {
      return '{}';
    }
  }

  /**
   * 构建「初步需求（整块）」的 preContent 对象，供意图修改等使用。
   */
  function buildPreliminaryPreContent(item) {
    const preliminary = buildResolvedPreliminaryRequirement(item);
    if (!isPreliminaryRequirementV2Shape(preliminary)) {
      return {
        customerName: preliminary.customerName,
        requirementDetail: preliminary.requirementDetail,
      };
    }
    const out = {};
    PRELIMINARY_V2_TOP_KEYS.forEach((k) => {
      if (preliminary[k] !== undefined) out[k] = preliminary[k];
    });
    out.requirementDetail = preliminary.requirementDetail;
    return out;
  }

  /** 需求详情历史编号：RQ-001（与数组顺序 1 起对齐） */
  function formatRequirementDetailHistoryCode(serial) {
    const n = Math.max(1, Math.floor(Number(serial)) || 1);
    return `RQ-${String(n).padStart(3, '0')}`;
  }

  /**
   * 从单次需求原文提炼标题（取首行非空文本，最多 30 个 Unicode 字符）。
   * @param {string} text
   * @returns {string}
   */
  function extractRequirementDetailHistoryTitle(text) {
    const raw = String(text ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!raw) return '（无标题）';
    const line = raw.split(/\n/)[0].trim();
    const chars = Array.from(line);
    const max = REQUIREMENT_DETAIL_HISTORY_TITLE_MAX_LEN;
    if (chars.length <= max) return line;
    return chars.slice(0, max).join('');
  }

  /**
   * 写入 `requirementDetailHistory` 的单条记录（含提炼标题）。
   * @param {string} content - 该次提交的原始需求全文
   * @returns {{ timestamp: string, content: string, title: string }}
   */
  function buildRequirementDetailHistoryEntry(content) {
    const c = String(content ?? '');
    return {
      timestamp: new Date().toISOString(),
      content: c,
      title: extractRequirementDetailHistoryTitle(c),
    };
  }

  /**
   * 展示用标题：优先持久化的 `entry.title`，否则从正文提炼。
   */
  function getRequirementDetailHistoryDisplayTitle(entry, content) {
    const body = String(content ?? '').trim();
    if (entry && entry.title != null && String(entry.title).trim() !== '') {
      const t = String(entry.title).trim();
      const ch = Array.from(t);
      const max = REQUIREMENT_DETAIL_HISTORY_TITLE_MAX_LEN;
      return ch.length <= max ? t : ch.slice(0, max).join('');
    }
    return extractRequirementDetailHistoryTitle(body);
  }

  /**
   * 格式化为本地日期时间字符串，用于历史详情时间线展示。
   * @param {string} timestamp - ISO 或可解析的时间字符串。
   * @returns {string} 格式化后的字符串。
   */
  function formatPreliminaryHistoryTime(timestamp) {
    if (!timestamp) return '—';
    try {
      const d = new Date(timestamp);
      if (Number.isNaN(d.getTime())) return String(timestamp);
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return String(timestamp);
    }
  }

  /**
   * 生成「历史详情」Tab 内容 HTML：按时间线展示历次提交的需求详情，每项为可折叠卡片，展开显示原始需求文本。
   * @param {Object} item - 当前问题项，可含 requirementDetailHistory（Array<{timestamp, content, title?}>）；若无则用 requirementDetail + createdAt 生成一条。
   * @param {function(string): string} escapeHtml - 转义 HTML 的函数。
   * @returns {string} 历史时间线 HTML。
   */
  function buildPreliminaryHistoryHtml(item, escapeHtml) {
    const esc = escapeHtml || ((s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
    const preliminary = buildResolvedPreliminaryRequirement(item);
    const history = Array.isArray(preliminary.requirementDetailHistory) && preliminary.requirementDetailHistory.length > 0
      ? preliminary.requirementDetailHistory
      : [{ timestamp: item?.createdAt || new Date().toISOString(), content: preliminary.requirementDetail ?? '' }];
    if (history.length === 0) return '<p class="preliminary-history-empty">暂无历史提交</p>';
    return history
      .map((entry, index) => {
        const ts = entry.timestamp || '';
        const content = (entry.content != null ? String(entry.content).trim() : '') || '—';
        const timeLabel = formatPreliminaryHistoryTime(ts);
        const bodyContent = renderRequirementWorkspaceFieldValueHtml(esc(content));
        const id = `prelim-history-${index}`;
        const serial = index + 1;
        const code = formatRequirementDetailHistoryCode(serial);
        const titleLine = getRequirementDetailHistoryDisplayTitle(entry, content);
        const ariaLabel = `${code}，${titleLine}，${timeLabel}`;
        return `<div class="preliminary-history-item" data-index="${index}" data-serial="${serial}" data-code="${esc(code)}">
          <div class="preliminary-history-item-header">
            <div class="preliminary-history-item-header-main" role="button" tabindex="0" aria-expanded="false" aria-controls="${id}" data-index="${index}" aria-label="${esc(ariaLabel)}">
              <span class="preliminary-history-item-code" title="需求编号">${esc(code)}</span>
              <span class="preliminary-history-item-title" title="${esc(titleLine)}">${esc(titleLine)}</span>
              <span class="preliminary-history-item-time">${esc(timeLabel)}</span>
            </div>
            <button type="button" class="preliminary-history-item-delete-btn" data-prelim-history-delete="1" data-index="${index}" title="删除该条" aria-label="删除该条历史需求">删除</button>
            <span class="preliminary-history-item-arrow" aria-hidden="true">▾</span>
          </div>
          <div class="preliminary-history-item-body" id="${id}" hidden>${bodyContent}</div>
        </div>`;
      })
      .join('');
  }

  global.getByPath = getByPath;
  global.PARSE_PREVIEW_FIELDS = PARSE_PREVIEW_FIELDS;
  global.getPreliminaryCardLabels = getPreliminaryCardLabels;
  global.PRELIMINARY_LABEL_TO_KEY = PRELIMINARY_LABEL_TO_KEY;
  global.parseDigitalProblemInput = parseDigitalProblemInput;
  global.parsePreliminaryRequirementDepthV2 = parsePreliminaryRequirementDepthV2;
  global.parsePreliminaryRequirementSupplementSliceV2 = parsePreliminaryRequirementSupplementSliceV2;
  global.renderParsePreview = renderParsePreview;
  global.buildResolvedPreliminaryRequirement = buildResolvedPreliminaryRequirement;
  global.buildPreliminaryWorkspaceSectionTabsHtml = buildPreliminaryWorkspaceSectionTabsHtml;
  global.buildPreliminaryCardRowsHtml = buildPreliminaryCardRowsHtml;
  global.buildPreliminaryHistoryHtml = buildPreliminaryHistoryHtml;
  global.formatRequirementDetailHistoryCode = formatRequirementDetailHistoryCode;
  global.extractRequirementDetailHistoryTitle = extractRequirementDetailHistoryTitle;
  global.buildRequirementDetailHistoryEntry = buildRequirementDetailHistoryEntry;
  global.buildPreliminarySummaryJson = buildPreliminarySummaryJson;
  global.buildPreliminaryStructuredJsonString = buildPreliminaryStructuredJsonString;
  global.buildPreliminaryPreContent = buildPreliminaryPreContent;
  global.isPreliminaryRequirementV2Shape = isPreliminaryRequirementV2Shape;
  global.extractPreliminaryReqV2FromChatMessages = extractPreliminaryReqV2FromChatMessages;
  global.refinePreliminaryRequirementV2WithFeedback = refinePreliminaryRequirementV2WithFeedback;
  global.mergePreliminaryRequirementV2ByLlm = mergePreliminaryRequirementV2ByLlm;
  global.mergePreliminaryStmRowIntoMatrixByLlm = mergePreliminaryStmRowIntoMatrixByLlm;
  global.mergePreliminaryStmEntityBucketByLlm = mergePreliminaryStmEntityBucketByLlm;
  global.groupPreliminaryStmMatrixRowsByEntityLabel = groupPreliminaryStmMatrixRowsByEntityLabel;
  global.getPrelimStmRowEntityDisplayLabel = getPrelimStmRowEntityDisplayLabel;
  global.buildPreliminaryStmEntityMergeLlmInputFullText = buildPreliminaryStmEntityMergeLlmInputFullText;
  global.buildPreliminaryMergeV2UserJsonPair = buildPreliminaryMergeV2UserJsonPair;
  global.buildPreliminaryMergeV2LlmInputFullText = buildPreliminaryMergeV2LlmInputFullText;
  global.buildPreliminaryStmRowMergeLlmInputFullText = buildPreliminaryStmRowMergeLlmInputFullText;
  global.mergePreliminaryV2TopLevel = mergePreliminaryV2TopLevel;
  global.consolidateOrgAndRolesStakeholdersArray = consolidateOrgAndRolesStakeholdersArray;
  global.renderMarkdownBold = renderMarkdownBold;
  global.renderRequirementWorkspaceFieldValueHtml = renderRequirementWorkspaceFieldValueHtml;
  global.buildCaseRequirementHeadlineParts = buildCaseRequirementHeadlineParts;
})(typeof window !== 'undefined' ? window : this);
