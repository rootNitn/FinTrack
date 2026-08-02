import { prisma } from "../../../config/prisma";
import { AppError } from "../../../utils/app-error";
import { extractText, PdfPasswordError } from "./text-extractor.service";

/**
 * Runs text extraction for an uploaded document, handling the "encrypted PDF" case uniformly
 * across all document-import modules (Salary Slip, Form 16, AIS, Form 26AS):
 *  - No/wrong password on an encrypted PDF -> marks the document `PASSWORD_REQUIRED` and throws a
 *    422 `AppError` with `details.code = "PASSWORD_REQUIRED"` so the frontend can prompt for a
 *    password (first attempt) or show "incorrect password, try again" (retry attempt) without
 *    needing the user to re-select the file.
 *  - Any other extraction failure -> marks the document `FAILED` and throws a generic 400.
 * `password`, when provided, is used only for this single in-memory decryption attempt — it is
 * never written to `parseErrors`, any other DB field, or a log call.
 */
export async function extractDocumentText(
  documentId: string,
  buffer: Buffer,
  mimeType: string,
  password?: string,
): Promise<string> {
  try {
    return await extractText(buffer, mimeType, password);
  } catch (err) {
    if (err instanceof PdfPasswordError) {
      await prisma.uploadedDocument.update({
        where: { id: documentId },
        data: { status: "PASSWORD_REQUIRED", parseErrors: { message: "Password required to open this PDF." } },
      });
      throw AppError.unprocessable(password ? "Incorrect password. Please try again." : "This PDF is password-protected.", {
        code: "PASSWORD_REQUIRED",
        documentId,
      });
    }

    await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: { status: "FAILED", parseErrors: { message: (err as Error).message } },
    });
    throw AppError.badRequest("Could not extract text from the uploaded file.");
  }
}
