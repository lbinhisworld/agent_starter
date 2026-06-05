/**
 * 核心业务对象推演：session 生成、单环节 LLM 调用、解析、渲染及任务确认交互逻辑
 * 任务目标：定义流程中流转的数字化实体（如订单、合同、任务单），为低代码数据库建模提供底层逻辑结构。
 * 依赖：global.parseValueStreamGraph (valueStream.js)、global.fetchDeepSeekChat (api.js)、
 *       global.escapeHtml、global.renderMarkdown (utils.js)、global.parseRolePermissionModel (rolePermission.js)
 *
 * 单环节严格调用 generateCoreBusinessObjectForStepWithStrictPrompt 在 API 返回对象上附带 llmInputPrompt（【系统】/【用户】），供过程日志 LLM-查询 双子卡片与 task9 一致。
 * FE-20260322-07：task11 请求透传 taskTag/maxOutputTokens；上下文按环节切片 + 紧凑 JSON；响应透传 finishReason/truncated/maxOutputTokens。
 * FE-20260324-09：generateCoreBusinessObjectForStepWithStrictPrompt 支持可选 system 覆盖；executeCoreBusinessObjectTaskOnConfirm 支持 skipContextBlocks（修改链路二次确认后仅推 session 计划块）。
 * FE-20260324-19：`buildCoreBusinessObjectViewSectionsHtml` 导出至 `window` 供售前报告页 `report-formal-render.js` 薄复用。
 * FE-20260324-29：[OUTPUT] `generateCoreBusinessObjectGlobalSkeletonAuditWithStrictPrompt` — 多环节 `coreBusinessObjectJson` 列表的全局血缘审计（独立 system/user 调用，`llmInputPrompt` 供过程日志 LLM-审计 双子卡）。
 * FE-20260324-31：全局审计调用 `fetchDeepSeekChat` 传 `timeoutMs: 300000`（5 分钟上限），避免 online/上游无超时导致界面永久转圈。
 * FE-20260328-04：全局审计返回 JSON 中的 `一致性缺陷清单` 由 `main.js` 的 `parseCoreBusinessObjectGlobalAuditDefectItems` 解析，并写入聊天区 `coreBusinessObjectGlobalAuditResultBlock` 供多选缺陷后进入修改提示词流程（与 task10 审计意见卡对齐）。
 * FE-20260403-23：`globalThis.__FE_SUPPRESS_CBO_PROBLEM_DETAIL_CHAT_UI === true` 时 `executeCoreBusinessObjectTaskOnConfirm` 不向聊天推送上下文块与 session 计划块（仅更新 `coreBusinessObjectSessions` 存储）。
 * FE-20260328-13：`buildCoreBusinessObjectSessionsBlockHtml` 页脚时间经 `formatChatTime` 与详情聊天区一致。
 * FE-20260403：`buildCoreBusinessObjectContextJson` 优先使用 `roleTaskCenterPortalDesignJson` 作为 task9（对象状态机构建）上下文；无门户数据时回退旧版 `localItGapSessions`/压缩块路径。
 */
(function(global) {
  const parseValueStreamGraph = global.parseValueStreamGraph;
  const fetchDeepSeekChat = global.fetchDeepSeekChat;
  const escapeHtml = global.escapeHtml;
  const renderMarkdown = global.renderMarkdown;
  const parseRolePermissionModel = global.parseRolePermissionModel;

  const CORE_BUSINESS_OBJECT_LOG = false;
  const CORE_BUSINESS_OBJECT_TASK_ID = 'task11';
  const CORE_BUSINESS_OBJECT_NEED_VALUE_STREAM_MSG = '核心业务对象推演需要完整的价值流图，请先在工作流对齐阶段完成价值流图绘制。';

  /** 根据价值流生成核心业务对象推演 session（不调用大模型），用于逐步按环节分析 */
  function generateCoreBusinessObjectSessions(valueStream) {
    const { stages } = parseValueStreamGraph(valueStream || {});
    let stepIndex = 0;
    const sessions = [];
    for (const stage of stages) {
      const stageName = stage?.name || '';
      for (const step of stage.steps || []) {
        const stepName = step?.name || `环节${stepIndex + 1}`;
        sessions.push({ stepName, stepIndex, stageName, coreBusinessObjectJson: null });
        stepIndex += 1;
      }
    }
    return sessions;
  }

  /**
   * 从完整价值流中截取「当前环节」对应的一阶段一步，避免整图 pretty JSON 灌入 prompt。
   */
  function extractValueStreamSliceForStep(valueStream, stepIndex) {
    if (!valueStream || valueStream.raw) return null;
    const { stages } = parseValueStreamGraph(valueStream);
    let idx = 0;
    for (const stage of stages) {
      for (const step of stage.steps || []) {
        if (idx === stepIndex) {
          return { stages: [{ name: stage.name, steps: [step] }] };
        }
        idx += 1;
      }
    }
    return { stages: [] };
  }

  /**
   * 全局 ITGap 对象中尽量只保留与当前环节名/阶段名相关的条目（无法识别结构时退回原对象，仅做紧凑序列化）。
   */
  function pickGlobalItGapSliceForStep(globalItGap, stepName, stageName) {
    if (globalItGap == null) return null;
    if (typeof globalItGap === 'string') return globalItGap;
    if (typeof globalItGap !== 'object') return globalItGap;
    const sn = String(stepName || '').trim();
    const stn = String(stageName || '').trim();
    const g = globalItGap;
    const tryFilter = (arrKey) => {
      const arr = g[arrKey];
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const filtered = arr.filter((item) => {
        const blob = JSON.stringify(item);
        return (sn && blob.includes(sn)) || (stn && blob.includes(stn));
      });
      return filtered.length > 0 && filtered.length < arr.length ? { ...g, [arrKey]: filtered } : null;
    };
    return tryFilter('gaps') || tryFilter('gap_analysis') || tryFilter('architecture_gaps') || globalItGap;
  }

  function parseMaybeJson(raw) {
    if (raw == null) return null;
    if (typeof raw === 'object') return raw;
    const text = String(raw).trim().replace(/^\uFEFF/, '');
    if (!text || text === 'null' || text === 'undefined' || text === '""') return null;
    try {
      return JSON.parse(text);
    } catch (_) {
      return text;
    }
  }

  /**
   * 构建单步 LLM 输入：四类上下文均为紧凑 JSON；价值流仅当前步；task9（对象状态机构建）/ 历史局部 ITGap 与角色权限仅当前步；全局 ITGap 尽量按环节关键词收缩。
   * @returns {{ valueStreamJson: string, globalItGapJson: string, localItGapJson: string, rolePermissionJson: string } | null}
   */
  function buildCoreBusinessObjectStepPayloadStrings(ctx, stepIndex, session) {
    if (!ctx) return null;
    const stepName = session?.stepName || '';
    const stageName = session?.stageName || '';
    const vsSlice = extractValueStreamSliceForStep(ctx.valueStream, stepIndex);
    const valueStreamJson = JSON.stringify(vsSlice != null ? vsSlice : {});
    const globalPicked = pickGlobalItGapSliceForStep(ctx.globalItGap, stepName, stageName);
    const globalItGapJson = globalPicked != null ? JSON.stringify(globalPicked) : '{}';
    const localArr = Array.isArray(ctx.localItGapByStep) ? ctx.localItGapByStep : [];
    const localOne = localArr.find((x) => x.stepIndex === stepIndex) || localArr[stepIndex];
    const localItGapJson = localOne && localOne.analysis != null ? JSON.stringify(localOne.analysis) : '{}';
    const rpArr = Array.isArray(ctx.rolePermissionByStep) ? ctx.rolePermissionByStep : [];
    const rpOne =
      rpArr.find(
        (x) =>
          x &&
          (x.stepIndex === stepIndex ||
            Number(x.step_id) === stepIndex ||
            Number(x.step_id) === stepIndex + 1 ||
            String(x.step_name || '') === String(stepName)),
      ) || rpArr[stepIndex];
    const rolePermissionJson = JSON.stringify(rpOne != null ? [rpOne] : []);
    return { valueStreamJson, globalItGapJson, localItGapJson, rolePermissionJson };
  }

  /** 使用严格提示词（V3.3 架构闭环与冷启动版）针对单环节调用大模型，返回该环节的 JSON；可选 systemPromptOverride 整段替换默认 system */
  async function generateCoreBusinessObjectForStepWithStrictPrompt(
    stepName,
    stageName,
    stepIndex,
    valueStreamJson,
    globalItGapJson,
    localItGapJson,
    rolePermissionJson,
    systemPromptOverride,
  ) {
    const defaultSystemPrompt = `环节核心对象骨架推演 (V3.3 架构闭环与冷启动版)
角色设定 (Role): 你是一位精通“如无必要，勿增实体”原则的首席系统架构师。你擅长识别业务流中的核心资产，并能精准判断一个数据集合应该是独立对象、存量对象的属性更新，还是主实体的内部子表。

1. 全局输入 (Global Context)
* 数据包含：全局 IT Gap 压缩 JSON、端到端事务流压缩 JSON、角色清单 JSON
* 核心准则:
  * Primary_ID: Project_ID (必须贯穿所有核心对象)
  * 全局枚举: 必须引用已定义的 Status, Category, Role 规范。

2. 本环节增量输入 (Local Increment)
* 当前环节名称
* 局部 IT Gap & 角色推演

3. 建模、瘦身与冷启动指令 (Modeling Logic)
请按以下优先级判定本环节的数据归宿，严禁漏掉基础实体，严禁盲目增加碎片对象：
1) 冷启动与基础实体初始化 (Initialization Check):
  * 核心判定：若本环节产生的主产出（如：商机、订单）必须依附于某个主体（如：客户、供应商、员工）才能存在，且该主体在之前的推演中尚未定义，则本环节必须同时产出该基础实体对象。
  * 逻辑理由：基础实体是业务的“物理底座”，必须在价值流入口处完成初始化。
2) 资产独立性判定 (0-3个对象):
  * 主产出 (Main Output): 仅当产生生命周期独立（能脱离父表独立存在/审批）的新实体时创建。
  * 内部子表/模块 (Sub-Module): 若数据与主实体是 1:N 关系且生命周期绑定，请将其定义为“主产出的嵌套子表”，严禁拆分为独立对象。
3) 存量承接判定 (Object Hosting):
  * 若本环节不产生新实体，仅是操作或审批，请明确指出承接该动作的存量对象（必须是之前环节已定义的对象）。
4) 状态驱动 (State Machine):
  * 明确本环节驱动了哪个对象发生了怎样的状态跃迁（例如：商机由“挖掘中”变更为“评估完成”）。

4. 输出格式 (Strict JSON Only)
请直接输出 JSON，不要包含任何 Markdown 代码块或解释文本：
{
  "当前环节": "环节名称",
  "架构审计结论": "说明本环节对象分布逻辑。特别说明是否涉及‘基础实体初始化’。若产出为 0，请解释该环节增量如何被存量对象‘消化’。",
  "核心骨架清单": [
    {
      "对象中文名": "名称（如：客户、商机）",
      "对象ID": "Entity_EN_ID",
      "对象类型": "基础产出 / 业务主产出 / 过程记录",
      "独立存在理由": "解释该实体为何不能作为属性或子表（特别是基础实体初始化的必要性）",
      "溯源锚点": "Project_ID (或与其关联的逻辑说明)",
      "嵌套子表模块": [
        {
          "模块名": "子模块名称",
          "逻辑理由": "解释为何是子表而非独立对象（如：1:N 强绑定）"
        }
      ],
      "角色权责": "谁创、谁看、谁改、谁审",
      "本环节终态": "状态枚举值"
    }
  ],
  "存量对象承接": [
    {
      "承接对象名": "引用上游环节已定义的某个对象名",
      "执行动作": "例如：指派、审核、填充备注",
      "本环节增量字段预测": ["建议在该存量对象中增加的字段（如：审批意见）"],
      "状态变迁": "旧状态 -> 新状态"
    }
  ]
}`;
    const systemPrompt =
      systemPromptOverride != null && String(systemPromptOverride).trim() !== ''
        ? String(systemPromptOverride).trim()
        : defaultSystemPrompt;

    const userParts = [
      '【沟通历史上下文：价值流设计 json】',
      valueStreamJson || '{}',
      '【沟通历史上下文：全局 IT Gap 分析压缩版 json】',
      globalItGapJson || '{}',
      '【沟通历史上下文：当前环节对象状态机构建（历史局部 ITGap）压缩 json】',
      localItGapJson || '[]',
      '【沟通历史上下文：角色清单 json（当前环节角色与权限推演）】',
      rolePermissionJson || '[]',
      '',
      `当前环节：阶段「${stageName}」，环节「${stepName}」（stepIndex: ${stepIndex}）。请严格按系统要求只输出一个 JSON 对象，字段名保持一致，不要输出 markdown 代码块或说明文字。`,
    ];
    const userPrompt = userParts.join('\n\n');
    const llmInputPrompt = `【系统】\n${systemPrompt}\n\n【用户】\n${userPrompt}`;
    const result = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { taskTag: 'task11', maxOutputTokens: 8192 },
    );
    return { ...result, llmInputPrompt };
  }

  /** 针对单个环节调用大模型进行核心业务对象推演 */
  async function generateCoreBusinessObjectForStep(stepName, stageName, valueStream, globalItGap, localItGap, projectName) {
    const vsmJson = JSON.stringify(valueStream, null, 2);
    const globalItGapJson = globalItGap != null ? JSON.stringify(globalItGap, null, 2) : '';
    const localItGapJson = Array.isArray(localItGap) && localItGap.length > 0 ? JSON.stringify(localItGap, null, 2) : '';
    const systemPrompt = `Role & Context:
我是一名软件公司的需求分析专家。请针对价值流中的**单一环节**进行核心业务对象（数字化实体）推演，为低代码数据库建模提供底层逻辑结构。

Task Goal:
针对环节「${stepName}」所在的阶段「${stageName}」，输出该环节涉及或产生的核心业务对象（单个 JSON 对象）。

Requirement:
1）颗粒度：对象字段足以支撑 IT Gap 分析中的业务数据记录与统计需求。
2）状态定义：为每个业务对象建立清晰的生命周期状态机（如：待处理、执行中、已完成）。

Output Format: 直接输出一个 JSON 对象，不要数组，不要 markdown 代码块。结构必须包含：
{
  "stage_name": "阶段名称",
  "step_id": "环节序号",
  "step_name": "环节名称",
  "it_gap_reference": "关联的 IT 现状与数据需求简述",
  "entities": [
    {
      "entity_name": "对象名称（如订单、合同、任务单）",
      "description": "对象说明",
      "fields": [{"field_name":"","type":"string|number|date|ref","description":""}],
      "state_machine": [{"state":"状态名","description":"","transitions":["下一状态"]}],
      "relations": [{"target_entity":"关联对象","relation_type":"1:1|1:n|n:1"}]
    }
  ]
}`;
    const userParts = [
      `项目：${projectName}。针对环节「${stepName}」进行核心业务对象推演。`,
      '【端到端事务流】', vsmJson,
    ];
    if (globalItGapJson) userParts.push('【IT设计补齐】', globalItGapJson);
    if (localItGapJson) userParts.push('【对象状态机构建】', localItGapJson);
    userParts.push('\n请直接输出该环节的 JSON 对象，不要 markdown 代码块或说明文字。');
    const userPrompt = userParts.join('\n\n');
    return fetchDeepSeekChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }

  function parseCoreBusinessObjectModel(markdown) {
    if (!markdown || typeof markdown !== 'string') return [];
    let raw = markdown.trim().replace(/^\uFEFF/, '');
    if (CORE_BUSINESS_OBJECT_LOG) console.log('[核心业务对象] parseCoreBusinessObjectModel: 输入长度=', raw.length);
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e1) {
      const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlock) {
        try {
          parsed = JSON.parse(codeBlock[1].trim());
        } catch (_2) {}
      }
      if (parsed == null) {
        const start = raw.indexOf('{');
        if (start >= 0) {
          let depth = 0;
          let end = -1;
          let i = start;
          while (i < raw.length) {
            const c = raw[i];
            if (c === '"') {
              i += 1;
              while (i < raw.length) {
                if (raw[i] === '\\') i += 2;
                else if (raw[i] === '"') { i += 1; break; }
                else i += 1;
              }
              continue;
            }
            if (c === '{') { depth += 1; i += 1; continue; }
            if (c === '}') {
              depth -= 1;
              if (depth === 0) { end = i; break; }
              i += 1;
              continue;
            }
            i += 1;
          }
          if (end > start) {
            try {
              parsed = JSON.parse(raw.slice(start, end + 1));
            } catch (_3) {}
          }
        }
      }
    }
    if (parsed && typeof parsed === 'object') {
      const hasEntities = Array.isArray(parsed.entities) && parsed.entities.length > 0;
      const hasStep = parsed.step_name != null || parsed.step_id != null || parsed.stage_name != null;
      if (hasEntities && hasStep) {
        if (CORE_BUSINESS_OBJECT_LOG) console.log('[核心业务对象] parseCoreBusinessObjectModel: 解析成功(单环节), entities=', parsed.entities.length);
        return [parsed];
      }
      if (hasEntities) {
        if (CORE_BUSINESS_OBJECT_LOG) console.log('[核心业务对象] parseCoreBusinessObjectModel: 解析成功(全局 entities), 条数=', parsed.entities.length);
        return [{ stage_name: '全局', step_name: '全局', entities: parsed.entities }];
      }
      // 严格提示词格式：单对象（session 存的是数组首元素），含 business_objects、local_gap_resolved
      if (!Array.isArray(parsed) && parsed != null && typeof parsed === 'object' && Array.isArray(parsed.business_objects)) {
        const entities = parsed.business_objects.map((bo) => {
          const fields = Array.isArray(bo.key_attributes)
            ? bo.key_attributes.map((a) => ({
                field_name: a.field ?? a.field_name,
                type: a.type ?? a.data_type ?? 'string',
                description: a.purpose ?? a.description ?? '',
              }))
            : [];
          const stateMachine = Array.isArray(bo.lifecycle_machine)
            ? bo.lifecycle_machine.map((lm) => ({
                state: lm.state_to ?? lm.state_from ?? lm.state ?? '—',
                description: [lm.trigger_role, lm.action].filter(Boolean).join(' '),
                transitions: lm.state_to ? [lm.state_to] : [],
              }))
            : [];
          const relations = Array.isArray(bo.associations)
            ? bo.associations.map((a) => ({
                target_entity: a.target_object ?? a.target_entity,
                relation_type: a.relation_type ?? '—',
              }))
            : [];
          return {
            entity_name: bo.object_name ?? bo.entity_name,
            description: bo.object_role ?? bo.global_integration_note ?? '',
            object_role: bo.object_role ?? '',
            object_usage: bo.object_usage ?? '',
            category: bo.category ?? '',
            is_global_shared: bo.is_global_shared,
            fields,
            state_machine: stateMachine,
            relations,
          };
        });
        const normalized = { ...parsed, entities };
        if (CORE_BUSINESS_OBJECT_LOG) console.log('[核心业务对象] parseCoreBusinessObjectModel: 解析成功(严格格式单对象 business_objects), 条数=', entities.length);
        return [normalized];
      }
      // V3.0 骨架格式：单对象，含「核心骨架清单」
      if (!Array.isArray(parsed) && parsed != null && typeof parsed === 'object' && Array.isArray(parsed['核心骨架清单'])) {
        const entities = parsed['核心骨架清单'].map((bo) => ({
          entity_name: bo?.['对象中文名'] ?? bo?.object_name ?? bo?.entity_name,
          description: bo?.['独立存在理由'] ?? '',
          object_role: bo?.['对象类型'] ?? '',
          object_usage: `业务功能：${bo?.['对象中文名'] || '该对象'}。对冲Gap：${bo?.['设计理由']?.['对冲ITGap'] || '—'}。设计思路：${bo?.['设计理由']?.['设计思路'] || '—'}`,
          category: bo?.['对象类型'] ?? '',
          fields: Array.isArray(bo?.['嵌套子模块'] ?? bo?.['嵌套子表模块'])
            ? (bo['嵌套子模块'] ?? bo['嵌套子表模块']).map((m) => ({
                field_name: typeof m === 'object' && m != null ? String(m['模块名'] ?? '') : String(m || ''),
                type: 'array',
                description:
                  typeof m === 'object' && m != null
                    ? String(m['逻辑理由'] ?? '嵌套子模块')
                    : '嵌套子模块',
              }))
            : [],
          state_machine: bo?.['本环节终态'] ? [{ state: bo['本环节终态'], description: bo?.['角色权责'] || '', transitions: [] }] : [],
          relations: bo?.['关联关系']
            ? [{
                target_entity: bo['关联关系']?.['父级对象'] ?? '',
                relation_type: bo['关联关系']?.['映射关系'] ?? '—',
              }]
            : [],
        }));
        const normalized = { ...parsed, entities };
        if (CORE_BUSINESS_OBJECT_LOG) console.log('[核心业务对象] parseCoreBusinessObjectModel: 解析成功(V3 核心骨架清单), 条数=', entities.length);
        return [normalized];
      }
      if (Array.isArray(parsed)) {
        const first = parsed[0];
        if (first && typeof first === 'object' && Array.isArray(first.entities)) {
          if (CORE_BUSINESS_OBJECT_LOG) console.log('[核心业务对象] parseCoreBusinessObjectModel: 解析成功(环节数组), 条数=', parsed.length);
          return parsed;
        }
        // 严格提示词格式：单元素数组，含 business_objects、local_gap_resolved
        if (first && typeof first === 'object' && Array.isArray(first.business_objects)) {
          const entities = first.business_objects.map((bo) => {
            const fields = Array.isArray(bo.key_attributes)
              ? bo.key_attributes.map((a) => ({
                  field_name: a.field ?? a.field_name,
                  type: a.type ?? a.data_type ?? 'string',
                  description: a.purpose ?? a.description ?? '',
                }))
              : [];
            const stateMachine = Array.isArray(bo.lifecycle_machine)
              ? bo.lifecycle_machine.map((lm) => ({
                  state: lm.state_to ?? lm.state_from ?? lm.state ?? '—',
                  description: [lm.trigger_role, lm.action].filter(Boolean).join(' '),
                  transitions: lm.state_to ? [lm.state_to] : [],
                }))
              : [];
            const relations = Array.isArray(bo.associations)
              ? bo.associations.map((a) => ({
                  target_entity: a.target_object ?? a.target_entity,
                  relation_type: a.relation_type ?? '—',
                }))
              : [];
            return {
              entity_name: bo.object_name ?? bo.entity_name,
              description: bo.object_role ?? bo.global_integration_note ?? '',
              object_role: bo.object_role ?? '',
              object_usage: bo.object_usage ?? '',
              category: bo.category ?? '',
              is_global_shared: bo.is_global_shared,
              fields,
              state_machine: stateMachine,
              relations,
            };
          });
          const normalized = { ...first, entities };
          if (CORE_BUSINESS_OBJECT_LOG) console.log('[核心业务对象] parseCoreBusinessObjectModel: 解析成功(严格格式 business_objects), 条数=', entities.length);
          return [normalized];
        }
        if (first && typeof first === 'object' && Array.isArray(first['核心骨架清单'])) {
          const entities = first['核心骨架清单'].map((bo) => ({
            entity_name: bo?.['对象中文名'] ?? bo?.object_name ?? bo?.entity_name,
            description: bo?.['独立存在理由'] ?? '',
            object_role: bo?.['对象类型'] ?? '',
            object_usage: `业务功能：${bo?.['对象中文名'] || '该对象'}。对冲Gap：${bo?.['设计理由']?.['对冲ITGap'] || '—'}。设计思路：${bo?.['设计理由']?.['设计思路'] || '—'}`,
            category: bo?.['对象类型'] ?? '',
            fields: Array.isArray(bo?.['嵌套子模块'] ?? bo?.['嵌套子表模块'])
              ? (bo['嵌套子模块'] ?? bo['嵌套子表模块']).map((m) => ({
                  field_name: typeof m === 'object' && m != null ? String(m['模块名'] ?? '') : String(m || ''),
                  type: 'array',
                  description:
                    typeof m === 'object' && m != null
                      ? String(m['逻辑理由'] ?? '嵌套子模块')
                      : '嵌套子模块',
                }))
              : [],
            state_machine: bo?.['本环节终态'] ? [{ state: bo['本环节终态'], description: bo?.['角色权责'] || '', transitions: [] }] : [],
            relations: bo?.['关联关系']
              ? [{
                  target_entity: bo['关联关系']?.['父级对象'] ?? '',
                  relation_type: bo['关联关系']?.['映射关系'] ?? '—',
                }]
              : [],
          }));
          const normalized = { ...first, entities };
          if (CORE_BUSINESS_OBJECT_LOG) console.log('[核心业务对象] parseCoreBusinessObjectModel: 解析成功(V3 数组核心骨架清单), 条数=', entities.length);
          return [normalized];
        }
      }
    }
    return [];
  }

  /** 将字段值渲染为 HTML：字符串用 markdown，对象/数组用 JSON pre */
  function formatCoreBusinessObjectField(val) {
    if (val == null || (typeof val === 'string' && !val.trim())) return '<span class="problem-detail-core-business-object-empty">—</span>';
    if (typeof val === 'string') return `<div class="problem-detail-core-business-object-field-content markdown-body">${renderMarkdown(val.trim())}</div>`;
    if (typeof val === 'object') return `<pre class="problem-detail-core-business-object-field-pre">${escapeHtml(JSON.stringify(val, null, 2))}</pre>`;
    return escapeHtml(String(val));
  }

  /** 标题栏展示用：从实体对象解析显示名（object_name 与 entity_name 等与卡片内一致） */
  function getCoreBusinessEntityDisplayName(e) {
    if (!e || typeof e !== 'object') return '';
    const n = e.object_name ?? e.entity_name ?? e.entityName ?? e.name;
    return (n != null && String(n).trim()) ? String(n).trim() : '未命名';
  }

  /** 多个实体名称用全角竖线连接，用于「核心业务对象设计」与按类型分组标题栏 */
  function joinEntityDisplayNamesForHeader(entityList) {
    if (!Array.isArray(entityList) || entityList.length === 0) return '';
    return entityList.map(getCoreBusinessEntityDisplayName).join('｜');
  }

  /** 从 object_usage 字符串解析出 业务功能、对冲Gap、设计思路（格式：业务功能：...。对冲Gap：...。设计思路：...） */
  function parseObjectUsageTriple(objectUsage) {
    const raw = (objectUsage != null && typeof objectUsage === 'string') ? objectUsage.trim() : '';
    if (!raw) return { businessFunction: '', counteringGap: '', designRationale: '' };
    const m = raw.match(/业务功能[：:]\s*([^。]*)。?\s*对冲[Gg]ap[：:]\s*([^。]*)。?\s*设计思路[：:]\s*([\s\S]*)/);
    if (m) return { businessFunction: m[1].trim(), counteringGap: m[2].trim(), designRationale: (m[3] || '').trim() };
    return { businessFunction: raw, counteringGap: '', designRationale: '' };
  }

  function resolveCoreBusinessObjectField(obj, keys) {
    if (!obj || typeof obj !== 'object' || !Array.isArray(keys)) return null;
    for (const k of keys) {
      const v = obj[k];
      if (v != null && (!(typeof v === 'string') || v.trim() !== '')) return v;
    }
    return null;
  }

  function buildCoreBusinessObjectViewSectionsHtml(obj) {
    const objectUsage = resolveCoreBusinessObjectField(obj, ['object_usage']);
    const usageTriple = parseObjectUsageTriple(typeof objectUsage === 'string' ? objectUsage : '');
    const sectionDefs = [
      { title: '对象类型', value: resolveCoreBusinessObjectField(obj, ['对象类型', 'object_role', 'category']) },
      { title: '独立存在理由', value: resolveCoreBusinessObjectField(obj, ['独立存在理由', 'description']) },
      { title: '溯源锚点', value: resolveCoreBusinessObjectField(obj, ['溯源锚点']) },
      { title: '对冲 ITGap', value: resolveCoreBusinessObjectField(obj, ['设计理由'])?.['对冲ITGap'] ?? usageTriple.counteringGap },
      { title: '设计思路', value: resolveCoreBusinessObjectField(obj, ['设计理由'])?.['设计思路'] ?? usageTriple.designRationale },
      { title: '嵌套子模块', value: resolveCoreBusinessObjectField(obj, ['嵌套子模块', '嵌套子表模块']) },
      { title: '角色权责', value: resolveCoreBusinessObjectField(obj, ['角色权责']) },
      { title: '本环节终态', value: resolveCoreBusinessObjectField(obj, ['本环节终态']) },
    ];
    return sectionDefs
      .map((s) => `
        <div class="problem-detail-core-business-object-mini-view-item">
          <div class="problem-detail-core-business-object-mini-view-item-title">${escapeHtml(s.title)}</div>
          <div class="problem-detail-core-business-object-mini-view-item-body">${formatCoreBusinessObjectField(s.value == null ? '—' : s.value)}</div>
        </div>
      `)
      .join('');
  }

  /** 单个实体卡片 HTML；opts.titlePrefix 存在时标题显示为「titlePrefix + 对象名」；opts.roleTag 存在时在名称右侧显示类型标签（object_role） */
  function buildEntityCardHtml(entity, opts) {
    if (!entity || typeof entity !== 'object') return '';
    const name = entity.object_name ?? entity.entity_name ?? entity.entityName ?? entity.name ?? '未命名对象';
    const titlePrefix = opts && opts.titlePrefix != null ? String(opts.titlePrefix) : '';
    const titleText = titlePrefix ? titlePrefix + name : name;
    const roleTag = opts && opts.roleTag != null ? String(opts.roleTag).trim() : '';
    const fields = Array.isArray(entity.fields) ? entity.fields : [];
    const stateMachine = Array.isArray(entity.state_machine) ? entity.state_machine : (Array.isArray(entity.stateMachine) ? entity.stateMachine : []);
    const relations = Array.isArray(entity.relations) ? entity.relations : [];
    const objectUsage = (entity.object_usage != null && String(entity.object_usage).trim()) ? String(entity.object_usage).trim() : '';
    const usageTriple = parseObjectUsageTriple(objectUsage);
    const category = entity.category != null && String(entity.category).trim() ? String(entity.category).trim() : '';
    const isGlobalShared = entity.is_global_shared;

    const subcard = (title, body) =>
      `<div class="problem-detail-core-business-entity-subcard">
        <div class="problem-detail-role-card-section-title">${escapeHtml(title)}</div>
        <div class="problem-detail-core-business-entity-subcard-body">${body}</div>
      </div>`;

    const usageCell = (text) => (text ? formatCoreBusinessObjectField(text) : '<span class="problem-detail-core-business-object-empty">—</span>');
    const usageBody = objectUsage
      ? `<table class="problem-detail-core-business-object-table problem-detail-core-business-usage-table">
          <thead><tr><th>项目</th><th>内容</th></tr></thead>
          <tbody>
            <tr><td class="problem-detail-core-business-usage-table-label">业务功能</td><td>${usageCell(usageTriple.businessFunction)}</td></tr>
            <tr><td class="problem-detail-core-business-usage-table-label">对冲 Gap</td><td>${usageCell(usageTriple.counteringGap)}</td></tr>
            <tr><td class="problem-detail-core-business-usage-table-label">设计思路</td><td>${usageCell(usageTriple.designRationale)}</td></tr>
          </tbody>
        </table>`
      : '<span class="problem-detail-core-business-object-empty">—</span>';

    const isGlobalSharedTag = isGlobalShared === true || isGlobalShared === 'true' ? '全局引用数据' : (isGlobalShared === false || isGlobalShared === 'false' ? '非全局引用数据' : '');

    const fieldsBody = fields.length
      ? `<table class="problem-detail-core-business-object-table">
          <thead><tr><th>字段名</th><th>数据类型</th><th>设计意图</th></tr></thead>
          <tbody>${fields.map((f) => {
            const fn = f.field_name ?? f.fieldName ?? f.name ?? '—';
            const dataType = f.type ?? f.data_type ?? '—';
            const rawDesc = (f.description ?? '').trim();
            const fd = rawDesc ? rawDesc.replace(/^设计意图[：:]\s*/, '') : '';
            return `<tr><td>${escapeHtml(fn)}</td><td>${escapeHtml(dataType)}</td><td>${escapeHtml(fd || '—')}</td></tr>`;
          }).join('')}</tbody>
        </table>`
      : '<span class="problem-detail-core-business-object-empty">—</span>';
    const stateBody = stateMachine.length
      ? `<ul class="problem-detail-core-business-object-list">${stateMachine.map((s) => {
          const stateName = s.state ?? s.name ?? '—';
          const stateDesc = s.description ?? '';
          const trans = Array.isArray(s.transitions) ? s.transitions.join(' → ') : '';
          return `<li class="problem-detail-core-business-object-list-item"><strong>${escapeHtml(stateName)}</strong>${stateDesc ? ': ' + escapeHtml(stateDesc) : ''}${trans ? ' （→ ' + escapeHtml(trans) + '）' : ''}</li>`;
        }).join('')}</ul>`
      : '<span class="problem-detail-core-business-object-empty">—</span>';
    const relationsBody = relations.length
      ? `<ul class="problem-detail-core-business-object-list">${relations.map((r) => {
          const target = r.target_entity ?? r.targetEntity ?? '—';
          const relType = r.relation_type ?? r.relationType ?? '—';
          return `<li class="problem-detail-core-business-object-list-item">${escapeHtml(target)}（${escapeHtml(relType)}）</li>`;
        }).join('')}</ul>`
      : '<span class="problem-detail-core-business-object-empty">—</span>';

    const subcardsHtml = [
      subcard('设计用途', usageBody),
      subcard('字段定义', fieldsBody),
      subcard('状态机', stateBody),
      subcard('关联对象', relationsBody),
    ].join('');

    const categoryTagHtml = category ? `<span class="problem-detail-core-business-entity-category-tag">${escapeHtml(category)}</span>` : '';
    const isGlobalSharedTagHtml = isGlobalSharedTag ? `<span class="problem-detail-core-business-entity-global-tag">${escapeHtml(isGlobalSharedTag)}</span>` : '';
    const roleTagHtml = roleTag ? `<span class="problem-detail-core-business-entity-role-tag">${escapeHtml(roleTag)}</span>` : '';
    return `
    <div class="problem-detail-card problem-detail-card-core-business-entity">
      <div class="problem-detail-card-header problem-detail-card-header-collapsed" tabindex="0" role="button" aria-expanded="false">
        <span class="problem-detail-core-business-entity-header-icon" aria-hidden="true">📦</span>
        <span class="problem-detail-card-header-title">${escapeHtml(titleText)}</span>
        ${categoryTagHtml}
        ${isGlobalSharedTagHtml}
        ${roleTagHtml}
        <span class="problem-detail-card-header-arrow">▾</span>
      </div>
      <div class="problem-detail-card-body" hidden>
        <div class="problem-detail-core-business-entity-sections">${subcardsHtml}</div>
      </div>
    </div>`;
  }

  /** 基于单个环节的 model 对象构建 View 视图 HTML（对象卡横排；每卡含三块 JSON 子卡） */
  function buildCoreBusinessObjectStepViewHtml(match) {
    if (!match || typeof match !== 'object') return '';
    const architectureAudit = (match['架构审计结论'] ?? match.local_gap_resolved ?? '').toString().trim() || '—';
    const skeletonList = Array.isArray(match['核心骨架清单'])
      ? match['核心骨架清单']
      : (Array.isArray(match.business_objects)
        ? match.business_objects
        : (Array.isArray(match.entities) ? match.entities : []));
    const hostingList = Array.isArray(match['存量对象承接']) ? match['存量对象承接'] : [];
    const objectCardsHtml = skeletonList.length
      ? skeletonList.map((obj) => {
          const objName = (obj && typeof obj === 'object')
            ? (obj['对象中文名'] ?? obj.object_name ?? obj.entity_name ?? obj.name ?? '未命名对象')
            : '未命名对象';
          const hostingForObj = hostingList.filter((h) => {
            if (!h || typeof h !== 'object') return false;
            const n = h['承接对象名'] ?? h.object_name ?? h.entity_name;
            if (n == null) return false;
            const hs = String(n).trim();
            const os = String(objName).trim();
            return hs === os || hs.includes(os) || os.includes(hs);
          });
          return `
        <div class="problem-detail-core-business-object-mini-card">
          <div class="problem-detail-core-business-object-mini-card-title-row">
            <span class="problem-detail-core-business-object-mini-card-title">${escapeHtml(String(objName))}</span>
          </div>
          <div class="problem-detail-core-business-object-mini-card-body">
            <div class="problem-detail-core-business-object-step-subcard">
              <div class="problem-detail-core-business-object-step-subcard-title">架构审计结论</div>
              <div class="problem-detail-core-business-object-step-subcard-body">${formatCoreBusinessObjectField(architectureAudit)}</div>
            </div>
            <div class="problem-detail-core-business-object-step-subcard">
              <div class="problem-detail-core-business-object-step-subcard-title">核心骨架清单</div>
              <div class="problem-detail-core-business-object-step-subcard-body">${formatCoreBusinessObjectField([obj])}</div>
            </div>
            <div class="problem-detail-core-business-object-step-subcard">
              <div class="problem-detail-core-business-object-step-subcard-title">存量对象承接</div>
              <div class="problem-detail-core-business-object-step-subcard-body">${formatCoreBusinessObjectField(hostingForObj.length ? hostingForObj : hostingList)}</div>
            </div>
          </div>
        </div>`;
        }).join('')
      : '<div class="problem-detail-core-business-object-placeholder">该环节暂无业务对象数据</div>';
    return `
    <div class="problem-detail-core-business-object-step-layout">
      <div class="problem-detail-core-business-object-mini-card-row">${objectCardsHtml}</div>
    </div>`;
  }

  /** 将解析后的模型渲染为环节列表或实体卡片列表 HTML */
  function buildCoreBusinessObjectNodeCardsHtml(model) {
    if (!Array.isArray(model) || model.length === 0) return '';
    const isPerStep = model[0] && typeof model[0] === 'object' && (Array.isArray(model[0].entities) && (model[0].step_name != null || model[0].stage_name != null));
    if (isPerStep) {
      return `<div class="problem-detail-core-business-object-step-list">
        <div class="problem-detail-core-business-object-list-title">环节列表</div>${model
        .map((item) => {
          const stepName = item.stage_name != null && item.step_name != null
            ? `${item.stage_name} － ${item.step_name}`
            : (item.step_name || item.stage_name || [item.step_id, item.stage_id].filter(Boolean).join(' ') || '环节');
          const viewHtml = buildCoreBusinessObjectStepViewHtml(item);
          const jsonStr = JSON.stringify(item, null, 2);
          return `
        <div class="problem-detail-card problem-detail-card-core-business-object">
          <div class="problem-detail-card-header problem-detail-card-header-collapsed" tabindex="0" role="button" aria-expanded="false">
            <span class="problem-detail-card-header-title">${escapeHtml(stepName)}</span>
            <span class="problem-detail-card-header-arrow">▾</span>
          </div>
          <div class="problem-detail-card-body" hidden>
            <div class="problem-detail-core-business-object-tabs">
              <span class="problem-detail-core-business-object-tabs-title">核心业务对象推演</span>
              <button type="button" class="problem-detail-core-business-object-tab problem-detail-core-business-object-tab-active" data-tab="view">view</button>
              <button type="button" class="problem-detail-core-business-object-tab" data-tab="json">json</button>
            </div>
            <div class="problem-detail-core-business-object-panel problem-detail-core-business-object-panel-view" data-panel="view">${viewHtml}</div>
            <div class="problem-detail-core-business-object-panel problem-detail-core-business-object-panel-json" data-panel="json" hidden><pre class="problem-detail-core-business-object-json">${escapeHtml(jsonStr)}</pre></div>
          </div>
        </div>`;
        })
        .join('')}</div>`;
    }
    const flatEntities = model.filter((m) => m && typeof m === 'object' && (Array.isArray(m.entities) ? m.entities : [m])).flatMap((m) => Array.isArray(m.entities) ? m.entities : [m]);
    if (flatEntities.length === 0) return '';
    const viewHtml = flatEntities.map((e) => buildEntityCardHtml(e)).filter(Boolean).join('');
    return `<div class="problem-detail-core-business-object-step-list">
      <div class="problem-detail-core-business-object-list-title">核心业务对象</div>
      <div class="problem-detail-core-business-object-view-entities">${viewHtml}</div>
    </div>`;
  }

  /** 构建任务确认时的上下文 JSON：全局 ITGap、端到端事务流、角色门户/汇总设计、每环节角色权限推演 */
  function buildCoreBusinessObjectContextJson(item, valueStream, getLatestConfirmedRolePermissionContent, getLocalItGapCompressedJsonForStep) {
    if (!item || !valueStream || valueStream.raw) return null;
    const globalItGap = parseMaybeJson(item.globalItGapConstraintBaseMarkdown) ?? item.globalItGapAnalysisJson ?? null;
    let localItGapByStep = [];
    const portal = item.roleTaskCenterPortalDesignJson;
    if (portal != null && typeof portal === 'object') {
      const norm =
        typeof globalThis.normalizeRoleTaskCenterPortalRoles === 'function'
          ? globalThis.normalizeRoleTaskCenterPortalRoles(portal)
          : [];
      if (norm.length > 0) {
        localItGapByStep = [
          {
            stepName: '流程待办与决策中心门户',
            stageName: '',
            stepIndex: 0,
            analysis: portal,
          },
        ];
      }
    }
    if (localItGapByStep.length === 0) {
      const localSessions = item.localItGapSessions || [];
      const localAnalyses = item.localItGapAnalyses || [];
      localItGapByStep = localSessions.map((s) => {
        const analysis = localAnalyses.find((a) => (a.stepIndex != null && a.stepIndex === s.stepIndex) || (a.stepName && a.stepName === s.stepName));
        const compressedRaw =
          typeof getLocalItGapCompressedJsonForStep === 'function'
            ? getLocalItGapCompressedJsonForStep(s.stepIndex)
            : '';
        const compressedAnalysis = parseMaybeJson(compressedRaw);
        return {
          stepName: s.stepName,
          stageName: s.stageName,
          stepIndex: s.stepIndex,
          analysis: compressedAnalysis ?? analysis?.analysisJson ?? s.analysisJson ?? s.analysisMarkdown ?? null,
        };
      });
    }
    const rolePermissionContent = typeof getLatestConfirmedRolePermissionContent === 'function' ? getLatestConfirmedRolePermissionContent(item) : null;
    const rolePermissionByStep = rolePermissionContent && typeof parseRolePermissionModel === 'function' ? parseRolePermissionModel(rolePermissionContent) : [];
    return {
      globalItGap,
      valueStream: valueStream && !valueStream.raw ? valueStream : null,
      localItGapByStep,
      rolePermissionByStep,
    };
  }

  /**
   * 执行核心业务对象推演任务「确认」后的逻辑：推送上下文块、生成 session、更新存储、推送 session 块。
   * @param {Object} item - 当前问题详情项
   * @param {Object} valueStream - 已解析的价值流（非 raw）
   * @param {Object} callbacks - { pushAndSaveProblemDetailChat, updateDigitalProblemCoreBusinessObjectSessions, getTimeStr, getLatestConfirmedRolePermissionContent }
   * @param {{ skipContextBlocks?: boolean }} [options] - skipContextBlocks 为 true 时不推送四条上下文块（用于 task11 修改链路二次确认后仅下发 session 计划）
   * @returns {{ ok: true, contextJson, sessions, updatedItem } | { ok: false, error: string }}
   */
  function executeCoreBusinessObjectTaskOnConfirm(item, valueStream, callbacks, options) {
    if (!item || !valueStream || valueStream.raw) {
      return { ok: false, error: CORE_BUSINESS_OBJECT_NEED_VALUE_STREAM_MSG };
    }
    const pushAndSaveProblemDetailChat = callbacks.pushAndSaveProblemDetailChat;
    const updateDigitalProblemCoreBusinessObjectSessions = callbacks.updateDigitalProblemCoreBusinessObjectSessions;
    const getTimeStr = callbacks.getTimeStr;
    const getLatestConfirmedRolePermissionContent = callbacks.getLatestConfirmedRolePermissionContent;
    if (typeof pushAndSaveProblemDetailChat !== 'function' || typeof getTimeStr !== 'function') {
      return { ok: false, error: CORE_BUSINESS_OBJECT_NEED_VALUE_STREAM_MSG };
    }
    const { valueStream: vs, globalItGap, localItGapByStep, rolePermissionByStep } =
      buildCoreBusinessObjectContextJson(
        item,
        valueStream,
        getLatestConfirmedRolePermissionContent,
        callbacks.getLocalItGapCompressedJsonForWorkspace,
      ) || {};
    const timestamp = getTimeStr();
    const skipContextBlocks = options && options.skipContextBlocks === true;
    const suppressCboChatUi = globalThis.__FE_SUPPRESS_CBO_PROBLEM_DETAIL_CHAT_UI === true;
    if (!suppressCboChatUi && !skipContextBlocks) {
      pushAndSaveProblemDetailChat({ type: 'coreBusinessObjectContextBlock', taskId: CORE_BUSINESS_OBJECT_TASK_ID, contextLabel: '价值流设计 json', contextJson: vs != null ? vs : null, timestamp });
      pushAndSaveProblemDetailChat({ type: 'coreBusinessObjectContextBlock', taskId: CORE_BUSINESS_OBJECT_TASK_ID, contextLabel: 'IT设计补齐·压缩版 json', contextJson: globalItGap != null ? globalItGap : null, timestamp });
      pushAndSaveProblemDetailChat({ type: 'coreBusinessObjectContextBlock', taskId: CORE_BUSINESS_OBJECT_TASK_ID, contextLabel: '对象状态机构建（门户/历史环节）json', contextJson: Array.isArray(localItGapByStep) ? localItGapByStep : null, timestamp });
      pushAndSaveProblemDetailChat({ type: 'coreBusinessObjectContextBlock', taskId: CORE_BUSINESS_OBJECT_TASK_ID, contextLabel: '角色与权限模型推演 json', contextJson: Array.isArray(rolePermissionByStep) ? rolePermissionByStep : null, timestamp });
    }
    const sessions = generateCoreBusinessObjectSessions(valueStream);
    if (typeof updateDigitalProblemCoreBusinessObjectSessions === 'function') {
      updateDigitalProblemCoreBusinessObjectSessions(item.createdAt, sessions);
    }
    const updatedItem = { ...item, coreBusinessObjectSessions: sessions };
    if (!suppressCboChatUi) {
      pushAndSaveProblemDetailChat({ type: 'coreBusinessObjectSessionsBlock', taskId: CORE_BUSINESS_OBJECT_TASK_ID, sessions, timestamp, confirmed: false });
    }
    return { ok: true, sessions, updatedItem };
  }

  /** 构建聊天区「核心业务对象推演 Session」内容块的 HTML（与角色与权限 session 块样式一致，含下方确认操作区） */
  function buildCoreBusinessObjectSessionsBlockHtml(sessions, timestamp, deleteIcon, confirmed, sessionMode) {
    const list = Array.isArray(sessions) ? sessions : [];
    const sessionsConfirmed = !!confirmed;
    const mode = sessionMode || '';
    const sessionsListHtml = list
      .map(
        (s) =>
          `<div class="problem-detail-chat-role-permission-session-item"><span class="problem-detail-chat-role-permission-session-name">${escapeHtml(s.stepName || `环节${s.stepIndex + 1}`)}</span><span class="problem-detail-chat-role-permission-session-status ${s.coreBusinessObjectJson ? 'session-done' : 'session-pending'}">${s.coreBusinessObjectJson ? '已推演✅' : '待推演'}</span></div>`
      )
      .join('');
    const actionLabelAuto = mode === 'auto' ? '已选择：自动顺序执行' : '自动顺序执行';
    const actionLabelManual = mode === 'manual' ? '已选择：手工逐项确认' : '手工逐项确认';
    const icon = deleteIcon != null ? deleteIcon : '';
    return `
        <button type="button" class="btn-delete-chat-msg" aria-label="删除">${icon}</button>
        <div class="problem-detail-chat-role-permission-sessions-card-wrap">
          <div class="problem-detail-chat-role-permission-sessions-card-header">核心业务对象推演 Session</div>
          <div class="problem-detail-chat-role-permission-sessions-card-body">
            <div class="problem-detail-chat-role-permission-sessions-header">已为 ${list.length} 个环节生成核心业务对象推演 session</div>
            <div class="problem-detail-chat-role-permission-sessions-list">${sessionsListHtml}</div>
          </div>
          <div class="problem-detail-chat-role-permission-sessions-actions">
            <button type="button" class="btn-core-business-object-sessions-auto btn-confirm-primary" ${sessionsConfirmed ? 'disabled' : ''}>${escapeHtml(actionLabelAuto)}</button>
            <button type="button" class="btn-core-business-object-sessions-manual btn-confirm-primary" ${sessionsConfirmed ? 'disabled' : ''}>${escapeHtml(actionLabelManual)}</button>
          </div>
        </div>
        <div class="problem-detail-chat-msg-time">${escapeHtml(
          typeof globalThis.formatChatTime === 'function' ? globalThis.formatChatTime(timestamp) : String(timestamp || ''),
        )}</div>`;
  }

  /** 多环节对象骨架生成完毕后的全局血缘审计（严格 JSON 输出） */
  const CORE_BUSINESS_OBJECT_GLOBAL_SKELETON_AUDIT_SYSTEM = `# 角色设定
你是一位资深数据架构评审官，专门负责大型 ERP/低代码系统的「全链路数据血缘」审计。

# 审计对象
已推演出的多个环节的对象清单 JSON 列表（用户消息中给出）。

# 审计核心 (一致性三项)
1. **血缘断裂检查**：是否存在某个环节的对象完全脱离了 \`Project_ID\` 或 \`Customer_ID\`？（检查溯源锚点是否贯穿始终）。
2. **命名与定义冲突**：是否存在不同环节定义了逻辑相同但名称不同的对象？（如：环节 A 的「客户」与环节 B 的「甲方档案」）。
3. **状态接力逻辑**：上游对象的「终态」是否逻辑上能触发下游对象的「始态」？是否存在逻辑跳变？

# 输出要求 (JSON)
请只输出一个 JSON 对象，不要 markdown 代码块、不要解释性文字。结构如下：
{
  "全局血缘评分": "0-100",
  "一致性缺陷清单": [
    {"缺陷类型": "断裂/重复/冲突", "涉及对象": ["A", "B"], "风险描述": "...", "修正建议": "..."}
  ],
  "穿透链路路径图": "用文本箭头表示 Project_ID 的流转路径 (例如：客户 -> 商机 -> 合同 -> 项目)"
}`;

  /**
   * @param {Array<{ stepName?: string, stageName?: string, coreBusinessObjectJson?: unknown }>} sessions
   */
  function buildCoreBusinessObjectGlobalAuditUserPrompt(sessions) {
    const list = (Array.isArray(sessions) ? sessions : []).map((s, i) => ({
      环节序号: i,
      环节名称: s.stepName || `环节${i + 1}`,
      阶段名称: s.stageName || '',
      对象骨架: s.coreBusinessObjectJson != null ? s.coreBusinessObjectJson : null,
    }));
    const jsonStr = JSON.stringify(list, null, 2);
    return [
      '以下为各环节的「核心业务对象骨架」JSON 列表（按环节顺序）。请按系统角色与审计三项完成评审。',
      '',
      '【环节对象清单 JSON】',
      jsonStr,
      '',
      '请严格只输出一个符合「输出要求」字段结构的 JSON 对象。',
    ].join('\n');
  }

  /**
   * @param {Array<{ stepName?: string, stageName?: string, coreBusinessObjectJson?: unknown }>} sessions
   */
  async function generateCoreBusinessObjectGlobalSkeletonAuditWithStrictPrompt(sessions) {
    const systemPrompt = CORE_BUSINESS_OBJECT_GLOBAL_SKELETON_AUDIT_SYSTEM;
    const userPrompt = buildCoreBusinessObjectGlobalAuditUserPrompt(sessions);
    const llmInputPrompt = `【系统】\n${systemPrompt}\n\n【用户】\n${userPrompt}`;
    const result = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { taskTag: 'task11', maxOutputTokens: 8192, timeoutMs: 300_000 },
    );
    return { ...result, llmInputPrompt };
  }

  if (typeof global !== 'undefined') {
    global.generateCoreBusinessObjectSessions = generateCoreBusinessObjectSessions;
    global.generateCoreBusinessObjectForStepWithStrictPrompt = generateCoreBusinessObjectForStepWithStrictPrompt;
    global.generateCoreBusinessObjectGlobalSkeletonAuditWithStrictPrompt = generateCoreBusinessObjectGlobalSkeletonAuditWithStrictPrompt;
    global.generateCoreBusinessObjectForStep = generateCoreBusinessObjectForStep;
    global.parseCoreBusinessObjectModel = parseCoreBusinessObjectModel;
    global.buildCoreBusinessObjectNodeCardsHtml = buildCoreBusinessObjectNodeCardsHtml;
    global.buildCoreBusinessObjectViewSectionsHtml = buildCoreBusinessObjectViewSectionsHtml;
    global.buildCoreBusinessObjectStepViewHtml = buildCoreBusinessObjectStepViewHtml;
    global.formatCoreBusinessObjectField = formatCoreBusinessObjectField;
    global.buildEntityCardHtml = buildEntityCardHtml;
    global.buildCoreBusinessObjectContextJson = buildCoreBusinessObjectContextJson;
    global.buildCoreBusinessObjectStepPayloadStrings = buildCoreBusinessObjectStepPayloadStrings;
    global.extractValueStreamSliceForStep = extractValueStreamSliceForStep;
    global.executeCoreBusinessObjectTaskOnConfirm = executeCoreBusinessObjectTaskOnConfirm;
    global.buildCoreBusinessObjectSessionsBlockHtml = buildCoreBusinessObjectSessionsBlockHtml;
    global.CORE_BUSINESS_OBJECT_TASK_ID = CORE_BUSINESS_OBJECT_TASK_ID;
    global.CORE_BUSINESS_OBJECT_NEED_VALUE_STREAM_MSG = CORE_BUSINESS_OBJECT_NEED_VALUE_STREAM_MSG;
  }
})(typeof window !== 'undefined' ? window : this);
