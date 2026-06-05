-- 将 DesignFeatureNode.operator 历史英文/符号别名统一为中文八值（与 normalizeDesignDetailFeatureOperator 对齐）
UPDATE `DesignFeatureNode` SET `operator` = '等于' WHERE LOWER(TRIM(`operator`)) IN ('eq', 'equals', 'equal', '=', '==');
UPDATE `DesignFeatureNode` SET `operator` = '不等于' WHERE LOWER(TRIM(`operator`)) IN ('!=', '<>', 'ne', 'neq', 'not_equal', 'notequal');
UPDATE `DesignFeatureNode` SET `operator` = '小于' WHERE LOWER(TRIM(`operator`)) IN ('<', 'lt', 'less', 'less_than');
UPDATE `DesignFeatureNode` SET `operator` = '大于' WHERE LOWER(TRIM(`operator`)) IN ('>', 'gt', 'greater', 'greater_than');
UPDATE `DesignFeatureNode` SET `operator` = '小于等于' WHERE LOWER(TRIM(`operator`)) IN ('<=', 'le', 'lte');
UPDATE `DesignFeatureNode` SET `operator` = '大于等于' WHERE LOWER(TRIM(`operator`)) IN ('>=', 'ge', 'gte');
UPDATE `DesignFeatureNode` SET `operator` = '包含' WHERE LOWER(TRIM(`operator`)) IN ('contains', 'contain', 'containing', 'including', 'includes', 'include') OR TRIM(`operator`) = 'CONTAINS';
UPDATE `DesignFeatureNode` SET `operator` = '属于' WHERE LOWER(TRIM(`operator`)) IN ('in', 'belongs', 'belongs_to', 'belonging', 'member_of');
