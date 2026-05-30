import { useEffect, useRef, useState } from 'react';
import { TaxConfig } from '../hooks/useTaxConfig';

interface TimelineChartProps {
  earnings: number;
  grossContribution: number;
  grossGiftAid: number;
  effectiveEarnings: number;
  studentLoan: number;
  additionalRelief: number;
  config: TaxConfig;
}

export function TimelineChart({
  earnings,
  grossContribution,
  grossGiftAid,
  effectiveEarnings,
  studentLoan,
  additionalRelief,
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
    const H_CSS = 220;
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
    const LABEL_ABOVE = BAR_Y - BAR_H / 2 - 28;
    const LABEL_BELOW = BAR_Y + BAR_H / 2 + 28;
    const TRACK_W = W - PAD_L - PAD_R;

    const domainMax = Math.max(earnings, 30000);
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
      text:   '#4a4a46',
      textlt: '#8a8a84',
    };

    // ── Band fills ────────────────────────────────────────────────────────
    const allBands = [
      { from: 0,  to: B0, col: COLS.nil,    pct: '0%',  name: 'Nil rate' },
      { from: B0, to: B1, col: COLS.basic,  pct: '20%', name: 'Basic rate' },
      { from: B1, to: B2, col: COLS.higher, pct: '40%', name: 'Higher rate' },
      { from: B2, to: B3, col: COLS.sixty,  pct: '60%', name: 'Higher rate +\nPA taper' },
      { from: B3, to: Infinity, col: COLS.addl, pct: '45%', name: 'Additional rate' },
    ];

    const bands = allBands
      .map(b => ({ ...b, from: Math.max(b.from, 0), to: Math.min(b.to, domainMax) }))
      .filter(b => b.to > b.from && b.from < domainMax);

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
          lines.forEach((line, i) => {
            ctx.fillText(line, midX, LABEL_ABOVE + 22 + i * 12);
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

    const thresholds = allThresholds.filter(t => t.val <= domainMax);
    const MIN_LABEL_SPACING = 55;
    const visibleThresholds: typeof thresholds = [];
    let lastX = -Infinity;

    thresholds.forEach(t => {
      const x = px(t.val);
      if (x - lastX >= MIN_LABEL_SPACING || t.val === 0) {
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

    // ── Student loan threshold ────────────────────────────────────────────
    if (SL_T > 0 && SL_T < domainMax) {
      const x = px(SL_T);
      ctx.strokeStyle = COLS.sl;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, BAR_Y - BAR_H / 2);
      ctx.lineTo(x, BAR_Y + BAR_H / 2 + 18);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLS.sl;
      ctx.font = `300 11px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`£${SL_T.toLocaleString('en-GB')}`, x, LABEL_BELOW + 10);
      ctx.font = `500 10px -apple-system, system-ui, sans-serif`;
      ctx.fillText(`${SL_PLAN} student loan`, x, LABEL_BELOW + 23);
      ctx.fillText('threshold', x, LABEL_BELOW + 35);
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

      const lx = Math.max(PAD_L + 40, Math.min(W - PAD_R - 10, x));
      ctx.fillStyle = COLS.earn;
      ctx.font = `600 12px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`£${earnings.toLocaleString('en-GB')}`, lx, BAR_Y - BAR_H / 2 - 60);
      ctx.font = `300 10px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = COLS.textlt;
      ctx.fillText('Total earnings', lx, BAR_Y - BAR_H / 2 - 47);
    }

    // ── Contribution overlays (pension + gift aid) ────────────────────────
    const hasPension  = grossContribution > 0 && effectiveEarnings < earnings;
    const hasGiftAid  = grossGiftAid > 0;

    // xEff = combined effective (after pension + gift aid)
    // xPen = after pension only (= before gift aid removal)
    const xEff  = px(effectiveEarnings);
    const xPen  = px(Math.max(0, earnings - grossContribution));
    const xTot  = px(earnings);

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
      ctx.fillText(label, mid, yLine - 6);
    };

    if (hasPension || hasGiftAid) {
      // Draw pension hatch (right region: xPen → xTot)
      if (hasPension) {
        drawHatch(xPen, xTot, '#f5ddc8', '#e8a87c');
      }

      // Draw gift aid hatch (middle region: xEff → xPen)
      if (hasGiftAid && xPen > xEff) {
        drawHatch(xEff, xPen, '#c2dce6', '#4a90a4');
      }

      // Effective earnings dashed line
      ctx.strokeStyle = COLS.eff;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(xEff, BAR_Y - BAR_H / 2 - 6);
      ctx.lineTo(xEff, BAR_Y + BAR_H / 2 + 6);
      ctx.stroke();
      ctx.setLineDash([]);

      // Diamond on effective line
      ctx.fillStyle = COLS.eff;
      ctx.beginPath();
      ctx.moveTo(xEff, BAR_Y - 5);
      ctx.lineTo(xEff + 5, BAR_Y);
      ctx.lineTo(xEff, BAR_Y + 5);
      ctx.lineTo(xEff - 5, BAR_Y);
      ctx.closePath();
      ctx.fill();

      // Determine arrow row(s)
      const hasBoth = hasPension && hasGiftAid && xPen > xEff;
      const arrowY1 = BAR_Y + BAR_H / 2 + (hasBoth ? 14 : 18);
      const arrowY2 = BAR_Y + BAR_H / 2 + 30;

      if (hasPension) {
        const pensionLabel = `£${Math.round(grossContribution).toLocaleString('en-GB')} removed by pension (gross)`;
        drawArrow(xPen, xTot, arrowY1, pensionLabel, COLS.pension);
      }

      if (hasBoth) {
        const gaLabel = `£${Math.round(grossGiftAid).toLocaleString('en-GB')} gift aid (gross)`;
        drawArrow(xEff, xPen, arrowY2, gaLabel, COLS.gift);
      } else if (hasGiftAid && !hasPension) {
        const gaLabel = `£${Math.round(grossGiftAid).toLocaleString('en-GB')} gift aid (gross)`;
        drawArrow(xEff, xPen, arrowY1, gaLabel, COLS.gift);
      }

      // Effective earnings label below
      const effLx = Math.max(PAD_L + 40, Math.min(W - PAD_R - 40, xEff));
      const effLabelY = hasBoth ? LABEL_BELOW + 18 : LABEL_BELOW + 10;

      ctx.fillStyle = COLS.eff;
      ctx.font = `600 11px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(
        `£${Math.round(effectiveEarnings).toLocaleString('en-GB')}`,
        effLx, effLabelY
      );
      ctx.font = `300 10px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = COLS.textlt;
      ctx.fillText('Effective earnings', effLx, effLabelY + 13);
      ctx.fillText('(after pension & gift aid)', effLx, effLabelY + 25);
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
        if (v <= B0)      content = '0% nil rate\nNo income tax in this band';
        else if (v <= B1) content = `20% basic rate\n${TR_B}% relief added at source`;
        else if (v <= B2) content = `40% higher rate\n${TR_B}% at source + ${TR_H}% via tax return\n= ${TR_B + TR_H}% total relief`;
        else if (v <= B3) content = `60% effective rate (PA taper)\n${TR_B}% at source + ${TR_60}% via tax return\n= ${TR_B + TR_60}% total relief`;
        else              content = `45% additional rate\n${TR_B}% at source + ${TR_A}% via tax return\n= ${TR_B + TR_A}% total relief`;

        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10, content, visible: true });
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
  }, [earnings, grossContribution, grossGiftAid, effectiveEarnings, studentLoan, additionalRelief, config]);

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
