/**
 * [INPUT]: `renderMarkdown`/`escapeHtml`（utils.js）、`renderValueStreamViewHTML`/`renderEndToEndFlowHTML`（valueStream.js）、
 *          `reportGlobalItGapBuildWorkspaceHtml`（report-global-itgap-render.js）
 * [OUTPUT]: 售前报告页各模块「正式」HTML 片段（与主站 problem-detail 表达一致；需求洞察/业务对象按 report DTO 映射）
 * [POS]: FE-20260324-19 正式渲染收口（薄复用，不复制业务规则）
 *
 * [PROTOCOL]: 变更展示结构时同步更新本 Header 与 frontend/AGENTS.md
 */
(function (global) {
  'use strict';

  var EMPTY_INNER = '<p class="report-empty">待完善 / 暂无数据</p>';

  function hasContent(v) {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }

  function esc(s) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(s);
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function md(s) {
    if (s == null || String(s).trim() === '') return '';
    if (typeof global.renderMarkdown === 'function') return global.renderMarkdown(String(s));
    return esc(String(s));
  }

  /**
   * 按 GET /problem-cases/:id/report 的 demandInsight DTO 渲染（非 preliminaryReq 字段集）
   */
  function buildDemandInsightHtml(demandInsight) {
    if (demandInsight == null) return '';
    if (typeof demandInsight === 'string') {
      var ts = demandInsight.trim();
      if (!ts) return '';
      return (
        '<div class="report-formal-card report-formal-card--demand">' +
        '<div class="report-demand-insight" data-report="demandInsight">' +
        '<div class="report-demand-block">' +
        '<h4 class="report-demand-block-title">初步需求与挑战</h4>' +
        '<div class="report-demand-block-body markdown-body">' +
        md(ts) +
        '</div></div></div></div>'
      );
    }
    if (typeof demandInsight !== 'object') return '';

    var bg = demandInsight.enterpriseCustomerBackground;
    var needs = demandInsight.preliminaryNeedsAndChallenges;
    var rls = demandInsight.requirementLogicSections;
    var hasRls =
      rls &&
      typeof rls === 'object' &&
      (hasContent(rls.industryCompetition) ||
        hasContent(rls.causalRelation) ||
        hasContent(rls.deepMotivation) ||
        hasContent(rls.logicChainSummary));

    if (!hasContent(bg) && !hasContent(needs) && !hasRls) return '';

    var parts = [];
    if (hasContent(bg)) {
      parts.push(
        '<div class="report-demand-block">' +
        '<h4 class="report-demand-block-title">企业 / 客户背景摘要</h4>' +
        '<div class="report-demand-block-body markdown-body">' +
        md(bg) +
        '</div></div>'
      );
    }
    if (hasContent(needs)) {
      parts.push(
        '<div class="report-demand-block">' +
        '<h4 class="report-demand-block-title">初步需求与挑战摘要</h4>' +
        '<div class="report-demand-block-body markdown-body">' +
        md(needs) +
        '</div></div>'
      );
    }
    if (hasRls) {
      var sub = [];
      if (hasContent(rls.industryCompetition)) {
        sub.push(
          '<div class="report-demand-logic-sub">' +
          '<h5 class="report-demand-logic-sub-title">行业竞争与底层逻辑</h5>' +
          '<div class="markdown-body">' +
          md(rls.industryCompetition) +
          '</div></div>'
        );
      }
      if (hasContent(rls.causalRelation)) {
        sub.push(
          '<div class="report-demand-logic-sub">' +
          '<h5 class="report-demand-logic-sub-title">初步需求与商业模式（因果）</h5>' +
          '<div class="markdown-body">' +
          md(rls.causalRelation) +
          '</div></div>'
        );
      }
      if (hasContent(rls.deepMotivation)) {
        sub.push(
          '<div class="report-demand-logic-sub">' +
          '<h5 class="report-demand-logic-sub-title">需求背后的深层动机</h5>' +
          '<div class="markdown-body">' +
          md(rls.deepMotivation) +
          '</div></div>'
        );
      }
      if (hasContent(rls.logicChainSummary)) {
        sub.push(
          '<div class="report-demand-logic-sub">' +
          '<h5 class="report-demand-logic-sub-title">逻辑链条总结</h5>' +
          '<div class="markdown-body">' +
          md(rls.logicChainSummary) +
          '</div></div>'
        );
      }
      parts.push(
        '<div class="report-demand-block report-demand-block--logic">' +
        '<h4 class="report-demand-block-title">需求逻辑与洞察总结</h4>' +
        '<div class="report-demand-logic-wrap">' +
        sub.join('') +
        '</div></div>'
      );
    }

    return (
      '<div class="report-formal-card report-formal-card--demand">' +
      '<div class="report-demand-insight" data-report="demandInsight">' +
      parts.join('') +
      '</div></div>'
    );
  }

  function buildValueStreamHtml(valueStream) {
    if (!valueStream || (typeof valueStream === 'object' && valueStream.raw)) return '';
    var reportValueStream = valueStream;
    try {
      // 报告 DTO 可能直接给 step.itStatusLabel；这里做报告页专属归一，不改主站工作区数据写法。
      var cloned = JSON.parse(JSON.stringify(valueStream));
      var stages = Array.isArray(cloned && cloned.stages) ? cloned.stages : [];
      for (var si = 0; si < stages.length; si++) {
        var stage = stages[si];
        var steps = Array.isArray(stage && stage.steps) ? stage.steps : [];
        for (var ji = 0; ji < steps.length; ji++) {
          var step = steps[ji];
          if (!step || typeof step !== 'object') continue;
          var hasItStatusObj = step.itStatus && typeof step.itStatus === 'object';
          var hasItStatusText = typeof step.itStatus === 'string' && step.itStatus.trim() !== '';
          var hasItStatusRaw = hasItStatusObj || hasItStatusText || step.it_status != null;
          var itStatusLabel = step.itStatusLabel != null ? String(step.itStatusLabel).trim() : '';
          if (!hasItStatusRaw && itStatusLabel) {
            step.itStatus = itStatusLabel;
          }
        }
      }
      reportValueStream = cloned;
    } catch (e) {}

    var graphHtml = '';
    if (typeof global.renderValueStreamViewHTML === 'function') {
      graphHtml = global.renderValueStreamViewHTML(reportValueStream);
    }
    if (!graphHtml || graphHtml.indexOf('vs-view-placeholder') >= 0) {
      if (typeof global.renderEndToEndFlowHTML === 'function') {
        graphHtml = global.renderEndToEndFlowHTML(reportValueStream);
      }
    }
    if (!graphHtml || graphHtml.indexOf('vs-view-placeholder') >= 0) return '';
    return (
      '<div class="report-formal-card report-formal-card--value-stream">' +
      '<div class="problem-detail-card-body-detail problem-detail-value-stream-report-wrap" data-report="valueStream">' +
      graphHtml +
      '</div></div>'
    );
  }

  function buildGlobalItGapHtml(globalItGap) {
    if (globalItGap == null) return '';
    if (typeof global.reportGlobalItGapBuildWorkspaceHtml === 'function') {
      var html = global.reportGlobalItGapBuildWorkspaceHtml(globalItGap);
      if (html && String(html).trim()) return '<div class="report-formal-card report-formal-card--global-itgap">' + html + '</div>';
    }
    return '';
  }

  /**
   * 报告 DTO：items[].key / name / usage / category / keyFieldsSummary（非 task11 完整实体）
   */
  function buildBusinessObjectsHtml(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    var parts = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || typeof it !== 'object') continue;
      var name =
        it.name != null && String(it.name).trim() !== ''
          ? String(it.name).trim()
          : it.key != null && String(it.key).trim() !== ''
            ? String(it.key).trim()
            : '业务对象 ' + (i + 1);
      var keyStr = it.key != null ? String(it.key).trim() : '';
      var usage = it.usage != null ? String(it.usage) : '';
      var category = it.category != null ? String(it.category) : '';
      var kfs = it.keyFieldsSummary != null ? String(it.keyFieldsSummary) : '';

      var rows = [];
      if (category.trim()) {
        rows.push(
          '<div class="report-bo-summary-row">' +
          '<dt class="report-bo-summary-dt">对象分类</dt>' +
          '<dd class="report-bo-summary-dd">' +
          esc(category) +
          '</dd></div>'
        );
      }
      if (usage.trim()) {
        rows.push(
          '<div class="report-bo-summary-row">' +
          '<dt class="report-bo-summary-dt">对象用途 / 说明</dt>' +
          '<dd class="report-bo-summary-dd report-bo-summary-dd--md markdown-body">' +
          md(usage) +
          '</dd></div>'
        );
      }
      if (kfs.trim()) {
        rows.push(
          '<div class="report-bo-summary-row">' +
          '<dt class="report-bo-summary-dt">关键字段摘要</dt>' +
          '<dd class="report-bo-summary-dd report-bo-summary-dd--md markdown-body">' +
          md(kfs) +
          '</dd></div>'
        );
      }

      parts.push(
        '<article class="report-bo-summary-card" data-bo-key="' + esc(keyStr || name) + '">' +
        '<header class="report-bo-summary-card-head">' +
        '<h3 class="report-bo-summary-name">' +
        esc(name) +
        '</h3>' +
        (keyStr
          ? '<span class="report-bo-summary-key" title="对象标识">' + esc(keyStr) + '</span>'
          : '') +
        '</header>' +
        (rows.length
          ? '<dl class="report-bo-summary-dl">' + rows.join('') + '</dl>'
          : '<p class="report-bo-summary-fallback">' + esc('暂无摘要字段，请在工作区完成核心业务对象推演。') + '</p>') +
        '</article>'
      );
    }
    if (!parts.length) return '';
    return (
      '<div class="report-formal-card report-formal-card--business-objects">' +
      '<div class="report-bo-summary-grid">' +
      parts.join('') +
      '</div></div>'
    );
  }

  function buildGraphSectionHtml(svgOrPlaceholder, mermaidSource, opts) {
    opts = opts || {};
    if (opts.relationshipEmpty) {
      return (
        '<div class="report-mermaid-embed report-mermaid-embed--empty report-mermaid-embed--relation-pending">' +
        '<div class="report-mermaid-embed-head">' +
        '<span class="report-mermaid-embed-title">对象关联</span>' +
        '</div>' +
        '<div class="report-mermaid-embed-body report-mermaid-embed-body--empty">' +
        '<p class="report-graph-empty-title">关系待完善</p>' +
        '<p class="report-graph-empty-hint">暂无有效关联边，无法绘制对象关联图。若对象已推演但图中无连线，可核对后端 relation 抽取或后续补充关系数据。</p>' +
        '</div></div>'
      );
    }
    var inner = svgOrPlaceholder || '';
    if (!inner.trim() && (!mermaidSource || !String(mermaidSource).trim()) && !opts.forceEmptyBody) {
      return '<div class="report-mermaid-embed report-mermaid-embed--empty">' + EMPTY_INNER + '</div>';
    }
    var src = mermaidSource ? String(mermaidSource) : '';
    return (
      '<div class="report-mermaid-embed">' +
      '<div class="report-mermaid-embed-head">' +
      '<span class="report-mermaid-embed-title">对象关联</span>' +
      '</div>' +
      '<div class="report-mermaid-embed-body report-mermaid-embed-body--chart">' +
      inner +
      '</div>' +
      (src
        ? '<details class="report-mermaid-source"><summary>查看 Mermaid 源码</summary><pre class="report-pre report-mermaid-source-pre">' +
          esc(src) +
          '</pre></details>'
        : '') +
      '</div>'
    );
  }

  global.reportFormalRender = {
    EMPTY_INNER: EMPTY_INNER,
    buildDemandInsightHtml: buildDemandInsightHtml,
    buildValueStreamHtml: buildValueStreamHtml,
    buildGlobalItGapHtml: buildGlobalItGapHtml,
    buildBusinessObjectsHtml: buildBusinessObjectsHtml,
    buildGraphSectionHtml: buildGraphSectionHtml,
    hasContent: hasContent,
  };
})(typeof window !== 'undefined' ? window : globalThis);
