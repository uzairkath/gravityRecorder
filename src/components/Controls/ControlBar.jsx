import React from 'react';
import { BACKGROUND_PRESETS } from '../../constants/backgrounds';
import { getSupportedFormats, EXPORT_FORMATS } from '../../constants/formats';
import ChevronDown from './SVG/ChevronDown';
import './Controls.css';
export const ControlBar = ({
    screenStream,
    cameraStream,
    audioStream,
    activeBg,
    isRecording,
    webcamShape,
    setWebcamShape,
    webcamScale,
    setWebcamScale,
    webcamDepthBlur,
    setWebcamDepthBlur,
    screenScale,
    setScreenScale,
    toggleScreen,
    toggleCamera,
    toggleMic,
    micVolume,
    setMicVolume,
    setActiveBg,
    recordingQuality,
    setRecordingQuality,
    qualityPresets,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    isPaused,
    zoomEnabled,
    setZoomEnabled,
    handleStopAll,
    recordingFormat,
    setRecordingFormat,
    changeCamera,
    changeMic
}) => {
    const [activePanel, setActivePanel] = React.useState(null);
    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const supportedFormats = React.useMemo(() => getSupportedFormats(), []);
    const [showMicOptions, setShowMicOptions] = React.useState(false);
    const [showCameraOptions, setShowCameraOptions] = React.useState(false);
    const [cameraOption, setCameraOption] = React.useState('');
    const [micID, setMicID] = React.useState('');
    const [cameras, setCameras] = React.useState([]);
    const [microphones, setMicrophones] = React.useState([]);

    const togglePanel = (panel) => {
        setActivePanel(activePanel === panel ? null : panel);
    };

    const getCameras = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices
                .filter(device => device.kind === 'videoinput')
                .map(device => ({ label: device.label, deviceId: device.deviceId }));
        } catch (error) {
            console.error("Failed to enumerate devices:", error);
        }
    };

    const currentFormat = EXPORT_FORMATS.find(f => f.id === recordingFormat);

    return (
        <div className="control-bar-container">
            {activePanel && !isRecording && (
                <div className="settings-popover">
                    {activePanel === 'camera' && (
                        <div className="setting-group" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <span className="setting-label">Webcam Frame</span>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        {['circle', 'rounded-rect', 'square'].map(s => (
                                            <button key={s} onClick={() => setWebcamShape(s)}
                                                className={`btn-icon ${webcamShape === s ? 'active' : ''}`}
                                                title={s}>
                                                <div className={`shape-preview ${s}`}></div>
                                            </button>
                                        ))}
                                        <div style={{ width: '1px', background: 'var(--glass-border)', margin: '0 0.4rem' }}></div>
                                        <button
                                            onClick={() => { toggleCamera(); setActivePanel(null); }}
                                            className="btn-danger-minimal"
                                            title="Turn Off Camera"
                                        >
                                            Disable
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <span className="setting-label">Effects</span>
                                    <button
                                        className={`btn-small ${webcamDepthBlur ? 'active' : ''}`}
                                        onClick={() => setWebcamDepthBlur(v => !v)}
                                        title="Bokeh glow halo around camera bubble"
                                    >
                                        {webcamDepthBlur ? '✓ Depth Blur' : 'Depth Blur'}
                                    </button>
                                </div>
                            </div>

                            <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--glass-border)' }}></div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <span className="setting-label">Webcam Size</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {[
                                        { label: 'S', val: 0.25 },
                                        { label: 'M', val: 0.40 },
                                        { label: 'L', val: 0.55 }
                                    ].map(s => (
                                        <button key={s.label} onClick={() => setWebcamScale(s.val)}
                                            className={`btn-small ${webcamScale === s.val ? 'active' : ''}`}>
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activePanel === 'mic' && (
                        <div className="setting-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <span className="setting-label">Mic Volume</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <input
                                        type="range" min="0" max="2" step="0.05"
                                        value={micVolume}
                                        onChange={e => setMicVolume(parseFloat(e.target.value))}
                                        style={{ width: '130px', accentColor: 'var(--primary)' }}
                                    />
                                    <span style={{ fontSize: '0.8rem', minWidth: '3.5ch', fontVariantNumeric: 'tabular-nums' }}>
                                        {Math.round(micVolume * 100)}%
                                    </span>
                                    <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)' }}></div>
                                    <button
                                        onClick={() => { toggleMic(); setActivePanel(null); }}
                                        className="btn-danger-minimal"
                                        title="Turn Off Mic"
                                    >Disable</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activePanel === 'bg' && (
                        <div className="setting-group" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: '2rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <span className="setting-label">Aesthetic Gradients</span>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: '0.6rem',
                                    width: 'fit-content'
                                }}>
                                    {BACKGROUND_PRESETS.map(p => (
                                        <button key={p.id}
                                            onClick={() => setActiveBg(p.id)}
                                            className={`btn-icon ${activeBg === p.id ? 'active' : ''}`}
                                            title={p.name}
                                            style={{
                                                background: p.colors ? `linear-gradient(135deg, ${p.colors.join(', ')})` : 'var(--bg-card)',
                                                border: activeBg === p.id ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                                                overflow: 'hidden',
                                                width: '40px',
                                                height: '40px'
                                            }}>
                                            {p.id === 'none' && <span style={{ fontSize: '0.6rem', opacity: 0.8, fontWeight: 700 }}>None</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ width: '1px', height: '120px', background: 'var(--glass-border)', margin: '0 0.5rem' }}></div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', minWidth: '180px' }}>
                                <span className="setting-label">Screen Layout</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {[
                                        { label: 'Full Display', val: 1.0 },
                                        { label: 'Framed View', val: 0.90 },
                                        { label: 'Compact', val: 0.82 }
                                    ].map(s => (
                                        <button key={s.label} onClick={() => setScreenScale(s.val)}
                                            className={`btn-small ${screenScale === s.val ? 'active' : ''}`}
                                            style={{ justifyContent: 'space-between', padding: '0.6rem 1rem', width: '100%' }}>
                                            <span>{s.label}</span>
                                            {screenScale === s.val && <span style={{ fontSize: '0.7rem' }}>✓</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activePanel === 'quality' && (
                        <div className="setting-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <span className="setting-label">Recording Quality</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {Object.entries(qualityPresets).map(([key, val]) => (
                                        <button key={key} onClick={() => setRecordingQuality(key)}
                                            className={`btn-small ${recordingQuality === key ? 'active' : ''}`}>
                                            {val.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activePanel === 'format' && (
                        <div className="setting-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <span className="setting-label">Export Format</span>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {supportedFormats.map(f => (
                                        <button key={f.id} onClick={() => setRecordingFormat(f.id)}
                                            className={`btn-small ${recordingFormat === f.id ? 'active' : ''}`}
                                            title={f.description}>
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                                {currentFormat && (
                                    <span style={{ fontSize: '0.75rem', opacity: 0.55, marginTop: '0.25rem' }}>
                                        {currentFormat.description}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    <button className="popover-close" onClick={() => setActivePanel(null)}>✕</button>
                </div>
            )}

            <div className="control-bar">
                <div className="source-toggles">
                    <button className={`btn-pill ${screenStream ? 'active' : ''}`}
                        onClick={toggleScreen} disabled={isRecording}
                        title="Toggle screen capture">
                        {screenStream ? '● Screen' : 'Screen'}
                    </button>
                    <div className="grid">
                        <button className={`btn-pill ${cameraStream ? 'active' : ''}`}
                            onClick={async () => {
                                if (!cameraStream) {
                                    await toggleCamera();
                                    const streams = await getCameras();
                                    setCameras(streams);
                                    setActivePanel('camera');
                                } else {
                                    togglePanel('camera');
                                }
                            }} disabled={isRecording}
                            title="Toggle webcam">
                            {cameraStream ? '● Camera' : 'Camera'}
                        </button>
                        <button className="dropDownBtn" onClick={() => setShowCameraOptions(!showCameraOptions)}
                            disabled={isRecording} title="Select camera device">
                            <ChevronDown />
                        </button>
                        {showCameraOptions && cameras.length > 0 && (
                            <div className="dropDownMenu" style={{ left: "4rem", height: cameras.length > 2 ? '170px' : 'fit-content', overflowY: cameras.length > 2 ? 'scroll' : 'visible' }}>
                                <div>
                                    {cameras.map(type => (
                                        <button key={type.deviceId} onClick={async () => {
                                            await changeCamera(type.deviceId);
                                            setCameraOption(type.deviceId);
                                        }}
                                            className={`btn-small ${cameraOption === type.deviceId ? 'active' : ''} dropDownElement`}>
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className='grid'>
                        <button className={`btn-pill ${audioStream ? 'active' : ''}`}
                            onClick={async () => {
                                if (!audioStream) {
                                    await toggleMic();
                                    const devices = await navigator.mediaDevices.enumerateDevices();
                                    const audios = devices.filter(device => device.kind === 'audioinput').map(device => ({
                                        label: device.label,
                                        deviceId: device.deviceId,
                                    }));
                                    setMicrophones(audios);
                                } else {
                                    togglePanel('mic');
                                }
                            }} disabled={isRecording}
                            title={audioStream ? 'Mic settings' : 'Toggle microphone'}>
                            {audioStream ? '● Mic' : 'Mic'}
                        </button>
                        <button className="dropDownBtn" onClick={() => setShowMicOptions(!showMicOptions)}
                            disabled={isRecording} title="Select microphone device">
                            <ChevronDown />
                        </button>
                        {showMicOptions && microphones.length > 0 && (
                            <div style={{ height: microphones.length > 2 ? '170px' : 'fit-content', overflowY: microphones.length > 2 ? 'scroll' : 'visible' }} className='dropDownMenu'>
                                <div>
                                    {microphones.map(type => (
                                        <button key={type.deviceId} onClick={async () => {
                                            await changeMic(type.deviceId);
                                            setMicID(type.deviceId);
                                        }}
                                            className={`btn-small ${micID === type.deviceId ? 'active' : ''} dropDownElement`}>
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="vertical-divider" style={{ width: '1px', background: 'var(--glass-border)', margin: '0 0.2rem' }}></div>

                    <button
                        className={`btn-pill ${showAdvanced ? 'active' : ''}`}
                        onClick={() => { setShowAdvanced(v => !v); setActivePanel(null); }}
                        disabled={isRecording}
                        title="Show advanced options"
                    >
                        Advanced {showAdvanced ? '▲' : '▾'}
                    </button>

                    {showAdvanced && (
                        <>
                            <div className="vertical-divider" style={{ width: '1px', background: 'var(--glass-border)', margin: '0 0.2rem' }}></div>
                            <button className={`btn-pill ${activeBg !== 'none' || screenScale !== 1.0 || activePanel === 'bg' ? 'active' : ''}`}
                                onClick={() => togglePanel('bg')} disabled={isRecording}
                                title="Background and layout">
                                {activeBg !== 'none' || screenScale !== 1.0 ? '🎨 Styled' : '🎨 BG'}
                            </button>
                            <div className="vertical-divider" style={{ width: '1px', background: 'var(--glass-border)', margin: '0 0.2rem' }}></div>
                            <button className={`btn-pill ${activePanel === 'format' ? 'active' : ''}`}
                                onClick={() => togglePanel('format')} disabled={isRecording}
                                title={currentFormat?.description || 'Export format'}>
                                🎬 {currentFormat?.label || 'Format'}
                            </button>
                            <div className="vertical-divider" style={{ width: '1px', background: 'var(--glass-border)', margin: '0 0.2rem' }}></div>
                            <button className={`btn-pill ${activePanel === 'quality' ? 'active' : ''}`}
                                onClick={() => togglePanel('quality')} disabled={isRecording}
                                title="Recording quality">
                                ⚙️ {recordingQuality}
                            </button>
                        </>
                    )}
                </div>

                <div className="main-actions">
                    {(screenStream || cameraStream || activeBg !== 'none') && (
                        <>
                            {!isRecording ? (
                                <button className="btn btn-record"
                                    onClick={() => {
                                        setActivePanel(null);
                                        startRecording();
                                    }}
                                    disabled={!screenStream && !cameraStream}>
                                    Start Recording
                                </button>
                            ) : (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <button
                                        className={`btn-pill ${zoomEnabled ? 'active' : ''}`}
                                        onClick={() => setZoomEnabled(z => !z)}
                                        title="Zoom in (Z key) — hover canvas to set focus point"
                                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                                    >
                                        {zoomEnabled ? '⊖ Zoom' : '⊕ Zoom'}
                                    </button>
                                    <button className={`btn ${isPaused ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={isPaused ? resumeRecording : pauseRecording}
                                        style={{ minWidth: '100px', justifyContent: 'center' }}>
                                        {isPaused ? '▶ Resume' : '⏸ Pause'}
                                    </button>
                                    <button className="btn btn-danger"
                                        onClick={stopRecording}>
                                        Stop
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                    <button className="btn-icon-bg" onClick={() => {
                        setActivePanel(null);
                        handleStopAll();
                    }} title="Reset all sources">✕</button>
                </div>
            </div>
        </div>
    );
};
