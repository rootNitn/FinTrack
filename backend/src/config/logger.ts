import pino from "pino";
import { isProduction } from "./env";

export const loggerRedaction = {
  paths: [
    "req.headers.authorization",
    "req.headers.cookie",
    'req.headers["x-api-key"]',
    'req.headers["x-razorpay-signature"]',
  ],
  censor: "[REDACTED]",
};

export const logger = pino({
  level: isProduction ? "info" : "debug",
  redact: loggerRedaction,
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
      },
});
