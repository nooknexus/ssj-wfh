import { splitThaiTitle } from "@/lib/person-name";

const HEALTH_AUTH_ENDPOINT = "https://moph.id.th/oauth/redirect";

const HEALTH_CLIENT_ID = process.env.HEALTH_CLIENT_ID;
const HEALTH_CLIENT_SECRET = process.env.HEALTH_CLIENT_SECRET;
const HEALTH_REDIRECT_URI = process.env.HEALTH_REDIRECT_URI;
const HEALTH_TOKEN_ENDPOINT = process.env.HEALTH_TOKEN_ENDPOINT;

const PROVIDER_CLIENT_ID = process.env.PROVIDER_CLIENT_ID;
const PROVIDER_CLIENT_SECRET = process.env.PROVIDER_CLIENT_SECRET;
const PROVIDER_EXCHANGE_ENDPOINT = process.env.PROVIDER_EXCHANGE_ENDPOINT;
const PROVIDER_USERINFO_ENDPOINT = process.env.PROVIDER_USERINFO_ENDPOINT;

type JwtScopesDetail = {
  hash_id_card?: string;
  id_card?: string;
  name?: string;
  name_prefix?: string;
  pid?: string;
  surname?: string;
};

type HealthJwtPayload = {
  email?: string;
  pid?: string;
  scopes_detail?: JwtScopesDetail;
  sub?: string;
};

type ProviderOrganization = {
  hcode?: string;
  hname_eng?: string;
  hname_th?: string;
  position?: string;
};

type ProviderProfile = {
  email?: string;
  firstname_en?: string;
  firstname_th?: string;
  hash_cid?: string;
  lastname_en?: string;
  lastname_th?: string;
  name_eng?: string;
  name_th?: string;
  organization?: ProviderOrganization[];
  title_th?: string;
};

export type MophSsoProfile = {
  email?: string;
  hashCid?: string;
  hcode?: string;
  hname?: string;
  nameEng?: string;
  nameTh?: string;
  position?: string;
  providerId?: string;
  titleTh?: string;
  username?: string;
};

function getMissingEnvVars() {
  const requiredEnvVars = [
    ["HEALTH_CLIENT_ID", HEALTH_CLIENT_ID],
    ["HEALTH_CLIENT_SECRET", HEALTH_CLIENT_SECRET],
    ["HEALTH_REDIRECT_URI", HEALTH_REDIRECT_URI],
    ["HEALTH_TOKEN_ENDPOINT", HEALTH_TOKEN_ENDPOINT],
    ["PROVIDER_CLIENT_ID", PROVIDER_CLIENT_ID],
    ["PROVIDER_CLIENT_SECRET", PROVIDER_CLIENT_SECRET],
    ["PROVIDER_EXCHANGE_ENDPOINT", PROVIDER_EXCHANGE_ENDPOINT],
    ["PROVIDER_USERINFO_ENDPOINT", PROVIDER_USERINFO_ENDPOINT],
  ] as const;

  return requiredEnvVars
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

function assertSsoConfig() {
  const missingEnvVars = getMissingEnvVars();

  if (missingEnvVars.length > 0) {
    throw new Error(`MOPH SSO is not configured: ${missingEnvVars.join(", ")}`);
  }
}

function parseBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}

function parseJwtPayload(token: string): HealthJwtPayload {
  const [, payload] = token.split(".");
  if (!payload) {
    return {};
  }

  try {
    return JSON.parse(parseBase64Url(payload)) as HealthJwtPayload;
  } catch {
    return {};
  }
}

async function readResponseBody(response: Response) {
  const rawBody = await response.text();

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return rawBody;
  }
}

function getAccessToken(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const topLevelToken =
    "access_token" in payload && typeof payload.access_token === "string"
      ? payload.access_token
      : undefined;

  const nestedData =
    "data" in payload && payload.data && typeof payload.data === "object"
      ? payload.data
      : undefined;

  const nestedToken =
    nestedData && "access_token" in nestedData && typeof nestedData.access_token === "string"
      ? nestedData.access_token
      : undefined;

  return nestedToken ?? topLevelToken;
}

function getProfilePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const nestedData =
    "data" in payload && payload.data && typeof payload.data === "object"
      ? payload.data
      : undefined;

  return (nestedData ?? payload) as ProviderProfile;
}

function getFullName(firstName?: string, lastName?: string) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || undefined;
}

export function getLoginUrl(landing?: string) {
  assertSsoConfig();

  const params = new URLSearchParams({
    client_id: HEALTH_CLIENT_ID!,
    is_auth: "yes",
    redirect_uri: HEALTH_REDIRECT_URI!,
    response_type: "code",
  });

  if (landing) {
    params.set("landing", landing);
  }

  return `${HEALTH_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function authenticateWithMOPH(code: string): Promise<MophSsoProfile> {
  assertSsoConfig();

  const healthTokenResponse = await fetch(HEALTH_TOKEN_ENDPOINT!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: HEALTH_REDIRECT_URI,
      client_id: HEALTH_CLIENT_ID,
      client_secret: HEALTH_CLIENT_SECRET,
    }),
    cache: "no-store",
  });

  const healthTokenPayload = await readResponseBody(healthTokenResponse);

  if (!healthTokenResponse.ok) {
    throw new Error(`HealthID token exchange failed: ${JSON.stringify(healthTokenPayload)}`);
  }

  const healthToken = getAccessToken(healthTokenPayload);
  if (!healthToken) {
    throw new Error("HealthID token exchange failed: access_token not found");
  }

  const jwtPayload = parseJwtPayload(healthToken);
  const jwtDetails = jwtPayload.scopes_detail ?? {};

  const providerTokenResponse = await fetch(PROVIDER_EXCHANGE_ENDPOINT!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: PROVIDER_CLIENT_ID,
      secret_key: PROVIDER_CLIENT_SECRET,
      token_by: "Health ID",
      token: healthToken,
    }),
    cache: "no-store",
  });

  const providerTokenPayload = await readResponseBody(providerTokenResponse);

  if (!providerTokenResponse.ok) {
    throw new Error(`ProviderID token exchange failed: ${JSON.stringify(providerTokenPayload)}`);
  }

  const providerToken = getAccessToken(providerTokenPayload);
  if (!providerToken) {
    throw new Error("ProviderID token exchange failed: access_token not found");
  }

  const profileResponse = await fetch(PROVIDER_USERINFO_ENDPOINT!, {
    method: "GET",
    headers: {
      "client-id": PROVIDER_CLIENT_ID!,
      "secret-key": PROVIDER_CLIENT_SECRET!,
      Authorization: `Bearer ${providerToken}`,
    },
    cache: "no-store",
  });

  const profilePayload = await readResponseBody(profileResponse);

  if (!profileResponse.ok) {
    throw new Error(`ProviderID profile fetch failed: ${JSON.stringify(profilePayload)}`);
  }

  const profile = getProfilePayload(profilePayload);
  const primaryOrganization = profile.organization?.[0];
  // กันกรณีชื่อมีคำนำหน้าติดมา ให้ name_th / title_th เหมือนกับที่ได้จาก ThaiD
  const { title: titleTh, name: nameTh } = splitThaiTitle(
    profile.name_th ??
      getFullName(profile.firstname_th, profile.lastname_th) ??
      getFullName(jwtDetails.name, jwtDetails.surname),
    profile.title_th ?? jwtDetails.name_prefix,
  );

  return {
    username: jwtDetails.id_card ?? jwtPayload.pid ?? jwtDetails.pid,
    providerId: jwtPayload.sub,
    hashCid: profile.hash_cid ?? jwtDetails.hash_id_card,
    nameTh,
    nameEng: profile.name_eng ?? getFullName(profile.firstname_en, profile.lastname_en),
    email: profile.email ?? jwtPayload.email,
    titleTh,
    position: primaryOrganization?.position,
    hcode: primaryOrganization?.hcode,
    hname: primaryOrganization?.hname_th ?? primaryOrganization?.hname_eng,
  };
}
