/* ═══════════════════════════════════════════════════════════════
   PENSION / STUDENT LOAN OFFSET CALCULATOR
   calc.js — all maths, results rendering, and timeline chart
   ═══════════════════════════════════════════════════════════════ */

// ─── Helpers ────────────────────────────────────────────────────
function v(id)      { return parseFloat(document.getElementById(id).value) || 0; }
function fmt(n)     { return '£' + Math.round(n).toLocaleString('en-GB'); }
function fmtD(n)    { return '£' + n.toLocaleString('en-GB', {minimumFractionDigits:2,maximumFractionDigits:2}); }
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }

// ─── Toggle advanced panel ───────────────────────────────────────
function toggleAdv() {
  const panel = document.getElementById('advPanel');
  const btn   = document.getElementById('advToggle');
  const open  = panel.hidden;
  panel.hidden = !open;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

// ─── Student loan tax ────────────────────────────────────────────
function studentLoan(e, SL_T, SL_R) {
  if (e <= SL_T) return 0;
  return (e - SL_T) * (SL_R / 100);
}

// ─── Additional tax relief from pension (r) ─────────────────────
// g = gross contribution = p / (1 - TR_B/100)
// y = effective earnings = e - g
function additionalRelief(e, g, B1, B2, B3, TR_H, TR_60, TR_A) {
  const y   = e - g;
  const th  = TR_H  / 100;
  const t60 = TR_60 / 100;
  const ta  = TR_A  / 100;

  if (e <= B1) return 0;

  if (e <= B2) {
    // Only higher rate band in play
    if (y >= B1) return th * g;            // whole gross in higher band
    return th * (e - B1);                  // partial — from e down to B1
  }

  if (e <= B3) {
    // Possibly 60% band and/or higher rate band
    if (y >= B2) return t60 * g;                                // whole gross in 60% band
    if (y >= B1) return t60*(e-B2) + th*(B2-y);                // split: 60% + higher
    return         t60*(e-B2) + th*(B2-B1);                    // 60% + full higher band slice
  }

  // e > B3: additional rate band possible too
  if (y >= B3) return ta * g;                                   // whole gross in addl rate
  if (y >= B2) return ta*(e-B3) + t60*(B3-y);                  // addl + 60%
  if (y >= B1) return ta*(e-B3) + t60*(B3-B2) + th*(B2-y);    // addl + 60% + higher
  return         ta*(e-B3) + t60*(B3-B2) + th*(B2-B1);        // addl + 60% + full higher
}

// ─── Solve for p using binary search ─────────────────────────────
function solveP(e, B1, B2, B3, TR_B, TR_H, TR_60, TR_A, SL_T, SL_R) {
  const sl = studentLoan(e, SL_T, SL_R);
  if (sl === 0) return { solved: false, reason: 'no_sl' };
  if (e <= B1)  return { solved: false, reason: 'no_relief_band' };

  const trb = TR_B / 100;
  // Max possible gross = full earnings (can't contribute more than you earn)
  const maxG = e;
  const maxR = additionalRelief(e, maxG, B1, B2, B3, TR_H, TR_60, TR_A);
  if (maxR < sl * 0.9999) return { solved: false, reason: 'insufficient_relief', maxR, sl };

  let lo = 0, hi = e * 0.8;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const g   = mid / (1 - trb);
    const r   = additionalRelief(e, g, B1, B2, B3, TR_H, TR_60, TR_A);
    if (r < sl) lo = mid; else hi = mid;
  }

  const p = (lo + hi) / 2;
  const g = p / (1 - trb);
  const r = additionalRelief(e, g, B1, B2, B3, TR_H, TR_60, TR_A);
  const y = e - g;
  return { solved: true, p, g, r, sl, y };
}

// ─── Main calculate ──────────────────────────────────────────────
function calculate() {
  const e    = v('earnings');
  const B0   = v('B0'), B1 = v('B1'), B2 = v('B2'), B3 = v('B3');
  const TR_B = v('TR_B'), TR_H = v('TR_H'), TR_60 = v('TR_60'), TR_A = v('TR_A');
  const SL_T = v('SL_T'), SL_R = v('SL_R');

  const sl = studentLoan(e, SL_T, SL_R);

  renderResults(e, sl, B1, B2, B3, TR_B, TR_H, TR_60, TR_A, SL_T, SL_R);
  drawTimeline(e, B0, B1, B2, B3, SL_T, SL_R, TR_B, TR_H, TR_60, TR_A);
}

// ─── Render results panel ────────────────────────────────────────
function renderResults(e, sl, B1, B2, B3, TR_B, TR_H, TR_60, TR_A, SL_T, SL_R) {
  const el = document.getElementById('results');

  if (e <= 0) {
    el.innerHTML = placeholder('Enter your total annual earnings above.');
    return;
  }

  if (e <= SL_T) {
    el.innerHTML = `<div class="results-inner"><div class="no-action">
      <strong>No student loan repayment due.</strong><br>
      Earnings of ${fmt(e)} are below the Plan 2 repayment threshold of ${fmt(SL_T)}.
      No pension contribution is required to offset it.
    </div></div>`;
    return;
  }

  if (e <= B1) {
    el.innerHTML = `<div class="results-inner"><div class="no-action">
      <strong>No additional tax relief available.</strong><br>
      Earnings of ${fmt(e)} are within the nil or basic rate band — pension contributions
      only receive basic rate relief at source. There is no further relief claimable on a
      tax return to offset the student loan (${fmtD(sl)}).
    </div></div>`;
    return;
  }

  const result = solveP(e, B1, B2, B3, TR_B, TR_H, TR_60, TR_A, SL_T, SL_R);

  if (!result.solved) {
    const msg = result.reason === 'insufficient_relief'
      ? `Even contributing the maximum, the additional tax relief available
         (${fmtD(result.maxR)}) cannot fully cover the student loan due (${fmtD(result.sl)}).`
      : `No pension contribution needed at this income level.`;
    el.innerHTML = `<div class="results-inner"><div class="no-action">${msg}</div></div>`;
    return;
  }

  const { p, g, r, y } = result;
  const atSource        = g - p;
  const totalRelief     = atSource + r;

  let band = '';
  if (e <= B2) band = 'Higher rate (40%)';
  else if (e <= B3) band = '60% effective rate';
  else band = 'Additional rate (45%)';

  el.innerHTML = `<div class="results-inner">
    <p class="section-eyebrow" style="margin-bottom:1rem;">Result</p>

    <div class="metrics-grid">
      <div class="metric-card metric-card--success">
        <p class="metric-label">Net contribution needed</p>
        <p class="metric-value">${fmtD(p)}</p>
        <p class="metric-sub">What you pay into your pension</p>
      </div>
      <div class="metric-card metric-card--neutral">
        <p class="metric-label">Gross contribution</p>
        <p class="metric-value">${fmtD(g)}</p>
        <p class="metric-sub">Net + basic rate relief at source</p>
      </div>
      <div class="metric-card metric-card--danger">
        <p class="metric-label">Student loan due</p>
        <p class="metric-value">${fmtD(sl)}</p>
        <p class="metric-sub">9% on earnings above ${fmt(v('SL_T'))}</p>
      </div>
      <div class="metric-card metric-card--success">
        <p class="metric-label">Relief via tax return</p>
        <p class="metric-value">${fmtD(r)}</p>
        <p class="metric-sub">Claimed on self-assessment</p>
      </div>
    </div>

    <div class="callout">
      <p>Contributing <strong>${fmtD(p)}</strong> net (${fmtD(g)} gross) reduces your effective earnings
      to <strong>${fmtD(y)}</strong> and generates <strong>${fmtD(r)}</strong> in additional tax relief on
      your return — exactly offsetting the student loan of <strong>${fmtD(sl)}</strong>.</p>
    </div>

    <p class="breakdown-heading">Full breakdown</p>
    <table class="breakdown-table">
      <tr><td>Total annual earnings</td><td>${fmt(e)}</td></tr>
      <tr><td>Gross pension contribution</td><td>${fmtD(g)}</td></tr>
      <tr><td>Effective earnings after contribution</td><td>${fmtD(y)}</td></tr>
      <tr><td>Income tax band</td><td>${band}</td></tr>
      <tr><td>Student loan threshold</td><td>${fmt(v('SL_T'))}</td></tr>
      <tr><td>Student loan due (${v('SL_R')}% above threshold)</td><td>${fmtD(sl)}</td></tr>
      <tr><td>Basic rate relief added at source (${v('TR_B')}%)</td><td>${fmtD(atSource)}</td></tr>
      <tr><td>Additional relief via self-assessment</td><td>${fmtD(r)}</td></tr>
      <tr class="total-row"><td>Total pension tax relief</td><td>${fmtD(totalRelief)}</td></tr>
    </table>
  </div>`;
}

function placeholder(msg) {
  return `<div class="results-inner"><div class="results-placeholder">
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" stroke="#c8c8c0" stroke-width="1.5"/>
      <path d="M16 10v6l4 2" stroke="#c8c8c0" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <p>${msg}</p>
  </div></div>`;
}

/* ═══════════════════════════════════════════════════════════════
   TIMELINE CHART
   ═══════════════════════════════════════════════════════════════ */

function drawTimeline(e, B0, B1, B2, B3, SL_T, SL_R, TR_B, TR_H, TR_60, TR_A) {
  const canvas = document.getElementById('timelineChart');
  const ctx    = canvas.getContext('2d');

  // ── sizing ──────────────────────────────────────────────────
  const DPR     = window.devicePixelRatio || 1;
  const W_CSS   = canvas.parentElement.clientWidth || 800;
  const H_CSS   = 210;
  canvas.style.height = H_CSS + 'px';
  canvas.width  = W_CSS * DPR;
  canvas.height = H_CSS * DPR;
  ctx.scale(DPR, DPR);
  const W = W_CSS, H = H_CSS;

  // ── layout constants ────────────────────────────────────────
  const PAD_L   = 20;
  const PAD_R   = 20;
  const BAR_Y   = 100;   // centre of main bar
  const BAR_H   = 22;    // height of main bar
  const TICK_H  = 10;    // tick mark half-height
  const LABEL_ABOVE = BAR_Y - BAR_H/2 - 28;  // y for labels above bar
  const LABEL_BELOW = BAR_Y + BAR_H/2 + 20;  // y for labels below bar
  const TRACK_W = W - PAD_L - PAD_R;

  // ── solve for p (for the overlay arrow) ─────────────────────
  const result = (e > B1 && e > v('SL_T'))
    ? solveP(e, B1, B2, B3, TR_B, TR_H, TR_60, TR_A, SL_T, SL_R)
    : null;

  // ── scale domain ────────────────────────────────────────────
  // domain runs from 0 to max of (e, B3+some padding, 130000)
  const domainMax = Math.max(e * 1.08, B3 * 1.04, 130000);
  function px(val) {
    return PAD_L + clamp(val / domainMax, 0, 1) * TRACK_W;
  }

  // ── clear ────────────────────────────────────────────────────
  ctx.clearRect(0, 0, W, H);

  // ── colour palette ───────────────────────────────────────────
  const COLS = {
    nil:    '#e8e7e0',
    basic:  '#b8d4c8',
    higher: '#6aaa8e',
    sixty:  '#e8a87c',
    addl:   '#c0392b',
    sl:     '#2980b9',
    earn:   '#1d4e3a',
    eff:    '#2a6e52',
    gross:  '#e8a87c',
    text:   '#4a4a46',
    textlt: '#8a8a84',
    white:  '#ffffff',
  };

  // ── 1. Draw band segments ────────────────────────────────────
  const bands = [
    { from: 0,   to: B0, col: COLS.nil,    label: '0%',  labelY: 'above' },
    { from: B0,  to: B1, col: COLS.basic,  label: '20%', labelY: 'above' },
    { from: B1,  to: B2, col: COLS.higher, label: '40%', labelY: 'above' },
    { from: B2,  to: B3, col: COLS.sixty,  label: '60%', labelY: 'above' },
    { from: B3,  to: domainMax, col: COLS.addl, label: '45%', labelY: 'above' },
  ];

  bands.forEach(b => {
    const x1 = px(b.from), x2 = px(b.to);
    if (x2 <= x1) return;
    const midX = (x1 + x2) / 2;

    // filled rect
    ctx.fillStyle = b.col;
    ctx.beginPath();
    roundRectPath(ctx, x1, BAR_Y - BAR_H/2, x2-x1, BAR_H, 0);
    ctx.fill();

    // band rate label above
    const bw = x2 - x1;
    if (bw > 28) {
      ctx.fillStyle = b.col === COLS.nil ? COLS.textlt : COLS.text;
      ctx.font = `500 12px 'DM Sans', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(b.label, midX, LABEL_ABOVE + 14);
    }
  });

  // ── 2. Band boundary ticks & labels ─────────────────────────
  const thresholds = [
    { val: 0,   label: '£0',        side: 'above' },
    { val: B0,  label: fmt(B0),     side: 'above' },
    { val: B1,  label: fmt(B1),     side: 'above' },
    { val: B2,  label: fmt(B2),     side: 'above' },
    { val: B3,  label: fmt(B3),     side: 'above' },
  ];

  thresholds.forEach(t => {
    const x = px(t.val);
    // tick
    ctx.strokeStyle = COLS.text;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, BAR_Y - BAR_H/2 - 4);
    ctx.lineTo(x, BAR_Y + BAR_H/2 + 4);
    ctx.stroke();

    // label
    ctx.fillStyle  = COLS.text;
    ctx.font       = `300 11px 'DM Sans', sans-serif`;
    ctx.textAlign  = t.val === 0 ? 'left' : 'center';
    ctx.fillText(t.label, x, BAR_Y - BAR_H/2 - 10);
  });

  // ── 3. Student loan threshold tick (below bar) ───────────────
  if (SL_T > 0 && SL_T < domainMax) {
    const x = px(SL_T);
    ctx.strokeStyle = COLS.sl;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, BAR_Y - BAR_H/2);
    ctx.lineTo(x, BAR_Y + BAR_H/2 + 18);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLS.sl;
    ctx.font = `300 11px 'DM Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(fmt(SL_T), x, LABEL_BELOW + 10);
    ctx.font = `500 10px 'DM Sans', sans-serif`;
    ctx.fillText('SL threshold', x, LABEL_BELOW + 24);
  }

  // ── 4. Total earnings marker ─────────────────────────────────
  if (e > 0) {
    const x = px(e);

    // vertical line through bar
    ctx.strokeStyle = COLS.earn;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, BAR_Y - BAR_H/2 - 6);
    ctx.lineTo(x, BAR_Y + BAR_H/2 + 6);
    ctx.stroke();

    // diamond marker on bar
    ctx.fillStyle = COLS.earn;
    diamond(ctx, x, BAR_Y, 6);

    // label above
    ctx.fillStyle = COLS.earn;
    ctx.font = `500 12px 'DM Sans', sans-serif`;
    ctx.textAlign = 'center';
    const earnLabel = fmt(e);
    const lx = clamp(x, PAD_L + 30, W - PAD_R - 30);
    ctx.fillText(earnLabel, lx, BAR_Y - BAR_H/2 - 26);
    ctx.font = `300 10px 'DM Sans', sans-serif`;
    ctx.fillStyle = COLS.textlt;
    ctx.fillText('total earnings', lx, BAR_Y - BAR_H/2 - 14);
  }

  // ── 5. Effective earnings & gross contribution span ──────────
  if (result && result.solved) {
    const { g, y } = result;
    const xEff  = px(y);   // effective earnings
    const xTot  = px(e);   // total earnings

    // Shaded "contribution span" on the bar
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = COLS.gross;
    ctx.fillRect(xEff, BAR_Y - BAR_H/2, xTot - xEff, BAR_H);
    ctx.restore();

    // Diagonal stripe overlay on contribution span (hatching)
    ctx.save();
    ctx.globalAlpha = 0.18;
    const stripeSpacing = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let sx = xEff - BAR_H; sx < xTot + BAR_H; sx += stripeSpacing) {
      ctx.moveTo(sx, BAR_Y - BAR_H/2);
      ctx.lineTo(sx + BAR_H, BAR_Y + BAR_H/2);
    }
    ctx.stroke();
    ctx.restore();

    // Effective earnings vertical line
    ctx.strokeStyle = COLS.eff;
    ctx.lineWidth   = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(xEff, BAR_Y - BAR_H/2 - 6);
    ctx.lineTo(xEff, BAR_Y + BAR_H/2 + 6);
    ctx.stroke();
    ctx.setLineDash([]);

    // Diamond on effective line
    ctx.fillStyle = COLS.eff;
    diamond(ctx, xEff, BAR_Y, 5);

    // Double-headed arrow between effective and total
    const arrowY = BAR_Y + BAR_H/2 + 12;
    drawArrow(ctx, xEff, arrowY, xTot, arrowY, COLS.gross, 1.5);
    const midArrow = (xEff + xTot) / 2;
    ctx.fillStyle = COLS.gross;
    ctx.font = `500 11px 'DM Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('gross contribution  ' + fmtD(g), midArrow, arrowY - 6);

    // Effective earnings label below
    ctx.fillStyle = COLS.eff;
    ctx.font = `500 11px 'DM Sans', sans-serif`;
    ctx.textAlign = 'center';
    const effLx = clamp(xEff, PAD_L + 30, W - PAD_R - 30);
    ctx.fillText(fmtD(y), effLx, LABEL_BELOW + 10);
    ctx.font = `300 10px 'DM Sans', sans-serif`;
    ctx.fillStyle = COLS.textlt;
    ctx.fillText('effective earnings', effLx, LABEL_BELOW + 24);

    // ── Relief shading annotation ──────────────────────────────
    // Highlight which band(s) the contribution sweeps through
    drawReliefBracket(ctx, e, y, g, B1, B2, B3, px, BAR_Y, BAR_H, COLS, result);
  }

  // ── 6. Legend ────────────────────────────────────────────────
  renderLegend(result && result.solved);
}

// ── Draw the "relief bracket" annotation above bar ──────────────
function drawReliefBracket(ctx, e, y, g, B1, B2, B3, px, barY, barH, COLS, result) {
  // Build list of band slices the gross contribution crosses
  const slices = [];
  const bandDefs = [
    { lo: B2,  hi: B3,          col: COLS.sixty,  label: '60% relief zone' },
    { lo: B1,  hi: B2,          col: COLS.higher, label: '40% relief zone' },
    { lo: 0,   hi: B1,          col: COLS.basic,  label: '20% at source only' },
  ];
  bandDefs.forEach(bd => {
    const segLo = Math.max(y,  bd.lo);
    const segHi = Math.min(e,  bd.hi);
    if (segHi > segLo) slices.push({ lo: segLo, hi: segHi, col: bd.col, label: bd.label });
  });
  // additional rate
  if (e > B3 && y < e) {
    const segLo = Math.max(y, B3);
    const segHi = Math.min(e, Infinity);
    if (segHi > segLo) slices.push({ lo: segLo, hi: segHi, col: COLS.addl, label: '45% relief zone' });
  }

  // Draw thin coloured overlay lines above bar for each slice
  slices.forEach(s => {
    const x1 = px(s.lo), x2 = px(s.hi);
    if (x2 <= x1) return;
    ctx.strokeStyle = s.col;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(x1, barY - barH/2 - 3);
    ctx.lineTo(x2, barY - barH/2 - 3);
    ctx.stroke();
  });
}

// ── Arrow helper (double-headed) ─────────────────────────────────
function drawArrow(ctx, x1, y1, x2, y2, col, lw) {
  const HEAD = 5;
  ctx.strokeStyle = col;
  ctx.fillStyle   = col;
  ctx.lineWidth   = lw;

  // line
  ctx.beginPath();
  ctx.moveTo(x1 + HEAD, y1);
  ctx.lineTo(x2 - HEAD, y2);
  ctx.stroke();

  // left head
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + HEAD, y1 - HEAD/2);
  ctx.lineTo(x1 + HEAD, y1 + HEAD/2);
  ctx.closePath();
  ctx.fill();

  // right head
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - HEAD, y2 - HEAD/2);
  ctx.lineTo(x2 - HEAD, y2 + HEAD/2);
  ctx.closePath();
  ctx.fill();
}

// ── Diamond marker ────────────────────────────────────────────────
function diamond(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
}

// ── Rounded rect path ─────────────────────────────────────────────
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Legend ────────────────────────────────────────────────────────
function renderLegend(hasSolution) {
  const el = document.getElementById('chartLegend');
  const items = [
    { type: 'swatch', col: '#e8e7e0',  label: '0% nil rate' },
    { type: 'swatch', col: '#b8d4c8',  label: '20% basic rate' },
    { type: 'swatch', col: '#6aaa8e',  label: '40% higher rate' },
    { type: 'swatch', col: '#e8a87c',  label: '60% effective rate' },
    { type: 'swatch', col: '#c0392b',  label: '45% additional rate' },
    { type: 'line',   col: '#1d4e3a',  label: 'Total earnings', dash: false },
    { type: 'line',   col: '#2a6e52',  label: 'Effective earnings', dash: true },
  ];
  if (hasSolution) {
    items.push({ type: 'stripe', colA: '#e8a87c', colB: '#faf9f6', label: 'Gross pension contribution' });
  }
  el.innerHTML = items.map(item => {
    if (item.type === 'swatch') {
      return `<div class="legend-item">
        <div class="legend-swatch" style="background:${item.col}"></div>
        <span>${item.label}</span>
      </div>`;
    }
    if (item.type === 'line') {
      const dash = item.dash ? 'border-top: 2px dashed ' + item.col : 'border-top: 2.5px solid ' + item.col;
      return `<div class="legend-item">
        <div class="legend-line" style="${dash}"></div>
        <span>${item.label}</span>
      </div>`;
    }
    if (item.type === 'stripe') {
      return `<div class="legend-item">
        <div class="legend-swatch stripe" style="--sw-a:${item.colA};--sw-b:#faf9f6"></div>
        <span>${item.label}</span>
      </div>`;
    }
  }).join('');
}

// ── Redraw chart on window resize ─────────────────────────────────
window.addEventListener('resize', () => {
  const e    = v('earnings');
  const B0   = v('B0'), B1 = v('B1'), B2 = v('B2'), B3 = v('B3');
  const TR_B = v('TR_B'), TR_H = v('TR_H'), TR_60 = v('TR_60'), TR_A = v('TR_A');
  const SL_T = v('SL_T'), SL_R = v('SL_R');
  drawTimeline(e, B0, B1, B2, B3, SL_T, SL_R, TR_B, TR_H, TR_60, TR_A);
});
