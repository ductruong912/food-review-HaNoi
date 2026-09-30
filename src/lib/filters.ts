import type { Restaurant } from './types';
import { RATING_MAP } from './types.ts';
import { matchesRestaurantSearch } from './search.ts';

export type SortMode = 'newest' | 'name' | 'trending';

export interface RestaurantFilters {
  query: string;
  districts: string[];
  categories: string[];
  occasions: string[];
  rating: string;
  sort: SortMode;
  saved: boolean;
}

export const DEFAULT_RESTAURANT_FILTERS: RestaurantFilters = {
  query: '', districts: [], categories: [], occasions: [], rating: '', sort: 'newest', saved: false,
};

const FILTER_PARAM_NAMES = ['q', 'search', 'district', 'area', 'category', 'occasion', 'rating', 'sort', 'saved'];

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function parseRestaurantFilters(params: URLSearchParams): RestaurantFilters {
  const sort = params.get('sort');
  return {
    query: params.get('q') ?? params.get('search') ?? '',
    districts: unique([...params.getAll('district'), ...params.getAll('area')]),
    categories: unique(params.getAll('category')),
    occasions: unique(params.getAll('occasion')),
    rating: params.get('rating') ?? '',
    sort: sort === 'name' ? 'name' : sort === 'trending' || sort === 'rating' ? 'trending' : 'newest',
    saved: params.get('saved') === 'true',
  };
}

export function serializeRestaurantFilters(
  filters: RestaurantFilters,
  existingParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(existingParams);
  FILTER_PARAM_NAMES.forEach((name) => params.delete(name));
  if (filters.query) params.set('q', filters.query);
  filters.districts.forEach((district) => params.append('district', district));
  filters.categories.forEach((category) => params.append('category', category));
  filters.occasions.forEach((occasion) => params.append('occasion', occasion));
  if (filters.rating) params.set('rating', filters.rating);
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.saved) params.set('saved', 'true');
  return params;
}

export function buildFilterHref(path: string, filters: RestaurantFilters, extras?: Record<string, string>): string {
  const params = serializeRestaurantFilters(filters);
  Object.entries(extras ?? {}).forEach(([key, value]) => params.set(key, value));
  const query = params.toString();
  return `${path}${query ? `?${query}` : ''}`;
}

export function hasRestaurantFilterCriteria(filters: RestaurantFilters): boolean {
  return Boolean(
    filters.query.trim() || filters.districts.length || filters.categories.length ||
    filters.occasions.length || filters.rating || filters.sort !== 'newest' || filters.saved,
  );
}

export function filterRestaurants(
  restaurants: Restaurant[],
  filters: RestaurantFilters,
  bookmarkedIds: string[] = [],
): Restaurant[] {
  const results = restaurants.filter((restaurant) => {
    if (filters.query.trim() && !matchesRestaurantSearch(restaurant, filters.query)) return false;
    if (filters.districts.length && !filters.districts.includes(restaurant.district)) return false;
    if (filters.categories.length && !filters.categories.includes(restaurant.category)) return false;
    if (filters.occasions.length && !filters.occasions.some((occasion) => restaurant.occasions?.includes(occasion as NonNullable<Restaurant['occasions']>[number]))) return false;
    if (filters.rating && restaurant.rating !== filters.rating) return false;
    if (filters.saved && !bookmarkedIds.includes(restaurant.id)) return false;
    return true;
  });

  return results.sort((a, b) => {
    if (filters.sort === 'name') return a.name.localeCompare(b.name, 'vi');
    if (filters.sort === 'trending') {
      const ratingDifference = ratingScore(b.rating) - ratingScore(a.rating);
      if (ratingDifference) return ratingDifference;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function ratingScore(rating: Restaurant['rating']): number {
  return RATING_MAP[rating]?.score ?? 0;
}
