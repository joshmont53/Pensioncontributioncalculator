export function StatDisplay({
  label, value, green, tooltip,
}: {
  label: string;
  value: number;
  green?: boolean;
  tooltip?: string;
}) {
  return (
    <div className="flex-1 min-w-0 px-4 border-r border-black/8 last:border-r-0">
      <div className="text-[11px] text-[#8a8a84] mb-1 whitespace-nowrap flex items-center gap-1">
        {label}
        {tooltip && <span className="cursor-help opacity-60" title={tooltip}>ⓘ</span>}
      </div>
      <div className={`text-lg font-bold tabular-nums ${green ? 'text-[#1d4e3a]' : 'text-[#1a1a18]'}`}>
        {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Math.round(value))}
      </div>
    </div>
  );
}
