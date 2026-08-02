/** Number of days before a statement's due date that it starts showing up in "due soon" reminders. */
export const CC_DUE_SOON_DAYS = 5;

/** Utilization percentage thresholds used to classify a card's risk level. */
export const CC_UTILIZATION_THRESHOLDS = {
  moderate: 30,
  high: 50,
  critical: 75,
};

export const CARD_NETWORK_LABELS: Record<string, string> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  RUPAY: "RuPay",
  AMEX: "American Express",
  DINERS: "Diners Club",
  OTHER: "Other",
};

export const STATEMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

export type UtilizationLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
