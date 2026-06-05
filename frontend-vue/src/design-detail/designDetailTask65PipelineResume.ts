/**
 * [INPUT]: `ProblemCase.id`、子任务 index / 已完成 raw 输出
 * [OUTPUT]: 任务 6.5 子任务对齐等待期间的 pipeline 续跑快照
 * [POS]: 深访问卷展示后暂停；用户回复后从同一子任务继续而非整卡重跑
 */

const STORAGE_KEY_PREFIX = 'smart_cto_design_detail_task65_pipeline_resume_v1:';

export type Task65PipelineResumeState = {
  stepIndex: number;
  perStepRawOutputs: string[];
  progressLabel: string;
  epochAtStart: number;
};

export function readTask65PipelineResume(caseId: string): Task65PipelineResumeState | null {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Task65PipelineResumeState>;
    const stepIndex = Number(parsed.stepIndex);
    if (!Number.isFinite(stepIndex) || stepIndex < 0) return null;
    const perStepRawOutputs = Array.isArray(parsed.perStepRawOutputs)
      ? parsed.perStepRawOutputs.map((x) => String(x ?? ''))
      : [];
    const progressLabel = String(parsed.progressLabel ?? '').trim();
    const epochAtStart = Number(parsed.epochAtStart);
    if (!progressLabel || !Number.isFinite(epochAtStart)) return null;
    return { stepIndex, perStepRawOutputs, progressLabel, epochAtStart };
  } catch {
    return null;
  }
}

export function writeTask65PipelineResume(caseId: string, state: Task65PipelineResumeState): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function clearTask65PipelineResume(caseId: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  } catch {
    /* ignore */
  }
}
