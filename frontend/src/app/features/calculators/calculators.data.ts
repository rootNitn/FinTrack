import { CalculatorDefinition } from './calculators.model';
import {
  chartFromRows,
  compoundYearlyBreakdown,
  emiAmount,
  formatCurrency,
  formatNumber,
  formatPercent,
  futureValueOfSip,
  loanYearlyBreakdown,
  sipYearlyBreakdown,
} from './calculators.util';

const COMPOUNDING_OPTIONS = [
  { value: 1, label: 'Annually' },
  { value: 2, label: 'Half-Yearly' },
  { value: 4, label: 'Quarterly' },
  { value: 12, label: 'Monthly' },
];

const NEW_REGIME_SLABS = [
  { upTo: 300000, rate: 0 },
  { upTo: 700000, rate: 5 },
  { upTo: 1000000, rate: 10 },
  { upTo: 1200000, rate: 15 },
  { upTo: 1500000, rate: 20 },
  { upTo: Infinity, rate: 30 },
];

function slabWiseTax(taxableIncome: number): { tax: number; rows: Record<string, string | number>[] } {
  let remaining = Math.max(taxableIncome, 0);
  let prevLimit = 0;
  let tax = 0;
  const rows: Record<string, string | number>[] = [];
  for (const slab of NEW_REGIME_SLABS) {
    if (remaining <= 0) break;
    const slabWidth = slab.upTo - prevLimit;
    const amountInSlab = Math.min(remaining, slabWidth);
    const slabTax = (amountInSlab * slab.rate) / 100;
    if (amountInSlab > 0) {
      rows.push({
        slab: slab.upTo === Infinity ? `Above ${formatCurrency(prevLimit)}` : `${formatCurrency(prevLimit)} – ${formatCurrency(slab.upTo)}`,
        rate: `${slab.rate}%`,
        tax: formatCurrency(slabTax),
      });
    }
    tax += slabTax;
    remaining -= amountInSlab;
    prevLimit = slab.upTo;
  }
  return { tax, rows };
}

export const CALCULATORS: CalculatorDefinition[] = [
  {
    slug: 'sip',
    title: 'SIP Calculator',
    shortDescription: 'Estimate the maturity value of a fixed monthly investment.',
    category: 'Investment',
    icon: 'trending_up',
    fields: [
      { key: 'monthlyInvestment', label: 'Monthly Investment', type: 'currency', default: 5000, min: 100 },
      { key: 'expectedReturn', label: 'Expected Return (p.a.)', type: 'percent', default: 12, min: 0, max: 40 },
      { key: 'tenureYears', label: 'Investment Period', type: 'years', default: 10, min: 1, max: 40 },
    ],
    compute: (v) => {
      const months = Math.round(v['tenureYears'] * 12);
      const invested = v['monthlyInvestment'] * months;
      const value = futureValueOfSip(v['monthlyInvestment'], v['expectedReturn'], months);
      const rows = sipYearlyBreakdown(v['monthlyInvestment'], v['expectedReturn'], v['tenureYears']);
      return {
        summary: [
          { label: 'Invested Amount', value: formatCurrency(invested) },
          { label: 'Estimated Returns', value: formatCurrency(value - invested) },
          { label: 'Total Value', value: formatCurrency(value), highlight: true },
        ],
        chart: chartFromRows(rows, 'year', [
          { key: 'invested', name: 'Invested' },
          { key: 'value', name: 'Value' },
        ]),
        breakdownTitle: 'Year-wise Growth',
        breakdownColumns: [
          { key: 'year', header: 'Year' },
          { key: 'invested', header: 'Invested' },
          { key: 'gain', header: 'Gain' },
          { key: 'value', header: 'Value' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'step-up-sip',
    title: 'Step-Up SIP Calculator',
    shortDescription: 'Project SIP growth when you increase your contribution every year.',
    category: 'Investment',
    icon: 'stacked_line_chart',
    fields: [
      { key: 'monthlyInvestment', label: 'Starting Monthly Investment', type: 'currency', default: 5000, min: 100 },
      { key: 'annualStepUp', label: 'Annual Step-Up', type: 'percent', default: 10, min: 0, max: 100 },
      { key: 'expectedReturn', label: 'Expected Return (p.a.)', type: 'percent', default: 12, min: 0, max: 40 },
      { key: 'tenureYears', label: 'Investment Period', type: 'years', default: 10, min: 1, max: 40 },
    ],
    compute: (v) => {
      const i = v['expectedReturn'] / 12 / 100;
      const years = Math.max(Math.round(v['tenureYears']), 0);
      let balance = 0;
      let invested = 0;
      let currentMonthly = v['monthlyInvestment'];
      const rows: Record<string, string | number>[] = [];
      for (let y = 1; y <= years; y++) {
        const yearlyMonthly = currentMonthly;
        const stepUpAmount = y === 1 ? 0 : (currentMonthly / (1 + v['annualStepUp'] / 100)) * (v['annualStepUp'] / 100);
        for (let m = 0; m < 12; m++) {
          balance = (balance + currentMonthly) * (1 + i);
          invested += currentMonthly;
        }
        rows.push({ year: y, monthlyInvestment: formatCurrency(yearlyMonthly), stepUp: formatCurrency(stepUpAmount), invested: formatCurrency(invested), value: formatCurrency(balance), gain: formatCurrency(balance - invested) });
        currentMonthly = currentMonthly * (1 + v['annualStepUp'] / 100);
      }
      return {
        summary: [
          { label: 'Total Invested', value: formatCurrency(invested) },
          { label: 'Estimated Returns', value: formatCurrency(balance - invested) },
          { label: 'Maturity Value', value: formatCurrency(balance), highlight: true },
        ],
        chart: chartFromRows(rows, 'year', [
          { key: 'invested', name: 'Invested' },
          { key: 'value', name: 'Value' },
        ]),
        breakdownTitle: 'Year-wise Growth',
        breakdownColumns: [
          { key: 'year', header: 'Year' },
          { key: 'monthlyInvestment', header: 'Monthly Investment' },
          { key: 'stepUp', header: 'Annual Step-Up' },
          { key: 'invested', header: 'Invested' },
          { key: 'gain', header: 'Gain' },
          { key: 'value', header: 'Value' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'lumpsum',
    title: 'Lumpsum Calculator',
    shortDescription: 'See how a one-time investment grows over time.',
    category: 'Investment',
    icon: 'account_balance_wallet',
    fields: [
      { key: 'investmentAmount', label: 'Investment Amount', type: 'currency', default: 100000, min: 1000 },
      { key: 'expectedReturn', label: 'Expected Return (p.a.)', type: 'percent', default: 12, min: 0, max: 40 },
      { key: 'tenureYears', label: 'Investment Period', type: 'years', default: 10, min: 1, max: 40 },
      { key: 'compounding', label: 'Compounding Frequency', type: 'select', default: 1, options: COMPOUNDING_OPTIONS },
    ],
    compute: (v) => {
      const n = v['compounding'];
      const value = v['investmentAmount'] * Math.pow(1 + v['expectedReturn'] / 100 / n, n * v['tenureYears']);
      const rows = compoundYearlyBreakdown(v['investmentAmount'], v['expectedReturn'], v['tenureYears'], n);
      return {
        summary: [
          { label: 'Invested Amount', value: formatCurrency(v['investmentAmount']) },
          { label: 'Estimated Returns', value: formatCurrency(value - v['investmentAmount']) },
          { label: 'Maturity Value', value: formatCurrency(value), highlight: true },
        ],
        chart: chartFromRows(rows, 'year', [{ key: 'value', name: 'Value' }]),
        breakdownTitle: 'Year-wise Growth',
        breakdownColumns: [
          { key: 'year', header: 'Year' },
          { key: 'interest', header: 'Gain' },
          { key: 'value', header: 'Value' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'swp',
    title: 'SWP Calculator',
    shortDescription: 'Plan a systematic withdrawal plan from an existing corpus.',
    category: 'Investment',
    icon: 'payments',
    fields: [
      { key: 'totalInvestment', label: 'Total Investment', type: 'currency', default: 1000000, min: 1000 },
      { key: 'monthlyWithdrawal', label: 'Monthly Withdrawal', type: 'currency', default: 10000, min: 100 },
      { key: 'expectedReturn', label: 'Expected Return (p.a.)', type: 'percent', default: 8, min: 0, max: 40 },
      { key: 'tenureYears', label: 'Withdrawal Period', type: 'years', default: 10, min: 1, max: 40 },
    ],
    compute: (v) => {
      const i = v['expectedReturn'] / 12 / 100;
      const months = Math.max(Math.round(v['tenureYears'] * 12), 0);
      let balance = v['totalInvestment'];
      let totalWithdrawn = 0;
      let depletedMonth: number | null = null;
      const rows: Record<string, string | number>[] = [];
      for (let m = 1; m <= months; m++) {
        if (balance > 0) {
          balance -= v['monthlyWithdrawal'];
          totalWithdrawn += v['monthlyWithdrawal'];
          if (balance < 0) {
            depletedMonth = depletedMonth ?? m;
            balance = 0;
          } else {
            balance *= 1 + i;
          }
        }
        if (m % 12 === 0) {
          rows.push({ year: m / 12, withdrawn: formatCurrency(totalWithdrawn), balance: formatCurrency(balance) });
        }
      }
      return {
        summary: [
          { label: 'Total Withdrawn', value: formatCurrency(totalWithdrawn) },
          { label: 'Final Balance', value: formatCurrency(balance), highlight: true },
          {
            label: 'Corpus Lasts',
            value: depletedMonth ? `${Math.floor(depletedMonth / 12)} yrs ${depletedMonth % 12} mo` : `${formatNumber(v['tenureYears'])}+ yrs`,
          },
        ],
        chart: chartFromRows(rows, 'year', [
          { key: 'withdrawn', name: 'Withdrawn' },
          { key: 'balance', name: 'Balance' },
        ]),
        breakdownTitle: 'Year-wise Balance',
        breakdownColumns: [
          { key: 'year', header: 'Year' },
          { key: 'withdrawn', header: 'Withdrawn' },
          { key: 'balance', header: 'Balance' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'fd',
    title: 'FD Calculator',
    shortDescription: 'Calculate the maturity value of a Fixed Deposit.',
    category: 'Savings',
    icon: 'savings',
    fields: [
      { key: 'principal', label: 'Principal Amount', type: 'currency', default: 100000, min: 1000 },
      { key: 'interestRate', label: 'Interest Rate (p.a.)', type: 'percent', default: 7, min: 0, max: 20 },
      { key: 'tenureYears', label: 'Tenure', type: 'years', default: 5, min: 1, max: 30 },
      { key: 'compounding', label: 'Compounding Frequency', type: 'select', default: 4, options: COMPOUNDING_OPTIONS },
    ],
    compute: (v) => {
      const n = v['compounding'];
      const value = v['principal'] * Math.pow(1 + v['interestRate'] / 100 / n, n * v['tenureYears']);
      const rows = compoundYearlyBreakdown(v['principal'], v['interestRate'], v['tenureYears'], n);
      return {
        summary: [
          { label: 'Invested Amount', value: formatCurrency(v['principal']) },
          { label: 'Interest Earned', value: formatCurrency(value - v['principal']) },
          { label: 'Maturity Value', value: formatCurrency(value), highlight: true },
        ],
        chart: chartFromRows(rows, 'year', [{ key: 'value', name: 'Value' }]),
        breakdownTitle: 'Year-wise Growth',
        breakdownColumns: [
          { key: 'year', header: 'Year' },
          { key: 'interest', header: 'Interest' },
          { key: 'value', header: 'Value' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'rd',
    title: 'RD Calculator',
    shortDescription: 'Calculate the maturity value of a Recurring Deposit.',
    category: 'Savings',
    icon: 'event_repeat',
    fields: [
      { key: 'monthlyDeposit', label: 'Monthly Deposit', type: 'currency', default: 5000, min: 100 },
      { key: 'interestRate', label: 'Interest Rate (p.a.)', type: 'percent', default: 7, min: 0, max: 20 },
      { key: 'tenureYears', label: 'Tenure', type: 'years', default: 5, min: 1, max: 15 },
    ],
    compute: (v) => {
      const months = Math.round(v['tenureYears'] * 12);
      const invested = v['monthlyDeposit'] * months;
      const value = futureValueOfSip(v['monthlyDeposit'], v['interestRate'], months);
      const rows = sipYearlyBreakdown(v['monthlyDeposit'], v['interestRate'], v['tenureYears']);
      return {
        summary: [
          { label: 'Invested Amount', value: formatCurrency(invested) },
          { label: 'Interest Earned', value: formatCurrency(value - invested) },
          { label: 'Maturity Value', value: formatCurrency(value), highlight: true },
        ],
        chart: chartFromRows(rows, 'year', [
          { key: 'invested', name: 'Invested' },
          { key: 'value', name: 'Value' },
        ]),
        breakdownTitle: 'Year-wise Growth',
        breakdownColumns: [
          { key: 'year', header: 'Year' },
          { key: 'invested', header: 'Invested' },
          { key: 'gain', header: 'Interest' },
          { key: 'value', header: 'Value' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'emi',
    title: 'EMI Calculator',
    shortDescription: 'Calculate the equated monthly installment for any loan.',
    category: 'Loan',
    icon: 'calculate',
    fields: [
      { key: 'loanAmount', label: 'Loan Amount', type: 'currency', default: 1000000, min: 1000 },
      { key: 'interestRate', label: 'Interest Rate (p.a.)', type: 'percent', default: 9, min: 0, max: 30 },
      { key: 'tenureYears', label: 'Loan Tenure', type: 'years', default: 20, min: 1, max: 30 },
    ],
    compute: (v) => {
      const months = Math.round(v['tenureYears'] * 12);
      const emi = emiAmount(v['loanAmount'], v['interestRate'], months);
      const totalPayment = emi * months;
      const rows = loanYearlyBreakdown(v['loanAmount'], v['interestRate'], months);
      return {
        summary: [
          { label: 'Monthly EMI', value: formatCurrency(emi), highlight: true },
          { label: 'Total Interest', value: formatCurrency(totalPayment - v['loanAmount']) },
          { label: 'Total Payment', value: formatCurrency(totalPayment) },
        ],
        chart: chartFromRows(
          rows,
          'year',
          [
            { key: 'principalPaid', name: 'Principal Paid' },
            { key: 'interestPaid', name: 'Interest Paid' },
          ],
          'bar',
          true
        ),
        breakdownTitle: 'Year-wise Amortization',
        breakdownColumns: [
          { key: 'year', header: 'Year' },
          { key: 'principalPaid', header: 'Principal Paid' },
          { key: 'interestPaid', header: 'Interest Paid' },
          { key: 'balance', header: 'Balance' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'home-loan',
    title: 'Home Loan Calculator',
    shortDescription: 'Estimate your home loan EMI from the property value and down payment.',
    category: 'Loan',
    icon: 'home',
    fields: [
      { key: 'propertyValue', label: 'Property Value', type: 'currency', default: 5000000, min: 100000 },
      { key: 'downPayment', label: 'Down Payment', type: 'currency', default: 1000000, min: 0 },
      { key: 'interestRate', label: 'Interest Rate (p.a.)', type: 'percent', default: 8.5, min: 0, max: 20 },
      { key: 'tenureYears', label: 'Loan Tenure', type: 'years', default: 20, min: 1, max: 30 },
    ],
    compute: (v) => {
      const loanAmount = Math.max(v['propertyValue'] - v['downPayment'], 0);
      const months = Math.round(v['tenureYears'] * 12);
      const emi = emiAmount(loanAmount, v['interestRate'], months);
      const totalPayment = emi * months;
      const rows = loanYearlyBreakdown(loanAmount, v['interestRate'], months);
      return {
        summary: [
          { label: 'Loan Amount', value: formatCurrency(loanAmount) },
          { label: 'Monthly EMI', value: formatCurrency(emi), highlight: true },
          { label: 'Total Interest', value: formatCurrency(totalPayment - loanAmount) },
          { label: 'Total Payment', value: formatCurrency(totalPayment) },
        ],
        chart: chartFromRows(
          rows,
          'year',
          [
            { key: 'principalPaid', name: 'Principal Paid' },
            { key: 'interestPaid', name: 'Interest Paid' },
          ],
          'bar',
          true
        ),
        breakdownTitle: 'Year-wise Amortization',
        breakdownColumns: [
          { key: 'year', header: 'Year' },
          { key: 'principalPaid', header: 'Principal Paid' },
          { key: 'interestPaid', header: 'Interest Paid' },
          { key: 'balance', header: 'Balance' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'personal-loan',
    title: 'Personal Loan Calculator',
    shortDescription: 'Calculate EMI and total interest on a personal loan.',
    category: 'Loan',
    icon: 'person',
    fields: [
      { key: 'loanAmount', label: 'Loan Amount', type: 'currency', default: 500000, min: 1000 },
      { key: 'interestRate', label: 'Interest Rate (p.a.)', type: 'percent', default: 12, min: 0, max: 36 },
      { key: 'tenureYears', label: 'Loan Tenure', type: 'years', default: 5, min: 1, max: 7 },
    ],
    compute: (v) => {
      const months = Math.round(v['tenureYears'] * 12);
      const emi = emiAmount(v['loanAmount'], v['interestRate'], months);
      const totalPayment = emi * months;
      const rows = loanYearlyBreakdown(v['loanAmount'], v['interestRate'], months);
      return {
        summary: [
          { label: 'Monthly EMI', value: formatCurrency(emi), highlight: true },
          { label: 'Total Interest', value: formatCurrency(totalPayment - v['loanAmount']) },
          { label: 'Total Payment', value: formatCurrency(totalPayment) },
        ],
        chart: chartFromRows(
          rows,
          'year',
          [
            { key: 'principalPaid', name: 'Principal Paid' },
            { key: 'interestPaid', name: 'Interest Paid' },
          ],
          'bar',
          true
        ),
        breakdownTitle: 'Year-wise Amortization',
        breakdownColumns: [
          { key: 'year', header: 'Year' },
          { key: 'principalPaid', header: 'Principal Paid' },
          { key: 'interestPaid', header: 'Interest Paid' },
          { key: 'balance', header: 'Balance' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'compound-interest',
    title: 'Compound Interest Calculator',
    shortDescription: 'Calculate compound interest on a principal amount.',
    category: 'Investment',
    icon: 'functions',
    fields: [
      { key: 'principal', label: 'Principal Amount', type: 'currency', default: 100000, min: 1000 },
      { key: 'interestRate', label: 'Interest Rate (p.a.)', type: 'percent', default: 10, min: 0, max: 40 },
      { key: 'tenureYears', label: 'Time Period', type: 'years', default: 10, min: 1, max: 40 },
      { key: 'compounding', label: 'Compounding Frequency', type: 'select', default: 1, options: COMPOUNDING_OPTIONS },
    ],
    compute: (v) => {
      const n = v['compounding'];
      const value = v['principal'] * Math.pow(1 + v['interestRate'] / 100 / n, n * v['tenureYears']);
      const rows = compoundYearlyBreakdown(v['principal'], v['interestRate'], v['tenureYears'], n);
      return {
        summary: [
          { label: 'Principal', value: formatCurrency(v['principal']) },
          { label: 'Compound Interest', value: formatCurrency(value - v['principal']) },
          { label: 'Total Amount', value: formatCurrency(value), highlight: true },
        ],
        chart: chartFromRows(rows, 'year', [{ key: 'value', name: 'Value' }]),
        breakdownTitle: 'Year-wise Growth',
        breakdownColumns: [
          { key: 'year', header: 'Year' },
          { key: 'interest', header: 'Interest' },
          { key: 'value', header: 'Value' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'cagr',
    title: 'CAGR Calculator',
    shortDescription: 'Compute the Compound Annual Growth Rate between two values.',
    category: 'Investment',
    icon: 'show_chart',
    fields: [
      { key: 'initialValue', label: 'Initial Value', type: 'currency', default: 100000, min: 1 },
      { key: 'finalValue', label: 'Final Value', type: 'currency', default: 250000, min: 1 },
      { key: 'tenureYears', label: 'Time Period', type: 'years', default: 5, min: 1, max: 40 },
    ],
    compute: (v) => {
      const cagr = (Math.pow(v['finalValue'] / v['initialValue'], 1 / v['tenureYears']) - 1) * 100;
      const growth = v['finalValue'] - v['initialValue'];
      return {
        summary: [
          { label: 'Absolute Growth', value: formatCurrency(growth) },
          { label: 'Absolute Growth %', value: formatPercent((growth / v['initialValue']) * 100) },
          { label: 'CAGR', value: formatPercent(cagr), highlight: true },
        ],
        chart: {
          type: 'bar',
          categories: ['Initial Value', 'Final Value'],
          series: [{ name: 'Value', data: [v['initialValue'], v['finalValue']] }],
        },
      };
    },
  },
  {
    slug: 'roi',
    title: 'ROI Calculator',
    shortDescription: 'Calculate the return on investment, absolute and annualized.',
    category: 'Investment',
    icon: 'percent',
    fields: [
      { key: 'investedAmount', label: 'Invested Amount', type: 'currency', default: 100000, min: 1 },
      { key: 'currentValue', label: 'Current Value', type: 'currency', default: 150000, min: 0 },
      { key: 'tenureYears', label: 'Holding Period', type: 'years', default: 3, min: 0.1, max: 40, step: 0.1 },
    ],
    compute: (v) => {
      const gain = v['currentValue'] - v['investedAmount'];
      const roi = (gain / v['investedAmount']) * 100;
      const annualizedRoi = (Math.pow(v['currentValue'] / v['investedAmount'], 1 / v['tenureYears']) - 1) * 100;
      return {
        summary: [
          { label: 'Net Gain', value: formatCurrency(gain) },
          { label: 'ROI', value: formatPercent(roi), highlight: true },
          { label: 'Annualized ROI', value: formatPercent(annualizedRoi) },
        ],
        chart: {
          type: 'bar',
          categories: ['Invested Amount', 'Current Value'],
          series: [{ name: 'Value', data: [v['investedAmount'], v['currentValue']] }],
        },
      };
    },
  },
  {
    slug: 'retirement',
    title: 'Retirement Calculator',
    shortDescription: 'Estimate the corpus you need to retire and the SIP required to get there.',
    category: 'Planning',
    icon: 'beach_access',
    fields: [
      { key: 'currentAge', label: 'Current Age', type: 'years', default: 30, min: 18, max: 70 },
      { key: 'retirementAge', label: 'Retirement Age', type: 'years', default: 60, min: 19, max: 75 },
      { key: 'lifeExpectancy', label: 'Life Expectancy', type: 'years', default: 85, min: 20, max: 100 },
      { key: 'monthlyExpense', label: 'Current Monthly Expense', type: 'currency', default: 50000, min: 1000 },
      { key: 'inflationRate', label: 'Inflation Rate', type: 'percent', default: 6, min: 0, max: 15 },
      { key: 'preReturn', label: 'Return Before Retirement (p.a.)', type: 'percent', default: 12, min: 0, max: 30 },
      { key: 'postReturn', label: 'Return After Retirement (p.a.)', type: 'percent', default: 7, min: 0, max: 20 },
    ],
    compute: (v) => {
      const yearsToRetirement = Math.max(v['retirementAge'] - v['currentAge'], 0);
      const yearsInRetirement = Math.max(v['lifeExpectancy'] - v['retirementAge'], 1);
      const futureMonthlyExpense = v['monthlyExpense'] * Math.pow(1 + v['inflationRate'] / 100, yearsToRetirement);
      const annualExpense = futureMonthlyExpense * 12;
      const realReturn = (1 + v['postReturn'] / 100) / (1 + v['inflationRate'] / 100) - 1;
      const corpusNeeded =
        Math.abs(realReturn) < 1e-6
          ? annualExpense * yearsInRetirement
          : annualExpense * ((1 - Math.pow(1 + realReturn, -yearsInRetirement)) / realReturn);
      const months = Math.round(yearsToRetirement * 12);
      const i = v['preReturn'] / 12 / 100;
      const growthFactor = months > 0 && i !== 0 ? ((Math.pow(1 + i, months) - 1) / i) * (1 + i) : months;
      const monthlySipRequired = growthFactor > 0 ? corpusNeeded / growthFactor : corpusNeeded;
      const rows = sipYearlyBreakdown(monthlySipRequired, v['preReturn'], yearsToRetirement);
      return {
        summary: [
          { label: 'Future Monthly Expense', value: formatCurrency(futureMonthlyExpense) },
          { label: 'Retirement Corpus Needed', value: formatCurrency(corpusNeeded), highlight: true },
          { label: 'Monthly SIP Required', value: formatCurrency(monthlySipRequired) },
        ],
        chart: chartFromRows(rows, 'year', [
          { key: 'invested', name: 'Invested' },
          { key: 'value', name: 'Value' },
        ]),
        breakdownTitle: 'Projected SIP Growth',
        breakdownColumns: [
          { key: 'year', header: 'Year' },
          { key: 'invested', header: 'Invested' },
          { key: 'value', header: 'Value' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'fire',
    title: 'FIRE Calculator',
    shortDescription: 'Find out how many years to Financial Independence, Retire Early.',
    category: 'Planning',
    icon: 'local_fire_department',
    fields: [
      { key: 'currentAge', label: 'Current Age', type: 'years', default: 30, min: 18, max: 70 },
      { key: 'annualExpenses', label: 'Current Annual Expenses', type: 'currency', default: 600000, min: 10000 },
      { key: 'currentSavings', label: 'Current Investments', type: 'currency', default: 500000, min: 0 },
      { key: 'monthlyInvestment', label: 'Monthly Investment', type: 'currency', default: 25000, min: 0 },
      { key: 'expectedReturn', label: 'Expected Return (p.a.)', type: 'percent', default: 12, min: 0, max: 30 },
      { key: 'withdrawalRate', label: 'Safe Withdrawal Rate', type: 'percent', default: 4, min: 1, max: 10 },
    ],
    compute: (v) => {
      const fireNumber = v['annualExpenses'] / (v['withdrawalRate'] / 100);
      const i = v['expectedReturn'] / 12 / 100;
      let balance = v['currentSavings'];
      const maxMonths = 60 * 12;
      let monthsToFire: number | null = null;
      const rows: Record<string, string | number>[] = [];
      const corpusValues: number[] = [];
      for (let m = 1; m <= maxMonths; m++) {
        balance = (balance + v['monthlyInvestment']) * (1 + i);
        if (balance >= fireNumber && monthsToFire === null) {
          monthsToFire = m;
        }
        if (m % 12 === 0) {
          rows.push({ year: m / 12, value: formatCurrency(balance) });
          corpusValues.push(balance);
        }
        if (monthsToFire !== null && m % 12 === 0) break;
      }
      const yearsToFire = monthsToFire !== null ? monthsToFire / 12 : null;
      return {
        summary: [
          { label: 'FIRE Number', value: formatCurrency(fireNumber), highlight: true },
          { label: 'Years to FIRE', value: yearsToFire !== null ? formatNumber(yearsToFire, 1) : 'Not within 60 yrs' },
          { label: 'Estimated FIRE Age', value: yearsToFire !== null ? formatNumber(v['currentAge'] + yearsToFire, 1) : '—' },
        ],
        chart: {
          type: 'line',
          categories: rows.map((r) => `Yr ${r['year']}`),
          series: [
            { name: 'Corpus', data: corpusValues },
            { name: 'FIRE Number', data: corpusValues.map(() => fireNumber) },
          ],
        },
        breakdownTitle: 'Projected Corpus Growth',
        breakdownColumns: [
          { key: 'year', header: 'Year' },
          { key: 'value', header: 'Corpus Value' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'emergency-fund',
    title: 'Emergency Fund Calculator',
    shortDescription: 'Find out how much you should keep aside for emergencies.',
    category: 'Planning',
    icon: 'health_and_safety',
    fields: [
      { key: 'monthlyExpenses', label: 'Monthly Expenses', type: 'currency', default: 40000, min: 1000 },
      { key: 'monthsOfCover', label: 'Months of Cover', type: 'number', default: 6, min: 3, max: 24 },
      { key: 'currentSavings', label: 'Current Emergency Savings', type: 'currency', default: 100000, min: 0 },
    ],
    compute: (v) => {
      const target = v['monthlyExpenses'] * v['monthsOfCover'];
      const shortfall = target - v['currentSavings'];
      return {
        summary: [
          { label: 'Recommended Fund', value: formatCurrency(target), highlight: true },
          { label: 'Current Savings', value: formatCurrency(v['currentSavings']) },
          { label: shortfall > 0 ? 'Shortfall' : 'Surplus', value: formatCurrency(Math.abs(shortfall)) },
        ],
        chart: {
          type: 'bar',
          categories: ['Current Savings', 'Recommended Fund'],
          series: [{ name: 'Amount', data: [v['currentSavings'], target] }],
        },
      };
    },
  },
  {
    slug: 'income-tax',
    title: 'Income Tax Calculator',
    shortDescription: 'Estimate your income tax under the new tax regime (simplified).',
    category: 'Tax',
    icon: 'receipt_long',
    fields: [
      { key: 'annualIncome', label: 'Annual Income', type: 'currency', default: 1200000, min: 0 },
      {
        key: 'isSalaried',
        label: 'Salaried (Standard Deduction ₹50,000)',
        type: 'select',
        default: 1,
        options: [
          { value: 1, label: 'Yes' },
          { value: 0, label: 'No' },
        ],
      },
      { key: 'otherDeductions', label: 'Other Deductions', type: 'currency', default: 0, min: 0 },
    ],
    compute: (v) => {
      const standardDeduction = v['isSalaried'] === 1 ? 50000 : 0;
      const taxableIncome = Math.max(v['annualIncome'] - standardDeduction - v['otherDeductions'], 0);
      const { tax, rows } = slabWiseTax(taxableIncome);
      const finalTax = taxableIncome <= 700000 ? 0 : tax;
      const cess = finalTax * 0.04;
      const totalTax = finalTax + cess;
      return {
        summary: [
          { label: 'Taxable Income', value: formatCurrency(taxableIncome) },
          { label: 'Tax Before Cess', value: formatCurrency(finalTax) },
          { label: 'Health & Education Cess (4%)', value: formatCurrency(cess) },
          { label: 'Total Tax Payable', value: formatCurrency(totalTax), highlight: true },
          { label: 'Effective Tax Rate', value: formatPercent(v['annualIncome'] > 0 ? (totalTax / v['annualIncome']) * 100 : 0) },
        ],
        chart: {
          type: 'pie',
          pieData: [
            { name: 'In-hand Income', value: Math.max(v['annualIncome'] - totalTax, 0) },
            { name: 'Total Tax', value: totalTax },
          ],
        },
        breakdownTitle: taxableIncome <= 700000 ? 'Slab-wise Tax (Rebate under Sec 87A applies — Total Tax is Nil)' : 'Slab-wise Tax',
        breakdownColumns: [
          { key: 'slab', header: 'Slab' },
          { key: 'rate', header: 'Rate' },
          { key: 'tax', header: 'Tax' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'gst',
    title: 'GST Calculator',
    shortDescription: 'Add or remove GST from an amount and see the CGST/SGST split.',
    category: 'Tax',
    icon: 'receipt',
    fields: [
      { key: 'amount', label: 'Amount', type: 'currency', default: 10000, min: 0 },
      {
        key: 'gstRate',
        label: 'GST Rate',
        type: 'select',
        default: 18,
        options: [
          { value: 5, label: '5%' },
          { value: 12, label: '12%' },
          { value: 18, label: '18%' },
          { value: 28, label: '28%' },
        ],
      },
      {
        key: 'calculationType',
        label: 'Calculation Type',
        type: 'select',
        default: 0,
        options: [
          { value: 0, label: 'Add GST (amount is exclusive)' },
          { value: 1, label: 'Remove GST (amount is inclusive)' },
        ],
      },
    ],
    compute: (v) => {
      const rate = v['gstRate'];
      let baseAmount: number;
      let gstAmount: number;
      let total: number;
      if (v['calculationType'] === 1) {
        baseAmount = v['amount'] / (1 + rate / 100);
        gstAmount = v['amount'] - baseAmount;
        total = v['amount'];
      } else {
        baseAmount = v['amount'];
        gstAmount = (v['amount'] * rate) / 100;
        total = v['amount'] + gstAmount;
      }
      return {
        summary: [
          { label: 'Base Amount', value: formatCurrency(baseAmount) },
          { label: 'CGST', value: formatCurrency(gstAmount / 2) },
          { label: 'SGST', value: formatCurrency(gstAmount / 2) },
          { label: 'Total GST', value: formatCurrency(gstAmount) },
          { label: 'Total Amount', value: formatCurrency(total), highlight: true },
        ],
        chart: {
          type: 'pie',
          pieData: [
            { name: 'Base Amount', value: baseAmount },
            { name: 'CGST', value: gstAmount / 2 },
            { name: 'SGST', value: gstAmount / 2 },
          ],
        },
      };
    },
  },
  {
    slug: 'inflation',
    title: 'Inflation Calculator',
    shortDescription: "See what today's expenses will cost in the future.",
    category: 'Planning',
    icon: 'price_change',
    fields: [
      { key: 'currentCost', label: 'Current Cost', type: 'currency', default: 100000, min: 1 },
      { key: 'inflationRate', label: 'Inflation Rate (p.a.)', type: 'percent', default: 6, min: 0, max: 20 },
      { key: 'tenureYears', label: 'Time Period', type: 'years', default: 10, min: 1, max: 40 },
    ],
    compute: (v) => {
      const futureCost = v['currentCost'] * Math.pow(1 + v['inflationRate'] / 100, v['tenureYears']);
      const purchasingPower = v['currentCost'] / Math.pow(1 + v['inflationRate'] / 100, v['tenureYears']);
      const rows = Array.from({ length: Math.max(Math.round(v['tenureYears']), 0) }, (_, idx) => {
        const year = idx + 1;
        return { year, cost: formatCurrency(v['currentCost'] * Math.pow(1 + v['inflationRate'] / 100, year)) };
      });
      return {
        summary: [
          { label: 'Future Cost', value: formatCurrency(futureCost), highlight: true },
          { label: 'Total Increase', value: formatCurrency(futureCost - v['currentCost']) },
          { label: `Future Value of Today's ${formatCurrency(v['currentCost'])}`, value: formatCurrency(purchasingPower) },
        ],
        chart: chartFromRows(rows, 'year', [{ key: 'cost', name: 'Cost' }]),
        breakdownTitle: 'Year-wise Cost',
        breakdownColumns: [
          { key: 'year', header: 'Year' },
          { key: 'cost', header: 'Cost' },
        ],
        breakdownRows: rows,
      };
    },
  },
  {
    slug: 'stock-average',
    title: 'Stock Average Price Calculator',
    shortDescription: 'Work out your new average buy price after an additional purchase.',
    category: 'Investment',
    icon: 'bar_chart',
    fields: [
      { key: 'existingQuantity', label: 'Existing Quantity', type: 'number', default: 0, min: 0 },
      { key: 'existingAvgPrice', label: 'Existing Average Price', type: 'currency', default: 0, min: 0 },
      { key: 'newQuantity', label: 'New Quantity', type: 'number', default: 100, min: 0 },
      { key: 'newPrice', label: 'New Purchase Price', type: 'currency', default: 50, min: 0 },
    ],
    compute: (v) => {
      const totalQuantity = v['existingQuantity'] + v['newQuantity'];
      const existingValue = v['existingQuantity'] * v['existingAvgPrice'];
      const newValue = v['newQuantity'] * v['newPrice'];
      const totalInvestment = existingValue + newValue;
      const newAverage = totalQuantity > 0 ? totalInvestment / totalQuantity : 0;
      return {
        summary: [
          { label: 'Total Quantity', value: formatNumber(totalQuantity) },
          { label: 'Total Investment', value: formatCurrency(totalInvestment) },
          { label: 'New Average Price', value: formatCurrency(newAverage), highlight: true },
        ],
        chart: {
          type: 'bar',
          categories: ['Existing Holding', 'New Purchase'],
          series: [{ name: 'Value', data: [existingValue, newValue] }],
        },
      };
    },
  },
];

export function getCalculatorBySlug(slug: string | null): CalculatorDefinition | undefined {
  return CALCULATORS.find((c) => c.slug === slug);
}
