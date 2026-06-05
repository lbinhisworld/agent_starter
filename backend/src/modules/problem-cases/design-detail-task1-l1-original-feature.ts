/**
 * [INPUT]: 任务 1 `L1_Original_Feature_Matrix` 大模型 JSON 原文
 * [OUTPUT]: 解析 `Target_KV` 行（三键 + 行级 `Validation_Status`）；`buildTask1L1OriginalFeatureGraphPlan` 供任务 1 图合并落库
 * [POS]: problem-cases；由 `ProblemCaseService.syncDesignDetailTask1L1OriginalFeatureMatrix` 调用
 *
 * [PROTOCOL]: 变更须同步 `frontend/js/designDetailL1OriginalFeatureSystemPrompt.js`、`design-detail-task1-l1-original-feature.test.ts` 与 `docs/agents/backend/01-context.md`
 */

import { isTask1FeatureValueEmpty } from './design-detail-task1-basic-graph';

export const TASK1_L1_ORIGINAL_FEATURE_KEYS = [
  '工商基础特征',
  '原始需求特征',
  '原始数据化石特征',
] as const;

export type Task1L1OriginalFeatureKey = (typeof TASK1_L1_ORIGINAL_FEATURE_KEYS)[number];

export const TASK1_L1_DEFAULT_VALIDATION_STATUS = 'Pending' as const;

/** 对齐问卷提交后写入任务 1 `DesignFeatureNode.value` 的断路器闭环态 */
export const TASK1_VALIDATION_STATUS_RESOLVED_BY_CUSTOMER = 'Resolved_By_Customer' as const;

const FT_12_RE = /^ft_\d{12}$/;

export type Task1L1OriginalFeatureSyncRow = {
  featureId: string;
  featureKey: Task1L1OriginalFeatureKey;
  operator: string;
  featureValue: string;
  valueRefDomain?: string;
  inferenceSummary?: string;
  validationStatus: string;
  tokenstr?: string;
};

export type Task1L1OriginalFeatureGraphRowForDb = {
  featureId: string;
  tokenSurfaces: string[];
  operator: string;
  featureValue: unknown;
  hasFeature: boolean;
};

export type Task1L1OriginalFeatureGraphPlan = {
  rows: Task1L1OriginalFeatureGraphRowForDb[];
  linkPairs: ReadonlyArray<{
    sourceFeatureId: string;
    targetFeatureId: string;
    logic: string;
    weight: number;
  }>;
};

export type ParseTask1L1OriginalFeatureRowsResult =
  | { ok: true; rows: Task1L1OriginalFeatureSyncRow[] }
  | { ok: false; message: string };

function stripBom(s: string): string {
  return String(s || '').replace(/^\uFEFF/, '');
}

function stripLlmJsonFence(raw: string): string {
  let t = String(raw || '').trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    return t;
  }
  const fence = /```(?:json)?\s*\n([\s\S]*?)\n```/i.exec(t);
  if (fence?.[1]) return fence[1].trim();
  return t;
}

function relaxLlmJsonForParse(text: string): string {
  return stripBom(String(text || ''))
    .replace(/[\u201C\u201D\u201E\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

function tryParseJsonRoot(text: string): unknown | null {
  const t = relaxLlmJsonForParse(stripLlmJsonFence(text));
  if (!t.length) return null;
  try {
    return JSON.parse(t);
  } catch {
    const m = /\{[\s\S]*\}/.exec(t);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

function peelJsonStringLayers(v: unknown, depth: number): unknown {
  let cur = v;
  for (let i = 0; i < depth; i += 1) {
    if (typeof cur === 'string') {
      const inner = tryParseJsonRoot(cur);
      if (inner === null) break;
      cur = inner;
      continue;
    }
    break;
  }
  return cur;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function readStringCI(rec: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = rec[k];
    if (v === null || v === undefined) continue;
    const s = typeof v === 'string' ? v.trim() : String(v).trim();
    if (s.length) return s;
  }
  return '';
}

function readTargetKvFromMatrix(matrix: Record<string, unknown>): unknown[] | null {
  const tk = matrix.Target_KV ?? matrix.target_kv ?? matrix.targetKv;
  if (!Array.isArray(tk) || tk.length === 0) return null;
  return tk;
}

function readL1OriginalFeatureMatrixFromRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  const direct = asRecord(root.L1_Original_Feature_Matrix ?? root.l1_original_feature_matrix);
  if (direct && readTargetKvFromMatrix(direct)) return direct;
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    const nested = asRecord(
      o.L1_Original_Feature_Matrix ?? o.l1_original_feature_matrix,
    );
    if (nested && readTargetKvFromMatrix(nested)) return nested;
  }
  const top = readTargetKvFromMatrix(root);
  if (top) return root;
  return null;
}

function isAllowedTask1L1FeatureKey(raw: string): raw is Task1L1OriginalFeatureKey {
  return (TASK1_L1_ORIGINAL_FEATURE_KEYS as readonly string[]).includes(raw);
}

function normalizeValidationStatus(raw: unknown): string {
  const s = String(raw ?? '').trim();
  return s.length ? s : TASK1_L1_DEFAULT_VALIDATION_STATUS;
}

export function buildTask1L1OriginalFeatureNodeValue(
  featureValue: string,
  valueRefDomain?: string,
  inferenceSummary?: string,
  validationStatus?: string,
  tokenstr?: string,
): Record<string, unknown> {
  const o: Record<string, unknown> = {
    Feature_Value: featureValue,
    Validation_Status: normalizeValidationStatus(validationStatus),
  };
  const d = String(valueRefDomain ?? '').trim();
  if (d.length) o.value_ref_domain = d;
  const inf = String(inferenceSummary ?? '').trim();
  if (inf.length) o.inference_summary = inf;
  const ts = String(tokenstr ?? '').trim();
  if (ts.length) o.tokenstr = ts;
  return o;
}

function resolveTokenSurfacesForRow(
  featureKey: Task1L1OriginalFeatureKey,
  tokenstr?: string,
): string[] {
  const ts = String(tokenstr ?? '').trim();
  if (ts.length) return [ts];
  return [featureKey];
}

export function isValidTask1L1ModelFeatureId(featureId: string): boolean {
  return FT_12_RE.test(String(featureId || '').trim());
}

export function parseTask1L1OriginalFeatureTargetKvSyncRows(
  l1OriginalFeatureRaw: string,
): ParseTask1L1OriginalFeatureRowsResult {
  const raw = stripBom(String(l1OriginalFeatureRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return { ok: false, message: 'JSON 解析失败（请确认任务 1 原始实然特征集输出为合法 JSON）' };
  }
  const root = peelJsonStringLayers(rootOnce, 8);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readL1OriginalFeatureMatrixFromRoot(obj);
  if (!matrix) {
    return {
      ok: false,
      message: '未找到 L1_Original_Feature_Matrix 或非空 Target_KV',
    };
  }
  const arr = readTargetKvFromMatrix(matrix);
  if (!arr?.length) {
    return { ok: false, message: 'L1_Original_Feature_Matrix.Target_KV 为空' };
  }

  const rows: Task1L1OriginalFeatureSyncRow[] = [];
  for (let i = 0; i < arr.length; i += 1) {
    const item = arr[i];
    const rec = asRecord(item);
    if (!rec) continue;
    const featureKeyRaw = readStringCI(rec, 'Feature_Key', 'feature_key', 'featureKey');
    if (!isAllowedTask1L1FeatureKey(featureKeyRaw)) {
      return {
        ok: false,
        message: `Target_KV[${i}] Feature_Key 须为「工商基础特征」「原始需求特征」「原始数据化石特征」之一，当前：${featureKeyRaw || '（空）'}`,
      };
    }
    const featureValue = readStringCI(rec, 'Feature_Value', 'feature_value', 'featureValue');
    if (!featureValue.length) continue;
    const featureId = readStringCI(rec, 'Feature_ID', 'feature_id', 'featureId');
    if (!isValidTask1L1ModelFeatureId(featureId)) {
      return {
        ok: false,
        message: `Target_KV[${i}] Feature_ID 须为 ft_ 后接 12 位数字，当前：${featureId || '（空）'}`,
      };
    }
    const operator = readStringCI(rec, 'Operator', 'operator') || '等于';
    const tokenstr = readStringCI(rec, 'tokenstr', 'TokenStr', 'token_str');
    if (featureKeyRaw === '原始数据化石特征' && !tokenstr.startsWith('现有表格/')) {
      return {
        ok: false,
        message: `Target_KV[${i}] 原始数据化石特征须带 tokenstr「现有表格/表名」`,
      };
    }
    rows.push({
      featureId,
      featureKey: featureKeyRaw,
      operator,
      featureValue,
      valueRefDomain: readStringCI(rec, 'value_ref_domain', 'Value_Ref_Domain', 'valueRefDomain') || undefined,
      inferenceSummary:
        readStringCI(rec, 'inference_summary', 'Inference_Summary', 'inferenceSummary') || undefined,
      validationStatus: normalizeValidationStatus(
        rec.Validation_Status ?? rec.validation_status ?? rec.validationStatus,
      ),
      tokenstr: tokenstr || undefined,
    });
  }
  if (!rows.length) {
    return { ok: false, message: 'Target_KV 无有效特征行（Feature_Value 为空或无法识别）' };
  }
  return { ok: true, rows };
}

export function normalizeL1OriginalFeatureInferenceRawForServerSync(
  l1OriginalFeatureRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const parsed = parseTask1L1OriginalFeatureTargetKvSyncRows(l1OriginalFeatureRaw);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const rootOnce = tryParseJsonRoot(stripBom(String(l1OriginalFeatureRaw || '').trim()));
  const obj = asRecord(peelJsonStringLayers(rootOnce, 8));
  if (!obj) {
    return {
      ok: true,
      normalized: JSON.stringify({ L1_Original_Feature_Matrix: { Target_KV: [] } }),
    };
  }
  const matrix = readL1OriginalFeatureMatrixFromRoot(obj);
  const payload =
    matrix && asRecord(obj.L1_Original_Feature_Matrix ?? obj.l1_original_feature_matrix)
      ? obj
      : { L1_Original_Feature_Matrix: matrix ?? { Target_KV: [] } };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

export function buildTask1L1OriginalFeatureGraphPlan(
  syncRows: Task1L1OriginalFeatureSyncRow[],
): Task1L1OriginalFeatureGraphPlan {
  const rows: Task1L1OriginalFeatureGraphRowForDb[] = [];
  for (const row of syncRows) {
    const tokenSurfaces = resolveTokenSurfacesForRow(row.featureKey, row.tokenstr);
    const featureValue = buildTask1L1OriginalFeatureNodeValue(
      row.featureValue,
      row.valueRefDomain,
      row.inferenceSummary,
      row.validationStatus,
      row.tokenstr,
    );
    const hasFeature = !isTask1FeatureValueEmpty(row.featureValue);
    rows.push({
      featureId: row.featureId,
      tokenSurfaces,
      operator: row.operator,
      featureValue,
      hasFeature,
    });
  }
  return { rows, linkPairs: [] };
}

/**
 * 将 `POST …/sync-task1-l1-original-feature-matrix` 请求体归一为单段 JSON 字符串。
 */
export function coerceHttpBodyToL1OriginalFeatureRawString(body: unknown): string | null {
  if (body === null || body === undefined) return null;
  if (typeof body === 'string') {
    const t = stripBom(String(body).trim());
    return t.length ? t : null;
  }
  if (typeof body !== 'object' || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const r = o.l1OriginalFeatureRaw ?? o.l1_original_feature_raw;
  if (typeof r === 'string') {
    const t = stripBom(r.trim());
    return t.length ? t : null;
  }
  if (r != null && typeof r === 'object') {
    try {
      return JSON.stringify(r);
    } catch {
      return null;
    }
  }
  const matrix = o.L1_Original_Feature_Matrix ?? o.l1_original_feature_matrix;
  if (matrix != null && typeof matrix === 'object') {
    try {
      return JSON.stringify(o);
    } catch {
      return null;
    }
  }
  return null;
}
