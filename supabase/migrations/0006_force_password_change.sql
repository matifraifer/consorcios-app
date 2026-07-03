-- Fuerza a los 5 usuarios ya vinculados (ver 0001) a cambiar su contraseña
-- en el próximo login. El frontend lee este flag de auth.users.raw_user_meta_data
-- y redirige a /cambiar-password hasta que se limpie.
update auth.users au
set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('must_change_password', true)
from public.usuarios u
where u.auth_user_id = au.id;

-- Verificación: debería devolver las 5 filas con el flag en true
select u.nombre_usuario, au.raw_user_meta_data->'must_change_password' as must_change_password
from public.usuarios u
join auth.users au on au.id = u.auth_user_id;

-- De acá en adelante, para forzarlo en un usuario NUEVO: al crearlo en
-- Authentication > Users > Add user, completar el campo "User Metadata" con:
-- {"must_change_password": true}
