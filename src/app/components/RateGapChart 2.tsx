import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, ReferenceLine, ReferenceDot,
} from 'recharts';

export interface GapSeries {
  key: string;
  label: string;
  gapPct: number | null; // null for the "Your inputs" series
  points: { month: number; advantage: number }[];
  crossings: number[]; // months where this series' advantage flips sign
}

const YOUR_INPUTS_COLOR = '#1a1a18';

// Diverging colour ramp built from the app's own two accent colours (orange #e8a87c already
// used for flagged/optional sections, green #1d4e3a the brand colour) rather than inventing a
// new palette — negative gaps (overpay-favouring) shade toward orange, positive gaps
// (invest-favouring) shade toward green, 0% sits neutral grey.
const GAP_COLORS: Record<number, string> = {
  [-4]: '#c8794a',
  [-2]: '#e8a87c',
  [0]: '#a8a8a0',
  [2]: '#6fa88f',
  [4]: '#3d7a5e',
  [6]: '#1d4e3a',
};

function colorForSeries(s: GapSeries): string {
  return s.gapPct === null ? YOUR_INPUTS_COLOR : (GAP_COLORS[s.gapPct] ?? '#8a8a84');
}

// Renders the "Yr N" marker for a single zero-crossing point. Used as a ReferenceDot's custom
// shape rather than a Line's own `dot` prop — Line dots render interleaved with each line's own
// path, so a later line's stroke can paint over an earlier line's crossing label. ReferenceDots
// rendered as siblings *after* all the Lines always paint on top, keeping every label readable.
function crossingMarker(color: string, month: number) {
  return ({ cx, cy }: { cx?: number; cy?: number }) => {
    if (cx === undefined || cy === undefined) return <g />;
    return (
      <g>
        <circle cx={cx} cy={cy} r={4} fill={color} stroke="#ffffff" strokeWidth={1.5} />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={10} fontWeight={700} fill={color}>
          {`Yr ${Math.round(month / 12)}`}
        </text>
      </g>
    );
  };
}

function formatCurrencyShort(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}£${Math.round(abs / 1000)}k`;
  return `${sign}£${Math.round(abs)}`;
}

function formatCurrencyFull(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Math.abs(value))}`;
}

function tickMonths(totalMonths: number): number[] {
  const totalYears = totalMonths / 12;
  const stepYears = totalYears <= 15 ? 1 : totalYears <= 30 ? 5 : 10;
  const ticks: number[] = [];
  for (let y = stepYears; y * 12 <= totalMonths; y += stepYears) ticks.push(y * 12);
  return ticks;
}

export function RateGapChart({ series, totalMonths }: { series: GapSeries[]; totalMonths: number }) {
  // Pivot from "one array per series" to recharts' wide row-per-month format.
  const data = Array.from({ length: totalMonths }, (_, i) => {
    const row: Record<string, number> = { month: i + 1 };
    for (const s of series) row[s.key] = s.points[i]?.advantage ?? 0;
    return row;
  });

  const ticks = tickMonths(totalMonths);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis
          dataKey="month"
          ticks={ticks}
          tickFormatter={(m: number) => `Yr ${Math.round(m / 12)}`}
          tick={{ fontSize: 11, fill: '#8a8a84' }}
          axisLine={{ stroke: 'rgba(0,0,0,0.1)' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatCurrencyShort}
          tick={{ fontSize: 11, fill: '#8a8a84' }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          formatter={(value: number, name: string) => [formatCurrencyFull(value), name]}
          labelFormatter={(m: number) => `Year ${Math.round(m / 12)} (month ${m})`}
          contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#4a4a46' }} />
        <ReferenceLine y={0} stroke="rgba(0,0,0,0.15)" />
        {series.map(s => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={colorForSeries(s)}
            strokeWidth={s.gapPct === null ? 2.5 : 2}
            strokeDasharray={s.gapPct === null ? '5 3' : undefined}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
        {/* Crossing markers, rendered after every Line so they always paint on top. */}
        {series.flatMap(s => {
          const color = colorForSeries(s);
          return s.crossings.map(month => (
            <ReferenceDot
              key={`${s.key}-${month}`}
              x={month}
              y={0}
              r={4}
              ifOverflow="visible"
              shape={crossingMarker(color, month)}
            />
          ));
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
