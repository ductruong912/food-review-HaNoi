-- Synthetic users and restaurants for the isolated local integration stack only.
-- These reserved example.test addresses and IDs are not real personal data.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, email_change_confirm_status, phone_change, phone_change_token,
  reauthentication_token, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'a1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'food-review-a@example.test', '', now(), '', '', '', '', '', 0, '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Test contributor A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'food-review-b@example.test', '', now(), '', '', '', '', '', 0, '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Test viewer B"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c3333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'food-review-admin@example.test', '', now(), '', '', '', '', '', 0, '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Test administrator"}', now(), now())
ON CONFLICT (id) DO NOTHING;

UPDATE auth.users
SET instance_id = '00000000-0000-0000-0000-000000000000',
    confirmation_token = '', recovery_token = '', email_change_token_new = '',
    email_change = '', email_change_token_current = '', email_change_confirm_status = 0,
    phone_change = '', phone_change_token = '', reauthentication_token = ''
WHERE email IN (
  'food-review-a@example.test',
  'food-review-b@example.test',
  'food-review-admin@example.test'
)
AND instance_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000000';

-- GoTrue resolves email identities during sign-in; auth.users rows alone are insufficient.
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
SELECT
  id::text,
  id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
FROM auth.users
WHERE email IN (
  'food-review-a@example.test',
  'food-review-b@example.test',
  'food-review-admin@example.test'
)
ON CONFLICT (provider_id, provider) DO NOTHING;

UPDATE public.profiles
SET role = CASE email
  WHEN 'food-review-a@example.test' THEN 'contributor'
  WHEN 'food-review-b@example.test' THEN 'viewer'
  WHEN 'food-review-admin@example.test' THEN 'admin'
END
WHERE email IN (
  'food-review-a@example.test',
  'food-review-b@example.test',
  'food-review-admin@example.test'
);

INSERT INTO public.restaurants (
  id, name, district, address, rating, review, category, price,
  price_min_vnd, price_max_vnd, price_unit, map_url,
  latitude, longitude, location_accuracy, created_by, created_by_name
)
VALUES
  ('d4444444-4444-4444-8444-444444444444', 'Quán thử của contributor A', 'Hoàn Kiếm', 'Hàng Mành', 'ngon', 'Dữ liệu tổng hợp cho kiểm thử local.', 'mon_viet_hang_ngay', '40–60k', 40000, 60000, 'vnd_per_person', 'https://maps.google.com/?q=21.025,105.845', 21.025, 105.845, 'exact', 'a1111111-1111-4111-8111-111111111111', 'Test contributor A'),
  ('e5555555-5555-4555-8555-555555555555', 'Quán thử của admin', 'Ba Đình', 'Đội Cấn', 'binh_thuong', 'Bản ghi tổng hợp để kiểm tra quyền quản trị.', 'banh_trang_mieng', '50k', 50000, 50000, 'vnd_per_person', 'https://maps.google.com/?q=21.035,105.825', 21.035, 105.825, 'exact', 'c3333333-3333-4333-8333-333333333333', 'Test administrator')
ON CONFLICT (id) DO NOTHING;

-- Synthetic rows used by the separate browser UI fixture suite for server-rendered detail pages.
INSERT INTO public.restaurants (
  id, name, district, address, rating, review, category, price, map_url, created_at
)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Bún chả Đắc Kim', 'Hoàn Kiếm', 'Hàng Mành', 'ngon', 'Thịt nướng thơm, nên đi trước giờ trưa.', 'mon_viet_hang_ngay', '50k', NULL, '2026-09-01'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Phở Bò', 'Hoàn Kiếm', 'Hàng Bông', 'ngon', 'Nước dùng trong, đậm vị.', 'mon_viet_hang_ngay', '60k', 'https://maps.google.com/?q=21.025,105.845', '2026-09-01'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Chè bốn mùa', 'Ba Đình', 'Hàng Cân', 'chua_an', 'Chè đậu xanh.', 'banh_trang_mieng', NULL, NULL, '2026-09-02')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_favorites (user_id, restaurant_id)
VALUES ('b2222222-2222-4222-8222-222222222222', 'e5555555-5555-4555-8555-555555555555')
ON CONFLICT DO NOTHING;

INSERT INTO public.favorite_collections (id, user_id, name)
VALUES ('f6666666-6666-4666-8666-666666666666', 'b2222222-2222-4222-8222-222222222222', 'Collection riêng của B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.favorite_collection_items (user_id, collection_id, restaurant_id)
VALUES ('b2222222-2222-4222-8222-222222222222', 'f6666666-6666-4666-8666-666666666666', 'e5555555-5555-4555-8555-555555555555')
ON CONFLICT DO NOTHING;
