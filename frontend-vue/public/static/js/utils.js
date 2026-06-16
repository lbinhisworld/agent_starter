/**
 * [INPUT]: 无外部模块依赖；可选全局 `marked`、`DOMPurify`（由页面加载）
 * [OUTPUT]: `escapeHtml`、`renderMarkdown`、`sanitizeItDesignBpmSvgHtml`（IT 设计 BPM 流程图 SVG 清洗）等
 * [POS]: 全站通用工具，先于业务 bundle 加载
 *
 * [PROTOCOL]: 变更清洗白名单或 Markdown 策略时同步 `frontend/js/AGENTS.md` 中本文件一行说明
 */
/**
 * 工具函数：格式化、转义、Markdown 渲染
 */
(function (global) {
  /**
   * 将任意值格式化为可展示文本。
   * @param {*} value - 原始值。
   * @returns {string} 格式化后的字符串。
   */
  function formatValue(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'boolean') return value ? '是' : '否';
    return String(value);
  }

  /**
   * 对字符串进行 HTML 转义，防止注入。
   * @param {string} str - 待转义文本。
   * @returns {string} 安全的 HTML 字符串。
   */
  function escapeHtml(str) {
    if (str == null || str === '') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * IT 设计补齐「流程图绘制」view：清洗模型返回的 SVG（含 style/@keyframes、animate 等），禁止脚本与事件处理器。
   * 依赖 index.html 引入的 DOMPurify；不可用时不应把原始 SVG 写入 innerHTML。
   * @param {string} dirty
   * @returns {string}
   */
  function sanitizeItDesignBpmSvgHtml(dirty) {
    if (dirty == null || String(dirty).trim() === '') return '';
    let s = String(dirty).trim().replace(/<\?xml[\s\S]*?\?>\s*/gi, '');
    if (typeof DOMPurify === 'undefined') return '';
    const extraTags = [
      'style',
      'title',
      'desc',
      'animate',
      'animateTransform',
      'animateMotion',
      'set',
      'mpath',
      'linearGradient',
      'radialGradient',
      'stop',
      'pattern',
      'marker',
      'mask',
      'clipPath',
      'filter',
      'feGaussianBlur',
      'feOffset',
      'feMerge',
      'feMergeNode',
      'feFlood',
      'feComposite',
      'feColorMatrix',
      'foreignObject',
    ];
    const extraAttrs = [
      'attributeName',
      'from',
      'to',
      'dur',
      'begin',
      'end',
      'repeatCount',
      'repeatDur',
      'values',
      'keyTimes',
      'keySplines',
      'calcMode',
      'path',
      'rotate',
      'keyPoints',
      'spreadMethod',
      'gradientUnits',
      'gradientTransform',
      'offset',
      'stop-color',
      'stop-opacity',
      'fx',
      'fy',
      'fr',
      'orient',
      'markerWidth',
      'markerHeight',
      'refX',
      'refY',
      'markerUnits',
      'patternUnits',
      'patternContentUnits',
      'maskUnits',
      'maskContentUnits',
      'clipPathUnits',
      'stdDeviation',
      'in',
      'in2',
      'result',
      'operator',
      'k1',
      'k2',
      'k3',
      'k4',
      'tableValues',
      'xmlns',
      'xmlns:xlink',
    ];
    try {
      return DOMPurify.sanitize(s, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: extraTags,
        ADD_ATTR: extraAttrs,
      });
    } catch (_) {
      return '';
    }
  }

  /**
   * 将 `***文本***`（marked 解析为 em+strong 嵌套）转为绿色高亮 span，便于与单独 **加粗**（仅 strong）区分。
   * @param {string} html
   * @returns {string}
   */
  function applyTripleAsteriskGreenHighlight(html) {
    if (!html || typeof html !== 'string') return html;
    let out = html;
    // marked/CommonMark：`***x***` → `<em><strong>x</strong></em>` 或 `<strong><em>x</em></strong>`
    const pairRe =
      /<em><strong>([^<]*)<\/strong><\/em>|<strong><em>([^<]*)<\/em><\/strong>/gi;
    out = out.replace(pairRe, (_, a, b) => {
      const inner = (a != null && a !== '' ? a : b) || '';
      return `<span class="md-green-highlight">${inner}</span>`;
    });
    return out;
  }

  /**
   * 渲染 Markdown 为 HTML，并在可用时做 XSS 清洗。
   * @param {string} str - Markdown 内容。
   * @returns {string} 渲染后的 HTML。
   */
  function renderMarkdown(str) {
    if (str == null || str === '') return '';
    const text = String(str);
    if (typeof marked === 'undefined') {
      const plainGreen = text.replace(/\*\*\*([^*]+)\*\*\*/g, (_m, inner) => {
        return `<span class="md-green-highlight">${escapeHtml(inner)}</span>`;
      });
      return plainGreen.replace(/\n/g, '<br>');
    }
    const html = applyTripleAsteriskGreenHighlight(marked.parse(text, { breaks: true }));
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'code', 'pre', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      });
    }
    return html;
  }

  /**
   * 获取当前时间字符串（yyyy-MM-dd HH:mm:ss）。
   * @returns {string} 当前时间。
   */
  function getTimeStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    const h = now.getHours().toString().padStart(2, '0');
    const min = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }

  /**
   * 将时间戳格式化为历史记录时间。
   * @param {string|number|Date} ts - 时间输入。
   * @returns {string} 格式化后的时间文本。
   */
  function formatHistoryTime(ts) {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return String(ts);
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const h = d.getHours().toString().padStart(2, '0');
      const min = d.getMinutes().toString().padStart(2, '0');
      const sec = d.getSeconds().toString().padStart(2, '0');
      return `${y}-${m}-${day} ${h}:${min}:${sec}`;
    } catch {
      return String(ts);
    }
  }

  /**
   * 格式化聊天时间；空值回退为当前时间。
   * @param {string|number|Date} ts - 聊天时间。
   * @returns {string} 格式化时间。
   */
  function formatChatTime(ts) {
    if (!ts) return getTimeStr();
    const s = String(ts).trim();
    if (!s) return getTimeStr();
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return s;
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const h = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    const sec = d.getSeconds().toString().padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}:${sec}`;
  }

  /**
   * 将主题名转换为 URL 友好的 slug。
   * @param {string} name - 主题名。
   * @returns {string} slug 字符串。
   */
  function slugifyTopicName(name) {
    const base = String(name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').slice(0, 50);
    return base || `topic_${Date.now()}`;
  }

  global.formatValue = formatValue;
  global.escapeHtml = escapeHtml;
  global.sanitizeItDesignBpmSvgHtml = sanitizeItDesignBpmSvgHtml;
  global.renderMarkdown = renderMarkdown;
  global.getTimeStr = getTimeStr;
  global.formatHistoryTime = formatHistoryTime;
  global.formatChatTime = formatChatTime;
  global.slugifyTopicName = slugifyTopicName;
})(typeof window !== 'undefined' ? window : this);
