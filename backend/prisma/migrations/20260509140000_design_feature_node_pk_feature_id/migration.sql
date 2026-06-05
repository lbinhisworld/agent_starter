-- DesignFeatureNode：主键由 `id` 改为 `featureId`（须无重复 featureId）；并为 DesignLogicLink 补齐指向 featureId 的外键
ALTER TABLE `DesignFeatureNode` DROP PRIMARY KEY,
    DROP COLUMN `id`,
    DROP INDEX `DesignFeatureNode_featureId_idx`,
    ADD PRIMARY KEY (`featureId`);

ALTER TABLE `DesignLogicLink`
ADD CONSTRAINT `DesignLogicLink_sourceFeatureId_fkey`
FOREIGN KEY (`sourceFeatureId`) REFERENCES `DesignFeatureNode`(`featureId`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DesignLogicLink`
ADD CONSTRAINT `DesignLogicLink_targetFeatureId_fkey`
FOREIGN KEY (`targetFeatureId`) REFERENCES `DesignFeatureNode`(`featureId`) ON DELETE CASCADE ON UPDATE CASCADE;
