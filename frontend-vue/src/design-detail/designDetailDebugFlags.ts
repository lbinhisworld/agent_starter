/**
 * [INPUT]: `designDetailExperienceMode.ts`（顶栏使用/调试模式）
 * [OUTPUT]: 设计详情页 **调试向** 功能开关（与生产路径解耦，便于联调时改常量后 `npm run build`）
 * [POS]: `useDesignDetailChat.ts`、任务动态卡
 *
 * [PROTOCOL]: 新增调试门控时在本文件集中暴露布尔常量，并同步 `design_mode_ux.md` / `AGENTS.md`；运行时门闩须经 **`designDetailDebugGate`**
 */

import { isDesignDetailDebugExperienceActive } from './designDetailExperienceMode';

/** 编译期开关 ∧ 顶栏为「调试模式」时才启用流水线调试门闩 */
export function designDetailDebugGate(compileTimeFlag: boolean): boolean {
  return compileTimeFlag && isDesignDetailDebugExperienceActive();
}

/** 为 true：任务 1→2、任务 4→5 等段收官后推「【调试】是否继续」，用户点「继续」后再进入下一阶段 */
export const DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE = true;

/**
 * 为 true：任务 0 落库并收官后，在任务 0 动态卡末尾挂「【调试】是否继续」，
 * 用户点「继续」后再挂载任务 1 引导卡（不自动衔接）。
 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_1 = true;

/**
 * 为 true：任务 3 L2 落库/TVM 门禁通过并收官后，在任务 3 动态卡末尾挂「【调试】是否继续」，
 * 用户点「继续」后再切换线步并启动任务 4（不自动衔接）。
 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_4 = true;

/**
 * 为 true：任务 5.1 L3.1 收官后挂「【调试】是否继续」，用户点「继续」后再启动任务 5.2（不自动衔接）。
 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_52 = true;

/**
 * 为 true：任务 5.2 L3.2 收官后挂「【调试】是否继续」，用户点「继续」后再启动任务 5.3（不自动衔接）。
 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_53 = true;

/**
 * 为 true：任务 5.3 L3.3 收官后挂「【调试】是否继续」，用户点「继续」后再启动任务 5.5（不自动衔接）。
 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_55 = true;

/**
 * 为 true：任务 5.5 L3.5 收官后挂「【调试】是否继续」，用户点「继续」后再启动任务 6（不自动衔接）。
 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_6 = true;

/**
 * 为 true：任务 6 L3 收官后挂「【调试】是否继续」，用户点「继续」后再启动任务 6.5（不自动衔接）。
 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_65 = true;

/**
 * 为 true：任务 6.5 收官后挂「【调试】是否继续」，用户点「继续」后再启动任务 7（不自动衔接）。
 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_7 = true;

/**
 * 为 true：任务 7 L4 收官后挂「【调试】是否继续」，用户点「继续」后再启动任务 8（不自动衔接）。
 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_8 = true;

/**
 * 为 true：任务 8 L4.5 收官后挂「【调试】是否继续」，用户点「继续」后再启动任务 8.5（不自动衔接）。
 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_85 = true;

/**
 * 为 true：任务 8.5 L4.75 收官后挂「【调试】是否继续」，用户点「继续」后再启动任务 9（不自动衔接）。
 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_9 = true;

/**
 * 为 true：任务 9 L5 收官后挂「【调试】是否继续」，用户点「继续」后再启动任务 10（不自动衔接）。
 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_10 = true;

/**
 * 为 true：任务 10 收官后挂调试门闩，用户点「继续」后执行任务 11（分析报告生成）。
 * @deprecated 命名保留兼容；语义同 `DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_11`
 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_10_DATA_ARCH = true;

/** 为 true：任务 10→11 须用户点「继续」后再跑分析报告子任务流水线 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_11 = DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_10_DATA_ARCH;

/** 为 true：任务 11→12 须用户点「继续」后再打开业务流程子 Tab */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_12 = true;

/** 为 true：任务 12→13 须用户点「继续」后再刷新功能清单 */
export const DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_13 = true;

/** 进度行全文（须带 `→` 前缀以匹配任务动态版式） */
export const DEBUG_PIPELINE_STEP_CONTINUE_PROMPT_FULL = '→ 【调试】是否继续';
