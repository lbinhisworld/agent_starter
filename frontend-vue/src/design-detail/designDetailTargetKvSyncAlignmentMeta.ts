/**
 * [INPUT]: 各任务 `localStorage` 中的对齐问卷与用户回复
 * [OUTPUT]: `POST …/sync-task*-target-kv-tokens` 请求体中的 `alignmentQuestionnaire` / `alignmentUserReply`
 * [POS]: 设计详情任务 2–10 Target_KV 落库与 `DesignDetailInferenceRevisionRecord` 审计对齐
 */

import {
  readTask2L1AlignmentQuestionnaireText,
  readTask3L2AlignmentQuestionnaireText,
  readTask4L2AlignmentQuestionnaireText,
  readTask5L3AlignmentQuestionnaireText,
  readTask51L3AlignmentQuestionnaireText,
  readTask6L3AlignmentQuestionnaireText,
  readTask55L3AlignmentQuestionnaireText,
  readTask7L4AlignmentQuestionnaireText,
  readTask8L45AlignmentQuestionnaireText,
  readTask85L475AlignmentQuestionnaireText,
  readTask9L5AlignmentQuestionnaireText,
  readTask10L5AlignmentQuestionnaireText,
} from './designDetailTaskAlignmentQuestionnaire';
import { readTask2L1UserRectificationText } from './designDetailTask2L1UserRectification';
import { readTask3L2UserRectificationText } from './designDetailTask3L2UserRectification';
import { readTask4L2UserRectificationText } from './designDetailTask4L2UserRectification';
import { readTask5L3UserRectificationText } from './designDetailTask5L3UserRectification';
import { readTask51L3UserRectificationText } from './designDetailTask51L3UserRectification';
import { readTask6L3UserRectificationText } from './designDetailTask6L3UserRectification';
import { readTask55L3UserRectificationText } from './designDetailTask55L3UserRectification';
import { readTask7L4UserRectificationText } from './designDetailTask7L4UserRectification';
import { readTask8L45UserRectificationText } from './designDetailTask8L45UserRectification';
import { readTask85L475UserRectificationText } from './designDetailTask85L475UserRectification';
import { readTask9L5UserRectificationText } from './designDetailTask9L5UserRectification';
import { readTask10L5UserRectificationText } from './designDetailTask10L5UserRectification';
import { readAlignmentPainPointTargetFeatureIds } from './designDetailAlignmentPainTargets';
import type { DesignDetailLineTaskId } from './designModeTaskPipeline';

export type DesignDetailTargetKvSyncAlignmentMeta = {
  alignmentQuestionnaire?: string;
  alignmentUserReply?: string;
  painPointConfirmedTargetFeatureIds?: string[];
  painPointConfirmingLineStepId?: string;
  /** 对齐冲突 TVM 的 Target_FeatureID：落库前 Mutation 为 Resolved_By_Customer */
  validationStatusResolvedTargetFeatureIds?: string[];
};

function compactMeta(meta: DesignDetailTargetKvSyncAlignmentMeta): DesignDetailTargetKvSyncAlignmentMeta {
  const alignmentQuestionnaire = String(meta.alignmentQuestionnaire ?? '').trim();
  const alignmentUserReply = String(meta.alignmentUserReply ?? '').trim();
  const painIds = (meta.painPointConfirmedTargetFeatureIds ?? [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  const painStep = String(meta.painPointConfirmingLineStepId ?? '').trim();
  const resolvedIds = (meta.validationStatusResolvedTargetFeatureIds ?? [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  const out: DesignDetailTargetKvSyncAlignmentMeta = {};
  if (alignmentQuestionnaire) out.alignmentQuestionnaire = alignmentQuestionnaire;
  if (alignmentUserReply) out.alignmentUserReply = alignmentUserReply;
  if (painIds.length) out.painPointConfirmedTargetFeatureIds = [...new Set(painIds)];
  if (painStep) out.painPointConfirmingLineStepId = painStep;
  if (resolvedIds.length) out.validationStatusResolvedTargetFeatureIds = [...new Set(resolvedIds)];
  return out;
}

function readValidationResolvedTargetFeatureIdsForLine(
  caseId: string,
  lineStepId: DesignDetailLineTaskId,
): string[] {
  return readAlignmentPainPointTargetFeatureIds(caseId, lineStepId);
}

export function buildTask2L1TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'scale_org_mode_extract';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    alignmentQuestionnaire: readTask2L1AlignmentQuestionnaireText(caseId),
    alignmentUserReply: readTask2L1UserRectificationText(caseId),
    painPointConfirmedTargetFeatureIds: resolvedIds,
    painPointConfirmingLineStepId: lineStepId,
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

export function buildTask3L2TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'industry_business_profile_extract';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    alignmentQuestionnaire: readTask3L2AlignmentQuestionnaireText(caseId),
    alignmentUserReply: readTask3L2UserRectificationText(caseId),
    painPointConfirmedTargetFeatureIds: resolvedIds,
    painPointConfirmingLineStepId: lineStepId,
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

export function buildTask4L2TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'core_value_driver_inference';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    alignmentQuestionnaire: readTask4L2AlignmentQuestionnaireText(caseId),
    alignmentUserReply: readTask4L2UserRectificationText(caseId),
    painPointConfirmedTargetFeatureIds: resolvedIds,
    painPointConfirmingLineStepId: lineStepId,
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

export function buildTask5L3TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'macro_process_flow_inference';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    alignmentQuestionnaire: readTask5L3AlignmentQuestionnaireText(caseId),
    alignmentUserReply: readTask5L3UserRectificationText(caseId),
    painPointConfirmedTargetFeatureIds: resolvedIds,
    painPointConfirmingLineStepId: lineStepId,
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

export function buildTask51L3TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'value_proposition_capability_units';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    alignmentQuestionnaire: readTask51L3AlignmentQuestionnaireText(caseId),
    alignmentUserReply: readTask51L3UserRectificationText(caseId),
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

/** 任务 5.2：TVM 多为静默「逻辑一致」；仍透传线步已确认 Target_FeatureID 集合 */
export function buildTask52L3TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'capability_field_set_mapping';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

/** 任务 5.3：TVM 多为静默「逻辑一致」；仍透传线步已确认 Target_FeatureID 集合 */
export function buildTask53L3TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'key_scenario_temporal_flow_inference';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

export function buildTask6L3TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'pain_point_extraction';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    alignmentQuestionnaire: readTask6L3AlignmentQuestionnaireText(caseId),
    alignmentUserReply: readTask6L3UserRectificationText(caseId),
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

export function buildTask65L3TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'three_dimension_itgap_analysis';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

export function buildTask55L3TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'vsm_stage_decomposition';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    alignmentQuestionnaire: readTask55L3AlignmentQuestionnaireText(caseId),
    alignmentUserReply: readTask55L3UserRectificationText(caseId),
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

export function buildTask7L4TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'key_requirement_scenarios';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    alignmentQuestionnaire: readTask7L4AlignmentQuestionnaireText(caseId),
    alignmentUserReply: readTask7L4UserRectificationText(caseId),
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

export function buildTask8L45TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'role_object_stm_inference';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    alignmentQuestionnaire: readTask8L45AlignmentQuestionnaireText(caseId),
    alignmentUserReply: readTask8L45UserRectificationText(caseId),
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

export function buildTask85L475TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'physical_hook_integration_inference';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    alignmentQuestionnaire: readTask85L475AlignmentQuestionnaireText(caseId),
    alignmentUserReply: readTask85L475UserRectificationText(caseId),
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

export function buildTask9L5TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'business_capability_positioning';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    alignmentQuestionnaire: readTask9L5AlignmentQuestionnaireText(caseId),
    alignmentUserReply: readTask9L5UserRectificationText(caseId),
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

export function buildTask10L5TargetKvSyncAlignmentMeta(caseId: string): DesignDetailTargetKvSyncAlignmentMeta {
  const lineStepId = 'process_type_derivation';
  const resolvedIds = readValidationResolvedTargetFeatureIdsForLine(caseId, lineStepId);
  return compactMeta({
    alignmentQuestionnaire: readTask10L5AlignmentQuestionnaireText(caseId),
    alignmentUserReply: readTask10L5UserRectificationText(caseId),
    validationStatusResolvedTargetFeatureIds: resolvedIds,
  });
}

export function mergeTargetKvSyncBodyWithAlignmentMeta(
  body: Record<string, unknown>,
  meta: DesignDetailTargetKvSyncAlignmentMeta,
): Record<string, unknown> {
  const m = compactMeta(meta);
  if (
    !m.alignmentQuestionnaire &&
    !m.alignmentUserReply &&
    !m.painPointConfirmedTargetFeatureIds?.length &&
    !m.painPointConfirmingLineStepId &&
    !m.validationStatusResolvedTargetFeatureIds?.length
  ) {
    return body;
  }
  return { ...body, ...m };
}
