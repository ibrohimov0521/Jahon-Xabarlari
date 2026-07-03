export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://backend-production-8124.up.railway.app/api";

const TOKEN_KEY = "jh_admin_token";
const REFRESH_KEY = "jh_admin_refresh";
const USER_KEY = "jh_admin_user";
const AUTH_EXPIRED_EVENT = "jh-admin-auth-expired";

export type AuthUser = { id: string; name: string; email?: string; role: string };

export function getStoredToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function getStoredRefreshToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(REFRESH_KEY) ?? "";
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function storeSession(user: AuthUser, accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
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
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  const user = getStoredUser();
  if (!refreshToken || !user) return null;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    storeSession(user, data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
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

export async function login(email: string, password: string) {
  const data = await adminRequest<{ user: AuthUser; accessToken: string; refreshToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  storeSession(data.user, data.accessToken, data.refreshToken);
  return data.user;
}

export async function logout() {
  const refreshToken = getStoredRefreshToken();
  clearSession();
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
  } catch {
    // best-effort server-side revocation; local session is already cleared
  }
}
