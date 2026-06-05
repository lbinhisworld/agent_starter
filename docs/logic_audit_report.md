# 逻辑与业务全景审计报告

## 1. 全局状态清单

| 变量名 | 业务用途 | 来源 |
|-------|---------|------|
| APP_CONFIG | 应用配置，包含 DeepSeek API 相关配置 | js/config.js |
| API_URL | 企业分析 API 地址 | js/config.js |
| VALUE_STREAM_API_URL | 价值流分析 API 地址 | js/config.js |
| STORAGE_KEY | 企业分析存储键 | js/config.js |
| DIGITAL_PROBLEMS_STORAGE_KEY | 数字化问题跟进存储键 | js/config.js |
| PROBLEM_DETAIL_CHATS_STORAGE_KEY | 问题详情聊天记录存储键 | js/config.js |
| TASK_TRACKING_STORAGE_KEY | 任务追踪存储键 | js/config.js |
| ROUTE_STORAGE_KEY | 路由状态存储键 | js/config.js |
| OPERATION_HISTORY_STORAGE_KEY | 操作历史存储键 | js/config.js |
| TOOL_KNOWLEDGE_STORAGE_KEY | 工具知识存储键 | js/config.js |
| TOOL_KNOWLEDGE_ITEMS_STORAGE_KEY | 工具知识项存储键 | js/config.js |
| TOOL_KNOWLEDGE_CHAT_STORAGE_KEY | 工具知识聊天存储键 | js/config.js |
| ITGAP_HISTORY_TASKS | ITGap 历史任务 | js/config.js |
| IT_STRATEGY_TASKS | IT 策略任务 | js/config.js |
| TASK_EXTRA_FIELDS | 任务额外字段 | js/config.js |
| FOLLOW_TASKS | 跟进任务 | js/config.js |
| TOOL_KNOWLEDGE_ITEMS | 工具知识项 | js/config.js |
| BASIC_INFO_FIELDS | 基本信息字段 | js/config.js |
| BMC_FIELDS | 商业模式画布字段 | js/config.js |
| LABEL_TO_PATH | 标签到路径的映射 | js/config.js |
| DELETE_CHAT_MSG_ICON | 删除聊天消息图标 | js/config.js |
| currentToolKnowledgeId | 当前选中的工具 ID | main.js |
| currentDetailCompanyName | 当前详情页的公司名称 | main.js |
| currentDetailRecord | 当前详情页完整记录 | main.js |
| el | DOM 元素引用 | main.js |
| lastQueriedCompanyName | 最近查询的公司名称 | main.js |
| lastQueryResult | 最近查询结果 | main.js |
| lastParsedResult | 最近一次解析结果 | main.js |
| currentProblemDetailItem | 当前问题详情页展示的跟进项 | main.js |
| lastModificationClarification | 修改意图追问状态 | main.js |
| problemDetailViewingMajorStage | 当前正在浏览的大节段 | main.js |
| itStrategyPlanViewingSubstep | IT 策略规划阶段当前选中的任务索引 | main.js |
| problemDetailConfirmedBasicInfo | 问题详情页已确认的客户基本信息 | main.js |
| problemDetailChatMessages | 当前问题详情页的聊天记录 | main.js |
| problemDetailChatMode | 问题详情对话模式 | main.js |
| chatHistory | 聊天历史，用于 DeepSeek API 的 messages 上下文 | main.js |
| currentModificationTask | 当前未闭环的修改任务 | main.js |
| problemDetailWaitingForFeedback | 点击「修改」或「讨论」后等待用户输入反馈 | main.js |

## 2. 业务逻辑流向图

### 链路 A：输入企业名称 -> 解析 -> 渲染画布 -> 保存

1. **输入企业名称**：用户在首页输入企业名称
2. **点击查询按钮**：触发 `query()` 函数
3. **API 调用**：`query()` 函数调用企业分析 API
4. **渲染结果**：
   - `renderBasicInfo()`：渲染基本信息
   - `renderBMC()`：渲染商业模式画布
   - `renderMetadata()`：渲染元数据
5. **点击保存按钮**：触发 `saveCurrent()` 函数
6. **存储数据**：`saveCurrent()` 函数调用 `saveAnalysis()` 存储数据到 localStorage

### 链路 B：数字化问题输入 -> AI 分析 -> 生成跟进任务

1. **输入数字化问题**：用户在首页输入数字化问题
2. **点击解析按钮**：触发解析逻辑
3. **AI 分析**：调用 DeepSeek API 分析数字化问题
4. **显示解析预览**：渲染解析结果到 `parsePreview` 区域
5. **点击启动跟进**：触发 `startFollow()` 函数
6. **生成跟进任务**：创建数字化问题跟进项并存储到 localStorage

### 链路 C：工具知识库搜索 -> 渲染 Markdown 聊天记录

1. **进入工具知识页面**：用户导航到工具知识页面
2. **加载工具知识**：`renderToolsKnowledge()` 函数加载工具知识数据
3. **选择工具**：用户选择一个工具
4. **渲染工具详情**：`renderToolsTopicDetail()` 函数渲染工具详情和时间线
5. **输入讨论内容**：用户在聊天框输入讨论内容
6. **分析讨论意图**：`analyzeToolDiscussionIntent()` 函数分析用户讨论意图
7. **生成回复**：`fetchToolDiscussionReply()` 函数生成工具知识讨论回复
8. **保存讨论记录**：`appendToolKnowledge()` 函数保存讨论记录到 localStorage

## 3. 副作用（Side Effects）审计

### 3.1 直接修改 localStorage 的函数

| 函数名 | 用途 | 存储键 |
|-------|-----|--------|
| saveAnalysis() | 保存企业分析结果 | STORAGE_KEY |
| saveDigitalProblem() | 保存数字化问题跟进项 | DIGITAL_PROBLEMS_STORAGE_KEY |
| saveProblemDetailChat() | 保存问题详情聊天记录 | PROBLEM_DETAIL_CHATS_STORAGE_KEY |
| saveTaskTracking() | 保存任务追踪数据 | TASK_TRACKING_STORAGE_KEY |
| saveRouteState() | 保存路由状态 | ROUTE_STORAGE_KEY |
| saveOperationHistory() | 保存操作历史 | OPERATION_HISTORY_STORAGE_KEY |
| saveToolKnowledgeState() | 保存工具知识状态 | TOOL_KNOWLEDGE_STORAGE_KEY |
| saveToolKnowledgeItemsToStorage() | 保存工具知识项 | TOOL_KNOWLEDGE_ITEMS_STORAGE_KEY |
| saveToolsChatMessagesToStorage() | 保存工具知识聊天记录 | TOOL_KNOWLEDGE_CHAT_STORAGE_KEY |

### 3.2 含有 setTimeout 或异步回调的函数

| 函数名 | 用途 | 异步操作 |
|-------|-----|----------|
| query() | 查询企业信息 | API 调用（fetch） |
| loadValueStreamList() | 加载价值流列表 | API 调用（fetch） |
| fetchDeepSeekChat() | 调用 DeepSeek API | API 调用（fetch） |
| analyzeToolDiscussionIntent() | 分析工具讨论意图 | API 调用（fetchDeepSeekChat） |
| summarizeToolDiscussionContent() | 总结工具讨论内容 | API 调用（fetchDeepSeekChat） |
| fetchToolDiscussionReply() | 获取工具讨论回复 | API 调用（fetchDeepSeekChat） |
| fetchToolModificationUpdates() | 获取工具修改更新 | API 调用（fetchDeepSeekChat） |
| requestRefinementFromFeedback() | 根据反馈请求 refinement | API 调用（fetchDeepSeekChat） |

### 3.3 包含硬编码的第三方 URL 或 API Key 的函数

| 函数名 | 硬编码内容 | 用途 |
|-------|-----------|-----|
| fetchDeepSeekChat() | DeepSeek API URL | 调用 DeepSeek API |
| query() | API_URL | 调用企业分析 API |
| loadValueStreamList() | VALUE_STREAM_API_URL | 调用价值流分析 API |

## 4. 组件交互地图

### 4.1 共享逻辑

| 共享逻辑 | 组件 | 建议提取位置 |
|---------|------|------------|
| 存储操作 | HomeView, ToolsView, ProblemDetailView | Utils/storage.ts |
| 日期格式化 | HomeView, ToolsView, ProblemDetailView | Utils/utils.ts |
| 工具知识管理 | ToolsView | Utils/toolKnowledge.ts |
| 数字化问题管理 | HomeView, ProblemDetailView, TaskTrackingView | Store/problem.ts |
| 企业分析管理 | HomeView, DetailView | Store/analysis.ts |
| 路由状态管理 | 所有组件 | Store/route.ts |
| API 调用 | 所有组件 | Utils/api.ts |

### 4.2 组件间交互

| 组件 | 交互方式 | 共享数据 |
|------|---------|---------|
| HomeView -> ProblemDetailView | 路由跳转 | 数字化问题 ID |
| HomeView -> DetailView | 路由跳转 | 企业名称 |
| ProblemDetailView -> TaskTrackingView | 路由跳转 | 数字化问题 ID |
| ToolsView -> 无 | 独立组件 | 工具知识数据 |

## 5. 结论与建议

1. **全局状态管理**：建议使用 Pinia 管理全局状态，替代 window 级变量，提高代码可维护性。

2. **存储管理**：已提取到 StorageService 类，建议继续完善并扩展其功能。

3. **API 管理**：建议将 API 调用封装到单独的服务中，统一处理错误和认证。

4. **组件拆分**：已完成基础组件拆分，建议继续细化组件粒度，提高复用性。

5. **业务逻辑迁移**：建议按照链路逐步迁移业务逻辑，确保功能完整性。

6. **副作用处理**：建议使用 Vue 的响应式系统和生命周期钩子处理副作用，减少直接 DOM 操作。

7. **安全性**：API Key 等敏感信息应存储在环境变量中，避免硬编码。