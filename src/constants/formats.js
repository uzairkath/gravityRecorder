/**
 * Supported export formats for MediaRecorder
 */
export const EXPORT_FORMATS = [
    {
        id: 'mp4-h264',
        label: 'MP4',
        description: 'H.264 — hardware accelerated, best compatibility',
        mimeType: 'video/mp4;codecs=h264,aac',
        ext: '.mp4'
    },
    {
        id: 'mp4-generic',
        label: 'MP4 std',
        description: 'Standard MP4 — broad device support',
        mimeType: 'video/mp4',
        ext: '.mp4'
    },
    {
        id: 'webm-vp9',
        label: 'WebM VP9',
        description: 'VP9 — high compression, smaller file size',
        mimeType: 'video/webm;codecs=vp9,opus',
        ext: '.webm'
    },
    {
        id: 'webm-vp8',
        label: 'WebM VP8',
        description: 'VP8 — fast encoding, good performance',
        mimeType: 'video/webm;codecs=vp8,opus',
        ext: '.webm'
    },
    {
        id: 'mkv-vp9',
        label: 'MKV',
        description: 'Matroska VP9 — open format, lossless-friendly',
        mimeType: 'video/x-matroska;codecs=vp9,opus',
        ext: '.mkv'
    }
];

/**
 * Returns a list of formats supported by the current browser
 */
export const getSupportedFormats = () => {
    if (typeof MediaRecorder === 'undefined') return [];
    return EXPORT_FORMATS.filter(f => MediaRecorder.isTypeSupported(f.mimeType));
};

/**
 * Gets the best default format (picks WebM VP9 or VP8 if available)
 */
export const getDefaultFormat = () => {
    const supported = getSupportedFormats();
    if (supported.length === 0) return null;
    return supported[0].id;
};
