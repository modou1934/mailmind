import { randomUUID } from "node:crypto";
import { decryptString, encryptString } from "./crypto.js";
import { refreshOAuthAccessToken } from "./oauth.js";

const THREAD_LIMIT = Number(process.env.MAIL_SYNC_THREAD_LIMIT || 15);
const MESSAGE_LIMIT = Number(process.env.MAIL_SYNC_MESSAGE_LIMIT || 50);
const LOOKBACK_DAYS = Number(process.env.MAIL_SYNC_LOOKBACK_DAYS || 30);
const CALENDAR_SYNC_MAX_RESULTS = Number(process.env.CALENDAR_SYNC_MAX_RESULTS || 100);
const CALENDAR_SYNC_LOOKBACK_DAYS = Number(process.env.CALENDAR_SYNC_LOOKBACK_DAYS || 7);
const CALENDAR_SYNC_LOOKAHEAD_DAYS = Number(process.env.CALENDAR_SYNC_LOOKAHEAD_DAYS || 30);
const GOOGLE_WATCH_RENEW_WINDOW_MS = 1000 * 60 * 60;
const MICROSOFT_SUBSCRIPTION_RENEW_WINDOW_MS = 1000 * 60 * 15;

const MICROSOFT_MESSAGE_FIELDS = [
  "id",
  "conversationId",
  "subject",
  "body",
  "bodyPreview",
  "from",
  "sender",
  "receivedDateTime",
  "sentDateTime",
  "isDraft",
  "isRead",
  "internetMessageId",
];

const MICROSOFT_CALENDAR_FIELDS = [
  "id",
  "subject",
  "organizer",
  "start",
  "end",
  "isAllDay",
  "attendees",
  "isCancelled",
  "onlineMeeting",
  "onlineMeetingUrl",
  "webLink",
  "location",
  "locations",
  "bodyPreview",
];

const CRLF = "\r\n";

export class ProviderAuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = "ProviderAuthError";
    this.status = status;
  }
}

async function readJsonResponse(response) {
  if (response.status === 204 || response.status === 205) {
    return {};
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  const text = await response.text();
  return { message: text };
}

async function providerRequest(url, accessToken, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...headers,
    },
    body,
  });

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    if (response.status === 401) {
      throw new ProviderAuthError(payload?.error?.message || payload?.message || "Provider access token expired");
    }

    const error = new Error(
      payload?.error?.message
      || payload?.error_description
      || payload?.message
      || "Provider request failed",
    );
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function maybeProviderRequest(url, accessToken, options = {}) {
  try {
    return await providerRequest(url, accessToken, options);
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

function normalizeWhitespace(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function extractMeetingUrl(value = "") {
  const match = String(value || "").match(/https?:\/\/[^\s<>"')]+/i);
  return match ? match[0] : "";
}

function detectMeetingProvider(meetingUrl = "") {
  const normalized = String(meetingUrl || "").toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized.includes("meet.google.com")) {
    return "google_meet";
  }
  if (normalized.includes("teams.microsoft.com") || normalized.includes("teams.live.com")) {
    return "microsoft_teams";
  }
  if (normalized.includes("zoom.us")) {
    return "zoom";
  }
  if (normalized.includes("webex.com")) {
    return "webex";
  }
  return "external";
}

function calendarDateTimeToIso(dateTime = "", fallbackTime = "00:00:00Z") {
  if (!dateTime) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTime)) {
    return new Date(`${dateTime}T${fallbackTime}`).toISOString();
  }

  const parsed = new Date(dateTime);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : "";
}

function defaultCalendarWindow({ timeMin = "", timeMax = "", maxResults } = {}) {
  return {
    timeMin: timeMin || new Date(Date.now() - CALENDAR_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    timeMax: timeMax || new Date(Date.now() + CALENDAR_SYNC_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    maxResults: Number(maxResults || CALENDAR_SYNC_MAX_RESULTS),
  };
}

function stripHtml(value = "") {
  return normalizeWhitespace(
    value
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">"),
  );
}

function parseEmailAddress(rawValue = "") {
  const raw = rawValue.trim();
  const match = raw.match(/^(.*?)(?:<([^>]+)>)?$/);
  const name = normalizeWhitespace((match?.[1] || "").replace(/^"|"$/g, ""));
  const address = (match?.[2] || raw).trim().toLowerCase();

  if (!address.includes("@")) {
    return {
      name: name || raw,
      email: "",
    };
  }

  return {
    name: name || address.split("@")[0],
    email: address,
  };
}

function normalizeGoogleCalendarEvent(event) {
  const videoEntry = event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video");
  const meetingUrl = event.hangoutLink
    || videoEntry?.uri
    || extractMeetingUrl(event.description)
    || extractMeetingUrl(event.location)
    || "";
  const organizer = event.organizer || {};
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
  const startAt = calendarDateTimeToIso(event.start?.dateTime || event.start?.date || "", "00:00:00Z");
  const endAt = calendarDateTimeToIso(event.end?.dateTime || event.end?.date || "", isAllDay ? "23:59:59Z" : "00:00:00Z");

  return {
    externalEventId: event.id,
    calendarId: event.organizer?.email || "primary",
    title: normalizeWhitespace(event.summary || "(senza titolo)"),
    organizerName: organizer.displayName || organizer.email || "",
    organizerEmail: (organizer.email || "").toLowerCase(),
    meetingUrl,
    joinProvider: detectMeetingProvider(meetingUrl),
    status: event.status || "confirmed",
    startAt,
    endAt,
    timezone: event.start?.timeZone || event.end?.timeZone || "",
    attendeeCount: Array.isArray(event.attendees) ? event.attendees.length : 0,
    isAllDay: isAllDay ? 1 : 0,
    location: normalizeWhitespace(event.location || ""),
  };
}

async function fetchGoogleCalendarEvents(accessToken, options = {}) {
  const window = defaultCalendarWindow(options);
  const events = [];
  let pageToken = "";

  do {
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("showDeleted", "true");
    url.searchParams.set("timeMin", window.timeMin);
    url.searchParams.set("timeMax", window.timeMax);
    url.searchParams.set("maxResults", String(Math.min(window.maxResults, 250)));
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const payload = await providerRequest(url.toString(), accessToken);
    for (const event of payload.items || []) {
      if (!event?.id) {
        continue;
      }
      events.push(normalizeGoogleCalendarEvent(event));
      if (events.length >= window.maxResults) {
        break;
      }
    }

    pageToken = events.length >= window.maxResults ? "" : (payload.nextPageToken || "");
  } while (pageToken);

  return events;
}

function decodeBase64Url(value = "") {
  if (!value) {
    return "";
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function encodeBase64Url(value = "") {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sanitizeHeaderValue(value = "") {
  return String(value).replace(/\r?\n/g, " ").trim();
}

function encodeMimeHeader(value = "") {
  const sanitized = sanitizeHeaderValue(value);
  if (!sanitized) {
    return "";
  }

  return /^[\x00-\x7F]*$/.test(sanitized)
    ? sanitized
    : `=?UTF-8?B?${Buffer.from(sanitized, "utf8").toString("base64")}?=`;
}

function buildPlainTextMimeMessage({
  fromEmail,
  toEmail,
  subject,
  content,
  inReplyTo = "",
  references = "",
}) {
  const headers = [
    `From: ${sanitizeHeaderValue(fromEmail)}`,
    `To: ${sanitizeHeaderValue(toEmail)}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${sanitizeHeaderValue(inReplyTo)}`);
  }

  if (references) {
    headers.push(`References: ${sanitizeHeaderValue(references)}`);
  }

  return `${headers.join(CRLF)}${CRLF}${CRLF}${content}`;
}

function extractGmailHeader(message, headerName) {
  return message?.payload?.headers?.find((header) => header.name?.toLowerCase() === headerName.toLowerCase())?.value || "";
}

function extractGmailBody(part) {
  if (!part) {
    return "";
  }

  if (part.mimeType === "text/plain" && part.body?.data) {
    return normalizeWhitespace(decodeBase64Url(part.body.data));
  }

  if (part.mimeType === "text/html" && part.body?.data) {
    return stripHtml(decodeBase64Url(part.body.data));
  }

  if (Array.isArray(part.parts)) {
    for (const childPart of part.parts) {
      const childBody = extractGmailBody(childPart);
      if (childBody) {
        return childBody;
      }
    }
  }

  return "";
}

function normalizeGmailThread(account, thread) {
  const accountEmail = account.email.toLowerCase();
  const messages = [...(thread.messages || [])]
    .sort((left, right) => Number(left.internalDate || 0) - Number(right.internalDate || 0))
    .map((message) => {
      const sender = parseEmailAddress(extractGmailHeader(message, "From"));
      const labelIds = message.labelIds || [];
      const subject = extractGmailHeader(message, "Subject");
      const role = sender.email === accountEmail ? "outgoing" : "incoming";
      const content = extractGmailBody(message.payload) || normalizeWhitespace(message.snippet || "");
      const createdAt = new Date(Number(message.internalDate || Date.now())).toISOString();

      return {
        externalMessageId: message.id,
        role,
        content,
        senderName: sender.name,
        senderEmail: sender.email,
        createdAt,
        messageSubject: subject || "",
        isRead: !labelIds.includes("UNREAD"),
        internetMessageId: extractGmailHeader(message, "Message-ID") || "",
        historyId: String(message.historyId || ""),
        labelIds,
      };
    });

  const latestMessage = messages.at(-1);
  const latestIncomingMessage = [...messages].reverse().find((message) => message.role === "incoming") || latestMessage;
  const lastMessageAt = latestMessage?.createdAt || new Date().toISOString();
  const subject = latestMessage?.messageSubject || thread.snippet || "(senza oggetto)";
  const latestHistoryId = messages
    .map((message) => message.historyId || "0")
    .sort((left, right) => Number(right) - Number(left))[0] || "";

  return {
    externalThreadId: thread.id,
    subject,
    fromName: latestIncomingMessage?.senderName || account.display_name || account.email,
    fromEmail: latestIncomingMessage?.senderEmail || account.email,
    snippet: normalizeWhitespace(thread.snippet || latestMessage?.content || subject),
    category: latestMessage?.role === "incoming" ? "todo" : "fyi",
    status: latestMessage?.labelIds?.includes("INBOX") ? "nuovo" : "archiviata",
    lastMessageAt,
    needsReply: latestMessage?.role === "incoming" ? 1 : 0,
    syncCursor: latestHistoryId,
    messages: messages.map((message) => ({
      externalMessageId: message.externalMessageId,
      role: message.role,
      content: message.content,
      senderName: message.senderName,
      senderEmail: message.senderEmail,
      createdAt: message.createdAt,
      messageSubject: message.messageSubject,
      isRead: message.isRead,
      internetMessageId: message.internetMessageId,
    })),
  };
}

async function fetchGoogleThread(accessToken, account, threadId) {
  const thread = await maybeProviderRequest(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`,
    accessToken,
  );

  return thread ? normalizeGmailThread(account, thread) : null;
}

async function fetchGoogleFullSync(accessToken, account) {
  const threadIndex = await providerRequest(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${THREAD_LIMIT}&labelIds=INBOX`,
    accessToken,
  );

  const threads = await Promise.all(
    (threadIndex.threads || []).slice(0, THREAD_LIMIT).map((item) => fetchGoogleThread(accessToken, account, item.id)),
  );

  const normalizedThreads = threads.filter(Boolean);
  const syncCursor = normalizedThreads
    .map((thread) => thread.syncCursor || "0")
    .sort((left, right) => Number(right) - Number(left))[0] || "";

  return {
    mode: "full",
    threads: normalizedThreads,
    deletedMessageIds: [],
    deletedThreadIds: [],
    syncStatePatch: {
      syncCursor,
      lastDeltaSyncAt: new Date().toISOString(),
    },
  };
}

async function fetchGoogleDeltaSync(accessToken, account, syncCursor) {
  const changedThreadIds = new Set();
  const deletedMessageIds = new Set();
  let pageToken = "";
  let currentCursor = syncCursor;

  try {
    do {
      const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/history");
      url.searchParams.set("startHistoryId", currentCursor);
      url.searchParams.set("maxResults", "100");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const payload = await providerRequest(url.toString(), accessToken);
      currentCursor = String(payload.historyId || currentCursor || "");
      pageToken = payload.nextPageToken || "";

      for (const item of payload.history || []) {
        for (const historyMessage of item.messages || []) {
          if (historyMessage.threadId) {
            changedThreadIds.add(historyMessage.threadId);
          }
        }

        for (const added of item.messagesAdded || []) {
          if (added.message?.threadId) {
            changedThreadIds.add(added.message.threadId);
          }
        }

        for (const removed of item.messagesDeleted || []) {
          if (removed.message?.id) {
            deletedMessageIds.add(removed.message.id);
          }
          if (removed.message?.threadId) {
            changedThreadIds.add(removed.message.threadId);
          }
        }

        for (const labelChange of item.labelsAdded || []) {
          if (labelChange.message?.threadId) {
            changedThreadIds.add(labelChange.message.threadId);
          }
        }

        for (const labelChange of item.labelsRemoved || []) {
          if (labelChange.message?.threadId) {
            changedThreadIds.add(labelChange.message.threadId);
          }
        }
      }
    } while (pageToken);
  } catch (error) {
    if (error.status === 404) {
      return fetchGoogleFullSync(accessToken, account);
    }
    throw error;
  }

  const threads = await Promise.all(
    [...changedThreadIds].map((threadId) => fetchGoogleThread(accessToken, account, threadId)),
  );
  const changedThreadIdsArray = [...changedThreadIds];

  return {
    mode: "delta",
    threads: threads.filter(Boolean),
    deletedMessageIds: [...deletedMessageIds],
    deletedThreadIds: changedThreadIdsArray.filter((threadId, index) => !threads[index]),
    syncStatePatch: {
      syncCursor: currentCursor,
      lastDeltaSyncAt: new Date().toISOString(),
    },
  };
}

function getGraphSender(message) {
  const address = message?.from?.emailAddress || message?.sender?.emailAddress || {};
  return {
    name: address.name || address.address || "",
    email: (address.address || "").toLowerCase(),
  };
}

function normalizeMicrosoftRawMessage(account, message) {
  const accountEmail = account.email.toLowerCase();
  const sender = getGraphSender(message);
  const role = sender.email === accountEmail ? "outgoing" : "incoming";
  const createdAt = message.receivedDateTime || message.sentDateTime || new Date().toISOString();
  const content = message.body?.contentType === "html"
    ? stripHtml(message.body?.content || "")
    : normalizeWhitespace(message.body?.content || message.bodyPreview || "");

  return {
    externalThreadId: message.conversationId || message.id,
    externalMessageId: message.id,
    role,
    content,
    senderName: sender.name,
    senderEmail: sender.email,
    createdAt,
    messageSubject: message.subject || "",
    isRead: Boolean(message.isRead),
    internetMessageId: message.internetMessageId || "",
  };
}

function normalizeMicrosoftCalendarEvent(event) {
  const organizer = event.organizer?.emailAddress || {};
  const meetingUrl = event.onlineMeeting?.joinUrl
    || event.onlineMeetingUrl
    || extractMeetingUrl(event.bodyPreview)
    || extractMeetingUrl(event.location?.displayName)
    || "";

  return {
    externalEventId: event.id,
    calendarId: "primary",
    title: normalizeWhitespace(event.subject || "(senza titolo)"),
    organizerName: organizer.name || organizer.address || "",
    organizerEmail: (organizer.address || "").toLowerCase(),
    meetingUrl,
    joinProvider: detectMeetingProvider(meetingUrl),
    status: event.isCancelled ? "cancelled" : "confirmed",
    startAt: calendarDateTimeToIso(event.start?.dateTime || ""),
    endAt: calendarDateTimeToIso(event.end?.dateTime || ""),
    timezone: event.start?.timeZone || event.end?.timeZone || "",
    attendeeCount: Array.isArray(event.attendees) ? event.attendees.length : 0,
    isAllDay: event.isAllDay ? 1 : 0,
    location: normalizeWhitespace(
      event.location?.displayName
      || event.locations?.map((item) => item.displayName).filter(Boolean).join(", ")
      || "",
    ),
  };
}

async function fetchMicrosoftCalendarEvents(accessToken, options = {}) {
  const window = defaultCalendarWindow(options);
  let nextUrl = "";
  const events = [];

  do {
    const url = nextUrl
      ? new URL(nextUrl)
      : new URL("https://graph.microsoft.com/v1.0/me/calendar/calendarView");

    if (!nextUrl) {
      url.searchParams.set("startDateTime", window.timeMin);
      url.searchParams.set("endDateTime", window.timeMax);
      url.searchParams.set("$top", String(Math.min(window.maxResults, 200)));
      url.searchParams.set("$select", MICROSOFT_CALENDAR_FIELDS.join(","));
    }

    const payload = await providerRequest(url.toString(), accessToken, {
      headers: {
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    for (const event of payload.value || []) {
      if (!event?.id) {
        continue;
      }
      events.push(normalizeMicrosoftCalendarEvent(event));
      if (events.length >= window.maxResults) {
        break;
      }
    }

    nextUrl = events.length >= window.maxResults ? "" : (payload["@odata.nextLink"] || "");
  } while (nextUrl);

  return events;
}

function normalizeMicrosoftThread(account, conversationId, messages) {
  const normalizedMessages = [...messages]
    .map((message) => normalizeMicrosoftRawMessage(account, message))
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));

  const latestMessage = normalizedMessages.at(-1);
  const latestIncomingMessage = [...normalizedMessages].reverse().find((message) => message.role === "incoming") || latestMessage;
  const lastMessageAt = latestMessage?.createdAt || new Date().toISOString();

  return {
    externalThreadId: conversationId || latestMessage?.externalMessageId || "",
    subject: latestMessage?.messageSubject || "(senza oggetto)",
    fromName: latestIncomingMessage?.senderName || account.display_name || account.email,
    fromEmail: latestIncomingMessage?.senderEmail || account.email,
    snippet: normalizeWhitespace(latestMessage?.content || ""),
    category: latestMessage?.role === "incoming" ? "todo" : "fyi",
    status: latestMessage?.role === "incoming" && latestMessage?.isRead === false ? "nuovo" : "archiviata",
    lastMessageAt,
    needsReply: latestMessage?.role === "incoming" ? 1 : 0,
    messages: normalizedMessages,
  };
}

function buildMicrosoftDeltaUrl() {
  const url = new URL("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta");
  url.searchParams.set("$top", String(MESSAGE_LIMIT));
  url.searchParams.set("$select", MICROSOFT_MESSAGE_FIELDS.join(","));
  url.searchParams.set("$filter", `receivedDateTime ge ${new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()}`);
  url.searchParams.set("$orderby", "receivedDateTime DESC");
  return url.toString();
}

async function fetchMicrosoftDeltaChanges(accessToken, deltaLink = "") {
  let nextUrl = deltaLink || buildMicrosoftDeltaUrl();
  const changes = [];
  let latestDeltaLink = deltaLink;

  while (nextUrl) {
    const payload = await providerRequest(nextUrl, accessToken, {
      headers: {
        Prefer: 'outlook.body-content-type="text"',
      },
    });

    changes.push(...(payload.value || []));
    nextUrl = payload["@odata.nextLink"] || "";
    latestDeltaLink = payload["@odata.deltaLink"] || latestDeltaLink;
  }

  return {
    changes,
    deltaLink: latestDeltaLink,
  };
}

async function fetchMicrosoftInitialSync(accessToken, account) {
  const { changes, deltaLink } = await fetchMicrosoftDeltaChanges(accessToken);
  const grouped = new Map();

  for (const message of changes) {
    if (message.isDraft || message["@removed"]) {
      continue;
    }

    const key = message.conversationId || message.id;
    const bucket = grouped.get(key) || [];
    bucket.push(message);
    grouped.set(key, bucket);
  }

  const threads = [...grouped.entries()]
    .map(([conversationId, messages]) => normalizeMicrosoftThread(account, conversationId, messages))
    .sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt))
    .slice(0, THREAD_LIMIT);

  return {
    mode: "full",
    threads,
    deletedMessageIds: [],
    deletedThreadIds: [],
    upsertMessages: [],
    syncStatePatch: {
      deltaLink,
      lastDeltaSyncAt: new Date().toISOString(),
    },
  };
}

async function fetchMicrosoftDeltaSync(accessToken, account, deltaLink) {
  const { changes, deltaLink: nextDeltaLink } = await fetchMicrosoftDeltaChanges(accessToken, deltaLink);
  const upsertMessages = [];
  const deletedMessageIds = [];

  for (const message of changes) {
    if (message.isDraft) {
      continue;
    }

    if (message["@removed"]) {
      deletedMessageIds.push(message.id);
      continue;
    }

    upsertMessages.push(normalizeMicrosoftRawMessage(account, message));
  }

  return {
    mode: "delta",
    threads: [],
    upsertMessages,
    deletedMessageIds,
    deletedThreadIds: [],
    syncStatePatch: {
      deltaLink: nextDeltaLink,
      lastDeltaSyncAt: new Date().toISOString(),
    },
  };
}

function buildTokenUpdate(account, tokenPayload, currentRefreshToken) {
  return {
    encryptedAccessToken: encryptString(tokenPayload.access_token),
    encryptedRefreshToken: encryptString(tokenPayload.refresh_token || currentRefreshToken || ""),
    expiresAt: tokenPayload.expires_in
      ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString()
      : account.expires_at || "",
  };
}

function shouldRefreshToken(account) {
  if (!account.expires_at) {
    return false;
  }

  const expiresAt = new Date(account.expires_at);
  return Number.isFinite(expiresAt.valueOf()) && expiresAt.getTime() <= Date.now() + 60_000;
}

async function withProviderAccessToken(account, { onTokenRefresh } = {}, operation) {
  let accessToken = decryptString(account.encrypted_access_token);
  const refreshToken = decryptString(account.encrypted_refresh_token);

  if (!accessToken) {
    throw new ProviderAuthError(`Missing ${account.provider} access token`);
  }

  const refreshAccessToken = async () => {
    if (!refreshToken) {
      throw new ProviderAuthError(`Missing ${account.provider} refresh token`);
    }

    const refreshed = await refreshOAuthAccessToken(account.provider, refreshToken);
    const tokenUpdate = buildTokenUpdate(account, refreshed, refreshToken);
    accessToken = decryptString(tokenUpdate.encryptedAccessToken);

    if (onTokenRefresh) {
      await onTokenRefresh(tokenUpdate);
    }

    return accessToken;
  };

  if (shouldRefreshToken(account)) {
    await refreshAccessToken();
  }

  try {
    return await operation(accessToken);
  } catch (error) {
    if (!(error instanceof ProviderAuthError)) {
      throw error;
    }

    await refreshAccessToken();
    return operation(accessToken);
  }
}

function microsoftWebhookBaseUrl() {
  return process.env.MICROSOFT_WEBHOOK_BASE_URL || process.env.WEBHOOK_BASE_URL || process.env.APP_URL || "";
}

function isSubscriptionExpiring(expiresAt, renewWindowMs) {
  if (!expiresAt) {
    return true;
  }

  const date = new Date(expiresAt);
  if (!Number.isFinite(date.valueOf())) {
    return true;
  }

  return date.getTime() <= Date.now() + renewWindowMs;
}

async function ensureGoogleWatch(accessToken, account, existingSubscription) {
  const topicName = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!topicName) {
    return null;
  }

  if (existingSubscription?.provider === "google" && !isSubscriptionExpiring(existingSubscription.expiration_at, GOOGLE_WATCH_RENEW_WINDOW_MS)) {
    return null;
  }

  const payload = await providerRequest("https://gmail.googleapis.com/gmail/v1/users/me/watch", accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topicName,
      labelIds: ["INBOX"],
    }),
  });

  return {
    externalId: payload.historyId ? `google-watch:${payload.historyId}` : `google-watch:${account.id}`,
    resource: "gmail.users.watch",
    clientState: existingSubscription?.client_state || "",
    notificationUrl: topicName,
    expirationAt: payload.expiration ? new Date(Number(payload.expiration)).toISOString() : "",
    status: "active",
    syncCursor: String(payload.historyId || ""),
  };
}

async function createOrRenewMicrosoftSubscription(accessToken, existingSubscription) {
  const baseUrl = microsoftWebhookBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const notificationUrl = `${baseUrl.replace(/\/$/, "")}/api/webhooks/microsoft`;
  const expirationAt = new Date(Date.now() + 1000 * 60 * 50).toISOString();
  const clientState = existingSubscription?.client_state || randomUUID();

  if (existingSubscription?.external_subscription_id && !isSubscriptionExpiring(existingSubscription.expiration_at, MICROSOFT_SUBSCRIPTION_RENEW_WINDOW_MS)) {
    return null;
  }

  if (existingSubscription?.external_subscription_id) {
    try {
      const renewed = await providerRequest(
        `https://graph.microsoft.com/v1.0/subscriptions/${encodeURIComponent(existingSubscription.external_subscription_id)}`,
        accessToken,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expirationDateTime: expirationAt,
          }),
        },
      );

      return {
        externalId: renewed.id || existingSubscription.external_subscription_id,
        resource: renewed.resource || existingSubscription.resource || "me/mailFolders('inbox')/messages",
        clientState,
        notificationUrl,
        expirationAt: renewed.expirationDateTime || expirationAt,
        status: "active",
      };
    } catch {
      // Fall through to full re-create if remote renewal failed.
    }
  }

  const created = await providerRequest("https://graph.microsoft.com/v1.0/subscriptions", accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      changeType: "created,updated,deleted",
      notificationUrl,
      resource: "me/mailFolders('inbox')/messages",
      expirationDateTime: expirationAt,
      clientState,
      latestSupportedTlsVersion: "v1_2",
    }),
  });

  return {
    externalId: created.id,
    resource: created.resource || "me/mailFolders('inbox')/messages",
    clientState,
    notificationUrl,
    expirationAt: created.expirationDateTime || expirationAt,
    status: "active",
  };
}

export async function fetchMailboxRemoteState(account, syncState = null, { onTokenRefresh } = {}) {
  return withProviderAccessToken(account, { onTokenRefresh }, async (accessToken) => {
    if (account.provider === "google") {
      if (!syncState?.sync_cursor) {
        return fetchGoogleFullSync(accessToken, account);
      }

      return fetchGoogleDeltaSync(accessToken, account, syncState.sync_cursor);
    }

    if (account.provider === "microsoft") {
      if (!syncState?.delta_link) {
        return fetchMicrosoftInitialSync(accessToken, account);
      }

      return fetchMicrosoftDeltaSync(accessToken, account, syncState.delta_link);
    }

    throw new Error(`Unsupported provider sync: ${account.provider}`);
  });
}

export async function ensureMailboxSubscription(account, existingSubscription = null, { onTokenRefresh } = {}) {
  return withProviderAccessToken(account, { onTokenRefresh }, async (accessToken) => {
    if (account.provider === "google") {
      return ensureGoogleWatch(accessToken, account, existingSubscription);
    }

    if (account.provider === "microsoft") {
      return createOrRenewMicrosoftSubscription(accessToken, existingSubscription);
    }

    return null;
  });
}

export async function fetchCalendarRemoteState(account, options = {}, { onTokenRefresh } = {}) {
  return withProviderAccessToken(account, { onTokenRefresh }, async (accessToken) => {
    if (account.provider === "google") {
      return fetchGoogleCalendarEvents(accessToken, options);
    }

    if (account.provider === "microsoft") {
      return fetchMicrosoftCalendarEvents(accessToken, options);
    }

    throw new Error(`Unsupported provider calendar sync: ${account.provider}`);
  });
}

async function upsertGoogleDraft(accessToken, account, payload) {
  const mime = buildPlainTextMimeMessage({
    fromEmail: account.email,
    toEmail: payload.toEmail,
    subject: payload.subject,
    content: payload.content,
    inReplyTo: payload.replyToInternetMessageId,
    references: payload.replyToInternetMessageId,
  });

  const body = {
    message: {
      raw: encodeBase64Url(mime),
    },
  };

  if (payload.threadExternalId) {
    body.message.threadId = payload.threadExternalId;
  }

  const headers = { "Content-Type": "application/json" };
  const response = payload.providerDraftId
    ? await providerRequest(
      `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(payload.providerDraftId)}`,
      accessToken,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          id: payload.providerDraftId,
          ...body,
        }),
      },
    )
    : await providerRequest("https://gmail.googleapis.com/gmail/v1/users/me/drafts", accessToken, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

  return {
    providerDraftId: response.id || payload.providerDraftId || "",
    providerMessageId: response.message?.id || payload.providerMessageId || "",
    pushedAt: new Date().toISOString(),
  };
}

async function deleteGoogleDraft(accessToken, providerDraftId) {
  if (!providerDraftId) {
    return { deleted: false };
  }

  await maybeProviderRequest(
    `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(providerDraftId)}`,
    accessToken,
    {
      method: "DELETE",
    },
  );

  return { deleted: true };
}

async function updateMicrosoftDraft(accessToken, draftMessageId, payload) {
  const response = await providerRequest(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(draftMessageId)}`,
    accessToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: payload.subject,
        body: {
          contentType: "Text",
          content: payload.content,
        },
      }),
    },
  );

  return {
    providerDraftId: response?.id || draftMessageId,
    providerMessageId: response?.id || draftMessageId,
    pushedAt: new Date().toISOString(),
  };
}

async function upsertMicrosoftDraft(accessToken, payload) {
  if (payload.providerMessageId) {
    return updateMicrosoftDraft(accessToken, payload.providerMessageId, payload);
  }

  if (!payload.replyToExternalMessageId) {
    throw new Error("Missing Microsoft reply target message id");
  }

  const createdReply = await providerRequest(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(payload.replyToExternalMessageId)}/createReply`,
    accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: "",
      }),
    },
  );

  return updateMicrosoftDraft(accessToken, createdReply.id, payload);
}

async function deleteMicrosoftDraft(accessToken, providerMessageId) {
  if (!providerMessageId) {
    return { deleted: false };
  }

  await maybeProviderRequest(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(providerMessageId)}`,
    accessToken,
    {
      method: "DELETE",
    },
  );

  return { deleted: true };
}

export async function upsertProviderDraft(account, payload, { onTokenRefresh } = {}) {
  return withProviderAccessToken(account, { onTokenRefresh }, async (accessToken) => {
    if (account.provider === "google") {
      return upsertGoogleDraft(accessToken, account, payload);
    }

    if (account.provider === "microsoft") {
      return upsertMicrosoftDraft(accessToken, payload);
    }

    throw new Error(`Unsupported provider draft writeback: ${account.provider}`);
  });
}

export async function deleteProviderDraft(account, payload, { onTokenRefresh } = {}) {
  return withProviderAccessToken(account, { onTokenRefresh }, async (accessToken) => {
    if (account.provider === "google") {
      return deleteGoogleDraft(accessToken, payload.providerDraftId || "");
    }

    if (account.provider === "microsoft") {
      return deleteMicrosoftDraft(accessToken, payload.providerMessageId || payload.providerDraftId || "");
    }

    throw new Error(`Unsupported provider draft delete: ${account.provider}`);
  });
}
