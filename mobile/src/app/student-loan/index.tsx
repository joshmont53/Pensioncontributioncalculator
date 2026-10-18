import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useStudentLoanState } from '@/state/StudentLoanContext';
import { Body, Card, NumberField, PrimaryButton, Segmented } from '@/components/ui';
import { useTheme } from '@/theme';

export default function StudentLoanInputScreen() {
  const t = useTheme();
  const s = useStudentLoanState();

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: t.text }]}>Student Loan Repayment Calculator</Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          Compare overpaying a student loan against investing the same money instead — as a one-off lump sum,
          an ongoing extra monthly amount, or both.
        </Text>

        <Card title="Loan details" accent={t.invest}>
          <Segmented
            label="Loan plan"
            options={[{ label: 'Plan 2', value: 2 }, { label: 'Plan 5', value: 5 }]}
            value={s.loanPlan}
            onChange={s.setLoanPlan}
          />
          <NumberField label="Start year" kind="year" value={s.startYear} onChange={s.setStartYear}
            hint="The tax year to start modelling from." />
          <NumberField label="Graduation year" kind="year" value={s.graduationYear} onChange={s.setGraduationYear}
            hint="The year you graduated (or left the course). Repayments start the following April." />
        </Card>

        <Card title="Income & growth assumptions" accent={t.income}>
          <NumberField label="Annual salary" value={s.annualSalary} onChange={s.setAnnualSalary}
            hint="Gross salary in year 1 of the model." />
          <NumberField label="Salary growth" kind="percent" value={s.salaryGrowthRate} onChange={s.setSalaryGrowthRate}
            hint="Assumed annual salary growth rate." />
          <NumberField label="Inflation (RPI)" kind="percent" value={s.inflationRate} onChange={s.setInflationRate}
            hint="Drives the loan interest rate, repayment threshold, and real-terms figures." />
          <NumberField label="Savings growth" kind="percent" value={s.savingsGrowthRate} onChange={s.setSavingsGrowthRate}
            hint="Assumed annual investment/savings growth rate for the 'invest' scenario." />
        </Card>

        <Card title="Outstanding balance" accent={t.brand}>
          <NumberField label="Debt amount" value={s.debtAmount} onChange={s.setDebtAmount}
            hint="Current outstanding student loan balance." />
        </Card>

        <Card title="Extra repayment options" accent={t.warning}
          subtitle="Both optional — leave either (or both) at £0. Fill in one to model that option alone, or both to model doing them together.">
          <NumberField label="One-off lump sum" value={s.lumpSumAmount} onChange={s.setLumpSumAmount}
            hint="Available today — either invested, or put straight toward the loan balance." />
          <NumberField label="Extra monthly amount" value={s.extraMonthlyReal} onChange={s.setExtraMonthlyReal}
            hint="In today's money — either invested, or added to the monthly repayment. Rises with inflation each year." />
        </Card>

        <PrimaryButton title="See results" onPress={() => router.push('/student-loan/results')} />
        <Body small muted>
          {'\n'}Plan 2 and Plan 5 only. Uses simplified interest and threshold assumptions — check current SLC rates
          before relying on this for client advice.
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
