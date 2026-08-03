import { Response } from "express";
import { aiChatService } from "./ai-chat.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const aiChatController = {
  sendMessage: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await aiChatService.sendMessage(requireUserId(req), req.body));
  }),
  confirmAction: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await aiChatService.confirmAction(requireUserId(req), req.body));
  }),
};
