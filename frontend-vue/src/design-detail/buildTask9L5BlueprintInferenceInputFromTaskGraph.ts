/**
 * [INPUT]: 推理图任务 8.5（三键 + 历史键）、任务 0 工具原语、任务 1~4 商业基因
 * [OUTPUT]: 任务 9 L5 领域驱动逻辑容器与工具宿主大模型 user 块
 * [POS]: `runTask9L5BlueprintPipeline` 拼装 LLM 输入
 *
 * [PROTOCOL]: 与 `designDetailL5BlueprintSystemPrompt.js` Input 1–3 对齐；Input 1 含 **Validation_Status**；TVM **Target_FeatureID** 仅来自任务 1 节点
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { formatFeatureTsvLines } from './buildTask8L45PrototypeInferenceInputFromTaskGraph';
import {
  pickTask0FeaturesFromGraphTasks,
  pickTask85PhysicalHookFeaturesFromGraphTasks,
} from './buildTask85PhysicalHookInferenceInputFromTaskGraph';
import { pickTask1Through4FeaturesFromGraphTasks } from './buildTask8L45PrototypeInferenceInputFromTaskGraph';

function escapeTsvCell(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t\n\r]/g, ' ')
    .trim();
}

function formatTask85HookTsvLines(features: Task2L1TaskGraphFeatureRow[]): string {
  if (!features.length) return '（无）';
  const withVs = features.some((f) => String(f.validationStatus ?? '').trim().length > 0);
  return features
    .map((f) => {
      const id = escapeTsvCell(String(f.featureId ?? ''));
      const tok = escapeTsvCell(String(f.tokenDisplay ?? ''));
      const op = escapeTsvCell(String(f.operator ?? ''));
      const val = escapeTsvCell(String(f.name ?? ''));
      if (withVs) {
        const vs = escapeTsvCell(String(f.validationStatus ?? '').trim() || 'Pending');
        return `${id}\t${tok}\t${op}\t${val}\t${vs}`;
      }
      return `${id}\t${tok}\t${op}\t${val}`;
    })
    .join('\n');
}

/** 任务 8.5 物理外挂特征（供任务 9 re-export） */
export { pickTask85PhysicalHookFeaturesFromGraphTasks } from './buildTask85PhysicalHookInferenceInputFromTaskGraph';

/** 任务 0 工具原语（供任务 9 Input 2） */
export { pickTask0FeaturesFromGraphTasks } from './buildTask85PhysicalHookInferenceInputFromTaskGraph';

/** 任务 1~4 全局基本面商业基因（Input 3） */
export function pickTask1Through4FeaturesFromGraphTasksForTask9(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  return pickTask1Through4FeaturesFromGraphTasks(tasks);
}

export function buildTask9L5BlueprintInferenceUserBlock(
  task85HookFeatures: Task2L1TaskGraphFeatureRow[],
  tool0Features: Task2L1TaskGraphFeatureRow[],
  task1Through4Features: Task2L1TaskGraphFeatureRow[],
  deepInsightText?: string,
  userRectificationText?: string,
): string {
  const insightRaw = String(deepInsightText ?? '').replace(/\r\n/g, '\n').trim();
  const insightBody = insightRaw || '（暂无）';
  const rectRaw = String(userRectificationText ?? '').replace(/\r\n/g, '\n').trim();
  const rectBody = rectRaw || '（暂无）';
  const input1ColHint = task85HookFeatures.some((f) => String(f.validationStatus ?? '').trim())
    ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status'
    : '四列：FeatureID、TokenStr、Operator、Value';

  return `【任务 9 L5 场景化动宾大伞与工具宿主定义推理输入｜来自设计详情推理图 GET /design-detail/task-graph】
说明：Input 1 ${input1ColHint}。**严禁中性 IT 黑话**（如「业务单据协作控制模块」）；须用【核心动词+业务事实宾语】输出场景化「系统一级模块」大伞；每行须带 Tech_Host_Platform；Evidence_Support_Chain 须引用 Input 1 任务 8.5 的 ft_ FeatureID；Target_KV 仅允许 Feature_Key=系统一级模块。**Token_Validation_Mapping.Target_FeatureID** 仅能引用任务 1 节点。

Input 1：★ 任务 8.5 技术集成打标结果（界面交互层 / 数据承载层 / 衔接互动层；行级含 Validation_Status 时须中继至 Target_KV）：
${formatTask85HookTsvLines(task85HookFeatures)}

Input 2：★【任务 0 可选工具箱原语解构结果】（物理世界技术底座孪生代号）：
${formatFeatureTsvLines(tool0Features)}

Input 3：★ 任务 1~4 全局商业基本面基因特征（核心对冲过滤器；须含 [所有制]、[合规约束等级]、[管控复杂度]、[数字化成熟度预期]、[资产属性特征]）：
${formatFeatureTsvLines(task1Through4Features)}

Input 4：深访洞察（非结构化纯文本）：
${insightBody}

Input 5：用户纠偏输入（非结构化纯文本 - 最高优先级反馈渠道）：
${rectBody}`;
}

const DEFAULT_PROGRESS_CAP = 100_000;

export function truncateTask9L5DebugProgressText(body: string, maxLen = DEFAULT_PROGRESS_CAP): string {
  const s = String(body ?? '');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}\n\n…（以下已截断）`;
}
