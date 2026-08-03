import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  text: string;
}

export interface ProposedAction {
  action: string;
  label: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessageResponse {
  reply: string | null;
  proposedAction?: ProposedAction;
}

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/ai-chat';

  sendMessage(message: string, history: ChatHistoryEntry[]): Observable<ChatMessageResponse> {
    return this.api.post<ChatMessageResponse>(`${this.basePath}/message`, { message, history });
  }

  confirmAction(action: string, args: Record<string, unknown>): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`${this.basePath}/confirm-action`, { action, arguments: args });
  }
}
