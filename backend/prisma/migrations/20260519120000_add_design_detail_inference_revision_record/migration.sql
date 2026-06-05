-- 设计详情推理修订审计：问卷/深访重跑后特征取值变更、反向验证 Validation_Logic、Causality 摘要
CREATE TABLE `DesignDetailInferenceRevisionRecord` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL COMMENT '落库任务 id（如 任务 2：规模与组织模式推理）',
    `recordKind` ENUM('特征取值', '反向验证') NOT NULL,
    `featureId` VARCHAR(191) NOT NULL COMMENT '任务特征 ft_* 或任务 1 Target_FeatureID',
    `fieldLabel` VARCHAR(512) NULL COMMENT '特征展示键（tokenDisplay｜operator）',
    `valueBefore` TEXT NULL COMMENT '重跑前取值展示串',
    `valueAfter` TEXT NULL COMMENT '重跑后取值展示串',
    `validationLogic` TEXT NULL COMMENT 'Token_Validation_Mapping.Validation_Logic',
    `logicGapReport` TEXT NULL COMMENT 'Causality_Analysis.Logic_Gap_Report 或任务级等价字段',
    `insightResolutionSummary` TEXT NULL COMMENT 'Causality_Analysis.Insight_Resolution_Summary',
    `syncSeq` INTEGER NOT NULL DEFAULT 1 COMMENT '同案例同任务每次 sync 递增',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DesignDetailInferenceRevisionRecord_caseId_taskId_syncSeq_idx`(`caseId`, `taskId`, `syncSeq`),
    INDEX `DesignDetailInferenceRevisionRecord_caseId_taskId_idx`(`caseId`, `taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DesignDetailInferenceRevisionRecord` ADD CONSTRAINT `DesignDetailInferenceRevisionRecord_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `ProblemCase` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
