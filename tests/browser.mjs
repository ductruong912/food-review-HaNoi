import { chromium } from 'playwright';
import { expect } from 'playwright/test';
import nextEnv from '@next/env';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { rows, uid } from './restaurant-fixtures.mjs';
nextEnv.loadEnvConfig(process.cwd());
const base = process.env.TEST_URL || 'http://localhost:3000';
const backend = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
let key = `sb-${backend.hostname.split('.')[0]}-auth-token`;
const session = {
  access_token: `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: uid, exp: Math.floor(Date.now()/1000) + 3600 })).toString('base64url')}.test`,
  refresh_token: 'fake-refresh', expires_at: Math.floor(Date.now()/1000) + 3600, expires_in: 3600, token_type: 'bearer',
  user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'friend@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-09-01' },
};
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium'), headless: process.env.HEADLESS === '1' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', geolocation: { latitude: 21.03, longitude: 105.84 }, permissions: ['geolocation'] });
let role = 'viewer';
let responseRows = rows;
const originalMapUrls = rows.map(row => row.map_url);
let failData = false;
let profileFailure = false;
let failSave = true;
let failFavorites = false;
let failUpload = false;
let failMapTiles = false;
let mapTileRequests = 0;
let tokenResponse = null;
let uploadRelease;
let uploadCount = 0;
let writes = [];
const remoteFavorites = new Map();
let collectionRows = [];
let collectionItemRows = [];
const secondaryUid = '66666666-6666-4666-8666-666666666666';
const accountRoles = new Map([[uid, role], [secondaryUid, 'viewer']]);
const requestUserId = request => {
  const token = request.headers().authorization?.replace(/^Bearer\s+/i, '');
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub || null; } catch { return null; }
};
// Every browser request to the backend is intercepted; no test data is sent to the live project.
const routeHandler = async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/storage/v1/')) key = `sb-${url.hostname.split('.')[0]}-auth-token`;
  if (url.pathname.startsWith('/auth/')) {
    if (url.pathname.endsWith('/settings')) return route.fulfill({ json: { external: { email: true, google: true } } });
    if (url.pathname.endsWith('/token') && tokenResponse) return route.fulfill({ json: tokenResponse });
    return route.fulfill({ status: 400, json: { message: 'Test auth failure', error_description: 'Test auth failure' } });
  }
  if (url.pathname.includes('/profiles')) {
    if (profileFailure) return route.fulfill({ status: 400, json: { message: 'Unavailable' } });
    const userId = requestUserId(request);
    if (!userId || (url.searchParams.get('id') || '').slice(3) !== userId) return route.fulfill({ status: 403, json: { message: 'Profile access denied' } });
    return route.fulfill({ json: { id: userId, email: 'friend@example.test', display_name: 'Bạn thử', avatar_url: null, role: accountRoles.get(userId) || 'viewer' } });
  }
  if (url.pathname.endsWith('/user_favorites')) {
    if (failFavorites) return route.fulfill({ status: 503, json: { message: 'Favorites unavailable' } });
    const userId = requestUserId(request);
    if (!userId) return route.fulfill({ status: 401, json: { message: 'Sign in required' } });
    const favorites = remoteFavorites.get(userId) || new Set();
    if (request.method() === 'GET') {
      const filteredId = url.searchParams.get('user_id');
      return route.fulfill({ json: filteredId === `eq.${userId}` ? [...favorites].map(restaurant_id => ({ user_id: userId, restaurant_id })) : [] });
    }
    if (request.method() === 'POST') {
      const data = request.postDataJSON();
      const payload = Array.isArray(data) ? data : [data];
      if (payload.some(item => item.user_id !== userId)) return route.fulfill({ status: 403, json: { message: 'Favorite owner mismatch' } });
      for (const item of payload) favorites.add(item.restaurant_id);
      remoteFavorites.set(userId, favorites);
      return route.fulfill({ status: 201, json: [] });
    }
    if (request.method() === 'DELETE') {
      const id = (url.searchParams.get('restaurant_id') || '').slice(3);
      favorites.delete(id);
      return route.fulfill({ status: 204, body: '' });
    }
  }
  if (url.pathname.endsWith('/favorite_collections')) {
    const userId = requestUserId(request);
    if (!userId) return route.fulfill({ status: 401, json: { message: 'Sign in required' } });
    if (request.method() === 'GET') return route.fulfill({ json: url.searchParams.get('user_id') === `eq.${userId}` ? collectionRows.filter(item => item.user_id === userId) : [] });
    if (request.method() === 'POST') {
      const data = request.postDataJSON();
      if (data.user_id !== userId) return route.fulfill({ status: 403, json: { message: 'Collection owner mismatch' } });
      if (collectionRows.some(item => item.user_id === userId && item.name.trim().toLowerCase() === data.name.trim().toLowerCase())) return route.fulfill({ status: 409, json: { code: '23505', message: 'Duplicate collection' } });
      const row = { ...data, id: `collection-${collectionRows.length + 1}`, created_at: new Date().toISOString() };
      collectionRows.push(row);
      return route.fulfill({ status: 201, json: row });
    }
  }
  if (url.pathname.endsWith('/favorite_collection_items')) {
    const userId = requestUserId(request);
    if (!userId) return route.fulfill({ status: 401, json: { message: 'Sign in required' } });
    if (request.method() === 'GET') return route.fulfill({ json: collectionItemRows.filter(item => item.user_id === userId) });
    if (request.method() === 'POST') {
      const data = request.postDataJSON();
      if (data.user_id !== userId || !collectionRows.some(collection => collection.id === data.collection_id && collection.user_id === userId)) return route.fulfill({ status: 403, json: { message: 'Collection item owner mismatch' } });
      if (!collectionItemRows.some(item => item.collection_id === data.collection_id && item.restaurant_id === data.restaurant_id)) collectionItemRows.push(data);
      return route.fulfill({ status: 201, json: [] });
    }
    if (request.method() === 'DELETE') {
      const collectionId = (url.searchParams.get('collection_id') || '').slice(3);
      const restaurantId = (url.searchParams.get('restaurant_id') || '').slice(3);
      collectionItemRows = collectionItemRows.filter(item => !(item.user_id === userId && item.collection_id === collectionId && item.restaurant_id === restaurantId));
      return route.fulfill({ status: 204, body: '' });
    }
  }
  if (url.pathname.startsWith('/storage/v1/object/') && request.method() === 'POST') {
    uploadCount++;
    if (failUpload) return route.fulfill({ status: 503, json: { message: 'Upload failed' } });
    await new Promise(resolve => { uploadRelease = resolve; });
    return route.fulfill({ json: { Key: url.pathname, Id: 'test-image' } });
  }
  if (url.pathname.includes('/restaurants')) {
    if (request.method() !== 'GET') {
      writes.push({ method: request.method(), data: request.postDataJSON() });
      return route.fulfill(failSave ? { status: 403, json: { message: 'Denied in test' } } : { json: { id: rows[0].id } });
    }
    if (failData) return route.fulfill({ status: 400, json: { message: 'Test failure' } });
    const id = url.searchParams.get('id');
    return route.fulfill({ json: id?.startsWith('eq.') ? responseRows.find(r => r.id === id.slice(3)) : responseRows });
  }
  return route.fulfill({ status: 403, json: { message: 'Unexpected test request blocked' } });
};
await context.route('**/rest/v1/**', routeHandler);
await context.route('**/auth/v1/**', routeHandler);
await context.route('**/storage/v1/**', routeHandler);
await context.route(url => {
  const parsed = new URL(url);
  return (parsed.hostname.endsWith('.google.com') && parsed.pathname.startsWith('/vt/')) || parsed.hostname.endsWith('.tile.openstreetmap.org');
}, route => {
  mapTileRequests++;
  if (failMapTiles) return route.fulfill({ status: 503, body: 'Map tiles unavailable' });
  return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64') });
});
const page = await context.newPage();
const errors = [];
const callbackDiagnostics = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
await page.route(url => url.pathname === '/_next/image' && url.searchParams.get('url') === '/broken-image.png', route => route.fulfill({ status: 500, body: 'broken image fixture' }));
rows[0].image_url = '/broken-image.png';
await mkdir('test-results', { recursive: true });
try {
  await page.goto(base);
  await expect(page.getByRole('heading', { name: rows[0].name })).toBeVisible();
  for (const label of ['Khám phá', 'Bản đồ', 'Đã lưu', 'Cá nhân']) await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
  const brokenImage = page.locator('article').filter({ has: page.getByRole('heading', { name: rows[0].name }) }).locator('img');
  await expect.poll(() => brokenImage.getAttribute('src')).toMatch(/placeholder-food\.svg/);
  rows[0].image_url = '';
  assert.equal(await page.locator('a button').count(), 0, 'Interactive controls must not be nested');
  assert.ok(await page.locator('article').first().evaluate(el => el.getBoundingClientRect().top < 650), 'Mobile list should be visible without a full-screen hero');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { localStorage.setItem('foodhn-theme', theme); document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(theme); }, theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
      const greenToken = (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--gold-text').trim())).toLowerCase();
      assert.equal(greenToken, theme === 'light' ? '#1c6b4e' : '#d4a359', `Readable accent token in ${theme} mode`);
      if (width === 1440) await expect(page.locator('.fab')).toBeHidden();
      await page.locator('article img').evaluateAll(images => Promise.all(images.map(img => img.decode().catch(() => {}))));
      await page.screenshot({ path: `test-results/home-${theme}-${width}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const filterButtonBox = await page.getByLabel('Mở bộ lọc').boundingBox();
  assert.ok(filterButtonBox.height >= 44, 'Primary filter control has a 44px touch target');
  await page.getByTitle('Mở bộ lọc').click();
  const filters = page.getByRole('dialog', { name: 'Bộ lọc quán' });
  await expect(filters).toBeVisible();
  await filters.getByLabel('Sắp xếp').selectOption('name');
  await expect(page).toHaveURL(/sort=name/);
  await filters.getByRole('button', { name: 'Hẹn hò', exact: true }).click();
  await expect(page).toHaveURL(/occasion=hen_ho/);
  await filters.getByRole('button', { name: 'Hẹn hò', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(filters).toHaveCount(0);
  await expect(page.getByTitle('Mở bộ lọc')).toBeFocused();
  await page.getByLabel('Mở bộ lọc').click();
  const multiFilters = page.getByRole('dialog', { name: 'Bộ lọc quán' });
  await multiFilters.getByRole('button', { name: 'Hoàn Kiếm', exact: true }).click();
  await multiFilters.getByRole('button', { name: 'Ba Đình', exact: true }).click();
  await multiFilters.getByRole('button', { name: 'Món Việt hằng ngày', exact: true }).click();
  await multiFilters.getByRole('button', { name: 'Bánh & Tráng miệng', exact: true }).click();
  await multiFilters.getByRole('button', { name: /Xem kết quả/ }).click();
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).getAll('district').length)).toBe(2);
  await expect(page.getByRole('heading', { name: rows[2].name })).toBeVisible();
  await expect(page.locator('article').filter({ has: page.getByRole('heading', { name: rows[2].name }) })).toContainText('Muốn thử');
  await page.getByRole('link', { name: 'Xem bản đồ với bộ lọc hiện tại' }).click();
  await expect(page).toHaveURL(/\/map\?/);
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).getAll('category').length)).toBe(2);
  await expect(page.locator('.leaflet-marker-icon.restaurant-cluster-icon')).toHaveCount(1);
  await expect(page.locator('.leaflet-marker-icon.restaurant-marker-icon')).toHaveCount(1);
  const dessertMarker = page.getByRole('button', { name: new RegExp(`${rows[2].name}.*ước lượng`) });
  await dessertMarker.focus();
  await dessertMarker.press('Enter');
  await expect(page.getByRole('region', { name: 'Thông tin quán trên bản đồ' })).toContainText(rows[2].name);
  await expect(page.getByRole('region', { name: 'Thông tin quán trên bản đồ' })).toContainText('Muốn thử');
  await expect(page.locator('.leaflet-popup')).toHaveCount(0, 'Map details use one information panel, without Leaflet popups');
  await page.getByRole('link', { name: 'Quay lại danh sách với bộ lọc hiện tại' }).click();
  await expect(page).toHaveURL(/\/\?/);
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).getAll('district').length)).toBe(2);
  await page.getByRole('button', { name: `Lưu ${rows[0].name}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Bỏ lưu ${rows[0].name}` })).toHaveAttribute('aria-pressed', 'true');
  const search = page.getByPlaceholder('Tìm món, quán hoặc con phố...');
  await search.fill('bun cha');
  await expect(page.getByRole('heading', { name: rows[1].name })).toHaveCount(0);
  await expect(page).toHaveURL(/q=bun\+cha/);
  await page.reload();
  await expect(search).toHaveValue('bun cha');
  await page.goto(`${base}/?category=mon_viet_hang_ngay&district=Ho%C3%A0n+Ki%E1%BA%BFm&rating=ngon&sort=name&saved=true`);
  await expect(page.getByRole('heading', { name: rows[0].name })).toBeVisible();
  await expect(page.getByRole('heading', { name: rows[1].name })).toHaveCount(0);
  await page.goto(`${base}/saved`);
  await expect(page.getByRole('heading', { name: rows[0].name })).toBeVisible();
  await expect(page.getByRole('heading', { name: rows[1].name })).toHaveCount(0);
  await page.evaluate(() => { document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light'); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { document.documentElement.classList.remove('light'); document.documentElement.classList.add('dark'); });
  await page.screenshot({ path: 'test-results/saved-desktop-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light'); });
  await page.screenshot({ path: 'test-results/saved-mobile-light.png', fullPage: true });
  await page.evaluate(() => { localStorage.removeItem('food_hn_bookmarks'); window.dispatchEvent(new Event('storage')); });
  await expect(page.getByRole('heading', { name: 'Chưa có quán nào được lưu' })).toBeVisible();
  await page.screenshot({ path: 'test-results/saved-empty.png', fullPage: true });
  console.log('PASS light/dark contrast, multi-select filters, list/map URLs, shared rating labels, device bookmarks and empty state');

  rows[0] = { ...rows[0], price_min_vnd: 40000, price_max_vnd: 50000, price_unit: 'vnd_per_person', occasions: ['mot_minh'] };
  rows[1] = { ...rows[1], price_min_vnd: 45000, price_max_vnd: 50000, price_unit: 'vnd_per_person', occasions: ['mot_minh'] };
  rows[2] = { ...rows[2], price_min_vnd: 20000, price_max_vnd: 30000, price_unit: 'vnd_per_person', occasions: [] };
  await page.goto(base);
  await expect(page.locator('article').filter({ has: page.getByRole('heading', { name: rows[0].name }) })).toContainText('40.000');
  await page.locator('button:has(svg.lucide-dices)').click();
  const picker = page.locator('[role="dialog"][aria-modal="true"]');
  await expect(picker.locator('button[aria-label]').first()).toHaveAttribute('aria-pressed', 'false');
  await picker.locator('#quick-district').selectOption(rows[0].district);
  await picker.locator('fieldset').nth(0).locator('button').nth(0).click();
  await picker.locator('fieldset').nth(1).locator('button').nth(0).click();
  await picker.locator('button.btn-primary').click();
  const quickResults = picker.locator('ol[aria-label]');
  await expect(quickResults.locator(':scope > li')).toHaveCount(2);
  await expect(quickResults).toContainText('40.000');
  await picker.locator('fieldset').nth(0).locator('button').nth(2).click();
  await picker.locator('button.btn-primary').click();
  await expect(picker.locator('[role="status"] h3')).toBeVisible();
  await picker.locator('button[aria-label]').first().click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('foodhn-sound-enabled'))).toBe('true');
  await page.screenshot({ path: 'test-results/quick-picker-mobile.png', fullPage: true });
  await picker.locator('button[aria-label]').nth(1).click();
  await page.locator('button:has(svg.lucide-dices)').click();
  const reopenedPicker = page.locator('[role="dialog"][aria-modal="true"]');
  await expect(reopenedPicker.locator('button[aria-label]').first()).toHaveAttribute('aria-pressed', 'true');
  await reopenedPicker.locator('button[aria-label]').nth(1).click();
  console.log('PASS strict quick-pick conditions, evidence-based reasons, empty results and explicit sound preference');

  await page.goto(`${base}/search`);
  await expect(page.getByRole('heading', { name: 'Bắt đầu với một món hoặc khu vực' })).toBeVisible();
  await page.getByRole('textbox').fill('dac kim');
  await expect(page.getByRole('heading', { name: rows[0].name })).toBeVisible();
  failData = true;
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Không tải được' })).toBeVisible();
  failData = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('heading', { name: rows[0].name })).toBeVisible();
  await page.goto(`${base}/search?q=pho&district=Ho%C3%A0n+Ki%E1%BA%BFm&district=Ba+%C4%90%C3%ACnh&category=mon_viet_hang_ngay&category=banh_trang_mieng`);
  await expect(page.getByRole('textbox')).toHaveValue('pho');
  await expect(page.getByRole('heading', { name: rows[1].name })).toBeVisible();
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).getAll('district').length)).toBe(2);
  await page.getByRole('link', { name: 'Xem kết quả tìm kiếm trên bản đồ' }).click();
  await expect(page).toHaveURL(/from=search/);
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).getAll('category').length)).toBe(2);
  await page.getByRole('link', { name: 'Quay lại danh sách với bộ lọc hiện tại' }).click();
  await expect(page).toHaveURL(/\/search\?/);
  await expect(page.getByRole('textbox')).toHaveValue('pho');
  await page.goto(`${base}/search?q=khong-co-quan-nao`);
  await expect(page.getByRole('heading', { name: 'Không tìm thấy quán khớp bộ lọc' })).toBeVisible();
  await page.goto(`${base}/search?sort=trending`);
  await page.evaluate(id => { localStorage.setItem('food_hn_bookmarks', JSON.stringify([id])); window.dispatchEvent(new CustomEvent('food_hn_bookmarks_updated', { detail: { updated: [id] } })); }, rows[0].id);
  await page.getByLabel('Chỉ xem quán đã lưu').click();
  await expect(page).toHaveURL(/saved=true/);
  await expect(page.getByRole('heading', { name: rows[1].name })).toHaveCount(0);
  await page.getByLabel('Bỏ lọc quán đã lưu').click();
  await expect(page).not.toHaveURL(/saved=true/);
  await page.evaluate(() => { document.body.style.minHeight = '1800px'; });
  await page.evaluate(() => window.scrollTo(0, 360));
  const scrollBeforeDetail = await page.evaluate(() => window.scrollY);
  await page.locator('article a').nth(1).click();
  await expect(page).toHaveURL(new RegExp(`/restaurant/${rows[1].id}`));
  await page.getByRole('button', { name: 'Quay lại danh sách' }).click();
  await expect(page).toHaveURL(/\/search\?sort=trending/);
  await expect.poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - scrollBeforeDetail)).toBeLessThanOrEqual(24);
  await page.evaluate(() => { document.body.style.minHeight = ''; });
  await page.goto(`${base}/restaurant/${rows[0].id}`);
  await expect(page.getByRole('button', { name: 'Quay lại danh sách' })).toBeVisible();
  await page.getByRole('button', { name: 'Quay lại danh sách' }).click();
  await expect(page).toHaveURL(base + '/');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(theme); localStorage.setItem('foodhn-theme', theme); }, theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto(`${base}/restaurant/${rows[0].id}`);
      await expect(page.locator('h1')).toHaveText(rows[0].name);
      await expect(page.getByRole('link', { name: /Chỉ đường/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Chia sẻ quán' })).toBeVisible();
      await page.screenshot({ path: `test-results/detail-${theme}-${width}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  rows[0].map_url = 'https://maps.google.com/?q=21.025,105.845';
  rows[1].map_url = rows[0].map_url;
  await page.goto(`${base}/map`);
  await expect(page.locator('.restaurant-cluster-icon')).toBeVisible();
  await page.getByLabel('Chuyển chế độ bản đồ').click();
  await page.getByRole('button', { name: /Vệ tinh Google/ }).click();
  await page.getByLabel('Chuyển chế độ bản đồ').click();
  await expect(page.getByRole('button', { name: /Vệ tinh Google/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Google Maps' })).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.restaurant-cluster-icon').click();
  const mapPanel = page.getByRole('region', { name: 'Thông tin quán trên bản đồ' });
  await expect(mapPanel).toContainText('2 quán gần nhau');
  await mapPanel.getByRole('button', { name: new RegExp(rows[1].name) }).click();
  await expect(mapPanel.getByRole('heading', { name: rows[1].name })).toBeVisible();
  await expect(mapPanel.getByRole('link', { name: /Chỉ đường/ })).toHaveAttribute('href', 'https://maps.google.com/?q=21.025,105.845');
  await expect(mapPanel).toContainText('Vị trí ước lượng từ dữ liệu hiện có');
  await page.screenshot({ path: 'test-results/map-cluster-mobile.png', fullPage: true });
  rows.forEach((row, index) => { row.map_url = originalMapUrls[index]; });
  await page.goto(`${base}/map`);
  await expect(page.locator('.restaurant-marker-icon').first()).toBeVisible();
  await page.evaluate(id => { localStorage.setItem('food_hn_bookmarks', JSON.stringify([id])); window.dispatchEvent(new CustomEvent('food_hn_bookmarks_updated', { detail: { updated: [id] } })); }, rows[0].id);
  await page.getByLabel('Chỉ xem quán đã lưu').click();
  await expect(page).toHaveURL(/saved=true/);
  await expect(page.locator('.restaurant-marker-icon')).toHaveCount(1);
  await page.getByLabel('Bỏ lọc quán đã lưu').click();
  await expect(page).not.toHaveURL(/saved=true/);
  await page.screenshot({ path: 'test-results/map-desktop-light.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/map-mobile.png', fullPage: true });
  await page.evaluate(() => localStorage.removeItem('food_hn_bookmarks'));
  failData = true;
  await page.goto(`${base}/map`);
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa tải được' })).toBeVisible();
  failData = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByLabel('Vị trí của tôi').click();
  const approximateMarker = page.getByRole('button', { name: new RegExp(`${rows[2].name}.*ước lượng`) });
  await approximateMarker.focus();
  await approximateMarker.press('Enter');
  const locationPanel = page.getByRole('region', { name: 'Thông tin quán trên bản đồ' });
  await expect(locationPanel).toContainText('Vị trí ước lượng');
  await expect(locationPanel).not.toContainText('Cách bạn');
  await page.screenshot({ path: 'test-results/map-approximate-location.png', fullPage: true });
  failMapTiles = true;
  await page.goto(`${base}/map`);
  const mapTileAlert = page.getByRole('alert').filter({ hasText: 'Không tải được nền bản đồ' });
  await expect(mapTileAlert).toBeVisible();
  await page.screenshot({ path: 'test-results/map-tiles-unavailable-mobile.png', fullPage: true });
  const failedTileRequests = mapTileRequests;
  failMapTiles = false;
  await mapTileAlert.getByRole('button', { name: 'Tải lại' }).click();
  await expect.poll(() => mapTileRequests > failedTileRequests).toBe(true);
  await expect(mapTileAlert).toBeHidden();
  console.log('PASS search/map failure and retry, marker clustering and exact/approximate location labels');

  await page.evaluate(() => { localStorage.setItem('food_review_admin_unlocked', 'true'); localStorage.setItem('food_review_guest_user', JSON.stringify({ id: 'forged', role: 'admin' })); });
  await page.goto(`${base}/restaurant/new`);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)), 'Focus stays inside login dialog');
  await page.getByLabel('Email của bạn').fill('test@example.test');
  await page.getByRole('button', { name: 'Gửi link đăng nhập' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa đăng nhập được' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeFocused();
  remoteFavorites.set(uid, new Set([rows[1].id]));
  await page.evaluate(ids => localStorage.setItem('food_hn_bookmarks', JSON.stringify(ids)), [rows[0].id, rows[1].id]);
  await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key, session });
  await page.reload();
  await expect(page.getByText(/đang có quyền xem/)).toBeVisible();
  role = 'contributor';
  accountRoles.set(uid, role);
  await page.getByRole('button', { name: 'Kiểm tra lại quyền' }).click();
  await expect(page.getByRole('textbox', { name: 'Tên quán' })).toBeVisible();
  assert.equal(writes.length, 0, 'Viewing pages does not write data');
  await page.getByRole('button', { name: 'Thêm quán', exact: true }).click();
  await expect(page.getByText('Nhập tên quán.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Tên quán' })).toBeFocused();
  console.log('PASS login error, focus trap, Escape, forged auth rejection, role refresh');

  await page.goto(`${base}/saved`);
  await expect(page.getByRole('heading', { name: rows[1].name })).toBeVisible();
  await expect(page.getByRole('heading', { name: rows[0].name })).toHaveCount(0, 'Guest favorites must remain separate until selected for import');
  await page.getByRole('button', { name: 'Nhập từ thiết bị' }).click();
  const importDialog = page.getByRole('dialog', { name: 'Nhập danh sách trên thiết bị' });
  await expect(importDialog).toBeVisible();
  await expect(importDialog).toContainText('1 quán đã có trong tài khoản');
  await expect(importDialog.getByRole('checkbox', { name: new RegExp(rows[1].name) })).toBeDisabled();
  await importDialog.getByRole('button', { name: 'Nhập 1 quán', exact: true }).click();
  await expect(importDialog.getByRole('status')).toContainText('Đã nhập lựa chọn');
  await expect.poll(() => [...(remoteFavorites.get(uid) || [])].length).toBe(2);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('food_hn_bookmarks') || '[]').length)).toBe(2);
  await expect(page.getByRole('heading', { name: rows[0].name })).toBeVisible();
  await importDialog.getByRole('button', { name: 'Đóng', exact: true }).click();

  await page.getByRole('button', { name: 'Tạo bộ sưu tập' }).click();
  await page.getByRole('button', { name: '+ Muốn thử' }).click();
  await expect(page.locator('[aria-labelledby="collections-title"] details summary').first()).toBeVisible();
  await page.getByLabel(`Thêm ${rows[0].name} vào bộ sưu tập`).selectOption('collection-1');
  await page.locator('[aria-labelledby="collections-title"] details summary').first().click();
  await expect(page.getByRole('link', { name: rows[0].name, exact: true })).toBeVisible();

  const secondContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await secondContext.route('**/rest/v1/**', routeHandler);
  await secondContext.route('**/auth/v1/**', routeHandler);
  await secondContext.route('**/storage/v1/**', routeHandler);
  await secondContext.addInitScript(({ storageKey, savedSession }) => localStorage.setItem(storageKey, JSON.stringify(savedSession)), { storageKey: key, savedSession: session });
  const secondPage = await secondContext.newPage();
  await secondPage.goto(`${base}/saved`);
  await expect(secondPage.getByRole('heading', { name: rows[0].name })).toBeVisible();
  await expect(secondPage.getByRole('heading', { name: rows[1].name })).toBeVisible();
  await secondContext.close();

  const otherSession = {
    ...session,
    access_token: `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: secondaryUid, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`,
    user: { ...session.user, id: secondaryUid },
  };
  await page.evaluate(({ key, sessionValue }) => localStorage.setItem(key, JSON.stringify(sessionValue)), { key, sessionValue: otherSession });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chưa có quán nào được lưu' })).toBeVisible();
  await expect(page.getByRole('heading', { name: rows[0].name })).toHaveCount(0, 'Switching accounts must not expose another account cache');
  await page.evaluate(({ key, sessionValue }) => localStorage.setItem(key, JSON.stringify(sessionValue)), { key, sessionValue: session });
  await page.reload();
  await expect(page.getByRole('heading', { name: rows[0].name })).toBeVisible();

  failFavorites = true;
  await page.evaluate(({ key, id }) => {
    const ids = JSON.parse(localStorage.getItem(key) || '[]');
    if (!ids.includes(id)) ids.push(id);
    localStorage.setItem(key, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent('food_hn_bookmarks_updated', { detail: { updated: ids, id, isSaved: true } }));
  }, { key: 'food_hn_bookmarks:' + uid, id: rows[2].id });
  const retryFavoriteButton = page.locator('button:has(svg.lucide-rotate-cw)');
  await expect(retryFavoriteButton).toBeVisible();
  await expect.poll(() => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key) || '[]').includes(id), { key: 'food_hn_bookmarks:' + uid, id: rows[2].id })).toBe(true);
  failFavorites = false;
  await retryFavoriteButton.click();
  await expect.poll(() => remoteFavorites.get(uid)?.has(rows[2].id) === true).toBe(true);
  await expect(retryFavoriteButton).toBeHidden();
  console.log('PASS account-scoped sync, duplicate-safe import, private collections, device restore, account isolation and retry after network failure');

  failMapTiles = true;
  await page.goto(`${base}/restaurant/new`);
  await expect(page.locator('.bottom-nav')).toBeHidden();
  const pickerTileAlert = page.getByRole('alert').filter({ hasText: 'Không tải được nền bản đồ' });
  await expect(pickerTileAlert).toBeVisible();
  await page.screenshot({ path: 'test-results/form-map-tiles-unavailable-mobile.png', fullPage: true });
  const failedPickerTileRequests = mapTileRequests;
  failMapTiles = false;
  await pickerTileAlert.getByRole('button', { name: 'Tải lại' }).click();
  await expect.poll(() => mapTileRequests > failedPickerTileRequests).toBe(true);
  await expect(pickerTileAlert).toBeHidden();
  const name = page.getByRole('textbox', { name: 'Tên quán' });
  await expect(page.getByRole('radio', { name: 'Muốn thử' })).toBeChecked();
  await name.fill('Quán thử bản nháp');
  await page.getByLabel('Giá tham khảo').fill('40–60k');
  await page.getByLabel('Đơn vị giá').selectOption('vnd_per_person');
  await page.getByRole('combobox', { name: 'Loại quán' }).selectOption('mon_viet_hang_ngay');
  await page.locator('label').filter({ has: page.getByRole('checkbox', { name: 'Hẹn hò', exact: true }) }).click();
  await page.getByLabel('Nhận xét', { exact: true }).fill('Nội dung không được mất khi tải lại.');
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').name, `food_hn_draft:${uid}:new`)).toBe('Quán thử bản nháp');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tìm thấy bản nháp trên thiết bị này' })).toBeVisible();
  await page.getByRole('button', { name: 'Bắt đầu mới' }).click();
  await expect(name).toHaveValue('');
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), `food_hn_draft:${uid}:new`)).toBe(null);
  await name.fill('Quán thử bản nháp');
  await page.getByLabel('Giá tham khảo').fill('40–60k');
  await page.getByLabel('Đơn vị giá').selectOption('vnd_per_person');
  await page.getByRole('combobox', { name: 'Loại quán' }).selectOption('mon_viet_hang_ngay');
  await page.locator('label').filter({ has: page.getByRole('checkbox', { name: 'Hẹn hò', exact: true }) }).click();
  await page.getByLabel('Nhận xét', { exact: true }).fill('Nội dung không được mất khi tải lại.');
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').name, `food_hn_draft:${uid}:new`)).toBe('Quán thử bản nháp');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tìm thấy bản nháp trên thiết bị này' })).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp tục bản nháp' }).click();
  await expect(name).toHaveValue('Quán thử bản nháp');
  await expect(page.getByRole('checkbox', { name: 'Hẹn hò', exact: true })).toBeChecked();
  await expect(page.getByLabel('Nhận xét', { exact: true })).toHaveValue('Nội dung không được mất khi tải lại.');
  await page.screenshot({ path: 'test-results/form-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/form-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert').filter({ hasText: 'Chỉ hỗ trợ' })).toBeVisible();
  assert.equal(uploadCount, 0);
  failUpload = true;
  await page.locator('input[type=file]').setInputFiles({ name: 'failed.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64') });
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa tải được ảnh' })).toBeVisible();
  assert.equal(uploadCount, 1);
  failUpload = false;
  await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64') });
  await expect.poll(() => uploadCount).toBe(2);
  await expect(page.locator('button[type=submit]')).toBeDisabled();
  uploadRelease();
  await expect(page.locator('button[type=submit]')).toBeEnabled();
  await page.locator('input[type=file]').setInputFiles({ name: 'photo-two.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64') });
  await expect.poll(() => uploadCount).toBe(3);
  uploadRelease();
  const chooseSecondCover = page.getByRole('button', { name: 'Chọn ảnh 2 làm ảnh bìa' });
  await expect(chooseSecondCover).toBeVisible();
  await chooseSecondCover.click();
  await expect(page.getByRole('button', { name: 'Ảnh 2 đang làm ảnh bìa' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Độ chính xác').selectOption('exact');
  await page.locator('button[type=submit]').click();
  const exactLocationError = page.getByRole('alert').filter({ hasText: 'Hãy xác nhận ghim có đủ tọa độ' });
  await expect(exactLocationError).toBeVisible();
  await expect(page.locator('#restaurant-location-error')).toBeFocused();
  await page.getByLabel('Độ chính xác').selectOption('approximate');
  await page.getByLabel('Vĩ độ').fill('21.032');
  await page.getByLabel('Kinh độ').fill('105.850');
  await page.getByLabel('Độ chính xác').selectOption('exact');
  await page.getByRole('button', { name: 'Xác nhận ghim và lưu tọa độ' }).click();
  await page.locator('button[type=submit]').click();
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa lưu được quán' })).toBeVisible();
  await expect(name).toHaveValue('Quán thử bản nháp');
  assert.ok(writes.at(-1).data.image_url.includes(uid));
  assert.deepEqual(writes.at(-1).data.occasions, ['hen_ho']);
  assert.equal(writes.at(-1).data.price_min_vnd, 40000);
  assert.equal(writes.at(-1).data.price_max_vnd, 60000);
  assert.equal(writes.at(-1).data.price_unit, 'vnd_per_person');
  assert.equal(writes.at(-1).data.image_urls.length, 2);
  assert.equal(writes.at(-1).data.image_url, writes.at(-1).data.image_urls[1]);
  assert.equal(writes.at(-1).data.location_accuracy, 'exact');
  assert.equal(writes.at(-1).data.latitude, 21.032);
  assert.equal(writes.at(-1).data.longitude, 105.85);
  failSave = false;
  // All database reads and writes in this test use the local intercepted fixture backend.
  await page.route(`**/restaurant/${rows[0].id}*`, route => route.fulfill({ contentType: 'text/html', body: '<p>Saved</p>' }));
  await page.locator('button[type=submit]').click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), `food_hn_draft:${uid}:new`)).toBe(null);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  console.log('PASS draft recovery, MIME and upload failure handling, multi-photo cover selection, confirmed pin and save retry');

  rows[1].image_url = 'https://images.example.test/legacy-new-cover.jpg';
  rows[1].image_urls = ['https://images.example.test/stale-gallery.jpg'];
  await page.goto(`${base}/restaurant/${rows[1].id}/edit`);
  await expect(name).toHaveValue(rows[1].name);
  await expect(page.getByRole('button', { name: 'Ảnh 1 đang làm ảnh bìa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chọn ảnh 2 làm ảnh bìa' })).toBeVisible();
  rows[1].image_url = '';
  rows[1].image_urls = [];
  role = 'viewer';
  accountRoles.set(uid, role);
  await page.reload();
  await expect(page.getByText(/Bạn chưa có quyền sửa/)).toBeVisible();
  profileFailure = true;
  await page.goto(`${base}/restaurant/new`);
  await expect(page.getByText(/Chưa tải được quyền tài khoản/)).toBeVisible();
  profileFailure = false;
  console.log('PASS edit ownership gate and profile failure state');

  page.on('console', message => {
    if (message.type() === 'error') callbackDiagnostics.push(message.text());
  });
  page.on('requestfailed', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/auth/') || path.startsWith('/rest/') || path.includes('/saved')) {
      callbackDiagnostics.push(`${path}: ${request.failure()?.errorText || 'request failed'}`);
    }
  });
  await page.goto(`${base}/auth/callback?error=access_denied&error_description=Denied`);
  await expect(page.getByRole('heading', { name: 'Chưa đăng nhập được' })).toBeVisible();
  await page.evaluate(({ key }) => {
    localStorage.removeItem(key);
    localStorage.setItem(`${key}-code-verifier`, JSON.stringify('a-valid-test-verifier'));
    localStorage.setItem('foodhn:pending-auth-destination', '/saved?importDevice=1');
  }, { key });
  tokenResponse = session;
  await page.goto(`${base}/auth/callback?code=test-code`);
  await expect(page).toHaveURL(/\/saved\?importDevice=1$/);
  const resumedImport = page.getByRole('dialog', { name: 'Nhập danh sách trên thiết bị' });
  await expect(resumedImport).toBeVisible();
  await expect(resumedImport.getByText(/quán đã có trong tài khoản/)).toBeVisible();
  await resumedImport.getByRole('button', { name: 'Đóng nhập danh sách' }).click();
  assert.deepEqual(errors, [], 'No unhandled browser errors');
  console.log('PASS PKCE callback success/error, resumed the pending import action, and no unhandled browser errors');
} catch (error) {
  await page.screenshot({ path: 'test-results/failure.png', fullPage: true });
  if (errors.length) console.error('Browser page errors before failure:', errors.slice(-8));
  if (callbackDiagnostics.length) console.error('Callback browser diagnostics:', callbackDiagnostics.slice(-12));
  throw error;
} finally { uploadRelease?.(); await browser.close(); }
