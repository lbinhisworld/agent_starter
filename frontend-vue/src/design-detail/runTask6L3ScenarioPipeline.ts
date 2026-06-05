/**
 * [INPUT]: 任务 6 流水线依赖（由 `useDesignDetailChat` 注入）
 * [OUTPUT]: `runTask6L3ScenarioPipeline` — 按 5.5 价值流阶段循环 LLM → 合并落库
 * [POS]: 任务 5.5 收官后、任务 7 之前
 *
 * [PROTOCOL]: 变更进度文案/落库契约时同步 `useDesignDetailChat.ts` 与本文件
 */

import {
  buildTask6SinglePhaseInferenceUserBlock,
  buildTask6VsmPhaseSubtaskList,
  pickTask1PainPointAndLedgerFeaturesFromGraphTasks,
  pickTask52FieldSetFeaturesFromGraphTasks,
  pickTask55VsmStageFeaturesFromGraphTasks,
  task6PhaseScenarioProgressLine,
  truncateTask6L3DebugProgressText,
  type Task6VsmPhaseSubtask,
} from './buildTask6L3ScenarioInferenceInputFromTaskGraph';
import { pickTask53WorkflowFeaturesFromGraphTasks } from './buildCurrentStateUnderstandingWorkflowsFromTask53';
import { enrichTask6PhaseL3RawWithEvidenceChains } from './task6ScenarioEvidenceEnrich';
import { TASK6_PROGRESS_START_LINE } from './designDetailTask6PhaseProgressLineMigrate';
import { isDesignDetailDebugExperienceActive } from './designDetailExperienceMode';
import { buildTask6VsmPhaseScenarioCallTarget } from './designDetailLlmStats';
import {
  buildForwardInductionLinkUiLinesTask6,
  buildReverseValidationLinkUiLines,
  buildTask6L3ConflictDatasetUserBlock,
  extractTask6L3TokenValidationMappingProgressSnippet,
  mergeL6ScenarioInferenceRawOutputsForServerSync,
  normalizeL6ScenarioInferenceRawForServerSync,
  normalizeLogicGraphTasksFromApiPayload,
  parseTask6L3TokenValidationMappingForAlignment,
  task2L1AllValidationRowsResolved,
  task2L1FilterPotentialConflictRows,
  type Task2L1TvmParsedRow,
} from './designDetailTask2L1SyncUiProgress';
import {
  buildTask6L3TargetKvSyncAlignmentMeta,
  mergeTargetKvSyncBodyWithAlignmentMeta,
} from './designDetailTargetKvSyncAlignmentMeta';
import type { DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { designLinePillLabel } from './designModeTaskPipeline';
import {
  hasFeatureInferenceConclusionOrganizeLine,
  INFERENCE_CONCLUSION_ORGANIZE_LINE,
  pushPipelineFeatureInferenceConclusions,
} from './designDetailFeatureInferenceConclusionProgress';
import type { RunTask9PipelineDeps } from './runTask9L5BlueprintPipeline';
type Task6PipelineRunOpts = {
  deferAlignmentQuestionnaire?: boolean;
  deferDebugContinue?: boolean;
};

type DynamicsLineKind =
  | 'default'
  | 'scope_green'
  | 'bmc_generating'
  | 'task6_inference_sub'
  | 'bmc_result_quote'
  | 'token_validation_mapping_quote'
  | 'inference_conclusion_sub';

export type RunTask6PipelineDeps = Omit<
  RunTask9PipelineDeps,
  'exitTask9PipelineIfSessionStale' | 'withTask9L5DynamicsCard' | 'removeTask9L5LlmWorkingSpinnerLine' | 'removeTask9L5SyncSpinnerLine'
> & {
  exitTask6PipelineIfSessionStale: (rawId: string, epochAtStart: number) => boolean;
  withTask6L3DynamicsCard: (
    fn: (card: RunTask9PipelineDeps['cloneDynamics'] extends () => infer C
      ? C extends (infer U)[]
        ? U
        : never
      : never) => void,
    rawId: string,
  ) => void;
  removeTask6L3SyncSpinnerLine: (rawId: string) => void;
  pipelineOpts?: Task6PipelineRunOpts;
  stashAlignmentPainTargetsForLineTask?: (
    caseId: string,
    lineTaskId: string,
    rows: Task2L1TvmParsedRow[],
  ) => void;
  deferredAlignmentQuestionnaireJob?: { value: unknown | null };
  pendingDebugPipelineContinueAction?: { value: unknown | null };
  appendTask6L3AlignmentQuestionnaireFromConflict?: (
    rawId: string,
    epochAtStart: number,
    conflictBlock: string,
  ) => Promise<void>;
  designDetailDebugGate?: (flag: string) => boolean;
  DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE?: string;
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_65?: string;
  scheduleDebugContinueAfterTask6L3SegmentIfReady?: (
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ) => Promise<void>;
  runTask65ItGapPipeline?: (
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    opts?: Task6PipelineRunOpts,
  ) => Promise<void>;
  runTask7L4CollaborationPipeline?: (
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    opts?: Task6PipelineRunOpts,
  ) => Promise<void>;
  pickTask6TokensFeaturesFromGraphTasks: (
    tasks: unknown[],
  ) => { tokens: Task2L1TaskGraphFeatureRow[]; features: Task2L1TaskGraphFeatureRow[] };
  formatTask5FeatureKvDebugLine: (f: Record<string, unknown>) => string;
  pushTask6PhaseDebugProgressSerial?: (
    rawId: string,
    phaseLabel: string,
    phaseRaw: string,
  ) => Promise<void>;
  /** 任务 6 落库成功后刷新「现状理解」第四层 */
  onTask6CurrentStateCanvasRefresh?: (rawId: string) => void | Promise<void>;
};

const TASK6_SCENARIO_START_LINE = '→ 开始进行关键场景推理';
const TASK6_DEBUG_ALL_PHASES_DONE_LINE = '【调试】【任务 6】→ 全部价值流阶段推理完成';
const TASK6_LOGIC_EXTRACT_LINE = '→ 进行任务 6 推理逻辑提取与合并落库';
const TASK6_SYNC_TARGET_KV_LINE = '→ 正在写入任务 6 Target_KV 与逻辑链…';
const TASK6_SYNC_TARGET_KV_OK_LINE = '→ 任务 6 Target_KV 与逻辑链已写入服务端';
const TASK6_DEBUG_TOKEN_KV_LINE = '【调试】【任务 6】→ 提取到 token';
const TASK6_DEBUG_FEATURE_KV_LINE = '【调试】【任务 6】→ 提取到feature';

type Task6PhaseProgressLineRow = {
  full: string;
  bmcGenUi?: 'spinner' | 'check';
  spinnerBlue?: boolean;
};

function touchTask6PhaseProgressLine(
  card: { lines: Task6PhaseProgressLineRow[] },
  phaseLabel: string,
  patch: Partial<Pick<Task6PhaseProgressLineRow, 'bmcGenUi' | 'spinnerBlue' | 'full'>>,
): void {
  const prefix = task6PhaseScenarioProgressLine(phaseLabel);
  for (const row of card.lines) {
    const bare = String(row.full ?? '')
      .replace(/\s*✅\s*$/u, '')
      .replace(/\s*✔️?\s*$/u, '')
      .trim();
    if (bare !== prefix && !bare.startsWith(`${prefix} `)) continue;
    if (patch.full != null) row.full = patch.full;
    if (patch.bmcGenUi !== undefined) row.bmcGenUi = patch.bmcGenUi;
    if (patch.spinnerBlue !== undefined) row.spinnerBlue = patch.spinnerBlue;
  }
}

function markTask6PhaseSubtaskLineInProgress(
  card: { lines: Task6PhaseProgressLineRow[] },
  phaseLabel: string,
): void {
  touchTask6PhaseProgressLine(card, phaseLabel, {
    full: task6PhaseScenarioProgressLine(phaseLabel),
    bmcGenUi: 'spinner',
    spinnerBlue: true,
  });
}

function markTask6PhaseSubtaskLineDone(
  card: { lines: Task6PhaseProgressLineRow[] },
  phaseLabel: string,
): void {
  touchTask6PhaseProgressLine(card, phaseLabel, {
    full: task6PhaseScenarioProgressLine(phaseLabel),
    bmcGenUi: 'check',
    spinnerBlue: undefined,
  });
}

export async function runTask6L3ScenarioPipeline(deps: RunTask6PipelineDeps): Promise<void> {
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
    exitTask6PipelineIfSessionStale,
    withTask6L3DynamicsCard,
    removeTask6L3SyncSpinnerLine,
    waitUntilDynamicsFullyRevealed,
    pipelineOpts,
    stashAlignmentPainTargetsForLineTask,
    deferredAlignmentQuestionnaireJob,
    pendingDebugPipelineContinueAction,
    appendTask6L3AlignmentQuestionnaireFromConflict,
    designDetailDebugGate,
    DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE,
    DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_65,
    scheduleDebugContinueAfterTask6L3SegmentIfReady,
    runTask65ItGapPipeline,
    runTask7L4CollaborationPipeline,
    pickTask6TokensFeaturesFromGraphTasks,
    formatTask5FeatureKvDebugLine,
    pushTask6PhaseDebugProgressSerial,
    onTask6CurrentStateCanvasRefresh,
  } = deps;

  if (designDetailSessionGeneration !== epochAtStart) return;

  const w = window as unknown as {
    inferDesignDetailL3ScenarioFromContext?: (
      p: Record<string, unknown>,
      fetchOpts?: { signal?: AbortSignal },
    ) => Promise<{ rawOutput?: string; content?: string }>;
  };
  if (typeof w.inferDesignDetailL3ScenarioFromContext !== 'function') {
    withTask6L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 6 推理失败：未加载 inferDesignDetailL3ScenarioFromContext（请确认 design-detail.html 已加载 designDetailL3ScenarioSystemPrompt.js）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    return;
  }

  let cards = deps.cloneDynamics();
  const hasTask6Card = cards.some((c) => c.lineTaskId === 'pain_point_extraction');
  if (!hasTask6Card) {
    cards = [
      ...cards,
      {
        key: `pain_point_extraction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineTaskId: 'pain_point_extraction',
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

  withTask6L3DynamicsCard((card) => {
    appendLineToCard(card, TASK6_SCENARIO_START_LINE, 'scope_green', { startFullyRevealed: true });
    appendLineToCard(card, TASK6_PROGRESS_START_LINE, 'scope_green', { startFullyRevealed: true });
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

  let task55Features: Task2L1TaskGraphFeatureRow[] = [];
  let task53WorkflowFeatures: Task2L1TaskGraphFeatureRow[] = [];
  let task52FieldSetFeatures: Task2L1TaskGraphFeatureRow[] = [];
  let task1PainAndLedgerFeatures: Task2L1TaskGraphFeatureRow[] = [];
  if (typeof getGraph === 'function') {
    try {
      const gr = await getGraph(rawId);
      if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
        const tasks = gr.data.tasks;
        task55Features = pickTask55VsmStageFeaturesFromGraphTasks(tasks);
        task53WorkflowFeatures = pickTask53WorkflowFeaturesFromGraphTasks(tasks) as Task2L1TaskGraphFeatureRow[];
        task52FieldSetFeatures = pickTask52FieldSetFeaturesFromGraphTasks(tasks);
        task1PainAndLedgerFeatures = pickTask1PainPointAndLedgerFeaturesFromGraphTasks(tasks);
      }
    } catch {
      /* 空图仍送模 */
    }
  }

  const phaseSubtasks: Task6VsmPhaseSubtask[] = buildTask6VsmPhaseSubtaskList(task55Features);

  if (!phaseSubtasks.length) {
    withTask6L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 6 推理已跳过：推理图任务 5.5 卡内未解析到「价值流阶段」特征行（请确认 5.5 已落库）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  withTask6L3DynamicsCard((card) => {
    appendLineToCard(
      card,
      `→ 扫描任务 5.5 价值流阶段，共 ${phaseSubtasks.length} 个阶段待推理关键场景`,
      'scope_green',
      { startFullyRevealed: true },
    );
    for (const sub of phaseSubtasks) {
      appendLineToCard(card, task6PhaseScenarioProgressLine(sub.phaseLabel), 'default', {
        startFullyRevealed: true,
      });
    }
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  const perPhaseRawOutputs: string[] = [];

  for (const sub of phaseSubtasks) {
    withTask6L3DynamicsCard((card) => {
      markTask6PhaseSubtaskLineInProgress(card, sub.phaseLabel);
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    const userBlock = buildTask6SinglePhaseInferenceUserBlock(
      sub,
      task52FieldSetFeatures,
      task1PainAndLedgerFeatures,
    );
    let phaseRaw = '';
    try {
      const res = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: designLinePillLabel('pain_point_extraction'),
          callTarget: buildTask6VsmPhaseScenarioCallTarget(sub.phaseLabel),
        },
        () =>
          w.inferDesignDetailL3ScenarioFromContext!(
            { task6InferenceUserBlock: userBlock },
            { signal: llmAbort.signal },
          ),
      );
      if (exitTask6PipelineIfSessionStale(rawId, epochAtStart)) return;
      phaseRaw = String(res.rawOutput || res.content || '').trim();
      if (!phaseRaw) {
        throw new Error(`价值流阶段「${sub.phaseLabel}」模型无输出`);
      }
      perPhaseRawOutputs.push(
        enrichTask6PhaseL3RawWithEvidenceChains(phaseRaw, sub, task53WorkflowFeatures),
      );
      if (pushTask6PhaseDebugProgressSerial) {
        await pushTask6PhaseDebugProgressSerial(rawId, sub.phaseLabel, phaseRaw);
        if (exitTask6PipelineIfSessionStale(rawId, epochAtStart)) return;
      }
      withTask6L3DynamicsCard((card) => {
        markTask6PhaseSubtaskLineDone(card, sub.phaseLabel);
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
    } catch (e) {
      if (exitTask6PipelineIfSessionStale(rawId, epochAtStart)) return;
      withTask6L3DynamicsCard((card) => {
        appendLineToCard(
          card,
          `→ 价值流阶段「${sub.phaseLabel}」关键场景推理失败：${e instanceof Error ? e.message : String(e)}`,
          'default',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return;
    }
  }

  const mergeNorm = mergeL6ScenarioInferenceRawOutputsForServerSync(perPhaseRawOutputs);
  const l3ScenarioRaw = mergeNorm.ok ? mergeNorm.normalized : '';

  withTask6L3DynamicsCard((card) => {
    appendLineToCard(card, TASK6_DEBUG_ALL_PHASES_DONE_LINE, 'default', { startFullyRevealed: true });
    if (perPhaseRawOutputs.length === 1 && !isDesignDetailDebugExperienceActive()) {
      appendLineToCard(
        card,
        truncateTask6L3DebugProgressText(perPhaseRawOutputs[0] ?? '（无）'),
        'task6_inference_sub',
        { startFullyRevealed: true },
      );
    } else if (perPhaseRawOutputs.length > 1) {
      appendLineToCard(
        card,
        `→ 已合并 ${perPhaseRawOutputs.length} 个价值流阶段的 L3_Scenario_Inference_Matrix（见落库结果）`,
        'default',
        { startFullyRevealed: true },
      );
    }
    appendLineToCard(card, TASK6_LOGIC_EXTRACT_LINE, 'scope_green', { startFullyRevealed: true });
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  if (!mergeNorm.ok) {
    withTask6L3DynamicsCard((card) => {
      appendLineToCard(card, `→ 多阶段合并失败：${mergeNorm.message}`, 'default', {
        startFullyRevealed: true,
      });
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  let allowTask6SyncOk = false;
  if (isOnlineMode() && l3ScenarioRaw) {
    const postT6 = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            postDesignDetailSyncTask6L3ScenarioTargetKvTokens?: (
              id: string,
              body: Record<string, unknown>,
            ) => Promise<{ ok?: boolean; message?: string; status?: number } | null>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask6L3ScenarioTargetKvTokens;
    if (typeof postT6 === 'function') {
      try {
        const normT6 = normalizeL6ScenarioInferenceRawForServerSync(l3ScenarioRaw);
        if (!normT6.ok) {
          removeTask6L3SyncSpinnerLine(rawId);
          withTask6L3DynamicsCard((card) => {
            appendLineToCard(card, `→ Target_KV 落库失败：${normT6.message}`, 'default', {
              startFullyRevealed: true,
            });
          }, rawId);
        } else {
          withTask6L3DynamicsCard((card) => {
            appendLineToCard(card, TASK6_SYNC_TARGET_KV_LINE, 'bmc_generating', {
              bmcGenUi: 'spinner',
              spinnerBlue: true,
              startFullyRevealed: true,
            });
          }, rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          let syncRes: { ok?: boolean; message?: string; status?: number } | null = null;
          try {
            syncRes = await postT6(
              rawId,
              mergeTargetKvSyncBodyWithAlignmentMeta(
                { l3ProcessInferenceRaw: normT6.normalized },
                buildTask6L3TargetKvSyncAlignmentMeta(rawId),
              ),
            );
          } finally {
            removeTask6L3SyncSpinnerLine(rawId);
          }
          if (exitTask6PipelineIfSessionStale(rawId, epochAtStart)) return;
          if (syncRes?.ok === true) {
            allowTask6SyncOk = true;
            try {
              console.warn('[design-detail:task6-l3-sync]', { caseId: rawId, ok: true });
            } catch {
              /* ignore */
            }
            withTask6L3DynamicsCard((card) => {
              appendLineToCard(card, TASK6_SYNC_TARGET_KV_OK_LINE, 'scope_green', {
                startFullyRevealed: true,
              });
            }, rawId);
            await flushPersistDesignDetailProgressWorkspace(rawId);
            if (onTask6CurrentStateCanvasRefresh) {
              try {
                await onTask6CurrentStateCanvasRefresh(rawId);
                withTask6L3DynamicsCard((card) => {
                  appendLineToCard(
                    card,
                    '→ 更新现状理解画布（关键痛点场景层）',
                    'scope_green',
                    { startFullyRevealed: true },
                  );
                }, rawId);
              } catch {
                /* 画布刷新失败不阻断任务 6 */
              }
            }
            if (typeof getGraph === 'function') {
              const gr2 = await getGraph(rawId);
              if (gr2?.ok === true && gr2.data && Array.isArray(gr2.data.tasks)) {
                const mergedForProgress = normalizeLogicGraphTasksFromApiPayload(
                  gr2.data.tasks as DesignDetailLogicGraphTaskDto[],
                );
                await pushPipelineFeatureInferenceConclusions({
                  rawId,
                  lineTaskId: 'pain_point_extraction',
                  mergedForProgress,
                  readProgressLines: () => {
                    let snap: Array<{
                      kind: string;
                      full: string;
                      cursor?: number;
                      inferenceFeatureId?: string;
                    }> = [];
                    withTask6L3DynamicsCard((card) => {
                      snap = card.lines;
                    }, rawId);
                    return snap;
                  },
                  ensureOrganizeLine: () => {
                    withTask6L3DynamicsCard((card) => {
                      if (!hasFeatureInferenceConclusionOrganizeLine(card.lines)) {
                        appendLineToCard(card, INFERENCE_CONCLUSION_ORGANIZE_LINE, 'scope_green', {
                          startFullyRevealed: true,
                        });
                      }
                    }, rawId);
                  },
                  appendToCard: (text, kind, opts) =>
                    withTask6L3DynamicsCard((card) => {
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
                withTask6L3DynamicsCard((card) => {
                  appendLineToCard(card, '→ 任务 6：开始提炼正向归纳链接', 'scope_green', {
                    startFullyRevealed: true,
                  });
                  for (const ln of buildForwardInductionLinkUiLinesTask6(mergedForProgress)) {
                    appendLineToCard(card, ln, 'bmc_result_quote', { startFullyRevealed: true });
                  }
                  appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
                  appendLineToCard(card, '→ Token_Validation_Mapping（L3 关键场景）：', 'scope_green', {
                    startFullyRevealed: true,
                  });
                  appendLineToCard(
                    card,
                    extractTask6L3TokenValidationMappingProgressSnippet(l3ScenarioRaw),
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
                  appendLineToCard(card, TASK6_DEBUG_TOKEN_KV_LINE, 'default', { startFullyRevealed: true });
                  const tf = pickTask6TokensFeaturesFromGraphTasks(gr2.data.tasks);
                  const tokenLines = tf.tokens
                    .map((row) => String(row.tokenId ?? '').trim())
                    .filter(Boolean)
                    .map((tid) => `任务 6-token-${tid}`);
                  appendLineToCard(
                    card,
                    tokenLines.length ? tokenLines.join('\n') : '（无 token）',
                    'task6_inference_sub',
                    { startFullyRevealed: true },
                  );
                  appendLineToCard(card, TASK6_DEBUG_FEATURE_KV_LINE, 'default', { startFullyRevealed: true });
                  const featLines = tf.features.map((f) => formatTask5FeatureKvDebugLine(f));
                  appendLineToCard(
                    card,
                    featLines.length ? featLines.join('\n') : '（无 feature）',
                    'task6_inference_sub',
                    { startFullyRevealed: true },
                  );
                }, rawId);
                logicTreeGraphRefreshTick.value += 1;
              }
            }
          } else {
            const hint =
              syncRes && typeof syncRes.message === 'string' ? syncRes.message : '同步失败';
            withTask6L3DynamicsCard((card) => {
              appendLineToCard(card, `→ Target_KV 落库失败：${hint}`, 'default', {
                startFullyRevealed: true,
              });
              if (syncRes && syncRes.status === 404) {
                appendLineToCard(
                  card,
                  '→ 多为监听端口上的后端仍是旧构建（未注册 sync-task6 路由）。请在 backend 执行 npm run build 后重启本地后端，再对本线步「重启当前」重跑。',
                  'default',
                  { startFullyRevealed: true },
                );
              }
            }, rawId);
          }
        }
      } catch (eKv) {
        removeTask6L3SyncSpinnerLine(rawId);
        withTask6L3DynamicsCard((card) => {
          appendLineToCard(
            card,
            `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
            'default',
            { startFullyRevealed: true },
          );
        }, rawId);
      }
    }
  } else if (!isOnlineMode() && l3ScenarioRaw) {
    allowTask6SyncOk = true;
  }

  async function runTask6L3TvmGateAndMaybeAlignmentQuestionnaire(
    opts?: Task6PipelineRunOpts,
  ): Promise<boolean> {
    const raw = String(l3ScenarioRaw || '').trim();
    if (!raw) {
      withTask6L3DynamicsCard((card) => {
        appendLineToCard(card, '→ 反向验证校验跳过：无 L3 模型输出', 'default', {
          startFullyRevealed: true,
        });
      }, rawId);
      return false;
    }
    const tvmRowsForAlign = parseTask6L3TokenValidationMappingForAlignment(raw);
    const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
    const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
    const conflictCount = conflictRows.length;
    try {
      console.warn('[design-detail:task6-l3-gate]', {
        caseId: rawId,
        tvmRows: tvmRowsForAlign.length,
        potentialConflictCount: conflictCount,
        allowTask65Kickoff: !hasUnresolvedTvmConflict,
      });
    } catch {
      /* ignore */
    }
    withTask6L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        `→ 反向验证校验｜Token_Validation_Mapping ${tvmRowsForAlign.length} 条｜${
          hasUnresolvedTvmConflict
            ? `存在 ${conflictCount} 处潜在冲突，需对齐确认后方可进入任务 6.5`
            : 'Consistency 均已消解或已确认为痛点，可进入任务 6.5'
        }`,
        'scope_green',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    if (!hasUnresolvedTvmConflict) return true;

    if (pendingDebugPipelineContinueAction) {
      pendingDebugPipelineContinueAction.value = null;
    }
    if (!conflictCount) {
      withTask6L3DynamicsCard((card) => {
        appendLineToCard(
          card,
          '→ 门禁判定存在未消解校验，但冲突清单为空；请查看控制台 [design-detail:task6-l3-gate]',
          'default',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return false;
    }
    const conflictBlock = buildTask6L3ConflictDatasetUserBlock(conflictRows);
    stashAlignmentPainTargetsForLineTask?.(rawId, 'pain_point_extraction', conflictRows);
    if (opts?.deferAlignmentQuestionnaire && deferredAlignmentQuestionnaireJob) {
      deferredAlignmentQuestionnaireJob.value = {
        caseId: rawId,
        lineTaskId: 'pain_point_extraction',
        epochAtStart,
        conflictDatasetUserBlock: conflictBlock,
        tier: 'task6',
      };
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return false;
    }
    await appendTask6L3AlignmentQuestionnaireFromConflict?.(rawId, epochAtStart, conflictBlock);
    return false;
  }

  let allowTask65Kickoff = false;
  if (allowTask6SyncOk && l3ScenarioRaw) {
    allowTask65Kickoff = await runTask6L3TvmGateAndMaybeAlignmentQuestionnaire(pipelineOpts);
    if (exitTask6PipelineIfSessionStale(rawId, epochAtStart)) return;
  }

  if (l3ScenarioRaw) {
    withTask6L3DynamicsCard((card) => {
      if (allowTask6SyncOk && allowTask65Kickoff) {
        card.status = 'completed';
        card.completedAtMs = Date.now();
        card.completionQueued = true;
      } else if (allowTask6SyncOk && !allowTask65Kickoff) {
        card.status = 'running';
        card.completedAtMs = null;
        card.completionQueued = false;
      } else {
        card.status = 'completed';
        card.completedAtMs = Date.now();
        appendLineToCard(
          card,
          '→ 任务 6 未收官（Target_KV 落库失败）；请修复后端后对本线步「重启当前」重跑',
          'default',
          { startFullyRevealed: true },
        );
      }
    }, rawId);
  }

  const task6Done = !!(allowTask6SyncOk && l3ScenarioRaw && allowTask65Kickoff);
  saveDesignDetailLineState(rawId, {
    schemaVersion: 1,
    currentTaskId: task6Done ? 'three_dimension_itgap_analysis' : 'pain_point_extraction',
    holdPastTask3: false,
    holdPastTask4: false,
    holdPastTask5: false,
    holdPastTask55: true,
    holdPastTask6: task6Done,
    holdPastTask65: false,
    holdPastTask7: false,
  });
  if (task6Done) {
    const debugContinue =
      !pipelineOpts?.deferDebugContinue &&
      designDetailDebugGate?.(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE ?? '') &&
      designDetailDebugGate?.(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_65 ?? '');
    if (debugContinue && scheduleDebugContinueAfterTask6L3SegmentIfReady) {
      await scheduleDebugContinueAfterTask6L3SegmentIfReady(rawId, mergedItem);
    } else if (runTask65ItGapPipeline) {
      await runTask65ItGapPipeline(rawId, epochAtStart, llmAbort, mergedItem, pipelineOpts);
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
  const stT6 = loadDesignDetailLineState(rawId);
  if (stT6?.currentTaskId) setCurrentDesignLineTaskId(stT6.currentTaskId);
  await flushPersistDesignDetailProgressWorkspace(rawId);
}
