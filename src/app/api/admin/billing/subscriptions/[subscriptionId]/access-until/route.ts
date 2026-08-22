import { createBillingAdminService } from "@/lib/billing/server-admin-service";
import { getCurrentAuthSession } from "@/lib/auth/session";

type UpdateAccessUntilPayload = {
  accessUntil?: string | null;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ subscriptionId: string }> },
) {
  const session = await getCurrentAuthSession();

  if (!session) {
    return Response.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const { subscriptionId } = await context.params;
  let body: UpdateAccessUntilPayload;

  try {
    body = (await request.json()) as UpdateAccessUntilPayload;
  } catch {
    return Response.json({ error: "Payload invalido." }, { status: 400 });
  }

  const accessUntil =
    typeof body.accessUntil === "string"
      ? body.accessUntil.trim() || null
      : body.accessUntil ?? null;

  try {
    const subscription = await createBillingAdminService().grantAccessUntil({
      session,
      subscriptionId,
      accessUntil,
    });

    return Response.json({ subscription });
  } catch (error) {
    return Response.json(
      { error: mapBillingAdminError(error) },
      { status: mapBillingAdminStatus(error) },
    );
  }
}

function mapBillingAdminError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Falha ao atualizar accessUntil.";
  }

  switch (error.message) {
    case "A area administrativa de billing e exclusiva para super admin.":
      return "Essa acao e exclusiva para super admin.";
    case "Assinatura nao encontrada.":
      return "Assinatura nao encontrada.";
    case "Informe uma data valida para accessUntil.":
      return "Informe uma data valida para accessUntil.";
    case "Esse ambiente nao possui persistencia de billing habilitada.":
      return "Esse ambiente nao possui persistencia de billing habilitada.";
    default:
      return "Falha ao atualizar accessUntil.";
  }
}

function mapBillingAdminStatus(error: unknown) {
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return 500;
}
