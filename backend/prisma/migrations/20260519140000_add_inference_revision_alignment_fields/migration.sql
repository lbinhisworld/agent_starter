-- 推理修订审计：深访问卷原文与用户问卷回复原文
ALTER TABLE `DesignDetailInferenceRevisionRecord`
    ADD COLUMN `alignmentQuestionnaire` LONGTEXT NULL COMMENT '对齐深访问卷（Agent 展示稿）原文',
    ADD COLUMN `alignmentUserReply` LONGTEXT NULL COMMENT '用户对问卷的回复原文';
