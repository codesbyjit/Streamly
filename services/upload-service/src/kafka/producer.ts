import { Kafka, Producer } from "kafkajs";
import { config } from "../config.js";

let producer: Producer | undefined;
let connected = false;

export async function connectKafka(): Promise<void> {
  if (!config.KAFKA_BROKERS.trim()) return;
  const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: config.KAFKA_BROKERS.split(",").map((x) => x.trim()).filter(Boolean),
    ssl: config.KAFKA_SSL
  });
  producer = kafka.producer({ allowAutoTopicCreation: false, idempotent: true });
  await producer.connect();
  connected = true;
}

export function isKafkaConnected(): boolean {
  return connected;
}

export async function publish(topic: string, key: string, payload: unknown): Promise<void> {
  if (!producer || !connected) throw new Error("Kafka is not connected");
  await producer.send({
    topic,
    acks: -1,
    messages: [{ key, value: JSON.stringify(payload) }]
  });
}

export async function disconnectKafka(): Promise<void> {
  connected = false;
  if (producer) await producer.disconnect();
  producer = undefined;
}
