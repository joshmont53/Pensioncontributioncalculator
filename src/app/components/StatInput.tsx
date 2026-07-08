import type { RefObject } from 'react';
import { FormattedNumberInput } from './FormattedNumberInput';

export function StatInput({
  label, value, onChange, inputRef, step, tooltip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  step: number;
  tooltip?: string;
}) {
  return (
    <div className="flex-1 min-w-0 px-4 border-r border-black/8 last:border-r-0">
      <div className="text-[11px] text-[#8a8a84] mb-1 whitespace-nowrap flex items-center gap-1">
        {label}
        {tooltip && <span className="cursor-help opacity-60" title={tooltip}>ⓘ</span>}
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-lg font-bold text-[#1a1a18]">£</span>
        <FormattedNumberInput
          inputRef={inputRef}
          value={value}
          onChange={onChange}
          step={step}
          ariaLabel={tooltip ? `${label}. ${tooltip}` : label}
          className="text-lg font-bold text-[#1a1a18] bg-transparent outline-none w-full border-b border-black/10 focus:border-[#1d4e3a] pb-0.5 transition-colors"
        />
      </div>
    </div>
  );
}
