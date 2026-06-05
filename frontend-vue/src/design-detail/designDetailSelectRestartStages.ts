/**
 * [INPUT]: `designModeTaskPipeline.ts`（线步顺序与展示名）、设计页当前线步与任务动态卡完成态
 * [OUTPUT]: 「选择重启」可选的**已完成**设计线步列表（供顶栏弹层展示）
 * [POS]: 设计详情重启 UX 的纯函数层；与 `restartDesignDetailFromLineTaskAnchor` 配合
 *
 * [PROTOCOL]: 线步顺序或「已完成」判定变化时须同步 `useDesignDetailChat.ts` 与本目录 `AGENTS.md`
 */

import {
  DESIGN_MODE_LINE_TASK_ORDER,
  type DesignDetailLineTaskId,
  designLinePillLabel,
  designLineTaskDisplayName,
  designLineTaskStepNumber,
} from './designModeTaskPipeline';

export type DesignDetailSelectRestartStageOption = {
  id: Exclude<DesignDetailLineTaskId, 'all_done'>;
  stepNumber: number;
  pillLabel: string;
  displayName: string;
};

type DynamicsCardRestartHint = {
  lineTaskId: string;
  status: string;
};

/**
 * 列出当前案例**已完成**的设计线步（不含进行中的当前步，除非该步动态卡已 `completed`）。
 * 任务 1 以全案 `task1Completed` 为准；其余线步：索引早于当前线步、或对应动态卡已收官、或当前为 `all_done`。
 */
export function listCompletedDesignLineTasksForSelectRestart(
  currentLineTaskId: DesignDetailLineTaskId,
  dynamicsCards: readonly DynamicsCardRestartHint[],
  task1Completed: boolean,
): DesignDetailSelectRestartStageOption[] {
  const curIdx =
    currentLineTaskId === 'all_done'
      ? DESIGN_MODE_LINE_TASK_ORDER.length
      : DESIGN_MODE_LINE_TASK_ORDER.indexOf(
          currentLineTaskId as Exclude<DesignDetailLineTaskId, 'all_done'>,
        );

  const out: DesignDetailSelectRestartStageOption[] = [];

  for (let i = 0; i < DESIGN_MODE_LINE_TASK_ORDER.length; i += 1) {
    const step = DESIGN_MODE_LINE_TASK_ORDER[i]!;
    let done = false;

    if (step === 'customer_basic') {
      done = task1Completed;
    } else if (currentLineTaskId === 'all_done') {
      done = true;
    } else if (curIdx >= 0 && i < curIdx) {
      done = true;
    } else if (dynamicsCards.some((c) => c.lineTaskId === step && c.status === 'completed')) {
      done = true;
    }

    if (!done) continue;

    const stepNumber = designLineTaskStepNumber(step);
    if (stepNumber == null) continue;

    out.push({
      id: step,
      stepNumber,
      pillLabel: designLinePillLabel(step),
      displayName: designLineTaskDisplayName(step),
    });
  }

  return out;
}
