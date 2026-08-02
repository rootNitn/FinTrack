import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async Express route handler so rejected promises are forwarded to next(),
 * avoiding repetitive try/catch blocks in every controller.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
