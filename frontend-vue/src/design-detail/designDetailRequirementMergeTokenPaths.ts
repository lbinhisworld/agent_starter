/**
 * [INPUT]: 合并上下文路径（tabKey + JSON 路径段），与后端 `design-detail-customer-req-section-graph.ts` 中 token 命名对齐
 * [OUTPUT]: `ProblemCaseLlmLog.callTarget` 中 **`需求#n合并#…`** 的 token 主路径段（与 `DesignDetailTaskToken.tokens[0]` 或同文件展平规则一致）
 * [POS]: `designDetailRequirementMerge.ts` 异步合并 → `useDesignDetailChat` 审计上下文
 *
 * [PROTOCOL]: 与后端 `BUSINESS_CONTEXT_FIRST_LEVEL_TOKEN_ZH`、`buildOperationModelSectionPlan`、`buildManagementResourcesSectionPlan`、`buildCustomerReqSectionGraphPlan` 保持同口径；变更任一侧须同步
 */

const MAX_TOKEN_SECOND_SEGMENT_CHARS = 72;

/** 与后端 `sanitizeTokenSecondSegment` 对齐：去斜杠、压缩空白、限长 */
export function sanitizeTokenSecondSegment(raw: string): string {
  let s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\//g, '／');
  const arr = Array.from(s);
  if (arr.length > MAX_TOKEN_SECOND_SEGMENT_CHARS) {
    return `${arr.slice(0, MAX_TOKEN_SECOND_SEGMENT_CHARS - 1).join('')}…`;
  }
  return s || '未命名';
}

/** 与后端 `BUSINESS_CONTEXT_FIRST_LEVEL_TOKEN_ZH` 一致 */
const BUSINESS_CONTEXT_FIRST_LEVEL_TOKEN_ZH: Readonly<Record<string, string>> = {
  clientName: '业务背景/企业/项目名称',
  industryDomain: '业务背景/所属行业及核心商业模式',
  orgTopology: '业务背景/组织拓扑',
};

/** 与后端 `DEPRECATED_BUSINESS_CONTEXT_CHILD_KEYS` 对齐：已下线 token 主路径 */
export const DEPRECATED_BUSINESS_CONTEXT_TOKEN_SURFACE = '业务背景/数字化成熟度评估';

export function isDeprecatedBusinessContextTokenSurface(surface: string): boolean {
  const s = String(surface || '').trim();
  const primary = s.split(/\s*·\s*/)[0]?.trim() ?? s;
  return primary === DEPRECATED_BUSINESS_CONTEXT_TOKEN_SURFACE;
}

/** 与后端 `PAIN_POINT_RADAR_CORE_SUMMARY_TOKEN` 一致 */
export const PAIN_POINT_RADAR_CORE_SUMMARY_TOKEN = '痛点雷达/核心痛点总结';

const MANAGEMENT_RESOURCES_KEY_ZH: Readonly<Record<string, string>> = {
  peopleResource: '管理资源/人力资源',
  financeResource: '管理资源/财务资源',
  assetResource: '管理资源/实物资产',
  informationAsset: '管理资源/信息资产',
};

const ROADMAP_PHASE_KEY_ZH: Readonly<Record<string, string>> = {
  phase1_Critical: '优先上线（第一阶段）',
  phase2_Strategic: '后续上线',
  overallUrgency: '项目紧急度',
};

const ROADMAP_SUBKEY_ZH: Readonly<Record<string, string>> = {
  focus: '重点',
  deliverables: '交付物',
};

const IT_LANDSCAPE_TOKEN: Readonly<Record<string, string>> = {
  legacySystems: 'IT 集成与现状/现有系统',
  integrationRequirements: 'IT 集成与现状/待集成系统',
  deploymentMode: 'IT 集成与现状/部署形态',
};

/**
 * 由 tabKey + 路径段生成与 `DesignDetailTaskToken` 展平规则一致的 **主路径字符串**（用于 `合并#${token}`）。
 * @param tabKey 顶层分域键，如 `businessContext`、`roadmap`
 * @param path 从顶层对象向下到当前合并字段的路径（不含 tabKey 重复时可带首段 tabKey）
 */
export function tokenSurfaceForMergePath(tabKey: string, path: string[]): string {
  const segs = path.length && path[0] === tabKey ? path.slice(1) : path;

  if (tabKey === 'businessContext') {
    if (segs[0] === 'orgTopology' && segs.length >= 2) {
      return `业务背景/组织拓扑/${sanitizeTokenSecondSegment(segs[1]!)}`;
    }
    const k = segs[0] ?? '';
    if (k && BUSINESS_CONTEXT_FIRST_LEVEL_TOKEN_ZH[k]) return BUSINESS_CONTEXT_FIRST_LEVEL_TOKEN_ZH[k]!;
    if (k) return `业务背景/（${sanitizeTokenSecondSegment(k)}）`;
    return '业务背景';
  }

  if (tabKey === 'coreBusinessEntities') {
    const cat = segs[0] ?? '事';
    const name = segs[1] ?? '未命名对象';
    return `核心业务对象/${sanitizeTokenSecondSegment(cat)}/${sanitizeTokenSecondSegment(name)}`;
  }

  if (tabKey === 'managementResources') {
    const k = segs[0] ?? '';
    if (k && MANAGEMENT_RESOURCES_KEY_ZH[k]) return MANAGEMENT_RESOURCES_KEY_ZH[k]!;
    if (k) return `管理资源/${sanitizeTokenSecondSegment(k)}`;
    return '管理资源';
  }

  if (tabKey === 'itLandscape') {
    const k = segs[0] ?? '';
    if (k && IT_LANDSCAPE_TOKEN[k]) return IT_LANDSCAPE_TOKEN[k]!;
    if (k) return `IT 集成与现状/${sanitizeTokenSecondSegment(k)}`;
    return 'IT 集成与现状';
  }

  if (tabKey === 'existingSpreadsheets') {
    if (segs.length >= 1) return `现有表格/${sanitizeTokenSecondSegment(segs[0]!)}`;
    return '现有表格';
  }

  if (tabKey === 'roadmap') {
    const phase = segs[0] ?? '';
    const phaseZh = ROADMAP_PHASE_KEY_ZH[phase] ?? sanitizeTokenSecondSegment(phase);
    if (segs.length >= 2) {
      const sk = segs[1] ?? '';
      const skZh = ROADMAP_SUBKEY_ZH[sk] ?? sanitizeTokenSecondSegment(sk);
      return `路线图/${phaseZh}/${skZh}`;
    }
    return `路线图/${phaseZh}`;
  }

  if (tabKey === 'operationModel') {
    if (segs[0] === 'orgAndRoles' && segs[1] === 'governanceLogic') {
      return '运营模式/统筹与权责';
    }
    if (segs[0] === 'orgAndRoles' && segs[1] === 'incentiveHooks') {
      return '运营模式/激励与分润';
    }
    if (segs[0] === 'orgAndRoles' && segs[1] === 'stakeholders') {
      return '运营模式/人员组织/干系人条目';
    }
    if (segs[0] === 'fullValueStreams') {
      return '运营模式/业务流程/价值流条目';
    }
    const head = segs[0] ?? '';
    if (head) return `运营模式/${sanitizeTokenSecondSegment(head)}`;
    return '运营模式';
  }

  if (tabKey === 'stateTransitionMatrix') {
    if (segs.length >= 1) return `状态转移矩阵/${sanitizeTokenSecondSegment(segs[0]!)}`;
    return '状态转移矩阵';
  }

  if (tabKey === 'painPointRadar') {
    if (segs[0] === 'corePainPointSummary') return PAIN_POINT_RADAR_CORE_SUMMARY_TOKEN;
    if (segs.length >= 1) return `痛点雷达/${sanitizeTokenSecondSegment(segs[0]!)}`;
    return '痛点雷达';
  }

  const tabZh: Record<string, string> = {
    businessContext: '业务背景',
    coreBusinessEntities: '核心业务对象',
    stateTransitionMatrix: '状态转移矩阵',
    painPointRadar: '痛点雷达',
    itLandscape: 'IT 现状与集成',
    existingSpreadsheets: '现有表格',
    operationModel: '运营模式',
    managementResources: '管理资源',
    roadmap: '路线图',
  };
  const prefix = tabZh[tabKey] ?? tabKey;
  if (segs.length === 0) return prefix;
  return `${prefix}/${segs.map((s) => sanitizeTokenSecondSegment(s)).join('/')}`;
}
