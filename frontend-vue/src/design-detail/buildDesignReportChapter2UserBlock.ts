/**
 * [INPUT]: task-graph tasks[]、公司名称
 * [OUTPUT]: 设计报告第二章 LLM user 块（任务 5 / 5.5 / 8）
 * [POS]: `runDesignReportChapter2Llm` 专用输入
 *
 * [PROTOCOL]: 与 `designDetailDesignReportChapter2SystemPrompt.js` 对齐
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { formatFeatureTsvLines } from './buildTask8L45PrototypeInferenceInputFromTaskGraph';
import { pickTask5MacroFeaturesFromGraphTasks } from './buildTask5L5VsmInferenceInputFromTaskGraph';
import { pickTask55VsmStageFeaturesFromGraphTasks } from './buildTask6L3ScenarioInferenceInputFromTaskGraph';
import {
  DESIGN_DETAIL_TASK8_LINE_TASK_ID,
  DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID_LEGACY,
} from './designDetailLogicGraphMerge';

function pickTask8PrototypeFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t8 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK8_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID ||
      id === DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID_LEGACY ||
      id.includes('任务 8')
    );
  });
  return Array.isArray(t8?.features) ? t8.features : [];
}

export function buildDesignReportChapter2UserBlock(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
  companyName: string,
): string {
  const task5 = pickTask5MacroFeaturesFromGraphTasks(tasks);
  const task55 = pickTask55VsmStageFeaturesFromGraphTasks(tasks);
  const task8 = pickTask8PrototypeFeaturesFromGraphTasks(tasks);
  const corp = String(companyName ?? '').trim() || '客户';

  return `【设计报告 · 子任务：第二章 剖析与诊断】
目标客户/公司：${corp}

说明：下列 Input 为 task-graph 四列 TSV（FeatureID、TokenStr、Operator、Value）。请严格按 system 提示的 2.1～2.3 标题输出 Markdown 正文，禁止 JSON；正文禁止 \`**\` 加粗。

Input_From_Task_5（宏观业务流程 / 价值流主干）：
${formatFeatureTsvLines(task5)}

Input_From_Task_5_5（VSM 阶段分解 / 骨干流程下钻）：
${formatFeatureTsvLines(task55)}

Input_From_Task_8（操作角色 / 单据对象 / 状态转移矩阵 — 岗位协作与管控事实）：
${formatFeatureTsvLines(task8)}`;
}
