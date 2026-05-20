type ResultRowProps = {
  label: string;
  value: string;
};

export function ResultRow({ label, value }: ResultRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/8 py-3 text-sm last:border-b-0 last:pb-0">
      <span className="font-mono text-base text-[#c5c2ea]">{label}</span>
      <strong className="text-right text-xl font-semibold tracking-[-0.03em] text-white">
        {value}
      </strong>
    </div>
  );
}
