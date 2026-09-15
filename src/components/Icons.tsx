'use client';

import {
  Utensils,
  Coffee,
  Wine,
  Flame,
  CakeSlice,
  UtensilsCrossed,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Bookmark,
} from 'lucide-react';
import type { RatingLabel, CategorySlug } from '@/lib/types';

/**
 * Modern vector icon for categories
 */
export function CategoryIcon({
  slug,
  className = '',
  size = 14,
}: {
  slug: CategorySlug;
  className?: string;
  size?: number;
}) {
  switch (slug) {
    case 'com_bui':
      return <Utensils size={size} className={className} />;
    case 'do_uong':
      return <Coffee size={size} className={className} />;
    case 'di_date':
      return <Wine size={size} className={className} />;
    case 'lau_nuong':
      return <Flame size={size} className={className} />;
    case 'do_ngot':
      return <CakeSlice size={size} className={className} />;
    default:
      return <UtensilsCrossed size={size} className={className} />;
  }
}

/**
 * Modern vector icon for ratings
 */
export function RatingIcon({
  rating,
  className = '',
  size = 13,
}: {
  rating: RatingLabel;
  className?: string;
  size?: number;
}) {
  switch (rating) {
    case 'ngon':
      return <Sparkles size={size} className={className} />;
    case 'binh_thuong':
      return <CheckCircle2 size={size} className={className} />;
    case 'khong_ngon':
      return <AlertCircle size={size} className={className} />;
    case 'chua_an':
      return <Bookmark size={size} className={className} />;
    default:
      return <Sparkles size={size} className={className} />;
  }
}

/**
 * Modern Brand Logo Badge
 */
export function BrandLogo({ size = 18 }: { size?: number }) {
  return (
    <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shadow-sm shrink-0">
      <UtensilsCrossed size={size} />
    </div>
  );
}
