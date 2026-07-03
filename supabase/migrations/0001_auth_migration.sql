-- Migración: pasar el login a Supabase Auth
-- Correr cada bloque en orden en el SQL Editor de Supabase.
-- No se toca RLS ni ninguna otra tabla.

-- 1) Nuevas columnas en usuarios
alter table usuarios add column email text unique;
alter table usuarios add column auth_user_id uuid unique references auth.users(id);

-- 2) Completar el email de cada usuario existente.
--    Reemplazar los placeholders 'TODO@...' por el email real de cada persona
--    antes de correr este bloque.
update usuarios set email = 'TODO@mathias.fraifer'    where id = 1; -- nombre_usuario: mathias.fraifer
update usuarios set email = 'TODO@catriel.leiva'      where id = 2; -- nombre_usuario: catriel.leiva
update usuarios set email = 'TODO@joaquin.riveros'    where id = 3; -- nombre_usuario: joaquin.riveros
update usuarios set email = 'TODO@pruebas.demo'       where id = 4; -- nombre_usuario: pruebas.demo
update usuarios set email = 'TODO@balmaceda.madueño'  where id = 5; -- nombre_usuario: balmaceda.madueño

-- 3) PASO MANUAL (no es SQL): en el dashboard de Supabase ir a
--    Authentication > Users > Add user, y crear un usuario por cada
--    email de arriba, con una contraseña nueva para cada uno.

-- 4) Vincular usuarios <-> auth.users por email, y verificar
update public.usuarios u
set auth_user_id = au.id
from auth.users au
where au.email = u.email;

-- Debe devolver 0 filas. Si devuelve alguna, falta crear ese usuario en Auth (paso 3)
-- o el email no coincide exactamente.
select id, nombre_usuario, email from usuarios where auth_user_id is null;

-- 5) OPCIONAL — correr recién después de confirmar que el login nuevo
--    funciona en la app. Elimina la contraseña en texto plano, que ya
--    no se usa desde el código.
-- alter table usuarios drop column password;
