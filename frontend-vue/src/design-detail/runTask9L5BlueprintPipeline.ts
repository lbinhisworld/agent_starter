/**
 * [INPUT]: 任务 9 流水线依赖（由 `useDesignDetailChat` 注入）
 * [OUTPUT]: `runTask9L5BlueprintPipeline` 执行 L5 推理与落库
 * [POS]: 从 `useDesignDetailChat.ts` 拆出，保持主文件可维护
 *
 * [PROTOCOL]: 变更任务 9 进度文案/落库契约时同步 `useDesignDetailChat.ts` 与本文件
 */

import {
  buildTask9L5BlueprintInferenceUserBlock,
  pickTask0FeaturesFromGraphTasks,
  pickTask1Through4FeaturesFromGraphTasksForTask9,
  pickTask85PhysicalHookFeaturesFromGraphTasks,
  truncateTask9L5DebugProgressText,
} from './buildTask9L5BlueprintInferenceInputFromTaskGraph';
import { DESIGN_DETAIL_LLM_CALL_TARGET_L5_BLUEPRINT } from './designDetailLlmStats';
import {
  buildForwardInductionLinkUiLinesTask9,
  buildTask9L5ConflictDatasetUserBlock,
  normalizeL5BlueprintInferenceRawForServerSync,
  normalizeLogicGraphTasksFromApiPayload,
  parseTask9L5TokenValidationMappingForAlignment,
  task2L1AllValidationRowsResolved,
  task2L1FilterPotentialConflictRows,
  type Task2L1TvmParsedRow,
} from './designDetailTask2L1SyncUiProgress';
import {
  buildTask9L5TargetKvSyncAlignmentMeta,
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
type DynamicsCardModel = {
  key: string;
  lineTaskId: string;
  status: string;
  startedAtMs: number;
  completedAtMs: number | null;
  lines: Array<{ kind: string; full: string }>;
  extraTailConsumed: number;
  completionQueued: boolean;
  thanksAppended: boolean;
};

type DynamicsLineKind =
  | 'default'
  | 'scope_green'
  | 'bmc_generating'
  | 'task9_inference_sub'
  | 'bmc_result_quote'
  | 'user_quote'
  | 'inference_conclusion_sub';

export type RunTask9PipelineDeps = {
  designDetailSessionGeneration: number;
  epochAtStart: number;
  rawId: string;
  llmAbort: AbortController;
  mergedItem: Record<string, unknown> | null;
  isOnlineMode: () => boolean;
  cloneDynamics: () => DynamicsCardModel[];
  setDynamicsCards: (cards: DynamicsCardModel[]) => void;
  appendLineToCard: (
    card: DynamicsCardModel,
    text: string,
    kind: DynamicsLineKind,
    opts?: { startFullyRevealed?: boolean; bmcGenUi?: string; spinnerBlue?: boolean },
  ) => void;
  flushPersistDesignDetailProgressWorkspace: (caseId: string) => Promise<void>;
  readTask5L3UserRectificationText: (caseId: string) => string;
  withLlmAuditCtx: <T>(
    ctx: { caseId: string; taskId: string; callTarget: string },
    fn: () => Promise<T>,
  ) => Promise<T>;
  saveDesignDetailLineState: (
    caseId: string,
    state: {
      schemaVersion: number;
      currentTaskId: string;
      holdPastTask3?: boolean;
      holdPastTask4?: boolean;
      holdPastTask5?: boolean;
      holdPastTask55?: boolean;
      holdPastTask6?: boolean;
      holdPastTask7?: boolean;
      holdPastTask8?: boolean;
      holdPastTask85?: boolean;
      holdPastTask9?: boolean;
      holdPastTask10?: boolean;
    },
  ) => void;
  reconcileDesignDetailLineTaskId: (
    caseId: string,
    mergedItem: Record<string, unknown>,
    messages: Array<Record<string, unknown>>,
    phase: string,
  ) => void;
  loadDesignDetailLineState: (caseId: string) => { currentTaskId?: string } | null;
  setCurrentDesignLineTaskId: (id: string) => void;
  lastHydratedMessages: { value: Array<Record<string, unknown>> };
  task1CustomerRequirementPhase: { value: string };
  logicTreeGraphRefreshTick: { value: number };
  exitTask9PipelineIfSessionStale: (caseId: string, epoch: number) => boolean;
  withTask9L5DynamicsCard: (fn: (card: DynamicsCardModel) => void, caseId?: string) => void;
  removeTask9L5LlmWorkingSpinnerLine: (caseId?: string) => void;
  removeTask9L5SyncSpinnerLine: (caseId?: string) => void;
  /** 推理结论逐行 reveal 时：上一条写完后再追加下一条 */
  waitUntilDynamicsFullyRevealed: () => Promise<void>;
  onTask9Done?: (
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
  ) => Promise<void>;
  pipelineOpts?: { deferAlignmentQuestionnaire?: boolean };
  readTask9L5DeepInsightText?: (caseId: string) => string;
  readTask9L5UserRectificationText?: (caseId: string) => string;
  appendTask9L5AlignmentQuestionnaireFromConflict?: (
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
    lineTaskId: 'business_capability_positioning';
    epochAtStart: number;
    conflictDatasetUserBlock: string;
    tier: 'task9';
  } | null) => void;
};

const TASK9_BLUEPRINT_START_LINE = '→ 开始进行 L5 领域驱动逻辑容器与工具宿主定义推理';
const TASK9_DEBUG_INFERENCE_DONE_LINE = '→ 任务 9 推理完成';
const TASK9_LOGIC_EXTRACT_LINE = '→ 任务 9：开始提炼推理逻辑';
const TASK9_SYNC_TARGET_KV_LINE = '→ 正在进行 Target_KV 落库（任务 9）';
const TASK9_SYNC_TARGET_KV_OK_LINE = '→ 任务 9 Target_KV 与逻辑链已写入服务端';
const TASK9_DEBUG_TOKEN_KV_LINE = '→ 任务 9 token / feature 明细';
const TASK9_DEBUG_FEATURE_KV_LINE = '→ 任务 9 feature 明细';
const TASK9_L5_LLM_WORKING_LINE = '→ 正在进行 L5 领域容器与工具宿主推理（大模型，最长约 5 分钟）';

export async function runTask9L5BlueprintPipelineImpl(deps: RunTask9PipelineDeps): Promise<void> {
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
    readTask5L3UserRectificationText,
    withLlmAuditCtx,
    saveDesignDetailLineState,
    reconcileDesignDetailLineTaskId,
    loadDesignDetailLineState,
    setCurrentDesignLineTaskId,
    lastHydratedMessages,
    task1CustomerRequirementPhase,
    logicTreeGraphRefreshTick,
    exitTask9PipelineIfSessionStale,
    withTask9L5DynamicsCard,
    removeTask9L5LlmWorkingSpinnerLine,
    removeTask9L5SyncSpinnerLine,
    waitUntilDynamicsFullyRevealed,
    onTask9Done,
    pipelineOpts,
    readTask9L5DeepInsightText,
    readTask9L5UserRectificationText,
    appendTask9L5AlignmentQuestionnaireFromConflict,
    stashAlignmentPainTargetsForLineTask,
    setDeferredAlignmentQuestionnaireJob,
  } = deps;

  if (designDetailSessionGeneration !== epochAtStart) return;

  const w = window as unknown as {
    inferDesignDetailL5BlueprintFromContext?: (
      p: Record<string, unknown>,
      fetchOpts?: { signal?: AbortSignal },
    ) => Promise<{ rawOutput?: string; content?: string }>;
  };
  if (typeof w.inferDesignDetailL5BlueprintFromContext !== 'function') {
    const c9b = cloneDynamics().find((c) => c.lineTaskId === 'business_capability_positioning');
    if (c9b) {
      appendLineToCard(
        c9b,
        '→ 任务 9 推理失败：未加载 inferDesignDetailL5BlueprintFromContext（请确认已加载 designDetailL5BlueprintSystemPrompt.js）',
        'default',
        { startFullyRevealed: true },
      );
    }
    return;
  }

  let cards = cloneDynamics();
  let c9 = cards.find((c) => c.lineTaskId === 'business_capability_positioning');
  if (!c9) {
    c9 = {
      key: `business_capability_positioning-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lineTaskId: 'business_capability_positioning',
      status: 'running',
      startedAtMs: Date.now(),
      completedAtMs: null,
      lines: [],
      extraTailConsumed: 0,
      completionQueued: false,
      thanksAppended: false,
    };
    cards = [...cards, c9];
    setDynamicsCards(cards);
  }

  appendLineToCard(c9, TASK9_BLUEPRINT_START_LINE, 'scope_green', { startFullyRevealed: true });
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

  let task85HookFeatures: Task2L1TaskGraphFeatureRow[] = [];
  let tool0Features: Task2L1TaskGraphFeatureRow[] = [];
  let task1Through4Features: Task2L1TaskGraphFeatureRow[] = [];
  if (typeof getGraph === 'function') {
    try {
      const gr = await getGraph(rawId);
      if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
        task85HookFeatures = pickTask85PhysicalHookFeaturesFromGraphTasks(gr.data.tasks);
        tool0Features = pickTask0FeaturesFromGraphTasks(gr.data.tasks);
        task1Through4Features = pickTask1Through4FeaturesFromGraphTasksForTask9(gr.data.tasks);
      }
    } catch {
      /* 空图仍送模 */
    }
  }

  const task9InferenceUserBlock = buildTask9L5BlueprintInferenceUserBlock(
    task85HookFeatures,
    tool0Features,
    task1Through4Features,
    readTask9L5DeepInsightText?.(rawId),
    readTask9L5UserRectificationText?.(rawId),
  );

  let l5BlueprintRaw = '';
  withTask9L5DynamicsCard((card) => {
    appendLineToCard(card, TASK9_L5_LLM_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  try {
    const res = await withLlmAuditCtx(
      {
        caseId: rawId,
        taskId: designLinePillLabel('business_capability_positioning'),
        callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_L5_BLUEPRINT,
      },
      () =>
        w.inferDesignDetailL5BlueprintFromContext!(
          { task9InferenceUserBlock },
          { signal: llmAbort.signal },
        ),
    );
    if (exitTask9PipelineIfSessionStale(rawId, epochAtStart)) return;

    removeTask9L5LlmWorkingSpinnerLine(rawId);
    l5BlueprintRaw = String(res.rawOutput || res.content || '').trim();
    withTask9L5DynamicsCard((card) => {
      appendLineToCard(card, TASK9_DEBUG_INFERENCE_DONE_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        card,
        truncateTask9L5DebugProgressText(l5BlueprintRaw || '（模型无输出）'),
        'task9_inference_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(card, TASK9_LOGIC_EXTRACT_LINE, 'scope_green', { startFullyRevealed: true });
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    let allowTask9SyncOk = false;
    if (isOnlineMode() && l5BlueprintRaw) {
      const postT9 = (
        window as unknown as {
          SmartCto?: {
            problemCaseApi?: {
              postDesignDetailSyncTask9L5BlueprintTargetKvTokens?: (
                id: string,
                body: Record<string, unknown>,
              ) => Promise<{ ok?: boolean; message?: string; status?: number } | null>;
            };
          };
        }
      ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask9L5BlueprintTargetKvTokens;
      if (typeof postT9 === 'function') {
        try {
          const normT9 = normalizeL5BlueprintInferenceRawForServerSync(l5BlueprintRaw);
          if (!normT9.ok) {
            removeTask9L5SyncSpinnerLine(rawId);
            withTask9L5DynamicsCard((card) => {
              appendLineToCard(card, `→ Target_KV 落库失败：${normT9.message}`, 'default', {
                startFullyRevealed: true,
              });
            }, rawId);
          } else {
            withTask9L5DynamicsCard((card) => {
              appendLineToCard(card, TASK9_SYNC_TARGET_KV_LINE, 'bmc_generating', {
                bmcGenUi: 'spinner',
                spinnerBlue: true,
                startFullyRevealed: true,
              });
            }, rawId);
            await flushPersistDesignDetailProgressWorkspace(rawId);
            let syncRes: { ok?: boolean; message?: string; status?: number } | null = null;
            try {
              syncRes = await postT9(
                rawId,
                mergeTargetKvSyncBodyWithAlignmentMeta(
                  { l3ProcessInferenceRaw: normT9.normalized },
                  buildTask9L5TargetKvSyncAlignmentMeta(rawId),
                ),
              );
            } finally {
              removeTask9L5SyncSpinnerLine(rawId);
            }
            if (exitTask9PipelineIfSessionStale(rawId, epochAtStart)) return;
            if (syncRes?.ok === true) {
              allowTask9SyncOk = true;
              withTask9L5DynamicsCard((card) => {
                appendLineToCard(card, TASK9_SYNC_TARGET_KV_OK_LINE, 'scope_green', {
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
                  await pushPipelineFeatureInferenceConclusions({
                    rawId,
                    lineTaskId: 'business_capability_positioning',
                    mergedForProgress,
                    readProgressLines: () => {
                      let snap: DynamicsCardModel['lines'] = [];
                      withTask9L5DynamicsCard((card) => {
                        snap = card.lines;
                      }, rawId);
                      return snap;
                    },
                    ensureOrganizeLine: () => {
                      withTask9L5DynamicsCard((card) => {
                        if (!hasFeatureInferenceConclusionOrganizeLine(card.lines)) {
                          appendLineToCard(card, INFERENCE_CONCLUSION_ORGANIZE_LINE, 'scope_green', {
                            startFullyRevealed: true,
                          });
                        }
                      }, rawId);
                    },
                    appendToCard: (text, kind, opts) =>
                      withTask9L5DynamicsCard((card) => {
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
                  withTask9L5DynamicsCard((card) => {
                    appendLineToCard(card, '→ 任务 9：开始提炼正向归纳链接', 'scope_green', {
                      startFullyRevealed: true,
                    });
                    for (const ln of buildForwardInductionLinkUiLinesTask9(mergedForProgress)) {
                      appendLineToCard(card, ln, 'bmc_result_quote', { startFullyRevealed: true });
                    }
                    appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', {
                      startFullyRevealed: true,
                    });
                    const tf = pickTask9TokensFeaturesFromGraphTasks(gr2.data.tasks);
                    appendLineToCard(card, TASK9_DEBUG_TOKEN_KV_LINE, 'default', {
                      startFullyRevealed: true,
                    });
                    const tokenLines = tf.tokens
                      .map((row) => String(row.tokenId ?? '').trim())
                      .filter(Boolean)
                      .map((tid) => `任务 9-token-${tid}`);
                    appendLineToCard(
                      card,
                      tokenLines.length ? tokenLines.join('\n') : '（无 token）',
                      'task9_inference_sub',
                      { startFullyRevealed: true },
                    );
                    appendLineToCard(card, TASK9_DEBUG_FEATURE_KV_LINE, 'default', {
                      startFullyRevealed: true,
                    });
                    const featLines = tf.features.map((f) => formatTask9FeatureKvDebugLine(f));
                    appendLineToCard(
                      card,
                      featLines.length ? featLines.join('\n') : '（无 feature）',
                      'task9_inference_sub',
                      { startFullyRevealed: true },
                    );
                  }, rawId);
                  logicTreeGraphRefreshTick.value += 1;
                  await flushPersistDesignDetailProgressWorkspace(rawId);
                }
              }
            } else {
              const hint =
                syncRes && typeof syncRes.message === 'string' ? syncRes.message : '同步失败';
              withTask9L5DynamicsCard((card) => {
                appendLineToCard(card, `→ Target_KV 落库失败：${hint}`, 'default', {
                  startFullyRevealed: true,
                });
                if (syncRes && syncRes.status === 404) {
                  appendLineToCard(
                    card,
                    '→ 多为监听端口上的后端仍是旧构建（未注册 sync-task9 路由）。请在 backend 执行 npm run build 后重启本地后端，再对本线步「重启当前」重跑。',
                    'default',
                    { startFullyRevealed: true },
                  );
                }
              }, rawId);
            }
          }
        } catch (eKv) {
          removeTask9L5SyncSpinnerLine(rawId);
          withTask9L5DynamicsCard((card) => {
            appendLineToCard(
              card,
              `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
              'default',
              { startFullyRevealed: true },
            );
          }, rawId);
        }
      }
    } else if (!isOnlineMode() && l5BlueprintRaw) {
      allowTask9SyncOk = true;
    }

    let allowTask10Kickoff = false;
    if (allowTask9SyncOk && l5BlueprintRaw) {
      const raw = String(l5BlueprintRaw || '').trim();
      const tvmRowsForAlign = parseTask9L5TokenValidationMappingForAlignment(raw);
      const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
      const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
      const conflictCount = conflictRows.length;
      withTask9L5DynamicsCard((card) => {
        appendLineToCard(
          card,
          `→ 反向验证校验｜Token_Validation_Mapping ${tvmRowsForAlign.length} 条｜${
            hasUnresolvedTvmConflict
              ? `存在 ${conflictCount} 处潜在冲突，需对齐确认后方可进入任务 10`
              : 'Consistency 均已消解，可进入任务 10'
          }`,
          'scope_green',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      if (!hasUnresolvedTvmConflict) {
        allowTask10Kickoff = true;
      } else if (conflictCount) {
        const conflictBlock = buildTask9L5ConflictDatasetUserBlock(conflictRows);
        stashAlignmentPainTargetsForLineTask?.(rawId, 'business_capability_positioning', conflictRows);
        if (pipelineOpts?.deferAlignmentQuestionnaire) {
          setDeferredAlignmentQuestionnaireJob?.({
            caseId: rawId,
            lineTaskId: 'business_capability_positioning',
            epochAtStart,
            conflictDatasetUserBlock: conflictBlock,
            tier: 'task9',
          });
        } else if (typeof appendTask9L5AlignmentQuestionnaireFromConflict === 'function') {
          await appendTask9L5AlignmentQuestionnaireFromConflict(rawId, epochAtStart, conflictBlock);
        }
      }
    }

    if (l5BlueprintRaw) {
      removeTask9L5LlmWorkingSpinnerLine(rawId);
      withTask9L5DynamicsCard((card) => {
        if (allowTask9SyncOk && allowTask10Kickoff) {
          card.status = 'completed';
          card.completedAtMs = Date.now();
          card.completionQueued = true;
        } else if (allowTask9SyncOk && !allowTask10Kickoff) {
          card.status = 'running';
          card.completedAtMs = null;
          card.completionQueued = false;
        } else {
          card.status = 'completed';
          card.completedAtMs = Date.now();
          appendLineToCard(
            card,
            '→ 任务 9 未收官（Target_KV 落库失败）；请修复后端后对本线步「重启当前」重跑',
            'default',
            { startFullyRevealed: true },
          );
        }
      }, rawId);
    }
    const task9Done = !!(allowTask9SyncOk && l5BlueprintRaw && allowTask10Kickoff);
    saveDesignDetailLineState(rawId, {
      schemaVersion: 1,
      currentTaskId: task9Done ? 'process_type_derivation' : 'business_capability_positioning',
      holdPastTask3: false,
      holdPastTask4: false,
      holdPastTask5: false,
      holdPastTask55: true,
      holdPastTask6: true,
      holdPastTask7: true,
      holdPastTask8: true,
      holdPastTask85: true,
      holdPastTask9: task9Done,
      holdPastTask10: false,
    });
    if (mergedItem) {
      reconcileDesignDetailLineTaskId(
        rawId,
        mergedItem,
        lastHydratedMessages.value,
        task1CustomerRequirementPhase.value,
      );
    }
    const stT9 = loadDesignDetailLineState(rawId);
    if (stT9?.currentTaskId) setCurrentDesignLineTaskId(stT9.currentTaskId);
    if (task9Done && onTask9Done) {
      await onTask9Done(rawId, epochAtStart, llmAbort, mergedItem);
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
  } catch (e) {
    if (exitTask9PipelineIfSessionStale(rawId, epochAtStart)) return;
    removeTask9L5LlmWorkingSpinnerLine(rawId);
    removeTask9L5SyncSpinnerLine(rawId);
    withTask9L5DynamicsCard((card) => {
      appendLineToCard(
        card,
        `→ 任务 9 推理失败：${e instanceof Error ? e.message : String(e)}`,
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }
}

function formatTask9FeatureKvDebugLine(f: Task2L1TaskGraphFeatureRow): string {
  const tok = String(f.tokenDisplay ?? '').trim();
  const op = String(f.operator ?? '').trim();
  const val = String(f.name ?? '').trim();
  const fid = String(f.featureId ?? '').trim();
  const head = tok.includes('·') ? (tok.split(/\s*·\s*/)[0]?.trim() ?? tok) : tok;
  const parts = [head, op, val, fid].filter(Boolean);
  return parts.length ? parts.join(' | ') : fid || '—';
}

function pickTask9TokensFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[]; tokens?: { tokenId: string; name: string }[] }>,
): { tokens: { tokenId: string; name: string }[]; features: Task2L1TaskGraphFeatureRow[] } {
  const t9 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return id === 'business_capability_positioning' || id.includes('任务 9') || id.includes('系统菜单');
  });
  return {
    tokens: Array.isArray(t9?.tokens) ? t9.tokens : [],
    features: Array.isArray(t9?.features) ? t9.features : [],
  };
}
