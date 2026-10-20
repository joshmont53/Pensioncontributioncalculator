import { calculateStudentLoanRepayment } from './studentLoanEngine.js';
import type { StudentLoanInputs, StudentLoanResult } from './studentLoanEngine.js';

// Sensitivity analysis shown under the student loan results, moved out of the
// web results page unchanged so the web and mobile apps share it.

// Illustrative gaps between assumed investment growth and the loan's own year-1 interest
// rate — same anchor/meaning in both visuals, just a smaller subset on the line chart
// (CHART_GAP_PRESETS) to keep it readable, vs. the full set on the grid (GAP_PRESETS).
export const GAP_PRESETS = [-4, -2, 0, 2, 4, 6];
export const CHART_GAP_PRESETS = [-4, -2, 0, 2, 4];
export const SALARY_GROWTH_PRESETS = [0, 2, 4, 6];

// Threshold (in £) below which the invest/overpay advantage is treated as "flat" rather than
// a genuine sign — avoids flagging spurious zero-crossings from rounding noise.
const ZERO_EPSILON = 0.5;

export interface GapSeries {
  key: string;
  label: string;
  gapPct: number | null; // null for the "Your inputs" series
  points: { month: number; advantage: number }[];
  crossings: number[]; // months where this series' advantage flips sign
}

export function findZeroCrossings(points: { month: number; advantage: number }[]): number[] {
  const crossings: number[] = [];
  let prevSign = 0;
  for (const p of points) {
    const sign = p.advantage > ZERO_EPSILON ? 1 : p.advantage < -ZERO_EPSILON ? -1 : 0;
    if (sign !== 0) {
      if (prevSign !== 0 && sign !== prevSign) crossings.push(p.month);
      prevSign = sign;
    }
  }
  return crossings;
}

// Year-1 effective loan rate, already computed by the engine — the anchor every preset
// "gap" is measured against, so gaps mean the same thing for Plan 2 (income-linked sliding
// scale) and Plan 5 (flat RPI) alike.
export function yearOneLoanRatePct(result: StudentLoanResult): number {
  return result.isValid ? result.yearly[0].loanInterestRatePct : 0;
}

export function buildGapSeries(inputs: StudentLoanInputs, result: StudentLoanResult, showRealTerms: boolean): GapSeries[] {
  if (!result.isValid) return [];
  const ratePct = yearOneLoanRatePct(result);
  const anchor = ratePct / 100;
  const advantageOf = (p: { investWealthNominal: number; overpayWealthNominal: number; investWealthReal: number; overpayWealthReal: number }) =>
    showRealTerms ? p.investWealthReal - p.overpayWealthReal : p.investWealthNominal - p.overpayWealthNominal;

  const presetSeries = CHART_GAP_PRESETS.map((gap): GapSeries => {
    const scenario = calculateStudentLoanRepayment({ ...inputs, savingsGrowthRate: anchor + gap / 100 });
    const absoluteRate = ratePct + gap;
    const points = scenario.monthly.map(p => ({ month: p.month, advantage: advantageOf(p) }));
    return {
      key: `gap_${gap}`,
      label: `${gap > 0 ? '+' : ''}${gap}% (${absoluteRate.toFixed(1)}%/yr)`,
      gapPct: gap,
      points,
      crossings: findZeroCrossings(points),
    };
  });

  const yourPoints = result.monthly.map(p => ({ month: p.month, advantage: advantageOf(p) }));
  const yourSeries: GapSeries = {
    key: 'yours',
    label: `Your inputs (${(inputs.savingsGrowthRate * 100).toFixed(1)}%/yr)`,
    gapPct: null,
    points: yourPoints,
    crossings: findZeroCrossings(yourPoints),
  };

  return [...presetSeries, yourSeries];
}

export interface SalaryGrid {
  cells: number[][]; // cells[salaryGrowthIdx][gapIdx]: final invest − overpay advantage
  yourSalaryGrowthPct: number;
  yourGapPct: number;
  yourAdvantage: number;
}

export function buildSalaryGrid(inputs: StudentLoanInputs, result: StudentLoanResult, showRealTerms: boolean): SalaryGrid | null {
  if (!result.isValid) return null;
  const ratePct = yearOneLoanRatePct(result);
  const anchor = ratePct / 100;
  const cells = SALARY_GROWTH_PRESETS.map(sg => GAP_PRESETS.map(gap => {
    const scenario = calculateStudentLoanRepayment({ ...inputs, salaryGrowthRate: sg / 100, savingsGrowthRate: anchor + gap / 100 });
    const finalInvest = showRealTerms ? scenario.invest.finalWealthReal : scenario.invest.finalWealthNominal;
    const finalOverpay = showRealTerms ? scenario.overpay.finalWealthReal : scenario.overpay.finalWealthNominal;
    return finalInvest - finalOverpay;
  }));
  const finalWealthInvest = showRealTerms ? result.invest.finalWealthReal : result.invest.finalWealthNominal;
  const finalWealthOverpay = showRealTerms ? result.overpay.finalWealthReal : result.overpay.finalWealthNominal;
  return {
    cells,
    yourSalaryGrowthPct: inputs.salaryGrowthRate * 100,
    yourGapPct: inputs.savingsGrowthRate * 100 - ratePct,
    yourAdvantage: finalWealthInvest - finalWealthOverpay,
  };
}
