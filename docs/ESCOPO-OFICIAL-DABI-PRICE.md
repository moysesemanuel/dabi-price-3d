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
- Pix manual, cartao recorrente e Pix Automatico pelo dominio de billing.
- Checkout, invoices, assinaturas, entitlements, paywall e banners comerciais.
- Upgrade, downgrade, mudanca de ciclo, cancelamento, tolerancia e expiracao.
- Webhooks assinados, idempotencia, auditoria, jobs e reconciliacao.
- Console de Super Admin para usuarios, workspaces, assinaturas, pagamentos,
  eventos, auditoria e saude operacional.

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
