/**
 * [INPUT]: `getDigitalProblems` / `restoreItemFromSnapshot` / `saveProblemDetailChat` / `getProblemDetailChats`（storage 链）；
 *         `window.inferTaskIdFromMessage`（须首屏加载 `communication-history.js`）；
 *         若同源已打开 `index.html` 且加载了 `main.js`，可选消费 `getCanonicalCurrentProblemFollowTaskState` 解析重启目标 task。
 * [OUTPUT]: `SmartCto.problemDetailRestart.applyRestartCurrentForCaseId(caseId)`、`applyDesignDetailFullSessionResetForCaseId(caseId)`（设计页「完全重启」：强制回退全案 task1 + 清空同源聊天 + 已确认启动通知；与 `useDesignDetailChat.fullRestartDesignDetailFromPage` 协同）
 * [POS]: 设计详情页专用；**不**引入 `main.js`。
 *
 * [PROTOCOL]: 变更「重启当前」业务口径时须与 `frontend/main.js` `applyRestartCurrentTask` 同步审查；并同步 `design-detail/AGENTS.md`。**全案任务顺序常量**仅允许用于本文件「无 main 时重启目标」回退，**禁止**用于设计页独立任务线（见 `designDetailLineState.ts` / `design_mode_tasks.md`）。**完全重启**须与后端 `DELETE …/task-graph`、`POST …/llm-logs/clear { all:true }` 及 `useDesignDetailChat` 画布/线态一致；持久化链路透 **`[design-detail:full-restart]`** `persist_*` 与 `useDesignDetailChat` 对账。
 */

import { getProblemDetailChatStorageKey } from './designDetailProgressGovernance';
import {
  appendTaskStartNotificationAfterRestart,
  buildTaskStartNotificationMessage,
  isTaskCompleted,
  mergeResolvedItemForDesign,
  refreshBundle,
  TASK1_ID,
} from './designDetailTaskMirror';

type Item = Record<string, unknown>;
type Msg = Record<string, unknown>;

/**
 * 仅用于本文件在 **未加载 main.js** 时推断「应重启哪一任务」以写回存储；与 `main.js` 的 `TASK_ORDER` 语义保持一致。
 * **不得**被 `designDetailLineState` / `useDesignDetailChat` 用于推断设计页「当前任务」（设计页任务线与详情 canonical 解耦）。
 */
const RESTART_PERSISTENCE_TASK_ORDER: readonly string[] = [
  'task1',
  'task2',
  'task3',
  'task4',
  'task5',
  'task6',
  'task7',
  'task8',
  'task9',
  'task12',
  'task13',
  'task14',
  'task15',
];

function getFirstUncompletedTaskIdForRestartPersistence(
  item: Item,
  messages: Msg[],
): string | null {
  const id = RESTART_PERSISTENCE_TASK_ORDER.find((tid) => !isTaskCompleted(item, tid, messages));
  return id || null;
}

/** 与 `main.js::getDigitalProblemPersistKey` 一致：createdAt 优先，否则 id */
function getDigitalProblemPersistKey(it: Item | null | undefined): string {
  if (!it || typeof it !== 'object') return '';
  const ca = it.createdAt != null && String(it.createdAt).trim() !== '' ? String(it.createdAt).trim() : '';
  const id = it.id != null && String(it.id).trim() !== '' ? String(it.id).trim() : '';
  return ca || id;
}

function getProblemFollowCompatibleCaseKeys(item: Item): string[] {
  const keys: string[] = [];
  if (item.id != null && String(item.id).trim()) keys.push(String(item.id).trim());
  if (item.createdAt != null && String(item.createdAt).trim()) keys.push(String(item.createdAt).trim());
  return [...new Set(keys)];
}

function getMajorStageByTaskId(taskId: string): number {
  if (!taskId) return 0;
  if (['task1', 'task2', 'task3'].includes(taskId)) return 0;
  if (['task4', 'task5', 'task6'].includes(taskId)) return 1;
  if (['task7', 'task8', 'task9'].includes(taskId)) return 2;
  if (['task12', 'task13', 'task14', 'task15'].includes(taskId)) return 3;
  return 0;
}

/** 与 `main.js::mapRollbackCtxTaskId` 一致 */
function mapRollbackCtxTaskId(raw: unknown): string {
  if (raw == null || raw === '') return 'task1';
  const s = String(raw).trim();
  if (s === 'task10' || s === 'strategy-0' || s === 'task11' || s === 'strategy-1') return 'task12';
  const m: Record<string, string> = {
    'e2e-flow': 'task7',
    'global-itgap': 'task8',
    'local-itgap': 'task9',
    'strategy-0': 'task12',
    'strategy-1': 'task12',
  };
  if (m[s]) return m[s];
  const strategyMatch = s.match(/^strategy-(\d+)$/);
  if (strategyMatch) {
    const strategyIndex = Number(strategyMatch[1]);
    if (Number.isInteger(strategyIndex) && strategyIndex >= 2 && strategyIndex <= 5) {
      return `task${String(strategyIndex + 10)}`;
    }
    if (strategyIndex === 0 || strategyIndex === 1) return 'task12';
  }
  return s;
}

function filterChatMessagesRemoveTask(messages: Msg[], taskId: string): Msg[] {
  if (!Array.isArray(messages) || !taskId) return messages || [];
  const inferTaskId =
    typeof window !== 'undefined' && typeof (window as unknown as { inferTaskIdFromMessage?: (m: Msg) => string | null }).inferTaskIdFromMessage === 'function'
      ? (window as unknown as { inferTaskIdFromMessage: (m: Msg) => string | null }).inferTaskIdFromMessage
      : () => null;
  let ctxTask = 'task1';
  return messages.filter((msg) => {
    if (!msg) return true;
    if (msg.askMode === true) return true;
    const inferred = inferTaskId(msg);
    const explicit = msg.taskId || msg._taskId;
    const explicitStr = explicit != null && explicit !== '' ? String(explicit) : '';
    const explicitMapped = explicitStr ? mapRollbackCtxTaskId(explicitStr) : '';
    const ctxMapped = ctxTask ? mapRollbackCtxTaskId(ctxTask) : '';
    let remove = false;
    if (explicitMapped === taskId || explicitStr === taskId || inferred === taskId) remove = true;
    else if (
      !explicitStr &&
      !inferred &&
      ctxMapped === taskId &&
      (msg.role === 'user' || (msg.role === 'system' && !msg.type))
    ) {
      remove = true;
    }
    if (msg.type === 'taskStartNotification' && msg.taskId) {
      ctxTask = mapRollbackCtxTaskId(msg.taskId);
    } else if (inferred) {
      ctxTask = inferred;
    }
    return !remove;
  });
}

/** 与 `main.js::buildItemAfterRollbackToTask` 一致（task5 清覆盖键委托 global，缺省则跳过） */
function buildItemAfterRollbackToTask(item: Item, prevTaskId: string): Item {
  if (!item || !prevTaskId) return item;
  const completed = (item.completedStages as number[]) || [];
  const wfCompleted = (item.workflowAlignCompletedStages as number[]) || [];
  const itGapCompleted = (item.itGapCompletedStages as number[]) || [];
  const completedTaskIds = (item.completedTaskIds as string[]) || [];
  let nextItem: Item = { ...item };
  switch (prevTaskId) {
    case 'task1':
      nextItem = { ...nextItem, basicInfo: undefined, completedStages: [] };
      break;
    case 'task2':
      nextItem = { ...nextItem, bmc: undefined, completedStages: completed.filter((x) => x !== 1) };
      break;
    case 'task3':
      nextItem = { ...nextItem, requirementLogic: undefined, completedStages: completed.filter((x) => x !== 2) };
      break;
    case 'task4':
      nextItem = { ...nextItem, valueStream: undefined, workflowAlignCompletedStages: [] };
      break;
    case 'task5': {
      nextItem = { ...nextItem, workflowAlignCompletedStages: wfCompleted.filter((x) => x !== 1), itStatusSessions: undefined };
      const vs = nextItem.valueStream as { raw?: unknown; stages?: unknown[]; phases?: unknown[]; nodes?: unknown[] } | undefined;
      if (vs && !vs.raw && (vs.stages || vs.phases || vs.nodes)) {
        const rawStages = (vs.stages ?? vs.phases ?? vs.nodes ?? []) as unknown[];
        if (Array.isArray(rawStages)) {
          const stages = rawStages.map((s) => {
            if (!s || typeof s !== 'object') return s;
            const rawSteps = (s as { steps?: unknown[]; tasks?: unknown[]; phases?: unknown[]; items?: unknown[] }).steps ??
              (s as { tasks?: unknown[] }).tasks ??
              (s as { phases?: unknown[] }).phases ??
              (s as { items?: unknown[] }).items ??
              [];
            const steps = (rawSteps as unknown[]).map((st) => {
              if (typeof st !== 'object' || st == null) return st;
              const { itStatus, it_status, itPlan, it_plan, itStatusLabel, ...rest } = st as Record<string, unknown>;
              return rest;
            });
            return { ...(s as object), steps };
          });
          nextItem = { ...nextItem, valueStream: { ...vs, stages } };
        }
      }
      getProblemFollowCompatibleCaseKeys(nextItem).forEach((k) => {
        const w = globalThis as unknown as {
          setTask5ItStatusPromptOverride?: (a: string, b: string) => void;
          setTask5ModAwaitingAutoStrip?: (a: string, b: boolean) => void;
        };
        if (typeof w.setTask5ItStatusPromptOverride === 'function') w.setTask5ItStatusPromptOverride(k, '');
        if (typeof w.setTask5ModAwaitingAutoStrip === 'function') w.setTask5ModAwaitingAutoStrip(k, false);
      });
      break;
    }
    case 'task6': {
      nextItem = { ...nextItem, workflowAlignCompletedStages: wfCompleted.filter((x) => x !== 2), painPointSessions: undefined };
      const vs = nextItem.valueStream as { raw?: unknown; stages?: unknown[]; phases?: unknown[]; nodes?: unknown[] } | undefined;
      if (vs && !vs.raw && (vs.stages || vs.phases || vs.nodes)) {
        const rawStages = (vs.stages ?? vs.phases ?? vs.nodes ?? []) as unknown[];
        if (Array.isArray(rawStages)) {
          const stages = rawStages.map((s) => {
            if (!s || typeof s !== 'object') return s;
            const rawSteps = (s as { steps?: unknown[]; tasks?: unknown[]; phases?: unknown[]; items?: unknown[] }).steps ??
              (s as { tasks?: unknown[] }).tasks ??
              (s as { phases?: unknown[] }).phases ??
              (s as { items?: unknown[] }).items ??
              [];
            const steps = (rawSteps as unknown[]).map((st) => {
              if (typeof st !== 'object' || st == null) return st;
              const { painPoint, pain_point, ...rest } = st as Record<string, unknown>;
              return rest;
            });
            return { ...(s as object), steps };
          });
          nextItem = { ...nextItem, valueStream: { ...vs, stages } };
        }
      }
      break;
    }
    case 'task7':
      nextItem = {
        ...nextItem,
        itGapCompletedStages: itGapCompleted.filter((x) => x !== 0),
        e2eFlowLandscapeJson: undefined,
        e2eTransactionFlowJson: undefined,
        e2eRequirementScenarioSupplementJson: undefined,
      };
      break;
    case 'task8':
      nextItem = {
        ...nextItem,
        globalItGapAnalysisJson: undefined,
        globalItGapConstraintBaseMarkdown: undefined,
        itDesignSupplementSessions: undefined,
        itGapCompletedStages: itGapCompleted.filter((x) => x !== 1),
      };
      break;
    case 'task9':
      nextItem = {
        ...nextItem,
        localItGapSessions: undefined,
        localItGapAnalyses: undefined,
        roleTaskCenterPortalDesignJson: undefined,
        itGapCompletedStages: itGapCompleted.filter((x) => x !== 2),
      };
      break;
    case 'task12': {
      const prevRpSessions = nextItem.rolePermissionSessions as unknown[] | undefined;
      const clearedRpSessions = Array.isArray(prevRpSessions)
        ? prevRpSessions.map((s) => (s && typeof s === 'object' ? { ...(s as object), rolePermissionJson: undefined } : s))
        : undefined;
      const sessions = ((nextItem.coreBusinessObjectSessions as unknown[]) || []).map((s) =>
        s && typeof s === 'object' ? { ...(s as object), coreBusinessObjectJson: null } : s,
      );
      nextItem = {
        ...nextItem,
        completedTaskIds: completedTaskIds.filter(
          (id) =>
            id !== prevTaskId &&
            id !== 'strategy-0' &&
            id !== 'strategy-1' &&
            id !== 'task10' &&
            id !== 'task11',
        ),
        rolePermissionModel: undefined,
        ...(clearedRpSessions !== undefined ? { rolePermissionSessions: clearedRpSessions } : {}),
        coreBusinessObjectSessions: sessions,
        coreBusinessObjectSystemPromptOverride: undefined,
      };
      break;
    }
    case 'task13':
    case 'task14':
    case 'task15':
      nextItem = { ...nextItem, completedTaskIds: completedTaskIds.filter((id) => id !== prevTaskId) };
      break;
    default:
      return item;
  }
  nextItem.currentMajorStage = getMajorStageByTaskId(prevTaskId);
  return nextItem;
}

function buildItemClearCurrentTaskOnly(item: Item, taskId: string): Item {
  if (!item || !taskId) return item;
  return buildItemAfterRollbackToTask(item, taskId);
}

const TASK1_INITIAL_LLM_QUERY_STORAGE_KEY = 'task1InitialLlmQueryByCaseKey';

function clearTask1InitialLlmQueryPersistedForItem(item: Item): void {
  try {
    const g = globalThis as unknown as {
      SmartCto?: { problemFollowShared?: { getProblemFollowCaseKey?: (x: Item) => string } };
    };
    const getCaseKey = g.SmartCto?.problemFollowShared?.getProblemFollowCaseKey;
    const mapRaw = localStorage.getItem(TASK1_INITIAL_LLM_QUERY_STORAGE_KEY);
    const map = mapRaw ? (JSON.parse(mapRaw) as Record<string, unknown>) : {};
    const keys: string[] = [];
    if (typeof getCaseKey === 'function') {
      const ck = getCaseKey(item);
      if (ck) keys.push(ck);
    }
    if (item.createdAt) keys.push(String(item.createdAt));
    if (item.id) keys.push(String(item.id));
    let changed = false;
    keys.forEach((k) => {
      if (k && Object.prototype.hasOwnProperty.call(map, k)) {
        delete map[k];
        changed = true;
      }
    });
    if (changed) localStorage.setItem(TASK1_INITIAL_LLM_QUERY_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function resolveTaskIdForRestart(dataItem: Item, messages: Msg[]): string | null {
  const w = globalThis as unknown as {
    getCanonicalCurrentProblemFollowTaskState?: (item: Item, msgs: Msg[]) => { taskId?: string; allComplete?: boolean } | null;
    resolveProblemItemForTaskNotification?: () => Item | null;
    getProblemDetailChatMessagesForCanonical?: (item: Item) => Msg[];
  };
  if (typeof w.getCanonicalCurrentProblemFollowTaskState === 'function') {
    try {
      const merged =
        typeof w.resolveProblemItemForTaskNotification === 'function'
          ? w.resolveProblemItemForTaskNotification() || dataItem
          : dataItem;
      const msgs =
        typeof w.getProblemDetailChatMessagesForCanonical === 'function'
          ? w.getProblemDetailChatMessagesForCanonical(merged)
          : messages;
      const canon = w.getCanonicalCurrentProblemFollowTaskState(merged, msgs);
      if (canon && !canon.allComplete && canon.taskId) return String(canon.taskId);
    } catch {
      /* fall through */
    }
  }
  const mergedLocal = mergeResolvedItemForDesign(dataItem) || dataItem;
  return getFirstUncompletedTaskIdForRestartPersistence(mergedLocal, messages);
}

/**
 * 与详情页 `applyRestartCurrentTask` 同源持久化（无 `__appState` / 无 `syncProblemDetailSessionAfterRestartCurrent`）。
 * @returns ok 表示已写存储；false 时调用方应提示用户
 */
export async function applyRestartCurrentForCaseId(caseIdRaw: string): Promise<boolean> {
  const caseId = String(caseIdRaw || '').trim();
  if (!caseId) return false;

  const getList =
    typeof globalThis.getDigitalProblems === 'function'
      ? (globalThis.getDigitalProblems as () => Item[])
      : () => [] as Item[];
  const list = getList() || [];
  const dataItem =
    list.find((p) => String(p.id || '').trim() === caseId) ||
    list.find((p) => getDigitalProblemPersistKey(p) === caseId) ||
    null;
  if (!dataItem) {
    if (typeof globalThis.alert === 'function') globalThis.alert('未找到案例或无权访问，无法重启任务');
    return false;
  }

  const persistKey = getDigitalProblemPersistKey(dataItem);
  const chatKey = getProblemDetailChatStorageKey(dataItem) || persistKey;
  if (!persistKey) {
    if (typeof globalThis.alert === 'function') globalThis.alert('当前案例标识缺失，无法重启任务');
    return false;
  }

  const bundle = await refreshBundle(caseId);
  const messages: Msg[] = Array.isArray(bundle?.messages) ? (bundle!.messages as Msg[]).slice() : [];
  const mergedRow = mergeResolvedItemForDesign(dataItem) || dataItem;
  const taskId = resolveTaskIdForRestart(mergedRow, messages);
  if (!taskId) {
    if (typeof globalThis.alert === 'function') globalThis.alert('当前没有可重启的任务（所有任务已完成）');
    return false;
  }

  const getChats =
    typeof globalThis.getProblemDetailChats === 'function'
      ? (globalThis.getProblemDetailChats as () => Record<string, Msg[]>)
      : () => ({} as Record<string, Msg[]>);
  const chatMap = getChats();
  const chats =
    messages.length > 0
      ? messages
      : (chatMap[chatKey] as Msg[] | undefined) || (chatMap[persistKey] as Msg[] | undefined) || [];

  let updated = buildItemClearCurrentTaskOnly({ ...mergedRow }, taskId);
  let filteredChats = filterChatMessagesRemoveTask(Array.isArray(chats) ? chats : [], taskId);

  if (taskId === 'task2') {
    filteredChats = (Array.isArray(filteredChats) ? filteredChats : []).filter((m) => {
      if (!m) return false;
      const t = m.type || '';
      if (t === 'task2LlmQueryBlock') return false;
      if (t === 'bmcCard' || t === 'bmcStartBlock') return false;
      if (t === 'bmcDiscussionStartBlock' || t === 'bmcDiscussionReplyBlock' || t === 'bmcDiscussionLlmQueryBlock' || t === 'bmcDiscussionEndBlock') return false;
      if ((t === 'taskCompleteBlock' || t === 'taskCompletionConfirmBlock') && m.taskId === 'task2') return false;
      if (t === 'taskStartNotification' && m.taskId === 'task2') return false;
      if (m.role === 'system' && typeof m.content === 'string' && m.content.includes('商业模式画布 BMC')) return false;
      if (m.role === 'system' && typeof m.content === 'string' && m.content.trim() === '请描述您想讨论的问题（输入后发送）') return false;
      if (m.role === 'user' && m._logType === 'bmcDiscussionUser') return false;
      return true;
    });
  }

  if (taskId === 'task1') {
    updated = {
      ...updated,
      preliminaryReq: undefined,
      requirementDetail: '',
      requirementDetailHistory: [],
      task1PendingPreliminaryRequirement: false,
      task1InitialLlmQuery: undefined,
    };
    filteredChats = [];
    clearTask1InitialLlmQueryPersistedForItem(mergedRow);
    if (typeof (globalThis as unknown as { saveProblemDetailChatLocalStorageMulticast?: unknown }).saveProblemDetailChatLocalStorageMulticast === 'function') {
      (globalThis as unknown as { saveProblemDetailChatLocalStorageMulticast: (a: Item, b: Msg[]) => void }).saveProblemDetailChatLocalStorageMulticast(
        mergedRow,
        filteredChats,
      );
    }
    const caseKeyForException = chatKey || persistKey;
    (globalThis as unknown as { SmartCto?: { flowExceptionRecord?: { clearFlowException?: (k: string) => void } } }).SmartCto?.flowExceptionRecord?.clearFlowException?.(
      caseKeyForException,
    );
  }

  const restore = (globalThis as unknown as { restoreItemFromSnapshot?: (k: string, snap: Item) => void }).restoreItemFromSnapshot;
  if (typeof restore === 'function') restore(persistKey, updated as Item);

  const saveChat = (globalThis as unknown as { saveProblemDetailChat?: (k: string, m: Msg[]) => void }).saveProblemDetailChat;
  if (typeof saveChat === 'function') saveChat(chatKey || persistKey, filteredChats);

  const summaryLookup = String((dataItem as { createdAt?: unknown }).createdAt || '') || persistKey;
  const adapter = (globalThis as unknown as { STORAGE_HTTP_ADAPTER?: { removeTaskSummaryEntriesForRestart?: (a: string, b: string) => void } }).STORAGE_HTTP_ADAPTER;
  if (adapter && typeof adapter.removeTaskSummaryEntriesForRestart === 'function') {
    adapter.removeTaskSummaryEntriesForRestart(summaryLookup, taskId);
  }

  appendTaskStartNotificationAfterRestart(chatKey || persistKey, taskId, filteredChats);

  try {
    globalThis.dispatchEvent(new CustomEvent('problemCasesChanged'));
  } catch {
    /* ignore */
  }

  return true;
}

/**
 * 设计详情页「完全重启」：与详情 task1「重启当前」同源持久化，**固定**回退到全案 `task1`、清空 `problem_detail_chats`、补 **已确认** `taskStartNotification`（与顶栏「重启当前」在 customer_basic 时行为一致，避免门控拒绝）。
 * 用于与后端清空 LLM 审计 / 全部推理图、设计页画布与 **设计线 `customer_basic`** 协同；**不**单独清 `DesignDetailProgressWorkspace`（由调用方 DELETE）。
 */
export async function applyDesignDetailFullSessionResetForCaseId(caseIdRaw: string): Promise<boolean> {
  const caseId = String(caseIdRaw || '').trim();
  if (!caseId) return false;

  try {
    console.info('[design-detail:full-restart]', { phase: 'persist_enter', caseId });
  } catch {
    /* ignore */
  }

  const getList =
    typeof globalThis.getDigitalProblems === 'function'
      ? (globalThis.getDigitalProblems as () => Item[])
      : () => [] as Item[];
  const list = getList() || [];
  const dataItem =
    list.find((p) => String(p.id || '').trim() === caseId) ||
    list.find((p) => getDigitalProblemPersistKey(p) === caseId) ||
    null;
  if (!dataItem) {
    try {
      console.info('[design-detail:full-restart]', { phase: 'persist_fail_no_item', caseId });
    } catch {
      /* ignore */
    }
    if (typeof globalThis.alert === 'function') globalThis.alert('未找到案例或无权访问，无法完全重启');
    return false;
  }

  const persistKey = getDigitalProblemPersistKey(dataItem);
  const chatKey = getProblemDetailChatStorageKey(dataItem) || persistKey;
  if (!persistKey) {
    try {
      console.info('[design-detail:full-restart]', { phase: 'persist_fail_no_persist_key', caseId });
    } catch {
      /* ignore */
    }
    if (typeof globalThis.alert === 'function') globalThis.alert('当前案例标识缺失，无法完全重启');
    return false;
  }

  try {
    console.info('[design-detail:full-restart]', {
      phase: 'persist_keys',
      caseId,
      persistKey,
      chatKey: chatKey || persistKey,
    });
  } catch {
    /* ignore */
  }

  await refreshBundle(caseId);
  const mergedRow = mergeResolvedItemForDesign(dataItem) || dataItem;
  const taskId = TASK1_ID;

  let updated = buildItemClearCurrentTaskOnly({ ...mergedRow }, taskId);
  updated = {
    ...updated,
    preliminaryReq: undefined,
    requirementDetail: '',
    requirementDetailHistory: [],
    task1PendingPreliminaryRequirement: false,
    task1InitialLlmQuery: undefined,
    currentMajorStage: 0,
    completedTaskIds: ((updated.completedTaskIds as string[]) || []).filter((id) => id !== 'task1'),
  };

  clearTask1InitialLlmQueryPersistedForItem(mergedRow);
  if (typeof (globalThis as unknown as { saveProblemDetailChatLocalStorageMulticast?: unknown }).saveProblemDetailChatLocalStorageMulticast === 'function') {
    (globalThis as unknown as { saveProblemDetailChatLocalStorageMulticast: (a: Item, b: Msg[]) => void }).saveProblemDetailChatLocalStorageMulticast(
      mergedRow,
      [],
    );
  }
  const caseKeyForException = chatKey || persistKey;
  (globalThis as unknown as { SmartCto?: { flowExceptionRecord?: { clearFlowException?: (k: string) => void } } }).SmartCto?.flowExceptionRecord?.clearFlowException?.(
    caseKeyForException,
  );

  const restore = (globalThis as unknown as { restoreItemFromSnapshot?: (k: string, snap: Item) => void }).restoreItemFromSnapshot;
  if (typeof restore === 'function') restore(persistKey, updated as Item);

  const startMsg = buildTaskStartNotificationMessage();
  startMsg.confirmed = true;
  const saveChat = (globalThis as unknown as { saveProblemDetailChat?: (k: string, m: Msg[]) => void }).saveProblemDetailChat;
  if (typeof saveChat === 'function') saveChat(chatKey || persistKey, [startMsg as Msg]);

  const summaryLookup = String((dataItem as { createdAt?: unknown }).createdAt || '') || persistKey;
  const adapter = (globalThis as unknown as { STORAGE_HTTP_ADAPTER?: { removeTaskSummaryEntriesForRestart?: (a: string, b: string) => void } }).STORAGE_HTTP_ADAPTER;
  if (adapter && typeof adapter.removeTaskSummaryEntriesForRestart === 'function') {
    adapter.removeTaskSummaryEntriesForRestart(summaryLookup, taskId);
  }

  try {
    globalThis.dispatchEvent(new CustomEvent('problemCasesChanged'));
  } catch {
    /* ignore */
  }

  try {
    console.info('[design-detail:full-restart]', { phase: 'persist_ok', caseId, persistKey });
  } catch {
    /* ignore */
  }

  return true;
}

function registerProblemDetailRestartApi(): void {
  const g = globalThis as unknown as { SmartCto?: { problemDetailRestart?: unknown } };
  g.SmartCto = g.SmartCto || {};
  g.SmartCto.problemDetailRestart = {
    applyRestartCurrentForCaseId,
    applyDesignDetailFullSessionResetForCaseId,
  };
}

registerProblemDetailRestartApi();
