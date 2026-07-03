-- Login por nombre_usuario en vez de email: Supabase Auth solo loguea por
-- email, así que el frontend primero resuelve nombre_usuario -> email con
-- esta función y recién ahí llama a signInWithPassword.
--
-- Es SECURITY DEFINER y se ejecuta ANTES de tener sesión (rol anon), por eso
-- no depende de la policy de "usuarios" (que ya solo deja leer a authenticated).
-- Expone lo mínimo posible: dado un nombre_usuario devuelve el email o null,
-- nada más de la fila.

create or replace function public.email_for_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from usuarios where nombre_usuario = p_username
$$;

grant execute on function public.email_for_username(text) to anon;
