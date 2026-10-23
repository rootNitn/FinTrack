import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { authRateLimiter, passwordResetRateLimiter } from "../../middleware/rate-limit";
import {
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  twoFactorDisableSchema,
  twoFactorEnableSchema,
  twoFactorVerifyLoginSchema,
  updateProfileSchema,
} from "./auth.dto";

export const authRoutes = Router();

authRoutes.post("/register", authRateLimiter, validate({ body: registerSchema }), authController.register);
authRoutes.post("/login", authRateLimiter, validate({ body: loginSchema }), authController.login);
authRoutes.post(
  "/2fa/verify-login",
  authRateLimiter,
  validate({ body: twoFactorVerifyLoginSchema }),
  authController.verifyTwoFactorLogin
);
authRoutes.post("/google-login", authRateLimiter, validate({ body: googleAuthSchema }), authController.googleLogin);
authRoutes.post("/refresh", validate({ body: refreshSchema }), authController.refresh);
authRoutes.post("/logout", validate({ body: refreshSchema }), authController.logout);
authRoutes.post(
  "/forgot-password",
  passwordResetRateLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword
);
authRoutes.post("/reset-password", passwordResetRateLimiter, validate({ body: resetPasswordSchema }), authController.resetPassword);

authRoutes.get("/profile", requireAuth, authController.getProfile);
authRoutes.patch("/profile", requireAuth, validate({ body: updateProfileSchema }), authController.updateProfile);
authRoutes.post(
  "/change-password",
  requireAuth,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);
authRoutes.get("/2fa/status", requireAuth, authController.twoFactorStatus);
authRoutes.post("/2fa/setup", requireAuth, authController.setupTwoFactor);
authRoutes.post("/2fa/enable", requireAuth, validate({ body: twoFactorEnableSchema }), authController.enableTwoFactor);
authRoutes.post("/2fa/disable", requireAuth, validate({ body: twoFactorDisableSchema }), authController.disableTwoFactor);
authRoutes.delete("/account", requireAuth, validate({ body: deleteAccountSchema }), authController.deleteAccount);

