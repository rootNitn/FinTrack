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

  googleLogin: asyncHandler(async (req, res) => {
    const result = await authService.loginWithGoogle(req.body);
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

  verifyTwoFactorLogin: asyncHandler(async (req, res) => {
    const result = await authService.verifyTwoFactorLogin(req.body);
    sendSuccess(res, result);
  }),

  setupTwoFactor: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await authService.setupTwoFactor(req.user.sub);
    sendSuccess(res, result);
  }),

  enableTwoFactor: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await authService.enableTwoFactor(req.user.sub, req.body);
    sendSuccess(res, result);
  }),

  disableTwoFactor: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await authService.disableTwoFactor(req.user.sub, req.body);
    sendSuccess(res, result);
  }),

  twoFactorStatus: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await authService.getTwoFactorStatus(req.user.sub);
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

  deleteAccount: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await authService.deleteAccount(req.user.sub, req.body);
    sendSuccess(res, result);
  }),
};
