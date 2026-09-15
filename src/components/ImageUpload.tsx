'use client';

import { useRef, useState, useCallback } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

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
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      if (images.length + newUrls.length >= maxImages) break;

      const ext = file.name.split('.').pop();
      const fileName = `${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from('images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (!error) {
        const { data: urlData } = supabase.storage
          .from('images')
          .getPublicUrl(fileName);
        newUrls.push(urlData.publicUrl);
      }
    }

    onChange([...images, ...newUrls]);
    setUploading(false);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [images, onChange, user, folder, maxImages]);

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
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
        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-accent/50 bg-card/50 flex flex-col items-center justify-center gap-1.5 text-text-muted hover:text-accent transition-colors"
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUpload}
        className="hidden"
      />

      <p className="text-[11px] text-text-muted">
        {images.length}/{maxImages} ảnh • Hỗ trợ JPG, PNG, WebP
      </p>
    </div>
  );
}
