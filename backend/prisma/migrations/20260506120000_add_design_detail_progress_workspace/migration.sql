-- 设计详情页「任务进展」工作区快照：与 ProblemCase 1:1，随案例删除级联
CREATE TABLE `DesignDetailProgressWorkspace` (
    `caseId` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`caseId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DesignDetailProgressWorkspace`
ADD CONSTRAINT `DesignDetailProgressWorkspace_caseId_fkey`
FOREIGN KEY (`caseId`) REFERENCES `ProblemCase` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
