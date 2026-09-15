import { RATING_MAP, CATEGORY_MAP, type RatingLabel } from './types';

/**
 * Merge class names conditionally
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Format a date string to Vietnamese locale
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format relative time (e.g., "2 ngày trước")
 */
export function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 30) return `${diffDays} ngày trước`;
  return formatDate(dateString);
}

/**
 * Get rating display info from text label
 */
export function getRatingInfo(rating: RatingLabel) {
  return RATING_MAP[rating] || RATING_MAP.chua_an;
}

/**
 * Get category display info from slug
 */
export function getCategoryInfo(slug: string) {
  return CATEGORY_MAP[slug] || { slug, label: slug };
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Get placeholder image when image_url is empty
 */
export function getImageSrc(imageUrl: string | null | undefined): string {
  if (imageUrl && imageUrl.trim() !== '') return imageUrl;
  return '/placeholder-food.svg';
}
