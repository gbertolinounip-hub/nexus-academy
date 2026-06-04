function normalizeUrl(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.endsWith("/") ? trimmedValue.slice(0, -1) : trimmedValue;
}

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
}

export function getSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    null
  );
}

export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

export function getPublicAppUrl() {
  return normalizeUrl(
    process.env.APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      null
  );
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}
