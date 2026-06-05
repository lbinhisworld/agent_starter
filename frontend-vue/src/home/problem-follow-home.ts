/**
 * [INPUT]: `window` 上由 `config.js` / `storage.js` 等注入的 `FOLLOW_TASKS`、`getDigitalProblems`、`getProblemDetailChats`；
 *         `SmartCto.problemFollowShared`（`frontend/js/core/problem-follow-shared.js`）
 * [OUTPUT]: 首页客户档案卡「当前任务」文案、列表排序（按 createdAt/updatedAt 新→旧；高亮仅样式不插队）、图标与时间格式化（不依赖 `main.js` / `__appState`）
 * [POS]: Vue 正式首页专用；逻辑自原 `frontend/js/home-follow-card-bridge.js` 迁入（FE-20260406-04A）
 *
 * [PROTOCOL]: 若 `main.js` 中 canonical / `isTaskCompleted` 规则变更，须同步本文件；案例键与高亮须与 `problem-follow-shared.js` 一致
 */

export type ProblemItem = Record<string, unknown>;

type FollowTask = { id: string; name?: string };

/** 与 `problem-follow-shared.js` 契约一致 */
type ProblemFollowSharedApi = {
  getProblemFollowCaseKey: (item: unknown) => string;
  getProblemFollowHighlightedCaseKey: () => string;
  setProblemFollowHighlightedCaseKey: (caseKey: string) => string;
};

type WindowWithHomeDeps = Window & {
  getDigitalProblems?: () => unknown[];
  getProblemDetailChats?: () => Record<string, unknown[]>;
  SmartCto?: { problemFollowShared?: ProblemFollowSharedApi };
};

function getW(): WindowWithHomeDeps {
  return window as WindowWithHomeDeps;
}

function getProblemFollowShared(): ProblemFollowSharedApi | undefined {
  return typeof window !== 'undefined' ? getW().SmartCto?.problemFollowShared : undefined;
}

export function getProblemFollowCaseKey(item: ProblemItem | null | undefined): string {
  const s = getProblemFollowShared();
  return s ? s.getProblemFollowCaseKey(item) : '';
}

export function getProblemFollowHighlightedCaseKey(): string {
  const s = getProblemFollowShared();
  return s ? s.getProblemFollowHighlightedCaseKey() : '';
}

export function setProblemFollowHighlightedCaseKey(caseKey: string): string {
  const s = getProblemFollowShared();
  return s ? s.setProblemFollowHighlightedCaseKey(caseKey) : '';
}

/** 影子页专用 chat 桶键（与主站 `getProblemDetailChatStorageKey` 语义不同；勿在本轮统一） */
export function getProblemDetailChatStorageKeyForHome(item: ProblemItem | null | undefined): string {
  if (!item) return '';
  const caStr =
    item.createdAt != null && String(item.createdAt).trim() !== '' ? String(item.createdAt) : '';
  const idStr = item.id != null && String(item.id).trim() !== '' ? String(item.id) : '';
  return caStr || idStr;
}

/** 仅读持久化聊天，不读 `__appState.problemDetailChatMessages` */
export function getProblemDetailChatMessagesForShadow(item: ProblemItem | null | undefined): unknown[] {
  if (!item) return [];
  const w = getW();
  const chats = typeof w.getProblemDetailChats === 'function' ? w.getProblemDetailChats!() : {};
  const sk = getProblemDetailChatStorageKeyForHome(item);
  if (sk && Array.isArray((chats as Record<string, unknown[]>)[sk])) {
    return (chats as Record<string, unknown[]>)[sk]!;
  }
  if (item.createdAt != null && Array.isArray((chats as Record<string, unknown[]>)[String(item.createdAt)])) {
    return (chats as Record<string, unknown[]>)[String(item.createdAt)]!;
  }
  return [];
}

function mergeCompletedStageArrays(a: unknown, b: unknown): number[] {
  return [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])].sort(
    (x, y) => x - y,
  ) as number[];
}

export function resolveProblemItemForTaskNotification(
  itemForMerge: ProblemItem | null | undefined,
): ProblemItem | null {
  const cur = itemForMerge;
  if (!cur?.createdAt) return null;
  const list = typeof getW().getDigitalProblems === 'function' ? getW().getDigitalProblems!() : [];
  if (!Array.isArray(list)) return cur as ProblemItem;
  const fromList = (list as ProblemItem[]).find(
    (p) =>
      (cur.id && p.id && String(p.id) === String(cur.id)) ||
      String(p.createdAt) === String(cur.createdAt) ||
      (cur.id && String(p.createdAt) === String(cur.id)) ||
      (p.id && String(p.createdAt) === String(cur.id)),
  );
  if (!fromList) return cur as ProblemItem;
  const a = (fromList.completedTaskIds as string[] | undefined) || [];
  const b = (cur.completedTaskIds as string[] | undefined) || [];
  const mergedIds = [...new Set([...a, ...b])].sort();
  const mergedWf = mergeCompletedStageArrays(
    fromList.workflowAlignCompletedStages,
    cur.workflowAlignCompletedStages,
  );
  const mergedItGap = mergeCompletedStageArrays(fromList.itGapCompletedStages, cur.itGapCompletedStages);
  const mergedReqStages = mergeCompletedStageArrays(fromList.completedStages, cur.completedStages);
  const mergedMajorStage = Math.max(
    Number(fromList.currentMajorStage) || 0,
    Number(cur.currentMajorStage) || 0,
  );
  return {
    ...fromList,
    ...cur,
    currentMajorStage: mergedMajorStage,
    globalItGapAnalysisJson: cur.globalItGapAnalysisJson ?? fromList.globalItGapAnalysisJson,
    preliminaryReq: cur.preliminaryReq != null ? cur.preliminaryReq : fromList.preliminaryReq,
    task1InitialLlmQuery:
      cur.task1InitialLlmQuery != null ? cur.task1InitialLlmQuery : fromList.task1InitialLlmQuery,
    task1PendingPreliminaryRequirement:
      cur.task1PendingPreliminaryRequirement != null
        ? cur.task1PendingPreliminaryRequirement
        : fromList.task1PendingPreliminaryRequirement,
    requirementDetail: cur.requirementDetail !== undefined ? cur.requirementDetail : fromList.requirementDetail,
    requirementDetailHistory: Array.isArray(cur.requirementDetailHistory)
      ? cur.requirementDetailHistory
      : fromList.requirementDetailHistory,
    completedTaskIds: mergedIds,
    workflowAlignCompletedStages: mergedWf,
    itGapCompletedStages: mergedItGap,
    completedStages: mergedReqStages,
  };
}

function msgTaskComplete(m: unknown): m is { type: string; taskId?: string; confirmed?: boolean } {
  return m != null && typeof m === 'object';
}

export function isTaskCompleted(item: ProblemItem | null | undefined, taskId: string): boolean {
  if (!item) return false;
  const completed = (item.completedStages as number[] | undefined) || [];
  const wfCompleted = (item.workflowAlignCompletedStages as number[] | undefined) || [];
  const itGapCompleted = (item.itGapCompletedStages as number[] | undefined) || [];
  switch (taskId) {
    case 'task1': {
      if ((Number(item.currentMajorStage) || 0) > 0) return true;
      const ids = (item.completedTaskIds as string[] | undefined) || [];
      if (ids.includes('task1')) return true;
      const msgs = getProblemDetailChatMessagesForShadow(item);
      if (Array.isArray(msgs)) {
        if (msgs.some((m) => msgTaskComplete(m) && m.type === 'taskCompleteBlock' && m.taskId === 'task1'))
          return true;
        if (
          msgs.some(
            (m) =>
              msgTaskComplete(m) &&
              m.type === 'taskCompletionConfirmBlock' &&
              m.taskId === 'task1' &&
              m.confirmed,
          )
        )
          return true;
      }
      const bmc = item.bmc;
      const hasBmc = bmc && typeof bmc === 'object' && Object.keys(bmc as object).length > 0;
      if (completed.includes(0) && hasBmc) return true;
      return false;
    }
    case 'task2':
      return completed.includes(1) || !!item.bmc;
    case 'task3':
      return completed.includes(2);
    case 'task4': {
      const vs = item.valueStream as { raw?: unknown } | undefined;
      return wfCompleted.includes(0) && !!(vs && !vs.raw);
    }
    case 'task5':
      return wfCompleted.includes(1);
    case 'task6':
      return wfCompleted.includes(2);
    case 'task7':
      return itGapCompleted.includes(0);
    case 'task8':
      return !!item.globalItGapAnalysisJson;
    case 'task9':
      return itGapCompleted.includes(2);
    case 'task12':
    case 'task13':
    case 'task14':
    case 'task15': {
      const ids = (item.completedTaskIds as string[] | undefined) || [];
      if (ids.includes(taskId)) return true;
      if (
        taskId === 'task12' &&
        (ids.includes('task11') ||
          ids.includes('strategy-0') ||
          ids.includes('strategy-1') ||
          ids.includes('task10'))
      ) {
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

export function getMajorStageByTaskId(taskId: string | null | undefined): number {
  if (!taskId) return 0;
  if (['task1', 'task2', 'task3'].includes(taskId)) return 0;
  if (['task4', 'task5', 'task6'].includes(taskId)) return 1;
  if (['task7', 'task8', 'task9'].includes(taskId)) return 2;
  if (['task12', 'task13', 'task14', 'task15'].includes(taskId)) return 3;
  return 0;
}

export type CanonicalProblemFollowTaskState = {
  taskId: string | null;
  taskName: string;
  majorStage: number;
  itGapSubstepIndex: number | null;
  itStrategySubstepIndex: number | null;
  allComplete: boolean;
};

function getGlobalTaskArrays(): { follow: FollowTask[]; itgap: FollowTask[]; strategy: FollowTask[] } {
  const w = window as unknown as {
    FOLLOW_TASKS?: FollowTask[];
    ITGAP_HISTORY_TASKS?: FollowTask[];
    IT_STRATEGY_TASKS?: FollowTask[];
  };
  return {
    follow: w.FOLLOW_TASKS || [],
    itgap: w.ITGAP_HISTORY_TASKS || [],
    strategy: w.IT_STRATEGY_TASKS || [],
  };
}

export function getCanonicalCurrentProblemFollowTaskState(
  item: ProblemItem | null | undefined,
  messages: unknown[] | null | undefined,
): CanonicalProblemFollowTaskState {
  const { follow: FOLLOW_TASKS, itgap: ITGAP_HISTORY_TASKS, strategy: IT_STRATEGY_TASKS } =
    getGlobalTaskArrays();
  const empty: CanonicalProblemFollowTaskState = {
    taskId: null,
    taskName: '—',
    majorStage: 0,
    itGapSubstepIndex: null,
    itStrategySubstepIndex: null,
    allComplete: true,
  };
  if (!item) return { ...empty, allComplete: false };
  const merged = resolveProblemItemForTaskNotification(item) || item;
  const allTasks = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...IT_STRATEGY_TASKS];
  const taskDone = (tid: string) => isTaskCompleted(merged, tid);
  let candidate = allTasks.find((t) => !taskDone(t.id)) || null;
  if (candidate?.id === 'task1' && Number(merged.currentMajorStage) === 1) {
    const workflowAlignTasks = allTasks.filter((t) => ['task4', 'task5', 'task6'].includes(t.id));
    const wf = workflowAlignTasks.find((t) => !taskDone(t.id));
    if (wf) candidate = wf;
  }
  if (Number(merged.currentMajorStage) === 2) {
    const itGapTasks = allTasks.filter((t) => ['task7', 'task8', 'task9'].includes(t.id));
    const ig = itGapTasks.find((t) => !taskDone(t.id));
    candidate = ig || allTasks.find((t) => !taskDone(t.id)) || null;
  }
  if (Number(merged.currentMajorStage) === 3) {
    const stIds = ['task12', 'task13', 'task14', 'task15'];
    const stTasks = allTasks.filter((t) => stIds.includes(t.id));
    const st = stTasks.find((t) => !taskDone(t.id));
    candidate = st || allTasks.find((t) => !taskDone(t.id)) || null;
  }
  void messages;
  if (!candidate) {
    return { ...empty, allComplete: true };
  }
  const taskId = candidate.id;
  const taskName = candidate.name || '—';
  const majorStage = getMajorStageByTaskId(taskId);
  let itGapSubstepIndex: number | null = null;
  if (taskId === 'task7') itGapSubstepIndex = 0;
  else if (taskId === 'task8') itGapSubstepIndex = 1;
  else if (taskId === 'task9') itGapSubstepIndex = 2;
  const siMap: Record<string, number> = { task12: 0, task13: 1, task14: 2, task15: 3 };
  const itStrategySubstepIndex = siMap[taskId] !== undefined ? siMap[taskId]! : null;
  return {
    taskId,
    taskName,
    majorStage,
    itGapSubstepIndex,
    itStrategySubstepIndex,
    allComplete: false,
  };
}

/** 首页列表排序：优先构建时间 `createdAt`，缺省用 `updatedAt`；均无有效时间则 0 */
function getProblemCaseSortTimeMs(item: ProblemItem | null | undefined): number {
  if (!item || typeof item !== 'object') return 0;
  for (const key of ['createdAt', 'updatedAt'] as const) {
    const raw = item[key];
    if (raw == null || raw === '') continue;
    const t = new Date(raw as string | number | Date).getTime();
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

export function getProblemFollowCardStageLabel(item: ProblemItem | null | undefined): string {
  if (!item) return '—';
  const chats = getProblemDetailChatMessagesForShadow(item);
  const canon = getCanonicalCurrentProblemFollowTaskState(item, chats);
  if (canon.allComplete) return '已全部完成';
  if (!canon.taskId) return '—';
  const majorIdx = getMajorStageByTaskId(canon.taskId);
  const majors = ['需求理解', '工作流对齐', 'ITGap分析', 'IT策略规划'];
  const major = majors[majorIdx] ?? '—';
  return `${major} · ${canon.taskName}`;
}

/**
 * 可渲染列表：严格按构建/更新时间新→旧；高亮 key 仅由卡片样式消费（`HomePage.vue` `isHighlighted`），**不改变顺序**。
 */
export function getRenderableProblemFollowList(list: ProblemItem[]): ProblemItem[] {
  const nextList = Array.isArray(list) ? list.slice() : [];
  nextList.sort((a, b) => {
    const tb = getProblemCaseSortTimeMs(b);
    const ta = getProblemCaseSortTimeMs(a);
    if (tb !== ta) return tb - ta;
    return String(getProblemFollowCaseKey(b)).localeCompare(String(getProblemFollowCaseKey(a)));
  });
  return nextList;
}

export function formatProblemDateTime(createdAt: unknown): string {
  if (!createdAt) return '—';
  try {
    const d = new Date(createdAt as string | number | Date);
    if (Number.isNaN(d.getTime())) return String(createdAt);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return String(createdAt);
  }
}

export const PROBLEM_FOLLOW_CARD_ICONS = {
  copy: '<svg class="problem-follow-icon problem-follow-icon-copy" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
  delete:
    '<svg class="problem-follow-icon problem-follow-icon-delete" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
} as const;
