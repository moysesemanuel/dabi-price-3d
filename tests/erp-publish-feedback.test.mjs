import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL(
  "../src/components/pricing/site-product-publisher.tsx",
  import.meta.url,
);

test("o envio ao Mercado Livre avisa que a espera e normal", async () => {
  const component = await readFile(componentUrl, "utf8");

  assert.match(component, /pode levar um tempinho/i);
  assert.match(component, /resposta do sistema deles/i);
});

test("o aviso so aparece quando a publicacao esta disponivel", async () => {
  const component = await readFile(componentUrl, "utf8");

  // O mesmo bloco atende os dois estados: sem os requisitos, explica o que
  // falta; com eles, avisa da espera. Um `? :` garante que nunca aparecam os
  // dois ao mesmo tempo.
  assert.match(
    component,
    /\{!canPublishToMercadoLivre \? \([\s\S]*?\) : \([\s\S]*?pode levar um tempinho[\s\S]*?\)\}/,
  );
});

test("os botoes de envio continuam protegidos contra clique duplo", async () => {
  const component = await readFile(componentUrl, "utf8");
  const disabledPorEnvio = component.match(/publishState === "submitting"/g) ?? [];

  // Salvar no ERP, salvar e publicar no ML, e os dois rotulos de progresso.
  assert.ok(disabledPorEnvio.length >= 4);
});
