const DEV_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === "true";

let clerkGetToken: (() => Promise<string | null>) | null = null;

export function setClerkGetToken(fn: () => Promise<string | null>) {
  clerkGetToken = fn;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (DEV_BYPASS) return {};
  if (clerkGetToken) {
    const token = await clerkGetToken();
    if (token) return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...opts.headers,
    },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}
