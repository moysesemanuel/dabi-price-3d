import {
  getCurrentAuthSession,
  requireCurrentAuthSession,
} from "@/lib/auth/session";
import { getWorkspaceEntitlements } from "@/lib/billing/server-entitlement-service";
import type { SavedCalculation } from "@/lib/history/calculation-history";
import { normalizeSavedCalculation } from "@/lib/history/workspace-calculations";
import {
  appendAuditEvent,
  clearCalculationSnapshots,
  isPlatformPersistenceAvailable,
  listCalculationSnapshots,
  saveCalculationSnapshot,
} from "@/lib/server/platform";
import { getWorkspaceAccessBlockedMessage } from "@/lib/workspace/subscription-access";

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

  const entitlements = await getWorkspaceEntitlements({
    workspaceId: session.workspace.id,
  });

  if (!entitlements.canUseApp) {
    return Response.json(
      {
        error:
          getWorkspaceAccessBlockedMessage(entitlements.accessReason) ??
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
  const entitlements = await getWorkspaceEntitlements({
    workspaceId: session.workspace.id,
  });

  if (!entitlements.canUseApp) {
    return Response.json(
      {
        error:
          getWorkspaceAccessBlockedMessage(entitlements.accessReason) ??
          "A assinatura atual não libera esta funcionalidade.",
        code: "SUBSCRIPTION_REQUIRED",
      },
      { status: 403 },
    );
  }
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const calculation = normalizeSavedCalculation(body);

  if (!calculation) {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const currentItems = await listCalculationSnapshots(session.workspace.id);
  const previousItem = currentItems.find((item) => item.id === calculation.id) ?? null;
  let savedItem: SavedCalculation;

  try {
    savedItem = await saveCalculationSnapshot({
      workspaceId: session.workspace.id,
      userId: session.user.id,
      item: calculation,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CALCULATION_ID_CONFLICT") {
      return Response.json(
        { error: "Não foi possível salvar este cálculo. Gere um novo cálculo e tente novamente." },
        { status: 409 },
      );
    }

    throw error;
  }

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
  const entitlements = await getWorkspaceEntitlements({
    workspaceId: session.workspace.id,
  });

  if (!entitlements.canUseApp) {
    return Response.json(
      {
        error:
          getWorkspaceAccessBlockedMessage(entitlements.accessReason) ??
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
