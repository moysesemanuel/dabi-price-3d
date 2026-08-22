import { getCurrentAuthSession } from "@/lib/auth/session";
import { createBillingAdminService } from "@/lib/billing/server-admin-service";

export async function POST() {
  const session = await getCurrentAuthSession();

  if (!session) {
    return Response.json({ error: "Nao autenticado." }, { status: 401 });
  }

  try {
    const result = await createBillingAdminService().runProviderReconciliation({
      session,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: mapBillingAdminError(error) },
      { status: mapBillingAdminStatus(error) },
    );
  }
}

function mapBillingAdminError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "A area administrativa de billing e exclusiva para super admin.") {
      return "Essa acao e exclusiva para super admin.";
    }

    if (error.message === "Esse ambiente nao possui persistencia de billing habilitada.") {
      return "Esse ambiente nao possui persistencia de billing habilitada.";
    }
  }

  return "Falha ao executar a reconciliacao.";
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
