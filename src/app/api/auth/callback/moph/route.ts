import { cookies } from "next/headers";

const CALLBACK_COOKIE_NAME = "moph_callback_url";

function getSafeCallbackUrl(input: string | undefined) {
  if (!input || !input.startsWith("/")) {
    return "/";
  }

  return input;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const remoteError = searchParams.get("error");
  const cookieStore = await cookies();
  const callbackUrl = getSafeCallbackUrl(cookieStore.get(CALLBACK_COOKIE_NAME)?.value);

  cookieStore.delete(CALLBACK_COOKIE_NAME);

  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("callbackUrl", callbackUrl);

  if (remoteError) {
    redirectUrl.searchParams.set("error", remoteError);
    return Response.redirect(redirectUrl, 302);
  }

  if (!code) {
    redirectUrl.searchParams.set("error", "missing_code");
    return Response.redirect(redirectUrl, 302);
  }

  redirectUrl.searchParams.set("code", code);
  return Response.redirect(redirectUrl, 302);
}
