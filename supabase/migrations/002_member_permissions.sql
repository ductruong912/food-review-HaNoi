-- Run once, after 001. Grant approved roles afterwards (see docs/setup.md).
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'viewer';
-- Old roles could be edited publicly, so they must be approved again.
UPDATE public.profiles SET role = 'viewer';
INSERT INTO public.profiles (id, email, display_name, role)
SELECT id, COALESCE(email, ''), COALESCE(raw_user_meta_data->>'full_name', ''), 'viewer'
FROM auth.users ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.current_member_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()) $$;
REVOKE ALL ON FUNCTION private.current_member_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_member_role() TO authenticated;

ALTER FUNCTION public.handle_new_user() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Self update profiles" ON public.profiles;
CREATE POLICY "Read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Public insert restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Authenticated insert restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Owner or admin update restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Owner or admin delete restaurants" ON public.restaurants;

REVOKE ALL ON public.restaurants FROM anon, authenticated;
GRANT SELECT ON public.restaurants TO anon, authenticated;
GRANT INSERT, DELETE ON public.restaurants TO authenticated;
-- Ownership cannot be reassigned through the browser API.
GRANT UPDATE (name, district, address, rating, review, image_url, type, category, price, map_url, updated_at)
  ON public.restaurants TO authenticated;

CREATE POLICY "Members insert own restaurants" ON public.restaurants FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND
    (SELECT private.current_member_role()) IN ('admin', 'contributor'));
CREATE POLICY "Members update owned restaurants" ON public.restaurants FOR UPDATE TO authenticated
  USING ((SELECT private.current_member_role()) = 'admin' OR
    ((SELECT private.current_member_role()) = 'contributor' AND created_by = (SELECT auth.uid())))
  WITH CHECK ((SELECT private.current_member_role()) = 'admin' OR
    ((SELECT private.current_member_role()) = 'contributor' AND created_by = (SELECT auth.uid())));
CREATE POLICY "Members delete owned restaurants" ON public.restaurants FOR DELETE TO authenticated
  USING ((SELECT private.current_member_role()) = 'admin' OR
    ((SELECT private.current_member_role()) = 'contributor' AND created_by = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Public upload storage images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload storage images" ON storage.objects;
CREATE POLICY "Members upload own images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT private.current_member_role()) IN ('admin', 'contributor'));

COMMIT;
