import { randomUUID } from "node:crypto";
import { pool } from "./db/pool.js";
import { env } from "./config.js";
import type { CreateNotificationInput, NotificationRecord } from "./types.js";

const table = `"${env.DATABASE_SCHEMA}".notifications`;
const preferencesTable = `"${env.DATABASE_SCHEMA}".notification_preferences`;
const outboxTable = `"${env.DATABASE_SCHEMA}".notification_outbox`;

export async function createNotification(input: CreateNotificationInput): Promise<NotificationRecord> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pref = await client.query(
      `SELECT in_app_enabled, email_enabled FROM ${preferencesTable} WHERE user_id = $1`,
      [input.recipientId]
    );
    const inAppEnabled = pref.rowCount === 0 ? true : pref.rows[0].in_app_enabled as boolean;
    const emailEnabled = pref.rowCount === 0 ? false : pref.rows[0].email_enabled as boolean;

    if (!inAppEnabled) {
      await client.query("COMMIT");
      // Keep a stable result shape without creating an in-app record.
      return {
        id: randomUUID(),
        recipient_id: input.recipientId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        source_event_id: input.sourceEventId ?? null,
        read_at: null,
        created_at: new Date().toISOString()
      };
    }

    const inserted = await client.query<NotificationRecord>(
      `INSERT INTO ${table}
        (recipient_id, type, title, body, data, source_event_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (source_event_id) DO NOTHING
       RETURNING id, recipient_id, type, title, body, data, source_event_id, read_at, created_at`,
      [input.recipientId, input.type, input.title, input.body, JSON.stringify(input.data ?? {}), input.sourceEventId ?? null]
    );

    if (inserted.rows[0]) {
      if (emailEnabled) {
        const email = input.data?.email;
        if (typeof email === "string" && email.includes("@")) {
          await client.query(
            `INSERT INTO ${outboxTable} (notification_id, channel, recipient, subject, body)
             VALUES ($1, 'email', $2, $3, $4)
             ON CONFLICT (notification_id, channel) DO NOTHING`,
            [inserted.rows[0].id, email, input.title, input.body]
          );
        }
      }
      await client.query("COMMIT");
      return inserted.rows[0];
    }

    const existing = input.sourceEventId
      ? await client.query<NotificationRecord>(
          `SELECT id, recipient_id, type, title, body, data, source_event_id, read_at, created_at
           FROM ${table} WHERE source_event_id = $1 AND recipient_id = $2`,
          [input.sourceEventId, input.recipientId]
        )
      : { rows: [] as NotificationRecord[] };
    await client.query("COMMIT");
    if (existing.rows[0]) return existing.rows[0];

    // Conflict can be caused by another recipient using the same event id.
    throw new Error("Notification event was already processed");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listNotifications(
  recipientId: string,
  limit: number,
  cursor?: string,
  unreadOnly = false
) {
  const params: unknown[] = [recipientId];
  let where = "recipient_id = $1";
  if (unreadOnly) where += " AND read_at IS NULL";
  if (cursor) {
    params.push(cursor);
    where += ` AND (created_at, id) < (SELECT created_at, id FROM ${table} WHERE id = $${params.length} AND recipient_id = $1)`;
  }
  params.push(limit + 1);
  const result = await pool.query<NotificationRecord>(
    `SELECT id, recipient_id, type, title, body, data, source_event_id, read_at, created_at
     FROM ${table} WHERE ${where}
     ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
    params
  );
  const hasMore = result.rows.length > limit;
  const items = hasMore ? result.rows.slice(0, limit) : result.rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null };
}

export async function countUnread(recipientId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ${table} WHERE recipient_id = $1 AND read_at IS NULL`,
    [recipientId]
  );
  return result.rows[0].count as number;
}

export async function markRead(recipientId: string, id: string) {
  const result = await pool.query<NotificationRecord>(
    `UPDATE ${table} SET read_at = COALESCE(read_at, NOW())
     WHERE id = $1 AND recipient_id = $2
     RETURNING id, recipient_id, type, title, body, data, source_event_id, read_at, created_at`,
    [id, recipientId]
  );
  return result.rows[0] ?? null;
}

export async function markAllRead(recipientId: string) {
  const result = await pool.query(
    `UPDATE ${table} SET read_at = NOW()
     WHERE recipient_id = $1 AND read_at IS NULL`,
    [recipientId]
  );
  return result.rowCount ?? 0;
}

export async function deleteNotification(recipientId: string, id: string) {
  const result = await pool.query(`DELETE FROM ${table} WHERE id = $1 AND recipient_id = $2`, [id, recipientId]);
  return (result.rowCount ?? 0) > 0;
}

export async function getPreferences(userId: string) {
  const result = await pool.query(
    `SELECT user_id, in_app_enabled, email_enabled, updated_at FROM ${preferencesTable} WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] ?? { user_id: userId, in_app_enabled: true, email_enabled: false, updated_at: null };
}

export async function updatePreferences(userId: string, inAppEnabled: boolean, emailEnabled: boolean) {
  const result = await pool.query(
    `INSERT INTO ${preferencesTable} (user_id, in_app_enabled, email_enabled)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       in_app_enabled = EXCLUDED.in_app_enabled,
       email_enabled = EXCLUDED.email_enabled,
       updated_at = NOW()
     RETURNING user_id, in_app_enabled, email_enabled, updated_at`,
    [userId, inAppEnabled, emailEnabled]
  );
  return result.rows[0];
}
