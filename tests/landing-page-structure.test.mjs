import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const landingSource = readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8",
);
const headerSource = readFileSync(
  new URL("../src/components/public/landing-header.tsx", import.meta.url),
  "utf8",
);
const globalsSource = readFileSync(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);
const layoutSource = readFileSync(
  new URL("../src/app/layout.tsx", import.meta.url),
  "utf8",
);

test("a landing preserva as rotas e ancoras de conversao", () => {
  for (const route of ["/login", "/planos", "/cadastro"]) {
    assert.ok(
      landingSource.includes(`"${route}"`),
      `rota ${route} sumiu da landing`,
    );
  }
  for (const anchor of ["#como-funciona", "#planos", "#faq", "#segmentos"]) {
    assert.ok(
      landingSource.includes(anchor) || headerSource.includes(anchor),
      `ancora ${anchor} sumiu da landing`,
    );
  }
  assert.ok(
    landingSource.includes("segmentCards"),
    "os cards de segmento deixaram de ser renderizados",
  );
  assert.ok(
    landingSource.includes("LandingPlanCards"),
    "o bloco de planos deixou de ser renderizado",
  );
});

test("o header usa a marca compartilhada, e nao uma copia local", () => {
  assert.ok(
    headerSource.includes("DabiWordmark"),
    "o header precisa consumir o componente de marca do produto",
  );
  assert.ok(
    !/next\/image/.test(headerSource),
    "a marca e vetor inline; nao deve voltar a ser arquivo de imagem",
  );
  assert.ok(
    !/dabi-lockup__|landing-wordmark__/.test(headerSource),
    "o header nao deve remontar o lockup por conta propria",
  );
});

test("o header tem navegacao mobile acessivel", () => {
  assert.ok(
    headerSource.includes("aria-expanded"),
    "o menu mobile precisa expor aria-expanded",
  );
  assert.ok(
    /aria-controls/.test(headerSource),
    "o botao do menu mobile precisa apontar para o painel via aria-controls",
  );
});

test("a landing usa os tokens da paleta e nao hex solto", () => {
  const hexes = landingSource.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  assert.deepEqual(
    hexes,
    [],
    `a landing deve consumir tokens CSS, mas ainda tem hex fixo: ${hexes.join(", ")}`,
  );
  assert.ok(
    landingSource.includes("landing-root"),
    "a landing precisa abrir o escopo de tokens landing-root",
  );
});

test("os tokens preto/dourado/azul existem nos dois modos", () => {
  for (const token of [
    "--landing-surface",
    "--landing-panel",
    "--landing-ink",
    "--landing-gold",
    "--landing-action",
    "--landing-profit",
    "--landing-muted",
  ]) {
    assert.ok(
      globalsSource.includes(token),
      `token ${token} ausente do globals.css`,
    );
  }
  const darkBlock = globalsSource
    .slice(globalsSource.indexOf(':root[data-theme="dark"] .landing-root'))
    .toUpperCase();
  assert.ok(
    darkBlock.includes("--LANDING-GOLD: #C9A961"),
    "o dourado do modo escuro precisa ser #C9A961",
  );
  assert.ok(
    globalsSource.toUpperCase().includes("--LANDING-GOLD: #A8813A"),
    "o dourado do modo claro precisa escurecer para #A8813A (contraste sobre branco)",
  );
});

test("a fonte display serifada esta registrada no layout", () => {
  assert.ok(
    layoutSource.includes("--font-display-ui"),
    "o layout precisa expor a variavel da fonte display",
  );
  assert.ok(
    layoutSource.includes("instrument-serif-latin.woff2"),
    "a Instrument Serif precisa ser carregada localmente, como a Geist",
  );
});

test("a fonte da marca esta registrada no layout", () => {
  assert.ok(
    layoutSource.includes("--font-brand-ui"),
    "o layout precisa expor a variavel da fonte da marca",
  );
  for (const face of ["fredoka-latin-600.woff2", "fredoka-latin-500.woff2"]) {
    assert.ok(
      layoutSource.includes(face),
      `a Fredoka ${face} precisa ser carregada localmente, sem rede no build`,
    );
  }
});
