/**
 * [INPUT]: LLM 原始输出字符串
 * [OUTPUT]: 设计报告第一～三章叙事结构
 * [POS]: LLM 轴解析（与静态轴分流）
 *
 * [PROTOCOL]: 仅解析 Design_Report_Narrative；失败返回 null
 */

export type DesignReportLlmNarrative = {
  chapter1: string;
  chapter2: string;
  chapter3: string;
};

function stripJsonFence(raw: string): string {
  let s = String(raw ?? '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  return s;
}

function pickNarrativeObject(root: unknown): Record<string, unknown> | null {
  if (!root || typeof root !== 'object' || Array.isArray(root)) return null;
  const o = root as Record<string, unknown>;
  const nested = o.Design_Report_Narrative ?? o.design_report_narrative;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  if (
    o.chapter1_legacy_preservation != null ||
    o.chapter2_management_debt != null ||
    o.chapter3_platform_topology != null
  ) {
    return o;
  }
  return null;
}

function readChapter(narr: Record<string, unknown>, key: string, altKey?: string): string {
  const v = narr[key] ?? (altKey ? narr[altKey] : undefined);
  return String(v ?? '').replace(/\r\n/g, '\n').trim();
}

/** 解析 LLM 轴 JSON 输出为三章纯文本 */
export function parseDesignReportLlmChapters(raw: string): DesignReportLlmNarrative | null {
  const text = stripJsonFence(raw);
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  const narr = pickNarrativeObject(parsed);
  if (!narr) return null;
  const chapter1 = readChapter(narr, 'chapter1_legacy_preservation');
  const chapter2 = readChapter(narr, 'chapter2_management_debt');
  const chapter3 = readChapter(narr, 'chapter3_platform_topology');
  if (!chapter1 && !chapter2 && !chapter3) return null;
  return { chapter1, chapter2, chapter3 };
}

export function splitReportParagraphs(text: string): string[] {
  const t = String(text ?? '').trim();
  if (!t) return [];
  const isNoise = (s: string) => /^#{1,6}\s*$/.test(s.trim());
  const chunks = t
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => Boolean(s) && !isNoise(s));
  if (chunks.length) return chunks;
  return isNoise(t) ? [] : [t];
}
