/**
 * [INPUT]: 全文与已揭示字符数
 * [OUTPUT]: 聊天子区逐字揭示与三行预览裁剪
 * [POS]: 工具详情页聊天流式展示
 *
 * [PROTOCOL]: 变更节奏或预览规则时同步 `useToolDetailSession.ts`
 */

export const TOOL_DETAIL_REVEAL_CHAR_MS = 28;

/** 用户输入子区：逐字动画最多揭示到前三行对应的字符数 */
export function maxRevealLenForThreeLinePreview(fullText: string): number {
  const lines = fullText.split(/\r?\n/);
  if (lines.length <= 3) return fullText.length;
  return lines.slice(0, 3).join('\n').length;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 用户原始输入：最多展示前三行，超出以「。。。」收尾 */
export function previewUserInputThreeLines(fullText: string, revealedLen: number): string {
  const n = Math.max(0, Math.min(revealedLen, fullText.length));
  const slice = fullText.slice(0, n);
  const lines = slice.split(/\r?\n/);
  if (lines.length <= 3) return slice;
  return `${lines.slice(0, 3).join('\n')}。。。`;
}

export async function runCharReveal(
  fullLength: number,
  onStep: (len: number) => void,
  charMs = TOOL_DETAIL_REVEAL_CHAR_MS,
): Promise<void> {
  for (let i = 0; i <= fullLength; i++) {
    onStep(i);
    if (i < fullLength) await sleep(charMs);
  }
}
