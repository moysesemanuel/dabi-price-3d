import {
  getCurrentAuthSession,
  requireCurrentAuthSession,
} from "@/lib/auth/session";
import {
  appendAuditEvent,
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
  saveWorkspacePreferences,
} from "@/lib/server/platform";
import { normalizeAppPreferences, type AppPreferences } from "@/lib/settings/app-preferences";

export async function GET() {
  if (!isPlatformPersistenceAvailable()) {
    return Response.json(
      { error: "Persistência de workspace indisponível sem DATABASE_URL." },
      { status: 503 },
    );
  }

  const session = await getCurrentAuthSession();

  if (!session) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const preferences = await getWorkspacePreferences(session.workspace.id);

  return Response.json(preferences);
}

export async function PUT(request: Request) {
  if (!isPlatformPersistenceAvailable()) {
    return Response.json(
      { error: "Persistência de workspace indisponível sem DATABASE_URL." },
      { status: 503 },
    );
  }

  const session = await requireCurrentAuthSession();
  let body: Partial<AppPreferences>;

  try {
    body = (await request.json()) as Partial<AppPreferences>;
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const previousPreferences = await getWorkspacePreferences(session.workspace.id);
  const nextPreferences = normalizeAppPreferences({
    ...previousPreferences,
    ...body,
    subscription: {
      ...previousPreferences.subscription,
      ...body.subscription,
    },
    pricingDefaults: {
      ...previousPreferences.pricingDefaults,
      ...body.pricingDefaults,
    },
    profitDestinations: {
      ...previousPreferences.profitDestinations,
      ...body.profitDestinations,
    },
  });
  const savedPreferences = await saveWorkspacePreferences({
    workspaceId: session.workspace.id,
    updatedByUserId: session.user.id,
    preferences: nextPreferences,
  });

  await appendAuditEvent({
    workspaceId: session.workspace.id,
    userId: session.user.id,
    type:
      !previousPreferences.onboardingCompleted && savedPreferences.onboardingCompleted
        ? "onboarding-completed"
        : previousPreferences.subscription.planId !== savedPreferences.subscription.planId ||
            previousPreferences.subscription.status !==
              savedPreferences.subscription.status
          ? "plan-updated"
          : "preferences-updated",
    title:
      !previousPreferences.onboardingCompleted && savedPreferences.onboardingCompleted
        ? "Onboarding inicial concluído"
        : previousPreferences.subscription.planId !== savedPreferences.subscription.planId ||
            previousPreferences.subscription.status !==
              savedPreferences.subscription.status
          ? "Plano comercial atualizado"
          : "Preferências operacionais atualizadas",
    description:
      !previousPreferences.onboardingCompleted && savedPreferences.onboardingCompleted
        ? "O workspace recebeu identidade, preset operacional e política padrão de precificação."
        : previousPreferences.subscription.planId !== savedPreferences.subscription.planId ||
            previousPreferences.subscription.status !==
              savedPreferences.subscription.status
          ? `Workspace ajustado para ${savedPreferences.subscription.planId} (${savedPreferences.subscription.status}).`
          : "Políticas comerciais, identidade do workspace ou parâmetros padrão foram revisados.",
    tone:
      !previousPreferences.onboardingCompleted && savedPreferences.onboardingCompleted
        ? "success"
        : previousPreferences.subscription.planId !== savedPreferences.subscription.planId ||
            previousPreferences.subscription.status !==
              savedPreferences.subscription.status
          ? "success"
          : "neutral",
  });

  return Response.json(savedPreferences);
}
