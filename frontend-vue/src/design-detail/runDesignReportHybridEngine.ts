/**
 * [INPUT]: caseId、公司名称、可选用户反馈与 AbortSignal
 * [OUTPUT]: 双轴混合生成结果（LLM 路由 + 静态直刷路由分流）
 * [POS]: 架构清单「设计报告」运行时总装总线
 *
 * [PROTOCOL]:
 * - 步骤 1：LLM 回路（任务 1/5/5.5/9）→ 第一～三章
 * - 步骤 2：JS 直刷（任务 10）→ 第四、五章
 * - 步骤 3：assembleDesignReportModel 合龙
 */

import { buildDesignReportLlmUserBlock } from './buildDesignReportLlmUserBlock';
import { buildDesignReportStaticFromTaskGraph } from './buildDesignReportStaticFromTaskGraph';
import { assembleDesignReportModel, type DesignReportModel } from './assembleDesignReportModel';
import {
  parseDesignReportLlmChapters,
  type DesignReportLlmNarrative,
} from './parseDesignReportLlmChapters';
import { normalizeLogicGraphTasksFromApiPayload } from './designDetailTask2L1SyncUiProgress';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';

export type DesignReportHybridMode = 'full' | 'static_only' | 'llm_only';

export type DesignReportHybridResult = {
  model: DesignReportModel;
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>;
  llmRaw?: string;
};

const CACHE_PREFIX = 'design-report-llm-narrative:';

export function designReportLlmCacheKey(caseId: string): string {
  return `${CACHE_PREFIX}${String(caseId || '').trim()}`;
}

export function loadCachedDesignReportNarrative(caseId: string): DesignReportLlmNarrative | null {
  try {
    const raw = localStorage.getItem(designReportLlmCacheKey(caseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DesignReportLlmNarrative;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      chapter1: String(parsed.chapter1 ?? '').trim(),
      chapter2: String(parsed.chapter2 ?? '').trim(),
      chapter3: String(parsed.chapter3 ?? '').trim(),
    };
  } catch {
    return null;
  }
}

export function saveCachedDesignReportNarrative(caseId: string, narrative: DesignReportLlmNarrative): void {
  try {
    localStorage.setItem(designReportLlmCacheKey(caseId), JSON.stringify(narrative));
  } catch {
    /* 缓存失败不阻断主流程 */
  }
}

/** 「重启当前/选择重启」触及任务 11 及之后时清除报告叙事缓存 */
export function clearDesignReportNarrativeCache(caseId: string): void {
  try {
    localStorage.removeItem(designReportLlmCacheKey(caseId));
  } catch {
    /* ignore */
  }
}

async function fetchTaskGraphTasks(
  caseId: string,
): Promise<
  ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>
> {
  const api = (
    window as unknown as {
      SmartCto?: {
        problemCaseApi?: {
          getDesignDetailTaskGraph?: (id: string) => Promise<{
            ok?: boolean;
            data?: { tasks?: unknown[] };
            message?: string;
          } | null>;
        };
      };
    }
  ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;
  if (typeof api !== 'function') {
    throw new Error('未加载 problemCaseApi.getDesignDetailTaskGraph');
  }
  const res = await api(caseId);
  if (!res?.ok || !res.data) {
    throw new Error(res?.message || '拉取 task-graph 失败');
  }
  return normalizeLogicGraphTasksFromApiPayload(res.data.tasks ?? []);
}

/** 静态直刷路由（红线 1）：禁止 LLM */
export function runDesignReportStaticAxis(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
) {
  return buildDesignReportStaticFromTaskGraph(tasks);
}

/** LLM 洗炼路由（红线 2）：禁止静态死写三章 */
export async function runDesignReportLlmAxis(args: {
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>;
  companyName: string;
  userFeedback?: string;
  signal?: AbortSignal;
}): Promise<{ narrative: DesignReportLlmNarrative | null; raw: string; error?: string }> {
  const w = window as unknown as {
    inferDesignDetailDesignReportFromContext?: (
      payload: { designReportLlmUserBlock: string },
      fetchOpts?: { signal?: AbortSignal },
    ) => Promise<{ content?: string; rawOutput?: string }>;
  };
  if (typeof w.inferDesignDetailDesignReportFromContext !== 'function') {
    return {
      narrative: null,
      raw: '',
      error:
        '未加载 inferDesignDetailDesignReportFromContext（请确认 designDetailDesignReportSystemPrompt.js 与 task1BusinessInsight.js）',
    };
  }
  const userBlock = buildDesignReportLlmUserBlock(args.tasks, args.companyName, args.userFeedback);
  try {
    const res = await w.inferDesignDetailDesignReportFromContext!(
      { designReportLlmUserBlock: userBlock },
      args.signal ? { signal: args.signal } : undefined,
    );
    const raw = String(res?.content ?? res?.rawOutput ?? '').trim();
    const narrative = parseDesignReportLlmChapters(raw);
    if (!narrative) {
      return { narrative: null, raw, error: 'LLM 输出无法解析为 Design_Report_Narrative JSON' };
    }
    return { narrative, raw };
  } catch (e) {
    return {
      narrative: null,
      raw: '',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * 双轴混合引擎主入口
 * - full：先 LLM 再静态再合龙
 * - static_only：仅重算第四、五章（DAG 更新自愈）
 * - llm_only：仅重跑 LLM 三章（用户反馈）
 */
export async function runDesignReportHybridEngine(args: {
  caseId: string;
  companyName: string;
  userFeedback?: string;
  mode?: DesignReportHybridMode;
  signal?: AbortSignal;
  reuseCachedLlm?: boolean;
}): Promise<DesignReportHybridResult> {
  const caseId = String(args.caseId || '').trim();
  if (!caseId) throw new Error('缺少 caseId');

  const tasks = await fetchTaskGraphTasks(caseId);
  const staticPayload = runDesignReportStaticAxis(tasks);

  const mode = args.mode ?? 'full';
  let llmStatus: DesignReportModel['llmStatus'] = 'idle';
  let llm: DesignReportLlmNarrative | null = null;
  let llmError: string | undefined;
  let llmRaw: string | undefined;

  if (mode === 'static_only') {
    if (args.reuseCachedLlm !== false) {
      llm = loadCachedDesignReportNarrative(caseId);
      llmStatus = llm ? 'ok' : 'idle';
    }
  } else {
    llmStatus = 'loading';
    const llmRes = await runDesignReportLlmAxis({
      tasks,
      companyName: args.companyName,
      userFeedback: args.userFeedback,
      signal: args.signal,
    });
    llmRaw = llmRes.raw;
    if (llmRes.narrative) {
      llm = llmRes.narrative;
      llmStatus = 'ok';
      saveCachedDesignReportNarrative(caseId, llm);
    } else {
      llmStatus = 'error';
      llmError = llmRes.error;
      if (args.reuseCachedLlm !== false) {
        const cached = loadCachedDesignReportNarrative(caseId);
        if (cached) {
          llm = cached;
          llmStatus = 'ok';
          llmError = `${llmRes.error ?? 'LLM 失败'}（已回退本地缓存叙事）`;
        }
      }
    }
  }

  const model = assembleDesignReportModel({
    companyName: args.companyName,
    llm,
    llmStatus,
    llmError,
    staticPayload,
  });

  return { model, tasks, llmRaw };
}
