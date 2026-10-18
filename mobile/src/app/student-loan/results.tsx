import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  buildGapSeries, buildSalaryGrid, calculateStudentLoanRepayment, fmtGBP, formatCurrencyFull,
  GAP_PRESETS, SALARY_GROWTH_PRESETS, yearOneLoanRatePct as loanRateForYearOne,
} from '@calc/core';
import { useStudentLoanState } from '@/state/StudentLoanContext';
import { Body, Card, Segmented, StatRow, Strong, ToggleRow } from '@/components/ui';
import { LineChart } from '@/components/LineChart';
import { AdvancedSalaryList, SensitivityGrid, YearlyTable, gapChartSeries } from '@/components/studentLoan';
import { useTheme } from '@/theme';

export default function StudentLoanResultsScreen() {
  const t = useTheme();
  const s = useStudentLoanState();
  const {
    loanPlan, startYear, graduationYear, annualSalary, salaryGrowthRate, inflationRate, savingsGrowthRate,
    debtAmount, lumpSumAmount, extraMonthlyReal, useAdvancedSalary, salaryOverrides, showRealTerms,
  } = s;

  // Same calculations as the web results page, from packages/core.
  const inputs = useMemo(() => ({
    loanPlan, startYear, graduationYear, annualSalary, salaryGrowthRate,
    inflationRate, savingsGrowthRate, debtAmount, lumpSumAmount, extraMonthlyReal,
    useAdvancedSalary, salaryOverrides,
  }), [loanPlan, startYear, graduationYear, annualSalary, salaryGrowthRate, inflationRate, savingsGrowthRate, debtAmount, lumpSumAmount, extraMonthlyReal, useAdvancedSalary, salaryOverrides]);
  const result = useMemo(() => calculateStudentLoanRepayment(inputs), [inputs]);
  const yearOneLoanRatePct = loanRateForYearOne(result);
  const gapSeries = useMemo(() => buildGapSeries(inputs, result, showRealTerms), [inputs, result, showRealTerms]);
  const salaryGrid = useMemo(() => buildSalaryGrid(inputs, result, showRealTerms), [inputs, result, showRealTerms]);

  const calendarYear = (relativeYear: number) => startYear + relativeYear - 1;
  const clearedLabel = (writtenOff: boolean, clearedYear: number | null, finalDebtRemaining: number) => {
    if (writtenOff) return `Written off in ${result.writeOffYear} (${fmtGBP(finalDebtRemaining)} forgiven)`;
    if (clearedYear === 0) return 'Cleared immediately';
    return `Cleared in ${calendarYear(clearedYear ?? 1)}`;
  };

  const finalWealthInvest = showRealTerms ? result.invest.finalWealthReal : result.invest.finalWealthNominal;
  const finalWealthOverpay = showRealTerms ? result.overpay.finalWealthReal : result.overpay.finalWealthNominal;
  const finalDiff = Math.abs(finalWealthOverpay - finalWealthInvest);
  const finalLeaderLabel = result.finalLeader === 'overpay' ? 'Overpaying the loan' : result.finalLeader === 'invest' ? 'Investing the spare money' : 'Both options';
  const years = result.totalMonths / 12;

  const display = (
    <Card title="Display options">
      <Segmented
        options={[{ label: 'Nominal', value: 'nominal' }, { label: "Real (today's £)", value: 'real' }]}
        value={showRealTerms ? 'real' : 'nominal'}
        onChange={v => s.setShowRealTerms(v === 'real')}
      />
      <ToggleRow
        label="Advanced salary path"
        hint="Model salary year-by-year instead of a flat growth rate."
        value={useAdvancedSalary}
        onChange={s.setUseAdvancedSalary}
      />
    </Card>
  );

  if (!result.isValid) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Card><Body>{result.validationMessage}</Body></Card>
        {display}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="interactive" contentContainerStyle={styles.content}>
      <View style={[styles.verdict, { backgroundColor: t.brandSoft, borderColor: t.brandSoftBorder }]}>
        <Text style={[styles.verdictLabel, { color: t.brandSoftText }]}>HEADLINE VERDICT</Text>
        {result.finalLeader === 'tie' ? (
          <Text style={[styles.verdictText, { color: t.text }]}>
            Both options finish about level after {years} years — the choice comes down to your appetite for risk and flexibility.
          </Text>
        ) : (
          <Text style={[styles.verdictText, { color: t.text }]}>
            {finalLeaderLabel} leaves you <Text style={{ color: t.brand }}>{fmtGBP(finalDiff)}</Text> better off after {years} years
            {showRealTerms ? ' (in today’s money)' : ''}.
          </Text>
        )}
      </View>

      {display}

      <Card title="Key figures">
        {result.interestSavedMeaningful ? (
          <StatRow label="Interest saved by overpaying" value={fmtGBP(result.interestSaved)}
            valueColor={result.interestSaved > 0 ? t.brand : undefined} />
        ) : (
          <StatRow label="Interest saved by overpaying" value="Not meaningful" valueColor={t.textMuted} />
        )}
        <StatRow
          label={`Debt left — Overpay${result.overpay.writtenOff ? '' : ` (cleared ${result.overpay.clearedYear === 0 ? 'immediately' : calendarYear(result.overpay.clearedYear ?? 1)})`}`}
          value={fmtGBP(result.overpay.finalDebtRemaining)}
        />
        <StatRow
          label={`Debt left — Invest${result.invest.writtenOff ? '' : ` (cleared ${calendarYear(result.invest.clearedYear ?? 1)})`}`}
          value={fmtGBP(result.invest.finalDebtRemaining)}
          last
        />
        {!result.interestSavedMeaningful ? (
          <Body small muted>
            Interest saved isn't shown: one or both scenarios end in write-off, so some interest charged is never actually paid.
          </Body>
        ) : null}
      </Card>

      <Card title="Loan payoff status" collapsible>
        <StatRow label="If you invest the spare money"
          value={clearedLabel(result.invest.writtenOff, result.invest.clearedYear, result.invest.finalDebtRemaining)}
          valueColor={result.invest.writtenOff ? t.warningText : t.brand} stacked />
        <StatRow label="If you overpay the loan"
          value={clearedLabel(result.overpay.writtenOff, result.overpay.clearedYear, result.overpay.finalDebtRemaining)}
          valueColor={result.overpay.writtenOff ? t.warningText : t.brand} stacked last />
        {(result.invest.writtenOff || result.overpay.writtenOff) ? (
          <Body small muted>
            A written-off balance is forgiven, not repaid — overpaying a loan that would be written off anyway reduces the amount
            forgiven rather than saving you money.
          </Body>
        ) : null}
      </Card>

      <Card title="Break-even point" collapsible>
        {result.crossover ? (
          <Body>
            <Strong>{result.crossover.leader === 'overpay' ? 'Investing' : 'Overpaying'}</Strong> leads until{' '}
            <Strong>{calendarYear(result.crossover.year)}</Strong>, then{' '}
            <Strong>{result.crossover.leader === 'overpay' ? 'overpaying' : 'investing'}</Strong> takes over and stays ahead for the rest of the term.
          </Body>
        ) : (
          <Body>
            {result.finalLeader === 'tie'
              ? 'Neither option takes a lasting lead over the modelled term.'
              : `${finalLeaderLabel} leads for the entire modelled term — no crossover point.`}
          </Body>
        )}
      </Card>

      {useAdvancedSalary ? (
        <Card title="Advanced salary path" collapsible
          subtitle={`Edit any year to pin it to an exact salary — later years keep compounding the growth rate from that point. Use Reset to go back to auto-calculated. Figures are ${showRealTerms ? "in today's money" : 'nominal (future) £'}.`}>
          <AdvancedSalaryList
            startYear={startYear}
            salaryByYear={result.salaryByYear}
            annualSalary={annualSalary}
            setAnnualSalary={s.setAnnualSalary}
            salaryOverrides={salaryOverrides}
            setSalaryOverrides={s.setSalaryOverrides}
            showRealTerms={showRealTerms}
            inflationRate={inflationRate}
          />
        </Card>
      ) : null}

      <Card title="Wealth over time" collapsible
        subtitle={`Accumulated investment value under each scenario — ${showRealTerms ? "in today's money (inflation-adjusted)" : 'in future (nominal) £'}.`}>
        <LineChart
          series={[
            { key: 'invest', label: 'Invest the spare money', color: t.invest,
              values: result.monthly.map(p => showRealTerms ? p.investWealthReal : p.investWealthNominal) },
            { key: 'overpay', label: 'Overpay the loan', color: t.brand,
              values: result.monthly.map(p => showRealTerms ? p.overpayWealthReal : p.overpayWealthNominal) },
          ]}
          verticalMarker={result.crossover ? { month: result.crossover.month, label: 'Crossover' } : undefined}
        />
      </Card>

      <Card title="Year-by-year breakdown" collapsible initiallyOpen={false} subtitle="Scroll sideways to see every column.">
        <YearlyTable rows={result.yearly} startYear={startYear} showRealTerms={showRealTerms} />
      </Card>

      <Card title="How much does the growth-rate gap matter?" collapsible>
        <Body small>
          <Strong>Growth-rate gap</Strong> = your assumed investment growth rate minus the loan's own interest rate. The loan's
          year-1 rate here is <Strong>{yearOneLoanRatePct.toFixed(2)}%</Strong> — so the "+4%" line assumes investments growing at{' '}
          <Strong>{(yearOneLoanRatePct + 4).toFixed(2)}%/year</Strong>, and "−2%" assumes <Strong>{(yearOneLoanRatePct - 2).toFixed(2)}%/year</Strong>.
        </Body>
        <Body small muted>
          {'\n'}Above zero, investing is ahead; below zero, overpaying is ahead. Orange lines favour overpaying, green favour investing.
          The dashed line is your inputs, and dots mark where a line crosses £0.{'\n'}
        </Body>
        <LineChart series={gapChartSeries(gapSeries, t)} zeroLine height={260} />
      </Card>

      {salaryGrid ? (
        <Card title="Does salary growth change the picture?" collapsible
          subtitle="Each cell is the final £ advantage of investing over overpaying at the end of the term. Scroll sideways for every gap.">
          <SensitivityGrid rowPcts={SALARY_GROWTH_PRESETS} colPcts={GAP_PRESETS} cells={salaryGrid.cells} />
          <Body small muted>
            {'\n'}At your inputs — <Strong>{salaryGrid.yourSalaryGrowthPct.toFixed(1)}% salary growth</Strong>,{' '}
            <Strong>{salaryGrid.yourGapPct >= 0 ? `+${salaryGrid.yourGapPct.toFixed(1)}%` : `${salaryGrid.yourGapPct.toFixed(1)}%`} rate gap</Strong> —{' '}
            {salaryGrid.yourAdvantage >= 0 ? 'investing' : 'overpaying'} leads by <Strong>{formatCurrencyFull(Math.abs(salaryGrid.yourAdvantage))}</Strong>.
          </Body>
        </Card>
      ) : null}

      <Body small muted>Plan 2/5 only — check current SLC rates before relying on this for client advice.</Body>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  verdict: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 14 },
  verdictLabel: { fontSize: 11, letterSpacing: 0.6, marginBottom: 6 },
  verdictText: { fontSize: 19, fontWeight: '700', lineHeight: 26 },
});
