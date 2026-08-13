import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import horizontalLogo from "@/app/dabi-price-horizontal.svg";
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
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#fffefb_0%,#f7fbf8_42%,#fff8f2_100%)] text-[#21352d]">
      <section className="border-b border-[#e6e1d4] bg-[radial-gradient(circle_at_top_left,rgba(255,213,181,0.28),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(223,241,230,0.45),transparent_24%),linear-gradient(180deg,#fffefb_0%,#fff8f2_100%)]">
        <div className="mx-auto max-w-[1200px] px-4 pb-14 pt-6 sm:px-6 lg:px-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" aria-label="DaBi Price" className="inline-flex">
              <Image
                src={horizontalLogo}
                alt="Dabi Price"
                width={176}
                height={42}
                unoptimized
                className="h-8 w-auto"
              />
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-full border border-[#d7e3dc] bg-white px-5 py-2.5 text-base font-medium text-[#21352d] transition hover:border-[#f06d2f] hover:text-[#a24b1c]"
              >
                Voltar para home
              </Link>
              <Link
                href="/planos"
                className="rounded-full bg-[#21352d] px-6 py-2.5 text-base font-semibold text-white transition hover:bg-[#17251f]"
              >
                Ver planos
              </Link>
            </div>
          </header>

          <div className="grid gap-10 pt-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.98fr)] lg:items-center">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-[#b8511d]">
                {config.eyebrow}
              </p>
              <h1 className="mt-4 max-w-[760px] text-6xl font-semibold leading-[0.92] tracking-[-0.07em] text-[#17261f] sm:text-[5rem]">
                {config.headline}
              </h1>
              <p className="mt-6 max-w-[720px] text-xl leading-9 text-[#374b42]">
                {config.description}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={config.ctaHref}
                  className="inline-flex items-center justify-center rounded-full bg-[#21352d] px-7 py-3.5 text-lg font-semibold text-white transition hover:bg-[#17251f]"
                >
                  {config.ctaLabel}
                </Link>
                <a
                  href="#como-funciona"
                  className="inline-flex items-center justify-center rounded-full border border-[#d7e3dc] bg-white px-7 py-3.5 text-lg font-semibold text-[#21352d] transition hover:border-[#21352d]"
                >
                  Ver como funciona
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {config.costs.map((cost) => (
                  <span
                    key={cost}
                    className="rounded-full border border-[#dbe7e0] bg-white px-4 py-2 text-base font-medium text-[#42574d]"
                  >
                    {cost}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[34px] border border-[#e5ded1] bg-white p-5 shadow-[0_28px_80px_rgba(33,53,45,0.1)]">
              <div className="rounded-[28px] border border-[#ece6db] bg-[#fffdf9] p-5">
                <div className="flex items-center justify-between gap-3 border-b border-[#efe8dc] pb-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#5c6e65]">
                      {config.proofLabel}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#21352d]">
                      {config.proofTitle}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#eef8f3] px-3 py-2 text-xs font-semibold text-[#20543f]">
                    Exemplo ilustrativo
                  </span>
                </div>

                <div className="mt-5 grid gap-3">
                  {config.proofRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-2xl border border-[#efe8dd] bg-white px-4 py-4 text-base"
                    >
                      <span className="text-[#42574d]">{row.label}</span>
                      <span className="font-semibold text-[#21352d]">{row.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[24px] bg-[#fff2ea] p-5">
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#a5551d]">
                    {config.proofResultLabel}
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[#9d4615]">
                    {config.proofResultValue}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-b border-[#ece6db] bg-white">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[780px] text-center">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
              Como o DaBi Price ajuda
            </p>
            <h2 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-0.06em] text-[#17261f]">
              O mesmo motor de precificação, com linguagem do seu negócio.
            </h2>
            <p className="mt-5 text-lg leading-9 text-[#42574d]">
              Você não precisa adaptar o problema para a ferramenta. O DaBi
              Price organiza a conta do jeito que a operação realmente funciona.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {config.steps.map((step) => (
              <article
                key={step.label}
                className="rounded-[30px] border border-[#e7e1d6] bg-[#fffdf9] p-6 shadow-[0_18px_40px_rgba(41,55,45,0.04)]"
              >
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#b8511d]">
                  {step.label}
                </p>
                <h3 className="mt-4 text-[1.7rem] font-semibold tracking-[-0.04em] text-[#17261f]">
                  {step.title}
                </h3>
                <p className="mt-4 text-lg leading-9 text-[#42574d]">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {children ? (
        <section className="border-b border-[#ece6db] bg-[#fcfbf8]">
          <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
            {children}
          </div>
        </section>
      ) : null}

      <section className="border-b border-[#ece6db] bg-[#f8fbf9]">
        <div className="mx-auto max-w-[980px] px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
            Feito para decidir melhor
          </p>
          <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[#17261f]">
            Menos improviso. Mais clareza sobre custos, preço e margem.
          </h2>
          <p className="mx-auto mt-5 max-w-[760px] text-lg leading-9 text-[#42574d]">
            A home do DaBi Price mostra o produto. As páginas segmentadas
            mostram como ele resolve um problema específico sem mudar o sistema
            inteiro por trás.
          </p>
        </div>
      </section>

      <section className="bg-[#1a2b24] text-white">
        <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-[34px] bg-[linear-gradient(135deg,#d16025,#f38a42)] px-6 py-10 shadow-[0_26px_80px_rgba(0,0,0,0.22)] sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-[680px]">
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-white/90">
                  Próximo passo
                </p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.06em]">
                  {config.ctaTitle}
                </h2>
                <p className="mt-4 text-lg leading-9 text-white">
                  {config.ctaDescription}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={config.ctaHref}
                  className="rounded-full bg-[#1a2b24] px-7 py-3.5 text-base font-semibold text-white transition hover:bg-[#111c17]"
                >
                  {config.ctaLabel}
                </Link>
                <Link
                  href="/planos"
                  className="rounded-full border border-white/30 bg-white px-7 py-3.5 text-base font-semibold text-[#1a2b24] transition hover:bg-[#f7f4f0]"
                >
                  Ver planos
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
