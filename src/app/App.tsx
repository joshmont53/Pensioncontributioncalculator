import { useState, useEffect } from 'react';
import { TimelineChart } from './components/TimelineChart';

export default function App() {
  const [earnings, setEarnings] = useState(60000);
  const [netContribution, setNetContribution] = useState(0);

  // Tax bands and rates (2024/25)
  const B0 = 12570;   // Nil rate upper
  const B1 = 50270;   // Basic rate upper
  const B2 = 100000;  // 60% band upper
  const B3 = 125140;  // Additional rate from
  const TR_B = 20;    // Basic rate (at source)
  const TR_H = 20;    // Higher rate extra
  const TR_60 = 40;   // 60% band extra
  const TR_A = 25;    // Additional rate extra
  const SL_T = 29385; // Student loan threshold
  const SL_R = 9;     // Student loan rate

  // Calculate student loan
  const studentLoan = earnings <= SL_T ? 0 : (earnings - SL_T) * (SL_R / 100);

  // Calculate gross contribution from net
  const grossContribution = netContribution / (1 - TR_B / 100);

  // Calculate effective earnings
  const effectiveEarnings = earnings - grossContribution;

  // Calculate additional relief (beyond basic rate at source)
  const calculateAdditionalRelief = (e: number, g: number) => {
    const y = e - g;
    const th = TR_H / 100;
    const t60 = TR_60 / 100;
    const ta = TR_A / 100;

    if (e <= B1) return 0;

    if (e <= B2) {
      if (y >= B1) return th * g;
      return th * (e - B1);
    }

    if (e <= B3) {
      if (y >= B2) return t60 * g;
      if (y >= B1) return t60 * (e - B2) + th * (B2 - y);
      return t60 * (e - B2) + th * (B2 - B1);
    }

    if (y >= B3) return ta * g;
    if (y >= B2) return ta * (e - B3) + t60 * (B3 - y);
    if (y >= B1) return ta * (e - B3) + t60 * (B3 - B2) + th * (B2 - y);
    return ta * (e - B3) + t60 * (B3 - B2) + th * (B2 - B1);
  };

  const additionalRelief = calculateAdditionalRelief(earnings, grossContribution);
  const basicRateRelief = grossContribution - netContribution;
  const totalRelief = basicRateRelief + additionalRelief;

  // Calculate recommended contribution to offset student loan
  const calculateRecommendedContribution = () => {
    if (studentLoan === 0 || earnings <= B1) return 0;

    let lo = 0;
    let hi = earnings * 0.8;
    const trb = TR_B / 100;

    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const g = mid / (1 - trb);
      const r = calculateAdditionalRelief(earnings, g);
      if (r < studentLoan) lo = mid;
      else hi = mid;
    }

    return (lo + hi) / 2;
  };

  const recommendedNet = calculateRecommendedContribution();
  const recommendedGross = recommendedNet / (1 - TR_B / 100);

  // Auto-set to recommended when earnings change
  useEffect(() => {
    setNetContribution(recommendedNet);
  }, [earnings]);

  // Format currency
  const fmt = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
  const fmtD = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;


  return (
    <div className="min-h-screen bg-[#faf9f6]">
      {/* Header */}
      <header className="bg-[#1d4e3a] text-white">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-white/20 rounded"></div>
              <span className="font-medium">Pension Tax Relief Calculator</span>
            </div>
            <span className="text-sm text-white/60">Student Loan Offset Tool</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-4xl mb-4">
            <span className="text-[#1a1a18]">Calculate your pension </span>
            <em className="text-[#1d4e3a] italic">tax relief</em>
          </h1>
          <p className="text-[#4a4a46] max-w-2xl leading-relaxed">
            See how pension contributions reduce your taxable income and generate tax relief.
            Find the optimal contribution to offset your student loan repayment.
          </p>
        </div>

        {/* Input Cards */}
        <div className="grid grid-cols-2 gap-6 mb-10">
          <div className="bg-white rounded-2xl border border-black/10 p-6 shadow-sm">
            <label className="block text-xs uppercase tracking-wider text-[#8a8a84] mb-3">
              Total Annual Earnings
            </label>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl">£</span>
              <input
                type="number"
                value={earnings}
                onChange={(e) => setEarnings(Number(e.target.value) || 0)}
                className="text-4xl outline-none w-full bg-transparent"
                step="1000"
              />
            </div>
            <div className="mt-2 text-sm text-[#8a8a84]">Your total income before tax</div>
          </div>

          <div className="bg-white rounded-2xl border border-black/10 p-6 shadow-sm">
            <label className="block text-xs uppercase tracking-wider text-[#8a8a84] mb-3">
              Net Pension Contribution
            </label>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl">£</span>
              <input
                type="number"
                value={Math.round(netContribution)}
                onChange={(e) => setNetContribution(Number(e.target.value) || 0)}
                className="text-4xl outline-none w-full bg-transparent"
                step="100"
              />
            </div>
            <div className="mt-2 text-sm text-[#8a8a84]">
              Recommended: {fmtD(recommendedNet)} to offset student loan
            </div>
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="bg-white rounded-2xl border border-black/10 p-8 shadow-sm mb-8">
          <div className="mb-6">
            <h2 className="text-xs uppercase tracking-wider text-[#8a8a84] mb-2">
              Income & tax band visualiser
            </h2>
            <p className="text-sm text-[#8a8a84]">
              Your total earnings and effective earnings (after pension contribution) plotted against every tax and student loan threshold
            </p>
          </div>

          <div className="w-full overflow-x-auto">
            <TimelineChart
              earnings={earnings}
              grossContribution={grossContribution}
              effectiveEarnings={effectiveEarnings}
              studentLoan={studentLoan}
              additionalRelief={additionalRelief}
            />
          </div>

          <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-black/10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#e8e7e0]"></div>
              <span className="text-sm text-[#4a4a46]">0% nil rate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#b8d4c8]"></div>
              <span className="text-sm text-[#4a4a46]">20% basic rate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#6aaa8e]"></div>
              <span className="text-sm text-[#4a4a46]">40% higher rate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#e8a87c]"></div>
              <span className="text-sm text-[#4a4a46]">60% effective rate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#c0392b]"></div>
              <span className="text-sm text-[#4a4a46]">45% additional rate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-5 border-t-2 border-[#1d4e3a]"></div>
              <span className="text-sm text-[#4a4a46]">Total earnings</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-5 border-t-2 border-dashed border-[#2a6e52]"></div>
              <span className="text-sm text-[#4a4a46]">Effective earnings</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 bg-gradient-to-r from-[#e8a87c]/30 to-[#e8a87c]/30 relative">
                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,white_3px,white_6px)]"></div>
              </div>
              <span className="text-sm text-[#4a4a46]">Gross pension contribution</span>
            </div>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-[#e8f2ed] rounded-xl p-6">
            <div className="text-xs uppercase tracking-wider text-[#2a6e52] mb-2">
              Gross Contribution
            </div>
            <div className="text-3xl text-[#1d4e3a] mb-1">{fmtD(grossContribution)}</div>
            <div className="text-xs text-[#2a6e52]">Net + basic rate relief</div>
          </div>

          <div className="bg-[#fdf0f0] rounded-xl p-6">
            <div className="text-xs uppercase tracking-wider text-[#9b2c2c] mb-2">
              Student Loan Due
            </div>
            <div className="text-3xl text-[#9b2c2c] mb-1">{fmtD(studentLoan)}</div>
            <div className="text-xs text-[#9b2c2c]">9% on earnings above {fmt(SL_T)}</div>
          </div>

          <div className="bg-[#e8f2ed] rounded-xl p-6">
            <div className="text-xs uppercase tracking-wider text-[#2a6e52] mb-2">
              Relief via Tax Return
            </div>
            <div className="text-3xl text-[#1d4e3a] mb-1">{fmtD(additionalRelief)}</div>
            <div className="text-xs text-[#2a6e52]">Claimed on self-assessment</div>
          </div>

          <div className="bg-[#f1f0eb] rounded-xl p-6">
            <div className="text-xs uppercase tracking-wider text-[#8a8a84] mb-2">
              Effective Earnings
            </div>
            <div className="text-3xl text-[#4a4a46] mb-1">{fmtD(effectiveEarnings)}</div>
            <div className="text-xs text-[#8a8a84]">After gross contribution</div>
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="bg-white rounded-2xl border border-black/10 p-8 shadow-sm">
          <h3 className="text-xs uppercase tracking-wider text-[#8a8a84] mb-6">Full Breakdown</h3>

          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-black/5">
              <span className="text-[#4a4a46]">Total annual earnings</span>
              <span className="text-[#1a1a18]">{fmt(earnings)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-black/5">
              <span className="text-[#4a4a46]">Gross pension contribution</span>
              <span className="text-[#1a1a18]">{fmtD(grossContribution)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-black/5">
              <span className="text-[#4a4a46]">Effective earnings after contribution</span>
              <span className="text-[#1a1a18]">{fmtD(effectiveEarnings)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-black/5">
              <span className="text-[#4a4a46]">Student loan threshold</span>
              <span className="text-[#1a1a18]">{fmt(SL_T)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-black/5">
              <span className="text-[#4a4a46]">Student loan due ({SL_R}% above threshold)</span>
              <span className="text-[#1a1a18]">{fmtD(studentLoan)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-black/5">
              <span className="text-[#4a4a46]">Basic rate relief added at source ({TR_B}%)</span>
              <span className="text-[#1a1a18]">{fmtD(basicRateRelief)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-black/5">
              <span className="text-[#4a4a46]">Additional relief via self-assessment</span>
              <span className="text-[#1a1a18]">{fmtD(additionalRelief)}</span>
            </div>
            <div className="flex justify-between py-3 border-t-2 border-[#1d4e3a]/20">
              <span className="text-[#1d4e3a]">Total pension tax relief</span>
              <span className="text-[#1d4e3a]">{fmtD(totalRelief)}</span>
            </div>
          </div>

          {Math.abs(additionalRelief - studentLoan) < 1 && studentLoan > 0 && (
            <div className="mt-6 bg-[#e8f2ed] border-l-4 border-[#1d4e3a] rounded-r-lg p-4">
              <p className="text-sm text-[#1d4e3a] leading-relaxed">
                ✓ Contributing <strong>{fmtD(netContribution)}</strong> net ({fmtD(grossContribution)} gross)
                generates <strong>{fmtD(additionalRelief)}</strong> in additional tax relief —
                exactly offsetting your student loan of <strong>{fmtD(studentLoan)}</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-[#c8c8c0] mt-8">
          Tax year 2024/25 • This tool is for illustrative purposes only and does not constitute financial advice
        </p>
      </div>
    </div>
  );
}