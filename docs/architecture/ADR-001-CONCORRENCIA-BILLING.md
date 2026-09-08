# ADR-001: Modelo de concorrência do billing

**Status:** Aceita em 08/09/2026 (PR #69)
**Data:** 07/09/2026
**Decisor:** responsável técnico do DaBi Price
**Fase relacionada:** Fase 6 do `docs/PLANO-FINAL-DABI-PRICE-100.md`

## Contexto

A Fase 6 do plano final cobra, entre os itens de hardening, `Transações`,
`Locking`, `Optimistic concurrency` e `SELECT ... FOR UPDATE ou equivalente`.
Esses quatro itens estão abertos desde a criação do plano, e a leitura literal
deles sugere um trabalho que **não pode ser feito nesta arquitetura**.

O motivo é o driver. O billing acessa o Postgres pelo
`@neondatabase/serverless` sobre HTTP, cujo `sql.transaction([...])` recebe uma
**lista de statements** montada de antemão. Não existe transação interativa: não
há como executar `SELECT ... FOR UPDATE`, decidir em JavaScript com o resultado
e emitir o `UPDATE` correspondente dentro da mesma transação. Em
`src/lib/billing/repository.ts` o número de usos de `sql.transaction` é zero.

Isso não é um descuido, e o código não ficou sem proteção. Ao longo das PRs de
billing foi construído outro modelo, que resolve o mesmo problema por statement
único. O que falta é **registrar esse modelo como decisão** — hoje ele existe
apenas espalhado por implementação e por notas de execução, e cada leitura do
plano recria a dúvida.

## Decisão

Adotar formalmente **exclusão mútua por statement atômico e claims duráveis com
lease** como o modelo de concorrência do billing, e tratar os itens
`Transações`, `Locking` e `SELECT ... FOR UPDATE` da Fase 6 como respondidos
por este ADR, não por implementação futura.

Manter em aberto, como trabalho real, apenas o item `Optimistic concurrency`,
que hoje existe de forma parcial (ver Consequências).

### O que já está implementado

Todos os mecanismos abaixo foram verificados no código em 07/09/2026.

**1. Compare-and-set na própria linha.** `updateBillingInvoice` aceita um
`expectedStatus` e emite `WHERE id = ? AND (expected IS NULL OR status =
expected)` com `RETURNING`
(`src/lib/billing/repository.ts:1327`, função `updateBillingInvoice`). Webhook, reconciliação e expiração
disputam a mesma transição `pending → pago`: só a operação vencedora recebe
linha de volta, e só ela aplica ativação, renovação, tolerância ou auditoria.

**2. Claim durável por invoice, com lease e token de posse.**
`claimBillingInvoiceEffect` (`repository.ts:1016`) faz `INSERT ... ON CONFLICT (invoice_id) DO UPDATE
... WHERE completed_at IS NULL AND (claim_expires_at IS NULL OR claim_expires_at
<= NOW()) RETURNING claim_token` — aquisição em um único statement, lease de
cinco minutos. O `completed_at` é o que torna o claim **durável**: uma invoice
paga cujo efeito comercial não foi concluído fica visível para a reconciliação,
que retoma ativação, renovação, upgrade ou mudança de ciclo interrompidos.

**3. Claim de operação por assinatura.**
`claimBillingSubscriptionOperation` (`repository.ts:1098`), mesmo padrão, sem `completed_at`: é
exclusão mútua pura entre comandos do usuário, jobs e sincronização de eventos.
Quem perde recebe `409` antes de qualquer mutação externa.

**4. Claim do evento de webhook.** `UPDATE billing_webhook_events SET status =
'processing' ... WHERE ... AND status IN ('received', 'failed') RETURNING`
(`repository.ts:1788`): dez entregas simultâneas do mesmo evento produzem um
único processamento, e as demais respondem `200` como duplicata.

**5. Unicidade no banco.** `ON CONFLICT (provider, provider_event_id,
event_type)` para eventos e um índice único parcial `(provider,
provider_payment_id) WHERE provider_payment_id IS NOT NULL` para invoices.

**6. Idempotency keys** nas chamadas ao provider, montadas antes da primeira
tentativa (PR #67), de modo que um retry chegue com a mesma chave.

## Opções consideradas

### Opção A — Manter o modelo atual e documentá-lo (recomendada)

| Dimensão | Avaliação |
| --- | --- |
| Complexidade | Baixa: nada muda no runtime |
| Custo | Só o custo de escrever este ADR |
| Escalabilidade | Alta: statement único, sem conexão presa, adequado a serverless |
| Familiaridade da equipe | Total: é o modelo que já está em produção e coberto por testes |

**Prós:** não há migração nem risco de regressão; o padrão é o correto para
driver HTTP e função efêmera; a suíte de concorrência existente continua válida.

**Contras:** invariantes que envolvem várias linhas não têm atomicidade; a
garantia depende de cada operação ser desenhada como um statement decisivo, o
que é uma disciplina, não algo que o compilador cobre.

### Opção B — Migrar o billing para `Pool` por WebSocket

| Dimensão | Avaliação |
| --- | --- |
| Complexidade | Alta: troca de driver na camada mais crítica |
| Custo | Migração, reescrita de testes de integração, revisão de todo o repositório |
| Escalabilidade | Pior em serverless: conexão persistente por invocação, pool a gerenciar |
| Familiaridade da equipe | Baixa: nenhum código atual usa esse caminho |

**Prós:** `SELECT ... FOR UPDATE` e transações interativas de verdade;
invariantes multi-linha ficam atômicas.

**Contras:** troca o modelo de concorrência inteiro para atender à letra de um
checkbox; introduz gestão de conexão onde hoje não existe; risco alto numa área
que já está estável e testada.

### Opção C — Híbrido: `Pool` apenas onde houver invariante multi-linha

| Dimensão | Avaliação |
| --- | --- |
| Complexidade | Média-alta: dois drivers convivendo |
| Custo | Menor que B, mas duplica o modelo mental |
| Escalabilidade | Boa no caminho comum, pior nos pontos migrados |
| Familiaridade da equipe | Média |

**Prós:** resolve casos específicos sem migrar tudo.

**Contras:** duas formas de acessar o banco na mesma camada é a origem clássica
de bug sutil; e hoje **não há um caso concreto identificado** que exija isso.
Sem esse caso, é complexidade especulativa.

## Análise de trade-off

A pergunta que decide não é "queremos `FOR UPDATE`?", e sim "existe hoje um
invariante que só transação interativa protege?". Levantando o código, os
pontos críticos de billing são todos decididos por **uma** linha: a transição da
invoice, a posse do claim, o status do evento. Para esses, o statement único é
tão forte quanto o lock — e melhor, porque não mantém conexão aberta enquanto o
provider externo responde.

O que o modelo atual não protege é atualização de campos diferentes da mesma
assinatura por operações concorrentes: o claim serializa quem passa pelo caminho
com claim, mas escritas fora dele fazem last-write-wins. Esse é um problema real
e **não se resolve com `FOR UPDATE`**; resolve-se com versão de linha, que é
justamente o item que fica aberto.

Por isso a Opção A não é "não fazer nada": ela redireciona o trabalho da Fase 6
do item errado para o item certo.

## Consequências

**Fica mais fácil:** entender por que o billing não usa transação; revisar PRs
com um critério explícito ("esta operação é decidida por um statement?"); manter
o custo de execução baixo em serverless.

**Fica mais difícil:** qualquer invariante que precise abranger várias linhas
atomicamente. Se aparecer um, ele exige revisitar este ADR — não improvisar.

**O que precisa ser revisitado:**

1. **Lease sem fencing token.** O token de posse é conferido no `complete` e no
   `release`, mas **não** nas escritas feitas durante a operação
   (`runWithBillingSubscriptionOperationClaim` executa `operation()` sem passar o
   token adiante). Se uma operação passar dos cinco minutos de lease, outra pode
   adquirir o claim e as duas escrevem. É o problema clássico de lease sem
   fencing, e hoje é o furo mais provável do modelo.
2. **Optimistic concurrency parcial.** Existe via `expectedStatus`, ou seja,
   apenas para transição de status. Não cobre atualização de outros campos.
3. **Claim perdido.** `billing.claim_lost` reporta, mas não há rotina definida
   para um claim expirado com efeito incompleto fora do caminho da invoice.

## Itens de ação

1. [x] Aceitar este ADR e marcar `Transações`, `Locking` e
       `SELECT ... FOR UPDATE ou equivalente` na Fase 6 referenciando-o.
       Feito em 08/09/2026.
2. [ ] Adicionar coluna de versão em `BillingSubscription`, incrementada em toda
       mutação, com `WHERE version = ?` nas releituras feitas dentro do claim —
       fecha `Optimistic concurrency`.
3. [ ] Avaliar fencing: conferir o token de posse nas escritas críticas da
       operação, ou reduzir o lease para menos que o timeout máximo de uma
       chamada externa.
4. [ ] Cobrir os três cenários concorrentes ainda sem teste: webhook ×
       reconciliation na mesma invoice, cancelamento × pagamento aprovado,
       mudança de ciclo agendada × webhook de renovação.
5. [ ] Definir o comportamento da reconciliação diante de claim expirado com
       efeito incompleto fora do caminho da invoice.
