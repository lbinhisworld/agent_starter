/**
 * [INPUT]: 用户顶栏「使用模式 / 调试模式」切换
 * [OUTPUT]: `designDetailExperienceMode` 与进展行可见性判定（`isDesignDetailProgressLineVisibleForExperience`）；`isDesignDetailDeveloperChromeVisible`（调试模式才展示重启/LLM/Tree 与任务进展当前任务标签）
 * [POS]: 设计详情页运行时体验开关；使用模式收紧左栏任务进展（隐藏 LLM 原文、链接构建子进度、反向验证门禁/免疫明细与 token·feature 明细标题，保留深访问卷与推理结论）
 *
 * [PROTOCOL]: 变更过滤规则或存储键时同步 `useDesignDetailChat.ts`、`DesignDetailPage.vue`、`design_mode_ux.md` 与 `AGENTS.md`
 */

import { ref } from 'vue';
import {
  ALIGNMENT_CHANGES_APPLIED_LINE,
  ALIGNMENT_FEEDBACK_RECEIVED_LINE,
} from './designDetailAlignmentInferenceDiff';
import { isTask52TableLlmJsonProgressLine } from './designDetailTask52TableDebugProgress';
import {
  isTask53ProcessLlmJsonProgressLine,
  isTask53ProcessSubtaskDebugChildLine,
} from './designDetailTask53ProcessDebugProgress';

export type DesignDetailExperienceMode = 'usage' | 'debug';

const STORAGE_KEY = 'smart_cto_design_detail_experience_mode_v1';

/** 使用模式下始终展示的进展行 kind（深访问卷子区、对齐 diff 等） */
const USAGE_MODE_ALWAYS_VISIBLE_KINDS = new Set([
  'task2_alignment_questionnaire_sub',
  'task3_alignment_questionnaire_sub',
  'task4_alignment_questionnaire_sub',
  'task5_alignment_questionnaire_sub',
  'task55_alignment_questionnaire_sub',
  'task6_alignment_questionnaire_sub',
  'task65_alignment_questionnaire_sub',
  'task7_alignment_questionnaire_sub',
  'task8_alignment_questionnaire_sub',
  'task85_alignment_questionnaire_sub',
  'task9_alignment_questionnaire_sub',
  'alignment_diff_sub',
  /** 深访对齐：用户提交的反馈原文（使用模式须展示，区别于隐藏的 `user_quote`） */
  'alignment_user_feedback_sub',
  /** Target_KV 落库后的说人话推理结论（使用/调试均展示） */
  'inference_conclusion_sub',
]);

/** 使用模式下隐藏的大模型/链接明细灰块 kind */
const USAGE_MODE_HIDDEN_LLM_QUOTE_KINDS = new Set([
  'user_quote',
  'bmc_result_quote',
  'token_validation_mapping_quote',
]);

/** `default` / `scope_green` 箭头行：链接构建子进度标题（不含问卷引导） */
const USAGE_MODE_LINK_BUILD_SUB_PROGRESS_MARKERS = [
  '开始提炼正向归纳链接',
  '开始提炼反向校验链接',
  '开始提炼反向验证链接',
  '更新 tree 视图',
  'Token_Validation_Mapping',
] as const;

/** 深访问卷交互引导文案（含则保留对应箭头行） */
const USAGE_MODE_ALIGNMENT_GUIDE_MARKERS = ['请在下方回复上述问卷', '深访洞察已写入'] as const;

/** 使用模式下隐藏的反向验证门禁/免疫明细（保留问卷子区与引导行） */
function isReverseValidationGateProgressLine(full: string): boolean {
  if (full.includes('已继承') && full.includes('跳过问卷')) return true;
  if (full.includes('反向验证校验｜')) return true;
  if (full.includes('反向验证校验跳过')) return true;
  if (full.includes('反向验证校验失败')) return true;
  return false;
}

/** 使用模式下隐藏的任务 N token/feature 明细标题行（明细体在 `*_inference_sub` 已隐藏） */
function isTokenFeatureDetailHeaderLine(full: string): boolean {
  if (full.includes('token / feature 明细')) return true;
  return /→\s*任务\s*[\d.]+\s*feature\s*明细/.test(full);
}

/** 使用模式下隐藏的任务 1 需求合并 Tab 子进度 token 统计（历史快照回放） */
function isTask1RequirementMergeTokenStatsLine(full: string): boolean {
  return /｜新增 token \d+ 个，更新 token \d+ 个/.test(full);
}

/** 使用模式下隐藏的落库统计里程碑（如「推理结果已提炼｜token … 特征 … 逻辑边 …」） */
function isInferenceSyncStatsProgressLine(full: string): boolean {
  if (!full.includes('推理结果已提炼')) return false;
  return /token/i.test(full) && /特征/.test(full) && /逻辑边/.test(full);
}

/** 使用模式下隐藏的送模上下文/超时等技术参数行（如「→ 送模上下文约 N 字（任务…条特征；超时约…分钟）」） */
function isLlmContextPayloadStatsProgressLine(full: string): boolean {
  if (full.includes('送模上下文约')) return true;
  return /→\s*送模上下文约/.test(full);
}

/** 使用模式下隐藏的 Target_KV 落库成功里程碑（如「→ 任务 N Target_KV 与逻辑链已写入服务端」） */
function isTargetKvSyncOkProgressLine(full: string): boolean {
  if (/Target_KV\s*与逻辑链已写入服务端/.test(full)) return true;
  if (/Target_KV\s*落库完成（任务/.test(full)) return true;
  return false;
}

/**
 * 使用模式下须保留的用户向任务里程碑（优先于技术明细隐藏规则）。
 * 含任务开篇、大模型进行中、推理逻辑提取与失败提示（不含 Target_KV 落库成功行）。
 */
export function isUsageModeTaskMilestoneProgressLine(full: string): boolean {
  const t = String(full ?? '').trim();
  if (!t.startsWith('→')) return false;
  if (t === ALIGNMENT_FEEDBACK_RECEIVED_LINE || t === ALIGNMENT_CHANGES_APPLIED_LINE) return true;
  if (/^→\s*开始进行/.test(t)) return true;
  if (/^→\s*正在写入任务\s*[\d.]+\s*Target_KV/.test(t)) return true;
  if (/^→\s*正在进行\s*Target_KV\s*落库（任务/.test(t)) return true;
  if (/进行任务\s*[\d.]+\s*推理逻辑提取/.test(t)) return true;
  if (/^→\s*正在进行.*（大模型/.test(t)) return true;
  if (/推理失败/.test(t) || /落库失败/.test(t) || /未收官/.test(t)) return true;
  return false;
}

/** 动态卡内全部行被过滤时，使用模式下的占位说明 */
export function buildUsageModeHiddenProgressPlaceholder(taskTitle: string): string {
  const title = String(taskTitle ?? '').trim() || '本任务';
  return `→ ${title}已完成（使用模式已隐藏技术明细，可切换调试模式查看）`;
}

function readStoredMode(): DesignDetailExperienceMode {
  if (typeof localStorage === 'undefined') return 'usage';
  try {
    const raw = String(localStorage.getItem(STORAGE_KEY) || '').trim();
    if (raw === 'debug' || raw === 'usage') return raw;
  } catch {
    /* ignore */
  }
  return 'usage';
}

/** 顶栏切换绑定；默认「使用模式」 */
export const designDetailExperienceMode = ref<DesignDetailExperienceMode>(readStoredMode());

export function setDesignDetailExperienceMode(mode: DesignDetailExperienceMode): void {
  designDetailExperienceMode.value = mode;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function isDesignDetailDebugExperienceActive(): boolean {
  return designDetailExperienceMode.value === 'debug';
}

export function isDesignDetailUsageExperienceActive(): boolean {
  return designDetailExperienceMode.value === 'usage';
}

/** 调试模式才展示的顶栏/标题栏开发者控件（选择重启、重启当前、LLM、逻辑、Tree、当前任务标签）；「完全重启」使用/调试均可见 */
export function isDesignDetailDeveloperChromeVisible(): boolean {
  return isDesignDetailDebugExperienceActive();
}

function isAlignmentQuestionnaireGuideLine(full: string): boolean {
  return USAGE_MODE_ALIGNMENT_GUIDE_MARKERS.some((m) => full.includes(m));
}

/** 链接构建里程碑箭头行（不含 `Target_KV 落库完成（任务 *）`——该类行在使用模式另条规则隐藏） */
function isLinkBuildSubProgressArrowLine(kind: string, full: string): boolean {
  if (kind !== 'default' && kind !== 'scope_green') return false;
  if (full.includes('请在下方回复')) return false;
  if (isAlignmentQuestionnaireGuideLine(full)) return false;
  return USAGE_MODE_LINK_BUILD_SUB_PROGRESS_MARKERS.some((m) => full.includes(m));
}

/**
 * 使用模式下隐藏任务进展中的调试行、模型原文灰块、链接构建子进度、
 * 保留深访问卷子区、问卷引导、对齐 diff、用户向任务里程碑与推理结论。调试模式全部可见。
 */
export function isDesignDetailProgressLineVisibleForExperience(line: {
  kind?: string | null;
  full?: string | null;
  text?: string | null;
}): boolean {
  if (isDesignDetailDebugExperienceActive()) return true;

  const kind = String(line.kind ?? '').trim();
  const full = String(line.full ?? line.text ?? '').trim();

  if (USAGE_MODE_ALWAYS_VISIBLE_KINDS.has(kind)) return true;
  if (isAlignmentQuestionnaireGuideLine(full)) return true;
  if (isUsageModeTaskMilestoneProgressLine(full)) return true;

  if (kind === 'debug_step_continue_prompt') return false;
  if (full.includes('【调试】')) return false;
  if (kind.endsWith('_inference_sub')) return false;
  if (isTask52TableLlmJsonProgressLine(full, kind)) return false;
  if (isTask53ProcessLlmJsonProgressLine(full, kind)) return false;
  if (isTask53ProcessSubtaskDebugChildLine(full, kind)) return false;

  if (isReverseValidationGateProgressLine(full)) return false;
  if (isTokenFeatureDetailHeaderLine(full)) return false;
  if (isTask1RequirementMergeTokenStatsLine(full)) return false;

  if (isInferenceSyncStatsProgressLine(full)) return false;
  if (isLlmContextPayloadStatsProgressLine(full)) return false;
  if (isTargetKvSyncOkProgressLine(full)) return false;

  if (USAGE_MODE_HIDDEN_LLM_QUOTE_KINDS.has(kind)) return false;
  if (isLinkBuildSubProgressArrowLine(kind, full)) return false;

  return true;
}
