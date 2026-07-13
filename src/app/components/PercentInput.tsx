import { useState } from 'react';
import type { RefObject } from 'react';

export function PercentInput({
  label, value, onChange, inputRef, step = 0.1, tooltip,
}: {
  label: string;
  value: number; // decimal, e.g. 0.04 for 4%
  onChange: (v: number) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  step?: number;
  tooltip?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const formatted = value === 0 ? '' : String(Math.round(value * 10000) / 100);
  const displayValue = draft ?? formatted;

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    onChange(Number.isFinite(n) ? n / 100 : 0);
  };

  return (
    <div className="flex-1 min-w-0 px-4 border-r border-black/8 last:border-r-0">
      <div className="text-[11px] text-[#8a8a84] mb-1 whitespace-nowrap flex items-center gap-1">
        {label}
        {tooltip && <span className="cursor-help opacity-60" title={tooltip}>ⓘ</span>}
      </div>
      <div className="flex items-baseline gap-0.5">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onFocus={() => setDraft(formatted)}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => { commit(e.target.value); setDraft(null); }}
          onKeyDown={e => {
            if (e.key === 'ArrowUp') { e.preventDefault(); onChange(round4(value + step / 100)); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, round4(value - step / 100))); }
          }}
          aria-label={tooltip ? `${label}. ${tooltip}` : label}
          className="text-lg font-bold text-[#1a1a18] bg-transparent outline-none w-full border-b border-black/10 focus:border-[#1d4e3a] pb-0.5 transition-colors"
        />
        <span className="text-lg font-bold text-[#1a1a18]">%</span>
      </div>
    </div>
  );
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
