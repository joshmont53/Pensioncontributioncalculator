import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useStudentLoanState } from '../context/StudentLoanContext';
import { calculateStudentLoanRepayment } from '../lib/studentLoanEngine';
import { StatInput } from '../components/StatInput';
import { StatDisplay } from '../components/StatDisplay';
import { PercentInput } from '../components/PercentInput';
import { YearInput } from '../components/YearInput';
import { StudentLoanChart } from '../components/StudentLoanChart';
import { RateGapChart } from '../components/RateGapChart';
import type { GapSeries } from '../components/RateGapChart';
import { SalaryGrowthSensitivityGrid } from '../components/SalaryGrowthSensitivityGrid';

const fmtGBP = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Math.round(v));

// Illustrative gaps between assumed investment growth and the loan's own year-1 interest
// rate — same anchor/meaning in both visuals, just a smaller subset on the line chart
// (CHART_GAP_PRESETS) to keep it readable, vs. the full set on the grid (GAP_PRESETS).
const GAP_PRESETS = [-4, -2, 0, 2, 4, 6];
const CHART_GAP_PRESETS = [-4, -2, 0, 2, 4];
const SALARY_GROWTH_PRESETS = [0, 2, 4, 6];

// Threshold (in £) below which the invest/overpay advantage is treated as "flat" rather than
// a genuine sign — avoids flagging spurious zero-crossings from rounding noise.
const ZERO_EPSILON = 0.5;

function findZeroCrossings(points: { month: number; advantage: number }[]): number[] {
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

export default function StudentLoanResults() {
  const navigate = useNavigate();
  const {
    loanPlan, setLoanPlan,
    startYear, setStartYear,
    graduationYear, setGraduationYear,
    annualSalary, setAnnualSalary,
    salaryGrowthRate, setSalaryGrowthRate,
    inflationRate, setInflationRate,
    savingsGrowthRate, setSavingsGrowthRate,
    debtAmount, setDebtAmount,
    lumpSumAmount, setLumpSumAmount,
    extraMonthlyReal, setExtraMonthlyReal,
    showDetails, setShowDetails,
    showRealTerms, setShowRealTerms,
  } = useStudentLoanState();

  const salaryRef = useRef<HTMLInputElement>(null);
  const debtRef = useRef<HTMLInputElement>(null);
  const lumpRef = useRef<HTMLInputElement>(null);
  const extraRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => calculateStudentLoanRepayment({
    loanPlan, startYear, graduationYear, annualSalary, salaryGrowthRate,
    inflationRate, savingsGrowthRate, debtAmount, lumpSumAmount, extraMonthlyReal,
  }), [loanPlan, startYear, graduationYear, annualSalary, salaryGrowthRate, inflationRate, savingsGrowthRate, debtAmount, lumpSumAmount, extraMonthlyReal]);

  const calendarYear = (relativeYear: number) => startYear + relativeYear - 1;

  const clearedLabel = (
    writtenOff: boolean, clearedYear: number | null, finalDebtRemaining: number,
  ) => {
    if (writtenOff) return `Written off in ${result.writeOffYear} (${fmtGBP(finalDebtRemaining)} forgiven)`;
    if (clearedYear === 0) return 'Cleared immediately';
    return `Cleared in ${calendarYear(clearedYear ?? 1)}`;
  };

  const finalWealthInvest = showRealTerms ? result.invest.finalWealthReal : result.invest.finalWealthNominal;
  const finalWealthOverpay = showRealTerms ? result.overpay.finalWealthReal : result.overpay.finalWealthNominal;
  const finalDiff = Math.abs(finalWealthOverpay - finalWealthInvest);
  const finalLeaderLabel = result.finalLeader === 'overpay' ? 'Overpaying the loan' : result.finalLeader === 'invest' ? 'Investing the spare money' : 'Both options';

  // Year-1 effective loan rate, already computed by the engine — the anchor every preset
  // "gap" is measured against, so gaps mean the same thing for Plan 2 (income-linked sliding
  // scale) and Plan 5 (flat RPI) alike.
  const yearOneLoanRatePct = result.isValid ? result.yearly[0].loanInterestRatePct : 0;

  const gapSeries = useMemo<GapSeries[]>(() => {
    if (!result.isValid) return [];
    const anchor = yearOneLoanRatePct / 100;
    const advantageOf = (p: { investWealthNominal: number; overpayWealthNominal: number; investWealthReal: number; overpayWealthReal: number }) =>
      showRealTerms ? p.investWealthReal - p.overpayWealthReal : p.investWealthNominal - p.overpayWealthNominal;

    const presetSeries = CHART_GAP_PRESETS.map((gap): GapSeries => {
      const scenario = calculateStudentLoanRepayment({
        loanPlan, startYear, graduationYear, annualSalary, salaryGrowthRate,
        inflationRate, savingsGrowthRate: anchor + gap / 100, debtAmount, lumpSumAmount, extraMonthlyReal,
      });
      const absoluteRate = yearOneLoanRatePct + gap;
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
      label: `Your inputs (${(savingsGrowthRate * 100).toFixed(1)}%/yr)`,
      gapPct: null,
      points: yourPoints,
      crossings: findZeroCrossings(yourPoints),
    };

    return [...presetSeries, yourSeries];
  }, [result, yearOneLoanRatePct, loanPlan, startYear, graduationYear, annualSalary, salaryGrowthRate, inflationRate, savingsGrowthRate, debtAmount, lumpSumAmount, extraMonthlyReal, showRealTerms]);

  const salaryGrid = useMemo(() => {
    if (!result.isValid) return null;
    const anchor = yearOneLoanRatePct / 100;
    const cells = SALARY_GROWTH_PRESETS.map(sg => GAP_PRESETS.map(gap => {
      const scenario = calculateStudentLoanRepayment({
        loanPlan, startYear, graduationYear, annualSalary, salaryGrowthRate: sg / 100,
        inflationRate, savingsGrowthRate: anchor + gap / 100, debtAmount, lumpSumAmount, extraMonthlyReal,
      });
      const finalInvest = showRealTerms ? scenario.invest.finalWealthReal : scenario.invest.finalWealthNominal;
      const finalOverpay = showRealTerms ? scenario.overpay.finalWealthReal : scenario.overpay.finalWealthNominal;
      return finalInvest - finalOverpay;
    }));
    return {
      cells,
      yourSalaryGrowthPct: salaryGrowthRate * 100,
      yourGapPct: savingsGrowthRate * 100 - yearOneLoanRatePct,
      yourAdvantage: finalWealthInvest - finalWealthOverpay,
    };
  }, [result, yearOneLoanRatePct, loanPlan, startYear, graduationYear, annualSalary, salaryGrowthRate, inflationRate, savingsGrowthRate, debtAmount, lumpSumAmount, extraMonthlyReal, showRealTerms, finalWealthInvest, finalWealthOverpay]);

  return (
    <div className="min-h-screen bg-[#faf9f6]">

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-black/10">
        <div className="max-w-[1600px] mx-auto px-6 pt-3 pb-2">

          <div className="flex items-center gap-0 border-b border-black/8 pb-3">
            <div className="shrink-0 pr-6 border-r border-black/10 flex flex-col justify-center min-w-[150px]">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-1 text-[15px] font-semibold text-[#1a1a18] leading-snug mb-0.5 hover:text-[#1d4e3a] transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M8 2.5L4 6.5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Home
              </button>
              <p className="text-[11px] uppercase tracking-wider text-[#8a8a84] leading-relaxed">
                Your inputs
              </p>
            </div>

            <div className="flex items-stretch flex-1 min-w-0 gap-2.5">
              <div className="flex-[2] min-w-0 flex flex-wrap items-center rounded-lg border-t-[3px] border-[#4a90a4] bg-[#4a90a4]/5 px-3 pt-2 pb-1">
                <div className="flex-1 min-w-0 px-1">
                  <div className="text-[11px] text-[#8a8a84] mb-1.5">Loan plan</div>
                  <div className="flex gap-1.5">
                    {([2, 5] as const).map(plan => (
                      <button
                        key={plan}
                        onClick={() => setLoanPlan(plan)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                          loanPlan === plan
                            ? 'bg-[#1d4e3a] text-white border-[#1d4e3a]'
                            : 'bg-white text-[#4a4a46] border-black/15 hover:border-[#1d4e3a] hover:text-[#1d4e3a]'
                        }`}
                      >
                        Plan {plan}
                      </button>
                    ))}
                  </div>
                </div>
                <YearInput label="Start year" value={startYear} onChange={setStartYear} />
                <YearInput label="Graduation year" value={graduationYear} onChange={setGraduationYear} />
              </div>

              <div className="flex-[3] min-w-0 flex flex-wrap items-center rounded-lg border-t-[3px] border-[#9b7fd4] bg-[#9b7fd4]/5 px-3 pt-2 pb-1">
                <StatInput label="Annual salary" value={annualSalary} onChange={setAnnualSalary} inputRef={salaryRef} step={1000} />
                <PercentInput label="Salary growth" value={salaryGrowthRate} onChange={setSalaryGrowthRate} step={0.5} />
                <PercentInput label="Inflation (RPI)" value={inflationRate} onChange={setInflationRate} step={0.1} />
                <PercentInput label="Savings growth" value={savingsGrowthRate} onChange={setSavingsGrowthRate} step={0.5} />
              </div>

              <div className="flex-[3] min-w-0 flex flex-wrap items-center rounded-lg border-t-[3px] border-[#1d4e3a] bg-[#1d4e3a]/5 px-3 pt-2 pb-1">
                <StatInput label="Debt amount" value={debtAmount} onChange={setDebtAmount} inputRef={debtRef} step={1000} />
                <StatInput label="Lump sum" value={lumpSumAmount} onChange={setLumpSumAmount} inputRef={lumpRef} step={500}
                  tooltip="One-off amount — invested, or put toward the loan." />
                <StatInput label="Extra monthly" value={extraMonthlyReal} onChange={setExtraMonthlyReal} inputRef={extraRef} step={50}
                  tooltip="Ongoing monthly amount, today's money — invested, or added to the repayment." />
              </div>
            </div>
          </div>

          <div className="flex items-center pt-2 mt-2 bg-[#f7faf8] rounded-xl -mx-2 px-2">
            <div className="shrink-0 pr-6 border-r border-black/10 flex flex-col justify-center min-w-[150px] self-stretch">
              <p className="text-[11px] uppercase tracking-wider text-[#8a8a84] leading-relaxed">
                Calculated
              </p>
            </div>

            <div className="flex items-center flex-1 min-w-0">
              {result.interestSavedMeaningful ? (
                <StatDisplay
                  label="Interest saved by overpaying"
                  value={result.interestSaved}
                  green={result.interestSaved > 0}
                  tooltip="Total interest charged if you invest instead, minus total interest charged if you overpay. Both scenarios fully repay the loan here, so this is a real cash comparison."
                />
              ) : (
                <div className="flex-1 min-w-0 px-4 border-r border-black/8 last:border-r-0">
                  <div className="text-[11px] text-[#8a8a84] mb-1 whitespace-nowrap flex items-center gap-1">
                    Interest saved by overpaying
                    <span className="cursor-help opacity-60" title="Not shown: one or both scenarios end in write-off, so some 'interest charged' was never actually paid by anyone — comparing it to a real cash cost would be misleading. See the loan payoff status below instead.">ⓘ</span>
                  </div>
                  <div className="text-sm text-[#8a8a84] italic">Not meaningful — see write-off note below</div>
                </div>
              )}
              <StatDisplay
                label={`Loan cleared — Overpay${result.overpay.writtenOff ? '' : ` (${result.overpay.clearedYear === 0 ? 'immediately' : calendarYear(result.overpay.clearedYear ?? 1)})`}`}
                value={result.overpay.finalDebtRemaining}
                tooltip="Remaining balance under the 'overpay' scenario at the end of the modelled term. £0 means fully repaid."
              />
              <StatDisplay
                label={`Loan cleared — Invest${result.invest.writtenOff ? '' : ` (${calendarYear(result.invest.clearedYear ?? 1)})`}`}
                value={result.invest.finalDebtRemaining}
                tooltip="Remaining balance under the 'invest' scenario at the end of the modelled term. £0 means fully repaid."
              />
            </div>

            <div className="flex items-center gap-4 shrink-0 pl-4">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowRealTerms(false)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${!showRealTerms ? 'bg-[#1d4e3a] text-white border-[#1d4e3a]' : 'bg-white text-[#4a4a46] border-black/15'}`}
                >Nominal</button>
                <button
                  onClick={() => setShowRealTerms(true)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${showRealTerms ? 'bg-[#1d4e3a] text-white border-[#1d4e3a]' : 'bg-white text-[#4a4a46] border-black/15'}`}
                >Real (today's £)</button>
              </div>
              <div className="w-px h-5 bg-black/10" />
              <button
                onClick={() => setShowDetails(v => !v)}
                className="flex items-center gap-1.5 text-sm text-[#4a4a46] border border-black/20 rounded-lg px-3 py-1.5 hover:border-black/30 transition-colors whitespace-nowrap"
              >
                {showDetails ? 'Hide details' : 'Show details'}
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                  className={`transition-transform duration-200 ${showDetails ? 'rotate-180' : 'rotate-0'}`}>
                  <path d="M2.5 4.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span className="text-[11px] text-[#c8c8c0] whitespace-nowrap max-w-[220px] text-right">
                Plan 2/5 only — check current SLC rates
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main content ───────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">

        {!result.isValid ? (
          <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6">
            <p className="text-sm text-[#4a4a46]">{result.validationMessage}</p>
          </div>
        ) : (
          <>
            {/* Headline verdict */}
            <div className="bg-[#e8f2ed] rounded-2xl border border-[#b8d4c4] p-6">
              <p className="text-[11px] uppercase tracking-wider text-[#4a7d68] mb-2">Headline verdict</p>
              {result.finalLeader === 'tie' ? (
                <p className="text-xl font-bold text-[#1a1a18]">
                  Both options finish about level after {result.totalMonths / 12} years — the choice comes down to your appetite for risk and flexibility.
                </p>
              ) : (
                <p className="text-xl font-bold text-[#1a1a18]">
                  {finalLeaderLabel} leaves you <span className="text-[#1d4e3a]">{fmtGBP(finalDiff)}</span> better off after {result.totalMonths / 12} years
                  {showRealTerms ? ' (in today’s money)' : ''}.
                </p>
              )}
            </div>

            {showDetails && (
              <>
                {/* Loan status + crossover callouts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-[#1a1a18] mb-3">Loan payoff status</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-black/6 pb-3">
                        <span className="text-sm text-[#4a4a46]">If you invest the spare money</span>
                        <span className={`text-sm font-semibold ${result.invest.writtenOff ? 'text-[#e8a87c]' : 'text-[#1d4e3a]'}`}>
                          {clearedLabel(result.invest.writtenOff, result.invest.clearedYear, result.invest.finalDebtRemaining)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#4a4a46]">If you overpay the loan</span>
                        <span className={`text-sm font-semibold ${result.overpay.writtenOff ? 'text-[#e8a87c]' : 'text-[#1d4e3a]'}`}>
                          {clearedLabel(result.overpay.writtenOff, result.overpay.clearedYear, result.overpay.finalDebtRemaining)}
                        </span>
                      </div>
                    </div>
                    {(result.invest.writtenOff || result.overpay.writtenOff) && (
                      <p className="text-[11px] text-[#8a8a84] mt-3 leading-relaxed">
                        A written-off balance is forgiven, not repaid — overpaying a loan that would be written off anyway reduces the amount forgiven rather than saving you money.
                      </p>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-[#1a1a18] mb-3">Break-even point</h3>
                    {result.crossover ? (
                      <p className="text-sm text-[#4a4a46] leading-relaxed">
                        <strong className="text-[#1a1a18]">{result.crossover.leader === 'overpay' ? 'Investing' : 'Overpaying'}</strong> leads until{' '}
                        <strong className="text-[#1a1a18]">{calendarYear(result.crossover.year)}</strong>, then{' '}
                        <strong className="text-[#1a1a18]">{result.crossover.leader === 'overpay' ? 'overpaying' : 'investing'}</strong> takes over and stays ahead for the rest of the term.
                      </p>
                    ) : (
                      <p className="text-sm text-[#4a4a46] leading-relaxed">
                        {result.finalLeader === 'tie'
                          ? 'Neither option takes a lasting lead over the modelled term.'
                          : `${finalLeaderLabel} leads for the entire modelled term — no crossover point.`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Chart */}
                <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6">
                  <h3 className="text-sm font-semibold text-[#1a1a18] mb-1">Wealth over time</h3>
                  <p className="text-[11px] text-[#8a8a84] mb-4">
                    Accumulated investment value under each scenario — {showRealTerms ? "in today's money (inflation-adjusted)" : 'in future (nominal) £'}.
                  </p>
                  <StudentLoanChart monthly={result.monthly} showRealTerms={showRealTerms} crossover={result.crossover} />
                </div>

                {/* Yearly table */}
                <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6 overflow-x-auto">
                  <h3 className="text-sm font-semibold text-[#1a1a18] mb-4">Year-by-year breakdown</h3>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-[#8a8a84] border-b border-black/10">
                        <th className="text-left py-2 pr-4 font-medium">Year</th>
                        <th className="text-right py-2 px-4 font-medium">Salary</th>
                        <th className="text-right py-2 px-4 font-medium">Interest rate</th>
                        <th className="text-right py-2 px-4 font-medium">Base repayment</th>
                        <th className="text-right py-2 px-4 font-medium">Extra monthly</th>
                        <th className="text-right py-2 px-4 font-medium">Debt (invest)</th>
                        <th className="text-right py-2 px-4 font-medium">Debt (overpay)</th>
                        <th className="text-right py-2 px-4 font-medium">Wealth (invest)</th>
                        <th className="text-right py-2 pl-4 font-medium">Wealth (overpay)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.yearly.map(row => (
                        <tr key={row.year} className="border-b border-black/6 hover:bg-[#faf9f6] transition-colors">
                          <td className="py-2 pr-4 text-[#1a1a18] font-medium">{calendarYear(row.year)}</td>
                          <td className="text-right py-2 px-4 text-[#4a4a46] tabular-nums">{fmtGBP(row.annualSalary)}</td>
                          <td className="text-right py-2 px-4 text-[#4a4a46] tabular-nums">{row.loanInterestRatePct.toFixed(2)}%</td>
                          <td className="text-right py-2 px-4 text-[#4a4a46] tabular-nums">{fmtGBP(row.baseMonthlyRepayment)}</td>
                          <td className="text-right py-2 px-4 text-[#4a4a46] tabular-nums">{fmtGBP(row.extraMonthly)}</td>
                          <td className="text-right py-2 px-4 text-[#4a4a46] tabular-nums">{fmtGBP(row.investDebtRemaining)}</td>
                          <td className="text-right py-2 px-4 text-[#4a4a46] tabular-nums">{fmtGBP(row.overpayDebtRemaining)}</td>
                          <td className="text-right py-2 px-4 text-[#4a90a4] font-semibold tabular-nums">
                            {fmtGBP(showRealTerms ? row.investWealthReal : row.investWealthNominal)}
                          </td>
                          <td className="text-right py-2 pl-4 text-[#1d4e3a] font-semibold tabular-nums">
                            {fmtGBP(showRealTerms ? row.overpayWealthReal : row.overpayWealthNominal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Rate-gap sensitivity chart */}
                <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6">
                  <h3 className="text-sm font-semibold text-[#1a1a18] mb-2">How much does the growth-rate gap matter?</h3>
                  <div className="flex flex-col md:flex-row gap-3 mb-3">
                    <div className="bg-[#f7f6f2] border border-black/8 rounded-lg px-3.5 py-2.5 flex-1">
                      <p className="text-[12px] text-[#1a1a18] leading-relaxed">
                        <strong>Growth-rate gap</strong> = your assumed investment growth rate <strong>minus</strong> the loan's own interest rate.
                        The loan's year-1 rate here is <strong>{yearOneLoanRatePct.toFixed(2)}%</strong> — so, for example, the <strong>"+4%"</strong> line
                        below assumes investments growing at <strong>{(yearOneLoanRatePct + 4).toFixed(2)}%/year</strong>, and <strong>"−2%"</strong> assumes{' '}
                        <strong>{(yearOneLoanRatePct - 2).toFixed(2)}%/year</strong>.
                      </p>
                    </div>
                    <div className="bg-[#f7f6f2] border border-black/8 rounded-lg px-3.5 py-2.5 flex-1">
                      <p className="text-[12px] text-[#1a1a18] leading-relaxed">
                        <strong>How to read this chart</strong> — orange lines favour overpaying, green lines favour investing, grey (0%) is a dead
                        heat. The dots mark where a line crosses £0 — the point that scenario's advantage flips from one option to the other.
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#8a8a84] mb-4 max-w-2xl leading-relaxed">
                    Each line holds everything else — salary, debt, lump sum, extra monthly — exactly as you entered it, and only changes the assumed
                    investment growth rate. The dashed line is your actual inputs. Above zero, investing is ahead; below zero, overpaying is ahead.
                  </p>
                  <RateGapChart series={gapSeries} totalMonths={result.totalMonths} />
                </div>

                {/* Salary growth sensitivity grid */}
                <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6">
                  <h3 className="text-sm font-semibold text-[#1a1a18] mb-1">Does salary growth change the picture?</h3>
                  <p className="text-[11px] text-[#8a8a84] mb-4 max-w-2xl leading-relaxed">
                    Salary growth mainly affects how fast the loan clears, not the underlying rate race — so its effect is smaller than the growth-rate
                    gap above. Each cell is the final £ advantage at the end of the term for that combination.
                  </p>
                  {salaryGrid && (
                    <SalaryGrowthSensitivityGrid
                      rowPcts={SALARY_GROWTH_PRESETS}
                      colPcts={GAP_PRESETS}
                      cells={salaryGrid.cells}
                      yourSalaryGrowthPct={salaryGrid.yourSalaryGrowthPct}
                      yourGapPct={salaryGrid.yourGapPct}
                      yourAdvantage={salaryGrid.yourAdvantage}
                    />
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
