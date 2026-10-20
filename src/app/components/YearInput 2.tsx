import { useState } from 'react';
import type { RefObject } from 'react';

export function YearInput({
  label, value, onChange, inputRef, tooltip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  tooltip?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? String(value);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) onChange(n);
  };

  return (
    <div className="flex-1 min-w-0 px-4 border-r border-black/8 last:border-r-0">
      <div className="text-[11px] text-[#8a8a84] mb-1 whitespace-nowrap flex items-center gap-1">
        {label}
        {tooltip && <span className="cursor-help opacity-60" title={tooltip}>ⓘ</span>}
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onFocus={() => setDraft(String(value))}
        onChange={e => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={e => { commit(e.target.value); setDraft(null); }}
        aria-label={tooltip ? `${label}. ${tooltip}` : label}
        className="text-lg font-bold text-[#1a1a18] bg-transparent outline-none w-full border-b border-black/10 focus:border-[#1d4e3a] pb-0.5 transition-colors"
      />
    </div>
  );
}
