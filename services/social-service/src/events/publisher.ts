import { randomUUID } from 'node:crypto';
import { Kafka, type Producer, type SASLOptions } from 'kafkajs';
import { env } from '../config/env.js';
import type { DomainEvent } from '../types.js';

let producer: Producer | undefined;
let connecting: Promise<void> | undefined;

function kafkaSasl(): SASLOptions | undefined {
  const mechanism = env.KAFKA_SASL_MECHANISM;
  if (!mechanism || !env.KAFKA_SASL_USERNAME || !env.KAFKA_SASL_PASSWORD) return undefined;
  if (mechanism === 'plain' || mechanism === 'scram-sha-256' || mechanism === 'scram-sha-512') {
    return { mechanism, username: env.KAFKA_SASL_USERNAME, password: env.KAFKA_SASL_PASSWORD } as SASLOptions;
  }
  return undefined;
}

async function getProducer(): Promise<Producer> {
  if (!env.KAFKA_ENABLED) throw new Error('Kafka publishing is disabled');
  if (!producer) {
    const kafka = new Kafka({
      clientId: env.KAFKA_CLIENT_ID,
      brokers: env.KAFKA_BROKERS.split(',').map(s => s.trim()).filter(Boolean),
      ssl: env.KAFKA_SSL,
      sasl: kafkaSasl(),
      connectionTimeout: 5000,
      requestTimeout: 10000
    });
    producer = kafka.producer({ allowAutoTopicCreation: true, idempotent: true });
  }
  if (connecting) await connecting;
  else {
    connecting = producer.connect().then(() => undefined).finally(() => { connecting = undefined; });
    await connecting;
  }
  return producer;
}

export async function publishEvent<T>(eventType: string, data: T): Promise<void> {
  if (!env.KAFKA_ENABLED) return;
  const event: DomainEvent<T> = {
    eventId: randomUUID(),
    eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    producer: 'social-service',
    data
  };
  const p = await getProducer();
  await p.send({
    topic: 'streamly.social.events',
    messages: [{ key: eventType, value: JSON.stringify(event), headers: { eventType, version: '1' } }]
  });
}

export async function closeEventPublisher(): Promise<void> {
  if (producer) {
    try { await producer.disconnect(); } finally { producer = undefined; }
  }
}
