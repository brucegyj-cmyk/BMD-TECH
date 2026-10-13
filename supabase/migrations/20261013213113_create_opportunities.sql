create table public.opportunities (
  id bigint generated always as identity primary key,
  title text not null,
  url text not null unique,
  source_excerpt text,
  why_it_fits text,
  status text not null default 'new' check (status in ('new', 'approved', 'rejected')),
  found_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table public.opportunities enable row level security;

revoke all on table public.opportunities from anon, authenticated;
