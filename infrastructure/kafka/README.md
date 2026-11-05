# Streamly Kafka Infrastructure

This directory contains version-controlled topic definitions and a small provisioning script.

## Layout

```text
infrastructure/kafka/
├── README.md
├── topics/
│   ├── video.uploaded.json
│   ├── video.processing.started.json
│   ├── video.processing.completed.json
│   ├── video.processing.failed.json
│   ├── video.published.json
│   ├── video.viewed.json
│   ├── video.liked.json
│   └── channel.subscribed.json
└── scripts/
    └── apply-topics.ts
```

## Apply topics

Run from the repository root with Docker Compose and the Kafka service already running:

```bash
pnpm exec tsx infrastructure/kafka/scripts/apply-topics.ts
```

If your Compose file is at a different location:

```bash
pnpm exec tsx infrastructure/kafka/scripts/apply-topics.ts --compose-file path/to/docker-compose.yml
```

The script uses `docker compose exec` and the Kafka CLI inside the broker container. Its default bootstrap address is `localhost:9092` from inside that container. Override it if your Kafka listener configuration differs:

```bash
pnpm exec tsx infrastructure/kafka/scripts/apply-topics.ts --bootstrap-server localhost:19092
```

To also increase the partition count of existing topics when a definition requests more partitions:

```bash
pnpm exec tsx infrastructure/kafka/scripts/apply-topics.ts --partitions
```

Partition counts can be increased but not reduced. The script creates missing topics with `--if-not-exists`; it does not silently overwrite existing topic configs. Apply config changes to existing topics explicitly with Kafka's topic-config tooling when needed.

## Local development defaults

- Partitions: `3`
- Replication factor: `1` (single-broker local environment)
- Retention: `604800000` ms (7 days)
- Cleanup policy: `delete`

For a multi-broker production cluster, set a suitable replication factor (commonly 3) and review retention, partition count, and durability settings for each event stream.

## Event keys

The `eventKey` field documents the intended Kafka record key for partition ordering. It is metadata for Streamly developers; Kafka does not read it from the JSON definition. Producers must set the actual record key.

These files define topic infrastructure, not full event payload schemas. If you want schema validation/versioning, add Avro, Protobuf, or JSON Schema contracts separately.
