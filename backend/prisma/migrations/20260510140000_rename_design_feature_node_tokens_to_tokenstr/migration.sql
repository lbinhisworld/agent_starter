-- DesignFeatureNode：冗余 JSON 列由 `tokens` 更名为 `TokenStr`，与 `DesignDetailTaskToken.tokens` 区分、避免误解
ALTER TABLE `DesignFeatureNode` CHANGE COLUMN `tokens` `TokenStr` JSON NULL;
