/**
 * task9（现称对象状态机构建）：历史「流程、待办与决策中心」门户 LLM、解析与只读展示；旧版按环节 JSON 的结构化只读渲染（parse / buildStructuredHtml / Markdown）
 * 依赖：global.fetchDeepSeekChat (api.js)、global.escapeHtml、global.renderMarkdown (utils.js)
 *
 * [PROTOCOL]: `main.js` 已下线 task9 门户编排与工作区卡；本文件仍导出门户 LLM/解析/HTML 供历史或其它调用方。旧版 localItGapAnalysisCard 四维度仍用 LOCAL_ITGAP_STRUCTURED_SECTIONS。详 localItGap.md。
 */
(function (global) {
  const fetchDeepSeekChat = global.fetchDeepSeekChat;
  const escapeHtml = global.escapeHtml;
  const renderMarkdown = global.renderMarkdown;

  const LOCAL_ITGAP_STRUCTURED_SECTIONS = [
    { key: 'statusQuo', label: '现状透视 (Status Quo)', isPrimary: true },
    { key: 'itGap3DMap', label: 'IT Gap 三维映射表', isPrimary: true },
    { key: 'actionableRequirements', label: 'IT 转型建议 (Actionable Requirements)', isPrimary: true },
    { key: 'businessValuePrediction', label: '业务价值预测', isPrimary: true },
  ];

  /** task9：流程/待办/决策中心门户 — 系统提示词（BPM 流程架构师） */
  const ROLE_TASK_CENTER_BPM_SYSTEM_PROMPT = `# Role: BPM 流程架构师
# Task: 设计角色的【事/待办/通知】门户模块

## 1. 设计逻辑
遍历所有端到端事务流中的每个事务节点的 \`bpm_detailed_flow\`，提取该角色作为 \`actor\` 的【输入】节点与【决策】节点。

## 2. 输入数据
端到端事务流 json；

## 3. 核心维度
- **待办事项 (To-do)**: 必须完成的输入（如：补充签约资料）。
- **决策审批 (Approval)**: 针对 IT Gap 中需要人工介入的异常（如：N.3.6 结算异常退回）。
- **通知中心 (Notification)**: 系统自动执行（[执行]节点）后的反馈（如：所有权声明成功）。

## 4. 输出要求 (JSON)
{
  "role_name": "角色名",
  "task_center": [
    { "bpm_ref": "bpm.Txx.xxx", "task_type": "待办/审批/通知", "ui_trigger": "触发入口(如:弹窗/侧边栏)", "logic": "处理后的状态变更" }
  ]
}

只输出合法 JSON，不要 Markdown 围栏或其它说明文字。`;

  function buildRoleTaskCenterPortalUserContent(e2eTransactionFlowJson) {
    const raw =
      typeof e2eTransactionFlowJson === 'string'
        ? e2eTransactionFlowJson
        : JSON.stringify(e2eTransactionFlowJson || {}, null, 2);
    return `\`\`\`json\n${raw}\n\`\`\`\n\n请按上述要求输出 JSON。`;
  }

  /** 将模型返回解析为统一结构 { roles: [{ role_name, task_center }] } */
  function normalizeRoleTaskCenterPortalRoles(raw) {
    if (!raw || typeof raw !== 'object') return [];
    if (Array.isArray(raw)) return raw.filter((r) => r && typeof r === 'object');
    if (Array.isArray(raw.roles)) return raw.roles.filter((r) => r && typeof r === 'object');
    if (raw.role_name != null || Array.isArray(raw.task_center)) return [raw];
    return [];
  }

  function parseRoleTaskCenterPortalDesignFromContent(content) {
    if (!content || typeof content !== 'string') return null;
    const text = content.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const tryParse = (s) => {
      try {
        return JSON.parse(String(s).trim().replace(/^\uFEFF/, ''));
      } catch (_) {
        return null;
      }
    };
    let parsed = fence ? tryParse(fence[1]) : null;
    if (!parsed) {
      const brace = text.match(/\{[\s\S]*\}/);
      if (brace) parsed = tryParse(brace[0]);
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const roles = normalizeRoleTaskCenterPortalRoles(parsed);
    if (roles.length === 0) return null;
    return { roles };
  }

  async function generateRoleTaskCenterPortalDesign(e2eTransactionFlowJson) {
    const userContent = buildRoleTaskCenterPortalUserContent(e2eTransactionFlowJson);
    const fullInput = `[System]\n${ROLE_TASK_CENTER_BPM_SYSTEM_PROMPT}\n\n[User]\n${userContent}`;
    const { content, usage, model, durationMs } = await fetchDeepSeekChat(
      [
        { role: 'system', content: ROLE_TASK_CENTER_BPM_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      { taskTag: 'task9' },
    );
    return { content, usage, model, durationMs, fullInput };
  }

  /** 工作区 view：表格展示门户设计 */
  function buildRoleTaskCenterPortalWorkspaceHtml(portalData) {
    const roles = normalizeRoleTaskCenterPortalRoles(portalData);
    if (roles.length === 0) return '<p class="problem-detail-local-itgap-pending">暂无门户设计数据</p>';
    const blocks = roles.map((role) => {
      const name = (role.role_name != null && String(role.role_name).trim()) || '（未命名角色）';
      const tasks = Array.isArray(role.task_center) ? role.task_center : [];
      if (tasks.length === 0) {
        return `<div class="problem-detail-role-portal-role-block"><h4 class="problem-detail-role-portal-role-title">${escapeHtml(name)}</h4><p class="problem-detail-local-itgap-pending">无 task_center 条目</p></div>`;
      }
      const rows = tasks
        .map((t) => {
          const tr = t && typeof t === 'object' ? t : {};
          const bpmRef = tr.bpm_ref != null ? String(tr.bpm_ref) : '—';
          const taskType = tr.task_type != null ? String(tr.task_type) : '—';
          const uiTrigger = tr.ui_trigger != null ? String(tr.ui_trigger) : '—';
          const logic = tr.logic != null ? String(tr.logic) : '—';
          return `<tr><td>${escapeHtml(bpmRef)}</td><td>${escapeHtml(taskType)}</td><td>${escapeHtml(uiTrigger)}</td><td>${escapeHtml(logic)}</td></tr>`;
        })
        .join('');
      return `<div class="problem-detail-role-portal-role-block">
        <h4 class="problem-detail-role-portal-role-title">${escapeHtml(name)}</h4>
        <table class="problem-detail-role-portal-table">
          <thead><tr><th>bpm_ref</th><th>类型</th><th>触发入口</th><th>状态变更逻辑</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    });
    return `<div class="problem-detail-role-portal-view-wrap">${blocks.join('')}</div>`;
  }

  /** 端到端事务流是否含可供 BPM 遍历的明细流（用于门户设计前置校验） */
  function hasBpmDetailedFlowForRolePortal(e2eJson) {
    if (!e2eJson || typeof e2eJson !== 'object') return false;
    const checkFlow = (flow) => Array.isArray(flow) && flow.length > 0;
    if (checkFlow(e2eJson.bpm_detailed_flow)) return true;
    // task7 合并结果：bpm_detailed_flow 挂在各事务节点上（transaction_nodes），而非阶段根或整包根（与 renderE2eBpmTransactionFlowHTML 一致）
    const anyTxHasFlow = (nodes) => {
      if (!Array.isArray(nodes)) return false;
      for (const tx of nodes) {
        if (tx && typeof tx === 'object' && checkFlow(tx.bpm_detailed_flow)) return true;
      }
      return false;
    };
    if (anyTxHasFlow(e2eJson.transaction_nodes)) return true;
    const stages = e2eJson.stages;
    if (Array.isArray(stages)) {
      for (const s of stages) {
        if (!s || typeof s !== 'object') continue;
        if (checkFlow(s.bpm_detailed_flow)) return true;
        if (anyTxHasFlow(s.transaction_nodes)) return true;
      }
    }
    return false;
  }

  /** 去除内容开头与蓝色子标题重复的 markdown 小标题 */
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

  /** 从大模型返回内容中解析角色汇总设计单环节结果（支持 JSON 或 Markdown 分段）；仅供历史 localItGapAnalysisCard 只读展示 */
  function parseLocalItGapFromContent(content) {
    const result = { statusQuo: '', itGap3DMap: '', actionableRequirements: '', businessValuePrediction: '' };
    if (!content || typeof content !== 'string') return result;
    const text = content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed === 'object') {
          const keyMap = {
            statusQuo: ['statusQuo', 'status_quo', '现状透视'],
            itGap3DMap: ['itGap3DMap', 'it_gap_3d_map', 'itGap3dMap', 'IT Gap 三维映射表', 'it_gap_三维映射表'],
            actionableRequirements: ['actionableRequirements', 'actionable_requirements', 'IT 转型建议'],
            businessValuePrediction: ['businessValuePrediction', 'business_value_prediction', '业务价值预测'],
          };
          for (const [targetKey, aliases] of Object.entries(keyMap)) {
            for (const alias of aliases) {
              const val = parsed[alias];
              if (val != null && String(val).trim()) {
                result[targetKey] = String(val).trim();
                break;
              }
            }
          }
          if (Object.values(result).some((v) => v)) return result;
        }
      } catch (_) {}
    }
    const sectionHeaders = [
      { key: 'statusQuo', regex: /(?:^|\n)(?:#+\s*)?(?:1\.\s*)?现状透视\s*(?:\(Status Quo\))?\s*[:：]?\s*\n?/i },
      { key: 'itGap3DMap', regex: /(?:^|\n)(?:#+\s*)?(?:2\.\s*)?IT\s*Gap\s*三维映射表\s*[:：]?\s*\n?/i },
      { key: 'actionableRequirements', regex: /(?:^|\n)(?:#+\s*)?(?:3\.\s*)?IT\s*转型建议\s*(?:\(Actionable Requirements\))?\s*[:：]?\s*\n?/i },
      { key: 'businessValuePrediction', regex: /(?:^|\n)(?:#+\s*)?(?:4\.\s*)?业务价值预测\s*[:：]?\s*\n?/i },
    ];
    let lastIndex = -1;
    let lastKey = null;
    for (const { key, regex } of sectionHeaders) {
      const match = text.match(regex);
      if (match) {
        const start = match.index + match[0].length;
        if (lastKey && lastIndex >= 0) {
          const block = text.slice(lastIndex, match.index).trim();
          if (block) result[lastKey] = block;
        }
        lastIndex = start;
        lastKey = key;
      }
    }
    if (lastKey != null && lastIndex >= 0) {
      const block = text.slice(lastIndex).trim();
      if (block) result[lastKey] = block;
    }
    if (!Object.values(result).some((v) => v)) result.statusQuo = text;
    return result;
  }

  /**
   * 构建角色汇总设计结构化展示 HTML（四维度各自为嵌套子卡片，供工作区与聊天结果卡共用）。
   * @param {Object} analysis - 分析 JSON。
   * @returns {string} HTML 片段。
   */
  function buildLocalItGapStructuredHtml(analysis) {
    if (!analysis || typeof analysis !== 'object') return '<p>（暂无内容）</p>';
    const parts = [];
    for (const { key, label } of LOCAL_ITGAP_STRUCTURED_SECTIONS) {
      const val = analysis[key];
      let content = (val != null ? String(val).trim() : '') || '—';
      if (content !== '—') content = stripRedundantHeadingFromContent(content, label);
      const bodyInner = content === '—' ? '—' : renderMarkdown(content);
      parts.push(
        `<div class="problem-detail-local-itgap-nested-subcard" data-section-key="${escapeHtml(key)}">` +
          `<div class="problem-detail-local-itgap-nested-subcard-head">` +
          `<span class="problem-detail-local-itgap-nested-subcard-title">${escapeHtml(label)}</span>` +
          `</div>` +
          `<div class="problem-detail-local-itgap-nested-subcard-body markdown-body">${bodyInner}</div>` +
          `</div>`
      );
    }
    return `<div class="problem-detail-local-itgap-nested-subcards">${parts.join('')}</div>`;
  }

  /** 将角色汇总设计单环节 JSON 转为 Markdown 文本 */
  function buildLocalItGapMarkdown(analysis) {
    if (!analysis || typeof analysis !== 'object') return '';
    const parts = [];
    for (const { key, label } of LOCAL_ITGAP_STRUCTURED_SECTIONS) {
      const val = analysis[key];
      const content = (val != null ? String(val).trim() : '') || '';
      if (content) parts.push(`## ${label}\n\n${content}`);
    }
    return parts.join('\n\n');
  }

  const LOCAL_ITGAP_BANNER_ID = 'local-itgap-existing-banner';

  /** 将聊天容器滚动到指定 block 位置 */
  function scrollChatToBlock(container, blockEl) {
    if (!container || !blockEl) return;
    const blockTop = blockEl.offsetTop;
    const containerHeight = container.clientHeight;
    const blockHeight = blockEl.offsetHeight;
    container.scrollTop = Math.max(0, blockTop - Math.floor(containerHeight / 3));
  }

  /** 在聊天区顶部显示粘性提醒条，提示用户已存在角色汇总设计相关 block */
  function showLocalItGapExistingBlockBanner(container, blockEl) {
    if (!container || !blockEl) return;
    let banner = container.querySelector(`#${LOCAL_ITGAP_BANNER_ID}`);
    if (banner) return;
    banner = document.createElement('div');
    banner.id = LOCAL_ITGAP_BANNER_ID;
    banner.className = 'problem-detail-chat-local-itgap-banner';
    banner.innerHTML = `
    <span class="problem-detail-chat-local-itgap-banner-text">task9 session 已生成，请向下查看</span>
    <button type="button" class="btn-scroll-to-local-itgap-banner">滚动到</button>
  `;
    const scrollToBlock = () => {
      scrollChatToBlock(container, blockEl);
      banner.remove();
    };
    banner.querySelector('.btn-scroll-to-local-itgap-banner')?.addEventListener('click', scrollToBlock);
    container.insertBefore(banner, container.firstChild);
  }

  global.ROLE_TASK_CENTER_BPM_SYSTEM_PROMPT = ROLE_TASK_CENTER_BPM_SYSTEM_PROMPT;
  global.buildRoleTaskCenterPortalUserContent = buildRoleTaskCenterPortalUserContent;
  global.normalizeRoleTaskCenterPortalRoles = normalizeRoleTaskCenterPortalRoles;
  global.parseRoleTaskCenterPortalDesignFromContent = parseRoleTaskCenterPortalDesignFromContent;
  global.generateRoleTaskCenterPortalDesign = generateRoleTaskCenterPortalDesign;
  global.buildRoleTaskCenterPortalWorkspaceHtml = buildRoleTaskCenterPortalWorkspaceHtml;
  global.hasBpmDetailedFlowForRolePortal = hasBpmDetailedFlowForRolePortal;
  global.parseLocalItGapFromContent = parseLocalItGapFromContent;
  global.buildLocalItGapStructuredHtml = buildLocalItGapStructuredHtml;
  global.buildLocalItGapMarkdown = buildLocalItGapMarkdown;
  global.showLocalItGapExistingBlockBanner = showLocalItGapExistingBlockBanner;
  global.scrollChatToBlock = scrollChatToBlock;
  global.LOCAL_ITGAP_BANNER_ID = LOCAL_ITGAP_BANNER_ID;
  global.LOCAL_ITGAP_STRUCTURED_SECTIONS = LOCAL_ITGAP_STRUCTURED_SECTIONS;
})(typeof window !== 'undefined' ? window : this);
