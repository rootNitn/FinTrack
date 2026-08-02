import { Router } from "express";
import { aiChatController } from "./ai-chat.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { aiChatRateLimiter } from "../../middleware/rate-limit";
import { chatMessageSchema } from "./ai-chat.dto";

export const aiChatRoutes = Router();

aiChatRoutes.use(requireAuth);
aiChatRoutes.post("/message", aiChatRateLimiter, validate({ body: chatMessageSchema }), aiChatController.sendMessage);
