import { useState, useCallback, useRef } from 'react';
import { storageManager } from '../utils/StorageManager';
import { getFileSignature } from '../utils/FileUtils';

export const useFileSystem = (showToast, setHighlightedFile) => {
    const [directoryHandle, setDirectoryHandle] = useState(null);
    const [isHandleAuthorized, setIsHandleAuthorized] = useState(false);
    const [libraryFiles, setLibraryFiles] = useState([]);
    const [thumbnailMap, setThumbnailMap] = useState({});
    const [processingQueue, setProcessingQueue] = useState(new Set());
    const [editingFileName, setEditingFileName] = useState(null);
    const [newName, setNewName] = useState('');
    const [selectedVideoUrl, setSelectedVideoUrl] = useState(null);
    const isSyncingRef = useRef(false);

    const generateThumbnail = async (videoBlob, videoName, dirHandle) => {
        const videoObjectUrl = URL.createObjectURL(videoBlob);
        const video = document.createElement('video');
        video.src = videoObjectUrl;
        video.currentTime = 1;

        return new Promise((resolve) => {
            const cleanup = () => URL.revokeObjectURL(videoObjectUrl);

            video.onerror = () => {
                console.warn('Thumbnail generation skipped: video could not be decoded:', videoName);
                cleanup();
                resolve();
            };

            video.onloadeddata = async () => {
                const canvas = document.createElement('canvas');
                canvas.width = 160;
                canvas.height = 90;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(async (thumbBlob) => {
                    cleanup();
                    if (!thumbBlob) { resolve(); return; }
                    try {
                        const assetsHandle = await dirHandle.getDirectoryHandle('.recorder_assets', { create: true });
                        const thumbName = videoName.replace(/\.[^/.]+$/, "") + ".jpg";
                        const thumbFileHandle = await assetsHandle.getFileHandle(thumbName, { create: true });
                        const writable = await thumbFileHandle.createWritable();
                        await writable.write(thumbBlob);
                        await writable.close();

                        const url = URL.createObjectURL(thumbBlob);
                        setThumbnailMap(prev => ({ ...prev, [videoName]: url }));
                    } catch (err) {
                        console.error('Thumbnail save failed:', err);
                    }
                    resolve();
                }, 'image/jpeg', 0.7);
            };
        });
    };

    const getThumbnailUrl = async (videoName, videoHandle, dirHandle, isRecording = false) => {
        if (thumbnailMap[videoName] || processingQueue.has(videoName)) return;

        setProcessingQueue(prev => new Set(prev).add(videoName));

        try {
            const assetsHandle = await dirHandle.getDirectoryHandle('.recorder_assets', { create: true });
            const thumbName = videoName.replace(/\.[^/.]+$/, "") + ".jpg";

            try {
                const thumbFileHandle = await assetsHandle.getFileHandle(thumbName);
                const file = await thumbFileHandle.getFile();
                const url = URL.createObjectURL(file);
                setThumbnailMap(prev => ({ ...prev, [videoName]: url }));
            } catch {
                // Skip generating new thumbnails while recording — video decode + canvas
                // draw compete directly with the render loop on the main thread.
                if (isRecording) return;
                const videoFile = await videoHandle.getFile();
                await generateThumbnail(videoFile, videoName, dirHandle || directoryHandle);
            }

        } catch (err) {
            console.warn('Thumbnail engine error:', err);
        } finally {
            setProcessingQueue(prev => {
                const next = new Set(prev);
                next.delete(videoName);
                return next;
            });
        }
    };

    const syncLibrary = useCallback(async (handle = directoryHandle, googleOps = {}) => {
        if (!handle) return;
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;

        // Note: googleOps will be used in Phase 4 for cloud audit integration
        if (googleOps.loadCloudMetadata) await googleOps.loadCloudMetadata(handle);
        if (googleOps.auditCloudRegistry && googleOps.googleToken) {
            googleOps.auditCloudRegistry(googleOps.googleToken);
        }

        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
            setIsHandleAuthorized(false);
            return;
        }

        const files = [];
        try {
            for await (const entry of handle.values()) {
                if (entry.kind === 'file' && (entry.name.endsWith('.webm') || entry.name.endsWith('.mp4') || entry.name.endsWith('.mkv'))) {
                    const file = await entry.getFile();
                    files.push({
                        name: entry.name,
                        handle: entry,
                        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
                        date: new Date(file.lastModified).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
                        timestamp: file.lastModified,
                        signature: getFileSignature(file)
                    });
                }
            }
            setLibraryFiles(files.sort((a, b) => b.timestamp - a.timestamp));
            setIsHandleAuthorized(true);
        } catch (err) {
            console.error('History sync failed:', err);
            if (err.name === 'NotAllowedError') setIsHandleAuthorized(false);
        } finally {
            isSyncingRef.current = false;
        }
    }, [directoryHandle]);

    const connectFolder = async () => {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            setDirectoryHandle(handle);
            setIsHandleAuthorized(true);
            await storageManager.setSetting('workspace_handle', handle);
            await syncLibrary(handle);
        } catch (err) {
            console.warn('Folder connection skipped:', err);
        }
    };

    const resumeSync = async () => {
        if (!directoryHandle) return;
        try {
            const state = await directoryHandle.requestPermission({ mode: 'readwrite' });
            if (state === 'granted') {
                setIsHandleAuthorized(true);
                await syncLibrary(directoryHandle);
            }
        } catch (err) {
            console.error('Permission request failed:', err);
        }
    };

    const playVideo = async (fileEntry) => {
        if (editingFileName) return;
        try {
            const file = await fileEntry.getFile();
            const url = URL.createObjectURL(file);
            setSelectedVideoUrl(url);
        } catch (err) {
            alert('File not found. It may have been moved or deleted.');
            syncLibrary();
        }
    };

    const startRename = (e, file) => {
        e.stopPropagation();
        setEditingFileName(file.name);
        setNewName(file.name);
    };

    const handleRename = async (e, fileHandle) => {
        e.stopPropagation();
        const oldName = fileHandle.name;
        if (!newName || newName === oldName) {
            setEditingFileName(null);
            return;
        }

        const performManualMove = async (handle, name, targetDir) => {
            const newHandle = await targetDir.getFileHandle(name, { create: true });
            const writable = await newHandle.createWritable();
            const file = await handle.getFile();
            await writable.write(file);
            await writable.close();
            await targetDir.removeEntry(handle.name);
            return newHandle;
        };

        try {
            // 1. Prepare new filename with extension
            let finalName = newName;
            const ext = oldName.split('.').pop();
            if (!finalName.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
                finalName += `.${ext}`;
            }

            // 2. Perform Rename
            try {
                if (typeof fileHandle.move === 'function') {
                    await fileHandle.move(finalName);
                } else {
                    throw new Error('MOVE_UNSUPPORTED');
                }
            } catch (moveErr) {
                console.warn('Native move() failed or unsupported, using copy fallback:', moveErr);
                await performManualMove(fileHandle, finalName, directoryHandle);
            }

            // 3. Rename Thumbnail if exists
            try {
                const assetsHandle = await directoryHandle.getDirectoryHandle('.recorder_assets');
                const oldThumbName = oldName.replace(/\.[^/.]+$/, "") + ".jpg";
                const newThumbName = finalName.replace(/\.[^/.]+$/, "") + ".jpg";

                if (thumbnailMap[oldName]) {
                    URL.revokeObjectURL(thumbnailMap[oldName]);
                }

                try {
                    const oldThumbHandle = await assetsHandle.getFileHandle(oldThumbName);
                    try {
                        if (typeof oldThumbHandle.move === 'function') {
                            await oldThumbHandle.move(newThumbName);
                        } else {
                            throw new Error('MOVE_UNSUPPORTED');
                        }
                    } catch {
                        await performManualMove(oldThumbHandle, newThumbName, assetsHandle);
                    }

                    setThumbnailMap(prev => {
                        const next = { ...prev };
                        delete next[oldName];
                        return next;
                    });
                } catch { /* No thumbnail */ }
            } catch (err) {
                console.warn('Thumbnail rename context error:', err);
            }

            setEditingFileName(null);
            syncLibrary();
        } catch (err) {
            console.error('Rename failed:', err);
            showToast('Error', `Rename failed: ${err.message}`, 'error');
        }
    };

    const deleteFile = async (file) => {
        if (!window.confirm(`Are you sure you want to permanently delete "${file.name}"?`)) return;

        try {
            // 1. Delete the Video File
            await directoryHandle.removeEntry(file.name);

            // 2. Cleanup Thumbnail
            try {
                const assetsHandle = await directoryHandle.getDirectoryHandle('.recorder_assets');
                const thumbName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                await assetsHandle.removeEntry(thumbName);

                if (thumbnailMap[file.name]) {
                    URL.revokeObjectURL(thumbnailMap[file.name]);
                    setThumbnailMap(prev => {
                        const next = { ...prev };
                        delete next[file.name];
                        return next;
                    });
                }
            } catch { /* No thumbnail to cleanup */ }

            showToast('Success', 'Recording deleted from disk', 'success');
            syncLibrary();
        } catch (err) {
            console.error('Delete failed:', err);
            showToast('Error', 'Failed to delete file', 'error');
        }
    };

    return {
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
    };
};
