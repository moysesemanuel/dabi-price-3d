export type OperationalMessage = {
  code: string;
  message: string;
  severity: "warn" | "error";
  officialLookupReady?: boolean;
};

export function mapErpUpstreamFailure(input: {
  status: number;
  upstreamMessage?: string | null;
}): OperationalMessage {
  const upstreamMessage = normalizeOptionalMessage(input.upstreamMessage);

  if (input.status === 400 || input.status === 422) {
    return {
      code: "ERP_REJECTED_PAYLOAD",
      message:
        upstreamMessage ??
        "O ERP recusou os dados do produto. Revise SKU, imagens, categoria e preço antes de tentar novamente.",
      severity: "warn",
    };
  }

  if (input.status === 401 || input.status === 403) {
    return {
      code: "ERP_AUTH_REJECTED",
      message:
        "O ERP recusou a autenticação da integração. Revise PRICING_INTEGRATION_TOKEN no ambiente do projeto.",
      severity: "error",
    };
  }

  if (input.status === 404) {
    return {
      code: "ERP_ENDPOINT_NOT_FOUND",
      message:
        "O endpoint de integração do ERP não foi encontrado. Revise ERP_APP_URL antes de tentar novamente.",
      severity: "error",
    };
  }

  if (input.status >= 500) {
    return {
      code: "ERP_UPSTREAM_UNAVAILABLE",
      message:
        "O ERP falhou ao processar a solicitação agora. Tente novamente e, se persistir, revise os logs operacionais.",
      severity: "error",
    };
  }

  return {
    code: "ERP_UPSTREAM_REJECTED",
    message:
      upstreamMessage ?? "O ERP recusou a solicitação enviada pela precificadora.",
    severity: "warn",
  };
}

export function mapMercadoLivreOperationalError(
  error: unknown,
): OperationalMessage {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown Mercado Livre error.";

  if (rawMessage.includes("Mercado Livre não conectado")) {
    return {
      code: "MELI_NOT_CONNECTED",
      message:
        "Conta do Mercado Livre não conectada. Autorize a conta em /preferencias para consultar taxas oficiais.",
      severity: "warn",
      officialLookupReady: false,
    };
  }

  if (rawMessage.includes("Sessão autenticada ausente")) {
    return {
      code: "MELI_AUTH_SESSION_REQUIRED",
      message:
        "Sessão autenticada ausente para consultar o Mercado Livre. Entre novamente e repita a operação.",
      severity: "warn",
      officialLookupReady: false,
    };
  }

  if (
    rawMessage.includes("Configure MELI_ACCESS_TOKEN") ||
    rawMessage.includes("MELI_CLIENT_ID") ||
    rawMessage.includes("MELI_CLIENT_SECRET") ||
    rawMessage.includes("MELI_REDIRECT_URI") ||
    rawMessage.includes("DATABASE_URL is required for persistent Mercado Livre OAuth")
  ) {
    return {
      code: "MELI_NOT_CONFIGURED",
      message:
        "Integração do Mercado Livre não configurada neste ambiente. A prévia local foi mantida.",
      severity: "warn",
      officialLookupReady: false,
    };
  }

  if (rawMessage.includes("shipping_preferences(user)")) {
    return {
      code: "MELI_USER_SHIPPING_CONTEXT_FAILED",
      message:
        "O Mercado Livre não disponibilizou o contexto logístico da conta para este cálculo. A prévia local foi mantida.",
      severity: "warn",
      officialLookupReady: true,
    };
  }

  if (rawMessage.includes("shipping_preferences(category)")) {
    return {
      code: "MELI_CATEGORY_SHIPPING_CONTEXT_FAILED",
      message:
        "O Mercado Livre não disponibilizou o contexto logístico da categoria para este cálculo. A prévia local foi mantida.",
      severity: "warn",
      officialLookupReady: true,
    };
  }

  if (rawMessage.includes("listing_prices returned")) {
    return {
      code: "MELI_LISTING_PRICES_FAILED",
      message:
        "O Mercado Livre não retornou a taxa oficial desta combinação de categoria e anúncio. A prévia local foi mantida.",
      severity: "warn",
      officialLookupReady: true,
    };
  }

  if (rawMessage.includes("shipping_options/free returned")) {
    return {
      code: "MELI_FREE_SHIPPING_FAILED",
      message:
        "O Mercado Livre não retornou o frete grátis oficial deste cenário. A prévia local foi mantida.",
      severity: "warn",
      officialLookupReady: true,
    };
  }

  if (rawMessage.includes("authorization_code failed")) {
    return {
      code: "MELI_OAUTH_CODE_FAILED",
      message:
        "Falha ao concluir a autorização do Mercado Livre. Revise as credenciais OAuth e tente conectar novamente.",
      severity: "error",
      officialLookupReady: false,
    };
  }

  if (rawMessage.includes("refresh_token failed")) {
    return {
      code: "MELI_OAUTH_REFRESH_FAILED",
      message:
        "Falha ao renovar o acesso do Mercado Livre. Reconecte a conta em /preferencias.",
      severity: "error",
      officialLookupReady: false,
    };
  }

  if (rawMessage.includes("Failed to persist Mercado Livre OAuth tokens")) {
    return {
      code: "MELI_OAUTH_PERSISTENCE_FAILED",
      message:
        "A conta foi autorizada, mas a plataforma não conseguiu persistir o token do Mercado Livre. Revise DATABASE_URL e a persistência.",
      severity: "error",
      officialLookupReady: false,
    };
  }

  return {
    code: "MELI_OFFICIAL_LOOKUP_FAILED",
    message:
      "Não foi possível consultar a API oficial do Mercado Livre agora. A prévia local foi mantida.",
    severity: "error",
    officialLookupReady: true,
  };
}

function normalizeOptionalMessage(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
