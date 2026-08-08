import { requireCurrentAuthSession } from "@/lib/auth/session";
import { createProductImageUploadResponse } from "@/lib/server/product-image-upload";

export async function POST(request: Request) {
  await requireCurrentAuthSession();
  return createProductImageUploadResponse(request, ["site-products/"]);
}
