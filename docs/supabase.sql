create extension if not exists pgcrypto;

create table if not exists public.intake_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  last4 text not null check (last4 ~ '^\d{4}$'),
  client_ref text null,
  expires_at timestamptz not null,
  max_uses integer not null default 5 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.intake_codes
add column if not exists code_ciphertext text null;

create table if not exists public.intake_rate_limits (
  scope text not null,
  ip_address text not null,
  attempt_count integer not null default 1 check (attempt_count >= 0),
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, ip_address)
);

alter table public.intake_codes enable row level security;
alter table public.intake_rate_limits enable row level security;

drop policy if exists "deny_public_intake_codes" on public.intake_codes;
create policy "deny_public_intake_codes"
on public.intake_codes
for all
to public
using (false)
with check (false);

drop policy if exists "deny_public_intake_rate_limits" on public.intake_rate_limits;
create policy "deny_public_intake_rate_limits"
on public.intake_rate_limits
for all
to public
using (false)
with check (false);

create or replace function public.verify_intake_code(input_hash text)
returns table(ok boolean, reason text)
language plpgsql
security definer
as $$
declare
  matched_code public.intake_codes%rowtype;
begin
  select *
  into matched_code
  from public.intake_codes
  where code_hash = input_hash
  for update;

  if not found then
    return query select false, 'invalid'::text;
    return;
  end if;

  if matched_code.revoked then
    return query select false, 'revoked'::text;
    return;
  end if;

  if now() > matched_code.expires_at then
    return query select false, 'expired'::text;
    return;
  end if;

  if matched_code.used_count >= matched_code.max_uses then
    return query select false, 'used'::text;
    return;
  end if;

  update public.intake_codes
  set used_count = used_count + 1
  where id = matched_code.id;

  return query select true, null::text;
end;
$$;

revoke all on function public.verify_intake_code(text) from public;
