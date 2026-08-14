import { redirect } from "next/navigation";

export default function LegacyPlatformUsersPage() {
  redirect("/admin/usuarios");
}
