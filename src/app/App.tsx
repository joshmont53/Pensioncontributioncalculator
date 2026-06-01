import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTaxConfig } from './hooks/useTaxConfig';
import { TimelineChart } from './components/TimelineChart';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Math.round(n));
const fmtD = (n: number) =>
  '£' + fmt(n);
const pct = (n: number) =>
  n.toFixed(1) + '%';

export default function App() {
  const navigate = useNavigate();
  const { config } = useTaxConfig();
  const { B0, B1, B2, B3, TR_B, TR_H, TR_60, TR_A, SL_T, SL_R, TAX_YEAR, SL_PLAN,
          NI_L, NI_U, C1_Main, C1_Upper, C4_Main, C4_Upper,
          STANDARD_AA, TAPER_THRESHOLD, TAPER_ADJUSTED, TAPER_MIN_AA } = config;

  const [employedEarnings, setEmployedEarnings] = useState(80000);
  const [selfEmployedEarnings, setSelfEmployedEarnings] = useState(0);
  const [netContribution, setNetContribution] = useState(0);
  const [netGiftAid, setNetGiftAid] = useState(0);
  const [showDetails, setShowDetails] = useState(true);

  // ─── Goal planner state ───────────────────────────────────────────────────
  const [goalMode, setGoalMode] = useState<'take-home' | 'student-loan' | 'max-pension' | 'tax-band'>('take-home');
  const [goalTargetMonthly, setGoalTargetMonthly] = useState(3000);
  const [goalFloorMonthly, setGoalFloorMonthly] = useState(2000);
  const [goalTaxBandIdx, setGoalTaxBandIdx] = useState(0);

  // ─── Panel collapse state ─────────────────────────────────────────────────
  const [plannerOpen, setPlannerOpen] = useState(true);
  const [scenariosOpen, setScenariosOpen] = useState(true);

  // ─── Scenario comparison state ────────────────────────────────────────────
  const [scenarios, setScenarios] = useState([
    { id: 1, name: 'Option A', netContribution: 0, netGiftAid: 0 },
    { id: 2, name: 'Option B', netContribution: 0, netGiftAid: 0 },
  ]);
  const [nextScenarioId, setNextScenarioId] = useState(3);

  // ─── Employer / salary sacrifice ──────────────────────────────────────────
  const [employerContribution, setEmployerContribution] = useState(0);
  const [salarySacrifice, setSalarySacrifice] = useState(0);

  // ─── Carry forward state ──────────────────────────────────────────────────
  const [carryForwardOpen, setCarryForwardOpen] = useState(true);
  const [carryForward, setCarryForward] = useState([
    { allowance: 60000, used: 0 },
    { allowance: 60000, used: 0 },
    { allowance: 60000, used: 0 },
  ]);

  const empRef = useRef<HTMLInputElement>(null);
  const seRef = useRef<HTMLInputElement>(null);
  const netRef = useRef<HTMLInputElement>(null);
  const gaRef = useRef<HTMLInputElement>(null);
  const empContribRef = useRef<HTMLInputElement>(null);
  const ssRef = useRef<HTMLInputElement>(null);

  // ─── Core derived values ──────────────────────────────────────────────────
  const totalEarnings = employedEarnings + selfEmployedEarnings;
  const adjustedEarnings = Math.max(0, totalEarnings - salarySacrifice);
  const trb = TR_B / 100;
  const grossContribution = netContribution / (1 - trb);
  const grossGiftAid = netGiftAid / (1 - trb);
  const effectiveEarnings = Math.max(0, adjustedEarnings - grossContribution - grossGiftAid);

  // ─── Income tax ───────────────────────────────────────────────────────────
  const calculateIncomeTax = (e: number): number => {
    if (e <= B0) return 0;
    const trHigher = (TR_B + TR_H) / 100;
    const tr60 = (TR_B + TR_60) / 100;
    const trAddl = (TR_B + TR_A) / 100;
    const inBasic = Math.min(e - B0, B1 - B0) * trb;
    if (e <= B1) return inBasic;
    const inHigher = Math.min(e - B1, B2 - B1) * trHigher;
    if (e <= B2) return inBasic + inHigher;
    const in60 = Math.min(e - B2, B3 - B2) * tr60;
    if (e <= B3) return inBasic + inHigher + in60;
    const inAddl = (e - B3) * trAddl;
    return inBasic + inHigher + in60 + inAddl;
  };

  const grossIncomeTax = calculateIncomeTax(adjustedEarnings);

  // ─── Additional relief: how much a gross contribution from `base` income gives back ──
  const calculateAdditionalRelief = (base: number, gross: number): number => {
    if (gross <= 0 || base <= 0) return 0;
    const top = base;
    const bottom = Math.max(0, base - gross);
    const fromAddl = Math.max(0, top - Math.max(bottom, B3)) * (TR_A / 100);
    const from60   = Math.max(0, Math.min(top, B3) - Math.max(bottom, B2)) * (TR_60 / 100);
    const fromHigh = Math.max(0, Math.min(top, B2) - Math.max(bottom, B1)) * (TR_H / 100);
    return fromAddl + from60 + fromHigh;
  };

  const pensionAdditionalRelief = calculateAdditionalRelief(adjustedEarnings, grossContribution);
  const giftAidAdditionalRelief = calculateAdditionalRelief(adjustedEarnings - grossContribution, grossGiftAid);
  const totalAdditionalRelief = pensionAdditionalRelief + giftAidAdditionalRelief;

  // ─── Contribution band breakdown (for Card 2) ─────────────────────────────
  const bandBreakdown = (top: number, bottom: number) => ({
    fromAdditional: Math.max(0, top - Math.max(bottom, B3)),
    from60:         Math.max(0, Math.min(top, B3) - Math.max(bottom, B2)),
    fromHigher:     Math.max(0, Math.min(top, B2) - Math.max(bottom, B1)),
    fromBasic:      Math.max(0, Math.min(top, B1) - Math.max(bottom, B0)),
  });

  const pensionBands = bandBreakdown(adjustedEarnings, adjustedEarnings - grossContribution);
  const giftAidBands = bandBreakdown(adjustedEarnings - grossContribution, effectiveEarnings);
  const combinedBands = {
    fromAdditional: pensionBands.fromAdditional + giftAidBands.fromAdditional,
    from60:         pensionBands.from60 + giftAidBands.from60,
    fromHigher:     pensionBands.fromHigher + giftAidBands.fromHigher,
    fromBasic:      pensionBands.fromBasic + giftAidBands.fromBasic,
  };

  // ─── Student loan ─────────────────────────────────────────────────────────
  const studentLoan = Math.max(0, (adjustedEarnings - SL_T) * (SL_R / 100));

  // ─── National Insurance ───────────────────────────────────────────────────
  const y = Math.max(0, employedEarnings - salarySacrifice);
  const z = selfEmployedEarnings;
  const class1NI = Math.max(0, Math.min(y, NI_U) - NI_L) * (C1_Main / 100)
                 + Math.max(0, y - NI_U) * (C1_Upper / 100);
  const c1UsedOfMainBand = Math.max(0, Math.min(y, NI_U) - NI_L);
  const c4MainBandRemaining = Math.max(0, (NI_U - NI_L) - c1UsedOfMainBand);
  const zAboveL = Math.max(0, z - NI_L);
  const class4NI = Math.min(zAboveL, c4MainBandRemaining) * (C4_Main / 100)
                 + Math.max(0, zAboveL - c4MainBandRemaining) * (C4_Upper / 100);
  const totalNI = class1NI + class4NI;

  // ─── Take-home ────────────────────────────────────────────────────────────
  // adjustedEarnings = totalEarnings minus salary sacrifice (deducted before PAYE)
  // grossIncomeTax = income tax on adjustedEarnings
  // totalAdditionalRelief = SA refund received back
  // netContribution = cash paid from bank into personal pension
  // netGiftAid = cash donated to charity from bank
  const takeHomePay = adjustedEarnings
    - grossIncomeTax
    + totalAdditionalRelief
    - class1NI
    - class4NI
    - studentLoan
    - netContribution
    - netGiftAid;

  // ─── Totals (Card 1) ──────────────────────────────────────────────────────
  const totalTaxLiability = grossIncomeTax + totalNI + studentLoan;

  // ─── Tapered annual allowance & carry forward pool ────────────────────────
  const thresholdIncome = adjustedEarnings - netContribution;
  const adjustedIncomeForTaper = totalEarnings + employerContribution + salarySacrifice;
  const taperedAA = (thresholdIncome > TAPER_THRESHOLD && adjustedIncomeForTaper > TAPER_ADJUSTED)
    ? Math.max(TAPER_MIN_AA, STANDARD_AA - Math.floor((adjustedIncomeForTaper - TAPER_ADJUSTED) / 2))
    : STANDARD_AA;
  const cfAvailable = carryForward.map(cf => Math.max(0, cf.allowance - cf.used));
  const totalCarryForward = cfAvailable.reduce((a, b) => a + b, 0);
  const totalPool = taperedAA + totalCarryForward;
  const totalPensionInput = grossContribution + salarySacrifice + employerContribution;

  // ─── Tax year labels ──────────────────────────────────────────────────────
  const [cyStart] = TAX_YEAR.split('/').map(Number);
  const priorYearLabels = [
    `${cyStart - 3}/${String(cyStart - 2).slice(-2)}`,
    `${cyStart - 2}/${String(cyStart - 1).slice(-2)}`,
    `${cyStart - 1}/${String(cyStart).slice(-2)}`,
  ];

  // ─── Recommended pension contribution (offsets student loan) ─────────────
  const recommendedNet = useMemo(() => {
    if (studentLoan === 0 || adjustedEarnings <= B1) return 0;
    let lo = 0;
    let hi = adjustedEarnings * 0.8;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const g = mid / (1 - trb);
      const pr = calculateAdditionalRelief(adjustedEarnings, g);
      const gr = calculateAdditionalRelief(adjustedEarnings - g, grossGiftAid);
      if (pr + gr < studentLoan) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }, [adjustedEarnings, studentLoan, grossGiftAid, B1, trb]);

  const recommendedGross = recommendedNet / (1 - trb);

  // ─── No-contribution baseline (for comparison) ────────────────────────────
  const noContribTakeHome = adjustedEarnings - grossIncomeTax - class1NI - class4NI - studentLoan;
  const withContribTotal  = takeHomePay + grossContribution + salarySacrifice + employerContribution + grossGiftAid;
  const noContribTotal    = noContribTakeHome;
  const totalRelief       = withContribTotal - noContribTotal;

  // ─── Goal-based planner solver ────────────────────────────────────────────
  const plannerResult = useMemo(() => {
    const calcAR = (base: number, gross: number): number => {
      if (gross <= 0 || base <= 0) return 0;
      const bottom = Math.max(0, base - gross);
      const fromAddl = Math.max(0, base - Math.max(bottom, B3)) * (TR_A / 100);
      const from60   = Math.max(0, Math.min(base, B3) - Math.max(bottom, B2)) * (TR_60 / 100);
      const fromHigh = Math.max(0, Math.min(base, B2) - Math.max(bottom, B1)) * (TR_H / 100);
      return fromAddl + from60 + fromHigh;
    };

    const computeTHP = (nc: number): number => {
      const gc = nc / (1 - trb);
      const pr = calcAR(adjustedEarnings, gc);
      const gr = calcAR(adjustedEarnings - gc, grossGiftAid);
      return adjustedEarnings - grossIncomeTax + pr + gr - class1NI - class4NI - studentLoan - nc - netGiftAid;
    };

    const toResult = (nc: number) => {
      const gc = nc / (1 - trb);
      const pr = calcAR(adjustedEarnings, gc);
      const gr = calcAR(adjustedEarnings - gc, grossGiftAid);
      return {
        nc,
        gc,
        projectedTakeHome: adjustedEarnings - grossIncomeTax + pr + gr - class1NI - class4NI - studentLoan - nc - netGiftAid,
        projectedAdditionalRelief: pr + gr,
        exceedsAllowance: gc + salarySacrifice + employerContribution > totalPool,
        infeasible: false,
        message: '',
        taxBandOptions: [] as Array<{ label: string; nc: number; gc: number }>,
      };
    };

    const maxPersonalGross = Math.max(0, totalPool - salarySacrifice - employerContribution);
    const binarySearch = (targetAnnual: number): number => {
      let lo = 0;
      let hi = Math.min(adjustedEarnings * 0.99, maxPersonalGross * (1 - trb));
      for (let i = 0; i < 80; i++) {
        const mid = (lo + hi) / 2;
        if (computeTHP(mid) > targetAnnual) lo = mid; else hi = mid;
      }
      return Math.max(0, (lo + hi) / 2);
    };

    const infeasible = (msg: string) => ({ ...toResult(0), infeasible: true, message: msg });

    if (goalMode === 'take-home') {
      const targetAnnual = goalTargetMonthly * 12;
      if (targetAnnual >= computeTHP(0)) {
        return infeasible('Your take-home without any contributions is already at or below this target. No contribution is needed.');
      }
      return toResult(binarySearch(targetAnnual));
    }

    if (goalMode === 'student-loan') {
      if (studentLoan === 0) return infeasible('No student loan repayments apply at your current income level.');
      return toResult(Math.max(0, recommendedNet));
    }

    if (goalMode === 'max-pension') {
      const floorAnnual = goalFloorMonthly * 12;
      if (floorAnnual >= computeTHP(0)) {
        return infeasible('Your minimum take-home floor exceeds what you receive without any contributions.');
      }
      return toResult(binarySearch(floorAnnual));
    }

    if (goalMode === 'tax-band') {
      const options: Array<{ label: string; nc: number; gc: number }> = [];
      if (adjustedEarnings - grossGiftAid > B2) {
        const gc = Math.max(0, adjustedEarnings - grossGiftAid - B2);
        options.push({ label: 'Restore personal allowance (effective income ≤ £100,000)', nc: gc * (1 - trb), gc });
      }
      if (adjustedEarnings - grossGiftAid > B1) {
        const gc = Math.max(0, adjustedEarnings - grossGiftAid - B1);
        options.push({ label: 'Basic rate only (effective income ≤ £50,270)', nc: gc * (1 - trb), gc });
      }
      if (options.length === 0) return { ...infeasible('Your effective income is already within the basic rate band.'), taxBandOptions: [] };
      const selected = options[Math.min(goalTaxBandIdx, options.length - 1)];
      return { ...toResult(selected.nc), taxBandOptions: options };
    }

    return toResult(0);
  }, [goalMode, goalTargetMonthly, goalFloorMonthly, goalTaxBandIdx,
      adjustedEarnings, salarySacrifice, employerContribution, totalPool,
      trb, grossIncomeTax, class1NI, class4NI, studentLoan,
      netGiftAid, grossGiftAid, recommendedNet, B1, B2, B3, TR_H, TR_60, TR_A]);

  // ─── Scenario comparison solver ───────────────────────────────────────────
  const scenarioResults = useMemo(() => {
    const calcAR = (base: number, gross: number): number => {
      if (gross <= 0 || base <= 0) return 0;
      const bottom = Math.max(0, base - gross);
      const fromAddl = Math.max(0, base - Math.max(bottom, B3)) * (TR_A / 100);
      const from60   = Math.max(0, Math.min(base, B3) - Math.max(bottom, B2)) * (TR_60 / 100);
      const fromHigh = Math.max(0, Math.min(base, B2) - Math.max(bottom, B1)) * (TR_H / 100);
      return fromAddl + from60 + fromHigh;
    };
    return scenarios.map(s => {
      const gc  = s.netContribution / (1 - trb);
      const gga = s.netGiftAid / (1 - trb);
      const pr  = calcAR(adjustedEarnings, gc);
      const gr  = calcAR(adjustedEarnings - gc, gga);
      const tar = pr + gr;
      const takeHome   = adjustedEarnings - grossIncomeTax + tar - class1NI - class4NI - studentLoan - s.netContribution - s.netGiftAid;
      const totalWealth = takeHome + gc + gga;
      const govTopUp   = (gc - s.netContribution) + (gga - s.netGiftAid) + tar;
      return { ...s, gc, gga, tar, takeHome, totalWealth, govTopUp };
    });
  }, [scenarios, adjustedEarnings, trb, grossIncomeTax, class1NI, class4NI, studentLoan,
      B1, B2, B3, TR_H, TR_60, TR_A]);

  // ─── Insight banner text ─────────────────────────────────────────────────
  const insightText = useMemo(() => {
    const parts: string[] = [];
    const totalGross = grossContribution + grossGiftAid;

    if (totalGross > 0) {
      if (grossContribution > 0 && grossGiftAid > 0) {
        parts.push(
          `Your pension contribution (${fmtD(grossContribution)} gross) and gift aid donations (${fmtD(grossGiftAid)} gross) together reduce your taxable income from ${fmtD(adjustedEarnings)} to ${fmtD(effectiveEarnings)}.`
        );
      } else if (grossContribution > 0) {
        parts.push(
          `Your gross pension contribution of ${fmtD(grossContribution)} reduces your taxable income from ${fmtD(adjustedEarnings)} to ${fmtD(effectiveEarnings)}.`
        );
      } else {
        parts.push(
          `Your gift aid donations (${fmtD(grossGiftAid)} gross) reduce your taxable income from ${fmtD(adjustedEarnings)} to ${fmtD(effectiveEarnings)}.`
        );
      }

      if (combinedBands.fromHigher > 0) {
        parts.push(
          `This moves ${fmtD(combinedBands.fromHigher)} of income out of the ${TR_B + TR_H}% higher rate band, creating ${fmtD(totalAdditionalRelief)} of additional tax relief via your self-assessment return.`
        );
      } else if (combinedBands.from60 > 0) {
        parts.push(
          `This moves ${fmtD(combinedBands.from60)} of income out of the personal allowance taper zone, creating ${fmtD(totalAdditionalRelief)} of additional tax relief.`
        );
      } else if (totalAdditionalRelief > 0) {
        parts.push(`This creates ${fmtD(totalAdditionalRelief)} of additional tax relief via your self-assessment return.`);
      }
    }

    if (studentLoan > 0) {
      const shortfall = recommendedNet - netContribution;
      if (totalAdditionalRelief >= studentLoan) {
        parts.push(
          `Your pension contribution fully offsets your ${SL_PLAN} student loan repayment of ${fmtD(studentLoan)} through additional tax relief.`
        );
      } else if (shortfall > 1) {
        parts.push(
          `To fully offset your student loan of ${fmtD(studentLoan)}, increase your net pension contribution by ${fmtD(shortfall)} to ${fmtD(recommendedNet)} (gross: ${fmtD(recommendedGross)}).`
        );
      }
    }

    return parts.join(' ');
  }, [grossContribution, grossGiftAid, adjustedEarnings, effectiveEarnings, combinedBands,
      totalAdditionalRelief, studentLoan, netContribution, recommendedNet, recommendedGross]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#faf9f6]">

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-black/10">
        <div className="max-w-[1400px] mx-auto px-6 py-4">

          {/* Row: title + inputs + outputs */}
          <div className="flex items-stretch gap-0">

            {/* Title */}
            <div className="shrink-0 pr-6 border-r border-black/10 flex flex-col justify-center max-w-[200px]">
              <h1 className="text-[15px] font-semibold text-[#1a1a18] leading-snug mb-0.5">
                How your pension contribution affects your earnings
              </h1>
              <p className="text-[11px] text-[#8a8a84] leading-relaxed">
                Tax relief, NI and student loan calculator
              </p>
            </div>

            {/* Inputs group */}
            <div className="flex items-center border-r border-black/10">
              <StatInput
                label="Employed earnings"
                value={employedEarnings}
                onChange={setEmployedEarnings}
                inputRef={empRef}
                step={1000}
              />
              <StatInput
                label="Self-employed profit"
                value={selfEmployedEarnings}
                onChange={setSelfEmployedEarnings}
                inputRef={seRef}
                step={1000}
              />
              <StatInput
                label="Net pension"
                value={Math.round(netContribution)}
                onChange={setNetContribution}
                inputRef={netRef}
                step={100}
                tooltip="Amount you personally contribute. Provider adds 20% basic rate relief on top."
              />
              <StatInput
                label="Net gift aid"
                value={Math.round(netGiftAid)}
                onChange={setNetGiftAid}
                inputRef={gaRef}
                step={100}
                tooltip="Amount donated to charity. Charity reclaims 20% basic rate from HMRC."
              />
              <StatInput
                label="Employer pension"
                value={Math.round(employerContribution)}
                onChange={setEmployerContribution}
                inputRef={empContribRef}
                step={100}
                tooltip="Total employer pension contributions for the tax year."
              />
              <StatInput
                label="Salary sacrifice"
                value={Math.round(salarySacrifice)}
                onChange={setSalarySacrifice}
                inputRef={ssRef}
                step={100}
                tooltip="Annual salary sacrifice pension amount (deducted before tax and NI)."
              />
            </div>

            {/* Outputs group */}
            <div className="flex items-center flex-1 min-w-0">
              <StatDisplay
                label="Gross pension"
                value={grossContribution}
                green
                tooltip="Net contribution plus 20% basic rate relief added by provider."
              />
              <StatDisplay
                label="Effective earnings"
                value={effectiveEarnings}
                green
                tooltip="Earnings after gross pension and gift aid are deducted."
              />
              <StatDisplay
                label={`Student loan (${SL_PLAN})`}
                value={studentLoan}
              />
              <StatDisplay
                label="Class 4 NI"
                value={class4NI}
                tooltip="Self-employed NI paid via self-assessment."
              />

              {/* Hide details toggle */}
              <div className="px-4 shrink-0">
                <button
                  onClick={() => setShowDetails(v => !v)}
                  className="flex items-center gap-1.5 text-sm text-[#4a4a46] border border-black/20 rounded-lg px-3 py-2 hover:border-black/30 transition-colors whitespace-nowrap"
                >
                  {showDetails ? 'Hide details' : 'Show details'}
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                    className={`transition-transform duration-200 ${showDetails ? 'rotate-180' : 'rotate-0'}`}>
                    <path d="M2.5 4.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Admin link */}
          <div className="flex justify-end mt-2">
            <button onClick={() => navigate('/admin')}
              className="text-[11px] text-[#c8c8c0] hover:text-[#8a8a84] transition-colors">
              Tax year {TAX_YEAR} · Admin
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main content ───────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">

        {/* ── Goal-based contribution planner ───────────────────────────── */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-sm font-semibold text-[#1a1a18]">Contribution planner</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-[#1d4e3a] text-white rounded-full px-2.5 py-0.5 font-medium tracking-wide">Adviser tool</span>
              <button
                onClick={() => setPlannerOpen(v => !v)}
                className="text-[11px] text-[#8a8a84] hover:text-[#1a1a18] border border-black/10 rounded-full px-2.5 py-0.5 transition-colors leading-none"
              >{plannerOpen ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          {plannerOpen && (<>
          <p className="text-[11px] text-[#8a8a84] mb-5 mt-1 leading-relaxed">
            Set a financial goal — we'll calculate the exact pension contribution needed to achieve it.
            Hit <strong>Apply</strong> to load the result into the calculator above.
          </p>

          {/* Goal selector tabs */}
          <div className="flex flex-wrap gap-2 mb-5">
            {([
              { id: 'take-home' as const,    label: 'Target take-home' },
              { id: 'student-loan' as const, label: 'Offset student loan' },
              { id: 'max-pension' as const,  label: 'Maximise pension' },
              { id: 'tax-band' as const,     label: 'Hit tax threshold' },
            ]).map(g => (
              <button
                key={g.id}
                onClick={() => setGoalMode(g.id)}
                className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-colors ${
                  goalMode === g.id
                    ? 'bg-[#1d4e3a] text-white border-[#1d4e3a]'
                    : 'bg-white text-[#4a4a46] border-black/15 hover:border-[#1d4e3a] hover:text-[#1d4e3a]'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Goal-specific input */}
          {goalMode === 'take-home' && (
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="text-xs text-[#4a4a46]">I need at least</span>
              <div className="flex items-baseline gap-1 bg-[#f7f6f2] rounded-lg px-3 py-2 border border-black/8">
                <span className="text-sm font-bold text-[#1a1a18]">£</span>
                <input
                  type="number"
                  value={goalTargetMonthly}
                  onChange={e => setGoalTargetMonthly(Number(e.target.value) || 0)}
                  className="text-sm font-bold text-[#1a1a18] bg-transparent outline-none w-20 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  step={100}
                />
              </div>
              <span className="text-xs text-[#4a4a46]">per month in my bank · maximise pension with remaining income</span>
            </div>
          )}

          {goalMode === 'student-loan' && (
            <div className="mb-5 bg-[#f7f6f2] rounded-xl px-4 py-3 text-xs text-[#4a4a46] leading-relaxed">
              Find the pension contribution where the self-assessment refund is large enough to fully offset the
              annual student loan repayment of <strong className="text-[#1a1a18]">{fmtD(studentLoan)}</strong>.
              The loan is still repaid via PAYE, but the SA refund covers that cost in full.
            </div>
          )}

          {goalMode === 'max-pension' && (
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="text-xs text-[#4a4a46]">Keep at least</span>
              <div className="flex items-baseline gap-1 bg-[#f7f6f2] rounded-lg px-3 py-2 border border-black/8">
                <span className="text-sm font-bold text-[#1a1a18]">£</span>
                <input
                  type="number"
                  value={goalFloorMonthly}
                  onChange={e => setGoalFloorMonthly(Number(e.target.value) || 0)}
                  className="text-sm font-bold text-[#1a1a18] bg-transparent outline-none w-20 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  step={100}
                />
              </div>
              <span className="text-xs text-[#4a4a46]">per month in bank · contribute everything else to pension</span>
            </div>
          )}

          {goalMode === 'tax-band' && (
            <div className="mb-5">
              {plannerResult.taxBandOptions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {plannerResult.taxBandOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setGoalTaxBandIdx(i)}
                      className={`text-xs px-3.5 py-1.5 rounded-lg border font-medium transition-colors ${
                        goalTaxBandIdx === i
                          ? 'bg-[#e8f2ed] text-[#1d4e3a] border-[#b8d4c4]'
                          : 'bg-white text-[#4a4a46] border-black/15 hover:border-[#1d4e3a]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#8a8a84]">
                  Threshold options will appear once earnings are entered above.
                </p>
              )}
            </div>
          )}

          {/* Result panel */}
          {plannerResult.infeasible ? (
            <div className="bg-[#fef9ec] border border-[#f0d88a] rounded-xl px-4 py-3 text-xs text-[#6b5a1e] leading-relaxed">
              {plannerResult.message}
            </div>
          ) : (
            <div className="bg-[#e8f2ed] rounded-2xl border border-[#b8d4c4] p-5">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#4a7a5e] mb-2">Recommended contribution</div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-[#1d4e3a] tabular-nums">{fmtD(plannerResult.nc)}</span>
                      <span className="text-xs text-[#4a7a5e]">net / yr</span>
                    </div>
                    <span className="text-[#4a7a5e] text-sm">→</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-[#1d4e3a] tabular-nums">{fmtD(plannerResult.gc)}</span>
                      <span className="text-xs text-[#4a7a5e]">gross (inc. basic-rate top-up)</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setNetContribution(Math.round(plannerResult.nc))}
                  className="shrink-0 text-xs bg-[#1d4e3a] text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-[#163d2e] active:scale-95 transition-all whitespace-nowrap"
                >
                  Apply ↑
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/60 rounded-xl p-3">
                  <div className="text-[10px] text-[#4a7a5e] mb-1">Projected take-home</div>
                  <div className="text-sm font-bold text-[#1d4e3a] tabular-nums">{fmtD(plannerResult.projectedTakeHome)}</div>
                  <div className="text-[11px] text-[#4a7a5e] tabular-nums mt-0.5">{fmtD(plannerResult.projectedTakeHome / 12)} / month</div>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <div className="text-[10px] text-[#4a7a5e] mb-1">SA refund (additional relief)</div>
                  <div className="text-sm font-bold text-[#1d4e3a] tabular-nums">{fmtD(plannerResult.projectedAdditionalRelief)}</div>
                  <div className="text-[11px] text-[#4a7a5e] mt-0.5">returned via self-assessment</div>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <div className="text-[10px] text-[#4a7a5e] mb-1">Total govt top-up</div>
                  <div className="text-sm font-bold text-[#1d4e3a] tabular-nums">
                    {fmtD((plannerResult.gc - plannerResult.nc) + plannerResult.projectedAdditionalRelief)}
                  </div>
                  <div className="text-[11px] text-[#4a7a5e] mt-0.5">basic-rate relief + SA refund</div>
                </div>
              </div>

              {plannerResult.exceedsAllowance && (
                <div className="mt-3 text-[11px] text-[#8a5a00] bg-white/80 border border-[#f0d88a] rounded-lg px-3 py-2 leading-relaxed">
                  ⚠ Gross contribution of {fmtD(plannerResult.gc)} exceeds the standard annual allowance (£60,000).
                  The client would need sufficient carry-forward or a higher individual allowance to avoid a tax charge.
                </div>
              )}
            </div>
          )}
          </>)}
        </div>

        {/* ── Scenario comparison ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-sm font-semibold text-[#1a1a18]">Scenario comparison</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-[#1d4e3a] text-white rounded-full px-2.5 py-0.5 font-medium tracking-wide">Adviser tool</span>
              <button
                onClick={() => setScenariosOpen(v => !v)}
                className="text-[11px] text-[#8a8a84] hover:text-[#1a1a18] border border-black/10 rounded-full px-2.5 py-0.5 transition-colors leading-none"
              >{scenariosOpen ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          {scenariosOpen && (<>
          <p className="text-[11px] text-[#8a8a84] mb-5 mt-1 leading-relaxed">
            Compare up to 3 contribution strategies side by side. Use <strong>Snapshot</strong> to copy the current calculator values, or enter figures manually.
            Hit <strong>Apply ↑</strong> on any scenario to load it into the calculator above.
          </p>

          <div className={`grid gap-4 ${scenarios.length >= 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {scenarioResults.map(s => {
              const bestWealth = Math.max(...scenarioResults.map(r => r.totalWealth));
              const isBest = scenarios.length > 1 && s.totalWealth === bestWealth && s.totalWealth > scenarioResults.find(r => r.id !== s.id)!.totalWealth;
              return (
                <div
                  key={s.id}
                  className={`rounded-2xl border p-4 flex flex-col gap-3 ${isBest ? 'border-[#b8d4c4] bg-[#f0f8f4]' : 'border-black/8 bg-[#fafaf8]'}`}
                >
                  {/* Header: name + badges + remove */}
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={s.name}
                      onChange={e => setScenarios(prev => prev.map(sc => sc.id === s.id ? { ...sc, name: e.target.value } : sc))}
                      className="text-sm font-semibold text-[#1a1a18] bg-transparent border-b border-transparent hover:border-black/20 focus:border-[#1d4e3a] outline-none flex-1 min-w-0 pb-px"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isBest && (
                        <span className="text-[10px] bg-[#1d4e3a] text-white rounded-full px-2 py-0.5 font-semibold">Best</span>
                      )}
                      {scenarios.length > 1 && (
                        <button
                          onClick={() => setScenarios(prev => prev.filter(sc => sc.id !== s.id))}
                          className="text-[#8a8a84] hover:text-[#c0392b] text-base leading-none transition-colors"
                          title="Remove scenario"
                        >×</button>
                      )}
                    </div>
                  </div>

                  {/* Inputs */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#8a8a84] whitespace-nowrap">Net pension / yr</span>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-xs font-medium text-[#1a1a18]">£</span>
                        <input
                          type="number"
                          value={s.netContribution}
                          onChange={e => setScenarios(prev => prev.map(sc => sc.id === s.id ? { ...sc, netContribution: Number(e.target.value) || 0 } : sc))}
                          className="text-xs font-semibold text-[#1a1a18] bg-transparent outline-none w-20 text-right appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none border-b border-black/10 focus:border-[#1d4e3a] pb-px"
                          step={100}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#8a8a84] whitespace-nowrap">Net gift aid / yr</span>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-xs font-medium text-[#1a1a18]">£</span>
                        <input
                          type="number"
                          value={s.netGiftAid}
                          onChange={e => setScenarios(prev => prev.map(sc => sc.id === s.id ? { ...sc, netGiftAid: Number(e.target.value) || 0 } : sc))}
                          className="text-xs font-semibold text-[#1a1a18] bg-transparent outline-none w-20 text-right appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none border-b border-black/10 focus:border-[#1d4e3a] pb-px"
                          step={100}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => setScenarios(prev => prev.map(sc => sc.id === s.id ? { ...sc, netContribution: netContribution, netGiftAid: netGiftAid } : sc))}
                      className="text-[10px] text-[#1d4e3a] hover:underline"
                    >
                      ↓ Snapshot from calculator
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-black/8" />

                  {/* Results */}
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between gap-2">
                      <span className="text-[#8a8a84]">Take-home</span>
                      <span className="font-semibold text-[#1a1a18] tabular-nums">{fmtD(s.takeHome)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-[#8a8a84] pl-3">per month</span>
                      <span className="text-[#8a8a84] tabular-nums">{fmtD(s.takeHome / 12)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-[#8a8a84]">Pension pot (gross)</span>
                      <span className="font-semibold text-[#1d4e3a] tabular-nums">{fmtD(s.gc)}</span>
                    </div>
                    {s.gga > 0 && (
                      <div className="flex justify-between gap-2">
                        <span className="text-[#8a8a84]">Charity (gross)</span>
                        <span className="font-semibold text-[#4a90a4] tabular-nums">{fmtD(s.gga)}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <span className="text-[#8a8a84]">SA refund</span>
                      <span className="font-semibold text-[#1a1a18] tabular-nums">{fmtD(s.tar)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-[#8a8a84]">Govt top-up (total)</span>
                      <span className="font-semibold text-[#1d4e3a] tabular-nums">+{fmtD(s.govTopUp)}</span>
                    </div>
                    <div className="border-t border-black/8 pt-1.5 flex justify-between gap-2">
                      <span className="font-semibold text-[#1a1a18]">Total wealth</span>
                      <span className={`font-bold tabular-nums ${isBest ? 'text-[#1d4e3a]' : 'text-[#1a1a18]'}`}>{fmtD(s.totalWealth)}</span>
                    </div>
                  </div>

                  {/* Apply */}
                  <button
                    onClick={() => { setNetContribution(s.netContribution); setNetGiftAid(s.netGiftAid); }}
                    className="mt-auto text-xs bg-[#1a1a18] text-white px-3 py-2 rounded-lg font-semibold hover:bg-[#333] transition-colors text-center"
                  >
                    Apply ↑
                  </button>
                </div>
              );
            })}

            {/* Add scenario column */}
            {scenarios.length < 3 && (
              <button
                onClick={() => {
                  const letter = String.fromCharCode(64 + nextScenarioId);
                  setScenarios(prev => [...prev, { id: nextScenarioId, name: `Option ${letter}`, netContribution: 0, netGiftAid: 0 }]);
                  setNextScenarioId(v => v + 1);
                }}
                className="rounded-2xl border-2 border-dashed border-black/12 p-4 flex flex-col items-center justify-center gap-2 text-[#8a8a84] hover:border-[#1d4e3a] hover:text-[#1d4e3a] transition-colors min-h-[200px]"
              >
                <span className="text-2xl font-light">+</span>
                <span className="text-xs font-medium">Add scenario</span>
              </button>
            )}
          </div>
          </>)}
        </div>

        {/* ── Carry forward & annual allowance ────────────────────────── */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-sm font-semibold text-[#1a1a18]">Carry forward &amp; annual allowance</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-[#1d4e3a] text-white rounded-full px-2.5 py-0.5 font-medium tracking-wide">Adviser tool</span>
              <button
                onClick={() => setCarryForwardOpen(v => !v)}
                className="text-[11px] text-[#8a8a84] hover:text-[#1a1a18] border border-black/10 rounded-full px-2.5 py-0.5 transition-colors leading-none"
              >{carryForwardOpen ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          {carryForwardOpen && (<>
          <p className="text-[11px] text-[#8a8a84] mb-5 mt-1 leading-relaxed">
            Unused annual allowances from the past 3 tax years can be carried forward. Enter each prior year's allowance and how much was used.
            {adjustedIncomeForTaper > TAPER_ADJUSTED && ` Adjusted income of ${fmtD(adjustedIncomeForTaper)} exceeds ${fmtD(TAPER_ADJUSTED)} — current year allowance is tapered.`}
          </p>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className={`rounded-xl p-4 ${taperedAA < STANDARD_AA ? 'bg-amber-50 border border-amber-200' : 'bg-[#e8f2ed] border border-[#b8d4c4]'}`}>
              <div className="text-[10px] uppercase tracking-wider text-[#8a8a84] mb-1">{TAX_YEAR} allowance</div>
              <div className={`text-xl font-bold tabular-nums ${taperedAA < STANDARD_AA ? 'text-amber-800' : 'text-[#1d4e3a]'}`}>{fmtD(taperedAA)}</div>
              {taperedAA < STANDARD_AA
                ? <div className="text-[10px] text-amber-700 mt-1">Tapered from {fmtD(STANDARD_AA)}</div>
                : <div className="text-[10px] text-[#4a7a5e] mt-1">Standard allowance</div>}
            </div>
            <div className="rounded-xl p-4 bg-[#fafaf8] border border-black/8">
              <div className="text-[10px] uppercase tracking-wider text-[#8a8a84] mb-1">Carry forward available</div>
              <div className="text-xl font-bold text-[#1a1a18] tabular-nums">{fmtD(totalCarryForward)}</div>
              <div className="text-[10px] text-[#8a8a84] mt-1">From prior 3 years</div>
            </div>
            <div className={`rounded-xl p-4 ${totalPensionInput > totalPool ? 'bg-red-50 border border-red-200' : 'bg-[#fafaf8] border border-black/8'}`}>
              <div className="text-[10px] uppercase tracking-wider text-[#8a8a84] mb-1">Total pool</div>
              <div className={`text-xl font-bold tabular-nums ${totalPensionInput > totalPool ? 'text-[#c0392b]' : 'text-[#1a1a18]'}`}>{fmtD(totalPool)}</div>
              <div className={`text-[10px] mt-1 ${totalPensionInput > totalPool ? 'text-[#c0392b]' : 'text-[#8a8a84]'}`}>
                {totalPensionInput > totalPool
                  ? `Exceeded by ${fmtD(totalPensionInput - totalPool)}`
                  : `${fmtD(Math.max(0, totalPool - totalPensionInput))} remaining`}
              </div>
            </div>
          </div>

          {taperedAA < STANDARD_AA && (
            <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 leading-relaxed space-y-1">
              <div className="font-semibold">Annual allowance tapered — adjusted income exceeds {fmtD(TAPER_ADJUSTED)}</div>
              <div>Threshold income: {fmtD(thresholdIncome)} · Adjusted income: {fmtD(adjustedIncomeForTaper)}</div>
              <div>Reduction: {fmtD(Math.floor((adjustedIncomeForTaper - TAPER_ADJUSTED) / 2))} (£1 for every £2 above {fmtD(TAPER_ADJUSTED)})</div>
            </div>
          )}

          <div className="border border-black/8 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#fafaf8] border-b border-black/8">
                  <th className="text-left px-4 py-3 font-medium text-[#8a8a84]">Tax year</th>
                  <th className="text-right px-4 py-3 font-medium text-[#8a8a84]">Annual allowance</th>
                  <th className="text-right px-4 py-3 font-medium text-[#8a8a84]">Contributions used</th>
                  <th className="text-right px-4 py-3 font-medium text-[#8a8a84]">Carry forward</th>
                </tr>
              </thead>
              <tbody>
                {priorYearLabels.map((label, i) => (
                  <tr key={label} className="border-b border-black/5 last:border-0">
                    <td className="px-4 py-3 font-medium text-[#1a1a18]">{label}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-baseline justify-end gap-0.5">
                        <span className="text-[#4a4a46]">£</span>
                        <input
                          type="number"
                          value={carryForward[i].allowance}
                          onChange={e => setCarryForward(prev => prev.map((cf, j) => j === i ? { ...cf, allowance: Number(e.target.value) || 0 } : cf))}
                          className="w-24 text-right bg-transparent border-b border-black/10 focus:border-[#1d4e3a] outline-none font-semibold text-[#1a1a18] appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none pb-px"
                          step={1000}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-baseline justify-end gap-0.5">
                        <span className="text-[#4a4a46]">£</span>
                        <input
                          type="number"
                          value={carryForward[i].used}
                          onChange={e => setCarryForward(prev => prev.map((cf, j) => j === i ? { ...cf, used: Number(e.target.value) || 0 } : cf))}
                          className="w-24 text-right bg-transparent border-b border-black/10 focus:border-[#1d4e3a] outline-none font-semibold text-[#1a1a18] appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none pb-px"
                          step={1000}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold tabular-nums ${cfAvailable[i] > 0 ? 'text-[#1d4e3a]' : 'text-[#8a8a84]'}`}>
                        {cfAvailable[i] > 0 ? fmtD(cfAvailable[i]) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>)}
        </div>

        {/* Chart card */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6">
          <h2 className="text-base font-semibold text-[#1a1a18] mb-4">Your income and tax bands</h2>

          {/* Legend */}
          <div className="flex items-center gap-6 mb-5 text-xs text-[#4a4a46]">
            <div className="flex items-center gap-2">
              <span className="inline-block w-6 border-t-2 border-[#1a1a18]" style={{borderStyle:'solid'}}/>
              <span>Gross earnings (before pension)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-6 border-t-2 border-[#1d4e3a]" style={{borderStyle:'dashed'}}/>
              <span>Effective earnings (after pension &amp; gift aid)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-5 h-3 rounded-sm" style={{background:'repeating-linear-gradient(45deg,#e8a87c 0,#e8a87c 1.5px,transparent 0,transparent 4px),#f5ddc8'}}/>
              <span>Removed by pension</span>
            </div>
            {grossGiftAid > 0 && (
              <div className="flex items-center gap-2">
                <span className="inline-block w-5 h-3 rounded-sm" style={{background:'repeating-linear-gradient(45deg,#4a90a4 0,#4a90a4 1.5px,transparent 0,transparent 4px),#b8d9e3'}}/>
                <span>Removed by gift aid</span>
              </div>
            )}
          </div>

          <TimelineChart
            earnings={totalEarnings}
            salarySacrifice={salarySacrifice}
            grossContribution={grossContribution}
            grossGiftAid={grossGiftAid}
            effectiveEarnings={effectiveEarnings}
            studentLoan={studentLoan}
            additionalRelief={totalAdditionalRelief}
            config={config}
          />
        </div>

        {/* Insight banner */}
        {insightText && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
            <span className="text-lg shrink-0 mt-0.5">💡</span>
            <p className="text-sm text-amber-900 leading-relaxed">{insightText}</p>
          </div>
        )}

        {/* Three detail cards */}
        {showDetails && (
          <div className="grid grid-cols-3 gap-5">

            {/* ── Card 1: Total Tax Liability ── */}
            <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[#1a1a18] mb-4">Total tax liability</h3>
              <p className="text-[11px] text-[#8a8a84] mb-4 leading-relaxed">
                Based on {salarySacrifice > 0 ? `adjusted earnings (${fmtD(adjustedEarnings)}, after salary sacrifice)` : 'total earnings'}, before any pension or gift aid relief.
              </p>

              {/* Income Tax */}
              <div className="mb-4">
                <div className="text-[11px] uppercase tracking-wider text-[#8a8a84] mb-2">Income Tax</div>
                {[
                  {
                    label: `Nil rate (0%)`,
                    note: `up to ${fmtD(B0)}`,
                    amount: 0,
                    show: adjustedEarnings > 0,
                  },
                  {
                    label: `Basic rate (${TR_B}%)`,
                    note: `${fmtD(B0)}–${fmtD(B1)}`,
                    amount: Math.min(Math.max(0, adjustedEarnings - B0), B1 - B0) * trb,
                    show: adjustedEarnings > B0,
                  },
                  {
                    label: `Higher rate (${TR_B + TR_H}%)`,
                    note: `${fmtD(B1)}–${fmtD(B2)}`,
                    amount: Math.min(Math.max(0, adjustedEarnings - B1), B2 - B1) * ((TR_B + TR_H) / 100),
                    show: adjustedEarnings > B1,
                  },
                  {
                    label: `PA taper (${TR_B + TR_60}%)`,
                    note: `${fmtD(B2)}–${fmtD(B3)}`,
                    amount: Math.min(Math.max(0, adjustedEarnings - B2), B3 - B2) * ((TR_B + TR_60) / 100),
                    show: adjustedEarnings > B2,
                  },
                  {
                    label: `Additional (${TR_B + TR_A}%)`,
                    note: `above ${fmtD(B3)}`,
                    amount: Math.max(0, adjustedEarnings - B3) * ((TR_B + TR_A) / 100),
                    show: adjustedEarnings > B3,
                  },
                ].filter(r => r.show && r.amount > 0).map(row => (
                  <div key={row.label} className="flex items-baseline justify-between py-1 gap-2">
                    <div>
                      <span className="text-xs text-[#4a4a46]">{row.label}</span>
                      <span className="text-[10px] text-[#8a8a84] ml-1">{row.note}</span>
                    </div>
                    <span className="text-xs text-[#1a1a18] font-medium tabular-nums shrink-0">{fmtD(row.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-black/8 mt-2">
                  <span className="text-xs font-semibold text-[#1a1a18]">Total income tax</span>
                  <span className="text-sm font-bold text-[#1a1a18] tabular-nums">{fmtD(grossIncomeTax)}</span>
                </div>
              </div>

              {/* NI */}
              <div className="mb-4">
                <div className="text-[11px] uppercase tracking-wider text-[#8a8a84] mb-2">National Insurance</div>
                <div className="flex items-baseline justify-between py-1 gap-2">
                  <div>
                    <span className="text-xs text-[#4a4a46]">Class 1 ({C1_Main}% / {C1_Upper}%)</span>
                    <span className="text-[10px] text-[#8a8a84] ml-1">PAYE – employed</span>
                  </div>
                  <span className="text-xs text-[#1a1a18] font-medium tabular-nums shrink-0">{fmtD(class1NI)}</span>
                </div>
                <div className="flex items-baseline justify-between py-1 gap-2">
                  <div>
                    <span className="text-xs text-[#4a4a46]">Class 4 ({C4_Main}% / {C4_Upper}%)</span>
                    <span className="text-[10px] text-[#8a8a84] ml-1">Self-assessment</span>
                  </div>
                  <span className="text-xs text-[#1a1a18] font-medium tabular-nums shrink-0">{fmtD(class4NI)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-black/8 mt-2">
                  <span className="text-xs font-semibold text-[#1a1a18]">Total NI</span>
                  <span className="text-sm font-bold text-[#1a1a18] tabular-nums">{fmtD(totalNI)}</span>
                </div>
              </div>

              {/* Student Loan */}
              <div className="mb-4">
                <div className="text-[11px] uppercase tracking-wider text-[#8a8a84] mb-2">Student Loan ({SL_PLAN})</div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-[#4a4a46]">{SL_R}% above {fmtD(SL_T)}</span>
                  <span className="text-xs text-[#1a1a18] font-medium tabular-nums">{fmtD(studentLoan)}</span>
                </div>
              </div>

              {/* Grand total */}
              <div className="flex justify-between items-center pt-3 border-t-2 border-black/15">
                <span className="text-sm font-bold text-[#1a1a18]">Total tax liability</span>
                <span className="text-xl font-bold text-[#1a1a18] tabular-nums">{fmtD(totalTaxLiability)}</span>
              </div>
              <div className="text-[11px] text-[#8a8a84] mt-1 text-right">
                {pct((totalTaxLiability / totalEarnings) * 100)} effective rate on total earnings
              </div>
            </div>

            {/* ── Card 2: Tax Relief on Contributions ── */}
            <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[#1a1a18] mb-1">Tax relief on contributions</h3>
              <p className="text-[11px] text-[#8a8a84] mb-4 leading-relaxed">
                Combined pension and gift aid — rates show total relief (additional via self-assessment).
              </p>

              {/* Visual bar */}
              {(() => {
                const totalGross = grossContribution + grossGiftAid;
                if (totalGross <= 0 || adjustedEarnings <= 0) {
                  return (
                    <div className="h-10 rounded-lg bg-black/5 flex items-center justify-center mb-5">
                      <span className="text-xs text-[#8a8a84]">Enter a contribution to see breakdown</span>
                    </div>
                  );
                }

                const bandMax = Math.max(adjustedEarnings, B1 + 5000);
                const toX = (v: number) => Math.min(100, (v / bandMax) * 100);

                const bars = [
                  { from: effectiveEarnings, to: adjustedEarnings - grossContribution, color: '#b8d9e3', hatch: '#4a90a4', label: 'Gift aid' },
                  { from: adjustedEarnings - grossContribution, to: adjustedEarnings, color: '#f5ddc8', hatch: '#e8a87c', label: 'Pension' },
                ].filter(b => b.to > b.from && grossGiftAid > 0 || b.label === 'Pension');

                return (
                  <div className="mb-5">
                    <div className="relative h-10 rounded-lg overflow-hidden bg-[#f0efeb]">
                      {/* Band colour overlays */}
                      {[
                        { lo: B0, hi: B1, bg: '#dde8e2' },
                        { lo: B1, hi: B2, bg: '#b8d4c4' },
                        { lo: B2, hi: B3, bg: '#9cbfac' },
                        { lo: B3, hi: bandMax, bg: '#7daa93' },
                      ].filter(b => b.lo < adjustedEarnings).map(b => (
                        <div key={b.lo} className="absolute top-0 h-full"
                          style={{ left: toX(b.lo) + '%', width: (toX(Math.min(b.hi, adjustedEarnings)) - toX(b.lo)) + '%', background: b.bg }} />
                      ))}
                      {/* Pension hatch */}
                      {grossContribution > 0 && (
                        <div className="absolute top-0 h-full"
                          style={{
                            left: toX(adjustedEarnings - grossContribution) + '%',
                            width: (toX(adjustedEarnings) - toX(adjustedEarnings - grossContribution)) + '%',
                            background: `repeating-linear-gradient(45deg,#e8a87c 0,#e8a87c 1.5px,transparent 0,transparent 4px),#f5ddc8`,
                          }} />
                      )}
                      {/* Gift aid hatch */}
                      {grossGiftAid > 0 && (
                        <div className="absolute top-0 h-full"
                          style={{
                            left: toX(effectiveEarnings) + '%',
                            width: (toX(adjustedEarnings - grossContribution) - toX(effectiveEarnings)) + '%',
                            background: `repeating-linear-gradient(45deg,#4a90a4 0,#4a90a4 1.5px,transparent 0,transparent 4px),#b8d9e3`,
                          }} />
                      )}
                    </div>
                    {/* X-axis labels */}
                    <div className="relative h-5 mt-1">
                      {[B0, B1, B2].filter(b => b < adjustedEarnings).map(b => (
                        <span key={b} className="absolute text-[9px] text-[#8a8a84] -translate-x-1/2"
                          style={{ left: toX(b) + '%' }}>
                          {fmtD(b)}
                        </span>
                      ))}
                      <span className="absolute text-[9px] text-[#1a1a18] font-medium translate-x-[-100%]"
                        style={{ left: '100%' }}>
                        {fmtD(adjustedEarnings)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Band breakdown rows */}
              <div className="space-y-0 mb-4">
                {[
                  {
                    label: `Higher rate ${TR_B + TR_H}% (${TR_H}%)`,
                    amount: combinedBands.fromHigher,
                    relief: combinedBands.fromHigher * (TR_H / 100),
                    bar: adjustedEarnings > B1,
                  },
                  {
                    label: `Basic rate ${TR_B}% (0%)`,
                    amount: combinedBands.fromBasic,
                    relief: 0,
                    bar: adjustedEarnings > B0,
                  },
                  {
                    label: `PA taper ${TR_B + TR_60}% (${TR_60}%)`,
                    amount: combinedBands.from60,
                    relief: combinedBands.from60 * (TR_60 / 100),
                    bar: adjustedEarnings > B2,
                  },
                  {
                    label: `Additional ${TR_B + TR_A}% (${TR_A}%)`,
                    amount: combinedBands.fromAdditional,
                    relief: combinedBands.fromAdditional * (TR_A / 100),
                    bar: adjustedEarnings > B3,
                  },
                ].filter(r => r.bar && r.amount > 0).map(row => (
                  <div key={row.label} className="flex items-center justify-between py-2 border-b border-black/5 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[#4a4a46]">From {row.label}</div>
                      <div className="text-[10px] text-[#8a8a84]">{fmtD(row.amount)} gross</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold text-[#1d4e3a] tabular-nums">
                        {row.relief > 0 ? `+${fmtD(row.relief)}` : '—'}
                      </div>
                      <div className="text-[10px] text-[#8a8a84]">extra relief</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs text-[#4a4a46]">
                  <span>Total gross contribution</span>
                  <span className="tabular-nums">{fmtD(grossContribution + grossGiftAid)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#4a4a46]">
                  <span>Relief at source (20%)</span>
                  <span className="tabular-nums text-[#1d4e3a]">+{fmtD((grossContribution - netContribution) + (grossGiftAid - netGiftAid))}</span>
                </div>
                <div className="flex justify-between text-xs text-[#4a4a46]">
                  <span>Additional relief (self-assessment)</span>
                  <span className="tabular-nums text-[#1d4e3a]">+{fmtD(totalAdditionalRelief)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-black/10">
                  <span className="text-xs font-semibold text-[#1a1a18]">Total tax relief</span>
                  <span className="text-base font-bold text-[#1d4e3a] tabular-nums">
                    {fmtD((grossContribution - netContribution) + (grossGiftAid - netGiftAid) + totalAdditionalRelief)}
                  </span>
                </div>
                {(netContribution + netGiftAid) > 0 && (
                  <div className="text-[11px] text-[#8a8a84] text-right">
                    {pct(((grossContribution - netContribution + grossGiftAid - netGiftAid + totalAdditionalRelief) / (netContribution + netGiftAid)) * 100)} effective relief rate on net contributions
                  </div>
                )}
              </div>
            </div>

            {/* ── Card 3: Student Loan Impact ── */}
            <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[#1a1a18] mb-1">Student loan impact</h3>
              <p className="text-[11px] text-[#8a8a84] mb-4 leading-relaxed">
                How your pension contribution and gift aid reduce your effective student loan burden.
              </p>

              <div className="space-y-3 mb-4">
                <FactRow label={`Threshold (${SL_PLAN})`} value={fmtD(SL_T)} />
                <FactRow label={salarySacrifice > 0 ? 'Adjusted earnings' : 'Total earnings'} value={fmtD(adjustedEarnings)} />
                <FactRow
                  label="Earnings above threshold"
                  value={fmtD(Math.max(0, adjustedEarnings - SL_T))}
                  dimmed={adjustedEarnings <= SL_T}
                />
                <FactRow
                  label={`Repayment (${SL_R}%)`}
                  value={fmtD(studentLoan)}
                  highlight
                />
              </div>

              {studentLoan > 0 && (
                <div className="border-t border-black/8 pt-3 space-y-3 mb-4">
                  <FactRow label="Additional relief generated" value={`+${fmtD(totalAdditionalRelief)}`} green />
                  <FactRow
                    label="Student loan after relief"
                    value={fmtD(Math.max(0, studentLoan - totalAdditionalRelief))}
                    highlight={totalAdditionalRelief < studentLoan}
                  />
                </div>
              )}

              {studentLoan > 0 && totalAdditionalRelief >= studentLoan && (
                <div className="bg-[#e8f2ed] border border-[#b8d4c4] rounded-lg p-3 text-xs text-[#1d4e3a]">
                  ✓ Your additional tax relief of {fmtD(totalAdditionalRelief)} fully covers your student loan repayment of {fmtD(studentLoan)}.
                </div>
              )}

              {studentLoan > 0 && totalAdditionalRelief < studentLoan && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 leading-relaxed">
                  Increase net pension to {fmtD(recommendedNet)} (gross: {fmtD(recommendedGross)}) to generate {fmtD(studentLoan)} in additional relief — fully covering your student loan.
                </div>
              )}

              {studentLoan === 0 && (
                <div className="text-xs text-[#8a8a84] text-center py-4">
                  No student loan repayment at current earnings.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Take-home summary ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-[#1a1a18] mb-1">Take-home pay summary</h3>
          <p className="text-[11px] text-[#8a8a84] mb-6 leading-relaxed">
            Annual position after all taxes, contributions, and self-assessment refunds.
            Income tax is on gross earnings; the SA refund returns additional relief.
          </p>

          <div className="grid grid-cols-2 gap-8">
            {/* Left: waterfall */}
            <div>
              <TakeHomeRow label="Total earnings" value={totalEarnings} plus />
              {salarySacrifice > 0 && <TakeHomeRow label="Salary sacrifice (pension)" value={salarySacrifice} minus />}
              <TakeHomeRow label="Income tax" value={grossIncomeTax} minus />
              {class1NI > 0 && <TakeHomeRow label="NI Class 1 — employed (PAYE)" value={class1NI} minus indent />}
              {class4NI > 0 && <TakeHomeRow label="NI Class 4 — self-employed (SA)" value={class4NI} minus indent />}
              <TakeHomeRow label={`Student loan (${SL_PLAN})`} value={studentLoan} minus />
              <TakeHomeRow label="Net pension contribution" value={netContribution} minus />
              {netGiftAid > 0 && <TakeHomeRow label="Net gift aid donation" value={netGiftAid} minus />}
              {totalAdditionalRelief > 0 && (
                <TakeHomeRow label="SA refund (additional relief)" value={totalAdditionalRelief} plus />
              )}
              <div className="border-t-2 border-black/20 mt-3 pt-3 flex justify-between items-baseline">
                <span className="text-sm font-bold text-[#1a1a18]">Take-home pay (in bank)</span>
                <span className="text-2xl font-bold text-[#1a1a18] tabular-nums">{fmtD(takeHomePay)}</span>
              </div>
            </div>

            {/* Right: buckets */}
            <div className="flex flex-col gap-3">
              <div className="text-[11px] uppercase tracking-wider text-[#8a8a84] mb-1">Where your earnings go</div>

              <BucketCard
                label="In your bank"
                value={takeHomePay}
                pct={(takeHomePay / totalEarnings) * 100}
                color="bg-[#1a1a18]"
                textColor="text-white"
              />
              <BucketCard
                label="Pension pot (gross)"
                sublabel={salarySacrifice > 0 ? 'personal + salary sacrifice' : 'inc. 20% basic rate top-up from HMRC'}
                value={grossContribution + salarySacrifice}
                pct={((grossContribution + salarySacrifice) / Math.max(1, totalEarnings)) * 100}
                color="bg-[#1d4e3a]"
                textColor="text-white"
              />
              {employerContribution > 0 && (
                <BucketCard
                  label="Employer pension"
                  sublabel="not from your earnings"
                  value={employerContribution}
                  pct={(employerContribution / Math.max(1, totalEarnings)) * 100}
                  color="bg-[#2a6e50]"
                  textColor="text-white"
                />
              )}
              {grossGiftAid > 0 && (
                <BucketCard
                  label="Charity (gross)"
                  sublabel="inc. 20% gift aid top-up from HMRC"
                  value={grossGiftAid}
                  pct={(grossGiftAid / totalEarnings) * 100}
                  color="bg-[#4a90a4]"
                  textColor="text-white"
                />
              )}
              <BucketCard
                label="Tax & NI"
                sublabel="income tax (net of relief) + NI"
                value={grossIncomeTax - totalAdditionalRelief + totalNI}
                pct={((grossIncomeTax - totalAdditionalRelief + totalNI) / totalEarnings) * 100}
                color="bg-[#f0efeb]"
                textColor="text-[#1a1a18]"
              />
              <BucketCard
                label={`Student loan (${SL_PLAN})`}
                value={studentLoan}
                pct={(studentLoan / totalEarnings) * 100}
                color="bg-[#f0efeb]"
                textColor="text-[#1a1a18]"
              />
            </div>
          </div>

          {/* ── Comparison: with vs without contributions ── */}
          {(netContribution > 0 || netGiftAid > 0 || salarySacrifice > 0 || employerContribution > 0) && (
            <div className="mt-8 pt-6 border-t border-black/8">
              <h4 className="text-sm font-semibold text-[#1a1a18] mb-1">Impact of contributions</h4>
              <p className="text-[11px] text-[#8a8a84] mb-5">
                How your overall financial position compares to making no pension or gift aid contributions.
              </p>

              <div className="grid grid-cols-3 gap-4 mb-5">
                {/* No contributions */}
                <div className="bg-[#f7f6f2] rounded-xl p-4 border border-black/6">
                  <div className="text-[10px] uppercase tracking-wider text-[#8a8a84] mb-3">Without contributions</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-[#8a8a84]">In bank</span>
                      <span className="font-semibold text-[#1a1a18] tabular-nums">{fmtD(noContribTakeHome)}</span>
                    </div>
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-[#8a8a84]">Pension pot</span>
                      <span className="font-semibold text-[#8a8a84] tabular-nums">£0</span>
                    </div>
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-[#8a8a84]">Charity</span>
                      <span className="font-semibold text-[#8a8a84] tabular-nums">£0</span>
                    </div>
                    <div className="border-t border-black/8 pt-2 flex justify-between text-xs gap-2">
                      <span className="font-semibold text-[#1a1a18]">Total wealth</span>
                      <span className="font-bold text-[#1a1a18] tabular-nums">{fmtD(noContribTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* With contributions */}
                <div className="bg-[#e8f2ed] rounded-xl p-4 border border-[#b8d4c4]">
                  <div className="text-[10px] uppercase tracking-wider text-[#1d4e3a] mb-3">With contributions</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-[#4a7a5e]">In bank</span>
                      <span className="font-semibold text-[#1d4e3a] tabular-nums">{fmtD(takeHomePay)}</span>
                    </div>
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-[#4a7a5e]">Pension pot (gross)</span>
                      <span className="font-semibold text-[#1d4e3a] tabular-nums">{fmtD(grossContribution)}</span>
                    </div>
                    {grossGiftAid > 0 && (
                      <div className="flex justify-between text-xs gap-2">
                        <span className="text-[#4a7a5e]">Charity (gross)</span>
                        <span className="font-semibold text-[#1d4e3a] tabular-nums">{fmtD(grossGiftAid)}</span>
                      </div>
                    )}
                    <div className="border-t border-[#b8d4c4] pt-2 flex justify-between text-xs gap-2">
                      <span className="font-semibold text-[#1d4e3a]">Total wealth</span>
                      <span className="font-bold text-[#1d4e3a] tabular-nums">{fmtD(withContribTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Difference */}
                <div className="rounded-xl p-4 border border-black/8 bg-white">
                  <div className="text-[10px] uppercase tracking-wider text-[#8a8a84] mb-3">Difference</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-[#8a8a84]">Bank impact</span>
                      <DiffValue value={takeHomePay - noContribTakeHome} />
                    </div>
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-[#8a8a84]">Pension gained (gross)</span>
                      <DiffValue value={grossContribution} alwaysPositive />
                    </div>
                    {grossGiftAid > 0 && (
                      <div className="flex justify-between text-xs gap-2">
                        <span className="text-[#8a8a84]">Charity (gross)</span>
                        <DiffValue value={grossGiftAid} alwaysPositive />
                      </div>
                    )}
                    <div className="border-t border-black/8 pt-2">
                      <div className="flex justify-between text-xs gap-2 mb-1">
                        <span className="font-semibold text-[#1a1a18]">Net gain</span>
                        <DiffValue value={totalRelief} alwaysPositive large />
                      </div>
                      <div className="text-[10px] text-[#8a8a84] text-right leading-tight">
                        govt top-ups on contributions
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Plain-English summary */}
              {totalRelief > 0 && (
                <div className="bg-[#f7f6f2] rounded-xl px-4 py-3 text-xs text-[#4a4a46] leading-relaxed">
                  By making contributions of {fmtD(netContribution + netGiftAid)} net (
                  {fmtD(grossContribution + grossGiftAid)} gross), your total wealth is{' '}
                  <strong className="text-[#1d4e3a]">{fmtD(totalRelief)} higher</strong> than if you made no
                  contributions. The extra {fmtD(totalRelief)} comes entirely from government tax relief —
                  {fmtD((grossContribution - netContribution) + (grossGiftAid - netGiftAid))} added at source
                  {totalAdditionalRelief > 0 && <> and {fmtD(totalAdditionalRelief)} returned via self-assessment</>}.
                  {' '}Your bank account is {fmtD(Math.abs(takeHomePay - noContribTakeHome))} {takeHomePay < noContribTakeHome ? 'lower' : 'higher'}, but
                  your pension pot is {fmtD(grossContribution)} larger.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Annual allowance usage chart ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-[#1a1a18] mb-1">Annual allowance usage</h3>
          <p className="text-[11px] text-[#8a8a84] mb-5 leading-relaxed">
            Current year first, then carry forward from oldest. Total pension input: <strong className="text-[#1a1a18]">{fmtD(totalPensionInput)}</strong>.
          </p>
          {(() => {
            let rem = totalPensionInput;
            const currentUsed = Math.min(rem, taperedAA);
            rem = Math.max(0, rem - currentUsed);
            const cfDrawdown = cfAvailable.map(avail => {
              const u = Math.min(rem, avail);
              rem = Math.max(0, rem - u);
              return u;
            });
            const overrun = rem;
            const bars = [
              { label: TAX_YEAR, note: taperedAA < STANDARD_AA ? 'Tapered' : 'Current year', total: taperedAA, used: currentUsed, current: true },
              ...priorYearLabels.map((label, i) => ({
                label,
                note: `Carry forward${cfAvailable[i] === 0 ? ' (none)' : ''}`,
                total: cfAvailable[i],
                used: cfDrawdown[i],
                current: false,
              })),
            ];
            return (
              <div className="space-y-3">
                {bars.map(bar => (
                  <div key={bar.label} className="flex items-center gap-3">
                    <div className="w-20 text-right shrink-0">
                      <div className="text-xs font-semibold text-[#1a1a18]">{bar.label}</div>
                      <div className="text-[10px] text-[#8a8a84]">{bar.note}</div>
                    </div>
                    <div className="flex-1">
                      {bar.total > 0 ? (
                        <div className="h-8 rounded-lg overflow-hidden bg-[#f0f0ec] flex">
                          {bar.used > 0 && (
                            <div
                              className={`h-full transition-all ${bar.current ? 'bg-[#1d4e3a]' : 'bg-[#4a7a5e]'}`}
                              style={{ width: `${Math.min(100, (bar.used / bar.total) * 100)}%` }}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="h-8 rounded-lg bg-[#f7f6f2] flex items-center px-3">
                          <span className="text-[10px] text-[#8a8a84]">No carry forward available</span>
                        </div>
                      )}
                    </div>
                    <div className="w-44 shrink-0 text-right">
                      {bar.total > 0 ? (
                        <>
                          <div className="text-xs font-semibold text-[#1a1a18] tabular-nums">{fmtD(bar.used)} / {fmtD(bar.total)}</div>
                          {bar.used < bar.total
                            ? <div className="text-[10px] text-[#1d4e3a] tabular-nums">{fmtD(bar.total - bar.used)} remaining</div>
                            : <div className="text-[10px] text-[#8a8a84]">Fully used</div>}
                        </>
                      ) : <div className="text-xs text-[#8a8a84]">—</div>}
                    </div>
                  </div>
                ))}
                {overrun > 0 && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800 leading-relaxed">
                    ⚠ Total pension input of {fmtD(totalPensionInput)} exceeds available pool of {fmtD(totalPool)} by {fmtD(overrun)}. A tax charge may apply.
                  </div>
                )}
                <div className="flex gap-6 pt-3 border-t border-black/8 text-xs text-[#8a8a84]">
                  <div><span className="font-semibold text-[#1a1a18] tabular-nums">{fmtD(totalPool)}</span> total pool</div>
                  <div><span className="font-semibold text-[#1a1a18] tabular-nums">{fmtD(Math.min(totalPensionInput, totalPool))}</span> used</div>
                  <div><span className="font-semibold text-[#1d4e3a] tabular-nums">{fmtD(Math.max(0, totalPool - totalPensionInput))}</span> remaining</div>
                </div>
              </div>
            );
          })()}
        </div>


      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatInput({
  label, value, onChange, inputRef, step, tooltip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  step: number;
  tooltip?: string;
}) {
  return (
    <div className="px-4 shrink-0">
      <div className="text-[11px] text-[#8a8a84] mb-1 whitespace-nowrap flex items-center gap-1">
        {label}
        {tooltip && <span className="cursor-help opacity-60" title={tooltip}>ⓘ</span>}
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-lg font-bold text-[#1a1a18]">£</span>
        <input
          ref={inputRef}
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className="text-lg font-bold text-[#1a1a18] bg-transparent outline-none w-[88px] appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none border-b border-black/10 focus:border-[#1d4e3a] pb-0.5 transition-colors"
          step={step}
        />
      </div>
    </div>
  );
}

function StatDisplay({
  label, value, green, tooltip,
}: {
  label: string;
  value: number;
  green?: boolean;
  tooltip?: string;
}) {
  return (
    <div className="px-4 shrink-0 border-l border-black/8">
      <div className="text-[11px] text-[#8a8a84] mb-1 whitespace-nowrap flex items-center gap-1">
        {label}
        {tooltip && <span className="cursor-help opacity-60" title={tooltip}>ⓘ</span>}
      </div>
      <div className={`text-lg font-bold tabular-nums ${green ? 'text-[#1d4e3a]' : 'text-[#1a1a18]'}`}>
        {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Math.round(value))}
      </div>
    </div>
  );
}

function FactRow({
  label, value, highlight, green, dimmed,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  green?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div className={`flex justify-between items-baseline gap-2 ${dimmed ? 'opacity-40' : ''}`}>
      <span className="text-xs text-[#4a4a46]">{label}</span>
      <span className={`text-xs font-semibold tabular-nums shrink-0 ${highlight ? 'text-[#1a1a18]' : green ? 'text-[#1d4e3a]' : 'text-[#4a4a46]'}`}>
        {value}
      </span>
    </div>
  );
}

function TakeHomeRow({
  label, value, plus, minus, indent,
}: {
  label: string;
  value: number;
  plus?: boolean;
  minus?: boolean;
  indent?: boolean;
}) {
  if (value === 0) return null;
  return (
    <div className={`flex justify-between items-baseline gap-2 py-1.5 border-b border-black/5 ${indent ? 'pl-4' : ''}`}>
      <span className={`text-xs ${indent ? 'text-[#8a8a84]' : 'text-[#4a4a46]'}`}>{label}</span>
      <span className={`text-xs font-semibold tabular-nums shrink-0 ${plus ? 'text-[#1d4e3a]' : minus ? 'text-[#c0392b]' : 'text-[#1a1a18]'}`}>
        {minus ? '−' : plus ? '+' : ''}{new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Math.round(value))}
      </span>
    </div>
  );
}

function BucketCard({
  label, sublabel, value, pct: pctVal, color, textColor,
}: {
  label: string;
  sublabel?: string;
  value: number;
  pct: number;
  color: string;
  textColor: string;
}) {
  if (value <= 0) return null;
  return (
    <div className={`${color} ${textColor} rounded-xl px-4 py-3 flex items-center justify-between`}>
      <div>
        <div className="text-sm font-semibold">{label}</div>
        {sublabel && <div className="text-[10px] opacity-70 mt-0.5">{sublabel}</div>}
      </div>
      <div className="text-right">
        <div className="text-xl font-bold tabular-nums">
          {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Math.round(value))}
        </div>
        <div className="text-[11px] opacity-70">{pctVal.toFixed(1)}% of earnings</div>
      </div>
    </div>
  );
}

function DiffValue({
  value, alwaysPositive, large,
}: {
  value: number;
  alwaysPositive?: boolean;
  large?: boolean;
}) {
  const isPositive = alwaysPositive ? true : value >= 0;
  const fmt = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
  return (
    <span className={`font-semibold tabular-nums shrink-0 ${large ? 'text-sm' : 'text-xs'} ${isPositive ? 'text-[#1d4e3a]' : 'text-[#c0392b]'}`}>
      {alwaysPositive ? '+' : value >= 0 ? '+' : '−'}{fmt.format(Math.abs(Math.round(value)))}
    </span>
  );
}
