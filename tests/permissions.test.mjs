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
    await db.exec(await readFile(new URL('../supabase/migrations/001_initial_schema.sql', import.meta.url), 'utf8'));
    await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
      INSERT INTO auth.users (id,email) VALUES
      ('${owner}','owner@example.test'), ('${friend}','friend@example.test'),
      ('${viewer}','viewer@example.test'), ('${admin}','admin@example.test');
      UPDATE public.profiles SET role='admin';
      INSERT INTO public.restaurants (name,district,created_by,category) VALUES
      ('Legacy','Hoan Kiem','${legacy}','com_bui'),
      ('Legacy date','Hoan Kiem','${legacy}','di_date');`);
    await db.exec(await readFile(new URL('../supabase/migrations/002_member_permissions.sql', import.meta.url), 'utf8'));
    const storageMigration = await readFile(new URL('../supabase/migrations/003_fix_images_bucket.sql', import.meta.url), 'utf8');
    await db.exec(storageMigration);
    await db.exec(storageMigration);
    const categoryMigration = await readFile(new URL('../supabase/migrations/004_refine_categories_and_occasions.sql', import.meta.url), 'utf8');
    await db.exec(categoryMigration);
    await db.exec(categoryMigration);
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
      assert.equal((await asUser(friend, `UPDATE public.restaurants SET name='Bad' WHERE id='${restaurantId}' RETURNING id`)).rows.length, 0);
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
