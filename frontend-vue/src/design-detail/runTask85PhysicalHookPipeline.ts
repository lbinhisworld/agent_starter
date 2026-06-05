/**
 * [INPUT]: 任务 8.5 流水线依赖（由 `useDesignDetailChat` 注入）
 * [OUTPUT]: `runTask85PhysicalHookPipeline` 执行 L4.75 推理与落库
 * [POS]: 任务 8 收官后、任务 9 之前；对撞任务 7 协作节点 × 任务 0 工具原语
 *
 * [PROTOCOL]: 变更任务 8.5 进度文案/落库契约时同步 `useDesignDetailChat.ts` 与本文件
 */

import {
  buildTask85PhysicalHookInferenceUserBlock,
  pickTask0FeaturesFromGraphTasks,
  pickTask85Input1CollaborationHostFeatures,
  pickTask1Through4FeaturesFromGraphTasks,
  task0SyncedFeaturesToGraphRows,
  truncateTask85L475DebugProgressText,
} from './buildTask85PhysicalHookInferenceInputFromTaskGraph';
import {
  hydrateToolSuiteKnowledgeForDesign,
  syncToolSuitePrimitivesToDesignGraph,
} from './designDetailToolSuitePrimitiveSource';
import { DESIGN_DETAIL_LLM_CALL_TARGET_L475_PHYSICAL_HOOK } from './designDetailLlmStats';
import {
  buildForwardInductionLinkUiLinesTask85,
  buildTask85L475ConflictDatasetUserBlock,
  normalizeL475PhysicalHookInferenceRawForServerSync,
  normalizeLogicGraphTasksFromApiPayload,
  parseTask85L475TokenValidationMappingForAlignment,
  task2L1AllValidationRowsResolved,
  task2L1FilterPotentialConflictRows,
  type Task2L1TvmParsedRow,
} from './designDetailTask2L1SyncUiProgress';
import {
  buildTask85L475TargetKvSyncAlignmentMeta,
  mergeTargetKvSyncBodyWithAlignmentMeta,
} from './designDetailTargetKvSyncAlignmentMeta';
import type { DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import { designLinePillLabel } from './designModeTaskPipeline';
import {
  hasFeatureInferenceConclusionOrganizeLine,
  INFERENCE_CONCLUSION_ORGANIZE_LINE,
  pushPipelineFeatureInferenceConclusions,
} from './designDetailFeatureInferenceConclusionProgress';
import type { RunTask9PipelineDeps } from './runTask9L5BlueprintPipeline';

type DynamicsLineKind =
  | 'default'
  | 'scope_green'
  | 'bmc_generating'
  | 'task85_inference_sub'
  | 'inference_conclusion_sub';

export type RunTask85PipelineDeps = Omit<
  RunTask9PipelineDeps,
  'exitTask9PipelineIfSessionStale' | 'withTask9L5DynamicsCard' | 'removeTask9L5LlmWorkingSpinnerLine' | 'removeTask9L5SyncSpinnerLine'
> & {
  exitTask85PipelineIfSessionStale: (rawId: string, epochAtStart: number) => boolean;
  withTask85DynamicsCard: (fn: (card: RunTask9PipelineDeps['cloneDynamics'] extends () => infer C ? C extends (infer U)[] ? U : never : never) => void, rawId: string) => void;
  removeTask85LlmWorkingSpinnerLine: (rawId: string) => void;
  removeTask85SyncSpinnerLine: (rawId: string) => void;
  onTask85Done?: (rawId: string, epochAtStart: number, llmAbort: AbortController, mergedItem: Record<string, unknown> | null) => Promise<void>;
  pipelineOpts?: { deferAlignmentQuestionnaire?: boolean };
  readTask85L475DeepInsightText?: (caseId: string) => string;
  readTask85L475UserRectificationText?: (caseId: string) => string;
  appendTask85L475AlignmentQuestionnaireFromConflict?: (
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
    lineTaskId: 'physical_hook_integration_inference';
    epochAtStart: number;
    conflictDatasetUserBlock: string;
    tier: 'task85';
  } | null) => void;
};

const TASK85_START_LINE = '→ 开始进行 L4.7 技术栈组件与外挂 Hook 集成推理';
const TASK85_DEBUG_DONE_LINE = '→ 任务 8.5 推理完成';
const TASK85_LOGIC_EXTRACT_LINE = '→ 任务 8.5：开始提炼推理逻辑';
const TASK85_SYNC_LINE = '→ 正在进行 Target_KV 落库（任务 8.5）';
const TASK85_SYNC_OK_LINE = '→ 任务 8.5 Target_KV 与逻辑链已写入服务端';
const TASK85_LLM_WORKING_LINE = '→ 正在进行 L4.7 技术集成推理（大模型，最长约 5 分钟）';

export async function runTask85PhysicalHookPipeline(deps: RunTask85PipelineDeps): Promise<void> {
  const {
    designDetailSessionGeneration,
    epochAtStart,
    rawId,
    llmAbort,
    mergedItem,
    isOnlineMode,
    cloneDynamics,
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
    exitTask85PipelineIfSessionStale,
    withTask85DynamicsCard,
    removeTask85LlmWorkingSpinnerLine,
    removeTask85SyncSpinnerLine,
    waitUntilDynamicsFullyRevealed,
    onTask85Done,
    pipelineOpts,
    readTask85L475DeepInsightText,
    readTask85L475UserRectificationText,
    appendTask85L475AlignmentQuestionnaireFromConflict,
    stashAlignmentPainTargetsForLineTask,
    setDeferredAlignmentQuestionnaireJob,
  } = deps;

  if (designDetailSessionGeneration !== epochAtStart) return;

  let cards = deps.cloneDynamics();
  if (!cards.find((c) => c.lineTaskId === 'physical_hook_integration_inference')) {
    cards = [
      ...cards,
      {
        key: `physical_hook_integration_inference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineTaskId: 'physical_hook_integration_inference',
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
    inferDesignDetailL475PhysicalHookFromContext?: (
      p: Record<string, unknown>,
      fetchOpts?: { signal?: AbortSignal },
    ) => Promise<{ rawOutput?: string; content?: string }>;
  };
  if (typeof w.inferDesignDetailL475PhysicalHookFromContext !== 'function') {
    withTask85DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 8.5 推理失败：未加载 inferDesignDetailL475PhysicalHookFromContext',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    return;
  }

  withTask85DynamicsCard((card) => {
    appendLineToCard(card, TASK85_START_LINE, 'scope_green', { startFullyRevealed: true });
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

  let task85Input1Features: ReturnType<typeof pickTask85Input1CollaborationHostFeatures> = [];
  let task1Through4Features: ReturnType<typeof pickTask1Through4FeaturesFromGraphTasks> = [];
  if (typeof getGraph === 'function') {
    try {
      const gr = await getGraph(rawId);
      if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
        task85Input1Features = pickTask85Input1CollaborationHostFeatures(gr.data.tasks);
        task1Through4Features = pickTask1Through4FeaturesFromGraphTasks(gr.data.tasks);
      }
    } catch {
      /* 空图仍送模 */
    }
  }

  await hydrateToolSuiteKnowledgeForDesign();
  const task0SyncRes = await syncToolSuitePrimitivesToDesignGraph(rawId, isOnlineMode());
  if (task0SyncRes.primitiveCount > 0 && task0SyncRes.synced) {
    logicTreeGraphRefreshTick.value += 1;
  }

  let tool0Features: ReturnType<typeof pickTask0FeaturesFromGraphTasks> = [];
  if (task0SyncRes.features?.length) {
    tool0Features = task0SyncedFeaturesToGraphRows(task0SyncRes.features);
  } else if (typeof getGraph === 'function' && task0SyncRes.synced) {
    try {
      const gr0 = await getGraph(rawId);
      if (gr0?.ok === true && gr0.data && Array.isArray(gr0.data.tasks)) {
        tool0Features = pickTask0FeaturesFromGraphTasks(gr0.data.tasks);
      }
    } catch {
      /* 空 Input 2 仍送模，由模型/落库校验兜底 */
    }
  }

  const task85InferenceUserBlock = buildTask85PhysicalHookInferenceUserBlock(
    task85Input1Features,
    tool0Features,
    task1Through4Features,
    readTask85L475DeepInsightText?.(rawId),
    readTask85L475UserRectificationText?.(rawId),
  );

  withTask85DynamicsCard((card) => {
    appendLineToCard(card, TASK85_LLM_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  let l475Raw = '';
  try {
    const res = await withLlmAuditCtx(
      {
        caseId: rawId,
        taskId: designLinePillLabel('physical_hook_integration_inference'),
        callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_L475_PHYSICAL_HOOK,
      },
      () =>
        w.inferDesignDetailL475PhysicalHookFromContext!(
          { task85InferenceUserBlock },
          { signal: llmAbort.signal },
        ),
    );
    if (exitTask85PipelineIfSessionStale(rawId, epochAtStart)) return;

    removeTask85LlmWorkingSpinnerLine(rawId);
    l475Raw = String(res.rawOutput || res.content || '').trim();
    withTask85DynamicsCard((card) => {
      appendLineToCard(card, TASK85_DEBUG_DONE_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        card,
        truncateTask85L475DebugProgressText(l475Raw || '（模型无输出）'),
        'task85_inference_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(card, TASK85_LOGIC_EXTRACT_LINE, 'scope_green', { startFullyRevealed: true });
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    let allowSyncOk = false;
    if (isOnlineMode() && l475Raw) {
      const postT85 = (
        window as unknown as {
          SmartCto?: {
            problemCaseApi?: {
              postDesignDetailSyncTask85L475PhysicalHookTargetKvTokens?: (
                id: string,
                body: Record<string, unknown>,
              ) => Promise<{ ok?: boolean; message?: string; status?: number } | null>;
            };
          };
        }
      ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask85L475PhysicalHookTargetKvTokens;
      if (typeof postT85 === 'function') {
        try {
          const norm = normalizeL475PhysicalHookInferenceRawForServerSync(l475Raw);
          if (!norm.ok) {
            removeTask85SyncSpinnerLine(rawId);
            withTask85DynamicsCard((card) => {
              appendLineToCard(card, `→ Target_KV 落库失败：${norm.message}`, 'default', {
                startFullyRevealed: true,
              });
            }, rawId);
          } else {
            withTask85DynamicsCard((card) => {
              appendLineToCard(card, TASK85_SYNC_LINE, 'bmc_generating', {
                bmcGenUi: 'spinner',
                spinnerBlue: true,
                startFullyRevealed: true,
              });
            }, rawId);
            await flushPersistDesignDetailProgressWorkspace(rawId);
            let syncRes: { ok?: boolean; message?: string; status?: number } | null = null;
            try {
              syncRes = await postT85(
                rawId,
                mergeTargetKvSyncBodyWithAlignmentMeta(
                  { l3ProcessInferenceRaw: norm.normalized },
                  buildTask85L475TargetKvSyncAlignmentMeta(rawId),
                ),
              );
            } finally {
              removeTask85SyncSpinnerLine(rawId);
            }
            if (exitTask85PipelineIfSessionStale(rawId, epochAtStart)) return;
            if (syncRes?.ok === true) {
              allowSyncOk = true;
              await flushPersistDesignDetailProgressWorkspace(rawId);
              if (typeof getGraph === 'function') {
                const gr2 = await getGraph(rawId);
                if (gr2?.ok === true && gr2.data && Array.isArray(gr2.data.tasks)) {
                  const mergedForProgress = normalizeLogicGraphTasksFromApiPayload(
                    gr2.data.tasks as DesignDetailLogicGraphTaskDto[],
                  );
                  withTask85DynamicsCard((card) => {
                    appendLineToCard(card, TASK85_SYNC_OK_LINE, 'scope_green', { startFullyRevealed: true });
                  }, rawId);
                  await pushPipelineFeatureInferenceConclusions({
                    rawId,
                    lineTaskId: 'physical_hook_integration_inference',
                    mergedForProgress,
                    readProgressLines: () => {
                      let snap: Array<{ kind: string; full: string; cursor?: number; inferenceFeatureId?: string }> =
                        [];
                      withTask85DynamicsCard((card) => {
                        snap = card.lines;
                      }, rawId);
                      return snap;
                    },
                    ensureOrganizeLine: () => {
                      withTask85DynamicsCard((card) => {
                        if (!hasFeatureInferenceConclusionOrganizeLine(card.lines)) {
                          appendLineToCard(card, INFERENCE_CONCLUSION_ORGANIZE_LINE, 'scope_green', {
                            startFullyRevealed: true,
                          });
                        }
                      }, rawId);
                    },
                    appendToCard: (text, kind, opts) =>
                      withTask85DynamicsCard((card) => {
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
                  withTask85DynamicsCard((card) => {
                    appendLineToCard(card, '→ 任务 8.5：开始提炼正向归纳链接', 'scope_green', {
                      startFullyRevealed: true,
                    });
                    for (const ln of buildForwardInductionLinkUiLinesTask85(mergedForProgress)) {
                      appendLineToCard(card, ln, 'bmc_result_quote', { startFullyRevealed: true });
                    }
                    appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
                  }, rawId);
                  logicTreeGraphRefreshTick.value += 1;
                  await flushPersistDesignDetailProgressWorkspace(rawId);
                } else {
                  withTask85DynamicsCard((card) => {
                    appendLineToCard(card, TASK85_SYNC_OK_LINE, 'scope_green', { startFullyRevealed: true });
                    appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
                  }, rawId);
                  logicTreeGraphRefreshTick.value += 1;
                }
              } else {
                withTask85DynamicsCard((card) => {
                  appendLineToCard(card, TASK85_SYNC_OK_LINE, 'scope_green', { startFullyRevealed: true });
                  appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
                }, rawId);
                logicTreeGraphRefreshTick.value += 1;
              }
            } else {
              const hint = syncRes && typeof syncRes.message === 'string' ? syncRes.message : '同步失败';
              withTask85DynamicsCard((card) => {
                appendLineToCard(card, `→ Target_KV 落库失败：${hint}`, 'default', { startFullyRevealed: true });
                if (syncRes && syncRes.status === 404) {
                  appendLineToCard(
                    card,
                    '→ 多为监听端口上的后端仍是旧构建（未注册 sync-task85 路由）。请在 backend 执行 npm run build 后重启本地后端，再对本线步「重启当前」重跑。',
                    'default',
                    { startFullyRevealed: true },
                  );
                }
              }, rawId);
            }
          }
        } catch (eKv) {
          removeTask85SyncSpinnerLine(rawId);
          withTask85DynamicsCard((card) => {
            appendLineToCard(
              card,
              `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
              'default',
              { startFullyRevealed: true },
            );
          }, rawId);
        }
      }
    } else if (!isOnlineMode() && l475Raw) {
      allowSyncOk = true;
    }

    let allowTask9Kickoff = false;
    if (allowSyncOk && l475Raw) {
      const raw = String(l475Raw || '').trim();
      const tvmRowsForAlign = parseTask85L475TokenValidationMappingForAlignment(raw);
      const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
      const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
      const conflictCount = conflictRows.length;
      withTask85DynamicsCard((card) => {
        appendLineToCard(
          card,
          `→ 反向验证校验｜Token_Validation_Mapping ${tvmRowsForAlign.length} 条｜${
            hasUnresolvedTvmConflict
              ? `存在 ${conflictCount} 处潜在冲突，需对齐确认后方可进入任务 9`
              : 'Consistency 均已消解，可进入任务 9'
          }`,
          'scope_green',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      if (!hasUnresolvedTvmConflict) {
        allowTask9Kickoff = true;
      } else if (conflictCount) {
        const conflictBlock = buildTask85L475ConflictDatasetUserBlock(conflictRows);
        stashAlignmentPainTargetsForLineTask?.(rawId, 'physical_hook_integration_inference', conflictRows);
        if (pipelineOpts?.deferAlignmentQuestionnaire) {
          setDeferredAlignmentQuestionnaireJob?.({
            caseId: rawId,
            lineTaskId: 'physical_hook_integration_inference',
            epochAtStart,
            conflictDatasetUserBlock: conflictBlock,
            tier: 'task85',
          });
        } else if (typeof appendTask85L475AlignmentQuestionnaireFromConflict === 'function') {
          await appendTask85L475AlignmentQuestionnaireFromConflict(rawId, epochAtStart, conflictBlock);
        }
      }
    }

    if (l475Raw) {
      removeTask85LlmWorkingSpinnerLine(rawId);
      withTask85DynamicsCard((card) => {
        if (allowSyncOk && allowTask9Kickoff) {
          card.status = 'completed';
          card.completedAtMs = Date.now();
          card.completionQueued = true;
        } else if (allowSyncOk && !allowTask9Kickoff) {
          card.status = 'running';
          card.completedAtMs = null;
          card.completionQueued = false;
        } else {
          card.status = 'completed';
          card.completedAtMs = Date.now();
          appendLineToCard(
            card,
            '→ 任务 8.5 未收官（Target_KV 落库失败）；请修复后端后对本线步「重启当前」重跑',
            'default',
            { startFullyRevealed: true },
          );
        }
      }, rawId);
    }

    const task85Done = !!(allowSyncOk && l475Raw && allowTask9Kickoff);
    saveDesignDetailLineState(rawId, {
      schemaVersion: 1,
      currentTaskId: task85Done ? 'business_capability_positioning' : 'physical_hook_integration_inference',
      holdPastTask3: false,
      holdPastTask4: false,
      holdPastTask5: false,
      holdPastTask55: true,
      holdPastTask6: true,
      holdPastTask7: true,
      holdPastTask8: true,
      holdPastTask85: task85Done,
      holdPastTask9: false,
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
    if (task85Done && onTask85Done) {
      await onTask85Done(rawId, epochAtStart, llmAbort, mergedItem);
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
  } catch (e) {
    if (exitTask85PipelineIfSessionStale(rawId, epochAtStart)) return;
    removeTask85LlmWorkingSpinnerLine(rawId);
    removeTask85SyncSpinnerLine(rawId);
    withTask85DynamicsCard((card) => {
      appendLineToCard(
        card,
        `→ 任务 8.5 推理失败：${e instanceof Error ? e.message : String(e)}`,
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }
}
