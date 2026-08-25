# Escopo Oficial DaBi Price

> Status: congelado para o ciclo `release/dabi-price-100-percent`.
>
> Novas funcionalidades nao entram neste ciclo sem atualizacao explicita deste
> documento e do `PLANO-FINAL-DABI-PRICE-100.md`.

## Referencias

- `docs/PLANO-FINAL-DABI-PRICE-100.md`: ordem de execucao e criterios de 100%.
- `docs/architecture/ARQUITETURA_BILLING_DABI_PRICE.md`: arquitetura de billing.
- `docs/architecture/BILLING_ARCHITECTURE_AUDIT.md`: auditoria de aderencia.
- `README.md`: instalacao, configuracao e operacao local.

## Produto e usuarios

- Landing pages publicas, planos, cadastro, login, logout e recuperacao de senha.
- Workspaces, onboarding, perfis, preferencias, membros e papeis.
- Precificacao 3D, historico, orcamentos e modelos de orcamento.
- Paginas de conta, assinatura, checkout, suporte e ajuda.

## Billing e cobranca

- Catalogo de planos Start, Pro e Max, com ciclos mensal e anual.
- Pix manual para pagamentos nao recorrentes e cartao recorrente para a
  recorrencia mensal.
- Pix Automatico esta fora do escopo atual (`FUTURE FEATURE`) e nao bloqueia a
  conclusao ou a release deste ciclo.
- Checkout, invoices, assinaturas, entitlements, paywall e banners comerciais.
- Upgrade, downgrade, mudanca de ciclo, cancelamento, tolerancia e expiracao.
- Webhooks assinados, idempotencia, auditoria, jobs e reconciliacao.
- Console de Super Admin para usuarios, workspaces, assinaturas, pagamentos,
  eventos, auditoria e saude operacional.

## Modelo de Super Admin

`super_admin` e uma conta de plataforma, fora de qualquer plano comercial. Como
regra de produto, essa conta:

- nao possui nem exibe plano atual ou upgrade;
- nao sofre paywall, limite de seats ou limite funcional comercial;
- possui acesso integral aos modulos da plataforma, incluindo `/admin`;
- tambem pode usar normalmente o aplicativo no contexto administrativo de um
  workspace.

O Super Admin pode administrar usuarios, workspaces, memberships, roles,
assinaturas, invoices, pagamentos, acessos, sessoes e configuracoes
administrativas permitidas. Nao existe editor generico de banco: qualquer
alteracao deve ocorrer por uma acao administrativa especifica e controlada.

Operacoes administrativas sensiveis devem registrar auditoria com ator,
entidade, valor anterior, valor novo, motivo quando aplicavel e data/hora.

### Modo administrativo de workspace

O Super Admin deve localizar um workspace e entrar em seu contexto por uma acao
explicita, como `Entrar no workspace`. Isso nao e impersonacao silenciosa: as
acoes continuam atribuidas ao `super_admin` e a interface deve manter um aviso
persistente, por exemplo: `Visualizando como Super Admin - Workspace <nome>`.

### Limites de seguranca

- cadastro comum nunca cria `super_admin`;
- a UI comum nunca promove um usuario para `super_admin`;
- usuarios comuns nao podem alterar ou remover uma conta `super_admin`;
- a ultima conta `super_admin` nao pode ser removida;
- operacoes administrativas criticas exigem auditoria;
- 2FA para Super Admin e hardening obrigatorio antes da release final.

O dashboard administrativo deve contemplar visao executiva/comercial, gestao de
usuarios, workspaces, billing, pagamentos, eventos/webhooks, auditoria e modo
administrativo de workspace.

## Integracoes e operacao

- Mercado Pago como provider de cobranca.
- ERP DaBi para produtos e imagens.
- Mercado Livre com OAuth persistente por workspace.
- Upload de arquivos pelo Vercel Blob.
- E-mail transacional pelo Resend.
- PostgreSQL/Neon para persistencia e Upstash QStash para jobs externos.

## Qualidade e seguranca

- Autenticacao, autorizacao por papel e isolamento de workspace.
- Rate limit, cookies de sessao, validacao de inputs e observabilidade por
  `requestId`.
- Testes unitarios, integracao e E2E definidos no plano final.
- Monitoramento, alertas, backup, recuperacao, LGPD e documentacao final.

## Fora do escopo deste ciclo

- Funcionalidades nao documentadas nas referencias acima.
- Mudancas de arquitetura que nao sejam necessarias para satisfazer um criterio
  do plano final.
- Integracoes comerciais ou providers adicionais nao previstos no plano final.
