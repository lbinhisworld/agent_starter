/**
 * [INPUT]: 各任务 `Token_Validation_Mapping` 解析行（`Task2L1TvmParsedRow`）或原始 JSON 记录
 * [OUTPUT]: 全链路通用问卷 Agent 输入（`UniversalConflictRecord` + `buildAlignmentQuestionnaireUserBlock`）
 * [POS]: 任务 2/3/4（及未来 L3~L5）深访闭环「对齐问卷生成」的 user 拼装；与 `task1BusinessInsight.js` 之 `DESIGN_DETAIL_ALIGNMENT_QUESTIONNAIRE_SYSTEM_PROMPT` 对齐
 *
 * [PROTOCOL]: 字段映射表变更时须同步本文件、`designDetailTask2L1SyncUiProgress.ts` 解析器与 `design_mode_promts.md`；**`Target_FeatureID`/`Client_Fact_Token`** 语义为 **任务 1 原始 Feature**，**`Anchor_Model_Feature`** 为当前步推理结论（非中间层节点 id）
 */

import type { Task2L1TvmParsedRow } from './designDetailTask2L1SyncUiProgress';

/** 推理层级：L1/L2 与 L3~L5 原生字段名差异（见产品映射表） */
export type AlignmentQuestionnaireSourceTier = 'L1_L2' | 'L3_L5';

/** 问卷 Agent 通用输入接口（与 System 提示词 # Input Data JSON 一致） */
export type UniversalConflictRecord = {
  Target_FeatureID: string;
  Client_Fact_Token: string;
  Anchor_Model_Feature: string;
  Conflict_Causality_Logic: string;
  Raw_Verification_Pivot: string;
  Consistency: '潜在冲突';
};

/** 单条 TVM 原生字段 → 通用接口（表格式映射） */
export type AlignmentTvmFieldMapping = {
  targetFeatureId: readonly string[];
  clientFactToken: readonly string[];
  anchorModelFeature: readonly string[];
  conflictCausalityLogic: readonly string[];
  rawVerificationPivot: readonly string[];
  consistency: readonly string[];
};

/** L1~L2：Mapped_L1_Feature / Mapped_L2_Feature → Anchor_Model_Feature；Token_Str → Client_Fact_Token */
export const ALIGNMENT_TVM_FIELD_MAPPING_L1_L2: AlignmentTvmFieldMapping = {
  targetFeatureId: ['Target_FeatureID', 'target_feature_id'],
  clientFactToken: ['Token_Str', 'token_str'],
  anchorModelFeature: [
    'Mapped_L1_Feature',
    'mapped_l1_feature',
    'Mapped_L2_Feature',
    'mapped_l2_feature',
  ],
  conflictCausalityLogic: ['Validation_Logic', 'validation_logic'],
  rawVerificationPivot: ['interview_question', 'Interview_Question'],
  consistency: ['Consistency', 'consistency'],
};

/** L3~L5：Mapped_L3_Feature（及 L4/L5 别名）→ Anchor_Model_Feature；Token_Str → Client_Fact_Token */
export const ALIGNMENT_TVM_FIELD_MAPPING_L3_L5: AlignmentTvmFieldMapping = {
  targetFeatureId: ['Target_FeatureID', 'target_feature_id'],
  clientFactToken: ['Token_Str', 'token_str'],
  anchorModelFeature: [
    'Mapped_L3_Feature',
    'mapped_l3_feature',
    'Mapped_L4_Feature',
    'mapped_l4_feature',
    'Mapped_L5_Feature',
    'mapped_l5_feature',
    'Mapped_L2_Feature',
    'mapped_l2_feature',
  ],
  conflictCausalityLogic: ['Validation_Logic', 'validation_logic'],
  rawVerificationPivot: ['interview_question', 'Interview_Question'],
  consistency: ['Consistency', 'consistency'],
};

export function alignmentTvmFieldMappingForTier(tier: AlignmentQuestionnaireSourceTier): AlignmentTvmFieldMapping {
  return tier === 'L1_L2' ? ALIGNMENT_TVM_FIELD_MAPPING_L1_L2 : ALIGNMENT_TVM_FIELD_MAPPING_L3_L5;
}

function pickStringField(rec: Record<string, unknown>, keys: readonly string[]): string {
  for (const k of keys) {
    const v = rec[k];
    if (v !== undefined && v !== null) {
      const s = typeof v === 'string' ? v.trim() : String(v).trim();
      if (s) return s;
    }
  }
  const norm = (key: string) => key.toLowerCase().replace(/\s+/g, '_');
  const lowerToOrig = new Map<string, string>();
  for (const ok of Object.keys(rec)) {
    lowerToOrig.set(norm(ok), ok);
  }
  for (const k of keys) {
    const orig = lowerToOrig.get(norm(k));
    if (orig === undefined) continue;
    const v = rec[orig];
    if (v !== undefined && v !== null) {
      const s = typeof v === 'string' ? v.trim() : String(v).trim();
      if (s) return s;
    }
  }
  return '';
}

/**
 * 自 TVM 原始 JSON 对象映射为通用问卷输入（任意任务层级推理输出均可调用）。
 */
export function mapRawTvmRecordToUniversal(
  rec: Record<string, unknown>,
  tier: AlignmentQuestionnaireSourceTier,
): UniversalConflictRecord | null {
  const mapping = alignmentTvmFieldMappingForTier(tier);
  const targetFeatureId = pickStringField(rec, mapping.targetFeatureId);
  const clientFactToken = pickStringField(rec, mapping.clientFactToken);
  const anchorModelFeature = pickStringField(rec, mapping.anchorModelFeature);
  const conflictCausalityLogic = pickStringField(rec, mapping.conflictCausalityLogic);
  const rawVerificationPivot = pickStringField(rec, mapping.rawVerificationPivot);
  if (!targetFeatureId && !clientFactToken && !anchorModelFeature) return null;
  return {
    Target_FeatureID: targetFeatureId,
    Client_Fact_Token: clientFactToken,
    Anchor_Model_Feature: anchorModelFeature,
    Conflict_Causality_Logic: conflictCausalityLogic,
    Raw_Verification_Pivot: rawVerificationPivot,
    Consistency: '潜在冲突',
  };
}

/**
 * 自已解析的 `Task2L1TvmParsedRow` 映射（兼容历史仅填 `tokenStr` 的解析结果）。
 */
export function mapParsedTvmRowToUniversal(
  row: Task2L1TvmParsedRow,
  _tier: AlignmentQuestionnaireSourceTier,
): UniversalConflictRecord {
  const legacy = String(row.tokenStr ?? '').trim();
  const anchorModelFeature = String(row.anchorModelFeature ?? '').trim() || legacy;
  const clientFactToken =
    String(row.clientFactToken ?? '').trim() ||
    (anchorModelFeature && legacy !== anchorModelFeature ? legacy : '');
  return {
    Target_FeatureID: String(row.targetFeatureId ?? '').trim(),
    Client_Fact_Token: clientFactToken,
    Anchor_Model_Feature: anchorModelFeature,
    Conflict_Causality_Logic: String(row.validationLogic ?? '').trim(),
    Raw_Verification_Pivot: String(row.interviewQuestion ?? '').trim(),
    Consistency: '潜在冲突',
  };
}

export function mapParsedTvmRowsToUniversal(
  rows: Task2L1TvmParsedRow[],
  tier: AlignmentQuestionnaireSourceTier,
): UniversalConflictRecord[] {
  return rows.map((r) => mapParsedTvmRowToUniversal(r, tier));
}

/** 拼入 `generateDesignDetail*AlignmentQuestionnaireFromContext` 的 **user** 文本 */
export function buildAlignmentQuestionnaireUserBlock(
  rows: Task2L1TvmParsedRow[],
  tier: AlignmentQuestionnaireSourceTier,
): string {
  if (!rows.length) {
    return '【Input Data：全链路通用潜在冲突数据集】\n[]';
  }
  const records = mapParsedTvmRowsToUniversal(rows, tier);
  const json = JSON.stringify(records, null, 2);
  return `【Input Data：全链路通用潜在冲突数据集】\n以下为推理引擎在 Consistency == "潜在冲突" 时筛选出的结构化记录（JSON 数组）：\n\`\`\`json\n${json}\n\`\`\``;
}

/** 任务 6.5 子任务 IT-Gap 对齐问卷 user 块：附当前工位与通俗化约束 */
export function buildTask65ItGapAlignmentQuestionnaireUserBlock(
  rows: Task2L1TvmParsedRow[],
  progressLabel: string,
): string {
  const base = buildAlignmentQuestionnaireUserBlock(rows, 'L3_L5');
  const workstation = String(progressLabel || '').trim() || '（未指定工位）';
  return `${base}

【当前工位】${workstation}

【问卷生成补充要求（任务 6.5 IT-Gap 专用）】
- 目标：向客户收集可观察的客观业务事实（数据量级、是否手工、审批层级、分支多少、是否跨部门等），勿写成 IT 选型或架构讨论。
- 禁止出现具体软件/平台/数据库/中间件/组件/Schema/API 等产品或技术名称；勿写 Low-code、中台、微服务、Token、FeatureID 等术语。
- Anchor_Model_Feature / Conflict_Causality_Logic 中的 IT 策略差异，须改写为通俗业务表述，例如「主要靠人工台账汇总」「表单逐条录入并人工核对」「系统自动汇总对账」等。
- 每个问题只确认一种客观情况或二选一决策，避免让客户理解系统内部建模逻辑。
- **问卷模块标题**（🎯 下「1.」「2.」前的名称）：用业务场景命名（如「派工明细怎么记」「对账汇总方式」）；禁止「底座选型」「技术选型」「平台选型」「存储选型」及任何 IT/架构类标题。`;
}
