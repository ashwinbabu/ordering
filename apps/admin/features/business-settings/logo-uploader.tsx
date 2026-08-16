"use client";

import { LoaderCircle, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  deleteBusinessLogo,
  uploadBusinessLogo,
} from "@/features/business-settings/api/business-settings-api";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

interface CroppedLogo {
  blob: Blob;
  extension: string;
}

/** Center-crops to a square so every uploaded logo ends up 1:1, whatever its source aspect ratio. */
async function cropImageToSquare(file: File): Promise<CroppedLogo> {
  const bitmap = await createImageBitmap(file);
  const size = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - size) / 2;
  const sy = (bitmap.height - size) / 2;
  const targetSize = Math.min(size, 512);

  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not process the image.");
  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, targetSize, targetSize);

  const useJpeg = file.type === "image/jpeg";
  const mimeType = useJpeg ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, 0.92),
  );
  if (!blob) throw new Error("This browser could not process the image.");
  return { blob, extension: useJpeg ? "jpg" : "png" };
}

interface LogoUploaderProps {
  businessId: string;
  logoUrl: string | null;
  fallback: React.ReactNode;
  onChange: (logoUrl: string | null) => void;
  onSaved: () => void;
}

export function LogoUploader({
  businessId,
  logoUrl,
  fallback,
  onChange,
  onSaved,
}: LogoUploaderProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    if (!ACCEPTED_TYPES.has(file.type)) {
      setError("Please choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("Logo must be smaller than 5MB.");
      return;
    }
    setBusy(true);
    try {
      const { blob, extension } = await cropImageToSquare(file);
      const nextLogoUrl = await uploadBusinessLogo(businessId, blob, extension);
      onChange(nextLogoUrl);
      onSaved();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload the logo.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    setError("");
    setBusy(true);
    try {
      await deleteBusinessLogo(businessId);
      onChange(null);
      onSaved();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not remove the logo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="logo-uploader">
      <div className="logo-uploader-preview">
        {logoUrl ? <img src={logoUrl} alt="Business logo" /> : fallback}
      </div>
      <div className="logo-uploader-controls">
        <div className="logo-uploader-buttons">
          <button
            type="button"
            className="secondary-button compact-button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Upload size={15} />
            )}
            {logoUrl ? "Change logo" : "Upload logo"}
          </button>
          {logoUrl && (
            <button
              type="button"
              className="destructive-link"
              disabled={busy}
              onClick={() => {
                void handleDelete();
              }}
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <small>
          Only 1:1 (square) logos are accepted — other aspect ratios are
          auto-cropped to a centered square. PNG, JPEG, or WebP, up to 5MB.
        </small>
        {error && <p className="field-error">{error}</p>}
      </div>
    </div>
  );
}
