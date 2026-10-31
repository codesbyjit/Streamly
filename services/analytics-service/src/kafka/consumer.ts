import { Kafka, logLevel, type Consumer } from "kafkajs";
import { env } from "../config.js";
import { eventSchema } from "../events/schema.js";
import { ingestEvent } from "../events/ingest.js";

let consumer: Consumer | undefined;
let connected = false;

export function isKafkaConnected(): boolean {
  return connected;
}

export async function startKafkaConsumer(): Promise<void> {
  if (!env.KAFKA_ENABLED) {
    console.log("Kafka consumer disabled by KAFKA_ENABLED=false");
    return;
  }

  const kafka = new Kafka({
    clientId: env.KAFKA_CLIENT_ID,
    brokers: env.KAFKA_BROKERS,
    logLevel: env.NODE_ENV === "development" ? logLevel.WARN : logLevel.ERROR,
    retry: { initialRetryTime: 300, retries: 10 }
  });

  consumer = kafka.consumer({ groupId: env.KAFKA_GROUP_ID });
  await consumer.connect();
  await consumer.subscribe({ topic: env.KAFKA_TOPIC_EVENTS, fromBeginning: env.KAFKA_FROM_BEGINNING });

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) {
        // Empty records are invalid. Commit the offset to avoid blocking the partition.
        await consumer!.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
        return;
      }

      try {
        const raw: unknown = JSON.parse(message.value.toString("utf8"));
        const parsed = eventSchema.safeParse(raw);
        if (!parsed.success) {
          console.error("Invalid analytics event; skipping record", {
            topic, partition, offset: message.offset, issues: parsed.error.issues
          });
          // Local/dev poison-message policy: log and skip. Production should publish to a DLQ first.
          await consumer!.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
          return;
        }

        await ingestEvent(parsed.data);
        await consumer!.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
      } catch (error) {
        console.error("Analytics event processing failed; offset not committed", {
          topic, partition, offset: message.offset, error
        });
        throw error;
      }
    }
  });

  connected = true;
}

export async function stopKafkaConsumer(): Promise<void> {
  connected = false;
  if (consumer) {
    await consumer.disconnect();
    consumer = undefined;
  }
}