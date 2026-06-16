import {
  getValidated,
  http,
  postValidated,
} from "../lib/api-client";
import {
  bootstrapResponseSchema,
  loginResponseSchema,
  meResponseSchema,
  type Actor,
  type BootstrapResponse,
  type LoginResponse,
} from "./schemas";

export function login(email: string, password: string): Promise<LoginResponse> {
  return postValidated("/auth/login", { email, password }, loginResponseSchema);
}

export async function fetchMe(): Promise<Actor> {
  const res = await getValidated("/auth/me", meResponseSchema);
  return res.actor;
}

export async function logout(): Promise<void> {
  await http.post("/auth/logout");
}

export type BootstrapInput = {
  companyName: string;
  jurisdiction?: string;
  currency?: string;
  adminEmail: string;
  adminPassword: string;
};

export function bootstrap(input: BootstrapInput): Promise<BootstrapResponse> {
  return postValidated("/auth/bootstrap", input, bootstrapResponseSchema);
}

/**
 * POST /auth/activate {token,password}. This route was added on
 * feat/hr-backend-prereqs and may 404 until that branch merges — the UI
 * surfaces a clear message in that case.
 */
export async function activate(token: string, password: string): Promise<void> {
  await http.post("/auth/activate", { token, password });
}
