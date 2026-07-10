import { useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTaxConfig } from './hooks/useTaxConfig';
import { useCalculatorState } from './context/CalculatorContext';
import { computeTax, calculateAdditionalRelief } from './lib/taxEngine';
import { TimelineChart } from './components/TimelineChart';
import { StatInput } from './components/StatInput';
import { StatDisplay } from './components/StatDisplay';
import { FormattedNumberInput } from './components/FormattedNumberInput';
import { CheckboxField } from './components/CheckboxField';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Math.round(n));
const fmtD = (n: number) =>
  '£' + fmt(n);
const pct = (n: number) =>
  n.toFixed(1) + '%';

export default function App() {
  const navigate = useNavigate();
  const { config } = useTaxConfig();
  const { B0, B1, B2, B3, TR_B, TR_H, TR_60, TR_A, SL_T, SL_R, SL_UNEARNED_THRESHOLD, TAX_YEAR, SL_PLAN,
          NI_L, NI_U, C1_Main, C1_Upper, C4_Main, C4_Upper,
          STANDARD_AA, TAPER_THRESHOLD, TAPER_ADJUSTED, TAPER_MIN_AA,
          PSA_BASIC, PSA_HIGHER, DIVIDEND_ALLOWANCE } = config;

  const {
    employedEarnings, setEmployedEarnings,
    selfEmployedEarnings, setSelfEmployedEarnings,
    netContribution, setNetContribution,
    netGiftAid, setNetGiftAid,
    savingsInterest, setSavingsInterest,
    rentalProfit, setRentalProfit,
    dividendIncome, setDividendIncome,
    hasStudentLoan, setHasStudentLoan,
    showDetails, setShowDetails,
    goalMode, setGoalMode,
    goalTargetMonthly, setGoalTargetMonthly,
    goalFloorMonthly, setGoalFloorMonthly,
    goalTaxBandIdx, setGoalTaxBandIdx,
    goalPsaIdx, setGoalPsaIdx,
    plannerOpen, setPlannerOpen,
    scenariosOpen, setScenariosOpen,
    scenarios, setScenarios,
    nextScenarioId, setNextScenarioId,
    employerContribution, setEmployerContribution,
    salarySacrifice, setSalarySacrifice,
    carryForwardOpen, setCarryForwardOpen,
    carryForward, setCarryForward,
  } = useCalculatorState();

  const empRef = useRef<HTMLInputElement>(null);
  const seRef = useRef<HTMLInputElement>(null);
  const netRef = useRef<HTMLInputElement>(null);
  const gaRef = useRef<HTMLInputElement>(null);
  const empContribRef = useRef<HTMLInputElement>(null);
  const ssRef = useRef<HTMLInputElement>(null);
  const siRef = useRef<HTMLInputElement>(null);
  const rpRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLInputElement>(null);

  // ─── Core derived values ──────────────────────────────────────────────────
  // Dividends are deliberately NOT folded into totalEarnings/adjustedEarnings/
  // effectiveEarnings — they sit in their own stream throughout, since they
  // occupy the top of the UK stacking order (non-savings → savings →
  // dividends) and are taxed via a separate rate table (see lib/taxEngine.ts).
  const totalEarnings = employedEarnings + selfEmployedEarnings + savingsInterest + rentalProfit;
  // "All money received" — a display-only denominator (Card 1 effective-rate
  // footer, bucket %ages). Never used inside band/tax math.
  const totalIncome = totalEarnings + dividendIncome;
  // Unearned income (savings interest, rental profit, dividends) is pooled
  // together for the student loan £2,000 de minimis test below. PSA, however,
  // is NOT based on this — it only ever shields savingsInterest (see psaExempt).
  const unearnedIncome = savingsInterest + rentalProfit + dividendIncome;
  const adjustedEarnings = Math.max(0, totalEarnings - salarySacrifice);
  const trb = TR_B / 100;
  const grossContribution = netContribution / (1 - trb);
  const grossGiftAid = netGiftAid / (1 - trb);
  const effectiveEarnings = Math.max(0, adjustedEarnings - grossContribution - grossGiftAid);

  // ─── Personal Savings Allowance ────────────────────────────────────────────
  // Tiers are pinned to the existing higher-rate (B1) and additional-rate (B3)
  // band boundaries, tested against adjusted net income (effectiveEarnings,
  // i.e. after pension/gift-aid, inclusive of interest) — no separate threshold.
  const psaAmount = effectiveEarnings <= B1 ? PSA_BASIC : effectiveEarnings <= B3 ? PSA_HIGHER : 0;
  // Deliberately keyed to savingsInterest only, NOT unearnedIncome — rental
  // profit (and any future unearned income type) is never PSA-eligible, even
  // though it does influence which PSA tier applies via effectiveEarnings above.
  const psaExempt = Math.min(psaAmount, savingsInterest);

  // ─── Income tax (non-dividend leg) + dividend tax ─────────────────────────
  // PSA is a straightforward exemption (like the personal allowance already
  // baked into B0), so it's subtracted directly from the taxable base here.
  // Pension/gift-aid relief is NOT folded in this way — it stays on the
  // separate "additional relief via self-assessment" path below, since
  // relief-at-source only gives 20% automatically at source.
  //
  // Personal allowance taper is computed explicitly inside computeTax, tested
  // against BOTH streams combined (non-dividend + dividend) — this replaces
  // the old implicit "60% band" trick, which only worked because non-dividend
  // income was the only thing ever tested against B2/B3. Its cost still lands
  // entirely on the non-dividend leg; dividends are always taxed at their
  // plain nominal band rate. See lib/taxEngine.ts for the full derivation.
  const taxEngine = computeTax(config, Math.max(0, adjustedEarnings - psaExempt), dividendIncome);
  const grossIncomeTax = taxEngine.nonDivTax;
  const grossDividendTax = taxEngine.divTax;

  // ─── Additional relief: how much a gross contribution from `base` income gives back ──
  // Delegates to lib/taxEngine.ts's diff-of-computeTax implementation, which
  // (unlike the old hand-derived band arithmetic) automatically captures both
  // the personal-allowance-restoration effect and any dividend-band-shift
  // effect a contribution causes — deliberately NOT netted for psaExempt here,
  // consistent with the pre-existing behaviour of this calculation.
  const pensionAdditionalRelief = calculateAdditionalRelief(config, adjustedEarnings, grossContribution, dividendIncome);
  const giftAidAdditionalRelief = calculateAdditionalRelief(config, adjustedEarnings - grossContribution, grossGiftAid, dividendIncome);
  const totalAdditionalRelief = pensionAdditionalRelief.total + giftAidAdditionalRelief.total;

  // ─── Contribution band breakdown (for Card 2) ─────────────────────────────
  // Positional band-crossing test — an approximation, not the exact
  // taper-aware engine used for the headline figures (see lib/taxEngine.ts).
  // Only fromAdditional/from60 (tested against B2/B3) are shifted by
  // dividendIncome — that shift exists specifically to detect personal-
  // allowance taper triggered by TOTAL income (dividends included) crossing
  // £100k, even when non-dividend income alone never reaches it.
  // fromHigher/fromBasic (tested against B0/B1) must NOT be shifted: that
  // boundary is about the salary/self-employment income's own position in
  // the stack, which dividends sitting above it don't change. Shifting it
  // too (a bug from an earlier pass) misattributed relief to "moving out of
  // the 40% band" for salary that never left the basic-rate band — the
  // £50,270 threshold only applies to the dividend layer via the dividend
  // relief figures already computed separately (calculateAdditionalRelief's
  // divRelief), not via this non-dividend band test. Like the taper-zone
  // shift, this is not bit-exact with the explicit-taper engine; the totals
  // below (totalAdditionalRelief, from calculateAdditionalRelief) ARE exact
  // and remain the source of truth. This is informational/descriptive only.
  const bandBreakdown = (top: number, bottom: number) => {
    const tTaper = top + dividendIncome;
    const bTaper = bottom + dividendIncome;
    return {
      fromAdditional: Math.max(0, tTaper - Math.max(bTaper, B3)),
      from60:         Math.max(0, Math.min(tTaper, B3) - Math.max(bTaper, B2)),
      fromHigher:     Math.max(0, Math.min(top, B2) - Math.max(bottom, B1)),
      fromBasic:      Math.max(0, Math.min(top, B1) - Math.max(bottom, B0)),
    };
  };

  const pensionBands = bandBreakdown(adjustedEarnings, adjustedEarnings - grossContribution);
  const giftAidBands = bandBreakdown(adjustedEarnings - grossContribution, effectiveEarnings);
  const combinedBands = {
    fromAdditional: pensionBands.fromAdditional + giftAidBands.fromAdditional,
    from60:         pensionBands.from60 + giftAidBands.from60,
    fromHigher:     pensionBands.fromHigher + giftAidBands.fromHigher,
    fromBasic:      pensionBands.fromBasic + giftAidBands.fromBasic,
  };

  // ─── Student loan ─────────────────────────────────────────────────────────
  // Pooled unearned income (savings interest + rental profit + dividends)
  // only counts toward repayment income once the COMBINED total exceeds the
  // de minimis threshold, and then counts in FULL, not just the excess — a
  // genuine SLC/HMRC self-assessment cliff-edge rule.
  // NOTE: adjustedEarnings never contains dividendIncome (it's tracked as a
  // separate stream throughout — see "Core derived values" above), so the
  // above-threshold branch must add it explicitly rather than being written
  // as `adjustedEarnings - unearnedIncome`, which would silently subtract
  // dividends that were never added in the first place.
  const studentLoanIncome = unearnedIncome > SL_UNEARNED_THRESHOLD
    ? adjustedEarnings + dividendIncome
    : adjustedEarnings - savingsInterest - rentalProfit;
  // Forcing this to 0 (rather than gating the constant elsewhere) is the
  // load-bearing fix for the whole "no student loan" toggle — every
  // downstream total, the insight banner's student-loan paragraph, and the
  // take-home waterfall/bucket rows already correctly disappear once this
  // is 0, since they're all either derived from it or gate on value === 0.
  const studentLoan = hasStudentLoan
    ? Math.max(0, (studentLoanIncome - SL_T) * (SL_R / 100))
    : 0;

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
  // grossIncomeTax = income tax on adjustedEarnings (non-dividend leg)
  // grossDividendTax = tax on dividendIncome — dividends have no PAYE
  // withholding and no relief-at-source equivalent, so unlike pension/gift
  // aid this is a plain add/subtract with no gross-vs-net split.
  // totalAdditionalRelief = SA refund received back (both legs)
  // netContribution = cash paid from bank into personal pension
  // netGiftAid = cash donated to charity from bank
  const takeHomePay = adjustedEarnings + dividendIncome
    - grossIncomeTax
    - grossDividendTax
    + totalAdditionalRelief
    - class1NI
    - class4NI
    - studentLoan
    - netContribution
    - netGiftAid;

  // ─── Totals (Card 1) ──────────────────────────────────────────────────────
  const totalTaxLiability = grossIncomeTax + grossDividendTax + totalNI + studentLoan;

  // ─── Tapered annual allowance & carry forward pool ────────────────────────
  // NOTE: this is the PENSION annual-allowance taper (a distinct HMRC
  // mechanism from the personal-allowance taper computed inside taxEngine —
  // do not conflate the two). "Threshold income"/"adjusted income" for AA
  // taper purposes include all taxable income sources, dividends included.
  const thresholdIncome = adjustedEarnings + dividendIncome - netContribution;
  const adjustedIncomeForTaper = totalEarnings + dividendIncome + employerContribution + salarySacrifice;
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
  // maxRelief = the ceiling of additional relief achievable by contributing
  // gross pension up to ~100% of relevant earnings (adjustedEarnings) — the
  // real HMRC ceiling for relief eligibility, and also the point at which
  // calculateAdditionalRelief's nonDivRelief plateaus (see lib/taxEngine.ts).
  // When the student loan repayment exceeds this ceiling, no contribution
  // can fully offset it — the search target is clamped to the ceiling so
  // the (now monotonic-then-flat) binary search still converges to the
  // *smallest* contribution that reaches the maximum achievable relief,
  // rather than running off to the search boundary.
  const maxRelief = useMemo(() => {
    const pr = calculateAdditionalRelief(config, adjustedEarnings, adjustedEarnings, dividendIncome);
    const gr = calculateAdditionalRelief(config, 0, grossGiftAid, dividendIncome);
    return pr.total + gr.total;
  }, [config, adjustedEarnings, grossGiftAid, dividendIncome]);

  const studentLoanFullyOffsettable = studentLoan === 0 || maxRelief >= studentLoan;

  const recommendedNet = useMemo(() => {
    // NOTE: this used to early-return when adjustedEarnings <= B1, on the
    // (pre-dividend) assumption that salary under the higher-rate threshold
    // could never generate additional relief. With dividends, that's no
    // longer true — a contribution can still shift dividends into a lower
    // rate band and generate real relief even when salary alone never
    // leaves the basic-rate band (see lib/taxEngine.ts's divRelief). Using
    // `maxRelief <= 0` instead correctly captures both legs.
    if (studentLoan === 0 || maxRelief <= 0) return 0;
    const target = Math.min(studentLoan, maxRelief);
    let lo = 0;
    let hi = adjustedEarnings * 0.8;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const g = mid / (1 - trb);
      const pr = calculateAdditionalRelief(config, adjustedEarnings, g, dividendIncome);
      const gr = calculateAdditionalRelief(config, adjustedEarnings - g, grossGiftAid, dividendIncome);
      if (pr.total + gr.total < target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }, [config, adjustedEarnings, studentLoan, grossGiftAid, dividendIncome, maxRelief, trb]);

  const recommendedGross = recommendedNet / (1 - trb);

  // If the student loan toggle is switched off while the "Offset student
  // loan" goal is selected, fall back to a goal that still has a visible
  // tab — otherwise the planner would be stuck showing a goal whose tab no
  // longer exists in the list below.
  useEffect(() => {
    if (!hasStudentLoan && goalMode === 'student-loan') {
      setGoalMode('take-home');
    }
  }, [hasStudentLoan, goalMode, setGoalMode]);

  // ─── No-contribution baseline (for comparison) ────────────────────────────
  // grossIncomeTax/grossDividendTax are already contribution-independent
  // (PAYE-basis — personal pension/gift aid contributions never reduce the
  // taxable base fed into computeTax above), so they can be reused directly.
  const noContribTakeHome = adjustedEarnings + dividendIncome
    - grossIncomeTax - grossDividendTax - class1NI - class4NI - studentLoan;
  const withContribTotal  = takeHomePay + grossContribution + salarySacrifice + employerContribution + grossGiftAid;
  const noContribTotal    = noContribTakeHome;
  const totalRelief       = withContribTotal - noContribTotal;

  // ─── Goal-based planner solver ────────────────────────────────────────────
  // NOTE: computeTHP/toResult close over the current `grossIncomeTax`/
  // `grossDividendTax` (which already have psaExempt/taper baked in at the
  // *actual* contribution level) rather than recomputing PSA for each
  // candidate `nc`. When savings interest is present, projected figures for
  // a candidate contribution that crosses a PSA tier boundary (B1/B3) are a
  // close approximation, not exact — accepted for this phase, consistent
  // with how this solver already treats the gross-tax baseline as fixed
  // elsewhere. Dividend-band-shift relief, however, IS computed exactly on
  // every candidate via calculateAdditionalRelief (cheap — 2 extra
  // computeTax calls — and this is a common real-world profile for this
  // calculator, unlike the rarer PSA-boundary-crossing case).
  const plannerResult = useMemo(() => {
    const computeTHP = (nc: number): number => {
      const gc = nc / (1 - trb);
      const pr = calculateAdditionalRelief(config, adjustedEarnings, gc, dividendIncome);
      const gr = calculateAdditionalRelief(config, adjustedEarnings - gc, grossGiftAid, dividendIncome);
      return adjustedEarnings + dividendIncome - grossIncomeTax - grossDividendTax + pr.total + gr.total - class1NI - class4NI - studentLoan - nc - netGiftAid;
    };

    const toResult = (nc: number) => {
      const gc = nc / (1 - trb);
      const pr = calculateAdditionalRelief(config, adjustedEarnings, gc, dividendIncome);
      const gr = calculateAdditionalRelief(config, adjustedEarnings - gc, grossGiftAid, dividendIncome);
      return {
        nc,
        gc,
        projectedTakeHome: adjustedEarnings + dividendIncome - grossIncomeTax - grossDividendTax + pr.total + gr.total - class1NI - class4NI - studentLoan - nc - netGiftAid,
        projectedAdditionalRelief: pr.total + gr.total,
        exceedsAllowance: gc + salarySacrifice + employerContribution > totalPool,
        infeasible: false,
        message: '',
        partialNote: '',
        taxBandOptions: [] as Array<{ label: string; nc: number; gc: number }>,
        psaOptions: [] as Array<{ label: string; nc: number; gc: number }>,
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

    const infeasible = (msg: string) => ({ ...toResult(0), infeasible: true, message: msg, partialNote: '' });

    if (goalMode === 'take-home') {
      const targetAnnual = goalTargetMonthly * 12;
      if (targetAnnual >= computeTHP(0)) {
        return infeasible('Your take-home without any contributions is already at or below this target. No contribution is needed.');
      }
      return toResult(binarySearch(targetAnnual));
    }

    if (goalMode === 'student-loan') {
      if (studentLoan === 0) return infeasible('No student loan repayments apply at your current income level.');
      const result = toResult(Math.max(0, recommendedNet));
      if (!studentLoanFullyOffsettable) {
        return {
          ...result,
          partialNote: `This is the most relief achievable (£${fmt(maxRelief)}) — it doesn't fully cover your ${fmtD(studentLoan)} student loan repayment. The remaining £${fmt(studentLoan - maxRelief)} can't be offset through pension contributions alone.`,
        };
      }
      return result;
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
      // Personal allowance taper is driven by TOTAL income across all
      // sources (including dividends), not just non-dividend earnings — see
      // lib/taxEngine.ts. A pension contribution only reduces the
      // non-dividend base, so the gross needed is the full excess of
      // (adjustedEarnings + dividendIncome) over B2, not just adjustedEarnings.
      if (adjustedEarnings + dividendIncome - grossGiftAid > B2) {
        const gc = Math.max(0, adjustedEarnings + dividendIncome - grossGiftAid - B2);
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

    if (goalMode === 'savings-allowance') {
      const options: Array<{ label: string; nc: number; gc: number }> = [];
      if (adjustedEarnings - grossGiftAid > B3) {
        const gc = Math.max(0, adjustedEarnings - grossGiftAid - B3);
        options.push({ label: `Recoup £${PSA_HIGHER} allowance (adjusted net income ≤ ${fmtD(B3)})`, nc: gc * (1 - trb), gc });
      }
      if (adjustedEarnings - grossGiftAid > B1) {
        const gc = Math.max(0, adjustedEarnings - grossGiftAid - B1);
        options.push({ label: `Recoup full £${PSA_BASIC} allowance (adjusted net income ≤ ${fmtD(B1)})`, nc: gc * (1 - trb), gc });
      }
      if (options.length === 0) return { ...infeasible('You already receive the maximum Personal Savings Allowance at your income level.'), psaOptions: [] };
      const selected = options[Math.min(goalPsaIdx, options.length - 1)];
      return { ...toResult(selected.nc), psaOptions: options };
    }

    return toResult(0);
  }, [config, goalMode, goalTargetMonthly, goalFloorMonthly, goalTaxBandIdx, goalPsaIdx,
      adjustedEarnings, dividendIncome, salarySacrifice, employerContribution, totalPool,
      trb, grossIncomeTax, grossDividendTax, class1NI, class4NI, studentLoan,
      netGiftAid, grossGiftAid, recommendedNet, maxRelief, studentLoanFullyOffsettable,
      B1, B2, B3, PSA_BASIC, PSA_HIGHER]);

  // ─── Scenario comparison solver ───────────────────────────────────────────
  // Scenarios only vary netContribution/netGiftAid per card — savingsInterest
  // and rentalProfit (like all other earnings inputs) are shared globally
  // across every scenario. Extension point: per-scenario unearned-income
  // fields would need the same treatment as netContribution/netGiftAid below
  // if "what-if" modeling of those is wanted later.
  const scenarioResults = useMemo(() => {
    return scenarios.map(s => {
      const gc  = s.netContribution / (1 - trb);
      const gga = s.netGiftAid / (1 - trb);
      const pr  = calculateAdditionalRelief(config, adjustedEarnings, gc, dividendIncome);
      const gr  = calculateAdditionalRelief(config, adjustedEarnings - gc, gga, dividendIncome);
      const tar = pr.total + gr.total;
      const takeHome   = adjustedEarnings + dividendIncome - grossIncomeTax - grossDividendTax + tar - class1NI - class4NI - studentLoan - s.netContribution - s.netGiftAid;
      const totalWealth = takeHome + gc + gga;
      const govTopUp   = (gc - s.netContribution) + (gga - s.netGiftAid) + tar;
      return { ...s, gc, gga, tar, takeHome, totalWealth, govTopUp };
    });
  }, [config, scenarios, adjustedEarnings, dividendIncome, trb, grossIncomeTax, grossDividendTax, class1NI, class4NI, studentLoan]);

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

      const divReliefTotal = pensionAdditionalRelief.divRelief + giftAidAdditionalRelief.divRelief;
      if (combinedBands.fromHigher > 0) {
        parts.push(
          `This moves ${fmtD(combinedBands.fromHigher)} of income out of the ${TR_B + TR_H}% higher rate band, creating ${fmtD(totalAdditionalRelief)} of additional tax relief via your self-assessment return.`
        );
      } else if (combinedBands.from60 > 0) {
        parts.push(
          `This moves ${fmtD(combinedBands.from60)} of income out of the personal allowance taper zone, creating ${fmtD(totalAdditionalRelief)} of additional tax relief.`
        );
      } else if (divReliefTotal > 0) {
        parts.push(
          `Your salary/self-employment income stays within the same tax band, but since dividends are taxed last, this contribution shifts them into a lower dividend rate — creating ${fmtD(totalAdditionalRelief)} of additional tax relief via your self-assessment return.`
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
      } else if (!studentLoanFullyOffsettable) {
        parts.push(
          `Your ${SL_PLAN} student loan repayment of ${fmtD(studentLoan)} can't be fully offset through pension contributions alone — the maximum additional relief achievable is ${fmtD(maxRelief)} (at a ${fmtD(recommendedNet)} net contribution).`
        );
      } else if (shortfall > 1) {
        parts.push(
          `To fully offset your student loan of ${fmtD(studentLoan)}, increase your net pension contribution by ${fmtD(shortfall)} to ${fmtD(recommendedNet)} (gross: ${fmtD(recommendedGross)}).`
        );
      }
    }

    return parts.join(' ');
  }, [grossContribution, grossGiftAid, adjustedEarnings, effectiveEarnings, combinedBands,
      pensionAdditionalRelief, giftAidAdditionalRelief, totalAdditionalRelief, studentLoan,
      studentLoanFullyOffsettable, maxRelief, netContribution, recommendedNet, recommendedGross]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#faf9f6]">

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-black/10">
        <div className="max-w-[1600px] mx-auto px-6 pt-3 pb-2">

          {/* Row 1: Back button + editable inputs */}
          <div className="flex items-center gap-0 border-b border-black/8 pb-3">

            {/* Back to home */}
            <div className="shrink-0 pr-6 border-r border-black/10 flex flex-col justify-center min-w-[150px]">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-1 text-[15px] font-semibold text-[#1a1a18] leading-snug mb-0.5 hover:text-[#1d4e3a] transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M8 2.5L4 6.5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Home
              </button>
              <p className="text-[11px] uppercase tracking-wider text-[#8a8a84] leading-relaxed">
                Your inputs
              </p>
            </div>

            {/* Editable inputs — grouped: Earnings | Unearned income | Pension & gift aid.
                Each group is its own colour-coded "tab" (top border) with flex-grow set to
                its field count (2/3/4) rather than an equal flex-1 split — this reproduces
                the original flat layout's per-field width (each StatInput got 1/9 of the row)
                instead of unfairly squeezing the 4-field Pension group into the same width as
                the 2-field Earnings group. Each group's own StatInputs are flex-1 within it.
                Note: a group wrapper WITHOUT its own flex-grow sizes to its content instead of
                sharing the outer row, which silently breaks the whole row's width distribution
                (hit this exact bug earlier) — every group wrapper below must keep one. */}
            <div className="flex items-stretch flex-1 min-w-0 gap-2.5">
              <div className="flex-[2] min-w-0 flex flex-wrap items-center rounded-lg border-t-[3px] border-[#4a90a4] bg-[#4a90a4]/5 px-3 pt-2 pb-1">
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
              </div>

              <div className="flex-[3] min-w-0 flex flex-wrap items-center rounded-lg border-t-[3px] border-[#9b7fd4] bg-[#9b7fd4]/5 px-3 pt-2 pb-1">
                <StatInput
                  label="Savings interest"
                  value={Math.round(savingsInterest)}
                  onChange={setSavingsInterest}
                  inputRef={siRef}
                  step={100}
                  tooltip="Gross interest received on savings/investments over the tax year. Shielded in part by your Personal Savings Allowance."
                />
                <StatInput
                  label="Rental Profit (Taxable)"
                  value={Math.round(rentalProfit)}
                  onChange={setRentalProfit}
                  inputRef={rpRef}
                  step={100}
                  tooltip="Enter rental income after allowable expenses or any property allowance claimed. Do not enter gross rent received."
                />
                <StatInput
                  label="Dividend income"
                  value={Math.round(dividendIncome)}
                  onChange={setDividendIncome}
                  inputRef={divRef}
                  step={100}
                  tooltip="Gross dividend income for the tax year. Taxed last, on top of all other income, using dividend-specific rates. Shielded in part by your £500 dividend allowance."
                />
              </div>

              <div className="flex-[4] min-w-0 flex flex-wrap items-center rounded-lg border-t-[3px] border-[#1d4e3a] bg-[#1d4e3a]/5 px-3 pt-2 pb-1">
                <StatInput
                  label="Net pension"
                  value={Math.round(netContribution)}
                  onChange={setNetContribution}
                  inputRef={netRef}
                  step={100}
                  tooltip="Amount you personally contribute. Provider adds 20% basic rate relief on top."
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
                <StatInput
                  label="Net gift aid"
                  value={Math.round(netGiftAid)}
                  onChange={setNetGiftAid}
                  inputRef={gaRef}
                  step={100}
                  tooltip="Amount donated to charity. Charity reclaims 20% basic rate from HMRC."
                />
              </div>
            </div>
          </div>

          {/* Row 2: Calculated outputs + controls */}
          <div className="flex items-center pt-2 mt-2 bg-[#f7faf8] rounded-xl -mx-2 px-2">
            {/* Calculated label */}
            <div className="shrink-0 pr-6 border-r border-black/10 flex flex-col justify-center min-w-[150px] self-stretch">
              <p className="text-[11px] uppercase tracking-wider text-[#8a8a84] leading-relaxed">
                Calculated
              </p>
            </div>

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
              {hasStudentLoan && (
                <StatDisplay
                  label={`Student loan (${SL_PLAN})`}
                  value={studentLoan}
                />
              )}
              <StatDisplay
                label="Class 4 NI"
                value={class4NI}
                tooltip="Self-employed NI paid via self-assessment."
              />
            </div>

            {/* Hide details toggle + tax year */}
            <div className="flex items-center gap-4 shrink-0 pl-4">
              <CheckboxField
                checked={hasStudentLoan}
                onChange={setHasStudentLoan}
                label="Student loan (Plan 2)"
                tooltip="Plan 2 only — other plans aren't currently supported. Repayments are calculated purely from income above the threshold; outstanding balance isn't taken into account."
              />
              <div className="w-px h-5 bg-black/10" />
              <button
                onClick={() => setShowDetails(v => !v)}
                className="flex items-center gap-1.5 text-sm text-[#4a4a46] border border-black/20 rounded-lg px-3 py-1.5 hover:border-black/30 transition-colors whitespace-nowrap"
              >
                {showDetails ? 'Hide details' : 'Show details'}
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                  className={`transition-transform duration-200 ${showDetails ? 'rotate-180' : 'rotate-0'}`}>
                  <path d="M2.5 4.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <span className="text-[11px] text-[#c8c8c0] whitespace-nowrap">
                Tax year {TAX_YEAR}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main content ───────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">

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
              ...(hasStudentLoan ? [{ id: 'student-loan' as const, label: 'Offset student loan' }] : []),
              { id: 'max-pension' as const,  label: 'Maximise pension' },
              { id: 'tax-band' as const,     label: 'Hit tax threshold' },
              { id: 'savings-allowance' as const, label: 'Recoup savings allowance' },
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
                <FormattedNumberInput
                  value={goalTargetMonthly}
                  onChange={setGoalTargetMonthly}
                  step={100}
                  className="text-sm font-bold text-[#1a1a18] bg-transparent outline-none w-20"
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
                <FormattedNumberInput
                  value={goalFloorMonthly}
                  onChange={setGoalFloorMonthly}
                  step={100}
                  className="text-sm font-bold text-[#1a1a18] bg-transparent outline-none w-20"
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

          {goalMode === 'savings-allowance' && (
            <div className="mb-5">
              {savingsInterest <= 0 ? (
                <p className="text-xs text-[#8a8a84]">
                  Enter a savings interest amount above to see Personal Savings Allowance options.
                </p>
              ) : plannerResult.psaOptions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {plannerResult.psaOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setGoalPsaIdx(i)}
                      className={`text-xs px-3.5 py-1.5 rounded-lg border font-medium transition-colors ${
                        goalPsaIdx === i
                          ? 'bg-[#f1ecf9] text-[#6b4fa0] border-[#d4c4e8]'
                          : 'bg-white text-[#4a4a46] border-black/15 hover:border-[#6b4fa0]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#8a8a84]">
                  You already receive the maximum Personal Savings Allowance at your income level.
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
              {plannerResult.partialNote && (
                <div className="mt-3 text-[11px] text-[#8a5a00] bg-white/80 border border-[#f0d88a] rounded-lg px-3 py-2 leading-relaxed">
                  ⚠ {plannerResult.partialNote}
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
                        <FormattedNumberInput
                          value={s.netContribution}
                          onChange={v => setScenarios(prev => prev.map(sc => sc.id === s.id ? { ...sc, netContribution: v } : sc))}
                          step={100}
                          className="text-xs font-semibold text-[#1a1a18] bg-transparent outline-none w-20 text-right border-b border-black/10 focus:border-[#1d4e3a] pb-px"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#8a8a84] whitespace-nowrap">Net gift aid / yr</span>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-xs font-medium text-[#1a1a18]">£</span>
                        <FormattedNumberInput
                          value={s.netGiftAid}
                          onChange={v => setScenarios(prev => prev.map(sc => sc.id === s.id ? { ...sc, netGiftAid: v } : sc))}
                          step={100}
                          className="text-xs font-semibold text-[#1a1a18] bg-transparent outline-none w-20 text-right border-b border-black/10 focus:border-[#1d4e3a] pb-px"
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
                        <FormattedNumberInput
                          value={carryForward[i].allowance}
                          onChange={v => setCarryForward(prev => prev.map((cf, j) => j === i ? { ...cf, allowance: v } : cf))}
                          step={1000}
                          className="w-24 text-right bg-transparent border-b border-black/10 focus:border-[#1d4e3a] outline-none font-semibold text-[#1a1a18] pb-px"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-baseline justify-end gap-0.5">
                        <span className="text-[#4a4a46]">£</span>
                        <FormattedNumberInput
                          value={carryForward[i].used}
                          onChange={v => setCarryForward(prev => prev.map((cf, j) => j === i ? { ...cf, used: v } : cf))}
                          step={1000}
                          className="w-24 text-right bg-transparent border-b border-black/10 focus:border-[#1d4e3a] outline-none font-semibold text-[#1a1a18] pb-px"
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
            {psaExempt > 0 && (
              <div className="flex items-center gap-2">
                <span className="inline-block w-5 h-3 rounded-sm" style={{background:'repeating-linear-gradient(45deg,#9b7fd4 0,#9b7fd4 1.5px,transparent 0,transparent 4px),#e4dcf5'}}/>
                <span>Savings allowance (tax-free)</span>
              </div>
            )}
            {dividendIncome > 0 && taxEngine.divBands.some(b => b.allowanceUsed > 0) && (
              <div className="flex items-center gap-2">
                <span className="inline-block w-5 h-3 rounded-sm" style={{background:'#e8c34a', opacity: 0.55}}/>
                <span>Dividend allowance (tax-free)</span>
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
            hasStudentLoan={hasStudentLoan}
            additionalRelief={totalAdditionalRelief}
            psaExempt={psaExempt}
            dividendIncome={dividendIncome}
            divBands={taxEngine.divBands}
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

        {/* Three detail cards — drops to 2 columns when Card 3 (Student Loan
            Impact) is hidden, so Cards 1–2 reflow instead of leaving a gap. */}
        {showDetails && (
          <div className={`grid gap-5 ${hasStudentLoan ? 'grid-cols-3' : 'grid-cols-2'}`}>

            {/* ── Card 1: Total Tax Liability ── */}
            <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[#1a1a18] mb-4">Total tax liability</h3>
              <p className="text-[11px] text-[#8a8a84] mb-4 leading-relaxed">
                Based on {salarySacrifice > 0 ? `adjusted earnings (${fmtD(adjustedEarnings)}, after salary sacrifice)` : 'total earnings'}
                {psaExempt > 0 ? `, less ${fmtD(psaExempt)} savings allowance,` : ''} before any pension or gift aid relief.
                {dividendIncome > 0 ? ' Dividends are taxed separately, on top of all other income.' : ''}
              </p>

              {/* Income Tax */}
              <div className="mb-4">
                <div className="text-[11px] uppercase tracking-wider text-[#8a8a84] mb-2">Income Tax</div>
                {psaExempt > 0 && (
                  <p className="text-[11px] text-[#4a7a5e] mb-2 leading-relaxed">
                    £{fmt(psaExempt)} of savings interest is tax-free under your Personal Savings Allowance (£{fmt(psaAmount)} available at your income level).
                  </p>
                )}
                {taxEngine.taperedPA < B0 && (
                  <p className="text-[11px] text-amber-700 mb-2 leading-relaxed">
                    Your personal allowance is reduced from {fmtD(B0)} to {fmtD(taxEngine.taperedPA)} because total income{dividendIncome > 0 ? ' (including dividends)' : ''} exceeds {fmtD(B2)}.
                  </p>
                )}
                {taxEngine.nonDivBands.filter(b => b.amount > 0).map(band => (
                  <div key={band.label} className="flex items-baseline justify-between py-1 gap-2">
                    <div>
                      <span className="text-xs text-[#4a4a46]">{band.label} ({band.rate}%)</span>
                      <span className="text-[10px] text-[#8a8a84] ml-1">{fmtD(band.amount)} taxable</span>
                    </div>
                    <span className="text-xs text-[#1a1a18] font-medium tabular-nums shrink-0">{fmtD(band.tax)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-black/8 mt-2">
                  <span className="text-xs font-semibold text-[#1a1a18]">Total income tax</span>
                  <span className="text-sm font-bold text-[#1a1a18] tabular-nums">{fmtD(grossIncomeTax)}</span>
                </div>
              </div>

              {/* Dividend Tax */}
              {dividendIncome > 0 && (
                <div className="mb-4">
                  <div className="text-[11px] uppercase tracking-wider text-[#8a8a84] mb-2">Dividend Tax</div>
                  {taxEngine.divBands.some(b => b.allowanceUsed > 0) && (
                    <p className="text-[11px] text-[#4a7a5e] mb-2 leading-relaxed">
                      £{fmt(taxEngine.divBands.reduce((sum, b) => sum + b.allowanceUsed, 0))} of dividends is tax-free under your dividend allowance (£{fmt(DIVIDEND_ALLOWANCE)}).
                    </p>
                  )}
                  {taxEngine.divBands.filter(b => b.rate > 0 && b.amount > 0).map(band => (
                    <div key={band.label} className="flex items-baseline justify-between py-1 gap-2">
                      <div>
                        <span className="text-xs text-[#4a4a46]">{band.label} ({band.rate}%)</span>
                        <span className="text-[10px] text-[#8a8a84] ml-1">{fmtD(band.taxable)} taxable</span>
                      </div>
                      <span className="text-xs text-[#1a1a18] font-medium tabular-nums shrink-0">{fmtD(band.tax)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-black/8 mt-2">
                    <span className="text-xs font-semibold text-[#1a1a18]">Total dividend tax</span>
                    <span className="text-sm font-bold text-[#1a1a18] tabular-nums">{fmtD(grossDividendTax)}</span>
                  </div>
                </div>
              )}

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
              {hasStudentLoan && (
                <div className="mb-4">
                  <div className="text-[11px] uppercase tracking-wider text-[#8a8a84] mb-2">Student Loan ({SL_PLAN})</div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-[#4a4a46]">{SL_R}% above {fmtD(SL_T)}</span>
                    <span className="text-xs text-[#1a1a18] font-medium tabular-nums">{fmtD(studentLoan)}</span>
                  </div>
                </div>
              )}

              {/* Grand total */}
              <div className="flex justify-between items-center pt-3 border-t-2 border-black/15">
                <span className="text-sm font-bold text-[#1a1a18]">Total tax liability</span>
                <span className="text-xl font-bold text-[#1a1a18] tabular-nums">{fmtD(totalTaxLiability)}</span>
              </div>
              <div className="text-[11px] text-[#8a8a84] mt-1 text-right">
                {pct((totalTaxLiability / totalIncome) * 100)} effective rate on total income
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
                      {/* PSA hatch — top slice of effective earnings */}
                      {psaExempt > 0 && (
                        <div className="absolute top-0 h-full"
                          style={{
                            left: toX(Math.max(0, effectiveEarnings - psaExempt)) + '%',
                            width: (toX(effectiveEarnings) - toX(Math.max(0, effectiveEarnings - psaExempt))) + '%',
                            background: `repeating-linear-gradient(45deg,#9b7fd4 0,#9b7fd4 1.5px,transparent 0,transparent 4px),#e4dcf5`,
                          }} />
                      )}
                    </div>
                    {/* X-axis labels — skip any threshold within 10% of the right edge */}
                    <div className="relative h-5 mt-1">
                      {[B0, B1, B2].filter(b => b < adjustedEarnings && toX(adjustedEarnings) - toX(b) > 18).map(b => (
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

              {/* Non-dividend + dividend relief, broken out separately so the
                  mechanism (which layer of the income stack actually moved
                  bands) is visible, not just the total. See lib/taxEngine.ts
                  for how atTop/atBottom are derived. */}
              {(grossContribution + grossGiftAid) > 0 && (() => {
                // pensionAdditionalRelief.atTop = computeTax at adjustedEarnings
                // (before any contribution); giftAidAdditionalRelief.atBottom =
                // computeTax at effectiveEarnings (after both pension AND gift
                // aid) — together these are the true combined before/after,
                // since pension and gift aid reductions are applied sequentially.
                const before = pensionAdditionalRelief.atTop;
                const after = giftAidAdditionalRelief.atBottom;
                const beforeTaxable = before.nonDivBands.reduce((s, b) => s + b.amount, 0);
                const afterTaxable = after.nonDivBands.reduce((s, b) => s + b.amount, 0);
                const divReliefTotal = pensionAdditionalRelief.divRelief + giftAidAdditionalRelief.divRelief;

                const bandRows = [
                  {
                    label: `Higher rate ${TR_B + TR_H}% (${TR_H}%)`,
                    amount: combinedBands.fromHigher,
                    relief: combinedBands.fromHigher * (TR_H / 100),
                  },
                  {
                    label: `Basic rate ${TR_B}% (0%)`,
                    amount: combinedBands.fromBasic,
                    relief: 0,
                  },
                  {
                    label: `PA taper ${TR_B + TR_60}% (${TR_60}%)`,
                    amount: combinedBands.from60,
                    relief: combinedBands.from60 * (TR_60 / 100),
                  },
                  {
                    label: `Additional ${TR_B + TR_A}% (${TR_A}%)`,
                    amount: combinedBands.fromAdditional,
                    relief: combinedBands.fromAdditional * (TR_A / 100),
                  },
                ].filter(r => r.amount > 0);

                const divColor = (label: string) =>
                  label === 'Ordinary dividend rate' ? '#8fbcdb'
                  : label === 'Upper dividend rate' ? '#4a86ad'
                  : label === 'Additional dividend rate' ? '#245a7d'
                  : '#e8e7e0';

                const miniDomain = Math.max(before.totalAllSources, 1);
                const px = (v: number) => Math.min(100, Math.max(0, (v / miniDomain) * 100));
                const miniBar = (result: typeof before, nonDivGross: number) => (
                  <div className="relative h-5 rounded overflow-hidden bg-[#f0efeb]">
                    <div className="absolute top-0 h-full bg-[#dcdcd6]" style={{ left: 0, width: px(nonDivGross) + '%' }} />
                    {result.divBands.filter(b => b.rate > 0 && b.amount > 0).map(b => (
                      <div key={b.label} className="absolute top-0 h-full"
                        style={{ left: px(b.from) + '%', width: (px(b.to) - px(b.from)) + '%', background: divColor(b.label) }} />
                    ))}
                  </div>
                );

                return (
                  <div className="space-y-5 mb-4">
                    {/* Non-dividend relief */}
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-[#8a8a84] mb-2">From salary &amp; other non-dividend income</div>
                      {bandRows.length === 0 ? (
                        <p className="text-[11px] text-[#8a8a84] leading-relaxed">
                          Taxable income stays within the same rate band both before and after this contribution
                          ({fmtD(beforeTaxable)} → {fmtD(afterTaxable)}) — no additional relief from this leg, only
                          the {TR_B}% already given at source.
                        </p>
                      ) : (
                        <>
                          <p className="text-[11px] text-[#8a8a84] mb-2">Taxable income: {fmtD(beforeTaxable)} → {fmtD(afterTaxable)}</p>
                          <div className="space-y-0">
                            {bandRows.map(row => (
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
                        </>
                      )}
                    </div>

                    {/* Dividend relief */}
                    {dividendIncome > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-[#8a8a84] mb-2">From dividends shifting tax bands</div>
                        <p className="text-[11px] text-[#8a8a84] mb-3 leading-relaxed">
                          Your contribution doesn't reduce your dividends directly — but since dividends are taxed
                          last, on top of everything else, it does lower where they sit.
                        </p>
                        <div className="mb-1 text-[10px] text-[#8a8a84]">Before</div>
                        {miniBar(before, adjustedEarnings)}
                        <div className="mt-2 mb-1 text-[10px] text-[#8a8a84]">After</div>
                        {miniBar(after, effectiveEarnings)}
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-xs text-[#4a4a46]">
                            <span>Dividend tax before</span>
                            <span className="tabular-nums">{fmtD(before.divTax)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-[#4a4a46]">
                            <span>Dividend tax after</span>
                            <span className="tabular-nums">{fmtD(after.divTax)}</span>
                          </div>
                          <div className="flex justify-between items-baseline pt-1 border-t border-black/5">
                            <span className="text-xs font-semibold text-[#1a1a18]">Dividend relief</span>
                            <span className={`text-xs font-semibold tabular-nums ${divReliefTotal > 0 ? 'text-[#1d4e3a]' : 'text-[#8a8a84]'}`}>
                              {divReliefTotal > 0 ? `+${fmtD(divReliefTotal)}` : '—'}
                            </span>
                          </div>
                        </div>
                        {divReliefTotal <= 0 && (
                          <p className="text-[11px] text-[#8a8a84] mt-2 leading-relaxed">
                            Your dividends stayed within the same rate band before and after this contribution —
                            no relief from this leg.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

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
                {psaExempt > 0 && (
                  <div className="flex justify-between text-xs text-[#4a4a46] pt-1">
                    <span>Savings allowance (tax-free)</span>
                    <span className="tabular-nums text-[#6b4fa0]">{fmtD(psaExempt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Card 3: Student Loan Impact — hidden entirely when the
                student loan toggle is off, not just zeroed out. ── */}
            {hasStudentLoan && (
            <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[#1a1a18] mb-1">Student loan impact</h3>
              <p className="text-[11px] text-[#8a8a84] mb-4 leading-relaxed">
                How your pension contribution and gift aid reduce your effective student loan burden.
              </p>

              {unearnedIncome > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] text-[#8a8a84] leading-relaxed">
                    {unearnedIncome > SL_UNEARNED_THRESHOLD
                      ? `Unearned income of ${fmtD(unearnedIncome)} is included in full (exceeds the ${fmtD(SL_UNEARNED_THRESHOLD)} unearned income threshold).`
                      : `Unearned income of ${fmtD(unearnedIncome)} is excluded (at or below the ${fmtD(SL_UNEARNED_THRESHOLD)} unearned income threshold).`}
                  </p>
                  {savingsInterest > 0 && (
                    <p className="text-[11px] text-[#8a8a84] leading-relaxed pl-3">· Savings interest: {fmtD(savingsInterest)}</p>
                  )}
                  {rentalProfit > 0 && (
                    <p className="text-[11px] text-[#8a8a84] leading-relaxed pl-3">· Rental profit: {fmtD(rentalProfit)}</p>
                  )}
                  {dividendIncome > 0 && (
                    <p className="text-[11px] text-[#8a8a84] leading-relaxed pl-3">· Dividend income: {fmtD(dividendIncome)}</p>
                  )}
                </div>
              )}

              <div className="space-y-3 mb-4">
                <FactRow label={`Threshold (${SL_PLAN})`} value={fmtD(SL_T)} />
                <FactRow label={salarySacrifice > 0 ? 'Adjusted earnings' : 'Total earnings'} value={fmtD(studentLoanIncome)} />
                <FactRow
                  label="Earnings above threshold"
                  value={fmtD(Math.max(0, studentLoanIncome - SL_T))}
                  dimmed={studentLoanIncome <= SL_T}
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

              {studentLoan > 0 && totalAdditionalRelief < studentLoan && studentLoanFullyOffsettable && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 leading-relaxed">
                  Increase net pension to {fmtD(recommendedNet)} (gross: {fmtD(recommendedGross)}) to generate {fmtD(studentLoan)} in additional relief — fully covering your student loan.
                </div>
              )}

              {studentLoan > 0 && !studentLoanFullyOffsettable && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 leading-relaxed">
                  ⚠ This can't be fully offset through pension contributions alone. The maximum additional relief achievable is {fmtD(maxRelief)} (at a {fmtD(recommendedNet)} net contribution, gross: {fmtD(recommendedGross)}), leaving {fmtD(studentLoan - maxRelief)} of your student loan uncovered.
                </div>
              )}

              {studentLoan === 0 && (
                <div className="text-xs text-[#8a8a84] text-center py-4">
                  No student loan repayment at current earnings.
                </div>
              )}
            </div>
            )}
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
              {dividendIncome > 0 && <TakeHomeRow label="Dividend income" value={dividendIncome} plus />}
              {salarySacrifice > 0 && <TakeHomeRow label="Salary sacrifice (pension)" value={salarySacrifice} minus />}
              <TakeHomeRow label="Income tax" value={grossIncomeTax} minus />
              {grossDividendTax > 0 && <TakeHomeRow label="Dividend tax" value={grossDividendTax} minus />}
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
                pct={(takeHomePay / totalIncome) * 100}
                color="bg-[#1a1a18]"
                textColor="text-white"
              />
              <BucketCard
                label="Pension pot (gross)"
                sublabel={salarySacrifice > 0 ? 'personal + salary sacrifice' : 'inc. 20% basic rate top-up from HMRC'}
                value={grossContribution + salarySacrifice}
                pct={((grossContribution + salarySacrifice) / Math.max(1, totalIncome)) * 100}
                color="bg-[#1d4e3a]"
                textColor="text-white"
              />
              {employerContribution > 0 && (
                <BucketCard
                  label="Employer pension"
                  sublabel="not from your earnings"
                  value={employerContribution}
                  pct={(employerContribution / Math.max(1, totalIncome)) * 100}
                  color="bg-[#2a6e50]"
                  textColor="text-white"
                />
              )}
              {grossGiftAid > 0 && (
                <BucketCard
                  label="Charity (gross)"
                  sublabel="inc. 20% gift aid top-up from HMRC"
                  value={grossGiftAid}
                  pct={(grossGiftAid / totalIncome) * 100}
                  color="bg-[#4a90a4]"
                  textColor="text-white"
                />
              )}
              <BucketCard
                label="Tax & NI"
                sublabel="income tax + dividend tax (net of relief) + NI"
                value={grossIncomeTax + grossDividendTax - totalAdditionalRelief + totalNI}
                pct={((grossIncomeTax + grossDividendTax - totalAdditionalRelief + totalNI) / totalIncome) * 100}
                color="bg-[#f0efeb]"
                textColor="text-[#1a1a18]"
              />
              <BucketCard
                label={`Student loan (${SL_PLAN})`}
                value={studentLoan}
                pct={(studentLoan / totalIncome) * 100}
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
