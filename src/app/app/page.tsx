import { cookies } from "next/headers";
import { HomeDashboardClient } from "@/components/app/home-dashboard-client";
import { getCurrentAuthSession } from "@/lib/auth/session";
import { findCurrentBillingSubscriptionForWorkspace } from "@/lib/billing/repository";
import type { SavedCalculation } from "@/lib/history/calculation-history";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
  listCalculationSnapshots,
  listWorkspaceMembers,
} from "@/lib/server/platform";
import {
  businessTypeCookieName,
  defaultAppPreferences,
  normalizePersistedBusinessType,
} from "@/lib/settings/app-preferences";

export default async function AppIndexPage() {
  const session = await getCurrentAuthSession();
  const cookieStore = await cookies();
  const fallbackBusinessType = normalizePersistedBusinessType(
    cookieStore.get(businessTypeCookieName)?.value ?? null,
  );
  const initialPreferences =
    session && isPlatformPersistenceAvailable()
      ? await getWorkspacePreferences(session.workspace.id).catch(
          () => defaultAppPreferences,
        )
      : {
          ...defaultAppPreferences,
          businessType: fallbackBusinessType,
          onboardingCompleted: fallbackBusinessType !== null,
        };
  const initialHistory: SavedCalculation[] =
    session && isPlatformPersistenceAvailable()
      ? await listCalculationSnapshots(session.workspace.id).catch(() => [])
      : [];
  const [billingSubscription, workspaceMembers] =
    session && isPlatformPersistenceAvailable()
      ? await Promise.all([
          findCurrentBillingSubscriptionForWorkspace(session.workspace.id).catch(
            () => null,
          ),
          listWorkspaceMembers(session.workspace.id).catch(() => []),
        ])
      : [null, []];
  const initialCommercialSubscription = {
    planId: billingSubscription?.planId ?? "starter",
    status: billingSubscription?.status ?? "unpaid",
    billingCycle: billingSubscription?.billingCycle ?? "monthly",
    seatsUsed: workspaceMembers.length,
    mercadoPagoSubscriptionId: billingSubscription?.providerSubscriptionId ?? null,
    checkoutStartedAt:
      billingSubscription?.status === "pending"
        ? billingSubscription.createdAt
        : null,
  } as const;

  return (
    <HomeDashboardClient
      initialFullName={session?.user.fullName ?? null}
      initialPreferences={initialPreferences}
      initialHistory={initialHistory}
      initialCommercialSubscription={initialCommercialSubscription}
    />
  );
}
