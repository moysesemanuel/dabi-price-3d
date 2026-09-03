import { requireCurrentAuthSession } from "@/lib/auth/session";
import { createProductImageUploadResponse } from "@/lib/server/product-image-upload";

export async function POST(request: Request) {
  const session = await requireCurrentAuthSession();
  return createProductImageUploadResponse(
    request,
    "workspace-logos",
    session.workspace.id,
  );
}
