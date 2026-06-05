import { ProblemCaseParsePreview, ProblemCaseParser } from './types';

function extractAfterPrefix(lines: string[], prefixes: string[]) {
  const line = lines.find((item) => prefixes.some((prefix) => item.toLowerCase().startsWith(prefix.toLowerCase())));
  if (!line) return '';
  const [, ...rest] = line.split(/[:：]/);
  return rest.join(':').trim();
}

export class FallbackProblemCaseParser implements ProblemCaseParser {
  async parse(input: string): Promise<ProblemCaseParsePreview> {
    const text = input.trim();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const firstLine = lines[0] || text;

    return {
      customerName:
        extractAfterPrefix(lines, ['客户名称', '企业名称', '公司名称']) ||
        firstLine.split(/[，,。；; ]/)[0] ||
        '未命名客户',
      customerNeedsOrChallenges:
        extractAfterPrefix(lines, ['客户需求', '需求', '挑战', '问题']) || text,
      customerItStatus:
        extractAfterPrefix(lines, ['客户it现状', 'it现状', '现状']) || '待补充',
      projectTimeRequirement:
        extractAfterPrefix(lines, ['项目时间要求', '时间要求', '时间']) || '待补充',
    };
  }
}
