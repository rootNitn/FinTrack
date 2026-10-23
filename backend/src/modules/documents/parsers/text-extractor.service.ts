import ExcelJS from "exceljs";
import { Readable } from "stream";
import { AppError } from "../../../utils/app-error";

const PDF_MIME = "application/pdf";
const IMAGE_MIMES = new Set(["image/jpeg", "image/png"]);
const EXCEL_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);
const CSV_MIME = "text/csv";

/**
 * Thrown when a PDF is encrypted and no password (or the wrong password) was supplied. Callers
 * use this to distinguish "needs a password" from any other extraction failure, without ever
 * inspecting or logging the password itself.
 */
export class PdfPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfPasswordError";
    Object.setPrototypeOf(this, PdfPasswordError.prototype);
  }
}

async function extractFromPdf(buffer: Buffer, password?: string): Promise<string> {
  // pdf-parse (built on pdf.js) needs a `CanvasFactory` in plain Node.js — its main module
  // references `DOMMatrix` at load time, so `pdf-parse/worker` (which polyfills it) MUST be
  // imported and fully resolved BEFORE `pdf-parse` itself, or `require("pdf-parse")` throws
  // "DOMMatrix is not defined" immediately (seen on real government AcroForm PDFs like Form 16).
  // See: https://github.com/mehmet-kozan/pdf-parse/blob/HEAD/docs/troubleshooting.md#1-dommatrix-is-not-defined
  // @ts-expect-error -- "pdf-parse/worker" resolves fine at runtime; TS2307 here is a moduleResolution-only false positive under this project's "node" setting.
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse, PasswordException } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer, CanvasFactory, ...(password ? { password } : {}) });
  try {
    const result = await parser.getText();
    return result.text;
  } catch (err) {
    if (err instanceof PasswordException) {
      throw new PdfPasswordError(password ? "Incorrect password." : "This PDF is password-protected.");
    }
    throw err;
  } finally {
    await parser.destroy();
  }
}

async function extractFromImage(buffer: Buffer): Promise<string> {
  const { recognize } = await import("tesseract.js");
  const result = await recognize(buffer, "eng");
  return result.data.text;
}

async function extractFromExcel(buffer: Buffer, isCsv: boolean): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  if (isCsv) {
    await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer as never);
  }

  const lines: string[] = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      const cells = (row.values as unknown[]).slice(1).map((v) => (v === null || v === undefined ? "" : String(v)));
      lines.push(cells.join(" \t "));
    });
  });
  return lines.join("\n");
}

/**
 * Extracts raw text from an uploaded tax document, routing to the appropriate
 * extraction mechanism based on MIME type. This is the single seam all
 * `DocumentParser<T>` implementations sit behind — swapping OCR/PDF engines
 * later only requires changes here. `password` is only used for a single in-memory decryption
 * attempt of an encrypted PDF — it is never persisted or logged by this function or its callers.
 */
export async function extractText(buffer: Buffer, mimeType: string, password?: string): Promise<string> {
  if (mimeType === PDF_MIME) return extractFromPdf(buffer, password);
  if (IMAGE_MIMES.has(mimeType)) return extractFromImage(buffer);
  if (EXCEL_MIMES.has(mimeType)) return extractFromExcel(buffer, false);
  if (mimeType === CSV_MIME) return extractFromExcel(buffer, true);
  throw AppError.badRequest(`Unsupported file type for text extraction: ${mimeType}`);
}
