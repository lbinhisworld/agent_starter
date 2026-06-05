/**
 * [INPUT]: `SmartCto.problemCaseApi`（online）、`APP_CONFIG.MODE`、`localStorage`
 * [OUTPUT]: 设计详情「任务进展」工作区快照的序列化/解析、指纹、本地/远端读写
 * [POS]: `useDesignDetailChat` 持久化与恢复专用
 *
 * [PROTOCOL]: 快照字段增减时递增 `DESIGN_DETAIL_PROGRESS_SNAPSHOT_V` 并同步 `useDesignDetailChat`、`design_mode_ux.md`；**`DynamicsCardLineTaskId`** 与 **`designModeTaskPipeline.DESIGN_MODE_LINE_TASK_ORDER`** 对齐（含任务 7 **`key_requirement_scenarios`**）；无法识别的动态卡**跳过**勿导致整表解析失败；`customerRequirementCanvasEntries[].distillOrdinal` 可选；`mergedRequirementActiveSubTabKey` 缺省回退 `businessContext`；动态卡可选 `displayDurationSec`；动态卡进度行可选 `revealRate`/`revealDebt`；对齐问卷 / 推理灰色子区行 kind 须与 `useDesignDetailChat` / `DesignTaskDynamicsCard` 一致；**`mergeDynamicsCardsPreferRicherProgress`** 须与 **`designDetailFeatureInferenceConclusionProgress.scoreInferenceConclusionProgressRichness`** 对齐
 */

import {
  DESIGN_MODE_LINE_TASK_ORDER,
  type DesignDetailLineTaskId,
} from './designModeTaskPipeline';
import type { DesignDetailCustomerRequirementPhase } from './designDetailCustomerRequirementPhase';
import { resolveAlignmentUserFeedbackLineKindAfterHydrate } from './designDetailAlignmentInferenceDiff';
import { normalizeTokenValidationMappingProgressLineKind } from './designDetailTask2L1SyncUiProgress';
import {
  isFeatureInferenceConclusionPushInProgress,
  scoreInferenceConclusionProgressRichness,
  type InferenceConclusionProgressLineLike,
} from './designDetailFeatureInferenceConclusionProgress';

/** 与 `useDesignDetailChat` 中同名类型同构，避免模块循环依赖 */
export type DesignCanvasTabKind =
  | 'case_overview'
  | 'customer_basic'
  | 'requirement_distill'
  | 'current_state_understanding'
  | 'diagnostic_review'
  | 'architecture_inventory';

export type DesignCanvasTab = {
  id: string;
  label: string;
  kind: DesignCanvasTabKind;
};

export type CustomerBasicCanvasRow = {
  field: string;
  label: string;
  value: string;
};

export type CustomerRequirementCanvasEntry = {
  id: string;
  isoTimestamp: string;
  titleTimeLabel: string;
  /** 与聊天 `task1LlmQueryBlock.task1RequirementDistillOrdinal` 对齐；旧快照可缺省 */
  distillOrdinal?: number;
  parsed: Record<string, unknown>;
  activeSubTabKey: string;
};

export const DESIGN_DETAIL_PROGRESS_SNAPSHOT_V = 1;

/** 左栏「进展 / 聊天」Tab 与滚动位置（写入 `DesignDetailProgressWorkspace.payload`） */
export type DesignDetailLeftPanelUiSnapshot = {
  chatPanelMode?: 'progress' | 'chat';
  scrollProgress?: number;
  scrollChat?: number;
};

const LOCAL_STORAGE_KEY_PREFIX = 'smart_cto_dd_progress_ws_v1:';

export type MessagesFingerprint = {
  len: number;
  lastId: string;
};

export function buildMessagesFingerprint(messages: ReadonlyArray<Record<string, unknown>>): MessagesFingerprint {
  const len = messages.length;
  if (len === 0) return { len: 0, lastId: '' };
  const last = messages[len - 1] as { id?: unknown };
  const lastId = typeof last?.id === 'string' && last.id.trim() ? last.id.trim() : '';
  return { len, lastId };
}

/** 统计动态卡进度行总数（hydrate / flush 防退化用） */
export function countDynamicsSnapshotLines(
  cards: ReadonlyArray<{ lines?: ReadonlyArray<unknown> }> | undefined,
): number {
  if (!cards?.length) return 0;
  return cards.reduce((n, c) => n + (Array.isArray(c.lines) ? c.lines.length : 0), 0);
}

export function messagesFingerprintsEqual(a: MessagesFingerprint, b: MessagesFingerprint): boolean {
  return a.len === b.len && a.lastId === b.lastId;
}

type ProgressLineKind =
  | 'default'
  | 'scope_green'
  | 'user_quote'
  | 'bmc_generating'
  | 'bmc_result_quote'
  | 'token_validation_mapping_quote'
  | 'task2_alignment_questionnaire_sub'
  | 'task3_alignment_questionnaire_sub'
  | 'task4_alignment_questionnaire_sub'
  | 'task5_alignment_questionnaire_sub'
  | 'task55_alignment_questionnaire_sub'
  | 'task6_alignment_questionnaire_sub'
  | 'task65_alignment_questionnaire_sub'
  | 'task7_alignment_questionnaire_sub'
  | 'task8_alignment_questionnaire_sub'
  | 'task85_alignment_questionnaire_sub'
  | 'task9_alignment_questionnaire_sub'
  | 'task3_inference_sub'
  | 'task4_inference_sub'
  | 'task5_inference_sub'
  | 'task51_inference_sub'
  | 'task55_inference_sub'
  | 'task6_inference_sub'
  | 'task65_inference_sub'
  | 'task7_inference_sub'
  | 'task8_inference_sub'
  /** 深访对齐重跑后：逐条「修改项目 / 修改前 → 修改后」 */
  | 'alignment_diff_sub'
  /** 深访对齐：用户反馈原文子行 */
  | 'alignment_user_feedback_sub'
  | 'requirement_supplement_prompt'
  /** 调试：任务完成后门闩，点「继续」再进入下一阶段 */
  | 'debug_step_continue_prompt'
  | 'inference_conclusion_sub';

export type AlignmentDiffSnapshot = {
  field: string;
  before: string;
  after: string;
};

/** 与 `useDesignDetailChat` 内 DynamicsCardModel / ProgressLineModel 同构，用于 JSON 往返 */
/** 与 `useDesignDetailChat` 内 `DynamicsCardModel.lineTaskId` 一致（全设计线步，不含 `all_done`） */
export type DynamicsCardLineTaskId = Exclude<DesignDetailLineTaskId, 'all_done'>;

function isDynamicsCardLineTaskId(x: unknown): x is DynamicsCardLineTaskId {
  return typeof x === 'string' && (DESIGN_MODE_LINE_TASK_ORDER as readonly string[]).includes(x);
}

/** 与 `useDesignDetailChat` 中 `TASK2_L1_ENTITY_LLM_WORKING_LINE` 一致 */
const TASK2_L1_ENTITY_LLM_WORKING_LINE = '→ 正在推理规模与组织模式（大模型）';
const TASK0_SYNC_SPINNER_LINE = '→ 正在将工具原语落库至推理图（任务 0）…';

type ProgressLineMergeHint = {
  kind?: string;
  full?: string;
  bmcGenUi?: string;
};

function progressLineIsTask2LlmWorkingSpinner(line: ProgressLineMergeHint): boolean {
  return (
    line.kind === 'bmc_generating' &&
    line.full === TASK2_L1_ENTITY_LLM_WORKING_LINE &&
    line.bmcGenUi === 'spinner'
  );
}

function cardHasTask2LlmWorkingSpinner(card: { lineTaskId: string; lines: unknown[] }): boolean {
  if (card.lineTaskId !== 'scale_org_mode_extract') return false;
  const lines = card.lines as ProgressLineMergeHint[];
  return Array.isArray(lines) && lines.some(progressLineIsTask2LlmWorkingSpinner);
}

function progressLineIsTask0SyncSpinner(line: ProgressLineMergeHint): boolean {
  return (
    line.kind === 'bmc_generating' &&
    line.full === TASK0_SYNC_SPINNER_LINE &&
    line.bmcGenUi === 'spinner'
  );
}

function cardHasTask0SyncSpinner(card: { lineTaskId: string; lines: unknown[] }): boolean {
  if (card.lineTaskId !== 'optional_toolbox_primitive') return false;
  const lines = card.lines as ProgressLineMergeHint[];
  return Array.isArray(lines) && lines.some(progressLineIsTask0SyncSpinner);
}

function inferenceLinesOf(card: { lines: unknown[] }): InferenceConclusionProgressLineLike[] {
  return card.lines as InferenceConclusionProgressLineLike[];
}

/** 同线步两张动态卡：行数优先，行数相同时保留推理结论 reveal 进度更高的一方 */
function pickRicherDynamicsCard<T extends { lines: unknown[] }>(liveCard: T, snapCard: T): T {
  const liveLines = liveCard.lines?.length ?? 0;
  const snapLines = snapCard.lines?.length ?? 0;
  const liveInf = scoreInferenceConclusionProgressRichness(inferenceLinesOf(liveCard));
  const snapInf = scoreInferenceConclusionProgressRichness(inferenceLinesOf(snapCard));

  if (isFeatureInferenceConclusionPushInProgress(inferenceLinesOf(liveCard))) {
    if (snapInf <= liveInf || snapLines <= liveLines) {
      return liveCard;
    }
  }

  if (liveLines !== snapLines) {
    return liveLines >= snapLines ? liveCard : snapCard;
  }
  return liveInf >= snapInf ? liveCard : snapCard;
}

/**
 * 按线步合并动态卡：同卡保留行数更多的一方，避免 hydrate 用旧快照吞掉 TVM 门禁/问卷行。
 * 行数相同时比较 `inference_conclusion_sub` 的 cursor 累计分，避免快照 cursor 归零导致结论「擦除再推送」。
 * 任务 2：若远端快照仍含「正在推理…（大模型）」转圈行而本地已去掉（LLM 已返回），**强制保留本地**，避免 LLM 日志已落库但进度区仍转圈。
 */
export function mergeDynamicsCardsPreferRicherProgress<T extends { lineTaskId: string; lines: unknown[] }>(
  liveCards: readonly T[],
  snapCards: readonly T[],
): T[] {
  const snapByLine = new Map(snapCards.map((c) => [c.lineTaskId, c]));
  const seen = new Set<string>();
  const out: T[] = [];
  for (const liveCard of liveCards) {
    seen.add(liveCard.lineTaskId);
    const snapCard = snapByLine.get(liveCard.lineTaskId);
    if (!snapCard) {
      out.push(liveCard);
      continue;
    }
    if (
      liveCard.lineTaskId === 'scale_org_mode_extract' &&
      cardHasTask2LlmWorkingSpinner(snapCard) &&
      !cardHasTask2LlmWorkingSpinner(liveCard)
    ) {
      out.push(liveCard);
      continue;
    }
    if (
      liveCard.lineTaskId === 'optional_toolbox_primitive' &&
      cardHasTask0SyncSpinner(snapCard) &&
      !cardHasTask0SyncSpinner(liveCard)
    ) {
      out.push(liveCard);
      continue;
    }
    out.push(pickRicherDynamicsCard(liveCard, snapCard));
  }
  for (const snapCard of snapCards) {
    if (!seen.has(snapCard.lineTaskId)) out.push(snapCard);
  }
  return out;
}

export type DynamicsCardSnapshot = {
  key: string;
  lineTaskId: DynamicsCardLineTaskId;
  status: 'running' | 'completed';
  startedAtMs: number;
  completedAtMs: number | null;
  lines: Array<{
    id: number;
    full: string;
    cursor: number;
    kind: ProgressLineKind;
    bmcGenUi?: 'spinner' | 'check';
    spinnerBlue?: boolean;
    /** 与 `useDesignDetailChat` 进度 ticker：`revealRate`≠1 时 `revealDebt` 为小数累加器 */
    revealRate?: number;
    revealDebt?: number;
    alignmentDiff?: AlignmentDiffSnapshot;
    inferenceFeatureId?: string;
  }>;
  extraTailConsumed: number;
  completionQueued: boolean;
  thanksAppended: boolean;
  lastDesignBmcHydratedKey?: string;
  /** 与 `useDesignDetailChat` 中 `DynamicsCardModel.displayDurationSec` 一致；缺省则角标用墙钟差 */
  displayDurationSec?: number | null;
};

export type DesignDetailProgressSnapshotV1 = {
  v: typeof DESIGN_DETAIL_PROGRESS_SNAPSHOT_V;
  messagesFingerprint: MessagesFingerprint;
  currentDesignLineTaskId: DesignDetailLineTaskId;
  designOnlyProgressTail: string[];
  dynamicsCards: DynamicsCardSnapshot[];
  task1CustomerRequirementPhase: DesignDetailCustomerRequirementPhase;
  designCanvasTabs: DesignCanvasTab[];
  activeDesignCanvasTabId: string;
  customerBasicCanvasRows: CustomerBasicCanvasRow[];
  customerRequirementCanvasEntries: CustomerRequirementCanvasEntry[];
  /** 「合并需求」根卡片当前子 Tab（与 `useDesignDetailChat` 中 `CUSTOMER_REQUIREMENT_CANVAS_FIELDS[].key` 对齐） */
  mergedRequirementActiveSubTabKey: string;
  /** 用户点「继续补充 → 否」后写入的合并结果；缺省则「合并需求」卡用聊天条目浅合并 */
  mergedRequirementParsedOverride: Record<string, unknown> | null;
  designDynamicsSuppressPersistedReplay: boolean;
  llmStatsIncludeFromMessageIndex: number;
  lastProgressTailFingerprint: string;
  chatDraft: string;
  /** 左栏 Tab 与双视图滚动位置；缺省则进展 Tab、滚动 0 */
  leftPanelUi?: DesignDetailLeftPanelUiSnapshot;
  /** 任务 5.1 模型原文，供「现状理解」画布 hydrate */
  task51L3MatrixRawOutput?: string;
  /** 任务 6.5 各环节 IT-Gap 诊断子卡（按 progressLabel 覆盖） */
  task65DiagnosticReviewSteps?: Array<Record<string, unknown>>;
};

function isProgressLineKind(x: unknown): x is ProgressLineKind {
  return (
    x === 'default' ||
    x === 'scope_green' ||
    x === 'user_quote' ||
    x === 'bmc_generating' ||
    x === 'bmc_result_quote' ||
    x === 'token_validation_mapping_quote' ||
    x === 'task2_alignment_questionnaire_sub' ||
    x === 'task3_alignment_questionnaire_sub' ||
    x === 'task4_alignment_questionnaire_sub' ||
    x === 'task5_alignment_questionnaire_sub' ||
    x === 'task55_alignment_questionnaire_sub' ||
    x === 'task6_alignment_questionnaire_sub' ||
    x === 'task65_alignment_questionnaire_sub' ||
    x === 'task7_alignment_questionnaire_sub' ||
    x === 'task8_alignment_questionnaire_sub' ||
    x === 'task85_alignment_questionnaire_sub' ||
    x === 'task9_alignment_questionnaire_sub' ||
    x === 'task3_inference_sub' ||
    x === 'task4_inference_sub' ||
    x === 'task5_inference_sub' ||
    x === 'task51_inference_sub' ||
    x === 'task55_inference_sub' ||
    x === 'task6_inference_sub' ||
    x === 'task65_inference_sub' ||
    x === 'task7_inference_sub' ||
    x === 'task8_inference_sub' ||
    x === 'alignment_diff_sub' ||
    x === 'alignment_user_feedback_sub' ||
    x === 'requirement_supplement_prompt' ||
    x === 'debug_step_continue_prompt' ||
    x === 'inference_conclusion_sub'
  );
}

function parseLeftPanelUiSnapshot(raw: unknown): DesignDetailLeftPanelUiSnapshot | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: DesignDetailLeftPanelUiSnapshot = {};
  const mode = o.chatPanelMode;
  if (mode === 'progress' || mode === 'chat') out.chatPanelMode = mode;
  const sp = o.scrollProgress;
  if (typeof sp === 'number' && Number.isFinite(sp) && sp >= 0) {
    out.scrollProgress = Math.floor(sp);
  }
  const sc = o.scrollChat;
  if (typeof sc === 'number' && Number.isFinite(sc) && sc >= 0) {
    out.scrollChat = Math.floor(sc);
  }
  if (out.chatPanelMode == null && out.scrollProgress == null && out.scrollChat == null) {
    return undefined;
  }
  return out;
}

function parseAlignmentDiffSnapshot(raw: unknown): AlignmentDiffSnapshot | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const field = typeof o.field === 'string' ? o.field.trim() : '';
  const before = typeof o.before === 'string' ? o.before : String(o.before ?? '');
  const after = typeof o.after === 'string' ? o.after : String(o.after ?? '');
  if (!field) return undefined;
  return { field, before, after };
}

function parseDynamicsCard(raw: unknown): DynamicsCardSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const lid = o.lineTaskId;
  if (!isDynamicsCardLineTaskId(lid)) return null;
  if (o.status !== 'running' && o.status !== 'completed') return null;
  if (typeof o.key !== 'string' || typeof o.startedAtMs !== 'number') return null;
  const linesRaw = o.lines;
  if (!Array.isArray(linesRaw)) return null;
  const lines: DynamicsCardSnapshot['lines'] = [];
  const linesRawParsed: Array<{ kind?: string; full?: string }> = [];
  for (const lr of linesRaw) {
    if (!lr || typeof lr !== 'object' || Array.isArray(lr)) return null;
    const r = lr as Record<string, unknown>;
    if (typeof r.id !== 'number' || typeof r.full !== 'string' || typeof r.cursor !== 'number') return null;
    linesRawParsed.push({
      kind: isProgressLineKind(r.kind) ? r.kind : undefined,
      full: r.full,
    });
  }
  for (let li = 0; li < linesRaw.length; li++) {
    const lr = linesRaw[li]!;
    const r = lr as Record<string, unknown>;
    const upgradedKind = resolveAlignmentUserFeedbackLineKindAfterHydrate(linesRawParsed, li);
    const kindNorm = normalizeTokenValidationMappingProgressLineKind(
      upgradedKind ?? (isProgressLineKind(r.kind) ? r.kind : undefined),
      r.full,
    );
    if (!isProgressLineKind(kindNorm)) return null;
    const row: DynamicsCardSnapshot['lines'][number] = {
      id: r.id as number,
      full: r.full as string,
      cursor: r.cursor as number,
      kind: kindNorm as ProgressLineKind,
    };
    if (r.bmcGenUi === 'spinner' || r.bmcGenUi === 'check') row.bmcGenUi = r.bmcGenUi;
    if (r.spinnerBlue === true) row.spinnerBlue = true;
    const rr = r.revealRate;
    if (typeof rr === 'number' && Number.isFinite(rr) && rr > 0 && rr !== 1) row.revealRate = rr;
    const rd = r.revealDebt;
    if (typeof rd === 'number' && Number.isFinite(rd) && rd >= 0 && rd < 1e6) row.revealDebt = rd;
    const ad = parseAlignmentDiffSnapshot(r.alignmentDiff);
    if (ad) row.alignmentDiff = ad;
    const ifid = r.inferenceFeatureId;
    if (typeof ifid === 'string' && ifid.trim()) row.inferenceFeatureId = ifid.trim();
    lines.push(row);
  }
  const completedAtMs =
    o.completedAtMs === null || o.completedAtMs === undefined
      ? null
      : typeof o.completedAtMs === 'number'
        ? o.completedAtMs
        : null;
  const card: DynamicsCardSnapshot = {
    key: o.key,
    lineTaskId: lid,
    status: o.status,
    startedAtMs: o.startedAtMs,
    completedAtMs,
    lines,
    extraTailConsumed: typeof o.extraTailConsumed === 'number' ? o.extraTailConsumed : 0,
    completionQueued: Boolean(o.completionQueued),
    thanksAppended: Boolean(o.thanksAppended),
  };
  if (typeof o.lastDesignBmcHydratedKey === 'string' && o.lastDesignBmcHydratedKey.trim()) {
    card.lastDesignBmcHydratedKey = o.lastDesignBmcHydratedKey.trim();
  }
  const dds = o.displayDurationSec;
  if (typeof dds === 'number' && Number.isFinite(dds) && dds >= 0 && dds < 864000) {
    card.displayDurationSec = Math.floor(dds);
  }
  return card;
}

function isDesignDetailLineTaskId(x: unknown): x is DesignDetailLineTaskId {
  if (x === 'all_done') return true;
  return typeof x === 'string' && (DESIGN_MODE_LINE_TASK_ORDER as readonly string[]).includes(x);
}

const REQ_PHASES: ReadonlySet<string> = new Set(['idle', 'awaiting', 'completed', 'paused']);

function isCustomerRequirementPhase(x: unknown): x is DesignDetailCustomerRequirementPhase {
  return typeof x === 'string' && REQ_PHASES.has(x);
}

function parseCanvasTab(raw: unknown): DesignCanvasTab | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  const label = typeof o.label === 'string' ? o.label : '';
  let kind = o.kind;
  let tabId = id;
  let tabLabel = label;
  if (kind === 'data_architecture' || tabId === 'data_architecture') {
    kind = 'architecture_inventory';
    tabId = tabId === 'data_architecture' ? 'architecture_inventory' : tabId;
    if (tabLabel === '数据架构') tabLabel = '架构清单';
  }
  if (
    kind !== 'case_overview' &&
    kind !== 'customer_basic' &&
    kind !== 'requirement_distill' &&
    kind !== 'current_state_understanding' &&
    kind !== 'diagnostic_review' &&
    kind !== 'architecture_inventory'
  ) {
    return null;
  }
  if (!tabId || !tabLabel) return null;
  return { id: tabId, label: tabLabel, kind };
}

function parseCustomerBasicRow(raw: unknown): CustomerBasicCanvasRow | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.field !== 'string' || typeof o.label !== 'string' || typeof o.value !== 'string') return null;
  return { field: o.field, label: o.label, value: o.value };
}

function parseRequirementEntry(raw: unknown): CustomerRequirementCanvasEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.isoTimestamp !== 'string') return null;
  if (typeof o.titleTimeLabel !== 'string' || typeof o.activeSubTabKey !== 'string') return null;
  if (!o.parsed || typeof o.parsed !== 'object' || Array.isArray(o.parsed)) return null;
  const ordRaw = o.distillOrdinal;
  const ordNum = typeof ordRaw === 'number' ? ordRaw : Number(ordRaw);
  const distillOrdinal =
    Number.isFinite(ordNum) && ordNum >= 1 ? Math.floor(ordNum) : undefined;
  return {
    id: o.id,
    isoTimestamp: o.isoTimestamp,
    titleTimeLabel: o.titleTimeLabel,
    ...(distillOrdinal != null ? { distillOrdinal } : {}),
    parsed: o.parsed as Record<string, unknown>,
    activeSubTabKey: o.activeSubTabKey,
  };
}

/** 将 API / localStorage 中的未知 JSON 解析为 v1 快照；失败返回 null */
export function parseDesignDetailProgressSnapshot(raw: unknown): DesignDetailProgressSnapshotV1 | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== DESIGN_DETAIL_PROGRESS_SNAPSHOT_V) return null;
  const mf = o.messagesFingerprint;
  if (!mf || typeof mf !== 'object' || Array.isArray(mf)) return null;
  const mfo = mf as Record<string, unknown>;
  if (typeof mfo.len !== 'number' || typeof mfo.lastId !== 'string') return null;
  if (!isDesignDetailLineTaskId(o.currentDesignLineTaskId)) return null;
  if (!Array.isArray(o.designOnlyProgressTail)) return null;
  const tail = o.designOnlyProgressTail.map((x) => String(x ?? ''));
  if (!Array.isArray(o.dynamicsCards)) return null;
  const cards: DynamicsCardSnapshot[] = [];
  for (const c of o.dynamicsCards) {
    const pc = parseDynamicsCard(c);
    if (!pc) {
      try {
        const badId = (c as Record<string, unknown>)?.lineTaskId;
        console.warn('[design-detail:progress-ws] skip_unrecognized_dynamics_card', {
          lineTaskId: badId,
        });
      } catch {
        /* ignore */
      }
      continue;
    }
    cards.push(pc);
  }
  if (!isCustomerRequirementPhase(o.task1CustomerRequirementPhase)) return null;
  if (!Array.isArray(o.designCanvasTabs)) return null;
  const tabs: DesignCanvasTab[] = [];
  for (const t of o.designCanvasTabs) {
    const pt = parseCanvasTab(t);
    if (!pt) return null;
    tabs.push(pt);
  }
  const activeDesignCanvasTabId =
    typeof o.activeDesignCanvasTabId === 'string' ? o.activeDesignCanvasTabId : 'case_overview';
  if (!Array.isArray(o.customerBasicCanvasRows)) return null;
  const basicRows: CustomerBasicCanvasRow[] = [];
  for (const r of o.customerBasicCanvasRows) {
    const pr = parseCustomerBasicRow(r);
    if (!pr) return null;
    basicRows.push(pr);
  }
  if (!Array.isArray(o.customerRequirementCanvasEntries)) return null;
  const reqEntries: CustomerRequirementCanvasEntry[] = [];
  for (const e of o.customerRequirementCanvasEntries) {
    const pe = parseRequirementEntry(e);
    if (!pe) return null;
    reqEntries.push(pe);
  }
  const mergedTabRaw = o.mergedRequirementActiveSubTabKey;
  const mergedRequirementActiveSubTabKey =
    typeof mergedTabRaw === 'string' && mergedTabRaw.trim() ? mergedTabRaw.trim() : 'businessContext';
  let mergedRequirementParsedOverride: Record<string, unknown> | null = null;
  const mor = o.mergedRequirementParsedOverride;
  if (mor != null && typeof mor === 'object' && !Array.isArray(mor)) {
    try {
      mergedRequirementParsedOverride = JSON.parse(JSON.stringify(mor)) as Record<string, unknown>;
    } catch {
      mergedRequirementParsedOverride = null;
    }
  }
  return {
    v: DESIGN_DETAIL_PROGRESS_SNAPSHOT_V,
    messagesFingerprint: { len: mfo.len, lastId: mfo.lastId },
    currentDesignLineTaskId: o.currentDesignLineTaskId,
    designOnlyProgressTail: tail,
    dynamicsCards: cards,
    task1CustomerRequirementPhase: o.task1CustomerRequirementPhase,
    designCanvasTabs: tabs,
    activeDesignCanvasTabId,
    customerBasicCanvasRows: basicRows,
    customerRequirementCanvasEntries: reqEntries,
    mergedRequirementActiveSubTabKey,
    mergedRequirementParsedOverride,
    designDynamicsSuppressPersistedReplay: Boolean(o.designDynamicsSuppressPersistedReplay),
    llmStatsIncludeFromMessageIndex:
      typeof o.llmStatsIncludeFromMessageIndex === 'number' ? Math.max(0, Math.floor(o.llmStatsIncludeFromMessageIndex)) : 0,
    lastProgressTailFingerprint:
      typeof o.lastProgressTailFingerprint === 'string' ? o.lastProgressTailFingerprint : '',
    chatDraft: typeof o.chatDraft === 'string' ? o.chatDraft : '',
    leftPanelUi: parseLeftPanelUiSnapshot(o.leftPanelUi),
    ...(typeof o.task51L3MatrixRawOutput === 'string' && o.task51L3MatrixRawOutput.trim()
      ? { task51L3MatrixRawOutput: String(o.task51L3MatrixRawOutput) }
      : {}),
    ...(Array.isArray(o.task65DiagnosticReviewSteps)
      ? {
          task65DiagnosticReviewSteps: o.task65DiagnosticReviewSteps.filter(
            (x) => x != null && typeof x === 'object' && !Array.isArray(x),
          ) as Array<Record<string, unknown>>,
        }
      : {}),
  };
}

export function buildDesignDetailProgressSnapshotV1(
  input: Omit<DesignDetailProgressSnapshotV1, 'v'>,
): unknown {
  return { ...input, v: DESIGN_DETAIL_PROGRESS_SNAPSHOT_V };
}

function isOnlineMode(): boolean {
  return String((window as unknown as { APP_CONFIG?: { MODE?: string } }).APP_CONFIG?.MODE || '').toLowerCase() === 'online';
}

export type DesignDetailProgressWorkspacePersistResult = {
  ok: boolean;
  persistedRemote: boolean;
  persistedLocal: boolean;
  remoteStatus?: number;
};

/** 在线模式亦写入 localStorage，供登录超时 / 远端 PUT 失败时 hydrate 恢复 */
export function readLocalDesignDetailProgressWorkspacePayload(caseId: string): unknown | null {
  const cid = String(caseId || '').trim();
  if (!cid) return null;
  try {
    const raw = window.localStorage?.getItem(LOCAL_STORAGE_KEY_PREFIX + cid);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeLocalDesignDetailProgressWorkspacePayload(caseId: string, payload: unknown): boolean {
  const cid = String(caseId || '').trim();
  if (!cid) return false;
  try {
    window.localStorage?.setItem(LOCAL_STORAGE_KEY_PREFIX + cid, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** 快照指纹与当前聊天一致，或快照为当前聊天消息前缀（新消息后尚未落库） */
export function progressSnapshotMatchesMessages(
  snapFp: MessagesFingerprint,
  msgFp: MessagesFingerprint,
  messages: ReadonlyArray<Record<string, unknown>>,
): boolean {
  if (messagesFingerprintsEqual(snapFp, msgFp)) return true;
  if (snapFp.len > msgFp.len) return false;
  if (snapFp.len === 0) return msgFp.len === 0;
  const idx = snapFp.len - 1;
  const msg = messages[idx] as { id?: unknown } | undefined;
  const id = typeof msg?.id === 'string' && msg.id.trim() ? msg.id.trim() : '';
  return id === snapFp.lastId;
}

type ProgressWorkspaceHydrateCandidate = {
  raw: unknown;
  snap: DesignDetailProgressSnapshotV1;
  score: number;
  fpMatch: boolean;
};

function scoreProgressWorkspaceHydrateCandidate(
  raw: unknown,
  msgFp: MessagesFingerprint,
  messages: ReadonlyArray<Record<string, unknown>>,
): ProgressWorkspaceHydrateCandidate | null {
  const snap = parseDesignDetailProgressSnapshot(raw);
  if (!snap) return null;
  const lines = countDynamicsSnapshotLines(snap.dynamicsCards);
  const fpMatch = progressSnapshotMatchesMessages(snap.messagesFingerprint, msgFp, messages);
  if (!fpMatch && lines === 0) return null;
  if (!fpMatch) return null;
  let score = lines;
  if (fpMatch) score += 1_000_000;
  return { raw, snap, score, fpMatch };
}

/**
 * hydrate 时在远端与本地备份间择优；同指纹时合并更丰富的 dynamicsCards。
 */
export function pickProgressWorkspaceRawForHydrate(
  remoteRaw: unknown | null,
  localRaw: unknown | null,
  msgFp: MessagesFingerprint,
  messages: ReadonlyArray<Record<string, unknown>>,
): unknown | null {
  const candidates = [remoteRaw, localRaw]
    .map((raw) => (raw != null ? scoreProgressWorkspaceHydrateCandidate(raw, msgFp, messages) : null))
    .filter((c): c is ProgressWorkspaceHydrateCandidate => c != null);
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0]!;
  const fpKey = `${best.snap.messagesFingerprint.len}\u0001${best.snap.messagesFingerprint.lastId}`;
  const sameFpPeers = candidates.filter(
    (c) =>
      `${c.snap.messagesFingerprint.len}\u0001${c.snap.messagesFingerprint.lastId}` === fpKey &&
      c.fpMatch,
  );
  if (sameFpPeers.length <= 1) return best.raw;
  let mergedCards = sameFpPeers[0]!.snap.dynamicsCards;
  for (let i = 1; i < sameFpPeers.length; i++) {
    mergedCards = mergeDynamicsCardsPreferRicherProgress(
      mergedCards,
      sameFpPeers[i]!.snap.dynamicsCards,
    ) as DesignDetailProgressSnapshotV1['dynamicsCards'];
  }
  const base = sameFpPeers[0]!.snap;
  return buildDesignDetailProgressSnapshotV1({
    ...base,
    dynamicsCards: mergedCards,
  });
}

/** 仅读远端（flush 防退化对账用） */
export async function fetchRemoteDesignDetailProgressWorkspacePayload(
  caseId: string,
): Promise<unknown | null> {
  const cid = String(caseId || '').trim();
  if (!cid) return null;
  if (isOnlineMode()) {
    const api = (window as unknown as { SmartCto?: { problemCaseApi?: Record<string, unknown> } }).SmartCto
      ?.problemCaseApi;
    const fn = api?.getDesignDetailProgressWorkspace;
    if (typeof fn === 'function') {
      const res = (await (fn as (id: string) => Promise<{ payload?: unknown } | null>)(cid)) as {
        payload?: unknown;
      } | null;
      if (res && res.payload != null) return res.payload;
      return null;
    }
  }
  return readLocalDesignDetailProgressWorkspacePayload(cid);
}

/** @deprecated 语义同 `fetchRemoteDesignDetailProgressWorkspacePayload`（保留旧名供 flush 对账） */
export async function fetchDesignDetailProgressWorkspacePayload(caseId: string): Promise<unknown | null> {
  return fetchRemoteDesignDetailProgressWorkspacePayload(caseId);
}

export async function persistDesignDetailProgressWorkspacePayload(
  caseId: string,
  payload: unknown,
): Promise<DesignDetailProgressWorkspacePersistResult> {
  const cid = String(caseId || '').trim();
  if (!cid) {
    return { ok: false, persistedRemote: false, persistedLocal: false };
  }
  const persistedLocal = writeLocalDesignDetailProgressWorkspacePayload(cid, payload);
  if (isOnlineMode()) {
    const api = (window as unknown as { SmartCto?: { problemCaseApi?: Record<string, unknown> } }).SmartCto
      ?.problemCaseApi;
    const fn = api?.putDesignDetailProgressWorkspace;
    if (typeof fn === 'function') {
      const res = (await (fn as (id: string, body: unknown) => Promise<{ ok?: boolean; status?: number } | void>)(
        cid,
        payload,
      )) as { ok?: boolean; status?: number } | void;
      const persistedRemote = !!(res && typeof res === 'object' && res.ok === true);
      return {
        ok: persistedRemote || persistedLocal,
        persistedRemote,
        persistedLocal,
        remoteStatus: res && typeof res === 'object' ? res.status : undefined,
      };
    }
    return { ok: persistedLocal, persistedRemote: false, persistedLocal };
  }
  return { ok: persistedLocal, persistedRemote: false, persistedLocal };
}

export async function clearDesignDetailProgressWorkspace(caseId: string): Promise<void> {
  const cid = String(caseId || '').trim();
  if (!cid) return;
  if (isOnlineMode()) {
    const api = (window as unknown as { SmartCto?: { problemCaseApi?: Record<string, unknown> } }).SmartCto
      ?.problemCaseApi;
    const fn = api?.deleteDesignDetailProgressWorkspace;
    if (typeof fn === 'function') {
      await (fn as (id: string) => Promise<void>)(cid);
    }
  }
  try {
    window.localStorage?.removeItem(LOCAL_STORAGE_KEY_PREFIX + cid);
  } catch {
    /* ignore */
  }
}
