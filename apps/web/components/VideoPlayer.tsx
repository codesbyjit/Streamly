import React, { useEffect, useRef, useState } from 'react';
import shaka from 'shaka-player';

interface VideoPlayerProps {
    dashUrl?: string;
    hlsUrl?: string;
    posterUrl?: string;
    title?: string;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    onComplete?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
    dashUrl,
    hlsUrl,
    posterUrl,
    title,
    onTimeUpdate,
    onComplete,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<shaka.Player | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [quality, setQuality] = useState<string>('auto');

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        shaka.polyfill.installAll();

        if (shaka.Player.isBrowserSupported()) {
            const player = new shaka.Player(video);
            playerRef.current = player;

            player.configure({
                abr: {
                    enabled: true,
                    defaultBandwidthEstimate: 5000000,
                    restrictions: {
                        minHeight: 240,
                        maxHeight: 2160,
                    },
                },
                streaming: {
                    bufferingGoal: 30,
                    rebufferingGoal: 10,
                    bufferBehind: 30,
                },
            });

            player.addEventListener('error', (event: any) => {
                console.error('Shaka error:', event.detail);
                setError(`Playback error: ${event.detail.message}`);
            });

            const manifestUrl = dashUrl || hlsUrl;
            if (manifestUrl) {
                player.load(manifestUrl).then(() => {
                    setIsLoading(false);
                    console.log('Video loaded successfully');
                }).catch((err) => {
                    setError(`Failed to load: ${err.message}`);
                    setIsLoading(false);
                });
            }
        } else {
            setError('Browser not supported for streaming');
        }

        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
            }
        };
    }, [dashUrl, hlsUrl]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            onTimeUpdate?.(video.currentTime, video.duration);
        };

        const handleEnded = () => {
            onComplete?.();
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('ended', handleEnded);
        };
    }, [onTimeUpdate, onComplete]);

    const changeQuality = (height: number | 'auto') => {
        const player = playerRef.current;
        if (!player) return;

        if (height === 'auto') {
            player.configure({ abr: { enabled: true } });
            setQuality('auto');
        } else {
            player.configure({ abr: { enabled: false } });
            const tracks = player.getVariantTracks();
            const track = tracks.find(t => t.height === height);
            if (track) {
                player.selectVariantTrack(track, true);
                setQuality(`${height}p`);
            }
        }
    };

    return (
        <div className="video-player-container">
            {isLoading && (
                <div className="loading-overlay">
                    <div className="spinner" />
                    <span>Loading video...</span>
                </div>
            )}

            {error && (
                <div className="error-overlay">
                    <p>{error}</p>
                </div>
            )}

            <video
                ref={videoRef}
                poster={posterUrl}
                controls
                autoPlay={false}
                style={{ width: '100%', height: 'auto' }}
            >
                <p>Your browser does not support streaming video.</p>
            </video>

            <div className="quality-selector">
                <span>Quality: </span>
                <select 
                    value={quality} 
                    onChange={(e) => changeQuality(e.target.value === 'auto' ? 'auto' : parseInt(e.target.value))}
                >
                    <option value="auto">Auto</option>
                    <option value={2160}>4K (2160p)</option>
                    <option value={1440}>1440p</option>
                    <option value={1080}>1080p</option>
                    <option value={720}>720p</option>
                    <option value={480}>480p</option>
                    <option value={360}>360p</option>
                    <option value={240}>240p</option>
                </select>
            </div>
        </div>
    );
};
