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

- [x] `DATABASE_URL`
- [x] `MERCADO_PAGO_ACCESS_TOKEN`
- [x] `MERCADO_PAGO_WEBHOOK_SECRET`
- [x] `MERCADO_PAGO_TEST_ACCESS_TOKEN`, onde aplicável
- [x] `MERCADO_PAGO_TEST_SITE_ID`
- [x] `CRON_SECRET`
- [x] `RESEND_API_KEY`
- [x] `AUTH_EMAIL_FROM`
- [x] `BLOB_READ_WRITE_TOKEN`
- [x] `MELI_CLIENT_ID`
- [x] `MELI_CLIENT_SECRET`
- [x] `MELI_REDIRECT_URI`
- [x] `ERP_APP_URL`
- [x] `PRICING_INTEGRATION_TOKEN`
- [x] Demais variáveis efetivamente utilizadas pelo código.

## Configuração

- [ ] Separar claramente Development / Preview / Production.
- [x] Confirmar que nenhum secret está exposto como `NEXT_PUBLIC_*`.
- [x] Remover variáveis mortas.
- [x] Confirmar HTTPS em URLs externas.
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
- A listagem da Vercel em 22/08/2026 confirmou essas variáveis em Production e
  Preview. Development contém somente `BLOB_READ_WRITE_TOKEN`,
  `BLOB_STORE_ID` e `BLOB_WEBHOOK_PUBLIC_KEY`; não há segredo de produção
  configurado nesse ambiente.
- A comparação estática entre `process.env.*` e `.env.example` confirmou que
  os valores configuráveis usados pelo código estão documentados, incluindo
  bootstrap, contexto opcional do ERP e o fallback legado do Mercado Livre.
  `NODE_ENV` e `VERCEL_ENV` são fornecidas pela plataforma. As URLs fixas de
  Mercado Pago, Mercado Livre, Resend e Frankfurter usam HTTPS. Em 22/08/2026,
  `ERP_APP_URL` e `MELI_REDIRECT_URI` também foram confirmadas manualmente com
  esquema `https` na Vercel.

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
- [x] Token expirado tratado.
- [x] Sessão expirada tratada.
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
- [x] reconciliation vs reconciliation
- [x] checkout simultâneo
- [x] upgrade simultâneo
- [x] downgrade simultâneo
- [ ] cancelamento vs pagamento
- [x] pagamento vs expiração
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
- Checkout recorrente e Pix usam a mesma reivindicação atômica em
  `workspace_preferences`: somente a primeira requisição do workspace grava
  `checkoutStartedAt`; as concorrentes recebem `409` até a liberação ou o
  vencimento controlado de dez minutos. Isso impede a criação simultânea de
  novas assinaturas e invoices locais antes da chamada ao provider.
- A transição de uma invoice `pending` para um estado de pagamento agora é
  condicional no banco. Webhook, reconciliação e expiração usam o mesmo
  `UPDATE ... WHERE status = 'pending'`; somente a operação vencedora aplica
  ativação, renovação, tolerância ou auditoria de expiração. As demais saem
  sem repetir o efeito comercial.
- A suíte cobre uma segunda entrega de pagamento que perde a transição sem
  reativar a assinatura, e uma expiração que perde a corrida contra o
  pagamento sem sobrescrever o status ou gravar auditoria indevida.
- Efeitos de invoices pagas agora possuem claim durável por invoice, token de
  posse e lease de cinco minutos. O webhook conclui o claim somente após o
  efeito comercial; em erro ele o libera. A reconciliação também seleciona
  invoices `paid` sem claim concluído e recupera ativação, renovação, upgrade
  ou mudança de ciclo interrompidos.
- A suíte cobre recuperação de ativação após invoice já paga e duas
  reconciliações concorrentes, com uma única ativação efetiva. Cancelamento,
  expiração e mudanças agendadas ainda precisam da mesma análise de claim de
  domínio antes de serem marcados como livres de corrida.
- Os jobs de expiração, fim da tolerância, cancelamento agendado e mudança
  agendada agora obtêm um claim temporário por assinatura antes de alterar
  `BillingSubscription` e a projeção do workspace. O claim tem token de posse,
  lease de cinco minutos e liberação em `finally`; o teste cobre tanto a
  exclusão mútua quanto a liberação após erro e o encaminhamento pelo job.
- Esta camada ainda não cobre integralmente comandos concorrentes iniciados
  pelo usuário nem chamadas externas ao provider. Os comandos atuais possuem
  claim por assinatura; os cenários restantes exigem validação de recuperação
  e concorrência entre webhook, jobs e mudanças agendadas.
- Cancelamento e retomada agora usam o mesmo claim antes de chamar o provider
  e relêem a assinatura dentro da posse do claim. Se outra operação tiver
  alterado a assinatura, a rota devolve `409` sem executar a mutação externa.
  Upgrade, downgrade e mudança de ciclo continuam pendentes porque criam ou
  reconfiguram cobranças e exigem recuperação persistida após o provider.
- Os checkouts Pix de upgrade e de mudança mensal para anual preservam a
  invoice e a mudança pendentes se o provider já devolveu um pagamento, mas a
  persistência local posterior falha. A nova tentativa usa a mesma invoice como
  idempotency key e completa seus dados de pagamento, sem emitir uma segunda
  cobrança.
- Upgrade Pix e mudança mensal para anual obtêm o claim antes de reler
  assinatura e preços, localizar mudança pendente, criar a invoice e chamar o
  provider. Requisições simultâneas recebem `409` antes de gerar uma nova
  cobrança.
- A sincronização de eventos de assinatura também obtém o claim da assinatura
  local antes de atualizar a projeção do workspace. A suíte verifica esse
  encaminhamento; uma colisão com operação do usuário falha para retry do
  webhook, sem escrita concorrente.
- Downgrade e mudança anual para mensal obtêm o mesmo claim antes de reler a
  assinatura e o preço vigente, preparar a recorrência no provider e persistir
  a mudança agendada. Operações concorrentes recebem `409` antes da mutação
  externa.

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
- [x] Disparar reconciliação segura.
- [x] Cancelar assinatura administrativamente.
- [x] Visualizar divergência DaBi × Mercado Pago.
- [x] Corrigir exceções por fluxo controlado.
- [x] Atualizar `accessUntil` com justificativa.
- [x] Registrar histórico de toda ação administrativa.

## Registro de execução

- A ação de reconciliação no console de super admin passa a renderizar os
  findings retornados pelo provider, incluindo divergências como provider ativo
  com assinatura local pendente ou provider cancelado com assinatura local
  ativa. O resultado deixa de ser somente uma contagem e aponta workspace,
  assinatura e invoice afetados.
- A concessão ou remoção de `accessUntil` exige justificativa de até 500
  caracteres. O serviço valida o motivo, a interface impede envio vazio e a
  auditoria registra ator, valor anterior, valor novo e justificativa.

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

- [x] necessária
- [x] migrar
- [x] remover

## Achado de produção

Em 21/08/2026, o workspace do super admin apresentou `pending` nas
preferências legadas sem assinatura corrente no billing. A consulta de
assinatura corrente foi corrigida para também retornar uma assinatura com
`accessUntil` futuro, inclusive se o status comercial for `canceled`. O motor
de entitlement concede a exceção sem alterar esse status ou simular pagamento
aprovado.

## Execução automatizada

- A auditoria classificou as projeções de assentos e claim de checkout como
  necessárias apenas para operação; todas as decisões comerciais foram
  migradas para o billing e os helpers sem consumidores foram removidos.

- Em ambiente com `DATABASE_URL`, o serviço de entitlement não consulta mais
  `workspace_preferences.subscription` quando não existe `BillingSubscription`:
  esse caso passa a ser `no_subscription`. O modo local sem persistência já
  resolve esse estado sem usar a projeção legada. As preferências ainda guardam
  metadados operacionais e o claim de checkout, mas não decidem acesso pago.
- As telas de assinatura e de acompanhamento de upgrade usam a assinatura do
  billing para apresentar plano e ciclo. Sem uma assinatura corrente, exibem o
  estado neutro de ausência de assinatura em vez do espelho legado.
- A página interna de planos usa `BillingSubscription` para plano, status,
  ciclo, elegibilidade e retomada de checkout. A leitura de tolerância e
  `accessUntil` passa pelo serviço de entitlement do billing.
- A notificação global de billing também deixa de usar o espelho legado quando
  não encontra assinatura corrente, evitando alertas comerciais divergentes.
- A tela de checkout lê pendência, plano, ciclo e início diretamente da
  assinatura do billing; sem pendência, usa apenas os parâmetros explícitos da
  nova contratação, sem recuperar dados de `workspace_preferences.subscription`.
- O resumo de conta usa a assinatura corrente para plano e ciclo, mantendo
  preferências apenas para os dados operacionais do workspace.
- O checkout recorrente do Mercado Pago decide a situação atual exclusivamente
  com `BillingSubscription`; o espelho legado deixou de ser consultado até para
  enriquecer logs desse fluxo.
- O dashboard recebe sua leitura comercial do servidor: plano, ciclo e status
  vêm de `BillingSubscription`, e a capacidade vem das memberships persistidas;
  `workspace_preferences.subscription` não define mais esses indicadores.
- A navegação lateral recebe o entitlement efetivo e o plano do servidor, e o
  perfil da empresa usa o plano do billing apenas para apresentação. Assim, o
  espelho local não oculta recursos nem exibe uma faixa comercial divergente.
- A retenção de snapshots de cálculo no servidor determina o limite de
  histórico a partir da assinatura persistida no billing, sem consultar o
  espelho de preferências.
- O cache local deixa de aplicar limite comercial por preferências após um
  salvamento persistente; em modo local sem billing ele usa apenas um teto
  técnico para evitar crescimento ilimitado.
- O helper legado de limite de histórico foi removido por não ter mais
  consumidores; novos limites comerciais devem passar pelo entitlement.

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

## Execução automatizada adicional

- A navegação do produto recebe o entitlement calculado no servidor; a
  projeção de preferências não decide mais quais módulos pagos são exibidos.

---

# Fase 9 — Pix Automático

> **Status atual: FORA DO ESCOPO ATUAL / FUTURE FEATURE.**
>
> Pix Automático não é requisito de conclusão, critério de aceite ou bloqueador
> de release do DaBi Price. A recorrência mensal do escopo atual é atendida por
> cartão recorrente; Pix manual continua disponível para pagamentos não
> recorrentes. O plano anual é pago antecipadamente e concede 12 meses de
> acesso, sem depender de Pix Automático.

## Registro histórico da avaliação

Esta funcionalidade foi avaliada como uma possível extensão do domínio de
billing. O contrato técnico do Mercado Pago para mandato, autorização,
cobrança, eventos, cancelamento, revogação, idempotência e sandbox não foi
confirmado nem homologado. Os tipos e mapeamentos técnicos já existentes não
significam que o fluxo esteja implementado ou habilitado para produção.

Caso seja priorizada em outro ciclo, a feature deverá ter plano próprio,
contrato do provider confirmado, implementação via `BillingProvider`, testes e
homologação E2E antes de ser anunciada ao usuário.

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

- [x] Solicitação.
- [x] E-mail real via Resend.
- [x] Link.
- [x] Token.
- [x] Nova senha.
- [x] Login com nova senha.
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

## Registro de execução

- A gestão de membros possui convites, ativação por link de definição de senha,
  remoção, transferência de ownership e as permissões distintas de owner,
  manager e operator. As regras de autorização e os fluxos locais são cobertos
  pela suíte automatizada.
- Em 22/08/2026, o convite persistido passou a reservar a vaga no banco sob
  lock do workspace e só insere a membership quando a contagem atual é menor
  que o limite de assentos do entitlement. Convites concorrentes não podem
  ultrapassar a capacidade do plano; convites pendentes também ocupam assento.
- A interface recebe `409` com mensagem operacional quando o plano atingiu o
  limite. A validação contra Neon real permanece pendente, pois a suíte local
  não possui banco de integração para executar o lock SQL.

- Em 21/08/2026, a recuperação foi validada no ambiente remoto: solicitação
  aceita pelo Resend, e-mail entregue no Gmail, link aberto, senha atualizada
  e login realizado com a nova credencial. A suíte local também cobre expiração
  e consumo único de token. A confirmação do consumo único contra Neon real
  permanece pendente.

---

# Fase 11 — Precificação

## Objetivo

Homologar completamente o núcleo funcional do produto.

## Casos

- [x] Material.
- [x] Energia.
- [x] Mão de obra.
- [x] Manutenção.
- [x] Embalagem.
- [x] Perdas.
- [x] Margem.
- [x] Impostos.
- [x] Taxas.
- [x] Canais de venda.
- [x] Modelos de negócio.
- [x] Arredondamentos.
- [x] Valores zero.
- [x] Valores extremos.
- [ ] Histórico.
- [ ] Edição.
- [ ] Duplicação, se oficialmente suportada.
- [x] Limites por plano.

## Critério de aceite

O mesmo input produz o mesmo resultado independentemente da UI, com regras financeiras cobertas por testes.

## Registro de execução

- O motor 3D possui testes determinísticos para material, energia, mão de
  obra, manutenção, embalagem, frete, perdas, margem, impostos e taxas. A
  suíte também cobre arredondamento comercial, canais e modelos de venda,
  valores zerados, uma carga alta finita e limites de histórico por plano.
- Histórico persistido, edição e duplicação continuam pendentes de teste de
  integração/E2E, pois não são regras puras do motor financeiro.
- A normalização que precede a persistência de cálculos 3D e de confeitaria
  possui cobertura unitária para tipos, defaults e descarte de campos externos
  ao contrato, inclusive IDs enviados pelo cliente.

---

# Fase 12 — Integração ERP

## Execução automatizada

- O proxy de publicação cancela chamadas ao ERP após 12 segundos e retorna
  `504` com `ERP_UPSTREAM_TIMEOUT`; o evento estruturado
  `erp.upstream_timeout` preserva o `requestId` para diagnóstico. Os demais
  erros de rede continuam respondendo `502`.

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

- [x] Avaliar fallback de token por ambiente.
- [x] Remover se não fizer parte do comportamento oficial de produção.

## Registro de execução

- O fallback global `MELI_ACCESS_TOKEN`/`MELI_USER_ID` foi removido. A única
  integração suportada é OAuth persistente, com token isolado por workspace;
  ambientes sem `DATABASE_URL` e credenciais OAuth deixam a integração
  explicitamente indisponível.

---

# Fase 14 — Arquivos e imagens

## Execução automatizada

- Uploads de logo e imagens de produto exigem sessão autenticada e agora emitem
  token apenas para o namespace `prefixo/<workspaceId>/...` da sessão. MIME
  permitido: JPEG, PNG e WEBP; tamanho máximo: 12 MB; sem
  `BLOB_READ_WRITE_TOKEN`, a rota falha sem liberar token.
- A validação unitária cobre o namespace do workspace e rejeita outro workspace
  ou segmentos de travessia de diretório. Ainda é necessária a validação manual
  em produção para upload, URL final, falha, arquivo inválido e remoção, se
  suportada pelo produto.

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

## Execução automatizada

- As ações administrativas de reconciliação, cancelamento, atualização de
  `accessUntil` e consulta ao provider têm guarda síncrona além do botão
  desabilitado. A validação visual e os fluxos de browser continuam pendentes
  de homologação manual.

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

## Bloqueio operacional

- O repositório não contém integração ou credencial de Sentry, PagerDuty,
  Datadog, Slack ou serviço equivalente. Há logs estruturados, `requestId` e
  backlog administrativo para diagnóstico, mas eles não enviam alertas por si
  só. A conclusão desta fase requer escolher o provedor, conceder acesso e
  configurar o canal de destino na infraestrutura externa.

## Critério de aceite

Falhas críticas geram alerta sem depender de abrir manualmente o painel administrativo.

---

# Fase 17 — Testes automatizados finais

## Unitários

- [x] Regras puras do domínio.

## Integração

- [ ] Repository.
- [ ] Database.
- [x] Billing Service.
- [x] Webhook.
- [x] Auth.
- [x] Provider adapters.
- [x] Jobs/reconciliation.

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

- [x] Todos verdes.
- [x] Evoluir `npm run check` para representar toda a suíte final, se necessário.

## Registro de execução

- A suíte atual cobre regras de precificação, estado e entitlement, Billing
  Service, adaptadores Mercado Pago, webhooks, recuperação/autenticação local,
  controle de acesso e jobs de reconciliação. Em 22/08/2026, `lint`,
  `typecheck`, `test:pricing` (202 testes), `build:webpack` e
  `git diff --check` passaram.
- Testes contra banco real, E2E de browser e homologações externas não foram
  marcados: eles precisam da infraestrutura e dos fluxos manuais definidos nas
  fases correspondentes.
- `npm run check` executa lint, typecheck, a suíte `test:pricing` e o build
  Webpack, concentrando toda a validação local obrigatória do plano em um
  comando.

---

# Fase 18 — Segurança final

## Auditoria

- [x] Secrets commitados.
- [x] `.env.example`.
- [x] Cookies.
- [x] CSRF onde aplicável.
- [x] CORS.
- [x] Autorização.
- [x] IDOR.
- [x] Mass assignment.
- [x] Open redirect.
- [x] Validação de inputs.
- [x] SQL.
- [x] Upload.
- [x] Headers.
- [x] Stack traces.
- [x] Mensagens de erro.
- [x] Logs.
- [x] PII.
- [x] Dependências vulneráveis.
- [x] Rotas de debug/teste esquecidas.
- [x] Todas as rotas `/api`.

## Registro de execução

- A busca no repositório rastreado não encontrou valores literais para os
  secrets operacionais conhecidos. Arquivos de ambiente e dependências foram
  excluídos da verificação por não serem código versionado.
- `npm audit` e `npm audit --omit=dev --audit-level=high`, reexecutados em
  22/08/2026 após atualização controlada para `next@16.3.2`, override
  transitivo de `undici@6.28.0` e updates compatíveis de desenvolvimento,
  não reportam vulnerabilidades. A atualização também resolve a cadeia de
  `postcss`, `sharp`, `nanoid`, `js-yaml` e `brace-expansion`, sem usar
  `npm audit fix --force`.
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
- O `next.config.ts` aplica `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy` e `Permissions-Policy` globalmente. CSP permanece fora
  desta alteração por exigir inventário das integrações externas antes de ser
  restritiva.
- O Preview do PR é protegido por Deployment Protection e responde com `302`
  para o SSO da Vercel antes de alcançar a aplicação; por isso, a confirmação
  remota dos headers do app deve ser feita após o merge em Production ou com
  bypass autenticado, sem desabilitar essa proteção.
- O login só aceita `next` iniciado por `/app`; valores externos retornam ao
  caminho interno calculado pela situação de entitlement e onboarding.
- A revisão das rotas `/api` confirmou que os handlers de workspace usam o
  `workspaceId` da sessão, os administrativos exigem super admin no serviço,
  cron exige segredo e webhook exige HMAC. As exceções sem sessão são os
  fluxos públicos intencionais (autenticação com rate limit, recuperação,
  webhook assinado e cotação pública sem credenciais).
- O `upsert` de `calculation_snapshots` agora atualiza uma colisão de `id`
  somente se ela pertence ao mesmo workspace. Uma colisão entre tenants retorna
  `409`, sem alterar a linha existente. A normalização de cálculos também
  descarta campos não permitidos, inclusive `workspaceId` e `userId` enviados
  pelo cliente.
- Uploads exigem sessão antes de gerar token Blob, restringem prefixo, formato
  e tamanho. Falhas inesperadas do SDK retornam mensagem genérica, sem expor
  detalhes internos.
- Rotas de mutação convertem falhas conhecidas em respostas controladas;
  detalhes e stacks são limitados aos logs sanitizados. O SQL usa o cliente
  parametrizado `@neondatabase/serverless`, sem interpolação de entrada em
  strings de query.
- A consulta de categorias do Mercado Livre passou a registrar exceções pelo
  sanitizador central e a retornar somente a mensagem pública genérica. Assim,
  uma falha de upstream não pode devolver nem registrar mensagem bruta que
  contenha detalhes operacionais ou credenciais.

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
9. Usuário / auth / onboarding
10. Precificação
11. ERP
12. Mercado Livre
13. Uploads
14. UX/UI
15. Alertas
16. Suíte automatizada
17. Auditoria de segurança
18. Backup / LGPD
19. Smoke test produção
20. Limpeza
21. Auditoria 100%
22. Release
```

---

# Regra de execução

> Não iniciar a fase N+1 deixando defeito conhecido ou critério de aceite não cumprido na fase N.

Exceções só podem ocorrer quando uma fase depender tecnicamente de uma fase posterior. Nesse caso, a dependência deve ser registrada explicitamente neste documento.

A Fase 9 é um registro histórico de uma future feature fora do escopo atual e
não participa desta regra de bloqueio.

---

# Critério absoluto de encerramento

Este plano só pode ser marcado como concluído quando:

- [ ] Todas as fases obrigatórias do escopo atual estiverem concluídas.
- [ ] Todos os checkboxes obrigatórios estiverem marcados.
- [ ] Não houver item `parcial`, `faltando` ou `bloqueado` no escopo oficial.
- [ ] Todos os testes automatizados estiverem verdes.
- [ ] Homologação real do Mercado Pago estiver concluída.
- [ ] Jobs estiverem comprovadamente operacionais.
- [ ] Alertas externos estiverem ativos.
- [ ] Super Admin cobrir as operações necessárias.
- [ ] Billing legado não influenciar decisões comerciais.
- [ ] Backup e recuperação estiverem testados.
- [ ] Smoke test completo de produção estiver aprovado.
- [ ] Auditoria final estiver verde.
- [ ] Release final estiver publicada.
