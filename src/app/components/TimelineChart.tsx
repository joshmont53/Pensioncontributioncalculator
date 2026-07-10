import { useEffect, useRef, useState } from 'react';
import { TaxConfig } from '../hooks/useTaxConfig';
import { DividendBand } from '../lib/taxEngine';

interface TimelineChartProps {
  earnings: number;
  salarySacrifice: number;
  grossContribution: number;
  grossGiftAid: number;
  effectiveEarnings: number;
  studentLoan: number;
  additionalRelief: number;
  psaExempt: number;
  dividendIncome: number;
  divBands: DividendBand[];
  config: TaxConfig;
}

export function TimelineChart({
  earnings,
  salarySacrifice,
  grossContribution,
  grossGiftAid,
  effectiveEarnings,
  studentLoan,
  additionalRelief,
  psaExempt,
  dividendIncome,
  divBands,
  config,
}: TimelineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: string;
    visible: boolean;
  }>({ x: 0, y: 0, content: '', visible: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { B0, B1, B2, B3, TR_B, TR_H, TR_60, TR_A, SL_T, SL_PLAN } = config;

    const DPR = window.devicePixelRatio || 1;
    const W_CSS = canvas.parentElement?.clientWidth || 800;
    const H_CSS = 290;
    canvas.style.width = W_CSS + 'px';
    canvas.style.height = H_CSS + 'px';
    canvas.width = W_CSS * DPR;
    canvas.height = H_CSS * DPR;
    ctx.scale(DPR, DPR);
    const W = W_CSS;
    const H = H_CSS;

    const PAD_L = 20;
    const PAD_R = 20;
    const BAR_Y = 108;
    const BAR_H = 22;
    const BAR_BOTTOM = BAR_Y + BAR_H / 2;          // 119
    const LABEL_ABOVE = BAR_Y - BAR_H / 2 - 28;   // for band labels
    // Below-bar spacing constants — content stacks sequentially, no fixed LABEL_BELOW
    const ARROW_START = BAR_BOTTOM + 22;            // first arrow y
    const ARROW_STEP  = 22;                         // between arrow rows
    const EFF_GAP     = 22;                         // gap: last arrow → eff label
    const SL_GAP      = 16;                         // gap: eff label (or last arrow) → SL text
    const TRACK_W = W - PAD_L - PAD_R;

    const domainMax = Math.max(earnings + dividendIncome, 30000);
    const px = (val: number) => PAD_L + Math.max(0, Math.min(1, val / domainMax)) * TRACK_W;

    ctx.clearRect(0, 0, W, H);

    const COLS = {
      nil:    '#e8e7e0',
      basic:  '#b8d4c8',
      higher: '#6aaa8e',
      sixty:  '#e8a87c',
      addl:   '#c0392b',
      sl:     '#2980b9',
      earn:   '#1d4e3a',
      eff:    '#2a6e52',
      pension:'#e8a87c',
      gift:   '#4a90a4',
      psa:    '#9b7fd4',
      divOrdinary: '#8fbcdb',
      divUpper:    '#4a86ad',
      divAddl:     '#245a7d',
      divAllowance: '#e8c34a',
      divEarn:     '#245a7d',
      text:   '#4a4a46',
      textlt: '#8a8a84',
    };

    // ── Band fills — clipped to `earnings`, NOT domainMax, so the non-
    // dividend bands never bleed into the dividend region drawn separately
    // below (dividends stack past `earnings`, on their own rate table). ───
    const allBands = [
      { from: 0,  to: B0, col: COLS.nil,    pct: '0%',  name: 'Nil rate' },
      { from: B0, to: B1, col: COLS.basic,  pct: '20%', name: 'Basic rate' },
      { from: B1, to: B2, col: COLS.higher, pct: '40%', name: 'Higher rate' },
      { from: B2, to: B3, col: COLS.sixty,  pct: '60%', name: 'H/R + PA taper' },
      { from: B3, to: Infinity, col: COLS.addl, pct: '45%', name: 'Additional rate' },
    ];

    const bands = allBands
      .map(b => ({ ...b, from: Math.max(b.from, 0), to: Math.min(b.to, earnings) }))
      .filter(b => b.to > b.from && b.from < earnings);

    bands.forEach(b => {
      const x1 = px(b.from);
      const x2 = px(b.to);
      if (x2 <= x1) return;
      const midX = (x1 + x2) / 2;
      const bw = x2 - x1;

      ctx.fillStyle = b.col;
      ctx.fillRect(x1, BAR_Y - BAR_H / 2, x2 - x1, BAR_H);

      if (bw > 35) {
        const textCol = b.col === COLS.nil ? COLS.textlt : COLS.text;
        ctx.fillStyle = textCol;
        ctx.font = `600 12px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(b.pct, midX, LABEL_ABOVE + 8);

        if (bw > 60) {
          ctx.font = `400 10px -apple-system, system-ui, sans-serif`;
          ctx.fillStyle = textCol;
          const lines = b.name.split('\n');
          const barTop = BAR_Y - BAR_H / 2;
          lines.forEach((line, i) => {
            const lineY = LABEL_ABOVE + 22 + i * 12;
            if (lineY < barTop - 1) ctx.fillText(line, midX, lineY);
          });
        }
      }
    });

    // ── Band boundary ticks ───────────────────────────────────────────────
    const allThresholds = [
      { val: 0,  label: '£0',                           align: 'left'   as const },
      { val: B0, label: `£${B0.toLocaleString('en-GB')}`, align: 'center' as const },
      { val: B1, label: `£${B1.toLocaleString('en-GB')}`, align: 'center' as const },
      { val: B2, label: `£${B2.toLocaleString('en-GB')}`, align: 'center' as const },
      { val: B3, label: `£${B3.toLocaleString('en-GB')}`, align: 'center' as const },
    ];

    // Clipped to `earnings`, not domainMax — these mark non-dividend band
    // transitions specifically; beyond `earnings` the dividend region uses
    // its own (shifted) coordinate space, so a raw B2/B3 tick landing in
    // that region wouldn't correspond to an actual dividend rate change.
    const thresholds = allThresholds.filter(t => t.val <= earnings);
    const MIN_LABEL_SPACING = 55;
    const earningsX = px(earnings);
    const visibleThresholds: typeof thresholds = [];
    let lastX = -Infinity;

    thresholds.forEach(t => {
      const x = px(t.val);
      const tooCloseToEarnings = t.val !== 0 && Math.abs(x - earningsX) < MIN_LABEL_SPACING;
      if ((x - lastX >= MIN_LABEL_SPACING || t.val === 0) && !tooCloseToEarnings) {
        visibleThresholds.push(t);
        lastX = x;
      }
    });

    visibleThresholds.forEach(t => {
      const x = px(t.val);
      ctx.strokeStyle = COLS.text;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, BAR_Y - BAR_H / 2 - 4);
      ctx.lineTo(x, BAR_Y + BAR_H / 2 + 4);
      ctx.stroke();

      ctx.fillStyle = COLS.text;
      ctx.font = `300 11px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = t.align;
      ctx.fillText(t.label, x, BAR_Y - BAR_H / 2 - 56);
    });

    // ── Pre-compute overlay flags (used for below-bar layout) ─────────────
    const _adjustedEarnings = Math.max(0, earnings - salarySacrifice);
    const _hasSS       = salarySacrifice > 0;
    const _hasPension  = grossContribution > 0 && effectiveEarnings < _adjustedEarnings;
    const _hasGiftAid  = grossGiftAid > 0;
    const _hasPSA      = psaExempt > 0;
    const _xPen        = px(Math.max(0, _adjustedEarnings - grossContribution));
    const _xEff        = px(effectiveEarnings);
    const _hasGAArrow  = _hasGiftAid && _xPen > _xEff;
    const _arrowCount  = (_hasSS ? 1 : 0) + (_hasPension ? 1 : 0) + (_hasGAArrow ? 1 : 0) + (_hasPSA ? 1 : 0);
    // Compute the y-position where below-bar content ends (used for SL text)
    const _lastArrowY  = _arrowCount > 0 ? ARROW_START + (_arrowCount - 1) * ARROW_STEP : BAR_BOTTOM;
    const _hasEffLabel = _hasPension || _hasGiftAid || _hasPSA;
    const _afterArrows = _arrowCount > 0 ? _lastArrowY + EFF_GAP : BAR_BOTTOM + EFF_GAP;
    const _slTextY     = _hasEffLabel ? _afterArrows + 40 + SL_GAP : _afterArrows;

    // ── Student loan threshold tick (text drawn after overlays) ───────────
    if (SL_T > 0 && SL_T < domainMax) {
      const x = px(SL_T);
      ctx.strokeStyle = COLS.sl;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, BAR_Y - BAR_H / 2);
      ctx.lineTo(x, BAR_Y + BAR_H / 2 + 10);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Total earnings marker ─────────────────────────────────────────────
    if (earnings > 0) {
      const x = px(earnings);

      ctx.strokeStyle = COLS.earn;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, BAR_Y - BAR_H / 2 - 6);
      ctx.lineTo(x, BAR_Y + BAR_H / 2 + 6);
      ctx.stroke();

      ctx.fillStyle = COLS.earn;
      ctx.beginPath();
      ctx.moveTo(x, BAR_Y - 6);
      ctx.lineTo(x + 6, BAR_Y);
      ctx.lineTo(x, BAR_Y + 6);
      ctx.lineTo(x - 6, BAR_Y);
      ctx.closePath();
      ctx.fill();

      // Placed clearly above the band-threshold tick label row (drawn at
      // BAR_Y - BAR_H/2 - 56) so the two never overlap, even when total
      // earnings sits close to a band boundary (e.g. just above B3).
      const lx = Math.max(PAD_L + 40, Math.min(W - PAD_R - 10, x));
      ctx.fillStyle = COLS.earn;
      ctx.font = `600 12px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`£${earnings.toLocaleString('en-GB')}`, lx, BAR_Y - BAR_H / 2 - 83);
      ctx.font = `300 10px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = COLS.textlt;
      ctx.fillText('Total earnings', lx, BAR_Y - BAR_H / 2 - 70);
    }

    // ── Dividend bands — stack past `earnings`, own rate table ─────────────
    // divBands' from/to are positioned relative to nonDivGross (adjusted
    // earnings net of salary sacrifice AND psaExempt), not `earnings` itself.
    // Shift by a constant offset so the dividend region starts exactly at
    // the "Total earnings" marker — a pure display transform, computed from
    // props already passed down, never touching the actual amount/tax
    // values used for labels (avoids re-deriving tax math in the chart).
    const nonDivGrossForChart = Math.max(0, Math.max(0, earnings - salarySacrifice) - psaExempt);
    const divOffset = earnings - nonDivGrossForChart;

    // Single-line names — the layout budgets room for exactly one line of
    // name text below the pct (see LABEL_ABOVE/barTop geometry above), same
    // as the existing nil/basic/higher/additional bands.
    const divLabelFor = (label: string, rate: number): { pct: string; name: string; col: string } => {
      switch (label) {
        case 'Unused personal allowance': return { pct: '0%', name: 'Unused Allowance', col: COLS.nil };
        case 'Ordinary dividend rate':    return { pct: `${rate}%`, name: 'Basic Dividend Rate', col: COLS.divOrdinary };
        case 'Upper dividend rate':       return { pct: `${rate}%`, name: 'Higher Dividend Rate', col: COLS.divUpper };
        default:                          return { pct: `${rate}%`, name: 'Additional Dividend Rate', col: COLS.divAddl };
      }
    };

    if (dividendIncome > 0) {
      divBands.forEach(band => {
        const x1 = px(band.from + divOffset);
        const x2 = px(band.to + divOffset);
        if (x2 <= x1) return;
        const midX = (x1 + x2) / 2;
        const bw = x2 - x1;
        const { pct, name, col } = divLabelFor(band.label, band.rate);

        ctx.fillStyle = col;
        ctx.fillRect(x1, BAR_Y - BAR_H / 2, x2 - x1, BAR_H);

        if (bw > 35) {
          const textCol = band.rate === 0 ? COLS.textlt : COLS.text;
          ctx.fillStyle = textCol;
          ctx.font = `600 12px -apple-system, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(pct, midX, LABEL_ABOVE + 8);

          if (bw > 60) {
            ctx.font = `400 10px -apple-system, system-ui, sans-serif`;
            ctx.fillStyle = textCol;
            const lines = name.split('\n');
            const barTop = BAR_Y - BAR_H / 2;
            lines.forEach((line, i) => {
              const lineY = LABEL_ABOVE + 22 + i * 12;
              if (lineY < barTop - 1) ctx.fillText(line, midX, lineY);
            });
          }
        }

        // Dividend allowance hatch — the allowance-covered sub-slice at the
        // start of this band, same visual language as the PSA hatch below.
        if (band.allowanceUsed > 0) {
          const ax1 = px(band.from + divOffset);
          const ax2 = px(band.from + band.allowanceUsed + divOffset);
          if (ax2 > ax1) {
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = COLS.divAllowance;
            ctx.fillRect(ax1, BAR_Y - BAR_H / 2, ax2 - ax1, BAR_H);
            ctx.restore();
          }
        }
      });

      // Divider between the non-dividend and dividend regions.
      const xDivStart = px(earnings);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xDivStart, BAR_Y - BAR_H / 2);
      ctx.lineTo(xDivStart, BAR_Y + BAR_H / 2);
      ctx.stroke();

      // Total dividends marker — same visual language as the total earnings
      // marker, at earnings + dividendIncome.
      const xDiv = px(earnings + dividendIncome);
      ctx.strokeStyle = COLS.divEarn;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(xDiv, BAR_Y - BAR_H / 2 - 6);
      ctx.lineTo(xDiv, BAR_Y + BAR_H / 2 + 6);
      ctx.stroke();

      ctx.fillStyle = COLS.divEarn;
      ctx.beginPath();
      ctx.moveTo(xDiv, BAR_Y - 6);
      ctx.lineTo(xDiv + 6, BAR_Y);
      ctx.lineTo(xDiv, BAR_Y + 6);
      ctx.lineTo(xDiv - 6, BAR_Y);
      ctx.closePath();
      ctx.fill();

      const dlx = Math.max(PAD_L + 40, Math.min(W - PAD_R - 10, xDiv));
      ctx.fillStyle = COLS.divEarn;
      ctx.font = `600 12px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`£${Math.round(earnings + dividendIncome).toLocaleString('en-GB')}`, dlx, BAR_Y - BAR_H / 2 - 83);
      ctx.font = `300 10px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = COLS.textlt;
      ctx.fillText('Total dividends', dlx, BAR_Y - BAR_H / 2 - 70);
    }

    // ── Contribution overlays (salary sacrifice + pension + gift aid) ─────
    const hasSS       = salarySacrifice > 0;
    const adjustedEarnings = Math.max(0, earnings - salarySacrifice);
    const hasPension  = grossContribution > 0 && effectiveEarnings < adjustedEarnings;
    const hasGiftAid  = grossGiftAid > 0;
    const hasPSA      = psaExempt > 0;

    // xAdj = after salary sacrifice (= adjusted earnings, tax base)
    // xPen = after pension only (relative to adjustedEarnings)
    // xEff = combined effective (after pension + gift aid)
    const xAdj  = px(adjustedEarnings);
    const xEff  = px(effectiveEarnings);
    const xPen  = px(Math.max(0, adjustedEarnings - grossContribution));
    const xTot  = px(earnings);
    // PSA overlay is a UI convenience showing the tax-free slice as the top
    // of effective earnings (per design spec) — NOT a literal mapping of
    // where calculateIncomeTax actually subtracts psaExempt (which is from
    // adjustedEarnings, further right). Do not "fix" into mechanical alignment.
    const xPSA1 = px(Math.max(0, effectiveEarnings - psaExempt));
    const xPSA2 = xEff;

    const drawHatch = (x1: number, x2: number, baseColor: string, hatchColor: string) => {
      if (x2 <= x1) return;
      ctx.save();
      ctx.globalAlpha = 0.30;
      ctx.fillStyle = baseColor;
      ctx.fillRect(x1, BAR_Y - BAR_H / 2, x2 - x1, BAR_H);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = hatchColor;
      ctx.lineWidth = 1.5;
      const spacing = 5;
      ctx.beginPath();
      for (let sx = x1 - BAR_H; sx < x2 + BAR_H; sx += spacing) {
        const ly1 = BAR_Y - BAR_H / 2;
        const ly2 = BAR_Y + BAR_H / 2;
        // clip to region
        const ax = Math.max(x1, sx);
        const bx = Math.min(x2, sx + BAR_H);
        if (ax < bx) {
          ctx.moveTo(ax, ly1 + (ax - sx));
          ctx.lineTo(bx, ly1 + (bx - sx));
        }
      }
      ctx.stroke();
      ctx.restore();
    };

    const drawArrow = (
      x1: number, x2: number, yLine: number,
      label: string, color: string
    ) => {
      if (x2 <= x1 + 4) return;
      const HEAD = 5;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(x1 + HEAD, yLine);
      ctx.lineTo(x2 - HEAD, yLine);
      ctx.stroke();

      // Left arrowhead
      ctx.beginPath();
      ctx.moveTo(x1, yLine);
      ctx.lineTo(x1 + HEAD, yLine - HEAD / 2);
      ctx.lineTo(x1 + HEAD, yLine + HEAD / 2);
      ctx.closePath();
      ctx.fill();

      // Right arrowhead
      ctx.beginPath();
      ctx.moveTo(x2, yLine);
      ctx.lineTo(x2 - HEAD, yLine - HEAD / 2);
      ctx.lineTo(x2 - HEAD, yLine + HEAD / 2);
      ctx.closePath();
      ctx.fill();

      const mid = (x1 + x2) / 2;
      ctx.fillStyle = color;
      ctx.font = `500 10.5px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      // Clamp label position so it stays within canvas bounds even when the
      // overlay sits right at the edge (e.g. PSA with no pension/gift-aid to
      // push effective earnings left of the total-earnings edge).
      const halfTextW = ctx.measureText(label).width / 2;
      const labelX = Math.max(PAD_L + halfTextW, Math.min(W - PAD_R - halfTextW, mid));
      ctx.fillText(label, labelX, yLine - 6);
    };

    const hasAnyOverlay = hasSS || hasPension || hasGiftAid || hasPSA;

    if (hasAnyOverlay) {
      // Draw SS hatch (rightmost: xAdj → xTot)
      if (hasSS) {
        drawHatch(xAdj, xTot, '#c8d8d0', '#4a7a6a');
      }

      // Draw pension hatch (xPen → xAdj, or xPen → xTot when no SS)
      const xPenRight = hasSS ? xAdj : xTot;
      if (hasPension) {
        drawHatch(xPen, xPenRight, '#f5ddc8', '#e8a87c');
      }

      // Draw gift aid hatch (xEff → xPen)
      if (hasGiftAid && xPen > xEff) {
        drawHatch(xEff, xPen, '#c2dce6', '#4a90a4');
      }

      // Draw PSA hatch (xPSA1 → xPSA2 = xEff) — top slice of effective earnings
      if (hasPSA) {
        drawHatch(xPSA1, xPSA2, '#e4dcf5', COLS.psa);
      }

      // Adjusted earnings dashed line (when SS > 0)
      if (hasSS && xAdj > PAD_L) {
        ctx.strokeStyle = '#4a7a6a';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(xAdj, BAR_Y - BAR_H / 2 - 6);
        ctx.lineTo(xAdj, BAR_Y + BAR_H / 2 + 6);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Effective earnings dashed line + diamond (when pension, gift aid, or PSA)
      if (hasPension || hasGiftAid || hasPSA) {
        ctx.strokeStyle = COLS.eff;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(xEff, BAR_Y - BAR_H / 2 - 6);
        ctx.lineTo(xEff, BAR_Y + BAR_H / 2 + 6);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COLS.eff;
        ctx.beginPath();
        ctx.moveTo(xEff, BAR_Y - 5);
        ctx.lineTo(xEff + 5, BAR_Y);
        ctx.lineTo(xEff, BAR_Y + 5);
        ctx.lineTo(xEff - 5, BAR_Y);
        ctx.closePath();
        ctx.fill();
      }

      // ── Arrows — sequential rows using ARROW_START + ARROW_STEP ──────────
      const hasGAArrow = hasGiftAid && xPen > xEff;
      const arrowCount = (hasSS ? 1 : 0) + (hasPension ? 1 : 0) + (hasGAArrow ? 1 : 0) + (hasPSA ? 1 : 0);
      let arrowRow = 0;

      if (hasSS) {
        const ssLabel = `£${Math.round(salarySacrifice).toLocaleString('en-GB')} salary sacrifice`;
        drawArrow(xAdj, xTot, ARROW_START + arrowRow * ARROW_STEP, ssLabel, '#4a7a6a');
        arrowRow++;
      }
      if (hasPension) {
        const pensionLabel = `£${Math.round(grossContribution).toLocaleString('en-GB')} pension (gross)`;
        drawArrow(xPen, xPenRight, ARROW_START + arrowRow * ARROW_STEP, pensionLabel, COLS.pension);
        arrowRow++;
      }
      if (hasGAArrow) {
        const gaLabel = `£${Math.round(grossGiftAid).toLocaleString('en-GB')} gift aid (gross)`;
        drawArrow(xEff, xPen, ARROW_START + arrowRow * ARROW_STEP, gaLabel, COLS.gift);
        arrowRow++;
      }
      if (hasPSA) {
        const psaLabel = `£${Math.round(psaExempt).toLocaleString('en-GB')} savings allowance`;
        drawArrow(xPSA1, xPSA2, ARROW_START + arrowRow * ARROW_STEP, psaLabel, COLS.psa);
        arrowRow++;
      }

      // ── Effective earnings label — always below all arrows ────────────────
      if (hasPension || hasGiftAid || hasPSA) {
        const lastArrowY = ARROW_START + (arrowCount - 1) * ARROW_STEP;
        const effLabelY  = lastArrowY + EFF_GAP;
        const effLx = Math.max(PAD_L + 50, Math.min(W - PAD_R - 50, xEff));
        ctx.fillStyle = COLS.eff;
        ctx.font = `600 11px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`£${Math.round(effectiveEarnings).toLocaleString('en-GB')}`, effLx, effLabelY);
        ctx.font = `300 10px -apple-system, system-ui, sans-serif`;
        ctx.fillStyle = COLS.textlt;
        ctx.fillText('Effective earnings', effLx, effLabelY + 13);
        const effSubLabel = hasSS ? '(after sacrifice, pension & gift aid)' : '(after pension & gift aid)';
        ctx.fillText(effSubLabel, effLx, effLabelY + 25);
      }
    }

    // ── Student loan text — always below all overlay content ──────────────
    if (SL_T > 0 && SL_T < domainMax) {
      const x = px(SL_T);
      ctx.fillStyle = COLS.sl;
      ctx.font = `300 11px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`£${SL_T.toLocaleString('en-GB')}`, x, _slTextY);
      ctx.font = `500 10px -apple-system, system-ui, sans-serif`;
      ctx.fillText(`${SL_PLAN} threshold`, x, _slTextY + 13);
    }

    // ── Mouse tooltip ─────────────────────────────────────────────────────
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const barTop    = BAR_Y - BAR_H / 2;
      const barBottom = BAR_Y + BAR_H / 2;

      if (y >= barTop && y <= barBottom && x >= PAD_L && x <= W - PAD_R) {
        const v = ((x - PAD_L) / TRACK_W) * domainMax;
        let content = '';
        if (v > earnings && dividendIncome > 0) {
          const vRelative = v - divOffset;
          const band = divBands.find(b => vRelative >= b.from && vRelative < b.to);
          if (band) {
            content = band.rate === 0
              ? '0% — unused personal allowance\nApplies to dividends before any dividend rate'
              : band.allowanceUsed > 0
                ? `${band.rate}% dividend rate\nIncludes £${Math.round(band.allowanceUsed).toLocaleString('en-GB')} covered by your dividend allowance`
                : `${band.rate}% dividend rate\nNo relief at source — full liability due via self-assessment`;
          }
        } else if (v <= B0) {
          content = '0% nil rate\nNo income tax in this band';
        } else if (v <= B1) {
          content = `20% basic rate\n${TR_B}% relief added at source`;
        } else if (v <= B2) {
          content = `40% higher rate\n${TR_B}% at source + ${TR_H}% via tax return\n= ${TR_B + TR_H}% total relief`;
        } else if (v <= B3) {
          content = `60% effective rate (PA taper)\n${TR_B}% at source + ${TR_60}% via tax return\n= ${TR_B + TR_60}% total relief`;
        } else {
          content = `45% additional rate\n${TR_B}% at source + ${TR_A}% via tax return\n= ${TR_B + TR_A}% total relief`;
        }

        if (content) {
          setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10, content, visible: true });
        } else {
          setTooltip(prev => ({ ...prev, visible: false }));
        }
      } else {
        setTooltip(prev => ({ ...prev, visible: false }));
      }
    };

    const handleMouseLeave = () => setTooltip(prev => ({ ...prev, visible: false }));

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [earnings, salarySacrifice, grossContribution, grossGiftAid, effectiveEarnings, studentLoan, additionalRelief, psaExempt, dividendIncome, divBands, config]);

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas ref={canvasRef} className="w-full cursor-pointer" />
      {tooltip.visible && (
        <div
          className="absolute z-10 bg-[#1a1a18] text-white text-xs rounded-lg px-3 py-2 pointer-events-none shadow-lg whitespace-pre-line leading-relaxed"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px`, transform: 'translate(-50%, -100%)' }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
