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
**Status:** pendente

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
**Status:** pendente

### Acoes

- [ ] Documentar variaveis obrigatorias de producao, incluindo segredo do
  webhook e credenciais do Mercado Pago.
- [ ] Criar alertas para falhas de webhook, falhas de reconciliacao e
  divergencias entre assinatura e acesso.
- [ ] Definir runbook para pagamentos pendentes, eventos falhos e estados
  inconsistentes.
- [ ] Revisar logs para evitar exposicao de dados sensiveis.
- [ ] Concluir revisao de seguranca antes da publicacao.

### Criterio de aceite

A equipe consegue identificar, diagnosticar e corrigir falhas de cobranca sem
alterar manualmente o acesso de forma insegura.

## Condicao para remocao deste arquivo

- [ ] Itens 1 a 5 concluidos.
- [ ] Testes automatizados e cenarios de homologacao aprovados.
- [ ] Alteracoes publicadas em producao.
- [ ] Monitoramento e runbook confirmados pela equipe responsavel.
- [ ] Este arquivo removido em um commit dedicado de limpeza.
