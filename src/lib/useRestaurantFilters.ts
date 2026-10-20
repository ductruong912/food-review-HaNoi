'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_RESTAURANT_FILTERS,
  parseRestaurantFilters,
  serializeRestaurantFilters,
  type RestaurantFilters,
} from './filters';

export function useRestaurantFilters() {
  const [filters, setFilters] = useState(DEFAULT_RESTAURANT_FILTERS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const read = () => setFilters(parseRestaurantFilters(new URLSearchParams(window.location.search)));
    read();
    setReady(true);
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const existing = new URLSearchParams(window.location.search);
    const params = serializeRestaurantFilters(filters, existing);
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    window.dispatchEvent(new Event('restaurant-filters-updated'));
  }, [filters, ready]);

  const updateFilter = useCallback(<K extends keyof RestaurantFilters>(key: K, value: RestaurantFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_RESTAURANT_FILTERS), []);

  return { filters, setFilters, updateFilter, resetFilters, ready };
}
