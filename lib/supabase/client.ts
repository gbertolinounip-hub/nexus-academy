import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getSupabasePublishableKey,
  getSupabaseUrl
} from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    throw new Error(
      "Vari\u00e1veis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY n\u00e3o configuradas."
    );
  }

  return createBrowserClient<Database>(url, publishableKey);
}

export function createSupabaseEphemeralBrowserClient() {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    throw new Error(
      "Vari\u00e1veis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY n\u00e3o configuradas."
    );
  }

  return createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}
