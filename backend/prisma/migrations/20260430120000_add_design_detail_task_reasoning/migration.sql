-- 设计详情任务推理：按案例、按任务线步骤沉淀 LLM 调用后的推理摘要（见 frontend-vue/design-detail/design_mode_reasoning.md）
CREATE TABLE `DesignDetailTaskReasoning` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `taskName` VARCHAR(191) NOT NULL COMMENT '任务名称',
    `upstreamTaskName` VARCHAR(191) NULL COMMENT '上游任务名称',
    `upstreamReasonKeywords` TEXT NULL COMMENT '上游任务原因关键词',
    `reasoningActionDescription` TEXT NOT NULL COMMENT '推理动作逻辑描述',
    `currentResultKeywords` TEXT NULL COMMENT '当前任务推理结果关键词',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DesignDetailTaskReasoning_caseId_createdAt_idx`(`caseId`, `createdAt`),
    INDEX `DesignDetailTaskReasoning_caseId_taskName_idx`(`caseId`, `taskName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DesignDetailTaskReasoning` ADD CONSTRAINT `DesignDetailTaskReasoning_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `ProblemCase` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
