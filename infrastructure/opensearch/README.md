# OpenSearch

Local API: `http://localhost:9200`; Dashboards: `http://localhost:5601`. Security is disabled in this local single-node Compose setup; do not expose it to untrusted networks or reuse this configuration in production.

Use `OPENSEARCH_URL=http://localhost:9200` from host apps, or `http://opensearch:9200` from containers on `streamly-network`.

Create the initial video search index:

```bash
curl -X PUT http://localhost:9200/streamly-videos-v1 \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {"properties": {
      "videoId": {"type": "keyword"},
      "ownerId": {"type": "keyword"},
      "title": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
      "description": {"type": "text"},
      "tags": {"type": "keyword"},
      "categoryId": {"type": "keyword"},
      "visibility": {"type": "keyword"},
      "status": {"type": "keyword"},
      "publishedAt": {"type": "date"}
    }}
  }'
```

Verify:

```bash
curl 'http://localhost:9200/_cluster/health?pretty'
curl 'http://localhost:9200/_cat/indices?v'
```

PostgreSQL remains the source of truth. Treat OpenSearch as a derived, rebuildable projection; index consumers should be idempotent and public search must exclude private or unpublished videos.
