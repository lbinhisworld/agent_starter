/**
 * [INPUT]: problem-cases/types（ProblemCase、ProblemCaseMessage）
 * [OUTPUT]: 按任务回退时的消息过滤与案例字段补丁（与 frontend main.js 语义对齐）
 * [POS]: ProblemCase rollback 专用纯函数，供 ProblemCaseService 调用
 *
 * [PROTOCOL]: 一旦回退语义或任务顺序变更，必须同步更新此文件与 frontend 的 buildItemAfterRollbackToTaskId / filterChatMessagesAfterRollback
 * FE-20260324-09：task11 回退清空 `coreBusinessObjectSystemPromptOverride`；`inferFrontendTaskIdFromMessage` 识别 `coreBusinessObjectModificationRegenerateNotifyBlock`；`buildRollbackCasePatch` 写入该字段 null 清空
 * FE-20260326：`inferFrontendTaskIdFromMessage` 将 `rolePermissionAuditResultBlock` / `rolePermissionModificationActionBlock` / `rolePermissionModificationLlmQueryBlock` 归入 task10（与前端沟通历史一致）
 * FE-20260401：`e2eTransactionFlowLlmPromptBlock` 归入 task7（与前端 task7 事务流生成前完整提示词块一致）
 * FE-20260418：`buildRollbackCasePatch` 在回退目标非 task1 时省略 `basicInfo`（仅「从 task1 起」的链会清空 basicInfo）；不依赖引用相等，避免 getById 合并导致误判仍写入巨型 JSON
 * FE-20260412：回退经过 task7 时清空 `e2eTransactionFlowJson` / `e2eRequirementScenarioSupplementJson` / `e2eFlowLandscapeJson` / `e2eFlowWorkspaceSuppressed`，与前端 task7 产物清零一致
 * FE-20260401-50：`e2eTransactionFlowSessionsBlock` / `task7LlmQueryBlock` 归入 task7
 * FE-20260403：`itDesignSupplementSessionsBlock` / `itDesignSupplementAllDoneConfirmBlock` 归入 task8（与前端 IT设计补齐 Session 主路径一致）
 * FE-20260415：回退/重启 task8 时清空 `itDesignSupplementSessions` 并写入 `buildRollbackCasePatch`；`inferFrontendTaskIdFromMessage` 补 `itDesignBpmDrawSessionsBlock` 及与前端一致的 task8 无 type 系统句
 */
import type { ProblemCase, ProblemCaseMessage, UpdateProblemCaseInput } from './types';

/** 与前端 FOLLOW_TASKS + ITGAP_HISTORY_TASKS + IT_STRATEGY_TASKS 顺序一致 */
export const FRONTEND_TASK_ORDER = [
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
] as const;

/** 路由 / API 中的 taskId（含 e2e-flow）；历史 strategy-0/1、task11 已归一为 task12（首个 IT 策略任务） */
export function pathTaskIdToFrontendTaskId(pathId: string): string {
  const m: Record<string, string> = {
    'e2e-flow': 'task7',
    'global-itgap': 'task8',
    'local-itgap': 'task9',
    'strategy-0': 'task12',
    'strategy-1': 'task12',
  };
  return m[pathId] ?? pathId;
}

function getMajorStageByTaskId(taskId: string): number {
  if (['task1', 'task2', 'task3'].includes(taskId)) return 0;
  if (['task4', 'task5', 'task6'].includes(taskId)) return 1;
  if (['task7', 'task8', 'task9'].includes(taskId)) return 2;
  if (['task12', 'task13', 'task14', 'task15'].includes(taskId)) return 3;
  return 0;
}

function normalizeTaskIdForHistory(taskId: string | null | undefined): string | null {
  const raw = taskId == null ? '' : String(taskId).trim();
  if (!raw) return null;
  if (raw === 'e2e-flow') return 'task7';
  if (raw === 'global-itgap') return 'task8';
  if (raw === 'local-itgap') return 'task9';
  if (raw === 'task10' || raw === 'strategy-0' || raw === 'task11' || raw === 'strategy-1') return 'task12';
  const strategyMatch = raw.match(/^strategy-(\d+)$/);
  if (strategyMatch) {
    const strategyIndex = Number(strategyMatch[1]);
    if (Number.isInteger(strategyIndex) && strategyIndex >= 2 && strategyIndex <= 5) {
      return `task${String(strategyIndex + 10)}`;
    }
    if (strategyIndex === 0 || strategyIndex === 1) return 'task12';
  }
  return raw;
}

/** 对齐 frontend/js/communication-history.js 的 inferTaskIdFromMessage */
export function inferFrontendTaskIdFromMessage(msg: ProblemCaseMessage): string | null {
  if (!msg) return null;
  const anyMsg = msg as Record<string, unknown>;
  if (anyMsg._taskId) return normalizeTaskIdForHistory(String(anyMsg._taskId));
  const type = msg.type;
  const role = msg.role;
  const content = typeof msg.content === 'string' ? msg.content : '';
  const data = anyMsg.data as { taskId?: string } | undefined;
  if (type === 'task1LlmQueryBlock') return 'task1';
  if (type === 'task2LlmQueryBlock') return 'task2';
  if (type === 'task3LlmQueryBlock') return 'task3';
  if (type === 'task4LlmQueryBlock') return 'task4';
  if (type === 'task4ValueStreamPromptJsonBlock') return 'task4';
  if (type === 'task7LlmQueryBlock') return 'task7';
  if (type === 'task5LlmQueryBlock') return 'task5';
  if (type === 'task6LlmQueryBlock') return 'task6';
  if (type === 'task8LlmQueryBlock') return 'task8';
  if (type === 'task9LlmQueryBlock') return 'task9';
  if (type === 'task11LlmQueryBlock') return 'task12';
  if (
    type === 'basicInfoCard' ||
    type === 'basicInfoJsonBlock' ||
    (role === 'system' && (content === '解析完成' || content === '基本信息 json 提取完毕'))
  ) {
    return 'task1';
  }
  if (
    type === 'bmcCard' ||
    type === 'bmcStartBlock' ||
    type === 'bmcDiscussionStartBlock' ||
    type === 'bmcDiscussionReplyBlock' ||
    type === 'bmcDiscussionLlmQueryBlock' ||
    type === 'bmcDiscussionEndBlock' ||
    (role === 'system' && content.includes('BMC'))
  ) {
    return 'task2';
  }
  if (type === 'requirementLogicBlock' || type === 'requirementLogicStartBlock') return 'task3';
  if (
    type === 'valueStreamCard' ||
    type === 'valueStreamDrawSessionsBlock' ||
    type === 'valueStreamConfirmLog' ||
    type === 'drawValueStreamStartBlock' ||
    type === 'valueStreamStartBlock' ||
    (role === 'system' && (content.includes('价值流') || content.includes('绘制')))
  ) {
    return 'task4';
  }
  if (
    type === 'itStatusStartBlock' ||
    type === 'itStatusOutputLog' ||
    type === 'itStatusCard' ||
    type === 'itStatusModificationRegenerateNotifyBlock' ||
    (role === 'system' && (content === 'IT 现状标注完成' || content === 'IT 现状标注失败'))
  ) {
    return 'task5';
  }
  if (
    type === 'painPointStartBlock' ||
    type === 'painPointStepCard' ||
    type === 'painPointSessionsBlock' ||
    type === 'painPointAllDoneConfirmBlock' ||
    (role === 'system' &&
      (content === '痛点标注完成' ||
        content === '痛点标注完毕' ||
        content === '痛点标注失败' ||
        (content.includes('正在标注环节') && content.includes('痛点'))))
  ) {
    return 'task6';
  }
  if (type === 'intentExtractionCard' && data?.taskId) return normalizeTaskIdForHistory(data.taskId);
  if (type === 'e2eFlowGeneratedLog') return 'task7';
  if (
    type === 'e2eFlowExtractStartBlock' ||
    type === 'e2eBusinessFlowIntentBlock' ||
    type === 'e2eTransactionFlowSessionsBlock' ||
    type === 'e2ePrelimFvsCompletenessSessionsBlock' ||
    type === 'e2ePrelimFvsCompletenessAllDoneConfirmBlock' ||
    type === 'e2eTransactionFlowLlmPromptBlock' ||
    type === 'e2eBusinessFlowLlmStartBlock' ||
    type === 'e2eFlowJsonBlock' ||
    type === 'e2eFlowCompressionBlock' ||
    type === 'e2eFlowCompressionStartBlock'
  ) {
    return 'task7';
  }
  if (
    type === 'globalItGapStartBlock' ||
    type === 'globalItGapPhasePlanBlock' ||
    type === 'globalItGapAnalysisCard' ||
    type === 'globalItGapAnalysisLog' ||
    type === 'globalItGapContextLog' ||
    type === 'globalItGapCompressionBlock' ||
    type === 'itDesignSupplementSessionsBlock' ||
    type === 'itDesignBpmDrawSessionsBlock' ||
    type === 'itDesignSupplementAllDoneConfirmBlock'
  ) {
    return 'task8';
  }
  if (
    type === 'localItGapStartBlock' ||
    type === 'localItGapSessionsBlock' ||
    type === 'localItGapInputBlock' ||
    type === 'localItGapOutputBlock' ||
    type === 'localItGapAnalysisCard' ||
    type === 'localItGapAnalysisLog' ||
    type === 'localItGapContextLog' ||
    type === 'localItGapContextBlock' ||
    type === 'localItGapAllDoneConfirmBlock' ||
    type === 'localItGapTaskCompleteConfirmBlock' ||
    type === 'localItGapCompressionIntentBlock' ||
    type === 'localItGapCompressionBlock' ||
    type === 'roleTaskCenterDesignIntentBlock'
  ) {
    return 'task9';
  }
  if (
    type === 'rolePermissionStartBlock' ||
    type === 'rolePermissionCard' ||
    type === 'rolePermissionSessionsBlock' ||
    type === 'rolePermissionAnalysisCard' ||
    type === 'rolePermissionConfirmedLog' ||
    type === 'rolePermissionAllDoneBlock' ||
    type === 'rolePermissionAuditIntentBlock' ||
    type === 'rolePermissionAuditLlmQueryBlock' ||
    type === 'rolePermissionAuditResultBlock' ||
    type === 'rolePermissionModificationActionBlock' ||
    type === 'rolePermissionModificationLlmQueryBlock'
  ) {
    return 'task12';
  }
  if (
    type === 'coreBusinessObjectContextBlock' ||
    type === 'coreBusinessObjectSessionsBlock' ||
    type === 'coreBusinessObjectAnalysisCard' ||
    type === 'coreBusinessObjectAllDoneBlock' ||
    type === 'coreBusinessObjectModificationRegenerateNotifyBlock'
  ) {
    return 'task12';
  }
  if (type === 'globalArchitectureContextBlock') return 'task12';
  if (type === 'taskContextBlock') return normalizeTaskIdForHistory(msg.taskId) || null;
  if (type === 'taskCompleteBlock' || type === 'taskCompletionConfirmBlock') {
    return normalizeTaskIdForHistory(msg.taskId) || null;
  }
  if (type === 'unsatisfiedBlock' || type === 'modificationResponseBlock') {
    return normalizeTaskIdForHistory(msg.taskId) || null;
  }
  if (type === 'taskStartNotification' && msg.taskId) {
    return normalizeTaskIdForHistory(msg.taskId) || String(msg.taskId);
  }
  if (role === 'system' && typeof content === 'string') {
    const c = content;
    if (
      c.includes('全局 ITGap 分析失败') ||
      c.includes('IT设计补齐失败') ||
      c.includes('BPM 流程绘制失败') ||
      c.includes('全局 ITGap 架构约束底座压缩失败') ||
      c.includes('IT设计补齐·架构约束底座压缩失败')
    ) {
      return 'task8';
    }
    if (
      (c.includes('请先配置 AI') || c.includes('未配置 AI')) &&
      (c.includes('全局 ITGap') || c.includes('IT设计补齐'))
    ) {
      return 'task8';
    }
    if (c.includes('未配置 AI') && c.includes('架构约束底座')) return 'task8';
    if (c.includes('正在对事务【') && c.includes('IT设计补齐')) return 'task8';
    if (c.includes('正在绘制事务【') && c.includes('BPM')) return 'task8';
    if (c.includes('端到端全景观提炼失败') || (c.includes('端到端') && c.includes('压缩') && c.includes('失败'))) return 'task7';
    if (
      c.includes('端到端流程 json 数据压缩') ||
      c.includes('正在进行端到端流程') ||
      c.includes('端到端事务流 json 数据压缩') ||
      c.includes('正在进行端到端事务流')
    ) {
      return 'task7';
    }
    if (c.includes('端到端全景观提炼需要先配置 AI')) return 'task7';
    if (
      c.includes('角色汇总设计失败') ||
      c.includes('角色汇总设计压缩失败') ||
      c.includes('对象状态机构建失败') ||
      c.includes('对象状态机构建压缩失败') ||
      c.includes('局部 ITGap 分析失败') ||
      c.includes('局部 ITGap 压缩失败')
    )
      return 'task9';
    if (
      (c.includes('角色汇总设计功能') ||
        c.includes('对象状态机构建功能') ||
        c.includes('局部 ITGap 分析功能')) &&
      (c.includes('配置') || c.includes('DEEPSEEK'))
    )
      return 'task9';
    if (c.includes('正在分析环节')) return 'task9';
    if (c.includes('正在进行') && c.includes('角色与权限')) return 'task12';
    if (c.includes('角色与权限模型推演失败')) return 'task12';
    if (c.includes('正在进行') && c.includes('核心业务对象推演')) return 'task12';
    if (c.includes('核心业务对象推演失败')) return 'task12';
    if (c.includes('根据讨论重新生成 BMC 失败')) return 'task2';
    if (c.includes('需求逻辑构建失败')) return 'task3';
  }
  return null;
}

function explicitFrontendTaskId(msg: ProblemCaseMessage): string | null {
  const ex = msg.taskId;
  if (ex == null || ex === '') return null;
  return normalizeTaskIdForHistory(String(ex)) || String(ex);
}

/**
 * 删除「目标 task 及之后」所有任务相关消息（含 taskStartNotification、无显式 taskId 但落在已清除上下文的 user/系统句）
 * 与 frontend filterChatMessagesAfterRollback 一致
 */
export function filterMessagesAfterRollback(messages: ProblemCaseMessage[], targetFrontendTaskId: string): ProblemCaseMessage[] {
  if (!Array.isArray(messages) || !targetFrontendTaskId) return messages || [];
  const order = FRONTEND_TASK_ORDER as readonly string[];
  const targetIdx = order.indexOf(targetFrontendTaskId);
  if (targetIdx < 0) return messages;
  const taskIdsToRemove = new Set(order.slice(targetIdx));
  let ctxTask = 'task1';
  return messages.filter((msg) => {
    if (!msg) return true;
    const anyMsg = msg as Record<string, unknown>;
    if (anyMsg.askMode === true) return true;
    const inferred = inferFrontendTaskIdFromMessage(msg);
    const explicitStr = explicitFrontendTaskId(msg) || '';
    const mid = explicitStr || inferred;
    let remove = false;
    if (mid && taskIdsToRemove.has(mid)) remove = true;
    else if (
      !explicitStr &&
      !inferred &&
      ctxTask &&
      taskIdsToRemove.has(ctxTask) &&
      (msg.role === 'user' || (msg.role === 'system' && !msg.type))
    ) {
      remove = true;
    }
    if (msg.type === 'taskStartNotification' && msg.taskId) {
      ctxTask = pathTaskIdToFrontendTaskId(String(msg.taskId));
    } else if (inferred) {
      ctxTask = inferred;
    }
    return !remove;
  });
}

/** 单步清空：对齐 frontend buildItemAfterRollbackToTask（仅写入 Prisma 存在的字段） */
function applyRollbackSingleTaskToCase(item: ProblemCase, prevTaskId: string): ProblemCase {
  const completed = item.completedStages || [];
  const wfCompleted = item.workflowAlignCompletedStages || [];
  const itGapCompleted = item.itGapCompletedStages || [];
  const completedTaskIds = item.completedTaskIds || [];
  let nextItem: ProblemCase = { ...item };

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
      nextItem = { ...nextItem, workflowAlignCompletedStages: wfCompleted.filter((x) => x !== 1) };
      const vs = nextItem.valueStream as Record<string, unknown> | undefined;
      if (vs && !vs.raw && (vs.stages || vs.phases || vs.nodes)) {
        const rawStages = (vs.stages ?? vs.phases ?? vs.nodes) as unknown[];
        if (Array.isArray(rawStages)) {
          const stages = rawStages.map((s) => {
            if (!s || typeof s !== 'object') return s;
            const stage = s as Record<string, unknown>;
            const rawSteps = (stage.steps ?? stage.tasks ?? stage.phases ?? stage.items) as unknown[];
            if (!Array.isArray(rawSteps)) return s;
            const steps = rawSteps.map((st) => {
              if (typeof st !== 'object' || st == null) return st;
              const step = st as Record<string, unknown>;
              const { itStatus: _a, it_status: _b, ...rest } = step;
              return rest;
            });
            return { ...stage, steps };
          });
          nextItem = { ...nextItem, valueStream: { ...vs, stages } };
        }
      }
      break;
    }
    case 'task6': {
      nextItem = { ...nextItem, workflowAlignCompletedStages: wfCompleted.filter((x) => x !== 2) };
      const vs = nextItem.valueStream as Record<string, unknown> | undefined;
      if (vs && !vs.raw && (vs.stages || vs.phases || vs.nodes)) {
        const rawStages = (vs.stages ?? vs.phases ?? vs.nodes) as unknown[];
        if (Array.isArray(rawStages)) {
          const stages = rawStages.map((s) => {
            if (!s || typeof s !== 'object') return s;
            const stage = s as Record<string, unknown>;
            const rawSteps = (stage.steps ?? stage.tasks ?? stage.phases ?? stage.items) as unknown[];
            if (!Array.isArray(rawSteps)) return s;
            const steps = rawSteps.map((st) => {
              if (typeof st !== 'object' || st == null) return st;
              const step = st as Record<string, unknown>;
              const { painPoint: _p, pain_point: _q, ...rest } = step;
              return rest;
            });
            return { ...stage, steps };
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
        e2eFlowWorkspaceSuppressed: undefined,
      };
      break;
    case 'task8':
      nextItem = {
        ...nextItem,
        globalItGapAnalysisJson: undefined,
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
        objectStateMachineJson: undefined,
        itGapCompletedStages: itGapCompleted.filter((x) => x !== 2),
      };
      break;
    case 'task12': {
      const prevRpSessions = nextItem.rolePermissionSessions;
      const clearedRpSessions = Array.isArray(prevRpSessions)
        ? prevRpSessions.map((s) =>
            s && typeof s === 'object' ? { ...(s as object), rolePermissionJson: undefined } : s,
          )
        : undefined;
      const prevCboSessions = Array.isArray(nextItem.coreBusinessObjectSessions)
        ? (nextItem.coreBusinessObjectSessions as unknown[])
        : [];
      const sessions = prevCboSessions.map((s: unknown) => ({
        ...(typeof s === 'object' && s !== null ? (s as Record<string, unknown>) : {}),
        coreBusinessObjectJson: null,
      }));
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

  nextItem = { ...nextItem, currentMajorStage: getMajorStageByTaskId(prevTaskId) };
  return nextItem;
}

/** 生成写入 DB 的补丁：JSON 清空用 null 以便 Prisma 落库 */
export function buildRollbackCasePatch(item: ProblemCase, targetFrontendTaskId: string): UpdateProblemCaseInput {
  const order = FRONTEND_TASK_ORDER as readonly string[];
  const targetIdx = order.indexOf(targetFrontendTaskId);
  if (targetIdx < 0) return {};

  let next: ProblemCase = { ...item };
  for (let i = targetIdx; i < FRONTEND_TASK_ORDER.length; i++) {
    next = applyRollbackSingleTaskToCase(next, FRONTEND_TASK_ORDER[i]);
  }
  next = { ...next, currentMajorStage: getMajorStageByTaskId(targetFrontendTaskId) };

  const jsonNull = (v: unknown) => (v === undefined ? null : v);

  // null 用于清空可空列；与 UpdateProblemCaseInput 字面类型略有出入，运行时与 Prisma 一致
  const patch = {
    currentMajorStage: next.currentMajorStage,
    completedStages: next.completedStages,
    workflowAlignCompletedStages: next.workflowAlignCompletedStages,
    itGapCompletedStages: next.itGapCompletedStages,
    completedTaskIds: next.completedTaskIds,
    basicInfo: jsonNull(next.basicInfo) as unknown,
    bmc: jsonNull(next.bmc) as unknown,
    requirementLogic: jsonNull(next.requirementLogic) as unknown,
    valueStream: jsonNull(next.valueStream) as unknown,
    e2eFlowWorkspaceSuppressed: jsonNull(next.e2eFlowWorkspaceSuppressed),
    e2eFlowLandscapeJson: jsonNull(next.e2eFlowLandscapeJson) as unknown,
    e2eTransactionFlowJson: jsonNull(next.e2eTransactionFlowJson) as unknown,
    e2eRequirementScenarioSupplementJson: jsonNull(next.e2eRequirementScenarioSupplementJson) as unknown,
    globalItGapAnalysisJson: jsonNull(next.globalItGapAnalysisJson) as unknown,
    itDesignSupplementSessions: jsonNull(next.itDesignSupplementSessions) as unknown,
    localItGapSessions: jsonNull(next.localItGapSessions) as unknown,
    localItGapAnalyses: jsonNull(next.localItGapAnalyses) as unknown,
    roleTaskCenterPortalDesignJson: jsonNull(next.roleTaskCenterPortalDesignJson) as unknown,
    objectStateMachineJson: jsonNull(next.objectStateMachineJson) as unknown,
    rolePermissionSessions: jsonNull(next.rolePermissionSessions) as unknown,
    coreBusinessObjectSessions: jsonNull(next.coreBusinessObjectSessions) as unknown,
    coreBusinessObjectSystemPromptOverride: jsonNull(next.coreBusinessObjectSystemPromptOverride) as unknown as
      | string
      | undefined,
  } as UpdateProblemCaseInput;

  // 仅回退到 task1 时，apply 链才会执行 task1 步清空 basicInfo；回退到 task2 及更后起点时链从 task2 起，从不改 basicInfo，勿带该键写库（避免无意义重写超大 basicInfo → 500）
  if (targetFrontendTaskId !== 'task1') {
    delete (patch as Record<string, unknown>).basicInfo;
  }

  return patch;
}
