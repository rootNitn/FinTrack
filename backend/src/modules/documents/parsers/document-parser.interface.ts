/**
 * Contract every document-type parser implements. Keeps extraction logic
 * (Salary Slip, Form16, AIS, Form26AS, ...) fully pluggable per Feature 20's
 * "Future Ready" requirement — new document types only need a new
 * `DocumentParser<T>` implementation, no changes to the extraction pipeline.
 */
export interface ParseOutcome<T> {
  data: Partial<T>;
  warnings: string[];
}

export interface DocumentParser<T> {
  /** Parses raw extracted text (from PDF/OCR/spreadsheet) into structured fields. */
  parse(rawText: string): ParseOutcome<T>;
}
