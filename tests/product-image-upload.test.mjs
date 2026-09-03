import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedWorkspaceUploadPath } from "../src/lib/uploads/workspace-upload-path.ts";

const workspaceId = "4e2b2819-dc1e-4a1d-8976-73d4d53b17da";

test("aceita upload de imagem no namespace do workspace autenticado", () => {
  assert.equal(
    isAllowedWorkspaceUploadPath(
      `erp-products/${workspaceId}/produto/main-image.webp`,
      "erp-products",
      workspaceId,
    ),
    true,
  );
});

test("rejeita upload de imagem em outro workspace ou com travessia de diretorio", () => {
  assert.equal(
    isAllowedWorkspaceUploadPath(
      "erp-products/another-workspace/produto/main-image.webp",
      "erp-products",
      workspaceId,
    ),
    false,
  );
  assert.equal(
    isAllowedWorkspaceUploadPath(
      `erp-products/${workspaceId}/../another-workspace/image.webp`,
      "erp-products",
      workspaceId,
    ),
    false,
  );
});
