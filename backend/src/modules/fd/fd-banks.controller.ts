import { Response } from "express";
import { fdBanksService } from "./fd-banks.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

export const fdBanksController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search, bankType, activeOnly } = req.query as Record<string, string | undefined>;
    sendSuccess(
      res,
      await fdBanksService.list({ search, bankType, activeOnly: activeOnly ? activeOnly === "true" : undefined })
    );
  }),
  getById: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await fdBanksService.getById(req.params.id));
  }),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await fdBanksService.create(req.body));
  }),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await fdBanksService.update(req.params.id, req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await fdBanksService.remove(req.params.id);
    sendSuccess(res, { message: "Bank deleted" });
  }),
  import: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    sendSuccess(res, await fdBanksService.importFromFile(req.file.buffer, req.file.originalname));
  }),
};
