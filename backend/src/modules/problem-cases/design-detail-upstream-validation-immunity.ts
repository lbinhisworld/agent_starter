/**
 * [INPUT]: `getDesignDetailTaskGraphDetail` 任务卡；`Token_Validation_Mapping` 解析计划
 * [OUTPUT]: 任务 1 target `featureId` → 上游已对齐 **Consistency**（含来源任务展示名）；合并后的 TVM 计划（历史痛点免疫）
 * [POS]: `syncDesignDetailTask3L2TargetKvTokens` / `syncDesignDetailTask4L2TargetKvTokens` 落库前强制继承任务 2（及任务 3）已确认节点
 */

import type { DesignDetailTaskGraphTaskDto } from './types';
import type { Task2L1TokenValidationLinkPlan } from './design-detail-task2-l1-target-kv-tokens';
import { DESIGN_DETAIL_TASK1_LINE_TASK_ID } from './design-detail-task1-basic-graph';
import {
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  isDesignDetailTask2L1TokenTaskId,
  isDesignDetailTask3L2TokenTaskId,
} from './design-detail-task-graph-catalog';

export type UpstreamConsistencyEntry = {
  consistency: string;
  sourceTaskDisplay: string;
};

const UPSTREAM_SOURCE_TASK_DISPLAY: Record<string, string> = {
  [DESIGN_DETAIL_TASK2_LINE_TASK_ID]: '任务 2',
  [DESIGN_DETAIL_TASK3_LINE_TASK_ID]: '任务 3',
};

function canonicalGraphTaskKey(dbTaskId: string): string {
  const t = String(dbTaskId || '').trim();
  if (t === '任务 1：客户基本情况了解' || t === 'customer_basic' || t === 'customer_requirement') {
    return DESIGN_DETAIL_TASK1_LINE_TASK_ID;
  }
  if (isDesignDetailTask2L1TokenTaskId(t)) return DESIGN_DETAIL_TASK2_LINE_TASK_ID;
  if (isDesignDetailTask3L2TokenTaskId(t)) return DESIGN_DETAIL_TASK3_LINE_TASK_ID;
  return t;
}

function isValidationConsistencyResolved(consistencyRaw: string): boolean {
  const c0 = String(consistencyRaw ?? '').trim();
  if (!c0) return false;
  if (c0.includes('已通过洞察修正') || c0.includes('已通过纠偏修正') || c0.includes('逻辑一致')) {
    return true;
  }
  const c = c0.replace(/\s+/g, '');
  if (!c.includes('潜在冲突')) return false;
  if (
    /无潜在冲突|非潜在冲突|没有潜在冲突|不存在潜在冲突|不含潜在冲突|暂无潜在冲突|未现潜在冲突/.test(c)
  ) {
    return false;
  }
  return false;
}

function consistencyResolvedRank(label: string): number {
  const c = String(label ?? '').trim();
  if (c.includes('已通过纠偏修正')) return 3;
  if (c.includes('已通过洞察修正')) return 2;
  if (c.includes('逻辑一致')) return 1;
  if (!isValidationConsistencyResolved(c) && c.replace(/\s+/g, '').includes('潜在冲突')) return 0;
  return -1;
}

function normalizeTask1TokenKeyForImmunity(raw: string): string {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  const head = t.split(/\s*·\s*/)[0]?.trim() ?? t;
  return head.replace(/\s+/g, '');
}

function featureIdSetForTask(tasks: DesignDetailTaskGraphTaskDto[], graphTaskKey: string): Set<string> {
  const card = tasks.find((t) => canonicalGraphTaskKey(t.taskId) === graphTaskKey);
  const ids = new Set<string>();
  for (const f of card?.features ?? []) {
    const id = String(f.featureId ?? '').trim();
    if (id) ids.add(id);
  }
  return ids;
}

function resolveSourceTaskDisplayForFeatureId(
  tasks: DesignDetailTaskGraphTaskDto[],
  sourceFeatureId: string,
  sourceGraphTaskKeys: readonly string[],
): string {
  for (const key of sourceGraphTaskKeys) {
    if (featureIdSetForTask(tasks, key).has(sourceFeatureId)) {
      return UPSTREAM_SOURCE_TASK_DISPLAY[key] ?? key;
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
  tasks: DesignDetailTaskGraphTaskDto[],
  sourceGraphTaskKeys: readonly string[],
): Map<string, UpstreamConsistencyEntry> {
  const sourceFeatureIds = new Set<string>();
  for (const key of sourceGraphTaskKeys) {
    for (const fid of featureIdSetForTask(tasks, key)) {
      sourceFeatureIds.add(fid);
    }
  }
  const t1 = tasks.find((t) => canonicalGraphTaskKey(t.taskId) === DESIGN_DETAIL_TASK1_LINE_TASK_ID);
  const out = new Map<string, UpstreamConsistencyEntry>();
  for (const link of t1?.links ?? []) {
    if (link.linkKind !== '反向验证') continue;
    const src = String(link.sourceFeatureId ?? '').trim();
    const tgt = String(link.targetFeatureId ?? '').trim();
    if (!src || !tgt || !sourceFeatureIds.has(src)) continue;
    const vc = String(link.validationConsistency ?? '').trim();
    if (!vc || !isValidationConsistencyResolved(vc)) continue;
    const entry: UpstreamConsistencyEntry = {
      consistency: vc,
      sourceTaskDisplay: resolveSourceTaskDisplayForFeatureId(tasks, src, sourceGraphTaskKeys),
    };
    putUpstreamEntry(out, tgt, entry);
    const feat = t1?.features?.find((f) => String(f.featureId ?? '').trim() === tgt);
    const tokKey = normalizeTask1TokenKeyForImmunity(String(feat?.name ?? '').trim());
    if (tokKey && !/^ft_\d{12}$/i.test(tokKey)) {
      putUpstreamEntry(out, tokKey, entry);
    }
  }
  return out;
}

function resolveUpstreamConsistencyForPlan(
  p: Task2L1TokenValidationLinkPlan,
  upstream: ReadonlyMap<string, UpstreamConsistencyEntry>,
): UpstreamConsistencyEntry | undefined {
  const tgt = String(p.targetFeatureId || '').trim();
  if (tgt) {
    const byId = upstream.get(tgt);
    if (byId) return byId;
  }
  const tokKey = normalizeTask1TokenKeyForImmunity(String(p.mappedL1FeatureKey || '').trim());
  if (tokKey) {
    const byTok = upstream.get(tokKey);
    if (byTok) return byTok;
  }
  return undefined;
}

export function mergeTokenValidationPlansWithUpstreamImmunity(
  plans: Task2L1TokenValidationLinkPlan[],
  upstreamByTask1TargetFeatureId: ReadonlyMap<string, UpstreamConsistencyEntry>,
): Task2L1TokenValidationLinkPlan[] {
  return plans.map((p) => {
    const entry = resolveUpstreamConsistencyForPlan(p, upstreamByTask1TargetFeatureId);
    if (!entry) {
      return p;
    }
    const note = `已继承${entry.sourceTaskDisplay}对齐结论（${entry.consistency}），免予重复问卷`;
    const logic = String(p.validationLogic || '').trim();
    return {
      ...p,
      consistencyLabel: entry.consistency,
      validationLogic: logic.includes('已继承') ? logic : logic ? `${logic}（${note}）` : note,
    };
  });
}

/** 任务 3 sync：继承任务 2 L1 反向验证结论 */
export function buildTask2UpstreamConsistencyForTask3Immunity(
  tasks: DesignDetailTaskGraphTaskDto[],
): Map<string, UpstreamConsistencyEntry> {
  return buildTask1UpstreamValidationConsistencyBySourceTasks(tasks, [DESIGN_DETAIL_TASK2_LINE_TASK_ID]);
}

/** 任务 4 sync：继承任务 2 + 任务 3 反向验证结论 */
export function buildTask2Task3UpstreamConsistencyForTask4Immunity(
  tasks: DesignDetailTaskGraphTaskDto[],
): Map<string, UpstreamConsistencyEntry> {
  return buildTask1UpstreamValidationConsistencyBySourceTasks(tasks, [
    DESIGN_DETAIL_TASK2_LINE_TASK_ID,
    DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  ]);
}
