/**
 * 价值流解析与渲染（依赖 js/config.js、js/utils.js；需在 main 中提供 el、currentValueStreamList 或由 main 在调用前设置）
 *
 * [PROTOCOL]: 阶段编号 `S.n`（阶段标题卡右上角 `.vs-stage-id-badge`）；环节编号 `N.{阶段序}.{环节序}` 写入 `canonicalNodeId` 与 `vsmL2.node_id`（徽标 `buildVsNodeIdBadgeHtml` / `buildVsmL2NodeIdBadgeHtml`）；L2 子卡片见 `VSM_L2_FIELD_LABEL_ZH`；聚合逻辑卡 `.vs-clustering-logic-label`；端到端横向图 `.vs-e2e-it-pain-nest`（`<details>` 默认折叠，内嵌 IT现状 / IT假话(itPlan) / 痛点）；task7 业务事务流 BPM 视图 `renderE2eBpmTransactionFlowHTML`（`stages[]` 下 `.e2e-bpm-stage-body` 内事务卡**纵向满宽左对齐**；每卡标题栏左侧折叠钮（首张默认展开、其余默认折叠）+「transaction_id｜name〔｜角色 chip…〕」（`bpm_detailed_flow` 任一步 `e2e_gap_supplement===true` 时名称用 `.e2e-bpm-tx-node-head-name--gap-supplement` 绿色）+ 成图预览；正文仅「BPM 流程设计」子卡内 `bpm_detailed_flow` 节点卡以**蓝色 →**间隔、条带 `flex-wrap`；**同条带内节点卡固定同宽同高**；**bpm_node_id** 与 **type** 圆角标签**同一行**（`.e2e-bpm-tx-bpm-step-head-row`）；**决策/执行** 且存在 `core_object_state_changes` 时展示子卡「核心对象状态变更」列表（`buildCoreObjectStateChangeLineHtml` 统一为「对象｜A → B」、对象绿 / A 橙 / B 蓝；`stripE2eCoreStateDisplayStatusPrefix` 去掉 A/B 前缀「状态 」）；编号字略小、过长省略；按 `type` 含「输入/核验/决策/留痕/执行」套绿/黄/蓝/橙/紫主题（`.e2e-bpm-tx-bpm-step-card--*`）；**无**单卡 json Tab（整图 JSON 用外层端到端卡 json）；或扁平 `transaction_nodes`）；`setupProblemDetailE2eBpmTxPreview` 委托成图预览抽屉与折叠；`buildE2eBpmTransactionFlowPreviewDiagramHTML` + `syncE2eBpmPreviewDiagramWires` 供右侧「事务流程图预览」（`.e2e-bpm-preview-port` 端口、布局后清除 `.e2e-bpm-preview-wire-layer` 再绘连线；`drawGatewayT` 固定 `[oPass,oFail]`、T 型 `yBar` 钳位；无 `gw-col--fail` DOM，失败腿锚点取 `gateway-split` 右缘外偏（`E2E_BPM_FAIL_RAIL_OUTSET_PX`）+ 包围盒右扩避免裁切；异列 `connectPorts` 横杠贴目的地 `y`；`__FE_E2E_BPM_WIRE_DEBUG`；SVG 包围盒 + 曼哈顿折线）；样式 `.e2e-bpm-preview-*` / `.e2e-bpm-tx-*`；`.vs-graph-scroll` 与列宽策略变更时同步 `frontend/js/AGENTS.md`
 */
(function (global) {
  function shouldLogVsmDebug() {
    if (typeof global.__FE_VSM_DEBUG !== 'undefined') return !!global.__FE_VSM_DEBUG;
    return true;
  }
  function logVsmDebug(tag, payload) {
    if (!shouldLogVsmDebug()) return;
    if (typeof console === 'undefined' || typeof console.log !== 'function') return;
    try {
      console.log('[FE:task4-vsm]', tag, payload);
    } catch (_) {}
  }
  /**
   * 从混合阶段文案中提取纯阶段名。
   * @param {*} raw - 原始阶段字段。
   * @returns {string} 标准化阶段名。
   */
  function extractPureStageName(raw) {
    const s = global.formatValue(raw);
    if (!s) return s;
    if (s.includes('阶段:') && s.includes('节点:')) {
      const m = s.match(/阶段:\s*([^节点]+?)(?:\s*节点:|$)/);
      if (m) return m[1].trim();
    }
    if (s.startsWith('阶段:')) {
      const m = s.match(/阶段:\s*(.+?)(?:\s*节点:|$)/);
      if (m) return m[1].trim();
    }
    return s;
  }

  /**
   * 将阶段标题中「名称 + 半角/全角括号内长说明」拆开；说明常用于聚合逻辑，模型未必单独返回 clustering_reason。
   * @param {*} raw
   * @returns {{ title: string, hint: string }}
   */
  function splitStageTitleAndParenthetical(raw) {
    const t0 = global.formatValue(raw);
    const t = String(t0 || '').trim();
    if (!t) return { title: '', hint: '' };
    let splitIdx = -1;
    let openLen = 0;
    const idxFullSp = t.indexOf(' （');
    const idxAsciiSp = t.indexOf(' (');
    if (idxFullSp >= 0 && (idxAsciiSp < 0 || idxFullSp < idxAsciiSp)) {
      splitIdx = idxFullSp;
      openLen = 2;
    } else if (idxAsciiSp >= 0) {
      splitIdx = idxAsciiSp;
      openLen = 2;
    }
    if (splitIdx === -1) {
      const idxFw = t.indexOf('（');
      if (idxFw > 0) {
        splitIdx = idxFw;
        openLen = 1;
      }
    }
    if (splitIdx === -1) return { title: t, hint: '' };
    const title = t.slice(0, splitIdx).trim();
    let hint = t.slice(splitIdx + openLen).trim();
    hint = hint.replace(/[）)]\s*$/, '').trim();
    if (!title || hint.length < 2) return { title: t, hint: '' };
    return { title, hint };
  }

  /**
   * 解析环节名称与描述。
   * @param {Object} stepObj - 环节对象。
   * @returns {{name: string, desc: string}} 规范化后的名称与描述。
   */
  function extractStepNameAndDesc(stepObj) {
    const nameRaw =
      stepObj.name ??
      stepObj.title ??
      stepObj.step_name ??
      stepObj.phase_name ??
      stepObj.label ??
      stepObj.node_name ??
      stepObj['环节'] ??
      stepObj['环节名称'] ??
      stepObj['节点'] ??
      stepObj['节点名称'] ??
      stepObj['步骤'] ??
      stepObj['步骤名称'] ??
      '';
    const descRaw =
      stepObj.description ??
      stepObj.desc ??
      stepObj.content ??
      stepObj['说明'] ??
      stepObj['描述'];
    const name = global.formatValue(nameRaw);
    const desc = global.formatValue(descRaw);
    if (desc) return { name, desc };
    const m = name && name.match(/^(.+?)\s*[（(]([^）)]+)[）)]\s*$/);
    if (m) return { name: m[1].trim(), desc: m[2].trim() };
    return { name, desc: '' };
  }

  /**
   * 从原始环节对象提取新版 VSM L2 元数据（与 Mirror/Hardening JSON 字段对齐），无则返回 null。
   * @param {Object} st
   * @returns {Object|null}
   */
  function extractVsmL2FromRawStep(st) {
    if (!st || typeof st !== 'object' || Array.isArray(st)) return null;
    if (st.vsmL2 && typeof st.vsmL2 === 'object' && !Array.isArray(st.vsmL2)) {
      const lm = st.vsmL2.logic_meta && typeof st.vsmL2.logic_meta === 'object' ? st.vsmL2.logic_meta : {};
      const out = {
        node_id: st.vsmL2.node_id != null ? String(st.vsmL2.node_id).trim() : '',
        node_name: st.vsmL2.node_name != null ? String(st.vsmL2.node_name).trim() : '',
        actor: st.vsmL2.actor != null ? String(st.vsmL2.actor).trim() : '',
        main_object: st.vsmL2.main_object != null ? String(st.vsmL2.main_object).trim() : '',
        logic_meta: {
          constraints: lm.constraints != null ? String(lm.constraints).trim() : '',
          details: lm.details != null ? String(lm.details).trim() : '',
        },
        type:
          st.vsmL2.type != null
            ? String(st.vsmL2.type).trim()
            : st.vsmL2.Type != null
              ? String(st.vsmL2.Type).trim()
              : '',
        gap_resolved: st.vsmL2.gap_resolved != null ? String(st.vsmL2.gap_resolved).trim() : '',
      };
      if (
        out.node_id ||
        out.node_name ||
        out.actor ||
        out.main_object ||
        out.logic_meta.constraints ||
        out.logic_meta.details ||
        out.type ||
        out.gap_resolved
      ) {
        return out;
      }
      return null;
    }
    const lm0 = st.logic_meta && typeof st.logic_meta === 'object' ? st.logic_meta : {};
    const out0 = {
      node_id: st.node_id != null ? String(st.node_id).trim() : '',
      node_name: global.formatValue(st.node_name ?? '') || '',
      actor: global.formatValue(st.actor ?? '') || '',
      main_object: st.main_object != null ? String(st.main_object).trim() : '',
      logic_meta: {
        constraints: lm0.constraints != null ? String(lm0.constraints).trim() : '',
        details: lm0.details != null ? String(lm0.details).trim() : '',
      },
      type: st.type != null ? String(st.type).trim() : st.Type != null ? String(st.Type).trim() : '',
      gap_resolved: st.gap_resolved != null ? String(st.gap_resolved).trim() : '',
    };
    if (
      out0.node_id ||
      out0.node_name ||
      out0.actor ||
      out0.main_object ||
      out0.logic_meta.constraints ||
      out0.logic_meta.details ||
      out0.type ||
      out0.gap_resolved
    ) {
      return out0;
    }
    return null;
  }

  /** L2 子卡片英文字段名 → 中文标签（工作区展示；不展示 node_id/node_name/type/gap_resolved） */
  const VSM_L2_FIELD_LABEL_ZH = {
    actor: '主责角色',
    main_object: '核心业务对象',
    'logic_meta.constraints': '逻辑约束',
    'logic_meta.details': '处理流程',
  };

  /**
   * 环节编号徽标（仅展示 `N.s.j` 等字符串）。
   * @param {string} idRaw
   * @returns {string}
   */
  function buildVsNodeIdBadgeHtml(idRaw) {
    const s = idRaw != null ? String(idRaw).trim() : '';
    if (!s) return '';
    const esc = global.escapeHtml;
    return `<span class="vs-l2-node-id-badge" title="${esc(s)}" aria-label="节点编号 ${esc(s)}">${esc(s)}</span>`;
  }

  /**
   * 节点编号徽标（从 vsmL2.node_id 读取）。
   * @param {Object} vsmL2
   * @returns {string}
   */
  function buildVsmL2NodeIdBadgeHtml(vsmL2) {
    if (!vsmL2 || typeof vsmL2 !== 'object') return '';
    return buildVsNodeIdBadgeHtml(vsmL2.node_id);
  }

  /**
   * 渲染 L2 元数据子卡片 HTML（工作区价值流 / 端到端横向图共用）。
   * 环节名称见 `.vs-step-head` / `.vs-step-name`，不在此重复；不展示 node_id（见标题行徽标）、节点类型、补齐说明。
   * @param {Object} vsmL2
   * @returns {string}
   */
  function buildVsmL2SubcardHtml(vsmL2) {
    if (!vsmL2 || typeof vsmL2 !== 'object') return '';
    const esc = global.escapeHtml;
    const cell = (v) => esc(v != null && String(v).trim() !== '' ? String(v) : '—');
    const lm = vsmL2.logic_meta && typeof vsmL2.logic_meta === 'object' ? vsmL2.logic_meta : {};
    const rows = [
      ['actor', vsmL2.actor],
      ['main_object', vsmL2.main_object],
      ['logic_meta.constraints', lm.constraints],
      ['logic_meta.details', lm.details],
    ];
    const inner = rows
      .map(([k, v]) => {
        const label = VSM_L2_FIELD_LABEL_ZH[k] || k;
        const valHtml = cell(v);
        return `<div class="vs-l2-row"><span class="vs-l2-key">${esc(label)}</span><div class="vs-l2-val-wrap"><span class="vs-l2-val">${valHtml}</span></div></div>`;
      })
      .join('');
    if (!inner.trim()) return '';
    return `<div class="vs-l2-subcard" aria-label="环节 L2 元数据"><div class="vs-l2-subcard-body">${inner}</div></div>`;
  }

  /** @param {{ vsmL2?: object }} step */
  function vsmTypeThemeClass(step) {
    if (!step || !step.vsmL2 || typeof step.vsmL2 !== 'object') return '';
    const t = String(step.vsmL2.type || '').trim();
    return /^enhanced$/i.test(t) ? ' vs-step-node--vsm-enhanced' : ' vs-step-node--vsm-original';
  }

  /**
   * 将价值流 JSON 解析为统一图结构。
   * @param {Object} data - 价值流原始数据。
   * @returns {{stages: Array<{name: string, steps: Array}>}} 标准化结构。
   */
  function parseValueStreamGraph(data) {
    if (!data || typeof data !== 'object') return { stages: [] };
    logVsmDebug('parse-start', {
      topKeys: Object.keys(data || {}).slice(0, 30),
      hasStages: Array.isArray(data?.stages),
      hasVsmDataStages: Array.isArray(data?.vsm_data?.stages),
      hasValueStreamStages: Array.isArray(data?.valueStream?.stages) || Array.isArray(data?.value_stream?.stages),
    });
    const normalizeStepsContainer = (container) => {
      if (Array.isArray(container)) return container;
      if (!container || typeof container !== 'object') return [];
      // 兼容对象映射：{ "环节A": {...}, "环节B": "..." }
      return Object.entries(container).map(([k, v]) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          return { name: k, ...v };
        }
        return { name: k, desc: global.formatValue(v) || '' };
      });
    };
    const keyedStageEntries = (() => {
      // 兼容部分模型返回：顶层以阶段名为键，值为环节数组/对象。
      const reserved = new Set([
        'stages', 'phases', 'nodes', 'data', 'value_stream', 'valueStream', 'connections',
        'logic_description', 'vsm_data', 'value_stream_json', 'value_stream_data',
      ]);
      const entries = Object.entries(data || {}).filter(([k, v]) => {
        if (reserved.has(k)) return false;
        if (Array.isArray(v)) return true;
        if (v && typeof v === 'object') return true;
        return false;
      });
      return entries;
    })();
    let rawStages =
      data.stages ??
      data.phases ??
      data.nodes ??
      data['阶段'] ??
      data['阶段列表'] ??
      data.value_stream?.stages ??
      data.valueStream?.stages ??
      data.data?.stages ??
      data.vsm_data?.stages ??
      data.value_stream_json?.stages ??
      [];
    if (!Array.isArray(rawStages) || rawStages.length === 0) rawStages = [];
    const list = rawStages.length > 0
      ? rawStages
      : keyedStageEntries.map(([stageName, stageVal]) => ({
          name: stageName,
          steps: Array.isArray(stageVal)
            ? stageVal
            : (stageVal?.steps ?? stageVal?.tasks ?? stageVal?.nodes ?? stageVal?.children ?? stageVal?.['环节'] ?? []),
        }));
    const parsed = {
      stages: list.map((s, i) => {
        if (!s) return { name: `阶段${i + 1}`, steps: [] };
        if (typeof s === 'string') return { name: extractPureStageName(s), steps: [] };
        let rawSteps =
          s.steps ??
          s.tasks ??
          s.phases ??
          s.items ??
          s.nodes ??
          s.children ??
          s['环节'] ??
          s['环节列表'] ??
          s['节点'] ??
          s['节点列表'] ??
          [];
        // 兜底：若未命中显式 steps 容器，则把 stage 对象中的“非元数据键”视为环节映射。
        if (
          (rawSteps == null || (Array.isArray(rawSteps) && rawSteps.length === 0) || (typeof rawSteps === 'object' && !Array.isArray(rawSteps) && Object.keys(rawSteps).length === 0))
          && s
          && typeof s === 'object'
        ) {
          const stageMetaKeys = new Set([
            'name', 'title', 'stage_name', 'phase_name', 'label', 'clustering_reason', 'node_name', 'node_label',
            '阶段', '阶段名称', '阶段名',
            'steps', 'tasks', 'phases', 'items', 'nodes', 'children',
            '环节', '环节列表', '节点', '节点列表',
            'description', 'desc', 'content', '备注',
            'vsmL2', 'node_id', 'main_object', 'logic_meta', 'gap_resolved', 'type', 'actor',
          ]);
          const stepEntries = Object.entries(s).filter(([k]) => !stageMetaKeys.has(k));
          if (stepEntries.length > 0) {
            rawSteps = Object.fromEntries(stepEntries);
          }
        }
        const steps = normalizeStepsContainer(rawSteps);
        const rawStageName =
          s.name ??
          s.title ??
          s.stage_name ??
          s.phase_name ??
          s.label ??
          s.node_name ??
          s.node_label ??
          s['阶段'] ??
          s['阶段名称'] ??
          s['阶段名'] ??
          `阶段${i + 1}`;
        const stageNameRaw = extractPureStageName(rawStageName);
        const splitTitle = splitStageTitleAndParenthetical(stageNameRaw);
        const displayStageName = splitTitle.hint ? splitTitle.title : stageNameRaw;
        let clusteringReason =
          s && typeof s === 'object' && s.clustering_reason != null ? String(s.clustering_reason).trim() : '';
        if (!clusteringReason && splitTitle.hint) clusteringReason = splitTitle.hint;
        const stageOut = {
          name: displayStageName,
          steps: steps.map((st, j) => {
            const canonicalNid = `N.${i + 1}.${j + 1}`;
            if (typeof st === 'string') {
              const { name: stepName, desc: stepDesc } = extractStepNameAndDesc({ name: st });
              return {
                name: stepName || st,
                desc: stepDesc,
                role: '',
                duration: '',
                itStatusLabel: '',
                itPlanLabel: '',
                painPoint: '',
                canonicalNodeId: canonicalNid,
              };
            }
            const { name: stepName, desc: stepDesc } = extractStepNameAndDesc(st);
            const role = global.formatValue(
              st.role ??
              st.executor ??
              st.owner ??
              st.actor ??
              st['执行角色'] ??
              st['责任角色'] ??
              st['参与角色'] ??
              st['人员'] ??
              st['岗位']
            ) || '';
            const duration = global.formatValue(
              st.duration ??
              st.lead_time ??
              st.time ??
              st['预估耗时'] ??
              st['预计耗时'] ??
              st['耗时'] ??
              st['提前期'] ??
              st['时长']
            ) || '';
            const itStatus = st.itStatus ?? st.it_status;
            const itStatusLabel = itStatus && typeof itStatus === 'object'
              ? (itStatus.type === '手工' ? `手工-${itStatus.detail || '—'}` : itStatus.type === '系统' ? `系统-${itStatus.detail || '—'}` : '')
              : (typeof itStatus === 'string' ? itStatus : '');
            const itPlanRaw = st.itPlan ?? st.it_plan;
            const itPlanLabel =
              itPlanRaw && typeof itPlanRaw === 'object' && itPlanRaw.plan != null
                ? String(itPlanRaw.plan).trim()
                : '';
            const rawPainPoint = global.formatValue(st.painPoint ?? st.pain_point) || '';
            const trimmed = rawPainPoint.trim();
            const isNoPainPoint = /^(无明显痛点|无痛点|暂无|无)$/i.test(trimmed) || /^无明显痛点/i.test(trimmed);
            const painPoint = isNoPainPoint ? '' : rawPainPoint;
            let vsmL2 = extractVsmL2FromRawStep(st);
            if (vsmL2 && !vsmL2.node_name && stepName) vsmL2 = { ...vsmL2, node_name: stepName };
            if (vsmL2) vsmL2 = { ...vsmL2, node_id: canonicalNid };
            const base = {
              name: stepName || `环节${j + 1}`,
              desc: stepDesc,
              role,
              duration,
              itStatusLabel: itStatusLabel || '',
              painPoint,
                canonicalNodeId: canonicalNid,
                itPlanLabel,
              };
              return vsmL2 ? { ...base, vsmL2 } : base;
          }),
        };
        if (clusteringReason) stageOut.clustering_reason = clusteringReason;
        return stageOut;
      }),
    };
    const stagesLen = parsed.stages.length;
    const stepsLen = parsed.stages.reduce((n, s) => n + ((Array.isArray(s?.steps) ? s.steps.length : 0)), 0);
    const stageStepLens = parsed.stages.map((s) => ({ stage: s?.name || '', steps: Array.isArray(s?.steps) ? s.steps.length : 0 }));
    logVsmDebug('parse-result', { stagesLen, stepsLen, stageStepLens: stageStepLens.slice(0, 12) });
    if (stagesLen > 0 && stepsLen === 0) {
      logVsmDebug('parse-warning-no-steps', {
        rawTopKeys: Object.keys(data || {}).slice(0, 40),
        rawPreview: JSON.stringify(data || {}).slice(0, 1200),
      });
    }
    return parsed;
  }

  /**
   * 渲染单条价值流的可视化 HTML。
   * @param {Object} item - 单条价值流数据。
   * @returns {string} 渲染 HTML。
   */
  function renderValueStreamViewHTML(item) {
    const { stages } = parseValueStreamGraph(item);
    const totalSteps = stages.reduce((n, s) => n + ((Array.isArray(s?.steps) ? s.steps.length : 0)), 0);
    if (stages.length > 0 && totalSteps === 0) {
      logVsmDebug('render-warning-only-stages', {
        stages: stages.map((s) => s?.name || '').slice(0, 20),
      });
    }
    if (stages.length === 0) return '<p class="vs-view-placeholder">暂无阶段数据，无法渲染图形</p>';
    let globalStepIndex = 0;
    const stagesHtml = stages.map((stage, si) => {
      const stepsHtml = stage.steps.length === 0
        ? '<div class="vs-step-node vs-step-empty">—</div>'
        : stage.steps.map((step, ji) => {
            const hideDupMeta = !!step.vsmL2;
            const roleDurationHtml =
              !hideDupMeta && (step.role || step.duration)
                ? `<div class="vs-step-meta">${step.role ? `<span class="vs-step-meta-chip vs-step-meta-role">${global.escapeHtml(step.role)}</span>` : ''}${step.duration ? `<span class="vs-step-meta-chip vs-step-meta-duration">${global.escapeHtml(step.duration)}</span>` : ''}</div>`
                : '';
            const itMetaHtml =
              step.itStatusLabel || step.itPlanLabel
                ? `<div class="vs-step-meta vs-step-meta-it-row">${step.itStatusLabel ? `<span class="vs-step-meta-chip vs-step-meta-it-status">IT现状：${global.escapeHtml(step.itStatusLabel)}</span>` : ''}${step.itPlanLabel ? `<span class="vs-step-meta-chip vs-step-meta-it-plan">IT计划：${global.escapeHtml(step.itPlanLabel)}</span>` : ''}</div>`
                : '';
            const painPointHtml = step.painPoint ? `<div class="vs-step-meta"><div class="vs-step-pain-point-card">${global.escapeHtml(step.painPoint)}</div></div>` : '';
            const hasPainPointClass = step.painPoint ? ' vs-step-node-has-pain-point' : '';
            const l2Class = step.vsmL2 ? ' vs-step-node-has-l2' : '';
            const typeTheme = vsmTypeThemeClass(step);
            const l2Html = step.vsmL2 ? buildVsmL2SubcardHtml(step.vsmL2) : '';
            const nid =
              (step.canonicalNodeId != null && String(step.canonicalNodeId).trim()) ||
              (step.vsmL2 && step.vsmL2.node_id != null && String(step.vsmL2.node_id).trim()) ||
              `N.${si + 1}.${ji + 1}`;
            const idBadgeHtml = buildVsNodeIdBadgeHtml(nid);
            const titleHtml = `<div class="vs-step-head"><span class="vs-step-name">${global.escapeHtml(step.name)}</span>${idBadgeHtml}</div>`;
            const descHtml =
              step.desc && !step.vsmL2 ? `<span class="vs-step-desc">${global.escapeHtml(step.desc)}</span>` : '';
            const stepNodeHtml = `<div class="vs-step-node${hasPainPointClass}${l2Class}${typeTheme}" data-vs-step-name="${global.escapeHtml(step.name)}" data-vs-step-index="${globalStepIndex}">${titleHtml}${descHtml}${roleDurationHtml}${l2Html}${itMetaHtml}${painPointHtml}</div>`;
            globalStepIndex += 1;
            return stepNodeHtml + (ji < stage.steps.length - 1 ? '<div class="vs-arrow-inner" aria-hidden="true">↓</div>' : '');
          }).join('');
      const cr = stage.clustering_reason != null ? String(stage.clustering_reason).trim() : '';
      const clusteringHtml = cr
        ? `<div class="vs-clustering-logic-card" aria-label="聚合逻辑"><span class="vs-clustering-logic-label">聚合逻辑</span><div class="vs-clustering-logic-body">${global.escapeHtml(cr)}</div></div>`
        : '';
      const stageIdLabel = `S.${si + 1}`;
      const stageHeaderHtml = `<div class="vs-stage-name-wrap"><span class="vs-stage-id-badge" title="${global.escapeHtml(stageIdLabel)}" aria-label="阶段编号 ${global.escapeHtml(stageIdLabel)}">${global.escapeHtml(stageIdLabel)}</span><div class="vs-stage-name">${global.escapeHtml(stage.name)}</div></div>`;
      return `<div class="vs-graph-stage" data-stage="${si}" data-vs-stage-name="${global.escapeHtml(stage.name)}" data-vs-stage-id="${global.escapeHtml(stageIdLabel)}"><div class="vs-stage-node" data-vs-stage-name="${global.escapeHtml(stage.name)}">${stageHeaderHtml}${clusteringHtml}<div class="vs-steps-chain">${stepsHtml}</div></div></div>${si < stages.length - 1 ? '<div class="vs-arrow-outer" aria-hidden="true">→</div>' : ''}`;
    }).join('');
    return `<div class="vs-graph-scroll"><div class="vs-graph">${stagesHtml}</div></div>`;
  }

  /**
   * 端到端事务流：将 IT 现状、IT 计划（展示名 IT假话）、痛点包入可折叠子区，默认折叠。
   * @param {Object} step - 解析后的环节对象。
   * @returns {string}
   */
  function buildE2eItPainNestHtml(step) {
    const status = String(step.itStatusLabel || '').trim();
    const plan = String(step.itPlanLabel || '').trim();
    const pain = String(step.painPoint || '').trim();
    const dash = '<span class="vs-e2e-nest-empty">—</span>';
    const statusBody = status ? global.escapeHtml(status) : dash;
    const planBody = plan ? global.escapeHtml(plan) : dash;
    const painBody = pain
      ? `<div class="vs-step-pain-point-card vs-e2e-nest-pain">${global.escapeHtml(pain)}</div>`
      : dash;
    return `<details class="vs-e2e-it-pain-nest">
<summary class="vs-e2e-it-pain-nest-summary"><span class="vs-e2e-it-pain-nest-summary-text">构建 IT 及痛点标注</span></summary>
<div class="vs-e2e-it-pain-nest-body">
<div class="vs-e2e-nest-subcard"><div class="vs-e2e-nest-subcard-title">IT现状</div><div class="vs-e2e-nest-subcard-body vs-e2e-nest-it-status">${statusBody}</div></div>
<div class="vs-e2e-nest-subcard"><div class="vs-e2e-nest-subcard-title">IT假话</div><div class="vs-e2e-nest-subcard-body vs-e2e-nest-it-plan">${planBody}</div></div>
<div class="vs-e2e-nest-subcard"><div class="vs-e2e-nest-subcard-title">痛点</div><div class="vs-e2e-nest-subcard-body vs-e2e-nest-pain-wrap">${painBody}</div></div>
</div>
</details>`;
  }

  /**
   * 渲染端到端事务流横向视图 HTML。
   * @param {Object} valueStream - 价值流数据。
   * @returns {string} 渲染 HTML。
   */
  function renderEndToEndFlowHTML(valueStream) {
    const { stages } = parseValueStreamGraph(valueStream);
    const flat = [];
    stages.forEach((s, si) => {
      (s.steps || []).forEach((step, ji) => {
        flat.push({ step, si, ji });
      });
    });
    if (flat.length === 0) return '<p class="vs-view-placeholder">暂无环节数据，无法渲染端到端事务流</p>';
    const stepCardsHtml = flat
      .map(({ step, si, ji }, i) => {
        const hideDupMeta = !!step.vsmL2;
        const roleDurationHtml =
          !hideDupMeta && (step.role || step.duration)
            ? `<div class="vs-step-meta">${step.role ? `<span class="vs-step-meta-chip vs-step-meta-role">${global.escapeHtml(step.role)}</span>` : ''}${step.duration ? `<span class="vs-step-meta-chip vs-step-meta-duration">${global.escapeHtml(step.duration)}</span>` : ''}</div>`
            : '';
        const itPainNestHtml = buildE2eItPainNestHtml(step);
        const l2Html = step.vsmL2 ? buildVsmL2SubcardHtml(step.vsmL2) : '';
        const nid =
          (step.canonicalNodeId != null && String(step.canonicalNodeId).trim()) ||
          (step.vsmL2 && step.vsmL2.node_id != null && String(step.vsmL2.node_id).trim()) ||
          `N.${si + 1}.${ji + 1}`;
        const idBadgeHtml = buildVsNodeIdBadgeHtml(nid);
        const descHtml = step.desc && !step.vsmL2 ? `<span class="vs-step-desc">${global.escapeHtml(step.desc)}</span>` : '';
        const l2Class = step.vsmL2 ? ' vs-step-node-has-l2' : '';
        const typeTheme = vsmTypeThemeClass(step);
        return `<div class="vs-e2e-step-card vs-step-node${l2Class}${typeTheme}" data-vs-step-index="${i}"><div class="vs-e2e-step-name-block"><span class="vs-e2e-step-name-text">${global.escapeHtml(step.name)}</span>${idBadgeHtml}</div>${descHtml}${roleDurationHtml}${l2Html}${itPainNestHtml}</div>${i < flat.length - 1 ? '<div class="vs-arrow-outer vs-e2e-arrow" aria-hidden="true">→</div>' : ''}`;
      })
      .join('');
    return `<div class="vs-e2e-flow">${stepCardsHtml}</div>`;
  }

  /** 单事务节点 JSON → Base64，供预览按钮 data 属性承载（UTF-8 安全） */
  function encodeE2eBpmTxForPreviewDataAttr(tx) {
    try {
      const s = JSON.stringify(tx);
      if (typeof btoa === 'undefined') return '';
      return btoa(unescape(encodeURIComponent(s)));
    } catch (_) {
      return '';
    }
  }

  /** BPM 节点类型：决策类（预览中为圆角矩形 + 左右正交分支） */
  function isDecisionBpmNodeType(type) {
    const t = String(type || '').trim().toLowerCase();
    return t === '决策' || t === '判断' || t === 'decision' || t === 'gateway' || t.includes('分支');
  }

  /** BPM 节点类型：核验类（预览中与决策同为左右分支 + 正交连线示意） */
  function isVerificationBpmNodeType(type) {
    const t = String(type || '').trim().toLowerCase();
    return t === '核验' || t === '校验' || t === '验证' || t === 'verification' || t === 'verify' || t.includes('核对');
  }

  /** 是否分支节点（核验 / 决策：自左右腰点出线接下游） */
  function isBranchingBpmNodeType(type) {
    return isVerificationBpmNodeType(type) || isDecisionBpmNodeType(type);
  }

  /** 将 bpm_detailed_flow 拆成线性段与分支段交替 */
  function splitBpmFlowToSegments(flow) {
    const segments = [];
    let buf = [];
    for (let i = 0; i < flow.length; i++) {
      const st = flow[i];
      const typ = String(st?.type || '').trim();
      if (isBranchingBpmNodeType(typ)) {
        if (buf.length) segments.push({ type: 'linear', steps: buf.slice() });
        buf = [];
        segments.push({ type: 'branch', step: st });
      } else {
        buf.push(st);
      }
    }
    if (buf.length) segments.push({ type: 'linear', steps: buf });
    return segments;
  }

  /** 解析 BPM 步「核心对象状态变更」：支持 `core_object_state_changes`、中文键或多行字符串 */
  function pickCoreObjectStateChangesLinesFromBpmStep(step) {
    if (!step || typeof step !== 'object') return [];
    const raw = step.core_object_state_changes ?? step['核心对象状态变更'];
    if (raw == null) return [];
    if (Array.isArray(raw)) {
      return raw.map((x) => String(x).trim()).filter(Boolean);
    }
    const s = String(raw).trim();
    if (!s) return [];
    return s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }

  /** 决策 / 执行 节点展示「核心对象状态变更」子卡（核验等类型不展示） */
  function isBpmTypeForCoreStateSubcard(typeRaw) {
    const t = String(typeRaw || '').trim();
    return t.includes('决策') || t.includes('执行');
  }

  /**
   * 展示前去掉 A/B 两侧常见的「状态 」前缀（LLM 易写成「状态 待签署」）；须有空格/全角空格跟在「状态」后，避免误伤「状态机」等词。
   * @param {string} str
   * @returns {string}
   */
  function stripE2eCoreStateDisplayStatusPrefix(str) {
    return String(str || '')
      .trim()
      .replace(/^\s*状态(?:[\s\u3000\u00a0]+|$)/, '')
      .trim();
  }

  /**
   * 核心对象状态迁移行 → 工作区统一展示为「对象｜A → B」着色片段。
   * 兼容 LLM 长句「对象，从 A 改为 B」与已存的「对象｜A → B」；不匹配则整行转义原文。
   * @param {string} line
   * @param {(s: string) => string} esc
   * @returns {string}
   */
  function buildCoreObjectStateChangeLineHtml(line, esc) {
    const s = String(line || '').trim();
    if (!s) return '';
    let obj = '';
    let fromSt = '';
    let toSt = '';
    const longM = s.match(/^(.+?)[，,]\s*从\s*(.+?)\s*改为\s*(.+)$/);
    /* 短格式：对象｜A → B（箭头兼容 →、->、⇒、=>、➔ 等） */
    const shortM = s.match(/^(.+?)\s*[｜|]\s*(.+?)\s*(?:→|⇒|⟶|->|➔|=>)\s*(.+)$/);
    if (longM) {
      [, obj, fromSt, toSt] = longM;
    } else if (shortM) {
      [, obj, fromSt, toSt] = shortM;
    } else {
      return esc(s);
    }
    obj = obj.trim();
    fromSt = stripE2eCoreStateDisplayStatusPrefix(fromSt);
    toSt = stripE2eCoreStateDisplayStatusPrefix(toSt);
    return `<span class="e2e-bpm-core-state-obj">${esc(obj)}</span><span class="e2e-bpm-core-state-conn">｜</span><span class="e2e-bpm-core-state-from">${esc(
      fromSt,
    )}</span><span class="e2e-bpm-core-state-conn"> → </span><span class="e2e-bpm-core-state-to">${esc(toSt)}</span>`;
  }

  /**
   * 根据单条事务节点 JSON（含 bpm_detailed_flow）生成 BPM 流程预览 HTML：
   * 开始/结束椭圆；普通步骤为圆角矩形（上入下出）；核验与决策为底边中点 T 型分叉，双列下游与上游同宽且子列中线各在上游左/右缘外 20% 节点宽。
   * @param {*} tx
   * @returns {string}
   */
  function buildE2eBpmTransactionFlowPreviewDiagramHTML(tx) {
    const esc = global.escapeHtml;
    const flow = tx && typeof tx === 'object' && Array.isArray(tx.bpm_detailed_flow) ? tx.bpm_detailed_flow : [];
    if (!flow.length) {
      return '<p class="e2e-bpm-preview-empty">本事务节点暂无 bpm_detailed_flow，无法绘制流程图。请确认模型已按 task7 schema 输出细粒度 BPM 步骤。</p>';
    }

    const CONNECTOR_FULL =
      '<div class="e2e-bpm-preview-connector e2e-bpm-preview-connector--legacy" aria-hidden="true"><span class="e2e-bpm-preview-connector-line"></span><span class="e2e-bpm-preview-connector-cap"></span></div>';

    function connector() {
      return CONNECTOR_FULL;
    }

    function terminalOval(kind) {
      const isStart = kind === 'start';
      const label = isStart ? '开始' : '结束';
      const cls = isStart ? 'e2e-bpm-preview-terminal e2e-bpm-preview-terminal--start' : 'e2e-bpm-preview-terminal e2e-bpm-preview-terminal--end';
      const portIn = `<span class="e2e-bpm-preview-port e2e-bpm-preview-port--in-top" aria-hidden="true"></span>`;
      const portOut = `<span class="e2e-bpm-preview-port e2e-bpm-preview-port--out-bottom" aria-hidden="true"></span>`;
      if (isStart) {
        return `<div class="${cls}" role="img" aria-label="${esc(label)}">${esc(label)}${portOut}</div>`;
      }
      return `<div class="${cls}" role="img" aria-label="${esc(label)}">${portIn}${esc(label)}</div>`;
    }

    function stepSubcardsInner(step) {
      const logic = String(step?.logic ?? '').trim();
      const memo = String(step?.field_memo ?? '').trim();
      const typ = String(step?.type || '').trim();
      const stateLines =
        isBpmTypeForCoreStateSubcard(typ) ? pickCoreObjectStateChangesLinesFromBpmStep(step) : [];
      const stateBlock =
        stateLines.length > 0
          ? `<div class="e2e-bpm-preview-subcard e2e-bpm-preview-subcard--core-state"><div class="e2e-bpm-preview-subcard-k">核心对象状态变更</div><ul class="e2e-bpm-preview-core-state-list">${stateLines
              .map((line) => `<li>${buildCoreObjectStateChangeLineHtml(line, esc)}</li>`)
              .join('')}</ul></div>`
          : '';
      return `<div class="e2e-bpm-preview-subcard"><div class="e2e-bpm-preview-subcard-k">逻辑</div><div class="e2e-bpm-preview-subcard-v">${esc(logic || '—')}</div></div>
        ${memo ? `<div class="e2e-bpm-preview-subcard"><div class="e2e-bpm-preview-subcard-k">字段备注</div><div class="e2e-bpm-preview-subcard-v">${esc(memo)}</div></div>` : ''}${stateBlock}`;
    }

    function buildRectSubcardsBlockHtml(step) {
      const typ = String(step?.type || '').trim() || '—';
      const desc = String(step?.desc ?? '').trim();
      const descKey = step && step.e2e_gap_supplement === true ? '描述（补齐）' : '描述';
      return `<div class="e2e-bpm-preview-subcards">
            <div class="e2e-bpm-preview-subcard"><div class="e2e-bpm-preview-subcard-k">类型</div><div class="e2e-bpm-preview-subcard-v">${esc(typ)}</div></div>
            <div class="e2e-bpm-preview-subcard"><div class="e2e-bpm-preview-subcard-k">${esc(descKey)}</div><div class="e2e-bpm-preview-subcard-v">${esc(desc || '—')}</div></div>
            ${stepSubcardsInner(step)}
          </div>`;
    }

    function renderRectStep(step) {
      return `<div class="e2e-bpm-preview-step e2e-bpm-preview-step--task e2e-bpm-preview-node e2e-bpm-preview-node--linear">
        <div class="e2e-bpm-preview-rect">
          <span class="e2e-bpm-preview-port e2e-bpm-preview-port--in-top" aria-hidden="true"></span>
          ${buildRectSubcardsBlockHtml(step)}
          <span class="e2e-bpm-preview-port e2e-bpm-preview-port--out-bottom" aria-hidden="true"></span>
        </div>
      </div>`;
    }

    /** 核验/决策：上游圆角矩形底边中点 T 型出线；下游仅通过列（单栏），失败支纯 SVG 贴 split 右缘 */
    function openBranchGatewayShell(step) {
      const typ = String(step?.type || '').trim();
      const verify = isVerificationBpmNodeType(typ);
      const kindMod = verify ? 'e2e-bpm-preview-gateway--verify' : 'e2e-bpm-preview-gateway--decision';
      const rectMod = verify ? 'e2e-bpm-preview-rect--verify-branch' : '';
      const rectClass = `e2e-bpm-preview-rect e2e-bpm-preview-rect--branch${rectMod ? ` ${rectMod}` : ''}`;
      /* T 型分叉由 syncE2eBpmPreviewDiagramWires 按端口 DOM 实测绘制；此处仅保留条件文案占位 */
      return `<div class="e2e-bpm-preview-step e2e-bpm-preview-step--gateway">
      <div class="e2e-bpm-preview-gateway ${kindMod}">
        <div class="e2e-bpm-preview-gateway-node">
          <div class="${rectClass}">
            <span class="e2e-bpm-preview-port e2e-bpm-preview-port--in-top" aria-hidden="true"></span>
            ${buildRectSubcardsBlockHtml(step)}
            <span class="e2e-bpm-preview-port e2e-bpm-preview-port--out-bottom" aria-hidden="true"></span>
          </div>
        </div>
        <div class="e2e-bpm-preview-gateway-bridge">
          <div class="e2e-bpm-preview-gateway-bridge-labels">
            <span class="e2e-bpm-preview-gw-lbl e2e-bpm-preview-gw-lbl--pass">${esc('通过 / 成立')}</span>
            <span class="e2e-bpm-preview-gw-lbl e2e-bpm-preview-gw-lbl--fail">${esc('不通过 / 阻断')}</span>
          </div>
          <div class="e2e-bpm-preview-gateway-bridge-flow-hint" aria-hidden="true">${esc('通过则继续流转')}</div>
        </div>
        <div class="e2e-bpm-preview-gateway-split">`;
    }

    function closeBranchGatewayShell() {
      return `</div></div></div>`;
    }

    /** 无后继步骤时指向全局结束节点 */
    function renderPassToGlobalEndHint() {
      return `<div class="e2e-bpm-preview-pass-to-end-hint">${esc('↓ 至下方结束节点')}</div>`;
    }

    /**
     * 自 segments[startIdx] 起渲染；遇 branch 则展开双列并递归渲染 tail。
     * @param {Array} segments
     * @param {number} startIdx
     * @returns {string}
     */
    function renderSegmentsFrom(segments, startIdx) {
      const parts = [];
      let i = startIdx;
      while (i < segments.length) {
        const seg = segments[i];
        if (seg.type === 'linear') {
          for (const step of seg.steps) {
            parts.push(renderRectStep(step));
            parts.push(connector());
          }
          i++;
        } else {
          const tail = segments.slice(i + 1);
          const tailHtml = tail.length ? renderSegmentsFrom(segments, i + 1) : '';

          parts.push(openBranchGatewayShell(seg.step));
          parts.push(`<div class="e2e-bpm-preview-gw-col e2e-bpm-preview-gw-col--pass" role="presentation">`);
          parts.push(`<div class="e2e-bpm-preview-col-body">`);
          if (tailHtml) {
            parts.push(tailHtml);
          } else {
            parts.push(renderPassToGlobalEndHint());
            parts.push(connector());
          }
          parts.push(`</div></div>`);
          parts.push(closeBranchGatewayShell());
          return parts.join('');
        }
      }
      return parts.join('');
    }

    function stripTrailingPreviewConnectors(html) {
      let s = html;
      while (s.endsWith(CONNECTOR_FULL)) s = s.slice(0, -CONNECTOR_FULL.length).trimEnd();
      return s;
    }

    const segments = splitBpmFlowToSegments(flow);
    const body = stripTrailingPreviewConnectors(renderSegmentsFrom(segments, 0));
    const out = [terminalOval('start'), connector(), body, connector(), terminalOval('end')];
    return `<div class="e2e-bpm-preview-diagram">${out.join('')}</div>`;
  }

  /**
   * task7：将 LLM 返回的业务事务流 JSON（含 transaction_nodes）渲染为工作区 view（阶段内事务卡纵向满宽、**首张默认展开其余折叠**，标题栏 `.e2e-bpm-tx-node-collapse-btn`；**角色 chip 在名称后（｜ 分隔）**；正文仅 BPM 节点卡以 → 连接）。
   * @param {*} data - 解析后的对象。
   * @returns {string}
   */
  function renderE2eBpmTransactionFlowHTML(data) {
    if (!data || typeof data !== 'object') {
      return '<p class="vs-view-placeholder">暂无业务事务流数据</p>';
    }
    const esc = global.escapeHtml;
    /** 全页事务节点卡序号：首张默认展开，其余默认折叠 */
    let txCardSeq = 0;
    const previewIconSvg =
      '<svg class="e2e-bpm-tx-preview-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/><path d="M6.5 10v4M10 6.5h4M6.5 14v4M14 10h4"/></svg>';
    const collapseChevronSvg = (expanded) =>
      `<svg class="e2e-bpm-tx-node-collapse-icon${expanded ? ' e2e-bpm-tx-node-collapse-icon--open' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`;
    /** 事务是否含「需求场景补齐」写入的 BPM 步骤（`e2e_gap_supplement`） */
    function txHasE2eGapSupplementSteps(tx) {
      const flow = tx && typeof tx === 'object' && Array.isArray(tx.bpm_detailed_flow) ? tx.bpm_detailed_flow : [];
      return flow.some((s) => s && typeof s === 'object' && s.e2e_gap_supplement === true);
    }
    /** 工作区节点标题栏：可选左侧折叠钮 + 编号｜名称〔｜角色 chip…〕+ 成图预览；`titleOpts.roleTailHtml` / `roleAriaSuffix` 由调用方从 `pickAdvisorChipTexts` 生成 */
    function buildTxNodeTitleBarHtml(tx, titleOpts) {
      const idRaw = tx.transaction_id;
      const idDisp = idRaw != null && String(idRaw).trim() ? String(idRaw).trim() : '—';
      const nameRaw = tx.name ?? tx.transaction_name;
      const nameDisp = nameRaw != null && String(nameRaw).trim() ? String(nameRaw).trim() : '—';
      const nameClass = txHasE2eGapSupplementSteps(tx)
        ? 'e2e-bpm-tx-node-head-name e2e-bpm-tx-node-head-name--gap-supplement'
        : 'e2e-bpm-tx-node-head-name';
      const b64 = encodeE2eBpmTxForPreviewDataAttr(tx);
      const previewBtn = b64
        ? `<button type="button" class="e2e-bpm-tx-preview-btn" title="事务流程图预览" aria-label="事务流程图预览" data-tx-b64="${esc(b64)}">${previewIconSvg}</button>`
        : '';
      const prefix = titleOpts && titleOpts.collapseBtnHtml ? titleOpts.collapseBtnHtml : '';
      const roleTail = titleOpts && titleOpts.roleTailHtml ? titleOpts.roleTailHtml : '';
      const roleAria = titleOpts && titleOpts.roleAriaSuffix ? titleOpts.roleAriaSuffix : '';
      return {
        html: `<header class="e2e-bpm-tx-node-head">${prefix}<div class="e2e-bpm-tx-node-head-main"><span class="e2e-bpm-tx-node-head-id">${esc(idDisp)}</span><span class="e2e-bpm-tx-node-head-sep" aria-hidden="true">｜</span><span class="${nameClass}">${esc(nameDisp)}</span>${roleTail}</div>${previewBtn}</header>`,
        aria: `${idDisp}｜${nameDisp}${roleAria}`,
      };
    }
    /** 从事务节点对象提取角色展示用 chip 文案（`actor`/`顾问` 等） */
    function pickAdvisorChipTexts(tx) {
      if (!tx || typeof tx !== 'object') return [];
      const raw = tx.顾问 ?? tx.advisor ?? tx.consultant ?? tx.actor;
      if (raw == null) return [];
      if (Array.isArray(raw)) {
        return raw.map((x) => String(x).trim()).filter(Boolean);
      }
      const s = String(raw).trim();
      if (!s) return [];
      return s
        .split(/[,，、;；\/|]+/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
    /** BPM 单步：节点描述 / 逻辑 / type（兼容 desc/description/节点描述） */
    function pickBpmStepDesc(step) {
      if (!step || typeof step !== 'object') return '';
      const v = step.desc ?? step.description ?? step['节点描述'];
      return v != null && String(v).trim() ? String(v).trim() : '';
    }
    function pickBpmStepLogic(step) {
      if (!step || typeof step !== 'object') return '';
      const v = step.logic ?? step['逻辑'];
      return v != null && String(v).trim() ? String(v).trim() : '';
    }
    function pickBpmStepType(step) {
      if (!step || typeof step !== 'object') return '';
      const v = step.type ?? step['类型'];
      return v != null && String(v).trim() ? String(v).trim() : '';
    }
    /** BPM 节点编号（schema：`bpm_node_id`） */
    function pickBpmStepNodeId(step) {
      if (!step || typeof step !== 'object') return '';
      const v = step.bpm_node_id ?? step.bpmNodeId ?? step['BPM节点编号'];
      return v != null && String(v).trim() ? String(v).trim() : '';
    }
    /**
     * 按节点类型中文关键字映射主题 class 后缀（输入/核验/决策/留痕/执行）。
     * @param {string} typeRaw
     * @returns {'default'|'input'|'verify'|'decision'|'trace'|'execute'}
     */
    function bpmStepThemeKey(typeRaw) {
      const t = String(typeRaw || '').trim();
      if (!t) return 'default';
      if (t.includes('输入')) return 'input';
      if (t.includes('核验')) return 'verify';
      if (t.includes('决策')) return 'decision';
      if (t.includes('留痕')) return 'trace';
      if (t.includes('执行')) return 'execute';
      return 'default';
    }
    /** BPM 流程设计子卡：节点卡之间插入蓝色 → */
    function renderBpmDesignStripHtml(tx) {
      const flow = tx && typeof tx === 'object' && Array.isArray(tx.bpm_detailed_flow) ? tx.bpm_detailed_flow : [];
      if (flow.length === 0) {
        return `<p class="e2e-bpm-tx-bpm-empty">暂无 bpm_detailed_flow 数据</p>`;
      }
      const arrow = '<span class="e2e-bpm-tx-bpm-arrow" aria-hidden="true">→</span>';
      const parts = [];
      flow.forEach((step, i) => {
        if (i > 0) parts.push(arrow);
        const desc = pickBpmStepDesc(step);
        const logic = pickBpmStepLogic(step);
        const typeRaw = pickBpmStepType(step);
        const theme = bpmStepThemeKey(typeRaw);
        const themeClass = theme === 'default' ? '' : ` e2e-bpm-tx-bpm-step-card--${theme}`;
        const nodeId = pickBpmStepNodeId(step);
        const idBadge = `<div class="e2e-bpm-tx-bpm-step-id-badge">${nodeId ? esc(nodeId) : '—'}</div>`;
        const typePill =
          typeRaw !== ''
            ? `<span class="e2e-bpm-tx-bpm-step-type-pill">${esc(typeRaw)}</span>`
            : '';
        const headRow = `<div class="e2e-bpm-tx-bpm-step-head-row">${idBadge}${typePill}</div>`;
        const descLabel =
          step && step.e2e_gap_supplement === true ? '节点描述（补齐）' : '节点描述';
        const descBlock = `<div class="e2e-bpm-tx-bpm-step-field"><span class="e2e-bpm-tx-bpm-step-field-label">${esc(descLabel)}</span><div class="e2e-bpm-tx-bpm-step-field-val">${desc ? esc(desc) : '<span class="e2e-bpm-tx-bpm-step-placeholder">—</span>'}</div></div>`;
        const logicBlock = `<div class="e2e-bpm-tx-bpm-step-field"><span class="e2e-bpm-tx-bpm-step-field-label">逻辑</span><div class="e2e-bpm-tx-bpm-step-field-val">${logic ? esc(logic) : '<span class="e2e-bpm-tx-bpm-step-placeholder">—</span>'}</div></div>`;
        const stateLines = isBpmTypeForCoreStateSubcard(typeRaw)
          ? pickCoreObjectStateChangesLinesFromBpmStep(step)
          : [];
        const stateSubcard =
          stateLines.length > 0
            ? `<div class="e2e-bpm-tx-bpm-step-subcard" role="region" aria-label="核心对象状态变更"><div class="e2e-bpm-tx-bpm-step-subcard-title">核心对象状态变更</div><ul class="e2e-bpm-tx-bpm-core-state-list">${stateLines
                .map((line) => `<li>${buildCoreObjectStateChangeLineHtml(line, esc)}</li>`)
                .join('')}</ul></div>`
            : '';
        parts.push(
          `<div class="e2e-bpm-tx-bpm-step-card${themeClass}" role="listitem">${headRow}${descBlock}${logicBlock}${stateSubcard}</div>`,
        );
      });
      return `<div class="e2e-bpm-tx-bpm-strip" role="list">${parts.join('')}</div>`;
    }
    /** 单事务节点：可折叠；首张默认展开，其余默认折叠；角色 chip 在标题栏名称后（｜ 分隔）；单节点 JSON 见外层「端到端事务流」卡 json Tab */
    function renderTxNodeCard(tx) {
      if (!tx || typeof tx !== 'object') return '';
      const seq = txCardSeq++;
      const expanded = seq === 0;
      const bodyId = `e2e-bpm-tx-node-body-${seq}`;
      const collapseBtnHtml = `<button type="button" class="e2e-bpm-tx-node-collapse-btn" aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="${esc(
        bodyId
      )}" title="展开/折叠详情" aria-label="展开或折叠该事务节点详情">${collapseChevronSvg(expanded)}</button>`;
      const advisorTexts = pickAdvisorChipTexts(tx);
      const roleTailHtml = advisorTexts.length
        ? `<span class="e2e-bpm-tx-node-head-sep e2e-bpm-tx-node-head-sep--roles" aria-hidden="true">｜</span><span class="e2e-bpm-tx-node-head-roles" role="list">${advisorTexts
            .map((t) => `<span class="e2e-bpm-tx-advisor-chip e2e-bpm-tx-advisor-chip--head" role="listitem">${esc(t)}</span>`)
            .join('')}</span>`
        : '';
      const roleAriaSuffix = advisorTexts.length ? `｜${advisorTexts.join('、')}` : '';
      const { html: head, aria } = buildTxNodeTitleBarHtml(tx, { collapseBtnHtml, roleTailHtml, roleAriaSuffix });
      const ariaLabel = aria === '—｜—' ? '事务节点' : aria;
      const viewBody = `<div class="e2e-bpm-tx-bpm-design-card"><div class="e2e-bpm-tx-bpm-design-head">BPM 流程设计</div><div class="e2e-bpm-tx-bpm-design-body">${renderBpmDesignStripHtml(tx)}</div></div>`;
      const cardMod = expanded ? '' : ' e2e-bpm-tx-node-card--collapsed';
      const bodyHidden = expanded ? '' : ' hidden';
      return `<article class="e2e-bpm-tx-node-card${cardMod}" role="group" aria-label="${esc(ariaLabel)}">${head}<div id="${esc(
        bodyId
      )}" class="e2e-bpm-tx-node-body"${bodyHidden}>${viewBody}</div></article>`;
    }
    function renderStageSection(stageTitle, nodes) {
      const title = esc(String(stageTitle || '—'));
      const arr = Array.isArray(nodes) ? nodes : [];
      const inner = arr.length ? arr.map(renderTxNodeCard).join('') : '<p class="e2e-bpm-flow-empty">本阶段暂无事务节点</p>';
      return `<section class="e2e-bpm-stage-card"><header class="e2e-bpm-stage-head"><h3 class="e2e-bpm-stage-title">${title}</h3></header><div class="e2e-bpm-stage-body">${inner}</div></section>`;
    }
    if (Array.isArray(data.stages) && data.stages.length > 0) {
      const sections = data.stages
        .map((st) => renderStageSection(st && st.stage_name, st && st.transaction_nodes))
        .join('');
      return `<div class="e2e-bpm-flow e2e-bpm-flow--by-stage">${sections}</div>`;
    }
    const nodes = data.transaction_nodes;
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return '<p class="vs-view-placeholder">暂无事务节点（transaction_nodes）</p>';
    }
    return `<div class="e2e-bpm-flow e2e-bpm-flow--by-stage">${renderStageSection('事务流', nodes)}</div>`;
  }

  /**
   * 从不同返回结构中提取价值流数组。
   * @param {*} data - 原始接口返回数据。
   * @returns {Array} 价值流列表。
   */
  function getValueStreamList(data) {
    if (data == null) return [];
    if (Array.isArray(data)) return data;
    const raw = data.value_streams ?? data.streams ?? data.list ?? data.data;
    if (Array.isArray(raw)) return raw;
    if (data.stages != null || data.phases != null) return [data];
    if (raw != null && typeof raw === 'object') return [raw];
    return [];
  }

  let currentValueStreamList = [];

  /**
   * 渲染价值流列表并绑定展开/切换事件。
   * @param {Array} list - 价值流数组。
   * @returns {void}
   */
  function renderValueStreamList(list) {
    const el = global.el;
    if (!el || !el.valueStreamContent) return;
    currentValueStreamList.length = 0;
    (list || []).forEach((item) => currentValueStreamList.push(item));
    const container = el.valueStreamContent;
    if (!list || list.length === 0) {
      container.innerHTML = '<p class="vs-empty">暂无价值流数据</p>';
      return;
    }
    container.innerHTML = list.map((item, i) => {
      const name = global.formatValue(item.name ?? item.title ?? item.value_stream_name ?? `价值流 ${i + 1}`);
      const jsonStr = JSON.stringify(item, null, 2);
      return `<div class="vs-card" data-index="${i}"><button type="button" class="vs-card-header" aria-expanded="false" aria-controls="vs-body-${i}"><span class="vs-card-name">${global.escapeHtml(name)}</span><span class="vs-card-chevron" aria-hidden="true">▼</span></button><div class="vs-card-body" id="vs-body-${i}" hidden><div class="vs-tabs"><button type="button" class="vs-tab vs-tab-active" data-tab="view">view</button><button type="button" class="vs-tab" data-tab="json">json</button></div><div class="vs-tab-panel vs-tab-panel-view" data-panel="view" data-rendered="false"><p class="vs-view-placeholder">展开后加载…</p></div><div class="vs-tab-panel vs-tab-panel-json" data-panel="json" hidden><pre class="vs-json">${global.escapeHtml(jsonStr)}</pre></div></div></div>`;
    }).join('');

    container.querySelectorAll('.vs-card-header').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.vs-card');
        const body = card.querySelector('.vs-card-body');
        const expanded = body.hidden;
        body.hidden = !expanded;
        btn.setAttribute('aria-expanded', String(!expanded));
        card.classList.toggle('vs-card-expanded', !expanded);
        if (expanded) {
          const viewPanel = card.querySelector('.vs-tab-panel-view');
          if (viewPanel && viewPanel.dataset.rendered !== 'true') {
            const idx = parseInt(card.dataset.index, 10);
            const item = currentValueStreamList[idx];
            if (item) { viewPanel.innerHTML = renderValueStreamViewHTML(item); viewPanel.dataset.rendered = 'true'; }
          }
        }
      });
    });
    container.querySelectorAll('.vs-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = tab.closest('.vs-card');
        const targetTab = tab.dataset.tab;
        card.querySelectorAll('.vs-tab').forEach((t) => t.classList.remove('vs-tab-active'));
        card.querySelectorAll('.vs-tab-panel').forEach((p) => { p.hidden = p.dataset.panel !== targetTab; });
        tab.classList.add('vs-tab-active');
        if (targetTab === 'view') {
          const viewPanel = card.querySelector('.vs-tab-panel-view');
          if (viewPanel) {
            const idx = parseInt(card.dataset.index, 10);
            const item = currentValueStreamList[idx];
            if (item) { viewPanel.innerHTML = renderValueStreamViewHTML(item); viewPanel.dataset.rendered = 'true'; }
          }
        }
      });
    });
  }

  const E2E_BPM_PREVIEW_SVG_NS = 'http://www.w3.org/2000/svg';

  /**
   * 先移除历史连线图层，再按节点端口 DOM 实测坐标绘制连线（竖链 + 网关 T 型），避免与端口断点。
   * @param {Element|null|undefined} root - 含 `.e2e-bpm-preview-diagram` 的容器（如抽屉 body）
   */
  function syncE2eBpmPreviewDiagramWires(root) {
    if (!root || typeof document === 'undefined') return;
    const diagram = root.classList?.contains('e2e-bpm-preview-diagram')
      ? root
      : root.querySelector?.('.e2e-bpm-preview-diagram');
    if (!diagram) return;

    diagram.querySelectorAll('.e2e-bpm-preview-wire-layer').forEach((el) => el.remove());
    diagram.classList.remove('e2e-bpm-preview-diagram--wires-synced');

    diagram.style.position = 'relative';

    /** 无 fail 列 DOM 时失败支竖线在 split 右缘基础上再向右偏移，避免与通过列节点卡贴齐（橙/金色分叉竖轨共用该 x） */
    const E2E_BPM_FAIL_RAIL_OUTSET_PX = 22;

    /** 按所有端口实测包围盒，覆盖 translate 导致的负坐标与超宽（scrollWidth 不含 transform 外溢） */
    function computeDiagramWireBounds() {
      const dr = diagram.getBoundingClientRect();
      const pad = 14;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      diagram.querySelectorAll('.e2e-bpm-preview-port').forEach((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - dr.left;
        const cy = r.top + r.height / 2 - dr.top;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
      });
      /* gateway-split 底缘可能低于末端口，纳入包围盒避免失败支汇线被裁切 */
      diagram.querySelectorAll('.e2e-bpm-preview-gateway-split').forEach((el) => {
        const r = el.getBoundingClientRect();
        const cx0 = r.left - dr.left;
        const cx1 = r.right - dr.left;
        const cy0 = r.top - dr.top;
        const cy1 = r.bottom - dr.top;
        minX = Math.min(minX, cx0, cx1);
        maxX = Math.max(maxX, cx0, cx1);
        minY = Math.min(minY, cy0, cy1);
        maxY = Math.max(maxY, cy0, cy1);
      });
      if (!Number.isFinite(minX)) {
        const w0 = Math.max(diagram.scrollWidth, diagram.clientWidth);
        const h0 = Math.max(diagram.scrollHeight, diagram.clientHeight);
        return { minX: 0, minY: 0, width: w0, height: h0 };
      }
      return {
        minX: minX - pad,
        minY: minY - pad,
        width: Math.max(1, maxX - minX + pad * 2 + E2E_BPM_FAIL_RAIL_OUTSET_PX),
        height: Math.max(1, maxY - minY + pad * 2),
      };
    }

    const bounds = computeDiagramWireBounds();
    const offX = bounds.minX;
    const offY = bounds.minY;
    const w = bounds.width;
    const h = bounds.height;

    const svg = document.createElementNS(E2E_BPM_PREVIEW_SVG_NS, 'svg');
    svg.setAttribute('class', 'e2e-bpm-preview-wire-layer');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    Object.assign(svg.style, {
      position: 'absolute',
      left: `${offX}px`,
      top: `${offY}px`,
      width: `${w}px`,
      height: `${h}px`,
      overflow: 'visible',
      pointerEvents: 'none',
      zIndex: '4',
    });
    diagram.appendChild(svg);

    const strokeDefault = '#94a3b8';
    const strokeVerify = '#fb923c';
    const strokeDecision = '#ca8a04';
    const overlap = 2.5;

    function portCenter(el) {
      const r = el.getBoundingClientRect();
      const dr = diagram.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - dr.left - offX,
        y: r.top + r.height / 2 - dr.top - offY,
      };
    }

    function gwStroke(gwEl) {
      if (gwEl.classList.contains('e2e-bpm-preview-gateway--verify')) return strokeVerify;
      if (gwEl.classList.contains('e2e-bpm-preview-gateway--decision')) return strokeDecision;
      return strokeDefault;
    }

    function appendPath(d, stroke, sw) {
      const p = document.createElementNS(E2E_BPM_PREVIEW_SVG_NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', stroke);
      p.setAttribute('stroke-width', String(sw));
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(p);
    }

    function appendArrowDown(x, y, stroke) {
      const tri = document.createElementNS(E2E_BPM_PREVIEW_SVG_NS, 'polygon');
      tri.setAttribute('points', `${x},${y + 5} ${x - 4},${y - 1} ${x + 4},${y - 1}`);
      tri.setAttribute('fill', stroke);
      svg.appendChild(tri);
    }

    /** 同列竖线；若 x 不同则用曼哈顿折线；横杠贴在目的地端口 y，避免取中点横穿中间节点正文 */
    function connectPorts(a, b, stroke) {
      const dx = Math.abs(a.x - b.x);
      if (dx < 1.5) {
        const x = (a.x + b.x) / 2;
        const y1 = Math.min(a.y, b.y) - overlap;
        const y2 = Math.max(a.y, b.y) + overlap;
        appendPath(`M ${x} ${y1} L ${x} ${y2}`, stroke, 2);
        if (b.y > a.y) appendArrowDown(x, Math.min(b.y + overlap, y2) - 4, stroke);
        else if (a.y > b.y) appendArrowDown(x, b.y + 4, stroke);
        return;
      }
      const yRail = b.y;
      if (a.y <= b.y) {
        appendPath(
          `M ${a.x} ${a.y - overlap} L ${a.x} ${yRail} L ${b.x} ${yRail} L ${b.x} ${b.y + overlap}`,
          stroke,
          2,
        );
        appendArrowDown(b.x, b.y - 4, stroke);
      } else {
        appendPath(
          `M ${a.x} ${a.y + overlap} L ${a.x} ${yRail} L ${b.x} ${yRail} L ${b.x} ${b.y - overlap}`,
          stroke,
          2,
        );
        appendArrowDown(b.x, b.y + 4, stroke);
      }
    }

    /** 列体首个直接子元素的顶入端口（不扫整棵子树） */
    function findFirstInTopInColBody(scope) {
      if (!scope) return null;
      const kids = [...scope.children];
      for (const k of kids) {
        if (k.classList.contains('e2e-bpm-preview-step--task')) {
          const rect = k.querySelector('.e2e-bpm-preview-rect');
          return rect?.querySelector('.e2e-bpm-preview-port--in-top') ?? null;
        }
        if (k.classList.contains('e2e-bpm-preview-step--gateway')) {
          const rect =
            k.querySelector('.e2e-bpm-preview-gateway .e2e-bpm-preview-rect--branch') ||
            k.querySelector('.e2e-bpm-preview-rect');
          return rect?.querySelector('.e2e-bpm-preview-port--in-top') ?? null;
        }
      }
      return null;
    }

    function colFallbackInPoint(colBody) {
      if (!colBody) return null;
      const r = colBody.getBoundingClientRect();
      const dr = diagram.getBoundingClientRect();
      return { x: r.left + r.width / 2 - dr.left - offX, y: r.top + 8 - dr.top - offY };
    }

    /** 失败列空体时底边中点，作为 oFail 汇入全局「结束」 */
    function colBottomOutPoint(colBody) {
      if (!colBody) return null;
      const r = colBody.getBoundingClientRect();
      const dr = diagram.getBoundingClientRect();
      return { x: r.left + r.width / 2 - dr.left - offX, y: r.bottom - 6 - dr.top - offY };
    }

    /**
     * 列内竖链：支持嵌套 `step--gateway`（递归 drawGatewayT），并与后续 task 汇流。
     * columnKind：本列是网关左列(pass)还是右列(fail)，用于「仅一个子 gateway」时取 drawGatewayT 的对应出口，避免误返回 null 导致全局汇线错乱。
     */
    function wireColBody(colBody, stroke, columnKind) {
      const kind = columnKind === 'fail' ? 'fail' : 'pass';
      const kids = [...colBody.children];
      function pickColumnOut(rawOuts) {
        if (!rawOuts || !rawOuts.length) return null;
        const idx = kind === 'fail' ? 1 : 0;
        return rawOuts[idx] ?? null;
      }
      function wireFromIndex(i, lastOut) {
        if (i >= kids.length) return lastOut;
        const child = kids[i];
        if (child.classList.contains('e2e-bpm-preview-step--task')) {
          const rect = child.querySelector('.e2e-bpm-preview-rect');
          const pin = rect?.querySelector('.e2e-bpm-preview-port--in-top');
          const pout = rect?.querySelector('.e2e-bpm-preview-port--out-bottom');
          if (lastOut && pin) connectPorts(lastOut, portCenter(pin), stroke);
          const nextOut = pout ? portCenter(pout) : null;
          return wireFromIndex(i + 1, nextOut);
        }
        if (child.classList.contains('e2e-bpm-preview-step--gateway')) {
          const gw = child.querySelector('.e2e-bpm-preview-gateway');
          const branchRect = gw?.querySelector('.e2e-bpm-preview-rect--branch');
          const pin = branchRect?.querySelector('.e2e-bpm-preview-port--in-top');
          if (lastOut && pin) connectPorts(lastOut, portCenter(pin), stroke);
          if (!gw) return wireFromIndex(i + 1, null);
          const { outs: rawOuts } = drawGatewayT(gw);
          const merged = rawOuts.filter(Boolean);
          const nextIdx = i + 1;
          if (!rawOuts.length) return wireFromIndex(nextIdx, null);
          if (nextIdx >= kids.length) {
            return pickColumnOut(rawOuts);
          }
          const next = kids[nextIdx];
          if (next.classList.contains('e2e-bpm-preview-step--task')) {
            const rect = next.querySelector('.e2e-bpm-preview-rect');
            const pinIn = rect?.querySelector('.e2e-bpm-preview-port--in-top');
            if (pinIn) {
              const pIn = portCenter(pinIn);
              merged.forEach((o) => connectPorts(o, pIn, stroke));
            }
            const pout = rect?.querySelector('.e2e-bpm-preview-port--out-bottom');
            const nextOut = pout ? portCenter(pout) : null;
            return wireFromIndex(nextIdx + 1, nextOut);
          }
          if (next.classList.contains('e2e-bpm-preview-step--gateway')) {
            const innerPin = next.querySelector(
              '.e2e-bpm-preview-gateway .e2e-bpm-preview-rect--branch .e2e-bpm-preview-port--in-top',
            );
            if (innerPin) {
              const pIn = portCenter(innerPin);
              merged.forEach((o) => connectPorts(o, pIn, stroke));
            }
            return wireFromIndex(nextIdx, null);
          }
          return pickColumnOut(rawOuts);
        }
        return wireFromIndex(i + 1, lastOut);
      }
      return wireFromIndex(0, null);
    }

    function drawGatewayT(gwEl) {
      const stroke = gwStroke(gwEl);
      const branchRect = gwEl.querySelector('.e2e-bpm-preview-rect--branch');
      const pOutEl = branchRect?.querySelector('.e2e-bpm-preview-port--out-bottom');
      const splitEl = gwEl.querySelector('.e2e-bpm-preview-gateway-split');
      const passBody = gwEl.querySelector('.e2e-bpm-preview-gw-col--pass .e2e-bpm-preview-col-body');
      const failBody = gwEl.querySelector('.e2e-bpm-preview-gw-col--fail .e2e-bpm-preview-col-body');
      const drDiagram = diagram.getBoundingClientRect();
      let pinPass = findFirstInTopInColBody(passBody);
      let pinFail = failBody ? findFirstInTopInColBody(failBody) : null;
      const A = pinPass ? portCenter(pinPass) : colFallbackInPoint(passBody);
      let B;
      if (failBody) {
        B = pinFail ? portCenter(pinFail) : colFallbackInPoint(failBody);
      } else if (splitEl && A) {
        const sr = splitEl.getBoundingClientRect();
        B = { x: sr.right - drDiagram.left - offX + E2E_BPM_FAIL_RAIL_OUTSET_PX, y: A.y };
      } else if (A) {
        B = { x: A.x + 40, y: A.y };
      } else {
        B = null;
      }
      if (!pOutEl || !A || !B) return { outs: [null, null], stroke };
      const O = portCenter(pOutEl);
      const topPinY = Math.min(A.y, B.y);
      const gapDown = topPinY - O.y;
      /* 横杠须落在 bridge 区、且低于两侧顶入点，避免 stub 比例过大时横穿节点卡片 */
      const stubRaw = Math.max(8, Math.min(20, gapDown * 0.32));
      let yBar = O.y + stubRaw;
      const yBarMax = topPinY - 6;
      if (yBar > yBarMax) yBar = Math.max(O.y + 6, yBarMax);
      if (yBar <= O.y) yBar = O.y + 6;
      appendPath(`M ${O.x} ${O.y - overlap} L ${O.x} ${yBar}`, stroke, 2);
      const xL = Math.min(O.x, A.x, B.x);
      const xR = Math.max(O.x, A.x, B.x);
      appendPath(`M ${xL} ${yBar} L ${xR} ${yBar}`, stroke, 2);
      appendPath(`M ${A.x} ${yBar} L ${A.x} ${A.y + overlap}`, stroke, 2);
      appendPath(`M ${B.x} ${yBar} L ${B.x} ${B.y + overlap}`, stroke, 2);

      const passStroke = stroke;
      const failStroke = stroke;
      const oPass = wireColBody(passBody, passStroke, 'pass');
      let oFail = failBody ? wireColBody(failBody, failStroke, 'fail') : null;
      if (!oFail && failBody) {
        const exit = colBottomOutPoint(failBody);
        const entry = pinFail ? portCenter(pinFail) : colFallbackInPoint(failBody);
        if (exit && entry && exit.y > entry.y + 2) {
          connectPorts({ x: entry.x, y: entry.y + overlap }, exit, failStroke);
        }
        oFail = exit;
      } else if (!oFail && !failBody && splitEl && B) {
        const sr = splitEl.getBoundingClientRect();
        const legEnd = { x: B.x, y: B.y + overlap };
        const exit = { x: B.x, y: sr.bottom - drDiagram.top - offY - 6 };
        if (exit.y > legEnd.y + 2) {
          connectPorts(legEnd, exit, failStroke);
        }
        oFail = exit;
      }
      /* 必须固定 [pass, fail] 二元组，勿 filter(Boolean)，否则一侧 null 时索引错位，pickColumnOut 会取错分支并产生长竖错位线 */
      return { outs: [oPass, oFail], stroke };
    }

    let lastOut = null;
    const children = [...diagram.children].filter((c) => !c.classList.contains('e2e-bpm-preview-wire-layer'));
    const branchLastOuts = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.classList.contains('e2e-bpm-preview-terminal--start')) {
        const p = child.querySelector('.e2e-bpm-preview-port--out-bottom');
        if (p) lastOut = portCenter(p);
      } else if (child.classList.contains('e2e-bpm-preview-connector')) {
        continue;
      } else if (child.classList.contains('e2e-bpm-preview-step--task')) {
        const rect = child.querySelector('.e2e-bpm-preview-rect');
        const pin = rect?.querySelector('.e2e-bpm-preview-port--in-top');
        const pout = rect?.querySelector('.e2e-bpm-preview-port--out-bottom');
        if (lastOut && pin) connectPorts(lastOut, portCenter(pin), strokeDefault);
        lastOut = pout ? portCenter(pout) : null;
      } else if (child.classList.contains('e2e-bpm-preview-step--gateway')) {
        const gw = child.querySelector('.e2e-bpm-preview-gateway');
        const branchRect = gw?.querySelector('.e2e-bpm-preview-rect--branch');
        const pin = branchRect?.querySelector('.e2e-bpm-preview-port--in-top');
        if (lastOut && pin) connectPorts(lastOut, portCenter(pin), strokeDefault);
        if (gw) {
          const { outs } = drawGatewayT(gw);
          branchLastOuts.length = 0;
          outs.forEach((o) => {
            if (o) branchLastOuts.push(o);
          });
        }
        lastOut = null;
      } else if (child.classList.contains('e2e-bpm-preview-terminal--end')) {
        const p = child.querySelector('.e2e-bpm-preview-port--in-top');
        if (p) {
          const endPt = portCenter(p);
          if (branchLastOuts.length) {
            branchLastOuts.forEach((o) => connectPorts(o, endPt, strokeDefault));
          } else if (lastOut) {
            connectPorts(lastOut, endPt, strokeDefault);
          }
        }
        lastOut = null;
        branchLastOuts.length = 0;
      }
    }

    if (typeof globalThis !== 'undefined' && globalThis.__FE_E2E_BPM_WIRE_DEBUG) {
      console.log('[FE:e2e-bpm-wire]', {
        svgSize: { w, h },
        offset: { offX, offY },
        paths: svg.querySelectorAll('path').length,
        polygons: svg.querySelectorAll('polygon').length,
      });
    }

    diagram.classList.add('e2e-bpm-preview-diagram--wires-synced');
  }

  global.extractPureStageName = extractPureStageName;
  global.splitStageTitleAndParenthetical = splitStageTitleAndParenthetical;
  global.extractStepNameAndDesc = extractStepNameAndDesc;
  global.parseValueStreamGraph = parseValueStreamGraph;
  global.renderValueStreamViewHTML = renderValueStreamViewHTML;
  global.renderEndToEndFlowHTML = renderEndToEndFlowHTML;
  global.renderE2eBpmTransactionFlowHTML = renderE2eBpmTransactionFlowHTML;
  global.buildE2eBpmTransactionFlowPreviewDiagramHTML = buildE2eBpmTransactionFlowPreviewDiagramHTML;
  global.syncE2eBpmPreviewDiagramWires = syncE2eBpmPreviewDiagramWires;
  global.getValueStreamList = getValueStreamList;
  global.currentValueStreamList = currentValueStreamList;
  global.renderValueStreamList = renderValueStreamList;
})(typeof window !== 'undefined' ? window : this);
