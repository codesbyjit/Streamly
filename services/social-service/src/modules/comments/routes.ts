import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { publishEvent } from '../../events/publisher.js';
import { requireIdentity } from '../../http/auth.js';
import { pageSize, parseUuid } from '../../utils/ids.js';
import { env } from '../../config/env.js';

const createSchema = z.object({
  body: z.string().trim().min(1).max(env.MAX_COMMENT_LENGTH),
  parentId: z.string().uuid().nullable().optional()
});
const updateSchema = z.object({ body: z.string().trim().min(1).max(env.MAX_COMMENT_LENGTH) });

export async function commentRoutes(app: FastifyInstance) {
  app.post('/stream/:videoId/comments', { preHandler: requireIdentity }, async (request, reply) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const { videoId } = request.params as { videoId: string };
    const video = parseUuid(videoId, 'videoId');
    const input = createSchema.parse(request.body);
    const parentId = input.parentId ? parseUuid(input.parentId, 'parentId') : null;

    if (parentId) {
      const parent = await pool.query(
        'SELECT id, video_id, parent_id FROM social_service.comments WHERE id = $1 AND is_deleted = false',
        [parentId]
      );
      if (!parent.rowCount || parent.rows[0].video_id !== video || parent.rows[0].parent_id !== null) {
        return reply.code(400).send({ error: 'invalid_parent_comment', message: 'Parent must be an existing top-level comment on this video' });
      }
    }

    const result = await pool.query(
      `INSERT INTO social_service.comments(video_id, user_id, parent_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, video_id AS "videoId", user_id AS "userId", parent_id AS "parentId", body, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [video, userId, parentId, input.body]
    );
    const comment = result.rows[0];
    try { await publishEvent('social.comment.created', comment); }
    catch (err) { request.log.error({ err, commentId: comment.id }, 'Failed to publish comment-created event'); }
    return reply.code(201).send({ data: comment });
  });

  app.get('/stream/:videoId/comments', async (request) => {
    const { videoId } = request.params as { videoId: string };
    const video = parseUuid(videoId, 'videoId');
    const query = request.query as { limit?: string; cursor?: string };
    const limit = pageSize(query.limit, env.DEFAULT_PAGE_SIZE, env.MAX_PAGE_SIZE);
    const cursor = query.cursor ? parseUuid(query.cursor, 'cursor') : null;
    const result = await pool.query(
      `SELECT c.id, c.video_id AS "videoId", c.user_id AS "userId",
              c.body, c.created_at AS "createdAt", c.updated_at AS "updatedAt",
              (SELECT count(*)::int FROM social_service.comments r WHERE r.parent_id = c.id AND r.is_deleted = false) AS "replyCount"
       FROM social_service.comments c
       WHERE c.video_id = $1 AND c.parent_id IS NULL AND c.is_deleted = false
         AND ($2::uuid IS NULL OR (c.created_at, c.id) < (SELECT created_at, id FROM social_service.comments WHERE id = $2))
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT $3`,
      [video, cursor, limit + 1]
    );
    const hasMore = result.rows.length > limit;
    const data = result.rows.slice(0, limit);
    return { data, page: { limit, hasMore, nextCursor: hasMore ? data[data.length - 1]?.id : null } };
  });

  app.get('/comments/:commentId/replies', async (request) => {
    const { commentId } = request.params as { commentId: string };
    const parentId = parseUuid(commentId, 'commentId');
    const query = request.query as { limit?: string; cursor?: string };
    const limit = pageSize(query.limit, env.DEFAULT_PAGE_SIZE, env.MAX_PAGE_SIZE);
    const cursor = query.cursor ? parseUuid(query.cursor, 'cursor') : null;
    const result = await pool.query(
      `SELECT id, video_id AS "videoId", user_id AS "userId", parent_id AS "parentId",
              body, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM social_service.comments
       WHERE parent_id = $1 AND is_deleted = false
         AND ($2::uuid IS NULL OR (created_at, id) > (SELECT created_at, id FROM social_service.comments WHERE id = $2))
       ORDER BY created_at ASC, id ASC LIMIT $3`,
      [parentId, cursor, limit + 1]
    );
    const hasMore = result.rows.length > limit;
    const data = result.rows.slice(0, limit);
    return { data, page: { limit, hasMore, nextCursor: hasMore ? data[data.length - 1]?.id : null } };
  });

  app.patch('/comments/:commentId', { preHandler: requireIdentity }, async (request, reply) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const { commentId } = request.params as { commentId: string };
    const id = parseUuid(commentId, 'commentId');
    const input = updateSchema.parse(request.body);
    const result = await pool.query(
      `UPDATE social_service.comments SET body = $3, updated_at = now()
       WHERE id = $1 AND user_id = $2 AND is_deleted = false
       RETURNING id, video_id AS "videoId", user_id AS "userId", parent_id AS "parentId", body, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, userId, input.body]
    );
    if (!result.rowCount) return reply.code(404).send({ error: 'comment_not_found', message: 'Comment not found or not editable by this user' });
    try { await publishEvent('social.comment.updated', result.rows[0]); }
    catch (err) { request.log.error({ err, commentId: id }, 'Failed to publish comment-updated event'); }
    return { data: result.rows[0] };
  });

  app.delete('/comments/:commentId', { preHandler: requireIdentity }, async (request, reply) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const { commentId } = request.params as { commentId: string };
    const id = parseUuid(commentId, 'commentId');
    const result = await pool.query(
      `UPDATE social_service.comments SET body = '[deleted]', is_deleted = true, updated_at = now()
       WHERE id = $1 AND user_id = $2 AND is_deleted = false
       RETURNING id, video_id AS "videoId", user_id AS "userId"`,
      [id, userId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: 'comment_not_found', message: 'Comment not found or already deleted' });
    try { await publishEvent('social.comment.deleted', result.rows[0]); }
    catch (err) { request.log.error({ err, commentId: id }, 'Failed to publish comment-deleted event'); }
    return reply.code(204).send();
  });
}
