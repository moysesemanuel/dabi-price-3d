import Link from "next/link";
import { MercadoPagoSubscriptionManageButton } from "@/components/payments/mercado-pago-subscription-manage-button";
import type { BillingNotification } from "@/lib/billing/notification-service";

export function BillingNotificationBanner({
  notification,
}: {
  notification: BillingNotification | null;
}) {
  if (!notification) {
    return null;
  }

  const toneClassName =
    notification.tone === "danger"
      ? "border-[color:var(--danger)]/24 bg-[color:var(--danger)]/8 text-[var(--foreground)]"
      : notification.tone === "warning"
        ? "border-[color:var(--warning)]/24 bg-[color:var(--warning)]/10 text-[var(--foreground)]"
        : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] text-[var(--foreground)]";
  const eyebrowClassName =
    notification.tone === "danger"
      ? "text-[color:var(--danger)]"
      : notification.tone === "warning"
        ? "text-[color:var(--warning)]"
        : "text-[var(--accent)]";

  return (
    <div className="mx-auto max-w-[1488px] px-4 pt-4 sm:px-6 lg:px-8">
      <section className={`rounded-[28px] border px-5 py-5 shadow-[0_18px_40px_rgba(26,28,34,0.06)] ${toneClassName}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className={`font-mono text-[11px] uppercase tracking-[0.24em] ${eyebrowClassName}`}>
              {notification.eyebrow}
            </p>
            <h2 className="mt-3 text-lg font-semibold text-[var(--foreground)]">
              {notification.title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              {notification.description}
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[260px]">
            <BillingNotificationAction action={notification.primaryAction} primary />
            {notification.secondaryAction ? (
              <BillingNotificationAction action={notification.secondaryAction} />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function BillingNotificationAction({
  action,
  primary = false,
}: {
  action: BillingNotification["primaryAction"];
  primary?: boolean;
}) {
  if (action.type === "manage_subscription") {
    return (
      <MercadoPagoSubscriptionManageButton
        action={action.action}
        label={action.label}
        className={
          primary
            ? "app-button app-button-primary w-full"
            : "app-button app-button-secondary w-full"
        }
      />
    );
  }

  return (
    <Link
      href={action.href}
      className={primary ? "app-button app-button-primary w-full" : "app-button app-button-secondary w-full"}
    >
      {action.label}
    </Link>
  );
}
