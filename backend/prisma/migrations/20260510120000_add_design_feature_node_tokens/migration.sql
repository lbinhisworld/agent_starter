-- DesignFeatureNode：冗余存储与绑定 token 行一致的多形态关键词（JSON 数组）；列名初为 `tokens`，由 `20260510140000_rename_design_feature_node_tokens_to_tokenstr` 更名为 `TokenStr`
ALTER TABLE `DesignFeatureNode` ADD COLUMN `tokens` JSON NULL;

-- 历史行：从关联的 DesignDetailTaskToken 回填
UPDATE `DesignFeatureNode` AS f
INNER JOIN `DesignDetailTaskToken` AS t ON t.`tokenId` = f.`tokenId`
SET f.`tokens` = t.`tokens`
WHERE f.`tokens` IS NULL;
