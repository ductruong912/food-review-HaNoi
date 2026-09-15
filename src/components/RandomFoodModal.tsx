'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Restaurant } from '@/lib/types';
import { getDirectionsUrl } from '@/lib/geo';
import {
  Sparkles,
  Dices,
  Navigation,
  ExternalLink,
  RotateCcw,
  X,
  MapPin,
  Flame,
  Check,
} from 'lucide-react';
import Link from 'next/link';

interface RandomFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurants: Restaurant[];
}

const DISTRICT_OPTIONS = [
  'Tất cả',
  'Hoàn Kiếm',
  'Ba Đình',
  'Cầu Giấy',
  'Đống Đa',
  'Hai Bà Trưng',
  'Tây Hồ',
  'Thanh Xuân',
];

export default function RandomFoodModal({
  isOpen,
  onClose,
  restaurants,
}: RandomFoodModalProps) {
  const [selectedDistrict, setSelectedDistrict] = useState('Tất cả');
  const [onlyTopRated, setOnlyTopRated] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentResult, setCurrentResult] = useState<Restaurant | null>(null);
  const [shuffleDisplay, setShuffleDisplay] = useState<string>('Bấm để chọn món!');

  // Filter candidate pool
  const candidatePool = useMemo(() => {
    let pool = [...restaurants];
    if (onlyTopRated) {
      pool = pool.filter((r) => r.rating === 'ngon');
    } else {
      // Exclude 'khong_ngon' (avoid) from random picker
      pool = pool.filter((r) => r.rating !== 'khong_ngon');
    }
    if (selectedDistrict !== 'Tất cả') {
      pool = pool.filter((r) => r.district === selectedDistrict);
    }
    return pool;
  }, [restaurants, onlyTopRated, selectedDistrict]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentResult(null);
      setShuffleDisplay('Bấm để chọn món!');
      setIsSpinning(false);
    }
  }, [isOpen]);

  const handleSpin = () => {
    if (candidatePool.length === 0) return;

    setIsSpinning(true);
    setCurrentResult(null);

    let counter = 0;
    const totalSteps = 20;
    const intervalTime = 70;

    const timer = setInterval(() => {
      counter++;
      const randomIndex = Math.floor(Math.random() * candidatePool.length);
      setShuffleDisplay(candidatePool[randomIndex].name);

      if (counter >= totalSteps) {
        clearInterval(timer);
        const finalPick = candidatePool[Math.floor(Math.random() * candidatePool.length)];
        setCurrentResult(finalPick);
        setShuffleDisplay(finalPick.name);
        setIsSpinning(false);
      }
    }, intervalTime);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          className="relative w-full max-w-md bg-[#132A22] border border-border/80 rounded-3xl p-5 shadow-2xl overflow-hidden z-10"
        >
          {/* Top subtle glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-accent/15 blur-3xl rounded-full pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-card/80 text-text-muted hover:text-white border border-border/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Dices size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight flex items-center gap-1.5">
                Hôm nay ăn gì?
                <Sparkles size={14} className="text-accent animate-pulse" />
              </h2>
              <p className="text-[11px] text-text-muted">
                Bốc ngẫu nhiên quán ngon hợp vị Hà Nội
              </p>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="space-y-2 mb-4 bg-card/60 p-3 rounded-2xl border border-border/60">
            {/* District pills */}
            <div>
              <label className="text-[11px] font-semibold text-text-secondary mb-1.5 block">
                Khu vực:
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {DISTRICT_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDistrict(d)}
                    disabled={isSpinning}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      selectedDistrict === d
                        ? 'bg-accent text-bg-primary font-bold shadow-sm'
                        : 'bg-secondary text-text-muted hover:text-white'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Only Best Checkbox */}
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span className="text-xs text-text-secondary flex items-center gap-1">
                <Flame size={13} className="text-accent" />
                Chỉ chọn quán Đỉnh / Ngon nhất
              </span>
              <button
                type="button"
                onClick={() => setOnlyTopRated(!onlyTopRated)}
                disabled={isSpinning}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  onlyTopRated ? 'bg-accent' : 'bg-secondary border border-border'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                    onlyTopRated ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Wheel / Shuffle Display Area */}
          <div className="min-h-[140px] flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-bg-primary/80 border border-border/70 mb-4 relative overflow-hidden">
            {isSpinning ? (
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 0.2 }}
                className="space-y-1"
              >
                <div className="text-2xl">🎲</div>
                <div className="text-base font-bold text-accent font-editorial tracking-tight px-2 py-1 rounded bg-card/60">
                  {shuffleDisplay}
                </div>
                <div className="text-[11px] text-text-muted">Đang quay roulette...</div>
              </motion.div>
            ) : currentResult ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-600/40">
                      🎯 Quán được chọn
                    </span>
                    <h3 className="text-base font-bold text-white mt-1.5 leading-snug">
                      {currentResult.name}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-accent px-2 py-1 rounded-lg bg-card border border-border shrink-0">
                    {currentResult.district}
                  </span>
                </div>

                <p className="text-xs text-text-secondary mb-1 flex items-center gap-1 line-clamp-1">
                  <MapPin size={12} className="text-text-muted shrink-0" />
                  {currentResult.address || 'Hà Nội'}
                </p>

                {currentResult.review && (
                  <p className="text-xs text-[#BDD0C7] italic line-clamp-2 bg-card/50 p-2 rounded-xl border border-border/40 mt-2">
                    &ldquo;{currentResult.review}&rdquo;
                  </p>
                )}
              </motion.div>
            ) : (
              <div className="space-y-1 text-center py-2">
                <div className="text-3xl mb-1">🍜</div>
                <p className="text-sm font-semibold text-white">
                  Đắn đo chưa biết đi đâu?
                </p>
                <p className="text-xs text-text-muted">
                  Tìm thấy {candidatePool.length} quán hợp tiêu chí
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            {!currentResult ? (
              <button
                type="button"
                onClick={handleSpin}
                disabled={isSpinning || candidatePool.length === 0}
                className="w-full py-3 px-4 rounded-2xl bg-accent text-bg-primary font-bold text-sm hover:bg-accent-hover active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 cursor-pointer disabled:opacity-40"
              >
                <Dices size={18} className={isSpinning ? 'animate-spin' : ''} />
                {isSpinning
                  ? 'Đang tìm quán ngon...'
                  : candidatePool.length === 0
                  ? 'Không có quán trong khu vực này'
                  : 'Quay ngẫu nhiên ngay!'}
              </button>
            ) : (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <a
                    href={getDirectionsUrl(currentResult)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-accent text-bg-primary font-bold text-xs hover:bg-accent-hover active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Navigation size={14} />
                    Chỉ đường đi luôn
                  </a>
                  <Link
                    href={`/restaurant/${currentResult.id}`}
                    onClick={onClose}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-card border border-border text-white text-xs font-semibold hover:bg-card-hover active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    Xem đánh giá
                    <ExternalLink size={13} />
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={handleSpin}
                  className="w-full py-2 px-3 rounded-xl bg-secondary/80 text-text-secondary hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  Không ưng? Bốc lại quán khác
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
