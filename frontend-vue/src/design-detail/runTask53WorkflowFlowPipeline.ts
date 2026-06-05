/**
 * [INPUT]: 任务 5.3 流水线依赖（由 `useDesignDetailChat` 注入）
 * [OUTPUT]: `runTask53WorkflowFlowPipeline` — 按任务 1 运营模式业务流程循环 LLM → 合并落库
 * [POS]: 任务 5.2 收官后、任务 5.5 之前；落库后刷新「现状理解」第三层；Feature_Key＝关键工作流
 *
 * [PROTOCOL]: 进度 UI 对齐任务 5.2；变更时同步 `buildTask53WorkflowFlowInferenceInputFromTaskGraph.ts`、`useDesignDetailChat.ts`
 */

import {
  pickTask51FeaturesFromGraphTasks,
  pickTask52FieldSetFeaturesFromGraphTasks,
} from './buildTask52AssetFieldSetInferenceInputFromTaskGraph';
import {
  buildTask53BusinessProcessSubtaskList,
  buildTask53SingleProcessInferenceUserBlock,
  task53ProcessUnderstandingProgressLine,
} from './buildTask53WorkflowFlowInferenceInputFromTaskGraph';
import {
  isTask53ProcessProgressLineForProcess,
  TASK53_PROGRESS_START_LINE,
} from './designDetailTask53ProgressLineMigrate';
import {
  buildTask53ProcessUnderstandingCallTarget,
  DESIGN_DETAIL_TASK53_LLM_AUDIT_TASK_ID,
} from './designDetailLlmStats';
import {
  mergeL53WorkflowFlowRawOutputsForServerSync,
  normalizeLogicGraphTasksFromApiPayload,
  parseTask53L3TokenValidationMappingForAlignment,
  task2L1AllValidationRowsResolved,
  task2L1FilterPotentialConflictRows,
  type Task2L1TvmParsedRow,
} from './designDetailTask2L1SyncUiProgress';
import {
  buildTask53L3TargetKvSyncAlignmentMeta,
  mergeTargetKvSyncBodyWithAlignmentMeta,
} from './designDetailTargetKvSyncAlignmentMeta';
import type { DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import { isDesignDetailDebugExperienceActive } from './designDetailExperienceMode';
import {
  hasFeatureInferenceConclusionOrganizeLine,
  INFERENCE_CONCLUSION_ORGANIZE_LINE,
  pushPipelineFeatureInferenceConclusions,
} from './designDetailFeatureInferenceConclusionProgress';
import type { RunTask9PipelineDeps } from './runTask9L5BlueprintPipeline';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';

type DynamicsLineKind =
  | 'default'
  | 'scope_green'
  | 'bmc_generating'
  | 'task53_inference_sub'
  | 'inference_conclusion_sub';

export type RunTask53PipelineDeps = Omit<
  RunTask9PipelineDeps,
  'exitTask9PipelineIfSessionStale' | 'withTask9L5DynamicsCard' | 'removeTask9L5LlmWorkingSpinnerLine' | 'removeTask9L5SyncSpinnerLine'
> & {
  exitTask53PipelineIfSessionStale: (rawId: string, epochAtStart: number) => boolean;
  withTask53L3DynamicsCard: (fn: (card: RunTask9PipelineDeps['cloneDynamics'] extends () => infer C ? C extends (infer U)[] ? U : never : never) => void, rawId: string) => void;
  removeTask53L3LlmWorkingSpinnerLine: (rawId: string) => void;
  removeTask53L3SyncSpinnerLine: (rawId: string) => void;
  onTask53Done?: (
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    opts?: { deferDebugContinue?: boolean; deferAlignmentQuestionnaire?: boolean },
  ) => Promise<void>;
  pipelineOpts?: { deferAlignmentQuestionnaire?: boolean };
  stashAlignmentPainTargetsForLineTask?: (
    caseId: string,
    lineTaskId: string,
    rows: Task2L1TvmParsedRow[],
  ) => void;
  pickTask1Task2FeaturesFromGraphTasks: (
    tasks: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
  ) => { task1Features: Task2L1TaskGraphFeatureRow[]; task2Features: Task2L1TaskGraphFeatureRow[] };
  /** 调试模式：在「→ 流程理解」子任务下串行推送 JSON / 理解环节链后再绿 ✓ */
  pushTask53ProcessDebugProgressSerial?: (
    rawId: string,
    processName: string,
    processRaw: string,
  ) => Promise<void>;
  /** 调试模式：落库后按流程推送「形成如下正向归纳链接」子行（使用模式不推送） */
  pushTask53ProcessForwardLinkDebugProgressSerial?: (
    rawId: string,
    processNames: readonly string[],
    mergedTasks: DesignDetailLogicGraphTaskDto[],
  ) => Promise<void>;
  /** 5.3 Target_KV 落库成功后刷新「现状理解」第三层业务流程 */
  onTask53CurrentStateCanvasRefresh?: (rawId: string) => void | Promise<void>;
};

const TASK53_START_LINE = TASK53_PROGRESS_START_LINE;
const TASK53_DEBUG_DONE_LINE = '【调试】【任务 5.3】→ 全部业务流程理解完成';
const TASK53_LOGIC_EXTRACT_LINE = '→ 进行任务 5.3 推理逻辑提取与合并落库';
const TASK53_SYNC_LINE = '→ 正在写入任务 5.3 Target_KV 与逻辑链…';
const TASK53_SYNC_OK_LINE = '→ 任务 5.3 Target_KV 与逻辑链已写入服务端';

type Task53ProcessProgressLineRow = {
  full: string;
  bmcGenUi?: 'spinner' | 'check';
  spinnerBlue?: boolean;
};

function touchTask53ProcessProgressLine(
  card: { lines: Task53ProcessProgressLineRow[] },
  processName: string,
  patch: Partial<Pick<Task53ProcessProgressLineRow, 'bmcGenUi' | 'spinnerBlue' | 'full'>>,
): void {
  for (const row of card.lines) {
    if (!isTask53ProcessProgressLineForProcess(row.full, processName)) continue;
    if (patch.full != null) row.full = patch.full;
    if (patch.bmcGenUi !== undefined) row.bmcGenUi = patch.bmcGenUi;
    if (patch.spinnerBlue !== undefined) row.spinnerBlue = patch.spinnerBlue;
  }
}

function markTask53ProcessSubtaskLineInProgress(
  card: { lines: Task53ProcessProgressLineRow[] },
  processName: string,
): void {
  touchTask53ProcessProgressLine(card, processName, {
    full: task53ProcessUnderstandingProgressLine(processName),
    bmcGenUi: 'spinner',
    spinnerBlue: true,
  });
}

function markTask53ProcessSubtaskLineDone(
  card: { lines: Task53ProcessProgressLineRow[] },
  processName: string,
): void {
  touchTask53ProcessProgressLine(card, processName, {
    full: task53ProcessUnderstandingProgressLine(processName),
    bmcGenUi: 'check',
    spinnerBlue: undefined,
  });
}

export async function runTask53WorkflowFlowPipeline(deps: RunTask53PipelineDeps): Promise<void> {
  const {
    designDetailSessionGeneration,
    epochAtStart,
    rawId,
    llmAbort,
    mergedItem,
    isOnlineMode,
    appendLineToCard,
    flushPersistDesignDetailProgressWorkspace,
    withLlmAuditCtx,
    saveDesignDetailLineState,
    reconcileDesignDetailLineTaskId,
    loadDesignDetailLineState,
    setCurrentDesignLineTaskId,
    lastHydratedMessages,
    task1CustomerRequirementPhase,
    logicTreeGraphRefreshTick,
    exitTask53PipelineIfSessionStale,
    withTask53L3DynamicsCard,
    removeTask53L3LlmWorkingSpinnerLine,
    removeTask53L3SyncSpinnerLine,
    waitUntilDynamicsFullyRevealed,
    onTask53Done,
    pipelineOpts,
    stashAlignmentPainTargetsForLineTask,
    pickTask1Task2FeaturesFromGraphTasks: pickTask12,
    pushTask53ProcessDebugProgressSerial,
    pushTask53ProcessForwardLinkDebugProgressSerial,
    onTask53CurrentStateCanvasRefresh,
  } = deps;

  if (designDetailSessionGeneration !== epochAtStart) return;

  let cards = deps.cloneDynamics();
  const hasTask53Card = cards.some((c) => c.lineTaskId === 'key_scenario_temporal_flow_inference');
  if (!hasTask53Card) {
    cards = [
      ...cards,
      {
        key: `key_scenario_temporal_flow_inference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineTaskId: 'key_scenario_temporal_flow_inference',
        status: 'running',
        startedAtMs: Date.now(),
        completedAtMs: null,
        lines: [],
        extraTailConsumed: 0,
        completionQueued: false,
        thanksAppended: false,
      },
    ];
    deps.setDynamicsCards(cards);
  }

  const w = window as unknown as {
    inferDesignDetailL53WorkflowFlowFromContext?: (
      p: Record<string, unknown>,
      fetchOpts?: { signal?: AbortSignal },
    ) => Promise<{ rawOutput?: string; content?: string }>;
  };
  if (typeof w.inferDesignDetailL53WorkflowFlowFromContext !== 'function') {
    withTask53L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 5.3 推理失败：未加载 inferDesignDetailL53WorkflowFlowFromContext',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    return;
  }

  withTask53L3DynamicsCard((card) => {
    appendLineToCard(card, TASK53_START_LINE, 'scope_green', { startFullyRevealed: true });
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  const getGraph = (
    window as unknown as {
      SmartCto?: {
        problemCaseApi?: {
          getDesignDetailTaskGraph?: (id: string) => Promise<{ ok?: boolean; data?: { tasks?: unknown[] } } | null>;
        };
      };
    }
  ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;

  let task51Features: Task2L1TaskGraphFeatureRow[] = [];
  let task52FieldSetFeatures: Task2L1TaskGraphFeatureRow[] = [];
  let processSubtasks: ReturnType<typeof buildTask53BusinessProcessSubtaskList> = [];
  if (typeof getGraph === 'function') {
    try {
      const gr = await getGraph(rawId);
      if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
        task51Features = pickTask51FeaturesFromGraphTasks(gr.data.tasks);
        task52FieldSetFeatures = pickTask52FieldSetFeaturesFromGraphTasks(gr.data.tasks);
        const picked = pickTask12(gr.data.tasks);
        processSubtasks = buildTask53BusinessProcessSubtaskList(picked.task1Features);
      }
    } catch {
      /* 空图仍送模 */
    }
  }

  if (!task52FieldSetFeatures.length) {
    withTask53L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 5.3 推理已跳过：推理图任务 5.2 卡内未解析到「业务能力字段集」特征行（请确认 5.2 已落库）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  if (!processSubtasks.length) {
    withTask53L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 5.3 推理已跳过：任务 1 推理图中未扫描到「运营模式/业务流程/」节点（请确认需求提炼已同步运营模式业务流程化石）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  withTask53L3DynamicsCard((card) => {
    appendLineToCard(
      card,
      `→ 扫描任务 1 运营模式业务流程，共 ${processSubtasks.length} 条流程待理解`,
      'scope_green',
      { startFullyRevealed: true },
    );
    for (const sub of processSubtasks) {
      appendLineToCard(card, task53ProcessUnderstandingProgressLine(sub.processName), 'default', {
        startFullyRevealed: true,
      });
    }
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  const perProcessRawOutputs: string[] = [];

  for (let pi = 0; pi < processSubtasks.length; pi++) {
    const sub = processSubtasks[pi]!;
    withTask53L3DynamicsCard((card) => {
      markTask53ProcessSubtaskLineInProgress(card, sub.processName);
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    const userBlock = buildTask53SingleProcessInferenceUserBlock(
      task52FieldSetFeatures,
      task51Features,
      sub,
    );
    let processRaw = '';
    try {
      const res = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: DESIGN_DETAIL_TASK53_LLM_AUDIT_TASK_ID,
          callTarget: buildTask53ProcessUnderstandingCallTarget(sub.processName),
        },
        () =>
          w.inferDesignDetailL53WorkflowFlowFromContext!(
            { task53InferenceUserBlock: userBlock },
            { signal: llmAbort.signal },
          ),
      );
      if (exitTask53PipelineIfSessionStale(rawId, epochAtStart)) return;
      processRaw = String(res.rawOutput || res.content || '').trim();
      if (!processRaw) {
        throw new Error(`流程「${sub.processName}」模型无输出`);
      }
      perProcessRawOutputs.push(processRaw);
      if (pushTask53ProcessDebugProgressSerial) {
        await pushTask53ProcessDebugProgressSerial(rawId, sub.processName, processRaw);
        if (exitTask53PipelineIfSessionStale(rawId, epochAtStart)) return;
      }
      withTask53L3DynamicsCard((card) => {
        markTask53ProcessSubtaskLineDone(card, sub.processName);
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
    } catch (e) {
      if (exitTask53PipelineIfSessionStale(rawId, epochAtStart)) return;
      removeTask53L3LlmWorkingSpinnerLine(rawId);
      withTask53L3DynamicsCard((card) => {
        appendLineToCard(
          card,
          `→ 流程「${sub.processName}」环节功能理解失败：${e instanceof Error ? e.message : String(e)}`,
          'default',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return;
    }
  }

  removeTask53L3LlmWorkingSpinnerLine(rawId);

  const mergeNorm = mergeL53WorkflowFlowRawOutputsForServerSync(perProcessRawOutputs);
  const l53Raw = mergeNorm.ok ? mergeNorm.normalized : '';

  withTask53L3DynamicsCard((card) => {
    if (isDesignDetailDebugExperienceActive()) {
      appendLineToCard(card, TASK53_DEBUG_DONE_LINE, 'default', { startFullyRevealed: true });
    }
    if (perProcessRawOutputs.length > 1) {
      appendLineToCard(
        card,
        `→ 已合并 ${perProcessRawOutputs.length} 条业务流程的 L3_Workflow_Flow_Matrix（见落库结果）`,
        'default',
        { startFullyRevealed: true },
      );
    }
    appendLineToCard(card, TASK53_LOGIC_EXTRACT_LINE, 'scope_green', { startFullyRevealed: true });
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  if (!mergeNorm.ok) {
    withTask53L3DynamicsCard((card) => {
      appendLineToCard(card, `→ 多流程合并失败：${mergeNorm.message}`, 'default', { startFullyRevealed: true });
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  let allowSyncOk = false;
  if (isOnlineMode() && l53Raw) {
    const postT53 = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            postDesignDetailSyncTask53L3WorkflowFlowTargetKvTokens?: (
              id: string,
              body: Record<string, unknown>,
            ) => Promise<{ ok?: boolean; message?: string; status?: number } | null>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask53L3WorkflowFlowTargetKvTokens;
    if (typeof postT53 === 'function') {
      try {
        withTask53L3DynamicsCard((card) => {
          appendLineToCard(card, TASK53_SYNC_LINE, 'bmc_generating', {
            bmcGenUi: 'spinner',
            spinnerBlue: true,
            startFullyRevealed: true,
          });
        }, rawId);
        await flushPersistDesignDetailProgressWorkspace(rawId);
        let syncRes: { ok?: boolean; message?: string; status?: number } | null = null;
        try {
          syncRes = await postT53(
            rawId,
            mergeTargetKvSyncBodyWithAlignmentMeta(
              { l3ProcessInferenceRaw: l53Raw },
              buildTask53L3TargetKvSyncAlignmentMeta(rawId),
            ),
          );
        } finally {
          removeTask53L3SyncSpinnerLine(rawId);
        }
        if (exitTask53PipelineIfSessionStale(rawId, epochAtStart)) return;
        if (syncRes?.ok === true) {
          allowSyncOk = true;
          withTask53L3DynamicsCard((card) => {
            appendLineToCard(card, TASK53_SYNC_OK_LINE, 'scope_green', { startFullyRevealed: true });
            appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
            appendLineToCard(card, '→ 更新现状理解画布（业务流程层）', 'scope_green', {
              startFullyRevealed: true,
            });
          }, rawId);
          logicTreeGraphRefreshTick.value += 1;
          await onTask53CurrentStateCanvasRefresh?.(rawId);
          if (typeof getGraph === 'function') {
            const gr2 = await getGraph(rawId);
            if (gr2?.ok === true && gr2.data && Array.isArray(gr2.data.tasks)) {
              const mergedForProgress = normalizeLogicGraphTasksFromApiPayload(
                gr2.data.tasks as DesignDetailLogicGraphTaskDto[],
              );
              if (pushTask53ProcessForwardLinkDebugProgressSerial && processSubtasks.length) {
                await pushTask53ProcessForwardLinkDebugProgressSerial(
                  rawId,
                  processSubtasks.map((s) => s.processName),
                  mergedForProgress,
                );
                if (exitTask53PipelineIfSessionStale(rawId, epochAtStart)) return;
              }
              await pushPipelineFeatureInferenceConclusions({
                rawId,
                lineTaskId: 'key_scenario_temporal_flow_inference',
                mergedForProgress,
                readProgressLines: () => {
                  let snap: Array<{ kind: string; full: string; cursor?: number; inferenceFeatureId?: string }> =
                    [];
                  withTask53L3DynamicsCard((card) => {
                    snap = card.lines;
                  }, rawId);
                  return snap;
                },
                ensureOrganizeLine: () => {
                  withTask53L3DynamicsCard((card) => {
                    if (!hasFeatureInferenceConclusionOrganizeLine(card.lines)) {
                      appendLineToCard(card, INFERENCE_CONCLUSION_ORGANIZE_LINE, 'scope_green', {
                        startFullyRevealed: true,
                      });
                    }
                  }, rawId);
                },
                appendToCard: (text, kind, opts) =>
                  withTask53L3DynamicsCard((card) => {
                    appendLineToCard(card, text, kind as DynamicsLineKind, {
                      startFullyRevealed:
                        kind !== 'inference_conclusion_sub' ? true : (opts?.startFullyRevealed ?? false),
                      inferenceFeatureId: opts?.inferenceFeatureId,
                    });
                  }, rawId),
                waitRevealComplete: waitUntilDynamicsFullyRevealed,
                withLlmAuditCtx,
                signal: llmAbort.signal,
              });
            }
          }
          await flushPersistDesignDetailProgressWorkspace(rawId);
        } else {
          const hint = syncRes && typeof syncRes.message === 'string' ? syncRes.message : '同步失败';
          withTask53L3DynamicsCard((card) => {
            appendLineToCard(card, `→ Target_KV 落库失败：${hint}`, 'default', { startFullyRevealed: true });
            if (syncRes && syncRes.status === 404) {
              appendLineToCard(
                card,
                '→ 多为监听端口上的后端仍是旧构建（未注册 sync-task53 路由）。请在 backend 执行 npm run build 后重启本地后端，再对本线步「重启当前」重跑。',
                'default',
                { startFullyRevealed: true },
              );
            }
          }, rawId);
        }
      } catch (eKv) {
        removeTask53L3SyncSpinnerLine(rawId);
        withTask53L3DynamicsCard((card) => {
          appendLineToCard(
            card,
            `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
            'default',
            { startFullyRevealed: true },
          );
        }, rawId);
      }
    }
  } else if (!isOnlineMode() && l53Raw) {
    allowSyncOk = true;
  }

  let allowTask55Kickoff = false;
  if (allowSyncOk && l53Raw) {
    const tvmRowsForAlign = parseTask53L3TokenValidationMappingForAlignment(l53Raw);
    const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
    const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
    const conflictCount = conflictRows.length;
    withTask53L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        `→ 反向验证校验｜Token_Validation_Mapping ${tvmRowsForAlign.length} 条｜${
          hasUnresolvedTvmConflict
            ? `存在 ${conflictCount} 处潜在冲突，需对齐确认后方可进入任务 5.5`
            : 'Consistency 均已消解，可进入任务 5.5'
        }`,
        'scope_green',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    if (!hasUnresolvedTvmConflict) {
      allowTask55Kickoff = true;
    } else if (conflictCount) {
      stashAlignmentPainTargetsForLineTask?.(rawId, 'key_scenario_temporal_flow_inference', conflictRows);
    }
  }

  withTask53L3DynamicsCard((card) => {
    if (allowSyncOk && allowTask55Kickoff) {
      card.status = 'completed';
      card.completedAtMs = Date.now();
      card.completionQueued = true;
    } else if (allowSyncOk && !allowTask55Kickoff) {
      card.status = 'running';
      card.completedAtMs = null;
      card.completionQueued = false;
    } else if (l53Raw) {
      card.status = 'completed';
      card.completedAtMs = Date.now();
      appendLineToCard(
        card,
        '→ 任务 5.3 未收官（Target_KV 落库失败）；请修复后端后对本线步「重启当前」重跑',
        'default',
        { startFullyRevealed: true },
      );
    }
  }, rawId);

  const task53Done = !!(allowSyncOk && l53Raw && allowTask55Kickoff);
  saveDesignDetailLineState(rawId, {
    schemaVersion: 1,
    currentTaskId: task53Done ? 'vsm_stage_decomposition' : 'key_scenario_temporal_flow_inference',
    holdPastTask5: true,
    holdPastTask51: true,
    holdPastTask52: true,
    holdPastTask53: task53Done,
  });
  if (mergedItem) {
    reconcileDesignDetailLineTaskId(
      rawId,
      mergedItem,
      lastHydratedMessages.value,
      task1CustomerRequirementPhase.value,
    );
  }
  const st = loadDesignDetailLineState(rawId);
  if (st?.currentTaskId) setCurrentDesignLineTaskId(st.currentTaskId);
  if (task53Done && onTask53Done) {
    await onTask53Done(rawId, epochAtStart, llmAbort, mergedItem, pipelineOpts);
  }
  await flushPersistDesignDetailProgressWorkspace(rawId);
}
