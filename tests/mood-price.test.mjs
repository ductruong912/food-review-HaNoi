import test from 'node:test';
import assert from 'node:assert/strict';
import { getQuickRecommendations, matchRestaurantsByMood, matchesBudgetBand } from '../src/lib/moodMatcher.ts';
import { formatRestaurantPrice, getPerPersonPriceRange, getPriceFields, parsePriceText } from '../src/lib/prices.ts';
import { getRatingInfo } from '../src/lib/utils.ts';

const restaurant = (overrides = {}) => ({
  id: 'sample', name: 'Quán mẫu', district: 'Hoàn Kiếm', address: '', rating: 'ngon', review: '', image_url: '',
  created_at: '2026-01-01', type: 'food', category: 'mon_viet_hang_ngay', price: null,
  ...overrides,
});

test('price parser preserves ranges and converts explicit VND units', () => {
  assert.deepEqual(parsePriceText('40–60k'), { minVnd: 40_000, maxVnd: 60_000, unit: null });
  assert.deepEqual(parsePriceText('40k–60k'), { minVnd: 40_000, maxVnd: 60_000, unit: null });
  assert.deepEqual(parsePriceText('50k/người'), { minVnd: 50_000, maxVnd: 50_000, unit: 'vnd_per_person' });
  assert.deepEqual(parsePriceText('40.000–60.000 đồng mỗi người'), { minVnd: 40_000, maxVnd: 60_000, unit: 'vnd_per_person' });
  assert.deepEqual(parsePriceText('1,2 triệu/nhóm'), { minVnd: 1_200_000, maxVnd: 1_200_000, unit: 'vnd_per_group' });
  assert.deepEqual(parsePriceText('50.000 VND'), { minVnd: 50_000, maxVnd: 50_000, unit: null });
});

test('missing, bare, and unrecognized prices stay unknown', () => {
  for (const value of [null, undefined, '', '50', 'mức giá tùy món']) assert.equal(parsePriceText(value), null, String(value));
  assert.equal(getPerPersonPriceRange(restaurant({ price: null })), null);
  assert.equal(getPerPersonPriceRange(restaurant({ price: '40–60k' })), null);
});

test('price display adds a unit only when the record supports one', () => {
  assert.equal(formatRestaurantPrice(restaurant({ price: '40–60k' })), '40.000–60.000 ₫');
  assert.equal(formatRestaurantPrice(restaurant({ price: '50k/người' })), '50.000 ₫/người');
  assert.equal(formatRestaurantPrice(restaurant({ price: '1,2 triệu/nhóm' })), '1.200.000 ₫/nhóm');
  assert.equal(formatRestaurantPrice(restaurant({ price: 'chưa rõ' })), 'chưa rõ');
  assert.equal(formatRestaurantPrice(restaurant({ price: null })), 'Chưa rõ giá');
  assert.equal(formatRestaurantPrice(restaurant({ price: null, price_min_vnd: 40_000, price_max_vnd: 60_000, price_unit: 'vnd_per_person' })), '40.000–60.000 ₫/người');
});

test('budget-per-person matching accepts only a known per-person unit', () => {
  assert.deepEqual(getPerPersonPriceRange(restaurant({ price: '50k/người' })), { minVnd: 50_000, maxVnd: 50_000 });
  assert.equal(getPerPersonPriceRange(restaurant({ price: '50k/nhóm' })), null);
  assert.equal(getPerPersonPriceRange(restaurant({ price: '50k/người', price_min_vnd: 50_000, price_max_vnd: 50_000, price_unit: 'vnd_per_group' })), null);
  assert.equal(getPerPersonPriceRange(restaurant({ price: '50k', price_min_vnd: 50_000, price_max_vnd: 50_000, price_unit: null })), null);
  assert.equal(matchesBudgetBand(restaurant({ price_min_vnd: 40_000, price_max_vnd: 60_000, price_unit: 'vnd_per_person' }), 'budget_low'), false);
  assert.equal(matchesBudgetBand(restaurant({ price_min_vnd: 40_000, price_max_vnd: 60_000, price_unit: 'vnd_per_person' }), 'budget_mid'), false);
  assert.equal(matchesBudgetBand(restaurant({ price_min_vnd: 50_000, price_max_vnd: 60_000, price_unit: 'vnd_per_person' }), 'budget_mid'), true);
  assert.equal(matchesBudgetBand(restaurant({ price_min_vnd: 160_000, price_max_vnd: 180_000, price_unit: 'vnd_per_person' }), 'budget_high'), true);
  assert.deepEqual(getPriceFields('40–60k', 'vnd_per_person'), { price_min_vnd: 40_000, price_max_vnd: 60_000, price_unit: 'vnd_per_person' });
  assert.deepEqual(getPriceFields('40–60k', null), { price_min_vnd: 40_000, price_max_vnd: 60_000, price_unit: null });
});

test('recommendations require the chosen district and a matching budget band', () => {
  const matching = restaurant({ id: 'in-area', price_min_vnd: 42_000, price_max_vnd: 48_000, price_unit: 'vnd_per_person' });
  const wrongArea = restaurant({ id: 'other-area', district: 'Cầu Giấy', price_min_vnd: 42_000, price_max_vnd: 48_000, price_unit: 'vnd_per_person' });
  const wrongBudget = restaurant({ id: 'over-budget', price_min_vnd: 60_000, price_max_vnd: 70_000, price_unit: 'vnd_per_person' });
  const unknownPrice = restaurant({ id: 'unknown-price', price: null });
  const result = matchRestaurantsByMood([matching, wrongArea, wrongBudget, unknownPrice], {
    companion: 'solo', craving: 'nuoc', budget: 'budget_low', district: 'Hoàn Kiếm',
  });
  assert.equal(result?.topMatch.id, 'in-area');
  assert.equal(result?.planB, null);
  assert.equal(matchRestaurantsByMood([wrongArea, wrongBudget, unknownPrice], {
    companion: 'solo', craving: 'nuoc', budget: 'budget_low', district: 'Hoàn Kiếm',
  }), null);
});

test('recommendation reasons use recorded facts, including for the backup', () => {
  const first = restaurant({ id: 'first', name: 'Bún chả', price_min_vnd: 42_000, price_max_vnd: 48_000, price_unit: 'vnd_per_person' });
  const backup = restaurant({ id: 'backup', name: 'Cơm nhà', category: 'mon_viet_hang_ngay', occasions: ['gia_dinh'], rating: 'binh_thuong', price_min_vnd: 45_000, price_max_vnd: 49_000, price_unit: 'vnd_per_person' });
  const result = matchRestaurantsByMood([first, backup], { companion: 'solo', craving: 'nuoc', budget: 'budget_low', district: 'Hoàn Kiếm' });
  assert.equal(result?.topMatch.id, 'first');
  assert.match(result.reason, /Đúng khu vực Hoàn Kiếm/);
  assert.match(result.reason, /Giá đã ghi: 42\.000đ–48\.000đ\/người/);
  assert.match(result.reason, /Cảm nhận: Ngon tuyệt/);
  assert.doesNotMatch(result.reason, /lãng mạn|nước dùng đậm|siêu đỉnh|rẻ/iu);
  assert.match(result.planBReason, /Cảm nhận: Khá ổn/);
  assert.match(result.planBReason, /Giá đã ghi: 45\.000đ–49\.000đ\/người/);
});

test('rating labels remain consistent for all saved ratings', () => {
  assert.equal(getRatingInfo('ngon').label, 'Ngon tuyệt');
  assert.equal(getRatingInfo('binh_thuong').label, 'Khá ổn');
  assert.equal(getRatingInfo('khong_ngon').label, 'Không hợp vị');
  assert.equal(getRatingInfo('chua_an').label, 'Muốn thử');
  assert.notEqual(getRatingInfo('chua_an').label, 'Khá ổn');
});

test('quick picks require area, per-person budget and a recorded occasion, then return at most three factual reasons', () => {
  const fit = (id, overrides = {}) => restaurant({
    id, name: `Quán ${id}`, district: 'Hoàn Kiếm', rating: 'ngon', occasions: ['mot_minh'],
    price_min_vnd: 30000, price_max_vnd: 45000, price_unit: 'vnd_per_person', ...overrides,
  });
  const candidates = [
    fit('one'), fit('two'), fit('three'), fit('four'),
    fit('wrong-area', { district: 'Ba Đình' }),
    fit('wrong-budget', { price_max_vnd: 60000 }),
    fit('wrong-unit', { price_unit: 'vnd_per_group' }),
    fit('no-price', { price_min_vnd: null, price_max_vnd: null, price_unit: null }),
    fit('wrong-companion', { occasions: ['gia_dinh'] }),
  ];
  const choices = { district: 'Hoàn Kiếm', budget: 'max_50k', companion: 'solo' };
  const results = getQuickRecommendations(candidates, choices);
  assert.equal(results.length, 3);
  assert.ok(results.every((item) => ['one', 'two', 'three', 'four'].includes(item.restaurant.id)));
  assert.deepEqual(results[0].reasons, [
    'Khu vực: Hoàn Kiếm',
    'Giá đã ghi: 30.000đ–45.000đ/người',
    'Được gắn nhãn: Một mình',
  ]);
  assert.doesNotMatch(results[0].reasons.join(' '), /lãng mạn|nước dùng ngon|giá rẻ/i);
  assert.deepEqual(getQuickRecommendations(candidates, { ...choices, district: 'Ba Đình', companion: 'friends' }), []);
  assert.deepEqual(getQuickRecommendations(candidates, { ...choices, district: '' }), []);
});
