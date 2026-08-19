# Billing Architecture Audit

Data da auditoria: 2026-08-19

Documento de referência: `docs/architecture/ARQUITETURA_BILLING_DABI_PRICE.md`

Critério usado nesta auditoria:

- `ok`: entregue de forma aderente ao documento
- `parcial`: existe base técnica, mas falta superfície operacional, endurecimento ou aderência completa
- `faltando`: não existe implementação suficiente
- `bloqueado`: depende de definição externa ainda aberta

## Resumo executivo

A arquitetura central de billing está implementada e operacional em produção para os componentes internos principais: domínio, persistência, state machine, entitlement, checkout, webhooks, reconciliação, cancelamento, downgrade, upgrade, ciclo anual e agendamento dos jobs.

A malha de jobs não depende do Vercel Cron. Os endpoints ficam hospedados na aplicação na Vercel e são disparados por um scheduler externo, atualmente o Upstash QStash, autenticado por `CRON_SECRET` via header Bearer.

Validações já realizadas em produção:

- `/api/cron/billing/maintenance` responde `HTTP 200` com autenticação válida;
- `/api/cron/billing/provider-reconciliation` responde `HTTP 200` com autenticação válida;
- `/api/cron/billing/abandoned-checkouts` responde `HTTP 200` com autenticação válida;
- o schedule de `maintenance` foi entregue com sucesso pelo QStash;
- os endpoints rejeitam autenticação inválida com `401`;
- as rotas estão presentes no deploy de produção.

Pontos que ainda não devem ser considerados encerrados:

- homologação real de todos os fluxos de pagamento do Mercado Pago;
- contrato técnico final do Pix Automático;
- endurecimento de concorrência/transações nas operações críticas;
- conclusão das superfícies administrativas restantes;
- remoção definitiva das últimas camadas de compatibilidade legada onde ainda forem necessárias;
- validação operacional contínua dos schedules de menor frequência.

## Fases

### Fase 1 — Fundação de dados

Status: `ok`

Evidências:

- `BillingPrice`, `BillingSubscription`, `BillingInvoice`, `BillingSubscriptionChange`, `BillingPaymentMethod`, `BillingWebhookEvent` e `BillingAuditEvent` existem em `src/lib/billing/types.ts`;
- criação/persistência das estruturas em `src/lib/server/platform.ts` e repositórios de billing.

### Fase 2 — Tipos e máquina de estados

Status: `ok`

Evidências:

- tipos centrais em `src/lib/billing/types.ts`;
- state machine em `src/lib/billing/state-machine.ts`;
- testes em `tests/billing-state-machine.test.mjs`.

### Fase 3 — BillingService

Status: `ok`

Evidências:

- regras centrais em `src/lib/billing/service.ts`;
- cobertura em `tests/billing-service.test.mjs`.

### Fase 4 — Planos e preços

Status: `ok`

Evidências:

- catálogo com preços mensal/anual em `src/lib/workspace/catalog.ts`;
- composição de preço em `src/lib/billing/catalog.ts`.

Observação:

- os IDs técnicos continuam `starter/growth/scale`;
- os nomes comerciais expostos são DaBi Start, DaBi Pro e DaBi Max;
- não é recomendada uma migração de IDs apenas por estética, pois isso aumentaria o risco sem ganho funcional.

### Fase 5 — Entitlements

Status: `parcial`

Evidências:

- `resolveWorkspaceEntitlements` em `src/lib/billing/entitlement-service.ts`;
- proteção de rotas em `src/lib/auth/app-route-protection.ts`;
- cobertura em `tests/billing-entitlement-service.test.mjs` e `tests/app-route-protection.test.mjs`.

Lacunas:

- ainda existem pontos de compatibilidade com `preferences.subscription`;
- a remoção completa do read model legado deve ser concluída somente após confirmar que nenhuma superfície depende dele.

### Fase 6 — Tela de assinatura

Status: `ok`

Evidências:

- tela em `src/app/app/assinatura/page.tsx`;
- fluxo de upgrade em `src/app/app/assinatura/upgrade/page.tsx`.

### Fase 7 — Banners

Status: `ok`

Evidências:

- `src/lib/billing/notification-service.ts`;
- testes em `tests/billing-notification-service.test.mjs`.

### Fase 8 — BillingProvider

Status: `ok`

Evidências:

- interface em `src/lib/billing/providers/billing-provider.ts`;
- provider Mercado Pago em `src/lib/billing/providers/mercado-pago/mercado-pago-provider.ts`.

### Fase 9 — Novo checkout

Status: `ok`

Evidências:

- checkout recorrente em `src/app/api/payments/mercado-pago/subscriptions/checkout/route.ts`;
- checkout Pix manual em `src/app/api/billing/checkout/pix/route.ts`;
- tela em `src/app/app/checkout/page.tsx`;
- retomada de checkout pendente baseada em `BillingSubscription`, sem depender de espelhamento comercial persistido em `workspace_preferences`.

Observação:

- `ok` aqui significa que a arquitetura e os fluxos internos existem;
- isso não substitui homologação real contra o provider para todos os meios de pagamento.

### Fase 10 — Pix manual

Status: `ok`

Evidências:

- rota `src/app/api/billing/checkout/pix/route.ts`;
- tratamento em webhook e reconciliação;
- suporte a invoice e ativação após confirmação.

Pendente operacional:

- validação E2E real em ambiente/provider com pagamento efetivamente aprovado.

### Fase 11 — Cartão recorrente

Status: `ok`

Evidências:

- checkout recorrente em `src/app/api/payments/mercado-pago/subscriptions/checkout/route.ts`;
- provider e webhook cobrem assinatura recorrente.

Pendente operacional:

- homologação real de criação, renovação, falha, recuperação, cancelamento e retomada.

### Fase 12 — Webhooks

Status: `ok`

Evidências:

- adapter em `src/lib/billing/providers/mercado-pago/mercado-pago-webhook-adapter.ts`;
- serviço em `src/lib/billing/webhook-service.ts`;
- route em `src/app/api/payments/mercado-pago/webhook/route.ts`;
- idempotência e reconciliação fazem parte do desenho.

### Fase 13 — Jobs e reconciliação

Status: `ok`

Evidências:

- `src/lib/billing/reconciliation-service.ts`;
- `src/lib/billing/server-reconciliation-service.ts`;
- `src/lib/billing/reconciliation-runner.ts`;
- `src/lib/billing/server-reconciliation-runner.ts`;
- `src/lib/billing/cron-auth.ts`;
- endpoints em `src/app/api/cron/billing`;
- testes de cron auth, runner e reconciliation service;
- autenticação por `CRON_SECRET`;
- agendamento operacional externo via Upstash QStash.

Schedules atuais:

```text
/api/cron/billing/maintenance
*/15 * * * *

/api/cron/billing/provider-reconciliation
0 */6 * * *

/api/cron/billing/abandoned-checkouts
5 3 * * *
```

Arquitetura operacional:

```text
Upstash QStash
    ↓
HTTPS GET
    ↓
Vercel /api/cron/billing/*
    ↓
Authorization: Bearer <CRON_SECRET>
    ↓
BillingReconciliationRunner
    ↓
BillingService
```

O scheduler é infraestrutura substituível. A regra de negócio não depende do QStash.

### Fase 14 — Cancelamento

Status: `ok`

Evidências:

- regras em `src/lib/billing/service.ts` e `src/lib/billing/subscription-management.ts`;
- cobertura em `tests/billing-subscription-management.test.mjs`;
- cancelamento preserva acesso até o final do período já pago.

### Fase 15 — Downgrade

Status: `ok`

Evidências:

- rota em `src/app/api/billing/subscriptions/downgrade/route.ts`;
- regras em `src/lib/billing/downgrade-management.ts`;
- alteração agendada para o fim do período.

### Fase 16 — Upgrade

Status: `ok`

Evidências:

- rota em `src/app/api/billing/subscriptions/upgrade/pix/route.ts`;
- regras em `src/lib/billing/upgrade-management.ts`;
- crédito proporcional e aplicação após confirmação do pagamento.

### Fase 17 — Ciclo anual

Status: `ok`

Evidências:

- preços mensal/anual no catálogo;
- cálculo de período anual em webhook/reconciliação;
- ciclo anual concede doze meses de acesso independentemente do parcelamento do meio de pagamento.

Pendente operacional:

- homologar o comportamento real de parcelamento anual suportado pelo provider.

### Fase 18 — Pix Automático

Status: `bloqueado`

Evidências:

- tipo `pix_automatic` existe em `src/lib/billing/types.ts`;
- mapeamentos existem no provider/webhook;
- o domínio foi preparado para recorrência automática.

Lacunas:

- falta confirmar e homologar o contrato técnico final do Mercado Pago para mandato, autorização, cobrança recorrente e eventos;
- não deve ser considerado pronto para produção apenas pela existência dos tipos e mapeamentos.

### Fase 19 — Super Admin

Status: `parcial`

Evidências:

- páginas em `src/app/admin`;
- serviço em `src/lib/billing/admin-service.ts`;
- ações já implementadas incluem consulta ao provider e atualização de `accessUntil`.

Lacunas:

- falta consolidar cancelamento administrativo explícito;
- falta uma superfície mais completa para divergências e correção de exceções;
- dashboards operacionais ainda podem ser ampliados.

### Fase 20 — Migração do billing legado

Status: `parcial`

Evidências:

- uso prioritário de `BillingSubscription`;
- checkout, webhook e reconciliação deixaram de depender do estado comercial persistido em preferências;
- `workspace_preferences.subscription` passou a ser tratado como camada de compatibilidade/read model, e não como fonte principal de verdade.

Lacunas:

- ainda existe projeção derivada para compatibilidade com partes do app;
- a remoção definitiva depende de confirmar que nenhum consumidor legado permanece.

### Fase 21 — Limpeza

Status: `ok` para a limpeza estrutural principal, com compatibilidade residual controlada

Evidências:

- `workspacePreferences.subscription` deixou de ser espelho comercial persistido;
- `applyWorkspaceSubscriptionUpdate()` não grava mais `planId/status/billingCycle` comerciais em `workspace_preferences`;
- webhook, checkout recorrente e checkout Pix não dependem mais do estado legado salvo em preferências para sincronizar assinatura;
- `preapprovalPlanId` e variáveis públicas obsoletas do checkout antigo foram removidos;
- rotas antigas de simulação/teste de subscriptions foram removidas.

### Seção 22 — Mudança de ciclo

Status: `ok`

Atendido:

- mensal → anual cria `BillingSubscriptionChange`, calcula crédito proporcional e gera cobrança pelo saldo devido;
- webhook/reconciliação aplicam a mudança após pagamento;
- anual → mensal é agendado para `currentPeriodEnd`, sem reembolso proporcional automático.

## Seções que ainda exigem atenção

### Seção 30/31/33 — Jobs, reconciliação e frequência operacional

Status: `ok`

Atendido:

- `BillingReconciliationRunner` agrupa expiração, fim de tolerância, cancelamento agendado, mudanças agendadas e invoices expiradas;
- limpeza de checkouts abandonados roda separadamente;
- reconciliação periódica consulta recursos do provider sem copiar cegamente o status remoto para o domínio;
- schedules são executados externamente pelo Upstash QStash;
- os endpoints exigem `Authorization: Bearer <CRON_SECRET>`;
- endpoints foram validados manualmente com `HTTP 200` em produção;
- o schedule `maintenance` foi validado com entrega `DELIVERED` no QStash.

Observação:

- `vercel.json` não contém schedules de billing; ele mantém apenas a configuração de build;
- isso é intencional para manter o agendamento fora do limite do plano gratuito da Vercel e preservar independência do scheduler.

### Seção 32 — Concorrência e transações

Status: `parcial`

Lacunas:

- existem checagens de estado e idempotência;
- ainda falta endurecimento explícito com transação/locking em todas as operações críticas;
- quando necessário, operações concorrentes devem usar estratégia equivalente a `SELECT ... FOR UPDATE` ou mecanismo transacional compatível com a camada de persistência usada.

### Seção 34 — Super Admin

Status: `parcial`

Lacunas:

- falta consolidar `cancelar assinatura` como ação administrativa explícita;
- falta fechar melhor o fluxo de divergências e exceções operacionais.

### Seção 38 — Integrações externas ainda abertas

Status: `parcial/bloqueado`

Itens que ainda dependem de validação externa ou decisão comercial:

- contrato técnico final do Pix Automático;
- meios de pagamento efetivamente disponíveis na conta Mercado Pago;
- parcelamento anual real;
- estratégia final de atualização de recorrência após mudanças de plano/ciclo, quando aplicável ao provider;
- política comercial/jurídica final de reembolso e retenção/exclusão de dados.

### Seção 40 — Resultado esperado

Status: `parcial`

Já existe base para:

- DaBi Start / Pro / Max;
- mensal / anual;
- Pix manual;
- cartão recorrente;
- upgrade / downgrade / cancelamento;
- past due / tolerância / suspensão / expiração;
- paywall e entitlements centralizados;
- webhooks idempotentes;
- reconciliação automática;
- auditoria e superfície administrativa inicial.

Ainda impede considerar o resultado final completamente entregue:

- Pix Automático não homologado fim a fim;
- homologação real completa do provider ainda pendente;
- concorrência/transações ainda precisam de endurecimento;
- Super Admin ainda não cobre todas as operações previstas.

## Próxima execução correta

Ordem sugerida a partir do estado atual:

1. validar que os três schedules do QStash entregam chamadas novas com sucesso nos respectivos horários;
2. atualizar e manter esta documentação alinhada ao scheduler externo;
3. executar homologação E2E do Pix manual;
4. executar homologação E2E do cartão recorrente, incluindo renovação, falha, `past_due` e recuperação;
5. validar ciclo anual e comportamento de parcelamento real do provider;
6. auditar compra direta do DaBi Max para garantir que não exista desvio indevido para fluxo consultivo se o plano deve ser autoatendimento;
7. endurecer concorrência/transações das operações críticas;
8. completar as operações pendentes do Super Admin;
9. tratar Pix Automático como trilha própria após confirmação do contrato técnico externo;
10. remover compatibilidades legadas restantes somente após comprovar que nenhum consumidor ainda depende delas.
