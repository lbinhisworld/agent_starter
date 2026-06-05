-- ProblemCase: 问题案例主表（业务主实体）
ALTER TABLE `ProblemCase`
    MODIFY COLUMN `id` VARCHAR(191) NOT NULL COMMENT '案例主键ID（后端生成）',
    MODIFY COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '案例创建时间',
    MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL COMMENT '案例最后更新时间',
    MODIFY COLUMN `customerName` VARCHAR(191) NOT NULL COMMENT '客户名称',
    MODIFY COLUMN `customerNeedsOrChallenges` TEXT NOT NULL COMMENT '客户需求或当前挑战描述',
    MODIFY COLUMN `customerItStatus` TEXT NOT NULL COMMENT '客户IT现状描述',
    MODIFY COLUMN `projectTimeRequirement` TEXT NOT NULL COMMENT '项目时间要求描述',
    MODIFY COLUMN `currentMajorStage` INTEGER NOT NULL DEFAULT 0 COMMENT 'ProblemDetail主流程当前主阶段序号',
    MODIFY COLUMN `currentItStrategySubstep` INTEGER NOT NULL DEFAULT 0 COMMENT '当前IT策略子步骤序号',
    MODIFY COLUMN `completedStages` JSON NULL COMMENT '已完成主阶段序号集合 JSON',
    MODIFY COLUMN `workflowAlignCompletedStages` JSON NULL COMMENT '流程对齐阶段已完成序号集合 JSON',
    MODIFY COLUMN `itGapCompletedStages` JSON NULL COMMENT 'IT差距分析阶段已完成序号集合 JSON',
    MODIFY COLUMN `completedTaskIds` JSON NULL COMMENT '已完成任务ID集合 JSON',
    MODIFY COLUMN `basicInfo` JSON NULL COMMENT '客户基本信息 JSON',
    MODIFY COLUMN `bmc` JSON NULL COMMENT '商业模式画布 JSON',
    MODIFY COLUMN `requirementLogic` JSON NULL COMMENT '需求逻辑结构 JSON',
    MODIFY COLUMN `valueStream` JSON NULL COMMENT '价值流设计 JSON',
    MODIFY COLUMN `globalItGapAnalysisJson` JSON NULL COMMENT '全局IT差距分析结果 JSON',
    MODIFY COLUMN `localItGapSessions` JSON NULL COMMENT '局部IT差距分析会话过程 JSON',
    MODIFY COLUMN `localItGapAnalyses` JSON NULL COMMENT '局部IT差距分析结果 JSON',
    MODIFY COLUMN `rolePermissionSessions` JSON NULL COMMENT '角色权限设计会话过程 JSON',
    MODIFY COLUMN `coreBusinessObjectSessions` JSON NULL COMMENT '核心业务对象设计会话过程 JSON',
    MODIFY COLUMN `e2eFlowWorkspaceSuppressed` BOOLEAN NULL COMMENT '端到端流程工作区提示是否已抑制',
    COMMENT = '问题案例主表';

-- ProblemCaseMessage: 案例消息时间线表
ALTER TABLE `ProblemCaseMessage`
    MODIFY COLUMN `id` VARCHAR(191) NOT NULL COMMENT '消息主键ID',
    MODIFY COLUMN `caseId` VARCHAR(191) NOT NULL COMMENT '所属案例ID',
    MODIFY COLUMN `taskId` VARCHAR(191) NULL COMMENT '关联任务ID',
    MODIFY COLUMN `taskName` VARCHAR(191) NULL COMMENT '关联任务名称',
    MODIFY COLUMN `role` VARCHAR(191) NULL COMMENT '消息角色（user、assistant、system）',
    MODIFY COLUMN `type` VARCHAR(191) NULL COMMENT '消息类型标记',
    MODIFY COLUMN `content` LONGTEXT NOT NULL COMMENT '消息正文内容',
    MODIFY COLUMN `payloadJson` JSON NULL COMMENT '消息扩展载荷 JSON',
    MODIFY COLUMN `confirmed` BOOLEAN NOT NULL DEFAULT false COMMENT '该消息是否已确认',
    MODIFY COLUMN `timestamp` DATETIME(3) NOT NULL COMMENT '消息业务时间戳',
    MODIFY COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '消息创建时间',
    MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL COMMENT '消息最后更新时间',
    COMMENT = '案例消息时间线表';

-- AppSetting: 应用配置表
ALTER TABLE `AppSetting`
    MODIFY COLUMN `key` VARCHAR(191) NOT NULL COMMENT '配置键（如 ai.deepseek.apiKey）',
    MODIFY COLUMN `value` LONGTEXT NOT NULL COMMENT '配置值（文本或 JSON 字符串）',
    MODIFY COLUMN `description` VARCHAR(191) NULL COMMENT '配置项说明',
    MODIFY COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '配置创建时间',
    MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL COMMENT '配置最后更新时间',
    COMMENT = '应用配置表';

-- AdminUser: 管理员账户表
ALTER TABLE `AdminUser`
    MODIFY COLUMN `id` VARCHAR(191) NOT NULL COMMENT '管理员主键ID',
    MODIFY COLUMN `username` VARCHAR(191) NOT NULL COMMENT '管理员用户名',
    MODIFY COLUMN `passwordHash` VARCHAR(191) NOT NULL COMMENT '管理员密码哈希',
    MODIFY COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '管理员创建时间',
    MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL COMMENT '管理员最后更新时间',
    COMMENT = '管理员账户表';

-- AppUser: 应用用户表
ALTER TABLE `AppUser`
    MODIFY COLUMN `id` VARCHAR(191) NOT NULL COMMENT '应用用户主键ID',
    MODIFY COLUMN `username` VARCHAR(191) NOT NULL COMMENT '应用用户名',
    MODIFY COLUMN `passwordHash` VARCHAR(191) NOT NULL COMMENT '应用用户密码哈希',
    MODIFY COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ENABLED' COMMENT '用户状态（ENABLED=启用，DISABLED=停用）',
    MODIFY COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '应用用户创建时间',
    MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL COMMENT '应用用户最后更新时间',
    COMMENT = '应用用户表';
