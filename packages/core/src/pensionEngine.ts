import type { TaxConfig } from './taxConfig.js';
import { computeTax, calculateAdditionalRelief } from './taxEngine.js';
import { fmt, fmtD } from './format.js';

// Pension contribution calculations, moved out of the web results page
// (App.tsx) unchanged so the web and mobile apps share one implementation.

export interface CarryForwardYear {
  allowance: number;
  used: number;
}

export interface Scenario {
  id: number;
  name: string;
  netContribution: number;
  netGiftAid: number;
}

export type GoalMode = 'take-home' | 'student-loan' | 'max-pension' | 'tax-band' | 'savings-allowance';

export interface PensionInputs {
  employedEarnings: number;
  selfEmployedEarnings: number;
  netContribution: number;
  netGiftAid: number;
  savingsInterest: number;
  rentalProfit: number;
  dividendIncome: number;
  hasStudentLoan: boolean;
  employerContribution: number;
  salarySacrifice: number;
  carryForward: CarryForwardYear[];
}

export interface PlannerGoal {
  goalMode: GoalMode;
  goalTargetMonthly: number;
  goalFloorMonthly: number;
  goalTaxBandIdx: number;
  goalPsaIdx: number;
}

export function calculatePension(inputs: PensionInputs, config: TaxConfig) {
  const {
    employedEarnings, selfEmployedEarnings, netContribution, netGiftAid, savingsInterest,
    rentalProfit, dividendIncome, hasStudentLoan, employerContribution, salarySacrifice, carryForward,
  } = inputs;
  const { B0, B1, B2, B3, TR_B, TR_H, SL_T, SL_R, SL_UNEARNED_THRESHOLD, TAX_YEAR, SL_PLAN,
          NI_L, NI_U, C1_Main, C1_Upper, C4_Main, C4_Upper,
          STANDARD_AA, TAPER_THRESHOLD, TAPER_ADJUSTED, TAPER_MIN_AA,
          PSA_BASIC, PSA_HIGHER } = config;

  // ─── Core derived values ──────────────────────────────────────────────────
  // Dividends are deliberately NOT folded into totalEarnings/adjustedEarnings/
  // effectiveEarnings — they sit in their own stream throughout, since they
  // occupy the top of the UK stacking order (non-savings → savings →
  // dividends) and are taxed via a separate rate table (see taxEngine.ts).
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
  // plain nominal band rate. See taxEngine.ts for the full derivation.
  const taxEngine = computeTax(config, Math.max(0, adjustedEarnings - psaExempt), dividendIncome);
  const grossIncomeTax = taxEngine.nonDivTax;
  const grossDividendTax = taxEngine.divTax;

  // ─── Additional relief: how much a gross contribution from `base` income gives back ──
  // Delegates to taxEngine.ts's diff-of-computeTax implementation, which
  // (unlike the old hand-derived band arithmetic) automatically captures both
  // the personal-allowance-restoration effect and any dividend-band-shift
  // effect a contribution causes — deliberately NOT netted for psaExempt here,
  // consistent with the pre-existing behaviour of this calculation.
  const pensionAdditionalRelief = calculateAdditionalRelief(config, adjustedEarnings, grossContribution, dividendIncome);
  const giftAidAdditionalRelief = calculateAdditionalRelief(config, adjustedEarnings - grossContribution, grossGiftAid, dividendIncome);
  const totalAdditionalRelief = pensionAdditionalRelief.total + giftAidAdditionalRelief.total;

  // ─── Contribution band breakdown (for Card 2) ─────────────────────────────
  // Positional band-crossing test — an approximation, not the exact
  // taper-aware engine used for the headline figures (see taxEngine.ts).
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
  // calculateAdditionalRelief's nonDivRelief plateaus (see taxEngine.ts).
  // When the student loan repayment exceeds this ceiling, no contribution
  // can fully offset it — the search target is clamped to the ceiling so
  // the (now monotonic-then-flat) binary search still converges to the
  // *smallest* contribution that reaches the maximum achievable relief,
  // rather than running off to the search boundary.
  const maxRelief = (() => {
    const pr = calculateAdditionalRelief(config, adjustedEarnings, adjustedEarnings, dividendIncome);
    const gr = calculateAdditionalRelief(config, 0, grossGiftAid, dividendIncome);
    return pr.total + gr.total;
  })();

  const studentLoanFullyOffsettable = studentLoan === 0 || maxRelief >= studentLoan;

  const recommendedNet = (() => {
    // NOTE: this used to early-return when adjustedEarnings <= B1, on the
    // (pre-dividend) assumption that salary under the higher-rate threshold
    // could never generate additional relief. With dividends, that's no
    // longer true — a contribution can still shift dividends into a lower
    // rate band and generate real relief even when salary alone never
    // leaves the basic-rate band (see taxEngine.ts's divRelief). Using
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
  })();

  const recommendedGross = recommendedNet / (1 - trb);

  // ─── No-contribution baseline (for comparison) ────────────────────────────
  // grossIncomeTax/grossDividendTax are already contribution-independent
  // (PAYE-basis — personal pension/gift aid contributions never reduce the
  // taxable base fed into computeTax above), so they can be reused directly.
  const noContribTakeHome = adjustedEarnings + dividendIncome
    - grossIncomeTax - grossDividendTax - class1NI - class4NI - studentLoan;
  const withContribTotal  = takeHomePay + grossContribution + salarySacrifice + employerContribution + grossGiftAid;
  const noContribTotal    = noContribTakeHome;
  const totalRelief       = withContribTotal - noContribTotal;

  // ─── Insight banner text ─────────────────────────────────────────────────
  const insightText = (() => {
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
  })();

  return {
    // Echoed so the solvers below can work from a single result object.
    inputs, config,
    totalEarnings, totalIncome, unearnedIncome, adjustedEarnings, trb,
    grossContribution, grossGiftAid, effectiveEarnings, psaAmount, psaExempt,
    taxEngine, grossIncomeTax, grossDividendTax,
    pensionAdditionalRelief, giftAidAdditionalRelief, totalAdditionalRelief,
    pensionBands, giftAidBands, combinedBands,
    studentLoanIncome, studentLoan,
    class1NI, class4NI, totalNI,
    takeHomePay, totalTaxLiability,
    thresholdIncome, adjustedIncomeForTaper, taperedAA, cfAvailable, totalCarryForward, totalPool, totalPensionInput,
    priorYearLabels,
    maxRelief, studentLoanFullyOffsettable, recommendedNet, recommendedGross,
    noContribTakeHome, withContribTotal, noContribTotal, totalRelief,
    insightText,
  };
}

export type PensionResult = ReturnType<typeof calculatePension>;

export interface PlannerOption {
  label: string;
  nc: number;
  gc: number;
}

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
export function solvePensionGoal(pension: PensionResult, goal: PlannerGoal) {
  const { config, inputs, adjustedEarnings, trb, grossGiftAid, grossIncomeTax, grossDividendTax,
          class1NI, class4NI, studentLoan, totalPool, recommendedNet, maxRelief, studentLoanFullyOffsettable } = pension;
  const { dividendIncome, netGiftAid, salarySacrifice, employerContribution } = inputs;
  const { goalMode, goalTargetMonthly, goalFloorMonthly, goalTaxBandIdx, goalPsaIdx } = goal;
  const { B1, B2, B3, PSA_BASIC, PSA_HIGHER } = config;

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
      taxBandOptions: [] as PlannerOption[],
      psaOptions: [] as PlannerOption[],
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
    const options: PlannerOption[] = [];
    // Personal allowance taper is driven by TOTAL income across all
    // sources (including dividends), not just non-dividend earnings — see
    // taxEngine.ts. A pension contribution only reduces the
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
    const options: PlannerOption[] = [];
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
}

export type PlannerResult = ReturnType<typeof solvePensionGoal>;

// ─── Scenario comparison solver ───────────────────────────────────────────
// Scenarios only vary netContribution/netGiftAid per card — savingsInterest
// and rentalProfit (like all other earnings inputs) are shared globally
// across every scenario. Extension point: per-scenario unearned-income
// fields would need the same treatment as netContribution/netGiftAid below
// if "what-if" modeling of those is wanted later.
export function compareScenarios(pension: PensionResult, scenarios: Scenario[]) {
  const { config, inputs, adjustedEarnings, trb, grossIncomeTax, grossDividendTax, class1NI, class4NI, studentLoan } = pension;
  const { dividendIncome } = inputs;
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
}

export type ScenarioResult = ReturnType<typeof compareScenarios>[number];
