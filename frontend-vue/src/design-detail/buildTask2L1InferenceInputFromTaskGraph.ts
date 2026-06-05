/**
 * [INPUT]: `GET …/design-detail/task-graph` 中任务 1 卡（`customer_basic`）的 `features[]` 项
 * [OUTPUT]: 任务 2 L1 大模型 **user** 文本块（**五**段：工商 / 组织拓扑 / 管理资源 / 非基础需求 TSV + **Input5 深访**占位）；**进度区** **`buildTask2L1InferenceProgressDebugText` / `buildTask2PostSyncEvidenceInputDebugLines`** 受 **`TASK2_L1_PROGRESS_DEBUG_UI_ENABLED`** 控制（默认 **关闭**、不推【调试】行）；**`truncateTask2L1InferenceBlockForProgress`** 截断进度文案
 * [POS]: 设计详情任务 2；由 `useDesignDetailChat` 在调用 `inferDesignDetailL1EntityPortraitFromContext` 前组装
 *
 * [PROTOCOL]: 送模 TSV 分段或列顺序变更时须同步 `designDetailL2L1EntityPortraitSystemPrompt.js`（Input 2＝任务 1 原始实然特征集；三键保活；Validation_Status 透传；TVM + Resolved_By_Customer 免疫；列：FeatureID、TokenStr、Operator、Value、Validation_Status）
 */

/**
 * 是否在任务进展区推送任务 2 L1 的【调试】灰块与落库后分区 TSV 行。
 * 产品默认关闭；开发对照 Evidence 时可改为 `true`。
 */
export const TASK2_L1_PROGRESS_DEBUG_UI_ENABLED = false;

/** 与后端 `GET …/design-detail/task-graph` 的 feature 行一致的可选字段 */
export type Task2L1TaskGraphFeatureRow = {
  featureId?: string;
  name?: string;
  themeKey?: string;
  tokenDisplay?: string;
  operator?: string;
  /** 任务 1 L1 原始实然特征：`DesignFeatureNode.value` 内 **Validation_Status** */
  validationStatus?: string;
  /** 原始 `DesignFeatureNode.value`；任务 10 Schema 的 `字段集合` 等须从此读取 */
  featureValue?: unknown;
  feature_value?: unknown;
};

function escapeTsvCell(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t\n\r]/g, ' ')
    .trim();
}

function formatFeatureTsvLines(features: Task2L1TaskGraphFeatureRow[]): string {
  if (!features.length) return '（无）';
  const withVs = features.some((f) => String(f.validationStatus ?? '').trim().length > 0);
  const lines: string[] = [];
  for (const f of features) {
    const id = escapeTsvCell(String(f.featureId ?? ''));
    const tok = escapeTsvCell(String(f.tokenDisplay ?? ''));
    const op = escapeTsvCell(String(f.operator ?? ''));
    const val = escapeTsvCell(String(f.name ?? ''));
    if (withVs) {
      const vs = escapeTsvCell(String(f.validationStatus ?? '').trim() || 'Pending');
      lines.push(`${id}\t${tok}\t${op}\t${val}\t${vs}`);
    } else {
      lines.push(`${id}\t${tok}\t${op}\t${val}`);
    }
  }
  return lines.join('\n');
}

/**
 * 按产品口径拆段：**工商**；**运营模式/人员组织/**；**管理资源/**；**其余**（业务背景、痛点、IT、运营其它路径、`dd:…:cr:` 各分域等，须全部进入 TSV，否则 L1 无法在 Evidence_Support_Chain 中引用与库一致的 `FeatureID`，逻辑边会为空或被后端跳过）。
 */
export function partitionTask2L1InferenceFeatures(features: Task2L1TaskGraphFeatureRow[]): {
  basic: Task2L1TaskGraphFeatureRow[];
  orgTopology: Task2L1TaskGraphFeatureRow[];
  management: Task2L1TaskGraphFeatureRow[];
  remainder: Task2L1TaskGraphFeatureRow[];
} {
  const basic: Task2L1TaskGraphFeatureRow[] = [];
  const orgTopology: Task2L1TaskGraphFeatureRow[] = [];
  const management: Task2L1TaskGraphFeatureRow[] = [];
  for (const f of features) {
    const tk = String(f.themeKey ?? '').trim();
    const path = String(f.tokenDisplay ?? '').trim();
    if (tk === 'customer_basic') {
      basic.push(f);
      continue;
    }
    if (path.startsWith('运营模式/人员组织/')) {
      orgTopology.push(f);
      continue;
    }
    if (path.startsWith('管理资源/')) {
      management.push(f);
      continue;
    }
  }
  const included = new Set<string>();
  for (const f of [...basic, ...orgTopology, ...management]) {
    const id = String(f.featureId ?? '').trim();
    if (id) included.add(id);
  }
  const remainder = features.filter((f) => {
    const id = String(f.featureId ?? '').trim();
    return id.length > 0 && !included.has(id);
  });
  return { basic, orgTopology, management, remainder };
}

/** 与后端 `痛点雷达/核心痛点总结`、逻辑树层内排序一致 */
export const TASK2_L1_PAIN_POINT_RADAR_CORE_SUMMARY_TOKEN = '痛点雷达/核心痛点总结';

const TASK2_L1_PAIN_POINT_RADAR_SEGMENT_ORDER = [
  '核心痛点总结',
  '系统',
  '人',
  '财',
  '物',
  '事',
  '管控',
] as const;

/** token 路径（` · ` 前）是否属于任务 1 **痛点雷达** 分域 */
export function isTask2L1PainPointRadarFeatureRow(f: Task2L1TaskGraphFeatureRow): boolean {
  const raw = String(f.tokenDisplay ?? '').trim();
  if (!raw) return false;
  const head = raw.includes('·') ? (raw.split(/\s*·\s*/)[0]?.trim() ?? raw) : raw;
  return head.startsWith('痛点雷达/');
}

/** token 路径（` · ` 前）是否属于任务 1 **现有表格** 分域（`现有表格/表名`） */
export function isTask2L1ExistingSpreadsheetFeatureRow(f: Task2L1TaskGraphFeatureRow): boolean {
  const raw = String(f.tokenDisplay ?? '').trim();
  if (!raw) return false;
  const head = raw.includes('·') ? (raw.split(/\s*·\s*/)[0]?.trim() ?? raw) : raw;
  return head.startsWith('现有表格/');
}

function task2L1PainPointRadarFeatureSortRank(f: Task2L1TaskGraphFeatureRow): { tier: number; tail: string } {
  const raw = String(f.tokenDisplay ?? '').trim();
  const head = raw.includes('·') ? (raw.split(/\s*·\s*/)[0]?.trim() ?? raw) : raw;
  const seg = head.startsWith('痛点雷达/') ? head.slice('痛点雷达/'.length) : head;
  if (seg === '核心痛点总结') {
    return { tier: 0, tail: String(f.featureId ?? '') };
  }
  for (let i = 0; i < TASK2_L1_PAIN_POINT_RADAR_SEGMENT_ORDER.length; i += 1) {
    const label = TASK2_L1_PAIN_POINT_RADAR_SEGMENT_ORDER[i]!;
    if (label === '核心痛点总结') continue;
    if (seg === label || seg.startsWith(`${label}/`) || seg.startsWith(label)) {
      return { tier: i, tail: seg };
    }
  }
  return { tier: TASK2_L1_PAIN_POINT_RADAR_SEGMENT_ORDER.length, tail: seg || String(f.featureId ?? '') };
}

/** Input 2：**痛点雷达/**（含核心痛点总结）置顶，其余保持原序 */
export function orderTask2L1Input2FeaturesForReverseValidation(
  remainder: Task2L1TaskGraphFeatureRow[],
): Task2L1TaskGraphFeatureRow[] {
  const pain: Task2L1TaskGraphFeatureRow[] = [];
  const rest: Task2L1TaskGraphFeatureRow[] = [];
  for (const f of remainder) {
    if (isTask2L1PainPointRadarFeatureRow(f)) pain.push(f);
    else rest.push(f);
  }
  pain.sort((a, b) => {
    const ra = task2L1PainPointRadarFeatureSortRank(a);
    const rb = task2L1PainPointRadarFeatureSortRank(b);
    if (ra.tier !== rb.tier) return ra.tier - rb.tier;
    return ra.tail.localeCompare(rb.tail, 'zh-CN');
  });
  return [...pain, ...rest];
}

/** Input 2 中须写入 `Token_Validation_Mapping` 的痛点雷达行（供落库前补全） */
export function listTask2L1PainPointRadarInput2FeatureRows(
  features: Task2L1TaskGraphFeatureRow[],
): Task2L1TaskGraphFeatureRow[] {
  const { remainder } = partitionTask2L1InferenceFeatures(features);
  return orderTask2L1Input2FeaturesForReverseValidation(remainder).filter(isTask2L1PainPointRadarFeatureRow);
}

/** 供大模型 **user** 消息的完整文本（不截断）；深访/纠偏缺省时为 `（暂无）` */
export function buildTask2L1InferenceUserBlock(
  features: Task2L1TaskGraphFeatureRow[],
  deepInsightText?: string,
  userRectificationText?: string,
): string {
  const { basic, orgTopology, management, remainder } = partitionTask2L1InferenceFeatures(features);
  const input2Ordered = orderTask2L1Input2FeaturesForReverseValidation(remainder);
  const input2Pain = input2Ordered.filter(isTask2L1PainPointRadarFeatureRow);
  const input2Existing = input2Ordered.filter(
    (f) => !isTask2L1PainPointRadarFeatureRow(f) && isTask2L1ExistingSpreadsheetFeatureRow(f),
  );
  const input2Other = input2Ordered.filter(
    (f) => !isTask2L1PainPointRadarFeatureRow(f) && !isTask2L1ExistingSpreadsheetFeatureRow(f),
  );
  const painPointInput2Count = input2Pain.length;
  const input2ExistingCount = input2Existing.length;
  const input2OtherCount = input2Other.length;
  const input2TotalCount = input2OtherCount + painPointInput2Count + input2ExistingCount;
  const l0Features = [...basic, ...orgTopology, ...management];
  const insightRaw = String(deepInsightText ?? '').replace(/\r\n/g, '\n').trim();
  const insightBody = insightRaw || '（暂无）';
  const rectRaw = String(userRectificationText ?? '').replace(/\r\n/g, '\n').trim();
  const rectBody = rectRaw || '（暂无）';
  const input2All = [...input2Other, ...input2Pain, ...input2Existing];
  const tsvColHint = input2All.some((f) => String(f.validationStatus ?? '').trim())
    ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status（任务 1 行级印记，须在 Target_KV 无损透传）'
    : '四列：FeatureID、TokenStr、Operator、Value（若图谱已落库 Validation_Status 则自动扩为五列）';

  return `【任务 2 L1 推理输入｜来自设计详情推理图 GET /design-detail/task-graph】
说明：Input 1、Input 2 每一行为一条特征，以制表符（Tab）分隔，${tsvColHint}。

Input 1：L0 基础特征录入（工商基本面 + 组织拓扑「运营模式/人员组织/」+「管理资源/」路径特征）：
${formatFeatureTsvLines(l0Features)}

Input 2：任务 1 **原始实然特征集**全集（★对撞、Validation_Status 透传与数据化石 TVM 的唯一事实底座；**Token_Validation_Mapping.Target_FeatureID 仅能取自下列 TSV 第一列**）：
★ **全量审查**：\`Token_Validation_Mapping\` 须覆盖 Input 2 **全部**特征行（共 **${input2TotalCount}** 条），其中痛点/雷达类 **${painPointInput2Count}** 条、\`现有表格/\` 化石 **${input2ExistingCount}** 条；化石行 **Validation_Status=Resolved_By_Customer** 时须 **Consistency=已通过纠偏修正** 且 **interview_question=N/A**。

Input 2.2 ★【任务 1 新生成的痛点雷达/核心痛点总结】（token 以 \`痛点雷达/\` 开头，含 **\`${TASK2_L1_PAIN_POINT_RADAR_CORE_SUMMARY_TOKEN}\`**）：
${formatFeatureTsvLines(input2Pain)}

Input 2.3 ★【客户现行各业务域 Excel 账本/系统表单名称及具体字段清单】（token 严格为 \`现有表格/表格名称\` 格式）：
${formatFeatureTsvLines(input2Existing)}

Input 2.1 基础实然现状/业务流程特征：
${formatFeatureTsvLines(input2Other)}

Input 3：深访洞察（非结构化纯文本）：
${insightBody}

Input 4：用户纠偏输入（非结构化纯文本，最高优先级）：
${rectBody}`;
}

const DEFAULT_PROGRESS_INPUT_CAP = 100_000;

/** 进度行内单元格：去换行/制表符，避免与外层 ` → ` 混淆 */
function sanitizeProgressDebugCell(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t\n\r]/g, ' ')
    .replace(/→/g, '➜')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatProgressDebugSection(sectionTitleSuffix: string, features: Task2L1TaskGraphFeatureRow[]): string {
  const lines: string[] = [];
  lines.push(`【调试】→ ${sectionTitleSuffix}`);
  lines.push('【调试】｜→ FeatureID → TokenStr → Operator → value');
  if (!features.length) {
    lines.push('【调试】｜→（无）');
  } else {
    for (const f of features) {
      const id = sanitizeProgressDebugCell(String(f.featureId ?? ''));
      const tok = sanitizeProgressDebugCell(String(f.tokenDisplay ?? ''));
      const op = sanitizeProgressDebugCell(String(f.operator ?? ''));
      const val = sanitizeProgressDebugCell(String(f.name ?? ''));
      lines.push(`【调试】｜→ ${id} → ${tok} → ${op} → ${val}`);
    }
  }
  return lines.join('\n');
}

/**
 * 任务进展区推送的输入列表展示（与送大模型的 TSV `buildTask2L1InferenceUserBlock` 分离）。
 * 格式：每类先标题行 + 列说明行 + 若干 `【调试】｜→` 数据行；类与类之间仅空行分隔。
 */
export function buildTask2L1InferenceProgressDebugText(features: Task2L1TaskGraphFeatureRow[]): string {
  if (!TASK2_L1_PROGRESS_DEBUG_UI_ENABLED) return '';
  const { basic, orgTopology, management, remainder } = partitionTask2L1InferenceFeatures(features);
  return [
    formatProgressDebugSection('工商基础 Feature 列表组装', basic),
    formatProgressDebugSection('组织拓扑 Feature 列表组装', orgTopology),
    formatProgressDebugSection('管理资源 Feature 列表组装', management),
    formatProgressDebugSection('需求提炼及其它分域 Feature 列表组装', remainder),
  ].join('\n\n');
}

/**
 * **Target_KV** 同步成功（token / 特征 / 逻辑边落库）后，在任务动态卡上逐行推送与送模前同源分区的 **Evidence 输入** 列表，便于对照 `Evidence_Support_Chain`；**不含** `remainder`（需求及其它分域），与产品指定三段一致。
 */
export function buildTask2PostSyncEvidenceInputDebugLines(features: Task2L1TaskGraphFeatureRow[]): string[] {
  if (!TASK2_L1_PROGRESS_DEBUG_UI_ENABLED) return [];
  const { basic, orgTopology, management } = partitionTask2L1InferenceFeatures(features);
  const lines: string[] = [];
  lines.push('【调试】【任务 2】→ 开始提炼推理逻辑链条；');
  const sections: Array<{ title: string; rows: Task2L1TaskGraphFeatureRow[] }> = [
    { title: '工商基础Feature列表', rows: basic },
    { title: '组织拓扑Feature列表', rows: orgTopology },
    { title: '管理资源Feature列表', rows: management },
  ];
  for (const s of sections) {
    lines.push(`【调试】【任务 2】→ 打印输入「${s.title}」；`);
    if (!s.rows.length) {
      lines.push('【调试】【任务 2】｜（无）');
    } else {
      for (const f of s.rows) {
        lines.push(`【调试】【任务 2】｜${formatFeatureTsvLines([f])}`);
      }
    }
  }
  return lines;
}

/** 任务进展灰块展示用，避免极长输入卡死 UI */
export function truncateTask2L1InferenceBlockForProgress(body: string, maxLen = DEFAULT_PROGRESS_INPUT_CAP): string {
  const s = String(body ?? '');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}\n\n…（以下已截断；大模型侧仍使用完整 TSV 输入）`;
}
