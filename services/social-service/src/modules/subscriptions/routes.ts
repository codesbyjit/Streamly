import type { FastifyInstance } from 'fastify';
import { pool } from '../../db/pool.js';
import { publishEvent } from '../../events/publisher.js';
import { requireIdentity } from '../../http/auth.js';
import { env } from '../../config/env.js';
import { pageSize, parseUuid } from '../../utils/ids.js';

export async function subscriptionRoutes(app: FastifyInstance) {
  app.put('/channels/:channelId/subscription', { preHandler: requireIdentity }, async (request, reply) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const { channelId } = request.params as { channelId: string };
    const channel = parseUuid(channelId, 'channelId');
    if (channel === userId) return reply.code(400).send({ error: 'cannot_subscribe_to_self', message: 'You cannot subscribe to your own channel' });

    const result = await pool.query(
      `INSERT INTO social_service.channel_subscriptions(channel_id, user_id)
       VALUES ($1, $2) ON CONFLICT (channel_id, user_id) DO NOTHING
       RETURNING channel_id AS "channelId", user_id AS "userId", created_at AS "createdAt"`,
      [channel, userId]
    );
    const inserted = result.rows[0];
    if (inserted) {
      try { await publishEvent('social.channel.subscribed', inserted); }
      catch (err) { request.log.error({ err, channelId: channel }, 'Failed to publish subscription event'); }
    }
    const count = await pool.query('SELECT count(*)::int AS count FROM social_service.channel_subscriptions WHERE channel_id = $1', [channel]);
    return reply.code(inserted ? 201 : 200).send({ data: { channelId: channel, subscribed: true, subscriberCount: count.rows[0].count } });
  });

  app.delete('/channels/:channelId/subscription', { preHandler: requireIdentity }, async (request, reply) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const { channelId } = request.params as { channelId: string };
    const channel = parseUuid(channelId, 'channelId');
    const result = await pool.query(
      'DELETE FROM social_service.channel_subscriptions WHERE channel_id = $1 AND user_id = $2 RETURNING channel_id AS "channelId", user_id AS "userId"',
      [channel, userId]
    );
    if (result.rowCount) {
      try { await publishEvent('social.channel.unsubscribed', result.rows[0]); }
      catch (err) { request.log.error({ err, channelId: channel }, 'Failed to publish unsubscription event'); }
    }
    const count = await pool.query('SELECT count(*)::int AS count FROM social_service.channel_subscriptions WHERE channel_id = $1', [channel]);
    return { data: { channelId: channel, subscribed: false, subscriberCount: count.rows[0].count } };
  });

  app.get('/channels/:channelId/subscription', { preHandler: requireIdentity }, async (request) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const { channelId } = request.params as { channelId: string };
    const channel = parseUuid(channelId, 'channelId');
    const result = await pool.query(
      `SELECT count(*)::int AS "subscriberCount",
       bool_or(user_id = $2) AS subscribed
       FROM social_service.channel_subscriptions WHERE channel_id = $1`,
      [channel, userId]
    );
    return { data: { channelId: channel, subscriberCount: result.rows[0].subscriberCount, subscribed: result.rows[0].subscribed ?? false } };
  });

  app.get('/me/subscriptions', { preHandler: requireIdentity }, async (request) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const query = request.query as { limit?: string; cursor?: string };
    const limit = pageSize(query.limit, env.DEFAULT_PAGE_SIZE, env.MAX_PAGE_SIZE);
    const cursor = query.cursor ? parseUuid(query.cursor, 'cursor') : null;
    const result = await pool.query(
      `SELECT channel_id AS "channelId", created_at AS "subscribedAt"
       FROM social_service.channel_subscriptions
       WHERE user_id = $1 AND ($2::uuid IS NULL OR channel_id > $2)
       ORDER BY channel_id ASC LIMIT $3`,
      [userId, cursor, limit + 1]
    );
    const hasMore = result.rows.length > limit;
    const data = result.rows.slice(0, limit);
    return { data, page: { limit, hasMore, nextCursor: hasMore ? data[data.length - 1]?.channelId : null } };
  });
}
