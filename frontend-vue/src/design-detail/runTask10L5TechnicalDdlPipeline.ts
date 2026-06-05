/**
 * [INPUT]: 任务 10 流水线依赖（由 `useDesignDetailChat` 注入）
 * [OUTPUT]: `runTask10L5TechnicalDdlPipeline` 执行 L5 物理 DDL 推理与落库
 * [POS]: 任务 9 收官后、任务 11 之前
 *
 * [PROTOCOL]: 变更任务 10 进度文案/落库契约时同步 `useDesignDetailChat.ts` 与本文件
 */

import {
  buildTask10L5TechnicalDdlInferenceUserBlock,
  pickTask1FeaturesFromGraphTasksForTask10,
  pickTask8MicroActionGridFeaturesFromGraphTasks,
  pickTask9SystemModuleFeaturesFromGraphTasks,
  truncateTask10L5DebugProgressText,
} from './buildTask10L5TechnicalDdlInferenceInputFromTaskGraph';
import { DESIGN_DETAIL_LLM_CALL_TARGET_L5_TECHNICAL_DDL } from './designDetailLlmStats';
import {
  buildForwardInductionLinkUiLinesTask10,
  buildTask10L5ConflictDatasetUserBlock,
  extractTask10L5TokenValidationMappingProgressSnippet,
  normalizeL5TechnicalDdlInferenceRawForServerSync,
  normalizeLogicGraphTasksFromApiPayload,
  parseTask10L5TokenValidationMappingForAlignment,
  task2L1AllValidationRowsResolved,
  task2L1FilterPotentialConflictRows,
  type Task2L1TvmParsedRow,
} from './designDetailTask2L1SyncUiProgress';
import type { DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { designLinePillLabel } from './designModeTaskPipeline';
import {
  hasFeatureInferenceConclusionOrganizeLine,
  INFERENCE_CONCLUSION_ORGANIZE_LINE,
  pushPipelineFeatureInferenceConclusions,
} from './designDetailFeatureInferenceConclusionProgress';
import { logTask10ArchGate } from './designDetailTask10ArchGateDebugLog';
import {
  buildTask10L5TargetKvSyncAlignmentMeta,
  mergeTargetKvSyncBodyWithAlignmentMeta,
} from './designDetailTargetKvSyncAlignmentMeta';
import type { RunTask9PipelineDeps } from './runTask9L5BlueprintPipeline';

type DynamicsLineKind =
  | 'default'
  | 'scope_green'
  | 'bmc_generating'
  | 'task10_inference_sub'
  | 'bmc_result_quote'
  | 'inference_conclusion_sub'
  | 'token_validation_mapping_quote';

export type RunTask10PipelineOpts = {
  deferAlignmentQuestionnaire?: boolean;
  deferDebugContinue?: boolean;
};

export type RunTask10PipelineDeps = Omit<
  RunTask9PipelineDeps,
  'readTask5L3UserRectificationText' | 'exitTask9PipelineIfSessionStale' | 'withTask9L5DynamicsCard' | 'removeTask9L5LlmWorkingSpinnerLine' | 'removeTask9L5SyncSpinnerLine' | 'onTask9Done'
> & {
  exitTask10PipelineIfSessionStale: (rawId: string, epochAtStart: number) => boolean;
  withTask10DynamicsCard: (fn: (card: RunTask9PipelineDeps['cloneDynamics'] extends () => infer C ? C extends (infer U)[] ? U : never : never) => void, rawId: string) => void;
  removeTask10LlmWorkingSpinnerLine: (rawId: string) => void;
  removeTask10SyncSpinnerLine: (rawId: string) => void;
  onTask10Done?: (
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
  ) => void | Promise<void>;
  pipelineOpts?: RunTask10PipelineOpts;
  readTask10L5DeepInsightText?: (caseId: string) => string;
  readTask10L5UserRectificationText?: (caseId: string) => string;
  appendTask10L5AlignmentQuestionnaireFromConflict?: (
    caseId: string,
    epochAtStart: number,
    conflictBlock: string,
  ) => Promise<void>;
  stashAlignmentPainTargetsForLineTask?: (
    caseId: string,
    lineTaskId: string,
    rows: Task2L1TvmParsedRow[],
  ) => void;
  setDeferredAlignmentQuestionnaireJob?: (job: {
    caseId: string;
    lineTaskId: 'process_type_derivation';
    epochAtStart: number;
    conflictDatasetUserBlock: string;
    tier: 'task10';
  } | null) => void;
};

const TASK10_START_LINE = '→ 开始进行 L5 数据架构 / 范式排异推理';
const TASK10_DEBUG_INFERENCE_DONE_LINE = '→ 任务 10 推理完成';
const TASK10_LOGIC_EXTRACT_LINE = '→ 任务 10：开始提炼推理逻辑';
const TASK10_SYNC_TARGET_KV_LINE = '→ 正在进行 Target_KV 落库（任务 10）';
const TASK10_SYNC_TARGET_KV_OK_LINE = '→ 任务 10 Target_KV 与逻辑链已写入服务端';
const TASK10_DEBUG_TOKEN_KV_LINE = '→ 任务 10 token / feature 明细';
const TASK10_DEBUG_FEATURE_KV_LINE = '→ 任务 10 feature 明细';
const TASK10_LLM_WORKING_LINE = '→ 正在进行 L5 数据架构与 TVM 反向验证推理（大模型，最长约 5 分钟）';

async function runTask10L5TvmGateAndMaybeAlignmentQuestionnaire(
  ctx: {
    rawId: string;
    epochAtStart: number;
    withTask10DynamicsCard: RunTask10PipelineDeps['withTask10DynamicsCard'];
    appendLineToCard: RunTask10PipelineDeps['appendLineToCard'];
    flushPersistDesignDetailProgressWorkspace: RunTask10PipelineDeps['flushPersistDesignDetailProgressWorkspace'];
    appendTask10L5AlignmentQuestionnaireFromConflict?: RunTask10PipelineDeps['appendTask10L5AlignmentQuestionnaireFromConflict'];
    stashAlignmentPainTargetsForLineTask?: RunTask10PipelineDeps['stashAlignmentPainTargetsForLineTask'];
    setDeferredAlignmentQuestionnaireJob?: RunTask10PipelineDeps['setDeferredAlignmentQuestionnaireJob'];
  },
  raw: string,
  opts?: RunTask10PipelineOpts,
): Promise<boolean> {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    ctx.withTask10DynamicsCard((card) => {
      ctx.appendLineToCard(card, '→ 反向验证校验跳过：无 L5 模型输出', 'default', {
        startFullyRevealed: true,
      });
    }, ctx.rawId);
    return false;
  }
  const tvmRowsForAlign = parseTask10L5TokenValidationMappingForAlignment(trimmed);
  const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
  const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
  const conflictCount = conflictRows.length;
  try {
    console.warn('[design-detail:task10-l5-gate]', {
      caseId: ctx.rawId,
      tvmRows: tvmRowsForAlign.length,
      potentialConflictCount: conflictCount,
      allowTask11Kickoff: !hasUnresolvedTvmConflict,
    });
  } catch {
    /* ignore */
  }
  ctx.withTask10DynamicsCard((card) => {
    ctx.appendLineToCard(
      card,
      `→ 反向验证校验｜Token_Validation_Mapping ${tvmRowsForAlign.length} 条｜${
        hasUnresolvedTvmConflict
          ? `存在 ${conflictCount} 处潜在冲突，需对齐确认后方可进入任务 11`
          : 'Consistency 均已消解，可进入任务 11'
      }`,
      'scope_green',
      { startFullyRevealed: true },
    );
  }, ctx.rawId);
  await ctx.flushPersistDesignDetailProgressWorkspace(ctx.rawId);
  if (!hasUnresolvedTvmConflict) return true;
  if (!conflictCount) {
    ctx.withTask10DynamicsCard((card) => {
      ctx.appendLineToCard(
        card,
        '→ 门禁判定存在未消解校验，但冲突清单为空；请查看控制台 [design-detail:task10-l5-gate]',
        'default',
        { startFullyRevealed: true },
      );
    }, ctx.rawId);
    await ctx.flushPersistDesignDetailProgressWorkspace(ctx.rawId);
    return false;
  }
  const conflictBlock = buildTask10L5ConflictDatasetUserBlock(conflictRows);
  ctx.stashAlignmentPainTargetsForLineTask?.(ctx.rawId, 'process_type_derivation', conflictRows);
  if (opts?.deferAlignmentQuestionnaire) {
    ctx.setDeferredAlignmentQuestionnaireJob?.({
      caseId: ctx.rawId,
      lineTaskId: 'process_type_derivation',
      epochAtStart: ctx.epochAtStart,
      conflictDatasetUserBlock: conflictBlock,
      tier: 'task10',
    });
    await ctx.flushPersistDesignDetailProgressWorkspace(ctx.rawId);
    return false;
  }
  if (typeof ctx.appendTask10L5AlignmentQuestionnaireFromConflict === 'function') {
    await ctx.appendTask10L5AlignmentQuestionnaireFromConflict(ctx.rawId, ctx.epochAtStart, conflictBlock);
  }
  return false;
}

export async function runTask10L5TechnicalDdlPipelineImpl(deps: RunTask10PipelineDeps): Promise<void> {
  const {
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
    exitTask10PipelineIfSessionStale,
    withTask10DynamicsCard,
    removeTask10LlmWorkingSpinnerLine,
    removeTask10SyncSpinnerLine,
    waitUntilDynamicsFullyRevealed,
    onTask10Done,
    pipelineOpts,
    readTask10L5DeepInsightText,
    readTask10L5UserRectificationText,
    appendTask10L5AlignmentQuestionnaireFromConflict,
    stashAlignmentPainTargetsForLineTask,
    setDeferredAlignmentQuestionnaireJob,
  } = deps;

  if (designDetailSessionGeneration !== epochAtStart) {
    logTask10ArchGate('pipeline_early_exit_session_stale', {
      caseId: rawId,
      epochAtStart,
      designDetailSessionGeneration,
      at: 'entry',
    });
    return;
  }

  logTask10ArchGate('pipeline_start', { caseId: rawId, epochAtStart });

  const w = window as unknown as {
    inferDesignDetailL5TechnicalDdlFromContext?: (
      p: Record<string, unknown>,
      fetchOpts?: { signal?: AbortSignal },
    ) => Promise<{ rawOutput?: string; content?: string }>;
  };
  if (typeof w.inferDesignDetailL5TechnicalDdlFromContext !== 'function') {
    withTask10DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 10 推理失败：未加载 inferDesignDetailL5TechnicalDdlFromContext（请确认已加载 designDetailL5TechnicalDdlSystemPrompt.js）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    return;
  }

  let cards = cloneDynamics();
  let c10 = cards.find((c) => c.lineTaskId === 'process_type_derivation');
  if (!c10) {
    c10 = {
      key: `process_type_derivation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lineTaskId: 'process_type_derivation',
      status: 'running',
      startedAtMs: Date.now(),
      completedAtMs: null,
      lines: [],
      extraTailConsumed: 0,
      completionQueued: false,
      thanksAppended: false,
    };
    cards = [...cards, c10];
    setDynamicsCards(cards);
  }

  appendLineToCard(c10, TASK10_START_LINE, 'scope_green', { startFullyRevealed: true });
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

  let task9Modules: Task2L1TaskGraphFeatureRow[] = [];
  let task8MicroGrid: Task2L1TaskGraphFeatureRow[] = [];
  let task1Features: Task2L1TaskGraphFeatureRow[] = [];
  if (typeof getGraph === 'function') {
    try {
      const gr = await getGraph(rawId);
      if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
        task9Modules = pickTask9SystemModuleFeaturesFromGraphTasks(gr.data.tasks);
        task8MicroGrid = pickTask8MicroActionGridFeaturesFromGraphTasks(gr.data.tasks);
        task1Features = pickTask1FeaturesFromGraphTasksForTask10(gr.data.tasks);
      }
    } catch {
      /* 空图仍送模 */
    }
  }

  const task10InferenceUserBlock = buildTask10L5TechnicalDdlInferenceUserBlock(
    task9Modules,
    task8MicroGrid,
    task1Features,
    {
      deepInsightText: readTask10L5DeepInsightText?.(rawId),
      userRectificationText: readTask10L5UserRectificationText?.(rawId),
    },
  );

  withTask10DynamicsCard((card) => {
    appendLineToCard(card, TASK10_LLM_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  let l5DdlRaw = '';
  try {
    const res = await withLlmAuditCtx(
      {
        caseId: rawId,
        taskId: designLinePillLabel('process_type_derivation'),
        callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_L5_TECHNICAL_DDL,
      },
      () =>
        w.inferDesignDetailL5TechnicalDdlFromContext!(
          { task10InferenceUserBlock },
          { signal: llmAbort.signal },
        ),
    );
    if (exitTask10PipelineIfSessionStale(rawId, epochAtStart)) {
      logTask10ArchGate('pipeline_early_exit_session_stale', {
        caseId: rawId,
        epochAtStart,
        designDetailSessionGeneration,
        at: 'after_llm',
      });
      return;
    }

    removeTask10LlmWorkingSpinnerLine(rawId);
    l5DdlRaw = String(res.rawOutput || res.content || '').trim();
    withTask10DynamicsCard((card) => {
      appendLineToCard(card, TASK10_DEBUG_INFERENCE_DONE_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        card,
        truncateTask10L5DebugProgressText(l5DdlRaw || '（模型无输出）'),
        'task10_inference_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(card, TASK10_LOGIC_EXTRACT_LINE, 'scope_green', { startFullyRevealed: true });
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    let allowTask10SyncOk = false;
    let allowTask11Kickoff = false;
    if (isOnlineMode() && l5DdlRaw) {
      const postT10 = (
        window as unknown as {
          SmartCto?: {
            problemCaseApi?: {
              postDesignDetailSyncTask10L5TechnicalDdlTargetKvTokens?: (
                id: string,
                body: Record<string, unknown>,
              ) => Promise<{ ok?: boolean; message?: string; status?: number } | null>;
            };
          };
        }
      ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask10L5TechnicalDdlTargetKvTokens;
      if (typeof postT10 === 'function') {
        try {
          const normT10 = normalizeL5TechnicalDdlInferenceRawForServerSync(l5DdlRaw);
          const syncPayload = normT10.ok ? normT10.normalized : l5DdlRaw;
          if (!normT10.ok) {
            logTask10ArchGate('pipeline_sync_norm_fallback_raw', {
              caseId: rawId,
              message: normT10.message,
            });
          }
          withTask10DynamicsCard((card) => {
            appendLineToCard(card, TASK10_SYNC_TARGET_KV_LINE, 'bmc_generating', {
              bmcGenUi: 'spinner',
              spinnerBlue: true,
              startFullyRevealed: true,
            });
          }, rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          let syncRes: { ok?: boolean; message?: string; status?: number } | null = null;
          try {
            syncRes = await postT10(
              rawId,
              mergeTargetKvSyncBodyWithAlignmentMeta(
                { l3ProcessInferenceRaw: syncPayload },
                buildTask10L5TargetKvSyncAlignmentMeta(rawId),
              ),
            );
          } finally {
            removeTask10SyncSpinnerLine(rawId);
          }
          if (syncRes?.ok === true) {
              allowTask10SyncOk = true;
              logTask10ArchGate('pipeline_sync_ok', { caseId: rawId });
              withTask10DynamicsCard((card) => {
                appendLineToCard(card, TASK10_SYNC_TARGET_KV_OK_LINE, 'scope_green', {
                  startFullyRevealed: true,
                });
              }, rawId);
              await flushPersistDesignDetailProgressWorkspace(rawId);
              if (typeof getGraph === 'function' && !exitTask10PipelineIfSessionStale(rawId, epochAtStart)) {
                const gr2 = await getGraph(rawId);
                if (gr2?.ok === true && gr2.data && Array.isArray(gr2.data.tasks)) {
                  const mergedForProgress = normalizeLogicGraphTasksFromApiPayload(
                    gr2.data.tasks as DesignDetailLogicGraphTaskDto[],
                  );
                  await pushPipelineFeatureInferenceConclusions({
                    rawId,
                    lineTaskId: 'process_type_derivation',
                    mergedForProgress,
                    readProgressLines: () => {
                      let snap: Array<{ kind: string; full: string; cursor?: number; inferenceFeatureId?: string }> =
                        [];
                      withTask10DynamicsCard((card) => {
                        snap = card.lines;
                      }, rawId);
                      return snap;
                    },
                    ensureOrganizeLine: () => {
                      withTask10DynamicsCard((card) => {
                        if (!hasFeatureInferenceConclusionOrganizeLine(card.lines)) {
                          appendLineToCard(card, INFERENCE_CONCLUSION_ORGANIZE_LINE, 'scope_green', {
                            startFullyRevealed: true,
                          });
                        }
                      }, rawId);
                    },
                    appendToCard: (text, kind, opts) =>
                      withTask10DynamicsCard((card) => {
                        appendLineToCard(card, text, kind, {
                          startFullyRevealed:
                            kind !== 'inference_conclusion_sub'
                              ? true
                              : (opts?.startFullyRevealed ?? false),
                          inferenceFeatureId: opts?.inferenceFeatureId,
                        });
                      }, rawId),
                    waitRevealComplete: waitUntilDynamicsFullyRevealed,
                    withLlmAuditCtx,
                    signal: llmAbort.signal,
                  });
                  withTask10DynamicsCard((card) => {
                    appendLineToCard(card, '→ 任务 10：开始提炼正向归纳链接', 'scope_green', {
                      startFullyRevealed: true,
                    });
                    for (const ln of buildForwardInductionLinkUiLinesTask10(mergedForProgress)) {
                      appendLineToCard(card, ln, 'bmc_result_quote', { startFullyRevealed: true });
                    }
                    appendLineToCard(card, '→ Token_Validation_Mapping（L5 数据架构）：', 'scope_green', {
                      startFullyRevealed: true,
                    });
                    appendLineToCard(
                      card,
                      extractTask10L5TokenValidationMappingProgressSnippet(l5DdlRaw),
                      'token_validation_mapping_quote',
                      { startFullyRevealed: true },
                    );
                    appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', {
                      startFullyRevealed: true,
                    });
                    const tf = pickTask10TokensFeaturesFromGraphTasks(gr2.data.tasks);
                    appendLineToCard(card, TASK10_DEBUG_TOKEN_KV_LINE, 'default', {
                      startFullyRevealed: true,
                    });
                    const tokenLines = tf.tokens
                      .map((row) => String(row.tokenId ?? '').trim())
                      .filter(Boolean)
                      .map((tid) => `任务 10-token-${tid}`);
                    appendLineToCard(
                      card,
                      tokenLines.length ? tokenLines.join('\n') : '（无 token）',
                      'task10_inference_sub',
                      { startFullyRevealed: true },
                    );
                    appendLineToCard(card, TASK10_DEBUG_FEATURE_KV_LINE, 'default', {
                      startFullyRevealed: true,
                    });
                    const featLines = tf.features.map((f) => formatTask10FeatureKvDebugLine(f));
                    appendLineToCard(
                      card,
                      featLines.length ? featLines.join('\n') : '（无 feature）',
                      'task10_inference_sub',
                      { startFullyRevealed: true },
                    );
                  }, rawId);
                  logicTreeGraphRefreshTick.value += 1;
                  await flushPersistDesignDetailProgressWorkspace(rawId);
                }
              }
              allowTask11Kickoff = await runTask10L5TvmGateAndMaybeAlignmentQuestionnaire(
                {
                  rawId,
                  epochAtStart,
                  withTask10DynamicsCard,
                  appendLineToCard,
                  flushPersistDesignDetailProgressWorkspace,
                  appendTask10L5AlignmentQuestionnaireFromConflict,
                  stashAlignmentPainTargetsForLineTask,
                  setDeferredAlignmentQuestionnaireJob,
                },
                l5DdlRaw,
                pipelineOpts,
              );
              if (exitTask10PipelineIfSessionStale(rawId, epochAtStart)) return;
            } else {
              const hint =
                syncRes && typeof syncRes.message === 'string' ? syncRes.message : '同步失败';
              logTask10ArchGate('pipeline_sync_res_fail', {
                caseId: rawId,
                hint,
                status: syncRes?.status,
              });
              withTask10DynamicsCard((card) => {
                appendLineToCard(card, `→ Target_KV 落库失败：${hint}`, 'default', {
                  startFullyRevealed: true,
                });
                if (syncRes && syncRes.status === 404) {
                  appendLineToCard(
                    card,
                    '→ 多为监听端口上的后端仍是旧构建（未注册 sync-task10 路由）。请在 backend 执行 npm run build 后重启本地后端，再对本线步「重启当前」重跑。',
                    'default',
                    { startFullyRevealed: true },
                  );
                }
              }, rawId);
            }
        } catch (eKv) {
          removeTask10SyncSpinnerLine(rawId);
          logTask10ArchGate('pipeline_sync_exception', {
            caseId: rawId,
            message: eKv instanceof Error ? eKv.message : String(eKv),
          });
          withTask10DynamicsCard((card) => {
            appendLineToCard(
              card,
              `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
              'default',
              { startFullyRevealed: true },
            );
          }, rawId);
        }
      } else {
        logTask10ArchGate('pipeline_sync_api_missing', { caseId: rawId });
      }
    } else if (!isOnlineMode() && l5DdlRaw) {
      allowTask10SyncOk = true;
      allowTask11Kickoff = true;
    }

    if (l5DdlRaw) {
      removeTask10LlmWorkingSpinnerLine(rawId);
      withTask10DynamicsCard((card) => {
        if (allowTask10SyncOk && allowTask11Kickoff) {
          card.status = 'completed';
          card.completedAtMs = Date.now();
          card.completionQueued = true;
        } else if (allowTask10SyncOk && !allowTask11Kickoff) {
          card.status = 'running';
          card.completedAtMs = null;
          card.completionQueued = false;
        } else {
          card.status = 'completed';
          card.completedAtMs = Date.now();
          appendLineToCard(
            card,
            '→ 任务 10 未收官（Target_KV 落库失败）；请修复后端后对本线步「重启当前」重跑',
            'default',
            { startFullyRevealed: true },
          );
        }
      }, rawId);
    }
    saveDesignDetailLineState(rawId, {
      schemaVersion: 1,
      currentTaskId: 'process_type_derivation',
      holdPastTask3: false,
      holdPastTask4: false,
      holdPastTask5: false,
      holdPastTask55: true,
      holdPastTask6: true,
      holdPastTask7: true,
      holdPastTask8: true,
      holdPastTask85: true,
      holdPastTask9: true,
      holdPastTask10: !!(allowTask10SyncOk && l5DdlRaw && allowTask11Kickoff),
    });
    if (mergedItem) {
      reconcileDesignDetailLineTaskId(
        rawId,
        mergedItem,
        lastHydratedMessages.value,
        task1CustomerRequirementPhase.value,
      );
    }
    const stT10 = loadDesignDetailLineState(rawId);
    if (stT10?.currentTaskId) setCurrentDesignLineTaskId(stT10.currentTaskId);
    const task10Done = !!(allowTask10SyncOk && l5DdlRaw && allowTask11Kickoff);
    logTask10ArchGate('pipeline_finale', {
      caseId: rawId,
      allowTask10SyncOk,
      allowTask11Kickoff,
      hasL5DdlRaw: !!l5DdlRaw,
      task10Done,
      hasOnTask10Done: typeof onTask10Done === 'function',
      currentTaskId: stT10?.currentTaskId,
      holdPastTask10: !!(allowTask10SyncOk && l5DdlRaw && allowTask11Kickoff),
      sessionStale: designDetailSessionGeneration !== epochAtStart,
    });
    if (task10Done && onTask10Done) {
      logTask10ArchGate('pipeline_onTask10Done_invoke', { caseId: rawId });
      await onTask10Done(rawId, epochAtStart, llmAbort, mergedItem);
    } else if (task10Done) {
      logTask10ArchGate('pipeline_skip_onTask10Done', {
        caseId: rawId,
        reason: 'missing_handler',
      });
    } else {
      logTask10ArchGate('pipeline_skip_onTask10Done', {
        caseId: rawId,
        reason: 'task10_not_done',
        allowTask10SyncOk,
        allowTask11Kickoff,
        hasL5DdlRaw: !!l5DdlRaw,
      });
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
  } catch (e) {
    if (exitTask10PipelineIfSessionStale(rawId, epochAtStart)) return;
    removeTask10LlmWorkingSpinnerLine(rawId);
    removeTask10SyncSpinnerLine(rawId);
    withTask10DynamicsCard((card) => {
      appendLineToCard(
        card,
        `→ 任务 10 推理失败：${e instanceof Error ? e.message : String(e)}`,
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }
}

function formatTask10FeatureKvDebugLine(f: Task2L1TaskGraphFeatureRow): string {
  const tok = String(f.tokenDisplay ?? '').trim();
  const op = String(f.operator ?? '').trim();
  const val = String(f.name ?? '').trim();
  const fid = String(f.featureId ?? '').trim();
  const head = tok.includes('·') ? (tok.split(/\s*·\s*/)[0]?.trim() ?? tok) : tok;
  const parts = [head, op, val, fid].filter(Boolean);
  return parts.length ? parts.join(' | ') : fid || '—';
}

function pickTask10TokensFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[]; tokens?: { tokenId: string; name: string }[] }>,
): { tokens: { tokenId: string; name: string }[]; features: Task2L1TaskGraphFeatureRow[] } {
  const t10 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return id === 'process_type_derivation' || id.includes('任务 10') || id.includes('物理建表');
  });
  return {
    tokens: Array.isArray(t10?.tokens) ? t10.tokens : [],
    features: Array.isArray(t10?.features) ? t10.features : [],
  };
}
