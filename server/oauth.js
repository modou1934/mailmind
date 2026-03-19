import { fetchWithTimeout, readJsonResponse } from "./fetch.js"

function getMicrosoftTenantId() {
  return process.env.MICROSOFT_TENANT_ID || "common";
}

const PROVIDERS = {
  google: {
    getAuthUrl: () => "https://accounts.google.com/o/oauth2/v2/auth",
    getTokenUrl: () => "https://oauth2.googleapis.com/token",
    profileUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    getClientId: () => process.env.GOOGLE_CLIENT_ID,
    getClientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    defaultScopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    buildProfileEmail: (profile) => profile.email,
    baseProvider: "google",
    capabilities: ["mail", "calendar"],
  },
  "google-calendar": {
    getAuthUrl: () => "https://accounts.google.com/o/oauth2/v2/auth",
    getTokenUrl: () => "https://oauth2.googleapis.com/token",
    profileUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    getClientId: () => process.env.GOOGLE_CLIENT_ID,
    getClientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    defaultScopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    buildProfileEmail: (profile) => profile.email,
    baseProvider: "google",
    capabilities: ["calendar"],
  },
  microsoft: {
    getAuthUrl: () => `https://login.microsoftonline.com/${getMicrosoftTenantId()}/oauth2/v2.0/authorize`,
    getTokenUrl: () => `https://login.microsoftonline.com/${getMicrosoftTenantId()}/oauth2/v2.0/token`,
    profileUrl: "https://graph.microsoft.com/v1.0/me",
    getClientId: () => process.env.MICROSOFT_CLIENT_ID,
    getClientSecret: () => process.env.MICROSOFT_CLIENT_SECRET,
    defaultScopes: [
      "openid",
      "email",
      "offline_access",
      "https://graph.microsoft.com/User.Read",
      "https://graph.microsoft.com/Mail.ReadWrite",
      "https://graph.microsoft.com/Mail.Send",
      "https://graph.microsoft.com/Calendars.Read",
    ],
    buildProfileEmail: (profile) => profile.mail || profile.userPrincipalName || "",
    baseProvider: "microsoft",
    capabilities: ["mail", "calendar"],
  },
  "microsoft-calendar": {
    getAuthUrl: () => `https://login.microsoftonline.com/${getMicrosoftTenantId()}/oauth2/v2.0/authorize`,
    getTokenUrl: () => `https://login.microsoftonline.com/${getMicrosoftTenantId()}/oauth2/v2.0/token`,
    profileUrl: "https://graph.microsoft.com/v1.0/me",
    getClientId: () => process.env.MICROSOFT_CLIENT_ID,
    getClientSecret: () => process.env.MICROSOFT_CLIENT_SECRET,
    defaultScopes: [
      "openid",
      "email",
      "offline_access",
      "https://graph.microsoft.com/User.Read",
      "https://graph.microsoft.com/Calendars.Read",
    ],
    buildProfileEmail: (profile) => profile.mail || profile.userPrincipalName || "",
    baseProvider: "microsoft",
    capabilities: ["calendar"],
  },
  zoom: {
    getAuthUrl: () => "https://zoom.us/oauth/authorize",
    getTokenUrl: () => "https://zoom.us/oauth/token",
    profileUrl: "https://api.zoom.us/v2/users/me",
    getClientId: () => process.env.ZOOM_CLIENT_ID,
    getClientSecret: () => process.env.ZOOM_CLIENT_SECRET,
    defaultScopes: [
      "meeting:read",
      "user:read",
      "recording:read",
    ],
    buildProfileEmail: (profile) => profile.email || "",
    buildProfileDisplayName: (profile) => [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.display_name || profile.email || "",
    usesBasicAuth: true,
    includeScopesInAuthorize: false,
    baseProvider: "zoom",
    capabilities: ["meetings"],
  },
};

export function assertProvider(provider) {
  const config = PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  return config;
}

export function normalizeProviderKey(provider) {
  return assertProvider(provider).baseProvider || provider;
}

export function providerCapabilities(provider) {
  return [...new Set(assertProvider(provider).capabilities || [])];
}

export function hasProviderCredentials(provider) {
  const config = assertProvider(provider);
  return Boolean(config.getClientId() && config.getClientSecret());
}

export function buildProviderAuthUrl(provider, { state, redirectUri }) {
  const config = assertProvider(provider);
  const clientId = config.getClientId();

  if (!clientId) {
    throw new Error(`Missing ${provider} client id`);
  }

  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });

  if (config.includeScopesInAuthorize !== false) {
    params.set("scope", config.defaultScopes.join(" "));
  }

  if (provider === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }

  return `${config.getAuthUrl()}?${params.toString()}`;
}

export async function exchangeOAuthCode(provider, { code, redirectUri }) {
  const config = assertProvider(provider);
  const clientId = config.getClientId();
  const clientSecret = config.getClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error(`Missing ${provider} OAuth credentials`);
  }

  const payload = new URLSearchParams({
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  if (provider === "microsoft") {
    payload.set("scope", config.defaultScopes.join(" "));
  }

  if (!config.usesBasicAuth) {
    payload.set("client_id", clientId.trim());
    payload.set("client_secret", clientSecret.trim());
  }

  const response = await fetchWithTimeout(config.getTokenUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(config.usesBasicAuth
        ? { Authorization: `Basic ${Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString("base64")}` }
        : {}),
    },
    body: payload,
  });

  const data = await readJsonResponse(response);
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || `Failed ${provider} token exchange`);
  }

  return data;
}

export async function refreshOAuthAccessToken(provider, refreshToken) {
  const config = assertProvider(provider);
  const clientId = config.getClientId();
  const clientSecret = config.getClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error(`Missing ${provider} OAuth credentials`);
  }

  if (!refreshToken) {
    throw new Error(`Missing ${provider} refresh token`);
  }

  const payload = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  if (provider === "microsoft") {
    payload.set("scope", config.defaultScopes.join(" "));
  }

  if (!config.usesBasicAuth) {
    payload.set("client_id", clientId.trim());
    payload.set("client_secret", clientSecret.trim());
  }

  const response = await fetchWithTimeout(config.getTokenUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(config.usesBasicAuth
        ? { Authorization: `Basic ${Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString("base64")}` }
        : {}),
    },
    body: payload,
  });

  const data = await readJsonResponse(response);
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || `Failed ${provider} token refresh`);
  }

  return data;
}

export async function fetchProviderProfile(provider, accessToken) {
  const config = assertProvider(provider);

  const response = await fetchWithTimeout(config.profileUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error?.message || `Failed ${provider} profile fetch`);
  }

  return {
    raw: data,
    email: config.buildProfileEmail(data),
    displayName: config.buildProfileDisplayName?.(data) || data.name || data.displayName || data.given_name || data.userPrincipalName || "",
    externalAccountId: data.id || data.sub || data.userPrincipalName || "",
  };
}
