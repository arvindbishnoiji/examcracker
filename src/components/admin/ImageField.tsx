'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  CloudUpload,
  Crop,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import { ApiError, uploadAdminDriveImage } from '@/lib/api';
import { isDriveMediaUrl } from '@/lib/validation';
import { useToast } from '@/hooks/useToast';

async function renderSquareCrop(
  file: File,
  zoom: number,
  rotation: number,
  size: number,
  panX = 0,
  panY = 0
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Image cropping is not available in this browser.');
  }
  const radians = (rotation * Math.PI) / 180;
  const rotatedW = Math.abs(bitmap.width * Math.cos(radians)) + Math.abs(bitmap.height * Math.sin(radians));
  const rotatedH = Math.abs(bitmap.width * Math.sin(radians)) + Math.abs(bitmap.height * Math.cos(radians));
  const scale = Math.max(size / rotatedW, size / rotatedH) * zoom;
  const maxPanX = Math.max(0, (rotatedW * scale - size) / (2 * size));
  const maxPanY = Math.max(0, (rotatedH * scale - size) / (2 * size));
  const bx = Math.max(-maxPanX, Math.min(maxPanX, panX));
  const by = Math.max(-maxPanY, Math.min(maxPanY, panY));
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2 + bx * size, size / 2 + by * size);
  ctx.rotate(radians);
  ctx.drawImage(
    bitmap,
    -(bitmap.width * scale) / 2,
    -(bitmap.height * scale) / 2,
    bitmap.width * scale,
    bitmap.height * scale
  );
  bitmap.close();
  const outMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not prepare cropped image.'))),
      outMime,
      0.92
    );
  });
}

export interface ImageFieldProps {
  label?: string;
  help?: string;
  required?: boolean;
  value: string;
  onChange: (nextUrl: string, uploadedAsset?: { displayName: string; mimeType: string }) => void;
  placeholder?: string;
  /** Logical tag stored in D1 drive_media_assets (banner, logo, batch, lecture, badge, etc.) */
  context?: string;
  /** Opens interactive crop/zoom/rotate dialog automatically when true (e.g. square avatars/logos). */
  preferSquareCrop?: boolean;
  /** Compact layout for multi-column forms */
  compact?: boolean;
}

/**
 * Unified Image URL + Google Drive Image Uploader control.
 *
 * Works identically to ProfileAvatar's Google Drive flow (server-verified image
 * bytes, real upload progress %, cancel, retry, optional square crop/zoom/rotate),
 * while producing a clean `/api/ec/media/<id>` URL (or accepting any pasted URL).
 */
export function ImageField({
  label,
  help,
  required,
  value,
  onChange,
  placeholder = 'https://… (or upload to Google Drive below)',
  context = 'general',
  preferSquareCrop = false,
  compact = false,
}: ImageFieldProps) {
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const [justUploaded, setJustUploaded] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Optional square crop modal state (matches ProfileAvatar)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropRotation, setCropRotation] = useState(0);
  const [cropPan, setCropPan] = useState({ x: 0, y: 0 });
  const [preparingCrop, setPreparingCrop] = useState(false);
  const dragPanRef = useRef<{ pointerId: number; startX: number; startY: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    if (!justUploaded) return;
    const t = window.setTimeout(() => setJustUploaded(false), 2600);
    return () => window.clearTimeout(t);
  }, [justUploaded]);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    if (!cropOpen || !pendingFile) {
      setCropPreviewUrl(null);
      return;
    }
    setPreparingCrop(true);
    renderSquareCrop(pendingFile, cropZoom, cropRotation, 320, cropPan.x, cropPan.y)
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setCropPreviewUrl(createdUrl);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not render crop preview.');
      })
      .finally(() => {
        if (!cancelled) setPreparingCrop(false);
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [cropOpen, pendingFile, cropZoom, cropRotation, cropPan]);

  const startDriveUpload = useCallback(
    async (file: File) => {
      setRetryFile(null);
      setError(null);
      setProgress(0);
      setUploading(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await uploadAdminDriveImage(file, {
          context,
          displayName: file.name,
          signal: controller.signal,
          onProgress: setProgress,
        });
        onChange(response.item.url, {
          displayName: response.item.displayName,
          mimeType: response.item.mimeType,
        });
        setPendingFile(null);
        setJustUploaded(true);
        push('Image uploaded to Google Drive!', 'success');
      } catch (uploadErr) {
        if (controller.signal.aborted) {
          setUploading(false);
          return;
        }
        const message =
          uploadErr instanceof ApiError
            ? uploadErr.message
            : uploadErr instanceof Error
              ? uploadErr.message
              : 'Google Drive upload failed.';
        setError(message);
        setRetryFile(file);
        push(message, 'error');
      } finally {
        setUploading(false);
        abortRef.current = null;
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [context, onChange, push]
  );

  function handleSelectedFile(file: File | undefined | null) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      const msg = 'Choose a JPEG, PNG, WebP or GIF image.';
      setError(msg);
      push(msg, 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      const msg = 'Image must be 8 MB or smaller.';
      setError(msg);
      push(msg, 'error');
      return;
    }
    setError(null);
    setPendingFile(file);
    if (preferSquareCrop && file.type !== 'image/gif') {
      setCropZoom(1);
      setCropRotation(0);
      setCropPan({ x: 0, y: 0 });
      setCropOpen(true);
    } else {
      void startDriveUpload(file);
    }
  }

  async function confirmCroppedUpload() {
    if (!pendingFile) return;
    setPreparingCrop(true);
    try {
      const ext = pendingFile.type === 'image/png' ? 'png' : 'jpg';
      const mime = pendingFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const blob = await renderSquareCrop(pendingFile, cropZoom, cropRotation, 512, cropPan.x, cropPan.y);
      const croppedFile = new File([blob], `cropped-${Date.now()}.${ext}`, { type: mime });
      setCropOpen(false);
      await startDriveUpload(croppedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop image.');
    } finally {
      setPreparingCrop(false);
    }
  }

  function cancelUpload() {
    abortRef.current?.abort();
    setUploading(false);
    setRetryFile(null);
    setError(null);
  }

  const trimmed = (value || '').trim();
  const fromDrive = isDriveMediaUrl(trimmed);

  return (
    <div className="w-full">
      {label ? (
        <label className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-ink-700">
          <span>
            {label}
            {required ? <span className="ml-0.5 text-red-500">*</span> : null}
          </span>
          {fromDrive ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              <Check size={10} /> Google Drive
            </span>
          ) : null}
        </label>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleSelectedFile(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-2xl border p-2.5 transition ${
          dragOver
            ? 'border-brand-500 bg-brand-50/60'
            : 'border-ink-200/90 bg-ink-50/35'
        }`}
      >
        {/* URL INPUT ROW */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            className="ec-field !bg-[var(--ec-surface)] text-xs"
            value={value}
            required={required}
            placeholder={placeholder}
            onChange={(event) => {
              setError(null);
              onChange(event.target.value);
            }}
          />
          {trimmed ? (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Clear image"
              title="Remove image"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-ink-200 bg-[var(--ec-surface)] text-ink-500 hover:border-red-200 hover:text-red-600"
            >
              <Trash2 size={13} />
            </button>
          ) : null}
        </div>

        {/* OR GOOGLE DRIVE UPLOAD BAR */}
        <div className={`mt-2 flex flex-wrap items-center justify-between gap-2 ${compact ? '' : 'pt-0.5'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-ink-200/70 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-600">
              OR
            </span>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              aria-label={label ? `Upload ${label} to Google Drive` : 'Upload image to Google Drive'}
              disabled={uploading}
              onChange={(event) => {
                handleSelectedFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />

            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-[var(--ec-surface)] px-3 py-1.5 text-xs font-bold text-brand-700 shadow-2xs transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-55"
            >
              <CloudUpload size={14} />
              {uploading ? `Uploading ${progress}%…` : trimmed ? 'Replace via Google Drive' : 'Upload Image (Google Drive)'}
            </button>

            {retryFile && !uploading && retryFile.type !== 'image/gif' ? (
              <button
                type="button"
                onClick={() => {
                  setPendingFile(retryFile);
                  setCropOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-[var(--ec-surface)] px-2.5 py-1.5 text-[11px] font-semibold text-ink-700 hover:bg-ink-50"
              >
                <Crop size={12} /> Crop
              </button>
            ) : null}

            {uploading ? (
              <button
                type="button"
                onClick={cancelUpload}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:underline"
              >
                <X size={12} /> Cancel
              </button>
            ) : null}

            {!uploading && retryFile ? (
              <button
                type="button"
                onClick={() => void startDriveUpload(retryFile)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:underline"
              >
                <RefreshCw size={12} /> Retry
              </button>
            ) : null}
          </div>

          {/* LIVE THUMBNAIL PREVIEW */}
          {trimmed ? (
            <div className="flex items-center gap-2">
              {justUploaded ? (
                <span className="text-[10.5px] font-bold text-emerald-700">Saved ✓</span>
              ) : null}
              <div className="h-9 w-14 overflow-hidden rounded-lg border border-ink-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={trimmed}
                  alt="Preview"
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.opacity = '0.2';
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* PROGRESS BAR (MATCHES PROFILE PHOTO UPLOADER) */}
        {uploading ? (
          <div className="mt-2">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full bg-brand-600 transition-all"
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>
            <p className="mt-1 text-[10.5px] text-ink-500">Uploading to Google Drive… {progress}%</p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-1.5 text-[11px] font-medium text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      {help ? <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{help}</p> : null}

      {/* SQUARE CROP / ZOOM / ROTATE MODAL (IDENTICAL UX TO PROFILE PHOTO) */}
      {cropOpen && pendingFile ? (
        <div
          className="fixed inset-0 z-[115] grid place-items-center bg-slate-950/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCropOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Adjust uploaded image"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-ink-900">Frame Image Before Upload</h3>
                <p className="mt-0.5 text-xs text-ink-500">
                  Drag to position, zoom or rotate — or click <strong>Upload Full Size</strong> to keep original shape.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close crop dialog"
                onClick={() => setCropOpen(false)}
                className="rounded-full p-1.5 text-ink-500 hover:bg-ink-100"
              >
                <X size={16} />
              </button>
            </div>

            <div
              className="mx-auto mt-4 grid h-60 w-60 touch-none cursor-grab place-items-center overflow-hidden rounded-2xl bg-ink-100 ring-4 ring-brand-100 active:cursor-grabbing"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragPanRef.current = {
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  panX: cropPan.x,
                  panY: cropPan.y,
                };
              }}
              onPointerMove={(event) => {
                const drag = dragPanRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                if (!bounds.width || !bounds.height) return;
                setCropPan({
                  x: drag.panX + (event.clientX - drag.startX) / bounds.width,
                  y: drag.panY + (event.clientY - drag.startY) / bounds.height,
                });
              }}
              onPointerUp={(event) => {
                if (dragPanRef.current?.pointerId === event.pointerId) dragPanRef.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
            >
              {cropPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cropPreviewUrl}
                  alt=""
                  draggable={false}
                  className="pointer-events-none h-full w-full select-none object-cover"
                />
              ) : (
                <span className="text-xs text-ink-500">Preparing preview…</span>
              )}
            </div>

            <label className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-ink-700">
              <ZoomIn size={14} /> Zoom
            </label>
            <input
              type="range"
              min="1"
              max="2.5"
              step="0.05"
              value={cropZoom}
              onChange={(event) => setCropZoom(Number(event.target.value))}
              className="mt-1.5 w-full accent-violet-600"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setCropRotation((r) => (r + 270) % 360)}
                  aria-label="Rotate counterclockwise"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 hover:bg-ink-50"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setCropRotation((r) => (r + 90) % 360)}
                  aria-label="Rotate clockwise"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 hover:bg-ink-50"
                >
                  <RotateCw size={14} />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={uploading || preparingCrop}
                  onClick={() => {
                    const raw = pendingFile;
                    setCropOpen(false);
                    if (raw) void startDriveUpload(raw);
                  }}
                  className="rounded-xl border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                >
                  Upload Full Size
                </button>
                <button
                  type="button"
                  disabled={uploading || preparingCrop || !cropPreviewUrl}
                  onClick={() => void confirmCroppedUpload()}
                  className="rounded-xl bg-brand-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-55"
                >
                  Upload Square Crop
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
