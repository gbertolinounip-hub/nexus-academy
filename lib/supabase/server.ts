import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import {
  getSupabasePublishableKey,
  getSupabaseUrl
} from "@/lib/supabase/config";

export async function createSupabaseServerClient() {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    throw new Error(
      "Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas."
    );
  }

  const cookieStore = await cookies();
  const mutableCookieStore = cookieStore as unknown as {
    set: (
      name: string,
      value: string,
      options?: Record<string, unknown>
    ) => void;
  };

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          try {
            mutableCookieStore.set(cookie.name, cookie.value, cookie.options);
          } catch {
            // Server Components podem ter cookies somente leitura.
          }
        }
      }
    }
  });
}


