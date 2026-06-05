/**
 * [INPUT]: DOM 截图目标、`html-to-image`（jsDelivr ESM，与主站价值流导出同源）
 * [OUTPUT]: 逻辑树页面 PNG `dataUrl` 与浏览器本地下载
 * [POS]: `DesignDetailLogicTreeModal.vue` 标题栏「下载 PNG」
 *
 * [PROTOCOL]: 变更像素比或展开策略时同步 Modal 导出流程与 `AGENTS.md`
 */

const HTML_TO_IMAGE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm';

/** 高清导出：至少 2×，最高 3×（避免超大画布导致内存失败） */
export function logicTreePngPixelRatio(): number {
  if (typeof window === 'undefined') return 2;
  const dpr = window.devicePixelRatio || 1;
  return Math.min(3, Math.max(2, dpr));
}

export function buildLogicTreePngFilename(caseId?: string): string {
  const id = String(caseId ?? '').trim();
  const base = id ? `逻辑树_${id}` : '逻辑树';
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${base}_${stamp}.png`;
}

function resolvePngBackground(el: HTMLElement): string {
  let node: HTMLElement | null = el;
  for (let i = 0; i < 6 && node; i++) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    node = node.parentElement;
  }
  return '#ffffff';
}

export function triggerBrowserPngDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function captureElementAsPngDataUrl(
  captureEl: HTMLElement,
  opts?: { pixelRatio?: number; backgroundColor?: string },
): Promise<string> {
  const { toPng } = (await import(/* @vite-ignore */ HTML_TO_IMAGE_MODULE_URL)) as {
    toPng: (
      node: HTMLElement,
      options?: Record<string, unknown>,
    ) => Promise<string>;
  };
  const w = Math.max(captureEl.scrollWidth, captureEl.clientWidth || 0);
  const h = Math.max(captureEl.scrollHeight, captureEl.clientHeight || 0);
  return toPng(captureEl, {
    cacheBust: true,
    pixelRatio: opts?.pixelRatio ?? logicTreePngPixelRatio(),
    backgroundColor: opts?.backgroundColor ?? resolvePngBackground(captureEl),
    ...(w > 0 && h > 0 ? { width: w, height: h } : {}),
  });
}

type StyleSnap = {
  el: HTMLElement;
  overflow: string;
  height: string;
  maxHeight: string;
  flex: string;
  minHeight: string;
};

function snapStyles(el: HTMLElement): StyleSnap {
  return {
    el,
    overflow: el.style.overflow,
    height: el.style.height,
    maxHeight: el.style.maxHeight,
    flex: el.style.flex,
    minHeight: el.style.minHeight,
  };
}

function restoreStyles(snaps: StyleSnap[]): void {
  for (const s of snaps) {
    s.el.style.overflow = s.overflow;
    s.el.style.height = s.height;
    s.el.style.maxHeight = s.maxHeight;
    s.el.style.flex = s.flex;
    s.el.style.minHeight = s.minHeight;
  }
}

/**
 * 导出前临时展开滚动区，使横向/纵向溢出内容全部进入截图（与价值流「全宽」导出同思路）。
 */
export function expandLogicTreeScrollForCapture(
  panel: HTMLElement,
  canvas: HTMLElement,
  hscroll: HTMLElement,
  inner: HTMLElement,
): () => void {
  const snaps = [snapStyles(panel), snapStyles(canvas), snapStyles(hscroll), snapStyles(inner)];

  panel.style.height = 'auto';
  panel.style.maxHeight = 'none';
  canvas.style.flex = 'none';
  canvas.style.minHeight = '0';
  canvas.style.overflow = 'visible';
  hscroll.style.overflow = 'visible';
  hscroll.style.height = 'auto';
  hscroll.style.maxHeight = 'none';
  hscroll.style.flex = 'none';
  const fullH = Math.max(inner.scrollHeight, inner.offsetHeight, inner.clientHeight);
  const fullW = Math.max(inner.scrollWidth, inner.offsetWidth, inner.clientWidth);
  inner.style.minHeight = `${fullH}px`;
  inner.style.minWidth = `${fullW}px`;

  return () => restoreStyles(snaps);
}

export async function downloadLogicTreePageAsPng(
  captureRoot: HTMLElement,
  panel: HTMLElement,
  canvas: HTMLElement,
  hscroll: HTMLElement,
  inner: HTMLElement,
  filename: string,
): Promise<void> {
  const restoreLayout = expandLogicTreeScrollForCapture(panel, canvas, hscroll, inner);
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  try {
    const dataUrl = await captureElementAsPngDataUrl(captureRoot);
    triggerBrowserPngDownload(dataUrl, filename);
  } finally {
    restoreLayout();
  }
}
