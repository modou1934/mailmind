import { createServer } from "node:http";
import { createHmac, timingSafeEqual, randomBytes, randomUUID } from "node:crypto";
import {
  addConversationMessageRuntime,
  createAuditLog,
  createConversationRuntime,
  createInviteRuntime,
  createMeetingSessionRuntime,
  createMeetingUploadSessionRuntime,
  createNotificationRuntime,
  categorizeMailboxRuntime,
  createDraftForThreadRuntime,
  createOauthStateRuntime,
  createSessionRuntime,
  createTeamRuntime,
  deleteConnectedAccountRuntime,
  deleteDraftRecordRuntime,
  deleteSessionRuntime,
  findConnectedAccountByIdRuntime,
  findConnectedAccountByProviderEmailRuntime,
  findConnectedAccountByWebhookSubscriptionIdRuntime,
  generateDraftsForPendingThreadsRuntime,
  generateDraftOptionsForThreadRuntime,
  getOauthStateRuntime,
  getBillingSummaryRuntime,
  getDashboardRuntime,
  getOrCreateDevUserRuntime,
  getScopedSettingRuntime,
  getSessionRuntime,
  getWorkspaceSummaryRuntime,
  getWebhookSubscriptionRuntime,
  findConversationForUserRuntime,
  listMailSyncStatesRuntime,
  listSyncRunsRuntime,
  listWebhookSubscriptionsRuntime,
  listDraftRecordsRuntime,
  listMailThreadsRuntime,
  listAwaitingReplyThreadsRuntime,
  listConnectedAccountsRuntime,
  listConversationMessagesRuntime,
  listConversationsRuntime,
  listCalendarEventsRuntime,
  listInvitesRuntime,
  listMeetingSessionsRuntime,
  listMeetingSessionChatMessagesRuntime,
  listTeamsRuntime,
  listWorkspaceMembersRuntime,
  maintainWebhookSubscriptions,
  processMeetingSessionRuntime,
  pushDraftRecordRuntime,
  askMeetingSessionQuestionRuntime,
  shareMeetingSessionRuntime,
  setThreadCategoryOverrideRuntime,
  setScopedSettingRuntime,
  syncCalendarRuntime,
  syncMailboxRuntime,
  upsertConnectedAccountRuntime,
  updateWorkspaceSummaryRuntime,
  consumeOauthStateRuntime,
} from "./db.js";
import { encryptString } from "./crypto.js";
import { generateTextWithGemini, getGeminiRuntimeStatus, hasGeminiCredentials } from "./gemini.js";
import { buildProviderAuthUrl, exchangeOAuthCode, fetchProviderProfile, hasProviderCredentials, normalizeProviderKey, providerCapabilities } from "./oauth.js";
import { clearCookie, corsHeaders, empty, json, parseCookies, readBodyText, readJson, setCookie, text } from "./http.js";
import { getPostgresRuntimeStatus } from "./postgres.js";
import { createStripeCheckoutSession, hasStripeCredentials, stripePlans, verifyStripeWebhookSignature } from "./stripe.js";
import { getStorageRuntimeStatus } from "./storage.js";
import { hasDeepgramCredentials } from "./transcription.js";

const SESSION_COOKIE = "mailmind_session";
const CSRF_COOKIE = "mailmind_csrf";
const PORT = Number(process.env.PORT || 8787);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const APP_ENV = process.env.APP_ENV || "development";
const IS_PRODUCTION = APP_ENV === "production";
const PRIVATE_AUTO_LOGIN = process.env.PRIVATE_AUTO_LOGIN === "true";
const AUTO_LOGIN_ENABLED = APP_ENV === "development" && PRIVATE_AUTO_LOGIN;
const WEBHOOK_MAINTENANCE_INTERVAL_MS = Number(process.env.WEBHOOK_MAINTENANCE_INTERVAL_MS || 300000);
const JSON_BODY_LIMIT_BYTES = Number(process.env.JSON_BODY_LIMIT_BYTES || 1024 * 1024);
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000);
const AUTH_RATE_LIMIT_MAX_REQUESTS = Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || 20);
const WRITE_RATE_LIMIT_WINDOW_MS = Number(process.env.WRITE_RATE_LIMIT_WINDOW_MS || 60_000);
const WRITE_RATE_LIMIT_MAX_REQUESTS = Number(process.env.WRITE_RATE_LIMIT_MAX_REQUESTS || 120);
const STALE_SYNC_WINDOW_MS = 1000 * 60 * 60 * 24;
const GOOGLE_WATCH_ATTENTION_WINDOW_MS = 1000 * 60 * 60;
const MICROSOFT_SUBSCRIPTION_ATTENTION_WINDOW_MS = 1000 * 60 * 15;
const isSecureFrontend = FRONTEND_URL.startsWith("https://");
const TRUST_PROXY = process.env.TRUST_PROXY === "true";
const GOOGLE_WEBHOOK_VERIFICATION_TOKEN = process.env.GOOGLE_WEBHOOK_VERIFICATION_TOKEN || "";
const ALLOWED_SETTINGS_KEYS = new Set([
  "billing",
  "categorization",
  "drafts",
  "email-rules",
  "notetaker",
  "organization",
  "scheduling",
]);
const rateLimitStore = new Map();

function providerRedirectUri(provider) {
  if (provider === "google") {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI || `${FRONTEND_URL}/oauth/google`;
  }

  if (provider === "microsoft") {
    return process.env.MICROSOFT_OAUTH_REDIRECT_URI || `${FRONTEND_URL}/oauth/microsoft`;
  }

  if (provider === "zoom") {
    return process.env.ZOOM_OAUTH_REDIRECT_URI || `${FRONTEND_URL}/oauth/zoom`;
  }

  if (provider === "google-calendar") {
    return process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI || process.env.GOOGLE_OAUTH_REDIRECT_URI || `${FRONTEND_URL}/oauth/google-calendar`;
  }

  if (provider === "microsoft-calendar") {
    return process.env.MICROSOFT_CALENDAR_OAUTH_REDIRECT_URI || process.env.MICROSOFT_OAUTH_REDIRECT_URI || `${FRONTEND_URL}/oauth/microsoft-calendar`;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

function verifyZoomWebhookSignature(req, rawBody = "") {
  const secret = process.env.ZOOM_WEBHOOK_SECRET || "";
  if (!secret) {
    return true;
  }

  const signatureHeader = String(req.headers["x-zm-signature"] || "").trim();
  const timestamp = String(req.headers["x-zm-request-timestamp"] || "").trim();
  if (!signatureHeader || !timestamp || !rawBody) {
    return false;
  }

  const message = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${createHmac("sha256", secret).update(message).digest("hex")}`;
  const actualBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function buildZoomValidationResponse(plainToken = "") {
  const secret = process.env.ZOOM_WEBHOOK_SECRET || "";
  return {
    plainToken,
    encryptedToken: createHmac("sha256", secret).update(plainToken).digest("hex"),
  };
}

function billingSuccessUrl() {
  return `${FRONTEND_URL}/impostazioni/fatturazione?checkout=success`;
}

function billingCancelUrl() {
  return `${FRONTEND_URL}/impostazioni/fatturazione?checkout=cancelled`;
}

function mergeBillingSummary(current, patch) {
  return {
    ...current,
    ...patch,
  };
}

function createRouter(method, pathname) {
  const routes = [
    ["GET", "/api/health"],
    ["GET", "/api/auth/me"],
    ["POST", "/api/auth/logout"],
    ["GET", "/api/dashboard"],
    ["GET", "/api/workspace"],
    ["PATCH", "/api/workspace"],
    ["GET", "/api/workspace/members"],
    ["GET", "/api/workspace/teams"],
    ["POST", "/api/workspace/teams"],
    ["GET", "/api/workspace/invites"],
    ["POST", "/api/workspace/invites"],
    ["GET", "/api/integrations/accounts"],
    ["POST", "/api/integrations/oauth/:provider/start"],
    ["POST", "/api/integrations/oauth/:provider/callback"],
    ["DELETE", "/api/integrations/accounts/:id"],
    ["POST", "/api/calendar/sync"],
    ["GET", "/api/calendar/events"],
    ["POST", "/api/mail/sync"],
    ["POST", "/api/mail/categorize"],
    ["POST", "/api/webhooks/google/gmail"],
    ["GET", "/api/webhooks/microsoft"],
    ["POST", "/api/webhooks/microsoft"],
    ["POST", "/api/webhooks/zoom"],
    ["GET", "/api/mail/awaiting-reply"],
    ["GET", "/api/mail/threads"],
    ["POST", "/api/mail/threads/:id/relabel"],
    ["GET", "/api/drafts"],
    ["POST", "/api/drafts/options"],
    ["POST", "/api/drafts/generate"],
    ["POST", "/api/drafts/:id/push"],
    ["DELETE", "/api/drafts/:id"],
    ["GET", "/api/notetaker/sessions"],
    ["POST", "/api/notetaker/sessions/record"],
    ["POST", "/api/notetaker/sessions/join"],
    ["POST", "/api/notetaker/sessions/upload"],
    ["POST", "/api/notetaker/sessions/:id/process"],
    ["GET", "/api/notetaker/sessions/:id/chat"],
    ["POST", "/api/notetaker/sessions/:id/chat"],
    ["POST", "/api/notetaker/sessions/:id/share"],
    ["GET", "/api/settings/:key"],
    ["PUT", "/api/settings/:key"],
    ["GET", "/api/billing/summary"],
    ["GET", "/api/billing/plans"],
    ["POST", "/api/billing/checkout"],
    ["POST", "/api/billing/webhook"],
    ["GET", "/api/chat/conversations"],
    ["POST", "/api/chat/conversations"],
    ["GET", "/api/chat/conversations/:id/messages"],
    ["POST", "/api/chat/conversations/:id/messages"],
  ];

  for (const [routeMethod, pattern] of routes) {
    if (routeMethod !== method) {
      continue;
    }
    const params = matchRoute(pattern, pathname);
    if (params) {
      return { method: routeMethod, pattern, params };
    }
  }
  return null;
}

function matchRoute(pattern, pathname) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathnameParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathnameParts.length) {
    return null;
  }

  const params = {};

  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const pathnamePart = pathnameParts[index];

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathnamePart);
      continue;
    }

    if (patternPart !== pathnamePart) {
      return null;
    }
  }

  return params;
}

function getAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) {
    return FRONTEND_URL;
  }
  return origin === FRONTEND_URL ? origin : FRONTEND_URL;
}

function requestIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (TRUST_PROXY && typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "";
}

function requestUserAgent(req) {
  return req.headers["user-agent"] || "";
}

function isWebhookRoute(route) {
  return route?.pattern === "/api/webhooks/google/gmail"
    || route?.pattern === "/api/webhooks/microsoft"
    || route?.pattern === "/api/webhooks/zoom"
    || route?.pattern === "/api/billing/webhook";
}

function isWriteMethod(method = "GET") {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

function isAllowedOrigin(origin = "") {
  return !origin || origin === FRONTEND_URL;
}

function csrfTokenValue() {
  return randomBytes(24).toString("base64url");
}

function assertAllowedSettingsKey(key) {
  if (ALLOWED_SETTINGS_KEYS.has(key)) {
    return;
  }

  const error = new Error("Unsupported settings key");
  error.status = 404;
  throw error;
}

function assertGoogleWebhookAuthorized(url) {
  if (!GOOGLE_WEBHOOK_VERIFICATION_TOKEN) {
    return;
  }

  if (url.searchParams.get("token") === GOOGLE_WEBHOOK_VERIFICATION_TOKEN) {
    return;
  }

  const error = new Error("Invalid Google webhook token");
  error.status = 403;
  throw error;
}

function sanitizeHealthStatus({ postgres, gemini }) {
  return {
    status: "ok",
    private: true,
    services: {
      googleOAuthConfigured: hasProviderCredentials("google"),
      microsoftOAuthConfigured: hasProviderCredentials("microsoft"),
      deepgramConfigured: hasDeepgramCredentials(),
      storageReady: Boolean(getStorageRuntimeStatus().ready),
      postgresConfigured: Boolean(postgres.configured),
      postgresReachable: Boolean(postgres.reachable),
      geminiConfigured: Boolean(gemini.configured),
      geminiAvailable: Boolean(gemini.available),
    },
  };
}

function ensureCsrfCookie(req, res) {
  const cookies = parseCookies(req);
  const existing = cookies[CSRF_COOKIE];
  if (existing) {
    return existing;
  }

  const token = csrfTokenValue();
  setCookie(res, CSRF_COOKIE, token, {
    maxAge: 60 * 60 * 24 * 30,
    secure: isSecureFrontend,
    sameSite: "Lax",
    httpOnly: false,
  });
  return token;
}

function assertAppWriteRequestAllowed(req, route) {
  if (!isWriteMethod(req.method || "GET") || isWebhookRoute(route)) {
    return;
  }

  const origin = req.headers.origin || "";
  if (!isAllowedOrigin(origin)) {
    const error = new Error("Invalid request origin");
    error.status = 403;
    throw error;
  }

  const cookies = parseCookies(req);
  const csrfCookie = cookies[CSRF_COOKIE] || "";
  const csrfHeader = req.headers["x-csrf-token"] || "";
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    const error = new Error("CSRF token missing or invalid");
    error.status = 403;
    throw error;
  }
}

function sweepRateLimitBucket(bucket, now, windowMs) {
  const filtered = bucket.filter((timestamp) => timestamp > now - windowMs);
  return filtered;
}

function assertRateLimit(req, scope, { windowMs, maxRequests }) {
  const ip = requestIp(req);
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const timestamps = sweepRateLimitBucket(rateLimitStore.get(key) || [], now, windowMs);

  if (timestamps.length >= maxRequests) {
    const error = new Error("Too many requests");
    error.status = 429;
    throw error;
  }

  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
}

async function authPayload(context) {
  return {
    id: context.user.id,
    email: context.user.email,
    full_name: context.user.full_name,
    workspace: await getWorkspaceSummaryRuntime(context.user.id),
  };
}

async function ensureContext(req, res) {
  const cookies = parseCookies(req);
  const existing = await getSessionRuntime(cookies[SESSION_COOKIE]);
  if (existing) {
    ensureCsrfCookie(req, res);
    return existing;
  }

  if (!AUTO_LOGIN_ENABLED) {
    return null;
  }

  const { user, workspace } = await getOrCreateDevUserRuntime();
  const session = await createSessionRuntime(user.id);
  setCookie(res, SESSION_COOKIE, session.id, {
    maxAge: 60 * 60 * 24 * 30,
    secure: isSecureFrontend,
    sameSite: "Lax",
  });
  ensureCsrfCookie(req, res);
  createAuditLog({
    userId: user.id,
    workspaceId: workspace.id,
    eventType: "auth.session.created_auto_login",
    actorEmail: user.email,
    ipAddress: requestIp(req),
    userAgent: requestUserAgent(req),
    metadata: {
      appEnv: APP_ENV,
    },
  });
  return {
    session: { id: session.id, expires_at: session.expiresAt },
    user,
    workspace,
  };
}

async function assistantReply(userText) {
  const prompt = (userText || "").trim();
  if (!prompt) {
    return "Il backend privato e attivo. Scrivi una domanda e salvero la conversazione nel database locale.";
  }

  if (!hasGeminiCredentials()) {
    return `Backend privato attivo. Ho registrato la tua richiesta: "${prompt}". Quando collegherai provider AI reali, questa risposta potra essere sostituita con output generato sul tuo stack privato.`;
  }

  try {
    const response = await generateTextWithGemini({
      model: process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash",
      systemInstruction: "Sei l'assistente interno di MailMind. Rispondi in italiano, in modo diretto, concreto e breve. Non inventare dati non presenti.",
      prompt,
      temperature: 0.35,
      maxOutputTokens: 500,
    });
    return response.text.trim();
  } catch {
    const gemini = getGeminiRuntimeStatus();
    if (gemini.status === "cooldown" && gemini.retryAt) {
      return `Backend privato attivo. Ho registrato la tua richiesta: "${prompt}". Gemini ha esaurito la quota temporaneamente; nuovo tentativo dopo ${new Date(gemini.retryAt).toLocaleTimeString("it-IT")}.`;
    }

    return `Backend privato attivo. Ho registrato la tua richiesta: "${prompt}". Gemini e configurato ma la risposta AI non e disponibile in questo momento.`;
  }
}

function scheduleMailboxSync(userId, accountId, options = {}) {
  setImmediate(() => {
    syncMailboxRuntime(userId, accountId, options).catch((error) => {
      console.error("Webhook sync failed", {
        accountId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });
}

function scheduleCalendarSync(userId, accountId, options = {}) {
  setImmediate(() => {
    syncCalendarRuntime(userId, accountId, options).catch((error) => {
      console.error("Calendar sync failed", {
        accountId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });
}

function isDemoConnectedAccount(account) {
  return account.external_account_id?.startsWith("demo-") || !account.encrypted_access_token?.includes(".");
}

function providerWebhookConfigured(provider) {
  if (provider === "google") {
    return Boolean(process.env.GOOGLE_PUBSUB_TOPIC);
  }

  if (provider === "microsoft") {
    return Boolean(process.env.MICROSOFT_WEBHOOK_BASE_URL || process.env.WEBHOOK_BASE_URL || process.env.APP_URL);
  }

  return false;
}

function subscriptionAttentionWindow(provider) {
  return provider === "microsoft"
    ? MICROSOFT_SUBSCRIPTION_ATTENTION_WINDOW_MS
    : GOOGLE_WATCH_ATTENTION_WINDOW_MS;
}

function isExpired(dateString) {
  if (!dateString) {
    return false;
  }

  const date = new Date(dateString);
  if (!Number.isFinite(date.valueOf())) {
    return false;
  }

  return date.getTime() <= Date.now();
}

function isExpiringSoon(dateString, provider) {
  if (!dateString) {
    return false;
  }

  const date = new Date(dateString);
  if (!Number.isFinite(date.valueOf())) {
    return false;
  }

  return date.getTime() <= Date.now() + subscriptionAttentionWindow(provider);
}

function deriveSubscriptionStatus(account, subscription) {
  if (isDemoConnectedAccount(account)) {
    return "demo";
  }

  if (!providerWebhookConfigured(account.provider)) {
    return "not_configured";
  }

  if (!subscription) {
    return "pending";
  }

  if (subscription.status === "auth_error" || subscription.status === "error") {
    return subscription.status;
  }

  if (isExpired(subscription.expiration_at)) {
    return "expired";
  }

  if (isExpiringSoon(subscription.expiration_at, account.provider)) {
    return "expiring";
  }

  return subscription.status || "active";
}

function deriveSyncStatus(syncState, latestRun) {
  if (latestRun?.status === "failed") {
    return "failed";
  }

  const lastSyncAt = syncState?.last_delta_sync_at || syncState?.last_full_sync_at || latestRun?.created_at || "";
  if (!lastSyncAt) {
    return "idle";
  }

  const date = new Date(lastSyncAt);
  if (!Number.isFinite(date.valueOf())) {
    return "idle";
  }

  if (date.getTime() <= Date.now() - STALE_SYNC_WINDOW_MS) {
    return "stale";
  }

  return "healthy";
}

function deriveOperationalStatus(account, syncState, subscription, latestRun) {
  const subscriptionStatus = deriveSubscriptionStatus(account, subscription);
  const syncStatus = deriveSyncStatus(syncState, latestRun);

  if (isDemoConnectedAccount(account)) {
    return "demo";
  }

  if (latestRun?.status === "failed" || subscriptionStatus === "auth_error" || subscriptionStatus === "error" || subscriptionStatus === "expired") {
    return "error";
  }

  if (syncStatus === "stale" || syncStatus === "idle" || subscriptionStatus === "pending" || subscriptionStatus === "expiring" || subscriptionStatus === "not_configured") {
    return "attention";
  }

  return "active";
}

function latestValue(values) {
  return values.filter(Boolean).sort((left, right) => right.localeCompare(left))[0] || "";
}

function formatAccountDiagnostics(account, threads, drafts, syncState, subscription, latestRun) {
  const capabilities = (() => {
    try {
      const parsed = JSON.parse(account.capabilities_json || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {}

    if (account.provider === "google" || account.provider === "microsoft") {
      return ["mail", "calendar"];
    }

    if (account.provider === "zoom") {
      return ["meetings"];
    }

    return [];
  })();

  if (account.provider === "zoom") {
    return {
      id: account.id,
      provider: account.provider,
      email: account.email,
      display_name: account.display_name,
      connected_at: account.created_at,
      thread_count: 0,
      draft_count: 0,
      last_synced_at: "",
      last_full_sync_at: "",
      last_delta_sync_at: "",
      last_webhook_at: latestRun?.created_at || "",
      last_sync_status: "healthy",
      last_sync_error: "",
      last_sync_run_at: latestRun?.created_at || "",
      subscription_status: "active",
      subscription_expires_at: "",
      subscription_notification_url: process.env.WEBHOOK_BASE_URL ? `${process.env.WEBHOOK_BASE_URL}/api/webhooks/zoom` : "",
      webhook_resource: "zoom.webhook",
      sync_cursor_available: false,
      delta_link_available: false,
      operational_status: isDemoConnectedAccount(account) ? "demo" : "active",
      is_demo: isDemoConnectedAccount(account),
      capabilities,
    };
  }

  const accountThreads = threads.filter((thread) => thread.connected_account_id === account.id);
  const accountDrafts = drafts.filter((draft) => draft.connected_account_id === account.id);
  const subscriptionStatus = deriveSubscriptionStatus(account, subscription);
  const syncStatus = deriveSyncStatus(syncState, latestRun);

  return {
    id: account.id,
    provider: account.provider,
    email: account.email,
    display_name: account.display_name,
    connected_at: account.created_at,
    thread_count: accountThreads.length,
    draft_count: accountDrafts.length,
    last_synced_at: latestValue([
      syncState?.last_delta_sync_at,
      syncState?.last_full_sync_at,
      latestRun?.created_at,
    ]),
    last_full_sync_at: syncState?.last_full_sync_at || "",
    last_delta_sync_at: syncState?.last_delta_sync_at || "",
    last_webhook_at: syncState?.last_webhook_at || "",
    last_sync_status: syncStatus,
    last_sync_error: latestRun?.status === "failed" ? latestRun.error_message || "" : "",
    last_sync_run_at: latestRun?.created_at || "",
    subscription_status: subscriptionStatus,
    subscription_expires_at: subscription?.expiration_at || "",
    subscription_notification_url: subscription?.notification_url || "",
    webhook_resource: subscription?.resource || "",
    sync_cursor_available: Boolean(syncState?.sync_cursor),
    delta_link_available: Boolean(syncState?.delta_link),
    operational_status: deriveOperationalStatus(account, syncState, subscription, latestRun),
    is_demo: isDemoConnectedAccount(account),
    capabilities,
  };
}

const server = createServer(async (req, res) => {
  const origin = getAllowedOrigin(req);
  const baseCorsHeaders = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    empty(res, 204, baseCorsHeaders);
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${PORT}`}`);
  const route = createRouter(req.method || "GET", url.pathname);

  if (!route) {
    json(res, 404, { error: "Not found" }, baseCorsHeaders);
    return;
  }

  try {
    if (route.pattern !== "/api/health" && route.pattern !== "/api/webhooks/microsoft" && route.pattern !== "/api/webhooks/google/gmail" && route.pattern !== "/api/webhooks/zoom" && route.pattern !== "/api/billing/webhook") {
      if (route.pattern.startsWith("/api/auth") || route.pattern.startsWith("/api/integrations/oauth")) {
        assertRateLimit(req, "auth", {
          windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
          maxRequests: AUTH_RATE_LIMIT_MAX_REQUESTS,
        });
      } else if (isWriteMethod(req.method || "GET")) {
        assertRateLimit(req, "write", {
          windowMs: WRITE_RATE_LIMIT_WINDOW_MS,
          maxRequests: WRITE_RATE_LIMIT_MAX_REQUESTS,
        });
      }
    }

    assertAppWriteRequestAllowed(req, route);

    if (route.pattern === "/api/health") {
      const gemini = getGeminiRuntimeStatus();
      const postgres = await getPostgresRuntimeStatus();
      json(res, 200, sanitizeHealthStatus({ gemini, postgres }), baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/auth/me") {
      const context = await ensureContext(req, res);
      if (!context) {
        ensureCsrfCookie(req, res);
        json(res, 401, { error: "Unauthorized" }, baseCorsHeaders);
        return;
      }
      json(res, 200, { user: await authPayload(context) }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/auth/logout") {
      const cookies = parseCookies(req);
      if (cookies[SESSION_COOKIE]) {
        const sessionContext = await getSessionRuntime(cookies[SESSION_COOKIE]);
        await deleteSessionRuntime(cookies[SESSION_COOKIE]);
        if (sessionContext) {
          createAuditLog({
            userId: sessionContext.user.id,
            workspaceId: sessionContext.workspace.id,
            eventType: "auth.session.logout",
            actorEmail: sessionContext.user.email,
            ipAddress: requestIp(req),
            userAgent: requestUserAgent(req),
            metadata: {
              sessionId: cookies[SESSION_COOKIE],
            },
          });
        }
      }
      clearCookie(res, SESSION_COOKIE);
      clearCookie(res, CSRF_COOKIE);
      json(res, 200, { success: true }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/webhooks/google/gmail" && req.method === "POST") {
      assertGoogleWebhookAuthorized(url);
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      const encodedData = body.message?.data || "";
      if (!encodedData) {
        json(res, 202, { accepted: true }, baseCorsHeaders);
        return;
      }

      let payload;
      try {
        payload = JSON.parse(Buffer.from(encodedData, "base64").toString("utf8"));
      } catch {
        json(res, 202, { accepted: true }, baseCorsHeaders);
        return;
      }

      const emailAddress = String(payload.emailAddress || "").trim().toLowerCase();
      if (!emailAddress) {
        json(res, 202, { accepted: true }, baseCorsHeaders);
        return;
      }

      const account = await findConnectedAccountByProviderEmailRuntime("google", emailAddress);
      if (!account) {
        json(res, 202, { accepted: true }, baseCorsHeaders);
        return;
      }

      scheduleMailboxSync(account.user_id, account.id, {
        webhookAt: new Date().toISOString(),
      });
      json(res, 202, { accepted: true }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/webhooks/microsoft" && url.searchParams.has("validationToken")) {
      text(res, 200, url.searchParams.get("validationToken") || "", {
        "Access-Control-Allow-Origin": "*",
      });
      return;
    }

    if (route.pattern === "/api/webhooks/microsoft" && req.method === "GET") {
      json(res, 200, { status: "ok" }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/webhooks/microsoft" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      const notifications = body.value || [];
      const scheduledAccounts = new Set();

      for (const notification of notifications) {
        const account = await findConnectedAccountByWebhookSubscriptionIdRuntime("microsoft", notification.subscriptionId || "");
        if (!account || scheduledAccounts.has(account.id)) {
          continue;
        }

        const subscription = await getWebhookSubscriptionRuntime(account.id);
        if (subscription?.client_state && (!notification.clientState || subscription.client_state !== notification.clientState)) {
          continue;
        }

        scheduledAccounts.add(account.id);
        scheduleMailboxSync(account.user_id, account.id, {
          webhookAt: new Date().toISOString(),
        });
      }

      json(res, 202, { accepted: true }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/webhooks/zoom" && req.method === "POST") {
      const rawBody = await readBodyText(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      let body = {};
      if (rawBody) {
        try {
          body = JSON.parse(rawBody);
        } catch {
          json(res, 400, { error: "Invalid JSON body" }, baseCorsHeaders);
          return;
        }
      }

      if (body.event === "endpoint.url_validation") {
        const plainToken = String(body.payload?.plainToken || "").trim();
        json(res, 200, buildZoomValidationResponse(plainToken), baseCorsHeaders);
        return;
      }

      if (!verifyZoomWebhookSignature(req, rawBody)) {
        json(res, 403, { error: "Invalid Zoom webhook signature" }, baseCorsHeaders);
        return;
      }

      const zoomObject = body.payload?.object || {};
      const hostEmail = String(zoomObject.host_email || body.payload?.account_email || "").trim().toLowerCase();
      const account = hostEmail
        ? await findConnectedAccountByProviderEmailRuntime("zoom", hostEmail)
        : null;

      if (account) {
        await createNotificationRuntime(account.user_id, {
          title: `Zoom ${String(body.event || "evento").replaceAll(".", " ")}`,
          body: zoomObject.topic
            ? `${zoomObject.topic}${zoomObject.start_time ? ` • ${zoomObject.start_time}` : ""}`
            : "Nuovo evento Zoom ricevuto dal webhook.",
          link: "/notetaker",
        });
      }

      json(res, 202, { accepted: true }, baseCorsHeaders);
      return;
    }

    const context = await ensureContext(req, res);
    if (!context) {
      json(res, 401, { error: "Unauthorized" }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/dashboard") {
      json(res, 200, await getDashboardRuntime(context.user.id), baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/workspace" && req.method === "GET") {
      json(res, 200, await getWorkspaceSummaryRuntime(context.user.id), baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/workspace" && req.method === "PATCH") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      json(res, 200, await updateWorkspaceSummaryRuntime(context.user.id, body), baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/workspace/members") {
      json(res, 200, { members: await listWorkspaceMembersRuntime(context.workspace.id) }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/workspace/teams" && req.method === "GET") {
      json(res, 200, { teams: await listTeamsRuntime(context.workspace.id) }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/workspace/teams" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      if (!body.name?.trim()) {
        json(res, 400, { error: "Team name required" }, baseCorsHeaders);
        return;
      }
      json(res, 201, { team: await createTeamRuntime(context.workspace.id, body.name.trim()) }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/workspace/invites" && req.method === "GET") {
      json(res, 200, { invites: await listInvitesRuntime(context.workspace.id) }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/workspace/invites" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      if (!body.email?.trim()) {
        json(res, 400, { error: "Invite email required" }, baseCorsHeaders);
        return;
      }
      json(
        res,
        201,
        { invite: await createInviteRuntime(context.workspace.id, body.email.trim(), body.role || "member") },
        baseCorsHeaders,
      );
      return;
    }

    if (route.pattern === "/api/integrations/accounts" && req.method === "GET") {
      const threads = await listMailThreadsRuntime(context.user.id);
      const drafts = await listDraftRecordsRuntime(context.user.id);
      const syncStates = new Map((await listMailSyncStatesRuntime(context.user.id)).map((state) => [state.connected_account_id, state]));
      const subscriptions = new Map((await listWebhookSubscriptionsRuntime(context.user.id)).map((item) => [item.connected_account_id, item]));
      const latestSyncRuns = new Map();

      for (const run of await listSyncRunsRuntime(context.user.id)) {
        if (!latestSyncRuns.has(run.connected_account_id)) {
          latestSyncRuns.set(run.connected_account_id, run);
        }
      }

      const accounts = (await listConnectedAccountsRuntime(context.user.id)).map((account) => formatAccountDiagnostics(
        account,
        threads,
        drafts,
        syncStates.get(account.id) || null,
        subscriptions.get(account.id) || null,
        latestSyncRuns.get(account.id) || null,
      ));
      json(res, 200, { accounts }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/integrations/oauth/:provider/start") {
      const { provider } = route.params;
      const redirectUri = providerRedirectUri(provider);

      if (!hasProviderCredentials(provider)) {
        json(
          res,
          400,
          { error: `Missing ${provider} OAuth credentials in .env` },
          baseCorsHeaders,
        );
        return;
      }

      const state = randomUUID();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();
      await createOauthStateRuntime({
        state,
        workspaceId: context.workspace.id,
        userId: context.user.id,
        provider,
        redirectUri,
        expiresAt,
      });

      createAuditLog({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        eventType: "oauth.start",
        actorEmail: context.user.email,
        ipAddress: requestIp(req),
        userAgent: requestUserAgent(req),
        metadata: {
          provider,
          redirectUri,
        },
      });

      const urlToOpen = buildProviderAuthUrl(provider, { state, redirectUri });
      json(res, 200, { url: urlToOpen, state }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/integrations/oauth/:provider/callback") {
      const { provider } = route.params;
      const baseProvider = normalizeProviderKey(provider);
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      const stateRow = await getOauthStateRuntime(body.state, provider);

      if (!stateRow) {
        createAuditLog({
          eventType: "oauth.callback.invalid_state",
          ipAddress: requestIp(req),
          userAgent: requestUserAgent(req),
          metadata: {
            provider,
          },
        });
        json(res, 400, { error: "Invalid or expired OAuth state" }, baseCorsHeaders);
        return;
      }

      await consumeOauthStateRuntime(body.state, provider);

      let tokenData;
      try {
        tokenData = await exchangeOAuthCode(provider, {
          code: body.code,
          redirectUri: stateRow.redirect_uri,
        });
      } catch (error) {
        json(res, 400, { error: error.message || "Failed to exchange OAuth code" }, baseCorsHeaders);
        return;
      }

      let profile;
      try {
        profile = await fetchProviderProfile(provider, tokenData.access_token);
      } catch (error) {
        json(res, 400, { error: error.message || "Failed to fetch profile" }, baseCorsHeaders);
        return;
      }

      const account = await upsertConnectedAccountRuntime({
        workspaceId: stateRow.workspace_id,
        userId: stateRow.user_id,
        provider: baseProvider,
        email: profile.email,
        displayName: profile.displayName,
        externalAccountId: profile.externalAccountId,
        encryptedAccessToken: encryptString(tokenData.access_token),
        encryptedRefreshToken: encryptString(tokenData.refresh_token || ""),
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : "",
        capabilities: providerCapabilities(provider),
      });

      createAuditLog({
        userId: stateRow.user_id,
        workspaceId: stateRow.workspace_id,
        eventType: "oauth.callback.success",
        actorEmail: account.email,
        ipAddress: requestIp(req),
        userAgent: requestUserAgent(req),
        metadata: {
          provider,
          baseProvider,
          connectedAccountId: account.id,
        },
      });

      if (providerCapabilities(provider).includes("calendar")) {
        scheduleCalendarSync(stateRow.user_id, account.id);
      }

      json(res, 200, {
        success: true,
        email: account.email,
        provider: baseProvider,
        capabilities: providerCapabilities(provider),
      }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/integrations/accounts/:id" && req.method === "DELETE") {
      const account = await findConnectedAccountByIdRuntime(route.params.id);
      const deleted = await deleteConnectedAccountRuntime(context.user.id, route.params.id);
      if (!deleted) {
        json(res, 404, { error: "Account not found" }, baseCorsHeaders);
        return;
      }
      createAuditLog({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        eventType: "integrations.account.deleted",
        actorEmail: context.user.email,
        ipAddress: requestIp(req),
        userAgent: requestUserAgent(req),
        metadata: {
          deletedAccountId: route.params.id,
          provider: account?.provider || "",
          accountEmail: account?.email || "",
        },
      });
      json(res, 200, { success: true }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/calendar/sync" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      const result = await syncCalendarRuntime(context.user.id, body.accountId || null, {
        timeMin: body.timeMin || "",
        timeMax: body.timeMax || "",
        maxResults: body.maxResults || undefined,
      });
      if (result.syncedAccounts === 0) {
        json(res, 400, { error: "Connect at least one calendar account before syncing" }, baseCorsHeaders);
        return;
      }
      json(res, 200, result, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/calendar/events" && req.method === "GET") {
      const result = await listCalendarEventsRuntime(context.user.id, {
        from: url.searchParams.get("from") || "",
        to: url.searchParams.get("to") || "",
        accountId: url.searchParams.get("accountId") || null,
        includeCancelled: url.searchParams.get("includeCancelled") === "true",
        limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
      });
      json(res, 200, result, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/mail/sync" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      const result = await syncMailboxRuntime(context.user.id, body.accountId || null);
      if (result.syncedAccounts === 0) {
        json(res, 400, { error: "Connect at least one email account before syncing" }, baseCorsHeaders);
        return;
      }
      json(res, 200, result, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/mail/categorize" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: 25 * 1024 * 1024 });
      const result = await categorizeMailboxRuntime(context.user.id, {
        accountId: body.accountId || null,
        threadId: body.threadId || null,
        workspaceId: context.workspace.id,
      });
      json(res, 200, result, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/mail/awaiting-reply" && req.method === "GET") {
      json(res, 200, {
        threads: await listAwaitingReplyThreadsRuntime(context.user.id, {
          workspaceId: context.workspace.id,
        }),
      }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/mail/threads" && req.method === "GET") {
      json(res, 200, {
        threads: await listMailThreadsRuntime(context.user.id, {
          workspaceId: context.workspace.id,
        }),
      }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/mail/threads/:id/relabel" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      const override = await setThreadCategoryOverrideRuntime(
        context.user.id,
        context.workspace.id,
        route.params.id,
        body,
      );
      if (!override) {
        json(res, 404, { error: "Thread not found" }, baseCorsHeaders);
        return;
      }
      json(res, 200, { override }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/drafts" && req.method === "GET") {
      json(res, 200, { drafts: await listDraftRecordsRuntime(context.user.id) }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/drafts/options" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      const options = await generateDraftOptionsForThreadRuntime(context.user.id, body.threadId || "", {
        workspaceId: context.workspace.id,
      });
      if (!options) {
        json(res, 404, { error: "Thread not found" }, baseCorsHeaders);
        return;
      }
      json(res, 200, options, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/drafts/generate" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      if (body.threadId) {
        const draft = await createDraftForThreadRuntime(context.user.id, body.threadId, {
          customContent: body.customContent || "",
        });
        if (!draft) {
          json(res, 404, { error: "Thread not found" }, baseCorsHeaders);
          return;
        }
        json(res, 201, { draft }, baseCorsHeaders);
        return;
      }

      const drafts = await generateDraftsForPendingThreadsRuntime(context.user.id);
      json(res, 201, {
        drafts,
        created: drafts.length,
        pushed: drafts.filter((draft) => draft.provider_push_status === "synced").length,
        failedPushes: drafts.filter((draft) => draft.provider_push_status === "push_failed").length,
      }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/drafts/:id/push" && req.method === "POST") {
      const draft = await pushDraftRecordRuntime(context.user.id, route.params.id);
      if (!draft) {
        json(res, 404, { error: "Draft not found" }, baseCorsHeaders);
        return;
      }
      json(res, 200, { draft }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/drafts/:id" && req.method === "DELETE") {
      const deleted = await deleteDraftRecordRuntime(context.user.id, route.params.id);
      if (!deleted) {
        json(res, 404, { error: "Draft not found" }, baseCorsHeaders);
        return;
      }
      json(res, 200, { success: true, deleted }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/notetaker/sessions" && req.method === "GET") {
      json(res, 200, { sessions: await listMeetingSessionsRuntime(context.user.id) }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/notetaker/sessions/record" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      const session = await createMeetingSessionRuntime(context.user.id, {
        sourceType: "record",
        calendarEventId: body.calendarEventId || "",
        title: body.title || "",
        meetingUrl: body.meetingUrl || "",
        transcriptText: body.transcriptText || "",
        language: body.language || "",
      });
      json(res, 201, { session }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/notetaker/sessions/join" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      if (!body.meetingUrl?.trim() && !body.calendarEventId) {
        json(res, 400, { error: "Meeting URL or linked calendar event required" }, baseCorsHeaders);
        return;
      }
      const session = await createMeetingSessionRuntime(context.user.id, {
        sourceType: "join",
        calendarEventId: body.calendarEventId || "",
        title: body.title || "",
        meetingUrl: body.meetingUrl || "",
        transcriptText: body.transcriptText || "",
        language: body.language || "",
      });
      json(res, 201, { session }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/notetaker/sessions/upload" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: 35 * 1024 * 1024 });
      if (!body.audioBase64?.trim()) {
        json(res, 400, { error: "Audio payload required" }, baseCorsHeaders);
        return;
      }

      const audioBuffer = Buffer.from(body.audioBase64, "base64");
      if (audioBuffer.length === 0) {
        json(res, 400, { error: "Invalid audio payload" }, baseCorsHeaders);
        return;
      }

      if (audioBuffer.length > 25 * 1024 * 1024) {
        json(res, 413, { error: "Audio payload too large for JSON upload" }, baseCorsHeaders);
        return;
      }

      const session = await createMeetingUploadSessionRuntime(context.user.id, {
        calendarEventId: body.calendarEventId || "",
        title: body.title || "",
        meetingUrl: body.meetingUrl || "",
        language: body.language || "",
        sourceFileName: body.fileName || "",
        sourceFileType: body.mimeType || "application/octet-stream",
        sourceFileSize: Number(body.fileSize || audioBuffer.length || 0),
        audioBuffer,
      });

      json(res, 201, { session }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/notetaker/sessions/:id/process" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      const session = await processMeetingSessionRuntime(context.user.id, route.params.id, body.transcriptText || "");
      if (!session) {
        json(res, 404, { error: "Meeting session not found" }, baseCorsHeaders);
        return;
      }
      json(res, 200, { session }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/notetaker/sessions/:id/chat" && req.method === "GET") {
      const messages = await listMeetingSessionChatMessagesRuntime(context.user.id, route.params.id);
      if (!messages) {
        json(res, 404, { error: "Meeting session not found" }, baseCorsHeaders);
        return;
      }
      json(res, 200, { messages }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/notetaker/sessions/:id/chat" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      const result = await askMeetingSessionQuestionRuntime(context.user.id, route.params.id, body.content || "");
      if (!result) {
        json(res, 404, { error: "Meeting session not found" }, baseCorsHeaders);
        return;
      }
      json(res, 200, result, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/notetaker/sessions/:id/share" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      const result = await shareMeetingSessionRuntime(context.user.id, route.params.id, body);
      if (!result) {
        json(res, 404, { error: "Meeting session not found" }, baseCorsHeaders);
        return;
      }
      json(res, 200, result, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/settings/:key" && req.method === "GET") {
      assertAllowedSettingsKey(route.params.key);
      const value = await getScopedSettingRuntime(context.workspace.id, route.params.key);
      json(res, 200, { value }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/settings/:key" && req.method === "PUT") {
      assertAllowedSettingsKey(route.params.key);
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      json(res, 200, { value: await setScopedSettingRuntime(context.workspace.id, route.params.key, body) }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/billing/plans") {
      json(res, 200, {
        configured: hasStripeCredentials(),
        plans: stripePlans(),
      }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/billing/summary") {
      json(res, 200, await getBillingSummaryRuntime(context.workspace.id), baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/billing/checkout" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      const tier = body.tier === "professional" ? "professional" : "starter";
      const interval = body.interval === "annual" ? "annual" : "monthly";
      const session = await createStripeCheckoutSession({
        tier,
        interval,
        userEmail: context.user.email,
        workspaceId: context.workspace.id,
        successUrl: billingSuccessUrl(),
        cancelUrl: billingCancelUrl(),
      });
      json(res, 200, { url: session.url || "", sessionId: session.id || "" }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/billing/webhook" && req.method === "POST") {
      const rawBody = await readBodyText(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      if (!verifyStripeWebhookSignature(rawBody, req.headers["stripe-signature"])) {
        json(res, 403, { error: "Invalid Stripe webhook signature" }, baseCorsHeaders);
        return;
      }

      const event = rawBody ? JSON.parse(rawBody) : {};
      const object = event.data?.object || {};
      const workspaceId = String(object.metadata?.workspace_id || object.client_reference_id || "").trim();

      if (workspaceId) {
        const currentBilling = await getBillingSummaryRuntime(workspaceId);
        let nextBilling = currentBilling;

        if (event.type === "checkout.session.completed") {
          const tier = object.metadata?.tier === "professional" ? "professional" : "starter";
          const interval = object.metadata?.interval === "annual" ? "annual" : "monthly";
          nextBilling = mergeBillingSummary(currentBilling, {
            planName: tier === "professional" ? "PROFESSIONAL" : "STARTER",
            badge: "Trial attivo",
            price: tier === "professional"
              ? (interval === "annual" ? "EUR384" : "EUR40")
              : (interval === "annual" ? "EUR192" : "EUR20"),
            cadence: interval === "annual" ? "anno" : "mese",
            billingInterval: interval === "annual" ? "Annuale" : "Mensile",
            nextPayment: object.subscription ? "Dopo trial Stripe" : currentBilling.nextPayment,
          });
        }

        if (event.type === "invoice.paid") {
          nextBilling = mergeBillingSummary(currentBilling, {
            badge: "Attivo",
            nextPayment: object.lines?.data?.[0]?.period?.end
              ? new Date(object.lines.data[0].period.end * 1000).toLocaleDateString("it-IT")
              : currentBilling.nextPayment,
          });
        }

        if (event.type === "invoice.payment_failed") {
          nextBilling = mergeBillingSummary(currentBilling, {
            badge: "Pagamento fallito",
          });
        }

        if (event.type === "customer.subscription.deleted") {
          nextBilling = mergeBillingSummary(currentBilling, {
            badge: "Annullato",
          });
        }

        await setScopedSettingRuntime(workspaceId, "billing", nextBilling);
      }

      json(res, 200, { received: true }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/chat/conversations" && req.method === "GET") {
      json(res, 200, { conversations: await listConversationsRuntime(context.user.id) }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/chat/conversations" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      json(res, 201, { conversation: await createConversationRuntime(context.user.id, body.title || "Nuova chat") }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/chat/conversations/:id/messages" && req.method === "GET") {
      const conversation = await findConversationForUserRuntime(context.user.id, route.params.id);
      if (!conversation) {
        json(res, 404, { error: "Conversation not found" }, baseCorsHeaders);
        return;
      }
      json(res, 200, { messages: await listConversationMessagesRuntime(context.user.id, route.params.id) }, baseCorsHeaders);
      return;
    }

    if (route.pattern === "/api/chat/conversations/:id/messages" && req.method === "POST") {
      const body = await readJson(req, { maxBytes: JSON_BODY_LIMIT_BYTES });
      if (!body.content?.trim()) {
        json(res, 400, { error: "Message content required" }, baseCorsHeaders);
        return;
      }

      const userMessage = await addConversationMessageRuntime(context.user.id, route.params.id, "user", body.content.trim());
      if (!userMessage) {
        json(res, 404, { error: "Conversation not found" }, baseCorsHeaders);
        return;
      }
      const reply = await assistantReply(body.content);
      const assistantMessage = await addConversationMessageRuntime(context.user.id, route.params.id, "assistant", reply);
      json(res, 201, { userMessage, assistantMessage }, baseCorsHeaders);
      return;
    }

    json(res, 404, { error: "Not found" }, baseCorsHeaders);
  } catch (error) {
    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
      ? error.status
      : 500;
    if (status >= 500) {
      console.error("Request failed", {
        error: error instanceof Error ? error.message : String(error),
        path: req.url,
        method: req.method,
      });
    }
    json(
      res,
      status,
      {
        error: status >= 500 && IS_PRODUCTION
          ? "Internal server error"
          : error instanceof Error
            ? error.message
            : "Internal server error",
      },
      baseCorsHeaders,
    );
  }
});

server.listen(PORT, () => {
  console.log(`MailMind private backend listening on http://localhost:${PORT}`);
});

const webhookMaintenanceInterval = setInterval(() => {
  maintainWebhookSubscriptions()
    .then((result) => {
      if (result.renewedSubscriptions > 0 || result.failedSubscriptions > 0) {
        console.log("Webhook maintenance", result);
      }
    })
    .catch((error) => {
      console.error("Webhook maintenance failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
}, WEBHOOK_MAINTENANCE_INTERVAL_MS);

webhookMaintenanceInterval.unref?.();
