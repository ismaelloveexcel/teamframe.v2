// Client-side bearer-token storage. The HR v2 backend is token-based (NOT
// cookies); we store the session token in localStorage and attach it as
// `Authorization: Bearer <token>` on every request via the axios interceptor.
const TOKEN_KEY = "hrweb.token";

let inMemoryToken: string | null = null;

export function getToken(): string | null {
  if (inMemoryToken !== null) return inMemoryToken;
  try {
    inMemoryToken = localStorage.getItem(TOKEN_KEY);
  } catch {
    inMemoryToken = null;
  }
  return inMemoryToken;
}

export function setToken(token: string | null): void {
  inMemoryToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — fall back to in-memory only */
  }
}

export function clearToken(): void {
  setToken(null);
}
