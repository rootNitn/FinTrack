/**
 * Single source of truth for landing-page pricing/feature marketing copy.
 * Prices are placeholders — update here only, never hard-code prices elsewhere.
 */

export interface PricingPlan {
  id: 'free' | 'plus' | 'pro';
  name: string;
  tagline: string;
  /** Monthly price in INR. 0 = free. */
  monthlyPrice: number;
  /** Full-year price in INR (billed yearly). 0 = free. */
  yearlyPrice: number;
  ctaLabel: string;
  features: string[];
  highlighted?: boolean;
}

export const PAID_PLAN_CHECKOUT_ENABLED = false;

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Start understanding your money today',
    monthlyPrice: 0,
    yearlyPrice: 0,
    ctaLabel: 'Get Started Free',
    features: ['Dashboard', 'Income & Expenses', 'Transactions', 'Basic Goals', 'Basic Investment Tracking', 'Calendar'],
  },
  {
    id: 'plus',
    name: 'Plus',
    tagline: 'For serious, ongoing money management',
    monthlyPrice: 199,
    yearlyPrice: 1990,
    ctaLabel: 'Start Plus',
    highlighted: true,
    features: [
      'Everything in Free',
      'Advanced Analytics',
      'Investment Comparison',
      'Advanced Investment Analytics',
      'Financial Health',
      'Financial Progress',
      'Financial Independence Planning',
      'Advanced Reports',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'The complete financial command center',
    monthlyPrice: 399,
    yearlyPrice: 3990,
    ctaLabel: 'Start Pro',
    features: [
      'Everything in Plus',
      'AI Financial Assistant',
      'Tax Planning',
      'Advanced AI Insights',
      'Specialized Tax Calculators',
      'Tax Document Management',
    ],
  },
];

/** Returns the % saved by paying yearly vs. 12x the monthly price, or null if not actually cheaper. */
export function yearlySavingsPercent(plan: PricingPlan): number | null {
  if (plan.monthlyPrice <= 0 || plan.yearlyPrice <= 0) return null;
  const fullYearAtMonthlyRate = plan.monthlyPrice * 12;
  if (plan.yearlyPrice >= fullYearAtMonthlyRate) return null;
  return Math.round(((fullYearAtMonthlyRate - plan.yearlyPrice) / fullYearAtMonthlyRate) * 100);
}

export interface ComparisonRow {
  feature: string;
  free: boolean;
  plus: boolean;
  pro: boolean;
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: 'Dashboard', free: true, plus: true, pro: true },
  { feature: 'Transactions', free: true, plus: true, pro: true },
  { feature: 'Income', free: true, plus: true, pro: true },
  { feature: 'Expenses', free: true, plus: true, pro: true },
  { feature: 'Goals', free: true, plus: true, pro: true },
  { feature: 'Investments', free: true, plus: true, pro: true },
  { feature: 'Analytics', free: false, plus: true, pro: true },
  { feature: 'Financial Health', free: false, plus: true, pro: true },
  { feature: 'Financial Progress', free: false, plus: true, pro: true },
  { feature: 'Investment Comparison', free: false, plus: true, pro: true },
  { feature: 'AI Assistant', free: false, plus: false, pro: true },
  { feature: 'Tax Planning', free: false, plus: false, pro: true },
  { feature: 'Financial Independence Planning', free: false, plus: true, pro: true },
  { feature: 'Specialized Tax Calculators', free: false, plus: false, pro: true },
  { feature: 'Tax Document Management', free: false, plus: false, pro: true },
  { feature: 'Advanced Reports', free: false, plus: true, pro: true },
];

export interface FeatureCard {
  icon: string;
  title: string;
  description: string;
}

export const FEATURE_CARDS: FeatureCard[] = [
  { icon: 'account_balance_wallet', title: 'Money Management', description: 'Track income, expenses and transactions in one connected ledger.' },
  { icon: 'account_balance', title: 'Net Worth', description: 'See your tracked financial position — assets minus liabilities — in one view.' },
  { icon: 'show_chart', title: 'Investments', description: 'Track mutual funds, stocks, FD, PPF, NPS, EPF, gold, bonds and other assets, with live price refresh and broker import.' },
  { icon: 'flag', title: 'Goals', description: 'Create financial goals and track measurable progress toward each one.' },
  { icon: 'favorite', title: 'Financial Health', description: 'Understand savings, debt, emergency funds and overall financial strength.' },
  { icon: 'call_split', title: 'Income Diversification', description: 'See how dependent you are on a single income source.' },
  { icon: 'trending_up', title: 'Financial Progress', description: 'Understand your current financial level and what to improve next.' },
  { icon: 'flight_takeoff', title: 'Financial Independence', description: 'See your FI number, your progress toward it, and how much of your expenses passive income covers.' },
  { icon: 'smart_toy', title: 'AI Financial Assistant', description: 'Ask questions about your finances and get insights from your recorded data.' },
  { icon: 'compare_arrows', title: 'Investment Comparison', description: 'Compare investment options side-by-side using relevant metrics.' },
  { icon: 'sync_alt', title: 'Bank Accounts & Reconciliation', description: 'Track multiple bank accounts and reconcile statements against your recorded transactions.' },
  { icon: 'credit_card', title: 'Credit Cards', description: 'Track utilization, statements, payments, rewards/cashback and due-date reminders across every card.' },
  { icon: 'savings', title: 'Fixed Deposits', description: 'Compare rates across providers, track your FD portfolio, and manage renewals or premature withdrawals.' },
  { icon: 'request_quote', title: 'Loans & EMI', description: 'Track loans with a full EMI amortization schedule and a prepayment what-if calculator.' },
  { icon: 'health_and_safety', title: 'Insurance', description: 'Track health, life and other policies and see whether your coverage is actually adequate.' },
  { icon: 'pie_chart', title: 'Budgets', description: 'Set monthly or category budgets and get alerted before you overspend.' },
  { icon: 'groups', title: 'Family Finances', description: 'Tag expenses, investments and goals by family member to understand household activity in your account.' },
  { icon: 'event_repeat', title: 'Upcoming Bills', description: 'Track EMIs, credit-card payments, SIPs, insurance renewals and other obligations.' },
  { icon: 'calendar_month', title: 'Calendar', description: 'Review upcoming financial dates and scheduled obligations in one calendar view.' },
  { icon: 'notifications_active', title: 'Notifications & Reminders', description: 'Get reminded about EMIs, SIPs, credit card dues, FD maturity, insurance renewals and more.' },
  { icon: 'query_stats', title: 'Analytics', description: 'Understand spending, savings, investment and net-worth trends over time.' },
  { icon: 'summarize', title: 'Reports & Exports', description: 'Generate monthly, quarterly, yearly, investment, expense and goal reports — export as Excel, CSV or PDF.' },
  { icon: 'receipt_long', title: 'Tax Planning', description: 'Compare old vs new regimes, import documents, and get tax-saving suggestions with Excel/PDF export.' },
  { icon: 'calculate', title: 'Financial Calculators', description: 'SIP, EMI, retirement, FIRE and 15+ other what-if calculators.' },
  { icon: 'monitor_heart', title: 'Health & Wellness Tracker', description: 'Track vitals, workouts, medications, appointments and lab reports alongside your finances.' },
  { icon: 'phone_android', title: 'Android App (In Development)', description: 'A mobile Android version with finance workflows and optional Health Connect support is in development; it is not yet available as a public release.' },
  { icon: 'store', title: 'Business Operations', description: 'Manage manufacturing, retail and service workflows with inventory, sales, receivables and double-entry accounting.' },
  { icon: 'lock', title: 'Security & Backup', description: 'Bank and card numbers are encrypted at rest; back up or restore your data and delete your account from Settings.' },
  { icon: 'support_agent', title: 'Help Desk', description: 'Report issues, ask questions, or send suggestions — with AI-assisted answers for quick questions.' },
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What is this application?',
    answer:
      'LifeTrack is a personal financial command center — it combines expense tracking, investment tracking, goal planning, financial health scoring and an AI assistant in one place.',
  },
  {
    question: 'Is the Android app available?',
    answer: 'The Android app is in development. A public Google Play release is not available yet.',
  },
  {
    question: 'Is it free?',
    answer: 'Yes. The Free plan covers the dashboard, income & expenses, transactions, goals, calendar and basic investment tracking with no time limit. Analytics is included in Plus.',
  },
  {
    question: 'Can I track investments?',
    answer: 'Yes — mutual funds, stocks, fixed deposits, PPF, EPF, NPS, gold, bonds, real estate and other assets are all supported.',
  },
  {
    question: 'Can I track multiple income sources?',
    answer: 'Yes. Record salary, business, freelance, rental, interest, dividend and other income, and see how diversified your income is.',
  },
  {
    question: 'Can I track family finances?',
    answer: 'Yes — you can link expenses, investments and goals to family members and review the breakdown in your account.',
  },
  {
    question: 'Can I import financial data?',
    answer: 'Yes. Investment holdings can be imported from supported broker exports, with a review step before anything is saved.',
  },
  {
    question: 'Is my financial data private?',
    answer: 'Your data is isolated to your account, sensitive fields such as bank and card numbers are encrypted at rest, and sessions are secured with short-lived access tokens plus rotating refresh tokens.',
  },
  {
    question: 'Can I export my data?',
    answer: 'Yes — the Reports module supports exporting data as Excel, CSV or PDF.',
  },
  {
    question: 'Can I cancel a paid plan?',
    answer: 'Paid-plan checkout is not available yet, so no paid plan can currently be purchased or cancelled.',
  },
  {
    question: 'Does AI provide financial advice?',
    answer: 'No. The AI assistant explains patterns in your own recorded data. It does not provide regulated financial, investment, tax or legal advice.',
  },
  {
    question: 'What happens if I stop my subscription?',
    answer: 'Your existing data remains yours. Paid-plan checkout is not available yet, so there are no active paid subscriptions to stop.',
  },
];
