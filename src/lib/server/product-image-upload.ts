import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE_IN_BYTES = 12 * 1024 * 1024;

export async function createProductImageUploadResponse(
  request: Request,
  allowedPrefixes: string[],
): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  const readWriteToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!readWriteToken) {
    return NextResponse.json(
      {
        error:
          "BLOB_READ_WRITE_TOKEN não configurado. O fluxo de client upload do Vercel Blob precisa desse token no servidor para gerar o client token.",
      },
      { status: 500 },
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: readWriteToken,
      onBeforeGenerateToken: async (pathname) => {
        if (!allowedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
          throw new Error("Destino de upload inválido.");
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_IMAGE_SIZE_IN_BYTES,
        };
      },
      onUploadCompleted: async () => {
        return;
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "Destino de upload inválido."
            ? error.message
            : "Falha ao preparar o upload da imagem.",
      },
      { status: 400 },
    );
  }
}
