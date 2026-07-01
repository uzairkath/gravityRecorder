import React, { useRef, useState, useEffect, useCallback } from 'react';
import { storageManager } from '../utils/StorageManager';
import { BACKGROUND_PRESETS } from '../constants/backgrounds';
import { useStreams } from '../hooks/useStreams';
import { useFileSystem } from '../hooks/useFileSystem';
import { useGoogleSync } from '../hooks/useGoogleSync';
import { useRecording } from '../hooks/useRecording';
import { EXPORT_FORMATS, getDefaultFormat } from '../constants/formats';

// UI Components
import { ControlBar } from './Controls/ControlBar';
import { HistorySidebar } from './Sidebar/HistorySidebar';
import { PreviewStage } from './Preview/PreviewStage';
import { Toast } from './Notifications/Toast';
import { VideoPlayerModal } from './Modals/VideoPlayerModal';
import SaveRecordingModal from './Modals/SaveRecordingModal';

const QUALITY_PRESETS = {
    'native': { width: null, height: null, label: 'Native Source', bitrate: 15000000 },
    '720p': { width: 1280, height: 720, label: '720p (HD)', bitrate: 6000000 },
    '1080p': { width: 1920, height: 1080, label: '1080p (FHD)', bitrate: 12000000 },
    '1440p': { width: 2560, height: 1440, label: '1440p (2K)', bitrate: 20000000 }
};

const ScreenRecorder = () => {
    // Refs for Media & Stage
    const canvasRef = useRef(null);
    const screenVideoRef = useRef(null);
    const cameraVideoRef = useRef(null);
    const workerRef = useRef(null);

    const [status, setStatus] = useState('idle');
    const {
        screenStream, audioStream, cameraStream,
        screenDimensions, cameraDimensions,
        toggleScreen, toggleMic, toggleCamera, stopAll: stopStreams, changeCamera, changeMic
    } = useStreams(screenVideoRef, cameraVideoRef, setStatus);

    const loadSetting = (key, fallback) => {
        try { const v = localStorage.getItem('gr_' + key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
    };
    const saveSetting = (key, value) => {
        try { localStorage.setItem('gr_' + key, JSON.stringify(value)); } catch {}
    };

    const [webcamShape, setWebcamShape] = useState(() => loadSetting('webcamShape', 'circle'));
    const [webcamScale, setWebcamScale] = useState(() => loadSetting('webcamScale', 0.40));
    const [activeBg, setActiveBg] = useState(() => loadSetting('activeBg', 'none'));
    const [screenScale, setScreenScale] = useState(() => loadSetting('screenScale', 1.0));
    const [recordingQuality, setRecordingQuality] = useState(() => loadSetting('recordingQuality', '1080p'));
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const [highlightedFile, setHighlightedFile] = useState(null);
    const [pendingRecording, setPendingRecording] = useState(null);
    const [recordingFormat, setRecordingFormat] = useState(() => loadSetting('recordingFormat', getDefaultFormat()));
    const [recordingDuration, setRecordingDuration] = useState(0);
    const durationTimerRef = useRef(null);
    const [countdown, setCountdown] = useState(null);

    const showToast = useCallback((title, message, type = 'info') => {
        setToast({ title, message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const {
        directoryHandle, setDirectoryHandle,
        isHandleAuthorized, setIsHandleAuthorized,
        libraryFiles, setLibraryFiles,
        thumbnailMap, setThumbnailMap,
        editingFileName, setEditingFileName,
        newName, setNewName,
        selectedVideoUrl, setSelectedVideoUrl,
        connectFolder, resumeSync, syncLibrary,
        playVideo, startRename, handleRename, deleteFile,
        generateThumbnail, getThumbnailUrl
    } = useFileSystem(showToast, setHighlightedFile);

    const {
        googleToken, cloudUser, cloudRegistry, uploadProgress,
        handleGoogleAuth, handleLogout, uploadToDrive, auditCloudRegistry,
        loadCloudMetadata, saveCloudMetadata
    } = useGoogleSync(showToast, directoryHandle);

    const handleRecordingComplete = useCallback((blob, mimeType) => {
        if (!blob) {
            showToast('Recording Failed', 'No video data was captured. If your mic is disabled, try enabling it.', 'error');
            return;
        }
        setPendingRecording({ blob, mimeType });
    }, [showToast]);

    const {
        isRecording, isPaused, startRecording: startMediaRecording, pauseRecording, resumeRecording, stopRecording, resetRecording
    } = useRecording({
        screenStream, audioStream, cameraStream,
        activeBg, screenScale, canvasRef,
        recordingQuality,
        bitrate: QUALITY_PRESETS[recordingQuality].bitrate,
        mimeType: EXPORT_FORMATS.find(f => f.id === recordingFormat)?.mimeType,
        onComplete: handleRecordingComplete
    });

    const handleSaveRecording = async (blob, fileName) => {
        if (directoryHandle) {
            try {
                const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();

                await syncLibrary(directoryHandle);
                showToast(`Saved to ${directoryHandle.name}`, fileName, 'success');
                setHighlightedFile(fileName);

                // Background thumbnail generation to prevent UI block
                generateThumbnail(blob, fileName, directoryHandle).then(() => {
                    syncLibrary(directoryHandle);
                });

                setTimeout(() => setHighlightedFile(null), 5000);
            } catch (err) {
                console.error('Save failed:', err);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
                showToast('Direct save failed', 'Download triggered as fallback', 'error');
            }
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Recording Saved', 'Check your downloads folder', 'success');
        }
        setPendingRecording(null);
    };

    // Position State (using Ref for 0-lag updates)
    const webcamPos = useRef({ x: 20, y: 410 });
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const drawTimerRef = useRef(null);
    const countdownTimerRef = useRef(null);

    // Initialize hidden video elements
    useEffect(() => {
        screenVideoRef.current = document.createElement('video');
        screenVideoRef.current.muted = true;
        screenVideoRef.current.autoplay = true;
        screenVideoRef.current.playsInline = true;

        cameraVideoRef.current = document.createElement('video');
        cameraVideoRef.current.muted = true;
        cameraVideoRef.current.autoplay = true;
        cameraVideoRef.current.playsInline = true;

        return () => handleStopAll();
    }, []);

    const handleStopAll = () => {
        if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        setCountdown(null);
        resetRecording();
        stopStreams();
        setActiveBg('none');
        setScreenScale(1.0);
    };

    const [currentDimensions, setCurrentDimensions] = useState({ width: 0, height: 0 });

    const lastDrawTimeRef = useRef(0);

    // 1. Sync Canvas Dimensions (Logic only runs when streams/quality change)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const quality = QUALITY_PRESETS[recordingQuality];
        let targetWidth = quality.width;
        let targetHeight = quality.height;

        if (!targetWidth || !targetHeight) {
            if (screenStream) {
                targetWidth = screenDimensions.width;
                targetHeight = screenDimensions.height;
            } else if (cameraStream) {
                targetWidth = cameraDimensions.width;
                targetHeight = cameraDimensions.height;
            } else {
                targetWidth = 1920;
                targetHeight = 1080;
            }
        }

        const isCanvasNeeded = cameraStream || activeBg !== 'none' || screenScale < 1.0;
        if (!isCanvasNeeded && targetWidth > 1920) {
            const ratio = targetHeight / targetWidth;
            targetWidth = 1920;
            targetHeight = 1920 * ratio;
        }

        if (targetWidth > 0 && targetHeight > 0) {
            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                setCurrentDimensions({ width: targetWidth, height: targetHeight });
            }
        }
    }, [screenStream, cameraStream, activeBg, screenScale, recordingQuality, screenDimensions, cameraDimensions]);

    // 2. High-Performance Render Function
    const renderFrame = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });

        const isCanvasNeeded = cameraStream || activeBg !== 'none' || screenScale < 1.0 || (recordingQuality && recordingQuality !== 'native');
        if (!isCanvasNeeded) return;

        // Pre-calculate expensive layout values only when needed
        const bubbleSize = canvas.height * webcamScale;
        const { x, y } = webcamPos.current;

        // 1. Draw Background
        const preset = BACKGROUND_PRESETS.find(p => p.id === activeBg);
        if (preset && preset.colors) {
            // Caching gradient would be better, but creating a simple linear one is relatively fast.
            // For max performance, we create it once per frame.
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            preset.colors.forEach((c, i) => grad.addColorStop(i / (preset.colors.length - 1), c));
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 2. Draw Screen
        if (screenStream && screenVideoRef.current.readyState >= 2) {
            const videoData = screenVideoRef.current;
            const vWidth = videoData.videoWidth;
            const vHeight = videoData.videoHeight;
            const vAspect = vWidth / vHeight;
            const cAspect = canvas.width / canvas.height;

            let drawWidth, drawHeight;
            if (vAspect > cAspect) {
                drawWidth = canvas.width;
                drawHeight = canvas.width / vAspect;
            } else {
                drawHeight = canvas.height;
                drawWidth = canvas.height * vAspect;
            }

            const sw = drawWidth * screenScale;
            const sh = drawHeight * screenScale;
            const sx = (canvas.width - sw) / 2;
            const sy = (canvas.height - sh) / 2;

            if (screenScale < 1.0) {
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(sx, sy, sw, sh, 16);
                ctx.clip();
                ctx.drawImage(videoData, sx, sy, sw, sh);
                ctx.restore();
            } else {
                ctx.drawImage(videoData, sx, sy, sw, sh);
            }
        }

        // 3. Draw Camera Bubble
        if (cameraStream && cameraVideoRef.current.readyState >= 2) {
            const webcamVideo = cameraVideoRef.current;
            const vWidth = webcamVideo.videoWidth;
            const vHeight = webcamVideo.videoHeight;
            const vAspect = vWidth / vHeight;

            let dw, dh, dx, dy;
            if (vAspect > 1) {
                dw = bubbleSize * vAspect; dh = bubbleSize;
                dx = x - (dw - bubbleSize) / 2; dy = y;
            } else {
                dw = bubbleSize; dh = bubbleSize / vAspect;
                dx = x; dy = y - (dh - bubbleSize) / 2;
            }

            if (webcamShape !== 'square') {
                ctx.save();
                ctx.beginPath();
                if (webcamShape === 'circle') {
                    ctx.arc(x + bubbleSize / 2, y + bubbleSize / 2, bubbleSize / 2, 0, Math.PI * 2);
                } else {
                    ctx.roundRect(x, y, bubbleSize, bubbleSize, 32);
                }
                ctx.clip();
                ctx.drawImage(webcamVideo, dx, dy, dw, dh);
                ctx.restore();
            } else {
                ctx.drawImage(webcamVideo, dx, dy, dw, dh);
            }
        }
    }, [cameraStream, screenStream, activeBg, webcamScale, screenScale, webcamShape, cameraVideoRef, recordingQuality]);

    const launchLoop = useCallback(() => {
        const isCanvasNeeded = cameraStream || activeBg !== 'none' || screenScale < 1.0 || recordingQuality !== 'native';

        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }

        if (isCanvasNeeded) {
            workerRef.current = new Worker(new URL('../workers/heartbeat.worker.js', import.meta.url), { type: 'module' });

            workerRef.current.onmessage = (e) => {
                if (e.data.action === 'tick') {
                    renderFrame();
                }
            };

            workerRef.current.postMessage({ action: 'setFps', fps: 30 });
            workerRef.current.postMessage({ action: 'start' });
            console.log('Background Heartbeat: Online');
        }
    }, [cameraStream, activeBg, screenScale, recordingQuality, renderFrame]);

    useEffect(() => {
        launchLoop();
        return () => {
            if (workerRef.current) workerRef.current.terminate();
        };
    }, [launchLoop]);

    const getCanvasMousePos = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
    }, []);

    const handleMouseDown = useCallback((e) => {
        const pos = getCanvasMousePos(e);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const bubbleSize = canvas.height * webcamScale;
        const { x, y } = webcamPos.current;
        if (pos.x >= x && pos.x <= x + bubbleSize && pos.y >= y && pos.y <= y + bubbleSize) {
            isDragging.current = true;
            dragOffset.current = { x: pos.x - x, y: pos.y - y };
        }
    }, [getCanvasMousePos, webcamScale]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging.current) return;
        const pos = getCanvasMousePos(e);
        webcamPos.current = { x: pos.x - dragOffset.current.x, y: pos.y - dragOffset.current.y };
    }, [getCanvasMousePos]);

    const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);

    useEffect(() => {
        const loadSavedState = async () => {
            const savedHandle = await storageManager.getSetting('workspace_handle');
            if (savedHandle) {
                setDirectoryHandle(savedHandle);
                const state = await savedHandle.queryPermission({ mode: 'readwrite' });
                setIsHandleAuthorized(state === 'granted');
            }
        };
        loadSavedState();
    }, [setDirectoryHandle, setIsHandleAuthorized]);

    useEffect(() => {
        if (isHistoryOpen && directoryHandle && !isRecording) {
            syncLibrary(directoryHandle, { googleToken, auditCloudRegistry, loadCloudMetadata });
        }
    }, [isHistoryOpen, directoryHandle, isRecording, googleToken, auditCloudRegistry, loadCloudMetadata, syncLibrary]);

    // Persist settings to localStorage whenever they change
    useEffect(() => { saveSetting('webcamShape', webcamShape); }, [webcamShape]);
    useEffect(() => { saveSetting('webcamScale', webcamScale); }, [webcamScale]);
    useEffect(() => { saveSetting('activeBg', activeBg); }, [activeBg]);
    useEffect(() => { saveSetting('screenScale', screenScale); }, [screenScale]);
    useEffect(() => { saveSetting('recordingQuality', recordingQuality); }, [recordingQuality]);
    useEffect(() => { saveSetting('recordingFormat', recordingFormat); }, [recordingFormat]);

    // Recording duration timer
    useEffect(() => {
        if (isRecording && !isPaused) {
            durationTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
        } else {
            clearInterval(durationTimerRef.current);
            if (!isRecording) setRecordingDuration(0);
        }
        return () => clearInterval(durationTimerRef.current);
    }, [isRecording, isPaused]);

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.code === 'Space' && isRecording) {
                e.preventDefault();
                isPaused ? resumeRecording() : pauseRecording();
            }
            if (e.code === 'Escape' && isRecording) stopRecording();
            if (e.code === 'KeyS' && !isRecording) toggleScreen();
            if (e.code === 'KeyC' && !isRecording) toggleCamera();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isRecording, isPaused, pauseRecording, resumeRecording, stopRecording, toggleScreen, toggleCamera]);

    const isLaunchingRef = useRef(false);

    const startRecording = useCallback(() => {
        if (isRecording || countdown !== null || isLaunchingRef.current) return;
        isLaunchingRef.current = true;
        setCountdown(3);
        countdownTimerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    if (countdownTimerRef.current) {
                        clearInterval(countdownTimerRef.current);
                        countdownTimerRef.current = null;
                    }
                    startMediaRecording();
                    isLaunchingRef.current = false;
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    }, [isRecording, countdown, startMediaRecording]);

    return (
        <div className="recorder-container">
            <header className="header-section" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ visibility: 'hidden' }}>Spacer</div>
                <div style={{ textAlign: 'center' }}>
                    <h1>Gravity Recorder</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Private, local-first screen studio</p>
                </div>
                <button className="btn btn-outline" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
                    History {libraryFiles.length > 0 && `(${libraryFiles.length})`}
                </button>
            </header>

            <PreviewStage
                canvasRef={canvasRef}
                screenVideoRef={screenVideoRef}
                cameraVideoRef={cameraVideoRef}
                cameraStream={cameraStream}
                screenStream={screenStream}
                activeBg={activeBg}
                screenScale={screenScale}
                isRecording={isRecording}
                isPaused={isPaused}
                status={status}
                countdown={countdown}
                recordingQuality={recordingQuality}
                currentDimensions={currentDimensions}
                recordingDuration={recordingDuration}
                handleMouseDown={handleMouseDown}
                handleMouseMove={handleMouseMove}
                handleMouseUp={handleMouseUp}
            />

            <ControlBar
                screenStream={screenStream}
                cameraStream={cameraStream}
                audioStream={audioStream}
                activeBg={activeBg}
                setActiveBg={setActiveBg}
                isRecording={isRecording}
                webcamShape={webcamShape}
                setWebcamShape={setWebcamShape}
                webcamScale={webcamScale}
                setWebcamScale={setWebcamScale}
                screenScale={screenScale}
                setScreenScale={setScreenScale}
                toggleScreen={toggleScreen}
                toggleCamera={toggleCamera}
                toggleMic={toggleMic}
                recordingQuality={recordingQuality}
                setRecordingQuality={setRecordingQuality}
                qualityPresets={QUALITY_PRESETS}
                recordingFormat={recordingFormat}
                setRecordingFormat={setRecordingFormat}
                startRecording={startRecording}
                pauseRecording={pauseRecording}
                resumeRecording={resumeRecording}
                stopRecording={stopRecording}
                isPaused={isPaused}
                handleStopAll={handleStopAll}
                changeCamera={changeCamera}
                changeMic={changeMic}
            />

            <div className="mode-info">
                <div className="status-dot" style={{ background: cameraStream ? 'var(--primary)' : 'var(--success)' }}></div>
                <span>{cameraStream ? 'Studio Mode' : 'Direct Mode'}</span>
                {(screenStream || cameraStream) && (
                    <span style={{ opacity: 0.5, marginLeft: '0.5rem' }}>· S = screen · C = camera · Space = pause · Esc = stop</span>
                )}
            </div>

            <HistorySidebar
                isHistoryOpen={isHistoryOpen}
                setIsHistoryOpen={setIsHistoryOpen}
                cloudUser={cloudUser}
                handleGoogleAuth={handleGoogleAuth}
                handleLogout={handleLogout}
                directoryHandle={directoryHandle}
                isHandleAuthorized={isHandleAuthorized}
                connectFolder={connectFolder}
                resumeSync={resumeSync}
                libraryFiles={libraryFiles}
                thumbnailMap={thumbnailMap}
                getThumbnailUrl={getThumbnailUrl}
                isRecording={isRecording}
                highlightedFile={highlightedFile}
                playVideo={playVideo}
                editingFileName={editingFileName}
                newName={newName}
                setNewName={setNewName}
                handleRename={handleRename}
                setEditingFileName={setEditingFileName}
                uploadProgress={uploadProgress}
                cloudRegistry={cloudRegistry}
                uploadToDrive={uploadToDrive}
                startRename={startRename}
                deleteFile={deleteFile}
            />

            <VideoPlayerModal
                url={selectedVideoUrl}
                onClose={() => setSelectedVideoUrl(null)}
            />

            <Toast
                toast={toast}
                onClose={() => setToast(null)}
            />

            <SaveRecordingModal
                blob={pendingRecording?.blob}
                mimeType={pendingRecording?.mimeType}
                onSave={handleSaveRecording}
                onDiscard={() => setPendingRecording(null)}
            />
        </div>
    );
};

export default ScreenRecorder;
