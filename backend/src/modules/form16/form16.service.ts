import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { logAudit } from "../../utils/audit-log.util";
import { documentsService } from "../documents/documents.service";
import { extractDocumentText } from "../documents/parsers/extraction-flow.util";
import { Form16Parser, Form16Fields } from "../documents/parsers/form16.parser";
import { runValidationChecks } from "../documents/parsers/validation.util";
import { serializeDecimals } from "../documents/parsers/decimal.util";
import { UpdateForm16Input } from "./form16.dto";

const parser = new Form16Parser();

const DECIMAL_FIELDS = [
  "grossSalary",
  "exemptions",
  "deductions",
  "professionalTax",
  "standardDeduction",
  "employerNpsContribution",
  "taxableIncome",
  "tdsDeducted",
  "taxDeposited",
] as const;

async function validate(data: Partial<Form16Fields>): Promise<string[]> {
  const expectedTaxable = (data.grossSalary ?? 0) - (data.exemptions ?? 0) - (data.deductions ?? 0) - (data.standardDeduction ?? 0);
  return runValidationChecks("FORM16", [
    {
      condition: "TAXABLE_EQUALS_GROSS_MINUS_EXEMPTIONS_DEDUCTIONS",
      fieldName: "taxableIncome",
      actual: data.taxableIncome,
      expected: expectedTaxable,
      defaultMessage: "Taxable Income does not match Gross Salary minus exemptions/deductions/standard deduction.",
    },
    {
      condition: "TDS_LESS_THAN_OR_EQUAL_DEPOSITED",
      fieldName: "tdsDeducted",
      actual: data.tdsDeducted,
      expected: data.taxDeposited,
      defaultMessage: "TDS Deducted does not match Tax Deposited.",
    },
  ]);
}

async function createRecord(
  documentId: string,
  userId: string,
  financialYearCode: string,
  data: Partial<Form16Fields>,
  validationWarnings: string[],
) {
  const record = await prisma.form16Record.create({
    data: {
      documentId,
      userId,
      financialYearCode,
      assessmentYear: data.assessmentYear,
      employerName: data.employerName,
      employeeName: data.employeeName,
      pan: data.pan,
      tan: data.tan,
      grossSalary: data.grossSalary,
      exemptions: data.exemptions,
      deductions: data.deductions,
      professionalTax: data.professionalTax,
      standardDeduction: data.standardDeduction,
      employerNpsContribution: data.employerNpsContribution,
      taxableIncome: data.taxableIncome,
      tdsDeducted: data.tdsDeducted,
      taxDeposited: data.taxDeposited,
      rawExtractedJson: data,
      validationWarnings,
    },
  });

  await prisma.uploadedDocument.update({
    where: { id: documentId },
    data: { status: validationWarnings.length > 0 ? "PARSED" : "VALIDATED" },
  });
  await logAudit(userId, "CREATE", "Form16Record", record.id, { financialYearCode });

  return serializeDecimals(record, DECIMAL_FIELDS);
}

export const form16Service = {
  async import(userId: string, financialYearCode: string, fileName: string, mimeType: string, buffer: Buffer) {
    const document = await documentsService.upload(userId, "FORM16", financialYearCode, fileName, mimeType, buffer);

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
    if (doc.documentType !== "FORM16") throw AppError.notFound("Form 16 document not found");

    const existing = await prisma.form16Record.findUnique({ where: { documentId: doc.id } });
    if (existing) throw AppError.conflict("This document has already been imported.");

    const rawText = await extractDocumentText(doc.id, buffer, doc.mimeType, password);

    const { data, warnings: extractionWarnings } = parser.parse(rawText);
    const validationWarnings = [...extractionWarnings, ...(await validate(data))];

    return createRecord(doc.id, userId, doc.financialYearCode, data, validationWarnings);
  },


  async list(userId: string, financialYearCode?: string) {
    const records = await prisma.form16Record.findMany({
      where: { userId, ...(financialYearCode ? { financialYearCode } : {}) },
      include: { document: { select: { fileName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return records.map((r) => serializeDecimals(r, DECIMAL_FIELDS));
  },

  async getOwned(userId: string, id: string) {
    const record = await prisma.form16Record.findFirst({ where: { id, userId } });
    if (!record) throw AppError.notFound("Form 16 record not found");
    return serializeDecimals(record, DECIMAL_FIELDS);
  },

  async update(userId: string, id: string, input: UpdateForm16Input) {
    const existing = await this.getOwned(userId, id);
    const merged: Partial<Form16Fields> = { ...(existing.rawExtractedJson as Partial<Form16Fields>), ...input };
    const validationWarnings = await validate(merged);

    const updated = await prisma.form16Record.update({
      where: { id: existing.id },
      data: { ...input, isEdited: true, validationWarnings },
    });

    await prisma.uploadedDocument.update({
      where: { id: existing.documentId },
      data: { status: validationWarnings.length > 0 ? "PARSED" : "VALIDATED" },
    });
    await logAudit(userId, "UPDATE", "Form16Record", id, {});

    return serializeDecimals(updated, DECIMAL_FIELDS);
  },

  async remove(userId: string, id: string) {
    const existing = await this.getOwned(userId, id);
    await documentsService.remove(userId, existing.documentId);
  },
};
