'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search as SearchIcon, X, SlidersHorizontal, UtensilsCrossed } from 'lucide-react';
import { matchesRestaurantSearch } from '@/lib/search';
import { supabase } from '@/lib/supabase';
import type { OccasionSlug, Restaurant } from '@/lib/types';
import { DISTRICTS, RATING_OPTIONS, CATEGORIES, OCCASIONS } from '@/lib/types';
import RestaurantCard from '@/components/RestaurantCard';
import { SkeletonGrid } from '@/components/SkeletonCard';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [district, setDistrict] = useState('');
  const [rating, setRating] = useState('');
  const [category, setCategory] = useState('');
  const [occasion, setOccasion] = useState('');
  const [urlReady, setUrlReady] = useState(false);
  const searched = !!(query.trim() || district || rating || category || occasion);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFetchError(false);
    supabase.from('restaurants').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        setFetchError(!!error);
        setRestaurants(error ? [] : (data as Restaurant[]) || []);
        setLoading(false);
      }, () => { if (active) { setFetchError(true); setLoading(false); } });
    return () => { active = false; };
  }, [retry]);

  const results = useMemo(() => searched ? restaurants.filter((r) =>
    matchesRestaurantSearch(r, query) && (!district || r.district === district)
    && (!rating || r.rating === rating) && (!category || r.category === category)
    && (!occasion || r.occasions?.includes(occasion as OccasionSlug))
  ) : [], [restaurants, query, district, rating, category, occasion, searched]);

  // Read initial query params from URL
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get('q') ?? '');
      setDistrict(params.get('district') ?? '');
      setCategory(params.get('category') ?? '');
      setRating(params.get('rating') ?? '');
      setOccasion(params.get('occasion') ?? '');
      setUrlReady(true);
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);
  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (district) params.set('district', district);
    if (category) params.set('category', category);
    if (rating) params.set('rating', rating);
    if (occasion) params.set('occasion', occasion);
    window.history.replaceState(window.history.state, '', `/search${params.size ? `?${params}` : ''}`);
  }, [urlReady, query, district, category, rating, occasion]);


  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <SearchIcon size={20} className="text-accent" />
          <h1 className="text-xl font-bold text-foreground">Tìm kiếm</h1>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <SearchIcon
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              aria-label="Tìm quán, món ăn hoặc địa chỉ"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm quán, món ăn, địa chỉ, nhận xét..."
              className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-card border border-border text-foreground placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
            />
            {query && (
              <button
                aria-label="Xóa từ khóa"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-text-muted"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            aria-label="Bộ lọc tìm kiếm"
            aria-expanded={showFilters}
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3.5 rounded-2xl border transition-colors ${
              showFilters || district || rating || category || occasion
                ? 'bg-accent/15 border-accent/30 text-accent'
                : 'bg-card border-border text-text-muted hover:border-accent/30'
            }`}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex gap-3 mt-3 flex-wrap"
          >
            <select
              aria-label="Quận / huyện"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-text-secondary focus:outline-none focus:border-accent transition-colors appearance-none"
            >
              <option value="">Tất cả quận</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              aria-label="Đánh giá"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-text-secondary focus:outline-none focus:border-accent transition-colors appearance-none"
            >
              <option value="">Tất cả đánh giá</option>
              {RATING_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.emoji} {r.label}</option>
              ))}
            </select>

            <select
              aria-label="Loại quán"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-text-secondary focus:outline-none focus:border-accent transition-colors appearance-none"
            >
              <option value="">Tất cả loại quán</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>

            <select
              aria-label="Phù hợp cho"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-text-secondary focus:outline-none focus:border-accent transition-colors appearance-none"
            >
              <option value="">Mọi dịp</option>
              {OCCASIONS.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
            </select>

            {(district || rating || category || occasion) && (
              <button
                onClick={() => { setDistrict(''); setRating(''); setCategory(''); setOccasion(''); }}
                className="px-3 py-2 rounded-xl text-xs text-accent-red hover:bg-accent-red/10 transition-colors font-medium"
              >
                Xóa filter
              </button>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Results */}
      <div className="mt-6">
        {loading ? (
          <SkeletonGrid count={4} />
        ) : fetchError ? (
          <div className="text-center py-10" role="alert">
            <p>Không tải được danh sách quán. Hãy thử kết nối lại.</p>
            <button onClick={() => setRetry((value) => value + 1)} className="mt-3 text-accent underline">Thử lại</button>
          </div>
        ) : searched && results.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-card border border-border flex items-center justify-center text-text-muted">
              <SearchIcon size={24} />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Không tìm thấy</h3>
            <p className="text-sm text-text-muted">
              Thử từ khóa khác hoặc thay đổi bộ lọc
            </p>
          </div>
        ) : results.length > 0 ? (
          <>
            <p className="text-xs text-text-muted mb-4">
              Tìm thấy {results.length} kết quả
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {results.map((r, i) => (
                <RestaurantCard key={r.id} restaurant={r} index={i} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-card border border-border flex items-center justify-center text-text-muted">
              <UtensilsCrossed size={24} />
            </div>
            <p className="text-sm text-text-muted">
              Nhập tên quán, món ăn hoặc địa chỉ...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
