/**
 * [INPUT]: 依赖 global.parseValueStreamGraph、global.fetchDeepSeekChat、global.escapeHtml、global.renderMarkdown
 * [OUTPUT]: session 生成、单环节 LLM 调用（含累计角色清单入参）、**全量确认后合规审计** `generateRolePermissionComplianceAuditWithStrictPrompt`（五项准则、**核心重构约束/反压缩**、**初步需求人员组织审计基准**、可选 caseItem 注入经营模式摘录、VSM 与各环节推演 JSON 对比）；解析、工作区 view/角色清单卡片 HTML（view 角色名 + 职能描述（n）环节数标签，不展示关联环节；含 view+json Tab）、清单合并工具函数；roles[] 与累计清单含 functional_description；functionalDescriptionItems 按环节分条合并，角色清单多条职能时列表展示
 * [POS]: task10 角色与权限推演核心脚本
 *
 * [PROTOCOL]: 逻辑或导出变更须同步本 Header 与 frontend/js/rolePermission.md、PROMPTS.md §15。
 * FE-20260330-7：`buildPreliminaryOperationModelTextForRolePermission` 仅读新版 V2 `operationModel.valueStreamMapping` / `orgAndRoles`（不再读扁平 businessProcess/orgStructure）。
 * generateRolePermissionForStep 返回 llmInputPrompt；可选第 8 参 caseItem 注入初步需求卡片「核心业务流程梳理」「人员组织模式」（buildResolvedPreliminaryRequirement）；system 含**人员组织模式角色基准**（有明确定义则以之为称谓基准、可增支撑角色、不得删初步需求角色）；`buildPreliminaryOperationModelTextForRolePermission` 挂 global 供 `runRolePermissionModeling` 注入同块；累计清单字段 rolePermissionRoleRegistry 与 main.js applyRolePermissionRegistryMerge / syncRolePermissionRegistryFromSessions 配合；工作区对齐见 getRolePermissionStepJsonForWorkspace、effectiveRpMatch。
 */
(function(global) {
  const parseValueStreamGraph = global.parseValueStreamGraph;
  const fetchDeepSeekChat = global.fetchDeepSeekChat;
  const escapeHtml = global.escapeHtml;
  const renderMarkdown = global.renderMarkdown;

  const ROLE_PERMISSION_LOG = false;

  /** 根据价值流生成角色与权限模型推演 session（不调用大模型），用于逐步按环节分析 */
  function generateRolePermissionSessions(valueStream) {
    const { stages } = parseValueStreamGraph(valueStream || {});
    let stepIndex = 0;
    const sessions = [];
    for (const stage of stages) {
      const stageName = stage?.name || '';
      for (const step of stage.steps || []) {
        const stepName = step?.name || `环节${stepIndex + 1}`;
        sessions.push({ stepName, stepIndex, stageName, rolePermissionJson: null });
        stepIndex += 1;
      }
    }
    return sessions;
  }

  /**
   * 从初步需求卡片取「核心业务流程梳理」「人员组织模式」，拼入角色权限推演 user 输入（与 preliminaryRequirement 卡片同源）。
   * @param {object} [caseItem] - 当前问题单
   * @returns {string} 非空则含两段标题与正文；皆空则返回 ''
   */
  function buildPreliminaryOperationModelTextForRolePermission(caseItem) {
    if (!caseItem || typeof caseItem !== 'object') return '';
    let preliminary = null;
    try {
      if (typeof global.buildResolvedPreliminaryRequirement === 'function') {
        preliminary = global.buildResolvedPreliminaryRequirement(caseItem);
      }
    } catch (_) {
      preliminary = null;
    }
    const isV2 =
      preliminary &&
      typeof global.isPreliminaryRequirementV2Shape === 'function' &&
      global.isPreliminaryRequirementV2Shape(preliminary);
    if (!isV2 || !preliminary.operationModel || typeof preliminary.operationModel !== 'object') return '';
    const om = preliminary.operationModel;
    const vsm = om.valueStreamMapping;
    let bp = '';
    if (Array.isArray(vsm) && vsm.length > 0) {
      bp = vsm
        .map((row) =>
          [row.step, row.actor, row.scope, row.action, row.object, row.logicalConstraint]
            .filter((x) => x != null && String(x).trim() !== '')
            .join('｜'),
        )
        .filter((line) => line)
        .join('\n');
    }
    const oar = om.orgAndRoles && typeof om.orgAndRoles === 'object' ? om.orgAndRoles : null;
    let org = '';
    if (oar) {
      const parts = [];
      if (Array.isArray(oar.stakeholders) && oar.stakeholders.length > 0) {
        parts.push(`干系人：${oar.stakeholders.map((s) => String(s).trim()).filter(Boolean).join('、')}`);
      }
      if (oar.governanceLogic != null && String(oar.governanceLogic).trim()) parts.push(String(oar.governanceLogic).trim());
      if (oar.incentiveHooks != null && String(oar.incentiveHooks).trim() && String(oar.incentiveHooks).trim() !== 'NOT_SPECIFIED') {
        parts.push(`激励：${String(oar.incentiveHooks).trim()}`);
      }
      org = parts.join('\n');
    }
    if (!bp && !org) return '';
    return [
      '【初步需求卡片｜经营模式（请在推演角色、职责与权限边界时一并参考）】',
      '',
      '【核心业务流程梳理】',
      bp || '（未填写）',
      '',
      '【人员组织模式】',
      org || '（未填写）',
    ].join('\n');
  }

  /**
   * 针对单个环节调用大模型进行角色与权限推演
   * @param {string} accumulatedRoleRegistryJson - 截至上一环节的累计角色清单 JSON 字符串（数组），首次环节可为 "[]"
   * @param {object} [caseItem] - 当前问题单；用于注入初步需求卡片中「核心业务流程梳理」「人员组织模式」
   */
  async function generateRolePermissionForStep(stepName, stageName, valueStream, globalItGap, localItGap, projectName, accumulatedRoleRegistryJson, caseItem) {
    const vsmJson = JSON.stringify(valueStream, null, 2);
    const globalItGapJson = globalItGap != null ? JSON.stringify(globalItGap, null, 2) : '';
    const localItGapJson = Array.isArray(localItGap) && localItGap.length > 0 ? JSON.stringify(localItGap, null, 2) : '';
    const systemPrompt = `Role & Context:
我是一名软件公司的需求分析专家。我已经完成了客户业务的全链路价值流绘制，并详细标注了每个环节的 IT 现状（Status Quo）、技术差距（IT Gap）及业务痛点（Pain Points）。

Task Goal:
请针对环节「${stepName}」所在的阶段「${stageName}」，利用行业最佳实践（Industry Best Practices）模拟出一套高度匹配的角色与权限模型（RBAC Model），输出该环节的角色与权限推演结果（单个 JSON 对象）。这套模型将作为后续 IT 解决方案的底座。

Requirement Details:

角色画像模拟： 针对该环节推演 1-2 个标准业务角色（如：高管、业务经办、风险控制官等），并定义其在该节点的核心业务使命。

现状转换映射： 深度对比该角色在"旧系统/线下纸质"与"新 IT 系统"中的操作差异。

痛点闭环设计： 权限设计必须直接对冲标注的痛点。例如：若痛点是"人工查验慢"，新权限应包含"系统自动准入校验权"；若痛点是"信息孤岛"，新权限应包含"跨模块数据透视权"。

初步需求参考： 用户消息中可能包含初步需求卡片里的「核心业务流程梳理」与「人员组织模式」。推演角色画像、职责边界与 SoD 时须与该组织与流程语境对齐，避免与已陈述的业务运行方式、岗位分工相矛盾。

人员组织模式角色基准（强制）： 若在企业背景洞察→初步需求→「人员组织模式」中已有明确的企业角色定义（含角色类型、称谓或岗位名单），则推演产出的角色**类型与称谓**须以该定义为基准。推演过程中**允许**在各环节**额外增加**支撑性角色；**禁止**删除、合并或更名致使初步需求中已定义的人员角色在整套推演（含累计角色清单）中不再出现或无法一一对应。凡本环节涉及初步需求已点名的角色时，输出中必须体现该角色，且 \`role_name\` 须与初步需求中的称谓一致。

合规与风控（SoD）： 识别关键节点中的职责分离要求（如：提报与审批、财务与出纳、采购与验收等角色的互斥逻辑）。

角色命名与累计清单（强制）：
- 用户消息中会附带「累计角色清单」JSON 数组，每项含 role_name（规范角色名）、linked_steps（该角色已关联的价值流环节标签列表）、functional_description（若已有则为已提炼的职能描述，可为空字符串）。
- 若本环节推演中的业务人物与清单中某一角色实质为同一人/同一岗位/同一干系人，则 outputs.roles[].role_name 必须与清单中该条目的 role_name **逐字完全一致**（含空格与标点），禁止改写、缩写、换同义词或繁简混用；**若该岗位在「人员组织模式」中已有定义，则 role_name 须与初步需求中的称谓一致，并与清单统一为同一规范名**。functional_description 可在本环节语境下**更新或细化**（仍须为简洁中文摘要）。
- 若本环节出现清单中尚不存在的新角色，则使用新的 role_name（勿与清单任一条 role_name 完全重复），且**必须**填写 functional_description，系统会将新角色并入累计清单。
- 同一环节仍可输出 1～2 个角色；每个角色均须遵守上述对齐规则。

Output Format (Strict JSON):
请直接输出 JSON 数据，不要包含任何多余的解释文字。输出**一个 JSON 对象**（不要用数组包裹），结构需包含如下字段：

{
  "stage_id": "环节序号",
  "stage_name": "价值流环节名称",
  "it_gap_reference": "关联的 IT 现状与痛点简述",
  "roles": [
    {
      "role_name": "模拟角色名称",
      "functional_description": "该角色在本环节的职能摘要：岗位使命与职责边界（一两句中文，供角色清单与界面展示）",
      "legacy_operation": "现状/线下操作模式描述",
      "new_it_permissions": {
        "create": "boolean",
        "read": "string (权限范围：本人/本组/全行)",
        "update": "boolean",
        "delete": "boolean",
        "approve": "boolean"
      },
      "pain_point_solution": {
        "target_pain": "解决的具体痛点",
        "improvement_logic": "新权限/新功能如何从技术层面消除该痛点"
      },
      "trigger_logic": "该角色触发下一环节的操作逻辑或系统判别条件"
    }
  ],
  "sod_warning": "该环节的职责分离建议（如无则设为 null）"
}`;
    const userParts = [
      `项目：${projectName}。针对环节「${stepName}」进行角色与权限推演。`,
    ];
    const prelimOm = buildPreliminaryOperationModelTextForRolePermission(caseItem);
    if (prelimOm) userParts.push(prelimOm, '');
    userParts.push('【端到端事务流】', vsmJson);
    if (globalItGapJson) userParts.push('【IT设计补齐】', globalItGapJson);
    if (localItGapJson) userParts.push('【对象状态机构建】', localItGapJson);
    const regJson = (accumulatedRoleRegistryJson != null && String(accumulatedRoleRegistryJson).trim()) ? String(accumulatedRoleRegistryJson).trim() : '[]';
    userParts.push('【累计角色清单（JSON，用于角色命名对齐；与清单中已有角色实质相同时必须逐字复用 role_name）】', regJson);
    userParts.push('\n请直接输出该环节的 JSON 对象，不要 markdown 代码块或说明文字。');
    const userPrompt = userParts.join('\n\n');
    const llmInputPrompt = `【系统】\n${systemPrompt}\n\n【用户】\n${userPrompt}`;
    const result = await fetchDeepSeekChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    return { ...result, llmInputPrompt };
  }

  /**
   * 解析角色权限模型文本，兼容 JSON 与 Markdown 表格格式。
   * @param {string} markdown - 大模型返回文本。
   * @returns {Array<Object>} 标准化后的角色权限模型数组。
   */
  function parseRolePermissionModel(markdown) {
    if (!markdown || typeof markdown !== 'string') return [];
    let raw = markdown.trim().replace(/^\uFEFF/, '');
    if (ROLE_PERMISSION_LOG) console.log('[角色与权限] parseRolePermissionModel: 输入长度=', raw.length, '前80字=', raw.slice(0, 80));
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e1) {
      if (ROLE_PERMISSION_LOG) console.log('[角色与权限] parseRolePermissionModel: JSON.parse(raw) 失败:', e1 && e1.message);
      const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlock) {
        try {
          parsed = JSON.parse(codeBlock[1].trim());
        } catch (_2) {}
      }
      if (!Array.isArray(parsed)) {
        const start = raw.indexOf('[');
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
            if (c === '[') { depth += 1; i += 1; continue; }
            if (c === ']') {
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
            } catch (_3) {
              if (ROLE_PERMISSION_LOG) console.log('[角色与权限] parseRolePermissionModel: 括号截取后仍解析失败, 长度=', end - start + 1);
            }
          }
        }
      }
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const hasRoles = Array.isArray(parsed.roles);
      const hasStep = 'step_name' in parsed || 'step_id' in parsed;
      const hasStage = 'stage_name' in parsed || 'stage_id' in parsed;
      if (hasRoles && (hasStep || hasStage)) {
        if (ROLE_PERMISSION_LOG) console.log('[角色与权限] parseRolePermissionModel: 解析成功(单对象新格式), 包装为数组');
        return [parsed];
      }
      if (hasStep || hasStage) {
        if (ROLE_PERMISSION_LOG) console.log('[角色与权限] parseRolePermissionModel: 解析成功(单对象按环节), 包装为数组');
        return [parsed];
      }
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      if (first && typeof first === 'object') {
        const hasRoles = Array.isArray(first.roles);
        const hasStep = 'step_name' in first || 'step_id' in first;
        const hasStage = 'stage_name' in first || 'stage_id' in first;
        if (hasRoles && (hasStep || hasStage)) {
          if (ROLE_PERMISSION_LOG) console.log('[角色与权限] parseRolePermissionModel: 解析成功(新格式), 条数=', parsed.length, '首条keys=', Object.keys(first || {}));
          return parsed;
        }
        if (hasStep || hasStage) {
          if (ROLE_PERMISSION_LOG) console.log('[角色与权限] parseRolePermissionModel: 解析成功(按环节), 条数=', parsed.length);
          return parsed;
        }
      }
    }
    if (ROLE_PERMISSION_LOG) console.log('[角色与权限] parseRolePermissionModel: 未识别为新格式数组, 尝试表格解析, parsed=', Array.isArray(parsed) ? 'length=' + parsed.length : parsed);
    const lines = markdown.split(/\r?\n/).map((l) => l.trim());
    const tableLines = lines.filter((l) => l.includes('|'));
    if (tableLines.length < 2) return [];
    const headerLine = tableLines[0];
    const headerCells = headerLine
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c);
    const idxNode = headerCells.findIndex((c) => c.includes('节点'));
    const idxRole = headerCells.findIndex((c) => c.includes('建议角色'));
    const idxDuty = headerCells.findIndex((c) => c.includes('核心职责'));
    const idxPerm = headerCells.findIndex((c) => c.includes('权限'));
    const rows = [];
    for (let i = 2; i < tableLines.length; i++) {
      const line = tableLines[i];
      if (!line || !line.includes('|')) continue;
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c);
      if (cells.length < 2) continue;
      const getCell = (idx) => (idx >= 0 && idx < cells.length ? cells[idx] : '');
      const nodeName = getCell(idxNode >= 0 ? idxNode : 0);
      if (!nodeName) continue;
      const roleText = getCell(idxRole >= 0 ? idxRole : 1);
      const dutyText = getCell(idxDuty >= 0 ? idxDuty : 2);
      const permText = getCell(idxPerm >= 0 ? idxPerm : 3);
      const roles = { executor: '', approver: '', informer: '' };
      if (roleText) {
        const execMatch = roleText.match(/执行者[:：]([^；;]+)/);
        const apprMatch = roleText.match(/审批者[:：]([^；;]+)/);
        const infoMatch = roleText.match(/知情者[:：]([^；;]+)/);
        roles.executor = execMatch ? execMatch[1].trim() : '';
        roles.approver = apprMatch ? apprMatch[1].trim() : '';
        roles.informer = infoMatch ? infoMatch[1].trim() : '';
      }
      const perms = { wechat: '', lowcode: '', notify: '', query: '' };
      if (permText) {
        const wechatMatch = permText.match(/企微端[:：]([^；;]+)/);
        const lowcodeMatch = permText.match(/低代码[:：]([^；;]+)/);
        const notifyMatch = permText.match(/接收通知[:：]([^；;]+)/);
        const queryMatch = permText.match(/查询数据[:：]([^；;]+)/);
        perms.wechat = wechatMatch ? wechatMatch[1].trim() : '';
        perms.lowcode = lowcodeMatch ? lowcodeMatch[1].trim() : '';
        perms.notify = notifyMatch ? notifyMatch[1].trim() : '';
        perms.query = queryMatch ? queryMatch[1].trim() : '';
      }
      rows.push({
        node: nodeName,
        roles,
        duty: dutyText,
        perms,
      });
    }
    return rows;
  }

  /** 将角色字段渲染为 HTML：字符串用 markdown，对象用 JSON pre */
  /**
   * 将字段值格式化为角色权限卡片可展示 HTML。
   * @param {*} val - 字段值。
   * @returns {string} HTML 片段。
   */
  function formatRolePermissionField(val) {
    if (val == null || (typeof val === 'string' && !val.trim())) return '<span class="problem-detail-role-permission-empty">—</span>';
    if (typeof val === 'string') return `<div class="problem-detail-role-permission-field-content markdown-body">${renderMarkdown(val.trim())}</div>`;
    if (typeof val === 'object') return `<pre class="problem-detail-role-permission-field-pre">${escapeHtml(JSON.stringify(val, null, 2))}</pre>`;
    return escapeHtml(String(val));
  }

  /** 将 new_it_permissions 渲染为 数据权限、功能实用、系统操作 三个子卡片 */
  /**
   * 将 new_it_permissions 渲染为三类权限子卡片。
   * @param {Object} obj - new_it_permissions 对象。
   * @returns {string} HTML 片段。
   */
  /** 权限项中文标签（create/update/delete/approve；read 单独展示为「查阅范围」） */
  const NEW_PERMISSION_LABELS = { create: '创建', read: '查阅', update: '更新', delete: '删除', approve: '审批' };

  /** 创建/更新/删除/审批：是 → ✅，否 → ✕；兼容布尔与中英文 */
  function formatNewPermissionBooleanish(v) {
    if (v === true) return '<span class="problem-detail-role-permission-bool-icon" aria-label="是" title="是">✅</span>';
    if (v === false) return '<span class="problem-detail-role-permission-bool-icon" aria-label="否" title="否">✕</span>';
    if (v == null || (typeof v === 'string' && !String(v).trim())) {
      return '<span class="problem-detail-role-permission-empty">—</span>';
    }
    const s = String(v).trim().toLowerCase();
    if (s === '是' || s === 'true' || s === 'yes') {
      return '<span class="problem-detail-role-permission-bool-icon" aria-label="是" title="是">✅</span>';
    }
    if (s === '否' || s === 'false' || s === 'no') {
      return '<span class="problem-detail-role-permission-bool-icon" aria-label="否" title="否">✕</span>';
    }
    return escapeHtml(String(v));
  }

  function buildNewPermissionsSubcardsHtml(obj) {
    if (!obj || typeof obj !== 'object') return '<span class="problem-detail-role-permission-empty">—</span>';
    const labels = { data_access: '数据权限', function_use: '功能实用', system_operation: '系统操作' };
    const keys = ['data_access', 'function_use', 'system_operation'];
    const cards = keys.map((key) => {
      const val = obj[key];
      if (val == null && !(key in obj)) return '';
      const label = labels[key] || key;
      let content = '';
      if (val == null) content = '<span class="problem-detail-role-permission-empty">—</span>';
      else if (Array.isArray(val)) content = val.length ? `<ul class="problem-detail-role-permission-list">${val.map((v) => `<li class="problem-detail-role-permission-list-item">${escapeHtml(String(v))}</li>`).join('')}</ul>` : '<span class="problem-detail-role-permission-empty">—</span>';
      else if (typeof val === 'string') content = `<div class="problem-detail-role-permission-field-content markdown-body">${renderMarkdown(val.trim() || '—')}</div>`;
      else content = `<pre class="problem-detail-role-permission-field-pre">${escapeHtml(JSON.stringify(val, null, 2))}</pre>`;
      return `<div class="problem-detail-role-permission-inner-card"><div class="problem-detail-role-permission-inner-card-title">${escapeHtml(label)}</div><div class="problem-detail-role-permission-inner-card-body">${content}</div></div>`;
    }).filter(Boolean).join('');
    if (!cards) {
      const permKeysFlat = ['create', 'read', 'update', 'delete', 'approve'];
      const hasNewFormat = permKeysFlat.some((k) => k in obj);
      if (hasNewFormat) {
        const readRaw = obj.read;
        const readScopeHtml =
          readRaw == null || (typeof readRaw === 'string' && !readRaw.trim())
            ? '<span class="problem-detail-role-permission-empty">—</span>'
            : escapeHtml(String(readRaw));
        const readLine = `<div class="problem-detail-role-permission-kv problem-detail-role-permission-kv-read-scope"><span class="problem-detail-role-permission-kv-label">查阅范围：</span><span class="problem-detail-role-permission-kv-value">${readScopeHtml}</span></div>`;
        const boolKeys = ['create', 'update', 'delete', 'approve'];
        const boolLines = boolKeys
          .map((k) => {
            const v = obj[k];
            const label = NEW_PERMISSION_LABELS[k] || k;
            return `<div class="problem-detail-role-permission-kv problem-detail-role-permission-kv-bool"><span class="problem-detail-role-permission-kv-label">${escapeHtml(label)}</span><span class="problem-detail-role-permission-kv-value">${formatNewPermissionBooleanish(v)}</span></div>`;
          })
          .join('');
        const items = readLine + boolLines;
        return `<div class="problem-detail-role-permission-inner-cards"><div class="problem-detail-role-permission-inner-card"><div class="problem-detail-role-permission-inner-card-title">权限项</div><div class="problem-detail-role-permission-inner-card-body problem-detail-role-permission-inner-card-body-perms">${items}</div></div></div>`;
      }
      return '<span class="problem-detail-role-permission-empty">—</span>';
    }
    return `<div class="problem-detail-role-permission-inner-cards">${cards}</div>`;
  }

  const PAIN_POINT_SOLUTION_LABELS = {
    eliminate_manual_collection: '消除人工采集',
    real_time_data_fusion: '实时数据融合',
    'real-time_data_fusion': '实时数据融合',
    predictive_analysis_support: '预测分析支持',
    automated_alerting: '自动化预警',
    centralized_knowledge_asset: '集中化知识资产',
    immediate_market_reference: '即时市场参考',
    proactive_risk_awareness: '主动风险感知',
    data_driven_decision: '数据驱动决策',
    strategic_insight: '战略洞察',
    real_time_visibility: '实时可视',
    workflow_automation: '流程自动化',
    decision_support: '决策支持',
    knowledge_management: '知识管理',
    collaboration_improvement: '协作改善',
    'data-driven_decision': '数据驱动决策',
    immediate_response: '即时响应',
    accuracy_guarantee: '准确性保障',
    mobile_support: '移动端支持',
    inventory_reservation: '库存预留',
    reduce_interruption: '减少打断',
    improve_accuracy: '提升准确性',
    enhanced_visibility: '增强可见性',
    standardized_pricing: '标准化定价',
    audit_trail: '审计追踪',
  };

  /**
   * 将下划线 key 转为英文标题显示。
   * @param {string} key - 原始 key。
   * @returns {string} 标题文本。
   */
  function formatKeyToEnglishTitle(key) {
    if (!key || typeof key !== 'string') return '';
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * 将 pain_point_solution 渲染为多张子卡片。
   * @param {Object} obj - 痛点解决方案对象。
   * @returns {string} HTML 片段。
   */
  function buildPainPointSolutionSubcardsHtml(obj) {
    if (!obj || typeof obj !== 'object') return '<span class="problem-detail-role-permission-empty">—</span>';
    const entries = Object.entries(obj);
    if (!entries.length) return '<span class="problem-detail-role-permission-empty">—</span>';
    const cards = entries.map(([key, val], i) => {
      const labelZh = PAIN_POINT_SOLUTION_LABELS[key] || (key ? `解决方案 ${i + 1}` : '—');
      const labelEn = formatKeyToEnglishTitle(key) || '—';
      const content = val == null || (typeof val === 'string' && !val.trim())
        ? '<span class="problem-detail-role-permission-empty">—</span>'
        : (typeof val === 'string'
          ? `<div class="problem-detail-role-permission-field-content markdown-body">${renderMarkdown(val.trim())}</div>`
          : `<pre class="problem-detail-role-permission-field-pre">${escapeHtml(JSON.stringify(val, null, 2))}</pre>`);
      const titleHtml = `<div class="problem-detail-role-permission-inner-card-title"><span class="problem-detail-role-permission-title-zh">${escapeHtml(labelZh)}</span><span class="problem-detail-role-permission-title-en">${escapeHtml(labelEn)}</span></div>`;
      return `<div class="problem-detail-role-permission-inner-card">${titleHtml}<div class="problem-detail-role-permission-inner-card-body">${content}</div></div>`;
    }).join('');
    return `<div class="problem-detail-role-permission-inner-cards">${cards}</div>`;
  }

  /**
   * 从单环节推演 JSON 提取角色名称列表（用于工作区环节卡片标题栏）。
   * @param {Object|null|undefined} stepJson - 单环节对象（含 roles 数组）。
   * @returns {string[]} 角色显示名，缺名时用「角色 1」「角色 2」…
   */
  function extractRoleNameLabelsFromStepJson(stepJson) {
    if (!stepJson || typeof stepJson !== 'object') return [];
    const roles = Array.isArray(stepJson.roles) ? stepJson.roles : [];
    return roles.map((r, idx) => {
      if (!r || typeof r !== 'object') return `角色 ${idx + 1}`;
      const n = String(r.role_name ?? r.roleName ?? '').trim();
      return n || `角色 ${idx + 1}`;
    });
  }

  /**
   * 环节标题栏：✅ + 角色名以「 ｜ 」连接（新 RBAC 单环节结构）。
   * @param {Object|null|undefined} stepJson
   * @returns {string} 空字符串表示尚无推演数据
   */
  function buildRolePermissionStepHeaderDeducedHtml(stepJson) {
    const labels = extractRoleNameLabelsFromStepJson(stepJson);
    if (labels.length === 0) return '';
    const text = labels.join(' ｜ ');
    /* 与环节名同为 title-row 的直接子节点，便于 CSS Grid 三列对齐各卡 ✅ */
    return `<span class="problem-detail-rp-step-check" aria-hidden="true">✅</span><span class="problem-detail-rp-step-roles">${escapeHtml(text)}</span>`;
  }

  /**
   * 旧版表格结构：执行者/审批者/知情者非空则生成标题栏状态 HTML。
   * @param {Object|null|undefined} match - 含 roles.executor 等
   * @returns {string}
   */
  function buildLegacyRolePermissionHeaderDeducedHtml(match) {
    if (!match || typeof match !== 'object') return '';
    const roles = match.roles || {};
    const parts = [roles.executor, roles.approver, roles.informer]
      .map((x) => (x != null ? String(x).trim() : ''))
      .filter(Boolean);
    if (parts.length === 0) return '';
    const text = parts.join(' ｜ ');
    return `<span class="problem-detail-rp-step-check" aria-hidden="true">✅</span><span class="problem-detail-rp-step-roles">${escapeHtml(text)}</span>`;
  }

  /**
   * 构建单环节角色权限 view 视图 HTML。
   * @param {Object} match - 单环节角色权限数据。
   * @returns {string} HTML 片段。
   */
  function buildRolePermissionStepViewHtml(match) {
    if (!match || typeof match !== 'object') return '';
    const roles = Array.isArray(match.roles) ? match.roles : [];
    if (roles.length === 0) return '<div class="problem-detail-role-permission-placeholder">该环节暂无角色数据</div>';
    const roleCards = roles.map((r) => {
      if (!r || typeof r !== 'object') return '';
      const roleName = r.role_name ?? r.roleName ?? '未命名角色';
      const funcDesc = getRoleFunctionalDescription(r);
      const funcDescHtml = `<div class="problem-detail-role-card-section"><div class="problem-detail-role-card-section-title">职能描述</div>${formatRolePermissionField(funcDesc || null)}</div>`;
      const legacyOp = formatRolePermissionField(r.legacy_operation ?? r.legacyOperation);
      const newPerms = buildNewPermissionsSubcardsHtml(r.new_it_permissions ?? r.newItPermissions ?? r.new_it_permission);
      const painSolution = buildPainPointSolutionSubcardsHtml(r.pain_point_solution ?? r.painPointSolution ?? r.pain_point_solutions);
      const triggerLogic = r.trigger_logic ?? r.triggerLogic;
      const triggerHtml = triggerLogic != null && String(triggerLogic).trim() ? `<div class="problem-detail-role-card-section"><div class="problem-detail-role-card-section-title">触发逻辑</div>${formatRolePermissionField(triggerLogic)}</div>` : '';
      return `
    <div class="problem-detail-role-card">
      <div class="problem-detail-role-card-header problem-detail-role-card-header-collapsed" tabindex="0" role="button" aria-expanded="false">
        <span class="problem-detail-role-card-header-icon" aria-hidden="true">👤</span>
        <span class="problem-detail-role-card-header-title">${escapeHtml(roleName)}</span>
        <span class="problem-detail-role-card-header-arrow">▾</span>
      </div>
      <div class="problem-detail-role-card-body" hidden>
      <div class="problem-detail-role-card-sections">
        ${funcDescHtml}
        <div class="problem-detail-role-card-section"><div class="problem-detail-role-card-section-title">过去操作</div>${legacyOp}</div>
        <div class="problem-detail-role-card-section"><div class="problem-detail-role-card-section-title">新的权限</div>${newPerms}</div>
        <div class="problem-detail-role-card-section"><div class="problem-detail-role-card-section-title">痛点解决方案</div>${painSolution}</div>
        ${triggerHtml}
      </div>
      </div>
    </div>`;
    }).filter(Boolean).join('');
    return `<div class="problem-detail-role-permission-view-roles">${roleCards}</div>`;
  }

  /**
   * 构建角色权限节点卡片 HTML（兼容新旧数据结构）。
   * @param {Array<Object>} model - 角色权限模型数组。
   * @returns {string} 卡片 HTML。
   */
  function buildRolePermissionNodeCardsHtml(model) {
    if (!Array.isArray(model) || model.length === 0) return '';
    const isNewFormat = model[0] && typeof model[0] === 'object' && Array.isArray(model[0].roles) && (model[0].step_name != null || model[0].step_id != null || model[0].stage_name != null || model[0].stage_id != null);
    if (isNewFormat) {
      return `<div class="problem-detail-role-permission-step-list">
      <div class="problem-detail-role-permission-list-title">环节列表</div>${model
      .map((item) => {
        const stepName = item.stage_name != null && item.step_name != null
          ? `${item.stage_name} － ${item.step_name}`
          : (item.step_name || item.stage_name || [item.step_id, item.stage_id].filter(Boolean).join(' ') || '环节');
        const viewHtml = buildRolePermissionStepViewHtml(item);
        const jsonStr = JSON.stringify(item, null, 2);
        const headerStatusHtml = buildRolePermissionStepHeaderDeducedHtml(item);
        return `
      <div class="problem-detail-card problem-detail-card-role-permission">
        <div class="problem-detail-card-header problem-detail-card-header-collapsed" tabindex="0" role="button" aria-expanded="false">
          <span class="problem-detail-card-header-title-row">
            <span class="problem-detail-card-header-title">${escapeHtml(stepName)}</span>
            ${headerStatusHtml}
          </span>
          <span class="problem-detail-card-header-arrow">▾</span>
        </div>
        <div class="problem-detail-card-body" hidden>
          <div class="problem-detail-role-permission-tabs">
            <span class="problem-detail-role-permission-tabs-title">角色与权限模型推演</span>
            <button type="button" class="problem-detail-role-permission-tab problem-detail-role-permission-tab-active" data-tab="view">view</button>
            <button type="button" class="problem-detail-role-permission-tab" data-tab="json">json</button>
          </div>
          <div class="problem-detail-role-permission-panel problem-detail-role-permission-panel-view" data-panel="view">${viewHtml}</div>
          <div class="problem-detail-role-permission-panel problem-detail-role-permission-panel-json" data-panel="json" hidden><pre class="problem-detail-role-permission-json">${escapeHtml(jsonStr)}</pre></div>
        </div>
      </div>`;
      })
      .join('')}</div>`;
    }
    return model
      .map((m) => {
        const nodeName = m.node || '';
        if (!nodeName) return '';
        const roles = m.roles || { executor: '', approver: '', informer: '' };
        const perms = m.perms || { wechat: '', lowcode: '', notify: '', query: '' };
        const duty = m.duty || '';
        const legacyHeaderStatus = buildLegacyRolePermissionHeaderDeducedHtml(m);
        return `
      <div class="problem-detail-card problem-detail-card-role-permission">
        <div class="problem-detail-card-header" tabindex="0" role="button" aria-expanded="false">
          <span class="problem-detail-card-header-title-row">
            <span class="problem-detail-card-header-title">环节：${escapeHtml(nodeName)}</span>
            ${legacyHeaderStatus}
          </span>
          <span class="problem-detail-card-header-arrow">▾</span>
        </div>
        <div class="problem-detail-card-body" hidden>
          <div class="problem-detail-role-permission-grid">
            <div class="problem-detail-role-permission-subcard">
              <div class="problem-detail-role-permission-subtitle">环节名称</div>
              <div class="problem-detail-role-permission-text">${escapeHtml(nodeName)}</div>
            </div>
            <div class="problem-detail-role-permission-subcard">
              <div class="problem-detail-role-permission-subtitle">角色设计</div>
              <div class="problem-detail-role-permission-text">
                <div>执行者：${escapeHtml(roles.executor || '—')}</div>
                <div>审批者：${escapeHtml(roles.approver || '—')}</div>
                <div>知情者：${escapeHtml(roles.informer || '—')}</div>
              </div>
            </div>
            <div class="problem-detail-role-permission-subcard">
              <div class="problem-detail-role-permission-subtitle">企微端</div>
              <div class="problem-detail-role-permission-text">${escapeHtml(perms.wechat || '—')}</div>
            </div>
            <div class="problem-detail-role-permission-subcard">
              <div class="problem-detail-role-permission-subtitle">低代码</div>
              <div class="problem-detail-role-permission-text">${escapeHtml(perms.lowcode || '—')}</div>
            </div>
            <div class="problem-detail-role-permission-subcard">
              <div class="problem-detail-role-permission-subtitle">接收通知</div>
              <div class="problem-detail-role-permission-text">${escapeHtml(perms.notify || '—')}</div>
            </div>
            <div class="problem-detail-role-permission-subcard">
              <div class="problem-detail-role-permission-subtitle">查询数据</div>
              <div class="problem-detail-role-permission-text">${escapeHtml(perms.query || '—')}</div>
            </div>
          </div>
          ${
            duty
              ? `<div class="problem-detail-role-permission-duty"><span class="problem-detail-role-permission-subtitle">核心职责</span><div class="problem-detail-role-permission-text">${escapeHtml(
                  duty
                )}</div></div>`
              : ''
          }
        </div>
      </div>`;
      })
      .join('');
  }

  /** 规范化角色名（用于匹配，不用于展示替换） */
  function normalizeRoleRegistryName(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  /** 从单条角色对象取职能描述（兼容 snake/camel/中文键） */
  function getRoleFunctionalDescription(r) {
    if (!r || typeof r !== 'object') return '';
    const v = r.functional_description ?? r.functionalDescription ?? r['职能描述'];
    if (v == null) return '';
    return String(v).trim();
  }

  /** 由分环节职能条目合成单行串（供 LLM / json 兜底） */
  function synthesizeFunctionalDescriptionFromItems(items) {
    const list = Array.isArray(items) ? items.filter((it) => it && String(it.text || '').trim()) : [];
    return list
      .map((it) => {
        const t = String(it.text).trim();
        const sl = normalizeRoleRegistryName(it.stepLabel ?? it.step_label ?? '');
        if (!t) return '';
        return sl ? `【${sl}】${t}` : t;
      })
      .filter(Boolean)
      .join('\n\n');
  }

  /** 从清单项恢复「分环节职能描述」数组（兼容仅 functionalDescription 旧数据） */
  function cloneRegistryFunctionalItems(r) {
    const raw = r.functionalDescriptionItems ?? r.functional_description_items;
    if (Array.isArray(raw) && raw.length) {
      return raw
        .map((it) => ({
          stepLabel: normalizeRoleRegistryName(it.stepLabel ?? it.step_label ?? ''),
          text: String(it.text ?? '').trim(),
        }))
        .filter((it) => it.text);
    }
    const single = String(r.functionalDescription ?? r.functional_description ?? '').trim();
    if (single) return [{ stepLabel: '', text: single }];
    return [];
  }

  /**
   * 将本环节 roles 合并进累计角色清单（按规范名去重，关联环节追加到 linkedSteps）
   * 同一角色在不同环节可有不同职能描述：写入 functionalDescriptionItems，按环节键更新或追加；界面以列表展示多条。
   * @param {Array<{roleName?: string, role_name?: string, linkedSteps?: string[], linked_steps?: string[], functionalDescription?: string, functional_description?: string, functionalDescriptionItems?: Array<{stepLabel?: string, text?: string}>}>} registry
   * @param {string} stepDisplayLabel - 如「阶段－环节」
   * @param {Array<Object>} rolesArray - 单环节 JSON 的 roles 数组
   */
  function mergeRolePermissionRegistryItem(registry, stepDisplayLabel, rolesArray) {
    const reg = Array.isArray(registry)
      ? registry.map((r) => {
          const items = cloneRegistryFunctionalItems(r);
          return {
            roleName: normalizeRoleRegistryName(r.roleName ?? r.role_name) || '未命名',
            linkedSteps: [...(Array.isArray(r.linkedSteps) ? r.linkedSteps : Array.isArray(r.linked_steps) ? r.linked_steps : [])],
            functionalDescriptionItems: items,
            functionalDescription: synthesizeFunctionalDescriptionFromItems(items),
          };
        })
      : [];
    const stepN = normalizeRoleRegistryName(stepDisplayLabel);
    const list = Array.isArray(rolesArray) ? rolesArray : [];

    const findEntryForName = (nameRaw) => {
      const n = normalizeRoleRegistryName(nameRaw);
      if (!n) return null;
      let hit = reg.find((x) => normalizeRoleRegistryName(x.roleName) === n);
      if (hit) return hit;
      return (
        reg.find((x) => {
          const xn = normalizeRoleRegistryName(x.roleName);
          if (xn.length < 2 || n.length < 2) return false;
          return xn === n || xn.includes(n) || n.includes(xn);
        }) || null
      );
    };

    for (const r of list) {
      if (!r || typeof r !== 'object') continue;
      const nameRaw = r.role_name ?? r.roleName ?? '';
      const n = normalizeRoleRegistryName(nameRaw);
      if (!n) continue;
      const desc = getRoleFunctionalDescription(r);
      const existing = findEntryForName(n);
      if (existing) {
        if (stepN && !existing.linkedSteps.includes(stepN)) existing.linkedSteps.push(stepN);
        if (desc) {
          let items = Array.isArray(existing.functionalDescriptionItems)
            ? existing.functionalDescriptionItems.map((it) => ({
                stepLabel: normalizeRoleRegistryName(it.stepLabel ?? it.step_label ?? ''),
                text: String(it.text || '').trim(),
              }))
            : [];
          if (!items.length && String(existing.functionalDescription || '').trim()) {
            items = [{ stepLabel: '', text: String(existing.functionalDescription).trim() }];
          }
          const stepKey = stepN;
          const idx = items.findIndex((it) => normalizeRoleRegistryName(it.stepLabel) === stepKey);
          const labelForRow = stepKey || '—';
          if (idx >= 0) {
            items[idx] = { stepLabel: labelForRow, text: desc };
          } else {
            items.push({ stepLabel: labelForRow, text: desc });
          }
          existing.functionalDescriptionItems = items.filter((it) => it.text);
          existing.functionalDescription = synthesizeFunctionalDescriptionFromItems(existing.functionalDescriptionItems);
        }
      } else {
        reg.push({
          roleName: n,
          linkedSteps: stepN ? [stepN] : [],
          functionalDescription: desc,
          functionalDescriptionItems: desc ? [{ stepLabel: stepN || '—', text: desc }] : [],
        });
      }
    }
    return reg;
  }

  /**
   * 从已保存的各环节 rolePermissionJson 重建清单（无持久化 registry 时的展示/兼容）
   */
  function rebuildRolePermissionRegistryFromSessions(item) {
    const sessions = item?.rolePermissionSessions || [];
    let registry = [];
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      if (!s?.rolePermissionJson) continue;
      let obj = s.rolePermissionJson;
      if (typeof obj === 'string') {
        try {
          obj = JSON.parse(obj);
        } catch (_) {
          continue;
        }
      }
      if (!obj || typeof obj !== 'object') continue;
      const roles = Array.isArray(obj.roles) ? obj.roles : [];
      const st = String(s.stageName || '').trim();
      const sp = String(s.stepName || '').trim();
      const stepLabel = st && sp ? `${st}－${sp}` : (sp || `环节${i + 1}`);
      registry = mergeRolePermissionRegistryItem(registry, stepLabel, roles);
    }
    return registry;
  }

  /** 优先用持久化清单；为空则从 session 重建（仅用于展示与提示词组装） */
  function getRolePermissionRegistryForDisplay(item) {
    const stored = item?.rolePermissionRoleRegistry;
    if (Array.isArray(stored) && stored.length > 0) return stored;
    if (item) {
      const rebuilt = rebuildRolePermissionRegistryFromSessions(item);
      if (rebuilt.length > 0) return rebuilt;
    }
    return [];
  }

  /**
   * 累计角色清单序列化为 LLM 用户消息中的 JSON 字符串（role_name + linked_steps + functional_description）
   * @param {Object} item - 当前问题单
   * @returns {string}
   */
  function serializeRolePermissionRegistryForLlmPrompt(item) {
    const reg = getRolePermissionRegistryForDisplay(item);
    if (!Array.isArray(reg) || reg.length === 0) return '[]';
    const rows = reg.map((entry) => {
      const role_name = normalizeRoleRegistryName(entry.roleName ?? entry.role_name) || '未命名';
      const linked_steps = Array.isArray(entry.linkedSteps)
        ? entry.linkedSteps
        : Array.isArray(entry.linked_steps)
          ? entry.linked_steps
          : [];
      const fItems = Array.isArray(entry.functionalDescriptionItems) ? entry.functionalDescriptionItems : [];
      let functional_description = '';
      if (fItems.length) {
        functional_description = fItems
          .map((it) => {
            const t = String(it.text || '').trim();
            const sl = normalizeRoleRegistryName(it.stepLabel ?? it.step_label ?? '');
            return t ? (sl ? `${sl}：${t}` : t) : '';
          })
          .filter(Boolean)
          .join('\n');
      } else {
        functional_description = String(entry.functionalDescription ?? entry.functional_description ?? '').trim();
      }
      return { role_name, linked_steps, functional_description };
    });
    return JSON.stringify(rows, null, 2);
  }

  /**
   * 工作区顶部「角色清单」：横向子卡片（角色名 + 职能描述标题带环节数（n）；不展示关联环节 FE-20260329-registry-hide-steps）
   * @param {Array<{roleName?: string, role_name?: string, linkedSteps?: string[], linked_steps?: string[]}>} registry
   */
  function buildRolePermissionRegistryCardHtml(registry) {
    const reg = Array.isArray(registry) ? registry : [];
    const registryTabsHtml = `<div class="problem-detail-card-header-actions">
        <button type="button" class="problem-detail-card-tab problem-detail-card-tab-active" data-tab="detail" aria-pressed="true">view</button>
        <button type="button" class="problem-detail-card-tab" data-tab="json" aria-pressed="false">json</button>
      </div>`;
    const jsonPlain = JSON.stringify(reg, null, 2);
    const jsonStr = escapeHtml(jsonPlain);
    if (reg.length === 0) {
      return `<div class="problem-detail-card problem-detail-card-role-registry">
      <div class="problem-detail-card-header" tabindex="0" role="button" aria-expanded="true">
        <span class="problem-detail-card-header-title">角色清单</span>
        ${registryTabsHtml}
        <span class="problem-detail-card-header-arrow">▾</span>
      </div>
      <div class="problem-detail-card-body">
        <div class="problem-detail-card-body-detail">
          <p class="problem-detail-role-registry-empty">随环节推演逐步累积；完成至少一个环节的推演并保存后，将在此横向展示全部角色及职能描述。</p>
        </div>
        <div class="problem-detail-card-body-json" hidden><pre class="problem-detail-card-json-pre">${jsonStr}</pre></div>
      </div>
    </div>`;
    }
    const chips = reg
      .map((r) => {
        const name = escapeHtml(normalizeRoleRegistryName(r.roleName ?? r.role_name) || '未命名');
        const funcItems = Array.isArray(r.functionalDescriptionItems)
          ? r.functionalDescriptionItems.filter((it) => it && String(it.text || '').trim())
          : [];
        const linkedArr = Array.isArray(r.linkedSteps) ? r.linkedSteps : Array.isArray(r.linked_steps) ? r.linked_steps : [];
        const linkedCount = linkedArr.filter((s) => String(s).trim()).length;
        let stepFuncCount = 0;
        if (funcItems.length > 0 && linkedCount > 0) {
          stepFuncCount = Math.max(funcItems.length, linkedCount);
        } else if (funcItems.length > 0) {
          stepFuncCount = funcItems.length;
        } else if (linkedCount > 0) {
          stepFuncCount = linkedCount;
        } else {
          const funcRawOnly = String(r.functionalDescription ?? r.functional_description ?? '').trim();
          stepFuncCount = funcRawOnly ? 1 : 0;
        }
        const funcCountHtml =
          stepFuncCount > 0
            ? `<span class="problem-detail-role-registry-func-count" aria-label="涉及 ${stepFuncCount} 个环节的职能">（${stepFuncCount}）</span>`
            : '';
        let funcBody;
        if (funcItems.length > 1) {
          funcBody = `<ul class="problem-detail-role-registry-func-list">${funcItems
            .map((it) => {
              const t = String(it.text).trim();
              const sl = normalizeRoleRegistryName(it.stepLabel ?? it.step_label ?? '');
              const stepHtml = sl
                ? `<span class="problem-detail-role-registry-func-step">${escapeHtml(sl)}</span>`
                : '';
              return `<li class="problem-detail-role-registry-func-li">${stepHtml}<div class="problem-detail-role-registry-func-li-body markdown-body">${renderMarkdown(t)}</div></li>`;
            })
            .join('')}</ul>`;
        } else if (funcItems.length === 1) {
          const it0 = funcItems[0];
          const sl0 = normalizeRoleRegistryName(it0.stepLabel ?? it0.step_label ?? '');
          const stepLine =
            sl0 && sl0 !== '—'
              ? `<div class="problem-detail-role-registry-func-step problem-detail-role-registry-func-step--single">${escapeHtml(sl0)}</div>`
              : '';
          funcBody = `${stepLine}<div class="problem-detail-role-registry-func-body markdown-body">${renderMarkdown(it0.text)}</div>`;
        } else {
          const funcRaw = String(r.functionalDescription ?? r.functional_description ?? '').trim();
          funcBody = funcRaw
            ? `<div class="problem-detail-role-registry-func-body markdown-body">${renderMarkdown(funcRaw)}</div>`
            : '<span class="problem-detail-role-registry-func-empty">—</span>';
        }
        return `<div class="problem-detail-role-registry-chip" tabindex="0" role="group" aria-label="${name}">
      <div class="problem-detail-role-registry-chip-name">${name}</div>
      <div class="problem-detail-role-registry-chip-func"><span class="problem-detail-role-registry-func-label">职能描述${funcCountHtml}</span>${funcBody}</div>
    </div>`;
      })
      .join('');
    return `<div class="problem-detail-card problem-detail-card-role-registry">
      <div class="problem-detail-card-header" tabindex="0" role="button" aria-expanded="true">
        <span class="problem-detail-card-header-title">角色清单</span>
        ${registryTabsHtml}
        <span class="problem-detail-card-header-arrow">▾</span>
      </div>
      <div class="problem-detail-card-body">
        <div class="problem-detail-card-body-detail">
          <div class="problem-detail-role-registry-strip">${chips}</div>
        </div>
        <div class="problem-detail-card-body-json" hidden><pre class="problem-detail-card-json-pre">${jsonStr}</pre></div>
      </div>
    </div>`;
  }

  /** task10：用户「已全部确认」后调用的合规审计 system 提示词（含核心重构约束/反压缩、初步需求人员组织审计基准；输出严格 JSON：审计得分、缺陷清单、未覆盖动作告警） */
  const ROLE_PERMISSION_COMPLIANCE_AUDIT_SYSTEM = `# 角色设定
你是一位严谨的系统权限合规审计师。你基于以下 **[审计五项准则]** 对角色推演结果进行强制性逻辑校验。

# 审计五项准则 (Audit Principles)
1. **职能真空准则**：VSM 中的每一个关键动作（审批、指派、核算）必须有对应的角色认领。
2. **最小权限准则**：严禁出现「超级角色」，执行与审核必须分离（SoD）。
3. **决策链条准则**：涉及评估/判断的环节，必须有明确的「最终定案人」角色。
4. **命名唯一性准则**：角色名必须反映其在数字化系统中的真实身份（如：项目总监 vs 管理员）。
5. **权限粒度准则**：操作权限（创、看、改、审）必须与角色职能严格匹配。

# 任务要求
对比【端到端事务流json】与【 各环节角色权限推演 json合并】，仅输出不符合上述准则的缺陷及重构建议。

## 核心重构约束 (强制执行，防止角色塌陷)
为了确保系统的安全性和权责对等，在重构时必须遵守以下“反压缩”原则：

* **SoD 独立性原则**：严禁合并“执行者”与“审批者”。即便两个角色的查看权限相似，只要其中一个具备“终审权”或“一票否决权”，必须保留为独立角色。
* **物理部门隔离**：跨部门（如：销售部 vs 财务部）的角色严禁合并，必须体现组织架构的物理边界。
* **动作认领完整性**：VSM 价值流图中的每一个动作（Action）必须有明确的角色承接。严禁为了精简角色而导致某些动作在系统中“无人负责”。
* **角色数量底线**：根据业务复杂程度，合理的角色数量应维持在 4-7 个之间。如果重构后角色少于 3 个，请重新检查是否违反了“职责分离 (SoD)”准则。

## 初步需求人员组织基准（审计与重构指令适用）
若用户消息中提供了企业背景洞察→初步需求中的「人员组织模式」摘录（与「核心业务流程梳理」一并给出），且其中对企业角色有明确的类型、称谓或岗位定义，则审计各环节推演 JSON 及撰写「缺陷清单」「重构指令」时须遵守：

* **称谓与类型基准**：角色类型及称谓应以该「人员组织模式」定义为基准，不得无故更名、合并致使无法与初步需求中的角色一一对应。
* **允许增补支撑角色**：允许在重构建议中**额外增加**支撑性角色。
* **允许调整权限与职能**：允许对初步需求已列出角色的**权限配置**与**职能描述**提出修正或细化（须在「重构指令」中说明依据与目标状态）。
* **禁止删除人员角色**：**禁止**在重构结论中删除、吞并或省略初步需求已定义的人员角色，致使该角色在目标模型中不再存在或无法对应。

# 输出格式 (严格 JSON)
{
  "审计得分": "0-100",
  "缺陷清单": [
    {
      "违反准则": "准则名称（如：职能真空）",
      "涉及角色/环节": "名称",
      "问题描述": "基于准则的具体矛盾点",
      "重构指令": "给大模型的具体修正命令"
    }
  ],
  "未覆盖动作告警": ["VSM 中无角色认领的空白动作"]
}`;

  function buildRolePermissionMergedStepsJsonForAudit(rolePermissionSessions) {
    const sessions = Array.isArray(rolePermissionSessions) ? rolePermissionSessions : [];
    return sessions.map((s) => ({
      stepIndex: s.stepIndex,
      stepName: s.stepName,
      stageName: s.stageName,
      rolePermissionJson: s.rolePermissionJson != null ? s.rolePermissionJson : null,
    }));
  }

  function buildRolePermissionComplianceAuditUserPrompt(valueStream, mergedSteps, preliminaryOperationModelText) {
    const vsmJson = JSON.stringify(valueStream ?? {}, null, 2);
    const mergedJson = JSON.stringify(mergedSteps ?? [], null, 2);
    const prelim = preliminaryOperationModelText != null ? String(preliminaryOperationModelText).trim() : '';
    const parts = [];
    if (prelim) {
      parts.push(
        '【初步需求摘录｜供对照人员组织模式角色基准（若「人员组织模式」为空则无该项约束）】',
        prelim,
        '',
      );
    }
    parts.push(
      '【端到端事务流 json】',
      vsmJson,
      '',
      '【各环节角色权限推演 json合并】',
      mergedJson,
      '',
      '请严格只输出一个符合上述「输出格式」字段结构的 JSON 对象，不要 markdown 代码围栏，不要附加说明。',
    );
    return parts.join('\n');
  }

  /**
   * 全量环节确认后：对比 VSM 与各环节推演 JSON，输出合规审计结论（供过程日志 rolePermissionAuditLlmQueryBlock）。
   * @param {object} valueStream
   * @param {Array<{ stepIndex?: number, stepName?: string, stageName?: string, rolePermissionJson?: unknown }>} rolePermissionSessions
   * @param {object} [caseItem] - 当前问题单；非空时注入与推演相同的初步需求「核心业务流程梳理」「人员组织模式」摘录，供审计对照
   */
  async function generateRolePermissionComplianceAuditWithStrictPrompt(valueStream, rolePermissionSessions, caseItem) {
    const systemPrompt = ROLE_PERMISSION_COMPLIANCE_AUDIT_SYSTEM;
    const mergedSteps = buildRolePermissionMergedStepsJsonForAudit(rolePermissionSessions);
    const prelimText =
      caseItem && typeof buildPreliminaryOperationModelTextForRolePermission === 'function'
        ? buildPreliminaryOperationModelTextForRolePermission(caseItem)
        : '';
    const userPrompt = buildRolePermissionComplianceAuditUserPrompt(valueStream, mergedSteps, prelimText);
    const llmInputPrompt = `【系统】\n${systemPrompt}\n\n【用户】\n${userPrompt}`;
    const result = await fetchDeepSeekChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { taskTag: 'task10', maxOutputTokens: 8192, timeoutMs: 300_000 },
    );
    return { ...result, llmInputPrompt };
  }

  if (typeof global !== 'undefined') {
    global.generateRolePermissionSessions = generateRolePermissionSessions;
    global.generateRolePermissionForStep = generateRolePermissionForStep;
    global.parseRolePermissionModel = parseRolePermissionModel;
    global.buildRolePermissionNodeCardsHtml = buildRolePermissionNodeCardsHtml;
    global.buildRolePermissionStepViewHtml = buildRolePermissionStepViewHtml;
    global.extractRoleNameLabelsFromStepJson = extractRoleNameLabelsFromStepJson;
    global.buildRolePermissionStepHeaderDeducedHtml = buildRolePermissionStepHeaderDeducedHtml;
    global.buildLegacyRolePermissionHeaderDeducedHtml = buildLegacyRolePermissionHeaderDeducedHtml;
    global.mergeRolePermissionRegistryItem = mergeRolePermissionRegistryItem;
    global.rebuildRolePermissionRegistryFromSessions = rebuildRolePermissionRegistryFromSessions;
    global.getRolePermissionRegistryForDisplay = getRolePermissionRegistryForDisplay;
    global.buildRolePermissionRegistryCardHtml = buildRolePermissionRegistryCardHtml;
    global.serializeRolePermissionRegistryForLlmPrompt = serializeRolePermissionRegistryForLlmPrompt;
    global.generateRolePermissionComplianceAuditWithStrictPrompt = generateRolePermissionComplianceAuditWithStrictPrompt;
    global.buildPreliminaryOperationModelTextForRolePermission = buildPreliminaryOperationModelTextForRolePermission;
  }
})(typeof window !== 'undefined' ? window : this);
