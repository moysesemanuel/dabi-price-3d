import type { Metadata } from "next";
import Link from "next/link";
import { ConfectioneryLandingCalculator } from "@/components/public/confectionery-landing-calculator";

const benefits = [
  {
    number: "1",
    title: "Coloque seus custos reais",
    description:
      "Ingredientes, embalagens, energia, custos fixos, perdas e outros gastos da produção.",
  },
  {
    number: "2",
    title: "Valorize seu tempo",
    description:
      "Inclua horas trabalhadas e o valor da sua hora para não trabalhar de graça.",
  },
  {
    number: "3",
    title: "Veja o preço sugerido",
    description:
      "Defina taxas e margem desejada e receba um valor por lote e por unidade.",
  },
] as const;

export const metadata: Metadata = {
  title: "Precifique com Lucro | Calculadora gratuita para confeiteiras",
  description:
    "Calculadora gratuita de precificação para confeiteiras. Descubra quanto cobrar, considere custos, mão de obra, taxas e margem de lucro.",
};

export default function ConfectioneryLandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#fffefc_0%,#f6fbf7_38%,#fff6fa_100%)] text-[#274338]">
      <div className="sticky top-0 z-30 border-b border-[#dbeae2] bg-[rgba(255,252,250,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] w-full max-w-[1120px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/confeitaria"
            className="inline-flex items-center gap-3 font-black tracking-[-0.02em] text-[#274338]"
          >
            <span className="grid size-[38px] place-items-center rounded-[12px] bg-[#f68ab0] font-black text-white shadow-[0_10px_24px_rgba(246,138,176,0.24)]">
              PL
            </span>
            <span>Precifique com Lucro</span>
          </Link>

          <a
            href="#calculadora"
            className="rounded-[12px] bg-[#24473c] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#1d3a31]"
          >
            Usar calculadora grátis
          </a>
        </div>
      </div>

      <section className="mx-auto grid w-full max-w-[1120px] gap-10 px-4 pb-14 pt-[72px] sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f4ed] px-3 py-2 text-[0.82rem] font-extrabold text-[#5b8b75]">
            Ferramenta 100% gratuita para confeiteiras
          </span>

          <h1 className="mt-5 max-w-[760px] text-[clamp(2.5rem,6vw,5.4rem)] font-semibold leading-[0.96] tracking-[-0.055em] text-[#274338]">
            Seu doce pode estar vendendo.{" "}
            <span className="text-[#f68ab0]">Mas está dando lucro?</span>
          </h1>

          <p className="mt-5 max-w-[650px] text-[1.12rem] leading-[1.65] text-[#6c897b]">
            Descubra quanto cobrar considerando ingredientes, embalagens, mão de
            obra, perdas, taxas e margem de lucro — sem depender de “achismos”
            ou do preço da concorrência.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#captura"
              className="inline-flex items-center justify-center rounded-[14px] bg-[#f68ab0] px-[18px] py-[14px] text-sm font-black text-white shadow-[0_14px_30px_rgba(246,138,176,0.25)] transition hover:-translate-y-px hover:bg-[#eb739d]"
            >
              Quero calcular meu preço
            </a>
            <a
              href="#como-funciona"
              className="inline-flex items-center justify-center rounded-[14px] border border-[#dbe7e0] bg-white px-[18px] py-[14px] text-sm font-black text-[#274338] transition hover:-translate-y-px"
            >
              Ver como funciona
            </a>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-[0.9rem] text-[#6c897b]">
            <span className="inline-flex items-center gap-2">
              <b className="font-black text-[#2c8058]">✓</b> Sem planilhas complicadas
            </span>
            <span className="inline-flex items-center gap-2">
              <b className="font-black text-[#2c8058]">✓</b> Resultado em poucos minutos
            </span>
            <span className="inline-flex items-center gap-2">
              <b className="font-black text-[#2c8058]">✓</b> Feita para confeiteiras
            </span>
          </div>
        </div>

        <div className="rounded-[30px] border border-[#dbe7e0] bg-white p-6 shadow-[0_18px_60px_rgba(99,144,126,0.1)] lg:rotate-1">
          <div className="mb-1 font-black text-[#274338]">Exemplo de uma produção</div>
          <div className="mb-[18px] text-[0.9rem] text-[#6c897b]">
            Veja o que muda quando você inclui todos os custos.
          </div>

          <HeroRow label="Ingredientes" value="R$ 35,00" />
          <HeroRow label="Embalagem + energia" value="R$ 12,00" />
          <HeroRow label="Mão de obra" value="R$ 30,00" />
          <HeroRow label="Outros + perdas" value="R$ 16,25" last />

          <div className="mt-[18px] rounded-[18px] bg-[#fff5f9] p-[18px]">
            <small className="text-[#7d6872]">Preço sugerido do lote</small>
            <strong className="mt-1 block text-[2rem] text-[#f68ab0]">
              R$ 133,21
            </strong>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="py-[72px]">
        <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
          <div className="mx-auto mb-[34px] max-w-[760px] text-center">
            <h2 className="text-[clamp(2rem,4vw,3.3rem)] font-semibold tracking-[-0.04em] text-[#274338]">
              Preço não é ingrediente + “um pouquinho de lucro”
            </h2>
            <p className="mt-3 leading-[1.65] text-[#6c897b]">
              Uma precificação profissional considera tudo o que existe entre
              produzir e entregar.
            </p>
          </div>

          <div className="grid gap-[18px] md:grid-cols-3">
            {benefits.map((benefit) => (
              <article
                key={benefit.number}
                className="rounded-[20px] border border-[#dbe7e0] bg-white p-[22px] shadow-[0_10px_34px_rgba(99,144,126,0.06)]"
              >
                <div className="mb-[14px] grid size-[38px] place-items-center rounded-[12px] bg-[#e8f4ed] font-black text-[#5b8b75]">
                  {benefit.number}
                </div>
                <h3 className="text-[1.05rem] font-semibold text-[#274338]">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-[0.92rem] leading-[1.55] text-[#6c897b]">
                  {benefit.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-[72px]">
        <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
          <ConfectioneryLandingCalculator />
        </div>
      </section>

      <section className="px-4 pb-[84px] sm:px-6">
        <div className="mx-auto w-full max-w-[1120px] rounded-[32px] bg-[linear-gradient(135deg,#24473c,#34584c)] px-6 py-[42px] text-center text-white shadow-[0_24px_60px_rgba(36,71,60,0.22)]">
          <h2 className="mx-auto max-w-[780px] text-[clamp(2rem,4vw,3.4rem)] font-semibold tracking-[-0.04em]">
            Quer transformar sua confeitaria em um negócio mais organizado e lucrativo?
          </h2>
          <p className="mx-auto mt-3 max-w-[650px] leading-[1.6] text-[#dcebe4]">
            Em breve: aulas, materiais, mentorias e ferramentas para ajudar
            confeiteiras a precificar, vender e gerir melhor o negócio.
          </p>
          <div className="mt-[22px] flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/planos?origin=confeitaria"
              className="inline-flex items-center justify-center rounded-[14px] bg-white px-[24px] py-[14px] text-sm font-black text-[#d8648f] transition hover:-translate-y-px hover:bg-[#fff6fa]"
            >
              Garantir meu acesso
              <span className="ml-3 text-base">→</span>
            </Link>
            <Link
              href="/contato"
              className="inline-flex items-center justify-center rounded-[14px] border border-white/38 bg-transparent px-[24px] py-[14px] text-sm font-black text-white transition hover:-translate-y-px hover:bg-white/8"
            >
              Falar com consultor
            </Link>
          </div>
        </div>
      </section>

      <footer className="pb-[34px] text-center text-[0.78rem] text-[#6c897b]">
        © 2026 Precifique com Lucro • Ferramenta educacional para confeiteiras
      </footer>
    </main>
  );
}

function HeroRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-5 py-[13px] ${
        last ? "" : "border-b border-[#dbe7e0]"
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
