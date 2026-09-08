import { migrationChecksum } from "./checksum.mjs";

/**
 * Tabelas criadas depois da foto que originou a `0001`, entre 03 e 06/09/2026:
 *
 * - `platform_settings` e `platform_setting_changes`: identidade da empresa
 *   editavel no admin, com trilha de alteracao (PR #66);
 * - `user_consents`: aceite de Termos e Privacidade no cadastro (PR #66).
 *
 * Sem esta migracao, um banco criado apenas pelo runner ficaria sem elas, e o
 * cadastro quebraria no momento de gravar o aceite.
 */
const configuracoesEConsentimentosMigration = {
  id: "0002-configuracoes-e-consentimentos",
  checksum: migrationChecksum(import.meta.url),
  async up(sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS platform_setting_changes (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        changes JSONB NOT NULL,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        changed_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
        changed_by_email TEXT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_consents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        document TEXT NOT NULL,
        version TEXT NOT NULL,
        accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address TEXT NULL,
        user_agent TEXT NULL
      )
    `;
  },
};

export default configuracoesEConsentimentosMigration;
