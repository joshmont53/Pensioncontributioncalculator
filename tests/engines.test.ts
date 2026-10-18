import { describe, expect, it } from 'vitest';
import { calculateStudentLoanRepayment } from '../src/app/lib/studentLoanEngine';
import type { StudentLoanInputs } from '../src/app/lib/studentLoanEngine';
import { computeTax, calculateAdditionalRelief } from '../src/app/lib/taxEngine';
import { DEFAULT_CONFIG } from '../src/app/hooks/useTaxConfig';

// Regression snapshots recorded against the original engine code. They must
// keep passing unchanged when the engines move into packages/core.

const BASE: StudentLoanInputs = {
  loanPlan: 2,
  startYear: 2026,
  graduationYear: 2025,
  annualSalary: 38000,
  salaryGrowthRate: 0.03,
  inflationRate: 0.04,
  savingsGrowthRate: 0.05,
  debtAmount: 50000,
  lumpSumAmount: 0,
  extraMonthlyReal: 0,
};

const STUDENT_LOAN_CASES: Record<string, StudentLoanInputs> = {
  'plan 2 defaults': BASE,
  'plan 5 defaults': { ...BASE, loanPlan: 5 },
  'plan 2 high earner with lump sum': { ...BASE, annualSalary: 75000, lumpSumAmount: 10000 },
  'plan 2 extra monthly': { ...BASE, extraMonthlyReal: 300 },
  'plan 5 lump sum and extra monthly': { ...BASE, loanPlan: 5, lumpSumAmount: 5000, extraMonthlyReal: 200, savingsGrowthRate: 0.07 },
  'lump sum exceeds debt': { ...BASE, debtAmount: 8000, lumpSumAmount: 12000 },
  'advanced salary overrides': {
    ...BASE, useAdvancedSalary: true, salaryOverrides: { 3: 45000, 6: 60000, 10: 52000 },
  },
  'invalid years': { ...BASE, graduationYear: 1980 },
};

// The monthly series is too large to snapshot in full; the yearly snapshots
// cover every 12th month, and these sums catch any change in between.
function summarise(result: ReturnType<typeof calculateStudentLoanRepayment>) {
  const { monthly, ...rest } = result;
  const sum = (key: keyof (typeof monthly)[number]) => monthly.reduce((s, p) => s + p[key], 0);
  return {
    ...rest,
    monthlyCount: monthly.length,
    monthlySums: {
      investDebt: sum('investDebt'),
      overpayDebt: sum('overpayDebt'),
      investWealthNominal: sum('investWealthNominal'),
      overpayWealthNominal: sum('overpayWealthNominal'),
      investWealthReal: sum('investWealthReal'),
      overpayWealthReal: sum('overpayWealthReal'),
    },
  };
}

describe('calculateStudentLoanRepayment', () => {
  for (const [name, inputs] of Object.entries(STUDENT_LOAN_CASES)) {
    it(name, () => {
      expect(summarise(calculateStudentLoanRepayment(inputs))).toMatchSnapshot();
    });
  }
});

const INCOMES = [0, 12570, 30000, 50270, 80000, 100000, 112000, 125140, 160000, 300000];
const DIVIDENDS = [0, 2000, 15000, 60000];

describe('computeTax', () => {
  it('income and dividend grid', () => {
    const rows = INCOMES.flatMap(nonDiv => DIVIDENDS.map(div => ({ nonDiv, div, result: computeTax(DEFAULT_CONFIG, nonDiv, div) })));
    expect(rows).toMatchSnapshot();
  });
});

describe('calculateAdditionalRelief', () => {
  it('contribution grid', () => {
    const rows = INCOMES.flatMap(top => [0, 5000, 20000, 60000].flatMap(reduction => DIVIDENDS.map(div => {
      const { atTop: _t, atBottom: _b, ...relief } = calculateAdditionalRelief(DEFAULT_CONFIG, top, reduction, div);
      return { top, reduction, div, relief };
    })));
    expect(rows).toMatchSnapshot();
  });
});
