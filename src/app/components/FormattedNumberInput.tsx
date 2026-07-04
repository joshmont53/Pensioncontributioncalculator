import { useState } from 'react';
import type { RefObject } from 'react';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n);

export function FormattedNumberInput({
  value, onChange, className, step = 1, inputRef, ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  step?: number;
  inputRef?: RefObject<HTMLInputElement | null>;
  ariaLabel?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={focused ? (value === 0 ? '' : String(value)) : fmt(value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => {
        const digits = e.target.value.replace(/\D/g, '');
        onChange(digits === '' ? 0 : parseInt(digits, 10));
      }}
      onKeyDown={e => {
        if (e.key === 'ArrowUp') { e.preventDefault(); onChange(value + step); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, value - step)); }
      }}
      className={className}
    />
  );
}
