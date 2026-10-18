import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_CONFIG } from '@calc/core';
import type { TaxConfig } from '@calc/core';
import { useTaxConfig } from '@/state/TaxConfigContext';
import { Body, Callout, Card, NumberField, PrimaryButton, SecondaryButton, TextField } from '@/components/ui';
import { useTheme } from '@/theme';

// Mobile equivalent of the web /admin page: same fields, grouping and help text.

type Field = { key: keyof TaxConfig; label: string; description: string; unit?: '£' | '%' };

const SECTIONS: { title: string; note?: string; fields: Field[] }[] = [
  {
    title: 'General',
    fields: [
      { key: 'TAX_YEAR', label: 'Tax year', description: 'The tax year this configuration applies to, e.g. 2024/25' },
      { key: 'SL_PLAN', label: 'Student loan plan name', description: 'Display name for the student loan plan, e.g. Plan 2' },
    ],
  },
  {
    title: 'Income Tax — Band Boundaries',
    note: 'The personal allowance taper calculation assumes B3 = B2 + 2×B0 (i.e. the additional rate threshold is exactly where the personal allowance reaches £0). Editing these independently of that relationship will make the taper figures inconsistent with real HMRC rules.',
    fields: [
      { key: 'B0', label: 'Personal allowance upper limit', description: 'Upper boundary of the nil-rate / personal allowance band', unit: '£' },
      { key: 'B1', label: 'Basic rate upper limit', description: 'Upper boundary of the basic rate (20%) band', unit: '£' },
      { key: 'B2', label: 'Personal allowance taper upper limit', description: 'Upper boundary of the 60% effective rate (PA taper) band', unit: '£' },
      { key: 'B3', label: 'Additional rate threshold', description: 'Income at which the 45% additional rate begins', unit: '£' },
    ],
  },
  {
    title: 'Pension & Gift Aid Relief Rates',
    note: 'Additional relief rates reclaimed via self-assessment (on top of basic rate relief added at source).',
    fields: [
      { key: 'TR_B', label: 'Basic rate — at source', description: 'Relief automatically added to pension/gift aid contributions', unit: '%' },
      { key: 'TR_H', label: 'Higher rate — additional relief', description: 'Extra relief for income in the 40% band', unit: '%' },
      { key: 'TR_60', label: 'PA taper — additional relief', description: 'Extra relief for income in the 60% effective rate band', unit: '%' },
      { key: 'TR_A', label: 'Additional rate — additional relief', description: 'Extra relief for income in the 45% band (above £125,140)', unit: '%' },
    ],
  },
  {
    title: 'National Insurance',
    note: 'Class 1 is paid by employees through PAYE. Class 4 is paid by the self-employed via self-assessment. Both share the same band thresholds.',
    fields: [
      { key: 'NI_L', label: 'Primary threshold (lower)', description: 'Earnings below this are exempt from NI', unit: '£' },
      { key: 'NI_U', label: 'Upper earnings limit', description: 'Earnings above this pay the upper rate', unit: '£' },
      { key: 'C1_Main', label: 'Class 1 main rate', description: 'Employee NI rate on earnings between L and U', unit: '%' },
      { key: 'C1_Upper', label: 'Class 1 upper rate', description: 'Employee NI rate on earnings above U', unit: '%' },
      { key: 'C4_Main', label: 'Class 4 main rate', description: 'Self-employed NI rate on profits between L and U (shared with Class 1)', unit: '%' },
      { key: 'C4_Upper', label: 'Class 4 upper rate', description: 'Self-employed NI rate on profits above U', unit: '%' },
    ],
  },
  {
    title: 'Student Loan',
    fields: [
      { key: 'SL_T', label: 'Repayment threshold', description: 'Annual earnings above which student loan repayments begin', unit: '£' },
      { key: 'SL_R', label: 'Repayment rate', description: 'Percentage of earnings above the threshold that is repaid', unit: '%' },
      { key: 'SL_UNEARNED_THRESHOLD', label: 'Unearned income de minimis', description: 'If combined unearned income (savings interest + rental profit) exceeds this, the entire amount counts toward student loan repayment income (not just the excess)', unit: '£' },
    ],
  },
  {
    title: 'Personal Savings Allowance',
    note: 'Tax-free savings interest allowance. The tier is determined by adjusted net income against the Basic rate upper limit (B1) and Additional rate threshold (B3) above — no separate threshold is configured here; above B3 the allowance is always £0.',
    fields: [
      { key: 'PSA_BASIC', label: 'Basic-rate PSA', description: 'Tax-free savings interest allowance when adjusted net income is at or below the basic rate upper limit', unit: '£' },
      { key: 'PSA_HIGHER', label: 'Higher-rate PSA', description: 'Tax-free savings interest allowance when adjusted net income is between the basic rate upper limit and the additional rate threshold', unit: '£' },
    ],
  },
  {
    title: 'Dividend Income',
    note: 'Dividends sit at the top of the income stack, above non-savings and savings income, and are taxed using their own rates. The dividend allowance is flat — unlike the Personal Savings Allowance above, it does not vary by income band.',
    fields: [
      { key: 'DIVIDEND_ALLOWANCE', label: 'Dividend allowance', description: 'Tax-free dividend income allowance, available regardless of income band', unit: '£' },
      { key: 'DIV_ORDINARY', label: 'Ordinary dividend rate', description: 'Rate applied to dividends within the basic rate band position', unit: '%' },
      { key: 'DIV_UPPER', label: 'Upper dividend rate', description: 'Rate applied to dividends within the higher rate / PA taper band position', unit: '%' },
      { key: 'DIV_ADDITIONAL', label: 'Additional dividend rate', description: 'Rate applied to dividends above the additional rate threshold', unit: '%' },
    ],
  },
  {
    title: 'Annual Allowance & Tapering',
    note: 'The standard annual allowance reduces for high earners. Tapering applies when threshold income exceeds the threshold limit AND adjusted income exceeds the adjusted income limit.',
    fields: [
      { key: 'STANDARD_AA', label: 'Standard annual allowance', description: 'Maximum pension contribution eligible for relief (standard = £60,000)', unit: '£' },
      { key: 'TAPER_THRESHOLD', label: 'Threshold income limit', description: 'If threshold income is at or below this, tapering does not apply', unit: '£' },
      { key: 'TAPER_ADJUSTED', label: 'Adjusted income taper point', description: 'Adjusted income above which the annual allowance starts to reduce', unit: '£' },
      { key: 'TAPER_MIN_AA', label: 'Minimum tapered allowance', description: 'The floor for the tapered annual allowance', unit: '£' },
    ],
  },
];

export default function TaxSettingsScreen() {
  const t = useTheme();
  const { config, saveConfig, resetConfig } = useTaxConfig();
  const [form, setForm] = useState<TaxConfig>(config);
  const [saved, setSaved] = useState(false);

  // Pick up the stored config if it finishes loading after this screen opens.
  useEffect(() => setForm(config), [config]);

  const set = (key: keyof TaxConfig, value: string | number) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    await saveConfig(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    Alert.alert('Reset to defaults?', 'This replaces every value with the built-in defaults.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => { await resetConfig(); setForm(DEFAULT_CONFIG); } },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: t.text }]}>Tax Configuration</Text>
        <Body muted>Update these values when HMRC changes tax bands or rates. Changes apply as soon as you save.</Body>
        <Callout tone="warning">Always verify figures against HMRC guidance before saving. Settings are stored on this device only.</Callout>
        <View style={{ height: 14 }} />

        {SECTIONS.map(section => (
          <Card key={section.title} title={section.title} subtitle={section.note}>
            {section.fields.map(f => typeof DEFAULT_CONFIG[f.key] === 'string' ? (
              <TextField key={f.key} label={f.label} hint={f.description} value={String(form[f.key])} onChange={v => set(f.key, v)} />
            ) : (
              <NumberField
                key={f.key}
                label={f.label}
                hint={f.description}
                kind={f.unit === '£' ? 'currency' : 'decimal'}
                suffix={f.unit === '%' ? '%' : undefined}
                value={form[f.key] as number}
                onChange={v => set(f.key, v)}
              />
            ))}
          </Card>
        ))}

        <PrimaryButton title={saved ? '✓ Saved' : 'Save changes'} onPress={handleSave} />
        <View style={{ height: 10 }} />
        <SecondaryButton title="Reset to defaults" destructive onPress={handleReset} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
});
