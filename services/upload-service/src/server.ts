import express from 'express';
import { Server as TusServer } from '@tus/server';
import { S3Store } from '@tus/s3-store';
import { S3Client } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import { Kafka, Producer } from 'kafkajs';

const app = express();
const port = process.env.PORT || 8083;

// ==========================================
// DATABASE CONNECTION
// ==========================================
const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'streamflow',
    user: process.env.DB_USER || 'streamflow',
    password: process.env.DB_PASSWORD || 'dev_password_123',
});

// ==========================================
// KAFKA PRODUCER
// ==========================================
const kafka = new Kafka({
    clientId: 'upload-service',
    brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

let producer: Producer;

async function connectKafka() {
    producer = kafka.producer();
    await producer.connect();
    console.log('Connected to Kafka');
}

// ==========================================
// S3/MINIO CLIENT
// ==========================================
const s3Client = new S3Client({
    region: 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin123',
    },
    forcePathStyle: true,
});

// ==========================================
// TUS SERVER CONFIGURATION
// ==========================================
const tusServer = new TusServer({
    path: '/files',
    datastore: new S3Store({
        partSize: 8 * 1024 * 1024,
        s3ClientConfig: {
            bucket: process.env.S3_BUCKET || 'streamflow-uploads',
            region: 'us-east-1',
            endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
                secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin123',
            },
        },
    }),
    async onUploadCreate(req, res, upload) {
        const videoId = req.headers['x-video-id'] as string;
        const filename = upload.metadata?.filename || 'unknown';
        const fileSize = parseInt(upload.metadata?.filesize || '0');

        await db.query(
            `INSERT INTO upload_sessions 
             (video_id, filename, file_size, mime_type, total_chunks, status, storage_path)
             VALUES ($1, $2, $3, $4, $5, 'uploading', $6)`,
            [
                videoId,
                filename,
                fileSize,
                upload.metadata?.filetype || 'video/mp4',
                Math.ceil(fileSize / (5 * 1024 * 1024)),
                upload.id,
            ]
        );

        return { res, upload };
    },

    async onUploadFinish(req, res, upload) {
        const videoId = req.headers['x-video-id'] as string;

        await db.query(
            `UPDATE upload_sessions 
             SET status = 'completed', completed_at = NOW()
             WHERE video_id = $1`,
            [videoId]
        );

        await db.query(
            `UPDATE videos SET status = 'processing' WHERE id = $1`,
            [videoId]
        );

        await producer.send({
            topic: 'video.uploaded',
            messages: [{
                key: videoId,
                value: JSON.stringify({
                    eventType: 'upload.complete',
                    videoId: videoId,
                    storagePath: upload.id,
                    filename: upload.metadata?.filename,
                    timestamp: Date.now(),
                }),
            }],
        });

        console.log(`Upload completed for video ${videoId}`);
        return { res, upload };
    },
});

app.use('/files', tusServer.handle.bind(tusServer));

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'upload-service' });
});

async function start() {
    await connectKafka();
    app.listen(port, () => {
        console.log(`Upload service listening on port ${port}`);
    });
}

start().catch(console.error);
