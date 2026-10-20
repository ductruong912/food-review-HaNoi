import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { expect } from 'playwright/test';
import { createClient } from '@supabase/supabase-js';
import { getLocalSupabaseEnvironment, runSupabaseCli } from '../scripts/local-supabase.mjs';

const appUrl = 'http://localhost:3100';
const accountAEmail = 'food-review-a@example.test';
const accountBEmail = 'food-review-b@example.test';
const adminEmail = 'food-review-admin@example.test';
const accountAId = 'a1111111-1111-4111-8111-111111111111';
const accountBId = 'b2222222-2222-4222-8222-222222222222';
const adminId = 'c3333333-3333-4333-8333-333333333333';
const deviceRestaurantId = 'd4444444-4444-4444-8444-444444444444';
const adminRestaurantId = 'e5555555-5555-4555-8555-555555555555';
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// This guard runs before starting the app, requesting Auth email, or issuing any write.
const local = getLocalSupabaseEnvironment();
const appOrigin = new URL(local.url);
assert.ok(['localhost', '127.0.0.1', '::1'].includes(appOrigin.hostname), 'Integration target must be loopback.');
assert.equal(appOrigin.port, '55321', 'Integration target must be the configured local Supabase port.');
const anonClient = createClient(local.url, local.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const migrationRows = await readLocalMigrations();
assert.deepEqual(migrationRows, [
  '20260930095000', '20260930095100', '20260930095200',
  '20260930095300', '20260930095400', '20260930095500',
], 'All six project migrations must be applied to this local test database before any writes.');
const seedCheck = await anonClient.from('restaurants').select('id').in('id', [deviceRestaurantId, adminRestaurantId]);
assert.ifError(seedCheck.error);
assert.equal(seedCheck.data?.length, 2, 'Expected only the synthetic local seed restaurants.');
console.log('PASS local-only target guard, all six migrations, and synthetic seed data');

const available = await isPortFree('127.0.0.1', 3100);
assert.ok(available, 'Port 3100 is already in use; stop that listener before running the local Auth/browser integration.');
const devServer = spawn(process.execPath, [
  resolve('node_modules', 'next', 'dist', 'bin', 'next'), 'dev',
  '--hostname', '127.0.0.1', '--port', '3100',
], {
  cwd: process.cwd(),
  env: { ...process.env, ...local.appEnvironment, NEXT_LOCAL_SUPABASE_TEST: '1' },
  stdio: 'ignore',
  windowsHide: true,
});

let browser;
let aClient;
let bClient;
let adminClient;
let aContext;
let aSecondContext;
let bContext;
let adminContext;
let aPage;
let bPage;
let createdRestaurantId;
let collectionId;
let adminOwnedRestaurantId;
const uploadedPaths = [];
const clients = [];

try {
  await waitForApp(devServer);
  browser = await chromium.launch({
    ...(process.platform === 'win32' ? { channel: process.env.BROWSER_CHANNEL || 'msedge' } : {}),
    headless: true,
  });

  aContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  aPage = await aContext.newPage();
  aPage.setDefaultTimeout(20_000);
  await aPage.addInitScript((restaurantId) => {
    localStorage.setItem('food_hn_bookmarks', JSON.stringify([restaurantId]));
  }, deviceRestaurantId);
  await loginFromDeviceImport(aPage, accountAEmail);
  await expect(aPage.getByRole('dialog', { name: 'Nhập danh sách trên thiết bị' })).toBeVisible();
  await expect(aPage.getByText('Quán thử của contributor A', { exact: true })).toBeVisible();
  await aPage.getByRole('button', { name: 'Nhập 1 quán' }).click();
  await expect(aPage.getByRole('status').filter({ hasText: 'Đã nhập lựa chọn' })).toBeVisible();
  assert.deepEqual(await aPage.evaluate(() => JSON.parse(localStorage.getItem('food_hn_bookmarks') || '[]')), [deviceRestaurantId], 'Device copy must remain after import.');
  await aPage.getByRole('button', { name: 'Đóng nhập danh sách' }).click();
  await aPage.getByRole('button', { name: 'Nhập từ thiết bị' }).click();
  await expect(aPage.getByText(/1 quán đã có trong tài khoản/)).toBeVisible();
  await aPage.getByRole('button', { name: 'Đóng nhập danh sách' }).click();

  const aSession = await browserSession(aPage);
  aClient = clientForSession(local.url, local.anonKey, aSession);
  clients.push(aClient);
  await assertSession(aClient, accountAId, 'contributor');
  await aPage.getByRole('button', { name: '+ Muốn thử' }).click();
  const collectionSelector = aPage.getByLabel('Thêm Quán thử của contributor A vào bộ sưu tập');
  await collectionSelector.selectOption({ label: 'Muốn thử' });
  await expect(aPage.getByText('Đã thêm quán vào bộ sưu tập.')).toBeVisible();
  console.log('PASS real email Auth, resumed import after login, duplicate handling, device retention, and collection UI');

  const aCollections = await aClient.from('favorite_collections').select('id,name').eq('user_id', accountAId).eq('name', 'Muốn thử');
  assert.ifError(aCollections.error);
  assert.equal(aCollections.data?.length, 1);
  collectionId = aCollections.data[0].id;
  const aCollectionItems = await aClient.from('favorite_collection_items').select('restaurant_id').eq('user_id', accountAId).eq('collection_id', collectionId);
  assert.ifError(aCollectionItems.error);
  assert.ok(aCollectionItems.data?.some((row) => row.restaurant_id === deviceRestaurantId), 'Collection should contain the UI-selected restaurant.');

  aSecondContext = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const aSecondPage = await aSecondContext.newPage();
  aSecondPage.setDefaultTimeout(20_000);
  await loginFromProfile(aSecondPage, accountAEmail);
  await aSecondPage.goto(`${appUrl}/saved`);
  await expect(aSecondPage.getByRole('heading', { name: 'Quán thử của contributor A' })).toBeVisible();
  const syncedCollection = aSecondPage.locator('summary').filter({ hasText: 'Muốn thử' });
  await expect(syncedCollection).toBeVisible();
  await syncedCollection.click();
  await expect(aSecondPage.getByRole('link', { name: 'Quán thử của contributor A', exact: true })).toBeVisible();
  console.log('PASS same-account saved and collection data sync across separate browser sessions');

  bContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  bPage = await bContext.newPage();
  bPage.setDefaultTimeout(20_000);
  await loginFromProfile(bPage, accountBEmail);
  await bPage.goto(`${appUrl}/saved`);
  await expect(bPage.getByRole('heading', { name: 'Quán thử của admin' })).toBeVisible();
  await expect(bPage.getByText('Quán thử của contributor A', { exact: true })).toHaveCount(0);
  bClient = clientForSession(local.url, local.anonKey, await browserSession(bPage));
  clients.push(bClient);
  await assertSession(bClient, accountBId, 'viewer');
  console.log('PASS viewer account sees only its own private saved data in the UI');

  adminContext = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const adminPage = await adminContext.newPage();
  adminPage.setDefaultTimeout(20_000);
  await loginFromProfile(adminPage, adminEmail);
  adminClient = clientForSession(local.url, local.anonKey, await browserSession(adminPage));
  clients.push(adminClient);
  await assertSession(adminClient, adminId, 'admin');
  console.log('PASS administrator email Auth and existing role assignment');

  await aPage.goto(`${appUrl}/restaurant/new`);
  await aPage.getByLabel('Tên quán').fill(`Quán tích hợp ${runId}`);
  await aPage.getByLabel('Quận / huyện').selectOption({ label: 'Hoàn Kiếm' });
  await aPage.getByLabel('Loại quán').selectOption({ label: 'Món Việt hằng ngày' });
  await aPage.getByLabel('Độ chính xác').selectOption('exact');
  await aPage.getByLabel('Vĩ độ').fill('21.026111');
  await aPage.getByLabel('Kinh độ').fill('105.847222');
  await aPage.getByRole('button', { name: /Xác nhận ghim và lưu tọa độ|Xác nhận ghim đã chọn/ }).click();
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6kAAAAASUVORK5CYII=', 'base64');
  await aPage.locator('input[type="file"]').setInputFiles(Array.from({ length: 6 }, (_, index) => ({
    name: `local-integration-${index + 1}.png`, mimeType: 'image/png', buffer: tinyPng,
  })));
  await expect(aPage.getByText(/5\/5 ảnh/)).toBeVisible();
  await aPage.getByRole('button', { name: 'Chọn ảnh 2 làm ảnh bìa' }).click();
  await expect(aPage.getByRole('button', { name: 'Ảnh 2 đang làm ảnh bìa' })).toHaveAttribute('aria-pressed', 'true');
  uploadedPaths.push(...(await publicImagePaths(aPage)).map(storageObjectPath));
  await aPage.getByRole('button', { name: 'Thêm quán', exact: true }).last().click();
  await aPage.waitForURL(/\/restaurant\/[0-9a-f-]{36}$/);
  createdRestaurantId = new URL(aPage.url()).pathname.split('/').at(-1);

  const createdResult = await aClient.from('restaurants').select('id,name,image_url,image_urls,latitude,longitude,location_accuracy,created_by').eq('id', createdRestaurantId).single();
  assert.ifError(createdResult.error);
  assert.equal(createdResult.data.created_by, accountAId);
  assert.equal(createdResult.data.image_urls.length, 5, 'UI and database must cap a six-file selection at five uploaded photos.');
  assert.equal(createdResult.data.image_url, createdResult.data.image_urls[1], 'Selected second image must be the backwards-compatible cover.');
  assert.equal(createdResult.data.latitude, 21.026111);
  assert.equal(createdResult.data.longitude, 105.847222);
  assert.equal(createdResult.data.location_accuracy, 'exact');
  for (const imageUrl of createdResult.data.image_urls) {
    const response = await fetch(imageUrl);
    assert.equal(response.status, 200, 'Uploaded public bucket image must be readable.');
  }
  const tooManyImages = await aClient.from('restaurants').update({ image_urls: [...createdResult.data.image_urls, createdResult.data.image_urls[0]] }).eq('id', createdRestaurantId);
  assert.ok(tooManyImages.error, 'Database must reject more than five gallery images.');
  console.log('PASS contributor form: five-image cap, public Storage reads, cover selection, and confirmed exact pin');

  const viewerUploadPath = `${accountBId}/restaurants/${runId}-viewer.png`;
  const viewerUpload = await bClient.storage.from('images').upload(viewerUploadPath, tinyPng, { contentType: 'image/png' });
  assert.ok(viewerUpload.error, 'Viewer must not upload to shared restaurant image storage.');
  const crossFolderPath = `${accountBId}/restaurants/${runId}-cross-account.png`;
  const crossFolderUpload = await aClient.storage.from('images').upload(crossFolderPath, tinyPng, { contentType: 'image/png' });
  assert.ok(crossFolderUpload.error, 'Contributor must not upload into another account folder.');
  console.log('PASS Storage denies viewer uploads and cross-account folders');

  await verifyPrivateRls(aClient, bClient, accountAId, accountBId, collectionId, deviceRestaurantId, adminRestaurantId);
  console.log('PASS direct JWT/PostgREST calls enforce private favorite and collection RLS between A and B');

  const viewerRestaurant = await bClient.from('restaurants').insert({
    name: `Viewer denied ${runId}`, district: 'Hoàn Kiếm', category: 'com_bui', rating: 'binh_thuong',
    created_by: accountBId, created_by_name: 'Test viewer B',
  }).select('id');
  assert.ok(viewerRestaurant.error, 'Viewer must not create a shared restaurant.');
  const adminOwned = await adminClient.from('restaurants').insert({
    name: `Admin role check ${runId}`, district: 'Ba Đình', category: 'com_bui', rating: 'binh_thuong',
    created_by: adminId, created_by_name: 'Test administrator',
  }).select('id').single();
  assert.ifError(adminOwned.error);
  adminOwnedRestaurantId = adminOwned.data.id;
  const contributorCannotEditAdmin = await aClient.from('restaurants').update({ review: 'unauthorized' }).eq('id', adminOwnedRestaurantId).select('id');
  assert.ifError(contributorCannotEditAdmin.error);
  assert.equal(contributorCannotEditAdmin.data?.length, 0, 'Contributor cannot edit another owner’s restaurant.');
  const contributorCannotDeleteAdmin = await aClient.from('restaurants').delete().eq('id', adminOwnedRestaurantId).select('id');
  assert.ifError(contributorCannotDeleteAdmin.error);
  assert.equal(contributorCannotDeleteAdmin.data?.length, 0, 'Contributor cannot delete another owner’s restaurant.');
  const adminCanEdit = await adminClient.from('restaurants').update({ review: 'admin can manage shared data' }).eq('id', createdRestaurantId).select('id').single();
  assert.ifError(adminCanEdit.error);
  const adminCanDelete = await adminClient.from('restaurants').delete().eq('id', adminOwnedRestaurantId).select('id').single();
  assert.ifError(adminCanDelete.error);
  adminOwnedRestaurantId = undefined;
  const contributorCanEditOwn = await aClient.from('restaurants').update({ review: 'contributor owns this test restaurant' }).eq('id', createdRestaurantId).select('id').single();
  assert.ifError(contributorCanEditOwn.error);
  console.log('PASS shared restaurant insert/update/delete permissions by viewer, contributor ownership, and admin');

  const googleSettings = await fetch(`${local.url}/auth/v1/settings`, { headers: { apikey: local.anonKey } });
  assert.ok(googleSettings.ok);
  const providers = (await googleSettings.json()).external ?? {};
  if (providers.google !== true) console.log('SKIP Google OAuth: local Auth reports Google provider disabled; email Auth was tested separately.');
  else console.log('INFO Google OAuth is enabled locally; provider flow was not exercised by this email-focused test.');

  await verifyNetworkFailureAndAccountSwitch(aPage, bPage, aClient, accountAId, accountBId, adminRestaurantId, deviceRestaurantId);
  console.log('PASS account logout/switch and offline bookmark retention/retry');
  console.log('PASS local Supabase integration suite completed; no fixture routes were installed.');
} catch (error) {
  console.error(`FAIL local Supabase integration: ${safeError(error, [local.anonKey, local.serviceRoleKey])}`);
  process.exitCode = 1;
} finally {
  if (aClient && uploadedPaths.length) await aClient.storage.from('images').remove(uploadedPaths).catch(() => undefined);
  if (aClient && createdRestaurantId) {
    await aClient.from('favorite_collection_items').delete().eq('user_id', accountAId).eq('restaurant_id', createdRestaurantId);
    await aClient.from('user_favorites').delete().eq('user_id', accountAId).eq('restaurant_id', createdRestaurantId);
    await aClient.from('restaurants').delete().eq('id', createdRestaurantId);
  }
  if (aClient && collectionId) await aClient.from('favorite_collections').delete().eq('user_id', accountAId).eq('id', collectionId);
  if (aClient) {
    const leftoverCollections = await aClient.from('favorite_collections').select('id').eq('user_id', accountAId).eq('name', 'Muốn thử');
    if (!leftoverCollections.error && leftoverCollections.data?.length) {
      await aClient.from('favorite_collections').delete().eq('user_id', accountAId).in('id', leftoverCollections.data.map((row) => row.id));
    }
    if (!createdRestaurantId) {
      const leftoverRestaurant = await aClient.from('restaurants').select('id').eq('created_by', accountAId).like('name', `Quán tích hợp ${runId}`);
      if (!leftoverRestaurant.error && leftoverRestaurant.data?.length) {
        await aClient.from('restaurants').delete().eq('created_by', accountAId).in('id', leftoverRestaurant.data.map((row) => row.id));
      }
    }
  }
  if (adminClient && adminOwnedRestaurantId) await adminClient.from('restaurants').delete().eq('id', adminOwnedRestaurantId);
  if (aClient) await aClient.from('user_favorites').delete().eq('user_id', accountAId).eq('restaurant_id', deviceRestaurantId);
  for (const client of clients) await client.auth.signOut().catch(() => undefined);
  await Promise.all([aContext?.close(), aSecondContext?.close(), bContext?.close(), adminContext?.close()].filter(Boolean));
  await browser?.close();
  if (devServer && devServer.exitCode === null) {
    devServer.kill();
    await new Promise((resolveExit) => devServer.once('exit', resolveExit));
  }
}

async function readLocalMigrations() {
  const result = runSupabaseCli(['migration', 'list', '--local']);
  assert.equal(result.status, 0, 'Could not verify local Supabase migration history.');
  const parsed = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
  return parsed.migrations.map((migration) => migration.local);
}

async function isPortFree(host, port) {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.once('error', () => resolvePort(false));
    server.listen(port, host, () => server.close(() => resolvePort(true)));
  });
}

async function waitForApp(server) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('Next.js local test server exited before becoming ready.');
    try {
      const response = await fetch(`${appUrl}/profile`);
      if (response.ok) return;
    } catch { /* Wait for Next dev to compile and bind its local port. */ }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error('Next.js did not become ready at localhost:3100 within 90 seconds.');
}

async function loginFromDeviceImport(page, email) {
  const previous = await getMailIds(email);
  await page.goto(`${appUrl}/saved`);
  await page.getByRole('button', { name: 'Đăng nhập để đồng bộ' }).click();
  await sendEmailLogin(page, email, previous);
  await page.waitForURL(`${appUrl}/saved?importDevice=1`);
}

async function loginFromProfile(page, email) {
  const previous = await getMailIds(email);
  await page.goto(`${appUrl}/profile`);
  await page.getByText('Đăng nhập ngay', { exact: true }).click();
  await sendEmailLogin(page, email, previous);
  await page.waitForURL(`${appUrl}/profile`);
}

async function sendEmailLogin(page, email, previousMailIds) {
  const dialog = page.getByRole('dialog', { name: 'Đăng nhập' });
  await expect(dialog).toBeVisible();
  let authResponseStatus;
  const captureAuthResponse = (response) => {
    if (new URL(response.url()).pathname.endsWith('/auth/v1/otp')) authResponseStatus = response.status();
  };
  page.on('response', captureAuthResponse);
  await page.locator('#login-email').fill(email);
  await page.getByRole('button', { name: 'Gửi link đăng nhập' }).click();
  const sentStatus = dialog.getByRole('status');
  const loginError = dialog.getByRole('alert');
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline && !(await sentStatus.isVisible().catch(() => false)) && !(await loginError.isVisible().catch(() => false))) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  page.off('response', captureAuthResponse);
  if (await loginError.isVisible().catch(() => false)) {
    throw new Error(`Local email Auth request failed (HTTP ${authResponseStatus ?? 'no response'}); app retained its generic login error.`);
  }
  await expect(sentStatus).toContainText('Đã gửi link');
  const magicLink = await waitForMagicLink(email, previousMailIds);
  await page.goto(magicLink);
}

async function getMailIds(email) {
  const { messages } = await fetchMailMessages();
  return new Set(messages.filter((message) => JSON.stringify(message.To ?? message.to ?? '').toLowerCase().includes(email)).map(mailId));
}

async function waitForMagicLink(email, previousIds) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const { messages } = await fetchMailMessages();
    const message = messages.find((candidate) => {
      const id = mailId(candidate);
      const recipient = JSON.stringify(candidate.To ?? candidate.to ?? '').toLowerCase();
      return id && !previousIds.has(id) && recipient.includes(email);
    });
    if (message) {
      const response = await fetch(`${local.mailpitUrl}/api/v1/message/${encodeURIComponent(mailId(message))}`);
      assert.ok(response.ok, 'Could not read the synthetic Auth email from local Mailpit.');
      const detail = await response.json();
      const body = `${detail.HTML ?? detail.html ?? ''}\n${detail.Text ?? detail.text ?? ''}`;
      const hrefs = [...body.matchAll(/href=["']([^"']+)["']/gi)].map((match) => decodeHtml(match[1]));
      for (const href of hrefs) {
        try {
          const parsed = new URL(href);
          if (parsed.origin === local.url && parsed.pathname.endsWith('/auth/v1/verify')) return href;
        } catch { /* Ignore non-URL links in the email. */ }
      }
      throw new Error('Local Auth email arrived, but it contained no link to the local Supabase verify endpoint.');
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`No new local Auth email arrived for ${email} within 45 seconds.`);
}

async function fetchMailMessages() {
  const response = await fetch(`${local.mailpitUrl}/api/v1/messages?limit=100`);
  assert.ok(response.ok, 'Local Mailpit API is unavailable.');
  const payload = await response.json();
  return { messages: payload.messages ?? payload.Messages ?? [] };
}

function mailId(message) {
  return message.ID ?? message.Id ?? message.id ?? '';
}

function decodeHtml(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&#x3D;', '=').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
}

async function browserSession(page) {
  const session = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) => candidate.startsWith('sb-') && candidate.endsWith('-auth-token'));
    const stored = key ? JSON.parse(localStorage.getItem(key) || '{}') : null;
    return stored ? { access_token: stored.access_token, refresh_token: stored.refresh_token } : null;
  });
  assert.ok(session?.access_token && session?.refresh_token, 'Expected an Auth-issued session/JWT in browser storage.');
  return session;
}

function clientForSession(url, key, session) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const ready = client.auth.setSession(session).then(({ error }) => { if (error) throw error; });
  client.__sessionReady = ready;
  return client;
}

async function assertSession(client, expectedId, expectedRole) {
  await client.__sessionReady;
  const user = await client.auth.getUser();
  assert.ifError(user.error);
  assert.equal(user.data.user.id, expectedId, 'Auth must issue the expected account identity.');
  const profile = await client.from('profiles').select('role').eq('id', expectedId).single();
  assert.ifError(profile.error);
  assert.equal(profile.data.role, expectedRole, 'Existing role assignment must be applied through authenticated profile read.');
}

async function verifyPrivateRls(a, b, aId, bId, aCollection, aRestaurantId, bRestaurantId) {
  const aFavorites = await a.from('user_favorites').select('restaurant_id').eq('user_id', aId);
  const bFavorites = await b.from('user_favorites').select('restaurant_id').eq('user_id', bId);
  assert.ifError(aFavorites.error);
  assert.ifError(bFavorites.error);
  assert.ok(aFavorites.data?.some((row) => row.restaurant_id === aRestaurantId));
  assert.ok(bFavorites.data?.some((row) => row.restaurant_id === bRestaurantId));

  for (const [client, foreignId] of [[a, bId], [b, aId]]) {
    const favorites = await client.from('user_favorites').select('*').eq('user_id', foreignId);
    const collections = await client.from('favorite_collections').select('*').eq('user_id', foreignId);
    const items = await client.from('favorite_collection_items').select('*').eq('user_id', foreignId);
    assert.ifError(favorites.error);
    assert.ifError(collections.error);
    assert.ifError(items.error);
    assert.deepEqual(favorites.data, [], 'Another account’s favorites must not be readable through PostgREST.');
    assert.deepEqual(collections.data, [], 'Another account’s collections must not be readable through PostgREST.');
    assert.deepEqual(items.data, [], 'Another account’s collection items must not be readable through PostgREST.');
  }

  const forgedFavorite = await b.from('user_favorites').insert({ user_id: aId, restaurant_id: aRestaurantId });
  assert.ok(forgedFavorite.error, 'A direct request cannot create a favorite owned by another user.');
  const deleteForeignFavorite = await b.from('user_favorites').delete().eq('user_id', aId).eq('restaurant_id', aRestaurantId).select('restaurant_id');
  assert.ifError(deleteForeignFavorite.error);
  assert.deepEqual(deleteForeignFavorite.data, [], 'A direct request cannot delete another user’s favorite.');

  const ownerCollection = await a.from('favorite_collections').select('id,name').eq('id', aCollection).single();
  assert.ifError(ownerCollection.error);
  const forgedCollection = await b.from('favorite_collections').insert({ user_id: aId, name: `Forged ${runId}` });
  assert.ok(forgedCollection.error, 'A direct request cannot create a collection for another user.');
  const editForeignCollection = await b.from('favorite_collections').update({ name: 'Foreign edit' }).eq('id', ownerCollection.data.id).select('id');
  assert.ok(editForeignCollection.error || editForeignCollection.data?.length === 0, 'A direct request cannot edit another user’s collection.');
  const deleteForeignCollection = await b.from('favorite_collections').delete().eq('id', ownerCollection.data.id).select('id');
  assert.ifError(deleteForeignCollection.error);
  assert.deepEqual(deleteForeignCollection.data, [], 'A direct request cannot delete another user’s collection.');
  const collectionAfterAttack = await a.from('favorite_collections').select('name').eq('id', ownerCollection.data.id).single();
  assert.ifError(collectionAfterAttack.error);
  assert.equal(collectionAfterAttack.data.name, 'Muốn thử');

  const forgedItem = await b.from('favorite_collection_items').insert({ user_id: aId, collection_id: ownerCollection.data.id, restaurant_id: aRestaurantId });
  assert.ok(forgedItem.error, 'A direct request cannot write an item into another user’s collection.');
  const roleElevation = await b.from('profiles').update({ role: 'admin' }).eq('id', bId).select('id');
  assert.ok(roleElevation.error, 'A viewer cannot elevate its own role through the public API.');
}

async function publicImagePaths(page) {
  return page.locator('[style*="/storage/v1/object/public/images/"]').evaluateAll((elements) => elements.map((element) => {
    const match = getComputedStyle(element).backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    return match?.[1] ?? '';
  }).filter(Boolean));
}

function storageObjectPath(publicUrl) {
  const marker = '/storage/v1/object/public/images/';
  const pathname = new URL(publicUrl).pathname;
  const index = pathname.indexOf(marker);
  assert.notEqual(index, -1, 'Uploaded image should use the configured public images bucket.');
  return decodeURIComponent(pathname.slice(index + marker.length));
}

async function verifyNetworkFailureAndAccountSwitch(a, b, aClient, aId, bId, bOnlyRestaurantId, restaurantId) {
  await a.goto(`${appUrl}/restaurant/new`);
  const draftName = `Bản nháp tích hợp ${runId}`;
  await a.getByLabel('Tên quán').fill(draftName);
  await expect(a.getByRole('status').filter({ hasText: 'Bản nháp được lưu' })).toBeVisible();
  await a.context().setOffline(true);
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6kAAAAASUVORK5CYII=', 'base64');
  await a.locator('input[type="file"]').setInputFiles({ name: 'offline-upload.png', mimeType: 'image/png', buffer: tinyPng });
  await expect(a.getByRole('alert').filter({ hasText: 'Chưa tải được ảnh.' })).toBeVisible();
  assert.equal(await a.getByLabel('Tên quán').inputValue(), draftName, 'Failed upload must leave the form draft intact.');
  await a.context().setOffline(false);

  await a.goto(`${appUrl}/saved`);
  await expect(a.getByRole('heading', { name: 'Quán thử của contributor A' })).toBeVisible();
  const save = a.getByRole('button', { name: 'Bỏ lưu Quán thử của contributor A' });
  await a.context().setOffline(true);
  const failedFetch = await a.evaluate(async (apiUrl) => {
    try { await fetch(`${apiUrl}/auth/v1/settings`); return false; } catch { return true; }
  }, local.url);
  assert.equal(failedFetch, true, 'Browser must observe the actual local API network failure while offline.');
  await save.click();
  await expect(a.getByText(/Chưa đồng bộ được thay đổi/)).toBeVisible();
  const deviceState = await a.evaluate((id) => JSON.parse(localStorage.getItem(`food_hn_bookmarks:${id}`) || '[]'), aId);
  assert.ok(!deviceState.includes(restaurantId), 'Offline removal must update the device/account cache immediately.');
  const pending = await a.evaluate((id) => JSON.parse(localStorage.getItem(`food_hn_bookmarks_pending:${id}`) || '[]'), aId);
  assert.ok(pending.some((change) => change.id === restaurantId && change.isSaved === false), 'Failed remote change must remain queued for retry.');
  const remoteBeforeRetry = await aClient.from('user_favorites').select('restaurant_id').eq('user_id', aId).eq('restaurant_id', restaurantId);
  assert.ifError(remoteBeforeRetry.error);
  assert.equal(remoteBeforeRetry.data?.length, 1, 'Server must retain the bookmark while the browser is actually offline.');
  await a.context().setOffline(false);
  await a.getByRole('button', { name: 'Thử lại' }).click();
  await expect(a.getByText('Danh sách tài khoản sẵn sàng đồng bộ.')).toBeVisible();
  const remoteAfterRetry = await aClient.from('user_favorites').select('restaurant_id').eq('user_id', aId).eq('restaurant_id', restaurantId);
  assert.ifError(remoteAfterRetry.error);
  assert.deepEqual(remoteAfterRetry.data, [], 'Retry must apply the queued removal to Supabase.');

  await b.goto(`${appUrl}/profile`);
  await b.getByTitle('Đăng xuất').click();
  await expect(b.getByText('Đăng nhập ngay', { exact: true })).toBeVisible();
  assert.equal(await b.evaluate(() => localStorage.getItem('sb-127-auth-token') === null), true, 'Logout should remove this browser session.');
  const previous = await getMailIds(accountAEmail);
  await b.getByText('Đăng nhập ngay', { exact: true }).click();
  await sendEmailLogin(b, accountAEmail, previous);
  await b.waitForURL(`${appUrl}/profile`);
  await b.goto(`${appUrl}/saved`);
  await expect(b.getByRole('heading', { name: 'Quán thử của admin' })).toHaveCount(0);
  const accountStores = await b.evaluate(({ ownerA, ownerB }) => ({
    a: JSON.parse(localStorage.getItem(`food_hn_bookmarks:${ownerA}`) || '[]'),
    b: JSON.parse(localStorage.getItem(`food_hn_bookmarks:${ownerB}`) || '[]'),
    currentAuthKeys: Object.keys(localStorage).filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token')),
  }), { ownerA: aId, ownerB: bId });
  assert.ok(!accountStores.a.includes(bOnlyRestaurantId), 'Account switch must not copy B’s private favorite into A’s local state.');
  assert.ok(accountStores.b.includes(bOnlyRestaurantId), 'B’s saved cache must remain associated with B after logout and switching accounts.');
  assert.equal(accountStores.currentAuthKeys.length, 1, 'The switched browser must hold one active Auth session.');
}

function safeError(error, secrets) {
  let message = error?.stack || error?.message || String(error);
  for (const secret of secrets.filter(Boolean)) message = message.replaceAll(secret, '[redacted local key]');
  return message.replace(/eyJ[A-Za-z0-9._-]{30,}/g, '[redacted JWT]').replace(/[A-Za-z0-9_-]{180,}/g, '[redacted token]');
}
