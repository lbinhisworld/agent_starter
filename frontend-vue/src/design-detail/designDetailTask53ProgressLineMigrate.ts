/**
 * [INPUT]: 任务 5.3 动态卡历史进度行 `full` 文案
 * [OUTPUT]: 迁移为「流程环节功能理解」口径；供工作区 hydrate 与 kickoff 判定
 * [POS]: 更名前持久化的 L3.3 整批推理进度行刷新后展示与门闩一致
 *
 * [PROTOCOL]: 与 `runTask53WorkflowFlowPipeline.ts` 进度常量保持语义一致
 */

import { task53ProcessUnderstandingProgressLine } from './buildTask53WorkflowFlowInferenceInputFromTaskGraph';

/** 与 `runTask53WorkflowFlowPipeline` 中 TASK53_START_LINE 一致 */
export const TASK53_PROGRESS_START_LINE =
  '→ 开始进行流程环节功能理解（按任务 1 运营模式业务流程逐条推理）';

const LEGACY_TASK53_PILL = '任务 5.3：跨业务能力单元关键场景时序流转串联';
const NEW_TASK53_PILL = '任务 5.3：流程环节功能理解';

export function stripTask53ProcessProgressLineDecorations(full: string): string {
  return String(full ?? '')
    .replace(/\s*✅\s*$/u, '')
    .replace(/\s*✔️?\s*$/u, '')
    .trim();
}

export function isTask53ProcessProgressLineForProcess(full: string, processName: string): boolean {
  const prefix = task53ProcessUnderstandingProgressLine(processName);
  const bare = stripTask53ProcessProgressLineDecorations(full);
  return bare === prefix || bare.startsWith(`${prefix} `);
}

/** 将更名前的进度行文案迁移为新口径；无法映射的旧「整批 LLM 转圈」行返回空串（调用方应剔除） */
export function migrateTask53ProgressLineFull(full: string): string {
  let s = stripTask53ProcessProgressLineDecorations(full);
  if (!s) return s;
  if (s.includes(LEGACY_TASK53_PILL)) {
    s = s.split(LEGACY_TASK53_PILL).join(NEW_TASK53_PILL);
  }
  if (s.includes('→ 开始进行 L3.3 关键工作流拓扑编排推理')) {
    return TASK53_PROGRESS_START_LINE;
  }
  if (
    s.includes('→ 正在进行 L3.3 关键工作流拓扑编排推理') ||
    s === '→ 正在进行 L3.3 关键工作流拓扑编排推理（大模型，最长约 5 分钟）'
  ) {
    return '';
  }
  if (
    s.startsWith('→ 流程理解：') ||
    s.startsWith('→ 理解环节链：') ||
    s.startsWith('→ 形成如下正向归纳链接：') ||
    s === '→ 大模型返回 json'
  ) {
    return stripTask53ProcessProgressLineDecorations(s);
  }
  return s;
}

/** 是否已进入 5.3 流水线（含历史 L3.3 口径） */
export function task53ProgressIndicatesPipelineKickoff(full: string): boolean {
  const s = String(full ?? '');
  return (
    s.includes(TASK53_PROGRESS_START_LINE) ||
    s.includes('开始进行流程环节功能理解') ||
    s.includes('流程理解：') ||
    s.includes('开始进行 L3.3') ||
    s.includes('正在进行 L3.3') ||
    s.includes('任务 5.3 Target_KV') ||
    s.includes('任务 5.3 推理') ||
    s.includes('全部业务流程理解完成') ||
    s.includes('→ 理解环节链：') ||
    s.includes('→ 大模型返回 json')
  );
}
