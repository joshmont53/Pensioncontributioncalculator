import { FormattedNumberInput } from './FormattedNumberInput';

// Same year-1-anchored convention used throughout the engine for annually-indexed nominal
// figures (see repaymentThresholdForYear / incomeLowerAdj in studentLoanEngine.ts) — year 1
// is "today", so it deflates to itself, and each later year strips out one more year of
// assumed inflation.
const realDeflator = (inflationRate: number, year: number) => Math.pow(1 + inflationRate, year - 1);

export function AdvancedSalaryTable({
  startYear, salaryByYear, annualSalary, setAnnualSalary, salaryOverrides, setSalaryOverrides,
  showRealTerms, inflationRate,
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
  const clearOverride = (year: number) => {
    setSalaryOverrides(prev => {
      const next = { ...prev };
      delete next[year];
      return next;
    });
  };

  const toDisplay = (nominal: number, year: number) =>
    showRealTerms ? Math.round(nominal / realDeflator(inflationRate, year)) : nominal;
  const toNominal = (displayValue: number, year: number) =>
    showRealTerms ? Math.round(displayValue * realDeflator(inflationRate, year)) : displayValue;

  return (
    <div className="max-h-80 overflow-y-auto border border-black/8 rounded-lg">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-white">
          <tr className="text-[11px] uppercase tracking-wider text-[#8a8a84] border-b border-black/10">
            <th className="text-left py-2 pl-3 pr-4 font-medium">Year</th>
            <th className="text-right py-2 px-4 font-medium">Salary {showRealTerms ? "(today's £)" : '(nominal)'}</th>
            <th className="text-left py-2 pl-4 pr-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {salaryByYear.map((salary, i) => {
            const year = i + 1;
            const isOverridden = year !== 1 && salaryOverrides[year] != null;
            const nominalValue = year === 1 ? annualSalary : salary;
            return (
              <tr key={year} className="border-b border-black/6 last:border-b-0 hover:bg-[#faf9f6] transition-colors">
                <td className="py-1.5 pl-3 pr-4 text-[#1a1a18] font-medium">{startYear + i}</td>
                <td className="text-right py-1.5 px-4">
                  <div className="flex items-baseline justify-end gap-0.5">
                    <span className="text-[#8a8a84]">£</span>
                    <FormattedNumberInput
                      value={toDisplay(nominalValue, year)}
                      onChange={v => {
                        const nominal = toNominal(v, year);
                        if (year === 1) setAnnualSalary(nominal);
                        else setSalaryOverrides(prev => ({ ...prev, [year]: nominal }));
                      }}
                      step={500}
                      ariaLabel={`Salary for ${startYear + i}`}
                      className={`text-right bg-transparent outline-none w-24 border-b pb-0.5 transition-colors ${
                        isOverridden ? 'border-[#9b7fd4] text-[#1a1a18] font-semibold' : 'border-black/10 text-[#4a4a46] focus:border-[#1d4e3a]'
                      }`}
                    />
                  </div>
                </td>
                <td className="py-1.5 pl-4 pr-3">
                  {isOverridden && (
                    <button
                      onClick={() => clearOverride(year)}
                      className="text-[11px] text-[#8a8a84] hover:text-[#1d4e3a] underline decoration-dotted transition-colors"
                      title="Reset to auto-calculated"
                    >
                      Reset
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
