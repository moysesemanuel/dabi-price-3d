import { randomUUID } from "node:crypto";

const bootstrapPrices = [
  { planId: "starter", billingCycle: "monthly", amountCents: 4900 },
  { planId: "starter", billingCycle: "annual", amountCents: 49000 },
  { planId: "growth", billingCycle: "monthly", amountCents: 7900 },
  { planId: "growth", billingCycle: "annual", amountCents: 79900 },
];

const platformSchemaMigration = {
  id: "0001-platform-schema",
  checksum: "8cfb83d7e5f024ce799df0c18148eab9d5c2b55d5f90d7e70d20ab780ce9d7fe",
  async up(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      platform_role TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_mode TEXT NOT NULL DEFAULT '3d',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workspace_memberships (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_role TEXT NOT NULL,
      invited_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workspace_preferences (
      workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      updated_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS calculation_snapshots (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      saved_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS calculation_snapshots_workspace_saved_at_idx
    ON calculation_snapshots (workspace_id, saved_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workspace_audit_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      tone TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_sessions_token_hash_idx
    ON user_sessions (token_hash)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
    ON password_reset_tokens (user_id, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS meli_oauth_tokens (
      workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      user_id TEXT NOT NULL,
      scope TEXT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS billing_prices (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      billing_cycle TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      active_from TIMESTAMPTZ NOT NULL,
      active_until TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS billing_prices_plan_cycle_active_from_idx
    ON billing_prices (plan_id, billing_cycle, active_from DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS billing_subscriptions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL,
      billing_cycle TEXT NOT NULL,
      price_id TEXT NULL REFERENCES billing_prices(id) ON DELETE SET NULL,
      status TEXT NOT NULL,
      auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
      current_period_start TIMESTAMPTZ NULL,
      current_period_end TIMESTAMPTZ NULL,
      grace_period_ends_at TIMESTAMPTZ NULL,
      cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
      cancel_requested_at TIMESTAMPTZ NULL,
      ended_at TIMESTAMPTZ NULL,
      access_until TIMESTAMPTZ NULL,
      provider TEXT NULL,
      provider_subscription_id TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS billing_subscriptions_workspace_created_at_idx
    ON billing_subscriptions (workspace_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS billing_subscriptions_workspace_status_idx
    ON billing_subscriptions (workspace_id, status, created_at DESC)
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS billing_subscriptions_provider_subscription_idx
    ON billing_subscriptions (provider, provider_subscription_id)
    WHERE provider_subscription_id IS NOT NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS billing_invoices (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      price_id TEXT NULL REFERENCES billing_prices(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      period_start TIMESTAMPTZ NULL,
      period_end TIMESTAMPTZ NULL,
      payment_method TEXT NULL,
      provider TEXT NULL,
      provider_payment_id TEXT NULL,
      provider_authorized_payment_id TEXT NULL,
      payment_expires_at TIMESTAMPTZ NULL,
      paid_at TIMESTAMPTZ NULL,
      failed_at TIMESTAMPTZ NULL,
      refunded_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS billing_invoices_subscription_created_at_idx
    ON billing_invoices (subscription_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS billing_invoices_workspace_status_idx
    ON billing_invoices (workspace_id, status, created_at DESC)
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_provider_payment_idx
    ON billing_invoices (provider, provider_payment_id)
    WHERE provider_payment_id IS NOT NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS billing_invoice_effect_claims (
      invoice_id TEXT PRIMARY KEY REFERENCES billing_invoices(id) ON DELETE CASCADE,
      claim_token TEXT NULL,
      claim_expires_at TIMESTAMPTZ NULL,
      completed_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS billing_invoice_effect_claims_recovery_idx
    ON billing_invoice_effect_claims (completed_at, claim_expires_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS billing_subscription_operation_claims (
      subscription_id TEXT PRIMARY KEY REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
      claim_token TEXT NULL,
      claim_expires_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS billing_subscription_operation_claims_recovery_idx
    ON billing_subscription_operation_claims (claim_expires_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS billing_subscription_changes (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      from_plan_id TEXT NULL,
      to_plan_id TEXT NULL,
      from_billing_cycle TEXT NULL,
      to_billing_cycle TEXT NULL,
      effective_at TIMESTAMPTZ NOT NULL,
      credit_amount_cents INTEGER NOT NULL DEFAULT 0,
      charge_amount_cents INTEGER NOT NULL DEFAULT 0,
      invoice_id TEXT NULL REFERENCES billing_invoices(id) ON DELETE SET NULL,
      requested_by_type TEXT NULL,
      requested_by_id TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      applied_at TIMESTAMPTZ NULL,
      canceled_at TIMESTAMPTZ NULL
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS billing_subscription_changes_subscription_idx
    ON billing_subscription_changes (subscription_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS billing_subscription_changes_workspace_status_idx
    ON billing_subscription_changes (workspace_id, status, effective_at ASC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS billing_payment_methods (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NULL,
      provider_payment_method_id TEXT NULL,
      provider_customer_id TEXT NULL,
      provider_mandate_id TEXT NULL,
      label TEXT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS billing_payment_methods_workspace_idx
    ON billing_payment_methods (workspace_id, is_active DESC, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS billing_webhook_events (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      provider_event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      resource_id TEXT NULL,
      payload_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ NULL,
      error_code TEXT NULL,
      error_message TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (provider, provider_event_id, event_type)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS billing_webhook_events_status_received_at_idx
    ON billing_webhook_events (status, received_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS billing_audit_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NULL REFERENCES workspaces(id) ON DELETE SET NULL,
      subscription_id TEXT NULL REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
      invoice_id TEXT NULL REFERENCES billing_invoices(id) ON DELETE SET NULL,
      actor_type TEXT NOT NULL,
      actor_id TEXT NULL,
      action TEXT NOT NULL,
      metadata JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS billing_audit_events_workspace_created_at_idx
    ON billing_audit_events (workspace_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS billing_audit_events_subscription_created_at_idx
    ON billing_audit_events (subscription_id, created_at DESC)
  `;
    for (const price of bootstrapPrices) {
      const existingRows = await sql`
        SELECT id
        FROM billing_prices
        WHERE plan_id = ${price.planId}
          AND billing_cycle = ${price.billingCycle}
          AND currency = 'BRL'
          AND active_until IS NULL
        ORDER BY active_from DESC
        LIMIT 1
      `;

      if (existingRows[0]) continue;

      await sql`
        INSERT INTO billing_prices (
          id, plan_id, billing_cycle, amount_cents, currency, active_from, active_until, created_at, updated_at
        ) VALUES (
          ${randomUUID()}, ${price.planId}, ${price.billingCycle}, ${price.amountCents}, 'BRL', NOW(), NULL, NOW(), NOW()
        )
      `;
    }
  },
};

export default platformSchemaMigration;
