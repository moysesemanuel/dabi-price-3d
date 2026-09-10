# W2 — Desenho: posse de operação, versão de linha e recuperação de efeito

**Status:** Proposta
**Data:** 08/09/2026
**Decisor:** responsável técnico do DaBi Price
**Depende de:** `ADR-001-CONCORRENCIA-BILLING.md` (aceito em 08/09/2026)

Este documento fecha os três itens que o ADR-001 deixou abertos. Os três são o
mesmo assunto visto de ângulos diferentes — quem pode escrever, como detectar
que alguém escreveu antes, e o que acontece com o efeito quando a disputa é
perdida — e por isso vêm num desenho só.

---

## Parte 1 — Fencing: só quem tem a posse escreve

### O problema

Antes de mexer numa assinatura, a operação adquire um claim com token e lease
de cinco minutos. O token é conferido no `complete` e no `release`, mas **não
nas escritas feitas durante a operação**:
`runWithBillingSubscriptionOperationClaim` executa `operation()` sem repassá-lo.

Se uma operação passar dos cinco minutos, outra adquire o claim legitimamente e
as duas escrevem. É o problema clássico de lease sem fencing token. Hoje isso é
improvável, porque as operações levam segundos — mas é segurança por acidente,
não por desenho. Encurtar o lease reduz a janela sem fechá-la, e foi recusado
como solução em 08/09/2026.

### Opções

**A. Passar o token por parâmetro até cada escrita.** Explícito e rastreável,
mas muda a assinatura de toda função no caminho — de `BillingService` até o
repositório. É o tipo de mudança larga que envelhece mal: qualquer caminho novo
esquece de passar.

**B. Escopo implícito com `AsyncLocalStorage`.** O `runWith...Claim` abre um
escopo carregando o token; o repositório lê o escopo corrente na hora de
escrever. Sem plumbing, e cobre caminhos novos automaticamente.

**C. Não fazer fencing e confiar no lease curto.** Recusado.

### Recomendação: B, com a mesma vala do `requestId`

O `AsyncLocalStorage` resolve dois problemas de uma vez. O `requestId` tem
exatamente a mesma natureza — hoje só a rota do ERP passa o dele, porque as
chamadas nascem em código de lib, longe da rota. Um único **contexto de
operação** carrega os dois:

```text
runWithBillingSubscriptionOperationClaim(subscriptionId)
  └─ abre escopo { claimToken, requestId }
       └─ operation()
            └─ repositório lê o escopo e adiciona a guarda no UPDATE
```

A guarda no SQL não custa consulta extra — entra como condição do mesmo
`UPDATE`, contra a chave primária da tabela de claims:

```sql
UPDATE billing_subscriptions
SET ...
WHERE id = $1
  AND EXISTS (
    SELECT 1 FROM billing_subscription_operation_claims
    WHERE subscription_id = $1 AND claim_token = $2
  )
```

Zero linhas afetadas passa a significar "perdi a posse", e a operação aborta em
vez de sobrescrever.

### Risco e como mitigar

Contexto implícito falha em silêncio quando uma escrita acontece fora do
escopo. Por isso a adoção é em duas etapas:

1. **Permissivo:** escrita sem token no escopo continua passando, mas emite
   evento de observabilidade. O Sentry já está entregando desde 08/09.
2. **Restritivo:** depois de uma semana sem evento, escrita sem posse passa a
   ser recusada.

Sem essa gradação, o primeiro caminho esquecido vira incidente em produção.

---

## Parte 2 — Versão de linha

### O problema

`Optimistic concurrency` hoje existe só para transição de status, via
`expectedStatus` no `updateBillingInvoice`. Duas escritas em campos diferentes
da mesma assinatura ainda fazem last-write-wins.

Vale separar do fencing: a Parte 1 responde "você ainda tem a posse?"; esta
responde "a linha mudou desde que você a leu?". Um claim roubado por quem ainda
não escreveu passa na segunda e falha na primeira; uma escrita legítima fora de
claim passa na primeira e falha na segunda. São proteções complementares.

### Desenho

Migração `0003`: coluna `version INTEGER NOT NULL DEFAULT 1` em
`billing_subscriptions`, incrementada em toda mutação, com `WHERE version = $n`
nas releituras que já acontecem dentro do claim.

Ordem de implantação, que importa:

1. aplicar a migração (código antigo ignora a coluna nova);
2. só então publicar o código que a usa.

Rollback é `DROP COLUMN`: nada além do novo código lê o campo. A migração é
aditiva e com `DEFAULT`, então não há backfill nem tabela travada.

### Custo

Uma condição a mais no `UPDATE` que já existe. Sem consulta extra, sem índice
novo — a busca é por chave primária.

---

## Parte 3 — Recuperação do efeito de pagamento

### O problema, medido no código

O webhook marca a invoice como paga **antes** de disputar o claim da
assinatura. Perdendo a disputa, a transição já aconteceu: a reentrega seguinte
do provider é tratada como duplicata e não aplica efeito comercial nenhum.
Quem recupera é a reconciliação, varrendo invoices pagas com claim de efeito
incompleto. Coberto por teste desde a PR das direções inversas.

O efeito prático é uma janela em que **o cliente pagou e não tem acesso**, do
tamanho do intervalo do cron.

E o cron não pode simplesmente rodar mais vezes. `reconcileProviderState` mistura
dois trabalhos de custo muito diferente na mesma varredura:

| Situação | Trabalho | Custo |
| --- | --- | --- |
| invoice `pending` | consulta o pagamento no Mercado Pago | **1 chamada externa por invoice**, até 100 por execução |
| invoice `paid` com efeito incompleto | `recoverPaidInvoiceEffect` | local, nenhuma chamada externa |

Nosso caso é o barato, preso à cadência do caro. Aumentar a frequência para
recuperar pagamento em um minuto significaria até cem chamadas por minuto ao
provider, sem necessidade.

Há ainda um detalhe de plano de consulta: a busca junta as duas situações num
`OR` entre duas tabelas (`status = 'pending' OR (status = 'paid' AND
completed_at IS NULL)`), o que atrapalha o uso de índice. Separar melhora a
consulta, não só a lógica.

### Desenho, em três camadas

**Camada 1 — o webhook recupera o próprio efeito.** Ao encontrar a invoice já
transicionada, verificar se o claim de efeito ficou incompleto e, se ficou,
aplicar — reusando `recoverPaidInvoiceEffect`, a mesma função da reconciliação.
Custo: uma leitura indexada a mais, só no caminho de duplicata. Ganho: o
provider reentrega em segundos ou minutos, muito antes do cron, e a recuperação
deixa de depender do job no caso comum.

**Camada 2 — separar a varredura em duas.** Uma para invoices pagas com efeito
incompleto (local, barata, pode rodar de minuto em minuto) e outra para consulta
ao provider (cara, mantém a cadência atual). Cada uma com sua consulta, cada uma
usando seu índice.

**Camada 3 — aviso dirigido, só se necessário.** Ao perder a disputa, agendar
uma nova tentativa para aquela invoice em segundos, em vez de esperar varredura.
Custa uma mensagem por incidente. Fica no papel até haver número que a
justifique.

### Antes de tudo: medir

`billing.claim_lost` já é emitido e o Sentry já entrega. Uma semana de dados diz
quantas vezes a disputa é realmente perdida em produção. Se a resposta for zero,
a Camada 1 basta e as outras duas são otimização de um problema que não existe.

---

## Ordem de execução

1. Migração `0003` com a coluna de versão, aplicada antes de qualquer código.
2. Contexto de operação com `AsyncLocalStorage`, carregando `claimToken` e
   `requestId`, em modo permissivo com observabilidade.
3. Guarda de posse e de versão nas escritas de assinatura.
4. Camada 1 da recuperação de efeito.
5. Uma semana de observação; então modo restritivo e decisão sobre as Camadas
   2 e 3.

Cada passo é verificável por teste concorrente no padrão de
`tests/billing-phase-6-concurrency.test.mjs`, e o passo 1 pelo mesmo método já
usado na PR das migrações: aplicar contra um PostgreSQL real e comparar o
schema resultante.

## Itens de ação

1. [ ] Aceitar este desenho.
2. [x] Migração `0003` com `version` em `billing_subscriptions`.
3. [ ] Contexto de operação (`AsyncLocalStorage`) com `claimToken` e `requestId`. `claimToken`
   feito; `requestId` adiado — hoje nada em código de billing o consome, entra fácil no mesmo
   contexto quando houver consumidor real.
4. [x] Guarda de posse e versão nas escritas, em modo permissivo.
5. [x] Recuperação de efeito no caminho de duplicata do webhook. PR #76.
6. [ ] Revisar `billing.claim_lost` no Sentry após uma semana.
7. [ ] Decidir sobre a separação da varredura e o aviso dirigido, com número.
