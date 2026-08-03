import fs from "fs/promises";
import path from "path";
import { Request } from "express";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import { logger } from "../../config/logger";
import { aiChatService } from "../ai-chat/ai-chat.service";
import { CreateTicketInput, UpdateTicketAdminInput } from "./support-tickets.dto";
import { Prisma, TicketType } from "@prisma/client";

// Errors raised by users are additionally appended (JSON-lines) to this file, independent of the
// database row, so a future coding/debugging session can grep through real reported issues without
// needing DB access.
const ERROR_LOG_PATH = path.join(__dirname, "../../../logs/error-tickets.log");

async function appendErrorToFile(ticket: { id: string; userId: string; subject: string; description: string; errorContext?: unknown }) {
  try {
    await fs.mkdir(path.dirname(ERROR_LOG_PATH), { recursive: true });
    const line = JSON.stringify({
      ticketId: ticket.id,
      userId: ticket.userId,
      subject: ticket.subject,
      description: ticket.description,
      errorContext: ticket.errorContext ?? null,
      reportedAt: new Date().toISOString(),
    });
    await fs.appendFile(ERROR_LOG_PATH, line + "\n", "utf-8");
  } catch (err) {
    // Never fail ticket creation because of the log file — just log it server-side.
    logger.error({ err }, "Failed to append error ticket to error-tickets.log");
  }
}

export const supportTicketsService = {
  /**
   * Creates a helpdesk ticket. Behavior varies by type:
   * - ERROR: persisted to DB AND appended to logs/error-tickets.log for future developer review.
   * - DOUBT: an AI answer is generated synchronously and stored as `aiResponse` (ticket is marked
   *   RESOLVED if an answer was produced; otherwise it stays OPEN for a human admin to answer).
   * - SUGGESTION: simply stored for admin review.
   */
  async create(userId: string, input: CreateTicketInput) {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        type: input.type,
        subject: input.subject,
        description: input.description,
        errorContext: input.errorContext ?? Prisma.JsonNull,
      },
    });

    if (input.type === "ERROR") {
      await appendErrorToFile({ id: ticket.id, userId, subject: input.subject, description: input.description, errorContext: input.errorContext });
    }

    if (input.type === "DOUBT") {
      const aiResponse = await aiChatService.answerDoubt(userId, `${input.subject}\n\n${input.description}`);
      if (aiResponse) {
        return prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { aiResponse, status: "RESOLVED" },
        });
      }
    }

    return ticket;
  },

  async list(userId: string, req: Request) {
    const { skip, take, page, limit } = parsePagination(req, "createdAt");
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const where: Prisma.SupportTicketWhereInput = {
      userId,
      ...(type ? { type: type as TicketType } : {}),
      ...(status ? { status: status as Prisma.SupportTicketWhereInput["status"] } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.supportTicket.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(total, page, limit) };
  },

  async getById(userId: string, id: string) {
    const ticket = await prisma.supportTicket.findFirst({ where: { id, userId } });
    if (!ticket) throw AppError.notFound("Ticket not found");
    return ticket;
  },

  // --- Admin ---

  async listAll(req: Request) {
    const { skip, take, page, limit } = parsePagination(req, "createdAt");
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const where: Prisma.SupportTicketWhereInput = {
      ...(type ? { type: type as TicketType } : {}),
      ...(status ? { status: status as Prisma.SupportTicketWhereInput["status"] } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(total, page, limit) };
  },

  async getByIdAdmin(id: string) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!ticket) throw AppError.notFound("Ticket not found");
    return ticket;
  },

  async updateAdmin(id: string, input: UpdateTicketAdminInput) {
    const existing = await prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Ticket not found");

    return prisma.supportTicket.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.adminResponse !== undefined ? { adminResponse: input.adminResponse } : {}),
      },
    });
  },
};
