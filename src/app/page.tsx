'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
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
  MapPin,
} from 'lucide-react';
import { DISTRICTS, OCCASIONS } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';
import RestaurantCard, { type ViewMode } from '@/components/RestaurantCard';
import FilterBar from '@/components/FilterBar';
import { SkeletonGrid } from '@/components/SkeletonCard';
import RandomFoodModal from '@/components/RandomFoodModal';
import { getBookmarks } from '@/lib/bookmarks';
import ThemeToggle from '@/components/ThemeToggle';
import { buildFilterHref, filterRestaurants, hasRestaurantFilterCriteria } from '@/lib/filters';
import { useRestaurantFilters } from '@/lib/useRestaurantFilters';
import { consumePendingScrollPosition } from '@/lib/restaurantNavigation';

const PAGE_SIZE = 16;

export default function HomePage() {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const { filters, updateFilter, resetFilters: clearFilterState, ready: urlReady } = useRestaurantFilters();
  const searchQuery = filters.query;
  const sortMode = filters.sort;
  const selectedCategories = filters.categories;
  const selectedOccasions = filters.occasions;
  const selectedDistricts = filters.districts;
  const selectedRating = filters.rating;
  const showOnlyBookmarks = filters.saved;
  const setSearchQuery = (query: string) => updateFilter('query', query);
  const setSortMode = (sort: typeof filters.sort) => updateFilter('sort', sort);
  const setSelectedCategories = (categories: string[]) => updateFilter('categories', categories);
  const setSelectedOccasions = (occasions: string[]) => updateFilter('occasions', occasions);
  const setSelectedDistricts = (districts: string[]) => updateFilter('districts', districts);
  const setSelectedRating = (rating: string) => updateFilter('rating', rating);
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [showRandomModal, setShowRandomModal] = useState(false);

  // Bookmarks state & filter
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  // Pagination state
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Offline cache status
  const [isOfflineData, setIsOfflineData] = useState(false);

  // Load view mode preference from localStorage if available
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem('food_hn_view_mode'); } catch { /* Optional preference. */ }
    if (saved === 'compact' || saved === 'grid') {
      setViewMode(saved);
    }
  }, []);

  const handleToggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem('food_hn_view_mode', mode); } catch { /* Keep in-memory choice. */ }
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

  useEffect(() => {
    if (!urlReady || loading) return;
    const scrollPosition = consumePendingScrollPosition();
    if (scrollPosition !== null) requestAnimationFrame(() => window.scrollTo(0, scrollPosition));
  }, [urlReady, loading]);

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
    const syncStorage = () => setBookmarkedIds(getBookmarks());
    window.addEventListener('storage', syncStorage);
    return () => { window.removeEventListener('food_hn_bookmarks_updated', handleUpdate); window.removeEventListener('storage', syncStorage); };
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
  }, [filters]);

  // Shared filtering and sorting used by list, search, and map.
  const filteredRestaurants = useMemo(() => {
    return filterRestaurants(allRestaurants, filters, bookmarkedIds);
  }, [allRestaurants, filters, bookmarkedIds]);

  const visibleRestaurants = useMemo(() => {
    return filteredRestaurants.slice(0, visibleCount);
  }, [filteredRestaurants, visibleCount]);

  const handleResetFilters = () => {
    clearFilterState();
  };

  const hasActiveFilters = hasRestaurantFilterCriteria(filters);

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
            <div className="flex items-center gap-2 bg-card/95 px-3 py-1 rounded-full border border-accent/40 shadow-lg text-xs text-accent font-medium">
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
            className="underline hover:text-foreground shrink-0 cursor-pointer font-medium text-xs"
          >
            Thử kết nối lại
          </button>
        </div>
      )}

      <section className="mb-5 space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-accent">SỔ TAY QUÁN ĂN HÀ NỘI</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Mình ăn gì hôm nay?</h1>
            <p className="mt-1 text-sm text-text-secondary">Tìm trong danh sách quán của bạn bè.</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden text-xs text-text-muted sm:inline">{allRestaurants.length} quán</span>
            <button type="button" onClick={() => fetchRestaurants()} disabled={loading || isRefreshing} aria-label="Tải lại danh sách quán" className="flex h-11 w-11 items-center justify-center rounded-xl text-text-muted hover:bg-secondary hover:text-accent" title="Tải lại danh sách"><RotateCw size={16} className={loading || isRefreshing ? 'animate-spin text-accent' : ''} /></button>
            <div className="md:hidden"><ThemeToggle /></div>
          </div>
        </header>

        <div className="flex min-h-[52px] items-center rounded-2xl border border-border bg-card px-3 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <Search size={19} className="mr-2 shrink-0 text-accent" />
          <input aria-label="Tìm món, tên quán hoặc địa chỉ" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm món, quán hoặc con phố..." className="min-w-0 flex-1 bg-transparent py-3 text-sm text-foreground placeholder:text-text-muted focus:outline-none" />
          {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Xóa từ khóa" className="flex min-h-11 min-w-11 items-center justify-center text-sm text-text-muted hover:text-foreground">Xóa</button>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Chọn quán ngẫu nhiên" onClick={() => setShowRandomModal(true)} className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-[var(--btn-primary-text)] shadow-sm hover:bg-[var(--btn-primary-hover)]"><Dices size={17} /> Chọn giúp một quán</button>
          <Link href="/saved" aria-label="Mở danh sách quán đã lưu" className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-text-secondary hover:text-accent"><Bookmark size={16} /> Đã lưu{bookmarkedIds.length ? ` · ${bookmarkedIds.length}` : ''}</Link>
          <div className="ml-auto flex items-center rounded-xl border border-border bg-card p-0.5">
            <button type="button" aria-label="Xem danh sách gọn" aria-pressed={viewMode === 'compact'} onClick={() => handleToggleViewMode('compact')} className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg ${viewMode === 'compact' ? 'bg-secondary text-accent' : 'text-text-secondary hover:text-foreground'}`}><List size={17} /></button>
            <button type="button" aria-label="Xem lưới ảnh" aria-pressed={viewMode === 'grid'} onClick={() => handleToggleViewMode('grid')} className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg ${viewMode === 'grid' ? 'bg-secondary text-accent' : 'text-text-secondary hover:text-foreground'}`}><LayoutGrid size={17} /></button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-text-secondary">Gần khu vực nào?</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DISTRICTS.slice(0, 5).map((district) => {
                const active = selectedDistricts.includes(district);
                return <button key={district} type="button" aria-pressed={active} onClick={() => setSelectedDistricts(active ? selectedDistricts.filter((value) => value !== district) : [...selectedDistricts, district])} className={`min-h-11 shrink-0 rounded-full border px-3 text-xs font-medium ${active ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card text-text-secondary hover:border-accent/50'}`}>{district}</button>;
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-text-secondary">Hôm nay đi dịp gì?</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {OCCASIONS.slice(0, 4).map((occasion) => {
                const active = selectedOccasions.includes(occasion.slug);
                return <button key={occasion.slug} type="button" aria-pressed={active} onClick={() => setSelectedOccasions(active ? selectedOccasions.filter((value) => value !== occasion.slug) : [...selectedOccasions, occasion.slug])} className={`min-h-11 shrink-0 rounded-full border px-3 text-xs font-medium ${active ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card text-text-secondary hover:border-accent/50'}`}>{occasion.label}</button>;
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Streamlined Sticky Filter Bar (Single clean row with 3-bar drawer button on right) */}
      <section className="sticky top-0 md:top-[72px] z-30 py-2.5 bg-background/90 backdrop-blur-xl border-y border-border/50 -mx-3 px-3 sm:mx-0 sm:px-0 sm:border-x-0 mb-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <FilterBar
              selectedCategories={selectedCategories}
              selectedOccasions={selectedOccasions}
              selectedDistricts={selectedDistricts}
              selectedRating={selectedRating}
              sortMode={sortMode}
              onCategoriesChange={setSelectedCategories}
              onOccasionsChange={setSelectedOccasions}
              onDistrictsChange={setSelectedDistricts}
              onRatingChange={setSelectedRating}
              onSortModeChange={setSortMode}
              onReset={handleResetFilters}
              totalCount={filteredRestaurants.length}
              savedOnly={filters.saved}
              onSavedChange={(saved) => updateFilter('saved', saved)}
            />
          </div>
          <Link href={buildFilterHref('/map', filters)} aria-label="Xem bản đồ với bộ lọc hiện tại" className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-text-secondary hover:text-accent">
            <MapPin size={15} />Bản đồ
          </Link>
        </div>
      </section>

      {/* 5. Restaurant Feed (High Density, Autofit) */}
      <section>
        {loading ? (
          <SkeletonGrid count={6} />
        ) : fetchError ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="state-panel mt-4"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-secondary flex items-center justify-center text-text-muted">
              <WifiOff size={22} className="text-accent-red" />
            </div>
            <h3 className="font-editorial text-base font-bold text-foreground mb-1">
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
            className="state-panel mt-4"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-secondary flex items-center justify-center text-text-muted">
              <UtensilsCrossed size={22} className="text-accent" />
            </div>
            <h3 className="font-editorial text-base font-bold text-foreground mb-1">
              {showOnlyBookmarks ? 'Chưa có quán nào trong mục Đã lưu' : 'Không tìm thấy quán phù hợp'}
            </h3>
            <p className="text-xs text-text-secondary mb-4">
              {showOnlyBookmarks
                ? 'Bấm biểu tượng lưu ở góc thẻ quán. Danh sách được giữ trên trình duyệt và thiết bị này.'
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
                <span className="text-xs text-text-muted">
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

