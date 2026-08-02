import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse, PaginationMeta } from '../models/api-response.model';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

function toHttpParams(params?: QueryParams): HttpParams {
  let httpParams = new HttpParams();
  if (!params) return httpParams;
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      httpParams = httpParams.set(key, String(value));
    }
  }
  return httpParams;
}

/**
 * Thin typed wrapper around HttpClient that targets the backend API base URL
 * and unwraps the `{ success, data, meta }` envelope returned by every endpoint.
 */
@Injectable({ providedIn: 'root' })
export class ApiBaseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http
      .get<ApiSuccessResponse<T>>(`${this.baseUrl}${path}`, { params: toHttpParams(params) })
      .pipe(map((res) => res.data));
  }

  getWithMeta<T>(path: string, params?: QueryParams): Observable<{ data: T; meta?: PaginationMeta }> {
    return this.http
      .get<ApiSuccessResponse<T>>(`${this.baseUrl}${path}`, { params: toHttpParams(params) })
      .pipe(map((res) => ({ data: res.data, meta: res.meta })));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<ApiSuccessResponse<T>>(`${this.baseUrl}${path}`, body).pipe(map((res) => res.data));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<ApiSuccessResponse<T>>(`${this.baseUrl}${path}`, body).pipe(map((res) => res.data));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<ApiSuccessResponse<T>>(`${this.baseUrl}${path}`, body).pipe(map((res) => res.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<ApiSuccessResponse<T>>(`${this.baseUrl}${path}`).pipe(map((res) => res.data));
  }

  /** For file downloads (Excel/PDF/CSV export) — returns the raw Blob, bypassing the JSON envelope. */
  getBlob(path: string, params?: QueryParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}${path}`, { params: toHttpParams(params), responseType: 'blob' });
  }

  /** Same as `getBlob` but POSTs a body — used when the export needs a full payload (e.g. an
   * unsaved calculation) rather than simple query params. */
  postBlob(path: string, body: unknown): Observable<Blob> {
    return this.http.post(`${this.baseUrl}${path}`, body, { responseType: 'blob' });
  }
}
