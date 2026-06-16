import axios, { AxiosError, type AxiosInstance } from "axios";
import { z, type ZodType } from "zod";
import { clearToken, getToken } from "./token";

// Base URL is configurable. Default points at the local api-server; in dev the
// Vite proxy forwards /api -> backend, so a relative "/api" also works.
const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8080/api";

export const apiBaseUrl = BASE_URL;

export const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach the bearer token on every request. NEVER send x-user-id/x-user-email —
// the backend's legacy header-trust path must not be used.
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Normalized API error surfaced to the UI. */
export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// 401 handler hook — set by the auth provider so an expired/invalid session
// boots the user back to /login without a hard page reload loop.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ message?: string; details?: unknown }>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    const message =
      body?.message ||
      error.message ||
      "Request failed. Please try again.";

    if (status === 401) {
      // Token rejected — drop it and let the app redirect to login.
      clearToken();
      onUnauthorized?.();
    }

    return Promise.reject(new ApiError(message, status, body?.details));
  },
);

export type ListParams = {
  limit?: number;
  offset?: number;
  [key: string]: unknown;
};

/**
 * GET that validates the response at the API boundary with Zod. List endpoints
 * currently return plain arrays, but we tolerate a `{ data, total }` envelope
 * too so this upgrades cleanly when the backend adds server-side pagination.
 */
export async function getValidated<T>(
  url: string,
  schema: ZodType<T>,
  params?: Record<string, unknown>,
): Promise<T> {
  const res = await http.get(url, { params });
  return parse(schema, res.data, url);
}

export type Paginated<T> = { data: T[]; total: number | null };

/** GET a list endpoint, normalizing array | { data, total } shapes. */
export async function getList<T>(
  url: string,
  itemSchema: ZodType<T>,
  params?: ListParams,
): Promise<Paginated<T>> {
  const res = await http.get(url, { params });
  const raw = res.data;
  if (Array.isArray(raw)) {
    return { data: z.array(itemSchema).parse(raw), total: null };
  }
  if (raw && typeof raw === "object" && Array.isArray(raw.data)) {
    return {
      data: z.array(itemSchema).parse(raw.data),
      total: typeof raw.total === "number" ? raw.total : null,
    };
  }
  throw new ApiError(`Unexpected list response shape from ${url}`, 0, raw);
}

export async function postValidated<T>(
  url: string,
  body: unknown,
  schema: ZodType<T>,
): Promise<T> {
  const res = await http.post(url, body);
  return parse(schema, res.data, url);
}

export async function patchValidated<T>(
  url: string,
  body: unknown,
  schema: ZodType<T>,
): Promise<T> {
  const res = await http.patch(url, body);
  return parse(schema, res.data, url);
}

export async function putValidated<T>(
  url: string,
  body: unknown,
  schema: ZodType<T>,
): Promise<T> {
  const res = await http.put(url, body);
  return parse(schema, res.data, url);
}

export async function del(url: string): Promise<void> {
  await http.delete(url);
}

function parse<T>(schema: ZodType<T>, data: unknown, url: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Surface a clear boundary error rather than letting bad data leak into
    // the UI; include the Zod issues as details for debugging.
    throw new ApiError(
      `Response from ${url} did not match the expected schema`,
      0,
      result.error.issues,
    );
  }
  return result.data;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
