class MediaManager {
    async getScreenStream() {
        try {
            return await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always",
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: true
            });
        } catch (err) {
            console.error("Error getting screen stream:", err);
            throw err;
        }
    }

    async getCameraStream(width, height, deviceId) {
        try {
            return await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    width: { max: width || 1920 },
                    height: { max: height || 1080 },
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: false
            });
        } catch (err) {
            console.error("Error getting camera stream:", err);
            throw err;
        }
    }

    async getAudioStream(deviceId) {
        try {
            return await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                },
                video: false
            });
        } catch (err) {
            console.error("Error getting audio stream:", err);
            throw err;
        }
    }

    stopStream(stream) {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }
}

export const mediaManager = new MediaManager();
