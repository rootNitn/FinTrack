import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { logAudit } from "../../utils/audit-log.util";
import { documentsService } from "../documents/documents.service";
import { extractDocumentText } from "../documents/parsers/extraction-flow.util";
import { AisParser, AisFields } from "../documents/parsers/ais.parser";
import { serializeDecimals } from "../documents/parsers/decimal.util";
import { UpdateAisInput } from "./ais.dto";

const parser = new AisParser();

const DECIMAL_FIELDS = [
  "salaryIncome",
  "interestIncome",
  "dividendIncome",
  "capitalGainsIncome",
  "propertyIncome",
  "businessIncome",
  "otherIncome",
  "taxPaid",
  "tdsAmount",
  "tcsAmount",
  "advanceTax",
] as const;

async function createRecord(
  documentId: string,
  userId: string,
  financialYearCode: string,
  data: Partial<AisFields>,
  validationWarnings: string[],
) {
  const record = await prisma.aisRecord.create({
    data: {
      documentId,
      userId,
      financialYearCode,
      salaryIncome: data.salaryIncome,
      interestIncome: data.interestIncome,
      dividendIncome: data.dividendIncome,
      capitalGainsIncome: data.capitalGainsIncome,
      propertyIncome: data.propertyIncome,
      businessIncome: data.businessIncome,
      otherIncome: data.otherIncome,
      taxPaid: data.taxPaid,
      tdsAmount: data.tdsAmount,
      tcsAmount: data.tcsAmount,
      advanceTax: data.advanceTax,
      rawExtractedJson: data,
      validationWarnings,
    },
  });

  await prisma.uploadedDocument.update({
    where: { id: documentId },
    data: { status: validationWarnings.length > 0 ? "PARSED" : "VALIDATED" },
  });
  await logAudit(userId, "CREATE", "AisRecord", record.id, { financialYearCode });

  return serializeDecimals(record, DECIMAL_FIELDS);
}

export const aisService = {
  async import(userId: string, financialYearCode: string, fileName: string, mimeType: string, buffer: Buffer) {
    const document = await documentsService.upload(userId, "AIS", financialYearCode, fileName, mimeType, buffer);

    const rawText = await extractDocumentText(document.id, buffer, mimeType);

    const { data, warnings: validationWarnings } = parser.parse(rawText);

    return createRecord(document.id, userId, financialYearCode, data, validationWarnings);
  },

  /**
   * Retries text extraction/parsing for a document previously marked `PASSWORD_REQUIRED`, using
   * the password supplied by the user for a single in-memory decryption attempt only.
   */
  async unlock(userId: string, documentId: string, password: string) {
    const { doc, buffer } = await documentsService.getOwnedWithBuffer(userId, documentId);
    if (doc.documentType !== "AIS") throw AppError.notFound("AIS document not found");

    const existing = await prisma.aisRecord.findUnique({ where: { documentId: doc.id } });
    if (existing) throw AppError.conflict("This document has already been imported.");

    const rawText = await extractDocumentText(doc.id, buffer, doc.mimeType, password);

    const { data, warnings: validationWarnings } = parser.parse(rawText);

    return createRecord(doc.id, userId, doc.financialYearCode, data, validationWarnings);
  },

  async list(userId: string, financialYearCode?: string) {
    const records = await prisma.aisRecord.findMany({
      where: { userId, ...(financialYearCode ? { financialYearCode } : {}) },
      include: { document: { select: { fileName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return records.map((r) => serializeDecimals(r, DECIMAL_FIELDS));
  },

  async getOwned(userId: string, id: string) {
    const record = await prisma.aisRecord.findFirst({ where: { id, userId } });
    if (!record) throw AppError.notFound("AIS record not found");
    return serializeDecimals(record, DECIMAL_FIELDS);
  },

  async update(userId: string, id: string, input: UpdateAisInput) {
    const existing = await this.getOwned(userId, id);
    const updated = await prisma.aisRecord.update({
      where: { id: existing.id },
      data: { ...input, isEdited: true },
    });
    await logAudit(userId, "UPDATE", "AisRecord", id, {});
    return serializeDecimals(updated, DECIMAL_FIELDS);
  },

  async remove(userId: string, id: string) {
    const existing = await this.getOwned(userId, id);
    await documentsService.remove(userId, existing.documentId);
  },
};
