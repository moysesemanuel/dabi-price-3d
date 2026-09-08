import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Assinatura derivada do proprio arquivo da migracao.
 *
 * O runner recusa aplicar uma migracao ja registrada cujo checksum mudou. Com
 * a assinatura escrita a mao, essa protecao dependia de alguem lembrar de
 * troca-la ao editar o arquivo — ou seja, protegia contra o esquecimento de
 * quem nao esquece. Derivando do conteudo, qualquer edicao muda a assinatura
 * sozinha e o banco que ja aplicou a versao antiga acusa a divergencia.
 */
export function migrationChecksum(moduleUrl) {
  return createHash("sha256")
    .update(readFileSync(fileURLToPath(moduleUrl)))
    .digest("hex");
}
