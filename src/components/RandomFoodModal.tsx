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
  Volume2,
  VolumeX,
  Share2,
  Compass,
  Coins,
  Smile,
  ArrowRight,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { triggerConfetti } from '@/lib/confetti';
import { soundFX } from '@/lib/audio';
import {
  matchRestaurantsByMood,
  type CompanionOption,
  type CravingOption,
  type BudgetOption,
  type MoodMatchResult,
} from '@/lib/moodMatcher';
import RouletteWheel from './RouletteWheel';
import { toast } from 'sonner';
import { useModalFocus } from './useModalFocus';

interface RandomFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurants: Restaurant[];
}

type ActiveTab = 'roulette' | 'mood';

export default function RandomFoodModal({
  isOpen,
  onClose,
  restaurants,
}: RandomFoodModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('roulette');
  const [soundOn, setSoundOn] = useState<boolean>(true);

  // Roulette states
  const [selectedDistrict, setSelectedDistrict] = useState('Tất cả');
  const [onlyTopRated, setOnlyTopRated] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [round, setRound] = useState(0);

  // Mood Wizard states
  const [moodStep, setMoodStep] = useState<1 | 2 | 3>(1);
  const [companion, setCompanion] = useState<CompanionOption>('solo');
  const [craving, setCraving] = useState<CravingOption>('nuoc');
  const [budget, setBudget] = useState<BudgetOption>('budget_low');

  // Winning result state
  const [currentResult, setCurrentResult] = useState<Restaurant | null>(null);
  const [moodResultMeta, setMoodResultMeta] = useState<MoodMatchResult | null>(null);

  // Sound setting toggle
  const toggleSound = () => {
    const nextState = !soundOn;
    setSoundOn(nextState);
    soundFX.enabled = nextState;
    if (nextState) soundFX.playClick();
  };

  // Filter candidate pool for Roulette
  const filteredPool = useMemo(() => {
    let pool = [...restaurants];
    if (onlyTopRated) {
      pool = pool.filter((r) => r.rating === 'ngon');
    } else {
      pool = pool.filter((r) => r.rating !== 'khong_ngon');
    }
    if (selectedDistrict !== 'Tất cả') {
      pool = pool.filter((r) => r.district === selectedDistrict);
    }
    return pool;
  }, [restaurants, onlyTopRated, selectedDistrict]);
  const [candidatePool, setCandidatePool] = useState<Restaurant[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    const pool = [...filteredPool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setCandidatePool(pool);
  }, [filteredPool, isOpen, round]);
  const dialogRef = useModalFocus(isOpen, onClose);

  // Distinct districts from available data
  const districtOptions = useMemo(() => {
    const districts = [...new Set(restaurants.map((r) => r.district).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'vi')
    );
    return ['Tất cả', ...districts];
  }, [restaurants]);

  // Reset states when modal is opened
  useEffect(() => {
    if (isOpen) {
      setCurrentResult(null);
      setMoodResultMeta(null);
      setIsSpinning(false);
      setMoodStep(1);
    }
  }, [isOpen]);

  // When roulette finishes
  const handleRouletteEnd = (winner: Restaurant) => {
    setIsSpinning(false);
    setCurrentResult(winner);
    setMoodResultMeta(null);

    soundFX.playWinFanfare();
    triggerConfetti();

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([40, 80, 50, 100]);
      } catch {
        // ignore
      }
    }
  };

  // When mood wizard is submitted
  const handleMoodSubmit = () => {
    const result = matchRestaurantsByMood(restaurants, {
      companion,
      craving,
      budget,
      district: selectedDistrict,
    });

    if (result) {
      setCurrentResult(result.topMatch);
      setMoodResultMeta(result);
      soundFX.playWinFanfare();
      triggerConfetti();
    } else {
      toast.error('Không tìm thấy quán nào phù hợp tiêu chí này');
    }
  };

  // Share / Copy message to invite friends or partner
  const handleShareInvite = (restaurant: Restaurant) => {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const shareText = `Trưa nay đi ăn ở đây nhé: "${restaurant.name}" (${restaurant.address || restaurant.district})! Đánh giá cực chuẩn trên Food Review Hà Nội: ${siteUrl}/restaurant/${restaurant.id}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText).then(() => {
        toast.success('Đã sao chép lời mời đi ăn! Gửi ngay cho bạn bè/gấu nhé 💌');
      }).catch(() => {
        toast.info('Lời mời: ' + shareText);
      });
    } else {
      toast.info('Lời mời: ' + shareText);
    }
  };

  // Reset to spin/match again
  const handleResetPick = () => {
    setRound(n => n + 1);
    setCurrentResult(null);
    setMoodResultMeta(null);
    soundFX.playClick();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Hôm nay ăn gì?"
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-lg bg-card border border-border rounded-3xl p-4 sm:p-6 shadow-2xl overflow-hidden z-10 my-auto text-foreground"
        >
          {/* Ambient Glows */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-36 bg-accent-primary/15 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-20 right-0 w-60 h-36 bg-accent-secondary/10 blur-3xl rounded-full pointer-events-none" />

          {/* Top Actions: Sound & Close */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 z-20">
            <button
              type="button"
              onClick={toggleSound}
              className="p-2 min-w-[36px] min-h-[36px] rounded-full bg-secondary/80 text-text-muted hover:text-foreground border border-border/60 transition-colors cursor-pointer flex items-center justify-center"
              title={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundOn ? <Volume2 size={16} className="text-accent-primary" /> : <VolumeX size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 min-w-[36px] min-h-[36px] rounded-full bg-secondary/80 text-text-muted hover:text-foreground border border-border/60 transition-colors cursor-pointer flex items-center justify-center"
              title="Đóng"
            >
              <X size={16} />
            </button>
          </div>

          {/* Header */}
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-accent-primary/20 border border-accent-primary/40 flex items-center justify-center text-accent-primary shrink-0 shadow-inner">
              <Dices size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground leading-tight flex items-center gap-1.5">
                Hôm nay ăn gì?
                <Sparkles size={16} className="text-accent-primary animate-pulse" />
              </h2>
              <p className="text-xs text-text-secondary">
                Trợ thủ cứu cánh dạ dày & giải quyết nỗi đắn đo ăn uống Hà Nội
              </p>
            </div>
          </div>

          {/* If Result is displayed */}
          {currentResult ? (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="space-y-4 pt-1"
            >
              {/* Winning Banner */}
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-gradient-to-r from-accent-primary/20 to-accent-secondary/15 border border-accent-primary/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-accent-primary">
                  <Sparkles size={14} />
                  <span>
                    {moodResultMeta ? 'Quán chuẩn gu của bạn' : 'Trúng thưởng Roulette'}
                  </span>
                </div>
                {moodResultMeta && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent-primary text-[#0D1B16]">
                    Phù hợp {moodResultMeta.matchScore}%
                  </span>
                )}
              </div>

              {/* Restaurant Card Preview */}
              <div className="rounded-2xl bg-card border border-border/80 overflow-hidden shadow-lg">
                {/* Image Section */}
                <div className="relative h-44 w-full bg-bg-primary overflow-hidden">
                  {currentResult.image_url ? (
                    <img
                      src={currentResult.image_url}
                      alt={currentResult.name}
                      className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-secondary text-text-muted gap-2">
                      <UtensilsCrossed size={36} className="text-accent-primary/40" />
                      <span className="text-xs font-medium">Ẩm thực Hà Nội đậm vị</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                  {/* Badges on image */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-accent-primary text-bg-primary shadow">
                      {currentResult.district}
                    </span>
                    {currentResult.rating === 'ngon' && (
                      <span className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 backdrop-blur-sm flex items-center gap-1 shadow">
                        <Flame size={12} className="text-accent-primary" />
                        Ngon tuyệt
                      </span>
                    )}
                  </div>

                  {currentResult.price && (
                    <div className="absolute bottom-3 right-3 text-xs font-bold px-2.5 py-1 rounded-lg bg-black/70 text-amber-300 border border-amber-500/30 backdrop-blur-sm shadow">
                      {currentResult.price}
                    </div>
                  )}

                  {/* Title overlay */}
                  <div className="absolute bottom-3 left-3 right-24">
                    <h3 className="text-base sm:text-lg font-bold text-white drop-shadow line-clamp-1">
                      {currentResult.name}
                    </h3>
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-start gap-1.5 text-xs text-text-secondary">
                    <MapPin size={14} className="text-accent-primary shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{currentResult.address || currentResult.district}</span>
                  </div>

                  {moodResultMeta?.reason && (
                    <div className="p-2.5 rounded-xl bg-accent-primary/10 border border-accent-primary/20 text-xs text-text-secondary flex items-center gap-2">
                      <Sparkles size={14} className="text-accent-primary shrink-0" />
                      <span>{moodResultMeta.reason}</span>
                    </div>
                  )}

                  {currentResult.review && (
                    <div className="p-3 rounded-xl bg-bg-primary/70 border border-border/50 text-xs italic text-text-secondary leading-relaxed">
                      &ldquo;{currentResult.review}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* Plan B recommendation if available */}
              {moodResultMeta?.planB && (
                <div className="p-3 rounded-2xl bg-card border border-border flex items-center justify-between gap-3 text-xs shadow-sm">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center text-text-muted shrink-0">
                      💡
                    </div>
                    <div className="truncate">
                      <span className="text-text-muted block text-xs">Phương án dự phòng (Plan B):</span>
                      <strong className="text-foreground font-semibold truncate block">{moodResultMeta.planB.name}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentResult(moodResultMeta.planB);
                      soundFX.playClick();
                    }}
                    className="px-3 py-1.5 min-h-[32px] rounded-lg bg-secondary hover:bg-secondary/80 text-accent font-bold text-xs shrink-0 transition-colors cursor-pointer"
                  >
                    Xem quán này
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={getDirectionsUrl(currentResult)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 min-h-[44px] rounded-xl bg-accent text-white dark:text-[#0D1B16] font-bold text-xs hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-accent/20"
                  >
                    <Navigation size={15} />
                    Chỉ đường đi luôn
                  </a>
                  <button
                    type="button"
                    onClick={() => handleShareInvite(currentResult)}
                    className="py-3 px-4 min-h-[44px] rounded-xl bg-accent-secondary/15 border border-accent-secondary/40 text-accent-secondary hover:bg-accent-secondary/25 active:scale-95 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Share2 size={15} />
                    Rủ bạn bè / Gấu
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/restaurant/${currentResult.id}`}
                    onClick={onClose}
                    className="flex-1 py-2.5 px-3 min-h-[40px] rounded-xl bg-card border border-border text-text-secondary hover:text-foreground text-xs font-medium hover:bg-card-hover transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink size={13} />
                    Xem chi tiết bài review
                  </Link>
                  <button
                    type="button"
                    onClick={handleResetPick}
                    className="flex-1 py-2.5 px-3 min-h-[40px] rounded-xl bg-secondary hover:bg-secondary/80 text-text-secondary hover:text-foreground text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    Không ưng? Chọn lại
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Tab Mode Selection and Interaction Area */
            <div>
              {/* Tab Switcher */}
              <div className="flex items-center p-1 rounded-2xl bg-card border border-border mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('roulette');
                    soundFX.playClick();
                  }}
                  className={`flex-1 py-2 min-h-[38px] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'roulette'
                      ? 'bg-accent text-white dark:text-[#0D1B16] shadow-md'
                      : 'text-text-secondary hover:text-foreground'
                  }`}
                >
                  <Dices size={15} />
                  Vòng quay may mắn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('mood');
                    soundFX.playClick();
                  }}
                  className={`flex-1 py-2 min-h-[38px] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'mood'
                      ? 'bg-accent text-white dark:text-[#0D1B16] shadow-md'
                      : 'text-text-secondary hover:text-foreground'
                  }`}
                >
                  <Sparkles size={15} />
                  Hương vị theo Vibe
                </button>
              </div>

              {/* District Filter (Common to both modes) */}
              <div className="mb-4 bg-card p-3 rounded-2xl border border-border">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-text-secondary flex items-center gap-1">
                    <Compass size={12} className="text-accent" />
                    Khu vực bạn muốn ăn:
                  </label>
                  <span className="text-xs text-text-muted">
                    {candidatePool.length} quán hợp lệ
                  </span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {districtOptions.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setSelectedDistrict(d);
                        soundFX.playClick();
                      }}
                      disabled={isSpinning}
                      className={`shrink-0 px-2.5 py-1 min-h-[32px] rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        selectedDistrict === d
                          ? 'bg-accent text-white dark:text-[#0D1B16] font-bold shadow-sm'
                          : 'bg-secondary text-text-secondary hover:text-foreground'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* TAB 1: ROULETTE WHEEL */}
              {activeTab === 'roulette' && (
                <div className="space-y-4">
                  {/* Top Rated Filter Toggle */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-card border border-border">
                    <span className="text-xs text-text-secondary flex items-center gap-1.5">
                      <Flame size={14} className="text-accent" />
                      Chỉ ưu tiên quán <strong>Đỉnh / Ngon nhất</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOnlyTopRated(!onlyTopRated);
                        soundFX.playClick();
                      }}
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

                  {/* Wheel Component Container */}
                  <div className="bg-bg-primary/80 rounded-2xl border border-border p-2 flex flex-col items-center justify-center min-h-[300px]">
                    {candidatePool.length === 0 ? (
                      <div className="text-center py-8 space-y-2">
                        <span className="text-3xl">🏜️</span>
                        <p className="text-sm font-semibold text-foreground">Chưa có quán nào trong khu vực này</p>
                        <p className="text-xs text-text-muted">Hãy chọn quận khác hoặc bấm &ldquo;Tất cả&rdquo;</p>
                      </div>
                    ) : (
                      <RouletteWheel
                        candidates={candidatePool}
                        isSpinning={isSpinning}
                        onSpinStart={() => setIsSpinning(true)}
                        onSpinEnd={handleRouletteEnd}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: MOOD & BUDGET WIZARD */}
              {activeTab === 'mood' && (
                <div className="space-y-4">
                  {/* Wizard Step Indicator */}
                  <div className="flex items-center justify-between px-2 text-xs font-semibold text-text-muted">
                    <span className={moodStep === 1 ? 'text-accent font-bold' : ''}>
                      1. Đi cùng ai?
                    </span>
                    <span className="text-border-light">•</span>
                    <span className={moodStep === 2 ? 'text-accent font-bold' : ''}>
                      2. Thèm vị gì?
                    </span>
                    <span className="text-border-light">•</span>
                    <span className={moodStep === 3 ? 'text-accent font-bold' : ''}>
                      3. Ngân sách
                    </span>
                  </div>

                  {/* Step 1: Companion */}
                  {moodStep === 1 && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-2"
                    >
                      <div className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                        <Smile size={14} className="text-accent" />
                        Bữa này bạn dự định đi cùng ai?
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'solo', label: 'Đi 1 mình solo', desc: 'Nhanh gọn, thoải mái, bình dân', icon: '🚶' },
                          { id: 'date', label: 'Hẹn hò / Đi date', desc: 'Lãng mạn, chill, không gian đẹp', icon: '👩‍❤️‍👨' },
                          { id: 'friends', label: 'Bạn bè / Đồng nghiệp', desc: 'Đông vui, tụ tập, xôm tụ', icon: '👥' },
                          { id: 'family', label: 'Cùng Gia đình', desc: 'Ấm cúng, món ngon truyền thống', icon: '👨‍👩‍👧' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setCompanion(opt.id as CompanionOption);
                              soundFX.playClick();
                            }}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                              companion === opt.id
                                ? 'bg-accent/15 border-accent text-foreground shadow-sm font-semibold'
                                : 'bg-card border-border text-text-secondary hover:border-border-light hover:text-foreground'
                            }`}
                          >
                            <span className="text-xl block mb-1">{opt.icon}</span>
                            <div className="font-bold text-xs">{opt.label}</div>
                            <div className="text-xs text-text-muted mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMoodStep(2);
                          soundFX.playClick();
                        }}
                        className="w-full mt-3 py-3 min-h-[44px] rounded-xl bg-accent text-white dark:text-[#0D1B16] font-bold text-xs hover:bg-accent-hover active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                      >
                        Tiếp tục chọn vị thèm
                        <ArrowRight size={14} />
                      </button>
                    </motion.div>
                  )}

                  {/* Step 2: Craving */}
                  {moodStep === 2 && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-2"
                    >
                      <div className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                        <UtensilsCrossed size={14} className="text-accent" />
                        Chiếc bụng đang thèm phong vị nào nhất?
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { id: 'nuoc', label: 'Nước lèo ấm bụng', desc: 'Phở, Bún riêu, Bún cá', icon: '🍲' },
                          { id: 'com', label: 'Cơm chắc bụng', desc: 'Cơm rang, Cơm tấm, Niêu', icon: '🍛' },
                          { id: 'lau_nuong', label: 'Lẩu nướng xì xèo', desc: 'Lẩu ếch, Bò nướng', icon: '🔥' },
                          { id: 'cafe_ngot', label: 'Cafe & Đồ ngọt', desc: 'Trà bánh, Tào phớ, Chè', icon: '☕' },
                          { id: 'an_vat', label: 'Ăn vặt vỉa hè', desc: 'Bánh gối, Nem rán, Ốc', icon: '🍢' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setCraving(opt.id as CravingOption);
                              soundFX.playClick();
                            }}
                            className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                              craving === opt.id
                                ? 'bg-accent/15 border-accent text-foreground shadow-sm font-semibold'
                                : 'bg-card border-border text-text-secondary hover:border-border-light hover:text-foreground'
                            }`}
                          >
                            <span className="text-xl block mb-1">{opt.icon}</span>
                            <div className="font-bold text-xs">{opt.label}</div>
                            <div className="text-xs text-text-muted mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMoodStep(1);
                            soundFX.playClick();
                          }}
                          className="py-2.5 px-4 min-h-[40px] rounded-xl bg-secondary text-text-secondary hover:text-foreground text-xs font-medium transition-colors cursor-pointer"
                        >
                          Quay lại
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMoodStep(3);
                            soundFX.playClick();
                          }}
                          className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-accent text-white dark:text-[#0D1B16] font-bold text-xs hover:bg-accent-hover active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                        >
                          Tiếp tục chọn ngân sách
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Budget */}
                  {moodStep === 3 && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-2"
                    >
                      <div className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                        <Coins size={14} className="text-accent" />
                        Tầm giá mong muốn cho bữa ăn?
                      </div>
                      <div className="space-y-2">
                        {[
                          { id: 'budget_low', label: 'Hạt dẻ (Dưới 50k / người)', desc: 'Cơm bụi, bún phở bình dân, ăn no ấm bụng', icon: '🪙' },
                          { id: 'budget_mid', label: 'Vừa vặn (50k - 150k / người)', desc: 'Chất lượng ngon miệng, không gian thoải mái', icon: '💵' },
                          { id: 'budget_high', label: 'Xả láng (Trên 150k / người)', desc: 'Lẩu nướng no nê, đi date chỉn chu hoặc tụ tập lớn', icon: '💳' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setBudget(opt.id as BudgetOption);
                              soundFX.playClick();
                            }}
                            className={`w-full p-3 min-h-[48px] rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                              budget === opt.id
                                ? 'bg-accent/15 border-accent text-foreground shadow-sm font-semibold'
                                : 'bg-card border-border text-text-secondary hover:border-border-light hover:text-foreground'
                            }`}
                          >
                            <span className="text-2xl">{opt.icon}</span>
                            <div className="flex-1">
                              <div className="font-bold text-xs">{opt.label}</div>
                              <div className="text-xs text-text-muted">{opt.desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMoodStep(2);
                            soundFX.playClick();
                          }}
                          className="py-2.5 px-4 min-h-[40px] rounded-xl bg-secondary text-text-secondary hover:text-foreground text-xs font-medium transition-colors cursor-pointer"
                        >
                          Quay lại
                        </button>
                        <button
                          type="button"
                          onClick={handleMoodSubmit}
                          className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-accent to-[#5DBA91] text-white dark:text-[#0D1B16] font-extrabold text-xs hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-accent/20"
                        >
                          <Sparkles size={16} />
                          Tìm quán chuẩn gu ngay!
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
