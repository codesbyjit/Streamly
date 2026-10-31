import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { config } from './config.js';
import { logger } from './logger.js';
import { closeDatabase, initializeDatabase } from './db.js';
import { connectKafka, consumer, disconnectKafka, publish } from './kafka.js';
import { ensureBucket } from './storage.js';
import { safeObjectKey, videoUploadedSchema } from './schemas.js';
import { processVideo } from './processor.js';

let shuttingDown = false;
let activeJobs = 0;

async function main(): Promise<void> {
  await mkdir(config.WORK_DIR, { recursive: true });
  await initializeDatabase();
  await ensureBucket();
  await connectKafka();

  await consumer.run({
    autoCommit: false,
    partitionsConsumedConcurrently: config.MAX_CONCURRENT_JOBS,
    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      if (shuttingDown) return;
      const raw = message.value?.toString('utf8');
      if (!raw) {
        logger.warn({ topic, partition, offset: message.offset }, 'Skipping empty Kafka message');
        await consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        await publish(config.KAFKA_DLQ_TOPIC, message.key?.toString() ?? randomUUID(), {
          eventId: randomUUID(), eventType: 'video.processing.invalid_event', occurredAt: new Date().toISOString(),
          source: { topic, partition, offset: message.offset }, error: 'Invalid JSON', raw: raw.slice(0, 10000)
        });
        await consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
        return;
      }

      const validation = videoUploadedSchema.safeParse(parsed);
      if (!validation.success) {
        await publish(config.KAFKA_DLQ_TOPIC, message.key?.toString() ?? randomUUID(), {
          eventId: randomUUID(), eventType: 'video.processing.invalid_event', occurredAt: new Date().toISOString(),
          source: { topic, partition, offset: message.offset },
          error: validation.error.flatten(), payload: parsed
        });
        await consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
        return;
      }

      try {
        safeObjectKey(validation.data.data.objectKey);
      } catch (error) {
        await publish(config.KAFKA_DLQ_TOPIC, validation.data.data.videoId, {
          eventId: randomUUID(), eventType: 'video.processing.invalid_event', occurredAt: new Date().toISOString(),
          source: { topic, partition, offset: message.offset }, error: error instanceof Error ? error.message : String(error), payload: parsed
        });
        await consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
        return;
      }

      activeJobs++;
      try {
        const result = await processVideo(validation.data);
        await publish(config.KAFKA_OUTPUT_TOPIC, result.data.videoId, result);
        await consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
      } catch (error) {
        const attempt = validation.data.retryCount ?? 0;
        const messageText = error instanceof Error ? error.message : String(error);
        if (attempt < 2) {
          await publish(config.KAFKA_INPUT_TOPIC, validation.data.data.videoId, {
            ...validation.data,
            eventId: `${validation.data.eventId}:retry:${attempt + 1}`,
            retryCount: attempt + 1,
            occurredAt: new Date().toISOString()
          });
        } else {
          await publish(config.KAFKA_DLQ_TOPIC, validation.data.data.videoId, {
            eventId: randomUUID(), eventType: 'video.processing.failed', occurredAt: new Date().toISOString(),
            producer: config.SERVICE_NAME,
            data: { videoId: validation.data.data.videoId, status: 'failed', errorCode: 'PROCESSING_FAILED', errorMessage: messageText.slice(0, 4000) },
            source: { topic, partition, offset: message.offset }
          });
        }
        await consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
      } finally {
        activeJobs--;
        await heartbeat().catch(() => undefined);
      }
    }
  });
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal, activeJobs }, 'Shutting down worker');
  try {
    await consumer.stop();
    await disconnectKafka();
    await closeDatabase();
  } finally {
    process.exit(0);
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

main().catch(async (error) => {
  logger.fatal({ err: error }, 'Worker failed to start');
  await disconnectKafka().catch(() => undefined);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
