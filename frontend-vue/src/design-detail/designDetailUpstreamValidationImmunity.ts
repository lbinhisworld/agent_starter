/**
 * [INPUT]: `GET …/task-graph` 归一化后的任务卡（含任务 1 卡上 **反向验证** 边）
 * [OUTPUT]: 任务 1 `featureId` → 上游已对齐 **Consistency**；对 TVM 行做 **历史痛点免疫** 覆盖
 * [POS]: 任务 3/4 L2 对齐门禁与推理 user 块；落实提示词「历史痛点免疫」轨道（不依赖模型单独遵守）
 *
 * [PROTOCOL]: 与 `isTokenValidationMappingPotentialConflict` 口径一致；变更时同步 `designDetailTask2L1SyncUiProgress.ts`、`buildTask3L2InferenceInputFromTaskGraph.ts`、`useDesignDetailChat.ts` 与后端 `design-detail-upstream-validation-immunity.ts`
 */

import type { DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import {
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  normLogicTaskId,
} from './designDetailLogicGraphMerge';
import { normalizeLogicGraphTasksFromApiPayload } from './designDetailTask2L1SyncUiProgress';
import {
  isTokenValidationMappingPotentialConflict,
  type Task2L1TvmParsedRow,
} from './designDetailTask2L1SyncUiProgress';

/** 上游反向边已对齐结论（含来源任务展示名，供进度区「已继承任务 N…」） */
export type UpstreamConsistencyEntry = {
  consistency: string;
  sourceTaskDisplay: string;
};

const UPSTREAM_SOURCE_TASK_DISPLAY: Record<string, string> = {
  [DESIGN_DETAIL_TASK2_LINE_TASK_ID]: '任务 2',
  [DESIGN_DETAIL_TASK3_LINE_TASK_ID]: '任务 3',
};

function consistencyResolvedRank(label: string): number {
  const c = String(label ?? '').trim();
  if (c.includes('已通过纠偏修正')) return 3;
  if (c.includes('已通过洞察修正')) return 2;
  if (c.includes('逻辑一致')) return 1;
  if (isTokenValidationMappingPotentialConflict(c)) return 0;
  return -1;
}

/** 上游（任务 2 / 任务 3 等）反向验证边已对齐时，视为可免疫 */
export function isUpstreamValidationConsistencyResolved(consistencyRaw: string): boolean {
  return consistencyResolvedRank(consistencyRaw) > 0;
}

/** 与问卷/TVM 行 `tokenStr`、逻辑图 `tokenDisplay` 对齐的归一键 */
export function normalizeTask1TokenKeyForImmunity(raw: string): string {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  const head = t.split(/\s*·\s*/)[0]?.trim() ?? t;
  return head.replace(/\s+/g, '');
}

function featureIdSetForGraphTask(
  tasks: DesignDetailLogicGraphTaskDto[],
  normTaskId: string,
): Set<string> {
  const card = tasks.find((t) => normLogicTaskId(t.taskId) === normTaskId);
  const ids = new Set<string>();
  for (const f of card?.features ?? []) {
    const id = String(f.featureId ?? '').trim();
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * 从任务 1 卡上的反向验证边，收集「指定上游任务」已写入的 **Consistency**（按 target FeatureID 取最优）。
 */
function resolveSourceTaskDisplayForFeatureId(
  mergedTasks: DesignDetailLogicGraphTaskDto[],
  sourceFeatureId: string,
  sourceNormTaskIds: readonly string[],
): string {
  for (const tid of sourceNormTaskIds) {
    if (featureIdSetForGraphTask(mergedTasks, tid).has(sourceFeatureId)) {
      return UPSTREAM_SOURCE_TASK_DISPLAY[tid] ?? tid;
    }
  }
  return '上游任务';
}

function putUpstreamEntry(
  out: Map<string, UpstreamConsistencyEntry>,
  key: string,
  entry: UpstreamConsistencyEntry,
): void {
  if (!key) return;
  const prev = out.get(key);
  if (!prev || consistencyResolvedRank(entry.consistency) > consistencyResolvedRank(prev.consistency)) {
    out.set(key, entry);
  }
}

export function buildTask1UpstreamValidationConsistencyBySourceTasks(
  mergedTasks: DesignDetailLogicGraphTaskDto[],
  sourceNormTaskIds: readonly string[],
): Map<string, UpstreamConsistencyEntry> {
  const sourceFeatureIds = new Set<string>();
  for (const tid of sourceNormTaskIds) {
    for (const fid of featureIdSetForGraphTask(mergedTasks, tid)) {
      sourceFeatureIds.add(fid);
    }
  }
  const t1 = mergedTasks.find((t) => normLogicTaskId(t.taskId) === 'customer_basic');
  const out = new Map<string, UpstreamConsistencyEntry>();
  for (const link of t1?.links ?? []) {
    if (link.linkKind !== '反向验证') continue;
    const src = String(link.sourceFeatureId ?? link.source?.featureId ?? '').trim();
    const tgt = String(link.targetFeatureId ?? link.target?.featureId ?? '').trim();
    if (!src || !tgt || !sourceFeatureIds.has(src)) continue;
    const vc = String(link.validationConsistency ?? '').trim();
    if (!vc || !isUpstreamValidationConsistencyResolved(vc)) continue;
    const entry: UpstreamConsistencyEntry = {
      consistency: vc,
      sourceTaskDisplay: resolveSourceTaskDisplayForFeatureId(mergedTasks, src, sourceNormTaskIds),
    };
    putUpstreamEntry(out, tgt, entry);
    const tokKey = normalizeTask1TokenKeyForImmunity(
      String(link.target?.tokenDisplay ?? link.target?.name ?? '').trim(),
    );
    if (tokKey && !/^ft_\d{12}$/i.test(tokKey)) {
      putUpstreamEntry(out, tokKey, entry);
    }
  }
  return out;
}

/** 将上游已对齐状态覆盖到本步 TVM（`interview_question`＝N/A）。进度文案由 `designDetailTvmImmunityPipeline` 生成。 */
export function applyUpstreamPainPointImmunityToTvmRows(
  rows: Task2L1TvmParsedRow[],
  upstreamByTask1FeatureId: ReadonlyMap<string, UpstreamConsistencyEntry>,
): Task2L1TvmParsedRow[] {
  return rows.map((r) => {
    const fid = String(r.targetFeatureId ?? '').trim();
    const entry =
      (fid ? upstreamByTask1FeatureId.get(fid) : undefined) ??
      (() => {
        const keys = [
          normalizeTask1TokenKeyForImmunity(row.tokenStr),
          normalizeTask1TokenKeyForImmunity(row.clientFactToken),
          normalizeTask1TokenKeyForImmunity(row.anchorModelFeature),
        ].filter(Boolean);
        for (const k of keys) {
          const e = upstreamByTask1FeatureId.get(k);
          if (e) return e;
        }
        return undefined;
      })();
    if (!entry) {
      return r;
    }
    const immuneNote = `已继承${entry.sourceTaskDisplay}对齐结论（${entry.consistency}），免予重复问卷`;
    const logic = String(r.validationLogic ?? '').trim();
    return {
      ...r,
      consistency: entry.consistency,
      interviewQuestion: 'N/A',
      validationLogic: logic.includes('已继承') ? logic : logic ? `${logic}（${immuneNote}）` : immuneNote,
    };
  });
}

/** 任务 3：仅继承任务 2 L1 反向验证结论 */
export function buildTask2UpstreamConsistencyForTask3Immunity(
  mergedTasks: DesignDetailLogicGraphTaskDto[],
): Map<string, UpstreamConsistencyEntry> {
  return buildTask1UpstreamValidationConsistencyBySourceTasks(mergedTasks, [
    DESIGN_DETAIL_TASK2_LINE_TASK_ID,
  ]);
}

/** 任务 4：继承任务 2 + 任务 3 反向验证结论 */
export function buildTask2Task3UpstreamConsistencyForTask4Immunity(
  mergedTasks: DesignDetailLogicGraphTaskDto[],
): Map<string, UpstreamConsistencyEntry> {
  return buildTask1UpstreamValidationConsistencyBySourceTasks(mergedTasks, [
    DESIGN_DETAIL_TASK2_LINE_TASK_ID,
    DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  ]);
}

export type DesignDetailTaskGraphFetchResult = {
  ok?: boolean;
  data?: { tasks?: DesignDetailLogicGraphTaskDto[] };
};

/** 拉取并归一化推理图（供任务 3/4 对齐门禁前刷新上游免疫，避免沿用流水线开跑时的陈旧快照） */
export async function fetchNormalizedLogicGraphTasksForImmunity(
  caseId: string,
  getGraph: (id: string) => Promise<DesignDetailTaskGraphFetchResult | null | undefined>,
): Promise<DesignDetailLogicGraphTaskDto[] | null> {
  const cid = String(caseId || '').trim();
  if (!cid || typeof getGraph !== 'function') return null;
  try {
    const gr = await getGraph(cid);
    if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
      return normalizeLogicGraphTasksFromApiPayload(gr.data.tasks);
    }
  } catch {
    /* ignore */
  }
  return null;
}
