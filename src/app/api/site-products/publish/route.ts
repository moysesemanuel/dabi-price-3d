export async function POST() {
  return Response.json(
    {
      error:
        "A publicação direta no e-commerce foi desativada. Salve o produto no ERP e publique a partir dele.",
    },
    { status: 410 },
  );
}
