import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { TimelineChart } from './components/TimelineChart';
import { useTaxConfig } from './hooks/useTaxConfig';

export default function App() {
  const navigate = useNavigate();
  const { config } = useTaxConfig();
  const { B0, B1, B2, B3, TR_B, TR_H, TR_60, TR_A, SL_T, SL_R, TAX_YEAR, SL_PLAN } = config;

  const [earnings, setEarnings] = useState(80000);
  const [netContribution, setNetContribution] = useState(0);
  const [showDetails, setShowDetails] = useState(true);

  // Gross contribution from net
  const grossContribution = netContribution / (1 - TR_B / 100);

  // Effective earnings
  const effectiveEarnings = earnings - grossContribution;

  // Student loan (on gross earnings, as per current code)
  const studentLoan = earnings <= SL_T ? 0 : (earnings - SL_T) * (SL_R / 100);

  // Additional relief (beyond basic rate at source)
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

  // Recommended contribution to offset student loan
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

  useEffect(() => {
    setNetContribution(Math.round(recommendedNet));
  }, [earnings, B0, B1, B2, B3, TR_B, TR_H, TR_60, TR_A, SL_T, SL_R]);

  // Breakdown: how much of gross contribution falls in each band
  const y = effectiveEarnings;
  const fromAdditional = Math.max(0, earnings - Math.max(y, B3));
  const from60 = Math.max(0, Math.min(earnings, B3) - Math.max(y, B2));
  const fromHigher = Math.max(0, Math.min(earnings, B2) - Math.max(y, B1));
  const fromBasic = Math.max(0, Math.min(earnings, B1) - Math.max(y, B0));

  // Relief per band
  const reliefHigher = fromHigher * (TR_H / 100);
  const reliefBasic = 0; // no extra beyond at-source
  const relief60 = from60 * (TR_60 / 100);
  const reliefAdditional = fromAdditional * (TR_A / 100);

  // Student loan column
  const earningsAboveThreshold = Math.max(0, earnings - SL_T);
  const studentLoanPayable = studentLoan;
  const studentLoanRemaining = Math.max(0, studentLoanPayable - additionalRelief);

  // Effective tax relief rate on net contribution
  const effectiveReliefRate = netContribution > 0 ? (totalRelief / netContribution) * 100 : 0;

  // Formatters
  const fmt = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
  const fmtD = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  // Insight banner text
  const insightText = (() => {
    if (grossContribution <= 0) return null;
    const bands: { amount: number; name: string; lowerName: string }[] = [];
    if (fromAdditional > 0) bands.push({ amount: fromAdditional, name: '45% additional rate', lowerName: '60% (PA taper)' });
    if (from60 > 0) bands.push({ amount: from60, name: '60% (PA taper)', lowerName: '40% higher rate' });
    if (fromHigher > 0) bands.push({ amount: fromHigher, name: '40% higher rate', lowerName: '20% basic rate' });
    if (fromBasic > 0) bands.push({ amount: fromBasic, name: '20% basic rate', lowerName: '0% nil rate' });
    if (bands.length === 0) return null;
    const primary = bands[0];
    const movesText =
      bands.length === 1
        ? `This moves ${fmtD(grossContribution)} of income out of the ${primary.name} band into the ${primary.lowerName} band`
        : `This moves income across multiple tax bands`;
    return `Your gross pension contribution of ${fmtD(grossContribution)} reduces your taxable earnings from ${fmtD(earnings)} to ${fmtD(effectiveEarnings)}. ${movesText}, creating ${fmtD(additionalRelief)} of additional tax relief.`;
  })();

  // Column 2 bar chart bounds
  const barLower = (() => {
    if (effectiveEarnings < B0) return 0;
    if (effectiveEarnings < B1) return B0;
    if (effectiveEarnings < B2) return B1;
    if (effectiveEarnings < B3) return B2;
    return B3;
  })();
  const barUpper = (() => {
    if (earnings <= B1) return B1;
    if (earnings <= B2) return B2;
    if (earnings <= B3) return B3;
    return Math.ceil(earnings / 10000) * 10000;
  })();
  const barRange = barUpper - barLower;

  const toBarPct = (v: number) => Math.max(0, Math.min(100, ((v - barLower) / barRange) * 100));

  // Where the contribution block sits on the bar
  const barContribLeft = toBarPct(Math.max(effectiveEarnings, barLower));
  const barContribRight = toBarPct(Math.min(earnings, barUpper));

  // Contribution split across bands within bar
  const barFromHigher = Math.max(0, Math.min(earnings, B2) - Math.max(Math.max(effectiveEarnings, barLower), B1));
  const barFrom60 = Math.max(0, Math.min(earnings, B3) - Math.max(Math.max(effectiveEarnings, barLower), B2));
  const barFromAdditional = Math.max(0, earnings - Math.max(Math.max(effectiveEarnings, barLower), B3));
  const barFromBasic = Math.max(0, Math.min(earnings, B1) - Math.max(Math.max(effectiveEarnings, barLower), B0));
  const totalBarContrib = barFromHigher + barFrom60 + barFromAdditional + barFromBasic;

  const barHigherPct = totalBarContrib > 0 ? (barFromHigher / grossContribution) * (barContribRight - barContribLeft) : 0;
  const bar60Pct = totalBarContrib > 0 ? (barFrom60 / grossContribution) * (barContribRight - barContribLeft) : 0;
  const barAdditionalPct = totalBarContrib > 0 ? (barFromAdditional / grossContribution) * (barContribRight - barContribLeft) : 0;
  const barBasicPct = totalBarContrib > 0 ? (barFromBasic / grossContribution) * (barContribRight - barContribLeft) : 0;

  // Inline editable input refs
  const earningsRef = useRef<HTMLInputElement>(null);
  const netRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      {/* Header */}
      <div className="bg-white border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 py-5">
          {/* Top row: title + stats */}
          <div className="flex items-center gap-6">
            {/* Title block */}
            <div className="shrink-0 max-w-[240px]">
              <h1 className="text-[17px] font-semibold text-[#1a1a18] leading-snug mb-0.5">
                How your pension contribution affects your earnings
              </h1>
              <p className="text-xs text-[#8a8a84] leading-relaxed">
                See how your contribution reduces your taxable income and creates tax relief
              </p>
            </div>

            {/* Divider */}
            <div className="w-px self-stretch bg-black/10 shrink-0" />

            {/* Stats bar */}
            <div className="flex items-center flex-1 min-w-0 overflow-x-auto">
              {/* Total Earnings — editable */}
              <div className="px-4 shrink-0">
                <div className="text-[11px] text-[#8a8a84] mb-1 whitespace-nowrap">Total Earnings</div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-xl font-bold text-[#1a1a18]">£</span>
                  <input
                    ref={earningsRef}
                    type="number"
                    value={earnings}
                    onChange={e => setEarnings(Number(e.target.value) || 0)}
                    className="text-xl font-bold text-[#1a1a18] bg-transparent outline-none w-20 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    step="1000"
                  />
                </div>
              </div>

              <div className="w-px self-stretch bg-black/8 shrink-0" />

              {/* Net Pension Contribution — editable */}
              <div className="px-4 shrink-0">
                <div className="text-[11px] text-[#8a8a84] mb-1 whitespace-nowrap flex items-center gap-1">
                  Net Pension Contribution
                  <span className="cursor-help" title="The amount you personally contribute. Your provider adds 20% basic rate tax relief on top.">ⓘ</span>
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-xl font-bold text-[#1a1a18]">£</span>
                  <input
                    ref={netRef}
                    type="number"
                    value={Math.round(netContribution)}
                    onChange={e => setNetContribution(Number(e.target.value) || 0)}
                    className="text-xl font-bold text-[#1a1a18] bg-transparent outline-none w-20 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    step="100"
                  />
                </div>
              </div>

              <div className="w-px self-stretch bg-black/8 shrink-0" />

              {/* Gross Contribution — calculated */}
              <div className="px-4 shrink-0">
                <div className="text-[11px] text-[#8a8a84] mb-1 whitespace-nowrap flex items-center gap-1">
                  Gross Pension Contribution
                  <span className="cursor-help" title="Net contribution plus 20% basic rate tax relief added by your provider.">ⓘ</span>
                </div>
                <div className="text-xl font-bold text-[#1d4e3a]">{fmtD(grossContribution)}</div>
              </div>

              <div className="w-px self-stretch bg-black/8 shrink-0" />

              {/* Effective Earnings — calculated */}
              <div className="px-4 shrink-0">
                <div className="text-[11px] text-[#8a8a84] mb-1 whitespace-nowrap flex items-center gap-1">
                  Effective Earnings
                  <span className="cursor-help" title="Your earnings after the gross pension contribution is deducted.">ⓘ</span>
                </div>
                <div className="text-xl font-bold text-[#1d4e3a]">{fmtD(effectiveEarnings)}</div>
              </div>

              <div className="w-px self-stretch bg-black/8 shrink-0" />

              {/* Student Loan */}
              <div className="px-4 shrink-0">
                <div className="text-[11px] text-[#8a8a84] mb-1 whitespace-nowrap">Student Loan ({SL_PLAN})</div>
                <div className="text-xl font-bold text-[#1a1a18]">{fmtD(studentLoanPayable)}</div>
              </div>

              <div className="w-px self-stretch bg-black/8 shrink-0" />

              {/* Hide details toggle */}
              <div className="px-4 shrink-0">
                <button
                  onClick={() => setShowDetails(v => !v)}
                  className="flex items-center gap-1.5 text-sm text-[#4a4a46] border border-black/20 rounded-lg px-3 py-2 hover:border-black/30 transition-colors whitespace-nowrap"
                >
                  {showDetails ? 'Hide details' : 'Show details'}
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 13 13"
                    fill="none"
                    className={`transition-transform duration-200 ${showDetails ? 'rotate-180' : 'rotate-0'}`}
                  >
                    <path d="M2.5 4.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Admin link */}
          <div className="flex justify-end mt-2">
            <button
              onClick={() => navigate('/admin')}
              className="text-[11px] text-[#c8c8c0] hover:text-[#8a8a84] transition-colors"
            >
              Tax year {TAX_YEAR} · Admin
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Timeline Chart */}
        <div className="bg-white rounded-2xl border border-black/10 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-[#1a1a18]">Your income and tax bands</h2>
          </div>

          {/* Legend — above chart */}
          <div className="flex flex-wrap gap-5 mb-6">
            <div className="flex items-center gap-2">
              <svg width="20" height="10" viewBox="0 0 20 10">
                <line x1="0" y1="5" x2="20" y2="5" stroke="#1d4e3a" strokeWidth="2"/>
                <polygon points="10,2 14,5 10,8" fill="#1d4e3a"/>
              </svg>
              <span className="text-xs text-[#4a4a46]">Gross earnings (before pension)</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="10" viewBox="0 0 20 10">
                <line x1="0" y1="5" x2="20" y2="5" stroke="#2a6e52" strokeWidth="2" strokeDasharray="4 3"/>
                <polygon points="10,2 14,5 10,8" fill="#2a6e52"/>
              </svg>
              <span className="text-xs text-[#4a4a46]">Effective earnings (after pension)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-3 relative overflow-hidden rounded-sm">
                <div className="absolute inset-0 bg-[#e8a87c]/30"/>
                <div className="absolute inset-0" style={{backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,0.6) 3px,rgba(255,255,255,0.6) 5px)'}}/>
              </div>
              <span className="text-xs text-[#4a4a46]">Earnings removed by pension</span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <TimelineChart
              earnings={earnings}
              grossContribution={grossContribution}
              effectiveEarnings={effectiveEarnings}
              studentLoan={studentLoan}
              additionalRelief={additionalRelief}
              config={config}
            />
          </div>

          {/* Key — below chart */}
          <div className="flex flex-wrap gap-5 mt-6 pt-5 border-t border-black/8">
            <span className="text-xs font-medium text-[#4a4a46]">Key</span>
            <div className="flex items-center gap-1.5">
              <svg width="20" height="10" viewBox="0 0 20 10">
                <line x1="0" y1="5" x2="20" y2="5" stroke="#1d4e3a" strokeWidth="2"/>
                <polygon points="10,2 14,5 10,8" fill="#1d4e3a"/>
              </svg>
              <span className="text-xs text-[#8a8a84]">Total earnings (before pension)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="20" height="10" viewBox="0 0 20 10">
                <line x1="0" y1="5" x2="20" y2="5" stroke="#2a6e52" strokeWidth="2" strokeDasharray="4 3"/>
                <polygon points="10,2 14,5 10,8" fill="#2a6e52"/>
              </svg>
              <span className="text-xs text-[#8a8a84]">Effective earnings (after pension)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-3 relative overflow-hidden rounded-sm">
                <div className="absolute inset-0 bg-[#e8a87c]/30"/>
                <div className="absolute inset-0" style={{backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,0.6) 3px,rgba(255,255,255,0.6) 5px)'}}/>
              </div>
              <span className="text-xs text-[#8a8a84]">Earnings removed by pension</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="20" height="10" viewBox="0 0 20 10">
                <line x1="0" y1="5" x2="20" y2="5" stroke="#4a4a46" strokeWidth="1.5" strokeDasharray="2 3"/>
              </svg>
              <span className="text-xs text-[#8a8a84]">Threshold / boundary</span>
            </div>
          </div>
        </div>

        {/* Insight Banner */}
        {insightText && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <span className="text-xl shrink-0 mt-0.5">💡</span>
            <p className="text-sm text-amber-900 leading-relaxed">{insightText}</p>
          </div>
        )}

        {/* Three-column detail section */}
        {showDetails && (
          <div className="grid grid-cols-3 gap-6">
            {/* Column 1 — Tax relief breakdown */}
            <div className="bg-white rounded-2xl border border-black/10 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-[#1a1a18] mb-1">Tax relief created by your contribution</h3>
              <p className="text-xs text-[#8a8a84] mb-5">Breakdown of additional tax relief (reclaimed on tax return)</p>

              <div className="space-y-3 mb-5">
                {/* Higher rate */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#6aaa8e' }} />
                    <span className="text-xs text-[#4a4a46] leading-tight">40% relief (moved out of higher rate)</span>
                  </div>
                  <span className="text-xs font-medium text-[#1a1a18] shrink-0">{fmtD(fromHigher)}</span>
                </div>

                {/* Basic rate */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#b8d4c8' }} />
                    <span className="text-xs text-[#4a4a46] leading-tight">20% relief (moved out of basic rate)</span>
                  </div>
                  <span className="text-xs font-medium text-[#1a1a18] shrink-0">{fmtD(fromBasic)}</span>
                </div>

                {/* 60% PA taper */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#e8a87c' }} />
                    <span className="text-xs text-[#4a4a46] leading-tight">60% relief (moved out of PA taper band)</span>
                  </div>
                  <span className="text-xs font-medium text-[#1a1a18] shrink-0">{fmtD(from60)}</span>
                </div>

                {/* Additional rate */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#c0392b' }} />
                    <span className="text-xs text-[#4a4a46] leading-tight">25% relief (moved out of additional rate)</span>
                  </div>
                  <span className="text-xs font-medium text-[#1a1a18] shrink-0">{fmtD(fromAdditional)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-black/8">
                <span className="text-sm font-medium text-[#1a1a18]">Total additional relief</span>
                <span className="text-sm font-semibold text-[#c97a2a]">{fmtD(additionalRelief)}</span>
              </div>

              <div className="bg-[#f1f6f4] rounded-xl p-4 mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#4a4a46]">
                    <strong>Total tax relief</strong>{' '}
                    <span className="text-[#8a8a84]">(incl. {TR_B}% at source)</span>
                  </span>
                  <span className="text-sm font-semibold text-[#1d4e3a]">{fmtD(totalRelief)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#4a4a46]">Effective tax relief rate on your net contribution</span>
                  <span className="text-sm font-semibold text-[#1d4e3a]">{effectiveReliefRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Column 2 — Visual breakdown bar */}
            <div className="bg-white rounded-2xl border border-black/10 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-[#1a1a18] mb-1">Visual breakdown of where your contribution sits</h3>
              <p className="text-xs text-[#8a8a84] mb-5">
                Your gross contribution of {fmtD(grossContribution)} removes income from:
              </p>

              {grossContribution > 0 ? (
                <>
                  {/* Bar */}
                  <div className="mb-2">
                    <div className="relative h-9 bg-[#f1f0eb] rounded-md overflow-hidden">
                      {/* Coloured segments */}
                      {barBasicPct > 0 && (
                        <div
                          className="absolute top-0 h-full"
                          style={{
                            left: `${barContribLeft + barHigherPct + bar60Pct + barAdditionalPct}%`,
                            width: `${barBasicPct}%`,
                            backgroundColor: '#b8d4c8',
                          }}
                        />
                      )}
                      {barHigherPct > 0 && (
                        <div
                          className="absolute top-0 h-full flex items-center justify-center overflow-hidden"
                          style={{
                            left: `${barContribLeft}%`,
                            width: `${barHigherPct}%`,
                            backgroundColor: '#e8a87c',
                          }}
                        >
                          {barHigherPct > 8 && (
                            <span className="text-xs font-semibold text-white drop-shadow-sm whitespace-nowrap px-1">
                              {fmtD(grossContribution)}
                            </span>
                          )}
                        </div>
                      )}
                      {bar60Pct > 0 && (
                        <div
                          className="absolute top-0 h-full"
                          style={{
                            left: `${barContribLeft + barHigherPct}%`,
                            width: `${bar60Pct}%`,
                            backgroundColor: '#e8a87c',
                            opacity: 0.7,
                          }}
                        />
                      )}
                      {barAdditionalPct > 0 && (
                        <div
                          className="absolute top-0 h-full"
                          style={{
                            left: `${barContribLeft + barHigherPct + bar60Pct}%`,
                            width: `${barAdditionalPct}%`,
                            backgroundColor: '#c0392b',
                            opacity: 0.7,
                          }}
                        />
                      )}
                      {/* Full-width label if bar too narrow */}
                      {barHigherPct <= 8 && barContribRight > barContribLeft && (
                        <div
                          className="absolute top-0 h-full flex items-center justify-center"
                          style={{ left: `${barContribLeft}%`, width: `${barContribRight - barContribLeft}%` }}
                        >
                          <span className="text-xs font-semibold text-white drop-shadow-sm">
                            {fmtD(grossContribution)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Axis labels */}
                    <div className="relative mt-1 h-5">
                      <span className="absolute text-xs text-[#8a8a84]" style={{ left: 0 }}>
                        {fmt(barLower)}
                      </span>
                      <span className="absolute text-xs text-[#8a8a84]" style={{ right: 0, textAlign: 'right' }}>
                        {fmt(barUpper)}
                      </span>
                    </div>
                  </div>

                  {/* Band breakdown list */}
                  <div className="space-y-2 mt-5 mb-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: '#e8a87c' }} />
                        <span className="text-xs text-[#4a4a46]">From higher rate (40%)</span>
                      </div>
                      <span className="text-xs font-medium text-[#1a1a18]">
                        {fmtD(fromHigher)}{' '}
                        <span className="text-[#8a8a84]">
                          ({grossContribution > 0 ? Math.round((fromHigher / grossContribution) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: '#b8d4c8' }} />
                        <span className="text-xs text-[#4a4a46]">From basic rate (20%)</span>
                      </div>
                      <span className="text-xs font-medium text-[#1a1a18]">
                        {fmtD(fromBasic)}{' '}
                        <span className="text-[#8a8a84]">
                          ({grossContribution > 0 ? Math.round((fromBasic / grossContribution) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: '#e8a87c', opacity: 0.7 }} />
                        <span className="text-xs text-[#4a4a46]">From PA taper (60%)</span>
                      </div>
                      <span className="text-xs font-medium text-[#1a1a18]">
                        {fmtD(from60)}{' '}
                        <span className="text-[#8a8a84]">
                          ({grossContribution > 0 ? Math.round((from60 / grossContribution) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: '#c0392b', opacity: 0.7 }} />
                        <span className="text-xs text-[#4a4a46]">From additional rate (45%)</span>
                      </div>
                      <span className="text-xs font-medium text-[#1a1a18]">
                        {fmtD(fromAdditional)}{' '}
                        <span className="text-[#8a8a84]">
                          ({grossContribution > 0 ? Math.round((fromAdditional / grossContribution) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Success / info message */}
                  {additionalRelief > 0 && (
                    <div className={`rounded-xl p-3 flex gap-2 ${from60 === 0 && fromAdditional === 0 && fromBasic === 0 && fromHigher === grossContribution ? 'bg-[#e8f2ed] border border-[#b8d4c8]' : 'bg-[#f1f0eb] border border-black/8'}`}>
                      <span className="shrink-0 mt-0.5">
                        {from60 === 0 && fromAdditional === 0 && fromBasic === 0 ? (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" stroke="#1d4e3a" strokeWidth="1.5"/>
                            <path d="M5 8l2 2 4-4" stroke="#1d4e3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" stroke="#4a4a46" strokeWidth="1.5"/>
                            <path d="M8 5v4M8 11v.5" stroke="#4a4a46" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        )}
                      </span>
                      <p className="text-xs text-[#4a4a46] leading-relaxed">
                        {from60 === 0 && fromAdditional === 0 && fromBasic === 0
                          ? `All of your contribution is removing income from the 40% tax band.`
                          : `Your contribution spans multiple tax bands.`}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-[#8a8a84] py-4 text-center">
                  Enter a pension contribution to see the breakdown.
                </div>
              )}
            </div>

            {/* Column 3 — Student Loan Impact */}
            <div className="bg-white rounded-2xl border border-black/10 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-[#1a1a18] mb-1">Student loan impact</h3>
              <p className="text-xs text-[#8a8a84] mb-5">
                {SL_PLAN}: {SL_R}% on earnings above {fmt(SL_T)}
              </p>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#4a4a46]">Earnings above threshold</span>
                  <span className="text-xs font-medium text-[#1a1a18]">{fmtD(earningsAboveThreshold)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#4a4a46]">Student loan payable</span>
                  <span className="text-xs font-medium text-[#1a1a18]">{fmtD(studentLoanPayable)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#4a4a46]">Additional relief received</span>
                  <span className="text-xs font-medium text-[#1a1a18]">{fmtD(additionalRelief)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-black/8">
                <span className="text-sm font-semibold text-[#1a1a18]">Student loan remaining</span>
                <span className={`text-sm font-semibold ${studentLoanRemaining > 0 ? 'text-[#c97a2a]' : 'text-[#1d4e3a]'}`}>
                  {fmtD(studentLoanRemaining)}
                </span>
              </div>

              {studentLoanRemaining > 0 && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5">
                    <circle cx="8" cy="8" r="7" stroke="#2563eb" strokeWidth="1.5"/>
                    <path d="M8 7v4M8 5v.5" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Increase your net contribution by{' '}
                    <strong>{fmtD(Math.max(0, recommendedNet - netContribution))}</strong> to fully offset your student loan.
                  </p>
                </div>
              )}

              {studentLoanRemaining === 0 && studentLoanPayable > 0 && (
                <div className="mt-4 bg-[#e8f2ed] border border-[#b8d4c8] rounded-xl p-4 flex gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5">
                    <circle cx="8" cy="8" r="7" stroke="#1d4e3a" strokeWidth="1.5"/>
                    <path d="M5 8l2 2 4-4" stroke="#1d4e3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="text-xs text-[#1d4e3a] leading-relaxed">
                    Your student loan is fully offset by your additional tax relief.
                  </p>
                </div>
              )}

              {studentLoanPayable === 0 && (
                <div className="mt-4 bg-[#f1f0eb] border border-black/8 rounded-xl p-4">
                  <p className="text-xs text-[#8a8a84] leading-relaxed">
                    Your earnings are below the student loan repayment threshold of {fmt(SL_T)}.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
