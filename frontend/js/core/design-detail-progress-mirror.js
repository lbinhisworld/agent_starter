/**
 * [INPUT]: 全局 `FOLLOW_TASKS` / `ITGAP_HISTORY_TASKS` / `IT_STRATEGY_TASKS`（`js/config.js`）；聊天消息数组（与详情页持久化同源）
 * [OUTPUT]: 任务展示名解析、待确认块摘要文案、task1 启动确认后的聊天补丁、**task1 工商向**聊天镜像与门控辅助、进展行「需用户返回内容」蓝字/沙漏判定
 * [POS]: 详情页与设计详情页共用的**聊天消息只读**工具层；设计页编排 **不得** 用 `resolveTaskDisplayName`+全案「当前任务」驱动设计页任务线（由 Vue 侧 `designDetailLineState` / `design_mode_tasks.md` 自治）
 *
 * [PROTOCOL]: 变更 `taskStartNotification` 或 task1 确认后副作用时同步 `frontend/js/core/AGENTS.md` 与 `frontend-vue/src/design-detail/AGENTS.md`；Vue 设计详情页同名能力以 `frontend-vue/src/design-detail/designDetailProgressGovernance.ts` 为准并对照维护
 */

/** 与 `main.js::mapProblemTaskIdToBackendTaskId` 一致 */
export function mapFrontendTaskIdToBackendTaskId(taskId) {
  switch (String(taskId || '')) {
    case 'task7':
      return 'e2e-flow';
    case 'task8':
      return 'global-itgap';
    case 'task9':
      return 'local-itgap';
    default:
      return String(taskId || '');
  }
}

function allTaskLists() {
  const g = typeof globalThis !== 'undefined' ? globalThis : {};
  return [g.FOLLOW_TASKS, g.ITGAP_HISTORY_TASKS, g.IT_STRATEGY_TASKS].filter((x) => Array.isArray(x));
}

/** 与详情页 `task.name` / 消息 `taskName` 同源：优先消息字段，再查配置表 */
export function resolveTaskDisplayName(taskId, messageTaskName) {
  const tn = String(messageTaskName || '').trim();
  if (tn) return tn;
  const id = String(taskId || '');
  for (const list of allTaskLists()) {
    const row = list.find((t) => t && String(t.id) === id);
    if (row && row.name) return String(row.name);
  }
  return id || '当前任务';
}

/** 与 `problem-detail-chat.js` / `main.js` 对齐：id 优先于 createdAt */
export function getProblemDetailChatStorageKey(item) {
  if (!item || typeof item !== 'object') return '';
  const idStr = item.id != null && String(item.id).trim() !== '' ? String(item.id).trim() : '';
  const caStr =
    item.createdAt != null && String(item.createdAt).trim() !== ''
      ? String(item.createdAt).trim()
      : '';
  return idStr || caStr;
}

/** 与详情区 `.problem-detail-chat-msg-time` 常用格式一致（本地时间） */
export function formatChatTimestampForMessage() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 从聊天消息推导「过程进展」文案（与详情页待办块一致方向；仅摘要，不替代详情渲染）
 * @param {Array<Record<string, unknown>>} messages
 * @returns {string[]}
 */
/** 与 `main.js::TASK1_BASIC_INFO_KEYS` 一致，供设计页门控 */
const TASK1_BASIC_INFO_KEYS = [
  'company_name',
  'credit_code',
  'legal_representative',
  'established_date',
  'registered_capital',
  'business_scope',
  'core_qualifications',
  'official_website',
];

/** 与 `main.js::hasTask1BasicInfoFields` 对齐 */
export function hasTask1BasicInfoFields(basicInfo) {
  if (!basicInfo || typeof basicInfo !== 'object') return false;
  return TASK1_BASIC_INFO_KEYS.some((key) => {
    const value = basicInfo[key];
    return value != null && String(value).trim() !== '';
  });
}

/** 与 `main.js::looksLikeTask1BasicInfoInput` 对齐（设计页发送门控） */
export function looksLikeTask1BasicInfoInput(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const keywords = [
    '公司',
    '企业',
    '工商',
    '客户',
    '统一社会信用代码',
    '信用代码',
    '法人',
    '成立',
    '注册资本',
    '经营范围',
    '资质',
    '官网',
    'company',
    'credit code',
    'legal representative',
    'registered capital',
    'business scope',
  ];
  const hitCount = keywords.reduce((acc, kw) => acc + (raw.includes(kw) || lower.includes(kw) ? 1 : 0), 0);
  const hasStructuredPair = /[:：]/.test(raw) && /\n/.test(raw);
  const looksLikeRequirementOrRegulationDoc =
    hasStructuredPair && /(目的|规则|条款|需求|流程|学员|业务|所有权|管理|范围|章节|第\s*\d+)/.test(raw);
  if (looksLikeRequirementOrRegulationDoc) {
    return hitCount >= 3;
  }
  return hitCount >= 2 || (hasStructuredPair && hitCount >= 1);
}

function hasUnconfirmedBasicInfoCard(messages) {
  if (!Array.isArray(messages)) return false;
  return messages.some((m) => m && m.type === 'basicInfoCard' && !m.confirmed);
}

/**
 * task1 已确认启动且已下发「请提供企业基本工商信息」、尚未确认工商卡：此窗口内应优先展示「回复工商信息」口径，避免跨任务待确认摘要误跳到后续环节。
 */
export function isTask1BasicInfoReplyPhase(messages) {
  if (!Array.isArray(messages)) return false;
  const hasStart = messages.some(
    (m) => m && m.type === 'taskStartNotification' && String(m.taskId || '') === 'task1' && m.confirmed,
  );
  const hasGuide = messages.some(
    (m) => m && m.role === 'system' && typeof m.content === 'string' && m.content.includes('请提供企业基本工商信息'),
  );
  if (!hasStart || !hasGuide) return false;
  const card = messages.filter((m) => m && m.type === 'basicInfoCard');
  if (!card.length) return true;
  return card.some((m) => !m.confirmed);
}

/**
 * 设计详情页进展区单行是否属于「需用户返回内容/在聊天中补充输入」类提示（偏蓝字；与 collect* 及 designOnlyProgressTail 对齐）。
 * 纯进度摘要、任务开始通知、仅待详情页点确认块等不算此类（黑字）。
 * @param {string} line
 * @returns {boolean}
 */
export function designDetailProgressLineNeedsUserInput(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  if (t.includes('请反馈客户的基本需求')) return true;
  if (t.includes('请继续补充客户需求')) return true;
  if (t.includes('请回复工商信息')) return true;
  if (t.includes('请提供企业基本工商信息')) return true;
  return false;
}

function findLastSystemMessageIndexContaining(messages, needle) {
  if (!Array.isArray(messages)) return -1;
  const sub = String(needle || '');
  if (!sub) return -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === 'system' && typeof m.content === 'string' && m.content.includes(sub)) return i;
  }
  return -1;
}

function isTask1BasicInfoGuideBlockedBetween(messages, guideIdx, userIdx) {
  for (let g = guideIdx + 1; g < userIdx; g++) {
    const x = messages[g];
    const t = String(x?.type || '');
    if (t === 'preliminaryRequirementFollowupBlock') return true;
    if (
      x &&
      x.role === 'system' &&
      typeof x.content === 'string' &&
      (x.content.includes('请反馈客户的基本需求') || x.content.includes('请继续补充客户需求'))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 是否仍等待用户在「请提供企业基本工商信息」之后发出有效补充（与 collectTask1ChatProcessMirrorLines 去重逻辑一致）。
 * @param {Array<Record<string, unknown>>} messages
 * @returns {boolean}
 */
export function task1BasicInfoGuideStillAwaitingUserReply(messages) {
  if (!Array.isArray(messages)) return false;
  const guideIdx = findLastSystemMessageIndexContaining(messages, '请提供企业基本工商信息');
  if (guideIdx < 0) return false;
  for (let i = guideIdx + 1; i < messages.length; i++) {
    const m = messages[i];
    if (m && m.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
      if (!isTask1BasicInfoGuideBlockedBetween(messages, guideIdx, i)) return false;
    }
  }
  return true;
}

/**
 * 进展区行尾旋转沙漏：仅「需返回内容」类行且仍处等待态时显示；用户已满足对应条件后为 false。
 * @param {string} line
 * @param {Array<Record<string, unknown>>} messages
 * @param {{ preliminaryFollowupActive?: boolean }} [opts]
 * @returns {boolean}
 */
export function designDetailProgressLineShowAwaitingContentSpinner(line, messages, opts) {
  if (!designDetailProgressLineNeedsUserInput(line)) return false;
  const t = String(line || '').trim();
  const msgs = Array.isArray(messages) ? messages : [];

  if (t.includes('请提供企业基本工商信息')) {
    return task1BasicInfoGuideStillAwaitingUserReply(msgs);
  }
  if (t.includes('请回复工商信息')) {
    return hasUnconfirmedBasicInfoCard(msgs);
  }
  if (t.includes('请反馈客户的基本需求')) {
    return hasUnconfirmedBasicInfoCard(msgs);
  }
  if (t.includes('请继续补充客户需求')) {
    return !!opts?.preliminaryFollowupActive;
  }
  return false;
}

export function collectPendingInteractiveBlockLines(messages, opts) {
  if (!Array.isArray(messages)) return [];
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  const push = (s) => {
    const t = String(s || '').trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  const focus = String(opts?.focusTaskId || '');
  const suppressCrossTask =
    focus === 'task1' && isTask1BasicInfoReplyPhase(messages);

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== 'object') continue;
    const type = String(m.type || '');
    if (suppressCrossTask) {
      if (type === 'taskCompletionConfirmBlock' && String(m.taskId || '') !== 'task1') continue;
      if (type === 'modificationIntentConfirmBlock') continue;
      if (type === 'modificationNewPromptConfirmBlock') continue;
      if (type === 'llmResumeIntentBlock') continue;
    }
    if (type === 'taskStartNotification' && m.taskId && !m.confirmed) {
      const name = resolveTaskDisplayName(m.taskId, m.taskName);
      push(`【自动确认开始】任务开始：${name}（与详情页「确认」一致；设计页可代为点「确认启动」）`);
    } else if (type === 'taskCompletionConfirmBlock' && m.taskId && !m.confirmed && !m.userChoseModify) {
      const name = resolveTaskDisplayName(m.taskId, m.taskName);
      push(`【自动确认开始】${name}：是否视为完成？请在案例详情聊天区操作。`);
    } else if (type === 'llmResumeIntentBlock' && !m.confirmed) {
      push('【自动确认开始】大模型恢复意图块：请在案例详情聊天区确认后继续。');
    } else if (type === 'basicInfoCard' && !m.confirmed) {
      push('【自动确认开始】请回复工商信息：请在案例详情页聊天区确认或修改「客户基本信息」卡片。');
    } else if (type === 'modificationIntentConfirmBlock' && !m.confirmed) {
      push('【自动确认开始】修改意图提炼结果：请在案例详情聊天区确认。');
    } else if (type === 'modificationNewPromptConfirmBlock' && m.taskId && !m.confirmed) {
      const name = resolveTaskDisplayName(m.taskId, m.taskName);
      push(`【自动确认开始】${name}：按新提示词执行前确认。`);
    }
  }
  return out;
}

/**
 * 从同源聊天推导 task1 工商阶段「进度过程」摘要行（与详情聊天顺序一致方向；不含 LLM 正文，正文见 extractTask1BasicInfoLlmBodyForDesignMirror）
 * @param {Array<Record<string, unknown>>} messages
 * @returns {string[]}
 */
export function collectTask1ChatProcessMirrorLines(messages) {
  if (!Array.isArray(messages) || !messages.length) return [];
  /** @type {string[]} */
  const lines = [];
  const seen = new Set();
  const push = (s) => {
    const t = String(s || '').trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    lines.push(t);
  };

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || typeof m !== 'object') continue;
    if (m.role === 'system' && typeof m.content === 'string' && m.content.includes('请提供企业基本工商信息')) {
      push('→ 系统：请提供企业基本工商信息');
    }
    if (m.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
      let guideIdx = -1;
      for (let g = 0; g < i; g++) {
        const x = messages[g];
        if (
          x &&
          x.role === 'system' &&
          typeof x.content === 'string' &&
          x.content.includes('请提供企业基本工商信息')
        ) {
          guideIdx = g;
        }
      }
      if (guideIdx >= 0) {
        let blocked = false;
        for (let g = guideIdx + 1; g < i; g++) {
          const x = messages[g];
          const t = String(x?.type || '');
          if (t === 'preliminaryRequirementFollowupBlock') {
            blocked = true;
            break;
          }
          if (
            x &&
            x.role === 'system' &&
            typeof x.content === 'string' &&
            (x.content.includes('请反馈客户的基本需求') || x.content.includes('请继续补充客户需求'))
          ) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          const snippet = String(m.content).trim().slice(0, 120);
          push(`→ 用户已补充工商信息（节选）：${snippet}${String(m.content).trim().length > 120 ? '…' : ''}`);
        }
      }
    }
    if (m.type === 'task1LlmQueryBlock' && String(m.noteName || '').includes('工商信息提炼')) {
      push('→ 工商信息提炼已完成（提炼正文见下方卡片）');
    }
    if (m.type === 'basicInfoCard' && !m.confirmed) {
      push('→ 已生成客户基本信息卡，请在详情页确认后再继续。');
    }
  }
  return lines;
}

/**
 * 设计页磨砂区：取与未确认 basicInfoCard 配对的上一条工商提炼 task1LlmQueryBlock 输出正文（仅展示，无按钮）
 * @param {Array<Record<string, unknown>>} messages
 * @returns {string}
 */
export function extractTask1BasicInfoLlmBodyForDesignMirror(messages) {
  if (!Array.isArray(messages) || !hasUnconfirmedBasicInfoCard(messages)) return '';
  let idx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.type === 'basicInfoCard' && !m.confirmed) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return '';
  for (let j = idx - 1; j >= 0; j--) {
    const m = messages[j];
    if (
      m &&
      m.type === 'task1LlmQueryBlock' &&
      String(m.taskId || '') === 'task1' &&
      String(m.noteName || '').includes('工商信息提炼')
    ) {
      const raw = typeof m.llmOutputRaw === 'string' ? m.llmOutputRaw.trim() : '';
      if (raw) return raw;
      try {
        return JSON.stringify(m.llmOutputJson ?? m.parsed ?? {}, null, 2);
      } catch {
        return '';
      }
    }
  }
  return '';
}

/**
 * 将 task1 任务启动标为已确认，并补齐与 `main.js` continueAfterTaskStartConfirmed(task1) 同向的引导语（不执行 pushTask1Preliminary 等 item 侧合并）
 * @param {Array<Record<string, unknown>>} messages
 * @returns {Array<Record<string, unknown>>}
 */
export function applyTask1StartConfirmToMessages(messages) {
  const msgs = Array.isArray(messages) ? messages.map((m) => (m && typeof m === 'object' ? { ...m } : m)) : [];
  let idx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.type === 'taskStartNotification' && String(msgs[i].taskId || '') === 'task1') {
      idx = i;
      break;
    }
  }
  if (idx < 0) return msgs;
  msgs[idx] = { ...msgs[idx], confirmed: true };
  const hasGuide = msgs.some(
    (m) =>
      m &&
      m.role === 'system' &&
      typeof m.content === 'string' &&
      m.content.includes('请提供企业基本工商信息'),
  );
  if (!hasGuide) {
    msgs.push({
      role: 'system',
      content: '请提供企业基本工商信息',
      timestamp: formatChatTimestampForMessage(),
    });
  }
  return msgs;
}
