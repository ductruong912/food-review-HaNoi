'use client';

import { useState } from 'react';
import { X, Clock, MapPin, TrendingUp, Flame } from 'lucide-react';
import { CATEGORIES, RATING_MAP, type CategorySlug, type RatingLabel } from '@/lib/types';
import { CategoryIcon, RatingIcon } from '@/components/Icons';
import FilterDrawer, { type SortMode } from '@/components/FilterDrawer';

interface FilterBarProps {
  selectedCategory: string;
  selectedDistrict: string;
  selectedRating: string;
  sortMode: SortMode;
  onCategoryChange: (category: string) => void;
  onDistrictChange: (district: string) => void;
  onRatingChange: (rating: string) => void;
  onSortModeChange: (sortMode: SortMode) => void;
  onReset: () => void;
  totalCount: number;
}

export default function FilterBar({
  selectedCategory,
  selectedDistrict,
  selectedRating,
  sortMode,
  onCategoryChange,
  onDistrictChange,
  onRatingChange,
  onSortModeChange,
  onReset,
  totalCount,
}: FilterBarProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const activeFilterCount =
    (selectedCategory ? 1 : 0) +
    (selectedDistrict ? 1 : 0) +
    (selectedRating ? 1 : 0) +
    (sortMode !== 'newest' ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const currentCategory = CATEGORIES.find((c) => c.slug === selectedCategory);
  const currentRatingInfo = selectedRating ? RATING_MAP[selectedRating as RatingLabel] : null;

  const sortLabel =
    sortMode === 'name' ? 'Tên A-Z' : sortMode === 'trending' ? 'Đang hot' : 'Mới nhất';

  const SortIcon =
    sortMode === 'name' ? TrendingUp : sortMode === 'trending' ? Flame : Clock;

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
                <strong className="text-white font-semibold">{totalCount}</strong> quán ăn
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Category chip */}
              {selectedCategory && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-accent/15 text-accent border border-accent/30 shrink-0">
                  <CategoryIcon slug={selectedCategory as CategorySlug} size={12} />
                  <span>{currentCategory?.label || selectedCategory}</span>
                  <button
                    onClick={() => onCategoryChange('')}
                    className="hover:text-white p-0.5 transition-colors"
                    title="Bỏ chọn danh mục"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {/* District chip */}
              {selectedDistrict && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-accent/15 text-accent border border-accent/30 shrink-0">
                  <MapPin size={12} />
                  <span>{selectedDistrict}</span>
                  <button
                    onClick={() => onDistrictChange('')}
                    className="hover:text-white p-0.5 transition-colors"
                    title="Bỏ chọn quận"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {/* Rating chip */}
              {selectedRating && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-accent/15 text-accent border border-accent/30 shrink-0">
                  <RatingIcon rating={selectedRating as RatingLabel} size={12} />
                  <span>{currentRatingInfo?.label || selectedRating}</span>
                  <button
                    onClick={() => onRatingChange('')}
                    className="hover:text-white p-0.5 transition-colors"
                    title="Bỏ chọn đánh giá"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {/* Sort chip if not default */}
              {sortMode !== 'newest' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-secondary text-text-secondary border border-border shrink-0">
                  <SortIcon size={12} />
                  <span>{sortLabel}</span>
                  <button
                    onClick={() => onSortModeChange('newest')}
                    className="hover:text-white p-0.5 transition-colors"
                    title="Về mặc định"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {/* Clear all */}
              <button
                onClick={onReset}
                className="text-[11px] text-text-muted hover:text-accent-red px-2 py-1 transition-colors font-medium shrink-0"
              >
                Xóa tất cả
              </button>
            </div>
          )}
        </div>

        {/* Right: 3-bar button ("thanh 3 gạch để chọn ở góc phải màn hình") */}
        <div className="shrink-0 flex items-center">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all shadow-sm cursor-pointer group ${
              hasActiveFilters
                ? 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25'
                : 'bg-card border-border hover:border-accent/40 text-text-secondary hover:text-white'
            }`}
            title="Mở bộ lọc & sắp xếp"
          >
            {/* 3-bar icon symbol */}
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
              <span className="w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center -mr-1 shadow-sm">
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
        selectedCategory={selectedCategory}
        selectedDistrict={selectedDistrict}
        selectedRating={selectedRating}
        sortMode={sortMode}
        onCategoryChange={onCategoryChange}
        onDistrictChange={onDistrictChange}
        onRatingChange={onRatingChange}
        onSortModeChange={onSortModeChange}
        onReset={onReset}
        totalCount={totalCount}
      />
    </>
  );
}
