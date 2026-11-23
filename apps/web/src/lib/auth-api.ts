import {
  authSessionResponseSchema,
  loginSchema,
  type AuthSessionResponse,
  type LoginInput,
} from "@plexsol/shared";
import { apiFetch } from "./api";

export async function loginRequest(
  input: LoginInput,
): Promise<AuthSessionResponse> {
  const payload = loginSchema.parse(input);
  const data = await apiFetch<unknown>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return authSessionResponseSchema.parse(data);
}

export async function logoutRequest(): Promise<void> {
  await apiFetch<void>("/api/auth/logout", { method: "POST" });
}

export async function fetchCurrentSession(): Promise<AuthSessionResponse> {
  const data = await apiFetch<unknown>("/api/auth/me");
  return authSessionResponseSchema.parse(data);
}
