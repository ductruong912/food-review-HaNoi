'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Tag, ArrowUpRight, MessageSquareQuote, Bookmark } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import type { Restaurant } from '@/lib/types';
import { getRatingInfo, getCategoryInfo, getImageSrc } from '@/lib/utils';
import { CategoryIcon, RatingIcon } from '@/components/Icons';
import { isBookmarked, toggleBookmark } from '@/lib/bookmarks';
import { toast } from 'sonner';

export type ViewMode = 'compact' | 'grid';

interface RestaurantCardProps {
  restaurant: Restaurant;
  index?: number;
  viewMode?: ViewMode;
}

export default function RestaurantCard({
  restaurant,
  index = 0,
  viewMode = 'compact',
}: RestaurantCardProps) {
  const [imgError, setImgError] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isBookmarked(restaurant.id));

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ updated: string[]; id: string }>;
      if (customEvent.detail?.id === restaurant.id) {
        setSaved(customEvent.detail.updated.includes(restaurant.id));
      }
    };

    window.addEventListener('food_hn_bookmarks_updated', handleUpdate);
    return () => window.removeEventListener('food_hn_bookmarks_updated', handleUpdate);
  }, [restaurant.id]);

  const handleToggleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = toggleBookmark(restaurant.id);
    setSaved(next);
    if (next) {
      toast.success(`Đã lưu "${restaurant.name}" vào yêu thích! 🔖`);
    } else {
      toast.info(`Đã bỏ lưu "${restaurant.name}"`);
    }
  };
  const {
    id,
    name,
    address,
    district,
    category,
    price,
    rating,
    review,
    image_url,
  } = restaurant;

  const ratingInfo = getRatingInfo(rating);
  const categoryInfo = getCategoryInfo(category);
  const coverImage = getImageSrc(image_url);

  const isTopRated = rating === 'ngon';
  const isAvoid = rating === 'khong_ngon';

  // -------------------------------------------------------------
  // 1. COMPACT MODE (Mobile-First Autofit)
  // -------------------------------------------------------------
  if (viewMode === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.25) }}
      >
        <Link href={`/restaurant/${id}`} className="group block">
          <div className="relative flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl bg-card border border-border/60 hover:border-accent/40 hover:bg-card-hover transition-all duration-200 active:scale-[0.99] shadow-sm">
            {/* Left Thumbnail (Square Autofit) */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-secondary/80">
              <Image
                src={imgError ? '/placeholder-food.svg' : coverImage}
                alt={name}
                fill
                sizes="(max-width: 640px) 80px, 96px"
                onError={() => setImgError(true)}
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="gradient-overlay absolute inset-0 pointer-events-none" />

              {/* Rating Stamp Tag on thumbnail */}
              <div className="absolute bottom-1.5 left-1.5">
                {isTopRated ? (
                  <span className="gold-seal text-[9px] px-1.5 py-0.5 backdrop-blur-md">
                    ★ Ngon
                  </span>
                ) : isAvoid ? (
                  <span className="stamp-seal text-[9px] px-1.5 py-0.5 backdrop-blur-md">
                    ✕ Né
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/60 backdrop-blur-md text-white border border-white/10">
                    <RatingIcon rating={rating} size={9} className={ratingInfo.color} />
                    <span>{ratingInfo.label}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Right Information Column */}
            <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
              <div>
                {/* Name and Price */}
                <div className="flex items-start justify-between gap-1 mb-1">
                  <h3 className="font-editorial text-sm sm:text-base font-bold text-white tracking-tight leading-tight group-hover:text-accent transition-colors line-clamp-1">
                    {name}
                  </h3>
                  {price ? (
                    <span className="text-[11px] font-bold text-gold shrink-0 bg-gold/10 px-1.5 py-0.2 rounded border border-gold/20">
                      {price}
                    </span>
                  ) : null}
                </div>

                {/* District & Address */}
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted mb-1.5">
                  <span className="font-semibold text-accent/90 shrink-0 bg-secondary px-1.5 py-0.2 rounded">
                    {district}
                  </span>
                  <span className="truncate text-text-secondary">
                    {address || district}
                  </span>
                </div>
              </div>

              {/* Review snippet or Category tag */}
              <div className="flex items-center justify-between gap-2 text-[11px] mt-auto">
                {review ? (
                  <p className="text-text-muted text-[11px] italic line-clamp-1 leading-normal flex items-center gap-1">
                    <MessageSquareQuote size={11} className="text-gold/80 shrink-0" />
                    <span>{review}</span>
                  </p>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
                    <CategoryIcon slug={category} size={10} className="text-accent" />
                    <span>{categoryInfo.label}</span>
                  </span>
                )}

                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={handleToggleBookmark}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      saved
                        ? 'text-accent bg-accent/15'
                        : 'text-text-muted hover:text-white hover:bg-white/10'
                    }`}
                    title={saved ? 'Bỏ lưu quán' : 'Lưu quán yêu thích'}
                  >
                    <Bookmark size={13} fill={saved ? 'currentColor' : 'none'} />
                  </button>
                  <ArrowUpRight
                    size={14}
                    className="text-text-muted group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  // -------------------------------------------------------------
  // 2. GRID MODE (Standard Photo Card)
  // -------------------------------------------------------------
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.25) }}
    >
      <Link href={`/restaurant/${id}`} className="group block h-full">
        <div className="relative h-full flex flex-col rounded-2xl overflow-hidden bg-card border border-border/60 hover:border-accent/40 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          {/* Cover Image */}
          <div className="relative aspect-[16/10] overflow-hidden bg-secondary/80">
              <Image
                src={imgError ? '/placeholder-food.svg' : coverImage}
                alt={name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                onError={() => setImgError(true)}
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            <div className="gradient-overlay absolute inset-0 pointer-events-none" />

            {/* Category tag */}
            <div className="absolute top-2.5 left-2.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.8 rounded-lg text-[10px] font-semibold bg-bg-primary/80 backdrop-blur-md text-text-primary border border-border/60">
                <CategoryIcon slug={category} size={11} className="text-accent" />
                <span>{categoryInfo.label}</span>
              </span>
            </div>

            {/* Top Right: Bookmark & Price Badge */}
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
              <button
                type="button"
                onClick={handleToggleBookmark}
                className={`p-1.5 rounded-lg backdrop-blur-md transition-all cursor-pointer ${
                  saved
                    ? 'bg-accent text-bg-primary font-bold shadow-sm scale-105'
                    : 'bg-black/50 text-white hover:bg-black/70'
                }`}
                title={saved ? 'Bỏ lưu quán' : 'Lưu quán yêu thích'}
              >
                <Bookmark size={12} fill={saved ? 'currentColor' : 'none'} />
              </button>
              {price && (
                <span className="px-2 py-0.8 rounded-lg text-[10px] font-bold bg-gold text-bg-primary shadow-sm">
                  {price}
                </span>
              )}
            </div>

            {/* Rating Seal */}
            <div className="absolute bottom-2.5 right-2.5">
              {isTopRated ? (
                <span className="gold-seal text-[10px] backdrop-blur-md">
                  ★ Ngon Tuyệt
                </span>
              ) : isAvoid ? (
                <span className="stamp-seal text-[10px] backdrop-blur-md">
                  ✕ Né Gấp
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-black/60 backdrop-blur-md border border-white/10 text-white">
                  <RatingIcon rating={rating} size={10} className={ratingInfo.color} />
                  <span>{ratingInfo.label}</span>
                </span>
              )}
            </div>
          </div>

          {/* Card Details */}
          <div className="p-3.5 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="font-editorial text-base font-bold text-white tracking-tight leading-snug group-hover:text-accent transition-colors line-clamp-1 mb-1">
                {name}
              </h3>

              <div className="flex items-center gap-1 text-text-muted text-[11px] mb-2.5">
                <MapPin size={11} className="text-accent shrink-0" />
                <span className="line-clamp-1">{address || district}</span>
              </div>

              {review ? (
                <p className="text-xs text-text-secondary line-clamp-2 italic leading-relaxed mb-3 p-2 rounded-xl bg-secondary/50 border border-border/40">
                  {review}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px]">
              <span className="font-medium text-text-muted bg-secondary px-2 py-0.5 rounded">
                {district}
              </span>
              <span className="text-accent font-semibold flex items-center gap-0.5 group-hover:underline">
                Chi tiết
                <ArrowUpRight size={12} />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
