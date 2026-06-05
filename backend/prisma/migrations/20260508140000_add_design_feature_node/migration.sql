-- 设计详情：特征节点（token + 比较符 + 取值），引用 DesignDetailTaskToken
CREATE TABLE `DesignFeatureNode` (
    `id` VARCHAR(191) NOT NULL,
    `featureId` VARCHAR(191) NOT NULL,
    `tokenId` VARCHAR(191) NOT NULL,
    `operator` VARCHAR(64) NOT NULL,
    `value` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `DesignFeatureNode_featureId_idx` ON `DesignFeatureNode`(`featureId`);
CREATE INDEX `DesignFeatureNode_tokenId_idx` ON `DesignFeatureNode`(`tokenId`);

ALTER TABLE `DesignFeatureNode`
ADD CONSTRAINT `DesignFeatureNode_tokenId_fkey`
FOREIGN KEY (`tokenId`) REFERENCES `DesignDetailTaskToken`(`tokenId`) ON DELETE CASCADE ON UPDATE CASCADE;
