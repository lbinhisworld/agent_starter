/**
 * 全局常量与任务配置
 */
(function (global) {
  const API_URL = 'https://app-6aa0d22a.base44.app/api/apps/6969e6b3cbb5e6b66aa0d22a/functions/getCompanyAnalysis';
  const VALUE_STREAM_API_URL = 'https://app-6aa0d22a.base44.app/api/apps/6969e6b3cbb5e6b66aa0d22a/functions/getCompanyValueStreams';

  const STORAGE_KEY = 'company_analyses';
  const DIGITAL_PROBLEMS_STORAGE_KEY = 'digital_problem_followups';
  const PROBLEM_DETAIL_CHATS_STORAGE_KEY = 'problem_detail_chats';
  const TASK_TRACKING_STORAGE_KEY = 'digital_problem_task_tracking';
  const ROUTE_STORAGE_KEY = 'app_route_state';
  const OPERATION_HISTORY_STORAGE_KEY = 'digital_problem_operation_history';
  const ITGAP_HISTORY_TASKS = [
    { id: 'task7', name: '端到端事务流构建', stage: 'ITGap分析', objective: '基于价值流图数据提取并整理端到端事务流所需的结构化 JSON，为后续 ITGap 分析提供统一流程底座。', evaluationCriteria: '成功生成端到端事务流 JSON；用户在聊天区确认后视为完成。' },
    { id: 'task8', name: 'IT设计补齐', stage: 'ITGap分析', objective: '基于端到端事务流与业务场景，形成覆盖全链路的全局 ITGap 分析结论（数据、功能、体验/效率等维度）。', evaluationCriteria: '输出结构化的全局 ITGap 分析 JSON，并在工作区可查看（结构化/JSON 视图）；确认后视为完成。' },
    { id: 'task9', name: '对象状态机构建', stage: 'ITGap分析', objective: '在 IT设计补齐 与端到端事务流基础上，构建业务对象及其状态、生命周期与跨环节一致性约束，为后续架构与专项设计提供对象层输入。', evaluationCriteria: '任务启动经用户确认；工作区与自动化编排将随版本迭代补充；完工以聊天区确认及案例 itGapCompletedStages 含 2 为准。' },
  ];

  const IT_STRATEGY_TASKS = [
    { id: 'task12', name: '全局架构设计', stage: 'IT策略规划', objective: '构建以企业微信为交互入口、低代码平台为逻辑引擎、现有 IT 系统为数据底座的整体技术交互蓝图。', evaluationCriteria: '1）耦合度：各系统间的数据接口（API/Webhook）是否定义清晰、标准化且具备高扩展性？2）入口统一性：用户是否能在企业微信单一工作台内完成全链路的核心业务操作，减少系统切换。' },
    { id: 'task13', name: '环节专项设计', stage: 'IT策略规划', objective: '针对 VSM 中每个具体的 IT Gap，设计「消息驱动 + 表单操作」的功能微闭环，解决具体的业务痛点。', evaluationCriteria: '1）精准性：企微机器人推送的消息是否包含了用户进行决策所需的关键上下文信息？2）操作体验：用户从接收企微通知到进入低代码表单完成操作的交互层级是否在 3 层以内？' },
    { id: 'task14', name: '链条串联与闭环', stage: 'IT策略规划', objective: '模拟端到端的业务全路径，确保跨节点、跨角色间的信息传递无断点、无冗余。', evaluationCriteria: '1）协同性：上一环节的「输出」是否能自动且即时地转化为下一环节的「驱动」（如自动触发下游负责人的企微提醒）？2）异常覆盖：流程分支（如审批驳回、任务超时、信息变更）是否都有对应的数字化逻辑闭环。' },
    { id: 'task15', name: '价值回溯与自检', stage: 'IT策略规划', objective: '将最终生成的解决方案对标原始 IT Gap 清单，验证方案的有效性并评估预期的业务收益。', evaluationCriteria: '1）对冲率：原始 IT Gap 清单中记录的所有痛点，是否在最终方案中实现了 100% 的功能覆盖？2）价值量化：是否能基于现状（As-Is）与方案（To-Be）的对比，给出明确的效率提升或质量改善指标。' },
  ];

  const TASK_EXTRA_FIELDS = {
    task1: { input: '客户输入的企业信息', action: '提炼并结构化企业基本信息', outputFeedback: '包含核心字段的 JSON，用户确认' },
    task2: { input: '企业基本信息', action: '运用 BMC 框架生成商业分析', outputFeedback: 'BMC JSON，用户确认' },
    task3: { input: '基本信息 + BMC + 初步需求', action: '产出需求逻辑链条分析', outputFeedback: '需求逻辑 Markdown，用户确认' },
    task4: { input: 'enterprise_info + bmc_data + requirement_logic', action: '生成价值流 JSON 并绘制', outputFeedback: '价值流 JSON + 用户点击「开始绘制」' },
    task5: { input: '价值流图 + 需求逻辑', action: '在各环节标注 IT 支撑方式', outputFeedback: '各环节 itStatus，用户确认' },
    task6: { input: '价值流图 + 需求逻辑', action: '在各环节提炼痛点', outputFeedback: '各环节 painPoint，用户确认' },
    task7: { input: '已绘制价值流图', action: '提取端到端事务流 JSON', outputFeedback: '端到端事务流 JSON，用户确认' },
    task8: { input: '企业上下文 + BMC + 全流程', action: '从多维度产出 IT设计补齐（全局 ITGap）结论', outputFeedback: '结构化 JSON 卡片，用户确认' },
    task9: { input: '全局 ITGap + 端到端事务流', action: '对象状态机构建（编排迭代中）', outputFeedback: '对象状态与约束，用户确认后推进' },
    task12: { input: 'IT设计补齐', action: '设计 IT 架构与系统边界', outputFeedback: '架构图/文档，用户确认' },
    task13: { input: '对象状态机构建', action: '针对各环节设计专项方案', outputFeedback: '功能/接口需求，用户确认' },
    task14: { input: '环节方案', action: '串联端到端，形成闭环', outputFeedback: '实施路径与优先级，用户确认' },
    task15: { input: 'IT Gap 清单 + 方案', action: '对标验证并评估收益', outputFeedback: '对冲率与价值量化，用户确认' },
  };

  const FOLLOW_TASKS = [
    { id: 'task1', name: '企业背景洞察', stage: '需求理解', objective: '基于客户输入的企业信息，提炼并结构化企业基本信息，为后续 BMC 与需求逻辑分析提供基础。', evaluationCriteria: '成功提取并确认包含公司名称、信用代码、法人、成立日期、注册资本、经营范围等核心字段的结构化 JSON。' },
    { id: 'task2', name: '商业画布加载', stage: '需求理解', objective: '基于企业基本信息，运用商业模式画布（BMC）框架生成结构化商业分析，识别客户细分、价值主张、渠道通路等九大模块。', evaluationCriteria: '生成完整的 BMC JSON，包含行业背景洞察、九大画布模块及业务痛点预判，用户确认后视为完成。' },
    { id: 'task3', name: '需求逻辑构建', stage: '需求理解', objective: '基于客户初步需求、企业基本信息、BMC 三个维度，产出需求背后的逻辑链条分析，明确行业特性、商业模式局限与业务痛点的因果关联。', evaluationCriteria: '输出结构化的需求逻辑 Markdown，包含行业底层逻辑、因果关联、深层动机及逻辑链条总结，用户确认后视为完成。' },
    { id: 'task4', name: '绘制价值流', stage: '工作流对齐', objective: '基于 enterprise_info、bmc_data、requirement_logic 生成业务核心价值流图，划分阶段与环节，标注执行角色与预估耗时。', evaluationCriteria: '生成符合前端绘图要求的价值流 JSON，用户确认并完成「开始绘制价值流图」后视为完成。' },
    { id: 'task5', name: 'IT 现状标注', stage: '工作流对齐', objective: '结合需求逻辑，在价值流图每个环节节点标注该环节的 IT 支撑方式（手工/系统），区分纸质、excel 或具体系统名称。', evaluationCriteria: '每个环节均标注 itStatus，用户确认后视为完成。' },
    { id: 'task6', name: '痛点标注', stage: '工作流对齐', objective: '结合需求逻辑，在价值流图每个环节节点提炼该环节涉及到的痛点，为后续 IT Gap 分析提供输入。', evaluationCriteria: '每个环节均标注 painPoint（无明显痛点的环节不展示卡片），用户确认后视为完成。' },
  ];

  const BASIC_INFO_FIELDS = [
    { key: 'company_name', label: '企业名称' },
    { key: 'credit_code', label: '统一社会信用代码' },
    { key: 'legal_representative', label: '法定代表人' },
    { key: 'established_date', label: '成立日期' },
    { key: 'registered_capital', label: '注册资本' },
    { key: 'is_listed', label: '是否上市' },
    { key: 'listing_location', label: '上市地点' },
    { key: 'business_scope', label: '经营范围' },
    { key: 'core_qualifications', label: '核心资质' },
    { key: 'official_website', label: '官网' },
  ];

  const BMC_FIELDS = [
    { key: 'customer_segments', label: '客户细分' },
    { key: 'value_propositions', label: '价值主张' },
    { key: 'channels', label: '渠道通路' },
    { key: 'customer_relationships', label: '客户关系' },
    { key: 'revenue_streams', label: '收入来源' },
    { key: 'key_resources', label: '核心资源' },
    { key: 'key_activities', label: '关键业务' },
    { key: 'key_partnerships', label: '重要合作' },
    { key: 'cost_structure', label: '成本结构' },
  ];

  const LABEL_TO_PATH = (function () {
    const m = new Map();
    BASIC_INFO_FIELDS.forEach((f) => m.set(f.label, { section: 'basicInfo', key: f.key }));
    BMC_FIELDS.forEach((f) => m.set(f.label, { section: 'bmc', key: f.key }));
    m.set('综合评述', { section: 'bmc', key: 'comprehensive_review' });
    return m;
  })();

  const DELETE_CHAT_MSG_ICON = '<svg class="icon-trash" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';

  global.API_URL = API_URL;
  global.VALUE_STREAM_API_URL = VALUE_STREAM_API_URL;
  global.STORAGE_KEY = STORAGE_KEY;
  global.DIGITAL_PROBLEMS_STORAGE_KEY = DIGITAL_PROBLEMS_STORAGE_KEY;
  global.PROBLEM_DETAIL_CHATS_STORAGE_KEY = PROBLEM_DETAIL_CHATS_STORAGE_KEY;
  global.TASK_TRACKING_STORAGE_KEY = TASK_TRACKING_STORAGE_KEY;
  global.ROUTE_STORAGE_KEY = ROUTE_STORAGE_KEY;
  global.OPERATION_HISTORY_STORAGE_KEY = OPERATION_HISTORY_STORAGE_KEY;
  global.ITGAP_HISTORY_TASKS = ITGAP_HISTORY_TASKS;
  global.IT_STRATEGY_TASKS = IT_STRATEGY_TASKS;
  global.TASK_EXTRA_FIELDS = TASK_EXTRA_FIELDS;
  global.FOLLOW_TASKS = FOLLOW_TASKS;
  global.BASIC_INFO_FIELDS = BASIC_INFO_FIELDS;
  global.BMC_FIELDS = BMC_FIELDS;
  global.LABEL_TO_PATH = LABEL_TO_PATH;
  global.DELETE_CHAT_MSG_ICON = DELETE_CHAT_MSG_ICON;
})(typeof window !== 'undefined' ? window : this);
