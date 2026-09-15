-- ============================================================
-- Food Review Hà Nội — Database Schema & Migration
-- Khớp hoàn toàn với bảng restaurants hiện tại (50 quán)
-- Chạy script này trong Supabase SQL Editor
-- ============================================================

-- 1. Kích hoạt Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. Bảng restaurants (Tạo mới nếu chưa có, hoặc cập nhật nếu đã có)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  rating TEXT NOT NULL DEFAULT 'ngon', -- 'ngon' | 'binh_thuong' | 'khong_ngon' | 'chua_an'
  review TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  type TEXT DEFAULT 'food',
  category TEXT DEFAULT 'com_bui', -- 'com_bui' | 'do_uong' | 'di_date' | 'lau_nuong' | 'do_ngot'
  price TEXT,
  map_url TEXT,
  created_by UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bổ sung các cột mới nếu bảng đã tồn tại từ trước (an toàn, không mất dữ liệu cũ)
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS map_url TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restaurants_updated_at ON public.restaurants;
CREATE TRIGGER trg_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. Bảng profiles (Liên kết auth.users cho phân quyền & tài khoản tạm)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  avatar_url TEXT,
  role TEXT DEFAULT 'contributor' CHECK (role IN ('admin', 'contributor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tự động đồng bộ profile khi user đăng ký / đăng nhập tạm
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, 'guest@foodreview.local'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, 'bạn'), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 4. Indexes tăng tốc độ tìm kiếm & lọc
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_restaurants_district ON public.restaurants (district);
CREATE INDEX IF NOT EXISTS idx_restaurants_category ON public.restaurants (category);
CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON public.restaurants (rating);
CREATE INDEX IF NOT EXISTS idx_restaurants_created_at ON public.restaurants (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurants_created_by ON public.restaurants (created_by);

-- ============================================================
-- 5. Row Level Security (RLS) & Phân quyền
-- ============================================================
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Chính sách cho restaurants:
-- 1) Ai cũng có thể xem quán
DROP POLICY IF EXISTS "Public read restaurants" ON public.restaurants;
CREATE POLICY "Public read restaurants" ON public.restaurants
  FOR SELECT USING (true);

-- 2) Cho phép thêm quán mới (kể cả tài khoản tạm / khách)
DROP POLICY IF EXISTS "Authenticated insert restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Public insert restaurants" ON public.restaurants;
CREATE POLICY "Public insert restaurants" ON public.restaurants
  FOR INSERT WITH CHECK (true);

-- 3) Cho phép cập nhật thông tin quán
DROP POLICY IF EXISTS "Owner or admin update restaurants" ON public.restaurants;
CREATE POLICY "Owner or admin update restaurants" ON public.restaurants
  FOR UPDATE USING (true);

-- 4) Cho phép xóa quán
DROP POLICY IF EXISTS "Owner or admin delete restaurants" ON public.restaurants;
CREATE POLICY "Owner or admin delete restaurants" ON public.restaurants
  FOR DELETE USING (true);

-- Chính sách cho profiles:
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
CREATE POLICY "Public read profiles" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Self update profiles" ON public.profiles;
CREATE POLICY "Self update profiles" ON public.profiles
  FOR UPDATE USING (true);

-- ============================================================
-- 6. Cấu hình Storage bucket "images" cho ảnh quán ăn
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read storage images" ON storage.objects;
CREATE POLICY "Public read storage images" ON storage.objects
  FOR SELECT USING (bucket_id = 'images');

DROP POLICY IF EXISTS "Authenticated upload storage images" ON storage.objects;
DROP POLICY IF EXISTS "Public upload storage images" ON storage.objects;
CREATE POLICY "Public upload storage images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'images');
