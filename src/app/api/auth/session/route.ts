import { getCurrentAuthSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getCurrentAuthSession();

  if (!session) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  return Response.json({
    authenticated: true,
    session,
  });
}
