import type { Restaurant } from './types';

export type CompanionOption = 'solo' | 'date' | 'friends' | 'family';
export type CravingOption = 'nuoc' | 'com' | 'lau_nuong' | 'cafe_ngot' | 'an_vat';
export type BudgetOption = 'budget_low' | 'budget_mid' | 'budget_high';

export interface MoodChoices {
  companion: CompanionOption;
  craving: CravingOption;
  budget: BudgetOption;
  district?: string;
}

export interface MoodMatchResult {
  topMatch: Restaurant;
  planB: Restaurant | null;
  matchScore: number;
  reason: string;
}

// Helper to parse price string to approximate number in thousands VND (k)
function estimatePrice(priceStr?: string | null): number {
  if (!priceStr) return 50; // Default estimate
  const digits = priceStr.replace(/[^\d]/g, '');
  if (!digits) return 50;
  
  const num = parseInt(digits, 10);
  if (num > 10000) {
    return Math.round(num / 1000);
  }
  return num;
}

export function matchRestaurantsByMood(
  restaurants: Restaurant[],
  choices: MoodChoices
): MoodMatchResult | null {
  if (!restaurants || restaurants.length === 0) return null;

  // Filter out definitely avoided places
  const available = restaurants.filter((r) => r.rating !== 'khong_ngon');
  if (available.length === 0) return null;

  // Score each restaurant
  const scored = available.map((r) => {
    let score = 0;
    const textCorpus = `${r.name} ${r.type || ''} ${r.review || ''} ${r.category || ''}`.toLowerCase();
    const estK = estimatePrice(r.price);

    // 1. District match (+25 pts if matches, otherwise neutral)
    if (choices.district && choices.district !== 'Tất cả') {
      if (r.district === choices.district) {
        score += 25;
      } else {
        score -= 10;
      }
    }

    // 2. Rating quality boost
    if (r.rating === 'ngon') score += 18;
    else if (r.rating === 'binh_thuong') score += 10;
    else score += 5;

    // 3. Craving match (+35 pts)
    switch (choices.craving) {
      case 'nuoc':
        if (
          r.category === 'com_bui' ||
          /phở|bún|miến|mỳ|mì|cháo|hủ tiếu|canh|bánh đa|nước lèo/i.test(textCorpus)
        ) {
          score += 35;
        }
        break;
      case 'com':
        if (
          r.category === 'com_bui' ||
          /cơm|tấm|rang|niêu|suất|thịt rang|gà xối mỡ/i.test(textCorpus)
        ) {
          score += 35;
        }
        break;
      case 'lau_nuong':
        if (
          r.category === 'lau_nuong' ||
          /lẩu|nướng|bbq|bò nướng|thịt nướng|chảo/i.test(textCorpus)
        ) {
          score += 40;
        }
        break;
      case 'cafe_ngot':
        if (
          r.category === 'do_uong' ||
          r.category === 'do_ngot' ||
          /cafe|cà phê|trà|chè|bánh|tào phớ|ngọt|kem|tráng miệng/i.test(textCorpus)
        ) {
          score += 40;
        }
        break;
      case 'an_vat':
        if (
          /bánh gối|nem|ốc|nộm|chân gà|khoai|rán|chiên|vỉa hè|ăn vặt|xiên/i.test(textCorpus)
        ) {
          score += 35;
        }
        break;
    }

    // 4. Companion match (+20 pts)
    switch (choices.companion) {
      case 'date':
        if (
          r.category === 'di_date' ||
          r.category === 'do_uong' ||
          /date|hẹn hò|lãng mạn|chill|view|không gian|tinh tế|ấm cúng/i.test(textCorpus)
        ) {
          score += 25;
        }
        break;
      case 'solo':
        if (
          r.category === 'com_bui' ||
          /nhanh|gọn|bình dân|1 người|đơn giản|quán quen/i.test(textCorpus)
        ) {
          score += 20;
        }
        break;
      case 'friends':
        if (
          r.category === 'lau_nuong' ||
          /nhậu|bạn bè|đông|vui|tụ tập|bia|nướng/i.test(textCorpus)
        ) {
          score += 20;
        }
        break;
      case 'family':
        if (
          /ấm cúng|gia đình|rộng rãi|chu đáo|truyền thống|cơm niêu/i.test(textCorpus)
        ) {
          score += 20;
        }
        break;
    }

    // 5. Budget match (+15 pts)
    switch (choices.budget) {
      case 'budget_low': // < 50k
        if (estK <= 50) score += 18;
        else if (estK <= 80) score += 8;
        else score -= 15;
        break;
      case 'budget_mid': // 50k - 150k
        if (estK >= 40 && estK <= 160) score += 18;
        else score += 6;
        break;
      case 'budget_high': // > 150k
        if (estK >= 120) score += 20;
        else if (estK >= 80) score += 10;
        break;
    }

    // Add tiny randomized jitter so consecutive queries with identical scores feel dynamic
    const jitter = Math.random() * 3;

    return {
      restaurant: r,
      totalScore: score + jitter,
    };
  });

  // Sort descending by score
  scored.sort((a, b) => b.totalScore - a.totalScore);

  const topMatch = scored[0].restaurant;
  const planB = scored.length > 1 ? scored[1].restaurant : null;

  // Build a friendly reason string
  let reason = 'Quán có hương vị và không gian rất hợp với lựa chọn hôm nay!';
  if (choices.companion === 'date') {
    reason = 'Không gian lý tưởng để trò chuyện và hẹn hò lãng mạn.';
  } else if (choices.craving === 'nuoc') {
    reason = 'Nước dùng đậm đà, thơm nức mũi giúp sưởi ấm bụng ngay tức thì.';
  } else if (choices.craving === 'lau_nuong') {
    reason = 'Hương vị xì xèo đậm đà, cực kỳ chuẩn bài cho một bữa tụ tập no nê.';
  } else if (choices.craving === 'cafe_ngot') {
    reason = 'Điểm dừng chân ngọt ngào, thư giãn hoàn hảo.';
  } else if (choices.budget === 'budget_low') {
    reason = 'Mức giá cực kỳ hạt dẻ nhưng chất lượng đồ ăn vẫn siêu đỉnh.';
  }

  return {
    topMatch,
    planB,
    matchScore: Math.min(99, Math.round(scored[0].totalScore)),
    reason,
  };
}
