import type { BillingProviderName } from "../types.ts";
import type { BillingProvider } from "./billing-provider.ts";
import { MercadoPagoProvider } from "./mercado-pago/mercado-pago-provider.ts";

const billingProviders: Record<BillingProviderName, BillingProvider> = {
  mercado_pago: new MercadoPagoProvider(),
};

export function getBillingProvider(name: BillingProviderName): BillingProvider {
  return billingProviders[name];
}
