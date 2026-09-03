import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const brandSource = read("src/components/brand/dabi-brand.tsx");
const globalsSource = read("src/app/globals.css");

const logoConsumers = [
  "src/app/login/page.tsx",
  "src/app/cadastro/page.tsx",
  "src/app/planos/page.tsx",
  "src/components/public/segment-landing-page.tsx",
  "src/components/app/app-sidebar.tsx",
  "src/components/public/landing-header.tsx",
];

test("existe uma unica marca, usada em todo o produto", () => {
  for (const path of logoConsumers) {
    const source = read(path);
    assert.match(
      source,
      /DabiWordmark|DabiMark/,
      `${path} precisa usar o componente de marca`,
    );
    assert.doesNotMatch(
      source,
      /dabi-price-horizontal\.svg|logo-dabi-branco\.svg|logo-dabi-preto\.svg/,
      `${path} ainda importa um arquivo de logo antigo`,
    );
  }
});

test("a marca tem nome acessivel e o simbolo e decorativo", () => {
  assert.match(
    brandSource,
    /aria-hidden/,
    "o simbolo precisa ser aria-hidden; quem nomeia e o texto",
  );
  assert.match(
    brandSource,
    /role=\{title \? "img" : undefined\}/,
    "a versao so-simbolo precisa virar role=img quando recebe nome",
  );
  assert.match(
    brandSource,
    /aria-label=\{title\}/,
    "a versao so-simbolo precisa expor o nome acessivel recebido",
  );
});

test("a marca se adapta ao tema em vez de trocar de arquivo", () => {
  // O sidebar trocava a imagem conforme themeMode. Uma marca que herda a cor
  // nao precisa de duas versoes nem de saber qual tema esta ativo.
  assert.match(
    brandSource,
    /currentColor/,
    "a metade 'price' precisa herdar a cor da superficie",
  );
  assert.doesNotMatch(
    brandSource,
    /themeMode|next\/image/,
    "a marca nao deve depender do tema nem de arquivo de imagem",
  );
  for (const token of ["--brand-blue", "--brand-gold"]) {
    assert.ok(
      globalsSource.includes(token),
      `token ${token} ausente do globals.css`,
    );
  }
});

test("a petala dourada continua sendo uma so", () => {
  const rotations = brandSource.match(/ROTATIONS = \[([^\]]+)\]/);
  assert.ok(rotations, "as rotacoes das petalas azuis precisam ser explicitas");
  assert.equal(
    rotations[1].split(",").filter((part) => part.trim()).length,
    4,
    "o simbolo tem 6 petalas: a base, 4 giradas em azul e a dourada",
  );
  assert.match(
    brandSource,
    /rotate\(300 50 50\)/,
    "a petala dourada e a de 300 graus",
  );
  assert.equal(
    (brandSource.match(/fill="var\(--brand-gold\)"/g) ?? []).length,
    1,
    "so uma petala e dourada; o dourado e acento, nao preenchimento",
  );
});
