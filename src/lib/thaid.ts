const THAID_DEFAULT_WELL_KNOWN_URL =
  "https://imauth.bora.dopa.go.th/api/v2/.well-known/openid-configuration";

const THAID_CLIENT_ID = process.env.THAID_CLIENT_ID;
const THAID_CLIENT_SECRET = process.env.THAID_CLIENT_SECRET;
const THAID_WELL_KNOWN_URL =
  process.env.THAID_WELL_KNOWN_URL ?? THAID_DEFAULT_WELL_KNOWN_URL;
const THAID_SCOPE =
  process.env.THAID_SCOPE ?? "pid openid name name_en birthdate address";

type ThaidDiscoveryDocument = {
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
};

type ThaidClaims = {
  address?: unknown;
  birthdate?: unknown;
  email?: unknown;
  family_name?: unknown;
  family_name_en?: unknown;
  given_name?: unknown;
  given_name_en?: unknown;
  name?: unknown;
  name_en?: unknown;
  pid?: unknown;
  sub?: unknown;
  title?: unknown;
  title_en?: unknown;
};

type ThaidTokenPayload = {
  access_token?: string;
  id_token?: string;
};

export type ThaidProfile = {
  birthdate?: string;
  email?: string;
  nameEng?: string;
  nameTh?: string;
  pid?: string;
  subject?: string;
  titleTh?: string;
};

function getMissingEnvVars() {
  const requiredEnvVars = [
    ["THAID_CLIENT_ID", THAID_CLIENT_ID],
    ["THAID_CLIENT_SECRET", THAID_CLIENT_SECRET],
    ["THAID_WELL_KNOWN_URL", THAID_WELL_KNOWN_URL],
  ] as const;

  return requiredEnvVars
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

function assertThaidConfig() {
  const missingEnvVars = getMissingEnvVars();

  if (missingEnvVars.length > 0) {
    throw new Error(`ThaiD SSO is not configured: ${missingEnvVars.join(", ")}`);
  }
}

function parseBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}

function parseJwtPayload(token: string): ThaidClaims {
  const [, payload] = token.split(".");
  if (!payload) {
    return {};
  }

  try {
    return JSON.parse(parseBase64Url(payload)) as ThaidClaims;
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

async function getDiscoveryDocument(): Promise<ThaidDiscoveryDocument> {
  assertThaidConfig();

  const response = await fetch(THAID_WELL_KNOWN_URL!, {
    cache: "no-store",
  });
  const payload = await readResponseBody(response);

  if (!response.ok || !payload || typeof payload !== "object") {
    throw new Error(`ThaiD discovery failed: ${JSON.stringify(payload)}`);
  }

  return payload as ThaidDiscoveryDocument;
}

function toOptionalString(value: unknown) {
  if (typeof value === "string") {
    return value.trim() || undefined;
  }

  if (typeof value === "number") {
    return value.toString();
  }

  return undefined;
}

function getFullName(firstName?: unknown, lastName?: unknown) {
  return [toOptionalString(firstName), toOptionalString(lastName)]
    .filter(Boolean)
    .join(" ")
    .trim() || undefined;
}

function mergeClaims(idTokenClaims: ThaidClaims, userInfoClaims: ThaidClaims) {
  return {
    ...idTokenClaims,
    ...Object.fromEntries(
      Object.entries(userInfoClaims).filter(([, value]) => value !== undefined),
    ),
  } as ThaidClaims;
}

function toProfile(claims: ThaidClaims): ThaidProfile {
  return {
    pid: toOptionalString(claims.pid),
    subject: toOptionalString(claims.sub),
    nameTh:
      toOptionalString(claims.name) ?? getFullName(claims.given_name, claims.family_name),
    nameEng:
      toOptionalString(claims.name_en) ??
      getFullName(claims.given_name_en, claims.family_name_en),
    email: toOptionalString(claims.email),
    titleTh: toOptionalString(claims.title),
    birthdate: toOptionalString(claims.birthdate),
  };
}

export async function getThaidLoginUrl({
  redirectUri,
  state,
}: {
  redirectUri: string;
  state: string;
}) {
  const discovery = await getDiscoveryDocument();

  if (!discovery.authorization_endpoint) {
    throw new Error("ThaiD discovery failed: authorization_endpoint not found");
  }

  const params = new URLSearchParams({
    client_id: THAID_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: THAID_SCOPE,
    state,
  });

  return `${discovery.authorization_endpoint}?${params.toString()}`;
}

export async function authenticateWithThaiD({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}): Promise<ThaidProfile> {
  assertThaidConfig();

  const discovery = await getDiscoveryDocument();
  if (!discovery.token_endpoint) {
    throw new Error("ThaiD discovery failed: token_endpoint not found");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: THAID_CLIENT_ID!,
    client_secret: THAID_CLIENT_SECRET!,
  });

  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const tokenPayload = await readResponseBody(tokenResponse);

  if (!tokenResponse.ok || !tokenPayload || typeof tokenPayload !== "object") {
    throw new Error(`ThaiD token exchange failed: ${JSON.stringify(tokenPayload)}`);
  }

  const tokens = tokenPayload as ThaidTokenPayload;
  const idTokenClaims = tokens.id_token ? parseJwtPayload(tokens.id_token) : {};
  let userInfoClaims: ThaidClaims = {};

  if (tokens.access_token && discovery.userinfo_endpoint) {
    const userInfoResponse = await fetch(discovery.userinfo_endpoint, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
      cache: "no-store",
    });
    const userInfoPayload = await readResponseBody(userInfoResponse);

    if (userInfoResponse.ok && userInfoPayload && typeof userInfoPayload === "object") {
      userInfoClaims = userInfoPayload as ThaidClaims;
    }
  }

  const profile = toProfile(mergeClaims(idTokenClaims, userInfoClaims));
  if (!profile.pid) {
    throw new Error("ThaiD profile does not include pid");
  }

  return profile;
}
