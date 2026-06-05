/**
 * [INPUT]: 任务 7 流水线依赖（由 `useDesignDetailChat` 注入）
 * [OUTPUT]: `runTask7L4CollaborationPipeline` — 按「价值流阶段-流程环节」循环 L4 多栈选型 → 合并落库 → 任务 8
 * [POS]: 任务 6.5 收官后
 */

import {
  buildTask7L4CollaborationSubtaskList,
  buildTask7SingleStepL4CollaborationInferenceUserBlock,
  pickTask55PhaseFeaturesFromGraphTasks,
  pickTask65ItGapFeaturesFromGraphTasks,
  pickTask6ScenarioFeaturesFromGraphTasks,
  task7L4CollaborationProgressLine,
  truncateTask7L4DebugProgressText,
  type Task7L4CollaborationSubtask,
} from './buildTask7L4CollaborationInferenceInputFromTaskGraph';
import { buildTask7L4CollaborationStepCallTarget } from './designDetailLlmStats';
import {
  buildForwardInductionLinkUiLinesTask7,
  buildReverseValidationLinkUiLines,
  buildTask7L4ConflictDatasetUserBlock,
  extractTask7L4TokenValidationMappingProgressSnippet,
  mergeL4FormLayoutInferenceRawOutputsForServerSync,
  normalizeL4CollaborationInferenceRawForServerSync,
  parseTask7L4TokenValidationMappingForAlignment,
  task2L1AllValidationRowsResolved,
  task2L1FilterPotentialConflictRows,
  type Task2L1TvmParsedRow,
} from './designDetailTask2L1SyncUiProgress';
import {
  buildTask7L4TargetKvSyncAlignmentMeta,
  mergeTargetKvSyncBodyWithAlignmentMeta,
} from './designDetailTargetKvSyncAlignmentMeta';
import type { DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { designLinePillLabel } from './designModeTaskPipeline';
import { buildTask1PainPointConfirmedConsistencyMap } from './designDetailPainPointConfirmed';

export type DesignDetailPipelineRunOpts = {
  deferAlignmentQuestionnaire?: boolean;
  deferDebugContinue?: boolean;
};

type Task7ProgressLineRow = {
  full: string;
  bmcGenUi?: 'spinner' | 'check';
  spinnerBlue?: boolean;
};

const TASK7_COLLAB_START_LINE = '→ 开始进行任务节点IT选型推理';
const TASK7_LOGIC_EXTRACT_LINE = '→ 进行任务 7 推理逻辑提取与合并落库';
const TASK7_SYNC_TARGET_KV_LINE = '→ 正在写入任务 7 Target_KV 与逻辑链…';
const TASK7_SYNC_TARGET_KV_OK_LINE = '→ 任务 7 Target_KV 与逻辑链已写入服务端';
const TASK7_DEBUG_INFERENCE_DONE_LINE = '→ 大模型返回 json';
const TASK7_DEBUG_TOKEN_KV_LINE = '→ 任务 7-token 列表：';
const TASK7_DEBUG_FEATURE_KV_LINE = '→ 任务 7-feature 列表：';

function bareTask7SubtaskProgressLine(full: string): string {
  return String(full ?? '')
    .replace(/\s*✅\s*$/u, '')
    .replace(/\s*✔️?\s*$/u, '')
    .trim();
}

function task7SubtaskProgressLineMatches(full: string, progressLabel: string): boolean {
  const prefix = task7L4CollaborationProgressLine(progressLabel);
  const bare = bareTask7SubtaskProgressLine(full);
  return bare === prefix || bare.startsWith(`${prefix} `);
}

function touchTask7ProgressLine(
  card: { lines: Task7ProgressLineRow[] },
  progressLabel: string,
  patch: Partial<Pick<Task7ProgressLineRow, 'bmcGenUi' | 'spinnerBlue' | 'full'>>,
): boolean {
  let touched = false;
  for (const row of card.lines) {
    if (!task7SubtaskProgressLineMatches(String(row.full ?? ''), progressLabel)) continue;
    touched = true;
    if (patch.full != null) row.full = patch.full;
    if (patch.bmcGenUi !== undefined) row.bmcGenUi = patch.bmcGenUi;
    if (patch.spinnerBlue !== undefined) row.spinnerBlue = patch.spinnerBlue;
  }
  return touched;
}

function markTask7SubtaskInProgress(
  card: { lines: Task7ProgressLineRow[] },
  progressLabel: string,
  appendLine: RunTask7PipelineDeps['appendLineToCard'],
): void {
  const touched = touchTask7ProgressLine(card, progressLabel, {
    full: task7L4CollaborationProgressLine(progressLabel),
    bmcGenUi: 'spinner',
    spinnerBlue: true,
  });
  if (touched) return;
  appendLine(card, task7L4CollaborationProgressLine(progressLabel), 'default', {
    startFullyRevealed: true,
    bmcGenUi: 'spinner',
    spinnerBlue: true,
  });
}

function markTask7SubtaskDone(card: { lines: Task7ProgressLineRow[] }, progressLabel: string): void {
  touchTask7ProgressLine(card, progressLabel, {
    full: task7L4CollaborationProgressLine(progressLabel),
    bmcGenUi: 'check',
    spinnerBlue: undefined,
  });
}

export type RunTask7PipelineDeps = {
  pipelineOpts?: DesignDetailPipelineRunOpts;
  designDetailSessionGeneration: number;
  epochAtStart: number;
  rawId: string;
  llmAbort: AbortController;
  mergedItem: Record<string, unknown> | null;
  isOnlineMode: () => boolean;
  cloneDynamics: () => Array<{ lineTaskId?: string; [k: string]: unknown }>;
  setDynamicsCards: (cards: unknown[]) => void;
  appendLineToCard: (
    card: { lines: Task7ProgressLineRow[] },
    line: string,
    kind?: string,
    opts?: Record<string, unknown>,
  ) => void;
  flushPersistDesignDetailProgressWorkspace: (rawId: string) => Promise<void>;
  withLlmAuditCtx: <T>(
    ctx: { caseId: string; taskId: string; callTarget: string },
    fn: () => Promise<T>,
  ) => Promise<T>;
  saveDesignDetailLineState: (rawId: string, patch: Record<string, unknown>) => void;
  reconcileDesignDetailLineTaskId: (
    rawId: string,
    mergedItem: Record<string, unknown>,
    messages: unknown,
    phase: unknown,
  ) => void;
  loadDesignDetailLineState: (rawId: string) => Record<string, unknown> | null;
  setCurrentDesignLineTaskId: (id: string) => void;
  lastHydratedMessages: { value: unknown };
  task1CustomerRequirementPhase: { value: unknown };
  logicTreeGraphRefreshTick: { value: number };
  exitTask7PipelineIfSessionStale: (rawId: string, epochAtStart: number) => boolean;
  withTask7L4DynamicsCard: (
    fn: (card: { lines: Task7ProgressLineRow[]; status?: string; completedAtMs?: number | null; completionQueued?: boolean }) => void,
    rawId: string,
  ) => void;
  removeTask7L4SyncSpinnerLine: (rawId: string) => void;
  pushFeatureInferenceConclusionsAfterSync: (
    rawId: string,
    lineTaskId: string,
    merged: DesignDetailLogicGraphTaskDto[],
    signal?: AbortSignal,
  ) => Promise<void>;
  normalizeLogicGraphTasksFromApiPayload: (tasks: DesignDetailLogicGraphTaskDto[]) => DesignDetailLogicGraphTaskDto[];
  pickTask1Task2FeaturesFromGraphTasks: (
    tasks: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
  ) => { task1Features: Task2L1TaskGraphFeatureRow[]; task2Features: Task2L1TaskGraphFeatureRow[] };
  readTask7L4DeepInsightText: (rawId: string) => string;
  readTask7L4UserRectificationText: (rawId: string) => string;
  stashAlignmentPainTargetsForLineTask: (
    rawId: string,
    lineTaskId: string,
    rows: Task2L1TvmParsedRow[],
  ) => void;
  deferredAlignmentQuestionnaireJob: { value: unknown };
  appendTask7L4AlignmentQuestionnaireFromConflict: (
    rawId: string,
    epochAtStart: number,
    conflictBlock: string,
  ) => Promise<void>;
  designDetailDebugGate: (key: string) => boolean;
  DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE: string;
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_8: string;
  scheduleDebugContinueAfterTask7L4SegmentIfReady: (
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ) => Promise<void>;
  runTask8L45PrototypePipeline?: (
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    opts?: DesignDetailPipelineRunOpts,
  ) => Promise<void>;
  pickTask7TokensFeaturesFromGraphTasks: (
    tasks: unknown[],
  ) => { tokens: Array<Record<string, unknown>>; features: Array<Record<string, unknown>> };
  formatTask5FeatureKvDebugLine: (f: Record<string, unknown>) => string;
  pushTask7SubtaskProgressAfterInference?: (
    rawId: string,
    progressLabel: string,
    stepRaw: string,
  ) => Promise<void>;
  isDesignDetailDebugExperienceActive?: () => boolean;
};

export async function runTask7L4CollaborationPipeline(deps: RunTask7PipelineDeps): Promise<void> {
  const {
    pipelineOpts,
    designDetailSessionGeneration,
    epochAtStart,
    rawId,
    llmAbort,
    mergedItem,
    isOnlineMode,
    cloneDynamics,
    setDynamicsCards,
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
    exitTask7PipelineIfSessionStale,
    withTask7L4DynamicsCard,
    removeTask7L4SyncSpinnerLine,
    pushFeatureInferenceConclusionsAfterSync,
    normalizeLogicGraphTasksFromApiPayload,
    pickTask1Task2FeaturesFromGraphTasks,
    readTask7L4DeepInsightText,
    readTask7L4UserRectificationText,
    stashAlignmentPainTargetsForLineTask,
    deferredAlignmentQuestionnaireJob,
    appendTask7L4AlignmentQuestionnaireFromConflict,
    designDetailDebugGate,
    DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE,
    DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_8,
    scheduleDebugContinueAfterTask7L4SegmentIfReady,
    runTask8L45PrototypePipeline,
    pickTask7TokensFeaturesFromGraphTasks,
    formatTask5FeatureKvDebugLine,
    pushTask7SubtaskProgressAfterInference,
    isDesignDetailDebugExperienceActive,
  } = deps;

  if (designDetailSessionGeneration !== epochAtStart) return;

  const w = window as unknown as {
    inferDesignDetailL4CollaborationFromContext?: (
      p: Record<string, unknown>,
      fetchOpts?: { signal?: AbortSignal },
    ) => Promise<{ rawOutput?: string; content?: string }>;
  };
  if (typeof w.inferDesignDetailL4CollaborationFromContext !== 'function') {
    withTask7L4DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 7 推理失败：未加载 inferDesignDetailL4CollaborationFromContext（请确认 design-detail.html 已加载 designDetailL4CollaborationSystemPrompt.js）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    return;
  }

  let cards = cloneDynamics();
  let c7 = cards.find((c) => c.lineTaskId === 'key_requirement_scenarios');
  if (!c7) {
    c7 = {
      key: `key_requirement_scenarios-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lineTaskId: 'key_requirement_scenarios',
      status: 'running',
      startedAtMs: Date.now(),
      completedAtMs: null,
      lines: [],
      extraTailConsumed: 0,
      completionQueued: false,
      thanksAppended: false,
    };
    cards = [...cards, c7];
    setDynamicsCards(cards);
  }

  withTask7L4DynamicsCard((card) => {
    appendLineToCard(card, TASK7_COLLAB_START_LINE, 'scope_green', { startFullyRevealed: true });
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

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
  let task1Features: Task2L1TaskGraphFeatureRow[] = [];
  let task6ScenarioFeatures: Task2L1TaskGraphFeatureRow[] = [];
  let task65ItGapFeatures: Task2L1TaskGraphFeatureRow[] = [];
  let mergedGraphForTask7: DesignDetailLogicGraphTaskDto[] | undefined;

  if (typeof getGraph === 'function') {
    try {
      const gr = await getGraph(rawId);
      if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
        graphTasks = gr.data.tasks as DesignDetailLogicGraphTaskDto[];
        mergedGraphForTask7 = normalizeLogicGraphTasksFromApiPayload(graphTasks);
        phaseFeatures = pickTask55PhaseFeaturesFromGraphTasks(graphTasks);
        task6ScenarioFeatures = pickTask6ScenarioFeaturesFromGraphTasks(graphTasks);
        task65ItGapFeatures = pickTask65ItGapFeaturesFromGraphTasks(graphTasks);
        const picked = pickTask1Task2FeaturesFromGraphTasks(graphTasks);
        task1Features = picked.task1Features;
      }
    } catch {
      /* 空图仍送模 */
    }
  }

  const upstreamForTask7 = mergedGraphForTask7?.length
    ? buildTask1PainPointConfirmedConsistencyMap(mergedGraphForTask7)
    : undefined;
  const task7DeepInsight = readTask7L4DeepInsightText(rawId);
  const task7Rectification = readTask7L4UserRectificationText(rawId);

  const stepSubtasks: Task7L4CollaborationSubtask[] = buildTask7L4CollaborationSubtaskList(graphTasks);
  if (!stepSubtasks.length) {
    withTask7L4DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 7 推理已跳过：未解析到「价值流阶段-流程环节」子任务（请确认 5.5 阶段与 5.3 流程环节已落库）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  const perStepRawOutputs: string[] = [];

  for (let stepIdx = 0; stepIdx < stepSubtasks.length; stepIdx++) {
    const sub = stepSubtasks[stepIdx]!;
    withTask7L4DynamicsCard((card) => {
      markTask7SubtaskInProgress(card, sub.progressLabel, appendLineToCard);
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    const userBlock = buildTask7SingleStepL4CollaborationInferenceUserBlock(
      sub,
      phaseFeatures,
      task1Features,
      task6ScenarioFeatures,
      task65ItGapFeatures,
      task7DeepInsight,
      task7Rectification,
      upstreamForTask7,
    );

    try {
      const res = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: designLinePillLabel('key_requirement_scenarios'),
          callTarget: buildTask7L4CollaborationStepCallTarget(sub.progressLabel),
        },
        () =>
          w.inferDesignDetailL4CollaborationFromContext!(
            { task7InferenceUserBlock: userBlock },
            { signal: llmAbort.signal },
          ),
      );
      if (exitTask7PipelineIfSessionStale(rawId, epochAtStart)) return;

      const stepRaw = String(res.rawOutput || res.content || '').trim();
      if (!stepRaw) {
        throw new Error(`工位「${sub.progressLabel}」模型无输出`);
      }

      if (pushTask7SubtaskProgressAfterInference) {
        await pushTask7SubtaskProgressAfterInference(rawId, sub.progressLabel, stepRaw);
        if (exitTask7PipelineIfSessionStale(rawId, epochAtStart)) return;
      }

      const tvmRows = parseTask7L4TokenValidationMappingForAlignment(stepRaw);
      const conflictRows = task2L1FilterPotentialConflictRows(tvmRows);
      if (!task2L1AllValidationRowsResolved(tvmRows) && conflictRows.length) {
        const conflictBlock = buildTask7L4ConflictDatasetUserBlock(conflictRows);
        stashAlignmentPainTargetsForLineTask(rawId, 'key_requirement_scenarios', conflictRows);
        if (pipelineOpts?.deferAlignmentQuestionnaire && deferredAlignmentQuestionnaireJob) {
          (deferredAlignmentQuestionnaireJob as { value: unknown }).value = {
            caseId: rawId,
            lineTaskId: 'key_requirement_scenarios',
            epochAtStart,
            conflictDatasetUserBlock: conflictBlock,
            tier: 'task7',
            task7SubtaskProgressLabel: sub.progressLabel,
            task7SubtaskStepIndex: stepIdx,
            task7SubtaskPerStepRawOutputs: [...perStepRawOutputs],
          };
        } else {
          await appendTask7L4AlignmentQuestionnaireFromConflict(rawId, epochAtStart, conflictBlock);
        }
        await flushPersistDesignDetailProgressWorkspace(rawId);
        return;
      }

      perStepRawOutputs.push(stepRaw);
      withTask7L4DynamicsCard((card) => {
        markTask7SubtaskDone(card, sub.progressLabel);
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
    } catch (e) {
      if (exitTask7PipelineIfSessionStale(rawId, epochAtStart)) return;
      withTask7L4DynamicsCard((card) => {
        appendLineToCard(
          card,
          `→ IT选型子任务「${sub.progressLabel}」失败：${e instanceof Error ? e.message : String(e)}`,
          'default',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return;
    }
  }

  const mergeNorm = mergeL4FormLayoutInferenceRawOutputsForServerSync(perStepRawOutputs);
  const l4CollabRaw = mergeNorm.ok ? mergeNorm.normalized : '';

  withTask7L4DynamicsCard((card) => {
    appendLineToCard(card, TASK7_LOGIC_EXTRACT_LINE, 'scope_green', { startFullyRevealed: true });
    if (l4CollabRaw && isDesignDetailDebugExperienceActive?.()) {
      appendLineToCard(card, TASK7_DEBUG_INFERENCE_DONE_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        card,
        truncateTask7L4DebugProgressText(l4CollabRaw || '（模型无输出）'),
        'task7_inference_sub',
        { startFullyRevealed: true },
      );
    }
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  if (!mergeNorm.ok) {
    withTask7L4DynamicsCard((card) => {
      appendLineToCard(card, `→ 多环节合并失败：${mergeNorm.message}`, 'default', {
        startFullyRevealed: true,
      });
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  let allowTask7SyncOk = false;
  if (isOnlineMode() && l4CollabRaw) {
    const postT7 = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            postDesignDetailSyncTask7L4CollaborationTargetKvTokens?: (
              id: string,
              body: Record<string, unknown>,
            ) => Promise<{ ok?: boolean; message?: string; status?: number } | null>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask7L4CollaborationTargetKvTokens;
    if (typeof postT7 === 'function') {
      try {
        const normT7 = normalizeL4CollaborationInferenceRawForServerSync(l4CollabRaw);
        if (!normT7.ok) {
          removeTask7L4SyncSpinnerLine(rawId);
          withTask7L4DynamicsCard((card) => {
            appendLineToCard(card, `→ Target_KV 落库失败：${normT7.message}`, 'default', {
              startFullyRevealed: true,
            });
          }, rawId);
        } else {
          withTask7L4DynamicsCard((card) => {
            appendLineToCard(card, TASK7_SYNC_TARGET_KV_LINE, 'bmc_generating', {
              bmcGenUi: 'spinner',
              spinnerBlue: true,
              startFullyRevealed: true,
            });
          }, rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          let syncRes: { ok?: boolean; message?: string; status?: number } | null = null;
          try {
            syncRes = await postT7(
              rawId,
              mergeTargetKvSyncBodyWithAlignmentMeta(
                { l3ProcessInferenceRaw: normT7.normalized },
                buildTask7L4TargetKvSyncAlignmentMeta(rawId),
              ),
            );
          } finally {
            removeTask7L4SyncSpinnerLine(rawId);
          }
          if (exitTask7PipelineIfSessionStale(rawId, epochAtStart)) return;
          if (syncRes?.ok === true) {
            allowTask7SyncOk = true;
            withTask7L4DynamicsCard((card) => {
              appendLineToCard(card, TASK7_SYNC_TARGET_KV_OK_LINE, 'scope_green', {
                startFullyRevealed: true,
              });
            }, rawId);
            await flushPersistDesignDetailProgressWorkspace(rawId);
            if (typeof getGraph === 'function') {
              const gr2 = await getGraph(rawId);
              if (gr2?.ok === true && gr2.data && Array.isArray(gr2.data.tasks)) {
                const mergedForProgress = normalizeLogicGraphTasksFromApiPayload(
                  gr2.data.tasks as DesignDetailLogicGraphTaskDto[],
                );
                await pushFeatureInferenceConclusionsAfterSync(
                  rawId,
                  'key_requirement_scenarios',
                  mergedForProgress,
                  llmAbort.signal,
                );
                withTask7L4DynamicsCard((card) => {
                  appendLineToCard(card, '→ 任务 7：开始提炼正向归纳链接', 'scope_green', {
                    startFullyRevealed: true,
                  });
                  for (const ln of buildForwardInductionLinkUiLinesTask7(mergedForProgress)) {
                    appendLineToCard(card, ln, 'bmc_result_quote', { startFullyRevealed: true });
                  }
                  appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
                  appendLineToCard(card, '→ Token_Validation_Mapping（L4 协作节点）：', 'scope_green', {
                    startFullyRevealed: true,
                  });
                  appendLineToCard(
                    card,
                    extractTask7L4TokenValidationMappingProgressSnippet(l4CollabRaw),
                    'token_validation_mapping_quote',
                    { startFullyRevealed: true },
                  );
                  appendLineToCard(card, '→ 开始提炼反向验证链接', 'scope_green', {
                    startFullyRevealed: true,
                  });
                  for (const ln2 of buildReverseValidationLinkUiLines(mergedForProgress)) {
                    appendLineToCard(card, ln2, 'bmc_result_quote', { startFullyRevealed: true });
                  }
                  appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
                  appendLineToCard(card, TASK7_DEBUG_TOKEN_KV_LINE, 'default', { startFullyRevealed: true });
                  const tf = pickTask7TokensFeaturesFromGraphTasks(gr2.data.tasks);
                  const tokenLines = tf.tokens
                    .map((row) => String(row.tokenId ?? '').trim())
                    .filter(Boolean)
                    .map((tid) => `任务 7-token-${tid}`);
                  appendLineToCard(
                    card,
                    tokenLines.length ? tokenLines.join('\n') : '（无 token）',
                    'task7_inference_sub',
                    { startFullyRevealed: true },
                  );
                  appendLineToCard(card, TASK7_DEBUG_FEATURE_KV_LINE, 'default', { startFullyRevealed: true });
                  const featLines = tf.features.map((f) => formatTask5FeatureKvDebugLine(f));
                  appendLineToCard(
                    card,
                    featLines.length ? featLines.join('\n') : '（无 feature）',
                    'task7_inference_sub',
                    { startFullyRevealed: true },
                  );
                }, rawId);
                logicTreeGraphRefreshTick.value += 1;
              }
            }
          } else {
            const hint =
              syncRes && typeof syncRes.message === 'string' ? syncRes.message : '同步失败';
            withTask7L4DynamicsCard((card) => {
              appendLineToCard(card, `→ Target_KV 落库失败：${hint}`, 'default', {
                startFullyRevealed: true,
              });
              if (syncRes && syncRes.status === 404) {
                appendLineToCard(
                  card,
                  '→ 多为监听端口上的后端仍是旧构建（未注册 sync-task7 路由）。请在 backend 执行 npm run build 后重启本地后端，再对本线步「重启当前」重跑。',
                  'default',
                  { startFullyRevealed: true },
                );
              }
            }, rawId);
          }
        }
      } catch (eKv) {
        removeTask7L4SyncSpinnerLine(rawId);
        withTask7L4DynamicsCard((card) => {
          appendLineToCard(
            card,
            `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
            'default',
            { startFullyRevealed: true },
          );
        }, rawId);
      }
    }
  } else if (!isOnlineMode() && l4CollabRaw) {
    allowTask7SyncOk = true;
  }

  let allowTask8Kickoff = false;
  if (allowTask7SyncOk && l4CollabRaw) {
    const tvmRowsForAlign = parseTask7L4TokenValidationMappingForAlignment(l4CollabRaw);
    const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
    const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
    const conflictCount = conflictRows.length;
    withTask7L4DynamicsCard((card) => {
      appendLineToCard(
        card,
        `→ 反向验证校验｜Token_Validation_Mapping ${tvmRowsForAlign.length} 条｜${
          hasUnresolvedTvmConflict
            ? `存在 ${conflictCount} 处潜在冲突，需对齐确认后方可进入任务 8`
            : 'Consistency 均已消解或已确认为痛点，可进入任务 8'
        }`,
        'scope_green',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    if (!hasUnresolvedTvmConflict) {
      allowTask8Kickoff = true;
    } else if (conflictCount) {
      const conflictBlock = buildTask7L4ConflictDatasetUserBlock(conflictRows);
      stashAlignmentPainTargetsForLineTask(rawId, 'key_requirement_scenarios', conflictRows);
      if (pipelineOpts?.deferAlignmentQuestionnaire && deferredAlignmentQuestionnaireJob) {
        (deferredAlignmentQuestionnaireJob as { value: unknown }).value = {
          caseId: rawId,
          lineTaskId: 'key_requirement_scenarios',
          epochAtStart,
          conflictDatasetUserBlock: conflictBlock,
          tier: 'task7',
        };
        await flushPersistDesignDetailProgressWorkspace(rawId);
      } else {
        await appendTask7L4AlignmentQuestionnaireFromConflict(rawId, epochAtStart, conflictBlock);
      }
    }
    if (exitTask7PipelineIfSessionStale(rawId, epochAtStart)) return;
  }

  withTask7L4DynamicsCard((card) => {
    if (allowTask7SyncOk && allowTask8Kickoff) {
      card.status = 'completed';
      card.completedAtMs = Date.now();
      card.completionQueued = true;
    } else if (allowTask7SyncOk && !allowTask8Kickoff) {
      card.status = 'running';
      card.completedAtMs = null;
      card.completionQueued = false;
    } else if (l4CollabRaw) {
      card.status = 'completed';
      card.completedAtMs = Date.now();
      appendLineToCard(
        card,
        '→ 任务 7 未收官（Target_KV 落库失败）；请修复后端后对本线步「重启当前」重跑',
        'default',
        { startFullyRevealed: true },
      );
    }
  }, rawId);

  const task7Done = !!(allowTask7SyncOk && l4CollabRaw && allowTask8Kickoff);
  saveDesignDetailLineState(rawId, {
    schemaVersion: 1,
    currentTaskId: task7Done ? 'role_object_stm_inference' : 'key_requirement_scenarios',
    holdPastTask3: false,
    holdPastTask4: false,
    holdPastTask5: false,
    holdPastTask55: true,
    holdPastTask6: true,
    holdPastTask65: true,
    holdPastTask7: task7Done,
    holdPastTask8: false,
  });

  if (task7Done && runTask8L45PrototypePipeline) {
    if (
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) &&
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_8)
    ) {
      await scheduleDebugContinueAfterTask7L4SegmentIfReady(rawId, mergedItem);
    } else {
      await runTask8L45PrototypePipeline(rawId, epochAtStart, llmAbort, mergedItem, pipelineOpts);
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
  const stT7 = loadDesignDetailLineState(rawId);
  if (stT7?.currentTaskId) setCurrentDesignLineTaskId(String(stT7.currentTaskId));
  await flushPersistDesignDetailProgressWorkspace(rawId);
}
