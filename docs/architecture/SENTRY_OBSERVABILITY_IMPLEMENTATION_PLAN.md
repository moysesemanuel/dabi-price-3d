# Plano de Implementacao da Observabilidade com Sentry

> **Para agentes:** use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano por tarefa. Os passos usam checkboxes para acompanhamento.

**Objetivo:** Instrumentar o Dabi Price com Sentry para capturar falhas reais de browser, Node.js e Edge, sem alterar regras de negocio.

**Arquitetura:** Um modulo puro decide o ambiente Sentry e se a telemetria deve ser iniciada. As configuracoes de runtime do SDK consomem esse modulo, enquanto o `instrumentation.ts` do Next.js captura erros globais de requisicao. A inicializacao e desativada na ausencia de DSN e em desenvolvimento local.

**Stack:** Next.js 16.3.2, React 19.2.4, TypeScript, Node test runner, `@sentry/nextjs`, Vercel.

**Especificacao:** `docs/architecture/SENTRY_OBSERVABILITY_DESIGN.md`

## Status da Execucao Local

- [x] Tarefa 1: contrato de ambiente, habilitacao e sanitizacao com testes em
  falha antes da implementacao.
- [x] Tarefa 2: SDK `@sentry/nextjs@10.72.0`, hooks globais, fallback da App
  Router e configuracao de source maps sem secrets no repositorio, restrita a
  builds da Vercel com credenciais completas.
- [x] Tarefa 3: placeholders de ambiente, documentacao operacional e suite de
  nao regressao local.
- [ ] Verificacao externa em Preview, dependente de autorizacao de deploy e
  configuracao das variaveis na Vercel.

## Restricoes Globais

- Trabalhar somente em `/Users/moysescosta/Projects/dabi-price-sentry-observability` na branch `codex/sentry-observability`.
- Nao alterar billing, checkout, webhook, reconciliation, precificacao nem outras regras de negocio.
- Nao executar o Sentry wizard automatico.
- Nao adicionar DSN, token, secrets ou valores reais de ambiente ao repositorio.
- A HML publicada pela branch `release/homologation` usa
  `SENTRY_ENVIRONMENT=hml`, pois a Vercel a classifica como `Production`.
- Usar `sendDefaultPii: false`; nao habilitar Session Replay, tracing ou profiling nesta etapa.
- Preservar `requestId`, logs estruturados e mascaragem de credenciais ja existentes.
- Sem commit, push, deploy, chamada HML ou producao sem autorizacao expressa.

---

## Estrutura de Arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/lib/observability/sentry-config.ts` | Resolver ambiente, release e habilitacao sem acessar o SDK. |
| `tests/sentry-config.test.mjs` | Cobrir o contrato puro de ambiente e ausencia de DSN. |
| `instrumentation-client.ts` | Inicializar captura de erros no browser quando habilitada. |
| `sentry.server.config.ts` | Inicializar captura no runtime Node.js quando habilitada. |
| `sentry.edge.config.ts` | Inicializar captura no runtime Edge quando habilitada. |
| `instrumentation.ts` | Carregar configuracao do runtime e encaminhar erros globais de requisicao. |
| `src/app/global-error.tsx` | Capturar erros globais da App Router e exibir fallback seguro. |
| `next.config.ts` | Envolver a configuracao com o wrapper suportado do Sentry para source maps. |
| `.env.example` | Documentar apenas nomes de variaveis Sentry e valores de exemplo inofensivos. |

### Tarefa 1: Contrato puro de ambiente e habilitacao

**Arquivos:**
- Criar: `src/lib/observability/sentry-config.ts`
- Criar: `tests/sentry-config.test.mjs`

**Interfaces:**
- Produz `resolveSentryEnvironment(input): "production" | "preview" | "development"`.
- Produz `isSentryEnabled(input): boolean`.
- Produz `createSentryOptions(input): { dsn: string; environment: string; release?: string; sendDefaultPii: false } | null`.

- [ ] **Passo 1: escrever os testes que falham**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  createSentryOptions,
  isSentryEnabled,
  resolveSentryEnvironment,
} from "../src/lib/observability/sentry-config.ts";

test("resolveSentryEnvironment separa producao, preview e desenvolvimento", () => {
  assert.equal(resolveSentryEnvironment({ vercelEnv: "production" }), "production");
  assert.equal(resolveSentryEnvironment({ vercelEnv: "preview" }), "preview");
  assert.equal(resolveSentryEnvironment({ vercelEnv: undefined }), "development");
});

test("isSentryEnabled exige DSN e nunca envia desenvolvimento local", () => {
  assert.equal(isSentryEnabled({ dsn: "https://public@example.ingest.sentry.io/1", environment: "production" }), true);
  assert.equal(isSentryEnabled({ dsn: "", environment: "production" }), false);
  assert.equal(isSentryEnabled({ dsn: "https://public@example.ingest.sentry.io/1", environment: "development" }), false);
});

test("createSentryOptions nao cria configuracao sem telemetria habilitada", () => {
  assert.equal(createSentryOptions({ dsn: "", vercelEnv: "production" }), null);
  assert.deepEqual(createSentryOptions({
    dsn: "https://public@example.ingest.sentry.io/1",
    vercelEnv: "preview",
    release: "abc123",
  }), {
    dsn: "https://public@example.ingest.sentry.io/1",
    environment: "preview",
    release: "abc123",
    sendDefaultPii: false,
  });
});
```

- [ ] **Passo 2: executar o teste para confirmar a falha esperada**

Executar:

```bash
node --no-warnings --experimental-specifier-resolution=node --test tests/sentry-config.test.mjs
```

Esperado: falha por ausencia de `src/lib/observability/sentry-config.ts`.

- [ ] **Passo 3: implementar o modulo minimo**

```ts
export type SentryEnvironment = "production" | "preview" | "development";

type SentryConfigInput = {
  dsn?: string;
  vercelEnv?: string;
  release?: string;
};

export function resolveSentryEnvironment(
  input: Pick<SentryConfigInput, "vercelEnv">,
): SentryEnvironment {
  if (input.vercelEnv === "production") return "production";
  if (input.vercelEnv === "preview") return "preview";
  return "development";
}

export function isSentryEnabled(
  input: Pick<SentryConfigInput, "dsn"> & { environment: SentryEnvironment },
) {
  return Boolean(input.dsn?.trim()) && input.environment !== "development";
}

export function createSentryOptions(input: SentryConfigInput) {
  const environment = resolveSentryEnvironment(input);
  if (!isSentryEnabled({ dsn: input.dsn, environment })) return null;

  return {
    dsn: input.dsn!.trim(),
    environment,
    ...(input.release?.trim() ? { release: input.release.trim() } : {}),
    sendDefaultPii: false as const,
  };
}
```

- [ ] **Passo 4: executar o teste para confirmar que passa**

Executar o mesmo comando do passo 2.

Esperado: 3 testes aprovados.

### Tarefa 2: SDK, hooks globais e limite de erro da App Router

**Arquivos:**
- Modificar: `package.json`
- Modificar: `package-lock.json`
- Criar: `instrumentation-client.ts`
- Criar: `sentry.server.config.ts`
- Criar: `sentry.edge.config.ts`
- Criar: `instrumentation.ts`
- Criar: `src/app/global-error.tsx`
- Modificar: `next.config.ts`
- Testar: `tests/sentry-config.test.mjs`

**Interfaces:**
- Consome `createSentryOptions` da tarefa 1.
- `instrumentation.ts` exporta `register` e `onRequestError` conforme a API validada da versao instalada do Next.js.
- `global-error.tsx` recebe `{ error: Error & { digest?: string }; reset: () => void }`.

- [ ] **Passo 1: instalar a dependencia sem executar o wizard**

```bash
npm install @sentry/nextjs
```

Ler a documentacao instalada da versao resolvida e a documentacao do Next.js 16 para confirmar os nomes atuais de `instrumentation-client.ts`, `instrumentation.ts`, `captureRequestError` e `withSentryConfig`. Nao usar exemplos de versoes anteriores sem validar a API.

- [ ] **Passo 2: criar os inicializadores condicionais**

Cada arquivo de runtime importa `createSentryOptions`, chama-o com seu DSN e `VERCEL_ENV` e so chama `Sentry.init(options)` se `options` nao for `null`. Usar `NEXT_PUBLIC_SENTRY_DSN` no cliente e `SENTRY_DSN` nos runtimes de servidor. Passar `VERCEL_GIT_COMMIT_SHA` como `release` quando existir.

O arquivo `instrumentation.ts` deve carregar apenas a configuracao do runtime atual em `register`. O handler `onRequestError` deve encaminhar a falha para `Sentry.captureRequestError` somente quando `createSentryOptions` indicar que o runtime esta habilitado. Nao adicionar captura manual a rotas existentes.

- [ ] **Passo 3: criar o teste de integracao que falha antes do limite global**

Adicionar a `tests/sentry-config.test.mjs`:

```js
import { readFile } from "node:fs/promises";

test("o limite global da App Router reporta a excecao sem expor detalhes", async () => {
  const source = await readFile(
    new URL("../src/app/global-error.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /"use client"/);
  assert.match(source, /Sentry\.captureException\(error\)/);
  assert.doesNotMatch(source, /error\\.stack/);
});
```

Executar o teste isolado e confirmar que falha porque o arquivo ainda nao existe.

- [ ] **Passo 4: implementar o limite global minimo**

`src/app/global-error.tsx` deve ser um Client Component. Em `useEffect`, chamar `Sentry.captureException(error)` uma vez para cada erro recebido. Renderizar `<html>` e `<body>` com mensagem generica em portugues e um botao `onClick={reset}` para tentar novamente. Nao renderizar `error.message`, `error.stack`, `digest` ou dados de requisicao na interface.

- [ ] **Passo 5: aplicar o wrapper de build do Sentry**

Preservar integralmente o objeto `nextConfig` atual. Alterar apenas a exportacao para aplicar `withSentryConfig(nextConfig, optionsDeBuild)` com source maps ocultos, `silent` fora de CI e upload condicionado a `SENTRY_AUTH_TOKEN`. Nao configurar `authToken` no codigo nem adicionar qualquer segredo ao arquivo.

- [ ] **Passo 6: executar verificacoes focadas**

```bash
node --no-warnings --experimental-specifier-resolution=node --test tests/sentry-config.test.mjs
npm run lint
npm run typecheck
```

Esperado: testes novos passam; lint e typecheck passam sem exigir DSN nem token.

### Tarefa 3: Contrato de ambiente e verificacao de nao regressao

**Arquivos:**
- Criar ou modificar: `.env.example`
- Modificar: `docs/architecture/SENTRY_OBSERVABILITY_DESIGN.md`
- Modificar: `docs/architecture/SENTRY_OBSERVABILITY_IMPLEMENTATION_PLAN.md`

**Interfaces:**
- `.env.example` documenta nomes de variaveis e valores ficticios; nao e usado como fonte de segredos.
- A especificacao passa a indicar comandos realmente verificados.

- [ ] **Passo 1: documentar variaveis sem segredos**

Adicionar a `.env.example` somente:

```dotenv
# DSN publica do projeto Sentry. Deixe vazia para desenvolvimento local.
NEXT_PUBLIC_SENTRY_DSN=
# DSN do servidor; usar a mesma DSN publica do projeto Sentry no deploy.
SENTRY_DSN=
# Configuracao de build para source maps; nao preencher nem commitar tokens.
SENTRY_ORG=dabi-tech
SENTRY_PROJECT=dabi-price
SENTRY_AUTH_TOKEN=
```

- [ ] **Passo 2: registrar configuracao externa obrigatoria**

Na especificacao, registrar que as variaveis devem ser cadastradas na Vercel para `Production` e `Preview`, que `SENTRY_AUTH_TOKEN` de build e separado do token somente leitura do Codex, e que nenhum token deve ser configurado em `development` por padrao.

- [ ] **Passo 3: executar a suite de nao regressao**

```bash
npm run lint
npm run typecheck
npm run test:pricing
npm run build:webpack
git diff --check
```

Esperado: todos os comandos passam. Se `TEST_DATABASE_URL` estiver ausente, registrar que testes de PostgreSQL isolado nao foram executados, sem usar banco de HML ou producao.

- [ ] **Passo 4: verificacao manual apos deploy autorizado**

Somente apos autorizacao explicita para um deploy Preview, configurar as variaveis na Vercel, disparar uma excecao controlada e confirmar no Sentry:

- issue no projeto `dabi-price`;
- ambiente `preview`;
- release presente quando a SHA estiver disponivel;
- ausencia de token, cookie, cabecalho `Authorization`, body e stack trace na mensagem exibida ao usuario;
- alerta de alta prioridade de producao preservado.

Nao executar este passo como parte da implementacao local.
