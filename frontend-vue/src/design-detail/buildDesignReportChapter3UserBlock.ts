/**
 * [INPUT]: task-graph tasks[]、公司名称
 * [OUTPUT]: 设计报告第三章 LLM user 块（任务 9 / 10）
 * [POS]: `runDesignReportChapter3Llm` 专用输入
 *
 * [PROTOCOL]: 与 `designDetailDesignReportChapter3SystemPrompt.js` 对齐
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { formatFeatureTsvLines } from './buildTask8L45PrototypeInferenceInputFromTaskGraph';
import {
  DESIGN_DETAIL_TASK9_LINE_TASK_ID,
  DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK10_LINE_TASK_ID,
  DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID,
} from './designDetailLogicGraphMerge';

function pickTask9FeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t9 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK9_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID ||
      id === DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID_LEGACY ||
      id.includes('任务 9')
    );
  });
  return Array.isArray(t9?.features) ? t9.features : [];
}

function pickTask10FeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t10 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK10_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID ||
      id.includes('任务 10')
    );
  });
  return Array.isArray(t10?.features) ? t10.features : [];
}

export function buildDesignReportChapter3UserBlock(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
  companyName: string,
): string {
  const task9 = pickTask9FeaturesFromGraphTasks(tasks);
  const task10 = pickTask10FeaturesFromGraphTasks(tasks);
  const corp = String(companyName ?? '').trim() || '客户';

  return `【设计报告 · 子任务：第三章 方案构建】
目标客户/公司：${corp}

说明：下列 Input 为 task-graph 四列 TSV（FeatureID、TokenStr、Operator、Value）。请严格按 system 提示的 3.1～3.3 标题输出 Markdown 正文，禁止 JSON；正文禁止 \`**\` 加粗；须承接第二章痛点因果。

Input_From_Task_9（系统一级模块 / 工具宿主平台选型）：
${formatFeatureTsvLines(task9)}

Input_From_Task_10（物理表结构 Schema / 跨平台接口同步 Schema — 台账引用与流转契约）：
${formatFeatureTsvLines(task10)}`;
}
