'use client';

import { useEffect, useState, use } from 'react';
import {
  ArrowLeft,
  MapPin,
  Clock,
  ExternalLink,
  Share2,
  Trash2,
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
  const canEdit = user?.id === restaurant.created_by || isAdmin;

  return (
    <div className="max-w-3xl mx-auto">
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
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <button
              onClick={handleShare}
              className="p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
            >
              <Share2 size={18} />
            </button>
            {canEdit && (
              <button
                onClick={handleDelete}
                className="p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-accent-red hover:bg-black/60 transition-colors"
              >
                <Trash2 size={18} />
              </button>
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
      <div className="px-4 py-6 space-y-5 animate-fade-in-up">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${ratingInfo.bgColor} ${ratingInfo.color}`}>
              <RatingIcon rating={restaurant.rating} size={13} className="shrink-0" />
              <span>{ratingInfo.label}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-accent/15 text-accent border border-accent/20">
              <CategoryIcon slug={restaurant.category} size={13} className="shrink-0 text-accent" />
              <span>{categoryInfo.label}</span>
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2">
            {restaurant.name}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
            {restaurant.price && (
              <span className="inline-flex items-center gap-1 text-accent-secondary font-medium">
                <Tag size={13} className="shrink-0" />
                <span>{restaurant.price}</span>
              </span>
            )}
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
      </div>
    </div>
  );
}
