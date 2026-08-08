import { logoutCurrentSession } from "@/lib/auth/session";

export async function POST() {
  await logoutCurrentSession();

  return Response.json({ success: true });
}
