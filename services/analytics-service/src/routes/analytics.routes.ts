import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const querySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

function dateRange(query: unknown) {
  const parsed = querySchema.safeParse(query);

  if (!parsed.success) {
    throw Object.assign(new Error("from/to must use YYYY-MM-DD"), {
      statusCode: 400,
    });
  }

  const to = parsed.data.to ?? new Date().toISOString().slice(0, 10);
  const from =
    parsed.data.from ??
    new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);

  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);

  if (
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(toDate.getTime()) ||
    fromDate.toISOString().slice(0, 10) !== from ||
    toDate.toISOString().slice(0, 10) !== to
  ) {
    throw Object.assign(new Error("Invalid calendar date"), {
      statusCode: 400,
    });
  }

  if (from > to) {
    throw Object.assign(new Error("'from' must be on or before 'to'"), {
      statusCode: 400,
    });
  }

  if ((toDate.getTime() - fromDate.getTime()) / 86_400_000 > 365) {
    throw Object.assign(new Error("Date range cannot exceed 366 calendar days"), {
      statusCode: 400,
    });
  }

  return { from, to };
}

const analyticsRoute: FastifyPluginAsync = async (app) => {
  app.get("/overview", async (request) => {
    const { from, to } = dateRange(request.query);

    const result = await pool.query(
      `SELECT
         COALESCE(SUM(impressions), 0)::text AS impressions,
         COALESCE(SUM(views), 0)::text AS views,
         COALESCE(SUM(completions), 0)::text AS completions,
         COALESCE(SUM(likes), 0)::text AS likes,
         COALESCE(SUM(dislikes), 0)::text AS dislikes,
         COALESCE(SUM(subscriptions), 0)::text AS subscriptions,
         COALESCE(SUM(searches), 0)::text AS searches,
         COALESCE(SUM(watch_seconds), 0)::text AS watch_seconds
       FROM analytics_daily_totals
       WHERE day BETWEEN $1::date AND $2::date`,
      [from, to],
    );

    return {
      range: { from, to },
      totals: result.rows[0],
    };
  });

  app.get<{ Params: { videoId: string } }>(
    "/videos/:videoId",
    async (request) => {
      const { from, to } = dateRange(request.query);

      const result = await pool.query(
        `SELECT
           COALESCE(SUM(impressions), 0)::text AS impressions,
           COALESCE(SUM(views), 0)::text AS views,
           COALESCE(SUM(completions), 0)::text AS completions,
           COALESCE(SUM(likes), 0)::text AS likes,
           COALESCE(SUM(dislikes), 0)::text AS dislikes,
           COALESCE(SUM(watch_seconds), 0)::text AS watch_seconds
         FROM analytics_video_daily
         WHERE video_id = $1
           AND day BETWEEN $2::date AND $3::date`,
        [request.params.videoId, from, to],
      );

      return {
        videoId: request.params.videoId,
        range: { from, to },
        totals: result.rows[0],
      };
    },
  );

  app.get("/top-videos", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const range = dateRange(query);

    const limitParsed = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .safeParse(query.limit ?? 20);

    if (!limitParsed.success) {
      return reply.code(400).send({
        error: "bad_request",
        message: "limit must be an integer from 1 to 100",
      });
    }

    const result = await pool.query(
      `SELECT
         video_id AS "videoId",
         SUM(impressions)::text AS impressions,
         SUM(views)::text AS views,
         SUM(completions)::text AS completions,
         SUM(likes)::text AS likes,
         SUM(dislikes)::text AS dislikes,
         SUM(watch_seconds)::text AS watch_seconds
       FROM analytics_video_daily
       WHERE day BETWEEN $1::date AND $2::date
       GROUP BY video_id
       ORDER BY SUM(views) DESC, SUM(watch_seconds) DESC
       LIMIT $3`,
      [range.from, range.to, limitParsed.data],
    );

    return {
      range,
      videos: result.rows,
    };
  });
};

export default analyticsRoute;