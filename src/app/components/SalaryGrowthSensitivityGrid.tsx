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

// Same orange/white/green ramp as RateGapChart, built from the app's own accent colours
// rather than a new palette, scaled continuously by magnitude instead of six fixed steps
// since grid cells hold arbitrary £ amounts, not discrete gap categories.
function cellColor(value: number, maxAbs: number): string {
  if (maxAbs <= 0) return 'rgb(255,255,255)';
  const t = Math.min(0.8, Math.abs(value) / maxAbs);
  const white = [255, 255, 255];
  const target = value >= 0 ? [29, 78, 58] : [232, 168, 124];
  const rgb = white.map((w, i) => Math.round(w + (target[i] - w) * t));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

export function SalaryGrowthSensitivityGrid({
  rowPcts, colPcts, cells, yourSalaryGrowthPct, yourGapPct, yourAdvantage,
}: {
  rowPcts: number[];
  colPcts: number[];
  cells: number[][]; // cells[rowIdx][colIdx]
  yourSalaryGrowthPct: number;
  yourGapPct: number;
  yourAdvantage: number;
}) {
  const maxAbs = Math.max(1, ...cells.flat().map(v => Math.abs(v)));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-[11px] uppercase tracking-wider text-[#8a8a84] font-medium">
                Salary growth ↓ / Rate gap →
              </th>
              {colPcts.map(gap => (
                <th key={gap} className="text-center py-2 px-3 text-[11px] uppercase tracking-wider text-[#8a8a84] font-medium min-w-[80px]">
                  {gap > 0 ? `+${gap}%` : `${gap}%`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowPcts.map((salaryGrowth, rowIdx) => (
              <tr key={salaryGrowth}>
                <td className="py-1.5 pr-4 text-[13px] font-medium text-[#1a1a18] whitespace-nowrap">{salaryGrowth}% salary growth</td>
                {colPcts.map((gap, colIdx) => {
                  const value = cells[rowIdx][colIdx];
                  return (
                    <td
                      key={gap}
                      className="text-center py-2 px-3 text-[13px] font-semibold tabular-nums text-[#1a1a18] border border-white"
                      style={{ backgroundColor: cellColor(value, maxAbs) }}
                      title={formatCurrencyFull(value)}
                    >
                      {formatCurrencyShort(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-[#8a8a84] mt-3 leading-relaxed">
        At your inputs — <strong className="text-[#1a1a18]">{yourSalaryGrowthPct.toFixed(1)}% salary growth</strong>,{' '}
        <strong className="text-[#1a1a18]">{yourGapPct >= 0 ? `+${yourGapPct.toFixed(1)}%` : `${yourGapPct.toFixed(1)}%`} rate gap</strong> —{' '}
        {yourAdvantage >= 0 ? 'investing' : 'overpaying'} leads by <strong className="text-[#1a1a18]">{formatCurrencyFull(Math.abs(yourAdvantage))}</strong>.
        Green cells favour investing, orange cells favour overpaying.
      </p>
    </div>
  );
}
