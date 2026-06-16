/**
 * [INPUT]: `fetchDeepSeekChat`（`frontend/js/api.js`）
 * [OUTPUT]: `humanizeDesignDetailFeatureConclusionsFromContext` 挂到 `window`
 * [POS]: 设计详情任务 2+ 落库后，将 token/operator/value/推理依据 整理为说人话结论句
 *
 * [PROTOCOL]: 变更时同步 `designDetailFeatureInferenceConclusionProgress.ts` 与 `designDetailLlmStats.ts`
 */

const DESIGN_DETAIL_FEATURE_CONCLUSION_HUMANIZE_SYSTEM_PROMPT = `你是产品设计文案助手。用户会提供若干条「推理特征记录」，每条含 token（分域路径）、operator（比较关系）、value（取值）、rationale（推理依据）。

请将每条整理为**一句**中文结论（说人话、面向业务读者），须自然涵盖四要素，禁止编造新事实，禁止输出 Markdown 或编号列表。

仅输出 JSON 数组，与输入顺序一一对应，形如：
[{"i":0,"sentence":"……"},{"i":1,"sentence":"……"}]`;

/**
 * @param {{ items: Array<{ i: number; token: string; operator: string; value: string; rationale: string }> }} payload
 * @param {{ signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [fetchOpts]
 */
async function humanizeDesignDetailFeatureConclusionsFromContext(payload, fetchOpts) {
  const fetchFn = typeof window !== 'undefined' ? window.fetchDeepSeekChat : null;
  if (typeof fetchFn !== 'function') {
    throw new Error('fetchDeepSeekChat 不可用');
  }
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) {
    return { sentences: [], rawOutput: '' };
  }
  const userBlock = `请整理以下 ${items.length} 条推理记录：\n\n${JSON.stringify(items, null, 2)}`;
  const { content, rawOutput } = await fetchFn(
    [
      { role: 'system', content: DESIGN_DETAIL_FEATURE_CONCLUSION_HUMANIZE_SYSTEM_PROMPT },
      { role: 'user', content: userBlock },
    ],
    {
      maxOutputTokens: 4096,
      timeoutMs: 120000,
      ...(fetchOpts && fetchOpts.signal ? { signal: fetchOpts.signal } : {}),
      ...(fetchOpts && fetchOpts.llmLog ? { llmLog: fetchOpts.llmLog } : {}),
    },
  );
  const text = String(content || rawOutput || '').trim();
  const sentences = parseHumanizeSentencesJson(text, items.length);
  return { sentences, rawOutput: text, fullPrompt: `【system】\n${DESIGN_DETAIL_FEATURE_CONCLUSION_HUMANIZE_SYSTEM_PROMPT}\n\n【user】\n${userBlock}` };
}

function parseHumanizeSentencesJson(text, expectedLen) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  let parsed = null;
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''));
  } catch {
    const m = raw.match(/\[[\s\S]*\]/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        parsed = null;
      }
    }
  }
  if (!Array.isArray(parsed)) return [];
  const byIndex = new Map();
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;
    const i = Number(row.i ?? row.index ?? row.idx);
    const sentence = String(row.sentence ?? row.text ?? row.conclusion ?? '').trim();
    if (Number.isFinite(i) && i >= 0 && sentence) byIndex.set(i, sentence);
  }
  const out = [];
  for (let i = 0; i < expectedLen; i += 1) {
    out.push(byIndex.get(i) || '');
  }
  return out;
}

if (typeof window !== 'undefined') {
  window.humanizeDesignDetailFeatureConclusionsFromContext = humanizeDesignDetailFeatureConclusionsFromContext;
} else if (typeof globalThis !== 'undefined') {
  globalThis.humanizeDesignDetailFeatureConclusionsFromContext = humanizeDesignDetailFeatureConclusionsFromContext;
}
