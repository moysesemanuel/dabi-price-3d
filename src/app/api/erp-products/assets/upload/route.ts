import { createProductImageUploadResponse } from "@/lib/server/product-image-upload";

export async function POST(request: Request) {
  return createProductImageUploadResponse(request, ["erp-products/"]);
}
