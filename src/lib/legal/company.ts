/**
 * Identidade da empresa, num lugar so.
 *
 * O Decreto 7.962/2013, art. 2, I e II, exige que o site de comercio
 * eletronico apresente em local de facil visualizacao o nome empresarial, o
 * CNPJ e o endereco fisico e eletronico. Como esses dados aparecem nos Termos,
 * na Politica e no rodape, eles vivem aqui e nao espalhados pelas paginas.
 */
export type CompanyIdentity = {
  tradeName: string;
  /** Razao social como consta na Receita. */
  legalName: string | null;
  cnpj: string;
  /** Endereco fisico completo — exigido pelo Decreto 7.962/2013. */
  address: string | null;
  /** Canal de contato com o titular dos dados (LGPD). */
  privacyEmail: string | null;
  /** Encarregado. Pequeno porte e dispensado de indicar; o canal acima nao. */
  dataProtectionOfficer: string | null;
  supportEmail: string | null;
};

export const companyIdentity: CompanyIdentity = {
  tradeName: "dabi price",
  legalName: "57.936.721 Moyses Emanuel Costa Silva",
  cnpj: "57.936.721/0001-25",
  address: "Rua Frederico Maurer — Boqueirão, Curitiba/PR, CEP 81670-020",
  privacyEmail: "moyses.dpo@outlook.com",
  dataProtectionOfficer: "Moyses Emanuel Costa Silva",
  supportEmail: null,
};

/** Campos sem os quais as paginas legais ficam irregulares. */
export const requiredCompanyFields = [
  "legalName",
  "address",
  "privacyEmail",
] as const satisfies ReadonlyArray<keyof CompanyIdentity>;

const fieldLabels: Record<(typeof requiredCompanyFields)[number], string> = {
  legalName: "razão social",
  address: "endereço",
  privacyEmail: "e-mail de privacidade",
};

/** Rotulos em portugues: este texto aparece em pagina publica. */
export function missingCompanyFields(): string[] {
  return requiredCompanyFields
    .filter((field) => !companyIdentity[field])
    .map((field) => fieldLabels[field]);
}

export function isCompanyIdentityComplete(): boolean {
  return missingCompanyFields().length === 0;
}
