import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error";
import { verifyAccessToken, AccessTokenPayload } from "../utils/jwt";

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}

/** Verifies the `Authorization: Bearer <token>` header and attaches the decoded user to the request. */
export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(AppError.unauthorized("Missing or invalid Authorization header"));
  }

  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return next(AppError.unauthorized("Invalid or expired access token"));
  }
}

/** Must be used after {@link requireAuth}. Restricts a route to ADMIN role users. */
export function requireAdmin(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    return next(AppError.forbidden("Admin access required"));
  }
  return next();
}
