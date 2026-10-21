'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, RefreshCw, RotateCcw, RotateCw, X, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { fetchAuthorizedBlob, uploadProfilePhoto, ApiError } from '@/lib/api';
import type { StudentProfile } from '@/types';

async function renderCrop(file: File, zoom: number, rotation: number, size: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Photo editing is not supported in this browser.');
  }
  const radians = (rotation * Math.PI) / 180;
  const rotatedWidth = Math.abs(bitmap.width * Math.cos(radians)) + Math.abs(bitmap.height * Math.sin(radians));
  const rotatedHeight = Math.abs(bitmap.width * Math.sin(radians)) + Math.abs(bitmap.height * Math.cos(radians));
  const scale = Math.max(size / rotatedWidth, size / rotatedHeight) * zoom;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.translate(size / 2, size / 2);
  context.rotate(radians);
  context.drawImage(bitmap, -(bitmap.width * scale) / 2, -(bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not prepare the cropped photo.')), 'image/jpeg', 0.92);
  });
  return blob;
}

function initialsOf(name: string): string {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return initials || 'S';
}

/**
 * Profile photo control.
 *
 * Drive files are private, so an <img src> pointing at the API would fail: the
 * bearer token cannot be attached to an image request. Instead the bytes are
 * fetched with the Firebase Authorization header and rendered from an object
 * URL, which is revoked when the component unmounts or the photo changes.
 */
export function ProfileAvatar({
  profile,
  size = 'lg',
  onUpdated,
}: {
  profile: StudentProfile;
  size?: 'sm' | 'md' | 'lg';
  onUpdated?: (profile: StudentProfile) => void;
}) {
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropRotation, setCropRotation] = useState(0);
  const [preparingCrop, setPreparingCrop] = useState(false);
  const cropPreviewRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const dimension = size === 'lg' ? 'h-20 w-20 text-2xl' : size === 'md' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-xs';

  const revoke = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhotoError(false);
    if (!profile.avatar_url) {
      setPhotoUrl((current) => {
        revoke(current);
        return null;
      });
      return () => {
        cancelled = true;
      };
    }
    fetchAuthorizedBlob(profile.avatar_url)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPhotoUrl((current) => {
          revoke(current);
          return url;
        });
      })
      .catch(() => {
        if (!cancelled) setPhotoError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [profile.avatar_url, revoke]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (cropPreviewRef.current) URL.revokeObjectURL(cropPreviewRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    objectUrlRef.current = photoUrl;
  }, [photoUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!cropFile) {
      if (cropPreviewRef.current) URL.revokeObjectURL(cropPreviewRef.current);
      cropPreviewRef.current = null;
      setCropPreviewUrl(null);
      return;
    }
    setPreparingCrop(true);
    renderCrop(cropFile, cropZoom, cropRotation, 320)
      .then((blob) => {
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        if (cropPreviewRef.current) URL.revokeObjectURL(cropPreviewRef.current);
        cropPreviewRef.current = next;
        setCropPreviewUrl(next);
      })
      .catch((cropError: unknown) => {
        if (!cancelled) setError(cropError instanceof Error ? cropError.message : 'Could not preview this photo.');
      })
      .finally(() => { if (!cancelled) setPreparingCrop(false); });
    return () => { cancelled = true; };
  }, [cropFile, cropZoom, cropRotation]);

  useEffect(() => {
    if (!justSaved) return;
    const handle = window.setTimeout(() => setJustSaved(false), 2600);
    return () => window.clearTimeout(handle);
  }, [justSaved]);

  const startUpload = useCallback(
    async (file: File) => {
      setRetryFile(null);
      setError(null);
      setProgress(0);
      setUploading(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl((current) => {
        revoke(current);
        return localPreview;
      });
      try {
        const result = await uploadProfilePhoto(file, {
          signal: controller.signal,
          onProgress: setProgress,
        });
        revoke(localPreview);
        setPreviewUrl(null);
        setJustSaved(true);
        push(
          result.warnings && result.warnings.length > 0
            ? `Profile photo updated. ${result.warnings[0]}`
            : 'Profile photo updated.',
          'success'
        );
        onUpdated?.(result.profile);
      } catch (uploadError) {
        revoke(localPreview);
        setPreviewUrl(null);
        if (controller.signal.aborted) {
          setUploading(false);
          return;
        }
        const message =
          uploadError instanceof ApiError
            ? uploadError.message
            : uploadError instanceof Error
              ? uploadError.message
              : 'The photo upload failed.';
        setError(message);
        setRetryFile(file);
        push(message, 'error');
      } finally {
        setUploading(false);
        abortRef.current = null;
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [onUpdated, push, revoke]
  );

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPEG, PNG or WebP photo.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photos must be 5 MB or smaller.');
      return;
    }
    setError(null);
    setCropZoom(1);
    setCropRotation(0);
    setCropFile(file);
  }

  async function confirmCrop() {
    if (!cropFile) return;
    setPreparingCrop(true);
    try {
      const blob = await renderCrop(cropFile, cropZoom, cropRotation, 512);
      setCropFile(null);
      await startUpload(new File([blob], 'profile-photo.jpg', { type: 'image/jpeg', lastModified: Date.now() }));
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : 'Could not prepare this photo.');
      setPreparingCrop(false);
    }
  }

  function cancelCrop() {
    setCropFile(null);
    setCropZoom(1);
    setCropRotation(0);
    if (inputRef.current) inputRef.current.value = '';
  }

  function cancelUpload() {
    abortRef.current?.abort();
    setRetryFile(null);
    setError(null);
    setUploading(false);
    setPreviewUrl((current) => {
      revoke(current);
      return null;
    });
  }

  const shown = previewUrl || photoUrl;

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="relative">
        <span className={`ec-avatar overflow-hidden ${dimension}`} aria-hidden={Boolean(shown)}>
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt={`${profile.display_name} profile photo`}
              className="h-full w-full object-cover"
              onError={() => {
                setPhotoError(true);
                setPhotoUrl((current) => {
                  revoke(current);
                  return null;
                });
              }}
            />
          ) : (
            initialsOf(profile.display_name)
          )}
        </span>
        {justSaved && (
          <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white shadow">
            <Check size={13} />
          </span>
        )}
      </div>

      {cropFile && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) cancelCrop(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="photo-editor-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="photo-editor-title" className="text-lg font-extrabold text-ink-900">Edit profile photo</h2>
                <p className="mt-1 text-xs text-ink-500">Adjust the square crop with zoom, then rotate if needed.</p>
              </div>
              <button type="button" aria-label="Cancel photo editing" onClick={cancelCrop} className="rounded-full p-2 text-ink-500 hover:bg-ink-100"><X size={18} /></button>
            </div>
            <div className="mx-auto mt-4 grid h-64 w-64 place-items-center overflow-hidden rounded-2xl bg-ink-100 ring-4 ring-brand-100">
              {cropPreviewUrl ? <img src={cropPreviewUrl} alt="Cropped photo preview" className="h-full w-full object-cover" /> : <span className="text-xs text-ink-500">Preparing preview…</span>}
            </div>
            <label className="mt-4 block text-xs font-semibold text-ink-700" htmlFor="photo-zoom"><span className="flex items-center gap-1.5"><ZoomIn size={14} /> Zoom</span></label>
            <input id="photo-zoom" type="range" min="1" max="2.5" step="0.05" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} className="mt-2 w-full accent-violet-600" />
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setCropRotation((value) => (value + 270) % 360)} aria-label="Rotate counterclockwise"><RotateCcw size={14} /></Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setCropRotation((value) => (value + 90) % 360)} aria-label="Rotate clockwise"><RotateCw size={14} /></Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setCropZoom(1); setCropRotation(0); }}>Reset</Button>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={cancelCrop}>Cancel</Button>
                <Button type="button" size="sm" loading={preparingCrop || uploading} disabled={!cropPreviewUrl || preparingCrop || uploading} onClick={() => void confirmCrop()}>Use photo</Button>
              </div>
            </div>
          </section>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Choose a profile photo"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Camera size={13} className="mr-1.5" />
          {profile.avatar_url ? 'Change photo' : 'Add photo'}
        </Button>
        {uploading && (
          <button type="button" onClick={cancelUpload} className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:underline">
            <X size={12} /> Cancel
          </button>
        )}
        {!uploading && retryFile && (
          <button
            type="button"
            onClick={() => retryFile && void startUpload(retryFile)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:underline"
          >
            <RefreshCw size={12} /> Retry
          </button>
        )}
      </div>

      {uploading && (
        <div className="w-full max-w-[220px]">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Profile photo upload progress"
          >
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${Math.max(4, progress)}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-ink-500">Uploading to Google Drive… {progress}%</p>
        </div>
      )}

      {!uploading && error && (
        <p role="alert" className="max-w-[260px] text-[11px] font-medium text-red-700">
          {error}
        </p>
      )}
      {!uploading && !error && photoError && (
        <p className="max-w-[260px] text-[11px] text-amber-700">
          Your saved photo could not be loaded. You can upload it again.
        </p>
      )}
      {!uploading && !error && !photoError && (
        <p className="max-w-[260px] text-[10px] text-ink-400">JPEG, PNG or WebP · up to 5 MB · stored privately in Google Drive.</p>
      )}
    </div>
  );
}
