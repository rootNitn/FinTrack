import { NextFunction, Response } from "express";
import { PlanTier } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { AuthenticatedRequest } from "./auth";
import { planSatisfies } from "../modules/billing/billing.constants";

/** Must be used after {@link requireAuth}. Restricts a route to users on `minPlan` or higher
 * (FREE < PLUS < PRO). Reads the plan fresh from the DB on every request (not from the JWT) so
 * access unlocks immediately after a successful upgrade, without needing a new access token.
 * Also auto-downgrades an expired paid plan back to FREE. */
export function requirePlan(minPlan: PlanTier) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (req.user.role === "ADMIN") return next(); // admins always have full access

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.sub },
      select: { planTier: true, planExpiresAt: true },
    });

    let effectivePlan = user.planTier;
    if (effectivePlan !== "FREE" && user.planExpiresAt && user.planExpiresAt < new Date()) {
      await prisma.user.update({ where: { id: req.user.sub }, data: { planTier: "FREE", planExpiresAt: null } });
      effectivePlan = "FREE";
    }

    if (!planSatisfies(effectivePlan, minPlan)) {
      return next(AppError.forbidden(`This feature requires the ${minPlan} plan or higher`));
    }

    return next();
  };
}
