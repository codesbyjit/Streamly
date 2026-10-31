import { Kafka, logLevel, type Consumer } from "kafkajs";
import { env } from "./config.js";
import { createNotification } from "./repository.js";

type DomainEvent = {
  eventId?: string;
  id?: string;
  eventType?: string;
  type?: string;
  occurredAt?: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID,
  brokers: env.kafkaBrokers,
  logLevel: env.NODE_ENV === "development" ? logLevel.WARN : logLevel.ERROR,
  ssl: env.kafkaSsl || undefined,
  sasl: env.KAFKA_SASL_USERNAME && env.KAFKA_SASL_PASSWORD
    ? {
        mechanism: (env.KAFKA_SASL_MECHANISM || "plain") as "plain" | "scram-sha-256" | "scram-sha-512",
        username: env.KAFKA_SASL_USERNAME,
        password: env.KAFKA_SASL_PASSWORD
      }
    : undefined
});

let consumer: Consumer | undefined;

function getString(data: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

async function handleEvent(topic: string, event: DomainEvent) {
  const data = event.data ?? event.payload ?? {};
  const eventType = (event.eventType ?? event.type ?? topic).toLowerCase();
  const eventId = event.eventId ?? event.id;

  // This consumer supports the initial Streamly event envelope. Extend mappings
  // explicitly as other services settle their event contracts.
  if (eventType.includes("video.published")) {
    const recipientId = getString(data, "subscriberId", "recipientId", "userId");
    const videoId = getString(data, "videoId", "id");
    const title = getString(data, "videoTitle", "title") ?? "A new video is available";
    const channelName = getString(data, "channelName", "creatorName") ?? "A channel you follow";
    if (!recipientId || !videoId) return;
    await createNotification({
      recipientId,
      type: "video_published",
      title: `${channelName} uploaded a video`,
      body: title,
      data: { videoId, channelName },
      sourceEventId: eventId ? `${eventId}:${recipientId}` : undefined
    });
    return;
  }

  if (eventType.includes("channel.subscribed")) {
    const creatorId = getString(data, "creatorId", "channelOwnerId", "recipientId");
    const subscriberName = getString(data, "subscriberName", "userName") ?? "Someone";
    if (!creatorId) return;
    await createNotification({
      recipientId: creatorId,
      type: "new_subscriber",
      title: "New channel subscriber",
      body: `${subscriberName} subscribed to your channel.`,
      data: { subscriberId: getString(data, "subscriberId", "userId") ?? null },
      sourceEventId: eventId ? `${eventId}:${creatorId}` : undefined
    });
    return;
  }

  if (eventType.includes("comment.created")) {
    const recipientId = getString(data, "videoOwnerId", "recipientId");
    const videoId = getString(data, "videoId");
    const commentId = getString(data, "commentId");
    const commenter = getString(data, "commenterName", "userName") ?? "Someone";
    const commentText = getString(data, "commentText", "text") ?? "Someone commented on your video.";
    if (!recipientId || !videoId) return;
    await createNotification({
      recipientId,
      type: "comment",
      title: `${commenter} commented on your video`,
      body: commentText.slice(0, 500),
      data: { videoId, commentId: commentId ?? null },
      sourceEventId: eventId ? `${eventId}:${recipientId}` : undefined
    });
  }
}

export async function startEventConsumer() {
  if (!env.workerEnabled || env.kafkaTopics.length === 0) return;
  consumer = kafka.consumer({ groupId: env.KAFKA_GROUP_ID });
  await consumer.connect();
  for (const topic of env.kafkaTopics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      let event: DomainEvent;
      try {
        event = JSON.parse(message.value.toString("utf8")) as DomainEvent;
      } catch (error) {
        console.error("Skipping malformed Kafka event", { topic, error });
        return;
      }
      try {
        await handleEvent(topic, event);
      } catch (error) {
        // KafkaJS retries only if the handler throws. A poison message can block
        // a partition; production should add retry topics / a DLQ policy.
        console.error("Failed to process Kafka event", { topic, eventId: event.eventId ?? event.id, error });
        throw error;
      }
    }
  });
  console.log("Notification Kafka consumer started", { topics: env.kafkaTopics });
}

export async function stopEventConsumer() {
  if (consumer) {
    await consumer.disconnect().catch(() => undefined);
    consumer = undefined;
  }
}
