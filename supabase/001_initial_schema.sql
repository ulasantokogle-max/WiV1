-- WiV1 — standalone foundation
-- This schema is independent from the existing UlasanToko system.

create extension if not exists pgcrypto;

create type public.wifi_card_status as enum ('active', 'inactive', 'suspended');
create type public.wifi_event_type as enum ('page_view', 'qr_scan', 'nfc_scan', 'password_copy', 'wifi_connect');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wifi_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  card_code text not null unique,
  slug text not null unique,
  status public.wifi_card_status not null default 'inactive',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wifi_networks (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null unique references public.wifi_cards(id) on delete cascade,
  ssid text not null,
  encrypted_password text not null,
  security_type text not null default 'WPA2',
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wifi_events (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.wifi_cards(id) on delete cascade,
  event_type public.wifi_event_type not null,
  source text not null default 'unknown' check (source in ('qr','nfc','direct','unknown')),
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index idx_locations_business_id on public.locations(business_id);
create index idx_wifi_cards_business_id on public.wifi_cards(business_id);
create index idx_wifi_cards_location_id on public.wifi_cards(location_id);
create index idx_wifi_cards_slug on public.wifi_cards(slug);
create index idx_wifi_events_card_created on public.wifi_events(card_id, created_at desc);
create index idx_wifi_events_type_created on public.wifi_events(event_type, created_at desc);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_updated_at on public.businesses;
create trigger businesses_updated_at before update on public.businesses for each row execute function public.set_updated_at();
drop trigger if exists locations_updated_at on public.locations;
create trigger locations_updated_at before update on public.locations for each row execute function public.set_updated_at();
drop trigger if exists wifi_cards_updated_at on public.wifi_cards;
create trigger wifi_cards_updated_at before update on public.wifi_cards for each row execute function public.set_updated_at();
drop trigger if exists wifi_networks_updated_at on public.wifi_networks;
create trigger wifi_networks_updated_at before update on public.wifi_networks for each row execute function public.set_updated_at();

-- RLS: no direct public table access. Server routes use service role.
alter table public.businesses enable row level security;
alter table public.locations enable row level security;
alter table public.wifi_cards enable row level security;
alter table public.wifi_networks enable row level security;
alter table public.wifi_events enable row level security;

comment on table public.wifi_networks is 'WiV1 network credentials. encrypted_password must be AES-256-GCM ciphertext; never expose this table to anon clients.';

-- Admin access: create a Supabase Auth user first, then insert that user's UUID here.
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin','owner')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
create policy "admins can read own admin record" on public.admin_users
  for select to authenticated using (user_id = auth.uid());

create index idx_admin_users_role on public.admin_users(role);
