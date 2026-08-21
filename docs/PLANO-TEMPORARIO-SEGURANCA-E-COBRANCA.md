# Plano Temporario: Seguranca e Cobranca

> Status: em andamento
>
> Este arquivo e temporario. Deve ser removido do repositorio quando todos os
> itens estiverem implementados, validados em homologacao e publicados.

## Objetivo

Corrigir os riscos identificados na landing page, autenticacao e integracao de
cobranca com Mercado Pago, sem liberar estados incorretos de assinatura ou
acesso ao produto.

## Ordem de execucao

1. Estado de assinatura do workspace.
2. Seguranca do webhook do Mercado Pago.
3. Protecao contra abuso nas rotas de autenticacao.
4. Validacao ponta a ponta em homologacao.
5. Operacao, alertas e publicacao.

## 1. Estado de assinatura do workspace

**Prioridade:** critica  
**Responsavel:** a definir  
**Status:** verificado; não requer alteração de código

### Verificação

O billing é a fonte de verdade do estado comercial. As preferências do
workspace persistem apenas dados locais, como assentos e a trava de checkout,
e recebem a projeção da assinatura de billing no carregamento.

### Acoes

- [x] Confirmar que billing é a fonte de verdade e que a projeção não depende
  do espelho persistido em preferências.
- [x] Confirmar a cobertura de estados ativos, pendentes e terminais na suíte
  de billing e projeção de workspace.

### Criterio de aceite

O plano, o status e o acesso do workspace refletem o ultimo estado confirmado
do Mercado Pago, inclusive apos eventos atrasados, duplicados ou terminais.

## 2. Seguranca do webhook do Mercado Pago

**Prioridade:** critica  
**Responsavel:** a definir  
**Status:** código concluído; aguarda configuração e homologação

### Problema

Sem `MERCADO_PAGO_WEBHOOK_SECRET`, a aplicacao ainda processa eventos. Em
producao, essa configuracao deve impedir o processamento, e nao apenas deixar a
validacao opcional.

### Acoes

- [x] Exigir `MERCADO_PAGO_WEBHOOK_SECRET` e falhar de forma segura quando
  estiver ausente.
- [x] Rejeitar assinaturas inválidas e requisições malformadas antes de
  consultar o provedor.
- [x] Preservar a idempotência por evento existente no serviço de billing.
- [x] Registrar falhas com metadados mínimos, sem payload bruto.
- [ ] Configurar o segredo de webhook em todos os ambientes de deploy.
- [ ] Homologar assinatura válida, inválida e ausente com o Mercado Pago.

### Criterio de aceite

Nenhum webhook sem assinatura valida pode alterar dados de cobranca ou acesso;
eventos validos duplicados geram apenas um efeito.

## 3. Protecao de autenticacao contra abuso

**Prioridade:** alta  
**Responsavel:** a definir  
**Status:** código concluído; aguarda validação em infraestrutura compartilhada

### Problema

A rota de login nao possui limitacao de tentativas. Cadastro e recuperacao usam
limitador em memoria, que nao e confiavel entre instancias ou apos reinicios.

### Acoes

- [x] Adicionar rate limit ao login.
- [x] Usar PostgreSQL compartilhado quando `DATABASE_URL` está configurada,
  mantendo fallback em memória apenas no modo local.
- [x] Aplicar limites por IP e e-mail nas rotas públicas de autenticação.
- [x] Usar mensagens genéricas no login e `Retry-After` nas respostas de
  bloqueio.
- [x] Adicionar e atualizar testes do limitador.
- [ ] Validar o comportamento em múltiplas instâncias de homologação.

### Criterio de aceite

Tentativas repetidas de login, cadastro e recuperacao sao limitadas de forma
consistente em todas as instancias da aplicacao.

## 4. Validacao em homologacao

**Prioridade:** alta  
**Responsavel:** a definir  
**Status:** pendente; requer ambiente externo do Mercado Pago

### Cenarios obrigatorios

- [ ] PIX criado e pago com aprovacao confirmada pelo Mercado Pago.
- [ ] PIX pendente, expirado, recusado ou cancelado.
- [ ] Assinatura criada, ativa, inadimplente, pausada e cancelada.
- [ ] Webhook duplicado, atrasado, invalido e entregue fora de ordem.
- [ ] Indisponibilidade temporaria do Mercado Pago e reconciliacao posterior.
- [ ] Verificacao de que o acesso somente muda por estado confirmado.

### Criterio de aceite

Todos os cenarios possuem evidencia de teste e nao ha concessao ou revogacao
indevida de acesso.

## 5. Operacao e publicacao

**Prioridade:** media  
**Responsavel:** a definir  
**Status:** runbook documentado; aguarda configuração e validação de produção

### Acoes

- [x] Documentar variáveis obrigatórias de produção em `.env.example`,
  incluindo `MERCADO_PAGO_WEBHOOK_SECRET` e `CRON_SECRET`.
- [x] Confirmar o console existente de eventos e backlog em `/admin/eventos`
  e `/admin/sistema`.
- [x] Definir o runbook abaixo para pagamentos pendentes, eventos falhos e
  estados inconsistentes.
- [x] Remover o payload bruto dos logs de erro de webhook.
- [ ] Configurar alertas externos a partir dos logs e do backlog operacional.
- [ ] Confirmar no provedor de deploy que os jobs e variáveis estão ativos.
- [ ] Concluir revisao de seguranca antes da publicacao.

### Criterio de aceite

A equipe consegue identificar, diagnosticar e corrigir falhas de cobranca sem
alterar manualmente o acesso de forma insegura.

## Runbook operacional

### Rotina

- Acompanhar `/admin/sistema` e `/admin/eventos` ao menos uma vez por dia útil.
- Investigar imediatamente qualquer `webhook_processing_failed` ou backlog de
  reconciliação diferente de zero.
- Confirmar que os jobs externos usam `Authorization: Bearer <CRON_SECRET>`:
  `maintenance` a cada 15 minutos, `provider-reconciliation` a cada 6 horas e
  `abandoned-checkouts` diariamente às 03:05.

### Pagamento confirmado sem acesso

1. Localizar a invoice e a assinatura em `/admin/assinaturas`.
2. Conferir o evento correspondente em `/admin/eventos` e o ID do pagamento
   no Mercado Pago.
3. Executar ou aguardar a reconciliação do provider; não conceder acesso
   manualmente enquanto o estado do pagamento não estiver confirmado.
4. Se for necessário usar `accessUntil` como exceção, registrar a justificativa
   no histórico administrativo e remover a exceção após a reconciliação.

### Webhook recusado ou falho

1. Para `MP_WEBHOOK_SECRET_MISSING`, configurar o segredo no ambiente e
   reenviar o evento pelo Mercado Pago.
2. Para `MP_WEBHOOK_INVALID_SIGNATURE`, confirmar o segredo e a URL cadastrada
   no Mercado Pago. Não desabilitar a validação como forma de contingência.
3. Para falha de processamento, consultar o `requestId`, o evento no painel e
   executar a reconciliação depois de corrigir a causa.

### Falha de cron ou reconciliação

1. Verificar se `CRON_SECRET` existe e se o agendador envia o header `Bearer`.
2. Consultar a entrega no QStash e a resposta HTTP do endpoint de cron.
3. Corrigir a configuração e reexecutar apenas o job afetado.
4. Registrar o incidente quando houver alteração de acesso, pagamento ou dado
   comercial.

## Condicao para remocao deste arquivo

- [ ] Itens 1 a 5 concluidos.
- [ ] Testes automatizados e cenarios de homologacao aprovados.
- [ ] Alteracoes publicadas em producao.
- [ ] Monitoramento e runbook confirmados pela equipe responsavel.
- [ ] Este arquivo removido em um commit dedicado de limpeza.
