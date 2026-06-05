/**
 * [INPUT]: task-graph tasks[]、公司名称
 * [OUTPUT]: 设计报告第一章 LLM user 块（任务 2～5 + 任务 1 痛点/IT 语境）
 * [POS]: `runDesignReportChapter1Llm` 专用输入
 *
 * [PROTOCOL]: 与 `designDetailDesignReportChapter1SystemPrompt.js` 对齐
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { pickTask1FeaturesFromGraphTasksForTask10 } from './buildTask10L5TechnicalDdlInferenceInputFromTaskGraph';
import { pickTask5MacroFeaturesFromGraphTasks } from './buildTask5L5VsmInferenceInputFromTaskGraph';
import { pickTask55VsmStageFeaturesFromGraphTasks } from './buildTask6L3ScenarioInferenceInputFromTaskGraph';
import {
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
  DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK4_LINE_TASK_ID,
} from './designDetailLogicGraphMerge';

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

function pickTask2Features(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t2 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK2_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID ||
      id === DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY
    );
  });
  return Array.isArray(t2?.features) ? t2.features : [];
}

function pickTask3Features(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t3 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return id === DESIGN_DETAIL_TASK3_LINE_TASK_ID || id === DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID;
  });
  return Array.isArray(t3?.features) ? t3.features : [];
}

function pickTask4Features(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t4 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK4_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID ||
      id === DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY
    );
  });
  return Array.isArray(t4?.features) ? t4.features : [];
}

function filterTask1PainAndItContext(features: Task2L1TaskGraphFeatureRow[]): Task2L1TaskGraphFeatureRow[] {
  return features.filter((f) => {
    const tok = String(f.tokenDisplay ?? '');
    return (
      tok.includes('痛点雷达/') ||
      tok.includes('IT现状') ||
      tok.includes('现有表格/') ||
      tok.includes('业务背景/') ||
      tok.includes('运营模式/')
    );
  });
}

export function buildDesignReportChapter1UserBlock(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
  companyName: string,
): string {
  const task2 = pickTask2Features(tasks);
  const task3 = pickTask3Features(tasks);
  const task4 = pickTask4Features(tasks);
  const task5 = pickTask5MacroFeaturesFromGraphTasks(tasks);
  const task55 = pickTask55VsmStageFeaturesFromGraphTasks(tasks);
  const task1Ctx = filterTask1PainAndItContext(pickTask1FeaturesFromGraphTasksForTask10(tasks));
  const corp = String(companyName ?? '').trim() || '客户';

  return `【设计报告 · 子任务：第一章 对需求痛点的理解】
目标客户/公司：${corp}

说明：下列 Input 为 task-graph 四列 TSV（FeatureID、TokenStr、Operator、Value）。请严格按 system 提示的三部曲与 1.1～1.3 标题输出 Markdown 正文，禁止 JSON。

Input_From_Task_2（业务现状签名 / L1 实体画像）：
${formatFeatureTsvLines(task2)}

Input_From_Task_3（行业与业务属性）：
${formatFeatureTsvLines(task3)}

Input_From_Task_4（宏观流程 / 价值流阶段）：
${formatFeatureTsvLines(task4)}

Input_From_Task_5（宏观业务流程）：
${formatFeatureTsvLines(task5)}

Input_From_Task_5_5（VSM 阶段 / 平铺宽表缺陷语境）：
${formatFeatureTsvLines(task55)}

Input_From_Task_1（IT 现状、痛点雷达、老账本/表格化石 — 冲撞对撞素材）：
${formatFeatureTsvLines(task1Ctx)}`;
}
