'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Coins, Compass, Dices, MapPin, Navigation, RotateCcw, Share2, Smile, Sparkles, Utensils, Volume2, VolumeX, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Restaurant } from '@/lib/types';
import { getDirectionsUrl } from '@/lib/geo';
import { formatRestaurantPrice } from '@/lib/prices';
import { getQuickRecommendations, QUICK_BUDGET_OPTIONS, type CompanionOption, type QuickBudget } from '@/lib/moodMatcher';
import { getRatingInfo } from '@/lib/utils';
import { getNonRepeatingWheelPool, recordWheelWinner } from '@/lib/roulette';
import { rememberRestaurantReturn } from '@/lib/restaurantNavigation';
import { soundFX } from '@/lib/audio';
import { triggerConfetti } from '@/lib/confetti';
import RouletteWheel from './RouletteWheel';
import { useModalFocus } from './useModalFocus';

interface RandomFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurants: Restaurant[];
}

type ActiveTab = 'quick' | 'roulette';

const COMPANIONS: { value: CompanionOption; label: string; icon: string }[] = [
  { value: 'solo', label: 'Một mình', icon: '🚶' },
  { value: 'date', label: 'Hẹn hò', icon: '🧑‍🤝‍🧑' },
  { value: 'friends', label: 'Bạn bè', icon: '👥' },
  { value: 'family', label: 'Gia đình', icon: '👨‍👩‍👧' },
];

export default function RandomFoodModal({ isOpen, onClose, restaurants }: RandomFoodModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('quick');
  const [soundOn, setSoundOn] = useState(false);
  const [quickDistrict, setQuickDistrict] = useState('');
  const [quickBudget, setQuickBudget] = useState<QuickBudget | ''>('');
  const [companion, setCompanion] = useState<CompanionOption | ''>('');
  const [quickResults, setQuickResults] = useState<ReturnType<typeof getQuickRecommendations>>([]);
  const [quickSubmitted, setQuickSubmitted] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState('Tất cả');
  const [onlyTopRated, setOnlyTopRated] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentResult, setCurrentResult] = useState<Restaurant | null>(null);
  const [round, setRound] = useState(0);
  const [recentWinnerIds, setRecentWinnerIds] = useState<string[]>([]);

  const dialogRef = useModalFocus(isOpen, onClose);
  const districts = useMemo(() => [...new Set(restaurants.map((restaurant) => restaurant.district).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'vi')), [restaurants]);
  const rouletteSource = useMemo(() => restaurants.filter((restaurant) =>
    (onlyTopRated ? restaurant.rating === 'ngon' : restaurant.rating !== 'khong_ngon') &&
    (selectedDistrict === 'Tất cả' || restaurant.district === selectedDistrict)),
  [restaurants, onlyTopRated, selectedDistrict]);
  const filteredPool = useMemo(() => getNonRepeatingWheelPool(rouletteSource, recentWinnerIds), [rouletteSource, recentWinnerIds]);
  const [candidatePool, setCandidatePool] = useState<Restaurant[]>([]);

  useEffect(() => {
    try {
      const enabled = localStorage.getItem('foodhn-sound-enabled') === 'true';
      setSoundOn(enabled);
      soundFX.enabled = enabled;
    } catch {
      soundFX.enabled = false;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const pool = [...filteredPool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setCandidatePool(pool);
  }, [filteredPool, isOpen, round]);

  useEffect(() => {
    setRecentWinnerIds([]);
  }, [selectedDistrict, onlyTopRated]);

  useEffect(() => {
    if (!isOpen) return;
    setQuickResults([]);
    setQuickSubmitted(false);
    setCurrentResult(null);
    setIsSpinning(false);
  }, [isOpen]);

  const toggleSound = () => {
    const nextState = !soundOn;
    setSoundOn(nextState);
    soundFX.enabled = nextState;
    try { localStorage.setItem('foodhn-sound-enabled', String(nextState)); } catch { /* Audio remains a session preference. */ }
    if (nextState) soundFX.playClick();
  };

  const findQuickOptions = () => {
    if (!quickDistrict || !quickBudget || !companion) return;
    const results = getQuickRecommendations(restaurants, {
      district: quickDistrict,
      budget: quickBudget,
      companion,
    });
    setQuickResults(results);
    setQuickSubmitted(true);
    if (results.length) {
      if (soundOn) soundFX.playWinFanfare();
      triggerConfetti();
    }
  };

  const handleRouletteEnd = (winner: Restaurant) => {
    setIsSpinning(false);
    setCurrentResult(winner);
    setRecentWinnerIds((previous) => recordWheelWinner(previous, winner.id, rouletteSource.length));
    if (soundOn) soundFX.playWinFanfare();
    triggerConfetti();
  };

  const handleResetWheel = () => {
    setRound((value) => value + 1);
    setCurrentResult(null);
    if (soundOn) soundFX.playClick();
  };

  const shareRestaurant = async (restaurant: Restaurant) => {
    const url = `${window.location.origin}/restaurant/${restaurant.id}`;
    try {
      if (navigator.share) await navigator.share({ title: restaurant.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Đã sao chép liên kết quán.');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error('Chưa chia sẻ được liên kết.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4">
        <motion.button type="button" aria-label="Đóng cửa sổ chọn quán" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        <motion.section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="food-picker-title"
          initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }}
          className="relative z-10 my-auto w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-card p-4 text-foreground shadow-2xl sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3 pr-1">
            <div>
              <h2 id="food-picker-title" className="flex items-center gap-2 text-xl font-bold"><Utensils size={20} className="text-accent" />Chọn quán hôm nay</h2>
              <p className="mt-1 text-sm text-text-secondary">Chọn nhanh theo dữ liệu đã ghi hoặc quay riêng một lượt.</p>
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={toggleSound} aria-label={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'} aria-pressed={soundOn} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary text-text-secondary hover:text-foreground">
                {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary text-text-secondary hover:text-foreground"><X size={18} /></button>
            </div>
          </div>

          <div className="mb-5 flex rounded-2xl border border-border bg-background p-1">
            <button type="button" onClick={() => { setActiveTab('quick'); if (soundOn) soundFX.playClick(); }} aria-pressed={activeTab === 'quick'} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold ${activeTab === 'quick' ? 'bg-accent text-white' : 'text-text-secondary'}`}><Sparkles size={16} />Chọn nhanh</button>
            <button type="button" onClick={() => { setActiveTab('roulette'); if (soundOn) soundFX.playClick(); }} aria-pressed={activeTab === 'roulette'} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold ${activeTab === 'roulette' ? 'bg-accent text-white' : 'text-text-secondary'}`}><Dices size={16} />Vòng quay</button>
          </div>

          {activeTab === 'quick' && (
            <div className="space-y-5">
              <section aria-labelledby="quick-district-label">
                <label id="quick-district-label" htmlFor="quick-district" className="mb-2 flex items-center gap-2 text-sm font-semibold"><Compass size={16} className="text-accent" />Khu vực bắt buộc</label>
                <select id="quick-district" value={quickDistrict} onChange={(event) => { setQuickDistrict(event.target.value); setQuickResults([]); }} className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm">
                  <option value="">Chọn quận / huyện</option>{districts.map((district) => <option key={district} value={district}>{district}</option>)}
                </select>
              </section>
              <fieldset>
                <legend className="mb-2 flex items-center gap-2 text-sm font-semibold"><Smile size={16} className="text-accent" />Đi cùng ai?</legend>
                <div className="grid grid-cols-2 gap-2">
                  {COMPANIONS.map((option) => <button key={option.value} type="button" aria-pressed={companion === option.value} onClick={() => { setCompanion(option.value); setQuickResults([]); }} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm font-medium ${companion === option.value ? 'border-accent bg-accent/10 text-foreground' : 'border-border bg-background text-text-secondary'}`}><span aria-hidden="true">{option.icon}</span>{option.label}</button>)}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 flex items-center gap-2 text-sm font-semibold"><Coins size={16} className="text-accent" />Ngân sách tối đa theo người</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {QUICK_BUDGET_OPTIONS.map((option) => <button key={option.value} type="button" aria-pressed={quickBudget === option.value} onClick={() => { setQuickBudget(option.value); setQuickResults([]); }} className={`min-h-12 rounded-xl border px-3 text-sm font-medium ${quickBudget === option.value ? 'border-accent bg-accent/10 text-foreground' : 'border-border bg-background text-text-secondary'}`}>{option.label}</button>)}
                </div>
                <p className="mt-2 text-xs text-text-muted">Chỉ quán có giá đã ghi rõ theo người và có nhãn dịp tương ứng mới được đưa vào.</p>
              </fieldset>
              <button type="button" disabled={!quickDistrict || !quickBudget || !companion} onClick={findQuickOptions} className="btn-primary min-h-12 w-full disabled:cursor-not-allowed disabled:opacity-50"><Sparkles size={17} />Tìm tối đa 3 quán</button>

              {quickSubmitted && quickResults.length === 0 && <section className="state-panel text-left" role="status">
                <h3 className="font-semibold text-foreground">Chưa có quán khớp đủ các điều kiện</h3>
                <p className="mt-1 text-sm text-text-secondary">Không có kết quả trong khu vực, mức giá theo người và dịp đã chọn. Hãy tự đổi một điều kiện rồi tìm lại.</p>
              </section>}

              {quickResults.length > 0 && <ol className="space-y-3" aria-label="Kết quả chọn nhanh">
                {quickResults.map(({ restaurant, reasons }, index) => {
                  const rating = getRatingInfo(restaurant.rating);
                  return <li key={restaurant.id} className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-accent">Gợi ý {index + 1}</p>
                        <Link href={`/restaurant/${restaurant.id}`} onClick={() => rememberRestaurantReturn(restaurant.id)} className="mt-0.5 block text-base font-bold text-foreground hover:text-accent">{restaurant.name}</Link>
                        <p className="mt-1 text-sm text-text-secondary"><MapPin size={14} className="mr-1 inline" />{restaurant.district} · {formatRestaurantPrice(restaurant)}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${rating.bgColor}`}>{rating.label}</span>
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-text-secondary">{reasons.map((reason) => <li key={reason} className="flex gap-2"><Check size={14} className="shrink-0 text-accent" />{reason}</li>)}</ul>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={getDirectionsUrl(restaurant)} target="_blank" rel="noopener noreferrer" className="btn-secondary min-h-11 px-3 text-xs"><Navigation size={14} />Chỉ đường</a>
                      <button type="button" onClick={() => void shareRestaurant(restaurant)} className="btn-secondary min-h-11 px-3 text-xs"><Share2 size={14} />Chia sẻ</button>
                    </div>
                  </li>;
                })}
              </ol>}
            </div>
          )}

          {activeTab === 'roulette' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">Khu vực
                  <select value={selectedDistrict} disabled={isSpinning} onChange={(event) => setSelectedDistrict(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="Tất cả">Tất cả khu vực</option>{districts.map((district) => <option key={district}>{district}</option>)}</select>
                </label>
                <div className="flex min-h-11 items-center justify-between rounded-xl border border-border bg-background px-3">
                  <span className="text-sm">Ưu tiên cảm nhận “Ngon tuyệt”</span>
                  <input type="checkbox" aria-label="Chỉ chọn quán được đánh giá Ngon tuyệt" checked={onlyTopRated} disabled={isSpinning} onChange={(event) => setOnlyTopRated(event.target.checked)} className="h-5 w-5 accent-accent" />
                </div>
              </div>

              {currentResult ? (
                <article className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
                  <p className="text-xs font-semibold text-accent">Kết quả vòng quay</p>
                  <h3 className="mt-1 text-xl font-bold">{currentResult.name}</h3>
                  <p className="mt-1 text-sm text-text-secondary">{currentResult.district} · {formatRestaurantPrice(currentResult)} · {getRatingInfo(currentResult.rating).label}</p>
                  {currentResult.review && <p className="mt-3 text-sm text-text-secondary">{currentResult.review}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/restaurant/${currentResult.id}`} onClick={() => rememberRestaurantReturn(currentResult.id)} className="btn-primary min-h-11 px-3 text-xs">Xem quán <ArrowRight size={14} /></Link>
                    <a href={getDirectionsUrl(currentResult)} target="_blank" rel="noopener noreferrer" className="btn-secondary min-h-11 px-3 text-xs"><Navigation size={14} />Chỉ đường</a>
                    <button type="button" onClick={() => void shareRestaurant(currentResult)} className="btn-secondary min-h-11 px-3 text-xs"><Share2 size={14} />Chia sẻ</button>
                    <button type="button" onClick={handleResetWheel} className="btn-secondary min-h-11 px-3 text-xs"><RotateCcw size={14} />Quay tiếp</button>
                  </div>
                </article>
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-border bg-background p-3">
                  {candidatePool.length ? <RouletteWheel candidates={candidatePool} isSpinning={isSpinning} onSpinStart={() => setIsSpinning(true)} onSpinEnd={handleRouletteEnd} /> : <div className="text-center"><Dices size={32} className="mx-auto mb-2 text-text-muted" /><p className="font-semibold">Không có quán trong điều kiện vòng quay</p><p className="mt-1 text-sm text-text-secondary">Hãy đổi khu vực hoặc bỏ lọc cảm nhận.</p></div>}
                </div>
              )}
            </div>
          )}
        </motion.section>
      </div>
    </AnimatePresence>
  );
}
