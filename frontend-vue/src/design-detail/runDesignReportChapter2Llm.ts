/**
 * [INPUT]: task-graph tasks、公司名称
 * [OUTPUT]: 第二章 Markdown 正文
 * [POS]: 设计报告 LLM 子任务 2 专用路由
 */

import { buildDesignReportChapter2UserBlock } from './buildDesignReportChapter2UserBlock';
import { parseDesignReportChapter1Markdown } from './parseDesignReportChapter1';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';

export async function runDesignReportChapter2Llm(args: {
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>;
  companyName: string;
  signal?: AbortSignal;
}): Promise<{ chapter2: string; raw: string; error?: string }> {
  const w = window as unknown as {
    inferDesignDetailDesignReportChapter2FromContext?: (
      payload: { designReportChapter2UserBlock: string },
      fetchOpts?: { signal?: AbortSignal },
    ) => Promise<{ content?: string; rawOutput?: string }>;
  };
  if (typeof w.inferDesignDetailDesignReportChapter2FromContext !== 'function') {
    return {
      chapter2: '',
      raw: '',
      error:
        '未加载 inferDesignDetailDesignReportChapter2FromContext（请确认 designDetailDesignReportChapter2SystemPrompt.js）',
    };
  }
  const userBlock = buildDesignReportChapter2UserBlock(args.tasks, args.companyName);
  try {
    const res = await w.inferDesignDetailDesignReportChapter2FromContext!(
      { designReportChapter2UserBlock: userBlock },
      args.signal ? { signal: args.signal } : undefined,
    );
    const raw = String(res?.content ?? res?.rawOutput ?? '').trim();
    const chapter2 = parseDesignReportChapter1Markdown(raw);
    if (!chapter2) {
      return { chapter2: '', raw, error: '第二章 LLM 输出为空' };
    }
    return { chapter2, raw };
  } catch (e) {
    return {
      chapter2: '',
      raw: '',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
