import { Router } from "express";
import { aiChatController } from "./ai-chat.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";
import { validate } from "../../middleware/validate";
import { aiChatRateLimiter } from "../../middleware/rate-limit";
import { chatMessageSchema, confirmActionSchema } from "./ai-chat.dto";

export const aiChatRoutes = Router();

aiChatRoutes.use(requireAuth);
aiChatRoutes.use(requirePlan("PRO"));
aiChatRoutes.post("/message", aiChatRateLimiter, validate({ body: chatMessageSchema }), aiChatController.sendMessage);
aiChatRoutes.post("/confirm-action", aiChatRateLimiter, validate({ body: confirmActionSchema }), aiChatController.confirmAction);
