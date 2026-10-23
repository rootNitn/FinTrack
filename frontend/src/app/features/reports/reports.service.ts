import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService, QueryParams } from '../../core/services/api-base.service';
import { Report, ReportQuery } from './reports.model';

export interface AiImprovement {
  title: string;
  category: 'FINANCE' | 'HEALTH' | 'TIME';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  whyItMatters: string;
  currentSituation: string;
  recommendedAction: string;
  expectedBenefit: string;
  supportingDataLink?: string;
  actionLink?: string;
}

export interface AiReportImproveResponse {
  overallScore: number;
  summary: string;
  topImprovements: AiImprovement[];
  financialImprovements: AiImprovement[];
  healthImprovements: AiImprovement[];
  timeImprovements: AiImprovement[];
  thirtyDayPlan: {
    week1: string[];
    week2: string[];
    week3: string[];
    week4: string[];
  };
  finalRecommendation: string;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/reports';

  generate(query: ReportQuery): Observable<Report> {
    return this.api.get<Report>(this.basePath, query as unknown as QueryParams);
  }

  exportExcel(query: ReportQuery): Observable<Blob> {
    return this.api.getBlob(`${this.basePath}/export/excel`, query as unknown as QueryParams);
  }

  exportCsv(query: ReportQuery): Observable<Blob> {
    return this.api.getBlob(`${this.basePath}/export/csv`, query as unknown as QueryParams);
  }

  exportPdf(query: ReportQuery): Observable<Blob> {
    return this.api.getBlob(`${this.basePath}/export/pdf`, query as unknown as QueryParams);
  }

  improveWithAi(query: ReportQuery): Observable<AiReportImproveResponse> {
    return this.api.post<AiReportImproveResponse>('/ai-report/improve', {
      reportType: query.type,
      month: query.month,
      quarter: query.quarter,
      year: query.year,
    });
  }
}
