create table if not exists public.sales_cockpit_monthly_rto (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('Jeep', 'Citroën')),
  sales_year integer not null check (sales_year between 2000 and 2100),
  sales_month integer not null check (sales_month between 1 and 12),
  units integer not null check (units >= 0),
  source text not null default 'User supplied month-end RTO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_cockpit_monthly_rto_brand_period_key unique (brand, sales_year, sales_month)
);

alter table public.sales_cockpit_monthly_rto enable row level security;

drop policy if exists "Allow public read monthly RTO" on public.sales_cockpit_monthly_rto;
drop policy if exists "Allow public insert monthly RTO" on public.sales_cockpit_monthly_rto;
drop policy if exists "Allow public update monthly RTO" on public.sales_cockpit_monthly_rto;
drop policy if exists "Allow public delete monthly RTO" on public.sales_cockpit_monthly_rto;

create policy "Allow public read monthly RTO"
  on public.sales_cockpit_monthly_rto for select to anon, authenticated using (true);
create policy "Allow public insert monthly RTO"
  on public.sales_cockpit_monthly_rto for insert to anon, authenticated with check (true);
create policy "Allow public update monthly RTO"
  on public.sales_cockpit_monthly_rto for update to anon, authenticated using (true) with check (true);
create policy "Allow public delete monthly RTO"
  on public.sales_cockpit_monthly_rto for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.sales_cockpit_monthly_rto to anon, authenticated, service_role;

insert into public.sales_cockpit_monthly_rto (brand, sales_year, sales_month, units, source)
values
  ('Citroën',2026,1,1171,'User supplied Jan–Oct 2026 RTO summary'),
  ('Citroën',2026,2,804,'User supplied Jan–Oct 2026 RTO summary'),
  ('Citroën',2026,3,758,'User supplied Jan–Oct 2026 RTO summary'),
  ('Citroën',2026,4,719,'User supplied Jan–Oct 2026 RTO summary'),
  ('Citroën',2026,5,638,'User supplied Jan–Oct 2026 RTO summary'),
  ('Citroën',2026,6,727,'User supplied Jan–Oct 2026 RTO summary'),
  ('Citroën',2026,7,916,'User supplied Jan–Oct 2026 RTO summary'),
  ('Citroën',2026,8,805,'User supplied Jan–Oct 2026 RTO summary'),
  ('Citroën',2026,9,842,'User supplied Jan–Oct 2026 RTO summary'),
  ('Citroën',2026,10,862,'User supplied Jan–Oct 2026 RTO summary'),
  ('Jeep',2026,1,301,'User supplied Jan–Oct 2026 RTO summary'),
  ('Jeep',2026,2,203,'User supplied Jan–Oct 2026 RTO summary'),
  ('Jeep',2026,3,210,'User supplied Jan–Oct 2026 RTO summary'),
  ('Jeep',2026,4,249,'User supplied Jan–Oct 2026 RTO summary'),
  ('Jeep',2026,5,207,'User supplied Jan–Oct 2026 RTO summary'),
  ('Jeep',2026,6,258,'User supplied Jan–Oct 2026 RTO summary'),
  ('Jeep',2026,7,199,'User supplied Jan–Oct 2026 RTO summary'),
  ('Jeep',2026,8,186,'User supplied Jan–Oct 2026 RTO summary'),
  ('Jeep',2026,9,278,'User supplied Jan–Oct 2026 RTO summary'),
  ('Jeep',2026,10,216,'User supplied Jan–Oct 2026 RTO summary')
on conflict (brand, sales_year, sales_month) do update
set units = excluded.units, source = excluded.source, updated_at = now();
