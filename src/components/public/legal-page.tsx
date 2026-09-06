import type { ReactNode } from "react";
import Link from "next/link";
import { DabiWordmark } from "@/components/brand/dabi-brand";
import { LandingThemeToggle } from "@/components/public/landing-theme-toggle";
import { companyIdentity, missingCompanyFields } from "@/lib/legal/company";
import {
  formatLegalDate,
  legalDocumentList,
  type LegalDocument,
} from "@/lib/legal/documents";

export function LegalPage({
  document,
  children,
}: {
  document: LegalDocument;
  children: ReactNode;
}) {
  const pending = missingCompanyFields();

  return (
    <main className="landing-root min-h-screen overflow-x-hidden">
      <header className="landing-header">
        <div className="landing-shell">
          <div className="landing-header__bar">
            <Link href="/" aria-label="dabi price">
              <DabiWordmark />
            </Link>
            <div className="flex items-center gap-3">
              <LandingThemeToggle />
              <Link href="/" className="landing-link hidden sm:inline-flex">
                Voltar para a home
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="landing-section" style={{ borderTop: "none" }}>
        <div className="landing-shell flex flex-col gap-10">
          <div className="flex flex-col gap-5" style={{ maxWidth: "62ch" }}>
            <span className="landing-eyebrow">Documento legal</span>
            <h1 className="landing-h2">{document.title}</h1>
            <p className="landing-note">
              Versão de {formatLegalDate(document.version)}. Ao alterarmos este
              documento, publicamos uma nova versão datada.
            </p>
          </div>

          {pending.length > 0 ? (
            <div
              className="landing-card"
              style={{
                borderColor: "var(--landing-gold-soft)",
                background: "var(--landing-gold-faint)",
              }}
            >
              <p className="landing-note" style={{ color: "var(--landing-ink)" }}>
                <strong>Documento em preenchimento.</strong> Faltam dados
                obrigatórios da empresa ({pending.join(", ")}). Esta página não
                deve ir ao ar como está.
              </p>
            </div>
          ) : null}

          <article className="legal-prose" style={{ maxWidth: "72ch" }}>
            {children}
          </article>

          <div
            className="flex flex-col gap-3 pt-8"
            style={{ borderTop: "1px solid var(--landing-line)" }}
          >
            <span className="landing-note">
              {companyIdentity.legalName ?? "Razão social a definir"} · CNPJ{" "}
              {companyIdentity.cnpj}
            </span>
            <span className="landing-note">
              {companyIdentity.address ?? "Endereço a definir"}
            </span>
            <nav className="mt-2 flex flex-wrap gap-5">
              {legalDocumentList.map((item) => (
                <Link key={item.id} href={item.path} className="landing-link">
                  {item.title}
                </Link>
              ))}
              <Link href="/contato" className="landing-link">
                Contato
              </Link>
            </nav>
          </div>
        </div>
      </section>
    </main>
  );
}
