import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  companyIdentityFallback,
  mergeCompanyIdentity,
  sanitizeCompanyIdentityInput,
  diffCompanyIdentity,
} from "../src/lib/legal/company.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("sem registro no banco, vale o que esta no codigo", () => {
  const merged = mergeCompanyIdentity(null);

  assert.equal(merged.cnpj, companyIdentityFallback.cnpj);
  assert.equal(merged.legalName, companyIdentityFallback.legalName);
});

test("o banco sobrescreve campo a campo, sem apagar o resto", () => {
  const merged = mergeCompanyIdentity({ address: "Rua Nova, 100 — Curitiba/PR" });

  assert.equal(merged.address, "Rua Nova, 100 — Curitiba/PR");
  assert.equal(merged.cnpj, companyIdentityFallback.cnpj, "os demais campos ficam");
});

test("entrada vazia nao apaga dado obrigatorio", () => {
  // Salvar o formulario com um campo em branco nao pode zerar a identidade.
  const clean = sanitizeCompanyIdentityInput({
    legalName: "   ",
    address: "Rua Nova, 100",
    cnpj: "",
  });

  assert.equal(clean.legalName, undefined, "campo em branco e ignorado");
  assert.equal(clean.cnpj, undefined);
  assert.equal(clean.address, "Rua Nova, 100");
});

test("a alteracao gera um diff auditavel", () => {
  const before = { ...companyIdentityFallback };
  const after = { ...before, address: "Rua Nova, 100", privacyEmail: before.privacyEmail };

  const changes = diffCompanyIdentity(before, after);

  assert.deepEqual(Object.keys(changes), ["address"]);
  assert.equal(changes.address.from, before.address);
  assert.equal(changes.address.to, "Rua Nova, 100");
});

test("a identidade tem tela propria, fora das telas de operacao", () => {
  const settings = read("src/app/admin/configuracoes/page.tsx");
  assert.match(settings, /CompanyIdentityPanel/, "a tela nova precisa montar o painel");

  const sistema = read("src/app/admin/sistema/page.tsx");
  assert.doesNotMatch(
    sistema,
    /CompanyIdentityPanel/,
    "Sistema e tela de operacao; configuracao nao mora ali",
  );

  const nav = read("src/components/admin/admin-shell-nav.tsx");
  assert.match(nav, /\/admin\/configuracoes/, "falta a entrada na navegacao");
});

test("so super admin altera, e a rota registra quem alterou", () => {
  const route = read("src/app/api/admin/settings/company/route.ts");

  assert.match(route, /isSuperAdminSession/, "a rota precisa exigir super admin");
  assert.match(
    route,
    /diffCompanyIdentity|recordPlatformSettingChange/,
    "a alteracao precisa deixar trilha",
  );
  assert.match(
    route,
    /revalidatePath/,
    "as paginas legais precisam ser revalidadas apos salvar",
  );
});

test("as paginas legais leem a identidade viva, nao a constante", () => {
  for (const page of ["src/app/termos/page.tsx", "src/app/privacidade/page.tsx"]) {
    const source = read(page);
    assert.match(
      source,
      /getCompanyIdentity/,
      `${page} precisa ler a identidade do banco`,
    );
  }
});

test("campo de fundo branco fixa a tinta escura", () => {
  // Fundo branco no tema escuro herdaria a tinta clara e ficaria invisivel.
  const globals = read("src/app/globals.css");
  const block = globals.slice(globals.indexOf(".app-input {"));
  const rule = block.slice(0, block.indexOf("}"));

  assert.match(rule, /background: #ffffff/, "o campo precisa ser branco");
  assert.match(rule, /color: #/, "o campo precisa fixar a cor do texto");
});
