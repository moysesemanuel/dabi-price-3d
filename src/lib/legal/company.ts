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

/**
 * Valores de partida, usados enquanto o banco nao tiver registro proprio.
 *
 * A identidade e editavel em /admin/sistema. Ela e dado vivo, e nao parte
 * versionada dos documentos: corrigir endereco ou e-mail do controlador e
 * atualizacao factual, nao mudanca de termos, e por isso nao pede novo aceite.
 * O que a torna defensavel e a trilha de auditoria de cada alteracao.
 */
export const companyIdentityFallback: CompanyIdentity = {
  tradeName: "dabi price",
  legalName: "57.936.721 Moyses Emanuel Costa Silva",
  cnpj: "57.936.721/0001-25",
  address: "Rua Frederico Maurer — Boqueirão, Curitiba/PR, CEP 81670-020",
  privacyEmail: "moyses.dpo@outlook.com",
  dataProtectionOfficer: "Moyses Emanuel Costa Silva",
  supportEmail: null,
};

/** Campos sem os quais as paginas legais ficam irregulares. */
/** @deprecated Use getCompanyIdentity(); existe para leitura sincrona em teste. */
export const companyIdentity = companyIdentityFallback;

export type CompanyIdentityOverrides = Partial<
  Record<keyof CompanyIdentity, string>
>;

/** O banco sobrescreve campo a campo; o que nao vier fica como esta. */
export function mergeCompanyIdentity(
  overrides: CompanyIdentityOverrides | null | undefined,
): CompanyIdentity {
  if (!overrides) {
    return { ...companyIdentityFallback };
  }

  const merged = { ...companyIdentityFallback };

  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "string" && value.trim().length > 0) {
      merged[key as keyof CompanyIdentity] = value.trim();
    }
  }

  return merged;
}

/**
 * Campo em branco no formulario e ignorado, nao apagado.
 *
 * Salvar sem preencher um campo obrigatorio deixaria as paginas legais
 * irregulares sem ninguem perceber; para limpar de proposito, o campo sai
 * daqui e volta ao valor de partida.
 */
export function sanitizeCompanyIdentityInput(
  input: Record<string, unknown>,
): CompanyIdentityOverrides {
  const clean: CompanyIdentityOverrides = {};

  for (const key of Object.keys(companyIdentityFallback) as Array<
    keyof CompanyIdentity
  >) {
    const value = input[key];

    if (typeof value === "string" && value.trim().length > 0) {
      clean[key] = value.trim();
    }
  }

  return clean;
}

export type CompanyIdentityDiff = Record<
  string,
  { from: string | null; to: string | null }
>;

/** O que mudou, para a trilha de auditoria. */
export function diffCompanyIdentity(
  before: CompanyIdentity,
  after: CompanyIdentity,
): CompanyIdentityDiff {
  const changes: CompanyIdentityDiff = {};

  for (const key of Object.keys(companyIdentityFallback) as Array<
    keyof CompanyIdentity
  >) {
    if (before[key] !== after[key]) {
      changes[key] = { from: before[key], to: after[key] };
    }
  }

  return changes;
}

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
export function missingCompanyFields(
  identity: CompanyIdentity = companyIdentityFallback,
): string[] {
  return requiredCompanyFields
    .filter((field) => !identity[field])
    .map((field) => fieldLabels[field]);
}

export function isCompanyIdentityComplete(
  identity: CompanyIdentity = companyIdentityFallback,
): boolean {
  return missingCompanyFields(identity).length === 0;
}
