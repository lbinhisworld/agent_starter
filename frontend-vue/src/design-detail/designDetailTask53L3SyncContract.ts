/**
 * [INPUT]: 任务 5.3 模型原文 `L3_Workflow_Flow_Matrix.Target_KV`
 * [OUTPUT]: Feature_Key 归一、落库前矩阵清洗（与后端 `parseTask53L3TargetKvSyncRows` 口径一致）
 * [POS]: `normalizeL53WorkflowFlowRawForServerSync` / 任务 5.3 流水线 sync 前校验
 *
 * [PROTOCOL]: 与 `backend/.../design-detail-task2-l1-target-kv-tokens.ts` 中 TASK53 常量同步
 */

export const TASK53_L3_WORKFLOW_FLOW_KEY = '关键工作流' as const;

/** 单环节节点（落库 token：`关键工作流/{流程名}/环节/{环节名}`） */
export const TASK53_L3_WORKFLOW_STEP_KEY = '流程环节' as const;

export const TASK53_L3_WORKFLOW_FLOW_KEY_LEGACY = '关键场景时序流转' as const;

/** 剥除模型常带的弯引号/直引号包裹 */
export function normalizeTask53FeatureKeyLabel(raw: unknown): string {
  return String(raw ?? '')
    .replace(/^[「『"'“\s]+/, '')
    .replace(/[」』"'”\s]+$/, '')
    .trim();
}

export function isTask53L3TargetKvSyncableFeatureKey(key: string): boolean {
  const k = normalizeTask53FeatureKeyLabel(key);
  return k === TASK53_L3_WORKFLOW_FLOW_KEY || k === TASK53_L3_WORKFLOW_FLOW_KEY_LEGACY;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readTargetKvArray(matrix: Record<string, unknown>): unknown[] {
  const kv = matrix.Target_KV ?? matrix.target_kv ?? matrix.Target_kv;
  return Array.isArray(kv) ? kv : [];
}

/**
 * 仅保留可落库的「关键工作流」行，并将 Feature_Key 写回 canonical 值。
 */
export function sanitizeTask53WorkflowFlowMatrixForSync(
  matrix: Record<string, unknown>,
): { ok: true; matrix: Record<string, unknown> } | { ok: false; message: string } {
  const src = readTargetKvArray(matrix);
  if (!src.length) {
    return {
      ok: false,
      message:
        'L3_Workflow_Flow_Matrix 内 Target_KV 为空；请确认 Feature_Key=「关键工作流」且含 workflow_steps_topology',
    };
  }
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const item of src) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fkRaw =
      rec.Feature_Key ?? rec.feature_key ?? (rec as { FeatureKey?: unknown }).FeatureKey;
    if (!isTask53L3TargetKvSyncableFeatureKey(String(fkRaw ?? ''))) continue;
    const fv = rec.Feature_Value ?? rec.feature_value;
    const dedupKey = (() => {
      if (fv != null && typeof fv === 'object' && !Array.isArray(fv)) {
        const inner = fv as Record<string, unknown>;
        const wf = String(inner.workflow_name ?? inner.Workflow_Name ?? '').trim();
        if (wf) return wf;
        const seg = String(inner.flow_segment_name ?? inner.Flow_Segment_Name ?? '').trim();
        if (seg) return seg;
        try {
          return JSON.stringify(inner).slice(0, 200);
        } catch {
          return '__obj__';
        }
      }
      return String(fv ?? '').trim().slice(0, 200) || '__empty__';
    })();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    rows.push({ ...rec, Feature_Key: TASK53_L3_WORKFLOW_FLOW_KEY });
  }
  if (!rows.length) {
    return {
      ok: false,
      message:
        '未解析到关键工作流节点；请按 L3_Workflow_Flow_Matrix 契约输出 Feature_Key=「关键工作流」（含 workflow_steps_topology）',
    };
  }
  return {
    ok: true,
    matrix: {
      ...matrix,
      Target_KV: rows,
    },
  };
}
