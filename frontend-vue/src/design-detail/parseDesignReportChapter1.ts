/**
 * [INPUT]: LLM 第一章原始输出
 * [OUTPUT]: 清洗后的 Markdown 正文；`prepareDesignReportChapterSections` 剥离重复章标题并拆 ### 小节
 * [POS]: 设计报告第一～三章子任务解析（纯文本，非 JSON）
 */

export function parseDesignReportChapter1Markdown(raw: string): string {
  let s = String(raw ?? '').replace(/^\uFEFF/, '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:markdown|md|text)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  // 提示词要求正文禁止 markdown 加粗；剥离无标题的 # / ## / ### 占位行
  return s
    .replace(/\*\*/g, '')
    .replace(/^\s*#{1,6}\s*$/gm, '');
}

export type DesignReportMarkdownSection = {
  heading: string;
  body: string;
};

/** 版面 h2 已展示章名，正文中重复的 ## / 纯文本章标题须剥离 */
const DUPLICATE_CHAPTER_HEADING_PATTERNS: RegExp[] = [
  /^第[一二三四五六七八九十\d]+章\s*[：:]\s*.+$/,
  /^对需求痛点的理解\s*$/,
  /^剖析与诊断\s*$/,
  /^方案构建\s*$/,
];

function isDuplicateChapterLevelHeading(heading: string): boolean {
  const h = String(heading || '').trim();
  if (!h) return false;
  return DUPLICATE_CHAPTER_HEADING_PATTERNS.some((re) => re.test(h));
}

function isBareMarkdownHeadingMarker(line: string): boolean {
  return /^#{1,6}\s*$/.test(String(line || '').trim());
}

function isSkippableOutlineLine(line: string): boolean {
  const t = String(line || '').trim();
  if (!t) return true;
  if (isBareMarkdownHeadingMarker(t)) return true;
  if (/^#\s+/.test(t)) return true;
  if (/^##\s+/.test(t) && isDuplicateChapterLevelHeading(t.replace(/^##\s+/, ''))) return true;
  if (isDuplicateChapterLevelHeading(t)) return true;
  return false;
}

/** 正文相对标题的起始信号（与第一章/第二章提示词常见起笔一致） */
const SUBSECTION_BODY_START =
  /\s+(?:首先|基于|详细|指出|向客户|对应|编写|核心|在面临|由于缺乏|当销售|由于现行|向客户清晰|\d+\.\s*【)/;

function normalizeDesignReportMarkdownLineBreaks(text: string): string {
  let t = String(text ?? '').replace(/\r\n/g, '\n').trim();
  if (!t) return t;
  t = t.replace(/([^\n])(?=\d+\.\d+\s+)/g, '$1\n');
  return t;
}

function splitTitleBodyOnOneLine(line: string): { title: string; body: string } {
  const r = String(line || '').trim();
  if (!r) return { title: '', body: '' };
  const m = r.match(SUBSECTION_BODY_START);
  if (m && m.index != null && m.index > 0) {
    return {
      title: r.slice(0, m.index).trim(),
      body: r.slice(m.index).trim(),
    };
  }
  if (r.length <= 52) return { title: r, body: '' };
  const dot = r.search(/[。；]/);
  if (dot > 6 && dot < 50) {
    return {
      title: r.slice(0, dot + 1).trim(),
      body: r.slice(dot + 1).trim(),
    };
  }
  return { title: r, body: '' };
}

function splitSubsectionTitleAndBody(rest: string): { title: string; body: string } {
  const r = String(rest ?? '').trim();
  if (!r) return { title: '', body: '' };
  const nl = r.indexOf('\n');
  if (nl >= 0) {
    const firstLine = r.slice(0, nl).trim();
    const after = r.slice(nl + 1).trim();
    const onFirst = splitTitleBodyOnOneLine(firstLine);
    return {
      title: onFirst.title,
      body: [onFirst.body, after].filter(Boolean).join('\n\n').trim(),
    };
  }
  return splitTitleBodyOnOneLine(r);
}

function parseNumberedSubsectionLine(line: string): { heading: string; body: string } | null {
  const m = line.match(/^(\d+\.\d+)\s+(.+)$/);
  if (!m) return null;
  const { title, body } = splitSubsectionTitleAndBody(m[2] ?? '');
  const heading = title ? `${m[1]} ${title}` : m[1];
  return { heading, body };
}

/** 无 Markdown 标题时，按 1.1 / 2.1 等编号切块 */
function splitByInlineNumberedSubsections(text: string): DesignReportMarkdownSection[] {
  const t = normalizeDesignReportMarkdownLineBreaks(text);
  const parts = t.split(/(?=\d+\.\d+\s+)/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return [];
  const sections: DesignReportMarkdownSection[] = [];
  for (const part of parts) {
    const parsed = parseNumberedSubsectionLine(part.split('\n')[0] ?? part);
    if (!parsed) continue;
    const tailLines = part.includes('\n') ? part.split('\n').slice(1).join('\n').trim() : '';
    const body = [parsed.body, tailLines].filter(Boolean).join('\n\n').trim();
    if (!parsed.heading && !body) continue;
    sections.push({ heading: parsed.heading, body });
  }
  return sections.filter((s) => s.heading || s.body.trim());
}

/** 按 ### / ## / 1.1 编号标题拆分为展示用小节（跳过与版面重复的章级标题） */
export function splitDesignReportMarkdownSections(text: string): DesignReportMarkdownSection[] {
  const t = normalizeDesignReportMarkdownLineBreaks(String(text ?? '').trim());
  if (!t) return [];
  const lines = t.split('\n');
  const sections: DesignReportMarkdownSection[] = [];
  let currentHeading = '';
  const bodyLines: string[] = [];

  const flush = () => {
    const body = bodyLines.join('\n').trim();
    bodyLines.length = 0;
    const heading = String(currentHeading || '').trim();
    if (isDuplicateChapterLevelHeading(heading)) {
      if (!body) return;
      currentHeading = '';
    }
    if (!heading && !body) return;
    sections.push({
      heading: heading || '正文',
      body,
    });
    currentHeading = '';
  };

  for (const line of lines) {
    const h3 = line.match(/^###\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    if (h3 || h2) {
      let heading = (h3?.[1] ?? h2?.[1] ?? '').trim();
      const numInHeading = heading.match(/^(\d+\.\d+)\s+(.+)$/);
      if (numInHeading) {
        const split = splitSubsectionTitleAndBody(numInHeading[2] ?? '');
        flush();
        currentHeading = split.title ? `${numInHeading[1]} ${split.title}` : heading;
        if (split.body) bodyLines.push(split.body);
        continue;
      }
      if (isDuplicateChapterLevelHeading(heading)) {
        flush();
        continue;
      }
      flush();
      currentHeading = heading;
      continue;
    }
    const numbered = parseNumberedSubsectionLine(line.trim());
    if (numbered) {
      flush();
      currentHeading = numbered.heading;
      if (numbered.body) bodyLines.push(numbered.body);
      continue;
    }
    if (isSkippableOutlineLine(line)) continue;
    bodyLines.push(line);
  }
  flush();

  const filtered = sections.filter((sec) => {
    const body = sec.body.trim();
    if (isBareMarkdownHeadingMarker(body)) return false;
    if (sec.heading === '正文' && !body) return false;
    if (isDuplicateChapterLevelHeading(sec.heading) && !body) return false;
    return body.length > 0 || (sec.heading && sec.heading !== '正文');
  });

  if (filtered.length) return filtered;

  const inline = splitByInlineNumberedSubsections(t);
  if (inline.length) return inline;

  return [{ heading: '正文', body: t }];
}

/** 任务 11 子任务：清洗 + 小节拆分（供设计报告 Tab 渲染） */
export function prepareDesignReportChapterSections(raw: string): DesignReportMarkdownSection[] {
  const normalized = parseDesignReportChapter1Markdown(raw);
  if (!normalized) return [];
  return splitDesignReportMarkdownSections(normalized);
}
