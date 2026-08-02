import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/ai-chat';

  sendMessage(message: string, history: ChatHistoryEntry[]): Observable<{ reply: string }> {
    return this.api.post<{ reply: string }>(`${this.basePath}/message`, { message, history });
  }
}
