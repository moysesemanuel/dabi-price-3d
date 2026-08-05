export type PricingTenantContext = {
  tenantId: string | null;
  companyId: string | null;
  storeId: string | null;
};

export function resolvePricingTenantContext(): PricingTenantContext | null {
  const tenantId = normalizeOptionalEnv(process.env.PRICING_CONTEXT_TENANT_ID);
  const companyId = normalizeOptionalEnv(process.env.PRICING_CONTEXT_COMPANY_ID);
  const storeId = normalizeOptionalEnv(process.env.PRICING_CONTEXT_STORE_ID);

  if (!tenantId && !companyId && !storeId) {
    return null;
  }

  return {
    tenantId,
    companyId,
    storeId,
  };
}

function normalizeOptionalEnv(value: string | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}
