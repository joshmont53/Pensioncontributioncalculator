import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { formatCurrencyShort } from '@calc/core';
import { useTheme } from '@/theme';

// Native SVG replacement for the web's Recharts line charts. Plots monthly
// series against a "Yr N" x-axis with a £ y-axis.

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: number[]; // one value per month, month 1 first
  dashed?: boolean;
  width?: number;
  markers?: number[]; // months to mark on the zero line with a "Yr N" label
}

const PAD = { top: 12, right: 12, bottom: 24, left: 52 };

function tickMonths(totalMonths: number): number[] {
  const totalYears = totalMonths / 12;
  const stepYears = totalYears <= 15 ? 1 : totalYears <= 30 ? 5 : 10;
  const ticks: number[] = [];
  for (let y = stepYears; y * 12 <= totalMonths; y += stepYears) ticks.push(y * 12);
  return ticks;
}

function niceStep(range: number, target: number) {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
}

export function LineChart({ series, height = 240, zeroLine, verticalMarker }: {
  series: ChartSeries[];
  height?: number;
  zeroLine?: boolean;
  verticalMarker?: { month: number; label: string };
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const totalMonths = Math.max(0, ...series.map(s => s.values.length));

  const all = series.flatMap(s => s.values);
  let min = Math.min(0, ...all);
  let max = Math.max(0, ...all);
  if (max === min) max = min + 1;
  const step = niceStep(max - min, 4);
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  const yTicks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) yTicks.push(v);

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const x = (month: number) => PAD.left + ((month - 1) / Math.max(1, totalMonths - 1)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;

  const pathFor = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join('');

  return (
    <View>
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 && totalMonths > 0 ? (
          <Svg width={width} height={height} accessibilityLabel={`Chart: ${series.map(s => s.label).join(', ')}`}>
            {yTicks.map(v => (
              <Line key={`g${v}`} x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={t.border} strokeDasharray="3 3" />
            ))}
            {yTicks.map(v => (
              <SvgText key={`yl${v}`} x={PAD.left - 6} y={y(v) + 4} fontSize={10} fill={t.textMuted} textAnchor="end">
                {formatCurrencyShort(v)}
              </SvgText>
            ))}
            {tickMonths(totalMonths).map(m => (
              <SvgText key={`xl${m}`} x={x(m)} y={height - 6} fontSize={10} fill={t.textMuted} textAnchor="middle">
                {`Yr ${Math.round(m / 12)}`}
              </SvgText>
            ))}
            {zeroLine ? <Line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke={t.textMuted} strokeOpacity={0.5} /> : null}
            {verticalMarker ? (
              <>
                <Line x1={x(verticalMarker.month)} x2={x(verticalMarker.month)} y1={PAD.top} y2={PAD.top + plotH} stroke={t.textMuted} strokeDasharray="4 4" />
                <SvgText x={x(verticalMarker.month) + 4} y={PAD.top + 10} fontSize={10} fill={t.textMuted}>{verticalMarker.label}</SvgText>
              </>
            ) : null}
            {series.map(s => (
              <Path
                key={s.key}
                d={pathFor(s.values)}
                stroke={s.color}
                strokeWidth={s.width ?? 2}
                strokeDasharray={s.dashed ? '5 3' : undefined}
                fill="none"
              />
            ))}
            {series.flatMap(s => (s.markers ?? []).map(m => (
              <Circle key={`${s.key}-m${m}`} cx={x(m)} cy={y(0)} r={4} fill={s.color} stroke={t.card} strokeWidth={1.5} />
            )))}
            {series.flatMap(s => (s.markers ?? []).map(m => (
              <SvgText key={`${s.key}-t${m}`} x={x(m)} y={y(0) - 9} fontSize={10} fontWeight="700" fill={s.color} textAnchor="middle">
                {`Yr ${Math.round(m / 12)}`}
              </SvgText>
            )))}
          </Svg>
        ) : null}
      </View>
      <View style={styles.legend}>
        {series.map(s => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: s.color }, s.dashed && styles.swatchDashed]} />
            <Text style={[styles.legendText, { color: t.textSecondary }]}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 3, borderRadius: 2 },
  swatchDashed: { width: 14, height: 3, opacity: 0.6 },
  legendText: { fontSize: 12 },
});
