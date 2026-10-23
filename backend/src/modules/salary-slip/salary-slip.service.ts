import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { logAudit } from "../../utils/audit-log.util";
import { documentsService } from "../documents/documents.service";
import { extractDocumentText } from "../documents/parsers/extraction-flow.util";
import { SalarySlipParser, SalarySlipFields } from "../documents/parsers/salary-slip.parser";
import { runValidationChecks } from "../documents/parsers/validation.util";
import { serializeDecimals } from "../documents/parsers/decimal.util";
import { UpdateSalarySlipInput } from "./salary-slip.dto";

const parser = new SalarySlipParser();

const DECIMAL_FIELDS = [
  "basicSalary",
  "hra",
  "specialAllowance",
  "conveyance",
  "medicalAllowance",
  "lta",
  "bonus",
  "commission",
  "employerPf",
  "employeePf",
  "professionalTax",
  "incomeTaxTds",
  "grossSalary",
  "netSalary",
  "otherAllowances",
] as const;

function sumComponents(data: Partial<SalarySlipFields>): number {
  return (
    (data.basicSalary ?? 0) +
    (data.hra ?? 0) +
    (data.specialAllowance ?? 0) +
    (data.conveyance ?? 0) +
    (data.medicalAllowance ?? 0) +
    (data.lta ?? 0) +
    (data.bonus ?? 0) +
    (data.commission ?? 0) +
    (data.otherAllowances ?? 0)
  );
}

async function validate(data: Partial<SalarySlipFields>): Promise<string[]> {
  const expectedNet = (data.grossSalary ?? 0) - (data.employeePf ?? 0) - (data.professionalTax ?? 0) - (data.incomeTaxTds ?? 0);
  return runValidationChecks("SALARY_SLIP", [
    {
      condition: "GROSS_EQUALS_SUM_OF_COMPONENTS",
      fieldName: "grossSalary",
      actual: data.grossSalary,
      expected: sumComponents(data),
      defaultMessage: "Gross Salary does not match the sum of its components.",
    },
    {
      condition: "NET_EQUALS_GROSS_MINUS_DEDUCTIONS",
      fieldName: "netSalary",
      actual: data.netSalary,
      expected: expectedNet,
      defaultMessage: "Net Salary does not match Gross Salary minus PF, Professional Tax and TDS.",
    },
  ]);
}

async function createRecord(
  documentId: string,
  userId: string,
  financialYearCode: string,
  data: Partial<SalarySlipFields>,
  validationWarnings: string[],
) {
  const record = await prisma.salarySlipRecord.create({
    data: {
      documentId,
      userId,
      financialYearCode,
      month: data.month,
      employeeName: data.employeeName,
      employerName: data.employerName,
      pan: data.pan,
      basicSalary: data.basicSalary,
      hra: data.hra,
      specialAllowance: data.specialAllowance,
      conveyance: data.conveyance,
      medicalAllowance: data.medicalAllowance,
      lta: data.lta,
      bonus: data.bonus,
      commission: data.commission,
      employerPf: data.employerPf,
      employeePf: data.employeePf,
      professionalTax: data.professionalTax,
      incomeTaxTds: data.incomeTaxTds,
      grossSalary: data.grossSalary,
      netSalary: data.netSalary,
      otherAllowances: data.otherAllowances,
      rawExtractedJson: data,
      validationWarnings,
    },
  });

  await prisma.uploadedDocument.update({
    where: { id: documentId },
    data: { status: validationWarnings.length > 0 ? "PARSED" : "VALIDATED" },
  });
  await logAudit(userId, "CREATE", "SalarySlipRecord", record.id, { financialYearCode });

  return serializeDecimals(record, DECIMAL_FIELDS);
}

export const salarySlipService = {
  async import(userId: string, financialYearCode: string, fileName: string, mimeType: string, buffer: Buffer) {
    const document = await documentsService.upload(userId, "SALARY_SLIP", financialYearCode, fileName, mimeType, buffer);

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
    if (doc.documentType !== "SALARY_SLIP") throw AppError.notFound("Salary slip document not found");

    const existing = await prisma.salarySlipRecord.findUnique({ where: { documentId: doc.id } });
    if (existing) throw AppError.conflict("This document has already been imported.");

    const rawText = await extractDocumentText(doc.id, buffer, doc.mimeType, password);

    const { data, warnings: extractionWarnings } = parser.parse(rawText);
    const validationWarnings = [...extractionWarnings, ...(await validate(data))];

    return createRecord(doc.id, userId, doc.financialYearCode, data, validationWarnings);
  },

  async list(userId: string, financialYearCode?: string) {
    const records = await prisma.salarySlipRecord.findMany({
      where: { userId, ...(financialYearCode ? { financialYearCode } : {}) },
      include: { document: { select: { fileName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return records.map((r) => serializeDecimals(r, DECIMAL_FIELDS));
  },

  async getOwned(userId: string, id: string) {
    const record = await prisma.salarySlipRecord.findFirst({ where: { id, userId } });
    if (!record) throw AppError.notFound("Salary slip record not found");
    return serializeDecimals(record, DECIMAL_FIELDS);
  },

  async update(userId: string, id: string, input: UpdateSalarySlipInput) {
    const existing = await this.getOwned(userId, id);
    const merged: Partial<SalarySlipFields> = { ...(existing.rawExtractedJson as Partial<SalarySlipFields>), ...input };
    const validationWarnings = await validate(merged);

    const updated = await prisma.salarySlipRecord.update({
      where: { id: existing.id },
      data: { ...input, isEdited: true, validationWarnings },
    });

    await prisma.uploadedDocument.update({
      where: { id: existing.documentId },
      data: { status: validationWarnings.length > 0 ? "PARSED" : "VALIDATED" },
    });
    await logAudit(userId, "UPDATE", "SalarySlipRecord", id, {});

    return serializeDecimals(updated, DECIMAL_FIELDS);
  },

  async remove(userId: string, id: string) {
    const existing = await this.getOwned(userId, id);
    await documentsService.remove(userId, existing.documentId);
  },
};
