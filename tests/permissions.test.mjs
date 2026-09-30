import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

test('member permissions enforce ownership and protect roles in PostgreSQL', async (t) => {
  const db = new PGlite({ extensions: { 'uuid-ossp': uuid_ossp, pgcrypto } });
  const owner = '11111111-1111-4111-8111-111111111111';
  const friend = '22222222-2222-4222-8222-222222222222';
  const viewer = '33333333-3333-4333-8333-333333333333';
  const admin = '44444444-4444-4444-8444-444444444444';
  const legacy = '55555555-5555-4555-8555-555555555555';
  const asUser = async (id, sql) => {
    await db.exec(`SET ROLE ${id ? 'authenticated' : 'anon'}`);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id || '']);
    try { return await db.query(sql); } finally { await db.exec('RESET ROLE'); }
  };
  const insert = (id, name = 'Sample') => `INSERT INTO public.restaurants (name, district, created_by) VALUES ('${name}', 'Hoan Kiem', '${id}') RETURNING id`;
  try {
    // Only Supabase-owned infrastructure is stubbed; all project migrations run unchanged.
    await db.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
        $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1] $$;
      GRANT USAGE ON SCHEMA storage TO anon, authenticated;
      GRANT ALL ON storage.objects TO anon, authenticated;
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20260930095000_001_initial_schema.sql', import.meta.url), 'utf8'));
    await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
      INSERT INTO auth.users (id,email) VALUES
      ('${owner}','owner@example.test'), ('${friend}','friend@example.test'),
      ('${viewer}','viewer@example.test'), ('${admin}','admin@example.test');
      UPDATE public.profiles SET role='admin';
      INSERT INTO public.restaurants (name,district,created_by,category) VALUES
      ('Legacy','Hoan Kiem','${legacy}','com_bui'),
      ('Legacy date','Hoan Kiem','${legacy}','di_date');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20260930095100_002_member_permissions.sql', import.meta.url), 'utf8'));
    const storageMigration = await readFile(new URL('../supabase/migrations/20260930095200_003_fix_images_bucket.sql', import.meta.url), 'utf8');
    await db.exec(storageMigration);
    await db.exec(storageMigration);
    const categoryMigration = await readFile(new URL('../supabase/migrations/20260930095300_004_refine_categories_and_occasions.sql', import.meta.url), 'utf8');
    await db.exec(categoryMigration);
    await db.exec(categoryMigration);
    await db.exec("UPDATE public.restaurants SET price='40–60k' WHERE name='Legacy'");
    const priceMigration = await readFile(new URL('../supabase/migrations/20260930095400_005_structured_prices.sql', import.meta.url), 'utf8');
    await db.exec(priceMigration);
    await db.exec(priceMigration);
    await db.exec("UPDATE public.restaurants SET image_url='https://images.example.test/legacy.jpg' WHERE name='Legacy'");
    const savedMigration = await readFile(new URL('../supabase/migrations/20260930095500_006_personal_saved_collections_photos_location.sql', import.meta.url), 'utf8');
    await db.exec(savedMigration);
    await db.exec(savedMigration);
    await t.test('storage migration is repeatable and configures size and MIME limits', async () => {
      const { rows } = await db.query("SELECT * FROM storage.buckets WHERE id='images'");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].public, true);
      assert.equal(Number(rows[0].file_size_limit), 8388608);
      assert.deepEqual(rows[0].allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
    });

    await t.test('old roles reset and legacy restaurants survive migration', async () => {
      assert.equal((await db.query("SELECT count(*)::int AS n FROM public.profiles WHERE role <> 'viewer'")).rows[0].n, 0);
      assert.equal((await db.query("SELECT count(*)::int AS n FROM public.restaurants WHERE name='Legacy'")).rows[0].n, 1);
      const rows = (await db.query("SELECT category, occasions FROM public.restaurants WHERE name='Legacy date'")).rows;
      assert.equal(rows[0].category, 'mon_viet_hang_ngay');
      assert.deepEqual(rows[0].occasions, ['hen_ho']);
      assert.equal((await db.query("SELECT category FROM public.restaurants WHERE name='Legacy'")).rows[0].category, 'mon_viet_hang_ngay');
    });
    await t.test('structured price migration preserves ambiguous legacy values without guessing', async () => {
      const row = (await db.query("SELECT price, price_min_vnd, price_max_vnd, price_unit FROM public.restaurants WHERE name='Legacy'")).rows[0];
      assert.equal(row.price, '40–60k');
      assert.equal(row.price_min_vnd, null);
      assert.equal(row.price_max_vnd, null);
      assert.equal(row.price_unit, null);
      for (const column of ['price_min_vnd', 'price_max_vnd', 'price_unit']) {
        assert.equal((await db.query("SELECT has_column_privilege('authenticated','public.restaurants',$1,'UPDATE') AS allowed", [column])).rows[0].allowed, true);
      }
      await assert.rejects(db.query("INSERT INTO public.restaurants (name,district,price_min_vnd,price_max_vnd,price_unit) VALUES ('Bad price','Hoan Kiem',60000,40000,'vnd_per_person')"), /restaurants_price_range_check/);
    });
    await t.test('photos remain compatible with image_url and legacy positions stay approximate', async () => {
      const row = (await db.query("SELECT image_url,image_urls,latitude,longitude,location_accuracy FROM public.restaurants WHERE name='Legacy'")).rows[0];
      assert.equal(row.image_url, 'https://images.example.test/legacy.jpg');
      assert.deepEqual(row.image_urls, ['https://images.example.test/legacy.jpg']);
      assert.equal(row.latitude, null);
      assert.equal(row.longitude, null);
      assert.equal(row.location_accuracy, 'approximate');
      await assert.rejects(db.query("UPDATE public.restaurants SET latitude=21.03 WHERE name='Legacy'"), /restaurants_coordinates_pair_check/);
      await assert.rejects(db.query("UPDATE public.restaurants SET location_accuracy='guessed' WHERE name='Legacy'"), /restaurants_location_accuracy_check/);
      await assert.rejects(db.query("UPDATE public.restaurants SET location_accuracy='exact' WHERE name='Legacy'"), /restaurants_exact_location_check/);
    });
    await t.test('favorites and collections are isolated, deduplicated and owner-bound', async () => {
      const restaurantId = (await db.query("SELECT id FROM public.restaurants WHERE name='Legacy'")).rows[0].id;
      await asUser(owner, `INSERT INTO public.user_favorites (user_id,restaurant_id) VALUES ('${owner}','${restaurantId}')`);
      await asUser(friend, `INSERT INTO public.user_favorites (user_id,restaurant_id) VALUES ('${friend}','${restaurantId}')`);
      assert.equal((await asUser(owner, 'SELECT * FROM public.user_favorites')).rows.length, 1);
      assert.equal((await asUser(friend, 'SELECT * FROM public.user_favorites')).rows.length, 1);
      assert.equal((await asUser(owner, `SELECT * FROM public.user_favorites WHERE user_id='${friend}'`)).rows.length, 0);
      await assert.rejects(asUser(owner, `INSERT INTO public.user_favorites (user_id,restaurant_id) VALUES ('${friend}','${restaurantId}')`), /row-level security/);
      assert.equal((await asUser(owner, `DELETE FROM public.user_favorites WHERE user_id='${friend}' RETURNING restaurant_id`)).rows.length, 0);
      await assert.rejects(asUser(owner, `UPDATE public.user_favorites SET restaurant_id='${restaurantId}' WHERE user_id='${friend}'`), /permission denied/);
      await asUser(owner, `INSERT INTO public.user_favorites (user_id,restaurant_id) VALUES ('${owner}','${restaurantId}') ON CONFLICT DO NOTHING`);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM public.user_favorites')).rows[0].n, 2);
      await assert.rejects(asUser(null, 'SELECT * FROM public.user_favorites'), /permission denied/);

      const collectionId = (await asUser(owner, `INSERT INTO public.favorite_collections (user_id,name) VALUES ('${owner}','Muốn thử') RETURNING id`)).rows[0].id;
      const friendCollectionId = (await asUser(friend, `INSERT INTO public.favorite_collections (user_id,name) VALUES ('${friend}','Quán quen') RETURNING id`)).rows[0].id;
      assert.equal((await asUser(owner, 'SELECT * FROM public.favorite_collections')).rows.length, 1);
      assert.equal((await asUser(friend, 'SELECT * FROM public.favorite_collections')).rows.length, 1);
      assert.equal((await asUser(owner, `SELECT * FROM public.favorite_collections WHERE id='${friendCollectionId}'`)).rows.length, 0);
      assert.equal((await asUser(owner, `UPDATE public.favorite_collections SET name='Hijacked' WHERE id='${friendCollectionId}' RETURNING id`)).rows.length, 0);
      assert.equal((await asUser(owner, `DELETE FROM public.favorite_collections WHERE id='${friendCollectionId}' RETURNING id`)).rows.length, 0);
      await assert.rejects(asUser(friend, `INSERT INTO public.favorite_collection_items (user_id,collection_id,restaurant_id) VALUES ('${friend}','${collectionId}','${restaurantId}')`), /row-level security|foreign key/);
      await asUser(owner, `INSERT INTO public.favorite_collection_items (user_id,collection_id,restaurant_id) VALUES ('${owner}','${collectionId}','${restaurantId}')`);
      await asUser(owner, `INSERT INTO public.favorite_collection_items (user_id,collection_id,restaurant_id) VALUES ('${owner}','${collectionId}','${restaurantId}') ON CONFLICT DO NOTHING`);
      await asUser(friend, `INSERT INTO public.favorite_collection_items (user_id,collection_id,restaurant_id) VALUES ('${friend}','${friendCollectionId}','${restaurantId}')`);
      assert.equal((await asUser(owner, 'SELECT * FROM public.favorite_collection_items')).rows.length, 1);
      assert.equal((await asUser(friend, 'SELECT * FROM public.favorite_collection_items')).rows.length, 1);
      assert.equal((await asUser(owner, `DELETE FROM public.favorite_collection_items WHERE user_id='${friend}' RETURNING restaurant_id`)).rows.length, 0);
      await assert.rejects(asUser(owner, `UPDATE public.favorite_collection_items SET restaurant_id='${restaurantId}' WHERE user_id='${friend}'`), /permission denied/);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM public.favorite_collection_items')).rows[0].n, 2);
      await assert.rejects(asUser(owner, `INSERT INTO public.favorite_collections (user_id,name) VALUES ('${owner}','muốn thử')`), /favorite_collections_owner_name_key/);
    });
    await db.exec(`UPDATE public.profiles SET role='contributor' WHERE id IN ('${owner}','${friend}');
      UPDATE public.profiles SET role='admin' WHERE id='${admin}';`);

    await t.test('public can read but cannot insert, update, delete, or read profiles', async () => {
      assert.equal((await asUser(null, 'SELECT * FROM public.restaurants')).rows.length, 2);
      for (const sql of [insert(owner), "UPDATE public.restaurants SET name='Bad'", 'DELETE FROM public.restaurants', 'SELECT * FROM public.profiles']) {
        await assert.rejects(asUser(null, sql), /permission denied|row-level security/);
      }
    });
    await t.test('viewers cannot write or upload', async () => {
      await assert.rejects(asUser(viewer, insert(viewer)), /row-level security/);
      assert.equal((await asUser(viewer, "UPDATE public.restaurants SET name='Bad' RETURNING id")).rows.length, 0);
      assert.equal((await asUser(viewer, 'DELETE FROM public.restaurants RETURNING id')).rows.length, 0);
      await assert.rejects(asUser(viewer, `INSERT INTO storage.objects (bucket_id,name) VALUES ('images','${viewer}/restaurants/a.jpg')`), /row-level security/);
    });
    let restaurantId;
    await t.test('approved member can insert own restaurant but cannot impersonate another owner', async () => {
      restaurantId = (await asUser(owner, insert(owner))).rows[0].id;
      assert.equal((await db.query('SELECT category FROM public.restaurants WHERE id=$1', [restaurantId])).rows[0].category, 'mon_viet_hang_ngay');
      await assert.rejects(asUser(owner, insert(friend)), /row-level security/);
    });
    await t.test('member can update own restaurant, cannot edit others or transfer ownership', async () => {
      assert.equal((await asUser(owner, `UPDATE public.restaurants SET name='Updated' WHERE id='${restaurantId}' RETURNING id`)).rows.length, 1);
      assert.deepEqual((await asUser(owner, `UPDATE public.restaurants SET occasions=ARRAY['hen_ho'] WHERE id='${restaurantId}' RETURNING occasions`)).rows[0].occasions, ['hen_ho']);
      assert.deepEqual((await asUser(owner, `UPDATE public.restaurants SET price_min_vnd=40000,price_max_vnd=60000,price_unit='vnd_per_person' WHERE id='${restaurantId}' RETURNING price_min_vnd,price_max_vnd,price_unit`)).rows[0], {
        price_min_vnd: 40000, price_max_vnd: 60000, price_unit: 'vnd_per_person',
      });
      assert.deepEqual((await asUser(owner, `UPDATE public.restaurants SET image_urls=ARRAY['https://images.example.test/a.jpg','https://images.example.test/b.jpg'],image_url='https://images.example.test/b.jpg',latitude=21.03,longitude=105.84,location_accuracy='exact' WHERE id='${restaurantId}' RETURNING image_urls,latitude,longitude,location_accuracy`)).rows[0], {
        image_urls: ['https://images.example.test/a.jpg', 'https://images.example.test/b.jpg'], latitude: 21.03, longitude: 105.84, location_accuracy: 'exact',
      });
      assert.equal((await asUser(friend, `UPDATE public.restaurants SET name='Bad' WHERE id='${restaurantId}' RETURNING id`)).rows.length, 0);
      assert.equal((await asUser(viewer, `UPDATE public.restaurants SET latitude=21.01,longitude=105.81 WHERE id='${restaurantId}' RETURNING id`)).rows.length, 0);
      assert.equal((await asUser(friend, `DELETE FROM public.restaurants WHERE id='${restaurantId}' RETURNING id`)).rows.length, 0);
      await assert.rejects(asUser(owner, `UPDATE public.restaurants SET created_by='${friend}' WHERE id='${restaurantId}'`), /permission denied/);
    });
    await t.test('profile roles cannot be elevated or other profiles read/edited', async () => {
      assert.equal((await asUser(owner, 'SELECT * FROM public.profiles')).rows.length, 1);
      await assert.rejects(asUser(owner, "UPDATE public.profiles SET role='admin'"), /permission denied/);
      assert.equal((await asUser(owner, "UPDATE public.profiles SET display_name='New name' RETURNING id")).rows.length, 1);
      assert.equal((await asUser(owner, `UPDATE public.profiles SET display_name='Bad' WHERE id='${friend}' RETURNING id`)).rows.length, 0);
    });
    await t.test('upload requires approved membership and own storage folder', async () => {
      await asUser(owner, `INSERT INTO storage.objects (bucket_id,name) VALUES ('images','${owner}/restaurants/a.jpg')`);
      for (const id of [null, friend]) {
        await assert.rejects(asUser(id, `INSERT INTO storage.objects (bucket_id,name) VALUES ('images','${owner}/restaurants/b.jpg')`), /row-level security/);
      }
    });
    await t.test('admin can edit old guest posts and delete another member post', async () => {
      assert.equal((await asUser(admin, "UPDATE public.restaurants SET name='Legacy updated' WHERE name='Legacy' RETURNING id")).rows.length, 1);
      assert.equal((await asUser(admin, `DELETE FROM public.restaurants WHERE id='${restaurantId}' RETURNING id`)).rows.length, 1);
    });
    await t.test('owner can delete own post and loses access when membership revoked', async () => {
      const id = (await asUser(owner, insert(owner))).rows[0].id;
      assert.equal((await asUser(owner, `DELETE FROM public.restaurants WHERE id='${id}' RETURNING id`)).rows.length, 1);
      await db.exec(`UPDATE public.profiles SET role='viewer' WHERE id='${owner}'`);
      await assert.rejects(asUser(owner, insert(owner)), /row-level security/);
    });
    await t.test('new accounts default to viewer', async () => {
      await db.exec(`INSERT INTO auth.users (id,email) VALUES ('${legacy}', 'new@example.test')`);
      assert.equal((await db.query(`SELECT role FROM public.profiles WHERE id='${legacy}'`)).rows[0].role, 'viewer');
    });
  } finally { await db.close(); }
});
