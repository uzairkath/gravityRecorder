import React from 'react';

const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

export const PreviewStage = ({
    canvasRef,
    screenVideoRef,
    cameraVideoRef,
    cameraStream,
    screenStream,
    activeBg,
    screenScale,
    recordingQuality,
    isRecording,
    isPaused,
    status,
    countdown,
    recordingDuration = 0,
    currentDimensions = { width: 0, height: 0 },
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
}) => {
    // Determine if we should show the Canvas or the Direct Video Feed
    const useCanvas = cameraStream || activeBg !== 'none' || (screenScale && screenScale < 1.0) || (recordingQuality && recordingQuality !== 'native');
    const showPlaceholder = !cameraStream && !screenStream;

    const videoRef = React.useRef(null);
    React.useEffect(() => {
        if (!useCanvas && screenStream && videoRef.current) {
            if (videoRef.current.srcObject !== screenStream) {
                videoRef.current.srcObject = screenStream;
                videoRef.current.play().catch(() => { });
            }
        }
    }, [screenStream, useCanvas]);
    return (
        <div className={`preview-wrapper ${isRecording ? 'is-recording' : ''}`}>
            {countdown !== null && (
                <div className="countdown-overlay">
                    <div className="countdown-number">{countdown}</div>
                </div>
            )}

            {/* 1. Canvas Mode: Show when using Webcam, Backgrounds, or Frames */}
            <canvas
                ref={canvasRef}
                className="preview-canvas"
                style={{
                    display: (useCanvas && !showPlaceholder) ? 'block' : 'none',
                    cursor: isRecording ? 'default' : 'move'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />

            {!useCanvas && screenStream && (
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="preview-direct-video"
                />
            )}

            {showPlaceholder && (
                <div className="preview-placeholder">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35, marginBottom: '1rem' }}>
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8M12 17v4" />
                    </svg>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No sources active</div>
                    <div style={{ opacity: 0.5, fontSize: '0.8rem' }}>Enable screen or camera to begin</div>
                </div>
            )}

            {status === 'recording' && (
                <div className={`status-badge status-recording${isPaused ? ' paused' : ''}`}>
                    <span className="status-dot"></span>
                    {isPaused ? 'PAUSED' : `REC ${formatDuration(recordingDuration)}`}
                </div>
            )}

            {(cameraStream || screenStream) && currentDimensions?.width > 0 && (
                <div className="resolution-badge">
                    {currentDimensions.width} × {currentDimensions.height}
                </div>
            )}
        </div>
    );
};
