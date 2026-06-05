import { randomUUID } from 'crypto';
import { DESIGN_DETAIL_TASK_GRAPH_ORDER, getDesignDetailTaskGraphCardTitle } from './design-detail-task-graph-catalog';
import {
  CaseLlmLogAppendInput,
  CaseLlmLogListRow,
  CreateProblemCaseInput,
  ProblemCase,
  ProblemCaseMessage,
  ProblemCaseMessagePatch,
  ProblemCaseRepository,
  type DesignDetailTaskGraphTaskDto,
  UpdateProblemCaseInput,
} from './types';

export class InMemoryProblemCaseRepository implements ProblemCaseRepository {
  private readonly items = new Map<string, ProblemCase>();
  private readonly messages = new Map<string, ProblemCaseMessage[]>();
  private readonly designDetailProgressWorkspaces = new Map<string, unknown>();
  /** 案例级 LLM 日志（新在前，与 Prisma `orderBy createdAt desc` 一致） */
  private readonly llmLogsByCase = new Map<string, CaseLlmLogListRow[]>();

  async list(): Promise<ProblemCase[]> {
    return Array.from(this.items.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<ProblemCase | null> {
    return this.items.get(id) || null;
  }

  async create(input: CreateProblemCaseInput): Promise<ProblemCase> {
    const timestamp = new Date().toISOString();
    const ownerKey = `${input.ownerSubjectType ?? ''}\0${input.ownerSubjectId ?? ''}`;
    let maxArchive = 0;
    for (const it of this.items.values()) {
      const k = `${it.ownerSubjectType ?? ''}\0${it.ownerSubjectId ?? ''}`;
      if (k !== ownerKey) continue;
      const n = Number(it.archiveNo);
      if (Number.isFinite(n) && n > maxArchive) maxArchive = n;
    }
    const item: ProblemCase = {
      id: input.id || `problem_${randomUUID().slice(0, 8)}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      ownerSubjectId: input.ownerSubjectId,
      ownerSubjectType: input.ownerSubjectType,
      ownerUsernameSnapshot: input.ownerUsernameSnapshot,
      archiveNo: maxArchive + 1,
      customerName: input.customerName,
      customerNeedsOrChallenges: input.customerNeedsOrChallenges,
      customerItStatus: input.customerItStatus,
      projectTimeRequirement: input.projectTimeRequirement,
      requirementDetail: input.requirementDetail,
      requirementDetailHistory: input.requirementDetailHistory,
      operationModel: input.operationModel,
      businessStatus: input.businessStatus,
      urgencyAnalysis: input.urgencyAnalysis,
      preliminaryReq: input.preliminaryReq,
      task1PendingPreliminaryRequirement: input.task1PendingPreliminaryRequirement,
      task1InitialLlmQuery: input.task1InitialLlmQuery,
      currentMajorStage: 0,
      currentItStrategySubstep: 0,
      completedStages: [],
      workflowAlignCompletedStages: [],
      itGapCompletedStages: [],
      completedTaskIds: [],
    };

    this.items.set(item.id, item);
    this.messages.set(item.id, []);
    return item;
  }

  async update(id: string, updates: UpdateProblemCaseInput): Promise<ProblemCase | null> {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) payload[key] = value;
    }
    // 与 Prisma 仓库一致：无字段可写时视为 no-op，不修改 updatedAt
    if (Object.keys(payload).length === 0) {
      const existing = this.items.get(id);
      return existing ? { ...existing } : null;
    }

    const existing = this.items.get(id);
    if (!existing) return null;

    const { archiveNo: _dropArchive, ...restPayload } = payload as Record<string, unknown>;
    const next: ProblemCase = {
      ...existing,
      ...(restPayload as UpdateProblemCaseInput),
      id: existing.id,
      createdAt: existing.createdAt,
      archiveNo: existing.archiveNo,
      updatedAt: new Date().toISOString(),
    };

    this.items.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    this.messages.delete(id);
    this.designDetailProgressWorkspaces.delete(id);
    this.llmLogsByCase.delete(id);
    return this.items.delete(id);
  }

  async getMessages(caseId: string): Promise<ProblemCaseMessage[]> {
    return this.messages.get(caseId) || [];
  }

  async appendMessage(caseId: string, message: ProblemCaseMessage): Promise<ProblemCaseMessage> {
    if (!this.items.has(caseId)) {
      return message;
    }
    const current = this.messages.get(caseId) || [];
    const next = [...current, message].sort((a, b) => {
      const at = Date.parse(a.timestamp);
      const bt = Date.parse(b.timestamp);
      if (!Number.isFinite(at) || !Number.isFinite(bt)) return 0;
      return at - bt;
    });
    this.messages.set(caseId, next);
    return message;
  }

  async replaceMessages(caseId: string, messages: ProblemCaseMessage[]): Promise<ProblemCaseMessage[]> {
    if (!this.items.has(caseId)) {
      return [];
    }

    this.messages.set(caseId, messages);
    return messages;
  }

  async updateMessage(
    caseId: string,
    messageId: string,
    patch: ProblemCaseMessagePatch,
  ): Promise<ProblemCaseMessage | null> {
    if (!this.items.has(caseId)) return null;
    const current = this.messages.get(caseId) || [];
    const idx = current.findIndex((m) => m.id === messageId);
    if (idx < 0) return null;

    const prev = current[idx] as ProblemCaseMessage;
    const nextMsg: ProblemCaseMessage = {
      ...prev,
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      ...(patch.confirmed !== undefined ? { confirmed: patch.confirmed } : {}),
      ...(patch.payloadJson !== undefined ? { payloadJson: patch.payloadJson as any } : {}),
      ...(patch.timestamp !== undefined ? { timestamp: new Date(patch.timestamp).toISOString() } : {}),
      ...(patch.taskId !== undefined ? { taskId: patch.taskId ?? undefined } : {}),
      ...(patch.taskName !== undefined ? { taskName: patch.taskName ?? undefined } : {}),
      ...(patch.type !== undefined ? { type: patch.type ?? undefined } : {}),
      ...(patch.role !== undefined ? { role: patch.role ?? undefined } : {}),
    };

    const next = [...current];
    next[idx] = nextMsg;
    next.sort((a, b) => {
      const at = Date.parse(a.timestamp);
      const bt = Date.parse(b.timestamp);
      if (!Number.isFinite(at) || !Number.isFinite(bt)) return 0;
      return at - bt;
    });
    this.messages.set(caseId, next);
    return nextMsg;
  }

  async deleteMessage(caseId: string, messageId: string): Promise<boolean> {
    if (!this.items.has(caseId)) return false;
    const current = this.messages.get(caseId) || [];
    const next = current.filter((m) => m.id !== messageId);
    if (next.length === current.length) return false;
    this.messages.set(caseId, next);
    return true;
  }

  async getDesignDetailProgressWorkspace(caseId: string): Promise<unknown | null> {
    if (!this.items.has(caseId)) return null;
    return this.designDetailProgressWorkspaces.has(caseId)
      ? this.designDetailProgressWorkspaces.get(caseId) ?? null
      : null;
  }

  async upsertDesignDetailProgressWorkspace(caseId: string, payload: unknown): Promise<void> {
    if (!this.items.has(caseId)) return;
    this.designDetailProgressWorkspaces.set(caseId, payload);
  }

  async deleteDesignDetailProgressWorkspace(caseId: string): Promise<void> {
    this.designDetailProgressWorkspaces.delete(caseId);
  }

  async replaceDesignDetailTask1BasicInfoGraph(
    _caseId: string,
    _basicInfo: unknown,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    return { tokenCount: 0, featureCount: 0, linkCount: 0 };
  }

  async replaceTask1L1OriginalFeatureMatrixGraph(
    _caseId: string,
    rows: ReadonlyArray<{ featureId: string }>,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    const n = Array.isArray(rows) ? rows.length : 0;
    return { tokenCount: n, featureCount: n, linkCount: 0 };
  }

  async replaceTask2L1TargetKvFeatureKeyTokens(
    _caseId: string,
    rows: ReadonlyArray<{ featureKey: string }>,
    _tokenValidationPlans?: ReadonlyArray<unknown>,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    const n = Array.isArray(rows) ? rows.filter((r) => String(r?.featureKey || '').trim()).length : 0;
    return {
      tokenCount: n,
      featureCount: n,
      linkCount: 0,
    };
  }

  async replaceTask3L2TargetKvFeatureKeyTokens(
    _caseId: string,
    rows: ReadonlyArray<{ featureKey: string }>,
    _tokenValidationPlans?: ReadonlyArray<unknown>,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    const n = Array.isArray(rows) ? rows.filter((r) => String(r?.featureKey || '').trim()).length : 0;
    return {
      tokenCount: n,
      featureCount: n,
      linkCount: 0,
    };
  }

  async replaceTask4L2TargetKvFeatureKeyTokens(
    _caseId: string,
    rows: ReadonlyArray<{ featureKey: string }>,
    _tokenValidationPlans?: ReadonlyArray<unknown>,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    const n = Array.isArray(rows) ? rows.filter((r) => String(r?.featureKey || '').trim()).length : 0;
    return {
      tokenCount: n,
      featureCount: n,
      linkCount: 0,
    };
  }

  async replaceTask0ToolboxPrimitiveFeatures(
    _caseId: string,
    primitives: ReadonlyArray<{ featureKey: string; value: string; tokenDisplay?: string; toolName?: string; operator?: string }>,
  ): Promise<{
    tokenCount: number;
    featureCount: number;
    linkCount: number;
    features: Array<{
      featureId: string;
      featureKey: string;
      tokenDisplay: string;
      toolName: string;
      value: string;
      operator: string;
    }>;
  }> {
    const list = primitives.filter((p) => String(p?.featureKey || '').trim() && String(p?.value || '').trim());
    const features = list.map((p, i) => ({
      featureId: `ft_${String(i + 1).padStart(12, '0')}`,
      featureKey: String(p.featureKey || '').trim(),
      tokenDisplay: String(p.tokenDisplay || p.featureKey || '').trim(),
      toolName: String(p.toolName || '').trim(),
      value: String(p.value || '').trim(),
      operator: String(p.operator || '工具原语').trim() || '工具原语',
    }));
    return { tokenCount: features.length, featureCount: features.length, linkCount: 0, features };
  }

  async replaceTask5L3TargetKvFeatureKeyTokens(
    _caseId: string,
    rows: ReadonlyArray<{ featureKey: string }>,
    _tokenValidationPlans?: ReadonlyArray<unknown>,
    _scope?: { graphTaskId?: string; tokenDbTaskIds?: readonly string[] },
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    const n = Array.isArray(rows) ? rows.filter((r) => String(r?.featureKey || '').trim()).length : 0;
    return {
      tokenCount: n,
      featureCount: n,
      linkCount: 0,
    };
  }

  async replaceCustomerRequirementSectionGraph(
    _caseId: string,
    _sectionKey: string,
    _sectionLabelZh: string,
    _requirementParsed: unknown,
  ): Promise<{ tokenCount: number; featureCount: number; linkCount: number }> {
    return { tokenCount: 0, featureCount: 0, linkCount: 0 };
  }

  async getDesignDetailTaskGraphDetail(_caseId: string): Promise<DesignDetailTaskGraphTaskDto[]> {
    return DESIGN_DETAIL_TASK_GRAPH_ORDER.map((taskId) => ({
      taskId,
      title: getDesignDetailTaskGraphCardTitle(taskId),
      tokenCount: 0,
      featureCount: 0,
      linkCount: 0,
      tokens: [],
      features: [],
      links: [],
    }));
  }

  async deleteDesignDetailTaskGraph(_caseId: string, _taskId: string): Promise<void> {
    /* no-op */
  }

  async appendCaseLlmLog(caseId: string, row: CaseLlmLogAppendInput): Promise<void> {
    const id = `llm_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const createdAt = new Date().toISOString();
    const listRow: CaseLlmLogListRow = {
      id,
      caseId,
      taskId: row.taskId,
      callTarget: row.callTarget,
      inputTokens: row.inputTokens ?? null,
      outputTokens: row.outputTokens ?? null,
      durationMs: row.durationMs,
      createdAt,
    };
    const list = this.llmLogsByCase.get(caseId) ?? [];
    list.unshift(listRow);
    this.llmLogsByCase.set(caseId, list);
  }

  async listCaseLlmLogsForCase(caseId: string): Promise<CaseLlmLogListRow[]> {
    return [...(this.llmLogsByCase.get(caseId) ?? [])];
  }

  async deleteCaseLlmLogsByTaskIds(caseId: string, taskIds: string[]): Promise<number> {
    const idSet = new Set((taskIds || []).map((t) => String(t || '').trim()).filter(Boolean));
    if (idSet.size === 0) return 0;
    const list = this.llmLogsByCase.get(caseId) ?? [];
    const next = list.filter((r) => !idSet.has(r.taskId));
    const removed = list.length - next.length;
    this.llmLogsByCase.set(caseId, next);
    return removed;
  }

  async deleteAllCaseLlmLogs(caseId: string): Promise<number> {
    const list = this.llmLogsByCase.get(caseId) ?? [];
    const n = list.length;
    this.llmLogsByCase.set(caseId, []);
    return n;
  }

  async deleteAllDesignDetailTaskGraph(_caseId: string): Promise<void> {
    /* no-op：内存仓储无推理图持久 */
  }

  async markDesignDetailTask1PainPointConfirmed(
    _caseId: string,
    _targetFeatureIds: readonly string[],
    _lineStepId: string,
  ): Promise<number> {
    return 0;
  }

  async markDesignDetailTask1ValidationResolvedByCustomer(
    _caseId: string,
    _targetFeatureIds: readonly string[],
  ): Promise<number> {
    return 0;
  }

  async resetDesignDetailTask1PainPointConfirmed(
    _caseId: string,
    _scope: { kind: 'all' } | { kind: 'line_steps'; lineStepIds: readonly string[] },
  ): Promise<number> {
    return 0;
  }

  async deleteDesignDetailInferenceRevisionRecords(
    _caseId: string,
    _dbTaskIds: readonly string[],
  ): Promise<number> {
    return 0;
  }

  async replaceDesignDetailInferenceRevisionRecords(
    _caseId: string,
    _taskId: string,
    rows: ReadonlyArray<unknown>,
  ): Promise<{ syncSeq: number; recordCount: number }> {
    return { syncSeq: 1, recordCount: Array.isArray(rows) ? rows.length : 0 };
  }
}
