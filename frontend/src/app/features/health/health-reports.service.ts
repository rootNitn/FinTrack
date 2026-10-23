import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import {
  HealthReportComparison,
  HealthReportDocument,
  HealthReportResult,
  HealthReportResultFormValue,
  HealthAiImproveResponse,
  HealthAiImproveRequest,
  HealthWellnessPlan,
  SaveHealthWellnessPlanRequest,
} from './health.model';

@Injectable({ providedIn: 'root' })
export class HealthReportsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/health/reports';

  upload(file: File, reportDate: string, testDate?: string, labName?: string, password?: string): Observable<HealthReportDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('reportDate', reportDate);
    if (testDate) formData.append('testDate', testDate);
    if (labName) formData.append('labName', labName);
    if (password) formData.append('password', password);
    return this.api.post<HealthReportDocument>(`${this.basePath}/upload`, formData);
  }

  list(): Observable<HealthReportDocument[]> {
    return this.api.get<HealthReportDocument[]>(this.basePath);
  }

  getById(id: string): Observable<HealthReportDocument> {
    return this.api.get<HealthReportDocument>(`${this.basePath}/${id}`);
  }

  update(id: string, payload: { reportDate?: string; testDate?: string | null; labName?: string }): Observable<HealthReportDocument> {
    return this.api.patch<HealthReportDocument>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }

  addResult(reportId: string, payload: HealthReportResultFormValue): Observable<HealthReportResult> {
    return this.api.post<HealthReportResult>(`${this.basePath}/${reportId}/results`, payload);
  }

  updateResult(reportId: string, resultId: string, payload: Partial<HealthReportResultFormValue>): Observable<HealthReportResult> {
    return this.api.patch<HealthReportResult>(`${this.basePath}/${reportId}/results/${resultId}`, payload);
  }

  removeResult(reportId: string, resultId: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${reportId}/results/${resultId}`);
  }

  listTestNames(): Observable<string[]> {
    return this.api.get<string[]>(`${this.basePath}/tests`);
  }

  compare(testName: string): Observable<HealthReportComparison> {
    return this.api.get<HealthReportComparison>(`${this.basePath}/compare`, { testName });
  }

  improveWithAi(request: HealthAiImproveRequest): Observable<HealthAiImproveResponse> {
    return this.api.post<HealthAiImproveResponse>('/health/ai-improve/improve', request);
  }

  saveWellnessPlan(payload: SaveHealthWellnessPlanRequest): Observable<HealthWellnessPlan> {
    return this.api.post<HealthWellnessPlan>('/health/ai-improve/plans', payload);
  }

  listWellnessPlans(): Observable<HealthWellnessPlan[]> {
    return this.api.get<HealthWellnessPlan[]>('/health/ai-improve/plans');
  }

  getWellnessPlan(id: string): Observable<HealthWellnessPlan> {
    return this.api.get<HealthWellnessPlan>(`/health/ai-improve/plans/${id}`);
  }

  getWellnessPlanForReport(reportId: string): Observable<HealthWellnessPlan | null> {
    return this.api.get<HealthWellnessPlan | null>(`/health/ai-improve/plans/report/${reportId}`);
  }

  regenerateWellnessPlan(id: string): Observable<HealthWellnessPlan> {
    return this.api.post<HealthWellnessPlan>(`/health/ai-improve/plans/${id}/regenerate`, {});
  }

  removeWellnessPlan(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/health/ai-improve/plans/${id}`);
  }
}
