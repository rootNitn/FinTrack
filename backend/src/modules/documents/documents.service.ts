import crypto from "crypto";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { logAudit } from "../../utils/audit-log.util";
import { encryptBuffer, decryptBuffer } from "../../utils/crypto";
import { Prisma, TaxDocumentType } from "@prisma/client";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function documentSummary(doc: {
  id: string;
  documentType: TaxDocumentType;
  financialYearCode: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentEncrypted: unknown;
  version: number;
  previousVersionId: string | null;
  status: string;
  parseErrors: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { contentEncrypted, ...rest } = doc;
  return rest;
}

export const documentsService = {
  async upload(
    userId: string,
    documentType: TaxDocumentType,
    financialYearCode: string,
    fileName: string,
    mimeType: string,
    buffer: Buffer,
  ) {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw AppError.badRequest(`Unsupported file type: ${mimeType}`);
    }
    if (buffer.length > MAX_FILE_BYTES) {
      throw AppError.badRequest("File exceeds the 10 MB upload limit");
    }

    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    const latest = await prisma.uploadedDocument.findFirst({
      where: { userId, documentType, financialYearCode },
      orderBy: { version: "desc" },
    });

    if (latest && latest.checksum === checksum) {
      throw AppError.conflict("This file is identical to the most recently uploaded version");
    }

    const created = await prisma.uploadedDocument.create({
      data: {
        userId,
        documentType,
        financialYearCode,
        fileName,
        mimeType,
        sizeBytes: buffer.length,
        contentEncrypted: encryptBuffer(buffer),
        checksum,
        version: latest ? latest.version + 1 : 1,
        previousVersionId: latest?.id,
        status: "UPLOADED",
      },
    });

    await logAudit(userId, "CREATE", "UploadedDocument", created.id, {
      documentType,
      financialYearCode,
      fileName,
      version: created.version,
    });

    return documentSummary(created);
  },

  async list(userId: string, filters: { documentType?: TaxDocumentType; financialYearCode?: string }) {
    const docs = await prisma.uploadedDocument.findMany({
      where: {
        userId,
        ...(filters.documentType ? { documentType: filters.documentType } : {}),
        ...(filters.financialYearCode ? { financialYearCode: filters.financialYearCode } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return docs.map(documentSummary);
  },

  async getOwned(userId: string, id: string) {
    const doc = await prisma.uploadedDocument.findFirst({ where: { id, userId } });
    if (!doc) throw AppError.notFound("Document not found");
    return doc;
  },

  async getDecryptedContent(userId: string, id: string) {
    const doc = await this.getOwned(userId, id);
    return {
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      buffer: decryptBuffer(doc.contentEncrypted as Buffer),
    };
  },

  /**
   * Like `getOwned`, but also decrypts the stored file content — used by the per-type import
   * services' `unlock()` methods to re-attempt extraction of a password-protected document
   * without requiring the user to re-select/re-upload the file.
   */
  async getOwnedWithBuffer(userId: string, id: string) {
    const doc = await this.getOwned(userId, id);
    return { doc, buffer: decryptBuffer(doc.contentEncrypted as Buffer) };
  },

  async versions(userId: string, id: string) {
    const doc = await this.getOwned(userId, id);
    const all = await prisma.uploadedDocument.findMany({
      where: { userId, documentType: doc.documentType, financialYearCode: doc.financialYearCode },
      orderBy: { version: "desc" },
    });
    return all.map(documentSummary);
  },

  async remove(userId: string, id: string) {
    const doc = await this.getOwned(userId, id);
    await prisma.uploadedDocument.delete({ where: { id: doc.id } });
    await logAudit(userId, "DELETE", "UploadedDocument", id, {
      documentType: doc.documentType,
      financialYearCode: doc.financialYearCode,
      fileName: doc.fileName,
    });
  },
};
