import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFilterHref, filterRestaurants, parseRestaurantFilters, serializeRestaurantFilters } from '../src/lib/filters.ts';

const rows = [
  { id: '1', name: 'Bún chả', district: 'Hoàn Kiếm', category: 'mon_viet_hang_ngay', occasions: ['di_nhom'], rating: 'ngon', review: '', address: '', created_at: '2026-01-01' },
  { id: '2', name: 'Cà phê', district: 'Cầu Giấy', category: 'ca_phe_do_uong', occasions: ['mot_minh'], rating: 'chua_an', review: '', address: '', created_at: '2026-01-03' },
  { id: '3', name: 'Phở', district: 'Hoàn Kiếm', category: 'mon_viet_hang_ngay', occasions: ['gia_dinh'], rating: 'binh_thuong', review: '', address: '', created_at: '2026-01-02' },
];

test('legacy scalar URLs and repeated multi-select URLs parse to one filter model', () => {
  assert.deepEqual(parseRestaurantFilters(new URLSearchParams('q=bun&district=Ho%C3%A0n+Ki%E1%BA%BFm&category=mon_viet_hang_ngay&occasion=di_nhom&rating=ngon&sort=trending&saved=true')), {
    query: 'bun', districts: ['Hoàn Kiếm'], categories: ['mon_viet_hang_ngay'], occasions: ['di_nhom'], rating: 'ngon', sort: 'trending', saved: true,
  });
  const multi = parseRestaurantFilters(new URLSearchParams('district=Ho%C3%A0n+Ki%E1%BA%BFm&district=C%E1%BA%A7u+Gi%E1%BA%A5y&category=mon_viet_hang_ngay&category=ca_phe_do_uong'));
  assert.deepEqual(multi.districts, ['Hoàn Kiếm', 'Cầu Giấy']);
  assert.deepEqual(multi.categories, ['mon_viet_hang_ngay', 'ca_phe_do_uong']);
});

test('filter choices use OR inside each multi-select and AND across filter types', () => {
  const filters = parseRestaurantFilters(new URLSearchParams('district=Ho%C3%A0n+Ki%E1%BA%BFm&district=C%E1%BA%A7u+Gi%E1%BA%A5y&category=mon_viet_hang_ngay&category=ca_phe_do_uong&occasion=di_nhom&occasion=mot_minh'));
  assert.deepEqual(filterRestaurants(rows, filters).map((row) => row.id), ['2', '1']);
  const onlyDistrict = { ...filters, categories: [], occasions: [] };
  assert.deepEqual(filterRestaurants(rows, onlyDistrict).map((row) => row.id), ['2', '3', '1']);
});

test('rating-first sort and saved filter work through the shared filter function', () => {
  const filters = parseRestaurantFilters(new URLSearchParams('sort=trending'));
  assert.deepEqual(filterRestaurants(rows, filters).map((row) => row.id), ['1', '3', '2']);
  assert.deepEqual(filterRestaurants(rows, { ...filters, saved: true }, ['2']).map((row) => row.id), ['2']);
});

test('serialization keeps compatibility keys, repeated values and unrelated navigation context', () => {
  const filters = parseRestaurantFilters(new URLSearchParams('q=pho&district=Ho%C3%A0n+Ki%E1%BA%BFm&district=C%E1%BA%A7u+Gi%E1%BA%A5y&sort=trending'));
  const params = serializeRestaurantFilters(filters, new URLSearchParams('from=search&keep=1'));
  assert.equal(params.get('q'), 'pho');
  assert.deepEqual(params.getAll('district'), ['Hoàn Kiếm', 'Cầu Giấy']);
  assert.equal(params.get('sort'), 'trending');
  assert.equal(params.get('from'), 'search');
  assert.equal(buildFilterHref('/map', filters, { from: 'search' }), '/map?q=pho&district=Ho%C3%A0n+Ki%E1%BA%BFm&district=C%E1%BA%A7u+Gi%E1%BA%A5y&sort=trending&from=search');
});
