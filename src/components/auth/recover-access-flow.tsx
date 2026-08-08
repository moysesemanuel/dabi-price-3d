"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RecoverAccessFlowProps = {
  token?: string;
};

type TokenState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "valid"; email: string; expiresAt: string }
  | { status: "invalid"; error: string };

export function RecoverAccessFlow({ token }: RecoverAccessFlowProps) {
  const [email, setEmail] = useState("");
  const [requestState, setRequestState] = useState<
    "idle" | "submitting" | "success"
  >("idle");
  const [requestFeedback, setRequestFeedback] = useState<{
    message: string;
    resetUrl: string | null;
    expiresAt: string | null;
    emailDelivered: boolean;
    deliveryMode: string | null;
  } | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [tokenState, setTokenState] = useState<TokenState>(() =>
    token ? { status: "loading" } : { status: "idle" },
  );
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [resetState, setResetState] = useState<"idle" | "submitting" | "success">(
    "idle",
  );
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let isMounted = true;

    void fetch(`/api/auth/recovery/verify?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { valid?: boolean; email?: string; expiresAt?: string; error?: string }
          | null;

        if (!isMounted) {
          return;
        }

        if (!response.ok || !payload?.email || !payload?.expiresAt) {
          setTokenState({
            status: "invalid",
            error: payload?.error ?? "Token inválido ou expirado.",
          });
          return;
        }

        setTokenState({
          status: "valid",
          email: payload.email,
          expiresAt: payload.expiresAt,
        });
      })
      .catch(() => {
        if (isMounted) {
          setTokenState({
            status: "invalid",
            error: "Não foi possível validar o link de recuperação.",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleRequestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setRequestState("submitting");
    setRequestError(null);
    setRequestFeedback(null);

    try {
      const response = await fetch("/api/auth/recovery/request", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            resetUrl?: string | null;
            expiresAt?: string | null;
            emailDelivered?: boolean;
            deliveryMode?: string | null;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao solicitar recuperação.");
      }

      setRequestState("success");
      setRequestFeedback({
        message:
          "Se existir uma conta com esse e-mail, o link de redefinição já foi emitido.",
        resetUrl: payload?.resetUrl ?? null,
        expiresAt: payload?.expiresAt ?? null,
        emailDelivered: payload?.emailDelivered === true,
        deliveryMode: payload?.deliveryMode ?? null,
      });
    } catch (error) {
      setRequestState("idle");
      setRequestError(
        error instanceof Error
          ? error.message
          : "Falha ao solicitar recuperação.",
      );
    }
  }

  async function handleResetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setResetError("Token ausente.");
      return;
    }

    if (password.length < 8) {
      setResetError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== passwordConfirmation) {
      setResetError("As senhas digitadas não conferem.");
      return;
    }

    setResetState("submitting");
    setResetError(null);

    try {
      const response = await fetch("/api/auth/recovery/reset", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao redefinir a senha.");
      }

      setResetState("success");
      setPassword("");
      setPasswordConfirmation("");
    } catch (error) {
      setResetState("idle");
      setResetError(
        error instanceof Error ? error.message : "Falha ao redefinir a senha.",
      );
    }
  }

  if (token) {
    return (
      <section className="mt-8">
        {tokenState.status === "loading" ? (
          <InfoPanel>Validando link de recuperação...</InfoPanel>
        ) : null}

        {tokenState.status === "invalid" ? (
          <ErrorPanel>{tokenState.error}</ErrorPanel>
        ) : null}

        {tokenState.status === "valid" ? (
          <>
            <div className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
              Redefinindo acesso para <strong>{tokenState.email}</strong>. Este
              link expira em {formatDateTime(tokenState.expiresAt)}.
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleResetSubmit}>
              <Field
                label="Nova senha"
                type="password"
                placeholder="Mínimo de 8 caracteres"
                value={password}
                onChange={setPassword}
              />
              <Field
                label="Confirmar nova senha"
                type="password"
                placeholder="Repita a nova senha"
                value={passwordConfirmation}
                onChange={setPasswordConfirmation}
              />

              <button
                type="submit"
                disabled={resetState === "submitting"}
                className="app-button app-button-primary w-full rounded-2xl px-5 py-3"
              >
                {resetState === "submitting"
                  ? "Redefinindo..."
                  : "Salvar nova senha"}
              </button>
            </form>

            {resetError ? <ErrorPanel className="mt-5">{resetError}</ErrorPanel> : null}

            {resetState === "success" ? (
              <SuccessPanel className="mt-5">
                Senha redefinida com sucesso. Você já pode entrar com a nova senha.
                <div className="mt-4">
                  <Link href="/login" className="app-button app-button-primary">
                    Voltar ao login
                  </Link>
                </div>
              </SuccessPanel>
            ) : null}
          </>
        ) : null}
      </section>
    );
  }

  return (
    <section className="mt-8">
      <form className="space-y-4" onSubmit={handleRequestSubmit}>
        <Field
          label="E-mail da conta"
          type="email"
          placeholder="voce@empresa.com"
          value={email}
          onChange={setEmail}
        />

        <button
          type="submit"
          disabled={requestState === "submitting"}
          className="app-button app-button-primary w-full rounded-2xl px-5 py-3"
        >
          {requestState === "submitting"
            ? "Enviando..."
            : "Enviar instruções"}
        </button>
      </form>

      {requestError ? <ErrorPanel className="mt-5">{requestError}</ErrorPanel> : null}

      {requestFeedback ? (
        <SuccessPanel className="mt-5">
          {requestFeedback.message}
          {requestFeedback.emailDelivered ? (
            <p className="mt-3">
              O e-mail foi enviado para a caixa da conta informada.
            </p>
          ) : null}
          {requestFeedback.resetUrl ? (
            <div className="mt-4 break-all rounded-[18px] border border-[var(--panel-border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)]">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                {requestFeedback.emailDelivered
                  ? "Link de apoio"
                  : "Link de desenvolvimento"}
              </p>
              <a
                href={requestFeedback.resetUrl}
                className="mt-2 block text-[var(--accent)] underline decoration-[rgba(108,86,255,0.4)] underline-offset-4"
              >
                {requestFeedback.resetUrl}
              </a>
              {requestFeedback.expiresAt ? (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Expira em {formatDateTime(requestFeedback.expiresAt)}.
                </p>
              ) : null}
            </div>
          ) : null}
        </SuccessPanel>
      ) : null}
    </section>
  );
}

function Field({
  label,
  type,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="clay-input mt-2 w-full rounded-2xl px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[#6c56ff] focus:ring-2 focus:ring-[#6c56ff]/20"
      />
    </label>
  );
}

function InfoPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
      {children}
    </div>
  );
}

function ErrorPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[24px] border border-[#d45f5f]/30 bg-[#fff5f5] px-4 py-4 text-sm leading-7 text-[#a53b3b] ${className}`}
    >
      {children}
    </div>
  );
}

function SuccessPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[24px] border border-[#8fc4a4]/40 bg-[#f4fff7] px-4 py-4 text-sm leading-7 text-[#256341] ${className}`}
    >
      {children}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
