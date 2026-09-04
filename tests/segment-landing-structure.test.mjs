import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const templateSource = read("src/components/public/segment-landing-page.tsx");
const calculatorSource = read(
  "src/components/public/confectionery-landing-calculator.tsx",
);
const toggleSource = read("src/components/public/landing-theme-toggle.tsx");
const headerSource = read("src/components/public/landing-header.tsx");

const publicSurfaces = {
  "segment-landing-page.tsx": templateSource,
  "confectionery-landing-calculator.tsx": calculatorSource,
};

test("as paginas de segmento usam os tokens, como a home", () => {
  for (const [name, source] of Object.entries(publicSurfaces)) {
    const hexes = source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    assert.deepEqual(
      hexes,
      [],
      `${name} ainda tem hex fixo: ${hexes.slice(0, 6).join(", ")}`,
    );
  }
  assert.ok(
    templateSource.includes("landing-root"),
    "o template precisa abrir o escopo de tokens da landing",
  );
});

test("a calculadora usa os raios do sistema, nao seis valores proprios", () => {
  const radii = new Set(
    (calculatorSource.match(/rounded-\[[^\]]+\]/g) ?? []).map((v) => v),
  );
  for (const radius of radii) {
    assert.match(
      radius,
      /var\(--landing-radius(-sm)?\)/,
      `raio fora do sistema: ${radius}`,
    );
  }
});

test("a pagina de segmento preserva os caminhos de conversao", () => {
  assert.ok(templateSource.includes('"/planos"'), "o link de planos sumiu");
  assert.ok(templateSource.includes('"/"'), "o retorno para a home sumiu");
  assert.ok(
    templateSource.includes("config.ctaHref") &&
      templateSource.includes("config.ctaLabel"),
    "o CTA configurado por segmento sumiu",
  );
  assert.ok(
    templateSource.includes("#como-funciona"),
    "a ancora #como-funciona sumiu",
  );
  for (const field of [
    "config.eyebrow",
    "config.headline",
    "config.description",
    "config.costs",
    "config.proofRows",
    "config.steps",
  ]) {
    assert.ok(
      templateSource.includes(field),
      `${field} deixou de ser renderizado`,
    );
  }
  assert.ok(
    templateSource.includes("children"),
    "o slot da calculadora de demonstracao sumiu",
  );
});

test("o alternador de tema aparece no desktop", () => {
  // Ele reusava a classe do hamburger, que tem display:none acima de 1024px.
  const globals = read("src/app/globals.css");
  assert.ok(
    toggleSource.includes("landing-header__theme"),
    "o alternador precisa de classe propria, separada do hamburger",
  );
  const hidingRules = [...globals.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
    ([, , body]) => /display:\s*none/.test(body),
  );
  const hidesToggle = hidingRules.some(([, selector]) =>
    selector.includes("landing-header__theme"),
  );
  assert.equal(
    hidesToggle,
    false,
    "nenhuma regra pode esconder o alternador de tema",
  );
});

test("o acento do segmento chega ao CTA principal", () => {
  const globals = read("src/app/globals.css");
  const cta = globals.slice(globals.indexOf(".landing-cta {"));
  assert.ok(
    cta.slice(0, 400).includes("var(--landing-accent)"),
    "o CTA precisa usar o acento, para virar rosa na confeitaria",
  );
  assert.ok(
    globals.includes('.landing-root[data-segment="confeitaria"]'),
    "o escopo de acento por segmento sumiu",
  );
  assert.ok(
    templateSource.includes("data-segment={config.slug}"),
    "o template precisa declarar o segmento para o escopo funcionar",
  );
});

test("toda pagina publica restaura o tema escolhido", () => {
  // O <html> sai do servidor com data-theme="light". Sem um componente cliente
  // que releia a preferencia, quem escolheu escuro na home volta pro claro ao
  // abrir uma pagina de segmento.
  assert.ok(
    toggleSource.includes('"use client"'),
    "o alternador de tema precisa ser componente cliente",
  );
  assert.ok(
    toggleSource.includes("dabi-price-theme"),
    "o alternador precisa reusar a chave de tema do app",
  );
  for (const [name, source] of [
    ["landing-header.tsx", headerSource],
    ["segment-landing-page.tsx", templateSource],
  ]) {
    assert.ok(
      source.includes("LandingThemeToggle"),
      `${name} precisa montar o alternador de tema`,
    );
  }
});
