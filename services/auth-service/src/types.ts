export type UserRole = "user" | "admin";

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
