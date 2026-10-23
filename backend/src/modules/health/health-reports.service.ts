import { HealthResultFlag, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { serializeDecimals } from "../documents/parsers/decimal.util";
import { extractText, PdfPasswordError } from "../documents/parsers/text-extractor.service";
import { extractPatientInfo, flagForValue, parseLabReportText } from "./lab-report.parser";
import { parseLabReportTextWithAI } from "./lab-report.ai-parser";
import {
  CreateHealthReportResultInput,
  UpdateHealthReportInput,
  UpdateHealthReportResultInput,
} from "./health-reports.dto";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const RESULT_DECIMAL_FIELDS = ["value", "referenceLow", "referenceHigh"] as const;

function serializeResult<T extends Record<string, unknown>>(result: T) {
  return serializeDecimals(result, RESULT_DECIMAL_FIELDS);
}

function serializeReport<T extends { results?: Record<string, unknown>[] }>(report: T) {
  return {
    ...report,
    results: report.results?.map(serializeResult),
  };
}

export const healthReportsService = {
  async upload(
    userId: string,
    reportDate: Date,
    testDate: Date | undefined,
    labName: string | undefined,
    password: string | undefined,
    fileName: string,
    mimeType: string,
    buffer: Buffer
  ) {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw AppError.badRequest(`Unsupported file type: ${mimeType}`);
    }
    if (buffer.length > MAX_FILE_BYTES) {
      throw AppError.badRequest("File exceeds the 10 MB upload limit");
    }

    const report = await prisma.healthReportDocument.create({
      data: { userId, fileName, reportDate, testDate, labName, status: "UPLOADED" },
    });

    let rawText: string;
    try {
      rawText = await extractText(buffer, mimeType, password);
    } catch (err) {
      if (err instanceof PdfPasswordError) {
        await prisma.healthReportDocument.update({
          where: { id: report.id },
          data: { status: "PASSWORD_REQUIRED", parseErrors: { message: "Password required to open this PDF." } },
        });
        throw AppError.unprocessable(
          password ? "Incorrect password. Please try again." : "This PDF is password-protected.",
          { code: "PASSWORD_REQUIRED", reportId: report.id }
        );
      }
      await prisma.healthReportDocument.update({
        where: { id: report.id },
        data: { status: "FAILED", parseErrors: { message: (err as Error).message } },
      });
      throw AppError.badRequest("Could not extract text from the uploaded file.");
    }

    const patientInfo = extractPatientInfo(rawText);

    let parsed = parseLabReportText(rawText);
    let usedAiFallback = false;
    if (parsed.length === 0 && env.GROQ_API_KEY) {
      // Regex heuristics found nothing (e.g. an unfamiliar layout) — fall back to an AI-assisted
      // pass rather than failing outright. Never throws: any AI/network error just leaves `parsed`
      // empty, so the existing "no lab values could be extracted" failure path below still applies.
      parsed = await parseLabReportTextWithAI(rawText).catch(() => []);
      usedAiFallback = parsed.length > 0;
    }

    await prisma.healthReportResult.createMany({
      data: parsed.map((row) => ({
        reportId: report.id,
        userId,
        testName: row.testName,
        value: row.value,
        unit: row.unit,
        referenceLow: row.referenceLow,
        referenceHigh: row.referenceHigh,
        flag: flagForValue(row.value, row.referenceLow, row.referenceHigh) as HealthResultFlag,
      })),
    });

    const updated = await prisma.healthReportDocument.update({
      where: { id: report.id },
      data: {
        status: parsed.length > 0 ? "PARSED" : "FAILED",
        patientName: patientInfo.name,
        patientAge: patientInfo.age,
        patientGender: patientInfo.gender,
        ...(parsed.length === 0
          ? { parseErrors: { message: "No lab values could be extracted from this file." } }
          : usedAiFallback
            ? { parseErrors: { message: "Parsed using AI-assisted extraction — please double-check these values." } }
            : {}),
      },
      include: { results: { orderBy: { testName: "asc" } } },
    });

    return serializeReport(updated);
  },

  async list(userId: string) {
    const reports = await prisma.healthReportDocument.findMany({
      where: { userId },
      orderBy: { reportDate: "desc" },
      include: { _count: { select: { results: true } } },
    });
    return Promise.all(
      reports.map(async (report) => {
        const abnormalCount = await prisma.healthReportResult.count({
          where: { reportId: report.id, flag: { in: ["LOW", "HIGH"] } },
        });
        return { ...report, resultCount: report._count.results, abnormalCount, _count: undefined };
      })
    );
  },

  async getById(userId: string, id: string) {
    const report = await prisma.healthReportDocument.findFirst({
      where: { id, userId },
      include: { results: { orderBy: { testName: "asc" } } },
    });
    if (!report) throw AppError.notFound("Health report not found");
    return serializeReport(report);
  },

  async updateMeta(userId: string, id: string, input: UpdateHealthReportInput) {
    const existing = await prisma.healthReportDocument.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Health report not found");
    const updated = await prisma.healthReportDocument.update({
      where: { id },
      data: input,
      include: { results: { orderBy: { testName: "asc" } } },
    });
    return serializeReport(updated);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.healthReportDocument.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Health report not found");
    await prisma.healthReportDocument.delete({ where: { id } });
  },

  async addResult(userId: string, reportId: string, input: CreateHealthReportResultInput) {
    const report = await prisma.healthReportDocument.findFirst({ where: { id: reportId, userId } });
    if (!report) throw AppError.notFound("Health report not found");

    const result = await prisma.healthReportResult.create({
      data: {
        reportId,
        userId,
        testName: input.testName,
        value: input.value,
        unit: input.unit,
        referenceLow: input.referenceLow,
        referenceHigh: input.referenceHigh,
        flag: flagForValue(input.value, input.referenceLow, input.referenceHigh) as HealthResultFlag,
      },
    });
    return serializeResult(result);
  },

  async updateResult(userId: string, reportId: string, resultId: string, input: UpdateHealthReportResultInput) {
    const existing = await prisma.healthReportResult.findFirst({ where: { id: resultId, reportId, userId } });
    if (!existing) throw AppError.notFound("Result not found");

    const value = input.value ?? Number(existing.value);
    const referenceLow = input.referenceLow ?? (existing.referenceLow != null ? Number(existing.referenceLow) : undefined);
    const referenceHigh = input.referenceHigh ?? (existing.referenceHigh != null ? Number(existing.referenceHigh) : undefined);

    const result = await prisma.healthReportResult.update({
      where: { id: resultId },
      data: { ...input, flag: flagForValue(value, referenceLow, referenceHigh) as HealthResultFlag },
    });
    return serializeResult(result);
  },

  async removeResult(userId: string, reportId: string, resultId: string) {
    const existing = await prisma.healthReportResult.findFirst({ where: { id: resultId, reportId, userId } });
    if (!existing) throw AppError.notFound("Result not found");
    await prisma.healthReportResult.delete({ where: { id: resultId } });
  },

  async listTestNames(userId: string) {
    const rows = await prisma.healthReportResult.findMany({
      where: { userId },
      distinct: ["testName"],
      select: { testName: true },
      orderBy: { testName: "asc" },
    });
    return rows.map((r) => r.testName);
  },

  /** Chronological trend for a single test across every report the user has uploaded, for comparing against past values. */
  async compare(userId: string, testName: string) {
    const results = await prisma.healthReportResult.findMany({
      where: { userId, testName: { equals: testName, mode: "insensitive" as Prisma.QueryMode } },
      include: { report: { select: { reportDate: true, labName: true, fileName: true } } },
      orderBy: { report: { reportDate: "asc" } },
    });

    const serialized = results.map((r) => {
      const { report, ...rest } = r;
      return { ...serializeResult(rest), reportDate: report.reportDate, labName: report.labName, fileName: report.fileName };
    });

    const latest = serialized[serialized.length - 1] ?? null;
    const previous = serialized.length > 1 ? serialized[serialized.length - 2] : null;
    const delta = latest && previous ? Number((Number(latest.value) - Number(previous.value)).toFixed(4)) : null;

    return { testName, history: serialized, latest, previous, delta };
  },
};
