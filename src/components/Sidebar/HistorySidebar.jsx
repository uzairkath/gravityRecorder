import React from 'react';

export const HistorySidebar = ({
    isHistoryOpen,
    setIsHistoryOpen,
    cloudUser,
    handleGoogleAuth,
    handleLogout,
    directoryHandle,
    isHandleAuthorized,
    connectFolder,
    resumeSync,
    libraryFiles,
    thumbnailMap,
    getThumbnailUrl,
    isRecording,
    highlightedFile,
    playVideo,
    editingFileName,
    newName,
    setNewName,
    handleRename,
    setEditingFileName,
    uploadProgress,
    cloudRegistry,
    uploadToDrive,
    startRename,
    deleteFile
}) => {
    return (
        <div className={`sidebar ${isHistoryOpen ? 'open' : ''}`}>
            {isHistoryOpen && (
                <>
                    <div className="sidebar-header">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Library</h3>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Files synced to disk</span>
                        </div>
                        <button className="btn-icon-bg" onClick={() => setIsHistoryOpen(false)}>✕</button>
                    </div>

                    {/* Cloud Hub Section */}
                    <div className="cloud-hub glass-card" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--glass)' }}>
                        {!cloudUser.isLoggedIn ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>☁️</span>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Cloud Sync</span>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Sign in to share links</span>
                                    </div>
                                </div>
                                <button className="btn-small active" onClick={() => handleGoogleAuth(() => { })}>Connect</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    {cloudUser.profile?.picture ? (
                                        <img src={cloudUser.profile.picture} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--primary)' }} alt="" />
                                    ) : (
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                                            {cloudUser.profile?.name?.[0] || 'U'}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {cloudUser.profile?.name || 'User'}
                                        </span>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            ● <span style={{ color: 'var(--text-muted)' }}>Connected</span>
                                        </span>
                                    </div>
                                </div>
                                <button className="btn-small" onClick={handleLogout} style={{ opacity: 0.6, fontSize: '0.6rem' }}>Sign Out</button>
                            </div>
                        )}
                    </div>

                    {!directoryHandle ? (
                        <div className="empty-state">
                            <span style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }}>📁</span>
                            <p>Connect a folder to track your recordings on this PC.</p>
                            <button className="btn btn-primary" onClick={connectFolder} style={{ marginTop: '1.5rem', width: '100%' }}>
                                Select Workspace Folder
                            </button>
                        </div>
                    ) : !isHandleAuthorized ? (
                        <div className="empty-state">
                            <span style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }}>🔒</span>
                            <p>Connection lost after refresh.</p>
                            <button className="btn btn-primary" onClick={resumeSync} style={{ marginTop: '1.5rem', width: '100%' }}>
                                Resume Sync with {directoryHandle.name}
                            </button>
                            <button onClick={connectFolder} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', marginTop: '1rem' }}>Pick another folder</button>
                        </div>
                    ) : (
                        <div className="sidebar-content">
                            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Connected to: {directoryHandle.name}</span>
                                <button onClick={connectFolder} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.7rem' }}>Change</button>
                            </div>

                            {libraryFiles.length === 0 ? (
                                <div className="empty-state">No recordings found in this folder.</div>
                            ) : (
                                libraryFiles.map(file => {
                                    if (!thumbnailMap[file.name]) {
                                        getThumbnailUrl(file.name, file.handle, directoryHandle, isRecording);
                                    }

                                    return (
                                        <div key={file.name}
                                            className={`video-card ${highlightedFile === file.name ? 'highlight-success' : ''}`}
                                            onClick={() => playVideo(file.handle)}>
                                            <div className="video-thumb" style={{ background: '#000' }}>
                                                {thumbnailMap[file.name] ? (
                                                    <img src={thumbnailMap[file.name]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                                ) : (
                                                    <span style={{ fontSize: '1.5rem', color: '#fff' }}>▶</span>
                                                )}
                                            </div>
                                            <div className="video-info">
                                                {editingFileName === file.name ? (
                                                    <div onClick={e => e.stopPropagation()}>
                                                        <input
                                                            autoFocus
                                                            className="rename-input"
                                                            value={newName}
                                                            onChange={e => setNewName(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && handleRename(e, file.handle)}
                                                        />
                                                        <div className="rename-actions">
                                                            <button className="btn-small active" onClick={e => handleRename(e, file.handle)}>Save</button>
                                                            <button className="btn-small" onClick={() => setEditingFileName(null)}>Cancel</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="video-title-row">
                                                            <span className="video-title">{file.name}</span>
                                                            <div className="video-actions">
                                                                {uploadProgress[file.name] !== undefined ? (
                                                                    <span className="upload-loader" title="Uploading...">⏳</span>
                                                                ) : cloudRegistry[file.signature] ? (
                                                                    <button
                                                                        className="btn-cloud active"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            window.open(cloudRegistry[file.signature].shareLink, '_blank');
                                                                        }}
                                                                        title="Open Share Link"
                                                                    >🔗</button>
                                                                ) : (
                                                                    <button
                                                                        className="btn-cloud"
                                                                        onClick={(e) => { e.stopPropagation(); uploadToDrive(file.handle); }}
                                                                        title="Upload to Google Drive"
                                                                    >☁️</button>
                                                                )}
                                                                <button className="btn-rename" onClick={e => startRename(e, file)} title="Rename">✎</button>
                                                                <button
                                                                    className="btn-delete"
                                                                    onClick={e => { e.stopPropagation(); deleteFile(file); }}
                                                                    title="Delete Recording"
                                                                >🗑️</button>
                                                            </div>
                                                        </div>
                                                        <span className="video-meta">{file.date} • {file.size}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
