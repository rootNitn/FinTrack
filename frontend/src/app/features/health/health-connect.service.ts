import { Injectable, inject } from '@angular/core';
import { ApiBaseService } from '../../core/services/api-base.service';

export type ConnectedMetric = 'STEPS' | 'SLEEP' | 'EXERCISE' | 'WEIGHT' | 'HEART_RATE';
export interface HealthMetricProvenance {
  source: 'MANUAL' | 'HEALTH_CONNECT' | 'NONE';
  primarySource: string | null;
  recordCount: number;
}
export interface HealthConnection {
  id: string;
  generation: number;
  deviceName: string;
  timezone: string;
  enabledMetrics: ConnectedMetric[];
  grantedMetrics: ConnectedMetric[];
  primarySources: Partial<Record<ConnectedMetric, string>>;
  backgroundReadAvailable: boolean;
  backgroundReadGranted: boolean;
  disconnectedAt: string | null;
  status: string;
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt: string | null;
  syncCompletedAt: string | null;
  recordsSynced: number;
  manualRequestedAt: string | null;
  errorCode: string | null;
}
export interface ImportedHealthDay {
  date: string;
  steps: number | null;
  sleepMinutes: number | null;
  exerciseMinutes: number | null;
  weightKg: number | null;
  averageHeartRate: number | null;
  aggregationVersion: number;
  provenance: Record<ConnectedMetric, HealthMetricProvenance>;
}
export interface HealthDailyResponse {
  connectionId: string | null;
  timezone: string;
  today: string;
  primarySources: Partial<Record<ConnectedMetric, string>>;
  sources: Record<ConnectedMetric, string[]>;
  days: ImportedHealthDay[];
}
export interface HealthConnectionStatus { connection: HealthConnection | null; lastRun: unknown }

@Injectable({ providedIn: 'root' })
export class HealthConnectService {
  private readonly api = inject(ApiBaseService);
  status() { return this.api.get<HealthConnectionStatus>('/health/sync/status'); }
  connect(body: { deviceName: string; timezone: string; enabledMetrics: ConnectedMetric[]; grantedMetrics: ConnectedMetric[]; backgroundReadGranted: boolean; backgroundReadAvailable: boolean; consent: true }) {
    return this.api.post<HealthConnection>('/health/connections', body);
  }
  daily(days: number) { return this.api.get<HealthDailyResponse>('/health/daily', { days }); }
  updatePrimarySources(id: string, primarySources: Partial<Record<ConnectedMetric, string | null>>) {
    return this.api.put<HealthConnection>(`/health/connections/${id}/sources`, { primarySources });
  }
  sync(id: string) { return this.api.post<{ message: string }>(`/health/sync/${id}/manual`, {}); }
  disconnect(id: string) { return this.api.delete(`/health/connections/${id}`); }
  remove(id: string) { return this.api.delete<{ message: string }>(`/health/data/${id}`); }
}