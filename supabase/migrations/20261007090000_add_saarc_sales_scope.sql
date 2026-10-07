-- Allow SAARC as a management-sales scope in the daily sales dataset.
ALTER TABLE public.sales_cockpit_daily
  DROP CONSTRAINT IF EXISTS sales_cockpit_daily_brand_check;

ALTER TABLE public.sales_cockpit_daily
  ADD CONSTRAINT sales_cockpit_daily_brand_check
  CHECK (brand = ANY (ARRAY['Jeep'::text, 'Citroën'::text, 'SAARC'::text]));
