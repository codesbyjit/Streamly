import { Kafka, type Producer } from "kafkajs";
import { env } from "../config/env.js";

let producer: Producer | null = null;

export async function connectKafka() {
  if (!env.KAFKA_ENABLED) return;
  const kafka = new Kafka({
    clientId: env.KAFKA_CLIENT_ID,
    brokers: env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()).filter(Boolean)
  });
  producer = kafka.producer();
  await producer.connect();
}

export async function publishEvent(eventType: string, data: Record<string, unknown>) {
  if (!producer) return;
  await producer.send({
    topic: `${env.KAFKA_TOPIC_PREFIX}live.lifecycle`,
    messages: [{
      key: String(data.streamId ?? "live"),
      value: JSON.stringify({
        eventId: crypto.randomUUID(),
        eventType,
        version: 1,
        occurredAt: new Date().toISOString(),
        producer: "live-service",
        data
      })
    }]
  });
}

export async function closeKafka() {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
