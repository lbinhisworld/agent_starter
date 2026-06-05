/**
 * [INPUT]: `GET …/design-detail/task-graph` 归一化后的 `tasks[]`；任务 2 L1 模型原始串 `l1InferenceRaw`
 * [OUTPUT]: 任务进展区用的正向归纳 / 反向验证链接明细行；**`Token_Validation_Mapping`** 灰块摘要（**`formatTokenValidationMappingProgressHtml`**：按条 **`Consistency`** 分色——潜在冲突 **淡红**、无冲突 **淡绿**；**`Target_FeatureID` / `Mapped_L1_Feature`** 深蓝突出）；任务 3、任务 4 分别用 extractTask3L2* / extractTask4L2* 与 buildForwardInductionLinkUiLinesTask3 / Task4
 * [POS]: `useDesignDetailChat.ts` 在任务 2 L1、任务 3 L2、任务 4 L2 落库成功后编排叙事行
 *
 * [PROTOCOL]: 任务 2：**`supplementTask2L1TvmRowsForMissingPainPointInput2`** / **`mergeSupplementedPainPointTvmIntoL1InferenceRaw`** 对 Input 2 **痛点雷达/** 漏行补全后落库与进度展示；任务 3：**`normalizeL2BusinessInferenceRawForServerSync`**（sync 前剥离围栏）与矩阵根键 **`L2_Business_Inference_Matrix`** / **`L2_Inference_Matrix`**（与后端 `readL2Task3MatrixContainerRecord` 一致）；**`parseTask3L2TokenValidationMappingForAlignment`** 与任务 2 **`task2L1*`** 门禁共用 **`isTokenValidationMappingPotentialConflict`**；任务 4：**`normalizeL2ValueInferenceRawForServerSync`**；契约变更时同步本文件与 design_mode_ux.md
 */

import {
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  DESIGN_DETAIL_TASK4_LINE_TASK_ID,
  DESIGN_DETAIL_TASK5_LINE_TASK_ID,
  DESIGN_DETAIL_TASK51_LINE_TASK_ID,
  DESIGN_DETAIL_TASK55_LINE_TASK_ID,
  DESIGN_DETAIL_TASK8_LINE_TASK_ID,
  DESIGN_DETAIL_TASK9_LINE_TASK_ID,
  DESIGN_DETAIL_TASK10_LINE_TASK_ID,
  DESIGN_DETAIL_TASK0_LINE_TASK_ID,
  DESIGN_DETAIL_TASK85_LINE_TASK_ID,
  buildFeatureIdToNormTaskIdFromGraphTasks,
  dedupeLogicGraphTasksByNormTaskId,
  mergeCustomerRequirementIntoBasicForLogicGraph,
  normLogicTaskId,
  normalizeLogicGraphTasksAfterFetch,
  type DesignDetailLogicGraphFeatureDto,
  type DesignDetailLogicGraphLinkDto,
  type DesignDetailLogicGraphTaskDto,
} from './designDetailLogicGraphMerge';
import { buildAlignmentQuestionnaireUserBlock } from './designDetailAlignmentQuestionnaireInput';
import { sanitizeTask53WorkflowFlowMatrixForSync } from './designDetailTask53L3SyncContract';
import {
  listTask2L1PainPointRadarInput2FeatureRows,
  type Task2L1TaskGraphFeatureRow,
} from './buildTask2L1InferenceInputFromTaskGraph';

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

/** 与后端 `relaxLlmJsonForParse` 对齐：弯引号、尾逗号、权重区间占位符 */
function relaxLlmJsonForParse(text: string): string {
  return stripBom(String(text || ''))
    .replace(/:\s*0\.0\s*-\s*1\.0\b/g, ': 0.85')
    .replace(/[\u201C\u201D\u201E\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

/** 与后端 `repairUnescapedQuotesInJsonStrings` 对齐 */
function repairUnescapedQuotesInJsonStrings(text: string): string {
  const s = String(text || '');
  let out = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      out += c;
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      out += c;
      escape = true;
      continue;
    }
    if (c === '"') {
      if (!inString) {
        inString = true;
        out += c;
        continue;
      }
      let j = i + 1;
      while (j < s.length && /[\s\n\r\t]/.test(s[j] ?? '')) j++;
      const next = s[j];
      if (next === undefined || next === ',' || next === '}' || next === ']' || next === ':') {
        inString = false;
        out += c;
      } else {
        out += '\\"';
      }
      continue;
    }
    out += c;
  }
  return out;
}

function relaxLlmJsonForParseDeep(text: string): string {
  return repairLiteralNewlinesInJsonStrings(
    repairUnescapedQuotesInJsonStrings(relaxLlmJsonForParse(text)),
  );
}

/** 修复字符串值内未转义的换行/制表符（与后端 `repairLiteralNewlinesInJsonStrings` 对齐） */
function repairLiteralNewlinesInJsonStrings(text: string): string {
  const s = String(text || '');
  let out = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      out += c;
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') {
        out += c;
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        out += c;
        continue;
      }
      if (c === '\n') {
        out += '\\n';
        continue;
      }
      if (c === '\r') {
        out += '\\r';
        continue;
      }
      if (c === '\t') {
        out += '\\t';
        continue;
      }
      out += c;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    out += c;
  }
  return out;
}

function relaxLlmJsonNonFiniteLiterals(text: string): string {
  return String(text || '')
    .replace(/\bundefined\b/g, 'null')
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bInfinity\b/g, 'null');
}

/** 从含前后说明文字的文本中截取首个平衡 `{ ... }`（按 JSON 双引号字符串规则忽略括号） */
function extractFirstBalancedJsonObject(text: string): string | null {
  const s = String(text);
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** 尝试修复 LLM 输出被 max_tokens 截断的 JSON（与后端 `repairTruncatedJson` 对齐） */
function repairTruncatedJson(raw: string): string | null {
  const s = String(raw).trim();
  if (!s.length) return null;
  const start = s.indexOf('{');
  if (start < 0) return null;
  let buf = s.slice(start);
  let depthObj = 0;
  let depthArr = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depthObj++;
    else if (c === '}') depthObj--;
    else if (c === '[') depthArr++;
    else if (c === ']') depthArr--;
  }
  if (depthObj === 0 && depthArr === 0 && !inString) return null;
  const patterns = ['},', '},\n', '},\r\n'];
  let lastCompleteIdx = -1;
  for (const pat of patterns) {
    const idx = buf.lastIndexOf(pat);
    if (idx > lastCompleteIdx) lastCompleteIdx = idx;
  }
  if (lastCompleteIdx < 0) lastCompleteIdx = buf.lastIndexOf('}');
  if (lastCompleteIdx < 0) return null;
  buf = buf.slice(0, lastCompleteIdx + 1);
  depthObj = 0;
  depthArr = 0;
  inString = false;
  escape = false;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depthObj++;
    else if (c === '}') depthObj--;
    else if (c === '[') depthArr++;
    else if (c === ']') depthArr--;
  }
  for (let d = 0; d < depthArr; d++) buf += ']';
  for (let d = 0; d < depthObj; d++) buf += '}';
  return buf;
}

function tryParseJsonRoot(raw: string): unknown | null {
  const stripped = stripLlmJsonFence(raw);
  const candidates = [
    stripped,
    relaxLlmJsonForParse(stripped),
    relaxLlmJsonForParseDeep(stripped),
    relaxLlmJsonNonFiniteLiterals(relaxLlmJsonForParseDeep(stripped)),
    raw,
    relaxLlmJsonForParse(raw),
    relaxLlmJsonForParseDeep(raw),
    relaxLlmJsonNonFiniteLiterals(relaxLlmJsonForParseDeep(raw)),
  ];
  for (const chunk of candidates) {
    if (!chunk?.length) continue;
    try {
      return JSON.parse(chunk) as unknown;
    } catch {
      /* continue */
    }
    const sub = extractFirstBalancedJsonObject(chunk);
    if (sub) {
      for (const subChunk of [
        sub,
        relaxLlmJsonForParse(sub),
        relaxLlmJsonForParseDeep(sub),
        relaxLlmJsonNonFiniteLiterals(relaxLlmJsonForParseDeep(sub)),
      ]) {
        try {
          return JSON.parse(subChunk) as unknown;
        } catch {
          /* continue */
        }
      }
    }
  }
  const truncated = repairTruncatedJson(stripped);
  if (truncated) {
    for (const tc of [
      truncated,
      relaxLlmJsonForParse(truncated),
      relaxLlmJsonForParseDeep(truncated),
      relaxLlmJsonNonFiniteLiterals(relaxLlmJsonForParseDeep(truncated)),
    ]) {
      try {
        return JSON.parse(tc) as unknown;
      } catch {
        /* continue */
      }
    }
  }
  return null;
}

function peelJsonStringLayers(initial: unknown, maxDepth: number): unknown {
  let cur: unknown = initial;
  for (let d = 0; d < maxDepth; d++) {
    if (typeof cur !== 'string') return cur;
    const next = tryParseJsonRoot(stripBom(String(cur).trim()));
    if (next === null) return cur;
    cur = next;
  }
  return cur;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

/** 不区分大小写、空白归一为下划线后匹配属性名（与后端 `getPropertyCI` 对齐） */
function getPropertyCI(obj: Record<string, unknown>, ...names: string[]): unknown {
  const norm = (k: string) => k.toLowerCase().replace(/\s+/g, '_');
  const lowerToOrig = new Map<string, string>();
  for (const k of Object.keys(obj)) {
    lowerToOrig.set(norm(k), k);
  }
  for (const n of names) {
    const orig = lowerToOrig.get(norm(n));
    if (orig !== undefined) return obj[orig];
  }
  return undefined;
}

/** 任务 3 L2：与后端 `readL2Task3MatrixContainerRecord` 键序一致（含一层包装对象）。 */
function readL2Task3MatrixRecordForProgress(rootObj: Record<string, unknown>): Record<string, unknown> | null {
  const keyPairs: Array<[string, string]> = [
    ['L2_Business_Inference_Matrix', 'l2_business_inference_matrix'],
    ['L2_Inference_Matrix', 'l2_inference_matrix'],
  ];
  for (const [k1, k2] of keyPairs) {
    const m = asRecord(getPropertyCI(rootObj, k1, k2));
    if (m) return m;
  }
  for (const v of Object.values(rootObj)) {
    const o = asRecord(v);
    if (!o) continue;
    for (const [k1, k2] of keyPairs) {
      const innerM = asRecord(getPropertyCI(o, k1, k2));
      if (innerM) return innerM;
    }
  }
  return null;
}

/** 解析 L1 原始串最外层 JSON 对象（供矩阵读取与根级 `Token_Validation_Mapping` 兜底） */
function readL1JsonRootRecord(l1InferenceRaw: string): Record<string, unknown> | null {
  const peeled = peelJsonStringLayers(l1InferenceRaw, 8);
  return asRecord(peeled);
}

/** 与后端 `readL1InferenceMatrixFromRaw` 一致：根上或一层包装内的 L1 矩阵（含 `L1_Entity_Inference_Matrix`）。 */
function readL1InferenceMatrixRecordForProgress(rootObj: Record<string, unknown>): Record<string, unknown> | null {
  const keys = [
    'L1_Entity_Inference_Matrix',
    'l1_entity_inference_matrix',
    'L1_Inference_Matrix',
    'l1_inference_matrix',
    'L1_Inference_Result',
    'l1_inference_result',
  ];
  const direct = asRecord(getPropertyCI(rootObj, ...keys));
  if (direct) return direct;
  for (const v of Object.values(rootObj)) {
    const o = asRecord(v);
    if (!o) continue;
    const innerM = asRecord(getPropertyCI(o, ...keys));
    if (innerM) return innerM;
  }
  return null;
}

/** 自 L1 模型输出解析 **`Token_Validation_Mapping`** 行（供任务 2 对齐问卷 / Consistency 门禁）。 */
export type Task2L1TvmParsedRow = {
  targetFeatureId: string;
  /** 兼容旧逻辑：L1 多为 `Token_Str`；L3/L4 历史解析曾将 `Mapped_L2_Feature` 写入此字段 */
  tokenStr: string;
  /** 客户现状事实（`Token_Str`） */
  clientFactToken: string;
  /** 锚定模型特征（L1/L2：`Mapped_L1_Feature` 或 `Mapped_L2_Feature`；L3+：`Mapped_L3_Feature` 等） */
  anchorModelFeature: string;
  validationLogic: string;
  interviewQuestion: string;
  consistency: string;
};

export function parseTask2L1TokenValidationMappingForAlignment(l1InferenceRaw: string): Task2L1TvmParsedRow[] {
  const root = readL1JsonRootRecord(l1InferenceRaw);
  if (!root) return [];
  const m = readL1InferenceMatrixRecordForProgress(root);
  let rawList: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (!Array.isArray(rawList)) {
    rawList = getPropertyCI(root, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TvmParsedRow[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ?? rec.target_feature_id ?? getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const tokRaw = rec.Token_Str ?? rec.token_str ?? getPropertyCI(rec, 'Token_Str', 'token_str');
    const vLogicRaw =
      rec.Validation_Logic ?? rec.validation_logic ?? getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const iqRaw =
      rec.interview_question ??
      rec.Interview_Question ??
      getPropertyCI(rec, 'interview_question', 'Interview_Question');
    const consRaw = rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    const mappedL1Raw =
      rec.Mapped_L1_Feature ??
      rec.mapped_l1_feature ??
      getPropertyCI(rec, 'Mapped_L1_Feature', 'mapped_l1_feature');
    const mappedL2Raw =
      rec.Mapped_L2_Feature ??
      rec.mapped_l2_feature ??
      getPropertyCI(rec, 'Mapped_L2_Feature', 'mapped_l2_feature');
    const targetFeatureId = typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    const clientFactToken = typeof tokRaw === 'string' ? tokRaw.trim() : String(tokRaw ?? '').trim();
    const pickL1 =
      typeof mappedL1Raw === 'string' ? mappedL1Raw.trim() : String(mappedL1Raw ?? '').trim();
    const pickL2 =
      typeof mappedL2Raw === 'string' ? mappedL2Raw.trim() : String(mappedL2Raw ?? '').trim();
    const anchorModelFeature = pickL1 || pickL2;
    const tokenStr = clientFactToken || anchorModelFeature;
    const validationLogic = typeof vLogicRaw === 'string' ? vLogicRaw.trim() : String(vLogicRaw ?? '').trim();
    const interviewQuestion = typeof iqRaw === 'string' ? iqRaw.trim() : String(iqRaw ?? '').trim();
    const consistency = typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (!targetFeatureId && !tokenStr) continue;
    out.push({
      targetFeatureId,
      tokenStr,
      clientFactToken,
      anchorModelFeature,
      validationLogic,
      interviewQuestion,
      consistency,
    });
  }
  return out;
}

/**
 * 自任务 3 L2 模型输出解析 **`Token_Validation_Mapping`**（**`Mapped_L2_Feature`** 写入 **`anchorModelFeature`**，`Token_Str` 写入 **`clientFactToken`**）。
 */
export function parseTask3L2TokenValidationMappingForAlignment(l2InferenceRaw: string): Task2L1TvmParsedRow[] {
  const root = readL2JsonRootRecordForProgress(l2InferenceRaw);
  if (!root) return [];
  const m = readL2Task3MatrixRecordForProgress(root);
  let rawList: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (!Array.isArray(rawList)) {
    rawList = getPropertyCI(root, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TvmParsedRow[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ?? rec.target_feature_id ?? getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const mappedL2Raw =
      rec.Mapped_L2_Feature ??
      rec.mapped_l2_feature ??
      getPropertyCI(rec, 'Mapped_L2_Feature', 'mapped_l2_feature');
    const tokFallbackRaw =
      rec.Token_Str ?? rec.token_str ?? getPropertyCI(rec, 'Token_Str', 'token_str');
    const pickMapped =
      typeof mappedL2Raw === 'string' ? mappedL2Raw.trim() : String(mappedL2Raw ?? '').trim();
    const pickTokFb =
      typeof tokFallbackRaw === 'string' ? tokFallbackRaw.trim() : String(tokFallbackRaw ?? '').trim();
    const clientFactToken = pickTokFb;
    const anchorModelFeature = pickMapped || pickTokFb;
    const tokenStr = clientFactToken || anchorModelFeature;
    const vLogicRaw =
      rec.Validation_Logic ?? rec.validation_logic ?? getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const iqRaw =
      rec.interview_question ??
      rec.Interview_Question ??
      getPropertyCI(rec, 'interview_question', 'Interview_Question');
    const consRaw = rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    const targetFeatureId = typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    const validationLogic = typeof vLogicRaw === 'string' ? vLogicRaw.trim() : String(vLogicRaw ?? '').trim();
    const interviewQuestion = typeof iqRaw === 'string' ? iqRaw.trim() : String(iqRaw ?? '').trim();
    const consistency = typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (!targetFeatureId && !tokenStr) continue;
    out.push({
      targetFeatureId,
      tokenStr,
      clientFactToken,
      anchorModelFeature,
      validationLogic,
      interviewQuestion,
      consistency,
    });
  }
  return out;
}

/**
 * **Token_Validation_Mapping / `DesignLogicLink.validationConsistency`**：是否应视为「潜在冲突」。
 * 与逻辑树反向边 **红色**、任务 2 对齐门禁统计一致；排除「无潜在冲突」等含子串但语义为否定的情况。
 */
export function isTokenValidationMappingPotentialConflict(consistencyRaw: string): boolean {
  const c0 = String(consistencyRaw ?? '').trim();
  if (!c0) return false;
  if (c0.includes('已确认为痛点')) return false;
  if (
    c0.includes('已通过洞察修正') ||
    c0.includes('已通过纠偏修正') ||
    c0.includes('已通过纠慢修正') ||
    c0.includes('逻辑一致')
  ) {
    return false;
  }
  if (/已通过.{0,3}修正/.test(c0.replace(/\s+/g, '')) && !/潜在冲突/.test(c0)) {
    return false;
  }
  const c = c0.replace(/\s+/g, '');
  if (!c.includes('潜在冲突')) return false;
  if (
    /无潜在冲突|非潜在冲突|没有潜在冲突|不存在潜在冲突|不含潜在冲突|暂无潜在冲突|未现潜在冲突/.test(c)
  ) {
    return false;
  }
  return true;
}

/** 空数组或全部 **非**「潜在冲突」视为已解决（Consistency 缺省视为无冲突）。 */
export function task2L1AllValidationRowsResolved(rows: Task2L1TvmParsedRow[]): boolean {
  for (const r of rows) {
    if (isTokenValidationMappingPotentialConflict(r.consistency)) return false;
  }
  return true;
}

export function task2L1FilterPotentialConflictRows(rows: Task2L1TvmParsedRow[]): Task2L1TvmParsedRow[] {
  return rows.filter((r) => isTokenValidationMappingPotentialConflict(r.consistency));
}

function tokenPathHeadFromTask2FeatureRow(f: Task2L1TaskGraphFeatureRow): string {
  const raw = String(f.tokenDisplay ?? '').trim();
  return raw.includes('·') ? (raw.split(/\s*·\s*/)[0]?.trim() ?? raw) : raw;
}

function defaultMappedL1FeatureKeyFromL1Raw(l1InferenceRaw: string): string {
  const root = readL1JsonRootRecord(l1InferenceRaw);
  const m = root ? readL1InferenceMatrixRecordForProgress(root) : null;
  const kv = m?.Target_KV ?? m?.target_kv;
  if (Array.isArray(kv)) {
    for (const item of kv) {
      const rec = asRecord(item);
      const k = rec?.Feature_Key ?? rec?.feature_key ?? getPropertyCI(rec ?? {}, 'Feature_Key', 'feature_key');
      if (typeof k === 'string' && k.trim()) return k.trim();
    }
  }
  return '合规约束等级';
}

function tvmParsedRowToMappingRecord(row: Task2L1TvmParsedRow): Record<string, unknown> {
  return {
    Target_FeatureID: row.targetFeatureId,
    Token_Str: row.clientFactToken || row.tokenStr,
    Mapped_L1_Feature: row.anchorModelFeature,
    Validation_Logic: row.validationLogic,
    interview_question: row.interviewQuestion,
    Validation_Weight: 1.0,
    Consistency: row.consistency || '逻辑一致',
  };
}

/**
 * 模型漏写 Input 2 **痛点雷达/** 行时，补全 TVM（默认「逻辑一致」+ 说明性 Validation_Logic，便于落库反向边）。
 */
export function supplementTask2L1TvmRowsForMissingPainPointInput2(
  painPointInput2Rows: Task2L1TaskGraphFeatureRow[],
  parsedRows: Task2L1TvmParsedRow[],
  l1InferenceRawForMappedDefault?: string,
): Task2L1TvmParsedRow[] {
  if (!painPointInput2Rows.length) return parsedRows;
  const mappedDefault = l1InferenceRawForMappedDefault
    ? defaultMappedL1FeatureKeyFromL1Raw(l1InferenceRawForMappedDefault)
    : '合规约束等级';
  const seen = new Set(parsedRows.map((r) => String(r.targetFeatureId ?? '').trim()).filter(Boolean));
  const extras: Task2L1TvmParsedRow[] = [];
  for (const f of painPointInput2Rows) {
    const fid = String(f.featureId ?? '').trim();
    if (!fid || seen.has(fid)) continue;
    seen.add(fid);
    const tok = tokenPathHeadFromTask2FeatureRow(f);
    const note =
      '系统补全：模型未输出该痛点雷达/核心痛点总结节点的 Token_Validation_Mapping 行；按任务 2 契约须对 Input 2 全量痛点雷达逐条校验。';
    extras.push({
      targetFeatureId: fid,
      tokenStr: tok,
      clientFactToken: tok,
      anchorModelFeature: mappedDefault,
      validationLogic: note,
      interviewQuestion: 'N/A',
      consistency: '逻辑一致',
    });
  }
  if (!extras.length) return parsedRows;
  return [...parsedRows, ...extras];
}

/** 将补全后的 TVM 写回 L1 JSON，供 `sync-task2-l1-target-kv-tokens` 与进度区展示 */
/** 任务 3/4 TVM 行写回 L2 矩阵 JSON（免疫后 Consistency / interview_question 与落库一致） */
function tvmParsedRowToL2ReverseMappingRecord(row: Task2L1TvmParsedRow): Record<string, unknown> {
  return {
    Target_FeatureID: row.targetFeatureId,
    Token_Str: row.clientFactToken || row.tokenStr,
    Mapped_L2_Feature: row.anchorModelFeature,
    Validation_Logic: row.validationLogic,
    interview_question: row.interviewQuestion || 'N/A',
    Validation_Weight: 0.85,
    Consistency: row.consistency || '逻辑一致',
  };
}

function writeTvmArrayIntoL2MatrixRoot(
  root: Record<string, unknown>,
  matrixReader: (rootObj: Record<string, unknown>) => Record<string, unknown> | null,
  rows: Task2L1TvmParsedRow[],
): void {
  const tvmArr = rows.map((row) => tvmParsedRowToL2ReverseMappingRecord(row));
  const m = matrixReader(root);
  if (m) {
    m.Token_Validation_Mapping = tvmArr;
  } else {
    root.Token_Validation_Mapping = tvmArr;
  }
}

/** 将免疫后的 TVM 写回 `L2_Business_Inference_Matrix` / `L2_Inference_Matrix`，供任务 3 落库与进度展示 */
export function mergeTvmRowsIntoL2BusinessInferenceRaw(
  l2InferenceRaw: string,
  rows: Task2L1TvmParsedRow[],
): string {
  if (!String(l2InferenceRaw ?? '').trim()) return l2InferenceRaw;
  if (!rows.length) {
    const norm = normalizeL2BusinessInferenceRawForServerSync(l2InferenceRaw);
    return norm.ok ? norm.normalized : l2InferenceRaw;
  }
  const root = readL2JsonRootRecordForProgress(l2InferenceRaw);
  if (!root) return l2InferenceRaw;
  writeTvmArrayIntoL2MatrixRoot(root, readL2Task3MatrixRecordForProgress, rows);
  try {
    return JSON.stringify(root, null, 2);
  } catch {
    return l2InferenceRaw;
  }
}

/** 将免疫后的 TVM 写回 `L2_Value_Inference_Matrix`，供任务 4 落库与进度展示 */
export function mergeTvmRowsIntoL2ValueInferenceRaw(
  l2ValueInferenceRaw: string,
  rows: Task2L1TvmParsedRow[],
): string {
  if (!String(l2ValueInferenceRaw ?? '').trim() || !rows.length) return l2ValueInferenceRaw;
  const root = readL2ValueJsonRootRecordForProgress(l2ValueInferenceRaw);
  if (!root) return l2ValueInferenceRaw;
  writeTvmArrayIntoL2MatrixRoot(root, readL2Task4ValueMatrixRecordForProgress, rows);
  try {
    return JSON.stringify(root, null, 2);
  } catch {
    return l2ValueInferenceRaw;
  }
}

export function mergeSupplementedPainPointTvmIntoL1InferenceRaw(
  l1InferenceRaw: string,
  painPointInput2Rows: Task2L1TaskGraphFeatureRow[],
): string {
  if (!String(l1InferenceRaw ?? '').trim() || !painPointInput2Rows.length) return l1InferenceRaw;
  const parsed = parseTask2L1TokenValidationMappingForAlignment(l1InferenceRaw);
  const merged = supplementTask2L1TvmRowsForMissingPainPointInput2(
    painPointInput2Rows,
    parsed,
    l1InferenceRaw,
  );
  if (merged.length <= parsed.length) return l1InferenceRaw;
  const root = readL1JsonRootRecord(l1InferenceRaw);
  if (!root) return l1InferenceRaw;
  const tvmArr = merged.map((row) => tvmParsedRowToMappingRecord(row));
  const m = readL1InferenceMatrixRecordForProgress(root);
  if (m) {
    m.Token_Validation_Mapping = tvmArr;
  } else {
    root.Token_Validation_Mapping = tvmArr;
  }
  try {
    return JSON.stringify(root, null, 2);
  } catch {
    return l1InferenceRaw;
  }
}

/** 任务 2 进度区 TVM 灰块：在模型 JSON 上补全缺失的痛点雷达行后再提取 */
export function buildTask2L1TvmProgressSnippetWithPainPointCoverage(
  l1InferenceRaw: string,
  task1Features: Task2L1TaskGraphFeatureRow[],
  maxChars = 12000,
): string {
  const painRows = listTask2L1PainPointRadarInput2FeatureRows(task1Features);
  const mergedRaw = mergeSupplementedPainPointTvmIntoL1InferenceRaw(l1InferenceRaw, painRows);
  return extractTokenValidationMappingProgressSnippet(mergedRaw, maxChars);
}

export function parseTask2L1TokenValidationMappingWithPainPointCoverage(
  l1InferenceRaw: string,
  task1Features: Task2L1TaskGraphFeatureRow[],
): Task2L1TvmParsedRow[] {
  const painRows = listTask2L1PainPointRadarInput2FeatureRows(task1Features);
  const mergedRaw = mergeSupplementedPainPointTvmIntoL1InferenceRaw(l1InferenceRaw, painRows);
  return parseTask2L1TokenValidationMappingForAlignment(mergedRaw);
}

function featureIdSetForNormGraphTask(
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

function tokenLabelFromGraphFeature(
  f: DesignDetailLogicGraphFeatureDto | null | undefined,
): string {
  const raw = String(f?.tokenDisplay ?? (f as { token_display?: string }).token_display ?? '').trim();
  if (raw) {
    const head = raw.split(/\s*·\s*/)[0]?.trim();
    return head || raw;
  }
  return String(f?.name ?? '').trim();
}

/**
 * 模型 JSON 未解析出 TVM 行、但落库已写入 **潜在冲突** 反向验证边时，从推理图补全门禁行（避免跳过问卷闭环）。
 */
export function mergeSupplementTvmRowsFromReverseValidationLinks(
  parsedRows: Task2L1TvmParsedRow[],
  mergedTasks: DesignDetailLogicGraphTaskDto[],
  sourceNormTaskId: string,
): Task2L1TvmParsedRow[] {
  if (!mergedTasks.length) return parsedRows;
  const sourceFeatureIds = featureIdSetForNormGraphTask(mergedTasks, sourceNormTaskId);
  if (!sourceFeatureIds.size) return parsedRows;
  const t1 = mergedTasks.find((t) => normLogicTaskId(t.taskId) === 'customer_basic');
  const seenTargets = new Set(
    parsedRows.map((r) => String(r.targetFeatureId ?? '').trim()).filter(Boolean),
  );
  const extras: Task2L1TvmParsedRow[] = [];
  for (const link of t1?.links ?? []) {
    if (link.linkKind !== '反向验证') continue;
    const src = String(link.sourceFeatureId ?? link.source?.featureId ?? '').trim();
    const tgt = String(link.targetFeatureId ?? link.target?.featureId ?? '').trim();
    if (!src || !tgt || !sourceFeatureIds.has(src)) continue;
    if (seenTargets.has(tgt)) continue;
    const vc = String(link.validationConsistency ?? '').trim();
    if (!isTokenValidationMappingPotentialConflict(vc)) continue;
    seenTargets.add(tgt);
    const tgtFeat =
      link.target ?? t1?.features?.find((f) => String(f.featureId ?? '').trim() === tgt) ?? null;
    const tokenDisplay = tokenLabelFromGraphFeature(tgtFeat);
    const srcFeat =
      link.source ??
      mergedTasks
        .flatMap((t) => t.features ?? [])
        .find((f) => String(f.featureId ?? '').trim() === src);
    const mappedAnchor = String(srcFeat?.name ?? '').trim();
    extras.push({
      targetFeatureId: tgt,
      tokenStr: tokenDisplay || tgt,
      clientFactToken: tokenDisplay,
      anchorModelFeature: mappedAnchor || tokenDisplay,
      validationLogic: String(link.logic ?? '').trim() || '（由推理图反向验证边补全，待对齐确认）',
      interviewQuestion: '',
      consistency: vc,
    });
  }
  if (!extras.length) return parsedRows;
  return [...parsedRows, ...extras];
}

/** 拼入问卷生成 / 深访合成 **user** 文本（任务 2 L1，L1_L2 字段映射）。 */
export function buildTask2L1ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L1_L2');
}

/** 任务 3 L2：`Mapped_L2_Feature` 作锚定特征（属 L1~L2 原生字段族）。 */
export function buildTask3L2ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L1_L2');
}

export function normalizeLogicGraphTasksFromApiPayload(
  tasks: DesignDetailLogicGraphTaskDto[] | null | undefined,
): DesignDetailLogicGraphTaskDto[] {
  const list = Array.isArray(tasks) ? tasks : [];
  return normalizeLogicGraphTasksAfterFetch(
    dedupeLogicGraphTasksByNormTaskId(mergeCustomerRequirementIntoBasicForLogicGraph(list)),
  );
}

function formatEndpointTokenDisplay(f: DesignDetailLogicGraphFeatureDto | null | undefined): string {
  const raw = String(f?.tokenDisplay ?? f?.token_display ?? '').trim();
  if (raw) {
    const head = raw.split(/\s*·\s*/)[0]?.trim();
    return head || raw;
  }
  const nm = String(f?.name ?? '').trim();
  return nm || '—';
}

function endpointFeatureId(link: DesignDetailLogicGraphLinkDto, end: 'source' | 'target'): string {
  if (end === 'source') {
    return String(link.sourceFeatureId ?? link.source?.featureId ?? '').trim() || '—';
  }
  return String(link.targetFeatureId ?? link.target?.featureId ?? '').trim() || '—';
}

/** 任务进展灰行：`FeatureId，tokenstr → FeatureId，tokenstr` */
export function formatTask2LogicLinkUiLine(link: DesignDetailLogicGraphLinkDto): string {
  const sf = endpointFeatureId(link, 'source');
  const st = formatEndpointTokenDisplay(link.source ?? null);
  const tf = endpointFeatureId(link, 'target');
  const tt = formatEndpointTokenDisplay(link.target ?? null);
  return `${sf}，${st} → ${tf}，${tt}`;
}

export function buildForwardInductionLinkUiLines(merged: DesignDetailLogicGraphTaskDto[]): string[] {
  const t2 = merged.find((t) => String(t.taskId || '').trim() === DESIGN_DETAIL_TASK2_LINE_TASK_ID);
  const links = (t2?.links || []).filter(
    (l) => l.linkKind === '正向归纳' || l.linkKind === 'FORWARD_INDUCTION',
  );
  if (!links.length) return ['（当前推理图中暂无任务 2 正向归纳链接）'];
  return links.map((l) => formatTask2LogicLinkUiLine(l));
}

/** 任务 3 L2 卡上「正向归纳」链接明细（与任务 2 同格式） */
export function buildForwardInductionLinkUiLinesTask3(merged: DesignDetailLogicGraphTaskDto[]): string[] {
  const t3 = merged.find((t) => String(t.taskId || '').trim() === DESIGN_DETAIL_TASK3_LINE_TASK_ID);
  const links = (t3?.links || []).filter(
    (l) => l.linkKind === '正向归纳' || l.linkKind === 'FORWARD_INDUCTION',
  );
  if (!links.length) return ['（当前推理图中暂无任务 3 正向归纳链接）'];
  return links.map((l) => formatTask2LogicLinkUiLine(l));
}

/** 任务 4 L2 卡上「正向归纳」链接明细 */
export function buildForwardInductionLinkUiLinesTask4(merged: DesignDetailLogicGraphTaskDto[]): string[] {
  const t4 = merged.find((t) => String(t.taskId || '').trim() === DESIGN_DETAIL_TASK4_LINE_TASK_ID);
  const links = (t4?.links || []).filter(
    (l) => l.linkKind === '正向归纳' || l.linkKind === 'FORWARD_INDUCTION',
  );
  if (!links.length) return ['（当前推理图中暂无任务 4 正向归纳链接）'];
  return links.map((l) => formatTask2LogicLinkUiLine(l));
}

/** 任务 5 L3 卡上「正向归纳」链接明细 */
export function buildForwardInductionLinkUiLinesTask5(merged: DesignDetailLogicGraphTaskDto[]): string[] {
  const t5 = merged.find((t) => String(t.taskId || '').trim() === DESIGN_DETAIL_TASK5_LINE_TASK_ID);
  const links = (t5?.links || []).filter(
    (l) => l.linkKind === '正向归纳' || l.linkKind === 'FORWARD_INDUCTION',
  );
  if (!links.length) return ['（当前推理图中暂无任务 5 正向归纳链接）'];
  return links.map((l) => formatTask2LogicLinkUiLine(l));
}

/** 任务 5.5 L3.5 卡上「正向归纳」链接明细（含跨任务：任务 5 宏观 → 本步 VSM 阶段，边归入目标侧任务 5.5 桶） */
/** 任务 6 L3 卡上「正向归纳」链接明细 */
export function buildForwardInductionLinkUiLinesTask6(merged: DesignDetailLogicGraphTaskDto[]): string[] {
  const t6 = merged.find((t) => normLogicTaskId(t.taskId) === 'pain_point_extraction');
  const links = (t6?.links || []).filter(
    (l) => l.linkKind === '正向归纳' || l.linkKind === 'FORWARD_INDUCTION',
  );
  if (!links.length) {
    return [
      '（当前推理图中暂无任务 6 正向归纳链接；请确认模型 Evidence_Support_Chain 已对齐任务 5.5 VSM 阶段与任务 1 痛点 FeatureID）',
    ];
  }
  return links.map((l) => formatTask2LogicLinkUiLine(l));
}

export function buildForwardInductionLinkUiLinesTask55(merged: DesignDetailLogicGraphTaskDto[]): string[] {
  const t55 = merged.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK55_LINE_TASK_ID);
  const links = (t55?.links || []).filter(
    (l) => l.linkKind === '正向归纳' || l.linkKind === 'FORWARD_INDUCTION',
  );
  if (!links.length) {
    return [
      '（当前推理图中暂无任务 5.5 正向归纳链接；常见原因：模型未按契约填写 Evidence_Support_Chain，或 FeatureID 未对齐任务 5 宏观 Feature_Key，后端会 skip_logic_link_unknown_source）',
    ];
  }
  return links.map((l) => formatTask2LogicLinkUiLine(l));
}

/** 任务 5.1 L3.1 卡上「正向归纳」链接明细 */
export function buildForwardInductionLinkUiLinesTask51(merged: DesignDetailLogicGraphTaskDto[]): string[] {
  const t51 = merged.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK51_LINE_TASK_ID);
  const links = (t51?.links || []).filter(
    (l) => l.linkKind === '正向归纳' || l.linkKind === 'FORWARD_INDUCTION',
  );
  if (!links.length) {
    return [
      '（当前推理图中暂无任务 5.1 正向归纳链接；常见原因：Evidence 中 FeatureID 非本案例 ft_ 主键、链为空，或后端未 build 含任务 5.1 上游解析补丁——请对本线步「重启当前」重跑 sync）',
    ];
  }
  return links.map((l) => formatTask2LogicLinkUiLine(l));
}

function readL3ProcessJsonRootRecordForProgress(l3ProcessInferenceRaw: string): Record<string, unknown> | null {
  return readL2JsonRootRecordForProgress(l3ProcessInferenceRaw);
}

function readL3Task5ProcessMatrixRecordForProgress(rootObj: Record<string, unknown>): Record<string, unknown> | null {
  const l3Feature = asRecord(
    getPropertyCI(rootObj, 'L3_Process_Feature_Matrix', 'l3_process_feature_matrix'),
  );
  if (l3Feature) return l3Feature;
  const l3Vsm55 = asRecord(
    getPropertyCI(rootObj, 'L3_5_VSM_Inference_Matrix', 'l3_5_vsm_inference_matrix'),
  );
  if (l3Vsm55) return l3Vsm55;
  const l3 = asRecord(getPropertyCI(rootObj, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'));
  if (l3) return l3;
  for (const v of Object.values(rootObj)) {
    const o = asRecord(v);
    if (!o) continue;
    const innerFeature = asRecord(
      getPropertyCI(o, 'L3_Process_Feature_Matrix', 'l3_process_feature_matrix'),
    );
    if (innerFeature) return innerFeature;
    const innerVsm55 = asRecord(
      getPropertyCI(o, 'L3_5_VSM_Inference_Matrix', 'l3_5_vsm_inference_matrix'),
    );
    if (innerVsm55) return innerVsm55;
    const innerL3 = asRecord(getPropertyCI(o, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'));
    if (innerL3) return innerL3;
  }
  const tk = getPropertyCI(rootObj, 'Target_KV', 'target_kv', 'Target_kv');
  if (Array.isArray(tk) && tk.length > 0) return rootObj;
  return null;
}

/** 任务 5 sync 前规范 L3 JSON（与后端 `normalizeL3ProcessInferenceRawForServerSync` 口径一致） */
function readL3Task6ScenarioMatrixRecordForProgress(rootObj: Record<string, unknown>): Record<string, unknown> | null {
  const l3Scenario = asRecord(
    getPropertyCI(rootObj, 'L3_Scenario_Inference_Matrix', 'l3_scenario_inference_matrix'),
  );
  if (l3Scenario) return l3Scenario;
  for (const v of Object.values(rootObj)) {
    const o = asRecord(v);
    if (!o) continue;
    const inner = asRecord(
      getPropertyCI(o, 'L3_Scenario_Inference_Matrix', 'l3_scenario_inference_matrix'),
    );
    if (inner) return inner;
  }
  const tk = getPropertyCI(rootObj, 'Target_KV', 'target_kv', 'Target_kv');
  if (Array.isArray(tk) && tk.length > 0) return rootObj;
  return null;
}

function task6TargetKvDedupKeyFromItem(item: unknown): string | null {
  const row = asRecord(item);
  if (!row) return null;
  const fv = row.Feature_Value ?? row.feature_value ?? row.featureValue;
  let parsed: Record<string, unknown> | null = null;
  if (fv != null && typeof fv === 'object' && !Array.isArray(fv)) {
    parsed = fv as Record<string, unknown>;
  } else if (typeof fv === 'string') {
    try {
      const inner = JSON.parse(fv);
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        parsed = inner as Record<string, unknown>;
      }
    } catch {
      /* 非 JSON 字符串 */
    }
  }
  if (parsed) {
    const sn = String(parsed.scenario_name ?? '').trim();
    const phase = String(parsed.targeted_value_phase ?? '').trim();
    const pp = asRecord(parsed.associated_pain_point);
    const ppId = String(pp?.pain_point_feature_id ?? '').trim();
    if (sn || phase || ppId) return `${phase}::${sn}::${ppId}`;
  }
  const legacy = String(fv ?? row.Feature_Value ?? '').trim();
  if (legacy) return `legacy::${legacy.slice(0, 240)}`;
  return null;
}

/** 合并多价值流阶段循环推理的 L3_Scenario_Inference_Matrix（去重 Target_KV / TVM）后供 sync */
export function mergeL6ScenarioInferenceRawOutputsForServerSync(
  raws: string[],
): { ok: true; normalized: string } | { ok: false; message: string } {
  const mergedTargetKv: unknown[] = [];
  const mergedTvm: unknown[] = [];
  const seenKv = new Set<string>();
  const seenTvm = new Set<string>();

  for (let i = 0; i < raws.length; i++) {
    const norm = normalizeL6ScenarioInferenceRawForServerSync(raws[i] ?? '');
    if (!norm.ok) {
      return { ok: false, message: `第 ${i + 1} 个价值流阶段模型输出无法规范化：${norm.message}` };
    }
    let matrix: Record<string, unknown>;
    try {
      const obj = JSON.parse(norm.normalized) as Record<string, unknown>;
      matrix = asRecord(obj.L3_Scenario_Inference_Matrix) ?? {};
    } catch {
      return { ok: false, message: `第 ${i + 1} 个价值流阶段合并 JSON 解析失败` };
    }
    const tk = matrix.Target_KV ?? matrix.target_kv;
    if (Array.isArray(tk)) {
      for (const item of tk) {
        const dedup = task6TargetKvDedupKeyFromItem(item);
        if (!dedup || seenKv.has(dedup)) continue;
        seenKv.add(dedup);
        mergedTargetKv.push(item);
      }
    }
    const tvm = matrix.Token_Validation_Mapping ?? matrix.token_validation_mapping;
    if (Array.isArray(tvm)) {
      for (const item of tvm) {
        const row = asRecord(item);
        const id = String(row?.Target_FeatureID ?? row?.target_feature_id ?? '').trim();
        const tvmKey = id || JSON.stringify(item);
        if (seenTvm.has(tvmKey)) continue;
        seenTvm.add(tvmKey);
        mergedTvm.push(item);
      }
    }
  }

  if (!mergedTargetKv.length) {
    return {
      ok: false,
      message: '合并后 Target_KV 为空；请确认各价值流阶段均输出 Feature_Key=「关键场景」',
    };
  }
  try {
    const payload: Record<string, unknown> = { Target_KV: mergedTargetKv };
    if (mergedTvm.length) payload.Token_Validation_Mapping = mergedTvm;
    return {
      ok: true,
      normalized: JSON.stringify({ L3_Scenario_Inference_Matrix: payload }),
    };
  } catch {
    return { ok: false, message: '合并结果 JSON 序列化失败' };
  }
}

/** 任务 6 sync 前规范 L3 Scenario JSON */
export function normalizeL6ScenarioInferenceRawForServerSync(
  l3ScenarioInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3ScenarioInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL3ProcessJsonRootRecordForProgress(raw);
  if (!root) return { ok: false, message: 'JSON 解析失败' };
  const matrix = readL3Task6ScenarioMatrixRecordForProgress(root);
  if (!matrix) {
    return { ok: false, message: '未找到 L3_Scenario_Inference_Matrix 或非空 Target_KV' };
  }
  const tkInMatrix = getPropertyCI(matrix, 'Target_KV', 'target_kv', 'Target_kv');
  if (!Array.isArray(tkInMatrix) || tkInMatrix.length === 0) {
    return { ok: false, message: 'L3_Scenario_Inference_Matrix 内 Target_KV 为空' };
  }
  const hasScenarioMatrix = !!asRecord(
    getPropertyCI(root, 'L3_Scenario_Inference_Matrix', 'l3_scenario_inference_matrix'),
  );
  const payload = hasScenarioMatrix ? root : { L3_Scenario_Inference_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

function readL3Task65ItGapMatrixRecordForProgress(rootObj: Record<string, unknown>): Record<string, unknown> | null {
  const direct = asRecord(
    getPropertyCI(rootObj, 'L3_IT_Gap_Analysis_Matrix', 'l3_it_gap_analysis_matrix'),
  );
  if (direct) return direct;
  for (const v of Object.values(rootObj)) {
    const o = asRecord(v);
    if (!o) continue;
    const inner = asRecord(
      getPropertyCI(o, 'L3_IT_Gap_Analysis_Matrix', 'l3_it_gap_analysis_matrix'),
    );
    if (inner) return inner;
  }
  const tk = getPropertyCI(rootObj, 'Target_KV', 'target_kv', 'Target_kv');
  if (Array.isArray(tk) && tk.length > 0) return rootObj;
  return null;
}

function task65TargetKvDedupKeyFromItem(item: unknown): string | null {
  const row = asRecord(item);
  if (!row) return null;
  const fv = row.Feature_Value ?? row.feature_value ?? row.featureValue;
  let parsed: Record<string, unknown> | null = null;
  if (fv != null && typeof fv === 'object' && !Array.isArray(fv)) {
    parsed = fv as Record<string, unknown>;
  } else if (typeof fv === 'string') {
    try {
      const inner = JSON.parse(fv);
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        parsed = inner as Record<string, unknown>;
      }
    } catch {
      /* 非 JSON */
    }
  }
  if (parsed) {
    const wf = String(parsed.optimized_workflow_segment ?? '').trim();
    const step = String(parsed.current_process_step_name ?? '').trim();
    if (wf || step) return `${wf}::${step}`;
  }
  try {
    return JSON.stringify(fv).slice(0, 240);
  } catch {
    return null;
  }
}

/** 合并多流程环节 IT-Gap 子任务推理结果后供 sync */
export function mergeL65ItGapInferenceRawOutputsForServerSync(
  raws: string[],
): { ok: true; normalized: string } | { ok: false; message: string } {
  const mergedTargetKv: unknown[] = [];
  const mergedTvm: unknown[] = [];
  const seenKv = new Set<string>();
  const seenTvm = new Set<string>();

  for (let i = 0; i < raws.length; i++) {
    const norm = normalizeL65ItGapInferenceRawForServerSync(raws[i] ?? '');
    if (!norm.ok) {
      return { ok: false, message: `第 ${i + 1} 个 IT-Gap 子任务模型输出无法规范化：${norm.message}` };
    }
    let matrix: Record<string, unknown>;
    try {
      const obj = JSON.parse(norm.normalized) as Record<string, unknown>;
      matrix = asRecord(obj.L3_IT_Gap_Analysis_Matrix) ?? asRecord(obj.l3_it_gap_analysis_matrix) ?? {};
    } catch {
      return { ok: false, message: `第 ${i + 1} 个 IT-Gap 子任务合并 JSON 解析失败` };
    }
    const tk = matrix.Target_KV ?? matrix.target_kv;
    if (Array.isArray(tk)) {
      for (const item of tk) {
        const dedup = task65TargetKvDedupKeyFromItem(item);
        if (!dedup || seenKv.has(dedup)) continue;
        seenKv.add(dedup);
        mergedTargetKv.push(item);
      }
    }
    const tvm = matrix.Token_Validation_Mapping ?? matrix.token_validation_mapping;
    if (Array.isArray(tvm)) {
      for (const item of tvm) {
        const row = asRecord(item);
        const id = String(row?.Target_FeatureID ?? row?.target_feature_id ?? '').trim();
        const tvmKey = id || JSON.stringify(item);
        if (seenTvm.has(tvmKey)) continue;
        seenTvm.add(tvmKey);
        mergedTvm.push(item);
      }
    }
  }

  if (!mergedTargetKv.length) {
    return {
      ok: false,
      message: '合并后 Target_KV 为空；请确认各流程环节均输出 Feature_Key=「流程优化Gap方案」',
    };
  }
  try {
    const payload: Record<string, unknown> = { Target_KV: mergedTargetKv };
    if (mergedTvm.length) payload.Token_Validation_Mapping = mergedTvm;
    return {
      ok: true,
      normalized: JSON.stringify({ L3_IT_Gap_Analysis_Matrix: payload }),
    };
  } catch {
    return { ok: false, message: '合并结果 JSON 序列化失败' };
  }
}

/** 任务 6.5 sync 前规范 L3 IT-Gap JSON */
export function normalizeL65ItGapInferenceRawForServerSync(
  l3ItGapInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3ItGapInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL3ProcessJsonRootRecordForProgress(raw);
  if (!root) return { ok: false, message: 'JSON 解析失败' };
  const matrix = readL3Task65ItGapMatrixRecordForProgress(root);
  if (!matrix) {
    return { ok: false, message: '未找到 L3_IT_Gap_Analysis_Matrix 或非空 Target_KV' };
  }
  const tkInMatrix = getPropertyCI(matrix, 'Target_KV', 'target_kv', 'Target_kv');
  if (!Array.isArray(tkInMatrix) || tkInMatrix.length === 0) {
    return { ok: false, message: 'L3_IT_Gap_Analysis_Matrix 内 Target_KV 为空' };
  }
  const hasMatrix = !!asRecord(
    getPropertyCI(root, 'L3_IT_Gap_Analysis_Matrix', 'l3_it_gap_analysis_matrix'),
  );
  const payload = hasMatrix ? root : { L3_IT_Gap_Analysis_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

function readL4Task7CollaborationMatrixRecordForProgress(rootObj: Record<string, unknown>): Record<string, unknown> | null {
  const l4Form = asRecord(getPropertyCI(rootObj, 'L4_Form_Layout_Matrix', 'l4_form_layout_matrix'));
  if (l4Form) return l4Form;
  const l4 = asRecord(
    getPropertyCI(rootObj, 'L4_Collaboration_Inference_Matrix', 'l4_collaboration_inference_matrix'),
  );
  if (l4) return l4;
  for (const v of Object.values(rootObj)) {
    const o = asRecord(v);
    if (!o) continue;
    const innerForm = asRecord(getPropertyCI(o, 'L4_Form_Layout_Matrix', 'l4_form_layout_matrix'));
    if (innerForm) return innerForm;
    const inner = asRecord(
      getPropertyCI(o, 'L4_Collaboration_Inference_Matrix', 'l4_collaboration_inference_matrix'),
    );
    if (inner) return inner;
  }
  const tk = getPropertyCI(rootObj, 'Target_KV', 'target_kv', 'Target_kv');
  if (Array.isArray(tk) && tk.length > 0) return rootObj;
  return null;
}

function task7TargetKvDedupKeyFromItem(item: unknown): string {
  const row = asRecord(item);
  if (!row) return '';
  const fv = row.Feature_Value ?? row.feature_value;
  if (typeof fv === 'object' && fv && !Array.isArray(fv)) {
    const step = String(
      (fv as Record<string, unknown>).current_process_step_name ??
        (fv as Record<string, unknown>).Current_Process_Step_Name ??
        '',
    ).trim();
    if (step) return `协作节点\t${step}`;
  }
  if (typeof fv === 'string') {
    const s = fv.trim();
    if (s.startsWith('{')) {
      try {
        const parsed = JSON.parse(s) as Record<string, unknown>;
        const step = String(parsed.current_process_step_name ?? parsed.Current_Process_Step_Name ?? '').trim();
        if (step) return `协作节点\t${step}`;
      } catch {
        /* legacy string */
      }
    }
    return `协作节点\t${s}`;
  }
  return '';
}

/** 多环节 L4 模型输出合并为单份 `L4_Form_Layout_Matrix` */
export function mergeL4FormLayoutInferenceRawOutputsForServerSync(
  raws: string[],
): { ok: true; normalized: string } | { ok: false; message: string } {
  const mergedTargetKv: unknown[] = [];
  const mergedTvm: unknown[] = [];
  const seenKv = new Set<string>();
  const seenTvm = new Set<string>();

  for (let i = 0; i < raws.length; i++) {
    const norm = normalizeL4CollaborationInferenceRawForServerSync(raws[i] ?? '');
    if (!norm.ok) {
      return { ok: false, message: `第 ${i + 1} 个 L4 子任务模型输出无法规范化：${norm.message}` };
    }
    let matrix: Record<string, unknown>;
    try {
      const obj = JSON.parse(norm.normalized) as Record<string, unknown>;
      matrix =
        asRecord(obj.L4_Form_Layout_Matrix) ??
        asRecord(obj.l4_form_layout_matrix) ??
        asRecord(obj.L4_Collaboration_Inference_Matrix) ??
        asRecord(obj.l4_collaboration_inference_matrix) ??
        {};
    } catch {
      return { ok: false, message: `第 ${i + 1} 个 L4 子任务合并 JSON 解析失败` };
    }
    const tk = matrix.Target_KV ?? matrix.target_kv;
    if (Array.isArray(tk)) {
      for (const item of tk) {
        const dedup = task7TargetKvDedupKeyFromItem(item);
        if (!dedup || seenKv.has(dedup)) continue;
        seenKv.add(dedup);
        mergedTargetKv.push(item);
      }
    }
    const tvm = matrix.Token_Validation_Mapping ?? matrix.token_validation_mapping;
    if (Array.isArray(tvm)) {
      for (const item of tvm) {
        const row = asRecord(item);
        const id = String(row?.Target_FeatureID ?? row?.target_feature_id ?? '').trim();
        const tvmKey = id || JSON.stringify(item);
        if (seenTvm.has(tvmKey)) continue;
        seenTvm.add(tvmKey);
        mergedTvm.push(item);
      }
    }
  }

  if (!mergedTargetKv.length) {
    return {
      ok: false,
      message: '合并后 Target_KV 为空；请确认各流程环节均输出 Feature_Key=「协作节点」',
    };
  }
  try {
    const payload: Record<string, unknown> = { Target_KV: mergedTargetKv };
    if (mergedTvm.length) payload.Token_Validation_Mapping = mergedTvm;
    return {
      ok: true,
      normalized: JSON.stringify({ L4_Form_Layout_Matrix: payload }),
    };
  } catch {
    return { ok: false, message: '合并结果 JSON 序列化失败' };
  }
}

/** 任务 7 sync 前规范 L4 JSON */
export function normalizeL4CollaborationInferenceRawForServerSync(
  l4CollaborationInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l4CollaborationInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL3ProcessJsonRootRecordForProgress(raw);
  if (!root) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 7 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const matrix = readL4Task7CollaborationMatrixRecordForProgress(root);
  if (!matrix) {
    return {
      ok: false,
      message: '未找到 L4_Form_Layout_Matrix / L4_Collaboration_Inference_Matrix 或非空 Target_KV',
    };
  }
  const tkInMatrix = getPropertyCI(matrix, 'Target_KV', 'target_kv', 'Target_kv');
  if (!Array.isArray(tkInMatrix) || tkInMatrix.length === 0) {
    return { ok: false, message: 'L4_Form_Layout_Matrix 内 Target_KV 为空' };
  }
  const hasL4Matrix =
    !!asRecord(getPropertyCI(root, 'L4_Form_Layout_Matrix', 'l4_form_layout_matrix')) ||
    !!asRecord(
      getPropertyCI(root, 'L4_Collaboration_Inference_Matrix', 'l4_collaboration_inference_matrix'),
    );
  const payload = hasL4Matrix
    ? root
    : asRecord(getPropertyCI(matrix, 'L4_Form_Layout_Matrix', 'l4_form_layout_matrix'))
      ? { L4_Form_Layout_Matrix: matrix }
      : { L4_Collaboration_Inference_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

function readL4Task8PrototypeMatrixRecordForProgress(rootObj: Record<string, unknown>): Record<string, unknown> | null {
  const l4 =
    asRecord(getPropertyCI(rootObj, 'L4_5_Prototype_Detail_Matrix', 'l4_5_prototype_detail_matrix')) ??
    asRecord(getPropertyCI(rootObj, 'L4_Prototype_Inference_Matrix', 'l4_prototype_inference_matrix'));
  if (l4) return l4;
  for (const v of Object.values(rootObj)) {
    const o = asRecord(v);
    if (!o) continue;
    const inner =
      asRecord(getPropertyCI(o, 'L4_5_Prototype_Detail_Matrix', 'l4_5_prototype_detail_matrix')) ??
      asRecord(getPropertyCI(o, 'L4_Prototype_Inference_Matrix', 'l4_prototype_inference_matrix'));
    if (inner) return inner;
  }
  const tk = getPropertyCI(rootObj, 'Target_KV', 'target_kv', 'Target_kv');
  if (Array.isArray(tk) && tk.length > 0) return rootObj;
  return null;
}

/** 任务 8 sync 前规范 L4.5 Prototype JSON */
export function normalizeL4PrototypeInferenceRawForServerSync(
  l4PrototypeInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l4PrototypeInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL3ProcessJsonRootRecordForProgress(raw);
  if (!root) return { ok: false, message: 'JSON 解析失败' };
  const matrix = readL4Task8PrototypeMatrixRecordForProgress(root);
  if (!matrix) {
    return { ok: false, message: '未找到 L4_5_Prototype_Detail_Matrix 或非空 Target_KV' };
  }
  const tkInMatrix = getPropertyCI(matrix, 'Target_KV', 'target_kv', 'Target_kv');
  if (!Array.isArray(tkInMatrix) || tkInMatrix.length === 0) {
    return { ok: false, message: 'L4_5_Prototype_Detail_Matrix 内 Target_KV 为空' };
  }
  const hasL45 = !!asRecord(
    getPropertyCI(root, 'L4_5_Prototype_Detail_Matrix', 'l4_5_prototype_detail_matrix'),
  );
  const hasLegacy = !!asRecord(
    getPropertyCI(root, 'L4_Prototype_Inference_Matrix', 'l4_prototype_inference_matrix'),
  );
  const payload = hasL45 || hasLegacy ? root : { L4_5_Prototype_Detail_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

const TASK85_L47_FEATURE_KEY_FALLBACK_ORDER = [
  '界面交互层',
  '数据承载层',
  '衔接互动层',
  '技术组件映射',
  '自动化流Hook',
  '前端交互载体',
  '物理外挂Hook',
  '微观连接器绑定',
  '工具方案裁决',
] as const;

function canonicalizeTask85FeatureKeyForProgress(raw: string): string | null {
  let k = stripBom(String(raw ?? '').trim());
  try {
    k = k.normalize('NFKC');
  } catch {
    /* ignore */
  }
  k = k.replace(/\s+/g, '');
  for (const c of TASK85_L47_FEATURE_KEY_FALLBACK_ORDER) {
    const cn = stripBom(String(c).trim())
      .normalize('NFKC')
      .replace(/\s+/g, '');
    if (cn === k) return c;
  }
  return null;
}

function featureKeyFromRowForTask85Progress(row: Record<string, unknown>): string | null {
  let v: unknown =
    row.Feature_Key ??
    row.feature_key ??
    getPropertyCI(row, 'Feature_Key', 'feature_key', 'Feature Key');
  if (v === undefined) {
    for (const [k, val] of Object.entries(row)) {
      if (k.replace(/\s+/g, '_').toLowerCase() === 'feature_key') {
        v = val;
        break;
      }
    }
  }
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function expandTask85TargetKvMaybeStringifiedRowsForProgress(rows: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const item of rows) {
    if (typeof item === 'string') {
      const t = stripBom(item.trim());
      if (!t.length) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(t);
      } catch {
        continue;
      }
      if (Array.isArray(parsed)) {
        for (const x of parsed) out.push(x);
        continue;
      }
      const r = asRecord(parsed);
      if (r) {
        out.push(r);
        continue;
      }
      continue;
    }
    out.push(item);
  }
  return out;
}

function finalizeTask85TargetKvRowsForProgress(rows: unknown[] | null): unknown[] | null {
  if (!rows?.length) return null;
  const ex = expandTask85TargetKvMaybeStringifiedRowsForProgress(rows);
  return ex.length ? ex : null;
}

/** 读取或从误置层级子键补齐 Target_KV（与后端 `readTask85L475TargetKvFromMatrix` 语义对齐） */
function readTask85TargetKvRowsForProgress(matrix: Record<string, unknown>): unknown[] | null {
  const tk = getPropertyCI(matrix, 'Target_KV', 'target_kv', 'Target_kv');
  if (Array.isArray(tk) && tk.length > 0) {
    const fin = finalizeTask85TargetKvRowsForProgress(tk);
    if (fin?.length) return fin;
  }

  const synthesized: unknown[] = [];
  for (const lk of TASK85_L47_FEATURE_KEY_FALLBACK_ORDER) {
    const rawProp = matrix[lk] ?? getPropertyCI(matrix, lk);
    if (rawProp == null || rawProp === undefined) continue;

    if (typeof rawProp === 'string') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripBom(String(rawProp).trim()));
      } catch {
        continue;
      }
      const parsedRec = asRecord(parsed);
      if (parsedRec) {
        const inner = featureKeyFromRowForTask85Progress(parsedRec);
        const fk = inner !== null ? canonicalizeTask85FeatureKeyForProgress(inner) ?? lk : lk;
        synthesized.push({ ...parsedRec, Feature_Key: fk });
      }
      continue;
    }

    if (Array.isArray(rawProp)) {
      for (const el of rawProp) {
        const r =
          typeof el === 'string'
            ? ((): Record<string, unknown> | null => {
                try {
                  return asRecord(JSON.parse(stripBom(String(el).trim())) as unknown);
                } catch {
                  return null;
                }
              })()
            : asRecord(el);
        if (!r) continue;
        const inner = featureKeyFromRowForTask85Progress(r);
        const fk = inner !== null ? canonicalizeTask85FeatureKeyForProgress(inner) ?? lk : lk;
        synthesized.push({ ...r, Feature_Key: fk });
      }
      continue;
    }
    const r = asRecord(rawProp);
    if (!r) continue;
    const inner = featureKeyFromRowForTask85Progress(r);
    const fk = inner !== null ? canonicalizeTask85FeatureKeyForProgress(inner) ?? lk : lk;
    synthesized.push({ ...r, Feature_Key: fk });
  }
  return finalizeTask85TargetKvRowsForProgress(synthesized.length ? synthesized : null);
}

function readL475Task85PhysicalHookMatrixRecordForProgress(root: Record<string, unknown>): Record<string, unknown> | null {
  const direct =
    asRecord(getPropertyCI(root, 'L4_7_Tech_Integration_Matrix', 'l4_7_tech_integration_matrix')) ??
    asRecord(
      getPropertyCI(root, 'L4_75_Physical_Hook_Integration_Matrix', 'l4_75_physical_hook_integration_matrix'),
    );
  if (direct) {
    const tk = readTask85TargetKvRowsForProgress(direct);
    if (tk && tk.length > 0) return { ...direct, Target_KV: tk };
  }
  const tkTop = getPropertyCI(root, 'Target_KV', 'target_kv', 'Target_kv');
  if (Array.isArray(tkTop) && tkTop.length > 0) {
    const finTop = finalizeTask85TargetKvRowsForProgress(tkTop);
    if (finTop?.length) return { ...root, Target_KV: finTop };
  }
  return null;
}

/** 任务 8.5 sync 前规范 L4.7 技术集成 JSON */
export function normalizeL475PhysicalHookInferenceRawForServerSync(
  l475PhysicalHookInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l475PhysicalHookInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL3ProcessJsonRootRecordForProgress(raw);
  if (!root) return { ok: false, message: 'JSON 解析失败' };
  const matrixFromRead = readL475Task85PhysicalHookMatrixRecordForProgress(root);
  if (!matrixFromRead) {
    return {
      ok: false,
      message:
        '未找到 L4_7_Tech_Integration_Matrix / L4_75_Physical_Hook_Integration_Matrix / 或可合并为 Target_KV 的层级子键',
    };
  }
  const targetKvRows = readTask85TargetKvRowsForProgress(matrixFromRead);
  if (!targetKvRows?.length) {
    return {
      ok: false,
      message:
        '未找到非空 Target_KV（若为误把契约三键写成矩阵子属性，请将行并入 Target_KV 数组后再试）',
    };
  }
  const mergedMatrix = { ...matrixFromRead, Target_KV: targetKvRows };
  const hasL47 = !!asRecord(getPropertyCI(root, 'L4_7_Tech_Integration_Matrix', 'l4_7_tech_integration_matrix'));
  const hasL475 = !!asRecord(
    getPropertyCI(root, 'L4_75_Physical_Hook_Integration_Matrix', 'l4_75_physical_hook_integration_matrix'),
  );
  const payload =
    hasL47 || hasL475
      ? {
          ...root,
          [hasL47 ? 'L4_7_Tech_Integration_Matrix' : 'L4_75_Physical_Hook_Integration_Matrix']: mergedMatrix,
        }
      : { L4_7_Tech_Integration_Matrix: mergedMatrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

export function extractTask7L4TokenValidationMappingProgressSnippet(
  l4CollaborationInferenceRaw: string,
  maxChars = 12000,
): string {
  const rootObj = readL3ProcessJsonRootRecordForProgress(l4CollaborationInferenceRaw);
  if (!rootObj) return '（未能从模型输出中解析 JSON 根对象）';
  let m = readL4Task7CollaborationMatrixRecordForProgress(rootObj);
  let tv: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (tv === undefined || tv === null) {
    tv = getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (tv === undefined || tv === null) {
    return '（本段输出中未找到 Token_Validation_Mapping 字段；任务 7 契约允许为空数组）';
  }
  try {
    const s = JSON.stringify(tv, null, 2);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}\n\n…（以下已截断）`;
  } catch {
    return String(tv);
  }
}

/** 任务 7 L4 卡上「正向归纳」链接明细 */
export function buildForwardInductionLinkUiLinesTask7(merged: DesignDetailLogicGraphTaskDto[]): string[] {
  const t7 = merged.find((t) => normLogicTaskId(t.taskId) === 'key_requirement_scenarios');
  const links = (t7?.links || []).filter(
    (l) => l.linkKind === '正向归纳' || l.linkKind === 'FORWARD_INDUCTION',
  );
  if (!links.length) {
    return [
      '（当前推理图中暂无任务 7 正向归纳链接；请确认 Evidence_Support_Chain 已对齐任务 6 关键场景与任务 1 FeatureID）',
    ];
  }
  return links.map((l) => formatTask2LogicLinkUiLine(l));
}

function readL5Task9BlueprintMatrixRecordForProgress(
  root: Record<string, unknown>,
): Record<string, unknown> | null {
  for (const [k1, k2] of [
    ['L5_Blueprint_Domain_Matrix', 'l5_blueprint_domain_matrix'],
    ['L5_Blueprint_Container_Matrix', 'l5_blueprint_container_matrix'],
  ] as const) {
    const direct = asRecord(getPropertyCI(root, k1, k2));
    if (direct) return direct;
  }
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    for (const [k1, k2] of [
      ['L5_Blueprint_Domain_Matrix', 'l5_blueprint_domain_matrix'],
      ['L5_Blueprint_Container_Matrix', 'l5_blueprint_container_matrix'],
    ] as const) {
      const inner = asRecord(getPropertyCI(o, k1, k2));
      if (inner) return inner;
    }
  }
  const tk = getPropertyCI(root, 'Target_KV', 'target_kv', 'Target_kv');
  if (Array.isArray(tk) && tk.length > 0) return root;
  return null;
}

/** 任务 9 sync 前规范 L5 Blueprint JSON */
export function normalizeL5BlueprintInferenceRawForServerSync(
  l5BlueprintInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l5BlueprintInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL3ProcessJsonRootRecordForProgress(raw);
  if (!root) return { ok: false, message: 'JSON 解析失败' };
  const matrix = readL5Task9BlueprintMatrixRecordForProgress(root);
  if (!matrix) {
    return { ok: false, message: '未找到 L5_Blueprint_Domain_Matrix 或非空 Target_KV' };
  }
  const tkInMatrix = getPropertyCI(matrix, 'Target_KV', 'target_kv', 'Target_kv');
  if (!Array.isArray(tkInMatrix) || tkInMatrix.length === 0) {
    return { ok: false, message: 'L5_Blueprint_Domain_Matrix 内 Target_KV 为空' };
  }
  const hasMatrix = !!(
    asRecord(getPropertyCI(root, 'L5_Blueprint_Domain_Matrix', 'l5_blueprint_domain_matrix')) ||
    asRecord(getPropertyCI(root, 'L5_Blueprint_Container_Matrix', 'l5_blueprint_container_matrix'))
  );
  const domainMatrix = asRecord(getPropertyCI(root, 'L5_Blueprint_Domain_Matrix', 'l5_blueprint_domain_matrix'));
  const payload = hasMatrix
    ? root
    : domainMatrix
      ? { L5_Blueprint_Domain_Matrix: matrix }
      : { L5_Blueprint_Container_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/** 任务 8 卡上「正向归纳」链接明细 */
export function buildForwardInductionLinkUiLinesTask8(merged: DesignDetailLogicGraphTaskDto[]): string[] {
  const t8 = merged.find((t) => normLogicTaskId(t.taskId) === 'role_object_stm_inference');
  const links = (t8?.links || []).filter(
    (l) => l.linkKind === '正向归纳' || l.linkKind === 'FORWARD_INDUCTION',
  );
  if (!links.length) {
    return [
      '（当前推理图中暂无任务 8 正向归纳链接；请确认 Evidence_Support_Chain 已对齐任务 8 操作角色/单据对象 FeatureID）',
    ];
  }
  return links.map((l) => formatTask2LogicLinkUiLine(l));
}

/** 任务 8.5 卡上「正向归纳」链接明细（双源：任务 8 状态机 + 任务 0 工具原语 → 任务 8.5） */
export function buildForwardInductionLinkUiLinesTask85(merged: DesignDetailLogicGraphTaskDto[]): string[] {
  const t85 = merged.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK85_LINE_TASK_ID);
  const links = (t85?.links || []).filter(
    (l) => l.linkKind === '正向归纳' || l.linkKind === 'FORWARD_INDUCTION',
  );
  if (!links.length) {
    return [
      '（当前推理图中暂无任务 8.5 正向归纳链接；请确认 Evidence_Support_Chain 已双源对齐任务 8 状态转移矩阵 FeatureID 与任务 0 工具原语 FeatureID）',
    ];
  }
  const fidToTask = buildFeatureIdToNormTaskIdFromGraphTasks(merged);
  const fromT8: DesignDetailLogicGraphLinkDto[] = [];
  const fromT0: DesignDetailLogicGraphLinkDto[] = [];
  const other: DesignDetailLogicGraphLinkDto[] = [];
  for (const l of links) {
    const sid = endpointFeatureId(l, 'source');
    const st = fidToTask.get(sid);
    if (st === DESIGN_DETAIL_TASK8_LINE_TASK_ID) fromT8.push(l);
    else if (st === DESIGN_DETAIL_TASK0_LINE_TASK_ID) fromT0.push(l);
    else other.push(l);
  }
  const lines: string[] = [];
  if (fromT8.length) {
    lines.push('→ 任务 8 状态转移矩阵 → 任务 8.5（纵向业务因果）');
    lines.push(...fromT8.map((l) => formatTask2LogicLinkUiLine(l)));
  }
  if (fromT0.length) {
    if (lines.length) lines.push('');
    lines.push('→ 任务 0 工具原语 → 任务 8.5（横向技术对撞）');
    lines.push(...fromT0.map((l) => formatTask2LogicLinkUiLine(l)));
  }
  if (other.length) {
    if (lines.length) lines.push('');
    lines.push('→ 任务 8.5 其它正向归纳');
    lines.push(...other.map((l) => formatTask2LogicLinkUiLine(l)));
  }
  return lines.length ? lines : ['（无正向归纳链接）'];
}

/** 任务 9 卡上「正向归纳」链接明细（边归入目标侧任务 9 桶：含任务 8.5→任务 9 与历史一级模块→二级菜单） */
export function buildForwardInductionLinkUiLinesTask9(merged: DesignDetailLogicGraphTaskDto[]): string[] {
  const t9 = merged.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK9_LINE_TASK_ID);
  const links = (t9?.links || []).filter(
    (l) => l.linkKind === '正向归纳' || l.linkKind === 'FORWARD_INDUCTION',
  );
  if (!links.length) {
    return [
      '（当前推理图中暂无任务 9 正向归纳链接；请确认系统一级模块 Evidence_Support_Chain 已引用任务 8.5 FeatureID 并完成 sync）',
    ];
  }
  const fidToTask = buildFeatureIdToNormTaskIdFromGraphTasks(merged);
  const fromT85: DesignDetailLogicGraphLinkDto[] = [];
  const fromT8: DesignDetailLogicGraphLinkDto[] = [];
  const intraModuleMenu: DesignDetailLogicGraphLinkDto[] = [];
  const other: DesignDetailLogicGraphLinkDto[] = [];
  for (const l of links) {
    const sid = endpointFeatureId(l, 'source');
    const tid = endpointFeatureId(l, 'target');
    const st = fidToTask.get(sid);
    const tt = fidToTask.get(tid);
    const logic = String(l.logic ?? '').trim();
    if (
      st === DESIGN_DETAIL_TASK9_LINE_TASK_ID &&
      tt === DESIGN_DETAIL_TASK9_LINE_TASK_ID &&
      (logic.includes('一级模块→二级功能菜单') ||
        (logic.includes('横向') && logic.includes('一级模块')) ||
        logic.includes('双源复合') ||
        logic.includes('Belongs_To_Primary_Module'))
    ) {
      intraModuleMenu.push(l);
    } else if (st === DESIGN_DETAIL_TASK85_LINE_TASK_ID) {
      fromT85.push(l);
    } else if (st === DESIGN_DETAIL_TASK8_LINE_TASK_ID) {
      fromT8.push(l);
    } else {
      other.push(l);
    }
  }
  const lines: string[] = [];
  if (fromT85.length) {
    lines.push('→ 任务 8.5 物理外挂 → 任务 9（Evidence 上游）');
    lines.push(...fromT85.map((l) => formatTask2LogicLinkUiLine(l)));
  }
  if (fromT8.length) {
    if (lines.length) lines.push('');
    lines.push('→ 任务 8 协作节点 → 任务 9（历史 Evidence 上游）');
    lines.push(...fromT8.map((l) => formatTask2LogicLinkUiLine(l)));
  }
  if (intraModuleMenu.length) {
    if (lines.length) lines.push('');
    lines.push('→ 任务 9 内：系统一级模块 → 二级功能菜单');
    lines.push(...intraModuleMenu.map((l) => formatTask2LogicLinkUiLine(l)));
  }
  if (other.length) {
    if (lines.length) lines.push('');
    lines.push('→ 任务 9 其它正向归纳');
    lines.push(...other.map((l) => formatTask2LogicLinkUiLine(l)));
  }
  return lines.length ? lines : ['（无正向归纳链接）'];
}

function readL5Task10TechnicalDdlMatrixRecordForProgress(
  root: Record<string, unknown>,
): Record<string, unknown> | null {
  const pairs: Array<[string, string]> = [
    ['L5_Data_Architecture_Matrix', 'l5_data_architecture_matrix'],
    ['L5_Technical_DDL_Matrix', 'l5_technical_ddl_matrix'],
    ['L5_Technical_DDL_Inference_Matrix', 'l5_technical_ddl_inference_matrix'],
  ];
  for (const [k1, k2] of pairs) {
    const direct = asRecord(getPropertyCI(root, k1, k2));
    if (direct) return direct;
  }
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    for (const [k1, k2] of pairs) {
      const inner = asRecord(getPropertyCI(o, k1, k2));
      if (inner) return inner;
    }
  }
  const tk = getPropertyCI(root, 'Target_KV', 'target_kv', 'Target_kv');
  if (Array.isArray(tk) && tk.length > 0) return root;
  return null;
}

/** 任务 10 sync 前规范 L5 Technical DDL JSON */
export function normalizeL5TechnicalDdlInferenceRawForServerSync(
  l5TechnicalDdlInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l5TechnicalDdlInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL3ProcessJsonRootRecordForProgress(raw);
  if (!root) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 10 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const matrix = readL5Task10TechnicalDdlMatrixRecordForProgress(root);
  if (!matrix) {
    return { ok: false, message: '未找到 L5_Data_Architecture_Matrix / L5_Technical_DDL_Matrix 或非空 Target_KV' };
  }
  const tkInMatrix = getPropertyCI(matrix, 'Target_KV', 'target_kv', 'Target_kv');
  if (!Array.isArray(tkInMatrix) || tkInMatrix.length === 0) {
    return { ok: false, message: 'L5 数据架构矩阵内 Target_KV 为空' };
  }
  let hasMatrix = false;
  for (const [k1, k2] of [
    ['L5_Data_Architecture_Matrix', 'l5_data_architecture_matrix'],
    ['L5_Technical_DDL_Matrix', 'l5_technical_ddl_matrix'],
    ['L5_Technical_DDL_Inference_Matrix', 'l5_technical_ddl_inference_matrix'],
  ] as const) {
    if (asRecord(getPropertyCI(root, k1, k2))) {
      hasMatrix = true;
      break;
    }
  }
  const payload = hasMatrix ? root : { L5_Data_Architecture_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/** 任务 10 卡上「正向归纳」链接明细（任务 9/8.5→任务 10 + 任务 10 层主表→基础表） */
/** 自任务 10 L5 模型输出解析 TVM 行（`L5_Data_Architecture_Matrix` / `L5_Technical_DDL_Matrix`）。 */
export function parseTask10L5TokenValidationMappingForAlignment(
  l5TechnicalDdlInferenceRaw: string,
): Task2L1TvmParsedRow[] {
  const root = readL3ProcessJsonRootRecordForProgress(l5TechnicalDdlInferenceRaw);
  if (!root) return [];
  const m = readL5Task10TechnicalDdlMatrixRecordForProgress(root);
  let rawList: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (!Array.isArray(rawList)) {
    rawList = getPropertyCI(root, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  const out: Task2L1TvmParsedRow[] = [];
  if (!Array.isArray(rawList)) return out;
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ?? rec.target_feature_id ?? getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const mappedL5Raw =
      rec.Mapped_L5_Feature ??
      rec.mapped_l5_feature ??
      getPropertyCI(rec, 'Mapped_L5_Feature', 'mapped_l5_feature');
    const tokFallbackRaw =
      rec.Token_Str ?? rec.token_str ?? getPropertyCI(rec, 'Token_Str', 'token_str');
    const pickMapped =
      typeof mappedL5Raw === 'string' ? mappedL5Raw.trim() : String(mappedL5Raw ?? '').trim();
    const pickTokFb =
      typeof tokFallbackRaw === 'string' ? tokFallbackRaw.trim() : String(tokFallbackRaw ?? '').trim();
    const clientFactToken = pickTokFb;
    const anchorModelFeature = pickMapped || pickTokFb;
    const tokenStr = clientFactToken || anchorModelFeature;
    const vLogicRaw =
      rec.Validation_Logic ?? rec.validation_logic ?? getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const iqRaw =
      rec.interview_question ??
      rec.Interview_Question ??
      getPropertyCI(rec, 'interview_question', 'Interview_Question');
    const consRaw = rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    const targetFeatureId = typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    const validationLogic = typeof vLogicRaw === 'string' ? vLogicRaw.trim() : String(vLogicRaw ?? '').trim();
    const interviewQuestion = typeof iqRaw === 'string' ? iqRaw.trim() : String(iqRaw ?? '').trim();
    const consistency = typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (!targetFeatureId && !tokenStr) continue;
    out.push({
      targetFeatureId,
      tokenStr,
      clientFactToken,
      anchorModelFeature,
      validationLogic,
      interviewQuestion,
      consistency,
    });
  }
  return out;
}

/** 任务 10 L5：`Mapped_L5_Feature` 作锚定特征。 */
export function buildTask10L5ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L3_L5');
}

export function extractTask10L5TokenValidationMappingProgressSnippet(
  l5TechnicalDdlInferenceRaw: string,
  maxChars = 12000,
): string {
  const rootObj = readL3ProcessJsonRootRecordForProgress(l5TechnicalDdlInferenceRaw);
  if (!rootObj) return '（未能从模型输出中解析 JSON 根对象）';
  const m = readL5Task10TechnicalDdlMatrixRecordForProgress(rootObj);
  let tv: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (tv === undefined || tv === null) {
    tv = getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (tv === undefined || tv === null) {
    return '（本段输出中未找到 Token_Validation_Mapping 字段）';
  }
  try {
    const s = JSON.stringify(tv, null, 2);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}\n\n…（以下已截断）`;
  } catch {
    return String(tv);
  }
}

export function buildForwardInductionLinkUiLinesTask10(merged: DesignDetailLogicGraphTaskDto[]): string[] {
  const t10 = merged.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK10_LINE_TASK_ID);
  const links = (t10?.links || []).filter(
    (l) => l.linkKind === '正向归纳' || l.linkKind === 'FORWARD_INDUCTION',
  );
  if (!links.length) {
    return [
      '（当前推理图中暂无任务 10 正向归纳链接；请确认 Target_KV 含主表/基础表级联行且 Evidence 已对齐任务 9 / 8.5 FeatureID 并完成 sync）',
    ];
  }
  const fidToTask = buildFeatureIdToNormTaskIdFromGraphTasks(merged);
  const fromT9: DesignDetailLogicGraphLinkDto[] = [];
  const fromT85: DesignDetailLogicGraphLinkDto[] = [];
  const intraT10: DesignDetailLogicGraphLinkDto[] = [];
  const other: DesignDetailLogicGraphLinkDto[] = [];
  for (const l of links) {
    const sid = endpointFeatureId(l, 'source');
    const tid = endpointFeatureId(l, 'target');
    const st = fidToTask.get(sid);
    const tt = fidToTask.get(tid);
    if (st === DESIGN_DETAIL_TASK9_LINE_TASK_ID) fromT9.push(l);
    else if (st === DESIGN_DETAIL_TASK85_LINE_TASK_ID) fromT85.push(l);
    else if (st === DESIGN_DETAIL_TASK10_LINE_TASK_ID && tt === DESIGN_DETAIL_TASK10_LINE_TASK_ID) {
      intraT10.push(l);
    } else other.push(l);
  }
  const lines: string[] = [];
  if (intraT10.length) {
    lines.push('→ 任务 10 层：主→子→基础 三元级联（Parent_Table_Ref / Reference_Field_Mapping）');
    lines.push(...intraT10.map((l) => formatTask2LogicLinkUiLine(l)));
  }
  if (fromT9.length) {
    if (lines.length) lines.push('');
    lines.push('→ 任务 9 系统一级模块 → 任务 10（Evidence 上游）');
    lines.push(...fromT9.map((l) => formatTask2LogicLinkUiLine(l)));
  }
  if (fromT85.length) {
    if (lines.length) lines.push('');
    lines.push('→ 任务 8.5 物理外挂 → 任务 10（技术载体上游）');
    lines.push(...fromT85.map((l) => formatTask2LogicLinkUiLine(l)));
  }
  if (other.length) {
    if (lines.length) lines.push('');
    lines.push('→ 任务 10 其它正向归纳');
    lines.push(...other.map((l) => formatTask2LogicLinkUiLine(l)));
  }
  return lines.length ? lines : ['（无正向归纳链接）'];
}

export function extractTask6L3TokenValidationMappingProgressSnippet(
  l3ScenarioInferenceRaw: string,
  maxChars = 12000,
): string {
  const rootObj = readL3ProcessJsonRootRecordForProgress(l3ScenarioInferenceRaw);
  if (!rootObj) return '（未能从模型输出中解析 JSON 根对象）';
  const m = readL3Task6ScenarioMatrixRecordForProgress(rootObj);
  let tv: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (tv === undefined || tv === null) {
    tv = getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if ((tv === undefined || tv === null) && m) {
    tv = getPropertyCI(m, 'L3_validate_Matrix', 'l3_validate_matrix');
  }
  if (tv === undefined || tv === null) {
    return '（本段输出中未找到 Token_Validation_Mapping 或 L3_validate_Matrix 字段）';
  }
  try {
    const s = JSON.stringify(tv, null, 2);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}\n\n…（以下已截断）`;
  } catch {
    return String(tv);
  }
}

export function normalizeL3ProcessInferenceRawForServerSync(
  l3ProcessInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3ProcessInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL3ProcessJsonRootRecordForProgress(raw);
  if (!root) return { ok: false, message: 'JSON 解析失败' };
  const hasL3Feature = !!asRecord(
    getPropertyCI(root, 'L3_Process_Feature_Matrix', 'l3_process_feature_matrix'),
  );
  const hasL3Vsm55 = !!asRecord(
    getPropertyCI(root, 'L3_5_VSM_Inference_Matrix', 'l3_5_vsm_inference_matrix'),
  );
  const hasL3Inference = !!asRecord(
    getPropertyCI(root, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'),
  );
  const matrix = readL3Task5ProcessMatrixRecordForProgress(root);
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L3_Process_Feature_Matrix / L3_5_VSM_Inference_Matrix / L3_Process_Inference_Matrix 或非空 Target_KV',
    };
  }
  const tkInMatrix = getPropertyCI(matrix, 'Target_KV', 'target_kv', 'Target_kv');
  if (!Array.isArray(tkInMatrix) || tkInMatrix.length === 0) {
    return { ok: false, message: 'L3 矩阵容器内 Target_KV 为空' };
  }
  const onlyVsmStages = tkInMatrix.every((item) => {
    const rec = asRecord(item);
    if (!rec) return false;
    const keyRaw = getPropertyCI(rec, 'Feature_Key', 'feature_key', 'Feature_key');
    const key = typeof keyRaw === 'string' ? keyRaw.trim() : String(keyRaw ?? '').trim();
    return key === '价值流阶段' || /^价值流阶段_/u.test(key);
  });
  const payload =
    hasL3Feature || hasL3Vsm55 || hasL3Inference
      ? root
      : onlyVsmStages
        ? { L3_5_VSM_Inference_Matrix: matrix }
        : { L3_Process_Feature_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/** 任务 5.5 sync 前规范：仅保留 `L3_5_VSM_Inference_Matrix`（与后端 `normalizeL3Vsm55InferenceRawForServerSync` 一致） */
export function normalizeL3Vsm55InferenceRawForServerSync(
  l3ProcessInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3ProcessInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL3ProcessJsonRootRecordForProgress(raw);
  if (!root) return { ok: false, message: 'JSON 解析失败' };
  const stream = asRecord(
    getPropertyCI(root, 'L3_Value_Stream_Matrix', 'l3_value_stream_matrix'),
  );
  const vsmLegacy = asRecord(
    getPropertyCI(root, 'L3_5_VSM_Inference_Matrix', 'l3_5_vsm_inference_matrix'),
  );
  const vsm = stream ?? vsmLegacy;
  const tk = vsm
    ? getPropertyCI(vsm, 'Target_KV', 'target_kv', 'Target_kv')
    : undefined;
  if (vsm && Array.isArray(tk) && tk.length > 0) {
    try {
      return { ok: true, normalized: JSON.stringify({ L3_5_VSM_Inference_Matrix: vsm }) };
    } catch {
      return { ok: false, message: 'JSON 序列化失败' };
    }
  }
  const norm = normalizeL3ProcessInferenceRawForServerSync(raw);
  if (!norm.ok) return norm;
  try {
    const parsed = JSON.parse(norm.normalized) as Record<string, unknown>;
    const inner = asRecord(
      getPropertyCI(parsed, 'L3_5_VSM_Inference_Matrix', 'l3_5_vsm_inference_matrix'),
    );
    if (inner) {
      return { ok: true, normalized: JSON.stringify({ L3_5_VSM_Inference_Matrix: inner }) };
    }
  } catch {
    /* fall through */
  }
  return {
    ok: false,
    message:
      '未找到 L3_Value_Stream_Matrix / L3_5_VSM_Inference_Matrix 或非空 Target_KV；请确认 Feature_Key 为「价值流阶段」',
  };
}

function readL3Task51ValuePropositionMatrixRecordForProgress(
  rootObj: Record<string, unknown>,
): Record<string, unknown> | null {
  const matrix = asRecord(
    getPropertyCI(rootObj, 'L3_Value_Proposition_Matrix', 'l3_value_proposition_matrix'),
  );
  if (matrix) return matrix;
  for (const v of Object.values(rootObj)) {
    const o = asRecord(v);
    if (!o) continue;
    const inner = asRecord(
      getPropertyCI(o, 'L3_Value_Proposition_Matrix', 'l3_value_proposition_matrix'),
    );
    if (inner) return inner;
  }
  return null;
}

/** 任务 5.1 sync 前规范：仅保留 `L3_Value_Proposition_Matrix`（与后端 `normalizeL51ValuePropositionRawForServerSync` 一致） */
export function normalizeL51ValuePropositionRawForServerSync(
  l3ValuePropositionRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3ValuePropositionRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL3ProcessJsonRootRecordForProgress(raw);
  if (!root) return { ok: false, message: 'JSON 解析失败' };
  const matrix = readL3Task51ValuePropositionMatrixRecordForProgress(root);
  if (matrix) {
    try {
      return { ok: true, normalized: JSON.stringify({ L3_Value_Proposition_Matrix: matrix }) };
    } catch {
      return { ok: false, message: 'JSON 序列化失败' };
    }
  }
  const tk = getPropertyCI(root, 'Target_KV', 'target_kv', 'Target_kv');
  if (Array.isArray(tk) && tk.length > 0) {
    try {
      return {
        ok: true,
        normalized: JSON.stringify({ L3_Value_Proposition_Matrix: { Target_KV: tk } }),
      };
    } catch {
      return { ok: false, message: 'JSON 序列化失败' };
    }
  }
  return {
    ok: false,
    message:
      '未找到 L3_Value_Proposition_Matrix 或非空 Target_KV；请确认根键为 L3_Value_Proposition_Matrix',
  };
}

/** 自任务 5.1 L3.1 模型输出提取 Token_Validation_Mapping 灰块摘要 */
export function extractTask51L3TokenValidationMappingProgressSnippet(
  l3ValuePropositionRaw: string,
  maxChars = 12000,
): string {
  const rootObj = readL3ProcessJsonRootRecordForProgress(l3ValuePropositionRaw);
  if (!rootObj) return '（未能从模型输出中解析 JSON 根对象）';
  const m = readL3Task51ValuePropositionMatrixRecordForProgress(rootObj);
  let tv: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (tv === undefined || tv === null) {
    tv = getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (tv === undefined || tv === null) {
    return '（本段输出中未找到 Token_Validation_Mapping 字段）';
  }
  let s = '';
  try {
    s = JSON.stringify(tv, null, 2);
  } catch {
    s = String(tv);
  }
  if (s.length > maxChars) {
    return `${s.slice(0, maxChars)}\n…（已截断，共 ${s.length} 字符）`;
  }
  return s;
}

/** 自任务 5 模型输出提取 Token_Validation_Mapping 灰块摘要 */
export function extractTask5L3TokenValidationMappingProgressSnippet(
  l3ProcessInferenceRaw: string,
  maxChars = 12000,
): string {
  const rootObj = readL3ProcessJsonRootRecordForProgress(l3ProcessInferenceRaw);
  if (!rootObj) return '（未能从模型输出中解析 JSON 根对象）';
  let m = readL3Task5ProcessMatrixRecordForProgress(rootObj);
  let tv: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (tv === undefined || tv === null) {
    tv = getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (tv === undefined || tv === null) {
    return '（本段输出中未找到 Token_Validation_Mapping 字段）';
  }
  let s = '';
  try {
    s = JSON.stringify(tv, null, 2);
  } catch {
    s = String(tv);
  }
  if (s.length > maxChars) {
    return `${s.slice(0, maxChars)}\n…（已截断，共 ${s.length} 字符）`;
  }
  return s;
}

export function buildReverseValidationLinkUiLines(merged: DesignDetailLogicGraphTaskDto[]): string[] {
  const t1 = merged.find((t) => String(t.taskId || '').trim() === 'customer_basic');
  const links = (t1?.links || []).filter(
    (l) => l.linkKind === '反向验证' || l.linkKind === 'REVERSE_VALIDATION',
  );
  if (!links.length) return ['（当前推理图中暂无反向验证链接）'];
  return links.map((l) => formatTask2LogicLinkUiLine(l));
}

function escapeHtmlForTvmProgress(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TVM_PROGRESS_HIGHLIGHT_KEY_RE =
  /"(Target_FeatureID|Mapped_L1_Feature)"(\s*:\s*)("(?:[^"\\]|\\.)*")/gi;

/** 先匹配再高亮并分段转义，避免 `escapeHtml` 把 `"` 变成 `&quot;` 导致正则失效 */
function highlightTvmProgressKeyFields(jsonFragment: string): string {
  const s = String(jsonFragment ?? '');
  if (!s) return '';
  const re = new RegExp(TVM_PROGRESS_HIGHLIGHT_KEY_RE.source, TVM_PROGRESS_HIGHLIGHT_KEY_RE.flags);
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out += escapeHtmlForTvmProgress(s.slice(last, m.index));
    out += `<span class="dd-dyn-tvm-em">${escapeHtmlForTvmProgress(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  out += escapeHtmlForTvmProgress(s.slice(last));
  return out;
}

function tvmRecordConsistencyRaw(record: unknown): string {
  const rec = asRecord(record);
  if (!rec) return '';
  const consRaw = rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
  return String(consRaw ?? '').trim();
}

/** 从单条 TVM JSON 文本提取 `Consistency`（仅认字段名，避免 `Validation_Logic` 内「潜在冲突」误判） */
function extractConsistencyFromTvmJsonText(text: string): string {
  const raw = String(text ?? '');
  const m =
    /"Consistency"\s*:\s*"((?:[^"\\]|\\.)*)"/i.exec(raw) ??
    /"consistency"\s*:\s*"((?:[^"\\]|\\.)*)"/i.exec(raw);
  if (m?.[1]) {
    return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
  }
  const hint = /Consistency=([^\s，,)]+)/.exec(raw);
  return hint?.[1]?.trim() ?? '';
}

/** 逻辑一致 / 已通过修正 / 已确认痛点 → 进度区淡绿（须 **显式** Consistency，空值不算） */
function isTokenValidationMappingResolvedOrConsistent(consistencyRaw: string): boolean {
  const c0 = String(consistencyRaw ?? '').trim();
  if (!c0) return false;
  if (c0.includes('逻辑一致')) return true;
  if (
    c0.includes('已通过洞察修正') ||
    c0.includes('已通过纠偏修正') ||
    c0.includes('已通过纠慢修正') ||
    c0.includes('已确认为痛点')
  ) {
    return true;
  }
  return false;
}

function inferTvmConsistencyForProgressTone(record: unknown, jsonText: string): string {
  const fromField = tvmRecordConsistencyRaw(record);
  if (fromField) return fromField;
  return extractConsistencyFromTvmJsonText(jsonText);
}

function tvmRecordValidationLogicRaw(record: unknown): string {
  const rec = asRecord(record);
  if (!rec) return '';
  const v =
    rec.Validation_Logic ??
    rec.validation_logic ??
    getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
  return String(v ?? '').trim();
}

/** 进度区 JSON 被截断、缺 `Consistency` 行时：用正文强信号兜底（避免误读 Validation_Logic 内「逻辑一致」子串） */
function tvmProgressTextIndicatesPotentialConflict(record: unknown, jsonText: string): boolean {
  const j = String(jsonText ?? '');
  if (/"Consistency"\s*:\s*"潜在冲突"/i.test(j)) return true;
  const vLogic = tvmRecordValidationLogicRaw(record);
  if (/因此判定为潜在冲突|应判定为潜在冲突|认定为潜在冲突|属于潜在冲突[。.]/i.test(vLogic)) {
    return true;
  }
  if (/因此判定为潜在冲突|应判定为潜在冲突/.test(j)) return true;
  return false;
}

function tvmProgressTextIndicatesResolvedOrConsistent(record: unknown, jsonText: string): boolean {
  const j = String(jsonText ?? '');
  if (/"Consistency"\s*:\s*"逻辑一致"/i.test(j)) return true;
  if (/"Consistency"\s*:\s*"已通过(?:洞察|纠偏|纠慢)?修正"/i.test(j)) return true;
  const vLogic = tvmRecordValidationLogicRaw(record);
  if (/因此判定为逻辑一致|应判定为逻辑一致|认定为逻辑一致/i.test(vLogic)) return true;
  return false;
}

function resolveTvmRecordToneClass(
  record: unknown,
  jsonTextForFallback?: string,
): 'dd-dyn-tvm-record--warn' | 'dd-dyn-tvm-record--ok' {
  const json = String(jsonTextForFallback ?? '');
  const cons = inferTvmConsistencyForProgressTone(record, json);

  if (cons) {
    if (isTokenValidationMappingResolvedOrConsistent(cons)) return 'dd-dyn-tvm-record--ok';
    if (isTokenValidationMappingPotentialConflict(cons)) return 'dd-dyn-tvm-record--warn';
  }

  if (tvmProgressTextIndicatesPotentialConflict(record, json)) return 'dd-dyn-tvm-record--warn';
  if (tvmProgressTextIndicatesResolvedOrConsistent(record, json)) return 'dd-dyn-tvm-record--ok';

  return 'dd-dyn-tvm-record--ok';
}

/** 进度展示：把 `Consistency` 提前，降低 12k 截断时丢失该字段的概率 */
function reorderTvmRecordForProgressDisplay(rec: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const priorityKeys = [
    'Target_FeatureID',
    'target_feature_id',
    'Mapped_L1_Feature',
    'mapped_l1_feature',
    'Mapped_L2_Feature',
    'mapped_l2_feature',
    'Mapped_L3_Feature',
    'mapped_l3_feature',
    'Consistency',
    'consistency',
  ];
  for (const k of priorityKeys) {
    if (k in rec) out[k] = rec[k]!;
  }
  for (const [k, v] of Object.entries(rec)) {
    if (!(k in out)) out[k] = v;
  }
  return out;
}

function stringifyTvmRecordForProgressDisplay(item: unknown): string {
  const rec = asRecord(item);
  if (!rec) {
    try {
      return JSON.stringify(item, null, 2);
    } catch {
      return String(item ?? '');
    }
  }
  return JSON.stringify(reorderTvmRecordForProgressDisplay(rec), null, 2);
}

function stringifyTvmArrayForProgressSnippet(items: unknown[], maxChars: number): string {
  const rows = items.map((item) => {
    const rec = asRecord(item);
    return rec ? reorderTvmRecordForProgressDisplay(rec) : item;
  });
  let s = '';
  try {
    s = JSON.stringify(rows, null, 2);
  } catch {
    s = items.map((item) => stringifyTvmRecordForProgressDisplay(item)).join(',\n');
  }
  if (s.length <= maxChars) return s;
  const budget = Math.max(600, Math.floor(maxChars / Math.max(1, items.length)));
  const parts = items.map((item) => {
    let one = stringifyTvmRecordForProgressDisplay(item);
    if (one.length <= budget) return one;
    const consHint = tvmRecordConsistencyRaw(item) || inferTvmConsistencyForProgressTone(item, one);
    const tail = consHint ? `，Consistency=${consHint}` : '';
    return `${one.slice(0, budget)}\n…（已截断${tail}）`;
  });
  return `[\n${parts.join(',\n')}\n]`;
}

function stripTvmProgressTruncationSuffix(text: string): string {
  return String(text ?? '')
    .replace(/\n…（已截断[^]*$/, '')
    .replace(/\n\.\.\.（已截断[^]*$/, '')
    .trim();
}

/** 顶层 JSON 数组按 `},{` 拆成单条对象文本（截断导致 `JSON.parse` 失败时仍可分条着色） */
function splitTvmProgressJsonArrayText(text: string): string[] {
  const t = stripTvmProgressTruncationSuffix(text).trim();
  if (!t.startsWith('[')) return [t];
  const inner = t.endsWith(']') ? t.slice(1, -1).trim() : t.slice(1).trim();
  if (!inner) return [];
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        parts.push(inner.slice(start, i + 1).trim());
        let j = i + 1;
        while (j < inner.length && /[\s,]/.test(inner[j]!)) j += 1;
        i = j - 1;
      }
    }
  }
  return parts.length ? parts : [t];
}

function formatSingleTvmProgressRecordHtml(record: unknown, jsonTextOverride?: string): string {
  let json = jsonTextOverride ?? '';
  if (!json) {
    json = stringifyTvmRecordForProgressDisplay(record);
  }
  const toneClass = resolveTvmRecordToneClass(record, json);
  return `<span class="dd-dyn-tvm-record ${toneClass}">${highlightTvmProgressKeyFields(json)}</span>`;
}

function formatTvmProgressRecordChunkText(chunk: string): string {
  const trimmed = chunk.trim();
  let rec: unknown = null;
  try {
    rec = JSON.parse(trimmed);
  } catch {
    rec = null;
  }
  const display =
    rec && typeof rec === 'object' ? stringifyTvmRecordForProgressDisplay(rec) : trimmed;
  return formatSingleTvmProgressRecordHtml(rec, display);
}

/** `JSON.parse` 整段失败时：按条拆分解析 `Consistency`，逻辑一致淡绿、潜在冲突淡红 */
function formatTokenValidationMappingProgressHtmlFallback(plain: string): string {
  const chunks = splitTvmProgressJsonArrayText(plain);
  if (chunks.length > 1) {
    const records = chunks.map((c) => formatTvmProgressRecordChunkText(c));
    const body = records.join('<span class="dd-dyn-tvm-array-sep">,</span>\n');
    return `<span class="dd-dyn-tvm-array">[<br/>${body}<br/>]</span>`;
  }
  return formatTvmProgressRecordChunkText(chunks[0] ?? plain);
}

/** 进度行正文是否形如 `Token_Validation_Mapping` JSON 数组（用于旧快照 `bmc_result_quote` 升级） */
export function looksLikeTokenValidationMappingProgressText(text: string): boolean {
  const t = String(text || '').trim();
  if (!t || t.startsWith('（')) return false;
  if (
    /"Target_FeatureID"/i.test(t) &&
    (/"Token_Str"/i.test(t) || /"Mapped_L1_Feature"/i.test(t) || /"Mapped_L2_Feature"/i.test(t))
  ) {
    return true;
  }
  try {
    const parsed = JSON.parse(t);
    if (!Array.isArray(parsed) || !parsed.length) return false;
    const head = asRecord(parsed[0]);
    if (!head) return false;
    return Boolean(
      getPropertyCI(head, 'Target_FeatureID', 'target_feature_id') ||
        getPropertyCI(head, 'Token_Str', 'token_str'),
    );
  } catch {
    return false;
  }
}

export type ProgressLineKindLike = string | undefined;

/** 展示/持久化恢复：将 TVM JSON 灰块统一为 `token_validation_mapping_quote` */
export function normalizeTokenValidationMappingProgressLineKind(
  kind: ProgressLineKindLike,
  fullText: string,
): string {
  if (kind === 'token_validation_mapping_quote') return kind;
  if (kind === 'bmc_result_quote' && looksLikeTokenValidationMappingProgressText(fullText)) {
    return 'token_validation_mapping_quote';
  }
  return kind ?? 'default';
}

/**
 * 任务进展区 **`Token_Validation_Mapping`** JSON：按条 **`Consistency`** 着色（潜在冲突淡红 / 无冲突淡绿）；
 * **`Target_FeatureID` / `Mapped_L1_Feature`** 键值深蓝加粗。
 */
export function formatTokenValidationMappingProgressHtml(plain: string): string {
  const trimmed = stripTvmProgressTruncationSuffix(String(plain ?? '').trim());
  if (!trimmed || trimmed.startsWith('（')) {
    return `<span class="dd-dyn-tvm-fallback">${escapeHtmlForTvmProgress(plain)}</span>`;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return formatTokenValidationMappingProgressHtmlFallback(plain);
  }
  if (Array.isArray(parsed)) {
    if (!parsed.length) {
      return escapeHtmlForTvmProgress('[]');
    }
    const records = parsed.map((item) => formatSingleTvmProgressRecordHtml(item));
    if (records.length === 1) return records[0]!;
    const body = records.join('<span class="dd-dyn-tvm-array-sep">,</span>\n');
    return `<span class="dd-dyn-tvm-array">[<br/>${body}<br/>]</span>`;
  }
  if (parsed && typeof parsed === 'object') {
    return formatSingleTvmProgressRecordHtml(parsed);
  }
  return formatTokenValidationMappingProgressHtmlFallback(plain);
}

/**
 * 从 L1 原始输出中提取 **`Token_Validation_Mapping`** 的可读 JSON（与后端解析顺序一致：矩阵内优先，根级兜底）。
 */
export function extractTokenValidationMappingProgressSnippet(
  l1InferenceRaw: string,
  maxChars = 12000,
): string {
  const rootObj = readL1JsonRootRecord(l1InferenceRaw);
  if (!rootObj) {
    return '（未能从模型输出中解析 JSON 根对象）';
  }
  const m = readL1InferenceMatrixRecordForProgress(rootObj);
  let tv: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (tv === undefined || tv === null) {
    tv = getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (tv === undefined || tv === null) {
    return '（本段输出中未找到 Token_Validation_Mapping 字段）';
  }
  if (Array.isArray(tv)) {
    return stringifyTvmArrayForProgressSnippet(tv, maxChars);
  }
  let s = stringifyTvmRecordForProgressDisplay(tv);
  if (s.length > maxChars) {
    const consHint = inferTvmConsistencyForProgressTone(tv, s);
    const tail = consHint ? `，Consistency=${consHint}` : '';
    return `${s.slice(0, maxChars)}\n…（已截断${tail}，共 ${s.length} 字符）`;
  }
  return s;
}

function readL2JsonRootRecordForProgress(l2InferenceRaw: string): Record<string, unknown> | null {
  const raw = stripBom(String(l2InferenceRaw || '').trim());
  if (!raw.length) return null;
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) return null;
  const root = peelJsonStringLayers(rootOnce, 8);
  return asRecord(root);
}

/**
 * 从任务 3 L2 原始输出中提取 **`L2_Business_Inference_Matrix` / `L2_Inference_Matrix` 内 `Token_Validation_Mapping`** 的可读 JSON（与后端解析顺序一致：矩阵内优先，根级兜底）。
 */
export function extractTask3L2TokenValidationMappingProgressSnippet(
  l2InferenceRaw: string,
  maxChars = 12000,
): string {
  const rootObj = readL2JsonRootRecordForProgress(l2InferenceRaw);
  if (!rootObj) {
    return '（未能从模型输出中解析 JSON 根对象）';
  }
  const m = readL2Task3MatrixRecordForProgress(rootObj);
  let tv: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (tv === undefined || tv === null) {
    tv = getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (tv === undefined || tv === null) {
    return '（本段输出中未找到 Token_Validation_Mapping 字段）';
  }
  let s = '';
  try {
    s = JSON.stringify(tv, null, 2);
  } catch {
    s = String(tv);
  }
  if (s.length > maxChars) {
    return `${s.slice(0, maxChars)}\n…（已截断，共 ${s.length} 字符）`;
  }
  return s;
}

function readL2ValueJsonRootRecordForProgress(l2ValueInferenceRaw: string): Record<string, unknown> | null {
  const peeled = peelJsonStringLayers(l2ValueInferenceRaw, 8);
  return asRecord(peeled);
}

/** 任务 4：与后端一致，优先 `L2_Value_Inference_Matrix`，兼容历史 `L3_Process_Inference_Matrix`。 */
function readL2Task4ValueMatrixRecordForProgress(rootObj: Record<string, unknown>): Record<string, unknown> | null {
  const keyPairs: Array<[string, string]> = [
    ['L2_Value_Inference_Matrix', 'l2_value_inference_matrix'],
    ['L3_Process_Inference_Matrix', 'l3_process_inference_matrix'],
  ];
  for (const [k1, k2] of keyPairs) {
    const m = asRecord(getPropertyCI(rootObj, k1, k2));
    if (m) return m;
  }
  for (const v of Object.values(rootObj)) {
    const o = asRecord(v);
    if (!o) continue;
    for (const [k1, k2] of keyPairs) {
      const innerM = asRecord(getPropertyCI(o, k1, k2));
      if (innerM) return innerM;
    }
  }
  const tk = getPropertyCI(rootObj, 'Target_KV', 'target_kv', 'Target_kv');
  if (Array.isArray(tk) && tk.length > 0) return rootObj;
  return null;
}

/**
 * 任务 3 sync 前将模型原文规范为合法 JSON 字符串（剥离 Markdown 围栏、补 `L2_Business_Inference_Matrix` 包装）。
 * 与后端 `normalizeL2BusinessInferenceRawForServerSync` 口径一致。
 */
export function normalizeL2BusinessInferenceRawForServerSync(
  l2InferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l2InferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL2JsonRootRecordForProgress(raw);
  if (!root) return { ok: false, message: 'JSON 解析失败' };
  const hasBim =
    !!asRecord(getPropertyCI(root, 'L2_Business_Inference_Matrix', 'l2_business_inference_matrix')) ||
    !!asRecord(getPropertyCI(root, 'L2_Inference_Matrix', 'l2_inference_matrix'));
  if (hasBim) {
    try {
      return { ok: true, normalized: JSON.stringify(root) };
    } catch {
      return { ok: false, message: 'JSON 序列化失败' };
    }
  }
  const matrix = readL2Task3MatrixRecordForProgress(root);
  if (matrix) {
    try {
      return { ok: true, normalized: JSON.stringify({ L2_Business_Inference_Matrix: matrix }) };
    } catch {
      return { ok: false, message: 'JSON 序列化失败' };
    }
  }
  return {
    ok: false,
    message: '未找到 L2_Business_Inference_Matrix / L2_Inference_Matrix 或非空 Target_KV',
  };
}

/**
 * 任务 4 sync 前将模型原文规范为合法 JSON 字符串（剥离围栏、补矩阵包装）。
 * 与后端 `normalizeL2ValueInferenceRawForServerSync` 口径一致。
 */
export function normalizeL2ValueInferenceRawForServerSync(
  l2ValueInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l2ValueInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL2ValueJsonRootRecordForProgress(raw);
  if (!root) return { ok: false, message: 'JSON 解析失败' };
  const hasL3 = !!asRecord(getPropertyCI(root, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'));
  const hasL2 = !!asRecord(getPropertyCI(root, 'L2_Value_Inference_Matrix', 'l2_value_inference_matrix'));
  const matrix = readL2Task4ValueMatrixRecordForProgress(root);
  if (!matrix) {
    const dpOnly =
      !!getPropertyCI(root, 'Diagnostic_Pain_Points', 'diagnostic_pain_points') ||
      !!getPropertyCI(root, 'Conflict_Description', 'conflict_description') ||
      !!getPropertyCI(root, 'Root_Cause_Analysis', 'root_cause_analysis');
    return {
      ok: false,
      message: dpOnly
        ? '模型输出似仅含 Diagnostic_Pain_Points，缺少 L2_Value_Inference_Matrix 与非空 Target_KV，请重跑任务 4 推理'
        : '未找到 L2_Value_Inference_Matrix / L3_Process_Inference_Matrix 或 Target_KV',
    };
  }
  const tkInMatrix = getPropertyCI(matrix, 'Target_KV', 'target_kv', 'Target_kv');
  if (!Array.isArray(tkInMatrix) || tkInMatrix.length === 0) {
    const tkTop = getPropertyCI(root, 'Target_KV', 'target_kv', 'Target_kv');
    if (!Array.isArray(tkTop) || tkTop.length === 0) {
      return {
        ok: false,
        message:
          'L2_Value_Inference_Matrix 内 Target_KV 为空：请让模型按 L2 价值链契约输出核心价值驱动等四键后重试',
      };
    }
  }
  const payload =
    hasL2 || hasL3 ? root : { L2_Value_Inference_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/**
 * 自任务 4 模型输出解析 **`Token_Validation_Mapping`**（**`Mapped_L3_Feature`** / **`Mapped_L2_Feature`** 写入锚定特征，供对齐门禁与问卷块复用）。
 */
export function parseTask4L2TokenValidationMappingForAlignment(l2ValueInferenceRaw: string): Task2L1TvmParsedRow[] {
  const root = readL2ValueJsonRootRecordForProgress(l2ValueInferenceRaw);
  if (!root) return [];
  const m = readL2Task4ValueMatrixRecordForProgress(root);
  let rawList: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (!Array.isArray(rawList)) {
    rawList = getPropertyCI(root, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TvmParsedRow[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ?? rec.target_feature_id ?? getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const mappedL3Raw =
      rec.Mapped_L3_Feature ??
      rec.mapped_l3_feature ??
      getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature');
    const mappedL2Raw =
      rec.Mapped_L2_Feature ??
      rec.mapped_l2_feature ??
      getPropertyCI(rec, 'Mapped_L2_Feature', 'mapped_l2_feature');
    const tokFallbackRaw =
      rec.Token_Str ?? rec.token_str ?? getPropertyCI(rec, 'Token_Str', 'token_str');
    const pickMapped =
      (typeof mappedL3Raw === 'string' ? mappedL3Raw.trim() : String(mappedL3Raw ?? '').trim()) ||
      (typeof mappedL2Raw === 'string' ? mappedL2Raw.trim() : String(mappedL2Raw ?? '').trim());
    const pickTokFb =
      typeof tokFallbackRaw === 'string' ? tokFallbackRaw.trim() : String(tokFallbackRaw ?? '').trim();
    const clientFactToken = pickTokFb;
    const anchorModelFeature = pickMapped || pickTokFb;
    const tokenStr = clientFactToken || anchorModelFeature;
    const vLogicRaw =
      rec.Validation_Logic ?? rec.validation_logic ?? getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const iqRaw =
      rec.interview_question ??
      rec.Interview_Question ??
      getPropertyCI(rec, 'interview_question', 'Interview_Question');
    const consRaw = rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    const targetFeatureId = typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    const validationLogic = typeof vLogicRaw === 'string' ? vLogicRaw.trim() : String(vLogicRaw ?? '').trim();
    const interviewQuestion = typeof iqRaw === 'string' ? iqRaw.trim() : String(iqRaw ?? '').trim();
    const consistency = typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (!targetFeatureId && !tokenStr) continue;
    out.push({
      targetFeatureId,
      tokenStr,
      clientFactToken,
      anchorModelFeature,
      validationLogic,
      interviewQuestion,
      consistency,
    });
  }
  return out;
}

/** 任务 4 L3：`Mapped_L3_Feature` 作锚定特征（VSM 阶段键或固定维度键）。 */
export function buildTask4L2ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L1_L2');
}

/**
 * 自任务 6 L3 模型输出解析反向校验行（优先 **`Token_Validation_Mapping`**，回退 **`L3_validate_Matrix`**）。
 */
export function parseTask6L3TokenValidationMappingForAlignment(l3ScenarioInferenceRaw: string): Task2L1TvmParsedRow[] {
  const root = readL3ProcessJsonRootRecordForProgress(l3ScenarioInferenceRaw);
  if (!root) return [];
  const m = readL3Task6ScenarioMatrixRecordForProgress(root);
  let rawList: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (!Array.isArray(rawList)) {
    rawList = getPropertyCI(root, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  const out: Task2L1TvmParsedRow[] = [];
  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      const rec = asRecord(item);
      if (!rec) continue;
      const fidRaw =
        rec.Target_FeatureID ?? rec.target_feature_id ?? getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
      const mappedL3Raw =
        rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature');
      const tokFallbackRaw =
        rec.Token_Str ?? rec.token_str ?? getPropertyCI(rec, 'Token_Str', 'token_str');
      const pickMapped =
        typeof mappedL3Raw === 'string' ? mappedL3Raw.trim() : String(mappedL3Raw ?? '').trim();
      const pickTokFb =
        typeof tokFallbackRaw === 'string' ? tokFallbackRaw.trim() : String(tokFallbackRaw ?? '').trim();
      const clientFactToken = pickTokFb;
      const anchorModelFeature = pickMapped || pickTokFb;
      const tokenStr = clientFactToken || anchorModelFeature;
      const vLogicRaw =
        rec.Validation_Logic ?? rec.validation_logic ?? getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
      const iqRaw =
        rec.interview_question ??
        rec.Interview_Question ??
        getPropertyCI(rec, 'interview_question', 'Interview_Question');
      const consRaw = rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
      const targetFeatureId = typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
      const validationLogic = typeof vLogicRaw === 'string' ? vLogicRaw.trim() : String(vLogicRaw ?? '').trim();
      const interviewQuestion = typeof iqRaw === 'string' ? iqRaw.trim() : String(iqRaw ?? '').trim();
      const consistency = typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
      if (!targetFeatureId && !tokenStr) continue;
      out.push({
        targetFeatureId,
        tokenStr,
        clientFactToken,
        anchorModelFeature,
        validationLogic,
        interviewQuestion,
        consistency,
      });
    }
  }
  if (out.length > 0) return out;
  const validateList =
    m !== null ? getPropertyCI(m, 'L3_validate_Matrix', 'l3_validate_matrix') : undefined;
  if (!Array.isArray(validateList)) return [];
  for (const item of validateList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ?? rec.target_feature_id ?? getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const fkRaw = rec.Feature_Key ?? rec.feature_key ?? getPropertyCI(rec, 'Feature_Key', 'feature_key');
    const fvRaw =
      rec.Feature_Value ?? rec.feature_value ?? getPropertyCI(rec, 'Feature_Value', 'feature_value');
    const targetFeatureId = typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    const anchorModelFeature =
      typeof fkRaw === 'string' ? fkRaw.trim() : String(fkRaw ?? '').trim() || '流程骨干校验';
    const clientFactToken = anchorModelFeature;
    const tokenStr = clientFactToken;
    const vLogicRaw =
      rec.Validation_Logic ?? rec.validation_logic ?? getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const iqRaw =
      rec.interview_question ??
      rec.Interview_Question ??
      getPropertyCI(rec, 'interview_question', 'Interview_Question');
    const consRaw = rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    const validationLogic = typeof vLogicRaw === 'string' ? vLogicRaw.trim() : String(vLogicRaw ?? '').trim();
    const interviewQuestion = typeof iqRaw === 'string' ? iqRaw.trim() : String(iqRaw ?? '').trim();
    let consistency = typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (!consistency) {
      consistency = typeof fvRaw === 'string' ? fvRaw.trim() : String(fvRaw ?? '').trim();
    }
    if (!targetFeatureId && !tokenStr) continue;
    out.push({
      targetFeatureId,
      tokenStr,
      clientFactToken,
      anchorModelFeature,
      validationLogic,
      interviewQuestion,
      consistency,
    });
  }
  return out;
}

/** 任务 6 L3：`Mapped_L3_Feature` 作锚定特征（L3~L5 字段族）。 */
export function buildTask6L3ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L3_L5');
}

/** 任务 6.5 L3 IT-Gap：`Mapped_L3_Feature` 作锚定特征（与任务 6 同族）。 */
export function buildTask65L3ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L3_L5');
}

/** 自任务 6.5 L3 IT-Gap 模型输出解析 TVM 行 */
export function parseTask65L3TokenValidationMappingForAlignment(
  l3ItGapInferenceRaw: string,
): Task2L1TvmParsedRow[] {
  const root = readL3ProcessJsonRootRecordForProgress(l3ItGapInferenceRaw);
  if (!root) return [];
  const m = readL3Task65ItGapMatrixRecordForProgress(root);
  let rawList: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (!Array.isArray(rawList)) {
    rawList = getPropertyCI(root, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  const out: Task2L1TvmParsedRow[] = [];
  if (!Array.isArray(rawList)) return out;
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ?? rec.target_feature_id ?? getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const mappedL3Raw =
      rec.Mapped_L3_Feature ??
      rec.mapped_l3_feature ??
      getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature');
    const tokFallbackRaw = rec.Token_Str ?? rec.token_str ?? getPropertyCI(rec, 'Token_Str', 'token_str');
    const pickMapped =
      typeof mappedL3Raw === 'string' ? mappedL3Raw.trim() : String(mappedL3Raw ?? '').trim();
    const pickTokFb =
      typeof tokFallbackRaw === 'string' ? tokFallbackRaw.trim() : String(tokFallbackRaw ?? '').trim();
    const tokenStr = pickTokFb || pickMapped;
    const vLogicRaw =
      rec.Validation_Logic ?? rec.validation_logic ?? getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const iqRaw =
      rec.interview_question ??
      rec.Interview_Question ??
      getPropertyCI(rec, 'interview_question', 'Interview_Question');
    const consRaw = rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    const targetFeatureId = typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    const validationLogic = typeof vLogicRaw === 'string' ? vLogicRaw.trim() : String(vLogicRaw ?? '').trim();
    const interviewQuestion = typeof iqRaw === 'string' ? iqRaw.trim() : String(iqRaw ?? '').trim();
    const consistency = typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (!targetFeatureId && !tokenStr) continue;
    out.push({
      targetFeatureId,
      tokenStr,
      clientFactToken: pickTokFb,
      anchorModelFeature: pickMapped || pickTokFb,
      validationLogic,
      interviewQuestion,
      consistency,
    });
  }
  return out;
}

function readL3Task55VsmMatrixRecordForProgress(rootObj: Record<string, unknown>): Record<string, unknown> | null {
  const l3Vsm55 = asRecord(
    getPropertyCI(rootObj, 'L3_5_VSM_Inference_Matrix', 'l3_5_vsm_inference_matrix'),
  );
  if (l3Vsm55) return l3Vsm55;
  for (const v of Object.values(rootObj)) {
    const o = asRecord(v);
    if (!o) continue;
    const innerVsm55 = asRecord(
      getPropertyCI(o, 'L3_5_VSM_Inference_Matrix', 'l3_5_vsm_inference_matrix'),
    );
    if (innerVsm55) return innerVsm55;
  }
  return null;
}

function parseL3MatrixTokenValidationMappingForAlignment(
  root: Record<string, unknown>,
  matrix: Record<string, unknown> | null,
): Task2L1TvmParsedRow[] {
  let rawList: unknown =
    matrix !== null ? getPropertyCI(matrix, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (!Array.isArray(rawList)) {
    rawList = getPropertyCI(root, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TvmParsedRow[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ?? rec.target_feature_id ?? getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const mappedL3Raw =
      rec.Mapped_L3_Feature ??
      rec.mapped_l3_feature ??
      getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature') ??
      rec.Mapped_L5_Feature ??
      rec.mapped_l5_feature ??
      getPropertyCI(rec, 'Mapped_L5_Feature', 'mapped_l5_feature');
    const tokFallbackRaw =
      rec.Token_Str ?? rec.token_str ?? getPropertyCI(rec, 'Token_Str', 'token_str');
    const pickMapped =
      typeof mappedL3Raw === 'string' ? mappedL3Raw.trim() : String(mappedL3Raw ?? '').trim();
    const pickTokFb =
      typeof tokFallbackRaw === 'string' ? tokFallbackRaw.trim() : String(tokFallbackRaw ?? '').trim();
    const clientFactToken = pickTokFb;
    const anchorModelFeature = pickMapped || pickTokFb;
    const tokenStr = clientFactToken || anchorModelFeature;
    const vLogicRaw =
      rec.Validation_Logic ?? rec.validation_logic ?? getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const iqRaw =
      rec.interview_question ??
      rec.Interview_Question ??
      getPropertyCI(rec, 'interview_question', 'Interview_Question');
    const consRaw = rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    const targetFeatureId = typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    const validationLogic = typeof vLogicRaw === 'string' ? vLogicRaw.trim() : String(vLogicRaw ?? '').trim();
    const interviewQuestion = typeof iqRaw === 'string' ? iqRaw.trim() : String(iqRaw ?? '').trim();
    const consistency = typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (!targetFeatureId && !tokenStr) continue;
    out.push({
      targetFeatureId,
      tokenStr,
      clientFactToken,
      anchorModelFeature,
      validationLogic,
      interviewQuestion,
      consistency,
    });
  }
  return out;
}

/** 自任务 5 L3 模型输出解析 **`Token_Validation_Mapping`**（`L3_Process_Feature_Matrix` 内优先）。 */
export function parseTask5L3TokenValidationMappingForAlignment(l3ProcessInferenceRaw: string): Task2L1TvmParsedRow[] {
  const root = readL3ProcessJsonRootRecordForProgress(l3ProcessInferenceRaw);
  if (!root) return [];
  const m = readL3Task5ProcessMatrixRecordForProgress(root);
  return parseL3MatrixTokenValidationMappingForAlignment(root, m);
}

/** 任务 5 L3：锚定特征为 `Mapped_L3_Feature`（L3~L5 字段族）。 */
export function buildTask5L3ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L3_L5');
}

/** 自任务 5.5 L3.5 模型输出解析 **`L3_5_VSM_Inference_Matrix.Token_Validation_Mapping`**。 */
export function parseTask55L3TokenValidationMappingForAlignment(l3VsmInferenceRaw: string): Task2L1TvmParsedRow[] {
  const root = readL3ProcessJsonRootRecordForProgress(l3VsmInferenceRaw);
  if (!root) return [];
  const m = readL3Task55VsmMatrixRecordForProgress(root);
  return parseL3MatrixTokenValidationMappingForAlignment(root, m);
}

/** 任务 5.5 L3.5：锚定特征为 `Mapped_L3_Feature`（L3~L5 字段族）。 */
export function buildTask55L3ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L3_L5');
}

/** 自任务 5.1 L3.1 模型输出解析 **`L3_Value_Proposition_Matrix.Token_Validation_Mapping`**。 */
export function parseTask51L3TokenValidationMappingForAlignment(
  l3ValuePropositionRaw: string,
): Task2L1TvmParsedRow[] {
  const root = readL3ProcessJsonRootRecordForProgress(l3ValuePropositionRaw);
  if (!root) return [];
  const m = readL3Task51ValuePropositionMatrixRecordForProgress(root);
  return parseL3MatrixTokenValidationMappingForAlignment(root, m);
}

/** 任务 5.1 L3.1：锚定特征为 `Mapped_L5_Feature` →「业务能力单元」。 */
export function buildTask51L3ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L3_L5');
}

function readL3Task52AssetMappingMatrixRecordForProgress(
  rootObj: Record<string, unknown>,
): Record<string, unknown> | null {
  const matrix = asRecord(
    getPropertyCI(rootObj, 'L3_Asset_Mapping_Matrix', 'l3_asset_mapping_matrix'),
  );
  if (matrix) return matrix;
  for (const v of Object.values(rootObj)) {
    const o = asRecord(v);
    if (!o) continue;
    const inner = asRecord(
      getPropertyCI(o, 'L3_Asset_Mapping_Matrix', 'l3_asset_mapping_matrix'),
    );
    if (inner) return inner;
  }
  return null;
}

/** 任务 5.2 sync 前规范：仅保留 `L3_Asset_Mapping_Matrix`（与后端 `normalizeL52AssetMappingRawForServerSync` 一致） */
export function normalizeL52AssetMappingRawForServerSync(
  l3AssetMappingRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3AssetMappingRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL3ProcessJsonRootRecordForProgress(raw);
  if (!root) return { ok: false, message: 'JSON 解析失败' };
  const matrix = readL3Task52AssetMappingMatrixRecordForProgress(root);
  if (matrix) {
    try {
      return { ok: true, normalized: JSON.stringify({ L3_Asset_Mapping_Matrix: matrix }) };
    } catch {
      return { ok: false, message: 'JSON 序列化失败' };
    }
  }
  const tk = getPropertyCI(root, 'Target_KV', 'target_kv', 'Target_kv');
  if (Array.isArray(tk) && tk.length > 0) {
    try {
      return {
        ok: true,
        normalized: JSON.stringify({ L3_Asset_Mapping_Matrix: { Target_KV: tk } }),
      };
    } catch {
      return { ok: false, message: 'JSON 序列化失败' };
    }
  }
  return {
    ok: false,
    message:
      '未找到 L3_Asset_Mapping_Matrix 或非空 Target_KV；请确认根键为 L3_Asset_Mapping_Matrix 且 Feature_Key=「业务能力字段集」',
  };
}

function task52TargetKvDedupKeyFromItem(item: unknown): string | null {
  const row = asRecord(item);
  if (!row) return null;
  const fv = String(
    row.Feature_Value ?? row.feature_value ?? row.featureValue ?? '',
  ).trim();
  if (!fv) return null;
  return `业务能力字段集::${fv}`;
}

/** 合并多张表现有表格循环推理的 L3_Asset_Mapping_Matrix（去重 Target_KV / TVM）后供 sync */
export function mergeL52AssetMappingRawOutputsForServerSync(
  raws: string[],
): { ok: true; normalized: string } | { ok: false; message: string } {
  const mergedTargetKv: unknown[] = [];
  const mergedTvm: unknown[] = [];
  const seenKv = new Set<string>();
  const seenTvm = new Set<string>();

  for (let i = 0; i < raws.length; i++) {
    const norm = normalizeL52AssetMappingRawForServerSync(raws[i] ?? '');
    if (!norm.ok) {
      return { ok: false, message: `第 ${i + 1} 张表模型输出无法规范化：${norm.message}` };
    }
    let matrix: Record<string, unknown>;
    try {
      const obj = JSON.parse(norm.normalized) as Record<string, unknown>;
      matrix = asRecord(obj.L3_Asset_Mapping_Matrix) ?? {};
    } catch {
      return { ok: false, message: `第 ${i + 1} 张表合并 JSON 解析失败` };
    }
    const tk = matrix.Target_KV ?? matrix.target_kv;
    if (Array.isArray(tk)) {
      for (const item of tk) {
        const dedup = task52TargetKvDedupKeyFromItem(item);
        if (!dedup || seenKv.has(dedup)) continue;
        seenKv.add(dedup);
        mergedTargetKv.push(item);
      }
    }
    const tvm = matrix.Token_Validation_Mapping ?? matrix.token_validation_mapping;
    if (Array.isArray(tvm)) {
      for (const item of tvm) {
        const row = asRecord(item);
        const id = String(row?.Target_FeatureID ?? row?.target_feature_id ?? '').trim();
        const tvmKey = id || JSON.stringify(item);
        if (seenTvm.has(tvmKey)) continue;
        seenTvm.add(tvmKey);
        mergedTvm.push(item);
      }
    }
  }

  if (!mergedTargetKv.length) {
    return { ok: false, message: '合并后 Target_KV 为空；请确认各张表均输出 Feature_Key=「业务能力字段集」' };
  }
  try {
    const payload: Record<string, unknown> = { Target_KV: mergedTargetKv };
    if (mergedTvm.length) payload.Token_Validation_Mapping = mergedTvm;
    return {
      ok: true,
      normalized: JSON.stringify({ L3_Asset_Mapping_Matrix: payload }),
    };
  } catch {
    return { ok: false, message: '合并结果 JSON 序列化失败' };
  }
}

/** 自任务 5.2 L3.2 模型输出解析 **`L3_Asset_Mapping_Matrix.Token_Validation_Mapping`**。 */
export function parseTask52L3TokenValidationMappingForAlignment(
  l3AssetMappingRaw: string,
): Task2L1TvmParsedRow[] {
  const root = readL3ProcessJsonRootRecordForProgress(l3AssetMappingRaw);
  if (!root) return [];
  const m = readL3Task52AssetMappingMatrixRecordForProgress(root);
  return parseL3MatrixTokenValidationMappingForAlignment(root, m);
}

/** 任务 5.2 L3.2：锚定特征为 `Mapped_L3_Feature` →「业务能力单元」。 */
export function buildTask52L3ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L3_L5');
}

function readL3Task53WorkflowFlowMatrixRecordForProgress(
  rootObj: Record<string, unknown>,
): Record<string, unknown> | null {
  const matrix = asRecord(
    getPropertyCI(rootObj, 'L3_Workflow_Flow_Matrix', 'l3_workflow_flow_matrix'),
  );
  if (matrix) return matrix;
  for (const v of Object.values(rootObj)) {
    const o = asRecord(v);
    if (!o) continue;
    const inner = asRecord(
      getPropertyCI(o, 'L3_Workflow_Flow_Matrix', 'l3_workflow_flow_matrix'),
    );
    if (inner) return inner;
  }
  return null;
}

/** 任务 5.3 sync 前规范：矩阵清洗 + 与后端 `parseTask53L3TargetKvSyncRows` 同口径校验 */
/** 合并多条业务流程循环推理的 L3_Workflow_Flow_Matrix（去重 Target_KV / TVM）后供 sync */
export function mergeL53WorkflowFlowRawOutputsForServerSync(
  raws: string[],
): { ok: true; normalized: string } | { ok: false; message: string } {
  const mergedTargetKv: unknown[] = [];
  const mergedTvm: unknown[] = [];
  const seenKv = new Set<string>();
  const seenTvm = new Set<string>();

  for (let i = 0; i < raws.length; i++) {
    const norm = normalizeL53WorkflowFlowRawForServerSync(raws[i] ?? '');
    if (!norm.ok) {
      return { ok: false, message: `第 ${i + 1} 条业务流程模型输出无法规范化：${norm.message}` };
    }
    let matrix: Record<string, unknown>;
    try {
      const obj = JSON.parse(norm.normalized) as Record<string, unknown>;
      matrix = asRecord(obj.L3_Workflow_Flow_Matrix) ?? {};
    } catch {
      return { ok: false, message: `第 ${i + 1} 条业务流程合并 JSON 解析失败` };
    }
    const tk = matrix.Target_KV ?? matrix.target_kv;
    if (Array.isArray(tk)) {
      for (const item of tk) {
        const row = asRecord(item);
        if (!row) continue;
        const fv = row.Feature_Value ?? row.feature_value;
        let dedup = '';
        if (fv != null && typeof fv === 'object' && !Array.isArray(fv)) {
          dedup = String((fv as Record<string, unknown>).workflow_name ?? '').trim();
        }
        if (!dedup) dedup = JSON.stringify(item);
        if (seenKv.has(dedup)) continue;
        seenKv.add(dedup);
        mergedTargetKv.push(item);
      }
    }
    const tvm = matrix.Token_Validation_Mapping ?? matrix.token_validation_mapping;
    if (Array.isArray(tvm)) {
      for (const item of tvm) {
        const row = asRecord(item);
        const id = String(row?.Target_FeatureID ?? row?.target_feature_id ?? '').trim();
        const tvmKey = id || JSON.stringify(item);
        if (seenTvm.has(tvmKey)) continue;
        seenTvm.add(tvmKey);
        mergedTvm.push(item);
      }
    }
  }

  if (!mergedTargetKv.length) {
    return { ok: false, message: '合并后 Target_KV 为空；请确认各流程均输出 Feature_Key=「关键工作流」' };
  }
  try {
    const payload: Record<string, unknown> = { Target_KV: mergedTargetKv };
    if (mergedTvm.length) payload.Token_Validation_Mapping = mergedTvm;
    return {
      ok: true,
      normalized: JSON.stringify({ L3_Workflow_Flow_Matrix: payload }),
    };
  } catch {
    return { ok: false, message: '合并结果 JSON 序列化失败' };
  }
}

export function normalizeL53WorkflowFlowRawForServerSync(
  l3WorkflowFlowRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3WorkflowFlowRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const root = readL3ProcessJsonRootRecordForProgress(raw);
  if (!root) return { ok: false, message: 'JSON 解析失败' };
  let matrix = readL3Task53WorkflowFlowMatrixRecordForProgress(root);
  if (!matrix) {
    const tk = getPropertyCI(root, 'Target_KV', 'target_kv', 'Target_kv');
    if (Array.isArray(tk) && tk.length > 0) {
      matrix = { Target_KV: tk };
    }
  }
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L3_Workflow_Flow_Matrix 或非空 Target_KV；请确认根键为 L3_Workflow_Flow_Matrix 且 Feature_Key=「关键工作流」',
    };
  }
  const sanitized = sanitizeTask53WorkflowFlowMatrixForSync(matrix);
  if (!sanitized.ok) return sanitized;
  try {
    return {
      ok: true,
      normalized: JSON.stringify({ L3_Workflow_Flow_Matrix: sanitized.matrix }),
    };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/** 自任务 5.3 L3.3 模型输出解析 **`L3_Workflow_Flow_Matrix.Token_Validation_Mapping`**。 */
export function parseTask53L3TokenValidationMappingForAlignment(
  l3WorkflowFlowRaw: string,
): Task2L1TvmParsedRow[] {
  const root = readL3ProcessJsonRootRecordForProgress(l3WorkflowFlowRaw);
  if (!root) return [];
  const m = readL3Task53WorkflowFlowMatrixRecordForProgress(root);
  return parseL3MatrixTokenValidationMappingForAlignment(root, m);
}

/** 自任务 7 L4 模型输出解析 **`L4_Collaboration_Inference_Matrix.Token_Validation_Mapping`**。 */
export function parseTask7L4TokenValidationMappingForAlignment(
  l4CollaborationInferenceRaw: string,
): Task2L1TvmParsedRow[] {
  const root = readL3ProcessJsonRootRecordForProgress(l4CollaborationInferenceRaw);
  if (!root) return [];
  const m = readL4Task7CollaborationMatrixRecordForProgress(root);
  return parseL3MatrixTokenValidationMappingForAlignment(root, m);
}

/** 任务 7 L4：锚定特征为 `Mapped_L3_Feature`（L3~L5 字段族）。 */
export function buildTask7L4ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L3_L5');
}

/** 自任务 8 L4.5 模型输出解析 **`L4_5_Prototype_Detail_Matrix` / `L4_Prototype_Inference_Matrix` 内 TVM**。 */
export function parseTask8L45TokenValidationMappingForAlignment(
  l4PrototypeInferenceRaw: string,
): Task2L1TvmParsedRow[] {
  const root = readL3ProcessJsonRootRecordForProgress(l4PrototypeInferenceRaw);
  if (!root) return [];
  const m = readL4Task8PrototypeMatrixRecordForProgress(root);
  return parseL3MatrixTokenValidationMappingForAlignment(root, m);
}

/** 任务 8 L4.5：锚定特征为 `Mapped_L3_Feature`（L3~L5 字段族）。 */
export function buildTask8L45ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L3_L5');
}

/** 自任务 8.5 L4.7 模型输出解析物理 Hook 矩阵内 TVM。 */
export function parseTask85L475TokenValidationMappingForAlignment(
  l475PhysicalHookInferenceRaw: string,
): Task2L1TvmParsedRow[] {
  const root = readL3ProcessJsonRootRecordForProgress(l475PhysicalHookInferenceRaw);
  if (!root) return [];
  const m = readL475Task85PhysicalHookMatrixRecordForProgress(root);
  return parseL3MatrixTokenValidationMappingForAlignment(root, m);
}

/** 任务 8.5 L4.7：锚定特征为 `Mapped_L3_Feature`（L3~L5 字段族）。 */
export function buildTask85L475ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L3_L5');
}

/** 自任务 9 L5 模型输出解析蓝图矩阵内 TVM。 */
export function parseTask9L5TokenValidationMappingForAlignment(
  l5BlueprintInferenceRaw: string,
): Task2L1TvmParsedRow[] {
  const root = readL3ProcessJsonRootRecordForProgress(l5BlueprintInferenceRaw);
  if (!root) return [];
  const m = readL5Task9BlueprintMatrixRecordForProgress(root);
  return parseL3MatrixTokenValidationMappingForAlignment(root, m);
}

/** 任务 9 L5：锚定特征为 `Mapped_L3_Feature`（L3~L5 字段族）。 */
export function buildTask9L5ConflictDatasetUserBlock(rows: Task2L1TvmParsedRow[]): string {
  return buildAlignmentQuestionnaireUserBlock(rows, 'L3_L5');
}

/**
 * 从任务 4 L2 原始输出中提取 **`L2_Value_Inference_Matrix.Token_Validation_Mapping`** 的可读 JSON（矩阵内优先，根级兜底）。
 */
export function extractTask4L2TokenValidationMappingProgressSnippet(
  l2ValueInferenceRaw: string,
  maxChars = 12000,
): string {
  const rootObj = readL2ValueJsonRootRecordForProgress(l2ValueInferenceRaw);
  if (!rootObj) {
    return '（未能从模型输出中解析 JSON 根对象）';
  }
  let m = asRecord(getPropertyCI(rootObj, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'));
  if (!m) {
    m = asRecord(getPropertyCI(rootObj, 'L2_Value_Inference_Matrix', 'l2_value_inference_matrix'));
  }
  if (!m) {
    for (const v of Object.values(rootObj)) {
      const o = asRecord(v);
      if (!o) continue;
      const innerL3 = asRecord(getPropertyCI(o, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'));
      if (innerL3) {
        m = innerL3;
        break;
      }
      const innerM = asRecord(getPropertyCI(o, 'L2_Value_Inference_Matrix', 'l2_value_inference_matrix'));
      if (innerM) {
        m = innerM;
        break;
      }
    }
  }
  let tv: unknown =
    m !== null ? getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping') : undefined;
  if (tv === undefined || tv === null) {
    tv = getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (tv === undefined || tv === null) {
    return '（本段输出中未找到 Token_Validation_Mapping 字段）';
  }
  let s = '';
  try {
    s = JSON.stringify(tv, null, 2);
  } catch {
    s = String(tv);
  }
  if (s.length > maxChars) {
    return `${s.slice(0, maxChars)}\n…（已截断，共 ${s.length} 字符）`;
  }
  return s;
}
