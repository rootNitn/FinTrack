import rateLimit from "express-rate-limit";
import { env } from "../config/env";

/** Stricter rate limit applied to authentication endpoints (login, register, forgot-password). */
export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again later." },
});
