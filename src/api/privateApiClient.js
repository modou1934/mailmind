const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const CSRF_COOKIE = "mailmind_csrf";

/**
 * @typedef {Object} RequestOptions
 * @property {string=} method
 * @property {unknown=} body
 * @property {Record<string, string>=} headers
 */

function readCookie(name) {
  if (typeof document === "undefined") {
    return "";
  }

  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
}

/** @param {string} path @param {RequestOptions=} options */
async function request(path, { method = "GET", body, headers } = {}) {
  const csrfToken = method !== "GET" ? readCookie(CSRF_COOKIE) : "";
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const message = payload?.error || `Request failed with status ${response.status}`;
    /** @type {Error & { status?: number, data?: unknown }} */
    const error = new Error(message);
    error.status = response.status;
    error.data = payload;
    throw error;
  }

  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};

export const privateApi = {
  auth: {
    me: async () => {
      const payload = await request("/auth/me");
      return payload.user;
    },
    logout: async (redirectTo) => {
      await request("/auth/logout", { method: "POST" });
      if (redirectTo) {
        window.location.href = redirectTo;
      }
    },
    redirectToLogin: (redirectTo) => {
      window.location.href = redirectTo || "/";
    },
  },
};
