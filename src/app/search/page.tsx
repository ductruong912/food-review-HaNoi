'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Search as SearchIcon, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
import RestaurantCard from '@/components/RestaurantCard';
import FilterBar from '@/components/FilterBar';
import { SkeletonGrid } from '@/components/SkeletonCard';
import { buildFilterHref, filterRestaurants, hasRestaurantFilterCriteria } from '@/lib/filters';
import { useRestaurantFilters } from '@/lib/useRestaurantFilters';
import { getBookmarks } from '@/lib/bookmarks';
import { consumePendingScrollPosition } from '@/lib/restaurantNavigation';

const EXAMPLE_QUERIES = ['bún chả', 'phở', 'cà phê'];

export default function SearchPage() {
  const { filters, updateFilter, resetFilters, ready } = useRestaurantFilters();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFetchError(false);
    supabase.from('restaurants').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      setFetchError(!!error);
      setRestaurants(error ? [] : (data as Restaurant[]) || []);
      setLoading(false);
    }, () => {
      if (active) { setFetchError(true); setLoading(false); }
    });
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    const sync = () => setBookmarkedIds(getBookmarks());
    sync();
    window.addEventListener('food_hn_bookmarks_updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('food_hn_bookmarks_updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (!ready || loading) return;
    const scrollPosition = consumePendingScrollPosition();
    if (scrollPosition !== null) requestAnimationFrame(() => window.scrollTo(0, scrollPosition));
  }, [ready, loading]);

  const results = useMemo(
    () => filterRestaurants(restaurants, filters, bookmarkedIds),
    [restaurants, filters, bookmarkedIds],
  );
  const searched = hasRestaurantFilterCriteria(filters);
  const mapHref = buildFilterHref('/map', filters, { from: 'search' });

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:py-7">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><SearchIcon size={20} className="text-accent" /><h1 className="text-xl font-bold text-foreground">Tìm kiếm</h1></div>
          <Link href={mapHref} aria-label="Xem kết quả tìm kiếm trên bản đồ" className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-text-secondary hover:text-accent"><MapPin size={15} />Bản đồ</Link>
        </div>

        <div className="flex min-h-12 items-center rounded-2xl border border-border bg-card px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <SearchIcon size={18} className="mr-2 shrink-0 text-text-muted" />
          <input aria-label="Tìm quán, món ăn hoặc địa chỉ" type="text" value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} placeholder="Tìm quán, món ăn, địa chỉ, nhận xét..." className="min-w-0 flex-1 bg-transparent py-3 text-sm text-foreground placeholder:text-text-muted focus:outline-none" />
          {filters.query && <button type="button" aria-label="Xóa từ khóa" onClick={() => updateFilter('query', '')} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-text-muted hover:bg-secondary hover:text-foreground"><X size={16} /></button>}
        </div>

        <section aria-label="Bộ lọc quán" className="my-3 rounded-xl border-y border-border/50 bg-background/90 py-2">
          <FilterBar
            selectedCategories={filters.categories}
            selectedOccasions={filters.occasions}
            selectedDistricts={filters.districts}
            selectedRating={filters.rating}
            sortMode={filters.sort}
            onCategoriesChange={(value) => updateFilter('categories', value)}
            onOccasionsChange={(value) => updateFilter('occasions', value)}
            onDistrictsChange={(value) => updateFilter('districts', value)}
            onRatingChange={(value) => updateFilter('rating', value)}
            onSortModeChange={(value) => updateFilter('sort', value)}
            onReset={resetFilters}
            totalCount={results.length}
            savedOnly={filters.saved}
            onSavedChange={(saved) => updateFilter('saved', saved)}
          />
        </section>
      </motion.div>

      <div className="mt-5">
        {loading || !ready ? <SkeletonGrid count={4} /> : fetchError ? (
          <div className="state-panel space-y-3" role="alert"><p className="text-sm text-text-secondary">Không tải được danh sách quán. Hãy thử kết nối lại.</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="btn-secondary">Thử lại</button></div>
        ) : !searched ? (
          <div className="state-panel">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-accent"><SearchIcon size={22} /></div>
            <h2 className="mb-2 text-lg font-bold text-foreground">Bắt đầu với một món hoặc khu vực</h2>
            <p className="mx-auto mb-5 max-w-lg text-sm text-text-secondary">Gõ tên món, tên quán, con phố; hoặc mở bộ lọc để chọn nhiều quận, loại quán và dịp đi ăn.</p>
            <div className="mb-5 flex flex-wrap justify-center gap-2">
              {EXAMPLE_QUERIES.map((query) => <button key={query} type="button" onClick={() => updateFilter('query', query)} className="min-h-11 rounded-full border border-border bg-background px-4 text-sm text-text-secondary hover:border-accent hover:text-accent">{query}</button>)}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {CATEGORIES.slice(0, 4).map((category) => <button key={category.slug} type="button" onClick={() => updateFilter('categories', [...filters.categories, category.slug])} className="min-h-11 rounded-xl bg-accent/10 px-3 text-xs font-semibold text-accent hover:bg-accent/20">{category.label}</button>)}
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="state-panel">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-text-muted"><SearchIcon size={24} /></div>
            <h2 className="mb-1 text-lg font-bold text-foreground">Không tìm thấy quán khớp bộ lọc</h2>
            <p className="text-sm text-text-muted">Thử từ khóa khác hoặc chủ động bỏ bớt một vài điều kiện.</p>
            <button type="button" onClick={resetFilters} className="mt-4 min-h-11 rounded-xl bg-accent px-4 font-semibold text-bg-primary">Xóa bộ lọc</button>
          </div>
        ) : (
          <>
            <p className="mb-4 text-xs text-text-muted">Tìm thấy {results.length} kết quả</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">{results.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} />)}</div>
          </>
        )}
      </div>
    </div>
  );
}
