import { randomBytes, randomUUID, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const scrypt = promisify(nodeScrypt);
const PASSWORD_KEY_LENGTH = 64;
const BOOTSTRAP_LOCK_KEY = 2_026_083_102;

export async function bootstrapPlatformAdmin(input) {
  assertInput(input);

  const sql = postgres(input.databaseUrl, {
    idle_timeout: 5,
    max: 1,
    onnotice: () => {},
  });

  try {
    return await sql.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`;

      const rows = await transaction`SELECT id FROM users LIMIT 1`;
      if (rows[0]) {
        return { created: false };
      }

      const userId = randomUUID();
      const workspaceId = randomUUID();
      const workspaceName = input.workspaceName.trim();
      const preferences = createDefaultPreferences(workspaceName);

      await transaction`
        INSERT INTO users (
          id, email, password_hash, full_name, platform_role, status, created_at, updated_at
        )
        VALUES (
          ${userId}, ${normalizeEmail(input.email)}, ${await hashPassword(input.password)},
          ${input.fullName.trim()}, 'super_admin', 'active', NOW(), NOW()
        )
      `;
      await transaction`
        INSERT INTO workspaces (
          id, name, slug, owner_user_id, business_mode, status, created_at, updated_at
        )
        VALUES (
          ${workspaceId}, ${workspaceName}, ${slugify(workspaceName)}, ${userId},
          '3d', 'active', NOW(), NOW()
        )
      `;
      await transaction`
        INSERT INTO workspace_memberships (
          id, workspace_id, user_id, workspace_role, invited_by_user_id, created_at
        )
        VALUES (${randomUUID()}, ${workspaceId}, ${userId}, 'owner', ${userId}, NOW())
      `;
      await transaction`
        INSERT INTO workspace_preferences (
          workspace_id, data, updated_by_user_id, updated_at
        )
        VALUES (${workspaceId}, CAST(${JSON.stringify(preferences)} AS JSONB), ${userId}, NOW())
      `;
      await transaction`
        INSERT INTO workspace_audit_events (
          id, workspace_id, user_id, type, title, description, tone, occurred_at
        )
        VALUES (
          ${randomUUID()}, ${workspaceId}, ${userId}, 'bootstrap-admin-created',
          'Admin inicial criado',
          'Primeiro usuário super admin e workspace inicial provisionados manualmente.',
          'success', NOW()
        )
      `;

      return { created: true, userId, workspaceId };
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function assertInput(input) {
  if (!input?.databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
  if (!normalizeText(input.email)) throw new Error("BOOTSTRAP_ADMIN_EMAIL_REQUIRED");
  if (!normalizeText(input.password)) throw new Error("BOOTSTRAP_ADMIN_PASSWORD_REQUIRED");
  if (!normalizeText(input.fullName)) throw new Error("BOOTSTRAP_ADMIN_NAME_REQUIRED");
  if (!normalizeText(input.workspaceName)) throw new Error("BOOTSTRAP_WORKSPACE_NAME_REQUIRED");
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

function createDefaultPreferences(workspaceName) {
  return {
    workspaceName,
    operatorName: "",
    operatorEmail: "",
    operatorPhone: "",
    businessType: null,
    companyLogoUrl: "",
    brandAccentHex: "#ff6a00",
    addressLine: "",
    city: "",
    state: "",
    paymentMethods: ["pix"],
    websiteUrl: "",
    instagramHandle: "",
    operatorRole: "owner",
    businessPresetId: "studio",
    defaultDisplayCurrency: "BRL",
    applyPresetToNewCalculations: true,
    onboardingCompleted: true,
    subscription: {
      planId: "starter",
      status: "unpaid",
      billingCycle: "monthly",
      seatsUsed: 1,
      mercadoPagoSubscriptionId: null,
      checkoutStartedAt: null,
    },
    profitDestinations: {
      expansionPercentage: 40,
      cashReservePercentage: 40,
      ownerDistributionPercentage: 20,
    },
    pricingDefaults: {
      pricingMode: "margin",
      profitMarginPercentage: 50,
      healthyMarginTargetPercentage: 30,
      lossPercentage: 8,
      lossLaborSharePercentage: 30,
      maintenanceCostPerHour: 4,
      expansionReserveCostPerHour: 0,
      taxPercentage: 6,
      laborCostPerHour: 31.25,
      kwhPrice: 0.9,
    },
  };
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || `workspace-${randomUUID().slice(0, 8)}`;
}
