import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { usePensionState } from '@/state/PensionContext';
import { useTaxConfig } from '@/state/TaxConfigContext';
import { Body, Card, NumberField, PrimaryButton, SecondaryButton, ToggleRow } from '@/components/ui';
import { useTheme } from '@/theme';

export default function PensionInputScreen() {
  const t = useTheme();
  const s = usePensionState();
  const { config, isCustom } = useTaxConfig();

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: t.text }]}>Pension Contribution Calculator</Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          Work out the tax relief, National Insurance and student loan impact of your pension contributions and
          gift aid donations, then plan the exact figures needed to hit your goals.
        </Text>

        <Card title="Earnings" accent={t.invest}>
          <NumberField label="Employed earnings" value={s.employedEarnings} onChange={s.setEmployedEarnings} />
          <NumberField label="Self-employed profit" value={s.selfEmployedEarnings} onChange={s.setSelfEmployedEarnings} />
        </Card>

        <Card title="Unearned income" accent={t.income}>
          <NumberField label="Savings interest" value={s.savingsInterest} onChange={s.setSavingsInterest}
            hint="Gross interest received on savings/investments over the tax year. Shielded in part by your Personal Savings Allowance." />
          <NumberField label="Rental profit (taxable)" value={s.rentalProfit} onChange={s.setRentalProfit}
            hint="Rental income after allowable expenses or any property allowance claimed. Do not enter gross rent received." />
          <NumberField label="Dividend income" value={s.dividendIncome} onChange={s.setDividendIncome}
            hint={`Gross dividend income for the tax year. Taxed last, on top of all other income. Shielded in part by your £${config.DIVIDEND_ALLOWANCE} dividend allowance.`} />
        </Card>

        <Card title="Pension & gift aid" accent={t.brand}>
          <NumberField label="Net pension" value={s.netContribution} onChange={s.setNetContribution}
            hint="Amount you personally contribute. Provider adds 20% basic rate relief on top." />
          <NumberField label="Employer pension" value={s.employerContribution} onChange={s.setEmployerContribution}
            hint="Total employer pension contributions for the tax year." />
          <NumberField label="Salary sacrifice" value={s.salarySacrifice} onChange={s.setSalarySacrifice}
            hint="Annual salary sacrifice pension amount (deducted before tax and NI)." />
          <NumberField label="Net gift aid" value={s.netGiftAid} onChange={s.setNetGiftAid}
            hint="Amount donated to charity. Charity reclaims 20% basic rate from HMRC." />
        </Card>

        <Card title="Student loan" accent={t.warning}>
          <ToggleRow
            label={`I have a student loan (${config.SL_PLAN})`}
            hint="Repayments are calculated purely from income above the threshold; outstanding balance isn't taken into account."
            value={s.hasStudentLoan}
            onChange={s.setHasStudentLoan}
          />
        </Card>

        <PrimaryButton title="See results" onPress={() => router.push('/pension/results')} />
        <Text style={{ height: 10 }} />
        <SecondaryButton title="Tax configuration" onPress={() => router.push('/pension/settings')} />
        <Body small muted>
          {'\n'}Tax year {config.TAX_YEAR}{isCustom ? ' · using your saved tax configuration' : ''}.
        </Body>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 20, fontStyle: 'italic', marginBottom: 18 },
});
