import "server-only";

import { isSuperAdminSession } from "@/lib/auth/access-control";
import type { AuthenticatedWorkspaceSession } from "@/lib/server/platform";
import {
  getAdminDashboardAnalytics,
} from "./admin-dashboard-analytics-repository.ts";
import {
  resolveAdminAnalyticsPeriod,
  type AdminAnalyticsPeriodPreset,
} from "./admin-dashboard-analytics.ts";

export async function getAdminDashboardAnalyticsForSession(input: {
  session: AuthenticatedWorkspaceSession;
  preset: AdminAnalyticsPeriodPreset;
  now?: Date;
}) {
  if (!isSuperAdminSession(input.session)) {
    throw new Error("FORBIDDEN_ADMIN_ANALYTICS");
  }
  return getAdminDashboardAnalytics(resolveAdminAnalyticsPeriod(input.preset, input.now));
}
