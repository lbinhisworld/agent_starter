/**
 * [INPUT]: 任务 5.2 流水线依赖（由 `useDesignDetailChat` 注入）
 * [OUTPUT]: `runTask52AssetFieldSetPipeline` — 按任务 1 每张现有表格循环 LLM → 合并落库
 * [POS]: 任务 5.1 收官后、任务 5.3 之前；落库成功刷新「现状理解」字段集子卡
 *
 * [PROTOCOL]: 每张表独立审计；调试模式子进度见 `designDetailTask52TableDebugProgress.ts`；变更时同步 `useDesignDetailChat.ts`
 */

import {
  buildTask52SingleTableInferenceUserBlock,
  buildTask52SpreadsheetTableSubtaskList,
  expandTask1ExistingSpreadsheetFeaturesForTask52Inference,
  pickTask1ExistingSpreadsheetFeatures,
  pickTask51FeaturesFromGraphTasks,
  task52TableUnderstandingProgressLine,
  truncateTask52L3DebugProgressText,
  type Task52SpreadsheetTableSubtask,
} from './buildTask52AssetFieldSetInferenceInputFromTaskGraph';
import {
  isTask52TableProgressLineForTable,
  TASK52_PROGRESS_START_LINE,
} from './designDetailTask52ProgressLineMigrate';
import {
  buildTask52TableFieldUnderstandingCallTarget,
  DESIGN_DETAIL_TASK52_LLM_AUDIT_TASK_ID,
} from './designDetailLlmStats';
import {
  mergeL52AssetMappingRawOutputsForServerSync,
  normalizeLogicGraphTasksFromApiPayload,
  parseTask52L3TokenValidationMappingForAlignment,
  task2L1AllValidationRowsResolved,
  task2L1FilterPotentialConflictRows,
  type Task2L1TvmParsedRow,
} from './designDetailTask2L1SyncUiProgress';
import {
  buildTask52L3TargetKvSyncAlignmentMeta,
  mergeTargetKvSyncBodyWithAlignmentMeta,
} from './designDetailTargetKvSyncAlignmentMeta';
import type { DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import {
  hasFeatureInferenceConclusionOrganizeLine,
  INFERENCE_CONCLUSION_ORGANIZE_LINE,
  pushPipelineFeatureInferenceConclusions,
} from './designDetailFeatureInferenceConclusionProgress';
import { isDesignDetailDebugExperienceActive } from './designDetailExperienceMode';
import type { RunTask9PipelineDeps } from './runTask9L5BlueprintPipeline';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';

type DynamicsLineKind =
  | 'default'
  | 'scope_green'
  | 'bmc_generating'
  | 'task52_inference_sub'
  | 'inference_conclusion_sub';

export type RunTask52PipelineDeps = Omit<
  RunTask9PipelineDeps,
  'exitTask9PipelineIfSessionStale' | 'withTask9L5DynamicsCard' | 'removeTask9L5LlmWorkingSpinnerLine' | 'removeTask9L5SyncSpinnerLine'
> & {
  exitTask52PipelineIfSessionStale: (rawId: string, epochAtStart: number) => boolean;
  withTask52L3DynamicsCard: (fn: (card: RunTask9PipelineDeps['cloneDynamics'] extends () => infer C ? C extends (infer U)[] ? U : never : never) => void, rawId: string) => void;
  removeTask52L3LlmWorkingSpinnerLine: (rawId: string) => void;
  removeTask52L3SyncSpinnerLine: (rawId: string) => void;
  onTask52CurrentStateCanvasRefresh?: (rawId: string) => void | Promise<void>;
  onTask52Done?: (
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
  /** 调试模式：在表子任务行下插入 JSON 灰块与字段集提炼子进度 */
  pushTask52TableDebugProgressSerial?: (
    rawId: string,
    tableName: string,
    tableRaw: string,
  ) => Promise<void>;
};

const TASK52_START_LINE = TASK52_PROGRESS_START_LINE;
const TASK52_DEBUG_DONE_LINE = '【调试】【任务 5.2】→ 全部表格理解完成';
const TASK52_LOGIC_EXTRACT_LINE = '→ 进行任务 5.2 推理逻辑提取与合并落库';
const TASK52_SYNC_LINE = '→ 正在写入任务 5.2 Target_KV 与逻辑链…';
const TASK52_SYNC_OK_LINE = '→ 任务 5.2 Target_KV 与逻辑链已写入服务端';

type Task52TableProgressLineRow = {
  full: string;
  bmcGenUi?: 'spinner' | 'check';
  spinnerBlue?: boolean;
};

function touchTask52TableProgressLine(
  card: { lines: Task52TableProgressLineRow[] },
  tableName: string,
  patch: Partial<Pick<Task52TableProgressLineRow, 'bmcGenUi' | 'spinnerBlue' | 'full'>>,
): void {
  for (const row of card.lines) {
    if (!isTask52TableProgressLineForTable(row.full, tableName)) continue;
    if (patch.full != null) row.full = patch.full;
    if (patch.bmcGenUi !== undefined) row.bmcGenUi = patch.bmcGenUi;
    if (patch.spinnerBlue !== undefined) row.spinnerBlue = patch.spinnerBlue;
  }
}

function markTask52TableSubtaskLineInProgress(
  card: { lines: Task52TableProgressLineRow[] },
  tableName: string,
): void {
  touchTask52TableProgressLine(card, tableName, {
    full: task52TableUnderstandingProgressLine(tableName),
    bmcGenUi: 'spinner',
    spinnerBlue: true,
  });
}

function markTask52TableSubtaskLineDone(
  card: { lines: Task52TableProgressLineRow[] },
  tableName: string,
): void {
  touchTask52TableProgressLine(card, tableName, {
    full: task52TableUnderstandingProgressLine(tableName),
    bmcGenUi: 'check',
    spinnerBlue: undefined,
  });
}

export async function runTask52AssetFieldSetPipeline(deps: RunTask52PipelineDeps): Promise<void> {
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
    exitTask52PipelineIfSessionStale,
    withTask52L3DynamicsCard,
    removeTask52L3LlmWorkingSpinnerLine,
    removeTask52L3SyncSpinnerLine,
    waitUntilDynamicsFullyRevealed,
    onTask52Done,
    onTask52CurrentStateCanvasRefresh,
    pipelineOpts,
    stashAlignmentPainTargetsForLineTask,
    pickTask1Task2FeaturesFromGraphTasks: pickTask12,
    pushTask52TableDebugProgressSerial,
  } = deps;

  if (designDetailSessionGeneration !== epochAtStart) return;

  let cards = deps.cloneDynamics();
  const hasTask52Card = cards.some((c) => c.lineTaskId === 'capability_field_set_mapping');
  if (!hasTask52Card) {
    cards = [
      ...cards,
      {
        key: `capability_field_set_mapping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineTaskId: 'capability_field_set_mapping',
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
    inferDesignDetailL52AssetFieldSetFromContext?: (
      p: Record<string, unknown>,
      fetchOpts?: { signal?: AbortSignal },
    ) => Promise<{ rawOutput?: string; content?: string }>;
  };
  if (typeof w.inferDesignDetailL52AssetFieldSetFromContext !== 'function') {
    withTask52L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 5.2 推理失败：未加载 inferDesignDetailL52AssetFieldSetFromContext',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    return;
  }

  withTask52L3DynamicsCard((card) => {
    appendLineToCard(card, TASK52_START_LINE, 'scope_green', { startFullyRevealed: true });
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
  let tableSubtasks: Task52SpreadsheetTableSubtask[] = [];
  if (typeof getGraph === 'function') {
    try {
      const gr = await getGraph(rawId);
      if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
        task51Features = pickTask51FeaturesFromGraphTasks(gr.data.tasks);
        const picked = pickTask12(gr.data.tasks);
        const expanded = expandTask1ExistingSpreadsheetFeaturesForTask52Inference(
          pickTask1ExistingSpreadsheetFeatures(picked.task1Features),
        );
        tableSubtasks = buildTask52SpreadsheetTableSubtaskList(expanded);
      }
    } catch {
      /* 空图仍送模 */
    }
  }

  if (!task51Features.length) {
    withTask52L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 5.2 推理已跳过：推理图任务 5.1 卡内未解析到「业务能力单元」特征行（请确认 5.1 已落库；若 Tree 已有能力节点仍报错，请硬刷新后重试或重启后端）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  if (!tableSubtasks.length) {
    withTask52L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 5.2 推理已跳过：任务 1 推理图中未扫描到「现有表格/」节点（请确认需求提炼已同步现有表格化石）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  withTask52L3DynamicsCard((card) => {
    appendLineToCard(
      card,
      `→ 扫描任务 1 现有表格，共 ${tableSubtasks.length} 张表待理解`,
      'scope_green',
      { startFullyRevealed: true },
    );
    for (const sub of tableSubtasks) {
      appendLineToCard(card, task52TableUnderstandingProgressLine(sub.tableName), 'default', {
        startFullyRevealed: true,
      });
    }
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  const perTableRawOutputs: string[] = [];

  for (let ti = 0; ti < tableSubtasks.length; ti++) {
    const sub = tableSubtasks[ti]!;
    withTask52L3DynamicsCard((card) => {
      markTask52TableSubtaskLineInProgress(card, sub.tableName);
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    const userBlock = buildTask52SingleTableInferenceUserBlock(task51Features, sub);
    let tableRaw = '';
    try {
      const res = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: DESIGN_DETAIL_TASK52_LLM_AUDIT_TASK_ID,
          callTarget: buildTask52TableFieldUnderstandingCallTarget(sub.tableName),
        },
        () =>
          w.inferDesignDetailL52AssetFieldSetFromContext!(
            { task52InferenceUserBlock: userBlock },
            { signal: llmAbort.signal },
          ),
      );
      if (exitTask52PipelineIfSessionStale(rawId, epochAtStart)) return;
      tableRaw = String(res.rawOutput || res.content || '').trim();
      if (!tableRaw) {
        throw new Error(`表「${sub.tableName}」模型无输出`);
      }
      perTableRawOutputs.push(tableRaw);
      if (pushTask52TableDebugProgressSerial) {
        await pushTask52TableDebugProgressSerial(rawId, sub.tableName, tableRaw);
        if (exitTask52PipelineIfSessionStale(rawId, epochAtStart)) return;
      }
      withTask52L3DynamicsCard((card) => {
        markTask52TableSubtaskLineDone(card, sub.tableName);
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
    } catch (e) {
      if (exitTask52PipelineIfSessionStale(rawId, epochAtStart)) return;
      removeTask52L3LlmWorkingSpinnerLine(rawId);
      withTask52L3DynamicsCard((card) => {
        appendLineToCard(
          card,
          `→ 表「${sub.tableName}」字段功能理解失败：${e instanceof Error ? e.message : String(e)}`,
          'default',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return;
    }
  }

  removeTask52L3LlmWorkingSpinnerLine(rawId);

  const mergeNorm = mergeL52AssetMappingRawOutputsForServerSync(perTableRawOutputs);
  const l52Raw = mergeNorm.ok ? mergeNorm.normalized : '';

  withTask52L3DynamicsCard((card) => {
    appendLineToCard(card, TASK52_DEBUG_DONE_LINE, 'default', { startFullyRevealed: true });
    if (perTableRawOutputs.length === 1 && !isDesignDetailDebugExperienceActive()) {
      appendLineToCard(
        card,
        truncateTask52L3DebugProgressText(perTableRawOutputs[0] ?? '（无）'),
        'task52_inference_sub',
        { startFullyRevealed: true },
      );
    } else if (perTableRawOutputs.length > 1) {
      appendLineToCard(
        card,
        `→ 已合并 ${perTableRawOutputs.length} 张表的 L3_Asset_Mapping_Matrix（见落库结果）`,
        'default',
        { startFullyRevealed: true },
      );
    }
    appendLineToCard(card, TASK52_LOGIC_EXTRACT_LINE, 'scope_green', { startFullyRevealed: true });
  }, rawId);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  if (!mergeNorm.ok) {
    withTask52L3DynamicsCard((card) => {
      appendLineToCard(card, `→ 多表合并失败：${mergeNorm.message}`, 'default', { startFullyRevealed: true });
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  let allowSyncOk = false;
  if (isOnlineMode() && l52Raw) {
    const postT52 = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            postDesignDetailSyncTask52L3AssetFieldSetTargetKvTokens?: (
              id: string,
              body: Record<string, unknown>,
            ) => Promise<{ ok?: boolean; message?: string; status?: number } | null>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask52L3AssetFieldSetTargetKvTokens;
    if (typeof postT52 === 'function') {
      try {
        withTask52L3DynamicsCard((card) => {
          appendLineToCard(card, TASK52_SYNC_LINE, 'bmc_generating', {
            bmcGenUi: 'spinner',
            spinnerBlue: true,
            startFullyRevealed: true,
          });
        }, rawId);
        await flushPersistDesignDetailProgressWorkspace(rawId);
        let syncRes: { ok?: boolean; message?: string; status?: number } | null = null;
        try {
          syncRes = await postT52(
            rawId,
            mergeTargetKvSyncBodyWithAlignmentMeta(
              { l3ProcessInferenceRaw: l52Raw },
              buildTask52L3TargetKvSyncAlignmentMeta(rawId),
            ),
          );
        } finally {
          removeTask52L3SyncSpinnerLine(rawId);
        }
        if (exitTask52PipelineIfSessionStale(rawId, epochAtStart)) return;
        if (syncRes?.ok === true) {
          allowSyncOk = true;
          withTask52L3DynamicsCard((card) => {
            appendLineToCard(card, TASK52_SYNC_OK_LINE, 'scope_green', { startFullyRevealed: true });
            appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
          }, rawId);
          logicTreeGraphRefreshTick.value += 1;
          await onTask52CurrentStateCanvasRefresh?.(rawId);
          if (typeof getGraph === 'function') {
            const gr2 = await getGraph(rawId);
            if (gr2?.ok === true && gr2.data && Array.isArray(gr2.data.tasks)) {
              const mergedForProgress = normalizeLogicGraphTasksFromApiPayload(
                gr2.data.tasks as DesignDetailLogicGraphTaskDto[],
              );
              await pushPipelineFeatureInferenceConclusions({
                rawId,
                lineTaskId: 'capability_field_set_mapping',
                mergedForProgress,
                readProgressLines: () => {
                  let snap: Array<{ kind: string; full: string; cursor?: number; inferenceFeatureId?: string }> =
                    [];
                  withTask52L3DynamicsCard((card) => {
                    snap = card.lines;
                  }, rawId);
                  return snap;
                },
                ensureOrganizeLine: () => {
                  withTask52L3DynamicsCard((card) => {
                    if (!hasFeatureInferenceConclusionOrganizeLine(card.lines)) {
                      appendLineToCard(card, INFERENCE_CONCLUSION_ORGANIZE_LINE, 'scope_green', {
                        startFullyRevealed: true,
                      });
                    }
                  }, rawId);
                },
                appendToCard: (text, kind, opts) =>
                  withTask52L3DynamicsCard((card) => {
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
          withTask52L3DynamicsCard((card) => {
            appendLineToCard(card, `→ Target_KV 落库失败：${hint}`, 'default', { startFullyRevealed: true });
            if (syncRes && syncRes.status === 404) {
              appendLineToCard(
                card,
                '→ 多为监听端口上的后端仍是旧构建（未注册 sync-task52 路由）。请在 backend 执行 npm run build 后重启本地后端，再对本线步「重启当前」重跑。',
                'default',
                { startFullyRevealed: true },
              );
            }
          }, rawId);
        }
      } catch (eKv) {
        removeTask52L3SyncSpinnerLine(rawId);
        withTask52L3DynamicsCard((card) => {
          appendLineToCard(
            card,
            `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
            'default',
            { startFullyRevealed: true },
          );
        }, rawId);
      }
    }
  } else if (!isOnlineMode() && l52Raw) {
    allowSyncOk = true;
  }

  let allowTask53Kickoff = false;
  if (allowSyncOk && l52Raw) {
    const tvmRowsForAlign = parseTask52L3TokenValidationMappingForAlignment(l52Raw);
    const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
    const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
    const conflictCount = conflictRows.length;
    withTask52L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        `→ 反向验证校验｜Token_Validation_Mapping ${tvmRowsForAlign.length} 条｜${
          hasUnresolvedTvmConflict
            ? `存在 ${conflictCount} 处潜在冲突，需对齐确认后方可进入任务 5.3`
            : 'Consistency 均已消解，可进入任务 5.3'
        }`,
        'scope_green',
        { startFullyRevealed: true },
      );
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
    if (!hasUnresolvedTvmConflict) {
      allowTask53Kickoff = true;
    } else if (conflictCount) {
      stashAlignmentPainTargetsForLineTask?.(rawId, 'capability_field_set_mapping', conflictRows);
    }
  }

  withTask52L3DynamicsCard((card) => {
    if (allowSyncOk && allowTask53Kickoff) {
      card.status = 'completed';
      card.completedAtMs = Date.now();
      card.completionQueued = true;
    } else if (allowSyncOk && !allowTask53Kickoff) {
      card.status = 'running';
      card.completedAtMs = null;
      card.completionQueued = false;
    } else {
      card.status = 'completed';
      card.completedAtMs = Date.now();
      appendLineToCard(
        card,
        '→ 任务 5.2 未收官（Target_KV 落库失败）；请修复后端后对本线步「重启当前」重跑',
        'default',
        { startFullyRevealed: true },
      );
    }
  }, rawId);

  const task52Done = !!(allowSyncOk && l52Raw && allowTask53Kickoff);
  saveDesignDetailLineState(rawId, {
    schemaVersion: 1,
    currentTaskId: task52Done ? 'key_scenario_temporal_flow_inference' : 'capability_field_set_mapping',
    holdPastTask5: true,
    holdPastTask51: true,
    holdPastTask52: task52Done,
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
  if (task52Done && onTask52Done) {
    await onTask52Done(rawId, epochAtStart, llmAbort, mergedItem, pipelineOpts);
  }
  await flushPersistDesignDetailProgressWorkspace(rawId);
}
