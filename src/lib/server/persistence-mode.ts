import "server-only";

import { hasDatabaseUrl } from "@/lib/server/neon";

export type PersistenceMode = "database" | "local";

export function getPersistenceMode(): PersistenceMode {
  return hasDatabaseUrl() ? "database" : "local";
}

export function getPersistenceModeMeta(mode = getPersistenceMode()) {
  if (mode === "database") {
    return {
      mode,
      label: "Persistencia ativa",
      shortLabel: "Banco ativo",
      description:
        "Usuarios, sessoes e dados do workspace usam persistencia compartilhada.",
    };
  }

  return {
    mode,
    label: "Modo local",
    shortLabel: "Fallback local",
    description:
      "Este ambiente usa fallback de desenvolvimento sem DATABASE_URL. Os dados nao sao compartilhados entre maquinas.",
  };
}
