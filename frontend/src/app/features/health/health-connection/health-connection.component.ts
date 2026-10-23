import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin, timer } from 'rxjs';
import { EChartsCoreOption } from 'echarts/core';
import { ConnectedMetric, HealthConnectService, HealthConnection, HealthDailyResponse, ImportedHealthDay } from '../health-connect.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { CHART_PALETTE } from '../../../shared/charts/chart-style.util';
import { ToastService } from '../../../core/services/toast.service';
import { HealthBridgeService, NativeHealthStatus, NativeSyncStatus } from '../../../core/services/health-bridge.service';

@Component({
  selector: 'app-health-connection',
  imports: [CommonModule, FormsModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatInputModule, MatIconModule, MatTooltipModule, MatCheckboxModule, MatSelectModule, ChartCardComponent, KpiCardComponent],
  templateUrl: './health-connection.component.html',
})
export class HealthConnectionComponent {
  private readonly service = inject(HealthConnectService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly bridge = inject(HealthBridgeService);
  private disposed = false;
  readonly nativeAvailable = this.bridge.available;
  readonly nativeStatus = signal<{ health: NativeHealthStatus; sync: NativeSyncStatus } | null>(null);
  readonly nativeError = signal<string | null>(null);
  readonly nativeSelected = signal<string[]>([]);
  readonly nativeBackground = signal(false);
  readonly nativeConsent = signal(false);
  readonly nativeBusy = signal(false);
  readonly connection = signal<HealthConnection | null>(null);
  readonly daily = signal<HealthDailyResponse | null>(null);
  readonly primarySourceSelection = signal<Partial<Record<HealthConnection['enabledMetrics'][number], string>>>({});
  readonly sourcePreferencesDirty = signal(false);
  readonly sourceSaving = signal(false);
  readonly days = signal(30);
  readonly selectedDate = signal('');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly metrics: { key: keyof Omit<ImportedHealthDay, 'date' | 'aggregationVersion' | 'provenance'>; metric: ConnectedMetric; title: string; unit: string; icon: string }[] = [
    { key: 'steps', metric: 'STEPS', title: 'Steps', unit: '', icon: 'directions_walk' },
    { key: 'sleepMinutes', metric: 'SLEEP', title: 'Sleep', unit: 'min', icon: 'bedtime' },
    { key: 'exerciseMinutes', metric: 'EXERCISE', title: 'Exercise', unit: 'min', icon: 'fitness_center' },
    { key: 'weightKg', metric: 'WEIGHT', title: 'Weight', unit: 'kg', icon: 'monitor_weight' },
    { key: 'averageHeartRate', metric: 'HEART_RATE', title: 'Average heart rate', unit: 'bpm', icon: 'favorite' },
  ];
  readonly selected = computed(() => this.daily()?.days.find(day => day.date === this.selectedDate()) ?? null);
  readonly weeklySteps = computed(() => {
    const today = this.daily()?.today;
    if (!today) return null;
    const start = new Date(`${today}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 6);
    const values = this.daily()!.days.filter(day => day.date >= start.toISOString().slice(0, 10) && day.steps !== null).map(day => day.steps!);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  });
  readonly latestWeight = computed(() => [...(this.daily()?.days ?? [])].reverse().find(day => day.weightKg !== null)?.weightKg ?? null);
  readonly stale = computed(() => {
    const last = this.connection()?.syncCompletedAt;
    return !!last && Date.now() - new Date(last).getTime() > 24 * 60 * 60 * 1000;
  });
  readonly charts = computed(() => this.metrics.map((metric, index) => {
    const values = this.daily()?.days ?? [];
    const options: EChartsCoreOption | null = values.some(day => day[metric.key] !== null) ? {
      tooltip: { trigger: 'axis' },
      grid: { left: 12, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: values.map(day => day.date) },
      yAxis: { type: 'value', name: metric.unit },
      series: [{ type: 'line', connectNulls: false, data: values.map(day => day[metric.key]), itemStyle: { color: CHART_PALETTE[index] } }],
    } : null;
    return { ...metric, options };
  }));

  constructor() {
    this.destroyRef.onDestroy(() => { this.disposed = true; });
    if (this.nativeAvailable) {
      void this.checkNativeStatus();
      void this.bridge.onPermissionsChanged(() => { void this.checkNativeStatus(); }).then(listener => {
        if (this.disposed) void listener.remove();
        else this.destroyRef.onDestroy(() => { void listener.remove(); });
      }).catch(() => undefined);
    }
    timer(0, 30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.load();
      if (this.nativeAvailable) void this.checkNativeStatus();
    });
  }
  async checkNativeStatus(): Promise<void> {
    try { this.nativeStatus.set(await this.bridge.status()); this.nativeError.set(null); }
    catch { this.nativeError.set('Android health status is unavailable.'); }
  }
  selectNativeMetric(metric: string, selected: boolean): void {
    this.nativeSelected.update(values => selected ? [...new Set([...values, metric])] : values.filter(value => value !== metric));
  }
  async requestNativePermissions(): Promise<void> {
    if (!this.nativeConsent() || !this.nativeSelected().length || this.nativeBusy()) return;
    this.nativeBusy.set(true);
    try {
      await this.bridge.requestPermissions(this.nativeSelected(), this.nativeBackground(), this.nativeConsent());
      await this.checkNativeStatus();
      const granted = this.nativeStatus()?.health.grantedMetrics ?? [];
      if (this.nativeSelected().some(metric => !granted.includes(metric))) this.nativeError.set('Some selected permissions were not granted.');
    } catch { this.nativeError.set('Permissions could not be requested. Check Health Connect availability.'); }
    finally { this.nativeBusy.set(false); }
  }
  async connectNativeHealth(): Promise<void> {
    const native = this.nativeStatus();
    const selected = this.nativeSelected();
    if (!native?.health.available || !this.nativeConsent() || !selected.length || this.nativeBusy()) return;
    const grantedMetrics = selected.filter(metric => native.health.grantedMetrics.includes(metric)) as HealthConnection['enabledMetrics'];
    if (!grantedMetrics.length) { this.nativeError.set('Grant at least one selected metric before connecting.'); return; }
    this.nativeBusy.set(true);
    let connection: HealthConnection | null = null;
    try {
      connection = await new Promise<HealthConnection>((resolve, reject) => this.service.connect({
        deviceName: native.health.deviceName,
        timezone: native.health.timezone,
        enabledMetrics: selected as HealthConnection['enabledMetrics'],
        grantedMetrics,
        backgroundReadGranted: this.nativeBackground() && native.health.backgroundReadGranted,
        backgroundReadAvailable: native.health.backgroundReadAvailable,
        consent: true,
      }).subscribe({ next: resolve, error: reject }));
      const sync = await this.bridge.connectHealth(connection.id, connection.generation, connection.enabledMetrics, this.nativeBackground());
      this.nativeStatus.set({ health: native.health, sync });
      await this.load();
      this.nativeError.set(null);
    } catch {
      if (connection) this.service.disconnect(connection.id).subscribe({ error: () => undefined });
      this.nativeError.set('Health connection could not be completed.');
    } finally { this.nativeBusy.set(false); }
  }
  async disconnectNativeHealth(): Promise<void> {
    if (this.nativeBusy()) return;
    this.nativeBusy.set(true);
    const connection = this.nativeStatus()?.sync.connectionId;
    try {
      if (connection) await new Promise<void>((resolve, reject) => this.service.disconnect(connection).subscribe({ next: () => resolve(), error: reject }));
      const sync = await this.bridge.disconnectHealth();
      const health = this.nativeStatus()?.health;
      if (health) this.nativeStatus.set({ health, sync });
      this.nativeError.set(null);
      await this.load();
    } catch { this.nativeError.set('The health connection could not be disconnected.'); }
    finally { this.nativeBusy.set(false); }
  }
  async syncNativeHealthNow(): Promise<void> {
    if (!this.nativeStatus()?.sync.connectionId || this.nativeBusy()) return;
    this.nativeBusy.set(true);
    this.nativeError.set(null);
    try {
      const status = await this.bridge.syncNow();
      this.nativeStatus.update(current => current ? { ...current, sync: status } : current);
    } catch { this.nativeError.set('Health sync could not complete. Check network, permissions and sign-in status.'); }
    finally { this.nativeBusy.set(false); await this.checkNativeStatus(); }
  }
  async openNativePermissions(): Promise<void> {
    try { await this.bridge.openPermissionSettings(); }
    catch { this.nativeError.set('Android permission settings are unavailable.'); }
  }
  load(): void {
    forkJoin({ status: this.service.status(), daily: this.service.daily(this.days()) }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ status, daily }) => {
        this.connection.set(status.connection);
        this.daily.set(daily);
        if (!this.sourcePreferencesDirty()) this.primarySourceSelection.set({ ...daily.primarySources });
        if (!this.selectedDate()) this.selectedDate.set(daily.today);
        this.error.set(null); this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Phone health data could not be loaded.'); },
    });
  }
  changeRange(value: number): void { this.days.set(Number(value)); this.load(); }
  moveDay(offset: number): void {
    const date = new Date(`${this.selectedDate()}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    const next = date.toISOString().slice(0, 10);
    if (next <= this.daily()!.today) this.selectedDate.set(next);
  }
  value(day: ImportedHealthDay | null, key: keyof Omit<ImportedHealthDay, 'date'>, unit: string): string {
    const value = day?.[key];
    return value === null || value === undefined ? 'No data available' : `${value.toLocaleString('en-IN', { maximumFractionDigits: 1 })}${unit ? ' ' + unit : ''}`;
  }
  selectPrimarySource(metric: HealthConnection['enabledMetrics'][number], source: string): void {
    this.primarySourceSelection.update(current => {
      const next = { ...current };
      if (source) next[metric] = source;
      else delete next[metric];
      return next;
    });
    this.sourcePreferencesDirty.set(true);
  }
  savePrimarySources(): void {
    const id = this.connection()?.id;
    if (!id || this.sourceSaving() || !this.sourcePreferencesDirty()) return;
    this.sourceSaving.set(true);
    this.service.updatePrimarySources(id, this.primarySourceSelection()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.sourceSaving.set(false);
        this.sourcePreferencesDirty.set(false);
        this.toast.success('Health data sources updated.');
        this.load();
      },
      error: () => {
        this.sourceSaving.set(false);
        this.toast.error('Health data sources could not be updated.');
      },
    });
  }
  provenanceLabel(day: ImportedHealthDay | null, metric: HealthConnection['enabledMetrics'][number]): string {
    const provenance = day?.provenance?.[metric];
    if (!provenance || provenance.source === 'NONE') return 'No selected source data';
    if (provenance.source === 'MANUAL') return 'Manual entry';
    return `${provenance.primarySource ?? 'Health Connect'} · ${provenance.recordCount} record(s)`;
  }
  requestSync(): void {
    const id = this.connection()?.id;
    if (!id || this.busy()) return;
    this.busy.set(true);
    this.service.sync(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.busy.set(false); this.toast.success(result.message); this.load(); },
      error: () => { this.busy.set(false); this.toast.error('Sync could not be requested.'); },
    });
  }
  permissionDetails(): void {
    this.confirm.open({ title: 'Health Connect permissions', message: 'Open LifeTrack Health on your Android phone to select metrics and manage or revoke Health Connect permissions. Automatic sync requires supported background-read access. Only selected, permitted data is imported.' }).subscribe();
  }
  disconnect(remove: boolean): void {
    const id = this.connection()?.id;
    if (!id || this.busy()) return;
    this.confirm.open({ title: remove ? 'Delete imported health data?' : 'Disconnect Health Connect?', message: remove ? 'Imported records and summaries will be deleted and sync disconnected. Manual entries and Health Connect originals are kept.' : 'Further uploads will be blocked. Existing imported data is kept. You can also revoke permissions on your phone.' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      if (!confirmed) return;
      this.busy.set(true);
      const request = remove ? this.service.remove(id) : this.service.disconnect(id);
      request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => { this.busy.set(false); this.load(); this.toast.success(remove ? 'Imported data deleted.' : 'Health Connect disconnected.'); },
        error: () => { this.busy.set(false); this.toast.error('The operation could not complete.'); },
      });
    });
  }
}