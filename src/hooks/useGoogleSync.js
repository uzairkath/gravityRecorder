import { useState, useCallback, useRef, useEffect } from 'react';
import { storageManager } from '../utils/StorageManager';
import { getFileSignature } from '../utils/FileUtils';
import { supabase } from '../utils/SupabaseClient';

export const useGoogleSync = (showToast, directoryHandle) => {
    const [googleToken, setGoogleToken] = useState(null);
    const [cloudUser, setCloudUser] = useState({ isLoggedIn: false, profile: null });
    const [cloudRegistry, setCloudRegistry] = useState({}); // signature -> { driveId, shareLink }
    const cloudRegistryRef = useRef({});
    const [uploadProgress, setUploadProgress] = useState({}); // filename -> percentage
    const isAuditing = useRef(false);

    // Keep ref in sync
    useEffect(() => {
        cloudRegistryRef.current = cloudRegistry;
    }, [cloudRegistry]);

    const loadCloudMetadata = useCallback(async (dirHandle) => {
        try {
            const assetsHandle = await dirHandle.getDirectoryHandle('.recorder_assets', { create: false }).catch(() => null);
            if (!assetsHandle) return {};
            const metaHandle = await assetsHandle.getFileHandle('metadata.json', { create: false }).catch(() => null);
            if (!metaHandle) return {};
            const file = await metaHandle.getFile();
            const text = await file.text();
            if (text) {
                const data = JSON.parse(text);
                if (JSON.stringify(data) !== JSON.stringify(cloudRegistryRef.current)) {
                    setCloudRegistry(data);
                }
                return data;
            }
        } catch (err) {
            console.warn('Could not load metadata:', err);
        }
        return {};
    }, []);

    const saveCloudMetadata = useCallback(async (newMeta) => {
        if (!directoryHandle) return;
        try {
            const assetsHandle = await directoryHandle.getDirectoryHandle('.recorder_assets', { create: true });
            const metaHandle = await assetsHandle.getFileHandle('metadata.json', { create: true });
            const writable = await metaHandle.createWritable();
            await writable.write(JSON.stringify(newMeta));
            await writable.close();
            setCloudRegistry(newMeta);
        } catch (err) {
            console.error('Metadata save failed:', err);
        }
    }, [directoryHandle]);

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut();
        setGoogleToken(null);
        setCloudUser({ isLoggedIn: false, profile: null });
        // storageManager cleanups are now managed by Supabase state
        showToast('Cloud Disconnected', 'You have been signed out', 'info');
    }, [showToast]);

    const auditCloudRegistry = useCallback(async (token = googleToken) => {
        const registryToAudit = cloudRegistryRef.current;
        if (!token || isAuditing.current) return;
        if (Object.keys(registryToAudit).length === 0) return;

        isAuditing.current = true;
        try {
            // Paginate through all Drive files to avoid the 1000-file cap
            const query = encodeURIComponent("trashed = false");
            const remoteIds = new Set();
            let pageToken = null;

            do {
                const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
                const url = `https://www.googleapis.com/drive/v3/files?pageSize=1000&q=${query}&fields=nextPageToken,files(id)${pageParam}`;
                const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

                if (resp.status === 401) { isAuditing.current = false; return; }
                if (!resp.ok) break;

                const body = await resp.json();
                (body.files || []).forEach(f => remoteIds.add(f.id));
                pageToken = body.nextPageToken || null;
            } while (pageToken);

            let cleaned = false;
            const newRegistry = { ...registryToAudit };
            let removedCount = 0;

            for (const [sig, data] of Object.entries(newRegistry)) {
                if (!remoteIds.has(data.driveId)) {
                    delete newRegistry[sig];
                    cleaned = true;
                    removedCount++;
                }
            }

            if (cleaned) {
                await saveCloudMetadata(newRegistry);
                showToast('Cloud Sync Updated', `Pruned ${removedCount} dead links.`, 'info');
            }
        } catch (err) {
            console.error('Audit failed:', err);
        } finally {
            isAuditing.current = false;
        }
    }, [googleToken, saveCloudMetadata, showToast]);


    const handleGoogleAuth = useCallback(async (onSuccess, forcePrompt = true, onFailure = () => { }, bypassCache = false) => {
        // 1. If we have a valid token in memory and aren't forcing a fresh login, use it!
        if (!forcePrompt && googleToken && !bypassCache) {
            if (onSuccess) return onSuccess(googleToken);
            return;
        }

        // 2. Otherwise, we must redirect to Supabase/Google
        const redirectUrl = window.location.origin + '/recorder';
        console.log('Initiating Auth with Redirect:', redirectUrl);

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                queryParams: {
                    access_type: 'offline',
                    prompt: forcePrompt ? 'consent' : 'select_account' // 'none' often fails for sensitive scopes like drive.file
                },
                scopes: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email'
            }
        });

        if (error) {
            console.error('Supabase Auth Error:', error);
            onFailure(error);
            showToast('Auth Failed', error.message, 'error');
        }
        // Redirect happens here
    }, [googleToken, showToast]);

    const uploadToDrive = useCallback(async (fileHandle, _retryCount = 0) => {
        handleGoogleAuth(async (token) => {
            const file = await fileHandle.getFile();
            const signature = getFileSignature(file);
            const fileName = file.name;

            setUploadProgress(prev => ({ ...prev, [fileName]: 0 }));

            try {
                const metadata = {
                    name: fileName,
                    mimeType: file.type || 'video/webm',
                };

                const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json; charset=UTF-8',
                    },
                    body: JSON.stringify(metadata),
                });

                if (response.status === 401) {
                    if (_retryCount >= 1) {
                        // Token refresh also failed — give up and sign out
                        showToast('Session Expired', 'Please reconnect Google Drive', 'error');
                        handleLogout();
                        return;
                    }
                    // Try once with a fresh token
                    handleGoogleAuth(async () => {
                        uploadToDrive(fileHandle, _retryCount + 1);
                    }, false, handleLogout, true);
                    return;
                }

                if (!response.ok) throw new Error('Failed to initiate upload');
                const uploadUrl = response.headers.get('Location');

                const uploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    body: file,
                });

                if (!uploadResponse.ok) throw new Error('Upload failed');
                const driveFile = await uploadResponse.json();

                await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
                });

                const fileInfoResp = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}?fields=webViewLink`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const { webViewLink } = await fileInfoResp.json();

                // Read the registry from the ref so we always merge onto the latest version,
                // not the stale closure value captured when uploadToDrive was called.
                const newMeta = { ...cloudRegistryRef.current, [signature]: { driveId: driveFile.id, shareLink: webViewLink } };
                await saveCloudMetadata(newMeta);

                showToast('Cloud Sync Success', `${fileName} is ready to share!`, 'success');
            } catch (err) {
                console.error('Upload failed:', err);
                showToast('Cloud Sync Failed', 'Check your connection', 'error');
            } finally {
                setUploadProgress(prev => {
                    const next = { ...prev };
                    delete next[fileName];
                    return next;
                });
            }
        }, false);
    }, [handleGoogleAuth, handleLogout, saveCloudMetadata, showToast]);

    // Initialize Cloud State & Listen for session
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                // provider_token is available after sign in
                if (session.provider_token) {
                    setGoogleToken(session.provider_token);
                }

                setCloudUser({
                    isLoggedIn: true,
                    profile: session.user.user_metadata
                });

                // Load metadata & audit if token exists
                if (session.provider_token) {
                    auditCloudRegistry(session.provider_token);
                }
            } else {
                setGoogleToken(null);
                setCloudUser({ isLoggedIn: false, profile: null });
            }
        });

        return () => subscription.unsubscribe();
    }, [auditCloudRegistry]);

    return {
        googleToken, cloudUser, cloudRegistry, uploadProgress,
        handleGoogleAuth, handleLogout, uploadToDrive, auditCloudRegistry,
        loadCloudMetadata, saveCloudMetadata
    };
};
