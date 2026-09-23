import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch, matchesRestaurantSearch } from '../src/lib/search.ts';
import { extractCoordsFromMapUrl, getRestaurantLocation } from '../src/lib/geo.ts';

const restaurant = { id: 'sample', name: 'Bún chả Đắc Kim', address: 'Hàng Mành', district: 'Hoàn Kiếm', review: 'Thịt nướng thơm', map_url: null };

test('Vietnamese search handles accents, Đ, case and repeated spaces', () => {
  assert.equal(normalizeSearch('  ĐỐNG   ĐA  '), 'dong da');
  for (const query of ['bun cha', 'ĐẮC KIM', 'hang manh', 'hoan kiem', 'thit nuong', 'bún chả']) {
    assert.equal(matchesRestaurantSearch(restaurant, query), true, query);
  }
  assert.equal(matchesRestaurantSearch(restaurant, 'phở bò'), false);
  assert.equal(matchesRestaurantSearch(restaurant, '  '), true);
  assert.equal(matchesRestaurantSearch({ ...restaurant, review: null }, 'thit'), false);
  assert.equal(matchesRestaurantSearch(restaurant, '%),name.eq.test'), false);
});

test('place coordinates take priority over map camera center', () => {
  assert.deepEqual(extractCoordsFromMapUrl('https://www.google.com/maps/place/test/@21.04,105.8,15z/data=!3d21.0315!4d105.8492'), [21.0315, 105.8492]);
  assert.equal(extractCoordsFromMapUrl('https://www.google.com/maps/@21.04,105.8,15z'), null);
});

test('coordinate queries support encoded commas and reject unrelated/invalid URLs', () => {
  assert.deepEqual(extractCoordsFromMapUrl('https://www.google.com/maps/search/?api=1&query=21.03%2C105.85'), [21.03, 105.85]);
  assert.deepEqual(extractCoordsFromMapUrl('https://maps.google.com/?q=21.03,105.85'), [21.03, 105.85]);
  for (const url of ['https://maps.app.goo.gl/short', 'https://evil.example/?q=21.03,105.85', 'javascript:alert(1)', 'invalid', 'https://maps.google.com/?q=91,181']) {
    assert.equal(extractCoordsFromMapUrl(url), null, url);
  }
});

test('street, district and city fallbacks remain explicitly approximate', () => {
  for (const value of [restaurant, { ...restaurant, address: '', name: '' }, { ...restaurant, address: '', name: '', district: '' }]) {
    const location = getRestaurantLocation(value);
    assert.equal(location.isApproximate, true);
    assert.equal(location.coordinates.every(Number.isFinite), true);
  }
  assert.equal(getRestaurantLocation({ ...restaurant, map_url: 'https://maps.google.com/?q=21.03,105.85' }).isApproximate, false);
});
