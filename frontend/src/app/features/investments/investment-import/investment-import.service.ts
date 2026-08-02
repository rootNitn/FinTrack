import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { ApiSuccessResponse } from '../../../core/models/api-response.model';
import {
  GenericCsvMapping,
  ImportColumnsResponse,
  ImportCommitResponse,
  ImportFailedRow,
  ImportHistoryRecord,
  ImportParseResponse,
} from './investment-import.model';

/** Emitted while the file uploads; `percent` covers only the upload phase (0-100). */
export interface UploadProgressEvent {
  type: 'progress';
  percent: number;
}

export interface UploadDoneEvent {
  type: 'done';
  result: ImportParseResponse;
}

export type ParseEvent = UploadProgressEvent | UploadDoneEvent;

@Injectable({ providedIn: 'root' })
export class InvestmentImportService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiBaseService);
  private readonly baseUrl = environment.apiUrl;

  /** Uploads + parses the statement, reporting upload progress along the way. */
  parse(file: File): Observable<ParseEvent> {
    const formData = new FormData();
    formData.append('file', file);

    return new Observable<ParseEvent>((subscriber) => {
      const sub = this.http
        .post<ApiSuccessResponse<ImportParseResponse>>(`${this.baseUrl}/investment-imports/parse`, formData, {
          reportProgress: true,
          observe: 'events',
        })
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              subscriber.next({ type: 'progress', percent: Math.round((event.loaded / event.total) * 100) });
            } else if (event.type === HttpEventType.Response && event.body) {
              subscriber.next({ type: 'done', result: event.body.data });
              subscriber.complete();
            }
          },
          error: (err) => subscriber.error(err),
        });
      return () => sub.unsubscribe();
    });
  }

  /** Returns the column headers + sample rows for a file that didn't match any known broker format. */
  columns(file: File): Observable<ImportColumnsResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<ApiSuccessResponse<ImportColumnsResponse>>(`${this.baseUrl}/investment-imports/columns`, formData)
      .pipe(map((res) => res.data));
  }

  /** Parses a file using a user-supplied column mapping (the generic CSV import flow). */
  parseMapped(file: File, mapping: GenericCsvMapping): Observable<ImportParseResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));
    return this.http
      .post<ApiSuccessResponse<ImportParseResponse>>(`${this.baseUrl}/investment-imports/parse-mapped`, formData)
      .pipe(map((res) => res.data));
  }

  commit(payload: {
    fileName: string;
    provider: string;
    rows: ImportParseResponse['rows'];
    category?: string;
    goalId?: string;
  }): Observable<ImportCommitResponse> {
    return this.api.post<ImportCommitResponse>('/investment-imports/commit', payload);
  }

  history(): Observable<ImportHistoryRecord[]> {
    return this.api.get<ImportHistoryRecord[]>('/investment-imports/history');
  }

  exportFailedRows(rows: ImportFailedRow[]): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/investment-imports/export-failed`, { rows }, { responseType: 'blob' });
  }
}
