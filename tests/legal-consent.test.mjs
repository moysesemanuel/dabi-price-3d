import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getLegalDocument,
  currentConsentVersions,
} from "../src/lib/legal/documents.ts";
import {
  companyIdentity,
  isCompanyIdentityComplete,
  missingCompanyFields,
} from "../src/lib/legal/company.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("os documentos legais tem versao, e a versao e o que se registra", () => {
  for (const id of ["terms", "privacy"]) {
    const doc = getLegalDocument(id);
    assert.ok(doc, `documento ${id} nao existe`);
    // Versao datada: sem isso nao da para provar QUAL texto a pessoa aceitou.
    assert.match(
      doc.version,
      /^\d{4}-\d{2}-\d{2}$/,
      `a versao de ${id} precisa ser uma data ISO`,
    );
    assert.ok(doc.path.startsWith("/"), `${id} precisa de rota publica`);
  }

  assert.deepEqual(
    Object.keys(currentConsentVersions).sort(),
    ["privacy", "terms"],
    "o aceite precisa registrar as duas versoes",
  );
});

test("a identidade da empresa mora num lugar so", () => {
  assert.equal(companyIdentity.cnpj, "57.936.721/0001-25");
  // Enquanto faltar dado obrigatorio do Decreto 7.962/2013, o proprio codigo
  // sabe disso — em vez de publicar pagina com lacuna silenciosa.
  assert.equal(typeof isCompanyIdentityComplete(), "boolean");

  // O aviso de pendencia aparece em pagina publica: nada de nome de campo.
  for (const label of missingCompanyFields()) {
    assert.doesNotMatch(
      label,
      /[A-Z]/,
      `"${label}" parece nome de campo, nao rotulo para o leitor`,
    );
  }
});

test("cadastro exige aceite explicito", () => {
  const route = read("src/app/api/auth/register/route.ts");
  assert.match(
    route,
    /acceptedTerms/,
    "a rota de cadastro precisa receber o aceite",
  );
  assert.match(
    route,
    /recordUserConsent|registerWorkspaceOwner\([\s\S]*consent/,
    "a rota precisa registrar o consentimento",
  );

  const form = read("src/components/auth/register-form.tsx");
  assert.match(form, /type="checkbox"/, "falta o checkbox de aceite");
  assert.match(
    form,
    /acceptedTerms/,
    "o formulario precisa controlar o estado do aceite",
  );
  assert.match(
    form,
    /\/termos/,
    "o checkbox precisa linkar os Termos",
  );
  assert.match(
    form,
    /\/privacidade/,
    "o checkbox precisa linkar a Politica de Privacidade",
  );
});

test("as paginas legais existem, sao publicas e usam os tokens", () => {
  // O escopo de tokens fica no layout compartilhado; as paginas so trazem texto.
  const shell = read("src/components/public/legal-page.tsx");
  assert.match(shell, /landing-root/, "o layout legal precisa abrir os tokens");
  assert.match(
    shell,
    /missingCompanyFields/,
    "a pagina precisa avisar quando falta dado obrigatorio da empresa",
  );

  for (const route of [
    "src/app/termos/page.tsx",
    "src/app/privacidade/page.tsx",
    "src/components/public/legal-page.tsx",
  ]) {
    const source = read(route);
    const hexes = source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    assert.deepEqual(hexes, [], `${route} tem hex fixo`);
    assert.match(source, /LegalPage|legal-prose|landing-root/, `${route} fora do sistema`);
  }
});

test("o rodape da landing aponta para os dois documentos", () => {
  const landing = read("src/app/page.tsx");
  assert.match(landing, /\/termos/, "o rodape precisa linkar os Termos");
  assert.match(landing, /\/privacidade/, "o rodape precisa linkar a Politica");
});
