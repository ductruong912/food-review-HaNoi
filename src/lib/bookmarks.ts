// Bookmarks management utility using localStorage

const BOOKMARKS_STORAGE_KEY = 'food_hn_bookmarks';

export function getBookmarks(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === 'string'))] : [];
  } catch {
    return [];
  }
}

export function isBookmarked(id: string): boolean {
  if (typeof window === 'undefined' || !id) return false;
  const bookmarks = getBookmarks();
  return bookmarks.includes(id);
}

export function toggleBookmark(id: string): boolean {
  if (typeof window === 'undefined' || !id) return false;
  const bookmarks = getBookmarks();
  const exists = bookmarks.includes(id);
  const updated = exists ? bookmarks.filter((item) => item !== id) : [...bookmarks, id];
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updated));
    // Dispatch custom storage event so other components update synchronously
    window.dispatchEvent(new CustomEvent('food_hn_bookmarks_updated', { detail: { updated, id, isSaved: !exists } }));
  return !exists;
}
