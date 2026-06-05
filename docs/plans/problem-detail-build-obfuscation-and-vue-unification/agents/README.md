# ProblemDetail 双轨专项 Agent 索引

> 本目录给出本专项推荐使用的核心 agent 角色文档。它们不替代 `README.md` 与任务卡，只负责帮助不同执行角色快速进入正确边界。

## 使用原则

1. 先读专项 `README.md`、`tasks/README.md` 与当前任务卡，再读对应角色文档。
2. 角色文档是执行提示词入口，不是第二套计划文档；边界、phase gate、风险与回滚仍以专项 `README.md` 为准。
3. 当前问题若已有真相源任务卡，角色文档只能引用，不得平行扩写第二套合同。
4. 真正派工时，以任务卡里的 `执行 Agent 提示词` / `验收 Agent 提示词` 为直接转发入口；本目录角色文档只提供通用底座。

## 推荐角色

| 角色 | 主职责 | 默认处理范围 | 文档 |
| ---- | ---- | ---- | ---- |
| `architect-owner` | 守专项边界、分流问题、维护主记录与任务依赖 | phase gate、补卡判断、风险与回滚 | [architect-owner](./architect-owner.md) |
| `frontend-impl` | 推进 A 线与 B 线前端实施 | `frontend`、`frontend-vue`、前端任务卡与验证证据 | [frontend-impl](./frontend-impl.md) |
| `backend-contract` | 冻结 online-only 后端访问合同 | 鉴权、拒绝访问、深链恢复、bundle/redirect 语义 | [backend-contract](./backend-contract.md) |
| `review-verifier` | 独立复核闭环是否成立 | 验收边界、证据、残余风险、是否可关账 | [review-verifier](./review-verifier.md) |

## 默认协作顺序

1. `architect-owner` 先判断边界、依赖与是否补卡。
2. `frontend-impl` 或 `backend-contract` 进入具体实施。
3. `review-verifier` 最后验证“问题 -> 修复 -> 证据 -> 关账”是否闭环。

## 角色切换提醒

- 若问题落在当前任务卡范围内，默认不切角色，只在当前角色内闭环。
- 若发现合同缺口或跨 owner 依赖，再切回 `architect-owner` 收口。
- 若技术合同已冻结、仅剩规则或实现差异，不要回到 `architect-owner` 反复重写边界。
