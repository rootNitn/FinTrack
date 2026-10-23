import { Router, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { z, ZodError } from "zod";
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AppError } from "../../utils/app-error";
import { healthConnectService } from "./health-connect.service";
import { healthConnectionSchema, healthPermissionSchema, healthSourcePreferenceSchema, healthSyncSchema, healthSyncStatusSchema } from "./health-connect.dto";

export const healthConnectRoutes = Router();
healthConnectRoutes.use(requireAuth);
const params = z.object({ id: z.string().uuid() });
const wrap = (operation: (req: AuthenticatedRequest) => Promise<unknown>) => asyncHandler(async (req: AuthenticatedRequest, res) => sendSuccess(res, await operation(req)));
healthConnectRoutes.post("/connections", validate({ body: healthConnectionSchema }), wrap(req => healthConnectService.connect(req.user!.sub, req.body)));
healthConnectRoutes.patch("/connections/:id", validate({ params, body: healthPermissionSchema }), wrap(req => healthConnectService.permissions(req.user!.sub, req.params.id, req.body)));
healthConnectRoutes.put("/connections/:id/sources", validate({ params, body: healthSourcePreferenceSchema }), wrap(req => healthConnectService.sourcePreferences(req.user!.sub, req.params.id, req.body)));
healthConnectRoutes.delete("/connections/:id", validate({ params }), wrap(req => healthConnectService.disconnect(req.user!.sub, req.params.id)));
healthConnectRoutes.post("/sync", rateLimit({ windowMs: 60000, max: 120, standardHeaders: true, legacyHeaders: false }), validate({ body: healthSyncSchema }), wrap(req => healthConnectService.sync(req.user!.sub, req.body)));
healthConnectRoutes.get("/sync/status", wrap(req => healthConnectService.status(req.user!.sub)));
healthConnectRoutes.post("/sync/:id/status", validate({ params, body: healthSyncStatusSchema }), wrap(req => healthConnectService.report(req.user!.sub, req.params.id, req.body)));
healthConnectRoutes.post("/sync/:id/manual", validate({ params }), wrap(req => healthConnectService.manual(req.user!.sub, req.params.id)));
healthConnectRoutes.delete("/data/:id", validate({ params }), wrap(req => healthConnectService.removeImported(req.user!.sub, req.params.id)));
healthConnectRoutes.get("/daily", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); }, validate({ query: z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }) }), wrap(req => healthConnectService.daily(req.user!.sub, Number(req.query.days))));
healthConnectRoutes.use((error: unknown, _req: AuthenticatedRequest, res: Response, next: NextFunction) => {
	if (error instanceof ZodError || error instanceof AppError) return next(error);
	return res.status(503).json({ success: false, message: "Health synchronization is temporarily unavailable. Please retry." });
});