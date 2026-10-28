-- RLS limita las filas; los GRANT permiten acceder a la tabla.
-- Ambos son necesarios para que los usuarios autenticados puedan usar la API.
begin;

alter table public.profiles enable row level security;
alter table public.platforms enable row level security;
alter table public.expense_types enable row level security;
alter table public.trips enable row level security;
alter table public.expenses enable row level security;

-- Las tablas privadas no se consultan ni modifican sin iniciar sesión.
revoke all privileges on table
  public.profiles, public.platforms, public.expense_types,
  public.trips, public.expenses
from public, anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.profiles, public.platforms, public.expense_types,
  public.trips, public.expenses
to authenticated;

-- Se conservan las políticas de propietario y las FKs de la migración inicial.
-- No se conceden TRUNCATE, BYPASSRLS ni permisos sobre auth.users.
commit;
