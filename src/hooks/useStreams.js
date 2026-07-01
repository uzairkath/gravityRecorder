import { useState, useCallback, useRef } from 'react';
import { mediaManager } from '../utils/MediaManager';

export const useStreams = (screenVideoRef, cameraVideoRef, setStatus) => {
    const [screenStream, setScreenStream] = useState(null);
    const [audioStream, setAudioStream] = useState(null);
    const [cameraStream, setCameraStream] = useState(null);
    const [screenDimensions, setScreenDimensions] = useState({ width: 0, height: 0 });
    const [cameraDimensions, setCameraDimensions] = useState({ width: 0, height: 0 });

    // Refs mirror state so async callbacks always read the latest value
    const screenStreamRef = useRef(null);
    const cameraStreamRef = useRef(null);
    const audioStreamRef = useRef(null);

    const setScreenStreamSync = (s) => { screenStreamRef.current = s; setScreenStream(s); };
    const setCameraStreamSync = (s) => { cameraStreamRef.current = s; setCameraStream(s); };
    const setAudioStreamSync = (s) => { audioStreamRef.current = s; setAudioStream(s); };

    const stopAll = useCallback(() => {
        [screenStreamRef.current, cameraStreamRef.current, audioStreamRef.current].forEach(s => {
            s?.getTracks().forEach(t => t.stop());
        });
        setScreenStreamSync(null);
        setCameraStreamSync(null);
        setAudioStreamSync(null);
        setScreenDimensions({ width: 0, height: 0 });
        setCameraDimensions({ width: 0, height: 0 });
        if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
        if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
        setStatus('idle');
    }, [screenVideoRef, cameraVideoRef, setStatus]);

    const toggleScreen = useCallback(async () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            setScreenStreamSync(null);
            setScreenDimensions({ width: 0, height: 0 });
            if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
            return;
        }

        try {
            const stream = await mediaManager.getScreenStream();
            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings();

            setScreenDimensions({
                width: settings.width || 1920,
                height: settings.height || 1080
            });

            setScreenStreamSync(stream);
            if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;

            // Explicitly play to ensure readyState progresses
            await screenVideoRef.current?.play().catch(e => console.warn('Screen video play delayed:', e));

            track.onended = () => {
                setScreenStreamSync(null);
                setScreenDimensions({ width: 0, height: 0 });
                if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
            };

            setStatus('ready');
        } catch (err) {
            console.error('Error starting screen stream:', err);
            alert(`Could not acquire screen: ${err.message}`);
        }
    }, [screenVideoRef, setStatus]);

    const toggleMic = useCallback(async (deviceId) => {
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => track.stop());
            setAudioStreamSync(null);
            return;
        }

        try {
            const stream = await mediaManager.getAudioStream(deviceId);
            setAudioStreamSync(stream);
            setStatus('ready');
            return stream;
        } catch (err) {
            console.error('Error starting mic stream:', err);
            alert(`Could not acquire microphone: ${err.message}`);
        }
    }, [setStatus]);

    const toggleCamera = useCallback(async (deviceId) => {
        if (cameraStreamRef.current) {
            cameraStreamRef.current.getTracks().forEach(track => track.stop());
            setCameraStreamSync(null);
            setCameraDimensions({ width: 0, height: 0 });
            if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
            return;
        }

        try {
            const stream = await mediaManager.getCameraStream(1280, 720, deviceId);
            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings();

            setCameraDimensions({
                width: settings.width || 1280,
                height: settings.height || 720
            });

            setCameraStreamSync(stream);
            if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;

            await cameraVideoRef.current?.play().catch(e => console.warn('Camera video play delayed:', e));
            setStatus('ready');
            return stream;
        } catch (err) {
            console.error('Error starting camera stream:', err);
            alert(`Could not acquire camera: ${err.message}`);
        }
    }, [cameraVideoRef, setStatus]);

    // Change functions stop the existing stream by operating on the ref directly,
    // then start a fresh one — bypassing the stale-state-closure problem in toggle*.
    const changeCamera = useCallback(async (deviceId) => {
        if (cameraStreamRef.current) {
            cameraStreamRef.current.getTracks().forEach(track => track.stop());
            setCameraStreamSync(null);
            setCameraDimensions({ width: 0, height: 0 });
            if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
        }

        try {
            const stream = await mediaManager.getCameraStream(1280, 720, deviceId);
            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings();
            setCameraDimensions({ width: settings.width || 1280, height: settings.height || 720 });
            setCameraStreamSync(stream);
            if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
            await cameraVideoRef.current?.play().catch(e => console.warn('Camera video play delayed:', e));
            setStatus('ready');
            return stream;
        } catch (err) {
            console.error('Error switching camera:', err);
            alert(`Could not switch camera: ${err.message}`);
        }
    }, [cameraVideoRef, setStatus]);

    const changeMic = useCallback(async (deviceId) => {
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => track.stop());
            setAudioStreamSync(null);
        }

        try {
            const stream = await mediaManager.getAudioStream(deviceId);
            setAudioStreamSync(stream);
            setStatus('ready');
            return stream;
        } catch (err) {
            console.error('Error switching mic:', err);
            alert(`Could not switch microphone: ${err.message}`);
        }
    }, [setStatus]);

    return {
        screenStream,
        audioStream,
        cameraStream,
        screenDimensions,
        cameraDimensions,
        toggleScreen,
        toggleMic,
        toggleCamera,
        stopAll,
        changeCamera,
        changeMic
    };
};
