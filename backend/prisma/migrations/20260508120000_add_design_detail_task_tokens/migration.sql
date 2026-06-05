-- 设计详情页：案例 × 任务线步 × 概念多形态关键词（JSON 字符串数组）
CREATE TABLE `DesignDetailTaskToken` (
    `tokenId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `tokens` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`tokenId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `DesignDetailTaskToken_caseId_taskId_idx` ON `DesignDetailTaskToken`(`caseId`, `taskId`);

ALTER TABLE `DesignDetailTaskToken`
ADD CONSTRAINT `DesignDetailTaskToken_caseId_fkey`
FOREIGN KEY (`caseId`) REFERENCES `ProblemCase` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
