'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { fetchAuthorizedBlob, uploadProfilePhoto, ApiError } from '@/lib/api';
import type { StudentProfile } from '@/types';

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    objectUrlRef.current = photoUrl;
  }, [photoUrl]);

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
    void startUpload(file);
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
