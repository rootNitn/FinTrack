export type TicketType = 'ERROR' | 'SUGGESTION' | 'DOUBT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export const TICKET_TYPES: { value: TicketType; label: string; icon: string; hint: string }[] = [
  { value: 'DOUBT', label: 'Question / Doubt', icon: 'help', hint: 'Get an instant AI-generated answer.' },
  { value: 'SUGGESTION', label: 'Suggestion', icon: 'lightbulb', hint: 'Share an idea to improve the app.' },
  { value: 'ERROR', label: 'Report an Error', icon: 'bug_report', hint: 'Report a bug or something not working.' },
];

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  ERROR: 'Error',
  SUGGESTION: 'Suggestion',
  DOUBT: 'Doubt',
};

export const TICKET_TYPE_ICONS: Record<TicketType, string> = {
  ERROR: 'bug_report',
  SUGGESTION: 'lightbulb',
  DOUBT: 'help',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const TICKET_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export interface SupportTicket {
  id: string;
  userId: string;
  type: TicketType;
  subject: string;
  description: string;
  status: TicketStatus;
  aiResponse: string | null;
  adminResponse: string | null;
  errorContext: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string };
}

export interface CreateTicketPayload {
  type: TicketType;
  subject: string;
  description: string;
  errorContext?: Record<string, unknown>;
}

export interface UpdateTicketAdminPayload {
  status?: TicketStatus;
  adminResponse?: string;
}

export interface TicketListParams {
  page?: number;
  limit?: number;
  type?: TicketType;
  status?: TicketStatus;
}
