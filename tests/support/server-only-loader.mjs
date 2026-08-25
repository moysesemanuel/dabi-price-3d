import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const serverOnlyShim = new URL("./server-only-shim.mjs", import.meta.url).href;
const neonPostgresShim = new URL("./neon-postgres-shim.mjs", import.meta.url).href;
const sourceRoot = new URL("../../src/", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { shortCircuit: true, url: serverOnlyShim };
  }

  if (specifier === "@neondatabase/serverless") {
    return { shortCircuit: true, url: neonPostgresShim };
  }

  if (specifier.startsWith("@/")) {
    const target = new URL(specifier.slice(2), sourceRoot);
    const typedTarget = new URL(`${specifier.slice(2)}.ts`, sourceRoot);

    if (existsSync(fileURLToPath(typedTarget))) {
      return { shortCircuit: true, url: typedTarget.href };
    }

    return nextResolve(target.href, context);
  }

  if (specifier.startsWith(".") && context.parentURL?.includes("/src/")) {
    const typedTarget = new URL(`${specifier}.ts`, context.parentURL);

    if (existsSync(fileURLToPath(typedTarget))) {
      return { shortCircuit: true, url: typedTarget.href };
    }
  }

  return nextResolve(specifier, context);
}
