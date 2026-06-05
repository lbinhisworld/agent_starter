/**
 * [INPUT]: 任务 6.5 流水线依赖（由 `useDesignDetailChat` 注入）
 * [OUTPUT]: `runTask65ItGapPipeline` — 按「价值流阶段-流程环节」循环 IT-Gap 推导 → 合并落库 → 任务 7
 * [POS]: 任务 6 收官后、任务 7 之前
 */

import {
  buildTask65ItGapSubtaskList,
  buildTask65SingleStepItGapInferenceUserBlock,
  task65ItGapProgressLine,
  type Task65ItGapSubtask,
} from './buildTask65ItGapInferenceInputFromTaskGraph';
import {
  pickTask1PainPointAndLedgerFeaturesFromGraphTasks,
  pickTask52FieldSetFeaturesFromGraphTasks,
  pickTask55VsmStageFeaturesFromGraphTasks,
} from './buildTask6L3ScenarioInferenceInputFromTaskGraph';
import { pickTask6ScenarioFeaturesFromGraphTasks } from './buildTask7L4CollaborationInferenceInputFromTaskGraph';
import { buildTask65ItGapStepCallTarget } from './designDetailLlmStats';
import {
  mergeL65ItGapInferenceRawOutputsForServerSync,
  normalizeL65ItGapInferenceRawForServerSync,
  parseTask65L3TokenValidationMappingForAlignment,
} from './designDetailTask65ItGapSyncUiProgress';
import {
  buildTask65L3TargetKvSyncAlignmentMeta,
  mergeTargetKvSyncBodyWithAlignmentMeta,
} from './designDetailTargetKvSyncAlignmentMeta';
import type { DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { designLinePillLabel } from './designModeTaskPipeline';
import {
  buildTask65L3ConflictDatasetUserBlock,
  task2L1AllValidationRowsResolved,
  task2L1FilterPotentialConflictRows,
  type Task2L1TvmParsedRow,
} from './designDetailTask2L1SyncUiProgress';
import type { RunTask6PipelineDeps } from './runTask6L3ScenarioPipeline';
import { readTask65L3DeepInsightText } from './designDetailTask65L3DeepInsight';
import {
  clearTask65PipelineResume,
  type Task65PipelineResumeState,
  writeTask65PipelineResume,
} from './designDetailTask65PipelineResume';

type Task65PipelineRunOpts = {
  deferAlignmentQuestionnaire?: boolean;
  /** 深访闭环后从指定子任务续跑（非整卡重跑） */
  task65ResumeFrom?: Pick<Task65PipelineResumeState, 'stepIndex' | 'perStepRawOutputs'>;
  /** 续跑时跳过首屏子任务清单等已展示内容 */
  task65SkipIntro?: boolean;
};

type DynamicsLineKind =
  | 'default'
  | 'scope_green'
  | 'bmc_generating'
  | 'task65_inference_sub'
  | 'bmc_result_quote';

export type RunTask65PipelineDeps = Omit<
  RunTask6PipelineDeps,
  | 'exitTask6PipelineIfSessionStale'
  | 'withTask6L3DynamicsCard'
  | 'removeTask6L3SyncSpinnerLine'
  | 'scheduleDebugContinueAfterTask6L3SegmentIfReady'
  | 'runTask7L4CollaborationPipeline'
  | 'DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_7'
  | 'pipelineOpts'
> & {
  pipelineOpts?: Task65PipelineRunOpts;
  exitTask65PipelineIfSessionStale: (rawId: string, epochAtStart: number) => boolean;
  withTask65L3DynamicsCard: RunTask6PipelineDeps['withTask6L3DynamicsCard'];
  removeTask65L3SyncSpinnerLine: (rawId: string) => void;
  runTask7L4CollaborationPipeline?: RunTask6PipelineDeps['runTask7L4CollaborationPipeline'];
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_7?: string;
  scheduleDebugContinueAfterTask65SegmentIfReady?: (
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ) => Promise<void>;
  pushTask65StepDebugProgressSerial?: (rawId: string, progressLabel: string, stepRaw: string) => Promise<void>;
  appendTask65SubtaskAlignmentQuestionnaireFromConflict?: (
    rawId: string,
    epochAtStart: number,
    progressLabel: string,
    stepIndex: number,
    perStepRawOutputs: string[],
    conflictRows: Task2L1TvmParsedRow[],
  ) => Promise<void>;
  onTask65DiagnosticReviewCanvasStart?: (rawId: string) => void;
  onTask65SubtaskItGapCanvasUpdate?: (
    rawId: string,
    sub: Task65ItGapSubtask,
    stepRaw: string,
  ) => void;
};

const TASK65_START_LINE = '→ 开始进行三维 IT-Gap 分析';
const TASK65_LOGIC_EXTRACT_LINE = '→ 进行任务 6.5 推理逻辑提取与合并落库';
const TASK65_SYNC_LINE = '→ 正在写入任务 6.5 Target_KV 与逻辑链…';
const TASK65_SYNC_OK_LINE = '→ 任务 6.5 Target_KV 与逻辑链已写入服务端';

type Task65ProgressLineRow = {
  full: string;
  bmcGenUi?: 'spinner' | 'check';
  spinnerBlue?: boolean;
};

function bareTask65SubtaskProgressLine(full: string): string {
  return String(full ?? '')
    .replace(/\s*✅\s*$/u, '')
    .replace(/\s*✔️?\s*$/u, '')
    .trim();
}

function task65SubtaskProgressLineMatches(full: string, progressLabel: string): boolean {
  const prefix = task65ItGapProgressLine(progressLabel);
  const bare = bareTask65SubtaskProgressLine(full);
  return bare === prefix || bare.startsWith(`${prefix} `);
}

function touchTask65ProgressLine(
  card: { lines: Task65ProgressLineRow[] },
  progressLabel: string,
  patch: Partial<Pick<Task65ProgressLineRow, 'bmcGenUi' | 'spinnerBlue' | 'full'>>,
): boolean {
  let touched = false;
  for (const row of card.lines) {
    if (!task65SubtaskProgressLineMatches(String(row.full ?? ''), progressLabel)) continue;
    touched = true;
    if (patch.full != null) row.full = patch.full;
    if (patch.bmcGenUi !== undefined) row.bmcGenUi = patch.bmcGenUi;
    if (patch.spinnerBlue !== undefined) row.spinnerBlue = patch.spinnerBlue;
  }
  return touched;
}

function markTask65SubtaskInProgress(
  card: { lines: Task65ProgressLineRow[] },
  progressLabel: string,
  appendLine: RunTask65PipelineDeps['appendLineToCard'],
): void {
  const touched = touchTask65ProgressLine(card, progressLabel, {
    full: task65ItGapProgressLine(progressLabel),
    bmcGenUi: 'spinner',
    spinnerBlue: true,
  });
  if (touched) return;
  appendLine(card, task65ItGapProgressLine(progressLabel), 'default', {
    startFullyRevealed: true,
    bmcGenUi: 'spinner',
    spinnerBlue: true,
  });
}

function markTask65SubtaskDone(card: { lines: Task65ProgressLineRow[] }, progressLabel: string): void {
  touchTask65ProgressLine(card, progressLabel, {
    full: task65ItGapProgressLine(progressLabel),
    bmcGenUi: 'check',
    spinnerBlue: undefined,
  });
}

export async function runTask65ItGapPipeline(deps: RunTask65PipelineDeps): Promise<void> {
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
    exitTask65PipelineIfSessionStale,
    withTask65L3DynamicsCard,
    removeTask65L3SyncSpinnerLine,
    waitUntilDynamicsFullyRevealed,
    pipelineOpts,
    stashAlignmentPainTargetsForLineTask,
    deferredAlignmentQuestionnaireJob,
    pendingDebugPipelineContinueAction,
    designDetailDebugGate,
    DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE,
    DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_7,
    scheduleDebugContinueAfterTask65SegmentIfReady,
    runTask7L4CollaborationPipeline,
    pushTask65StepDebugProgressSerial,
    appendTask65SubtaskAlignmentQuestionnaireFromConflict,
    onTask65DiagnosticReviewCanvasStart,
    onTask65SubtaskItGapCanvasUpdate,
  } = deps;

  const resumeFrom = pipelineOpts?.task65ResumeFrom;
  const skipIntro = pipelineOpts?.task65SkipIntro === true;

  if (designDetailSessionGeneration !== epochAtStart) return;

  const w = window as unknown as {
    inferDesignDetailL65ItGapFromContext?: (
      p: Record<string, unknown>,
      fetchOpts?: { signal?: AbortSignal },
    ) => Promise<{ rawOutput?: string; content?: string }>;
  };
  if (typeof w.inferDesignDetailL65ItGapFromContext !== 'function') {
    withTask65L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 6.5 推理失败：未加载 inferDesignDetailL65ItGapFromContext（请确认 design-detail.html 已加载 designDetailL65ItGapSystemPrompt.js）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    return;
  }

  let cards = deps.cloneDynamics();
  if (!cards.some((c) => c.lineTaskId === 'three_dimension_itgap_analysis')) {
    cards = [
      ...cards,
      {
        key: `three_dimension_itgap_analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineTaskId: 'three_dimension_itgap_analysis',
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

  withTask65L3DynamicsCard((card) => {
    if (!skipIntro) {
      appendLineToCard(card, TASK65_START_LINE, 'scope_green', { startFullyRevealed: true });
    }
  }, rawId);
  if (!skipIntro) {
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }
  if (!skipIntro) {
    onTask65DiagnosticReviewCanvasStart?.(rawId);
  }

  const getGraph = (
    window as unknown as {
      SmartCto?: {
        problemCaseApi?: {
          getDesignDetailTaskGraph?: (id: string) => Promise<{
            ok?: boolean;
            data?: { tasks?: unknown[] };
          } | null>;
        };
      };
    }
  ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;

  let graphTasks: DesignDetailLogicGraphTaskDto[] = [];
  let phaseFeatures: Task2L1TaskGraphFeatureRow[] = [];
  let task52FieldSetFeatures: Task2L1TaskGraphFeatureRow[] = [];
  let task6ScenarioFeatures: Task2L1TaskGraphFeatureRow[] = [];
  let task1PainAndLedgerFeatures: Task2L1TaskGraphFeatureRow[] = [];

  if (typeof getGraph === 'function') {
    try {
      const gr = await getGraph(rawId);
      if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
        graphTasks = gr.data.tasks as DesignDetailLogicGraphTaskDto[];
        phaseFeatures = pickTask55VsmStageFeaturesFromGraphTasks(graphTasks);
        task52FieldSetFeatures = pickTask52FieldSetFeaturesFromGraphTasks(graphTasks);
        task6ScenarioFeatures = pickTask6ScenarioFeaturesFromGraphTasks(graphTasks);
        task1PainAndLedgerFeatures = pickTask1PainPointAndLedgerFeaturesFromGraphTasks(graphTasks);
      }
    } catch {
      /* 空图仍送模 */
    }
  }

  const stepSubtasks: Task65ItGapSubtask[] = buildTask65ItGapSubtaskList(graphTasks);

  if (!stepSubtasks.length) {
    withTask65L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 6.5 推理已跳过：未解析到「价值流阶段-流程环节」子任务（请确认 5.5 阶段与 5.3 流程环节已落库）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  const perStepRawOutputs: string[] = resumeFrom?.perStepRawOutputs
    ? [...resumeFrom.perStepRawOutputs]
    : [];
  const loopStartIndex = resumeFrom?.stepIndex ?? 0;
  const task65DeepInsightText = readTask65L3DeepInsightText(rawId);

  for (let stepIdx = loopStartIndex; stepIdx < stepSubtasks.length; stepIdx++) {
    const sub = stepSubtasks[stepIdx]!;
    withTask65L3DynamicsCard((card) => {
      markTask65SubtaskInProgress(card, sub.progressLabel, appendLineToCard);
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    const userBlock = buildTask65SingleStepItGapInferenceUserBlock(
      sub,
      phaseFeatures,
      task52FieldSetFeatures,
      task6ScenarioFeatures,
      task1PainAndLedgerFeatures,
      task65DeepInsightText,
    );
    try {
      const res = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: designLinePillLabel('three_dimension_itgap_analysis'),
          callTarget: buildTask65ItGapStepCallTarget(sub.progressLabel),
        },
        () =>
          w.inferDesignDetailL65ItGapFromContext!(
            { task65InferenceUserBlock: userBlock },
            { signal: llmAbort.signal },
          ),
      );
      if (exitTask65PipelineIfSessionStale(rawId, epochAtStart)) return;
      const stepRaw = String(res.rawOutput || res.content || '').trim();
      if (!stepRaw) {
        throw new Error(`工位「${sub.progressLabel}」模型无输出`);
      }
      if (pushTask65StepDebugProgressSerial) {
        await pushTask65StepDebugProgressSerial(rawId, sub.progressLabel, stepRaw);
        if (exitTask65PipelineIfSessionStale(rawId, epochAtStart)) return;
      }

      const tvmRows = parseTask65L3TokenValidationMappingForAlignment(stepRaw);
      const conflictRows = task2L1FilterPotentialConflictRows(tvmRows);
      if (!task2L1AllValidationRowsResolved(tvmRows) && conflictRows.length) {
        const conflictBlock = buildTask65L3ConflictDatasetUserBlock(conflictRows);
        stashAlignmentPainTargetsForLineTask?.(rawId, 'three_dimension_itgap_analysis', conflictRows);
        writeTask65PipelineResume(rawId, {
          stepIndex: stepIdx,
          perStepRawOutputs: [...perStepRawOutputs],
          progressLabel: sub.progressLabel,
          epochAtStart,
        });
        if (pipelineOpts?.deferAlignmentQuestionnaire && deferredAlignmentQuestionnaireJob) {
          deferredAlignmentQuestionnaireJob.value = {
            caseId: rawId,
            lineTaskId: 'three_dimension_itgap_analysis',
            epochAtStart,
            conflictDatasetUserBlock: conflictBlock,
            tier: 'task65',
            task65SubtaskProgressLabel: sub.progressLabel,
            task65SubtaskStepIndex: stepIdx,
            task65SubtaskPerStepRawOutputs: [...perStepRawOutputs],
            task65ConflictRows: conflictRows,
          };
        } else {
          await appendTask65SubtaskAlignmentQuestionnaireFromConflict?.(
            rawId,
            epochAtStart,
            sub.progressLabel,
            stepIdx,
            perStepRawOutputs,
            conflictRows,
          );
        }
        await flushPersistDesignDetailProgressWorkspace(rawId);
        return;
      }

      perStepRawOutputs.push(stepRaw);
      onTask65SubtaskItGapCanvasUpdate?.(rawId, sub, stepRaw);
      withTask65L3DynamicsCard((card) => {
        markTask65SubtaskDone(card, sub.progressLabel);
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
    } catch (e) {
      if (exitTask65PipelineIfSessionStale(rawId, epochAtStart)) return;
      withTask65L3DynamicsCard((card) => {
        appendLineToCard(
          card,
          `→ IT-Gap 子任务「${sub.progressLabel}」失败：${e instanceof Error ? e.message : String(e)}`,
          'default',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return;
    }
  }

  const mergeNorm = mergeL65ItGapInferenceRawOutputsForServerSync(perStepRawOutputs);
  const l65Raw = mergeNorm.ok ? mergeNorm.normalized : '';

  withTask65L3DynamicsCard((card) => {
    appendLineToCard(card, TASK65_LOGIC_EXTRACT_LINE, 'scope_green', { startFullyRevealed: true });
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  if (!mergeNorm.ok) {
    withTask65L3DynamicsCard((card) => {
      appendLineToCard(card, `→ 多环节合并失败：${mergeNorm.message}`, 'default', {
        startFullyRevealed: true,
      });
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  let allowSyncOk = false;
  if (isOnlineMode() && l65Raw) {
    const postT65 = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            postDesignDetailSyncTask65L3ItGapTargetKvTokens?: (
              id: string,
              body: Record<string, unknown>,
            ) => Promise<{ ok?: boolean; message?: string; status?: number } | null>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask65L3ItGapTargetKvTokens;
    if (typeof postT65 === 'function') {
      try {
        const normT65 = normalizeL65ItGapInferenceRawForServerSync(l65Raw);
        if (!normT65.ok) {
          withTask65L3DynamicsCard((card) => {
            appendLineToCard(card, `→ Target_KV 落库失败：${normT65.message}`, 'default', {
              startFullyRevealed: true,
            });
          }, rawId);
        } else {
          withTask65L3DynamicsCard((card) => {
            appendLineToCard(card, TASK65_SYNC_LINE, 'bmc_generating', {
              bmcGenUi: 'spinner',
              spinnerBlue: true,
              startFullyRevealed: true,
            });
          }, rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          let syncRes: { ok?: boolean; message?: string; status?: number } | null = null;
          try {
            syncRes = await postT65(
              rawId,
              mergeTargetKvSyncBodyWithAlignmentMeta(
                { l3ProcessInferenceRaw: normT65.normalized },
                buildTask65L3TargetKvSyncAlignmentMeta(rawId),
              ),
            );
          } finally {
            removeTask65L3SyncSpinnerLine(rawId);
          }
          if (exitTask65PipelineIfSessionStale(rawId, epochAtStart)) return;
          if (syncRes?.ok === true) {
            allowSyncOk = true;
            withTask65L3DynamicsCard((card) => {
              appendLineToCard(card, TASK65_SYNC_OK_LINE, 'scope_green', { startFullyRevealed: true });
            }, rawId);
            logicTreeGraphRefreshTick.value += 1;
          } else {
            const hint =
              syncRes && typeof syncRes.message === 'string' ? syncRes.message : '同步失败';
            withTask65L3DynamicsCard((card) => {
              appendLineToCard(card, `→ Target_KV 落库失败：${hint}`, 'default', {
                startFullyRevealed: true,
              });
            }, rawId);
          }
        }
      } catch (eKv) {
        removeTask65L3SyncSpinnerLine(rawId);
        withTask65L3DynamicsCard((card) => {
          appendLineToCard(
            card,
            `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
            'default',
            { startFullyRevealed: true },
          );
        }, rawId);
      }
    }
  } else if (!isOnlineMode() && l65Raw) {
    allowSyncOk = true;
  }

  let allowTask7Kickoff = false;
  if (allowSyncOk && l65Raw) {
    clearTask65PipelineResume(rawId);
    allowTask7Kickoff = true;
  }

  const task65Done = !!(allowSyncOk && l65Raw && allowTask7Kickoff);
  saveDesignDetailLineState(rawId, {
    schemaVersion: 1,
    currentTaskId: task65Done ? 'key_requirement_scenarios' : 'three_dimension_itgap_analysis',
    holdPastTask6: true,
    holdPastTask65: task65Done,
    holdPastTask7: false,
  });

  withTask65L3DynamicsCard((card) => {
    if (allowSyncOk && allowTask7Kickoff) {
      card.status = 'completed';
      card.completedAtMs = Date.now();
      card.completionQueued = true;
    } else if (allowSyncOk) {
      card.status = 'running';
      card.completedAtMs = null;
      card.completionQueued = false;
    }
  }, rawId);

  if (task65Done && runTask7L4CollaborationPipeline) {
    const debugContinue =
      !pipelineOpts?.deferDebugContinue &&
      designDetailDebugGate?.(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE ?? '') &&
      designDetailDebugGate?.(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_7 ?? '');
    if (debugContinue && scheduleDebugContinueAfterTask65SegmentIfReady) {
      await scheduleDebugContinueAfterTask65SegmentIfReady(rawId, mergedItem);
    } else {
      await runTask7L4CollaborationPipeline(rawId, epochAtStart, llmAbort, mergedItem, pipelineOpts);
    }
  }

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
  await flushPersistDesignDetailProgressWorkspace(rawId);
}
