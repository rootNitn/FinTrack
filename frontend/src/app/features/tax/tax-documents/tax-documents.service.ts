import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { TaxDocumentType, UploadedDocumentSummary } from './tax-document.model';

@Injectable({ providedIn: 'root' })
export class TaxDocumentsService {
  private readonly api = inject(ApiBaseService);

  upload(file: File, documentType: TaxDocumentType, financialYearCode: string): Observable<UploadedDocumentSummary> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    formData.append('financialYearCode', financialYearCode);
    return this.api.post<UploadedDocumentSummary>('/documents/upload', formData);
  }

  list(filters?: { documentType?: TaxDocumentType; financialYearCode?: string }): Observable<UploadedDocumentSummary[]> {
    return this.api.get<UploadedDocumentSummary[]>('/documents', filters);
  }

  versions(id: string): Observable<UploadedDocumentSummary[]> {
    return this.api.get<UploadedDocumentSummary[]>(`/documents/${id}/versions`);
  }

  preview(id: string): Observable<Blob> {
    return this.api.getBlob(`/documents/${id}/preview`);
  }

  download(id: string): Observable<Blob> {
    return this.api.getBlob(`/documents/${id}/download`);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/documents/${id}`);
  }
}
