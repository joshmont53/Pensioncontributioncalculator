import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { calculatePension, compareScenarios, fmt, fmtD, pct, solvePensionGoal } from '@calc/core';
import type { GoalMode } from '@calc/core';
import { usePensionState } from '@/state/PensionContext';
import { useTaxConfig } from '@/state/TaxConfigContext';
import {
  Body, Callout, Card, ChoiceChips, NumberField, PrimaryButton, SecondaryButton, SectionLabel, StatRow, Strong,
  TextField, ToggleRow,
} from '@/components/ui';
import { Bucket, DividendShiftBar, IncomeBandsChart, UsageBar, WaterfallRow } from '@/components/pension';
import { AIComparison } from '@/components/ai';
import { useTheme } from '@/theme';

export default function PensionResultsScreen() {
  const t = useTheme();
  const s = usePensionState();
  const { config } = useTaxConfig();
  const {
    employedEarnings, selfEmployedEarnings, netContribution, netGiftAid, savingsInterest, rentalProfit,
    dividendIncome, hasStudentLoan, employerContribution, salarySacrifice, carryForward,
    goalMode, goalTargetMonthly, goalFloorMonthly, goalTaxBandIdx, goalPsaIdx, scenarios,
  } = s;
  const {
    B0, B2, TR_B, TR_H, TR_60, TR_A, SL_T, SL_R, SL_UNEARNED_THRESHOLD, TAX_YEAR, SL_PLAN,
    C1_Main, C1_Upper, C4_Main, C4_Upper, STANDARD_AA, TAPER_ADJUSTED, DIVIDEND_ALLOWANCE,
  } = config;

  // Same calculations as the web results page, from packages/core.
  const p = useMemo(() => calculatePension({
    employedEarnings, selfEmployedEarnings, netContribution, netGiftAid, savingsInterest,
    rentalProfit, dividendIncome, hasStudentLoan, employerContribution, salarySacrifice, carryForward,
  }, config), [config, employedEarnings, selfEmployedEarnings, netContribution, netGiftAid, savingsInterest,
      rentalProfit, dividendIncome, hasStudentLoan, employerContribution, salarySacrifice, carryForward]);
  const plannerResult = useMemo(
    () => solvePensionGoal(p, { goalMode, goalTargetMonthly, goalFloorMonthly, goalTaxBandIdx, goalPsaIdx }),
    [p, goalMode, goalTargetMonthly, goalFloorMonthly, goalTaxBandIdx, goalPsaIdx],
  );
  const scenarioResults = useMemo(() => compareScenarios(p, scenarios), [p, scenarios]);

  // Same fallback as the web page: the student loan goal disappears with the toggle.
  useEffect(() => {
    if (!hasStudentLoan && goalMode === 'student-loan') s.setGoalMode('take-home');
  }, [hasStudentLoan, goalMode]);

  const {
    totalEarnings, totalIncome, unearnedIncome, adjustedEarnings, grossContribution, grossGiftAid, effectiveEarnings,
    psaAmount, psaExempt, taxEngine, grossIncomeTax, grossDividendTax, pensionAdditionalRelief, giftAidAdditionalRelief,
    totalAdditionalRelief, combinedBands, studentLoanIncome, studentLoan, class1NI, class4NI, totalNI, takeHomePay,
    totalTaxLiability, thresholdIncome, adjustedIncomeForTaper, taperedAA, cfAvailable, totalCarryForward, totalPool,
    totalPensionInput, priorYearLabels, maxRelief, studentLoanFullyOffsettable, recommendedNet, recommendedGross,
    noContribTakeHome, withContribTotal, noContribTotal, totalRelief, insightText,
  } = p;

  const reliefAtSource = (grossContribution - netContribution) + (grossGiftAid - netGiftAid);
  const goals: { label: string; value: GoalMode }[] = [
    { value: 'take-home', label: 'Target take-home' },
    ...(hasStudentLoan ? [{ value: 'student-loan' as const, label: 'Offset student loan' }] : []),
    { value: 'max-pension', label: 'Maximise pension' },
    { value: 'tax-band', label: 'Hit tax threshold' },
    { value: 'savings-allowance', label: 'Recoup savings allowance' },
  ];

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>

      {/* ── Headline ── */}
      <View style={[styles.headline, { backgroundColor: t.brandSoft, borderColor: t.brandSoftBorder }]}>
        <Text style={[styles.headlineLabel, { color: t.brandSoftText }]}>TAKE-HOME PAY · {TAX_YEAR}</Text>
        <Text style={[styles.headlineValue, { color: t.text }]}>{fmtD(takeHomePay)}</Text>
        <Text style={[styles.headlineSub, { color: t.brandSoftText }]}>{fmtD(takeHomePay / 12)} a month in your bank</Text>
      </View>

      {/* ── AI: same question, generative vs agentic ── */}
      <AIComparison inputs={p.inputs} config={config} />

      <Card title="Calculated">
        <StatRow label="Gross pension" value={fmtD(grossContribution)} valueColor={t.brand} />
        <StatRow label="Effective earnings" value={fmtD(effectiveEarnings)} valueColor={t.brand} />
        {hasStudentLoan ? <StatRow label={`Student loan (${SL_PLAN})`} value={fmtD(studentLoan)} /> : null}
        <StatRow label="Class 4 NI" value={fmtD(class4NI)} last />
        <ToggleRow label={`Student loan (${SL_PLAN})`} value={hasStudentLoan} onChange={s.setHasStudentLoan} />
        <SecondaryButton title="Edit inputs" onPress={() => router.navigate('/pension')} />
      </Card>

      {insightText ? <Callout tone="warning">💡 {insightText}</Callout> : null}
      <View style={{ height: 14 }} />

      {/* ── Contribution planner ── */}
      <Card title="Contribution planner" collapsible
        subtitle="Set a financial goal — we'll calculate the exact pension contribution needed to achieve it. Tap Apply to load the result into the calculator.">
        <ChoiceChips options={goals} value={goalMode} onChange={s.setGoalMode} />

        {goalMode === 'take-home' ? (
          <NumberField label="I need at least this per month in my bank" value={goalTargetMonthly} onChange={s.setGoalTargetMonthly}
            hint="Maximise pension with the remaining income." />
        ) : null}
        {goalMode === 'student-loan' ? (
          <Callout>
            Find the pension contribution where the self-assessment refund is large enough to fully offset the annual
            student loan repayment of <Strong>{fmtD(studentLoan)}</Strong>. The loan is still repaid via PAYE, but the SA
            refund covers that cost in full.
          </Callout>
        ) : null}
        {goalMode === 'max-pension' ? (
          <NumberField label="Keep at least this per month in my bank" value={goalFloorMonthly} onChange={s.setGoalFloorMonthly}
            hint="Contribute everything else to pension." />
        ) : null}
        {goalMode === 'tax-band' ? (
          plannerResult.taxBandOptions.length > 0 ? (
            <ChoiceChips
              options={plannerResult.taxBandOptions.map((o, i) => ({ label: o.label, value: i }))}
              value={Math.min(goalTaxBandIdx, plannerResult.taxBandOptions.length - 1)}
              onChange={s.setGoalTaxBandIdx}
            />
          ) : <Body small muted>Threshold options will appear once earnings are entered.</Body>
        ) : null}
        {goalMode === 'savings-allowance' ? (
          savingsInterest <= 0 ? (
            <Body small muted>Enter a savings interest amount to see Personal Savings Allowance options.</Body>
          ) : plannerResult.psaOptions.length > 0 ? (
            <ChoiceChips
              options={plannerResult.psaOptions.map((o, i) => ({ label: o.label, value: i }))}
              value={Math.min(goalPsaIdx, plannerResult.psaOptions.length - 1)}
              onChange={s.setGoalPsaIdx}
            />
          ) : <Body small muted>You already receive the maximum Personal Savings Allowance at your income level.</Body>
        ) : null}

        {plannerResult.infeasible ? (
          <Callout tone="warning">{plannerResult.message}</Callout>
        ) : (
          <View style={[styles.planner, { backgroundColor: t.brandSoft, borderColor: t.brandSoftBorder }]}>
            <Text style={[styles.headlineLabel, { color: t.brandSoftText }]}>RECOMMENDED CONTRIBUTION</Text>
            <Text style={[styles.plannerValue, { color: t.brand }]}>{fmtD(plannerResult.nc)} <Text style={styles.plannerUnit}>net / yr</Text></Text>
            <Text style={[styles.plannerGross, { color: t.brandSoftText }]}>→ {fmtD(plannerResult.gc)} gross (inc. basic-rate top-up)</Text>
            <StatRow label="Projected take-home" value={`${fmtD(plannerResult.projectedTakeHome)} (${fmtD(plannerResult.projectedTakeHome / 12)}/mo)`} />
            <StatRow label="SA refund (additional relief)" value={fmtD(plannerResult.projectedAdditionalRelief)} />
            <StatRow label="Total govt top-up" value={fmtD((plannerResult.gc - plannerResult.nc) + plannerResult.projectedAdditionalRelief)} last />
            {plannerResult.exceedsAllowance ? (
              <Callout tone="warning">
                ⚠ Gross contribution of {fmtD(plannerResult.gc)} exceeds the standard annual allowance (£60,000). The client would
                need sufficient carry-forward or a higher individual allowance to avoid a tax charge.
              </Callout>
            ) : null}
            {plannerResult.partialNote ? <Callout tone="warning">⚠ {plannerResult.partialNote}</Callout> : null}
            <View style={{ height: 10 }} />
            <PrimaryButton title="Apply" onPress={() => s.setNetContribution(Math.round(plannerResult.nc))} />
          </View>
        )}
      </Card>

      {/* ── Scenario comparison ── */}
      <Card title="Scenario comparison" collapsible
        subtitle="Compare up to 3 contribution strategies. Use Snapshot to copy the current calculator values, or enter figures manually. Apply loads a scenario into the calculator.">
        {scenarioResults.map(sc => {
          const bestWealth = Math.max(...scenarioResults.map(r => r.totalWealth));
          const other = scenarioResults.find(r => r.id !== sc.id);
          const isBest = scenarios.length > 1 && sc.totalWealth === bestWealth && !!other && sc.totalWealth > other.totalWealth;
          const update = (patch: Partial<typeof sc>) => s.setScenarios(prev => prev.map(x => x.id === sc.id ? { ...x, ...patch } : x));
          return (
            <View key={sc.id} style={[styles.scenario, { borderColor: isBest ? t.brandSoftBorder : t.border, backgroundColor: isBest ? t.brandSoft : 'transparent' }]}>
              <View style={styles.scenarioHeader}>
                <View style={{ flex: 1 }}>
                  <TextField label="" value={sc.name} onChange={v => update({ name: v })} compact />
                </View>
                {isBest ? <Text style={[styles.badge, { backgroundColor: t.brand, color: t.onBrand }]}>Best</Text> : null}
                {scenarios.length > 1 ? (
                  <Pressable onPress={() => s.setScenarios(prev => prev.filter(x => x.id !== sc.id))} accessibilityRole="button"
                    accessibilityLabel={`Remove ${sc.name}`} hitSlop={8} style={{ paddingHorizontal: 6 }}>
                    <Text style={{ color: t.textMuted, fontSize: 22 }}>×</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.scenarioInputs}>
                <NumberField label="Net pension / yr" value={sc.netContribution} onChange={v => update({ netContribution: v })} compact />
                <NumberField label="Net gift aid / yr" value={sc.netGiftAid} onChange={v => update({ netGiftAid: v })} compact />
              </View>
              <StatRow label="Take-home" value={`${fmtD(sc.takeHome)} (${fmtD(sc.takeHome / 12)}/mo)`} />
              <StatRow label="Pension pot (gross)" value={fmtD(sc.gc)} valueColor={t.brand} />
              {sc.gga > 0 ? <StatRow label="Charity (gross)" value={fmtD(sc.gga)} valueColor={t.invest} /> : null}
              <StatRow label="SA refund" value={fmtD(sc.tar)} />
              <StatRow label="Govt top-up (total)" value={`+${fmtD(sc.govTopUp)}`} valueColor={t.brand} />
              <StatRow label="Total wealth" value={fmtD(sc.totalWealth)} valueColor={isBest ? t.brand : undefined} last />
              <View style={styles.scenarioButtons}>
                <View style={{ flex: 1 }}>
                  <SecondaryButton title="↓ Snapshot" onPress={() => update({ netContribution, netGiftAid })} />
                </View>
                <View style={{ flex: 1 }}>
                  <SecondaryButton title="Apply" onPress={() => { s.setNetContribution(sc.netContribution); s.setNetGiftAid(sc.netGiftAid); }} />
                </View>
              </View>
            </View>
          );
        })}
        {scenarios.length < 3 ? (
          <SecondaryButton title="+ Add scenario" onPress={() => {
            const letter = String.fromCharCode(64 + s.nextScenarioId);
            s.setScenarios(prev => [...prev, { id: s.nextScenarioId, name: `Option ${letter}`, netContribution: 0, netGiftAid: 0 }]);
            s.setNextScenarioId(v => v + 1);
          }} />
        ) : null}
      </Card>

      {/* ── Carry forward & annual allowance ── */}
      <Card title="Carry forward & annual allowance" collapsible
        subtitle={`Unused annual allowances from the past 3 tax years can be carried forward. Enter each prior year's allowance and how much was used.${adjustedIncomeForTaper > TAPER_ADJUSTED ? ` Adjusted income of ${fmtD(adjustedIncomeForTaper)} exceeds ${fmtD(TAPER_ADJUSTED)} — current year allowance is tapered.` : ''}`}>
        <StatRow label={`${TAX_YEAR} allowance${taperedAA < STANDARD_AA ? ` (tapered from ${fmtD(STANDARD_AA)})` : ''}`}
          value={fmtD(taperedAA)} valueColor={taperedAA < STANDARD_AA ? t.warningText : t.brand} />
        <StatRow label="Carry forward available" value={fmtD(totalCarryForward)} />
        <StatRow label="Total pool" value={fmtD(totalPool)} valueColor={totalPensionInput > totalPool ? t.negative : undefined} />
        <StatRow label={totalPensionInput > totalPool ? 'Exceeded by' : 'Remaining'}
          value={fmtD(totalPensionInput > totalPool ? totalPensionInput - totalPool : Math.max(0, totalPool - totalPensionInput))}
          valueColor={totalPensionInput > totalPool ? t.negative : t.brand} last />
        {taperedAA < STANDARD_AA ? (
          <Callout tone="warning">
            <Strong color={undefined}>Annual allowance tapered — adjusted income exceeds {fmtD(TAPER_ADJUSTED)}</Strong>{'\n'}
            Threshold income: {fmtD(thresholdIncome)} · Adjusted income: {fmtD(adjustedIncomeForTaper)}{'\n'}
            Reduction: {fmtD(Math.floor((adjustedIncomeForTaper - TAPER_ADJUSTED) / 2))} (£1 for every £2 above {fmtD(TAPER_ADJUSTED)})
          </Callout>
        ) : null}
        <View style={{ height: 12 }} />
        {priorYearLabels.map((label, i) => (
          <View key={label} style={styles.cfYear}>
            <SectionLabel>{label} · carry forward {cfAvailable[i] > 0 ? fmtD(cfAvailable[i]) : '—'}</SectionLabel>
            <View style={styles.scenarioInputs}>
              <NumberField compact label="Annual allowance" value={carryForward[i].allowance}
                onChange={v => s.setCarryForward(prev => prev.map((cf, j) => j === i ? { ...cf, allowance: v } : cf))} />
              <NumberField compact label="Contributions used" value={carryForward[i].used}
                onChange={v => s.setCarryForward(prev => prev.map((cf, j) => j === i ? { ...cf, used: v } : cf))} />
            </View>
          </View>
        ))}
      </Card>

      {/* ── Income and tax bands chart ── */}
      <Card title="Your income and tax bands" collapsible>
        <IncomeBandsChart
          earnings={totalEarnings}
          salarySacrifice={salarySacrifice}
          grossContribution={grossContribution}
          grossGiftAid={grossGiftAid}
          effectiveEarnings={effectiveEarnings}
          psaExempt={psaExempt}
          dividendIncome={dividendIncome}
          divBands={taxEngine.divBands}
          hasStudentLoan={hasStudentLoan}
          config={config}
        />
      </Card>

      {/* ── Card 1: Total tax liability ── */}
      <Card title="Total tax liability" collapsible
        subtitle={`Based on ${salarySacrifice > 0 ? `adjusted earnings (${fmtD(adjustedEarnings)}, after salary sacrifice)` : 'total earnings'}${psaExempt > 0 ? `, less ${fmtD(psaExempt)} savings allowance,` : ''} before any pension or gift aid relief.${dividendIncome > 0 ? ' Dividends are taxed separately, on top of all other income.' : ''}`}>
        <SectionLabel>Income tax</SectionLabel>
        {psaExempt > 0 ? <Body small>£{fmt(psaExempt)} of savings interest is tax-free under your Personal Savings Allowance (£{fmt(psaAmount)} available at your income level).</Body> : null}
        {taxEngine.taperedPA < B0 ? (
          <Body small>Your personal allowance is reduced from {fmtD(B0)} to {fmtD(taxEngine.taperedPA)} because total income{dividendIncome > 0 ? ' (including dividends)' : ''} exceeds {fmtD(B2)}.</Body>
        ) : null}
        {taxEngine.nonDivBands.filter(b => b.amount > 0).map(band => (
          <StatRow key={band.label} label={`${band.label} (${band.rate}%) · ${fmtD(band.amount)} taxable`} value={fmtD(band.tax)} />
        ))}
        <StatRow label="Total income tax" value={fmtD(grossIncomeTax)} last />

        {dividendIncome > 0 ? (
          <>
            <View style={{ height: 10 }} />
            <SectionLabel>Dividend tax</SectionLabel>
            {taxEngine.divBands.some(b => b.allowanceUsed > 0) ? (
              <Body small>£{fmt(taxEngine.divBands.reduce((sum, b) => sum + b.allowanceUsed, 0))} of dividends is tax-free under your dividend allowance (£{fmt(DIVIDEND_ALLOWANCE)}).</Body>
            ) : null}
            {taxEngine.divBands.filter(b => b.rate > 0 && b.amount > 0).map(band => (
              <StatRow key={band.label} label={`${band.label} (${band.rate}%) · ${fmtD(band.taxable)} taxable`} value={fmtD(band.tax)} />
            ))}
            <StatRow label="Total dividend tax" value={fmtD(grossDividendTax)} last />
          </>
        ) : null}

        <View style={{ height: 10 }} />
        <SectionLabel>National Insurance</SectionLabel>
        <StatRow label={`Class 1 (${C1_Main}% / ${C1_Upper}%) · PAYE – employed`} value={fmtD(class1NI)} />
        <StatRow label={`Class 4 (${C4_Main}% / ${C4_Upper}%) · Self-assessment`} value={fmtD(class4NI)} />
        <StatRow label="Total NI" value={fmtD(totalNI)} last />

        {hasStudentLoan ? (
          <>
            <View style={{ height: 10 }} />
            <SectionLabel>Student loan ({SL_PLAN})</SectionLabel>
            <StatRow label={`${SL_R}% above ${fmtD(SL_T)}`} value={fmtD(studentLoan)} last />
          </>
        ) : null}

        <View style={[styles.total, { borderTopColor: t.text }]}>
          <Text style={[styles.totalLabel, { color: t.text }]}>Total tax liability</Text>
          <Text style={[styles.totalValue, { color: t.text }]}>{fmtD(totalTaxLiability)}</Text>
        </View>
        <Body small muted>{pct((totalTaxLiability / totalIncome) * 100)} effective rate on total income</Body>
      </Card>

      {/* ── Card 2: Tax relief on contributions ── */}
      <Card title="Tax relief on contributions" collapsible
        subtitle="Combined pension and gift aid — rates show total relief (additional via self-assessment).">
        {(grossContribution + grossGiftAid) <= 0 || adjustedEarnings <= 0 ? (
          <Body muted>Enter a contribution to see the breakdown.</Body>
        ) : (() => {
          const before = pensionAdditionalRelief.atTop;
          const after = giftAidAdditionalRelief.atBottom;
          const beforeTaxable = before.nonDivBands.reduce((sum, b) => sum + b.amount, 0);
          const afterTaxable = after.nonDivBands.reduce((sum, b) => sum + b.amount, 0);
          const divReliefTotal = pensionAdditionalRelief.divRelief + giftAidAdditionalRelief.divRelief;
          const bandRows = [
            { label: `Higher rate ${TR_B + TR_H}% (${TR_H}%)`, amount: combinedBands.fromHigher, relief: combinedBands.fromHigher * (TR_H / 100) },
            { label: `Basic rate ${TR_B}% (0%)`, amount: combinedBands.fromBasic, relief: 0 },
            { label: `PA taper ${TR_B + TR_60}% (${TR_60}%)`, amount: combinedBands.from60, relief: combinedBands.from60 * (TR_60 / 100) },
            { label: `Additional ${TR_B + TR_A}% (${TR_A}%)`, amount: combinedBands.fromAdditional, relief: combinedBands.fromAdditional * (TR_A / 100) },
          ].filter(r => r.amount > 0);
          return (
            <>
              <SectionLabel>From salary & other non-dividend income</SectionLabel>
              {bandRows.length === 0 ? (
                <Body small muted>
                  Taxable income stays within the same rate band both before and after this contribution ({fmtD(beforeTaxable)} → {fmtD(afterTaxable)}) — no
                  additional relief from this leg, only the {TR_B}% already given at source.
                </Body>
              ) : (
                <>
                  <Body small muted>Taxable income: {fmtD(beforeTaxable)} → {fmtD(afterTaxable)}</Body>
                  {bandRows.map(row => (
                    <StatRow key={row.label} label={`From ${row.label} · ${fmtD(row.amount)} gross`}
                      value={row.relief > 0 ? `+${fmtD(row.relief)}` : '—'} valueColor={t.brand} />
                  ))}
                </>
              )}
              {dividendIncome > 0 ? (
                <>
                  <View style={{ height: 12 }} />
                  <SectionLabel>From dividends shifting tax bands</SectionLabel>
                  <Body small muted>
                    Your contribution doesn't reduce your dividends directly — but since dividends are taxed last, on top of everything
                    else, it does lower where they sit.
                  </Body>
                  <Text style={[styles.miniLabel, { color: t.textMuted }]}>Before</Text>
                  <DividendShiftBar result={before} nonDivGross={adjustedEarnings} domain={before.totalAllSources} />
                  <Text style={[styles.miniLabel, { color: t.textMuted }]}>After</Text>
                  <DividendShiftBar result={after} nonDivGross={effectiveEarnings} domain={before.totalAllSources} />
                  <StatRow label="Dividend tax before" value={fmtD(before.divTax)} />
                  <StatRow label="Dividend tax after" value={fmtD(after.divTax)} />
                  <StatRow label="Dividend relief" value={divReliefTotal > 0 ? `+${fmtD(divReliefTotal)}` : '—'}
                    valueColor={divReliefTotal > 0 ? t.brand : t.textMuted} last />
                  {divReliefTotal <= 0 ? <Body small muted>Your dividends stayed within the same rate band before and after this contribution — no relief from this leg.</Body> : null}
                </>
              ) : null}
              <View style={{ height: 12 }} />
            </>
          );
        })()}
        <StatRow label="Total gross contribution" value={fmtD(grossContribution + grossGiftAid)} />
        <StatRow label="Relief at source (20%)" value={`+${fmtD(reliefAtSource)}`} valueColor={t.brand} />
        <StatRow label="Additional relief (self-assessment)" value={`+${fmtD(totalAdditionalRelief)}`} valueColor={t.brand} />
        <StatRow label="Total tax relief" value={fmtD(reliefAtSource + totalAdditionalRelief)} valueColor={t.brand} last={psaExempt <= 0} />
        {psaExempt > 0 ? <StatRow label="Savings allowance (tax-free)" value={fmtD(psaExempt)} valueColor={t.income} last /> : null}
        {(netContribution + netGiftAid) > 0 ? (
          <Body small muted>{pct(((reliefAtSource + totalAdditionalRelief) / (netContribution + netGiftAid)) * 100)} effective relief rate on net contributions</Body>
        ) : null}
      </Card>

      {/* ── Card 3: Student loan impact ── */}
      {hasStudentLoan ? (
        <Card title="Student loan impact" collapsible
          subtitle="How your pension contribution and gift aid reduce your effective student loan burden.">
          {unearnedIncome > 0 ? (
            <Body small muted>
              {unearnedIncome > SL_UNEARNED_THRESHOLD
                ? `Unearned income of ${fmtD(unearnedIncome)} is included in full (exceeds the ${fmtD(SL_UNEARNED_THRESHOLD)} unearned income threshold).`
                : `Unearned income of ${fmtD(unearnedIncome)} is excluded (at or below the ${fmtD(SL_UNEARNED_THRESHOLD)} unearned income threshold).`}
              {savingsInterest > 0 ? `\n· Savings interest: ${fmtD(savingsInterest)}` : ''}
              {rentalProfit > 0 ? `\n· Rental profit: ${fmtD(rentalProfit)}` : ''}
              {dividendIncome > 0 ? `\n· Dividend income: ${fmtD(dividendIncome)}` : ''}
            </Body>
          ) : null}
          <StatRow label={`Threshold (${SL_PLAN})`} value={fmtD(SL_T)} />
          <StatRow label={salarySacrifice > 0 ? 'Adjusted earnings' : 'Total earnings'} value={fmtD(studentLoanIncome)} />
          <StatRow label="Earnings above threshold" value={fmtD(Math.max(0, studentLoanIncome - SL_T))}
            valueColor={studentLoanIncome <= SL_T ? t.textMuted : undefined} />
          <StatRow label={`Repayment (${SL_R}%)`} value={fmtD(studentLoan)} last={studentLoan === 0} />
          {studentLoan > 0 ? (
            <>
              <StatRow label="Additional relief generated" value={`+${fmtD(totalAdditionalRelief)}`} valueColor={t.brand} />
              <StatRow label="Student loan after relief" value={fmtD(Math.max(0, studentLoan - totalAdditionalRelief))} last />
            </>
          ) : null}
          {studentLoan > 0 && totalAdditionalRelief >= studentLoan ? (
            <Callout tone="success">✓ Your additional tax relief of {fmtD(totalAdditionalRelief)} fully covers your student loan repayment of {fmtD(studentLoan)}.</Callout>
          ) : null}
          {studentLoan > 0 && totalAdditionalRelief < studentLoan && studentLoanFullyOffsettable ? (
            <Callout tone="warning">Increase net pension to {fmtD(recommendedNet)} (gross: {fmtD(recommendedGross)}) to generate {fmtD(studentLoan)} in additional relief — fully covering your student loan.</Callout>
          ) : null}
          {studentLoan > 0 && !studentLoanFullyOffsettable ? (
            <Callout tone="warning">
              ⚠ This can't be fully offset through pension contributions alone. The maximum additional relief achievable is {fmtD(maxRelief)} (at
              a {fmtD(recommendedNet)} net contribution, gross: {fmtD(recommendedGross)}), leaving {fmtD(studentLoan - maxRelief)} of your student loan uncovered.
            </Callout>
          ) : null}
          {studentLoan === 0 ? <Body small muted>No student loan repayment at current earnings.</Body> : null}
        </Card>
      ) : null}

      {/* ── Take-home summary ── */}
      <Card title="Take-home pay summary" collapsible
        subtitle="Annual position after all taxes, contributions, and self-assessment refunds. Income tax is on gross earnings; the SA refund returns additional relief.">
        <WaterfallRow label="Total earnings" value={totalEarnings} plus />
        {dividendIncome > 0 ? <WaterfallRow label="Dividend income" value={dividendIncome} plus /> : null}
        {salarySacrifice > 0 ? <WaterfallRow label="Salary sacrifice (pension)" value={salarySacrifice} minus /> : null}
        <WaterfallRow label="Income tax" value={grossIncomeTax} minus />
        {grossDividendTax > 0 ? <WaterfallRow label="Dividend tax" value={grossDividendTax} minus /> : null}
        {class1NI > 0 ? <WaterfallRow label="NI Class 1 — employed (PAYE)" value={class1NI} minus indent /> : null}
        {class4NI > 0 ? <WaterfallRow label="NI Class 4 — self-employed (SA)" value={class4NI} minus indent /> : null}
        <WaterfallRow label={`Student loan (${SL_PLAN})`} value={studentLoan} minus />
        <WaterfallRow label="Net pension contribution" value={netContribution} minus />
        {netGiftAid > 0 ? <WaterfallRow label="Net gift aid donation" value={netGiftAid} minus /> : null}
        {totalAdditionalRelief > 0 ? <WaterfallRow label="SA refund (additional relief)" value={totalAdditionalRelief} plus /> : null}
        <View style={[styles.total, { borderTopColor: t.text }]}>
          <Text style={[styles.totalLabel, { color: t.text }]}>Take-home pay (in bank)</Text>
          <Text style={[styles.totalValue, { color: t.text }]}>{fmtD(takeHomePay)}</Text>
        </View>

        <View style={{ height: 16 }} />
        <SectionLabel>Where your earnings go</SectionLabel>
        <Bucket label="In your bank" value={takeHomePay} pct={(takeHomePay / totalIncome) * 100} background="#1a1a18" />
        <Bucket label="Pension pot (gross)" sublabel={salarySacrifice > 0 ? 'personal + salary sacrifice' : 'inc. 20% basic rate top-up from HMRC'}
          value={grossContribution + salarySacrifice} pct={((grossContribution + salarySacrifice) / Math.max(1, totalIncome)) * 100} background="#1d4e3a" />
        {employerContribution > 0 ? (
          <Bucket label="Employer pension" sublabel="not from your earnings" value={employerContribution}
            pct={(employerContribution / Math.max(1, totalIncome)) * 100} background="#2a6e50" />
        ) : null}
        {grossGiftAid > 0 ? (
          <Bucket label="Charity (gross)" sublabel="inc. 20% gift aid top-up from HMRC" value={grossGiftAid}
            pct={(grossGiftAid / totalIncome) * 100} background="#4a90a4" />
        ) : null}
        <Bucket label="Tax & NI" sublabel="income tax + dividend tax (net of relief) + NI"
          value={grossIncomeTax + grossDividendTax - totalAdditionalRelief + totalNI}
          pct={((grossIncomeTax + grossDividendTax - totalAdditionalRelief + totalNI) / totalIncome) * 100} background="" light />
        <Bucket label={`Student loan (${SL_PLAN})`} value={studentLoan} pct={(studentLoan / totalIncome) * 100} background="" light />

        {(netContribution > 0 || netGiftAid > 0 || salarySacrifice > 0 || employerContribution > 0) ? (
          <>
            <View style={{ height: 16 }} />
            <SectionLabel>Impact of contributions</SectionLabel>
            <Body small muted>How your overall financial position compares to making no pension or gift aid contributions.</Body>
            <StatRow label="In bank — without contributions" value={fmtD(noContribTakeHome)} />
            <StatRow label="In bank — with contributions" value={fmtD(takeHomePay)} />
            <StatRow label="Bank impact" value={`${takeHomePay - noContribTakeHome >= 0 ? '+' : '−'}${fmtD(Math.abs(Math.round(takeHomePay - noContribTakeHome)))}`}
              valueColor={takeHomePay - noContribTakeHome >= 0 ? t.brand : t.negative} />
            <StatRow label="Pension gained (gross)" value={`+${fmtD(grossContribution)}`} valueColor={t.brand} />
            {grossGiftAid > 0 ? <StatRow label="Charity (gross)" value={`+${fmtD(grossGiftAid)}`} valueColor={t.brand} /> : null}
            <StatRow label="Total wealth — without" value={fmtD(noContribTotal)} />
            <StatRow label="Total wealth — with" value={fmtD(withContribTotal)} valueColor={t.brand} />
            <StatRow label="Net gain (govt top-ups)" value={`+${fmtD(Math.abs(Math.round(totalRelief)))}`} valueColor={t.brand} last />
            {totalRelief > 0 ? (
              <Callout>
                By making contributions of {fmtD(netContribution + netGiftAid)} net ({fmtD(grossContribution + grossGiftAid)} gross), your total wealth
                is <Strong color={t.brand}>{fmtD(totalRelief)} higher</Strong> than if you made no contributions. The extra {fmtD(totalRelief)} comes
                entirely from government tax relief — {fmtD(reliefAtSource)} added at source
                {totalAdditionalRelief > 0 ? ` and ${fmtD(totalAdditionalRelief)} returned via self-assessment` : ''}. Your bank account
                is {fmtD(Math.abs(takeHomePay - noContribTakeHome))} {takeHomePay < noContribTakeHome ? 'lower' : 'higher'}, but your pension pot
                is {fmtD(grossContribution)} larger.
              </Callout>
            ) : null}
          </>
        ) : null}
      </Card>

      {/* ── Annual allowance usage ── */}
      <Card title="Annual allowance usage" collapsible
        subtitle={`Current year first, then carry forward from oldest. Total pension input: ${fmtD(totalPensionInput)}.`}>
        {(() => {
          let rem = totalPensionInput;
          const currentUsed = Math.min(rem, taperedAA);
          rem = Math.max(0, rem - currentUsed);
          const cfDrawdown = cfAvailable.map(avail => {
            const u = Math.min(rem, avail);
            rem = Math.max(0, rem - u);
            return u;
          });
          const overrun = rem;
          const bars = [
            { label: TAX_YEAR, note: taperedAA < STANDARD_AA ? 'Tapered' : 'Current year', total: taperedAA, used: currentUsed, current: true },
            ...priorYearLabels.map((label, i) => ({
              label, note: `Carry forward${cfAvailable[i] === 0 ? ' (none)' : ''}`, total: cfAvailable[i], used: cfDrawdown[i], current: false,
            })),
          ];
          return (
            <>
              {bars.map(bar => (
                <View key={bar.label} style={styles.usageRow}>
                  <View style={styles.usageHeader}>
                    <Text style={[styles.usageLabel, { color: t.text }]}>{bar.label} <Text style={{ color: t.textMuted, fontWeight: '400' }}>· {bar.note}</Text></Text>
                    <Text style={[styles.usageValue, { color: t.text }]}>{bar.total > 0 ? `${fmtD(bar.used)} / ${fmtD(bar.total)}` : '—'}</Text>
                  </View>
                  {bar.total > 0 ? <UsageBar used={bar.used} total={bar.total} current={bar.current} /> : <Body small muted>No carry forward available</Body>}
                  {bar.total > 0 ? (
                    <Text style={[styles.usageNote, { color: bar.used < bar.total ? t.brand : t.textMuted }]}>
                      {bar.used < bar.total ? `${fmtD(bar.total - bar.used)} remaining` : 'Fully used'}
                    </Text>
                  ) : null}
                </View>
              ))}
              {overrun > 0 ? (
                <Callout tone="danger">⚠ Total pension input of {fmtD(totalPensionInput)} exceeds available pool of {fmtD(totalPool)} by {fmtD(overrun)}. A tax charge may apply.</Callout>
              ) : null}
              <View style={{ height: 8 }} />
              <StatRow label="Total pool" value={fmtD(totalPool)} />
              <StatRow label="Used" value={fmtD(Math.min(totalPensionInput, totalPool))} />
              <StatRow label="Remaining" value={fmtD(Math.max(0, totalPool - totalPensionInput))} valueColor={t.brand} last />
            </>
          );
        })()}
      </Card>

      <Body small muted>Tax year {TAX_YEAR}. Figures are estimates — verify against current HMRC guidance before relying on them for client advice.</Body>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  headline: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 14 },
  headlineLabel: { fontSize: 11, letterSpacing: 0.6, marginBottom: 4 },
  headlineValue: { fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
  headlineSub: { fontSize: 13, marginTop: 2 },
  planner: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 6 },
  plannerValue: { fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  plannerUnit: { fontSize: 13, fontWeight: '400' },
  plannerGross: { fontSize: 13, marginBottom: 8 },
  scenario: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12 },
  scenarioHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scenarioInputs: { flexDirection: 'row', gap: 10 },
  scenarioButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  cfYear: { marginBottom: 6 },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 2, paddingTop: 10, marginTop: 10 },
  totalLabel: { fontSize: 15, fontWeight: '700' },
  totalValue: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  miniLabel: { fontSize: 11, marginTop: 8, marginBottom: 4 },
  usageRow: { marginBottom: 12 },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  usageLabel: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  usageValue: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  usageNote: { fontSize: 11, marginTop: 3 },
});
