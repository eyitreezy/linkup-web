'use client';

import {
  VIDEO_CAMERA_PRE_PERMISSION,
  VIDEO_NDPR_CONSENT,
} from '@/lib/groupPlan/policySignOffContent';
import { submitDisputeVideo } from '@/lib/groupPlan/annexureB';
import { cn } from '@/utils/cn';
import { useEffect, useRef, useState } from 'react';

type Props = {
  planId: string;
  reportedUserId: string;
  onVideoSubmitted: (disputeId: string) => void;
};

export function VideoEvidenceCapture({ planId, reportedUserId, onVideoSubmitted }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [requestingCamera, setRequestingCamera] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!cameraReady || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
  }, [cameraReady]);

  async function enableCamera() {
    if (requestingCamera || cameraReady) return;
    setRequestingCamera(true);
    setError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = s;
      setCameraReady(true);
    } catch {
      setError('Camera access required to submit video evidence.');
    } finally {
      setRequestingCamera(false);
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    const chunks: BlobPart[] = [];
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mr.ondataavailable = (e) => chunks.push(e.data);
    mr.onstop = () => {
      setRecordedBlob(new Blob(chunks, { type: 'video/webm' }));
    };
    mr.start();
    mediaRecorderRef.current = mr;
    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function handleSubmit() {
    if (!recordedBlob) return;
    setIsSubmitting(true);
    setError('');

    try {
      const position = await new Promise<GeolocationPosition | null>((resolve) =>
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p),
          () => resolve(null),
          { timeout: 5000 }
        )
      );

      const formData = new FormData();
      formData.append('video', recordedBlob, 'dispute-evidence.webm');
      formData.append('plan_id', planId);
      formData.append('reported_user_id', reportedUserId);
      if (position) {
        formData.append('gps_lat', position.coords.latitude.toString());
        formData.append('gps_lng', position.coords.longitude.toString());
      }

      const result = await submitDisputeVideo(formData);
      if (result.error || !result.dispute_id) {
        throw new Error(result.error ?? 'Submission failed');
      }
      onVideoSubmitted(result.dispute_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Video submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="linkup-card space-y-4 p-5">
      <p className="text-[14px] font-semibold leading-relaxed text-muted">
        Record a short video from the meetup location. This is your primary evidence.
      </p>

      <div className="rounded-xl border border-primary/15 bg-[#EDE8FF]/40 p-3">
        <p className="text-[12px] font-semibold leading-relaxed text-muted">
          {VIDEO_CAMERA_PRE_PERMISSION}
        </p>
      </div>

      {!cameraReady ? (
        <button
          type="button"
          onClick={() => void enableCamera()}
          disabled={requestingCamera}
          className="flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50"
        >
          {requestingCamera ? 'Opening camera…' : 'Continue to camera'}
        </button>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="aspect-video w-full rounded-xl bg-gray-900"
        />
      )}

      {error ? <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}

      {cameraReady && !recordedBlob ? (
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            'flex min-h-[44px] w-full items-center justify-center rounded-full px-5 text-[14px] font-extrabold text-white transition hover:opacity-95',
            isRecording ? 'bg-[#EF4444]' : 'linkup-gradient-primary'
          )}
        >
          {isRecording ? 'Stop recording' : 'Start recording'}
        </button>
      ) : null}

      {recordedBlob ? (
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
          className="flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting…' : 'Submit evidence and report no-show'}
        </button>
      ) : null}

      <p className="text-[12px] font-semibold leading-relaxed text-muted">{VIDEO_NDPR_CONSENT}</p>
    </div>
  );
}
