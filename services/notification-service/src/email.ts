import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./config.js";
import { pool } from "./db/pool.js";

let transporter: Transporter | undefined;

function getTransport() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.smtpSecure,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined
    });
  }
  return transporter;
}

export async function deliverPendingEmails() {
  if (!env.emailEnabled) return;
  const schema = `"${env.DATABASE_SCHEMA}"`;
  // Claim a small batch atomically so multiple replicas do not send the same rows.
  const claimed = await pool.query(
    `WITH batch AS (
       SELECT id FROM ${schema}.notification_outbox
       WHERE status IN ('pending', 'failed') AND next_attempt_at <= NOW()
       ORDER BY id
       FOR UPDATE SKIP LOCKED
       LIMIT 20
     )
     UPDATE ${schema}.notification_outbox o
     SET status = 'processing', attempts = attempts + 1
     FROM batch WHERE o.id = batch.id
     RETURNING o.id, o.recipient, o.subject, o.body, o.attempts`
  );

  for (const row of claimed.rows) {
    try {
      await getTransport().sendMail({
        from: env.EMAIL_FROM,
        to: row.recipient,
        subject: row.subject,
        text: row.body
      });
      await pool.query(
        `UPDATE ${schema}.notification_outbox SET status = 'sent', sent_at = NOW(), last_error = NULL WHERE id = $1`,
        [row.id]
      );
    } catch (error) {
      const attempts = Number(row.attempts);
      const delaySeconds = Math.min(3600, 15 * 2 ** Math.min(attempts, 8));
      await pool.query(
        `UPDATE ${schema}.notification_outbox
         SET status = 'failed', last_error = $2, next_attempt_at = NOW() + ($3 * INTERVAL '1 second')
         WHERE id = $1`,
        [row.id, error instanceof Error ? error.message.slice(0, 1000) : "Email delivery failed", delaySeconds]
      );
    }
  }
}
