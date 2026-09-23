'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bookmark, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import type { Restaurant } from '@/lib/types';
import { getCategoryInfo, getImageSrc, getRatingInfo } from '@/lib/utils';
import { isBookmarked, toggleBookmark } from '@/lib/bookmarks';
import { OCCASION_MAP } from '@/lib/types';

export type ViewMode = 'compact' | 'grid';
export default function RestaurantCard({ restaurant: r, viewMode = 'compact' }: { restaurant: Restaurant; viewMode?: ViewMode; index?: number }) {
  const [saved, setSaved] = useState(false);
  const [imageError, setImageError] = useState(false);
  useEffect(() => {
    const update = () => setSaved(isBookmarked(r.id));
    update();
    window.addEventListener('food_hn_bookmarks_updated', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('food_hn_bookmarks_updated', update); window.removeEventListener('storage', update); };
  }, [r.id]);
  const bookmark = () => {
    try {
      const next = toggleBookmark(r.id); setSaved(next);
      toast.success(next ? 'Đã lưu quán trên thiết bị này.' : 'Đã bỏ lưu quán.');
    } catch { toast.error('Không lưu được trên thiết bị này. Kiểm tra quyền lưu trữ của trình duyệt.'); }
  };
  const compact = viewMode === 'compact';
  return <article className={`group relative overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-accent/50 ${compact ? 'p-3' : ''}`}>
    <Link href={`/restaurant/${r.id}`} className={compact ? 'flex gap-3 pr-10' : 'block'}>
      <div className={`relative shrink-0 overflow-hidden bg-secondary ${compact ? 'h-24 w-24 rounded-xl' : 'aspect-[16/10]'}`}>
        <Image src={imageError ? '/placeholder-food.svg' : getImageSrc(r.image_url)} alt="" fill sizes={compact ? '96px' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'} onError={() => setImageError(true)} className="object-cover transition-transform duration-300 group-hover:scale-105" />
      </div>
      <div className={`min-w-0 flex-1 ${compact ? 'py-0.5' : 'p-4'}`}>
        <p className="mb-1 text-xs font-medium text-accent">{getCategoryInfo(r.category).label} · {getRatingInfo(r.rating).label}</p>
        <h2 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">{r.name}</h2>
        <p className="mt-1.5 flex items-start gap-1 text-sm text-text-secondary"><MapPin size={14} className="mt-0.5 shrink-0" /><span className="line-clamp-1">{r.address || r.district || 'Chưa có địa chỉ'}</span></p>
        {r.price && <p className="mt-1 text-sm font-semibold text-foreground">{r.price}</p>}
        {r.occasions?.length ? <p className="mt-1 line-clamp-1 text-xs text-text-muted">{r.occasions.map((occasion) => OCCASION_MAP[occasion]).filter(Boolean).join(' · ')}</p> : null}
        {!compact && r.review && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-text-secondary">{r.review}</p>}
      </div>
    </Link>
    <button type="button" aria-label={`${saved ? 'Bỏ lưu' : 'Lưu'} ${r.name}`} aria-pressed={saved} title="Lưu trên thiết bị này" onClick={bookmark} className={`absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card ${saved ? 'text-accent' : 'text-text-secondary'} hover:bg-secondary`}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'} /></button>
  </article>;
}
