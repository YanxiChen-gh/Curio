const API_BASE = "";

function getToken(): string | null {
  return localStorage.getItem("curio_token");
}

export function setToken(token: string) {
  localStorage.setItem("curio_token", token);
}

export function clearToken() {
  localStorage.removeItem("curio_token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function login(email: string, password: string) {
  const data = await api<{
    token: string;
    user: { id: string; email: string; name: string };
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data.user;
}

export async function register(
  email: string,
  password: string,
  name?: string,
) {
  const data = await api<{
    token: string;
    user: { id: string; email: string; name: string };
  }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
  setToken(data.token);
  return data.user;
}

export async function getMe() {
  const data = await api<{
    user: { id: string; email: string; name: string };
  }>("/api/auth/me");
  return data.user;
}
