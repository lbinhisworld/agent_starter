/**
 * [INPUT]: 任务 5.1 流水线依赖（由 `useDesignDetailChat` 注入）
 * [OUTPUT]: `runTask51ValuePropositionPipeline` 执行 L3.1 战略价值主张推理与落库
 * [POS]: 任务 5 收官后、任务 5.5 之前；Input 1＝任务 1~4 特征
 *
 * [PROTOCOL]: 变更任务 5.1 进度文案/落库契约时同步 `useDesignDetailChat.ts` 与本文件
 */

import {
  buildTask51ValuePropositionInferenceUserBlock,
  truncateTask51L3DebugProgressText,
} from './buildTask51ValuePropositionInferenceInputFromTaskGraph';
import { DESIGN_DETAIL_LLM_CALL_TARGET_L51_VALUE_PROPOSITION } from './designDetailLlmStats';
import {
  buildForwardInductionLinkUiLinesTask51,
  buildTask51L3ConflictDatasetUserBlock,
  normalizeL51ValuePropositionRawForServerSync,
  normalizeLogicGraphTasksFromApiPayload,
  parseTask51L3TokenValidationMappingForAlignment,
  task2L1AllValidationRowsResolved,
  task2L1FilterPotentialConflictRows,
  type Task2L1TvmParsedRow,
} from './designDetailTask2L1SyncUiProgress';
import {
  buildTask51L3TargetKvSyncAlignmentMeta,
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
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { pickTask5MacroFeaturesFromGraphTasks } from './buildTask5L5VsmInferenceInputFromTaskGraph';
import { buildTask1PainPointConfirmedConsistencyMap } from './designDetailPainPointConfirmed';

type DynamicsLineKind =
  | 'default'
  | 'scope_green'
  | 'bmc_generating'
  | 'task51_inference_sub'
  | 'inference_conclusion_sub';

export type RunTask51PipelineDeps = Omit<
  RunTask9PipelineDeps,
  'exitTask9PipelineIfSessionStale' | 'withTask9L5DynamicsCard' | 'removeTask9L5LlmWorkingSpinnerLine' | 'removeTask9L5SyncSpinnerLine'
> & {
  exitTask51PipelineIfSessionStale: (rawId: string, epochAtStart: number) => boolean;
  withTask51L3DynamicsCard: (fn: (card: RunTask9PipelineDeps['cloneDynamics'] extends () => infer C ? C extends (infer U)[] ? U : never : never) => void, rawId: string) => void;
  removeTask51L3LlmWorkingSpinnerLine: (rawId: string) => void;
  removeTask51L3SyncSpinnerLine: (rawId: string) => void;
  /** 任务 5.1 落库成功且已有模型原文时，驱动右侧「现状理解」画布 */
  onTask51MatrixReady?: (l51Raw: string) => void;
  onTask51Done?: (
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    opts?: { deferDebugContinue?: boolean; deferAlignmentQuestionnaire?: boolean },
  ) => Promise<void>;
  pipelineOpts?: { deferAlignmentQuestionnaire?: boolean };
  readTask51L3DeepInsightText?: (caseId: string) => string;
  readTask51L3UserRectificationText?: (caseId: string) => string;
  appendTask51L3AlignmentQuestionnaireFromConflict?: (
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
    lineTaskId: 'value_proposition_capability_units';
    epochAtStart: number;
    conflictDatasetUserBlock: string;
    tier: 'task51';
  } | null) => void;
  pickTask1Task2FeaturesFromGraphTasks: (
    tasks: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
  ) => { task1Features: Task2L1TaskGraphFeatureRow[]; task2Features: Task2L1TaskGraphFeatureRow[] };
  pickTask3FeaturesFromGraphTasks: (
    tasks: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
  ) => Task2L1TaskGraphFeatureRow[];
  pickTask4FeaturesFromGraphTasks: (
    tasks: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
  ) => Task2L1TaskGraphFeatureRow[];
};

const TASK51_START_LINE = '→ 开始进行 L3.1 企业战略价值主张与部门级业务能力编排推理';
const TASK51_DEBUG_DONE_LINE = '【调试】【任务 5.1】→ 推理完成';
const TASK51_LOGIC_EXTRACT_LINE = '→ 进行任务 5.1 推理逻辑提取';
const TASK51_SYNC_LINE = '→ 正在写入任务 5.1 Target_KV 与逻辑链…';
const TASK51_SYNC_OK_LINE = '→ 任务 5.1 Target_KV 与逻辑链已写入服务端';
const TASK51_LLM_WORKING_LINE = '→ 正在进行 L3.1 战略价值主张推理（大模型，最长约 5 分钟）';

export async function runTask51ValuePropositionPipeline(deps: RunTask51PipelineDeps): Promise<void> {
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
    exitTask51PipelineIfSessionStale,
    withTask51L3DynamicsCard,
    removeTask51L3LlmWorkingSpinnerLine,
    removeTask51L3SyncSpinnerLine,
    waitUntilDynamicsFullyRevealed,
    onTask51MatrixReady,
    onTask51Done,
    pipelineOpts,
    readTask51L3DeepInsightText,
    readTask51L3UserRectificationText,
    appendTask51L3AlignmentQuestionnaireFromConflict,
    stashAlignmentPainTargetsForLineTask,
    setDeferredAlignmentQuestionnaireJob,
    pickTask1Task2FeaturesFromGraphTasks,
    pickTask3FeaturesFromGraphTasks,
    pickTask4FeaturesFromGraphTasks,
  } = deps;

  if (designDetailSessionGeneration !== epochAtStart) return;

  let cards = deps.cloneDynamics();
  if (!cards.find((c) => c.lineTaskId === 'value_proposition_capability_units')) {
    cards = [
      ...cards,
      {
        key: `value_proposition_capability_units-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineTaskId: 'value_proposition_capability_units',
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
    inferDesignDetailL51ValuePropositionFromContext?: (
      p: Record<string, unknown>,
      fetchOpts?: { signal?: AbortSignal },
    ) => Promise<{ rawOutput?: string; content?: string }>;
  };
  if (typeof w.inferDesignDetailL51ValuePropositionFromContext !== 'function') {
    withTask51L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 5.1 推理失败：未加载 inferDesignDetailL51ValuePropositionFromContext',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    return;
  }

  withTask51L3DynamicsCard((card) => {
    appendLineToCard(card, TASK51_START_LINE, 'scope_green', { startFullyRevealed: true });
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

  let task1Features: Task2L1TaskGraphFeatureRow[] = [];
  let task2Features: Task2L1TaskGraphFeatureRow[] = [];
  let task3Features: Task2L1TaskGraphFeatureRow[] = [];
  let task4Features: Task2L1TaskGraphFeatureRow[] = [];
  let task5Features: Task2L1TaskGraphFeatureRow[] = [];
  let mergedGraphForTask51: DesignDetailLogicGraphTaskDto[] | undefined;
  if (typeof getGraph === 'function') {
    try {
      const gr = await getGraph(rawId);
      if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
        const picked = pickTask1Task2FeaturesFromGraphTasks(gr.data.tasks);
        task1Features = picked.task1Features;
        task2Features = picked.task2Features;
        task3Features = pickTask3FeaturesFromGraphTasks(gr.data.tasks);
        task4Features = pickTask4FeaturesFromGraphTasks(gr.data.tasks);
        task5Features = pickTask5MacroFeaturesFromGraphTasks(gr.data.tasks);
        mergedGraphForTask51 = normalizeLogicGraphTasksFromApiPayload(
          gr.data.tasks as DesignDetailLogicGraphTaskDto[],
        );
      }
    } catch {
      /* 空图仍送模 */
    }
  }

  const upstreamForTask51 = mergedGraphForTask51?.length
    ? buildTask1PainPointConfirmedConsistencyMap(mergedGraphForTask51)
    : undefined;

  const task51InferenceUserBlock = buildTask51ValuePropositionInferenceUserBlock(
    task1Features,
    task2Features,
    task3Features,
    task4Features,
    task5Features,
    readTask51L3DeepInsightText?.(rawId),
    readTask51L3UserRectificationText?.(rawId),
    upstreamForTask51,
  );

  withTask51L3DynamicsCard((card) => {
    appendLineToCard(card, TASK51_LLM_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  let l51Raw = '';
  try {
    const res = await withLlmAuditCtx(
      {
        caseId: rawId,
        taskId: designLinePillLabel('value_proposition_capability_units'),
        callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_L51_VALUE_PROPOSITION,
      },
      () =>
        w.inferDesignDetailL51ValuePropositionFromContext!(
          { task51InferenceUserBlock },
          { signal: llmAbort.signal },
        ),
    );
    if (exitTask51PipelineIfSessionStale(rawId, epochAtStart)) return;

    removeTask51L3LlmWorkingSpinnerLine(rawId);
    l51Raw = String(res.rawOutput || res.content || '').trim();
    withTask51L3DynamicsCard((card) => {
      appendLineToCard(card, TASK51_DEBUG_DONE_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        card,
        truncateTask51L3DebugProgressText(l51Raw || '（模型无输出）'),
        'task51_inference_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(card, TASK51_LOGIC_EXTRACT_LINE, 'scope_green', { startFullyRevealed: true });
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    let allowSyncOk = false;
    if (isOnlineMode() && l51Raw) {
      const postT51 = (
        window as unknown as {
          SmartCto?: {
            problemCaseApi?: {
              postDesignDetailSyncTask51L3ValuePropositionTargetKvTokens?: (
                id: string,
                body: Record<string, unknown>,
              ) => Promise<{ ok?: boolean; message?: string; status?: number } | null>;
            };
          };
        }
      ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask51L3ValuePropositionTargetKvTokens;
      if (typeof postT51 === 'function') {
        try {
          const norm = normalizeL51ValuePropositionRawForServerSync(l51Raw);
          if (!norm.ok) {
            removeTask51L3SyncSpinnerLine(rawId);
            withTask51L3DynamicsCard((card) => {
              appendLineToCard(card, `→ Target_KV 落库失败：${norm.message}`, 'default', {
                startFullyRevealed: true,
              });
            }, rawId);
          } else {
            withTask51L3DynamicsCard((card) => {
              appendLineToCard(card, TASK51_SYNC_LINE, 'bmc_generating', {
                bmcGenUi: 'spinner',
                spinnerBlue: true,
                startFullyRevealed: true,
              });
            }, rawId);
            await flushPersistDesignDetailProgressWorkspace(rawId);
            let syncRes: { ok?: boolean; message?: string; status?: number } | null = null;
            try {
              syncRes = await postT51(
                rawId,
                mergeTargetKvSyncBodyWithAlignmentMeta(
                  { l3ProcessInferenceRaw: norm.normalized },
                  buildTask51L3TargetKvSyncAlignmentMeta(rawId),
                ),
              );
            } finally {
              removeTask51L3SyncSpinnerLine(rawId);
            }
            if (exitTask51PipelineIfSessionStale(rawId, epochAtStart)) return;
            if (syncRes?.ok === true) {
              allowSyncOk = true;
              await flushPersistDesignDetailProgressWorkspace(rawId);
              if (typeof getGraph === 'function') {
                const gr2 = await getGraph(rawId);
                if (gr2?.ok === true && gr2.data && Array.isArray(gr2.data.tasks)) {
                  const mergedForProgress = normalizeLogicGraphTasksFromApiPayload(
                    gr2.data.tasks as DesignDetailLogicGraphTaskDto[],
                  );
                  withTask51L3DynamicsCard((card) => {
                    appendLineToCard(card, TASK51_SYNC_OK_LINE, 'scope_green', { startFullyRevealed: true });
                  }, rawId);
                  await pushPipelineFeatureInferenceConclusions({
                    rawId,
                    lineTaskId: 'value_proposition_capability_units',
                    mergedForProgress,
                    readProgressLines: () => {
                      let snap: Array<{ kind: string; full: string; cursor?: number; inferenceFeatureId?: string }> =
                        [];
                      withTask51L3DynamicsCard((card) => {
                        snap = card.lines;
                      }, rawId);
                      return snap;
                    },
                    ensureOrganizeLine: () => {
                      withTask51L3DynamicsCard((card) => {
                        if (!hasFeatureInferenceConclusionOrganizeLine(card.lines)) {
                          appendLineToCard(card, INFERENCE_CONCLUSION_ORGANIZE_LINE, 'scope_green', {
                            startFullyRevealed: true,
                          });
                        }
                      }, rawId);
                    },
                    appendToCard: (text, kind, opts) =>
                      withTask51L3DynamicsCard((card) => {
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
                  withTask51L3DynamicsCard((card) => {
                    appendLineToCard(card, '→ 任务 5.1：开始提炼正向归纳链接', 'scope_green', {
                      startFullyRevealed: true,
                    });
                    for (const ln of buildForwardInductionLinkUiLinesTask51(mergedForProgress)) {
                      appendLineToCard(card, ln, 'bmc_result_quote', { startFullyRevealed: true });
                    }
                    appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
                  }, rawId);
                  logicTreeGraphRefreshTick.value += 1;
                  await flushPersistDesignDetailProgressWorkspace(rawId);
                } else {
                  withTask51L3DynamicsCard((card) => {
                    appendLineToCard(card, TASK51_SYNC_OK_LINE, 'scope_green', { startFullyRevealed: true });
                    appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
                  }, rawId);
                  logicTreeGraphRefreshTick.value += 1;
                }
              } else {
                withTask51L3DynamicsCard((card) => {
                  appendLineToCard(card, TASK51_SYNC_OK_LINE, 'scope_green', { startFullyRevealed: true });
                  appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
                }, rawId);
                logicTreeGraphRefreshTick.value += 1;
              }
            } else {
              const hint = syncRes && typeof syncRes.message === 'string' ? syncRes.message : '同步失败';
              withTask51L3DynamicsCard((card) => {
                appendLineToCard(card, `→ Target_KV 落库失败：${hint}`, 'default', { startFullyRevealed: true });
                if (syncRes && syncRes.status === 404) {
                  appendLineToCard(
                    card,
                    '→ 多为监听端口上的后端仍是旧构建（未注册 sync-task51 路由）。请在 backend 执行 npm run build 后重启本地后端，再对本线步「重启当前」重跑。',
                    'default',
                    { startFullyRevealed: true },
                  );
                }
              }, rawId);
            }
          }
        } catch (eKv) {
          removeTask51L3SyncSpinnerLine(rawId);
          withTask51L3DynamicsCard((card) => {
            appendLineToCard(
              card,
              `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
              'default',
              { startFullyRevealed: true },
            );
          }, rawId);
        }
      }
    } else if (!isOnlineMode() && l51Raw) {
      allowSyncOk = true;
    }

    let allowTask52Kickoff = false;
    if (allowSyncOk && l51Raw) {
      const raw = String(l51Raw || '').trim();
      const tvmRowsForAlign = parseTask51L3TokenValidationMappingForAlignment(raw);
      const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
      const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
      const conflictCount = conflictRows.length;
      withTask51L3DynamicsCard((card) => {
        appendLineToCard(
          card,
          `→ 反向验证校验｜Token_Validation_Mapping ${tvmRowsForAlign.length} 条｜${
            hasUnresolvedTvmConflict
              ? `存在 ${conflictCount} 处潜在冲突，需对齐确认后方可进入任务 5.2`
              : 'Consistency 均已消解，可进入任务 5.2'
          }`,
          'scope_green',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      if (!hasUnresolvedTvmConflict) {
        allowTask52Kickoff = true;
      } else if (conflictCount) {
        const conflictBlock = buildTask51L3ConflictDatasetUserBlock(conflictRows);
        stashAlignmentPainTargetsForLineTask?.(rawId, 'value_proposition_capability_units', conflictRows);
        if (pipelineOpts?.deferAlignmentQuestionnaire) {
          setDeferredAlignmentQuestionnaireJob?.({
            caseId: rawId,
            lineTaskId: 'value_proposition_capability_units',
            epochAtStart,
            conflictDatasetUserBlock: conflictBlock,
            tier: 'task51',
          });
        } else if (typeof appendTask51L3AlignmentQuestionnaireFromConflict === 'function') {
          await appendTask51L3AlignmentQuestionnaireFromConflict(rawId, epochAtStart, conflictBlock);
        }
      }
    }

    if (l51Raw) {
      removeTask51L3LlmWorkingSpinnerLine(rawId);
      withTask51L3DynamicsCard((card) => {
        if (allowSyncOk && allowTask52Kickoff) {
          card.status = 'completed';
          card.completedAtMs = Date.now();
          card.completionQueued = true;
        } else if (allowSyncOk && !allowTask52Kickoff) {
          card.status = 'running';
          card.completedAtMs = null;
          card.completionQueued = false;
        } else {
          card.status = 'completed';
          card.completedAtMs = Date.now();
          appendLineToCard(
            card,
            '→ 任务 5.1 未收官（Target_KV 落库失败）；请修复后端后对本线步「重启当前」重跑',
            'default',
            { startFullyRevealed: true },
          );
        }
      }, rawId);
    }

    if (allowSyncOk && l51Raw && typeof onTask51MatrixReady === 'function') {
      onTask51MatrixReady(String(l51Raw).trim());
    }

    const task51Done = !!(allowSyncOk && l51Raw && allowTask52Kickoff);
    saveDesignDetailLineState(rawId, {
      schemaVersion: 1,
      currentTaskId: task51Done ? 'capability_field_set_mapping' : 'value_proposition_capability_units',
      holdPastTask5: true,
      holdPastTask51: task51Done,
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
    if (task51Done && onTask51Done) {
      await onTask51Done(rawId, epochAtStart, llmAbort, mergedItem, pipelineOpts);
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
  } catch (e) {
    if (exitTask51PipelineIfSessionStale(rawId, epochAtStart)) return;
    removeTask51L3LlmWorkingSpinnerLine(rawId);
    removeTask51L3SyncSpinnerLine(rawId);
    withTask51L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        `→ 任务 5.1 推理失败：${e instanceof Error ? e.message : String(e)}`,
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }
}
