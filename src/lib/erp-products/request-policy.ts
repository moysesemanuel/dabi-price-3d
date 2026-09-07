/**
 * Regra de timeout e retry da chamada ao ERP.
 *
 * Fica fora da rota de proposito: e uma decisao de risco (quando repetir um
 * POST que grava produto) e precisa ser verificavel por teste, nao lida no meio
 * do handler.
 *
 * O endpoint do ERP faz trabalho diferente conforme o payload. Sem publicacao
 * no Mercado Livre ele grava o produto, publica na loja e sincroniza o
 * e-commerce: banco mais um salto HTTP interno. Com publicacao, ainda chama a
 * API do Mercado Livre, que passa a dominar o tempo total.
 *
 * Um unico timeout para os dois casos escolhe o pior lado das duas pontas: e
 * espera demais para o usuario descobrir que o ERP esta fora, e de menos para a
 * publicacao externa, que pode estourar depois de o produto ja ter sido gravado.
 */

export const ERP_REQUEST_TIMEOUT_MS = 8_000;
export const ERP_MERCADO_LIVRE_REQUEST_TIMEOUT_MS = 20_000;

/** Duas tentativas, e nao tres: o usuario esta parado esperando a resposta. */
export const ERP_RETRY_MAX_ATTEMPTS = 2;

export type ErpRequestPolicy = {
  timeoutMs: number;
  canRetry: boolean;
  maxAttempts: number;
};

export function resolveErpRequestPolicy(input: {
  sku?: string | null;
  publishToMercadoLivre?: boolean;
}): ErpRequestPolicy {
  const publishesToMercadoLivre = input.publishToMercadoLivre === true;
  const hasSku =
    typeof input.sku === "string" && input.sku.trim().length > 0;

  /**
   * `saveSalesProduct` roda com `upsertBySku`, entao repetir a chamada com o
   * mesmo SKU converge para o mesmo produto. Sem SKU o ERP gera um
   * (`allowGeneratedSku`), e a repeticao criaria um segundo cadastro.
   *
   * A publicacao no Mercado Livre fica fora do retry mesmo com SKU: ela nao e
   * idempotente ponta a ponta e duas tentativas de vinte segundos deixariam o
   * usuario esperando quarenta.
   */
  const canRetry = hasSku && !publishesToMercadoLivre;

  return {
    timeoutMs: publishesToMercadoLivre
      ? ERP_MERCADO_LIVRE_REQUEST_TIMEOUT_MS
      : ERP_REQUEST_TIMEOUT_MS,
    canRetry,
    maxAttempts: canRetry ? ERP_RETRY_MAX_ATTEMPTS : 1,
  };
}
