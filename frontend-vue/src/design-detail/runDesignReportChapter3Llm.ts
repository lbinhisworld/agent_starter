/**
 * [INPUT]: task-graph tasks、公司名称
 * [OUTPUT]: 第三章 Markdown 正文
 * [POS]: 设计报告 LLM 子任务 3 专用路由
 */

import { buildDesignReportChapter3UserBlock } from './buildDesignReportChapter3UserBlock';
import { parseDesignReportChapter1Markdown } from './parseDesignReportChapter1';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';

export async function runDesignReportChapter3Llm(args: {
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>;
  companyName: string;
  signal?: AbortSignal;
}): Promise<{ chapter3: string; raw: string; error?: string }> {
  const w = window as unknown as {
    inferDesignDetailDesignReportChapter3FromContext?: (
      payload: { designReportChapter3UserBlock: string },
      fetchOpts?: { signal?: AbortSignal },
    ) => Promise<{ content?: string; rawOutput?: string }>;
  };
  if (typeof w.inferDesignDetailDesignReportChapter3FromContext !== 'function') {
    return {
      chapter3: '',
      raw: '',
      error:
        '未加载 inferDesignDetailDesignReportChapter3FromContext（请确认 designDetailDesignReportChapter3SystemPrompt.js）',
    };
  }
  const userBlock = buildDesignReportChapter3UserBlock(args.tasks, args.companyName);
  try {
    const res = await w.inferDesignDetailDesignReportChapter3FromContext!(
      { designReportChapter3UserBlock: userBlock },
      args.signal ? { signal: args.signal } : undefined,
    );
    const raw = String(res?.content ?? res?.rawOutput ?? '').trim();
    const chapter3 = parseDesignReportChapter1Markdown(raw);
    if (!chapter3) {
      return { chapter3: '', raw, error: '第三章 LLM 输出为空' };
    }
    return { chapter3, raw };
  } catch (e) {
    return {
      chapter3: '',
      raw: '',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
