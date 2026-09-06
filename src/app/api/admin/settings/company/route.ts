import { revalidatePath } from "next/cache";
import { isSuperAdminSession } from "@/lib/auth/access-control";
import { getCurrentAuthSession } from "@/lib/auth/session";
import { getCompanyIdentity } from "@/lib/legal/company-identity-server";
import {
  diffCompanyIdentity,
  mergeCompanyIdentity,
  sanitizeCompanyIdentityInput,
} from "@/lib/legal/company";
import { legalDocumentList } from "@/lib/legal/documents";
import {
  isPlatformPersistenceAvailable,
  saveCompanyIdentity,
} from "@/lib/server/platform";
import {
  createRouteRequestContext,
  logRouteEvent,
} from "@/lib/server/route-observability";

export async function PUT(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/admin/settings/company",
  );

  const session = await getCurrentAuthSession();

  if (!session || !isSuperAdminSession(session)) {
    return Response.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (!isPlatformPersistenceAvailable()) {
    return Response.json(
      { error: "Persistência indisponível para salvar a identidade." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const overrides = sanitizeCompanyIdentityInput(body);
  const before = await getCompanyIdentity();
  const after = mergeCompanyIdentity(overrides);
  const changes = diffCompanyIdentity(before, after);

  await saveCompanyIdentity({
    overrides,
    changes,
    userId: session.user.id,
    userEmail: session.user.email,
  });

  // As paginas legais sao cacheadas; sem isto a alteracao so apareceria na
  // proxima revalidacao, e quem salvou acharia que nao salvou.
  for (const document of legalDocumentList) {
    revalidatePath(document.path);
  }

  logRouteEvent(requestContext, "info", "admin.company_identity_updated", {
    changedFields: Object.keys(changes),
  });

  return Response.json({ identity: after, changedFields: Object.keys(changes) });
}
