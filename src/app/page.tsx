'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UtensilsCrossed,
  RotateCcw,
  RotateCw,
  Search,
  LayoutGrid,
  List,
  Dices,
  WifiOff,
  Bookmark,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';
import RestaurantCard, { type ViewMode } from '@/components/RestaurantCard';
import FilterBar from '@/components/FilterBar';
import { SkeletonGrid } from '@/components/SkeletonCard';
import { BrandLogo } from '@/components/Icons';
import RandomFoodModal from '@/components/RandomFoodModal';
import { getBookmarks } from '@/lib/bookmarks';

type SortMode = 'newest' | 'name' | 'trending';

const PAGE_SIZE = 16;

export default function HomePage() {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedRating, setSelectedRating] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [showRandomModal, setShowRandomModal] = useState(false);

  // Bookmarks state & filter
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);

  // Pagination state
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Offline cache status
  const [isOfflineData, setIsOfflineData] = useState(false);

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

  const [fetchError, setFetchError] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);

  // Fetch restaurants from Supabase with offline cache fallback
  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      if (data) {
        setAllRestaurants(data as Restaurant[]);
        setIsOfflineData(false);
        try {
          localStorage.setItem('food_hn_cached_restaurants', JSON.stringify(data));
        } catch {
          // ignore localStorage quota errors
        }
      }
    } catch {
      // Offline fallback: try reading from localStorage
      try {
        const cached = localStorage.getItem('food_hn_cached_restaurants');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAllRestaurants(parsed);
            setIsOfflineData(true);
            setFetchError(false);
            return;
          }
        }
      } catch {
        // ignore
      }
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  // Read URL search query & filters on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) setSearchQuery(q);
      const dist = params.get('district');
      if (dist) setSelectedDistrict(dist);
      const cat = params.get('category');
      if (cat) setSelectedCategory(cat);
      const saved = params.get('saved');
      if (saved === 'true') setShowOnlyBookmarks(true);
    }
  }, []);

  // Initialize and sync bookmarks
  useEffect(() => {
    setBookmarkedIds(getBookmarks());

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ updated: string[] }>;
      if (customEvent.detail?.updated) {
        setBookmarkedIds(customEvent.detail.updated);
      }
    };

    window.addEventListener('food_hn_bookmarks_updated', handleUpdate);
    return () => window.removeEventListener('food_hn_bookmarks_updated', handleUpdate);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (typeof window !== 'undefined' && window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || (typeof window !== 'undefined' && window.scrollY > 0)) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      setPullY(Math.min(diff * 0.4, 75));
    }
  };

  const handleTouchEnd = async () => {
    if (pullY > 50 && !loading && !isRefreshing) {
      setIsRefreshing(true);
      await fetchRestaurants();
      setIsRefreshing(false);
    }
    setPullY(0);
    setIsPulling(false);
  };

  // Reset pagination when any filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedCategory, selectedDistrict, selectedRating, sortMode, showOnlyBookmarks]);

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

    // Filter by bookmarks
    if (showOnlyBookmarks) {
      list = list.filter((r) => bookmarkedIds.includes(r.id));
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
  }, [allRestaurants, searchQuery, selectedCategory, selectedDistrict, selectedRating, sortMode, showOnlyBookmarks, bookmarkedIds]);

  const visibleRestaurants = useMemo(() => {
    return filteredRestaurants.slice(0, visibleCount);
  }, [filteredRestaurants, visibleCount]);

  const handleResetFilters = () => {
    setSelectedCategory('');
    setSelectedDistrict('');
    setSelectedRating('');
    setSearchQuery('');
    setSortMode('newest');
    setShowOnlyBookmarks(false);
  };

  const hasActiveFilters = Boolean(
    selectedCategory || selectedDistrict || selectedRating || searchQuery || showOnlyBookmarks
  );

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-24"
    >
      {/* Pull to refresh visual indicator */}
      <AnimatePresence>
        {(pullY > 0 || isRefreshing) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: isRefreshing ? 36 : Math.min(pullY, 50), opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center justify-center overflow-hidden mb-2 pointer-events-none"
          >
            <div className="flex items-center gap-2 bg-card/95 px-3 py-1 rounded-full border border-accent/40 shadow-lg text-[11px] text-accent font-medium">
              <RotateCw
                size={12}
                className={isRefreshing ? 'animate-spin' : ''}
                style={{ transform: isRefreshing ? undefined : `rotate(${pullY * 4}deg)` }}
              />
              <span>{isRefreshing ? 'Đang làm mới...' : pullY > 50 ? 'Thả để làm mới' : 'Kéo để làm mới'}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline Status Banner */}
      {isOfflineData && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs mb-3 shadow-sm">
          <div className="flex items-center gap-2">
            <WifiOff size={14} className="shrink-0 text-amber-400" />
            <span>Đang xem dữ liệu ngoại tuyến (Offline cache).</span>
          </div>
          <button
            type="button"
            onClick={() => fetchRestaurants()}
            className="underline hover:text-white shrink-0 cursor-pointer font-medium text-[11px]"
          >
            Thử kết nối lại
          </button>
        </div>
      )}

      {/* 1. Sleek Compact Header (No giant slogans) */}
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={22} />
          <div>
            <h1 className="font-editorial text-lg sm:text-xl font-bold text-white tracking-tight leading-none">
              Food Review <span className="text-accent">Hà Nội</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-text-muted">
                {allRestaurants.length} quán chọn lọc
              </span>
              <button
                type="button"
                onClick={() => fetchRestaurants()}
                disabled={loading || isRefreshing}
                className="text-text-muted hover:text-accent flex items-center transition-colors cursor-pointer p-0.5"
                title="Tải lại danh sách"
              >
                <RotateCw size={11} className={loading || isRefreshing ? 'animate-spin text-accent' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* Right action group: Random Food Picker & View mode toggle */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowRandomModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 active:scale-95 transition-all cursor-pointer font-bold text-xs shadow-sm"
            title="Quay ngẫu nhiên hôm nay ăn gì"
          >
            <Dices size={15} />
            <span className="hidden sm:inline">Hôm nay ăn gì?</span>
            <span className="sm:hidden">Ăn gì?</span>
          </button>

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
        </div>
      </header>

      {/* 2. Compact Autofit Search Bar & Bookmark Filter */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="relative flex-1 flex items-center rounded-xl bg-card border border-border/80 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
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

        {/* Bookmark Quick Toggle Button */}
        <button
          type="button"
          onClick={() => setShowOnlyBookmarks(!showOnlyBookmarks)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            showOnlyBookmarks
              ? 'bg-accent text-bg-primary border-accent shadow-md font-bold'
              : 'bg-card text-text-secondary border-border/80 hover:text-white hover:border-accent/40'
          }`}
          title="Xem danh sách quán đã lưu"
        >
          <Bookmark size={14} fill={showOnlyBookmarks ? 'currentColor' : 'none'} />
          <span className="hidden sm:inline">Đã lưu</span>
          {bookmarkedIds.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                showOnlyBookmarks
                  ? 'bg-bg-primary text-accent'
                  : 'bg-accent/20 text-accent'
              }`}
            >
              {bookmarkedIds.length}
            </span>
          )}
        </button>
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
        ) : fetchError ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 px-4 bg-card rounded-2xl border border-border/60 mt-4"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-secondary flex items-center justify-center text-text-muted">
              <WifiOff size={22} className="text-accent-red" />
            </div>
            <h3 className="font-editorial text-base font-bold text-white mb-1">
              Không tải được dữ liệu
            </h3>
            <p className="text-xs text-text-secondary mb-4">
              Kiểm tra kết nối mạng rồi thử lại nhé.
            </p>
            <button
              type="button"
              onClick={fetchRestaurants}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-bg-primary font-bold text-xs cursor-pointer active:scale-95 transition-transform"
            >
              <RotateCcw size={12} />
              Thử lại
            </button>
          </motion.div>
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
              {showOnlyBookmarks ? 'Chưa có quán nào trong mục Đã lưu' : 'Không tìm thấy quán phù hợp'}
            </h3>
            <p className="text-xs text-text-secondary mb-4">
              {showOnlyBookmarks
                ? 'Bấm biểu tượng Bookmark ở góc quán để lưu lại món ăn bạn yêu thích.'
                : 'Thử xóa bớt bộ lọc hoặc tìm với từ khóa khác.'}
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
          <>
            <div
              className={
                viewMode === 'compact'
                  ? 'grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5'
                  : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4'
              }
            >
              <AnimatePresence>
                {visibleRestaurants.map((restaurant, i) => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    index={i}
                    viewMode={viewMode}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination / Load more */}
            {filteredRestaurants.length > visibleCount && (
              <div className="flex flex-col items-center justify-center mt-6 gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="px-6 py-2.5 rounded-xl bg-card border border-accent/40 text-accent hover:bg-accent hover:text-bg-primary font-bold text-xs active:scale-95 transition-all shadow-md cursor-pointer flex items-center gap-2"
                >
                  <span>Xem thêm (+{Math.min(PAGE_SIZE, filteredRestaurants.length - visibleCount)} quán)</span>
                </button>
                <span className="text-[11px] text-text-muted">
                  Đang hiển thị {Math.min(visibleCount, filteredRestaurants.length)} / {filteredRestaurants.length} quán
                </span>
              </div>
            )}
          </>
        )}
      </section>

      {/* Random Food Picker Modal */}
      <RandomFoodModal
        isOpen={showRandomModal}
        onClose={() => setShowRandomModal(false)}
        restaurants={allRestaurants}
      />
    </div>
  );
}

