'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { ImagePlus, X, Loader2, ClipboardPaste, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  folder?: string;
}

export default function ImageUpload({
  images,
  onChange,
  maxImages = 5,
  folder = 'restaurants',
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Core upload logic — works with any File array
  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      // Filter only images
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        setUploadError('Chỉ hỗ trợ file ảnh (JPG, PNG, WebP, GIF)');
        return;
      }

      setUploading(true);
      setUploadError(null);
      const newUrls: string[] = [];

      for (const file of imageFiles) {
        if (images.length + newUrls.length >= maxImages) break;

        // Build a safe filename (file.name may be empty for pasted images)
        const mimeToExt: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
          'image/gif': 'gif',
          'image/avif': 'avif',
        };
        const ext =
          file.name?.split('.').pop() ||
          mimeToExt[file.type] ||
          'png';

        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error } = await supabase.storage
          .from('images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'image/png',
          });

        if (error) {
          console.error('[ImageUpload] Supabase storage error:', error);
          setUploadError(`Lỗi upload: ${error.message}`);
          setUploading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('images')
          .getPublicUrl(fileName);
        newUrls.push(urlData.publicUrl);
      }

      onChange([...images, ...newUrls]);
      setUploading(false);
    },
    [images, onChange, folder, maxImages]
  );

  // File input change
  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      await uploadFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [uploadFiles]
  );

  // Paste from clipboard (Ctrl+V anywhere on the page)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (images.length >= maxImages || uploading) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageFiles = items
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (imageFiles.length > 0) {
        e.preventDefault();
        await uploadFiles(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [uploadFiles, images.length, maxImages, uploading]);

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      await uploadFiles(files);
    },
    [uploadFiles]
  );

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-3">
      {/* Drop zone wrapper */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-xl transition-all duration-200 ${
          isDragging
            ? 'ring-2 ring-accent ring-offset-2 ring-offset-card bg-accent/5'
            : ''
        }`}
      >
        {/* Drag overlay hint */}
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-accent/10 border-2 border-dashed border-accent pointer-events-none">
            <div className="text-center">
              <ImagePlus size={28} className="mx-auto text-accent mb-1" />
              <p className="text-xs font-semibold text-accent">Thả ảnh vào đây</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {/* Existing images */}
          {images.map((url, i) => (
            <div key={url} className="relative aspect-square rounded-xl overflow-hidden group">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${url})` }}
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent-red"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {/* Upload button */}
          {canAddMore && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-accent/50 bg-card/50 flex flex-col items-center justify-center gap-1.5 text-text-muted hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <>
                  <ImagePlus size={24} />
                  <span className="text-[10px] font-medium">Thêm ảnh</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Error message */}
      {uploadError && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-accent-red/10 border border-accent-red/25 text-accent-red text-xs">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Hint text */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-text-muted">
          {images.length}/{maxImages} ảnh • JPG, PNG, WebP
        </p>
        {canAddMore && !uploading && (
          <p className="text-[11px] text-text-muted flex items-center gap-1">
            <ClipboardPaste size={11} />
            <span>Ctrl+V để dán ảnh</span>
          </p>
        )}
      </div>
    </div>
  );
}
