'use client';

import { useEffect, useState, use } from 'react';
import {
  ArrowLeft,
  MapPin,
  Clock,
  ExternalLink,
  Share2,
  Trash2,
  Pencil,
  Tag,
  MessageSquareQuote,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';
import { getRatingInfo, getCategoryInfo, getImageSrc, timeAgo } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { CategoryIcon, RatingIcon } from '@/components/Icons';
import { toast } from 'sonner';

export default function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isAdmin } = useAuth();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', id)
        .single();

      if (data) setRestaurant(data as Restaurant);
      setLoading(false);
    }
    fetchData();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc muốn xóa quán này?')) return;
    const { error } = await supabase.from('restaurants').delete().eq('id', id);
    if (!error) {
      toast.success('Đã xóa quán');
      router.push('/');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: restaurant?.name,
        text: `Check out ${restaurant?.name} on Food Review Hà Nội`,
        url: window.location.href,
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Đã copy link! 📋');
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4">
        <div className="h-72 skeleton mt-4 rounded-2xl" />
        <div className="mt-6 space-y-4">
          <div className="h-8 w-3/4 skeleton" />
          <div className="h-4 w-1/2 skeleton" />
          <div className="h-20 skeleton" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-card border border-border flex items-center justify-center text-text-muted">
          <UtensilsCrossed size={30} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Không tìm thấy quán</h2>
        <Link href="/" className="text-accent hover:underline text-sm">
          ← Quay lại trang chủ
        </Link>
      </div>
    );
  }

  const ratingInfo = getRatingInfo(restaurant.rating);
  const categoryInfo = getCategoryInfo(restaurant.category);
  const coverImage = getImageSrc(restaurant.image_url);
  const canEdit = isAdmin || (user?.id && restaurant.created_by && user.id === restaurant.created_by);

  return (
    <div className="max-w-3xl mx-auto pb-20">
      {/* Cover Image */}
      <div className="relative">
        <div className="relative aspect-[16/10] md:aspect-[16/7] overflow-hidden md:rounded-b-3xl bg-secondary/60">
          <img
            src={imgError ? '/placeholder-food.svg' : coverImage}
            alt={restaurant.name}
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover"
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
              onClick={handleShare}
              className="p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors cursor-pointer"
              title="Chia sẻ"
            >
              <Share2 size={18} />
            </button>
            {canEdit && (
              <>
                <Link
                  href={`/restaurant/${id}/edit`}
                  className="p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-accent hover:bg-black/60 transition-colors cursor-pointer"
                  title="Chỉnh sửa quán"
                >
                  <Pencil size={18} />
                </Link>
                <button
                  onClick={handleDelete}
                  className="p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-accent-red hover:bg-black/60 transition-colors cursor-pointer"
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
          {restaurant.map_url && (
            <a
              href={restaurant.map_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-medium hover:bg-accent/20 transition-colors"
            >
              <MapPin size={16} />
              Mở trong Google Maps
              <ExternalLink size={14} className="ml-auto" />
            </a>
          )}
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
              href={`/restaurant/${id}/edit`}
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
      </div>
    </div>
  );
}
