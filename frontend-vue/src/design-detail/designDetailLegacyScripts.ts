/**
 * [INPUT]: `frontend/js/task1BusinessInsight.js`（IIFE 挂 `window`）
 * [OUTPUT]: `ensureDesignDetailTask1ScriptsReady` — 任务 1 经营/需求提炼与 BMC 所需全局函数
 * [POS]: `main.ts` 侧载 + `useDesignDetailChat` 发送前二次校验（避免 HTML 脚本 404 或构建页仅加载 bundle 时 globals 缺失）
 */

type Task1Window = Window & {
  extractDesignDetailBusinessInfoFromUserFeedback?: (text: string) => Promise<unknown>;
  extractDesignDetailCustomerRequirementFromUserFeedback?: (
    text: string,
    basicInfoJsonStr: string,
  ) => Promise<unknown>;
  buildTask1LlmQueryMessage?: (args: Record<string, unknown>) => Record<string, unknown>;
};

export function isDesignDetailTask1ScriptsReady(): boolean {
  const w = window as Task1Window;
  return (
    typeof w.extractDesignDetailBusinessInfoFromUserFeedback === 'function' &&
    typeof w.buildTask1LlmQueryMessage === 'function'
  );
}

function legacyTask1ScriptSrc(): string {
  const base = String(import.meta.env.BASE_URL || './').replace(/\/?$/, '/');
  if (base.includes('/frontend/')) return `${base}js/task1BusinessInsight.js`;
  return `${base}js/task1BusinessInsight.js`;
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const sel = `script[data-design-detail-task1-insight="1"][src="${src}"]`;
    const existing = document.querySelector(sel);
    if (existing) {
      if (isDesignDetailTask1ScriptsReady()) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`脚本加载失败：${src}`)), {
        once: true,
      });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.dataset.designDetailTask1Insight = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`脚本加载失败：${src}`));
    document.head.appendChild(s);
  });
}

/**
 * 保证 `extractDesignDetailBusinessInfoFromUserFeedback` / `buildTask1LlmQueryMessage` 可用。
 * 优先使用已挂全局；否则 dynamic import（dev/build bundle）；再回退插入 `<script>`。
 */
export async function ensureDesignDetailTask1ScriptsReady(): Promise<void> {
  if (isDesignDetailTask1ScriptsReady()) return;

  try {
    await import('../../../frontend/js/task1BusinessInsight.js');
  } catch (e) {
    console.warn('[design-detail:task1-scripts] dynamic import failed', e);
  }
  if (isDesignDetailTask1ScriptsReady()) return;

  const src = legacyTask1ScriptSrc();
  try {
    await loadScriptOnce(src);
  } catch (e) {
    console.warn('[design-detail:task1-scripts] script tag load failed', src, e);
  }
  if (!isDesignDetailTask1ScriptsReady()) {
    throw new Error('经营信息提炼脚本未加载，请刷新页面后重试。');
  }
}
