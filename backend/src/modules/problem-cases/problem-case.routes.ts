/**
 * [INPUT]: ProblemCaseService、Express、Zod
 * [OUTPUT]: /api/problem-cases 路由（含单案例 JSON 导入导出、POST :id/restore 按包覆盖当前案例、GET :id/report 售前报告聚合、设计详情任务进展工作区 :id/design-detail/progress-workspace、GET :id/design-detail/task-graph 推理图只读聚合、DELETE :id/design-detail/task-graph 清空本案例全部推理图、DELETE :id/design-detail/task-graph/:taskId、POST :id/design-detail/sync-task0-toolbox-primitives、POST :id/design-detail/sync-task1-basic-info-graph、POST :id/design-detail/sync-customer-req-section-graph、POST :id/design-detail/sync-task2-l1-target-kv-tokens、POST :id/design-detail/sync-task2-l1-inference-graph（任务 2 L1 推理图同步别名，body 可省略 `l1InferenceRaw`）、POST :id/design-detail/sync-task3-l2-target-kv-tokens、POST :id/design-detail/sync-task4-l2-target-kv-tokens、GET/POST :id/llm-logs、POST :id/llm-logs/clear 按 taskId 批量或 all 删 LLM 审计）
 * [POS]: ProblemCase HTTP 入口（POST /import 请求体上限见 app.ts 专用 json 中间件）
 *
 * [PROTOCOL]: 一旦本文件路由变更，必须同步更新此 Header 和 docs/agents/backend-agent.md
 */
import { NextFunction, Request, Response, Router } from 'express';
import { ZodError } from 'zod';
import type { JwtAuthPayload } from '../auth/auth.service';
import {
  ProblemCaseRestoreValidationError,
  ProblemCaseService,
  buildAttachmentContentDisposition,
  buildProblemCaseExportDownloadBasename,
} from './problem-case.service';

export function createProblemCaseRouter(service: ProblemCaseService) {
  const router = Router();

  function getAuth(req: Request): JwtAuthPayload {
    return (req as any).auth as JwtAuthPayload;
  }

  router.get('/', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const items = await service.list(auth);
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  /** 必须在 `GET /:id` 之前注册，避免被 `:id` 抢占 */
  router.get('/:id/export', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const pkg = await service.exportCasePackage(req.params.id, auth);
      if (!pkg) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      const summaries = await service.getTaskSummaries(req.params.id, auth, pkg.case);
      const fallbackName = `problem-case-${req.params.id.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`;
      const basename =
        summaries && summaries.length > 0
          ? buildProblemCaseExportDownloadBasename(pkg.case, summaries)
          : fallbackName;
      const cd = buildAttachmentContentDisposition(basename);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', cd);
      res.status(200).json(pkg);
    } catch (error) {
      next(error);
    }
  });

  /** 必须在 `POST /:id/...` 等之前注册 */
  router.post('/import', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.importCasePackage(req.body, auth);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** 用 JSON 包覆盖当前案例（不新建 id）；须与 POST /import 共用同一 JSON 体积上限 */
  router.post('/:id/restore', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.restoreCasePackage(req.params.id, req.body, auth);
      if (!result) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ProblemCaseRestoreValidationError) {
        res.status(400).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  /** 必须在 `GET /:id` 之前注册 */
  router.get('/:id/report', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const report = await service.getReport(req.params.id, auth);
      if (!report) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  /** 设计详情页「任务进展」左栏 UI 快照（与聊天消息指纹对齐；无行时 payload 为 null） */
  router.get('/:id/design-detail/progress-workspace', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const bundle = await service.getDesignDetailProgressWorkspace(req.params.id, auth);
      if ('notFound' in bundle) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.json({ caseId: req.params.id, payload: bundle.payload });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id/design-detail/progress-workspace', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const ok = await service.putDesignDetailProgressWorkspace(req.params.id, req.body, auth);
      if (!ok) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id/design-detail/progress-workspace', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const ok = await service.deleteDesignDetailProgressWorkspace(req.params.id, auth);
      if (!ok) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  /** 设计详情：按案例聚合各任务推理图（token / feature / logic，只读） */
  router.get('/:id/design-detail/task-graph', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.getDesignDetailTaskGraph(req.params.id, auth);
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '加载失败' });
        return;
      }
      res.json({ caseId: req.params.id, tasks: result.tasks });
    } catch (error) {
      next(error);
    }
  });

  /** 删除本案例全部设计详情推理图（级联 `DesignFeatureNode`、`DesignLogicLink`）；须在 `/:taskId` 之前注册 */
  router.delete('/:id/design-detail/task-graph', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const ok = await service.deleteAllDesignDetailTaskGraph(req.params.id, auth);
      if (!ok) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  /** 清理推理修订审计表（设计页「重启当前」/「选择重启」） */
  router.post('/:id/design-detail/inference-revision-records/clear', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.clearDesignDetailInferenceRevisionRecords(
        req.params.id,
        req.body,
        auth,
      );
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '清理失败' });
        return;
      }
      res.status(200).json({ deleted: result.deleted, taskIds: result.taskIds });
    } catch (error) {
      next(error);
    }
  });

  /** 对齐后：任务 1 冲突节点 Validation_Status → Resolved_By_Customer */
  router.post('/:id/design-detail/mark-task1-validation-resolved', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.markDesignDetailTask1ValidationResolvedByCustomer(
        req.params.id,
        req.body,
        auth,
      );
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '标记失败' });
        return;
      }
      res.status(200).json({ updatedCount: result.updatedCount });
    } catch (error) {
      next(error);
    }
  });

  /** 重置任务 1 特征「是否确认痛点」（设计页重启） */
  router.post('/:id/design-detail/task1-pain-point-confirmed/reset', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.resetDesignDetailTask1PainPointConfirmed(
        req.params.id,
        req.body,
        auth,
      );
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '重置失败' });
        return;
      }
      res.status(200).json({ updated: result.updated, lineStepIds: result.lineStepIds });
    } catch (error) {
      next(error);
    }
  });

  /** 按设计任务线步删除 token 图（级联 `DesignFeatureNode`、`DesignLogicLink`） */
  router.delete('/:id/design-detail/task-graph/:taskId', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const ok = await service.deleteDesignDetailTaskGraph(req.params.id, req.params.taskId, auth);
      if (!ok) {
        res.status(404).json({ message: '案例不存在或 taskId 无效' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  /** 任务 1 L1 原始实然特征集 Target_KV → DesignDetailTaskToken / DesignFeatureNode */
  router.post('/:id/design-detail/sync-task1-l1-original-feature-matrix', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask1L1OriginalFeatureMatrix(
        req.params.id,
        req.body,
        auth,
      );
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** Task1 客户基本信息提炼 JSON → DesignDetailTaskToken / DesignFeatureNode / DesignLogicLink */
  router.post('/:id/design-detail/sync-task1-basic-info-graph', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask1BasicInfoGraph(req.params.id, req.body, auth);
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** Task1 客户需求提炼：按顶层分域（如 businessContext）同步 customer_requirement 步 token / 特征 / 逻辑边 */
  router.post('/:id/design-detail/sync-customer-req-section-graph', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailCustomerReqSectionGraph(req.params.id, req.body, auth);
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 2 L1：解析 `Target_KV[].Feature_Key`，各写一条 `DesignDetailTaskToken`（`taskId` = `DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID`） */
  router.post('/:id/design-detail/sync-task2-l1-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask2L1TargetKvTokens(req.params.id, req.body, auth);
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 2 L1 推理图同步：与 `sync-task2-l1-target-kv-tokens` 同落库，body 形状更宽松（见 `coerceHttpBodyToL1InferenceRawString`） */
  router.post('/:id/design-detail/sync-task2-l1-inference-graph', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask2L1InferenceGraph(req.params.id, req.body, auth);
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 3 L2：解析 `Target_KV`，写任务 3 推理图 `DesignDetailTaskToken` / `DesignFeatureNode` / `DesignLogicLink` */
  router.post('/:id/design-detail/sync-task3-l2-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask3L2TargetKvTokens(req.params.id, req.body, auth);
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 4 L2：解析 `L2_Value_Inference_Matrix.Target_KV`，写任务 4 推理图 `DesignDetailTaskToken` / `DesignFeatureNode` / `DesignLogicLink` */
  router.post('/:id/design-detail/sync-task4-l2-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask4L2TargetKvTokens(req.params.id, req.body, auth);
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 5 L3：宏观流程固定维度 Target_KV */
  router.post('/:id/design-detail/sync-task5-l3-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask5L3TargetKvTokens(req.params.id, req.body, auth);
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 5.1 L3.1：战略价值主张与业务能力单元 */
  router.post('/:id/design-detail/sync-task51-l3-value-proposition-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask51L3ValuePropositionTargetKvTokens(
        req.params.id,
        req.body,
        auth,
      );
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 5.2 L3.2：业务能力字段集层次映射 */
  router.post('/:id/design-detail/sync-task52-l3-asset-field-set-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask52L3AssetFieldSetTargetKvTokens(
        req.params.id,
        req.body,
        auth,
      );
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 5.3 L3.3：跨能力单元关键场景时序流转串联 */
  router.post('/:id/design-detail/sync-task53-l3-workflow-flow-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask53L3WorkflowFlowTargetKvTokens(
        req.params.id,
        req.body,
        auth,
      );
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 5.5 L3.5：价值流阶段_* 原子 VSM 节点 */
  router.post('/:id/design-detail/sync-task55-l3-vsm-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask55L3VsmTargetKvTokens(req.params.id, req.body, auth);
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 0：工具箱原语特征落库（供任务 8 Evidence 跨层正向归纳） */
  router.post('/:id/design-detail/sync-task0-toolbox-primitives', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask0ToolboxPrimitives(req.params.id, req.body, auth);
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if ('ok' in result && result.ok) {
        res.json({
          ok: true,
          tokenCount: result.tokenCount,
          featureCount: result.featureCount,
          linkCount: result.linkCount,
          features: result.features,
        });
        return;
      }
      res.status(500).json({ message: '同步失败' });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 8 L4.5：操作角色 / 单据对象 / 状态转移矩阵 */
  router.post('/:id/design-detail/sync-task8-l45-prototype-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask8L45PrototypeTargetKvTokens(
        req.params.id,
        req.body,
        auth,
      );
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 8.5 L4.75：物理外挂 Hook / 微观连接器绑定 / 工具方案裁决 */
  router.post('/:id/design-detail/sync-task85-l475-physical-hook-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask85L475PhysicalHookTargetKvTokens(
        req.params.id,
        req.body,
        auth,
      );
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 9 L5：系统一级模块 / 二级功能菜单 */
  router.post('/:id/design-detail/sync-task9-l5-blueprint-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask9L5BlueprintTargetKvTokens(
        req.params.id,
        req.body,
        auth,
      );
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 10 L5：物理表结构 Schema / 权限字典初始化 SQL */
  router.post('/:id/design-detail/sync-task10-l5-technical-ddl-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask10L5TechnicalDdlTargetKvTokens(
        req.params.id,
        req.body,
        auth,
      );
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 7 L4：所属业务流程 / 协作节点 */
  router.post('/:id/design-detail/sync-task7-l4-collaboration-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask7L4CollaborationTargetKvTokens(
        req.params.id,
        req.body,
        auth,
      );
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 6.5 L3：流程优化 Gap 方案（三维 IT-Gap） */
  router.post('/:id/design-detail/sync-task65-l3-it-gap-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask65L3ItGapTargetKvTokens(
        req.params.id,
        req.body,
        auth,
      );
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 任务 6 L3：关键场景_* 与 Extended_Features */
  router.post('/:id/design-detail/sync-task6-l3-scenario-target-kv-tokens', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.syncDesignDetailTask6L3ScenarioTargetKvTokens(req.params.id, req.body, auth);
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '同步失败' });
        return;
      }
      res.status(200).json({
        tokenCount: result.tokenCount,
        featureCount: result.featureCount,
        linkCount: result.linkCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /** 须在 `GET /:id` 之前注册 */
  router.get('/:id/llm-logs', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const bundle = await service.getCaseLlmLogsWithSummary(req.params.id, auth);
      if (!bundle) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.json(bundle);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/llm-logs', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.appendCaseLlmLog(req.params.id, req.body, auth);
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  /** 须在 `GET /:id` 之前；与 `DELETE …/design-detail/task-graph/:taskId` 配套，按 taskId 删 LLM 审计 */
  router.post('/:id/llm-logs/clear', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const result = await service.clearCaseLlmLogsForTasks(req.params.id, req.body, auth);
      if ('notFound' in result && result.notFound) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      if ('badRequest' in result && result.badRequest) {
        res.status(400).json({ message: result.message });
        return;
      }
      if (!('ok' in result) || !result.ok) {
        res.status(500).json({ message: '清除失败' });
        return;
      }
      res.status(200).json({ deleted: result.deleted });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const item = await service.getById(req.params.id, auth);
      if (!item) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/messages', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const item = await service.getById(req.params.id, auth);
      if (!item) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      const messages = await service.getMessages(req.params.id, auth);
      if (!messages) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.json({ caseId: req.params.id, items: messages });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/messages', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const message = await service.addMessage(req.params.id, req.body, auth);
      if (!message) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id/messages', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const messages = await service.replaceMessages(req.params.id, req.body, auth);
      if (!messages) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.json({ items: messages });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id/messages/:messageId', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const message = await service.patchMessage(req.params.id, req.params.messageId, req.body, auth);
      if (!message) {
        res.status(404).json({ message: '消息不存在' });
        return;
      }
      res.json(message);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id/messages/:messageId', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const removed = await service.deleteMessage(req.params.id, req.params.messageId, auth);
      if (!removed) {
        res.status(404).json({ message: '消息不存在' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/tasks', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const tasks = await service.getTaskSummaries(req.params.id, auth);
      if (!tasks) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.json({ caseId: req.params.id, items: tasks });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/tasks/:taskId/start', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const bundle = await service.startTask(req.params.id, req.params.taskId, req.body, auth);
      if (!bundle) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.json(bundle);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/tasks/:taskId/confirm', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const bundle = await service.confirmTask(req.params.id, req.params.taskId, req.body, auth);
      if (!bundle) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.json(bundle);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/tasks/:taskId/revise', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const bundle = await service.reviseTask(req.params.id, req.params.taskId, req.body, auth);
      if (!bundle) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.json(bundle);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/tasks/:taskId/rollback', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const bundle = await service.rollbackTask(req.params.id, req.params.taskId, req.body, auth);
      if (!bundle) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.json(bundle);
    } catch (error) {
      next(error);
    }
  });

  router.post('/parse-preview', async (req, res, next) => {
    try {
      const preview = await service.parsePreview(req.body);
      res.status(200).json(preview);
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const item = await service.create(req.body, auth);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const item = await service.update(req.params.id, req.body, auth);
      if (!item) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const auth = getAuth(req);
      const removed = await service.delete(req.params.id, auth);
      if (!removed) {
        res.status(404).json({ message: '案例不存在' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        message: '请求参数不合法',
        issues: error.issues,
      });
      return;
    }
    next(error);
  });

  return router;
}
