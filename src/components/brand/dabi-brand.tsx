/**
 * Marca dabi price.
 *
 * Uma unica fonte para o simbolo e o lockup, usada na landing, nas paginas
 * publicas e no app. O simbolo herda `--brand-blue` e `--brand-gold`; a metade
 * "price" herda `currentColor`, de modo que a marca funciona sobre qualquer
 * superficie sem precisar de um arquivo por tema.
 */

const PETAL = "M50,52 C34,50 22,34 30,10 C42,18 50,32 50,52 Z";
const ROTATIONS = [60, 120, 180, 240] as const;

export function DabiMark({
  size = 32,
  title,
}: {
  size?: number;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="dabi-mark"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <g fill="var(--brand-blue)">
        <path d={PETAL} />
        {ROTATIONS.map((angle) => (
          <path key={angle} d={PETAL} transform={`rotate(${angle} 50 50)`} />
        ))}
      </g>
      <path
        d={PETAL}
        transform="rotate(300 50 50)"
        fill="var(--brand-gold)"
      />
    </svg>
  );
}

export function DabiWordmark({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={`dabi-lockup dabi-lockup--${size}`}>
      <DabiMark size={size === "lg" ? 44 : size === "sm" ? 26 : 32} />
      <span className="dabi-lockup__text">
        <span className="dabi-lockup__brand">dabi</span>
        <span className="dabi-lockup__product">price</span>
      </span>
    </span>
  );
}
