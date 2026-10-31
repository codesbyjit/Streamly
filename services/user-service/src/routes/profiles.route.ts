import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import {
  createProfileSchema,
  updatePreferencesSchema,
  updateProfileSchema
} from "../schemas/profile.js";

const paramsSchema = z.object({ userId: z.string().uuid() });

function currentUserId(request: FastifyRequest): string {
  return request.headers["x-user-id"] as string;
}

function requireInternal(request: FastifyRequest, reply: { code: (status: number) => { send: (body: unknown) => unknown } }): boolean {
  const key = request.headers["x-internal-api-key"];
  if (typeof key !== "string" || key !== config.INTERNAL_API_KEY) {
    void reply.code(401).send({ error: "unauthorized", message: "Invalid internal service credentials" });
    return false;
  }
  const userId = request.headers["x-user-id"];
  if (typeof userId !== "string" || !z.string().uuid().safeParse(userId).success) {
    void reply.code(401).send({ error: "unauthorized", message: "Missing or invalid authenticated user identity" });
    return false;
  }
  return true;
}

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.get("/:userId", async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: "invalid_params", details: parsedParams.error.flatten() });
    }

    const result = await pool.query(
      `SELECT user_id AS "userId", handle, display_name AS "displayName",
              bio, avatar_url AS "avatarUrl", banner_url AS "bannerUrl",
              country_code AS "countryCode", created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM user_service.profiles WHERE user_id = $1`,
      [parsedParams.data.userId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "profile_not_found" });
    return result.rows[0];
  });

  // Called by the authenticated API gateway. Never expose this service directly to untrusted clients.
  app.post("/profiles", async (request, reply) => {
    if (!requireInternal(request, reply)) return;
    const parsed = createProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }
    const body = parsed.data;
    if (body.userId !== currentUserId(request)) {
      return reply.code(403).send({ error: "forbidden", message: "Cannot create a profile for another user" });
    }

    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const inserted = await client.query(
          `INSERT INTO user_service.profiles
            (user_id, handle, display_name, bio, avatar_url, banner_url, country_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING user_id AS "userId", handle, display_name AS "displayName",
             bio, avatar_url AS "avatarUrl", banner_url AS "bannerUrl",
             country_code AS "countryCode", created_at AS "createdAt", updated_at AS "updatedAt"`,
          [body.userId, body.handle, body.displayName, body.bio, body.avatarUrl, body.bannerUrl, body.countryCode ?? null]
        );
        await client.query(
          "INSERT INTO user_service.preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
          [body.userId]
        );
        await client.query("COMMIT");
        return reply.code(201).send(inserted.rows[0]);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ error: "handle_or_profile_exists" });
      }
      request.log.error({ err: error }, "Failed to create profile");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  app.get("/me/profile", async (request, reply) => {
    if (!requireInternal(request, reply)) return;
    const result = await pool.query(
      `SELECT user_id AS "userId", handle, display_name AS "displayName",
              bio, avatar_url AS "avatarUrl", banner_url AS "bannerUrl",
              country_code AS "countryCode", created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM user_service.profiles WHERE user_id = $1`,
      [currentUserId(request)]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "profile_not_found" });
    return result.rows[0];
  });

  app.put("/me/profile", async (request, reply) => {
    if (!requireInternal(request, reply)) return;
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }

    const fields: Record<string, string> = {
      handle: "handle",
      displayName: "display_name",
      bio: "bio",
      avatarUrl: "avatar_url",
      bannerUrl: "banner_url",
      countryCode: "country_code"
    };
    const entries = Object.entries(parsed.data);
    const values: unknown[] = [currentUserId(request)];
    const assignments = entries.map(([key, value], index) => {
      values.push(value);
      return `${fields[key]} = $${index + 2}`;
    });
    assignments.push("updated_at = now()");

    try {
      const result = await pool.query(
        `UPDATE user_service.profiles SET ${assignments.join(", ")}
         WHERE user_id = $1
         RETURNING user_id AS "userId", handle, display_name AS "displayName",
           bio, avatar_url AS "avatarUrl", banner_url AS "bannerUrl",
           country_code AS "countryCode", created_at AS "createdAt", updated_at AS "updatedAt"`,
        values
      );
      if (!result.rowCount) return reply.code(404).send({ error: "profile_not_found" });
      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: "handle_already_taken" });
      request.log.error({ err: error }, "Failed to update profile");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  app.get("/me/preferences", async (request, reply) => {
    if (!requireInternal(request, reply)) return;
    const result = await pool.query(
      `SELECT user_id AS "userId", language, theme, autoplay,
              email_notifications AS "emailNotifications", updated_at AS "updatedAt"
       FROM user_service.preferences WHERE user_id = $1`,
      [currentUserId(request)]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "profile_not_found" });
    return result.rows[0];
  });

  app.put("/me/preferences", async (request, reply) => {
    if (!requireInternal(request, reply)) return;
    const parsed = updatePreferencesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }

    const mapping: Record<string, string> = {
      language: "language",
      theme: "theme",
      autoplay: "autoplay",
      emailNotifications: "email_notifications"
    };
    const entries = Object.entries(parsed.data);
    const values: unknown[] = [currentUserId(request)];
    const assignments = entries.map(([key, value], index) => {
      values.push(value);
      return `${mapping[key]} = $${index + 2}`;
    });
    assignments.push("updated_at = now()");

    const result = await pool.query(
      `UPDATE user_service.preferences SET ${assignments.join(", ")}
       WHERE user_id = $1
       RETURNING user_id AS "userId", language, theme, autoplay,
         email_notifications AS "emailNotifications", updated_at AS "updatedAt"`,
      values
    );
    if (!result.rowCount) return reply.code(404).send({ error: "profile_not_found" });
    return result.rows[0];
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
