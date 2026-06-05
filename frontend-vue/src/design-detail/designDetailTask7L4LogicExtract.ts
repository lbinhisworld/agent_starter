/**
 * [INPUT]: 单环节 L4_Form_Layout_Matrix 模型原文
 * [OUTPUT]: IT 选型五维提取行（供子任务进度区展示）
 * [POS]: `runTask7L4CollaborationPipeline` 子任务「正在提取逻辑」段
 */

export const TASK7_IT_SELECTION_PROGRESS_LABELS = [
  '交互工具选型',
  '存储工具选型',
  '集成行为选型',
  '技术判断',
  '业务价值预判',
] as const;

export type Task7ItSelectionExtractLine = {
  label: (typeof TASK7_IT_SELECTION_PROGRESS_LABELS)[number];
  value: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readL4MatrixFromParsed(root: Record<string, unknown>): Record<string, unknown> | null {
  const direct =
    asRecord(root.L4_Form_Layout_Matrix) ??
    asRecord(root.l4_form_layout_matrix) ??
    asRecord(root.L4_Collaboration_Inference_Matrix) ??
    asRecord(root.l4_collaboration_inference_matrix);
  if (direct) return direct;
  const tk = root.Target_KV ?? root.target_kv;
  if (Array.isArray(tk) && tk.length) return root;
  return null;
}

function collaborationFeatureValueFromRow(rec: Record<string, unknown>): Record<string, unknown> | null {
  const fvRaw = rec.Feature_Value ?? rec.feature_value;
  if (asRecord(fvRaw)) return asRecord(fvRaw);
  if (typeof fvRaw === 'string') {
    const s = fvRaw.trim();
    if (!s.startsWith('{')) return null;
    try {
      return asRecord(JSON.parse(s));
    } catch {
      return null;
    }
  }
  return null;
}

function readNestedString(obj: Record<string, unknown>, ...keys: string[]): string {
  let cur: unknown = obj;
  for (const k of keys) {
    const rec = asRecord(cur);
    if (!rec) return '';
    cur = rec[k];
  }
  return String(cur ?? '').trim();
}

/** 自单步模型原文提取 5 类 IT 选型维度（无则跳过空值） */
export function parseTask7L4StepRawForItSelectionLines(stepRaw: string): Task7ItSelectionExtractLine[] {
  const raw = String(stepRaw ?? '').trim();
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const root = asRecord(parsed);
  if (!root) return [];
  const matrix = readL4MatrixFromParsed(root);
  if (!matrix) return [];
  const tk = matrix.Target_KV ?? matrix.target_kv;
  if (!Array.isArray(tk)) return [];
  let fv: Record<string, unknown> | null = null;
  for (const item of tk) {
    const rec = asRecord(item);
    if (!rec) continue;
    const key = String(rec.Feature_Key ?? rec.feature_key ?? '').trim();
    if (key !== '协作节点') continue;
    fv = collaborationFeatureValueFromRow(rec);
    if (fv) break;
  }
  if (!fv) return [];
  const specs: Array<{ label: Task7ItSelectionExtractLine['label']; value: string }> = [
    {
      label: '交互工具选型',
      value: readNestedString(fv, 'selected_it_tool_proposal', 'ui_layout_interface_tool'),
    },
    {
      label: '存储工具选型',
      value: readNestedString(fv, 'selected_it_tool_proposal', 'data_schema_storage_base'),
    },
    {
      label: '集成行为选型',
      value: readNestedString(fv, 'selected_it_tool_proposal', 'integration_behavior_hook'),
    },
    {
      label: '技术判断',
      value: readNestedString(fv, 'technical_selection_rationale'),
    },
    {
      label: '业务价值预判',
      value: readNestedString(fv, 'achieved_business_impact'),
    },
  ];
  return specs.filter((s) => s.value.length > 0);
}

export const TASK7_LOGIC_EXTRACT_LINE = '→ 正在提取逻辑';

export function buildTask7ItSelectionExtractProgressLines(
  lines: readonly Task7ItSelectionExtractLine[],
): string[] {
  const out: string[] = [];
  if (lines.length) out.push(TASK7_LOGIC_EXTRACT_LINE);
  for (const ln of lines) {
    out.push(`→ ${ln.label}：【${ln.value}】`);
  }
  return out;
}
