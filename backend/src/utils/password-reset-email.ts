import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

let gmailTransport: Transporter | null = null;

function getGmailTransport(): Transporter {
  if (!gmailTransport) {
    gmailTransport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
    });
  }
  return gmailTransport;
}

async function sendViaGmail(email: string, name: string, subject: string, html: string): Promise<boolean> {
  try {
    await getGmailTransport().sendMail({
      from: `LifeTrack <${env.GMAIL_USER}>`,
      to: email,
      subject,
      html,
    });
    logger.info({ recipient: email }, "Password reset email sent via Gmail");
    return true;
  } catch (error) {
    logger.error({ error }, "Gmail rejected password reset email");
    return false;
  }
}

async function sendViaResend(email: string, subject: string, html: string): Promise<boolean> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject, html }),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    logger.error({ status: response.status, responseBody }, "Resend rejected password reset email");
    return false;
  }

  logger.info({ recipient: email }, "Password reset email sent via Resend");
  return true;
}

export async function sendPasswordResetEmail(email: string, name: string, token: string): Promise<boolean> {
  const useGmail = Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);
  const useResend = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
  if (!useGmail && !useResend) {
    logger.warn("Password reset email skipped: configure either GMAIL_USER/GMAIL_APP_PASSWORD or RESEND_API_KEY/EMAIL_FROM");
    return false;
  }

  const resetUrl = `${env.FRONTEND_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your LifeTrack password";
  const html = `<p>Hello ${name.replace(/[<&>\"']/g, "")},</p><p>Use the link below to reset your LifeTrack password. It expires in one hour.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`;

  if (useGmail) return sendViaGmail(email, name, subject, html);
  return sendViaResend(email, subject, html);
}
