import { chromium } from 'playwright';
import { expect } from 'playwright/test';
import nextEnv from '@next/env';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
nextEnv.loadEnvConfig(process.cwd());
const base = process.env.TEST_URL || 'http://localhost:3000';
const backend = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const key = `sb-${backend.hostname.split('.')[0]}-auth-token`;
const uid = '11111111-1111-4111-8111-111111111111';
const rows = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Bún chả Đắc Kim', address: 'Hàng Mành', district: 'Hoàn Kiếm', review: 'Thịt nướng thơm, nên đi trước giờ trưa.', rating: 'ngon', category: 'mon_viet_hang_ngay', image_url: '', price: '50k', map_url: null, created_at: '2026-09-01', created_by: uid },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Phở Bò', address: 'Hàng Bông', district: 'Hoàn Kiếm', review: 'Nước dùng trong, đậm vị.', rating: 'ngon', category: 'mon_viet_hang_ngay', image_url: '', price: '60k', map_url: 'https://maps.google.com/?q=21.025,105.845', created_at: '2026-09-01', created_by: uid },
];
const session = {
  access_token: `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: uid, exp: Math.floor(Date.now()/1000) + 3600 })).toString('base64url')}.test`,
  refresh_token: 'fake-refresh', expires_at: Math.floor(Date.now()/1000) + 3600, expires_in: 3600, token_type: 'bearer',
  user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'friend@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-09-01' },
};
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium'), headless: process.env.HEADLESS === '1' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', geolocation: { latitude: 21.03, longitude: 105.84 }, permissions: ['geolocation'] });
let role = 'viewer';
let failData = false;
let profileFailure = false;
let failSave = true;
let tokenResponse = null;
let uploadRelease;
let uploadCount = 0;
let writes = [];
// Every browser request to the backend is intercepted; no test data is sent to the live project.
await context.route(`${backend.origin}/**`, async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.pathname.startsWith('/auth/')) {
    if (url.pathname.endsWith('/settings')) return route.fulfill({ json: { external: { email: true, google: true } } });
    if (url.pathname.endsWith('/token') && tokenResponse) return route.fulfill({ json: tokenResponse });
    return route.fulfill({ status: 400, json: { message: 'Test auth failure', error_description: 'Test auth failure' } });
  }
  if (url.pathname.includes('/profiles')) return route.fulfill(profileFailure ? { status: 400, json: { message: 'Unavailable' } } : { json: { id: uid, email: 'friend@example.test', display_name: 'Bạn thử', avatar_url: null, role } });
  if (url.pathname.startsWith('/storage/v1/object/') && request.method() === 'POST') {
    uploadCount++;
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
    return route.fulfill({ json: id?.startsWith('eq.') ? rows.find(r => r.id === id.slice(3)) : rows });
  }
  return route.fulfill({ status: 403, json: { message: 'Unexpected test request blocked' } });
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
await mkdir('test-results', { recursive: true });
try {
  await page.goto(base);
  await expect(page.getByRole('heading', { name: rows[0].name })).toBeVisible();
  assert.equal(await page.locator('a button').count(), 0, 'Interactive controls must not be nested');
  assert.ok(await page.locator('article').first().evaluate(el => el.getBoundingClientRect().top < 650), 'Mobile list should be visible without a full-screen hero');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { localStorage.setItem('foodhn-theme', theme); document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(theme); }, theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
      if (width === 1440) await expect(page.locator('.fab')).toBeHidden();
      await page.locator('article img').evaluateAll(images => Promise.all(images.map(img => img.decode().catch(() => {}))));
      await page.screenshot({ path: `test-results/home-${theme}-${width}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByRole('button', { name: `Lưu ${rows[0].name}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Bỏ lưu ${rows[0].name}` })).toHaveAttribute('aria-pressed', 'true');
  const search = page.getByPlaceholder('Tìm món, tên quán, con phố...');
  await search.fill('bun cha');
  await expect(page.getByRole('heading', { name: rows[1].name })).toHaveCount(0);
  await expect(page).toHaveURL(/q=bun\+cha/);
  await page.reload();
  await expect(search).toHaveValue('bun cha');
  await page.goto(`${base}/?category=mon_viet_hang_ngay&district=Ho%C3%A0n+Ki%E1%BA%BFm&rating=ngon&sort=name&saved=true`);
  await expect(page.getByRole('heading', { name: rows[0].name })).toBeVisible();
  await expect(page.getByRole('heading', { name: rows[1].name })).toHaveCount(0);
  console.log('PASS responsive themes, semantic cards, bookmarks, accent search, URL persistence');

  await page.goto(`${base}/search`);
  await page.getByRole('textbox').fill('dac kim');
  await expect(page.getByRole('heading', { name: rows[0].name })).toBeVisible();
  failData = true;
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Không tải được' })).toBeVisible();
  failData = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('heading', { name: rows[0].name })).toBeVisible();
  failData = true;
  await page.goto(`${base}/map`);
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa tải được' })).toBeVisible();
  failData = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
  await page.getByTitle('Vị trí của tôi').click();
  await page.locator('.leaflet-marker-icon.custom-map-pin').first().click();
  await expect(page.locator('.leaflet-popup-content')).toContainText('Vị trí ước lượng');
  await expect(page.locator('.leaflet-popup-content')).not.toContainText('Cách bạn');
  console.log('PASS search/map failure and retry; approximate locations labeled');

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
  await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key, session });
  await page.reload();
  await expect(page.getByText(/đang có quyền xem/)).toBeVisible();
  role = 'contributor';
  await page.getByRole('button', { name: 'Kiểm tra lại quyền' }).click();
  await expect(page.getByLabel('Tên quán *', { exact: true })).toBeVisible();
  assert.equal(writes.length, 0, 'Viewing pages does not write data');
  console.log('PASS login error, focus trap, Escape, forged auth rejection, role refresh');

  const name = page.getByLabel('Tên quán *', { exact: true });
  await name.fill('Quán thử bản nháp');
  await page.getByLabel('Loại quán *', { exact: true }).selectOption('mon_viet_hang_ngay');
  await page.locator('label').filter({ has: page.getByRole('checkbox', { name: 'Hẹn hò', exact: true }) }).click();
  await page.getByLabel('Nhận xét', { exact: true }).fill('Nội dung không được mất khi tải lại.');
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').name, `food_hn_draft:${uid}:new`)).toBe('Quán thử bản nháp');
  await page.reload();
  await expect(name).toHaveValue('Quán thử bản nháp');
  await expect(page.getByRole('checkbox', { name: 'Hẹn hò', exact: true })).toBeChecked();
  await expect(page.getByLabel('Nhận xét', { exact: true })).toHaveValue('Nội dung không được mất khi tải lại.');
  await page.screenshot({ path: 'test-results/form-mobile.png', fullPage: true });
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert').filter({ hasText: 'Chỉ hỗ trợ' })).toBeVisible();
  assert.equal(uploadCount, 0);
  await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64') });
  await expect.poll(() => uploadCount).toBe(1);
  await expect(page.locator('button[type=submit]')).toBeDisabled();
  uploadRelease();
  await expect(page.locator('button[type=submit]')).toBeEnabled();
  await page.locator('button[type=submit]').click();
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa lưu được quán' })).toBeVisible();
  await expect(name).toHaveValue('Quán thử bản nháp');
  assert.ok(writes.at(-1).data.image_url.includes(uid));
  assert.deepEqual(writes.at(-1).data.occasions, ['hen_ho']);
  failSave = false;
  // Abort navigation after successful mocked write; a server-rendered detail page uses the real read-only backend.
  await page.route(`**/restaurant/${rows[0].id}*`, route => route.fulfill({ contentType: 'text/html', body: '<p>Saved</p>' }));
  await page.locator('button[type=submit]').click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), `food_hn_draft:${uid}:new`)).toBe(null);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  console.log('PASS draft recovery, MIME validation, upload/save interlock, save error/retry and draft cleanup');

  await page.goto(`${base}/restaurant/${rows[1].id}/edit`);
  await expect(name).toHaveValue(rows[1].name);
  role = 'viewer';
  await page.reload();
  await expect(page.getByText(/Bạn chưa có quyền sửa/)).toBeVisible();
  profileFailure = true;
  await page.goto(`${base}/restaurant/new`);
  await expect(page.getByText(/Chưa tải được quyền tài khoản/)).toBeVisible();
  profileFailure = false;
  console.log('PASS edit ownership gate and profile failure state');

  await page.goto(`${base}/auth/callback?error=access_denied&error_description=Denied`);
  await expect(page.getByRole('heading', { name: 'Chưa đăng nhập được' })).toBeVisible();
  await page.evaluate(({ key }) => { localStorage.removeItem(key); localStorage.setItem(`${key}-code-verifier`, JSON.stringify('a-valid-test-verifier')); }, { key });
  tokenResponse = session;
  await page.goto(`${base}/auth/callback?code=test-code`);
  await expect(page).toHaveURL(/\/profile$/);
  assert.deepEqual(errors, [], 'No unhandled browser errors');
  console.log('PASS PKCE callback success/error; no unhandled browser errors');
} catch (error) {
  await page.screenshot({ path: 'test-results/failure.png', fullPage: true });
  throw error;
} finally { uploadRelease?.(); await browser.close(); }
