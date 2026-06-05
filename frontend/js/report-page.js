/**
 * [INPUT]: `window.APP_CONFIG`、`js/auth-runtime.js`、聚合接口 `GET /problem-cases/:id/report`；
 *          正式渲染依赖 `js/utils.js`、`valueStream.js`、`report-global-itgap-render.js`、`report-formal-render.js`（需求洞察/业务对象列表为 report DTO 专用，不再依赖 preliminary/CBO 工作区卡）
 * [OUTPUT]: 渲染 `report.html` 五模块（与主站 problem-detail 表达一致）与嵌入版 Mermaid
 * [POS]: 在线版售前分析报告 v1（FE-20260324-19 正式报告级闭环）
 *
 * [PROTOCOL]: 变更解析字段、依赖脚本顺序或鉴权行为时同步更新本 Header 与 frontend/AGENTS.md
 * FE-20260325-06：报告页 `?caseId=` 链路对 403/404 统一收口（不依赖本地假过滤），提示“案例不存在或无权访问”
 */
(function (global) {
  'use strict';

  var EMPTY_TEXT = '待完善 / 暂无数据';

  function esc(s) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(s);
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getCaseIdFromQuery() {
    try {
      var u = new URL(global.location.href);
      var id = u.searchParams.get('caseId');
      return id && String(id).trim() ? String(id).trim() : '';
    } catch (e) {
      return '';
    }
  }

  function getBackendBaseUrl() {
    var cfg = global.APP_CONFIG || {};
    return String(cfg.BACKEND_API_URL || '').replace(/\/$/, '');
  }

  function isOnlineMode() {
    var cfg = global.APP_CONFIG || {};
    return String(cfg.MODE || '').toLowerCase() === 'online' && Boolean(getBackendBaseUrl());
  }

  function normalizeReportPayload(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var r = raw;
    if (r.data && typeof r.data === 'object') r = r.data;

    function pick(obj, keys) {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (obj[k] != null) return obj[k];
      }
      return null;
    }

    var demandInsight = pick(r, [
      'demandInsight',
      'requirementInsight',
      'requirement_insight',
      'demand_insight',
      'insight',
    ]);

    var valueStream = pick(r, [
      'valueStream',
      'valueStreamPainPoints',
      'valueStreamAndPainPoints',
      'value_stream_pain_points',
      'valueStreamPainPointAnnotation',
      'painPointAnnotation',
    ]);

    var globalItGap = pick(r, ['globalItGap', 'globalITGap', 'global_it_gap', 'globalItgap']);

    var businessObjectItems = null;
    var graph = null;
    var boRoot = r.businessObjects;

    if (boRoot != null && typeof boRoot === 'object' && !Array.isArray(boRoot)) {
      if (Array.isArray(boRoot.items)) businessObjectItems = boRoot.items;
      if (boRoot.graph != null && typeof boRoot.graph === 'object') graph = boRoot.graph;
    } else if (Array.isArray(boRoot)) {
      businessObjectItems = boRoot;
    }

    if (graph == null) {
      graph = pick(r, ['graph', 'businessObjectGraph', 'objectGraph', 'relationGraph']);
    }

    var reportMeta =
      r.reportMeta != null && typeof r.reportMeta === 'object' ? r.reportMeta : null;

    return {
      demandInsight: demandInsight,
      valueStream: valueStream,
      globalItGap: globalItGap,
      businessObjectItems: businessObjectItems,
      graph: graph,
      reportMeta: reportMeta,
    };
  }

  function fallbackValueBlock(container, value) {
    if (value == null || (typeof value === 'object' && Object.keys(value).length === 0)) {
      container.innerHTML = '<p class="report-empty">' + EMPTY_TEXT + '</p>';
      return;
    }
    if (typeof value === 'string') {
      container.innerHTML = '<pre class="report-pre">' + esc(value) + '</pre>';
      return;
    }
    try {
      container.innerHTML = '<pre class="report-pre">' + esc(JSON.stringify(value, null, 2)) + '</pre>';
    } catch (e) {
      container.innerHTML = '<p class="report-empty">' + EMPTY_TEXT + '</p>';
    }
  }

  function getNodeKeyOrId(n) {
    if (!n || typeof n !== 'object') return '';
    if (n.key != null && String(n.key).trim() !== '') return String(n.key).trim();
    if (n.id != null && String(n.id).trim() !== '') return String(n.id).trim();
    return '';
  }

  function escapeMermaidLabel(s) {
    return String(s)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .trim()
      .slice(0, 120);
  }

  /** 仅使用「至少出现在一条边上」的节点，避免无边时一堆孤立节点堆叠 */
  function buildMermaidSource(graph) {
    if (!graph || typeof graph !== 'object') return '';
    var nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    var edges = Array.isArray(graph.edges) ? graph.edges : [];
    if (!edges.length) return '';

    var connected = {};
    for (var ei = 0; ei < edges.length; ei++) {
      var ed = edges[ei] || {};
      var from = ed.from != null ? ed.from : ed.source != null ? ed.source : ed.sourceId;
      var to = ed.to != null ? ed.to : ed.target != null ? ed.target : ed.targetId;
      if (from != null) connected[String(from).trim()] = true;
      if (to != null) connected[String(to).trim()] = true;
    }

    var filteredNodes = nodes.filter(function (n) {
      var ref = getNodeKeyOrId(n);
      return ref && connected[ref];
    });
    if (filteredNodes.length === 0) {
      filteredNodes = nodes.slice();
    }

    var lines = ['flowchart LR'];
    for (var i = 0; i < filteredNodes.length; i++) {
      var n = filteredNodes[i] || {};
      var ref = getNodeKeyOrId(n);
      var fallbackRef = ref || 'n' + i;
      var label =
        n.label != null
          ? String(n.label)
          : n.name != null
            ? String(n.name)
            : n.title != null
              ? String(n.title)
              : fallbackRef;
      lines.push('  N' + i + '["' + escapeMermaidLabel(label || fallbackRef) + '"]');
    }

    function resolveNodeIndex(edgeEndpoint) {
      if (edgeEndpoint == null) return -1;
      var s = String(edgeEndpoint).trim();
      if (!s) return -1;
      for (var j = 0; j < filteredNodes.length; j++) {
        var node = filteredNodes[j] || {};
        var k = node.key != null ? String(node.key).trim() : '';
        var id = node.id != null ? String(node.id).trim() : '';
        if (k === s || id === s) return j;
      }
      return -1;
    }

    for (var e = 0; e < edges.length; e++) {
      var edge = edges[e] || {};
      var fromE = edge.from != null ? edge.from : edge.source != null ? edge.source : edge.sourceId;
      var toE = edge.to != null ? edge.to : edge.target != null ? edge.target : edge.targetId;
      var fi = resolveNodeIndex(fromE);
      var ti = resolveNodeIndex(toE);
      if (fi >= 0 && ti >= 0) {
        lines.push('  N' + fi + ' --> N' + ti);
      }
    }

    return lines.join('\n');
  }

  async function renderMermaidEmbedded(container, graph) {
    var rf = global.reportFormalRender;
    var nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
    var edges = graph && Array.isArray(graph.edges) ? graph.edges : [];
    if (!rf || typeof rf.buildGraphSectionHtml !== 'function') {
      container.innerHTML = '<p class="report-empty">' + EMPTY_TEXT + '</p>';
      return;
    }
    if (edges.length === 0) {
      container.innerHTML = rf.buildGraphSectionHtml('', '', { relationshipEmpty: true });
      return;
    }
    var src = buildMermaidSource(graph);
    if (!src) {
      container.innerHTML = rf.buildGraphSectionHtml('', '', { relationshipEmpty: true });
      return;
    }
    try {
      if (!global.mermaid || typeof global.mermaid.render !== 'function') {
        container.innerHTML = rf.buildGraphSectionHtml(
          '<p class="report-empty">Mermaid 未加载</p><pre class="report-pre">' + esc(src) + '</pre>',
          src
        );
        return;
      }
      global.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: {
          primaryColor: '#eef2ff',
          primaryTextColor: '#1e293b',
          primaryBorderColor: '#6366f1',
          lineColor: '#94a3b8',
          secondaryColor: '#f8fafc',
          tertiaryColor: '#fff',
          fontFamily:
            '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif',
          fontSize: '13px',
        },
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
          padding: 10,
          nodeSpacing: 50,
          rankSpacing: 55,
        },
      });
      var id = 'report-mmd-' + String(Date.now());
      var out = await global.mermaid.render(id, src);
      var svg = out && out.svg ? out.svg : '';
      container.innerHTML = rf.buildGraphSectionHtml(svg, src);
    } catch (err) {
      container.innerHTML = rf.buildGraphSectionHtml(
        '<p class="report-empty">关联图渲染失败</p><pre class="report-pre">' + esc(src) + '</pre>',
        src
      );
    }
  }

  function applyFormalSections(norm, reqEl, vsEl, gapEl, boEl) {
    var rf = global.reportFormalRender;
    var empty = '<p class="report-empty">' + EMPTY_TEXT + '</p>';
    if (!rf || typeof rf.buildDemandInsightHtml !== 'function') {
      fallbackValueBlock(reqEl, norm.demandInsight);
      fallbackValueBlock(vsEl, norm.valueStream);
      fallbackValueBlock(gapEl, norm.globalItGap);
      var boItems = Array.isArray(norm.businessObjectItems) ? norm.businessObjectItems : [];
      if (!boItems.length) boEl.innerHTML = empty;
      else fallbackValueBlock(boEl, boItems);
      return;
    }

    var d = rf.buildDemandInsightHtml(norm.demandInsight);
    reqEl.innerHTML = d && d.trim() ? d : rf.EMPTY_INNER || empty;

    var v = rf.buildValueStreamHtml(norm.valueStream);
    vsEl.innerHTML = v && v.trim() ? v : rf.EMPTY_INNER || empty;

    var g = rf.buildGlobalItGapHtml(norm.globalItGap);
    gapEl.innerHTML = g && String(g).trim() ? g : rf.EMPTY_INNER || empty;

    var boItems = norm.businessObjectItems;
    if (!Array.isArray(boItems)) boItems = [];
    var bo = rf.buildBusinessObjectsHtml(boItems);
    boEl.innerHTML = bo && bo.trim() ? bo : rf.EMPTY_INNER || empty;
  }

  function setupReportInteraction() {
    var root = document.querySelector('.report-main');
    if (!root || root.getAttribute('data-report-bound') === '1') return;
    root.setAttribute('data-report-bound', '1');
    root.addEventListener('click', function (e) {
      var sub = e.target.closest('.problem-detail-global-itgap-subcard-header');
      if (sub && root.contains(sub)) {
        var body = sub.nextElementSibling;
        if (body && body.classList.contains('problem-detail-global-itgap-subcard-body')) {
          var exp = sub.getAttribute('aria-expanded') === 'true';
          sub.setAttribute('aria-expanded', String(!exp));
          body.hidden = exp;
        }
        return;
      }
      var dimTab = e.target.closest('.problem-detail-global-itgap-dimension-tab');
      if (dimTab && root.contains(dimTab)) {
        var wrap = dimTab.closest('.problem-detail-global-itgap-dimension-subcard');
        if (!wrap) return;
        var panel = dimTab.getAttribute('data-tab');
        var tabs = wrap.querySelectorAll('.problem-detail-global-itgap-dimension-tab');
        for (var i = 0; i < tabs.length; i++) {
          var b = tabs[i];
          var active = b.getAttribute('data-tab') === panel;
          b.classList.toggle('problem-detail-global-itgap-dimension-tab-active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        }
        var ps = wrap.querySelectorAll('.problem-detail-global-itgap-dimension-panel');
        for (var j = 0; j < ps.length; j++) {
          var p = ps[j];
          p.hidden = p.getAttribute('data-panel') !== panel;
        }
        return;
      }
      var boTab = e.target.closest('.problem-detail-core-business-object-tab');
      if (boTab && root.contains(boTab)) {
        var card = boTab.closest('.problem-detail-card-core-business-object');
        if (!card) return;
        var tpanel = boTab.getAttribute('data-tab');
        var btabs = card.querySelectorAll('.problem-detail-core-business-object-tab');
        for (var bi = 0; bi < btabs.length; bi++) {
          var bt = btabs[bi];
          var ac = bt.getAttribute('data-tab') === tpanel;
          bt.classList.toggle('problem-detail-core-business-object-tab-active', ac);
        }
        var pns = card.querySelectorAll('.problem-detail-core-business-object-panel');
        for (var pj = 0; pj < pns.length; pj++) {
          var pn = pns[pj];
          pn.hidden = pn.getAttribute('data-panel') !== tpanel;
        }
        return;
      }
      var cardH = e.target.closest('.problem-detail-card-header[role="button"], .problem-detail-card-header[tabindex="0"]');
      if (!cardH || !root.contains(cardH)) return;
      if (cardH.closest('.problem-detail-global-itgap-dimension-subcard')) return;
      var card = cardH.closest('.problem-detail-card');
      if (!card) return;
      var cbody = card.querySelector('.problem-detail-card-body');
      if (!cbody) return;
      var ex = cardH.getAttribute('aria-expanded') === 'true';
      cardH.setAttribute('aria-expanded', String(!ex));
      cbody.hidden = ex;
    });
  }

  async function fetchReportJson(caseId) {
    var base = getBackendBaseUrl();
    var url = base + '/problem-cases/' + encodeURIComponent(caseId) + '/report';
    var headers = Object.assign(
      { Accept: 'application/json' },
      typeof global.getAuthHeaders === 'function' ? global.getAuthHeaders() : {}
    );
    var res = await fetch(url, { method: 'GET', headers: headers, credentials: 'same-origin' });
    if (typeof global.applyAuthRenewalFromResponse === 'function') {
      global.applyAuthRenewalFromResponse(res);
    }
    var text = await res.text();
    var json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e2) {
      json = null;
    }
    return { res: res, json: json, text: text };
  }

  /** owner 最小快照：默认开启；页面设 window.__FE_REPORT_SNAPSHOT_LOG = false 可关闭 */
  function logReportSnapshot(norm) {
    if (global.__FE_REPORT_SNAPSHOT_LOG === false) return;
    try {
      var g = norm.graph || {};
      var gn = Array.isArray(g.nodes) ? g.nodes.length : 0;
      var ge = Array.isArray(g.edges) ? g.edges.length : 0;
      var boLen = Array.isArray(norm.businessObjectItems) ? norm.businessObjectItems.length : 0;
      console.info('[FE:report-snapshot]', {
        demandInsight: norm.demandInsight,
        globalItGap: norm.globalItGap,
        businessObjectsItemsLen: boLen,
        graphNodes: gn,
        graphEdges: ge,
      });
    } catch (e) {}
  }

  /** owner 最小日志：价值流 step DTO 与报告页 IT 现状命中 */
  function logValueStreamRenderSnapshot(norm, vsEl) {
    if (global.__FE_REPORT_SNAPSHOT_LOG === false) return;
    try {
      var stages = Array.isArray(norm && norm.valueStream && norm.valueStream.stages)
        ? norm.valueStream.stages
        : [];
      var stage0 = stages.length ? stages[0] : null;
      var step0List = stage0 && Array.isArray(stage0.steps) ? stage0.steps : [];
      var renderedItStatusCount = vsEl
        ? vsEl.querySelectorAll('.vs-step-meta-it-status').length
        : 0;
      console.info('[FE:report-value-stream]', {
        stage0Steps: step0List,
        renderedItStatusCount: renderedItStatusCount,
      });
    } catch (e) {}
  }

  function parseErrorMessage(json, fallback) {
    if (json && typeof json === 'object') {
      if (json.message != null) return String(json.message);
      if (json.error != null) return String(json.error);
    }
    return fallback || '请求失败';
  }

  function extractCustomerName(norm) {
    if (!norm || typeof norm !== 'object') return '';
    var meta = norm.reportMeta && typeof norm.reportMeta === 'object' ? norm.reportMeta : null;
    var di = norm.demandInsight && typeof norm.demandInsight === 'object' ? norm.demandInsight : null;
    var candidates = [];
    if (meta) {
      candidates.push(meta.customerName, meta.customer, meta.enterpriseName, meta.companyName, meta.clientName);
    }
    if (di) {
      candidates.push(di.customerName, di.enterpriseName, di.companyName, di.clientName);
    }
    for (var i = 0; i < candidates.length; i++) {
      var v = candidates[i];
      if (v == null) continue;
      var s = String(v).trim();
      if (!s) continue;
      if (s === '—' || s === '-') continue;
      return s;
    }
    return '';
  }

  async function main() {
    var sub = document.getElementById('reportSubtitle');
    var titleEl = document.querySelector('.report-title');
    var caseId = getCaseIdFromQuery();
    if (sub) {
      sub.textContent = caseId
        ? '案例 ID：' + caseId + ' · 内部资料，请勿外发'
        : '未提供 caseId';
    }

    if (!caseId) {
      var errEl = document.getElementById('reportLoadError');
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = '缺少查询参数 caseId，请在地址栏使用 report.html?caseId=…';
      }
      return;
    }

    if (!isOnlineMode()) {
      var errMode = document.getElementById('reportLoadError');
      if (errMode) {
        errMode.hidden = false;
        errMode.textContent =
          '当前为 local 或未配置 BACKEND_API_URL，售前分析报告仅支持 online 模式。';
      }
      return;
    }

    var loadErr = document.getElementById('reportLoadError');
    var reqEl = document.getElementById('reportRequirement');
    var vsEl = document.getElementById('reportValueStream');
    var gapEl = document.getElementById('reportGlobalItGap');
    var boEl = document.getElementById('reportBusinessObjects');
    var gEl = document.getElementById('reportGraph');

    function clearReportContentToSafeEmpty() {
      var emp = '<p class="report-empty">' + EMPTY_TEXT + '</p>';
      if (reqEl) reqEl.innerHTML = emp;
      if (vsEl) vsEl.innerHTML = emp;
      if (gapEl) gapEl.innerHTML = emp;
      if (boEl) boEl.innerHTML = emp;
      if (gEl) gEl.innerHTML = emp;
      if (titleEl) titleEl.textContent = '售前分析报告';
    }

    try {
      var result = await fetchReportJson(caseId);
      var res = result.res;
      var json = result.json;

      if (res.status === 401) {
        if (typeof global.handleAuthError === 'function') {
          global.handleAuthError(401, {
            url: getBackendBaseUrl() + '/problem-cases/…/report',
            message: parseErrorMessage(json, ''),
            source: 'report-page:fetchReport',
          });
        }
        return;
      }

      if (res.status === 403 || res.status === 404) {
        // 安全态收口：不保留旧报告内容
        clearReportContentToSafeEmpty();
        if (res.status === 403 && typeof global.handleAuthForbidden === 'function') {
          global.handleAuthForbidden({
            url: getBackendBaseUrl() + '/problem-cases/…/report',
            message: parseErrorMessage(json, ''),
            source: 'report-page:fetchReport',
          });
        } else if (typeof global.showError === 'function') {
          global.showError('案例不存在或无权访问');
        }
        if (loadErr) {
          loadErr.hidden = false;
          loadErr.textContent = '案例不存在或无权访问。';
        }
        return;
      }

      if (!res.ok) {
        if (loadErr) {
          loadErr.hidden = false;
          loadErr.textContent =
            '加载报告失败（HTTP ' +
            res.status +
            '）：' +
            parseErrorMessage(json, result.text || res.statusText || '');
        }
        clearReportContentToSafeEmpty();
        return;
      }

      var norm = normalizeReportPayload(json);
      if (!norm) {
        if (loadErr) {
          loadErr.hidden = false;
          loadErr.textContent = '报告数据格式异常，无法解析。';
        }
        return;
      }

      logReportSnapshot(norm);

      if (loadErr) loadErr.hidden = true;
      var subBase = '案例 ID：' + caseId + ' · 内部资料，请勿外发';
      if (sub) {
        sub.textContent = subBase;
        if (norm.reportMeta && typeof norm.reportMeta === 'object') {
          var m = norm.reportMeta;
          var bits = [];
          if (m.generatedAt != null && String(m.generatedAt).trim() !== '') {
            bits.push('生成时间：' + String(m.generatedAt).trim());
          }
          if (m.version != null && String(m.version).trim() !== '') {
            bits.push('版本：' + String(m.version).trim());
          }
          if (bits.length) sub.textContent = subBase + ' · ' + bits.join(' · ');
        }
      }
      if (titleEl) {
        var customerName = extractCustomerName(norm);
        titleEl.textContent = customerName
          ? '售前分析报告｜' + customerName
          : '售前分析报告';
      }

      applyFormalSections(norm, reqEl, vsEl, gapEl, boEl);
      logValueStreamRenderSnapshot(norm, vsEl);
      await renderMermaidEmbedded(gEl, norm.graph);
      setupReportInteraction();
    } catch (e) {
      if (loadErr) {
        loadErr.hidden = false;
        loadErr.textContent = '网络或脚本异常：' + (e && e.message ? e.message : String(e));
      }
      clearReportContentToSafeEmpty();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})(typeof window !== 'undefined' ? window : globalThis);
