interface ReturnLocation {
  scrollY: number;
  createdAt: number;
}

const returnKey = (restaurantId: string) => `foodhn:return:${restaurantId}`;
const scrollRestoreKey = 'foodhn:return-scroll';

export function rememberRestaurantReturn(restaurantId: string): void {
  try {
    const value: ReturnLocation = { scrollY: window.scrollY, createdAt: Date.now() };
    sessionStorage.setItem(returnKey(restaurantId), JSON.stringify(value));
  } catch {
    // Navigation still works when session storage is unavailable.
  }
}

export function getRestaurantReturn(restaurantId: string): ReturnLocation | null {
  try {
    const key = returnKey(restaurantId);
    const stored = sessionStorage.getItem(key);
    if (!stored) return null;
    const value = JSON.parse(stored) as Partial<ReturnLocation>;
    if (typeof value.scrollY !== 'number' || typeof value.createdAt !== 'number' || Date.now() - value.createdAt > 30 * 60_000) return null;
    return { scrollY: Math.max(0, value.scrollY), createdAt: value.createdAt };
  } catch {
    return null;
  }
}

export function consumeRestaurantReturn(restaurantId: string): ReturnLocation | null {
  const location = getRestaurantReturn(restaurantId);
  try { sessionStorage.removeItem(returnKey(restaurantId)); } catch { /* Optional cleanup. */ }
  return location;
}

export function setPendingScrollPosition(scrollY: number): void {
  try { sessionStorage.setItem(scrollRestoreKey, String(Math.max(0, scrollY))); } catch { /* Optional restoration. */ }
}

export function consumePendingScrollPosition(): number | null {
  try {
    const value = sessionStorage.getItem(scrollRestoreKey);
    sessionStorage.removeItem(scrollRestoreKey);
    if (value === null) return null;
    const scrollY = Number(value);
    return Number.isFinite(scrollY) ? Math.max(0, scrollY) : null;
  } catch {
    return null;
  }
}
