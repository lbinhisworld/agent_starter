/**
 * [INPUT]: 同源聊天 `messages[]`、任务动态卡 `lines[]`（完整 `full` 文案）
 * [OUTPUT]: 「聊天」Tab 时间线条目（用户右对齐 / 系统左对齐；含时间戳与复制正文）
 * [POS]: `DesignDetailPage` · `DesignDetailChatTimeline.vue`
 *
 * [PROTOCOL]: 系统可见口径变更时同步 `design_mode_ux.md` 与 `useDesignDetailChat.ts`
 */

import { formatTaskStartNotifyBody } from './designDetailTaskMirror';

export type DesignDetailChatTimelineRole = 'user' | 'system';

export type DesignDetailChatTimelineItem = {
  id: string;
  role: DesignDetailChatTimelineRole;
  body: string;
  /** 用于排序（毫秒）；同毫秒时以 `order` 稳定排序 */
  sortMs: number;
  order: number;
  timestampLabel: string;
};

const ALIGNMENT_QUESTIONNAIRE_KINDS = new Set([
  'task2_alignment_questionnaire_sub',
  'task3_alignment_questionnaire_sub',
  'task4_alignment_questionnaire_sub',
  'task5_alignment_questionnaire_sub',
  'task51_alignment_questionnaire_sub',
  'task55_alignment_questionnaire_sub',
  'task6_alignment_questionnaire_sub',
  'task65_alignment_questionnaire_sub',
]);

export type DesignDetailChatTimelineCardInput = {
  key: string;
  lineTaskId: string;
  startedAtMs: number;
  completedAtMs: number | null;
  lines: Array<{ id: number; full: string; kind: string }>;
};

/** 聊天 Tab 下允许展示的系统进度类型 */
export function isChatTimelineSystemLine(kind: string, full: string): boolean {
  const k = String(kind || '').trim();
  const text = String(full || '').trim();
  if (!text) return false;
  if (ALIGNMENT_QUESTIONNAIRE_KINDS.has(k)) return true;
  if (k === 'inference_conclusion_sub') return true;
  if (text.includes('我即将开始')) return true;
  if (text.includes('我已完成') && text.includes('耗时')) return true;
  return false;
}

export function parseChatTimestampToMs(raw: unknown): number | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function formatChatTimelineTimestampLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  try {
    const d = new Date(ms);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const se = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${da} ${h}:${mi}:${se}`;
  } catch {
    return '—';
  }
}

function lineSortMs(
  card: DesignDetailChatTimelineCardInput,
  line: { full: string; kind: string },
  lineIndex: number,
): number {
  const full = String(line.full || '').trim();
  const isComplete = full.includes('我已完成') && full.includes('耗时');
  if (isComplete && card.completedAtMs != null && Number.isFinite(card.completedAtMs)) {
    return card.completedAtMs;
  }
  const base = Number.isFinite(card.startedAtMs) ? card.startedAtMs : 0;
  return base + lineIndex;
}

/**
 * 合并聊天持久化消息与任务动态中的系统进度行，按时间排序。
 */
export function buildDesignDetailChatTimeline(
  messages: ReadonlyArray<Record<string, unknown>>,
  cards: ReadonlyArray<DesignDetailChatTimelineCardInput>,
): DesignDetailChatTimelineItem[] {
  const items: DesignDetailChatTimelineItem[] = [];
  let order = 0;

  const push = (item: Omit<DesignDetailChatTimelineItem, 'order'> & { order?: number }) => {
    items.push({
      ...item,
      order: item.order ?? order++,
    });
  };

  messages.forEach((m, msgIndex) => {
    if (!m || typeof m !== 'object') return;
    const tsRaw = (m as { timestamp?: unknown }).timestamp;
    const sortMs = parseChatTimestampToMs(tsRaw) ?? msgIndex * 1_000;

    if (m.type === 'taskStartNotification') {
      const taskName = String((m as { taskName?: unknown }).taskName || '').trim() || '任务';
      push({
        id: `msg-start-${msgIndex}`,
        role: 'system',
        body: formatTaskStartNotifyBody(taskName),
        sortMs,
        timestampLabel: formatChatTimelineTimestampLabel(sortMs),
      });
      return;
    }

    if (m.role === 'user') {
      const content = String((m as { content?: unknown }).content || '').trim();
      if (!content) return;
      push({
        id: `msg-user-${msgIndex}`,
        role: 'user',
        body: content,
        sortMs,
        timestampLabel: formatChatTimelineTimestampLabel(sortMs),
      });
    }
  });

  cards.forEach((card, cardIndex) => {
    card.lines.forEach((line, lineIndex) => {
      const kind = String(line.kind || '').trim();
      const full = String(line.full || '').trim();
      if (!isChatTimelineSystemLine(kind, full)) return;
      const sortMs = lineSortMs(card, line, lineIndex) + cardIndex;
      push({
        id: `dyn-${card.key}-${line.id}`,
        role: 'system',
        body: full,
        sortMs,
        timestampLabel: formatChatTimelineTimestampLabel(sortMs),
      });
    });
  });

  items.sort((a, b) => {
    if (a.sortMs !== b.sortMs) return a.sortMs - b.sortMs;
    return a.order - b.order;
  });

  return items;
}
