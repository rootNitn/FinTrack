import { Router } from "express";
import { healthAiImproveController } from "./health-ai-improve.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { healthAiImproveRequestSchema, saveHealthWellnessPlanSchema } from "./health-ai-improve.dto";
import { aiImproveRateLimiter } from "../../middleware/rate-limit";

const router = Router();

/**
 * POST /api/v1/health/ai-improve
 * Generate personalized health improvements based on health reports and wellness data
 */
router.post(
  "/improve",
  aiImproveRateLimiter,
  requireAuth,
  validate({ body: healthAiImproveRequestSchema }),
  healthAiImproveController.improve
);

/**
 * POST /api/v1/health/ai-improve/plans
 * Save a generated wellness plan so it can be revisited/printed later
 */
router.post(
  "/plans",
  requireAuth,
  validate({ body: saveHealthWellnessPlanSchema }),
  healthAiImproveController.savePlan
);

/**
 * GET /api/v1/health/ai-improve/plans
 * List saved wellness plans for the current user
 */
router.get("/plans", requireAuth, healthAiImproveController.listPlans);

/**
 * GET /api/v1/health/ai-improve/plans/report/:reportId
 * Fetch the most recent saved plan for a given report, if any (avoids re-generating on every visit)
 */
router.get("/plans/report/:reportId", requireAuth, healthAiImproveController.getPlanForReport);

/**
 * GET /api/v1/health/ai-improve/plans/:id
 * Fetch a single saved wellness plan
 */
router.get("/plans/:id", requireAuth, healthAiImproveController.getPlan);

/**
 * POST /api/v1/health/ai-improve/plans/:id/regenerate
 * Re-run AI generation for an existing saved plan and overwrite its content in place
 */
router.post("/plans/:id/regenerate", requireAuth, healthAiImproveController.regeneratePlan);

/**
 * DELETE /api/v1/health/ai-improve/plans/:id
 */
router.delete("/plans/:id", requireAuth, healthAiImproveController.deletePlan);

export { router as healthAiImproveRoutes };
