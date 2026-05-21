import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getSql, hasDatabaseUrl } from "@/lib/server/neon";

const TOKEN_ROW_ID = "default";
const TOKEN_EXPIRY_SAFETY_WINDOW_MS = 5 * 60 * 1000;

type StoredMercadoLivreTokenRow = {
  id: string;
  access_token: string;
  refresh_token: string;
  user_id: string;
  scope: string | null;
  expires_at: string;
  updated_at: string;
};

type MercadoLivreTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user_id: number | string;
  refresh_token: string;
};

export type MercadoLivreConnectionStatus = {
  mode: "persistent" | "legacy-env" | "missing";
  connected: boolean;
  userId: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
};

export function getMercadoLivreAuthorizationUrl() {
  const clientId = process.env.MELI_CLIENT_ID;
  const redirectUri = process.env.MELI_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error(
      "MELI_CLIENT_ID and MELI_REDIRECT_URI are required to start Mercado Livre OAuth.",
    );
  }

  const state = randomUUID();
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const url = new URL("https://auth.mercadolivre.com.br/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return {
    state,
    codeVerifier,
    authorizationUrl: url.toString(),
  };
}

export async function getMercadoLivreConnectionStatus(): Promise<MercadoLivreConnectionStatus> {
  if (canUsePersistentOauth()) {
    const row = await getStoredTokenRow();

    return {
      mode: "persistent",
      connected: Boolean(row),
      userId: row?.user_id ?? null,
      expiresAt: row?.expires_at ?? null,
      updatedAt: row?.updated_at ?? null,
    };
  }

  if (process.env.MELI_ACCESS_TOKEN && process.env.MELI_USER_ID) {
    return {
      mode: "legacy-env",
      connected: true,
      userId: process.env.MELI_USER_ID,
      expiresAt: null,
      updatedAt: null,
    };
  }

  return {
    mode: "missing",
    connected: false,
    userId: null,
    expiresAt: null,
    updatedAt: null,
  };
}

export async function getMercadoLivreApiCredentials() {
  if (canUsePersistentOauth()) {
    const row = await getStoredTokenRow();

    if (!row) {
      throw new Error(
        "Mercado Livre não conectado. Autorize a conta em /preferencias.",
      );
    }

    if (!isTokenExpiringSoon(row.expires_at)) {
      return {
        accessToken: row.access_token,
        userId: row.user_id,
      };
    }

    try {
      const refreshedRow = await refreshStoredToken(row);

      return {
        accessToken: refreshedRow.access_token,
        userId: refreshedRow.user_id,
      };
    } catch (error) {
      const latestRow = await getStoredTokenRow();

      if (
        latestRow &&
        latestRow.refresh_token !== row.refresh_token &&
        !isTokenExpiringSoon(latestRow.expires_at)
      ) {
        return {
          accessToken: latestRow.access_token,
          userId: latestRow.user_id,
        };
      }

      throw error;
    }
  }

  const accessToken = process.env.MELI_ACCESS_TOKEN;
  const userId = process.env.MELI_USER_ID;

  if (!accessToken || !userId) {
    throw new Error(
      "Configure MELI_ACCESS_TOKEN e MELI_USER_ID ou ative o fluxo OAuth persistente com Neon.",
    );
  }

  return {
    accessToken,
    userId,
  };
}

export async function exchangeMercadoLivreCode(
  code: string,
  codeVerifier?: string | null,
) {
  const clientId = process.env.MELI_CLIENT_ID;
  const clientSecret = process.env.MELI_CLIENT_SECRET;
  const redirectUri = process.env.MELI_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "MELI_CLIENT_ID, MELI_CLIENT_SECRET and MELI_REDIRECT_URI are required.",
    );
  }

  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is required for persistent Mercado Livre OAuth.");
  }

  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Mercado Livre OAuth authorization_code failed with ${response.status}: ${errorText}`,
    );
  }

  const payload = (await response.json()) as MercadoLivreTokenResponse;

  return storeTokenPayload(payload);
}

async function refreshStoredToken(row: StoredMercadoLivreTokenRow) {
  const clientId = process.env.MELI_CLIENT_ID;
  const clientSecret = process.env.MELI_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "MELI_CLIENT_ID and MELI_CLIENT_SECRET are required for token refresh.",
    );
  }

  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Mercado Livre OAuth refresh_token failed with ${response.status}: ${errorText}`,
    );
  }

  const payload = (await response.json()) as MercadoLivreTokenResponse;

  return storeTokenPayload(payload);
}

async function storeTokenPayload(payload: MercadoLivreTokenResponse) {
  const sql = getSql();
  await ensureMercadoLivreTokenTable();

  const expiresAt = new Date(Date.now() + payload.expires_in * 1000).toISOString();
  const scope = payload.scope ?? null;
  const userId = String(payload.user_id);

  const rows = (await sql`
    INSERT INTO meli_oauth_tokens (
      id,
      access_token,
      refresh_token,
      user_id,
      scope,
      expires_at,
      created_at,
      updated_at
    )
    VALUES (
      ${TOKEN_ROW_ID},
      ${payload.access_token},
      ${payload.refresh_token},
      ${userId},
      ${scope},
      ${expiresAt},
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      user_id = EXCLUDED.user_id,
      scope = EXCLUDED.scope,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
    RETURNING id, access_token, refresh_token, user_id, scope, expires_at, updated_at
  `) as StoredMercadoLivreTokenRow[];

  const row = rows[0];

  if (!row) {
    throw new Error("Failed to persist Mercado Livre OAuth tokens.");
  }

  return row;
}

async function getStoredTokenRow() {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const sql = getSql();
  await ensureMercadoLivreTokenTable();

  const rows = (await sql`
    SELECT id, access_token, refresh_token, user_id, scope, expires_at, updated_at
    FROM meli_oauth_tokens
    WHERE id = ${TOKEN_ROW_ID}
    LIMIT 1
  `) as StoredMercadoLivreTokenRow[];

  return rows[0] ?? null;
}

async function ensureMercadoLivreTokenTable() {
  if (!hasDatabaseUrl()) {
    return;
  }

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS meli_oauth_tokens (
      id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      user_id TEXT NOT NULL,
      scope TEXT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function canUsePersistentOauth() {
  return Boolean(
    hasDatabaseUrl() &&
      process.env.MELI_CLIENT_ID &&
      process.env.MELI_CLIENT_SECRET &&
      process.env.MELI_REDIRECT_URI,
  );
}

function isTokenExpiringSoon(expiresAt: string) {
  const expiresAtMs = new Date(expiresAt).getTime();

  if (Number.isNaN(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= Date.now() + TOKEN_EXPIRY_SAFETY_WINDOW_MS;
}
