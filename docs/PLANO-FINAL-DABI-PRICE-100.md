# Plano Final DaBi Price — 100%

> Status: em execução  
> Objetivo: concluir 100% do escopo técnico, operacional e funcional definido para a DaBi Price, sem pendências classificadas como `parcial`, `faltando` ou `bloqueado` dentro do escopo oficial.

---

## Definição de “100%”

A DaBi Price será considerada **100% concluída** somente quando estiver:

- funcional para clientes reais;
- com cobrança completa e homologada;
- segura;
- operável sem acesso manual ao banco;
- monitorada;
- com integrações homologadas;
- com testes automatizados suficientes;
- com documentação atualizada;
- com fluxo completo validado em produção;
- sem dependências comerciais legadas não intencionais;
- sem itens do escopo oficial classificados como `parcial`, `faltando` ou `bloqueado`.

Critério geral:

```text
Produto funcional
+ cobrança completa
+ segurança
+ infraestrutura
+ operação
+ administração
+ integrações
+ testes
+ monitoramento
+ documentação
+ homologação real
= 100%
```

---

# Fase 0 — Congelamento de escopo e baseline

## Objetivo

Parar de criar novas funcionalidades até terminar o escopo já definido.

## Ações

- [x] Usar `main` como baseline oficial.
- [x] Criar branch de fechamento:
  ```bash
  release/dabi-price-100-percent
  ```
- [x] Não adicionar features fora deste plano.
- [x] Documentar todas as funcionalidades consideradas oficiais em
  `docs/ESCOPO-OFICIAL-DABI-PRICE.md`.
- [x] Registrar este arquivo no repositório.
- [x] Registrar commit inicial do ciclo de fechamento.

## Critério de aceite

Nenhuma nova funcionalidade entra antes de o checklist final estar zerado.

---

# Fase 1 — Infraestrutura e configuração de produção

## Objetivo

Garantir que produção não dependa de configuração implícita, local ou não validada.

## Variáveis a validar

- [ ] `DATABASE_URL`
- [ ] `MERCADO_PAGO_ACCESS_TOKEN`
- [ ] `MERCADO_PAGO_WEBHOOK_SECRET`
- [ ] `MERCADO_PAGO_TEST_ACCESS_TOKEN`, onde aplicável
- [ ] `MERCADO_PAGO_TEST_SITE_ID`
- [x] `CRON_SECRET`
- [x] `RESEND_API_KEY`
- [x] `AUTH_EMAIL_FROM`
- [ ] `BLOB_READ_WRITE_TOKEN`
- [ ] `MELI_CLIENT_ID`
- [ ] `MELI_CLIENT_SECRET`
- [ ] `MELI_REDIRECT_URI`
- [ ] `ERP_APP_URL`
- [ ] `PRICING_INTEGRATION_TOKEN`
- [ ] Demais variáveis efetivamente utilizadas pelo código.

## Configuração

- [ ] Separar claramente Development / Preview / Production.
- [x] Confirmar que nenhum secret está exposto como `NEXT_PUBLIC_*`.
- [x] Remover variáveis mortas.
- [ ] Confirmar HTTPS em URLs externas.
- [x] Verificar que Deployment Protection da Vercel não bloqueia providers externos necessários.

## QStash

Validar execução automática real:

```text
maintenance
*/15 * * * *

provider-reconciliation
0 */6 * * *

abandoned-checkouts
5 3 * * *
```

- [x] `maintenance` entregue automaticamente.
- [x] `provider-reconciliation` entregue automaticamente.
- [x] `abandoned-checkouts` entregue automaticamente.
- [x] Todos enviam `Authorization: Bearer <CRON_SECRET>`.
- [x] Todos recebem `HTTP 200`.
- [ ] Falhas ficam observáveis.

## Critério de aceite

Todos os serviços externos funcionam a partir da configuração de produção, sem dependência da máquina local.

## Registro de execução

Verificação em 21/08/2026:

- A produção e o preview têm as variáveis operacionais de banco, billing,
  Mercado Livre, ERP, cron e Blob configuradas.
- A rota pública do webhook do Mercado Pago respondeu à validação de payload,
  confirmando que a Deployment Protection não a bloqueia.
- Não há referência no código a `NEXT_PUBLIC_*`; as variáveis legadas
  `NEXT_PUBLIC_MP_SUBSCRIPTION_STARTER_URL` e
  `NEXT_PUBLIC_MP_SUBSCRIPTION_GROWTH_URL` foram removidas da Vercel em
  21/08/2026.
- As variáveis `ECOMMERCE_*` presentes na Vercel não têm referência no
  repositório e foram removidas de Preview e Production em 21/08/2026.
- Recuperação de senha foi validada ponta a ponta com Resend: o envio foi
  aceito, recebido no Gmail, o token abriu a redefinição, a senha foi alterada
  e o login remoto funcionou. O remetente `onboarding@resend.dev` permanece
  limitado ao e-mail da conta Resend; um domínio próprio verificado continua
  necessário antes do envio para usuários finais.
- A execução automática dos três jobs depende de acesso ao QStash ou de
  evidência de entregas recentes. Em 21/08/2026, os três schedules foram
  confirmados no QStash como `Delivered` com `HTTP 200`.

---

# Fase 2 — Segurança definitiva

## Objetivo

Provar em infraestrutura real que o hardening já implementado funciona corretamente.

## Webhook Mercado Pago

- [x] Assinatura válida é aceita.
- [x] Assinatura inválida retorna `401`.
- [x] Ausência de assinatura é rejeitada.
- [x] Ausência de `MERCADO_PAGO_WEBHOOK_SECRET` falha de forma segura.
- [x] Payload inválido é rejeitado.
- [x] Evento duplicado produz um único efeito.
- [x] Nenhum payload bruto sensível aparece nos logs.
- [x] Nenhum token aparece nos logs.
- [ ] Evento válido aparece na superfície administrativa correspondente.

## Autenticação

- [x] Brute force por IP limitado.
- [x] Brute force por e-mail limitado.
- [x] Login correto não bloqueia indevidamente o usuário.
- [x] Múltiplas instâncias compartilham o contador.
- [x] Bloqueio retorna `429`.
- [x] Resposta inclui `Retry-After`.
- [ ] Cadastro protegido.
- [x] Recuperação de senha protegida.
- [x] Reset protegido.
- [x] Token inválido tratado.
- [ ] Token expirado tratado.
- [ ] Sessão expirada tratada.
- [x] Logout invalidando sessão corretamente.
- [x] Cookie com configuração segura em produção.

## Administração e autorização

- [x] `/admin/*` inacessível a usuário comum.
- [x] APIs administrativas protegidas.
- [x] Roles respeitadas.
- [x] Acesso direto por URL não contorna autorização.
- [x] Usuário de um workspace não lê outro workspace.
- [x] Operações cross-workspace indevidas são bloqueadas.

## Registro de execução

Validação em Production e Preview entre 21/08/2026 e 22/08/2026:

- Seis falhas para o mesmo e-mail sintético retornaram cinco `401` e um `429`
  com `Retry-After`.
- Tentativas com e-mails sintéticos distintos atingiram o limite por IP e
  retornaram `429` com `Retry-After`.
- O login válido do super admin foi confirmado após a redefinição de senha.
- Webhook com payload inválido retornou `400`; payload válido com HMAC inválido
  ou sem `x-signature` retornou `401`, antes de qualquer consulta ao provider.
- Cron sem `Authorization` retornou `401`.
- Uma chamada anônima a uma API administrativa retornava `500`; a correção foi
  publicada na branch de conclusão e validada no Preview, onde os cinco
  handlers de `/api/admin/*` retornaram `401` sem sessão. Após o merge, a
  mesma rota foi validada em Production com `401` e sem alteração de dados.
- Acesso direto a `/admin/dashboard` sem sessão redireciona para
  `/login?next=/admin/dashboard`.
- Duas contas descartáveis com workspaces distintos e sem assinatura foram
  criadas para validação. A conta comum recebeu `403` em `/api/admin/users` e
  foi redirecionada de `/admin/dashboard` para `/app`; as APIs de membros
  retornaram `403` por entitlement antes de qualquer leitura. As sessões foram
  encerradas por `/api/auth/logout`, que foi seguido por `401` em
  `/api/auth/session`. As duas contas e seus workspaces de QA foram removidos
  após essa validação.
- O cookie de sessão emitido em Production contém `Secure`, `HttpOnly` e
  `SameSite=Lax`. A solicitação de recuperação atingiu `429` com e-mail
  sintético, e o reset com token sintético inválido retornou `400`.
- Dois workspaces de QA receberam Pix de sandbox pendente e uma exceção
  temporária e auditável de `accessUntil`, sem marcar qualquer pagamento como
  confirmado. Um cálculo criado no workspace A não foi listado para a sessão
  do workspace B. A tentativa de B excluir o ID de A não alterou o registro;
  a resposta idempotente inicial de `200` foi corrigida para `404`, antes de
  qualquer exclusão ou evento de auditoria, e revalidada no Preview.
- As exceções de `accessUntil`, contas, workspaces e registros descartáveis
  deste teste, incluindo as duas tentativas sem checkout causadas pelo domínio
  `.invalid`, foram removidos pela administração do banco após a validação.
- O rate limit usa `api_rate_limits` no banco quando `DATABASE_URL` está
  configurada, portanto mantém o contador entre instâncias. A camada comum de
  observabilidade agora mascara tokens, segredos, senhas, cookies,
  `Authorization` e credenciais presentes em mensagens e stack traces; os três
  logs diretos restantes passam pela mesma serialização.
- O consumo persistente de token de recuperação passou a executar como uma
  única operação atômica: valida validade e uso prévio, atualiza senha/status e
  invalida sessões sem permitir que duas requisições reutilizem o mesmo token.
- A suíte automatizada cobre HMAC SHA-256 válido mesmo com `ts` antigo,
  ausência de secret, assinatura inválida e o curto-circuito idempotente de
  webhooks já processados. A confirmação de ponta a ponta com evento real
  permanece na Fase 3.

## Critério de aceite

Nenhuma rota crítica possui bypass conhecido de autenticação, autorização ou validação de origem.

---

# Fase 3 — Pix manual E2E completo

## Objetivo

Homologar o ciclo completo de Pix manual com Mercado Pago e billing interno.

## Pagamento aprovado

Validar:

```text
criar conta
→ escolher plano
→ gerar Pix
→ pagar
→ Mercado Pago approved
→ webhook
→ invoice paid
→ subscription active
→ entitlement ativo
→ usuário entra no produto
```

- [ ] Banco correto.
- [ ] Invoice correta.
- [ ] Subscription correta.
- [ ] Entitlement correto.
- [ ] Interface correta.
- [ ] Logs corretos.
- [ ] Histórico/auditoria corretos.

## Pix não pago

- [ ] Estado permanece `pending`.
- [ ] Nenhum acesso pago é liberado.
- [ ] Usuário consegue consultar o estado atual.

## Pix expirado

- [ ] Invoice expira corretamente.
- [ ] Subscription não é ativada.
- [ ] Novo checkout pode ser iniciado.
- [ ] Pix antigo não pode ativar acesso indevido posteriormente.

## Cancelado / rejeitado

- [ ] Estado local coerente.
- [ ] Nenhum entitlement indevido.
- [ ] Nova tentativa permitida quando aplicável.

## Duplicidade

Enviar o mesmo evento mais de uma vez:

```text
1 pagamento
1 invoice
1 ativação
1 período
```

- [ ] Sem duplicação de invoice.
- [ ] Sem duplicação de período.
- [ ] Sem duplicação de audit event indevida.

## Evento fora de ordem

Exemplo:

```text
approved
→ posteriormente chega evento antigo pending
```

- [ ] Estado não regride.

## Mercado Pago indisponível

- [ ] Webhook falha sem corromper estado.
- [ ] Provider volta.
- [ ] Reconciliation recupera o estado.
- [ ] Acesso final fica correto.

## Gate

**Não iniciar a Fase 4 enquanto esta fase não estiver 100% concluída.**

---

# Fase 4 — Cartão recorrente E2E

## Objetivo

Homologar toda a recorrência real.

## Cenários

- [ ] Assinatura criada.
- [ ] Checkout abandonado.
- [ ] Cartão aprovado.
- [ ] Subscription ativa.
- [ ] Primeira cobrança.
- [ ] Renovação.
- [ ] Falha na renovação.
- [ ] `past_due`.
- [ ] Período de tolerância.
- [ ] Recuperação após pagamento.
- [ ] Suspensão.
- [ ] Cancelamento no DaBi.
- [ ] Cancelamento no provider.
- [ ] Retomada quando prevista.
- [ ] Webhook duplicado.
- [ ] Webhook atrasado.
- [ ] Webhook fora de ordem.
- [ ] Reconciliação corrigindo divergência.

## Critério de aceite

O acesso acompanha a máquina de estados e não apenas o último webhook recebido.

---

# Fase 5 — Upgrade, downgrade e ciclos

## Upgrade

Testar:

```text
Start → Pro
Start → Max
Pro → Max
```

- [ ] Crédito proporcional.
- [ ] Invoice correta.
- [ ] Pagamento correto.
- [ ] Troca somente após confirmação.
- [ ] Entitlement novo correto.
- [ ] Histórico correto.

## Downgrade

Testar:

```text
Max → Pro
Max → Start
Pro → Start
```

- [ ] Não aplicar imediatamente.
- [ ] Manter o plano pago atual até o fim do período.
- [ ] Mudança registrada.
- [ ] Aplicação em `currentPeriodEnd`.
- [ ] Job aplica corretamente.

## Mensal → anual

- [ ] Crédito proporcional.
- [ ] Valor correto.
- [ ] Pagamento.
- [ ] Novo ciclo.
- [ ] Doze meses de acesso.

## Anual → mensal

- [ ] Mudança agendada.
- [ ] Sem reembolso proporcional automático, salvo política futura explícita.
- [ ] Aplicação no final do período atual.

## Parcelamento anual

- [ ] Homologar comportamento realmente suportado pelo Mercado Pago.
- [ ] Confirmar impacto no acesso.
- [ ] Confirmar impacto no ciclo de billing.
- [ ] Documentar comportamento final.

---

# Fase 6 — Concorrência e transações críticas

## Objetivo

Eliminar condições de corrida capazes de produzir estado comercial inválido.

## Cenários a auditar

- [x] webhook vs webhook
- [ ] webhook vs reconciliation
- [ ] reconciliation vs reconciliation
- [ ] checkout simultâneo
- [ ] upgrade simultâneo
- [ ] downgrade simultâneo
- [ ] cancelamento vs pagamento
- [ ] pagamento vs expiração
- [ ] mudança de ciclo vs webhook

## Hardening

Onde necessário:

- [ ] Transações.
- [ ] Locking.
- [x] Atomicidade.
- [x] Unique constraints.
- [ ] Optimistic concurrency.
- [ ] `SELECT ... FOR UPDATE` ou equivalente.
- [x] Idempotency keys.
- [ ] Retries seguros.

## Testes

- [x] Criar testes concorrentes.
- [x] Exemplo: 10 webhooks simultâneos `approved`.
- [x] Resultado esperado: uma única mudança efetiva.

## Registro de execução

- O evento do provider possui unicidade por `provider`, `provider_event_id` e
  `event_type`. Antes de qualquer efeito comercial, o processamento agora é
  reivindicado por `UPDATE` atômico somente quando o status é `received` ou
  `failed`.
- A suíte executa dez entregas concorrentes do mesmo evento `approved` e
  confirma uma única atualização de assinatura; as nove restantes recebem
  `200` como entrega duplicada em processamento, sem novo efeito.

## Critério de aceite

Nenhuma condição de corrida conhecida cria duplicidade ou estado comercial inválido.

---

# Fase 7 — Super Admin completo

## Objetivo

Permitir operação segura sem acesso direto ao banco.

## Funcionalidades obrigatórias

- [x] Localizar workspace.
- [x] Localizar usuário.
- [x] Visualizar assinatura.
- [x] Visualizar invoices.
- [x] Consultar provider.
- [x] Visualizar pagamentos.
- [x] Visualizar webhooks.
- [x] Visualizar auditoria.
- [x] Visualizar mudanças de plano.
- [x] Visualizar backlog.
- [ ] Disparar reconciliação segura.
- [ ] Cancelar assinatura administrativamente.
- [ ] Visualizar divergência DaBi × Mercado Pago.
- [ ] Corrigir exceções por fluxo controlado.
- [x] Atualizar `accessUntil` com justificativa.
- [x] Registrar histórico de toda ação administrativa.

## Registro de execução

- A área `/admin` possui telas para workspaces, usuários, assinaturas,
  pagamentos, eventos e sistema. O detalhe da assinatura reúne invoices,
  mudanças e auditoria; as ações de inspeção do provider e `accessUntil`
  exigem super admin e gravam auditoria.
- Ainda faltam ações administrativas controladas para cancelar assinaturas e
  disparar reconciliação. A lista de divergências é somente de leitura, logo
  não substitui esses fluxos.

## Regra

Não resolver incidentes comerciais com alteração manual direta no banco.

## Critério de aceite

Uma falha real de cobrança pode ser diagnosticada e tratada pela superfície administrativa.

---

# Fase 8 — Eliminar billing legado

## Objetivo

Tornar `BillingSubscription` a fonte única de verdade comercial.

## Auditar referências

Pesquisar:

```text
preferences.subscription
workspacePreferences.subscription
subscription legado
preapproval legado
URLs antigas de assinatura
rotas antigas
campos sem consumidor
```

## Para cada ocorrência

Classificar:

- [ ] necessária
- [ ] migrar
- [ ] remover

## Achado de produção

Em 21/08/2026, o workspace do super admin apresentou `pending` nas
preferências legadas sem assinatura corrente no billing. A consulta de
assinatura corrente foi corrigida para também retornar uma assinatura com
`accessUntil` futuro, inclusive se o status comercial for `canceled`. O motor
de entitlement concede a exceção sem alterar esse status ou simular pagamento
aprovado. A remoção do fallback legado continua pendente nesta fase.

## Arquitetura final esperada

```text
BillingSubscription
        ↓
fonte única de verdade
        ↓
Entitlements
        ↓
UI
```

## Critério de aceite

Nenhuma decisão de plano, cobrança ou acesso depende de estado comercial legado.

---

# Fase 9 — Pix Automático

## Objetivo

Concluir a funcionalidade real, não apenas tipos internos.

## Contrato externo

Antes de implementar:

- [ ] Confirmar API atual do Mercado Pago.
- [ ] Confirmar autorização/mandato.
- [ ] Confirmar criação.
- [ ] Confirmar cobrança.
- [ ] Confirmar recorrência.
- [ ] Confirmar cancelamento.
- [ ] Confirmar falha.
- [ ] Confirmar revogação.
- [ ] Confirmar webhooks.
- [ ] Confirmar status.
- [ ] Confirmar idempotência.
- [ ] Confirmar sandbox/testes.

## Implementação

- [ ] Implementar via `BillingProvider`.
- [ ] Não espalhar lógica específica do Mercado Pago pelo domínio.
- [ ] Persistir estado necessário.
- [ ] Implementar reconciliação.
- [ ] Implementar observabilidade.

## E2E

- [ ] Autorização.
- [ ] Primeira cobrança.
- [ ] Renovação.
- [ ] Falha.
- [ ] Recuperação.
- [ ] Revogação.
- [ ] Cancelamento.
- [ ] Webhook.
- [ ] Reconciliation.

## Critério de aceite

Pix Automático homologado E2E.

---

# Fase 10 — Autenticação e ciclo completo do usuário

## Cadastro

Validar do zero:

```text
landing
→ plano
→ cadastro
→ workspace
→ checkout
→ pagamento
→ onboarding
→ app
```

- [ ] Cadastro.
- [ ] Criação de workspace.
- [ ] Seleção de plano.
- [ ] Checkout.
- [ ] Acesso após pagamento.
- [ ] Onboarding.
- [ ] Primeira utilização.

## Recuperação de senha

- [ ] Solicitação.
- [ ] E-mail real via Resend.
- [ ] Link.
- [ ] Token.
- [ ] Nova senha.
- [ ] Login com nova senha.
- [ ] Token não reutilizável.

## Gestão da conta

- [ ] Dados da conta.
- [ ] Membros.
- [ ] Convites.
- [ ] Roles.
- [ ] Remoção de membro.
- [ ] Owner.
- [ ] Manager.
- [ ] Operator.
- [ ] Múltiplos usuários.
- [ ] Limite de seats por plano.

---

# Fase 11 — Precificação

## Objetivo

Homologar completamente o núcleo funcional do produto.

## Casos

- [ ] Material.
- [ ] Energia.
- [ ] Mão de obra.
- [ ] Manutenção.
- [ ] Embalagem.
- [ ] Perdas.
- [ ] Margem.
- [ ] Impostos.
- [ ] Taxas.
- [ ] Canais de venda.
- [ ] Modelos de negócio.
- [ ] Arredondamentos.
- [ ] Valores zero.
- [ ] Valores extremos.
- [ ] Histórico.
- [ ] Edição.
- [ ] Duplicação, se oficialmente suportada.
- [ ] Limites por plano.

## Critério de aceite

O mesmo input produz o mesmo resultado independentemente da UI, com regras financeiras cobertas por testes.

---

# Fase 12 — Integração ERP

## Happy path

```text
precificação
→ produto
→ imagem
→ salvar ERP
→ sucesso
```

- [ ] Produto salvo.
- [ ] Dados corretos.
- [ ] Imagem correta.
- [ ] Resposta correta.

## Falhas

- [ ] ERP indisponível.
- [ ] Token inválido.
- [ ] Timeout.
- [ ] Erro 400.
- [ ] Erro 500.
- [ ] Produto duplicado.
- [ ] Imagem inválida.
- [ ] `requestId` disponível para diagnóstico.

---

# Fase 13 — Mercado Livre

## Homologação

- [ ] Conexão OAuth.
- [ ] Callback.
- [ ] Persistência da conexão.
- [ ] Refresh token.
- [ ] Access token expirado.
- [ ] Reconexão.
- [ ] Conta separada por workspace.
- [ ] Consulta/cálculo oficial.
- [ ] Erro do provider.
- [ ] Revogação pelo usuário.
- [ ] Isolamento entre workspaces.

## Legado

- [ ] Avaliar fallback de token por ambiente.
- [ ] Remover se não fizer parte do comportamento oficial de produção.

---

# Fase 14 — Arquivos e imagens

## Validar Blob em produção

- [ ] Upload.
- [ ] Formatos suportados.
- [ ] Tamanho máximo.
- [ ] URL final.
- [ ] Falha de upload.
- [ ] Arquivo inválido.
- [ ] Remoção, se suportada.
- [ ] Autorização.
- [ ] Isolamento de workspace.
- [ ] Comportamento sem `BLOB_READ_WRITE_TOKEN`.

---

# Fase 15 — UX/UI de produção

## Todos os fluxos devem possuir

- [ ] Loading.
- [ ] Empty state.
- [ ] Estado de erro.
- [ ] Retry quando aplicável.
- [ ] Sucesso.
- [ ] Mobile.
- [ ] Desktop.
- [ ] Responsividade.
- [ ] Confirmação para ação destrutiva.
- [ ] Mensagens compreensíveis.
- [ ] Proteção contra clique duplicado.
- [ ] Proteção contra double-submit.
- [ ] Feedback de processamento.
- [ ] Navegação correta após pagamento.
- [ ] Refresh seguro.
- [ ] Back/forward seguro.
- [ ] Sessão expirada durante operação.

## Acessibilidade básica

- [ ] Labels.
- [ ] Navegação por teclado.
- [ ] Focus.
- [ ] Contraste.
- [ ] ARIA quando necessário.

---

# Fase 16 — Observabilidade e alertas

## Alertas externos obrigatórios

- [ ] `webhook_processing_failed`.
- [ ] Webhook 5xx.
- [ ] Reconciliation falhou.
- [ ] Backlog acima do aceitável.
- [ ] Cron falhou.
- [ ] Mercado Pago indisponível.
- [ ] ERP falhando repetidamente.
- [ ] OAuth Mercado Livre falhando.
- [ ] Taxa anormal de 5xx.
- [ ] Build/deploy falhou.

## Canal

Definir solução operacional, por exemplo:

```text
Sentry + e-mail
```

ou equivalente.

## Critério de aceite

Falhas críticas geram alerta sem depender de abrir manualmente o painel administrativo.

---

# Fase 17 — Testes automatizados finais

## Unitários

- [ ] Regras puras do domínio.

## Integração

- [ ] Repository.
- [ ] Database.
- [ ] Billing Service.
- [ ] Webhook.
- [ ] Auth.
- [ ] Provider adapters.
- [ ] Jobs/reconciliation.

## E2E

No mínimo:

- [ ] Cadastro → login.
- [ ] Recuperação de senha.
- [ ] Precificação.
- [ ] Checkout Pix.
- [ ] Assinatura recorrente.
- [ ] Upgrade.
- [ ] Downgrade.
- [ ] Cancelamento.
- [ ] Gestão de conta.
- [ ] Admin.

## Pipeline obrigatório

```bash
npm run lint
npm run typecheck
npm run test:pricing
npm run build:webpack
git diff --check
```

- [ ] Todos verdes.
- [ ] Evoluir `npm run check` para representar toda a suíte final, se necessário.

---

# Fase 18 — Segurança final

## Auditoria

- [x] Secrets commitados.
- [x] `.env.example`.
- [x] Cookies.
- [x] CSRF onde aplicável.
- [x] CORS.
- [ ] Autorização.
- [ ] IDOR.
- [ ] Mass assignment.
- [ ] Open redirect.
- [ ] Validação de inputs.
- [ ] SQL.
- [ ] Upload.
- [ ] Headers.
- [ ] Stack traces.
- [ ] Mensagens de erro.
- [ ] Logs.
- [x] PII.
- [ ] Dependências vulneráveis.
- [x] Rotas de debug/teste esquecidas.
- [ ] Todas as rotas `/api`.

## Registro de execução

- A busca no repositório rastreado não encontrou valores literais para os
  secrets operacionais conhecidos. Arquivos de ambiente e dependências foram
  excluídos da verificação por não serem código versionado.
- `npm audit --omit=dev --audit-level=high`, executado em 22/08/2026, reportou
  cinco vulnerabilidades altas transitivas: `next@16.2.6`/`postcss`/`sharp`,
  `nanoid` e `undici`. A correção automática completa propõe
  `next@16.3.2`, fora da versão compatível atualmente exigida. Atualizar a
  dependência deve ser tratado como mudança controlada com nova validação de
  Next.js, não via `npm audit fix --force`.
- A sessão usa cookie `HttpOnly`, `Secure` em produção e `SameSite=Lax`. Os
  cookies temporários de OAuth têm a mesma proteção e o callback valida
  `state` e PKCE. Não há configuração de CORS permissiva no código; as rotas
  autenticadas também validam sessão no handler quando acionam credenciais de
  terceiros.
- `.env.example` relaciona todas as integrações operacionais sem valores
  efetivos. A árvore versionada de `src/app/api` não possui handlers de debug
  ou teste expostos.
- O sanitizador central de logs remove e-mails, tokens, segredos, senhas,
  cookies, assinaturas, QR codes e credenciais de OAuth, inclusive em objetos
  aninhados. Eventos de billing preservam IDs técnicos para diagnóstico.

## Critério de aceite

Nenhum achado crítico ou alto conhecido permanece aberto.

---

# Fase 19 — Dados, backup e recuperação

## Banco

- [ ] Backup configurado.
- [ ] Restore testado.
- [ ] Retenção definida.
- [ ] Estratégia de migrations.
- [ ] Rollback.
- [ ] Recuperação de dado corrompido.

## Dados do usuário

- [ ] Remoção de usuário/workspace.
- [ ] Política de retenção.
- [ ] Política de exclusão.
- [ ] Exportação quando aplicável.
- [ ] Requisitos LGPD avaliados.
- [ ] Política comercial/jurídica documentada.

---

# Fase 20 — Smoke test completo de produção

## Usuário novo

Não utilizar conta administrativa previamente existente.

Executar:

```text
Landing
↓
Cadastro
↓
Plano
↓
Pagamento
↓
Acesso
↓
Onboarding
↓
Precificação
↓
Histórico
↓
ERP
↓
Mercado Livre
↓
Conta
↓
Upgrade
↓
Downgrade
↓
Cancelamento
↓
Recuperação de senha
```

## Durante o teste, validar

- [ ] Vercel.
- [ ] Neon/PostgreSQL.
- [ ] Mercado Pago.
- [ ] QStash.
- [ ] Resend.
- [ ] Blob.
- [ ] Logs.
- [ ] `/admin`.

---

# Fase 21 — Limpeza final

Somente depois de tudo aprovado:

- [ ] Remover código morto.
- [ ] Remover branches antigas.
- [ ] Remover flags temporárias.
- [ ] Remover fallbacks não utilizados.
- [ ] Resolver/remover TODOs.
- [ ] Atualizar README.
- [ ] Atualizar arquitetura.
- [ ] Atualizar `.env.example`.
- [ ] Atualizar runbooks.
- [ ] Atualizar auditoria.
- [ ] Remover compatibilidades legadas que não possuam consumidor.
- [ ] Remover `docs/PLANO-TEMPORARIO-SEGURANCA-E-COBRANCA.md` somente após todos os critérios correspondentes estarem concluídos.

---

# Fase 22 — Auditoria final 100%

## Billing

Reexecutar a auditoria de arquitetura.

Resultado permitido para itens do escopo oficial:

```text
ok
```

Não aceitar:

```text
parcial
faltando
bloqueado
```

## Produto geral

- [ ] Criar auditoria final da aplicação inteira.
- [ ] Funcional.
- [ ] Billing.
- [ ] Segurança.
- [ ] Operação.
- [ ] Infraestrutura.
- [ ] Administração.
- [ ] Integrações.
- [ ] UX.
- [ ] Testes.
- [ ] Dados.
- [ ] Documentação.

---

# Fase 23 — Release final

## Pré-release

- [ ] Todas as fases anteriores concluídas.
- [ ] `main` atualizada.
- [ ] CI verde.
- [ ] Produção validada.
- [ ] Documentação final.
- [ ] Nenhum blocker conhecido.

## Release

Criar tag:

```bash
git tag v1.0.0
```

ou a versão oficial definida para o lançamento.

## Definição final

A release só será considerada pronta quando a DaBi Price estiver:

> funcional, homologada, segura, monitorada, administrável e operacional para clientes reais.

---

# Ordem obrigatória de execução

```text
1. Infraestrutura / variáveis / QStash
2. Segurança e rate limit em produção
3. Pix manual E2E
4. Cartão recorrente E2E
5. Upgrade / downgrade / ciclos
6. Concorrência e transações
7. Super Admin
8. Remoção do legado
9. Pix Automático
10. Usuário / auth / onboarding
11. Precificação
12. ERP
13. Mercado Livre
14. Uploads
15. UX/UI
16. Alertas
17. Suíte automatizada
18. Auditoria de segurança
19. Backup / LGPD
20. Smoke test produção
21. Limpeza
22. Auditoria 100%
23. Release
```

---

# Regra de execução

> Não iniciar a fase N+1 deixando defeito conhecido ou critério de aceite não cumprido na fase N.

Exceções só podem ocorrer quando uma fase depender tecnicamente de uma fase posterior. Nesse caso, a dependência deve ser registrada explicitamente neste documento.

---

# Critério absoluto de encerramento

Este plano só pode ser marcado como concluído quando:

- [ ] Todas as fases estiverem concluídas.
- [ ] Todos os checkboxes obrigatórios estiverem marcados.
- [ ] Não houver item `parcial`, `faltando` ou `bloqueado` no escopo oficial.
- [ ] Todos os testes automatizados estiverem verdes.
- [ ] Homologação real do Mercado Pago estiver concluída.
- [ ] Jobs estiverem comprovadamente operacionais.
- [ ] Alertas externos estiverem ativos.
- [ ] Super Admin cobrir as operações necessárias.
- [ ] Billing legado não influenciar decisões comerciais.
- [ ] Pix Automático estiver homologado.
- [ ] Backup e recuperação estiverem testados.
- [ ] Smoke test completo de produção estiver aprovado.
- [ ] Auditoria final estiver verde.
- [ ] Release final estiver publicada.
