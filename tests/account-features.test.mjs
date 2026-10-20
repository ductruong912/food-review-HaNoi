import test from 'node:test';
import assert from 'node:assert/strict';
import { getBookmarksStorageKey, mergeBookmarkIds, planBookmarkImport, setActiveBookmarkAccount } from '../src/lib/bookmarks.ts';
import { getNonRepeatingWheelPool, recordWheelWinner } from '../src/lib/roulette.ts';

test('device favorites remain separate from per-account favorite caches', () => {
  setActiveBookmarkAccount(null);
  assert.equal(getBookmarksStorageKey(), 'food_hn_bookmarks');
  setActiveBookmarkAccount('account-a');
  assert.equal(getBookmarksStorageKey(), 'food_hn_bookmarks:account-a');
  setActiveBookmarkAccount('account-b');
  assert.equal(getBookmarksStorageKey(), 'food_hn_bookmarks:account-b');
  setActiveBookmarkAccount(null);
  assert.equal(getBookmarksStorageKey(), 'food_hn_bookmarks');
});

test('bookmark import deduplicates IDs, skips account duplicates and retains unavailable device IDs', () => {
  const plan = planBookmarkImport(
    ['device-a', 'already-saved', 'missing', 'device-a'],
    ['already-saved'],
    ['device-a', 'already-saved'],
  );
  assert.deepEqual(plan, {
    importable: ['device-a'],
    duplicates: ['already-saved'],
    unavailable: ['missing'],
  });
  assert.deepEqual(mergeBookmarkIds(['device-a'], ['already-saved', 'device-a'], ['new']), ['device-a', 'already-saved', 'new']);
});

test('roulette avoids recent winners until all remaining candidates have been used', () => {
  const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(getNonRepeatingWheelPool(pool, ['a']), [{ id: 'b' }, { id: 'c' }]);
  const afterOne = recordWheelWinner([], 'a', pool.length);
  const afterTwo = recordWheelWinner(afterOne, 'b', pool.length);
  const afterAll = recordWheelWinner(afterTwo, 'c', pool.length);
  assert.deepEqual(afterAll, ['c']);
  assert.deepEqual(getNonRepeatingWheelPool(pool, afterAll), [{ id: 'a' }, { id: 'b' }]);
});
