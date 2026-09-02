"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main>
          <h1>Ocorreu um erro inesperado.</h1>
          <p>Tente novamente. Se o problema continuar, entre em contato com o suporte.</p>
          <button type="button" onClick={reset}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
