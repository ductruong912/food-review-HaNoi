'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search as SearchIcon, X, SlidersHorizontal, UtensilsCrossed } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';
import { DISTRICTS, RATING_OPTIONS, CATEGORIES } from '@/lib/types';
import RestaurantCard from '@/components/RestaurantCard';
import { SkeletonGrid } from '@/components/SkeletonCard';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [district, setDistrict] = useState('');
  const [rating, setRating] = useState('');
  const [category, setCategory] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);

    let q = supabase.from('restaurants').select('*');

    if (query.trim()) {
      // Escape special characters to prevent query injection
      const sanitized = query.replace(/[\\%_]/g, (ch) => `\\${ch}`);
      q = q.or(`name.ilike.%${sanitized}%,address.ilike.%${sanitized}%,review.ilike.%${sanitized}%`);
    }
    if (district) q = q.eq('district', district);
    if (rating) q = q.eq('rating', rating);
    if (category) q = q.eq('category', category);

    q = q.order('created_at', { ascending: false }).limit(50);

    const { data } = await q;
    setResults((data as Restaurant[]) || []);
    setLoading(false);
  }, [query, district, rating, category]);

  // Read initial query params from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) setQuery(q);
      const dist = params.get('district');
      if (dist) setDistrict(dist);
      const cat = params.get('category');
      if (cat) setCategory(cat);
      const rat = params.get('rating');
      if (rat) setRating(rat);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim() && !district && !rating && !category) {
      setResults([]);
      setSearched(false);
      return;
    }

    const timer = setTimeout(handleSearch, 400);
    return () => clearTimeout(timer);
  }, [query, district, rating, category, handleSearch]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <SearchIcon size={20} className="text-accent" />
          <h1 className="text-xl font-bold text-white">Tìm kiếm</h1>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <SearchIcon
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm quán, món ăn, địa chỉ, nhận xét..."
              className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-card border border-border text-white placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-text-muted"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3.5 rounded-2xl border transition-colors ${
              showFilters || district || rating || category
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
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-text-secondary focus:outline-none focus:border-accent transition-colors appearance-none"
            >
              <option value="">Tất cả loại quán</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>

            {(district || rating || category) && (
              <button
                onClick={() => { setDistrict(''); setRating(''); setCategory(''); }}
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
        ) : searched && results.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-card border border-border flex items-center justify-center text-text-muted">
              <SearchIcon size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Không tìm thấy</h3>
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
