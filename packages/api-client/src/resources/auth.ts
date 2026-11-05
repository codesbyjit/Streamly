import type { ApiClient } from "../client.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  username: string;
  displayName: string;
}

export function createAuthResource(client: ApiClient) {
  return {
    register: (input: RegisterInput) =>
      client.post<AuthTokens>("/api/v1/auth/register", input, { auth: false }),

    login: (input: LoginInput) =>
      client.post<AuthTokens>("/api/v1/auth/login", input, { auth: false }),

    refresh: (refreshToken: string) =>
      client.post<AuthTokens>(
        "/api/v1/auth/refresh",
        { refreshToken },
        { auth: false },
      ),

    logout: () => client.post<void>("/api/v1/auth/logout"),

    me: <T = unknown>() => client.get<T>("/api/v1/auth/me"),
  };
}
