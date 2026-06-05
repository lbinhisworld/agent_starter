/**
 * [INPUT]: 任务 5.2 task-graph `features[]`（`业务能力字段集` + `featureValue.fields_schema_tree`）
 * [OUTPUT]: 任务进展卡「推理结论」结构化文案（字段集头 + 引入字段子行）
 * [POS]: `designDetailFeatureInferenceConclusionProgress.ts` 在任务 5.2 落库后推送结论时专用
 *
 * [PROTOCOL]: 与 `designDetailLogicTreeTask52Layout.ts`、`designDetailL52AssetFieldSetSystemPrompt.js` 契约对齐；变更时同步 `designDetailFeatureInferenceConclusionProgress.ts` 与本目录 `AGENTS.md`
 */

import type { DesignDetailLogicGraphFeatureDto } from './designDetailLogicGraphMerge';
import {
  isTask52FieldSetGraphFeatureRow,
  task52FieldSchemaLeavesFromDisplay,
  task52FieldSetTitleFromDisplay,
} from './designDetailLogicTreeTask52Layout';

export type Task52ConclusionLine = {
  text: string;
  /** 与 graph `featureId` 对齐，供增量推送与 hydrate 去重 */
  inferenceFeatureId: string;
};

export type Task52ConclusionUnit = {
  /** 主锚点：业务能力字段集特征 id */
  anchorFeatureId: string;
  coveredFeatureIds: string[];
  lines: Task52ConclusionLine[];
};

const FIELD_SET_TOKEN = '业务能力字段集';

function isTask52FieldSetFeature(f: DesignDetailLogicGraphFeatureDto): boolean {
  return isTask52FieldSetGraphFeatureRow(f);
}

function formatFieldIntroLine(fieldName: string, dataType: string): string {
  const fn = fieldName.trim() || '—';
  const dt = dataType.trim() || '—';
  return `｜→ 引入字段 ${fn}｜${dt}`;
}

function formatFieldSetHeaderLine(title: string): string {
  const t = title.trim() || '（未命名字段集）';
  return `→ ${FIELD_SET_TOKEN} 引入 ${t}`;
}

/** 由任务 5.2 落库特征组装推理结论块（每字段集一块：头行 + 字段子行） */
export function buildTask52InferenceConclusionUnits(
  features: ReadonlyArray<DesignDetailLogicGraphFeatureDto>,
): Task52ConclusionUnit[] {
  const units: Task52ConclusionUnit[] = [];
  for (const f of features) {
    if (!isTask52FieldSetFeature(f)) continue;
    const fid = String(f.featureId ?? '').trim();
    if (!fid) continue;
    const title = task52FieldSetTitleFromDisplay(f);
    const leaves = task52FieldSchemaLeavesFromDisplay(f);
    const lines: Task52ConclusionLine[] = [
      { text: formatFieldSetHeaderLine(title), inferenceFeatureId: fid },
    ];
    for (const leaf of leaves) {
      lines.push({
        text: formatFieldIntroLine(leaf.fieldName, leaf.dataType),
        inferenceFeatureId: fid,
      });
    }
    units.push({
      anchorFeatureId: fid,
      coveredFeatureIds: [fid],
      lines,
    });
  }
  return units;
}

/** 任务 5.2：从动态卡行收集已推送的 anchorFeatureId */
export function collectPushedTask52ConclusionAnchorIds(
  lines: ReadonlyArray<{ kind: string; inferenceFeatureId?: string }>,
  units: ReadonlyArray<Task52ConclusionUnit>,
): Set<string> {
  const ids = new Set<string>();
  for (const l of lines) {
    const fid = String(l.inferenceFeatureId ?? '').trim();
    if (fid && fid !== '—') ids.add(fid);
  }
  if (ids.size > 0) {
    const pushedAnchors = new Set<string>();
    for (const u of units) {
      if (ids.has(u.anchorFeatureId)) pushedAnchors.add(u.anchorFeatureId);
      else if (u.coveredFeatureIds.some((id) => ids.has(id))) pushedAnchors.add(u.anchorFeatureId);
    }
    return pushedAnchors;
  }
  return ids;
}

export function listRemainingTask52ConclusionUnits(
  lines: ReadonlyArray<{ kind: string; inferenceFeatureId?: string }>,
  units: ReadonlyArray<Task52ConclusionUnit>,
): Task52ConclusionUnit[] {
  if (!units.length) return [];
  const pushed = collectPushedTask52ConclusionAnchorIds(lines, units);
  return units.filter((u) => !pushed.has(u.anchorFeatureId));
}
