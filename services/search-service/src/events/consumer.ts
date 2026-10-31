import { Kafka, logLevel, type Consumer } from "kafkajs";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { deleteVideo, indexVideo } from "../search/index.js";
import { isSearchable } from "../search/video-document.js";
import { parseVideoEvent } from "./video-event.js";

let consumer: Consumer | undefined;

export async function startConsumer(): Promise<void> {
  if (!config.KAFKA_ENABLED) {
    logger.info("Kafka consumer disabled");
    return;
  }

  const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: config.KAFKA_BROKERS,
    logLevel: logLevel.NOTHING,
    retry: { initialRetryTime: 500, retries: 10 }
  });
  consumer = kafka.consumer({ groupId: config.KAFKA_GROUP_ID });
  await consumer.connect();

  for (const topic of config.KAFKA_TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: config.KAFKA_FROM_BEGINNING });
  }

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) return;
      const raw = JSON.parse(message.value.toString("utf8")) as unknown;
      const event = parseVideoEvent(raw, topic);
      if (event.type === "delete") {
        await deleteVideo(event.id);
      } else if (isSearchable(event.video)) {
        await indexVideo(event.video);
      } else {
        await deleteVideo(event.video.id);
      }

      // Commit only after OpenSearch successfully applied the event.
      await consumer!.commitOffsets([{
        topic,
        partition,
        offset: (BigInt(message.offset) + 1n).toString()
      }]);
      logger.info({ topic, partition, offset: message.offset, eventType: event.type }, "Processed video event");
    }
  });

  logger.info({ brokers: config.KAFKA_BROKERS, topics: config.KAFKA_TOPICS }, "Kafka consumer started");
}

export async function stopConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = undefined;
  }
}