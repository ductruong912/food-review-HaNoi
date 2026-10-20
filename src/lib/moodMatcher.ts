import { getCategoryInfo, getRatingInfo } from './utils.ts';
import { getPerPersonPriceRange } from './prices.ts';
import { OCCASION_MAP, type OccasionSlug, type Restaurant } from './types.ts';

export type CompanionOption = 'solo' | 'date' | 'friends' | 'family';
export type CravingOption = 'nuoc' | 'com' | 'lau_nuong' | 'cafe_ngot' | 'an_vat';
export type BudgetOption = 'budget_low' | 'budget_mid' | 'budget_high';
export type QuickBudget = 'max_50k' | 'max_150k' | 'max_300k';

export const QUICK_BUDGET_OPTIONS: { value: QuickBudget; label: string; maxVnd: number }[] = [
  { value: 'max_50k', label: 'Tối đa 50.000đ/người', maxVnd: 50_000 },
  { value: 'max_150k', label: 'Tối đa 150.000đ/người', maxVnd: 150_000 },
  { value: 'max_300k', label: 'Tối đa 300.000đ/người', maxVnd: 300_000 },
];

export interface MoodChoices {
  companion: CompanionOption;
  craving: CravingOption;
  budget: BudgetOption;
  district?: string;
}

export interface MoodMatchResult {
  topMatch: Restaurant;
  planB: Restaurant | null;
  reason: string;
  planBReason: string | null;
}

const OCCASION_FOR_COMPANION: Record<CompanionOption, string> = {
  solo: 'mot_minh', date: 'hen_ho', friends: 'di_nhom', family: 'gia_dinh',
};

const COMPANION_LABEL: Record<CompanionOption, string> = {
  solo: 'Một mình', date: 'Hẹn hò', friends: 'Đi nhóm', family: 'Gia đình',
};

export interface QuickChoices {
  district: string;
  budget: QuickBudget;
  companion: CompanionOption;
}

export interface QuickRecommendation {
  restaurant: Restaurant;
  reasons: string[];
}

export function getQuickRecommendations(
  restaurants: Restaurant[],
  choices: QuickChoices,
): QuickRecommendation[] {
  if (!choices.district || !choices.companion || !choices.budget) return [];
  const maxVnd = QUICK_BUDGET_OPTIONS.find((option) => option.value === choices.budget)?.maxVnd;
  if (!maxVnd) return [];
  const occasion = OCCASION_FOR_COMPANION[choices.companion] as OccasionSlug;

  return restaurants
    .filter((restaurant) => {
      if (restaurant.district !== choices.district || restaurant.rating === 'khong_ngon') return false;
      if (!restaurant.occasions?.includes(occasion)) return false;
      const price = getPerPersonPriceRange(restaurant);
      return !!price && price.maxVnd <= maxVnd;
    })
    .sort((a, b) => getRatingInfo(b.rating).score - getRatingInfo(a.rating).score ||
      (getPerPersonPriceRange(a)?.maxVnd ?? Infinity) - (getPerPersonPriceRange(b)?.maxVnd ?? Infinity) ||
      a.name.localeCompare(b.name, 'vi'))
    .slice(0, 3)
    .map((restaurant) => {
      const price = getPerPersonPriceRange(restaurant)!;
      const amount = price.minVnd === price.maxVnd
        ? formatVnd(price.minVnd)
        : `${formatVnd(price.minVnd)}–${formatVnd(price.maxVnd)}`;
      return {
        restaurant,
        reasons: [
          `Khu vực: ${restaurant.district}`,
          `Giá đã ghi: ${amount}/người`,
          `Được gắn nhãn: ${OCCASION_MAP[occasion] ?? COMPANION_LABEL[choices.companion]}`,
        ],
      };
    });
}

export function matchesBudgetBand(restaurant: Restaurant, budget: BudgetOption): boolean {
  const price = getPerPersonPriceRange(restaurant);
  if (!price) return false;

  switch (budget) {
    case 'budget_low': return price.maxVnd < 50_000;
    case 'budget_mid': return price.minVnd >= 50_000 && price.maxVnd <= 150_000;
    case 'budget_high': return price.minVnd > 150_000;
  }
}

function cravingMatches(restaurant: Restaurant, craving: CravingOption): boolean {
  const text = `${restaurant.name} ${restaurant.review ?? ''} ${restaurant.category ?? ''}`.toLocaleLowerCase('vi-VN');
  switch (craving) {
    case 'nuoc': return restaurant.category === 'mon_viet_hang_ngay' || /phở|bún|miến|mì|cháo|hủ tiếu|canh|bánh đa|nước lèo/.test(text);
    case 'com': return /cơm|tấm|rang|niêu|suất|thịt rang|gà xối mỡ/.test(text);
    case 'lau_nuong': return restaurant.category === 'lau_nuong' || /lẩu|nướng|bbq|bò nướng|thịt nướng|chảo/.test(text);
    case 'cafe_ngot': return restaurant.category === 'ca_phe_do_uong' || restaurant.category === 'banh_trang_mieng' || /cafe|cà phê|trà|chè|bánh|tào phớ|ngọt|kem|tráng miệng/.test(text);
    case 'an_vat': return restaurant.category === 'an_vat' || /bánh gối|nem|ốc|nộm|chân gà|khoai|rán|chiên|vỉa hè|ăn vặt|xiên/.test(text);
  }
}

function companionMatches(restaurant: Restaurant, companion: CompanionOption): boolean {
  return restaurant.occasions?.includes(OCCASION_FOR_COMPANION[companion] as NonNullable<Restaurant['occasions']>[number]) ?? false;
}

function formatVnd(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
}

function reasonFor(restaurant: Restaurant, choices: MoodChoices): string {
  const reasons: string[] = [];
  if (choices.district && choices.district !== 'Tất cả') reasons.push(`Đúng khu vực ${restaurant.district}`);
  if (cravingMatches(restaurant, choices.craving)) reasons.push(`Loại quán: ${getCategoryInfo(restaurant.category).label}`);
  if (companionMatches(restaurant, choices.companion)) reasons.push('Đã được đánh dấu phù hợp với dịp này');

  const price = getPerPersonPriceRange(restaurant);
  if (price) {
    const amount = price.minVnd === price.maxVnd
      ? formatVnd(price.minVnd)
      : `${formatVnd(price.minVnd)}–${formatVnd(price.maxVnd)}`;
    reasons.push(`Giá đã ghi: ${amount}/người`);
  }
  reasons.push(`Cảm nhận: ${getRatingInfo(restaurant.rating).label}`);
  return reasons.join(' · ');
}

export function matchRestaurantsByMood(
  restaurants: Restaurant[],
  choices: MoodChoices,
): MoodMatchResult | null {
  const eligible = restaurants.filter((restaurant) =>
    restaurant.rating !== 'khong_ngon' &&
    (!choices.district || choices.district === 'Tất cả' || restaurant.district === choices.district) &&
    matchesBudgetBand(restaurant, choices.budget),
  );

  const ranked = eligible.map((restaurant) => ({
    restaurant,
    score: getRatingInfo(restaurant.rating).score +
      (cravingMatches(restaurant, choices.craving) ? 5 : 0) +
      (companionMatches(restaurant, choices.companion) ? 8 : 0),
  })).sort((a, b) => b.score - a.score || a.restaurant.name.localeCompare(b.restaurant.name, 'vi'));

  if (ranked.length === 0) return null;

  const topMatch = ranked[0].restaurant;
  const planB = ranked[1]?.restaurant ?? null;
  return {
    topMatch,
    planB,
    reason: reasonFor(topMatch, choices),
    planBReason: planB ? reasonFor(planB, choices) : null,
  };
}
