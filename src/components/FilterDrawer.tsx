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
import { CATEGORIES, DISTRICTS, RATING_OPTIONS } from '@/lib/types';
import { CategoryIcon, RatingIcon } from '@/components/Icons';

export type SortMode = 'newest' | 'name' | 'trending';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategories: string[];
  selectedDistricts: string[];
  selectedRating: string;
  sortMode: SortMode;
  onCategoriesChange: (categories: string[]) => void;
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
  selectedDistricts,
  selectedRating,
  sortMode,
  onCategoriesChange,
  onDistrictsChange,
  onRatingChange,
  onSortModeChange,
  onReset,
  totalCount,
}: FilterDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  const activeFilterCount =
    (selectedCategories.length > 0 ? 1 : 0) +
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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full sm:w-[420px] h-screen bg-card border-l border-border shadow-2xl flex flex-col z-[101] overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-border/80 flex items-center justify-between bg-card">
              <div className="flex items-center gap-2.5">
                <div className="flex flex-col gap-1 w-4 text-accent">
                  <span className="h-0.5 w-full bg-current rounded-full" />
                  <span className="h-0.5 w-3/4 bg-current rounded-full" />
                  <span className="h-0.5 w-full bg-current rounded-full" />
                </div>
                <h2 className="text-base font-bold text-white">Bộ lọc</h2>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-accent/15 text-accent border border-accent/25">
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
                  className="p-1.5 rounded-xl text-text-muted hover:text-white hover:bg-white/10 transition-colors"
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
                    <span className="ml-auto text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                      {selectedCategories.length} đã chọn
                    </span>
                  )}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onCategoriesChange([])}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      selectedCategories.length === 0
                        ? 'bg-accent text-white border-accent shadow-sm'
                        : 'bg-secondary/60 border-border/70 text-text-secondary hover:border-accent/30 hover:text-white'
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
                        onClick={() => toggleCategory(cat.slug)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-accent text-white border-accent shadow-sm'
                            : 'bg-secondary/60 border-border/70 text-text-secondary hover:border-accent/30 hover:text-white'
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

              {/* Section 2: Đánh giá */}
              <div className="pt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                  <Sparkles size={14} className="text-accent" />
                  <span>Mức độ đánh giá</span>
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onRatingChange('')}
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
                    <span className="ml-auto text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                      {selectedDistricts.length} đã chọn
                    </span>
                  )}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onDistrictsChange([])}
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
            <div className="p-4 border-t border-border/80 bg-card/95 backdrop-blur-md flex items-center gap-3">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={onReset}
                  className="px-4 py-3 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:text-white hover:border-accent/30 transition-colors"
                >
                  Đặt lại
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl gradient-warm text-white font-bold text-sm shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <span>Áp dụng</span>
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
