/**
 * Registro dos documentos legais.
 *
 * A versao e uma data e importa mais do que parece: o que se prova num
 * questionamento nao e "a pessoa aceitou", e "a pessoa aceitou ESTE texto".
 * Ao mudar o conteudo de um documento, suba a versao — o aceite antigo
 * continua valendo para o texto antigo, e o novo passa a ser pedido.
 */
export type LegalDocumentId = "terms" | "privacy";

export type LegalDocument = {
  id: LegalDocumentId;
  title: string;
  shortTitle: string;
  path: string;
  /** Data ISO. Mudou o texto, muda aqui. */
  version: string;
};

export const legalDocuments: Record<LegalDocumentId, LegalDocument> = {
  terms: {
    id: "terms",
    title: "Termos de Uso",
    shortTitle: "Termos",
    path: "/termos",
    version: "2026-09-06",
  },
  privacy: {
    id: "privacy",
    title: "Política de Privacidade",
    shortTitle: "Privacidade",
    path: "/privacidade",
    version: "2026-09-06",
  },
};

export function getLegalDocument(id: LegalDocumentId): LegalDocument {
  return legalDocuments[id];
}

export const legalDocumentList: LegalDocument[] = Object.values(legalDocuments);

/** O par de versoes gravado a cada aceite. */
export const currentConsentVersions: Record<LegalDocumentId, string> = {
  terms: legalDocuments.terms.version,
  privacy: legalDocuments.privacy.version,
};

export function formatLegalDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}
