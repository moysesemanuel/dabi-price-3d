import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/app/planos/page.tsx", import.meta.url),
  "utf8",
);

test("a pagina de planos usa os tokens, como o resto do funil", () => {
  const hexes = source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  assert.deepEqual(
    hexes,
    [],
    `hex fixo restante: ${hexes.slice(0, 6).join(", ")}`,
  );
  assert.match(source, /landing-root/, "falta abrir o escopo de tokens");
});

test("nao sobrou texto escrito de dentro para fora", () => {
  // Cada um destes estava na pagina publica, descrevendo o funil ou a
  // arquitetura para quem construiu o produto — nao para quem vai comprar.
  const internalPhrases = [
    "URL do plano",
    "navegação pública",
    "substitui o checkout",
    "acesso ao projeto",
    "A landing educa",
    "vem da landing",
    "essa faixa",
    "faixa correta",
    "faixa certa",
  ];

  for (const phrase of internalPhrases) {
    assert.ok(
      !source.includes(phrase),
      `"${phrase}" e vocabulario interno e nao pode aparecer na pagina publica`,
    );
  }
});

test("o Max aparece como futuro, e nao a venda", () => {
  // Regra do escopo: Max e mostrado como futuro e nao deve ser comercializado
  // antes de automacoes e ERP.
  assert.match(
    source,
    /isPurchasable|comingSoon|emBreve/,
    "a pagina precisa distinguir plano vendavel de plano futuro",
  );
  assert.match(source, /Em breve/i, "o Max precisa se identificar como futuro");
});

test("o preco declara Pix e parcelamento com juros", () => {
  // Regra do escopo: o valor exibido e a vista no Pix; cartao parcela em ate
  // 10x com juros informado antes da confirmacao.
  assert.match(source, /Pix/, "falta declarar que o preco e a vista no Pix");
  assert.match(source, /juros/, "falta declarar os juros do parcelamento");
});

test("os caminhos de conversao continuam de pe", () => {
  for (const route of ['"/login"', '"/contato"', '"/cadastro"']) {
    assert.ok(source.includes(route), `rota ${route} sumiu`);
  }
  for (const anchor of ["#planos", "#comparacao", "#duvidas"]) {
    assert.ok(source.includes(anchor), `ancora ${anchor} sumiu`);
  }
  assert.match(source, /resolvePlanHref/, "o roteamento por sessao sumiu");
  assert.match(source, /selectedBillingCycle/, "o alternador de ciclo sumiu");
  assert.match(source, /planFeatureRows/, "a tabela de comparacao sumiu");
});
