import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { closeNeonPostgresShim } from "./support/neon-postgres-shim.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required. Use an isolated PostgreSQL database; never use DATABASE_URL from production.",
  );
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDatabaseUrl;

const [repositoryModule, platformModule] = await Promise.all([
  import("../src/lib/billing/repository.ts"),
  import("../src/lib/server/platform.ts"),
]);
const { ensurePlatformReady } = platformModule;

const {
  createBillingSubscription,
  getBillingSubscriptionById,
  updateBillingSubscription,
  findCurrentBillingSubscriptionForWorkspace,
  createBillingInvoice,
  getBillingInvoiceById,
  updateBillingInvoice,
  transitionPendingBillingInvoice,
  claimBillingInvoiceEffect,
  completeBillingInvoiceEffect,
  releaseBillingInvoiceEffectClaim,
  claimBillingSubscriptionOperation,
  releaseBillingSubscriptionOperationClaim,
  listBillingSubscriptionsForExpiration,
  listBillingSubscriptionsForGracePeriodEnd,
  listBillingSubscriptionsForScheduledCancellation,
  listBillingSubscriptionsForProviderReconciliation,
  findBillingSubscriptionByProviderSubscriptionId,
  listAbandonedPendingBillingSubscriptions,
  createBillingPrice,
  findActiveBillingPrice,
  getBillingPriceById,
  listActiveBillingPrices,
  findLatestPendingBillingInvoiceForSubscription,
  findBillingInvoiceByProviderPaymentId,
  findBillingInvoiceByProviderAuthorizedPaymentId,
  listBillingInvoicesForExpiration,
  listBillingInvoicesForProviderReconciliation,
  getDueBillingSubscriptionChanges,
  getBillingSubscriptionChangeById,
  getBillingSubscriptionChangeByInvoiceId,
  createBillingSubscriptionChange,
  findLatestOpenBillingSubscriptionChange,
  updateBillingSubscriptionChange,
  appendBillingAuditEvent,
  createBillingWebhookEvent,
  updateBillingWebhookEventStatus,
  claimBillingWebhookEventProcessing,
  listFailedBillingWebhookEvents,
} = repositoryModule;

const controlSql = postgres(testDatabaseUrl, { idle_timeout: 1, max: 4 });

// Timestamp columns can come back as a JS Date or as a Postgres/ISO string
// depending on the driver (this differs between the postgres.js-backed
// integration shim and the real @neondatabase/serverless HTTP driver used
// in production). Compare the underlying instant instead of the exact
// string representation, matching how application code consumes these
// fields (e.g. via Date.parse in src/lib/billing/cycle-change-management.ts).
function assertSameInstant(actual, expected, message) {
  assert.equal(new Date(actual).getTime(), new Date(expected).getTime(), message);
}

function isoOffset(deltaMs) {
  return new Date(Date.now() + deltaMs).toISOString();
}

async function createWorkspace(prefix) {
  const suffix = randomUUID();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const email = `${prefix}-owner-${suffix}@example.test`;

  await controlSql`
    INSERT INTO users (
      id, email, password_hash, full_name, platform_role, status, created_at, updated_at
    )
    VALUES (
      ${userId},
      ${email},
      'test-hash',
      'Integration Test Owner',
      'user',
      'active',
      NOW(),
      NOW()
    )
  `;
  await controlSql`
    INSERT INTO workspaces (
      id, name, slug, owner_user_id, business_mode, status, created_at, updated_at
    )
    VALUES (
      ${workspaceId},
      ${`${prefix}-${suffix}`},
      ${`${prefix}-${suffix}`},
      ${userId},
      '3d',
      'active',
      NOW(),
      NOW()
    )
  `;

  return { userId, workspaceId };
}

async function cleanupWorkspace(workspace) {
  await controlSql`DELETE FROM workspaces WHERE id = ${workspace.workspaceId}`;
  await controlSql`DELETE FROM users WHERE id = ${workspace.userId}`;
}

async function createActiveSubscriptionFixture(workspaceId, overrides = {}) {
  return createBillingSubscription({
    workspaceId,
    planId: "growth",
    billingCycle: "monthly",
    status: "active",
    provider: "mercado_pago",
    providerSubscriptionId: `mp-${randomUUID()}`,
    ...overrides,
  });
}

async function createPendingInvoiceFixture(subscription, overrides = {}) {
  return createBillingInvoice({
    subscriptionId: subscription.id,
    workspaceId: subscription.workspaceId,
    type: "renewal",
    status: "pending",
    amountCents: 14900,
    provider: "mercado_pago",
    providerPaymentId: `pay-${randomUUID()}`,
    ...overrides,
  });
}

test.before(async () => {
  await ensurePlatformReady();
});

test.after(async () => {
  await controlSql.end({ timeout: 1 });
  await closeNeonPostgresShim();
});

test("createBillingSubscription persiste e getBillingSubscriptionById devolve com o mapeamento correto", async () => {
  const workspace = await createWorkspace("sub-crud");
  try {
    const created = await createBillingSubscription({
      workspaceId: workspace.workspaceId,
      planId: "growth",
      billingCycle: "monthly",
      priceId: null,
      status: "pending",
      autoRenew: true,
      provider: "mercado_pago",
      providerSubscriptionId: `mp-${randomUUID()}`,
    });

    assert.ok(created);
    assert.equal(created.workspaceId, workspace.workspaceId);
    assert.equal(created.planId, "growth");
    assert.equal(created.billingCycle, "monthly");
    assert.equal(created.status, "pending");
    assert.equal(created.autoRenew, true);
    assert.equal(created.cancelAtPeriodEnd, false);
    assert.equal(created.priceId, null);
    assert.equal(created.currentPeriodStart, null);

    const fetched = await getBillingSubscriptionById(created.id);
    assert.deepEqual(fetched, created);

    const missing = await getBillingSubscriptionById(randomUUID());
    assert.equal(missing, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("updateBillingSubscription aplica patch parcial e mantem os campos nao informados", async () => {
  const workspace = await createWorkspace("sub-update");
  try {
    const created = await createBillingSubscription({
      workspaceId: workspace.workspaceId,
      planId: "starter",
      billingCycle: "monthly",
      status: "pending",
      autoRenew: false,
      provider: "mercado_pago",
      providerSubscriptionId: `mp-${randomUUID()}`,
    });

    const updated = await updateBillingSubscription(created.id, {
      status: "active",
      currentPeriodStart: "2026-08-01T00:00:00.000Z",
      currentPeriodEnd: "2026-09-01T00:00:00.000Z",
    });

    assert.ok(updated);
    assert.equal(updated.status, "active");
    assertSameInstant(updated.currentPeriodStart, "2026-08-01T00:00:00.000Z");
    assertSameInstant(updated.currentPeriodEnd, "2026-09-01T00:00:00.000Z");
    assert.equal(updated.planId, "starter");
    assert.equal(updated.billingCycle, "monthly");
    assert.equal(updated.autoRenew, false);
    assert.equal(updated.provider, "mercado_pago");
    assert.equal(updated.providerSubscriptionId, created.providerSubscriptionId);

    const missing = await updateBillingSubscription(randomUUID(), { status: "active" });
    assert.equal(missing, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("findCurrentBillingSubscriptionForWorkspace retorna a mais recente quando ha mais de uma elegivel", async () => {
  const workspace = await createWorkspace("sub-current");
  try {
    await createActiveSubscriptionFixture(workspace.workspaceId, { status: "pending" });
    const second = await createActiveSubscriptionFixture(workspace.workspaceId, { status: "active" });

    const current = await findCurrentBillingSubscriptionForWorkspace(workspace.workspaceId);
    assert.ok(current);
    assert.equal(current.id, second.id);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("findCurrentBillingSubscriptionForWorkspace ignora assinatura cancelada sem acesso futuro", async () => {
  const workspace = await createWorkspace("sub-ignored");
  try {
    await createActiveSubscriptionFixture(workspace.workspaceId, { status: "canceled" });

    const current = await findCurrentBillingSubscriptionForWorkspace(workspace.workspaceId);
    assert.equal(current, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("findCurrentBillingSubscriptionForWorkspace ainda retorna assinatura cancelada com acesso futuro", async () => {
  const workspace = await createWorkspace("sub-grace");
  try {
    const futureAccessUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const canceledWithAccess = await createActiveSubscriptionFixture(workspace.workspaceId, {
      status: "canceled",
      accessUntil: futureAccessUntil,
    });

    const current = await findCurrentBillingSubscriptionForWorkspace(workspace.workspaceId);
    assert.ok(current);
    assert.equal(current.id, canceledWithAccess.id);
    assert.equal(current.status, "canceled");
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("createBillingInvoice persiste e getBillingInvoiceById devolve com o mapeamento correto", async () => {
  const workspace = await createWorkspace("inv-crud");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);
    const created = await createPendingInvoiceFixture(subscription, {
      paymentMethod: "pix_automatic",
    });

    assert.ok(created);
    assert.equal(created.subscriptionId, subscription.id);
    assert.equal(created.workspaceId, workspace.workspaceId);
    assert.equal(created.type, "renewal");
    assert.equal(created.status, "pending");
    assert.equal(created.amountCents, 14900);
    assert.equal(created.currency, "BRL");
    assert.equal(created.paymentMethod, "pix_automatic");
    assert.equal(created.paidAt, null);

    const fetched = await getBillingInvoiceById(created.id);
    assert.deepEqual(fetched, created);

    const missing = await getBillingInvoiceById(randomUUID());
    assert.equal(missing, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("transitionPendingBillingInvoice aplica a mudanca apenas enquanto a invoice esta pending", async () => {
  const workspace = await createWorkspace("inv-transition");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);
    const invoice = await createPendingInvoiceFixture(subscription);

    const firstTransition = await transitionPendingBillingInvoice(invoice.id, {
      status: "paid",
      paidAt: "2026-08-20T12:00:00.000Z",
    });

    assert.ok(firstTransition);
    assert.equal(firstTransition.status, "paid");
    assertSameInstant(firstTransition.paidAt, "2026-08-20T12:00:00.000Z");

    const secondTransition = await transitionPendingBillingInvoice(invoice.id, {
      status: "failed",
    });

    assert.equal(secondTransition, null);

    const finalState = await getBillingInvoiceById(invoice.id);
    assert.equal(finalState.status, "paid");
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("updateBillingInvoice atualiza independente do status atual", async () => {
  const workspace = await createWorkspace("inv-update-any");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);
    const invoice = await createPendingInvoiceFixture(subscription, { status: "paid" });

    const updated = await updateBillingInvoice(invoice.id, { status: "refunded" });
    assert.ok(updated);
    assert.equal(updated.status, "refunded");
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("claimBillingInvoiceEffect emite um token e bloqueia uma segunda tentativa concorrente", async () => {
  const workspace = await createWorkspace("claim-invoice");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);
    const invoice = await createPendingInvoiceFixture(subscription, { status: "paid" });

    const firstToken = await claimBillingInvoiceEffect(invoice.id);
    assert.ok(firstToken);

    const secondToken = await claimBillingInvoiceEffect(invoice.id);
    assert.equal(secondToken, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("completeBillingInvoiceEffect so conclui com o token correto e nao pode ser reaplicado", async () => {
  const workspace = await createWorkspace("complete-invoice");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);
    const invoice = await createPendingInvoiceFixture(subscription, { status: "paid" });

    const token = await claimBillingInvoiceEffect(invoice.id);
    assert.ok(token);

    const completedWithWrongToken = await completeBillingInvoiceEffect({
      invoiceId: invoice.id,
      claimToken: "token-errado",
    });
    assert.equal(completedWithWrongToken, false);

    const completed = await completeBillingInvoiceEffect({
      invoiceId: invoice.id,
      claimToken: token,
    });
    assert.equal(completed, true);

    const claimAfterCompletion = await claimBillingInvoiceEffect(invoice.id);
    assert.equal(claimAfterCompletion, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("releaseBillingInvoiceEffectClaim libera o claim para uma nova tentativa", async () => {
  const workspace = await createWorkspace("release-invoice");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);
    const invoice = await createPendingInvoiceFixture(subscription, { status: "paid" });

    const token = await claimBillingInvoiceEffect(invoice.id);
    assert.ok(token);

    const releasedWithWrongToken = await releaseBillingInvoiceEffectClaim({
      invoiceId: invoice.id,
      claimToken: "token-errado",
    });
    assert.equal(releasedWithWrongToken, false);

    const released = await releaseBillingInvoiceEffectClaim({
      invoiceId: invoice.id,
      claimToken: token,
    });
    assert.equal(released, true);

    const newToken = await claimBillingInvoiceEffect(invoice.id);
    assert.ok(newToken);
    assert.notEqual(newToken, token);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("claimBillingSubscriptionOperation emite token e bloqueia uma segunda tentativa concorrente", async () => {
  const workspace = await createWorkspace("claim-subscription");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);

    const firstToken = await claimBillingSubscriptionOperation(subscription.id);
    assert.ok(firstToken);

    const secondToken = await claimBillingSubscriptionOperation(subscription.id);
    assert.equal(secondToken, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("releaseBillingSubscriptionOperationClaim libera o claim para uma nova tentativa", async () => {
  const workspace = await createWorkspace("release-subscription");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);

    const token = await claimBillingSubscriptionOperation(subscription.id);
    assert.ok(token);

    const releasedWithWrongToken = await releaseBillingSubscriptionOperationClaim({
      subscriptionId: subscription.id,
      claimToken: "token-errado",
    });
    assert.equal(releasedWithWrongToken, false);

    const released = await releaseBillingSubscriptionOperationClaim({
      subscriptionId: subscription.id,
      claimToken: token,
    });
    assert.equal(released, true);

    const newToken = await claimBillingSubscriptionOperation(subscription.id);
    assert.ok(newToken);
    assert.notEqual(newToken, token);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("listBillingSubscriptionsForExpiration retorna apenas ativas sem auto-renovacao com periodo ja vencido", async () => {
  const workspace = await createWorkspace("sub-expiration");
  try {
    const due = await createActiveSubscriptionFixture(workspace.workspaceId, {
      autoRenew: false,
      currentPeriodEnd: isoOffset(-60_000),
    });
    await createActiveSubscriptionFixture(workspace.workspaceId, {
      autoRenew: true,
      currentPeriodEnd: isoOffset(-60_000),
      providerSubscriptionId: `mp-${randomUUID()}`,
    });
    await createActiveSubscriptionFixture(workspace.workspaceId, {
      autoRenew: false,
      currentPeriodEnd: isoOffset(60_000),
      providerSubscriptionId: `mp-${randomUUID()}`,
    });

    const results = await listBillingSubscriptionsForExpiration(isoOffset(0));
    const mine = results.filter((r) => r.workspaceId === workspace.workspaceId);

    assert.deepEqual(mine.map((r) => r.id), [due.id]);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("listBillingSubscriptionsForGracePeriodEnd retorna apenas past_due com fim de carencia vencido", async () => {
  const workspace = await createWorkspace("sub-grace");
  try {
    const due = await createActiveSubscriptionFixture(workspace.workspaceId, {
      status: "past_due",
      gracePeriodEndsAt: isoOffset(-60_000),
    });
    await createActiveSubscriptionFixture(workspace.workspaceId, {
      status: "active",
      gracePeriodEndsAt: isoOffset(-60_000),
      providerSubscriptionId: `mp-${randomUUID()}`,
    });
    await createActiveSubscriptionFixture(workspace.workspaceId, {
      status: "past_due",
      gracePeriodEndsAt: isoOffset(60_000),
      providerSubscriptionId: `mp-${randomUUID()}`,
    });

    const results = await listBillingSubscriptionsForGracePeriodEnd(isoOffset(0));
    const mine = results.filter((r) => r.workspaceId === workspace.workspaceId);

    assert.deepEqual(mine.map((r) => r.id), [due.id]);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("listBillingSubscriptionsForScheduledCancellation retorna apenas scheduled_cancel com periodo ja vencido", async () => {
  const workspace = await createWorkspace("sub-scheduled-cancel");
  try {
    const due = await createActiveSubscriptionFixture(workspace.workspaceId, {
      status: "scheduled_cancel",
      currentPeriodEnd: isoOffset(-60_000),
    });
    await createActiveSubscriptionFixture(workspace.workspaceId, {
      status: "active",
      currentPeriodEnd: isoOffset(-60_000),
      providerSubscriptionId: `mp-${randomUUID()}`,
    });
    await createActiveSubscriptionFixture(workspace.workspaceId, {
      status: "scheduled_cancel",
      currentPeriodEnd: isoOffset(60_000),
      providerSubscriptionId: `mp-${randomUUID()}`,
    });

    const results = await listBillingSubscriptionsForScheduledCancellation(isoOffset(0));
    const mine = results.filter((r) => r.workspaceId === workspace.workspaceId);

    assert.deepEqual(mine.map((r) => r.id), [due.id]);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("listBillingSubscriptionsForProviderReconciliation inclui apenas status correntes com provider definido", async () => {
  const workspace = await createWorkspace("sub-reconciliation");
  try {
    const eligible = await createActiveSubscriptionFixture(workspace.workspaceId, {
      status: "active",
    });
    await createActiveSubscriptionFixture(workspace.workspaceId, {
      status: "canceled",
      providerSubscriptionId: `mp-${randomUUID()}`,
    });
    await createActiveSubscriptionFixture(workspace.workspaceId, {
      status: "active",
      provider: null,
      providerSubscriptionId: null,
    });

    const results = await listBillingSubscriptionsForProviderReconciliation(1000);
    const mine = results.filter((r) => r.workspaceId === workspace.workspaceId);

    assert.deepEqual(mine.map((r) => r.id), [eligible.id]);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("findBillingSubscriptionByProviderSubscriptionId encontra por provider e id, e retorna null quando nao existe", async () => {
  const workspace = await createWorkspace("sub-find-provider");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);

    const found = await findBillingSubscriptionByProviderSubscriptionId({
      provider: "mercado_pago",
      providerSubscriptionId: subscription.providerSubscriptionId,
    });
    assert.equal(found?.id, subscription.id);

    const notFound = await findBillingSubscriptionByProviderSubscriptionId({
      provider: "mercado_pago",
      providerSubscriptionId: `mp-${randomUUID()}`,
    });
    assert.equal(notFound, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("listAbandonedPendingBillingSubscriptions ignora assinaturas com invoice pendente ainda valida", async () => {
  const workspace = await createWorkspace("sub-abandoned");
  try {
    const startedBefore = isoOffset(60_000);

    const abandoned = await createBillingSubscription({
      workspaceId: workspace.workspaceId,
      planId: "starter",
      billingCycle: "monthly",
      status: "pending",
      provider: "mercado_pago",
      providerSubscriptionId: `mp-${randomUUID()}`,
    });

    const withExpiredInvoice = await createBillingSubscription({
      workspaceId: workspace.workspaceId,
      planId: "starter",
      billingCycle: "monthly",
      status: "pending",
      provider: "mercado_pago",
      providerSubscriptionId: `mp-${randomUUID()}`,
    });
    await createBillingInvoice({
      subscriptionId: withExpiredInvoice.id,
      workspaceId: workspace.workspaceId,
      type: "subscription",
      status: "pending",
      amountCents: 9900,
      paymentMethod: "pix_manual",
      paymentExpiresAt: isoOffset(-60_000),
    });

    const withOpenInvoice = await createBillingSubscription({
      workspaceId: workspace.workspaceId,
      planId: "starter",
      billingCycle: "monthly",
      status: "pending",
      provider: "mercado_pago",
      providerSubscriptionId: `mp-${randomUUID()}`,
    });
    await createBillingInvoice({
      subscriptionId: withOpenInvoice.id,
      workspaceId: workspace.workspaceId,
      type: "subscription",
      status: "pending",
      amountCents: 9900,
      paymentMethod: "pix_manual",
      paymentExpiresAt: isoOffset(60_000),
    });

    const results = await listAbandonedPendingBillingSubscriptions({
      asOf: isoOffset(0),
      startedBefore,
    });
    const mineIds = results
      .filter((r) => r.workspaceId === workspace.workspaceId)
      .map((r) => r.id)
      .sort();

    assert.deepEqual(mineIds, [abandoned.id, withExpiredInvoice.id].sort());
    assert.ok(!mineIds.includes(withOpenInvoice.id));
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("createBillingPrice persiste e getBillingPriceById devolve com o mapeamento correto", async () => {
  const price = await createBillingPrice({
    planId: "scale",
    billingCycle: "annual",
    amountCents: 199900,
    currency: "BRL",
    activeFrom: isoOffset(-60_000),
  });

  try {
    assert.ok(price);
    assert.equal(price.planId, "scale");
    assert.equal(price.billingCycle, "annual");
    assert.equal(price.amountCents, 199900);
    assert.equal(price.currency, "BRL");
    assert.equal(price.activeUntil, null);

    const fetched = await getBillingPriceById(price.id);
    assert.equal(fetched?.id, price.id);
    assert.equal(fetched?.amountCents, 199900);

    const missing = await getBillingPriceById(randomUUID());
    assert.equal(missing, null);
  } finally {
    await controlSql`DELETE FROM billing_prices WHERE id = ${price.id}`;
  }
});

test("findActiveBillingPrice devolve o preco mais recente dentro da janela ativa e null fora dela", async () => {
  const older = await createBillingPrice({
    planId: "scale",
    billingCycle: "monthly",
    amountCents: 29900,
    activeFrom: isoOffset(-120_000),
    activeUntil: isoOffset(-60_000),
  });
  const current = await createBillingPrice({
    planId: "scale",
    billingCycle: "monthly",
    amountCents: 39900,
    activeFrom: isoOffset(-30_000),
  });

  try {
    const active = await findActiveBillingPrice({
      planId: "scale",
      billingCycle: "monthly",
      asOf: isoOffset(0),
    });
    assert.equal(active?.id, current.id);
    assert.equal(active?.amountCents, 39900);

    const beforeOlderStarted = await findActiveBillingPrice({
      planId: "scale",
      billingCycle: "monthly",
      asOf: isoOffset(-180_000),
    });
    assert.equal(beforeOlderStarted, null);
  } finally {
    await controlSql`DELETE FROM billing_prices WHERE id = ${older.id}`;
    await controlSql`DELETE FROM billing_prices WHERE id = ${current.id}`;
  }
});

test("listActiveBillingPrices inclui apenas precos com a janela ativa cobrindo a data informada", async () => {
  const active = await createBillingPrice({
    planId: "scale",
    billingCycle: "annual",
    amountCents: 149900,
    activeFrom: isoOffset(-60_000),
  });
  const expired = await createBillingPrice({
    planId: "scale",
    billingCycle: "annual",
    amountCents: 129900,
    activeFrom: isoOffset(-120_000),
    activeUntil: isoOffset(-90_000),
  });

  try {
    const results = await listActiveBillingPrices({ asOf: isoOffset(0) });
    const ids = results.map((r) => r.id);

    assert.ok(ids.includes(active.id));
    assert.ok(!ids.includes(expired.id));
  } finally {
    await controlSql`DELETE FROM billing_prices WHERE id = ${active.id}`;
    await controlSql`DELETE FROM billing_prices WHERE id = ${expired.id}`;
  }
});

test("findLatestPendingBillingInvoiceForSubscription filtra por paymentMethod e type e retorna a mais recente", async () => {
  const workspace = await createWorkspace("inv-find-latest-pending");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);

    const olderPixSubscription = await createPendingInvoiceFixture(subscription, {
      type: "subscription",
      paymentMethod: "pix_manual",
      providerPaymentId: `pay-${randomUUID()}`,
    });
    const newerPixSubscription = await createPendingInvoiceFixture(subscription, {
      type: "subscription",
      paymentMethod: "pix_manual",
      providerPaymentId: `pay-${randomUUID()}`,
    });
    const latestOverall = await createPendingInvoiceFixture(subscription, {
      type: "renewal",
      paymentMethod: "card",
      providerPaymentId: `pay-${randomUUID()}`,
    });

    const latest = await findLatestPendingBillingInvoiceForSubscription({
      subscriptionId: subscription.id,
      paymentMethod: "pix_manual",
      type: "subscription",
    });
    assert.equal(latest?.id, newerPixSubscription.id);
    assert.notEqual(latest?.id, olderPixSubscription.id);

    const anyPending = await findLatestPendingBillingInvoiceForSubscription({
      subscriptionId: subscription.id,
    });
    assert.equal(anyPending?.id, latestOverall.id);

    const noMatch = await findLatestPendingBillingInvoiceForSubscription({
      subscriptionId: subscription.id,
      paymentMethod: "boleto",
    });
    assert.equal(noMatch, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("findBillingInvoiceByProviderPaymentId encontra por provider e id, e retorna null quando nao existe", async () => {
  const workspace = await createWorkspace("inv-find-payment-id");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);
    const invoice = await createPendingInvoiceFixture(subscription);

    const found = await findBillingInvoiceByProviderPaymentId({
      provider: "mercado_pago",
      providerPaymentId: invoice.providerPaymentId,
    });
    assert.equal(found?.id, invoice.id);

    const notFound = await findBillingInvoiceByProviderPaymentId({
      provider: "mercado_pago",
      providerPaymentId: `pay-${randomUUID()}`,
    });
    assert.equal(notFound, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("findBillingInvoiceByProviderAuthorizedPaymentId encontra por provider e id, e retorna null quando nao existe", async () => {
  const workspace = await createWorkspace("inv-find-authorized-id");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);
    const authorizedPaymentId = `auth-${randomUUID()}`;
    const invoice = await createBillingInvoice({
      subscriptionId: subscription.id,
      workspaceId: workspace.workspaceId,
      type: "renewal",
      status: "pending",
      amountCents: 14900,
      provider: "mercado_pago",
      providerAuthorizedPaymentId: authorizedPaymentId,
    });

    const found = await findBillingInvoiceByProviderAuthorizedPaymentId({
      provider: "mercado_pago",
      providerAuthorizedPaymentId: authorizedPaymentId,
    });
    assert.equal(found?.id, invoice.id);

    const notFound = await findBillingInvoiceByProviderAuthorizedPaymentId({
      provider: "mercado_pago",
      providerAuthorizedPaymentId: `auth-${randomUUID()}`,
    });
    assert.equal(notFound, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("listBillingInvoicesForExpiration retorna apenas pendentes de pix manual com prazo vencido", async () => {
  const workspace = await createWorkspace("inv-expiration");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);

    const due = await createPendingInvoiceFixture(subscription, {
      paymentMethod: "pix_manual",
      paymentExpiresAt: isoOffset(-60_000),
      providerPaymentId: `pay-${randomUUID()}`,
    });
    await createPendingInvoiceFixture(subscription, {
      paymentMethod: "card",
      paymentExpiresAt: isoOffset(-60_000),
      providerPaymentId: `pay-${randomUUID()}`,
    });
    await createPendingInvoiceFixture(subscription, {
      paymentMethod: "pix_manual",
      paymentExpiresAt: isoOffset(60_000),
      providerPaymentId: `pay-${randomUUID()}`,
    });

    const results = await listBillingInvoicesForExpiration(isoOffset(0));
    const mine = results.filter((r) => r.subscriptionId === subscription.id);

    assert.deepEqual(mine.map((r) => r.id), [due.id]);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("listBillingInvoicesForProviderReconciliation inclui pendentes e pagas sem claim concluido", async () => {
  const workspace = await createWorkspace("inv-reconciliation");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);

    const pending = await createPendingInvoiceFixture(subscription, {
      providerPaymentId: `pay-${randomUUID()}`,
    });

    const paidWithoutClaim = await createPendingInvoiceFixture(subscription, {
      providerPaymentId: `pay-${randomUUID()}`,
    });
    await transitionPendingBillingInvoice(paidWithoutClaim.id, { status: "paid" });

    const paidWithCompletedClaim = await createPendingInvoiceFixture(subscription, {
      providerPaymentId: `pay-${randomUUID()}`,
    });
    await transitionPendingBillingInvoice(paidWithCompletedClaim.id, { status: "paid" });
    const claimToken = await claimBillingInvoiceEffect(paidWithCompletedClaim.id);
    await completeBillingInvoiceEffect({
      invoiceId: paidWithCompletedClaim.id,
      claimToken,
    });

    const results = await listBillingInvoicesForProviderReconciliation(1000);
    const mineIds = results
      .filter((r) => r.subscriptionId === subscription.id)
      .map((r) => r.id)
      .sort();

    assert.deepEqual(mineIds, [pending.id, paidWithoutClaim.id].sort());
    assert.ok(!mineIds.includes(paidWithCompletedClaim.id));
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("createBillingSubscriptionChange persiste e getBillingSubscriptionChangeById devolve com o mapeamento correto", async () => {
  const workspace = await createWorkspace("change-crud");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);

    const change = await createBillingSubscriptionChange({
      subscriptionId: subscription.id,
      workspaceId: workspace.workspaceId,
      type: "upgrade",
      status: "pending_payment",
      fromPlanId: "starter",
      toPlanId: "growth",
      fromBillingCycle: "monthly",
      toBillingCycle: "monthly",
      effectiveAt: isoOffset(0),
      creditAmountCents: 500,
      chargeAmountCents: 4900,
      requestedByType: "user",
      requestedById: workspace.userId,
    });

    assert.ok(change);
    assert.equal(change.subscriptionId, subscription.id);
    assert.equal(change.type, "upgrade");
    assert.equal(change.status, "pending_payment");
    assert.equal(change.fromPlanId, "starter");
    assert.equal(change.toPlanId, "growth");
    assert.equal(change.creditAmountCents, 500);
    assert.equal(change.chargeAmountCents, 4900);
    assert.equal(change.invoiceId, null);
    assert.equal(change.appliedAt, null);

    const fetched = await getBillingSubscriptionChangeById(change.id);
    assert.equal(fetched?.id, change.id);
    assert.equal(fetched?.toPlanId, "growth");

    const missing = await getBillingSubscriptionChangeById(randomUUID());
    assert.equal(missing, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("getBillingSubscriptionChangeByInvoiceId encontra pela invoice vinculada, e retorna null quando nao existe", async () => {
  const workspace = await createWorkspace("change-by-invoice");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);
    const invoice = await createPendingInvoiceFixture(subscription);

    const change = await createBillingSubscriptionChange({
      subscriptionId: subscription.id,
      workspaceId: workspace.workspaceId,
      type: "upgrade",
      status: "pending_payment",
      effectiveAt: isoOffset(0),
      invoiceId: invoice.id,
    });

    const found = await getBillingSubscriptionChangeByInvoiceId(invoice.id);
    assert.equal(found?.id, change.id);

    const notFound = await getBillingSubscriptionChangeByInvoiceId(randomUUID());
    assert.equal(notFound, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("getDueBillingSubscriptionChanges retorna apenas scheduled com effective_at ja vencido", async () => {
  const workspace = await createWorkspace("change-due");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);

    const due = await createBillingSubscriptionChange({
      subscriptionId: subscription.id,
      workspaceId: workspace.workspaceId,
      type: "downgrade",
      status: "scheduled",
      effectiveAt: isoOffset(-60_000),
    });
    await createBillingSubscriptionChange({
      subscriptionId: subscription.id,
      workspaceId: workspace.workspaceId,
      type: "downgrade",
      status: "pending_payment",
      effectiveAt: isoOffset(-60_000),
    });
    await createBillingSubscriptionChange({
      subscriptionId: subscription.id,
      workspaceId: workspace.workspaceId,
      type: "downgrade",
      status: "scheduled",
      effectiveAt: isoOffset(60_000),
    });

    const results = await getDueBillingSubscriptionChanges(isoOffset(0));
    const mine = results.filter((r) => r.subscriptionId === subscription.id);

    assert.deepEqual(mine.map((r) => r.id), [due.id]);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("findLatestOpenBillingSubscriptionChange retorna a mais recente em aberto e filtra por type", async () => {
  const workspace = await createWorkspace("change-latest-open");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);

    await createBillingSubscriptionChange({
      subscriptionId: subscription.id,
      workspaceId: workspace.workspaceId,
      type: "upgrade",
      status: "applied",
      effectiveAt: isoOffset(0),
    });
    const openUpgrade = await createBillingSubscriptionChange({
      subscriptionId: subscription.id,
      workspaceId: workspace.workspaceId,
      type: "upgrade",
      status: "scheduled",
      effectiveAt: isoOffset(0),
    });

    const found = await findLatestOpenBillingSubscriptionChange({
      subscriptionId: subscription.id,
      type: "upgrade",
    });
    assert.equal(found?.id, openUpgrade.id);

    const noMatchForType = await findLatestOpenBillingSubscriptionChange({
      subscriptionId: subscription.id,
      type: "cancel",
    });
    assert.equal(noMatchForType, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("updateBillingSubscriptionChange aplica patch parcial e retorna null para id inexistente", async () => {
  const workspace = await createWorkspace("change-update");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);
    const invoice = await createPendingInvoiceFixture(subscription);

    const change = await createBillingSubscriptionChange({
      subscriptionId: subscription.id,
      workspaceId: workspace.workspaceId,
      type: "upgrade",
      status: "pending_payment",
      effectiveAt: isoOffset(0),
    });

    const updated = await updateBillingSubscriptionChange(change.id, {
      status: "applied",
      invoiceId: invoice.id,
      appliedAt: isoOffset(0),
    });

    assert.equal(updated?.status, "applied");
    assert.equal(updated?.invoiceId, invoice.id);
    assert.equal(updated?.canceledAt, null);

    const missing = await updateBillingSubscriptionChange(randomUUID(), { status: "canceled" });
    assert.equal(missing, null);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("appendBillingAuditEvent grava o evento com o metadata serializado", async () => {
  const workspace = await createWorkspace("audit-append");
  try {
    const subscription = await createActiveSubscriptionFixture(workspace.workspaceId);
    const action = `test.action.${randomUUID()}`;

    await appendBillingAuditEvent({
      workspaceId: workspace.workspaceId,
      subscriptionId: subscription.id,
      actorType: "system",
      action,
      metadata: { reason: "integration-test", value: 42 },
    });

    const rows = await controlSql`
      SELECT actor_type, action, metadata
      FROM billing_audit_events
      WHERE workspace_id = ${workspace.workspaceId}
        AND action = ${action}
    `;

    assert.equal(rows.length, 1);
    assert.equal(rows[0].actor_type, "system");
    // The postgres.js connection used for this direct verification query does
    // not always auto-parse JSONB into an object (depends on how the value
    // was serialized on insert); accept either representation.
    const metadata =
      typeof rows[0].metadata === "string"
        ? JSON.parse(rows[0].metadata)
        : rows[0].metadata;
    assert.deepEqual(metadata, { reason: "integration-test", value: 42 });
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("createBillingWebhookEvent e idempotente por provider/providerEventId/eventType e atualiza o payload_hash", async () => {
  const providerEventId = `evt-${randomUUID()}`;
  let eventId;
  try {
    const first = await createBillingWebhookEvent({
      provider: "mercado_pago",
      providerEventId,
      eventType: "payment",
      payloadHash: "hash-1",
    });
    eventId = first?.id;

    assert.ok(first);
    assert.equal(first.status, "received");
    assert.equal(first.attempts, 0);
    assert.equal(first.payloadHash, "hash-1");

    const second = await createBillingWebhookEvent({
      provider: "mercado_pago",
      providerEventId,
      eventType: "payment",
      payloadHash: "hash-2",
      status: "processed",
    });

    assert.equal(second?.id, first.id);
    assert.equal(second?.payloadHash, "hash-2");
    assert.equal(second?.status, "received");
  } finally {
    if (eventId) {
      await controlSql`DELETE FROM billing_webhook_events WHERE id = ${eventId}`;
    }
  }
});

test("updateBillingWebhookEventStatus atualiza status/attempts e retorna null quando nao encontra o evento", async () => {
  const providerEventId = `evt-${randomUUID()}`;
  let eventId;
  try {
    const created = await createBillingWebhookEvent({
      provider: "mercado_pago",
      providerEventId,
      eventType: "payment",
      payloadHash: "hash-1",
    });
    eventId = created.id;

    const updated = await updateBillingWebhookEventStatus({
      provider: "mercado_pago",
      providerEventId,
      eventType: "payment",
      status: "failed",
      errorCode: "boom",
      errorMessage: "algo deu errado",
    });

    assert.equal(updated?.status, "failed");
    assert.equal(updated?.attempts, 1);
    assert.equal(updated?.errorCode, "boom");

    const notFound = await updateBillingWebhookEventStatus({
      provider: "mercado_pago",
      providerEventId: `evt-${randomUUID()}`,
      eventType: "payment",
      status: "failed",
    });
    assert.equal(notFound, null);
  } finally {
    if (eventId) {
      await controlSql`DELETE FROM billing_webhook_events WHERE id = ${eventId}`;
    }
  }
});

test("claimBillingWebhookEventProcessing move de received para processing e bloqueia uma segunda tentativa concorrente", async () => {
  const providerEventId = `evt-${randomUUID()}`;
  let eventId;
  try {
    const created = await createBillingWebhookEvent({
      provider: "mercado_pago",
      providerEventId,
      eventType: "payment",
      payloadHash: "hash-1",
    });
    eventId = created.id;

    const claimInput = {
      provider: "mercado_pago",
      providerEventId,
      eventType: "payment",
    };

    const firstClaim = await claimBillingWebhookEventProcessing(claimInput);
    assert.equal(firstClaim?.status, "processing");
    assert.equal(firstClaim?.attempts, 1);

    const secondClaim = await claimBillingWebhookEventProcessing(claimInput);
    assert.equal(secondClaim, null);
  } finally {
    if (eventId) {
      await controlSql`DELETE FROM billing_webhook_events WHERE id = ${eventId}`;
    }
  }
});

test("listFailedBillingWebhookEvents retorna apenas eventos com status failed", async () => {
  const failedEventId = `evt-${randomUUID()}`;
  const receivedEventId = `evt-${randomUUID()}`;
  let failedId;
  let receivedId;
  try {
    const failed = await createBillingWebhookEvent({
      provider: "mercado_pago",
      providerEventId: failedEventId,
      eventType: "payment",
      payloadHash: "hash-1",
    });
    failedId = failed.id;
    await updateBillingWebhookEventStatus({
      provider: "mercado_pago",
      providerEventId: failedEventId,
      eventType: "payment",
      status: "failed",
      errorCode: "boom",
    });

    const received = await createBillingWebhookEvent({
      provider: "mercado_pago",
      providerEventId: receivedEventId,
      eventType: "payment",
      payloadHash: "hash-1",
    });
    receivedId = received.id;

    const results = await listFailedBillingWebhookEvents(1000);
    const ids = results.map((r) => r.id);

    assert.ok(ids.includes(failedId));
    assert.ok(!ids.includes(receivedId));
  } finally {
    if (failedId) {
      await controlSql`DELETE FROM billing_webhook_events WHERE id = ${failedId}`;
    }
    if (receivedId) {
      await controlSql`DELETE FROM billing_webhook_events WHERE id = ${receivedId}`;
    }
  }
});
