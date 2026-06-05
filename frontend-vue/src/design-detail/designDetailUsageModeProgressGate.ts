/**
 * [INPUT]: 任务动态卡行 reveal 状态、`designDetailExperienceMode` 可见性规则
 * [OUTPUT]: 使用模式下「上一任务展示完毕才显示下一任务卡」的判定与过滤
 * [POS]: `useDesignDetailChat.dynamicsCardsView` 与各 `runTask*` 流水线入口
 *
 * [PROTOCOL]: 变更时同步 `designDetailExperienceMode.ts`、`design_mode_ux.md` 与 `AGENTS.md`
 */

import {
  DESIGN_MODE_LINE_TASK_ORDER,
  type DesignDetailLineTaskId,
} from './designModeTaskPipeline';
import { isFeatureInferenceConclusionPushInProgress } from './designDetailFeatureInferenceConclusionProgress';
import {
  isDesignDetailDebugExperienceActive,
  isDesignDetailProgressLineVisibleForExperience,
} from './designDetailExperienceMode';

export type UsageModeProgressGateLine = {
  kind?: string;
  full?: string;
  cursor?: number;
};

export type UsageModeProgressGateCard = {
  lineTaskId: string;
  status: string;
  lines: ReadonlyArray<UsageModeProgressGateLine>;
};

function cpLen(s: string): number {
  return Array.from(s).length;
}

function lineTaskOrderIndex(lineTaskId: string): number {
  const id = lineTaskId as Exclude<DesignDetailLineTaskId, 'all_done'>;
  const i = DESIGN_MODE_LINE_TASK_ORDER.indexOf(id);
  return i >= 0 ? i : 9999;
}

/** 上一线步 id（`DESIGN_MODE_LINE_TASK_ORDER` 中紧邻前驱；首步返回 null） */
export function priorDesignLineTaskId(
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
): Exclude<DesignDetailLineTaskId, 'all_done'> | null {
  const i = DESIGN_MODE_LINE_TASK_ORDER.indexOf(lineTaskId);
  if (i <= 0) return null;
  return DESIGN_MODE_LINE_TASK_ORDER[i - 1]!;
}

/**
 * 使用模式下：该任务卡对用户可见内容是否已展示完毕（含推理结论逐码点）。
 * 调试模式恒 true（由调用方短路）。
 */
export function isUsageModeLineTaskDisplayCompleteForGate(
  card: UsageModeProgressGateCard | null | undefined,
): boolean {
  if (!card) return true;
  if (card.status === 'running') return false;

  for (const line of card.lines) {
    if (!isDesignDetailProgressLineVisibleForExperience({ kind: line.kind, full: line.full })) {
      continue;
    }
    const full = String(line.full ?? '');
    const cursor = typeof line.cursor === 'number' ? line.cursor : 0;
    if (cursor < cpLen(full)) return false;
  }

  if (isFeatureInferenceConclusionPushInProgress(card.lines)) return false;

  return true;
}

/** 按线步顺序过滤动态卡视图：前一张未展示完则截断后续卡 */
export function filterDynamicsCardViewsForUsageMode<T extends { key: string; lineTaskId: string }>(
  rawCards: ReadonlyArray<UsageModeProgressGateCard & { key: string }>,
  views: ReadonlyArray<T>,
): T[] {
  if (isDesignDetailDebugExperienceActive()) return [...views];

  const rawByKey = new Map(rawCards.map((c) => [c.key, c]));
  const sorted = [...views].sort(
    (a, b) => lineTaskOrderIndex(a.lineTaskId) - lineTaskOrderIndex(b.lineTaskId),
  );

  const out: T[] = [];
  for (const view of sorted) {
    if (out.length > 0) {
      const prevView = out[out.length - 1]!;
      const prevRaw = rawByKey.get(prevView.key);
      if (prevRaw && !isUsageModeLineTaskDisplayCompleteForGate(prevRaw)) {
        break;
      }
    }
    out.push(view);
  }
  return out;
}
