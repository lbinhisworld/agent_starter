/**
 * [INPUT]: 泳道语义模型 `{ flow_title?, departments, stages, steps:[{id,dept,stage,...}] }`（与 LLM JSON 一致；**绘制**为**纵向泳道**：每列一角色，自上而下串接 BPM 顺序）
 * [OUTPUT]: `renderItDesignBpmSwimlaneSvg(container, model)` 在容器内生成**粘性表头**（流程名+角色行）+ **可垂直滚动**泳道主体 SVG（含沿路径动画箭头）
 * [POS]: IT 设计补齐「流程图绘制」view 主路径；由 `main.js` hydrate 调用
 *
 * [PROTOCOL]: 与 `itDesignSupplement.js` 的 `IT_DESIGN_BPM_SWIMLANE_SYSTEM_PROMPT` JSON Schema 对齐；变更布局或动画时同步 `frontend/js/AGENTS.md`
 * FE-20260414-swimlane-v：垂直泳道、流程标题、开始/结束节点、同列垂直连线、**跨列**底→顶贝塞尔；**跨列垂直位置**取目标列末底与当前节点底的 max 再加下一节点高 1/3；**决策**与普通过程一致仅底边中点单出口；节点配色对齐端到端事务流 BPM 卡（`styles.css` `.e2e-bpm-tx-bpm-step-card--*` 绿/黄/蓝/橙/紫 + 深色底）。
 * FE-20260414-swimlane-view-scroll：view 区固定可视高度+纵向滚动；表头 `position:sticky`；泳道/卡片宽约 +50%、正文字号 +2px；无 `flow_title` 时由 `buildItDesignSupplementTransactionViewHtml` 注入事务名，图中不再使用「业务流程」占位。
 * FE-20260414-logic-keys：`pickLogicBodyText` 多键名+数组/对象/`logic_meta` 归一；核验·决策步可回退节点描述；与 `normalizeBpmFlowSwimlaneModel` 写入的 `logic_text` 对齐。
 * FE-20260423-single-lane：仅 **1** 条泳道时 viewport 加 `it-design-bpm-swimlane-viewport--single-lane`，占父级 **50%** 宽并 `margin` 水平居中（`styles.css`）。
 * FE-20260415-bpm-field-zh：根级可选 `field_label_map`（字段编码→中文展示名，由 `itDesignSupplement.js` 从 `data_objects` 注入）；节点「写入字段」标签优先显示中文名，未知编码保持原文；标签 `title` 悬停保留编码。
 */
(function (global) {
  'use strict';

  /** 与提示词、解析侧一致；演进时同步 */
  const FORMAT_VERSION = '1.4.0';

  const LAYOUT = {
    laneWidth: 336,
    titleBlockH: 44,
    roleHeaderH: 48,
    lanePadTop: 18,
    lanePadBottom: 22,
    cardInsetX: 15,
    cardMinW: 282,
    titleBandH: 30,
    startEndR: 24,
    bodyFont: 10,
    bodyLineH: 13,
    tagFont: 10,
  };

  const NS = 'http://www.w3.org/2000/svg';

  const SEGMENT_EPS = 1e-6;
  const BEZIER_ALPHA = 0.45;
  const ARROW_LEN = 8;
  const ARROW_HALF_W = 4;
  const ARROW_MOTION_DUR_SEC = 2.6;

  const LANE_DIVIDER_STROKE = '#334155';
  const LANE_DIVIDER_WIDTH = 1;

  const TITLE_FONT = 12;
  const TITLE_LINE_H = 15;

  /** 与 `styles.css` 端到端 `.e2e-bpm-tx-bpm-step-card--*` 一致，并融入参考色（输入绿/核验金/决策蓝/执行紫/留痕橙） */
  const SWIM_BG = '#0b1120';
  const SWIM_TITLE_BG = '#111827';
  const SWIM_HEADER_BG = '#1e293b';
  const SWIM_LANE_STRIPE = 'rgba(30, 41, 59, 0.55)';
  const EDGE_STROKE = '#58a6ff';

  /**
   * @typedef {{ border: string, glow: string, idBadgeStroke: string, idBadgeFill: string, idBadgeText: string, pillStroke: string, pillFill: string, pillText: string, logicBoxStroke: string, logicBoxFill: string, logicLabel: string, logicText: string, titleText: string, writeHead: string, writeTagBg: string, writeTagStroke: string, writeTagText: string }} BpmTheme
   */

  /** @type {Record<string, BpmTheme>} */
  const BPM_NODE_THEME = {
    input: {
      border: 'rgba(46, 204, 113, 0.72)',
      glow: '#2ecc71',
      idBadgeStroke: 'rgba(52, 211, 153, 0.5)',
      idBadgeFill: 'rgba(52, 211, 153, 0.14)',
      idBadgeText: '#6ee7b7',
      pillStroke: 'rgba(52, 211, 153, 0.42)',
      pillFill: 'rgba(52, 211, 153, 0.14)',
      pillText: '#a7f3d0',
      logicBoxStroke: 'rgba(52, 211, 153, 0.35)',
      logicBoxFill: 'rgba(6, 95, 70, 0.38)',
      logicLabel: '#a7f3d0',
      logicText: '#e2e8f0',
      titleText: '#f8fafc',
      writeHead: '#6ee7b7',
      writeTagBg: 'rgba(52, 211, 153, 0.16)',
      writeTagStroke: 'rgba(52, 211, 153, 0.48)',
      writeTagText: '#d1fae5',
    },
    verify: {
      border: 'rgba(241, 196, 15, 0.72)',
      glow: '#f1c40f',
      idBadgeStroke: 'rgba(250, 204, 21, 0.5)',
      idBadgeFill: 'rgba(250, 204, 21, 0.12)',
      idBadgeText: '#fde047',
      pillStroke: 'rgba(250, 204, 21, 0.45)',
      pillFill: 'rgba(250, 204, 21, 0.12)',
      pillText: '#fef08a',
      logicBoxStroke: 'rgba(250, 204, 21, 0.4)',
      logicBoxFill: 'rgba(113, 80, 12, 0.38)',
      logicLabel: '#fef08a',
      logicText: '#e2e8f0',
      titleText: '#f8fafc',
      writeHead: '#fde047',
      writeTagBg: 'rgba(250, 204, 21, 0.14)',
      writeTagStroke: 'rgba(250, 204, 21, 0.45)',
      writeTagText: '#fef9c3',
    },
    decision: {
      border: 'rgba(52, 152, 219, 0.75)',
      glow: '#3498db',
      idBadgeStroke: 'rgba(96, 165, 250, 0.52)',
      idBadgeFill: 'rgba(96, 165, 250, 0.14)',
      idBadgeText: '#93c5fd',
      pillStroke: 'rgba(96, 165, 250, 0.48)',
      pillFill: 'rgba(96, 165, 250, 0.14)',
      pillText: '#bfdbfe',
      logicBoxStroke: 'rgba(96, 165, 250, 0.42)',
      logicBoxFill: 'rgba(30, 64, 120, 0.42)',
      logicLabel: '#bfdbfe',
      logicText: '#e2e8f0',
      titleText: '#f8fafc',
      writeHead: '#93c5fd',
      writeTagBg: 'rgba(96, 165, 250, 0.14)',
      writeTagStroke: 'rgba(96, 165, 250, 0.48)',
      writeTagText: '#dbeafe',
    },
    execute: {
      border: 'rgba(155, 89, 182, 0.72)',
      glow: '#9b59b6',
      idBadgeStroke: 'rgba(167, 139, 250, 0.48)',
      idBadgeFill: 'rgba(167, 139, 250, 0.12)',
      idBadgeText: '#c4b5fd',
      pillStroke: 'rgba(167, 139, 250, 0.42)',
      pillFill: 'rgba(167, 139, 250, 0.12)',
      pillText: '#ddd6fe',
      logicBoxStroke: 'rgba(167, 139, 250, 0.4)',
      logicBoxFill: 'rgba(76, 29, 120, 0.4)',
      logicLabel: '#ddd6fe',
      logicText: '#e2e8f0',
      titleText: '#f8fafc',
      writeHead: '#c4b5fd',
      writeTagBg: 'rgba(167, 139, 250, 0.14)',
      writeTagStroke: 'rgba(167, 139, 250, 0.45)',
      writeTagText: '#ede9fe',
    },
    trace: {
      border: 'rgba(251, 146, 60, 0.72)',
      glow: '#fb923c',
      idBadgeStroke: 'rgba(251, 146, 60, 0.5)',
      idBadgeFill: 'rgba(251, 146, 60, 0.12)',
      idBadgeText: '#fdba74',
      pillStroke: 'rgba(251, 146, 60, 0.45)',
      pillFill: 'rgba(251, 146, 60, 0.12)',
      pillText: '#fed7aa',
      logicBoxStroke: 'rgba(251, 146, 60, 0.4)',
      logicBoxFill: 'rgba(120, 53, 15, 0.38)',
      logicLabel: '#fed7aa',
      logicText: '#e2e8f0',
      titleText: '#f8fafc',
      writeHead: '#fdba74',
      writeTagBg: 'rgba(251, 146, 60, 0.14)',
      writeTagStroke: 'rgba(251, 146, 60, 0.45)',
      writeTagText: '#ffedd5',
    },
    other: {
      border: 'rgba(148, 163, 184, 0.45)',
      glow: '#64748b',
      idBadgeStroke: 'rgba(148, 163, 184, 0.45)',
      idBadgeFill: 'rgba(15, 23, 42, 0.72)',
      idBadgeText: '#cbd5e1',
      pillStroke: 'rgba(148, 163, 184, 0.4)',
      pillFill: 'rgba(51, 65, 85, 0.5)',
      pillText: '#e2e8f0',
      logicBoxStroke: 'rgba(148, 163, 184, 0.35)',
      logicBoxFill: 'rgba(30, 41, 59, 0.65)',
      logicLabel: '#94a3b8',
      logicText: '#e2e8f0',
      titleText: '#f8fafc',
      writeHead: '#94a3b8',
      writeTagBg: 'rgba(51, 65, 85, 0.55)',
      writeTagStroke: 'rgba(148, 163, 184, 0.4)',
      writeTagText: '#e2e8f0',
    },
  };

  /**
   * @param {SVGDefsElement} defs
   * @param {string} id
   * @param {string} glowColor
   */
  function appendGlowFilter(defs, id, glowColor) {
    const f = document.createElementNS(NS, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('x', '-25%');
    f.setAttribute('y', '-25%');
    f.setAttribute('width', '150%');
    f.setAttribute('height', '150%');
    const ds = document.createElementNS(NS, 'feDropShadow');
    ds.setAttribute('dx', '0');
    ds.setAttribute('dy', '0');
    ds.setAttribute('stdDeviation', '3.2');
    ds.setAttribute('flood-color', glowColor);
    ds.setAttribute('flood-opacity', '0.38');
    f.appendChild(ds);
    defs.appendChild(f);
  }

  /** @param {string} kind */
  function themeForStepKind(kind) {
    return BPM_NODE_THEME[kind] || BPM_NODE_THEME.other;
  }

  function pickBpmIdBadgeText(step) {
    const raw = String(step.bpm_node_id ?? step.bpmNodeId ?? '').trim();
    if (raw) return raw.length > 22 ? `${raw.slice(0, 21)}…` : raw;
    return `#${step.id}`;
  }

  function pickStagePillText(step) {
    const st = String(step.stage ?? '').trim();
    return st || '—';
  }

  /**
   * clipPath 必须挂在根 svg 的 defs 上，否则引用无效
   * @param {SVGSVGElement} rootSvg
   * @param {string} id
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} rx
   */
  function defineCardClip(rootSvg, id, x, y, w, h, rx) {
    let defs = rootSvg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(NS, 'defs');
      rootSvg.insertBefore(defs, rootSvg.firstChild);
    }
    const clip = document.createElementNS(NS, 'clipPath');
    clip.setAttribute('id', id);
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', String(x));
    r.setAttribute('y', String(y));
    r.setAttribute('width', String(w));
    r.setAttribute('height', String(h));
    r.setAttribute('rx', String(rx));
    r.setAttribute('ry', String(rx));
    clip.appendChild(r);
    defs.appendChild(clip);
  }

  function addRect(svg, x, y, w, h, fill, stroke, options) {
    const opt = options || {};
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', String(x));
    r.setAttribute('y', String(y));
    r.setAttribute('width', String(w));
    r.setAttribute('height', String(h));
    r.setAttribute('fill', fill);
    if (stroke) r.setAttribute('stroke', stroke);
    if (opt.strokeWidth != null) r.setAttribute('stroke-width', String(opt.strokeWidth));
    if (opt.rx != null) r.setAttribute('rx', String(opt.rx));
    if (opt.ry != null) r.setAttribute('ry', String(opt.ry));
    if (opt.filter) r.setAttribute('filter', opt.filter);
    svg.appendChild(r);
  }

  function addLine(svg, x1, y1, x2, y2, stroke, strokeWidth) {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.setAttribute('stroke', stroke || LANE_DIVIDER_STROKE);
    line.setAttribute('stroke-width', String(strokeWidth != null ? strokeWidth : LANE_DIVIDER_WIDTH));
    svg.appendChild(line);
  }

  /**
   * @param {string} text
   * @param {number} maxChars
   * @param {number} maxLines
   * @returns {string[]}
   */
  function wrapToLines(text, maxChars, maxLines) {
    const s = String(text || '').trim() || '—';
    const n = Math.max(4, Math.floor(maxChars));
    const lines = [];
    for (let i = 0; i < s.length && lines.length < maxLines; i += n) {
      lines.push(s.slice(i, i + n));
    }
    if (s.length > n * maxLines && lines.length === maxLines) {
      const last = lines[maxLines - 1];
      if (last.length >= n) lines[maxLines - 1] = `${last.slice(0, n - 1)}…`;
    }
    return lines.length ? lines : ['—'];
  }

  function appendTextLines(svg, x, y0, lines, lineHeight, fontSize, bold, fill) {
    const textEl = document.createElementNS(NS, 'text');
    textEl.setAttribute('x', String(x));
    textEl.setAttribute('y', String(y0));
    textEl.setAttribute('font-size', String(fontSize));
    textEl.setAttribute('fill', fill || '#1f2a37');
    textEl.setAttribute('text-anchor', 'start');
    textEl.setAttribute('font-weight', bold ? '700' : '400');
    lines.forEach((line, idx) => {
      const tsp = document.createElementNS(NS, 'tspan');
      if (idx === 0) {
        tsp.setAttribute('x', String(x));
        tsp.setAttribute('dy', '0');
      } else {
        tsp.setAttribute('x', String(x));
        tsp.setAttribute('dy', String(lineHeight));
      }
      tsp.textContent = line;
      textEl.appendChild(tsp);
    });
    svg.appendChild(textEl);
  }

  function appendTextLinesCentered(svg, cx, y0, lines, lineHeight, fontSize, bold, fill) {
    const textEl = document.createElementNS(NS, 'text');
    textEl.setAttribute('x', String(cx));
    textEl.setAttribute('y', String(y0));
    textEl.setAttribute('font-size', String(fontSize));
    textEl.setAttribute('fill', fill || '#1f2a37');
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('font-weight', bold ? '700' : '400');
    lines.forEach((line, idx) => {
      const tsp = document.createElementNS(NS, 'tspan');
      if (idx === 0) {
        tsp.setAttribute('x', String(cx));
        tsp.setAttribute('dy', '0');
      } else {
        tsp.setAttribute('x', String(cx));
        tsp.setAttribute('dy', String(lineHeight));
      }
      tsp.textContent = line;
      textEl.appendChild(tsp);
    });
    svg.appendChild(textEl);
  }

  function pickNodeTitleText(step) {
    const d = String(step.node_description ?? step.description ?? step.desc ?? '').trim();
    if (d) return d;
    return String(step.sentence ?? step.title ?? '').trim() || '—';
  }

  /**
   * 逻辑区正文：多键名归一；`logic_text` 为空串时仍尝试 `logic` 等（避免 `??` 只吃 nullish 导致整段丢失）
   * @param {object} step
   */
  function pickLogicBodyText(step) {
    if (!step || typeof step !== 'object') return '';
    const coerce = (v) => {
      if (v == null) return '';
      if (Array.isArray(v)) {
        return v
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .join('；');
      }
      if (typeof v === 'object') {
        if (v.text != null && String(v.text).trim()) return String(v.text).trim();
        if (v.content != null && String(v.content).trim()) return String(v.content).trim();
        const parts = [];
        if (v.constraints != null && String(v.constraints).trim()) parts.push(String(v.constraints).trim());
        if (v.details != null && String(v.details).trim()) parts.push(String(v.details).trim());
        return parts.length ? parts.join('；') : '';
      }
      return String(v).trim();
    };
    const keys = [
      'logic_text',
      'logicText',
      'logic',
      'bpm_logic',
      'bpmLogic',
      'validation_logic',
      'verify_logic',
      'judgment_logic',
      'decision_logic',
      'check_logic',
      'logic_description',
      'field_memo',
    ];
    for (let i = 0; i < keys.length; i++) {
      const t = coerce(step[keys[i]]);
      if (t) return t;
    }
    if (step.logic_meta != null && typeof step.logic_meta === 'object') {
      const t = coerce(step.logic_meta);
      if (t) return t;
    }
    const kind = getBpmStepKind(step);
    if (kind === 'verify' || kind === 'decision') {
      const fb = String(
        step.node_description ?? step.description ?? step.desc ?? step.sentence ?? '',
      ).trim();
      if (fb) return fb;
    }
    return '';
  }

  /**
   * @param {object} step
   * @param {string[]} snakeKeys
   * @param {string[]} aliasKeys
   * @returns {string[]}
   */
  function dbFieldsToTokens(step, snakeKeys, aliasKeys) {
    let v;
    for (let i = 0; i < snakeKeys.length; i++) {
      const k = snakeKeys[i];
      if (step[k] != null) {
        v = step[k];
        break;
      }
    }
    if (v === undefined) {
      for (let j = 0; j < aliasKeys.length; j++) {
        const k = aliasKeys[j];
        if (step[k] != null) {
          v = step[k];
          break;
        }
      }
    }
    if (v == null) return [];
    if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean);
    const s = String(v).trim();
    if (!s) return [];
    return s
      .split(/[,，、;；\n\r]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  /**
   * 将 BPM 写入/引用等字段编码解析为展示文案（优先中文名，见根模型 `field_label_map`）
   * @param {string} token
   * @param {Record<string, string>|null|undefined} map
   * @returns {string}
   */
  function resolveDbFieldTokenForDisplay(token, map) {
    const t = String(token ?? '').trim();
    if (!t) return '';
    if (!map || typeof map !== 'object') return t;
    const direct = map[t];
    if (direct != null && String(direct).trim()) return String(direct).trim();
    const dot = t.lastIndexOf('.');
    if (dot > 0) {
      const tail = t.slice(dot + 1).trim();
      if (tail) {
        const m2 = map[tail];
        if (m2 != null && String(m2).trim()) return String(m2).trim();
      }
    }
    return t;
  }

  /**
   * @param {string} disp
   * @param {number} tagFont
   * @returns {number}
   */
  function avgCharWidthForBpmTag(disp, tagFont) {
    const str = String(disp);
    if (!str.length) return tagFont * 0.52;
    let wide = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c >= 0x4e00 && c <= 0x9fff) wide++;
    }
    const narrow = str.length - wide;
    return (narrow * tagFont * 0.52 + wide * tagFont * 0.9) / str.length;
  }

  /** @param {object} step @returns {'verify'|'decision'|'execute'|'input'|'trace'|'other'} */
  function getBpmStepKind(step) {
    const raw = `${step.stage ?? ''} ${step.bpm_type ?? ''} ${step.type ?? ''}`;
    const s = String(raw).trim();
    if (/核验|验证|校验|\bverify\b|\bverification\b|\bvalidate\b/i.test(s)) return 'verify';
    if (/决策|判断|网关|\bdecision\b|\bgateway\b/i.test(s)) return 'decision';
    if (/执行|\bexecute\b/i.test(s)) return 'execute';
    if (/留痕|\btrace\b|\baudit\b/i.test(s)) return 'trace';
    if (/输入|\binput\b/i.test(s)) return 'input';
    return 'other';
  }

  function isSystemDeptName(name) {
    const s = String(name ?? '').trim();
    return s === '系统' || /^system$/i.test(s);
  }

  function isExternalDeptName(name) {
    const s = String(name ?? '').trim();
    if (!s) return false;
    if (s.includes('外部')) return true;
    return /^(客户|商户|终端用户|C端|用户端|合作伙伴|面试者|候选人|应聘者)/.test(s);
  }

  /** 内部角色从左(低权限感)到右(高权限)：数组序靠后的列更靠右 */
  const INTERNAL_DEPT_ORDER = [
    '顾问',
    '教练',
    '代理',
    '门店',
    '店长',
    '总部',
    '财务',
    '运营',
    '区域',
    '经销商',
    '总代理',
    '总代理管理员',
    '管理员',
  ];

  /**
   * @param {Set<string>} usedDepts
   * @param {Map<string, number>} firstStepIndex
   * @returns {string[]}
   */
  function sortDepartmentNamesForBpm(usedDepts, firstStepIndex) {
    const arr = Array.from(usedDepts).filter((d) => d && !isSystemDeptName(d));
    const ext = arr.filter(isExternalDeptName);
    const inn = arr.filter((d) => !isExternalDeptName(d));
    const idx = (d) => firstStepIndex.get(d) ?? 1e9;
    ext.sort((a, b) => idx(a) - idx(b));
    inn.sort((a, b) => {
      const ia = INTERNAL_DEPT_ORDER.indexOf(a);
      const ib = INTERNAL_DEPT_ORDER.indexOf(b);
      const oa = ia >= 0 ? ia : 1000;
      const ob = ib >= 0 ? ib : 1000;
      if (oa !== ob) return oa - ob;
      return idx(a) - idx(b);
    });
    return ext.concat(inn);
  }

  /**
   * @param {object} model
   * @returns {object | null}
   */
  function optimizeItDesignBpmSwimlaneModel(model) {
    if (!model || typeof model !== 'object') return null;
    const origStages = Array.isArray(model.stages)
      ? model.stages.map((x) => String(x ?? '').trim()).filter(Boolean)
      : [];
    const rawSteps = Array.isArray(model.steps) ? model.steps : [];
    if (origStages.length < 1 || rawSteps.length < 1) return null;

    const stepsCopy = rawSteps.map((s) => ({ ...s }));
    let lastNonSystemDept = '';

    const remapped = stepsCopy.map((s, idx) => {
      const d0 = String(s.dept ?? '').trim();
      if (!isSystemDeptName(d0)) {
        lastNonSystemDept = d0;
        return s;
      }
      let inherit = lastNonSystemDept;
      if (!inherit) {
        for (let j = idx + 1; j < stepsCopy.length; j++) {
          const dj = String(stepsCopy[j].dept ?? '').trim();
          if (!isSystemDeptName(dj)) {
            inherit = dj;
            break;
          }
        }
      }
      if (!inherit) {
        for (let j = 0; j < idx; j++) {
          const dj = String(stepsCopy[j].dept ?? '').trim();
          if (!isSystemDeptName(dj)) {
            inherit = dj;
            break;
          }
        }
      }
      if (!inherit && Array.isArray(model.departments)) {
        const pick = model.departments.find((x) => !isSystemDeptName(String(x ?? '')));
        if (pick) inherit = String(pick).trim();
      }
      if (!inherit) inherit = '顾问';
      lastNonSystemDept = inherit;
      return { ...s, dept: inherit };
    });

    const usedStageNames = new Set(
      remapped.map((s) => String(s.stage ?? '').trim()).filter(Boolean),
    );
    const newStages = origStages.filter((st) => usedStageNames.has(st));
    if (newStages.length < 1) return null;

    const firstIdx = new Map();
    remapped.forEach((s, i) => {
      const d = String(s.dept ?? '').trim();
      if (d && !isSystemDeptName(d) && !firstIdx.has(d)) firstIdx.set(d, i);
    });
    const usedDepts = new Set(
      remapped.map((s) => String(s.dept ?? '').trim()).filter((d) => d && !isSystemDeptName(d)),
    );
    const departments = sortDepartmentNamesForBpm(usedDepts, firstIdx);
    if (departments.length < 1) return null;

    const fv =
      typeof model.format_version === 'string' && model.format_version.trim()
        ? model.format_version.trim()
        : FORMAT_VERSION;

    const flowTitle =
      typeof model.flow_title === 'string' && model.flow_title.trim()
        ? model.flow_title.trim()
        : typeof model.title === 'string' && model.title.trim()
          ? model.title.trim()
          : typeof model.transaction_name === 'string' && model.transaction_name.trim()
            ? model.transaction_name.trim()
            : '';

    const out = {
      format_version: fv,
      flow_title: flowTitle,
      departments,
      stages: newStages,
      steps: remapped.map((s, i) => ({
        ...s,
        id: s.id != null ? s.id : i + 1,
        dept: String(s.dept ?? '').trim(),
        stage: String(s.stage ?? '').trim(),
      })),
    };
    const flm = model.field_label_map;
    if (flm && typeof flm === 'object' && !Array.isArray(flm)) {
      const safe = {};
      for (const k of Object.keys(flm)) {
        const sk = String(k).trim();
        if (!sk) continue;
        const sv = flm[k];
        if (sv != null && String(sv).trim()) safe[sk] = String(sv).trim();
      }
      if (Object.keys(safe).length) out.field_label_map = safe;
    }
    return out;
  }

  function topMid(rect) {
    return { x: rect.x + rect.width / 2, y: rect.y };
  }

  function bottomMid(rect) {
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
  }

  function isSlantedSegment(from, to) {
    return Math.abs(from.x - to.x) > SEGMENT_EPS && Math.abs(from.y - to.y) > SEGMENT_EPS;
  }

  function cubicControlPoints(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return {
      cp1: { x: from.x, y: from.y + BEZIER_ALPHA * dy },
      cp2: { x: to.x, y: to.y - BEZIER_ALPHA * dy },
    };
  }

  function addAnimatedArrowAlongPath(svg, motionPathD) {
    const g = document.createElementNS(NS, 'g');
    const poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('points', `0,0 ${-ARROW_LEN},${-ARROW_HALF_W} ${-ARROW_LEN},${ARROW_HALF_W}`);
    poly.setAttribute('fill', EDGE_STROKE);
    g.appendChild(poly);
    const anim = document.createElementNS(NS, 'animateMotion');
    anim.setAttribute('dur', `${ARROW_MOTION_DUR_SEC}s`);
    anim.setAttribute('repeatCount', 'indefinite');
    anim.setAttribute('rotate', 'auto');
    anim.setAttribute('calcMode', 'linear');
    anim.setAttribute('path', motionPathD);
    g.appendChild(anim);
    svg.appendChild(g);
    return { motionPathD, durationSec: ARROW_MOTION_DUR_SEC, rotate: 'auto' };
  }

  /**
   * @param {string[]} tokens
   * @param {number} innerX
   * @param {number} innerY
   * @param {number} innerW
   * @param {number} maxBottom
   */
  function layoutWriteTagsHeight(tokens, innerX, innerY, innerW, maxBottom) {
    const tagFont = LAYOUT.tagFont;
    const tagPadX = 5;
    const tagPadY = 3;
    const tagGap = 4;
    let cx = innerX;
    let rowTop = innerY;
    let rowMaxH = 0;
    for (let ti = 0; ti < tokens.length; ti++) {
      const tok = tokens[ti];
      const disp = tok.length > 24 ? `${tok.slice(0, 23)}…` : tok;
      const charW = avgCharWidthForBpmTag(disp, tagFont);
      const tw = Math.ceil(Math.min(innerW, Math.max(10, disp.length * charW + tagPadX * 2)));
      const th = tagFont + tagPadY * 2;
      if (cx + tw > innerX + innerW && cx > innerX) {
        cx = innerX;
        rowTop += rowMaxH + tagGap;
        rowMaxH = 0;
      }
      if (rowTop + th > maxBottom) break;
      cx += tw + tagGap;
      rowMaxH = Math.max(rowMaxH, th);
    }
    const usedH = rowTop - innerY + rowMaxH;
    return Math.max(0, usedH);
  }

  /**
   * @param {object} step
   * @param {number} cardW
   * @returns {number}
   */
  function estimateCardHeight(step, cardW, fieldLabelMap) {
    const kind = getBpmStepKind(step);
    const pad = 6;
    const innerW = cardW - 2 * pad;
    const maxChars = Math.max(6, Math.floor(innerW / (LAYOUT.bodyFont * 0.55)));
    const logicStr = pickLogicBodyText(step);
    const logicLines = wrapToLines(logicStr, maxChars, kind === 'decision' || kind === 'verify' ? 14 : 10);
    const logicH = 20 + logicLines.length * LAYOUT.bodyLineH;
    const flm = fieldLabelMap && typeof fieldLabelMap === 'object' ? fieldLabelMap : {};

    if (kind === 'verify' || kind === 'decision') {
      return Math.max(72, LAYOUT.titleBandH + pad + logicH + pad);
    }
    if (kind === 'input' || kind === 'trace') {
      const desc = pickNodeTitleText(step);
      const descLines = wrapToLines(desc, maxChars, 3);
      const descH = 14 + descLines.length * LAYOUT.bodyLineH;
      return Math.max(88, LAYOUT.titleBandH + pad + descH + logicH + pad);
    }
    if (kind === 'execute' || kind === 'other') {
      const desc = pickNodeTitleText(step);
      const descLines = wrapToLines(desc, maxChars, 3);
      const descH = 14 + descLines.length * LAYOUT.bodyLineH;
      const writeRaw = dbFieldsToTokens(step, ['db_write_fields'], ['write_fields']);
      const writeTok = writeRaw.map((t) => resolveDbFieldTokenForDisplay(t, flm));
      const headLabel = 16;
      const tagBlock = writeTok.length
        ? headLabel + layoutWriteTagsHeight(writeTok, 0, 0, innerW, 1e9) + pad
        : 0;
      return Math.max(96, LAYOUT.titleBandH + pad + descH + logicH + pad + tagBlock);
    }
    return 88;
  }

  /**
   * 端到端 BPM 卡风格：深色底 + 主题色描边/光晕 + 头行「编号条 + 阶段 pill」+ 内容区
   * @param {SVGSVGElement} rootSvg
   * @param {SVGGElement} parentGroup
   * @param {object} step
   * @param {number} cardX
   * @param {number} cardY
   * @param {number} cardW
   * @param {number} cardH
   * @param {string} glowFilterId
   * @param {string} clipId
   */
  function drawNodeCardClipped(
    rootSvg,
    parentGroup,
    step,
    cardX,
    cardY,
    cardW,
    cardH,
    glowFilterId,
    clipId,
    fieldLabelMap,
  ) {
    const pad = 6;
    const rx = 12;
    const headH = LAYOUT.titleBandH;
    const kind = getBpmStepKind(step);
    const th = themeForStepKind(kind);
    const flm = fieldLabelMap && typeof fieldLabelMap === 'object' ? fieldLabelMap : {};

    defineCardClip(rootSvg, clipId, cardX, cardY, cardW, cardH, rx);

    const root = document.createElementNS(NS, 'g');
    root.setAttribute('clip-path', `url(#${clipId})`);

    addRect(root, cardX, cardY, cardW, cardH, 'rgba(30, 41, 59, 0.92)', th.border, {
      rx,
      ry: rx,
      strokeWidth: 1.25,
      filter: glowFilterId ? `url(#${glowFilterId})` : undefined,
    });

    const innerW = cardW - 2 * pad;
    const idStr = pickBpmIdBadgeText(step);
    const pillStr = pickStagePillText(step);
    const charId = 5.2;
    const charPill = 8.5;
    let pillW = Math.min(innerW * 0.42, Math.max(36, pillStr.length * charPill + 14));
    let idW = Math.min(Math.max(40, idStr.length * charId + 12), innerW - pillW - 6);
    if (idW + pillW > innerW) {
      pillW = Math.min(pillW, innerW * 0.38);
      idW = innerW - pillW - 6;
    }
    const badgeY = cardY + pad;
    const badgeH = headH - 4;
    const idX = cardX + pad;
    addRect(root, idX, badgeY, idW, badgeH, th.idBadgeFill, th.idBadgeStroke, {
      rx: 8,
      ry: 8,
      strokeWidth: 1,
    });
    const idTe = document.createElementNS(NS, 'text');
    idTe.setAttribute('x', String(idX + 5));
    idTe.setAttribute('y', String(badgeY + badgeH / 2 + 3));
    idTe.setAttribute('font-size', '9');
    idTe.setAttribute('font-weight', '700');
    idTe.setAttribute('fill', th.idBadgeText);
    idTe.setAttribute('font-family', 'ui-monospace, Menlo, monospace');
    idTe.textContent = idStr;
    root.appendChild(idTe);

    const pillX = cardX + cardW - pad - pillW;
    addRect(root, pillX, badgeY, pillW, badgeH, th.pillFill, th.pillStroke, {
      rx: 10,
      ry: 10,
      strokeWidth: 1,
    });
    const pillTe = document.createElementNS(NS, 'text');
    pillTe.setAttribute('x', String(pillX + pillW / 2));
    pillTe.setAttribute('y', String(badgeY + badgeH / 2 + 3));
    pillTe.setAttribute('font-size', '10');
    pillTe.setAttribute('font-weight', '700');
    pillTe.setAttribute('fill', th.pillText);
    pillTe.setAttribute('text-anchor', 'middle');
    pillTe.textContent = pillStr.length > 8 ? `${pillStr.slice(0, 7)}…` : pillStr;
    root.appendChild(pillTe);

    let yBody = cardY + headH + 2;
    const bottomLimit = cardY + cardH - pad;
    const maxChars = Math.max(6, Math.floor(innerW / (LAYOUT.bodyFont * 0.55)));

    if (kind === 'input' || kind === 'trace' || kind === 'execute' || kind === 'other') {
      const descLabel = document.createElementNS(NS, 'text');
      descLabel.setAttribute('x', String(cardX + pad));
      descLabel.setAttribute('y', String(yBody + 9));
      descLabel.setAttribute('font-size', '9');
      descLabel.setAttribute('font-weight', '700');
      descLabel.setAttribute('fill', th.logicLabel);
      descLabel.textContent = '节点描述';
      root.appendChild(descLabel);
      yBody += 12;
      const descText = pickNodeTitleText(step);
      const descLines = wrapToLines(descText, maxChars, 3);
      appendTextLines(root, cardX + pad, yBody + 8, descLines, LAYOUT.bodyLineH, LAYOUT.bodyFont, false, th.titleText);
      yBody += descLines.length * LAYOUT.bodyLineH + 8;
    }

    const logicStr = pickLogicBodyText(step);
    const maxLogicLines =
      kind === 'verify' || kind === 'decision' ? 14 : kind === 'input' || kind === 'trace' ? 10 : 8;
    const logicLines = wrapToLines(logicStr, maxChars, maxLogicLines);
    const logicLabelText =
      kind === 'decision' ? '判断逻辑' : kind === 'verify' ? '校验逻辑' : '逻辑';
    const logicBoxH = Math.min(bottomLimit - yBody - 2, logicLines.length * LAYOUT.bodyLineH + 16);
    addRect(root, cardX + pad, yBody, innerW, logicBoxH, th.logicBoxFill, th.logicBoxStroke, {
      rx: 6,
      ry: 6,
      strokeWidth: 1,
    });
    const logicLabel = document.createElementNS(NS, 'text');
    logicLabel.setAttribute('x', String(cardX + pad + 4));
    logicLabel.setAttribute('y', String(yBody + 12));
    logicLabel.setAttribute('font-size', '10');
    logicLabel.setAttribute('font-weight', '700');
    logicLabel.setAttribute('fill', th.logicLabel);
    logicLabel.textContent = logicLabelText;
    root.appendChild(logicLabel);
    appendTextLines(
      root,
      cardX + pad + 4,
      yBody + 22,
      logicLines,
      LAYOUT.bodyLineH,
      LAYOUT.bodyFont,
      false,
      th.logicText,
    );
    yBody += logicLines.length * LAYOUT.bodyLineH + 20;

    if (kind === 'execute' || kind === 'other') {
      const writeRaw = dbFieldsToTokens(step, ['db_write_fields'], ['write_fields']);
      const writeDisp = writeRaw.map((t) => resolveDbFieldTokenForDisplay(t, flm));
      if (writeDisp.length && yBody < bottomLimit - 16) {
        const head = document.createElementNS(NS, 'text');
        head.setAttribute('x', String(cardX + pad));
        head.setAttribute('y', String(yBody + 10));
        head.setAttribute('font-size', '10');
        head.setAttribute('font-weight', '700');
        head.setAttribute('fill', th.writeHead);
        head.textContent = '写入字段';
        root.appendChild(head);
        yBody += 14;
        const tagFont = LAYOUT.tagFont;
        const tagPadX = 5;
        const tagPadY = 3;
        const tagGap = 4;
        let cx = cardX + pad;
        let rowTop = yBody;
        let rowMaxH = 0;
        for (let ti = 0; ti < writeDisp.length; ti++) {
          const dispFull = writeDisp[ti];
          const rawTok = writeRaw[ti] || dispFull;
          const disp = dispFull.length > 22 ? `${dispFull.slice(0, 21)}…` : dispFull;
          const charW = avgCharWidthForBpmTag(disp, tagFont);
          const tw = Math.ceil(Math.min(innerW, Math.max(10, disp.length * charW + tagPadX * 2)));
          const thTag = tagFont + tagPadY * 2;
          if (cx + tw > cardX + pad + innerW && cx > cardX + pad) {
            cx = cardX + pad;
            rowTop += rowMaxH + tagGap;
            rowMaxH = 0;
          }
          if (rowTop + thTag > bottomLimit) break;
          addRect(root, cx, rowTop, tw, thTag, th.writeTagBg, th.writeTagStroke, { rx: 4, ry: 4, strokeWidth: 1 });
          const te = document.createElementNS(NS, 'text');
          te.setAttribute('x', String(cx + tagPadX));
          te.setAttribute('y', String(rowTop + thTag / 2 + tagFont * 0.3));
          te.setAttribute('font-size', String(tagFont));
          te.setAttribute('fill', th.writeTagText);
          te.textContent = disp;
          if (rawTok) te.setAttribute('title', rawTok);
          root.appendChild(te);
          cx += tw + tagGap;
          rowMaxH = Math.max(rowMaxH, thTag);
        }
      }
    }

    parentGroup.appendChild(root);
  }

  /**
   * @param {SVGSVGElement} svg
   * @param {number} cx
   * @param {number} cy
   * @param {number} r
   * @param {string} label
   */
  function drawStartEndDisc(svg, cx, cy, r, label) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', String(cx));
    c.setAttribute('cy', String(cy));
    c.setAttribute('r', String(r));
    c.setAttribute('fill', '#2563eb');
    c.setAttribute('stroke', '#1d4ed8');
    c.setAttribute('stroke-width', '1.5');
    svg.appendChild(c);
    const te = document.createElementNS(NS, 'text');
    te.setAttribute('x', String(cx));
    te.setAttribute('y', String(cy + 4));
    te.setAttribute('font-size', '13');
    te.setAttribute('font-weight', '700');
    te.setAttribute('fill', '#ffffff');
    te.setAttribute('text-anchor', 'middle');
    te.textContent = label;
    svg.appendChild(te);
  }

  function pathLineOrBezier(svg, from, to, animate, crossLane) {
    let d;
    const useBezier = crossLane || isSlantedSegment(from, to);
    if (!useBezier) {
      d = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    } else {
      const { cp1, cp2 } = cubicControlPoints(from, to);
      d = `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${to.x} ${to.y}`;
    }
    const pathEl = document.createElementNS(NS, 'path');
    pathEl.setAttribute('d', d);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', EDGE_STROKE);
    pathEl.setAttribute('stroke-width', '2');
    svg.appendChild(pathEl);
    if (animate) addAnimatedArrowAlongPath(svg, d);
    return d;
  }

  /**
   * @param {HTMLElement} container
   * @param {object} model
   */
  function renderItDesignBpmSwimlaneSvg(container, model) {
    if (!container || !model || !Array.isArray(model.departments) || !Array.isArray(model.stages) || !Array.isArray(model.steps)) {
      return null;
    }

    const layoutModel = optimizeItDesignBpmSwimlaneModel(model);
    if (!layoutModel) return null;
    model = layoutModel;

    const rawFlm = model.field_label_map;
    const fieldLabelMap =
      rawFlm && typeof rawFlm === 'object' && !Array.isArray(rawFlm) ? rawFlm : {};

    const {
      laneWidth,
      titleBlockH,
      roleHeaderH,
      lanePadTop,
      lanePadBottom,
      cardInsetX,
      cardMinW,
      startEndR,
    } = LAYOUT;

    const nLanes = model.departments.length;
    const headerH = titleBlockH + roleHeaderH;
    const contentTop = headerH + lanePadTop;
    const totalW = nLanes * laneWidth;

    const validSteps = [];
    model.steps.forEach((step) => {
      const lane = model.departments.indexOf(step.dept);
      if (lane < 0) return;
      validSteps.push({ step, lane });
    });
    if (validSteps.length < 1) return null;

    const cardW = Math.max(cardMinW, laneWidth - 2 * cardInsetX);

    /** @type {number[]} */
    const heights = validSteps.map(({ step }) => estimateCardHeight(step, cardW, fieldLabelMap));

    /** @type {number[]} */
    const laneBottom = model.departments.map(() => contentTop);

    const firstLane = validSteps[0].lane;
    const startCx = firstLane * laneWidth + laneWidth / 2;
    const startCy = laneBottom[firstLane] + startEndR;
    laneBottom[firstLane] = startCy + startEndR;

    const h0 = heights[0];
    let yTop0 = laneBottom[firstLane] + h0 / 3;
    /** @type {{ step: object, lane: number, rect: object, kind: string, anchorM: object, anchorN: object, anchorOut: object, anchorIn: object }[]} */
    const placements = [];

    for (let i = 0; i < validSteps.length; i++) {
      const { step, lane } = validSteps[i];
      const h = heights[i];
      let yTop;
      if (i === 0) {
        yTop = yTop0;
      } else {
        const prevLane = validSteps[i - 1].lane;
        const prevH = heights[i - 1];
        const prevRect = placements[i - 1].rect;
        const prevBottom = prevRect.y + prevRect.height;
        const gapPrev = prevH / 3;
        if (lane === prevLane) {
          yTop = prevBottom + gapPrev;
        } else {
          const H1 = laneBottom[lane];
          const H2 = prevBottom;
          yTop = Math.max(H1, H2) + h / 3;
        }
      }

      const cardX = lane * laneWidth + (laneWidth - cardW) / 2;
      const rect = { x: cardX, y: yTop, width: cardW, height: h };
      const kind = getBpmStepKind(step);
      const anchorIn = topMid(rect);
      const anchorOut = bottomMid(rect);

      placements.push({
        step,
        lane,
        rect,
        kind,
        anchorIn,
        anchorOut,
      });

      laneBottom[lane] = Math.max(laneBottom[lane], yTop + h);
    }

    const last = placements[placements.length - 1];
    const lastBottom = last.rect.y + last.rect.height;
    const lastH = heights[heights.length - 1];
    const endLane = last.lane;
    const gapEnd = lastH / 3;
    const endCy = lastBottom + gapEnd + startEndR;
    const endCx = endLane * laneWidth + laneWidth / 2;

    laneBottom[endLane] = Math.max(laneBottom[endLane], endCy + startEndR);
    const totalH = Math.max(...laneBottom) + lanePadBottom;

    container.innerHTML = '';
    const viewport = document.createElement('div');
    viewport.className =
      nLanes === 1
        ? 'it-design-bpm-swimlane-viewport it-design-bpm-swimlane-viewport--single-lane'
        : 'it-design-bpm-swimlane-viewport';

    const stickyHead = document.createElement('div');
    stickyHead.className = 'it-design-bpm-swimlane-sticky';

    const svgHeader = document.createElementNS(NS, 'svg');
    svgHeader.setAttribute('xmlns', NS);
    svgHeader.setAttribute('viewBox', `0 0 ${totalW} ${headerH}`);
    svgHeader.setAttribute('width', '100%');
    svgHeader.setAttribute('height', String(headerH));
    svgHeader.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    svgHeader.classList.add('it-design-bpm-swimlane-svg', 'it-design-bpm-swimlane-svg--header');

    addRect(svgHeader, 0, 0, totalW, headerH, SWIM_BG);
    addRect(svgHeader, 0, 0, totalW, titleBlockH, SWIM_TITLE_BG);

    const flowTitleText = String(model.flow_title || '').trim();
    const headerTitleFont = 14;
    const headerTitleLine = 16;
    if (flowTitleText) {
      const tMaxChars = Math.max(8, Math.floor((totalW - 24) / (headerTitleFont * 0.55)));
      const tLines = wrapToLines(flowTitleText, tMaxChars, 2);
      const tBlock = tLines.length * headerTitleLine;
      const tY0 = titleBlockH / 2 - tBlock / 2 + headerTitleFont * 0.85;
      appendTextLinesCentered(svgHeader, totalW / 2, tY0, tLines, headerTitleLine, headerTitleFont, true, '#f1f5f9');
    } else {
      appendTextLinesCentered(
        svgHeader,
        totalW / 2,
        titleBlockH / 2 + 5,
        ['—'],
        headerTitleLine,
        headerTitleFont,
        true,
        '#94a3b8',
      );
    }

    const roleHeadFont = 13;
    const roleHeadLine = 15;
    for (let l = 0; l < nLanes; l++) {
      const x = l * laneWidth;
      addRect(svgHeader, x, titleBlockH, laneWidth, roleHeaderH, SWIM_HEADER_BG);
      const name = String(model.departments[l] || '');
      const nmChars = Math.max(4, Math.floor((laneWidth - 12) / (roleHeadFont * 0.55)));
      const nmLines = wrapToLines(name, nmChars, 3);
      const blockH = nmLines.length * roleHeadLine;
      const y0 = titleBlockH + roleHeaderH / 2 - blockH / 2 + roleHeadFont * 0.85;
      appendTextLinesCentered(svgHeader, x + laneWidth / 2, y0, nmLines, roleHeadLine, roleHeadFont, true, '#e2e8f0');
    }

    addLine(svgHeader, 0, headerH, totalW, headerH, LANE_DIVIDER_STROKE, 1);
    stickyHead.appendChild(svgHeader);
    viewport.appendChild(stickyHead);

    const bodyH = totalH - headerH;
    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'it-design-bpm-swimlane-body';
    const ty = (y) => y - headerH;

    const svgBody = document.createElementNS(NS, 'svg');
    svgBody.setAttribute('xmlns', NS);
    svgBody.setAttribute('viewBox', `0 0 ${totalW} ${bodyH}`);
    svgBody.setAttribute('width', '100%');
    svgBody.setAttribute('height', String(bodyH));
    svgBody.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    svgBody.classList.add('it-design-bpm-swimlane-svg', 'it-design-bpm-swimlane-svg--body');

    const glowIdPrefix = `itBpm_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6)}`;
    const defs = document.createElementNS(NS, 'defs');
    const glowKinds = ['input', 'verify', 'decision', 'execute', 'trace', 'other'];
    glowKinds.forEach((k) => {
      appendGlowFilter(defs, `itBpmGlow_${glowIdPrefix}_${k}`, themeForStepKind(k).glow);
    });
    svgBody.appendChild(defs);

    addRect(svgBody, 0, 0, totalW, bodyH, SWIM_BG);
    for (let l = 0; l < nLanes; l++) {
      const x = l * laneWidth;
      const stripe = l % 2 === 1 ? SWIM_LANE_STRIPE : 'transparent';
      if (stripe !== 'transparent') {
        addRect(svgBody, x, 0, laneWidth, bodyH, stripe);
      }
    }
    for (let l = 1; l < nLanes; l++) {
      const x = l * laneWidth;
      addLine(svgBody, x, 0, x, bodyH, LANE_DIVIDER_STROKE, 1);
    }

    const startBottom = { x: startCx, y: startCy + startEndR };
    const endTop = { x: endCx, y: endCy - startEndR };

    /** @type {object[]} */
    const edges = [];

    const adjust = (p) => ({ x: p.x, y: ty(p.y) });

    const connectBody = (from, to, kind, animate, crossLane) => {
      const d = pathLineOrBezier(svgBody, adjust(from), adjust(to), animate, crossLane);
      edges.push({ kind, pathD: d });
    };

    connectBody(startBottom, placements[0].anchorIn, 'start-first', true, false);

    for (let i = 0; i < placements.length - 1; i++) {
      const a = placements[i];
      const b = placements[i + 1];
      const from = a.anchorOut;
      const to = b.anchorIn;
      const crossLane = a.lane !== b.lane;
      connectBody(from, to, crossLane ? 'seq-bezier' : 'seq-line', true, crossLane);
    }

    const lastP = placements[placements.length - 1];
    connectBody(lastP.anchorOut, endTop, 'last-end', true, false);

    drawStartEndDisc(svgBody, startCx, ty(startCy), startEndR, '开始');

    const nodesLayer = document.createElementNS(NS, 'g');
    /** 先缓存节点绘制：需在边之后叠在边上，故第二遍绘节点 */
    svgBody.appendChild(nodesLayer);

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      const clipId = `itBpmClip_${glowIdPrefix}_${i}`;
      const k = getBpmStepKind(p.step);
      drawNodeCardClipped(
        svgBody,
        nodesLayer,
        p.step,
        p.rect.x,
        ty(p.rect.y),
        p.rect.width,
        p.rect.height,
        `itBpmGlow_${glowIdPrefix}_${k}`,
        clipId,
        fieldLabelMap,
      );
    }

    drawStartEndDisc(svgBody, endCx, ty(endCy), startEndR, '结束');

    bodyWrap.appendChild(svgBody);
    viewport.appendChild(bodyWrap);
    container.appendChild(viewport);

    return {
      canvas: { width: totalW, height: totalH },
      grid: { ...LAYOUT },
      placements,
      edges,
    };
  }

  /**
   * @param {object} model
   * @param {object | null} layout
   */
  function buildItDesignBpmFlowExportDocument(model, layout) {
    const m0 = optimizeItDesignBpmSwimlaneModel(model) || model;
    const steps = (m0.steps || []).map((s, i) => {
      const base = {
        id: s.id,
        text: s.sentence,
        stage: s.stage,
        dept: s.dept,
        order: i + 1,
        next: i < m0.steps.length - 1 ? m0.steps[i + 1].id : null,
      };
      const nd = String(s.node_description ?? s.description ?? s.desc ?? '').trim();
      const lt = String(s.logic_text ?? s.logic ?? '').trim();
      if (nd) base.node_description = nd;
      if (lt) base.logic_text = lt;
      const w = s.db_write_fields;
      const r = s.db_ref_fields;
      const c = s.db_compute_fields;
      if (w != null && String(w).trim()) base.db_write_fields = w;
      if (r != null && String(r).trim()) base.db_ref_fields = r;
      if (c != null && String(c).trim()) base.db_compute_fields = c;
      if (s.branch_no_to != null && !Number.isNaN(Number(s.branch_no_to))) {
        base.branch_no_to = Number(s.branch_no_to);
      }
      return base;
    });

    const doc = {
      format_version: m0.format_version || FORMAT_VERSION,
      flow_title: m0.flow_title || '',
      stages: (m0.stages || []).slice(),
      departments: (m0.departments || []).slice(),
      steps,
    };

    if (layout) {
      doc.layout = layout;
    }

    return doc;
  }

  global.IT_DESIGN_BPM_FLOW_FORMAT_VERSION = FORMAT_VERSION;
  global.optimizeItDesignBpmSwimlaneModel = optimizeItDesignBpmSwimlaneModel;
  global.renderItDesignBpmSwimlaneSvg = renderItDesignBpmSwimlaneSvg;
  global.buildItDesignBpmFlowExportDocument = buildItDesignBpmFlowExportDocument;
})(typeof window !== 'undefined' ? window : this);
