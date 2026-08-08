import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import {
  createLocalDevelopmentSession,
  deleteLocalDevelopmentSession,
  getLocalDevelopmentBootstrapConfig,
  isLocalDevelopmentAuthEnabled,
  resolveLocalDevelopmentSession,
  verifyLocalDevelopmentCredentials,
} from "@/lib/auth/local-dev-auth";
import { verifyPassword } from "@/lib/auth/password";
import {
  createUserSession,
  deleteUserSession,
  findPrimaryWorkspaceForUser,
  findUserByEmail,
  getAuthenticatedSessionByToken,
  isPlatformPersistenceAvailable,
  type AuthenticatedWorkspaceSession,
} from "@/lib/server/platform";

const SESSION_COOKIE_NAME = "dabi-price-3d:session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export const authSessionCookieName = SESSION_COOKIE_NAME;

export const getCurrentAuthSession = cache(
  async (): Promise<AuthenticatedWorkspaceSession | null> => {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

    if (!sessionToken) {
      return null;
    }

    if (!isPlatformPersistenceAvailable()) {
      return resolveLocalDevelopmentSession(sessionToken);
    }

    return getAuthenticatedSessionByToken(hashSessionToken(sessionToken));
  },
);

export async function requireCurrentAuthSession() {
  const session = await getCurrentAuthSession();

  if (!session) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }

  return session;
}

export async function loginWithEmailPassword(input: {
  email: string;
  password: string;
}) {
  if (!isPlatformPersistenceAvailable()) {
    const localSession = resolveLocalDevelopmentLogin(input);

    if (!localSession) {
      return null;
    }

    return localSession;
  }

  const user = await findUserByEmail(input.email);

  if (!user || user.status !== "active") {
    return null;
  }

  const isValidPassword = await verifyPassword(input.password, user.password_hash);

  if (!isValidPassword) {
    return null;
  }

  const workspaceMembership = await findPrimaryWorkspaceForUser(user.id);

  if (!workspaceMembership) {
    throw new Error(
      "Usuário autenticado sem workspace vinculado. Verifique memberships no banco.",
    );
  }

  const sessionToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await createUserSession({
    userId: user.id,
    workspaceId: workspaceMembership.workspace_id,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
  });

  const session = await getAuthenticatedSessionByToken(hashSessionToken(sessionToken));

  if (!session) {
    throw new Error("Não foi possível carregar a sessão recém-criada.");
  }

  return {
    session,
    sessionToken,
    expiresAt,
  };
}

export async function logoutCurrentSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

  if (sessionToken) {
    if (!isPlatformPersistenceAvailable()) {
      deleteLocalDevelopmentSession();
    } else {
      await deleteUserSession(hashSessionToken(sessionToken));
    }
  }

  clearSessionCookie(cookieStore);
}

export function setSessionCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  sessionToken: string,
  expiresAt: Date,
) {
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  cookieStore.delete(SESSION_COOKIE_NAME);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function resolveLocalDevelopmentLogin(input: {
  email: string;
  password: string;
}) {
  if (!isLocalDevelopmentAuthEnabled()) {
    return null;
  }

  if (!verifyLocalDevelopmentCredentials(input)) {
    return null;
  }

  return createLocalDevelopmentSession({
    email: input.email,
  });
}

export function getLocalDevelopmentCredentialsHint() {
  const config = getLocalDevelopmentBootstrapConfig();

  return {
    email: config.email,
  };
}
