export type TaxDocumentType =
  | 'SALARY_SLIP'
  | 'FORM16'
  | 'AIS'
  | 'FORM26AS'
  | 'CAPITAL_GAINS_STATEMENT'
  | 'OTHER';

export const TAX_DOCUMENT_TYPE_LABELS: Record<TaxDocumentType, string> = {
  SALARY_SLIP: 'Salary Slip',
  FORM16: 'Form 16',
  AIS: 'AIS / TIS',
  FORM26AS: 'Form 26AS',
  CAPITAL_GAINS_STATEMENT: 'Capital Gains Statement',
  OTHER: 'Other',
};

export interface UploadedDocumentSummary {
  id: string;
  documentType: TaxDocumentType;
  financialYearCode: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  previousVersionId: string | null;
  status: 'UPLOADED' | 'PARSED' | 'VALIDATED' | 'FAILED';
  parseErrors: unknown;
  createdAt: string;
  updatedAt: string;
}
