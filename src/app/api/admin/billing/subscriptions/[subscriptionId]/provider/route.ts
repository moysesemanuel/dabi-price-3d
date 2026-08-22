import { createBillingAdminService } from "@/lib/billing/server-admin-service";
import { getCurrentAuthSession } from "@/lib/auth/session";

export async function POST(
  _request: Request,
  context: { params: Promise<{ subscriptionId: string }> },
) {
  const session = await getCurrentAuthSession();

  if (!session) {
    return Response.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const { subscriptionId } = await context.params;

  try {
    const inspection = await createBillingAdminService().inspectProviderState({
      session,
      subscriptionId,
    });

    return Response.json(inspection);
  } catch (error) {
    return Response.json(
      { error: mapBillingAdminError(error) },
      { status: mapBillingAdminStatus(error) },
    );
  }
}

function mapBillingAdminError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Falha ao consultar provider.";
  }

  switch (error.message) {
    case "A area administrativa de billing e exclusiva para super admin.":
      return "Essa acao e exclusiva para super admin.";
    case "Assinatura nao encontrada.":
      return "Assinatura nao encontrada.";
    case "A assinatura nao possui provider vinculado.":
      return "A assinatura nao possui provider vinculado.";
    case "Provider indisponivel para consulta.":
      return "Provider indisponivel para consulta.";
    case "Esse ambiente nao possui persistencia de billing habilitada.":
      return "Esse ambiente nao possui persistencia de billing habilitada.";
    default:
      return "Falha ao consultar provider.";
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
