-- 设计详情：特征间推导逻辑边（source/target 与 DesignFeatureNode.featureId 语义对齐，无 DB 外键）
CREATE TABLE `DesignLogicLink` (
    `linkId` VARCHAR(191) NOT NULL,
    `sourceFeatureId` VARCHAR(191) NOT NULL,
    `targetFeatureId` VARCHAR(191) NOT NULL,
    `weight` DOUBLE NOT NULL,
    `logic` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`linkId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `DesignLogicLink_sourceFeatureId_idx` ON `DesignLogicLink`(`sourceFeatureId`);
CREATE INDEX `DesignLogicLink_targetFeatureId_idx` ON `DesignLogicLink`(`targetFeatureId`);
CREATE INDEX `DesignLogicLink_sourceFeatureId_targetFeatureId_idx` ON `DesignLogicLink`(`sourceFeatureId`, `targetFeatureId`);
