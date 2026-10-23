import { Injectable, signal } from '@angular/core';
import { HealthAiImproveRequest, HealthAiImproveResponse } from '../health.model';

/** Holds a freshly-generated (not yet saved) wellness plan in memory while the user is
 * navigated from the report detail page to the full wellness-plan page. */
@Injectable({ providedIn: 'root' })
export class HealthWellnessDraftStoreService {
  private readonly draft = signal<{ content: HealthAiImproveResponse; request: HealthAiImproveRequest } | null>(null);

  set(content: HealthAiImproveResponse, request: HealthAiImproveRequest): void {
    this.draft.set({ content, request });
  }

  take(): { content: HealthAiImproveResponse; request: HealthAiImproveRequest } | null {
    const value = this.draft();
    this.draft.set(null);
    return value;
  }
}
