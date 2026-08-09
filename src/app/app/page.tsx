import { HomeDashboardClient } from "@/components/app/home-dashboard-client";
import { getCurrentAuthSession } from "@/lib/auth/session";
import type { SavedCalculation } from "@/lib/history/calculation-history";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
  listCalculationSnapshots,
} from "@/lib/server/platform";
import { defaultAppPreferences } from "@/lib/settings/app-preferences";

export default async function AppIndexPage() {
  const session = await getCurrentAuthSession();
  const initialPreferences =
    session && isPlatformPersistenceAvailable()
      ? await getWorkspacePreferences(session.workspace.id).catch(
          () => defaultAppPreferences,
        )
      : defaultAppPreferences;
  const initialHistory: SavedCalculation[] =
    session && isPlatformPersistenceAvailable()
      ? await listCalculationSnapshots(session.workspace.id).catch(() => [])
      : [];

  return (
    <HomeDashboardClient
      initialFullName={session?.user.fullName ?? null}
      initialPreferences={initialPreferences}
      initialHistory={initialHistory}
    />
  );
}
