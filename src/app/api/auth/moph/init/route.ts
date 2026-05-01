import { cookies } from "next/headers";
import { getLoginUrl } from "@/lib/sso";
import { getPublicBaseUrl } from "@/lib/url";

const CALLBACK_COOKIE_NAME = "moph_callback_url";

function getSafeCallbackUrl(input: string | null) {
  if (!input || !input.startsWith("/")) {
    return "/";
  }

  return input;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));
  const cookieStore = await cookies();

  cookieStore.set(CALLBACK_COOKIE_NAME, callbackUrl, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  try {
    return Response.redirect(getLoginUrl(), 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : "sso_init_failed";
    const baseUrl = getPublicBaseUrl(request);
    const redirectUrl = new URL("/login", baseUrl);
    redirectUrl.searchParams.set("error", message.includes("not configured") ? "sso_not_configured" : "sso_init_failed");
    return Response.redirect(redirectUrl, 302);
  }
}

