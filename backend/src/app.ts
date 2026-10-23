import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { apiRouter } from "./modules/router";

// Populated only when the Angular build output is present alongside the backend (see §10 of
// PROJECT_OVERVIEW.md) — lets a single free host serve both the API and the SPA from one origin.
const frontendDistPath = path.join(__dirname, "../../frontend/dist/frontend/browser");
const hasFrontendBuild = fs.existsSync(path.join(frontendDistPath, "index.html"));

export function createApp(): Express {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        const configuredOrigins = env.CORS_ORIGIN.split(",").map((value) => value.trim());
        const isLocalhost = env.NODE_ENV === "development" && origin === "http://localhost";
        const isPrivateLanFrontend = env.NODE_ENV === "development" && !!origin &&
          /^http:\/\/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):4200$/.test(origin);
        callback(null, !origin || configuredOrigins.includes(origin) || isLocalhost || isPrivateLanFrontend);
      },
      credentials: true,
    })
  );
  app.use(compression());
  // `verify` stashes the raw bytes so the Razorpay webhook handler can HMAC-verify the exact
  // payload Razorpay signed — re-stringifying the parsed JSON body is not guaranteed byte-identical.
  app.use(
    express.json({
      limit: "5mb",
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== "test" }));

  app.get("/health", (_req, res) => {
    res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
  app.use("/api/v1", apiRouter);

  if (hasFrontendBuild) {
    app.use(express.static(frontendDistPath));
    // SPA fallback: any non-API, non-upload GET request resolves to index.html so Angular's
    // client-side router can handle the route.
    app.get(/^\/(?!api|uploads|health).*/, (_req, res) => {
      res.sendFile(path.join(frontendDistPath, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
