'use client';

import { useState } from 'react';
import { X, Clock, MapPin, TrendingUp, Star, Bookmark } from 'lucide-react';
import { CATEGORIES, OCCASION_MAP, RATING_MAP, type CategorySlug, type RatingLabel } from '@/lib/types';
import { CategoryIcon, RatingIcon } from '@/components/Icons';
import FilterDrawer from '@/components/FilterDrawer';
import type { SortMode } from '@/lib/filters';

interface FilterBarProps {
  selectedCategories: string[];
  selectedOccasions: string[];
  selectedDistricts: string[];
  selectedRating: string;
  sortMode: SortMode;
  onCategoriesChange: (categories: string[]) => void;
  onOccasionsChange: (occasions: string[]) => void;
  onDistrictsChange: (districts: string[]) => void;
  onRatingChange: (rating: string) => void;
  onSortModeChange: (sortMode: SortMode) => void;
  onReset: () => void;
  totalCount: number;
  savedOnly: boolean;
  onSavedChange: (saved: boolean) => void;
}

export default function FilterBar({
  selectedCategories,
  selectedOccasions,
  selectedDistricts,
  selectedRating,
  sortMode,
  onCategoriesChange,
  onOccasionsChange,
  onDistrictsChange,
  onRatingChange,
  onSortModeChange,
  onReset,
  totalCount,
  savedOnly,
  onSavedChange,
}: FilterBarProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const activeFilterCount =
    (selectedCategories.length > 0 ? 1 : 0) +
    (selectedOccasions.length > 0 ? 1 : 0) +
    (selectedDistricts.length > 0 ? 1 : 0) +
    (selectedRating ? 1 : 0) +
    (savedOnly ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const currentRatingInfo = selectedRating ? RATING_MAP[selectedRating as RatingLabel] : null;

  const sortLabel =
    sortMode === 'name' ? 'Tên A-Z' : sortMode === 'trending' ? 'Đánh giá tốt trước' : 'Mới nhất';

  const SortIcon =
    sortMode === 'name' ? TrendingUp : sortMode === 'trending' ? Star : Clock;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {/* Left: Active filter pills or summary status */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 flex-1 min-w-0">
          {!hasActiveFilters ? (
            <div className="flex items-center gap-2.5 text-xs text-text-secondary">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/70 text-text-muted">
                <SortIcon size={13} className="text-accent" />
                <span>{sortLabel}</span>
              </span>
              <span className="text-xs text-text-muted">
                <strong className="text-foreground font-semibold">{totalCount}</strong> quán ăn
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Category chips */}
              {selectedCategories.map((slug) => {
                const cat = CATEGORIES.find((c) => c.slug === slug);
                return (
                  <span
                    key={slug}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-accent/15 text-accent border border-accent/30 shrink-0"
                  >
                    <CategoryIcon slug={slug as CategorySlug} size={12} />
                    <span>{cat?.label || slug}</span>
                    <button
                      type="button"
                      onClick={() => onCategoriesChange(selectedCategories.filter((s) => s !== slug))}
                      aria-label={`Bỏ lọc loại quán ${cat?.label || slug}`}
                      className="flex min-h-11 min-w-11 items-center justify-center hover:text-foreground transition-colors cursor-pointer"
                      title="Bỏ chọn danh mục"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}

              {selectedOccasions.map((slug) => (
                <span key={slug} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-accent/15 text-accent border border-accent/30 shrink-0">
                  <span>{OCCASION_MAP[slug as keyof typeof OCCASION_MAP] || slug}</span>
                  <button type="button" onClick={() => onOccasionsChange(selectedOccasions.filter((item) => item !== slug))} aria-label={`Bỏ lọc dịp ${OCCASION_MAP[slug as keyof typeof OCCASION_MAP] || slug}`} className="flex min-h-11 min-w-11 items-center justify-center hover:text-foreground transition-colors cursor-pointer" title="Bỏ chọn phù hợp cho"><X size={12} /></button>
                </span>
              ))}

              {/* District chips */}
              {selectedDistricts.map((dist) => (
                <span
                  key={dist}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-accent/15 text-accent border border-accent/30 shrink-0"
                >
                  <MapPin size={12} />
                  <span>{dist}</span>
                  <button
                    type="button"
                    onClick={() => onDistrictsChange(selectedDistricts.filter((d) => d !== dist))}
                    aria-label={`Bỏ lọc quận ${dist}`}
                    className="flex min-h-11 min-w-11 items-center justify-center hover:text-foreground transition-colors cursor-pointer"
                    title="Bỏ chọn quận"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}

              {/* Rating chip */}
              {selectedRating && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-accent/15 text-accent border border-accent/30 shrink-0">
                  <RatingIcon rating={selectedRating as RatingLabel} size={12} />
                  <span>{currentRatingInfo?.label || selectedRating}</span>
                  <button
                    type="button"
                    onClick={() => onRatingChange('')}
                    aria-label="Bỏ lọc cảm nhận"
                    className="flex min-h-11 min-w-11 items-center justify-center hover:text-foreground transition-colors cursor-pointer"
                    title="Bỏ chọn đánh giá"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {savedOnly && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent"><Bookmark size={12} />Đã lưu<button type="button" onClick={() => onSavedChange(false)} aria-label="Xóa nhãn bộ lọc quán đã lưu" className="flex min-h-11 min-w-11 items-center justify-center" title="Bỏ lọc quán đã lưu"><X size={12} /></button></span>}

              {/* Clear all */}
              <button
                type="button"
                aria-label="Xóa tất cả bộ lọc"
                onClick={onReset}
                className="text-xs text-text-muted hover:text-accent-red px-2 py-1 transition-colors font-medium shrink-0 cursor-pointer"
              >
                Xóa tất cả
              </button>
            </div>
          )}
        </div>

        {/* Right: 3-bar button */}
        <div className="shrink-0 flex items-center">
          <button type="button" aria-label={savedOnly ? 'Bỏ lọc quán đã lưu' : 'Chỉ xem quán đã lưu'} aria-pressed={savedOnly} onClick={() => onSavedChange(!savedOnly)} title={savedOnly ? 'Đang chỉ xem quán đã lưu' : 'Chỉ xem quán đã lưu'} className={`mr-1 flex h-11 w-11 items-center justify-center rounded-xl border ${savedOnly ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card text-text-secondary hover:text-accent'}`}><Bookmark size={16} fill={savedOnly ? 'currentColor' : 'none'} /></button>
          <button
            type="button"
            aria-label="Mở bộ lọc"
            onClick={() => setIsDrawerOpen(true)}
            className={`flex min-h-11 items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all shadow-sm cursor-pointer group ${
              hasActiveFilters
                ? 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25'
                : 'bg-card border-border hover:border-accent/40 text-text-secondary hover:text-foreground'
            }`}
            title="Mở bộ lọc"
          >
            <div className="flex flex-col gap-1 w-4">
              <span
                className={`h-0.5 w-full rounded-full transition-all ${
                  hasActiveFilters ? 'bg-accent' : 'bg-current'
                }`}
              />
              <span
                className={`h-0.5 w-3/4 rounded-full transition-all group-hover:w-full ${
                  hasActiveFilters ? 'bg-accent' : 'bg-current'
                }`}
              />
              <span
                className={`h-0.5 w-full rounded-full transition-all ${
                  hasActiveFilters ? 'bg-accent' : 'bg-current'
                }`}
              />
            </div>

            <span className="text-xs font-bold tracking-wide">Bộ lọc</span>

            {hasActiveFilters && (
              <span className="w-5 h-5 rounded-full bg-accent text-foreground text-xs font-bold flex items-center justify-center -mr-1 shadow-sm">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter Slide-over Drawer */}
      <FilterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        selectedCategories={selectedCategories}
        selectedOccasions={selectedOccasions}
        selectedDistricts={selectedDistricts}
        selectedRating={selectedRating}
        sortMode={sortMode}
        onCategoriesChange={onCategoriesChange}
        onOccasionsChange={onOccasionsChange}
        onDistrictsChange={onDistrictsChange}
        onRatingChange={onRatingChange}
        onSortModeChange={onSortModeChange}
        onReset={onReset}
        totalCount={totalCount}
      />
    </>
  );
}
