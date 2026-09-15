'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  RotateCcw,
  Clock,
  TrendingUp,
  Flame,
  Compass,
  MapPin,
  Sparkles,
  ChevronDown,
  Check,
} from 'lucide-react';
import { CATEGORIES, DISTRICTS, RATING_OPTIONS } from '@/lib/types';
import { CategoryIcon, RatingIcon } from '@/components/Icons';

export type SortMode = 'newest' | 'name' | 'trending';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
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

export default function FilterDrawer({
  isOpen,
  onClose,
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
    (selectedCategory ? 1 : 0) +
    (selectedDistrict ? 1 : 0) +
    (selectedRating ? 1 : 0) +
    (sortMode !== 'newest' ? 1 : 0);

  const sortOptions: { mode: SortMode; icon: typeof Clock; label: string }[] = [
    { mode: 'newest', icon: Clock, label: 'Mới nhất' },
    { mode: 'name', icon: TrendingUp, label: 'Tên A-Z' },
    { mode: 'trending', icon: Flame, label: 'Đang hot' },
  ];

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
                {/* 3-bar icon symbol */}
                <div className="flex flex-col gap-1 w-4 text-accent">
                  <span className="h-0.5 w-full bg-current rounded-full" />
                  <span className="h-0.5 w-3/4 bg-current rounded-full" />
                  <span className="h-0.5 w-full bg-current rounded-full" />
                </div>
                <h2 className="text-base font-bold text-white">Bộ lọc & Sắp xếp</h2>
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
              {/* Section 1: Sắp xếp */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-accent" />
                  <span>Sắp xếp theo</span>
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {sortOptions.map(({ mode, icon: Icon, label }) => {
                    const isSelected = sortMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => onSortModeChange(mode)}
                        className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-accent/15 text-accent border-accent/40 shadow-sm'
                            : 'bg-secondary/60 border-border/70 text-text-secondary hover:border-accent/30 hover:text-white'
                        }`}
                      >
                        <Icon size={16} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Danh mục */}
              <div className="pt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                  <Compass size={14} className="text-accent" />
                  <span>Danh mục quán</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onCategoryChange('')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      !selectedCategory
                        ? 'bg-accent text-white border-accent shadow-sm'
                        : 'bg-secondary/60 border-border/70 text-text-secondary hover:border-accent/30 hover:text-white'
                    }`}
                  >
                    <Compass size={14} />
                    <span>Tất cả</span>
                  </button>
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.slug;
                    return (
                      <button
                        key={cat.slug}
                        onClick={() => onCategoryChange(isSelected ? '' : cat.slug)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-accent text-white border-accent shadow-sm'
                            : 'bg-secondary/60 border-border/70 text-text-secondary hover:border-accent/30 hover:text-white'
                        }`}
                      >
                        <CategoryIcon slug={cat.slug} size={14} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Đánh giá */}
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

              {/* Section 4: Quận/Huyện */}
              <div className="pt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                  <MapPin size={14} className="text-accent" />
                  <span>Khu vực / Quận</span>
                </h3>
                <div className="relative">
                  <select
                    value={selectedDistrict}
                    onChange={(e) => onDistrictChange(e.target.value)}
                    className="w-full appearance-none px-4 py-3 pr-9 rounded-xl bg-secondary/70 border border-border text-sm text-white focus:outline-none focus:border-accent transition-colors cursor-pointer"
                  >
                    <option value="">Tất cả quận / huyện</option>
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                    <ChevronDown size={16} />
                  </div>
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
