# Arquitetura de Billing — DaBi Price

> **Status:** arquitetura central implementada; jobs operacionais ativos; homologações externas ainda pendentes  
> **Objetivo:** documentar o desenho de billing do DaBi Price para suportar planos, ciclos mensal/anual, Pix manual, cartão recorrente, upgrade, downgrade, cancelamento, paywall, webhooks, reconciliação, auditoria e administração sem acoplar o domínio ao Mercado Pago.
>
> **Escopo atual:** Pix Automático é `FUTURE FEATURE`; o tipo técnico reservado
> no domínio não o torna parte do produto atual nem requisito de release.

---

## 1. Princípios da arquitetura

A arquitetura separa claramente:

- plano;
- preço;
- assinatura;
- cobrança;
- pagamento;
- método de pagamento;
- alteração de assinatura;
- direito de acesso;
- integração com provider;
- webhook;
- reconciliação;
- auditoria.

O Mercado Pago deve ser tratado como **provider de pagamento**, não como fonte das regras de negócio do DaBi Price.

Fluxo conceitual:

```text
DaBi Price
    ↓
BillingService
    ↓
BillingProvider
    ↓
MercadoPagoProvider
```

O domínio não deve conhecer diretamente conceitos específicos do provider como `preapproval`, `auto_recurring` ou `authorized_payment`.

---

## 2. Planos e ciclos

Planos comerciais oficiais:

```text
DaBi Start
DaBi Pro
DaBi Max
```

IDs técnicos atualmente preservados na implementação:

```text
starter
growth
scale
```

A arquitetura originalmente propôs `start/pro/max`, mas a implementação manteve `starter/growth/scale` para evitar uma migração sem ganho funcional. Os IDs internos devem permanecer estáveis mesmo que o nome comercial mude no futuro.

Ciclos:

```text
monthly
annual
```

### Mensal

O cliente compra acesso por um período mensal.

Exemplo:

```text
13/08/2026 → 13/09/2026
```

A renovação pode ser automática ou manual conforme o método de pagamento.

### Anual

O cliente paga o valor total anual antecipadamente e recebe 12 meses de acesso.

Exemplo:

```text
13/08/2026 → 13/08/2027
```

Parcelamento no cartão é detalhe do pagamento, não do ciclo de assinatura. Se o cliente pagar um anual de R$ 1.430 em 10 parcelas, para o DaBi continua existindo uma cobrança anual de R$ 1.430 que concede 12 meses de acesso.

---

## 3. Métodos de pagamento previstos

O domínio atual comporta:

```text
card
pix_manual
account_money
boleto
unknown
```

`pix_automatic` permanece reservado como compatibilidade técnica para uma
future feature. Não representa método habilitado nem requisito do produto
atual. Nem todos os demais métodos precisam existir no MVP.

### Pix manual

Permite contratar um período sem renovação automática.

```text
paymentMethod = pix_manual
autoRenew = false
```

O cliente pode pagar um mês, usar, deixar expirar e depois comprar outro período por Pix.

### Pix Automático — future feature

É tratado como recorrência:

```text
paymentMethod = pix_automatic
autoRenew = true
```

Esta é uma possibilidade futura do domínio, fora do escopo atual. A
implementação específica só poderá ser avaliada pelo adapter do provider quando
o contrato técnico estiver confirmado; não bloqueia a recorrência mensal por
cartão, o Pix manual ou o plano anual pago antecipadamente.

### Cartão

Pode servir para recorrência e para pagamento anual parcelado quando o provider permitir.

---

## 4. Modelo de dados

Entidades principais:

```text
BillingPrice
BillingSubscription
BillingInvoice
BillingSubscriptionChange
BillingPaymentMethod
BillingWebhookEvent
BillingAuditEvent
```

Serviços de domínio:

```text
BillingService
BillingProvider
EntitlementService
BillingNotificationService
BillingWebhookService
BillingReconciliationService
```

---

## 5. BillingPrice

Representa um preço válido para determinado plano e ciclo.

```prisma
model BillingPrice {
  id            String   @id @default(cuid())

  planId        String
  billingCycle  String

  amountCents   Int
  currency      String   @default("BRL")

  activeFrom    DateTime
  activeUntil   DateTime?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

Valores monetários são sempre armazenados em centavos:

```text
R$ 49,00  → 4900
R$ 149,00 → 14900
```

O histórico deve ser preservado. Alterar o preço atual do Pro não pode alterar retroativamente uma contratação antiga.

---

## 6. BillingSubscription

Representa a relação de assinatura do workspace.

```prisma
model BillingSubscription {
  id                     String   @id @default(cuid())

  workspaceId            String

  planId                 String
  billingCycle           String
  priceId                String?

  status                 String

  autoRenew              Boolean  @default(false)

  currentPeriodStart     DateTime?
  currentPeriodEnd       DateTime?

  gracePeriodEndsAt      DateTime?

  cancelAtPeriodEnd      Boolean  @default(false)
  cancelRequestedAt      DateTime?
  endedAt                DateTime?

  accessUntil            DateTime?

  provider               String?
  providerSubscriptionId String?

  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}
```

Um workspace pode ter várias assinaturas históricas, mas apenas uma assinatura corrente.

Estados considerados correntes:

```text
pending
active
past_due
scheduled_cancel
paused
```

Estados terminais:

```text
canceled
expired
```

---

## 7. Estados e transições

Estados oficiais:

```ts
type BillingSubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "scheduled_cancel"
  | "paused"
  | "canceled"
  | "expired";
```

### pending

A contratação foi iniciada, mas o direito de acesso ainda não foi confirmado.

```text
acesso pago = não
```

### active

A assinatura está dentro do período contratado.

```text
acesso pago = sim
```

### past_due

A renovação falhou, mas ainda existe tolerância.

```text
acesso pago = sim enquanto now < gracePeriodEndsAt
```

### scheduled_cancel

O usuário cancelou a próxima renovação, porém mantém o período já pago.

```text
acesso pago = sim enquanto now < currentPeriodEnd
```

### paused

Assinatura suspensa, normalmente após o fim da tolerância.

```text
acesso pago = não
```

### canceled

Cancelamento efetivado. Estado terminal.

### expired

O período terminou sem renovação. Estado terminal.

Máquina de estados:

```text
pending
  ├──→ active
  └──→ canceled

active
  ├──→ past_due
  ├──→ scheduled_cancel
  ├──→ paused
  └──→ expired

past_due
  ├──→ active
  ├──→ paused
  └──→ scheduled_cancel

scheduled_cancel
  ├──→ active
  └──→ canceled

paused
  ├──→ active
  └──→ canceled

canceled → terminal
expired  → terminal
```

Uma assinatura `canceled` ou `expired` não volta a `active`; uma nova `BillingSubscription` é criada.

---

## 8. BillingInvoice

Cada cobrança é uma entidade própria.

```prisma
model BillingInvoice {
  id                           String   @id @default(cuid())

  subscriptionId               String
  workspaceId                  String
  priceId                      String?

  type                         String
  status                       String

  amountCents                  Int
  currency                     String   @default("BRL")

  periodStart                  DateTime?
  periodEnd                    DateTime?

  paymentMethod                String?

  provider                     String?
  providerPaymentId            String?
  providerAuthorizedPaymentId  String?

  paymentExpiresAt             DateTime?

  paidAt                       DateTime?
  failedAt                     DateTime?
  refundedAt                   DateTime?

  createdAt                    DateTime @default(now())
  updatedAt                    DateTime @updatedAt
}
```

Tipos:

```text
subscription
renewal
upgrade
adjustment
```

Status:

```text
pending
paid
failed
expired
refunded
partially_refunded
canceled
charged_back
```

Uma assinatura pode ter várias invoices ao longo da vida.

---

## 9. BillingSubscriptionChange

Upgrade, downgrade, cancelamento e mudança de ciclo são alterações da assinatura, não status adicionais.

```prisma
model BillingSubscriptionChange {
  id                    String   @id @default(cuid())

  subscriptionId        String
  workspaceId           String

  type                  String
  status                String

  fromPlanId            String?
  toPlanId              String?

  fromBillingCycle      String?
  toBillingCycle        String?

  effectiveAt           DateTime

  creditAmountCents     Int      @default(0)
  chargeAmountCents     Int      @default(0)

  invoiceId             String?

  requestedByType       String?
  requestedById         String?

  createdAt             DateTime @default(now())
  appliedAt             DateTime?
  canceledAt            DateTime?
}
```

Tipos:

```text
upgrade
downgrade
cycle_change
cancel
reactivate
```

Status:

```text
pending_payment
scheduled
applied
canceled
failed
```

---

## 10. BillingPaymentMethod

Armazena apenas referências seguras do método de pagamento.

Nunca armazenar número completo de cartão ou CVV.

```prisma
model BillingPaymentMethod {
  id                       String   @id @default(cuid())

  workspaceId              String

  type                     String
  provider                 String?

  providerPaymentMethodId  String?
  providerCustomerId       String?
  providerMandateId        String?

  label                    String?

  isDefault                Boolean  @default(false)
  isActive                 Boolean  @default(true)

  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
}
```

Exemplo de label:

```text
Visa final 1234
```

---

## 11. BillingWebhookEvent

Responsável por idempotência e diagnóstico.

```prisma
model BillingWebhookEvent {
  id               String   @id @default(cuid())

  provider         String
  providerEventId  String
  eventType        String
  resourceId       String?

  payloadHash      String
  status           String
  attempts         Int      @default(0)

  receivedAt       DateTime @default(now())
  processedAt      DateTime?

  errorCode        String?
  errorMessage     String?

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([provider, providerEventId, eventType])
}
```

Status:

```text
received
processing
processed
ignored
failed
```

O mesmo evento recebido várias vezes deve produzir o mesmo resultado final.

---

## 12. BillingAuditEvent

Trilha de auditoria de billing.

```prisma
model BillingAuditEvent {
  id               String   @id @default(cuid())

  workspaceId      String?
  subscriptionId   String?
  invoiceId        String?

  actorType        String
  actorId          String?

  action           String
  metadata         Json?

  createdAt        DateTime @default(now())
}
```

Atores:

```text
user
super_admin
system
webhook
```

Exemplos:

```text
subscription.created
subscription.activated
subscription.renewed
subscription.past_due
subscription.recovered
subscription.paused
subscription.cancel_scheduled
subscription.cancel_reverted
subscription.canceled
subscription.expired
subscription.upgraded
subscription.downgraded
invoice.created
invoice.paid
invoice.failed
invoice.expired
access.extension_granted
reconciliation.payment_recovered
```

---

## 13. BillingService

API, webhook, jobs e super admin nunca devem atualizar `BillingSubscription` diretamente.

Tudo passa pelo `BillingService`.

Métodos principais:

```ts
createSubscription()
activateSubscription()
renewSubscription()

markPastDue()
recoverPastDue()
pauseSubscription()

scheduleCancellation()
revertCancellation()
finalizeCancellation()

requestUpgrade()
applyUpgrade()

scheduleDowngrade()
applyScheduledChange()

expireSubscription()
```

Cada operação relevante deve:

1. validar estado atual;
2. validar transição;
3. usar transação;
4. atualizar entidades relacionadas;
5. registrar auditoria;
6. emitir evento de domínio.

---

## 14. BillingProvider

Contrato conceitual:

```ts
interface BillingProvider {
  createRecurringSubscription();
  createManualPayment();

  getSubscription();
  getPayment();

  cancelSubscription();
  pauseSubscription();
  resumeSubscription();

  updateSubscriptionAmount();
}
```

A primeira implementação será:

```text
MercadoPagoProvider
```

O `external_reference` deve preferencialmente identificar a assinatura local:

```text
billing_subscription:<subscriptionId>
```

Isso é melhor do que identificar somente o workspace, pois um workspace pode possuir várias assinaturas históricas.

---

## 15. Checkout e onboarding

Fluxo recomendado:

```text
Landing
↓
Escolha do plano
↓
Escolha mensal/anual
↓
Cadastro rápido
↓
Cria User + Workspace
↓
Cria BillingSubscription = pending
↓
Escolha do método de pagamento
↓
Provider
↓
Pagamento confirmado
↓
BillingService.activateSubscription()
↓
Onboarding
↓
App
```

A conta pode existir antes do pagamento, mas o usuário ainda não entra no produto pago.

Roteamento:

```text
pending
→ /app/checkout

active + onboarding incompleto
→ /app/onboarding

active + onboarding completo
→ /app/precificacao

paused / expired / canceled
→ /app/assinatura
```

### Checkout abandonado

Não é erro.

Ao retornar:

```text
Sua contratação ainda não foi concluída.

[ Continuar pagamento ]
[ Alterar plano ]
```

### Alteração antes do primeiro pagamento

Trocar Start/Pro/Max ou mensal/anual enquanto `pending` não é upgrade/downgrade. É apenas alteração da contratação pendente.

Se a invoice existente não representa mais o plano/ciclo/valor escolhido, ela deve ser encerrada e uma nova invoice criada.

Nunca reutilizar silenciosamente um checkout de outro plano.

---

## 16. Pix manual

Primeira compra:

```text
BillingSubscription pending
↓
BillingInvoice subscription/pending
↓
createManualPayment()
↓
QR Code Pix
↓
webhook de pagamento
↓
invoice paid
↓
activateSubscription()
```

Resultado:

```text
autoRenew = false
status = active
```

Quando o período termina:

```text
active → expired
```

O cliente pode fazer login, preservar seus dados e contratar novamente.

---

## 17. Renovação

Renovação bem-sucedida chama:

```text
renewSubscription()
```

O período deve manter continuidade:

```text
newPeriodStart = previousCurrentPeriodEnd
newPeriodEnd = addBillingCycle(newPeriodStart)
```

Exemplo:

```text
período original:
13/08 → 13/09

pagamento recuperado em 15/09

novo período:
13/09 → 13/10
```

Não usar simplesmente `now` como início do novo ciclo.

---

## 18. Past due e tolerância

Falha de renovação:

```text
active → past_due
```

Define:

```text
gracePeriodEndsAt
```

Durante a tolerância o acesso continua.

Sugestão inicial configurável:

```text
5 dias
```

Se regularizar:

```text
past_due → active
```

Se a tolerância acabar:

```text
past_due → paused
```

---

## 19. Cancelamento

Política padrão:

```text
cancelar = impedir renovação futura
```

Não existe reembolso proporcional automático no fluxo normal.

```text
active → scheduled_cancel
```

Campos:

```text
autoRenew = false
cancelAtPeriodEnd = true
cancelRequestedAt = now
```

O acesso continua até `currentPeriodEnd`.

Na data final:

```text
scheduled_cancel → canceled
```

O usuário pode reverter antes do término:

```text
scheduled_cancel → active
```

Reembolso é um fluxo independente e deve respeitar política comercial e obrigações legais aplicáveis.

---

## 20. Upgrade

Regra:

```text
upgrade = imediato após pagamento confirmado
```

Exemplos:

```text
Start → Pro
Start → Max
Pro → Max
```

Fluxo:

```text
solicitação
↓
cálculo de crédito proporcional
↓
BillingSubscriptionChange = pending_payment
↓
BillingInvoice type=upgrade
↓
pagamento
↓
applyUpgrade()
↓
novo plano ativo
```

Se o pagamento falhar, a assinatura atual permanece inalterada.

O cálculo proporcional pertence ao DaBi Price, não ao provider.

---

## 21. Downgrade

Regra:

```text
downgrade = fim do período atual
```

Exemplo:

```text
Pro → Start
```

A assinatura permanece Pro até `currentPeriodEnd`.

Cria-se uma `BillingSubscriptionChange` com:

```text
status = scheduled
effectiveAt = currentPeriodEnd
```

A próxima cobrança usa o novo plano.

---

## 22. Mudança de ciclo

### Mensal → anual

Pode ocorrer imediatamente, com crédito proporcional do período mensal restante.

### Anual → mensal

É agendada para o final do período anual.

Sem reembolso proporcional automático.

---

## 23. EntitlementService

O restante da aplicação não deve verificar diretamente `planId` + `status` em vários lugares.

Serviço central:

```ts
getWorkspaceEntitlements(workspaceId)
```

Exemplo de retorno:

```ts
type WorkspaceEntitlements = {
  canUseApp: boolean;
  canUsePricing: boolean;
  canExportPdf: boolean;
  canViewHistory: boolean;
  canManageIntegrations: boolean;

  historyLimit: number;
  seatsLimit: number;

  canManageBilling: boolean;

  accessReason:
    | "active"
    | "grace_period"
    | "scheduled_cancel"
    | "pending"
    | "paused"
    | "expired"
    | "canceled"
    | "no_subscription";
};
```

Regras:

```text
sem assinatura      → produto pago não
pending             → não
active              → sim
past_due            → sim durante tolerância
scheduled_cancel    → sim até currentPeriodEnd
paused              → não
expired             → não
canceled            → não
```

`accessUntil` permite exceção administrativa sem adulterar o período comercial.

---

## 24. Paywall

Rotas sempre disponíveis após login:

```text
/app/conta
/app/perfil-empresa
/app/assinatura
/app/assinatura/*
```

Rotas de produto dependem de entitlement:

```text
/app/precificacao
/app/historico
/app/orcamentos
/app/integracoes
```

As APIs também devem validar entitlement. Esconder botão no frontend não é mecanismo de segurança.

---

## 25. Banners de billing

Criar `BillingNotificationService`.

Tipos:

```text
expiring_soon
past_due
scheduled_cancel
paused
```

Prioridade:

```text
paused
>
past_due
>
scheduled_cancel
>
expiring_soon
```

### expiring_soon

Para assinatura sem renovação automática próxima do fim.

Sugestão inicial:

```text
7 dias antes
```

### past_due

Exemplo:

```text
Não conseguimos renovar sua assinatura.
Seu acesso continuará até 18 de agosto.
Regularize antes dessa data para evitar a suspensão.
```

### scheduled_cancel

Banner persistente:

```text
A renovação da sua assinatura foi cancelada.
Você continuará com acesso ao DaBi Pro até 13 de setembro de 2026.
```

Ações possíveis:

```text
[ Manter assinatura ]
[ Ver detalhes ]
```

---

## 26. Retenção de dados

Fim da assinatura não significa exclusão da conta.

Preservar:

```text
User
Workspace
Histórico
Orçamentos
Configurações
Dados do negócio
```

O usuário continua podendo fazer login e acessar billing/conta.

Soft delete deve ser reservado ao fluxo real de exclusão de conta/dados.

Cliente que retorna após meses usa o mesmo workspace, mas cria uma nova assinatura.

---

## 27. Webhooks

Regra central:

```text
Webhook nunca altera workspace diretamente.
```

Fluxo:

```text
Mercado Pago
↓
MercadoPagoWebhookAdapter
↓
validação da assinatura
↓
normalização
↓
BillingWebhookService
↓
BillingService
```

A route de webhook não deve conter regras de:

```text
plano
upgrade
downgrade
paywall
currentPeriodEnd
acesso
```

Quando necessário, o webhook consulta o recurso atual via `BillingProvider` em vez de confiar apenas no payload recebido.

---

## 28. Webhooks de pagamento

Fluxo:

```text
webhook
↓
provider.getPayment()
↓
localiza BillingInvoice
↓
atualiza invoice
↓
aplica efeito no BillingService
```

Exemplos:

```text
invoice.type = subscription
paid
→ activateSubscription()

invoice.type = renewal
paid
→ renewSubscription()

invoice.type = upgrade
paid
→ applyUpgrade()
```

Nunca depender da ordem dos eventos recebidos.

---

## 29. Idempotência

Obrigatória para webhooks e jobs.

```text
mesmo evento chegou 1 vez
ou 5 vezes
→ resultado final idêntico
```

Usar `BillingWebhookEvent` com índice único por provider/evento/tipo.

---

## 30. Jobs e reconciliação

Serviço:

```text
BillingReconciliationService
```

Responsabilidades:

```ts
reconcileSubscription()
reconcileInvoice()

processExpiredSubscriptions()
processGracePeriods()
processScheduledCancellations()
processScheduledChanges()
processExpiredInvoices()
processAbandonedCheckouts()
```

### Expiração

```text
active
autoRenew = false
currentPeriodEnd <= now
→ expired
```

### Fim da tolerância

```text
past_due
gracePeriodEndsAt <= now
→ paused
```

### Cancelamento agendado

```text
scheduled_cancel
currentPeriodEnd <= now
→ canceled
```

### Pix expirado

```text
pix_manual
invoice pending
paymentExpiresAt <= now
→ invoice expired
```

### Checkout abandonado

Sugestão inicial configurável:

```text
30 dias
```

Uma contratação `pending` antiga sem invoice válida pode ser encerrada como abandonada sem excluir o usuário/workspace.

---

## 31. Reconciliação com o provider

O status remoto não é copiado diretamente para o status local.

Exemplo válido:

```text
Mercado Pago = canceled
DaBi = scheduled_cancel
currentPeriodEnd = daqui a 20 dias
```

O provider pode estar cancelado para impedir a próxima cobrança, enquanto o DaBi mantém o acesso até o fim do período pago.

Possíveis divergências:

```text
provider_subscription_missing
provider_active_local_pending
provider_canceled_local_active
local_active_without_provider
invoice_paid_subscription_not_active
invoice_failed_subscription_active
scheduled_change_overdue
webhook_processing_failed
```

Algumas podem ser corrigidas automaticamente; outras devem ser sinalizadas para o super admin.

---

## 32. Concorrência e transações

Jobs, webhooks e ações do usuário podem acontecer simultaneamente.

Operações críticas devem usar:

```text
transação
+
checagem do estado atual
```

Quando necessário:

```text
SELECT ... FOR UPDATE
```

Exemplo: se um webhook já recuperou uma assinatura de `past_due` para `active`, um job antigo não pode depois sobrescrevê-la para `paused`.

---

## 33. Frequência e scheduler dos jobs

A aplicação não depende do Vercel Cron. Em produção, o scheduler atual é o **Upstash QStash**, usado somente como gatilho externo para endpoints HTTP autenticados do DaBi Price.

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

Schedules atuais:

```text
maintenance
/api/cron/billing/maintenance
*/15 * * * *

provider-reconciliation
/api/cron/billing/provider-reconciliation
0 */6 * * *

abandoned-checkouts
/api/cron/billing/abandoned-checkouts
5 3 * * *
```

O job `maintenance` cobre expiração, fim de tolerância, cancelamentos agendados, mudanças agendadas e invoices expiradas. A reconciliação com o provider roda separadamente, assim como a limpeza de checkouts abandonados.

Todos os endpoints exigem o mesmo `CRON_SECRET` configurado no ambiente da Vercel e enviado pelo scheduler no formato:

```http
Authorization: Bearer <CRON_SECRET>
```

O scheduler é uma preocupação operacional substituível. No futuro, QStash pode ser trocado por Vercel Cron, Cloud Scheduler, GitHub Actions ou outro mecanismo sem alterar o domínio de billing.

Liberação após pagamento deve ocorrer via webhook; job é rede de segurança.

---

## 34. Super Admin

Area administrativa independente dos entitlements do workspace. `super_admin`
e uma conta de plataforma, fora de plano comercial: nao exibe plano ou upgrade
e nao sofre paywall, limites de seats ou limites funcionais comerciais. Mantem
acesso integral a `/admin` e pode operar o app no contexto administrativo de
qualquer workspace.

Rotas previstas:

```text
/admin
/admin/dashboard
/admin/workspaces
/admin/assinaturas
/admin/pagamentos
/admin/eventos
/admin/sistema
```

Indicadores:

```text
MRR
ARR
assinaturas ativas
novas assinaturas
cancelamentos
churn
Start / Pro / Max
mensal / anual
Pix manual / cartão recorrente
past_due
paused
scheduled_cancel
expired
pagamentos pendentes
pagamentos falhos
receita
webhooks com erro
divergências de billing
backlog de reconciliação
```

Operações administrativas previstas:

```text
ver assinatura
ver invoices
ver timeline
consultar provider
conceder accessUntil
corrigir exceções
cancelar assinatura
acompanhar divergências
```

Nao existe editor generico de banco. Operacoes administrativas devem ser acoes
especificas e controladas. Toda acao sensivel deve gerar auditoria com ator,
entidade, valor anterior, valor novo, motivo quando aplicavel e data/hora.

### Modo administrativo de workspace

O Super Admin localiza um workspace e entra no seu contexto por uma acao
explicita, como `Entrar no workspace`. Esse modo nao altera silenciosamente a
identidade efetiva: toda acao continua atribuida ao `super_admin` e a interface
deve exibir persistentemente `Visualizando como Super Admin - Workspace <nome>`.

Cadastro e UI comuns nao podem criar ou promover `super_admin`; usuarios comuns
nao podem alterar ou remover essa conta; e a ultima conta `super_admin` nao
pode ser removida. 2FA de Super Admin e hardening obrigatorio antes da release
final.

---

## 35. Observabilidade

Jobs devem registrar pelo menos:

```text
processed
changed
failed
duration
```

Exemplo:

```text
processed = 150
changed = 12
failed = 2
duration = 4.3s
```

Falhas de webhook e reconciliação não devem ser silenciosas.

---

## 36. Estrutura de diretórios sugerida

```text
src/
└── lib/
    └── billing/
        ├── types.ts
        ├── constants.ts
        ├── billing-service.ts
        ├── billing-repository.ts
        ├── subscription-state-machine.ts
        ├── entitlement-service.ts
        ├── notification-service.ts
        ├── reconciliation-service.ts
        ├── webhook-service.ts
        │
        ├── providers/
        │   ├── billing-provider.ts
        │   └── mercado-pago/
        │       ├── mercado-pago-provider.ts
        │       ├── mercado-pago-client.ts
        │       ├── mercado-pago-mappers.ts
        │       └── mercado-pago-webhook-adapter.ts
        │
        └── repositories/
            └── prisma-billing-repository.ts
```

Rotas previstas:

```text
src/app/
├── app/
│   ├── checkout/
│   ├── onboarding/
│   └── assinatura/
│
├── admin/
│
└── api/
    ├── billing/
    └── payments/
        └── mercado-pago/
            └── webhook/
```

---

# 37. Plano de implementação

A nova arquitetura deve ser introduzida gradualmente, mantendo o sistema atual operacional até a migração final.

## Fase 1 — Fundação de dados

Criar:

```text
BillingPrice
BillingSubscription
BillingInvoice
BillingSubscriptionChange
BillingPaymentMethod
BillingWebhookEvent
BillingAuditEvent
```

Não remover o billing atual.

## Fase 2 — Tipos e máquina de estados

Criar:

```text
BillingPlanId
BillingCycle
BillingSubscriptionStatus
BillingInvoiceStatus
BillingPaymentMethodType
```

Implementar state machine e testes de transição.

## Fase 3 — BillingService

Implementar as regras centrais sem depender do Mercado Pago.

## Fase 4 — Planos e preços

Os nomes comerciais são DaBi Start, DaBi Pro e DaBi Max, mantendo os IDs técnicos `starter/growth/scale` já estabilizados pela implementação.

Adicionar/manter preços `monthly` e `annual` sem exigir migração estética dos IDs técnicos.

## Fase 5 — Entitlements

Criar `EntitlementService` e substituir gradualmente o paywall atual.

## Fase 6 — Tela de assinatura

Criar:

```text
/app/assinatura
```

Inicialmente em modo de leitura.

## Fase 7 — Banners

Criar `BillingNotificationService`.

Implementar:

```text
expiring_soon
past_due
scheduled_cancel
paused
```

## Fase 8 — BillingProvider

Criar a interface abstrata e implementar `MercadoPagoProvider`.

## Fase 9 — Novo checkout

Fluxo:

```text
plano
ciclo
cadastro
pending
pagamento
ativação
onboarding
```

## Fase 10 — Pix manual

Implementar primeiro o pagamento avulso por Pix.

## Fase 11 — Cartão recorrente

Migrar recorrência de cartão para o novo provider.

## Fase 12 — Webhooks

Refatorar para:

```text
adapter
→ BillingWebhookService
→ BillingService
```

## Fase 13 — Jobs e reconciliação

Status atual: **implementado e operacional**.

Componentes:

```text
expiration
grace period
scheduled cancellation
scheduled changes
expired invoices
abandoned checkout
provider reconciliation
```

Os endpoints ficam em `/api/cron/billing/*` e o agendamento de produção é feito pelo Upstash QStash, autenticado por `CRON_SECRET`.

## Fase 14 — Cancelamento

Implementar `scheduled_cancel`, reversão e encerramento ao fim do período.

## Fase 15 — Downgrade

Implementar mudança agendada para o próximo período.

## Fase 16 — Upgrade

Implementar crédito proporcional, invoice de upgrade e aplicação após pagamento.

## Fase 17 — Ciclo anual

Implementar valor total anual e 12 meses de acesso. Parcelamento continua sendo detalhe do provider.

## Fase 18 — Pix Automático

**Fora do escopo atual / future feature.** Este item registra a extensão
arquitetural originalmente avaliada. Não é fase obrigatória, não bloqueia
release e só poderá ser priorizado em ciclo futuro, após confirmação do
contrato técnico do provider, sem remodelar o domínio.

## Fase 19 — Super Admin

Criar dashboards e ferramentas administrativas.

## Fase 20 — Migração do billing legado

Migrar o billing atualmente armazenado nas preferências do workspace.

Exemplo conceitual:

```text
unpaid
→ nenhuma assinatura corrente

active
→ BillingSubscription active

pending
→ avaliar/migrar

canceled
→ histórico quando aplicável

internal
→ política administrativa própria
```

## Fase 21 — Limpeza

Somente após validação da nova arquitetura remover:

```text
workspacePreferences.subscription como fonte de verdade
helpers antigos
paywall antigo
preapprovalPlanId
variáveis NEXT_PUBLIC_MP_SUBSCRIPTION_* obsoletas
rotas de teste antigas
status legados
```

---

## 38. Decisões ainda abertas, sem impacto estrutural

Alguns detalhes ainda precisam ser confirmados durante a implementação:

1. meios de pagamento efetivamente disponíveis na conta;
2. comportamento de parcelamento anual no provider;
3. estratégia técnica para alterar recorrência após upgrade/downgrade;
4. valores comerciais finais mensal/anual;
5. quantidade definitiva de dias de tolerância;
6. prazo definitivo para checkout `pending` ser considerado abandonado;
7. política jurídica final de arrependimento, reembolso e exclusão/retenção de dados.

Registro histórico fora do escopo atual: o contrato técnico exato do Pix
Automático no Mercado Pago continua pendente e somente será relevante se a
future feature for priorizada.

Esses pontos devem ser tratados como configuração, política comercial ou implementação de provider — e não como motivo para redesenhar o domínio.

---

## 39. Regra para futuras decisões

Ao adicionar uma funcionalidade de billing, classificar primeiro a responsabilidade:

```text
É regra de negócio do DaBi?
→ BillingService / EntitlementService

É uma cobrança?
→ BillingInvoice

É mudança de plano/ciclo?
→ BillingSubscriptionChange

É dado ou operação externa?
→ BillingProvider

É evento externo?
→ BillingWebhookService

Depende de tempo ou recuperação de inconsistência?
→ BillingReconciliationService

É comunicação visual?
→ BillingNotificationService

É exceção administrativa?
→ Super Admin + BillingAuditEvent
```

---

## 40. Resultado esperado

Ao final, o DaBi Price deverá suportar:

```text
DaBi Start
DaBi Pro
DaBi Max

Mensal
Anual

Pix manual
Cartão recorrente

Renovação manual
Renovação automática

Upgrade
Downgrade
Cancelamento
Reversão de cancelamento

Past due
Período de tolerância
Suspensão
Expiração

Retorno de cliente antigo
Preservação de dados

Banners de billing
Paywall centralizado
Entitlements centralizados

Webhooks idempotentes
Reconciliação automática
Jobs operacionais autenticados
Scheduler externo substituível

Auditoria completa
Super Admin
Dashboards de billing
```

Sem que as regras centrais dependam diretamente do Mercado Pago, da Vercel ou do scheduler externo utilizado em produção.
