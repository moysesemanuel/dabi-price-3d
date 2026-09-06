import "server-only";

import {
  companyIdentityFallback,
  mergeCompanyIdentity,
  type CompanyIdentity,
} from "@/lib/legal/company";
import {
  isPlatformPersistenceAvailable,
  readCompanyIdentityOverrides,
} from "@/lib/server/platform";

/**
 * Identidade vigente da empresa.
 *
 * Sem banco, ou com o banco indisponivel, cai no valor do codigo: pagina legal
 * fora do ar por falha de leitura seria pior do que mostrar o valor anterior.
 */
export async function getCompanyIdentity(): Promise<CompanyIdentity> {
  if (!isPlatformPersistenceAvailable()) {
    return { ...companyIdentityFallback };
  }

  try {
    return mergeCompanyIdentity(await readCompanyIdentityOverrides());
  } catch {
    return { ...companyIdentityFallback };
  }
}
