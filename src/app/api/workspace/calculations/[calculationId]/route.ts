import { requireCurrentAuthSession } from "@/lib/auth/session";
import {
  appendAuditEvent,
  deleteCalculationSnapshot,
  isPlatformPersistenceAvailable,
  listCalculationSnapshots,
} from "@/lib/server/platform";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ calculationId: string }> },
) {
  if (!isPlatformPersistenceAvailable()) {
    return Response.json(
      { error: "Persistência de cálculos indisponível sem DATABASE_URL." },
      { status: 503 },
    );
  }

  const session = await requireCurrentAuthSession();
  const { calculationId } = await context.params;
  const currentItems = await listCalculationSnapshots(session.workspace.id);
  const deletedItem = currentItems.find((item) => item.id === calculationId) ?? null;

  if (!deletedItem) {
    return Response.json({ error: "Cálculo não encontrado." }, { status: 404 });
  }

  await deleteCalculationSnapshot(session.workspace.id, calculationId);
  await appendAuditEvent({
    workspaceId: session.workspace.id,
    userId: session.user.id,
    type: "calculation-deleted",
    title: "Cálculo excluído",
    description: `${deletedItem?.productName ?? "Um cálculo"} foi removido do histórico persistido.`,
    tone: "warning",
  });

  return Response.json({ success: true });
}
