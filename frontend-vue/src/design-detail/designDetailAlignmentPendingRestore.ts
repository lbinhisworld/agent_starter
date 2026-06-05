/**
 * [INPUT]: 动态卡行、`localStorage` 问卷与冲突块、痛点 target feature ids
 * [OUTPUT]: hydrate / 发送前恢复 `task*AlignmentPending` 内存态；判定是否仍待用户回复
 * [POS]: `useDesignDetailChat` 深访问卷回复路由与 task1 BMC 误路由门控
 *
 * [PROTOCOL]: 变更问卷 guide/synth 行常量或 pending 结构时同步 `useDesignDetailChat.ts` 与 `design_mode_ux.md`
 */

import { ALIGNMENT_FEEDBACK_RECEIVED_LINE } from './designDetailAlignmentInferenceDiff';
import {
  readAlignmentPainPointTargetFeatureIds,
  type AlignmentDynamicsLineTaskId,
} from './designDetailAlignmentPainTargets';
import type { DesignDetailLineTaskId } from './designModeTaskPipeline';
import {
  readTask10L5AlignmentConflictBlock,
  readTask10L5AlignmentQuestionnaireText,
  readTask2L1AlignmentConflictBlock,
  readTask2L1AlignmentQuestionnaireText,
  readTask3L2AlignmentConflictBlock,
  readTask3L2AlignmentQuestionnaireText,
  readTask4L2AlignmentConflictBlock,
  readTask4L2AlignmentQuestionnaireText,
  readTask55L3AlignmentConflictBlock,
  readTask55L3AlignmentQuestionnaireText,
  readTask51L3AlignmentConflictBlock,
  readTask51L3AlignmentQuestionnaireText,
  readTask5L3AlignmentConflictBlock,
  readTask5L3AlignmentQuestionnaireText,
  readTask6L3AlignmentConflictBlock,
  readTask6L3AlignmentQuestionnaireText,
  readTask65L3AlignmentConflictBlock,
  readTask65L3AlignmentQuestionnaireText,
  readTask7L4AlignmentConflictBlock,
  readTask7L4AlignmentQuestionnaireText,
  readTask8L45AlignmentConflictBlock,
  readTask8L45AlignmentQuestionnaireText,
  readTask85L475AlignmentConflictBlock,
  readTask85L475AlignmentQuestionnaireText,
  readTask9L5AlignmentConflictBlock,
  readTask9L5AlignmentQuestionnaireText,
} from './designDetailTaskAlignmentQuestionnaire';

export type DesignDetailAlignmentPendingRestoreState = {
  caseId: string;
  conflictDatasetUserBlock: string;
  questionnaireMarkdown: string;
  painPointTargetFeatureIds: string[];
};

type AlignmentCardLine = { full: string; kind?: string };
type AlignmentDynamicsCard = { lineTaskId: string; lines: ReadonlyArray<AlignmentCardLine> };

export type AlignmentPendingRestoreSpec = {
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>;
  guideLine: string;
  synthDoneLine: string;
  readQuestionnaire: (caseId: string) => string;
  readConflictBlock: (caseId: string) => string;
};

/** 进度卡已展示问卷引导且尚未收到用户反馈 / 深访合成 */
export function isDynamicsCardAwaitingAlignmentReply(
  card: AlignmentDynamicsCard | undefined,
  guideLine: string,
  synthDoneLine: string,
): boolean {
  if (!card?.lines?.length) return false;
  const hasGuide = card.lines.some((l) => l.full === guideLine);
  if (!hasGuide) return false;
  const replied = card.lines.some(
    (l) =>
      l.kind === 'alignment_user_feedback_sub' ||
      l.full === synthDoneLine ||
      l.full === ALIGNMENT_FEEDBACK_RECEIVED_LINE,
  );
  return !replied;
}

export function resolveAlignmentPendingFromPersisted(
  caseId: string,
  cards: ReadonlyArray<AlignmentDynamicsCard>,
  spec: AlignmentPendingRestoreSpec,
): DesignDetailAlignmentPendingRestoreState | null {
  const rawId = String(caseId || '').trim();
  if (!rawId) return null;
  const card = cards.find((c) => c.lineTaskId === spec.lineTaskId);
  if (!isDynamicsCardAwaitingAlignmentReply(card, spec.guideLine, spec.synthDoneLine)) {
    return null;
  }
  const questionnaireMarkdown = spec.readQuestionnaire(rawId);
  if (!questionnaireMarkdown) return null;
  return {
    caseId: rawId,
    conflictDatasetUserBlock: spec.readConflictBlock(rawId),
    questionnaireMarkdown,
    painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
      rawId,
      spec.lineTaskId as AlignmentDynamicsLineTaskId,
    ),
  };
}

/** 与 `useDesignDetailChat` 中 guide/synth 常量一一对应（由调用方注入行文案后注册） */
export function buildAlignmentPendingRestoreSpecs(
  lines: {
    task2Guide: string;
    task2Synth: string;
    task3Guide: string;
    task3Synth: string;
    task4Guide: string;
    task4Synth: string;
    task5Guide: string;
    task5Synth: string;
    task51Guide: string;
    task51Synth: string;
    task55Guide: string;
    task55Synth: string;
    task6Guide: string;
    task6Synth: string;
    task65Guide: string;
    task65Synth: string;
    task7Guide: string;
    task7Synth: string;
    task8Guide: string;
    task8Synth: string;
    task85Guide: string;
    task85Synth: string;
    task9Guide: string;
    task9Synth: string;
    task10Guide: string;
    task10Synth: string;
  },
): AlignmentPendingRestoreSpec[] {
  return [
    {
      lineTaskId: 'scale_org_mode_extract',
      guideLine: lines.task2Guide,
      synthDoneLine: lines.task2Synth,
      readQuestionnaire: readTask2L1AlignmentQuestionnaireText,
      readConflictBlock: readTask2L1AlignmentConflictBlock,
    },
    {
      lineTaskId: 'industry_business_profile_extract',
      guideLine: lines.task3Guide,
      synthDoneLine: lines.task3Synth,
      readQuestionnaire: readTask3L2AlignmentQuestionnaireText,
      readConflictBlock: readTask3L2AlignmentConflictBlock,
    },
    {
      lineTaskId: 'core_value_driver_inference',
      guideLine: lines.task4Guide,
      synthDoneLine: lines.task4Synth,
      readQuestionnaire: readTask4L2AlignmentQuestionnaireText,
      readConflictBlock: readTask4L2AlignmentConflictBlock,
    },
    {
      lineTaskId: 'macro_process_flow_inference',
      guideLine: lines.task5Guide,
      synthDoneLine: lines.task5Synth,
      readQuestionnaire: readTask5L3AlignmentQuestionnaireText,
      readConflictBlock: readTask5L3AlignmentConflictBlock,
    },
    {
      lineTaskId: 'value_proposition_capability_units',
      guideLine: lines.task51Guide,
      synthDoneLine: lines.task51Synth,
      readQuestionnaire: readTask51L3AlignmentQuestionnaireText,
      readConflictBlock: readTask51L3AlignmentConflictBlock,
    },
    {
      lineTaskId: 'vsm_stage_decomposition',
      guideLine: lines.task55Guide,
      synthDoneLine: lines.task55Synth,
      readQuestionnaire: readTask55L3AlignmentQuestionnaireText,
      readConflictBlock: readTask55L3AlignmentConflictBlock,
    },
    {
      lineTaskId: 'pain_point_extraction',
      guideLine: lines.task6Guide,
      synthDoneLine: lines.task6Synth,
      readQuestionnaire: readTask6L3AlignmentQuestionnaireText,
      readConflictBlock: readTask6L3AlignmentConflictBlock,
    },
    {
      lineTaskId: 'three_dimension_itgap_analysis',
      guideLine: lines.task65Guide,
      synthDoneLine: lines.task65Synth,
      readQuestionnaire: readTask65L3AlignmentQuestionnaireText,
      readConflictBlock: readTask65L3AlignmentConflictBlock,
    },
    {
      lineTaskId: 'key_requirement_scenarios',
      guideLine: lines.task7Guide,
      synthDoneLine: lines.task7Synth,
      readQuestionnaire: readTask7L4AlignmentQuestionnaireText,
      readConflictBlock: readTask7L4AlignmentConflictBlock,
    },
    {
      lineTaskId: 'role_object_stm_inference',
      guideLine: lines.task8Guide,
      synthDoneLine: lines.task8Synth,
      readQuestionnaire: readTask8L45AlignmentQuestionnaireText,
      readConflictBlock: readTask8L45AlignmentConflictBlock,
    },
    {
      lineTaskId: 'physical_hook_integration_inference',
      guideLine: lines.task85Guide,
      synthDoneLine: lines.task85Synth,
      readQuestionnaire: readTask85L475AlignmentQuestionnaireText,
      readConflictBlock: readTask85L475AlignmentConflictBlock,
    },
    {
      lineTaskId: 'business_capability_positioning',
      guideLine: lines.task9Guide,
      synthDoneLine: lines.task9Synth,
      readQuestionnaire: readTask9L5AlignmentQuestionnaireText,
      readConflictBlock: readTask9L5AlignmentConflictBlock,
    },
    {
      lineTaskId: 'process_type_derivation',
      guideLine: lines.task10Guide,
      synthDoneLine: lines.task10Synth,
      readQuestionnaire: readTask10L5AlignmentQuestionnaireText,
      readConflictBlock: readTask10L5AlignmentConflictBlock,
    },
  ];
}

export function anyDynamicsCardAwaitingAlignmentReply(
  cards: ReadonlyArray<AlignmentDynamicsCard>,
  specs: ReadonlyArray<AlignmentPendingRestoreSpec>,
): boolean {
  return specs.some((spec) => {
    const card = cards.find((c) => c.lineTaskId === spec.lineTaskId);
    return isDynamicsCardAwaitingAlignmentReply(card, spec.guideLine, spec.synthDoneLine);
  });
}
