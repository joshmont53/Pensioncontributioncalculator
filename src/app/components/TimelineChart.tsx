import { useEffect, useRef, useState } from 'react';
import { TaxConfig } from '../hooks/useTaxConfig';

interface TimelineChartProps {
  earnings: number;
  grossContribution: number;
  effectiveEarnings: number;
  studentLoan: number;
  additionalRelief: number;
  config: TaxConfig;
}

export function TimelineChart({
  earnings,
  grossContribution,
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
    const H_CSS = 210;
    canvas.style.width = W_CSS + 'px';
    canvas.style.height = H_CSS + 'px';
    canvas.width = W_CSS * DPR;
    canvas.height = H_CSS * DPR;
    ctx.scale(DPR, DPR);
    const W = W_CSS;
    const H = H_CSS;

    const PAD_L = 20;
    const PAD_R = 20;
    const BAR_Y = 100;
    const BAR_H = 22;
    const LABEL_ABOVE = BAR_Y - BAR_H / 2 - 28;
    const LABEL_BELOW = BAR_Y + BAR_H / 2 + 28;
    const TRACK_W = W - PAD_L - PAD_R;

    // Scale to earnings, minimum 30k
    const domainMax = Math.max(earnings, 30000);
    const px = (val: number) => PAD_L + Math.max(0, Math.min(1, val / domainMax)) * TRACK_W;

    ctx.clearRect(0, 0, W, H);

    const COLS = {
      nil: '#e8e7e0',
      basic: '#b8d4c8',
      higher: '#6aaa8e',
      sixty: '#e8a87c',
      addl: '#c0392b',
      sl: '#2980b9',
      earn: '#1d4e3a',
      eff: '#2a6e52',
      gross: '#e8a87c',
      text: '#4a4a46',
      textlt: '#8a8a84',
    };

    // Band definitions with two-line labels
    const allBands = [
      { from: 0, to: B0, col: COLS.nil, pct: '0%', name: 'Nil rate' },
      { from: B0, to: B1, col: COLS.basic, pct: '20%', name: 'Basic rate' },
      { from: B1, to: B2, col: COLS.higher, pct: '40%', name: 'Higher rate' },
      { from: B2, to: B3, col: COLS.sixty, pct: '60%', name: 'Higher rate +\nPA taper' },
      { from: B3, to: Infinity, col: COLS.addl, pct: '45%', name: 'Additional rate' },
    ];

    // Filter and clip bands to visible domain
    const bands = allBands
      .map(b => ({ ...b, from: Math.max(b.from, 0), to: Math.min(b.to, domainMax) }))
      .filter(b => b.to > b.from && b.from < domainMax);

    bands.forEach(b => {
      const x1 = px(b.from);
      const x2 = px(b.to);
      if (x2 <= x1) return;
      const midX = (x1 + x2) / 2;

      ctx.fillStyle = b.col;
      ctx.fillRect(x1, BAR_Y - BAR_H / 2, x2 - x1, BAR_H);

      const bw = x2 - x1;
      if (bw > 35) {
        const textCol = b.col === COLS.nil ? COLS.textlt : COLS.text;

        // Percentage label
        ctx.fillStyle = textCol;
        ctx.font = `600 12px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(b.pct, midX, LABEL_ABOVE + 8);

        // Band name (handle two-line via \n)
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

    // Band boundary ticks & labels (all five thresholds)
    const allThresholds = [
      { val: 0, label: '£0', align: 'left' as const },
      { val: B0, label: `£${B0.toLocaleString('en-GB')}`, align: 'center' as const },
      { val: B1, label: `£${B1.toLocaleString('en-GB')}`, align: 'center' as const },
      { val: B2, label: `£${B2.toLocaleString('en-GB')}`, align: 'center' as const },
      { val: B3, label: `£${B3.toLocaleString('en-GB')}`, align: 'center' as const },
    ];

    const thresholds = allThresholds.filter(t => t.val <= domainMax);

    // Skip overlapping labels
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
      ctx.fillText(t.label, x, BAR_Y - BAR_H / 2 - 52);
    });

    // Student loan threshold (below bar, dashed)
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

    // Total earnings marker
    if (earnings > 0) {
      const x = px(earnings);

      ctx.strokeStyle = COLS.earn;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, BAR_Y - BAR_H / 2 - 6);
      ctx.lineTo(x, BAR_Y + BAR_H / 2 + 6);
      ctx.stroke();

      // Diamond marker
      ctx.fillStyle = COLS.earn;
      ctx.beginPath();
      ctx.moveTo(x, BAR_Y - 6);
      ctx.lineTo(x + 6, BAR_Y);
      ctx.lineTo(x, BAR_Y + 6);
      ctx.lineTo(x - 6, BAR_Y);
      ctx.closePath();
      ctx.fill();

      // "Total earnings" label top-right area
      const lx = Math.max(PAD_L + 40, Math.min(W - PAD_R - 10, x));
      ctx.fillStyle = COLS.earn;
      ctx.font = `600 12px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`£${earnings.toLocaleString('en-GB')}`, lx, BAR_Y - BAR_H / 2 - 56);
      ctx.font = `300 10px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = COLS.textlt;
      ctx.fillText('Total earnings', lx, BAR_Y - BAR_H / 2 - 44);
    }

    // Effective earnings & contribution span
    if (grossContribution > 0 && effectiveEarnings > 0 && effectiveEarnings < earnings) {
      const xEff = px(effectiveEarnings);
      const xTot = px(earnings);

      // Shaded contribution span
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = COLS.gross;
      ctx.fillRect(xEff, BAR_Y - BAR_H / 2, xTot - xEff, BAR_H);
      ctx.restore();

      // Diagonal stripes
      ctx.save();
      ctx.globalAlpha = 0.18;
      const stripeSpacing = 6;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let sx = xEff - BAR_H; sx < xTot + BAR_H; sx += stripeSpacing) {
        ctx.moveTo(sx, BAR_Y - BAR_H / 2);
        ctx.lineTo(sx + BAR_H, BAR_Y + BAR_H / 2);
      }
      ctx.stroke();
      ctx.restore();

      // Effective earnings line (dashed)
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

      // Double-headed arrow below bar
      const arrowY = BAR_Y + BAR_H / 2 + 18;
      const HEAD = 5;
      ctx.strokeStyle = COLS.gross;
      ctx.fillStyle = COLS.gross;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(xEff + HEAD, arrowY);
      ctx.lineTo(xTot - HEAD, arrowY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(xEff, arrowY);
      ctx.lineTo(xEff + HEAD, arrowY - HEAD / 2);
      ctx.lineTo(xEff + HEAD, arrowY + HEAD / 2);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(xTot, arrowY);
      ctx.lineTo(xTot - HEAD, arrowY - HEAD / 2);
      ctx.lineTo(xTot - HEAD, arrowY + HEAD / 2);
      ctx.closePath();
      ctx.fill();

      // Arrow label
      const midArrow = (xEff + xTot) / 2;
      ctx.fillStyle = COLS.gross;
      ctx.font = `500 11px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(
        `£${grossContribution.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} earnings removed by pension (gross)`,
        midArrow,
        arrowY - 7
      );

      // Effective earnings label (below)
      ctx.fillStyle = COLS.eff;
      ctx.font = `600 11px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      const effLx = Math.max(PAD_L + 40, Math.min(W - PAD_R - 40, xEff));
      ctx.fillText(
        `£${effectiveEarnings.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        effLx,
        LABEL_BELOW + 10
      );
      ctx.font = `300 10px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = COLS.textlt;
      ctx.fillText('Effective earnings', effLx, LABEL_BELOW + 23);
      ctx.fillText('(after pension)', effLx, LABEL_BELOW + 35);
    }

    // Mouse tooltip
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const barTop = BAR_Y - BAR_H / 2;
      const barBottom = BAR_Y + BAR_H / 2;

      if (y >= barTop && y <= barBottom && x >= PAD_L && x <= W - PAD_R) {
        const v = ((x - PAD_L) / TRACK_W) * domainMax;
        let tooltipContent = '';
        if (v <= B0) {
          tooltipContent = '0% nil rate\nNo income tax in this band';
        } else if (v <= B1) {
          tooltipContent = `20% basic rate\n${TR_B}% relief added at source`;
        } else if (v <= B2) {
          tooltipContent = `40% higher rate\n${TR_B}% at source + ${TR_H}% via tax return\n= ${TR_B + TR_H}% total relief`;
        } else if (v <= B3) {
          tooltipContent = `60% effective rate (PA taper)\n${TR_B}% at source + ${TR_60}% via tax return\n= ${TR_B + TR_60}% total relief`;
        } else {
          tooltipContent = `45% additional rate\n${TR_B}% at source + ${TR_A}% via tax return\n= ${TR_B + TR_A}% total relief`;
        }

        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top - 10,
          content: tooltipContent,
          visible: true,
        });
      } else {
        setTooltip(prev => ({ ...prev, visible: false }));
      }
    };

    const handleMouseLeave = () => {
      setTooltip(prev => ({ ...prev, visible: false }));
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [earnings, grossContribution, effectiveEarnings, studentLoan, additionalRelief, config]);

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas ref={canvasRef} className="w-full cursor-pointer" />
      {tooltip.visible && (
        <div
          className="absolute z-10 bg-[#1a1a18] text-white text-xs rounded-lg px-3 py-2 pointer-events-none shadow-lg whitespace-pre-line leading-relaxed"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
