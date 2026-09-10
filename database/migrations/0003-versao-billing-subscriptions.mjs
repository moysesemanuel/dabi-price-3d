import { migrationChecksum } from "./checksum.mjs";

/**
 * `billing_subscriptions` ganha uma coluna de versão para permitir optimistic
 * concurrency em escritas de campos diferentes da mesma assinatura — hoje é
 * last-write-wins fora da transição de status (`expectedStatus`).
 *
 * Aditiva e com `DEFAULT`: código antigo, que ainda não lê a coluna, continua
 * funcionando sem alteração. Desenhada em
 * `docs/architecture/W2_CONCORRENCIA_DESIGN.md`, Parte 2.
 */
const versaoBillingSubscriptionsMigration = {
  id: "0003-versao-billing-subscriptions",
  checksum: migrationChecksum(import.meta.url),
  async up(sql) {
    await sql`
      ALTER TABLE billing_subscriptions
        ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1
    `;
  },
};

export default versaoBillingSubscriptionsMigration;
