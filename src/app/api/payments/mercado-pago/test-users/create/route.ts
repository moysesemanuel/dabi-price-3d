import { isSuperAdminSession } from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import {
  createMercadoPagoTestUser,
  getMercadoPagoTestAccessToken,
} from "@/lib/payments/mercado-pago";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/payments/mercado-pago/test-users/create",
  );
  let session;

  try {
    session = await requireCurrentAuthSession();
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return jsonWithRequestId(
        requestContext,
        {
          error: "Faça login para criar compradores de teste do Mercado Pago.",
          code: "AUTHENTICATION_REQUIRED",
        },
        { status: 401 },
      );
    }

    throw error;
  }

  if (!isSuperAdminSession(session)) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Apenas super admin pode criar compradores de teste do Mercado Pago.",
        code: "MP_TEST_USER_FORBIDDEN",
      },
      { status: 403 },
    );
  }

  if (!getMercadoPagoTestAccessToken()) {
    return jsonWithRequestId(
      requestContext,
      {
        error:
          "MERCADO_PAGO_TEST_ACCESS_TOKEN é obrigatório para criar comprador de teste.",
        code: "MP_TEST_USER_ACCESS_TOKEN_MISSING",
      },
      { status: 503 },
    );
  }

  try {
    const testUser = await createMercadoPagoTestUser({
      description: `Comprador de teste - ${session.workspace.name} - ${new Date().toISOString()}`,
    });

    logRouteEvent(requestContext, "info", "mercado_pago_test_user_created", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      mercadoPagoTestUserId: testUser.id,
      nickname: testUser.nickname,
      email: testUser.email,
    });

    return jsonWithRequestId(requestContext, {
      ok: true,
      testUser: {
        id: testUser.id,
        nickname: testUser.nickname,
        password: testUser.password,
        email: testUser.email,
        siteId: testUser.site_id ?? null,
      },
    });
  } catch (error) {
    logRouteEvent(requestContext, "error", "mercado_pago_test_user_create_failed", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      error: serializeError(error),
    });

    return jsonWithRequestId(
      requestContext,
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao criar comprador de teste do Mercado Pago.",
        code: "MP_TEST_USER_CREATE_FAILED",
      },
      { status: 502 },
    );
  }
}

function isAuthenticationRequiredError(error: unknown) {
  return error instanceof Error && error.message === "AUTHENTICATION_REQUIRED";
}
