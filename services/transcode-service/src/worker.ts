import { Kafka, logLevel, type EachMessagePayload } from "kafkajs";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { transcodeUploadedVideo } from "./transcoder.js";
import type { ProcessingFailedEvent, VideoUploadedEvent } from "./types.js";

const kafka = new Kafka({
  clientId: config.KAFKA_CLIENT_ID,
  brokers: config.brokers,
  logLevel: logLevel.NOTHING,
  retry: { initialRetryTime: 300, retries: 8 }
});
const consumer = kafka.consumer({ groupId: config.KAFKA_GROUP_ID });
const producer = kafka.producer({ allowAutoTopicCreation: false });

function parseEvent(value: Buffer | null): VideoUploadedEvent {
  if (!value) throw new Error("Kafka message has no value");
  const parsed = JSON.parse(value.toString("utf8")) as VideoUploadedEvent;
  const data = parsed.data ?? parsed;
  if (!data.videoId || !data.objectKey) {
    throw new Error("Invalid video.uploaded event: data.videoId and data.objectKey are required");
  }
  return parsed;
}

async function publish(topic: string, key: string, value: unknown): Promise<void> {
  await producer.send({
    topic,
    acks: -1,
    messages: [{ key, value: JSON.stringify(value), headers: { "content-type": "application/json" } }]
  });
}

async function processMessage(payload: EachMessagePayload): Promise<void> {
  const { topic, partition, message } = payload;
  let event: VideoUploadedEvent | undefined;
  try {
    event = parseEvent(message.value);
    const data = event.data ?? event;
    const videoId = String(data.videoId);
    logger.info({ topic, partition, offset: message.offset, videoId }, "Received upload event");

    const completed = await transcodeUploadedVideo(event);
    await publish(config.KAFKA_READY_TOPIC, videoId, completed);
    logger.info({ videoId }, "Published processing-completed event");
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    logger.error({ topic, partition, offset: message.offset, error: messageText }, "Video processing failed");

    const data = event?.data ?? event;
    const videoId = String(data?.videoId ?? "unknown");
    const failure: ProcessingFailedEvent = {
      eventId: randomUUID(),
      eventType: "video.processing.failed",
      version: 1,
      occurredAt: new Date().toISOString(),
      data: {
        videoId,
        ...(data?.ownerId ? { ownerId: String(data.ownerId) } : {}),
        status: "FAILED",
        sourceObjectKey: String(data?.objectKey ?? ""),
        error: messageText.slice(0, 2000)
      }
    };

    // If the event is malformed or publishing fails, rethrow so Kafka does not silently lose it.
    await publish(config.KAFKA_FAILED_TOPIC, videoId, failure);
    if (!event) throw error;
  }
}

async function main(): Promise<void> {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: config.KAFKA_INPUT_TOPIC, fromBeginning: config.fromBeginning });
  logger.info({
    brokers: config.brokers,
    inputTopic: config.KAFKA_INPUT_TOPIC,
    readyTopic: config.KAFKA_READY_TOPIC,
    failedTopic: config.KAFKA_FAILED_TOPIC
  }, "Transcode worker connected");

  await consumer.run({
    autoCommit: false,
    eachMessage: async (payload) => {
      await processMessage(payload);
      // Commit only after success/failure event is published.
      await consumer.commitOffsets([{
        topic: payload.topic,
        partition: payload.partition,
        offset: (BigInt(payload.message.offset) + 1n).toString()
      }]);
    }
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down transcode worker");
  await consumer.disconnect().catch(() => undefined);
  await producer.disconnect().catch(() => undefined);
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error: unknown) => {
  logger.fatal({ error }, "Transcode worker failed to start");
  process.exit(1);
});
