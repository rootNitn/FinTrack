import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodEffects } from "zod";

type ZodSchemaLike = AnyZodObject | ZodEffects<AnyZodObject>;

/**
 * Validates and replaces `req.body` / `req.query` / `req.params` with the parsed & typed result.
 * Throws a ZodError (caught by the global error handler) on failure.
 */
export function validate(schemas: { body?: ZodSchemaLike; query?: ZodSchemaLike; params?: ZodSchemaLike }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query) as typeof req.query;
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      next();
    } catch (err) {
      next(err);
    }
  };
}
