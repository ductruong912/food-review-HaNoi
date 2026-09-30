const DEVICE_BOOKMARKS_KEY = 'food_hn_bookmarks';
const ACCOUNT_BOOKMARKS_PREFIX = 'food_hn_bookmarks:';
const PENDING_PREFIX = 'food_hn_bookmarks_pending:';

let activeAccountId: string | null = null;

export function getBookmarksStorageKey(accountId = activeAccountId): string {
  return accountId ? `${ACCOUNT_BOOKMARKS_PREFIX}${accountId}` : DEVICE_BOOKMARKS_KEY;
}

function readIds(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))] : [];
  } catch {
    return [];
  }
}

export function mergeBookmarkIds(...groups: string[][]): string[] {
  return [...new Set(groups.flat().filter((id) => typeof id === 'string' && id.length > 0))];
}

export function planBookmarkImport(deviceIds: string[], accountIds: string[], availableRestaurantIds: string[]): {
  importable: string[];
  duplicates: string[];
  unavailable: string[];
} {
  const account = new Set(accountIds);
  const available = new Set(availableRestaurantIds);
  const plan = { importable: [] as string[], duplicates: [] as string[], unavailable: [] as string[] };
  for (const id of mergeBookmarkIds(deviceIds)) {
    if (account.has(id)) plan.duplicates.push(id);
    else if (available.has(id)) plan.importable.push(id);
    else plan.unavailable.push(id);
  }
  return plan;
}

export interface PendingBookmarkChange {
  id: string;
  isSaved: boolean;
}

export function getPendingBookmarkChanges(accountId: string): PendingBookmarkChange[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(`${PENDING_PREFIX}${accountId}`) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is PendingBookmarkChange =>
      !!item && typeof item.id === 'string' && typeof item.isSaved === 'boolean') : [];
  } catch {
    return [];
  }
}

export function queueBookmarkChange(accountId: string, id: string, isSaved: boolean): void {
  if (typeof window === 'undefined') return;
  const changes = getPendingBookmarkChanges(accountId).filter((item) => item.id !== id);
  try { localStorage.setItem(`${PENDING_PREFIX}${accountId}`, JSON.stringify([...changes, { id, isSaved }])); } catch { /* The local bookmark itself remains available. */ }
}

export function clearBookmarkChange(accountId: string, id: string, expectedState: boolean): void {
  if (typeof window === 'undefined') return;
  const changes = getPendingBookmarkChanges(accountId).filter((item) => item.id !== id || item.isSaved !== expectedState);
  try { localStorage.setItem(`${PENDING_PREFIX}${accountId}`, JSON.stringify(changes)); } catch { /* It will be retried at the next sync. */ }
}

export function getBookmarks(): string[] {
  return readIds(getBookmarksStorageKey());
}

export function getDeviceBookmarks(): string[] {
  return readIds(DEVICE_BOOKMARKS_KEY);
}

export function setBookmarks(ids: string[]): string[] {
  const updated = mergeBookmarkIds(ids);
  if (typeof window === 'undefined') return updated;
  try {
    localStorage.setItem(getBookmarksStorageKey(), JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('food_hn_bookmarks_updated', { detail: { updated } }));
  } catch {
    // Keep the current page usable if the browser blocks storage.
  }
  return updated;
}

export function setActiveBookmarkAccount(accountId: string | null): void {
  if (activeAccountId === accountId) return;
  activeAccountId = accountId;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('food_hn_bookmarks_updated', {
      detail: { updated: getBookmarks(), accountChanged: true },
    }));
  }
}

export function isBookmarked(id: string): boolean {
  return !!id && getBookmarks().includes(id);
}

export function toggleBookmark(id: string): boolean {
  if (typeof window === 'undefined' || !id) return false;
  const bookmarks = getBookmarks();
  const exists = bookmarks.includes(id);
  const updated = exists ? bookmarks.filter((item) => item !== id) : [...bookmarks, id];
  try {
    localStorage.setItem(getBookmarksStorageKey(), JSON.stringify(updated));
  } catch {
    return exists;
  }
  window.dispatchEvent(new CustomEvent('food_hn_bookmarks_updated', {
    detail: { updated, id, isSaved: !exists },
  }));
  return !exists;
}
