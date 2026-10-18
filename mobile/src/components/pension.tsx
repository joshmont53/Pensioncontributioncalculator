import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { fmtD, fmtGBP } from '@calc/core';
import type { DividendBand, TaxConfig, TaxResult } from '@calc/core';
import { useTheme } from '@/theme';

// Pension result visuals: native replacements for the web canvas timeline and
// the CSS band bars.

const BAND_FILLS = ['#eeede8', '#dde8e2', '#b8d4c4', '#9cbfac', '#7daa93'];
const DIV_COLORS: Record<string, string> = {
  'Ordinary dividend rate': '#8fbcdb',
  'Upper dividend rate': '#4a86ad',
  'Additional dividend rate': '#245a7d',
};
const PENSION = '#e8a87c';
const GIFT_AID = '#4a90a4';
const SACRIFICE = '#c9a227';
const PSA = '#9b7fd4';

/**
 * Income stacked across the tax bands, with the slices removed by salary
 * sacrifice, pension and gift aid, the savings allowance, and dividends
 * layered on top — the information shown by the web TimelineChart.
 */
export function IncomeBandsChart({
  earnings, salarySacrifice, grossContribution, grossGiftAid, effectiveEarnings, psaExempt,
  dividendIncome, divBands, hasStudentLoan, config,
}: {
  earnings: number;
  salarySacrifice: number;
  grossContribution: number;
  grossGiftAid: number;
  effectiveEarnings: number;
  psaExempt: number;
  dividendIncome: number;
  divBands: DividendBand[];
  hasStudentLoan: boolean;
  config: TaxConfig;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const { B0, B1, B2, B3, TR_B, TR_H, TR_A, SL_T, SL_PLAN } = config;

  const total = earnings + dividendIncome;
  const domain = Math.max(total, B1 + 5000) * 1.04;
  const padX = 8;
  const plotW = Math.max(1, width - padX * 2);
  const x = (v: number) => padX + Math.min(1, Math.max(0, v / domain)) * plotW;
  const barY = 34;
  const barH = 30;

  const adjusted = earnings - salarySacrifice;
  const bands = [
    { lo: 0, hi: B0, label: '0%' },
    { lo: B0, hi: B1, label: `${TR_B}%` },
    { lo: B1, hi: B2, label: `${TR_B + TR_H}%` },
    { lo: B2, hi: B3, label: '60%' },
    { lo: B3, hi: Infinity, label: `${TR_B + TR_A}%` },
  ];
  const overlays = [
    { lo: adjusted, hi: earnings, color: SACRIFICE, label: 'Salary sacrifice' },
    { lo: adjusted - grossContribution, hi: adjusted, color: PENSION, label: 'Removed by pension' },
    { lo: effectiveEarnings, hi: adjusted - grossContribution, color: GIFT_AID, label: 'Removed by gift aid' },
    { lo: Math.max(0, effectiveEarnings - psaExempt), hi: effectiveEarnings, color: PSA, label: 'Savings allowance (tax-free)' },
  ].filter(o => o.hi - o.lo > 0.5);
  const ticks = [B0, B1, B2, B3].filter(b => b < domain);

  return (
    <View>
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height: 120 }}>
        {width > 0 ? (
          <Svg width={width} height={120} accessibilityLabel="Income across tax bands">
            <Rect x={x(0)} y={barY} width={plotW} height={barH} rx={6} fill={t.inputBackground} />
            {bands.map((b, i) => {
              const lo = b.lo;
              const hi = Math.min(b.hi, earnings);
              if (hi <= lo) return null;
              return (
                <Rect key={b.label + i} x={x(lo)} y={barY} width={x(hi) - x(lo)} height={barH} fill={BAND_FILLS[i]} />
              );
            })}
            {bands.map((b, i) => {
              const hi = Math.min(b.hi, domain);
              if (hi <= b.lo || x(hi) - x(b.lo) < 26) return null;
              return (
                <SvgText key={`bl${i}`} x={(x(b.lo) + x(hi)) / 2} y={barY - 8} fontSize={10} fill={t.textMuted} textAnchor="middle">
                  {b.label}
                </SvgText>
              );
            })}
            {divBands.filter(b => b.amount > 0).map(b => (
              <Rect key={b.label} x={x(b.from)} y={barY} width={x(b.to) - x(b.from)} height={barH}
                fill={b.rate === 0 ? '#e8e7e0' : (DIV_COLORS[b.label] ?? '#8fbcdb')} />
            ))}
            {overlays.map(o => (
              <Rect key={o.label} x={x(o.lo)} y={barY + 4} width={Math.max(1, x(o.hi) - x(o.lo))} height={barH - 8}
                fill={o.color} opacity={0.85} rx={2} />
            ))}
            {ticks.map(v => (
              <Line key={`t${v}`} x1={x(v)} x2={x(v)} y1={barY + barH} y2={barY + barH + 5} stroke={t.textMuted} />
            ))}
            <Line x1={x(earnings)} x2={x(earnings)} y1={barY - 4} y2={barY + barH + 4} stroke={t.text} strokeWidth={2} />
            <Line x1={x(effectiveEarnings)} x2={x(effectiveEarnings)} y1={barY - 4} y2={barY + barH + 4} stroke={t.brand} strokeWidth={2} strokeDasharray="3 2" />
            {hasStudentLoan ? (
              <>
                <Line x1={x(SL_T)} x2={x(SL_T)} y1={barY + barH} y2={barY + barH + 22} stroke={t.negative} strokeDasharray="2 2" />
                <SvgText x={x(SL_T)} y={barY + barH + 33} fontSize={9} fill={t.negative} textAnchor="middle">{`${SL_PLAN} £${Math.round(SL_T / 1000)}k`}</SvgText>
              </>
            ) : null}
            {ticks.map(v => x(v) - x(0) > 20 && x(domain) - x(v) > 20 ? (
              <SvgText key={`tl${v}`} x={x(v)} y={barY + barH + 16} fontSize={9} fill={t.textMuted} textAnchor="middle">
                {`£${Math.round(v / 1000)}k`}
              </SvgText>
            ) : null)}
          </Svg>
        ) : null}
      </View>
      <View style={styles.legend}>
        <LegendItem color={t.text} label={`Gross earnings ${fmtD(earnings)}`} line />
        <LegendItem color={t.brand} label={`Effective earnings ${fmtD(effectiveEarnings)}`} line dashed />
        {overlays.map(o => <LegendItem key={o.label} color={o.color} label={o.label} />)}
        {dividendIncome > 0 ? <LegendItem color="#4a86ad" label={`Dividends ${fmtD(dividendIncome)} (taxed last)`} /> : null}
      </View>
    </View>
  );
}

function LegendItem({ color, label, line, dashed }: { color: string; label: string; line?: boolean; dashed?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[line ? styles.legendLine : styles.legendSwatch, { backgroundColor: color }, dashed && { opacity: 0.6 }]} />
      <Text style={[styles.legendText, { color: t.textSecondary }]}>{label}</Text>
    </View>
  );
}

/** Before/after mini bar showing where dividends sit in the income stack (web Card 2). */
export function DividendShiftBar({ result, nonDivGross, domain }: { result: TaxResult; nonDivGross: number; domain: number }) {
  const t = useTheme();
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / Math.max(domain, 1)) * 100))}%` as const;
  return (
    <View style={[styles.miniBar, { backgroundColor: t.inputBackground }]}>
      <View style={[styles.miniSeg, { left: 0, width: pct(nonDivGross), backgroundColor: '#dcdcd6' }]} />
      {result.divBands.filter(b => b.rate > 0 && b.amount > 0).map(b => (
        <View key={b.label} style={[styles.miniSeg, {
          left: pct(b.from),
          width: `${Math.max(0, (Math.min(b.to, domain) - b.from) / Math.max(domain, 1) * 100)}%`,
          backgroundColor: DIV_COLORS[b.label] ?? '#8fbcdb',
        }]} />
      ))}
    </View>
  );
}

/** Horizontal used/total bar for the annual allowance usage section. */
export function UsageBar({ used, total, current }: { used: number; total: number; current: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.usageBar, { backgroundColor: t.inputBackground }]}>
      {used > 0 ? (
        <View style={{ width: `${Math.min(100, (used / total) * 100)}%`, backgroundColor: current ? t.brand : '#4a7a5e', height: '100%' }} />
      ) : null}
    </View>
  );
}

/** Row in the take-home waterfall; hidden when zero, like the web TakeHomeRow. */
export function WaterfallRow({ label, value, plus, minus, indent }: {
  label: string;
  value: number;
  plus?: boolean;
  minus?: boolean;
  indent?: boolean;
}) {
  const t = useTheme();
  if (value === 0) return null;
  return (
    <View style={[styles.waterfallRow, { borderBottomColor: t.border }, indent && { paddingLeft: 14 }]}>
      <Text style={[styles.waterfallLabel, { color: indent ? t.textMuted : t.textSecondary }]}>{label}</Text>
      <Text style={[styles.waterfallValue, { color: plus ? t.brand : minus ? t.negative : t.text }]}>
        {minus ? '−' : plus ? '+' : ''}{fmtGBP(value)}
      </Text>
    </View>
  );
}

/** "Where your earnings go" bucket; hidden when zero or negative, like the web BucketCard. */
export function Bucket({ label, sublabel, value, pct, background, light }: {
  label: string;
  sublabel?: string;
  value: number;
  pct: number;
  background: string;
  light?: boolean;
}) {
  const t = useTheme();
  if (value <= 0) return null;
  const color = light ? t.text : '#ffffff';
  return (
    <View style={[styles.bucket, { backgroundColor: light ? t.inputBackground : background }]}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={[styles.bucketLabel, { color }]}>{label}</Text>
        {sublabel ? <Text style={[styles.bucketSub, { color }]}>{sublabel}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.bucketValue, { color }]}>{fmtGBP(value)}</Text>
        <Text style={[styles.bucketSub, { color }]}>{pct.toFixed(1)}% of earnings</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { gap: 6, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendSwatch: { width: 14, height: 10, borderRadius: 2 },
  legendLine: { width: 14, height: 2 },
  legendText: { fontSize: 12 },
  miniBar: { height: 18, borderRadius: 4, overflow: 'hidden' },
  miniSeg: { position: 'absolute', top: 0, bottom: 0 },
  usageBar: { height: 22, borderRadius: 6, overflow: 'hidden', flexDirection: 'row' },
  waterfallRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  waterfallLabel: { fontSize: 14, flex: 1 },
  waterfallValue: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  bucket: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  bucketLabel: { fontSize: 15, fontWeight: '600' },
  bucketSub: { fontSize: 11, opacity: 0.75, marginTop: 2 },
  bucketValue: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
