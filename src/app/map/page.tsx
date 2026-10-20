'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';
import { ArrowLeft, Loader2, MapPin, Search, X } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { buildFilterHref, filterRestaurants } from '@/lib/filters';
import { useRestaurantFilters } from '@/lib/useRestaurantFilters';
import { getBookmarks } from '@/lib/bookmarks';

const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="state-panel h-full w-full border-0 bg-card/60 shadow-none">
      <Loader2 className="mb-3 animate-spin text-accent" size={32} />
      <p className="text-sm font-medium text-text-secondary">Đang tải bản đồ quán ăn...</p>
    </div>
  ),
});

export default function MapPage() {
  const { filters, updateFilter, resetFilters, ready } = useRestaurantFilters();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [listPath, setListPath] = useState('/');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    supabase.from('restaurants').select('*').order('created_at', { ascending: false }).then(({ data, error: queryError }) => {
      if (!active) return;
      setError(!!queryError);
      setRestaurants(queryError ? [] : (data as Restaurant[]) || []);
      setLoading(false);
    }, () => {
      if (active) { setError(true); setLoading(false); }
    });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    const sync = () => setBookmarkedIds(getBookmarks());
    sync();
    window.addEventListener('food_hn_bookmarks_updated', sync);
    window.addEventListener('storage', sync);
    const searchOrigin = new URLSearchParams(window.location.search).get('from') === 'search';
    setListPath(searchOrigin ? '/search' : '/');
    return () => {
      window.removeEventListener('food_hn_bookmarks_updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const filteredRestaurants = useMemo(
    () => filterRestaurants(restaurants, filters, bookmarkedIds),
    [restaurants, filters, bookmarkedIds],
  );
  const listHref = buildFilterHref(listPath, filters);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-80px)] w-full max-w-7xl flex-col gap-3 px-3 py-3 md:min-h-[calc(100dvh-72px)] md:px-5">
      <header className="shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <MapPin size={19} className="shrink-0 text-accent" />
            <h1 className="truncate text-sm font-bold text-foreground">Bản đồ quán ăn</h1>
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-text-muted">{filteredRestaurants.length} quán</span>
          </div>
          <Link href={listHref} aria-label="Quay lại danh sách với bộ lọc hiện tại" className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-text-secondary hover:text-accent">
            <ArrowLeft size={15} />Danh sách
          </Link>
        </div>
        <div className="flex min-h-11 items-center rounded-xl border border-border bg-card px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <Search size={16} className="mr-2 shrink-0 text-text-muted" />
          <input aria-label="Tìm quán trên bản đồ" value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} placeholder="Tìm tên quán, món ăn, địa chỉ..." className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none" />
          {filters.query && <button type="button" aria-label="Xóa từ khóa" onClick={() => updateFilter('query', '')} className="flex min-h-11 min-w-11 items-center justify-center text-text-muted hover:text-foreground"><X size={16} /></button>}
        </div>
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
          totalCount={filteredRestaurants.length}
          savedOnly={filters.saved}
          onSavedChange={(saved) => updateFilter('saved', saved)}
        />
      </header>

      <section className="map-viewport relative overflow-hidden rounded-2xl border border-border bg-bg-primary">
        {error ? (
          <div className="state-panel min-h-full space-y-3 rounded-none border-0 bg-bg-primary shadow-none"><p role="alert" className="text-sm text-text-secondary">Chưa tải được dữ liệu bản đồ. Kiểm tra kết nối rồi thử lại.</p><button type="button" onClick={() => setAttempt((current) => current + 1)} className="btn-secondary">Thử lại</button></div>
        ) : loading || !ready ? (
          <div className="state-panel h-full min-h-[26rem] rounded-none border-0 bg-bg-primary shadow-none"><Loader2 className="mb-2 animate-spin text-accent" size={28} /><p className="text-sm text-text-secondary">Đang kết nối dữ liệu...</p></div>
        ) : (
          <>
            <MapComponent restaurants={filteredRestaurants} />
            {filteredRestaurants.length === 0 && <div role="status" className="absolute bottom-4 left-1/2 z-[1000] w-[min(90%,28rem)] -translate-x-1/2 rounded-xl border border-border bg-card/95 p-3 text-center text-sm text-text-secondary shadow-lg">Không có quán khớp bộ lọc. Hãy nới điều kiện để xem thêm địa điểm.</div>}
          </>
        )}
      </section>
    </div>
  );
}
