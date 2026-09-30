export type PriceUnit = 'vnd_per_person' | 'vnd_per_group';

export interface ParsedPrice {
  minVnd: number;
  maxVnd: number;
  unit: PriceUnit | null;
}

function parseNumber(value: string): number | null {
  const separators = [...value.matchAll(/[.,]/g)].map((match) => match.index ?? -1);
  let normalized = value;

  if (separators.length > 0) {
    const last = separators.at(-1) ?? -1;
    const trailingDigits = value.length - last - 1;
    const isThousandsGrouping = trailingDigits === 3 && /^[\d.,]+$/.test(value);
    if (isThousandsGrouping) {
      normalized = value.replace(/[.,]/g, '');
    } else if (separators.length === 1) {
      normalized = value.replace(',', '.');
    } else {
      return null;
    }
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** Parses explicit VND amounts. Bare numbers and unknown units remain unknown. */
export function parsePriceText(value?: string | null): ParsedPrice | null {
  if (!value?.trim()) return null;

  const text = value.trim().toLocaleLowerCase('vi-VN').replace(/\u00a0/g, ' ');
  const numbers = [...text.matchAll(/\d[\d.,]*/g)];
  if (numbers.length < 1 || numbers.length > 2) return null;

  const hasMillions = /triệu|trieu|million/.test(text);
  const hasThousands = /nghìn|nghin|ngàn|ngan|(?<!\w)k(?!\w)|\dk\b/.test(text);
  const hasVnd = /vnd|đồng|dong|₫|đ(?:\s|\/|$|[),])/.test(text);
  if (!hasMillions && !hasThousands && !hasVnd) return null;

  if (numbers.length === 2) {
    const firstEnd = (numbers[0].index ?? 0) + numbers[0][0].length;
    const between = text.slice(firstEnd, numbers[1].index);
    if (!/^\s*(?:k\s*)?(?:-|–|—|~|đến|den|to)\s*$/u.test(between)) return null;
  }

  const residue = text
    .replace(/\d[\d.,]*/g, ' ')
    .replace(/triệu|trieu|million|nghìn|nghin|ngàn|ngan|vnd|đồng|dong|người|nguoi|nhóm|nhom|mỗi|moi|per|person|group|khoảng|khoang|giá|gia|từ|tu|đến|den/gu, '')
    .replace(/[kđ₫\s/().,:+\-–—~]/gu, '');
  if (residue) return null;

  const factor = hasMillions ? 1_000_000 : hasThousands ? 1_000 : 1;
  const amounts = numbers.map((match) => parseNumber(match[0]));
  if (amounts.some((amount) => amount === null)) return null;

  const minVnd = Math.round((amounts[0] as number) * factor);
  const maxVnd = Math.round((amounts.at(-1) as number) * factor);
  if (!Number.isSafeInteger(minVnd) || !Number.isSafeInteger(maxVnd) || minVnd > maxVnd) return null;

  const unit = /(?:\/|mỗi\s+|per\s*)(?:người|nguoi|person)\b/u.test(text)
    ? 'vnd_per_person'
    : /(?:\/|cho\s+|per\s*)(?:nhóm|nhom|group)\b/u.test(text)
      ? 'vnd_per_group'
      : null;

  return { minVnd, maxVnd, unit };
}

export function getPerPersonPriceRange(restaurant: {
  price?: string | null;
  price_min_vnd?: number | null;
  price_max_vnd?: number | null;
  price_unit?: PriceUnit | null;
}): { minVnd: number; maxVnd: number } | null {
  if (restaurant.price_unit === 'vnd_per_group') return null;

  if (restaurant.price_unit === 'vnd_per_person') {
    if (
      Number.isSafeInteger(restaurant.price_min_vnd) &&
      Number.isSafeInteger(restaurant.price_max_vnd) &&
      (restaurant.price_min_vnd as number) <= (restaurant.price_max_vnd as number)
    ) {
      return { minVnd: restaurant.price_min_vnd as number, maxVnd: restaurant.price_max_vnd as number };
    }

    const parsed = parsePriceText(restaurant.price);
    if (parsed && parsed.unit !== 'vnd_per_group') return { minVnd: parsed.minVnd, maxVnd: parsed.maxVnd };
    return null;
  }

  const parsed = parsePriceText(restaurant.price);
  return parsed?.unit === 'vnd_per_person' ? { minVnd: parsed.minVnd, maxVnd: parsed.maxVnd } : null;
}

export function getPriceFields(value: string, selectedUnit: PriceUnit | null) {
  const parsed = parsePriceText(value);
  if (!parsed) return { price_min_vnd: null, price_max_vnd: null, price_unit: null };

  return {
    price_min_vnd: parsed.minVnd,
    price_max_vnd: parsed.maxVnd,
    price_unit: parsed.unit ?? selectedUnit,
  };
}

/** Display known VND amounts consistently, preserving the unit only when recorded. */
export function formatRestaurantPrice(restaurant: {
  price?: string | null;
  price_min_vnd?: number | null;
  price_max_vnd?: number | null;
  price_unit?: PriceUnit | null;
}): string {
  const unit = restaurant.price_unit;
  const min = restaurant.price_min_vnd;
  const max = restaurant.price_max_vnd;
  if ((unit === 'vnd_per_person' || unit === 'vnd_per_group') &&
      Number.isSafeInteger(min) && Number.isSafeInteger(max) && (min as number) <= (max as number)) {
    const amount = min === max
      ? `${(min as number).toLocaleString('vi-VN')} ₫`
      : `${(min as number).toLocaleString('vi-VN')}–${(max as number).toLocaleString('vi-VN')} ₫`;
    return `${amount}/${unit === 'vnd_per_person' ? 'người' : 'nhóm'}`;
  }

  const parsed = parsePriceText(restaurant.price);
  if (parsed) {
    const amount = parsed.minVnd === parsed.maxVnd
      ? `${parsed.minVnd.toLocaleString('vi-VN')} ₫`
      : `${parsed.minVnd.toLocaleString('vi-VN')}–${parsed.maxVnd.toLocaleString('vi-VN')} ₫`;
    const knownUnit = parsed.unit ?? unit;
    return knownUnit ? `${amount}/${knownUnit === 'vnd_per_person' ? 'người' : 'nhóm'}` : amount;
  }

  return restaurant.price?.trim() || 'Chưa rõ giá';
}
