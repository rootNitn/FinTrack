import { Response } from "express";
import { authService } from "./auth.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

export const authController = {
  register: asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    sendCreated(res, result);
  }),

  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    sendSuccess(res, result);
  }),

  refresh: asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.body.refreshToken);
    sendSuccess(res, result);
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.body.refreshToken);
    sendSuccess(res, { message: "Logged out successfully" });
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body);
    sendSuccess(res, result);
  }),

  resetPassword: asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.body);
    sendSuccess(res, result);
  }),

  changePassword: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await authService.changePassword(req.user.sub, req.body);
    sendSuccess(res, result);
  }),

  getProfile: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const profile = await authService.getProfile(req.user.sub);
    sendSuccess(res, profile);
  }),

  updateProfile: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const profile = await authService.updateProfile(req.user.sub, req.body);
    sendSuccess(res, profile);
  }),
};
