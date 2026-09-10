import platformSchemaMigration from "./0001-platform-schema.mjs";
import configuracoesEConsentimentosMigration from "./0002-configuracoes-e-consentimentos.mjs";
import versaoBillingSubscriptionsMigration from "./0003-versao-billing-subscriptions.mjs";

export const platformMigrations = [
  platformSchemaMigration,
  configuracoesEConsentimentosMigration,
  versaoBillingSubscriptionsMigration,
];
