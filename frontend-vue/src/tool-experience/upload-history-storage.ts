/**
 * [INPUT]: localStorage
 * [OUTPUT]: 工具经验页「上传历史」持久化读写
 * [POS]: 仅工具经验模块使用
 *
 * [PROTOCOL]: 行为或字段变更时同步更新 `src/tool-experience/AGENTS.md`
 */

export const TOOL_EXP_UPLOAD_HISTORY_KEY = 'toolExperience.uploadHistory.v1';

/** 单条上传/解析记录（按时间顺序：越早越靠前，与初步需求历史详情编号一致） */
export type ToolExpHistoryEntry = {
  id: string;
  createdAt: string;
  /** 本次上传原文摘要（页面内最多保留约 1.2 万字符以便滚动浏览与复制） */
  inputPreview: string;
  success: boolean;
  errorMessage?: string;
  /** 成功时的完整解析 JSON；过大或配额不足时可能未持久化 */
  result?: Record<string, unknown>;
};

const MAX_ENTRIES = 60;

export function loadUploadHistory(): ToolExpHistoryEntry[] {
  try {
    const raw = localStorage.getItem(TOOL_EXP_UPLOAD_HISTORY_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter(
      (x): x is ToolExpHistoryEntry =>
        x &&
        typeof x === 'object' &&
        typeof (x as ToolExpHistoryEntry).id === 'string' &&
        typeof (x as ToolExpHistoryEntry).createdAt === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * 写入历史；若超出配额则丢弃最旧条目直至写入成功。
 * @returns 实际落盘后的列表（可能与入参长度不一致）
 */
export function saveUploadHistory(entries: ToolExpHistoryEntry[]): ToolExpHistoryEntry[] {
  let list = entries.slice(-MAX_ENTRIES);
  while (list.length > 0) {
    try {
      localStorage.setItem(TOOL_EXP_UPLOAD_HISTORY_KEY, JSON.stringify(list));
      return list;
    } catch {
      list = list.slice(1);
    }
  }
  try {
    localStorage.removeItem(TOOL_EXP_UPLOAD_HISTORY_KEY);
  } catch {
    /* ignore */
  }
  return [];
}

export function formatUploadHistoryCode(serial: number): string {
  const n = Math.max(1, Math.floor(serial) || 1);
  return `UP-${String(n).padStart(3, '0')}`;
}
