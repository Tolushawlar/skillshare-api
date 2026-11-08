-- SkillLink backend MVP schema
-- Run with: supabase db push  (or paste into the Supabase SQL editor)

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists postgis;
create extension if not exists btree_gist;

do $$ begin
  create type public.user_role as enum ('client', 'worker', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('active', 'suspended', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_status as enum ('draft', 'pending', 'verified', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_submission_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.availability_status as enum ('available', 'busy', 'offline');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.booking_status as enum (
    'requested', 'accepted', 'en_route', 'arrived', 'in_progress',
    'completed', 'cancelled', 'declined', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.urgency as enum ('asap', 'scheduled', 'emergency');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'card', 'transfer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'paid', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.service_pricing_type as enum ('fixed', 'hourly', 'quote');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'client',
  full_name text not null,
  email citext unique,
  phone text unique,
  avatar_url text,
  location_label text,
  base_location geography(Point, 4326),
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trades (
  id serial primary key,
  slug text not null unique,
  name text not null unique,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.worker_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  trade text not null,
  bio text,
  years_experience integer not null default 0 check (years_experience between 0 and 60),
  hourly_rate_kobo bigint not null default 0 check (hourly_rate_kobo >= 0),
  service_radius_m integer not null default 10000 check (service_radius_m between 1000 and 50000),
  availability_status public.availability_status not null default 'available',
  is_online boolean not null default false,
  verification_status public.verification_status not null default 'pending',
  verification_note text,
  rating_avg numeric(3,2) not null default 0 check (rating_avg between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  jobs_completed integer not null default 0 check (jobs_completed >= 0),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  pricing_type public.service_pricing_type not null default 'fixed',
  price_kobo bigint not null default 0 check (price_kobo >= 0),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.users(id) on delete cascade,
  media_url text not null,
  title text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_submissions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.users(id) on delete cascade,
  status public.verification_submission_status not null default 'pending',
  id_type text not null,
  id_number_last4 text,
  selfie_url text not null,
  certificate_url text,
  "references" jsonb not null default '[]'::jsonb,
  notes text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  decision_reason text
);

create unique index if not exists one_pending_submission_per_worker
  on public.verification_submissions(worker_id)
  where status = 'pending';

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null unique,
  client_id uuid not null references public.users(id),
  worker_id uuid not null references public.users(id),
  trade text not null,
  description text not null,
  address text not null,
  location geography(Point, 4326),
  urgency public.urgency not null default 'asap',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status public.booking_status not null default 'requested',
  estimated_price_kobo bigint not null default 0 check (estimated_price_kobo >= 0),
  final_price_kobo bigint check (final_price_kobo is null or final_price_kobo >= 0),
  payment_method public.payment_method not null default 'cash',
  payment_status public.payment_status not null default 'pending',
  cancellation_reason text,
  cancelled_by uuid references public.users(id),
  accepted_at timestamptz,
  en_route_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings drop constraint if exists bookings_schedule_valid;
alter table public.bookings
  add constraint bookings_schedule_valid
  check (scheduled_start is null or scheduled_end is null or scheduled_end > scheduled_start);

alter table public.bookings drop constraint if exists bookings_no_worker_overlap;
alter table public.bookings
  add constraint bookings_no_worker_overlap
  exclude using gist (
    worker_id with =,
    tstzrange(scheduled_start, scheduled_end, '[)') with &&
  )
  where (
    status in ('accepted', 'en_route', 'arrived', 'in_progress')
    and scheduled_start is not null
    and scheduled_end is not null
  );

create table if not exists public.booking_events (
  id bigserial primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  actor_id uuid references public.users(id),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  client_id uuid not null references public.users(id),
  worker_id uuid not null references public.users(id),
  rating smallint not null check (rating between 1 and 5),
  comment text,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create table if not exists public.idempotency_keys (
  user_id uuid not null references public.users(id) on delete cascade,
  key text not null,
  endpoint text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (user_id, key)
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_users_base_location on public.users using gist (base_location);
create index if not exists idx_users_role_status on public.users(role, status);
create index if not exists idx_worker_profiles_status on public.worker_profiles(verification_status, is_online);
create index if not exists idx_worker_profiles_trade on public.worker_profiles(trade);
create index if not exists idx_worker_profiles_rating on public.worker_profiles(rating_avg desc, rating_count desc);
create index if not exists idx_services_worker on public.services(worker_id, is_active);
create index if not exists idx_portfolio_worker on public.portfolio_items(worker_id, sort_order);
create index if not exists idx_verifications_worker on public.verification_submissions(worker_id, submitted_at desc);
create index if not exists idx_bookings_client on public.bookings(client_id, created_at desc);
create index if not exists idx_bookings_worker on public.bookings(worker_id, created_at desc);
create index if not exists idx_bookings_status on public.bookings(status, created_at desc);
create index if not exists idx_bookings_location on public.bookings using gist (location);
create index if not exists idx_booking_events_booking on public.booking_events(booking_id, created_at);
create index if not exists idx_reviews_worker on public.reviews(worker_id, created_at desc);
create index if not exists idx_audit_entity on public.audit_logs(entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Updated-at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_worker_profiles_updated_at on public.worker_profiles;
create trigger trg_worker_profiles_updated_at before update on public.worker_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at before update on public.bookings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Create the public profile when a Supabase auth user is created.
-- The Express signup endpoint passes role/profile fields in user_metadata.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role := 'client';
  v_years integer := 0;
  v_rate bigint := 0;
  v_location geography(Point, 4326) := null;
begin
  if v_meta->>'role' = 'worker' then
    v_role := 'worker';
  end if;

  if (v_meta->>'years_experience') ~ '^[0-9]+$' then
    v_years := (v_meta->>'years_experience')::integer;
  end if;

  if (v_meta->>'hourly_rate_kobo') ~ '^[0-9]+$' then
    v_rate := (v_meta->>'hourly_rate_kobo')::bigint;
  end if;

  if (v_meta->>'lat') ~ '^-?[0-9]+(\.[0-9]+)?$'
     and (v_meta->>'lng') ~ '^-?[0-9]+(\.[0-9]+)?$' then
    v_location := st_setsrid(
      st_makepoint((v_meta->>'lng')::double precision, (v_meta->>'lat')::double precision),
      4326
    )::geography;
  end if;

  insert into public.users (
    id, role, full_name, email, phone, location_label, base_location
  )
  values (
    new.id,
    v_role,
    coalesce(nullif(v_meta->>'full_name', ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    new.email,
    nullif(v_meta->>'phone', ''),
    nullif(v_meta->>'location_label', ''),
    v_location
  )
  on conflict (id) do nothing;

  if v_role = 'worker' then
    insert into public.worker_profiles (
      user_id, trade, bio, years_experience, hourly_rate_kobo, service_radius_m,
      is_online, verification_status
    )
    values (
      new.id,
      coalesce(nullif(v_meta->>'trade', ''), 'Mechanic'),
      nullif(v_meta->>'bio', ''),
      v_years,
      v_rate,
      case when (v_meta->>'service_radius_m') ~ '^[0-9]+$' then (v_meta->>'service_radius_m')::integer else 10000 end,
      true,
      'pending'
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Nearby worker search (PostGIS)
-- ---------------------------------------------------------------------------

create or replace function public.nearby_workers(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 10000,
  p_trade text default null,
  p_min_rating numeric default null,
  p_sort text default 'nearest',
  p_limit integer default 50
)
returns table (
  user_id uuid,
  full_name text,
  trade text,
  bio text,
  years_experience integer,
  hourly_rate_kobo bigint,
  service_radius_m integer,
  is_online boolean,
  verification_status public.verification_status,
  rating_avg numeric,
  rating_count integer,
  jobs_completed integer,
  location_label text,
  distance_m double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with point as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    u.id as user_id,
    u.full_name,
    wp.trade,
    wp.bio,
    wp.years_experience,
    wp.hourly_rate_kobo,
    wp.service_radius_m,
    wp.is_online,
    wp.verification_status,
    wp.rating_avg,
    wp.rating_count,
    wp.jobs_completed,
    u.location_label,
    st_distance(u.base_location, point.g) as distance_m
  from public.worker_profiles wp
  join public.users u on u.id = wp.user_id
  cross join point
  where wp.verification_status = 'verified'
    and u.status = 'active'
    and wp.is_online = true
    and u.base_location is not null
    and st_dwithin(u.base_location, point.g, least(p_radius_m, wp.service_radius_m))
    and (p_trade is null or wp.trade = p_trade)
    and (p_min_rating is null or wp.rating_avg >= p_min_rating)
  order by
    case when p_sort = 'nearest' then st_distance(u.base_location, point.g) end asc,
    case when p_sort = 'rating' then wp.rating_avg end desc,
    case when p_sort = 'price' then wp.hourly_rate_kobo end asc,
    wp.rating_count desc,
    u.id
  limit least(coalesce(p_limit, 50), 100);
$$;

-- ---------------------------------------------------------------------------
-- Admin helper and RLS
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

alter table public.users enable row level security;
alter table public.trades enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.services enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.verification_submissions enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.reviews enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists trades_select_all on public.trades;
create policy trades_select_all on public.trades
  for select using (true);

drop policy if exists worker_profiles_select on public.worker_profiles;
create policy worker_profiles_select on public.worker_profiles
  for select using (verification_status = 'verified' or auth.uid() = user_id or public.is_admin());

drop policy if exists worker_profiles_update_own on public.worker_profiles;
create policy worker_profiles_update_own on public.worker_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists services_select on public.services;
create policy services_select on public.services
  for select using (
    exists (
      select 1 from public.worker_profiles wp
      where wp.user_id = services.worker_id and wp.verification_status = 'verified'
    )
    or auth.uid() = worker_id
    or public.is_admin()
  );

drop policy if exists services_write_own on public.services;
create policy services_write_own on public.services
  for all using (auth.uid() = worker_id) with check (auth.uid() = worker_id);

drop policy if exists portfolio_select on public.portfolio_items;
create policy portfolio_select on public.portfolio_items
  for select using (
    exists (
      select 1 from public.worker_profiles wp
      where wp.user_id = portfolio_items.worker_id and wp.verification_status = 'verified'
    )
    or auth.uid() = worker_id
    or public.is_admin()
  );

drop policy if exists portfolio_write_own on public.portfolio_items;
create policy portfolio_write_own on public.portfolio_items
  for all using (auth.uid() = worker_id) with check (auth.uid() = worker_id);

drop policy if exists verifications_select_own on public.verification_submissions;
create policy verifications_select_own on public.verification_submissions
  for select using (auth.uid() = worker_id or public.is_admin());

drop policy if exists verifications_insert_own on public.verification_submissions;
create policy verifications_insert_own on public.verification_submissions
  for insert with check (auth.uid() = worker_id);

drop policy if exists bookings_select_participant on public.bookings;
create policy bookings_select_participant on public.bookings
  for select using (auth.uid() = client_id or auth.uid() = worker_id or public.is_admin());

drop policy if exists bookings_insert_client on public.bookings;
create policy bookings_insert_client on public.bookings
  for insert with check (auth.uid() = client_id);

drop policy if exists booking_events_select_participant on public.booking_events;
create policy booking_events_select_participant on public.booking_events
  for select using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_events.booking_id
        and (b.client_id = auth.uid() or b.worker_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists reviews_select_all on public.reviews;
create policy reviews_select_all on public.reviews
  for select using (true);

drop policy if exists reviews_insert_client on public.reviews;
create policy reviews_insert_client on public.reviews
  for insert with check (auth.uid() = client_id);

-- The API connects with the service role / direct Postgres connection.
-- These grants keep the tables usable if a future frontend talks to Supabase directly.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.trades to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on function public.nearby_workers(double precision, double precision, integer, text, numeric, text, integer) to anon, authenticated, service_role;
