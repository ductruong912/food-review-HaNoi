import type { Restaurant } from './types';

export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function matchesRestaurantSearch(restaurant: Pick<Restaurant, 'name' | 'address' | 'district' | 'review'>, query: string): boolean {
  const normalized = normalizeSearch(query);
  return !normalized || [restaurant.name, restaurant.address, restaurant.district, restaurant.review]
    .some((value) => normalizeSearch(value || '').includes(normalized));
}
