import "dotenv/config";
import { z } from "zod";

const optionalEmailSchema = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().email().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGIN: z.string().default("http://localhost:4200"),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  JWT_REFRESH_EXPIRES_IN_REMEMBER_ME: z.string().default("30d"),
  PASSWORD_RESET_TOKEN_EXPIRES_IN: z.string().default("1h"),
  ACCOUNT_NUMBER_ENCRYPTION_KEY: z
    .string()
    .length(64, "ACCOUNT_NUMBER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)"),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),
  // ==== Sign in with Google ====
  // OAuth 2.0 Client ID from https://console.cloud.google.com/apis/credentials (Web application
  // type). Leave blank to disable the "Sign in with Google" button (it just won't render).
  GOOGLE_CLIENT_ID: z.string().optional(),
  // ==== AI Chat Assistant ====
  // Free-tier Groq key (https://console.groq.com/keys) — OpenAI-compatible chat completions API,
  // no billing/project setup required. Optional — the chat endpoint returns a friendly
  // "not configured" error if this is unset, everything else works.
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: optionalEmailSchema,
  // ==== Gmail SMTP (alternative to Resend) ====
  // Send password-reset emails via a Gmail account instead of Resend. GMAIL_USER is the Gmail
  // address; GMAIL_APP_PASSWORD is a 16-char App Password (myaccount.google.com/apppasswords —
  // requires 2-Step Verification enabled), NOT your normal Gmail password. If both are set, Gmail
  // is used instead of Resend even if RESEND_API_KEY is also set.
  GMAIL_USER: optionalEmailSchema,
  GMAIL_APP_PASSWORD: z.string().optional(),
  FRONTEND_URL: z.string().url().default("http://localhost:4200"),
  // ==== Billing (Razorpay) ====
  // Test/live keys from https://dashboard.razorpay.com/app/keys. Leave blank to disable checkout
  // (the billing endpoints return a friendly "not configured" error instead of erroring).
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  // Secret configured on the Razorpay webhook (Settings > Webhooks) used to verify inbound events.
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration. Check your .env file against .env.example.");
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
