export type LoanPlan = 2 | 5;

export interface StudentLoanInputs {
  loanPlan: LoanPlan;
  startYear: number;
  graduationYear: number;
  annualSalary: number;
  salaryGrowthRate: number; // decimal, e.g. 0.03
  inflationRate: number; // decimal RPI assumption, e.g. 0.04
  savingsGrowthRate: number; // decimal
  debtAmount: number;
  lumpSumAmount: number; // one-off, applied at month 1. 0 = not used.
  extraMonthlyReal: number; // ongoing, year-1 £, inflation-indexed each year. 0 = not used.
}

export interface MonthlyPoint {
  month: number;
  year: number;
  investDebt: number;
  overpayDebt: number;
  investWealthNominal: number;
  overpayWealthNominal: number;
  investWealthReal: number;
  overpayWealthReal: number;
}

export interface YearlySnapshot {
  year: number;
  month: number;
  annualSalary: number;
  loanInterestRatePct: number;
  baseMonthlyRepayment: number;
  extraMonthly: number;
  investDebtRemaining: number;
  overpayDebtRemaining: number;
  investWealthNominal: number;
  overpayWealthNominal: number;
  investWealthReal: number;
  overpayWealthReal: number;
}

export interface ScenarioSummary {
  clearedMonth: number | null;
  clearedYear: number | null;
  writtenOff: boolean;
  finalDebtRemaining: number;
  totalInterestCharged: number;
  finalWealthNominal: number;
  finalWealthReal: number;
}

export interface Crossover {
  month: number;
  year: number;
  leader: 'invest' | 'overpay';
}

export interface StudentLoanResult {
  isValid: boolean;
  validationMessage: string | null;
  totalMonths: number;
  writeOffYear: number;
  monthly: MonthlyPoint[];
  yearly: YearlySnapshot[];
  invest: ScenarioSummary;
  overpay: ScenarioSummary;
  interestSaved: number; // invest.totalInterestCharged - overpay.totalInterestCharged
  // False whenever either scenario is written off: interest that accrues on a written-off
  // balance is forgiven, never actually paid, so "interest saved" would compare a real cash
  // cost against phantom interest that was never collected — misleading rather than useful.
  interestSavedMeaningful: boolean;
  crossover: Crossover | null;
  finalLeader: 'invest' | 'overpay' | 'tie';
}

// Historic Plan 2 income-linked interest bands. Plan 5 (and post-2023 Plan 2 reforms) moved
// to a flat RPI rate with no income-linked sliding scale — see the Plan review in the plan
// doc. These exact thresholds/rates should be checked against current SLC guidance before
// being relied on for real client advice; they change most tax years.
const INCOME_LOWER = 28470;
const INCOME_UPPER = 51245;
const PLAN2_THRESHOLD_BASE = 27295;
const PLAN5_THRESHOLD_BASE = 25000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function writeOffTermYears(loanPlan: LoanPlan): number {
  return loanPlan === 2 ? 30 : 40;
}

function loanInterestRate(
  loanPlan: LoanPlan,
  yearSalary: number,
  incomeLowerAdj: number,
  incomeUpperAdj: number,
  inflationRate: number
): number {
  if (loanPlan === 5) {
    // Plan 5: flat RPI, no income-linked sliding scale.
    return inflationRate;
  }
  // Plan 2: interest scales linearly from RPI (at/below the lower band) up to RPI+3%
  // (at/above the upper band).
  if (yearSalary > incomeUpperAdj) return inflationRate + 0.03;
  if (yearSalary > incomeLowerAdj) {
    return ((yearSalary - incomeLowerAdj) / (incomeUpperAdj - incomeLowerAdj)) * 0.03 + inflationRate;
  }
  return inflationRate;
}

function repaymentThresholdForYear(loanPlan: LoanPlan, inflationRate: number, year: number): number {
  const base = loanPlan === 2 ? PLAN2_THRESHOLD_BASE : PLAN5_THRESHOLD_BASE;
  // Modeling assumption (shared with both source prototypes): the threshold rises with
  // inflation every year. In reality government has sometimes frozen thresholds instead —
  // this should be surfaced to the user as an assumption, not fixed here, since it's the
  // most defensible forward-looking default absent a stated freeze policy.
  return base * Math.pow(1 + inflationRate, year - 1);
}

function emptyScenario(): ScenarioSummary {
  return {
    clearedMonth: null,
    clearedYear: null,
    writtenOff: false,
    finalDebtRemaining: 0,
    totalInterestCharged: 0,
    finalWealthNominal: 0,
    finalWealthReal: 0,
  };
}

export function calculateStudentLoanRepayment(inputs: StudentLoanInputs): StudentLoanResult {
  const {
    loanPlan, startYear, graduationYear, annualSalary, salaryGrowthRate,
    inflationRate, savingsGrowthRate, debtAmount, lumpSumAmount, extraMonthlyReal,
  } = inputs;

  const term = writeOffTermYears(loanPlan);
  const writeOffYear = graduationYear + 1 + term;
  const totalYears = writeOffYear - startYear;
  const totalMonths = totalYears * 12;

  if (totalMonths <= 0) {
    return {
      isValid: false,
      validationMessage: `The loan's write-off year (${writeOffYear}) is not after the start year (${startYear}) — check the graduation year and start year.`,
      totalMonths: 0,
      writeOffYear,
      monthly: [],
      yearly: [],
      invest: emptyScenario(),
      overpay: emptyScenario(),
      interestSaved: 0,
      interestSavedMeaningful: false,
      crossover: null,
      finalLeader: 'tie',
    };
  }

  let investDebt = debtAmount;
  const lumpAppliedToOverpay = Math.min(lumpSumAmount, debtAmount);
  const lumpExcess = Math.max(0, lumpSumAmount - debtAmount);
  let overpayDebt = round2(debtAmount - lumpAppliedToOverpay);

  let investBalance = round2(lumpSumAmount); // lump sum invested from month 1 if the "invest" choice is taken
  let overpayBalance = round2(lumpExcess); // any lump sum beyond the debt is invested immediately either way

  let investClearedMonth: number | null = null;
  // 0 = lump sum alone cleared the debt before month 1 even starts.
  let overpayClearedMonth: number | null = overpayDebt <= 0 ? 0 : null;

  let investInterestTotal = 0;
  let overpayInterestTotal = 0;

  const monthly: MonthlyPoint[] = [];
  const yearly: YearlySnapshot[] = [];

  const signHistory: Array<{ month: number; year: number; sign: number }> = [];

  for (let month = 1; month <= totalMonths; month++) {
    const year = Math.floor((month - 1) / 12) + 1;
    const yearSalary = round2(annualSalary * Math.pow(1 + salaryGrowthRate, year - 1));

    const incomeLowerAdj = INCOME_LOWER * Math.pow(1 + inflationRate, year - 1);
    const incomeUpperAdj = INCOME_UPPER * Math.pow(1 + inflationRate, year - 1);
    const rate = loanInterestRate(loanPlan, yearSalary, incomeLowerAdj, incomeUpperAdj, inflationRate);

    const threshold = repaymentThresholdForYear(loanPlan, inflationRate, year);
    const baseRepayment = round2(Math.max(0, ((yearSalary - threshold) * 0.09) / 12));
    const extraMonthly = round2(extraMonthlyReal * Math.pow(1 + inflationRate, year - 1));

    // ── Invest track: debt paid down on the normal schedule only ──────────
    let investFreed = 0;
    if (investDebt > 0) {
      const interest = round2(investDebt * (rate / 12));
      investInterestTotal += interest;
      const next = round2(Math.max(0, investDebt + interest - baseRepayment));
      if (next <= 0 && investClearedMonth === null) {
        investFreed = round2(Math.max(0, baseRepayment - (investDebt + interest)));
        investClearedMonth = month;
      }
      investDebt = next;
    } else {
      investFreed = baseRepayment;
    }
    investBalance = round2(investBalance + extraMonthly + investFreed);
    investBalance = round2(investBalance + investBalance * (savingsGrowthRate / 12));

    // ── Overpay track: lump sum already applied to opening balance; extra
    // monthly is added to every repayment, clearing debt earlier ──────────
    let overpayFreed = 0;
    if (overpayDebt > 0) {
      const interest = round2(overpayDebt * (rate / 12));
      overpayInterestTotal += interest;
      const totalRepayment = round2(baseRepayment + extraMonthly);
      const next = round2(Math.max(0, overpayDebt + interest - totalRepayment));
      if (next <= 0 && overpayClearedMonth === null) {
        overpayFreed = round2(Math.max(0, totalRepayment - (overpayDebt + interest)));
        overpayClearedMonth = month;
      }
      overpayDebt = next;
    } else {
      overpayFreed = round2(baseRepayment + extraMonthly);
    }
    overpayBalance = round2(overpayBalance + overpayFreed);
    overpayBalance = round2(overpayBalance + overpayBalance * (savingsGrowthRate / 12));

    // Single, consistent real-terms deflator applied everywhere (chart + table) — the two
    // source prototypes used different formulas for "real" figures in the chart vs. the
    // table, which would show different numbers for the same month if cross-checked.
    const deflator = Math.pow(1 + inflationRate, month / 12);
    const investWealthReal = investBalance / deflator;
    const overpayWealthReal = overpayBalance / deflator;

    monthly.push({
      month, year,
      investDebt, overpayDebt,
      investWealthNominal: investBalance,
      overpayWealthNominal: overpayBalance,
      investWealthReal, overpayWealthReal,
    });

    const diff = overpayBalance - investBalance;
    const sign = diff > 0.005 ? 1 : diff < -0.005 ? -1 : 0;
    if (sign !== 0) signHistory.push({ month, year, sign });

    if (month % 12 === 0) {
      yearly.push({
        year, month,
        annualSalary: yearSalary,
        loanInterestRatePct: rate * 100,
        baseMonthlyRepayment: baseRepayment,
        extraMonthly,
        investDebtRemaining: investDebt,
        overpayDebtRemaining: overpayDebt,
        investWealthNominal: investBalance,
        overpayWealthNominal: overpayBalance,
        investWealthReal, overpayWealthReal,
      });
    }
  }

  const finalDeflator = Math.pow(1 + inflationRate, totalMonths / 12);
  const clearedMonthToYear = (m: number | null) => (m === null ? null : m === 0 ? 0 : Math.floor((m - 1) / 12) + 1);

  const invest: ScenarioSummary = {
    clearedMonth: investClearedMonth,
    clearedYear: clearedMonthToYear(investClearedMonth),
    writtenOff: investClearedMonth === null,
    finalDebtRemaining: investDebt,
    totalInterestCharged: round2(investInterestTotal),
    finalWealthNominal: investBalance,
    finalWealthReal: investBalance / finalDeflator,
  };

  const overpay: ScenarioSummary = {
    clearedMonth: overpayClearedMonth,
    clearedYear: clearedMonthToYear(overpayClearedMonth),
    writtenOff: overpayClearedMonth === null,
    finalDebtRemaining: overpayDebt,
    totalInterestCharged: round2(overpayInterestTotal),
    finalWealthNominal: overpayBalance,
    finalWealthReal: overpayBalance / finalDeflator,
  };

  // Crossover = the last month the leader changed. Everything after it stays with the same
  // leader through to the end of the term, which is what makes "X wins from year N onward" a
  // true statement rather than just the most recent of several flips.
  let crossover: Crossover | null = null;
  for (let i = 1; i < signHistory.length; i++) {
    if (signHistory[i].sign !== signHistory[i - 1].sign) {
      crossover = { month: signHistory[i].month, year: signHistory[i].year, leader: signHistory[i].sign > 0 ? 'overpay' : 'invest' };
    }
  }

  const finalDiff = overpay.finalWealthNominal - invest.finalWealthNominal;
  const finalLeader: StudentLoanResult['finalLeader'] = finalDiff > 0.5 ? 'overpay' : finalDiff < -0.5 ? 'invest' : 'tie';

  return {
    isValid: true,
    validationMessage: null,
    totalMonths,
    writeOffYear,
    monthly,
    yearly,
    invest,
    overpay,
    interestSaved: round2(invest.totalInterestCharged - overpay.totalInterestCharged),
    interestSavedMeaningful: !invest.writtenOff && !overpay.writtenOff,
    crossover,
    finalLeader,
  };
}
