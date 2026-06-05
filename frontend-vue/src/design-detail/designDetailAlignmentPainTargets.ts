/**
 * [INPUT]: 对齐问卷冲突行 `targetFeatureId`
 * [OUTPUT]: 待写入 sync 的痛点确认目标列表（localStorage，对齐重跑 sync 时带上）
 */

import type { DesignDetailLineTaskId } from './designDetailLineState';
import type { Task2L1TvmParsedRow } from './designDetailTask2L1SyncUiProgress';
import { extractPainPointTargetFeatureIdsFromTvmRows } from './designDetailPainPointConfirmed';

function storageKey(caseId: string, lineTaskId: DesignDetailLineTaskId): string {
  return `smart_cto_dd_pain_targets_v1:${String(caseId || '').trim()}:${lineTaskId}`;
}

export function writeAlignmentPainPointTargetFeatureIds(
  caseId: string,
  lineTaskId: DesignDetailLineTaskId,
  rows: ReadonlyArray<Task2L1TvmParsedRow>,
): void {
  const cid = String(caseId || '').trim();
  if (!cid || typeof localStorage === 'undefined') return;
  const ids = extractPainPointTargetFeatureIdsFromTvmRows(rows);
  try {
    if (!ids.length) localStorage.removeItem(storageKey(cid, lineTaskId));
    else localStorage.setItem(storageKey(cid, lineTaskId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function readAlignmentPainPointTargetFeatureIds(
  caseId: string,
  lineTaskId: DesignDetailLineTaskId,
): string[] {
  const cid = String(caseId || '').trim();
  if (!cid || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(cid, lineTaskId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((id) => String(id || '').trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

export function clearAlignmentPainPointTargetFeatureIds(
  caseId: string,
  lineTaskId: DesignDetailLineTaskId,
): void {
  const cid = String(caseId || '').trim();
  if (!cid || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(cid, lineTaskId));
  } catch {
    /* ignore */
  }
}
