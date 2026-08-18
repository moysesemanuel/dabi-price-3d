"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm({
  selectedPlan,
  selectedBillingCycle = "monthly",
}: {
  selectedPlan?: "starter" | "growth";
  selectedBillingCycle?: "monthly" | "annual";
}) {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setErrorMessage(null);

    if (password !== passwordConfirmation) {
      setErrorMessage("As senhas não coincidem.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          password,
          workspaceName,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        redirectTo?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível criar sua conta.");
      }

      const redirectTo = payload?.redirectTo ?? "/app/onboarding";

      const destination = selectedPlan
        ? `${redirectTo}?plan=${selectedPlan}&billingCycle=${selectedBillingCycle}`
        : redirectTo;

      router.push(destination);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível criar sua conta.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field
          label="Seu nome"
          type="text"
          placeholder="Como podemos chamar você?"
          value={fullName}
          onChange={setFullName}
          autoComplete="name"
        />

        <Field
          label="E-mail"
          type="email"
          placeholder="voce@empresa.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />

        <Field
          label="Nome do negócio"
          type="text"
          placeholder="Ex.: Doces da Ana"
          value={workspaceName}
          onChange={setWorkspaceName}
          autoComplete="organization"
        />

        <Field
          label="Senha"
          type="password"
          placeholder="Mínimo de 8 caracteres"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />

        <Field
          label="Confirmar senha"
          type="password"
          placeholder="Digite a senha novamente"
          value={passwordConfirmation}
          onChange={setPasswordConfirmation}
          autoComplete="new-password"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="auth-login-submit app-button app-button-primary w-full rounded-2xl px-5 py-3"
        >
          {isSubmitting ? "Criando conta..." : "Criar minha conta"}
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
  autoComplete,
}: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[var(--foreground)]">
        {label}
      </span>

      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
        className="clay-input mt-2 w-full rounded-2xl px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[#6c56ff] focus:ring-2 focus:ring-[#6c56ff]/20"
      />
    </label>
  );
}
