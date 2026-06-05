/**
 * [INPUT]: `ProblemCase.id`（设计页 `caseId`）
 * [OUTPUT]: 任务 2 L1 对齐问卷**用户回复原文**的 `localStorage` 读写（与任务 3/4 之 `user_rectification` 口径一致）
 * [POS]: `POST …/sync-task2-l1-target-kv-tokens` 之 `alignmentUserReply`
 */

const STORAGE_KEY_PREFIX = 'smart_cto_design_detail_task2_l1_user_rectification_v1:';

export function readTask2L1UserRectificationText(caseId: string): string {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem(STORAGE_KEY_PREFIX + id) || '').trim();
  } catch {
    return '';
  }
}

export function writeTask2L1UserRectificationText(caseId: string, text: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    const t = String(text || '').trim();
    if (t) localStorage.setItem(STORAGE_KEY_PREFIX + id, t);
    else localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  } catch {
    /* ignore */
  }
}

export function clearTask2L1UserRectificationText(caseId: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  } catch {
    /* ignore */
  }
}
