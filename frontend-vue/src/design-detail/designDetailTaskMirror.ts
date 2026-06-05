/**
 * [INPUT]: bundle.item、持久化聊天消息、全局 `getDigitalProblems`/`saveProblemDetailChat`（同源 storage 链）；`designDetailProgressGovernance.ts`（存储键/工商门控）；`designModeTaskPipeline.ts`（设计任务线展示名）；`designDetailLlmStats.ts`（本页 `task1LlmQueryBlock` 备注名常量，供重启修剪）
 * [OUTPUT]: task1 门控与通知补写、列表项合并、尾随未确认工商卡修剪（`pruneTrailingUnconfirmedBasicInfoForDesignResubmit`）、「重启当前」用 **`pruneDesignDetailPersistedChatForRestart`** / **`pruneDesignDetailPersistedChatForRestartAtLineTask`** 从持久化聊天按锚点剔除本页 `task1LlmQueryBlock` 并链式去尾随未确认 `basicInfoCard`；**不导出**全案「首个未完成任务」推导（设计页任务线独立步进）
 * [POS]: 设计详情页 task1 专用编排与持久化辅助（不加载 main.js）
 *
 * [PROTOCOL]: 变更 task1 完成判定、task1 通知契约、设计页工商门控、**客户需求阶段门控**（`canDesignPageRunTask1CustomerRequirementParse` / `DesignDetailCustomerRequirementPhase`）时须同步本文件与 `design-detail/AGENTS.md`；任务动态卡 task1 进度区仅首行 + 本地 tail + 完成行（见 `useDesignDetailChat.ts`）；与 `designDetailLineState.ts`、`designModeTaskPipeline.ts`、`designDetailLineInference.ts`、`design_mode_tasks.md` 一致；全案顺序仅允许出现在 `problemDetailRestartFromCase.ts` 的持久化回退路径（与设计页 **13 步**任务线无关）
 */

import {
  formatChatTimestampForMessage,
  getProblemDetailChatStorageKey,
  hasTask1BasicInfoFields,
  looksLikeTask1BasicInfoInput,
} from './designDetailProgressGovernance';
import type { DesignDetailCustomerRequirementPhase } from './designDetailCustomerRequirementPhase';
import {
  DESIGN_DETAIL_BMC_NOTE,
  DESIGN_DETAIL_BUSINESS_EXTRACT_NOTE,
  DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE,
} from './designDetailLlmStats';
import { designLineTaskDisplayName, type DesignDetailLineTaskId } from './designModeTaskPipeline';

export const TASK1_ID = 'task1';
/** 与 `designModeTaskPipeline` 第一条设计任务线展示名一致，不读全案 FOLLOW_TASKS */
export const TASK1_DISPLAY_NAME = '客户基本情况了解';

export { getProblemDetailChatStorageKey };

export function resolveTask1DisplayName(): string {
  return designLineTaskDisplayName('customer_basic');
}

function mergeCompletedStageArrays(a: unknown, b: unknown): number[] {
  return [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])].sort(
    (x: number, y: number) => x - y,
  );
}

/** 与列表项合并：id 或 createdAt 任一为真即可与 `getDigitalProblems()` 快照对齐。 */
export function mergeResolvedItemForDesign(item: Record<string, unknown>): Record<string, unknown> | null {
  const cur = item;
  if (!cur || (!cur.id && !cur.createdAt)) return null;
  const list =
    typeof window !== 'undefined' && typeof (window as unknown as { getDigitalProblems?: () => unknown[] }).getDigitalProblems === 'function'
      ? (window as unknown as { getDigitalProblems: () => Record<string, unknown>[] }).getDigitalProblems()
      : [];
  const fromList = list.find(
    (p) =>
      (cur.id && p.id && String(p.id) === String(cur.id)) ||
      String(p.createdAt) === String(cur.createdAt) ||
      (cur.id && String(p.createdAt) === String(cur.id)) ||
      (p.id && String(p.createdAt) === String(cur.id)),
  );
  if (!fromList) return { ...cur };
  const a = fromList.completedTaskIds || [];
  const b = cur.completedTaskIds || [];
  const mergedIds = [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])].sort();
  const mergedWf = mergeCompletedStageArrays(fromList.workflowAlignCompletedStages, cur.workflowAlignCompletedStages);
  const mergedItGap = mergeCompletedStageArrays(fromList.itGapCompletedStages, cur.itGapCompletedStages);
  const mergedReqStages = mergeCompletedStageArrays(fromList.completedStages, cur.completedStages);
  const mergedMajorStage = Math.max(Number(fromList.currentMajorStage) || 0, Number(cur.currentMajorStage) || 0);
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
    objectStateMachineJson: cur.objectStateMachineJson ?? fromList.objectStateMachineJson,
    completedTaskIds: mergedIds,
    workflowAlignCompletedStages: mergedWf,
    itGapCompletedStages: mergedItGap,
    completedStages: mergedReqStages,
  };
}

/** 自 `main.js::isTaskCompleted` 移植（task1 分支可读 `messages`） */
export function isTaskCompleted(
  item: Record<string, unknown> | null | undefined,
  taskId: string,
  messages?: Array<Record<string, unknown>>,
): boolean {
  if (!item) return false;
  const completed = (item.completedStages as number[] | undefined) || [];
  const wfCompleted = (item.workflowAlignCompletedStages as number[] | undefined) || [];
  const itGapCompleted = (item.itGapCompletedStages as number[] | undefined) || [];
  const msgs = Array.isArray(messages) ? messages : [];
  switch (taskId) {
    case 'task1': {
      if (Number(item.currentMajorStage ?? 0) > 0) return true;
      const ids = (item.completedTaskIds as string[] | undefined) || [];
      if (ids.includes('task1')) return true;
      if (Array.isArray(messages)) {
        if (msgs.some((m) => m?.type === 'taskCompleteBlock' && m.taskId === 'task1')) return true;
        if (
          msgs.some(
            (m) => m?.type === 'taskCompletionConfirmBlock' && m.taskId === 'task1' && (m as { confirmed?: boolean }).confirmed,
          )
        ) {
          return true;
        }
      }
      const hasBmc =
        item.bmc && typeof item.bmc === 'object' && Object.keys(item.bmc as object).length > 0;
      if (completed.includes(0) && hasBmc) return true;
      return false;
    }
    case 'task2':
      return completed.includes(1) || !!(item.bmc && typeof item.bmc === 'object');
    case 'task3':
      return completed.includes(2);
    case 'task4':
      return wfCompleted.includes(0) && !!(item.valueStream && !(item.valueStream as { raw?: unknown }).raw);
    case 'task5':
      return wfCompleted.includes(1);
    case 'task6':
      return wfCompleted.includes(2);
    case 'task7':
      return itGapCompleted.includes(0);
    case 'task8': {
      const msgsFor8 = msgs;
      const useStrict =
        (Array.isArray(item.itDesignSupplementSessions) && (item.itDesignSupplementSessions as unknown[]).length > 0) ||
        msgsFor8.some((m) => m && m.type === 'itDesignSupplementSessionsBlock');
      const hasFormal =
        (Array.isArray(item.itGapCompletedStages) && item.itGapCompletedStages.includes(1)) ||
        msgsFor8.some((m) => m?.type === 'taskCompleteBlock' && m.taskId === 'task8') ||
        msgsFor8.some(
          (m) => m?.type === 'taskCompletionConfirmBlock' && m.taskId === 'task8' && (m as { confirmed?: boolean }).confirmed,
        );
      if (useStrict && !hasFormal) return false;
      return !!item.globalItGapAnalysisJson;
    }
    case 'task9':
      return itGapCompleted.includes(2);
    case 'task12':
    case 'task13':
    case 'task14':
    case 'task15': {
      const ids = (item.completedTaskIds as string[] | undefined) || [];
      if (ids.includes(taskId)) return true;
      return false;
    }
    default:
      return false;
  }
}

function task1HasSubstantiveProgressForPhaseBadge(
  item: Record<string, unknown>,
  messages: Array<Record<string, unknown>>,
): boolean {
  const merged = mergeResolvedItemForDesign(item) || item;
  if (!Array.isArray(messages)) return false;
  if (messages.some((m) => m?.type === 'basicInfoCard' && (m as { confirmed?: boolean }).confirmed))
    return true;
  if (messages.some((m) => m?.type === 'task1LlmQueryBlock')) return true;
  if (messages.some((m) => m?.type === 'preliminaryRequirementFollowupBlock')) return true;
  if (messages.some((m) => m?.type === 'modificationRegenerateLlmQueryBlock' && m.taskId === 'task1'))
    return true;
  const checker = (window as unknown as { isPreliminaryRequirementV2Shape?: (x: unknown) => boolean })
    .isPreliminaryRequirementV2Shape;
  if (
    typeof checker === 'function' &&
    checker((merged as { preliminaryReq?: unknown }).preliminaryReq || {})
  ) {
    return true;
  }
  return false;
}

/** 设计页 task1 是否仍属「待执行/进行中」：仅看消息与 item 结构，不读详情步骤条 */
export function getTaskStatusTextTask1Workspace(
  item: Record<string, unknown>,
  messages: Array<Record<string, unknown>>,
): '已完成' | '进行中' | '待执行' {
  const merged = mergeResolvedItemForDesign(item) || item;
  if (isTaskCompleted(merged, 'task1', messages)) return '已完成';

  const msgsSafe = Array.isArray(messages) ? messages : [];

  const startMsgs = msgsSafe.filter(
    (m) => m && m.type === 'taskStartNotification' && String(m.taskId || '') === TASK1_ID,
  );

  if (startMsgs.length > 0) {
    const hasConfirmedStart = startMsgs.some((m) => (m as { confirmed?: boolean }).confirmed);
    if (!hasConfirmedStart) {
      if (task1HasSubstantiveProgressForPhaseBadge(merged, msgsSafe)) return '进行中';
      return '待执行';
    }
    return '进行中';
  }

  if (task1HasSubstantiveProgressForPhaseBadge(merged, msgsSafe)) return '进行中';
  return '待执行';
}

export function hasTaskStartNotificationRow(
  messages: Array<Record<string, unknown>>,
  taskId: string,
): boolean {
  return messages.some(
    (m) => m?.type === 'taskStartNotification' && String(m.taskId || '') === String(taskId),
  );
}

/** 是否应在设计页 hydrate 时补写 task1 `taskStartNotification`（尚无任意 task1 通知行且 task1 未完成） */
export function shouldPersistTask1StartNotification(
  resolvedItem: Record<string, unknown>,
  messages: Array<Record<string, unknown>>,
): boolean {
  const merged = mergeResolvedItemForDesign(resolvedItem) || resolvedItem;
  const task1Incomplete = !isTaskCompleted(merged, 'task1', messages);

  /** 不依赖全案「首个未完成任务」：首页已解析 preliminaryReq 时 workspace 可能为「进行中」，仍须补写以便自动确认启动 */
  if (!merged || !task1Incomplete) return false;
  if (hasTaskStartNotificationRow(messages, TASK1_ID)) return false;

  return true;
}

export function buildTaskStartNotificationMessage(taskName?: string): Record<string, unknown> {
  const tn = (taskName && String(taskName).trim()) || resolveTask1DisplayName();
  const ts = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  return {
    type: 'taskStartNotification',
    taskId: TASK1_ID,
    taskName: tn,
    timestamp: ts,
    confirmed: false,
  };
}

export function formatTaskStartNotifyBody(taskName: string): string {
  return `任务通知：我即将开始【${taskName}】任务`;
}

/** 设计页任务动态卡首行文案 */
export function formatDesignProgressTaskStartLine(taskName: string): string {
  const tn = (taskName && String(taskName).trim()) || resolveTask1DisplayName();
  return `→ 我即将开始【${tn}】`;
}

export async function refreshBundle(caseId: string): Promise<{
  item: Record<string, unknown> | null;
  messages: Array<Record<string, unknown>>;
} | null> {
  const api = (window as unknown as {
    SmartCto?: {
      problemCaseApi?: {
        refreshProblemDetailBundle?: (id: string) => Promise<unknown>;
      };
    };
  }).SmartCto?.problemCaseApi;
  const fn = api?.refreshProblemDetailBundle;
  if (typeof fn !== 'function') return null;
  const bundle = (await fn(caseId)) as {
    item?: Record<string, unknown> | null;
    messages?: Array<Record<string, unknown>>;
  } | null;
  if (!bundle) return null;
  return {
    item: bundle.item ?? null,
    messages: Array.isArray(bundle.messages) ? bundle.messages : [],
  };
}

export function persistChatMessages(chatKey: string, messages: Array<Record<string, unknown>>): void {
  const save =
    typeof window !== 'undefined'
      ? (window as unknown as { saveProblemDetailChat?: (k: string, m: unknown[]) => void }).saveProblemDetailChat
      : undefined;
  if (typeof save === 'function' && chatKey) save(chatKey, messages);
}

/**
 * 设计页再次发送经营信息提取前：去掉**末尾**未确认的 basicInfoCard，并尽量同时去掉其正上方紧邻的工商/设计详情经营提炼 `task1LlmQueryBlock`。
 * 避免详情页遗留未确认卡导致本页门控死锁，也避免重复叠卡。
 */
export function pruneTrailingUnconfirmedBasicInfoForDesignResubmit(
  messages: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const out = messages.slice();
  for (let i = out.length - 1; i >= 0; i--) {
    const m = out[i];
    if (m?.type !== 'basicInfoCard' || (m as { confirmed?: boolean }).confirmed) continue;
    out.splice(i, 1);
    // 不再连带删除上方 task1LlmQueryBlock，保留统计记录
    break;
  }
  return out;
}

/** 设计页「重启当前」时从 `problem_detail_chats` 同源记录中物理删除的 `task1LlmQueryBlock.noteName` 集合 */
const DESIGN_DETAIL_RESTART_PRUNE_NOTE_NAMES = new Set([
  DESIGN_DETAIL_BUSINESS_EXTRACT_NOTE,
  DESIGN_DETAIL_BMC_NOTE,
  DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE,
]);

function isDesignDetailRestartPruneTask1LlmBlock(m: Record<string, unknown>): boolean {
  if (m?.type !== 'task1LlmQueryBlock') return false;
  const nn = String((m as { noteName?: string }).noteName || '').trim();
  return DESIGN_DETAIL_RESTART_PRUNE_NOTE_NAMES.has(nn);
}

/**
 * 设计页「重启当前」：从持久化聊天中**删除**本页写入的设计详情 LLM 块（经营信息提炼 / BMC / 客户需求提炼），
 * 并反复应用 `pruneTrailingUnconfirmedBasicInfoForDesignResubmit` 去掉与之关联的尾随未确认 `basicInfoCard`。
 * 与详情同源存储；仅移除上述类型，不截断用户全文聊天。
 */
export function pruneDesignDetailPersistedChatForRestart(
  messages: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  let out = messages.filter((m) => !isDesignDetailRestartPruneTask1LlmBlock(m));
  let prevLen = -1;
  while (out.length !== prevLen) {
    prevLen = out.length;
    out = pruneTrailingUnconfirmedBasicInfoForDesignResubmit(out);
  }
  return out;
}

/**
 * 设计页「重启当前」按**设计线锚点**修剪同源聊天：
 * - **`customer_basic`**：与 `pruneDesignDetailPersistedChatForRestart` 相同（删三类 `task1LlmQueryBlock` + 尾随未确认工商卡）。
 * - **后续线步**（如任务 2）：**保留**任务 1 相关聊天块，仅链式去掉尾随未确认 `basicInfoCard`（若有）。
 */
export function pruneDesignDetailPersistedChatForRestartAtLineTask(
  anchor: DesignDetailLineTaskId,
  messages: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  if (anchor === 'customer_basic') {
    return pruneDesignDetailPersistedChatForRestart(messages);
  }
  if (anchor === 'all_done') {
    return messages.slice();
  }
  let out = messages.slice();
  let prevLen = -1;
  while (out.length !== prevLen) {
    prevLen = out.length;
    out = pruneTrailingUnconfirmedBasicInfoForDesignResubmit(out);
  }
  return out;
}

function getAllConfiguredTasks(): { id: string; name: string }[] {
  const g = globalThis as unknown as {
    FOLLOW_TASKS?: { id: string; name: string }[];
    ITGAP_HISTORY_TASKS?: { id: string; name: string }[];
    IT_STRATEGY_TASKS?: { id: string; name: string }[];
  };
  return [
    ...(Array.isArray(g.FOLLOW_TASKS) ? g.FOLLOW_TASKS : []),
    ...(Array.isArray(g.ITGAP_HISTORY_TASKS) ? g.ITGAP_HISTORY_TASKS : []),
    ...(Array.isArray(g.IT_STRATEGY_TASKS) ? g.IT_STRATEGY_TASKS : []),
  ];
}

/** 「重启当前」截断聊天后：移除同 taskId 旧 `taskStartNotification` 再追加一条未确认通知 */
export function appendTaskStartNotificationAfterRestart(
  chatKey: string,
  taskId: string,
  messages: Array<Record<string, unknown>>,
): void {
  const rows = getAllConfiguredTasks();
  const task = rows.find((t) => String(t.id) === String(taskId));
  if (!task || !chatKey) return;
  const displayName =
    String(taskId) === TASK1_ID ? designLineTaskDisplayName('customer_basic') : String(task.name || '');
  const next = messages.filter(
    (m) => !(m?.type === 'taskStartNotification' && String((m as { taskId?: string }).taskId || '') === String(taskId)),
  );
  next.push({
    type: 'taskStartNotification',
    taskId: task.id,
    taskName: displayName,
    timestamp: formatChatTimestampForMessage(),
    confirmed: false,
  });
  persistChatMessages(chatKey, next);
}

function task1HasEffectiveV2PreliminaryDesign(item: Record<string, unknown>): boolean {
  const g = globalThis as unknown as {
    isPreliminaryRequirementV2Shape?: (x: unknown) => boolean;
    buildResolvedPreliminaryRequirement?: (x: unknown) => unknown;
  };
  if (typeof g.isPreliminaryRequirementV2Shape !== 'function') return false;
  const top = item.preliminaryReq;
  if (top && typeof top === 'object' && g.isPreliminaryRequirementV2Shape(top)) return true;
  if (typeof g.buildResolvedPreliminaryRequirement === 'function') {
    try {
      const resolved = g.buildResolvedPreliminaryRequirement(item);
      return !!(resolved && g.isPreliminaryRequirementV2Shape(resolved));
    } catch {
      return false;
    }
  }
  return false;
}

/** 与 `problem-detail-runtime.js::isTask1ActivePreliminaryFollowupPhase` 同构（设计页无 __host 依赖） */
export function isTask1ActivePreliminaryFollowupPhaseDesign(
  messages: Array<Record<string, unknown>>,
  dataItem: Record<string, unknown>,
): boolean {
  if (!Array.isArray(messages) || !dataItem) return false;
  if (isTaskCompleted(dataItem, TASK1_ID, messages)) return false;
  if (!task1HasEffectiveV2PreliminaryDesign(dataItem)) return false;
  let lastMarker = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.type === 'preliminaryRequirementFollowupBlock') {
      lastMarker = i;
      break;
    }
    if (m?.role === 'system' && typeof m.content === 'string' && m.content.includes('请继续补充客户需求')) {
      lastMarker = i;
      break;
    }
  }
  if (lastMarker < 0) return false;
  for (let j = lastMarker + 1; j < messages.length; j++) {
    if (messages[j]?.type === 'taskCompleteBlock' && messages[j]?.taskId === TASK1_ID) return false;
  }
  return true;
}

/** task1 设计页发送前公共前置（工商提炼 / 需求提炼 / BMC 补充共用） */
function canDesignPageRunTask1SharedPreSend(
  item: Record<string, unknown>,
  messages: Array<Record<string, unknown>>,
): { ok: boolean; reason?: string } {
  const merged = mergeResolvedItemForDesign(item) || item;
  const task1Pending = !isTaskCompleted(merged, TASK1_ID, messages);
  if (!task1Pending) return { ok: false, reason: 'not_task1' };

  const hasStartConfirmed = messages.some(
    (m) => m?.type === 'taskStartNotification' && String(m.taskId || '') === TASK1_ID && (m as { confirmed?: boolean }).confirmed,
  );
  if (!hasStartConfirmed) return { ok: false, reason: 'task1_start_not_confirmed' };

  const hasV2Prelim = task1HasEffectiveV2PreliminaryDesign(merged);
  const hasConfirmedBasicInfo = hasTask1BasicInfoFields(merged.basicInfo as Record<string, unknown> | undefined);
  const awaitingPrelim =
    hasConfirmedBasicInfo && merged.task1PendingPreliminaryRequirement === true && !hasV2Prelim;
  if (awaitingPrelim) return { ok: false, reason: 'awaiting_preliminary_requirement' };
  if (hasV2Prelim) return { ok: false, reason: 'has_v2_preliminary' };
  if (isTask1ActivePreliminaryFollowupPhaseDesign(messages, merged)) return { ok: false, reason: 'prelim_followup_active' };

  return { ok: true };
}

/** 是否允许设计页走「工商录入 → 提炼 → basicInfoCard」写回持久化聊天 */
export function canDesignPageRunTask1BasicInfoExtract(
  item: Record<string, unknown>,
  messages: Array<Record<string, unknown>>,
  text: string,
  customerRequirementPhase: DesignDetailCustomerRequirementPhase = 'idle',
  /** 进度区已展示「是否继续补充需求」且用户尚未点「是/否」时，禁止发送其它路径 */
  requirementSupplementChoicePending = false,
): { ok: boolean; reason?: string } {
  if (customerRequirementPhase === 'paused') {
    return { ok: false, reason: 'customer_requirement_paused' };
  }
  if (requirementSupplementChoicePending) {
    return { ok: false, reason: 'requirement_supplement_choice_pending' };
  }
  if (customerRequirementPhase === 'awaiting') {
    return { ok: false, reason: 'customer_requirement_awaiting' };
  }
  const pre = canDesignPageRunTask1SharedPreSend(item, messages);
  if (!pre.ok) return pre;

  /** 设计页不要求先去详情页「确认」工商卡；未确认卡由发送前 `pruneTrailingUnconfirmedBasicInfoForDesignResubmit` 清理 */

  if (!looksLikeTask1BasicInfoInput(text)) return { ok: false, reason: 'not_basic_info_like' };

  return { ok: true };
}

/**
 * 设计页任务 1：已确认启动且可走「工商及经营范围」等自由文本时，追加 user 消息并由 `useDesignDetailChat` 触发 BMC 大模型与任务动态尾段；不经工商提炼。
 * 门控与 `canDesignPageRunTask1BasicInfoExtract` 前半段一致，**不**要求 `looksLikeTask1BasicInfoInput`。
 */
export function canDesignPageRunTask1ProgressChatInput(
  item: Record<string, unknown>,
  messages: Array<Record<string, unknown>>,
  text: string,
  customerRequirementPhase: DesignDetailCustomerRequirementPhase = 'idle',
  requirementSupplementChoicePending = false,
): { ok: boolean; reason?: string } {
  if (customerRequirementPhase === 'paused') {
    return { ok: false, reason: 'customer_requirement_paused' };
  }
  if (requirementSupplementChoicePending) {
    return { ok: false, reason: 'requirement_supplement_choice_pending' };
  }
  if (customerRequirementPhase === 'awaiting') {
    return { ok: false, reason: 'customer_requirement_awaiting' };
  }
  const pre = canDesignPageRunTask1SharedPreSend(item, messages);
  if (!pre.ok) return pre;

  /** 不因未确认 basicInfoCard 阻塞；发送前由编排层修剪旧卡 */

  if (!String(text || '').trim()) return { ok: false, reason: 'empty_input' };

  return { ok: true };
}

/**
 * 设计页 task1：画布已展示客户基本信息后，等待用户输入「客户需求」并触发需求提炼 LLM。
 */
export function canDesignPageRunTask1CustomerRequirementParse(
  item: Record<string, unknown>,
  messages: Array<Record<string, unknown>>,
  text: string,
  customerRequirementPhase: DesignDetailCustomerRequirementPhase,
  requirementSupplementChoicePending = false,
): { ok: boolean; reason?: string } {
  if (customerRequirementPhase === 'paused') return { ok: false, reason: 'customer_requirement_paused' };
  if (requirementSupplementChoicePending) return { ok: false, reason: 'requirement_supplement_choice_pending' };
  if (customerRequirementPhase !== 'awaiting') return { ok: false, reason: 'customer_requirement_phase' };
  const pre = canDesignPageRunTask1SharedPreSend(item, messages);
  if (!pre.ok) return pre;
  if (!String(text || '').trim()) return { ok: false, reason: 'empty_input' };
  return { ok: true };
}
