import { Kafka, logLevel, type Consumer, type Producer } from 'kafkajs';
import { config } from './config.js';
import { logger } from './logger.js';

const kafka = new Kafka({
  clientId: config.KAFKA_CLIENT_ID,
  brokers: config.kafkaBrokers,
  logLevel: config.NODE_ENV === 'development' ? logLevel.WARN : logLevel.INFO,
  retry: { initialRetryTime: 300, retries: 10 }
});

export const consumer: Consumer = kafka.consumer({
  groupId: config.KAFKA_GROUP_ID,
  allowAutoTopicCreation: false,
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});
export const producer: Producer = kafka.producer({ allowAutoTopicCreation: false });

export async function connectKafka(): Promise<void> {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({
    topic: config.KAFKA_INPUT_TOPIC,
    fromBeginning: config.kafkaFromBeginning
  });
  logger.info({ brokers: config.kafkaBrokers, topic: config.KAFKA_INPUT_TOPIC }, 'Kafka connected');
}

export async function publish(topic: string, key: string, value: unknown): Promise<void> {
  await producer.send({
    topic,
    messages: [{ key, value: JSON.stringify(value), timestamp: String(Date.now()) }]
  });
}

export async function disconnectKafka(): Promise<void> {
  await Promise.allSettled([consumer.disconnect(), producer.disconnect()]);
}
