-- Store only explicitly entered price ranges. Keep the legacy text column intact.
BEGIN;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS price_min_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS price_max_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS price_unit TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurants_price_unit_check'
      AND conrelid = 'public.restaurants'::regclass
  ) THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_price_unit_check
      CHECK (price_unit IS NULL OR price_unit IN ('vnd_per_person', 'vnd_per_group'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurants_price_range_check'
      AND conrelid = 'public.restaurants'::regclass
  ) THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_price_range_check
      CHECK (
        (price_min_vnd IS NULL AND price_max_vnd IS NULL)
        OR (
          price_min_vnd IS NOT NULL AND price_max_vnd IS NOT NULL
          AND price_min_vnd > 0 AND price_max_vnd >= price_min_vnd
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.restaurants.price_unit IS
  'Price basis: vnd_per_person or vnd_per_group. NULL means the basis is unknown.';

-- Migration 002 grants UPDATE by column; grant the newly introduced price fields too.
GRANT UPDATE (price_min_vnd, price_max_vnd, price_unit)
  ON public.restaurants TO authenticated;

COMMIT;
