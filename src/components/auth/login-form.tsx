"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          next: nextPath,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { redirectTo?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao entrar.");
      }

      router.push(payload?.redirectTo ?? "/app/precificacao");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao entrar.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <Field
          label="E-mail"
          type="email"
          placeholder="voce@empresa.com"
          value={email}
          onChange={setEmail}
        />
        <Field
          label="Senha"
          type="password"
          placeholder="Sua senha"
          value={password}
          onChange={setPassword}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="auth-login-submit app-button app-button-primary w-full rounded-2xl px-5 py-3"
        >
          {isSubmitting ? "Entrando..." : "Continuar"}
        </button>
      </form>

      {errorMessage ? (
        <div className="mt-5 rounded-[24px] border border-[#d45f5f]/30 bg-[#fff5f5] px-4 py-4 text-sm leading-7 text-[#a53b3b]">
          {errorMessage}
        </div>
      ) : null}
    </>
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
