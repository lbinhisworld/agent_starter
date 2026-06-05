/**
 * [INPUT]: ProblemCase 已持久化字段（只读）
 * [OUTPUT]: 在线版售前分析报告 v1 DTO（即时聚合，不落库）
 * [POS]: problem-cases 模块内报告归一与业务对象 graph 抽取
 *
 * [PROTOCOL]: 一旦聚合字段或 DTO 形状变更，必须同步更新 docs/agents/backend-agent.md 与 swagger（如有）
 */
import type { ProblemCase } from './types';

const REQUIREMENT_LOGIC_KEYS = [
  'industry_competition',
  'causal_relation',
  'deep_motivation',
  'logic_summary',
] as const;

type RequirementLogicKey = (typeof REQUIREMENT_LOGIC_KEYS)[number];

/** 报告接口返回体（v1） */
export interface ProblemCaseReportDto {
  demandInsight: {
    enterpriseCustomerBackground: string | null;
    preliminaryNeedsAndChallenges: string | null;
    requirementLogicSections: {
      industryCompetition: string | null;
      causalRelation: string | null;
      deepMotivation: string | null;
      logicChainSummary: string | null;
    } | null;
  };
  valueStream: {
    stages: Array<{
      name: string | null;
      steps: Array<{
        name: string | null;
        itStatusLabel: string | null;
        painPoint: string | null;
        role: string | null;
        duration: string | null;
      }>;
    }>;
  };
  globalItGap: {
    analysis: unknown | null;
  };
  businessObjects: {
    items: Array<{
      key: string;
      name: string | null;
      usage: string | null;
      category: string | null;
      keyFieldsSummary: string | null;
    }>;
    graph: {
      nodes: Array<{ key: string; label: string | null }>;
      edges: Array<{ source: string; target: string; relationType: string | null }>;
    };
  };
  reportMeta: {
    caseId: string;
    customerName: string;
    generatedAt: string;
    dataStatus: {
      demandInsight: 'available' | 'empty';
      valueStream: 'available' | 'empty';
      globalItGap: 'available' | 'empty';
      businessObjects: 'available' | 'empty';
    };
    sectionAvailability: {
      demandInsight: boolean;
      valueStream: boolean;
      globalItGap: boolean;
      businessObjects: boolean;
    };
  };
}

function isNonEmptyString(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.trim().length > 0;
}

/** 与前端 task3 章节 key 对齐的 Markdown 解析（无则返回空串） */
function parseRequirementLogicFromMarkdown(text: string): Record<RequirementLogicKey, string> {
  const result: Record<RequirementLogicKey, string> = {
    industry_competition: '',
    causal_relation: '',
    deep_motivation: '',
    logic_summary: '',
  };
  let t = text.replace(/^```[\w]*\n?|```\s*$/g, '').trim();
  const jsonMatch = t.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      for (const key of REQUIREMENT_LOGIC_KEYS) {
        const val = obj[key];
        if (val != null) result[key] = String(val).trim();
      }
      if (REQUIREMENT_LOGIC_KEYS.some((k) => result[k])) return result;
    } catch {
      /* 继续走 Markdown 分支 */
    }
  }
  const lines = t.split('\n');
  let section: RequirementLogicKey | '' = '';
  const headerPatterns: Array<[RegExp, RequirementLogicKey]> = [
    [/^#{1,3}\s*1[\.、]\s*行业底层逻辑/i, 'industry_competition'],
    [/^#{1,3}\s*2[\.、]\s*初步需求与商业模式/i, 'causal_relation'],
    [/^#{1,3}\s*3[\.、]\s*需求背后的深层动机/i, 'deep_motivation'],
    [/^#{1,3}\s*4[\.、]\s*逻辑链条总结/i, 'logic_summary'],
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let matched = false;
    for (const [pat, key] of headerPatterns) {
      if (pat.test(line)) {
        section = key;
        const afterColon = line.split(/[：:]/).slice(1).join(':').trim();
        if (afterColon) result[section] = afterColon;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (section && result[section as RequirementLogicKey] !== undefined) {
      const trimmed = line.trim();
      if (trimmed && !/^#{1,3}\s*\d[\.、]/.test(trimmed)) {
        result[section as RequirementLogicKey] +=
          (result[section as RequirementLogicKey] ? '\n' : '') + trimmed;
      }
    }
  }
  return result;
}

function parseRequirementLogic(raw: unknown): Record<RequirementLogicKey, string> {
  const empty = (): Record<RequirementLogicKey, string> => ({
    industry_competition: '',
    causal_relation: '',
    deep_motivation: '',
    logic_summary: '',
  });
  if (raw == null) return empty();
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (REQUIREMENT_LOGIC_KEYS.some((k) => o[k] != null && String(o[k]).trim())) {
      const out = empty();
      for (const k of REQUIREMENT_LOGIC_KEYS) {
        const v = o[k];
        out[k] = v != null ? String(v).trim() : '';
      }
      return out;
    }
  }
  if (typeof raw === 'string') return parseRequirementLogicFromMarkdown(raw);
  return empty();
}

function summarizeBasicInfo(basicInfo: unknown): string | null {
  if (basicInfo == null) return null;
  if (typeof basicInfo === 'string') {
    const t = basicInfo.trim();
    return t || null;
  }
  if (typeof basicInfo === 'object' && !Array.isArray(basicInfo)) {
    const o = basicInfo as Record<string, unknown>;
    const pickKeys = ['company_name', '企业名称', 'corpName', 'name', 'enterprise_name'];
    const parts: string[] = [];
    for (const k of pickKeys) {
      const v = o[k];
      if (v != null && String(v).trim()) parts.push(String(v).trim());
    }
    if (parts.length > 0) return [...new Set(parts)].join(' / ');
    try {
      const s = JSON.stringify(o);
      return s.length > 1200 ? `${s.slice(0, 1200)}…` : s;
    } catch {
      return null;
    }
  }
  return null;
}

function formatItStatusLabel(itStatus: unknown): string {
  if (itStatus == null) return '';
  if (typeof itStatus === 'string') return itStatus.trim();
  if (typeof itStatus === 'object' && itStatus !== null) {
    const o = itStatus as Record<string, unknown>;
    const t = o.type;
    const d = o.detail != null ? String(o.detail) : '';
    if (t === '手工') return `手工-${d || '—'}`;
    if (t === '系统') return `系统-${d || '—'}`;
  }
  return '';
}

function extractPureStageName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
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

function extractStepNameAndDesc(stepObj: Record<string, unknown>): { name: string; desc: string } {
  const nameRaw =
    stepObj.name ??
    stepObj.title ??
    stepObj.step_name ??
    stepObj.phase_name ??
    stepObj.label ??
    stepObj.node_name ??
    '';
  let name = typeof nameRaw === 'string' ? nameRaw.trim() : String(nameRaw).trim();
  const descRaw = stepObj.description ?? stepObj.desc ?? stepObj.content;
  const desc = typeof descRaw === 'string' ? descRaw.trim() : String(descRaw ?? '').trim();
  if (desc) return { name, desc };
  const m = name && name.match(/^(.+?)\s*[（(]([^）)]+)[）)]\s*$/);
  if (m) return { name: m[1].trim(), desc: m[2].trim() };
  return { name, desc: '' };
}

/** 与前端 parseValueStreamGraph 对齐的归一结构 */
function parseValueStreamGraph(data: unknown): {
  stages: Array<{
    name: string;
    steps: Array<{
      name: string;
      role: string;
      duration: string;
      itStatusLabel: string;
      painPoint: string;
    }>;
  }>;
} {
  if (!data || typeof data !== 'object') return { stages: [] };
  const d = data as Record<string, unknown>;
  const rawStagesCandidate =
    d.stages ?? d.phases ?? d.nodes ?? (d.value_stream as Record<string, unknown> | undefined)?.stages ?? (d.data as Record<string, unknown> | undefined)?.stages;
  const rawStages: unknown[] = Array.isArray(rawStagesCandidate) ? rawStagesCandidate : [];
  return {
    stages: rawStages.map((s: unknown, i: number) => {
      if (!s) return { name: `阶段${i + 1}`, steps: [] };
      if (typeof s === 'string') return { name: extractPureStageName(s), steps: [] };
      const st = s as Record<string, unknown>;
      const rawSteps = st.steps ?? st.tasks ?? st.phases ?? st.items ?? st.nodes ?? st.children ?? [];
      const steps = Array.isArray(rawSteps) ? rawSteps : [];
      const rawStageName =
        st.name ?? st.title ?? st.stage_name ?? st.phase_name ?? st.label ?? st.node_name ?? st.node_label ?? `阶段${i + 1}`;
      const stageName = extractPureStageName(rawStageName);
      return {
        name: stageName,
        steps: steps.map((st0: unknown, j: number) => {
          if (typeof st0 === 'string') {
            const { name: stepName } = extractStepNameAndDesc({ name: st0 });
            return {
              name: stepName || st0,
              role: '',
              duration: '',
              itStatusLabel: '',
              painPoint: '',
            };
          }
          const step = st0 as Record<string, unknown>;
          const { name: stepName } = extractStepNameAndDesc(step);
          const role = String(step.role ?? step.executor ?? step['执行角色'] ?? '').trim();
          const duration = String(step.duration ?? step.lead_time ?? step['预估耗时'] ?? step['提前期'] ?? '').trim();
          const itStatusLabel = formatItStatusLabel(step.itStatus ?? step.it_status);
          const rawPainPoint = String(step.painPoint ?? step.pain_point ?? '').trim();
          const isNoPainPoint =
            /^(无明显痛点|无痛点|暂无|无)$/i.test(rawPainPoint) || /^无明显痛点/i.test(rawPainPoint);
          const painPoint = isNoPainPoint ? '' : rawPainPoint;
          return {
            name: stepName || `环节${j + 1}`,
            role,
            duration,
            itStatusLabel: itStatusLabel || '',
            painPoint,
          };
        }),
      };
    }),
  };
}

function stableKeyFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u4e00-\u9fff_-]/g, '');
  return slug ? `cbo:${slug}` : '';
}

function stableKeyFromBusinessObject(bo: Record<string, unknown>, fallbackName: string): string {
  const idRaw = bo['对象ID'] ?? bo.object_id ?? bo.entity_id ?? bo.Object_ID;
  if (idRaw != null && String(idRaw).trim()) return `cbo:id:${String(idRaw).trim()}`;
  const sk = stableKeyFromName(fallbackName);
  return sk || '';
}

function summarizeKeyFieldsFromEntity(ent: Record<string, unknown>): string | null {
  const fields = ent.fields ?? ent.key_attributes ?? ent['关键属性'];
  if (!Array.isArray(fields) || fields.length === 0) return null;
  const parts = fields.slice(0, 12).map((f) => {
    if (f == null) return '';
    if (typeof f === 'string') return f;
    const o = f as Record<string, unknown>;
    const fn = o.field_name ?? o.field ?? o['字段名'] ?? o['模块名'];
    const ty = o.type ?? o.data_type ?? '';
    const ds = o.description ?? o.purpose ?? o['描述'] ?? '';
    const bits = [fn, ty, ds].filter((x) => x != null && String(x).trim());
    return bits.map(String).join(': ');
  });
  const t = parts.filter(Boolean).join('；');
  return t || null;
}

/** 从单条 coreBusinessObjectJson 抽取实体列表（兼容 entities / business_objects / 核心骨架清单） */
function extractEntitiesFromSessionJson(coreJson: unknown): Array<Record<string, unknown>> {
  const parsed = parseMaybeJson(coreJson);
  if (parsed == null || typeof parsed !== 'object') return [];
  const root = Array.isArray(parsed) ? (parsed[0] as Record<string, unknown>) : (parsed as Record<string, unknown>);
  if (!root || typeof root !== 'object') return [];

  if (Array.isArray(root.entities) && root.entities.length > 0) {
    return root.entities.filter((e) => e && typeof e === 'object') as Array<Record<string, unknown>>;
  }
  if (Array.isArray(root.business_objects) && root.business_objects.length > 0) {
    return root.business_objects.filter((e) => e && typeof e === 'object') as Array<Record<string, unknown>>;
  }
  const skeleton = root['核心骨架清单'];
  if (Array.isArray(skeleton) && skeleton.length > 0) {
    return skeleton.filter((e) => e && typeof e === 'object') as Array<Record<string, unknown>>;
  }
  return [];
}

function parseMaybeJson(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  const text = String(raw).trim().replace(/^\uFEFF/, '');
  if (!text || text === 'null' || text === 'undefined' || text === '""') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractEntityName(bo: Record<string, unknown>): string | null {
  const v =
    bo['对象中文名'] ??
    bo.object_name ??
    bo.entity_name ??
    bo.name ??
    bo['名称'];
  if (v == null) return null;
  const t = String(v).trim();
  return t || null;
}

function extractEntityUsage(bo: Record<string, unknown>): string | null {
  const v = bo.object_usage ?? bo.object_role ?? bo.description ?? bo['独立存在理由'] ?? bo.global_integration_note;
  if (v == null) return null;
  const t = String(v).trim();
  return t || null;
}

function extractEntityCategory(bo: Record<string, unknown>): string | null {
  const v = bo.category ?? bo['对象类型'] ?? bo.object_role;
  if (v == null) return null;
  const t = String(v).trim();
  return t || null;
}

function mergeItemField(prev: string | null, next: string | null): string | null {
  if (isNonEmptyString(next ?? undefined)) return next;
  return prev;
}

/**
 * 即时聚合售前报告 DTO（不写库）
 * @param c - 已加载的 ProblemCase
 * @param generatedAt - ISO 时间（通常为 new Date().toISOString()）
 */
export function buildProblemCaseReportDto(c: ProblemCase, generatedAt: string): ProblemCaseReportDto {
  const reqParsed = parseRequirementLogic(c.requirementLogic);
  const hasReqSection = REQUIREMENT_LOGIC_KEYS.some((k) => isNonEmptyString(reqParsed[k]));

  const bg = summarizeBasicInfo(c.basicInfo);
  const needsParts = [c.customerNeedsOrChallenges, c.customerItStatus, c.projectTimeRequirement].filter((x) =>
    isNonEmptyString(x),
  );
  const preliminary = needsParts.length > 0 ? needsParts.join('\n') : null;

  const demandInsight = {
    enterpriseCustomerBackground: bg,
    preliminaryNeedsAndChallenges: preliminary,
    requirementLogicSections: hasReqSection
      ? {
          industryCompetition: isNonEmptyString(reqParsed.industry_competition) ? reqParsed.industry_competition : null,
          causalRelation: isNonEmptyString(reqParsed.causal_relation) ? reqParsed.causal_relation : null,
          deepMotivation: isNonEmptyString(reqParsed.deep_motivation) ? reqParsed.deep_motivation : null,
          logicChainSummary: isNonEmptyString(reqParsed.logic_summary) ? reqParsed.logic_summary : null,
        }
      : null,
  };

  const vsGraph = parseValueStreamGraph(c.valueStream);
  const valueStream = {
    stages: vsGraph.stages.map((stage) => ({
      name: stage.name || null,
      steps: stage.steps.map((step) => ({
        name: step.name || null,
        itStatusLabel: isNonEmptyString(step.itStatusLabel) ? step.itStatusLabel : null,
        painPoint: isNonEmptyString(step.painPoint) ? step.painPoint : null,
        role: isNonEmptyString(step.role) ? step.role : null,
        duration: isNonEmptyString(step.duration) ? step.duration : null,
      })),
    })),
  };

  const gapRaw = c.globalItGapAnalysisJson;
  const hasGap = gapRaw != null && !(typeof gapRaw === 'object' && gapRaw !== null && Object.keys(gapRaw as object).length === 0);
  const globalItGap = { analysis: hasGap ? gapRaw : null };

  /** 业务对象：仅含已推演 session（coreBusinessObjectJson 可解析且含实体） */
  const sessions = Array.isArray(c.coreBusinessObjectSessions) ? c.coreBusinessObjectSessions : [];
  const itemMap = new Map<
    string,
    { key: string; name: string | null; usage: string | null; category: string | null; keyFieldsSummary: string | null }
  >();
  const edgeList: Array<{ source: string; target: string; relationType: string | null }> = [];

  for (const s of sessions) {
    if (!s || typeof s !== 'object') continue;
    const sess = s as Record<string, unknown>;
    const coreJson = sess.coreBusinessObjectJson;
    if (coreJson == null) continue;
    const entities = extractEntitiesFromSessionJson(coreJson);
    for (const ent of entities) {
      const name = extractEntityName(ent);
      const key = stableKeyFromBusinessObject(ent, name ?? '');
      if (!key) continue;

      const usage = extractEntityUsage(ent);
      const category = extractEntityCategory(ent);
      const kfs = summarizeKeyFieldsFromEntity(ent);

      const prev = itemMap.get(key);
      if (!prev) {
        itemMap.set(key, { key, name, usage, category, keyFieldsSummary: kfs });
      } else {
        itemMap.set(key, {
          key,
          name: mergeItemField(prev.name, name),
          usage: mergeItemField(prev.usage, usage),
          category: mergeItemField(prev.category, category),
          keyFieldsSummary: mergeItemField(prev.keyFieldsSummary, kfs),
        });
      }

      const rels =
        (Array.isArray(ent.relations) ? ent.relations : null) ??
        (Array.isArray(ent.associations) ? ent.associations : null) ??
        (Array.isArray(ent['关联关系']) ? [ent['关联关系']] : null);
      if (!Array.isArray(rels)) continue;
      for (const r of rels) {
        if (!r || typeof r !== 'object') continue;
        const ro = r as Record<string, unknown>;
        const targetNameRaw = ro.target_entity ?? ro.target_object ?? ro['父级对象'] ?? ro.to ?? ro.target;
        const targetName = targetNameRaw != null ? String(targetNameRaw).trim() : '';
        const relationType =
          ro.relation_type != null
            ? String(ro.relation_type).trim()
            : ro['映射关系'] != null
              ? String(ro['映射关系']).trim()
              : null;
        if (!targetName) continue;
        const targetKey = stableKeyFromName(targetName);
        if (!targetKey) continue;
        if (!name) continue;
        const sourceKey = key;
        edgeList.push({ source: sourceKey, target: targetKey, relationType: relationType || null });
      }
    }
  }

  const items = Array.from(itemMap.values());
  const nodeKeys = new Set<string>();
  for (const it of items) {
    if (it.key) nodeKeys.add(it.key);
  }
  for (const e of edgeList) {
    nodeKeys.add(e.source);
    nodeKeys.add(e.target);
  }
  const nodes = Array.from(nodeKeys).map((k) => {
    const found = items.find((i) => i.key === k);
    return { key: k, label: found?.name ?? null };
  });

  const edges = edgeList.filter((e) => nodeKeys.has(e.source) && nodeKeys.has(e.target));

  const businessObjects = { items, graph: { nodes, edges } };

  const demandInsightAvail =
    isNonEmptyString(demandInsight.enterpriseCustomerBackground ?? undefined) ||
    isNonEmptyString(demandInsight.preliminaryNeedsAndChallenges ?? undefined) ||
    demandInsight.requirementLogicSections != null;
  const valueStreamAvail = valueStream.stages.some((st) => st.steps.length > 0 || isNonEmptyString(st.name ?? undefined));
  const globalItGapAvail = globalItGap.analysis != null;
  const businessObjectsAvail = items.length > 0;

  const reportMeta: ProblemCaseReportDto['reportMeta'] = {
    caseId: c.id,
    customerName: c.customerName,
    generatedAt,
    dataStatus: {
      demandInsight: demandInsightAvail ? 'available' : 'empty',
      valueStream: valueStreamAvail ? 'available' : 'empty',
      globalItGap: globalItGapAvail ? 'available' : 'empty',
      businessObjects: businessObjectsAvail ? 'available' : 'empty',
    },
    sectionAvailability: {
      demandInsight: demandInsightAvail,
      valueStream: valueStreamAvail,
      globalItGap: globalItGapAvail,
      businessObjects: businessObjectsAvail,
    },
  };

  return {
    demandInsight,
    valueStream,
    globalItGap,
    businessObjects,
    reportMeta,
  };
}
