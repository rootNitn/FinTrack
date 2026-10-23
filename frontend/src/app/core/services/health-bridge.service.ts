import { Injectable, inject } from '@angular/core';
import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { ApiBaseService } from './api-base.service';
import { environment } from '../../../environments/environment';

export interface NativeHealthStatus {
  schemaVersion: number;
  provider: string;
  available: boolean;
  sdkStatus: number;
  backgroundReadAvailable: boolean;
  backgroundReadGranted: boolean;
  grantedMetrics: string[];
  deviceName: string;
  timezone: string;
}
export interface NativeSyncStatus {
  schemaVersion: number;
  state: string;
  reasonCode: string;
  syncSupported: boolean;
  recordsSynced: number;
  connectionId: string | null;
  generation: number;
  enabledMetrics: string[];
  lastSuccessfulSyncAt?: string | null;
  lastAttemptedSyncAt?: string | null;
  attemptId?: string;
}
interface HealthBridgePlugin {
  getHealthConnectionStatus(): Promise<NativeHealthStatus>;
  getSyncStatus(): Promise<NativeSyncStatus>;
  requestPermissions(options: { metrics: string[]; background: boolean; consent: boolean }): Promise<NativeHealthStatus>;
  connectHealth(options: { connectionId: string; generation: number; enabledMetrics: string[]; apiBaseUrl: string; backgroundRequested: boolean }): Promise<NativeSyncStatus>;
  disconnectHealth(): Promise<NativeSyncStatus>;
  syncNow(): Promise<NativeSyncStatus>;
  openPermissionSettings(): Promise<void>;
  addListener(event: 'permissionsChanged', callback: () => void): Promise<PluginListenerHandle>;
}
const bridge = registerPlugin<HealthBridgePlugin>('HealthBridge');
interface SessionVaultBridge { refreshSession(options: { apiBaseUrl: string }): Promise<import('../models/auth.model').AuthResponse> }
const sessionVault = registerPlugin<SessionVaultBridge>('SessionVault');

@Injectable({ providedIn: 'root' })
export class HealthBridgeService {
  private readonly api = inject(ApiBaseService);
  readonly available = Capacitor.getPlatform() === 'android';
  async status(): Promise<{ health: NativeHealthStatus; sync: NativeSyncStatus } | null> {
    if (!this.available) return null;
    const [health, sync] = await Promise.all([bridge.getHealthConnectionStatus(), bridge.getSyncStatus()]);
    return { health, sync };
  }
  requestPermissions(metrics: string[], background: boolean, consent: boolean) {
    if (!this.available) return Promise.reject(new Error('Android health permissions are unavailable'));
    return bridge.requestPermissions({ metrics, background, consent });
  }
  connectHealth(connectionId: string, generation: number, enabledMetrics: string[], backgroundRequested: boolean) {
    return bridge.connectHealth({ connectionId, generation, enabledMetrics, apiBaseUrl: environment.apiUrl, backgroundRequested });
  }
  disconnectHealth() { return bridge.disconnectHealth(); }
  syncNow() { return bridge.syncNow(); }
  refreshSession(apiBaseUrl: string) { return sessionVault.refreshSession({ apiBaseUrl }); }
  async disconnectForLogout(): Promise<void> {
    if (!this.available) return;
    const connectionId = await bridge.getSyncStatus().then(status => status.connectionId).catch(() => null);
    try {
      if (connectionId) await firstValueFrom(this.api.delete(`/health/connections/${connectionId}`));
    } finally {
      await bridge.disconnectHealth();
    }
  }
  openPermissionSettings() { return bridge.openPermissionSettings(); }
  onPermissionsChanged(callback: () => void) { return bridge.addListener('permissionsChanged', callback); }
}