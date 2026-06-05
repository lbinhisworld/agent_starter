/**
 * [INPUT]: task-graph tasks、公司名称
 * [OUTPUT]: 第一章 Markdown 正文
 * [POS]: 设计报告 LLM 子任务 1 专用路由（独立 system prompt）
 */

import { buildDesignReportChapter1UserBlock } from './buildDesignReportChapter1UserBlock';
import { parseDesignReportChapter1Markdown } from './parseDesignReportChapter1';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';

export async function runDesignReportChapter1Llm(args: {
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>;
  companyName: string;
  signal?: AbortSignal;
}): Promise<{ chapter1: string; raw: string; error?: string }> {
  const w = window as unknown as {
    inferDesignDetailDesignReportChapter1FromContext?: (
      payload: { designReportChapter1UserBlock: string },
      fetchOpts?: { signal?: AbortSignal },
    ) => Promise<{ content?: string; rawOutput?: string }>;
  };
  if (typeof w.inferDesignDetailDesignReportChapter1FromContext !== 'function') {
    return {
      chapter1: '',
      raw: '',
      error:
        '未加载 inferDesignDetailDesignReportChapter1FromContext（请确认 designDetailDesignReportChapter1SystemPrompt.js）',
    };
  }
  const userBlock = buildDesignReportChapter1UserBlock(args.tasks, args.companyName);
  try {
    const res = await w.inferDesignDetailDesignReportChapter1FromContext!(
      { designReportChapter1UserBlock: userBlock },
      args.signal ? { signal: args.signal } : undefined,
    );
    const raw = String(res?.content ?? res?.rawOutput ?? '').trim();
    const chapter1 = parseDesignReportChapter1Markdown(raw);
    if (!chapter1) {
      return { chapter1: '', raw, error: '第一章 LLM 输出为空' };
    }
    return { chapter1, raw };
  } catch (e) {
    return {
      chapter1: '',
      raw: '',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
