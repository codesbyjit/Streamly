import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { publishEvent } from '../../events/publisher.js';
import { requireIdentity } from '../../http/auth.js';
import { parseUuid } from '../../utils/ids.js';

const reactionSchema = z.object({ reaction: z.enum(['like', 'dislike']) });

export async function reactionRoutes(app: FastifyInstance) {
  app.put('/stream/:videoId/reaction', { preHandler: requireIdentity }, async (request, reply) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const { videoId } = request.params as { videoId: string };
    const id = parseUuid(videoId, 'videoId');
    const input = reactionSchema.parse(request.body);
    const result = await pool.query(
      `INSERT INTO social_service.video_reactions(video_id, user_id, reaction)
       VALUES ($1, $2, $3)
       ON CONFLICT (video_id, user_id) DO UPDATE SET reaction = EXCLUDED.reaction, updated_at = now()
       RETURNING video_id AS "videoId", user_id AS "userId", reaction, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, userId, input.reaction]
    );
    try { await publishEvent('social.reaction.changed', result.rows[0]); }
    catch (err) { request.log.error({ err, videoId: id }, 'Failed to publish reaction event'); }
    return { data: result.rows[0] };
  });

  app.delete('/stream/:videoId/reaction', { preHandler: requireIdentity }, async (request, reply) => {
    const userId = (request as typeof request & { userId: string }).userId;
    const { videoId } = request.params as { videoId: string };
    const id = parseUuid(videoId, 'videoId');
    const result = await pool.query(
      'DELETE FROM social_service.video_reactions WHERE video_id = $1 AND user_id = $2 RETURNING video_id AS "videoId", user_id AS "userId", reaction',
      [id, userId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: 'reaction_not_found', message: 'No reaction exists for this user and video' });
    try { await publishEvent('social.reaction.removed', result.rows[0]); }
    catch (err) { request.log.error({ err, videoId: id }, 'Failed to publish reaction-removed event'); }
    return reply.code(204).send();
  });

  app.get('/stream/:videoId/reactions', async (request) => {
    const { videoId } = request.params as { videoId: string };
    const id = parseUuid(videoId, 'videoId');
    const userId = request.headers['x-user-id'] as string | undefined;
    const counts = await pool.query(
      `SELECT count(*) FILTER (WHERE reaction = 'like')::int AS likes,
              count(*) FILTER (WHERE reaction = 'dislike')::int AS dislikes
       FROM social_service.video_reactions WHERE video_id = $1`,
      [id]
    );
    let myReaction: string | null = null;
    if (userId && /^[0-9a-f-]{36}$/i.test(userId)) {
      const own = await pool.query('SELECT reaction FROM social_service.video_reactions WHERE video_id = $1 AND user_id = $2', [id, userId]);
      myReaction = own.rows[0]?.reaction ?? null;
    }
    return { data: { videoId: id, likes: counts.rows[0].likes, dislikes: counts.rows[0].dislikes, myReaction } };
  });
}
