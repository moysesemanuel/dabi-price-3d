import {
  getCurrentAuthSession,
  requireCurrentAuthSession,
} from "@/lib/auth/session";
import type { SavedCalculation } from "@/lib/history/calculation-history";
import {
  appendAuditEvent,
  clearCalculationSnapshots,
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
  listCalculationSnapshots,
  saveCalculationSnapshot,
} from "@/lib/server/platform";
import {
  canAccessPaidWorkspaceFeatures,
  getWorkspaceAccessBlockedMessage,
} from "@/lib/workspace/subscription-access";

export async function GET() {
  if (!isPlatformPersistenceAvailable()) {
    return Response.json(
      { error: "Persistência de cálculos indisponível sem DATABASE_URL." },
      { status: 503 },
    );
  }

  const session = await getCurrentAuthSession();

  if (!session) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const preferences = await getWorkspacePreferences(session.workspace.id);

  if (!canAccessPaidWorkspaceFeatures(preferences.subscription)) {
    return Response.json(
      {
        error:
          getWorkspaceAccessBlockedMessage(preferences.subscription.status) ??
          "A assinatura atual não libera esta funcionalidade.",
        code: "SUBSCRIPTION_REQUIRED",
      },
      { status: 403 },
    );
  }

  const items = await listCalculationSnapshots(session.workspace.id);

  return Response.json(items);
}

export async function POST(request: Request) {
  if (!isPlatformPersistenceAvailable()) {
    return Response.json(
      { error: "Persistência de cálculos indisponível sem DATABASE_URL." },
      { status: 503 },
    );
  }

  const session = await requireCurrentAuthSession();
  const preferences = await getWorkspacePreferences(session.workspace.id);

  if (!canAccessPaidWorkspaceFeatures(preferences.subscription)) {
    return Response.json(
      {
        error:
          getWorkspaceAccessBlockedMessage(preferences.subscription.status) ??
          "A assinatura atual não libera esta funcionalidade.",
        code: "SUBSCRIPTION_REQUIRED",
      },
      { status: 403 },
    );
  }
  let body: SavedCalculation;

  try {
    body = (await request.json()) as SavedCalculation;
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const currentItems = await listCalculationSnapshots(session.workspace.id);
  const previousItem = currentItems.find((item) => item.id === body.id) ?? null;
  const savedItem = await saveCalculationSnapshot({
    workspaceId: session.workspace.id,
    userId: session.user.id,
    item: body,
  });

  await appendAuditEvent({
    workspaceId: session.workspace.id,
    userId: session.user.id,
    type: previousItem ? "calculation-updated" : "calculation-saved",
    title: previousItem ? "Cálculo atualizado" : "Cálculo salvo no histórico",
    description: previousItem
      ? `${savedItem.productName} teve dados comerciais ou operacionais revisados.`
      : `${savedItem.productName} foi registrado para auditoria comercial e reaproveitamento.`,
    tone: previousItem ? "neutral" : "success",
  });

  return Response.json(savedItem);
}

export async function DELETE() {
  if (!isPlatformPersistenceAvailable()) {
    return Response.json(
      { error: "Persistência de cálculos indisponível sem DATABASE_URL." },
      { status: 503 },
    );
  }

  const session = await requireCurrentAuthSession();
  const preferences = await getWorkspacePreferences(session.workspace.id);

  if (!canAccessPaidWorkspaceFeatures(preferences.subscription)) {
    return Response.json(
      {
        error:
          getWorkspaceAccessBlockedMessage(preferences.subscription.status) ??
          "A assinatura atual não libera esta funcionalidade.",
        code: "SUBSCRIPTION_REQUIRED",
      },
      { status: 403 },
    );
  }

  await clearCalculationSnapshots(session.workspace.id);
  await appendAuditEvent({
    workspaceId: session.workspace.id,
    userId: session.user.id,
    type: "history-cleared",
    title: "Histórico limpo",
    description: "Todos os cálculos persistidos do workspace foram removidos.",
    tone: "warning",
  });

  return Response.json({ success: true });
}
