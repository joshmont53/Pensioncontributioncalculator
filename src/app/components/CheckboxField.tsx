export function CheckboxField({
  checked, onChange, label, tooltip,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  tooltip?: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span className="relative w-4 h-4 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="peer absolute inset-0 w-4 h-4 opacity-0 cursor-pointer z-10"
        />
        <span className="absolute inset-0 rounded border border-black/25 bg-white peer-checked:bg-[#1d4e3a] peer-checked:border-[#1d4e3a] transition-colors pointer-events-none" />
        <svg
          className="absolute inset-0 m-auto hidden peer-checked:block pointer-events-none"
          width="10" height="8" viewBox="0 0 10 8" fill="none"
        >
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-sm text-[#1a1a18] font-medium whitespace-nowrap">{label}</span>
      {tooltip && <span className="cursor-help opacity-60 text-xs" title={tooltip}>ⓘ</span>}
    </label>
  );
}
