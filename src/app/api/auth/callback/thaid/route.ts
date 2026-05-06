import { cookies } from "next/headers";
import { getPublicBaseUrl } from "@/lib/url";

const CALLBACK_COOKIE_NAME = "thaid_callback_url";
const REDIRECT_URI_COOKIE_NAME = "thaid_redirect_uri";
const STATE_COOKIE_NAME = "thaid_state";

function getSafeCallbackUrl(input: string | undefined) {
  if (!input || !input.startsWith("/") || input.startsWith("//")) {
    return "/";
  }

  return input;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const remoteError = searchParams.get("error");
  const returnedState = searchParams.get("state");
  const cookieStore = await cookies();
  const callbackUrl = getSafeCallbackUrl(cookieStore.get(CALLBACK_COOKIE_NAME)?.value);
  const expectedState = cookieStore.get(STATE_COOKIE_NAME)?.value;
  const redirectUri =
    cookieStore.get(REDIRECT_URI_COOKIE_NAME)?.value ??
    process.env.THAID_REDIRECT_URI ??
    `${getPublicBaseUrl(request)}/api/auth/callback/thaid`;

  cookieStore.delete(CALLBACK_COOKIE_NAME);
  cookieStore.delete(REDIRECT_URI_COOKIE_NAME);
  cookieStore.delete(STATE_COOKIE_NAME);

  const baseUrl = getPublicBaseUrl(request);
  const redirectUrl = new URL("/login", baseUrl);
  redirectUrl.searchParams.set("callbackUrl", callbackUrl);

  if (remoteError) {
    redirectUrl.searchParams.set("error", remoteError);
    return Response.redirect(redirectUrl, 302);
  }

  if (!expectedState || !returnedState || expectedState !== returnedState) {
    redirectUrl.searchParams.set("error", "thaid_state_mismatch");
    return Response.redirect(redirectUrl, 302);
  }

  if (!code) {
    redirectUrl.searchParams.set("error", "missing_code");
    return Response.redirect(redirectUrl, 302);
  }

  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("provider", "thaid");
  redirectUrl.searchParams.set("thaidRedirectUri", redirectUri);
  return Response.redirect(redirectUrl, 302);
}
