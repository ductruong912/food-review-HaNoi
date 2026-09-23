'use client';

import {
  Utensils,
  Coffee,
  Globe2,
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
    case 'mon_viet_hang_ngay':
      return <Utensils size={size} className={className} />;
    case 'lau_nuong':
      return <Flame size={size} className={className} />;
    case 'an_vat':
      return <UtensilsCrossed size={size} className={className} />;
    case 'ca_phe_do_uong':
      return <Coffee size={size} className={className} />;
    case 'banh_trang_mieng':
      return <CakeSlice size={size} className={className} />;
    case 'mon_quoc_te':
      return <Globe2 size={size} className={className} />;
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
