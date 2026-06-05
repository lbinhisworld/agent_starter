/**
 * [INPUT]: task-graph tasks[]、公司名称、可选用户反馈
 * [OUTPUT]: 设计报告 LLM 轴 user 块（任务 1 / 5 / 5.5 / 9）
 * [POS]: `runDesignReportHybridEngine` LLM 回路
 *
 * [PROTOCOL]: 第四、五章不在此 Prompt 出现
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { pickTask9SystemModuleFeaturesFromGraphTasks } from './buildTask10L5TechnicalDdlInferenceInputFromTaskGraph';
import { pickTask1FeaturesFromGraphTasksForTask10 } from './buildTask10L5TechnicalDdlInferenceInputFromTaskGraph';
import { pickTask5MacroFeaturesFromGraphTasks } from './buildTask5L5VsmInferenceInputFromTaskGraph';
import { pickTask55VsmStageFeaturesFromGraphTasks } from './buildTask6L3ScenarioInferenceInputFromTaskGraph';

function escapeTsvCell(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t\n\r]/g, ' ')
    .trim();
}

function formatFeatureTsvLines(features: Task2L1TaskGraphFeatureRow[]): string {
  if (!features.length) return '（无）';
  return features
    .map((f) => {
      const id = escapeTsvCell(String(f.featureId ?? ''));
      const tok = escapeTsvCell(String(f.tokenDisplay ?? ''));
      const op = escapeTsvCell(String(f.operator ?? ''));
      const val = escapeTsvCell(String(f.name ?? ''));
      return `${id}\t${tok}\t${op}\t${val}`;
    })
    .join('\n');
}

function pickTask55FeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  return pickTask55VsmStageFeaturesFromGraphTasks(tasks);
}

export function buildDesignReportLlmUserBlock(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
  companyName: string,
  userFeedback?: string,
): string {
  const task1 = pickTask1FeaturesFromGraphTasksForTask10(tasks).filter((f) =>
    String(f.tokenDisplay ?? '').includes('现有表格/'),
  );
  const task5 = pickTask5MacroFeaturesFromGraphTasks(tasks);
  const task55 = pickTask55FeaturesFromGraphTasks(tasks);
  const task9 = pickTask9SystemModuleFeaturesFromGraphTasks(tasks);
  const feedback = String(userFeedback ?? '').replace(/\r\n/g, '\n').trim() || '（无）';
  const corp = String(companyName ?? '').trim() || '客户';

  return `【数字化转型售前设计报告 · LLM 叙事轴输入】
说明：你仅生成 JSON 内第一～三章商业大白话。第四、五章物理对账由系统从任务 10 嵌套 JSON 直刷，勿编造任何字段映射或表结构。

目标客户/公司：${corp}

用户最新修改意见（最高优先级，须融入三章叙事语气）：
${feedback}

Input A — 任务 1「现有表格/」化石特征（老账本锚定）：
${formatFeatureTsvLines(task1)}

Input B — 任务 5 宏观流程特征（管理负债语境）：
${formatFeatureTsvLines(task5)}

Input C — 任务 5.5 VSM 阶段拆解特征（平铺宽表/协作痛点）：
${formatFeatureTsvLines(task55)}

Input D — 任务 9 系统一级模块 + Tech_Host_Platform（分工拓扑）：
${formatFeatureTsvLines(task9)}`;
}
