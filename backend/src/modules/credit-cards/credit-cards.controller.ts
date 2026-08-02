import { Response } from "express";
import { creditCardsService } from "./credit-cards.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const creditCardsController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await creditCardsService.list(requireUserId(req)));
  }),
  summary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await creditCardsService.summary(requireUserId(req)));
  }),
  getById: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await creditCardsService.getById(requireUserId(req), req.params.id));
  }),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await creditCardsService.create(requireUserId(req), req.body));
  }),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await creditCardsService.update(requireUserId(req), req.params.id, req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await creditCardsService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Credit card deleted" });
  }),

  listStatements: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await creditCardsService.listStatements(requireUserId(req), req.params.cardId));
  }),
  createStatement: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await creditCardsService.createStatement(requireUserId(req), req.params.cardId, req.body));
  }),
  updateStatement: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(
      res,
      await creditCardsService.updateStatement(requireUserId(req), req.params.cardId, req.params.statementId, req.body)
    );
  }),
  removeStatement: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await creditCardsService.removeStatement(requireUserId(req), req.params.cardId, req.params.statementId);
    sendSuccess(res, { message: "Statement deleted" });
  }),

  listPayments: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await creditCardsService.listPayments(requireUserId(req), req.params.cardId));
  }),
  recordPayment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await creditCardsService.recordPayment(requireUserId(req), req.params.cardId, req.body));
  }),

  redeem: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await creditCardsService.redeem(requireUserId(req), req.params.cardId, req.body));
  }),
};
