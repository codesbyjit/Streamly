import type { FastifyPluginAsync } from "fastify";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "../db.js";
import { config } from "../config.js";
import { createRefreshToken, hashRefreshToken, normalizeEmail } from "../security.js";
import { requireAuth } from "../auth.js";
import type { PublicUser, UserRole } from "../types.js";

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(80)
}).strict();

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128)
}).strict();

const refreshSchema = z.object({ refreshToken: z.string().min(40).max(200) }).strict();

function publicUser(row: {
  id: string; email: string; display_name: string; role: UserRole;
  email_verified_at: Date | null; created_at: Date;
}): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    emailVerifiedAt: row.email_verified_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString()
  };
}

async function issueSession(
  app: Parameters<FastifyPluginAsync>[0],
  user: { id: string; email: string; role: UserRole },
  request: Parameters<FastifyPluginAsync>[0]["log"] extends never ? never : any
) {
  const accessToken = app.jwt.sign({
    sub: user.id,
    email: user.email,
    role: user.role
  });

  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86400_000);

  await db.query(
    `INSERT INTO refresh_sessions (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      user.id,
      hashRefreshToken(refreshToken),
      expiresAt,
      typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"].slice(0, 500) : null,
      request.ip
    ]
  );

  return { accessToken, refreshToken, expiresIn: config.JWT_ACCESS_TTL };
}

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const email = normalizeEmail(parsed.data.email);
    const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });

    try {
      const result = await db.query(
        `INSERT INTO users (email, password_hash, display_name)
         VALUES ($1, $2, $3)
         RETURNING id, email, display_name, role, email_verified_at, created_at`,
        [email, passwordHash, parsed.data.displayName]
      );
      const row = result.rows[0];
      const session = await issueSession(app, { id: row.id, email: row.email, role: row.role }, request);
      return reply.code(201).send({ user: publicUser(row), ...session });
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        return reply.code(409).send({ error: "EMAIL_ALREADY_EXISTS", message: "An account with this email already exists" });
      }
      request.log.error(error);
      return reply.code(500).send({ error: "INTERNAL_ERROR" });
    }
  });

  app.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const email = normalizeEmail(parsed.data.email);
    const result = await db.query(
      `SELECT id, email, password_hash, display_name, role, status, email_verified_at, created_at
       FROM users WHERE email = $1`,
      [email]
    );
    const row = result.rows[0];
    const valid = row ? await argon2.verify(row.password_hash, parsed.data.password).catch(() => false) : false;

    if (!row || !valid || row.status !== "active") {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS", message: "Email or password is incorrect" });
    }

    const session = await issueSession(app, { id: row.id, email: row.email, role: row.role }, request);
    return { user: publicUser(row), ...session };
  });

  app.post("/refresh", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const tokenHash = hashRefreshToken(parsed.data.refreshToken);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT rs.id AS session_id, rs.user_id, rs.expires_at, rs.revoked_at,
                u.email, u.role, u.status
         FROM refresh_sessions rs
         JOIN users u ON u.id = rs.user_id
         WHERE rs.token_hash = $1
         FOR UPDATE OF rs`,
        [tokenHash]
      );
      const row = result.rows[0];

      if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now() || row.status !== "active") {
        await client.query("ROLLBACK");
        return reply.code(401).send({ error: "INVALID_REFRESH_TOKEN" });
      }

      const nextRefreshToken = createRefreshToken();
      const nextExpiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86400_000);
      const inserted = await client.query(
        `INSERT INTO refresh_sessions (user_id, token_hash, expires_at, user_agent, ip_address)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          row.user_id, hashRefreshToken(nextRefreshToken), nextExpiresAt,
          request.headers["user-agent"]?.toString().slice(0, 500) ?? null, request.ip
        ]
      );
      await client.query(
        `UPDATE refresh_sessions SET revoked_at = NOW(), replaced_by_session_id = $2 WHERE id = $1`,
        [row.session_id, inserted.rows[0].id]
      );
      await client.query("COMMIT");

      const accessToken = app.jwt.sign({ sub: row.user_id, email: row.email, role: row.role });
      return { accessToken, refreshToken: nextRefreshToken, expiresIn: config.JWT_ACCESS_TTL };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      request.log.error(error);
      return reply.code(500).send({ error: "INTERNAL_ERROR" });
    } finally {
      client.release();
    }
  });

  app.post("/logout", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }
    await db.query(
      `UPDATE refresh_sessions SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashRefreshToken(parsed.data.refreshToken)]
    );
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: requireAuth }, async (request, reply) => {
    const result = await db.query(
      `SELECT id, email, display_name, role, email_verified_at, created_at, status
       FROM users WHERE id = $1`,
      [request.user.sub]
    );
    const row = result.rows[0];
    if (!row || row.status !== "active") {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
    return { user: publicUser(row) };
  });
};

export default authRoutes;
