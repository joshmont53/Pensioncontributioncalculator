import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, ReferenceLine,
} from 'recharts';
import type { MonthlyPoint, Crossover } from '../lib/studentLoanEngine';

const OVERPAY_COLOR = '#1d4e3a';
const INVEST_COLOR = '#4a90a4';

function formatCurrencyShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `£${Math.round(value / 1000)}k`;
  return `£${Math.round(value)}`;
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
}

function tickMonths(totalMonths: number): number[] {
  const totalYears = totalMonths / 12;
  const stepYears = totalYears <= 15 ? 1 : totalYears <= 30 ? 5 : 10;
  const ticks: number[] = [];
  for (let y = stepYears; y * 12 <= totalMonths; y += stepYears) ticks.push(y * 12);
  return ticks;
}

export function StudentLoanChart({
  monthly, showRealTerms, crossover,
}: {
  monthly: MonthlyPoint[];
  showRealTerms: boolean;
  crossover: Crossover | null;
}) {
  const data = monthly.map(p => ({
    month: p.month,
    year: p.year,
    invest: showRealTerms ? p.investWealthReal : p.investWealthNominal,
    overpay: showRealTerms ? p.overpayWealthReal : p.overpayWealthNominal,
  }));

  const ticks = tickMonths(monthly.length);

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
          formatter={(value: number, name: string) => [formatCurrencyFull(value), name === 'invest' ? 'Invest' : 'Overpay']}
          labelFormatter={(m: number) => `Year ${Math.round(m / 12)} (month ${m})`}
          contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }}
        />
        <Legend
          formatter={(value: string) => (value === 'invest' ? 'Invest the spare money' : 'Overpay the loan')}
          wrapperStyle={{ fontSize: 12, color: '#4a4a46' }}
        />
        {crossover && (
          <ReferenceLine
            x={crossover.month}
            stroke="#8a8a84"
            strokeDasharray="4 4"
            label={{ value: 'Crossover', position: 'insideTopLeft', fontSize: 10, fill: '#8a8a84' }}
          />
        )}
        <Line type="monotone" dataKey="invest" stroke={INVEST_COLOR} strokeWidth={2} dot={false} name="invest" />
        <Line type="monotone" dataKey="overpay" stroke={OVERPAY_COLOR} strokeWidth={2} dot={false} name="overpay" />
      </LineChart>
    </ResponsiveContainer>
  );
}
