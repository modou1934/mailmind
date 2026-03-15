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
  },
};

export function assertProvider(provider) {
  const config = PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  return config;
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
    scope: config.defaultScopes.join(" "),
    state,
  });

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
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  if (provider === "microsoft") {
    payload.set("scope", config.defaultScopes.join(" "));
  }

  const response = await fetch(config.getTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
  });

  const data = await response.json();
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
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  if (provider === "microsoft") {
    payload.set("scope", config.defaultScopes.join(" "));
  }

  const response = await fetch(config.getTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || `Failed ${provider} token refresh`);
  }

  return data;
}

export async function fetchProviderProfile(provider, accessToken) {
  const config = assertProvider(provider);

  const response = await fetch(config.profileUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Failed ${provider} profile fetch`);
  }

  return {
    raw: data,
    email: config.buildProfileEmail(data),
    displayName: data.name || data.displayName || data.given_name || data.userPrincipalName || "",
    externalAccountId: data.id || data.sub || data.userPrincipalName || "",
  };
}
