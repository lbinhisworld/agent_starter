/**
 * [INPUT]: 全局 `escapeHtml`（utils.js，可选）
 * [OUTPUT]: `buildObjectStateMachineWorkspaceView` / `setupObjectStateMachineWorkspace` — task9 对象状态机 SVG 视图
 * [POS]: 详情工作区「对象状态机构建」view 面板渲染与交互
 *
 * [PROTOCOL]: 变更 JSON 解析规则或 SVG 结构时同步 `frontend/js/core/problem-detail-runtime.js`、`frontend/styles.css`、`frontend/js/AGENTS.md`
 * FE-20260411：padding-bottom 占位盒 + 内层 SVG 绝对定位适配工作区。
 * FE-20260412：computeLayout 忽略自环边做分层；层内按 visual_tier 排布（Tier1 居中）；平行边控制点偏移；自环贝塞尔；标签沿法线偏移；pathLength + stroke-dashoffset 流动动画。
 * FE-20260413：分层上限 maxLayer（6）超限压入最后一层；viewBox 宽度按节点 pos 右缘计算；intrinsicPct 下限与宽图横向滚动布局。
 * FE-20260414：分层松弛时跳过回溯边（目标层级小于源）；自环改为节点上方圆弧；GAP_X 收紧；viewBox 宽高由 pos 的 max(x)/max(y) 推导。
 */
(function (global) {
  const NODE_W = 156;
  const NODE_H = 64;
  const GAP_X = 70;
  const GAP_Y = 36;
  const PAD = 32;
  const PARALLEL_OFF = 28;
  const PATH_LEN_NORM = 100;
  /** 分层最大层数（层索引 0 … MAX_LAYERS-1），超出则压到最后一层，避免 viewBox 过宽 */
  const MAX_LAYERS = 6;
  /** 非横向滚动时，padding-bottom 百分比下限，缓解 width≫height 时占位过扁、meet 缩放过小 */
  const OSM_MIN_INTRINSIC_PCT = 36;
  /** 宽图时启用横向滚动：viewBox 宽高比超过该值则不用 aspect 盒 + meet */
  const OSM_WIDE_SCROLL_W_H = 3.75;

  function normalizeStates(raw) {
    const arr = Array.isArray(raw.states) ? raw.states : Array.isArray(raw.States) ? raw.States : [];
    return arr
      .map((s) => {
        const id = String(s.id ?? s.Id ?? s.state_id ?? '').trim();
        if (!id) return null;
        return {
          id,
          label: String(s.label ?? s.Label ?? s.name ?? id).trim() || id,
          visual_tier: Number(s.visual_tier ?? s.visualTier ?? s.tier) || 2,
          permissions: Array.isArray(s.permissions) ? s.permissions : [],
          value_proposition: s.value_proposition != null ? String(s.value_proposition) : '',
          commitment_proof: s.commitment_proof != null ? String(s.commitment_proof) : '',
        };
      })
      .filter(Boolean);
  }

  function normalizeTransitions(raw) {
    const arr = Array.isArray(raw.transitions) ? raw.transitions : Array.isArray(raw.Transitions) ? raw.Transitions : [];
    return arr.map((t) => ({
      from: String(t.from ?? t.From ?? '').trim(),
      to: String(t.to ?? t.To ?? '').trim(),
      event: t.event != null ? String(t.event) : '',
      trigger_type: t.trigger_type != null ? String(t.trigger_type) : '',
      is_risk_path: !!(t.is_risk_path ?? t.isRiskPath),
      animation_hint: String(t.animation_hint ?? t.animationHint ?? 'flow').toLowerCase(),
      consideration: t.consideration,
      commitment_proof: t.commitment_proof != null ? String(t.commitment_proof) : '',
    }));
  }

  function considerationText(c) {
    if (c == null || c === '') return '';
    if (typeof c === 'string') return c;
    if (typeof c === 'object') {
      const type = c.type != null ? String(c.type) : '';
      const desc = c.description != null ? String(c.description) : '';
      return [type, desc].filter(Boolean).join(' — ');
    }
    return String(c);
  }

  /**
   * 层内纵向顺序：Tier1 占据中间连续行，Tier3 优先占上下空位，Tier2 填满剩余。
   * @param {string[]} ids
   * @param {Record<string, { visual_tier?: number }>} stateById
   */
  function orderLayerIdsByTier(ids, stateById) {
    if (ids.length <= 1) return ids.slice().sort();
    const tierOf = (id) => {
      const t = Number(stateById[id]?.visual_tier);
      if (t === 1) return 1;
      if (t === 3) return 3;
      return 2;
    };
    const t1 = ids.filter((id) => tierOf(id) === 1).sort();
    const t2 = ids.filter((id) => tierOf(id) === 2).sort();
    const t3 = ids.filter((id) => tierOf(id) === 3).sort();
    const k = ids.length;
    const slots = new Array(k).fill(null);
    const t1n = t1.length;
    let start = Math.floor((k - t1n) / 2);
    if (start < 0) start = 0;
    if (start + t1n > k) start = Math.max(0, k - t1n);
    t1.forEach((id, i) => {
      const p = start + i;
      if (p >= 0 && p < k) slots[p] = id;
    });
    let lo = 0;
    let hi = k - 1;
    t3.forEach((id) => {
      while (lo < k && slots[lo] != null) lo++;
      while (hi >= 0 && slots[hi] != null) hi--;
      if (lo <= hi) {
        if (slots[lo] == null) slots[lo++] = id;
        else if (slots[hi] == null) slots[hi--] = id;
        else {
          const j = slots.findIndex((s) => s == null);
          if (j >= 0) slots[j] = id;
        }
      }
    });
    let t2i = 0;
    for (let i = 0; i < k; i++) if (slots[i] == null) slots[i] = t2[t2i++];
    return slots;
  }

  /**
   * 分层：自环边不参与 layer 松弛，避免 S→S 把层推爆。
   * @param {{ id: string }[]} states
   * @param {{ from: string, to: string }[]} transitions
   */
  function computeLayout(states, transitions) {
    const idSet = new Set(states.map((s) => s.id));
    const stateById = Object.fromEntries(states.map((s) => [s.id, s]));
    const layer = {};
    states.forEach((s) => {
      layer[s.id] = 0;
    });

    let changed = true;
    let iter = 0;
    const maxIter = Math.max(12, states.length * 4);
    while (changed && iter++ < maxIter) {
      changed = false;
      transitions.forEach((t) => {
        if (!idSet.has(t.from) || !idSet.has(t.to)) return;
        if (t.from === t.to) return;
        const lf = layer[t.from] ?? 0;
        const lt = layer[t.to] ?? 0;
        // 回溯：目标已在更小层级，不抬高 layer[to]，避免环上反复迭代把 maxL 撑爆
        if (lt < lf) return;
        const next = lf + 1;
        if (next > lt) {
          layer[t.to] = next;
          changed = true;
        }
      });
    }

    let rawMaxL = 0;
    states.forEach((s) => {
      rawMaxL = Math.max(rawMaxL, layer[s.id] ?? 0);
    });
    const maxLayerIndex = MAX_LAYERS - 1;
    const layerWasClamped = rawMaxL > maxLayerIndex;
    if (layerWasClamped) {
      states.forEach((s) => {
        const L = layer[s.id] ?? 0;
        if (L > maxLayerIndex) layer[s.id] = maxLayerIndex;
      });
    }

    const byLayer = new Map();
    let maxL = 0;
    states.forEach((s) => {
      const L = layer[s.id] ?? 0;
      maxL = Math.max(maxL, L);
      if (!byLayer.has(L)) byLayer.set(L, []);
      byLayer.get(L).push(s.id);
    });

    const hasSelfLoop = transitions.some((t) => idSet.has(t.from) && t.from === t.to);
    /** 自环圆弧向上抬起，需在首行节点之上留空，避免 viewBox 裁切 */
    const topArcSlack = hasSelfLoop ? 44 : 0;

    const pos = {};
    let maxRow = 0;
    const sortedLayers = Array.from(byLayer.keys()).sort((a, b) => a - b);
    sortedLayers.forEach((L) => {
      const rawIds = byLayer.get(L) || [];
      const ordered = orderLayerIdsByTier(rawIds, stateById);
      maxRow = Math.max(maxRow, ordered.length);
      ordered.forEach((id, row) => {
        pos[id] = {
          x: PAD + L * (NODE_W + GAP_X),
          y: topArcSlack + PAD + row * (NODE_H + GAP_Y),
        };
      });
    });

    const allX = Object.values(pos).map((p) => p.x);
    const allY = Object.values(pos).map((p) => p.y);
    const width = Math.max(PAD, ...allX) + NODE_W + PAD;
    const height = Math.max(PAD, ...allY) + NODE_H + PAD;

    return { pos, width, height, layer, maxL, layerWasClamped, stateById };
  }

  /** 三次贝塞尔上一点 */
  function cubicPt(t, x0, y0, cx1, cy1, cx2, cy2, x3, y3) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    return {
      x: uuu * x0 + 3 * uu * t * cx1 + 3 * u * tt * cx2 + ttt * x3,
      y: uuu * y0 + 3 * uu * t * cy1 + 3 * u * tt * cy2 + ttt * y3,
    };
  }

  /** 切线方向（未单位化） */
  function cubicTan(t, x0, y0, cx1, cy1, cx2, cy2, x3, y3) {
    const u = 1 - t;
    const uu = u * u;
    const tt = t * t;
    const dx =
      -3 * uu * x0 + 3 * (uu - 2 * u * t) * cx1 + 3 * (2 * u * t - tt) * cx2 + 3 * tt * x3;
    const dy =
      -3 * uu * y0 + 3 * (uu - 2 * u * t) * cy1 + 3 * (2 * u * t - tt) * cy2 + 3 * tt * y3;
    return { x: dx, y: dy };
  }

  /**
   * 标签放在曲线某 t 处，沿法线抬升，减少压线
   * @param {number} tPrefer — 曲率较大区域略偏开 0.5
   */
  function labelPosOnCubic(tPrefer, x0, y0, cx1, cy1, cx2, cy2, x3, y3, normalFlip) {
    let t = tPrefer;
    const tan0 = cubicTan(0.45, x0, y0, cx1, cy1, cx2, cy2, x3, y3);
    const tan1 = cubicTan(0.55, x0, y0, cx1, cy1, cx2, cy2, x3, y3);
    const c0 = Math.hypot(tan0.x, tan0.y) || 1;
    const c1 = Math.hypot(tan1.x, tan1.y) || 1;
    if (c0 > c1 * 1.15) t = 0.42;
    else if (c1 > c0 * 1.15) t = 0.58;
    const pt = cubicPt(t, x0, y0, cx1, cy1, cx2, cy2, x3, y3);
    const tan = cubicTan(t, x0, y0, cx1, cy1, cx2, cy2, x3, y3);
    let len = Math.hypot(tan.x, tan.y);
    if (len < 1e-6) len = 1;
    const nx = ((-tan.y / len) * normalFlip);
    const ny = ((tan.x / len) * normalFlip);
    const lift = 16;
    return { x: pt.x + nx * lift, y: pt.y + ny * lift + 4 };
  }

  /**
   * 自环：节点顶边之上的圆弧（SVG A，圆心在弦下方、拱顶向上）
   * @returns {{ d: string, lx: number, ly: number }}
   */
  function selfLoopArc(px, py, slot) {
    const inset = 18 + slot * 5;
    const xL = px + inset;
    const xR = px + NODE_W - inset;
    const mid = px + NODE_W / 2;
    const halfW = Math.max(14, (xR - xL) / 2);
    let h = 22 + slot * 12;
    if (h >= halfW - 4) h = Math.max(14, halfW - 8);
    const R = (halfW * halfW + h * h) / (2 * h);
    const sweep = 1;
    const d = `M ${xL} ${py} A ${R} ${R} 0 0 ${sweep} ${xR} ${py}`;
    return {
      d,
      lx: mid,
      ly: py - h - 10,
    };
  }

  function edgeAnimClass(t) {
    if (t.is_risk_path) return 'osm-edge-anim-shake';
    const h = (t.animation_hint || 'flow').toLowerCase();
    if (h === 'dash') return 'osm-edge-anim-dash';
    if (h === 'pulse') return 'osm-edge-anim-pulse';
    if (h === 'shake') return 'osm-edge-anim-shake';
    return 'osm-edge-anim-flow';
  }

  function proofForState(stateId, state, transitions) {
    if (state.commitment_proof) return state.commitment_proof;
    const out = transitions.find((tr) => tr.from === stateId && tr.commitment_proof);
    return out ? out.commitment_proof : '';
  }

  function proofIconSvg() {
    return (
      '<g class="osm-node-proof" aria-hidden="true">' +
      '<rect x="0" y="0" width="16" height="16" rx="3" fill="rgba(0,0,0,0.12)"/>' +
      '<path d="M4 6h8v7H4z M5 6V5a1.5 1.5 0 0 1 3 0v1" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
      '</g>'
    );
  }

  function buildPairStats(transList) {
    const pairCounts = new Map();
    const selfCounts = new Map();
    transList.forEach((t) => {
      if (t.from === t.to) {
        selfCounts.set(t.from, (selfCounts.get(t.from) || 0) + 1);
      } else {
        const k = `${t.from}\0${t.to}`;
        pairCounts.set(k, (pairCounts.get(k) || 0) + 1);
      }
    });
    return { pairCounts, selfCounts };
  }

  /**
   * @param {object} sm
   * @param {(s: string) => string} esc
   * @returns {string}
   */
  function buildObjectStateMachineWorkspaceView(sm, esc) {
    if (!sm || typeof sm !== 'object') {
      return '<p class="problem-detail-local-itgap-pending">暂无状态机数据。</p>';
    }
    const states = normalizeStates(sm);
    const transitions = normalizeTransitions(sm);
    if (!states.length) {
      return '<p class="problem-detail-local-itgap-pending">状态机 JSON 中无有效 states，无法绘制。</p>';
    }

    const meta = sm.resource_metadata || sm.resourceMetadata || {};
    const metaLine =
      (meta.resource_id || meta.icon_type) &&
      `<div class="osm-meta-line"><span class="osm-meta-id">${esc(String(meta.resource_id || '—'))}</span>${
        meta.icon_type ? `<span class="osm-meta-icon-type">${esc(String(meta.icon_type))}</span>` : ''
      }</div>`;

    const validTrans = transitions.filter((t) => states.some((s) => s.id === t.from) && states.some((s) => s.id === t.to));
    const { pos, width, height, layerWasClamped } = computeLayout(states, validTrans);
    const { pairCounts } = buildPairStats(validTrans);
    const parallelRunning = new Map();
    const selfLoopRunning = new Map();

    let edgesSvg = '';
    validTrans.forEach((t, idx) => {
      const p0 = pos[t.from];
      const p1 = pos[t.to];
      if (!p0 || !p1) return;

      let d;
      let lx;
      let ly;
      let normalFlip = 1;

      if (t.from === t.to) {
        const si = selfLoopRunning.get(t.from) || 0;
        selfLoopRunning.set(t.from, si + 1);
        const arc = selfLoopArc(p0.x, p0.y, si);
        d = arc.d;
        lx = arc.lx;
        ly = arc.ly;
      } else {
        const x0 = p0.x + NODE_W;
        const y0 = p0.y + NODE_H / 2;
        const x1 = p1.x;
        const y1 = p1.y + NODE_H / 2;
        const key = `${t.from}\0${t.to}`;
        const nPar = pairCounts.get(key) || 1;
        const pSlot = parallelRunning.get(key) || 0;
        parallelRunning.set(key, pSlot + 1);
        const off = nPar <= 1 ? 0 : (pSlot - (nPar - 1) / 2) * PARALLEL_OFF;
        const backward = x1 + 0.5 < x0;

        if (backward) {
          const bowY = Math.max(y0, y1) + 88 + off;
          const cx1 = x0 + 56;
          const cy1 = bowY;
          const cx2 = x1 - 56;
          const cy2 = bowY;
          d = `M ${x0} ${y0} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x1} ${y1}`;
          const lp = labelPosOnCubic(0.5, x0, y0, cx1, cy1, cx2, cy2, x1, y1, -1);
          lx = lp.x;
          ly = lp.y - 8;
        } else {
          const midX = (x0 + x1) / 2;
          const cx1 = midX;
          const cy1 = y0 + off;
          const cx2 = midX;
          const cy2 = y1 + off;
          d = `M ${x0} ${y0} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x1} ${y1}`;
          normalFlip = off >= 0 ? 1 : -1;
          const lp = labelPosOnCubic(0.5, x0, y0, cx1, cy1, cx2, cy2, x1, y1, normalFlip);
          lx = lp.x;
          ly = lp.y;
        }
      }

      const cons = considerationText(t.consideration);
      const label = cons.length > 42 ? `${cons.slice(0, 40)}…` : cons;
      const anim = edgeAnimClass(t);
      const strokeRisk = t.is_risk_path || anim === 'osm-edge-anim-shake' ? 'var(--osm-edge-risk, #c62828)' : 'var(--osm-edge-stroke, #5c6bc0)';

      let edgePayload;
      try {
        edgePayload = encodeURIComponent(JSON.stringify(t));
      } catch (_) {
        edgePayload = '';
      }

      const labelEsc = esc(label || t.event || 'transition');
      edgesSvg += `<g class="osm-edge-group" data-osm-edge-payload="${edgePayload}" data-osm-edge-idx="${idx}">
        <path class="osm-edge-hit" d="${d}" fill="none" stroke="transparent" stroke-width="22" stroke-linecap="round" pathLength="${PATH_LEN_NORM}" />
        <path class="osm-edge ${anim}" d="${d}" fill="none" stroke="${strokeRisk}" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" pathLength="${PATH_LEN_NORM}" />
        <text class="osm-edge-label" x="${lx}" y="${ly}" text-anchor="middle" font-size="11">${labelEsc}</text>
      </g>`;
    });

    let nodesSvg = '';
    states.forEach((s) => {
      const p = pos[s.id];
      if (!p) return;
      const tier = Number(s.visual_tier) === 1 ? 'osm-node--tier1' : Number(s.visual_tier) === 3 ? 'osm-node--tier3' : 'osm-node--tier2';
      const proof = proofForState(s.id, s, validTrans);
      const permStr = s.permissions.length ? s.permissions.map(String).join(', ') : '—';
      const tip = `${esc(permStr)}\n${esc(s.value_proposition || '—')}`;
      const proofG = proof ? `<g transform="translate(${NODE_W - 20}, ${NODE_H - 20})">${proofIconSvg()}</g>` : '';

      nodesSvg += `<g class="osm-node-group" transform="translate(${p.x},${p.y})">
        <title>${tip}</title>
        <rect class="osm-node ${tier}" width="${NODE_W}" height="${NODE_H}" rx="10" />
        <text class="osm-node-label" x="${NODE_W / 2}" y="${NODE_H / 2 + 4}" text-anchor="middle" font-size="13">${esc(s.label)}</text>
        ${proofG}
      </g>`;
    });

    const wh = width / Math.max(height, 1);
    const useWideScroll = layerWasClamped || wh > OSM_WIDE_SCROLL_W_H;

    const svgInner = `<g class="osm-edges">${edgesSvg}</g>
      <g class="osm-nodes">${nodesSvg}</g>`;

    let svg;
    if (useWideScroll) {
      svg = `<div class="osm-svg-wide-wrap"><svg class="osm-svg osm-svg--wide" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" aria-label="对象状态机" preserveAspectRatio="xMinYMin meet">${svgInner}</svg></div>`;
    } else {
      const intrinsicRaw = width > 0 ? (height / width) * 100 : 50;
      const intrinsicPctLifted = Math.max(OSM_MIN_INTRINSIC_PCT, intrinsicRaw);
      const minPadBottomPct = 22;
      const padBottomPct = Math.min(95, Math.max(intrinsicPctLifted, minPadBottomPct));
      svg = `<div class="osm-svg-aspect-wrap" style="padding-bottom:${padBottomPct}%;">
      <svg class="osm-svg osm-svg--in-aspect" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" aria-label="对象状态机" preserveAspectRatio="xMidYMid meet">${svgInner}</svg></div>`;
    }

    return `
      <div class="osm-workspace-root">
        ${metaLine || ''}
        <div class="osm-svg-scroll${useWideScroll ? ' osm-svg-scroll--wide-h' : ''}">${svg}</div>
        <div class="osm-edge-detail" data-osm-edge-detail hidden>
          <div class="osm-edge-detail-title">跳转详情（点击连线查看）</div>
          <pre class="osm-edge-detail-pre"></pre>
        </div>
      </div>`;
  }

  /**
   * @param {HTMLElement | null} root
   */
  function setupObjectStateMachineWorkspace(root) {
    if (!root || root.dataset.osmBound === '1') return;
    root.dataset.osmBound = '1';
    const detail = root.querySelector('[data-osm-edge-detail]');
    const pre = detail && detail.querySelector('.osm-edge-detail-pre');
    const groups = root.querySelectorAll('.osm-edge-group');

    function clearActive() {
      groups.forEach((g) => g.classList.remove('osm-edge-group--active'));
    }

    function showDetail(payloadStr) {
      if (!detail || !pre) return;
      let obj = null;
      try {
        obj = JSON.parse(decodeURIComponent(payloadStr));
      } catch (_) {}
      if (!obj) {
        detail.hidden = true;
        pre.textContent = '';
        return;
      }
      const lines = [
        `from → to: ${obj.from} → ${obj.to}`,
        obj.event ? `event: ${obj.event}` : '',
        obj.trigger_type ? `trigger_type: ${obj.trigger_type}` : '',
        `is_risk_path: ${!!obj.is_risk_path}`,
        obj.animation_hint ? `animation_hint: ${obj.animation_hint}` : '',
        '',
        'consideration:',
        considerationText(obj.consideration) || '—',
        '',
        obj.commitment_proof ? `commitment_proof: ${obj.commitment_proof}` : '',
      ].filter((x) => x !== '');
      pre.textContent = lines.join('\n');
      detail.hidden = false;
    }

    groups.forEach((g) => {
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        const pay = g.getAttribute('data-osm-edge-payload');
        if (!pay) return;
        clearActive();
        g.classList.add('osm-edge-group--active');
        showDetail(pay);
      });
    });

    root.addEventListener('click', (e) => {
      if (e.target.closest('.osm-edge-group')) return;
      clearActive();
      if (detail) detail.hidden = true;
    });
  }

  global.buildObjectStateMachineWorkspaceView = buildObjectStateMachineWorkspaceView;
  global.setupObjectStateMachineWorkspace = setupObjectStateMachineWorkspace;
})(typeof globalThis !== 'undefined' ? globalThis : window);
