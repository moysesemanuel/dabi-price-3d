# Billing Architecture Audit

Data da auditoria: 2026-08-14

Documento de referência: `docs/architecture/ARQUITETURA_BILLING_DABI_PRICE.md`

Critério usado nesta auditoria:

- `ok`: entregue de forma aderente ao documento
- `parcial`: existe base técnica, mas falta superfície operacional, limpeza ou aderência completa
- `faltando`: não existe implementação suficiente
- `bloqueado`: o próprio documento depende de definição externa ainda aberta

Observação de worktree:

- existe alteração local em `src/lib/workspace/catalog.ts` ajustando preço comercial de `starter` de `R$ 0,50` para `R$ 49`
- essa mudança não foi considerada como evidência arquitetural nem deve ser sobrescrita durante a migração

## Fases

### Fase 1 — Fundação de dados

Status: `ok`

Evidências:

- `BillingPrice`, `BillingSubscription`, `BillingInvoice`, `BillingSubscriptionChange`, `BillingPaymentMethod`, `BillingWebhookEvent` e `BillingAuditEvent` existem em `src/lib/billing/types.ts`
- criação de tabelas em `src/lib/server/platform.ts`

### Fase 2 — Tipos e máquina de estados

Status: `ok`

Evidências:

- tipos centrais em `src/lib/billing/types.ts`
- state machine em `src/lib/billing/state-machine.ts`
- testes em `tests/billing-state-machine.test.mjs`

### Fase 3 — BillingService

Status: `ok`

Evidências:

- regras centrais em `src/lib/billing/service.ts`
- cobertura em `tests/billing-service.test.mjs`

### Fase 4 — Planos e preços

Status: `ok`

Evidências:

- catálogo com preços mensal/anual em `src/lib/workspace/catalog.ts`
- composição de preço em `src/lib/billing/catalog.ts`

Observação:

- os IDs técnicos continuam `starter/growth/scale`, o que está alinhado com a decisão já acordada de trocar apenas nomes comerciais

### Fase 5 — Entitlements

Status: `parcial`

Evidências:

- `resolveWorkspaceEntitlements` em `src/lib/billing/entitlement-service.ts`
- proteção de rotas em `src/lib/auth/app-route-protection.ts`
- cobertura em `tests/billing-entitlement-service.test.mjs` e `tests/app-route-protection.test.mjs`

Lacunas:

- partes da aplicação ainda consultam `preferences.subscription` diretamente
- a remoção completa do paywall legado não aconteceu

### Fase 6 — Tela de assinatura

Status: `ok`

Evidências:

- tela em `src/app/app/assinatura/page.tsx`
- fluxo de upgrade em `src/app/app/assinatura/upgrade/page.tsx`

### Fase 7 — Banners

Status: `ok`

Evidências:

- `src/lib/billing/notification-service.ts`
- testes em `tests/billing-notification-service.test.mjs`

### Fase 8 — BillingProvider

Status: `ok`

Evidências:

- interface em `src/lib/billing/providers/billing-provider.ts`
- provider Mercado Pago em `src/lib/billing/providers/mercado-pago/mercado-pago-provider.ts`

### Fase 9 — Novo checkout

Status: `ok`

Evidências:

- checkout recorrente em `src/app/api/payments/mercado-pago/subscriptions/checkout/route.ts`
- checkout Pix manual em `src/app/api/billing/checkout/pix/route.ts`
- tela em `src/app/app/checkout/page.tsx`
- retomada de checkout pendente reconciliada contra `BillingSubscription`, sem depender de espelhamento comercial em `workspace_preferences`

### Fase 10 — Pix manual

Status: `ok`

Evidências:

- rota `src/app/api/billing/checkout/pix/route.ts`
- tratamento no webhook e reconciliação

### Fase 11 — Cartão recorrente

Status: `ok`

Evidências:

- checkout recorrente do Mercado Pago em `src/app/api/payments/mercado-pago/subscriptions/checkout/route.ts`
- provider e webhook cobrem assinatura recorrente

### Fase 12 — Webhooks

Status: `ok`

Evidências:

- adapter em `src/lib/billing/providers/mercado-pago/mercado-pago-webhook-adapter.ts`
- serviço em `src/lib/billing/webhook-service.ts`
- route em `src/app/api/payments/mercado-pago/webhook/route.ts`

### Fase 13 — Jobs e reconciliação

Status: `parcial`

Evidências:

- `src/lib/billing/reconciliation-service.ts`
- `src/lib/billing/server-reconciliation-service.ts`
- cobertura em `tests/billing-reconciliation-service.test.mjs`

Lacunas:

- não há entrypoint operacional claro para rodar a malha de jobs em produção
- a frequência operacional descrita na seção 33 não está implementada nem documentada no código

### Fase 14 — Cancelamento

Status: `ok`

Evidências:

- regras em `src/lib/billing/service.ts` e `src/lib/billing/subscription-management.ts`
- cobertura em `tests/billing-subscription-management.test.mjs`

### Fase 15 — Downgrade

Status: `ok`

Evidências:

- rota em `src/app/api/billing/subscriptions/downgrade/route.ts`
- regras em `src/lib/billing/downgrade-management.ts`

### Fase 16 — Upgrade

Status: `ok`

Evidências:

- rota em `src/app/api/billing/subscriptions/upgrade/pix/route.ts`
- regras em `src/lib/billing/upgrade-management.ts`

### Fase 17 — Ciclo anual

Status: `ok`

Evidências:

- preços anual/mensal no catálogo
- cálculo de período anual em `src/lib/billing/webhook-service.ts` e `src/lib/billing/reconciliation-service.ts`

### Fase 18 — Pix Automático

Status: `bloqueado`

Evidências:

- tipo `pix_automatic` existe em `src/lib/billing/types.ts`
- mapeamentos existem no provider/webhook

Lacunas:

- não existe fluxo fim a fim de método de pagamento, mandato, gestão do contrato e ativação operacional

Motivo do bloqueio:

- a seção 38 do documento ainda deixa o contrato técnico exato do Pix Automático em aberto

### Fase 19 — Super Admin

Status: `parcial`

Evidências:

- páginas em `src/app/admin`
- serviço em `src/lib/billing/admin-service.ts`
- ações implementadas: consultar provider e atualizar `accessUntil`

Lacunas:

- falta operação administrativa de cancelamento de assinatura
- falta superfície mais completa para correção de exceções

### Fase 20 — Migração do billing legado

Status: `parcial`

Evidências:

- estruturas novas convivem com o legado
- migração foi iniciada com uso prioritário de `BillingSubscription`
- `workspace_preferences.subscription` passou a persistir apenas snapshot neutro de suporte ao app, sem espelhar plano/status comercial

Lacunas:

- ainda existe uma projeção derivada em `getWorkspacePreferences()` para expor a assinatura corrente ao app via `preferences.subscription`
- a convivência com o read model legado em `AppPreferences` ainda mantém uma camada de transição durante a migração

### Fase 21 — Limpeza

Status: `ok`

Evidências:

- `workspacePreferences.subscription` deixou de ser persistido como espelho comercial e passou a ser sanitizado por `src/lib/billing/workspace-subscription-projection.ts`
- `applyWorkspaceSubscriptionUpdate()` não grava mais `planId/status/billingCycle` comerciais em `workspace_preferences`
- webhook, checkout recorrente e checkout Pix deixaram de depender do estado legado salvo em preferências para sincronizar assinatura
- `preapprovalPlanId` e variáveis públicas obsoletas de subscription checkout não aparecem mais no código da aplicação

### Seção 22 — Mudança de ciclo

Status: `ok`

Atendido:

- mensal para anual cria `BillingSubscriptionChange` pendente, calcula crédito proporcional do período mensal restante e gera invoice Pix pelo valor anual menos o crédito
- o webhook e a reconciliação aplicam a mudança após o pagamento, atualizando preço, ciclo, recorrência e vigência anual
- anual para mensal registra mudança `scheduled` para `currentPeriodEnd`, sem reembolso proporcional, e prepara a próxima recorrência mensal

## Seções do documento ainda não atendidas integralmente

### Seção 30/31/33 — Jobs, reconciliação e frequência operacional

Status: `parcial`

Lacunas:

- o serviço existe, mas falta o encadeamento operacional da rotina completa
- a frequência sugerida dos jobs não está representada por rotas/cron/runner no projeto

### Seção 32 — Concorrência e transações

Status: `parcial`

Lacunas:

- há checagens de estado, mas a arquitetura pede endurecimento explícito com transação e, quando necessário, `SELECT ... FOR UPDATE`
- essa garantia não está fechada nas operações críticas de webhook/job/ações do usuário

### Seção 34 — Super Admin

Status: `parcial`

Lacunas:

- falta `cancelar assinatura` como operação administrativa explícita
- falta fechar melhor o fluxo de divergências e exceções operacionais

### Seção 40 — Resultado esperado

Status: `parcial`

Motivo:

- o resultado final exige `Pix manual`, `Cartão recorrente` e `Pix Automático`
- `Pix Automático` ainda não está entregue fim a fim

## Próxima execução correta

Ordem sugerida para concluir a arquitetura sem improviso:

1. fechar a limpeza da fase 21 e remover os fallbacks legados de `preferences.subscription`
2. remover o espelhamento legado restante no backend de checkout e sincronização
3. implementar a seção 22 de mudança de ciclo fim a fim
4. fechar a operação dos jobs da seção 33
5. completar a seção 34 do Super Admin
6. endurecer a seção 32 com transações/locking
7. tratar `Pix Automático` como trilha própria e marcar como bloqueado até confirmação do contrato técnico externo
