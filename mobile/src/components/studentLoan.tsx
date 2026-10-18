import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatCurrencyFull, formatCurrencyShort, fmtGBP } from '@calc/core';
import type { GapSeries, YearlySnapshot } from '@calc/core';
import { NumberField } from '@/components/ui';
import type { ChartSeries } from '@/components/LineChart';
import { useTheme } from '@/theme';
import type { Palette } from '@/theme';

// Student loan result pieces that need more than the generic UI kit.

// Same diverging ramp as the web RateGapChart: orange favours overpaying,
// green favours investing.
const GAP_COLORS: Record<number, string> = {
  [-4]: '#c8794a',
  [-2]: '#e8a87c',
  [0]: '#a8a8a0',
  [2]: '#6fa88f',
  [4]: '#3d7a5e',
  [6]: '#1d4e3a',
};

export function gapChartSeries(series: GapSeries[], t: Palette): ChartSeries[] {
  return series.map(s => ({
    key: s.key,
    label: s.label,
    color: s.gapPct === null ? t.text : (GAP_COLORS[s.gapPct] ?? t.textMuted),
    values: s.points.map(p => p.advantage),
    dashed: s.gapPct === null,
    width: s.gapPct === null ? 2.5 : 1.75,
    markers: s.crossings,
  }));
}

// Same orange/white/green scale as the web SalaryGrowthSensitivityGrid.
function cellColor(value: number, maxAbs: number, dark: boolean): string {
  const base = dark ? [30, 30, 28] : [255, 255, 255];
  if (maxAbs <= 0) return `rgb(${base.join(',')})`;
  const t = Math.min(0.8, Math.abs(value) / maxAbs);
  const target = value >= 0 ? [29, 78, 58] : [232, 168, 124];
  const rgb = base.map((w, i) => Math.round(w + (target[i] - w) * t));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

export function SensitivityGrid({ rowPcts, colPcts, cells }: { rowPcts: number[]; colPcts: number[]; cells: number[][] }) {
  const t = useTheme();
  const dark = t.background !== '#faf9f6';
  const maxAbs = Math.max(1, ...cells.flat().map(v => Math.abs(v)));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={styles.row}>
          <Text style={[styles.rowHeader, { color: t.textMuted }]}>Salary ↓ / Gap →</Text>
          {colPcts.map(gap => (
            <Text key={gap} style={[styles.colHeader, { color: t.textMuted }]}>{gap > 0 ? `+${gap}%` : `${gap}%`}</Text>
          ))}
        </View>
        {rowPcts.map((salaryGrowth, rowIdx) => (
          <View key={salaryGrowth} style={styles.row}>
            <Text style={[styles.rowHeader, { color: t.text }]}>{salaryGrowth}% growth</Text>
            {colPcts.map((gap, colIdx) => {
              const value = cells[rowIdx][colIdx];
              const strong = Math.abs(value) / maxAbs > 0.45;
              return (
                <View key={gap} style={[styles.cell, { backgroundColor: cellColor(value, maxAbs, dark) }]}
                  accessibilityLabel={`${salaryGrowth}% salary growth, ${gap}% gap: ${formatCurrencyFull(value)}`}>
                  <Text style={[styles.cellText, { color: strong && value >= 0 ? '#ffffff' : t.text }]}>{formatCurrencyShort(value)}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const COLUMNS: { label: string; width: number; value: (r: YearlySnapshot, real: boolean) => string; color?: (t: Palette) => string }[] = [
  { label: 'Salary', width: 84, value: r => fmtGBP(r.annualSalary) },
  { label: 'Rate', width: 60, value: r => `${r.loanInterestRatePct.toFixed(2)}%` },
  { label: 'Repayment', width: 84, value: r => fmtGBP(r.baseMonthlyRepayment) },
  { label: 'Extra', width: 64, value: r => fmtGBP(r.extraMonthly) },
  { label: 'Debt (invest)', width: 96, value: r => fmtGBP(r.investDebtRemaining) },
  { label: 'Debt (overpay)', width: 104, value: r => fmtGBP(r.overpayDebtRemaining) },
  { label: 'Wealth (invest)', width: 108, value: (r, real) => fmtGBP(real ? r.investWealthReal : r.investWealthNominal), color: t => t.invest },
  { label: 'Wealth (overpay)', width: 116, value: (r, real) => fmtGBP(real ? r.overpayWealthReal : r.overpayWealthNominal), color: t => t.brand },
];

export function YearlyTable({ rows, startYear, showRealTerms }: { rows: YearlySnapshot[]; startYear: number; showRealTerms: boolean }) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        <View style={[styles.tableRow, { borderBottomColor: t.border }]}>
          <Text style={[styles.th, styles.yearCol, { color: t.textMuted }]}>Year</Text>
          {COLUMNS.map(c => <Text key={c.label} style={[styles.th, { width: c.width, color: t.textMuted }]}>{c.label}</Text>)}
        </View>
        {rows.map(r => (
          <View key={r.year} style={[styles.tableRow, { borderBottomColor: t.border }]}>
            <Text style={[styles.td, styles.yearCol, { color: t.text, fontWeight: '600', textAlign: 'left' }]}>{startYear + r.year - 1}</Text>
            {COLUMNS.map(c => (
              <Text key={c.label} style={[styles.td, { width: c.width, color: c.color ? c.color(t) : t.textSecondary, fontWeight: c.color ? '700' : '400' }]}>
                {c.value(r, showRealTerms)}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// Year-1-anchored deflator, matching the web AdvancedSalaryTable.
const realDeflator = (inflationRate: number, year: number) => Math.pow(1 + inflationRate, year - 1);

export function AdvancedSalaryList({
  startYear, salaryByYear, annualSalary, setAnnualSalary, salaryOverrides, setSalaryOverrides, showRealTerms, inflationRate,
}: {
  startYear: number;
  salaryByYear: number[];
  annualSalary: number;
  setAnnualSalary: (v: number) => void;
  salaryOverrides: Record<number, number>;
  setSalaryOverrides: (updater: (prev: Record<number, number>) => Record<number, number>) => void;
  showRealTerms: boolean;
  inflationRate: number;
}) {
  const t = useTheme();
  const toDisplay = (nominal: number, year: number) =>
    showRealTerms ? Math.round(nominal / realDeflator(inflationRate, year)) : nominal;
  const toNominal = (displayValue: number, year: number) =>
    showRealTerms ? Math.round(displayValue * realDeflator(inflationRate, year)) : displayValue;

  return (
    <View>
      {salaryByYear.map((salary, i) => {
        const year = i + 1;
        const isOverridden = year !== 1 && salaryOverrides[year] != null;
        const nominalValue = year === 1 ? annualSalary : salary;
        return (
          <View key={year} style={styles.salaryRow}>
            <View style={{ flex: 1 }}>
              <NumberField
                label={`${startYear + i}${isOverridden ? ' · pinned' : ''}`}
                value={toDisplay(nominalValue, year)}
                onChange={v => {
                  const nominal = toNominal(v, year);
                  if (year === 1) setAnnualSalary(nominal);
                  else setSalaryOverrides(prev => ({ ...prev, [year]: nominal }));
                }}
              />
            </View>
            {isOverridden ? (
              <Pressable
                onPress={() => setSalaryOverrides(prev => {
                  const next = { ...prev };
                  delete next[year];
                  return next;
                })}
                accessibilityRole="button"
                accessibilityLabel={`Reset ${startYear + i} salary to auto-calculated`}
                style={styles.reset}
              >
                <Text style={{ color: t.brand, fontWeight: '600' }}>Reset</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowHeader: { width: 92, fontSize: 12, fontWeight: '500', paddingVertical: 6 },
  colHeader: { width: 64, fontSize: 11, textAlign: 'center', fontWeight: '600' },
  cell: { width: 64, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  cellText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  th: { fontSize: 11, fontWeight: '600', textAlign: 'right', paddingHorizontal: 4 },
  td: { fontSize: 13, textAlign: 'right', paddingHorizontal: 4, fontVariant: ['tabular-nums'] },
  yearCol: { width: 52, textAlign: 'left' },
  salaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reset: { paddingHorizontal: 8, paddingVertical: 10, marginTop: 8 },
});
