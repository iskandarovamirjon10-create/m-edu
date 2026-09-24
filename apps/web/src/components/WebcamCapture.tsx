import { useEffect, useRef, useState, useCallback} from'react';
import { toBase64} from'@/lib/format';
import { useSafeI18n } from '@/i18n/I18nProvider';

// Reusable webcam capture component.
// Security: captured frames are sent directly to the API as base64;
// they are never persisted in browser storage.

type CaptureMode ='camera' |'upload';

interface WebcamCaptureProps {
  onCapture: (base64: string) => void;
  busy?: boolean;
  label?: string;
}

export function WebcamCapture({
  onCapture,
  busy = false,
  label ='Capture',
}: WebcamCaptureProps) {
  const { t} = useSafeI18n();
 const videoRef = useRef<HTMLVideoElement>(null);
 const streamRef = useRef<MediaStream | null>(null);
 const canvasRef = useRef<HTMLCanvasElement | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const [active, setActive] = useState(false);
 const [error, setError] = useState('');
 const [mode, setMode] = useState<CaptureMode>('camera');
 const [isStarting, setIsStarting] = useState(false);

 const stop = useCallback(() => {
 streamRef.current?.getTracks().forEach((track) => track.stop());
 streamRef.current = null;
 setActive(false);
}, []);

 const start = useCallback(async () => {
 setError('');
 setIsStarting(true);

 try {
 if (!navigator.mediaDevices?.getUserMedia) {
 throw new Error('Camera API not supported');
}

 const stream = await navigator.mediaDevices.getUserMedia({
 video: {
 facingMode:'user',
 width: { ideal: 640},
 height: { ideal: 480},
},
 audio: false,
});

 streamRef.current = stream;

 if (videoRef.current) {
 videoRef.current.srcObject = stream;
 await videoRef.current.play();
}

 setActive(true);
} catch {
 setError(
'Camera unavailable. Use "Upload image"instead, or allow camera access.',
 );
} finally {
 setIsStarting(false);
}
}, []);

 // Cleanup on unmount
 useEffect(() => {
 return () => {
 stop();
};
}, [stop]);

 const capture = useCallback(() => {
 const video = videoRef.current;
 if (!video || !video.videoWidth) return;

 if (!canvasRef.current) {
 canvasRef.current = document.createElement('canvas');
}

 const canvas = canvasRef.current;
 canvas.width = video.videoWidth;
 canvas.height = video.videoHeight;

 const ctx = canvas.getContext('2d');
 if (!ctx) return;

 ctx.drawImage(video, 0, 0);
 onCapture(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
}, [onCapture]);

 const handleFileChange = useCallback(
 async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 setError('');

 try {
 const base64 = await toBase64(file);
 onCapture(base64);
} catch {
 setError('Failed to read the selected image. Please try another file.');
} finally {
 // Reset input so the same file can be selected again
 e.target.value ='';
}
},
 [onCapture],
 );

 const handleModeToggle = useCallback(() => {
 setMode((prev) => (prev ==='camera' ?'upload' :'camera'));
 stop();
 setError('');
}, [stop]);

 const handleUploadClick = useCallback(() => {
 fileInputRef.current?.click();
}, []);

 return (
 <div>
 {/* Preview area */}
 <div
 className="relative overflow-hidden rounded-xl"
 style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)'}}
 >
 {active && mode ==='camera' ? (
 <video
 ref={videoRef}
 className="h-64 w-full object-contain"
 muted
 playsInline
 aria-label={t('a11y.cameraPreview')}
 />
 ) : mode ==='upload' ? (
 <div className="flex h-64 w-full items-center justify-center">
 <button
 type="button"
 className="cursor-pointer rounded-lg px-4 py-3 text-sm transition-colors"
 style={{
 background:'rgba(84,115,252,0.10)',
 color:'var(--m-vivid)',
 border:'1px solid rgba(84,115,252,0.22)',
}}
 onClick={handleUploadClick}
 disabled={busy}
 >
 Choose image…
 </button>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 className="hidden"
 onChange={handleFileChange}
 disabled={busy}
 />
 </div>
 ) : (
 <div className="flex h-64 w-full items-center justify-center">
 <div className="text-center">
 <svg
 className="mx-auto h-12 w-12"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.5"
 style={{ color:'var(--text-muted)'}}
 aria-hidden="true"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 d="M6.827 6.175A2.31 2.31 0 015.322 4.02 2.31 2.31 0 016.827 1.865a2.31 2.31 0 012.155 2.155c.02.23.02.46 0 .69M6.827 6.175c.54.54 1.17.99 1.86 1.335M6.827 6.175a2.31 2.31 0 00-2.155 2.155m2.155-2.155v4.96m0 0a2.31 2.31 0 002.155 2.155m-2.155-2.155v-4.96m0 0a2.31 2.31 0 00-2.155-2.155m4.31 4.31a2.31 2.31 0 002.155 2.155m0 0a2.31 2.31 0 002.155-2.155m-2.155 2.155v-4.96m0 0a2.31 2.31 0 00-2.155-2.155m2.155 2.155c.54-.54 1.17-.99 1.86-1.335m-4.015 4.015v4.96a2.31 2.31 0 002.155 2.155m0 0a2.31 2.31 0 002.155-2.155m-2.155 2.155v-4.96m0 0a2.31 2.31 0 00-2.155-2.155m2.155 2.155c.54.54 1.17.99 1.86 1.335M15 5.25a3 3 0 11-6 0 3 3 0 016 0zm-7.5 14.25v-1.5a4.5 4.5 0 019 0v1.5"
 />
 </svg>
 <p className="mt-2 text-sm"style={{ color:'var(--text-muted)'}}>
 Camera preview
 </p>
 </div>
 </div>
 )}

 {/* Processing overlay */}
 {busy && (
 <div
 className="absolute inset-0 flex items-center justify-center backdrop-blur-sm"
 style={{ background:'rgba(15,25,45,0.50)'}}
 >
 <div className="flex flex-col items-center gap-2">
 <svg
 className="h-8 w-8 animate-spin"
 viewBox="0 0 24 24"
 fill="none"
 aria-hidden="true"
 style={{ color:'var(--m-vivid)'}}
 >
 <circle
 className="opacity-25"
 cx="12"
 cy="12"
 r="10"
 stroke="currentColor"
 strokeWidth="4"
 />
 <path
 className="opacity-75"
 fill="currentColor"
 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
 />
 </svg>
 <span className="text-sm"style={{ color:'var(--text-primary)'}}>Processing…</span>
 </div>
 </div>
 )}
 </div>

 {/* Error message */}
 {error && (
 <div
 className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
 style={{
 background:'rgba(240,112,112,0.08)',
 color:'var(--state-error)',
 border:'1px solid rgba(240,112,112,0.20)',
}}
 role="alert"
 >
 <svg
 className="mt-0.5 h-4 w-4 shrink-0"
 viewBox="0 0 24 24"
 fill="currentColor"
 aria-hidden="true"
 >
 <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.25 1.25 0 0 1 1.25 1.25v5a1.25 1.25 0 0 1-2.5 0v-5A1.25 1.25 0 0 1 12 7Zm0 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/>
 </svg>
 <span>{error}</span>
 </div>
 )}

 {/* Controls */}
 <div className="mt-3 flex flex-wrap items-center gap-2">
 {!active || mode ==='upload' ? (
 <button
 type="button"
 className="btn-primary"
 onClick={mode ==='upload' ? handleUploadClick : start}
 disabled={busy || isStarting}
 >
 {isStarting
 ?'Starting camera…'
 : mode ==='upload'
 ?'Choose image'
 :'Start camera'}
 </button>
 ) : (
 <>
 <button
 type="button"
 className="btn-primary"
 onClick={capture}
 disabled={busy}
 >
 {busy ?'Processing…' : label}
 </button>
 <button
 type="button"
 className="btn-secondary"
 onClick={stop}
 disabled={busy}
 >
 Stop camera
 </button>
 </>
 )}

 <button
 type="button"
 className="btn-secondary"
 onClick={handleModeToggle}
 disabled={busy || isStarting}
 >
 {mode ==='camera' ?'Upload image' :'Use camera'}
 </button>
 </div>
 </div>
 );
}