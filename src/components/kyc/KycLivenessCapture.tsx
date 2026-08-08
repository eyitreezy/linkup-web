'use client';

import { cn } from '@/utils/cn';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoCamera, IoClose, IoRefresh, IoVideocam } from 'react-icons/io5';

const MIN_DURATION_SEC = 3;
const MAX_DURATION_SEC = 10;

type Phase = 'idle' | 'preview' | 'countdown' | 'recording' | 'review';

type Props = {
  value: File | null;
  onChange: (file: File | null) => void;
};

export function KycLivenessCapture({ value, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);

  const [phase, setPhase] = useState<Phase>(value ? 'review' : 'idle');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [prompt, setPrompt] = useState<'Look at the camera' | 'Turn your head slightly' | 'Blink'>('Look at the camera');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (phase === 'preview' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [phase]);

  const enableCamera = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      streamRef.current = stream;
      setPhase('preview');
    } catch {
      setError('Allow camera and microphone access to record your verification clip.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => {
      const sec = (Date.now() - startedAtRef.current) / 1000;
      setElapsedSec(sec);
      if (sec < 2) setPrompt('Look at the camera');
      else if (sec < 4) setPrompt('Blink');
      else setPrompt('Turn your head slightly');
      if (sec >= MAX_DURATION_SEC) stopRecording();
    }, 100);
    return () => clearInterval(timer);
  }, [phase]);

  function startCountdown() {
    setCountdown(3);
    let n = 3;
    const t = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(t);
        setCountdown(null);
        beginRecording();
        return;
      }
      setCountdown(n);
    }, 1000);
  }

  function beginRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mr.ondataavailable = (e) => chunksRef.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      if (elapsed < MIN_DURATION_SEC) {
        setError(`Record at least ${MIN_DURATION_SEC} seconds so we can verify liveness.`);
        setPhase('preview');
        return;
      }
      onChange(new File([blob], `liveness-${Date.now()}.webm`, { type: 'video/webm' }));
      setPhase('review');
    };
    mediaRecorderRef.current = mr;
    startedAtRef.current = Date.now();
    setElapsedSec(0);
    setPhase('recording');
    mr.start();
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function reset() {
    onChange(null);
    setError(null);
    setPhase(streamRef.current ? 'preview' : 'idle');
  }

  return (
    <div className="rounded-[18px] border border-transparent bg-white p-[1px] shadow-[0_8px_28px_rgba(42,31,85,0.06)]">
      <div className="rounded-[17px] bg-white p-4">
        <p className="text-[14px] font-extrabold text-foreground">Liveness video</p>
        <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted">
          Record a short selfie video ({MIN_DURATION_SEC} to {MAX_DURATION_SEC} seconds). Look at the camera and turn
          your head slightly in good lighting.
        </p>

        {phase === 'review' && previewUrl ? (
          <video ref={playbackRef} src={previewUrl} controls className="mt-4 aspect-[3/4] w-full rounded-xl border object-cover" />
        ) : (
          <div className="relative mt-4 aspect-[3/4] overflow-hidden rounded-xl border border-border bg-[#0F0D18]">
            {(phase === 'preview' || phase === 'recording' || phase === 'countdown') && (
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover mirror-video" />
            )}
            {phase === 'idle' ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white/80">
                <IoVideocam size={36} />
                <p className="mt-3 text-[13px] font-semibold">Use your front camera for a live verification clip.</p>
              </div>
            ) : null}
            {countdown != null ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-5xl font-extrabold text-white">
                {countdown}
              </div>
            ) : null}
            {phase === 'recording' ? (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="text-center text-[13px] font-extrabold text-white">{prompt}</p>
                <p className="mt-1 text-center text-[12px] font-semibold text-white/80">
                  {Math.ceil(elapsedSec)}s / {MAX_DURATION_SEC}s
                </p>
              </div>
            ) : null}
          </div>
        )}

        {error ? <p className="mt-3 text-[13px] font-semibold text-red-700">{error}</p> : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {phase === 'idle' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void enableCamera()}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full linkup-gradient-primary px-4 text-[13px] font-extrabold text-white disabled:opacity-50"
            >
              <IoCamera size={16} />
              {busy ? 'Starting camera…' : 'Enable camera'}
            </button>
          ) : null}
          {phase === 'preview' ? (
            <button
              type="button"
              onClick={startCountdown}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full linkup-gradient-primary px-4 text-[13px] font-extrabold text-white"
            >
              <IoVideocam size={16} />
              Start recording
            </button>
          ) : null}
          {phase === 'recording' ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-red-600 px-4 text-[13px] font-extrabold text-white"
            >
              Stop
            </button>
          ) : null}
          {phase === 'review' ? (
            <>
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border border-border px-4 text-[13px] font-extrabold"
              >
                <IoRefresh size={16} />
                Retake
              </button>
              <button
                type="button"
                onClick={() => {
                  streamRef.current?.getTracks().forEach((t) => t.stop());
                  streamRef.current = null;
                  setPhase('review');
                }}
                className={cn(
                  'inline-flex min-h-[44px] items-center justify-center rounded-full px-4 text-[13px] font-extrabold',
                  value ? 'bg-emerald-100 text-emerald-800' : 'bg-primary/10 text-primary'
                )}
              >
                Clip ready
              </button>
            </>
          ) : null}
          {phase !== 'idle' && phase !== 'review' ? (
            <button
              type="button"
              onClick={() => {
                streamRef.current?.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
                setPhase('idle');
              }}
              className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full border border-red-200 px-3 text-[13px] font-extrabold text-red-700"
            >
              <IoClose size={16} />
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
