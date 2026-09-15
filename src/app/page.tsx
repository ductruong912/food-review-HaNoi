'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UtensilsCrossed,
  RotateCcw,
  Search,
  LayoutGrid,
  List,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';
import RestaurantCard, { type ViewMode } from '@/components/RestaurantCard';
import FilterBar from '@/components/FilterBar';
import { SkeletonGrid } from '@/components/SkeletonCard';
import { BrandLogo } from '@/components/Icons';

type SortMode = 'newest' | 'name' | 'trending';

export default function HomePage() {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedRating, setSelectedRating] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('compact');

  // Load view mode preference from localStorage if available
  useEffect(() => {
    const saved = localStorage.getItem('food_hn_view_mode') as ViewMode | null;
    if (saved === 'compact' || saved === 'grid') {
      setViewMode(saved);
    }
  }, []);

  const handleToggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('food_hn_view_mode', mode);
  };

  // Fetch restaurants from Supabase
  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAllRestaurants(data as Restaurant[]);
      }
    } catch {
      // Keep empty if error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  // Client-side filtering & sorting
  const filteredRestaurants = useMemo(() => {
    let list = [...allRestaurants];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.address?.toLowerCase().includes(q) ||
          r.district?.toLowerCase().includes(q) ||
          r.review?.toLowerCase().includes(q)
      );
    }

    // Filter by category
    if (selectedCategory) {
      list = list.filter((r) => r.category === selectedCategory);
    }

    // Filter by district
    if (selectedDistrict) {
      list = list.filter((r) => r.district === selectedDistrict);
    }

    // Filter by rating
    if (selectedRating) {
      list = list.filter((r) => r.rating === selectedRating);
    }

    // Sorting
    switch (sortMode) {
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        break;
      case 'trending':
        list.sort((a, b) => {
          if (a.rating === 'ngon' && b.rating !== 'ngon') return -1;
          if (a.rating !== 'ngon' && b.rating === 'ngon') return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        break;
      case 'newest':
      default:
        list.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return list;
  }, [allRestaurants, searchQuery, selectedCategory, selectedDistrict, selectedRating, sortMode]);

  const handleResetFilters = () => {
    setSelectedCategory('');
    setSelectedDistrict('');
    setSelectedRating('');
    setSearchQuery('');
    setSortMode('newest');
  };

  const hasActiveFilters = Boolean(
    selectedCategory || selectedDistrict || selectedRating || searchQuery
  );

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-24">
      {/* 1. Sleek Compact Header (No giant slogans) */}
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={22} />
          <div>
            <h1 className="font-editorial text-lg sm:text-xl font-bold text-white tracking-tight leading-none">
              Food Review <span className="text-accent">Hà Nội</span>
            </h1>
            <span className="text-[11px] text-text-muted">
              {allRestaurants.length} quán chọn lọc
            </span>
          </div>
        </div>

        {/* View mode toggle (Compact vs Grid) */}
        <div className="flex items-center p-0.5 rounded-xl bg-card border border-border/80 text-text-muted">
          <button
            type="button"
            onClick={() => handleToggleViewMode('compact')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              viewMode === 'compact'
                ? 'bg-accent text-bg-primary font-bold shadow-sm'
                : 'hover:text-white'
            }`}
            title="Xem danh sách gọn (Tối ưu điện thoại)"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => handleToggleViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-accent text-bg-primary font-bold shadow-sm'
                : 'hover:text-white'
            }`}
            title="Xem lưới ảnh to"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </header>

      {/* 2. Compact Autofit Search Bar */}
      <div className="relative mb-2.5">
        <div className="relative flex items-center rounded-xl bg-card border border-border/80 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
          <Search size={16} className="ml-3 text-text-muted shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm món, tên quán, con phố..."
            className="w-full bg-transparent px-2.5 py-2 text-xs sm:text-sm text-white placeholder:text-text-muted focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-text-muted hover:text-white px-3 py-1 cursor-pointer"
            >
              Xóa
            </button>
          )}
        </div>
      </div>

      {/* 3. Streamlined Sticky Filter Bar (Single clean row with 3-bar drawer button on right) */}
      <section className="sticky top-0 md:top-16 z-30 py-2.5 bg-background/90 backdrop-blur-xl border-y border-border/50 -mx-3 px-3 sm:mx-0 sm:px-0 sm:border-x-0 mb-3">
        <FilterBar
          selectedCategory={selectedCategory}
          selectedDistrict={selectedDistrict}
          selectedRating={selectedRating}
          sortMode={sortMode}
          onCategoryChange={setSelectedCategory}
          onDistrictChange={setSelectedDistrict}
          onRatingChange={setSelectedRating}
          onSortModeChange={setSortMode}
          onReset={handleResetFilters}
          totalCount={filteredRestaurants.length}
        />
      </section>

      {/* 4. Restaurant Feed (High Density, Autofit) */}
      <section>
        {loading ? (
          <SkeletonGrid count={6} />
        ) : filteredRestaurants.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 px-4 bg-card rounded-2xl border border-border/60 mt-4"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-secondary flex items-center justify-center text-text-muted">
              <UtensilsCrossed size={22} className="text-accent" />
            </div>
            <h3 className="font-editorial text-base font-bold text-white mb-1">
              Không tìm thấy quán phù hợp
            </h3>
            <p className="text-xs text-text-secondary mb-4">
              Thử xóa bớt bộ lọc hoặc tìm với từ khóa khác.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-bg-primary font-bold text-xs cursor-pointer active:scale-95 transition-transform"
              >
                <RotateCcw size={12} />
                Xem tất cả {allRestaurants.length} quán
              </button>
            )}
          </motion.div>
        ) : (
          <div
            className={
              viewMode === 'compact'
                ? 'grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4'
            }
          >
            <AnimatePresence>
              {filteredRestaurants.map((restaurant, i) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  index={i}
                  viewMode={viewMode}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
