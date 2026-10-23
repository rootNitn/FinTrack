import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiChatService, ChatHistoryEntry, ProposedAction } from '../../../core/services/ai-chat.service';
import { SettingsService } from '../../../features/settings/settings.service';
import { formatCurrency } from '../../utils/currency.util';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  isError?: boolean;
  proposedAction?: ProposedAction;
  actionResolved?: boolean;
}

const GREETING: ChatMessage = {
  role: 'assistant',
  text: "Hi! I'm your AI finance assistant. Ask me things like \"Why did my expenses increase this month?\", \"How can I save more tax?\", or \"Can I retire at 50?\"",
};

const MAX_HISTORY_ENTRIES = 10;

@Component({
  selector: 'app-ai-chat-widget',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './ai-chat-widget.component.html',
  styleUrl: './ai-chat-widget.component.scss',
})
export class AiChatWidgetComponent {
  private readonly aiChatService = inject(AiChatService);
  private readonly settingsService = inject(SettingsService);

  @ViewChild('scrollAnchor') scrollAnchor?: ElementRef<HTMLDivElement>;

  readonly open = signal(false);
  readonly sending = signal(false);
  readonly draft = signal('');
  readonly messages = signal<ChatMessage[]>([GREETING]);
  readonly confirmingAction = signal(false);
  // Defaults to visible so the widget doesn't flash away/in while the setting loads.
  readonly aiChatEnabled = signal(true);

  constructor() {
    this.settingsService.get().subscribe({
      next: (settings) => this.aiChatEnabled.set(settings.aiChatEnabled),
      error: () => {
        // Settings failed to load (e.g. not authenticated on a public page) — leave the widget visible by default.
      },
    });
  }

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  onDraftInput(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const text = this.draft().trim();
    if (!text || this.sending()) return;

    const history: ChatHistoryEntry[] = this.messages()
      .filter((m) => m !== GREETING && !m.isError)
      .slice(-MAX_HISTORY_ENTRIES)
      .map((m) => ({ role: m.role, text: m.text }));

    this.messages.update((msgs) => [...msgs, { role: 'user', text }]);
    this.draft.set('');
    this.sending.set(true);
    this.scrollToBottomSoon();

    this.aiChatService.sendMessage(text, history).subscribe({
      next: ({ reply, proposedAction }) => {
        this.messages.update((msgs) => [
          ...msgs,
          { role: 'assistant', text: reply ?? '', proposedAction },
        ]);
        this.sending.set(false);
        this.scrollToBottomSoon();
      },
      error: (err) => {
        const message = err?.error?.error?.message ?? 'Something went wrong. Please try again.';
        this.messages.update((msgs) => [...msgs, { role: 'assistant', text: message, isError: true }]);
        this.sending.set(false);
        this.scrollToBottomSoon();
      },
    });
  }

  confirmAction(msg: ChatMessage): void {
    const proposedAction = msg.proposedAction;
    if (!proposedAction || this.confirmingAction()) return;

    this.confirmingAction.set(true);
    this.aiChatService.confirmAction(proposedAction.action, proposedAction.arguments).subscribe({
      next: ({ message }) => {
        this.confirmingAction.set(false);
        msg.actionResolved = true;
        this.messages.update((msgs) => [...msgs, { role: 'assistant', text: message }]);
        this.scrollToBottomSoon();
      },
      error: (err) => {
        this.confirmingAction.set(false);
        const message = err?.error?.error?.message ?? 'Could not complete that action. Please try again.';
        this.messages.update((msgs) => [...msgs, { role: 'assistant', text: message, isError: true }]);
        this.scrollToBottomSoon();
      },
    });
  }

  dismissAction(msg: ChatMessage): void {
    msg.actionResolved = true;
  }

  actionSummary(action: ProposedAction): string {
    const amount = typeof action.arguments['amount'] === 'number' ? action.arguments['amount'] : null;
    const name = typeof action.arguments['name'] === 'string' ? action.arguments['name'] : null;
    if (action.action === 'create_expense' && amount !== null) {
      return `Log a ${formatCurrency(amount)} expense${action.arguments['category'] ? ` in ${action.arguments['category']}` : ''}.`;
    }
    if (action.action === 'create_income' && amount !== null) {
      return `Log income of ${formatCurrency(amount)}${action.arguments['source'] ? ` from ${action.arguments['source']}` : ''}.`;
    }
    if (action.action === 'create_goal' && name) {
      return `Create the savings goal "${name}".`;
    }
    return 'Review and confirm this requested change.';
  }

  private scrollToBottomSoon(): void {
    setTimeout(() => {
      this.scrollAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 0);
  }
}
