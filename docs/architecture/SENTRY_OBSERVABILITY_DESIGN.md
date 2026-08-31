# Design de Observabilidade com Sentry

## Objetivo

Instrumentar a aplicacao Next.js do Dabi Price com Sentry para que falhas de
producao e preview possam ser investigadas a partir de eventos reais, sem
depender apenas de reproducao local e logs da aplicacao.

## Escopo

- Um projeto Sentry: `dabi-price`.
- Separacao de ambientes no mesmo projeto:
  - `production` para usuarios reais.
  - `preview` para deploys de preview da Vercel.
  - `hml` para a branch `release/homologation` da Vercel.
  - `development` desativado por padrao para evitar ruido local.
- Captura de erros nos runtimes de browser, Node.js e Edge.
- Captura global de erros de requisicao do Next.js, sem alterar rotas de
  negocio individualmente.
- Envio de source maps durante o deploy quando houver credenciais de build.

## Fora de escopo

- Nao alterar o comportamento de billing, checkout, webhook, reconciliation,
  precificacao ou qualquer outro dominio.
- Nao habilitar Session Replay, tracing de performance ou profiling nesta
  primeira etapa.
- Nao enviar credenciais de clientes, dados de pagamento, tokens, cookies ou
  informacoes pessoais padrao ao Sentry.
- Nao tornar a aplicacao indisponivel quando a configuracao do Sentry estiver
  ausente.

## Desenho

Adicionar `@sentry/nextjs` em uma versao compativel com Next.js 16. Configurar
o SDK pelo wrapper suportado do Next.js e por arquivos de runtime para cliente,
servidor e Edge. A inicializacao sera condicional a presenca de um DSN, para
que desenvolvimento local, testes e deploys sem a configuracao de
monitoramento continuem funcionando.

Usar o hook global de erros de requisicao do Next.js para capturar falhas nao
tratadas de rota. Os logs estruturados atuais, os request IDs e a mascaragem de
credenciais permanecem inalterados. Eventos de erro carregam o request ID
quando disponivel, mas um `beforeSend` remove integralmente os campos `request`
e `user` antes do envio e mascara valores sensiveis recursivamente em
excecoes, stacktrace e contexto. Assim, body de requisicao, cabecalhos de
autorizacao, cookies, URL com query string, identidade do usuario, tokens em
mensagens de erro e payloads de pagamento nao chegam ao Sentry.

O ambiente de deploy sera mapeado para os ambientes Sentry assim:

| Contexto de deploy | Ambiente Sentry |
| --- | --- |
| Vercel de producao | `production` |
| Vercel preview | `preview` |
| Vercel Production da branch `release/homologation` | `hml` via `SENTRY_ENVIRONMENT=hml` |
| Desenvolvimento local | `development` (nao enviado por padrao) |

O DSN do Sentry sera fornecido por variaveis de ambiente do deploy. O token de
envio de source maps e um segredo exclusivo do build. Ele nao pode ter prefixo
`NEXT_PUBLIC_`, constar em arquivos do repositorio, logs ou bundles de cliente.
O upload de source maps so e habilitado quando o build executa na Vercel e
encontra simultaneamente token, organizacao e projeto; isso impede que o token
somente leitura do Codex, configurado localmente, seja usado por engano.
O upload inclui tambem chunks internos do Next.js para que erros capturados no
runtime do framework sejam desminificados; isso pode aumentar o tempo de build.

## Configuracao Necessaria no Deploy

| Variavel | Visibilidade | Finalidade |
| --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Publica | DSN do SDK de browser. |
| `SENTRY_DSN` | Apenas servidor | DSN dos SDKs Node.js e Edge. |
| `SENTRY_ENVIRONMENT` | Configuracao de runtime | Define `hml` para a HML publicada como Production na Vercel. |
| `SENTRY_AUTH_TOKEN` | Segredo de build | Envio de source maps durante o deploy. |
| `SENTRY_ORG` | Configuracao de build | Slug da organizacao: `dabi-tech`. |
| `SENTRY_PROJECT` | Configuracao de build | Slug do projeto: `dabi-price`. |

`SENTRY_AUTH_TOKEN` deve receber apenas os escopos minimos necessarios para
envio de source maps. O token somente leitura usado pelo plugin Sentry do Codex
continua separado desta credencial de deploy.

Na Vercel, configurar as seis variaveis acima para os ambientes `Production`
e `Preview`. Na branch `release/homologation`, que a Vercel classifica como
`Production`, definir tambem `SENTRY_ENVIRONMENT=hml`. O `next.config.ts`
expoe `NEXT_PUBLIC_SENTRY_ENVIRONMENT` a partir desse valor, para que browser
e servidor usem o mesmo ambiente e release. Nao cadastrar o alias publico
separadamente. Nenhuma variavel do Sentry deve ser preenchida para
desenvolvimento local por padrao.

## Verificacao

- Adicionar testes automatizados focados no mapeamento de ambiente e no
  comportamento seguro sem DSN, antes do codigo de implementacao. Cobrir
  tambem a remocao de `request` e `user`, a mascaragem de valores sensiveis no
  evento e o hook de navegacao.
- Executar lint, typecheck, a suite de testes de precificacao, os testes de
  observabilidade pertinentes e o build webpack de producao.
- Confirmar que `git diff --check` esta limpo.
- Em um deploy preview, disparar uma excecao controlada e confirmar a criacao
  de issue com dados mascarados e ambiente `preview` no Sentry.
- Confirmar que os alertas de producao para problemas de alta prioridade
  permanecem configurados.

## Verificacao Local Executada

Em 2026-08-30, na worktree isolada de observabilidade, foram executados com
sucesso:

- `node --no-warnings --experimental-specifier-resolution=node --test tests/sentry-config.test.mjs` (9 testes).
- `npm run lint`.
- `npm run typecheck`.
- `npm run test:pricing` (251 testes).
- `npm run build:webpack`.
- `git diff --check`.

A verificacao de evento real no ambiente `preview` permanece pendente de
configuracao das variaveis na Vercel e autorizacao explicita para deploy.

## Criterios de Aceite

- Falhas nao tratadas no browser, servidor e Edge ficam visiveis no projeto
  `dabi-price` do Sentry quando o DSN esta configurado.
- Eventos recebem o ambiente de deploy correto e a release, quando disponivel.
- Request IDs e mascaragem de credenciais existentes continuam funcionando.
- Nenhum segredo do Sentry e commitado ou exposto em codigo de cliente.
- A ausencia da configuracao do Sentry nao altera o comportamento da aplicacao
  nem bloqueia testes ou builds locais.
