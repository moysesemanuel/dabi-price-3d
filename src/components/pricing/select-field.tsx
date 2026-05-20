type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
};

export function SelectField({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#8b86bb]">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[20px] border border-white/10 bg-[#0f1020] px-4 py-3 pr-12 text-white outline-none transition focus:border-[#b888ff] focus:bg-[#131427]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
