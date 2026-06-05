/**
 * [INPUT]: 案例 `problem_detail_chats` 消息形态；在线 API 的 taskId 映射（与后端路径段一致）
 * [OUTPUT]: 设计详情页专用：存储键、task1 启动确认补丁、工商门控、`extractTask1BasicInfoLlmBody`（供程序从聊天取提炼正文，**不**绑定左侧独立 JSON 磨砂 UI）；**不**再提供全案任务展示名解析，也不再把主站 task1 引导语映射到任务动态行尾沙漏
 * [POS]: 设计详情 Vue 侧**唯一**进度/门控真源（不再依赖 `frontend/js/core/design-detail-progress-mirror.js`）
 *
 * [PROTOCOL]: task1 启动后写入聊天的引导语使用本文件 `DESIGN_DETAIL_TASK1_GUIDE_CONTENT`；与 `frontend/js/core/design-detail-progress-mirror.js` 在字面上可能不一致（主站详情仍用原引导语），属刻意分离
 */

/** task1 自动确认启动后写入聊天的引导（设计页专用，勿与主站「请提供企业基本工商信息」混用） */
export const DESIGN_DETAIL_TASK1_GUIDE_CONTENT =
  '【设计详情】请在下方输入区粘贴或描述客户工商及经营范围信息（本页将提炼并生成 BMC）。';

/** 与后端 `POST .../tasks/{taskId}/...` 路径段一致（非 UI「映射」） */
export function mapFrontendTaskIdToBackendTaskId(taskId: string): string {
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

/** id 优先于 createdAt */
export function getProblemDetailChatStorageKey(item: Record<string, unknown> | null | undefined): string {
  if (!item || typeof item !== 'object') return '';
  const idStr = item.id != null && String(item.id).trim() !== '' ? String(item.id).trim() : '';
  const caStr =
    item.createdAt != null && String(item.createdAt).trim() !== '' ? String(item.createdAt).trim() : '';
  return idStr || caStr;
}

export function formatChatTimestampForMessage(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const TASK1_BASIC_INFO_KEYS = [
  'company_name',
  'credit_code',
  'legal_representative',
  'established_date',
  'registered_capital',
  'business_scope',
  'core_qualifications',
  'official_website',
] as const;

export function hasTask1BasicInfoFields(basicInfo: Record<string, unknown> | undefined): boolean {
  if (!basicInfo || typeof basicInfo !== 'object') return false;
  return TASK1_BASIC_INFO_KEYS.some((key) => {
    const value = basicInfo[key];
    return value != null && String(value).trim() !== '';
  });
}

export function looksLikeTask1BasicInfoInput(text: string): boolean {
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

function hasUnconfirmedBasicInfoCard(messages: Array<Record<string, unknown>>): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.some((m) => m && m.type === 'basicInfoCard' && !(m as { confirmed?: boolean }).confirmed);
}

/** 设计页任务动态进度行：不再用主站 task1 引导短句驱动「待输入」蓝字样式 */
export function designDetailProgressLineNeedsUserInput(_line: string): boolean {
  return false;
}

/** 设计页任务动态行尾沙漏：已取消与主站初需/工商引导语联动 */
export function designDetailProgressLineShowAwaitingContentSpinner(
  _line: string,
  _messages: Array<Record<string, unknown>>,
  _opts?: { preliminaryFollowupActive?: boolean },
): boolean {
  return false;
}

/** 磨砂区：未确认 basicInfoCard 前，取上一条工商提炼正文 */
export function extractTask1BasicInfoLlmBody(messages: Array<Record<string, unknown>>): string {
  if (!Array.isArray(messages) || !hasUnconfirmedBasicInfoCard(messages)) return '';
  let idx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.type === 'basicInfoCard' && !(m as { confirmed?: boolean }).confirmed) {
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
      (String(m.noteName || '').includes('工商信息提炼') ||
        String(m.noteName || '').includes('设计详情经营信息提炼'))
    ) {
      const raw = typeof m.llmOutputRaw === 'string' ? String(m.llmOutputRaw).trim() : '';
      if (raw) return raw;
      try {
        return JSON.stringify((m as { llmOutputJson?: unknown; parsed?: unknown }).llmOutputJson ?? m.parsed ?? {}, null, 2);
      } catch {
        return '';
      }
    }
  }
  return '';
}

export function applyTask1StartConfirmToMessages(messages: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const msgs = Array.isArray(messages) ? messages.map((m) => (m && typeof m === 'object' ? { ...m } : m)) : [];
  let idx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.type === 'taskStartNotification' && String(msgs[i]?.taskId || '') === 'task1') {
      idx = i;
      break;
    }
  }
  if (idx < 0) return msgs as Array<Record<string, unknown>>;
  msgs[idx] = { ...(msgs[idx] as object), confirmed: true } as Record<string, unknown>;
  const hasGuide = msgs.some(
    (m) =>
      m &&
      m.role === 'system' &&
      typeof m.content === 'string' &&
      m.content.includes('【设计详情】'),
  );
  if (!hasGuide) {
    msgs.push({
      role: 'system',
      content: DESIGN_DETAIL_TASK1_GUIDE_CONTENT,
      timestamp: formatChatTimestampForMessage(),
    });
  }
  return msgs as Array<Record<string, unknown>>;
}
