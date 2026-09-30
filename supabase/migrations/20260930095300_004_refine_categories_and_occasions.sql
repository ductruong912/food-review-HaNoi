-- Run after 003. Reclassifies the old category set and separates occasions.
BEGIN;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS occasions TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.restaurants
  ALTER COLUMN category SET DEFAULT 'mon_viet_hang_ngay';

-- Old “Đi date” was an occasion, not a restaurant type. Preserve it as a tag.
UPDATE public.restaurants
SET
  occasions = ARRAY(
    SELECT DISTINCT value
    FROM unnest(COALESCE(occasions, '{}') || ARRAY['hen_ho']) AS value
  ),
  category = 'mon_viet_hang_ngay'
WHERE category = 'di_date';

UPDATE public.restaurants
SET category = CASE category
  WHEN 'com_bui' THEN 'mon_viet_hang_ngay'
  WHEN 'do_uong' THEN 'ca_phe_do_uong'
  WHEN 'do_ngot' THEN 'banh_trang_mieng'
  ELSE category
END
WHERE category IN ('com_bui', 'do_uong', 'do_ngot');

UPDATE public.restaurants
SET occasions = '{}'
WHERE occasions IS NULL;

REVOKE UPDATE (occasions) ON public.restaurants FROM anon;
GRANT UPDATE (occasions) ON public.restaurants TO authenticated;

CREATE INDEX IF NOT EXISTS idx_restaurants_occasions
  ON public.restaurants USING GIN (occasions);

COMMIT;
