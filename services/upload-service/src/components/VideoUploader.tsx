import React, { useState, useCallback } from 'react';
import * as tus from 'tus-js-client';

interface VideoUploaderProps {
    videoId: string;
    onComplete: () => void;
    onError: (error: Error) => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({ 
    videoId, 
    onComplete, 
    onError 
}) => {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'paused' | 'completed' | 'error'>('idle');
    const [upload, setUpload] = useState<tus.Upload | null>(null);

    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const newUpload = new tus.Upload(file, {
            endpoint: 'http://localhost:8083/files',
            retryDelays: [0, 3000, 5000, 10000, 20000],
            chunkSize: 5 * 1024 * 1024,
            metadata: {
                filename: file.name,
                filetype: file.type,
                filesize: file.size.toString(),
            },
            headers: {
                'x-video-id': videoId,
            },
            onError: (error) => {
                setStatus('error');
                onError(error);
            },
            onProgress: (bytesUploaded, bytesTotal) => {
                const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
                setProgress(parseFloat(percentage));
            },
            onSuccess: () => {
                setStatus('completed');
                setProgress(100);
                onComplete();
            },
        });

        setUpload(newUpload);
        setStatus('idle');
        setProgress(0);
    }, [videoId, onComplete, onError]);

    const startUpload = useCallback(() => {
        if (!upload) return;

        upload.findPreviousUploads().then((previousUploads) => {
            if (previousUploads.length > 0) {
                upload.resumeFromPreviousUpload(previousUploads[0]);
            }

            upload.start();
            setStatus('uploading');
        });
    }, [upload]);

    const pauseUpload = useCallback(() => {
        if (upload) {
            upload.abort();
            setStatus('paused');
        }
    }, [upload]);

    return (
        <div className="video-uploader">
            <input 
                type="file" 
                accept="video/*" 
                onChange={handleFileSelect}
                disabled={status === 'uploading'}
            />

            {upload && status !== 'completed' && (
                <div className="upload-controls">
                    {status === 'idle' && (
                        <button onClick={startUpload}>Start Upload</button>
                    )}
                    {status === 'uploading' && (
                        <button onClick={pauseUpload}>Pause</button>
                    )}
                    {status === 'paused' && (
                        <button onClick={startUpload}>Resume</button>
                    )}

                    <div className="progress-bar">
                        <div 
                            className="progress-fill" 
                            style={{ width: `${progress}%` }}
                        />
                        <span>{progress.toFixed(1)}%</span>
                    </div>
                </div>
            )}

            {status === 'completed' && (
                <div className="success-message">
                    Upload complete! Processing video...
                </div>
            )}

            {status === 'error' && (
                <div className="error-message">
                    Upload failed. You can retry.
                </div>
            )}
        </div>
    );
};
