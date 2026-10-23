import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { logAudit } from "../../utils/audit-log.util";
import { documentsService } from "../documents/documents.service";
import { extractDocumentText } from "../documents/parsers/extraction-flow.util";
import { Form26ASParser, Form26ASFields } from "../documents/parsers/form26as.parser";
import { runValidationChecks } from "../documents/parsers/validation.util";
import { serializeDecimals } from "../documents/parsers/decimal.util";
import { UpdateForm26ASInput } from "./form26as.dto";

const parser = new Form26ASParser();

const DECIMAL_FIELDS = [
  "employerTds",
  "bankTds",
  "dividendTds",
  "propertyTds",
  "professionalIncomeTds",
  "advanceTax",
  "selfAssessmentTax",
  "refund",
  "totalTaxPaid",
] as const;

async function validate(data: Partial<Form26ASFields>): Promise<string[]> {
  const expectedTotal =
    (data.employerTds ?? 0) +
    (data.bankTds ?? 0) +
    (data.dividendTds ?? 0) +
    (data.propertyTds ?? 0) +
    (data.professionalIncomeTds ?? 0) +
    (data.advanceTax ?? 0) +
    (data.selfAssessmentTax ?? 0);
  return runValidationChecks("FORM26AS", [
    {
      condition: "TOTAL_EQUALS_SUM_OF_TDS_AND_TAX_COMPONENTS",
      fieldName: "totalTaxPaid",
      actual: data.totalTaxPaid,
      expected: expectedTotal,
      defaultMessage: "Total Tax Paid does not match the sum of all TDS/advance/self-assessment tax components.",
    },
  ]);
}

async function createRecord(
  documentId: string,
  userId: string,
  financialYearCode: string,
  data: Partial<Form26ASFields>,
  validationWarnings: string[],
) {
  const record = await prisma.form26ASRecord.create({
    data: {
      documentId,
      userId,
      financialYearCode,
      employerTds: data.employerTds,
      bankTds: data.bankTds,
      dividendTds: data.dividendTds,
      propertyTds: data.propertyTds,
      professionalIncomeTds: data.professionalIncomeTds,
      advanceTax: data.advanceTax,
      selfAssessmentTax: data.selfAssessmentTax,
      refund: data.refund,
      totalTaxPaid: data.totalTaxPaid,
      rawExtractedJson: data,
      validationWarnings,
    },
  });

  await prisma.uploadedDocument.update({
    where: { id: documentId },
    data: { status: validationWarnings.length > 0 ? "PARSED" : "VALIDATED" },
  });
  await logAudit(userId, "CREATE", "Form26ASRecord", record.id, { financialYearCode });

  return serializeDecimals(record, DECIMAL_FIELDS);
}

export const form26ASService = {
  async import(userId: string, financialYearCode: string, fileName: string, mimeType: string, buffer: Buffer) {
    const document = await documentsService.upload(userId, "FORM26AS", financialYearCode, fileName, mimeType, buffer);

    const rawText = await extractDocumentText(document.id, buffer, mimeType);

    const { data, warnings: extractionWarnings } = parser.parse(rawText);
    const validationWarnings = [...extractionWarnings, ...(await validate(data))];

    return createRecord(document.id, userId, financialYearCode, data, validationWarnings);
  },

  /**
   * Retries text extraction/parsing for a document previously marked `PASSWORD_REQUIRED`, using
   * the password supplied by the user for a single in-memory decryption attempt only.
   */
  async unlock(userId: string, documentId: string, password: string) {
    const { doc, buffer } = await documentsService.getOwnedWithBuffer(userId, documentId);
    if (doc.documentType !== "FORM26AS") throw AppError.notFound("Form 26AS document not found");

    const existing = await prisma.form26ASRecord.findUnique({ where: { documentId: doc.id } });
    if (existing) throw AppError.conflict("This document has already been imported.");

    const rawText = await extractDocumentText(doc.id, buffer, doc.mimeType, password);

    const { data, warnings: extractionWarnings } = parser.parse(rawText);
    const validationWarnings = [...extractionWarnings, ...(await validate(data))];

    return createRecord(doc.id, userId, doc.financialYearCode, data, validationWarnings);
  },

  async list(userId: string, financialYearCode?: string) {
    const records = await prisma.form26ASRecord.findMany({
      where: { userId, ...(financialYearCode ? { financialYearCode } : {}) },
      include: { document: { select: { fileName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return records.map((r) => serializeDecimals(r, DECIMAL_FIELDS));
  },

  async getOwned(userId: string, id: string) {
    const record = await prisma.form26ASRecord.findFirst({ where: { id, userId } });
    if (!record) throw AppError.notFound("Form 26AS record not found");
    return serializeDecimals(record, DECIMAL_FIELDS);
  },

  async update(userId: string, id: string, input: UpdateForm26ASInput) {
    const existing = await this.getOwned(userId, id);
    const merged: Partial<Form26ASFields> = { ...(existing.rawExtractedJson as Partial<Form26ASFields>), ...input };
    const validationWarnings = await validate(merged);

    const updated = await prisma.form26ASRecord.update({
      where: { id: existing.id },
      data: { ...input, isEdited: true, validationWarnings },
    });

    await prisma.uploadedDocument.update({
      where: { id: existing.documentId },
      data: { status: validationWarnings.length > 0 ? "PARSED" : "VALIDATED" },
    });
    await logAudit(userId, "UPDATE", "Form26ASRecord", id, {});

    return serializeDecimals(updated, DECIMAL_FIELDS);
  },

  async remove(userId: string, id: string) {
    const existing = await this.getOwned(userId, id);
    await documentsService.remove(userId, existing.documentId);
  },
};
