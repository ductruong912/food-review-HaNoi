'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  RotateCcw,
  Compass,
  MapPin,
  Sparkles,
  Check,
} from 'lucide-react';
import { CATEGORIES, DISTRICTS, OCCASIONS, RATING_OPTIONS } from '@/lib/types';
import { CategoryIcon, RatingIcon } from '@/components/Icons';
import { useModalFocus } from './useModalFocus';

export type SortMode = 'newest' | 'name' | 'trending';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
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
}

export default function FilterDrawer({
  isOpen,
  onClose,
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
}: FilterDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useModalFocus(isOpen && mounted, onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const activeFilterCount =
    (selectedCategories.length > 0 ? 1 : 0) +
    (selectedOccasions.length > 0 ? 1 : 0) +
    (selectedDistricts.length > 0 ? 1 : 0) +
    (selectedRating ? 1 : 0);

  const toggleCategory = (slug: string) => {
    if (selectedCategories.includes(slug)) {
      onCategoriesChange(selectedCategories.filter((s) => s !== slug));
    } else {
      onCategoriesChange([...selectedCategories, slug]);
    }
  };

  const toggleDistrict = (dist: string) => {
    if (selectedDistricts.includes(dist)) {
      onDistrictsChange(selectedDistricts.filter((d) => d !== dist));
    } else {
      onDistrictsChange([...selectedDistricts, dist]);
    }
  };

  const toggleOccasion = (slug: string) => {
    onOccasionsChange(selectedOccasions.includes(slug) ? selectedOccasions.filter((item) => item !== slug) : [...selectedOccasions, slug]);
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
          />

          {/* Slide-over Drawer Panel */}
          <motion.div
            ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Bộ lọc quán"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full sm:w-[420px] h-dvh bg-card border-l border-border shadow-2xl flex flex-col z-[101] overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-border/80 flex items-center justify-between bg-card">
              <div className="flex items-center gap-2.5">
                <div className="flex flex-col gap-1 w-4 text-accent">
                  <span className="h-0.5 w-full bg-current rounded-full" />
                  <span className="h-0.5 w-3/4 bg-current rounded-full" />
                  <span className="h-0.5 w-full bg-current rounded-full" />
                </div>
                <h2 className="text-base font-bold text-foreground">Bộ lọc</h2>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-accent/15 text-accent border border-accent/25">
                    {activeFilterCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {activeFilterCount > 0 && (
                  <button
                    onClick={onReset}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-text-muted hover:text-accent transition-colors rounded-lg hover:bg-white/5"
                    title="Đặt lại bộ lọc"
                  >
                    <RotateCcw size={13} />
                    <span>Đặt lại</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  aria-label="Đóng bộ lọc"
                  className="p-3 rounded-xl text-text-muted hover:text-foreground hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Drawer Body - Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 divide-y divide-border/40">

              {/* Section 1: Danh mục — multi-select */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                  <Compass size={14} className="text-accent" />
                  <span>Danh mục quán</span>
                  {selectedCategories.length > 0 && (
                    <span className="ml-auto text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                      {selectedCategories.length} đã chọn
                    </span>
                  )}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onCategoriesChange([])}
                    aria-pressed={selectedCategories.length === 0}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      selectedCategories.length === 0
                        ? 'bg-accent text-foreground border-accent shadow-sm'
                        : 'bg-secondary/60 border-border/70 text-text-secondary hover:border-accent/30 hover:text-foreground'
                    }`}
                  >
                    <Compass size={14} />
                    <span>Tất cả</span>
                  </button>
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategories.includes(cat.slug);
                    return (
                      <button
                        key={cat.slug}
                        aria-pressed={isSelected}
                        onClick={() => toggleCategory(cat.slug)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-accent text-foreground border-accent shadow-sm'
                            : 'bg-secondary/60 border-border/70 text-text-secondary hover:border-accent/30 hover:text-foreground'
                        }`}
                      >
                        <CategoryIcon slug={cat.slug} size={14} />
                        <span>{cat.label}</span>
                        {isSelected && <Check size={12} className="ml-0.5 opacity-80" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                  <Sparkles size={14} className="text-accent" />
                  <span>Phù hợp cho</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {OCCASIONS.map((occasion) => {
                    const isSelected = selectedOccasions.includes(occasion.slug);
                    return <button key={occasion.slug} aria-pressed={isSelected} onClick={() => toggleOccasion(occasion.slug)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${isSelected ? 'bg-accent text-foreground border-accent shadow-sm' : 'bg-secondary/60 border-border/70 text-text-secondary hover:border-accent/30 hover:text-foreground'}`}>
                      <span>{occasion.label}</span>{isSelected && <Check size={12} />}
                    </button>;
                  })}
                </div>
              </div>

              {/* Section 2: Đánh giá */}
              <div className="pt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                  <Sparkles size={14} className="text-accent" />
                  <span>Mức độ đánh giá</span>
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onRatingChange('')}
                    aria-pressed={!selectedRating}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      !selectedRating
                        ? 'bg-accent/15 text-accent border-accent/40'
                        : 'bg-secondary/60 border-border/70 text-text-secondary hover:border-accent/30'
                    }`}
                  >
                    <span>Tất cả đánh giá</span>
                    {!selectedRating && <Check size={14} />}
                  </button>
                  {RATING_OPTIONS.map((opt) => {
                    const isSelected = selectedRating === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => onRatingChange(isSelected ? '' : opt.value)}
                        aria-pressed={isSelected}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-accent/15 text-accent border-accent/40'
                            : 'bg-secondary/60 border-border/70 text-text-secondary hover:border-accent/30'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <RatingIcon rating={opt.value} size={13} />
                          <span className="truncate">{opt.label}</span>
                        </div>
                        {isSelected && <Check size={14} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Quận/Huyện — multi-select grid */}
              <div className="pt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                  <MapPin size={14} className="text-accent" />
                  <span>Khu vực / Quận</span>
                  {selectedDistricts.length > 0 && (
                    <span className="ml-auto text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                      {selectedDistricts.length} đã chọn
                    </span>
                  )}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onDistrictsChange([])}
                    aria-pressed={selectedDistricts.length === 0}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      selectedDistricts.length === 0
                        ? 'bg-accent/15 text-accent border-accent/40'
                        : 'bg-secondary/60 border-border/70 text-text-secondary hover:border-accent/30'
                    }`}
                  >
                    <span>Tất cả quận</span>
                    {selectedDistricts.length === 0 && <Check size={14} />}
                  </button>
                  {DISTRICTS.map((dist) => {
                    const isSelected = selectedDistricts.includes(dist);
                    return (
                      <button
                        key={dist}
                        onClick={() => toggleDistrict(dist)}
                        aria-pressed={isSelected}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-accent/15 text-accent border-accent/40'
                            : 'bg-secondary/60 border-border/70 text-text-secondary hover:border-accent/30'
                        }`}
                      >
                        <span className="truncate">{dist}</span>
                        {isSelected && <Check size={14} className="shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-3"><label htmlFor="filter-sort" className="block text-sm mb-2">Sắp xếp</label><select id="filter-sort" value={sortMode} onChange={e => onSortModeChange(e.target.value as SortMode)} className="w-full rounded-xl border border-border bg-card px-3 py-3 text-foreground"><option value="newest">Mới nhất</option><option value="name">Tên A–Z</option><option value="trending">Đánh giá tốt trước</option></select></div>
            <div className="p-4 border-t border-border/80 bg-card/95 backdrop-blur-md flex items-center gap-3">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={onReset}
                  className="px-4 py-3 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:text-foreground hover:border-accent/30 transition-colors"
                >
                  Đặt lại
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl gradient-warm text-foreground font-bold text-sm shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <span>Xem kết quả</span>
                <span className="text-xs font-normal opacity-90">({totalCount} quán)</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
