import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const currentDir = dirname(fileURLToPath(import.meta.url));
const kafkaDir = resolve(currentDir, "..");
const topicsDir = resolve(kafkaDir, "topics");

const composeFile = resolve(
  process.cwd(),
  process.env.COMPOSE_FILE ?? "infrastructure/docker/docker-compose.yml",
);

const kafkaService = process.env.KAFKA_SERVICE ?? "kafka";
const bootstrapServer = process.env.KAFKA_BOOTSTRAP_SERVER ?? "localhost:9092";

interface TopicDefinition {
  topic: string;
  partitions: number;
  replicationFactor: number;
  configs?: Record<string, string>;
  eventKey?: string;
  description?: string;
}

async function runKafkaCommand(args: string[]): Promise<void> {
  const command = [
    "compose",
    "-f",
    composeFile,
    "exec",
    "-T",
    kafkaService,
    "/opt/kafka/bin/kafka-topics.sh",
    "--bootstrap-server",
    bootstrapServer,
    ...args,
  ];

  const { stdout, stderr } = await execFileAsync("docker", command, {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024,
  });

  if (stdout.trim()) {
    process.stdout.write(stdout);
  }

  if (stderr.trim()) {
    process.stderr.write(stderr);
  }
}

async function loadTopicDefinitions(): Promise<TopicDefinition[]> {
  const files = await readdir(topicsDir);

  const jsonFiles = files
    .filter((file) => file.endsWith(".json"))
    .sort();

  const definitions = await Promise.all(
    jsonFiles.map(async (file) => {
      const filePath = resolve(topicsDir, file);
      const content = await readFile(filePath, "utf-8");

      return JSON.parse(content) as TopicDefinition;
    }),
  );

  for (const definition of definitions) {
    if (!definition.topic) {
      throw new Error("Topic definition is missing the topic name");
    }

    if (
      !Number.isInteger(definition.partitions) ||
      definition.partitions < 1
    ) {
      throw new Error(
        `Invalid partition count for topic "${definition.topic}"`,
      );
    }

    if (
      !Number.isInteger(definition.replicationFactor) ||
      definition.replicationFactor < 1
    ) {
      throw new Error(
        `Invalid replication factor for topic "${definition.topic}"`,
      );
    }
  }

  return definitions;
}

async function createTopic(definition: TopicDefinition): Promise<void> {
  const args = [
    "--create",
    "--if-not-exists",
    "--topic",
    definition.topic,
    "--partitions",
    String(definition.partitions),
    "--replication-factor",
    String(definition.replicationFactor),
  ];

  for (const [key, value] of Object.entries(definition.configs ?? {})) {
    args.push("--config", `${key}=${value}`);
  }

  console.log(`Creating topic: ${definition.topic}`);

  await runKafkaCommand(args);
}

async function main(): Promise<void> {
  const definitions = await loadTopicDefinitions();

  if (definitions.length === 0) {
    console.log("No Kafka topic definitions found.");
    return;
  }

  for (const definition of definitions) {
    await createTopic(definition);
  }

  console.log(`Successfully applied ${definitions.length} Kafka topics.`);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});