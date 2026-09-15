'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  MapPin,
  Clock,
  ExternalLink,
  Share2,
  Trash2,
  Pencil,
  MessageSquareQuote,
  User,
  UtensilsCrossed,
  ChevronRight,
  Bookmark,
  Copy,
  Navigation,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';
import { getRatingInfo, getCategoryInfo, getImageSrc, timeAgo } from '@/lib/utils';
import { getDirectionsUrl } from '@/lib/geo';
import { isBookmarked, toggleBookmark } from '@/lib/bookmarks';
import { useAuth } from '@/components/AuthProvider';
import { CategoryIcon, RatingIcon } from '@/components/Icons';
import RestaurantCard from '@/components/RestaurantCard';
import { toast } from 'sonner';

interface RestaurantDetailClientProps {
  restaurant: Restaurant;
}

export default function RestaurantDetailClient({
  restaurant,
}: RestaurantDetailClientProps) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [imgError, setImgError] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    setBookmarked(isBookmarked(restaurant.id));
  }, [restaurant.id]);

  const handleToggleBookmark = () => {
    const nextState = toggleBookmark(restaurant.id);
    setBookmarked(nextState);
    if (nextState) {
      toast.success('Đã thêm vào danh sách yêu thích! 🔖');
    } else {
      toast.info('Đã xóa khỏi danh sách yêu thích');
    }
  };

  const handleCopyAddress = async () => {
    if (restaurant.address) {
      await navigator.clipboard.writeText(restaurant.address);
      toast.success('Đã sao chép địa chỉ! 📋');
    }
  };

  // Related restaurants: same district + same category, excluding current
  const [relatedRestaurants, setRelatedRestaurants] = useState<Restaurant[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);

  useEffect(() => {
    async function fetchRelated() {
      setRelatedLoading(true);

      // Fetch restaurants with same district OR same category
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .neq('id', restaurant.id)
        .or(`district.eq.${restaurant.district},category.eq.${restaurant.category}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        // Sort: prioritize same district AND category > same district > same category
        const sorted = (data as Restaurant[]).sort((a, b) => {
          const aScore =
            (a.district === restaurant.district ? 2 : 0) +
            (a.category === restaurant.category ? 1 : 0);
          const bScore =
            (b.district === restaurant.district ? 2 : 0) +
            (b.category === restaurant.category ? 1 : 0);
          return bScore - aScore;
        });
        setRelatedRestaurants(sorted.slice(0, 6));
      }
      setRelatedLoading(false);
    }

    fetchRelated();
  }, [restaurant.id, restaurant.district, restaurant.category]);

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc muốn xóa quán này?')) return;
    const { error } = await supabase.from('restaurants').delete().eq('id', restaurant.id);
    if (!error) {
      toast.success('Đã xóa quán');
      router.push('/');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: restaurant.name,
        text: `Xem đánh giá ${restaurant.name} trên Food Review Hà Nội`,
        url: window.location.href,
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Đã copy link! 📋');
    }
  };

  const ratingInfo = getRatingInfo(restaurant.rating);
  const categoryInfo = getCategoryInfo(restaurant.category);
  const coverImage = getImageSrc(restaurant.image_url);
  const canEdit = isAdmin || (user?.id && restaurant.created_by && user.id === restaurant.created_by);

  return (
    <div className="max-w-3xl mx-auto pb-20">
      {/* Cover Image */}
      <div className="relative">
        <div className="relative aspect-[16/10] md:aspect-[16/7] overflow-hidden md:rounded-b-3xl bg-secondary/60">
          <Image
            src={imgError ? '/placeholder-food.svg' : coverImage}
            alt={restaurant.name}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            priority
            onError={() => setImgError(true)}
            className="object-cover"
          />
          <div className="gradient-overlay absolute inset-0 pointer-events-none" />

          {/* Back button */}
          <Link
            href="/"
            className="absolute top-4 left-4 p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors z-10"
          >
            <ArrowLeft size={20} />
          </Link>

          {/* Action buttons */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <button
              type="button"
              onClick={handleToggleBookmark}
              className={`p-2.5 rounded-full backdrop-blur-sm transition-all cursor-pointer shadow-md ${
                bookmarked
                  ? 'bg-accent text-bg-primary font-bold shadow-accent/30 scale-105'
                  : 'bg-black/50 text-white hover:bg-black/70'
              }`}
              title={bookmarked ? 'Bỏ lưu quán yêu thích' : 'Lưu quán vào danh sách yêu thích'}
            >
              <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="p-2.5 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors cursor-pointer"
              title="Chia sẻ"
            >
              <Share2 size={18} />
            </button>
            {canEdit && (
              <>
                <Link
                  href={`/restaurant/${restaurant.id}/edit`}
                  className="p-2.5 rounded-full bg-black/50 backdrop-blur-sm text-accent hover:bg-black/70 transition-colors cursor-pointer"
                  title="Chỉnh sửa quán"
                >
                  <Pencil size={18} />
                </Link>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-2.5 rounded-full bg-black/50 backdrop-blur-sm text-accent-red hover:bg-black/70 transition-colors cursor-pointer"
                  title="Xóa quán"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>

          {/* Rating overlay */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10 z-10">
            <RatingIcon rating={restaurant.rating} size={15} className={ratingInfo.color} />
            <span className={`text-sm font-bold ${ratingInfo.color}`}>{ratingInfo.label}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Name & Basic Info */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-secondary text-text-secondary border border-border/70">
                <CategoryIcon slug={restaurant.category} size={13} className="text-accent" />
                <span>{categoryInfo.label}</span>
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${ratingInfo.bgColor}`}>
                <RatingIcon rating={restaurant.rating} size={13} className={ratingInfo.color} />
                <span className={ratingInfo.color}>{ratingInfo.label}</span>
              </span>
            </div>
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {restaurant.name}
            </h1>
          </div>
          {restaurant.price && (
            <span className="text-sm sm:text-base font-bold text-gold bg-gold/10 px-3 py-1 rounded-xl border border-gold/20 shrink-0">
              {restaurant.price}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Clock size={13} />
            <span>{timeAgo(restaurant.created_at)}</span>
          </div>
          {restaurant.created_by_name && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-secondary/80 border border-border">
              <User size={12} className="text-accent shrink-0" />
              <span className="text-text-muted">Đăng bởi:</span> <strong className="text-accent">{restaurant.created_by_name}</strong>
            </span>
          )}
        </div>

        {/* Address & Map */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <MapPin size={18} className="text-accent mt-0.5 shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">{restaurant.address}</p>
                <p className="text-text-muted text-xs mt-0.5 inline-flex items-center gap-1">
                  <MapPin size={10} className="text-accent/80" />
                  <span>{restaurant.district}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyAddress}
              className="p-1.5 rounded-lg bg-card/80 hover:bg-card text-text-muted hover:text-white border border-border/60 transition-colors shrink-0 cursor-pointer"
              title="Sao chép địa chỉ"
            >
              <Copy size={15} />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <a
              href={getDirectionsUrl(restaurant)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-accent text-bg-primary font-bold text-xs hover:brightness-110 active:scale-98 transition-all shadow-sm"
            >
              <Navigation size={15} />
              <span>Chỉ đường</span>
            </a>
            {restaurant.map_url && (
              <a
                href={restaurant.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border/80 text-text-secondary hover:text-white hover:border-accent/40 text-xs font-medium transition-colors"
              >
                <MapPin size={15} className="text-accent" />
                <span>Google Maps</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>

        {/* Review / Nhận xét */}
        {restaurant.review && restaurant.review.trim() !== '' && (
          <div className="glass-card p-4">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <MessageSquareQuote size={16} className="text-accent shrink-0" />
              <span>Nhận xét</span>
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {restaurant.review}
            </p>
          </div>
        )}

        {/* Management Action Bar (Edit & Delete) */}
        {canEdit && (
          <div className="p-3 rounded-2xl bg-secondary/40 border border-border/60 flex items-center gap-2.5">
            <Link
              href={`/restaurant/${restaurant.id}/edit`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-card border border-border hover:border-accent/40 text-white font-semibold text-xs transition-colors"
            >
              <Pencil size={14} className="text-accent" />
              <span>Chỉnh sửa quán</span>
            </Link>
            <button
              onClick={handleDelete}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent-red/10 border border-accent-red/30 hover:bg-accent-red/20 text-accent-red font-semibold text-xs transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Xóa quán</span>
            </button>
          </div>
        )}

        {/* Related Restaurants */}
        {!relatedLoading && relatedRestaurants.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <UtensilsCrossed size={16} className="text-accent" />
                Quán tương tự gần đây
              </h2>
              <Link
                href={`/?district=${encodeURIComponent(restaurant.district)}`}
                className="text-[11px] text-accent font-medium flex items-center gap-0.5 hover:underline"
              >
                Xem thêm
                <ChevronRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {relatedRestaurants.map((r, i) => (
                <RestaurantCard key={r.id} restaurant={r} index={i} viewMode="compact" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
