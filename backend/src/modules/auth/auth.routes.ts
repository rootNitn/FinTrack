import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { authRateLimiter } from "../../middleware/rate-limit";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "./auth.dto";

export const authRoutes = Router();

authRoutes.post("/register", authRateLimiter, validate({ body: registerSchema }), authController.register);
authRoutes.post("/login", authRateLimiter, validate({ body: loginSchema }), authController.login);
authRoutes.post("/refresh", validate({ body: refreshSchema }), authController.refresh);
authRoutes.post("/logout", validate({ body: refreshSchema }), authController.logout);
authRoutes.post(
  "/forgot-password",
  authRateLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword
);
authRoutes.post("/reset-password", authRateLimiter, validate({ body: resetPasswordSchema }), authController.resetPassword);

authRoutes.get("/profile", requireAuth, authController.getProfile);
authRoutes.patch("/profile", requireAuth, validate({ body: updateProfileSchema }), authController.updateProfile);
authRoutes.post(
  "/change-password",
  requireAuth,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);
