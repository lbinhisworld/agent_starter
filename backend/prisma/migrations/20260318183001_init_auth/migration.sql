-- CreateTable
CREATE TABLE `ProblemCase` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerNeedsOrChallenges` TEXT NOT NULL,
    `customerItStatus` TEXT NOT NULL,
    `projectTimeRequirement` TEXT NOT NULL,
    `currentMajorStage` INTEGER NOT NULL DEFAULT 0,
    `currentItStrategySubstep` INTEGER NOT NULL DEFAULT 0,
    `completedStages` JSON NULL,
    `workflowAlignCompletedStages` JSON NULL,
    `itGapCompletedStages` JSON NULL,
    `completedTaskIds` JSON NULL,
    `basicInfo` JSON NULL,
    `bmc` JSON NULL,
    `requirementLogic` JSON NULL,
    `valueStream` JSON NULL,
    `globalItGapAnalysisJson` JSON NULL,
    `localItGapSessions` JSON NULL,
    `localItGapAnalyses` JSON NULL,
    `rolePermissionSessions` JSON NULL,
    `coreBusinessObjectSessions` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProblemCaseMessage` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NULL,
    `taskName` VARCHAR(191) NULL,
    `role` VARCHAR(191) NULL,
    `type` VARCHAR(191) NULL,
    `content` LONGTEXT NOT NULL,
    `payloadJson` JSON NULL,
    `confirmed` BOOLEAN NOT NULL DEFAULT false,
    `timestamp` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProblemCaseMessage_caseId_timestamp_idx`(`caseId`, `timestamp`),
    INDEX `ProblemCaseMessage_caseId_taskId_idx`(`caseId`, `taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` LONGTEXT NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminUser` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminUser_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppUser` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ENABLED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AppUser_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProblemCaseMessage` ADD CONSTRAINT `ProblemCaseMessage_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `ProblemCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
