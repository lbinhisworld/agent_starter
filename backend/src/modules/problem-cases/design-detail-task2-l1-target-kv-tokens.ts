/**
 * [INPUT]: 任务 2 L1 大模型原始 JSON 字符串（`inferDesignDetailL1EntityPortraitFromContext` 输出）
 * [OUTPUT]: 从 `L1_Inference_Matrix.Target_KV`…解析 **Feature_Key**…；解析 **Evidence_Support_Chain** 与 **`Token_Validation_Mapping`** 供写入 **`DesignLogicLink`**（含 **`linkKind`** / **`validationConsistency`**）；**任务 3 L2** 另经 **`parseTokenValidationMappingFromL2InferenceRaw`**；**任务 4 L2** 经 **`parseTokenValidationMappingFromL2ValueInferenceRaw`**（`L2_Value_Inference_Matrix`）
 * [POS]: problem-cases；由 `ProblemCaseService.syncDesignDetailTask2L1TargetKvTokens` / **`syncDesignDetailTask3L2TargetKvTokens`** / **`syncDesignDetailTask4L2TargetKvTokens`** 调用
 *
 * [PROTOCOL]: 变更 L1 输出契约或 `Feature_Key` 语义时须同步 `frontend/js/task1BusinessInsight.js` 系统提示词与 `docs/agents/backend/01-context.md`；**`Token_Validation_Mapping`** 经 **`parseTokenValidationMappingFromL1Raw`** 解析后由 **`replaceTask2L1TargetKvFeatureKeyTokens`** 写入 **`DesignLogicLink`**（Prisma `linkKind=REVERSE_VALIDATION`，MySQL ENUM **「反向验证」**；`validationConsistency` 存 **Consistency**）；**任务 3** 经 **`parseTokenValidationMappingFromL2InferenceRaw`** 与 **`replaceTask3L2TargetKvFeatureKeyTokens`** 写 **任务 3 L2 → 任务 1** 反向边；**任务 4** 经 **`parseTokenValidationMappingFromL2ValueInferenceRaw`** 与 **`replaceTask4L2TargetKvFeatureKeyTokens`** 写 **任务 4 L2 → 任务 1** 反向边；**任务 5.1** Evidence 上游链 + **`buildTask51IntraValuePropositionForwardLinks`**（**核心价值主张/交付模式定性→业务能力单元**）经 **`replaceTask5L3TargetKvFeatureKeyTokens`** 落库（上游 **1~5** `featureId` 解析见 `prisma-problem-case.repository.ts`）；**任务 7** 在 Evidence 链落库后由 **`buildTask7IntraFlowForwardLinks`** 合成 **所属业务流程→协作节点** 正向归纳边；**Evidence_Support_Chain** 与 `DesignLogicLink` 其它落库规则变更时须同步 `prisma-problem-case.repository.ts`；解析阶段 **`[problem-case:task2-l1-graph]`** / **`[problem-case:task3-l2-graph]`*** / **`[problem-case:task4-l2-graph]`** 诊断日志变更时须与 `problem-case.service.ts` 之 **`[problem-case:task2-l1-target-kv]`** / **`task3-l2-target-kv`** / **`task4-l2-target-kv`**（含 **`phase: token_validation_parse`**）及仓储 **`skip_token_validation_link`** / **`token_validation_links_inserted`** / **`replace_task*_tx_summary`** 一并核对
 * FE-20260508-t2l1-peel：支持上游/代理将整段 JSON 再包一层字符串（`JSON.parse` 一次得 `string`）及 UTF-8 BOM；请求体若误传 object 由 service 层 Zod 先 `JSON.stringify`。
 * FE-20260515-t3l2-bim：`L2_Business_Inference_Matrix` 与 `L2_Inference_Matrix` 统一经 **`readL2Task3MatrixContainerRecord`**；`coerceHttpBodyToL2InferenceRawString` 同步识别两键。
 * FE-20260515-t2l1-prompt：任务 2 L1 模型 **`Causality_Analysis`** 为 **`L1_Core_Insight`** + **`Conflict_Resolution_Summary`** / **`Schema_Gene_Inheritance`**（兼容旧键 Logic_Gap_Report / Insight_Resolution_Summary）；**`Extended_Features`** 与 **`Target_KV`** 一并经 **`parseTask2L1TargetKvSyncRows`** 落特征（合并追加；裂变键如 `组织拓扑_01` 不与标准四键归并）；**`Token_Validation_Mapping.interview_question`** 仍不落特征表。
 * Target_KV 可选字段：`Inference_Weight` 仍解析入 `Task2L1TargetKvSyncRow`；`Evidence_Source` / `Logic_Rule` 兼容旧模型；**Evidence_Support_Chain**：链上项为 **SourceFeature**（`FeatureID` **须与输入 TSV 第一列一致**）+ **logic** + **contribution**（落库为 `DesignLogicLink.weight`）；源 `featureId` 不存在于本案例时跳过该边并打 **`skip_logic_link_unknown_source`**；链形态异常时打 **`parse_evidence_chain_*`** 阶段日志。
 */

export type ParseTask2L1TargetKvResult =
  | { ok: true; featureKeys: string[] }
  | { ok: false; message: string };

/** 由 `Token_Validation_Mapping` 解析出的反向校验边（任务 2 L1 或任务 3 L2 结论特征 → 任务 1 特征；`mappedL1FeatureKey` 在任务 3 场景内存 **L2 四键**） */
export type Task2L1TokenValidationLinkPlan = {
  targetFeatureId: string;
  /** 任务 2：与 `Target_KV[].Feature_Key` 对齐（L1 三键）。任务 3：与 L2 `Target_KV[].Feature_Key` 对齐（核心资产属性 / 交付模式 / 行业类别） */
  mappedL1FeatureKey: string;
  validationLogic: string;
  validationWeight: number;
  /** 来自模型 `Consistency`，截断至 32 字写入 `DesignLogicLink.validationConsistency` */
  consistencyLabel: string;
};

/** 由 `Evidence_Support_Chain` 解析出的单条逻辑边（`replaceTask2L1TargetKvFeatureKeyTokens` 写入 `DesignLogicLink`） */
export type Task2L1EvidenceLinkPlan = {
  sourceFeatureId: string;
  logic: string;
  /** 来自链上 `contribution`，已钳制到 [0,1]；无效时落库侧默认 0.5 */
  weight: number;
  /** 证据项 `tokenstr`（任务 9 双源归因：识别「系统一级模块」横向线） */
  sourceTokenstr?: string;
};

/** 任务 2 L1 同步：单条 Target_KV 行（写 `DesignDetailTaskToken` + `DesignFeatureNode`） */
export type Task2L1TargetKvSyncRow = {
  featureKey: string;
  /** 缺省由落库侧归一为「等于」 */
  operator?: string;
  /** 对应 `DesignFeatureNode.value`，多为 `Feature_Value` 标量；若含 **value_ref_domain** 则落库为 `{ Feature_Value, value_ref_domain }` */
  featureValue: unknown;
  /** 模型 `value_ref_domain`；为 N/A 或空时不写入 `value` 对象 */
  valueRefDomain?: string;
  /** 模型 `inference_summary`；空时不写入 `value` 对象 */
  inferenceSummary?: string;
  /** 任务 5.1：`business_function`（核心经营目标职能）；空时不写入 `value` 对象 */
  businessFunction?: string;
  /** 任务 5.1：`causality_summary`；用于主张→能力单元正向归纳边 `logic` */
  causalitySummary?: string;
  /** 模型 `Evidence_Source`（当前不落库为逻辑边） */
  evidenceSource?: string;
  /** 模型 `Logic_Rule`（当前不落库为逻辑边） */
  logicRule?: string;
  /** 任务 9 二级菜单行：`Belongs_To_Primary_Module`（历史契约；V4.1 任务 9 已不再产出二级菜单） */
  belongsToPrimaryModule?: string;
  /** 任务 9 系统一级模块行：`Tech_Host_Platform` 工具宿主终审 */
  techHostPlatform?: string;
  /** 模型 `Inference_Weight`（任务 10 主表→基础表正向归纳边权重） */
  inferenceWeight?: number;
  /** 任务 10：`Induction_Type`（主表基准 / 主子级联纵向裂变 / 主表正向归纳派生） */
  inductionType?: string;
  /** 任务 10：上游实体 `Feature_Value` 表名，供 `Parent_Table_Ref` 对齐 */
  parentTableRef?: string;
  /** 任务 10：外键/引用映射说明（可并入逻辑边文案） */
  referenceFieldMapping?: string;
  /** 任务 10：级联正向归纳逻辑文案（落库为 `DesignLogicLink.logic`） */
  introductionReason?: string;
  /** 由 `Evidence_Support_Chain` 解析；与当前行 `Feature_Key` 落库后的 `featureId` 成对写 `DesignLogicLink` */
  evidenceLinks?: Task2L1EvidenceLinkPlan[];
  /** 任务 2 L1：从上游化石透传的 `Validation_Status`（Pending / Resolved_By_Customer） */
  validationStatus?: string;
  /** 任务 5.2：挂载的组织业务能力单元（`associated_capability_unit`） */
  associatedCapabilityUnit?: string;
  /** 任务 5.2：行内嵌套字段结构体数组（`fields_schema_tree`） */
  fieldsSchemaTree?: unknown;
};

export type ParseTask2L1TargetKvRowsResult =
  | { ok: true; rows: Task2L1TargetKvSyncRow[] }
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

/** 提示词 schema 占位 `0.0-1.0` 非合法 JSON 数字，模型照抄会导致 `JSON.parse` 失败 */
function fixLlmNumericRangePlaceholderInJson(text: string): string {
  return String(text || '').replace(/:\s*0\.0\s*-\s*1\.0\b/g, ': 0.85');
}

/** 修复大模型 JSON 常见瑕疵：弯引号、数组/对象尾逗号、权重区间占位符 */
function relaxLlmJsonForParse(text: string): string {
  return fixLlmNumericRangePlaceholderInJson(
    stripBom(String(text || ''))
      .replace(/[\u201C\u201D\u201E\u2033\u2036]/g, '"')
      .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
      .replace(/,\s*([}\]])/g, '$1'),
  );
}

/**
 * 修复字符串值内未转义的双引号（常见于 inference_summary 引用「插入行-字段赋值」等短语）。
 * 若 `"` 后首个非空白字符为 JSON 结构符（`,` `}` `]` `:`），视为字符串结束；否则转义为 `\"`。
 */
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

/** 修复字符串值内未转义的换行/制表符（常见于 inference_summary 多行对账段落） */
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

/** 模型偶发 `undefined` / `NaN` 字面量会导致 `JSON.parse` 失败 */
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

/**
 * 尝试修复 LLM 输出被 max_tokens 截断的 JSON。
 * 策略：
 * 1. 回退到最后一个完整的 JSON 对象边界（`},` 或 `},\n` 或 `}`）
 * 2. 截掉最后一个不完整元素
 * 3. 补全缺失的 `]` `}`
 */
function repairTruncatedJson(raw: string): string | null {
  const s = String(raw).trim();
  if (!s.length) return null;
  const start = s.indexOf('{');
  if (start < 0) return null;
  let buf = s.slice(start);
  // Check if already balanced
  let depthObj = 0;
  let depthArr = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (escape) { escape = false; continue; }
    if (inString) { if (c === '\\') escape = true; else if (c === '"') inString = false; continue; }
    if (c === '"') { inString = true; continue; }
    if (c === '{') depthObj++;
    else if (c === '}') depthObj--;
    else if (c === '[') depthArr++;
    else if (c === ']') depthArr--;
  }
  if (depthObj === 0 && depthArr === 0 && !inString) return null;
  // Strategy: find the last complete object boundary and truncate there
  // Look backwards for '},' pattern — end of a complete element in an array/object
  const patterns = ['},', '},\n', '},\r\n'];
  let lastCompleteIdx = -1;
  for (const pat of patterns) {
    const idx = buf.lastIndexOf(pat);
    if (idx > lastCompleteIdx) lastCompleteIdx = idx;
  }
  if (lastCompleteIdx < 0) {
    // Try finding just '}' as last complete boundary
    lastCompleteIdx = buf.lastIndexOf('}');
  }
  if (lastCompleteIdx < 0) return null;
  // Truncate after the last complete '}'
  buf = buf.slice(0, lastCompleteIdx + 1);
  // Now re-count open brackets
  depthObj = 0;
  depthArr = 0;
  inString = false;
  escape = false;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (escape) { escape = false; continue; }
    if (inString) { if (c === '\\') escape = true; else if (c === '"') inString = false; continue; }
    if (c === '"') { inString = true; continue; }
    if (c === '{') depthObj++;
    else if (c === '}') depthObj--;
    else if (c === '[') depthArr++;
    else if (c === ']') depthArr--;
  }
  // Close remaining open brackets
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
      const subCandidates = [
        sub,
        relaxLlmJsonForParse(sub),
        relaxLlmJsonForParseDeep(sub),
        relaxLlmJsonNonFiniteLiterals(relaxLlmJsonForParseDeep(sub)),
      ];
      for (const subChunk of subCandidates) {
        try {
          return JSON.parse(subChunk) as unknown;
        } catch {
          /* continue */
        }
      }
    }
  }
  // Last resort: try to repair truncated JSON
  const truncated = repairTruncatedJson(stripped);
  if (truncated) {
    const truncCandidates = [
      truncated,
      relaxLlmJsonForParse(truncated),
      relaxLlmJsonForParseDeep(truncated),
      relaxLlmJsonNonFiniteLiterals(relaxLlmJsonForParseDeep(truncated)),
    ];
    for (const tc of truncCandidates) {
      try {
        return JSON.parse(tc) as unknown;
      } catch {
        /* continue */
      }
    }
  }
  return null;
}

/**
 * 若 `JSON.parse` 得到的是「内含 JSON 文本的 string」（常见于双重 stringify 或代理层包装），则继续解析直至得到非 string 或失败。
 */
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

/** 不区分大小写、空白归一为下划线后匹配属性名（兼容 snake_case / 模型变体键名） */
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

/** 将 Target_KV 规范为「行」列表：数组，或对象且值全为 string / 全为 object */
function normalizeTargetKvRows(tk: unknown): unknown[] | null {
  if (Array.isArray(tk)) return tk.length ? tk : null;
  const rec = asRecord(tk);
  if (!rec) return null;
  const vals = Object.values(rec);
  if (vals.length === 0) return null;
  if (vals.every((v) => typeof v === 'string')) return vals;
  if (vals.every((v) => asRecord(v) !== null)) return vals;
  const objectsOnly = vals.filter((v) => asRecord(v) !== null);
  return objectsOnly.length ? objectsOnly : null;
}

function readTargetKvFromContainer(container: Record<string, unknown>): unknown[] | null {
  const tk = getPropertyCI(container, 'Target_KV', 'target_kv', 'Target_kv');
  return normalizeTargetKvRows(tk);
}

/** 任务 2 L1 矩阵根键：产品四轨版 `L1_Entity_Inference_Matrix` 与历史 `L1_Inference_Matrix` 并存 */
function readL1MatrixContainer(root: Record<string, unknown>): Record<string, unknown> | null {
  const keys = [
    'L1_Entity_Inference_Matrix',
    'l1_entity_inference_matrix',
    'L1_Inference_Matrix',
    'l1_inference_matrix',
    'L1_Inference_Result',
    'l1_inference_result',
  ] as const;
  for (const k of keys) {
    const m = asRecord(getPropertyCI(root, k));
    if (m) return m;
  }
  return null;
}

function readTargetKvArray(root: Record<string, unknown>): unknown[] | null {
  const m = readL1MatrixContainer(root);
  if (m) {
    const rows = readTargetKvFromContainer(m);
    if (rows?.length) return rows;
  }
  const top = readTargetKvFromContainer(root);
  if (top?.length) return top;
  // 一层包装：如 { "response": { "L1_Entity_Inference_Matrix": ... } }
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    const innerM = readL1MatrixContainer(o);
    if (innerM) {
      const rows = readTargetKvFromContainer(innerM);
      if (rows?.length) return rows;
    }
    const nested = readTargetKvFromContainer(o);
    if (nested?.length) return nested;
  }
  return null;
}

function operatorFromRow(row: Record<string, unknown>): string | undefined {
  const v =
    row.Operator ??
    row.operator ??
    getPropertyCI(row, 'Operator', 'operator');
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return undefined;
}

function featureValueFromRow(row: Record<string, unknown>): unknown {
  const v =
    row.Feature_Value ??
    row.feature_value ??
    getPropertyCI(row, 'Feature_Value', 'feature_value', 'Feature Value');
  if (v !== undefined) return v;
  for (const [k, val] of Object.entries(row)) {
    if (k.replace(/\s+/g, '_').toLowerCase() === 'feature_value') return val;
  }
  return null;
}

function valueRefDomainFromRow(row: Record<string, unknown>): string | undefined {
  const v =
    row.value_ref_domain ??
    row.Value_Ref_Domain ??
    getPropertyCI(row, 'value_ref_domain', 'Value_Ref_Domain', 'value ref domain');
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return undefined;
}

function inferenceSummaryFromRow(row: Record<string, unknown>): string | undefined {
  const v =
    row.inference_summary ??
    row.Inference_Summary ??
    getPropertyCI(row, 'inference_summary', 'Inference_Summary', 'inference summary');
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return undefined;
}

function businessFunctionFromRow(row: Record<string, unknown>): string | undefined {
  const v =
    row.business_function ??
    row.Business_Function ??
    getPropertyCI(row, 'business_function', 'Business_Function', 'business function');
  if (v === null || v === undefined) return undefined;
  const s = typeof v === 'string' ? v.trim() : String(v).trim();
  return s.length ? s : undefined;
}

function techHostPlatformFromRow(row: Record<string, unknown>): string | undefined {
  const v = getPropertyCI(row, 'Tech_Host_Platform', 'tech_host_platform', 'Tech Host Platform');
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

function evidenceSourceFromRow(row: Record<string, unknown>): string | undefined {
  const v =
    row.Evidence_Source ??
    row.evidence_source ??
    getPropertyCI(row, 'Evidence_Source', 'evidence_source', 'Evidence Source');
  if (v == null) return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return undefined;
}

function logicRuleFromRow(row: Record<string, unknown>): string | undefined {
  const v =
    row.Logic_Rule ??
    row.logic_rule ??
    getPropertyCI(row, 'Logic_Rule', 'logic_rule', 'Logic Rule');
  if (v == null) return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return undefined;
}

function validationStatusFromRow(row: Record<string, unknown>): string | undefined {
  const v =
    row.Validation_Status ??
    row.validation_status ??
    getPropertyCI(row, 'Validation_Status', 'validation_status', 'ValidationStatus');
  if (v == null || v === undefined) return undefined;
  const s = typeof v === 'string' ? v.trim() : String(v).trim();
  return s.length ? s : undefined;
}

function associatedCapabilityUnitFromRow(row: Record<string, unknown>): string | undefined {
  const v =
    row.associated_capability_unit ??
    row.associatedCapabilityUnit ??
    getPropertyCI(row, 'associated_capability_unit', 'associatedCapabilityUnit');
  if (v == null || v === undefined) return undefined;
  const s = typeof v === 'string' ? v.trim() : String(v).trim();
  return s.length ? s : undefined;
}

function fieldsSchemaTreeFromRow(row: Record<string, unknown>): unknown | undefined {
  const v =
    row.fields_schema_tree ??
    row.fieldsSchemaTree ??
    getPropertyCI(row, 'fields_schema_tree', 'fieldsSchemaTree');
  if (Array.isArray(v) && v.length > 0) return v;
  return undefined;
}

function inferenceWeightFromRow(row: Record<string, unknown>): number | undefined {
  const v =
    row.Inference_Weight ??
    row.inference_weight ??
    getPropertyCI(row, 'Inference_Weight', 'inference_weight', 'Inference Weight');
  if (v == null || v === undefined) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.trim().replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function causalitySummaryFromRow(row: Record<string, unknown>): string | undefined {
  const v =
    row.causality_summary ??
    row.Causality_Summary ??
    getPropertyCI(row, 'causality_summary', 'Causality_Summary');
  if (v == null || v === undefined) return undefined;
  const s = typeof v === 'string' ? v.trim() : String(v).trim();
  return s.length ? s : undefined;
}

function featureKeyFromRow(row: Record<string, unknown>): string | null {
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

/** 与 `DesignLogicLink.weight` 约定一致：钳制到 [0,1]；无效则 0.5 */
function contributionToLinkWeight(raw: unknown): number {
  if (raw == null) return 0.5;
  let n: number;
  if (typeof raw === 'number') n = raw;
  else if (typeof raw === 'string') n = parseFloat(raw.trim().replace(/,/g, ''));
  else n = Number(raw);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/** 从单条 Evidence_Support_Chain 元素取源特征 `featureId`（优先嵌套 `SourceFeature`） */
function parseSourceFeatureIdFromEvidenceItem(rec: Record<string, unknown>): string | null {
  const nested =
    asRecord(rec.SourceFeature) ??
    asRecord(rec.source_feature) ??
    asRecord(getPropertyCI(rec, 'SourceFeature', 'source_feature'));
  const pickId = (o: Record<string, unknown>): string | null => {
    const fid =
      o.FeatureID ??
      o.featureId ??
      o.feature_id ??
      getPropertyCI(o, 'FeatureID', 'feature_id', 'Feature Id');
    if (typeof fid === 'string') {
      const t = fid.trim();
      return t.length ? t : null;
    }
    if (typeof fid === 'number' && Number.isFinite(fid)) return String(fid);
    return null;
  };
  if (nested) {
    const id = pickId(nested);
    if (id) return id;
  }
  return pickId(rec);
}

/** 读取单条 `Target_KV` 行上的原始 **Evidence_Support_Chain** 字段（未校验形态） */
function readEvidenceSupportChainRaw(row: Record<string, unknown>): unknown {
  return (
    row.Evidence_Support_Chain ??
    row.evidence_support_chain ??
    getPropertyCI(row, 'Evidence_Support_Chain', 'evidence_support_chain')
  );
}

/**
 * 从单条 `Target_KV` 行解析 **Evidence_Support_Chain** → 待写 `DesignLogicLink` 的边列表（不含目标 `featureId`，由仓储在插入任务 2 特征后补全）。
 */
/**
 * 将 Evidence_Support_Chain 的 SourceFeature.FeatureID 解析为可写入 DesignLogicLink 的 sourceFeatureId。
 * - `ft_`+12 位：视为已落库 id，原样返回；
 * - 否则先在本批 Target_KV 的 Feature_Key → featureId 映射中查找（任务 4 级联 Derived_Feature 等）。
 */
/** 模型占位/全零主键（如 Input 1 为空时自造的 ft_000000000000）不得写入 DesignLogicLink */
export function isDesignDetailPlaceholderFeatureId(featureId: string): boolean {
  const s = String(featureId || '').trim();
  if (!/^ft_\d{12}$/i.test(s)) return false;
  return /^ft_0{12}$/i.test(s);
}

export function resolveEvidenceLinkSourceFeatureId(
  rawSourceId: string,
  batchFeatureKeyToId: ReadonlyMap<string, string>,
): string {
  const s = String(rawSourceId || '').trim();
  if (!s) return '';
  if (isDesignDetailPlaceholderFeatureId(s)) return '';
  if (/^ft_\d{12}$/i.test(s)) return s;
  const fromBatch = batchFeatureKeyToId.get(s);
  if (fromBatch) return fromBatch;
  return s;
}

export function parseEvidenceSupportChainFromTargetKvRow(row: Record<string, unknown>): Task2L1EvidenceLinkPlan[] {
  const chain = readEvidenceSupportChainRaw(row);
  if (!Array.isArray(chain)) return [];
  const out: Task2L1EvidenceLinkPlan[] = [];
  for (const item of chain) {
    const rec = asRecord(item);
    if (!rec) continue;
    const sourceFeatureId = parseSourceFeatureIdFromEvidenceItem(rec);
    if (!sourceFeatureId) continue;
    const logicRaw = rec.logic ?? rec.Logic ?? getPropertyCI(rec, 'logic', 'Logic');
    let logic =
      typeof logicRaw === 'string'
        ? logicRaw.trim()
        : String(logicRaw ?? '').trim() || '（模型未给出 logic）';
    const predRaw =
      rec.Predecessor_Value ??
      rec.predecessor_value ??
      getPropertyCI(rec, 'Predecessor_Value', 'predecessor_value');
    const pred =
      typeof predRaw === 'string' ? predRaw.trim() : String(predRaw ?? '').trim();
    if (pred.length) {
      logic = `前置锚定=${pred}；${logic}`;
    }
    const w = contributionToLinkWeight(rec.contribution ?? rec.Contribution ?? getPropertyCI(rec, 'contribution', 'Contribution'));
    const tokRaw = getPropertyCI(rec, 'tokenstr', 'TokenStr', 'token_str');
    const sourceTokenstr =
      typeof tokRaw === 'string' && tokRaw.trim().length ? tokRaw.trim() : undefined;
    out.push({
      sourceFeatureId,
      logic,
      weight: w,
      ...(sourceTokenstr ? { sourceTokenstr } : {}),
    });
  }
  return out;
}

function evidenceItemTokenstrFromChainItem(item: unknown): string {
  const rec = asRecord(item);
  if (!rec) return '';
  const tokRaw = getPropertyCI(rec, 'tokenstr', 'TokenStr', 'token_str');
  return typeof tokRaw === 'string' ? tokRaw.trim() : '';
}

/** 任务 9 二级菜单：证据链是否含「系统一级模块」横向归因（双源复合钢印） */
function task9MenuEvidenceReferencesPrimaryModule(
  chainRaw: unknown,
  belongsToPrimaryModule: string | undefined,
): boolean {
  if (!Array.isArray(chainRaw)) return false;
  const belongs = String(belongsToPrimaryModule ?? '').trim();
  for (const item of chainRaw) {
    const rec = asRecord(item);
    if (!rec) continue;
    const tok = evidenceItemTokenstrFromChainItem(item);
    if (tok === '系统一级模块') return true;
    const valRaw = rec.value ?? rec.Value ?? getPropertyCI(rec, 'value', 'Value');
    const val = typeof valRaw === 'string' ? valRaw.trim() : String(valRaw ?? '').trim();
    if (belongs && val === belongs) return true;
    const logic = String(rec.logic ?? rec.Logic ?? '').trim();
    if (logic.includes('横向') && logic.includes('一级模块')) return true;
  }
  return false;
}

/** 解析到 `Target_KV` 数组（与 `parseTask2L1TargetKvSyncRows` / Feature_Key 列表共用） */
function readTargetKvItemsArray(l1InferenceRaw: string): { ok: true; arr: unknown[] } | { ok: false; message: string } {
  const raw = stripBom(String(l1InferenceRaw || '').trim());
  if (!raw.length) {
    return { ok: false, message: '模型输出为空' };
  }
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return { ok: false, message: 'JSON 解析失败' };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) {
    return { ok: false, message: '根节点须为 JSON 对象' };
  }
  const arr = readTargetKvArray(obj);
  if (!arr || arr.length === 0) {
    return { ok: false, message: '未找到 L1_Inference_Matrix.Target_KV 或非空数组' };
  }
  return { ok: true, arr };
}

/** 同 `Feature_Key` + 同取值语义的去重键（允许同键不同值裂变多行） */
function task2L1TargetKvRowDedupKey(featureKey: string, featureValue: unknown, operator?: string): string {
  try {
    return `${featureKey}\u0001${JSON.stringify({ operator: operator ?? '等于', featureValue })}`;
  } catch {
    return `${featureKey}\u0001${String(featureValue)}`;
  }
}

/** 从单条 `Target_KV` / `Extended_Features` 对象解析同步行 */
function parseOneTask2L1TargetKvLikeItem(item: unknown): Task2L1TargetKvSyncRow | null {
  if (item === null || item === undefined) return null;
  let key: string | null = null;
  let operator: string | undefined;
  let featureValue: unknown = null;
  if (typeof item === 'string') {
    key = item.trim().length ? item.trim() : null;
    featureValue = key;
  } else if (typeof item === 'object' && !Array.isArray(item)) {
    const rec = item as Record<string, unknown>;
    key = featureKeyFromRow(rec);
    operator = operatorFromRow(rec);
    featureValue = featureValueFromRow(rec);
    const vrd = valueRefDomainFromRow(rec);
    const inf = inferenceSummaryFromRow(rec);
    const bizFn = businessFunctionFromRow(rec);
    const evidence = evidenceSourceFromRow(rec);
    const logicRule = logicRuleFromRow(rec);
    const inferenceWeight = inferenceWeightFromRow(rec);
    const causalitySummary = causalitySummaryFromRow(rec);
    const validationStatus = validationStatusFromRow(rec);
    const associatedCapabilityUnit = associatedCapabilityUnitFromRow(rec);
    const fieldsSchemaTree = fieldsSchemaTreeFromRow(rec);
    if (!key?.length) return null;
    const chainRaw = readEvidenceSupportChainRaw(rec);
    const evidenceLinks = parseEvidenceSupportChainFromTargetKvRow(rec);
    if (chainRaw != null && !Array.isArray(chainRaw)) {
      try {
        console.warn('[problem-case:task2-l1-graph]', {
          phase: 'parse_evidence_chain_not_array',
          featureKey: key,
          chainType: typeof chainRaw,
        });
      } catch {
        /* ignore */
      }
    } else if (Array.isArray(chainRaw) && chainRaw.length > 0 && evidenceLinks.length === 0) {
      try {
        const head = chainRaw[0];
        let headPreview = '';
        try {
          headPreview =
            typeof head === 'string'
              ? head.slice(0, 240)
              : JSON.stringify(head ?? null).slice(0, 320);
        } catch {
          headPreview = '(无法序列化首项)';
        }
        console.warn('[problem-case:task2-l1-graph]', {
          phase: 'parse_evidence_chain_zero_edges',
          featureKey: key,
          chainLen: chainRaw.length,
          chainFirstItemPreview: headPreview,
          hint: '链上项须为对象且含 SourceFeature.FeatureID（或顶层 FeatureID），与输入 TSV 第一列一致',
        });
      } catch {
        /* ignore */
      }
    }
    return {
      featureKey: key,
      operator,
      featureValue,
      valueRefDomain: vrd,
      inferenceSummary: inf,
      ...(bizFn ? { businessFunction: bizFn } : {}),
      evidenceSource: evidence,
      logicRule,
      inferenceWeight,
      ...(causalitySummary ? { causalitySummary } : {}),
      validationStatus,
      ...(associatedCapabilityUnit ? { associatedCapabilityUnit } : {}),
      ...(fieldsSchemaTree !== undefined ? { fieldsSchemaTree } : {}),
      ...(evidenceLinks.length > 0 ? { evidenceLinks } : {}),
    };
  }
  if (!key?.length) return null;
  return { featureKey: key, operator, featureValue };
}

function appendParsedTask2L1Rows(
  items: unknown[],
  rows: Task2L1TargetKvSyncRow[],
  seen: Set<string>,
): void {
  for (const item of items) {
    const parsed = parseOneTask2L1TargetKvLikeItem(item);
    if (!parsed) continue;
    const dedup = task2L1TargetKvRowDedupKey(parsed.featureKey, parsed.featureValue, parsed.operator);
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    rows.push(parsed);
  }
}

function readExtendedFeaturesArrayFromL1Raw(l1InferenceRaw: string): unknown[] {
  const m = readL1InferenceMatrixFromRaw(l1InferenceRaw);
  if (!m) return [];
  const raw =
    m.Extended_Features ??
    m.extended_features ??
    getPropertyCI(m, 'Extended_Features', 'extended_features');
  return Array.isArray(raw) ? raw : [];
}

/**
 * 从 L1 原始输出解析 `Target_KV` 与 `Extended_Features` 各行：`Feature_Key`、`Operator`、`Feature_Value`、可选 **`value_ref_domain`**、可选 **`Evidence_Support_Chain`**（同键不同值保留多行；完全重复行去重）。
 */
export function parseTask2L1TargetKvSyncRows(l1InferenceRaw: string): ParseTask2L1TargetKvRowsResult {
  const got = readTargetKvItemsArray(l1InferenceRaw);
  if (!got.ok) return got;
  const seen = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  appendParsedTask2L1Rows(got.arr, rows, seen);
  appendParsedTask2L1Rows(readExtendedFeaturesArrayFromL1Raw(l1InferenceRaw), rows, seen);
  if (rows.length === 0) {
    return { ok: false, message: 'Target_KV 中未解析到有效的 Feature_Key' };
  }
  return { ok: true, rows };
}

/**
 * 从 L1 原始输出中解析 `Target_KV[].Feature_Key`，去重且保序。
 */
export function parseTask2L1TargetKvFeatureKeys(l1InferenceRaw: string): ParseTask2L1TargetKvResult {
  const r = parseTask2L1TargetKvSyncRows(l1InferenceRaw);
  if (!r.ok) return r;
  return { ok: true, featureKeys: r.rows.map((x) => x.featureKey) };
}

const TASK2_L1_MATRIX_FEATURE_KEYS = ['组织管控拓扑', '合规约束等级', '管控复杂度'] as const;

/** 历史提示词 / 落库 Feature_Key 别名 → 现行三键 */
const TASK2_L1_MAPPED_FEATURE_ALIASES: Record<string, (typeof TASK2_L1_MATRIX_FEATURE_KEYS)[number]> = {
  组织模式: '组织管控拓扑',
  组织拓扑: '组织管控拓扑',
};

/** 任务 3 L2：`Target_KV` / `Mapped_L2_Feature` 三键 */
const TASK3_L2_MATRIX_FEATURE_KEYS = ['核心资产属性', '交付模式', '行业类别'] as const;

/** 历史提示词 / 落库 Feature_Key 别名 → 现行三键 */
const TASK3_L2_MAPPED_FEATURE_ALIASES: Record<string, (typeof TASK3_L2_MATRIX_FEATURE_KEYS)[number]> = {
  资产属性特征: '核心资产属性',
  核心资产属性: '核心资产属性',
  交易交付模式: '交付模式',
  交付模式: '交付模式',
  行业类别: '行业类别',
};

/** 裂变后缀（如 `组织拓扑_01`）不参与四键归一 */
const TASK2_L1_FISSION_KEY_SUFFIX = /_\d+$/;

/** 将模型 `Mapped_L1_Feature` 归一为与 `Target_KV[].Feature_Key` 一致的四键之一 */
export function normalizeTask2L1MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s || TASK2_L1_FISSION_KEY_SUFFIX.test(s)) return null;
  for (const k of TASK2_L1_MATRIX_FEATURE_KEYS) {
    if (s === k) return k;
  }
  const alias = TASK2_L1_MAPPED_FEATURE_ALIASES[s];
  if (alias) return alias;
  return null;
}

/** 将模型 `Mapped_L2_Feature` / 历史 `Target_KV.Feature_Key` 归一为任务 3 现行两键之一 */
export function normalizeTask3L2MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  for (const k of TASK3_L2_MATRIX_FEATURE_KEYS) {
    if (s === k) return k;
  }
  const alias = TASK3_L2_MAPPED_FEATURE_ALIASES[s];
  if (alias) return alias;
  for (const k of TASK3_L2_MATRIX_FEATURE_KEYS) {
    if (s.includes(k)) return k;
  }
  return null;
}

/** 解析 L1 原始串最外层 JSON 对象（供矩阵读取与根级 **`Token_Validation_Mapping`** 兜底）。 */
function readL1JsonRootRecord(l1InferenceRaw: string): Record<string, unknown> | null {
  const raw = stripBom(String(l1InferenceRaw || '').trim());
  if (!raw.length) return null;
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) return null;
  const root = peelJsonStringLayers(rootOnce, 6);
  return asRecord(root);
}

function readL1InferenceMatrixFromRaw(l1InferenceRaw: string): Record<string, unknown> | null {
  const obj = readL1JsonRootRecord(l1InferenceRaw);
  if (!obj) return null;
  const direct = readL1MatrixContainer(obj);
  if (direct) return direct;
  for (const v of Object.values(obj)) {
    const o = asRecord(v);
    if (!o) continue;
    const innerM = readL1MatrixContainer(o);
    if (innerM) return innerM;
  }
  return null;
}

/**
 * 从 L1 原始 JSON 解析 **`Token_Validation_Mapping`**：优先 **`L1_Inference_Matrix` 内**；若模型把数组放在与 **`L1_Inference_Matrix` 同级** 的根上，则从根再取一次（避免解析条数为 0 导致不落 **「反向验证」** 边）。
 */
export function parseTokenValidationMappingFromL1Raw(l1InferenceRaw: string): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL1JsonRootRecord(l1InferenceRaw);
  const m = readL1InferenceMatrixFromRaw(l1InferenceRaw);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList) && rootObj) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedL1FeatureKey = normalizeTask2L1MappedFeatureKey(
      rec.Mapped_L1_Feature ??
        rec.mapped_l1_feature ??
        getPropertyCI(rec, 'Mapped_L1_Feature', 'mapped_l1_feature'),
    );
    if (!mappedL1FeatureKey) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  return out;
}

function readL2JsonRootRecord(l2InferenceRaw: string): Record<string, unknown> | null {
  const raw = stripBom(String(l2InferenceRaw || '').trim());
  if (!raw.length) return null;
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) return null;
  const root = peelJsonStringLayers(rootOnce, 8);
  return asRecord(root);
}

/** 任务 3 L2：兼容新根键 `L2_Business_Inference_Matrix` 与旧键 `L2_Inference_Matrix`（含一层包装对象）。 */
function readL2Task3MatrixContainerRecord(root: Record<string, unknown>): Record<string, unknown> | null {
  const keyPairs: Array<[string, string]> = [
    ['L2_Business_Inference_Matrix', 'l2_business_inference_matrix'],
    ['L2_Inference_Matrix', 'l2_inference_matrix'],
  ];
  for (const [k1, k2] of keyPairs) {
    const direct = asRecord(getPropertyCI(root, k1, k2));
    if (direct) return direct;
  }
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    for (const [k1, k2] of keyPairs) {
      const innerM = asRecord(getPropertyCI(o, k1, k2));
      if (innerM) return innerM;
    }
  }
  return null;
}

function readL2InferenceMatrixFromRaw(l2InferenceRaw: string): Record<string, unknown> | null {
  const obj = readL2JsonRootRecord(l2InferenceRaw);
  if (!obj) return null;
  return readL2Task3MatrixContainerRecord(obj);
}

/**
 * 从任务 3 L2 原始 JSON 解析 **`Token_Validation_Mapping`**：优先 **`L2_Business_Inference_Matrix` / `L2_Inference_Matrix` 内**；若数组与矩阵**同级**根上，则根级兜底。`Mapped_L2_Feature` 归一后写入计划字段 **`mappedL1FeatureKey`**（与仓储 `Task2L1TokenValidationLinkPlan` 复用）。
 */
export function parseTokenValidationMappingFromL2InferenceRaw(l2InferenceRaw: string): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL2JsonRootRecord(l2InferenceRaw);
  const m = readL2InferenceMatrixFromRaw(l2InferenceRaw);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList) && rootObj) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedL2Key = normalizeTask3L2MappedFeatureKey(
      rec.Mapped_L2_Feature ??
        rec.mapped_l2_feature ??
        getPropertyCI(rec, 'Mapped_L2_Feature', 'mapped_l2_feature'),
    );
    if (!mappedL2Key) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey: mappedL2Key,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  return out;
}

/** 任务 4 L2 价值矩阵四键（读库兼容历史「业务价值焦点」别名） */
const TASK4_L2_VALUE_MATRIX_FEATURE_KEYS = [
  '核心价值驱动',
  '运营重心',
  '账面焦点',
  '数字化成熟度预期',
] as const;

/** 历史提示词 / 落库 Feature_Key 别名 → 现行四键 */
const TASK4_L2_VALUE_MATRIX_FEATURE_ALIASES: Record<string, (typeof TASK4_L2_VALUE_MATRIX_FEATURE_KEYS)[number]> = {
  业务价值焦点: '账面焦点',
};

/** 将任务 4 `Target_KV[].Feature_Key` 归一为现行四键之一 */
export function normalizeTask4L2ValueMatrixFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s || TASK2_L1_FISSION_KEY_SUFFIX.test(s)) return null;
  for (const k of TASK4_L2_VALUE_MATRIX_FEATURE_KEYS) {
    if (s === k) return k;
  }
  const alias = TASK4_L2_VALUE_MATRIX_FEATURE_ALIASES[s];
  if (alias) return alias;
  for (const k of TASK4_L2_VALUE_MATRIX_FEATURE_KEYS) {
    if (s.includes(k)) return k;
  }
  return null;
}

/** 任务 4 L3 VSM：固定维度键（非 `价值流阶段_*` 序号键） */
const TASK4_L3_FIXED_DIMENSION_KEYS = [
  '宏观业务流程模式',
  '流程始端边界',
  '流程末端边界',
  '过程控制密度',
  '关键管控闸口配置',
  '流程自动化水平',
] as const;

/**
 * 将模型 `Mapped_L3_Feature` / `Mapped_L2_Feature` 归一为与当次 `Target_KV[].Feature_Key` 可对齐的键。
 * L3 优先：`价值流阶段_*` 与固定维度键；历史 L2 四键仍兼容。
 */
export function normalizeTask4L2MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const stageMatch = s.match(/价值流阶段_\d+/);
  if (stageMatch) return stageMatch[0];
  for (const k of TASK4_L3_FIXED_DIMENSION_KEYS) {
    if (s === k || s.includes(k)) return k;
  }
  const valueKey = normalizeTask4L2ValueMatrixFeatureKey(s);
  if (valueKey) return valueKey;
  return s.length ? s : null;
}

/** 自任务 4 模型 JSON 读取矩阵容器：优先 `L2_Value_Inference_Matrix`（价值链 L2），兼容历史误落的 `L3_Process_Inference_Matrix`。 */
function readTask4InferenceMatrixFromRaw(l2ValueInferenceRaw: string): Record<string, unknown> | null {
  const obj = readL2JsonRootRecord(l2ValueInferenceRaw);
  if (!obj) return null;
  const l2 = asRecord(getPropertyCI(obj, 'L2_Value_Inference_Matrix', 'l2_value_inference_matrix'));
  if (l2) return l2;
  const l3 = asRecord(getPropertyCI(obj, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'));
  if (l3) return l3;
  for (const v of Object.values(obj)) {
    const o = asRecord(v);
    if (!o) continue;
    const innerL3 = asRecord(getPropertyCI(o, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'));
    if (innerL3) return innerL3;
    const innerL2 = asRecord(getPropertyCI(o, 'L2_Value_Inference_Matrix', 'l2_value_inference_matrix'));
    if (innerL2) return innerL2;
  }
  /** 模型将 Target_KV 直接置于根（缺矩阵包装） */
  const topKv = readTargetKvFromContainer(obj);
  if (topKv?.length) return obj;
  return null;
}

/** @deprecated 内部别名；请使用 `readTask4InferenceMatrixFromRaw` */
function readL2ValueInferenceMatrixFromRaw(l2ValueInferenceRaw: string): Record<string, unknown> | null {
  return readTask4InferenceMatrixFromRaw(l2ValueInferenceRaw);
}

/**
 * 从任务 4 L2 原始 JSON 解析 **`Token_Validation_Mapping`**：优先 **`L2_Value_Inference_Matrix` 内**；根级兜底。`Mapped_L2_Feature` 归一后写入 **`mappedL1FeatureKey`**（与仓储计划类型复用）。
 */
export function parseTokenValidationMappingFromL2ValueInferenceRaw(
  l2ValueInferenceRaw: string,
): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL2JsonRootRecord(l2ValueInferenceRaw);
  const m = readL2ValueInferenceMatrixFromRaw(l2ValueInferenceRaw);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList) && rootObj) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedKey = normalizeTask4L2MappedFeatureKey(
      rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature') ??
        rec.Mapped_L2_Feature ??
        rec.mapped_l2_feature ??
        getPropertyCI(rec, 'Mapped_L2_Feature', 'mapped_l2_feature'),
    );
    if (!mappedKey) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey: mappedKey,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  return out;
}

/**
 * 将 `POST …/sync-task2-l1-inference-graph` / `sync-task2-l1-target-kv-tokens` 的请求体归一为**单段** L1 JSON 字符串。
 * 兼容：根对象即 `L1_Inference_Matrix`（无 `l1InferenceRaw` 键）、`l1_inference_raw`、`l1InferenceRaw` 为 object。
 */
export function coerceHttpBodyToL1InferenceRawString(body: unknown): string | null {
  if (body === null || body === undefined) return null;
  if (typeof body === 'string') {
    const t = stripBom(String(body).trim());
    return t.length ? t : null;
  }
  if (typeof body !== 'object' || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const r = o.l1InferenceRaw ?? o.l1_inference_raw;
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
  const matrix =
    o.L1_Entity_Inference_Matrix ??
    o.l1_entity_inference_matrix ??
    o.L1_Inference_Matrix ??
    o.l1_inference_matrix;
  if (matrix != null && typeof matrix === 'object') {
    try {
      return JSON.stringify(o);
    } catch {
      return null;
    }
  }
  return null;
}

/** 自 `L2_Value_Inference_Matrix` / `L3_Process_Inference_Matrix`（及一层包装）读取 `Target_KV` 行列表（任务 4） */
function readTask4InferenceTargetKvArray(root: Record<string, unknown>): unknown[] | null {
  const l2m = asRecord(getPropertyCI(root, 'L2_Value_Inference_Matrix', 'l2_value_inference_matrix'));
  if (l2m) {
    const rows = readTargetKvFromContainer(l2m);
    if (rows?.length) return rows;
  }
  const l3m = asRecord(getPropertyCI(root, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'));
  if (l3m) {
    const rows = readTargetKvFromContainer(l3m);
    if (rows?.length) return rows;
  }
  const top = readTargetKvFromContainer(root);
  if (top?.length) return top;
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    const innerL3 = asRecord(getPropertyCI(o, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'));
    if (innerL3) {
      const rows = readTargetKvFromContainer(innerL3);
      if (rows?.length) return rows;
    }
    const innerL2 = asRecord(getPropertyCI(o, 'L2_Value_Inference_Matrix', 'l2_value_inference_matrix'));
    if (innerL2) {
      const rows = readTargetKvFromContainer(innerL2);
      if (rows?.length) return rows;
    }
    const nested = readTargetKvFromContainer(o);
    if (nested?.length) return nested;
  }
  return null;
}

/** 单条或片段是否像 Diagnostic_Pain_Points 项（非 Target_KV 行） */
function recordLooksLikeDiagnosticPainPoint(rec: Record<string, unknown>): boolean {
  if (getPropertyCI(rec, 'Conflict_ID', 'conflict_id')) return true;
  if (getPropertyCI(rec, 'Conflict_Description', 'conflict_description')) return true;
  if (getPropertyCI(rec, 'Root_Cause_Analysis', 'root_cause_analysis')) return true;
  if (getPropertyCI(rec, 'Trigger_Features', 'trigger_features')) return true;
  if (getPropertyCI(rec, 'Client_Confirmation_Status', 'client_confirmation_status')) return true;
  return false;
}

function hasDiagnosticPainPointsSomewhere(obj: Record<string, unknown>): boolean {
  const dp = getPropertyCI(obj, 'Diagnostic_Pain_Points', 'diagnostic_pain_points');
  if (Array.isArray(dp) && dp.length > 0) return true;
  const l3 = asRecord(getPropertyCI(obj, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'));
  if (l3) {
    const inner = getPropertyCI(l3, 'Diagnostic_Pain_Points', 'diagnostic_pain_points');
    if (Array.isArray(inner) && inner.length > 0) return true;
  }
  if (recordLooksLikeDiagnosticPainPoint(obj)) return true;
  return false;
}

/** 任务 4：Target_KV 缺失时的可读错误（区分「仅诊断痛点」与「矩阵空」） */
function buildTask4TargetKvMissingMessage(obj: Record<string, unknown>): string {
  const base =
    '未找到 L2_Value_Inference_Matrix / L3_Process_Inference_Matrix 下非空 Target_KV';
  if (recordLooksLikeDiagnosticPainPoint(obj)) {
    return `${base}：当前 JSON 根节点似为单条 Diagnostic_Pain_Points，须改为完整 L2_Value_Inference_Matrix（含核心价值驱动等四键 Target_KV）。请重跑任务 4 推理。`;
  }
  const l3 = asRecord(getPropertyCI(obj, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'));
  const l2 = asRecord(getPropertyCI(obj, 'L2_Value_Inference_Matrix', 'l2_value_inference_matrix'));
  const matrix = l3 ?? l2;
  if (matrix && hasDiagnosticPainPointsSomewhere(obj)) {
    const tk = readTargetKvFromContainer(matrix);
    if (!tk?.length) {
      return `${base}：已解析到 Diagnostic_Pain_Points 等字段，但 Target_KV 为空或无法识别。请检查模型是否按系统提示输出完整 Target_KV 后重试。`;
    }
  }
  if (hasDiagnosticPainPointsSomewhere(obj) && !matrix) {
    return `${base}：检测到 Diagnostic_Pain_Points 片段，但缺少 L3_Process_Inference_Matrix 包装与非空 Target_KV。请重跑任务 4 推理。`;
  }
  return `${base}。请确认模型输出为 L2 价值链分析契约 JSON（L2_Value_Inference_Matrix，四键 Target_KV），并重启本地后端至最新代码。`;
}

function readL2ValueInferenceTargetKvItemsArray(
  l2ValueInferenceRaw: string,
): { ok: true; arr: unknown[] } | { ok: false; message: string } {
  const raw = stripBom(String(l2ValueInferenceRaw || '').trim());
  if (!raw.length) {
    return { ok: false, message: '模型输出为空' };
  }
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 4 模型输出是否为合法 JSON，勿含说明文字；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) {
    return { ok: false, message: '根节点须为 JSON 对象' };
  }
  const arr = readTask4InferenceTargetKvArray(obj);
  if (!arr || arr.length === 0) {
    return { ok: false, message: buildTask4TargetKvMissingMessage(obj) };
  }
  return { ok: true, arr };
}

/**
 * 将任务 4 模型原文规范为可落库的 JSON 字符串（补 `L3_Process_Inference_Matrix` 或 `L2_Value_Inference_Matrix` 包装、剥离围栏）。
 * 供前端 sync 前预处理，与 `parseTask4L2TargetKvSyncRows` 口径一致。
 */
export function normalizeL2ValueInferenceRawForServerSync(
  l2ValueInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l2ValueInferenceRaw || '').trim());
  if (!raw.length) {
    return { ok: false, message: '模型输出为空' };
  }
  const obj = readL2JsonRootRecord(raw);
  if (!obj) {
    return { ok: false, message: 'JSON 解析失败' };
  }
  const hasL3 = !!asRecord(getPropertyCI(obj, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'));
  const hasL2 = !!asRecord(getPropertyCI(obj, 'L2_Value_Inference_Matrix', 'l2_value_inference_matrix'));
  if (hasL3 || hasL2) {
    try {
      return { ok: true, normalized: JSON.stringify(obj) };
    } catch {
      return { ok: false, message: 'JSON 序列化失败' };
    }
  }
  const matrix = readTask4InferenceMatrixFromRaw(raw) ?? obj;
  const preferL2 =
    readTargetKvFromContainer(matrix)?.some((row) => {
      const rec = asRecord(row);
      const k = rec ? featureKeyFromRow(rec) : typeof row === 'string' ? row.trim() : '';
      return k && TASK4_L2_VALUE_MATRIX_FEATURE_KEYS.some((fk) => k === fk || k.includes(fk));
    }) ?? false;
  const preferL3 =
    !preferL2 &&
    (readTargetKvFromContainer(matrix)?.some((row) => {
      const rec = asRecord(row);
      const k = rec ? featureKeyFromRow(rec) : typeof row === 'string' ? row.trim() : '';
      return (
        (k && /^价值流阶段_\d+/.test(k)) ||
        (k && TASK4_L3_FIXED_DIMENSION_KEYS.some((fk) => k.includes(fk)))
      );
    }) ??
      false);
  const wrapped = preferL3
    ? { L3_Process_Inference_Matrix: matrix }
    : { L2_Value_Inference_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(wrapped) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/**
 * 将任务 3 模型原文规范为可落库的 JSON 字符串（剥离 Markdown 围栏、补 `L2_Business_Inference_Matrix` 包装）。
 * 供 `sync-task3-l2-target-kv-tokens` 与前端 sync 前预处理，与 `parseTask3L2TargetKvSyncRows` 口径一致。
 */
export function normalizeL2BusinessInferenceRawForServerSync(
  l2InferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l2InferenceRaw || '').trim());
  if (!raw.length) {
    return { ok: false, message: '模型输出为空' };
  }
  const obj = readL2JsonRootRecord(raw);
  if (!obj) {
    return { ok: false, message: 'JSON 解析失败' };
  }
  const hasBim =
    !!asRecord(getPropertyCI(obj, 'L2_Business_Inference_Matrix', 'l2_business_inference_matrix')) ||
    !!asRecord(getPropertyCI(obj, 'L2_Inference_Matrix', 'l2_inference_matrix'));
  if (hasBim) {
    try {
      return { ok: true, normalized: JSON.stringify(obj) };
    } catch {
      return { ok: false, message: 'JSON 序列化失败' };
    }
  }
  const matrix = readL2Task3MatrixContainerRecord(obj);
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

/** 自 `L2_Business_Inference_Matrix` / `L2_Inference_Matrix`（及一层包装）读取 `Target_KV` 行列表 */
function readL2TargetKvArray(root: Record<string, unknown>): unknown[] | null {
  const m = readL2Task3MatrixContainerRecord(root);
  if (m) {
    const rows = readTargetKvFromContainer(m);
    if (rows?.length) return rows;
  }
  return null;
}

function readL2TargetKvItemsArray(l2InferenceRaw: string): { ok: true; arr: unknown[] } | { ok: false; message: string } {
  const raw = stripBom(String(l2InferenceRaw || '').trim());
  if (!raw.length) {
    return { ok: false, message: '模型输出为空' };
  }
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 3 模型输出是否为合法 JSON，勿含 0.0-1.0 等占位符；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) {
    return { ok: false, message: '根节点须为 JSON 对象' };
  }
  const arr = readL2TargetKvArray(obj);
  if (!arr || arr.length === 0) {
    return {
      ok: false,
      message: '未找到 L2_Business_Inference_Matrix / L2_Inference_Matrix 下 Target_KV 或非空数组',
    };
  }
  return { ok: true, arr };
}

/**
 * 从任务 3 L2 原始输出解析 **`L2_Business_Inference_Matrix` / `L2_Inference_Matrix` 内** `Target_KV` 各行（行结构与任务 2 L1 相同）。
 */
export function parseTask3L2TargetKvSyncRows(l2InferenceRaw: string): ParseTask2L1TargetKvRowsResult {
  const got = readL2TargetKvItemsArray(l2InferenceRaw);
  if (!got.ok) return got;
  const { arr } = got;
  const seenCanon = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  for (const item of arr) {
    const parsed = parseOneTask2L1TargetKvLikeItem(item);
    if (!parsed) continue;
    const canonKey = normalizeTask3L2MappedFeatureKey(parsed.featureKey) ?? parsed.featureKey;
    const isFission = TASK2_L1_FISSION_KEY_SUFFIX.test(canonKey);
    if (!isFission && seenCanon.has(canonKey)) continue;
    if (!isFission) seenCanon.add(canonKey);
    rows.push({ ...parsed, featureKey: canonKey });
  }
  if (rows.length === 0) {
    return { ok: false, message: 'Target_KV 中未解析到有效的 Feature_Key' };
  }
  return { ok: true, rows };
}

/**
 * 从任务 4 原始输出解析 `L3_Process_Inference_Matrix`（优先）或 `L2_Value_Inference_Matrix` 内 `Target_KV` 各行。
 */
export function parseTask4L2TargetKvSyncRows(l2ValueInferenceRaw: string): ParseTask2L1TargetKvRowsResult {
  const got = readL2ValueInferenceTargetKvItemsArray(l2ValueInferenceRaw);
  if (!got.ok) return got;
  const { arr } = got;
  const seenCanon = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  for (const item of arr) {
    const parsed = parseOneTask2L1TargetKvLikeItem(item);
    if (!parsed) continue;
    const canonKey = normalizeTask4L2ValueMatrixFeatureKey(parsed.featureKey) ?? parsed.featureKey;
    const isFission = TASK2_L1_FISSION_KEY_SUFFIX.test(canonKey);
    if (!isFission && seenCanon.has(canonKey)) continue;
    if (!isFission) seenCanon.add(canonKey);
    rows.push({ ...parsed, featureKey: canonKey });
  }
  if (rows.length === 0) {
    return { ok: false, message: 'Target_KV 中未解析到有效的 Feature_Key' };
  }
  return { ok: true, rows };
}

/**
 * 将 `POST …/sync-task4-l2-target-kv-tokens` 请求体归一为 **L2 价值推理** JSON 字符串（根可为 `L2_Value_Inference_Matrix`）。
 */
export function coerceHttpBodyToL2ValueInferenceRawString(body: unknown): string | null {
  if (body === null || body === undefined) return null;
  if (typeof body === 'string') {
    const t = stripBom(String(body).trim());
    return t.length ? t : null;
  }
  if (typeof body !== 'object' || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const r = o.l2ValueInferenceRaw ?? o.l2_value_inference_raw;
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
  const matrixL3 = o.L3_Process_Inference_Matrix ?? o.l3_process_inference_matrix;
  const matrixL2 = o.L2_Value_Inference_Matrix ?? o.l2_value_inference_matrix;
  if (
    (matrixL3 != null && typeof matrixL3 === 'object') ||
    (matrixL2 != null && typeof matrixL2 === 'object')
  ) {
    try {
      return JSON.stringify(o);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 将 `POST …/sync-task3-l2-target-kv-tokens` 请求体归一为 **L2** JSON 字符串（根可为 `L2_Business_Inference_Matrix` 或 `L2_Inference_Matrix`）。
 */
export function coerceHttpBodyToL2InferenceRawString(body: unknown): string | null {
  if (body === null || body === undefined) return null;
  if (typeof body === 'string') {
    const t = stripBom(String(body).trim());
    return t.length ? t : null;
  }
  if (typeof body !== 'object' || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const r = o.l2InferenceRaw ?? o.l2_inference_raw;
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
  const matrix =
    o.L2_Business_Inference_Matrix ??
    o.l2_business_inference_matrix ??
    o.L2_Inference_Matrix ??
    o.l2_inference_matrix;
  if (matrix != null && typeof matrix === 'object') {
    try {
      return JSON.stringify(o);
    } catch {
      return null;
    }
  }
  return null;
}

const TASK5_L3_VSM_FIXED_FEATURE_KEYS = [
  '宏观业务流程模式',
  '流程始端边界',
  '流程末端边界',
  '流程始末边界',
  '过程控制密度',
  '关键管控闸口配置',
  '流程自动化水平',
] as const;

/** 任务 5 宏观流程固定维度（不含 `价值流阶段_*`） */
export function isTask5L3MacroFeatureKey(featureKey: string): boolean {
  const k = String(featureKey || '').trim();
  if (!k || /^价值流阶段[_\s]*\d+/i.test(k)) return false;
  return TASK5_L3_VSM_FIXED_FEATURE_KEYS.some((fk) => k === fk || k.includes(fk));
}

/** 任务 5.5 VSM 原子阶段键（统一 `价值流阶段` 或历史 `价值流阶段_*`） */
export function isTask5L5VsmStageFeatureKey(featureKey: string): boolean {
  const k = String(featureKey || '').trim();
  if (k === '价值流阶段') return true;
  return /^价值流阶段[_\s]*\d+/i.test(k);
}

/** 任务 5 L3 可落库 Target_KV 键（宏观固定维度或 VSM 阶段节点） */
export function isTask5L3TargetKvSyncableFeatureKey(featureKey: string): boolean {
  return isTask5L3MacroFeatureKey(featureKey) || isTask5L5VsmStageFeatureKey(featureKey);
}

/** 任务 5.5 强类型 Feature_Value 去重/展示令牌（优先 phase_name） */
export function task55VsmStageFeatureValueDedupToken(featureValue: unknown): string {
  if (featureValue === null || featureValue === undefined) return '';
  if (typeof featureValue === 'object' && !Array.isArray(featureValue)) {
    const rec = featureValue as Record<string, unknown>;
    const phase = String(rec.phase_name ?? rec.Phase_Name ?? '').trim();
    if (phase) return phase;
    try {
      return JSON.stringify(featureValue);
    } catch {
      return String(featureValue);
    }
  }
  return String(featureValue).trim();
}

/** 从落库 `DesignFeatureNode.value`（含 `{ Feature_Value }` 包装）抽取 VSM 阶段展示名 */
export function task55VsmStagePhaseNameFromDesignFeatureValue(value: unknown): string {
  let cur: unknown = value;
  if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
    const rec = cur as Record<string, unknown>;
    const nested = rec.Feature_Value ?? rec.feature_value;
    if (nested !== undefined && nested !== null) cur = nested;
  }
  return task55VsmStageFeatureValueDedupToken(cur);
}

/** 任务 5.5 Target_KV 去重键：统一 Feature_Key 时按 Feature_Value 区分多阶段 */
export function task55VsmTargetKvDedupKey(featureKey: string, featureValue: unknown): string {
  const k = String(featureKey || '').trim();
  if (k === '价值流阶段') {
    return `${k}::${task55VsmStageFeatureValueDedupToken(featureValue)}`;
  }
  return k;
}

/** 优先读取 `L3_Value_Stream_Matrix`，兼容历史 `L3_5_VSM_Inference_Matrix` */
function readTask55L3VsmMatrixFromRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  const stream = asRecord(
    getPropertyCI(root, 'L3_Value_Stream_Matrix', 'l3_value_stream_matrix'),
  );
  if (stream && readTargetKvFromContainer(stream)?.length) return stream;
  const vsm = asRecord(getPropertyCI(root, 'L3_5_VSM_Inference_Matrix', 'l3_5_vsm_inference_matrix'));
  if (vsm && readTargetKvFromContainer(vsm)?.length) return vsm;
  return null;
}

/**
 * 从 Target_KV 行解析任务 5.5 Feature_Key：支持「价值流阶段」、历史 `价值流阶段_*`；
 * 缺 Key 但有 Feature_Value 时归一为「价值流阶段」。
 */
function resolveTask55VsmFeatureKeyFromRow(rec: Record<string, unknown>): string | null {
  const key = featureKeyFromRow(rec);
  if (key && isTask5L3MacroFeatureKey(key)) return null;
  if (key && isTask5L5VsmStageFeatureKey(key)) {
    const k = key.trim();
    return k === '价值流阶段' ? '价值流阶段' : k;
  }
  const rawFv = featureValueFromRow(rec);
  if (rawFv === null || rawFv === undefined) return null;
  if (typeof rawFv === 'object' && !Array.isArray(rawFv)) {
    const phase = String((rawFv as Record<string, unknown>).phase_name ?? '').trim();
    if (phase) return '价值流阶段';
  }
  const fv = String(rawFv ?? '').trim();
  if (!fv.length) return null;
  return '价值流阶段';
}

function buildTask55VsmTargetKvMissingMessage(obj: Record<string, unknown>): string {
  const vsm = readTask55L3VsmMatrixFromRoot(obj);
  if (!vsm) {
    return (
      '未找到 L3_Value_Stream_Matrix / L3_5_VSM_Inference_Matrix 或非空 Target_KV；请确认根键与 Target_KV'
    );
  }
  const tk = readTargetKvFromContainer(vsm);
  if (!tk?.length) {
    return '价值流阶段矩阵内 Target_KV 为空';
  }
  const sampleKeys = tk
    .slice(0, 6)
    .map((item) => {
      const rec = asRecord(item);
      return rec ? featureKeyFromRow(rec) : String(item);
    })
    .filter(Boolean)
    .join('、');
  return (
    `未解析到价值流阶段节点（Feature_Key 须为「价值流阶段」或历史「价值流阶段_*」；` +
    `当前样本键：${sampleKeys || '（无）'}）`
  );
}

function readTask55L3VsmTargetKvItemsArray(
  l3ProcessInferenceRaw: string,
): { ok: true; arr: unknown[] } | { ok: false; message: string } {
  const raw = stripBom(String(l3ProcessInferenceRaw || '').trim());
  if (!raw.length) {
    return { ok: false, message: '模型输出为空' };
  }
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 5.5 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) {
    return { ok: false, message: '根节点须为 JSON 对象' };
  }
  const vsmMatrix = readTask55L3VsmMatrixFromRoot(obj);
  if (vsmMatrix) {
    const arr = readTargetKvFromContainer(vsmMatrix);
    if (arr?.length) return { ok: true, arr };
  }
  const fallbackArr = readTask5InferenceTargetKvArray(obj);
  if (fallbackArr?.length) {
    const vsmOnly = fallbackArr.filter((item) => {
      if (typeof item === 'string') {
        const t = String(item).trim();
        return t.length > 0 && isTask5L5VsmStageFeatureKey(t) && !isTask5L3MacroFeatureKey(t);
      }
      const rec = asRecord(item);
      return !!rec && resolveTask55VsmFeatureKeyFromRow(rec) !== null;
    });
    if (vsmOnly.length) return { ok: true, arr: vsmOnly };
  }
  return { ok: false, message: buildTask55VsmTargetKvMissingMessage(obj) };
}

/** 任务 5：`Mapped_L3_Feature` 归一至本批 Target_KV 的 Feature_Key */
export function normalizeTask5L3MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s === '价值流阶段') return s;
  const stage = s.match(/价值流阶段[_\s]*(\d+)/);
  if (stage) return `价值流阶段_${stage[1]}`;
  for (const k of TASK5_L3_VSM_FIXED_FEATURE_KEYS) {
    if (s === k || s.includes(k)) return k;
  }
  return s.length ? s : null;
}

/** 任务 5.5 TVM：`Mapped_L5_Feature` / 历史 `价值流阶段_*` 均归一为「价值流阶段」 */
export function normalizeTask55L3MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s === '价值流阶段' || isTask5L5VsmStageFeatureKey(s)) return '价值流阶段';
  return null;
}

/** 任务 5/5.5 L3 矩阵容器键（按优先级）：现行 Inference → 历史 Feature / 任务 5.5 VSM */
const L3_PROCESS_MATRIX_KEY_PAIRS: Array<[string, string]> = [
  ['L3_Process_Inference_Matrix', 'l3_process_inference_matrix'],
  ['L3_Process_Feature_Matrix', 'l3_process_feature_matrix'],
  ['L3_5_VSM_Inference_Matrix', 'l3_5_vsm_inference_matrix'],
];

function readL3ProcessMatrixFromRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  for (const [k1, k2] of L3_PROCESS_MATRIX_KEY_PAIRS) {
    const direct = asRecord(getPropertyCI(root, k1, k2));
    if (direct) return direct;
  }
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    for (const [k1, k2] of L3_PROCESS_MATRIX_KEY_PAIRS) {
      const inner = asRecord(getPropertyCI(o, k1, k2));
      if (inner) return inner;
    }
  }
  const topKv = readTargetKvFromContainer(root);
  if (topKv?.length) return root;
  return null;
}

/** 自任务 5 模型 JSON 读取矩阵容器（`L3_Process_Feature_Matrix` 或 `L3_Process_Inference_Matrix`）。 */
function readTask5L3ProcessMatrixFromRaw(l3ProcessInferenceRaw: string): Record<string, unknown> | null {
  const obj = readL2JsonRootRecord(l3ProcessInferenceRaw);
  if (!obj) return null;
  return readL3ProcessMatrixFromRoot(obj);
}

function readTask5InferenceTargetKvArray(root: Record<string, unknown>): unknown[] | null {
  const matrix = readL3ProcessMatrixFromRoot(root);
  if (matrix) {
    const rows = readTargetKvFromContainer(matrix);
    if (rows?.length) return rows;
  }
  const top = readTargetKvFromContainer(root);
  if (top?.length) return top;
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    const nested = readTargetKvFromContainer(o);
    if (nested?.length) return nested;
  }
  return null;
}

function buildTask5TargetKvMissingMessage(obj: Record<string, unknown>): string {
  const base =
    '未找到 L3_Process_Inference_Matrix / L3_Process_Feature_Matrix / L3_5_VSM_Inference_Matrix 下非空 Target_KV';
  if (hasDiagnosticPainPointsSomewhere(obj)) {
    return `${base}：已解析到 Diagnostic_Pain_Points 等字段，但 Target_KV 为空。请重跑任务 5 推理并输出宏观业务流程模式与价值流阶段_* 节点。`;
  }
  return `${base}。请确认模型输出为 L3_Process_Inference_Matrix（或兼容 L3_Process_Feature_Matrix）契约 JSON。`;
}

function readTask5L3TargetKvItemsArray(
  l3ProcessInferenceRaw: string,
): { ok: true; arr: unknown[] } | { ok: false; message: string } {
  const raw = stripBom(String(l3ProcessInferenceRaw || '').trim());
  if (!raw.length) {
    return { ok: false, message: '模型输出为空' };
  }
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 5 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) {
    return { ok: false, message: '根节点须为 JSON 对象' };
  }
  const arr = readTask5InferenceTargetKvArray(obj);
  if (!arr || arr.length === 0) {
    return { ok: false, message: buildTask5TargetKvMissingMessage(obj) };
  }
  return { ok: true, arr };
}

/**
 * 从任务 5 原始输出解析 `L3_Process_Inference_Matrix` 内 `Target_KV` 各行。
 */
export function parseTask5L3TargetKvSyncRows(l3ProcessInferenceRaw: string): ParseTask2L1TargetKvRowsResult {
  const got = readTask5L3TargetKvItemsArray(l3ProcessInferenceRaw);
  if (!got.ok) return got;
  const { arr } = got;
  const seen = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  for (const item of arr) {
    const parsed = parseOneTask2L1TargetKvLikeItem(item);
    if (!parsed) continue;
    const key = String(parsed.featureKey || '').trim();
    if (!isTask5L3TargetKvSyncableFeatureKey(key)) continue;
    const dedup = isTask5L5VsmStageFeatureKey(key)
      ? task55VsmTargetKvDedupKey(key, parsed.featureValue)
      : key;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    rows.push(parsed);
  }
  if (rows.length === 0) {
    return { ok: false, message: 'Target_KV 中未解析到有效的宏观流程或价值流阶段 Feature_Key' };
  }
  return { ok: true, rows };
}

/** 任务 5：落库宏观流程维度 + 本步输出的价值流阶段_*（与 `parseTask5L3TargetKvSyncRows` 同口径）。 */
export function parseTask5L3MacroTargetKvSyncRows(l3ProcessInferenceRaw: string): ParseTask2L1TargetKvRowsResult {
  return parseTask5L3TargetKvSyncRows(l3ProcessInferenceRaw);
}

/** 任务 5.5：仅落库 VSM 原子阶段节点（`Feature_Key` 统一为「价值流阶段」）。 */
export function parseTask5L5VsmTargetKvSyncRows(l3ProcessInferenceRaw: string): ParseTask2L1TargetKvRowsResult {
  const got = readTask55L3VsmTargetKvItemsArray(l3ProcessInferenceRaw);
  if (!got.ok) return got;
  const { arr } = got;
  const seen = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  for (const item of arr) {
    const parsed = parseOneTask2L1TargetKvLikeItem(item);
    if (!parsed) continue;
    const key = resolveTask55VsmFeatureKeyFromRow(
      typeof item === 'object' && item && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : { Feature_Key: parsed.featureKey },
    );
    if (!key) continue;
    const dedup = task55VsmTargetKvDedupKey(key, parsed.featureValue);
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    rows.push({ ...parsed, featureKey: key });
  }
  if (rows.length === 0) {
    return {
      ok: false,
      message:
        '未解析到价值流阶段节点；请按 L3.5 契约输出 Feature_Key=「价值流阶段」且不少于 5 个原子阶段',
    };
  }
  return { ok: true, rows };
}

const TASK51_L3_VALUE_PROPOSITION_FEATURE_KEYS = ['核心价值主张', '交付模式定性', '业务能力单元'] as const;

/** 任务 5.1：落库 Feature_Key 白名单 */
export function isTask51L3TargetKvSyncableFeatureKey(key: string): boolean {
  const k = String(key || '').trim();
  return (TASK51_L3_VALUE_PROPOSITION_FEATURE_KEYS as readonly string[]).includes(k);
}

function readTask51L3ValuePropositionMatrixFromRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(
    root.L3_Value_Proposition_Matrix ??
      root.l3_value_proposition_matrix ??
      getPropertyCI(root, 'L3_Value_Proposition_Matrix', 'l3_value_proposition_matrix'),
  );
}

function readTask51L3ValuePropositionMatrixFromRaw(l3Raw: string): Record<string, unknown> | null {
  const obj = readL2JsonRootRecord(l3Raw);
  if (!obj) return null;
  return readTask51L3ValuePropositionMatrixFromRoot(obj);
}

function readTask51ValuePropositionRecord(matrix: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(
    matrix.Value_Proposition ??
      matrix.value_proposition ??
      getPropertyCI(matrix, 'Value_Proposition', 'value_proposition'),
  );
}

function readTask51L3TargetKvItemsArray(
  l3ValuePropositionRaw: string,
): { ok: true; arr: unknown[] } | { ok: false; message: string } {
  const raw = stripBom(String(l3ValuePropositionRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 5.1 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask51L3ValuePropositionMatrixFromRoot(obj);
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L3_Value_Proposition_Matrix。请确认模型输出根键为 L3_Value_Proposition_Matrix 且含 Value_Proposition 与 Target_KV。',
    };
  }
  const arr = readTargetKvFromContainer(matrix);
  if (!arr?.length) {
    return { ok: false, message: 'L3_Value_Proposition_Matrix 内 Target_KV 为空' };
  }
  return { ok: true, arr };
}

function buildTask51ValuePropositionSyntheticRows(
  matrix: Record<string, unknown>,
): Task2L1TargetKvSyncRow[] {
  const vp = readTask51ValuePropositionRecord(matrix);
  if (!vp) return [];
  const out: Task2L1TargetKvSyncRow[] = [];
  const core = String(vp.core_value_claim ?? vp.coreValueClaim ?? '').trim();
  if (core) {
    out.push({
      featureKey: '核心价值主张',
      operator: '等于',
      featureValue: core,
      validationStatus: 'Pending',
    });
  }
  const delivery = String(vp.delivery_model_character ?? vp.deliveryModelCharacter ?? '').trim();
  if (delivery) {
    out.push({
      featureKey: '交付模式定性',
      operator: '等于',
      featureValue: delivery,
      validationStatus: 'Pending',
    });
  }
  return out;
}

/** 从任务 5.1 原始输出解析 `L3_Value_Proposition_Matrix` 内行（含 Value_Proposition 合成行 + 业务能力单元）。 */
export function parseTask51L3TargetKvSyncRows(l3ValuePropositionRaw: string): ParseTask2L1TargetKvRowsResult {
  const raw = stripBom(String(l3ValuePropositionRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const matrix = readTask51L3ValuePropositionMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L3_Value_Proposition_Matrix。请确认模型输出根键为 L3_Value_Proposition_Matrix。',
    };
  }
  const got = readTask51L3TargetKvItemsArray(raw);
  if (!got.ok) return got;
  const rows: Task2L1TargetKvSyncRow[] = [...buildTask51ValuePropositionSyntheticRows(matrix)];
  const seen = new Set<string>();
  for (const item of got.arr) {
    const parsed = parseOneTask2L1TargetKvLikeItem(item);
    if (!parsed) continue;
    const key = String(parsed.featureKey || '').trim();
    if (key !== '业务能力单元') continue;
    const dedup = `${key}::${parsed.featureValue}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    rows.push({ ...parsed, featureKey: '业务能力单元' });
  }
  if (rows.length === 0) {
    return {
      ok: false,
      message:
        '未解析到有效的战略价值主张或业务能力单元节点；请按 L3_Value_Proposition_Matrix 契约输出 Value_Proposition 与 Feature_Key=「业务能力单元」的 Target_KV 行。',
    };
  }
  const hasCapabilityUnit = rows.some((r) => r.featureKey === '业务能力单元');
  if (!hasCapabilityUnit) {
    return {
      ok: false,
      message: 'Target_KV 中须至少包含一行 Feature_Key=「业务能力单元」',
    };
  }
  return { ok: true, rows };
}

/** 将任务 5.1 模型原文规范为仅含 `L3_Value_Proposition_Matrix` 的 JSON。 */
export function normalizeL51ValuePropositionRawForServerSync(
  l3ValuePropositionRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3ValuePropositionRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) return { ok: false, message: 'JSON 解析失败' };
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask51L3ValuePropositionMatrixFromRoot(obj);
  if (matrix) {
    try {
      return { ok: true, normalized: JSON.stringify({ L3_Value_Proposition_Matrix: matrix }) };
    } catch {
      return { ok: false, message: 'JSON 序列化失败' };
    }
  }
  const got = readTask51L3TargetKvItemsArray(raw);
  if (!got.ok) return got;
  try {
    return {
      ok: true,
      normalized: JSON.stringify({
        L3_Value_Proposition_Matrix: { Target_KV: got.arr },
      }),
    };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/** 任务 5.1 TVM：`Mapped_L5_Feature` 归一为「业务能力单元」 */
export function normalizeTask51L3MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (s === '业务能力单元') return '业务能力单元';
  return null;
}

/** 从任务 5.1 `L3_Value_Proposition_Matrix` 解析 Token_Validation_Mapping */
export function parseTokenValidationMappingFromL51ValuePropositionRaw(
  l3ValuePropositionRaw: string,
): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL2JsonRootRecord(l3ValuePropositionRaw);
  if (!rootObj) return [];
  const m = readTask51L3ValuePropositionMatrixFromRoot(rootObj);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList)) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedKey = normalizeTask51L3MappedFeatureKey(
      rec.Mapped_L5_Feature ??
        rec.mapped_l5_feature ??
        getPropertyCI(rec, 'Mapped_L5_Feature', 'mapped_l5_feature') ??
        rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature'),
    );
    if (!mappedKey) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey: mappedKey,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  return out;
}

const TASK52_L3_ASSET_FIELD_SET_KEY = '业务能力字段集' as const;

/** 任务 5.2：落库 Feature_Key 白名单 */
export function isTask52L3TargetKvSyncableFeatureKey(key: string): boolean {
  return String(key || '').trim() === TASK52_L3_ASSET_FIELD_SET_KEY;
}

function readTask52L3AssetMappingMatrixFromRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(
    root.L3_Asset_Mapping_Matrix ??
      root.l3_asset_mapping_matrix ??
      getPropertyCI(root, 'L3_Asset_Mapping_Matrix', 'l3_asset_mapping_matrix'),
  );
}

function readTask52L3AssetMappingMatrixFromRaw(l3Raw: string): Record<string, unknown> | null {
  const obj = readL2JsonRootRecord(l3Raw);
  if (!obj) return null;
  return readTask52L3AssetMappingMatrixFromRoot(obj);
}

function readTask52L3TargetKvItemsArray(
  l3AssetMappingRaw: string,
): { ok: true; arr: unknown[] } | { ok: false; message: string } {
  const raw = stripBom(String(l3AssetMappingRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 5.2 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask52L3AssetMappingMatrixFromRoot(obj);
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L3_Asset_Mapping_Matrix。请确认模型输出根键为 L3_Asset_Mapping_Matrix 且含 Target_KV（Feature_Key=「业务能力字段集」）。',
    };
  }
  const arr = readTargetKvFromContainer(matrix);
  if (!arr?.length) {
    return { ok: false, message: 'L3_Asset_Mapping_Matrix 内 Target_KV 为空' };
  }
  return { ok: true, arr };
}

function task52TargetKvDedupKey(featureValue: unknown): string {
  const v =
    featureValue != null && typeof featureValue === 'object' && !Array.isArray(featureValue)
      ? String(
          (featureValue as Record<string, unknown>).Feature_Value ??
            (featureValue as Record<string, unknown>).feature_value ??
            '',
        ).trim()
      : String(featureValue ?? '').trim();
  return `${TASK52_L3_ASSET_FIELD_SET_KEY}::${v}`;
}

/** 从任务 5.2 原始输出解析 `L3_Asset_Mapping_Matrix` 内 `业务能力字段集` 行。 */
export function parseTask52L3TargetKvSyncRows(l3AssetMappingRaw: string): ParseTask2L1TargetKvRowsResult {
  const got = readTask52L3TargetKvItemsArray(l3AssetMappingRaw);
  if (!got.ok) return got;
  const seen = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  for (const item of got.arr) {
    const parsed = parseOneTask2L1TargetKvLikeItem(item);
    if (!parsed) continue;
    const key = String(parsed.featureKey || '').trim();
    if (!isTask52L3TargetKvSyncableFeatureKey(key)) continue;
    const dedup = task52TargetKvDedupKey(parsed.featureValue);
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    rows.push({ ...parsed, featureKey: TASK52_L3_ASSET_FIELD_SET_KEY });
  }
  if (rows.length === 0) {
    return {
      ok: false,
      message:
        '未解析到业务能力字段集节点；请按 L3_Asset_Mapping_Matrix 契约输出 Feature_Key=「业务能力字段集」且 fields_schema_tree 行内嵌套列定义',
    };
  }
  return { ok: true, rows };
}

/** 将任务 5.2 模型原文规范为仅含 `L3_Asset_Mapping_Matrix` 的 JSON。 */
export function normalizeL52AssetMappingRawForServerSync(
  l3AssetMappingRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3AssetMappingRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) return { ok: false, message: 'JSON 解析失败' };
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask52L3AssetMappingMatrixFromRoot(obj);
  if (matrix) {
    try {
      return { ok: true, normalized: JSON.stringify({ L3_Asset_Mapping_Matrix: matrix }) };
    } catch {
      return { ok: false, message: 'JSON 序列化失败' };
    }
  }
  const got = readTask52L3TargetKvItemsArray(raw);
  if (!got.ok) return got;
  try {
    return {
      ok: true,
      normalized: JSON.stringify({
        L3_Asset_Mapping_Matrix: { Target_KV: got.arr },
      }),
    };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/** 任务 5.2 TVM：`Mapped_L3_Feature` 归一为「业务能力字段集」或「业务能力单元」（链至任务 5.1） */
export function normalizeTask52L3MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (s === TASK52_L3_ASSET_FIELD_SET_KEY) return TASK52_L3_ASSET_FIELD_SET_KEY;
  if (s === '业务能力单元') return '业务能力单元';
  return null;
}

/** 从任务 5.2 `L3_Asset_Mapping_Matrix` 解析 Token_Validation_Mapping */
export function parseTokenValidationMappingFromL52AssetMappingRaw(
  l3AssetMappingRaw: string,
): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL2JsonRootRecord(l3AssetMappingRaw);
  if (!rootObj) return [];
  const m = readTask52L3AssetMappingMatrixFromRoot(rootObj);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList)) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedKey = normalizeTask52L3MappedFeatureKey(
      rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature') ??
        rec.Mapped_L5_Feature ??
        rec.mapped_l5_feature ??
        getPropertyCI(rec, 'Mapped_L5_Feature', 'mapped_l5_feature'),
    );
    if (!mappedKey) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (!consistencyLabel) consistencyLabel = '逻辑一致';
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey: mappedKey,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  return out;
}

/** 任务 5.3 落库主键（2026-06 工作流拓扑版） */
export const TASK53_L3_WORKFLOW_FLOW_KEY = '关键工作流' as const;

/** 任务 5.3：单环节节点 Feature_Key / token 路径段 */
export const TASK53_L3_WORKFLOW_STEP_KEY = '流程环节' as const;

/** 历史模型输出兼容 */
const TASK53_L3_WORKFLOW_FLOW_KEY_LEGACY = '关键场景时序流转' as const;

/** 剥除模型常带的弯引号/直引号包裹 */
function normalizeTask53FeatureKeyLabel(raw: unknown): string {
  return String(raw ?? '')
    .replace(/^[「『"'“\s]+/, '')
    .replace(/[」』"'”\s]+$/, '')
    .trim();
}

/** 任务 5.3：落库 Feature_Key 白名单 */
export function isTask53L3TargetKvSyncableFeatureKey(key: string): boolean {
  const k = normalizeTask53FeatureKeyLabel(key);
  return k === TASK53_L3_WORKFLOW_FLOW_KEY || k === TASK53_L3_WORKFLOW_FLOW_KEY_LEGACY;
}

function task53DedupLabelFromFeatureValueObject(rec: Record<string, unknown>): string {
  const wf = String(rec.workflow_name ?? rec.Workflow_Name ?? '').trim();
  if (wf) return wf;
  const seg = String(rec.flow_segment_name ?? rec.Flow_Segment_Name ?? '').trim();
  if (seg) return seg;
  return '';
}

function readTask53WorkflowStepsTopologyArray(root: Record<string, unknown>): unknown[] {
  const raw =
    root.workflow_steps_topology ??
    root.Workflow_Steps_Topology ??
    getPropertyCI(root, 'workflow_steps_topology', 'Workflow_Steps_Topology', 'workflowStepsTopology');
  return Array.isArray(raw) ? raw : [];
}

function task53WorkflowPayloadLooksValid(rec: Record<string, unknown>): boolean {
  return (
    readTask53WorkflowStepsTopologyArray(rec).length > 0 ||
    task53DedupLabelFromFeatureValueObject(rec).length > 0
  );
}

function peelTask53DesignFeatureValueLayers(value: unknown, maxDepth = 8): unknown {
  let cur = peelJsonStringLayers(value, maxDepth);
  for (let i = 0; i < maxDepth; i++) {
    const rec = asRecord(cur);
    if (!rec) break;
    const inner =
      rec.Feature_Value ??
      rec.feature_value ??
      getPropertyCI(rec, 'Feature_Value', 'feature_value', 'featureValue');
    if (inner === undefined || inner === null) break;
    cur = peelJsonStringLayers(inner, 4);
  }
  return cur;
}

function extractTask53WorkflowFromMatrixRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  const matrix = readTask53L3WorkflowFlowMatrixFromRoot(root);
  if (!matrix) return null;
  const arr = readTargetKvFromContainer(matrix);
  if (!arr?.length) return null;
  for (const item of arr) {
    const row = asRecord(item);
    if (!row) continue;
    const fk = normalizeTask53FeatureKeyLabel(String(featureKeyFromRow(row) ?? ''));
    if (!isTask53L3TargetKvSyncableFeatureKey(fk)) continue;
    const peeled = peelTask53DesignFeatureValueLayers(row.Feature_Value ?? row.feature_value);
    const inner = asRecord(peeled);
    if (inner && task53WorkflowPayloadLooksValid(inner)) return inner;
  }
  return null;
}

/** 从 `DesignFeatureNode.value` 抽出关键工作流 JSON（task-graph `featureValue` / 逻辑树解包） */
export function extractTask53WorkflowPayloadFromDesignFeatureValue(
  value: unknown,
): Record<string, unknown> | null {
  const peeled = peelTask53DesignFeatureValueLayers(value, 8);
  const rec = asRecord(peeled);
  if (!rec) return null;
  const fromMatrix = extractTask53WorkflowFromMatrixRoot(rec);
  if (fromMatrix) return fromMatrix;
  if (task53WorkflowPayloadLooksValid(rec)) return rec;
  return null;
}

/** 任务 5.3：`workflow_name` 展示标签（GET task-graph `features[].name` 回退） */
export function task53WorkflowNameFromDesignFeatureValue(value: unknown): string {
  const inner = extractTask53WorkflowPayloadFromDesignFeatureValue(value);
  if (!inner) return '';
  return task53DedupLabelFromFeatureValueObject(inner);
}

function readTask53L3WorkflowFlowMatrixFromRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(
    root.L3_Workflow_Flow_Matrix ??
      root.l3_workflow_flow_matrix ??
      getPropertyCI(root, 'L3_Workflow_Flow_Matrix', 'l3_workflow_flow_matrix'),
  );
}

function readTask53L3TargetKvItemsArray(
  l3WorkflowFlowRaw: string,
): { ok: true; arr: unknown[] } | { ok: false; message: string } {
  const raw = stripBom(String(l3WorkflowFlowRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 5.3 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask53L3WorkflowFlowMatrixFromRoot(obj);
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L3_Workflow_Flow_Matrix。请确认模型输出根键为 L3_Workflow_Flow_Matrix 且含 Target_KV（Feature_Key=「关键工作流」）。',
    };
  }
  const arr = readTargetKvFromContainer(matrix);
  if (!arr?.length) {
    return { ok: false, message: 'L3_Workflow_Flow_Matrix 内 Target_KV 为空' };
  }
  return { ok: true, arr };
}

function task53TargetKvDedupKey(featureValue: unknown): string {
  if (featureValue != null && typeof featureValue === 'object' && !Array.isArray(featureValue)) {
    const rec = featureValue as Record<string, unknown>;
    const nested =
      rec.Feature_Value ?? rec.feature_value ?? getPropertyCI(rec, 'Feature_Value', 'feature_value');
    if (nested != null && typeof nested === 'object' && !Array.isArray(nested)) {
      const label = task53DedupLabelFromFeatureValueObject(nested as Record<string, unknown>);
      if (label) return `${TASK53_L3_WORKFLOW_FLOW_KEY}::${label}`;
    }
    const labelDirect = task53DedupLabelFromFeatureValueObject(rec);
    if (labelDirect) return `${TASK53_L3_WORKFLOW_FLOW_KEY}::${labelDirect}`;
    try {
      return `${TASK53_L3_WORKFLOW_FLOW_KEY}::${JSON.stringify(rec).slice(0, 240)}`;
    } catch {
      return `${TASK53_L3_WORKFLOW_FLOW_KEY}::__object__`;
    }
  }
  const raw = String(featureValue ?? '').trim();
  if (!raw.length) return `${TASK53_L3_WORKFLOW_FLOW_KEY}::__empty__`;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const rec = asRecord(parsed);
    if (rec) {
      const label = task53DedupLabelFromFeatureValueObject(rec);
      if (label) return `${TASK53_L3_WORKFLOW_FLOW_KEY}::${label}`;
    }
  } catch {
    /* 非 JSON 则整段去重 */
  }
  return `${TASK53_L3_WORKFLOW_FLOW_KEY}::${raw.slice(0, 240)}`;
}

/** 从任务 5.3 原始输出解析 `L3_Workflow_Flow_Matrix` 内「关键工作流」行（兼容历史「关键场景时序流转」）。 */
export function parseTask53L3TargetKvSyncRows(l3WorkflowFlowRaw: string): ParseTask2L1TargetKvRowsResult {
  const got = readTask53L3TargetKvItemsArray(l3WorkflowFlowRaw);
  if (!got.ok) return got;
  const seen = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  for (const item of got.arr) {
    const parsed = parseOneTask2L1TargetKvLikeItem(item);
    if (!parsed) continue;
    const key = String(parsed.featureKey || '').trim();
    if (!isTask53L3TargetKvSyncableFeatureKey(key)) continue;
    const dedup = task53TargetKvDedupKey(parsed.featureValue);
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    rows.push({ ...parsed, featureKey: TASK53_L3_WORKFLOW_FLOW_KEY });
  }
  if (rows.length === 0) {
    return {
      ok: false,
      message:
        '未解析到关键工作流节点；请按 L3_Workflow_Flow_Matrix 契约输出 Feature_Key=「关键工作流」',
    };
  }
  return { ok: true, rows };
}

/** 将任务 5.3 模型原文规范为仅含 `L3_Workflow_Flow_Matrix` 的 JSON。 */
export function normalizeL53WorkflowFlowRawForServerSync(
  l3WorkflowFlowRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3WorkflowFlowRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) return { ok: false, message: 'JSON 解析失败' };
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask53L3WorkflowFlowMatrixFromRoot(obj);
  if (matrix) {
    try {
      return { ok: true, normalized: JSON.stringify({ L3_Workflow_Flow_Matrix: matrix }) };
    } catch {
      return { ok: false, message: 'JSON 序列化失败' };
    }
  }
  const got = readTask53L3TargetKvItemsArray(raw);
  if (!got.ok) return got;
  try {
    return {
      ok: true,
      normalized: JSON.stringify({
        L3_Workflow_Flow_Matrix: { Target_KV: got.arr },
      }),
    };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/** 任务 5.3 TVM：`Mapped_L3_Feature` 归一为「关键工作流」或上游 5.2/5.1 键 */
export function normalizeTask53L3MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (s === TASK53_L3_WORKFLOW_FLOW_KEY || s === TASK53_L3_WORKFLOW_FLOW_KEY_LEGACY) {
    return TASK53_L3_WORKFLOW_FLOW_KEY;
  }
  if (s === TASK53_L3_WORKFLOW_STEP_KEY) return TASK53_L3_WORKFLOW_STEP_KEY;
  if (s === '业务能力字段集') return '业务能力字段集';
  if (s === '业务能力单元') return '业务能力单元';
  return null;
}

function readTask53StepNameFromRecord(step: Record<string, unknown>): string {
  return String(step.step_name ?? step.Step_Name ?? '').trim();
}

function readTask53StepPredFromRecord(step: Record<string, unknown>): string {
  return String(step.predecessor_step_name ?? step.Predecessor_Step_Name ?? '').trim();
}

function readTask53StepSuccFromRecord(step: Record<string, unknown>): string {
  return String(step.successor_step_name ?? step.Successor_Step_Name ?? '').trim();
}

function isTask53TopologyStartPred(pred: string, stepNames: Set<string>): boolean {
  const p = String(pred ?? '').trim();
  if (!p || p === 'START_NODE') return true;
  return !stepNames.has(p);
}

/** 按 predecessor/successor 链排序环节（与前端 `orderTask53WorkflowStepsFromRoot` 口径一致） */
export function orderTask53WorkflowStepsFromPayload(
  root: Record<string, unknown>,
): Array<{
  stepName: string;
  associatedCapabilityUnit: string;
  associatedAssetDataset: string;
}> {
  const steps: Record<string, unknown>[] = [];
  for (const item of readTask53WorkflowStepsTopologyArray(root)) {
    const step = asRecord(item);
    if (!step) continue;
    const name = readTask53StepNameFromRecord(step);
    if (name) steps.push(step);
  }
  if (!steps.length) return [];

  const byName = new Map<string, Record<string, unknown>>();
  const names = new Set<string>();
  for (const s of steps) {
    const n = readTask53StepNameFromRecord(s);
    byName.set(n, s);
    names.add(n);
  }

  let cur =
    steps.find((s) => isTask53TopologyStartPred(readTask53StepPredFromRecord(s), names)) ?? steps[0];
  const ordered: Array<{
    stepName: string;
    associatedCapabilityUnit: string;
    associatedAssetDataset: string;
  }> = [];
  const seen = new Set<string>();

  const pushStep = (rec: Record<string, unknown>) => {
    const stepName = readTask53StepNameFromRecord(rec);
    ordered.push({
      stepName,
      associatedCapabilityUnit: String(
        rec.associated_capability_unit ?? rec.Associated_Capability_Unit ?? '',
      ).trim(),
      associatedAssetDataset: String(
        rec.associated_asset_dataset ?? rec.Associated_Asset_Dataset ?? '',
      ).trim(),
    });
  };

  while (cur) {
    const name = readTask53StepNameFromRecord(cur);
    if (!name || seen.has(name)) break;
    seen.add(name);
    pushStep(cur);
    const succ = readTask53StepSuccFromRecord(cur);
    if (!succ || succ === 'END_NODE') break;
    const next = byName.get(succ);
    if (!next) break;
    cur = next;
  }

  for (const s of steps) {
    const name = readTask53StepNameFromRecord(s);
    if (name && !seen.has(name)) pushStep(s);
  }
  return ordered;
}

export function task53WorkflowStepTokenSurface(workflowName: string, stepName: string): string {
  const wf = String(workflowName || '').trim() || '（未命名流程）';
  const step = String(stepName || '').trim() || '（未命名环节）';
  return `${TASK53_L3_WORKFLOW_FLOW_KEY}/${wf}/环节/${step}`;
}

export function task53StepFeatureIdMapKey(workflowIndex: number, stepName: string): string {
  return `${workflowIndex}\t${String(stepName || '').trim()}`;
}

export type Task53WorkflowStepFeaturePlan = {
  workflowIndex: number;
  workflowName: string;
  stepName: string;
  featureKey: typeof TASK53_L3_WORKFLOW_STEP_KEY;
  tokenSurface: string;
  featureValue: Record<string, unknown>;
  associatedCapabilityUnit: string;
  associatedAssetDataset: string;
};

/** 任务 5.3 落库：为每条关键工作流拓扑展开「流程环节」特征计划 */
export function buildTask53WorkflowStepFeaturePlans(
  cleaned: ReadonlyArray<{ featureValue?: unknown }>,
): Task53WorkflowStepFeaturePlan[] {
  const out: Task53WorkflowStepFeaturePlan[] = [];
  for (let wi = 0; wi < cleaned.length; wi++) {
    const payload = extractTask53WorkflowPayloadFromDesignFeatureValue(cleaned[wi]?.featureValue);
    if (!payload) continue;
    const workflowName =
      task53DedupLabelFromFeatureValueObject(payload) || `关键工作流-${wi + 1}`;
    for (const step of orderTask53WorkflowStepsFromPayload(payload)) {
      const stepName = String(step.stepName || '').trim();
      if (!stepName) continue;
      out.push({
        workflowIndex: wi,
        workflowName,
        stepName,
        featureKey: TASK53_L3_WORKFLOW_STEP_KEY,
        tokenSurface: task53WorkflowStepTokenSurface(workflowName, stepName),
        featureValue: {
          workflow_name: workflowName,
          step_name: stepName,
          associated_capability_unit: step.associatedCapabilityUnit,
          associated_asset_dataset: step.associatedAssetDataset,
        },
        associatedCapabilityUnit: step.associatedCapabilityUnit,
        associatedAssetDataset: step.associatedAssetDataset,
      });
    }
  }
  return out;
}

/** 环节节点展示名（GET task-graph `features[].name`） */
export function task53StepNameFromDesignFeatureValue(value: unknown): string {
  const peeled = peelTask53DesignFeatureValueLayers(value, 8);
  const rec = asRecord(peeled);
  if (!rec) return '';
  return readTask53StepNameFromRecord(rec);
}

export type Task52FieldSetRef = {
  featureId: string;
  label: string;
};

export type Task53ForwardLinkInsert = {
  sourceFeatureId: string;
  targetFeatureId: string;
  logic: string;
  weight: number;
};

function resolveTask52FieldSetFeatureId(
  associatedDataset: string,
  fieldSets: readonly Task52FieldSetRef[],
): string | null {
  return resolveTask52CapabilityUnitFeatureId(associatedDataset, fieldSets);
}

/**
 * 任务 5.3 落库：5.1 业务能力单元 / 5.2 字段集 → 流程环节，以及关键工作流 → 环节（层内正向归纳）。
 */
export function buildTask53WorkflowAndStepForwardLinks(
  cleaned: ReadonlyArray<{ featureValue?: unknown; inferenceWeight?: number }>,
  workflowFeatureIds: readonly string[],
  stepFeatureIdByKey: ReadonlyMap<string, string>,
  capabilityUnits: readonly Task52CapabilityUnitRef[],
  fieldSets: readonly Task52FieldSetRef[],
): Task53ForwardLinkInsert[] {
  const out: Task53ForwardLinkInsert[] = [];
  const seen = new Set<string>();
  const defaultWeight = (row: { inferenceWeight?: number } | undefined) =>
    typeof row?.inferenceWeight === 'number' && Number.isFinite(row.inferenceWeight)
      ? Math.min(1, Math.max(0, row.inferenceWeight))
      : 0.85;

  const push = (src: string, tgt: string, logic: string, weight: number) => {
    if (!src || !tgt || src === tgt) return;
    const pairKey = `${src}\t${tgt}`;
    if (seen.has(pairKey)) return;
    seen.add(pairKey);
    out.push({ sourceFeatureId: src, targetFeatureId: tgt, logic, weight });
  };

  const stepPlans = buildTask53WorkflowStepFeaturePlans(cleaned);
  for (const plan of stepPlans) {
    const tgt = String(
      stepFeatureIdByKey.get(task53StepFeatureIdMapKey(plan.workflowIndex, plan.stepName)) ?? '',
    ).trim();
    if (!tgt) continue;
    const wfId = String(workflowFeatureIds[plan.workflowIndex] ?? '').trim();
    const row = cleaned[plan.workflowIndex];
    const wfWeight = Math.min(0.75, defaultWeight(row));

    if (wfId) {
      push(
        wfId,
        tgt,
        `正向归纳：关键工作流「${plan.workflowName}」→ 环节「${plan.stepName}」`,
        wfWeight,
      );
    }

    const capSrc = resolveTask52CapabilityUnitFeatureId(
      plan.associatedCapabilityUnit,
      capabilityUnits,
    );
    if (capSrc) {
      const acu = plan.associatedCapabilityUnit || '（未命名）';
      push(
        capSrc,
        tgt,
        `正向归纳：业务能力单元「${acu}」→ 环节「${plan.stepName}」（能力单元权重穿透至流程环节）`,
        defaultWeight(row),
      );
    }

    const fsSrc = resolveTask52FieldSetFeatureId(plan.associatedAssetDataset, fieldSets);
    if (fsSrc) {
      const ds = plan.associatedAssetDataset || '（未命名）';
      push(
        fsSrc,
        tgt,
        `正向归纳：业务能力字段集「${ds}」→ 环节「${plan.stepName}」（字段集权重穿透至流程环节）`,
        defaultWeight(row),
      );
    }
  }
  return out;
}

/** 从任务 5.3 `L3_Workflow_Flow_Matrix` 解析 Token_Validation_Mapping */
export function parseTokenValidationMappingFromL53WorkflowFlowRaw(
  l3WorkflowFlowRaw: string,
): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL2JsonRootRecord(l3WorkflowFlowRaw);
  if (!rootObj) return [];
  const m = readTask53L3WorkflowFlowMatrixFromRoot(rootObj);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList)) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedKey = normalizeTask53L3MappedFeatureKey(
      rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature') ??
        rec.Mapped_L5_Feature ??
        rec.mapped_l5_feature ??
        getPropertyCI(rec, 'Mapped_L5_Feature', 'mapped_l5_feature'),
    );
    if (!mappedKey) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (!consistencyLabel) consistencyLabel = '逻辑一致';
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey: mappedKey,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  return out;
}

/** 从任务 5.5 `L3_5_VSM_Inference_Matrix` 解析 Token_Validation_Mapping */
export function parseTokenValidationMappingFromL35VsmInferenceRaw(
  l3VsmInferenceRaw: string,
): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL2JsonRootRecord(l3VsmInferenceRaw);
  if (!rootObj) return [];
  const m = readTask55L3VsmMatrixFromRoot(rootObj);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList)) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedKey = normalizeTask55L3MappedFeatureKey(
      rec.Mapped_L5_Feature ??
        rec.mapped_l5_feature ??
        getPropertyCI(rec, 'Mapped_L5_Feature', 'mapped_l5_feature') ??
        rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature'),
    );
    if (!mappedKey) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey: mappedKey,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  return out;
}

/** 任务 6 L3 关键场景键（统一 `关键场景` 或历史 `关键场景_*`） */
export function isTask6L3ScenarioFeatureKey(featureKey: string): boolean {
  const k = String(featureKey || '').trim();
  if (k === '关键场景') return true;
  return /^关键场景[_\s]*\d+/i.test(k);
}

function isTask6ExtendedFeaturePlaceholderKey(featureKey: string): boolean {
  const k = String(featureKey || '').trim();
  if (!k.length) return true;
  if (/无特征时留空|（无特征时留空）/u.test(k)) return true;
  return false;
}

const L3_SCENARIO_MATRIX_KEY_PAIRS: Array<[string, string]> = [
  ['L3_Scenario_Inference_Matrix', 'l3_scenario_inference_matrix'],
];

function readL3ScenarioMatrixFromRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  for (const [k1, k2] of L3_SCENARIO_MATRIX_KEY_PAIRS) {
    const direct = asRecord(getPropertyCI(root, k1, k2));
    if (direct) return direct;
  }
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    for (const [k1, k2] of L3_SCENARIO_MATRIX_KEY_PAIRS) {
      const inner = asRecord(getPropertyCI(o, k1, k2));
      if (inner) return inner;
    }
  }
  const topKv = readTargetKvFromContainer(root);
  if (topKv?.length) return root;
  return null;
}

/** 自任务 6 模型 JSON 读取 `L3_Scenario_Inference_Matrix` 容器 */
function readTask6L3ScenarioMatrixFromRaw(l3ScenarioInferenceRaw: string): Record<string, unknown> | null {
  const obj = readL2JsonRootRecord(l3ScenarioInferenceRaw);
  if (!obj) return null;
  return readL3ScenarioMatrixFromRoot(obj);
}

function readExtendedFeaturesArrayFromScenarioMatrix(matrix: Record<string, unknown>): unknown[] {
  const raw =
    matrix.Extended_Features ??
    matrix.extended_features ??
    getPropertyCI(matrix, 'Extended_Features', 'extended_features');
  return Array.isArray(raw) ? raw : [];
}

/** 任务 6：`关键场景` / `关键场景_*` Target_KV + 非占位 Extended_Features（历史兼容） */
export function parseTask6L3ScenarioTargetKvSyncRows(
  l3ScenarioInferenceRaw: string,
): ParseTask2L1TargetKvRowsResult {
  const raw = stripBom(String(l3ScenarioInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 6 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask6L3ScenarioMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L3_Scenario_Inference_Matrix 或非空 Target_KV；请确认模型输出为 L3_Scenario_Inference_Matrix 契约 JSON',
    };
  }
  const targetKv = readTargetKvFromContainer(matrix);
  const seen = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  if (targetKv?.length) {
    appendParsedTask2L1Rows(
      targetKv.filter((item) => {
        const rec = asRecord(item);
        if (!rec) return false;
        const key = featureKeyFromRow(rec);
        return !!key && isTask6L3ScenarioFeatureKey(key);
      }),
      rows,
      seen,
    );
  }
  const extArr = readExtendedFeaturesArrayFromScenarioMatrix(matrix);
  if (extArr.length) {
    appendParsedTask2L1Rows(
      extArr.filter((item) => {
        const rec = asRecord(item);
        if (!rec) return false;
        const key = featureKeyFromRow(rec);
        return !!key && !isTask6ExtendedFeaturePlaceholderKey(key);
      }),
      rows,
      seen,
    );
  }
  const validateArr = readL3ValidateMatrixArrayFromScenarioMatrix(matrix);
  if (validateArr.length) {
    appendParsedTask2L1Rows(
      validateArr.filter((item) => {
        const rec = asRecord(item);
        if (!rec) return false;
        const key = featureKeyFromRow(rec);
        return !!key && isTask6L3ValidateFeatureKey(key);
      }),
      rows,
      seen,
    );
  }
  if (rows.length === 0) {
    return {
      ok: false,
      message:
        '未解析到关键场景节点（Feature_Key=「关键场景」）；请按 L3_Scenario_Inference_Matrix 契约输出至少一个战术场景',
    };
  }
  return { ok: true, rows };
}

export type Task6ClassifiedWorkflowRef = {
  workflow_feature_id: string;
  workflow_name: string;
};

/** 自 5.5 阶段落库 value 读取 `classified_workflows` */
export function readClassifiedWorkflowsFromDesignFeatureValue(
  value: unknown,
): Task6ClassifiedWorkflowRef[] {
  let cur: unknown = value;
  if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
    const rec = cur as Record<string, unknown>;
    const nested = rec.Feature_Value ?? rec.feature_value;
    if (nested !== undefined && nested !== null) cur = nested;
  }
  if (typeof cur === 'string') {
    try {
      cur = JSON.parse(cur);
    } catch {
      return [];
    }
  }
  const rec = asRecord(cur);
  if (!rec) return [];
  const arr = rec.classified_workflows ?? rec.Classified_Workflows;
  if (!Array.isArray(arr)) return [];
  const out: Task6ClassifiedWorkflowRef[] = [];
  for (const item of arr) {
    const w = asRecord(item);
    if (!w) continue;
    const workflow_name = String(w.workflow_name ?? w.Workflow_Name ?? '').trim();
    const workflow_feature_id = String(
      w.workflow_feature_id ?? w.Workflow_Feature_Id ?? '',
    ).trim();
    if (!workflow_name && !workflow_feature_id) continue;
    out.push({ workflow_feature_id, workflow_name });
  }
  return out;
}

function task6ValidFtId(featureId: string): boolean {
  const s = String(featureId || '').trim();
  return /^ft_\d{12}$/i.test(s) && !isDesignDetailPlaceholderFeatureId(s);
}

function task6ScenarioPayloadFromSyncRow(row: Task6EvidenceRowInput): Record<string, unknown> | null {
  let cur: unknown = row.featureValue;
  for (let i = 0; i < 8; i++) {
    if (cur === null || cur === undefined) return null;
    if (typeof cur === 'string') {
      const t = cur.trim();
      if (!t) return null;
      try {
        cur = JSON.parse(t);
        continue;
      } catch {
        return null;
      }
    }
    const rec = asRecord(cur);
    if (!rec) return null;
    if (rec.scenario_name || rec.targeted_value_phase || rec.associated_pain_point) return rec;
    const nested = rec.Feature_Value ?? rec.feature_value;
    if (nested === undefined || nested === null) return rec;
    cur = nested;
  }
  return asRecord(cur);
}

function task6ResolveAliasFtId(
  rawId: string,
  aliasMap: ReadonlyMap<string, string>,
): string {
  const direct = resolveEvidenceLinkSourceFeatureId(rawId, aliasMap);
  if (task6ValidFtId(direct)) return direct;
  return '';
}

function task6ResolvePhaseFeatureId(
  phaseName: string,
  aliasMap: ReadonlyMap<string, string>,
): string {
  const name = String(phaseName || '').trim();
  if (!name) return '';
  const candidates = [name];
  if (!name.endsWith('阶段')) candidates.push(`${name}阶段`);
  if (name.endsWith('阶段')) candidates.push(name.replace(/阶段$/u, ''));
  for (const c of candidates) {
    const id = task6ResolveAliasFtId(c, aliasMap);
    if (id) return id;
  }
  return '';
}

function task6ResolveWorkflowFeatureId(
  workflowName: string,
  classified: readonly Task6ClassifiedWorkflowRef[],
  aliasMap: ReadonlyMap<string, string>,
): string {
  const name = String(workflowName || '').trim();
  if (!name) return '';
  for (const w of classified) {
    if (String(w.workflow_name || '').trim() !== name) continue;
    const id = task6ResolveAliasFtId(w.workflow_feature_id, aliasMap);
    if (id) return id;
  }
  return task6ResolveAliasFtId(name, aliasMap);
}

/** 将已落库 5.5 / 5.3 / 任务 1 节点注册进 Evidence 源 id 别名表 */
export function registerTask6UpstreamEvidenceAliases(
  nodes: ReadonlyArray<{ featureId: string; value: unknown }>,
  aliasMap: Map<string, string>,
): void {
  for (const fn of nodes) {
    const fid = String(fn.featureId || '').trim();
    if (!fid) continue;
    aliasMap.set(fid, fid);
    const phase = task55VsmStagePhaseNameFromDesignFeatureValue(fn.value);
    if (phase) {
      aliasMap.set(phase, fid);
      if (!phase.endsWith('阶段')) aliasMap.set(`${phase}阶段`, fid);
      if (phase.endsWith('阶段')) {
        const short = phase.replace(/阶段$/u, '').trim();
        if (short) aliasMap.set(short, fid);
      }
    }
    const classified = readClassifiedWorkflowsFromDesignFeatureValue(fn.value);
    for (const w of classified) {
      if (task6ValidFtId(w.workflow_feature_id)) {
        aliasMap.set(w.workflow_feature_id, w.workflow_feature_id);
        if (w.workflow_name) aliasMap.set(w.workflow_name, w.workflow_feature_id);
      }
    }
    const wf = task53WorkflowNameFromDesignFeatureValue(fn.value);
    if (wf) aliasMap.set(wf, fid);
  }
}

/** 自结构化场景 JSON 合成三源正向归纳边（5.5 阶段 + 5.3 工作流 + 任务 1 痛点） */
export function synthesizeTask6ScenarioEvidenceLinks(
  row: Task6EvidenceRowInput,
  aliasMap: ReadonlyMap<string, string>,
): Task2L1EvidenceLinkPlan[] {
  const scenario = task6ScenarioPayloadFromSyncRow(row);
  if (!scenario) return [];
  const out: Task2L1EvidenceLinkPlan[] = [];
  const phaseName = String(scenario.targeted_value_phase ?? scenario.Targeted_Value_Phase ?? '').trim();
  const phaseId = task6ResolvePhaseFeatureId(phaseName, aliasMap);
  if (phaseId) {
    out.push({
      sourceFeatureId: phaseId,
      logic: '任务 5.5 价值流阶段主权领土正向归纳至本关键场景',
      weight: 1.0,
    });
  }
  const workflows = scenario.belonging_core_workflows ?? scenario.Belonging_Core_Workflows;
  const wfName = Array.isArray(workflows)
    ? String(asRecord(workflows[0])?.workflow_name ?? asRecord(workflows[0])?.Workflow_Name ?? '').trim()
    : '';
  const classified = readClassifiedWorkflowsFromDesignFeatureValue(scenario);
  const wfId = task6ResolveWorkflowFeatureId(wfName, classified, aliasMap);
  if (wfId) {
    out.push({
      sourceFeatureId: wfId,
      logic: '任务 5.3 核心工作流正向归纳至本关键场景',
      weight: 0.9,
    });
  }
  const pp = asRecord(scenario.associated_pain_point ?? scenario.Associated_Pain_Point);
  const painId = task6ResolveAliasFtId(
    String(pp?.pain_point_feature_id ?? pp?.Pain_Point_Feature_Id ?? ''),
    aliasMap,
  );
  if (painId) {
    out.push({
      sourceFeatureId: painId,
      logic: '任务 1 痛点雷达/现有表格化石正向归纳至本关键场景',
      weight: 1.0,
    });
  }
  return out;
}

export type Task6EvidenceRowInput = {
  featureValue?: unknown;
  evidenceLinks?: ReadonlyArray<Task2L1EvidenceLinkPlan>;
};

/** 合并模型 Evidence 与合成三源边，保证至少含 5.5 与任务 1 两类上游源（若别名表可解析） */
export function ensureTask6ScenarioEvidenceLinks(
  row: Task6EvidenceRowInput,
  aliasMap: ReadonlyMap<string, string>,
): Task2L1EvidenceLinkPlan[] {
  const synthesized = synthesizeTask6ScenarioEvidenceLinks(row, aliasMap);
  const seen = new Set<string>();
  const out: Task2L1EvidenceLinkPlan[] = [];
  const push = (L: Task2L1EvidenceLinkPlan) => {
    const src = task6ResolveAliasFtId(String(L.sourceFeatureId || '').trim(), aliasMap);
    if (!src || seen.has(src)) return;
    seen.add(src);
    out.push({ ...L, sourceFeatureId: src });
  };
  for (const L of row.evidenceLinks ?? []) push(L);
  for (const L of synthesized) push(L);
  return out;
}

/** 任务 6 TVM：`Mapped_L3_Feature` / 历史键归一为统一落库键「关键场景」 */
export function normalizeTask6L3MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s === '关键场景' || /^关键场景[_\s]*\d+/i.test(s)) return '关键场景';
  return null;
}

/** 任务 6 L3：`L3_validate_Matrix` 内流程骨干校验键 */
export function isTask6L3ValidateFeatureKey(featureKey: string): boolean {
  const k = String(featureKey || '').trim();
  return k === '流程骨干校验';
}

function readL3ValidateMatrixArrayFromScenarioMatrix(matrix: Record<string, unknown>): unknown[] {
  const raw =
    matrix.L3_validate_Matrix ??
    matrix.l3_validate_matrix ??
    getPropertyCI(matrix, 'L3_validate_Matrix', 'l3_validate_matrix');
  return Array.isArray(raw) ? raw : [];
}

function parseL3ValidateMatrixRowToTvPlan(
  rec: Record<string, unknown>,
): Task2L1TokenValidationLinkPlan | null {
  const fidRaw =
    rec.Target_FeatureID ??
    rec.target_feature_id ??
    getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
  const targetFeatureId =
    typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
  if (!targetFeatureId) return null;
  const mappedKey =
    normalizeTask6L3MappedFeatureKey(
      rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature'),
    ) ?? '关键场景';
  const vLogicRaw =
    rec.Validation_Logic ??
    rec.validation_logic ??
    getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
  const validationLogic =
    typeof vLogicRaw === 'string'
      ? vLogicRaw.trim()
      : String(vLogicRaw ?? '').trim() || '（无说明）';
  const vwRaw =
    rec.Validation_Weight ??
    rec.validation_weight ??
    getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
  const validationWeight = contributionToLinkWeight(vwRaw);
  const consRaw =
    rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
  let consistencyLabel =
    typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
  if (!consistencyLabel) {
    const fvRaw =
      rec.Feature_Value ?? rec.feature_value ?? getPropertyCI(rec, 'Feature_Value', 'feature_value');
    consistencyLabel =
      typeof fvRaw === 'string' ? fvRaw.trim() : String(fvRaw ?? '').trim();
  }
  if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
  return {
    targetFeatureId,
    mappedL1FeatureKey: mappedKey,
    validationLogic,
    validationWeight,
    consistencyLabel,
  };
}

function parseTokenValidationPlansFromL3ValidateMatrix(
  l3ScenarioInferenceRaw: string,
): Task2L1TokenValidationLinkPlan[] {
  const matrix = readTask6L3ScenarioMatrixFromRaw(l3ScenarioInferenceRaw);
  if (!matrix) return [];
  const arr = readL3ValidateMatrixArrayFromScenarioMatrix(matrix);
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of arr) {
    const rec = asRecord(item);
    if (!rec) continue;
    const plan = parseL3ValidateMatrixRowToTvPlan(rec);
    if (plan) out.push(plan);
  }
  return out;
}

function filterTask5L3TvPlansByMappedKey(
  plans: Task2L1TokenValidationLinkPlan[],
  pred: (mappedKey: string) => boolean,
): Task2L1TokenValidationLinkPlan[] {
  return plans.filter((p) => {
    const mk = String(p.mappedL1FeatureKey ?? '').trim();
    return mk.length > 0 && pred(mk);
  });
}

/** 从任务 5 L3 原始 JSON 解析 Token_Validation_Mapping（仅 L3_Process_Inference_Matrix）。 */
export function parseTokenValidationMappingFromL3ProcessInferenceRaw(
  l3ProcessInferenceRaw: string,
): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL2JsonRootRecord(l3ProcessInferenceRaw);
  const m = readTask5L3ProcessMatrixFromRaw(l3ProcessInferenceRaw);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList) && rootObj) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedKey = normalizeTask5L3MappedFeatureKey(
      rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature') ??
        rec.Mapped_L5_Feature ??
        rec.mapped_l5_feature ??
        getPropertyCI(rec, 'Mapped_L5_Feature', 'mapped_l5_feature') ??
        rec.Mapped_L2_Feature ??
        rec.mapped_l2_feature ??
        getPropertyCI(rec, 'Mapped_L2_Feature', 'mapped_l2_feature'),
    );
    if (!mappedKey) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey: mappedKey,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  return out;
}

/** 从任务 6 L3 原始 JSON 解析 Token_Validation_Mapping（`L3_Scenario_Inference_Matrix`）；无 TVM 时回退 `L3_validate_Matrix` */
export function parseTokenValidationMappingFromL6ScenarioInferenceRaw(
  l3ScenarioInferenceRaw: string,
): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL2JsonRootRecord(l3ScenarioInferenceRaw);
  const m = readTask6L3ScenarioMatrixFromRaw(l3ScenarioInferenceRaw);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList) && rootObj) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) rawList = [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList as unknown[]) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedKey = normalizeTask6L3MappedFeatureKey(
      rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature') ??
        rec.Mapped_L2_Feature ??
        rec.mapped_l2_feature ??
        getPropertyCI(rec, 'Mapped_L2_Feature', 'mapped_l2_feature'),
    );
    if (!mappedKey) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey: mappedKey,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  if (out.length === 0) {
    return parseTokenValidationPlansFromL3ValidateMatrix(l3ScenarioInferenceRaw);
  }
  return out;
}

/**
 * 将任务 6 模型原文规范为可落库的 JSON 字符串（须含 `L3_Scenario_Inference_Matrix` 与非空 Target_KV）。
 */
export function normalizeL6ScenarioInferenceRawForServerSync(
  l3ScenarioInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3ScenarioInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) return { ok: false, message: 'JSON 解析失败' };
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask6L3ScenarioMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message: '未找到 L3_Scenario_Inference_Matrix 或非空 Target_KV',
    };
  }
  const tkInMatrix = readTargetKvFromContainer(matrix);
  if (!tkInMatrix?.length) {
    return { ok: false, message: 'L3_Scenario_Inference_Matrix 内 Target_KV 为空' };
  }
  const hasScenarioMatrix = !!asRecord(
    getPropertyCI(obj, 'L3_Scenario_Inference_Matrix', 'l3_scenario_inference_matrix'),
  );
  const payload = hasScenarioMatrix ? obj : { L3_Scenario_Inference_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/**
 * 将任务 5.5 模型原文规范为仅含 `L3_5_VSM_Inference_Matrix` 的 JSON（接受 `L3_Value_Stream_Matrix` 根键并归一）。
 */
export function normalizeL3Vsm55InferenceRawForServerSync(
  l3ProcessInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3ProcessInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) return { ok: false, message: 'JSON 解析失败' };
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const vsmMatrix = readTask55L3VsmMatrixFromRoot(obj);
  if (vsmMatrix) {
    try {
      return { ok: true, normalized: JSON.stringify({ L3_5_VSM_Inference_Matrix: vsmMatrix }) };
    } catch {
      return { ok: false, message: 'JSON 序列化失败' };
    }
  }
  const got = readTask55L3VsmTargetKvItemsArray(raw);
  if (!got.ok) return got;
  try {
    return {
      ok: true,
      normalized: JSON.stringify({
        L3_5_VSM_Inference_Matrix: { Target_KV: got.arr },
      }),
    };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/**
 * 将任务 5 模型原文规范为可落库的 JSON 字符串（须含 `L3_Process_Inference_Matrix` 与非空 Target_KV）。
 */
export function normalizeL3ProcessInferenceRawForServerSync(
  l3ProcessInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3ProcessInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) return { ok: false, message: 'JSON 解析失败' };
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const hasFeatureMatrix = !!asRecord(
    getPropertyCI(obj, 'L3_Process_Feature_Matrix', 'l3_process_feature_matrix'),
  );
  const hasVsm55Matrix = !!asRecord(
    getPropertyCI(obj, 'L3_5_VSM_Inference_Matrix', 'l3_5_vsm_inference_matrix'),
  );
  const hasInferenceMatrix = !!asRecord(
    getPropertyCI(obj, 'L3_Process_Inference_Matrix', 'l3_process_inference_matrix'),
  );
  const matrix = readTask5L3ProcessMatrixFromRaw(raw);
  if (!matrix) {
    return { ok: false, message: buildTask5TargetKvMissingMessage(obj) };
  }
  const tkInMatrix = readTargetKvFromContainer(matrix);
  if (!tkInMatrix?.length) {
    return { ok: false, message: 'L3 矩阵内 Target_KV 为空' };
  }
  const onlyVsmStages = tkInMatrix.every((item) => {
    const rec = asRecord(item);
    if (!rec) return false;
    const key = featureKeyFromRow(rec);
    return key != null && isTask5L5VsmStageFeatureKey(key);
  });
  const payload =
    hasFeatureMatrix || hasVsm55Matrix || hasInferenceMatrix
      ? obj
      : onlyVsmStages
        ? { L3_5_VSM_Inference_Matrix: matrix }
        : { L3_Process_Inference_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/** 将 `POST …/sync-task5-l3-target-kv-tokens` 请求体归一为 L3 JSON 字符串。 */
export function coerceHttpBodyToL3ProcessInferenceRawString(body: unknown): string | null {
  if (body === null || body === undefined) return null;
  if (typeof body === 'string') {
    const t = stripBom(String(body).trim());
    return t.length ? t : null;
  }
  if (typeof body !== 'object' || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const r = o.l3ProcessInferenceRaw ?? o.l3_process_inference_raw;
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
  const matrixL3 =
    o.L3_Process_Feature_Matrix ??
    o.l3_process_feature_matrix ??
    o.L3_5_VSM_Inference_Matrix ??
    o.l3_5_vsm_inference_matrix ??
    o.L3_Value_Proposition_Matrix ??
    o.l3_value_proposition_matrix ??
    o.L3_Asset_Mapping_Matrix ??
    o.l3_asset_mapping_matrix ??
    o.L3_Process_Inference_Matrix ??
    o.l3_process_inference_matrix;
  if (matrixL3 != null && typeof matrixL3 === 'object') {
    try {
      return JSON.stringify(o);
    } catch {
      return null;
    }
  }
  const l47OrL475 =
    o.L4_7_Tech_Integration_Matrix ??
    o.l4_7_tech_integration_matrix ??
    o.L4_75_Physical_Hook_Integration_Matrix ??
    o.l4_75_physical_hook_integration_matrix;
  if (l47OrL475 != null && typeof l47OrL475 === 'object') {
    try {
      return JSON.stringify(o);
    } catch {
      return null;
    }
  }
  return null;
}

export type InferenceCausalityMatrixKind = 'L1' | 'L2_BUSINESS' | 'L2_VALUE' | 'L3';

export type ParsedCausalityAnalysis = {
  logicGapReport: string;
  insightResolutionSummary: string;
};

function readCausalityRecordFromMatrixAndRoot(
  matrix: Record<string, unknown> | null,
  rootObj: Record<string, unknown> | null,
): Record<string, unknown> | null {
  const fromMatrix =
    matrix &&
    asRecord(
      matrix.Causality_Analysis ??
        matrix.causality_analysis ??
        getPropertyCI(matrix, 'Causality_Analysis', 'causality_analysis'),
    );
  if (fromMatrix) return fromMatrix;
  if (!rootObj) return null;
  return asRecord(
    rootObj.Causality_Analysis ??
      rootObj.causality_analysis ??
      getPropertyCI(rootObj, 'Causality_Analysis', 'causality_analysis'),
  );
}

function readCausalityTextField(rec: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = rec[key] ?? getPropertyCI(rec, key, key.toLowerCase());
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v != null && typeof v !== 'object') {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return '';
}

/**
 * 从任务 2–5 推理 JSON 抽取 **Logic_Gap_Report**（或 L2/L3 等价主因果字段）与 **Insight_Resolution_Summary**。
 */
export function parseCausalityAnalysisFromInferenceRaw(
  inferenceRaw: string,
  matrixKind: InferenceCausalityMatrixKind,
): ParsedCausalityAnalysis {
  const raw = stripBom(String(inferenceRaw || '').trim());
  if (!raw.length) {
    return { logicGapReport: '', insightResolutionSummary: '' };
  }
  const rootObj = readL1JsonRootRecord(raw) ?? readL2JsonRootRecord(raw);
  let matrix: Record<string, unknown> | null = null;
  switch (matrixKind) {
    case 'L1':
      matrix = readL1InferenceMatrixFromRaw(raw);
      break;
    case 'L2_BUSINESS':
      matrix = readL2InferenceMatrixFromRaw(raw);
      break;
    case 'L2_VALUE':
      matrix = readL2ValueInferenceMatrixFromRaw(raw);
      break;
    case 'L3':
      matrix = readTask5L3ProcessMatrixFromRaw(raw);
      break;
    default:
      matrix = null;
  }
  const causality = readCausalityRecordFromMatrixAndRoot(matrix, rootObj);
  if (!causality) {
    return { logicGapReport: '', insightResolutionSummary: '' };
  }
  const logicGapReport = readCausalityTextField(
    causality,
    'Logic_Gap_Report',
    'logic_gap_report',
    'L1_Core_Insight',
    'l1_core_insight',
    'L1_Constraint_Effect',
    'l1_constraint_effect',
    'Value_Impact_on_Process',
    'value_impact_on_process',
    'Process_Gap_Report',
    'process_gap_report',
  );
  const insightResolutionSummary = readCausalityTextField(
    causality,
    'Insight_Resolution_Summary',
    'insight_resolution_summary',
    'Conflict_Resolution_Summary',
    'conflict_resolution_summary',
    'Schema_Gene_Inheritance',
    'schema_gene_inheritance',
    'Digital_Strategy_Focus',
    'digital_strategy_focus',
  );
  return { logicGapReport, insightResolutionSummary };
}

export type ParsedDiagnosticPainPoint = {
  painPointId: string;
  conflictDescription: string;
  insightConfirmation: string;
  rootCauseAnalysis: string;
  designConstraint: string;
};

function readDiagnosticPainPointsArray(
  matrix: Record<string, unknown> | null,
  rootObj: Record<string, unknown> | null,
): unknown[] {
  let rawList: unknown =
    matrix &&
    (matrix.Diagnostic_Pain_Points ??
      matrix.diagnostic_pain_points ??
      getPropertyCI(matrix, 'Diagnostic_Pain_Points', 'diagnostic_pain_points'));
  if (!Array.isArray(rawList) && rootObj) {
    rawList =
      rootObj.Diagnostic_Pain_Points ??
      rootObj.diagnostic_pain_points ??
      getPropertyCI(rootObj, 'Diagnostic_Pain_Points', 'diagnostic_pain_points');
  }
  return Array.isArray(rawList) ? rawList : [];
}

function parseSingleDiagnosticPainPoint(
  item: unknown,
  index: number,
): ParsedDiagnosticPainPoint | null {
  const rec = asRecord(item);
  if (!rec) return null;
  const conflictDescription = readCausalityTextField(
    rec,
    'Conflict_Description',
    'conflict_description',
    'Trigger_Features',
    'trigger_features',
  );
  const insightConfirmation = readCausalityTextField(
    rec,
    'Insight_Confirmation',
    'insight_confirmation',
    'Client_Confirmation_Status',
    'client_confirmation_status',
    'Evidence_From_Input3',
    'evidence_from_input3',
  );
  const rootCauseAnalysis = readCausalityTextField(
    rec,
    'Root_Cause_Analysis',
    'root_cause_analysis',
  );
  const designConstraint = readCausalityTextField(
    rec,
    'Design_Constraint',
    'design_constraint',
    'Design_Suggestion',
    'design_suggestion',
    'L4_Design_Recommendation',
    'l4_design_recommendation',
  );
  if (
    !conflictDescription &&
    !insightConfirmation &&
    !rootCauseAnalysis &&
    !designConstraint
  ) {
    return null;
  }
  const painPointId =
    readCausalityTextField(
      rec,
      'Conflict_ID',
      'conflict_id',
      'Pain_Point_ID',
      'pain_point_id',
      'Inconsistent_FeatureID',
      'inconsistent_featureid',
    ) || `dp_${index + 1}`;
  return {
    painPointId,
    conflictDescription,
    insightConfirmation,
    rootCauseAnalysis,
    designConstraint,
  };
}

/**
 * 从任务 2–5 推理 JSON 解析 **`Diagnostic_Pain_Points`** 数组（每项映射四列审计字段）。
 */
export function parseDiagnosticPainPointsFromInferenceRaw(
  inferenceRaw: string,
  matrixKind: InferenceCausalityMatrixKind,
): ParsedDiagnosticPainPoint[] {
  const raw = stripBom(String(inferenceRaw || '').trim());
  if (!raw.length) return [];
  const rootObj = readL1JsonRootRecord(raw) ?? readL2JsonRootRecord(raw);
  let matrix: Record<string, unknown> | null = null;
  switch (matrixKind) {
    case 'L1':
      matrix = readL1InferenceMatrixFromRaw(raw);
      break;
    case 'L2_BUSINESS':
      matrix = readL2InferenceMatrixFromRaw(raw);
      break;
    case 'L2_VALUE':
      matrix = readL2ValueInferenceMatrixFromRaw(raw);
      break;
    case 'L3':
      matrix = readTask5L3ProcessMatrixFromRaw(raw);
      break;
    default:
      matrix = null;
  }
  const rawList = readDiagnosticPainPointsArray(matrix, rootObj);
  const out: ParsedDiagnosticPainPoint[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const parsed = parseSingleDiagnosticPainPoint(rawList[i], i);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** 任务 7 L4：新契约仅 `协作节点`；历史数据仍兼容 `所属业务流程` */
export function isTask7L4CollaborationFeatureKey(featureKey: string): boolean {
  const k = String(featureKey || '').trim();
  return k === '所属业务流程' || k === '协作节点';
}

/** 任务 7 TVM：`Mapped_L4_Feature` / `Mapped_L3_Feature` 归一为 L4 落库键 */
export function normalizeTask7L4MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s === '所属业务流程' || s === '协作节点') return s;
  if (isTask7L4ItSelectionFeatureKey(s)) return s;
  return null;
}

const L4_COLLABORATION_MATRIX_KEY_PAIRS: Array<[string, string]> = [
  ['L4_Form_Layout_Matrix', 'l4_form_layout_matrix'],
  ['L4_Collaboration_Inference_Matrix', 'l4_collaboration_inference_matrix'],
];

function readL4CollaborationMatrixFromRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  for (const [k1, k2] of L4_COLLABORATION_MATRIX_KEY_PAIRS) {
    const direct = asRecord(getPropertyCI(root, k1, k2));
    if (direct) return direct;
  }
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    for (const [k1, k2] of L4_COLLABORATION_MATRIX_KEY_PAIRS) {
      const inner = asRecord(getPropertyCI(o, k1, k2));
      if (inner) return inner;
    }
  }
  const topKv = readTargetKvFromContainer(root);
  if (topKv?.length) return root;
  return null;
}

function readTask7L4CollaborationMatrixFromRaw(l4CollaborationInferenceRaw: string): Record<string, unknown> | null {
  const obj = readL2JsonRootRecord(l4CollaborationInferenceRaw);
  if (!obj) return null;
  return readL4CollaborationMatrixFromRoot(obj);
}

function task7L4TargetKvDedupKey(featureKey: string, featureValue: string): string {
  return `${String(featureKey || '').trim()}\t${String(featureValue || '').trim()}`;
}

function serializeTask7L4FeatureValueForSync(fvRaw: unknown): string {
  if (fvRaw === null || fvRaw === undefined) return '';
  if (typeof fvRaw === 'string') return fvRaw.trim();
  if (typeof fvRaw === 'object') {
    try {
      return JSON.stringify(fvRaw);
    } catch {
      return String(fvRaw).trim();
    }
  }
  return String(fvRaw).trim();
}

function task7CollaborationFeatureValueObject(row: Task2L1TargetKvSyncRow): Record<string, unknown> | null {
  const raw = row.featureValue;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s.startsWith('{')) return null;
    try {
      const parsed = JSON.parse(s) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function task7ReadNestedString(obj: Record<string, unknown>, ...keys: string[]): string {
  let cur: unknown = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return '';
    cur = (cur as Record<string, unknown>)[k];
  }
  return String(cur ?? '').trim();
}

/** 任务 7 落库：协作节点 JSON 展开为 5 类 IT 选型特征 + 保留协作节点聚合行 */
export const TASK7_IT_SELECTION_EXPAND_FEATURE_KEYS = [
  '交互工具选型',
  '存储工具选型',
  '集成行为选型',
  '技术判断',
  '业务价值预判',
] as const;

type Task7ItSelectionExpandSpec = {
  featureKey: (typeof TASK7_IT_SELECTION_EXPAND_FEATURE_KEYS)[number];
  pick: (fv: Record<string, unknown>) => string;
};

const TASK7_IT_SELECTION_EXPAND_SPECS: Task7ItSelectionExpandSpec[] = [
  {
    featureKey: '交互工具选型',
    pick: (fv) => task7ReadNestedString(fv, 'selected_it_tool_proposal', 'ui_layout_interface_tool'),
  },
  {
    featureKey: '存储工具选型',
    pick: (fv) => task7ReadNestedString(fv, 'selected_it_tool_proposal', 'data_schema_storage_base'),
  },
  {
    featureKey: '集成行为选型',
    pick: (fv) => task7ReadNestedString(fv, 'selected_it_tool_proposal', 'integration_behavior_hook'),
  },
  {
    featureKey: '技术判断',
    pick: (fv) => task7ReadNestedString(fv, 'technical_selection_rationale'),
  },
  {
    featureKey: '业务价值预判',
    pick: (fv) => task7ReadNestedString(fv, 'achieved_business_impact'),
  },
];

export function isTask7L4ItSelectionFeatureKey(featureKey: string): boolean {
  const k = String(featureKey || '').trim();
  return (TASK7_IT_SELECTION_EXPAND_FEATURE_KEYS as readonly string[]).includes(k);
}

function task7EvidenceLinksForExpandedRow(
  row: Task2L1TargetKvSyncRow,
): Task2L1EvidenceLinkPlan[] | undefined {
  if (!row.evidenceLinks?.length) return undefined;
  const w =
    typeof row.inferenceWeight === 'number' && Number.isFinite(row.inferenceWeight)
      ? Math.min(1, Math.max(0, row.inferenceWeight))
      : undefined;
  const logic = String(row.inferenceSummary ?? '').trim();
  return row.evidenceLinks.map((L) => ({
    ...L,
    ...(w !== undefined ? { weight: w } : {}),
    ...(logic ? { logic } : {}),
  }));
}

/** 将模型输出的「协作节点」行展开为 5 条 IT 选型特征 + 保留原协作节点聚合 JSON 行 */
export function expandTask7L4CollaborationRowsToItSelectionFeatures(
  rows: readonly Task2L1TargetKvSyncRow[],
): Task2L1TargetKvSyncRow[] {
  const out: Task2L1TargetKvSyncRow[] = [];
  for (const row of rows) {
    if (row.featureKey !== '协作节点') {
      out.push(row);
      continue;
    }
    const fvObj = task7CollaborationFeatureValueObject(row);
    if (!fvObj) {
      out.push(row);
      continue;
    }
    out.push(row);
    const evidenceCopy = task7EvidenceLinksForExpandedRow(row);
    for (const spec of TASK7_IT_SELECTION_EXPAND_SPECS) {
      const val = spec.pick(fvObj);
      if (!val) continue;
      out.push({
        ...row,
        featureKey: spec.featureKey,
        featureValue: val,
        ...(evidenceCopy ? { evidenceLinks: evidenceCopy.map((L) => ({ ...L })) } : {}),
      });
    }
  }
  return out;
}

/** 任务 7 TVM：`Mapped_L3_Feature=协作节点` 对齐到本批已展开的 IT 选型特征键 */
export function expandTask7L4TokenValidationPlans(
  rows: readonly Task2L1TargetKvSyncRow[],
  tvPlans: readonly Task2L1TokenValidationLinkPlan[],
): Task2L1TokenValidationLinkPlan[] {
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const tv of tvPlans) {
    const mappedRaw = String(tv.mappedL1FeatureKey || '').trim();
    const mappedNorm = normalizeTask7L4MappedFeatureKey(mappedRaw) ?? mappedRaw;
    if (mappedNorm !== '协作节点') {
      out.push(tv);
      continue;
    }
    const targetId = String(tv.targetFeatureId || '').trim();
    const candidates = rows.filter(
      (r) =>
        isTask7L4ItSelectionFeatureKey(r.featureKey) &&
        (r.evidenceLinks ?? []).some((L) => String(L.sourceFeatureId || '').trim() === targetId),
    );
    const pick =
      candidates.find((r) => r.featureKey === '存储工具选型') ??
      candidates.find((r) => r.featureKey === '交互工具选型') ??
      candidates[0];
    if (!pick) {
      out.push(tv);
      continue;
    }
    out.push({ ...tv, mappedL1FeatureKey: pick.featureKey });
  }
  return out;
}

function resolveTask7L4FeatureKeyFromRow(rec: Record<string, unknown>): string | null {
  const key = featureKeyFromRow(rec);
  if (key && isTask7L4CollaborationFeatureKey(key)) return key;
  return null;
}

/** 任务 7：`所属业务流程` + `协作节点` Target_KV */
export function parseTask7L4CollaborationTargetKvSyncRows(
  l4CollaborationInferenceRaw: string,
): ParseTask2L1TargetKvRowsResult {
  const raw = stripBom(String(l4CollaborationInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 7 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask7L4CollaborationMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L4_Form_Layout_Matrix / L4_Collaboration_Inference_Matrix 或非空 Target_KV；请确认模型输出为任务 7 契约 JSON',
    };
  }
  const targetKv = readTargetKvFromContainer(matrix);
  const seen = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  let hasFlow = false;
  let hasNode = false;
  if (targetKv?.length) {
    for (const item of targetKv) {
      const rec = asRecord(item);
      if (!rec) continue;
      const key = resolveTask7L4FeatureKeyFromRow(rec) ?? featureKeyFromRow(rec);
      if (!key || !isTask7L4CollaborationFeatureKey(key)) continue;
      const operator = operatorFromRow(rec);
      const featureValue = serializeTask7L4FeatureValueForSync(featureValueFromRow(rec));
      const vrd = valueRefDomainFromRow(rec);
      const inf = inferenceSummaryFromRow(rec);
      const evidence = evidenceSourceFromRow(rec);
      const logicRule = logicRuleFromRow(rec);
      const inferenceWeight = inferenceWeightFromRow(rec);
      const validationStatus = validationStatusFromRow(rec);
      const dedup = task7L4TargetKvDedupKey(key, featureValue);
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      const chainRaw = readEvidenceSupportChainRaw(rec);
      const evidenceLinks = parseEvidenceSupportChainFromTargetKvRow(rec);
      if (
        !Array.isArray(chainRaw) ||
        chainRaw.length === 0 ||
        evidenceLinks.length === 0
      ) {
        return {
          ok: false,
          message: `Target_KV 行「${featureValue || key}」的 Evidence_Support_Chain 为空；任务 7 契约要求证据链绝对完备`,
        };
      }
      rows.push({
        featureKey: key,
        operator,
        featureValue,
        valueRefDomain: vrd,
        inferenceSummary: inf,
        evidenceSource: evidence,
        logicRule,
        inferenceWeight,
        ...(validationStatus ? { validationStatus } : {}),
        ...(evidenceLinks.length > 0 ? { evidenceLinks } : {}),
      });
      if (key === '所属业务流程') hasFlow = true;
      if (key === '协作节点') hasNode = true;
    }
  }
  if (rows.length === 0 || !hasNode) {
    return {
      ok: false,
      message:
        '未解析到 L4 协作节点（须含 Feature_Key=「协作节点」至少 1 条）；请按 L4_Form_Layout_Matrix 契约输出',
    };
  }
  const expanded = expandTask7L4CollaborationRowsToItSelectionFeatures(rows);
  const hasStructuredCollaboration = rows.some(
    (r) => r.featureKey === '协作节点' && task7CollaborationFeatureValueObject(r) !== null,
  );
  if (hasStructuredCollaboration) {
    const hasItSelection = expanded.some((r) => isTask7L4ItSelectionFeatureKey(r.featureKey));
    if (!hasItSelection) {
      return {
        ok: false,
        message:
          '未解析到可落库的 IT 选型特征（协作节点 Feature_Value 须含 selected_it_tool_proposal 等结构化字段）',
      };
    }
  }
  return { ok: true, rows: expanded };
}

/** 任务 5.1 层内正向归纳边（价值主张 → 业务能力单元） */
export type Task51IntraVpForwardLinkInsert = {
  sourceFeatureId: string;
  targetFeatureId: string;
  logic: string;
  weight: number;
};

/**
 * 任务 5.1 落库：为每个业务能力单元合成「核心价值主张 / 交付模式定性 → 业务能力单元」正向归纳边。
 */
export function buildTask51IntraValuePropositionForwardLinks(
  rows: ReadonlyArray<{
    featureKey: string;
    featureValue?: unknown;
    inferenceWeight?: number;
    causalitySummary?: string;
  }>,
  targetFeatureIds: readonly string[],
): Task51IntraVpForwardLinkInsert[] {
  let coreVpId = '';
  let deliveryVpId = '';
  const caps: Array<{
    featureId: string;
    value: string;
    weight: number;
    causality: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const fid = String(targetFeatureIds[i] ?? '').trim();
    if (!fid) continue;
    const value = task7SyncRowFeatureValueLabel(row.featureValue);
    if (row.featureKey === '核心价值主张') {
      coreVpId = fid;
    } else if (row.featureKey === '交付模式定性') {
      deliveryVpId = fid;
    } else if (row.featureKey === '业务能力单元') {
      const weight =
        typeof row.inferenceWeight === 'number' && Number.isFinite(row.inferenceWeight)
          ? Math.min(1, Math.max(0, row.inferenceWeight))
          : 0.85;
      const causality = String(row.causalitySummary ?? '').trim();
      caps.push({ featureId: fid, value, weight, causality });
    }
  }

  if (!caps.length) return [];

  const vpSources: Array<{ id: string; label: string; delivery: boolean }> = [];
  if (coreVpId) vpSources.push({ id: coreVpId, label: '核心价值主张', delivery: false });
  if (deliveryVpId) vpSources.push({ id: deliveryVpId, label: '交付模式定性', delivery: true });
  if (!vpSources.length) return [];

  const out: Task51IntraVpForwardLinkInsert[] = [];
  const seen = new Set<string>();

  for (const cap of caps) {
    const capLabel = cap.value || '业务能力单元';
    for (const vp of vpSources) {
      const pairKey = `${vp.id}\t${cap.featureId}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      let logic: string;
      if (!vp.delivery && cap.causality) {
        logic = cap.causality;
      } else if (vp.delivery) {
        logic = `正向归纳：交付模式定性向业务能力单元「${capLabel}」补充传导（交付模式与能力单元对齐）`;
      } else {
        logic = `正向归纳：核心价值主张向业务能力单元「${capLabel}」传导（主张→能力权重穿透）`;
      }
      const weight = vp.delivery ? Math.min(0.75, cap.weight) : cap.weight;
      out.push({
        sourceFeatureId: vp.id,
        targetFeatureId: cap.featureId,
        logic,
        weight,
      });
    }
  }

  return out;
}

export type Task52CapabilityUnitRef = {
  featureId: string;
  label: string;
};

export type Task52CapToFieldSetForwardLinkInsert = {
  sourceFeatureId: string;
  targetFeatureId: string;
  logic: string;
  weight: number;
};

function resolveTask52CapabilityUnitFeatureId(
  associatedUnit: string,
  capabilityUnits: readonly Task52CapabilityUnitRef[],
): string | null {
  const needle = String(associatedUnit || '').trim();
  if (!needle || !capabilityUnits.length) return null;
  for (const cap of capabilityUnits) {
    const label = String(cap.label || '').trim();
    if (label && label === needle) return cap.featureId;
  }
  for (const cap of capabilityUnits) {
    const label = String(cap.label || '').trim();
    if (!label) continue;
    if (needle.includes(label) || label.includes(needle)) return cap.featureId;
  }
  return null;
}

/**
 * 任务 5.2 落库：为每个业务能力字段集合成「业务能力单元（任务 5.1）→ 业务能力字段集」正向归纳边。
 */
export function buildTask52CapabilityUnitToFieldSetForwardLinks(
  rows: ReadonlyArray<{
    associatedCapabilityUnit?: string;
    causalitySummary?: string;
    inferenceWeight?: number;
  }>,
  targetFeatureIds: readonly string[],
  capabilityUnits: readonly Task52CapabilityUnitRef[],
): Task52CapToFieldSetForwardLinkInsert[] {
  const out: Task52CapToFieldSetForwardLinkInsert[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const tgt = String(targetFeatureIds[i] ?? '').trim();
    if (!tgt) continue;
    const acu = String(row.associatedCapabilityUnit ?? '').trim();
    const src = resolveTask52CapabilityUnitFeatureId(acu, capabilityUnits);
    if (!src || src === tgt) continue;
    const pairKey = `${src}\t${tgt}`;
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    const weight =
      typeof row.inferenceWeight === 'number' && Number.isFinite(row.inferenceWeight)
        ? Math.min(1, Math.max(0, row.inferenceWeight))
        : 0.85;
    const causality = String(row.causalitySummary ?? '').trim();
    const logic =
      causality ||
      `正向归纳：业务能力单元「${acu || '（未命名）'}」→ 业务能力字段集（职能切片权重穿透）`;
    out.push({
      sourceFeatureId: src,
      targetFeatureId: tgt,
      logic,
      weight,
    });
  }
  return out;
}

/** 任务 7 流程内正向归纳边（所属业务流程 → 协作节点），由落库侧按证据链同源关系合成 */
export type Task7IntraFlowForwardLinkInsert = {
  sourceFeatureId: string;
  targetFeatureId: string;
  logic: string;
  weight: number;
};

export function task7SyncRowFeatureValueLabel(featureValue: unknown): string {
  if (featureValue === null || featureValue === undefined) return '';
  if (typeof featureValue === 'string') {
    const s = featureValue.trim();
    if (s.startsWith('{')) {
      try {
        const parsed = JSON.parse(s) as Record<string, unknown>;
        const step = String(
          parsed.current_process_step_name ?? parsed.Current_Process_Step_Name ?? '',
        ).trim();
        if (step) return step;
      } catch {
        /* legacy string */
      }
    }
    return s;
  }
  if (typeof featureValue === 'object' && !Array.isArray(featureValue)) {
    const rec = featureValue as Record<string, unknown>;
    const step = String(
      rec.current_process_step_name ??
        rec.Current_Process_Step_Name ??
        getPropertyCI(rec, 'current_process_step_name', 'Current_Process_Step_Name') ??
        '',
    ).trim();
    if (step) return step;
    const inner =
      rec.Feature_Value ??
      rec.feature_value ??
      getPropertyCI(rec, 'Feature_Value', 'feature_value');
    if (inner !== undefined && inner !== null) return String(inner).trim();
  }
  return String(featureValue).trim();
}

function evidenceSourceIdSetFromRow(
  evidenceLinks: ReadonlyArray<Task2L1EvidenceLinkPlan> | undefined,
): Set<string> {
  const out = new Set<string>();
  for (const L of evidenceLinks ?? []) {
    const id = String(L.sourceFeatureId || '').trim();
    if (id) out.add(id);
  }
  return out;
}

function evidenceScenarioOverlapCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const id of a) {
    if (b.has(id)) n += 1;
  }
  return n;
}

/**
 * 任务 7 落库：为同一流程（Evidence 同源关键场景）下每条协作节点合成
 * 「所属业务流程 → 协作节点」正向归纳边（模型 Evidence 通常仅指向上游任务 6）。
 */
export function buildTask7IntraFlowForwardLinks(
  rows: ReadonlyArray<{
    featureKey: string;
    featureValue?: unknown;
    inferenceWeight?: number;
    evidenceLinks?: ReadonlyArray<Task2L1EvidenceLinkPlan>;
  }>,
  targetFeatureIds: readonly string[],
): Task7IntraFlowForwardLinkInsert[] {
  const flows: Array<{
    featureId: string;
    evidenceIds: Set<string>;
    value: string;
  }> = [];
  const ops: Array<{
    featureId: string;
    evidenceIds: Set<string>;
    value: string;
    weight: number;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const fid = String(targetFeatureIds[i] ?? '').trim();
    if (!fid) continue;
    const evidenceIds = evidenceSourceIdSetFromRow(row.evidenceLinks);
    const value = task7SyncRowFeatureValueLabel(row.featureValue);
    const weight =
      typeof row.inferenceWeight === 'number' && Number.isFinite(row.inferenceWeight)
        ? Math.min(1, Math.max(0, row.inferenceWeight))
        : 0.85;
    if (row.featureKey === '所属业务流程') {
      flows.push({ featureId: fid, evidenceIds, value });
    } else if (row.featureKey === '协作节点') {
      ops.push({ featureId: fid, evidenceIds, value, weight });
    }
  }

  if (!flows.length || !ops.length) return [];

  const out: Task7IntraFlowForwardLinkInsert[] = [];
  const seen = new Set<string>();

  for (const op of ops) {
    let candidates = flows.filter((f) => evidenceScenarioOverlapCount(f.evidenceIds, op.evidenceIds) > 0);
    if (!candidates.length && flows.length === 1) candidates = [...flows];
    if (!candidates.length) continue;

    const flow =
      candidates.length === 1
        ? candidates[0]!
        : candidates.reduce((best, cur) =>
            evidenceScenarioOverlapCount(cur.evidenceIds, op.evidenceIds) >
            evidenceScenarioOverlapCount(best.evidenceIds, op.evidenceIds)
              ? cur
              : best,
          );

    const pairKey = `${flow.featureId}\t${op.featureId}`;
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    const flowLabel = flow.value || '所属业务流程';
    const opLabel = op.value || '协作节点';
    out.push({
      sourceFeatureId: flow.featureId,
      targetFeatureId: op.featureId,
      logic: `正向归纳：所属业务流程「${flowLabel}」向本流程内协作节点「${opLabel}」传导（流程内二级协作承载）`,
      weight: op.weight,
    });
  }

  return out;
}

/** 从任务 7 L4 原始 JSON 解析 Token_Validation_Mapping（契约常为 `[]`） */
export function parseTokenValidationMappingFromL7CollaborationInferenceRaw(
  l4CollaborationInferenceRaw: string,
): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL2JsonRootRecord(l4CollaborationInferenceRaw);
  const m = readTask7L4CollaborationMatrixFromRaw(l4CollaborationInferenceRaw);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList) && rootObj) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedKey = normalizeTask7L4MappedFeatureKey(
      rec.Mapped_L4_Feature ??
        rec.mapped_l4_feature ??
        getPropertyCI(rec, 'Mapped_L4_Feature', 'mapped_l4_feature') ??
        rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature'),
    );
    if (!mappedKey) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey: mappedKey,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  return out;
}

/**
 * 将任务 7 模型原文规范为可落库的 JSON 字符串（须含 `L4_Collaboration_Inference_Matrix` 与非空 Target_KV）。
 */
export function normalizeL4CollaborationInferenceRawForServerSync(
  l4CollaborationInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l4CollaborationInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 7 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask7L4CollaborationMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message: '未找到 L4_Form_Layout_Matrix / L4_Collaboration_Inference_Matrix 或非空 Target_KV',
    };
  }
  const tkInMatrix = readTargetKvFromContainer(matrix);
  if (!tkInMatrix?.length) {
    return { ok: false, message: 'L4_Form_Layout_Matrix 内 Target_KV 为空' };
  }
  const hasL4Matrix =
    !!asRecord(getPropertyCI(obj, 'L4_Form_Layout_Matrix', 'l4_form_layout_matrix')) ||
    !!asRecord(
      getPropertyCI(obj, 'L4_Collaboration_Inference_Matrix', 'l4_collaboration_inference_matrix'),
    );
  const payload = hasL4Matrix
    ? obj
    : asRecord(getPropertyCI(matrix, 'L4_Form_Layout_Matrix', 'l4_form_layout_matrix'))
      ? { L4_Form_Layout_Matrix: matrix }
      : { L4_Collaboration_Inference_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/** 任务 8 L4.5：`操作角色` / `单据对象` / `状态转移矩阵`（仅三种规范键，可同名多行） */
export function isTask8L45PrototypeFeatureKey(featureKey: string): boolean {
  const k = String(featureKey || '').trim();
  return k === '操作角色' || k === '单据对象' || k === '状态转移矩阵';
}

const L4_PROTOTYPE_MATRIX_KEY_PAIRS: Array<[string, string]> = [
  ['L4_5_Prototype_Detail_Matrix', 'l4_5_prototype_detail_matrix'],
  ['L4_Prototype_Inference_Matrix', 'l4_prototype_inference_matrix'],
];

function readL4PrototypeMatrixFromRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  for (const [k1, k2] of L4_PROTOTYPE_MATRIX_KEY_PAIRS) {
    const direct = asRecord(getPropertyCI(root, k1, k2));
    if (direct) return direct;
  }
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    for (const [k1, k2] of L4_PROTOTYPE_MATRIX_KEY_PAIRS) {
      const inner = asRecord(getPropertyCI(o, k1, k2));
      if (inner) return inner;
    }
  }
  const topKv = readTargetKvFromContainer(root);
  if (topKv?.length) return root;
  return null;
}

function readTask8L45PrototypeMatrixFromRaw(l4PrototypeInferenceRaw: string): Record<string, unknown> | null {
  const obj = readL2JsonRootRecord(l4PrototypeInferenceRaw);
  if (!obj) return null;
  return readL4PrototypeMatrixFromRoot(obj);
}

function task8L45TargetKvDedupKey(featureKey: string, featureValue: string): string {
  return `${String(featureKey || '').trim()}\t${String(featureValue || '').trim()}`;
}

function resolveTask8L45FeatureKeyFromRow(rec: Record<string, unknown>): string | null {
  const key = featureKeyFromRow(rec);
  if (key && isTask8L45PrototypeFeatureKey(key)) return key;
  return null;
}

/** 任务 8：角色 / 单据对象 / 状态转移矩阵 Target_KV */
export function parseTask8L45PrototypeTargetKvSyncRows(
  l4PrototypeInferenceRaw: string,
): ParseTask2L1TargetKvRowsResult {
  const raw = stripBom(String(l4PrototypeInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 8 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask8L45PrototypeMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L4_5_Prototype_Detail_Matrix / L4_Prototype_Inference_Matrix 或非空 Target_KV；请确认模型输出为任务 8 契约 JSON',
    };
  }
  const targetKv = readTargetKvFromContainer(matrix);
  const seen = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  let hasRole = false;
  let hasObject = false;
  if (targetKv?.length) {
    for (const item of targetKv) {
      const rec = asRecord(item);
      if (!rec) continue;
      const key = resolveTask8L45FeatureKeyFromRow(rec) ?? featureKeyFromRow(rec);
      if (!key || !isTask8L45PrototypeFeatureKey(key)) continue;
      const operator = operatorFromRow(rec);
      const featureValue = String(featureValueFromRow(rec) ?? '').trim();
      const vrd = valueRefDomainFromRow(rec);
      const inf = inferenceSummaryFromRow(rec);
      const evidence = evidenceSourceFromRow(rec);
      const logicRule = logicRuleFromRow(rec);
      const inferenceWeight = inferenceWeightFromRow(rec);
      const validationStatus = validationStatusFromRow(rec);
      const dedup = task8L45TargetKvDedupKey(key, featureValue);
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      const chainRaw = readEvidenceSupportChainRaw(rec);
      const evidenceLinks = parseEvidenceSupportChainFromTargetKvRow(rec);
      if (!Array.isArray(chainRaw) || chainRaw.length === 0 || evidenceLinks.length === 0) {
        return {
          ok: false,
          message: `Target_KV 行「${featureValue || key}」的 Evidence_Support_Chain 为空；任务 8 契约要求证据链绝对完备`,
        };
      }
      rows.push({
        featureKey: key,
        operator,
        featureValue,
        valueRefDomain: vrd,
        inferenceSummary: inf,
        evidenceSource: evidence,
        logicRule,
        inferenceWeight,
        ...(validationStatus ? { validationStatus } : {}),
        ...(evidenceLinks.length > 0 ? { evidenceLinks } : {}),
      });
      if (key === '操作角色') hasRole = true;
      if (key === '单据对象') hasObject = true;
    }
  }
  if (rows.length === 0 || !hasRole || !hasObject) {
    return {
      ok: false,
      message:
        '未解析到 L4.5 原型特征（须含 Feature_Key=「操作角色」「单据对象」各至少 1 条；「状态转移矩阵」按节点可选，静默留痕节点可省略）；请按 L4_5_Prototype_Detail_Matrix 契约输出',
    };
  }
  return { ok: true, rows };
}

/** 任务 8 TVM：`Mapped_L3/L4_Feature` 归一为 L4.5 落库键 */
export function normalizeTask8L45MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (isTask8L45PrototypeFeatureKey(s)) return s;
  return null;
}

/** 从任务 8 L4.5 原始 JSON 解析 Token_Validation_Mapping */
export function parseTokenValidationMappingFromL8PrototypeInferenceRaw(
  l4PrototypeInferenceRaw: string,
): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL2JsonRootRecord(l4PrototypeInferenceRaw);
  const m = readTask8L45PrototypeMatrixFromRaw(l4PrototypeInferenceRaw);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList) && rootObj) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedKey = normalizeTask8L45MappedFeatureKey(
      rec.Mapped_L4_Feature ??
        rec.mapped_l4_feature ??
        getPropertyCI(rec, 'Mapped_L4_Feature', 'mapped_l4_feature') ??
        rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature'),
    );
    if (!mappedKey) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey: mappedKey,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  return out;
}

/**
 * 将任务 8 模型原文规范为可落库的 JSON 字符串（须含 `L4_5_Prototype_Detail_Matrix` 或兼容 `L4_Prototype_Inference_Matrix` 与非空 Target_KV）。
 */
export function normalizeL4PrototypeInferenceRawForServerSync(
  l4PrototypeInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l4PrototypeInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) return { ok: false, message: 'JSON 解析失败' };
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask8L45PrototypeMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message: '未找到 L4_5_Prototype_Detail_Matrix / L4_Prototype_Inference_Matrix 或非空 Target_KV',
    };
  }
  const tkInMatrix = readTargetKvFromContainer(matrix);
  if (!tkInMatrix?.length) {
    return { ok: false, message: 'L4_5_Prototype_Detail_Matrix 内 Target_KV 为空' };
  }
  const hasL45 = !!asRecord(
    getPropertyCI(obj, 'L4_5_Prototype_Detail_Matrix', 'l4_5_prototype_detail_matrix'),
  );
  const hasLegacy = !!asRecord(
    getPropertyCI(obj, 'L4_Prototype_Inference_Matrix', 'l4_prototype_inference_matrix'),
  );
  const payload = hasL45 || hasLegacy ? obj : { L4_5_Prototype_Detail_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/** 任务 8.5：Feature_Key 规范化（兼容模型在中间夹空白、NFKC） */
export function canonicalizeTask85L475PhysicalHookFeatureKey(featureKey: string): string | null {
  let k = stripBom(String(featureKey ?? '').trim());
  try {
    k = k.normalize('NFKC');
  } catch {
    /* ignore */
  }
  k = k.replace(/\s+/g, '');
  /** 与白名单逐项比对（等价类：去空白后的字符串） */
  const candidates: readonly string[] = [
    '界面交互层',
    '数据承载层',
    '衔接互动层',
    '技术组件映射',
    '自动化流Hook',
    '前端交互载体',
    '物理外挂Hook',
    '微观连接器绑定',
    '工具方案裁决',
  ];
  for (const c of candidates) {
    const cn = stripBom(String(c).trim())
      .normalize('NFKC')
      .replace(/\s+/g, '');
    if (cn === k) return c;
  }
  return null;
}

/** 任务 8.5 L4.7：规范三键「界面交互层」「数据承载层」「衔接互动层」；兼容历史「技术组件映射」「自动化流Hook」「前端交互载体」及 L4.75 旧键 */
export function isTask85L475PhysicalHookFeatureKey(featureKey: string): boolean {
  return canonicalizeTask85L475PhysicalHookFeatureKey(featureKey) != null;
}

const L475_PHYSICAL_HOOK_MATRIX_KEY_PAIRS: Array<[string, string]> = [
  ['L4_7_Tech_Integration_Matrix', 'l4_7_tech_integration_matrix'],
  ['L4_75_Physical_Hook_Integration_Matrix', 'l4_75_physical_hook_integration_matrix'],
];

function readL475PhysicalHookMatrixFromRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  for (const [k1, k2] of L475_PHYSICAL_HOOK_MATRIX_KEY_PAIRS) {
    const direct = asRecord(getPropertyCI(root, k1, k2));
    if (direct) return direct;
  }
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    for (const [k1, k2] of L475_PHYSICAL_HOOK_MATRIX_KEY_PAIRS) {
      const inner = asRecord(getPropertyCI(o, k1, k2));
      if (inner) return inner;
    }
  }
  const topKv = readTargetKvFromContainer(root);
  if (topKv?.length) return root;
  return null;
}

function readTask85L475PhysicalHookMatrixFromRaw(l475PhysicalHookInferenceRaw: string): Record<string, unknown> | null {
  const obj = readL2JsonRootRecord(l475PhysicalHookInferenceRaw);
  if (!obj) return null;
  return readL475PhysicalHookMatrixFromRoot(obj);
}

function task85L475TargetKvDedupKey(featureKey: string, featureValue: string): string {
  return `${String(featureKey || '').trim()}\t${String(featureValue || '').trim()}`;
}

function resolveTask85L475FeatureKeyFromRow(rec: Record<string, unknown>): string | null {
  const key = featureKeyFromRow(rec);
  return key ? canonicalizeTask85L475PhysicalHookFeatureKey(key) : null;
}

/**
 * 兼容模型把 Target_KV 行写成单层 JSON 字符串（而非对象）的常见输出。
 */
function expandTask85TargetKvMaybeStringifiedRows(rows: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const item of rows) {
    if (typeof item === 'string') {
      const t = stripBom(item.trim());
      if (!t.length) continue;
      const parsed = tryParseJsonRoot(t);
      if (parsed === null) {
        continue;
      }
      if (Array.isArray(parsed)) {
        for (const x of parsed) out.push(x);
        continue;
      }
      const rec = asRecord(parsed);
      if (rec) {
        out.push(rec);
        continue;
      }
      continue;
    }
    out.push(item);
  }
  return out;
}

function finalizeTask85TargetKvRows(rows: unknown[] | null): unknown[] | null {
  if (!rows?.length) return null;
  const expanded = expandTask85TargetKvMaybeStringifiedRows(rows);
  return expanded.length ? expanded : null;
}

/** 兼容模型将层级名误写为矩阵的直接子键（而未使用 Target_KV 数组）的常见畸形 JSON */
function readTask85L475TargetKvFromMatrix(matrix: Record<string, unknown>): unknown[] | null {
  const direct = readTargetKvFromContainer(matrix);
  const directDone = finalizeTask85TargetKvRows(direct?.length ? direct : null);
  if (directDone?.length) return directDone;

  const synthesized: unknown[] = [];
  const fallbackOrder: readonly string[] = [
    '界面交互层',
    '数据承载层',
    '衔接互动层',
    '技术组件映射',
    '自动化流Hook',
    '前端交互载体',
    '物理外挂Hook',
    '微观连接器绑定',
    '工具方案裁决',
  ];

  for (const lk of fallbackOrder) {
    const rawProp =
      (matrix as Record<string, unknown>)[lk] ?? getPropertyCI(matrix as Record<string, unknown>, lk);
    if (rawProp == null || rawProp === undefined) continue;

    if (typeof rawProp === 'string') {
      const parsedRoot = tryParseJsonRoot(stripBom(String(rawProp).trim()));
      const parsedRec = parsedRoot !== null ? asRecord(parsedRoot) : null;
      if (parsedRec) {
        const inner = featureKeyFromRow(parsedRec);
        const canonInner = inner !== null ? canonicalizeTask85L475PhysicalHookFeatureKey(inner) : null;
        const fk = canonInner ?? lk;
        synthesized.push({ ...parsedRec, Feature_Key: fk });
      }
      continue;
    }

    if (Array.isArray(rawProp)) {
      for (const el of rawProp) {
        const r =
          typeof el === 'string'
            ? asRecord(tryParseJsonRoot(stripBom(String(el).trim())) ?? null)
            : asRecord(el);
        if (!r) continue;
        const inner = featureKeyFromRow(r);
        const canonInner = inner !== null ? canonicalizeTask85L475PhysicalHookFeatureKey(inner) : null;
        const fk = canonInner ?? lk;
        synthesized.push({ ...r, Feature_Key: fk });
      }
      continue;
    }

    const r = asRecord(rawProp);
    if (!r) continue;
    const inner = featureKeyFromRow(r);
    const canonInner = inner !== null ? canonicalizeTask85L475PhysicalHookFeatureKey(inner) : null;
    const fk = canonInner ?? lk;
    synthesized.push({ ...r, Feature_Key: fk });
  }

  return finalizeTask85TargetKvRows(synthesized.length ? synthesized : null);
}

/** 任务 8.5：物理外挂 Hook / 微观连接器绑定 / 工具方案裁决 Target_KV */
export function parseTask85L475PhysicalHookTargetKvSyncRows(
  l475PhysicalHookInferenceRaw: string,
): ParseTask2L1TargetKvRowsResult {
  const raw = stripBom(String(l475PhysicalHookInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 8.5 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask85L475PhysicalHookMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L4_7_Tech_Integration_Matrix / L4_75_Physical_Hook_Integration_Matrix 或非空 Target_KV；请确认模型输出为任务 8.5 契约 JSON',
    };
  }
  const targetKv = readTask85L475TargetKvFromMatrix(matrix);
  const seen = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  if (targetKv?.length) {
    for (const item of targetKv) {
      const rec = asRecord(item);
      if (!rec) continue;
      const key = resolveTask85L475FeatureKeyFromRow(rec);
      if (!key) continue;
      const operator = operatorFromRow(rec);
      const featureValue = String(featureValueFromRow(rec) ?? '').trim();
      const vrd = valueRefDomainFromRow(rec);
      const inf = inferenceSummaryFromRow(rec);
      const evidence = evidenceSourceFromRow(rec);
      const logicRule = logicRuleFromRow(rec);
      const inferenceWeight = inferenceWeightFromRow(rec);
      const validationStatus = validationStatusFromRow(rec);
      const dedup = task85L475TargetKvDedupKey(key, featureValue);
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      const chainRaw = readEvidenceSupportChainRaw(rec);
      const evidenceLinks = parseEvidenceSupportChainFromTargetKvRow(rec);
      if (!Array.isArray(chainRaw) || chainRaw.length === 0 || evidenceLinks.length === 0) {
        return {
          ok: false,
          message: `Target_KV 行「${featureValue || key}」的 Evidence_Support_Chain 为空；任务 8.5 契约要求证据链绝对完备`,
        };
      }
      if (evidenceLinks.length < 2) {
        return {
          ok: false,
          message: `Target_KV 行「${featureValue || key}」的 Evidence_Support_Chain 须同时包含任务 8 与任务 0 双源 FeatureID（至少 2 条）`,
        };
      }
      rows.push({
        featureKey: key,
        operator,
        featureValue,
        valueRefDomain: vrd,
        inferenceSummary: inf,
        evidenceSource: evidence,
        logicRule,
        inferenceWeight,
        ...(validationStatus ? { validationStatus } : {}),
        ...(evidenceLinks.length > 0 ? { evidenceLinks } : {}),
      });
    }
  }
  if (rows.length === 0) {
    return {
      ok: false,
      message:
        '未解析到 L4.7 技术集成特征（须含 Feature_Key=「界面交互层」「数据承载层」「衔接互动层」或兼容历史「技术组件映射」「自动化流Hook」「前端交互载体」之一；Evidence_Support_Chain 须双源）；请按 L4_7_Tech_Integration_Matrix 契约输出。若模型已使用新三键仍失败，请先确认线上 backend 已重新 build 并重启（旧构建白名单不含新三键会误拒全部行）。',
    };
  }
  return { ok: true, rows };
}

/** 任务 8.5 TVM：`Mapped_L3/L4_Feature` 归一为 L4.7 落库键（含历史兼容键） */
export function normalizeTask85L475MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  return canonicalizeTask85L475PhysicalHookFeatureKey(s);
}

/** 从任务 8.5 L4.7 原始 JSON 解析 Token_Validation_Mapping */
export function parseTokenValidationMappingFromL85PhysicalHookInferenceRaw(
  l475PhysicalHookInferenceRaw: string,
): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL2JsonRootRecord(l475PhysicalHookInferenceRaw);
  const m = readTask85L475PhysicalHookMatrixFromRaw(l475PhysicalHookInferenceRaw);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList) && rootObj) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedKey = normalizeTask85L475MappedFeatureKey(
      rec.Mapped_L4_Feature ??
        rec.mapped_l4_feature ??
        getPropertyCI(rec, 'Mapped_L4_Feature', 'mapped_l4_feature') ??
        rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature'),
    );
    if (!mappedKey) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey: mappedKey,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  return out;
}

/**
 * 将任务 8.5 模型原文规范为可落库的 JSON 字符串（须含 `L4_75_Physical_Hook_Integration_Matrix` 与非空 Target_KV）。
 */
export function normalizeL475PhysicalHookInferenceRawForServerSync(
  l475PhysicalHookInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l475PhysicalHookInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) return { ok: false, message: 'JSON 解析失败' };
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask85L475PhysicalHookMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message: '未找到 L4_7_Tech_Integration_Matrix / L4_75_Physical_Hook_Integration_Matrix 或非空 Target_KV',
    };
  }
  const targetKvRows = readTask85L475TargetKvFromMatrix(matrix);
  if (!targetKvRows?.length) {
    return {
      ok: false,
      message:
        '未找到可解析的 Target_KV（须为数组且每行含契约 Feature_Key；若为误把三键写成矩阵子键，服务端将尝试自动合并为 Target_KV）',
    };
  }
  const mergedMatrix = { ...matrix, Target_KV: targetKvRows };
  const hasWrap =
    !!asRecord(getPropertyCI(obj, 'L4_7_Tech_Integration_Matrix', 'l4_7_tech_integration_matrix')) ||
    !!asRecord(
      getPropertyCI(obj, 'L4_75_Physical_Hook_Integration_Matrix', 'l4_75_physical_hook_integration_matrix'),
    );
  const useL47 = !!asRecord(
    getPropertyCI(obj, 'L4_7_Tech_Integration_Matrix', 'l4_7_tech_integration_matrix'),
  );
  const payload = hasWrap
    ? {
        ...obj,
        [useL47 ? 'L4_7_Tech_Integration_Matrix' : 'L4_75_Physical_Hook_Integration_Matrix']: mergedMatrix,
      }
    : { L4_7_Tech_Integration_Matrix: mergedMatrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/** 任务 8.5 落库失败时写入日志的结构化诊断（不暴露全文） */
export function buildTask85PhysicalHookParseFailureDiagnostics(
  l475PhysicalHookInferenceRaw: string,
): Record<string, unknown> {
  const raw = stripBom(String(l475PhysicalHookInferenceRaw || '').trim());
  const rootOnce = tryParseJsonRoot(raw);
  const diagnostics: Record<string, unknown> = {
    rawLengthChars: raw.length,
    jsonParseOk: rootOnce !== null,
  };
  if (rootOnce === null) return diagnostics;
  const obj = asRecord(peelJsonStringLayers(rootOnce, 6));
  diagnostics.hasObjectRoot = !!obj;
  if (!obj) return diagnostics;
  diagnostics.topLevelKeys = Object.keys(obj).slice(0, 32);
  const matrix = readTask85L475PhysicalHookMatrixFromRaw(raw);
  diagnostics.hasMatrix = !!matrix;
  if (!matrix) return diagnostics;
  const kv = readTask85L475TargetKvFromMatrix(matrix);
  diagnostics.targetKvRowCount = Array.isArray(kv) ? kv.length : 0;
  return diagnostics;
}

function belongsToPrimaryModuleFromRow(row: Record<string, unknown>): string | undefined {
  const v = getPropertyCI(
    row,
    'Belongs_To_Primary_Module',
    'belongs_to_primary_module',
    'Belongs To Primary Module',
  );
  if (v == null) return undefined;
  const t = String(v).trim();
  return t.length ? t : undefined;
}

/** 任务 9 模块内正向归纳边（系统一级模块 → 二级功能菜单） */
export type Task9IntraModuleMenuForwardLinkInsert = {
  sourceFeatureId: string;
  targetFeatureId: string;
  logic: string;
  weight: number;
};

function normalizeL5ModuleMenuLabel(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '');
}

function resolveModuleFidForMenuBelongs(
  belongs: string,
  modules: ReadonlyArray<{ featureId: string; name: string }>,
  moduleByName: Map<string, string>,
): string {
  const b = String(belongs || '').trim();
  if (!b) return '';
  const direct = moduleByName.get(b);
  if (direct) return direct;
  const bn = normalizeL5ModuleMenuLabel(b);
  if (!bn) return '';
  for (const m of modules) {
    if (normalizeL5ModuleMenuLabel(m.name) === bn) return m.featureId;
  }
  return '';
}

/**
 * 任务 9 落库：按 `Belongs_To_Primary_Module` 与模块/菜单同名对齐，合成一级模块 → 二级菜单正向归纳边。
 */
export function buildTask9IntraModuleMenuForwardLinks(
  rows: ReadonlyArray<{
    featureKey: string;
    featureValue?: unknown;
    belongsToPrimaryModule?: string;
    inferenceWeight?: number;
  }>,
  targetFeatureIds: readonly string[],
): Task9IntraModuleMenuForwardLinkInsert[] {
  const modules: Array<{ featureId: string; name: string }> = [];
  const menus: Array<{
    featureId: string;
    name: string;
    belongs: string;
    weight: number;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const fid = String(targetFeatureIds[i] ?? '').trim();
    if (!fid) continue;
    const name = task7SyncRowFeatureValueLabel(row.featureValue);
    const weight =
      typeof row.inferenceWeight === 'number' && Number.isFinite(row.inferenceWeight)
        ? Math.min(1, Math.max(0, row.inferenceWeight))
        : 0.9;
    if (row.featureKey === '系统一级模块') {
      modules.push({ featureId: fid, name });
    } else if (row.featureKey === '二级功能菜单') {
      menus.push({
        featureId: fid,
        name,
        belongs: String(row.belongsToPrimaryModule ?? '').trim(),
        weight,
      });
    }
  }

  if (!modules.length || !menus.length) return [];

  const moduleByName = new Map<string, string>();
  for (const m of modules) {
    moduleByName.set(m.name, m.featureId);
    const norm = normalizeL5ModuleMenuLabel(m.name);
    if (norm) moduleByName.set(norm, m.featureId);
  }
  const out: Task9IntraModuleMenuForwardLinkInsert[] = [];
  const seen = new Set<string>();

  for (const menu of menus) {
    let srcFid = resolveModuleFidForMenuBelongs(menu.belongs, modules, moduleByName);
    if (!srcFid && modules.length === 1) srcFid = modules[0]!.featureId;
    if (!srcFid && modules.length > 0) {
      /** 兜底：仅一个一级模块名与菜单 value 前缀相近时仍建父子边，避免树上图面完全缺失模块→菜单蓝线 */
      const hint = normalizeL5ModuleMenuLabel(menu.name);
      for (const m of modules) {
        const mn = normalizeL5ModuleMenuLabel(m.name);
        if (mn && hint.includes(mn)) {
          srcFid = m.featureId;
          break;
        }
      }
    }
    if (!srcFid) continue;
    const pair = `${srcFid}\t${menu.featureId}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    out.push({
      sourceFeatureId: srcFid,
      targetFeatureId: menu.featureId,
      logic: `一级模块→二级功能菜单（Belongs_To_Primary_Module=${menu.belongs || modules.find((m) => m.featureId === srcFid)?.name || '—'}；Inference_Weight=${menu.weight}）`,
      weight: menu.weight,
    });
  }

  return out;
}

/**
 * 任务 9 sync：将二级菜单证据链中「系统一级模块」横向线的模型 FeatureID 别名映射到本批真实落库 id。
 */
export function registerTask9SyncBatchEvidenceIdAliases(
  rows: ReadonlyArray<{
    featureKey: string;
    featureValue?: unknown;
    belongsToPrimaryModule?: string;
    evidenceLinks?: ReadonlyArray<Task2L1EvidenceLinkPlan>;
  }>,
  targetFeatureIds: readonly string[],
  aliasMap: Map<string, string>,
): void {
  const moduleByName = new Map<string, string>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const fid = String(targetFeatureIds[i] ?? '').trim();
    if (!fid) continue;
    aliasMap.set(fid, fid);
    if (row.featureKey !== '系统一级模块') continue;
    const nm = task7SyncRowFeatureValueLabel(row.featureValue);
    if (nm) moduleByName.set(nm, fid);
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.featureKey !== '二级功能菜单') continue;
    const belongs = String(row.belongsToPrimaryModule ?? '').trim();
    const moduleFid = moduleByName.get(belongs) ?? '';
    if (!moduleFid) continue;
    for (const L of row.evidenceLinks ?? []) {
      if (L.sourceTokenstr !== '系统一级模块') continue;
      const raw = String(L.sourceFeatureId || '').trim();
      if (raw) aliasMap.set(raw, moduleFid);
    }
  }
}

/** 任务 9 L5：`系统一级模块`（V4.1 宏观大伞；历史数据可能仍含 `二级功能菜单`） */
export function isTask9L5BlueprintFeatureKey(featureKey: string): boolean {
  const k = String(featureKey || '').trim();
  return k === '系统一级模块' || k === '二级功能菜单';
}

const L5_BLUEPRINT_MATRIX_KEY_PAIRS: Array<[string, string]> = [
  ['L5_Blueprint_Domain_Matrix', 'l5_blueprint_domain_matrix'],
  ['L5_Blueprint_Container_Matrix', 'l5_blueprint_container_matrix'],
];

function readL5BlueprintMatrixFromRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  for (const [k1, k2] of L5_BLUEPRINT_MATRIX_KEY_PAIRS) {
    const direct = asRecord(getPropertyCI(root, k1, k2));
    if (direct) return direct;
  }
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    for (const [k1, k2] of L5_BLUEPRINT_MATRIX_KEY_PAIRS) {
      const inner = asRecord(getPropertyCI(o, k1, k2));
      if (inner) return inner;
    }
  }
  const topKv = readTargetKvFromContainer(root);
  if (topKv?.length) return root;
  return null;
}

function readTask9L5BlueprintMatrixFromRaw(l5BlueprintInferenceRaw: string): Record<string, unknown> | null {
  const obj = readL2JsonRootRecord(l5BlueprintInferenceRaw);
  if (!obj) return null;
  return readL5BlueprintMatrixFromRoot(obj);
}

function task9L5TargetKvDedupKey(featureKey: string, featureValue: string): string {
  return `${String(featureKey || '').trim()}\t${String(featureValue || '').trim()}`;
}

function resolveTask9L5FeatureKeyFromRow(rec: Record<string, unknown>): string | null {
  const key = featureKeyFromRow(rec);
  if (key && isTask9L5BlueprintFeatureKey(key)) return key;
  return null;
}

/** 任务 9：系统一级模块 / 二级功能菜单 Target_KV */
export function parseTask9L5BlueprintTargetKvSyncRows(
  l5BlueprintInferenceRaw: string,
): ParseTask2L1TargetKvRowsResult {
  const raw = stripBom(String(l5BlueprintInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 9 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask9L5BlueprintMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L5_Blueprint_Domain_Matrix 或非空 Target_KV；请确认模型输出为 L5_Blueprint_Domain_Matrix 契约 JSON',
    };
  }
  const targetKv = readTargetKvFromContainer(matrix);
  const seen = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  let hasModule = false;
  if (targetKv?.length) {
    for (const item of targetKv) {
      const rec = asRecord(item);
      if (!rec) continue;
      const key = resolveTask9L5FeatureKeyFromRow(rec) ?? featureKeyFromRow(rec);
      if (!key || !isTask9L5BlueprintFeatureKey(key)) continue;
      if (key === '二级功能菜单') {
        return {
          ok: false,
          message:
            '任务 9 V4.1 契约禁止产出「二级功能菜单」；请仅输出 Feature_Key=「系统一级模块」的宏观大伞行',
        };
      }
      const operator = operatorFromRow(rec);
      const featureValue = String(featureValueFromRow(rec) ?? '').trim();
      const vrd = valueRefDomainFromRow(rec);
      const inf = inferenceSummaryFromRow(rec);
      const evidence = evidenceSourceFromRow(rec);
      const logicRule = logicRuleFromRow(rec);
      const techHostPlatform = techHostPlatformFromRow(rec);
      const inferenceWeight = inferenceWeightFromRow(rec);
      const validationStatus = validationStatusFromRow(rec);
      const dedup = task9L5TargetKvDedupKey(key, featureValue);
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      const chainRaw = readEvidenceSupportChainRaw(rec);
      const evidenceLinks = parseEvidenceSupportChainFromTargetKvRow(rec);
      if (!Array.isArray(chainRaw) || chainRaw.length === 0 || evidenceLinks.length === 0) {
        return {
          ok: false,
          message: `Target_KV 行「${featureValue || key}」的 Evidence_Support_Chain 为空；任务 9 契约要求证据链绝对完备`,
        };
      }
      if (!techHostPlatform) {
        return {
          ok: false,
          message: `系统一级模块「${featureValue || '—'}」缺少 Tech_Host_Platform；须宣告一期物理工具宿主平台`,
        };
      }
      const w =
        typeof inferenceWeight === 'number' && Number.isFinite(inferenceWeight)
          ? inferenceWeight
          : NaN;
      if (!Number.isFinite(w) || w < 0 || w > 1) {
        return {
          ok: false,
          message: `Target_KV 行「${featureValue || key}」缺少有效 Inference_Weight（须在 0.0~1.0 之间且结合 Input 3 独立给出）`,
        };
      }
      rows.push({
        featureKey: key,
        operator,
        featureValue,
        valueRefDomain: vrd,
        inferenceSummary: inf,
        evidenceSource: evidence,
        logicRule,
        techHostPlatform,
        inferenceWeight: w,
        ...(validationStatus ? { validationStatus } : {}),
        ...(evidenceLinks.length > 0 ? { evidenceLinks } : {}),
      });
      if (key === '系统一级模块') hasModule = true;
    }
  }
  if (rows.length === 0 || !hasModule) {
    return {
      ok: false,
      message:
        '未解析到 L5 领域容器特征（须含 Feature_Key=「系统一级模块」至少 1 条且带 Tech_Host_Platform）；请按 L5_Blueprint_Domain_Matrix 契约输出',
    };
  }
  return { ok: true, rows };
}

/** 任务 9 TVM：Mapped_L5_Feature 归一为「系统一级模块」 */
export function normalizeTask9L5MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (s === '系统一级模块') return s;
  return null;
}

/** 从任务 9 L5 原始 JSON 解析 Token_Validation_Mapping */
export function parseTokenValidationMappingFromL9BlueprintInferenceRaw(
  l5BlueprintInferenceRaw: string,
): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL2JsonRootRecord(l5BlueprintInferenceRaw);
  const m = readTask9L5BlueprintMatrixFromRaw(l5BlueprintInferenceRaw);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList) && rootObj) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) return [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedKey = normalizeTask9L5MappedFeatureKey(
      rec.Mapped_L5_Feature ??
        rec.mapped_l5_feature ??
        getPropertyCI(rec, 'Mapped_L5_Feature', 'mapped_l5_feature') ??
        rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature'),
    );
    if (!mappedKey) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey: mappedKey,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  return out;
}

/** 将任务 9 模型原文规范为可落库的 JSON 字符串 */
export function normalizeL5BlueprintInferenceRawForServerSync(
  l5BlueprintInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l5BlueprintInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) return { ok: false, message: 'JSON 解析失败' };
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask9L5BlueprintMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message: '未找到 L5_Blueprint_Domain_Matrix 或非空 Target_KV',
    };
  }
  const tkInMatrix = readTargetKvFromContainer(matrix);
  if (!tkInMatrix?.length) {
    return { ok: false, message: 'L5_Blueprint_Domain_Matrix 内 Target_KV 为空' };
  }
  const hasMatrix = !!(
    asRecord(getPropertyCI(obj, 'L5_Blueprint_Domain_Matrix', 'l5_blueprint_domain_matrix')) ||
    asRecord(getPropertyCI(obj, 'L5_Blueprint_Container_Matrix', 'l5_blueprint_container_matrix'))
  );
  const domainMatrix = asRecord(getPropertyCI(obj, 'L5_Blueprint_Domain_Matrix', 'l5_blueprint_domain_matrix'));
  const payload = hasMatrix
    ? obj
    : domainMatrix
      ? { L5_Blueprint_Domain_Matrix: matrix }
      : { L5_Blueprint_Container_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

function normalizeTask10TableRefLabel(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '');
}

function inductionTypeFromRow(row: Record<string, unknown>): string | undefined {
  const v = getPropertyCI(row, 'Induction_Type', 'induction_type');
  const t = v != null ? String(v).trim() : '';
  return t.length ? t : undefined;
}

function parentTableRefFromRow(row: Record<string, unknown>): string | undefined {
  const v = getPropertyCI(row, 'Parent_Table_Ref', 'parent_table_ref');
  const t = v != null ? String(v).trim() : '';
  if (!t || t === 'N/A' || t === '—' || t === '-') return undefined;
  return t;
}

function introductionReasonFromRow(row: Record<string, unknown>): string | undefined {
  const v = getPropertyCI(row, 'Introduction_Reason', 'introduction_reason');
  const t = v != null ? String(v).trim() : '';
  return t.length ? t : undefined;
}

function referenceFieldMappingFromRow(row: Record<string, unknown>): string | undefined {
  const v = getPropertyCI(row, 'Reference_Field_Mapping', 'reference_field_mapping');
  const t = v != null ? String(v).trim() : '';
  if (!t || t === 'N/A' || t === '—' || t === '-') return undefined;
  return t;
}

/** 任务 10 层内：主表 feature → 基础表 feature 正向归纳边（由 Target_KV 级联字段合成） */
export type Task10IntraLayerMainToBaseForwardLinkInsert = {
  sourceFeatureId: string;
  targetFeatureId: string;
  logic: string;
  weight: number;
};

/**
 * 任务 10 落库：按 `Parent_Table_Ref` 对齐上游实体 `Feature_Value`，为子表/基础表行写同层正向归纳边
 * （含「主子级联纵向裂变」「主表正向归纳派生」等多阶级联）。
 */
export function buildTask10MainTableToBaseForwardLinks(
  rows: ReadonlyArray<{
    featureValue?: unknown;
    inductionType?: string;
    parentTableRef?: string;
    referenceFieldMapping?: string;
    introductionReason?: string;
    inferenceWeight?: number;
  }>,
  targetFeatureIds: readonly string[],
): Task10IntraLayerMainToBaseForwardLinkInsert[] {
  const tableLabelToFid = new Map<string, string>();
  type RowMeta = {
    fid: string;
    label: string;
    induction: string;
    parent?: string;
    refMap?: string;
    reason?: string;
    weight: number;
  };
  const metas: RowMeta[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const fid = String(targetFeatureIds[i] ?? '').trim();
    if (!fid) continue;
    const label = task10SchemaDisplayLabelFromFeatureValue(row.featureValue);
    const norm = normalizeTask10TableRefLabel(label);
    if (norm) tableLabelToFid.set(norm, fid);
    const weight =
      typeof row.inferenceWeight === 'number' && Number.isFinite(row.inferenceWeight)
        ? Math.min(1, Math.max(0, row.inferenceWeight))
        : 0.9;
    metas.push({
      fid,
      label,
      induction: String(row.inductionType ?? '').trim(),
      parent: row.parentTableRef,
      refMap: row.referenceFieldMapping,
      reason: row.introductionReason,
      weight,
    });
  }

  const out: Task10IntraLayerMainToBaseForwardLinkInsert[] = [];
  const seen = new Set<string>();

  for (const m of metas) {
    if (m.induction.includes('主表基准')) continue;
    const parentRef = String(m.parent ?? '').trim();
    if (!parentRef) continue;
    const srcFid = tableLabelToFid.get(normalizeTask10TableRefLabel(parentRef));
    if (!srcFid || srcFid === m.fid) continue;
    const pairKey = `${srcFid}\t${m.fid}`;
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    const reason = String(m.reason ?? '').trim();
    const refMap = String(m.refMap ?? '').trim();
    let logic = reason;
    if (refMap) {
      logic = logic ? `${logic}｜${refMap}` : refMap;
    }
    if (!logic) {
      if (m.induction.includes('主子级联纵向裂变')) {
        logic = `主表「${parentRef}」纵向裂变衍生子表「${m.label || '—'}」（Inference_Weight=${m.weight}）`;
      } else {
        logic = `实体「${parentRef}」正向归纳派生「${m.label || '—'}」（Inference_Weight=${m.weight}）`;
      }
    }
    out.push({
      sourceFeatureId: srcFid,
      targetFeatureId: m.fid,
      logic,
      weight: m.weight,
    });
  }

  return out;
}

/** 任务 10 表 → 字段裂变：由 Schema 行 `columns` 派生的单列落库计划 */
export type Task10SchemaFieldFissionColumnPlan = {
  tableFeatureId: string;
  tableName: string;
  fieldName: string;
  dataType: string;
  constraints: string;
  sourceFeatureId: string;
};

/**
 * 从已对齐的 Schema Target_KV 行解析 `columns`，供落库时创建「物理表字段」子特征与表→字段正向归纳边。
 */
export function buildTask10SchemaFieldFissionPlans(
  rows: ReadonlyArray<{ featureKey: string; featureValue?: unknown }>,
  tableFeatureIds: readonly string[],
): Task10SchemaFieldFissionColumnPlan[] {
  const out: Task10SchemaFieldFissionColumnPlan[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const key = normalizeTask10L5FeatureKeyForSync(row.featureKey);
    if (key !== '物理表结构Schema') continue;
    const tableFeatureId = String(tableFeatureIds[i] ?? '').trim();
    if (!tableFeatureId) continue;
    const payload = parseTask10StrongTypeSchemaPayload(row.featureValue);
    if (!payload) continue;
    const meta = payload.table_metadata;
    const tableName =
      meta && typeof meta === 'object' && !Array.isArray(meta)
        ? String((meta as Record<string, unknown>).table_name ?? '').trim()
        : task10SchemaDisplayLabelFromFeatureValue(row.featureValue);
    const cols = payload.columns ?? payload['字段集合'] ?? payload['字段信息'];
    if (!Array.isArray(cols)) continue;
    for (const item of cols) {
      if (!item || typeof item !== 'object') continue;
      const col = item as Record<string, unknown>;
      const fieldName = String(
        col.field_name ?? col['字段名称'] ?? col['字段名'] ?? col.name ?? '',
      ).trim();
      if (!fieldName) continue;
      out.push({
        tableFeatureId,
        tableName: tableName || fieldName,
        fieldName,
        dataType: String(col.data_type ?? col['数据类型'] ?? '').trim(),
        constraints: String(col.constraints ?? col['主键约束'] ?? '').trim(),
        sourceFeatureId: String(
          col.source_feature_id ?? col.sourceFeatureId ?? col.Source_Feature_ID ?? '',
        ).trim(),
      });
    }
  }
  return out;
}

/** 任务 10 L5：`物理技术Schema`（落库归一为 `物理表结构Schema`）/ 历史三键 */
export function isTask10L5TechnicalDdlFeatureKey(featureKey: string): boolean {
  const k = String(featureKey || '').trim();
  return (
    k === '物理技术Schema' ||
    k === '物理表结构Schema' ||
    k === '跨平台接口同步Schema' ||
    k === '基础表初始化' ||
    k === '权限字典初始化SQL'
  );
}

/** 落库统一 Feature_Key：新提示词「物理技术Schema」→ 图内「物理表结构Schema」；历史 SQL 键名归并为「基础表初始化」 */
export function normalizeTask10L5FeatureKeyForSync(featureKey: string): string {
  const k = String(featureKey || '').trim();
  if (k === '权限字典初始化SQL') return '基础表初始化';
  if (k === '物理技术Schema') return '物理表结构Schema';
  return k;
}

function task10TargetKvFeatureValueFromRow(rec: Record<string, unknown>): unknown {
  const raw = featureValueFromRow(rec);
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') return raw.trim();
  return raw;
}

/** 解析任务 10 强类型 Schema JSON（Feature_Value 为 JSON 字符串或对象） */
export function parseTask10StrongTypeSchemaPayload(featureValue: unknown): Record<string, unknown> | null {
  if (featureValue === null || featureValue === undefined) return null;
  if (typeof featureValue === 'string') {
    const s = featureValue.trim();
    if (!s.startsWith('{')) return null;
    try {
      const parsed = JSON.parse(s) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof featureValue === 'object' && !Array.isArray(featureValue)) {
    return featureValue as Record<string, unknown>;
  }
  return null;
}

/** 任务 10 新契约：Feature_Value 须含非空 columns / 字段集合 */
export function task10StrongTypeSchemaFeatureValueHasColumns(featureValue: unknown): boolean {
  const payload = parseTask10StrongTypeSchemaPayload(featureValue);
  if (!payload) return false;
  const cols = payload.columns ?? payload['字段集合'] ?? payload['字段信息'];
  return Array.isArray(cols) && cols.length > 0;
}

/** 任务 10：`table_name` / `field_name` 须含 CJK 汉字（禁止纯英文 snake_case 作主标识） */
function task10ChineseNamingLabelOk(raw: unknown): boolean {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  return /[\u3400-\u9fff]/u.test(s);
}

const TASK10_PARENT_REF_NA = new Set(['N/A', 'NA', '—', '-', 'NONE', '无']);

/** 常见英文列名 → 纯业务中文（模型仍输出 snake_case 时 sync 自愈） */
const TASK10_EN_FIELD_TO_ZH: Readonly<Record<string, string>> = {
  id: '系统唯一流水键',
  main_id: '关联主表流水键',
  created_at: '创建时间',
  updated_at: '更新时间',
  status: '状态',
  office_code: '办事处编码',
  clerk_id: '业务员工号',
  salesman_id: '业务员唯一编码',
  sales_id: '业务员唯一编码',
  user_id: '用户唯一编码',
  customer_id: '客户唯一编码',
  dept_id: '部门唯一编码',
  region_code: '区域编码',
  order_no: '订单号',
  order_id: '订单唯一编码',
  formula_adjust_ratio: '配方调整配比',
  formula_adjust_ratio_a: '添加剂A配方调整比例',
  total_tonnage: '领料总吨数',
  machine_no: '机台号',
  material_name: '物料名称',
  batch_no: '批次号',
  pick_tonnage: '领料吨数',
  operator_id: '操作人编码',
  pick_time: '领料时间',
  audit_status: '核销状态',
  workshop_code: '车间编码',
  current_stock: '当前库存量',
  unit: '计量单位',
  qty: '数量',
  quantity: '数量',
  amount: '金额',
  remark: '备注',
  description: '说明',
  type: '类型',
  name: '名称',
  code: '编码',
  no: '编号',
  num: '编号',
  phone: '联系电话',
  email: '电子邮箱',
  address: '地址',
};

const TASK10_EN_WORD_TO_ZH: Readonly<Record<string, string>> = {
  order: '订单',
  main: '主表',
  material: '物料',
  inventory: '库存',
  office: '办事处',
  clerk: '业务员',
  salesman: '业务员',
  sales: '销售',
  user: '用户',
  customer: '客户',
  dept: '部门',
  department: '部门',
  region: '区域',
  formula: '配方',
  adjust: '调整',
  ratio: '配比',
  total: '总',
  tonnage: '吨数',
  machine: '机台',
  batch: '批次',
  pick: '领料',
  operator: '操作人',
  audit: '核销',
  workshop: '车间',
  current: '当前',
  stock: '库存',
  code: '编码',
  name: '名称',
  time: '时间',
  unit: '单位',
  status: '状态',
  created: '创建',
  updated: '更新',
  insert: '插单',
  detail: '明细',
  line: '行',
  item: '项',
  qty: '数量',
  quantity: '数量',
  amount: '金额',
  remark: '备注',
  phone: '电话',
  email: '邮箱',
  address: '地址',
  type: '类型',
  lifecycle: '生命周期',
  document: '单据',
  sheet: '单据',
  num: '编号',
  no: '编号',
  a: 'A',
  b: 'B',
};

function task10MapSnakeWordsBase(base: string): string {
  const parts = String(base || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean);
  if (!parts.length) return '';
  return parts.map((p) => TASK10_EN_WORD_TO_ZH[p] ?? p).join('');
}

/** snake_case 后缀规则：salesman_id → 业务员编码 */
function task10SnakeFieldSuffixToChinese(snake: string): string {
  const lower = String(snake || '').trim().toLowerCase();
  const rules: Array<[RegExp, (base: string) => string]> = [
    [/^(.*)_id$/, (b) => `${task10MapSnakeWordsBase(b)}唯一编码`],
    [/^(.*)_no$/, (b) => `${task10MapSnakeWordsBase(b)}编号`],
    [/^(.*)_code$/, (b) => `${task10MapSnakeWordsBase(b)}编码`],
    [/^(.*)_name$/, (b) => `${task10MapSnakeWordsBase(b)}名称`],
    [/^(.*)_status$/, (b) => `${task10MapSnakeWordsBase(b)}状态`],
    [/^(.*)_time$/, (b) => `${task10MapSnakeWordsBase(b)}时间`],
    [/^(.*)_at$/, (b) => `${task10MapSnakeWordsBase(b)}时间`],
    [/^(.*)_ratio$/, (b) => `${task10MapSnakeWordsBase(b)}比例`],
    [/^(.*)_amount$/, (b) => `${task10MapSnakeWordsBase(b)}金额`],
    [/^(.*)_qty$/, (b) => `${task10MapSnakeWordsBase(b)}数量`],
    [/^(.*)_quantity$/, (b) => `${task10MapSnakeWordsBase(b)}数量`],
    [/^(.*)_num$/, (b) => `${task10MapSnakeWordsBase(b)}编号`],
    [/^(.*)_type$/, (b) => `${task10MapSnakeWordsBase(b)}类型`],
  ];
  for (const [re, mk] of rules) {
    const m = re.exec(lower);
    if (!m?.[1]) continue;
    const zh = mk(m[1]).replace(/^[a-zA-Z]+/, '');
    if (task10ChineseNamingLabelOk(zh)) return zh;
  }
  return '';
}

/** 从 Evidence 的 value / tokenstr 抽取可能的中文列名片段 */
function task10ChineseFieldHintsFromEvidence(rec: Record<string, unknown>): string[] {
  const hints: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    for (const part of String(raw || '').split(/[、,，/|；;\s]+/)) {
      const t = part.trim();
      if (!t || !task10ChineseNamingLabelOk(t) || seen.has(t)) continue;
      seen.add(t);
      hints.push(t);
    }
  };
  const chain = readEvidenceSupportChainRaw(rec);
  if (!Array.isArray(chain)) return hints;
  for (const item of chain) {
    const o = asRecord(item);
    if (!o) continue;
    const val = String(o.value ?? o.Value ?? '');
    const paren = /[（(]([^)）]+)[)）]/.exec(val);
    if (paren?.[1]) push(paren[1]);
    const head = val.split(/[（(]/)[0]?.trim();
    if (head && task10ChineseNamingLabelOk(head)) push(head);
    const tail = task10TailTokenFromPath(String(o.tokenstr ?? o.TokenStr ?? ''));
    if (tail && task10ChineseNamingLabelOk(tail)) push(tail);
  }
  return hints;
}

function task10HeuristicSnakeFieldToChinese(snake: string): string {
  const suffix = task10SnakeFieldSuffixToChinese(snake);
  if (suffix) return suffix;
  const parts = String(snake || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean);
  if (!parts.length) return '';
  const mapped = parts.map((p) => TASK10_EN_WORD_TO_ZH[p] ?? p).join('');
  return task10ChineseNamingLabelOk(mapped) ? mapped : '';
}

function task10NormalizeFieldNameToChinese(
  raw: string,
  hints?: readonly string[],
  hintIndex?: number,
): string {
  const s = String(raw ?? '').trim();
  if (!s || task10ChineseNamingLabelOk(s)) return s;
  const lower = s.toLowerCase();
  const direct = TASK10_EN_FIELD_TO_ZH[lower];
  if (direct) return direct;
  const heur = task10HeuristicSnakeFieldToChinese(lower);
  if (heur) return heur;
  if (hints && hintIndex != null && hintIndex >= 0 && hintIndex < hints.length) {
    const hint = String(hints[hintIndex] ?? '').trim();
    if (hint && task10ChineseNamingLabelOk(hint)) return hint;
  }
  return s;
}

function task10TailTokenFromPath(tokenstr: string): string {
  const parts = String(tokenstr || '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function task10TableSuffixForInduction(induction: string): string {
  const ind = String(induction || '').trim();
  if (ind.includes('纵向裂变') || ind.includes('主子级联')) return '明细子表';
  if (ind.includes('正向归纳派生') || ind.includes('基础表') || ind.includes('基础')) return '基础主数据表';
  return '主表';
}

/** 从 Target_KV 行 Evidence_Support_Chain 推断中文表名（化石 token 尾段 + 归纳类型后缀） */
export function inferTask10ChineseTableNameFromTargetKvRow(
  rec: Record<string, unknown>,
  inductionType?: string,
): string {
  const chain = readEvidenceSupportChainRaw(rec);
  if (!Array.isArray(chain)) return '';
  const meta = asRecord(parseTask10StrongTypeSchemaPayload(task10TargetKvFeatureValueFromRow(rec)));
  const innerMeta = asRecord(meta?.table_metadata);
  const induction = String(
    inductionType ?? innerMeta?.induction_type ?? inductionTypeFromRow(rec) ?? '',
  ).trim();
  const suffix = task10TableSuffixForInduction(induction);
  for (const item of chain) {
    const o = asRecord(item);
    if (!o) continue;
    const tail = task10TailTokenFromPath(String(o.tokenstr ?? o.TokenStr ?? ''));
    if (task10ChineseNamingLabelOk(tail)) return `${tail}${suffix}`;
    const valHead = String(o.value ?? o.Value ?? '')
      .trim()
      .split(/[（(]/)[0]
      ?.trim();
    if (valHead && task10ChineseNamingLabelOk(valHead)) return `${valHead}${suffix}`;
  }
  return '';
}

function task10ResolveChineseTableLabel(
  englishOrMixed: string,
  rec: Record<string, unknown>,
  inductionType: string | undefined,
  tableLabelByEnglish: Map<string, string>,
): string {
  const raw = String(englishOrMixed ?? '').trim();
  if (!raw) return '';
  if (task10ChineseNamingLabelOk(raw)) return raw;
  const cached = tableLabelByEnglish.get(raw);
  if (cached) return cached;
  const inferred = inferTask10ChineseTableNameFromTargetKvRow(rec, inductionType);
  if (inferred) {
    tableLabelByEnglish.set(raw, inferred);
    return inferred;
  }
  return raw;
}

function task10SerializeStrongTypeSchemaFeatureValue(
  payload: Record<string, unknown>,
  original: unknown,
): unknown {
  try {
    if (typeof original === 'string') return JSON.stringify(payload);
    if (typeof original === 'object' && original !== null) return payload;
    return JSON.stringify(payload);
  } catch {
    return original;
  }
}

/**
 * 任务 10 sync：将 Feature_Value 内英文 snake_case 表名/列名自愈为中文（优先 Evidence 化石 token 尾段）。
 * 供 parse 落库前调用；仍无法中文化时交由后续门禁拒绝。
 */
export function normalizeTask10StrongTypeSchemaFeatureValueChinese(
  featureValue: unknown,
  rec: Record<string, unknown>,
  tableLabelByEnglish: Map<string, string>,
): unknown {
  const payload = parseTask10StrongTypeSchemaPayload(featureValue);
  if (!payload) return featureValue;
  const induction = String(
    (payload.table_metadata as Record<string, unknown> | undefined)?.induction_type ??
      inductionTypeFromRow(rec) ??
      '',
  ).trim();
  const meta =
    payload.table_metadata && typeof payload.table_metadata === 'object' && !Array.isArray(payload.table_metadata)
      ? ({ ...(payload.table_metadata as Record<string, unknown>) } as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const englishTable = String(meta.table_name ?? '').trim();
  const zhTable = task10ResolveChineseTableLabel(englishTable, rec, induction, tableLabelByEnglish);
  if (zhTable && englishTable && zhTable !== englishTable) {
    tableLabelByEnglish.set(englishTable, zhTable);
  }
  if (zhTable) meta.table_name = zhTable;
  const parentRaw = String(meta.parent_table_ref ?? '').trim();
  if (parentRaw && !TASK10_PARENT_REF_NA.has(parentRaw.toUpperCase())) {
    meta.parent_table_ref = task10ResolveChineseTableLabel(
      parentRaw,
      rec,
      induction,
      tableLabelByEnglish,
    );
  }
  const cols = payload.columns ?? payload['字段集合'] ?? payload['字段信息'];
  const fieldHints = task10ChineseFieldHintsFromEvidence(rec);
  if (Array.isArray(cols)) {
    payload.columns = cols.map((item, colIdx) => {
      if (!item || typeof item !== 'object') return item;
      const col = { ...(item as Record<string, unknown>) };
      const fn = String(col.field_name ?? col['字段名称'] ?? col['字段名'] ?? col.name ?? '').trim();
      const zhFn = task10NormalizeFieldNameToChinese(fn, fieldHints, colIdx);
      if (zhFn) col.field_name = zhFn;
      return col;
    });
  }
  payload.table_metadata = meta;
  const init =
    payload.data_initialization &&
    typeof payload.data_initialization === 'object' &&
    !Array.isArray(payload.data_initialization)
      ? ({ ...(payload.data_initialization as Record<string, unknown>) } as Record<string, unknown>)
      : null;
  if (init && zhTable) {
    init.target_table = zhTable;
    payload.data_initialization = init;
  }
  return task10SerializeStrongTypeSchemaFeatureValue(payload, featureValue);
}

/** 预扫描 Target_KV：英文 table_name → 中文表名（含跨行 parent 引用） */
function buildTask10EnglishTableLabelMap(targetKv: readonly unknown[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of targetKv) {
    const rec = asRecord(item);
    if (!rec) continue;
    const keyRaw = resolveTask10L5FeatureKeyFromRow(rec) ?? featureKeyFromRow(rec);
    if (!keyRaw || normalizeTask10L5FeatureKeyForSync(keyRaw) !== '物理表结构Schema') continue;
    const fv = task10TargetKvFeatureValueFromRow(rec);
    const payload = parseTask10StrongTypeSchemaPayload(fv);
    if (!payload) continue;
    const meta = asRecord(payload.table_metadata);
    const english = String(meta?.table_name ?? '').trim();
    if (!english || task10ChineseNamingLabelOk(english)) continue;
    task10ResolveChineseTableLabel(english, rec, inductionTypeFromRow(rec), map);
  }
  return map;
}

/**
 * 任务 10 强类型 Schema：校验 `table_metadata.table_name`、`columns[].field_name`、
 * `data_initialization.target_table` 与内层 `parent_table_ref` 须为中文业务名。
 * 返回违例说明；通过则返回 null。
 */
export function task10StrongTypeSchemaChineseNamingViolation(featureValue: unknown): string | null {
  const payload = parseTask10StrongTypeSchemaPayload(featureValue);
  if (!payload) {
    return 'Feature_Value 须为可解析的强类型 JSON（含 table_metadata / columns）';
  }
  const meta =
    payload.table_metadata && typeof payload.table_metadata === 'object' && !Array.isArray(payload.table_metadata)
      ? (payload.table_metadata as Record<string, unknown>)
      : null;
  const tableName = String(meta?.table_name ?? '').trim();
  if (!task10ChineseNamingLabelOk(tableName)) {
    return `table_metadata.table_name「${tableName || '(空)'}」须为中文业务表名（与任务 1 化石对齐），禁止纯英文 snake_case（如 insert_order_main）`;
  }
  const innerParentRef = String(meta?.parent_table_ref ?? '').trim();
  if (innerParentRef && !TASK10_PARENT_REF_NA.has(innerParentRef.toUpperCase()) && !task10ChineseNamingLabelOk(innerParentRef)) {
    return `table_metadata.parent_table_ref「${innerParentRef}」须为中文父表名或 N/A`;
  }
  const init =
    payload.data_initialization &&
    typeof payload.data_initialization === 'object' &&
    !Array.isArray(payload.data_initialization)
      ? (payload.data_initialization as Record<string, unknown>)
      : null;
  const targetTable = String(init?.target_table ?? '').trim();
  if (targetTable && !task10ChineseNamingLabelOk(targetTable)) {
    return `data_initialization.target_table「${targetTable}」须为中文表名，且与 table_metadata.table_name 一致`;
  }
  if (targetTable && tableName && targetTable !== tableName) {
    return `data_initialization.target_table「${targetTable}」须与 table_metadata.table_name「${tableName}」一致`;
  }
  const cols = payload.columns ?? payload['字段集合'] ?? payload['字段信息'];
  if (!Array.isArray(cols)) {
    return 'columns 须为非空数组';
  }
  for (let i = 0; i < cols.length; i++) {
    const item = cols[i];
    if (!item || typeof item !== 'object') continue;
    const col = item as Record<string, unknown>;
    const fieldName = String(col.field_name ?? col['字段名称'] ?? col['字段名'] ?? col.name ?? '').trim();
    if (!task10ChineseNamingLabelOk(fieldName)) {
      return `columns[${i}].field_name「${fieldName || '(空)'}」须为中文列名（与任务 1 列名语义对齐），禁止纯英文 snake_case（如 clerk_id）`;
    }
  }
  return null;
}

/** 任务 10 层内正向归纳边：从 Feature_Value 取表标识（JSON table_name 或历史纯文本表名） */
export function task10SchemaDisplayLabelFromFeatureValue(featureValue: unknown): string {
  const payload = parseTask10StrongTypeSchemaPayload(featureValue);
  if (payload) {
    const meta = payload.table_metadata;
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      const tn = String((meta as Record<string, unknown>).table_name ?? '').trim();
      if (tn) return tn;
    }
  }
  return task7SyncRowFeatureValueLabel(featureValue);
}

function task10TargetKvFeatureValueDedupKey(featureValue: unknown): string {
  if (featureValue === null || featureValue === undefined) return '';
  if (typeof featureValue === 'string') return featureValue.trim();
  try {
    return JSON.stringify(featureValue);
  } catch {
    return String(featureValue);
  }
}

const L5_TECHNICAL_DDL_MATRIX_KEY_PAIRS: Array<[string, string]> = [
  ['L5_Data_Architecture_Matrix', 'l5_data_architecture_matrix'],
  ['L5_Technical_DDL_Matrix', 'l5_technical_ddl_matrix'],
  ['L5_Technical_DDL_Inference_Matrix', 'l5_technical_ddl_inference_matrix'],
];

function readL5TechnicalDdlMatrixFromRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  for (const [k1, k2] of L5_TECHNICAL_DDL_MATRIX_KEY_PAIRS) {
    const direct = asRecord(getPropertyCI(root, k1, k2));
    if (direct) return direct;
  }
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    for (const [k1, k2] of L5_TECHNICAL_DDL_MATRIX_KEY_PAIRS) {
      const inner = asRecord(getPropertyCI(o, k1, k2));
      if (inner) return inner;
    }
  }
  const topKv = readTargetKvFromContainer(root);
  if (topKv?.length) return root;
  return null;
}

function readTask10L5TechnicalDdlMatrixFromRaw(l5DdlInferenceRaw: string): Record<string, unknown> | null {
  const obj = readL2JsonRootRecord(l5DdlInferenceRaw);
  if (!obj) return null;
  return readL5TechnicalDdlMatrixFromRoot(obj);
}

function task10L5TargetKvDedupKey(featureKey: string, techHostPlatform: string, featureValue: string): string {
  return `${String(featureKey || '').trim()}\t${String(techHostPlatform || '').trim()}\t${String(featureValue || '').trim()}`;
}

function resolveTask10L5FeatureKeyFromRow(rec: Record<string, unknown>): string | null {
  const key = featureKeyFromRow(rec);
  if (key && isTask10L5TechnicalDdlFeatureKey(key)) return key;
  return null;
}

/** 任务 10：物理表结构 Schema / 基础表初始化 Target_KV */
export function parseTask10L5TechnicalDdlTargetKvSyncRows(
  l5TechnicalDdlInferenceRaw: string,
): ParseTask2L1TargetKvRowsResult {
  const raw = stripBom(String(l5TechnicalDdlInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 10 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask10L5TechnicalDdlMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L5_Data_Architecture_Matrix / L5_Technical_DDL_Matrix 或非空 Target_KV；请确认模型输出为任务 10 数据架构契约 JSON',
    };
  }
  const targetKv = readTargetKvFromContainer(matrix);
  const seen = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  let hasSchema = false;
  const tableLabelByEnglish = targetKv?.length ? buildTask10EnglishTableLabelMap(targetKv) : new Map<string, string>();
  if (targetKv?.length) {
    for (const item of targetKv) {
      const rec = asRecord(item);
      if (!rec) continue;
      const keyRaw = resolveTask10L5FeatureKeyFromRow(rec) ?? featureKeyFromRow(rec);
      if (!keyRaw || !isTask10L5TechnicalDdlFeatureKey(keyRaw)) continue;
      const key = normalizeTask10L5FeatureKeyForSync(keyRaw);
      const operator = operatorFromRow(rec);
      let featureValue = task10TargetKvFeatureValueFromRow(rec);
      const vrd = valueRefDomainFromRow(rec);
      const inf = inferenceSummaryFromRow(rec);
      const evidence = evidenceSourceFromRow(rec);
      const logicRule = logicRuleFromRow(rec);
      let techHostPlatform = techHostPlatformFromRow(rec);
      const inferenceWeight = inferenceWeightFromRow(rec);
      const inductionType = inductionTypeFromRow(rec);
      const parentTableRef = parentTableRefFromRow(rec);
      const referenceFieldMapping = referenceFieldMappingFromRow(rec);
      const introductionReason = introductionReasonFromRow(rec);
      if (!techHostPlatform) {
        /** 新「物理技术Schema」契约示例可无宿主字段；落库时占位，避免阻断 TVM 先行落库 */
        if (keyRaw === '物理技术Schema' || key === '物理表结构Schema') {
          techHostPlatform = '待 Input 1 宿主对齐';
        } else {
          return {
            ok: false,
            message: `Target_KV 行「${key}」缺少 Tech_Host_Platform；须宣告物理工具宿主平台`,
          };
        }
      }
      const dedup = task10L5TargetKvDedupKey(key, techHostPlatform, task10TargetKvFeatureValueDedupKey(featureValue));
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      const chainRaw = readEvidenceSupportChainRaw(rec);
      const evidenceLinks = parseEvidenceSupportChainFromTargetKvRow(rec);
      if (!Array.isArray(chainRaw) || chainRaw.length === 0 || evidenceLinks.length === 0) {
        return {
          ok: false,
          message: `Target_KV 行「${key}@${techHostPlatform}」的 Evidence_Support_Chain 为空；任务 10 契约要求证据链完备`,
        };
      }
      if (
        (key === '物理表结构Schema' || keyRaw === '物理技术Schema') &&
        !task10StrongTypeSchemaFeatureValueHasColumns(featureValue)
      ) {
        return {
          ok: false,
          message: `Target_KV 行「${key}@${techHostPlatform}」的 Feature_Value 未含有效 columns 字段矩阵（当前为纯文本表名或空 JSON）。须按契约输出内嵌 table_metadata / columns / row_level_security / data_initialization 的强类型 JSON 字符串；table_name 与 field_name 须为中文业务名。`,
        };
      }
      if (key === '物理表结构Schema' || keyRaw === '物理技术Schema') {
        featureValue = normalizeTask10StrongTypeSchemaFeatureValueChinese(
          featureValue,
          rec,
          tableLabelByEnglish,
        );
        const namingErr = task10StrongTypeSchemaChineseNamingViolation(featureValue);
        if (namingErr) {
          return {
            ok: false,
            message: `Target_KV 行「${key}@${techHostPlatform}」${namingErr}`,
          };
        }
      }
      const w =
        typeof inferenceWeight === 'number' && Number.isFinite(inferenceWeight)
          ? inferenceWeight
          : NaN;
      if (!Number.isFinite(w) || w < 0 || w > 1) {
        return {
          ok: false,
          message: `Target_KV 行「${key}@${techHostPlatform}」缺少有效 Inference_Weight（须在 0.0~1.0 之间）`,
        };
      }
      rows.push({
        featureKey: key,
        operator,
        featureValue,
        valueRefDomain: vrd,
        inferenceSummary: inf,
        evidenceSource: evidence,
        logicRule,
        techHostPlatform,
        inferenceWeight: w,
        ...(inductionType ? { inductionType } : {}),
        ...(parentTableRef ? { parentTableRef } : {}),
        ...(referenceFieldMapping ? { referenceFieldMapping } : {}),
        ...(introductionReason ? { introductionReason } : {}),
        ...(evidenceLinks.length > 0 ? { evidenceLinks } : {}),
      });
      if (key === '物理表结构Schema' || keyRaw === '物理技术Schema') hasSchema = true;
    }
  }
  if (rows.length === 0 || !hasSchema) {
    return {
      ok: false,
      message:
        '未解析到 L5 数据架构特征（须含 Feature_Key=「物理技术Schema」或「物理表结构Schema」至少 1 条；有宿主信息时须带 Tech_Host_Platform）；请按 L5_Data_Architecture_Matrix 契约输出',
    };
  }
  return { ok: true, rows };
}

/** 将任务 10 模型原文规范为可落库的 JSON 字符串 */
export function normalizeL5TechnicalDdlInferenceRawForServerSync(
  l5TechnicalDdlInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l5TechnicalDdlInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 10 模型输出是否为合法 JSON；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 8);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readL5TechnicalDdlMatrixFromRoot(obj);
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L5_Data_Architecture_Matrix / L5_Technical_DDL_Matrix 或非空 Target_KV；请确认模型输出为任务 10 数据架构契约 JSON',
    };
  }
  const tkInMatrix = readTargetKvFromContainer(matrix);
  if (!tkInMatrix?.length) {
    return { ok: false, message: 'L5 数据架构矩阵内 Target_KV 为空' };
  }
  let hasMatrix = false;
  for (const [k1, k2] of L5_TECHNICAL_DDL_MATRIX_KEY_PAIRS) {
    if (asRecord(getPropertyCI(obj, k1, k2))) {
      hasMatrix = true;
      break;
    }
  }
  const payload = hasMatrix ? obj : { L5_Data_Architecture_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/** 任务 6.5 L3：`Target_KV[].Feature_Key` 统一为「流程优化Gap方案」 */
export const TASK65_L3_IT_GAP_FEATURE_KEY = '流程优化Gap方案' as const;

/** 任务 6.5 落库 / 逻辑树展示用三维 Gap 特征键（与 surface token 一致） */
export const TASK65_INTERACTION_GAP_FEATURE_KEY = '交互体验 gap' as const;
export const TASK65_DATA_MGMT_GAP_FEATURE_KEY = '数据管理 gap' as const;
export const TASK65_CALC_ANALYSIS_GAP_FEATURE_KEY = '计算分析 gap' as const;

export const TASK65_L3_GAP_FEATURE_KEYS = [
  TASK65_INTERACTION_GAP_FEATURE_KEY,
  TASK65_DATA_MGMT_GAP_FEATURE_KEY,
  TASK65_CALC_ANALYSIS_GAP_FEATURE_KEY,
] as const;

const TASK65_GAP_OBSERVATION_NONE = new Set([
  '暂无',
  '（暂无）',
  '无',
  '（无）',
  'N/A',
  'n/a',
  'NA',
]);

type Task65GapExpandSpec = {
  nestedKey: string;
  featureKey: (typeof TASK65_L3_GAP_FEATURE_KEYS)[number];
  legacyFlatKey: string;
};

const TASK65_GAP_EXPAND_SPECS: readonly Task65GapExpandSpec[] = [
  {
    nestedKey: 'interaction_experience_gap',
    featureKey: TASK65_INTERACTION_GAP_FEATURE_KEY,
    legacyFlatKey: 'interaction_experience_gap_solution',
  },
  {
    nestedKey: 'data_record_gap',
    featureKey: TASK65_DATA_MGMT_GAP_FEATURE_KEY,
    legacyFlatKey: 'data_record_gap_solution',
  },
  {
    nestedKey: 'calculation_analysis_gap',
    featureKey: TASK65_CALC_ANALYSIS_GAP_FEATURE_KEY,
    legacyFlatKey: 'calculation_analysis_gap_solution',
  },
] as const;

function task65ReadStrFromRecord(rec: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = rec[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

function task65GapObservationIsNone(observation: string): boolean {
  const t = String(observation ?? '').trim();
  if (!t) return true;
  return TASK65_GAP_OBSERVATION_NONE.has(t);
}

function task65ParentFeatureValueObject(row: Task2L1TargetKvSyncRow): Record<string, unknown> | null {
  const fv = row.featureValue;
  if (fv != null && typeof fv === 'object' && !Array.isArray(fv)) {
    return fv as Record<string, unknown>;
  }
  if (typeof fv === 'string') {
    try {
      const inner = JSON.parse(fv);
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        return inner as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function task65GapPairFromParentFv(
  parentFv: Record<string, unknown>,
  spec: Task65GapExpandSpec,
): { gap_observation: string; solution_proposal: string } | null {
  const nested = asRecord(parentFv[spec.nestedKey]);
  if (nested) {
    const obs = task65ReadStrFromRecord(nested, 'gap_observation', 'Gap_Observation');
    const sol = task65ReadStrFromRecord(nested, 'solution_proposal', 'Solution_Proposal');
    if (task65GapObservationIsNone(obs)) return null;
    return { gap_observation: obs, solution_proposal: sol };
  }
  const legacy = task65ReadStrFromRecord(parentFv, spec.legacyFlatKey);
  if (!legacy || task65GapObservationIsNone(legacy)) return null;
  return { gap_observation: '', solution_proposal: legacy };
}

export function isTask65L3GapFeatureKey(featureKey: string): boolean {
  const k = String(featureKey || '').trim();
  return (TASK65_L3_GAP_FEATURE_KEYS as readonly string[]).includes(k);
}

/**
 * 将模型输出的「流程优化Gap方案」行展开为最多 3 条 Gap 特征行；`gap_observation` 为「暂无」的维度跳过。
 * 各 Gap 行复制同源 `Evidence_Support_Chain` 解析结果。
 */
export function expandTask65L3ItGapRowsToGapFeatureRows(
  rows: readonly Task2L1TargetKvSyncRow[],
): Task2L1TargetKvSyncRow[] {
  const out: Task2L1TargetKvSyncRow[] = [];
  for (const row of rows) {
    if (isTask65L3GapFeatureKey(row.featureKey)) {
      out.push(row);
      continue;
    }
    if (!isTask65L3ItGapFeatureKey(row.featureKey)) {
      out.push(row);
      continue;
    }
    const parentFv = task65ParentFeatureValueObject(row);
    if (!parentFv) continue;
    const stepName = task65ReadStrFromRecord(
      parentFv,
      'current_process_step_name',
      'Current_Process_Step_Name',
    );
    const phase = task65ReadStrFromRecord(
      parentFv,
      'targeted_value_phase',
      'Targeted_Value_Phase',
    );
    const wfSeg = task65ReadStrFromRecord(
      parentFv,
      'optimized_workflow_segment',
      'Optimized_Workflow_Segment',
    );
    const evidenceCopy =
      row.evidenceLinks && row.evidenceLinks.length > 0
        ? row.evidenceLinks.map((L) => ({ ...L }))
        : undefined;
    let anyGap = false;
    for (const spec of TASK65_GAP_EXPAND_SPECS) {
      const pair = task65GapPairFromParentFv(parentFv, spec);
      if (!pair) continue;
      anyGap = true;
      const gapFv: Record<string, unknown> = {
        optimized_workflow_segment: wfSeg,
        targeted_value_phase: phase,
        current_process_step_name: stepName,
        gap_kind: spec.featureKey,
        gap_observation: pair.gap_observation,
        solution_proposal: pair.solution_proposal,
      };
      out.push({
        ...row,
        featureKey: spec.featureKey,
        featureValue: gapFv,
        ...(evidenceCopy ? { evidenceLinks: evidenceCopy } : {}),
      });
    }
    if (!anyGap) {
      /* 三向均为「暂无」：不落库该环节 */
    }
  }
  return out;
}

/** TVM：`Mapped_L3_Feature=流程优化Gap方案` 对齐到本批已展开的 Gap 特征键 */
export function expandTask65L3TokenValidationPlans(
  rows: readonly Task2L1TargetKvSyncRow[],
  tvPlans: readonly Task2L1TokenValidationLinkPlan[],
): Task2L1TokenValidationLinkPlan[] {
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const tv of tvPlans) {
    const mappedRaw = String(tv.mappedL1FeatureKey || '').trim();
    const mappedNorm = normalizeTask65L3MappedFeatureKey(mappedRaw) ?? mappedRaw;
    if (mappedNorm !== TASK65_L3_IT_GAP_FEATURE_KEY) {
      out.push(tv);
      continue;
    }
    const targetId = String(tv.targetFeatureId || '').trim();
    const candidates = rows.filter(
      (r) =>
        isTask65L3GapFeatureKey(r.featureKey) &&
        (r.evidenceLinks ?? []).some((L) => String(L.sourceFeatureId || '').trim() === targetId),
    );
    const pick =
      candidates.find((r) => r.featureKey === TASK65_DATA_MGMT_GAP_FEATURE_KEY) ??
      candidates.find((r) => r.featureKey === TASK65_INTERACTION_GAP_FEATURE_KEY) ??
      candidates[0];
    if (!pick) continue;
    out.push({ ...tv, mappedL1FeatureKey: pick.featureKey });
  }
  return out;
}

const L3_IT_GAP_MATRIX_KEY_PAIRS: Array<[string, string]> = [
  ['L3_IT_Gap_Analysis_Matrix', 'l3_it_gap_analysis_matrix'],
];

function readL3ItGapMatrixFromRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  for (const [k1, k2] of L3_IT_GAP_MATRIX_KEY_PAIRS) {
    const direct = asRecord(getPropertyCI(root, k1, k2));
    if (direct) return direct;
  }
  for (const v of Object.values(root)) {
    const o = asRecord(v);
    if (!o) continue;
    for (const [k1, k2] of L3_IT_GAP_MATRIX_KEY_PAIRS) {
      const inner = asRecord(getPropertyCI(o, k1, k2));
      if (inner) return inner;
    }
  }
  const topKv = readTargetKvFromContainer(root);
  if (topKv?.length) return root;
  return null;
}

function readTask65L3ItGapMatrixFromRaw(l3ItGapInferenceRaw: string): Record<string, unknown> | null {
  const obj = readL2JsonRootRecord(l3ItGapInferenceRaw);
  if (!obj) return null;
  return readL3ItGapMatrixFromRoot(obj);
}

export function isTask65L3ItGapFeatureKey(featureKey: string): boolean {
  const k = String(featureKey || '').trim();
  if (k === TASK65_L3_IT_GAP_FEATURE_KEY) return true;
  if (isTask65L3GapFeatureKey(k)) return true;
  return /^流程优化Gap方案[_\s]*\d+/i.test(k);
}

export function normalizeTask65L3MappedFeatureKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s === TASK65_L3_IT_GAP_FEATURE_KEY || /^流程优化Gap方案[_\s]*\d+/i.test(s)) {
    return TASK65_L3_IT_GAP_FEATURE_KEY;
  }
  if (isTask65L3GapFeatureKey(s)) return s;
  return null;
}

/** 任务 6.5：解析 `流程优化Gap方案` Target_KV 行 */
export function parseTask65L3ItGapTargetKvSyncRows(
  l3ItGapInferenceRaw: string,
): ParseTask2L1TargetKvRowsResult {
  const raw = stripBom(String(l3ItGapInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) {
    return {
      ok: false,
      message: `JSON 解析失败（请检查任务 6.5 模型输出；原文前 120 字：${raw.slice(0, 120)}）`,
    };
  }
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask65L3ItGapMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message:
        '未找到 L3_IT_Gap_Analysis_Matrix 或非空 Target_KV；请确认模型输出为 L3_IT_Gap_Analysis_Matrix 契约 JSON',
    };
  }
  const targetKv = readTargetKvFromContainer(matrix);
  const seen = new Set<string>();
  const rows: Task2L1TargetKvSyncRow[] = [];
  if (targetKv?.length) {
    appendParsedTask2L1Rows(
      targetKv.filter((item) => {
        const rec = asRecord(item);
        if (!rec) return false;
        const key = featureKeyFromRow(rec);
        return !!key && isTask65L3ItGapFeatureKey(key);
      }),
      rows,
      seen,
    );
  }
  if (rows.length === 0) {
    return {
      ok: false,
      message:
        '未解析到流程优化 Gap 方案节点（Feature_Key=「流程优化Gap方案」）；请按 L3_IT_Gap_Analysis_Matrix 契约输出',
    };
  }
  const expanded = expandTask65L3ItGapRowsToGapFeatureRows(rows);
  if (expanded.length === 0) {
    return {
      ok: false,
      message:
        '未解析到可落库的三维 Gap 特征（各环节三向 Gap 观察均为「暂无」或未输出有效 Target_KV）',
    };
  }
  return { ok: true, rows: expanded };
}

/** 任务 6.5 sync 前规范 L3 IT-Gap JSON */
export function normalizeL65ItGapInferenceRawForServerSync(
  l3ItGapInferenceRaw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const raw = stripBom(String(l3ItGapInferenceRaw || '').trim());
  if (!raw.length) return { ok: false, message: '模型输出为空' };
  const rootOnce = tryParseJsonRoot(raw);
  if (rootOnce === null) return { ok: false, message: 'JSON 解析失败' };
  const root = peelJsonStringLayers(rootOnce, 6);
  const obj = asRecord(root);
  if (!obj) return { ok: false, message: '根节点须为 JSON 对象' };
  const matrix = readTask65L3ItGapMatrixFromRaw(raw);
  if (!matrix) {
    return {
      ok: false,
      message: '未找到 L3_IT_Gap_Analysis_Matrix 或非空 Target_KV',
    };
  }
  const tkInMatrix = readTargetKvFromContainer(matrix);
  if (!tkInMatrix?.length) {
    return { ok: false, message: 'L3_IT_Gap_Analysis_Matrix 内 Target_KV 为空' };
  }
  const hasMatrix = !!asRecord(
    getPropertyCI(obj, 'L3_IT_Gap_Analysis_Matrix', 'l3_it_gap_analysis_matrix'),
  );
  const payload = hasMatrix ? obj : { L3_IT_Gap_Analysis_Matrix: matrix };
  try {
    return { ok: true, normalized: JSON.stringify(payload) };
  } catch {
    return { ok: false, message: 'JSON 序列化失败' };
  }
}

/** 从任务 6.5 L3 原始 JSON 解析 Token_Validation_Mapping */
export function parseTokenValidationMappingFromL65ItGapInferenceRaw(
  l3ItGapInferenceRaw: string,
): Task2L1TokenValidationLinkPlan[] {
  const rootObj = readL2JsonRootRecord(l3ItGapInferenceRaw);
  const m = readTask65L3ItGapMatrixFromRaw(l3ItGapInferenceRaw);
  let rawList: unknown =
    m &&
    (m.Token_Validation_Mapping ??
      m.token_validation_mapping ??
      getPropertyCI(m, 'Token_Validation_Mapping', 'token_validation_mapping'));
  if (!Array.isArray(rawList) && rootObj) {
    rawList =
      rootObj.Token_Validation_Mapping ??
      rootObj.token_validation_mapping ??
      getPropertyCI(rootObj, 'Token_Validation_Mapping', 'token_validation_mapping');
  }
  if (!Array.isArray(rawList)) rawList = [];
  const out: Task2L1TokenValidationLinkPlan[] = [];
  for (const item of rawList as unknown[]) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fidRaw =
      rec.Target_FeatureID ??
      rec.target_feature_id ??
      getPropertyCI(rec, 'Target_FeatureID', 'target_feature_id');
    const targetFeatureId =
      typeof fidRaw === 'string' ? fidRaw.trim() : String(fidRaw ?? '').trim();
    if (!targetFeatureId) continue;
    const mappedKey = normalizeTask65L3MappedFeatureKey(
      rec.Mapped_L3_Feature ??
        rec.mapped_l3_feature ??
        getPropertyCI(rec, 'Mapped_L3_Feature', 'mapped_l3_feature') ??
        rec.Mapped_L2_Feature ??
        rec.mapped_l2_feature ??
        getPropertyCI(rec, 'Mapped_L2_Feature', 'mapped_l2_feature'),
    );
    if (!mappedKey) continue;
    const vLogicRaw =
      rec.Validation_Logic ??
      rec.validation_logic ??
      getPropertyCI(rec, 'Validation_Logic', 'validation_logic');
    const validationLogic =
      typeof vLogicRaw === 'string'
        ? vLogicRaw.trim()
        : String(vLogicRaw ?? '').trim() || '（无说明）';
    const vwRaw =
      rec.Validation_Weight ??
      rec.validation_weight ??
      getPropertyCI(rec, 'Validation_Weight', 'validation_weight');
    const validationWeight = contributionToLinkWeight(vwRaw);
    const consRaw =
      rec.Consistency ?? rec.consistency ?? getPropertyCI(rec, 'Consistency', 'consistency');
    let consistencyLabel =
      typeof consRaw === 'string' ? consRaw.trim() : String(consRaw ?? '').trim();
    if (consistencyLabel.length > 32) consistencyLabel = consistencyLabel.slice(0, 32);
    out.push({
      targetFeatureId,
      mappedL1FeatureKey: mappedKey,
      validationLogic,
      validationWeight,
      consistencyLabel,
    });
  }
  return out;
}
