import { API_URL, API_ORIGIN } from "./config";
import { timeoutSignal } from "./http";

export { API_URL };

const LEGACY_TOKEN_KEY = "jh_admin_token";
const USER_KEY = "jh_admin_user";
const AUTH_EXPIRED_EVENT = "jh-admin-auth-expired";

export type AuthUser = { id: string; name: string; email?: string; role: string };
let accessToken = "";
let refreshInFlight: Promise<string | null> | null = null;

export function getStoredToken() {
  return accessToken;
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    clearSession();
    return null;
  }
}

// The refresh token now lives in an HttpOnly cookie the browser sends automatically, so only the
// short-lived access token and the user profile are kept client-side.
export function storeSession(user: AuthUser, accessToken: string) {
  setAccessToken(accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function setAccessToken(token: string) {
  accessToken = token;
  if (typeof window !== "undefined") localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function clearSession() {
  setAccessToken("");
  localStorage.removeItem(USER_KEY);
}

export function onAuthExpired(handler: () => void) {
  window.addEventListener(AUTH_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
}

function announceAuthExpired() {
  clearSession();
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

async function rawRequest(path: string, options: RequestInit, token: string) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    signal: options.signal ?? timeoutSignal(20_000),
    // Send the HttpOnly refresh cookie on auth calls; harmless (path-scoped) on others.
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
}

async function performRefresh(): Promise<string | null> {
  const user = getStoredUser();
  if (!user) return null;
  try {
    // No body: the refresh token rides along as an HttpOnly cookie.
    const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include", signal: timeoutSignal(15_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string };
    storeSession(user, data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

function tryRefresh(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function restoreSession(): Promise<AuthUser | null> {
  const user = getStoredUser();
  if (!user) return null;
  const token = await tryRefresh();
  if (!token) {
    clearSession();
    return null;
  }
  return user;
}

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = getStoredToken();
  let res = await rawRequest(path, options, token);

  if (res.status === 401 && path !== "/auth/login") {
    const refreshed = await tryRefresh();
    if (refreshed) {
      token = refreshed;
      res = await rawRequest(path, options, token);
    } else {
      announceAuthExpired();
      throw new AdminApiError("Sessiya muddati tugadi, qaytadan kiring", 401);
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AdminApiError(data.message ?? "So'rov bajarilmadi", res.status);
  return data as T;
}

export async function uploadAdminMedia(file: File): Promise<{ url: string; mimeType: string; size: number }> {
  let token = getStoredToken();
  const createForm = () => {
    const form = new FormData();
    form.append("file", file);
    return form;
  };
  let res = await fetch(`${API_URL}/admin/media/upload`, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: createForm(),
    signal: timeoutSignal(120_000)
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      token = refreshed;
      res = await fetch(`${API_URL}/admin/media/upload`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
        body: createForm(),
        signal: timeoutSignal(120_000)
      });
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AdminApiError(data.message ?? "Fayl yuklanmadi", res.status);
  if (data.url && !data.url.startsWith("http")) {
    data.url = `${API_ORIGIN}${data.url}`;
  }
  return data;
}

export async function login(email: string, password: string) {
  const data = await adminRequest<{ user: AuthUser; accessToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  storeSession(data.user, data.accessToken);
  return data.user;
}

export async function logout() {
  clearSession();
  try {
    // The HttpOnly cookie is sent automatically; the server revokes it and clears the cookie.
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include", signal: timeoutSignal(10_000) });
  } catch {
    // best-effort server-side revocation; local session is already cleared
  }
}
