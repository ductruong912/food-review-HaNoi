-- Add account-owned bookmarks and collections, multi-photo galleries and confirmed pins.
-- Legacy image_url and map_url values remain readable and are never treated as confirmed pins.
BEGIN;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_accuracy TEXT NOT NULL DEFAULT 'approximate';

UPDATE public.restaurants
SET image_urls = ARRAY[image_url]
WHERE cardinality(image_urls) = 0
  AND image_url IS NOT NULL
  AND btrim(image_url) <> '';

-- Exact accuracy is only meaningful when a complete coordinate pair exists.
UPDATE public.restaurants
SET location_accuracy = 'approximate'
WHERE location_accuracy = 'exact'
  AND (latitude IS NULL OR longitude IS NULL);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_image_urls_check' AND conrelid = 'public.restaurants'::regclass) THEN
    ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_image_urls_check
      CHECK (cardinality(image_urls) <= 5 AND array_position(image_urls, NULL) IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_coordinates_pair_check' AND conrelid = 'public.restaurants'::regclass) THEN
    ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_coordinates_pair_check
      CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_latitude_check' AND conrelid = 'public.restaurants'::regclass) THEN
    ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_latitude_check
      CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_longitude_check' AND conrelid = 'public.restaurants'::regclass) THEN
    ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_longitude_check
      CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_location_accuracy_check' AND conrelid = 'public.restaurants'::regclass) THEN
    ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_location_accuracy_check
      CHECK (location_accuracy IN ('exact', 'approximate'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_exact_location_check' AND conrelid = 'public.restaurants'::regclass) THEN
    ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_exact_location_check
      CHECK (location_accuracy <> 'exact' OR (latitude IS NOT NULL AND longitude IS NOT NULL));
  END IF;
END $$;

COMMENT ON COLUMN public.restaurants.image_url IS 'Legacy single-image field; remains the gallery cover for older clients.';
COMMENT ON COLUMN public.restaurants.image_urls IS 'Ordered restaurant gallery URLs, with image_url retained as the backward-compatible cover.';
COMMENT ON COLUMN public.restaurants.location_accuracy IS 'Legacy and unconfirmed locations default to approximate; contributors can explicitly confirm exact pins.';

GRANT UPDATE (image_urls, latitude, longitude, location_accuracy) ON public.restaurants TO authenticated;

CREATE TABLE IF NOT EXISTS public.user_favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, restaurant_id)
);
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_favorites FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_favorites TO authenticated;
DROP POLICY IF EXISTS "Users manage own favorites" ON public.user_favorites;
CREATE POLICY "Users manage own favorites" ON public.user_favorites FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.favorite_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS favorite_collections_owner_name_key
  ON public.favorite_collections (user_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS favorite_collections_user_created_idx
  ON public.favorite_collections (user_id, created_at);
ALTER TABLE public.favorite_collections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.favorite_collections FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorite_collections TO authenticated;
DROP POLICY IF EXISTS "Users manage own collections" ON public.favorite_collections;
CREATE POLICY "Users manage own collections" ON public.favorite_collections FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.favorite_collection_items (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, restaurant_id),
  FOREIGN KEY (collection_id, user_id)
    REFERENCES public.favorite_collections(id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS favorite_collection_items_user_idx
  ON public.favorite_collection_items (user_id, collection_id);
ALTER TABLE public.favorite_collection_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.favorite_collection_items FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.favorite_collection_items TO authenticated;
DROP POLICY IF EXISTS "Users manage own collection items" ON public.favorite_collection_items;
CREATE POLICY "Users manage own collection items" ON public.favorite_collection_items FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMIT;
