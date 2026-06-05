export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Smart CTO Backend API',
    version: '0.1.0',
    description: 'Smart CTO backend service API documentation. Fixed token mode: no X-Auth-Token/X-Auth-Expires-At renewal headers.',
  },
  // 第一项用相对路径：页面用 IP 打开时，Try it out 会请求同一台机子，不会误打到访问者本机 localhost
  servers: [
    { url: '/', description: '当前站点（本机 / 局域网 IP 均可）' },
    { url: 'http://localhost:3000', description: '仅本机浏览器' },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: {
          '200': { description: 'Service is healthy' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Login and create auth session',
        responses: {
          '200': { description: 'Login success with fixed token (payload contains sid)' },
          '401': { description: 'Invalid credentials' },
          '403': { description: 'User disabled' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        summary: 'Revoke current auth session (single session logout)',
        responses: {
          '200': { description: 'Logout success, current sid revoked' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/problem-cases': {
      get: {
        summary: 'List problem cases',
        responses: {
          '200': { description: 'Problem case list' },
        },
      },
      post: {
        summary: 'Create problem case',
        responses: {
          '201': { description: 'Problem case created' },
        },
      },
    },
    '/api/ai/config': {
      get: {
        summary: 'Get system-level AI configuration summary (admin only)',
        responses: {
          '200': { description: 'AI configuration summary returned' },
          '403': { description: 'Forbidden for non-admin users' },
        },
      },
      put: {
        summary: 'Update system-level AI configuration in database (admin only)',
        responses: {
          '200': { description: 'AI configuration updated' },
          '403': { description: 'Forbidden for non-admin users' },
        },
      },
    },
    '/api/ai/chat': {
      post: {
        summary:
          'Proxy AI chat request using current user verified config or admin system config; optional body.llmLog (caseId, taskId, callTarget) persists ProblemCaseLlmLog on success',
        responses: {
          '200': { description: 'AI chat response returned' },
          '400': { description: 'AI config missing' },
          '428': { description: 'Current app user must configure and verify personal AI config first' },
        },
      },
    },
    '/api/me/ai-config/status': {
      get: {
        summary: 'Get current app user AI config gate status',
        responses: {
          '200': { description: 'Current user AI config status returned' },
          '403': { description: 'Forbidden for admin sessions' },
        },
      },
    },
    '/api/me/ai-config': {
      put: {
        summary: 'Save and verify current app user AI config',
        responses: {
          '200': { description: 'Current user AI config verified and saved' },
          '400': { description: 'AI config verification failed' },
          '403': { description: 'Forbidden for admin sessions' },
          '502': { description: 'AI provider unreachable during verification' },
          '504': { description: 'AI provider verification timed out' },
        },
      },
    },
    '/api/problem-cases/parse-preview': {
      post: {
        summary: 'Parse problem case preview',
        responses: {
          '200': { description: 'Parsed preview returned' },
        },
      },
    },
    '/api/problem-cases/{id}/report': {
      get: {
        summary: 'Get aggregated presales analysis report (v1, read-only)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Report DTO (demandInsight, valueStream, globalItGap, businessObjects, reportMeta)' },
          '404': { description: 'Problem case not found' },
        },
      },
    },
    '/api/problem-cases/{id}': {
      get: {
        summary: 'Get problem case detail',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Problem case detail' },
          '404': { description: 'Problem case not found' },
        },
      },
      delete: {
        summary: 'Delete problem case',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '204': { description: 'Problem case deleted' },
          '404': { description: 'Problem case not found' },
        },
      },
    },
    '/api/problem-cases/{id}/messages': {
      get: {
        summary: 'Get problem case messages',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Problem case messages' },
        },
      },
    },
    '/api/problem-cases/{id}/messages/{messageId}': {
      patch: {
        summary: 'Patch single problem case message (incremental update)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'messageId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Updated message' },
          '404': { description: 'Case or message not found' },
        },
      },
    },
    '/api/problem-cases/{id}/tasks': {
      get: {
        summary: 'Get problem case task summaries',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Problem case task summaries' },
        },
      },
    },
    /** 设计详情「逻辑」弹层；若线上出现纯文本 `Cannot GET …/task-graph`，多为网关/静态站未转发到本服务或运行的是未含该路由的旧镜像 */
    '/api/problem-cases/{id}/design-detail/task-graph': {
      get: {
        summary: 'Design detail: aggregate reasoning graph (tokens / features / logic links) per task step',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: '{ caseId, tasks[] } read-only bundle' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Problem case not found' },
          '500': { description: 'Aggregation failed' },
        },
      },
    },
    '/api/problem-cases/{id}/llm-logs': {
      get: {
        summary: 'Case-level LLM audit: aggregated totals + lightweight rows (newest first)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: '{ summary, items[] }' },
          '404': { description: 'Problem case not found' },
        },
      },
      post: {
        summary: 'Append one LLM call record (e.g. after local DeepSeek completion)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '204': { description: 'Created' },
          '400': { description: 'Invalid body' },
          '404': { description: 'Problem case not found' },
        },
      },
    },
    '/api/problem-cases/{id}/llm-logs/clear': {
      post: {
        summary: 'Delete LLM audit rows for given taskIds (design-detail restart alignment)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: '{ deleted: number }' },
          '400': { description: 'Invalid body' },
          '404': { description: 'Problem case not found' },
        },
      },
    },
  },
} as const;
