import type { ReactNode } from "react";
import Link from "next/link";
import { DabiWordmark } from "@/components/brand/dabi-brand";
import { LandingThemeToggle } from "@/components/public/landing-theme-toggle";
import type { SegmentLandingConfig } from "@/lib/public/segment-landings";

type SegmentLandingPageProps = {
  config: SegmentLandingConfig;
  children?: ReactNode;
};

export function SegmentLandingPage({
  config,
  children,
}: SegmentLandingPageProps) {
  return (
    <main
      className="landing-root min-h-screen overflow-x-hidden"
      data-segment={config.slug}
    >
      <header className="landing-header">
        <div className="landing-shell">
          <div className="landing-header__bar">
            <Link href="/" aria-label="dabi price">
              <DabiWordmark />
            </Link>

            <div className="flex items-center gap-3">
              <LandingThemeToggle />
              <Link
                href="/"
                className="landing-link hidden sm:inline-flex"
              >
                Voltar para a home
              </Link>
              <Link href="/planos" className="landing-cta landing-cta--sm">
                Ver planos
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- herói do segmento ---------- */}
      <section className="landing-hero">
        <div className="landing-shell">
          <div className="landing-hero__grid">
            <div className="flex flex-col gap-7">
              <span className="landing-eyebrow">{config.eyebrow}</span>

              <h1 className="landing-display">{config.headline}</h1>

              <p
                className="landing-lede"
                style={{ maxWidth: "46ch", fontSize: "1.0625rem" }}
              >
                {config.description}
              </p>

              <div className="flex flex-wrap gap-3">
                <Link href={config.ctaHref} className="landing-cta">
                  {config.ctaLabel}
                </Link>
                <a
                  href="#como-funciona"
                  className="landing-cta landing-cta--ghost"
                >
                  Ver como funciona
                </a>
              </div>

              <div className="flex flex-wrap gap-2">
                {config.costs.map((cost) => (
                  <span
                    key={cost}
                    className="px-3 py-2 text-sm"
                    style={{
                      border: "1px solid var(--landing-line-strong)",
                      borderRadius: "var(--landing-radius-sm)",
                      color: "var(--landing-muted)",
                    }}
                  >
                    {cost}
                  </span>
                ))}
              </div>
            </div>

            <div className="landing-hero__bleed">
              <div className="landing-rail">
                <div
                  className="landing-rail__head flex flex-wrap items-baseline justify-between gap-3 px-6 py-5 sm:px-7"
                  style={{ borderBottom: "1px solid var(--landing-line)" }}
                >
                  <div className="flex flex-col gap-1">
                    <span
                      className="landing-num"
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: "var(--landing-muted-soft)",
                      }}
                    >
                      {config.proofLabel}
                    </span>
                    <span className="text-lg font-semibold tracking-[-0.01em]">
                      {config.proofTitle}
                    </span>
                  </div>
                  <span
                    className="landing-num"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--landing-muted-soft)",
                    }}
                  >
                    Exemplo ilustrativo
                  </span>
                </div>

                {config.proofRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-4 px-6 py-4 sm:px-7"
                    style={{ borderBottom: "1px solid var(--landing-line)" }}
                  >
                    <span
                      className="text-sm"
                      style={{ color: "var(--landing-ink-soft)" }}
                    >
                      {row.label}
                    </span>
                    <span className="landing-num text-base font-semibold">
                      {row.value}
                    </span>
                  </div>
                ))}

                <div className="landing-rail__foot flex flex-col gap-1 px-6 py-6 sm:px-7">
                  <span
                    className="landing-num"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "var(--landing-muted-soft)",
                    }}
                  >
                    {config.proofResultLabel}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-display-ui)",
                      fontSize: "clamp(2.25rem, 4vw, 3rem)",
                      lineHeight: 1,
                      color: "var(--landing-profit)",
                    }}
                  >
                    {config.proofResultValue}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- como funciona no segmento ---------- */}
      <section id="como-funciona" className="landing-section landing-section--alt">
        <div className="landing-shell flex flex-col gap-12">
          <div className="flex flex-col gap-5" style={{ maxWidth: "62ch" }}>
            <span className="landing-eyebrow">Como o dabi price ajuda</span>
            <h2 className="landing-h2">
              O mesmo motor de cálculo, com a{" "}
              <span className="landing-turn">linguagem do seu negócio</span>.
            </h2>
            <p className="landing-lede">
              Você não precisa adaptar o problema à ferramenta. A conta é
              organizada do jeito que a operação funciona.
            </p>
          </div>

          <div className="landing-grid landing-grid--3">
            {config.steps.map((step) => (
              <article key={step.label} className="landing-card flex flex-col gap-4">
                <span
                  className="landing-num"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.26em",
                    textTransform: "uppercase",
                    color: "var(--landing-gold)",
                  }}
                >
                  {step.label}
                </span>
                <h3 className="landing-h3">{step.title}</h3>
                <p className="landing-note">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {children ? (
        <section className="landing-section">
          <div className="landing-shell">{children}</div>
        </section>
      ) : null}

      {/* ---------- fechamento + CTA ---------- */}
      <section className="landing-section landing-section--alt">
        <div className="landing-shell flex flex-col gap-12">
          <div className="flex flex-col gap-5" style={{ maxWidth: "62ch" }}>
            <span className="landing-eyebrow">Feito para decidir melhor</span>
            <h2 className="landing-h2">
              Menos improviso. Mais clareza sobre custo, preço e margem.
            </h2>
            <p className="landing-lede">
              A home mostra o produto. Esta página mostra como ele resolve um
              problema específico — sem trocar o sistema por trás.
            </p>
          </div>

          <div
            className="landing-card landing-card--gold flex flex-wrap items-end justify-between gap-8"
            style={{ padding: "clamp(32px, 5vw, 52px) clamp(24px, 4vw, 44px)" }}
          >
            <div className="flex flex-col gap-4" style={{ maxWidth: "38ch" }}>
              <span className="landing-eyebrow">Próximo passo</span>
              <span className="landing-h2">{config.ctaTitle}</span>
              <p className="landing-lede">{config.ctaDescription}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={config.ctaHref} className="landing-cta">
                {config.ctaLabel}
              </Link>
              <Link href="/planos" className="landing-cta landing-cta--ghost">
                Ver planos
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
