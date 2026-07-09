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
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        {label}
      </span>

      <input
        type={type}
        value={value}
        step="any"
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[20px] border border-[#d6c8bb] bg-white px-4 py-3 text-base text-[#18120d] outline-none transition placeholder:text-[#8a7768] focus:border-[#ff6a00]/45 focus:ring-2 focus:ring-[#ff6a00]"
      />
    </label>
  );
}
