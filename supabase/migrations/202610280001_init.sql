-- MiRuta MVP. Ejecutar mediante Supabase CLI o SQL Editor.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id,name), unique(user_id,id)
);
create table public.expense_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id,name), unique(user_id,id)
);
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform_id uuid,
  origin text not null check (length(trim(origin)) > 0),
  destination text not null check (length(trim(destination)) > 0),
  start_at timestamptz not null,
  end_at timestamptz,
  status text not null default 'planificado' check (status in ('planificado','en_curso','finalizado','cancelado')),
  estimated_budget numeric(12,2) not null default 0 check (estimated_budget >= 0),
  service_price numeric(12,2) not null default 0 check (service_price >= 0),
  service_collected numeric(12,2) not null default 0 check (service_collected >= 0 and service_collected <= service_price),
  kilometers integer check (kilometers >= 0),
  external_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or end_at >= start_at),
  unique(user_id,id),
  foreign key (user_id,platform_id) references public.platforms(user_id,id)
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null,
  expense_type_id uuid,
  spent_at date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  refundable_amount numeric(12,2) not null default 0 check (refundable_amount >= 0 and refundable_amount <= amount),
  reimbursed_amount numeric(12,2) not null default 0 check (reimbursed_amount >= 0 and reimbursed_amount <= refundable_amount),
  paid_by_driver boolean not null default true,
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id,trip_id) references public.trips(user_id,id) on delete cascade,
  foreign key (user_id,expense_type_id) references public.expense_types(user_id,id)
);
create index on public.trips (user_id,start_at desc);
create index on public.expenses (user_id,trip_id,spent_at desc);
create index on public.platforms(user_id);
create index on public.expense_types(user_id);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
create trigger trips_touch before update on public.trips for each row execute function public.touch_updated_at();
create trigger expenses_touch before update on public.expenses for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.platforms enable row level security;
alter table public.expense_types enable row level security;
alter table public.trips enable row level security;
alter table public.expenses enable row level security;

create policy "Own profile" on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Own platforms" on public.platforms for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own expense types" on public.expense_types for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own trips" on public.trips for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own expenses" on public.expenses for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Supply starter categories per user; run as an elevated auth trigger.
create function public.bootstrap_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  insert into public.platforms(user_id,name) select new.id, unnest(array['DriiveMe','HiFlow','Otoqi','Roadit','Flovi','ONLOGIST','Otras']);
  insert into public.expense_types(user_id,name) select new.id, unnest(array['Combustible','Recarga eléctrica','Peajes','Tren / autobús','Taxi / VTC','Avión / ferry','Comidas','Alojamiento','Aparcamiento','Otros']);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.bootstrap_new_user();
revoke all on function public.bootstrap_new_user() from public, anon, authenticated;
