type InputFieldProps = {
  label: string;
  value: string | number;
  type?: "text" | "number";
  onChange: (value: string) => void;
  className?: string;
};

export function InputField({
  label,
  value,
  type = "text",
  onChange,
  className,
}: InputFieldProps) {
  return (
    <label className={className}>
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#8b86bb]">
        {label}
      </span>

      <input
        type={type}
        value={value}
        step="any"
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[20px] border border-white/10 bg-[#0f1020] px-4 py-3 text-base text-white outline-none transition placeholder:text-[#55527e] focus:border-[#b888ff] focus:bg-[#131427]"
      />
    </label>
  );
}
