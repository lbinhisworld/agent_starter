-- AlterTable
ALTER TABLE `problemcase` ADD COLUMN `ownerSubjectId` VARCHAR(191) NULL,
    ADD COLUMN `ownerSubjectType` VARCHAR(191) NULL,
    ADD COLUMN `ownerUsernameSnapshot` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `ProblemCase_ownerSubjectType_ownerSubjectId_idx` ON `ProblemCase`(`ownerSubjectType`, `ownerSubjectId`);
