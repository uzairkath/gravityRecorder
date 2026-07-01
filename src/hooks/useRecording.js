import { useState, useRef, useCallback } from 'react';
import { storageManager } from '../utils/StorageManager';

export const useRecording = ({
    screenStream,
    audioStream,
    cameraStream,
    activeBg,
    screenScale,
    canvasRef,
    recordingQuality = 'native',
    bitrate = 8000000,
    mimeType: preferredMimeType,
    onComplete
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [status, setStatus] = useState('idle');
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const isStartingRef = useRef(false);


    const startRecording = useCallback(async () => {
        console.log('Attempting to start recording...');
        if (isStartingRef.current) return;
        isStartingRef.current = true;

        try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                console.warn('Recording already in progress');
                return;
            }

            if (!screenStream && !cameraStream) {
                alert('Enable Screen or Camera first');
                return;
            }

            setStatus('initializing');

            console.log('Finalizing stream for MediaRecorder...');
            const tracks = [];

            // Case A: Webcam is active OR Background/Frame is active OR Non-Native Scaling (requires canvas)
            const useCanvas = cameraStream || activeBg !== 'none' || (screenScale && screenScale < 1.0) || recordingQuality !== 'native';
            console.log('Use Canvas:', useCanvas, { cameraStream, activeBg, screenScale, recordingQuality });

            if (useCanvas) {
                if (!canvasRef.current) throw new Error('Canvas not found');
                const canvasStream = canvasRef.current.captureStream(30);
                tracks.push(...canvasStream.getVideoTracks());
                console.log('Using Canvas Mode for recording');
            }
            // Case B: Screen only (Direct mode for better performance)
            else if (screenStream) {
                tracks.push(...screenStream.getVideoTracks());
                console.log('Using Direct Mode for recording');
            }

            // Add Audio track if available
            if (audioStream) {
                const audioTrack = audioStream.getAudioTracks()[0];
                if (audioTrack) {
                    tracks.push(audioTrack);
                    console.log('Added audio track to recording');
                }
            }

            if (tracks.length === 0) throw new Error('No tracks available for recording');

            const recordingStream = new MediaStream(tracks);

            // Select MIME type: preference first, then fallback to WebM
            let finalMimeType = '';
            const hasAudio = tracks.some(t => t.kind === 'audio');
            console.log('Recording has audio:', hasAudio);

            if (preferredMimeType && MediaRecorder.isTypeSupported(preferredMimeType)) {
                finalMimeType = preferredMimeType;
            } else {
                const fallbacks = [
                    'video/webm;codecs=vp9,opus',
                    'video/webm;codecs=vp8,opus',
                    'video/webm;codecs=h264,opus',
                    'video/webm',
                    'video/mp4'
                ];
                finalMimeType = fallbacks.find(t => MediaRecorder.isTypeSupported(t)) || '';
            }

            // [FIX] If no audio tracks, strip audio codecs to prevent silent failure on some browsers
            if (!hasAudio && finalMimeType.includes('opus')) {
                finalMimeType = finalMimeType.replace(',opus', '');
            } else if (!hasAudio && finalMimeType.includes('aac')) {
                finalMimeType = finalMimeType.replace(',aac', '');
            }

            console.log('Selected MIME Type:', finalMimeType);

            let mediaRecorder;
            try {
                mediaRecorder = new MediaRecorder(recordingStream, {
                    mimeType: finalMimeType,
                    videoBitsPerSecond: bitrate,
                    audioBitsPerSecond: hasAudio ? 128000 : 0
                });
            } catch (codecErr) {
                // Some browsers (e.g. Opera GX on Windows) report isTypeSupported=true for MP4
                // but throw at construction time. Fall back to the first supported WebM variant.
                console.warn(`MediaRecorder rejected "${finalMimeType}", falling back to WebM:`, codecErr);
                const webmFallbacks = [
                    'video/webm;codecs=vp9,opus',
                    'video/webm;codecs=vp8,opus',
                    'video/webm',
                ];
                finalMimeType = webmFallbacks.find(t => MediaRecorder.isTypeSupported(t)) || '';
                mediaRecorder = new MediaRecorder(recordingStream, {
                    mimeType: finalMimeType,
                    videoBitsPerSecond: bitrate,
                    audioBitsPerSecond: hasAudio ? 128000 : 0
                });
            }
            mediaRecorderRef.current = mediaRecorder;

            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onerror = (e) => {
                console.error('MediaRecorder Error:', e);
                setStatus('error');
            };

            mediaRecorder.onstop = async () => {
                setStatus('processing');
                const chunks = chunksRef.current;
                console.log(`Recording stopped. Total chunks: ${chunks.length}`);

                if (chunks.length > 0) {
                    const blob = new Blob(chunks, { type: finalMimeType });
                    if (onComplete) {
                        onComplete(blob, finalMimeType);
                    }
                } else {
                    console.error('Recording stopped with 0 chunks. This usually indicates an encoding failure.');
                    if (onComplete) {
                        onComplete(null, null); // Notify with null to signal empty recording
                    }
                }

                chunksRef.current = [];
                setStatus('ready');
            };

            mediaRecorder.start(1000); // 1s slice is more standard/stable
            setIsRecording(true);
            setStatus('recording');
        } catch (err) {
            console.error('Recording start failed:', err);
            setStatus('error');
        } finally {
            isStartingRef.current = false;
        }
    }, [screenStream, cameraStream, audioStream, activeBg, screenScale, canvasRef, recordingQuality, bitrate, preferredMimeType, onComplete]);

    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
            setStatus('paused');
        }
    }, []);

    const resumeRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
            setStatus('recording');
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            // onstop handler will drive status through processing → ready
        } else {
            setStatus('ready');
        }
        setIsRecording(false);
        setIsPaused(false);
    }, []);

    const resetRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setIsPaused(false);
        setStatus('idle');
    }, []);

    return {
        isRecording,
        isPaused,
        status,
        setStatus,
        startRecording,
        pauseRecording,
        resumeRecording,
        stopRecording,
        resetRecording,
        mediaRecorderRef
    };
};
