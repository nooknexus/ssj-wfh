import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getThaidLoginUrl } from "@/lib/thaid";
import { getPublicBaseUrl } from "@/lib/url";

const CALLBACK_COOKIE_NAME = "thaid_callback_url";
const REDIRECT_URI_COOKIE_NAME = "thaid_redirect_uri";
const STATE_COOKIE_NAME = "thaid_state";

function getSafeCallbackUrl(input: string | null) {
  if (!input || !input.startsWith("/") || input.startsWith("//")) {
    return "/";
  }

  return input;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));
  const baseUrl = getPublicBaseUrl(request);
  const redirectUri =
    process.env.THAID_REDIRECT_URI ?? `${baseUrl}/api/auth/callback/thaid`;
  const state = randomBytes(24).toString("base64url");
  const cookieStore = await cookies();

  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  };

  cookieStore.set(CALLBACK_COOKIE_NAME, callbackUrl, cookieOptions);
  cookieStore.set(REDIRECT_URI_COOKIE_NAME, redirectUri, cookieOptions);
  cookieStore.set(STATE_COOKIE_NAME, state, cookieOptions);

  try {
    return Response.redirect(await getThaidLoginUrl({ redirectUri, state }), 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : "thaid_init_failed";
    const redirectUrl = new URL("/login", baseUrl);
    redirectUrl.searchParams.set(
      "error",
      message.includes("not configured") ? "thaid_not_configured" : "thaid_init_failed",
    );
    return Response.redirect(redirectUrl, 302);
  }
}
