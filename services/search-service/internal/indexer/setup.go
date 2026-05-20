package indexer

import (
    "bytes"
    "encoding/json"
    "net/http"
)

func SetupVideoIndex(esURL string) error {
    mapping := map[string]interface{}{
        "settings": map[string]interface{}{
            "number_of_shards": 3,
            "number_of_replicas": 1,
            "analysis": map[string]interface{}{
                "analyzer": map[string]interface{}{
                    "video_analyzer": map[string]interface{}{
                        "type":      "custom",
                        "tokenizer": "standard",
                        "filter": []string{
                            "lowercase",
                            "asciifolding",
                            "word_delimiter",
                            "porter_stem",
                        },
                    },
                },
            },
        },
        "mappings": map[string]interface{}{
            "properties": map[string]interface{}{
                "id": map[string]interface{}{
                    "type": "keyword",
                },
                "title": map[string]interface{}{
                    "type":     "text",
                    "analyzer": "video_analyzer",
                    "fields": map[string]interface{}{
                        "keyword": map[string]interface{}{
                            "type": "keyword",
                        },
                    },
                    "boost": 3.0,
                },
                "description": map[string]interface{}{
                    "type":     "text",
                    "analyzer": "video_analyzer",
                    "boost":    1.5,
                },
                "tags": map[string]interface{}{
                    "type":  "keyword",
                    "boost": 2.0,
                },
                "channel_name": map[string]interface{}{
                    "type":     "text",
                    "analyzer": "video_analyzer",
                    "boost":    2.5,
                },
                "category": map[string]interface{}{
                    "type": "keyword",
                },
                "language": map[string]interface{}{
                    "type": "keyword",
                },
                "duration_seconds": map[string]interface{}{
                    "type": "integer",
                },
                "view_count": map[string]interface{}{
                    "type": "long",
                },
                "like_count": map[string]interface{}{
                    "type": "integer",
                },
                "published_at": map[string]interface{}{
                    "type": "date",
                },
                "status": map[string]interface{}{
                    "type": "keyword",
                },
                "transcript": map[string]interface{}{
                    "type":     "text",
                    "analyzer": "video_analyzer",
                    "boost":    1.0,
                },
                "suggest": map[string]interface{}{
                    "type":            "completion",
                    "analyzer":        "video_analyzer",
                    "search_analyzer": "video_analyzer",
                },
            },
        },
    }

    payload, _ := json.Marshal(mapping)

    resp, err := http.Put(
        esURL+"/videos",
        "application/json",
        bytes.NewReader(payload),
    )
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    return nil
}
