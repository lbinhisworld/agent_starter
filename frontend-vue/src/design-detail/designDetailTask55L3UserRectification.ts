/**
 * [INPUT]: `ProblemCase.id`（设计页 `caseId`）
 * [OUTPUT]: 任务 5.5 L3.5 **用户对齐回复** 的浏览器本地持久化（`localStorage`）
 * [POS]: 设计页任务 5.5 对齐问卷用户回复（主推理 user 块已仅 Input 1，本段供 sync 元数据）
 *
 * [PROTOCOL]: 仅前端；变更键名时同步 `useDesignDetailChat.ts`；**完全重启**或锚点≥5.5 时清键
 */

const STORAGE_KEY_PREFIX = 'smart_cto_design_detail_task55_l3_user_rectification_v1:';

export function readTask55L3UserRectificationText(caseId: string): string {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem(STORAGE_KEY_PREFIX + id) || '').trim();
  } catch {
    return '';
  }
}

export function writeTask55L3UserRectificationText(caseId: string, text: string): void {
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

export function clearTask55L3UserRectificationText(caseId: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  } catch {
    /* ignore */
  }
}
