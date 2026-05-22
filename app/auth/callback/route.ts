import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabasePublishableKey,
  getSupabaseUrl
} from "@/lib/supabase/config";

function resolveRedirectPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/login";
  }

  return nextPath;
}

function buildRedirectResponse(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = resolveRedirectPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return buildRedirectResponse(request, "/login?auth_notice=recovery-invalid");
  }

  let response = buildRedirectResponse(request, next);

  const supabase = createServerClient(
    getSupabaseUrl()!,
    getSupabasePublishableKey()!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
          }

          response = buildRedirectResponse(request, next);

          for (const cookie of cookiesToSet) {
            response.cookies.set(cookie.name, cookie.value, cookie.options);
          }
        }
      }
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const authNotice =
      error.message === "User is banned" ? "access-blocked" : "recovery-invalid";

    return buildRedirectResponse(request, `/login?auth_notice=${authNotice}`);
  }

  return response;
}
